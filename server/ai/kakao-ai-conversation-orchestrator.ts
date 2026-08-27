import * as db from "../db";

import {
  createLeadKakaoAiCustomerContext,
  type KakaoAiCustomerContext,
} from "./kakao-ai-customer-resolver";

import {
  resolveKakaoAiMemoryContext,
  type KakaoAiMemoryContext,
  type KakaoAiStructuredMemory,
  type KakaoAiPriorSubjectCandidate,
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
  resolveKakaoAiLeadSemanticDecision,
  type KakaoAiIntentClassificationResult,
} from "./kakao-ai-intent-classifier";

import {
  resolveKakaoAiContext,
  type KakaoAiResolvedContext,
} from "./kakao-ai-context-resolver";

import {
  evaluateKakaoAiLeadFlow,
  type KakaoAiLeadFlowEvaluationResult,
} from "./kakao-ai-lead-flow-engine";

import {
  executeKakaoAiStaffAction,
  type KakaoAiStaffActionResult,
} from "./kakao-ai-staff-action";

import {
  runKakaoAiStaffAssistant,
} from "./kakao-ai-staff-assistant-runner";

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
  routeKakaoAiCommand,
} from "./kakao-ai-command-router";

import {
  checkKakaoAiDeveloperAccess,
} from "./kakao-ai-developer-gate";

import {
  executeKakaoAiDeveloperTestAction,
} from "./kakao-ai-developer-test-action";

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

import {
  analyzeDocumentAssistance,
} from "./document-assistance.service";

import type {
  DocumentAssistanceResult,
} from "./document-assistance.types";

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
 * =========================================================
 * Lead Flow - Composer Action 완료 상태 서버 확정
 * =========================================================
 *
 * 신규상담 Flow가 활성화된 경우
 * Composer가 consultationFlowPatch를 임의 판단하여
 * 상담단계 완료상태를 결정하지 않게 한다.
 *
 * Flow Engine이 이번 턴에 실행하라고 결정한 actionId와
 * Composer의 실제 성공 여부를 기준으로
 * 서버가 완료 Memory를 확정한다.
 *
 * STAFF / CONSULTATION은 여기서 처리하지 않는다.
 * 해당 단계는 실제 StaffAction / LeadRegistrationAction
 * 결과를 기준으로 별도 서버 Action 구간에서 확정한다.
 */
function buildServerConfirmedLeadFlowPatch(
  actionId:
    string |
    null |
    undefined
): Partial<
  KakaoAiStructuredMemory[
    "consultationFlow"
  ]
> {
  const normalizedActionId =
    normalizeText(
      actionId
    );

  switch (
    normalizedActionId
  ) {
    /**
     * TRUST
     */
    case "explain_trust_summary":
      return {
        trustExplained:
          true,
      };

    /**
     * OVERVIEW
     */
    case "explain_course_overview_summary":
      return {
        courseOverviewExplained:
          true,
      };

    /**
     * THEORY
     */
    case "explain_theory_summary":
      return {
        theoryExplained:
          true,
      };

    case "explain_theory_detail":
    case "answer_theory_detail_followup":
      return {
        theoryDetailExplained:
          true,
      };

    /**
     * PRACTICUM
     */
    case "explain_practicum_summary":
      return {
        practicumExplained:
          true,
      };

    case "explain_practicum_detail":
    case "answer_practicum_detail_followup":
      return {
        practicumDetailExplained:
          true,
      };

    /**
     * ADMINISTRATION
     */
    case "explain_administrative_summary":
      return {
        administrationExplained:
          true,
      };

    case "explain_administrative_detail":
    case "answer_administrative_detail_followup":
      return {
        administrationDetailExplained:
          true,
      };

    /**
     * CERTIFICATE
     */
    case "explain_certificate_summary":
      return {
        certificateExplained:
          true,
      };

    case "explain_certificate_detail":
    case "answer_certificate_detail_followup":
      return {
        certificateDetailExplained:
          true,
      };

    /**
     * BENEFITS
     */
    case "explain_benefits_summary":
      return {
        companyBenefitsExplained:
          true,
      };

    case "explain_benefits_detail":
    case "answer_benefits_detail_followup":
      return {
        companyBenefitsDetailExplained:
          true,
      };

    default:
      return {};
  }
}

/**
 * =========================================================
 * Lead Flow 공통 Facts Builder
 * =========================================================
 *
 * Flow Config의 condition.path가 조회할 수 있는
 * 서버 확정 사실 묶음을 만든다.
 *
 * 중요:
 * - 특정 상담단계 모름
 * - 특정 과정 모름
 * - 특정 Action 모름
 * - Flow 순서 모름
 *
 * 회사별 leadFlowConfig가
 * 아래 facts 경로를 조합해 완료조건을 정의한다.
 */
function buildKakaoAiLeadFlowFacts(
  params: {
    memory:
      KakaoAiStructuredMemory;

    customer:
      KakaoAiCustomerContext;

    intentClassification:
      KakaoAiIntentClassificationResult;

    resolvedContext:
      KakaoAiResolvedContext;

    staffAction?:
      KakaoAiStaffActionResult |
      null;

    leadRegistration?:
      KakaoAiLeadRegistrationActionResult |
      null;

    callbackRequest?:
      KakaoAiCallbackRequestActionResult |
      null;
  }
): Record<
  string,
  unknown
> {
  return {
    memory:
      params.memory,

    customer:
      params.customer,

    intent: {
      domain:
        params.intentClassification
          .intent
          .domain,

      userGoal:
        params.intentClassification
          .intent
          .userGoal,

      primaryCapability:
        params.intentClassification
          .intent
          .primaryCapability,

      capabilities:
        params.intentClassification
          .intent
          .capabilities,

      needsClarification:
        params.intentClassification
          .intent
          .needsClarification,
    },

    context:
      params.resolvedContext,

    actions: {
      staff:
        params.staffAction ??
        null,

      registration:
        params.leadRegistration ??
        null,

      callback:
        params.callbackRequest ??
        null,
    },
  };
}


