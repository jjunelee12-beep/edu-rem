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

/**
 * 취업정보센터 거리순 검색용 전체 공고 수집.
 *
 * - 고용24 API를 100건씩 페이지별 조회
 * - 동일 인증번호 중복 제거
* - 15분간 서버 메모리 캐시
 * - 최대 2,000건까지 수집
 * - 제한 초과 시 전체 수집 여부 표시
 */

const WORK24_ALL_JOBS_CACHE_MS = 15 * 60 * 1000;
const WORK24_ALL_JOBS_MAX = 2000;
const WORK24_ALL_JOBS_PAGE_SIZE = 100;

type Work24AllJobsResult = {
  total: number;
  jobs: Work24Job[];
  complete: boolean;
  fetchedAt: number;
};

let allJobsCache: Work24AllJobsResult | null = null;
let allJobsCacheExpiresAt = 0;
let allJobsPending: Promise<Work24AllJobsResult> | null = null;

export async function getWork24AllJobs(): Promise<Work24AllJobsResult> {
  if (allJobsCache && Date.now() < allJobsCacheExpiresAt) {
    return allJobsCache;
  }

  if (allJobsPending) {
    return allJobsPending;
  }

  const pending = (async (): Promise<Work24AllJobsResult> => {
    const first = await getWork24Jobs({
      page: 1,
      size: WORK24_ALL_JOBS_PAGE_SIZE,
    });

    const total = first.total;

    const pageCount = Math.min(
      Math.ceil(total / WORK24_ALL_JOBS_PAGE_SIZE),
      Math.ceil(WORK24_ALL_JOBS_MAX / WORK24_ALL_JOBS_PAGE_SIZE)
    );

    const collected: Work24Job[] = [...first.jobs];

    // 고용24 API 요청을 최대 4개씩 병렬 처리
const PAGE_CONCURRENCY = 4;

for (
  let startPage = 2;
  startPage <= pageCount;
  startPage += PAGE_CONCURRENCY
) {
  const endPage = Math.min(
    startPage + PAGE_CONCURRENCY - 1,
    pageCount
  );

  const pages = Array.from(
    { length: endPage - startPage + 1 },
    (_, index) => startPage + index
  );

  const results = await Promise.all(
    pages.map((page) =>
      getWork24Jobs({
        page,
        size: WORK24_ALL_JOBS_PAGE_SIZE,
      })
    )
  );

  for (const result of results) {
    collected.push(...result.jobs);
  }

  console.info("[Work24] 공고 수집 진행", {
    completedPage: endPage,
    totalPages: pageCount,
    collected: collected.length,
  });
}

    const uniqueJobs = Array.from(
      new Map(
        collected.map((job) => [job.id, job])
      ).values()
    );

    const result: Work24AllJobsResult = {
      total,
      jobs: uniqueJobs,
      complete: total <= WORK24_ALL_JOBS_MAX,
      fetchedAt: Date.now(),
    };

    allJobsCache = result;
    allJobsCacheExpiresAt =
      Date.now() + WORK24_ALL_JOBS_CACHE_MS;

    console.info("[Work24 All Jobs]", {
      total,
      collected: uniqueJobs.length,
      complete: result.complete,
    });

    return result;
  })();

  allJobsPending = pending;

  try {
    return await pending;
  } finally {
    if (allJobsPending === pending) {
      allJobsPending = null;
    }
  }
}

type Work24Coordinate = {
  lat: number;
  lng: number;
};

const work24CoordinateCache = new Map<
  string,
  {
    value: Work24Coordinate | null;
    expiresAt: number;
  }
>();

const WORK24_COORDINATE_CACHE_MS =
  24 * 60 * 60 * 1000;

const work24CoordinatePending = new Map<
  string,
  Promise<Work24Coordinate | null>
>();

