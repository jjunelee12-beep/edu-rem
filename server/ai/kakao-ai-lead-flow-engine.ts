/**
 * Kakao AI Lead Flow Engine
 *
 * 목적:
 * - 신규상담 흐름을 코드에 하드코딩하지 않는다.
 * - 단계명 / 순서 / 완료조건 / 다음 행동 / 사용자 반응 분기는
 *   전부 외부 Flow Config에서 받는다.
 * - 이 엔진은 CRM / DB / OpenAI / 회사명 / 과정명을 알지 못한다.
 *
 * 중요:
 * - "이론", "실습", "행정", "담당자" 같은 업무 단계명 없음
 * - "네", "ㅇㅇ", "ㄱㄱ" 같은 사용자 발화 하드코딩 없음
 * - 회사별 정책 문구 없음
 *
 * 외부에서 필요한 것:
 * 1. flowConfig
 * 2. 현재 facts/memory
 * 3. 현재 stageId
 * 4. 분류된 semanticDecision (선택)
 */

export type KakaoAiLeadFlowPrimitive =
  | string
  | number
  | boolean
  | null;

export type KakaoAiLeadFlowConditionOperator =
  | "exists"
  | "not_exists"
  | "truthy"
  | "falsy"
  | "equals"
  | "not_equals"
  | "in"
  | "not_in";

export type KakaoAiLeadFlowCondition = {
  path:
    string;

  operator:
    KakaoAiLeadFlowConditionOperator;

  value?:
    KakaoAiLeadFlowPrimitive |
    KakaoAiLeadFlowPrimitive[];
};

export type KakaoAiLeadFlowConditionGroup = {
  mode?:
    "all" |
    "any";

  conditions:
    KakaoAiLeadFlowCondition[];
};

export type KakaoAiLeadFlowTransition = {
  /**
   * Intent / semantic classifier가 반환한 의미 ID.
   *
   * 예:
   * 회사 설정이 어떤 값을 쓰든 엔진은 모른다.
   */
  whenSemantic?:
    string |
    string[];

  /**
   * 현재 facts 조건.
   */
  when?:
    KakaoAiLeadFlowConditionGroup;

  /**
   * 이동할 단계.
   */
  toStageId:
    string;

  /**
   * 다음 Composer / Action Router에 전달할
   * 범용 action id.
   */
  actionId?:
    string |
    null;

  priority?:
    number;
};

export type KakaoAiLeadFlowStage = {
  id:
    string;

  enabled?:
    boolean;

  order:
    number;

  /**
   * 이 단계에 진입하기 위해 필요한 조건.
   * 없으면 항상 진입 가능.
   */
  enterWhen?:
    KakaoAiLeadFlowConditionGroup;

  /**
   * 단계 완료 조건.
   * 없으면 자동 완료로 판단하지 않는다.
   */
  completeWhen?:
    KakaoAiLeadFlowConditionGroup;

  /**
   * 해당 단계에서 기본으로 실행할 Action.
   * 실제 의미는 외부 Action Router가 해석한다.
   */
  defaultActionId?:
    string |
    null;

  /**
   * 사용자 반응 또는 facts에 따른 분기.
   */
  transitions?:
    KakaoAiLeadFlowTransition[];

  /**
   * Composer에 전달할 회사별 설정 키.
   * 실제 안내문은 엔진에 넣지 않는다.
   */
  contentKeys?:
    string[];

  /**
   * 자유 메타데이터.
   */
  metadata?:
    Record<
      string,
      unknown
    >;
};

export type KakaoAiLeadFlowConfig = {
  version:
    number;

  enabled:
    boolean;

  /**
   * 첫 단계 ID.
   * null이면 order가 가장 작은 활성 단계를 사용.
   */
  startStageId?:
    string |
    null;

  /**
   * 완료 후 단계.
   * 지정하지 않아도 됨.
   */
  completedStageId?:
    string |
    null;

  stages:
    KakaoAiLeadFlowStage[];

  metadata?:
    Record<
      string,
      unknown
    >;
};

export type KakaoAiLeadFlowEvaluationInput = {
  config:
    KakaoAiLeadFlowConfig;

  /**
   * Memory / 서버 사실 / Action 결과를 합친
   * 읽기 전용 객체.
   */
  facts:
    Record<
      string,
      unknown
    >;

  currentStageId?:
    string |
    null;

  /**
   * PreRouter / Intent Classifier / 별도 Semantic Classifier가
   * 반환한 의미 ID.
   *
   * 실제 사용자 원문을 엔진이 직접 해석하지 않는다.
   */
  semanticDecision?:
    string |
    null;
};

