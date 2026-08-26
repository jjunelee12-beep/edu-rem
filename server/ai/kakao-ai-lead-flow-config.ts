import type {
  KakaoAiLeadFlowCondition,
  KakaoAiLeadFlowConditionGroup,
  KakaoAiLeadFlowConditionOperator,
  KakaoAiLeadFlowConfig,
  KakaoAiLeadFlowPrimitive,
  KakaoAiLeadFlowStage,
  KakaoAiLeadFlowTransition,
} from "./kakao-ai-lead-flow-engine";

/**
 * Kakao AI Lead Flow Config Validator / Normalizer
 *
 * 역할:
 * - DB JSON은 신뢰하지 않는다.
 * - unknown 값을 KakaoAiLeadFlowConfig로 안전하게 정규화한다.
 * - 잘못된 단계 / 조건 / 전이 / 메타데이터를 제거한다.
 * - 중복 stage id를 제거한다.
 * - 존재하지 않는 transition 대상 stage를 제거한다.
 *
 * 중요:
 * - 특정 과정명 없음
 * - 특정 상담단계명 없음
 * - 특정 회사명 없음
 * - 특정 사용자 발화 없음
 *
 * 이 파일에서 허용하는 고정값은
 * Flow Engine 자체의 구조적 문법뿐이다.
 */

const MAX_STAGE_COUNT =
  100;

const MAX_TRANSITION_COUNT_PER_STAGE =
  100;

const MAX_CONDITION_COUNT_PER_GROUP =
  50;

const MAX_CONTENT_KEY_COUNT_PER_STAGE =
  50;

const MAX_ID_LENGTH =
  191;

const MAX_PATH_LENGTH =
  500;

const MAX_STRING_VALUE_LENGTH =
  4000;

const MAX_METADATA_KEY_COUNT =
  100;

const MAX_METADATA_DEPTH =
  6;

const CONDITION_OPERATORS:
  ReadonlySet<
    KakaoAiLeadFlowConditionOperator
  > =
  new Set<
    KakaoAiLeadFlowConditionOperator
  >([
    "exists",
    "not_exists",
    "truthy",
    "falsy",
    "equals",
    "not_equals",
    "in",
    "not_in",
  ]);

function isPlainObject(
  value:
    unknown
): value is
  Record<
    string,
    unknown
  > {
  return Boolean(
    value &&
    typeof value ===
      "object" &&
    !Array.isArray(
      value
    )
  );
}

function normalizeString(
  value:
    unknown,

  maxLength:
    number
): string {
  return String(
    value ??
    ""
  )
    .trim()
    .slice(
      0,
      maxLength
    );
}

function normalizeNullableString(
  value:
    unknown,

  maxLength:
    number
): string |
  null {
  const normalized =
    normalizeString(
      value,
      maxLength
    );

  return normalized ||
    null;
}

function normalizeBoolean(
  value:
    unknown,

  fallback:
    boolean
): boolean {
  return typeof value ===
    "boolean"
    ? value
    : fallback;
}

function normalizeFiniteNumber(
  value:
    unknown,

  fallback:
    number
): number {
  const numberValue =
    Number(
      value
    );

  return Number.isFinite(
    numberValue
  )
    ? numberValue
    : fallback;
}

function normalizeInteger(
  value:
    unknown,

  fallback:
    number
): number {
  const numberValue =
    Math.floor(
      normalizeFiniteNumber(
        value,
        fallback
      )
    );

  return Number.isFinite(
    numberValue
  )
    ? numberValue
    : fallback;
}

function normalizePrimitive(
  value:
    unknown
):
  KakaoAiLeadFlowPrimitive |
  null {
  if (
    value ===
      null
  ) {
    return null;
  }

  if (
    typeof value ===
      "boolean"
  ) {
    return value;
  }

  if (
    typeof value ===
      "number"
  ) {
    return Number.isFinite(
      value
    )
      ? value
      : null;
  }

  if (
    typeof value ===
      "string"
  ) {
    return value.slice(
      0,
      MAX_STRING_VALUE_LENGTH
    );
  }

  return null;
}

