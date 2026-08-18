import * as db from "../db";

import type {
  KakaoAiConversationMessage,
} from "./kakao-ai-intent-router";


export type KakaoAiPriorSubjectVerificationStatus =
  | "user_reported"
  | "verified"
  | "rejected";

export type KakaoAiPriorSubjectSource =
  | "user"
  | "ocr"
  | "crm";

export type KakaoAiPriorSubjectCandidate = {
  subjectName:
    string;

  completedYear:
    number | null;

  credits:
    number | null;

  source:
    KakaoAiPriorSubjectSource;

  verificationStatus:
    KakaoAiPriorSubjectVerificationStatus;
};

export const KAKAO_AI_PRIOR_SUBJECT_FACT_PREFIX =
  "[KAKAO_PRIOR_SUBJECT]";


export type KakaoAiPriorCreditBankSemester = {
  year:
    number;

  semesterHalf:
    1 | 2;

  subjectCount:
    number;

  source:
    KakaoAiPriorSubjectSource;

  verificationStatus:
    KakaoAiPriorSubjectVerificationStatus;
};

export const KAKAO_AI_PRIOR_CREDIT_BANK_SEMESTER_FACT_PREFIX =
  "[KAKAO_PRIOR_CREDIT_BANK_SEMESTER]";

export const KAKAO_AI_DESIRED_STUDY_START_DATE_FACT_PREFIX =
  "[KAKAO_STUDY_START_DATE]";

export type KakaoAiDesiredStudyStartDateFact = {
  date:
    string;

  source:
    KakaoAiPriorSubjectSource;
};
/**
 * 카카오 AI가 대화를 이해할 때 사용하는
 * 구조화 Memory.
 *
 * DB에 저장된 암호화 데이터를
 * db.ts가 복호화한 뒤
 * 이 형태로 정리한다.
 */
export type KakaoAiStructuredMemory = {
  desiredCourse:
    string | null;

  finalEducation:
    string | null;

  hasTransferCollege:
    boolean | null;

  /**
   * 사회복지사 2급 적용기준.
   *
   * old:
   * 구법 대상이 서버에서 확정됨
   *
   * current:
   * 현행 기준 대상이 서버에서 확정됨
   *
   * null:
   * 아직 판단 불가
   */
  socialWorkerLawVersion:
    "old" |
    "current" |
    null;

  verifiedFacts:
  string[];

/**
 * 사용자가 말했거나
 * OCR / CRM으로 확인된
 * 이전 이수과목.
 *
 * user_reported 상태는
 * 실제 인정과목 계산에 바로 넣지 않는다.
 */
priorSubjectCandidates:
  KakaoAiPriorSubjectCandidate[];

priorCreditBankSemesters:
  KakaoAiPriorCreditBankSemester[];

/**
 * 신규상담자가 실제로 희망한다고 밝힌
 * 학습 시작 기준일.
 *
 * YYYY-MM-DD.
 *
 * null이면 별도 시작시점을 말하지 않은 것이므로
 * 공통 Semester Planner가 오늘 KST를 사용한다.
 */
desiredStudyStartDate:
  string | null;

unresolvedQuestions:
  string[];

  currentTopic:
    string | null;
};

/**
 * 카카오 AI 최근 메시지.
 *
 * Intent Classifier에서 이미 사용하는
 * KakaoAiConversationMessage 형태로 맞춘다.
 */
export type KakaoAiRecentConversation = {
  conversationId:
    number;

  messages:
    KakaoAiConversationMessage[];
};

/**
 * 카카오 AI가 한 번의 요청을 처리할 때
 * 사용할 전체 대화 Memory Context.
 */
export type KakaoAiMemoryContext = {
  organizationId:
    number;

  conversationId:
    number;

  recentConversation:
    KakaoAiRecentConversation;

  structuredMemory:
    KakaoAiStructuredMemory;
};

function normalizePositiveInteger(
  value:
    unknown,

  fieldLabel:
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
      `${fieldLabel} 정보가 올바르지 않습니다.`
    );
  }

  return normalized;
}

function normalizeNullableText(
  value:
    unknown
): string | null {
  const normalized =
    String(
      value ??
      ""
    ).trim();

  return normalized ||
    null;
}

