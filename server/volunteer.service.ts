import { XMLParser } from "fast-xml-parser";
import { TRPCError } from "@trpc/server";

export type VolunteerSearchParams = {
  activeOnly?: boolean;
  pageNo?: number;
  numOfRows?: number;
  keyword?: string;
  schCateGu?: string;
  schSido?: string;
  schSign1?: string;
  upperClCode?: string;
  nanmClCode?: string;
  progrmBgnde?: string;
  progrmEndde?: string;
  adultPosblAt?: string;
  yngbgsPosblAt?: string;
  actBeginTm?: string;
  actEndTm?: string;
  noticeBgnde?: string;
  noticeEndde?: string;
  actPlace?: string;
  nanmmbyNm?: string;
};

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
  processEntities: false,
});

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_SIZE = 300;

const cache = new Map<
  string,
  {
    expiresAt: number;
    data: any;
  }
>();

const pendingRequests = new Map<string, Promise<any>>();

function getApiConfig() {
  const apiKey = process.env.VOLUNTEER_API_KEY?.trim();

  const apiUrl = (
    process.env.VOLUNTEER_API_URL ||
    "https://apis.data.go.kr/1741000/volunteerPartcptnService"
  ).replace(/\/+$/, "");

  if (!apiKey) {
    throw new TRPCError({
      code: "INTERNAL_SERVER_ERROR",
      message: "봉사활동 API 인증키가 설정되지 않았습니다.",
    });
  }

  return {
    apiKey,
    apiUrl,
  };
}

function setCache(key: string, data: any) {
  const now = Date.now();

  for (const [cacheKey, value] of cache) {
    if (value.expiresAt <= now) {
      cache.delete(cacheKey);
    }
  }

  if (cache.size >= CACHE_MAX_SIZE) {
    const firstKey = cache.keys().next().value;

    if (firstKey !== undefined) {
      cache.delete(firstKey);
    }
  }

  cache.set(key, {
    expiresAt: now + CACHE_TTL_MS,
    data,
  });
}

async function requestVolunteerApi(
  endpoint: string,
  params: Record<string, string | number | undefined>
) {
  const { apiKey, apiUrl } = getApiConfig();

  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (
      value !== undefined &&
      value !== null &&
      String(value).trim() !== ""
    ) {
      query.set(key, String(value).trim());
    }
  }

  query.sort();

  const cacheKey = `${endpoint}?${query.toString()}`;

  const cached = cache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const pending = pendingRequests.get(cacheKey);

  if (pending) {
    return pending;
  }

  let decodedKey = apiKey;

  try {
    decodedKey = decodeURIComponent(apiKey);
  } catch {
    // 일반 인증키 그대로 사용
  }

  query.set("serviceKey", decodedKey);

  const url = `${apiUrl}/${endpoint}?${query.toString()}`;

  const request = (async () => {
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/xml",
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `봉사활동 API 요청 실패 (${response.status})`,
        });
      }

      const xml = await response.text();

      if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: "허용되지 않는 XML 응답입니다.",
        });
      }

      const parsed = parser.parse(xml);

      const result = parsed?.response ?? parsed;

      const header = result?.header;
      const body = result?.body;

      const resultCode = String(
        header?.resultCode ??
        parsed?.OpenAPI_ServiceResponse?.cmmMsgHeader?.returnReasonCode ??
        ""
      ).trim();

      const successCodes = ["0", "00", "0000"];

      if (!successCodes.includes(resultCode) || !body) {
        console.error(
          "[VOLUNTEER API] response error:",
          resultCode
        );

        throw new TRPCError({
          code: "BAD_GATEWAY",
          message: `봉사활동 정보를 조회하지 못했습니다. (${resultCode || "INVALID_RESPONSE"})`,
        });
      }

      const rawItems = body?.items?.item;

      const items = Array.isArray(rawItems)
        ? rawItems
        : rawItems && typeof rawItems === "object"
          ? [rawItems]
          : [];

      const data = {
        items,
        pageNo: Number(body?.pageNo || 1),
        numOfRows: Number(
          body?.numOfRows || items.length
        ),
        totalCount: Number(body?.totalCount || 0),
      };

      setCache(cacheKey, data);

      return data;
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }

      console.error("[VOLUNTEER API] request failed");

      throw new TRPCError({
        code: "BAD_GATEWAY",
        message: "봉사활동 정보 서버에 연결하지 못했습니다.",
      });
    }
  })();

  pendingRequests.set(cacheKey, request);

  try {
    return await request;
  } finally {
    pendingRequests.delete(cacheKey);
  }
}

