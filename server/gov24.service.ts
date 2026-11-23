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


export type Gov24RecommendationProfile = {
  region: string;
  district: string;
  birthYear: string;
  employment: string;
  education: string;
  household: string;
  income: string;
  welfare: string;
  special: string[];
  currentSupport: string;
};

type RecommendationInput = {
  page: number;
  perPage: number;
  keyword?: string;
  category: Gov24Category;
  profile: Gov24RecommendationProfile;
};

function scoreGov24Recommendation(
  item: Gov24Service,
  profile: Gov24RecommendationProfile
) {
  const target = String(item.지원대상 ?? "");
  const criteria = String(item.선정기준 ?? "");
  const name = String(item.서비스명 ?? "");
  const summary = String(item.서비스목적요약 ?? "");
  const text = [name, target, criteria, summary].join(" ");

  let score = 0;
  const matched: string[] = [];
  const warnings: string[] = [];

  const addMatch = (label: string, points: number) => {
    if (!matched.includes(label)) {
      matched.push(label);
      score += points;
    }
  };

  const hasPositiveTerm = (
    source: string,
    terms: string[]
  ) =>
    terms.some(term => {
      let index = source.indexOf(term);

      while (index !== -1) {
        const before = source.slice(Math.max(0, index - 15), index);
        const after = source.slice(index + term.length, index + term.length + 25);

        const excluded =
          /(?:제외대상|지원불가|지원 제외)\s*[:：]?\s*$/.test(before) ||
          /^\s*(?:는|은|의 경우)?\s*(?:지원\s*)?(?:대상에서\s*)?(?:제외|불가|미지원|해당하지 않음)/.test(after);

        if (!excluded) return true;
        index = source.indexOf(term, index + term.length);
      }

      return false;
    });

  const regionAliases: Record<string, string[]> = {
    서울: ["서울", "서울특별시"],
    경기: ["경기", "경기도"],
    인천: ["인천", "인천광역시"],
    부산: ["부산", "부산광역시"],
    대구: ["대구", "대구광역시"],
    대전: ["대전", "대전광역시"],
    광주: ["광주", "광주광역시"],
    울산: ["울산", "울산광역시"],
    세종: ["세종", "세종특별자치시"],
    강원: ["강원", "강원특별자치도"],
    충북: ["충북", "충청북도"],
    충남: ["충남", "충청남도"],
    전북: ["전북", "전북특별자치도"],
    전남: ["전남", "전라남도"],
    경북: ["경북", "경상북도"],
    경남: ["경남", "경상남도"],
    제주: ["제주", "제주특별자치도"],
  };

  const aliases = regionAliases[profile.region] ?? [];

  if (
    aliases.some(alias => target.includes(alias)) ||
    (profile.district && target.includes(profile.district))
  ) {
    addMatch("거주지역 관련 문구 확인", 20);
  }

  if (/거주자|주민등록|주소를 둔|거주하는 자/.test(target) &&
      !aliases.some(alias => target.includes(alias)) &&
      !(profile.district && target.includes(profile.district))) {
    warnings.push("거주지역 제한 확인 필요");
  }

  const year = Number(profile.birthYear);
  const currentYear = new Date().getFullYear();

  if (year >= 1900 && year <= currentYear) {
    const age = currentYear - year;
    const ranges = Array.from(
      target.matchAll(
        /(?:만\s*)?(\d{1,2})\s*세\s*(?:이상\s*)?(?:부터\s*)?(?:~|∼|～|부터|이상\s*~)\s*(?:만\s*)?(\d{1,2})\s*세/g
      )
    );

    if (ranges.length === 1) {
      const min = Number(ranges[0][1]);
      const max = Number(ranges[0][2]);

      if (min <= max && max <= 100) {
        if (age >= min && age <= max) {
          addMatch("연령 범위에 해당할 가능성", 25);
        } else {
          warnings.push(`연령 기준 ${min}~${max}세 확인 필요`);
        }
      }
    }
  }

  const employmentTerms: Record<string, string[]> = {
    "구직 중·실업": ["구직자", "실업자", "미취업자"],
    "재직 중": ["재직자", "근로자", "재직 중"],
    프리랜서: ["프리랜서", "특수형태근로"],
    자영업: ["자영업자", "소상공인", "개인사업자"],
    "학생·취업준비": ["취업준비생", "재학생"],
    "경력단절·재취업": ["경력단절", "재취업"],
  };

  if (hasPositiveTerm(target, employmentTerms[profile.employment] ?? [])) {
    addMatch("경제활동 상태 관련 조건 확인", 20);
  }


  // 학력 관련성 분석
  // 학력에 대한 명시적 긍정 조건만 추천 점수에 반영
  const educationTerms: Record<string, string[]> = {
    "고졸 이하": [
      "고등학교 졸업",
      "고졸",
      "고졸 이하",
    ],
    "전문대 졸업": [
      "전문대학 졸업",
      "전문대 졸업",
      "전문학사",
    ],
    "대학교 졸업": [
      "대학교 졸업",
      "대학 졸업",
      "학사학위",
    ],
    "대학원 졸업": [
      "대학원 졸업",
      "석사학위",
      "박사학위",
    ],
    "대학교 재학·휴학·중퇴": [
      "대학생",
      "대학 재학생",
      "휴학생",
      "대학 중퇴",
    ],
  };

  const educationKeywords =
    educationTerms[profile.education] ?? [];

  if (hasPositiveTerm(target, educationKeywords)) {
    addMatch("학력 관련 지원대상 문구 확인", 15);
  }

  // 학력 제한이 있는 사업은 별도 검토 안내
  if (
    /학력|졸업|재학|휴학|학위/.test(
      `${target} ${criteria}`
    )
  ) {
    warnings.push(
      "최종학력·졸업 및 재학 여부를 공식 기준에서 확인해야 합니다."
    );
  }


  const welfareTerms: Record<string, string[]> = {
    기초생활수급자: ["기초생활수급자", "기초생활보장 수급자"],
    차상위계층: ["차상위", "차상위계층"],
    "한부모가족 지원대상": ["한부모가족", "한부모 가정"],
  };

  if (hasPositiveTerm(text, welfareTerms[profile.welfare] ?? [])) {
    addMatch("복지대상 관련 문구 확인", 25);
  }

  const specialTerms: Record<string, string[]> = {
    장애인: ["장애인", "등록장애인"],
    국가보훈대상: ["국가유공자", "보훈대상자", "보훈가족"],
    장기실업: ["장기실업", "장기 실업"],
    경력단절: ["경력단절"],
    다자녀: ["다자녀"],
    무주택: ["무주택"],
  };

  for (const selected of profile.special) {
    if (hasPositiveTerm(text, specialTerms[selected] ?? [])) {
      addMatch(`${selected} 관련 문구 확인`, 15);
    }
  }

  
  // 가구원 수 및 소득 관련 조건 분석
  // 실제 자격 확정이나 자동 탈락 판정은 하지 않음
  const householdText = String(
    profile.household ?? ""
  ).trim();

  const incomeText = String(
    profile.income ?? ""
  ).trim();

  const financialText = [
    target,
    criteria,
    String(item.지원내용 ?? ""),
  ].join(" ");

  // 가구원 수 관련 조건
  const hasHouseholdCondition =
    /가구원|가구소득|가구 규모|가구 구성|가구별|가구당|1인 가구|2인 가구|3인 가구|4인 가구/.test(
      financialText
    );

  if (hasHouseholdCondition) {
    warnings.push(
      `가구원 수(${householdText || "미입력"})에 따른 적용 기준 확인 필요`
    );
  }

  // 소득 관련 조건
  const hasIncomeCondition =
    /중위소득|소득인정액|가구소득|월평균 소득|월 소득|연소득|연간 소득|건강보험료|소득기준|소득 수준/.test(
      financialText
    );

  if (hasIncomeCondition) {
    warnings.push(
      `입력 가구소득(${incomeText || "미입력"})과 공식 소득 산정기준 비교 필요`
    );
  }

  // 재산은 소득과 별도로 판단
  if (
    /재산기준|재산가액|재산세|금융재산|자동차 가액|부동산/.test(
      financialText
    )
  ) {
    warnings.push(
      "재산·금융자산·자동차 등 별도 심사 기준 확인 필요"
    );
  }

  // 중위소득 기준은 해당 연도 및 가구원 수에 따라 달라짐
  if (/기준\s*중위소득|중위소득/.test(financialText)) {
    warnings.push(
      "기준 중위소득은 해당 사업의 적용 연도와 가구원 수를 기준으로 확인해야 합니다."
    );
  }


  if (
    profile.currentSupport !== "현재 지원받는 제도 없음" &&
    profile.currentSupport !== "잘 모르겠어요" &&
    /중복|동시지원|중복수혜/.test(text)
  ) {
    warnings.push("기존 지원제도와 중복 가능 여부 확인 필요");
  }

  if (!target.trim() && !criteria.trim()) {
    warnings.push("공식 지원대상·선정기준 정보 부족");
  }

  return {
    status: score >= 20 ? "related" as const : "review" as const,
    score,
    matched,
    warnings,
  };
}