export type KakaoAiLeadFlowEvaluationResult = {
  enabled:
    boolean;

  configVersion:
    number;

  currentStage:
    KakaoAiLeadFlowStage |
    null;

  currentStageId:
    string |
    null;

  stageCompleted:
    boolean;

  nextStage:
    KakaoAiLeadFlowStage |
    null;

  nextStageId:
    string |
    null;

  actionId:
    string |
    null;

  contentKeys:
    string[];

  matchedTransition:
    KakaoAiLeadFlowTransition |
    null;

  reason:
    | "FLOW_DISABLED"
    | "NO_STAGES"
    | "CURRENT_STAGE"
    | "TRANSITION_MATCHED"
    | "STAGE_COMPLETED"
    | "STAGE_WAITING"
    | "FLOW_COMPLETED";
};

function normalizeId(
  value:
    unknown
): string {
  return String(
    value ??
    ""
  ).trim();
}

function normalizeOrder(
  value:
    unknown
): number {
  const numberValue =
    Number(
      value
    );

  return Number.isFinite(
    numberValue
  )
    ? numberValue
    : 0;
}

function getPathValue(
  source:
    unknown,

  path:
    string
): unknown {
  const normalizedPath =
    normalizeId(
      path
    );

  if (
    !normalizedPath
  ) {
    return undefined;
  }

  const parts =
    normalizedPath
      .split(".")
      .map(
        part =>
          part.trim()
      )
      .filter(
        Boolean
      );

  let current:
    unknown =
    source;

  for (
    const part of
    parts
  ) {
    if (
      !current ||
      typeof current !==
        "object" ||
      Array.isArray(
        current
      )
    ) {
      return undefined;
    }

    current =
      (
        current as
          Record<
            string,
            unknown
          >
      )[part];
  }

  return current;
}

function valuesEqual(
  left:
    unknown,

  right:
    unknown
): boolean {
  if (
    left ===
    right
  ) {
    return true;
  }

  if (
    left ===
      null ||
    left ===
      undefined ||
    right ===
      null ||
    right ===
      undefined
  ) {
    return false;
  }

  if (
    typeof left ===
      "number" ||
    typeof right ===
      "number"
  ) {
    const leftNumber =
      Number(
        left
      );

    const rightNumber =
      Number(
        right
      );

    if (
      Number.isFinite(
        leftNumber
      ) &&
      Number.isFinite(
        rightNumber
      )
    ) {
      return (
        leftNumber ===
        rightNumber
      );
    }
  }

  return (
    String(
      left
    ).trim() ===
    String(
      right
    ).trim()
  );
}

function evaluateCondition(
  condition:
    KakaoAiLeadFlowCondition,

  facts:
    Record<
      string,
      unknown
    >
): boolean {
  const actual =
    getPathValue(
      facts,
      condition.path
    );

  switch (
    condition.operator
  ) {
    case "exists":
      return (
        actual !==
          undefined &&
        actual !==
          null &&
        !(
          typeof actual ===
            "string" &&
          actual.trim() ===
            ""
        )
      );

    case "not_exists":
      return (
        actual ===
          undefined ||
        actual ===
          null ||
        (
          typeof actual ===
            "string" &&
          actual.trim() ===
            ""
        )
      );

    case "truthy":
      return Boolean(
        actual
      );

    case "falsy":
      return !Boolean(
        actual
      );

    case "equals":
      return valuesEqual(
        actual,
        condition.value
      );

    case "not_equals":
      return !valuesEqual(
        actual,
        condition.value
      );

    case "in": {
      const candidates =
        Array.isArray(
          condition.value
        )
          ? condition.value
          : [
              condition.value ??
              null,
            ];

      return candidates.some(
        value =>
          valuesEqual(
            actual,
            value
          )
      );
    }

    case "not_in": {
      const candidates =
        Array.isArray(
          condition.value
        )
          ? condition.value
          : [
              condition.value ??
              null,
            ];

      return !candidates.some(
        value =>
          valuesEqual(
            actual,
            value
          )
      );
    }

    default:
      return false;
  }
}

