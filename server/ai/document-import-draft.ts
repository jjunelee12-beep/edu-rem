import type {
  AiDocumentAnalysisResult,
  AiDocumentExtractedField,
  AiDocumentImportDraft,
  AiDocumentTarget,
  AiPendingActionPreview,
  AiPendingActionType,
} from "./ai.types";

type BuildDocumentImportDraftInput = {
  studentId:
    number;

  analysis:
    AiDocumentAnalysisResult;

  /**
   * 담당자가 AI 추천값 대신
   * 직접 반영 위치를 선택할 때 사용한다.
   *
   * 현재 1차에서는 생략하면
   * analysis.recommendedTarget을 사용한다.
   */
  target?:
    AiDocumentTarget |
    null;
};

export type BuildDocumentImportDraftResult = {
  draft:
    AiDocumentImportDraft;

  preview:
    AiPendingActionPreview;
};

function normalizePositiveInteger(
  value:
    unknown
): number {
  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    ) ||
    number <= 0
  ) {
    return 0;
  }

  return Math.floor(
    number
  );
}

function normalizeNullableString(
  value:
    unknown
): string | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const normalized =
    String(
      value
    ).trim();

  return normalized ||
    null;
}

function normalizeNullableNumber(
  value:
    unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    return null;
  }

  return number;
}

function getFieldValue<T>(
  field:
    AiDocumentExtractedField<T> |
    null |
    undefined
): T | null {
  return (
    field?.value ??
    null
  );
}

function getActionType(
  target:
    AiDocumentTarget
): AiPendingActionType {
  if (
    target ===
    "transfer"
  ) {
    return "document_transfer_import";
  }

  if (
    target ===
    "plan"
  ) {
    return "document_plan_import";
  }

  if (
    target ===
    "payment"
  ) {
    return "document_payment_import";
  }

  if (
    target ===
    "plan_and_payment"
  ) {
    return "document_plan_payment_import";
  }

  throw new Error(
    "분석 전용 문서는 CRM 반영 초안을 생성할 수 없습니다."
  );
}

function getTargetLabel(
  target:
    AiDocumentTarget
): string {
  if (
    target ===
    "transfer"
  ) {
    return "전적대·기존 이수 과목";
  }

  if (
    target ===
    "plan"
  ) {
    return "우리플랜 수강 과목";
  }

  if (
    target ===
    "payment"
  ) {
    return "학생 결제정보";
  }

  if (
    target ===
    "plan_and_payment"
  ) {
    return "우리플랜 과목 및 결제정보";
  }

  return "분석 결과 확인";
}

function targetNeedsSubjects(
  target:
    AiDocumentTarget
): boolean {
  return (
    target ===
      "transfer" ||
    target ===
      "plan" ||
    target ===
      "plan_and_payment"
  );
}

function targetNeedsPayment(
  target:
    AiDocumentTarget
): boolean {
  return (
    target ===
      "payment" ||
    target ===
      "plan_and_payment"
  );
}

function normalizeStringArray(
  value:
    unknown
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
        .map(
          (
            item
          ) =>
            String(
              item ??
              ""
            ).trim()
        )
        .filter(Boolean)
    )
  );
}

function buildSubjectRows(
  analysis:
    AiDocumentAnalysisResult
): AiDocumentImportDraft["subjects"] {
  return (
    analysis.subjects ||
    []
  )
    .map(
      (
        subject,
        index
      ) => {
        const subjectName =
          normalizeNullableString(
            getFieldValue(
              subject
                .subjectName
            )
          );

        const credits =
          normalizeNullableNumber(
            getFieldValue(
              subject
                .credits
            )
          );

        const categoryValue =
          getFieldValue(
            subject
              .category
          );

        const requirementTypeValue =
          getFieldValue(
            subject
              .requirementType
          );

        const semesterNoValue =
          normalizeNullableNumber(
            getFieldValue(
              subject
                .semesterNo
            )
          );

        const grade =
          normalizeNullableString(
            getFieldValue(
              subject
                .grade
            )
          );

        const category:
          | "전공"
          | "교양"
          | "일반" =
          categoryValue ===
            "교양" ||
          categoryValue ===
            "일반"
            ? categoryValue
            : "전공";

        const requirementType:
          | "전공필수"
          | "전공선택"
          | "교양"
          | "일반" =
          requirementTypeValue ===
            "전공필수" ||
          requirementTypeValue ===
            "교양" ||
          requirementTypeValue ===
            "일반"
            ? requirementTypeValue
            : category ===
                "교양"
              ? "교양"
              : category ===
                  "일반"
                ? "일반"
                : "전공선택";

        const warnings =
          normalizeStringArray([
            ...(
              subject
                .warnings ||
              []
            ),

            subject
              .subjectName
              .warning,

            subject
              .credits
              .warning,

            subject
              .category
              .warning,

            subject
              .requirementType
              .warning,

            subject
              .semesterNo
              .warning,
          ]);

        return {
          rowId:
            normalizeNullableString(
              subject.rowId
            ) ||
            `document-subject-${index + 1}`,

          selected:
            subject.selected !==
            false,

          subjectName:
            subjectName ||
            "",

          credits:
            credits &&
            credits > 0
              ? Math.floor(
                  credits
                )
              : 3,

          grade,

          category,

          requirementType,

          semesterNo:
            semesterNoValue &&
            semesterNoValue > 0
              ? Math.floor(
                  semesterNoValue
                )
              : null,

          /**
           * 현재 분석 직후 필드 상태는 extracted다.
           *
           * Pending Action의 최종 확인 버튼 자체가
           * 담당자 확인 절차이므로 여기서는
           * 과목별 확인 여부를 저장용 메타로만 둔다.
           */
          isConfirmed:
            subject
              .subjectName
              .status ===
              "confirmed" ||
            subject
              .subjectName
              .status ===
              "edited",

          rawText:
            normalizeNullableString(
              subject.rawText
            ),

          warnings,
        };
      }
    )
    .filter(
      (
        subject
      ) =>
        subject.selected &&
        subject.subjectName
          .length >= 2
    );
}

