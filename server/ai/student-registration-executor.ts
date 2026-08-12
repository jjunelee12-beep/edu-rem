import * as db from "../db";

import type {
  StudentRegistrationDraft,
} from "./ai.types";

import {
  throwAppError,
} from "../_core/appError";

import {
  ERROR_CODES,
} from "../_core/errorCodes";

export type ExecuteStudentRegistrationPendingActionInput = {
  pendingActionId: number;

  organizationId: number;

  requestedByUserId: number;
  confirmedByUserId: number;

  expectedVersion: number;

  actorName?: string | null;
  actorRole?: string | null;
};

export type ExecuteStudentRegistrationPendingActionResult = {
  success: boolean;

  alreadyExecuted: boolean;
  executing: boolean;

  pendingAction: any;

   studentId: number | null;

  planId: number | null;

  semesterIds: number[];

  planSubjectIds: number[];

  transferSubjectIds: number[];

  practiceSaved: boolean;

  message: string;
};

function normalizePositiveInteger(
  value: unknown,
  message: string
) {
  const numberValue =
    Number(value || 0);

  if (
    !Number.isFinite(
      numberValue
    ) ||
    numberValue <= 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      message,
      400
    );
  }

  return Math.floor(
    numberValue
  );
}

function normalizePositiveIntegerArray(
  value: unknown
): number[] {
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
        .map(Number)
        .filter(
          (id) =>
            Number.isFinite(
              id
            ) &&
            id > 0
        )
        .map(
          (id) =>
            Math.floor(id)
        )
    )
  );
}

function normalizeRequiredText(
  value:
    unknown,

  fieldLabel:
    string
): string {
  const normalized =
    String(
      value ??
      ""
    ).trim();

  if (
    !normalized
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      `${fieldLabel} 정보가 필요합니다.`,
      409
    );
  }

  return normalized;
}

function normalizeNonNegativeNumber(
  value:
    unknown,

  fieldLabel:
    string
): number {
  if (
    value ===
      null ||
    value ===
      undefined ||
    value ===
      ""
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      `${fieldLabel} 정보가 필요합니다.`,
      409
    );
  }

  const numberValue =
    Number(
      value
    );

  if (
    !Number.isFinite(
      numberValue
    ) ||
    numberValue < 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      `${fieldLabel} 정보가 올바르지 않습니다.`,
      409
    );
  }

  return numberValue;
}

function normalizeRequiredMonth(
  value:
    unknown,

  fieldLabel:
    string
): string {
  const normalized =
    normalizeRequiredText(
      value,
      fieldLabel
    );

  if (
    !/^\d{4}-\d{2}$/.test(
      normalized
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      `${fieldLabel} 형식이 올바르지 않습니다.`,
      409
    );
  }

  const [
    yearText,
    monthText,
  ] =
    normalized.split(
      "-"
    );

  const year =
    Number(
      yearText
    );

  const month =
    Number(
      monthText
    );

  if (
    !Number.isInteger(
      year
    ) ||
    year < 2000 ||
    year > 2100 ||
    !Number.isInteger(
      month
    ) ||
    month < 1 ||
    month > 12
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      `${fieldLabel} 형식이 올바르지 않습니다.`,
      409
    );
  }

  return normalized;
}

function normalizeRequiredSemesterLabel(
  value:
    unknown,

  fieldLabel:
    string
): string {
  const normalized =
    normalizeRequiredText(
      value,
      fieldLabel
    );

  const match =
    normalized.match(
      /^(20\d{2})년\s*([12])학기$/
    );

  if (
    !match
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      `${fieldLabel} 형식이 올바르지 않습니다.`,
      409
    );
  }

  return `${match[1]}년 ${match[2]}학기`;
}

