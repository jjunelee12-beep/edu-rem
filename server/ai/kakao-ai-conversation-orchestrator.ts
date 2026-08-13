import * as db from "../db";

import {
  createLeadKakaoAiCustomerContext,
  type KakaoAiCustomerContext,
} from "./kakao-ai-customer-resolver";

import {
  resolveKakaoAiMemoryContext,
  type KakaoAiMemoryContext,
  type KakaoAiStructuredMemory,
} from "./kakao-ai-memory-resolver";

import {
  extractKakaoAiUserMemory,
  type KakaoAiMemoryExtractionResult,
} from "./kakao-ai-memory-extractor";

import {
  applyKakaoAiVerifiedMemoryPatch,
  type KakaoAiMemoryWriteResult,
} from "./kakao-ai-memory-writer";

import {
  classifyKakaoAiIntent,
  type KakaoAiIntentClassificationResult,
} from "./kakao-ai-intent-classifier";

import {
  resolveKakaoAiContext,
  type KakaoAiResolvedContext,
} from "./kakao-ai-context-resolver";

import {
  composeKakaoAiResponse,
  type KakaoAiResponseCompositionResult,
} from "./kakao-ai-response-composer";

import {
  handleKakaoAiRegistrationVerification,
  type KakaoAiRegistrationVerificationResult,
} from "./kakao-ai-registration-verifier";

import type {
  KakaoAiAttachmentContext,
} from "./kakao-ai-intent-router";

/**
 * 카카오 AI의 한 사용자 메시지를 처리하는
 * 중앙 Orchestrator의 첫 단계.
 *
 * 아직 최종 자연어 답변은 생성하지 않는다.
 *
 * 현재 역할:
 *
 * 카카오 사용자
 * ↓
 * Conversation 확인
 * ↓
 * 서버 고객상태 복원
 * ↓
 * 이전 대화 / Memory 조회
 * ↓
 * 사용자 메시지 저장
 * ↓
 * 사용자 직접발언 Memory 추출
 * ↓
 * 검증된 Memory 반영
 * ↓
 * Intent 분석
 * ↓
 * Access Policy
 * ↓
 * 실제 필요한 Context 조회
 */

export type KakaoAiIncomingMessageType =
  | "text"
  | "image"
  | "document";

