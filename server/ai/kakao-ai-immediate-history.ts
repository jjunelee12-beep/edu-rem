import * as db from "../db";

/**
 * 카카오 AI Immediate 대화의
 * 경량 History 저장 전용 모듈.
 *
 * 목적:
 *
 * Immediate 요청에서는
 * 무거운 Orchestrator를 실행하지 않지만,
 *
 * 사용자와 AI가 실제로 주고받은 대화는
 * 기존 kakao_ai_conversations /
 * kakao_ai_messages에 정상적으로 남긴다.
 *
 * 절대 하지 않는 것:
 *
 * - Memory Extraction
 * - Intent AI
 * - Context Resolver
 * - CRM 학생조회
 * - 공통엔진
 * - OCR
 * - 위험도
 * - Composer
 */

export type KakaoAiPreRouteConversationContext = {
  conversationId:
    number | null;

  previousAssistantMessage:
    string | null;

  blocked:
    boolean;
};

export type KakaoAiImmediateHistoryStartResult = {
  conversationId:
    number | null;

  userMessageId:
    number | null;

  duplicateMessage:
    boolean;

  blocked:
    boolean;
};

export type KakaoAiImmediateHistoryFinishResult = {
  success:
    boolean;

  assistantMessageId:
    number | null;
};

function normalizePositiveInteger(
  value:
    unknown
): number | null {
  const parsed =
    Math.floor(
      Number(
        value ||
        0
      )
    );

  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed <=
      0
  ) {
    return null;
  }

  return parsed;
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

/**
 * Pre-Router가 현재 발화를 문맥에 맞게 판단할 수 있도록
 * 기존 Conversation의 직전 assistant 메시지를 조회한다.
 *
 * 중요:
 * - 사용자 메시지를 저장하지 않는다.
 * - Memory를 수정하지 않는다.
 * - Intent를 판단하지 않는다.
 * - 단순히 기존 대화 문맥만 읽는다.
 */
export async function getKakaoAiPreRouteConversationContext(
  params: {
    organizationId:
      number;

    channelUserKey:
      string;
  }
): Promise<KakaoAiPreRouteConversationContext> {
  const organizationId =
    normalizePositiveInteger(
      params.organizationId
    );

  if (
    !organizationId
  ) {
    return {
      conversationId:
        null,

      previousAssistantMessage:
        null,

      blocked:
        false,
    };
  }

  const channelUserKey =
    normalizeText(
      params.channelUserKey
    );

  if (
    !channelUserKey
  ) {
    return {
      conversationId:
        null,

      previousAssistantMessage:
        null,

      blocked:
        false,
    };
  }

  /**
   * 기존 Orchestrator / Immediate History와
   * 동일한 Conversation 저장소를 사용한다.
   *
   * Conversation이 처음인 사용자는 새 Conversation만 생성되고
   * 메시지는 여기서 저장하지 않는다.
   */
  const conversation =
    await db.getOrCreateKakaoAiConversation({
      organizationId,

      channelUserKey,
    });

  const conversationId =
    normalizePositiveInteger(
      conversation?.id
    );

  if (
    !conversationId
  ) {
    return {
      conversationId:
        null,

      previousAssistantMessage:
        null,

      blocked:
        false,
    };
  }

  const blocked =
    String(
      conversation?.status ||
      ""
    ) ===
      "blocked";

  if (
    blocked
  ) {
    return {
      conversationId,

      previousAssistantMessage:
        null,

      blocked:
        true,
    };
  }

  /**
   * 최근 대화 일부를 읽는다.
   *
   * 특정 문구를 하드코딩하여 판단하지 않고
   * 가장 최근 assistant 자연어 답변 자체를
   * Pre-Router AI에 전달하기 위한 용도다.
   */
  const recentMessages =
    await db.getKakaoAiRecentMessages({
      organizationId,

      conversationId,

      limit:
        20,
    });

  let previousAssistantMessage:
    string | null =
    null;

  for (
    let index =
      recentMessages.length - 1;
    index >= 0;
    index -= 1
  ) {
    const row =
      recentMessages[index];

    if (
      String(
        row?.role ||
        ""
      ).trim() !==
        "assistant"
    ) {
      continue;
    }

    const content =
      normalizeText(
        row?.content
      );

    if (
      !content
    ) {
      continue;
    }

    previousAssistantMessage =
      content;

    break;
  }

  return {
    conversationId,

    previousAssistantMessage,

    blocked:
      false,
  };
}