function normalizePendingDraft(
  value: unknown
): StudentRegistrationDraft {
  if (
    !value ||
    typeof value !== "object"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학생 통합등록 초안 데이터가 올바르지 않습니다.",
      400
    );
  }

  const draft =
    value as StudentRegistrationDraft;

  if (
    draft.canConfirm !== true ||
    (
      Array.isArray(
        draft.missingFields
      ) &&
      draft.missingFields.length > 0
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "필수 정보가 누락된 학생 통합등록 초안입니다.",
      409
    );
  }

  if (
    !Array.isArray(
      draft.semesters
    ) ||
    draft.semesters.length === 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "등록할 학기 정보가 없습니다.",
      400
    );
  }

  if (
    !Array.isArray(
      draft.planSubjects
    ) ||
    draft.planSubjects.length === 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "저장할 우리플랜 과목 정보가 없습니다.",
      400
    );
  }

  if (
    Array.isArray(
      draft.duplicateSubjects
    ) &&
    draft.duplicateSubjects.length > 0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "중복 과목이 포함된 학생 과목설계 초안입니다.",
      409
    );
  }

  const hasUnconfirmedPlanSubject =
    draft.planSubjects.some(
      (subject) =>
        subject.isConfirmed ===
        false
    );

  const hasUnconfirmedTransferSubject =
    Array.isArray(
      draft.transferSubjects
    ) &&
    draft.transferSubjects.some(
      (subject) =>
        subject.isConfirmed ===
        false
    );

  if (
    hasUnconfirmedPlanSubject ||
    hasUnconfirmedTransferSubject
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "확인이 완료되지 않은 과목이 포함된 초안입니다.",
      409
    );
  }

  /**
   * 학생 통합등록 실행 단계에서는
   * 등록예정 상태의 초안만 허용한다.
   *
   * 이전 버전에서 생성된 "등록" 초안이나
   * 변조된 Pending Action 실행을 차단한다.
   */
  if (
    String(
      draft.student?.status ||
      ""
    ).trim() !==
      "등록예정"
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      "학생 상태가 등록예정인 통합등록 초안만 실행할 수 있습니다.",
      409
    );
  }

normalizePositiveInteger(
  draft.consultationId,
  "상담DB 정보가 올바르지 않습니다."
);

normalizeRequiredText(
  draft.student
    ?.clientName,
  "회원명"
);

const normalizedPhone =
  String(
    draft.student
      ?.phone ||
    ""
  )
    .replace(
      /\D/g,
      ""
    );

if (
  normalizedPhone.length <
    10 ||
  normalizedPhone.length >
    11
) {
  throwAppError(
    ERROR_CODES.INVALID_REQUEST,
    "학생 연락처 정보가 올바르지 않습니다.",
    409
  );
}

normalizePositiveInteger(
  draft.student
    ?.assigneeId,
  "학생 담당자 정보가 올바르지 않습니다."
);

normalizeRequiredText(
  draft.student
    ?.desiredCourse ||
  draft.plan
    ?.courseName,
  "희망 과정"
);

normalizeRequiredText(
  draft.student
    ?.finalEducation ||
  draft.plan
    ?.finalEducation,
  "최종학력"
);

if (
  !draft.practice ||
  typeof draft.practice !==
    "object"
) {
  throwAppError(
    ERROR_CODES.INVALID_REQUEST,
    "실습 필요 여부가 확정되지 않은 학생 통합등록 초안입니다.",
    409
  );
}

if (
  draft.practice.required ===
    true
) {
  normalizeRequiredText(
    draft.practice
      .courseName,
    "실습 과정"
  );

  normalizePositiveInteger(
    draft.practice
      .semesterNo,
    "실습 예정 학기 정보가 올바르지 않습니다."
  );

  normalizePositiveInteger(
    draft.practice
      .requiredHours,
    "실습 시간 정보가 올바르지 않습니다."
  );
}

const semesterNoSet =
  new Set<number>();

