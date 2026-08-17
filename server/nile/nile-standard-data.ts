// server/nile/nile-standard-data.ts

/**
 * 국가평생교육진흥원 학점은행제
 * 표준교육과정 기준 데이터
 *
 * IMPORTANT
 * ----------
 * - 회사별 CRM 운영 마스터가 아니다.
 * - organizationId를 사용하지 않는다.
 * - AI가 임의로 과목 분류를 생성하지 않는다.
 * - 국가평생교육진흥원 공식 표준교육과정을 기준으로 한다.
 * - 과목명은 공식 표기를 보존한다.
 */

export type NileDegreeLevel =
  | "associate"
  | "bachelor";

export type NileRequirementType =
  | "전공필수"
  | "전공선택";

export interface NileStandardSubjectSeed {
  subjectName: string;

  /**
   * 국가평생교육진흥원 공식 과목 ID.
   *
   * 확인된 경우에만 넣는다.
   * 확인되지 않은 과목은 undefined로 둔다.
   */
  officialSubjectId?: string;

  requirementType: NileRequirementType;

  credits: number;

  /**
   * 전공필수 핵심제 적용 대상 전필 여부.
   */
  isCoreRequired?: boolean;

  sortOrder: number;
}

export interface NileStandardCurriculumSeed {
  curriculumKey: string;

  degreeLevel: NileDegreeLevel;

  /**
   * 국평원 공식 학위명.
   */
  degreeName: string;

  /**
   * 국평원 공식 전공명.
   */
  majorName: string;

  requiredTotalCredits: number;

  requiredMajorCredits: number;

  requiredLiberalCredits: number;

  hasCoreRequirement: boolean;

  /**
   * 핵심제 적용 시 최소 이수 과목 수.
   */
  requiredCoreSubjectCount?: number;

  standardVersion: string;

  sourceUrl: string;

  subjects: NileStandardSubjectSeed[];
}


/**
 * 과목명 비교용 정규화.
 *
 * 주의:
 * 이 함수는 동등과목 판정을 하지 않는다.
 * 단순 표기 차이 제거용이다.
 */
export function normalizeNileSubjectName(
  value: string
): string {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .trim();
}


/**
 * 공통 helper
 */
function makeRequiredSubject(
  params: {
    subjectName: string;
    officialSubjectId?: string;
    sortOrder: number;
  }
): NileStandardSubjectSeed {
  return {
    subjectName:
      params.subjectName,

    officialSubjectId:
      params.officialSubjectId,

    requirementType:
      "전공필수",

    credits:
      3,

    sortOrder:
      params.sortOrder,
  };
}


function makeElectiveSubject(
  params: {
    subjectName: string;
    officialSubjectId?: string;
    sortOrder: number;
  }
): NileStandardSubjectSeed {
  return {
    subjectName:
      params.subjectName,

    officialSubjectId:
      params.officialSubjectId,

    requirementType:
      "전공선택",

    credits:
      3,

    sortOrder:
      params.sortOrder,
  };
}


/**
 * 사회복지 학사
 *
 * 행정학사 / 사회복지학 전공
 *
 * 전공필수 10과목
 * 전공선택 43과목
 */
