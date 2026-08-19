import {
  createStudentAiManagementRecord,
} from "../student-ai-management.service";

import type {
  KakaoAiCustomerContext,
} from "./kakao-ai-customer-resolver";

import type {
  KakaoAiIntentClassificationResult,
} from "./kakao-ai-intent-classifier";

import type {
  KakaoAiResolvedContext,
} from "./kakao-ai-context-resolver";

export type KakaoAiStudentManagementRecordResult = {
  handled: boolean;

  noteCreated: boolean;

  eventCreated: boolean;

  unreadCount: number | null;

  reason:
    | "NOT_REGISTERED"
    | "NO_STUDENT"
    | "NO_MEANINGFUL_RECORD"
    | "RECORDED";
};

function normalizeText(
  value: unknown
) {
  return String(
    value ??
    ""
  ).trim();
}

function hasCapability(
  intent:
    KakaoAiIntentClassificationResult,
  capability: string
) {
  return (
    intent.routed.allowedCapabilities as string[]
  ).includes(
    capability
  );
}

/**
 * 단순 조회질문인지 판단한다.
 *
 * 조회 자체는 AI 업데이트 숫자를
 * 증가시키면 안 된다.
 */
function isPureLookupRequest(
  params: {
    intent:
      KakaoAiIntentClassificationResult;
  }
) {
  const capabilities =
    params.intent.routed
      .allowedCapabilities as string[];

  if (
    capabilities.length === 0
  ) {
    return true;
  }

  const lookupCapabilities =
    new Set([
      "student_private_data_lookup",
      "academic_private_data_lookup",
      "administrative_status_lookup",
      "practice_institution_lookup",
    ]);

  return capabilities.every(
    capability =>
      lookupCapabilities.has(
        capability
      )
  );
}

/**
 * 현재 Intent를 학점요약 관리메모 분류로 변환.
 *
 * 여기서는 사용자의 질문을
 * 임의로 새로운 사실로 해석하지 않는다.
 *
 * 기존 Intent / Access Policy가
 * 확정한 capability만 이용한다.
 */
function resolveNoteType(
  params: {
    intent:
      KakaoAiIntentClassificationResult;
  }
):
  | "administrative"
  | "practice"
  | "schedule"
  | "subject"
  | "degree"
  | "qualification"
  | "document"
  | "risk"
  | "learning_plan"
  | "general" {
  const {
    intent,
  } = params;

  if (
    hasCapability(
      intent,
      "administrative_document_support"
    ) ||
    hasCapability(
      intent,
      "administrative_status_lookup"
    )
  ) {
    return "administrative";
  }

  if (
    hasCapability(
      intent,
      "practice_institution_lookup"
    )
  ) {
    return "practice";
  }

  if (
    hasCapability(
      intent,
      "registered_risk_analysis"
    )
  ) {
    return "risk";
  }

  if (
    hasCapability(
      intent,
      "career_document_support"
    )
  ) {
    return "document";
  }

  if (
    hasCapability(
      intent,
      "career_consulting"
    )
  ) {
    return "qualification";
  }

  if (
    hasCapability(
      intent,
      "academic_private_data_lookup"
    )
  ) {
    return "learning_plan";
  }

  return "general";
}

/**
 * 담당자가 실제 확인해야 하는 이벤트인지 판단.
 *
 * 중요:
 *
 * "내 학점 몇 점이에요?"
 * "학습자등록 됐나요?"
 * "실습기관 알려주세요"
 *
 * 같은 일반 조회는 false.
 *
 * 현재 단계에서는 보수적으로
 * 명확한 자료/문서 지원 요청만
 * 이벤트로 올린다.
 *
 * 이후 이미지/OCR 연결 때
 * 증빙 제출 / 행정완료보고 등을 추가한다.
 */
function shouldNotifyStaff(
  params: {
    intent:
      KakaoAiIntentClassificationResult;
  }
) {
  const {
    intent,
  } = params;

  if (
    hasCapability(
      intent,
      "administrative_document_support"
    )
  ) {
    return true;
  }

  if (
    hasCapability(
      intent,
      "career_document_support"
    )
  ) {
    return true;
  }

  return false;
}

function resolveEventType(
  params: {
    intent:
      KakaoAiIntentClassificationResult;
  }
):
  | "administrative_status_changed"
  | "document_submitted"
  | "practice_condition_changed"
  | "schedule_changed"
  | "risk_changed"
  | "important_note_created"
  | "learning_plan_changed"
  | "other" {
  if (
    hasCapability(
      params.intent,
      "administrative_document_support"
    )
  ) {
    return "document_submitted";
  }

  if (
    hasCapability(
      params.intent,
      "career_document_support"
    )
  ) {
    return "document_submitted";
  }

  return "important_note_created";
}

/**
 * 등록회원 카카오 대화 중
 * 학습관리에 의미 있는 내용만 기록한다.
 *
 * 이 함수는:
 *
 * - 학생 상세페이지 수정 X
 * - 행정절차 완료처리 X
 * - 위험도 변경 X
 *
 * 오직:
 *
 * student_ai_notes
 * student_ai_events
 *
 * 관리기록만 담당한다.
 */