function normalizePrimitiveOrArray(
  value:
    unknown
):
  KakaoAiLeadFlowPrimitive |
  KakaoAiLeadFlowPrimitive[] |
  undefined {
  if (
    Array.isArray(
      value
    )
  ) {
    const normalized =
      value
        .slice(
          0,
          MAX_CONDITION_COUNT_PER_GROUP
        )
        .map(
          normalizePrimitive
        )
        .filter(
          (
            item
          ): item is
            KakaoAiLeadFlowPrimitive =>
            item !==
            undefined
        );

    return normalized;
  }

  if (
    value ===
      undefined
  ) {
    return undefined;
  }

  return normalizePrimitive(
    value
  );
}

function normalizeCondition(
  value:
    unknown
):
  KakaoAiLeadFlowCondition |
  null {
  if (
    !isPlainObject(
      value
    )
  ) {
    return null;
  }

  const path =
    normalizeString(
      value.path,
      MAX_PATH_LENGTH
    );

  if (
    !path
  ) {
    return null;
  }

  const operator =
    normalizeString(
      value.operator,
      50
    ) as
      KakaoAiLeadFlowConditionOperator;

  if (
    !CONDITION_OPERATORS.has(
      operator
    )
  ) {
    return null;
  }

  const normalized:
    KakaoAiLeadFlowCondition = {
      path,
      operator,
    };

  if (
    value.value !==
      undefined
  ) {
    normalized.value =
      normalizePrimitiveOrArray(
        value.value
      );
  }

  return normalized;
}

function normalizeConditionGroup(
  value:
    unknown
):
  KakaoAiLeadFlowConditionGroup |
  undefined {
  if (
    !isPlainObject(
      value
    )
  ) {
    return undefined;
  }

  const rawConditions =
    Array.isArray(
      value.conditions
    )
      ? value.conditions
      : [];

  const conditions =
    rawConditions
      .slice(
        0,
        MAX_CONDITION_COUNT_PER_GROUP
      )
      .map(
        normalizeCondition
      )
      .filter(
        (
          condition
        ): condition is
          KakaoAiLeadFlowCondition =>
          Boolean(
            condition
          )
      );

  if (
    conditions.length ===
      0
  ) {
    return undefined;
  }

  return {
    mode:
      value.mode ===
        "any"
        ? "any"
        : "all",

    conditions,
  };
}

function normalizeStringArray(
  value:
    unknown,

  maxItems:
    number,

  maxLength:
    number
): string[] {
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
        .slice(
          0,
          maxItems
        )
        .map(
          item =>
            normalizeString(
              item,
              maxLength
            )
        )
        .filter(
          Boolean
        )
    )
  );
}

function normalizeSemanticValue(
  value:
    unknown
):
  string |
  string[] |
  undefined {
  if (
    Array.isArray(
      value
    )
  ) {
    const normalized =
      normalizeStringArray(
        value,
        MAX_TRANSITION_COUNT_PER_STAGE,
        MAX_ID_LENGTH
      );

    return normalized.length >
      0
      ? normalized
      : undefined;
  }

  const normalized =
    normalizeNullableString(
      value,
      MAX_ID_LENGTH
    );

  return normalized ??
    undefined;
}