// Cache complete filtered results independently of the requested page.
const activeCache = new Map<string, { expiresAt: number; items: any[] }>();
const activePending = new Map<string, Promise<any[]>>();
const ACTIVE_SCAN_LIMIT = 200;

function koreaDate() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date()).replace(/-/g, "");
}

export async function getVolunteerList(params: VolunteerSearchParams = {}) {
  const { activeOnly, pageNo = 1, numOfRows = 20, ...search } = params;
  if (!activeOnly) {
    return requestVolunteerApi("getVltrSearchWordList", { ...search, pageNo, numOfRows });
  }
  const { noticeBgnde, noticeEndde, ...criteria } = search;
  const today = koreaDate();
  const key = JSON.stringify([today, Object.entries(criteria).filter(([,v]) => v !== undefined && v !== "").sort(([a],[b]) => a.localeCompare(b))]);
  let rows = activeCache.get(key);
  if (!rows || rows.expiresAt <= Date.now()) {
    let pending = activePending.get(key);
    if (!pending) {
      if (activePending.size >= 2) {
        throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "모집 공고 검색이 진행 중입니다. 잠시 후 다시 시도해 주세요." });
      }
      pending = (async () => {
        const first = await requestVolunteerApi("getVltrSearchWordList", { ...criteria, pageNo: 1, numOfRows: 100 });
        const size = Number(first.numOfRows);
        const total = Number(first.totalCount);
        if (!Number.isFinite(total) || total < 0 || !Number.isFinite(size) || size < 1) {
          if (total === 0) return [];
          throw new TRPCError({ code: "BAD_GATEWAY", message: "봉사활동 페이지 정보를 확인할 수 없습니다." });
        }
        const pages = Math.ceil(total / size);
        if (pages > ACTIVE_SCAN_LIMIT) throw new TRPCError({ code: "BAD_REQUEST", message: "검색 범위가 너무 넓습니다. 지역 또는 검색어를 선택해 주세요." });
        const found = new Map<string, any>();
        const collect = (items: any[]) => {
          for (const item of items) {
            const start = String(item.noticeBgnde ?? "").trim();
            const end = String(item.noticeEndde ?? "").trim();
            const id = String(item.progrmRegistNo ?? "");
            if (id && String(item.progrmSttusSe).trim() === "2" && /^\d{8}$/.test(start) && /^\d{8}$/.test(end) && start <= today && today <= end) found.set(id, item);
          }
        };
        collect(first.items);
        for (let p = 2; p <= pages; p += 5) {
          const batch = await Promise.all(Array.from({ length: Math.min(5, pages - p + 1) }, (_, i) => requestVolunteerApi("getVltrSearchWordList", { ...criteria, pageNo: p + i, numOfRows: size })));
          for (const result of batch) collect(result.items);
        }
        const items = [...found.values()];
        if (activeCache.size >= 20) activeCache.delete(activeCache.keys().next().value!);
        activeCache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, items });
        return items;
      })().finally(() => activePending.delete(key));
      activePending.set(key, pending);
    }
    rows = { expiresAt: Date.now() + CACHE_TTL_MS, items: await pending };
  }
  return { items: rows.items.slice((pageNo - 1) * numOfRows, pageNo * numOfRows), pageNo, numOfRows, totalCount: rows.items.length };
}

export async function getVolunteerDetail(
  progrmRegistNo: string
) {
  const result = await requestVolunteerApi(
    "getVltrPartcptnItem",
    {
      progrmRegistNo,
      pageNo: 1,
      numOfRows: 1,
    }
  );

  const item = result.items[0];

  if (!item) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "해당 봉사활동 정보를 찾을 수 없습니다.",
    });
  }

  return item;
}