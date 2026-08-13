import * as db from "../db";
import {
  analyzeQualificationRisk,
  resolveQualificationRiskCourseKey,

  type QualificationRecognizedSubject,
  type QualificationRiskMasterItem,
  type QualificationRiskCourseKey,
} from "./risk-rules/qualification-risk-analyzer";

import {
  resolveDegreeRequirement,
} from "./risk-rules/degree-requirement-resolver";

import {
  analyzeDegreeCredits,
} from "./risk-rules/degree-credit-analyzer";

import {
  mergeQualificationRequirements,
} from "./risk-rules/qualification-requirement-merger";

import {
  planQualificationSubjects,

  type DegreeFillTemplateItem,
} from "./risk-rules/qualification-subject-planner";

import {
  planQualificationSemesters,
} from "./risk-rules/qualification-semester-planner";

import {
  planAdministrativeTimeline,
} from "./risk-rules/administrative-timeline-planner";

import {
  resolveStudentAcademicSummary,

  type StudentAcademicSummaryResult,
} from "./risk-rules/student-academic-summary-resolver";

import {
  isFaceToFaceMasterSubject,
} from "./risk-rules/risk-rule-master";

import type {
  KakaoAiStructuredMemory,
} from "./kakao-ai-memory-resolver";

import {
  getConfirmedSubjectEquivalenceKey,
} from "./risk-rules/subject-equivalence-resolver";

/**
 * 카카오 AI 신규상담용 공통 학습설계 Adapter.
 *
 * 목적:
 *
 * 신규 상담자의
 *
 * - 희망과정
 * - 최종학력
 * - 확정된 전적대 인정과목
 * - 사회복지 구법/신법
 *
 * 을 기존 EduCanvas 공통 규칙엔진에 넣어
 *
 * - 자격요건
 * - 학위요건
 * - 부족과목
 * - 부족학점
 * - 실습시간
 * - 추가 수강계획
 * - 예상 학기
 * - 행정일정
 *
 * 을 계산한다.
 *
 * 중요:
 *
 * 이 Adapter에서는 법규나 학점을
 * 직접 계산하지 않는다.
 *
 * 기존 risk-rules 공통엔진 결과만 조합한다.
 */

/**
 * 신규 상담 분석에 사용할
 * 확정된 인정과목.
 *
 * 지금은 기본 []로 사용하고,
 * 이후 OCR Adapter가 연결되면
 * 검증된 전적대 과목을 전달한다.
 */
export type KakaoAiLeadRecognizedSubject =
  QualificationRecognizedSubject;

/**
 * 신규 상담 공통엔진 결과.
 */
export type KakaoAiLeadAcademicAnalysis = {
  /**
   * ready:
   * 현재 정보로 설명 가능
   *
   * review_required:
   * 일부 정보가 부족하거나
   * 서버 공통엔진에서 확인 필요 상태
   */
  status:
    "ready" |
    "review_required";

  canExplain:
    boolean;

  organizationId:
    number;

  /**
   * Memory에 저장된 사용자의
   * 실제 희망과정 문구.
   */
  requestedCourse:
    string | null;

  /**
   * 공통엔진이 판정한 과정 Key.
   */
  courseKey:
    QualificationRiskCourseKey;

  /**
   * 실제 회사 과정마스터.
   */
  catalog:
    {
      id:
        number;

      name:
        string;
    } | null;

  /**
   * 분석에 사용한 인정과목.
   */
  recognizedSubjects:
    KakaoAiLeadRecognizedSubject[];

  /**
   * 기존 공통엔진 원본 결과.
   *
   * AI가 숫자나 법규를 다시 계산하지 않고
   * 이 결과를 설명해야 한다.
   */
  degreeRequirement:
    ReturnType<
      typeof resolveDegreeRequirement
    > | null;

  degreeCreditAnalysis:
    ReturnType<
      typeof analyzeDegreeCredits
    > | null;

  qualificationAnalysis:
    ReturnType<
      typeof analyzeQualificationRisk
    > | null;

  requirements:
    ReturnType<
      typeof mergeQualificationRequirements
    > | null;

  subjectPlan:
    ReturnType<
      typeof planQualificationSubjects
    > | null;

  semesterPlan:
    ReturnType<
      typeof planQualificationSemesters
    > | null;

  administrativeTimeline:
    ReturnType<
      typeof planAdministrativeTimeline
    > | null;

  /**
   * 최종적으로 AI가 가장 우선해서
   * 설명에 사용해야 할 공통 요약.
   */
  academicSummary:
    StudentAcademicSummaryResult | null;

  /**
   * 현재 계산이 완전히 확정되지 않은 이유.
   *
   * 새로운 법규판단을 여기서 만들지 않고
   * 공통엔진이 반환한 이유만 모은다.
   */
  unresolvedReasons:
    string[];

  warnings:
    string[];
};

