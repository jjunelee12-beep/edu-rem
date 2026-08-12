import OpenAI from "openai";

import type {
  KakaoAiStructuredMemory,
} from "./kakao-ai-memory-resolver";

import type {
  KakaoAiMemoryWritePatch,
  KakaoAiVerifiedMemoryFact,
} from "./kakao-ai-memory-writer";

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
   * 충돌한다고 판단되면 true.
   *
   * true인 사실은 자동 저장하지 않는다.
   */
  conflictsWithMemory:
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
  },

  required: [
    "shouldWrite",
    "value",
    "evidence",
    "confidence",
    "conflictsWithMemory",
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
  },

  required: [
    "shouldWrite",
    "value",
    "evidence",
    "confidence",
    "conflictsWithMemory",
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
        },

        required: [
  "key",
  "value",
  "description",
  "evidence",
  "confidence",
  "conflictsWithMemory",
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

9. 기존 Memory와 새로운 명확한 사용자 발언이 서로 다르면
conflictsWithMemory=true로 한다.
자동으로 기존 값을 덮어쓴다고 판단하지 않는다.

9-1. 이 충돌검사는 desiredCourse, finalEducation,
hasTransferCollege뿐 아니라 verifiedFacts에도 동일하게 적용한다.

같은 key에 대해 currentMemory의 기존 사실과
현재 사용자 발언의 값이 서로 다르면
해당 verifiedFact의 conflictsWithMemory=true로 한다.

10. OCR, 성적증명서 이미지, CRM, 공통엔진에서 확인됐다고
네가 임의로 판단하지 않는다.
너의 모든 신규 fact source는 오직 사용자 직접 발언이다.

11. 사용자가 현재 메시지에서 여러 사실을 동시에 말하면 모두 추출할 수 있다.

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
    },

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
    !extraction
      .desiredCourse
      .conflictsWithMemory &&
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
    !extraction
      .finalEducation
      .conflictsWithMemory &&
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
    !extraction
      .hasTransferCollege
      .conflictsWithMemory &&
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

  const verifiedFactsToAdd:
    KakaoAiVerifiedMemoryFact[] =
    extraction.verifiedFacts
  .filter(
    (
      fact
    ) =>
      !fact.conflictsWithMemory &&
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