function buildMissingFields(
  params: {
    studentId:
      number;

    target:
      AiDocumentTarget;

    subjects:
      AiDocumentImportDraft["subjects"];

    paymentAmount:
      number | null;

    paymentStatus:
      string | null;

    paidAt:
      string | null;
  }
): string[] {
  const missingFields:
    string[] = [];

  if (
    params.studentId <= 0
  ) {
    missingFields.push(
      "반영 대상 학생"
    );
  }

  if (
    params.target ===
    "analysis_only"
  ) {
    missingFields.push(
      "CRM 반영 위치"
    );
  }

  if (
    targetNeedsSubjects(
      params.target
    ) &&
    params.subjects
      .length === 0
  ) {
    missingFields.push(
      "반영할 과목"
    );
  }

 if (
  targetNeedsPayment(
    params.target
  ) &&
  params.paymentAmount ===
    null &&
  !params.paidAt
) {
  missingFields.push(
    "결제금액 또는 결제일"
  );
}

  return Array.from(
    new Set(
      missingFields
    )
  );
}

function buildExecutionSteps(
  target:
    AiDocumentTarget
): string[] {
  if (
    target ===
    "transfer"
  ) {
    return [
      "선택 학생과 문서 분석 결과 재검증",
      "기존 전적대·이수 과목과 중복 확인",
      "선택된 과목을 기존 이수 과목에 등록",
      "학생 학점 현황 다시 계산",
      "학생 변경이력 기록",
    ];
  }

  if (
    target ===
    "plan"
  ) {
    return [
      "선택 학생과 문서 분석 결과 재검증",
      "학생 플랜 및 학기정보 확인",
      "선택된 과목을 우리플랜에 등록",
      "학생 학점 현황 다시 계산",
      "학생 변경이력 기록",
    ];
  }

  if (
    target ===
    "payment"
  ) {
    return [
      "선택 학생과 문서 분석 결과 재검증",
      "기존 결제정보 확인",
      "분석된 결제금액·상태·결제일 반영",
      "정산 데이터와 충돌 여부 확인",
      "학생 변경이력 기록",
    ];
  }

  if (
    target ===
    "plan_and_payment"
  ) {
    return [
      "선택 학생과 문서 분석 결과 재검증",
      "학생 플랜 및 학기정보 확인",
      "선택된 과목을 우리플랜에 등록",
      "분석된 결제정보 반영",
      "학생 학점 및 정산 상태 다시 계산",
      "학생 변경이력 기록",
    ];
  }

  return [
    "문서 분석 결과 확인",
  ];
}