for (
  const semester of
  draft.semesters
) {
  const semesterNo =
    normalizePositiveInteger(
      semester.semesterNo,
      "학기 번호가 올바르지 않습니다."
    );

  if (
    semesterNoSet.has(
      semesterNo
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      `${semesterNo}학기차 정보가 중복되어 있습니다.`,
      409
    );
  }

  semesterNoSet.add(
    semesterNo
  );

  normalizeRequiredSemesterLabel(
    semester.semesterLabel,
    `${semesterNo}학기차 학기 구분`
  );

  normalizeRequiredMonth(
    semester.plannedStartMonth,
    `${semesterNo}학기차 예정 개강월`
  );

  normalizeRequiredText(
    semester.plannedInstitution,
    `${semesterNo}학기차 예정 교육원`
  );

  normalizePositiveInteger(
    semester.plannedSubjectCount,
    `${semesterNo}학기차 예정 과목 수가 올바르지 않습니다.`
  );

  normalizeNonNegativeNumber(
    semester.plannedAmount,
    `${semesterNo}학기차 예정금액`
  );

  if (
    semester.actualPaymentAmount !==
      null &&
    semester.actualPaymentAmount !==
      undefined
  ) {
    normalizeNonNegativeNumber(
      semester.actualPaymentAmount,
      `${semesterNo}학기차 실제 결제금액`
    );

    normalizeRequiredText(
      semester.paymentDate,
      `${semesterNo}학기차 결제일`
    );
  }
}

if (
  draft.practice.required ===
    true &&
  !semesterNoSet.has(
    Number(
      draft.practice
        .semesterNo
    )
  )
) {
  throwAppError(
    ERROR_CODES.INVALID_REQUEST,
    "실습 예정 학기에 해당하는 학기 정보가 없습니다.",
    409
  );
}

for (
  const semester of
  draft.semesters
) {
  const semesterNo =
    Number(
      semester.semesterNo
    );

  const semesterPlanSubjects =
    draft.planSubjects.filter(
      (
        subject
      ) =>
        Number(
          subject.semesterNo
        ) ===
        semesterNo
    );

  if (
    semesterPlanSubjects.length ===
    0
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      `${semesterNo}학기차에 저장할 우리플랜 과목이 없습니다.`,
      409
    );
  }

  if (
    Number(
      semester.plannedSubjectCount
    ) !==
    semesterPlanSubjects.length
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      `${semesterNo}학기차 예정 과목 수와 실제 설계 과목 수가 일치하지 않습니다.`,
      409
    );
  }
}

for (
  const subject of
  draft.planSubjects
) {
  const subjectName =
    normalizeRequiredText(
      subject.subjectName,
      "우리플랜 과목명"
    );

  const semesterNo =
    normalizePositiveInteger(
      subject.semesterNo,
      `우리플랜 과목 '${subjectName}'의 학기 정보가 올바르지 않습니다.`
    );

  if (
    !semesterNoSet.has(
      semesterNo
    )
  ) {
    throwAppError(
      ERROR_CODES.INVALID_REQUEST,
      `우리플랜 과목 '${subjectName}'에 해당하는 학기 정보가 없습니다.`,
      409
    );
  }

  normalizePositiveInteger(
    subject.credits,
    `우리플랜 과목 '${subjectName}'의 학점 정보가 올바르지 않습니다.`
  );
}

for (
  const subject of
  draft.transferSubjects ||
  []
) {
  const subjectName =
    normalizeRequiredText(
      subject.subjectName,
      "전적대 과목명"
    );

  normalizePositiveInteger(
    subject.credits,
    `전적대 과목 '${subjectName}'의 학점 정보가 올바르지 않습니다.`
  );
}

  return draft;
}

/**
 * 등록예정 학생 생성 및 과목설계 Pending Action 실행
 *
 * 1. 실행 선점
 * 2. 과목설계 초안 검증
 * 3. 원본 상담 변경 여부 확인
 * 4. 등록예정 학생 및 과목설계 트랜잭션
 * 5. Pending Action 성공 또는 실패 처리
 */
