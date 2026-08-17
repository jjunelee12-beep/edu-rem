// server/nile/nile-standard-types.ts

/**
 * 국가평생교육진흥원 학점은행제
 * 전체 표준교육과정 자동 수집 / 파싱 / Seed 공통 타입
 */


/* =========================================================
 * Degree
 * ========================================================= */

export type NileDegreeLevel =
  | "associate"
  | "bachelor";


/**
 * 전문학사 수업연한.
 *
 * bachelor는 사용하지 않고,
 * associate일 때 2년제 / 3년제를 구분한다.
 */
export type NileAssociateDurationYears =
  | 2
  | 3;

/* =========================================================
 * Subject Requirement
 * ========================================================= */

export type NileRequirementType =
  | "전공필수"
  | "전공선택";


/* =========================================================
 * Sync
 * ========================================================= */

export type NileSyncType =
  | "full"
  | "curriculum";

export type NileSyncStatus =
  | "running"
  | "success"
  | "failed";


/* =========================================================
 * Collector - Curriculum Summary
 * ========================================================= */

/**
 * 학사/전문학사 전공 목록 페이지에서
 * 최초로 수집되는 전공 기본정보.
 */
export interface NileCollectedCurriculumSummary {
  degreeLevel: NileDegreeLevel;

associateDurationYears:
  | NileAssociateDurationYears
  | null;

  /**
   * 공식 학위명.
   *
   * 예:
   * 행정학사
   * 문학사
   * 가정학사
   * 행정전문학사
   */
  degreeName: string;

  /**
   * 공식 전공명.
   *
   * 예:
   * 사회복지학 전공
   * 아동학 전공
   */
  majorName: string;

  /**
   * 국평원 공식 전공 ID.
   *
   * 예:
   * AGAE
   * AACG
   */
  officialMajorId: string;

  /**
   * 전공 상세페이지.
   */
  sourceUrl: string;
}


/* =========================================================
 * Collector / Parser - Subject
 * ========================================================= */

export interface NileCollectedSubject {
  /**
   * 국평원 공식 과목 ID.
   *
   * 페이지에서 확인되지 않는 경우 null.
   */
  officialSubjectId:
    | string
    | null;

  subjectName: string;

  requirementType: NileRequirementType;

  credits: number;

  lectureHours: number;

  practiceHours: number;

  /**
   * 전공필수 핵심제 적용 대상 여부.
   *
   * 일반 전공은 false.
   */
  isCoreRequired: boolean;

  /**
   * 공식표 출력 순서.
   */
  sortOrder: number;

  /**
   * 해당 과목 상세/교수요목 URL.
   */
  sourceUrl:
    | string
    | null;
}


/* =========================================================
 * Parsed Curriculum
 * ========================================================= */

export interface NileParsedCurriculum {
  /**
   * EduCanvas 내부 안정적 식별자.
   *
   * collector/parser가 자동 생성.
   */
  curriculumKey: string;

  degreeLevel: NileDegreeLevel;

associateDurationYears:
  | NileAssociateDurationYears
  | null;

  degreeName: string;

  majorName: string;

  officialMajorId: string;

  /**
   * 학위 취득 총학점.
   *
   * 일반적 기준:
   * associate = 80
   * bachelor = 140
   */
  requiredTotalCredits: number;

  /**
   * 최소 전공학점.
   *
   * 일반적 기준:
   * associate = 45
   * bachelor = 60
   */
  requiredMajorCredits: number;

  /**
   * 최소 교양학점.
   *
   * 일반적 기준:
   * associate = 15
   * bachelor = 30
   */
  requiredLiberalCredits: number;

  /**
   * 전공필수 핵심제 적용 여부.
   */
  hasCoreRequirement: boolean;

  /**
   * 핵심제 최소 이수 전필 과목 수.
   *
   * 미적용이면 null.
   */
  requiredCoreSubjectCount:
    | number
    | null;

  /**
   * 공식 기준 버전.
   *
   * 예:
   * current
   * 2026-current
   */
  standardVersion: string;

  sourceUrl: string;

  sourceCheckedAt: Date;

  subjects: NileCollectedSubject[];
}


/* =========================================================
 * Liberal Arts
 * ========================================================= */

export interface NileCollectedLiberalSubject {
  officialSubjectId:
    | string
    | null;

  subjectName: string;

  credits: number;

  lectureHours: number;

  practiceHours: number;

  standardVersion: string;

  sourceUrl:
    | string
    | null;

  sourceCheckedAt: Date;
}


/* =========================================================
 * Major / Liberal Compatible
 * ========================================================= */

export interface NileCollectedMajorLiberalCompatibleSubject {
  /**
   * 연결 대상 curriculumKey.
   */
  curriculumKey: string;

  officialSubjectId:
    | string
    | null;

  subjectName: string;