function normalizePositiveInteger(
  value:
    unknown,

  label:
    string
): number {
  const normalized =
    Math.floor(
      Number(
        value ||
        0
      )
    );

  if (
    !Number.isFinite(
      normalized
    ) ||
    normalized <=
      0
  ) {
    throw new Error(
      `${label} 정보가 올바르지 않습니다.`
    );
  }

  return normalized;
}

function normalizeText(
  value:
    unknown
): string {
  return String(
    value ??
    ""
  ).trim();
}

function normalizeCourseMatchText(
  value:
    unknown
): string {
  return normalizeText(
    value
  )
    .toLowerCase()
    .replace(
      /[\s\-_()[\]{}.,/\\]+/g,
      ""
    );
}

function normalizeNullableText(
  value:
    unknown
): string | null {
  const normalized =
    normalizeText(
      value
    );

  return normalized ||
    null;
}

function toNumber(
  value:
    unknown
): number {
  const normalized =
    Number(
      value
    );

  return Number.isFinite(
    normalized
  )
    ? normalized
    : 0;
}

function uniqueStrings(
  values:
    Array<
      string |
      null |
      undefined
    >
): string[] {
  return Array.from(
    new Set(
      values
        .map(
          (
            value
          ) =>
            String(
              value ??
              ""
            ).trim()
        )
        .filter(
          Boolean
        )
    )
  );
}

/**
 * 외부에서 전달되는 인정과목도
 * 공통엔진 입력 형태로 정규화한다.
 *
 * 여기서는 "인정 여부"를 판단하지 않는다.
 *
 * caller가 이미 OCR / 서버 검증을 끝낸
 * 과목만 전달해야 한다.
 */
function normalizeRecognizedSubjects(
  subjects:
    KakaoAiLeadRecognizedSubject[]
): KakaoAiLeadRecognizedSubject[] {
  if (
    !Array.isArray(
      subjects
    )
  ) {
    return [];
  }

  return subjects
    .map(
      (
        subject
      ) => ({
        subjectName:
          normalizeText(
            subject.subjectName
          ),

        requirementType:
          normalizeNullableText(
            subject.requirementType
          ),

        category:
          normalizeNullableText(
            subject.category
          ),

        credits:
          Math.max(
            toNumber(
              subject.credits
            ),
            0
          ),

        source:
          subject.source ===
            "transfer"
            ? "transfer" as const
            : subject.source ===
                "extra"
              ? "extra" as const
              : "plan" as const,
      })
    )
    .filter(
      (
        subject
      ) =>
        Boolean(
          subject.subjectName
        )
    );
}