function evaluateConditionGroup(
  group:
    KakaoAiLeadFlowConditionGroup |
    null |
    undefined,

  facts:
    Record<
      string,
      unknown
    >
): boolean {
  if (
    !group
  ) {
    return true;
  }

  const conditions =
    Array.isArray(
      group.conditions
    )
      ? group.conditions
      : [];

  if (
    conditions.length ===
    0
  ) {
    return true;
  }

  if (
    group.mode ===
      "any"
  ) {
    return conditions.some(
      condition =>
        evaluateCondition(
          condition,
          facts
        )
    );
  }

  return conditions.every(
    condition =>
      evaluateCondition(
        condition,
        facts
      )
  );
}

function normalizeSemanticSet(
  value:
    string |
    string[] |
    undefined
): string[] {
  const values =
    Array.isArray(
      value
    )
      ? value
      : value
        ? [
            value,
          ]
        : [];

  return Array.from(
    new Set(
      values
        .map(
          normalizeId
        )
        .filter(
          Boolean
        )
    )
  );
}

function getActiveStages(
  config:
    KakaoAiLeadFlowConfig
): KakaoAiLeadFlowStage[] {
  return (
    Array.isArray(
      config.stages
    )
      ? config.stages
      : []
  )
    .filter(
      stage =>
        stage &&
        stage.enabled !==
          false &&
        Boolean(
          normalizeId(
            stage.id
          )
        )
    )
    .map(
      stage => ({
        ...stage,

        id:
          normalizeId(
            stage.id
          ),

        order:
          normalizeOrder(
            stage.order
          ),
      })
    )
    .sort(
      (
        left,
        right
      ) =>
        left.order -
        right.order
    );
}

function findStageById(
  stages:
    KakaoAiLeadFlowStage[],

  stageId:
    unknown
): KakaoAiLeadFlowStage |
  null {
  const normalized =
    normalizeId(
      stageId
    );

  if (
    !normalized
  ) {
    return null;
  }

  return (
    stages.find(
      stage =>
        stage.id ===
        normalized
    ) ||
    null
  );
}

function findFirstEnterableStage(
  stages:
    KakaoAiLeadFlowStage[],

  facts:
    Record<
      string,
      unknown
    >
): KakaoAiLeadFlowStage |
  null {
  return (
    stages.find(
      stage =>
        evaluateConditionGroup(
          stage.enterWhen,
          facts
        )
    ) ||
    null
  );
}

function findNextEnterableStage(
  stages:
    KakaoAiLeadFlowStage[],

  currentStage:
    KakaoAiLeadFlowStage,

  facts:
    Record<
      string,
      unknown
    >
): KakaoAiLeadFlowStage |
  null {
  const currentIndex =
    stages.findIndex(
      stage =>
        stage.id ===
        currentStage.id
    );

  if (
    currentIndex <
      0
  ) {
    return null;
  }

  for (
    let index =
      currentIndex + 1;

    index <
    stages.length;

    index +=
      1
  ) {
    const candidate =
      stages[index];

    if (
      evaluateConditionGroup(
        candidate.enterWhen,
        facts
      )
    ) {
      return candidate;
    }
  }

  return null;
}

function matchTransition(
  stage:
    KakaoAiLeadFlowStage,

  semanticDecision:
    string |
    null |
    undefined,

  facts:
    Record<
      string,
      unknown
    >
): KakaoAiLeadFlowTransition |
  null {
  const normalizedSemantic =
    normalizeId(
      semanticDecision
    );

  const transitions =
    (
      Array.isArray(
        stage.transitions
      )
        ? stage.transitions
        : []
    )
      .map(
        transition => ({
          ...transition,

          priority:
            normalizeOrder(
              transition.priority
            ),
        })
      )
      .sort(
        (
          left,
          right
        ) =>
          right.priority -
          left.priority
      );

  for (
    const transition of
    transitions
  ) {
    const semanticSet =
      normalizeSemanticSet(
        transition.whenSemantic
      );

    const semanticMatches =
      semanticSet.length ===
        0 ||
      (
        normalizedSemantic &&
        semanticSet.includes(
          normalizedSemantic
        )
      );

    if (
      !semanticMatches
    ) {
      continue;
    }

    if (
      !evaluateConditionGroup(
        transition.when,
        facts
      )
    ) {
      continue;
    }

    return transition;
  }

  return null;
}