function normalizeIsoDate(
  value:
    unknown
): string | null {
  const normalized =
    String(
      value ??
      ""
    ).trim();

  const matched =
    normalized.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (!matched) {
    return null;
  }

  const year =
    Number(
      matched[1]
    );

  const month =
    Number(
      matched[2]
    );

  const day =
    Number(
      matched[3]
    );

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  if (
    date.getUTCFullYear() !==
      year ||
    date.getUTCMonth() + 1 !==
      month ||
    date.getUTCDate() !==
      day
  ) {
    return null;
  }

  return `${String(
    year
  ).padStart(
    4,
    "0"
  )}-${String(
    month
  ).padStart(
    2,
    "0"
  )}-${String(
    day
  ).padStart(
    2,
    "0"
  )}`;
}

function normalizeFinalEducation(
  value:
    unknown
): string | null {
  const raw =
    String(
      value ??
      ""
    )
      .trim();

  if (
    !raw
  ) {
    return null;
  }

  const normalized =
    raw
      .replace(
        /\s+/g,
        ""
      )
      .toLowerCase();

/**
 * 초등학교 졸업
 */
if (
  normalized ===
    "초졸" ||
  normalized.includes(
    "초등학교졸업"
  )
) {
  return "초졸";
}

  /**
   * 중학교 졸업
   */
  if (
    normalized ===
      "중졸" ||
    normalized.includes(
      "중학교졸업"
    )
  ) {
    return "중졸";
  }

  /**
   * 고등학교 졸업 / 검정고시
   */
  if (
    normalized ===
      "고졸" ||
    normalized.includes(
      "고등학교졸업"
    ) ||
    normalized.includes(
      "고등학교검정고시"
    ) ||
    normalized.includes(
      "고졸검정고시"
    )
  ) {
    return "고졸";
  }

  /**
   * 전문대 졸업
   */
  if (
    normalized ===
      "전문대졸" ||
    normalized.includes(
      "전문대졸업"
    ) ||
    normalized.includes(
      "전문학사"
    ) ||
    normalized.includes(
      "2년제졸업"
    ) ||
    normalized.includes(
      "3년제졸업"
    )
  ) {
    return "전문대졸";
  }

  /**
   * 4년제 대학교 졸업
   */
  if (
    normalized ===
      "대졸" ||
    normalized ===
      "4년제졸" ||
    normalized.includes(
      "4년제졸업"
    ) ||
    normalized.includes(
      "대학교졸업"
    ) ||
    normalized ===
      "학사"
  ) {
    return "대졸";
  }

  /**
   * 중퇴 / 재학 / 휴학은
   * 최종학력을 임의로 대학 졸업으로 올리지 않는다.
   *
   * Extractor에서 이미 finalEducation 여부를
   * 판단한 결과만 여기 들어오므로
   * 알 수 없는 값은 원문을 보존한다.
   */
  return raw;
}

function normalizeStringArray(
  value:
    unknown
): string[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  const result:
    string[] =
    [];

  const seen =
    new Set<string>();

  for (
    const item of
    value
  ) {
    const normalized =
      String(
        item ??
        ""
      ).trim();

    if (
      !normalized ||
      seen.has(
        normalized
      )
    ) {
      continue;
    }

    seen.add(
      normalized
    );

    result.push(
      normalized
    );
  }

  return result;
}

export function encodeKakaoAiPriorSubjectFact(
  subject:
    KakaoAiPriorSubjectCandidate
): string {
  const subjectName =
    String(
      subject.subjectName ||
      ""
    ).trim();

  if (
    !subjectName
  ) {
    return "";
  }

  const completedYear =
    Number.isFinite(
      Number(
        subject.completedYear
      )
    ) &&
    Number(
      subject.completedYear
    ) >=
      1900 &&
    Number(
      subject.completedYear
    ) <=
      2100
      ? Math.floor(
          Number(
            subject.completedYear
          )
        )
      : null;

  const credits =
    Number.isFinite(
      Number(
        subject.credits
      )
    ) &&
    Number(
      subject.credits
    ) >
      0
      ? Number(
          subject.credits
        )
      : null;

  const source:
    KakaoAiPriorSubjectSource =
    subject.source ===
      "ocr" ||
    subject.source ===
      "crm"
      ? subject.source
      : "user";

  const verificationStatus:
    KakaoAiPriorSubjectVerificationStatus =
    subject.verificationStatus ===
      "verified" ||
    subject.verificationStatus ===
      "rejected"
      ? subject.verificationStatus
      : "user_reported";

  return (
    KAKAO_AI_PRIOR_SUBJECT_FACT_PREFIX +
    JSON.stringify({
      subjectName,
      completedYear,
      credits,
      source,
      verificationStatus,
    })
  );
}

