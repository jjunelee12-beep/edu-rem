/** 정부24 공공서비스 API - 서버 전용. Railway GOV24_API_KEY 사용 */
const BASE_URL = "https://api.odcloud.kr/api/gov24/v3";
const CACHE_TTL_MS = 30 * 60 * 1000;
const PAGE_SIZE = 1000;
const MAX_PAGES = 30;

export type Gov24Service = {
  서비스ID: string;
  서비스명: string;
  서비스목적요약?: string | null;
  서비스분야?: string | null;
  지원유형?: string | null;
  지원대상?: string | null;
  선정기준?: string | null;
  지원내용?: string | null;
  신청방법?: string | null;
  신청기한?: string | null;
  상세조회URL?: string | null;
  소관기관명?: string | null;
  수정일시?: string | null;
  [key: string]: unknown;
};
export type Gov24ListResponse = {
  page: number; perPage: number; totalCount: number;
  currentCount: number; matchCount: number; data: Gov24Service[];
};
export const GOV24_CATEGORIES = [
  "전체", "취업·구직", "교육·훈련", "청년", "중장년·노인",
  "생활·복지", "주거", "창업", "기타",
] as const;
export type Gov24Category = typeof GOV24_CATEGORIES[number];
export const GOV24_EDUCATION_SUBCATEGORIES = [
  "전체", "학점은행제 관련 혜택", "평생교육이용권", "국민내일배움카드",
  "국가유공자 교육지원", "취업·재취업 교육", "기타 교육지원",
] as const;
export type Gov24EducationSubcategory = typeof GOV24_EDUCATION_SUBCATEGORIES[number];

async function requestGov24(path: string, params: URLSearchParams): Promise<unknown> {
  const key = process.env.GOV24_API_KEY?.trim();
  if (!key) throw new Error("GOV24_API_KEY 환경변수가 설정되지 않았습니다.");
  params.set("serviceKey", key);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(`${BASE_URL}/${path}?${params.toString()}`, {
      headers: { Accept: "application/json" }, signal: controller.signal,
    });
    if (!response.ok) throw new Error(`정부24 API 응답 오류 (${response.status})`);
    return await response.json();
  } finally { clearTimeout(timeout); }
}
function parseResponse(value: unknown): Gov24ListResponse {
  if (!value || typeof value !== "object" || !Array.isArray((value as any).data)) {
    throw new Error("정부24 API 응답 형식이 올바르지 않습니다.");
  }
  return value as Gov24ListResponse;
}
function listParams(page: number, perPage: number): URLSearchParams {
  return new URLSearchParams({ page: String(page), perPage: String(perPage), returnType: "JSON" });
}

/** 기존 gov24.list 호출 형식을 유지 */
export async function listGov24Services(input: { page: number; perPage: number; keyword?: string }): Promise<Gov24ListResponse> {
  const params = listParams(input.page, input.perPage);
  if (input.keyword?.trim()) params.set("cond[서비스명::LIKE]", input.keyword.trim());
  return parseResponse(await requestGov24("serviceList", params));
}

let cached: { data: Gov24Service[]; expiresAt: number } | null = null;
let loading: Promise<Gov24Service[]> | null = null;

async function loadAllServices(): Promise<Gov24Service[]> {
  if (cached && Date.now() < cached.expiresAt) return cached.data;
  if (loading) return loading;
  loading = (async () => {
    try {
      const first = parseResponse(await requestGov24("serviceList", listParams(1, PAGE_SIZE)));
      const total = Number(first.totalCount ?? first.matchCount ?? first.data.length);
      const pages = Math.ceil(total / PAGE_SIZE);
      if (!Number.isFinite(total) || pages > MAX_PAGES) {
        throw new Error("정부24 전체 목록이 허용된 수집 범위를 초과했습니다.");
      }
      const rows = [...first.data];
      // 3개씩 병렬 조회: 정부24 초당 호출 제한을 고려해 과도한 동시 요청 방지
      for (let start = 2; start <= pages; start += 3) {
        const end = Math.min(start + 2, pages);
        const batch = await Promise.all(Array.from({ length: end - start + 1 }, (_, i) =>
          requestGov24("serviceList", listParams(start + i, PAGE_SIZE)).then(parseResponse)
        ));
        for (const result of batch) rows.push(...result.data);
      }
      const unique = new Map<string, Gov24Service>();
      for (const row of rows) {
        const id = String(row.서비스ID ?? "").trim();
        if (id) unique.set(id, row);
      }
      const data = Array.from(unique.values());
      cached = { data, expiresAt: Date.now() + CACHE_TTL_MS };
      return data;
    } catch (error) {
      // 갱신 실패 시 기존 정상 데이터로 서비스 지속
      if (cached) return cached.data;
      throw error;
    } finally { loading = null; }
  })();
  return loading;
}

