import OpenAI from "openai";

import type {
  KakaoAiStructuredMemory,
} from "./kakao-ai-memory-resolver";

import type {
  KakaoAiMemoryWritePatch,
  KakaoAiVerifiedMemoryFact,
} from "./kakao-ai-memory-writer";

export type KakaoAiUserPriorSubjectCandidate = {
  subjectName:
    string;

  completedYear:
    number | null;

  credits:
    number | null;

  evidence:
    string;

  confidence:
    number;

  isExplicitCorrection:
    boolean;
};

/**
 * Memory Extractor
 *
 * 역할:
 *
 * 현재 사용자가 직접 보낸 자연어에서
 * "명확하게 직접 밝힌 사실"만 후보로 추출한다.
 *
 * 중요:
 *
 * - OCR 결과 판단 X
 * - CRM 사실 판단 X
 * - 공통엔진 결과 판단 X
 * - 추측 X
 * - 애매한 정보 확정 X
 *
 * OCR / CRM / 공통엔진 사실은
 * 각각의 서버 Adapter가 직접 Memory Writer에 넣는다.
 */

export type KakaoAiUserMemoryCandidate<T> = {
  /**
   * 현재 사용자 메시지에서
   * 정말 명확하게 확인됐는가.
   */
  shouldWrite:
    boolean;

  /**
   * 저장 후보 값.
   *
   * shouldWrite=false이면 null.
   */
  value:
    T | null;

  /**
   * 현재 사용자 메시지에서
   * 이 판단의 직접 근거가 되는 원문.
   *
   * 서버에서 실제 currentMessage 안에
   * 존재하는 문구인지 다시 검사한다.
   */
  evidence:
    string | null;

  /**
   * 모델 판단 신뢰도.
   *
   * 서버에서도 임계값을 적용한다.
   */
  confidence:
    number;

  /**
   * 기존 Memory와 충돌한다고 판단되는지.
   *
   * true이면 자동 덮어쓰기 금지.
   */
  conflictsWithMemory:
    boolean;

/**
 * 기존 Memory와 값이 다르지만
 * 사용자가 현재 메시지에서 기존 정보를
 * 명확하게 정정했는지.
 *
 * 예:
 * "아 전문대가 아니라 4년제 졸업했어요."
 *
 * 단순히 다른 값을 언급한 것과
 * 명시적인 정정을 구분하기 위한 값이다.
 */
isExplicitCorrection:
  boolean;
};

export type KakaoAiUserVerifiedFactCandidate = {
  key:
    string;

  value:
    string;

  description:
    string;

  evidence:
    string;

  confidence:
    number;

  /**
   * 기존 Memory의 같은 사실과
   * 값이 다른지.
   */
  conflictsWithMemory:
    boolean;

  /**
   * 기존 사실과 값은 다르지만
   * 사용자가 현재 메시지에서
   * 명확하게 기존 사실을 정정했는지.
   */
  isExplicitCorrection:
    boolean;
};

export type KakaoAiUserMemoryExtraction = {
  /**
   * 사용자가 명확하게 희망한다고 밝힌 과정.
   *
   * 단순 비교질문:
   * "사회복지사랑 보육교사 뭐가 좋아요?"
   *
   * 같은 경우는 shouldWrite=false.
   */
  desiredCourse:
    KakaoAiUserMemoryCandidate<string>;

  /**
   * 사용자가 직접 밝힌 최종학력.
   */
  finalEducation:
    KakaoAiUserMemoryCandidate<string>;

  /**
   * 전적대 / 이전 대학 이력 존재 여부.
   */
  hasTransferCollege:
    KakaoAiUserMemoryCandidate<boolean>;

/**
 * 사용자가 직접 밝힌
 * 대학 / 전적대 기이수 과목 후보.
 *
 * 사용자 진술만으로는
 * 실제 인정과목으로 확정하지 않는다.
 */
priorSubjectCandidates:
  KakaoAiUserPriorSubjectCandidate[];

  /**
   * 위 세 필드 외에
   * 사용자가 현재 메시지에서 명확히 밝힌
   * 학점은행제 상담 관련 사실.
   */
  verifiedFacts:
    KakaoAiUserVerifiedFactCandidate[];

  /**
   * 현재 메시지에서 이전 미확인 정보가
   * 명확하게 해결됐다면 해당 key.
   */
  resolvedQuestionKeys:
    string[];

  /**
   * 새롭게 확인이 꼭 필요한 정보.
   *
   * 사용자가 직접 말한 사실이 아니라
   * 현재 상담상태를 위한 내부 Memory다.
   */
  unresolvedQuestionKeys:
    string[];

  /**
   * 현재 대화의 중심 주제.
   *
   * 사실값이라기보다
   * 짧은 후속질문 문맥을 위한 상태값이다.
   */
  currentTopic:
    string | null;

  /**
   * 현재 메시지 자체가 모호해서
   * Memory 저장보다 확인질문이 먼저 필요한지.
   */
  needsClarification:
    boolean;

  clarificationReason:
    string | null;
};