export function decodeKakaoAiPriorSubjectFact(
  value:
    unknown
): KakaoAiPriorSubjectCandidate | null {
  const raw =
    String(
      value ??
      ""
    ).trim();

  if (
    !raw.startsWith(
      KAKAO_AI_PRIOR_SUBJECT_FACT_PREFIX
    )
  ) {
    return null;
  }

  const jsonText =
    raw.slice(
      KAKAO_AI_PRIOR_SUBJECT_FACT_PREFIX.length
    );

  try {
    const parsed =
      JSON.parse(
        jsonText
      ) as
        Record<
          string,
          unknown
        >;

    const subjectName =
      String(
        parsed.subjectName ??
        ""
      ).trim();

    if (
      !subjectName
    ) {
      return null;
    }

    const completedYearRaw =
      Number(
        parsed.completedYear
      );

    const completedYear =
      Number.isFinite(
        completedYearRaw
      ) &&
      completedYearRaw >=
        1900 &&
      completedYearRaw <=
        2100
        ? Math.floor(
            completedYearRaw
          )
        : null;

    const creditsRaw =
      Number(
        parsed.credits
      );

    const credits =
      Number.isFinite(
        creditsRaw
      ) &&
      creditsRaw >
        0
        ? creditsRaw
        : null;

    const source:
      KakaoAiPriorSubjectSource =
      parsed.source ===
        "ocr" ||
      parsed.source ===
        "crm"
        ? parsed.source
        : "user";

    const verificationStatus:
      KakaoAiPriorSubjectVerificationStatus =
      parsed.verificationStatus ===
        "verified" ||
      parsed.verificationStatus ===
        "rejected"
        ? parsed.verificationStatus
        : "user_reported";

    return {
      subjectName,
      completedYear,
      credits,
      source,
      verificationStatus,
    };
  } catch {
    return null;
  }
}

export function encodeKakaoAiPriorCreditBankSemesterFact(
  semester:
    KakaoAiPriorCreditBankSemester
): string {
  const year =
    Math.floor(
      Number(
        semester.year
      )
    );

  if (
    !Number.isFinite(
      year
    ) ||
    year < 1900 ||
    year > 2100
  ) {
    return "";
  }

  const semesterHalf:
    1 | 2 =
    semester.semesterHalf === 2
      ? 2
      : 1;

  const subjectCount =
    Math.floor(
      Number(
        semester.subjectCount
      )
    );

  if (
    !Number.isFinite(
      subjectCount
    ) ||
    subjectCount <= 0 ||
subjectCount > 8
  ) {
    return "";
  }

  const source:
    KakaoAiPriorSubjectSource =
    semester.source === "ocr" ||
    semester.source === "crm"
      ? semester.source
      : "user";

  const verificationStatus:
    KakaoAiPriorSubjectVerificationStatus =
    semester.verificationStatus === "verified" ||
    semester.verificationStatus === "rejected"
      ? semester.verificationStatus
      : "user_reported";

  return (
    KAKAO_AI_PRIOR_CREDIT_BANK_SEMESTER_FACT_PREFIX +
    JSON.stringify({
      year,
      semesterHalf,
      subjectCount,
      source,
      verificationStatus,
    })
  );
}

export function decodeKakaoAiPriorCreditBankSemesterFact(
  value:
    unknown
): KakaoAiPriorCreditBankSemester | null {
  const raw =
    String(
      value ??
      ""
    ).trim();

  if (
    !raw.startsWith(
      KAKAO_AI_PRIOR_CREDIT_BANK_SEMESTER_FACT_PREFIX
    )
  ) {
    return null;
  }

  const jsonText =
    raw.slice(
      KAKAO_AI_PRIOR_CREDIT_BANK_SEMESTER_FACT_PREFIX.length
    );

  try {
    const parsed =
      JSON.parse(
        jsonText
      ) as Record<
        string,
        unknown
      >;

    const year =
      Math.floor(
        Number(
          parsed.year
        )
      );

    if (
      !Number.isFinite(
        year
      ) ||
      year < 1900 ||
      year > 2100
    ) {
      return null;
    }

    const semesterHalfRaw =
      Number(
        parsed.semesterHalf
      );

    if (
      semesterHalfRaw !== 1 &&
      semesterHalfRaw !== 2
    ) {
      return null;
    }

    const semesterHalf:
      1 | 2 =
      semesterHalfRaw;

    const subjectCount =
      Math.floor(
        Number(
          parsed.subjectCount
        )
      );

    if (
      !Number.isFinite(
        subjectCount
      ) ||
      subjectCount <= 0 ||
subjectCount > 8
    ) {
      return null;
    }

    const source:
      KakaoAiPriorSubjectSource =
      parsed.source === "ocr" ||
      parsed.source === "crm"
        ? parsed.source
        : "user";

    const verificationStatus:
      KakaoAiPriorSubjectVerificationStatus =
      parsed.verificationStatus === "verified" ||
      parsed.verificationStatus === "rejected"
        ? parsed.verificationStatus
        : "user_reported";

    return {
      year,
      semesterHalf,
      subjectCount,
      source,
      verificationStatus,
    };
  } catch {
    return null;
  }
}