async function fetchWork24AddressCoordinate(
  address: string
): Promise<Work24Coordinate | null> {
  const query = address.trim().replace(/\s+/g, " ");

  if (!query) return null;

  const cached = work24CoordinateCache.get(query);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const apiKey = process.env.KAKAO_REST_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다."
    );
  }

  const url = new URL(
    "https://dapi.kakao.com/v2/local/search/address.json"
  );

  url.searchParams.set("query", query);

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    10000
  );

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `KakaoAK ${apiKey}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `카카오 주소 검색 API 오류 (${response.status})`
      );
    }

    const data = await response.json();

    const first = data?.documents?.[0];

    const lat = Number(first?.y);
    const lng = Number(first?.x);

    const coordinate =
      first &&
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
        ? { lat, lng }
        : null;

    work24CoordinateCache.set(query, {
      value: coordinate,
      expiresAt:
        Date.now() + WORK24_COORDINATE_CACHE_MS,
    });

    return coordinate;
  } finally {
    clearTimeout(timer);
  }
}

export async function getWork24AddressCoordinate(
  address: string
): Promise<Work24Coordinate | null> {
  const query = address.trim().replace(/\s+/g, " ");

  if (!query) return null;

  const cached = work24CoordinateCache.get(query);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const existing = work24CoordinatePending.get(query);

  if (existing) {
    return existing;
  }

  const pending = fetchWork24AddressCoordinate(query);

  work24CoordinatePending.set(query, pending);

  try {
    return await pending;
  } finally {
    if (work24CoordinatePending.get(query) === pending) {
      work24CoordinatePending.delete(query);
    }
  }
}

function work24DistanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number }
): number {
  const rad = Math.PI / 180;

  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(dLng / 2) ** 2;

  return (
    6371 *
    2 *
    Math.atan2(
      Math.sqrt(h),
      Math.sqrt(Math.max(0, 1 - h))
    )
  );
}

let work24LocationPreparation:
  Promise<void> | null = null;

let work24LocationPreparationError: string | null = null;

// 주소별 일시적인 실패 기록
const work24CoordinateFailures = new Map<
  string,
  {
    attempts: number;
    retryAfter: number;
  }
>();

const WORK24_COORDINATE_RETRY_MS = 60 * 1000;
const WORK24_COORDINATE_MAX_RETRIES = 3;

function prepareWork24Locations(
  addresses: string[]
): Promise<void> {
  if (work24LocationPreparation) {
    return work24LocationPreparation;
  }

  work24LocationPreparationError = null;

  const pending = (async () => {
    const CONCURRENCY = 8;

    let failedCount = 0;
    let successCount = 0;

    for (
      let i = 0;
      i < addresses.length;
      i += CONCURRENCY
    ) {
      const batch = addresses.slice(
        i,
        i + CONCURRENCY
      );

      const results = await Promise.allSettled(
        batch.map((address) =>
          getWork24AddressCoordinate(address)
        )
      );

      results.forEach((result, index) => {
        const address = batch[index];

        if (result.status === "fulfilled") {
          work24CoordinateFailures.delete(address);
          successCount++;
          return;
        }

        failedCount++;

        const previous =
          work24CoordinateFailures.get(address);

        const attempts =
          (previous?.attempts ?? 0) + 1;

        work24CoordinateFailures.set(address, {
          attempts,
          retryAfter:
            Date.now() +
            WORK24_COORDINATE_RETRY_MS,
        });

        console.warn(
          "[Work24] 주소 변환 실패",
          {
            address,
            attempts,
            error:
              result.reason instanceof Error
                ? result.reason.message
                : String(result.reason),
          }
        );
      });
    }

    if (failedCount > 0) {
      work24LocationPreparationError =
        `${failedCount}개 주소의 좌표 변환에 실패했습니다.`;
    }

    console.info(
      "[Work24] 주소 준비 완료",
      {
        successCount,
        failedCount,
      }
    );
  })();

  work24LocationPreparation = pending;

  void pending
    .catch((error) => {
      work24LocationPreparationError =
        error instanceof Error
          ? error.message
          : "주소 좌표 준비에 실패했습니다.";

      console.error(
        "[Work24] 좌표 준비 오류",
        work24LocationPreparationError
      );
    })
    .finally(() => {
      if (work24LocationPreparation === pending) {
        work24LocationPreparation = null;
      }
    });

  return pending;
}

export async function getWork24NearbyJobs(
  referencePoint: { lat: number; lng: number }
) {
  const result = await getWork24AllJobs();

  const uniqueAddresses = [
    ...new Set(
      result.jobs
        .map((job) => job.address.trim())
        .filter(Boolean)
    ),
  ];

  const now = Date.now();

  const unprepared: string[] = [];
  let retryWaitingCount = 0;
  let permanentlyFailedCount = 0;

  for (const address of uniqueAddresses) {
    const cached = work24CoordinateCache.get(address);

    if (cached && cached.expiresAt > now) {
      continue;
    }

    const failure = work24CoordinateFailures.get(address);

    if (
      failure &&
      failure.attempts >= WORK24_COORDINATE_MAX_RETRIES
    ) {
      permanentlyFailedCount++;
      continue;
    }

    if (failure && failure.retryAfter > now) {
      retryWaitingCount++;
      continue;
    }

    unprepared.push(address);
  }

  // 아직 좌표 준비가 필요한 주소가 있으면 백그라운드 처리
  if (unprepared.length > 0) {
    void prepareWork24Locations(unprepared);
  }

  const preparing =
    work24LocationPreparation !== null ||
    unprepared.length > 0 ||
    retryWaitingCount > 0;

  const coordinates = new Map<
    string,
    Work24Coordinate | null
  >(
    uniqueAddresses.map(
      (address): [string, Work24Coordinate | null] => [
        address,
        work24CoordinateCache.get(address)?.value ?? null,
      ]
    )
  );

  const jobs = result.jobs
    .map((job) => {
      const coordinate = coordinates.get(job.address.trim());

      if (!coordinate) return null;

      return {
        ...job,
        latitude: coordinate.lat,
        longitude: coordinate.lng,
        distanceKm: work24DistanceKm(
          referencePoint,
          coordinate
        ),
      };
    })
    .filter(
      (
        job
      ): job is Work24Job & {
        latitude: number;
        longitude: number;
        distanceKm: number;
      } => job !== null
    )
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, 30);

  const locatedCount = result.jobs.filter(
    (job) => coordinates.get(job.address.trim()) != null
  ).length;

  const failedCount =
    permanentlyFailedCount +
    retryWaitingCount;

  const error =
    permanentlyFailedCount > 0
      ? `${permanentlyFailedCount}개 주소의 좌표 변환에 실패했습니다.`
      : work24LocationPreparationError;

  return {
    total: result.total,

    // 모든 공고가 수집되고 모든 주소가 처리됐는지 구분
    complete:
      result.complete &&
      !preparing &&
      permanentlyFailedCount === 0,

    locatedCount,
    preparing,
    error,

    // 상태 확인용
    failedCount,
    retryWaitingCount,
    permanentlyFailedCount,

    // 좌표 변환이 완료된 공고부터 표시
// 준비 중인 공고가 남아 있으면 다음 조회에서 갱신
jobs,
  };
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

console.info("[Work24 Regions] 응답 구조 진단", {
  rootKeys: Object.keys(xml || {}),
  go24Type: typeof xml?.GO24,
  go24Value: xml?.GO24,
  xmlDeclaration: xml?.["?xml"] ? "present" : "absent",
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
