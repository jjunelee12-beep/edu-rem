/** 고용24 채용정보 API 전용 서버 모듈. npm i fast-xml-parser */
import { XMLParser } from "fast-xml-parser";

const LIST_URL = "https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210L01.do";
const DETAIL_URL = "https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo210D01.do";
const REGION_CODE_URL =
  "https://www.work24.go.kr/cm/openApi/call/wk/callOpenApiSvcInfo21L01.do";
const parser = new XMLParser({ ignoreAttributes: false, trimValues: true });

function apiKey(): string {
  const key = process.env.WORK24_API_KEY?.trim();
  if (!key) throw new Error("WORK24_API_KEY 환경변수가 설정되지 않았습니다.");
  return key;
}

async function requestXml(base: string, params: Record<string, string>): Promise<any> {
  const url = new URL(base);
  url.searchParams.set("authKey", apiKey());
  url.searchParams.set("returnType", "XML");
  Object.entries(params).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/xml, text/xml" } });
    if (!response.ok) throw new Error(`고용24 HTTP 오류 (${response.status})`);
    const body = await response.text();
    if (!body.trim().startsWith("<")) throw new Error("고용24가 XML이 아닌 응답을 반환했습니다.");
    const parsed = parser.parse(body);

// API 인증키와 개인정보는 출력하지 않고 응답 구조만 기록
const endpoint = new URL(base).pathname.split("/").pop();

console.info("[Work24 API]", {
  endpoint,
  httpStatus: response.status,
  rootKeys: Object.keys(parsed || {}),
  wantedRootKeys: parsed?.wantedRoot
    ? Object.keys(parsed.wantedRoot)
    : [],
  regionRootKeys: parsed?.cmcdRegion
    ? Object.keys(parsed.cmcdRegion)
    : [],
});

if (parsed?.error || parsed?.Error) {
  throw new Error("고용24 API 오류 응답");
}

return parsed;
  } finally { clearTimeout(timer); }
}

export type Work24Job = {
  id: string;
  company: string;
  title: string;
  address: string;
  salary: string;
  employmentType: string;
  registeredAt: string;
  closesAt: string;
  detailUrl: string;
  occupationCode: string;
};

function str(v: unknown): string { return v == null ? "" : String(v).trim(); }
function normalizeJob(item: any): Work24Job {
  const id = str(item.wantedAuthNo);
  const officialUrl = `https://m.work24.go.kr/wk/a/b/1500/empDetailAuthView.do?wantedAuthNo=${encodeURIComponent(id)}&infoTypeCd=VALIDATION&infoTypeGroup=tb_workinfoworknet`;
  return {
    id,
    company: str(item.company),
    title: str(item.title),
    address: str(item.basicAddr || item.strtnmCd || item.region),
    salary: str(item.sal),
    employmentType: str(item.empTpNm || item.empTpCd),
    registeredAt: str(item.regDt),
    closesAt: str(item.closeDt),
    detailUrl: officialUrl,
    occupationCode: str(item.jobsCd),
  };
}

/** 직종코드/지역코드는 고용24 공식 코드표 확인 후 전달 */
export async function getWork24Jobs(options: { page?: number; size?: number; occupation?: string; region?: string } = {}) {
  const page = Math.min(1000, Math.max(1, Math.trunc(options.page ?? 1)));
  const size = Math.min(100, Math.max(1, Math.trunc(options.size ?? 20)));
  const xml = await requestXml(LIST_URL, {
    callTp: "L", startPage: String(page), display: String(size),
    occupation: options.occupation || "",
region: options.region || "",
certLic: "6005946",
  });
console.log(
  "[Work24 Regions] GO24 응답 확인:",
  JSON.stringify(xml?.GO24 ?? {}).slice(0, 3000)
);
  const root = xml?.wantedRoot;
  if (!root) throw new Error("고용24 응답 형식이 예상과 다릅니다. 원본 XML 구조를 확인하세요.");
  const items = root.wanted == null ? [] : Array.isArray(root.wanted) ? root.wanted : [root.wanted];
  return {
    page, size,
    total: Number(root.total || 0),
    jobs: items.map(normalizeJob).filter((job: Work24Job) => job.id),
    source: "고용24",
  };
}

export async function getWork24JobDetail(wantedAuthNo: string) {
  if (!/^[A-Za-z0-9-]{5,50}$/.test(wantedAuthNo)) throw new Error("올바르지 않은 구인인증번호입니다.");
  return requestXml(DETAIL_URL, { callTp: "D", wantedAuthNo, infoSvc: "VALIDATION" });
}

export type Work24Region = {
  code: string;
  name: string;
  children: {
    code: string;
    name: string;
  }[];
};

let regionCache: {
  expiresAt: number;
  data: Work24Region[];
} | null = null;

export async function getWork24Regions(): Promise<Work24Region[]> {
  if (regionCache && regionCache.expiresAt > Date.now()) {
    return regionCache.data;
  }

  const xml = await requestXml(REGION_CODE_URL, {
    target: "CMCD",
    dtlGb: "1",
  });

  const root = xml?.cmcdRegion;

  if (!root) {
  console.error("[Work24 Regions] 예상한 cmcdRegion 루트가 없습니다.", {
    rootKeys: Object.keys(xml || {}),
  });

  throw new Error(
    "고용24 지역코드 응답 구조가 예상과 다릅니다."
  );
}

  const asArray = (value: any): any[] =>
    value == null ? [] : Array.isArray(value) ? value : [value];

  const regions: Work24Region[] = asArray(root.oneDepth)
    .map((item) => ({
      code: str(item.regionCd),
      name: str(item.regionNm),
      children: asArray(item.twoDepth)
        .map((child) => ({
          code: str(child.regionCd),
          name: str(child.regionNm),
        }))
        .filter((child) => child.code && child.name),
    }))
    .filter((region) => region.code && region.name);

  if (regions.length === 0) {
    throw new Error("고용24 지역코드 목록이 비어 있습니다.");
  }

  regionCache = {
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    data: regions,
  };

  return regions;
}
