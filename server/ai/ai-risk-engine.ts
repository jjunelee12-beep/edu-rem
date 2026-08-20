import * as db from "../db";

import {
  assertCanAccessStudent,
} from "./ai-permission";

import {
  getConfirmedSubjectEquivalenceKey,
} from "./risk-rules/subject-equivalence-resolver";

import {
  buildRiskSubjectRecommendations,
} from "./risk-rules/risk-subject-recommendation";

import {
  analyzeQualificationRisk,
  resolveQualificationRiskCourseKey,
} from "./risk-rules/qualification-risk-analyzer";

import {
  resolveDegreeRequirement,
} from "./risk-rules/degree-requirement-resolver";

import {
  analyzeDegreeCredits,
} from "./risk-rules/degree-credit-analyzer";

import {
  resolveSocialWorkerLaw,
} from "./risk-rules/social-worker-law-resolver";

import {
  mergeQualificationRequirements,
} from "./risk-rules/qualification-requirement-merger";

import {
  planQualificationSubjects,
} from "./risk-rules/qualification-subject-planner";

import {
  planQualificationSemesters,
} from "./risk-rules/qualification-semester-planner";

import {
  planAdministrativeTimeline,
} from "./risk-rules/administrative-timeline-planner";

import {
  resolveStudentAcademicSummary,
} from "./risk-rules/student-academic-summary-resolver";

import {
  resolveNileRecognizedSubjects,
} from "../nile/nile-recognized-subject-resolver";

import type {
  AiUserContext,
  StudentDetailRiskToolOutput,
  StudentListRiskToolOutput,
  StudentRiskItem,
  StudentRiskSubjectItem,
} from "./ai.types";

/**
 * 학생 상세 위험도 분석 진입 방식.
 *
 * crm:
 * 기존 EduCanvas 업무비서 직원 권한
 *
 * verified_student:
 * 카카오 AI에서 이름 + 연락처 인증을 거쳐
 * 서버가 확정한 "본인 학생 ID" 접근
 *
 * 중요:
 * 카카오 학생을 가짜 staff / host로 만들지 않는다.
 */
type StudentDetailRiskAccess =
  | {
      type: "crm";
      context: AiUserContext;
    }
  | {
      type: "verified_student";
      organizationId: number;
      verifiedStudentId: number;
    };

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

