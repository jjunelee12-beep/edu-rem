import type {
  KakaoAiStructuredMemory,
} from "./kakao-ai-memory-resolver";

import type {
  DocumentIntelligenceResult,
} from "./document-intelligence.types";

import type {
  QualificationRecognizedSubject,
} from "./risk-rules/qualification-risk-analyzer";

import {
  resolveQualificationRiskCourseKey,
} from "./risk-rules/qualification-risk-analyzer";

import {
  resolveSocialWorkerRule,
  type SocialWorkerLawVersion,
} from "./risk-rules/risk-rule-master";

/**
 * 카카오 AI 신규상담
 * 기이수과목 / 전적대 학업정보 Resolver
 *
 * 역할
 *
 * Structured Memory
 * ↓
 * 사용자가 말한 기이수과목 후보 확인
 * ↓
 * 서버에서 사용할 수 있는 과목만 선별
 * ↓
 * 사회복지사 구법 / 신법 전환조건 판정
 * ↓
 * Lead Academic Adapter가 사용할
 * recognizedSubjects + socialWorkerLawVersion 생성
 *
 *
 * 중요 원칙
 *
 * 1. AI가 법규를 계산하지 않는다.
 *
 * 2. 사용자가 과목명을 말했다는 이유만으로
 *    무조건 인정과목으로 확정하지 않는다.
 *
 * 3. verificationStatus === "verified"인 과목만
 *    recognizedSubjects에 넣는다.
 *
 * 4. 사회복지사 구법은
 *    단순히 "2019년"이라는 숫자만 보고
 *    판정하지 않는다.
 *
 * 5. 서버에서 확인된 사회복지 관련
 *    기이수과목 + 이수연도를 기반으로
 *    전환기준 후보를 판정한다.
 *
 * 6. 최종 자격요건 숫자는
 *    qualification-risk-analyzer가 계산한다.
 */


export type KakaoAiLeadPriorAcademicResolution = {
  /**
   * 현재 희망과정.
   */
  requestedCourse:
    string | null;

  /**
   * 공통엔진 과정 Key.
   */
  courseKey:
    ReturnType<
      typeof resolveQualificationRiskCourseKey
    >;

  /**
   * 서버 검증이 완료되어
   * 공통엔진에 전달할 수 있는 인정과목.
   */
  recognizedSubjects:
    QualificationRecognizedSubject[];

  /**
   * Memory에는 존재하지만
   * 아직 서버 인정과목으로 확정하지 않은 과목.
   */
  pendingSubjects:
    KakaoAiPriorSubjectCandidate[];

  /**
   * 사회복지사 적용기준.
   *
   * 사회복지사 과정이 아니면 null.
   */
  socialWorkerLawVersion:
    SocialWorkerLawVersion | null;

  /**
   * 사회복지 구법/신법을
   * 현재 정보로 확정할 수 있는지.
   */
  socialWorkerLawResolved:
    boolean;

  /**
   * 현재 추가 확인이 필요한 이유.
   */
  unresolvedReasons:
    string[];

  /**
   * 참고 경고.
   */
  warnings:
    string[];
};


/**
 * Memory 타입이 이후 확장되어도
 * 이 Resolver가 필요한 필드만 사용하도록
 * 내부 타입을 따로 둔다.
 */
type KakaoAiPriorSubjectCandidate = {
  subjectName:
    string;

  completedYear:
    number | null;

  credits:
    number | null;

  source:
    string | null;

  verificationStatus:
    string | null;

  requirementType?:
    string | null;

  category?:
    string | null;
};


function normalizeText(
  value:
    unknown
): string {
  return String(
    value ??
    ""
  ).trim();
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


function normalizePositiveYear(
  value:
    unknown
): number | null {
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
    normalized < 1900 ||
    normalized > 2100
  ) {
    return null;
  }

  return normalized;
}


function normalizeCredits(
  value:
    unknown
): number | null {
  const normalized =
    Number(
      value
    );

  if (
    !Number.isFinite(
      normalized
    ) ||
    normalized <= 0
  ) {
    return null;
  }

  return normalized;
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
          value =>
            normalizeText(
              value
            )
        )
        .filter(
          Boolean
        )
    )
  );
}


/**
 * 과목명 비교용.
 *
 * 여기서는 동등과목을 새로 판정하지 않는다.
 * 단순 문자열 정규화만 한다.
 *
 * 실제 자격과목 동등성 판정은
 * qualification-risk-analyzer 내부의
 * subject-equivalence-resolver가 담당한다.
 */
