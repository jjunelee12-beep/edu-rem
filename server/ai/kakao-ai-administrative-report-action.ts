import {
  updateAdministrativeProcedure,
} from "../administrative-procedure.service";

import {
  createStudentAiManagementRecord,
} from "../student-ai-management.service";

import type {
  KakaoAiCustomerContext,
} from "./kakao-ai-customer-resolver";

export type KakaoAiAdministrativeReportActionResult = {
  handled: boolean;

  procedureType:
    | "learner_registration"
    | "credit_recognition"
    | "degree_application"
    | "qualification_application"
    | null;

  status:
    | "in_progress"
    | "review_required"
    | null;

  changed: boolean;

  replyText:
    string | null;

  reason:
    | "NOT_REGISTERED"
    | "NO_PROCEDURE"
    | "NO_REPORT_STATUS"
    | "UPDATED";
};

type AdministrativeProcedureType =
  | "learner_registration"
  | "credit_recognition"
  | "degree_application"
  | "qualification_application";

function normalizeText(
  value: unknown
) {
  return String(
    value ??
    ""
  )
    .trim()
    .replace(
      /\s+/g,
      " "
    );
}

function resolveProcedureType(
  message: string
): AdministrativeProcedureType | null {
  const normalized =
    message.replace(
      /\s+/g,
      ""
    );

  if (
    normalized.includes(
      "학습자등록"
    )
  ) {
    return "learner_registration";
  }

  if (
    normalized.includes(
      "학점인정"
    )
  ) {
    return "credit_recognition";
  }

  if (
    normalized.includes(
      "학위신청"
    ) ||
    normalized.includes(
      "학위신청했"
    )
  ) {
    return "degree_application";
  }

  if (
    normalized.includes(
      "자격증신청"
    ) ||
    normalized.includes(
      "자격신청"
    )
  ) {
    return "qualification_application";
  }

  return null;
}

/**
 * 사용자가 현재 진행 중이라고
 * 직접 보고한 경우.
 */
function isProgressReport(
  message: string
) {
  const normalized =
    message.replace(
      /\s+/g,
      ""
    );

  return (
    normalized.includes(
      "하는중"
    ) ||
    normalized.includes(
      "진행중"
    ) ||
    normalized.includes(
      "신청중"
    ) ||
    normalized.includes(
      "처리중"
    ) ||
    normalized.includes(
      "하고있"
    ) ||
    normalized.includes(
      "진행하고있"
    )
  );
}

/**
 * 사용자가 완료했다고 주장한 경우.
 *
 * 중요:
 * 이 값만으로 completed 처리하지 않는다.
 */
function isCompletionReport(
  message: string
) {
  const normalized =
    message.replace(
      /\s+/g,
      ""
    );

  return (
    normalized.includes(
      "완료했"
    ) ||
    normalized.includes(
      "완료됐"
    ) ||
    normalized.includes(
      "완료되었"
    ) ||
    normalized.includes(
      "다했"
    ) ||
    normalized.includes(
      "끝냈"
    ) ||
    normalized.includes(
      "신청했어요"
    ) ||
    normalized.includes(
      "신청했습니다"
    ) ||
    normalized.includes(
      "결제했"
    )
  );
}

function getProcedureLabel(
  procedureType:
    AdministrativeProcedureType
) {
  switch (
    procedureType
  ) {
    case "learner_registration":
      return "학습자등록";

    case "credit_recognition":
      return "학점인정신청";

    case "degree_application":
      return "학위신청";

    case "qualification_application":
      return "자격증신청";
  }
}

/**
 * 등록회원이 카카오에서
 * 행정절차 진행상황을 직접 보고했을 때
 * 실제 AI 학점요약 행정절차 DB에 반영한다.
 *
 * 원칙:
 *
 * 진행중 보고
 * → in_progress
 *
 * 완료 주장
 * → review_required
 *
 * OCR/증빙 검증 성공 전에는
 * 절대로 completed 처리하지 않는다.
 */