  /**
   * 해당 전공으로 인정할 경우의 구분.
   */
  majorRequirementType: NileRequirementType;

  credits: number;

  lectureHours: number;

  practiceHours: number;

  standardVersion: string;

  sourceUrl:
    | string
    | null;

  sourceCheckedAt: Date;
}


/* =========================================================
 * Alias / Equivalence
 * ========================================================= */

export type NileSubjectAliasType =
  | "official_equivalent"
  | "legacy_name"
  | "normalization"
  | "manual_verified";

export interface NileCollectedSubjectAlias {
  /**
   * 특정 전공에서만 적용되는 경우 사용.
   * 전공 공통이면 null.
   */
  curriculumKey:
    | string
    | null;

  canonicalSubjectName: string;

  canonicalOfficialSubjectId:
    | string
    | null;

  aliasSubjectName: string;

  normalizedAliasSubjectName: string;

  aliasType: NileSubjectAliasType;

  standardVersion:
    | string
    | null;

  sourceUrl:
    | string
    | null;

  verifiedAt:
    | Date
    | null;
}


/* =========================================================
 * Full Collected Dataset
 * ========================================================= */

export interface NileCollectedDataset {
  collectedAt: Date;

  standardVersion: string;

  curriculums: NileParsedCurriculum[];

  liberalSubjects: NileCollectedLiberalSubject[];

  majorLiberalCompatibleSubjects:
    NileCollectedMajorLiberalCompatibleSubject[];

  subjectAliases: NileCollectedSubjectAlias[];
}


/* =========================================================
 * Collector Result
 * ========================================================= */

export interface NileCollectorResult {
  success: boolean;

  dataset:
    | NileCollectedDataset
    | null;

  errors: string[];

  warnings: string[];
}


/* =========================================================
 * Seed Stats
 * ========================================================= */

export interface NileSeedStats {
  curriculumCount: number;

  subjectCount: number;

  liberalSubjectCount: number;

  compatibleSubjectCount: number;

  aliasCount: number;

  insertedCount: number;

  updatedCount: number;

  deactivatedCount: number;
}


/* =========================================================
 * Full Sync Result
 * ========================================================= */

export interface NileFullSyncResult {
  success: boolean;

  syncRunId:
    | number
    | null;

  startedAt: Date;

  finishedAt: Date;

  stats: NileSeedStats;

  warnings: string[];

  errors: string[];
}


/* =========================================================
 * Normalization Helpers Types
 * ========================================================= */

export interface NileNormalizedSubject {
  originalName: string;

  normalizedName: string;
}


/* =========================================================
 * Parser Helpers
 * ========================================================= */

export interface NileParsedSubjectRow {
  requirementType: NileRequirementType;

  officialSubjectId:
    | string
    | null;

  subjectName: string;

  credits: number;

  lectureHours: number;

  practiceHours: number;

  sortOrder: number;
}


/* =========================================================
 * Collector HTTP
 * ========================================================= */

export interface NileHttpResponse {
  url: string;

  status: number;

  ok: boolean;

  text: string;
}


/* =========================================================
 * Validation
 * ========================================================= */

export interface NileValidationIssue {
  level:
    | "error"
    | "warning";

  code: string;

  message: string;

  curriculumKey:
    | string
    | null;

  subjectName:
    | string
    | null;
}

export interface NileValidationResult {
  valid: boolean;

  issues: NileValidationIssue[];
}


/* =========================================================
 * Utility
 * ========================================================= */

/**
 * 과목명 매칭용 기본 정규화.
 *
 * 동등과목 판정은 하지 않는다.
 */
export function normalizeNileSubjectName(
  value: string
): string {
  return String(
    value || ""
  )
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .trim();
}


/**
 * 내부 curriculumKey 생성용 기본 slug.
 *
 * 최종 key 충돌은 collector/parser에서
 * officialMajorId를 포함해 방지한다.
 */
export function normalizeNileKeyPart(
  value: string
): string {
  return String(
    value || ""
  )
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\p{L}\p{N}_-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}


/**
 * 전체 자동수집용 curriculumKey 생성.
 *
 * 예:
 * bachelor_agae
 * associate_xxxx
 *
 * 이름이 변경돼도 officialMajorId가 같으면
 * key가 유지되도록 공식 ID를 우선한다.
 */
export function buildNileCurriculumKey(
  params: {
    degreeLevel: NileDegreeLevel;
    officialMajorId: string;
  }
): string {
  const degreeLevel =
    params.degreeLevel;

  const officialMajorId =
    normalizeNileKeyPart(
      params.officialMajorId
    );

  if (!officialMajorId) {
    throw new Error(
      "NILE curriculumKey 생성 실패: officialMajorId가 없습니다."
    );
  }

  return `${degreeLevel}_${officialMajorId}`;
}