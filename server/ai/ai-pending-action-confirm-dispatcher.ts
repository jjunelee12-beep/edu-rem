import {
  throwAppError,
} from "../_core/appError";

import {
  ERROR_CODES,
} from "../_core/errorCodes";

import type {
  AiUserContext,
} from "./ai.types";

import {
  toAiPendingActionPublicResult,
} from "./ai-pending-action-public-result";

import {
  confirmConsultationCreatePendingAction,
} from "./ai-confirm-consultation-create-service";

import {
  confirmStudentRegistrationPendingAction,
} from "./ai-confirm-student-registration-service";

import {
  confirmScheduleCreatePendingAction,
} from "./ai-confirm-schedule-create-service";

import {
  confirmPlanCreatePendingAction,
} from "./ai-confirm-plan-create-service";

import {
  confirmPlanUpdatePendingAction,
} from "./ai-confirm-plan-update-service";

import {
  confirmPlanSubjectsCreatePendingAction,
} from "./ai-confirm-plan-subjects-create-service";

import {
  confirmPlanSubjectsUpdatePendingAction,
} from "./ai-confirm-plan-subjects-update-service";

import {
  confirmSemesterCreatePendingAction,
} from "./ai-confirm-semester-create-service";

import {
  confirmSemesterUpdatePendingAction,
} from "./ai-confirm-semester-update-service";

import {
  confirmSemesterCompletePendingAction,
} from "./ai-confirm-semester-complete-service";

import {
  confirmConsultationUpdatePendingAction,
} from "./ai-confirm-consultation-update-service";

import {
  confirmStudentUpdatePendingAction,
} from "./ai-confirm-student-update-service";

import {
  confirmDocumentImportPendingAction,
} from "./ai-confirm-document-import-service";

type AiPendingActionConfirmation = {
  pendingAction:
    any;

  pendingActionId:
    number;

  actionType:
    string;

  expectedVersion:
    number;

  isDocumentPendingAction:
    boolean;

  actorName:
    string |
    null;
};

/**
 * 공통 Pending Action 실행 결과를
 * 클라이언트 응답의 기본 구조로 만든다.
 *
 * Action별로 필요한 ID나 추가 필드만
 * 각 분기에서 덮어쓴다.
 */
function buildBaseConfirmResponse(
  params: {
    result:
      any;

    actionType:
      string;

    publicPendingAction:
      any;

    workSession:
      any;

    message:
      string;

    aiContext:
      AiUserContext;
  }
) {
  return {
    success:
      params.result.success,

    alreadyExecuted:
      params.result.alreadyExecuted,

    executing:
      params.result.executing,

    actionType:
      params.actionType,

    consultationId:
      null as number | null,

    studentId:
      null as number | null,

    scheduleId:
      null as number | null,

    planId:
      null as number | null,

    semesterId:
      null as number | null,

    semesterIds:
      [] as number[],

    planSubjectIds:
      [] as number[],

    transferSubjectIds:
      [] as number[],

    practiceSaved:
      false,

    paymentUpdated:
      false,

    action:
      params.publicPendingAction,

    pendingAction:
      params.publicPendingAction,

    workSession:
      params.workSession,

    message:
      params.message,

    aiContext:
      params.aiContext,
  };
}

/**
 * Pending Action 공통 보안 검사를 통과한 뒤
 * 실제 Action 종류에 맞는 Confirm Service로 분배한다.
 *
 * 이 함수에서는:
 *
 * - 회사 범위를 새로 결정하지 않는다.
 * - 사용자 권한을 새로 만들지 않는다.
 * - 프론트 입력값으로 organizationId를 신뢰하지 않는다.
 *
 * Router에서 서버 세션 기준으로 생성한
 * aiContext와 Confirm Guard 결과만 사용한다.
 */