function normalizeTransition(
  value:
    unknown
):
  KakaoAiLeadFlowTransition |
  null {
  if (
    !isPlainObject(
      value
    )
  ) {
    return null;
  }

  const toStageId =
    normalizeString(
      value.toStageId,
      MAX_ID_LENGTH
    );

  if (
    !toStageId
  ) {
    return null;
  }

  const normalized:
    KakaoAiLeadFlowTransition = {
      toStageId,
    };

  const whenSemantic =
    normalizeSemanticValue(
      value.whenSemantic
    );

  if (
    whenSemantic !==
      undefined
  ) {
    normalized.whenSemantic =
      whenSemantic;
  }

const semanticDescription =
  value.semanticDescription ===
    null
    ? null
    : normalizeNullableString(
        value.semanticDescription,
        MAX_STRING_VALUE_LENGTH
      );

if (
  value.semanticDescription !==
    undefined
) {
  normalized.semanticDescription =
    semanticDescription;
}

  const when =
    normalizeConditionGroup(
      value.when
    );

  if (
    when
  ) {
    normalized.when =
      when;
  }

  const actionId =
    value.actionId ===
      null
      ? null
      : normalizeNullableString(
          value.actionId,
          MAX_ID_LENGTH
        );

  if (
    value.actionId !==
      undefined
  ) {
    normalized.actionId =
      actionId;
  }

  if (
    value.priority !==
      undefined
  ) {
    normalized.priority =
      normalizeInteger(
        value.priority,
        0
      );
  }

  return normalized;
}

function sanitizeMetadataValue(
  value:
    unknown,

  depth:
    number
): unknown {
  if (
    depth >
    MAX_METADATA_DEPTH
  ) {
    return null;
  }

  if (
    value ===
      null ||
    typeof value ===
      "boolean"
  ) {
    return value;
  }

  if (
    typeof value ===
      "number"
  ) {
    return Number.isFinite(
      value
    )
      ? value
      : null;
  }

  if (
    typeof value ===
      "string"
  ) {
    return value.slice(
      0,
      MAX_STRING_VALUE_LENGTH
    );
  }

  if (
    Array.isArray(
      value
    )
  ) {
    return value
      .slice(
        0,
        MAX_METADATA_KEY_COUNT
      )
      .map(
        item =>
          sanitizeMetadataValue(
            item,
            depth +
              1
          )
      );
  }

  if (
    isPlainObject(
      value
    )
  ) {
    const entries =
      Object.entries(
        value
      )
        .slice(
          0,
          MAX_METADATA_KEY_COUNT
        );

    const result:
      Record<
        string,
        unknown
      > = {};

    for (
      const [
        key,
        item,
      ] of
      entries
    ) {
      const normalizedKey =
        normalizeString(
          key,
          MAX_ID_LENGTH
        );

      if (
        !normalizedKey
      ) {
        continue;
      }

      result[
        normalizedKey
      ] =
        sanitizeMetadataValue(
          item,
          depth +
            1
        );
    }

    return result;
  }

  return null;
}

function normalizeMetadata(
  value:
    unknown
):
  Record<
    string,
    unknown
  > |
  undefined {
  if (
    !isPlainObject(
      value
    )
  ) {
    return undefined;
  }

  const normalized =
    sanitizeMetadataValue(
      value,
      0
    );

  return isPlainObject(
    normalized
  )
    ? normalized
    : undefined;
}

