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
  updateKakaoAiConsultationFlow,
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
  executeKakaoAiStaffAction,
  type KakaoAiStaffActionResult,
} from "./kakao-ai-staff-action";

import {
  executeKakaoAiLeadRegistrationAction,
  type KakaoAiLeadRegistrationActionResult,
} from "./kakao-ai-lead-registration-action";

import {
  executeKakaoAiCallbackRequestAction,
  type KakaoAiCallbackRequestActionResult,
} from "./kakao-ai-callback-request-action";

import {
  composeKakaoAiResponse,
  type KakaoAiResponseCompositionResult,
} from "./kakao-ai-response-composer";

import {
  handleKakaoAiRegistrationVerification,
  type KakaoAiRegistrationVerificationResult,
} from "./kakao-ai-registration-verifier";

import {
  recordKakaoAiStudentManagement,
} from "./kakao-ai-student-management-recorder";

import {
  executeKakaoAiAdministrativeReportAction,
} from "./kakao-ai-administrative-report-action";

import type {
  KakaoAiAttachmentContext,
} from "./kakao-ai-intent-router";

import {
  analyzeDocumentIntelligence,
} from "./document-intelligence.service";

import type {
  DocumentIntelligenceResult,
} from "./document-intelligence.types";

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
 * 담당자 목록 / 추천 / 선택 / 변경 /
 * 현재 선택 확인 Action 결과.
 *
 * 담당자 관련 요청이 아니면 null이다.
 */
staffAction:
  KakaoAiStaffActionResult | null;

/**
 * 신규 카카오 상담자의
 * 상담DB 자동접수 결과.
 */
leadRegistration:
  KakaoAiLeadRegistrationActionResult | null;

/**
 * 신규 상담자의
 * 담당자 전화상담 / 콜백 희망 기록 결과.
 */
callbackRequest:
  KakaoAiCallbackRequestActionResult | null;

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

function getDocumentIntelligenceFileUrl(
  attachmentData:
    unknown
): string | null {
  if (
    !attachmentData ||
    typeof attachmentData !==
      "object"
  ) {
    return null;
  }

  const rawUrl =
    (
      attachmentData as {
        url?: unknown;
      }
    ).url;

  if (
    typeof rawUrl !==
      "string"
  ) {
    return null;
  }

  const fileUrl =
    rawUrl.trim();

  if (
    !fileUrl
  ) {
    return null;
  }

  try {
    const parsedUrl =
      new URL(
        fileUrl
      );

    if (
      parsedUrl.protocol !==
        "https:" &&
      parsedUrl.protocol !==
        "http:"
    ) {
      return null;
    }

    return fileUrl;
  } catch {
    return null;
  }
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

staffAction:
  null,

leadRegistration:
  null,

callbackRequest:
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

staffAction:
  null,

leadRegistration:
  null,

callbackRequest:
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

let currentMemory =
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

/**
 * ---------------------------------------------------------
 * 공통 Document Intelligence
 * ---------------------------------------------------------
 *
 * 카카오에서 첨부된 이미지 / 문서는
 * 신규자 / 등록자 구분 없이 동일한 공통 엔진에서
 * 한 번만 분석한다.
 *
 * 신규자:
 * studentId = null
 *
 * 등록자:
 * 서버에서 인증된 customer.studentId 사용
 *
 * 중요:
 * - 카카오 메시지 내용으로 studentId를 결정하지 않는다.
 * - 이미지 하나당 Vision 분석은 한 번만 실행한다.
 * - 여기서는 분석만 수행하고 CRM을 직접 수정하지 않는다.
 */
const documentFileUrl =
  getDocumentIntelligenceFileUrl(
    params.attachmentData
  );

let documentIntelligence:
  DocumentIntelligenceResult |
  null =
  null;

if (
  documentFileUrl &&
  (
    attachmentContext.hasImage ||
    attachmentContext.hasDocument
  )
) {
  try {
    const documentStudentId =
      customer.customerType ===
        "registered" &&
      customer.verified ===
        true &&
      Number(
        customer.studentId ||
        0
      ) > 0
        ? Number(
            customer.studentId
          )
        : null;

    documentIntelligence =
      await analyzeDocumentIntelligence({
        organizationId,

        sourceType:
          "KAKAO_AI",

        inputType:
          attachmentContext.hasDocument
            ? "document"
            : "image",

        fileUrl:
          documentFileUrl,

        studentId:
          documentStudentId,

        /**
         * 현재 카카오 이미지 메시지는
         * userRequest.utterance가 이미지 URL 자체이므로
         * Orchestrator의 message는
         * "이미지를 첨부했습니다." 형태일 수 있다.
         *
         * 그래도 향후 캡션/텍스트가 같이 들어오는 경우를 위해
         * 문맥정보로 전달한다.
         */
        userMessage:
          message ||
          null,

        expectedDocumentType:
          null,
      });

    tracePerf(
      "document_intelligence_done",
      {
        analyzed:
          true,

        documentType:
          documentIntelligence
            .documentType,

        confidence:
          documentIntelligence
            .confidence,

        decision:
          documentIntelligence
            .decision,

        studentId:
          documentStudentId,

        canUseAcademicEngine:
          documentIntelligence
            .canUseAcademicEngine,

        canUseAdministrativeEngine:
          documentIntelligence
            .canUseAdministrativeEngine,
      }
    );

    console.log(
      "[KAKAO AI DOCUMENT INTELLIGENCE]",
      {
        organizationId,

        conversationId,

        customerType:
          customer.customerType,

        studentId:
          documentStudentId,

        documentType:
          documentIntelligence
            .documentType,

        confidence:
          documentIntelligence
            .confidence,

        decision:
          documentIntelligence
            .decision,

        summary:
          documentIntelligence
            .summary,

        warnings:
          documentIntelligence
            .warnings,

        missingEvidence:
          documentIntelligence
            .missingEvidence,
      }
    );
  } catch (
    error:
      unknown
  ) {
    /**
     * 문서 분석 실패 때문에
     * 카카오 전체 상담이 죽으면 안 된다.
     *
     * 일반 상담 흐름은 계속 진행하고,
     * 이후 Composer가 첨부자료 재전송을 안내할 수 있게
     * null 상태로 유지한다.
     */
    console.error(
      "[KAKAO AI DOCUMENT INTELLIGENCE] 분석 실패",
      error instanceof
        Error
        ? {
            organizationId,

            conversationId,

            message:
              error.message,
          }
        : {
            organizationId,

            conversationId,

            message:
              String(
                error
              ),
          }
    );

    documentIntelligence =
      null;

    tracePerf(
      "document_intelligence_failed"
    );
  }
}

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

    conversationId,

    routedIntent:
      intentClassification.routed,

    customer,

    structuredMemory:
      currentMemory,

    documentIntelligence,
  });

