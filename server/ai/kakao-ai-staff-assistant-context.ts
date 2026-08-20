import * as db from "../db";

import {
  buildAiContext,
} from "./ai-context";

import type {
  AiUserContext,
  AiWorkSession,
  AiConversationHistoryMessage,
} from "./ai.types";

export type KakaoAiStaffAssistantContextResult = {
  organizationId:
    number;

  conversationId:
    number;

  userId:
    number;

  role:
    "staff" |
    "admin" |
    "host";

  aiContext:
    AiUserContext;

  workSession:
    AiWorkSession;

  selectedStudentId:
    number | null;

  selectedStudentName:
    string | null;

  conversationHistory:
    AiConversationHistoryMessage[];
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

/**
 * 카카오에서 인증된 CRM 담당자를
 * 기존 EduCanvas AI 업무비서 Context로 변환한다.
 *
 * 중요:
 *
 * 카카오 세션에 저장되어 있는 role을 그대로 믿어서
 * AiUserContext를 직접 만들지 않는다.
 *
 * 매 요청마다:
 *
 * Staff Auth Session
 * → 실제 CRM User 재검증
 * → buildAiContext()
 *
 * 순서로 기존 업무비서 권한을 다시 계산한다.
 */
export async function resolveKakaoAiStaffAssistantContext(
  params: {
    organizationId:
      number;

    conversationId:
      number;
  }
): Promise<
  KakaoAiStaffAssistantContextResult |
  null
> {
  const organizationId =
    normalizePositiveInteger(
      params.organizationId,
      "회사"
    );

  const conversationId =
    normalizePositiveInteger(
      params.conversationId,
      "카카오 대화"
    );

  /**
   * ---------------------------------------------------------
   * 1. 현재 24시간 담당자 인증 Session 확인
   * ---------------------------------------------------------
   *
   * 내부에서:
   *
   * - 같은 organization
   * - 같은 conversation
   * - authenticated 상태
   * - 24시간 만료
   * - 실제 사용자 활성상태
   * - staff/admin/host 여부
   *
   * 를 다시 검증한다.
   */
  const staffSession =
    await db.getActiveKakaoAiStaffAuthSession({
      organizationId,

      conversationId,
    });

  if (
    !staffSession
  ) {
    return null;
  }

  const userId =
    normalizePositiveInteger(
      staffSession.userId,
      "담당자"
    );

  /**
   * ---------------------------------------------------------
   * 2. 실제 CRM 사용자 다시 조회
   * ---------------------------------------------------------
   *
   * Staff Auth Session에서 넘어온 name/role만으로
   * AiUserContext를 만들지 않는다.
   *
   * 현재 DB의 실제 사용자 상태를 기준으로 한다.
   */
  const actualUser =
    await db.getAssignableUserById({
      organizationId,

      userId,
    });

  if (
    !actualUser
  ) {
    /**
     * getActiveKakaoAiStaffAuthSession()에서도
     * 검증하지만 Context 생성 직전에 한 번 더 검사한다.
     */
    await db.revokeKakaoAiStaffAuthSession({
      organizationId,

      conversationId,
    });

    return null;
  }

  const actualRole =
    String(
      actualUser.role ||
      ""
    ).trim();

  if (
    actualRole !==
      "staff" &&
    actualRole !==
      "admin" &&
    actualRole !==
      "host"
  ) {
    await db.revokeKakaoAiStaffAuthSession({
      organizationId,

      conversationId,
    });

    return null;
  }

  /**
   * ---------------------------------------------------------
   * 3. 기존 CRM 업무비서 Context 생성
   * ---------------------------------------------------------
   *
   * buildAiContext가 기존 웹 CRM과 동일하게:
   *
   * - organizationId
   * - teamId
   * - positionId
   * - positionName
   * - scope
   * - allowedAssigneeIds
   * - canWrite
   *
   * 를 서버에서 계산한다.
   */
  const aiContext =
    await buildAiContext({
      user: {
        id:
          userId,

        username:
          actualUser.username,

        name:
          actualUser.name,

        role:
          actualRole,

        /**
         * 카카오 인증 Session에서 확정된 회사.
         *
         * 브라우저나 카카오 메시지에서 받은
         * organizationId를 사용하는 것이 아니다.
         */
        organizationId,
      },

      targetOrganizationId:
        null,
    });

  /**
   * buildAiContext 결과와 Staff Auth Session의 회사가
   * 반드시 동일해야 한다.
   */
  if (
    Number(
      aiContext.organizationId
    ) !==
      organizationId ||
    Number(
      aiContext.userId
    ) !==
      userId
  ) {
    await db.revokeKakaoAiStaffAuthSession({
      organizationId,

      conversationId,
    });

    throw new Error(
      "카카오 담당자 인증정보와 CRM AI 권한정보가 일치하지 않습니다."
    );
  }

  if (
    aiContext.role !==
      "staff" &&
    aiContext.role !==
      "admin" &&
    aiContext.role !==
      "host"
  ) {
    await db.revokeKakaoAiStaffAuthSession({
      organizationId,

      conversationId,
    });

    return null;
  }

  /**
   * ---------------------------------------------------------
   * 4. 기존 CRM AI Work Session 복원
   * ---------------------------------------------------------
   *
   * 카카오 전용 가짜 WorkSession을 만들지 않는다.
   *
   * 기존 CRM 업무비서와 동일한:
   *
   * organizationId + userId
   *
   * 세션을 사용한다.
   */
  const workSession =
    await db.getAiWorkSession({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,
    });

    /**
   * Work Session의 현재 선택 학생.
   *
   * 기존 CRM 업무비서와 동일하게
   * selectedStudentId는 activeTarget.id가 아니라
   * linkedContext.studentId를 기준으로 한다.
   *
   * activeTarget은 화면/대화상 현재 대상 표시용,
   * linkedContext.studentId는 실제 업무 실행 대상 학생 ID다.
   */
  const selectedStudentId =
    Number(
      workSession
        .linkedContext
        .studentId ||
      0
    ) ||
    null;

  /**
   * 기존 CRM 업무비서와 동일하게
   * 선택 학생 이름은 activeTarget에서 가져온다.
   */
  let selectedStudentName:
    string |
    null =
    workSession.activeTarget
      ?.type ===
        "student"
      ? String(
          workSession.activeTarget
            ?.name ||
          ""
        ).trim() ||
        null
      : null;

  /**
   * WorkSession의 이름이 비어있어도
   * 실제 학생을 조회할 수 있으면 서버에서 복원한다.
   */
  if (
    selectedStudentId &&
    !selectedStudentName
  ) {
    const selectedStudent =
      await db.getStudentById(
        selectedStudentId,
        {
          organizationId:
            aiContext.organizationId,
        }
      );

    if (
      selectedStudent
    ) {
      selectedStudentName =
        String(
          selectedStudent.clientName ||
          ""
        ).trim() ||
        null;
    }
  }

  /**
   * ---------------------------------------------------------
   * 5. 기존 CRM 업무비서 대화 History
   * ---------------------------------------------------------
   *
   * 웹 업무비서와 동일한 DB History를 사용한다.
   *
   * 최신 30개까지만 Runner Context에 전달한다.
   */
  const chatRows =
    await db.getAiChatMessages({
      organizationId:
        aiContext.organizationId,

      userId:
        aiContext.userId,

      limit:
        30,
    });

  const conversationHistory:
    AiConversationHistoryMessage[] =
    chatRows
      .filter(
        (
          row:
            any
        ) =>
          row.role ===
            "user" ||
          row.role ===
            "assistant"
      )
      .map(
        (
          row:
            any
        ) => ({
          role:
            row.role as
              | "user"
              | "assistant",

          content:
            String(
              row.content ||
              ""
            )
              .trim()
              .slice(
                0,
                1000
              ),
        })
      )
      .filter(
        item =>
          item.content.length >
          0
      )
      .slice(
        -30
      );

  return {
    organizationId:
      aiContext.organizationId,

    conversationId,

    userId:
      aiContext.userId,

    role:
      aiContext.role as
        | "staff"
        | "admin"
        | "host",

    aiContext,

    workSession,

    selectedStudentId,

    selectedStudentName,

    conversationHistory,
  };
}