function normalizeSubjectCatalogName(
  value:
    unknown
) {
  return String(
    value ??
    ""
  )
    .trim()
    .replace(
      /\s+/g,
      ""
    )
    .replace(
      /[()（）[\]·ㆍ.,_-]/g,
      ""
    )
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
  getConfirmedSubjectEquivalenceKey(
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
  const categoryCounts =
    new Map<
      string,
      number
    >();

  let score =
    0;

  for (
    const issue
    of issues
  ) {
    const category =
      String(
        issue.category ||
        "unknown"
      );

    const previousCount =
      categoryCounts.get(
        category
      ) || 0;

    categoryCounts.set(
      category,
      previousCount + 1
    );

    let baseScore =
      issue.severity ===
        "danger"
        ? 20
        : issue.severity ===
            "warning"
          ? 10
          : 2;

    /**
     * 같은 카테고리에서 여러 문제가 연속 발생하면
     * 첫 번째 문제는 전체 가중치,
     * 두 번째부터는 절반만 반영한다.
     *
     * 예:
     * credit danger 3건
     * 기존 60점
     * 변경 20 + 10 + 10 = 40점
     */
    if (
      previousCount >
      0
    ) {
      baseScore =
        Math.ceil(
          baseScore *
          0.5
        );
    }

    score +=
      baseScore;
  }

  /**
   * 위험도 점수는
   * UI 및 AI 설명을 위해
   * 0~100 범위로 제한한다.
   */
  return Math.min(
    Math.max(
      score,
      0
    ),
    100
  );
}

async function analyzeStudentDetailRiskInternal(
  params: {
    access:
      StudentDetailRiskAccess;

    studentId:
      number;
  }
): Promise<StudentDetailRiskToolOutput> {
  const studentId =
    Number(
      params.studentId
    );

  if (
    !Number.isFinite(
      studentId
    ) ||
    studentId <=
      0
  ) {
    throw new Error(
      "올바른 학생 ID가 필요합니다."
    );
  }

  const organizationId =
    params.access.type ===
    "crm"
      ? Number(
          params.access
            .context
            .organizationId
        )
      : Number(
          params.access
            .organizationId
        );

  if (
    !Number.isFinite(
      organizationId
    ) ||
    organizationId <=
      0
  ) {
    throw new Error(
      "학생 회사 정보가 올바르지 않습니다."
    );
  }

  /**
   * 카카오 등록회원 접근은
   * 최초 인증에서 서버가 확정한
   * studentId와 현재 분석 대상 studentId가
   * 반드시 동일해야 한다.
   *
   * 사용자 메시지나 모델이 제시한
   * 다른 studentId는 절대 허용하지 않는다.
   */
  if (
    params.access.type ===
      "verified_student" &&
    Number(
      params.access
        .verifiedStudentId
    ) !==
      studentId
  ) {
    throw new Error(
      "인증된 본인의 학생 정보만 조회할 수 있습니다."
    );
  }

  /**
   * 항상 studentId + organizationId로
   * 학생을 다시 조회한다.
   */
  const student =
    await db.getStudentById(
      studentId,
      {
        organizationId,
      }
    );

  if (
    !student
  ) {
    throw new Error(
      "학생 정보를 찾을 수 없습니다."
    );
  }

  /**
   * CRM 업무비서는 기존 직원 권한체계를
   * 그대로 사용한다.
   */
  if (
    params.access.type ===
    "crm"
  ) {
    assertCanAccessStudent({
      context:
        params.access.context,

      student,
    });
  }

  /**
   * 카카오 등록회원은
   * 직원 권한을 흉내내지 않는다.
   *
   * 이름 + 연락처 인증으로 서버에서 확정된
   * 본인의 studentId와 organizationId만 사용한다.
   */
  if (
    params.access.type ===
    "verified_student"
  ) {
    if (
      Number(
        (student as any)
          .organizationId ||
        0
      ) !==
      organizationId
    ) {
      throw new Error(
        "등록회원 회사정보가 일치하지 않습니다."
      );
    }

    if (
      String(
        (student as any)
          .approvalStatus ||
        ""
      ).trim() !==
      "승인"
    ) {
      throw new Error(
        "등록회원 승인 상태를 확인할 수 없습니다."
      );
    }
  }

  const [
  plan,
  planSemesters,
  studentSemesters,
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

  /**
   * 실제 학생 학기 데이터.
   *
   * semesterLabel과 기존 연간 과목 수를
   * 자동 학기배치 계산에 사용한다.
   */
  db.listSemesters(
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
      getConfirmedSubjectEquivalenceKey(
        subject.subjectName
      ) ===
      getConfirmedSubjectEquivalenceKey(
        rows[0].subjectName
      )
  );

    pushIssue(issues, {
      code:
  `DUPLICATE_SUBJECT_${getConfirmedSubjectEquivalenceKey(
    rows[0].subjectName
  )}`,

      severity: "danger",
      category: "subject",

      title: "중복 과목 확인",

      message:
  `'${rows
    .map(
      (row) =>
        row.subjectName
    )
    .join(
      "', '"
    )}' 과목이 동일 또는 공식 동일교과목으로 확인되었습니다. ${recognizedSubject?.sourceLabel || "첫 번째 항목"} 1건만 인정하고 나머지는 중복에서 제외했습니다. 등록 위치: ${sourceLabels}`,

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

/**
 * 여기서 creditRule 전용 else 블록을 종료한다.
 *
 * 이후 자격요건 / 학위요건 / 과목설계 /
 * 학기설계 / 행정절차 / 실습 위험도 분석은
 * creditRule 존재 여부와 관계없이 실행되어야 한다.
 */
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

const categoryRequirementTypes:
  Record<
    RequirementKey,
    "전공필수" |
    "전공선택" |
    "교양" |
    "일반"
  > = {
  majorRequired:
    "전공필수",

  majorElective:
    "전공선택",

  liberal:
    "교양",

  general:
    "일반",
};

const riskCourseName =
  String(
    (student as any).course ||
    (plan as any)?.desiredCourse ||
    ""
  ).trim();

const normalizedRiskCourseName =
  normalizeSubjectCatalogName(
    riskCourseName
  );

let riskMasterItems:
  any[] = [];

let riskMatchedCatalog:
  any =
    null;

if (
  normalizedRiskCourseName
) {
  const riskCatalogs =
    await db.listSubjectCatalogs({
      organizationId,
      activeOnly:
        true,
    });

  riskMatchedCatalog =
    (
      riskCatalogs ||
      []
    ).find(
      (
        catalog:
          any
      ) =>
        normalizeSubjectCatalogName(
          catalog?.name
        ) ===
        normalizedRiskCourseName
    ) ||
    null;

  if (
    riskMatchedCatalog
  ) {
    riskMasterItems =
      await db.listSubjectCatalogItems({
        organizationId,

        catalogId:
          Number(
            riskMatchedCatalog.id
          ),

        activeOnly:
          true,
      });
  }
}

const qualificationAnalysisCourseKey =
  resolveQualificationRiskCourseKey(
    riskCourseName
  );

/**
 * 학위 부족학점 채움용 실제 과정 템플릿.
 *
 * 회사별 course_subject_templates만 사용한다.
 */
const degreeSubjectTemplates =
  qualificationAnalysisCourseKey !==
    "unknown"
    ? await db.listCourseSubjectTemplates(
        qualificationAnalysisCourseKey,
        {
          organizationId,
        }
      )
    : [];

const degreeRequirement =
  resolveDegreeRequirement({
    courseKey:
      qualificationAnalysisCourseKey,

    finalEducation:
      (student as any)
        .finalEducation ??
      (plan as any)
        ?.finalEducation ??
      null,
  });

/**
 * 학위학점 계산용 인정과목.
 *
 * 자격증 인정과목 판정과 학위 학점영역 판정을 분리한다.
 *
 * - 자격증 분석:
 *   기존 validRecognizedSubjects 사용
 *
 * - 학위 분석:
 *   NILE 공식 표준교육과정 기준으로
 *   전공 / 교양 / 일반 영역을 다시 판정한 결과 사용
 *
 * NILE Master가 없거나 현재 과정에서
 * 공식 재분류를 수행할 수 없는 경우에는
 * 기존 인정과목을 그대로 사용한다.
 */
const nileRecognition =
  await resolveNileRecognizedSubjects({
    courseKey:
      qualificationAnalysisCourseKey,

    degreeRequirement,

    subjects:
      validRecognizedSubjects.map(
        (
          subject
        ) => ({
          subjectName:
            subject.subjectName,

          requirementType:
            subject.requirementType ??
            null,

          category:
            subject.category ??
            null,

          credits:
            subject.credits,

          source:
            subject.source,
        })
      ),
  });

const degreeRecognizedSubjects =
  nileRecognition.canResolve
    ? nileRecognition.subjects
    : validRecognizedSubjects.map(
        (
          subject
        ) => ({
          subjectName:
            subject.subjectName,

          requirementType:
            subject.requirementType ??
            null,

          category:
            subject.category ??
            null,

          credits:
            subject.credits,

          source:
            subject.source,
        })
      );

/**
 * 학위 추가과목 추천 및 Planner에서 사용할
 * NILE 공식 학위영역 분류 Map.
 *
 * 중요:
 *
 * riskMasterItems의 기존 requirementType/category는
 * 자격증 판정을 위한 회사 Qualification Master이므로
 * 절대로 직접 덮어쓰지 않는다.
 *
 * degreeSubjectTemplates 역시 DB 원본을 변경하지 않고
 * 학위계산용 복사본만 NILE 기준으로 재분류한다.
 */
const degreePlanningCandidateMap =
  new Map<
    string,
    {
      subjectName:
        string;

      requirementType:
        string | null;

      category:
        string | null;

      credits:
        number;

      source:
        "plan";
    }
  >();

for (
  const item
  of [
    ...(
      riskMasterItems ||
      []
    ),

    ...(
      degreeSubjectTemplates ||
      []
    ),
  ]
) {
  const subjectName =
    String(
      item?.subjectName ||
      ""
    ).trim();

  if (!subjectName) {
    continue;
  }

  const key =
    getConfirmedSubjectEquivalenceKey(
      subjectName
    );

  if (
    !key ||
    degreePlanningCandidateMap.has(
      key
    )
  ) {
    continue;
  }

  degreePlanningCandidateMap.set(
    key,
    {
      subjectName,

      requirementType:
        item?.requirementType ??
        null,

      category:
        item?.category ??
        null,

      /**
       * 현재 CRM 과목마스터 및
       * course_subject_templates는
       * 이론과목을 3학점 단위로 운용한다.
       *
       * 이 값은 NILE 학습구분 판정 입력용이며
       * 실제 기존 이수학점 계산에는 사용하지 않는다.
       */
      credits:
        3,

      source:
        "plan",
    }
  );
}

const nileDegreePlanningRecognition =
  await resolveNileRecognizedSubjects({
    courseKey:
      qualificationAnalysisCourseKey,

    degreeRequirement,

    subjects:
      Array.from(
        degreePlanningCandidateMap
          .values()
      ),
  });

const degreeClassificationBySubjectKey =
  new Map<
    string,
    {
      category:
        | "전공"
        | "교양"
        | "일반";

      requirementType:
        | "전공필수"
        | "전공선택"
        | "교양"
        | "일반";
    }
  >();

if (
  nileDegreePlanningRecognition
    .canResolve
) {
  for (
    const subject
    of nileDegreePlanningRecognition
      .subjects
  ) {
    const key =
      getConfirmedSubjectEquivalenceKey(
        subject.subjectName
      );

    if (!key) {
      continue;
    }

    if (
      subject.category !==
        "전공" &&
      subject.category !==
        "교양" &&
      subject.category !==
        "일반"
    ) {
      continue;
    }

    if (
      subject.requirementType !==
        "전공필수" &&
      subject.requirementType !==
        "전공선택" &&
      subject.requirementType !==
        "교양" &&
      subject.requirementType !==
        "일반"
    ) {
      continue;
    }

    degreeClassificationBySubjectKey.set(
      key,
      {
        category:
          subject.category,

        requirementType:
          subject.requirementType,
      }
    );
  }
}

const degreeCreditAnalysis =
  analyzeDegreeCredits({
    degreeRequirement,

    recognizedSubjects:
      degreeRecognizedSubjects,
  });

const degreeMajorRecommendationItems =
  riskMasterItems.filter(
    (
      item:
        any
    ) => {
      const subjectKey =
        getConfirmedSubjectEquivalenceKey(
          String(
            item?.subjectName ||
            ""
          ).trim()
        );

      const classification =
        subjectKey
          ? degreeClassificationBySubjectKey
              .get(
                subjectKey
              ) ??
            null
          : null;

      return (
        classification
          ?.requirementType ===
          "전공필수" ||
        classification
          ?.requirementType ===
          "전공선택" ||
        classification
          ?.category ===
          "전공"
      );
    }
  );

const degreeLiberalRecommendationItems =
  riskMasterItems.filter(
    (
      item:
        any
    ) => {
      const subjectKey =
        getConfirmedSubjectEquivalenceKey(
          String(
            item?.subjectName ||
            ""
          ).trim()
        );

      const classification =
        subjectKey
          ? degreeClassificationBySubjectKey
              .get(
                subjectKey
              ) ??
            null
          : null;

      return (
        classification
          ?.requirementType ===
          "교양" ||
        classification
          ?.category ===
          "교양"
      );
    }
  );

const degreeMajorRecommendations =
  buildRiskSubjectRecommendations({
    masterItems:
      degreeMajorRecommendationItems,

    existingSubjects:
      validRecognizedSubjects.map(
        (
          subject
        ) => ({
          subjectName:
            subject.subjectName,

          credits:
            subject.credits,

          source:
            subject.source,
        })
      ),

    requiredCredits:
      Number(
        degreeCreditAnalysis
          .summary
          .remainingMajorCredits ||
        0
      ),

    limit:
      10,
  });


const degreeLiberalRecommendations =
  buildRiskSubjectRecommendations({
    masterItems:
      degreeLiberalRecommendationItems,

    existingSubjects:
      validRecognizedSubjects.map(
        (
          subject
        ) => ({
          subjectName:
            subject.subjectName,

          credits:
            subject.credits,

          source:
            subject.source,
        })
      ),

    requiredCredits:
      Number(
        degreeCreditAnalysis
          .summary
          .remainingLiberalCredits ||
        0
      ),

    limit:
      10,
  });


const degreeRequiredMajorCredits =
  Number(
    degreeCreditAnalysis
      .summary
      .remainingMajorCredits ||
    0
  );


const degreeRequiredLiberalCredits =
  Number(
    degreeCreditAnalysis
      .summary
      .remainingLiberalCredits ||
    0
  );


const degreeRequiredTotalCredits =
  Number(
    degreeCreditAnalysis
      .summary
      .remainingTotalCredits ||
    0
  );


/**
 * 총학점 부족분에서
 * 전공/교양 최소요건을 먼저 채우고도
 * 남는 학점만 잔여 추천 대상으로 본다.
 */
const degreeResidualTotalCredits =
  Math.max(
    degreeRequiredTotalCredits -
      degreeRequiredMajorCredits -
      degreeRequiredLiberalCredits,
    0
  );


/**
 * 전공/교양 최소요건을 충족한 뒤
 * 총학점만 추가로 필요한 경우 사용할 후보.
 *
 * NILE에서 실제 학위영역 판정이 완료된
 * 과목만 후보로 사용할 수 있다.
 *
 * 전공 / 교양 / 일반 모두
 * 총학점 채움에는 사용할 수 있다.
 */
const degreeResidualRecommendationItems =
  riskMasterItems.filter(
    (
      item:
        any
    ) => {
      const subjectKey =
        getConfirmedSubjectEquivalenceKey(
          String(
            item?.subjectName ||
            ""
          ).trim()
        );

      if (!subjectKey) {
        return false;
      }

      return (
        degreeClassificationBySubjectKey
          .has(
            subjectKey
          )
      );
    }
  );


const degreeResidualRecommendations =
  buildRiskSubjectRecommendations({
    masterItems:
      degreeResidualRecommendationItems,

    existingSubjects: [
      ...validRecognizedSubjects.map(
        (
          subject
        ) => ({
          subjectName:
            subject.subjectName,

          credits:
            subject.credits,

          source:
            subject.source,
        })
      ),

      ...degreeMajorRecommendations.map(
        (
          subject
        ) => ({
          subjectName:
            subject.subjectName,

          credits:
            subject.credits,

          source:
            "plan" as const,
        })
      ),

      ...degreeLiberalRecommendations.map(
        (
          subject
        ) => ({
          subjectName:
            subject.subjectName,

          credits:
            subject.credits,

          source:
            "plan" as const,
        })
      ),
    ],

    requiredCredits:
      degreeResidualTotalCredits,

    limit:
      10,
  });

/**
 * ─────────────────────────────
 * 사회복지사 2급 구법/신법 자동 판정
 * ─────────────────────────────
 *
 * 우선순위:
 *
 * 1. 담당자가 수동으로 확정한 값
 * 2. 전적대 사회복지 인정과목의 이수연도
 * 3. 불명확하면 review_required
 *
 * 사회복지 과정이 아니면 null.
 */
const socialWorkerLawResolution =
  qualificationAnalysisCourseKey ===
    "social_worker_2"
    ? resolveSocialWorkerLaw({
        masterItems:
          riskMasterItems,

        transferSubjects:
          transferSubjects ||
          [],

        manualLawVersion:
          (student as any)
            .socialWorkerLawVersion ??
          undefined,
      })
    : null;

const qualificationAnalysis =
  analyzeQualificationRisk({
    courseName:
      riskCourseName,

    masterItems:
      riskMasterItems,

    recognizedSubjects:
      validRecognizedSubjects.map(
        (
          subject
        ) => ({
          subjectName:
            subject.subjectName,

          requirementType:
            subject.requirementType ??
            null,

          category:
            subject.category ??
            null,

          credits:
            subject.credits,

          source:
            subject.source,
        })
      ),

        /**
     * 사회복지사 2급 적용기준.
     *
     * 1. 담당자가 직접 확정한 값이 있으면 우선
     * 2. 없으면 전적대 사회복지 인정과목의
     *    실제 이수연도로 자동 판정
     * 3. 연도 불명확 시 undefined를 전달하여
     *    자격요건을 임의 확정하지 않는다.
     */
    socialWorkerLawVersion:
      socialWorkerLawResolution
        ?.effectiveLawVersion ??
      undefined,
  });

/**
 * 사회복지 법규 자동판정 근거를
 * qualification summary에 포함한다.
 *
 * 학생 상세 / AI 업무비서 / 향후 카카오 AI가
 * 동일한 근거를 사용할 수 있다.
 */
if (
  qualificationAnalysisCourseKey ===
    "social_worker_2" &&
  socialWorkerLawResolution
) {
  qualificationAnalysis.summary = {
    ...qualificationAnalysis.summary,

    lawResolution: {
      lawVersion:
        socialWorkerLawResolution
          .lawVersion,

      effectiveLawVersion:
        socialWorkerLawResolution
          .effectiveLawVersion,

      source:
        socialWorkerLawResolution
          .source,

      isConfirmed:
        socialWorkerLawResolution
          .isConfirmed,

      requiresReview:
        socialWorkerLawResolution
          .requiresReview,

      message:
        socialWorkerLawResolution
          .message,

      evidenceSubjects:
        socialWorkerLawResolution
          .evidenceSubjects,

      unknownYearSubjects:
        socialWorkerLawResolution
          .unknownYearSubjects,
    },
  };
}

/**
 * ─────────────────────────────
 * 학위요건 + 자격요건 통합
 * ─────────────────────────────
 *
 * 여기서는 과목을 직접 설계하지 않는다.
 *
 * 학생에게 현재 남아 있는
 * 법적 자격조건과 학위조건을
 * 하나의 공통 결과로 정리한다.
 */
const unifiedRequirements =
  mergeQualificationRequirements({
    degreeRequirement,

    degreeCreditAnalysis,

    qualificationAnalysis,
  });

/**
 * ─────────────────────────────
 * 자격/학위 공통 Requirements 기반
 * 실제 필수과목 선택
 * ─────────────────────────────
 *
 * 현재 단계에서는
 * 과정 마스터 안에서 법적으로 필요한
 * 자격과목/영역/전공필수를 선택한다.
 *
 * 교양/일반 학점 채움용 과목은
 * 데이터 근거가 확보될 때까지 생성하지 않는다.
 */
const qualificationSubjectPlan =
  planQualificationSubjects({
    requirements:
      unifiedRequirements,

    masterItems:
      riskMasterItems,

    recognizedSubjects:
      validRecognizedSubjects.map(
        (
          subject
        ) => ({
          subjectName:
            subject.subjectName,

          requirementType:
            subject.requirementType ??
            null,

          category:
            subject.category ??
            null,

          credits:
            subject.credits,

          source:
            subject.source,
        })
      ),

    degreeTemplates:
  degreeSubjectTemplates.map(
    (
      item:
        any
    ) => {
      const subjectName =
        String(
          item.subjectName ||
          ""
        ).trim();

      const subjectKey =
        getConfirmedSubjectEquivalenceKey(
          subjectName
        );

      const nileClassification =
        subjectKey
          ? degreeClassificationBySubjectKey
              .get(
                subjectKey
              ) ??
            null
          : null;

      return {
        id:
          Number(
            item.id ||
            0
          ),

        courseKey:
          String(
            item.courseKey ||
            ""
          ),

        subjectName,

        /**
         * 새 학위과정에서는
         * course_subject_templates에 저장된
         * 기존 회사 분류보다 NILE 공식 분류를 우선한다.
         */
        category:
          nileClassification
            ?.category ??
          item.category,

        requirementType:
          nileClassification
            ?.requirementType ??
          item.requirementType ??
          null,

        sortOrder:
          Number(
            item.sortOrder ||
            0
          ),
      };
    }
  ),

degreeClassificationBySubjectKey,
  });

/**
 * 기존 CRM 학기별 실제 계획과목 학점 합계.
 *
 * planSemesters는 과목 단위 Row이고:
 *
 * - semesterNo
 * - credits
 *
 * 를 가지고 있으므로,
 * 학기 순번별 과목 수 / 학점합계를 만든다.
 *
 * 이 값은 Semester Planner의
 * plannedCredits / actualCredits 계산에 사용한다.
 */
const existingSemesterCreditsByOrder =
  new Map<
    number,
    {
      subjectCount:
        number;

      credits:
        number;
    }
  >();

for (
  const row
  of (
    planSemesters ||
    []
  ) as any[]
) {
  const semesterOrder =
    Math.floor(
      Number(
        row?.semesterNo ||
        0
      )
    );

  const credits =
    toNumber(
      row?.credits
    );

  if (
    semesterOrder <=
      0 ||
    credits <=
      0
  ) {
    continue;
  }

  const previous =
    existingSemesterCreditsByOrder.get(
      semesterOrder
    ) || {
      subjectCount:
        0,

      credits:
        0,
    };

  existingSemesterCreditsByOrder.set(
    semesterOrder,
    {
      subjectCount:
        previous.subjectCount +
        1,

      credits:
        previous.credits +
        credits,
    }
  );
}

/**
 * ─────────────────────────────
 * 실제 과목계획 → 학기 자동배치
 * ─────────────────────────────
 *
 * 수업을 통한 학점은:
 *
 * - 한 학기 최대 24학점
 * - 동일 귀속연도 최대 42학점
 *
 * 기준으로 실제 추가과목을 학기별 배치한다.
 *
 * 기존 학생 학기가 있으면
 * studentSemesters의 학기정보와
 * planSemesters의 실제 과목 credits를 결합해서
 * 기존 수강학점을 계산한다.
 *
 * 기존 학기가 없으면
 * 현재 한국 날짜 기준 귀속학기를
 * 첫 학기로 추정한다.
 */
const qualificationSemesterPlan =
  planQualificationSemesters({
    subjectPlan:
      qualificationSubjectPlan,

        existingSemesters:
      (
        studentSemesters ||
        []
      ).map(
        (
          semester:
            any
        ) => {
          const semesterOrder =
            Number(
              semester
                ?.semesterOrder ||
              0
            );

          const plannedSubjectCount =
            semester
              ?.plannedSubjectCount ??
            null;

          const actualSubjectCount =
            semester
              ?.actualSubjectCount ??
            null;

          const creditSummary =
            existingSemesterCreditsByOrder.get(
              semesterOrder
            );

          /**
           * planSemesters에서 과목이 확인되면
           * 실제 credits 합계를 plannedCredits로 사용한다.
           */
          const plannedCredits =
            creditSummary
              ? creditSummary
                  .credits
              : null;

          /**
           * actualSubjectCount와
           * 실제 과목 Row 개수가 정확히 같을 때만
           * 해당 학점합계를 actualCredits로 확정한다.
           *
           * 개수가 다르면 실제 이수학점이라고
           * 단정하지 않고 null로 둔다.
           *
           * 그 경우 Semester Planner가
           * plannedCredits를 사용한다.
           */
          const actualCredits =
            actualSubjectCount !==
              null &&
            actualSubjectCount !==
              undefined &&
            creditSummary &&
            Number(
              actualSubjectCount
            ) ===
              creditSummary
                .subjectCount
              ? creditSummary
                  .credits
              : null;

          return {
            semesterOrder,

            semesterLabel:
              semester
                ?.semesterLabel ??
              null,

            plannedSubjectCount,

            actualSubjectCount,

            plannedCredits,

            actualCredits,
          };
        }
      ),
  });

/**
 * ─────────────────────────────
 * 학기 자동배치 → 행정절차 최단 일정
 * ─────────────────────────────
 *
 * 최종 수업 귀속학기를 기준으로
 *
 * - 학습자등록
 * - 학점인정신청
 * - 학위신청
 * - 학위수여
 * - 자격증 신청
 *
 * 예상 일정을 공통 계산한다.
 */
const administrativeTimeline =
  planAdministrativeTimeline({
    requirements:
      unifiedRequirements,

    semesterPlan:
      qualificationSemesterPlan,

    existingSemesters:
      (
        studentSemesters ||
        []
      ).map(
        (
          semester:
            any
        ) => ({
          semesterOrder:
            Number(
              semester
                ?.semesterOrder ||
              0
            ),

          semesterLabel:
            semester
              ?.semesterLabel ??
            null,
        })
      ),
  });

/**
 * ─────────────────────────────
 * 학위/자격/과목/학기/행정절차
 * 공통 학업요약
 * ─────────────────────────────
 *
 * AI가 각각의 Rule 결과를
 * 다시 계산하지 않도록
 * 서버 계산결과를 설명용 데이터로 통합한다.
 */
const academicSummary =
  resolveStudentAcademicSummary({
    requirements:
      unifiedRequirements,

    subjectPlan:
      qualificationSubjectPlan,

    semesterPlan:
      qualificationSemesterPlan,

    administrativeTimeline,
  });


/**
 * 사회복지사 인정과목은 존재하지만
 * 이수연도를 확인할 수 없어
 * 법규 적용을 자동 확정할 수 없는 경우.
 */
if (
  qualificationAnalysisCourseKey ===
    "social_worker_2" &&
  socialWorkerLawResolution
    ?.requiresReview
) {
  pushIssue(
    issues,
    {
      code:
        "SOCIAL_WORKER_LAW_REVIEW_REQUIRED",

      severity:
        "danger",

      category:
        "qualification",

      title:
        "사회복지 구법/신법 확인 필요",

      message:
        socialWorkerLawResolution
          .message,

      details: {
  lawVersion:
    socialWorkerLawResolution
      .lawVersion,

  source:
    socialWorkerLawResolution
      .source,

  unknownYearSubjectCount:
    socialWorkerLawResolution
      .unknownYearSubjects
      .length,

  evidenceSubjectCount:
    socialWorkerLawResolution
      .evidenceSubjects
      .length,
},
    }
  );
}

if (
  degreeRequirement
    .finalEducationGroup ===
  "unknown"
) {
  pushIssue(issues, {
    code:
      "DEGREE_FINAL_EDUCATION_UNKNOWN",

    severity:
      "warning",

    category:
      "student",

    title:
      "최종학력 확인 필요",

    message:
      degreeRequirement.reason,

    details: {
      courseKey:
        degreeRequirement.courseKey,

      finalEducation:
        (student as any)
          .finalEducation ??
        (plan as any)
          ?.finalEducation ??
        null,
    },
  });
} else if (
  degreeRequirement
    .requiresNewDegreeTrack
) {
  pushIssue(issues, {
    code:
      `DEGREE_TRACK_REQUIRED_${degreeRequirement.courseKey}`,

    severity:
      "info",

    category:
      "credit",

    title:
      "학위과정 확인",

    message:
      degreeRequirement.reason,

    details: {
      finalEducationGroup:
        degreeRequirement
          .finalEducationGroup,

      minimumDegreeLevel:
        degreeRequirement
          .minimumDegreeLevel,

      requiresDegree:
        degreeRequirement
          .requiresDegree,

      requiresNewDegreeTrack:
        degreeRequirement
          .requiresNewDegreeTrack,

      degreeType:
        degreeRequirement
          .defaultDegreeRule
          ?.degreeType ??
        null,

      totalCredits:
        degreeRequirement
          .defaultDegreeRule
          ?.totalCredits ??
        null,

      majorCredits:
        degreeRequirement
          .defaultDegreeRule
          ?.majorCredits ??
        null,

      liberalCredits:
        degreeRequirement
          .defaultDegreeRule
          ?.liberalCredits ??
        null,
    },
  });
}

for (
  const degreeIssue
  of degreeCreditAnalysis.issues
) {
  const recommendedSubjects =
  degreeIssue.code ===
    "DEGREE_MAJOR_CREDIT_SHORTAGE"
    ? degreeMajorRecommendations
    : degreeIssue.code ===
        "DEGREE_LIBERAL_CREDIT_SHORTAGE"
      ? degreeLiberalRecommendations
      : degreeIssue.code ===
          "DEGREE_TOTAL_CREDIT_SHORTAGE"
        ? degreeResidualRecommendations
        : [];

  pushIssue(issues, {
    code:
      degreeIssue.code,

    severity:
      degreeIssue.severity,

    category:
      "credit",

    title:
      degreeIssue.title,

    message:
      degreeIssue.message,

    details: {
      ...(
        degreeIssue.details ||
        {}
      ),

residualRequiredCredits:
  degreeIssue.code ===
    "DEGREE_TOTAL_CREDIT_SHORTAGE"
    ? degreeResidualTotalCredits
    : null,

      recommendedSubjects:
        recommendedSubjects.map(
          (
            subject
          ) => ({
            masterSubjectId:
              subject.masterSubjectId,

            subjectName:
              subject.subjectName,

            category:
              subject.category,

            requirementType:
              subject.requirementType,

            credits:
              subject.credits,

            semesterNo:
              subject.semesterNo,

            isFaceToFace:
              subject.isFaceToFace,

            reason:
              subject.reason,
          })
        ),
    },
  });
}

for (
  const qualificationIssue
  of qualificationAnalysis.issues
) {
  pushIssue(issues, {
    code:
      qualificationIssue.code,

    severity:
      qualificationIssue.severity,

    category:
      "subject",

    title:
      qualificationIssue.title,

    message:
      qualificationIssue.message,

    details:
      qualificationIssue.details,
  });
}

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

const recommendedSubjects =
  buildRiskSubjectRecommendations({
    masterItems:
      riskMasterItems,

    existingSubjects:
      validRecognizedSubjects.map(
        (
          subject
        ) => ({
          subjectName:
            subject.subjectName,

          credits:
            subject.credits,

          source:
            subject.source,
        })
      ),

    requirementType:
      categoryRequirementTypes[
        key
      ],

    requiredSubjects:
      Number(
        category.remainingSubjects ||
        0
      ),

    requiredCredits:
      Number(
        category.remainingCredits ||
        0
      ),

    limit:
      10,
  });

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

  matchedCatalogId:
    riskMatchedCatalog
      ? Number(
          riskMatchedCatalog.id
        )
      : null,

  matchedCatalogName:
    riskMatchedCatalog
      ? String(
          riskMatchedCatalog.name ||
          ""
        )
      : null,

  recommendedSubjects:
    recommendedSubjects.map(
      (
        subject
      ) => ({
        masterSubjectId:
          subject.masterSubjectId,

        subjectName:
          subject.subjectName,

        category:
          subject.category,

        requirementType:
          subject.requirementType,

        credits:
          subject.credits,

        semesterNo:
          subject.semesterNo,

        isFaceToFace:
          subject.isFaceToFace,

        reason:
          subject.reason,
      })
    ),
},
               });
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

const actualPracticeRequestRows =
  practiceRows.filter(
    (
      row:
        any
    ) =>
      row
        ?.hasPracticeSupportRequest ===
        true ||
      Number(
        row
          ?.practiceSupportRequestId ||
        row?.id ||
        0
      ) > 0
  );

const registeredPracticeHours =
  actualPracticeRequestRows.reduce(
    (
      maxHours,
      row:
        any
    ) =>
      Math.max(
        maxHours,
        toNumber(
          row
            ?.practiceHours
        )
      ),
    0
  );

const expectedSocialWorkerPracticeHours =
  qualificationAnalysisCourseKey ===
    "social_worker_2"
    ? socialWorkerLawResolution
        ?.effectiveLawVersion ===
        "old"
      ? 120
      : socialWorkerLawResolution
            ?.effectiveLawVersion ===
          "current"
        ? 160
        : 0
    : 0;

const hasSocialWorkerPracticeHourMismatch =
  qualificationAnalysisCourseKey ===
    "social_worker_2" &&
  expectedSocialWorkerPracticeHours > 0 &&
  registeredPracticeHours > 0 &&
  expectedSocialWorkerPracticeHours !==
    registeredPracticeHours;

const hasActualPracticeRequest =
  actualPracticeRequestRows.length >
  0;

  if (
  requiresPractice &&
  !hasActualPracticeRequest
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
  hasSocialWorkerPracticeHourMismatch
) {
  pushIssue(issues, {
    code:
      "SOCIAL_WORKER_PRACTICE_HOURS_MISMATCH",

    severity:
      "danger",

    category:
      "practice",

    title:
      "사회복지 실습시간 불일치",

   message:
  `사회복지사 2급 ${
    socialWorkerLawResolution
      ?.effectiveLawVersion ===
    "old"
      ? "구법"
      : "신법"
  } 기준 실습은 ${expectedSocialWorkerPracticeHours}시간이지만 실습배정지원센터 요청에는 ${registeredPracticeHours}시간으로 등록되어 있습니다.`,

    details: {
  expectedPracticeHours:
    expectedSocialWorkerPracticeHours,

  practiceRequestHours:
    registeredPracticeHours,

  lawVersion:
    socialWorkerLawResolution
      ?.effectiveLawVersion ??
    null,
},
  });
}


  if (
  requiresPractice &&
  hasActualPracticeRequest
) {
    const completed =
  actualPracticeRequestRows.some(
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
  actualPracticeRequestRows.length,
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
  actualPracticeRequestRows.length,
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

requirements:
  unifiedRequirements,

subjectPlan:
  qualificationSubjectPlan,

semesterPlan:
  qualificationSemesterPlan,

administrativeTimeline,

academicSummary,

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
  hasActualPracticeRequest,
    },
  };
}

/**
 * 기존 EduCanvas CRM AI용 학생 상세 위험도 분석.
 *
 * 기존 호출부 호환성을 유지한다.
 */
export async function analyzeStudentDetailRisk(
  params: {
    context:
      AiUserContext;

    studentId:
      number;
  }
): Promise<StudentDetailRiskToolOutput> {
  return analyzeStudentDetailRiskInternal({
    access: {
      type:
        "crm",

      context:
        params.context,
    },

    studentId:
      params.studentId,
  });
}

/**
 * 카카오 AI 등록회원 본인용 위험도 / 학습분석.
 *
 * 반드시 이름 + 연락처 인증을 통해
 * 서버가 확정한 studentId만 전달해야 한다.
 *
 * CRM 직원 role을 생성하지 않는다.
 */
export async function analyzeVerifiedStudentDetailRisk(
  params: {
    organizationId:
      number;

    verifiedStudentId:
      number;
  }
): Promise<StudentDetailRiskToolOutput> {
  const organizationId =
    Math.floor(
      Number(
        params.organizationId ||
        0
      )
    );

  const verifiedStudentId =
    Math.floor(
      Number(
        params.verifiedStudentId ||
        0
      )
    );

  if (
    !Number.isFinite(
      organizationId
    ) ||
    organizationId <=
      0
  ) {
    throw new Error(
      "카카오 등록회원 회사 정보가 올바르지 않습니다."
    );
  }

  if (
    !Number.isFinite(
      verifiedStudentId
    ) ||
    verifiedStudentId <=
      0
  ) {
    throw new Error(
      "카카오 등록회원 학생 정보가 올바르지 않습니다."
    );
  }

  return analyzeStudentDetailRiskInternal({
    access: {
      type:
        "verified_student",

      organizationId,

      verifiedStudentId,
    },

    studentId:
      verifiedStudentId,
  });
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
          ) ||
          (
            code.startsWith(
              "DEGREE_"
            ) &&
            code.endsWith(
              "_SHORTAGE"
            )
          ) ||
          (
            code.startsWith(
              "SOCIAL_WORKER_"
            ) &&
            code.endsWith(
              "_SHORTAGE"
            )
          ) ||
          (
            code.startsWith(
              "CHILDCARE_"
            ) &&
            code.endsWith(
              "_SHORTAGE"
            )
          ) ||
          (
            code.startsWith(
              "CHILD_STUDY_"
            ) &&
            code.endsWith(
              "_SHORTAGE"
            )
          ) ||
          (
            code.startsWith(
              "KOREAN_TEACHER_"
            ) &&
            code.endsWith(
              "_SHORTAGE"
            )
          ) ||
          (
            code.startsWith(
              "LIFELONG_EDUCATOR_"
            ) &&
            code.endsWith(
              "_SHORTAGE"
            )
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