import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "node:fs/promises";
import path from "node:path";

type InstitutionRow = {
  id: number;
  institutionType: "education" | "institution";
  name: string;
  address: string | null;
  detailAddress: string | null;
};

type KakaoAddressDoc = {
  x: string;
  y: string;
  address_name: string;
  address_type: string;
};

type KakaoAddressResponse = {
  meta: {
    total_count: number;
    pageable_count: number;
    is_end: boolean;
  };
  documents: KakaoAddressDoc[];
};

const DATABASE_URL = process.env.DATABASE_URL || "";
const KAKAO_REST_API_KEY = process.env.KAKAO_REST_API_KEY || "";

const BATCH_SIZE = Number(process.env.GEOCODE_BATCH_SIZE || 500);
const CONCURRENCY = Number(process.env.GEOCODE_CONCURRENCY || 2);
const REQUEST_DELAY_MS = Number(process.env.GEOCODE_DELAY_MS || 150);
const FAIL_LOG_PATH = path.resolve(
  process.cwd(),
  "geocode-practice-institutions-failed.json"
);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assertEnv() {
  if (!DATABASE_URL) {
    throw new Error("DATABASE_URL 환경변수가 없습니다.");
  }
  if (!KAKAO_REST_API_KEY) {
    throw new Error("KAKAO_REST_API_KEY 환경변수가 없습니다.");
  }
}

function buildCandidateQueries(row: InstitutionRow): string[] {
  const address = (row.address || "").trim();
  const detailAddress = (row.detailAddress || "").trim();

  const list = [
    [address, detailAddress].filter(Boolean).join(" ").trim(),
    address,
  ];

  return Array.from(new Set(list.filter(Boolean)));
}

async function geocodeByAddress(query: string): Promise<{ lat: number; lng: number } | null> {
  const url = new URL("https://dapi.kakao.com/v2/local/search/address.json");
  url.searchParams.set("query", query);
  url.searchParams.set("analyze_type", "similar");

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: `KakaoAK ${KAKAO_REST_API_KEY}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Kakao API 오류: ${res.status} ${text}`);
  }

  const json = (await res.json()) as KakaoAddressResponse;
  const first = json.documents?.[0];
  if (!first) return null;

  const lat = Number(first.y);
  const lng = Number(first.x);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  return { lat, lng };
}

async function geocodeWithFallback(row: InstitutionRow): Promise<{
  lat: number;
  lng: number;
  matchedQuery: string;
} | null> {
  const queries = buildCandidateQueries(row);

  for (const query of queries) {
    const result = await geocodeByAddress(query);
    if (result) {
      return {
        ...result,
        matchedQuery: query,
      };
    }
  }

  return null;
}

function parseMysqlUrl(databaseUrl: string) {
  const u = new URL(databaseUrl);

  return {
    host: u.hostname,
    port: Number(u.port || 3306),
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
  };
}

async function loadRows(conn: mysql.Connection, limit: number): Promise<InstitutionRow[]> {
  const [rows] = await conn.query(
    `
    SELECT
      id,
      institutionType,
      name,
      address,
      detailAddress
    FROM practice_institutions
    WHERE isActive = 1
      AND address IS NOT NULL
      AND TRIM(address) <> ''
      AND latitude IS NULL
      AND longitude IS NULL
    ORDER BY id ASC
    LIMIT ?
    `,
    [limit]
  );

  return rows as InstitutionRow[];
}

async function updateRow(
  conn: mysql.Connection,
  id: number,
  lat: number,
  lng: number
) {
  await conn.query(
    `
    UPDATE practice_institutions
    SET
      latitude = ?,
      longitude = ?,
      geocodedAt = NOW()
    WHERE id = ?
    `,
    [lat.toFixed(7), lng.toFixed(7), id]
  );
}

async function appendFailLog(item: any) {
  let current: any[] = [];
  try {
    const raw = await fs.readFile(FAIL_LOG_PATH, "utf8");
    current = JSON.parse(raw);
  } catch {
    current = [];
  }
  current.push(item);
  await fs.writeFile(FAIL_LOG_PATH, JSON.stringify(current, null, 2), "utf8");
}

async function worker(conn: mysql.Connection, rows: InstitutionRow[], workerNo: number) {
  let success = 0;
  let fail = 0;

  for (const row of rows) {
    try {
      const geo = await geocodeWithFallback(row);

      if (!geo) {
        fail += 1;
        console.log(`[W${workerNo}] NO_MATCH id=${row.id} name=${row.name}`);
        await appendFailLog({
          id: row.id,
          name: row.name,
          address: row.address,
          detailAddress: row.detailAddress,
          reason: "NO_MATCH",
          at: new Date().toISOString(),
        });
      } else {
        await updateRow(conn, row.id, geo.lat, geo.lng);
        success += 1;
        console.log(
          `[W${workerNo}] OK id=${row.id} name=${row.name} -> ${geo.lat}, ${geo.lng} (${geo.matchedQuery})`
        );
      }
    } catch (e: any) {
      fail += 1;
      console.error(`[W${workerNo}] ERROR id=${row.id} name=${row.name}: ${e?.message || e}`);
      await appendFailLog({
        id: row.id,
        name: row.name,
        address: row.address,
        detailAddress: row.detailAddress,
        reason: e?.message || String(e),
        at: new Date().toISOString(),
      });
      await sleep(700);
    }

    await sleep(REQUEST_DELAY_MS);
  }

  return { success, fail };
}

async function main() {
  assertEnv();

  const config = parseMysqlUrl(DATABASE_URL);
  const conn = await mysql.createConnection(config);

  try {
    const rows = await loadRows(conn, BATCH_SIZE);

    if (!rows.length) {
      console.log("지오코딩할 대상이 없습니다. latitude/longitude NULL 행이 없습니다.");
      return;
    }

    console.log(`대상 ${rows.length}건 시작`);
    console.log(`동시성=${CONCURRENCY}, 딜레이=${REQUEST_DELAY_MS}ms`);

    const chunks: InstitutionRow[][] = Array.from({ length: CONCURRENCY }, () => []);
    rows.forEach((row, idx) => {
      chunks[idx % CONCURRENCY].push(row);
    });

    const results = await Promise.all(
      chunks.map((chunk, idx) => worker(conn, chunk, idx + 1))
    );

    const totalSuccess = results.reduce((sum, r) => sum + r.success, 0);
    const totalFail = results.reduce((sum, r) => sum + r.fail, 0);

    console.log("---- 완료 ----");
    console.log(`성공: ${totalSuccess}`);
    console.log(`실패: ${totalFail}`);
    console.log(`실패 로그: ${FAIL_LOG_PATH}`);
  } finally {
    await conn.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});