export async function dispatchAiPendingActionConfirmation(
  params: {
    aiContext:
      AiUserContext;

    confirmation:
      AiPendingActionConfirmation;
  }
) {
  const {
    aiContext,
    confirmation,
  } = params;

  const {
    pendingAction,
    pendingActionId,
    actionType,
    expectedVersion,
    isDocumentPendingAction,
    actorName,
  } = confirmation;

  /**
   * 상담DB 신규등록
   */
  if (
    actionType ===
      "consultation_create"
  ) {
    const confirmed =
      await confirmConsultationCreatePendingAction({
        pendingActionId,

        expectedVersion,

        aiContext,

        actorName,
      });

    const publicPendingAction =
      toAiPendingActionPublicResult(
        confirmed.pendingAction
      );

    return {
      ...buildBaseConfirmResponse({
        result:
          confirmed.result,

        actionType,

        publicPendingAction,

        workSession:
          confirmed.workSession,

        message:
          confirmed.message,

        aiContext,
      }),

      consultationId:
        confirmed.result
          .consultationId,
    };
  }

  /**
   * 등록예정 학생 통합등록
   */
  if (
    actionType ===
      "student_registration_create"
  ) {
    const consultationId =
      pendingAction
        .consultationId ===
        null ||
      pendingAction
        .consultationId ===
        undefined
        ? null
        : Number(
            pendingAction
              .consultationId
          );

    const confirmed =
      await confirmStudentRegistrationPendingAction({
        pendingActionId,

        expectedVersion,

        aiContext,

        actorName,

        consultationId,
      });

    const publicPendingAction =
      toAiPendingActionPublicResult(
        confirmed.pendingAction
      );

    return {
      ...buildBaseConfirmResponse({
        result:
          confirmed.result,

        actionType,

        publicPendingAction,

        workSession:
          confirmed.workSession,

        message:
          confirmed.completionMessage,

        aiContext,
      }),

      consultationId,

      studentId:
        confirmed.result
          .studentId,

      studentDetailPath:
        confirmed.studentDetailPath,

      planId:
        confirmed.result
          .planId,

      semesterId:
        confirmed.result
          .semesterIds[0] ??
        null,

      semesterIds:
        confirmed.result
          .semesterIds,

      planSubjectIds:
        confirmed.result
          .planSubjectIds,

      transferSubjectIds:
        confirmed.result
          .transferSubjectIds,

      practiceSaved:
        confirmed.result
          .practiceSaved,
    };
  }

  /**
   * 학생 일정 생성
   */
  if (
    actionType ===
      "schedule_create"
  ) {
    const confirmed =
      await confirmScheduleCreatePendingAction({
        pendingActionId,

        expectedVersion,

        aiContext,
      });

    const publicPendingAction =
      toAiPendingActionPublicResult(
        confirmed.pendingAction
      );

    return {
      ...buildBaseConfirmResponse({
        result:
          confirmed.result,

        actionType,

        publicPendingAction,

        workSession:
          confirmed.workSession,

        message:
          confirmed.result.message,

        aiContext,
      }),

      studentId:
        confirmed.result
          .studentId,

      scheduleId:
        confirmed.result
          .scheduleId,
    };
  }

  /**
   * 학생 플랜 생성
   */
  if (
    actionType ===
      "plan_create"
  ) {
    const confirmed =
      await confirmPlanCreatePendingAction({
        pendingActionId,

        expectedVersion,

        aiContext,
      });

    const publicPendingAction =
      toAiPendingActionPublicResult(
        confirmed.pendingAction
      );

    return {
      ...buildBaseConfirmResponse({
        result:
          confirmed.result,

        actionType,

        publicPendingAction,

        workSession:
          confirmed.workSession,

        message:
          confirmed.result.message,

        aiContext,
      }),

      studentId:
        confirmed.result
          .studentId,

      planId:
        confirmed.result
          .planId,
    };
  }

  /**
   * 학생 플랜 수정
   */
  if (
    actionType ===
      "plan_update"
  ) {
    const confirmed =
      await confirmPlanUpdatePendingAction({
        pendingActionId,

        expectedVersion,

        aiContext,
      });

    const publicPendingAction =
      toAiPendingActionPublicResult(
        confirmed.pendingAction
      );

    return {
      ...buildBaseConfirmResponse({
        result:
          confirmed.result,

        actionType,

        publicPendingAction,

        workSession:
          confirmed.workSession,

        message:
          confirmed.result.message,

        aiContext,
      }),

      studentId:
        confirmed.result
          .studentId,

      planId:
        confirmed.result
          .planId,

      updatedFields:
        confirmed.result
          .updatedFields,
    };
  }

  /**
   * 학생 플랜 과목 생성
   */
  if (
    actionType ===
      "plan_subjects_create"
  ) {
    const confirmed =
      await confirmPlanSubjectsCreatePendingAction({
        pendingActionId,

        expectedVersion,

        aiContext,
      });

    const publicPendingAction =
      toAiPendingActionPublicResult(
        confirmed.pendingAction
      );

    return {
      ...buildBaseConfirmResponse({
        result:
          confirmed.result,

        actionType,

        publicPendingAction,

        workSession:
          confirmed.workSession,

        message:
          confirmed.result.message,

        aiContext,
      }),

      studentId:
        confirmed.result
          .studentId,

      planId:
        confirmed.result
          .planId,

      planSubjectIds:
        confirmed.result
          .planSubjectIds,
    };
  }

  /**
   * 학생 플랜 과목 수정
   */
  if (
    actionType ===
      "plan_subjects_update"
  ) {
    const confirmed =
      await confirmPlanSubjectsUpdatePendingAction({
        pendingActionId,

        expectedVersion,

        aiContext,
      });

    const publicPendingAction =
      toAiPendingActionPublicResult(
        confirmed.pendingAction
      );

    return {
      ...buildBaseConfirmResponse({
        result:
          confirmed.result,

        actionType,

        publicPendingAction,

        workSession:
          confirmed.workSession,

        message:
          confirmed.result.message,

        aiContext,
      }),

      studentId:
        confirmed.result
          .studentId,

      planId:
        confirmed.result
          .planId,

      planSubjectIds:
        confirmed.result
          .planSubjectId
          ? [
              confirmed.result
                .planSubjectId,
            ]
          : [],

      updatedFields:
        confirmed.result
          .updatedFields,
    };
  }

  /**
   * 학생 학기 생성
   */
  if (
    actionType ===
      "semester_create"
  ) {
    const confirmed =
      await confirmSemesterCreatePendingAction({
        pendingActionId,

        expectedVersion,

        aiContext,
      });

    const publicPendingAction =
      toAiPendingActionPublicResult(
        confirmed.pendingAction
      );

    return {
      ...buildBaseConfirmResponse({
        result:
          confirmed.result,

        actionType,

        publicPendingAction,

        workSession:
          confirmed.workSession,

        message:
          confirmed.result.message,

        aiContext,
      }),

      studentId:
        confirmed.result
          .studentId,

      semesterId:
        confirmed.result
          .semesterId,

      semesterIds:
        confirmed.result
          .semesterId
          ? [
              confirmed.result
                .semesterId,
            ]
          : [],

      planSubjectIds:
        Array.isArray(
          confirmed.result
            .planSubjectIds
        )
          ? confirmed.result
              .planSubjectIds
          : [],
    };
  }

  /**
   * 학생 학기 수정
   */
  if (
    actionType ===
      "semester_update"
  ) {
    const confirmed =
      await confirmSemesterUpdatePendingAction({
        pendingActionId,

        expectedVersion,

        aiContext,
      });

    const publicPendingAction =
      toAiPendingActionPublicResult(
        confirmed.pendingAction
      );

    return {
      ...buildBaseConfirmResponse({
        result:
          confirmed.result,

        actionType,

        publicPendingAction,

        workSession:
          confirmed.workSession,

        message:
          confirmed.result.message,

        aiContext,
      }),

      studentId:
        confirmed.result
          .studentId,

      semesterId:
        confirmed.result
          .semesterId,

      semesterIds:
        confirmed.result
          .semesterId
          ? [
              confirmed.result
                .semesterId,
            ]
          : [],

      semesterOrder:
        confirmed.result
          .semesterOrder,

      semester:
        confirmed.result
          .semester,
    };
  }

  /**
   * 학생 학기 입력완료
   */
  if (
    actionType ===
      "semester_complete"
  ) {
    const confirmed =
      await confirmSemesterCompletePendingAction({
        pendingActionId,

        expectedVersion,

        aiContext,
      });

    const publicPendingAction =
      toAiPendingActionPublicResult(
        confirmed.pendingAction
      );

    return {
      ...buildBaseConfirmResponse({
        result:
          confirmed.result,

        actionType,

        publicPendingAction,

        workSession:
          confirmed.workSession,

        message:
          confirmed.result.message,

        aiContext,
      }),

      studentId:
        confirmed.result
          .studentId,

      semesterId:
        confirmed.result
          .semesterId,

      semesterIds:
        confirmed.result
          .semesterId
          ? [
              confirmed.result
                .semesterId,
            ]
          : [],

      isCompleted:
        confirmed.result
          .isCompleted,

      approvalStatus:
        confirmed.result
          .approvalStatus,

      semesterOrder:
        confirmed.result
          .semesterOrder,

      semester:
        "semester" in
          confirmed.result
          ? confirmed.result
              .semester
          : null,
    };
  }

  /**
   * 상담DB 정보 수정
   */
  if (
    actionType ===
      "consultation_update"
  ) {
    const confirmed =
      await confirmConsultationUpdatePendingAction({
        pendingActionId,

        expectedVersion,

        aiContext,
      });

    const publicPendingAction =
      toAiPendingActionPublicResult(
        confirmed.pendingAction
      );

    return {
      ...buildBaseConfirmResponse({
        result:
          confirmed.result,

        actionType,

        publicPendingAction,

        workSession:
          confirmed.workSession,

        message:
          confirmed.result.message,

        aiContext,
      }),

      consultationId:
        confirmed.result
          .consultationId,
    };
  }

  /**
   * 학생 기본정보 수정
   */
  if (
    actionType ===
      "student_update"
  ) {
    const confirmed =
      await confirmStudentUpdatePendingAction({
        pendingActionId,

        expectedVersion,

        aiContext,
      });

    const publicPendingAction =
      toAiPendingActionPublicResult(
        confirmed.pendingAction
      );

    return {
      ...buildBaseConfirmResponse({
        result:
          confirmed.result,

        actionType,

        publicPendingAction,

        workSession:
          confirmed.workSession,

        message:
          confirmed.result.message,

        aiContext,
      }),

      studentId:
        confirmed.result
          .studentId,
    };
  }

  /**
   * OCR / 문서 분석 결과 CRM 반영
   */
  if (
    isDocumentPendingAction
  ) {
    const confirmed =
      await confirmDocumentImportPendingAction({
        pendingActionId,

        expectedVersion,

        aiContext,

        actorName,

        requestedByUserId:
          Number(
            pendingAction
              .requestedByUserId ||
            0
          ),
      });

    const publicPendingAction =
      toAiPendingActionPublicResult(
        confirmed.pendingAction
      );

    return {
      ...buildBaseConfirmResponse({
        result:
          confirmed.result,

        actionType,

        publicPendingAction,

        workSession:
          confirmed.workSession,

        message:
          confirmed.result.message,

        aiContext,
      }),

      studentId:
        confirmed.result
          .studentId,

      semesterId:
        confirmed.result
          .semesterId,

      semesterIds:
        confirmed.result
          .semesterId
          ? [
              confirmed.result
                .semesterId,
            ]
          : [],

      planSubjectIds:
        confirmed.result
          .planSubjectIds,

      transferSubjectIds:
        confirmed.result
          .transferSubjectIds,

      paymentUpdated:
        confirmed.result
          .paymentUpdated,
    };
  }

  throwAppError(
    ERROR_CODES.INVALID_REQUEST,
    "현재 승인 실행을 지원하지 않는 AI 작업입니다.",
    400
  );
}