const bachelorSocialWelfare:
  NileStandardCurriculumSeed = {
  curriculumKey:
    "bachelor_social_welfare",

  degreeLevel:
    "bachelor",

  degreeName:
    "행정학사",

  majorName:
    "사회복지학 전공",

  requiredTotalCredits:
    140,

  requiredMajorCredits:
    60,

  requiredLiberalCredits:
    30,

  hasCoreRequirement:
    false,

  standardVersion:
    "current",

  sourceUrl:
    "https://www.cb.or.kr/creditbank/stdPro/stdPro1_1_1.do?m_szMajorId=AGAE",

  subjects: [
    // ─────────────────────────────
    // 전공필수 10과목
    // ─────────────────────────────

    makeRequiredSubject({
      subjectName:
        "사회복지법제와실천",
      officialSubjectId:
        "19981302",
      sortOrder:
        1,
    }),

    makeRequiredSubject({
      subjectName:
        "사회복지실천기술론",
      officialSubjectId:
        "19990108",
      sortOrder:
        2,
    }),

    makeRequiredSubject({
      subjectName:
        "사회복지실천론",
      officialSubjectId:
        "19990445",
      sortOrder:
        3,
    }),

    makeRequiredSubject({
      subjectName:
        "사회복지정책론",
      officialSubjectId:
        "19981306",
      sortOrder:
        4,
    }),

    makeRequiredSubject({
      subjectName:
        "사회복지조사론",
      officialSubjectId:
        "19990447",
      sortOrder:
        5,
    }),

    makeRequiredSubject({
      subjectName:
        "사회복지학개론",
      officialSubjectId:
        "19981300",
      sortOrder:
        6,
    }),

    makeRequiredSubject({
      subjectName:
        "사회복지행정론",
      officialSubjectId:
        "19981310",
      sortOrder:
        7,
    }),

    makeRequiredSubject({
      subjectName:
        "사회복지현장실습",
      officialSubjectId:
        "20000052",
      sortOrder:
        8,
    }),

    makeRequiredSubject({
      subjectName:
        "인간행동과사회환경",
      officialSubjectId:
        "19982196",
      sortOrder:
        9,
    }),

    makeRequiredSubject({
      subjectName:
        "지역사회복지론",
      officialSubjectId:
        "19990448",
      sortOrder:
        10,
    }),

    // ─────────────────────────────
    // 전공선택 43과목
    // ─────────────────────────────

    makeElectiveSubject({
      subjectName:
        "가족복지론",
      officialSubjectId:
        "19980059",
      sortOrder:
        11,
    }),

    makeElectiveSubject({
      subjectName:
        "가족상담및가족치료",
      sortOrder:
        12,
    }),

    makeElectiveSubject({
      subjectName:
        "가족생활교육",
      officialSubjectId:
        "20021764",
      sortOrder:
        13,
    }),

    makeElectiveSubject({
      subjectName:
        "건강가정론",
      officialSubjectId:
        "20080064",
      sortOrder:
        14,
    }),

    makeElectiveSubject({
      subjectName:
        "교정복지론",
      officialSubjectId:
        "20000021",
      sortOrder:
        15,
    }),

    makeElectiveSubject({
      subjectName:
        "국제사회복지론",
      officialSubjectId:
        "20230006",
      sortOrder:
        16,
    }),

    makeElectiveSubject({
      subjectName:
        "노인복지론",
      officialSubjectId:
        "19980579",
      sortOrder:
        17,
    }),

    makeElectiveSubject({
      subjectName:
        "범죄사회학",
      sortOrder:
        18,
    }),

    makeElectiveSubject({
      subjectName:
        "복지국가론",
      sortOrder:
        19,
    }),

    makeElectiveSubject({
      subjectName:
        "비교사회복지론",
      sortOrder:
        20,
    }),

    makeElectiveSubject({
      subjectName:
        "빈곤론",
      officialSubjectId:
        "20230007",
      sortOrder:
        21,
    }),

    makeElectiveSubject({
      subjectName:
        "사례관리론",
      officialSubjectId:
        "20230008",
      sortOrder:
        22,
    }),

    makeElectiveSubject({
      subjectName:
        "사회문제론",
      officialSubjectId:
        "19981295",
      sortOrder:
        23,
    }),

    makeElectiveSubject({
      subjectName:
        "사회보장론",
      officialSubjectId:
        "19981297",
      sortOrder:
        24,
    }),

    makeElectiveSubject({
      subjectName:
        "사회복지세미나",
      sortOrder:
        25,
    }),

    makeElectiveSubject({
      subjectName:
        "사회복지시설운영론",
      sortOrder:
        26,
    }),

    makeElectiveSubject({
      subjectName:
        "사회복지역사",
      officialSubjectId:
        "19981304",
      sortOrder:
        27,
    }),

    makeElectiveSubject({
      subjectName:
        "사회복지와문화다양성",
      officialSubjectId:
        "20230009",
      sortOrder:
        28,
    }),

    makeElectiveSubject({
      subjectName:
        "사회복지와인권",
      officialSubjectId:
        "20230010",
      sortOrder:
        29,
    }),

    makeElectiveSubject({
      subjectName:
        "사회복지윤리와철학",
      officialSubjectId:
        "19981308",
      sortOrder:
        30,
    }),

    makeElectiveSubject({
      subjectName:
        "사회복지자료분석론",
      officialSubjectId:
        "20010006",
      sortOrder:
        31,
    }),

    makeElectiveSubject({
      subjectName:
        "사회복지지도감독론",
      officialSubjectId:
        "20010001",
      sortOrder:
        32,
    }),

    makeElectiveSubject({
      subjectName:
        "사회사업상담이론과실제",
      sortOrder:
        33,
    }),

    makeElectiveSubject({
      subjectName:
        "사회심리학",
      sortOrder:
        34,
    }),

    makeElectiveSubject({
      subjectName:
        "사회통계학",
      sortOrder:
        35,
    }),

    makeElectiveSubject({
      subjectName:
        "사회학개론",
      sortOrder:
        36,
    }),

    makeElectiveSubject({
      subjectName:
        "산업복지론",
      officialSubjectId:
        "19981333",
      sortOrder:
        37,
    }),

    makeElectiveSubject({
      subjectName:
        "심리학개론",
      sortOrder:
        38,
    }),

    makeElectiveSubject({
      subjectName:
        "아동복지론",
      officialSubjectId:
        "19981755",
      sortOrder:
        39,
    }),

    makeElectiveSubject({
      subjectName:
        "여성복지론",
      officialSubjectId:
        "20000059",
      sortOrder:
        40,
    }),

    makeElectiveSubject({
      subjectName:
        "영유아보육론",
      officialSubjectId:
        "20030037",
      sortOrder:
        41,
    }),

    makeElectiveSubject({
      subjectName:
        "의료사회복지론",
      officialSubjectId:
        "19982140",
      sortOrder:
        42,
    }),

    makeElectiveSubject({
      subjectName:
        "임상사회사업론",
      sortOrder:
        43,
    }),

    makeElectiveSubject({
      subjectName:
        "자원봉사론",
      officialSubjectId:
        "19982358",
      sortOrder:
        44,
    }),

    makeElectiveSubject({
      subjectName:
        "장애인복지론",
      officialSubjectId:
        "19982384",
      sortOrder:
        45,
    }),

    makeElectiveSubject({
      subjectName:
        "재가복지론",
      sortOrder:
        46,
    }),

    makeElectiveSubject({
      subjectName:
        "정신건강론",
      officialSubjectId:
        "19982591",
      sortOrder:
        47,
    }),

    makeElectiveSubject({
      subjectName:
        "정신건강사회복지론",
      officialSubjectId:
        "19982592",
      sortOrder:
        48,
    }),

    makeElectiveSubject({
      subjectName:
        "조직심리학",
      sortOrder:
        49,
    }),

    makeElectiveSubject({
      subjectName:
        "종교와사회복지",
      sortOrder:
        50,
    }),

    makeElectiveSubject({
      subjectName:
        "청소년복지론",
      officialSubjectId:
        "20000069",
      sortOrder:
        51,
    }),

    makeElectiveSubject({
      subjectName:
        "프로그램개발과평가",
      officialSubjectId:
        "20010005",
      sortOrder:
        52,
    }),

    makeElectiveSubject({
      subjectName:
        "학교사회복지론",
      officialSubjectId:
        "20000097",
      sortOrder:
        53,
    }),
  ],
};