function resolveLeadConsultationRecognizedSubjects(
  params: {
    memory:
      KakaoAiStructuredMemory;

    masterItems:
      QualificationRiskMasterItem[];

    verifiedSubjects:
      KakaoAiLeadRecognizedSubject[];
  }
): {
  recognizedSubjects:
    KakaoAiLeadRecognizedSubject[];

  provisionalSubjects:
    KakaoAiLeadRecognizedSubject[];

  warnings:
    string[];
} {
  const verifiedSubjects =
    normalizeRecognizedSubjects(
      params.verifiedSubjects
    );

  const priorSubjectCandidates =
    Array.isArray(
      params.memory
        .priorSubjectCandidates
    )
      ? params.memory
          .priorSubjectCandidates
      : [];

  const verifiedKeySet =
    new Set(
      verifiedSubjects
        .map(
          subject =>
            getConfirmedSubjectEquivalenceKey(
              subject.subjectName
            )
        )
        .filter(
          Boolean
        )
    );

  const masterByKey =
    new Map<
      string,
      QualificationRiskMasterItem
    >();

  for (
    const masterItem
    of params.masterItems
  ) {
    const key =
      getConfirmedSubjectEquivalenceKey(
        masterItem.subjectName
      );

    if (
      key &&
      !masterByKey.has(
        key
      )
    ) {
      masterByKey.set(
        key,
        masterItem
      );
    }
  }

  const provisionalSubjects:
    KakaoAiLeadRecognizedSubject[] =
    [];

  const warnings:
    string[] =
    [];

  for (
    const candidate
    of priorSubjectCandidates
  ) {
    /**
     * 이미 공식 verified이면
     * 위 verifiedSubjects에 포함되어 있으므로
     * 여기서 다시 추가하지 않는다.
     */
    if (
      candidate.verificationStatus ===
        "verified" ||
      candidate.verificationStatus ===
        "rejected"
    ) {
      continue;
    }

    const candidateKey =
      getConfirmedSubjectEquivalenceKey(
        candidate.subjectName
      );

    if (
      !candidateKey ||
      verifiedKeySet.has(
        candidateKey
      )
    ) {
      continue;
    }

    const matchedMaster =
      masterByKey.get(
        candidateKey
      );

    /**
     * 회사의 실제 과정 과목마스터와
     * 대응되지 않는 과목은
     * 상담용 계산에도 사용하지 않는다.
     */
    if (
      !matchedMaster
    ) {
      continue;
    }

    provisionalSubjects.push({
      subjectName:
        matchedMaster.subjectName,

      requirementType:
        matchedMaster.requirementType,

      category:
        matchedMaster.category,

      credits:
        candidate.credits ??
        matchedMaster.credits ??
        0,

      source:
        "transfer",
    });

    warnings.push(
      `${candidate.subjectName}은 사용자가 직접 이수했다고 밝힌 과목으로 상담용 예상 계산에 반영했습니다. 최종 인정 여부는 성적증명서 확인이 필요합니다.`
    );
  }

const uniqueProvisionalSubjects =
  Array.from(
    new Map(
      provisionalSubjects.map(
        subject => [
          getConfirmedSubjectEquivalenceKey(
            subject.subjectName
          ) ||
          subject.subjectName,

          subject,
        ]
      )
    ).values()
  );

  return {
    recognizedSubjects: [
  ...verifiedSubjects,
  ...uniqueProvisionalSubjects,
],

provisionalSubjects:
  uniqueProvisionalSubjects,

    warnings:
      Array.from(
        new Set(
          warnings
        )
      ),
  };
}

/**
 * 실제 subject_catalog_items Row를
 * 공통 Qualification Planner 입력으로 변환.
 *
 * 대면 여부 역시 별도 문자열추측을 하지 않고
 * 기존 risk-rule-master 함수를 사용한다.
 */
function mapQualificationMasterItems(
  rows:
    any[]
): QualificationRiskMasterItem[] {
  return (
    rows ||
    []
  )
    .map(
      (
        row:
          any
      ) => ({
        id:
          Number(
            row?.id ||
            0
          ),

        catalogId:
          Number(
            row?.catalogId ||
            0
          ),

        subjectName:
          normalizeText(
            row?.subjectName
          ),

        requirementType:
          normalizeNullableText(
            row?.requirementType
          ),

        category:
          normalizeNullableText(
            row?.category
          ),

        credits:
          Math.max(
            toNumber(
              row?.credits
            ),
            0
          ),

        /**
         * 보육교사 대면과목 등의 판정은
         * 공통 마스터 함수만 사용한다.
         */
        isFaceToFace:
          isFaceToFaceMasterSubject(
            row?.subjectName
          ),
      })
    )
    .filter(
      (
        row
      ) =>
        Boolean(
          row.id &&
          row.catalogId &&
          row.subjectName
        )
    );
}

/**
 * course_subject_templates Row를
 * 기존 Degree Fill Planner 입력으로 변환.
 */
