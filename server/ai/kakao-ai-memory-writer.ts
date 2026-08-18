import * as db from "../db";

import {
  encodeKakaoAiPriorSubjectFact,
  decodeKakaoAiPriorSubjectFact,

  encodeKakaoAiPriorCreditBankSemesterFact,
  decodeKakaoAiPriorCreditBankSemesterFact,

  encodeKakaoAiDesiredStudyStartDateFact,
  decodeKakaoAiDesiredStudyStartDateFact,

  type KakaoAiStructuredMemory,
  type KakaoAiPriorSubjectCandidate,
  type KakaoAiPriorCreditBankSemester,
} from "./kakao-ai-memory-resolver";

/**
 * Memory에 저장되는 사실의 출처.
 *
 * user:
 * 사용자가 직접 명확하게 말한 사실
 *
 * ocr:
 * 성적증명서 등 첨부자료 분석으로 확인된 사실
 *
 * crm:
 * 등록회원 CRM에서 확인된 사실
 *
 * rule_engine:
 * 공통 규칙엔진이 계산/확정한 사실
 */
export type KakaoAiMemoryFactSource =
  | "user"
  | "ocr"
  | "crm"
  | "rule_engine";

/**
 * Memory에 반영 가능한
 * 검증된 하나의 사실.
 */
export type KakaoAiVerifiedMemoryFact = {
  source:
    KakaoAiMemoryFactSource;

  key:
    string;

  value:
    string;

  /**
   * 사람이 읽을 수 있는 사실 설명.
   *
   * verifiedFacts에 저장할 때 사용한다.
   */
  description:
    string;
};

/**
 * 한 번의 대화 처리 후
 * Memory에 반영할 안전한 Patch.
 *
 * 이 객체 자체를 OpenAI가 직접 DB에 쓰지 않는다.
 * 서버가 검증한 뒤 db.ts를 호출한다.
 */
export type KakaoAiMemoryWritePatch = {
  desiredCourse?:
    string | null;

  finalEducation?:
    string | null;

  hasTransferCollege?:
    boolean | null;

socialWorkerLawVersion?:
  "old" |
  "current" |
  null;

/**
 * 사용자가 희망한다고 직접 밝힌
 * 실제 학습 시작 기준일.
 *
 * YYYY-MM-DD.
 *
 * undefined:
 * 이번 대화에서 변경 없음
 *
 * null:
 * 사용자가 기존 시작희망일을 명확하게 취소/초기화
 */
desiredStudyStartDate?:
  string | null;

  /**
   * 새로 확정된 사실만.
   */
  verifiedFactsToAdd?:
    KakaoAiVerifiedMemoryFact[];

/**
 * 사용자가 직접 말했거나
 * OCR / CRM에서 확인된
 * 전적대 기이수과목.
 *
 * 같은 과목명은 새 행을 계속 추가하지 않고
 * 기존 후보를 갱신한다.
 */
priorSubjectCandidatesToUpsert?:
  KakaoAiPriorSubjectCandidate[];

/**
 * 다른 교육원 / 기존 학점은행제
 * 수강학기 이력.
 *
 * 같은 연도 + 같은 학기는
 * 새 행을 계속 추가하지 않고 갱신한다.
 */
priorCreditBankSemestersToUpsert?:
  KakaoAiPriorCreditBankSemester[];

  /**
   * 더 이상 미확인이 아닌 질문.
   */
  resolvedQuestionKeys?:
    string[];

  /**
   * 새로 확인이 필요한 내용.
   */
  unresolvedQuestionKeys?:
    string[];

  /**
   * 현재 대화 중심주제.
   */
  currentTopic?:
    string | null;
};

export type KakaoAiMemoryWriteResult = {
  success:
    boolean;

  changed:
    boolean;

  memory:
    KakaoAiStructuredMemory;
};

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

function normalizeFinalEducation(
  value:
    unknown
): string | null {
  const raw =
    String(
      value ??
      ""
    ).trim();

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

if (
  normalized ===
    "초졸" ||
  normalized.includes(
    "초등학교졸업"
  )
) {
  return "초졸";
}

  if (
    normalized ===
      "중졸" ||
    normalized.includes(
      "중학교졸업"
    )
  ) {
    return "중졸";
  }

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

  return raw;
}