export type KakaoAiMemoryExtractionResult = {
  success:
    boolean;

  extraction:
    KakaoAiUserMemoryExtraction;

  /**
   * 서버 검증을 통과한
   * 실제 Writer용 Patch.
   *
   * 모델 원본 결과를 그대로 DB에 넣지 않는다.
   */
  safePatch:
    KakaoAiMemoryWritePatch;

  openAiResponseId:
    string | null;

  model:
    string | null;

  fallbackUsed:
    boolean;

  errorMessage:
    string | null;
};

let kakaoMemoryOpenAiClient:
  OpenAI | null | undefined;

function getKakaoMemoryOpenAiClient():
  OpenAI | null {
  if (
    kakaoMemoryOpenAiClient !==
    undefined
  ) {
    return kakaoMemoryOpenAiClient;
  }

  const apiKey =
    String(
      process.env.OPENAI_API_KEY ||
      ""
    ).trim();

  if (
    !apiKey
  ) {
    kakaoMemoryOpenAiClient =
      null;

    return null;
  }

  kakaoMemoryOpenAiClient =
    new OpenAI({
      apiKey,
    });

  return kakaoMemoryOpenAiClient;
}

function getKakaoMemoryModel():
  string {
  return (
    String(
      process.env
        .OPENAI_KAKAO_MEMORY_MODEL ||
      ""
    ).trim() ||
    String(
      process.env
        .OPENAI_KAKAO_INTENT_MODEL ||
      ""
    ).trim() ||
    String(
      process.env
        .OPENAI_AI_MODEL ||
      ""
    ).trim() ||
    "gpt-5.4-mini"
  );
}

const STRING_CANDIDATE_SCHEMA = {
  type:
    "object",

  additionalProperties:
    false,

  properties: {
    shouldWrite: {
      type:
        "boolean",
    },

    value: {
      anyOf: [
        {
          type:
            "string",
        },
        {
          type:
            "null",
        },
      ],
    },

    evidence: {
      anyOf: [
        {
          type:
            "string",
        },
        {
          type:
            "null",
        },
      ],
    },

    confidence: {
      type:
        "number",

      minimum:
        0,

      maximum:
        1,
    },

    conflictsWithMemory: {
      type:
        "boolean",
    },

isExplicitCorrection: {
  type:
    "boolean",
},
  },

  required: [
  "shouldWrite",
  "value",
  "evidence",
  "confidence",
  "conflictsWithMemory",
  "isExplicitCorrection",
],
} as const;

const BOOLEAN_CANDIDATE_SCHEMA = {
  type:
    "object",

  additionalProperties:
    false,

  properties: {
    shouldWrite: {
      type:
        "boolean",
    },

    value: {
      anyOf: [
        {
          type:
            "boolean",
        },
        {
          type:
            "null",
        },
      ],
    },

    evidence: {
      anyOf: [
        {
          type:
            "string",
        },
        {
          type:
            "null",
        },
      ],
    },

    confidence: {
      type:
        "number",

      minimum:
        0,

      maximum:
        1,
    },

    conflictsWithMemory: {
      type:
        "boolean",
    },

isExplicitCorrection: {
  type:
    "boolean",
},
  },

  required: [
  "shouldWrite",
  "value",
  "evidence",
  "confidence",
  "conflictsWithMemory",
  "isExplicitCorrection",
],
} as const;