tracePerf(
  "context_done"
);

/**
 * ---------------------------------------------------------
 * 등록회원 행정절차 진행보고 Action
 * ---------------------------------------------------------
 *
 * "학습자등록 하는 중"
 * "학점인정 신청했어요"
 *
 * 같은 사용자의 직접 보고를
 * AI 학점요약 실제 행정상태에 반영한다.
 *
 * OCR 검증 전에는 completed 처리하지 않는다.
 */
let administrativeReportAction =
  null as Awaited<
    ReturnType<
      typeof executeKakaoAiAdministrativeReportAction
    >
  > | null;

if (
  customer.customerType ===
    "registered" &&
  customer.verified ===
    true &&
  intentClassification.intent
    .needsClarification !==
    true
) {
  try {
    administrativeReportAction =
      await executeKakaoAiAdministrativeReportAction({
        organizationId,

        customer,

        message,

        kakaoMessageId:
          params.kakaoMessageId ??
          null,

        hasAttachment:
          attachmentContext.hasImage ||
          attachmentContext.hasDocument,

documentIntelligence,
      });

    tracePerf(
      "administrative_report_action_done",
      {
        handled:
          administrativeReportAction.handled,

        procedureType:
          administrativeReportAction.procedureType,

        status:
          administrativeReportAction.status,

        changed:
          administrativeReportAction.changed,

        reason:
          administrativeReportAction.reason,
      }
    );
  } catch (
    error:
      unknown
  ) {
    console.error(
      "[KAKAO AI ADMIN REPORT] 처리 실패",
      error instanceof Error
        ? {
            organizationId,
            conversationId,
            message:
              error.message,
          }
        : {
            organizationId,
            conversationId,
            message:
              String(
                error
              ),
          }
    );
  }
}

