import * as db from "../db";

import type {
  KakaoAiCapability,
} from "./kakao-ai-access-policy";

import type {
  KakaoAiStructuredMemory,
} from "./kakao-ai-memory-resolver";

import type {
  KakaoAiStaffContext,
} from "./kakao-ai-context-resolver";

/**
 * 담당자 Action 결과.
 *
 * 여기서 실제:
 * - 목록 조회
 * - 추천 실행
 * - 선택
 * - 변경
 * - 현재 선택 확인
 *
 * 을 수행한다.
 *
 * 최종 자연어 답변 생성은
 * Response Composer가 담당한다.
 */
export type KakaoAiStaffActionType =
  | "none"
  | "list"
  | "recommend"
  | "select"
  | "change"
  | "current";

export type KakaoAiStaffActionResult = {
  handled:
    boolean;

  action:
    KakaoAiStaffActionType;

  success:
    boolean;

  /**
   * Composer가 사용자에게 설명할 때
   * 사용할 내부 상태코드.
   */
  reason:
    string | null;

  /**
   * 추천된 담당자.
   */
  recommendedStaff:
    any | null;

  /**
   * 실제 선택/변경된 담당자.
   */
  selectedStaff:
    any | null;

  /**
   * 사용자에게 보여줄 담당자 목록.
   */
  candidates:
    any[];

  /**
   * Action 수행 이후의
   * 담당자 선택 상태.
   */
  selectionState:
    Awaited<
      ReturnType<
        typeof db.getKakaoStaffSelectionState
      >
    > |
    null;

  /**
   * 사용자가 추가로 대상을 특정해야 하는지.
   */
  needsClarification:
    boolean;

  clarificationQuestion:
    string | null;

  clarificationOptions:
    string[];
};