const KAKAO_AI_MEMORY_EXTRACTION_SCHEMA = {
  type:
    "object",

  additionalProperties:
    false,

  properties: {
    desiredCourse:
      STRING_CANDIDATE_SCHEMA,

    finalEducation:
      STRING_CANDIDATE_SCHEMA,

    hasTransferCollege:
      BOOLEAN_CANDIDATE_SCHEMA,

priorSubjectCandidates: {
  type:
    "array",

  items: {
    type:
      "object",

    additionalProperties:
      false,

    properties: {
      subjectName: {
        type:
          "string",
      },

      completedYear: {
        anyOf: [
          {
            type:
              "integer",

            minimum:
              1900,

            maximum:
              2100,
          },
          {
            type:
              "null",
          },
        ],
      },

      credits: {
        anyOf: [
          {
            type:
              "number",

            minimum:
              0,
          },
          {
            type:
              "null",
          },
        ],
      },

      evidence: {
        type:
          "string",
      },

      confidence: {
        type:
          "number",

        minimum:
          0,

        maximum:
          1,
      },

      isExplicitCorrection: {
        type:
          "boolean",
      },
    },

    required: [
      "subjectName",
      "completedYear",
      "credits",
      "evidence",
      "confidence",
      "isExplicitCorrection",
    ],
  },
},

    verifiedFacts: {
      type:
        "array",

      items: {
        type:
          "object",

        additionalProperties:
          false,

        properties: {
          key: {
            type:
              "string",
          },

          value: {
            type:
              "string",
          },

          description: {
            type:
              "string",
          },

          evidence: {
            type:
              "string",
          },

          confidence: {
            type:
              "number",

            minimum:
              0,

            maximum:
              1,
          },

conflictsWithMemory: {
  type:
    "boolean",
},

isExplicitCorrection: {
  type:
    "boolean",
},
        },

        required: [
  "key",
  "value",
  "description",
  "evidence",
  "confidence",
  "conflictsWithMemory",
  "isExplicitCorrection",
],
      },
    },

    resolvedQuestionKeys: {
      type:
        "array",

      items: {
        type:
          "string",
      },
    },

    unresolvedQuestionKeys: {
      type:
        "array",

      items: {
        type:
          "string",
      },
    },

    currentTopic: {
      anyOf: [
        {
          type:
            "string",
        },
        {
          type:
            "null",
        },
      ],
    },

    needsClarification: {
      type:
        "boolean",
    },

    clarificationReason: {
      anyOf: [
        {
          type:
            "string",
        },
        {
          type:
            "null",
        },
      ],
    },
  },

  required: [
    "desiredCourse",
"finalEducation",
"hasTransferCollege",
"priorSubjectCandidates",
"verifiedFacts",
    "resolvedQuestionKeys",
    "unresolvedQuestionKeys",
    "currentTopic",
    "needsClarification",
    "clarificationReason",
  ],
} as const;