function normalizeSubjectName(
  value:
    unknown
): string {
  return normalizeText(
    value
  )
    .replace(
      /\s+/g,
      ""
    )
    .replace(
      /[()（）·ㆍ.,_\-]/g,
      ""
    )
    .toLowerCase();
}


/**
 * Structured Memory에서
 * priorSubjectCandidates를 안전하게 가져온다.
 *
 * 이전 버전 Memory와 호환하기 위해
 * 런타임에서도 Array 여부를 검사한다.
 */
function getPriorSubjectCandidates(
  memory:
    KakaoAiStructuredMemory
): KakaoAiPriorSubjectCandidate[] {
  const rawCandidates =
    (
      memory as
        KakaoAiStructuredMemory & {
          priorSubjectCandidates?:
            unknown;
        }
    ).priorSubjectCandidates;

  if (
    !Array.isArray(
      rawCandidates
    )
  ) {
    return [];
  }

  return rawCandidates
    .map(
      (
        raw:
          any
      ): KakaoAiPriorSubjectCandidate => ({
        subjectName:
          normalizeText(
            raw?.subjectName
          ),

        completedYear:
          normalizePositiveYear(
            raw?.completedYear
          ),

        credits:
          normalizeCredits(
            raw?.credits
          ),

        source:
          normalizeNullableText(
            raw?.source
          ),

        verificationStatus:
          normalizeNullableText(
            raw?.verificationStatus
          ),

        requirementType:
          normalizeNullableText(
            raw?.requirementType
          ),

        category:
          normalizeNullableText(
            raw?.category
          ),
      })
    )
    .filter(
      candidate =>
        Boolean(
          candidate.subjectName
        )
    );
}


/**
 * 같은 과목이 Memory에 여러 번 들어간 경우
 * 하나로 합친다.
 *
 * 가장 정보가 많은 값을 우선 사용한다.
 */
function mergeDuplicateCandidates(
  candidates:
    KakaoAiPriorSubjectCandidate[]
): KakaoAiPriorSubjectCandidate[] {
  const map =
    new Map<
      string,
      KakaoAiPriorSubjectCandidate
    >();

  for (
    const candidate
    of candidates
  ) {
    const key =
      normalizeSubjectName(
        candidate.subjectName
      );

    if (!key) {
      continue;
    }

    const existing =
      map.get(
        key
      );

    if (!existing) {
      map.set(
        key,
        {
          ...candidate,
        }
      );

      continue;
    }

    map.set(
      key,
      {
        subjectName:
          candidate.subjectName ||
          existing.subjectName,

        completedYear:
          candidate.completedYear ??
          existing.completedYear,

        credits:
          candidate.credits ??
          existing.credits,

        source:
          candidate.source ??
          existing.source,

        verificationStatus:
          candidate.verificationStatus ===
            "verified"
            ? "verified"
            : (
                existing.verificationStatus ??
                candidate.verificationStatus
              ),

        requirementType:
          candidate.requirementType ??
          existing.requirementType,

        category:
          candidate.category ??
          existing.category,
      }
    );
  }

  return Array.from(
    map.values()
  );
}

/**
 * ---------------------------------------------------------
 * Document Intelligence → 신규상담 전적대 과목 Candidate
 * ---------------------------------------------------------
 *
 * 공통 Document Intelligence가 읽은 성적증명서를
 * 기존 Prior Academic Resolver 계약으로 변환한다.
 *
 * 중요:
 *
 * 1. transcript만 사용한다.
 * 2. accepted 결과만 공식 verified 후보로 사용한다.
 * 3. canUseAcademicEngine=true여야 한다.
 * 4. OCR이 읽은 대학 자체 category/requirementType을
 *    학점은행제 분류로 신뢰하지 않는다.
 * 5. 실제 자격과목 동등성 / 학위영역은
 *    이후 공통엔진에서 다시 판정한다.
 */
