/**
 * Kakao AI Command Router
 *
 * 역할:
 *
 * 기본 메시지
 * → 기존 신규상담 / 자연어 AI 흐름
 *
 * /member
 * → 등록회원 인증 진입
 *
 * /staff
 * → 담당자 CRM 로그인 진입
 *
 * /member-test <studentId>
 * → 허용된 개발자 계정의 등록회원 테스트 진입
 *
 * /reset
 * → 현재 대화 주제/작업상태 초기화
 *
 * 중요:
 * 이 파일은 명령어를 "판별"만 한다.
 *
 * - 학생 인증 X
 * - Staff 권한 부여 X
 * - DB 수정 X
 * - 로그인 토큰 생성 X
 *
 * 실제 실행은 각각의 서버 Action에서 수행한다.
 */

export type KakaoAiSystemCommand =
  | "member"
  | "staff"
  | "member_test"
  | "developer_lead"
  | "developer_staff"
  | "developer_reset"
  | "reset";

export type KakaoAiCommandRoute =
  | {
      handled:
        false;

      command:
        null;

      rawCommand:
        null;

      memberTestStudentId:
        null;

      errorCode:
        null;

      errorMessage:
        null;
    }
  | {
      handled:
        true;

      command:
        KakaoAiSystemCommand;

      rawCommand:
        string;

      memberTestStudentId:
        number | null;

      errorCode:
        | "INVALID_MEMBER_TEST_STUDENT_ID"
        | null;

      errorMessage:
        string | null;
    };

