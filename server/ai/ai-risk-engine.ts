import * as db from "../db";

import {
  assertCanAccessStudent,
} from "./ai-permission";

import type {
  AiUserContext,
  StudentDetailRiskToolOutput,
  StudentListRiskToolOutput,
  StudentRiskItem,
  StudentRiskSubjectItem,
} from "./ai.types";

type RequirementKey =
  | "majorRequired"
  | "majorElective"
  | "liberal"
  | "general";

function toNumber(value: unknown) {
  const normalized =
    Number(
      String(value ?? "0")
        .replace(/,/g, "")
        .trim()
    );

  return Number.isFinite(normalized)
    ? normalized
    : 0;
}

function normalizeSubjectName(
  value: unknown
) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function resolveRequirementKey(
  requirementType: unknown,
  category: unknown
): RequirementKey | null {
  const requirement =
    String(
      requirementType ?? ""
    ).trim();

  const categoryValue =
    String(category ?? "").trim();

  if (requirement === "전공필수") {
    return "majorRequired";
  }

  if (requirement === "전공선택") {
    return "majorElective";
  }

  if (
    requirement === "교양" ||
    categoryValue === "교양"
  ) {
    return "liberal";
  }

  if (
    requirement === "일반" ||
    categoryValue === "일반"
  ) {
    return "general";
  }

  return null;
}

function isValidRecognizedSubject(
  subject: StudentRiskSubjectItem
) {
  if (!subject.subjectName) {
    return false;
  }

  if (subject.credits <= 0) {
    return false;
  }

  return Boolean(
    resolveRequirementKey(
      subject.requirementType,
      subject.category
    )
  );
}

function getSubjectRecognitionPriority(
  subject: StudentRiskSubjectItem
) {
  if (subject.source === "transfer") {
    return 1;
  }

  if (subject.source === "extra") {
    return 2;
  }

  return 3;
}

/**
 * 동일 과목은 하나만 인정한다.
 *
 * 우선순위:
 * 전적대 → 추가입력 → 우리플랜
 */
function createRecognizedSubjects(
  subjects: StudentRiskSubjectItem[]
) {
  const sortedSubjects = [
  ...subjects,
].sort((a, b) => {
  /**
   * 중복 과목 중 정상 데이터가 먼저 인정되도록 한다.
   *
   * 잘못 입력된 전적대 과목이
   * 정상적인 우리플랜 과목을 밀어내는 문제를 방지한다.
   */
  const aValid =
    isValidRecognizedSubject(a);

  const bValid =
    isValidRecognizedSubject(b);

  if (aValid !== bValid) {
    return aValid ? -1 : 1;
  }

  /**
   * 둘 다 정상이거나 둘 다 비정상이면
   * 출처 우선순위를 적용한다.
   */
  const priorityDiff =
    getSubjectRecognitionPriority(a) -
    getSubjectRecognitionPriority(b);

  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  /**
   * 같은 출처라면 먼저 등록된 항목을 인정한다.
   */
  const aId =
    Number(a.id || 0);

  const bId =
    Number(b.id || 0);

  if (
    aId > 0 &&
    bId > 0
  ) {
    return aId - bId;
  }

  return 0;
});

  const recognizedMap =
    new Map<
      string,
      StudentRiskSubjectItem
    >();

  const duplicateMap =
    new Map<
      string,
      StudentRiskSubjectItem[]
    >();

  sortedSubjects.forEach(
    (subject, index) => {
      const normalizedName =
        normalizeSubjectName(
          subject.subjectName
        );

      if (!normalizedName) {
        recognizedMap.set(
          `unknown:${subject.source}:${subject.id ?? index}`,
          subject
        );

        return;
      }

      const existing =
        recognizedMap.get(
          normalizedName
        );

      if (!existing) {
        recognizedMap.set(
          normalizedName,
          subject
        );

        duplicateMap.set(
          normalizedName,
          [subject]
        );

        return;
      }

      duplicateMap.set(
        normalizedName,
        [
          ...(
            duplicateMap.get(
              normalizedName
            ) || [existing]
          ),
          subject,
        ]
      );
    }
  );

  return {
    recognizedSubjects:
      Array.from(
        recognizedMap.values()
      ),

    duplicateMap,
  };
}

function createEmptyCategory() {
  return {
    currentSubjects: 0,
    currentCredits: 0,

    requiredSubjects:
      null as number | null,

    requiredCredits:
      null as number | null,

    remainingSubjects:
      null as number | null,

    remainingCredits:
      null as number | null,
  };
}

function pushIssue(
  issues: StudentRiskItem[],
  issue: StudentRiskItem
) {
  const duplicate =
    issues.some(
      (current) =>
        current.code === issue.code &&
        current.message ===
          issue.message
    );

  if (!duplicate) {
    issues.push(issue);
  }
}