function getDocumentIntelligenceCandidates(
  documentIntelligence:
    DocumentIntelligenceResult |
    null |
    undefined
): KakaoAiPriorSubjectCandidate[] {
  if (
    !documentIntelligence ||
    documentIntelligence.documentType !==
      "transcript" ||
    documentIntelligence.decision !==
      "accepted" ||
    documentIntelligence.canUseAcademicEngine !==
      true ||
    documentIntelligence.confidence <
      0.85
  ) {
    return [];
  }

  const subjects =
    Array.isArray(
      documentIntelligence
        .academic
        .subjects
    )
      ? documentIntelligence
          .academic
          .subjects
      : [];

  return subjects
    .map(
      subject => {
        const subjectName =
          normalizeText(
            subject.name
          );

        if (
          !subjectName
        ) {
          return null;
        }

        const completedYear =
          normalizePositiveYear(
            subject.year
          );

        const credits =
          normalizeCredits(
            subject.credits
          );

        return {
          subjectName,

          completedYear,

          credits,

          /**
           * 사람이 말한 값이 아니라
           * 실제 제출된 성적증명서를
           * Document Intelligence가 판독한 결과.
           */
          source:
            "document_intelligence",

          /**
           * 여기서 verified의 의미는
           * "문서에서 해당 과목의 이수 사실이
           * 충분한 신뢰도로 확인됨"이다.
           *
           * 자격증 인정과목 확정은
           * 이후 qualification-risk-analyzer가 한다.
           */
          verificationStatus:
            "verified",

          /**
           * 대학 성적증명서의 자체 전공/교양 구분을
           * 목표 학점은행제 분류로 사용하지 않는다.
           */
          requirementType:
            null,

          category:
            null,
        } satisfies
          KakaoAiPriorSubjectCandidate;
      }
    )
    .filter(
      (
        candidate
      ): candidate is
        KakaoAiPriorSubjectCandidate =>
        candidate !==
        null
    );
}


/**
 * 공통엔진 recognizedSubjects 형태로 변환.
 *
 * 반드시 verified 과목만 호출한다.
 */
function mapVerifiedSubject(
  candidate:
    KakaoAiPriorSubjectCandidate
): QualificationRecognizedSubject {
  return {
    subjectName:
      candidate.subjectName,

    requirementType:
      candidate.requirementType ??
      null,

    category:
      candidate.category ??
      null,

    credits:
      candidate.credits ??
      0,

    /**
     * 신규상담에서 과거 대학/전적대 이수과목은
     * transfer로 전달한다.
     */
    source:
      "transfer",
  };
}


/**
 * 사회복지 관련 과목인지 확인하기 위한
 * 최소한의 안전한 후보 판정.
 *
 * 이 함수는 자격 인정 여부를 판정하지 않는다.
 *
 * "사회복지학개론"처럼 명백하게
 * 사회복지 과정과 연결된 과목인지 확인해서
 * 구법 전환조건 검토 대상으로 사용할 뿐이다.
 */
function isSocialWorkerTransitionSubject(
  subjectName:
    unknown
): boolean {
  const normalized =
    normalizeSubjectName(
      subjectName
    );

  if (!normalized) {
    return false;
  }

  /**
   * 대표적인 사회복지사 법정과목명 패턴.
   *
   * 여기에서 해당한다고 해서
   * 인정과목으로 확정되는 것은 아니다.
   *
   * 인정과목 여부는 반드시
   * verificationStatus === verified가
   * 선행되어야 한다.
   */
  const patterns = [
    "사회복지학개론",
    "사회복지개론",
    "인간행동과사회환경",
    "사회복지정책론",
    "사회복지법제",
    "사회복지법제와실천",
    "사회복지실천론",
    "사회복지실천기술론",
    "사회복지조사론",
    "사회복지행정론",
    "지역사회복지론",
    "사회복지현장실습",
    "아동복지론",
    "청소년복지론",
    "노인복지론",
    "장애인복지론",
    "여성복지론",
    "가족복지론",
    "산업복지론",
    "의료사회복지론",
    "학교사회복지론",
    "정신건강론",
    "정신건강사회복지론",
    "교정복지론",
    "사회보장론",
    "사회문제론",
    "자원봉사론",
    "프로그램개발과평가",
    "사례관리론",
  ];

  return patterns.some(
    candidate =>
      normalizeSubjectName(
        candidate
      ) ===
      normalized
  );
}


/**
 * 사회복지사 구법/신법 전환기준 판정.
 *
 * 여기서 중요한 점:
 *
 * 단순히
 *
 * completedYear <= 2019
 *
 * 만으로 구법 처리하지 않는다.
 *
 * 반드시:
 *
 * 1. 서버 검증된 과목이고
 * 2. 사회복지 관련 과목이며
 * 3. 2020년 이전 이수 사실이 확인된 경우
 *
 * 에만 구법 후보를 확정한다.
 *
 * 현재 EduCanvas Memory가
 * "수강 시작일"까지 저장하지 않고
 * 이수연도만 가지고 있으므로
 * 이 Resolver가 확정할 수 있는 범위도
 * 그 데이터 범위로 제한한다.
 */