function normalizePositiveInteger(
  value:
    unknown
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

/**
 * 이름 비교용.
 *
 * "이재준 팀장님"
 * "이재준팀장"
 * 같은 표현에서도 이름 매칭을
 * 조금 더 안정적으로 하기 위해
 * 공백과 일부 호칭을 제거한다.
 */
function normalizeStaffSearchText(
  value:
    unknown
): string {
  return normalizeText(
    value
  )
    .toLowerCase()
    .replace(
      /\s+/g,
      ""
    )
    .replace(
      /(담당자님|담당자|선생님|쌤|팀장님|팀장|실장님|실장|과장님|과장|부장님|부장|매니저님|매니저|님)/g,
      ""
    );
}

/**
 * "첫 번째", "2번", "두번째" 같은
 * 담당자 순번 표현을 1-based index로 변환한다.
 */
function extractCandidateIndex(
  message:
    string
): number | null {
  const normalized =
    normalizeText(
      message
    )
      .toLowerCase()
      .replace(
        /\s+/g,
        ""
      );

  /**
   * 숫자 표현.
   *
   * 2번
   * 2번째
   * 2번분
   */
  const numericMatch =
    normalized.match(
      /(?:^|[^0-9])([1-9][0-9]?)(?:번|번째|째)/
    );

  if (
    numericMatch
  ) {
    const parsed =
      normalizePositiveInteger(
        numericMatch[1]
      );

    if (parsed) {
      return parsed;
    }
  }

  const koreanIndexes:
    Array<{
      patterns:
        string[];

      index:
        number;
    }> = [
      {
        patterns: [
          "첫번째",
          "첫째",
          "첫분",
          "첫번째분",
          "첫번째사람",
        ],
        index:
          1,
      },

      {
        patterns: [
          "두번째",
          "둘째",
          "두번째분",
          "두번째사람",
        ],
        index:
          2,
      },

      {
        patterns: [
          "세번째",
          "셋째",
          "세번째분",
          "세번째사람",
        ],
        index:
          3,
      },

      {
        patterns: [
          "네번째",
          "넷째",
          "네번째분",
          "네번째사람",
        ],
        index:
          4,
      },

      {
        patterns: [
          "다섯번째",
          "다섯째",
          "다섯번째분",
          "다섯번째사람",
        ],
        index:
          5,
      },
    ];

  for (
    const item of
    koreanIndexes
  ) {
    if (
      item.patterns.some(
        pattern =>
          normalized.includes(
            pattern
          )
      )
    ) {
      return item.index;
    }
  }

  /**
   * "마지막 분"은 별도 처리하기 위해
   * -1을 반환한다.
   */
  if (
    normalized.includes(
      "마지막"
    )
  ) {
    return -1;
  }

  return null;
}

/**
 * 추천한 담당자를 가리키는
 * 자연어 표현인지 확인.
 */
function refersToRecommendedStaff(
  message:
    string
): boolean {
  const normalized =
    normalizeText(
      message
    )
      .toLowerCase()
      .replace(
        /\s+/g,
        ""
      );

  return (
    normalized.includes(
      "추천한분"
    ) ||
    normalized.includes(
      "추천해준분"
    ) ||
    normalized.includes(
      "추천해주신분"
    ) ||
    normalized.includes(
      "추천한사람"
    ) ||
    normalized.includes(
      "추천해준사람"
    ) ||
    normalized.includes(
      "이분"
    ) ||
    normalized.includes(
      "그분"
    )
  );
}

/**
 * 현재 후보 목록에서
 * 사용자 메시지와 이름이 일치하는 담당자를 찾는다.
 *
 * userId를 AI가 임의 생성하지 않는다.
 */
function findNamedCandidates(
  params: {
    message:
      string;

    candidates:
      db.KakaoAiStaffCandidateMemory[];
  }
): db.KakaoAiStaffCandidateMemory[] {
  const messageText =
    normalizeStaffSearchText(
      params.message
    );

  if (
    !messageText
  ) {
    return [];
  }

  return params.candidates.filter(
    candidate => {
      const displayName =
        normalizeStaffSearchText(
          candidate.displayName
        );

      if (
        !displayName
      ) {
        return false;
      }

      return (
        messageText.includes(
          displayName
        ) ||
        displayName.includes(
          messageText
        )
      );
    }
  );
}

/**
 * 담당자 선택/변경 요청에서
 * 실제 대상을 안전하게 결정한다.
 *
 * 우선순위:
 *
 * 1. 명시적인 순번
 * 2. 담당자 이름
 * 3. "추천한 분 / 이분 / 그분"
 *
 * 애매하면 절대로 임의 선택하지 않는다.
 */
async function executeStaffSelection(
  params: {
    organizationId:
      number;

    conversationId:
      number;

    message:
      string;

    memory:
      KakaoAiStructuredMemory;

    staffContext:
      KakaoAiStaffContext | null;

    intent:
      "staff_select" |
      "staff_change";
  }
): Promise<KakaoAiStaffActionResult> {
  const candidates =
    Array.isArray(
      params.memory
        .lastStaffCandidates
    ) &&
    params.memory
      .lastStaffCandidates
      .length >
      0
      ? params.memory
          .lastStaffCandidates
      : (
          params.staffContext
            ?.candidates ||
          []
        );

  /**
   * 1. 순번 선택.
   */
  const extractedIndex =
    extractCandidateIndex(
      params.message
    );

  if (
    extractedIndex !==
    null
  ) {
    const candidateIndex =
      extractedIndex ===
        -1
        ? candidates.length
        : extractedIndex;

    if (
      candidateIndex <=
        0 ||
      candidateIndex >
        candidates.length
    ) {
      return {
        handled:
          true,

        action:
          params.intent ===
            "staff_change"
            ? "change"
            : "select",

        success:
          false,

        reason:
          "CANDIDATE_INDEX_NOT_FOUND",

        recommendedStaff:
          null,

        selectedStaff:
          null,

        candidates,

        selectionState:
          null,

        needsClarification:
          true,

        clarificationQuestion:
          "말씀하신 순번의 담당자를 찾지 못했어요. 원하시는 담당자를 다시 말씀해주시겠어요?",

        clarificationOptions:
          candidates
            .map(
              candidate =>
                normalizeText(
                  candidate
                    .displayName
                )
            )
            .filter(
              Boolean
            )
            .slice(
              0,
              5
            ),
      };
    }

    const selected =
      await db.selectStaffCandidateForKakaoConversation({
        organizationId:
          params.organizationId,

        conversationId:
          params.conversationId,

        candidateIndex,
      });

    const selectionState =
      await db.getKakaoStaffSelectionState({
        organizationId:
          params.organizationId,

        conversationId:
          params.conversationId,
      });

    return {
      handled:
        true,

      action:
        params.intent ===
          "staff_change"
          ? "change"
          : "select",

      success:
        selected.success ===
        true,

      reason:
        selected.success
          ? null
          : String(
              selected.reason ||
              "STAFF_SELECTION_FAILED"
            ),

      recommendedStaff:
        selectionState
          .recommendedStaff,

      selectedStaff:
        selected.selected,

      candidates,

      selectionState,

      needsClarification:
        false,

      clarificationQuestion:
        null,

      clarificationOptions:
        [],
    };
  }

  /**
   * 2. 이름 직접 선택.
   */
  const namedCandidates =
    findNamedCandidates({
      message:
        params.message,

      candidates,
    });

  if (
    namedCandidates.length ===
    1
  ) {
    const candidate =
      namedCandidates[0];

    const selected =
      await db.selectStaffForKakaoConversation({
        organizationId:
          params.organizationId,

        conversationId:
          params.conversationId,

        userId:
          candidate.userId,

        intent:
          params.intent,
      });

    const selectionState =
      await db.getKakaoStaffSelectionState({
        organizationId:
          params.organizationId,

        conversationId:
          params.conversationId,
      });

    return {
      handled:
        true,

      action:
        params.intent ===
          "staff_change"
          ? "change"
          : "select",

      success:
        selected.success ===
        true,

      reason:
        selected.success
          ? null
          : String(
              selected.reason ||
              "STAFF_SELECTION_FAILED"
            ),

      recommendedStaff:
        selectionState
          .recommendedStaff,

      selectedStaff:
        selected.selected,

      candidates,

      selectionState,

      needsClarification:
        false,

      clarificationQuestion:
        null,

      clarificationOptions:
        [],
    };
  }

  /**
   * 같은 이름/표현으로 여러 후보가 걸린 경우.
   */
  if (
    namedCandidates.length >
    1
  ) {
    return {
      handled:
        true,

      action:
        params.intent ===
          "staff_change"
          ? "change"
          : "select",

      success:
        false,

      reason:
        "MULTIPLE_STAFF_CANDIDATES",

      recommendedStaff:
        null,

      selectedStaff:
        null,

      candidates:
        namedCandidates,

      selectionState:
        null,

      needsClarification:
        true,

      clarificationQuestion:
        "같은 조건에 해당하는 담당자가 여러 분이에요. 어느 담당자로 진행할까요?",

      clarificationOptions:
        namedCandidates
          .map(
            candidate => {
              const name =
                normalizeText(
                  candidate.displayName
                );

              const position =
                normalizeText(
                  candidate
                    .publicPositionName
                );

              return [
                name,
                position,
              ]
                .filter(
                  Boolean
                )
                .join(
                  " "
                );
            }
          )
          .filter(
            Boolean
          )
          .slice(
            0,
            5
          ),
    };
  }

  /**
   * 3. "추천한 분 / 이분 / 그분".
   */
  if (
    refersToRecommendedStaff(
      params.message
    ) &&
    params.memory
      .recommendedStaffUserId
  ) {
    const selected =
      await db.selectRecommendedStaffForKakaoConversation({
        organizationId:
          params.organizationId,

        conversationId:
          params.conversationId,
      });

    const selectionState =
      await db.getKakaoStaffSelectionState({
        organizationId:
          params.organizationId,

        conversationId:
          params.conversationId,
      });

    return {
      handled:
        true,

      action:
        params.intent ===
          "staff_change"
          ? "change"
          : "select",

      success:
        selected.success ===
        true,

      reason:
        selected.success
          ? null
          : String(
              selected.reason ||
              "STAFF_SELECTION_FAILED"
            ),

      recommendedStaff:
        selectionState
          .recommendedStaff,

      selectedStaff:
        selected.selected,

      candidates,

      selectionState,

      needsClarification:
        false,

      clarificationQuestion:
        null,

      clarificationOptions:
        [],
    };
  }

  /**
   * 어떤 담당자인지 특정할 근거가 없다.
   */
  return {
    handled:
      true,

    action:
      params.intent ===
        "staff_change"
        ? "change"
        : "select",

    success:
      false,

    reason:
      "STAFF_SELECTION_TARGET_REQUIRED",

    recommendedStaff:
      params.staffContext
        ?.recommendedStaff ||
      null,

    selectedStaff:
      params.staffContext
        ?.selectedStaff ||
      null,

    candidates,

    selectionState:
      null,

    needsClarification:
      true,

    clarificationQuestion:
      params.intent ===
        "staff_change"
        ? "어느 담당자로 변경해드릴까요?"
        : "어느 담당자로 진행해드릴까요?",

    clarificationOptions:
      candidates
        .map(
          candidate => {
            const name =
              normalizeText(
                candidate.displayName
              );

            const position =
              normalizeText(
                candidate
                  .publicPositionName
              );

            return [
              name,
              position,
            ]
              .filter(
                Boolean
              )
              .join(
                " "
              );
          }
        )
        .filter(
          Boolean
        )
        .slice(
          0,
          5
        ),
  };
}

/**
 * 카카오 담당자 Action 중앙 실행기.
 *
 * 중요:
 *
 * 이 함수는 Intent를 새로 판단하지 않는다.
 *
 * 이미:
 *
 * Intent Classifier
 * → Access Policy
 * → Context Resolver
 *
 * 를 통과한 capability만 실행한다.
 */
export async function executeKakaoAiStaffAction(
  params: {
    organizationId:
      number;

    conversationId:
      number;

    message:
      string;

    primaryCapability:
      KakaoAiCapability;

    allowedCapabilities:
      KakaoAiCapability[];

    memory:
      KakaoAiStructuredMemory;

    staffContext:
      KakaoAiStaffContext | null;
  }
): Promise<KakaoAiStaffActionResult> {
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
    throw new Error(
      "카카오 AI 담당자 Action 실행정보가 올바르지 않습니다."
    );
  }

  const allowedCapabilities =
    Array.isArray(
      params.allowedCapabilities
    )
      ? params.allowedCapabilities
      : [];

  /**
   * 담당자 capability가 Access Policy를
   * 통과하지 않았다면 아무것도 실행하지 않는다.
   */
  const staffCapabilities:
    KakaoAiCapability[] =
    [
      "staff_list",
      "staff_recommend",
      "staff_select",
      "staff_change",
      "staff_current",
    ];

  const allowedStaffCapabilities =
    staffCapabilities.filter(
      capability =>
        allowedCapabilities.includes(
          capability
        )
    );

  if (
    allowedStaffCapabilities
      .length ===
    0
  ) {
    return {
      handled:
        false,

      action:
        "none",

      success:
        true,

      reason:
        null,

      recommendedStaff:
        null,

      selectedStaff:
        null,

      candidates:
        [],

      selectionState:
        null,

      needsClarification:
        false,

      clarificationQuestion:
        null,

      clarificationOptions:
        [],
    };
  }

  /**
   * 여러 capability가 한 메시지에 같이 들어온 경우
   * primaryCapability를 우선하되,
   * primary가 담당자 기능이 아니면
   * 허용된 담당자 capability 중 첫 번째를 사용한다.
   */
  const capability =
    staffCapabilities.includes(
      params.primaryCapability
    )
      ? params.primaryCapability
      : allowedStaffCapabilities[0];

  /**
   * 담당자 목록.
   */
  if (
    capability ===
    "staff_list"
  ) {
    const candidates =
      await db.listStaffForKakaoConversation({
        organizationId,

        conversationId,
      });

    const selectionState =
      await db.getKakaoStaffSelectionState({
        organizationId,

        conversationId,
      });

    return {
      handled:
        true,

      action:
        "list",

      success:
        true,

      reason:
        candidates.length >
        0
          ? null
          : "NO_AVAILABLE_STAFF",

      recommendedStaff:
        selectionState
          .recommendedStaff,

      selectedStaff:
        selectionState
          .selectedStaff,

      candidates,

      selectionState,

      needsClarification:
        false,

      clarificationQuestion:
        null,

      clarificationOptions:
        [],
    };
  }

  /**
   * 담당자 추천.
   *
   * 여기서 실제 추천 횟수 반영 +
   * Conversation Memory 기록까지 수행된다.
   */
  if (
    capability ===
    "staff_recommend"
  ) {
    const recommendation =
      await db.recommendStaffForKakaoConversation({
        organizationId,

        conversationId,

        desiredCourse:
          params.memory
            .desiredCourse,

        consultationText:
          params.message,
      });

    const selectionState =
      await db.getKakaoStaffSelectionState({
        organizationId,

        conversationId,
      });

    return {
      handled:
        true,

      action:
        "recommend",

      success:
        recommendation.success ===
        true,

      reason:
        recommendation.success
          ? null
          : String(
              recommendation.reason ||
              "STAFF_RECOMMENDATION_FAILED"
            ),

      recommendedStaff:
        recommendation.success
          ? recommendation
              .recommended
          : null,

      selectedStaff:
        selectionState
          .selectedStaff,

      candidates:
        recommendation.success &&
        Array.isArray(
          recommendation
            .candidates
        )
          ? recommendation
              .candidates
          : [],

      selectionState,

      needsClarification:
        false,

      clarificationQuestion:
        null,

      clarificationOptions:
        [],
    };
  }

  /**
   * 담당자 선택.
   */
  if (
    capability ===
    "staff_select"
  ) {
    return await executeStaffSelection({
      organizationId,

      conversationId,

      message:
        params.message,

      memory:
        params.memory,

      staffContext:
        params.staffContext,

      intent:
        "staff_select",
    });
  }

  /**
   * 담당자 변경.
   */
  if (
    capability ===
    "staff_change"
  ) {
    return await executeStaffSelection({
      organizationId,

      conversationId,

      message:
        params.message,

      memory:
        params.memory,

      staffContext:
        params.staffContext,

      intent:
        "staff_change",
    });
  }

  /**
   * 현재 선택된 담당자 확인.
   */
  if (
    capability ===
    "staff_current"
  ) {
    const selectionState =
      await db.getKakaoStaffSelectionState({
        organizationId,

        conversationId,
      });

    return {
      handled:
        true,

      action:
        "current",

      success:
        true,

      reason:
        selectionState
          .selectedStaff
          ? null
          : "NO_SELECTED_STAFF",

      recommendedStaff:
        selectionState
          .recommendedStaff,

      selectedStaff:
        selectionState
          .selectedStaff,

      candidates:
        selectionState
          .candidates,

      selectionState,

      needsClarification:
        false,

      clarificationQuestion:
        null,

      clarificationOptions:
        [],
    };
  }

  return {
    handled:
      false,

    action:
      "none",

    success:
      true,

    reason:
      null,

    recommendedStaff:
      null,

    selectedStaff:
      null,

    candidates:
      [],

    selectionState:
      null,

    needsClarification:
      false,

    clarificationQuestion:
      null,

    clarificationOptions:
      [],
  };
}