export type Gov24ApplicationPeriod = {
  status: "within_period" | "upcoming" | "ended" | "ongoing" | "unknown";
  label: string;
  description: string;
  originalText: string;
  startDate: string | null;
  endDate: string | null;
};

export function analyzeGov24ApplicationPeriod(
  item: Gov24Service,
  today = new Date()
): Gov24ApplicationPeriod {
  const originalText = String(item.신청기한 ?? "").trim();

  const unknown = (
    description = "공식 신청기간을 확인해야 합니다."
  ): Gov24ApplicationPeriod => ({
    status: "unknown",
    label: "신청기간 확인 필요",
    description,
    originalText,
    startDate: null,
    endDate: null,
  });

  if (!originalText) return unknown();

  const text = originalText
    .replace(/\s+/g, " ")
    .replace(/[～∼]/g, "~")
    .trim();

  // 기관별 별도 공고, 예산 소진 등은 확정적인 접수 상태를 표시하지 않음
  if (
    /별도\s*공고|기관별|지자체별|예산\s*소진|조기\s*마감|선착순|사업별\s*상이|문의\s*필요/.test(
      text
    )
  ) {
    return unknown(
      "기관별 공고 또는 예산 상황에 따라 신청기간이 달라질 수 있습니다."
    );
  }

  // 상시 신청은 공식 문구에 명시된 경우만 인식
  if (
    /상시\s*(?:신청|접수|모집)|연중\s*(?:상시|신청|접수)|수시\s*접수/.test(
      text
    )
  ) {
    return {
      status: "ongoing",
      label: "상시 신청 안내",
      description:
        "공식 자료에 상시 신청으로 기재되어 있습니다. 실제 접수 여부는 담당기관에서 확인해야 합니다.",
      originalText,
      startDate: null,
      endDate: null,
    };
  }

  const datePattern =
    /(\d{4})\s*[년./-]\s*(\d{1,2})\s*[월./-]\s*(\d{1,2})\s*일?/g;

  const matches = Array.from(text.matchAll(datePattern));

  const parseDate = (match: RegExpMatchArray): string | null => {
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (
      year < 2000 ||
      year > 2100 ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return null;
    }

    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      return null;
    }

    return [
      String(year).padStart(4, "0"),
      String(month).padStart(2, "0"),
      String(day).padStart(2, "0"),
    ].join("-");
  };

  // 여러 날짜가 있으면 추가 모집이나 예외 기간일 수 있으므로 자동 판단하지 않음
  if (matches.length !== 2) {
    return unknown(
      "신청기간이 명확한 시작일·종료일 형식이 아니므로 공식 공고를 확인해야 합니다."
    );
  }

  const startDate = parseDate(matches[0]);
  const endDate = parseDate(matches[1]);

  if (!startDate || !endDate || startDate > endDate) {
    return unknown("신청기간 날짜 형식을 확인해야 합니다.");
  }

  // 두 날짜 사이가 신청기간을 나타내는 경우만 판정
  const between = text.slice(
    (matches[0].index ?? 0) + matches[0][0].length,
    matches[1].index ?? 0
  );

  if (!/^\s*(?:~|부터|[-–—])\s*$/.test(between)) {
    return unknown(
      "여러 날짜가 기재되어 있으나 신청기간 범위인지 확인되지 않았습니다."
    );
  }

  // 신청기한 외에 여러 종류의 기간이 섞인 경우 오판 방지
  
  const before = text.slice(0, matches[0].index ?? 0);
  const after = text.slice(
    (matches[1].index ?? 0) + matches[1][0].length
  );

  // 신청기간 외 다른 기간일 가능성 차단
  if (
    /사업기간|지원기간|교육기간|운영기간|지급기간|선정기간|공고기간/.test(
      before
    )
  ) {
    return unknown(
      "사업 운영기간과 실제 신청기간이 다를 수 있습니다."
    );
  }

  // 신청기간 변경·연장·추가 모집 가능성이 명시된 경우
  if (
    /변경|연장|추가\s*모집|추후\s*공고|별도\s*안내|상황에\s*따라|변동/.test(
      `${before} ${after}`
    )
  ) {
    return unknown(
      "신청기간 변경 또는 추가 모집 가능성이 있어 공식 공고 확인이 필요합니다."
    );
  }

  // 시작일과 종료일 외의 설명이 복잡하면 자동 판정 보류
  const remainingText = `${before} ${after}`
    .replace(/신청기간|접수기간|모집기간|신청기한|접수기한/g, "")
    .replace(/[:：()[\]\s.,]/g, "")
    .trim();

  if (remainingText.length > 0) {
    return unknown(
      "신청기간에 추가 조건이 포함되어 있어 공식 공고 확인이 필요합니다."
    );
  }


  // 한국시간 기준 오늘 날짜
  
