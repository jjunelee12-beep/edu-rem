import * as db from "../db";

export type KakaoAiDeveloperTestCommand =
  | "member_test"
  | "developer_lead"
  | "developer_staff"
  | "developer_reset";

export type KakaoAiDeveloperTestActionResult = {
  handled:
    boolean;

  success:
    boolean;

  command:
    KakaoAiDeveloperTestCommand | null;

  mode:
    | "lead"
    | "registered"
    | "staff"
    | null;

  studentId:
    number | null;

  staffUserId:
    number | null;

  replyText:
    string;

  errorMessage:
    string | null;
};

export async function executeKakaoAiDeveloperTestAction(
  params: {
    organizationId:
      number;

    conversationId:
      number;

    command:
      KakaoAiDeveloperTestCommand;

    allowed:
      boolean;

    memberTestStudentId?:
      number | null;
  }
): Promise<KakaoAiDeveloperTestActionResult> {
  /**
   * Developer Gate를 통과하지 못한 경우
   * DB에는 아무것도 쓰지 않는다.
   */
  if (
    params.allowed !==
      true
  ) {
    return {
      handled:
        true,

      success:
        false,

      command:
        params.command,

      mode:
        null,

      studentId:
        null,

      staffUserId:
        null,

      replyText:
        "사용할 수 없는 명령입니다.",

      errorMessage:
        "DEVELOPER_ACCESS_DENIED",
    };
  }

  /**
   * ---------------------------------------------------------
   * /lead
   * ---------------------------------------------------------
   *
   * 실제 customerType / studentId는 건드리지 않고
   * 개발자 테스트 Context만 lead로 강제한다.
   */
  if (
    params.command ===
      "developer_lead"
  ) {
    await db.setKakaoAiDeveloperTestSession({
      organizationId:
        params.organizationId,

      conversationId:
        params.conversationId,

      mode:
        "lead",

      studentId:
        null,

      staffUserId:
        null,
    });

    return {
      handled:
        true,

      success:
        true,

      command:
        params.command,

      mode:
        "lead",

      studentId:
        null,

      staffUserId:
        null,

      replyText:
        "개발자 테스트 모드를 신규상담자로 전환했습니다.",

      errorMessage:
        null,
    };
  }

  /**
   * ---------------------------------------------------------
   * /member-test <studentId>
   * ---------------------------------------------------------
   */
  if (
    params.command ===
      "member_test"
  ) {
    const studentId =
      Math.floor(
        Number(
          params.memberTestStudentId ||
          0
        )
      );

    if (
      !Number.isFinite(
        studentId
      ) ||
      studentId <=
        0
    ) {
      return {
        handled:
          true,

        success:
          false,

        command:
          params.command,

        mode:
          null,

        studentId:
          null,

        staffUserId:
          null,

        replyText:
          "테스트할 학생 ID를 함께 입력해주세요. 예: /member-test 123",

        errorMessage:
          "INVALID_MEMBER_TEST_STUDENT_ID",
      };
    }

    /**
     * 이 함수 내부에서:
     *
     * organizationId
     * student 존재 여부
     * approvalStatus === 승인
     *
     * 을 다시 검증한다.
     */
    await db.setKakaoAiDeveloperTestSession({
      organizationId:
        params.organizationId,

      conversationId:
        params.conversationId,

      mode:
        "registered",

      studentId,

      staffUserId:
        null,
    });

    const student =
      await db.getStudentById(
        studentId,
        {
          organizationId:
            params.organizationId,
        }
      );

    const studentName =
      String(
        (student as any)
          ?.clientName ||
        ""
      ).trim();

    return {
      handled:
        true,

      success:
        true,

      command:
        params.command,

      mode:
        "registered",

      studentId,

      staffUserId:
        null,

      replyText:
        studentName
          ? `개발자 등록회원 테스트 모드로 전환했습니다. 현재 테스트 회원은 ${studentName}님(ID ${studentId})입니다.`
          : `개발자 등록회원 테스트 모드로 전환했습니다. 현재 테스트 studentId는 ${studentId}입니다.`,

      errorMessage:
        null,
    };
  }

  /**
   * ---------------------------------------------------------
   * /test-reset
   * ---------------------------------------------------------
   */
  if (
    params.command ===
      "developer_reset"
  ) {
    await db.clearKakaoAiDeveloperTestSession({
      organizationId:
        params.organizationId,

      conversationId:
        params.conversationId,
    });

    return {
      handled:
        true,

      success:
        true,

      command:
        params.command,

      mode:
        null,

      studentId:
        null,

      staffUserId:
        null,

      replyText:
        "개발자 테스트 모드를 종료했습니다. 실제 카카오 인증 상태는 변경하지 않았습니다.",

      errorMessage:
        null,
    };
  }

  /**
   * ---------------------------------------------------------
   * /staff-test
   * ---------------------------------------------------------
   *
   * 아직 개발자 CRM userId 연결 전.
   *
   * 잘못된 userId를 임의로 넣지 않기 위해
   * 이번 단계에서는 DB 변경을 수행하지 않는다.
   */
  if (
    params.command ===
      "developer_staff"
  ) {
    return {
      handled:
        true,

      success:
        false,

      command:
        params.command,

      mode:
        null,

      studentId:
        null,

      staffUserId:
        null,

      replyText:
        "담당자 테스트 계정 연결이 아직 설정되지 않았습니다.",

      errorMessage:
        "DEVELOPER_STAFF_USER_NOT_CONFIGURED",
    };
  }

  return {
    handled:
      false,

    success:
      false,

    command:
      null,

    mode:
      null,

    studentId:
      null,

    staffUserId:
      null,

    replyText:
      "",

    errorMessage:
      null,
  };
}