const KAKAO_AI_MEMORY_EXTRACTOR_INSTRUCTIONS = `
너는 EduCanvas 카카오 AI의 "사용자 Memory 후보 추출기"다.

사용자에게 답변하지 않는다.

현재 사용자 메시지에서
사용자가 직접 명확하게 밝힌 사실만 추출한다.

절대 추측하지 않는다.

가장 중요한 원칙:

1. currentMessage의 사용자 직접 발언만 새로운 사실의 근거로 사용할 수 있다.

2. currentMemory는 기존 사실과 충돌 여부를 판단하기 위한 참고자료다.
currentMemory 자체에서 새로운 사실을 만들어내지 않는다.

3. evidence에는 반드시 currentMessage에 실제로 존재하는 직접 근거 문구를 넣는다.

4. evidence를 현재 메시지에서 직접 찾을 수 없으면 shouldWrite=false다.

5. "아마", "같아요", "기억이 잘 안 나요", "인 것 같은데",
"잘 모르겠어요" 등 불확실한 표현은 확정 사실로 저장하지 않는다.

6. 질문에 등장했다는 이유만으로 희망과정을 저장하지 않는다.

예:
"사회복지사랑 보육교사 중 뭐가 좋아요?"
→ desiredCourse shouldWrite=false

"사회복지사2급 하려고요"
→ desiredCourse 저장 가능

7. 최종학력도 사용자가 자신의 학력을 직접 명확하게 밝힌 경우만 저장한다.

예:
"전문대 졸업했어요"
→ finalEducation 저장 가능

"전문대였던 것 같아요"
→ 저장 금지

8. hasTransferCollege는 사용자가 이전 대학/전적대 이력의 존재 또는 부재를
명확히 말한 경우에만 저장한다.

9. 기존 Memory와 현재 사용자의 명확한 발언이 서로 다르면
기본적으로 conflictsWithMemory=true로 한다.

그러나 "값이 다르다"와 "사용자가 명시적으로 기존 정보를 정정했다"는
서로 다른 상태다.

예:

currentMemory.finalEducation = "전문대졸"

사용자:
"저 4년제도 나왔는데요?"
→ 어떤 학력이 최종학력인지 불명확할 수 있으므로
  conflictsWithMemory=true
  isExplicitCorrection=false

사용자:
"아 제가 잘못 말했어요. 전문대가 아니라 4년제 졸업이에요."
→ 기존 정보를 직접 정정한 발언이므로
  conflictsWithMemory=true
  isExplicitCorrection=true

명시적인 정정 표현의 예:

- "아니고"
- "아니라"
- "잘못 말했어요"
- "정정할게요"
- "바꿀게요"
- "말고"
- "제가 아까 잘못 말했는데"
- 이전값을 부정하면서 새로운 값을 확정적으로 말함

특히 finalEducation은 아래와 같이
사용자가 현재 자신의 최종학력을 직접 다시 확정해서 말하면,
반드시 명시적 정정으로 취급한다.

예:

currentMemory.finalEducation = "전문대졸"

사용자:
"아 저 고졸이에요 최종학력"
→ finalEducation.value = "고졸"
→ shouldWrite = true
→ conflictsWithMemory = true
→ isExplicitCorrection = true

사용자:
"최종학력은 고졸이에요"
→ finalEducation.value = "고졸"
→ shouldWrite = true
→ conflictsWithMemory = true
→ isExplicitCorrection = true

사용자:
"저 고졸입니다"
→ 현재 Memory와 다른 학력이 저장되어 있다면
  현재 사용자가 자신의 학력을 직접 확정해서 말한 것이므로
  finalEducation 변경 후보로 본다.
→ conflictsWithMemory = true
→ isExplicitCorrection = true

즉 finalEducation은
현재 사용자가 자기 학력을 확정적으로 다시 말했고
그 값이 기존 Memory와 다르면,
반드시 "아니라", "정정" 같은 단어가 없어도
사용자의 최신 직접발언을 우선하는 명시적 정정으로 본다.

단,
"전문대도 다녔어요"
"대학교 중퇴했어요"
같은 말은 최종학력 변경 자체를 뜻하지 않을 수 있으므로
finalEducation을 임의 변경하지 않는다.

단, 단순히 새로운 값이 등장했다는 이유만으로
isExplicitCorrection=true로 하지 않는다.

9-1. desiredCourse, finalEducation, hasTransferCollege는
기존값과 다른 경우 위 원칙을 동일하게 적용한다.

예:

currentMemory.desiredCourse = "보육교사 2급"

"사회복지사도 궁금해요"
→ 비교/추가 관심일 수 있으므로 자동 변경하지 않는다.

"보육교사 말고 사회복지사 2급으로 할게요"
→ conflictsWithMemory=true
→ isExplicitCorrection=true
→ desiredCourse를 사회복지사 2급으로 변경 가능한 후보다.

9-2. verifiedFacts도 같은 원칙을 사용한다.

기존 사실과 다른 내용이 나왔다면 conflictsWithMemory=true로 하되,
사용자가 기존 사실을 명시적으로 정정한 경우에만
isExplicitCorrection=true로 한다.

9-3. 애매한 충돌은 절대로 임의로 덮어쓰지 않는다.

conflictsWithMemory=true이고
isExplicitCorrection=false이면
needsClarification=true로 한다.

10. OCR, 성적증명서 이미지, CRM, 공통엔진에서 확인됐다고
네가 임의로 판단하지 않는다.
너의 모든 신규 fact source는 오직 사용자 직접 발언이다.

11. 사용자가 현재 메시지에서 여러 사실을 동시에 말하면 모두 추출할 수 있다.

11-1. 사용자가 대학교, 전문대, 전적대 등에서
이미 이수한 과목을 직접 명확하게 말하면
priorSubjectCandidates에 넣는다.

예:

사용자:
"대학교에서 사회복지학개론 들었어요"

→ priorSubjectCandidates:
[
  {
    "subjectName": "사회복지학개론",
    "completedYear": null,
    "credits": null,
    "evidence": "사회복지학개론 들었어요",
    "confidence": 0.99,
    "isExplicitCorrection": false
  }
]

11-2. 사용자가 이수했다고 말한 것만으로
verificationStatus를 verified로 판단하지 않는다.

사용자의 직접 발언은 항상
"user_reported" 후보일 뿐이다.

실제 자격과목 인정 여부,
학점 인정 여부,
동일과목 여부는
OCR / CRM / 공통엔진이 나중에 판단한다.

11-3. 직전 Memory에 이수과목 후보가 하나 있고
사용자가 다음 메시지에서 연도만 명확하게 답한 경우,
그 연도를 기존 과목과 연결할 수 있다.

예:

currentMemory.priorSubjectCandidates:
[
  {
    "subjectName": "사회복지학개론",
    "completedYear": null
  }
]

currentMessage:
"2019년에 들었어요"

→ priorSubjectCandidates:
[
  {
    "subjectName": "사회복지학개론",
    "completedYear": 2019,
    "credits": null,
    "evidence": "2019년에 들었어요",
    "confidence": 0.99,
    "isExplicitCorrection": false
  }
]

이 경우 subjectName 자체는 기존 Memory에서 가져올 수 있다.
단 새로 추가되는 사실인 completedYear의 직접 근거는
반드시 currentMessage에 있어야 한다.

11-4. 기존 과목의 연도를 사용자가 명확하게 정정하면
isExplicitCorrection=true로 한다.

예:

기존:
사회복지학개론 2019년

사용자:
"아 2019년 아니고 2018년에 들었어요"

→ subjectName = "사회복지학개론"
→ completedYear = 2018
→ isExplicitCorrection = true

11-5. 직전 Memory에 과목 후보가 여러 개인데
사용자가 단순히 "2019년에요"라고만 하면
어느 과목인지 임의로 연결하지 않는다.

이 경우 priorSubjectCandidates에는 쓰지 않고
needsClarification=true로 한다.

11-6. 사용자가
"대학교 중퇴했어요"
라고 말하면
hasTransferCollege=true로 볼 수 있다.

그러나 finalEducation을
"대졸" 또는 "전문대졸"로 변경하지 않는다.

12. verifiedFacts에는 학점은행제 상담에 앞으로 의미가 있는
명확한 사실만 넣는다.
일상적인 잡담은 저장하지 않는다.

13. resolvedQuestionKeys는 currentMemory.unresolvedQuestions에 있는 내용 중
현재 메시지가 명확하게 답한 경우에만 넣는다.

14. unresolvedQuestionKeys는 현재 대화에서 반드시 추가확인이 필요한
핵심정보만 넣는다. 관련 없는 정보를 미리 요구하지 않는다.

15. currentTopic은 현재 메시지에서 실제로 다루는 중심 상담주제를
짧고 일반적인 표현으로 기록한다.

16. 애매하거나 충돌하는 내용이 있어 확인이 필요하면
needsClarification=true로 한다.

JSON 외의 설명은 출력하지 않는다.
`.trim();

