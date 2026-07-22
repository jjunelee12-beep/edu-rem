import {
  type ChangeEvent,
  type ClipboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  ImagePlus,
  Loader2,
  Send,
  Sparkles,
  User,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import { Streamdown } from "streamdown";

import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type DashboardAIStudent = {
  id: number;
  clientName?: string | null;
  phone?: string | null;
  course?: string | null;
  status?: string | null;
  institution?: string | null;
  finalEducation?: string | null;
};

export type DashboardAIConsultation = {
  id: number;
  clientName?: string | null;
  phone?: string | null;
  desiredCourse?: string | null;
  status?: string | null;
};

export type DashboardAIStudentSummaryData = {
  studentId?: number;
  id?: number;

  clientName?: string | null;
  name?: string | null;

  phone?: string | null;
  course?: string | null;
  status?: string | null;
  institution?: string | null;
  finalEducation?: string | null;

    semester?: string | null;
  currentSemester?: string | null;

  startDate?: string | null;
  subjectCount?: number | null;
  totalSemesters?: number | null;

  totalCredits?: number;
  earnedCredits?: number;
  plannedCredits?: number;

    paymentStatus?: string | null;
  paymentDate?: string | null;
  paymentAmount?: string | number | null;

  practiceStatus?: string | null;
  approvalStatus?: string | null;

  managerName?: string | null;
  staffName?: string | null;

  riskScore?: number;
  riskLevel?: string | null;

  summary?: string | null;
};

export type DashboardAIStudentRiskIssue = {
  key?: string;
  label: string;
  description?: string | null;
  severity?: "danger" | "warning" | "normal" | string;
};

export type DashboardAIPaymentStatus =
  | "missing"
  | "not_confirmed"
  | "paid"
  | "partial_refund"
  | "full_refund"
  | "refund_without_payment";

export type DashboardAIPaymentData = {
  status?: DashboardAIPaymentStatus | string | null;
  hasSettlementData?: boolean;

  totalPaid?: number;
  totalRefund?: number;
  netPaymentAmount?: number;

  paymentDate?: string | Date | null;
};

export type DashboardAIStudentRiskData = {
  studentId?: number;
  clientName?: string | null;

  course?: string | null;
  studentStatus?: string | null;

  score?: number;

  level?:
    | "danger"
    | "warning"
    | "normal"
    | string;

  status?:
    | "danger"
    | "warning"
    | "normal"
    | string;

  summary?: string | null;

  issues?: DashboardAIStudentRiskIssue[];
  risks?: DashboardAIStudentRiskIssue[];
  warnings?: DashboardAIStudentRiskIssue[];

  payment?: DashboardAIPaymentData;

  totalIssueCount?: number;
  dangerCount?: number;
  warningCount?: number;
  infoCount?: number;

  registeredSubjectCount?: number;
  totalSubjectCount?: number;

  currentCredits?: number;
  requiredCredits?: number | null;
  remainingCredits?: number | null;

  duplicateSubjectCount?: number;
  practiceRequestCount?: number;
};

export type DashboardAIOrganizationRiskItem = {
  studentId?: number;
  id?: number;

  clientName?: string | null;
  name?: string | null;

  score?: number;
  riskScore?: number;

  level?:
    | "danger"
    | "warning"
    | "normal"
    | string;

  riskLevel?:
    | "danger"
    | "warning"
    | "normal"
    | string;

  status?:
    | "danger"
    | "warning"
    | "normal"
    | string;

  summary?: string | null;

  totalIssueCount?: number;

  paymentStatus?:
    DashboardAIPaymentStatus |
    string;

  netPaymentAmount?: number;

  issues?:
    DashboardAIStudentRiskIssue[];
};

export type DashboardAIOrganizationRiskData = {
  total?: number;
  checkedTotal?: number;
  failedTotal?: number;

  danger?: number;
  warning?: number;
  normal?: number;

  dangerCount?: number;
  warningCount?: number;
  normalCount?: number;

  payment?: {
    paidStudentCount?: number;
    paymentMissingStudentCount?: number;
    paymentNotConfirmedStudentCount?: number;
    partialRefundStudentCount?: number;
    fullRefundStudentCount?: number;
    refundWithoutPaymentStudentCount?: number;
    totalNetPaymentAmount?: number;
  };

  counts?: {
    creditShortage?: number;
    duplicate?: number;
    practice?: number;
    payment?: number;
    missingPlan?: number;
    missingRule?: number;
    [key: string]:
      number |
      undefined;
  };

  summary?: {
    total?: number;
    danger?: number;
    warning?: number;
    normal?: number;
    dangerCount?: number;
    warningCount?: number;
    normalCount?: number;
    [key: string]:
      unknown;
  };

  items?:
    DashboardAIOrganizationRiskItem[];

  students?:
    DashboardAIOrganizationRiskItem[];

  results?:
    DashboardAIOrganizationRiskItem[];
};

export type DashboardAIPendingActionPreviewSection = {
  title?: string;

  label?: string;

  description?: string | null;

  items?: unknown[];

  rows?: unknown[];

  data?: unknown;

  [key: string]:
    unknown;
};

export type DashboardAIPendingActionPreviewChange = {
  label?: string;
  before?: unknown;
  after?: unknown;
  description?: string | null;
  [key: string]:
    unknown;
};

export type DashboardAIPendingActionPreview = {
  title?: string;
  summary?: string | null;

  sections?:
    DashboardAIPendingActionPreviewSection[];

  changes?:
    DashboardAIPendingActionPreviewChange[];

  executionSteps?:
    string[];

  missingFields?:
    string[];

  warnings?:
    string[];

  canConfirm?:
    boolean;
};

export type DashboardAIRegistrationExecutionResult = {
  success?: boolean;

  studentId?:
    number | null;

  planId?:
    number | null;

  semesterIds?:
    number[];

  planSubjectIds?:
    number[];

  transferSubjectIds?:
    number[];

  practiceSaved?:
    boolean;

paymentUpdated?:
  boolean;

  completedSteps?:
    string[];

  failedSteps?:
    string[];

  message?:
    string | null;
};

export type DashboardAIPendingAction = {
  id: number;

  actionType?:
    string | null;

  status?:
    string | null;

  consultationId?:
    number | null;

  studentId?:
    number | null;

  semesterId?:
    number | null;

  preview?:
    DashboardAIPendingActionPreview | null;

  version:
    number;

  expiresAt?:
    string | Date | null;

  confirmedAt?:
    string | Date | null;

  executedAt?:
    string | Date | null;

  cancelledAt?:
    string | Date | null;

  failedAt?:
    string | Date | null;

  errorMessage?:
    string | null;

  executionResult?:
    DashboardAIRegistrationExecutionResult | null;
};

export type DashboardAIDocumentField<T> = {
  value:
    T | null;

  confidence:
    number;

  confidenceLevel:
    | "high"
    | "medium"
    | "low";

  status:
    | "extracted"
    | "confirmed"
    | "edited";

  warning:
    string | null;
};

export type DashboardAIDocumentSubject = {
  rowId:
    string;

  selected:
    boolean;

  subjectName:
    DashboardAIDocumentField<string>;

  credits:
    DashboardAIDocumentField<number>;

  grade:
    DashboardAIDocumentField<string>;

  category:
    DashboardAIDocumentField<
      | "전공"
      | "교양"
      | "일반"
    >;

  requirementType:
    DashboardAIDocumentField<
      | "전공필수"
      | "전공선택"
      | "교양"
      | "일반"
    >;

  semesterNo:
    DashboardAIDocumentField<number>;

  rawText:
    string | null;

  warnings:
    string[];
};

export type DashboardAIDocumentAnalysis = {
  analysisId:
    string;

  documentType:
    | "university_transcript"
    | "education_enrollment"
    | "education_payment"
    | "education_enrollment_and_payment"
    | "unknown";

  documentTypeLabel:
    string;

  recommendedTarget:
    | "plan"
    | "transfer"
    | "payment"
    | "plan_and_payment"
    | "analysis_only";

  recommendedTargetLabel:
    string;

  confidence:
    number;

  confidenceLevel:
    | "high"
    | "medium"
    | "low";

  institutionName:
    DashboardAIDocumentField<string>;

  studentName:
    DashboardAIDocumentField<string>;

  courseName:
    DashboardAIDocumentField<string>;

  semesterLabel:
    DashboardAIDocumentField<string>;

  startDate:
    DashboardAIDocumentField<string>;

  endDate:
    DashboardAIDocumentField<string>;

  paymentAmount:
    DashboardAIDocumentField<number>;

  paymentStatus:
    DashboardAIDocumentField<
      | "결제완료"
      | "결제예정"
      | "미결제"
      | "부분환불"
      | "전액환불"
      | "취소"
    >;

  paidAt:
    DashboardAIDocumentField<string>;

  subjects:
    DashboardAIDocumentSubject[];

  rawText:
    string;

  warnings:
    string[];

  requiredConfirmations:
    string[];

  analyzedAt:
    string;
};

export type DashboardAIMessageKind =
  | "text"
  | "error"
  | "warning"
  | "search_result"
  | "student_summary"
  | "student_risk"
  | "organization_risk"
  | "student_registration_preview"
  | "student_registration_result"
  | "document_analysis";

export type DashboardAIMessageData = {
  students?: DashboardAIStudent[];
  consultations?: DashboardAIConsultation[];

  registrationPreview?: {
    required?: boolean;
    consultationId?: number | null;
    originalMessage?: string;
  } | null;

  pendingAction?:
    DashboardAIPendingAction | null;

  registrationResult?:
  DashboardAIRegistrationExecutionResult | null;

documentAnalysis?:
  DashboardAIDocumentAnalysis | null;

fileName?:
  string | null;

fileSize?:
  number | null;

mimeType?:
  string | null;

saved?:
  boolean;

studentSummary?:
  DashboardAIStudentSummaryData;

  student?:
    | DashboardAIStudentRiskData
    | DashboardAIStudentSummaryData;

  result?:
    | DashboardAIStudentSummaryData
    | DashboardAIStudentRiskData
    | DashboardAIOrganizationRiskData;

  studentId?: number;
  clientName?: string | null;
  score?: number;
  level?: string;
  status?: string;
  summary?: unknown;
  issues?: DashboardAIStudentRiskIssue[];
  risks?: DashboardAIStudentRiskIssue[];
  warnings?: DashboardAIStudentRiskIssue[];

  semester?: string | null;
  currentSemester?: string | null;

  totalCredits?: number;
  earnedCredits?: number;
  plannedCredits?: number;

    paymentStatus?: string | null;
  paymentDate?: string | null;
  paymentAmount?: string | number | null;

  practiceStatus?: string | null;
  approvalStatus?: string | null;

  managerName?: string | null;
  staffName?: string | null;

  riskScore?: number;
  riskLevel?: string | null;

  items?: DashboardAIOrganizationRiskItem[];
  results?: DashboardAIOrganizationRiskItem[];

  counts?: DashboardAIOrganizationRiskData["counts"];

  danger?: number;
  warning?: number;
  normal?: number;
  dangerCount?: number;
  warningCount?: number;
  normalCount?: number;

  [key: string]: unknown;
};

export type DashboardAIMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
  kind?: DashboardAIMessageKind;
  data?: DashboardAIMessageData | null;
};