function createSubjectRows(params: {
  planSemesters: any[];
  transferSubjects: any[];
  extraItems: any[];
}): StudentRiskSubjectItem[] {
  const planRows =
    (params.planSemesters || [])
      .map((row: any) => ({
        source: "plan" as const,
        sourceLabel: "우리플랜",

        id:
          Number(row.id || 0) ||
          null,

        subjectName:
          String(
            row.subjectName || ""
          ).trim(),

        requirementType:
          row.planRequirementType ??
          null,

        category:
          row.planCategory ??
          null,

        credits:
          toNumber(row.credits),

        semesterNo:
          Number(
            row.semesterNo || 0
          ) || null,
      }));

  const transferRows =
    (params.transferSubjects || [])
      .map((row: any) => ({
        source: "transfer" as const,
        sourceLabel: "전적대",

        id:
          Number(row.id || 0) ||
          null,

        subjectName:
          String(
            row.subjectName || ""
          ).trim(),

        requirementType:
          row.transferRequirementType ??
          null,

        category:
          row.transferCategory ??
          null,

        credits:
          toNumber(row.credits),
      }));

  const extraRows =
    (params.extraItems || [])
      .filter(
        (row: any) =>
          !Boolean(row.isExcluded)
      )
      .map((row: any) => ({
        source: "extra" as const,
        sourceLabel: "추가입력",

        id:
          Number(row.id || 0) ||
          null,

        subjectName:
          String(
            row.subjectName || ""
          ).trim(),

        requirementType:
          row.requirementType ??
          null,

        category:
          row.category ?? null,

        credits:
          toNumber(row.credits),
      }));

  return [
    ...planRows,
    ...transferRows,
    ...extraRows,
  ];
}

function applyRuleToCategory(params: {
  category: ReturnType<
    typeof createEmptyCategory
  >;

  requiredSubjects: unknown;
  requiredCredits: unknown;
}) {
  const requiredSubjects =
    toNumber(
      params.requiredSubjects
    );

  const requiredCredits =
    toNumber(
      params.requiredCredits
    );

  params.category.requiredSubjects =
    requiredSubjects;

  params.category.requiredCredits =
    requiredCredits;

  params.category.remainingSubjects =
    Math.max(
      requiredSubjects -
        params.category
          .currentSubjects,
      0
    );

  params.category.remainingCredits =
    Math.max(
      requiredCredits -
        params.category
          .currentCredits,
      0
    );
}

function buildRiskScore(
  issues: StudentRiskItem[]
) {
  return issues.reduce(
    (score, issue) => {
      if (
        issue.severity ===
        "danger"
      ) {
        return score + 20;
      }

      if (
        issue.severity ===
        "warning"
      ) {
        return score + 10;
      }

      return score + 2;
    },
    0
  );
}