function normalizeStringArray(
  value:
    unknown,

  limit:
    number
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

    if (
      result.length >=
      limit
    ) {
      break;
    }
  }

  return result;
}

function normalizeFactDescription(
  fact:
    KakaoAiVerifiedMemoryFact
): string | null {
  const source =
    String(
      fact.source ||
      ""
    ).trim();

  if (
    source !==
      "user" &&
    source !==
      "ocr" &&
    source !==
      "crm" &&
    source !==
      "rule_engine"
  ) {
    return null;
  }

  const description =
    normalizeNullableText(
      fact.description
    );

  if (
    !description
  ) {
    return null;
  }

  return description;
}

/**
 * 기존 사실과 신규 사실을 합친다.
 *
 * 완전히 동일한 문장은 중복 저장하지 않는다.
 */
function mergeVerifiedFacts(
  existing:
    string[],

  factsToAdd:
    KakaoAiVerifiedMemoryFact[]
): string[] {
  const result =
    normalizeStringArray(
      existing,
      100
    );

  const seen =
    new Set(
      result
    );

  for (
    const fact of
    factsToAdd
  ) {
    const description =
      normalizeFactDescription(
        fact
      );

    if (
      !description ||
      seen.has(
        description
      )
    ) {
      continue;
    }

    seen.add(
      description
    );

    result.push(
      description
    );

    if (
      result.length >=
      100
    ) {
      break;
    }
  }

  return result;
}

function normalizePriorSubjectName(
  value:
    unknown
): string {
  return String(
    value ??
    ""
  )
    .trim()
    .replace(
      /\s+/g,
      ""
    )
    .toLowerCase();
}

function mergePriorSubjectCandidates(
  existingFacts:
    string[],

  subjectsToUpsert:
    KakaoAiPriorSubjectCandidate[]
): string[] {
  const normalFacts:
    string[] =
    [];

  const subjectMap =
    new Map<
      string,
      KakaoAiPriorSubjectCandidate
    >();

  for (
    const fact of
    normalizeStringArray(
      existingFacts,
      100
    )
  ) {
    const priorSubject =
      decodeKakaoAiPriorSubjectFact(
        fact
      );

    if (
      !priorSubject
    ) {
      normalFacts.push(
        fact
      );

      continue;
    }

    const key =
      normalizePriorSubjectName(
        priorSubject
          .subjectName
      );

    if (
      key
    ) {
      subjectMap.set(
        key,
        priorSubject
      );
    }
  }

  for (
    const incoming of
    subjectsToUpsert
  ) {
    const subjectName =
      String(
        incoming.subjectName ||
        ""
      ).trim();

    if (
      !subjectName
    ) {
      continue;
    }

    const key =
      normalizePriorSubjectName(
        subjectName
      );

    const existing =
      subjectMap.get(
        key
      );

    const next:
      KakaoAiPriorSubjectCandidate = {
      subjectName,

      completedYear:
        incoming.completedYear ??
        existing?.completedYear ??
        null,

      credits:
        incoming.credits ??
        existing?.credits ??
        null,

      source:
        incoming.source ||
        existing?.source ||
        "user",

      verificationStatus:
        incoming.verificationStatus ||
        existing
          ?.verificationStatus ||
        "user_reported",
    };

    subjectMap.set(
      key,
      next
    );
  }

  const encodedSubjects =
    Array.from(
      subjectMap.values()
    )
      .map(
        encodeKakaoAiPriorSubjectFact
      )
      .filter(
        Boolean
      );

  return [
    ...normalFacts,
    ...encodedSubjects,
  ].slice(
    0,
    100
  );
}

