import {
  runAiAssistant,
  type RunAiAssistantOutput,
} from "./ai-runner";

import {
  resolveKakaoAiStaffAssistantContext,
  type KakaoAiStaffAssistantContextResult,
} from "./kakao-ai-staff-assistant-context";

export type KakaoAiStaffAssistantRunnerResult = {
  handled:
    boolean;

  staffContext:
    KakaoAiStaffAssistantContextResult |
    null;

  result:
    RunAiAssistantOutput |
    null;
};

/**
 * 카카오 담당자 인증 Session을
 * 기존 EduCanvas CRM 업무비서 Runner에 연결한다.
 *
 * 중요:
 *
 * 이 함수는 아직
 *
 * - Pending Action 실제 생성
 * - Pending Action 승인
 * - Pending Action 취소
 * - WorkSessionPatch 반영
 * - AI Chat DB 저장
 *
 * 을 하지 않는다.
 *
 * 위 후처리는 기존 웹 CRM과 완전히 동일한
 * 공통 Turn Service로 다음 단계에서 분리한다.
 *
 * 따라서 현재 단계에서는 Orchestrator에서
 * 이 함수를 직접 호출하지 않는다.
 */
export async function runKakaoAiStaffAssistant(
  params: {
    organizationId:
      number;

    conversationId:
      number;

    message:
      string;
  }
): Promise<KakaoAiStaffAssistantRunnerResult> {
  const message =
    String(
      params.message ||
      ""
    ).trim();

  if (
    !message
  ) {
    return {
      handled:
        false,

      staffContext:
        null,

      result:
        null,
    };
  }

  /**
   * ---------------------------------------------------------
   * 1. 카카오 Staff Session
   * → 기존 CRM 업무비서 Context 변환
   * ---------------------------------------------------------
   */
  const staffContext =
    await resolveKakaoAiStaffAssistantContext({
      organizationId:
        params.organizationId,

      conversationId:
        params.conversationId,
    });

  /**
   * 담당자 인증 Session이 없다면
   * 기존 신규자 / 등록회원 카카오 AI가
   * 계속 처리해야 한다.
   */
  if (
    !staffContext
  ) {
    return {
      handled:
        false,

      staffContext:
        null,

      result:
        null,
    };
  }

  /**
   * ---------------------------------------------------------
   * 2. 기존 CRM 업무비서 Runner 실행
   * ---------------------------------------------------------
   *
   * 웹 CRM에서 사용하는 것과 동일하게:
   *
   * - AiUserContext
   * - AiWorkSession
   * - selectedStudentId
   * - selectedStudentName
   * - conversationHistory
   *
   * 를 그대로 전달한다.
   */
  const result =
    await runAiAssistant({
      context:
        staffContext.aiContext,

      message,

      imageAttachment:
        null,

      recentDocument:
        null,

      workSession:
        staffContext.workSession,

      selectedStudentId:
        staffContext
          .selectedStudentId,

      selectedStudentName:
        staffContext
          .selectedStudentName,

      conversationHistory:
        staffContext
          .conversationHistory,
    });

  return {
    handled:
      true,

    staffContext,

    result,
  };
}