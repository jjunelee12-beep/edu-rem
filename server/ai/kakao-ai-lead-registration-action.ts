import * as db from "../db";

import type {
  KakaoAiCapability,
} from "./kakao-ai-access-policy";

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
    | "REQUIRED_INFORMATION_MISSING"
    | "CONFIRMATION_REQUIRED"
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
   * 1.
   * 휴대폰 번호 추출.
   *
   * 지원:
   * 01012345678
   * 010-1234-5678
   * 010 1234 5678
   * 010.1234.5678
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
   * 2.
   * 명시적인 이름 표현부터 우선 찾는다.
   *
   * 예:
   *
   * 이름 테스트
   * 이름은 테스트
   * 이름이 테스트
   * 이름: 테스트
   *
   * 성함 테스트
   * 성함은 테스트
   *
   * 제 이름은 테스트예요
   * 제 이름은 홍길동입니다
   */
  const explicitNamePatterns =
    [
      /(?:제\s*)?(?:이름|성함)(?:은|는|이|가)?\s*[:：]?\s*([가-힣]{2,10})(?=\s|$|이고|이며|입니다|이에요|예요|이고요|입니다만)/i,

      /(?:저는|저|제가)\s+([가-힣]{2,10})(?:입니다|이에요|예요|이고|이고요|이며)?(?=\s|$)/i,

      /([가-힣]{2,10})(?:입니다|이에요|예요)\s*(?:전화번호|연락처|휴대폰|핸드폰|번호)/i,
    ];

  for (
    const pattern of
    explicitNamePatterns
  ) {
    const match =
      text.match(
        pattern
      );

    if (
      match?.[1]
    ) {
      const explicitName =
        normalizeClientName(
          match[1]
        );

      if (
        explicitName
      ) {
        return {
          clientName:
            explicitName,

          phone,
        };
      }
    }
  }

  /**
   * 3.
   * 전화번호 및 개인정보 안내용 표현을 제거한 뒤
   * 남은 문자열에서 이름 후보를 찾는다.
   */
  const withoutPhone =
    text
      .replace(
        phoneMatch[0],
        " "
      )

      /**
       * 이름/성함 + 조사까지 같이 제거.
       *
       * 기존에는 "이름은"에서
       * "이름"만 삭제되어 "은"이 남는 문제가 있었다.
       */
      .replace(
        /(?:제\s*)?(?:이름|성함)(?:은|는|이|가)?\s*[:：]?/gi,
        " "
      )

      .replace(
        /(?:전화번호|휴대폰|핸드폰|연락처|번호)(?:는|은|이|가)?\s*[:：]?/gi,
        " "
      )

      /**
       * 자연어 연결 표현 제거.
       */
      .replace(
        /(?:저는|저|제가|이고요|이고|이며|입니다|이에요|예요|입니다만)/gi,
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
    withoutPhone
      .match(
        /[가-힣]{2,10}/g
      ) ||
    [];

  /**
   * 조사/일반 단어가 이름 후보로 잡히지 않도록
   * 명백한 불용어 제거.
   */
  const ignoredWords =
    new Set([
      "전화",
      "전화번호",
      "연락처",
      "휴대폰",
      "핸드폰",
      "번호",
      "이름",
      "성함",
      "테스트용",
      "고객",
      "상담",
    ]);

  const filteredCandidates =
    koreanNameCandidates
      .map(
        item =>
          item.trim()
      )
      .filter(
        item =>
          item.length >= 2 &&
          item.length <= 10 &&
          !ignoredWords.has(
            item
          )
      );

  /**
   * 후보가 하나면 자동 사용.
   *
   * 두 개 이상이면 추측하지 않는다.
   */
  const clientName =
    filteredCandidates.length ===
      1
      ? normalizeClientName(
          filteredCandidates[0]
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
 * 반복접수 테스트 허용 카카오 사용자.
 *
 * 운영 고객에게는 절대 적용하지 않는다.
 *
 * channelUserKey 원문이 아니라
 * DB에 저장된 SHA-256 Hash 기준이다.
 */
const KAKAO_AI_REPEAT_REGISTRATION_TEST_USER_HASH =
  "8611f82ec54f49acad7594f27a4d0f3f2c54ce80a8f61e07eb36dea88445fea3";

/**
 * 고객에게 본인이 입력한 연락처를
 * 최종 접수 확인용으로 다시 보여준다.
 */
function formatPhoneForReply(
  phone:
    string
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

  if (
    normalized.length ===
    11
  ) {
    return [
      normalized.slice(
        0,
        3
      ),

      normalized.slice(
        3,
        7
      ),

      normalized.slice(
        7
      ),
    ].join(
      "-"
    );
  }

  return [
    normalized.slice(
      0,
      3
    ),

    normalized.slice(
      3,
      6
    ),

    normalized.slice(
      6
    ),
  ].join(
    "-"
  );
}

/**
 * 최종확인 다음 메시지가
 * "네", "그렇게 해주세요"처럼
 * 개인정보가 없는 짧은 후속발화일 수 있다.
 *
 * 이름/전화번호를 일반 Memory에 저장하지 않고
 * 최근 사용자 대화에서 가장 최근의
 * 유효한 이름+연락처 조합을 다시 찾는다.
 */
function findLeadContactFromConversationHistory(
  conversationHistory:
    KakaoAiConversationMessage[]
): {
  clientName:
    string | null;

  phone:
    string | null;
} {
  const history =
    Array.isArray(
      conversationHistory
    )
      ? conversationHistory
      : [];

  for (
    let index =
      history.length -
      1;
    index >=
      0;
    index -=
      1
  ) {
    const message =
      history[index];

    if (
      message?.role !==
      "user"
    ) {
      continue;
    }

    const contact =
      extractLeadContact(
        message.content
      );

    if (
      contact.clientName &&
      contact.phone
    ) {
      return contact;
    }
  }

  return {
    clientName:
      null,

    phone:
      null,
  };
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

    /**
     * Intent Router + Access Policy를 모두 통과한
     * 실제 허용 capability.
     *
     * Action은 자연어 의도를 다시 키워드로 판단하지 않는다.
     */
    allowedCapabilities:
      KakaoAiCapability[];

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
 * 자연어 의도 판단은 Intent Router에서 이미 끝났다.
 *
 * 여기서는 Access Policy까지 통과한 capability만 신뢰한다.
 * 문자열 키워드로 사용자 의도를 다시 판단하지 않는다.
 */
const allowedCapabilities =
  Array.isArray(
    params.allowedCapabilities
  )
    ? params.allowedCapabilities
    : [];

const wantsLeadRegistration =
  allowedCapabilities.includes(
    "lead_registration"
  );

const wantsCallbackRequest =
  allowedCapabilities.includes(
    "callback_request"
  );

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
   * 이미 상담DB와 연결되어 있는지 확인.
   *
   * 일반 고객:
   * 중복 상담DB를 생성하지 않는다.
   *
   * 지정된 개발 테스트 카카오 계정:
   * 반복 접수 테스트가 가능하도록
   * 기존 consultationId가 있어도
   * 아래 신규접수 흐름을 계속 진행한다.
   */
  const existingConsultationId =
    normalizePositiveInteger(
      (conversation as any)
        .consultationId
    );

  const channelUserKeyHash =
    normalizeText(
      (conversation as any)
        .channelUserKeyHash
    );

  const isRepeatRegistrationTestUser =
    channelUserKeyHash ===
    KAKAO_AI_REPEAT_REGISTRATION_TEST_USER_HASH;

  if (
    existingConsultationId &&
    !isRepeatRegistrationTestUser
  ) {
    return {
      handled:
        true,

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
        [
          "이미 상담 접수가 완료되어 있습니다 :)",
          "",
          "기존 상담 내용과 담당자 정보가 정상적으로 접수되어 있어요.",
          "추가로 궁금하신 내용이 있으시면 이어서 말씀해주세요.",
        ].join(
          "\n"
        ),
    };
  }

    /**
   * 현재 메시지에서 우선 개인정보를 찾는다.
   *
   * 최종확인 상태에서
   * "네", "그렇게 해주세요"처럼
   * 개인정보가 없는 답변이 들어오면
   * 직전 대화에서 다시 회수한다.
   *
   * 개인정보는 Structured Memory에는 저장하지 않는다.
   */
  const currentContact =
    extractLeadContact(
      params.message
    );

  const historicalContact =
    findLeadContactFromConversationHistory(
      params.conversationHistory
    );

  const contact = {
    clientName:
      currentContact.clientName ||
      historicalContact.clientName,

    phone:
      currentContact.phone ||
      historicalContact.phone,
  };

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
   * 고객이 실제 선택한 담당자만 사용.
   *
   * recommendedStaffUserId를 대신 사용하지 않는다.
   */
  const selectedStaffUserId =
    normalizePositiveInteger(
      params.memory
        .selectedStaffUserId
    );

  /**
   * 상담DB 실제 생성 전에
   * 필수 접수정보가 전부 확보되었는지
   * 다시 검증한다.
   *
   * 상담내역(notes)은 고객에게 보여주는
   * 최종 확인 목록에서는 제외한다.
   */
  const missingRequiredFields:
    string[] =
    [];

  if (
    !contact.clientName
  ) {
    missingRequiredFields.push(
      "성함"
    );
  }

  if (
    !contact.phone
  ) {
    missingRequiredFields.push(
      "연락처"
    );
  }

  if (
    !finalEducation
  ) {
    missingRequiredFields.push(
      "최종학력"
    );
  }

  if (
    !desiredCourse
  ) {
    missingRequiredFields.push(
      "희망과정"
    );
  }

 if (
  !selectedStaffUserId
) {
  /**
   * 상담접수 의사가 있더라도
   * 담당자가 아직 선택되지 않았다면
   * 개인정보 입력보다 담당자 추천을 먼저 진행한다.
   *
   * 고객에게 담당자 이름을 직접 입력하게 하지 않는다.
   */
  if (
    wantsLeadRegistration ||
    wantsCallbackRequest
  ) {
    return {
      handled:
        true,

      created:
        false,

      consultationId:
        null,

      reason:
        "STAFF_NOT_SELECTED",

      clientName:
        contact.clientName,

      phoneLast4:
        contact.phone
          ? maskPhone(
              contact.phone
            )
          : null,

      replyText:
        [
          "네, 상담 접수 도와드릴게요.",
          "",
          "아직 담당자가 정해지지 않아 현재 상담 내용에 맞는 담당자를 먼저 추천해드리겠습니다.",
        ].join(
          "\n"
        ),
    };
  }

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
      contact.clientName,

    phoneLast4:
      contact.phone
        ? maskPhone(
            contact.phone
          )
        : null,

    replyText:
      null,
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
        contact.phone
          ? maskPhone(
              contact.phone
            )
          : null,

      replyText:
        "선택하신 담당자 정보를 다시 확인해야 합니다. 담당자를 다시 선택해주세요.",
    };
  }

  if (
    missingRequiredFields.length >
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
        "REQUIRED_INFORMATION_MISSING",

      clientName:
        contact.clientName,

      phoneLast4:
        contact.phone
          ? maskPhone(
              contact.phone
            )
          : null,

            replyText:
        [
          "네, 상담 연결을 위해 아래 정보만 작성해주세요 :)",
          "",
          !contact.clientName
            ? "성함:"
            : null,

          !contact.phone
            ? "연락처:"
            : null,

          !finalEducation
            ? "최종학력: (고졸 / 전문대졸 / 4년제졸 등)"
            : null,

          !desiredCourse
            ? "희망과정:"
            : null,

          "",
          "확인된 정보는 다시 작성하지 않으셔도 됩니다.",
        ]
          .filter(
            (
              line
            ): line is string =>
              line !== null
          )
          .join(
            "\n"
          ),
    };
  }

  /**
   * 최종확인 상태.
   *
   * false:
   * 접수정보를 고객에게 먼저 보여주고
   * DB는 아직 생성하지 않는다.
   *
   * true:
   * 직전에 최종 접수목록을 보여준 상태이므로
   * 이번 사용자 응답의 Intent가
   * 실제 접수 승인인지 확인한 후 생성한다.
   */
  const registrationConfirmationPending =
    params.memory
      .consultationFlow
      .registrationConfirmationPending ===
    true;

  /**
   * 아직 최종확인 화면을 보여주지 않았다면
   * 상담DB를 생성하지 않고
   * 고객에게 최종 입력내용을 확인받는다.
   */
  if (
    !registrationConfirmationPending
  ) {
    await db.updateKakaoAiConversationMemory({
      organizationId,

      conversationId,

      patch: {
        lastIntent:
          "lead_registration_confirmation",

        consultationFlowData: {
          ...params.memory
            .consultationFlow,

          consultationFormOffered:
            true,

          registrationConfirmationPending:
            true,
        },
      },
    });

    return {
      handled:
        true,

      created:
        false,

      consultationId:
        null,

      reason:
        "CONFIRMATION_REQUIRED",

      clientName:
        contact.clientName,

      phoneLast4:
        maskPhone(
          contact.phone
        ),

     replyText:
  [
    "네, 입력하신 내용을 확인해주세요 :)",
    "",
    `성함: ${contact.clientName}`,
    `연락처: ${formatPhoneForReply(contact.phone)}`,
    `최종학력: ${finalEducation}`,
    `희망과정: ${desiredCourse}`,
    `담당자: ${selectedStaff.name}`,
    "",
    "위 내용으로 담당자 상담 연결을 도와드리겠습니다.",
    "입력하신 내용이 맞으실까요?",
  ].join(
    "\n"
  ),
    };
  }

  /**
   * 최종확인 상태에서는
   * 단순히 다음 메시지가 왔다고 접수하지 않는다.
   *
   * Intent Router / Access Policy가
   * 실제 상담접수 또는 전화상담 진행 의도로
   * 판단한 경우에만 DB 생성을 허용한다.
   *
   * 따라서:
   * "네"
   * "그렇게 해주세요"
   * "접수해주세요"
   *
   * 같은 표현도 앞 대화문맥을 AI가 이해해서
   * lead_registration / callback_request capability를
   * 내려준 경우에만 실행된다.
   */
  if (
    !wantsLeadRegistration &&
    !wantsCallbackRequest
  ) {
    return {
      handled:
        false,

      created:
        false,

      consultationId:
        null,

      reason:
        "CONFIRMATION_REQUIRED",

      clientName:
        contact.clientName,

      phoneLast4:
        maskPhone(
          contact.phone
        ),

      replyText:
        null,
    };
  }

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
    let consultationId =
    0;

  try {
    consultationId =
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

          finalEducation,

          desiredCourse,

          notes,

          status:
            "상담중",

          assigneeId:
            selectedStaffUserId,
        } as any) ||
        0
      );
  } catch (
    error
  ) {
    console.error(
  "[KAKAO AI ERROR] LeadRegistrationCreateFailed",
  {
    organizationId,
    conversationId,
    selectedStaffUserId,

    input: {
      consultDate:
        new Date().toISOString(),

      channel:
        "카카오 AI",

      hasClientName:
        Boolean(
          contact.clientName
        ),

      phoneLast4:
        contact.phone
          ? maskPhone(
              contact.phone
            )
          : null,

      finalEducation:
        finalEducation ||
        null,

      desiredCourse:
        desiredCourse ||
        null,

      hasNotes:
        Boolean(
          notes
        ),
    },

    error:
      error instanceof Error
        ? {
            name:
              error.name,

            message:
              error.message,

            stack:
              error.stack,

            cause:
              (error as any)
                .cause ??
              null,

            code:
              (error as any)
                .code ??
              null,

            errno:
              (error as any)
                .errno ??
              null,

            sqlState:
              (error as any)
                .sqlState ??
              null,

            sqlMessage:
              (error as any)
                .sqlMessage ??
              null,

            sql:
              (error as any)
                .sql ??
              null,
          }
        : {
            message:
              String(
                error
              ),
          },
  }
);

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
        [
          "상담DB 등록 과정에서 오류가 발생해 아직 접수가 완료되지 않았습니다.",
          "",
          "성함, 연락처, 최종학력, 희망과정, 담당자 정보는 확인된 상태입니다.",
          "잠시 후 \"다시 접수해주세요\"라고 말씀해주시면 다시 확인해드릴게요.",
        ].join(
          "\n"
        ),
    };
  }

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
        [
          "상담DB 생성 결과를 확인하지 못해 접수가 완료되지 않았습니다.",
          "",
          "입력해주신 정보는 확인된 상태이니 잠시 후 \"다시 접수해주세요\"라고 말씀해주세요.",
          "실제 상담DB 생성이 확인되기 전에는 접수 완료로 처리하지 않습니다.",
        ].join(
          "\n"
        ),
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
console.log(
  "[KAKAO AI TRACE] LeadRegistrationCreated",
  {
    organizationId,

    conversationId,

    consultationId,

    selectedStaffUserId,

    clientName:
      contact.clientName,

    phoneLast4:
      maskPhone(
        contact.phone
      ),

    desiredCourse:
      desiredCourse ||
      null,

    finalEducation:
      finalEducation ||
      null,
  }
);
  /**
   * 실제 상담DB 생성 + Conversation 연결까지
   * 성공한 경우에만 최종확인 상태를 종료한다.
   */
  await db.updateKakaoAiConversationMemory({
    organizationId,

    conversationId,

    patch: {
      lastIntent:
        "lead_registration_completed",

      consultationFlowData: {
        ...params.memory
          .consultationFlow,

        consultationFormOffered:
          true,

        registrationConfirmationPending:
          false,
      },
    },
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
      [
        `${contact.clientName}님, 상담 접수가 정상적으로 완료되었습니다 :)`,
        "",
        `담당자: ${selectedStaff.name}`,
        `희망과정: ${desiredCourse}`,
        "",
        "지금까지 상담하신 내용도 담당자에게 함께 전달되었습니다.",
      ].join(
        "\n"
      ),
  };
}