export function evaluateKakaoAiLeadFlow(
  input:
    KakaoAiLeadFlowEvaluationInput
): KakaoAiLeadFlowEvaluationResult {
  const config =
    input.config;

  const configVersion =
    Number.isFinite(
      Number(
        config?.version
      )
    )
      ? Math.floor(
          Number(
            config.version
          )
        )
      : 0;

  if (
    !config ||
    config.enabled !==
      true
  ) {
    return {
      enabled:
        false,

      configVersion,

      currentStage:
        null,

      currentStageId:
        null,

      stageCompleted:
        false,

      nextStage:
        null,

      nextStageId:
        null,

      actionId:
        null,

      contentKeys:
        [],

      matchedTransition:
        null,

      reason:
        "FLOW_DISABLED",
    };
  }

  const stages =
    getActiveStages(
      config
    );

  if (
    stages.length ===
      0
  ) {
    return {
      enabled:
        true,

      configVersion,

      currentStage:
        null,

      currentStageId:
        null,

      stageCompleted:
        false,

      nextStage:
        null,

      nextStageId:
        null,

      actionId:
        null,

      contentKeys:
        [],

      matchedTransition:
        null,

      reason:
        "NO_STAGES",
    };
  }

  const facts =
    input.facts &&
    typeof input.facts ===
      "object" &&
    !Array.isArray(
      input.facts
    )
      ? input.facts
      : {};

  let currentStage =
    findStageById(
      stages,
      input.currentStageId
    );

  if (
    !currentStage
  ) {
    currentStage =
      findStageById(
        stages,
        config.startStageId
      );
  }

  if (
    !currentStage
  ) {
    currentStage =
      findFirstEnterableStage(
        stages,
        facts
      );
  }

  if (
    !currentStage
  ) {
    return {
      enabled:
        true,

      configVersion,

      currentStage:
        null,

      currentStageId:
        null,

      stageCompleted:
        false,

      nextStage:
        null,

      nextStageId:
        null,

      actionId:
        null,

      contentKeys:
        [],

      matchedTransition:
        null,

      reason:
        "FLOW_COMPLETED",
    };
  }

  const matchedTransition =
    matchTransition(
      currentStage,
      input.semanticDecision,
      facts
    );

  if (
    matchedTransition
  ) {
    const transitionStage =
      findStageById(
        stages,
        matchedTransition
          .toStageId
      );

    return {
      enabled:
        true,

      configVersion,

      currentStage,

      currentStageId:
        currentStage.id,

      stageCompleted:
        evaluateConditionGroup(
          currentStage.completeWhen,
          facts
        ),

      nextStage:
        transitionStage,

      nextStageId:
  transitionStage?.id ??
  (
    normalizeId(
      matchedTransition
        .toStageId
    ) ||
    null
  ),

      actionId:
        normalizeId(
          matchedTransition
            .actionId
        ) ||
        transitionStage
          ?.defaultActionId ||
        null,

      contentKeys:
        transitionStage
          ?.contentKeys ??
        [],

      matchedTransition,

      reason:
        "TRANSITION_MATCHED",
    };
  }

  const stageCompleted =
    Boolean(
      currentStage.completeWhen
    ) &&
    evaluateConditionGroup(
      currentStage.completeWhen,
      facts
    );

  if (
    !stageCompleted
  ) {
    return {
      enabled:
        true,

      configVersion,

      currentStage,

      currentStageId:
        currentStage.id,

      stageCompleted:
        false,

      nextStage:
        currentStage,

      nextStageId:
        currentStage.id,

      actionId:
        normalizeId(
          currentStage
            .defaultActionId
        ) ||
        null,

      contentKeys:
        currentStage
          .contentKeys ??
        [],

      matchedTransition:
        null,

      reason:
        "STAGE_WAITING",
    };
  }

  const nextStage =
    findNextEnterableStage(
      stages,
      currentStage,
      facts
    );

  if (
    !nextStage
  ) {
    const completedStage =
      findStageById(
        stages,
        config.completedStageId
      );

    return {
      enabled:
        true,

      configVersion,

      currentStage,

      currentStageId:
        currentStage.id,

      stageCompleted:
        true,

      nextStage:
        completedStage,

      nextStageId:
        completedStage?.id ??
        null,

      actionId:
        normalizeId(
          completedStage
            ?.defaultActionId
        ) ||
        null,

      contentKeys:
        completedStage
          ?.contentKeys ??
        [],

      matchedTransition:
        null,

      reason:
        "FLOW_COMPLETED",
    };
  }

  return {
    enabled:
      true,

    configVersion,

    currentStage,

    currentStageId:
      currentStage.id,

    stageCompleted:
      true,

    nextStage,

    nextStageId:
      nextStage.id,

    actionId:
      normalizeId(
        nextStage
          .defaultActionId
      ) ||
      null,

    contentKeys:
      nextStage
        .contentKeys ??
      [],

    matchedTransition:
      null,

    reason:
      "STAGE_COMPLETED",
  };
}