console.log("[KAKAO AI TRACE] Context", {
  hasCompanyContext:
    !!resolvedContext.companyContext,

  hasLeadAcademicAnalysis:
    !!resolvedContext.leadAcademicAnalysis,

  hasRegisteredStudentAnalysis:
    !!resolvedContext.registeredStudentAnalysis,

  hasPracticeCenter:
    !!resolvedContext.practiceCenter,

  hasStaffContext:
    !!resolvedContext.staffContext,

  staffCandidateCount:
    resolvedContext.staffContext
      ?.candidates
      .length ?? 0,

  recommendedStaffUserId:
    resolvedContext.staffContext
      ?.recommendedStaff
      ?.userId ?? null,

  selectedStaffUserId:
    resolvedContext.staffContext
      ?.selectedStaff
      ?.userId ?? null,

  staffSelectionStatus:
    resolvedContext.staffContext
      ?.status ?? null,

  leadCanExplain:
    resolvedContext.leadAcademicAnalysis
      ?.canExplain ?? null,

  leadStatus:
    resolvedContext.leadAcademicAnalysis
      ?.status ?? null,

  leadRequestedCourse:
    resolvedContext.leadAcademicAnalysis
      ?.requestedCourse ?? null,

  leadUnresolvedReasons:
    resolvedContext.leadAcademicAnalysis
      ?.unresolvedReasons ?? [],
});

/**
 * 9.
 * 담당자 관련 Action 실행.
 *
 * 중요:
 *
 * - Intent Classifier
 * - 중앙 Access Policy
 * - Context Resolver
 *
 * 를 모두 통과한 뒤에만 실행한다.
 *
 * Intent 자체가 아직 clarification 상태이면
 * 실제 추천/선택/변경 Action은 수행하지 않는다.
 */
let staffAction:
  KakaoAiStaffActionResult | null =
  null;

if (
  intentClassification.intent
    .needsClarification !==
  true
) {
  const actionResult =
    await executeKakaoAiStaffAction({
      organizationId,

      conversationId,

      message,

      primaryCapability:
        intentClassification.intent
          .primaryCapability,

      allowedCapabilities:
        intentClassification.routed
          .allowedCapabilities,

      memory:
        currentMemory,

      staffContext:
        resolvedContext.staffContext,
    });

  if (
    actionResult.handled
  ) {
    staffAction =
      actionResult;
  }
}

tracePerf(
  "staff_action_done",
  {
    handled:
      staffAction?.handled ??
      false,

    action:
      staffAction?.action ??
      "none",

    success:
      staffAction?.success ??
      null,

    reason:
      staffAction?.reason ??
      null,

    needsClarification:
      staffAction
        ?.needsClarification ??
      false,
  }
);

console.log(
  "[KAKAO AI TRACE] StaffAction",
  {
    handled:
      staffAction?.handled ??
      false,

    action:
      staffAction?.action ??
      null,

    success:
      staffAction?.success ??
      null,

    reason:
      staffAction?.reason ??
      null,

    recommendedStaffUserId:
      Number(
        staffAction
          ?.recommendedStaff
          ?.userId ||
        0
      ) ||
      null,

    selectedStaffUserId:
      Number(
        staffAction
          ?.selectedStaff
          ?.userId ||
        0
      ) ||
      null,

    candidateCount:
      staffAction
        ?.candidates
        ?.length ??
      0,

    needsClarification:
      staffAction
        ?.needsClarification ??
      false,
  }
);

/**
 * 담당자 Action이 DB Memory를 변경했을 수 있으므로
 * Action 이후 최신 Conversation Memory를 다시 읽는다.
 *
 * 예:
 * - 담당자 목록 → lastStaffCandidates 변경
 * - 담당자 추천 → recommendedStaffUserId 변경
 * - 담당자 선택 → selectedStaffUserId 변경
 */
let finalResolvedContext =
  resolvedContext;