/**
 * DB Conversation Row를 기준으로
 * 현재 카카오 고객상태를 서버에서 복원한다.
 *
 * 우선순위:
 *
 * 1. Developer Test Override
 * 2. 실제 등록회원 인증 상태
 * 3. 신규 상담자
 *
 * 중요:
 *
 * Developer Test Override는
 * 실제 customerType / studentId를 변경하지 않는다.
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
   * =========================================================
   * Developer Test Override
   * =========================================================
   *
   * 개발자 테스트 모드가 존재하면
   * 실제 customerType / studentId보다 우선한다.
   *
   * 이 값은 일반 사용자에게는 설정될 수 없고
   * Developer Gate를 통과한 명령에서만 저장된다.
   */
  const developerTestMode =
    String(
      (conversation as any)
        .developerTestMode ||
      ""
    ).trim();

  /**
   * ---------------------------------------------------------
   * Developer Lead Test
   * ---------------------------------------------------------
   *
   * 실제 카카오 계정이 등록회원으로 묶여 있더라도
   * 테스트 중에는 신규 상담자로 동작한다.
   *
   * 실제 등록회원 바인딩은 삭제하지 않는다.
   */
  if (
    developerTestMode ===
      "lead"
  ) {
    return createLeadKakaoAiCustomerContext({
      organizationId,
    });
  }

  /**
   * ---------------------------------------------------------
   * Developer Registered Student Test
   * ---------------------------------------------------------
   */
  if (
    developerTestMode ===
      "registered"
  ) {
    const developerTestStudentId =
      Math.floor(
        Number(
          (conversation as any)
            .developerTestStudentId ||
          0
        )
      );

    /**
     * 잘못된 테스트 상태가 DB에 남아 있다면
     * 운영 studentId에는 손대지 않고
     * Developer Test Session만 제거한다.
     */
    if (
      !Number.isFinite(
        developerTestStudentId
      ) ||
      developerTestStudentId <=
        0
    ) {
      await db.clearKakaoAiDeveloperTestSession({
        organizationId,

        conversationId,
      });

      return createLeadKakaoAiCustomerContext({
        organizationId,
      });
    }

    /**
     * 테스트 대상 학생도 매 요청마다
     * 실제 같은 organization에서 다시 조회한다.
     */
    const developerStudent =
      await db.getStudentById(
        developerTestStudentId,
        {
          organizationId,
        }
      );

    /**
     * 학생 삭제 / 승인 해제 등이 발생하면
     * 테스트 Session만 자동 해제한다.
     *
     * 실제 카카오 등록회원 연결은 절대 건드리지 않는다.
     */
    if (
      !developerStudent ||
      String(
        (developerStudent as any)
          .approvalStatus ||
        ""
      ).trim() !==
        "승인"
    ) {
      await db.clearKakaoAiDeveloperTestSession({
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
          developerStudent.id
        ),

      studentName:
        developerStudent.clientName ??
        null,

      course:
        developerStudent.course ??
        null,

      finalEducation:
        developerStudent.finalEducation ??
        null,

      assigneeId:
        Number(
          developerStudent.assigneeId ||
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
   * ---------------------------------------------------------
   * Developer Staff Test
   * ---------------------------------------------------------
   *
   * 담당자용 customer/context는 등록회원 Context와
   * 구조가 다르므로 여기서 가짜 registered 상태를 만들지 않는다.
   *
   * /staff-test의 실제 CRM 업무비서 연결은
   * 별도 Staff Session 단계에서 구현한다.
   */
  if (
    developerTestMode ===
      "staff"
  ) {
    return createLeadKakaoAiCustomerContext({
      organizationId,
    });
  }

  /**
   * =========================================================
   * 일반 운영 인증 상태
   * =========================================================
   */

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
   * 실제 등록회원 연결의 경우
   * 학생이 없어졌거나 승인상태가 변경되면
   * 기존 영구 바인딩을 해제한다.
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
   * ---------------------------------------------------------
   * Kakao AI Command Router
   * ---------------------------------------------------------
   *
   * 시스템 명령어는 일반 자연어 Intent보다 먼저 판별한다.
   *
   * 현재 단계:
   *
   * /member
   * → 기존 등록회원 인증 흐름 시작
   *
   * /staff
   * /member-test
   * /reset
   * → 명령어 자체는 인식하지만
   *   실제 전용 Action 연결은 다음 단계에서 수행한다.
   *
   * 중요:
   * Command Router 자체는
   * 인증 / 권한부여 / DB변경을 하지 않는다.
   */
  const commandRoute =
    routeKakaoAiCommand(
      message
    );

  /**
   * ---------------------------------------------------------
   * Developer Command Gate
   * ---------------------------------------------------------
   *
   * 아래 명령은 일반 사용자 명령이 아니다.
   *
   * /lead
   * /member-test <studentId>
   * /staff-test
   * /test-reset
   *
   * organizationId = 1
   * +
   * 현재 Kakao channelUserKey SHA-256
   *
   * 두 조건을 모두 만족한 개발자 계정에서만
   * 실행 가능하다.
   *
   * 중요:
   * 명령어 문자열 자체를 아는 것만으로는
   * 테스트 권한을 얻을 수 없다.
   */
  const isDeveloperCommand =
    commandRoute.handled ===
      true &&
    (
      commandRoute.command ===
        "member_test" ||
      commandRoute.command ===
        "developer_lead" ||
      commandRoute.command ===
        "developer_staff" ||
      commandRoute.command ===
        "developer_reset"
    );

  const developerAccess =
    isDeveloperCommand
      ? checkKakaoAiDeveloperAccess({
          organizationId,

          channelUserKey,
        })
      : null;

  const developerCommandAllowed =
    isDeveloperCommand &&
    developerAccess?.allowed ===
      true;

  if (
    isDeveloperCommand
  ) {
    console.log(
      "[KAKAO AI DEVELOPER COMMAND]",
      {
        organizationId,

        conversationId,

        command:
          commandRoute.command,

        allowed:
          developerCommandAllowed,

        reason:
          developerAccess
            ?.reason ??
          null,

        memberTestStudentId:
          commandRoute
            .memberTestStudentId,
      }
    );
  }

    tracePerf(
    "command_routed",
    {
      handled:
        commandRoute.handled,

      command:
        commandRoute.command,

      hasError:
        Boolean(
          commandRoute.errorCode
        ),

      memberTestStudentId:
        commandRoute
          .memberTestStudentId,

      isDeveloperCommand,

      developerCommandAllowed:
        isDeveloperCommand
          ? developerCommandAllowed
          : null,
    }
  );

  console.log(
    "[KAKAO AI COMMAND]",
    {
      organizationId,

      conversationId,

      handled:
        commandRoute.handled,

      command:
        commandRoute.command,

      errorCode:
        commandRoute.errorCode,

      memberTestStudentId:
        commandRoute
          .memberTestStudentId,
    }
  );

  /**
   * ---------------------------------------------------------
   * Developer Test Command Action
   * ---------------------------------------------------------
   *
   * 개발자 전용 명령은 일반 Registration / Memory /
   * Intent / Context / Composer로 내려보내지 않는다.
   *
   * 명령 처리 후 즉시 응답하고 종료한다.
   */
  if (
    isDeveloperCommand
  ) {
    const developerTestAction =
      await executeKakaoAiDeveloperTestAction({
        organizationId,

        conversationId,

        command:
          commandRoute.command as
            | "member_test"
            | "developer_lead"
            | "developer_staff"
            | "developer_reset",

        allowed:
          developerCommandAllowed,

        memberTestStudentId:
          commandRoute
            .memberTestStudentId,
      });

    const developerReplyText =
      String(
        developerTestAction
          .replyText ||
        ""
      ).trim();

    console.log(
      "[KAKAO AI DEVELOPER TEST ACTION]",
      {
        organizationId,

        conversationId,

        command:
          developerTestAction
            .command,

        success:
          developerTestAction
            .success,

        mode:
          developerTestAction
            .mode,

        studentId:
          developerTestAction
            .studentId,

        staffUserId:
          developerTestAction
            .staffUserId,

        errorMessage:
          developerTestAction
            .errorMessage,
      }
    );

    if (
      developerReplyText
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
            developerReplyText,

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
        userMessageId >
          0 &&
        responseMessageId >
          0 &&
        params.kakaoMessageId
      ) {
        await db.markKakaoAiResponseReady({
          organizationId,

          userMessageId,

          responseMessageId,
        });
      }
    }

    /**
     * 명령 실행 후 Conversation을 다시 읽는다.
     *
     * 실제 customer 상태는 아직 건드리지 않았으므로
     * 현재 return에서는 기존 customer를 그대로 반환한다.
     *
     * 다음 단계에서 일반 메시지 진입 시
     * developerTestMode를 effectiveCustomer로 적용한다.
     */
    return {
      organizationId,

      conversationId,

      duplicateMessage:
        false,

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

responseComposition: {
  success:
    developerTestAction.success,

  replyText:
    developerReplyText,

  usedContextTypes:
    [],

  mentionedRestriction:
    false,

  askedClarification:
    false,

  consultationFlowPatch: {
    qualificationExplained:
      false,

    durationExplained:
      false,

    theoryExplained:
      false,

    practicumExplained:
      false,

    administrationExplained:
      false,

    companyBenefitsExplained:
      false,

    staffRecommendationOffered:
      false,

    consultationFormOffered:
      false,

    trustExplained:
      false,

    courseOverviewExplained:
      false,

    theoryDetailExplained:
      false,

    practicumDetailExplained:
      false,

    administrationDetailExplained:
      false,

    certificateExplained:
      false,

    certificateDetailExplained:
      false,

    companyBenefitsDetailExplained:
      false,

    staffDetailExplained:
      false,
  },

  openAiResponseId:
    null,

  model:
    null,

  fallbackUsed:
    false,

  errorMessage:
    developerTestAction.success
      ? null
      : developerTestAction.errorMessage ||
        developerReplyText ||
        "개발자 테스트 명령 처리에 실패했습니다.",
},
    };
  }

  /**
   * ---------------------------------------------------------
   * /reset
   * ---------------------------------------------------------
   *
   * 현재 카카오 AI 대화상태만 초기화한다.
   *
   * 초기화:
   * - Conversation History
   * - 상담 Memory
   * - 현재 상담주제
   * - 과목/OCR 기반 Memory
   * - 상담 진행단계
   * - 담당자 추천/선택상태
   *
   * 유지:
   * - 실제 CRM 데이터
   * - 등록학생 정보
   * - Kakao ↔ Student 영구 바인딩
   * - Staff 인증/계정 연결
   * - Developer Test Mode
   */
  if (
    commandRoute.handled ===
      true &&
    commandRoute.command ===
      "reset"
  ) {
    /**
     * 먼저 구조화 Memory를 완전히 빈 상담상태로 되돌린다.
     */
    await db.updateKakaoAiConversationMemory({
      organizationId,

      conversationId,

      patch: {
        desiredCourse:
          null,

        finalEducation:
          null,

        hasTransferCollege:
          null,

        socialWorkerLawVersion:
          null,

        verifiedFacts:
          [],

        unresolvedQuestions:
          [],

        currentTopic:
          null,

        recommendedStaffUserId:
          null,

        selectedStaffUserId:
          null,

        lastStaffCandidates:
          [],

        staffSelectionStatus:
          "none",

        lastIntent:
          null,

        consultationFlowData:
          null,
      },
    });

    /**
     * 현재 /reset 메시지 이전의
     * 실제 Conversation History도 제거한다.
     *
     * Memory만 초기화하고 메시지를 남겨두면
     * Composer / Intent가 이전 대화를 다시 읽어
     * 초기화 효과가 없어질 수 있다.
     */
    if (
      userMessageId >
        0
    ) {
      await db.clearKakaoAiConversationHistoryBeforeMessage({
        organizationId,

        conversationId,

        beforeMessageId:
          userMessageId,
      });
    }

    const resetMemoryContext =
  await resolveKakaoAiMemoryContext({
    organizationId,

    conversationId,

    recentMessageLimit:
      20,
  });

    const resetReplyText =
      "대화 내용을 초기화했습니다. 새 상담처럼 다시 말씀해주세요.";

    const assistantMessage =
      await db.insertKakaoAiMessage({
        organizationId,

        conversationId,

        role:
          "assistant",

        messageType:
          "text",

        content:
          resetReplyText,

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
      userMessageId >
        0 &&
      responseMessageId >
        0 &&
      params.kakaoMessageId
    ) {
      await db.markKakaoAiResponseReady({
        organizationId,

        userMessageId,

        responseMessageId,
      });
    }

    return {
      organizationId,

      conversationId,

      duplicateMessage:
        false,

      customer,

      previousMemoryContext:

        resetMemoryContext,

      memoryExtraction:
        null,

      memoryWrite:
        null,

      currentMemory:
        resetMemoryContext
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

      responseComposition: {
  success:
    true,

  replyText:
    resetReplyText,

  usedContextTypes:
    [],

  mentionedRestriction:
    false,

  askedClarification:
    false,

  consultationFlowPatch: {
    qualificationExplained:
      false,

    durationExplained:
      false,

    theoryExplained:
      false,

    practicumExplained:
      false,

    administrationExplained:
      false,

    companyBenefitsExplained:
      false,

    staffRecommendationOffered:
      false,

    consultationFormOffered:
      false,

    trustExplained:
      false,

    courseOverviewExplained:
      false,

    theoryDetailExplained:
      false,

    practicumDetailExplained:
      false,

    administrationDetailExplained:
      false,

    certificateExplained:
      false,

    certificateDetailExplained:
      false,

    companyBenefitsDetailExplained:
      false,

    staffDetailExplained:
      false,
  },

  openAiResponseId:
    null,

  model:
    null,

  fallbackUsed:
    false,

  errorMessage:
    null,
},
    };
  }

  /**
   * ---------------------------------------------------------
   * /staff
   * ---------------------------------------------------------
   *
   * 모든 회사 공통 담당자 업무비서 인증 진입점.
   *
   * 흐름:
   *
   * /staff
   * ↓
   * 현재 24시간 Staff Session 확인
   * ↓
   * 존재하면 재로그인 없이 안내
   * ↓
   * 없으면 10분짜리 1회용 로그인 Token 생성
   * ↓
   * EduCanvas 담당자 인증 페이지 URL 반환
   *
   * 중요:
   *
   * organizationId를 URL에 넣지 않는다.
   *
   * 로그인 페이지에서는:
   *
   * token
   * → DB Staff Auth Session
   * → organizationId
   * → CRM User
   *
   * 순서로 회사를 서버가 확정한다.
   */
  if (
    commandRoute.handled ===
      true &&
    commandRoute.command ===
      "staff"
  ) {
    const activeStaffSession =
      await db.getActiveKakaoAiStaffAuthSession({
        organizationId,

        conversationId,
      });

    let staffReplyText =
      "";

    /**
     * 이미 24시간 담당자 세션이 살아있는 경우.
     *
     * 새로운 Token을 만들지 않는다.
     */
    if (
      activeStaffSession
    ) {
      const staffName =
        String(
          activeStaffSession.name ||
          activeStaffSession.username ||
          ""
        ).trim();

      const staffRole =
        String(
          activeStaffSession.role ||
          ""
        ).trim();

      const roleLabel =
        staffRole ===
          "host"
          ? "Host"
          : staffRole ===
              "admin"
            ? "Admin"
            : "Staff";

      staffReplyText =
        staffName
          ? `${staffName}님은 현재 담당자 인증이 유지되고 있습니다.\n\n권한: ${roleLabel}\n\n카카오 AI 업무비서를 바로 이용하실 수 있습니다.`
          : `현재 담당자 인증이 유지되고 있습니다.\n\n권한: ${roleLabel}\n\n카카오 AI 업무비서를 바로 이용하실 수 있습니다.`;
    } else {
      /**
       * 활성 담당자 세션이 없는 경우에만
       * 새로운 10분짜리 1회용 Token을 발급한다.
       */
      const staffAuth =
        await db.createKakaoAiStaffAuthSession({
          organizationId,

          conversationId,
        });

      const publicOrigin =
        String(
          process.env.FRONTEND_URL ||
          "https://edu-crm.kr"
        )
          .trim()
          .replace(
            /\/+$/,
            ""
          );

      const staffAuthUrl =
        `${publicOrigin}/kakao-ai/staff-auth/${encodeURIComponent(
          staffAuth.token
        )}`;

      staffReplyText =
        [
          "담당자 업무비서 이용을 위해 CRM 계정 인증이 필요합니다.",
          "",
          "아래 링크에서 CRM 아이디와 비밀번호로 인증해주세요.",
          "",
          staffAuthUrl,
          "",
          "인증 링크는 10분 동안 유효하며, 인증 완료 후 담당자 세션은 24시간 유지됩니다.",
        ].join(
          "\n"
        );
    }

    /**
     * 일반 AI / OpenAI Intent로 내려보내지 않고
     * 시스템 명령 응답을 직접 저장한다.
     */
    const assistantMessage =
      await db.insertKakaoAiMessage({
        organizationId,

        conversationId,

        role:
          "assistant",

        messageType:
          "text",

        content:
          staffReplyText,

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
      userMessageId >
        0 &&
      responseMessageId >
        0 &&
      params.kakaoMessageId
    ) {
      await db.markKakaoAiResponseReady({
        organizationId,

        userMessageId,

        responseMessageId,
      });
    }

    console.log(
      "[KAKAO AI STAFF AUTH COMMAND]",
      {
        organizationId,

        conversationId,

        alreadyAuthenticated:
          Boolean(
            activeStaffSession
          ),

        staffUserId:
          activeStaffSession
            ?.userId ??
          null,

        role:
          activeStaffSession
            ?.role ??
          null,

        responseMessageId,
      }
    );

    return {
      organizationId,

      conversationId,

      duplicateMessage:
        false,

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

      responseComposition: {
        success:
          true,

        replyText:
          staffReplyText,

        usedContextTypes:
          [],

        mentionedRestriction:
          false,

        askedClarification:
          false,

        consultationFlowPatch: {
          qualificationExplained:
            false,

          durationExplained:
            false,

          theoryExplained:
            false,

          practicumExplained:
            false,

          administrationExplained:
            false,

          companyBenefitsExplained:
            false,

          staffRecommendationOffered:
            false,

          consultationFormOffered:
            false,

    trustExplained:
      false,

    courseOverviewExplained:
      false,

    theoryDetailExplained:
      false,

    practicumDetailExplained:
      false,

    administrationDetailExplained:
      false,

    certificateExplained:
      false,

    certificateDetailExplained:
      false,

    companyBenefitsDetailExplained:
      false,

    staffDetailExplained:
      false,
        },

        openAiResponseId:
          null,

        model:
          null,

        fallbackUsed:
          false,

        errorMessage:
          null,
      },
    };
  }

  /**
   * ---------------------------------------------------------
   * Staff Assistant
   * ---------------------------------------------------------
   *
   * /staff 인증이 완료된 담당자의 일반 메시지는
   * 신규상담 / 등록회원 AI보다 먼저
   * 기존 EduCanvas CRM 업무비서 Runner로 전달한다.
   *
   * Staff Session이 없으면 handled=false이므로
   * 기존 신규상담 / 등록회원 흐름을 그대로 계속 진행한다.
   */
  try {
    const staffAssistant =
      await runKakaoAiStaffAssistant({
        organizationId,

        conversationId,

        message,
      });

    if (
      staffAssistant.handled ===
        true &&
      staffAssistant.result
    ) {
      const staffAssistantReplyText =
        String(
          staffAssistant.result.reply ||
          ""
        ).trim();

      console.log(
        "[KAKAO AI STAFF ASSISTANT]",
        {
          organizationId,

          conversationId,

          handled:
            staffAssistant.handled,

          success:
            staffAssistant.result.success,

          intent:
            staffAssistant.result.intent,

          toolName:
            staffAssistant.result.toolName,

                    staffUserId:
            staffAssistant.staffContext
              ?.userId ??
            null,

          role:
            staffAssistant.staffContext
              ?.role ??
            null,
        }
      );

      if (
        staffAssistantReplyText
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
              staffAssistantReplyText,

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
          userMessageId >
            0 &&
          responseMessageId >
            0 &&
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

        responseComposition: {
          success:
            staffAssistant.result.success,

          replyText:
            staffAssistantReplyText,

          usedContextTypes:
            [],

          mentionedRestriction:
            false,

          askedClarification:
            false,

          consultationFlowPatch: {
            qualificationExplained:
              false,

            durationExplained:
              false,

            theoryExplained:
              false,

            practicumExplained:
              false,

            administrationExplained:
              false,

            companyBenefitsExplained:
              false,

            staffRecommendationOffered:
              false,

            consultationFormOffered:
              false,

    trustExplained:
      false,

    courseOverviewExplained:
      false,

    theoryDetailExplained:
      false,

    practicumDetailExplained:
      false,

    administrationDetailExplained:
      false,

    certificateExplained:
      false,

    certificateDetailExplained:
      false,

    companyBenefitsDetailExplained:
      false,

    staffDetailExplained:
      false,
          },

          openAiResponseId:
            null,

          model:
            null,

          fallbackUsed:
            false,

          errorMessage:
            staffAssistant.result.success
              ? null
              : staffAssistantReplyText ||
                "담당자 업무비서 처리에 실패했습니다.",
        },
      };
    }
  } catch (
    error:
      unknown
  ) {
    console.error(
      "[KAKAO AI ERROR] StaffAssistantFailed",
      {
        organizationId,

        conversationId,

        error:
          error instanceof
            Error
            ? {
                name:
                  error.name,

                message:
                  error.message,

                stack:
                  error.stack,
              }
            : {
                message:
                  String(
                    error
                  ),
              },
      }
    );
  }

  /**
   * /member는 사용자가 명령어만 입력해도
   * 기존 Registration Verifier의
   * "등록회원 인증 시작" 자연어 트리거와 동일하게 처리한다.
   *
   * 원본 message 자체는 변경하지 않는다.
   * DB에도 사용자가 실제 입력한 "/member"가 그대로 남는다.
   */
  const registrationVerificationMessage =
    commandRoute.handled ===
        true &&
      commandRoute.command ===
        "member"
      ? "등록회원입니다"
      : message;

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

      message:
        registrationVerificationMessage,

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

let documentAssistance:
  DocumentAssistanceResult |
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

/**
 * ---------------------------------------------------------
 * 성적증명서 기이수과목 Memory 반영
 * ---------------------------------------------------------
 *
 * Document Intelligence가 실제 성적증명서에서
 * 확인한 과목 사실만 Memory에 보존한다.
 *
 * 여기서는 자격 인정여부를 계산하지 않는다.
 * 실제 동일교과목 / 자격요건 판정은
 * 기존 Academic / Rules Engine이 담당한다.
 */
if (
  documentIntelligence &&
  documentIntelligence.documentType ===
    "transcript" &&
  (
    documentIntelligence.decision ===
      "accepted" ||
    documentIntelligence.decision ===
      "review_required"
  ) &&
  documentIntelligence.canUseAcademicEngine ===
    true &&
  documentIntelligence.confidence >=
    0.85 &&
  Array.isArray(
    documentIntelligence.academic.subjects
  ) &&
  documentIntelligence.academic.subjects.length >
    0
) {
  const priorSubjectCandidatesToUpsert =
    documentIntelligence.academic.subjects
      .map(
        (
          subject
        ): KakaoAiPriorSubjectCandidate | null => {
          const subjectName =
            String(
              subject.name ||
              ""
            ).trim();

          if (
            !subjectName
          ) {
            return null;
          }

          const completedYearValue =
            Math.floor(
              Number(
                subject.year ||
                0
              )
            );

          const completedYear =
            Number.isFinite(
              completedYearValue
            ) &&
            completedYearValue >=
              1900 &&
            completedYearValue <=
              2100
              ? completedYearValue
              : null;

          const creditsValue =
            Number(
              subject.credits ||
              0
            );

          const credits =
            Number.isFinite(
              creditsValue
            ) &&
            creditsValue >
              0
              ? creditsValue
              : null;

          return {
            subjectName,

            completedYear,

            credits,

            source:
  "ocr",

verificationStatus:
  documentIntelligence.decision ===
    "accepted"
    ? "verified"
    : "ocr_observed",
          };
        }
      )
      .filter(
        (
          subject
        ): subject is KakaoAiPriorSubjectCandidate =>
          subject !==
          null
      );

  if (
    priorSubjectCandidatesToUpsert.length >
    0
  ) {
    const documentMemoryWrite =
      await applyKakaoAiVerifiedMemoryPatch({
        organizationId,

        conversationId,

        currentMemory,

        patch: {
          priorSubjectCandidatesToUpsert,
        },
      });

    currentMemory =
      documentMemoryWrite.memory;

    tracePerf(
      "document_subject_memory_saved",
      {
        subjectCount:
          priorSubjectCandidatesToUpsert.length,

        changed:
          documentMemoryWrite.changed,
      }
    );

    console.log(
      "[KAKAO AI TRACE] DocumentSubjectMemory",
      {
        conversationId,

        subjectCount:
          priorSubjectCandidatesToUpsert.length,

        changed:
          documentMemoryWrite.changed,
      }
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
 * ---------------------------------------------------------
 * 공통 Document Assistance
 * ---------------------------------------------------------
 *
 * Document Intelligence가 문서를 읽은 뒤
 * "그래서 사용자가 무엇을 해야 하는지"를 분석한다.
 *
 * 신규자 / 등록자 / 향후 CRM 업무비서가
 * 동일한 공통 Assistance 엔진을 사용한다.
 *
 * 중요:
 * - Vision을 다시 호출하지 않는다.
 * - DB를 직접 수정하지 않는다.
 * - 작성방법 / 누락 / 오류 / 다음단계만 분석한다.
 */
if (
  documentIntelligence &&
  (
    attachmentContext.hasImage ||
    attachmentContext.hasDocument
  )
) {
  try {
    const assistanceStudentId =
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

    documentAssistance =
      await analyzeDocumentAssistance({
        organizationId,

        documentIntelligence,

        studentId:
          assistanceStudentId,

        userMessage:
          message ||
          null,
      });

    tracePerf(
      "document_assistance_done",
      {
        documentType:
          documentAssistance
            .documentType,

        category:
          documentAssistance
            .category,

        canAssist:
          documentAssistance
            .canAssist,

        requiresStaffReview:
          documentAssistance
            .requiresStaffReview,

        fieldCount:
          documentAssistance
            .fields
            .length,

        issueCount:
          documentAssistance
            .issues
            .length,

        nextStepCount:
          documentAssistance
            .nextSteps
            .length,
      }
    );

    console.log(
      "[KAKAO AI DOCUMENT ASSISTANCE]",
      {
        organizationId,

        conversationId,

        customerType:
          customer.customerType,

        studentId:
          assistanceStudentId,

        documentType:
          documentAssistance
            .documentType,

        category:
          documentAssistance
            .category,

        tasks:
          documentAssistance
            .tasks,

        canAssist:
          documentAssistance
            .canAssist,

        requiresStaffReview:
          documentAssistance
            .requiresStaffReview,

        fieldCount:
          documentAssistance
            .fields
            .length,

        issueCount:
          documentAssistance
            .issues
            .length,

        nextStepCount:
          documentAssistance
            .nextSteps
            .length,

        guidanceSummary:
          documentAssistance
            .guidanceSummary,
      }
    );
  } catch (
    error:
      unknown
  ) {
    console.error(
      "[KAKAO AI DOCUMENT ASSISTANCE] 분석 실패",
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

    documentAssistance =
      null;

    tracePerf(
      "document_assistance_failed"
    );
  }
}

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

    documentAssistance,
  });

/**
 * =========================================================
 * Lead Flow - 1차 평가
 * =========================================================
 *
 * 회사 Context에서 검증 완료된 leadFlowConfig가 있고
 * 현재 사용자가 신규상담자일 때만 실행한다.
 *
 * 여기서 특정 Stage / Action을 코드가 결정하지 않는다.
 */
let leadFlowEvaluation:
  KakaoAiLeadFlowEvaluationResult |
  null =
  null;

let leadFlowSemanticDecision:
  string |
  null =
  null;

if (
  customer.customerType ===
    "lead" &&
  resolvedContext.leadFlowConfig
) {
  const leadSemanticResolution =
    await resolveKakaoAiLeadSemanticDecision({
      message,

      conversationHistory:
        previousMemoryContext
          .recentConversation
          .messages,

      structuredMemory:
        currentMemory,

      flowConfig:
        resolvedContext
          .leadFlowConfig,

      currentStageId:
        currentMemory
          .consultationFlow
          .salesStage,
    });

  leadFlowSemanticDecision =
    leadSemanticResolution
      .semanticDecision;

  console.log(
    "[KAKAO AI LEAD SEMANTIC]",
    {
      conversationId,

      currentStageId:
        currentMemory
          .consultationFlow
          .salesStage,

      semanticDecision:
        leadFlowSemanticDecision,

      success:
        leadSemanticResolution
          .success,

      fallbackUsed:
        leadSemanticResolution
          .fallbackUsed,

      errorMessage:
        leadSemanticResolution
          .errorMessage,
    }
  );
}

if (
  customer.customerType ===
    "lead" &&
  resolvedContext.leadFlowConfig
) {
  const leadFlowFacts =
    buildKakaoAiLeadFlowFacts({
      memory:
        currentMemory,

      customer,

      intentClassification,

      resolvedContext,
    });

  leadFlowEvaluation =
    evaluateKakaoAiLeadFlow({
      config:
        resolvedContext
          .leadFlowConfig,

      facts:
        leadFlowFacts,

      currentStageId:
        currentMemory
          .consultationFlow
          .salesStage,

      /**
       * 현재는 Intent Classifier의 서버 결과를
       * semantic ID로 사용한다.
       *
       * Flow Engine 자체는 이 값의 의미를 모른다.
       * DB Flow Config가 whenSemantic 값과 연결한다.
       */
      semanticDecision:
  leadFlowSemanticDecision,
    });

  console.log(
    "[KAKAO AI LEAD FLOW]",
    {
      conversationId,

      reason:
        leadFlowEvaluation.reason,

      currentStageId:
        leadFlowEvaluation
          .currentStageId,

      nextStageId:
        leadFlowEvaluation
          .nextStageId,

      actionId:
        leadFlowEvaluation
          .actionId,
    }
  );
}

if (
  leadFlowEvaluation
) {
  const flowMemoryPatch:
    Partial<
      KakaoAiStructuredMemory[
        "consultationFlow"
      ]
    > = {};

  const evaluatedStageId =
    leadFlowEvaluation
      .nextStageId ??
    leadFlowEvaluation
      .currentStageId ??
    null;

  if (
    currentMemory
      .consultationFlow
      .salesStage !==
    evaluatedStageId
  ) {
    flowMemoryPatch.salesStage =
      evaluatedStageId;
  }

  if (
    currentMemory
      .consultationFlow
      .pendingNextAction !==
    leadFlowEvaluation
      .actionId
  ) {
    flowMemoryPatch
      .pendingNextAction =
      leadFlowEvaluation
        .actionId;
  }

  const evaluatedOptions =
    leadFlowEvaluation
      .nextStage
      ?.transitions
      ?.map(
        transition =>
          normalizeText(
            transition.actionId
          )
      )
      .filter(
        (
          actionId
        ): actionId is string =>
          Boolean(
            actionId
          )
      ) ??
    [];

  const uniqueEvaluatedOptions =
    Array.from(
      new Set(
        evaluatedOptions
      )
    );

  if (
    JSON.stringify(
      currentMemory
        .consultationFlow
        .nextOptions
    ) !==
    JSON.stringify(
      uniqueEvaluatedOptions
    )
  ) {
    flowMemoryPatch.nextOptions =
      uniqueEvaluatedOptions;
  }

  if (
    Object.keys(
      flowMemoryPatch
    ).length >
    0
  ) {
    currentMemory =
      await updateKakaoAiConsultationFlow({
        organizationId,

        conversationId,

        currentMemory,

        patch:
          flowMemoryPatch,
      });
  }
}

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
  try {
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
  } catch (
    error:
      unknown
  ) {
    console.error(
      "[KAKAO AI ERROR] StaffActionFailed",
      {
        organizationId,

        conversationId,

        primaryCapability:
          intentClassification.intent
            .primaryCapability,

        allowedCapabilities:
          intentClassification.routed
            .allowedCapabilities,

        error:
          error instanceof
            Error
            ? {
                name:
                  error.name,

                message:
                  error.message,

                stack:
                  error.stack,
              }
            : {
                message:
                  String(
                    error
                  ),
              },
      }
    );

    staffAction =
      null;
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

    documentAssistance,
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


let leadRegistration:
  KakaoAiLeadRegistrationActionResult | null =
  null;
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
let leadRegistrationResult:
  KakaoAiLeadRegistrationActionResult | null =
  null;

try {
  leadRegistrationResult =
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
} catch (
  error:
    unknown
) {
  console.error(
    "[KAKAO AI ERROR] LeadRegistrationActionFailed",
    {
      organizationId,

      conversationId,

      customerType:
        customer.customerType,

      allowedCapabilities:
        intentClassification.routed
          .allowedCapabilities,

      selectedStaffUserId:
        currentMemory
          .selectedStaffUserId ??
        null,

      error:
        error instanceof
          Error
          ? {
              name:
                error.name,

              message:
                error.message,

              stack:
                error.stack,
            }
          : {
              message:
                String(
                  error
                ),
            },
    }
  );

  leadRegistrationResult =
    null;

  leadRegistration =
    null;
}

tracePerf(
  "lead_registration_done",
  {
    handled:
      leadRegistrationResult
        ?.handled ??
      false,

    created:
      leadRegistrationResult
        ?.created ??
      false,

    consultationId:
      leadRegistrationResult
        ?.consultationId ??
      null,

    reason:
      leadRegistrationResult
        ?.reason ??
      null,
  }
);



let callbackRequest:
  KakaoAiCallbackRequestActionResult | null =
  null;

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
let callbackRequestResult:
  KakaoAiCallbackRequestActionResult | null =
  null;

try {
  callbackRequestResult =
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
          ?.consultationId ??
        null,
    });

  if (
    callbackRequestResult.handled
  ) {
    callbackRequest =
      callbackRequestResult;
  }
} catch (
  error:
    unknown
) {
  console.error(
    "[KAKAO AI ERROR] CallbackRequestActionFailed",
    {
      organizationId,

      conversationId,

      customerType:
        customer.customerType,

      allowedCapabilities:
        intentClassification.routed
          .allowedCapabilities,

      consultationId:
        leadRegistrationResult
          ?.consultationId ??
        null,

      error:
        error instanceof
          Error
          ? {
              name:
                error.name,

              message:
                error.message,

              stack:
                error.stack,
            }
          : {
              message:
                String(
                  error
                ),
            },
    }
  );

  callbackRequestResult =
    null;

  callbackRequest =
    null;
}

tracePerf(
  "callback_request_done",
  {
    handled:
      callbackRequestResult
        ?.handled ??
      false,

    saved:
      callbackRequestResult
        ?.saved ??
      false,

    consultationId:
      callbackRequestResult
        ?.consultationId ??
      null,

    reason:
      callbackRequestResult
        ?.reason ??
      null,
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

/**
 * 상담접수 의사가 있지만
 * 아직 담당자가 선택되지 않은 경우.
 *
 * 이 경우에만 다음 턴을 STAFF 단계로
 * 준비할 필요가 있다.
 */
const shouldForceStaffRecommendation =
  leadRegistration?.handled ===
    true &&
  leadRegistration.reason ===
    "STAFF_NOT_SELECTED";

/**
 * 상담 Flow를 다시 계산해야 할
 * 실제 서버 Action 결과가 있었는지 확인한다.
 *
 * 일반적인 TRUST / OVERVIEW / THEORY /
 * PRACTICUM / ADMINISTRATION / BENEFITS
 * 설명 턴에는 2차 평가를 실행하지 않는다.
 *
 * 이유:
 * 한 사용자 메시지는 상담단계 하나만 진행해야 한다.
 */
const hasServerActionStateChange =
  Object.keys(
    serverActionConsultationFlowPatch
  ).length >
    0 ||
  shouldForceStaffRecommendation;

/**
 * =========================================================
 * Lead Flow - 서버 Action 이후 2차 평가
 * =========================================================
 *
 * 이 평가는 현재 사용자 메시지를 다시 소비하는 용도가 아니다.
 *
 * 실제 Staff / Consultation / Callback Action으로
 * 서버 상태가 바뀐 경우에만
 * "다음 사용자 메시지에서 시작할 상태"를 준비한다.
 */
if (
  customer.customerType ===
    "lead" &&
  resolvedContext.leadFlowConfig &&
  hasServerActionStateChange
) {
  const postActionFacts =
    buildKakaoAiLeadFlowFacts({
      memory:
        currentMemory,

      customer,

      intentClassification,

      resolvedContext,

      staffAction,

      leadRegistration,

      callbackRequest,
    });

const availableStaffStage =
  resolvedContext
    .leadFlowConfig
    .stages
    ?.find(
      stage =>
        stage.enabled !==
          false &&
        normalizeText(
          stage.id
        ) ===
          "STAFF"
    ) ??
  null;

/**
 * 상담접수 의사가 있지만 담당자가 아직 선택되지 않았다면
 * 기존 CONSULTATION 흐름을 계속 진행하지 않는다.
 *
 * 실제 STAFF Stage가 활성화된 경우
 * 해당 Stage를 현재 단계로 강제하여
 * 담당자 추천부터 먼저 실행한다.
 *
 * 이전 semanticDecision을 그대로 사용하면
 * "네" / 상담접수 동의가 STAFF → CONSULTATION 전이로
 * 다시 소비될 수 있으므로 강제 STAFF 진입 시에는
 * semanticDecision을 null로 초기화한다.
 */
const postActionCurrentStageId =
  shouldForceStaffRecommendation &&
  availableStaffStage
    ? normalizeText(
        availableStaffStage.id
      )
    : currentMemory
        .consultationFlow
        .salesStage;

const postActionSemanticDecision =
  null;

const postActionFlowEvaluation =
  evaluateKakaoAiLeadFlow({
    config:
      resolvedContext
        .leadFlowConfig,

    facts:
      postActionFacts,

    currentStageId:
      postActionCurrentStageId,

    semanticDecision:
      postActionSemanticDecision,
  });

  const postActionStageId =
    postActionFlowEvaluation
      .nextStageId ??
    postActionFlowEvaluation
      .currentStageId ??
    null;

  const postActionOptions =
    Array.from(
      new Set(
        (
          postActionFlowEvaluation
            .nextStage
            ?.transitions ??
          []
        )
          .map(
            transition =>
              normalizeText(
                transition.actionId
              )
          )
          .filter(
            (
              actionId
            ): actionId is string =>
              Boolean(
                actionId
              )
          )
      )
    );

  const postActionFlowPatch:
    Partial<
      KakaoAiStructuredMemory[
        "consultationFlow"
      ]
    > = {};

  if (
    currentMemory
      .consultationFlow
      .salesStage !==
    postActionStageId
  ) {
    postActionFlowPatch.salesStage =
      postActionStageId;
  }

  if (
    currentMemory
      .consultationFlow
      .pendingNextAction !==
    postActionFlowEvaluation
      .actionId
  ) {
    postActionFlowPatch
      .pendingNextAction =
      postActionFlowEvaluation
        .actionId;
  }

  if (
    JSON.stringify(
      currentMemory
        .consultationFlow
        .nextOptions
    ) !==
    JSON.stringify(
      postActionOptions
    )
  ) {
    postActionFlowPatch.nextOptions =
      postActionOptions;
  }

  if (
    Object.keys(
      postActionFlowPatch
    ).length >
    0
  ) {
    currentMemory =
      await updateKakaoAiConsultationFlow({
        organizationId,

        conversationId,

        currentMemory,

        patch:
          postActionFlowPatch,
      });
  }
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



const serverActionReplyText =
  String(
    callbackRequest
      ?.replyText ||
    leadRegistration
      ?.replyText ||
    ""
  ).trim();

/**
 * Lead Registration / Callback이 실제 사용자 응답문을
 * 반환한 경우에만 Composer를 건너뛴다.
 *
 * handled=true라도 replyText가 비어 있으면
 * 여기서 return하지 않고 아래 Response Composer로 진행한다.
 */
if (
  (
    leadRegistration?.handled ||
    callbackRequest?.handled
  ) &&
  serverActionReplyText
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
        serverActionReplyText,

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
    userMessageId >
      0 &&
    responseMessageId >
      0 &&
    params.kakaoMessageId
  ) {
    await db.markKakaoAiResponseReady({
      organizationId,

      userMessageId,

      responseMessageId,
    });
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

        responseComposition: {
      success:
        true,

      replyText:
        serverActionReplyText,

      usedContextTypes:
        [],

      mentionedRestriction:
        false,

      askedClarification:
        false,

      consultationFlowPatch: {
        qualificationExplained:
          false,

        durationExplained:
          false,

        theoryExplained:
          false,

        practicumExplained:
          false,

        administrationExplained:
          false,

        companyBenefitsExplained:
          false,

        staffRecommendationOffered:
          staffAction?.action ===
            "recommend" &&
          staffAction.success ===
            true,

        consultationFormOffered:
          leadRegistration?.reason ===
            "REQUIRED_INFORMATION_MISSING" ||
          leadRegistration?.reason ===
            "CONFIRMATION_REQUIRED" ||
          leadRegistration?.created ===
            true,

        trustExplained:
          false,

        courseOverviewExplained:
          false,

        theoryDetailExplained:
          false,

        practicumDetailExplained:
          false,

        administrationDetailExplained:
          false,

        certificateExplained:
          false,

        certificateDetailExplained:
          false,

        companyBenefitsDetailExplained:
          false,

        staffDetailExplained:
          false,
      },

      openAiResponseId:
        null,

      model:
        null,

      fallbackUsed:
        false,

      errorMessage:
        null,
    },
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

    leadFlowEvaluation,
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
/**
 * =========================================================
 * Lead Flow - 답변 완료 상태 확정
 * =========================================================
 *
 * 신규 Lead Flow가 활성화된 경우:
 *
 * Composer가 반환한 consultationFlowPatch를
 * Flow 진행 판단에 사용하지 않는다.
 *
 * 이번 턴에 Flow Engine이 실제 실행하도록 결정한
 * actionId + Composer 성공 여부를 기준으로
 * 서버가 완료상태를 확정한다.
 *
 * 기존 Flow가 없는 상담 / 등록회원 / fallback 흐름은
 * 기존 Composer Patch를 그대로 유지한다.
 */
const hasActiveLeadFlow =
  customer.customerType ===
    "lead" &&
  Boolean(
    resolvedContext
      .leadFlowConfig
  ) &&
  Boolean(
    leadFlowEvaluation
  );

const composerSucceeded =
  responseComposition
    .success ===
      true &&
  Boolean(
    normalizeText(
      responseComposition
        .replyText
    )
  );

const serverConfirmedLeadFlowPatch =
  hasActiveLeadFlow &&
  composerSucceeded
    ? buildServerConfirmedLeadFlowPatch(
        leadFlowEvaluation
          ?.actionId
      )
    : {};

const consultationFlowPatch =
  hasActiveLeadFlow
    ? {
        /**
         * 신규 Lead Flow에서는
         * 모델이 Flow 상태를 임의 변경하지 못하게 한다.
         *
         * 서버에서 확정한 값만 아래 true Patch 처리부로 전달한다.
         */
        qualificationExplained:
          false,

        durationExplained:
          false,

        theoryExplained:
          false,

        practicumExplained:
          false,

        administrationExplained:
          false,

        companyBenefitsExplained:
          false,

        staffRecommendationOffered:
          false,

        consultationFormOffered:
          false,

        trustExplained:
          false,

        courseOverviewExplained:
          false,

        theoryDetailExplained:
          false,

        practicumDetailExplained:
          false,

        administrationDetailExplained:
          false,

        certificateExplained:
          false,

        certificateDetailExplained:
          false,

        companyBenefitsDetailExplained:
          false,

        staffDetailExplained:
          false,

        ...serverConfirmedLeadFlowPatch,
      }
    : responseComposition
        .consultationFlowPatch;

console.log(
  "[KAKAO AI LEAD FLOW COMPLETION]",
  {
    organizationId,

    conversationId,

    hasActiveLeadFlow,

    composerSucceeded,

    flowReason:
      leadFlowEvaluation
        ?.reason ??
      null,

    currentStageId:
      leadFlowEvaluation
        ?.currentStageId ??
      null,

    nextStageId:
      leadFlowEvaluation
        ?.nextStageId ??
      null,

    actionId:
      leadFlowEvaluation
        ?.actionId ??
      null,

    serverConfirmedLeadFlowPatch,
  }
);

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
  consultationFlowPatch
    .trustExplained ===
  true
) {
  consultationFlowTruePatch
    .trustExplained =
    true;
}

if (
  consultationFlowPatch
    .courseOverviewExplained ===
  true
) {
  consultationFlowTruePatch
    .courseOverviewExplained =
    true;
}

if (
  consultationFlowPatch
    .theoryDetailExplained ===
  true
) {
  consultationFlowTruePatch
    .theoryDetailExplained =
    true;
}

if (
  consultationFlowPatch
    .practicumDetailExplained ===
  true
) {
  consultationFlowTruePatch
    .practicumDetailExplained =
    true;
}

if (
  consultationFlowPatch
    .administrationDetailExplained ===
  true
) {
  consultationFlowTruePatch
    .administrationDetailExplained =
    true;
}

if (
  consultationFlowPatch
    .certificateExplained ===
  true
) {
  consultationFlowTruePatch
    .certificateExplained =
    true;
}

if (
  consultationFlowPatch
    .certificateDetailExplained ===
  true
) {
  consultationFlowTruePatch
    .certificateDetailExplained =
    true;
}

if (
  consultationFlowPatch
    .companyBenefitsDetailExplained ===
  true
) {
  consultationFlowTruePatch
    .companyBenefitsDetailExplained =
    true;
}

if (
  consultationFlowPatch
    .staffDetailExplained ===
  true
) {
  consultationFlowTruePatch
    .staffDetailExplained =
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