function mergePriorCreditBankSemesters(
  existingFacts:
    string[],

  semestersToUpsert:
    KakaoAiPriorCreditBankSemester[]
): string[] {
  const normalFacts:
    string[] =
    [];

  const semesterMap =
    new Map<
      string,
      KakaoAiPriorCreditBankSemester
    >();

  for (
    const fact of
    normalizeStringArray(
      existingFacts,
      100
    )
  ) {
    const semester =
      decodeKakaoAiPriorCreditBankSemesterFact(
        fact
      );

    if (
      !semester
    ) {
      normalFacts.push(
        fact
      );

      continue;
    }

    const key =
      `${semester.year}-${semester.semesterHalf}`;

    semesterMap.set(
      key,
      semester
    );
  }

  for (
    const incoming of
    semestersToUpsert
  ) {
    const year =
      Math.floor(
        Number(
          incoming.year
        )
      );

    const semesterHalf =
      incoming.semesterHalf ===
        2
        ? 2
        : 1;

    const subjectCount =
      Math.floor(
        Number(
          incoming.subjectCount
        )
      );

    if (
      !Number.isFinite(
        year
      ) ||
      year < 1900 ||
      year > 2100 ||
      !Number.isFinite(
        subjectCount
      ) ||
      subjectCount <= 0 ||
subjectCount > 8
    ) {
      continue;
    }

    const key =
      `${year}-${semesterHalf}`;

    const existing =
      semesterMap.get(
        key
      );

    const next:
      KakaoAiPriorCreditBankSemester = {
      year,

      semesterHalf,

      subjectCount,

      source:
        incoming.source ||
        existing?.source ||
        "user",

      verificationStatus:
        incoming.verificationStatus ||
        existing
          ?.verificationStatus ||
        "user_reported",
    };

    semesterMap.set(
      key,
      next
    );
  }

  const encodedSemesters =
    Array.from(
      semesterMap.values()
    )
      .map(
        encodeKakaoAiPriorCreditBankSemesterFact
      )
      .filter(
        Boolean
      );

  return [
    ...normalFacts,
    ...encodedSemesters,
  ].slice(
    0,
    100
  );
}

/**
 * 미확인 질문을 추가/해결한다.
 */
function mergeUnresolvedQuestions(
  existing:
    string[],

  add:
    string[],

  resolve:
    string[]
): string[] {
  const resolvedSet =
    new Set(
      normalizeStringArray(
        resolve,
        50
      )
    );

  const result:
    string[] =
    [];

  const seen =
    new Set<string>();

  const candidates = [
    ...normalizeStringArray(
      existing,
      50
    ),

    ...normalizeStringArray(
      add,
      50
    ),
  ];

  for (
    const item of
    candidates
  ) {
    if (
      resolvedSet.has(
        item
      ) ||
      seen.has(
        item
      )
    ) {
      continue;
    }

    seen.add(
      item
    );

    result.push(
      item
    );

    if (
      result.length >=
      50
    ) {
      break;
    }
  }

  return result;
}

function mergeDesiredStudyStartDate(
  existingFacts:
    string[],

  desiredStudyStartDate:
    string | null | undefined
): string[] {
  const normalFacts =
    normalizeStringArray(
      existingFacts,
      100
    ).filter(
      fact =>
        !decodeKakaoAiDesiredStudyStartDateFact(
          fact
        )
    );

  /**
   * undefined:
   * 현재 시작일 Memory 유지.
   */
  if (
    desiredStudyStartDate ===
      undefined
  ) {
    return normalizeStringArray(
      existingFacts,
      100
    );
  }

  /**
   * null:
   * 기존 시작희망일 삭제.
   */
  if (
    desiredStudyStartDate ===
      null
  ) {
    return normalFacts;
  }

  const encoded =
    encodeKakaoAiDesiredStudyStartDateFact({
      date:
        desiredStudyStartDate,

      source:
        "user",
    });

  if (!encoded) {
    return normalizeStringArray(
      existingFacts,
      100
    );
  }

  return [
    ...normalFacts,
    encoded,
  ].slice(
    0,
    100
  );
}

/**
 * 서버가 검증한 Memory Patch를 실제 DB에 반영한다.
 *
 * 중요:
 * 이 함수에는 AI의 추측값을 직접 넘기면 안 된다.
 *
 * caller는 반드시:
 * - 사용자 직접 발언
 * - OCR 확정
 * - CRM 확정
 * - 공통엔진 확정
 *
 * 중 하나로 검증된 값만 전달한다.
 */