if (
  staffAction?.handled
) {
  const refreshedMemoryContext =
    await resolveKakaoAiMemoryContext({
      organizationId,

      conversationId,

      recentMessageLimit:
        20,
    });

  currentMemory =
    refreshedMemoryContext
      .structuredMemory;

  /**
   * 담당자 추천/선택 후 상태까지 반영된
   * 최신 staffContext를 Composer에 넘기기 위해
   * Context를 한 번 다시 해결한다.
   *
   * 이 재조회는 담당자 Action이 실제 처리된 경우에만 한다.
   */
  const refreshedResolvedContext =
  await resolveKakaoAiContext({
    organizationId,

    conversationId,

    routedIntent:
      intentClassification.routed,

    customer,

    structuredMemory:
      currentMemory,

    documentIntelligence,
  });

  /**
   * Staff Action 자체에서
   * "대상을 더 골라야 한다"는 결과가 나온 경우
   * 그 clarification을 최종 Context에 반영한다.
   *
   * 예:
   * "담당자 바꿔주세요"
   * → 누구로 바꿀지 없음
   */
  finalResolvedContext = {
    ...refreshedResolvedContext,

    needsClarification:
      staffAction
        .needsClarification
        ? true
        : refreshedResolvedContext
            .needsClarification,

    clarificationQuestion:
      staffAction
        .needsClarification
        ? staffAction
            .clarificationQuestion
        : refreshedResolvedContext
            .clarificationQuestion,

    clarificationOptions:
      staffAction
        .needsClarification
        ? staffAction
            .clarificationOptions
        : refreshedResolvedContext
            .clarificationOptions,
  };

  tracePerf(
    "staff_context_refreshed",
    {
      recommendedStaffUserId:
        currentMemory
          .recommendedStaffUserId,

      selectedStaffUserId:
        currentMemory
          .selectedStaffUserId,

      staffSelectionStatus:
        currentMemory
          .staffSelectionStatus,

      candidateCount:
        currentMemory
          .lastStaffCandidates
          .length,
    }
  );
}

/**
 * 10.
 * 신규 카카오 상담자 → 상담DB 자동접수.
 *
 * 담당자 Action 이후 실행한다.
 *
 * 이유:
 * 이번 메시지에서 담당자를 선택했다면
 * selectedStaffUserId가 최신 Memory에 반영된 뒤여야 한다.
 */
let leadRegistration:
  KakaoAiLeadRegistrationActionResult | null =
  null;

const leadRegistrationResult =
  await executeKakaoAiLeadRegistrationAction({
    organizationId,

    conversationId,

    customerType:
      customer.customerType,

    message,

    allowedCapabilities:
      intentClassification.routed
        .allowedCapabilities,

    memory:
      currentMemory,

    conversationHistory:
      previousMemoryContext
        .recentConversation
        .messages,
  });

if (
  leadRegistrationResult.handled
) {
  leadRegistration =
    leadRegistrationResult;
}

tracePerf(
  "lead_registration_done",
  {
    handled:
      leadRegistrationResult.handled,

    created:
      leadRegistrationResult.created,

    consultationId:
      leadRegistrationResult
        .consultationId,

    reason:
      leadRegistrationResult.reason,
  }
);

/**
 * 11.
 * 담당자 전화상담 / Callback 희망 처리.
 *
 * 반드시 Lead Registration 이후 실행한다.
 *
 * 이유:
 *
 * 같은 메시지에서
 * 성함 + 연락처 + 통화 희망시간을 보냈다면
 * Lead Registration이 먼저 상담DB를 생성하고
 * 그 consultationId에 Callback 내용을 기록해야 한다.
 */
let callbackRequest:
  KakaoAiCallbackRequestActionResult | null =
  null;

const callbackRequestResult =
  await executeKakaoAiCallbackRequestAction({
    organizationId,

    conversationId,

    customerType:
      customer.customerType,

    message,

    allowedCapabilities:
      intentClassification.routed
        .allowedCapabilities,

    conversationHistory:
      previousMemoryContext
        .recentConversation
        .messages,

    consultationId:
      leadRegistrationResult
        .consultationId,
  });

if (
  callbackRequestResult.handled
) {
  callbackRequest =
    callbackRequestResult;
}

tracePerf(
  "callback_request_done",
  {
    handled:
      callbackRequestResult.handled,

    saved:
      callbackRequestResult.saved,

    consultationId:
      callbackRequestResult
        .consultationId,

    reason:
      callbackRequestResult.reason,
  }
);

/**
 * Composer를 거치지 않고 서버 Action이 직접 응답하는 경우에도
 * 실제 발생한 상담 진행상태를 consultationFlow에 기록한다.
 *
 * 중요:
 * AI의 추측이 아니라 실제 서버 Action 결과만 사용한다.
 */
const serverActionConsultationFlowPatch:
  Partial<
    KakaoAiStructuredMemory[
      "consultationFlow"
    ]
  > = {};