function resolveLeadSocialWorkerLawVersion(
  params: {
    memory:
      KakaoAiStructuredMemory;

    verifiedCandidates:
      KakaoAiPriorSubjectCandidate[];
  }
): {
  lawVersion:
    SocialWorkerLawVersion;

  resolved:
    boolean;

  unresolvedReasons:
    string[];

  warnings:
    string[];
} {
  const memoryLawVersion =
    normalizeText(
      (
        params.memory as
          KakaoAiStructuredMemory & {
            socialWorkerLawVersion?:
              unknown;
          }
      ).socialWorkerLawVersion
    )
      .toLowerCase();

  /**
   * 이미 서버에서 old/current가 확정되어
   * Memory에 들어간 경우에는
   * 그 값을 가장 우선한다.
   */
  if (
    memoryLawVersion ===
      "old" ||
    memoryLawVersion ===
      "current"
  ) {
    const resolution =
      resolveSocialWorkerRule(
        memoryLawVersion
      );

    return {
      lawVersion:
        resolution.lawVersion,

      resolved:
        resolution.canAnalyzeQualification,

      unresolvedReasons:
        [],

      warnings:
        [],
    };
  }

  /**
   * 서버 검증된 과목 중
   * 사회복지 전환기준 검토 대상만 확인.
   */
  const transitionCandidates =
    params.verifiedCandidates.filter(
      candidate =>
        isSocialWorkerTransitionSubject(
          candidate.subjectName
        )
    );

  /**
   * 2020년 이전에 이수한
   * 검증된 사회복지 관련 과목이 있다면
   * 구법 적용 근거가 존재한다.
   */
  const oldLawEvidence =
    transitionCandidates.filter(
      candidate =>
        candidate.completedYear !==
          null &&
        Number(
          candidate.completedYear
        ) <=
          2019
    );

  if (
    oldLawEvidence.length >
    0
  ) {
    const resolution =
      resolveSocialWorkerRule(
        "old"
      );

    return {
      lawVersion:
        resolution.lawVersion,

      resolved:
        resolution.canAnalyzeQualification,

      unresolvedReasons:
        [],

      warnings: [
        `2020년 이전 사회복지 관련 이수과목 ${oldLawEvidence
          .map(
            item =>
              `${item.subjectName}(${item.completedYear}년)`
          )
          .join(", ")}이 확인되어 사회복지사 2급 구법 기준으로 분석합니다.`,
      ],
    };
  }

  /**
   * 사회복지 관련 검증과목은 있는데
   * 이수연도가 없다면
   * 신법으로 임의 확정하면 안 된다.
   */
  const missingYearCandidates =
    transitionCandidates.filter(
      candidate =>
        candidate.completedYear ===
        null
    );

  if (
    missingYearCandidates.length >
    0
  ) {
    return {
      lawVersion:
        "unselected",

      resolved:
        false,

      unresolvedReasons: [
        `사회복지 관련 기이수과목 ${missingYearCandidates
          .map(
            item =>
              item.subjectName
          )
          .join(", ")}의 이수시기가 확인되지 않아 구법/신법 적용기준을 확정할 수 없습니다.`,
      ],

      warnings:
        [],
    };
  }

  /**
   * 검증된 사회복지 관련 과목이 모두
   * 2020년 이후라면 현재 기준.
   */
  const currentLawEvidence =
    transitionCandidates.filter(
      candidate =>
        candidate.completedYear !==
          null &&
        Number(
          candidate.completedYear
        ) >=
          2020
    );

  if (
    currentLawEvidence.length >
    0
  ) {
    const resolution =
      resolveSocialWorkerRule(
        "current"
      );

    return {
      lawVersion:
        resolution.lawVersion,

      resolved:
        resolution.canAnalyzeQualification,

      unresolvedReasons:
        [],

      warnings:
        [],
    };
  }

  /**
   * 아무 전적대 사회복지 과목도
   * 검증되지 않은 신규 시작자는
   * 현재 시행 기준으로 분석한다.
   *
   * 단,
   * user_reported 과목이 존재하는 경우에는
   * 아래 상위 Resolver에서 pendingSubjects로
   * 별도 노출된다.
   */
  const resolution =
    resolveSocialWorkerRule(
      "current"
    );

  return {
    lawVersion:
      resolution.lawVersion,

    resolved:
      resolution.canAnalyzeQualification,

    unresolvedReasons:
      [],

    warnings:
      [],
  };
}


