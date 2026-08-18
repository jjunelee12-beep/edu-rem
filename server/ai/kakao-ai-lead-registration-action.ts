import * as db from "../db";

import {
  summarizeKakaoAiLeadConsultation,
} from "./kakao-ai-lead-consultation-summarizer";

import type {
  KakaoAiConversationMessage,
} from "./kakao-ai-intent-router";

import type {
  KakaoAiStructuredMemory,
} from "./kakao-ai-memory-resolver";

export type KakaoAiLeadRegistrationActionResult = {
  handled: boolean;

  created: boolean;

  consultationId: number | null;

  reason:
    | "NOT_LEAD"
    | "ALREADY_LINKED"
    | "STAFF_NOT_SELECTED"
    | "CONTACT_NOT_DETECTED"
    | "INVALID_NAME"
    | "INVALID_PHONE"
    | "INVALID_STAFF"
    | "CREATE_FAILED"
    | null;

  clientName: string | null;

  phoneLast4: string | null;

  replyText: string | null;
};

function normalizePositiveInteger(
  value: unknown
): number | null {
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
    return null;
  }

  return normalized;
}

function normalizeText(
  value: unknown
): string {
  return String(
    value ??
    ""
  ).trim();
}

function normalizePhone(
  value: unknown
): string | null {
  const digits =
    String(
      value ??
      ""
    ).replace(
      /\D/g,
      ""
    );

  if (
    !/^01[016789]\d{7,8}$/.test(
      digits
    )
  ) {
    return null;
  }

  return digits;
}

function normalizeClientName(
  value: unknown
): string | null {
  const raw =
    normalizeText(
      value
    )
      .replace(
        /^(?:이름|성함)\s*[:：]?\s*/i,
        ""
      )
      .replace(
        /\s+/g,
        ""
      );

  if (
    !raw
  ) {
    return null;
  }

  /**
   * 신규상담 자동접수에서는
   * 한글 이름을 가장 안전한 자동처리 대상으로 본다.
   *
   * 외국인명/영문명은 추후 별도 확장 가능.
   */
  if (
    !/^[가-힣]{2,10}$/.test(
      raw
    )
  ) {
    return null;
  }

  return raw;
}