/**
 * Immediate 응답 생성 전에
 * Conversation + 사용자 원본 메시지만 저장한다.
 *
 * kakaoMessageId UNIQUE를 그대로 사용하므로
 * 동일 webhook 중복수신도 기존 방식과 동일하게 차단한다.
 */
export async function beginKakaoAiImmediateHistory(
  params: {
    organizationId:
      number;

    channelUserKey:
      string;

    kakaoMessageId?:
      string | null;

    message:
      string;
  }
): Promise<KakaoAiImmediateHistoryStartResult> {
  const organizationId =
    normalizePositiveInteger(
      params.organizationId
    );

  if (
    !organizationId
  ) {
    throw new Error(
      "카카오 AI 회사 정보가 올바르지 않습니다."
    );
  }

  const channelUserKey =
    normalizeText(
      params.channelUserKey
    );

  if (
    !channelUserKey
  ) {
    throw new Error(
      "카카오 사용자 식별정보가 필요합니다."
    );
  }

  const message =
    normalizeText(
      params.message
    );

  if (
    !message
  ) {
    throw new Error(
      "카카오 메시지 내용이 없습니다."
    );
  }

  /**
   * 기존 Orchestrator와 동일한
   * Conversation 저장소를 사용한다.
   */
  const conversation =
    await db.getOrCreateKakaoAiConversation({
      organizationId,

      channelUserKey,
    });

  const conversationId =
    normalizePositiveInteger(
      conversation?.id
    );

  if (
    !conversationId
  ) {
    throw new Error(
      "카카오 AI 대화를 확인할 수 없습니다."
    );
  }

  /**
   * 운영자가 차단한 대화방이면
   * Immediate도 우회해서 답변하면 안 된다.
   */
  if (
    String(
      conversation?.status ||
      ""
    ) ===
      "blocked"
  ) {
    return {
      conversationId,

      userMessageId:
        null,

      duplicateMessage:
        false,

      blocked:
        true,
    };
  }

  const insertedMessage =
    await db.insertKakaoAiMessage({
      organizationId,

      conversationId,

      role:
        "user",

      messageType:
        "text",

      content:
        message,

      kakaoMessageId:
        params.kakaoMessageId ??
        null,

      attachmentData:
        undefined,

      /**
       * Immediate는 Callback 요청이 아니다.
       *
       * callback 상태를 processing으로 만들지 않는다.
       */
      callbackStatus:
        null,
    });

  /**
   * 동일 kakaoMessageId가 이미 저장돼 있으면
   * 기존 DB UNIQUE 정책에 의해 inserted=false.
   */
  if (
    insertedMessage.inserted !==
      true
  ) {
    return {
      conversationId,

      userMessageId:
        null,

      duplicateMessage:
        true,

      blocked:
        false,
    };
  }

  return {
    conversationId,

    userMessageId:
      normalizePositiveInteger(
        insertedMessage.id
      ),

    duplicateMessage:
      false,

    blocked:
      false,
  };
}

/**
 * Immediate AI 답변이 완성된 뒤
 * assistant 메시지만 저장한다.
 *
 * Callback 상태와는 연결하지 않는다.
 */
export async function finishKakaoAiImmediateHistory(
  params: {
    organizationId:
      number;

    conversationId:
      number;

    replyText:
      string;
  }
): Promise<KakaoAiImmediateHistoryFinishResult> {
  const organizationId =
    normalizePositiveInteger(
      params.organizationId
    );

  const conversationId =
    normalizePositiveInteger(
      params.conversationId
    );

  const replyText =
    normalizeText(
      params.replyText
    );

  if (
    !organizationId ||
    !conversationId ||
    !replyText
  ) {
    return {
      success:
        false,

      assistantMessageId:
        null,
    };
  }

  const assistantMessage =
    await db.insertKakaoAiMessage({
      organizationId,

      conversationId,

      role:
        "assistant",

      messageType:
        "text",

      content:
        replyText,

      kakaoMessageId:
        null,

      attachmentData:
        undefined,

      callbackStatus:
        null,
    });

  const assistantMessageId =
    normalizePositiveInteger(
      assistantMessage.id
    );

  return {
    success:
      Boolean(
        assistantMessageId
      ),

    assistantMessageId,
  };
}