function buildPreviewSections(
  draft:
    AiDocumentImportDraft
): AiPendingActionPreview["sections"] {
  const sections:
    AiPendingActionPreview["sections"] = [
    {
      label:
        "반영 대상",

      items: [
        `학생 ID: ${draft.studentId}`,
        `문서 종류: ${draft.documentType}`,
        `반영 위치: ${getTargetLabel(draft.target)}`,
        `분석 ID: ${draft.analysisId}`,
      ],
    },
  ];

  const commonItems =
    [
      draft.institutionName
        ? `기관명: ${draft.institutionName}`
        : null,

      draft.studentName
        ? `문서 학생명: ${draft.studentName}`
        : null,

      draft.courseName
        ? `과정명: ${draft.courseName}`
        : null,

      draft.semesterLabel
        ? `학기: ${draft.semesterLabel}`
        : null,

      draft.startDate
        ? `시작일: ${draft.startDate}`
        : null,

      draft.endDate
        ? `종료일: ${draft.endDate}`
        : null,
    ]
      .filter(
        (
          item
        ): item is string =>
          Boolean(
            item
          )
      );

  if (
    commonItems.length >
    0
  ) {
    sections.push({
      label:
        "문서 공통정보",

      items:
        commonItems,
    });
  }

  if (
    draft.subjects
      .length > 0
  ) {
    sections.push({
      label:
        "반영 예정 과목",

      items:
        draft.subjects.map(
          (
            subject,
            index
          ) => {
            const meta = [
              `${subject.credits}학점`,
              subject.category,
              subject.requirementType,
              subject.semesterNo
                ? `${subject.semesterNo}학기`
                : null,
              subject.grade
                ? `성적 ${subject.grade}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return `${index + 1}. ${subject.subjectName} (${meta})`;
          }
        ),
    });
  }

  if (
    targetNeedsPayment(
      draft.target
    )
  ) {
    sections.push({
      label:
        "반영 예정 결제정보",

      items: [
        `결제금액: ${
          draft.paymentAmount !==
          null
            ? `${draft.paymentAmount.toLocaleString("ko-KR")}원`
            : "확인 필요"
        }`,

        `결제상태: ${
          draft.paymentStatus ||
          "확인 필요"
        }`,

        `결제일: ${
          draft.paidAt ||
          "확인 필요"
        }`,
      ],
    });
  }

  return sections;
}

export function buildDocumentImportDraft(
  input:
    BuildDocumentImportDraftInput
): BuildDocumentImportDraftResult {
  const studentId =
    normalizePositiveInteger(
      input.studentId
    );

  const analysis =
    input.analysis;

  if (
    !analysis ||
    typeof analysis !==
      "object"
  ) {
    throw new Error(
      "문서 분석 결과가 필요합니다."
    );
  }

  const analysisId =
    normalizeNullableString(
      analysis.analysisId
    );

  if (!analysisId) {
    throw new Error(
      "문서 분석 ID가 없습니다."
    );
  }

  const target =
    input.target ||
    analysis.recommendedTarget;

  if (
    target ===
    "analysis_only"
  ) {
    throw new Error(
      "분석 전용 문서는 반영 위치를 먼저 선택해야 합니다."
    );
  }

  const actionType =
    getActionType(
      target
    );

  const paymentAmount =
    normalizeNullableNumber(
      getFieldValue(
        analysis
          .paymentAmount
      )
    );

  const paymentStatus =
    normalizeNullableString(
      getFieldValue(
        analysis
          .paymentStatus
      )
    );

  const paidAt =
    normalizeNullableString(
      getFieldValue(
        analysis
          .paidAt
      )
    );

  const subjects =
    buildSubjectRows(
      analysis
    );

  const missingFields =
    buildMissingFields({
      studentId,
      target,
      subjects,
      paymentAmount,
      paymentStatus,
      paidAt,
    });

  const analysisWarnings =
    normalizeStringArray(
      analysis.warnings
    );

  const requiredConfirmations =
    normalizeStringArray(
      analysis
        .requiredConfirmations
    );

  const subjectWarnings =
    normalizeStringArray(
      subjects.flatMap(
        (
          subject
        ) =>
          subject.warnings
      )
    );

  /**
   * requiredConfirmations는 담당자가
   * Pending 미리보기를 확인해야 한다는 경고다.
   *
   * 값 자체가 없어서 실행할 수 없는 경우만
   * missingFields에 포함한다.
   */
  const warnings =
    normalizeStringArray([
      ...analysisWarnings,
      ...requiredConfirmations,
      ...subjectWarnings,
    ]);

  const canConfirm =
    missingFields
      .length === 0;

  const createdAt =
    new Date()
      .toISOString();

  const draft:
    AiDocumentImportDraft = {
    analysisId,

    studentId,

    documentType:
      analysis.documentType,

    target,

    actionType:
      actionType as
        AiDocumentImportDraft["actionType"],

    institutionName:
      normalizeNullableString(
        getFieldValue(
          analysis
            .institutionName
        )
      ),

    studentName:
      normalizeNullableString(
        getFieldValue(
          analysis
            .studentName
        )
      ),

    courseName:
      normalizeNullableString(
        getFieldValue(
          analysis
            .courseName
        )
      ),

    semesterLabel:
      normalizeNullableString(
        getFieldValue(
          analysis
            .semesterLabel
        )
      ),

    startDate:
      normalizeNullableString(
        getFieldValue(
          analysis
            .startDate
        )
      ),

    endDate:
      normalizeNullableString(
        getFieldValue(
          analysis
            .endDate
        )
      ),

    paymentAmount,

    paymentStatus,

    paidAt,

    subjects,

    warnings,

    requiredConfirmations,

    missingFields,

    canConfirm,

    analyzedAt:
      normalizeNullableString(
        analysis.analyzedAt
      ) ||
      createdAt,

    createdAt,
  };

  const targetLabel =
    getTargetLabel(
      target
    );

  const preview:
    AiPendingActionPreview = {
    title:
      "AI 문서 CRM 반영 검토",

    summary:
      `${analysis.documentTypeLabel || "이미지 문서"} 분석 결과를 ${targetLabel}에 반영할 예정입니다.`,

    sections:
      buildPreviewSections(
        draft
      ),

    changes:
      [],

    executionSteps:
      buildExecutionSteps(
        target
      ),

    missingFields,

    warnings,

    canConfirm,
  };

  return {
    draft,
    preview,
  };
}