/**
 * 담당자 추천 Action이 실제 실행되었다면
 * 담당자 추천 단계는 진행된 것으로 확정한다.
 */
if (
  staffAction?.handled ===
    true &&
  staffAction.action ===
    "recommend" &&
  staffAction.success ===
    true
) {
  serverActionConsultationFlowPatch
    .staffRecommendationOffered =
    true;
}

/**
 * 사용자가 상담접수/연결을 요청했지만
 * 아직 담당자를 선택하지 않은 경우,
 *
 * Lead Registration Action이
 * "담당자 추천해드릴게요"
 * 흐름을 직접 안내하므로
 * 담당자 추천 제안 상태를 기록한다.
 */
if (
  leadRegistration?.handled ===
    true &&
  leadRegistration.reason ===
    "STAFF_NOT_SELECTED"
) {
  serverActionConsultationFlowPatch
    .staffRecommendationOffered =
    true;
}

/**
 * 상담 접수 양식을 실제로 안내한 경우.
 *
 * CONTACT_NOT_DETECTED:
 * 성함/연락처 전체 양식을 안내
 *
 * INVALID_NAME / INVALID_PHONE:
 * 누락된 개인정보를 다시 요청
 *
 * created=true:
 * 이미 양식을 받아 실제 상담DB 생성까지 완료
 */
if (
  leadRegistration?.handled ===
    true &&
  (
    leadRegistration.created ===
      true ||
    leadRegistration.reason ===
      "CONTACT_NOT_DETECTED" ||
    leadRegistration.reason ===
      "INVALID_NAME" ||
    leadRegistration.reason ===
      "INVALID_PHONE"
  )
) {
  serverActionConsultationFlowPatch
    .consultationFormOffered =
    true;
}

/**
 * 전화상담 요청에서 상담DB 연결이 아직 없어
 * 성함/연락처를 다시 요구한 경우에도
 * 접수정보 요청 단계까지 진행된 것으로 기록한다.
 */
if (
  callbackRequest?.handled ===
    true &&
  callbackRequest.reason ===
    "CONSULTATION_NOT_LINKED"
) {
  serverActionConsultationFlowPatch
    .consultationFormOffered =
    true;
}

/**
 * 변경된 값이 있을 때만 DB를 갱신한다.
 */
if (
  Object.keys(
    serverActionConsultationFlowPatch
  ).length >
  0
) {
  currentMemory =
    await updateKakaoAiConsultationFlow({
      organizationId,

      conversationId,

      currentMemory,

      patch:
        serverActionConsultationFlowPatch,
    });
}

tracePerf(
  "server_action_consultation_flow_updated",
  {
    staffRecommendationOffered:
      currentMemory
        .consultationFlow
        .staffRecommendationOffered,

    consultationFormOffered:
      currentMemory
        .consultationFlow
        .consultationFormOffered,

    leadRegistrationHandled:
      leadRegistration
        ?.handled ??
      false,

    leadRegistrationCreated:
      leadRegistration
        ?.created ??
      false,

    leadRegistrationReason:
      leadRegistration
        ?.reason ??
      null,

    callbackHandled:
      callbackRequest
        ?.handled ??
      false,

    callbackSaved:
      callbackRequest
        ?.saved ??
      false,

    callbackReason:
      callbackRequest
        ?.reason ??
      null,
  }
);

if (
  leadRegistration?.handled ||
  callbackRequest?.handled
) {
  /**
   * Callback까지 실제 저장되었다면
   * Callback 결과가 더 최종적인 실행결과이므로
   * 해당 응답을 우선 사용한다.
   *
   * Callback이 저장되지 않았거나
   * Callback 요청 자체가 아니었다면
   * Lead Registration 응답을 사용한다.
   */
  const replyText =
    String(
      callbackRequest
        ?.replyText ||
      leadRegistration
        ?.replyText ||
      ""
    ).trim();

  if (
    replyText
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
          replyText,

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
      await db.markKakaoAiResponseReady({
        organizationId,

        userMessageId,

        responseMessageId,
      });
    }
  }

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

    resolvedContext:
      finalResolvedContext,

    staffAction,

    leadRegistration,

    callbackRequest,

    registrationVerification:
      null,

    responseComposition:
      null,
  };
}