function normalizeStage(
  value:
    unknown
):
  KakaoAiLeadFlowStage |
  null {
  if (
    !isPlainObject(
      value
    )
  ) {
    return null;
  }

  const id =
    normalizeString(
      value.id,
      MAX_ID_LENGTH
    );

  if (
    !id
  ) {
    return null;
  }

  const normalized:
    KakaoAiLeadFlowStage = {
      id,

      enabled:
        normalizeBoolean(
          value.enabled,
          true
        ),

      order:
        normalizeFiniteNumber(
          value.order,
          0
        ),
  };

  const enterWhen =
    normalizeConditionGroup(
      value.enterWhen
    );

  if (
    enterWhen
  ) {
    normalized.enterWhen =
      enterWhen;
  }

  const completeWhen =
    normalizeConditionGroup(
      value.completeWhen
    );

  if (
    completeWhen
  ) {
    normalized.completeWhen =
      completeWhen;
  }

  if (
    value.defaultActionId !==
      undefined
  ) {
    normalized.defaultActionId =
      value.defaultActionId ===
        null
        ? null
        : normalizeNullableString(
            value.defaultActionId,
            MAX_ID_LENGTH
          );
  }

  if (
    Array.isArray(
      value.transitions
    )
  ) {
    const transitions =
      value.transitions
        .slice(
          0,
          MAX_TRANSITION_COUNT_PER_STAGE
        )
        .map(
          normalizeTransition
        )
        .filter(
          (
            transition
          ): transition is
            KakaoAiLeadFlowTransition =>
            Boolean(
              transition
            )
        );

    if (
      transitions.length >
      0
    ) {
      normalized.transitions =
        transitions;
    }
  }

  const contentKeys =
    normalizeStringArray(
      value.contentKeys,
      MAX_CONTENT_KEY_COUNT_PER_STAGE,
      MAX_ID_LENGTH
    );

  if (
    contentKeys.length >
      0
  ) {
    normalized.contentKeys =
      contentKeys;
  }

  const metadata =
    normalizeMetadata(
      value.metadata
    );

  if (
    metadata
  ) {
    normalized.metadata =
      metadata;
  }

  return normalized;
}

function removeDuplicateStages(
  stages:
    KakaoAiLeadFlowStage[]
): KakaoAiLeadFlowStage[] {
  const seen =
    new Set<
      string
    >();

  const result:
    KakaoAiLeadFlowStage[] =
    [];

  for (
    const stage of
    stages
  ) {
    if (
      seen.has(
        stage.id
      )
    ) {
      continue;
    }

    seen.add(
      stage.id
    );

    result.push(
      stage
    );
  }

  return result;
}

function removeInvalidTransitions(
  stages:
    KakaoAiLeadFlowStage[]
): KakaoAiLeadFlowStage[] {
  const stageIds =
    new Set(
      stages.map(
        stage =>
          stage.id
      )
    );

  return stages.map(
    stage => {
      if (
        !Array.isArray(
          stage.transitions
        )
      ) {
        return stage;
      }

      const transitions =
        stage.transitions.filter(
          transition =>
            stageIds.has(
              transition.toStageId
            )
        );

      return {
        ...stage,

        transitions:
          transitions.length >
          0
            ? transitions
            : undefined,
      };
    }
  );
}

function normalizeExistingStageId(
  value:
    unknown,

  stageIds:
    ReadonlySet<
      string
    >
): string |
  null {
  const normalized =
    normalizeNullableString(
      value,
      MAX_ID_LENGTH
    );

  if (
    !normalized
  ) {
    return null;
  }

  return stageIds.has(
    normalized
  )
    ? normalized
    : null;
}

/**
 * DB / API / UI에서 들어온 unknown 값을
 * 안전한 KakaoAiLeadFlowConfig로 변환한다.
 *
 * 반환 null:
 * - 값이 객체가 아님
 * - Flow가 꺼져 있고 최소 구조도 없음
 * - 유효한 stage가 하나도 없음
 *
 * 중요:
 * 이 함수는 예외를 던지지 않는 것을 기본 원칙으로 한다.
 * 잘못된 회사 설정 하나가 전체 카카오 AI 요청을
 * 중단시키지 않게 하기 위함이다.
 */