export type KakaoAiConversationOrchestratorResult = {
  organizationId:
    number;

  conversationId:
    number;

  /**
   * 같은 카카오 webhook이 중복 수신된 경우.
   *
   * true이면 이후 응답 생성을 다시 하지 않는다.
   */
  duplicateMessage:
    boolean;

  customer:
    KakaoAiCustomerContext;

  /**
   * 현재 사용자 메시지를 처리하기 전
   * Memory / 대화상태.
   */
  previousMemoryContext:
    KakaoAiMemoryContext;

  /**
   * 사용자 직접발언 Memory 추출결과.
   */
  memoryExtraction:
    KakaoAiMemoryExtractionResult | null;

  /**
   * 실제 DB 반영 결과.
   */
  memoryWrite:
    KakaoAiMemoryWriteResult | null;

  /**
   * 현재 메시지까지 반영된 최신 구조화 Memory.
   */
  currentMemory:
    KakaoAiStructuredMemory;

  /**
   * 자연어 Intent + 중앙 권한판정 결과.
   */
  intentClassification:
    KakaoAiIntentClassificationResult | null;

  /**
   * 회사 / 등록학생 / 실습센터 등
   * 실제 Context Resolver 결과.
   */
  resolvedContext:
    KakaoAiResolvedContext | null;

  /**
   * 이번 메시지에서 수행된
   * 등록회원 최초 인증 결과.
   *
   * 일반 상담 메시지이면 null.
   */
  registrationVerification:
    KakaoAiRegistrationVerificationResult | null;

  /**
   * 최종 자연어 답변 생성결과.
   *
   * duplicateMessage=true이면 null.
   */
  responseComposition:
    KakaoAiResponseCompositionResult | null;
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

/**
 * DB Conversation Row를 기준으로
 * 현재 카카오 고객상태를 서버에서 복원한다.
 *
 * 중요:
 *
 * 카카오 메시지 내용이나 AI 모델이
 * "나는 등록자다"라고 말하는 것은 신뢰하지 않는다.
 *
 * DB에 등록회원으로 연결되어 있더라도
 * 실제 학생이 사라졌거나 승인상태가 변경됐으면
 * 다시 lead로 초기화한다.
 */
async function restoreKakaoAiCustomerContext(
  params: {
    organizationId:
      number;

    conversationId:
      number;
  }
): Promise<KakaoAiCustomerContext> {
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

  const conversation =
    await db.getKakaoAiConversationById({
      organizationId,

      conversationId,
    });

  if (
    !conversation
  ) {
    throw new Error(
      "카카오 AI 대화정보를 찾을 수 없습니다."
    );
  }

  /**
   * 아직 등록회원으로 인증되지 않은 경우.
   */
  if (
    conversation.customerType !==
      "registered" ||
    !Number(
      conversation.studentId ||
      0
    )
  ) {
    return createLeadKakaoAiCustomerContext({
      organizationId,
    });
  }

  const studentId =
    normalizePositiveInteger(
      conversation.studentId,
      "등록회원 학생"
    );

  /**
   * DB에 연결된 studentId도 매 요청마다
   * 실제 같은 organization인지 다시 조회한다.
   */
  const student =
    await db.getStudentById(
      studentId,
      {
        organizationId,
      }
    );

  /**
   * 학생이 없어졌거나 승인상태가 변경된 경우
   * 기존 카카오 등록회원 연결을 신뢰하지 않는다.
   */
  if (
    !student ||
    String(
      (student as any)
        .approvalStatus ||
      ""
    ).trim() !==
      "승인"
  ) {
    await db.clearKakaoAiConversationStudent({
      organizationId,

      conversationId,
    });

    return createLeadKakaoAiCustomerContext({
      organizationId,
    });
  }

  return {
    customerType:
      "registered",

    verified:
      true,

    organizationId,

    studentId:
      Number(
        student.id
      ),

    studentName:
      student.clientName ??
      null,

    course:
      student.course ??
      null,

    finalEducation:
      student.finalEducation ??
      null,

    assigneeId:
      Number(
        student.assigneeId ||
        0
      ) ||
      null,

    verificationStatus:
      "registered",

    verificationMessage:
      null,
  };
}

/**
 * 카카오 메시지 타입과 첨부정보를
 * Intent Classifier용 최소 Context로 변환한다.
 */
function buildAttachmentContext(
  params: {
    messageType:
      KakaoAiIncomingMessageType;

    attachmentData?:
      unknown;
  }
): KakaoAiAttachmentContext {
  const hasAttachmentData =
    params.attachmentData !==
      undefined &&
    params.attachmentData !==
      null;

  return {
    hasImage:
      params.messageType ===
        "image" &&
      hasAttachmentData,

    hasDocument:
      params.messageType ===
        "document" &&
      hasAttachmentData,

    attachmentCount:
      hasAttachmentData
        ? 1
        : 0,
  };
}

/**
 * 사용자 메시지 하나의 중앙 처리.
 *
 * 아직:
 * - 최종 답변 생성 X
 * - 카카오 답장 발송 X
 * - OCR 실행 X
 *
 * 이번 단계에서는
 * 대화 / Memory / Intent / Context까지
 * 일관되게 연결한다.
 */
export async function orchestrateKakaoAiIncomingMessage(
  params: {
    organizationId:
      number;

    /**
     * 카카오에서 전달되는 사용자 식별키.
     *
     * DB에는 원문이 아니라 hash만 저장된다.
     */
    channelUserKey:
      string;

    /**
     * 카카오 외부 메시지 ID.
     *
     * webhook 중복 수신 방지용.
     */
    kakaoMessageId?:
      string | null;

    messageType?:
      KakaoAiIncomingMessageType;

    message:
      string;

    /**
     * 이미지 / 문서 관련 내부정보.
     *
     * db.ts에서 암호화 저장된다.
     */
    attachmentData?:
      unknown;
  }
): Promise<KakaoAiConversationOrchestratorResult> {

const perfStartedAt = Date.now();
let perfCheckpointAt = perfStartedAt;

const tracePerf = (
  stage: string,
  extra?: Record<string, unknown>
) => {
  const now = Date.now();

  console.log(
    "[KAKAO AI PERF]",
    {
      stage,

      stepMs:
        now - perfCheckpointAt,

      totalMs:
        now - perfStartedAt,

      organizationId:
        params.organizationId,

      ...(extra || {}),
    }
  );

  perfCheckpointAt = now;
};

  const organizationId =
    normalizePositiveInteger(
      params.organizationId,
      "카카오 AI 회사"
    );

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

  const messageType =
    params.messageType ||
    "text";

  const message =
    String(
      params.message ??
      ""
    );

  if (
    !message.trim() &&
    params.attachmentData ===
      undefined
  ) {
    throw new Error(
      "카카오 메시지 내용이 없습니다."
    );
  }

  /**
   * 1.
   * 사용자별 Conversation 조회 / 생성.
   */
  const conversation =
  await db.getOrCreateKakaoAiConversation({
    organizationId,

    channelUserKey,
  });

tracePerf(
  "conversation_ready"
);

const conversationId =
    normalizePositiveInteger(
      conversation.id,
      "카카오 AI 대화"
    );

  /**
   * 차단된 대화방은 AI 처리를 진행하지 않는다.
   */
  if (
    String(
      conversation.status ||
      ""
    ) ===
    "blocked"
  ) {
    throw new Error(
      "현재 카카오 AI 상담을 이용할 수 없습니다."
    );
  }

  /**
   * 2.
   * 현재 서버 인증 고객상태 복원.
   */
  const customer =
  await restoreKakaoAiCustomerContext({
    organizationId,

    conversationId,
  });

tracePerf(
  "customer_restored"
);

/**
 * 3.
   * 현재 사용자 메시지를 넣기 전에
   * 이전 최근 대화 + Memory를 읽는다.
   *
   * 그래야 Intent에:
   *
   * currentMessage
   *
   * 와
   *
   * conversationHistory
   *
   * 가 중복되지 않는다.
   */
  const previousMemoryContext =
  await resolveKakaoAiMemoryContext({
    organizationId,

    conversationId,

    recentMessageLimit:
      20,
  });

tracePerf(
  "memory_context_loaded"
);

/**
 * 4.
   * 사용자 원본 메시지 저장.
   *
   * kakaoMessageId UNIQUE를 이용해서
   * 동일 webhook 재수신을 차단한다.
   */
  const insertedMessage =
  await db.insertKakaoAiMessage({
    organizationId,

    conversationId,

    role:
      "user",

    messageType,

    content:
      message,

    kakaoMessageId:
      params.kakaoMessageId ??
      null,

    attachmentData:
      params.attachmentData,

    callbackStatus:
  params.kakaoMessageId
    ? "processing"
    : null,
});

tracePerf(
  "user_message_inserted",
  {
    inserted:
      insertedMessage.inserted ===
      true,
  }
);

const userMessageId =
  insertedMessage.inserted ===
    true
    ? Number(
        insertedMessage.id ||
        0
      )
    : 0;

  /**
   * 이미 저장된 외부 메시지라면
   * OpenAI를 다시 호출하지 않는다.
   */
  if (
    insertedMessage.inserted !==
    true
  ) {
    return {
      organizationId,

      conversationId,

      duplicateMessage:
        true,

      customer,

      previousMemoryContext,

      memoryExtraction:
        null,

      memoryWrite:
        null,

      currentMemory:
        previousMemoryContext
          .structuredMemory,

      intentClassification:
        null,

      resolvedContext:
        null,

      registrationVerification:
        null,

      responseComposition:
        null,
    };
  }

  /**
   * 5.
   * 등록회원 최초 1회 인증 흐름을 먼저 확인한다.
   *
   * 인증은 일반 Intent / Access Policy보다 앞에서 처리한다.
   *
   * 이유:
   * "저 등록자인데요"
   * "홍길동 010-1234-5678"
   *
   * 같은 메시지는 일반 학점은행제 상담질문이 아니라
   * 서버 신원확인 절차이기 때문이다.
   */
  const registrationVerification =
  await handleKakaoAiRegistrationVerification({
    organizationId,

    conversationId,

    currentCustomer:
      customer,

    message,

    conversationHistory:
      previousMemoryContext
        .recentConversation
        .messages,
  });

tracePerf(
  "registration_verification_done",
  {
    handled:
      registrationVerification.handled,
  }
);

/**
 * 인증 Handler가 이번 메시지를 처리했다면
   * 일반 Memory / Intent / Context / Composer 흐름으로
   * 다시 보내지 않는다.
   *
   * 인증질문과 일반상담 응답이
   * 한 메시지에서 중복 생성되는 것을 방지한다.
   */
  if (
    registrationVerification.handled
  ) {
    const verificationReply =
      String(
        registrationVerification.replyText ||
        ""
      ).trim();

    if (
  verificationReply
) {
  const assistantMessage =
    await db.insertKakaoAiMessage({
      organizationId,

      conversationId,

      role:
        "assistant",

      messageType:
        "text",

      content:
        verificationReply,

      kakaoMessageId:
        null,

      attachmentData:
        undefined,
    });

  const responseMessageId =
    Number(
      assistantMessage.id ||
      0
    );

  if (
  userMessageId > 0 &&
  responseMessageId > 0 &&
  params.kakaoMessageId
) {
  console.log(
    "[KAKAO AI TRACE] PostResponse",
    {
      stage:
        "response_ready_start",

      organizationId,
      conversationId,

      userMessageId,
      responseMessageId,
    }
  );

  await db.markKakaoAiResponseReady({
    organizationId,

    userMessageId,

    responseMessageId,
  });

  console.log(
    "[KAKAO AI TRACE] PostResponse",
    {
      stage:
        "response_ready_done",

      organizationId,
      conversationId,

      userMessageId,
      responseMessageId,
    }
  );
}
}

console.log(
  "[KAKAO AI TRACE] PostResponse",
  {
    stage:
      "orchestrator_return",

    organizationId,
    conversationId,

    userMessageId,
  }
);

    /**
     * 인증 성공 시 Handler 내부에서
     * Conversation ↔ studentId bind까지 완료된다.
     *
     * 이번 응답은 인증 완료 안내로 종료하고,
     * 다음 사용자 메시지부터 restore 단계에서
     * registered 고객으로 복원된다.
     */
    return {
      organizationId,

      conversationId,

      duplicateMessage:
        false,

      customer:
        registrationVerification.customer ||
        customer,

      previousMemoryContext,

      memoryExtraction:
        null,

      memoryWrite:
        null,

      currentMemory:
        previousMemoryContext
          .structuredMemory,

      intentClassification:
        null,

      resolvedContext:
        null,

      registrationVerification,

      responseComposition:
        null,
    };
  }

  /**
   * 5.
   * 현재 사용자의 직접 발언에서
   * Memory 후보 추출.
   *
   * OCR / CRM / 규칙엔진 사실은
   * 여기서 추출하지 않는다.
   */
  const memoryExtraction =
  await extractKakaoAiUserMemory({
    message,

    currentMemory:
      previousMemoryContext
        .structuredMemory,
  });

tracePerf(
  "memory_extraction_done"
);

/**
 * 6.
   * 서버 검증을 통과한 safePatch만
   * 실제 Memory DB에 반영.
   */
  const memoryWrite =
  await applyKakaoAiVerifiedMemoryPatch({
    organizationId,

    conversationId,

    currentMemory:
      previousMemoryContext
        .structuredMemory,

    patch:
      memoryExtraction.safePatch,
  });

tracePerf(
  "memory_write_done"
);

const currentMemory =
    memoryWrite.memory;

console.log("[KAKAO AI TRACE] Memory", {
  desiredCourse:
    currentMemory.desiredCourse ?? null,
  finalEducation:
    currentMemory.finalEducation ?? null,
  currentTopic:
    currentMemory.currentTopic ?? null,
  hasTransferCollege:
    currentMemory.hasTransferCollege ?? null,
});

  /**
   * 7.
   * 현재 메시지 Intent 분석.
   *
   * conversationHistory는
   * 현재 메시지를 저장하기 전의 최근 대화.
   *
   * structuredMemory는
   * 방금 현재 메시지에서 새로 확인된 사실까지
   * 반영된 최신 Memory.
   */
  const attachmentContext =
    buildAttachmentContext({
      messageType,

      attachmentData:
        params.attachmentData,
    });

  const intentClassification =
  await classifyKakaoAiIntent({
    customerType:
      customer.customerType,

    message,

    conversationHistory:
      previousMemoryContext
        .recentConversation
        .messages,

    structuredMemory:
      currentMemory,

    attachmentContext,
  });

tracePerf(
  "intent_done",
  {
    primaryCapability:
      intentClassification
        .intent
        .primaryCapability,
  }
);

console.log("[KAKAO AI TRACE] Intent", {
  domain:
    intentClassification.intent.domain,
  userGoal:
    intentClassification.intent.userGoal,
  primaryCapability:
    intentClassification.intent.primaryCapability,
  capabilities:
    intentClassification.intent.capabilities,
  needsClarification:
    intentClassification.intent.needsClarification,
  requiredContexts:
    intentClassification.routed.requiredContexts,
});

  /**
   * 8.
   * 중앙 Access Policy가 적용된 Intent를 기준으로
   * 실제 필요한 Context를 해결한다.
   */
    const resolvedContext =
  await resolveKakaoAiContext({
    organizationId,

    routedIntent:
      intentClassification.routed,

    customer,

    structuredMemory:
      currentMemory,
  });

tracePerf(
  "context_done"
);

console.log("[KAKAO AI TRACE] Context", {
  hasCompanyContext:
    !!resolvedContext.companyContext,
  hasLeadAcademicAnalysis:
    !!resolvedContext.leadAcademicAnalysis,
  hasRegisteredStudentAnalysis:
    !!resolvedContext.registeredStudentAnalysis,
  hasPracticeCenter:
    !!resolvedContext.practiceCenter,
  leadCanExplain:
    resolvedContext.leadAcademicAnalysis?.canExplain ?? null,
  leadStatus:
    resolvedContext.leadAcademicAnalysis?.status ?? null,
  leadRequestedCourse:
    resolvedContext.leadAcademicAnalysis?.requestedCourse ?? null,
  leadUnresolvedReasons:
    resolvedContext.leadAcademicAnalysis?.unresolvedReasons ?? [],
});

  /**
   * 9.
   * 지금까지 서버에서 확정한 모든 Context를
   * 실제 사람다운 카카오 자연어 답변으로 조합한다.
   *
   * Composer는:
   * - 학점 계산 X
   * - 법규 계산 X
   * - DB 조회 X
   *
   * 이미 확정된 Context를 설명만 한다.
   */
  const responseComposition =
  await composeKakaoAiResponse({
    message,

    customer,

    memory:
      currentMemory,

    conversationHistory:
      previousMemoryContext
        .recentConversation
        .messages,

    intentClassification,

    resolvedContext,
  });

tracePerf(
  "composer_done",
  {
    success:
      responseComposition.success,

    fallbackUsed:
      responseComposition.fallbackUsed,
  }
);

console.log("[KAKAO AI TRACE] Response", {
  success:
    responseComposition.success,
  fallbackUsed:
    responseComposition.fallbackUsed,
  askedClarification:
    responseComposition.askedClarification,
  usedContextTypes:
    responseComposition.usedContextTypes,
  errorMessage:
    responseComposition.errorMessage,
});

  const replyText =
    String(
      responseComposition.replyText ||
      ""
    ).trim();

console.log(
  "[KAKAO AI TRACE] PostResponse",
  {
    stage:
      "reply_text_ready",

    organizationId,
    conversationId,

    userMessageId,

    hasKakaoMessageId:
      Boolean(
        params.kakaoMessageId
      ),

    replyTextLength:
      replyText.length,
  }
);

  /**
   * Composer가 fallback을 사용했더라도
   * 실제 고객에게 전송 가능한 replyText가 존재하면
   * 대화 History에 남긴다.
   *
   * success=false는
   * "고객에게 답변하지 않는다"는 뜻이 아니라
   * OpenAI 장애 등으로 fallback 답변을 사용했다는
   * 의미일 수 있다.
   */
  if (
  replyText
) {

console.log(
  "[KAKAO AI TRACE] PostResponse",
  {
    stage:
      "assistant_insert_start",

    organizationId,
    conversationId,
    userMessageId,
  }
);
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
  });

tracePerf(
  "assistant_message_inserted"
);

console.log(
  "[KAKAO AI TRACE] PostResponse",
  {
    stage:
      "assistant_insert_done",

    organizationId,
    conversationId,
    userMessageId,

    assistantMessageId:
      Number(
        assistantMessage.id ||
        0
      ),
  }
);

  const responseMessageId =
    Number(
      assistantMessage.id ||
      0
    );

 if (
  userMessageId >
    0 &&
  responseMessageId >
    0 &&
  params.kakaoMessageId
) {
  console.log(
    "[KAKAO AI TRACE] PostResponse",
    {
      stage:
        "response_ready_start",

      organizationId,
      conversationId,

      userMessageId,
      responseMessageId,
    }
  );

  await db.markKakaoAiResponseReady({
  organizationId,

  userMessageId,

  responseMessageId,
});

tracePerf(
  "response_ready_db_done"
);

console.log(
  "[KAKAO AI TRACE] PostResponse",
  {
    stage:
      "response_ready_done",

    organizationId,
    conversationId,

    userMessageId,
    responseMessageId,
  }
);
}

tracePerf(
  "orchestrator_complete",
  {
    replyTextLength:
      replyText.length,
  }
);

return {
    organizationId,

    conversationId,

    duplicateMessage:
      false,

    customer,

    previousMemoryContext,

    memoryExtraction,

    memoryWrite,

    currentMemory,

        intentClassification,

    resolvedContext,

    registrationVerification,

    responseComposition,
  };
}