/**
 * ---------------------------------------------------------
 * Document Intelligence → Academic Engine 통합 추적
 * ---------------------------------------------------------
 *
 * 실제 카카오 첨부파일이
 *
 * Vision
 * → Prior Academic
 * → Academic Engine
 * → Composer
 *
 * 까지 정상 전달됐는지
 * 한 로그에서 확인하기 위한 테스트 Trace.
 *
 * 개인정보 원문 / Base64 / 파일 URL은 출력하지 않는다.
 */
const integrationDocument =
  finalResolvedContext
    .documentIntelligence;

const integrationLeadAcademic =
  finalResolvedContext
    .leadAcademicAnalysis;

console.log(
  "[KAKAO AI INTEGRATION TRACE]",
  {
    organizationId,

    conversationId,

    customerType:
      customer.customerType,

    messageType,

    /**
     * 1. Attachment
     */
    hasAttachment:
      attachmentContext.hasImage ||
      attachmentContext.hasDocument,

    attachmentKind:
      attachmentContext.hasDocument
        ? "document"
        : attachmentContext.hasImage
          ? "image"
          : null,

    /**
     * 2. Document Intelligence
     */
    documentAnalyzed:
      Boolean(
        integrationDocument
      ),

    documentType:
      integrationDocument
        ?.documentType ??
      null,

    documentDecision:
      integrationDocument
        ?.decision ??
      null,

    documentConfidence:
      integrationDocument
        ?.confidence ??
      null,

    extractedSubjectCount:
      integrationDocument
        ?.academic
        ?.subjects
        ?.length ??
      0,

    canUseAcademicEngine:
      integrationDocument
        ?.canUseAcademicEngine ??
      false,

    canUseAdministrativeEngine:
      integrationDocument
        ?.canUseAdministrativeEngine ??
      false,

    /**
     * 3. Intent
     */
    primaryCapability:
      intentClassification
        .intent
        .primaryCapability,

    capabilities:
      intentClassification
        .intent
        .capabilities,

    /**
     * 4. Prior Academic → Academic Engine
     */
    hasLeadAcademicAnalysis:
      Boolean(
        integrationLeadAcademic
      ),

    leadStatus:
      integrationLeadAcademic
        ?.status ??
      null,

    leadCanExplain:
      integrationLeadAcademic
        ?.canExplain ??
      null,

    recognizedSubjectCount:
      integrationLeadAcademic
        ?.recognizedSubjects
        ?.length ??
      0,

    recognizedSubjectNames:
      integrationLeadAcademic
        ?.recognizedSubjects
        ?.slice(
          0,
          20
        )
        .map(
          subject =>
            subject.subjectName
        ) ??
      [],

    /**
     * 5. 최종 공통엔진 계산결과 존재 여부
     */
    hasAcademicSummary:
      Boolean(
        integrationLeadAcademic
          ?.academicSummary
      ),

    academicSummaryStatus:
      integrationLeadAcademic
        ?.academicSummary
        ?.status ??
      null,

    academicCanExplain:
      integrationLeadAcademic
        ?.academicSummary
        ?.canExplain ??
      null,

    academicUnresolvedReasons:
      integrationLeadAcademic
        ?.academicSummary
        ?.unresolvedReasons ??
      [],

    academicWarnings:
      integrationLeadAcademic
        ?.academicSummary
        ?.warnings ??
      [],
  }
);

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

    resolvedContext:
      finalResolvedContext,
  });

/**
 * Composer가 이번 답변에서 실제로 설명하거나
 * 제안한 신규 상담 진행상태를 Memory에 누적한다.
 *
 * consultationFlowPatch의 false는
 * 기존 완료상태를 false로 되돌린다는 뜻이 아니다.
 *
 * 이번 응답에서 새롭게 완료된 true 값만
 * 기존 consultationFlow에 누적한다.
 */
const consultationFlowPatch =
  responseComposition
    .consultationFlowPatch;

const consultationFlowTruePatch:
  Partial<
    KakaoAiStructuredMemory[
      "consultationFlow"
    ]
  > = {};

if (
  consultationFlowPatch
    .qualificationExplained ===
  true
) {
  consultationFlowTruePatch
    .qualificationExplained =
    true;
}

if (
  consultationFlowPatch
    .durationExplained ===
  true
) {
  consultationFlowTruePatch
    .durationExplained =
    true;
}

if (
  consultationFlowPatch
    .theoryExplained ===
  true
) {
  consultationFlowTruePatch
    .theoryExplained =
    true;
}