function normalizeCommandText(
  value:
    unknown
): string {
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

function normalizePositiveInteger(
  value:
    unknown
): number | null {
  const normalized =
    Math.floor(
      Number(
        value
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

/**
 * 명령어만 판별한다.
 *
 * 일반 자연어는 handled=false로 반환하여
 * 기존 Kakao AI 흐름을 그대로 타게 한다.
 */
export function routeKakaoAiCommand(
  message:
    unknown
): KakaoAiCommandRoute {
  const text =
    normalizeCommandText(
      message
    );

  if (
    !text
  ) {
    return {
      handled:
        false,

      command:
        null,

      rawCommand:
        null,

      memberTestStudentId:
        null,

      errorCode:
        null,

      errorMessage:
        null,
    };
  }

  /**
   * ---------------------------------------------------------
   * /member
   * ---------------------------------------------------------
   *
   * 등록회원 인증 진입점.
   *
   * 인증 그 자체가 아니라
   * 기존 Registration Verifier를 시작시키는 명령어다.
   */
  if (
    /^\/member$/i.test(
      text
    ) ||
    /^\/등록자$/i.test(
      text
    ) ||
    /^\/등록회원$/i.test(
      text
    )
  ) {
    return {
      handled:
        true,

      command:
        "member",

      rawCommand:
        text,

      memberTestStudentId:
        null,

      errorCode:
        null,

      errorMessage:
        null,
    };
  }

  /**
   * ---------------------------------------------------------
   * /staff
   * ---------------------------------------------------------
   *
   * 담당자 업무비서 진입점.
   *
   * 추후:
   * 1회용 CRM 로그인 링크
   * → CRM userId 확인
   * → 24시간 Staff Session
   *
   * 으로 연결한다.
   */
  if (
    /^\/staff$/i.test(
      text
    ) ||
    /^\/담당자$/i.test(
      text
    )
  ) {
    return {
      handled:
        true,

      command:
        "staff",

      rawCommand:
        text,

      memberTestStudentId:
        null,

      errorCode:
        null,

      errorMessage:
        null,
    };
  }

  /**
   * ---------------------------------------------------------
   * /member-test <studentId>
   * ---------------------------------------------------------
   *
   * 개발자 테스트 전용.
   *
   * 실제 학생의 KakaoUserId 영구 바인딩을
   * 변경하지 않고 임시 테스트 세션에만 사용한다.
   *
   * 실제 허용된 KakaoUserId 여부는
   * 별도의 서버 Action에서 반드시 다시 검사한다.
   */
  const memberTestMatch =
    text.match(
      /^\/member-test(?:\s+(.+))?$/i
    );

  if (
    memberTestMatch
  ) {
    const rawStudentId =
      normalizeCommandText(
        memberTestMatch[1]
      );

    const studentId =
      normalizePositiveInteger(
        rawStudentId
      );

    if (
      !studentId
    ) {
      return {
        handled:
          true,

        command:
          "member_test",

        rawCommand:
          text,

        memberTestStudentId:
          null,

        errorCode:
          "INVALID_MEMBER_TEST_STUDENT_ID",

        errorMessage:
          "테스트할 학생 ID를 함께 입력해주세요. 예: /member-test 123",
      };
    }

    return {
      handled:
        true,

      command:
        "member_test",

      rawCommand:
        text,

      memberTestStudentId:
        studentId,

      errorCode:
        null,

      errorMessage:
        null,
    };
  }

  /**
   * ---------------------------------------------------------
   * /lead
   * ---------------------------------------------------------
   *
   * 개발자 테스트 전용.
   *
   * 현재 카카오 테스트 세션을
   * 신규 상담 고객 모드로 전환한다.
   *
   * 실제 사용 권한 검사는
   * Developer Gate에서 수행한다.
   */
  if (
    /^\/lead$/i.test(
      text
    )
  ) {
    return {
      handled:
        true,

      command:
        "developer_lead",

      rawCommand:
        text,

      memberTestStudentId:
        null,

      errorCode:
        null,

      errorMessage:
        null,
    };
  }

  /**
   * ---------------------------------------------------------
   * /staff-test
   * ---------------------------------------------------------
   *
   * 개발자 테스트 전용 담당자 AI 진입.
   *
   * 이 명령 자체가 Staff/Host 권한을 부여하지 않는다.
   * 실제 CRM userId와 권한은 별도 서버 검증을 거친다.
   */
  if (
    /^\/staff-test$/i.test(
      text
    )
  ) {
    return {
      handled:
        true,

      command:
        "developer_staff",

      rawCommand:
        text,

      memberTestStudentId:
        null,

      errorCode:
        null,

      errorMessage:
        null,
    };
  }

  /**
   * ---------------------------------------------------------
   * /test-reset
   * ---------------------------------------------------------
   *
   * 개발자 테스트 모드만 종료한다.
   *
   * 일반 등록회원의 영구 카카오 바인딩이나
   * 실제 CRM 데이터는 건드리지 않는다.
   */
  if (
    /^\/test-reset$/i.test(
      text
    )
  ) {
    return {
      handled:
        true,

      command:
        "developer_reset",

      rawCommand:
        text,

      memberTestStudentId:
        null,

      errorCode:
        null,

      errorMessage:
        null,
    };
  }

  /**
   * ---------------------------------------------------------
   * /reset
   * ---------------------------------------------------------
   *
   * 향후 대화 주제 / 작업 세션 초기화용.
   *
   * 중요:
   * 등록회원 KakaoUserId ↔ studentId 영구 바인딩이나
   * 담당자 계정 연결 자체를 해제하는 명령어가 아니다.
   */
  if (
    /^\/reset$/i.test(
      text
    ) ||
    /^\/초기화$/i.test(
      text
    )
  ) {
    return {
      handled:
        true,

      command:
        "reset",

      rawCommand:
        text,

      memberTestStudentId:
        null,

      errorCode:
        null,

      errorMessage:
        null,
    };
  }

  /**
   * 명령어가 아니라면
   * 기존 자연어 AI 흐름으로 넘긴다.
   *
   * 따라서:
   *
   * "사회복지사 기간 얼마나 걸려요?"
   * "저 기존 회원인데요"
   * "실습 문의드려요"
   *
   * 같은 기존 자연어 기능은 전혀 깨지지 않는다.
   */
  return {
    handled:
      false,

    command:
      null,

    rawCommand:
      null,

    memberTestStudentId:
      null,

    errorCode:
      null,

    errorMessage:
      null,
  };
}