export function encodeKakaoAiDesiredStudyStartDateFact(
  fact:
    KakaoAiDesiredStudyStartDateFact
): string {
  const date =
    normalizeIsoDate(
      fact.date
    );

  if (!date) {
    return "";
  }

  const source:
    KakaoAiPriorSubjectSource =
    fact.source === "ocr" ||
    fact.source === "crm"
      ? fact.source
      : "user";

  return (
    KAKAO_AI_DESIRED_STUDY_START_DATE_FACT_PREFIX +
    JSON.stringify({
      date,
      source,
    })
  );
}


export function decodeKakaoAiDesiredStudyStartDateFact(
  value:
    unknown
): KakaoAiDesiredStudyStartDateFact | null {
  const raw =
    String(
      value ??
      ""
    ).trim();

  if (
    !raw.startsWith(
      KAKAO_AI_DESIRED_STUDY_START_DATE_FACT_PREFIX
    )
  ) {
    return null;
  }

  const jsonText =
    raw.slice(
      KAKAO_AI_DESIRED_STUDY_START_DATE_FACT_PREFIX.length
    );

  try {
    const parsed =
      JSON.parse(
        jsonText
      ) as Record<
        string,
        unknown
      >;

    const date =
      normalizeIsoDate(
        parsed.date
      );

    if (!date) {
      return null;
    }

    const source:
      KakaoAiPriorSubjectSource =
      parsed.source === "ocr" ||
      parsed.source === "crm"
        ? parsed.source
        : "user";

    return {
      date,
      source,
    };
  } catch {
    return null;
  }
}

/**
 * DB Memory 결과를
 * AI가 사용하기 쉬운 형태로 정규화한다.
 */
function normalizeStructuredMemory(
  memory:
    db.KakaoAiConversationMemory
): KakaoAiStructuredMemory {
  const verifiedFacts =
    normalizeStringArray(
      memory.verifiedFacts
    );

  const priorSubjectCandidates =
    verifiedFacts
      .map(
        (
          fact
        ) =>
          decodeKakaoAiPriorSubjectFact(
            fact
          )
      )
      .filter(
        (
          subject
        ): subject is
          KakaoAiPriorSubjectCandidate =>
          Boolean(
            subject
          )
      );

const priorCreditBankSemesters =
  verifiedFacts
    .map(
      (
        fact
      ) =>
        decodeKakaoAiPriorCreditBankSemesterFact(
          fact
        )
    )
    .filter(
      (
        semester
      ): semester is
        KakaoAiPriorCreditBankSemester =>
        Boolean(
          semester
        )
    );

const desiredStudyStartDate =
  verifiedFacts
    .map(
      fact =>
        decodeKakaoAiDesiredStudyStartDateFact(
          fact
        )
    )
    .filter(
      (
        fact
      ): fact is
        KakaoAiDesiredStudyStartDateFact =>
        Boolean(
          fact
        )
    )
    .at(
      -1
    )
    ?.date ??
  null;

  return {
    desiredCourse:
      normalizeNullableText(
        memory.desiredCourse
      ),

    finalEducation:
  normalizeFinalEducation(
    memory.finalEducation
  ),

    hasTransferCollege:
      memory.hasTransferCollege ===
        true
        ? true
        : memory.hasTransferCollege ===
            false
          ? false
          : null,

socialWorkerLawVersion:
  memory.socialWorkerLawVersion ===
    "old" ||
  memory.socialWorkerLawVersion ===
    "current"
    ? memory.socialWorkerLawVersion
    : null,

    verifiedFacts,

priorSubjectCandidates,

priorCreditBankSemesters,

desiredStudyStartDate,

    unresolvedQuestions:
      normalizeStringArray(
        memory.unresolvedQuestions
      ),

    currentTopic:
      normalizeNullableText(
        memory.currentTopic
      ),
  };
}

/**
 * DB의 최근 카카오 메시지를
 * Intent Classifier가 바로 사용할 수 있는
 * role/content 형태로 변환한다.
 *
 * image / document 메시지의 실제 첨부 내용은
 * 이후 Attachment Resolver가 담당한다.
 *
 * 여기서는 텍스트 대화 흐름만 유지한다.
 */