export async function executeStudentRegistrationPendingAction(
  input: ExecuteStudentRegistrationPendingActionInput
): Promise<ExecuteStudentRegistrationPendingActionResult> {
  const pendingActionId =
    normalizePositiveInteger(
      input.pendingActionId,
      "올바른 AI 승인 요청 ID가 필요합니다."
    );

  const organizationId =
    normalizePositiveInteger(
      input.organizationId,
      "올바른 회사 정보가 필요합니다."
    );

  const requestedByUserId =
    normalizePositiveInteger(
      input.requestedByUserId,
      "AI 초안 요청 사용자 정보가 올바르지 않습니다."
    );

  const confirmedByUserId =
    normalizePositiveInteger(
      input.confirmedByUserId,
      "AI 초안 승인 사용자 정보가 올바르지 않습니다."
    );

  const expectedVersion =
    normalizePositiveInteger(
      input.expectedVersion,
      "올바른 AI 초안 버전이 필요합니다."
    );

  /**
   * 동일 pending action 중복 실행 선점
   */
  const claim =
    await db.claimAiPendingActionForExecution({
      id:
        pendingActionId,

      organizationId,

      requestedByUserId,

      confirmedByUserId,

      expectedVersion,
    });

  /**
   * 이미 실행 완료된 요청이면
   * 저장된 결과를 그대로 반환한다.
   */
   if (
    claim.alreadyExecuted
  ) {
    const result =
      claim.action
        ?.executionResultJson &&
      typeof claim.action
        .executionResultJson ===
        "object"
        ? claim.action
            .executionResultJson as any
        : null;

    const studentId =
      result?.studentId
        ? Number(
            result.studentId
          )
        : claim.action
            ?.studentId
          ? Number(
              claim.action
                .studentId
            )
          : null;

    const planId =
      result?.planId
        ? Number(
            result.planId
          )
        : null;

    return {
      success:
        true,

      alreadyExecuted:
        true,

      executing:
        false,

      pendingAction:
        claim.action,

      studentId:
        studentId &&
        Number.isFinite(
          studentId
        ) &&
        studentId > 0
          ? studentId
          : null,

      planId:
        planId &&
        Number.isFinite(
          planId
        ) &&
        planId > 0
          ? planId
          : null,

      semesterIds:
        normalizePositiveIntegerArray(
          result?.semesterIds
        ),

      planSubjectIds:
        normalizePositiveIntegerArray(
          result?.planSubjectIds
        ),

      transferSubjectIds:
        normalizePositiveIntegerArray(
          result?.transferSubjectIds
        ),

      practiceSaved:
        result?.practiceSaved ===
        true,

      message:
        result?.message ||
        "이미 등록예정 학생 생성 및 과목설계 저장이 완료된 요청입니다.",
    };
  }

  /**
   * 다른 요청에서 이미 실행 중
   */
  if (
    !claim.claimed
  ) {
    return {
      success:
        false,

      alreadyExecuted:
        false,

      executing:
        true,

      pendingAction:
        claim.action,

            studentId:
        null,

      planId:
        null,

      semesterIds:
        [],

      planSubjectIds:
        [],

      transferSubjectIds:
        [],

      practiceSaved:
        false,

      message:
        "등록예정 학생 생성 및 과목설계 저장 작업이 이미 실행 중입니다.",
    };
  }

  const action =
    claim.action;

  const completedSteps:
    string[] = [];

  try {
    if (
      action.actionType !==
      "student_registration_create"
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "등록예정 학생 생성 및 과목설계 승인 요청이 아닙니다.",
        400
      );
    }

    const draft =
      normalizePendingDraft(
        action.payloadJson
      );

    completedSteps.push(
      "승인 초안 검증"
    );

    const consultationId =
      normalizePositiveInteger(
        draft.consultationId,
        "상담DB 정보가 올바르지 않습니다."
      );

    if (
      Number(
        action.consultationId ||
        0
      ) !== consultationId
    ) {
      throwAppError(
        ERROR_CODES.INVALID_REQUEST,
        "승인 초안의 상담DB 정보가 일치하지 않습니다.",
        409
      );
    }

    /**
     * Preview 이후 상담DB가 변경됐는지 검사
     */
    const consultation =
      await db.getConsultation(
        consultationId,
        {
          organizationId,
        }
      );

    if (!consultation) {
      throwAppError(
        ERROR_CODES.DATA_NOT_FOUND,
        "상담DB 정보를 찾을 수 없습니다.",
        404
      );
    }

/**
 * 학생 통합등록은 해당 상담의 담당자만 실행할 수 있다.
 *
 * Pending Action의 요청자와 실제 승인자가 모두
 * 현재 상담 담당자와 일치해야 한다.
 *
 * 프론트에서 전달된 담당자 값은 사용하지 않고,
 * DB에서 다시 조회한 consultation.assigneeId를 기준으로 검사한다.
 */
const consultationAssigneeId =
  Number(
    (consultation as any)
      .assigneeId ||
    0
  );

if (
  !Number.isFinite(
    consultationAssigneeId
  ) ||
  consultationAssigneeId <= 0
) {
  throwAppError(
    ERROR_CODES.INVALID_REQUEST,
    "상담DB 담당자 정보를 확인할 수 없습니다.",
    409
  );
}

if (
  Math.floor(
    consultationAssigneeId
  ) !== requestedByUserId
) {
  throwAppError(
    ERROR_CODES.FORBIDDEN,
    "해당 상담의 담당자만 학생 통합등록을 요청할 수 있습니다.",
    403
  );
}

if (
  Math.floor(
    consultationAssigneeId
  ) !== confirmedByUserId
) {
  throwAppError(
    ERROR_CODES.FORBIDDEN,
    "해당 상담의 담당자만 학생 통합등록을 승인할 수 있습니다.",
    403
  );
}

completedSteps.push(
  "상담 담당자 등록권한 확인"
);

    const sourceSnapshot =
      action.sourceSnapshotJson &&
      typeof action
        .sourceSnapshotJson ===
        "object"
        ? action
            .sourceSnapshotJson as any
        : null;

    const sourceConsultation =
      sourceSnapshot
        ?.consultation ||
      null;

    if (
      sourceConsultation
        ?.updatedAt &&
      consultation.updatedAt
    ) {
      const originalUpdatedAt =
        new Date(
          sourceConsultation
            .updatedAt
        ).getTime();

      const currentUpdatedAt =
        new Date(
          consultation
            .updatedAt
        ).getTime();

      if (
        Number.isFinite(
          originalUpdatedAt
        ) &&
        Number.isFinite(
          currentUpdatedAt
        ) &&
        originalUpdatedAt !==
          currentUpdatedAt
      ) {
        throwAppError(
          ERROR_CODES.INVALID_REQUEST,
          "미리보기 생성 후 상담DB 내용이 변경되었습니다. 최신 내용으로 다시 미리보기를 생성해주세요.",
          409
        );
      }
    }

    completedSteps.push(
      "상담DB 원본 재검증"
    );

    const existingStudent =
      await db.getStudentByConsultationId(
        consultationId,
        {
          organizationId,
        }
      );

    if (existingStudent) {
      throwAppError(
        ERROR_CODES.DUPLICATE_RESOURCE,
        "이미 등록예정 학생으로 전환되었거나 기존 학생과 연결된 상담DB입니다.",
        409
      );
    }

    /**
     * 실제 학생 통합등록
     */
    const transactionResult =
  await db.executeStudentRegistrationTransaction({
    organizationId,

    draft,

    actorUserId:
      confirmedByUserId,

    actorName:
      input.actorName ??
      null,

    actorRole:
      input.actorRole ??
      null,

    pendingActionId,

    requestedByUserId,

    confirmedByUserId,

    expectedVersion,
  });

    completedSteps.push(
      ...transactionResult
        .completedSteps
    );

       const executedAction =
      transactionResult
        .pendingAction;

    if (
      !executedAction
    ) {
      throwAppError(
        ERROR_CODES.INTERNAL_SERVER_ERROR,
        "완료된 AI 승인 요청 결과가 없습니다.",
        500
      );
    }

        /**
     * AI 실행 이력
     *
     * 학생 통합등록과 Pending Action 성공 처리는
     * 이미 완료된 상태다.
     *
     * 로그 저장 실패가 실제 등록 결과를
     * 실패로 변경하지 않도록 별도 처리한다.
     */
    try {
      await db.createAiActionLog({
        organizationId,

        userId:
          confirmedByUserId,

        userName:
          input.actorName ||
          `사용자 ${confirmedByUserId}`,

        action:
          "student_registration_create",

        targetStudentId:
          transactionResult
            .studentId,

        targetStudentName:
          draft.student
            ?.clientName ||
          null,

        payload: {
          pendingActionId,

          consultationId,

          registrationMode:
            "planning",

          consultationStatus:
            "등록예정",

          studentStatus:
            draft.student
              ?.status ||
            "등록예정",

          studentApprovalStatus:
            "대기",

          semesterApprovalStatus:
            "요청전",

          planId:
            transactionResult
              .planId,

          semesterIds:
            transactionResult
              .semesterIds,

          planSubjectIds:
            transactionResult
              .planSubjectIds,

          transferSubjectIds:
            transactionResult
              .transferSubjectIds,

          practiceSaved:
            transactionResult
              .practiceSaved,
        },
      });
    } catch (
      logError
    ) {
      /**
       * 개인정보나 전체 payload가 로그에 남지 않도록
       * 제한된 정보만 서버 오류 로그에 기록한다.
       */
      console.error(
        "[AI STUDENT REGISTRATION] 실행로그 저장 실패",
        {
          pendingActionId,

          organizationId,

          studentId:
            transactionResult
              .studentId,

          message:
            logError instanceof
              Error
              ? String(
                  logError.message ||
                  "알 수 없는 오류"
                )
                  .replace(
                    /\s+/g,
                    " "
                  )
                  .trim()
                  .slice(
                    0,
                    300
                  )
              : "알 수 없는 오류",
        }
      );
    }

    return {
      success:
        true,

      alreadyExecuted:
        false,

      executing:
        false,

      pendingAction:
        executedAction,

            studentId:
        transactionResult
          .studentId,

      planId:
        transactionResult
          .planId,

      semesterIds:
        transactionResult
          .semesterIds,

      planSubjectIds:
        transactionResult
          .planSubjectIds,

      transferSubjectIds:
        transactionResult
          .transferSubjectIds,

      practiceSaved:
        transactionResult
          .practiceSaved,

      message:
        "등록예정 학생 생성 및 과목설계 저장이 완료되었습니다.",
    };
  } catch (
    error: any
  ) {
    const errorMessage =
      String(
        error?.message ||
             "등록예정 학생 생성 및 과목설계 저장 중 오류가 발생했습니다."
      );

    /**
     * 트랜잭션 실패 후 Pending Action을 failed로 변경한다.
     */
        try {
      const latestAction =
        await db.getAiPendingActionForConfirmation({
          id:
            pendingActionId,

          organizationId,

          requestedByUserId,
        });

      /**
       * 트랜잭션에서 이미 executed 처리된 경우에는
       * failed 상태 변경을 시도하지 않는다.
       */
      if (
        latestAction?.status !==
          "executed"
      ) {
        await db.markAiPendingActionFailed({
          id:
            pendingActionId,

          organizationId,

          requestedByUserId,

          expectedVersion,

          errorMessage,

          completedSteps,

          failedSteps: [
            errorMessage,
          ],
        });
      }
    } catch {
      /**
       * 원래 발생한 실행 오류를 유지한다.
       */
    }

    throw error;
  }
}