function normalizeText(
  value:
    unknown
): string {
  return String(
    value ??
    ""
  ).trim();
}

function normalizeConfidence(
  value:
    unknown
): number {
  const parsed =
    Number(
      value
    );

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return 0;
  }

  return Math.min(
    Math.max(
      parsed,
      0
    ),
    1
  );
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

  return Array.from(
    new Set(
      value
        .map(
          normalizeText
        )
        .filter(
          Boolean
        )
    )
  ).slice(
    0,
    limit
  );
}

/**
 * evidence는 반드시 현재 사용자 메시지에
 * 실제 포함돼 있어야 한다.
 */
function isEvidenceInsideMessage(
  message:
    string,

  evidence:
    unknown
): boolean {
  const normalizedMessage =
    normalizeText(
      message
    );

  const normalizedEvidence =
    normalizeText(
      evidence
    );

  if (
    !normalizedMessage ||
    !normalizedEvidence
  ) {
    return false;
  }

  return normalizedMessage.includes(
    normalizedEvidence
  );
}

function buildEmptyExtraction():
  KakaoAiUserMemoryExtraction {
  return {
    desiredCourse: {
      shouldWrite:
        false,

      value:
        null,

      evidence:
        null,

      confidence:
        0,

      conflictsWithMemory:
        false,

isExplicitCorrection:
  false,
    },

    finalEducation: {
      shouldWrite:
        false,

      value:
        null,

      evidence:
        null,

      confidence:
        0,

      conflictsWithMemory:
        false,

isExplicitCorrection:
  false,
    },

    hasTransferCollege: {
      shouldWrite:
        false,

      value:
        null,

      evidence:
        null,

      confidence:
        0,

      conflictsWithMemory:
        false,

isExplicitCorrection:
  false,
    },

priorSubjectCandidates:
  [],

    verifiedFacts:
      [],

    resolvedQuestionKeys:
      [],

    unresolvedQuestionKeys:
      [],

    currentTopic:
      null,

    needsClarification:
      false,

    clarificationReason:
      null,
  };
}

/**
 * Memory 추출 OpenAI 호출이 필요 없는
 * 명백한 일반 대화인지 서버에서 빠르게 판정한다.
 *
 * 주의:
 * - 짧다는 이유만으로 skip하지 않는다.
 * - 학력 / 희망과정 / 전적대 등 상담 사실이
 *   포함될 가능성이 있는 문장은 기존 AI 분석을 유지한다.
 * - 정말 명확한 인사 / 감사 / 단순 확인 표현만 허용한다.
 */
function isMemoryExtractionFastPathMessage(
  value: unknown
): boolean {
  const message =
    normalizeText(value)
      .replace(/\s+/g, " ")
      .trim();

  if (!message) {
    return true;
  }

  const normalized =
    message
      .replace(/[.!?~ㅋㅎㅠㅜ]+$/g, "")
      .trim()
      .toLowerCase();

  const exactMessages =
    new Set([
      "안녕",
      "안녕하세요",
      "안녕하세여",
      "안녕하세용",
      "반갑습니다",
      "반가워요",

      "네",
      "넵",
      "넹",
      "예",
      "옙",
      "ㅇㅇ",
      "ㅇㅋ",
      "오케이",
      "알겠습니다",
      "알겠어요",
      "알겠어",
      "확인했습니다",
      "확인했어요",

      "감사합니다",
      "감사해요",
      "고맙습니다",
      "고마워요",
      "고마워",

      "아",
      "아하",
      "오",
      "오호",
      "그렇군요",
      "그렇구나",
    ]);

  return exactMessages.has(
    normalized
  );
}