function mapDegreeTemplates(
  rows:
    any[]
): DegreeFillTemplateItem[] {
  return (
    rows ||
    []
  )
    .map(
      (
        row:
          any
      ) => {
        const category =
          row?.category ===
            "교양"
            ? "교양"
            : row?.category ===
                "일반"
              ? "일반"
              : "전공";

        const requirementType =
          row?.requirementType ===
            "전공필수" ||
          row?.requirementType ===
            "전공선택" ||
          row?.requirementType ===
            "교양" ||
          row?.requirementType ===
            "일반"
            ? row.requirementType
            : null;

        return {
          id:
            Number(
              row?.id ||
              0
            ),

          courseKey:
            normalizeText(
              row?.courseKey
            ),

          subjectName:
            normalizeText(
              row?.subjectName
            ),

          category,

          requirementType,

          sortOrder:
            Math.floor(
              toNumber(
                row?.sortOrder
              )
            ),
        };
      }
    )
    .filter(
      (
        row
      ) =>
        Boolean(
          row.id &&
          row.courseKey &&
          row.subjectName
        )
    );
}

/**
 * 회사 과정마스터에서
 * 현재 희망과정과 같은 courseKey를 가진
 * Catalog를 찾는다.
 *
 * subject_catalogs에는 courseKey 컬럼이 없으므로
 * 기존 resolveQualificationRiskCourseKey()를
 * 과정명에 적용한다.
 */
async function resolveLeadCourseCatalog(
  params: {
    organizationId:
      number;

    courseKey:
      QualificationRiskCourseKey;

    requestedCourse:
      string;
  }
): Promise<{
  catalog:
    {
      id:
        number;

      name:
        string;
    } | null;

  duplicate:
    boolean;

  matchedCount:
    number;
}> {
  const catalogs =
    await db.listSubjectCatalogs({
      organizationId:
        params.organizationId,

      activeOnly:
        true,
    });

  /**
   * 1.
   * 먼저 공통 courseKey가 같은
   * 활성 과정마스터만 후보로 만든다.
   */
  const courseKeyMatches =
    (
      catalogs ||
      []
    )
      .filter(
        (
          catalog:
            any
        ) =>
          resolveQualificationRiskCourseKey(
            catalog?.name
          ) ===
          params.courseKey
      );

  if (
    courseKeyMatches.length ===
    0
  ) {
    return {
      catalog:
        null,

      duplicate:
        false,

      matchedCount:
        0,
    };
  }

  /**
   * courseKey 기준으로 이미 하나만 있으면
   * 추가 추론 없이 그대로 사용한다.
   */
  if (
    courseKeyMatches.length ===
    1
  ) {
    return {
      catalog: {
        id:
          Number(
            courseKeyMatches[0].id
          ),

        name:
          normalizeText(
            courseKeyMatches[0].name
          ),
      },

      duplicate:
        false,

      matchedCount:
        1,
    };
  }

  /**
   * 2.
   * 같은 courseKey 마스터가 여러 개라면
   * 사용자가 실제로 말한 희망과정 문구를 이용해
   * 가장 직접적으로 대응되는 마스터를 찾는다.
   *
   * 과정명을 새로 추측하거나 생성하지 않고
   * DB에 존재하는 이름과 사용자의 실제 문구만 비교한다.
   */
  const normalizedRequestedCourse =
    normalizeCourseMatchText(
      params.requestedCourse
    );

  const directMatches =
    courseKeyMatches.filter(
      (
        catalog:
          any
      ) => {
        const normalizedCatalogName =
          normalizeCourseMatchText(
            catalog?.name
          );

        if (
          !normalizedCatalogName ||
          !normalizedRequestedCourse
        ) {
          return false;
        }

        return (
          normalizedRequestedCourse.includes(
            normalizedCatalogName
          ) ||
          normalizedCatalogName.includes(
            normalizedRequestedCourse
          )
        );
      }
    );

  if (
    directMatches.length ===
    1
  ) {
    return {
      catalog: {
        id:
          Number(
            directMatches[0].id
          ),

        name:
          normalizeText(
            directMatches[0].name
          ),
      },

      duplicate:
        false,

      matchedCount:
        courseKeyMatches.length,
    };
  }

  /**
   * 3.
   * 사용자가 학위과정을 말하지 않았는데
   * 동일 courseKey 안에 자격과정과 학사과정이 같이 있다면
   * 학사 과정마스터를 자격과정 후보에서 제외한다.
   *
   * 반대로 사용자가 실제로 "학사"를 말했다면
   * 이 필터를 적용하지 않는다.
   */
  const requestedDegreeTrack =
    normalizedRequestedCourse.includes(
      "학사"
    );

  if (
    !requestedDegreeTrack
  ) {
    const nonDegreeMatches =
      courseKeyMatches.filter(
        (
          catalog:
            any
        ) =>
          !normalizeCourseMatchText(
            catalog?.name
          ).includes(
            "학사"
          )
      );

    if (
      nonDegreeMatches.length ===
      1
    ) {
      return {
        catalog: {
          id:
            Number(
              nonDegreeMatches[0].id
            ),

          name:
            normalizeText(
              nonDegreeMatches[0].name
            ),
        },

        duplicate:
          false,

        matchedCount:
          courseKeyMatches.length,
      };
    }
  }

  /**
   * 여기까지 와도 하나로 확정되지 않는 경우에만
   * 안전하게 중복으로 처리한다.
   */
  return {
    catalog:
      null,

    duplicate:
      true,

    matchedCount:
      courseKeyMatches.length,
  };
}