export type DashboardAISelectedStudent = {
  id: number;
  clientName: string;
  phone?: string | null;
  course?: string | null;
  finalEducation?: string | null;
};

type DashboardAIChatBoxProps = {
  scopeLabel: string;
  messages: DashboardAIMessage[];
  selectedStudent?: DashboardAISelectedStudent | null;
  isLoading?: boolean;
  errorMessage?: string | null;
  onSend:
  (
    message:
      string
  ) =>
    void |
    Promise<void>;

onAnalyzeDocument?: (
  file:
    File
) =>
  void |
  Promise<void>;

onRequestDocumentImport?: (
  messageId:
    string,

  analysis:
    DashboardAIDocumentAnalysis
) =>
  void |
  Promise<void>;

onSelectStudent?: (
  student:
    DashboardAIStudent
) => void;
  onConfirmPendingAction?: (
    pendingActionId: number,
    expectedVersion: number
  ) => void | Promise<void>;

  onCancelPendingAction?: (
    pendingActionId: number,
    expectedVersion: number
  ) => void | Promise<void>;
  onClearSelectedStudent?: () => void;
  onOpenStudent?: (studentId: number) => void;
  onOpenConsultation?: (consultationId: number) => void;
};

function toNumber(value: unknown, fallback = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return number;
}

function normalizeRiskLevel(value: unknown) {
  const normalized = String(value || "").toLowerCase().trim();

  if (
    normalized === "danger" ||
    normalized === "위험" ||
    normalized === "high"
  ) {
    return "danger" as const;
  }

  if (
    normalized === "warning" ||
    normalized === "주의" ||
    normalized === "medium"
  ) {
    return "warning" as const;
  }

  return "normal" as const;
}

function getRiskLevelLabel(level: ReturnType<typeof normalizeRiskLevel>) {
  if (level === "danger") return "위험";
  if (level === "warning") return "주의";
  return "정상";
}

function getRiskLevelClass(level: ReturnType<typeof normalizeRiskLevel>) {
  if (level === "danger") {
    return {
      badge: "border-red-200 bg-red-50 text-red-700",
      score: "text-red-600",
      dot: "bg-red-500",
      panel: "border-red-200 bg-red-50/50",
    };
  }

  if (level === "warning") {
    return {
      badge: "border-amber-200 bg-amber-50 text-amber-700",
      score: "text-amber-600",
      dot: "bg-amber-500",
      panel: "border-amber-200 bg-amber-50/50",
    };
  }

  return {
    badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
    score: "text-emerald-600",
    dot: "bg-emerald-500",
    panel: "border-emerald-200 bg-emerald-50/50",
  };
}

function getPaymentStatusLabel(
  value: unknown
) {
  const status =
    String(value || "")
      .trim()
      .toLowerCase();

  if (status === "paid") {
    return "정상 결제";
  }

  if (status === "missing") {
    return "결제정보 누락";
  }

  if (
    status ===
    "not_confirmed"
  ) {
    return "결제 미확정";
  }

  if (
    status ===
    "partial_refund"
  ) {
    return "부분 환불";
  }

  if (
    status ===
    "full_refund"
  ) {
    return "전액 환불";
  }

  if (
    status ===
    "refund_without_payment"
  ) {
    return "환불 정산 이상";
  }

  return "확인 필요";
}