function normalizeStringCandidate(
  value:
    any
): KakaoAiUserMemoryCandidate<string> {
  return {
    shouldWrite:
      value?.shouldWrite ===
      true,

    value:
      normalizeText(
        value?.value
      ) ||
      null,

    evidence:
      normalizeText(
        value?.evidence
      ) ||
      null,

    confidence:
      normalizeConfidence(
        value?.confidence
      ),

    conflictsWithMemory:
      value?.conflictsWithMemory ===
      true,

    isExplicitCorrection:
      value?.isExplicitCorrection ===
      true,
  };
}

function normalizeBooleanCandidate(
  value:
    any
): KakaoAiUserMemoryCandidate<boolean> {
  const normalizedValue =
    value?.value ===
      true
      ? true
      : value?.value ===
          false
        ? false
        : null;

  return {
    shouldWrite:
      value?.shouldWrite ===
      true,

    value:
      normalizedValue,

    evidence:
      normalizeText(
        value?.evidence
      ) ||
      null,

    confidence:
      normalizeConfidence(
        value?.confidence
      ),

    conflictsWithMemory:
      value?.conflictsWithMemory ===
      true,

isExplicitCorrection:
  value?.isExplicitCorrection ===
  true,
  };
}

function normalizeExtraction(
  raw:
    unknown
): KakaoAiUserMemoryExtraction {
  const source =
    raw &&
    typeof raw ===
      "object"
      ? raw as
          Record<
            string,
            any
          >
      : {};

const priorSubjectCandidates =
  Array.isArray(
    source.priorSubjectCandidates
  )
    ? source
        .priorSubjectCandidates
        .map(
          (
            subject:
              any
          ) => {
            const completedYearRaw =
              subject
                ?.completedYear;

            const completedYear =
              Number.isFinite(
                Number(
                  completedYearRaw
                )
              )
                ? Math.floor(
                    Number(
                      completedYearRaw
                    )
                  )
                : null;

            const creditsRaw =
              subject
                ?.credits;

            const credits =
              Number.isFinite(
                Number(
                  creditsRaw
                )
              ) &&
              Number(
                creditsRaw
              ) >
                0
                ? Number(
                    creditsRaw
                  )
                : null;

            return {
              subjectName:
                normalizeText(
                  subject
                    ?.subjectName
                ),

              completedYear:
                completedYear &&
                completedYear >=
                  1900 &&
                completedYear <=
                  2100
                  ? completedYear
                  : null,

              credits,

              evidence:
                normalizeText(
                  subject
                    ?.evidence
                ),

              confidence:
                normalizeConfidence(
                  subject
                    ?.confidence
                ),

              isExplicitCorrection:
                subject
                  ?.isExplicitCorrection ===
                true,
            };
          }
        )
        .filter(
          (
            subject
          ) =>
            Boolean(
              subject.subjectName &&
              subject.evidence
            )
        )
        .slice(
          0,
          20
        )
    : [];

  const verifiedFacts =
    Array.isArray(
      source.verifiedFacts
    )
      ? source.verifiedFacts
          .map(
            (
              fact:
                any
            ) => ({
              key:
                normalizeText(
                  fact?.key
                ),

              value:
                normalizeText(
                  fact?.value
                ),

              description:
                normalizeText(
                  fact?.description
                ),

              evidence:
                normalizeText(
                  fact?.evidence
                ),

              confidence:
                normalizeConfidence(
                  fact?.confidence
                ),

conflictsWithMemory:
  fact?.conflictsWithMemory ===
  true,

isExplicitCorrection:
  fact?.isExplicitCorrection ===
  true,
            })
          )
          .filter(
            (
              fact
            ) =>
              Boolean(
                fact.key &&
                fact.value &&
                fact.description &&
                fact.evidence
              )
          )
          .slice(
            0,
            20
          )
      : [];

  return {
    desiredCourse:
      normalizeStringCandidate(
        source.desiredCourse
      ),

    finalEducation:
      normalizeStringCandidate(
        source.finalEducation
      ),

    hasTransferCollege:
      normalizeBooleanCandidate(
        source.hasTransferCollege
      ),

priorSubjectCandidates,

    verifiedFacts,

    resolvedQuestionKeys:
      normalizeStringArray(
        source.resolvedQuestionKeys,
        20
      ),

    unresolvedQuestionKeys:
      normalizeStringArray(
        source.unresolvedQuestionKeys,
        20
      ),

    currentTopic:
      normalizeText(
        source.currentTopic
      ) ||
      null,

    needsClarification:
      source.needsClarification ===
      true,

    clarificationReason:
      normalizeText(
        source.clarificationReason
      ) ||
      null,
  };
}