if (
  consultationFlowPatch
    .practicumExplained ===
  true
) {
  consultationFlowTruePatch
    .practicumExplained =
    true;
}

if (
  consultationFlowPatch
    .administrationExplained ===
  true
) {
  consultationFlowTruePatch
    .administrationExplained =
    true;
}

if (
  consultationFlowPatch
    .companyBenefitsExplained ===
  true
) {
  consultationFlowTruePatch
    .companyBenefitsExplained =
    true;
}

if (
  consultationFlowPatch
    .staffRecommendationOffered ===
  true
) {
  consultationFlowTruePatch
    .staffRecommendationOffered =
    true;
}

if (
  consultationFlowPatch
    .consultationFormOffered ===
  true
) {
  consultationFlowTruePatch
    .consultationFormOffered =
    true;
}

if (
  Object.keys(
    consultationFlowTruePatch
  ).length >
  0
) {
  currentMemory =
    await updateKakaoAiConsultationFlow({
      organizationId,

      conversationId,

      currentMemory,

      patch:
        consultationFlowTruePatch,
    });
}

tracePerf(
  "consultation_flow_updated",
  {
    qualificationExplained:
      currentMemory
        .consultationFlow
        .qualificationExplained,

    durationExplained:
      currentMemory
        .consultationFlow
        .durationExplained,

    theoryExplained:
      currentMemory
        .consultationFlow
        .theoryExplained,

    practicumExplained:
      currentMemory
        .consultationFlow
        .practicumExplained,

    administrationExplained:
      currentMemory
        .consultationFlow
        .administrationExplained,

    companyBenefitsExplained:
      currentMemory
        .consultationFlow
        .companyBenefitsExplained,

    staffRecommendationOffered:
      currentMemory
        .consultationFlow
        .staffRecommendationOffered,

    consultationFormOffered:
      currentMemory
        .consultationFlow
        .consultationFormOffered,
  }
);

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

  consultationFlowPatch:
    responseComposition
      .consultationFlowPatch,

  consultationFlow:
    currentMemory
      .consultationFlow,

  errorMessage:
    responseComposition.errorMessage,
});

  const replyText =
    String(
      responseComposition.replyText ||
      ""
    ).trim();

/**
 * ---------------------------------------------------------
 * 등록회원 AI 학습관리 후처리
 * ---------------------------------------------------------
 *
 * 최종 Context + Intent + 답변까지 모두 확정된 뒤
 * 학점요약에 남길 가치가 있는 문의만 기록한다.
 *
 * 중요:
 *
 * - 상세페이지 수정 X
 * - 행정절차 완료처리 X
 * - 단순 카카오 메시지마다 이벤트 생성 X
 *
 * 이번 단계에서는
 * AI 중요메모 / 담당자 확인 이벤트만 생성한다.
 */
if (
  customer.customerType ===
    "registered" &&
  customer.verified ===
    true &&
  administrativeReportAction?.handled !==
    true
) {
  try {
    const managementRecord =
      await recordKakaoAiStudentManagement({
        organizationId,

        customer,

        message,

        kakaoMessageId:
          params.kakaoMessageId ??
          null,

        intentClassification,

        resolvedContext:
          finalResolvedContext,

        replyText,
      });

    tracePerf(
      "registered_management_recorded",
      {
        handled:
          managementRecord.handled,

        noteCreated:
          managementRecord.noteCreated,

        eventCreated:
          managementRecord.eventCreated,

        unreadCount:
          managementRecord.unreadCount,

        reason:
          managementRecord.reason,
      }
    );
  } catch (
    error:
      unknown
  ) {
    /**
     * 관리메모 기록 실패 때문에
     * 사용자 카카오 답변 자체가 실패하면 안 된다.
     *
     * 실제 업무데이터 수정과 달리
     * 이 단계는 보조 관리기록이므로
     * 답변 파이프라인과 장애격리한다.
     */
    console.error(
      "[KAKAO AI STUDENT MANAGEMENT] 기록 실패",
      error instanceof Error
        ? {
            organizationId,
            conversationId,

            message:
              error.message,
          }
        : {
            organizationId,
            conversationId,

            message:
              String(
                error
              ),
          }
    );
  }
}

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

/**
 * replyText 저장 처리 종료.
 */
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

  resolvedContext:
    finalResolvedContext,

  staffAction,

leadRegistration,

callbackRequest,

registrationVerification:
  null,

responseComposition,
};
}