export async function recordKakaoAiStudentManagement(
  params: {
    organizationId: number;

    customer:
      KakaoAiCustomerContext;

    message:
      string;

    kakaoMessageId?:
      string | null;

    intentClassification:
      KakaoAiIntentClassificationResult;

    resolvedContext:
      KakaoAiResolvedContext;

    replyText:
      string;
  }
): Promise<KakaoAiStudentManagementRecordResult> {
  const customer =
    params.customer;

  /**
   * 인증 등록회원만 가능.
   */
  if (
    customer.customerType !==
      "registered" ||
    customer.verified !==
      true ||
    customer.verificationStatus !==
      "registered"
  ) {
    return {
      handled:
        false,

      noteCreated:
        false,

      eventCreated:
        false,

      unreadCount:
        null,

      reason:
        "NOT_REGISTERED",
    };
  }

  const studentId =
    Math.floor(
      Number(
        customer.studentId ||
        0
      )
    );

  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <= 0
  ) {
    return {
      handled:
        false,

      noteCreated:
        false,

      eventCreated:
        false,

      unreadCount:
        null,

      reason:
        "NO_STUDENT",
    };
  }

  const message =
    normalizeText(
      params.message
    );

  if (!message) {
    return {
      handled:
        false,

      noteCreated:
        false,

      eventCreated:
        false,

      unreadCount:
        null,

      reason:
        "NO_MEANINGFUL_RECORD",
    };
  }

  /**
   * 순수 조회 질문은 현재 단계에서
   * 학점요약 메모까지 남기지 않는다.
   *
   * 전체 카카오 대화는 기존
   * kakao_ai_messages에 이미 저장된다.
   *
   * 학점요약에는 관리상 의미 있는
   * 내용만 들어가야 한다.
   */
  if (
    isPureLookupRequest({
      intent:
        params.intentClassification,
    })
  ) {
    return {
      handled:
        false,

      noteCreated:
        false,

      eventCreated:
        false,

      unreadCount:
        null,

      reason:
        "NO_MEANINGFUL_RECORD",
    };
  }

  const notifyStaff =
    shouldNotifyStaff({
      intent:
        params.intentClassification,
    });

  /**
   * 중요기록이 아닌 일반 상담까지
   * 모두 저장하지 않는다.
   *
   * 현재 1차에서는:
   *
   * - 행정서류 지원
   * - 취업서류 지원
   * - 위험도 상담
   * - 개인 학습설계 상담
   *
   * 정도만 관리메모 대상으로 제한한다.
   */
  const noteType =
    resolveNoteType({
      intent:
        params.intentClassification,
    });

  const shouldCreateNote =
    notifyStaff ||
    noteType ===
      "risk" ||
    noteType ===
      "learning_plan";

  if (
    !shouldCreateNote
  ) {
    return {
      handled:
        false,

      noteCreated:
        false,

      eventCreated:
        false,

      unreadCount:
        null,

      reason:
        "NO_MEANINGFUL_RECORD",
    };
  }

  const userGoal =
    normalizeText(
      params
        .intentClassification
        .intent
        .userGoal
    );

  const aiSummary =
    userGoal ||
    message;

  const actionSummary =
    notifyStaff
      ? (
          noteType ===
            "administrative"
            ? "등록회원이 카카오 AI를 통해 행정 관련 자료 또는 서류 지원을 요청했습니다."
            : noteType ===
                "document"
              ? "등록회원이 카카오 AI를 통해 서류 지원을 요청했습니다."
              : "담당자 확인이 필요한 카카오 AI 문의가 있습니다."
        )
      : null;

  const result =
    await createStudentAiManagementRecord({
      organizationId:
        params.organizationId,

      studentId,

      sourceType:
        "KAKAO_AI",

      noteType,

      noteStatus:
        notifyStaff
          ? "action_required"
          : "info",

      /**
       * 사용자의 전체 대화내역이 아니라
       * 현재 관리상 의미 있는 문의만 저장.
       */
      inquirySummary:
        message.slice(
          0,
          5000
        ),

      aiSummary:
        aiSummary.slice(
          0,
          10000
        ),

      actionSummary,

      /**
       * 카카오 원본 메시지와 연결.
       */
      referenceType:
        params.kakaoMessageId
          ? "kakao_message"
          : null,

      referenceId:
        params.kakaoMessageId ??
        null,

      actorUserId:
        null,

      notifyStaff,

      eventType:
        notifyStaff
          ? resolveEventType({
              intent:
                params.intentClassification,
            })
          : undefined,

      eventSeverity:
        notifyStaff
          ? "important"
          : undefined,

      eventTitle:
        notifyStaff
          ? (
              noteType ===
                "administrative"
                ? "행정 관련 카카오 AI 문의"
                : "카카오 AI 서류 지원 문의"
            )
          : null,

      eventMessage:
        actionSummary,
    });

  return {
    handled:
      true,

    noteCreated:
      Boolean(
        result.note
      ),

    eventCreated:
      Boolean(
        result.event
      ),

    unreadCount:
      Number(
        result.unreadCount ||
        0
      ),

    reason:
      "RECORDED",
  };
}