function getPaymentStatusBadgeClass(
  value: unknown
) {
  const status =
    String(value || "")
      .trim()
      .toLowerCase();

  if (
    status === "missing" ||
    status ===
      "refund_without_payment"
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (
    status === "not_confirmed" ||
    status === "full_refund"
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (
    status === "partial_refund"
  ) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (status === "paid") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function formatDateValue(
  value: unknown
) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "확인 필요";
  }

  const raw =
    String(value).trim();

  const date =
    new Date(raw);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return raw;
  }

  return date.toLocaleDateString(
    "ko-KR",
    {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  );
}

function formatCurrency(
  value: unknown
) {
  return `${Math.max(
    toNumber(value, 0),
    0
  ).toLocaleString("ko-KR")}원`;
}

function getStatusBadgeClass(value: unknown) {
  const normalized = String(value || "").trim().toLowerCase();

  // 부정 상태를 가장 먼저 검사해야 함.
  // "미승인" 안에도 "승인"이라는 문자가 들어 있기 때문.
  if (
    normalized.includes("미결제") ||
    normalized.includes("미승인") ||
    normalized.includes("미배정") ||
    normalized.includes("미등록") ||
    normalized.includes("누락") ||
    normalized.includes("위험") ||
    normalized.includes("취소") ||
    normalized.includes("반려")
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (
    normalized.includes("예정") ||
    normalized.includes("진행") ||
    normalized.includes("대기") ||
    normalized.includes("확인 필요") ||
    normalized.includes("검토")
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (
    normalized.includes("완료") ||
    normalized.includes("승인") ||
    normalized.includes("정상") ||
    normalized.includes("배정")
  ) {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function asRecord(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, any>;
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function getDocumentFieldValue<T>(
  field:
    DashboardAIDocumentField<T> |
    T |
    null |
    undefined
): T | null {
  if (
    field === null ||
    field === undefined
  ) {
    return null;
  }

  if (
    typeof field ===
      "object" &&
    !Array.isArray(
      field
    ) &&
    "value" in
      field
  ) {
    return (
      (
        field as
          DashboardAIDocumentField<T>
      ).value ??
      null
    );
  }

  return field as T;
}

function getDocumentFieldWarning<T>(
  field:
    DashboardAIDocumentField<T> |
    null |
    undefined
): string | null {
  if (
    !field ||
    typeof field !==
      "object"
  ) {
    return null;
  }

  const warning =
    String(
      field.warning ||
      ""
    ).trim();

  return warning ||
    null;
}

function getDocumentFieldConfidence<T>(
  field:
    DashboardAIDocumentField<T> |
    null |
    undefined
): number | null {
  if (
    !field ||
    typeof field !==
      "object"
  ) {
    return null;
  }

  const confidence =
    Number(
      field.confidence
    );

  if (
    !Number.isFinite(
      confidence
    )
  ) {
    return null;
  }

  return Math.max(
    0,
    Math.min(
      1,
      confidence
    )
  );
}

function getConfidencePercent(
  value:
    unknown
): number {
  const confidence =
    Number(
      value
    );

  if (
    !Number.isFinite(
      confidence
    )
  ) {
    return 0;
  }

  const normalized =
    confidence <= 1
      ? confidence *
        100
      : confidence;

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(
        normalized
      )
    )
  );
}

function formatPreviewValue(
  value: unknown
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "미입력";
  }

  if (
    typeof value ===
      "string" ||
    typeof value ===
      "number" ||
    typeof value ===
      "boolean"
  ) {
    return String(value);
  }

  if (
    Array.isArray(value)
  ) {
    return value
      .map((item) =>
        formatPreviewValue(
          item
        )
      )
      .join(", ");
  }

  if (
    typeof value ===
    "object"
  ) {
    const record =
      asRecord(value);

    return Object.entries(
      record
    )
      .map(
        ([key, item]) =>
          `${key}: ${formatPreviewValue(
            item
          )}`
      )
      .join(" · ");
  }

  return String(value);
}

function getStudentSummaryData(
  message: DashboardAIMessage
): DashboardAIStudentSummaryData {
  const data = asRecord(message.data);
  const result = asRecord(data.result);
  const studentSummary = asRecord(data.studentSummary);
  const student = asRecord(data.student);

  const source =
    Object.keys(result).length > 0
      ? result
      : Object.keys(studentSummary).length > 0
      ? studentSummary
      : Object.keys(student).length > 0
      ? student
      : data;

  return {
    studentId: toNumber(
  source.studentId ??
    source.id ??
    student.studentId ??
    student.id ??
    data.studentId,
  0
),

    clientName:
      source.clientName ||
      source.studentName ||
      source.name ||
      student.clientName ||
      student.name ||
      data.clientName ||
      null,

    phone:
      source.phone ||
      source.phoneNumber ||
      student.phone ||
      null,

    course:
      source.course ||
      source.desiredCourse ||
      source.program ||
      student.course ||
      null,

    status:
      source.status ||
      source.studentStatus ||
      student.status ||
      null,

    institution:
      source.institution ||
      source.educationInstitution ||
      source.trainingInstitution ||
      student.institution ||
      null,

    finalEducation:
      source.finalEducation ||
      source.education ||
      student.finalEducation ||
      null,

        semester:
      source.semester ||
      source.currentSemester ||
      source.semesterLabel ||
      null,

    startDate:
      source.startDate ||
      null,

    subjectCount:
      source.subjectCount !== null &&
      source.subjectCount !== undefined
        ? toNumber(source.subjectCount, 0)
        : null,

    totalSemesters:
      source.totalSemesters !== null &&
      source.totalSemesters !== undefined
        ? toNumber(source.totalSemesters, 0)
        : null,

    totalCredits: toNumber(
      source.totalCredits ??
        source.earnedCredits ??
        source.creditTotal,
      0
    ),

    earnedCredits: toNumber(
  source.earnedCredits ??
    source.completedCredits ??
    source.totalCredits,
  0
),

    plannedCredits: toNumber(
  source.plannedCredits ??
    source.expectedCredits ??
    source.planCredits,
  0
),

        paymentStatus:
      source.paymentStatus ||
      source.payment ||
      null,

    paymentDate:
      source.paymentDate ||
      source.paidAt ||
      null,

    paymentAmount:
      source.paymentAmount ??
      source.paidAmount ??
      null,

    practiceStatus:
      source.practiceStatus ||
      source.practice ||
      source.internshipStatus ||
      null,

    approvalStatus:
      source.approvalStatus ||
      source.approval ||
      null,

    managerName:
      source.managerName ||
      source.staffName ||
      source.manager ||
      source.assigneeName ||
      null,

    riskScore: toNumber(
  source.riskScore ??
    source.score ??
    source.totalScore,
  0
),

    riskLevel:
      source.riskLevel ||
      source.level ||
      source.riskStatus ||
      null,

    summary:
      typeof source.summary === "string"
        ? source.summary
        : typeof source.message === "string"
        ? source.message
        : null,
  };
}

function getStudentRiskData(
  message: DashboardAIMessage
): DashboardAIStudentRiskData {
  const data =
    asRecord(
      message.data
    );

  /**
   * 일부 과거 응답은 result 안에 있고,
   * 현재 Tool 응답은 data 자체가 결과이다.
   */
  const result =
    asRecord(
      data.result
    );

  const root =
    Object.keys(result).length > 0
      ? result
      : data;

  const student =
    asRecord(
      root.student
    );

  const summary =
    asRecord(
      root.summary
    );

  const payment =
    asRecord(
      root.payment
    );

  const rawIssues = [
    ...asArray<any>(
      root.issues
    ),

    ...asArray<any>(
      root.risks
    ),

    ...asArray<any>(
      root.warnings
    ),
  ];

  const issues =
    rawIssues
      .map(
        (
          issue,
          index
        ) => {
          if (
            typeof issue ===
            "string"
          ) {
            return {
              key:
                `issue-${index}`,

              label:
                issue,

              severity:
                summary.riskLevel ||
                root.level ||
                root.status,
            };
          }

          const row =
            asRecord(issue);

          return {
            key:
              String(
                row.key ||
                row.code ||
                `issue-${index}`
              ),

            label:
              String(
                row.label ||
                row.title ||
                row.name ||
                row.message ||
                "확인 필요"
              ),

            description:
              row.description ||
              row.detail ||
              row.reason ||
              row.message ||
              null,

            severity:
              row.severity ||
              row.level ||
              row.status ||
              summary.riskLevel ||
              root.level ||
              root.status,
          };
        }
      )
      .filter(
        (issue) =>
          issue.label
      );

  return {
    studentId:
      toNumber(
        student.id ??
          student.studentId ??
          root.studentId ??
          root.id ??
          data.studentId,
        0
      ),

    clientName:
      student.clientName ||
      student.studentName ||
      student.name ||
      root.clientName ||
      root.studentName ||
      root.name ||
      data.clientName ||
      null,

    course:
      student.course ||
      root.course ||
      null,

    studentStatus:
      student.status ||
      root.studentStatus ||
      null,

    score:
      toNumber(
        summary.riskScore ??
          root.riskScore ??
          root.score ??
          root.totalScore ??
          data.score,
        0
      ),

    level:
      summary.riskLevel ||
      root.riskLevel ||
      root.level ||
      root.status ||
      data.level ||
      data.status ||
      "normal",

    summary:
      typeof root.summaryText ===
      "string"
        ? root.summaryText
        : typeof root.message ===
            "string"
          ? root.message
          : null,

    issues,

    payment: {
      status:
        payment.status ??
        null,

      hasSettlementData:
        Boolean(
          payment
            .hasSettlementData
        ),

      totalPaid:
        toNumber(
          payment.totalPaid,
          0
        ),

      totalRefund:
        toNumber(
          payment.totalRefund,
          0
        ),

      netPaymentAmount:
        toNumber(
          payment
            .netPaymentAmount,
          0
        ),

      paymentDate:
        payment.paymentDate ??
        null,
    },

    totalIssueCount:
      toNumber(
        summary
          .totalIssueCount,
        issues.length
      ),

    dangerCount:
      toNumber(
        summary.dangerCount,
        0
      ),

    warningCount:
      toNumber(
        summary.warningCount,
        0
      ),

    infoCount:
      toNumber(
        summary.infoCount,
        0
      ),

    registeredSubjectCount:
      toNumber(
        summary
          .registeredSubjectCount,
        0
      ),

    totalSubjectCount:
      toNumber(
        summary
          .totalSubjectCount,
        0
      ),

    currentCredits:
      toNumber(
        summary.currentCredits,
        0
      ),

    requiredCredits:
      summary.requiredCredits ===
        null ||
      summary.requiredCredits ===
        undefined
        ? null
        : toNumber(
            summary
              .requiredCredits,
            0
          ),

    remainingCredits:
      summary.remainingCredits ===
        null ||
      summary.remainingCredits ===
        undefined
        ? null
        : toNumber(
            summary
              .remainingCredits,
            0
          ),

    duplicateSubjectCount:
      toNumber(
        summary
          .duplicateSubjectCount,
        0
      ),

    practiceRequestCount:
      toNumber(
        summary
          .practiceRequestCount,
        0
      ),
  };
}

function StudentSummaryCard({
  message,
  onOpenStudent,
}: {
  message: DashboardAIMessage;
  onOpenStudent?: (studentId: number) => void;
}) {
  const student = getStudentSummaryData(message);

  const studentId = toNumber(
  student.studentId ?? student.id,
  0
);
  const riskLevel = normalizeRiskLevel(student.riskLevel);
  const riskStyles = getRiskLevelClass(riskLevel);

const paymentAmountText =
  student.paymentAmount !== null &&
  student.paymentAmount !== undefined &&
  student.paymentAmount !== ""
    ? `${toNumber(student.paymentAmount, 0).toLocaleString()}원`
    : "확인 필요";

const infoRows = [
  {
    label: "시작일",
    value: student.startDate || "확인 필요",
  },
  {
    label: "등록 과목",
    value:
      student.subjectCount !== null &&
      student.subjectCount !== undefined
        ? `${student.subjectCount}과목`
        : "확인 필요",
  },
  {
    label: "총 학기",
    value:
      student.totalSemesters !== null &&
      student.totalSemesters !== undefined
        ? `${student.totalSemesters}학기`
        : "확인 필요",
  },
  {
    label: "결제일",
    value: student.paymentDate || "확인 필요",
  },
  {
    label: "결제금액",
    value: paymentAmountText,
  },
  {
    label: "교육원",
    value: student.institution || "미지정",
  },
];

  const statusRows = [
  {
    label: "학생 상태",
    value: student.status || "미지정",
  },
  {
    label: "승인 상태",
    value: student.approvalStatus || "확인 필요",
  },
];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
              학생 현황
            </p>

            <p className="mt-1 truncate text-lg font-extrabold text-slate-900">
              {student.clientName || student.name || "학생 정보"}
            </p>

            <p className="mt-1 truncate text-xs text-slate-500">
              {student.course || "과정 미지정"}
              {student.finalEducation
                ? ` · ${student.finalEducation}`
                : ""}
              {student.institution
                ? ` · ${student.institution}`
                : ""}
            </p>
          </div>

          {student.riskLevel && (
            <div className="shrink-0 text-right">
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold",
                  riskStyles.badge
                )}
              >
                {getRiskLevelLabel(riskLevel)}
              </span>

              {student.riskScore !== undefined && (
                <p className={cn("mt-1 text-lg font-black", riskStyles.score)}>
                  {toNumber(student.riskScore, 0)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 py-4">
        {infoRows.map((row) => (
          <div
            key={row.label}
            className="rounded-xl bg-slate-50 px-3 py-3"
          >
            <p className="text-[10px] font-bold text-slate-400">
              {row.label}
            </p>
            <p className="mt-1 truncate text-xs font-bold text-slate-800">
              {row.value}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-100 px-4 py-4">
        <p className="text-xs font-bold text-slate-700">
          진행 상태
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {statusRows.map((row) => (
            <div
              key={row.label}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11px] font-bold",
                getStatusBadgeClass(row.value)
              )}
            >
              {row.label} · {row.value}
            </div>
          ))}
        </div>
      </div>

      {student.summary && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
          {student.summary}
        </div>
      )}

      {studentId > 0 && (
        <div className="border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={() => onOpenStudent?.(studentId)}
            className="flex h-9 w-full items-center justify-center rounded-xl bg-[#2F6B3B] text-xs font-bold text-white transition hover:bg-[#285d33]"
          >
            학생 상세보기
          </button>
        </div>
      )}
    </div>
  );
}

function StudentRiskCard({
  message,
  onOpenStudent,
}: {
  message: DashboardAIMessage;
  onOpenStudent?: (studentId: number) => void;
}) {
  const risk = getStudentRiskData(message);
  const level = normalizeRiskLevel(risk.level || risk.status);
  const styles = getRiskLevelClass(level);

  const score = Math.max(0, Math.min(100, toNumber(risk.score, 0)));
  const issues = risk.issues ?? [];

const payment =
  risk.payment || {};

const paymentStatusLabel =
  getPaymentStatusLabel(
    payment.status
  );

const paymentRows = [
  {
    label: "결제 상태",
    value:
      paymentStatusLabel,
  },
  {
    label: "총 결제",
    value:
      formatCurrency(
        payment.totalPaid
      ),
  },
  {
    label: "환불",
    value:
      formatCurrency(
        payment.totalRefund
      ),
  },
  {
    label: "실결제",
    value:
      formatCurrency(
        payment
          .netPaymentAmount
      ),
  },
  {
    label: "결제일",
    value:
      formatDateValue(
        payment.paymentDate
      ),
  },
];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
              학생 위험 분석
            </p>

            <p className="mt-1 truncate text-base font-extrabold text-slate-900">
              {risk.clientName || "선택 학생"}
            </p>
          </div>

          <span
            className={cn(
              "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-bold",
              styles.badge
            )}
          >
            {getRiskLevelLabel(level)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-[100px_1fr] gap-4 px-4 py-4">
        <div
          className={cn(
            "flex min-h-[96px] flex-col items-center justify-center rounded-2xl border",
            styles.panel
          )}
        >
          <span className={cn("text-3xl font-black", styles.score)}>
            {score}
          </span>
          <span className="mt-1 text-[11px] font-bold text-slate-500">
            위험 점수
          </span>
        </div>

        <div className="min-w-0">
          <p className="text-xs font-bold text-slate-700">
            주요 확인 항목
          </p>

          {issues.length > 0 ? (
            <div className="mt-2 space-y-2">
              {issues.slice(0, 6).map((issue, index) => {
                const issueLevel = normalizeRiskLevel(issue.severity);
                const issueStyle = getRiskLevelClass(issueLevel);

                return (
                  <div
                    key={issue.key || `${issue.label}-${index}`}
                    className="flex items-start gap-2"
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        issueStyle.dot
                      )}
                    />

                    <div className="min-w-0">
                      <p className="text-xs font-bold leading-5 text-slate-800">
                        {issue.label}
                      </p>

                      {issue.description &&
                        issue.description !== issue.label && (
                          <p className="mt-0.5 text-[11px] leading-4 text-slate-500">
                            {issue.description}
                          </p>
                        )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              상세 위험 항목은 AI 분석 내용에서 확인해주세요.
            </p>
          )}
        </div>
      </div>

<div className="border-t border-slate-100 px-4 py-4">
  <div className="flex items-center justify-between gap-3">
    <p className="text-xs font-bold text-slate-700">
      결제·환불 현황
    </p>

    <span
      className={cn(
        "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold",
        getPaymentStatusBadgeClass(
          payment.status
        )
      )}
    >
      {paymentStatusLabel}
    </span>
  </div>

  <div className="mt-3 grid grid-cols-2 gap-2">
    {paymentRows
      .slice(1)
      .map((row) => (
        <div
          key={row.label}
          className="rounded-xl bg-slate-50 px-3 py-2.5"
        >
          <p className="text-[10px] font-bold text-slate-400">
            {row.label}
          </p>

          <p className="mt-1 text-xs font-bold text-slate-800">
            {row.value}
          </p>
        </div>
      ))}
  </div>
</div>

      {risk.summary && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-600">
          {risk.summary}
        </div>
      )}

      {risk.studentId && risk.studentId > 0 && (
        <div className="border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            onClick={() => onOpenStudent?.(risk.studentId!)}
            className="flex h-9 w-full items-center justify-center rounded-xl bg-[#2F6B3B] text-xs font-bold text-white transition hover:bg-[#285d33]"
          >
            학생 상세보기
          </button>
        </div>
      )}
    </div>
  );
}

function getOrganizationRiskData(
  message: DashboardAIMessage
): DashboardAIOrganizationRiskData {
  const data =
    asRecord(
      message.data
    );

  const result =
    asRecord(
      data.result
    );

  const source =
    Object.keys(result).length > 0
      ? result
      : data;

  const summary =
    asRecord(
      source.summary
    );

  const counts =
    asRecord(
      source.counts
    );

  const sourceItems =
    asArray<DashboardAIOrganizationRiskItem>(
      source.items
    );

  const sourceResults =
    asArray<DashboardAIOrganizationRiskItem>(
      source.results
    );

  const sourceStudents =
    asArray<DashboardAIOrganizationRiskItem>(
      source.students
    );

  const rawStudents =
    sourceItems.length > 0
      ? sourceItems
      : sourceResults.length > 0
        ? sourceResults
        : sourceStudents;

  const seenStudentIds =
    new Set<string>();

  const fallbackStudents =
    rawStudents.filter(
      (
        item,
        index
      ) => {
        const uniqueKey =
  String(
    item.studentId ||
      item.id ||
      `${
        item.clientName ||
        item.name ||
        "student"
      }-${
        item.riskScore ??
        item.score ??
        ""
      }-${
        item.summary ??
        ""
      }-${index}`
  );

        if (
          seenStudentIds.has(
            uniqueKey
          )
        ) {
          return false;
        }

        seenStudentIds.add(
          uniqueKey
        );

        return true;
      }
    );

  return {
    total:
      toNumber(
        summary
          .checkedStudentCount ??
          source
            .checkedStudentCount ??
          summary
            .totalStudentCount ??
          source
            .totalStudentCount ??
          fallbackStudents.length,
        fallbackStudents.length
      ),

    checkedTotal:
      toNumber(
        summary
          .checkedStudentCount ??
          source
            .checkedStudentCount,
        fallbackStudents.length
      ),

    failedTotal:
      toNumber(
        summary
          .failedStudentCount ??
          source
            .failedStudentCount,
        0
      ),

    danger:
      toNumber(
        summary
          .dangerStudentCount ??
          summary.dangerCount ??
          source
            .dangerStudentCount ??
          source.dangerCount ??
          source.danger,
        0
      ),

    warning:
      toNumber(
        summary
          .warningStudentCount ??
          summary.warningCount ??
          source
            .warningStudentCount ??
          source.warningCount ??
          source.warning,
        0
      ),

    normal:
      toNumber(
        summary
          .normalStudentCount ??
          summary.normalCount ??
          source
            .normalStudentCount ??
          source.normalCount ??
          source.normal,
        0
      ),

    counts: {
      creditShortage:
        toNumber(
          summary
            .creditShortageStudentCount ??
            counts
              .creditShortage ??
            counts
              .creditShortageCount ??
            source
              .creditShortageStudentCount,
          0
        ),

      duplicate:
        toNumber(
          summary
            .duplicateSubjectStudentCount ??
            counts.duplicate ??
            counts
              .duplicateCount ??
            source
              .duplicateSubjectStudentCount,
          0
        ),

      practice:
        toNumber(
          summary
            .practiceIssueStudentCount ??
            counts.practice ??
            counts
              .practiceCount ??
            source
              .practiceIssueStudentCount,
          0
        ),

      payment:
        toNumber(
          summary
            .paymentIssueStudentCount ??
            counts.payment ??
            counts
              .paymentCount ??
            source
              .paymentIssueStudentCount,
          0
        ),

      missingPlan:
        toNumber(
          summary
            .missingPlanStudentCount ??
            counts
              .missingPlan ??
            counts
              .missingPlanCount ??
            source
              .missingPlanStudentCount,
          0
        ),

      missingRule:
        toNumber(
          summary
            .missingCreditRuleStudentCount ??
            counts
              .missingRule ??
            counts
              .missingRuleCount ??
            source
              .missingCreditRuleStudentCount,
          0
        ),
    },

    payment: {
      paidStudentCount:
        toNumber(
          summary
            .paidStudentCount,
          0
        ),

      paymentMissingStudentCount:
        toNumber(
          summary
            .paymentMissingStudentCount,
          0
        ),

      paymentNotConfirmedStudentCount:
        toNumber(
          summary
            .paymentNotConfirmedStudentCount,
          0
        ),

      partialRefundStudentCount:
        toNumber(
          summary
            .partialRefundStudentCount,
          0
        ),

      fullRefundStudentCount:
        toNumber(
          summary
            .fullRefundStudentCount,
          0
        ),

      refundWithoutPaymentStudentCount:
        toNumber(
          summary
            .refundWithoutPaymentStudentCount,
          0
        ),

      totalNetPaymentAmount:
        toNumber(
          summary
            .totalNetPaymentAmount,
          0
        ),
    },

    items:
      fallbackStudents,
  };
}

function OrganizationRiskCard({
  message,
  onOpenStudent,
}: {
  message: DashboardAIMessage;
  onOpenStudent?: (studentId: number) => void;
}) {
  const risk = getOrganizationRiskData(message);

  const danger = toNumber(risk.danger, 0);
  const warning = toNumber(risk.warning, 0);
  const normal = toNumber(risk.normal, 0);

  const total =
    toNumber(risk.total, 0) || danger + warning + normal;

  const counts = risk.counts ?? {};
  const items = risk.items ?? [];

const payment =
  risk.payment || {};

const paymentRows = [
  {
    label: "정상 결제",
    count:
      toNumber(
        payment
          .paidStudentCount,
        0
      ),
  },
  {
    label: "결제정보 누락",
    count:
      toNumber(
        payment
          .paymentMissingStudentCount,
        0
      ),
  },
  {
    label: "결제 미확정",
    count:
      toNumber(
        payment
          .paymentNotConfirmedStudentCount,
        0
      ),
  },
  {
    label: "부분 환불",
    count:
      toNumber(
        payment
          .partialRefundStudentCount,
        0
      ),
  },
  {
    label: "전액 환불",
    count:
      toNumber(
        payment
          .fullRefundStudentCount,
        0
      ),
  },
  {
    label: "환불 정산 이상",
    count:
      toNumber(
        payment
          .refundWithoutPaymentStudentCount,
        0
      ),
  },
];

const totalNetPaymentAmount =
  toNumber(
    payment
      .totalNetPaymentAmount,
    0
  );

  const issueRows = [
    {
      label: "학점 부족",
      count: toNumber(counts.creditShortage, 0),
    },
    {
      label: "중복 과목",
      count: toNumber(counts.duplicate, 0),
    },
    {
      label: "실습 확인",
      count: toNumber(counts.practice, 0),
    },
    {
      label: "결제 확인",
      count: toNumber(counts.payment, 0),
    },
    {
      label: "플랜 누락",
      count: toNumber(counts.missingPlan, 0),
    },
    {
      label: "규칙 미지정",
      count: toNumber(counts.missingRule, 0),
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
          CRM 전체 점검
        </p>

        <div className="mt-1 flex items-end justify-between gap-3">
          <p className="text-base font-extrabold text-slate-900">
            조직 위험 현황
          </p>

          <p className="text-xs font-bold text-slate-500">
            분석 {total.toLocaleString()}명
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 py-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 px-3 py-3 text-center">
          <p className="text-2xl font-black text-red-600">
            {danger}
          </p>
          <p className="mt-1 text-[11px] font-bold text-red-700">
            위험
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-center">
          <p className="text-2xl font-black text-amber-600">
            {warning}
          </p>
          <p className="mt-1 text-[11px] font-bold text-amber-700">
            주의
          </p>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-center">
          <p className="text-2xl font-black text-emerald-600">
            {normal}
          </p>
          <p className="mt-1 text-[11px] font-bold text-emerald-700">
            정상
          </p>
        </div>
      </div>

      <div className="border-t border-slate-100 px-4 py-4">
        <p className="text-xs font-bold text-slate-700">
          항목별 확인 현황
        </p>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {issueRows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"
            >
              <span className="text-[11px] font-medium text-slate-600">
                {row.label}
              </span>

              <span
                className={cn(
                  "text-xs font-black",
                  row.count > 0 ? "text-red-600" : "text-slate-400"
                )}
              >
                {row.count}명
              </span>
            </div>
          ))}
        </div>
      </div>

<div className="border-t border-slate-100 px-4 py-4">
  <div className="flex items-end justify-between gap-3">
    <p className="text-xs font-bold text-slate-700">
      결제·환불 현황
    </p>

    <div className="text-right">
      <p className="text-[10px] font-medium text-slate-400">
        점검 학생 실결제 합계
      </p>

      <p className="mt-0.5 text-sm font-black text-slate-900">
        {totalNetPaymentAmount
          .toLocaleString(
            "ko-KR"
          )}
        원
      </p>
    </div>
  </div>

  <div className="mt-3 grid grid-cols-2 gap-2">
    {paymentRows.map(
      (row) => (
        <div
          key={row.label}
          className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5"
        >
          <span className="text-[11px] font-medium text-slate-600">
            {row.label}
          </span>

          <span
            className={cn(
              "text-xs font-black",

              row.label ===
                "정상 결제"
                ? "text-emerald-600"
                : row.count > 0
                  ? "text-red-600"
                  : "text-slate-400"
            )}
          >
            {row.count}명
          </span>
        </div>
      )
    )}
  </div>
</div>

      {items.length > 0 && (
        <div className="border-t border-slate-100 px-4 py-4">
          <p className="text-xs font-bold text-slate-700">
            우선 확인 학생
          </p>

          <div className="mt-3 space-y-2">
            {items.slice(0, 8).map((item, index) => {
              const studentId = toNumber(item.studentId || item.id, 0);
              const level =
  normalizeRiskLevel(
    item.riskLevel ||
    item.level ||
    item.status
  );
              const styles = getRiskLevelClass(level);

              return (
                <button
                  key={`${studentId}-${index}`}
                  type="button"
                  disabled={!studentId}
                  onClick={() => {
                    if (studentId > 0) {
                      onOpenStudent?.(studentId);
                    }
                  }}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition hover:bg-slate-50 disabled:cursor-default"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        styles.dot
                      )}
                    />

                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-slate-800">
                        {item.clientName ||
                          item.name ||
                          `학생 #${studentId || index + 1}`}
                      </p>

                      {item.summary && (
                        <p className="mt-0.5 truncate text-[10px] text-slate-500">
                          {item.summary}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className={cn("text-sm font-black", styles.score)}>
                      {toNumber(
  item.riskScore ??
    item.score,
  0
)}
                    </p>
                    <p className="text-[9px] font-bold text-slate-400">
                      위험점수
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StudentRegistrationPreviewCard({
  message,
  isLoading,
  onConfirmPendingAction,
  onCancelPendingAction,
  onOpenStudent,
}: {
  message:
    DashboardAIMessage;

  isLoading:
    boolean;

  onConfirmPendingAction?: (
    pendingActionId: number,
    expectedVersion: number
  ) => void | Promise<void>;

  onCancelPendingAction?: (
    pendingActionId: number,
    expectedVersion: number
  ) => void | Promise<void>;

  onOpenStudent?: (
    studentId: number
  ) => void;
}) {
  const pendingAction =
    message.data
      ?.pendingAction ||
    null;

  if (!pendingAction) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-xs leading-5 text-amber-800">
        학생 등록 미리보기 정보를 찾을 수 없습니다.
      </div>
    );
  }

  const preview =
    pendingAction
      .preview ||
    {};

  const status =
    String(
      pendingAction.status ||
      ""
    );

  const pendingActionId =
    toNumber(
      pendingAction.id,
      0
    );

  const version =
    toNumber(
      pendingAction.version,
      1
    );

  const missingFields =
    asArray<string>(
      preview.missingFields
    );

  const warnings =
    asArray<string>(
      preview.warnings
    );

  const sections =
    asArray<DashboardAIPendingActionPreviewSection>(
      preview.sections
    );

  const executionSteps =
    asArray<string>(
      preview.executionSteps
    );

const isDocumentImport =
  String(
    pendingAction
      .actionType ||
    ""
  ).startsWith(
    "document_"
  );

 const canConfirm =
  status ===
    "awaiting_confirmation" &&
  preview.canConfirm ===
    true &&
  missingFields.length ===
    0;

  const isCancelled =
    status ===
    "cancelled";

  const isExecuted =
    status ===
    "executed";

  const isFailed =
    status ===
    "failed";

  const result =
    message.data
      ?.registrationResult ||
    pendingAction
      .executionResult ||
    null;

  const studentId =
    toNumber(
      result?.studentId ||
      pendingAction.studentId,
      0
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
  {isDocumentImport
    ? "AI 문서 CRM 반영"
    : "AI 학생 통합등록"}
</p>

            <p className="mt-1 text-base font-extrabold text-slate-900">
              {preview.title ||
                "등록예정 학생 생성 및 과목설계"}
            </p>

            {preview.summary && (
  <p className="mt-2 text-xs leading-5 text-slate-500">
    {preview.summary}
  </p>
)}
          </div>

          <span
            className={cn(
              "inline-flex shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold",

              isExecuted
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : isCancelled
                  ? "border-slate-200 bg-slate-50 text-slate-600"
                  : isFailed
                    ? "border-red-200 bg-red-50 text-red-700"
                    : canConfirm
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-amber-200 bg-amber-50 text-amber-700"
            )}
          >
            {isExecuted
              ? "실행 완료"
              : isCancelled
                ? "취소됨"
                : isFailed
                  ? "실행 실패"
                  : canConfirm
                    ? "승인 가능"
                    : "확인 필요"}
          </span>
        </div>
      </div>

      {sections.length > 0 && (
        <div className="space-y-3 px-4 py-4">
          {sections.map(
            (
              section,
              index
            ) => {
              const sectionRecord =
                asRecord(
                  section
                );

              const sectionItems =
                asArray<any>(
                  sectionRecord
                    .items
                );

              const sectionRows =
                asArray<any>(
                  sectionRecord
                    .rows
                );

              const rows =
                sectionItems
                  .length > 0
                  ? sectionItems
                  : sectionRows;

const sectionTitle =
  String(
    sectionRecord
      .title ||
    sectionRecord
      .label ||
    `확인 항목 ${index + 1}`
  );

              return (
                <div
                  key={`${sectionTitle}-${index}`}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"
                >
                  <p className="text-xs font-bold text-slate-800">
  {sectionTitle}
</p>

                  {sectionRecord
                    .description && (
                    <p className="mt-1 text-[11px] leading-4 text-slate-500">
                      {String(
                        sectionRecord
                          .description
                      )}
                    </p>
                  )}

                  {rows.length >
                    0 && (
                    <div className="mt-2 space-y-1.5">
                      {rows.map(
                        (
                          row,
                          rowIndex
                        ) => (
                          <div
                            key={
                              rowIndex
                            }
                            className="rounded-lg bg-white px-2.5 py-2 text-[11px] leading-4 text-slate-600"
                          >
                            {formatPreviewValue(
                              row
                            )}
                          </div>
                        )
                      )}
                    </div>
                  )}

                  {rows.length ===
                    0 &&
                    sectionRecord
                      .data !==
                      undefined && (
                      <p className="mt-2 text-[11px] leading-4 text-slate-600">
                        {formatPreviewValue(
                          sectionRecord
                            .data
                        )}
                      </p>
                    )}
                </div>
              );
            }
          )}
        </div>
      )}

      {missingFields.length >
        0 && (
        <div className="border-t border-red-100 bg-red-50/70 px-4 py-4">
          <p className="flex items-center gap-2 text-xs font-bold text-red-700">
            <AlertCircle className="h-4 w-4" />
            필수 입력 누락
          </p>

          <div className="mt-2 flex flex-wrap gap-2">
            {missingFields.map(
              (field) => (
                <span
                  key={field}
                  className="rounded-full border border-red-200 bg-white px-2.5 py-1 text-[11px] font-bold text-red-700"
                >
                  {field}
                </span>
              )
            )}
          </div>
        </div>
      )}

      {warnings.length >
        0 && (
        <div className="border-t border-amber-100 bg-amber-50/70 px-4 py-4">
          <p className="text-xs font-bold text-amber-800">
            확인 경고
          </p>

          <div className="mt-2 space-y-1.5">
            {warnings.map(
              (
                warning,
                index
              ) => (
                <p
                  key={`${warning}-${index}`}
                  className="text-[11px] leading-4 text-amber-800"
                >
                  · {warning}
                </p>
              )
            )}
          </div>
        </div>
      )}

      {executionSteps.length >
        0 && (
        <div className="border-t border-slate-100 px-4 py-4">
          <p className="text-xs font-bold text-slate-700">
            승인 후 실행 작업
          </p>

          <div className="mt-3 space-y-2">
            {executionSteps.map(
              (
                step,
                index
              ) => (
                <div
                  key={`${step}-${index}`}
                  className="flex items-start gap-2"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-[10px] font-black text-[#2F6B3B]">
                    {index + 1}
                  </span>

                  <p className="text-[11px] leading-5 text-slate-600">
                    {step}
                  </p>
                </div>
              )
            )}
          </div>
        </div>
      )}

      {isFailed &&
        pendingAction
          .errorMessage && (
          <div className="border-t border-red-100 bg-red-50 px-4 py-3 text-xs leading-5 text-red-700">
            {pendingAction
              .errorMessage}
          </div>
        )}

      {isExecuted &&
  result && (
    <div className="border-t border-emerald-100 bg-emerald-50/70 px-4 py-4">
      <div className="flex items-center gap-2 text-emerald-700">
        <CheckCircle2 className="h-4 w-4" />

        <p className="text-xs font-bold">
          {isDocumentImport
            ? "문서 CRM 반영 완료"
            : "등록 저장 완료"}
        </p>
      </div>

      {isDocumentImport ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white px-3 py-2.5">
            <p className="text-[10px] font-bold text-slate-400">
              우리플랜 과목
            </p>

            <p className="mt-1 text-xs font-black text-slate-800">
              {asArray<number>(
                result
                  .planSubjectIds
              ).length}
              건
            </p>
          </div>

          <div className="rounded-xl bg-white px-3 py-2.5">
            <p className="text-[10px] font-bold text-slate-400">
              기존 이수 과목
            </p>

            <p className="mt-1 text-xs font-black text-slate-800">
              {asArray<number>(
                result
                  .transferSubjectIds
              ).length}
              건
            </p>
          </div>

          <div className="col-span-2 rounded-xl bg-white px-3 py-2.5">
            <p className="text-[10px] font-bold text-slate-400">
              결제정보
            </p>

            <p className="mt-1 text-xs font-black text-slate-800">
              {result
                .paymentUpdated ===
              true
                ? "반영 완료"
                : "변경 없음"}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white px-3 py-2.5">
            <p className="text-[10px] font-bold text-slate-400">
              생성 학기
            </p>

            <p className="mt-1 text-xs font-black text-slate-800">
              {asArray<number>(
                result
                  .semesterIds
              ).length}
              건
            </p>
          </div>

          <div className="rounded-xl bg-white px-3 py-2.5">
            <p className="text-[10px] font-bold text-slate-400">
              우리플랜 과목
            </p>

            <p className="mt-1 text-xs font-black text-slate-800">
              {asArray<number>(
                result
                  .planSubjectIds
              ).length}
              건
            </p>
          </div>

          <div className="rounded-xl bg-white px-3 py-2.5">
            <p className="text-[10px] font-bold text-slate-400">
              전적대 과목
            </p>

            <p className="mt-1 text-xs font-black text-slate-800">
              {asArray<number>(
                result
                  .transferSubjectIds
              ).length}
              건
            </p>
          </div>

          <div className="rounded-xl bg-white px-3 py-2.5">
            <p className="text-[10px] font-bold text-slate-400">
              실습정보
            </p>

            <p className="mt-1 text-xs font-black text-slate-800">
              {result
                .practiceSaved
                ? "반영"
                : "미반영"}
            </p>
          </div>
        </div>
      )}
    </div>
  )}

      {status ===
        "awaiting_confirmation" && (
        <div className="grid grid-cols-2 gap-2 border-t border-slate-100 px-4 py-3">
          <button
            type="button"
            disabled={
              isLoading ||
              pendingActionId <=
                0
            }
            onClick={() =>
              void onCancelPendingAction?.(
                pendingActionId,
                version
              )
            }
            className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <XCircle className="h-4 w-4" />
            초안 취소
          </button>

          <button
            type="button"
            disabled={
              isLoading ||
              !canConfirm ||
              pendingActionId <=
                0
            }
            onClick={() =>
              void onConfirmPendingAction?.(
                pendingActionId,
                version
              )
            }
            className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#2F6B3B] text-xs font-bold text-white transition hover:bg-[#285d33] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ClipboardCheck className="h-4 w-4" />
            )}
           {isDocumentImport
  ? "확인 후 CRM 반영"
  : "확인 후 등록"}
          </button>
        </div>
      )}

      {isExecuted &&
  studentId > 0 && (
    <div className="border-t border-slate-100 px-4 py-3">
      <button
        type="button"
        onClick={() =>
          onOpenStudent?.(
            studentId
          )
        }
        className="flex h-10 w-full items-center justify-center rounded-xl bg-[#2F6B3B] text-xs font-bold text-white transition hover:bg-[#285d33]"
      >
        {isDocumentImport
          ? "학생 상세보기"
          : "생성된 학생 상세보기"}
      </button>
    </div>
  )}
    </div>
  );
}

function DocumentAnalysisCard({
  message,
  selectedStudent,
  isLoading,
  onRequestDocumentImport,
}: {
  message:
    DashboardAIMessage;

  selectedStudent?:
    DashboardAISelectedStudent |
    null;

  isLoading:
    boolean;

  onRequestDocumentImport?: (
    messageId:
      string,

    analysis:
      DashboardAIDocumentAnalysis
  ) =>
    void |
    Promise<void>;
}) {
  const analysis =
    message.data
      ?.documentAnalysis ||
    null;

  if (!analysis) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-xs leading-5 text-amber-800">
        문서 분석 결과를 찾을 수 없습니다.
      </div>
    );
  }

  const documentTypeLabel =
    String(
      analysis
        .documentTypeLabel ||
      analysis
        .documentType ||
      "이미지 문서"
    );

  const recommendedTargetLabel =
    String(
      analysis
        .recommendedTargetLabel ||
      analysis
        .recommendedTarget ||
      "담당자 확인 필요"
    );

  const confidencePercent =
    getConfidencePercent(
      analysis.confidence
    );

  const institutionName =
    getDocumentFieldValue(
      analysis
        .institutionName
    );

  const studentName =
    getDocumentFieldValue(
      analysis
        .studentName
    );

  const courseName =
    getDocumentFieldValue(
      analysis
        .courseName
    );

  const semesterLabel =
    getDocumentFieldValue(
      analysis
        .semesterLabel
    );

  const startDate =
    getDocumentFieldValue(
      analysis
        .startDate
    );

  const endDate =
    getDocumentFieldValue(
      analysis
        .endDate
    );

  const paymentAmount =
    getDocumentFieldValue(
      analysis
        .paymentAmount
    );

  const paymentStatus =
    getDocumentFieldValue(
      analysis
        .paymentStatus
    );

  const paidAt =
    getDocumentFieldValue(
      analysis
        .paidAt
    );

  const subjects =
    Array.isArray(
      analysis.subjects
    )
      ? analysis.subjects
      : [];

  const warnings =
    Array.isArray(
      analysis.warnings
    )
      ? analysis.warnings
      : [];

  const requiredConfirmations =
    Array.isArray(
      analysis
        .requiredConfirmations
    )
      ? analysis
          .requiredConfirmations
      : [];

  const fileName =
    String(
      message.data
        ?.fileName ||
      "스크린샷 이미지"
    );

  const fileSize =
    Number(
      message.data
        ?.fileSize ||
      0
    );

  const fileSizeLabel =
    fileSize > 0
      ? fileSize >=
        1024 * 1024
        ? `${(
            fileSize /
            1024 /
            1024
          ).toFixed(
            1
          )}MB`
        : `${Math.ceil(
            fileSize /
            1024
          )}KB`
      : null;

  const saved =
    message.data
      ?.saved ===
    true;

const canCreateImportPreview =
  Boolean(
    selectedStudent &&
    onRequestDocumentImport &&
    analysis.recommendedTarget !==
      "analysis_only"
  );

const importDisabledReason =
  !selectedStudent
    ? "먼저 반영 대상 학생을 선택해주세요."
    : analysis.recommendedTarget ===
        "analysis_only"
      ? "이 문서는 반영 위치를 직접 선택해야 합니다."
      : null;

  const basicRows = [
    {
      label:
        "기관명",

      value:
        institutionName ||
        "확인 필요",

      field:
        analysis
          .institutionName,
    },
    {
      label:
        "학생명",

      value:
        studentName ||
        "확인 필요",

      field:
        analysis
          .studentName,
    },
    {
      label:
        "과정명",

      value:
        courseName ||
        "확인 필요",

      field:
        analysis
          .courseName,
    },
    {
      label:
        "학기",

      value:
        semesterLabel ||
        "확인 필요",

      field:
        analysis
          .semesterLabel,
    },
  ];

  const scheduleRows = [
    {
      label:
        "시작일",

      value:
        startDate ||
        "확인 필요",
    },
    {
      label:
        "종료일",

      value:
        endDate ||
        "확인 필요",
    },
    {
      label:
        "결제 상태",

      value:
        paymentStatus ||
        "확인 필요",
    },
    {
      label:
        "결제일",

      value:
        paidAt ||
        "확인 필요",
    },
  ];

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-400">
              AI 문서 분석
            </p>

            <p className="mt-1 truncate text-base font-extrabold text-slate-900">
              {documentTypeLabel}
            </p>

            <p className="mt-1 truncate text-[11px] text-slate-500">
              {fileName}
              {fileSizeLabel
                ? ` · ${fileSizeLabel}`
                : ""}
            </p>
          </div>

          <div className="shrink-0 text-right">
            <span
              className={cn(
                "inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold",

                confidencePercent >=
                  80
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : confidencePercent >=
                      60
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-red-200 bg-red-50 text-red-700"
              )}
            >
              신뢰도{" "}
              {confidencePercent}%
            </span>

            <p
              className={cn(
                "mt-1 text-[10px] font-bold",

                saved
                  ? "text-emerald-600"
                  : "text-slate-400"
              )}
            >
              {saved
                ? "CRM 저장됨"
                : "분석만 완료"}
            </p>
          </div>
        </div>
      </div>

      <div className="border-b border-emerald-100 bg-emerald-50/70 px-4 py-3">
        <p className="text-[10px] font-bold text-emerald-600">
          권장 반영 위치
        </p>

        <p className="mt-1 text-sm font-extrabold text-[#2F6B3B]">
          {recommendedTargetLabel}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 px-4 py-4">
        {basicRows.map(
          (
            row
          ) => {
            const warning =
              getDocumentFieldWarning(
                row.field
              );

            const confidence =
              getDocumentFieldConfidence(
                row.field
              );

            return (
              <div
                key={
                  row.label
                }
                className="rounded-xl bg-slate-50 px-3 py-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold text-slate-400">
                    {row.label}
                  </p>

                  {confidence !==
                    null && (
                    <span className="text-[9px] font-bold text-slate-400">
                      {Math.round(
                        confidence *
                          100
                      )}
                      %
                    </span>
                  )}
                </div>

                <p className="mt-1 break-words text-xs font-bold text-slate-800">
                  {String(
                    row.value
                  )}
                </p>

                {warning && (
                  <p className="mt-1 text-[10px] leading-4 text-amber-700">
                    {warning}
                  </p>
                )}
              </div>
            );
          }
        )}
      </div>

      <div className="border-t border-slate-100 px-4 py-4">
        <div className="flex items-end justify-between gap-3">
          <p className="text-xs font-bold text-slate-700">
            일정·결제 정보
          </p>

          <p className="text-xs font-black text-slate-900">
            {paymentAmount !==
              null
              ? `${Number(
                  paymentAmount
                ).toLocaleString(
                  "ko-KR"
                )}원`
              : "금액 확인 필요"}
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          {scheduleRows.map(
            (
              row
            ) => (
              <div
                key={
                  row.label
                }
                className="rounded-xl bg-slate-50 px-3 py-2.5"
              >
                <p className="text-[10px] font-bold text-slate-400">
                  {row.label}
                </p>

                <p className="mt-1 break-words text-xs font-bold text-slate-800">
                  {String(
                    row.value
                  )}
                </p>
              </div>
            )
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold text-slate-700">
            추출 과목
          </p>

          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
            {subjects.length}
            과목
          </span>
        </div>

        {subjects.length >
        0 ? (
          <div className="mt-3 space-y-2">
            {subjects.map(
              (
                subject,
                index
              ) => {
                const subjectName =
                  getDocumentFieldValue(
                    subject
                      .subjectName
                  );

                const credits =
                  getDocumentFieldValue(
                    subject
                      .credits
                  );

                const grade =
                  getDocumentFieldValue(
                    subject
                      .grade
                  );

                const category =
                  getDocumentFieldValue(
                    subject
                      .category
                  );

                const requirementType =
                  getDocumentFieldValue(
                    subject
                      .requirementType
                  );

                const semesterNo =
                  getDocumentFieldValue(
                    subject
                      .semesterNo
                  );

                const subjectWarnings =
                  Array.isArray(
                    subject
                      .warnings
                  )
                    ? subject
                        .warnings
                    : [];

                return (
                  <div
                    key={`${subjectName || "subject"}-${index}`}
                    className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="break-words text-xs font-extrabold text-slate-900">
                          {subjectName ||
                            `과목 ${index + 1}`}
                        </p>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {credits !==
                            null && (
                            <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-bold text-slate-600">
                              {credits}학점
                            </span>
                          )}

                          {grade && (
                            <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                              성적{" "}
                              {grade}
                            </span>
                          )}

                          {category && (
                            <span className="rounded-full border border-purple-200 bg-purple-50 px-2 py-1 text-[10px] font-bold text-purple-700">
                              {category}
                            </span>
                          )}

                          {requirementType && (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
                              {requirementType}
                            </span>
                          )}
                        </div>
                      </div>

                      {semesterNo !==
                        null && (
                        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-slate-500">
                          {semesterNo}
                          학기
                        </span>
                      )}
                    </div>

                    {subjectWarnings.length >
                      0 && (
                      <div className="mt-2 space-y-1 border-t border-amber-100 pt-2">
                        {subjectWarnings.map(
                          (
                            warning,
                            warningIndex
                          ) => (
                            <p
                              key={`${warning}-${warningIndex}`}
                              className="text-[10px] leading-4 text-amber-700"
                            >
                              ·{" "}
                              {warning}
                            </p>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
        ) : (
          <p className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-xs leading-5 text-slate-500">
            문서에서 과목을 찾지 못했습니다.
          </p>
        )}
      </div>

      {requiredConfirmations.length >
        0 && (
        <div className="border-t border-red-100 bg-red-50/70 px-4 py-4">
          <p className="flex items-center gap-2 text-xs font-bold text-red-700">
            <AlertCircle className="h-4 w-4" />
            저장 전 필수 확인
          </p>

          <div className="mt-2 space-y-1.5">
            {requiredConfirmations.map(
              (
                confirmation,
                index
              ) => (
                <p
                  key={`${confirmation}-${index}`}
                  className="text-[11px] leading-4 text-red-700"
                >
                  ·{" "}
                  {confirmation}
                </p>
              )
            )}
          </div>
        </div>
      )}

      {warnings.length >
        0 && (
        <div className="border-t border-amber-100 bg-amber-50/70 px-4 py-4">
          <p className="text-xs font-bold text-amber-800">
            AI 분석 경고
          </p>

          <div className="mt-2 space-y-1.5">
            {warnings.map(
              (
                warning,
                index
              ) => (
                <p
                  key={`${warning}-${index}`}
                  className="text-[11px] leading-4 text-amber-800"
                >
                  ·{" "}
                  {warning}
                </p>
              )
            )}
          </div>
        </div>
      )}

      <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
  <p className="text-[11px] leading-5 text-slate-500">
    이 결과는 AI가 이미지에서 추출한 분석값입니다. CRM 반영 검토를 눌러도 즉시 저장되지 않으며 승인 초안만 생성됩니다.
  </p>

  {importDisabledReason && (
    <p className="mt-2 text-[11px] font-bold leading-5 text-amber-700">
      {importDisabledReason}
    </p>
  )}

  {onRequestDocumentImport && (
    <button
      type="button"
      disabled={
        isLoading ||
        !canCreateImportPreview
      }
      onClick={() => {
        if (
          !canCreateImportPreview
        ) {
          return;
        }

        void onRequestDocumentImport(
          message.id,
          analysis
        );
      }}
      className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#2F6B3B] text-xs font-bold text-white transition hover:bg-[#285d33] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ClipboardCheck className="h-4 w-4" />
      )}

      CRM 반영 검토
    </button>
  )}
</div>
    </div>
  );
}

function DashboardAIMessageRenderer({
  message,
  selectedStudent,
  isLoading,
  onSelectStudent,
  onOpenStudent,
  onOpenConsultation,
  onRequestDocumentImport,
  onConfirmPendingAction,
  onCancelPendingAction,
}: {
  message:
    DashboardAIMessage;

selectedStudent?:
  DashboardAISelectedStudent |
  null;

  isLoading:
    boolean;

  onSelectStudent?: (
    student: DashboardAIStudent
  ) => void;

  onOpenStudent?: (
    studentId: number
  ) => void;

  onOpenConsultation?: (
    consultationId: number
  ) => void;

onRequestDocumentImport?: (
  messageId:
    string,

  analysis:
    DashboardAIDocumentAnalysis
) =>
  void |
  Promise<void>;

  onConfirmPendingAction?: (
    pendingActionId: number,
    expectedVersion: number
  ) => void | Promise<void>;

  onCancelPendingAction?: (
    pendingActionId: number,
    expectedVersion: number
  ) => void | Promise<void>;
}) {
  const isCustomCard =
  message.kind ===
    "student_summary" ||
  message.kind ===
    "student_risk" ||
  message.kind ===
    "organization_risk" ||
  message.kind ===
    "student_registration_preview" ||
  message.kind ===
    "student_registration_result" ||
  message.kind ===
    "document_analysis";

return (
  <>
    {!isCustomCard && (
      <div className="max-w-none [&_ol]:pl-5 [&_ul]:pl-5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-950 [&_pre]:p-3 [&_pre]:text-white">
        <Streamdown>{message.content}</Streamdown>
      </div>
    )}

    {message.kind === "search_result" && (
      <SearchResults
        message={message}
        onSelectStudent={onSelectStudent}
        onOpenStudent={onOpenStudent}
        onOpenConsultation={onOpenConsultation}
      />
    )}

{message.kind ===
  "document_analysis" && (
  <DocumentAnalysisCard
    message={
      message
    }
    selectedStudent={
      selectedStudent
    }
    isLoading={
      isLoading
    }
    onRequestDocumentImport={
      onRequestDocumentImport
    }
  />
)}

{message.kind === "student_summary" && (
  <StudentSummaryCard
    message={message}
    onOpenStudent={onOpenStudent}
  />
)}

    {message.kind === "student_risk" && (
      <StudentRiskCard
        message={message}
        onOpenStudent={onOpenStudent}
      />
    )}

    {(
      message.kind ===
        "student_registration_preview" ||
      message.kind ===
        "student_registration_result"
    ) && (
      <StudentRegistrationPreviewCard
        message={message}
        isLoading={isLoading}
        onConfirmPendingAction={
          onConfirmPendingAction
        }
        onCancelPendingAction={
          onCancelPendingAction
        }
        onOpenStudent={
          onOpenStudent
        }
      />
    )}

    {message.kind === "organization_risk" && (
      <OrganizationRiskCard
        message={message}
        onOpenStudent={onOpenStudent}
      />
    )}
  </>
);
}

function SearchResults({
  message,
  onSelectStudent,
  onOpenStudent,
  onOpenConsultation,
}: {
  message: DashboardAIMessage;
  onSelectStudent?: (student: DashboardAIStudent) => void;
  onOpenStudent?: (studentId: number) => void;
  onOpenConsultation?: (consultationId: number) => void;
}) {
  const students = message.data?.students ?? [];
  const consultations = message.data?.consultations ?? [];

  if (students.length === 0 && consultations.length === 0) return null;

  return (
    <div className="mt-3 space-y-2">
      {students.map((student) => (
        <div
          key={`student-${student.id}`}
          className="rounded-2xl border border-slate-200 bg-white p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {student.clientName || `학생 #${student.id}`}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {student.course || "과정 미지정"}
                {student.status ? ` · ${student.status}` : ""}
                {student.institution ? ` · ${student.institution}` : ""}
              </p>
            </div>

            <div className="flex shrink-0 gap-1.5">
              <button
                type="button"
                onClick={() => onSelectStudent?.(student)}
                className="rounded-xl bg-[#2F6B3B] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#285d33]"
              >
                선택
              </button>
              <button
                type="button"
                onClick={() => onOpenStudent?.(student.id)}
                className="rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
              >
                상세
              </button>
            </div>
          </div>
        </div>
      ))}

      {consultations.map((consultation) => (
        <div
          key={`consultation-${consultation.id}`}
          className="rounded-2xl border border-slate-200 bg-white p-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {consultation.clientName || `상담 #${consultation.id}`}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {consultation.desiredCourse || "희망과정 미지정"}
                {consultation.status ? ` · ${consultation.status}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenConsultation?.(consultation.id)}
              className="shrink-0 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
            >
              상담 DB
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function DashboardAIChatBox({
  scopeLabel,
  messages,
  selectedStudent = null,
  isLoading = false,
  errorMessage = null,
  onSend,
  onAnalyzeDocument,
  onRequestDocumentImport,
  onSelectStudent,
  onConfirmPendingAction,
  onCancelPendingAction,
  onClearSelectedStudent,
  onOpenStudent,
  onOpenConsultation,
}: DashboardAIChatBoxProps) {
 const [input, setInput] =
  useState("");

const textareaRef =
  useRef<HTMLTextAreaElement>(
    null
  );

const fileInputRef =
  useRef<HTMLInputElement>(
    null
  );

const bottomRef =
  useRef<HTMLDivElement>(
    null
  );

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: messages.length > 1 ? "smooth" : "auto" });
  }, [messages, isLoading]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 140)}px`;
  }, [input]);

  const submit = async () => {
    const value = input.trim();
    if (!value || isLoading) return;

    setInput("");
    await onSend(value);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

const submitDocumentImage =
  async (
    file: File
  ) => {
    if (
      !onAnalyzeDocument ||
      isLoading
    ) {
      return;
    }

    await onAnalyzeDocument(
      file
    );
  };

const handleDocumentFileChange =
  async (
    event:
      ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event
        .target
        .files?.[0];

    event.target.value =
      "";

    if (!file) {
      return;
    }

    await submitDocumentImage(
      file
    );
  };

const handleImagePaste =
  async (
    event:
      ClipboardEvent<HTMLTextAreaElement>
  ) => {
    if (
      !onAnalyzeDocument ||
      isLoading
    ) {
      return;
    }

    const clipboardItems =
      Array.from(
        event
          .clipboardData
          .items
      );

    const imageItem =
      clipboardItems.find(
        (
          item
        ) =>
          item.kind ===
            "file" &&
          item.type.startsWith(
            "image/"
          )
      );

    if (!imageItem) {
      return;
    }

    const clipboardFile =
      imageItem.getAsFile();

    if (!clipboardFile) {
      return;
    }

    event.preventDefault();

    const extension =
      clipboardFile.type ===
      "image/jpeg"
        ? "jpg"
        : clipboardFile.type ===
          "image/webp"
          ? "webp"
          : "png";

    const screenshotFile =
      new File(
        [
          clipboardFile,
        ],
        `screenshot-${Date.now()}.${extension}`,
        {
          type:
            clipboardFile.type,
        }
      );

    await submitDocumentImage(
      screenshotFile
    );
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#F7F9F8]">
      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-slate-400">
          현재 분석 범위
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" />
          <p className="truncate text-sm font-bold text-slate-900">{scopeLabel}</p>
        </div>
      </div>

      {selectedStudent && (
        <div className="border-b border-emerald-100 bg-emerald-50/80 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <div className="mt-0.5 rounded-xl bg-white p-2 text-[#2F6B3B] shadow-sm">
                <UserCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-900">
                  {selectedStudent.clientName}
                </p>
                <p className="mt-1 truncate text-xs text-slate-500">
                  {selectedStudent.course || "과정 미지정"}
                  {selectedStudent.finalEducation
                    ? ` · ${selectedStudent.finalEducation}`
                    : ""}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClearSelectedStudent}
              className="rounded-xl p-2 text-slate-500 hover:bg-white hover:text-slate-900"
              aria-label="선택 학생 해제"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[360px] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-[#2F6B3B]">
              <Sparkles className="h-7 w-7" />
            </div>
            <p className="mt-5 text-base font-extrabold text-slate-900">
              무엇을 확인해드릴까요?
            </p>
            <p className="mt-2 max-w-[310px] text-xs leading-5 text-slate-500">
              학생 조회, 누락 점검, 위험 분석 등 CRM 업무에 대해 자유롭게 질문해주세요.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {messages.map((message) => {
              const isUser = message.role === "user";
              const isError = message.kind === "error";

              return (
                <div
                  key={message.id}
                  className={cn("flex gap-2.5", isUser ? "justify-end" : "justify-start")}
                >
                  {!isUser && (
                    <div
                      className={cn(
                        "mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                        isError
                          ? "bg-red-50 text-red-600"
                          : "bg-emerald-50 text-[#2F6B3B]"
                      )}
                    >
                      {isError ? (
                        <AlertCircle className="h-4 w-4" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                    </div>
                  )}

                 <div
  className={cn(
        message.kind === "student_summary" ||
message.kind === "student_risk" ||
message.kind === "organization_risk" ||
message.kind === "student_registration_preview" ||
message.kind === "student_registration_result" ||
message.kind === "document_analysis"
      ? "min-w-0 flex-1"
      : "max-w-[86%]",
    isUser
      ? "rounded-2xl rounded-br-md bg-[#2F6B3B] px-4 py-3 text-white"
      : "text-slate-800"
  )}
>
                    {isUser ? (
                      <p className="whitespace-pre-wrap break-words text-sm leading-6">
                        {message.content}
                      </p>
                    ) : (
                      <div
  className={cn(
    "text-sm leading-6",
        message.kind === "student_summary" ||
message.kind === "student_risk" ||
message.kind === "organization_risk" ||
message.kind === "student_registration_preview" ||
message.kind === "student_registration_result" ||
message.kind === "document_analysis"
  ? "rounded-none border-0 bg-transparent p-0 shadow-none"
  : "rounded-2xl rounded-bl-md border px-4 py-3 shadow-sm",
    isError
      ? "border-red-200 bg-red-50 text-red-800"
      : message.kind === "warning"
      ? "border-amber-200 bg-amber-50 text-slate-800"
          : message.kind === "student_summary" ||
  message.kind === "student_risk" ||
  message.kind === "organization_risk" ||
  message.kind === "student_registration_preview" ||
  message.kind === "student_registration_result" ||
  message.kind === "document_analysis"
? "text-slate-800"
: "border-slate-200 bg-white text-slate-800"
  )}
>
                       <DashboardAIMessageRenderer
  message={message}
  selectedStudent={
    selectedStudent
  }
  isLoading={isLoading}
  onSelectStudent={
    onSelectStudent
  }
  onRequestDocumentImport={
    onRequestDocumentImport
  }
  onOpenStudent={onOpenStudent}
  onOpenConsultation={onOpenConsultation}
  onConfirmPendingAction={
    onConfirmPendingAction
  }
  onCancelPendingAction={
    onCancelPendingAction
  }
/>
                      </div>
                    )}

                    {message.createdAt && (
                      <p
                        className={cn(
                          "mt-1.5 text-[10px]",
                          isUser ? "text-right text-white/60" : "text-slate-400"
                        )}
                      >
                        {message.createdAt}
                      </p>
                    )}
                  </div>

                  {isUser && (
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-200 text-slate-600">
                      <User className="h-4 w-4" />
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-start gap-2.5">
                <div className="mt-1 flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-[#2F6B3B]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    CRM 데이터를 확인하고 있어요...
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-200 bg-white p-3">
<input
  ref={
    fileInputRef
  }
  type="file"
  accept="image/jpeg,image/png,image/webp"
  className="hidden"
  onChange={
    handleDocumentFileChange
  }
/>
        {errorMessage && (
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="flex items-end gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm focus-within:border-emerald-300 focus-within:ring-2 focus-within:ring-emerald-100">
          <Textarea
  ref={
    textareaRef
  }
  value={
    input
  }
  onChange={
    (
      event
    ) =>
      setInput(
        event.target.value
      )
  }
  onPaste={
    handleImagePaste
  }
  onKeyDown={
    (
      event
    ) => {
      if (
        event
          .nativeEvent
          .isComposing
      ) {
        return;
      }

      if (
        event.key ===
          "Enter" &&
        !event.shiftKey
      ) {
        event.preventDefault();

        void submit();
      }
    }
  }
  placeholder={
    onAnalyzeDocument
      ? "CRM 업무를 질문하거나 스크린샷을 Ctrl+V로 붙여넣으세요."
      : "CRM 업무에 대해 질문해주세요."
  }
  disabled={
    isLoading
  }
  rows={
    1
  }
  className="max-h-[140px] min-h-[38px] flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
/>

{onAnalyzeDocument && (
  <button
    type="button"
    onClick={() => {
      fileInputRef
        .current
        ?.click();
    }}
    disabled={
      isLoading
    }
    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-[#2F6B3B] disabled:cursor-not-allowed disabled:opacity-50"
    aria-label="이미지 문서 선택"
    title="이미지 문서 선택"
  >
    <ImagePlus className="h-4 w-4" />
  </button>
)}

          <button
            type="button"
            onClick={() => void submit()}
            disabled={isLoading || !input.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#2F6B3B] text-white transition hover:bg-[#285d33] disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
            aria-label="메시지 전송"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </button>
        </div>

        <p className="mt-2 text-center text-[10px] text-slate-400">
  {onAnalyzeDocument
    ? "Enter 전송 · 이미지 선택 또는 Ctrl+V 스크린샷 분석 · 결과는 저장 전 확인해주세요."
    : "Enter 전송 · Shift+Enter 줄바꿈 · 결과는 실행 전 확인해주세요."}
</p>
      </div>
    </div>
  );
}
