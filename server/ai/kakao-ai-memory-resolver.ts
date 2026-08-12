import * as db from "../db";

import type {
  KakaoAiConversationMessage,
} from "./kakao-ai-intent-router";

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

/**
 * DB Memory 결과를
 * AI가 사용하기 쉬운 형태로 정규화한다.
 */
function normalizeStructuredMemory(
  memory:
    db.KakaoAiConversationMemory
): KakaoAiStructuredMemory {
  return {
    desiredCourse:
      normalizeNullableText(
        memory.desiredCourse
      ),

    finalEducation:
      normalizeNullableText(
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

    verifiedFacts:
      normalizeStringArray(
        memory.verifiedFacts
      ),

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