function extractLeadContact(
  message: string
): {
  clientName: string | null;
  phone: string | null;
} {
  const text =
    normalizeText(
      message
    );

  if (
    !text
  ) {
    return {
      clientName:
        null,

      phone:
        null,
    };
  }

  /**
   * 휴대폰 번호부터 찾는다.
   *
   * 지원:
   * 01012345678
   * 010-1234-5678
   * 010 1234 5678
   */
  const phoneMatch =
    text.match(
      /01[016789][\s.-]?\d{3,4}[\s.-]?\d{4}/
    );

  const phone =
    phoneMatch
      ? normalizePhone(
          phoneMatch[0]
        )
      : null;

  if (
    !phoneMatch
  ) {
    return {
      clientName:
        null,

      phone:
        null,
    };
  }

  /**
   * 전화번호를 제거한 나머지 문장에서
   * 이름 후보를 찾는다.
   *
   * 예:
   * "이재준 010-1234-5678"
   * "이름 이재준 전화번호 01012345678"
   * "성함: 이재준 / 010-1234-5678"
   */
  const withoutPhone =
    text
      .replace(
        phoneMatch[0],
        " "
      )
      .replace(
        /(?:전화번호|휴대폰|핸드폰|연락처|번호)/gi,
        " "
      )
      .replace(
        /(?:이름|성함)\s*[:：]?/gi,
        " "
      )
      .replace(
        /[,:;|/()[\]{}<>]/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  const koreanNameCandidates =
    withoutPhone.match(
      /[가-힣]{2,10}/g
    ) ||
    [];

  const clientName =
    koreanNameCandidates.length ===
      1
      ? normalizeClientName(
          koreanNameCandidates[0]
        )
      : null;

  return {
    clientName,
    phone,
  };
}

function maskPhone(
  phone: string
): string {
  const normalized =
    normalizePhone(
      phone
    );

  if (
    !normalized
  ) {
    return "";
  }

  return normalized.slice(
    -4
  );
}

/**
 * 카카오 신규상담 → 상담DB 자동접수.
 *
 * 원칙:
 *
 * 1. 등록회원은 처리하지 않는다.
 * 2. Conversation에 consultationId가 있으면
 *    절대 새 상담DB를 만들지 않는다.
 * 3. 추천된 담당자가 아니라
 *    고객이 실제 선택한 selectedStaffUserId만 사용한다.
 * 4. 이름/전화번호는 일반 AI Memory에 저장하지 않는다.
 * 5. createConsultation()의 기존 개인정보
 *    암호화/Hash 로직을 그대로 사용한다.
 */
export async function executeKakaoAiLeadRegistrationAction(
  params: {
    organizationId:
      number;

    conversationId:
      number;

    customerType:
      "lead" |
      "registered";

    message:
  string;

memory:
  KakaoAiStructuredMemory;

conversationHistory:
  KakaoAiConversationMessage[];
  }
): Promise<KakaoAiLeadRegistrationActionResult> {
  const organizationId =
    normalizePositiveInteger(
      params.organizationId
    );

  const conversationId =
    normalizePositiveInteger(
      params.conversationId
    );

  if (
    !organizationId ||
    !conversationId
  ) {
    return {
      handled:
        false,

      created:
        false,

      consultationId:
        null,

      reason:
        "CREATE_FAILED",

      clientName:
        null,

      phoneLast4:
        null,

      replyText:
        null,
    };
  }

  /**
   * 등록회원은 신규 상담DB 생성 대상이 아니다.
   */
  if (
    params.customerType !==
      "lead"
  ) {
    return {
      handled:
        false,

      created:
        false,

      consultationId:
        null,

      reason:
        "NOT_LEAD",

      clientName:
        null,

      phoneLast4:
        null,

      replyText:
        null,
    };
  }

  /**
   * Conversation을 서버에서 다시 조회.
   *
   * caller가 넘긴 상태만 믿지 않는다.
   */
  const conversation =
    await db.getKakaoAiConversationById({
      organizationId,

      conversationId,
    });

  if (
    !conversation
  ) {
    return {
      handled:
        false,

      created:
        false,

      consultationId:
        null,

      reason:
        "CREATE_FAILED",

      clientName:
        null,

      phoneLast4:
        null,

      replyText:
        null,
    };
  }

  /**
   * 이미 상담DB와 연결된 사용자는
   * 절대로 신규 상담을 다시 생성하지 않는다.
   */
  const existingConsultationId =
    normalizePositiveInteger(
      (conversation as any)
        .consultationId
    );

  if (
    existingConsultationId
  ) {
    return {
      handled:
        false,

      created:
        false,

      consultationId:
        existingConsultationId,

      reason:
        "ALREADY_LINKED",

      clientName:
        null,

      phoneLast4:
        null,

      replyText:
        null,
    };
  }

  /**
   * 고객이 실제 선택한 담당자만 사용.
   *
   * recommendedStaffUserId를 대신 사용하지 않는다.
   */
  const selectedStaffUserId =
    normalizePositiveInteger(
      params.memory
        .selectedStaffUserId
    );

  if (
    !selectedStaffUserId ||
    params.memory
      .staffSelectionStatus !==
      "selected"
  ) {
    return {
      handled:
        false,

      created:
        false,

      consultationId:
        null,

      reason:
        "STAFF_NOT_SELECTED",

      clientName:
        null,

      phoneLast4:
        null,

      replyText:
        null,
    };
  }

  const contact =
    extractLeadContact(
      params.message
    );

  /**
   * 현재 메시지가 개인정보 접수 메시지가 아니면
   * 일반 AI 상담 흐름을 그대로 진행한다.
   */
  if (
    !contact.phone &&
    !contact.clientName
  ) {
    return {
      handled:
        false,

      created:
        false,

      consultationId:
        null,

      reason:
        "CONTACT_NOT_DETECTED",

      clientName:
        null,

      phoneLast4:
        null,

      replyText:
        null,
    };
  }

  if (
    !contact.phone
  ) {
    return {
      handled:
        true,

      created:
        false,

      consultationId:
        null,

      reason:
        "INVALID_PHONE",

      clientName:
        contact.clientName,

      phoneLast4:
        null,

      replyText:
        "연락 가능한 휴대폰 번호를 함께 보내주세요 :) 예) 홍길동 010-1234-5678",
    };
  }

  if (
    !contact.clientName
  ) {
    return {
      handled:
        true,

      created:
        false,

      consultationId:
        null,

      reason:
        "INVALID_NAME",

      clientName:
        null,

      phoneLast4:
        maskPhone(
          contact.phone
        ),

      replyText:
        "성함과 연락처를 함께 보내주세요 :) 예) 홍길동 010-1234-5678",
    };
  }

  /**
   * 선택 담당자가 실제 같은 회사의
   * 활성 Host/Admin/Staff인지 다시 확인한다.
   */
  const selectedStaff =
    await db.getAssignableUserById({
      organizationId,

      userId:
        selectedStaffUserId,
    });

  if (
    !selectedStaff
  ) {
    return {
      handled:
        true,

      created:
        false,

      consultationId:
        null,

      reason:
        "INVALID_STAFF",

      clientName:
        contact.clientName,

      phoneLast4:
        maskPhone(
          contact.phone
        ),

      replyText:
        "선택하신 담당자 정보를 다시 확인해야 합니다. 담당자를 다시 선택해주세요.",
    };
  }

  const desiredCourse =
    normalizeText(
      params.memory
        .desiredCourse
    );

  const finalEducation =
    normalizeText(
      params.memory
        .finalEducation
    );

  /**
 * 상담DB 생성 직전에
 * 지금까지의 카카오 상담을 CRM용으로 요약한다.
 *
 * OpenAI 요약에 실패해도
 * summarizer 내부 fallback notes를 반환하므로
 * 상담DB 생성 자체는 중단하지 않는다.
 */
const consultationSummary =
  await summarizeKakaoAiLeadConsultation({
    conversationId,

    memory:
      params.memory,

    conversationHistory:
      params.conversationHistory,

    currentMessage:
      params.message,
  });

const notes =
  consultationSummary.notes;

console.log(
  "[KAKAO AI TRACE] LeadConsultationSummary",
  {
    organizationId,

    conversationId,

    success:
      consultationSummary.success,

    fallbackUsed:
      consultationSummary.fallbackUsed,

    summaryLineCount:
      consultationSummary
        .summaryLines
        .length,

    specialNoteCount:
      consultationSummary
        .specialNotes
        .length,

    openAiResponseId:
      consultationSummary
        .openAiResponseId,

    model:
      consultationSummary.model,

    errorMessage:
      consultationSummary
        .errorMessage,
  }
);

  /**
   * 기존 CRM 상담DB 생성함수를 그대로 사용한다.
   *
   * createConsultation 내부에서:
   * - clientName 암호화
   * - clientNameHash
   * - phone 암호화
   * - phoneHash
   * - phoneLast4
   *
   * 가 기존 CRM 정책대로 생성된다.
   */
  const consultationId =
    Number(
      await db.createConsultation({
        organizationId,

        consultDate:
          new Date(),

        channel:
          "카카오 AI",

        clientName:
          contact.clientName,

        phone:
          contact.phone,

        finalEducation:
          finalEducation ||
          "",

        desiredCourse:
          desiredCourse ||
          null,

        notes,

        status:
          "상담중",

        assigneeId:
          selectedStaffUserId,
      } as any) ||
      0
    );

  if (
    !Number.isFinite(
      consultationId
    ) ||
    consultationId <=
      0
  ) {
    return {
      handled:
        true,

      created:
        false,

      consultationId:
        null,

      reason:
        "CREATE_FAILED",

      clientName:
        contact.clientName,

      phoneLast4:
        maskPhone(
          contact.phone
        ),

      replyText:
        "상담 접수 중 문제가 발생했습니다. 잠시 후 다시 말씀해주세요.",
    };
  }

  /**
   * 생성된 상담DB를 현재 카카오 사용자와
   * 영구 연결한다.
   */
  await db.bindKakaoAiConversationConsultation({
    organizationId,

    conversationId,

    consultationId,
  });

  return {
    handled:
      true,

    created:
      true,

    consultationId,

    reason:
      null,

    clientName:
      contact.clientName,

    phoneLast4:
      maskPhone(
        contact.phone
      ),

    replyText:
      `${contact.clientName}님, 상담 접수가 완료되었습니다. 지금까지 상담하신 내용과 선택하신 담당자 정보가 함께 전달되었어요 :)`,
  };
}