export async function analyzeStudentDetailRisk(
  params: {
    context: AiUserContext;
    studentId: number;
  }
): Promise<StudentDetailRiskToolOutput> {
  const studentId =
    Number(params.studentId);

  if (
    !Number.isFinite(studentId) ||
    studentId <= 0
  ) {
    throw new Error(
      "올바른 학생 ID가 필요합니다."
    );
  }

  const organizationId =
    params.context.organizationId;

  /**
   * 학생을 가장 먼저 조회하고
   * 담당자·팀·회사 권한을 검사한다.
   */
  const student =
    await db.getStudentById(
      studentId,
      {
        organizationId,
      }
    );

  if (!student) {
    throw new Error(
      "학생 정보를 찾을 수 없습니다."
    );
  }

  assertCanAccessStudent({
    context: params.context,
    student,
  });

  const [
  plan,
  planSemesters,
  transferSubjects,
  creditRule,
  extraItems,
  practiceRequests,
  registrationSummary,
] = await Promise.all([
  db.getPlan(
    studentId,
    {
      organizationId,
    }
  ),

  db.listPlanSemesters(
    studentId,
    {
      organizationId,
    }
  ),

  db.listTransferSubjects(
    studentId,
    {
      organizationId,
    }
  ),

  db.findCreditSummaryRule({
    organizationId,
    studentId,
  }),

  db.listStudentCreditSummaryItems({
    organizationId,
    studentId,
  }),

  db.listPracticeSupportRequestsByStudent(
    studentId,
    {
      organizationId,
    }
  ),

  db.getStudentRegistrationSummary(
    studentId,
    {
      organizationId,
    }
  ),
]);

const effectivePaymentDate =
  registrationSummary.paymentDate ??
  (student as any).paymentDate ??
  null;

const registrationPaymentAmount =
  toNumber(
    registrationSummary.paymentAmount
  );

const registrationTotalPaid =
  toNumber(
    registrationSummary.totalPaid
  );

const registrationTotalRefund =
  toNumber(
    registrationSummary.totalRefund
  );

const studentPaymentAmount =
  toNumber(
    (student as any).paymentAmount
  );

const hasSettlementData =
  Boolean(
    registrationSummary.hasSettlementData
  );

const effectivePaymentAmount =
  hasSettlementData
    ? registrationPaymentAmount
    : studentPaymentAmount;

/**
 * 정산 및 환불 상태
 */
const isFullRefund =
  hasSettlementData &&
  registrationTotalPaid > 0 &&
  registrationTotalRefund >=
    registrationTotalPaid;

const isPartialRefund =
  hasSettlementData &&
  registrationTotalPaid > 0 &&
  registrationTotalRefund > 0 &&
  registrationTotalRefund <
    registrationTotalPaid;

const isSettlementPaymentUnconfirmed =
  hasSettlementData &&
  registrationTotalPaid <= 0 &&
  registrationTotalRefund <= 0;

const isRefundWithoutPayment =
  hasSettlementData &&
  registrationTotalPaid <= 0 &&
  registrationTotalRefund > 0;

const paymentStatus:
  StudentDetailRiskToolOutput["payment"]["status"] =
    isRefundWithoutPayment
      ? "refund_without_payment"
      : isFullRefund
        ? "full_refund"
        : isPartialRefund
          ? "partial_refund"
          : isSettlementPaymentUnconfirmed
            ? "not_confirmed"
            : !hasSettlementData &&
                effectivePaymentAmount <= 0
              ? "missing"
              : "paid";

  const issues: StudentRiskItem[] =
    [];

  const subjects =
    createSubjectRows({
      planSemesters:
        planSemesters as any[],

      transferSubjects:
        transferSubjects as any[],

      extraItems:
        extraItems as any[],
    });

const {
  recognizedSubjects,
  duplicateMap,
} = createRecognizedSubjects(
  subjects
);

/**
 * 중복을 제거한 과목 중에서도
 * 과목명, 학점, 이수구분이 정상인 과목만
 * 실제 인정 과목으로 계산한다.
 */
const validRecognizedSubjects =
  recognizedSubjects.filter(
    isValidRecognizedSubject
  );

const categories = {
    majorRequired:
      createEmptyCategory(),

    majorElective:
      createEmptyCategory(),

    liberal:
      createEmptyCategory(),

    general:
      createEmptyCategory(),
  };

  /**
   * 기본 학생 정보 점검
   */
  if (
    !String(
      (student as any).course ||
      ""
    ).trim()
  ) {
    pushIssue(issues, {
      code:
        "STUDENT_COURSE_MISSING",

      severity: "warning",
      category: "student",

      title: "과정 미입력",
      message:
        "학생의 희망과정 또는 진행과정이 입력되지 않았습니다.",
    });
  }

 if (!effectivePaymentDate) {
  pushIssue(issues, {
    code:
      "PAYMENT_DATE_MISSING",

    severity: "warning",
    category: "payment",

    title: "결제일 누락",
    message:
      "학생 결제일이 입력되지 않았습니다.",
  });
}

 /**
 * 결제·환불 상태 점검
 *
 * 한 학생에게 결제 누락과 전액 환불이
 * 동시에 표시되지 않도록 분기 처리한다.
 */
if (isRefundWithoutPayment) {
  pushIssue(issues, {
    code:
      "PAYMENT_REFUND_WITHOUT_PAID",

    severity: "danger",
    category: "payment",

    title: "환불 정산 확인 필요",

    message:
      `확인된 결제금액은 0원이지만 환불금액 ${registrationTotalRefund.toLocaleString("ko-KR")}원이 등록되어 있습니다. 원 결제 정산 또는 환불 연결 상태를 확인해야 합니다.`,

    details: {
      totalPaid:
        registrationTotalPaid,

      totalRefund:
        registrationTotalRefund,

      netPaymentAmount:
        registrationPaymentAmount,
    },
  });
} else if (isFullRefund) {
  pushIssue(issues, {
    code:
      "PAYMENT_FULL_REFUND",

    severity: "warning",
    category: "payment",

    title: "전액 환불",

    message:
      `총 결제금액 ${registrationTotalPaid.toLocaleString("ko-KR")}원이 전액 환불되었습니다.`,

    details: {
      totalPaid:
        registrationTotalPaid,

      totalRefund:
        registrationTotalRefund,

      netPaymentAmount:
        registrationPaymentAmount,
    },
  });
} else if (isPartialRefund) {
  pushIssue(issues, {
    code:
      "PAYMENT_PARTIAL_REFUND",

    severity: "info",
    category: "payment",

    title: "부분 환불",

    message:
      `총 결제금액 ${registrationTotalPaid.toLocaleString("ko-KR")}원 중 ${registrationTotalRefund.toLocaleString("ko-KR")}원이 환불되어 현재 실결제금액은 ${registrationPaymentAmount.toLocaleString("ko-KR")}원입니다.`,

    details: {
      totalPaid:
        registrationTotalPaid,

      totalRefund:
        registrationTotalRefund,

      netPaymentAmount:
        registrationPaymentAmount,
    },
  });
} else if (
  isSettlementPaymentUnconfirmed
) {
  pushIssue(issues, {
    code:
      "PAYMENT_NOT_CONFIRMED",

    severity: "warning",
    category: "payment",

    title: "결제 미확정",

    message:
      "정산 항목은 등록되어 있지만 확인된 결제금액이 없습니다.",

    details: {
      totalPaid:
        registrationTotalPaid,

      totalRefund:
        registrationTotalRefund,

      netPaymentAmount:
        registrationPaymentAmount,
    },
  });
} else if (
  !hasSettlementData &&
  effectivePaymentAmount <= 0
) {
  pushIssue(issues, {
    code:
      "PAYMENT_AMOUNT_MISSING",

    severity: "warning",
    category: "payment",

    title: "결제금액 누락",

    message:
      "정산 데이터와 학생 기본 결제금액이 모두 입력되지 않았거나 0원입니다.",

    details: {
      studentPaymentAmount:
        studentPaymentAmount,

      hasSettlementData:
        false,
    },
  });
}

  /**
   * 플랜 점검
   */
  if (!plan) {
    pushIssue(issues, {
      code: "PLAN_MISSING",

      severity: "danger",
      category: "plan",

      title: "우리플랜 미등록",
      message:
        "학생의 전체 학습플랜이 등록되지 않았습니다.",
    });
  }

  if (
    !planSemesters ||
    planSemesters.length === 0
  ) {
    pushIssue(issues, {
      code:
        "PLAN_SUBJECTS_MISSING",

      severity: "danger",
      category: "plan",

      title: "학기별 과목 없음",
      message:
        "학기별 예정 과목이 등록되지 않았습니다.",
    });
  }

  /**
   * 과목 데이터 점검
   */
  for (const subject of subjects) {
    if (!subject.subjectName) {
      pushIssue(issues, {
        code:
          `SUBJECT_NAME_MISSING_${subject.source}_${subject.id ?? "unknown"}`,

        severity: "warning",
        category: "subject",

        title: "과목명 누락",
        message:
          `${subject.sourceLabel} 항목에 과목명이 입력되지 않았습니다.`,
      });

      continue;
    }

    if (subject.credits <= 0) {
      pushIssue(issues, {
        code:
          `SUBJECT_CREDIT_INVALID_${subject.source}_${subject.id ?? "unknown"}`,

        severity: "warning",
        category: "credit",

        title: "과목 학점 확인",
        message:
          `${subject.sourceLabel}의 '${subject.subjectName}' 과목 학점이 0이거나 입력되지 않았습니다.`,

        details: {
          source:
            subject.sourceLabel,

          subjectName:
            subject.subjectName,

          credits:
            subject.credits,
        },
      });
    }

    const requirementKey =
      resolveRequirementKey(
        subject.requirementType,
        subject.category
      );

    if (!requirementKey) {
      pushIssue(issues, {
        code:
          `SUBJECT_REQUIREMENT_MISSING_${subject.source}_${subject.id ?? "unknown"}`,

        severity: "warning",
        category: "subject",

        title: "과목 구분 확인",
        message:
          `${subject.sourceLabel}의 '${subject.subjectName}' 과목에 전공필수·전공선택·교양·일반 구분이 없습니다.`,

        details: {
          source:
            subject.sourceLabel,

          subjectName:
            subject.subjectName,
        },
      });

      continue;
    }
  }

  /**
   * 플랜·전적대·추가입력 전체에서
   * 과목명 중복을 검사한다.
   */

  let duplicateSubjectCount = 0;

  for (const rows of duplicateMap.values()) {
    if (rows.length < 2) {
      continue;
    }

    duplicateSubjectCount += 1;

    const sourceLabels =
      Array.from(
        new Set(
          rows.map(
            (row) =>
              row.sourceLabel
          )
        )
      ).join(", ");

const recognizedSubject =
  recognizedSubjects.find(
    (subject) =>
      normalizeSubjectName(
        subject.subjectName
      ) ===
      normalizeSubjectName(
        rows[0].subjectName
      )
  );

    pushIssue(issues, {
      code:
        `DUPLICATE_SUBJECT_${normalizeSubjectName(rows[0].subjectName)}`,

      severity: "danger",
      category: "subject",

      title: "중복 과목 확인",

      message:
  `'${rows[0].subjectName}' 과목이 ${rows.length}건 등록되어 있습니다. ${recognizedSubject?.sourceLabel || "첫 번째 항목"} 1건만 학점으로 인정하고 나머지는 중복에서 제외했습니다. 등록 위치: ${sourceLabels}`,

     details: {
  subjectName:
    rows[0].subjectName,

  count:
    rows.length,

  sources:
    sourceLabels,

  recognizedSource:
    recognizedSubject?.sourceLabel ??
    null,

  recognizedCredits:
    recognizedSubject?.credits ??
    0,
},
    });
  }

/**
 * 실제 학점 및 과목 수는
 * 중복 제거 후 유효한 인정 과목만 계산한다.
 */
for (
  const subject of validRecognizedSubjects
) {
  const requirementKey =
    resolveRequirementKey(
      subject.requirementType,
      subject.category
    );

  /**
   * validRecognizedSubjects 생성 단계에서 이미 검사하지만
   * TypeScript와 예외 상황을 위해 한 번 더 방어한다.
   */
  if (!requirementKey) {
    continue;
  }

  categories[
    requirementKey
  ].currentSubjects += 1;

  categories[
    requirementKey
  ].currentCredits +=
    subject.credits;
}

  /**
   * 학점 기준 점검
   */
  let requiredCredits:
    number | null = null;

  let remainingCredits:
    number | null = null;

  const currentCredits =
  validRecognizedSubjects.reduce(
    (sum, subject) =>
      sum + subject.credits,
    0
  );

  if (!creditRule) {
    pushIssue(issues, {
      code:
        "CREDIT_RULE_MISSING",

      severity: "warning",
      category: "credit",

      title: "학점 기준 미설정",
      message:
        "학생별 학점요약 기준이 설정되지 않아 부족·초과 학점을 정확히 계산할 수 없습니다.",
    });
  } else {
    requiredCredits =
      toNumber(
        (creditRule as any)
          .requiredTotalCredits
      );

    remainingCredits =
      Math.max(
        requiredCredits -
          currentCredits,
        0
      );

    applyRuleToCategory({
      category:
        categories.majorRequired,

      requiredSubjects:
        (creditRule as any)
          .requiredMajorRequiredSubjects,

      requiredCredits:
        (creditRule as any)
          .requiredMajorRequiredCredits,
    });

    applyRuleToCategory({
      category:
        categories.majorElective,

      requiredSubjects:
        (creditRule as any)
          .requiredMajorElectiveSubjects,

      requiredCredits:
        (creditRule as any)
          .requiredMajorElectiveCredits,
    });

    applyRuleToCategory({
      category:
        categories.liberal,

      requiredSubjects:
        (creditRule as any)
          .requiredLiberalSubjects,

      requiredCredits:
        (creditRule as any)
          .requiredLiberalCredits,
    });

    applyRuleToCategory({
      category:
        categories.general,

      requiredSubjects:
        (creditRule as any)
          .requiredGeneralSubjects,

      requiredCredits:
        (creditRule as any)
          .requiredGeneralCredits,
    });

    if (
      requiredCredits > 0 &&
      remainingCredits > 0
    ) {
      pushIssue(issues, {
        code:
          "TOTAL_CREDIT_SHORTAGE",

        severity: "danger",
        category: "credit",

        title: "총 학점 부족",

        message:
          `필요 학점 ${requiredCredits}학점 중 현재 ${currentCredits}학점으로 ${remainingCredits}학점 부족합니다.`,

        details: {
          requiredCredits,
          currentCredits,
          remainingCredits,
        },
      });
    }

    const categoryLabels:
      Record<
        RequirementKey,
        string
      > = {
      majorRequired: "전공필수",
      majorElective: "전공선택",
      liberal: "교양",
      general: "일반",
    };

    for (
      const key of Object.keys(
        categories
      ) as RequirementKey[]
    ) {
      const category =
        categories[key];

      if (
        Number(
          category.remainingSubjects ||
          0
        ) > 0 ||
        Number(
          category.remainingCredits ||
          0
        ) > 0
      ) {
        pushIssue(issues, {
          code:
            `CATEGORY_SHORTAGE_${key}`,

          severity: "danger",
          category: "credit",

          title:
            `${categoryLabels[key]} 부족`,

          message:
            `${categoryLabels[key]} 기준이 부족합니다. 현재 ${category.currentSubjects}과목/${category.currentCredits}학점, 부족 ${category.remainingSubjects ?? 0}과목/${category.remainingCredits ?? 0}학점입니다.`,

          details: {
            currentSubjects:
              category.currentSubjects,

            currentCredits:
              category.currentCredits,

            remainingSubjects:
              category.remainingSubjects,

            remainingCredits:
              category.remainingCredits,
          },
        });
      }
    }
  }

  /**
   * 실습 점검
   *
   * 사회복지 과정이거나
   * 등록 과목 중 실습 과목이 있을 때만 검사한다.
   */
  const courseName =
    String(
      (student as any).course ||
      ""
    ).trim();

  const requiresPractice =
    /사회복지/.test(
      courseName
    ) ||
    subjects.some(
      (subject) =>
        /실습/.test(
          subject.subjectName
        )
    );

  const practiceRows =
    (practiceRequests ||
      []) as any[];

  if (
    requiresPractice &&
    practiceRows.length === 0
  ) {
    pushIssue(issues, {
      code:
        "PRACTICE_REQUEST_MISSING",

      severity: "warning",
      category: "practice",

      title: "실습 요청 미등록",
      message:
        "실습이 필요한 과정이지만 실습배정지원센터 요청이 없습니다.",
    });
  }

  if (
    requiresPractice &&
    practiceRows.length > 0
  ) {
    const completed =
      practiceRows.some(
        (row: any) =>
          String(
            row.coordinationStatus ||
            ""
          ).trim() ===
          "섭외완료"
      );

    if (!completed) {
      pushIssue(issues, {
        code:
          "PRACTICE_NOT_COMPLETED",

        severity: "warning",
        category: "practice",

        title: "실습 미섭외",
        message:
          "실습 요청은 등록되어 있지만 섭외완료 상태가 아닙니다.",

        details: {
          practiceRequestCount:
            practiceRows.length,
        },
      });
    }
  }

  const dangerCount =
    issues.filter(
      (issue) =>
        issue.severity ===
        "danger"
    ).length;

  const warningCount =
    issues.filter(
      (issue) =>
        issue.severity ===
        "warning"
    ).length;

  const infoCount =
    issues.filter(
      (issue) =>
        issue.severity ===
        "info"
    ).length;

  const riskScore =
    buildRiskScore(issues);

  const riskLevel =
    dangerCount > 0
      ? "danger"
      : warningCount > 0
        ? "warning"
        : "normal";

  return {
    student: {
      id:
        Number(
          (student as any).id
        ),

      clientName:
        (student as any)
          .clientName ?? null,

      course:
        (student as any).course ??
        null,

      status:
        (student as any).status ??
        null,

      assigneeId:
        Number(
          (student as any)
            .assigneeId || 0
        ) || null,
    },

    summary: {
      riskLevel,
      riskScore,

      totalIssueCount:
        issues.length,

      dangerCount,
      warningCount,
      infoCount,

   totalSubjectCount:
  validRecognizedSubjects.length,

registeredSubjectCount:
  subjects.length,

      currentCredits,
      requiredCredits,
      remainingCredits,

      duplicateSubjectCount,

      practiceRequestCount:
        practiceRows.length,
    },

payment: {
  status:
    paymentStatus,

  hasSettlementData,

  totalPaid:
    hasSettlementData
      ? registrationTotalPaid
      : studentPaymentAmount,

  totalRefund:
    hasSettlementData
      ? registrationTotalRefund
      : 0,

  netPaymentAmount:
    effectivePaymentAmount,

  paymentDate:
    effectivePaymentDate,
},

    categories,
    issues,
    subjects,

    sourceStatus: {
      hasPlan:
        Boolean(plan),

      hasCreditRule:
        Boolean(creditRule),

      hasTransferSubjects:
        Boolean(
          transferSubjects?.length
        ),

      hasExtraCreditItems:
        Boolean(
          extraItems?.length
        ),

      hasPracticeRequest:
        practiceRows.length > 0,
    },
  };
}