/**
 * 분석이 시작되기 전에
 * 과정 자체를 확정할 수 없는 경우
 * 안전한 review_required 결과를 생성한다.
 */
function buildUnresolvedResult(
  params: {
    organizationId:
      number;

    requestedCourse:
      string | null;

    courseKey:
      QualificationRiskCourseKey;

    reason:
      string;

    warnings?:
      string[];
  }
): KakaoAiLeadAcademicAnalysis {
  return {
    status:
      "review_required",

    canExplain:
      false,

    organizationId:
      params.organizationId,

    requestedCourse:
      params.requestedCourse,

    courseKey:
      params.courseKey,

    catalog:
      null,

    recognizedSubjects:
      [],

    degreeRequirement:
      null,

    degreeCreditAnalysis:
      null,

    qualificationAnalysis:
      null,

    requirements:
      null,

    subjectPlan:
      null,

    semesterPlan:
      null,

    administrativeTimeline:
      null,

    academicSummary:
      null,

    unresolvedReasons: [
      params.reason,
    ],

    warnings:
      params.warnings ||
      [],
  };
}

/**
 * 신규 상담자의 공통엔진 분석.
 *
 * 이 함수 자체는:
 *
 * - OpenAI 호출 X
 * - 신규 사실 추측 X
 * - OCR 수행 X
 * - DB 수정 X
 *
 * 오직 이미 확정된 Memory/인정과목을
 * 기존 공통엔진에 넣어 분석한다.
 */