const dateParts = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).formatToParts(today);

const getDatePart = (type: "year" | "month" | "day") =>
  dateParts.find(part => part.type === type)?.value ?? "";

const todayKst = [
  getDatePart("year"),
  getDatePart("month"),
  getDatePart("day"),
].join("-");


  let status: Gov24ApplicationPeriod["status"];
  let label: string;
  let description: string;

  if (todayKst < startDate) {
    status = "upcoming";
    label = "접수 시작 전";
    description = `${startDate}부터 신청기간으로 안내되어 있습니다.`;
  } else if (todayKst > endDate) {
    status = "ended";
    label = "안내된 접수기간 종료";
    description = `${endDate}에 안내된 신청기간이 종료되었습니다. 추가 모집 여부는 별도 확인해야 합니다.`;
  } else {
    status = "within_period";
    label = "접수기간 내";
    description =
      "공식 자료에 기재된 신청기간 내에 해당합니다. 실제 접수 가능 여부는 공식 신청처에서 확인해야 합니다.";
  }

  return {
    status,
    label,
    description,
    originalText,
    startDate,
    endDate,
  };
}



export async function recommendGov24Services(
  input: RecommendationInput
) {
  const all = await loadAllServices();
  const keyword = input.keyword?.trim().toLowerCase() ?? "";

  const regionGroups: Record<string, string[]> = {
    서울: ["서울", "서울특별시"],
    경기: ["경기", "경기도"],
    인천: ["인천", "인천광역시"],
    부산: ["부산", "부산광역시"],
    대구: ["대구", "대구광역시"],
    대전: ["대전", "대전광역시"],
    광주: ["광주", "광주광역시"],
    울산: ["울산", "울산광역시"],
    세종: ["세종", "세종특별자치시"],
    강원: ["강원", "강원특별자치도"],
    충북: ["충북", "충청북도"],
    충남: ["충남", "충청남도"],
    전북: ["전북", "전북특별자치도"],
    전남: ["전남", "전라남도"],
    경북: ["경북", "경상북도"],
    경남: ["경남", "경상남도"],
    제주: ["제주", "제주특별자치도"],
  };

  const userAliases = regionGroups[input.profile.region] ?? [];
  const allRegionEntries = Object.entries(regionGroups);

  const candidates = all
    .filter(item => {
      const searchable = [
        allText(item),
        String(item.소관기관명 ?? "").toLowerCase(),
      ].join(" ");

      if (keyword && !searchable.includes(keyword)) {
        return false;
      }

      if (
        input.category !== "전체" &&
        !classifyGov24Service(item).includes(input.category)
      ) {
        return false;
      }

      return true;
    })
    .map(item => {
      const match = scoreGov24Recommendation(
        item,
        input.profile
      );
      const applicationPeriod =
        analyzeGov24ApplicationPeriod(item);

      const target = String(item.지원대상 ?? "");
      const criteria = String(item.선정기준 ?? "");
      const eligibility = `${target} ${criteria}`;
      const district = input.profile.district.trim();

      const sameDistrict =
        Boolean(district) && eligibility.includes(district);

      const sameRegion = userAliases.some(
        alias => eligibility.includes(alias)
      );

      // 지역 제한이 명확하게 기재된 경우에만
      // 다른 지역 거주자 대상 사업을 제외
      const hasResidenceRule =
        /거주자|거주민|주민등록|주소를 둔|거주하는/.test(
          eligibility
        );

      const otherRegionMentioned =
        allRegionEntries.some(([region, aliases]) =>
          region !== input.profile.region &&
          aliases.some(alias => eligibility.includes(alias))
        );

      const nationwide =
        /전국|전 국민|전국민|지역 제한 없음|거주지 무관/.test(
          eligibility
        );

      const regionMismatch =
        hasResidenceRule &&
        otherRegionMentioned &&
        !sameRegion &&
        !sameDistrict &&
        !nationwide;

      const regionPriority = sameDistrict
        ? 3
        : sameRegion
          ? 2
          : nationwide
            ? 1
            : 0;

      const periodPriority =
        applicationPeriod.status === "within_period" ||
        applicationPeriod.status === "ongoing"
          ? 2
          : applicationPeriod.status === "upcoming"
            ? 1
            : 0;

      return {
        item,
        match,
        applicationPeriod,
        regionMismatch,
        regionPriority,
        periodPriority,
      };
    })
    .filter(result => {
      if (result.regionMismatch) return false;

      if (result.applicationPeriod.status === "ended") {
        return false;
      }

      // 관련성 근거가 적은 사업은 추천에서 제외
      if (result.match.score < 35) return false;
      if (result.match.matched.length < 2) return false;

      return true;
    })
    .sort((a, b) =>
      b.regionPriority - a.regionPriority ||
      b.match.score - a.match.score ||
      b.periodPriority - a.periodPriority ||
      String(a.item.서비스명 ?? "").localeCompare(
        String(b.item.서비스명 ?? ""),
        "ko"
      )
    );

  const selected = candidates.slice(0, 10);

  return {
    page: 1,
    perPage: 10,
    totalCount: all.length,
    matchCount: selected.length,
    data: selected.map(({
      item,
      match,
      applicationPeriod,
    }) => ({
      item,
      match,
      applicationPeriod,
    })),
    notice:
      "공개 지원조건과 입력정보의 관련성이 높은 사업을 최대 10건 안내합니다. 실제 수급 자격 및 접수 가능 여부는 공식 기관 확인이 필요합니다.",
  };
}