const includesAny = (text: string, terms: readonly string[]) => terms.some(t => text.includes(t));
function allText(row: Gov24Service): string {
  return [row.서비스명, row.서비스목적요약, row.서비스분야, row.지원대상, row.지원내용, row.지원유형]
    .map(v => String(v ?? "")).join(" ").toLowerCase();
}

/** 자체 검색 편의 분류. 정부의 공식 분류 또는 수급자격 판정이 아님 */
export function classifyGov24Service(row: Gov24Service): Gov24Category[] {
  const t = allText(row);
  const result: Gov24Category[] = [];
  if (includesAny(t, ["구직", "취업", "고용", "실업", "일자리", "재취업", "직업훈련", "직업교육"])) result.push("취업·구직");
  if (includesAny(t, ["교육", "훈련", "학습", "평생", "학점은행", "장학", "수강", "내일배움"])) result.push("교육·훈련");
  if (includesAny(t, ["청년", "청소년", "대학생", "사회초년생"])) result.push("청년");
  if (includesAny(t, ["중장년", "중년", "노인", "어르신", "고령", "시니어", "장년"])) result.push("중장년·노인");
  if (includesAny(t, ["복지", "생계", "생활", "돌봄", "기초생활", "의료", "장애", "양육", "긴급지원"])) result.push("생활·복지");
  if (includesAny(t, ["주거", "주택", "월세", "전세", "임대", "주거급여"])) result.push("주거");
  if (includesAny(t, ["창업", "소상공인", "사업화", "예비창업", "자영업"])) result.push("창업");
  return result.length ? result : ["기타"];
}
export function classifyGov24Education(row: Gov24Service): Gov24EducationSubcategory[] {
  const t = allText(row);
  const result: Gov24EducationSubcategory[] = [];
  if (includesAny(t, ["학점은행", "학위취득", "학위 취득"])) result.push("학점은행제 관련 혜택");
  if (includesAny(t, ["평생교육이용권", "평생교육바우처", "평생교육 이용권"])) result.push("평생교육이용권");
  if (includesAny(t, ["국민내일배움카드", "내일배움카드"])) result.push("국민내일배움카드");
  if (includesAny(t, ["국가유공자", "보훈대상", "보훈가족"]) && includesAny(t, ["교육", "훈련", "장학"])) result.push("국가유공자 교육지원");
  if (includesAny(t, ["재취업", "직업훈련", "직업교육", "취업교육", "취업 교육", "구직자 교육"])) result.push("취업·재취업 교육");
  if (!result.length && classifyGov24Service(row).includes("교육·훈련")) result.push("기타 교육지원");
  return result;
}

export async function searchGov24Services(input: {
  page: number; perPage: number; keyword?: string;
  category?: Gov24Category; educationSubcategory?: Gov24EducationSubcategory;
}) {
  const all = await loadAllServices();
  const keyword = input.keyword?.trim().toLowerCase() ?? "";
  const category = input.category ?? "전체";
  const subcategory = input.educationSubcategory ?? "전체";
  const filtered = all.filter(row => {
    if (keyword && !allText(row).includes(keyword) && !String(row.소관기관명 ?? "").toLowerCase().includes(keyword)) return false;
    if (category !== "전체" && !classifyGov24Service(row).includes(category)) return false;
    if (subcategory !== "전체" && !classifyGov24Education(row).includes(subcategory)) return false;
    return true;
  });
  const start = (input.page - 1) * input.perPage;
  return {
    page: input.page, perPage: input.perPage, totalCount: all.length,
    matchCount: filtered.length, currentCount: filtered.slice(start, start + input.perPage).length,
    data: filtered.slice(start, start + input.perPage).map(row => ({
      ...row,
      categories: classifyGov24Service(row),
      educationSubcategories: classifyGov24Education(row),
    })),
    cacheUpdatedAt: cached ? new Date(cached.expiresAt - CACHE_TTL_MS).toISOString() : null,
    classificationNotice: "카테고리는 자체 키워드 분류이며 실제 지원 자격은 공고 원문을 확인해야 합니다.",
  };
}

export async function getGov24ServiceById(serviceId: string): Promise<Gov24Service | null> {
  const params = listParams(1, 1);
  params.set("cond[서비스ID::EQ]", serviceId);
  const detail = parseResponse(await requestGov24("serviceDetail", params));
  const found = detail.data.find(row => String(row.서비스ID) === serviceId);
  if (found) return found;
  // 상세 API 결과가 없는 경우 캐시된 목록에서만 정확한 ID로 보완
  const all = await loadAllServices();
  return all.find(row => String(row.서비스ID) === serviceId) ?? null;
}
export async function getGov24SupportConditions(serviceId: string) {
  const params = listParams(1, 30);
  params.set("cond[서비스ID::EQ]", serviceId);
  const response = parseResponse(await requestGov24("supportConditions", params));
  return response.data.filter(row => String(row.서비스ID) === serviceId);
}