/**
 * 모델 결과를 실제 DB Writer Patch로 바꾸는
 * 서버 검증 단계.
 *
 * 여기에서:
 * - evidence 원문 존재
 * - confidence
 * - Memory 충돌
 *
 * 을 다시 확인한다.
 */
function buildSafeMemoryPatch(
  params: {
    message:
      string;

    extraction:
      KakaoAiUserMemoryExtraction;
  }
): KakaoAiMemoryWritePatch {
  const message =
    normalizeText(
      params.message
    );

  const extraction =
    params.extraction;

  const patch:
    KakaoAiMemoryWritePatch = {};

  /**
   * 명확한 사용자 직접 발언만
   * 핵심 필드에 반영.
   */
  if (
    extraction
      .desiredCourse
      .shouldWrite &&
    (
  !extraction
    .desiredCourse
    .conflictsWithMemory ||
  extraction
    .desiredCourse
    .isExplicitCorrection
) &&
    extraction
      .desiredCourse
      .confidence >=
      0.9 &&
    extraction
      .desiredCourse
      .value &&
    isEvidenceInsideMessage(
      message,
      extraction
        .desiredCourse
        .evidence
    )
  ) {
    patch.desiredCourse =
      extraction
        .desiredCourse
        .value;
  }

  if (
    extraction
      .finalEducation
      .shouldWrite &&
    (
  !extraction
    .finalEducation
    .conflictsWithMemory ||
  extraction
    .finalEducation
    .isExplicitCorrection
) &&
    extraction
      .finalEducation
      .confidence >=
      0.9 &&
    extraction
      .finalEducation
      .value &&
    isEvidenceInsideMessage(
      message,
      extraction
        .finalEducation
        .evidence
    )
  ) {
    patch.finalEducation =
      extraction
        .finalEducation
        .value;
  }

  if (
    extraction
      .hasTransferCollege
      .shouldWrite &&
    (
  !extraction
    .hasTransferCollege
    .conflictsWithMemory ||
  extraction
    .hasTransferCollege
    .isExplicitCorrection
) &&
    extraction
      .hasTransferCollege
      .confidence >=
      0.9 &&
    extraction
      .hasTransferCollege
      .value !==
      null &&
    isEvidenceInsideMessage(
      message,
      extraction
        .hasTransferCollege
        .evidence
    )
  ) {
    patch.hasTransferCollege =
      extraction
        .hasTransferCollege
        .value;
  }

const priorSubjectCandidatesToUpsert =
  extraction
    .priorSubjectCandidates
    .filter(
      (
        subject
      ) =>
        subject.confidence >=
          0.9 &&
        Boolean(
          subject.subjectName
        ) &&
        isEvidenceInsideMessage(
          message,
          subject.evidence
        )
    )
    .map(
      (
        subject
      ) => ({
        subjectName:
          subject.subjectName,

        completedYear:
          subject.completedYear,

        credits:
          subject.credits,

        source:
          "user" as const,

        verificationStatus:
          "user_reported" as const,
      })
    );

if (
  priorSubjectCandidatesToUpsert.length >
  0
) {
  patch.priorSubjectCandidatesToUpsert =
    priorSubjectCandidatesToUpsert;
}

  const verifiedFactsToAdd:
    KakaoAiVerifiedMemoryFact[] =
    extraction.verifiedFacts
  .filter(
    (
      fact
    ) =>
      (
  !fact.conflictsWithMemory ||
  fact.isExplicitCorrection
) &&
      fact.confidence >=
        0.9 &&
      isEvidenceInsideMessage(
        message,
        fact.evidence
      )
  )
      .map(
        (
          fact
        ) => ({
          /**
           * 모델이 source를 선택하지 않는다.
           *
           * 이 Extractor는 사용자의 현재 발언만
           * 읽기 때문에 서버가 user로 고정한다.
           */
          source:
            "user" as const,

          key:
            fact.key,

          value:
            fact.value,

          description:
            fact.description,
        })
      );

  if (
    verifiedFactsToAdd.length >
    0
  ) {
    patch.verifiedFactsToAdd =
      verifiedFactsToAdd;
  }

  if (
    extraction
      .resolvedQuestionKeys
      .length >
    0
  ) {
    patch.resolvedQuestionKeys =
      extraction
        .resolvedQuestionKeys;
  }

  if (
    extraction
      .unresolvedQuestionKeys
      .length >
    0
  ) {
    patch.unresolvedQuestionKeys =
      extraction
        .unresolvedQuestionKeys;
  }

  if (
    extraction.currentTopic
  ) {
    patch.currentTopic =
      extraction.currentTopic;
  }

  return patch;
}

