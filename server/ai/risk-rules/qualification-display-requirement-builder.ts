import type {
  QualificationRuleAnalysis,
} from "./qualification-risk-analyzer";

export type QualificationDisplayRequirement = {
  key: string;

  label: string;

  type:
    | "subjects"
    | "credits"
    | "hours"
    | "text";

  required:
    number | string | null;

  current:
    number | string | null;

  remaining:
    number | string | null;

  unit:
    | "과목"
    | "학점"
    | "시간"
    | null;

  status:
    | "completed"
    | "remaining"
    | "review_required";
};

function toNullableNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

function getRecord(
  value: unknown
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

  return value as Record<string, unknown>;
}

function resolveStatus(
  remaining: number | null
): QualificationDisplayRequirement["status"] {
  if (remaining === null) {
    return "review_required";
  }

  return remaining <= 0
    ? "completed"
    : "remaining";
}

function createNumericRequirement(
  params: {
    key: string;
    label: string;

    type:
      | "subjects"
      | "credits"
      | "hours";

    required: unknown;
    current: unknown;
    remaining: unknown;

    unit:
      | "과목"
      | "학점"
      | "시간";
  }
): QualificationDisplayRequirement | null {
  const required =
    toNullableNumber(params.required);

  const current =
    toNullableNumber(params.current);

  let remaining =
    toNullableNumber(params.remaining);

  if (
    remaining === null &&
    required !== null &&
    current !== null
  ) {
    remaining =
      Math.max(
        0,
        required - current
      );
  }

  if (
    required === null &&
    current === null &&
    remaining === null
  ) {
    return null;
  }

  return {
    key: params.key,
    label: params.label,
    type: params.type,
    required,
    current,
    remaining,
    unit: params.unit,
    status:
      resolveStatus(remaining),
  };
}

function pushRequirement(
  target:
    QualificationDisplayRequirement[],
  requirement:
    QualificationDisplayRequirement | null
) {
  if (requirement) {
    target.push(requirement);
  }
}

/**
 * 과정별 Analyzer가 계산한 결과를
 * UI / 업무비서 / 카카오 AI가 공통으로 사용할 수 있는
 * 표시용 구조로 변환한다.
 *
 * 중요:
 * 여기서는 법적 요건을 새로 계산하지 않는다.
 * qualification-risk-analyzer의 계산 결과만 정규화한다.
 */
export function buildQualificationDisplayRequirements(
  analysis:
    QualificationRuleAnalysis
): QualificationDisplayRequirement[] {
  const result:
    QualificationDisplayRequirement[] =
    [];

  const summary =
    getRecord(
      analysis.summary
    );

  /**
   * 사회복지사 2급
   */
  if (
    analysis.courseKey ===
    "social_worker_2"
  ) {
    pushRequirement(
      result,
      createNumericRequirement({
        key: "required_subjects",
        label: "필수과목",
        type: "subjects",

        required:
          summary.requiredSubjects,

        current:
          summary.completedRequiredSubjects,

        remaining:
          summary.remainingRequiredSubjects,

        unit: "과목",
      })
    );

    pushRequirement(
      result,
      createNumericRequirement({
        key: "elective_subjects",
        label: "선택과목",
        type: "subjects",

        required:
          summary.electiveSubjects,

        current:
          summary.completedElectiveSubjects,

        remaining:
          summary.remainingElectiveSubjects,

        unit: "과목",
      })
    );

    const practiceHours =
      toNullableNumber(
        summary.practiceHours
      );

    if (practiceHours !== null) {
      result.push({
        key: "practice",
        label: "현장실습",
        type: "hours",

        required:
          practiceHours,

        current:
          null,

        remaining:
          null,

        unit: "시간",

        status:
          "review_required",
      });
    }

    return result;
  }

  /**
   * 보육교사 2급
   */
  if (
    analysis.courseKey ===
    "childcare_teacher_2"
  ) {
    pushRequirement(
      result,
      createNumericRequirement({
        key: "total_subjects",
        label: "전체과목",
        type: "subjects",

        required:
          summary.requiredSubjects,

        current:
          summary.completedSubjects,

        remaining:
          summary.remainingSubjects,

        unit: "과목",
      })
    );

    const areas =
      getRecord(
        summary.areas
      );

    for (
      const [areaKey, rawArea]
      of Object.entries(areas)
    ) {
      const area =
        getRecord(rawArea);

      pushRequirement(
        result,
        createNumericRequirement({
          key:
            `area_${areaKey}`,

          label:
            String(
              area.label ||
              area.name ||
              areaKey
            ),

          type:
            "subjects",

          required:
            area.requiredSubjects ??
            area.minimumSubjects,

          current:
            area.completedSubjects,

          remaining:
            area.remainingSubjects,

          unit:
            "과목",
        })
      );
    }

    return result;
  }

  /**
   * 한국어교원 2급
   */
  if (
    analysis.courseKey ===
    "korean_teacher_2"
  ) {
    const areas =
      getRecord(
        summary.areas
      );

    for (
      const [areaKey, rawArea]
      of Object.entries(areas)
    ) {
      const area =
        getRecord(rawArea);

      pushRequirement(
        result,
        createNumericRequirement({
          key:
            `area_${areaKey}`,

          label:
  String(
    area.label ||
    area.name ||
    (
      /^area\d+$/.test(areaKey)
        ? `${areaKey.replace("area", "")}영역`
        : areaKey
    )
  ),

          type:
            "credits",

          required:
            area.requiredCredits,

          current:
            area.completedCredits,

          remaining:
            area.remainingCredits,

          unit:
            "학점",
        })
      );
    }

    return result;
  }

  /**
   * 기타 과정
   *
   * 향후 과정이 추가돼도 공통 필드가 존재하면
   * 최소한 전체 자격요건은 자동 표시한다.
   */
  pushRequirement(
    result,
    createNumericRequirement({
      key:
        "total_subjects",

      label:
        "필요과목",

      type:
        "subjects",

      required:
        summary.requiredSubjects ??
        summary.minimumRequiredSubjects,

      current:
        summary.completedSubjects ??
        summary.completedRequiredSubjects,

      remaining:
        summary.remainingSubjects ??
        summary.remainingRequiredSubjects,

      unit:
        "과목",
    })
  );

  pushRequirement(
    result,
    createNumericRequirement({
      key:
        "total_credits",

      label:
        "필요학점",

      type:
        "credits",

      required:
        summary.requiredCredits ??
        summary.qualificationTotalCredits,

      current:
        summary.completedCredits ??
        summary.completedQualificationCredits,

      remaining:
        summary.remainingCredits ??
        summary.remainingQualificationCredits,

      unit:
        "학점",
    })
  );

  return result;
}