function normalizeStudentRiskScanLimit(
  value: unknown
) {
  const normalized =
    Number(value);

  if (
    !Number.isFinite(normalized) ||
    normalized <= 0
  ) {
    return 30;
  }

  return Math.min(
    Math.floor(normalized),
    100
  );
}

function normalizeStudentRiskLevelFilter(
  value: unknown
):
  | "all"
  | "danger"
  | "warning" {
  if (value === "danger") {
    return "danger";
  }

  if (value === "warning") {
    return "warning";
  }

  return "all";
}

function matchesStudentRiskLevel(params: {
  riskLevel:
    | "normal"
    | "warning"
    | "danger";

  filter:
    | "all"
    | "danger"
    | "warning";
}) {
  if (params.filter === "all") {
    return true;
  }

  if (params.filter === "danger") {
    return (
      params.riskLevel ===
      "danger"
    );
  }

  /**
   * warning 필터는
   * 주의 이상 학생을 의미한다.
   */
  return (
    params.riskLevel ===
      "danger" ||
    params.riskLevel ===
      "warning"
  );
}

function getRiskLevelPriority(
  riskLevel:
    | "normal"
    | "warning"
    | "danger"
) {
  if (riskLevel === "danger") {
    return 3;
  }

  if (riskLevel === "warning") {
    return 2;
  }

  return 1;
}