/**
 * 사회복지 전문학사
 *
 * 행정전문학사 / 사회복지 전공
 *
 * 전공필수 7과목
 * 전공선택 35과목
 */
const associateSocialWelfare:
  NileStandardCurriculumSeed = {
  curriculumKey:
    "associate_social_welfare",

  degreeLevel:
    "associate",

  degreeName:
    "행정전문학사",

  majorName:
    "사회복지 전공",

  requiredTotalCredits:
    80,

  requiredMajorCredits:
    45,

  requiredLiberalCredits:
    15,

  hasCoreRequirement:
    false,

  standardVersion:
    "current",

  sourceUrl:
    "https://www.cb.or.kr/creditbank/stdPro/nStdPro2_1.do",

  subjects: [
    // ─────────────────────────────
    // 전공필수 7과목
    // ─────────────────────────────

    makeRequiredSubject({
      subjectName:
        "사회복지법제와실천",
      officialSubjectId:
        "19981302",
      sortOrder:
        1,
    }),

    makeRequiredSubject({
      subjectName:
        "사회복지실천론",
      officialSubjectId:
        "19990445",
      sortOrder:
        2,
    }),

    makeRequiredSubject({
      subjectName:
        "사회복지정책론",
      officialSubjectId:
        "19981306",
      sortOrder:
        3,
    }),

    makeRequiredSubject({
      subjectName:
        "사회복지조사론",
      officialSubjectId:
        "19990447",
      sortOrder:
        4,
    }),

    makeRequiredSubject({
      subjectName:
        "사회복지학개론",
      officialSubjectId:
        "19981300",
      sortOrder:
        5,
    }),

    makeRequiredSubject({
      subjectName:
        "사회복지행정론",
      officialSubjectId:
        "19981310",
      sortOrder:
        6,
    }),

    makeRequiredSubject({
      subjectName:
        "사회복지현장실습",
      officialSubjectId:
        "20000052",
      sortOrder:
        7,
    }),

    // ─────────────────────────────
    // 전공선택 35과목
    // ─────────────────────────────

    makeElectiveSubject({
      subjectName:
        "가족복지론",
      officialSubjectId:
        "19980059",
      sortOrder:
        8,
    }),

    makeElectiveSubject({
      subjectName:
        "가족생활교육",
      officialSubjectId:
        "20021764",
      sortOrder:
        9,
    }),

    makeElectiveSubject({
      subjectName:
        "건강가정론",
      officialSubjectId:
        "20080064",
      sortOrder:
        10,
    }),

    makeElectiveSubject({
      subjectName:
        "교정복지론",
      officialSubjectId:
        "20000021",
      sortOrder:
        11,
    }),

    makeElectiveSubject({
      subjectName:
        "국제사회복지론",
      officialSubjectId:
        "20230006",
      sortOrder:
        12,
    }),

    makeElectiveSubject({
      subjectName:
        "노인복지론",
      officialSubjectId:
        "19980579",
      sortOrder:
        13,
    }),

    makeElectiveSubject({
      subjectName:
        "빈곤론",
      officialSubjectId:
        "20230007",
      sortOrder:
        14,
    }),

    makeElectiveSubject({
      subjectName:
        "사례관리론",
      officialSubjectId:
        "20230008",
      sortOrder:
        15,
    }),

    makeElectiveSubject({
      subjectName:
        "사회문제론",
      officialSubjectId:
        "19981295",
      sortOrder:
        16,
    }),

    makeElectiveSubject({
      subjectName:
        "사회보장론",
      officialSubjectId:
        "19981297",
      sortOrder:
        17,
    }),

    makeElectiveSubject({
      subjectName:
        "사회복지실천기술론",
      officialSubjectId:
        "19990108",
      sortOrder:
        18,
    }),

    makeElectiveSubject({
      subjectName:
        "사회복지역사",
      officialSubjectId:
        "19981304",
      sortOrder:
        19,
    }),

    makeElectiveSubject({
      subjectName:
        "사회복지와문화다양성",
      officialSubjectId:
        "20230009",
      sortOrder:
        20,
    }),

    makeElectiveSubject({
      subjectName:
        "사회복지와인권",
      officialSubjectId:
        "20230010",
      sortOrder:
        21,
    }),

    makeElectiveSubject({
      subjectName:
        "사회복지윤리와철학",
      officialSubjectId:
        "19981308",
      sortOrder:
        22,
    }),

    makeElectiveSubject({
      subjectName:
        "사회복지자료분석론",
      officialSubjectId:
        "20010006",
      sortOrder:
        23,
    }),

    makeElectiveSubject({
      subjectName:
        "사회복지지도감독론",
      officialSubjectId:
        "20010001",
      sortOrder:
        24,
    }),

    makeElectiveSubject({
      subjectName:
        "산업복지론",
      officialSubjectId:
        "19981333",
      sortOrder:
        25,
    }),

    makeElectiveSubject({
      subjectName:
        "아동복지론",
      officialSubjectId:
        "19981755",
      sortOrder:
        26,
    }),

    makeElectiveSubject({
      subjectName:
        "여가및레크리에이션",
      officialSubjectId:
        "19983660",
      sortOrder:
        27,
    }),

    makeElectiveSubject({
      subjectName:
        "여성복지론",
      officialSubjectId:
        "20000059",
      sortOrder:
        28,
    }),

    makeElectiveSubject({
      subjectName:
        "영유아보육론",
      officialSubjectId:
        "20030037",
      sortOrder:
        29,
    }),

    makeElectiveSubject({
      subjectName:
        "의료사회복지론",
      officialSubjectId:
        "19982140",
      sortOrder:
        30,
    }),

    makeElectiveSubject({
      subjectName:
        "인간행동과사회환경",
      officialSubjectId:
        "19982196",
      sortOrder:
        31,
    }),

    makeElectiveSubject({
      subjectName:
        "자원봉사론",
      officialSubjectId:
        "19982358",
      sortOrder:
        32,
    }),

    makeElectiveSubject({
      subjectName:
        "장애인복지론",
      officialSubjectId:
        "19982384",
      sortOrder:
        33,
    }),

    makeElectiveSubject({
      subjectName:
        "정신건강론",
      officialSubjectId:
        "19982591",
      sortOrder:
        34,
    }),

    makeElectiveSubject({
      subjectName:
        "정신건강사회복지론",
      officialSubjectId:
        "19982592",
      sortOrder:
        35,
    }),

    makeElectiveSubject({
      subjectName:
        "지역사회복지론",
      officialSubjectId:
        "19990448",
      sortOrder:
        36,
    }),

    makeElectiveSubject({
      subjectName:
        "청소년복지론",
      officialSubjectId:
        "20000069",
      sortOrder:
        37,
    }),

    makeElectiveSubject({
      subjectName:
        "케어개론",
      officialSubjectId:
        "20040188",
      sortOrder:
        38,
    }),

    makeElectiveSubject({
      subjectName:
        "케어기술",
      officialSubjectId:
        "20040189",
      sortOrder:
        39,
    }),

    makeElectiveSubject({
      subjectName:
        "케어실습",
      officialSubjectId:
        "20040190",
      sortOrder:
        40,
    }),

    makeElectiveSubject({
      subjectName:
        "프로그램개발과평가",
      officialSubjectId:
        "20010005",
      sortOrder:
        41,
    }),

    makeElectiveSubject({
      subjectName:
        "학교사회복지론",
      officialSubjectId:
        "20000097",
      sortOrder:
        42,
    }),
  ],
};


export const NILE_STANDARD_CURRICULUMS:
  NileStandardCurriculumSeed[] = [
  bachelorSocialWelfare,
  associateSocialWelfare,
];