export async function applyKakaoAiVerifiedMemoryPatch(
  params: {
    organizationId:
      number;

    conversationId:
      number;

    currentMemory:
      KakaoAiStructuredMemory;

    patch:
      KakaoAiMemoryWritePatch;
  }
): Promise<KakaoAiMemoryWriteResult> {
  const current =
    params.currentMemory;

  const patch =
    params.patch;

  const desiredCourse =
    patch.desiredCourse ===
      undefined
      ? current.desiredCourse
      : normalizeNullableText(
          patch.desiredCourse
        );

  const finalEducation =
  patch.finalEducation ===
    undefined
    ? normalizeFinalEducation(
        current.finalEducation
      )
    : normalizeFinalEducation(
        patch.finalEducation
      );

  const hasTransferCollege =
    patch.hasTransferCollege ===
      undefined
      ? current.hasTransferCollege
      : patch.hasTransferCollege ===
          true
        ? true
        : patch.hasTransferCollege ===
            false
          ? false
          : null;

const socialWorkerLawVersion =
  patch.socialWorkerLawVersion ===
    undefined
    ? current.socialWorkerLawVersion
    : patch.socialWorkerLawVersion ===
        "old" ||
      patch.socialWorkerLawVersion ===
        "current"
      ? patch.socialWorkerLawVersion
      : null;

  const verifiedFacts =
    mergeVerifiedFacts(
      current.verifiedFacts,

      Array.isArray(
        patch.verifiedFactsToAdd
      )
        ? patch.verifiedFactsToAdd
        : []
    );

const verifiedFactsWithPriorSubjects =
  mergePriorSubjectCandidates(
    verifiedFacts,

    Array.isArray(
      patch
        .priorSubjectCandidatesToUpsert
    )
      ? patch
          .priorSubjectCandidatesToUpsert
      : []
  );

const verifiedFactsWithPriorSemesters =
  mergePriorCreditBankSemesters(
    verifiedFactsWithPriorSubjects,

    Array.isArray(
      patch
        .priorCreditBankSemestersToUpsert
    )
      ? patch
          .priorCreditBankSemestersToUpsert
      : []
  );

const verifiedFactsWithStudyStartDate =
  mergeDesiredStudyStartDate(
    verifiedFactsWithPriorSemesters,
    patch.desiredStudyStartDate
  );

  const unresolvedQuestions =
    mergeUnresolvedQuestions(
      current.unresolvedQuestions,

      Array.isArray(
        patch.unresolvedQuestionKeys
      )
        ? patch.unresolvedQuestionKeys
        : [],

      Array.isArray(
        patch.resolvedQuestionKeys
      )
        ? patch.resolvedQuestionKeys
        : []
    );

  const currentTopic =
    patch.currentTopic ===
      undefined
      ? current.currentTopic
      : normalizeNullableText(
          patch.currentTopic
        );

  const nextMemory:
    KakaoAiStructuredMemory = {
      desiredCourse,

      finalEducation,

      hasTransferCollege,

    socialWorkerLawVersion,

     verifiedFacts:
  verifiedFactsWithStudyStartDate,

priorSubjectCandidates:
  verifiedFactsWithStudyStartDate
    .map(
      decodeKakaoAiPriorSubjectFact
    )
    .filter(
      (
        subject
      ): subject is
        KakaoAiPriorSubjectCandidate =>
        Boolean(
          subject
        )
    ),

priorCreditBankSemesters:
  verifiedFactsWithStudyStartDate
    .map(
      decodeKakaoAiPriorCreditBankSemesterFact
    )
    .filter(
      (
        semester
      ): semester is
        KakaoAiPriorCreditBankSemester =>
        Boolean(
          semester
        )
    ),

desiredStudyStartDate:
  verifiedFactsWithStudyStartDate
    .map(
      decodeKakaoAiDesiredStudyStartDateFact
    )
    .filter(
      Boolean
    )
    .at(
      -1
    )
    ?.date ??
  null,

      unresolvedQuestions,

      currentTopic,
    };

  const changed =
    JSON.stringify(
      current
    ) !==
    JSON.stringify(
      nextMemory
    );

  if (
    !changed
  ) {
    return {
      success:
        true,

      changed:
        false,

      memory:
        current,
    };
  }

  await db.updateKakaoAiConversationMemory({
    organizationId:
      params.organizationId,

    conversationId:
      params.conversationId,

    patch: {
      desiredCourse:
        nextMemory.desiredCourse,

      finalEducation:
        nextMemory.finalEducation,

      hasTransferCollege:
        nextMemory.hasTransferCollege,

socialWorkerLawVersion:
  nextMemory.socialWorkerLawVersion,

      verifiedFacts:
        nextMemory.verifiedFacts,

      unresolvedQuestions:
        nextMemory.unresolvedQuestions,

      currentTopic:
        nextMemory.currentTopic,
    },
  });

  return {
    success:
      true,

    changed:
      true,

    memory:
      nextMemory,
  };
}