function hasIssueCode(
  issues: StudentRiskItem[],
  predicate: (
    code: string,
    issue: StudentRiskItem
  ) => boolean
) {
  return issues.some(
    (issue) =>
      predicate(
        String(issue.code || ""),
        issue
      )
  );
}

/**
 * 배열을 일정 크기로 나눈다.
 *
 * 전체 학생을 동시에 분석하면
 * DB 연결과 서버 부하가 급증할 수 있으므로
 * 소규모 배치로 실행한다.
 */
function chunkRows<T>(
  rows: T[],
  size: number
) {
  const chunks: T[][] = [];

  for (
    let index = 0;
    index < rows.length;
    index += size
  ) {
    chunks.push(
      rows.slice(
        index,
        index + size
      )
    );
  }

  return chunks;
}

/**
 * 현재 사용자의 권한 범위 내 학생 전체 위험 점검
 *
 * staff:
 * 본인 담당 학생
 *
 * admin:
 * 같은 팀 담당자 학생
 *
 * host:
 * 회사 전체 학생
 *
 * superhost:
 * 선택한 회사 전체 학생
 */
export async function analyzeStudentListRisk(
  params: {
    context: AiUserContext;
    limit?: number;
    riskLevel?:
      | "all"
      | "danger"
      | "warning";
  }
): Promise<StudentListRiskToolOutput> {
  const limit =
    normalizeStudentRiskScanLimit(
      params.limit
    );

  const riskLevelFilter =
    normalizeStudentRiskLevelFilter(
      params.riskLevel
    );

  const organizationId =
    Number(
      params.context.organizationId
    );

  if (
    !Number.isFinite(
      organizationId
    ) ||
    organizationId <= 0
  ) {
    throw new Error(
      "AI 점검 대상 회사가 지정되지 않았습니다."
    );
  }

  /**
   * null:
   * 회사 전체
   *
   * number[]:
   * staff 본인 또는 admin 팀 범위
   */
  const assigneeIds =
    params.context
      .allowedAssigneeIds === null
      ? undefined
      : params.context
          .allowedAssigneeIds;

  const allStudents =
    await db.listStudents(
      assigneeIds,
      {
        organizationId,
      }
    );

  const scopedStudents =
    (
      allStudents || []
    ) as any[];

  /**
   * 우선 최대 limit명만 실제 상세 분석한다.
   *
   * 1차 버전에서 전체 수천 명을 한 요청으로
   * 분석해 서버가 장시간 점유되는 것을 방지한다.
   */
  const targetStudents =
    scopedStudents.slice(
      0,
      limit
    );

  const results:
    StudentListRiskToolOutput["students"] =
      [];

  const failures:
    StudentListRiskToolOutput["failures"] =
      [];

  /**
   * 한 번에 5명씩만 병렬 분석한다.
   *
   * 학생 한 명 분석이 여러 DB 조회를 수행하므로
   * 무제한 Promise.all은 사용하지 않는다.
   */
  const studentChunks =
    chunkRows(
      targetStudents,
      5
    );

  for (
    const studentChunk of
    studentChunks
  ) {
    const chunkResults =
      await Promise.all(
        studentChunk.map(
          async (
            student: any
          ) => {
            const studentId =
              Number(
                student.id || 0
              );

            try {
              const detail =
                await analyzeStudentDetailRisk({
                  context:
                    params.context,

                  studentId,
                });

              return {
                success:
                  true as const,

                student,
                detail,
              };
            } catch (error) {
              return {
                success:
                  false as const,

                student,

                message:
                  error instanceof Error
                    ? error.message
                    : String(error),
              };
            }
          }
        )
      );

    for (
      const chunkResult of
      chunkResults
    ) {
      if (
        !chunkResult.success
      ) {
        failures.push({
          studentId:
            Number(
              chunkResult.student
                ?.id || 0
            ),

          clientName:
            chunkResult.student
              ?.clientName ??
            null,

          message:
            chunkResult.message,
        });

        continue;
      }

      const detail =
        chunkResult.detail;

      results.push({
        studentId:
          detail.student.id,

        clientName:
          detail.student
            .clientName,

        course:
          detail.student.course,

        status:
          detail.student.status,

        assigneeId:
          detail.student
            .assigneeId,

        /**
         * listStudents 결과에 담당자명이 있으면 사용하고
         * 없으면 null로 반환한다.
         */
        assigneeName:
          chunkResult.student
            ?.assigneeName ??
          chunkResult.student
            ?.userName ??
          null,

        riskLevel:
          detail.summary
            .riskLevel,

        riskScore:
          detail.summary
            .riskScore,

        totalIssueCount:
          detail.summary
            .totalIssueCount,

        dangerCount:
          detail.summary
            .dangerCount,

        warningCount:
          detail.summary
            .warningCount,

        infoCount:
          detail.summary
            .infoCount,

        currentCredits:
          detail.summary
            .currentCredits,

        requiredCredits:
          detail.summary
            .requiredCredits,

        remainingCredits:
          detail.summary
            .remainingCredits,

        duplicateSubjectCount:
          detail.summary
            .duplicateSubjectCount,

        practiceRequestCount:
          detail.summary
            .practiceRequestCount,

paymentStatus:
  detail.payment.status,

netPaymentAmount:
  detail.payment
    .netPaymentAmount,

        issues:
          detail.issues,
      });
    }
  }

  /**
   * 전체 집계는 위험등급 필터 적용 전 결과를 기준으로 한다.
   *
   * 그래야 "위험 학생만 보여줘"라고 요청해도
   * 전체 점검 현황 숫자는 유지된다.
   */
  const dangerStudentCount =
    results.filter(
      (student) =>
        student.riskLevel ===
        "danger"
    ).length;

  const warningStudentCount =
    results.filter(
      (student) =>
        student.riskLevel ===
        "warning"
    ).length;

  const normalStudentCount =
    results.filter(
      (student) =>
        student.riskLevel ===
        "normal"
    ).length;

  const totalIssueCount =
    results.reduce(
      (sum, student) =>
        sum +
        student.totalIssueCount,
      0
    );

  const creditShortageStudentCount =
    results.filter(
      (student) =>
        hasIssueCode(
          student.issues,
          (code) =>
            code ===
              "TOTAL_CREDIT_SHORTAGE" ||
            code.startsWith(
              "CATEGORY_SHORTAGE_"
            )
        )
    ).length;

  const duplicateSubjectStudentCount =
    results.filter(
      (student) =>
        hasIssueCode(
          student.issues,
          (code) =>
            code.startsWith(
              "DUPLICATE_SUBJECT_"
            )
        )
    ).length;

  const practiceIssueStudentCount =
    results.filter(
      (student) =>
        hasIssueCode(
          student.issues,
          (code, issue) =>
            code.startsWith(
              "PRACTICE_"
            ) ||
            issue.category ===
              "practice"
        )
    ).length;

  const missingCreditRuleStudentCount =
    results.filter(
      (student) =>
        hasIssueCode(
          student.issues,
          (code) =>
            code ===
            "CREDIT_RULE_MISSING"
        )
    ).length;

  const missingPlanStudentCount =
    results.filter(
      (student) =>
        hasIssueCode(
          student.issues,
          (code) =>
            code ===
              "PLAN_MISSING" ||
            code ===
              "PLAN_SUBJECTS_MISSING"
        )
    ).length;

  const paymentIssueStudentCount =
    results.filter(
      (student) =>
        hasIssueCode(
          student.issues,
          (code, issue) =>
            code.startsWith(
              "PAYMENT_"
            ) ||
            issue.category ===
              "payment"
        )
    ).length;

const paidStudentCount =
  results.filter(
    (student) =>
      student.paymentStatus ===
      "paid"
  ).length;

const paymentMissingStudentCount =
  results.filter(
    (student) =>
      student.paymentStatus ===
      "missing"
  ).length;

const paymentNotConfirmedStudentCount =
  results.filter(
    (student) =>
      student.paymentStatus ===
      "not_confirmed"
  ).length;

const partialRefundStudentCount =
  results.filter(
    (student) =>
      student.paymentStatus ===
      "partial_refund"
  ).length;

const fullRefundStudentCount =
  results.filter(
    (student) =>
      student.paymentStatus ===
      "full_refund"
  ).length;

const refundWithoutPaymentStudentCount =
  results.filter(
    (student) =>
      student.paymentStatus ===
      "refund_without_payment"
  ).length;

const totalNetPaymentAmount =
  results.reduce(
    (sum, student) =>
      sum +
      Math.max(
        toNumber(
          student.netPaymentAmount
        ),
        0
      ),
    0
  );

  const filteredStudents =
    results
      .filter(
        (student) =>
          matchesStudentRiskLevel({
            riskLevel:
              student.riskLevel,

            filter:
              riskLevelFilter,
          })
      )
      .sort((a, b) => {
        const levelDifference =
          getRiskLevelPriority(
            b.riskLevel
          ) -
          getRiskLevelPriority(
            a.riskLevel
          );

        if (
          levelDifference !== 0
        ) {
          return levelDifference;
        }

        const scoreDifference =
          b.riskScore -
          a.riskScore;

        if (
          scoreDifference !== 0
        ) {
          return scoreDifference;
        }

        return (
          b.totalIssueCount -
          a.totalIssueCount
        );
      });

  return {
    summary: {
  totalStudentCount:
    scopedStudents.length,

  checkedStudentCount:
    results.length,

  failedStudentCount:
    failures.length,

  dangerStudentCount,
  warningStudentCount,
  normalStudentCount,

  totalIssueCount,

  creditShortageStudentCount,
  duplicateSubjectStudentCount,
  practiceIssueStudentCount,
  missingCreditRuleStudentCount,
  missingPlanStudentCount,
  paymentIssueStudentCount,

  paidStudentCount,
  paymentMissingStudentCount,
  paymentNotConfirmedStudentCount,
  partialRefundStudentCount,
  fullRefundStudentCount,
  refundWithoutPaymentStudentCount,

  totalNetPaymentAmount,
},

    filter: {
      limit,
      riskLevel:
        riskLevelFilter,
    },

    students:
      filteredStudents,

    failures,
  };
}