/**
 * 사용자 메시지에서 Memory 후보를 추출한다.
 *
 * 아직 DB에는 쓰지 않는다.
 *
 * 반환되는 safePatch만
 * applyKakaoAiVerifiedMemoryPatch()에 전달한다.
 */
export async function extractKakaoAiUserMemory(
  params: {
    message:
      string;

    currentMemory:
      KakaoAiStructuredMemory;
  }
): Promise<KakaoAiMemoryExtractionResult> {
  const message =
    normalizeText(
      params.message
    );

  if (
  !message
) {
  const extraction =
    buildEmptyExtraction();

  return {
    success:
      true,

    extraction,

    safePatch:
      {},

    openAiResponseId:
      null,

    model:
      null,

    fallbackUsed:
      false,

    errorMessage:
      null,
  };
}

/**
 * 명백한 인사 / 감사 / 단순 확인은
 * Memory에 새로 저장할 사용자 사실이 없다.
 *
 * 이 경우 OpenAI Memory Extractor를 호출하지 않고
 * 즉시 빈 결과를 반환한다.
 */
if (
  isMemoryExtractionFastPathMessage(
    message
  )
) {
  const extraction =
    buildEmptyExtraction();

  return {
    success:
      true,

    extraction,

    safePatch:
      {},

    openAiResponseId:
      null,

    model:
      null,

    fallbackUsed:
      false,

    errorMessage:
      null,
  };
}

const openai =
  getKakaoMemoryOpenAiClient();

  if (
    !openai
  ) {
    const extraction =
      buildEmptyExtraction();

    return {
      success:
        false,

      extraction,

      safePatch:
        {},

      openAiResponseId:
        null,

      model:
        null,

      fallbackUsed:
        true,

      errorMessage:
        "OPENAI_API_KEY가 설정되지 않았습니다.",
    };
  }

  const model =
    getKakaoMemoryModel();

  const input =
    JSON.stringify({
      currentMessage:
        message,

      currentMemory:
        params.currentMemory,
    });

  try {
    const response =
      await openai.responses.create({
        model,

        store:
          false,

        instructions:
          KAKAO_AI_MEMORY_EXTRACTOR_INSTRUCTIONS,

        input,

        text: {
          format: {
            type:
              "json_schema",

            name:
              "kakao_ai_user_memory",

            strict:
              true,

            schema:
              KAKAO_AI_MEMORY_EXTRACTION_SCHEMA,
          },
        },
      });

    const outputText =
      normalizeText(
        response.output_text
      );

    if (
      !outputText
    ) {
      const extraction =
        buildEmptyExtraction();

      return {
        success:
          false,

        extraction,

        safePatch:
          {},

        openAiResponseId:
          typeof response.id ===
            "string"
            ? response.id
            : null,

        model,

        fallbackUsed:
          true,

        errorMessage:
          "OpenAI Memory 추출 응답이 비어 있습니다.",
      };
    }

    let parsed:
      unknown;

    try {
      parsed =
        JSON.parse(
          outputText
        );
    } catch {
      const extraction =
        buildEmptyExtraction();

      return {
        success:
          false,

        extraction,

        safePatch:
          {},

        openAiResponseId:
          typeof response.id ===
            "string"
            ? response.id
            : null,

        model,

        fallbackUsed:
          true,

        errorMessage:
          "OpenAI Memory 추출 JSON을 해석할 수 없습니다.",
      };
    }

    const extraction =
      normalizeExtraction(
        parsed
      );

    const safePatch =
      buildSafeMemoryPatch({
        message,

        extraction,
      });

    return {
      success:
        true,

      extraction,

      safePatch,

      openAiResponseId:
        typeof response.id ===
          "string"
          ? response.id
          : null,

      model,

      fallbackUsed:
        false,

      errorMessage:
        null,
    };
  } catch (
    error:
      unknown
  ) {
    console.error(
      "[KAKAO AI] Memory 추출 실패",
      error instanceof
        Error
        ? {
            name:
              error.name,

            message:
              error.message,
          }
        : {
            message:
              String(
                error
              ),
          }
    );

    const extraction =
      buildEmptyExtraction();

    return {
      success:
        false,

      extraction,

      safePatch:
        {},

      openAiResponseId:
        null,

      model,

      fallbackUsed:
        true,

      errorMessage:
        error instanceof
          Error
          ? error.message
          : String(
              error
            ),
    };
  }
}