export async function resolveKakaoAiLeadAcademicAnalysis(
  params: {
    organizationId:
      number;

    memory:
      KakaoAiStructuredMemory;

    /**
     * OCR Adapter 연결 전에는 [].
     *
     * 이후 성적증명서에서 서버가 확정한
     * 인정과목만 전달한다.
     */
    recognizedSubjects?:
      KakaoAiLeadRecognizedSubject[];
  }
): Promise<KakaoAiLeadAcademicAnalysis> {
  const organizationId =
    normalizePositiveInteger(
      params.organizationId,
      "카카오 AI 회사"
    );

  const memory =
    params.memory;

  const requestedCourse =
    normalizeNullableText(
      memory.desiredCourse
    );

  /**
   * 희망과정이 아직 없다면
   * AI가 임의로 과정을 선택하지 않는다.
   */
  if (
    !requestedCourse
  ) {
    return buildUnresolvedResult({
      organizationId,

      requestedCourse:
        null,

      courseKey:
        "unknown",

      reason:
        "희망과정이 확인되지 않아 학습설계를 계산할 수 없습니다.",
    });
  }

  /**
   * 과정명 → 공통 과정 Key.
   *
   * 기존 qualification-risk-analyzer의
   * Resolver를 그대로 사용한다.
   */
  const courseKey =
    resolveQualificationRiskCourseKey(
      requestedCourse
    );

  if (
    courseKey ===
      "unknown"
  ) {
    return buildUnresolvedResult({
      organizationId,

      requestedCourse,

      courseKey,

      reason:
        "희망과정을 공통 학습설계 과정으로 판정할 수 없습니다.",
    });
  }

  /**
   * 회사별 실제 과정마스터 확인.
   */
  const catalogResolution =
  await resolveLeadCourseCatalog({
    organizationId,

    courseKey,

    requestedCourse,
  });

  if (
    !catalogResolution.catalog
  ) {
    return buildUnresolvedResult({
      organizationId,

      requestedCourse,

      courseKey,

      reason:
        catalogResolution.duplicate
          ? "같은 과정으로 판정되는 활성 과정마스터가 여러 개 있어 자동 학습설계를 진행할 수 없습니다."
          : "해당 과정의 활성 과정마스터를 찾을 수 없습니다.",

      warnings:
        catalogResolution.duplicate
          ? [
              `동일 과정마스터 ${catalogResolution.matchedCount}건이 확인되었습니다.`,
            ]
          : [],
    });
  }

  const catalog =
    catalogResolution.catalog;

  /**
   * 실제 회사 과목마스터와
   * 학위 채움용 템플릿을 병렬 조회.
   */
  const [
    masterRows,
    degreeTemplateRows,
  ] = await Promise.all([
    db.listSubjectCatalogItems({
      organizationId,

      catalogId:
        catalog.id,

      activeOnly:
        true,
    }),

    db.listCourseSubjectTemplates(
      courseKey,
      {
        organizationId,
      }
    ),
  ]);

  const masterItems =
    mapQualificationMasterItems(
      masterRows
    );

  const degreeTemplates =
    mapDegreeTemplates(
      degreeTemplateRows
    );

  const officialRecognizedSubjects =
  normalizeRecognizedSubjects(
    params.recognizedSubjects ||
    []
  );

const consultationRecognition =
  resolveLeadConsultationRecognizedSubjects({
    memory,

    masterItems,

    verifiedSubjects:
      officialRecognizedSubjects,
  });

const recognizedSubjects =
  consultationRecognition
    .recognizedSubjects;

/**
 * 신규상담 사회복지사 상담용 적용기준.
 *
 * 중요:
 *
 * - 서버에서 이미 old가 확정되어 있으면 old 우선
 * - 사용자가 말한 전적대 과목이 실제 회사 마스터와
 *   대응되고 2019년 이전 이수라고 명확하게 말한 경우
 *   상담용 예상 계산에서는 old를 사용할 수 있다.
 *
 * - 단 이 값은 공식 확정값이 아니다.
 *   user_reported 과목을 이용한 경우
 *   warnings를 통해 성적증명서 확인 필요를 반드시 남긴다.
 */
const hasProvisionalOldLawEvidence =
  courseKey ===
    "social_worker_2" &&
  Array.isArray(
    memory.priorSubjectCandidates
  ) &&
  memory.priorSubjectCandidates.some(
    candidate => {
      if (
        candidate.verificationStatus ===
        "rejected"
      ) {
        return false;
      }

      const completedYear =
        Number(
          candidate.completedYear ||
          0
        );

      if (
        !Number.isFinite(
          completedYear
        ) ||
        completedYear <= 0 ||
        completedYear > 2019
      ) {
        return false;
      }

      const candidateKey =
        getConfirmedSubjectEquivalenceKey(
          candidate.subjectName
        );

      if (
        !candidateKey
      ) {
        return false;
      }

      return consultationRecognition
        .provisionalSubjects
        .some(
          recognized =>
            getConfirmedSubjectEquivalenceKey(
              recognized.subjectName
            ) ===
            candidateKey
        );
    }
  );

const consultationSocialWorkerLawVersion =
  courseKey ===
    "social_worker_2"
    ? (
        memory.socialWorkerLawVersion ===
          "old"
          ? "old"
          : hasProvisionalOldLawEvidence
            ? "old"
            : memory.socialWorkerLawVersion ===
                "current"
              ? "current"
              : "current"
      )
    : undefined;

  /**
   * 1.
   * 과정 + 최종학력으로
   * 학위 필요 여부 판정.
   */
  const degreeRequirement =
    resolveDegreeRequirement({
      courseKey,

      finalEducation:
        memory.finalEducation,
    });

  /**
   * 2.
   * 현재 인정과목을 기반으로
   * 학위학점 분석.
   */
  const degreeCreditAnalysis =
    analyzeDegreeCredits({
      degreeRequirement,

      recognizedSubjects,
    });

  /**
 * 3.
 * 자격과정 조건 분석.
 *
 * 사회복지사 신규상담 정책:
 *
 * - Memory에 서버가 확정한 old/current가 있으면
 *   해당 값을 그대로 사용한다.
 *
 * - 아직 적용기준이 확정되지 않은 신규 상담자는
 *   current(신법)를 기본값으로 사용한다.
 *
 * - 이후 OCR / 전적대 인정과목 분석 등에서
 *   구법 적용이 서버에서 확정되면
 *   Memory의 socialWorkerLawVersion = "old"가
 *   전달되므로 그 값을 우선 사용한다.
 *
  * 단, 사용자가 직접 밝힌 2019년 이전 기이수과목이
 * 실제 회사 과목마스터와 대응되는 경우에는
 * 상담용 예상 계산에 한해 구법을 적용할 수 있다.
 *
 * 이 경우 공식 확정값으로 취급하지 않고
 * 성적증명서 확인 필요 경고를 반드시 함께 반환한다.
 */
  const qualificationAnalysis =
    analyzeQualificationRisk({
      courseName:
        catalog.name,

      masterItems,

      recognizedSubjects,

      socialWorkerLawVersion:
  courseKey ===
    "social_worker_2"
      ? (
          consultationSocialWorkerLawVersion ??
          "current"
        )
      : undefined,
    });

  /**
   * 4.
   * 학위 + 자격조건 통합.
   */
  const requirements =
    mergeQualificationRequirements({
      degreeRequirement,

      degreeCreditAnalysis,

      qualificationAnalysis,
    });

  /**
   * 5.
   * 실제 부족과목 / 학위 채움과목 설계.
   *
   * 자격요건과 학위요건을 단순 합산하지 않고
   * 기존 Subject Planner가
   * 한 과목으로 여러 조건을
   * 만족할 수 있는지 계산한다.
   */
  const subjectPlan =
    planQualificationSubjects({
      requirements,

      masterItems,

      recognizedSubjects,

      degreeTemplates,
    });

  /**
   * 6.
   * 신규 상담자는 아직
   * CRM 실제 등록학기가 없으므로
   * existingSemesters=[].
   *
   * 현재 한국 날짜 기준으로
   * 공통 학기 Planner가 배치한다.
   */
  const semesterPlan =
    planQualificationSemesters({
      subjectPlan,

      existingSemesters:
        [],
    });

  /**
   * 7.
   * 학위신청 / 자격증 예상일정 계산.
   */
  const administrativeTimeline =
    planAdministrativeTimeline({
      requirements,

      semesterPlan,

      existingSemesters:
        [],
    });

  /**
   * 8.
   * AI가 직접 설명할 최종 공통 Summary.
   *
   * 여기까지 계산된 서버 결과만 이용한다.
   */
  const academicSummary =
    resolveStudentAcademicSummary({
      requirements,

      subjectPlan,

      semesterPlan,

      administrativeTimeline,
    });

  /**
   * Adapter가 새로운 판정문을 만들지 않고
   * 기존 엔진에서 이미 나온 확인 필요 사유만
   * 하나로 모은다.
   */
  const unresolvedReasons =
    uniqueStrings([
      ...(
        requirements
          .blockingReasons ||
        []
      ),

      ...(
        subjectPlan
          .unresolvedRequirements ||
        []
      ).map(
        (
          item
        ) =>
          item.message
      ),

      ...(
        semesterPlan
          .unresolvedReasons ||
        []
      ),

      ...(
        administrativeTimeline
          .unresolvedReasons ||
        []
      ),

      ...(
        academicSummary
          .unresolvedReasons ||
        []
      ),
    ]);

  const warnings =
    uniqueStrings([
...consultationRecognition
  .warnings,

hasProvisionalOldLawEvidence
  ? "2019년 이전 사회복지 관련 기이수과목에 대한 사용자 진술을 기준으로 상담용 구법 예상 계산을 적용했습니다. 최종 구법 적용 여부와 과목 인정 여부는 성적증명서 확인이 필요합니다."
  : null,

      ...(
        subjectPlan
          .warnings ||
        []
      ),

      ...(
        semesterPlan
          .warnings ||
        []
      ),

      ...(
        administrativeTimeline
          .warnings ||
        []
      ),

      ...(
        academicSummary
          .warnings ||
        []
      ),
    ]);

  return {
    status:
      academicSummary.status,

    canExplain:
      academicSummary.canExplain,

    organizationId,

    requestedCourse,

    courseKey,

    catalog,

    recognizedSubjects,

    degreeRequirement,

    degreeCreditAnalysis,

    qualificationAnalysis,

    requirements,

    subjectPlan,

    semesterPlan,

    administrativeTimeline,

    academicSummary,

    unresolvedReasons,

    warnings,
  };
}