export async function executeKakaoAiAdministrativeReportAction(
  params: {
    organizationId: number;

    customer:
      KakaoAiCustomerContext;

    message:
      string;

    kakaoMessageId?:
      string | null;

    hasAttachment:
      boolean;
  }
): Promise<KakaoAiAdministrativeReportActionResult> {
  const customer =
    params.customer;

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

      procedureType:
        null,

      status:
        null,

      changed:
        false,

      replyText:
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

      procedureType:
        null,

      status:
        null,

      changed:
        false,

      replyText:
        null,

      reason:
        "NOT_REGISTERED",
    };
  }

  const message =
    normalizeText(
      params.message
    );

  const procedureType =
    resolveProcedureType(
      message
    );

  if (
    !procedureType
  ) {
    return {
      handled:
        false,

      procedureType:
        null,

      status:
        null,

      changed:
        false,

      replyText:
        null,

      reason:
        "NO_PROCEDURE",
    };
  }

  const completionReport =
    isCompletionReport(
      message
    );

  const progressReport =
    !completionReport &&
    isProgressReport(
      message
    );

  if (
    !completionReport &&
    !progressReport
  ) {
    /**
     * "학습자등록 언제 해요?"
     *
     * 같은 단순 조회를
     * 상태보고로 오인하면 안 된다.
     */
    return {
      handled:
        false,

      procedureType,

      status:
        null,

      changed:
        false,

      replyText:
        null,

      reason:
        "NO_REPORT_STATUS",
    };
  }

  const status:
    | "in_progress"
    | "review_required" =
    completionReport
      ? "review_required"
      : "in_progress";

  const procedureLabel =
    getProcedureLabel(
      procedureType
    );

  const evidenceSummary =
    completionReport
      ? params.hasAttachment
        ? `${procedureLabel} 완료 보고와 첨부자료가 제출되었으나 아직 증빙 검증 전입니다.`
        : `${procedureLabel} 완료 보고가 있었으나 증빙 확인이 필요합니다.`
      : `${procedureLabel} 진행 중이라고 등록회원이 카카오 AI를 통해 보고했습니다.`;

  const result =
    await updateAdministrativeProcedure({
      organizationId:
        params.organizationId,

      studentId,

      procedureType,

      status,

      sourceType:
        "KAKAO_AI",

      actorUserId:
        null,

      /**
       * reportedDate를 AI가 생성하지 않는다.
       * 서버 createdAt / updatedAt이 실제 수신시각 역할을 한다.
       */
      reportedDate:
        null,

      evidenceSummary,

      referenceType:
        params.kakaoMessageId
          ? "kakao_message"
          : null,

      referenceId:
        params.kakaoMessageId ??
        null,

      memo:
        completionReport
          ? "등록회원 완료 보고 - 증빙 확인 전"
          : "등록회원 진행상황 보고",
    });

  /**
   * 실제 값이 변한 경우에만
   * 담당자 AI 업데이트를 만든다.
   *
   * 같은 말을 반복했다고
   * 배지가 계속 증가하면 안 된다.
   */
  if (
    result.changed
  ) {
    await createStudentAiManagementRecord({
      organizationId:
        params.organizationId,

      studentId,

      sourceType:
        "KAKAO_AI",

      noteType:
        "administrative",

      noteStatus:
        completionReport
          ? "action_required"
          : "info",

      inquirySummary:
        message.slice(
          0,
          5000
        ),

      aiSummary:
        evidenceSummary,

      actionSummary:
        completionReport
          ? `${procedureLabel} 완료 여부 확인이 필요합니다.`
          : null,

      referenceType:
        params.kakaoMessageId
          ? "kakao_message"
          : null,

      referenceId:
        params.kakaoMessageId ??
        null,

      actorUserId:
        null,

      /**
       * 진행중 보고는 담당자 배지까지
       * 올리지 않는다.
       *
       * 완료 주장처럼 확인이 필요한 경우만 +1.
       */
      notifyStaff:
        completionReport,

      eventType:
        completionReport
          ? "administrative_status_changed"
          : undefined,

      eventSeverity:
        completionReport
          ? "important"
          : undefined,

      eventTitle:
        completionReport
          ? `${procedureLabel} 완료 확인 필요`
          : null,

      eventMessage:
        completionReport
          ? evidenceSummary
          : null,
    });
  }

  return {
    handled:
      true,

    procedureType,

    status,

    changed:
      result.changed,

    replyText:
      completionReport
        ? params.hasAttachment
          ? `${procedureLabel} 완료 자료 제출 내용은 기록해두었습니다. 현재는 증빙 확인이 필요한 상태로 등록되어 있으며, 확인 후 완료 여부가 반영됩니다.`
          : `${procedureLabel} 완료하셨다는 내용은 기록해두었습니다. 정확한 완료 확인이 필요해 현재는 확인필요 상태로 반영했습니다.`
        : `${procedureLabel} 진행 중인 것으로 기록해두었습니다.`,

    reason:
      "UPDATED",
  };
}