function normalizeConversationMessages(
  rows:
    Awaited<
      ReturnType<
        typeof db.getKakaoAiRecentMessages
      >
    >
): KakaoAiConversationMessage[] {
  const messages:
    KakaoAiConversationMessage[] =
    [];

  for (
    const row of
    rows
  ) {
    const content =
      String(
        row.content ??
        ""
      ).trim();

    /**
     * text가 비어 있고 첨부만 있는 메시지는
     * 대화 맥락을 잃지 않도록
     * 최소한의 표시문구를 사용한다.
     *
     * 실제 이미지 내용 추측은 하지 않는다.
     */
    const normalizedContent =
      content ||
      (
        row.messageType ===
          "image"
          ? "[사용자가 이미지를 보냈습니다.]"
          : row.messageType ===
              "document"
            ? "[사용자가 문서를 보냈습니다.]"
            : ""
      );

    if (
      !normalizedContent
    ) {
      continue;
    }

    messages.push({
      role:
        row.role,

      content:
        normalizedContent,
    });
  }

  return messages;
}

/**
 * 현재 카카오 대화의
 * 최근 메시지 + 구조화 Memory를 읽는다.
 *
 * DB 읽기 전용.
 *
 * 여기서는:
 * - Memory 수정 X
 * - Intent 분석 X
 * - 공통엔진 실행 X
 * - 학생 조회 X
 * - 실습센터 조회 X
 */
export async function resolveKakaoAiMemoryContext(
  params: {
    organizationId:
      number;

    conversationId:
      number;

    /**
     * 기본 20개.
     *
     * 너무 많은 원본 채팅을 매번 모델에
     * 전달하지 않도록 제한한다.
     */
    recentMessageLimit?:
      number;
  }
): Promise<KakaoAiMemoryContext> {
  const organizationId =
    normalizePositiveInteger(
      params.organizationId,
      "카카오 AI 회사"
    );

  const conversationId =
    normalizePositiveInteger(
      params.conversationId,
      "카카오 AI 대화"
    );

  const recentMessageLimit =
    Math.min(
      Math.max(
        Math.floor(
          Number(
            params.recentMessageLimit ||
            20
          )
        ),
        1
      ),
      50
    );

  const [
    recentRows,
    memory,
  ] = await Promise.all([
    db.getKakaoAiRecentMessages({
      organizationId,

      conversationId,

      limit:
        recentMessageLimit,
    }),

    db.getKakaoAiConversationMemory({
      organizationId,

      conversationId,
    }),
  ]);

  const messages =
    normalizeConversationMessages(
      recentRows
    );

  return {
    organizationId,

    conversationId,

    recentConversation: {
      conversationId,

      messages,
    },

    structuredMemory:
      normalizeStructuredMemory(
        memory
      ),
  };
}

/**
 * Intent Classifier에게 전달할
 * 대화 히스토리만 꺼내는 helper.
 */
export function getKakaoAiIntentConversationHistory(
  memoryContext:
    KakaoAiMemoryContext
): KakaoAiConversationMessage[] {
  return (
    memoryContext
      .recentConversation
      .messages
  );
}

/**
 * Structured Memory를 모델에게 전달할 때 사용할
 * 안전한 JSON 구조.
 *
 * 고객에게 그대로 출력하는 답변은 아니다.
 */
export function buildKakaoAiStructuredMemoryInput(
  memoryContext:
    KakaoAiMemoryContext
): string {
  return JSON.stringify(
    {
      desiredCourse:
        memoryContext
          .structuredMemory
          .desiredCourse,

      finalEducation:
        memoryContext
          .structuredMemory
          .finalEducation,

      hasTransferCollege:
        memoryContext
          .structuredMemory
          .hasTransferCollege,

socialWorkerLawVersion:
  memoryContext
    .structuredMemory
    .socialWorkerLawVersion,

      verifiedFacts:
        memoryContext
          .structuredMemory
          .verifiedFacts,

priorSubjectCandidates:
  memoryContext
    .structuredMemory
    .priorSubjectCandidates,

priorCreditBankSemesters:
  memoryContext
    .structuredMemory
    .priorCreditBankSemesters,

desiredStudyStartDate:
  memoryContext
    .structuredMemory
    .desiredStudyStartDate,

      unresolvedQuestions:
        memoryContext
          .structuredMemory
          .unresolvedQuestions,

      currentTopic:
        memoryContext
          .structuredMemory
          .currentTopic,
    }
  );
}