export function normalizeKakaoAiLeadFlowConfig(
  value:
    unknown
): KakaoAiLeadFlowConfig |
  null {
  if (
    !isPlainObject(
      value
    )
  ) {
    return null;
  }

  const rawStages =
    Array.isArray(
      value.stages
    )
      ? value.stages
      : [];

  let stages =
    rawStages
      .slice(
        0,
        MAX_STAGE_COUNT
      )
      .map(
        normalizeStage
      )
      .filter(
        (
          stage
        ): stage is
          KakaoAiLeadFlowStage =>
          Boolean(
            stage
          )
      );

  stages =
    removeDuplicateStages(
      stages
    );

  stages =
    removeInvalidTransitions(
      stages
    );

  if (
    stages.length ===
      0
  ) {
    return null;
  }

  stages.sort(
    (
      left,
      right
    ) =>
      left.order -
      right.order
  );

  const stageIds =
    new Set(
      stages.map(
        stage =>
          stage.id
      )
    );

  const config:
    KakaoAiLeadFlowConfig = {
      version:
        Math.max(
          normalizeInteger(
            value.version,
            1
          ),
          1
        ),

      enabled:
        normalizeBoolean(
          value.enabled,
          false
        ),

      startStageId:
        normalizeExistingStageId(
          value.startStageId,
          stageIds
        ),

      completedStageId:
        normalizeExistingStageId(
          value.completedStageId,
          stageIds
        ),

      stages,
  };

  const metadata =
    normalizeMetadata(
      value.metadata
    );

  if (
    metadata
  ) {
    config.metadata =
      metadata;
  }

  return config;
}

/**
 * 정상화 결과와 함께 진단정보가 필요한
 * 설정화면 / 관리자용 함수.
 *
 * 실제 AI 실행에서는
 * normalizeKakaoAiLeadFlowConfig()만 사용해도 된다.
 */
export function inspectKakaoAiLeadFlowConfig(
  value:
    unknown
): {
  valid:
    boolean;

  config:
    KakaoAiLeadFlowConfig |
    null;

  issues:
    string[];
} {
  const issues:
    string[] =
    [];

  if (
    !isPlainObject(
      value
    )
  ) {
    return {
      valid:
        false,

      config:
        null,

      issues: [
        "FLOW_CONFIG_NOT_OBJECT",
      ],
    };
  }

  if (
    !Array.isArray(
      value.stages
    )
  ) {
    issues.push(
      "STAGES_NOT_ARRAY"
    );
  }

  const rawStages =
    Array.isArray(
      value.stages
    )
      ? value.stages
      : [];

  const rawIds =
    rawStages
      .map(
        stage =>
          isPlainObject(
            stage
          )
            ? normalizeString(
                stage.id,
                MAX_ID_LENGTH
              )
            : ""
      )
      .filter(
        Boolean
      );

  if (
    new Set(
      rawIds
    ).size !==
    rawIds.length
  ) {
    issues.push(
      "DUPLICATE_STAGE_ID"
    );
  }

  const config =
    normalizeKakaoAiLeadFlowConfig(
      value
    );

  if (
    !config
  ) {
    issues.push(
      "NO_VALID_STAGE"
    );

    return {
      valid:
        false,

      config:
        null,

      issues:
        Array.from(
          new Set(
            issues
          )
        ),
    };
  }

  const validStageIds =
    new Set(
      config.stages.map(
        stage =>
          stage.id
      )
    );

  for (
    const rawStage of
    rawStages
  ) {
    if (
      !isPlainObject(
        rawStage
      )
    ) {
      issues.push(
        "INVALID_STAGE"
      );

      continue;
    }

    const stageId =
      normalizeString(
        rawStage.id,
        MAX_ID_LENGTH
      );

    if (
      !stageId
    ) {
      issues.push(
        "STAGE_ID_REQUIRED"
      );
    }

    if (
      Array.isArray(
        rawStage.transitions
      )
    ) {
      for (
        const rawTransition of
        rawStage.transitions
      ) {
        if (
          !isPlainObject(
            rawTransition
          )
        ) {
          issues.push(
            "INVALID_TRANSITION"
          );

          continue;
        }

        const toStageId =
          normalizeString(
            rawTransition.toStageId,
            MAX_ID_LENGTH
          );

        if (
          toStageId &&
          !validStageIds.has(
            toStageId
          )
        ) {
          issues.push(
            "TRANSITION_TARGET_NOT_FOUND"
          );
        }
      }
    }
  }

  return {
    valid:
      issues.length ===
      0,

    config,

    issues:
      Array.from(
        new Set(
          issues
        )
      ),
  };
}