/**
 * 신규상담 기이수 학업정보 최종 Resolver.
 */
export function resolveKakaoAiLeadPriorAcademic(
  params: {
    memory:
      KakaoAiStructuredMemory;

    /**
     * 현재 카카오 메시지에서
     * 공통 Document Intelligence가
     * 이미 한 번 분석한 결과.
     *
     * 여기서는 Vision을 다시 호출하지 않는다.
     */
    documentIntelligence?:
      DocumentIntelligenceResult |
      null;
  }
): KakaoAiLeadPriorAcademicResolution {
  const memory =
    params.memory;

  const requestedCourse =
    normalizeNullableText(
      memory.desiredCourse
    );

  const courseKey =
    resolveQualificationRiskCourseKey(
      requestedCourse
    );

  const memoryCandidates =
  getPriorSubjectCandidates(
    memory
  );

const documentCandidates =
  getDocumentIntelligenceCandidates(
    params.documentIntelligence
  );

/**
 * Memory에 사용자가 말한 과목과
 * 성적증명서에서 실제 확인된 과목을
 * 같은 후보군으로 합친다.
 *
 * 같은 과목이면 mergeDuplicateCandidates()가
 * 하나로 합치며 verified 상태를 우선한다.
 *
 * 따라서:
 *
 * 사용자:
 * "사회복지학개론 들었어요"
 * → user_reported / pending
 *
 * 이후 성적증명서:
 * 사회복지학개론 확인
 * → document_intelligence / verified
 *
 * 최종:
 * 같은 과목 하나만 recognizedSubjects에 들어간다.
 */
const candidates =
  mergeDuplicateCandidates([
    ...memoryCandidates,
    ...documentCandidates,
  ]);

  /**
   * 서버 검증 완료 과목.
   */
  const verifiedCandidates =
    candidates.filter(
      candidate =>
        candidate.verificationStatus ===
        "verified"
    );

  /**
   * 사용자 발언/OCR 후보지만
   * 아직 인정 확정 전인 과목.
   */
  const pendingSubjects =
    candidates.filter(
      candidate =>
        candidate.verificationStatus !==
        "verified"
    );

  const recognizedSubjects =
    verifiedCandidates.map(
      mapVerifiedSubject
    );

  const unresolvedReasons:
    string[] =
      [];

  const warnings:
    string[] =
      [];

if (
  documentCandidates.length >
  0
) {
  warnings.push(
    `제출된 성적증명서에서 ${documentCandidates.length}개 이수과목을 확인하여 전적대 학습설계에 반영했습니다.`
  );
}

if (
  params.documentIntelligence &&
  params.documentIntelligence
    .documentType ===
    "transcript" &&
  documentCandidates.length ===
    0
) {
  warnings.push(
    "성적증명서는 확인했지만 문서 판독 신뢰도 또는 증빙 기준이 충분하지 않아 인정과목 계산에는 자동 반영하지 않았습니다."
  );
}

  /**
   * 사용자가 기이수과목을 말했지만
   * 아직 서버 검증이 안 됐다면
   * 인정과목 계산에 넣지 않는다.
   */
  if (
    pendingSubjects.length >
    0
  ) {
    warnings.push(
      `기이수과목 ${pendingSubjects
        .map(
          subject =>
            subject.subjectName
        )
        .join(", ")}은 아직 인정여부가 확정되지 않아 현재 학습설계의 인정과목 계산에서는 제외합니다.`
    );
  }

  let socialWorkerLawVersion:
    SocialWorkerLawVersion | null =
      null;

  let socialWorkerLawResolved =
    true;

  /**
   * 사회복지사 과정에서만
   * 구법/신법을 판정한다.
   */
  if (
    courseKey ===
    "social_worker_2"
  ) {
    const lawResolution =
      resolveLeadSocialWorkerLawVersion({
        memory,

        verifiedCandidates,
      });

    socialWorkerLawVersion =
      lawResolution.lawVersion;

    socialWorkerLawResolved =
      lawResolution.resolved;

    unresolvedReasons.push(
      ...lawResolution
        .unresolvedReasons
    );

    warnings.push(
      ...lawResolution
        .warnings
    );
  }

  return {
    requestedCourse,

    courseKey,

    recognizedSubjects,

    pendingSubjects,

    socialWorkerLawVersion,

    socialWorkerLawResolved,

    unresolvedReasons:
      uniqueStrings(
        unresolvedReasons
      ),

    warnings:
      uniqueStrings(
        warnings
      ),
  };
}