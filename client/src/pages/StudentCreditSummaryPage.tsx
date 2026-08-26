import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  ArrowLeft,
  Loader2,
  CheckCircle2,
User,
  BrainCircuit,
  ShieldCheck,
  BookOpen,
  GraduationCap,
  CalendarDays,
  ClipboardCheck,
} from "lucide-react";

export default function StudentCreditSummaryPage() {
  const params = useParams<{ id: string }>();
  const studentId = Number(params.id || 0);
  const [location, setLocation] = useLocation();

const organizationSlug = location.split("/").filter(Boolean)[0];

  const {
  data,
  isLoading,
  refetch,
} = trpc.creditSummary.student.getSummary.useQuery(
  { studentId },
  { enabled: !!studentId }
);

  const summary = data?.summary;
  const student = data?.student;
  const plan = data?.plan;
  const rule = data?.rule;

const administrativeProcedures =
  data?.administrativeProcedures ?? [];

const aiNotes =
  data?.aiNotes ?? [];

const aiEvents =
  data?.aiEvents ?? [];

const unreadAiEventCount =
  Number(
    data?.unreadAiEventCount ??
    0
  );

/**
 * ─────────────────────────────
 * AI 학점요약 공통엔진 결과
 * ─────────────────────────────
 *
 * summary:
 * 기존 학점요약 화면 호환용
 *
 * engine:
 * 공통엔진 기반 최종 AI 학업분석
 */
const engine = data?.engine;

const requirements =
  data?.requirements ??
  engine?.requirements;

const riskSummary =
  data?.riskSummary ??
  engine?.summary;

const academicSummary =
  data?.academicSummary ??
  engine?.academicSummary;

const semesterPlan =
  data?.semesterPlan ??
  engine?.semesterPlan;

const aiIssues =
  data?.issues ??
  engine?.issues ??
  [];

const academicRiskIssues =
  aiIssues.filter(
    (
      issue: any
    ) => {
      const code =
        String(
          issue?.code ||
          ""
        ).trim();

      if (!code) {
        return false;
      }

      /**
       * 아직 이수하지 않았다는 의미일 뿐
       * 실제 설계오류가 아닌 항목은
       * AI 위험도 검사에서 제외한다.
       */
      if (
        code ===
          "CREDIT_RULE_MISSING" ||
        code ===
          "TOTAL_CREDIT_SHORTAGE" ||
        code ===
          "PRACTICE_NOT_COMPLETED" ||
        code.startsWith(
          "CATEGORY_SHORTAGE_"
        ) ||
        code.endsWith(
          "_SUBJECT_SHORTAGE"
        ) ||
        (
          code.startsWith(
            "DEGREE_"
          ) &&
          code.endsWith(
            "_SHORTAGE"
          )
        )
      ) {
        return false;
      }

      /**
       * 결제/학생정보/플랜 유무는
       * 학업 설계 위험도와 별개다.
       */
      if (
        code.startsWith(
          "PAYMENT_"
        ) ||
        code ===
          "STUDENT_COURSE_MISSING" ||
        code ===
          "PLAN_MISSING" ||
        code ===
          "PLAN_SUBJECTS_MISSING"
      ) {
        return false;
      }

      return true;
    }
  );

const [settingOpen, setSettingOpen] = useState(false);

const [ruleForm, setRuleForm] = useState({
  requiredTotalCredits: "",
  requiredMajorRequiredSubjects: "",
  requiredMajorRequiredCredits: "",
  requiredMajorElectiveSubjects: "",
  requiredMajorElectiveCredits: "",
  requiredLiberalSubjects: "",
  requiredLiberalCredits: "",
  requiredGeneralSubjects: "",
  requiredGeneralCredits: "",
});

const RULE_PRESETS = {
  socialWorker2: {
    label: "사회복지사 2급",
    values: {
      requiredTotalCredits: "51",
      requiredMajorRequiredSubjects: "10",
      requiredMajorRequiredCredits: "30",
      requiredMajorElectiveSubjects: "7",
      requiredMajorElectiveCredits: "21",
      requiredLiberalSubjects: "0",
      requiredLiberalCredits: "0",
      requiredGeneralSubjects: "0",
      requiredGeneralCredits: "0",
    },
  },
};

const [selectedPreset, setSelectedPreset] = useState("");

const createRuleMut = trpc.creditSummary.rules.create.useMutation({
  onError: (e) => toast.error(e.message),
});

const updateRuleMut = trpc.creditSummary.rules.update.useMutation({
  onError: (e) => toast.error(e.message),
});

const administrativeProcedureMut =
  trpc.creditSummary.administrativeProcedures.upsert.useMutation({
    onError: (e) =>
      toast.error(
        e.message ||
        "행정절차 상태 변경 중 오류가 발생했습니다."
      ),
  });

const updateAiNoteStatusMut =
  trpc.creditSummary.aiManagement.updateNoteStatus.useMutation({
    onError: (e) =>
      toast.error(
        e.message ||
        "AI 메모 상태 변경 중 오류가 발생했습니다."
      ),
  });

const markAiEventReadMut =
  trpc.creditSummary.aiManagement.markEventRead.useMutation({
    onError: (e) =>
      toast.error(
        e.message ||
        "AI 업데이트 확인 처리 중 오류가 발생했습니다."
      ),
  });

const markAllAiEventsReadMut =
  trpc.creditSummary.aiManagement.markAllEventsRead.useMutation({
    onError: (e) =>
      toast.error(
        e.message ||
        "AI 업데이트 전체 확인 중 오류가 발생했습니다."
      ),
  });

useEffect(() => {
  if (!rule) {
    setRuleForm({
      requiredTotalCredits: "",
      requiredMajorRequiredSubjects: "",
      requiredMajorRequiredCredits: "",
      requiredMajorElectiveSubjects: "",
      requiredMajorElectiveCredits: "",
      requiredLiberalSubjects: "",
      requiredLiberalCredits: "",
      requiredGeneralSubjects: "",
      requiredGeneralCredits: "",
    });
    return;
  }

  setRuleForm({
    requiredTotalCredits: String(rule.requiredTotalCredits ?? ""),
    requiredMajorRequiredSubjects: String(rule.requiredMajorRequiredSubjects ?? ""),
    requiredMajorRequiredCredits: String(rule.requiredMajorRequiredCredits ?? ""),
    requiredMajorElectiveSubjects: String(rule.requiredMajorElectiveSubjects ?? ""),
    requiredMajorElectiveCredits: String(rule.requiredMajorElectiveCredits ?? ""),
    requiredLiberalSubjects: String(rule.requiredLiberalSubjects ?? ""),
    requiredLiberalCredits: String(rule.requiredLiberalCredits ?? ""),
    requiredGeneralSubjects: String(rule.requiredGeneralSubjects ?? ""),
    requiredGeneralCredits: String(rule.requiredGeneralCredits ?? ""),
  });
}, [rule]);

const toFormNumber = (value: string) => {
  return Number(String(value || "0").replace(/[^0-9]/g, "")) || 0;
};

const handleRuleFormChange = (key: keyof typeof ruleForm, value: string) => {
  setRuleForm((prev) => ({
    ...prev,
    [key]: value.replace(/[^0-9]/g, ""),
  }));
};

const applyRulePreset = (presetKey: string) => {
  setSelectedPreset(presetKey);

  if (!presetKey) return;

  const preset =
    RULE_PRESETS[presetKey as keyof typeof RULE_PRESETS];

  if (!preset) return;

  setRuleForm(preset.values);

  toast.success(`${preset.label} 기준이 자동 입력되었습니다.`);
};

const saveRuleSetting = async () => {
  const courseName = String(plan?.desiredCourse || student?.course || "")
    .split(",")[0]
    ?.trim();

  const finalEducation = String(plan?.finalEducation || "").trim();

  const payload = {
  studentId,
  courseName: courseName || null,
  finalEducation: finalEducation || null,

    requiredTotalCredits: toFormNumber(ruleForm.requiredTotalCredits),

    requiredMajorRequiredSubjects: toFormNumber(ruleForm.requiredMajorRequiredSubjects),
    requiredMajorRequiredCredits: toFormNumber(ruleForm.requiredMajorRequiredCredits),

    requiredMajorElectiveSubjects: toFormNumber(ruleForm.requiredMajorElectiveSubjects),
    requiredMajorElectiveCredits: toFormNumber(ruleForm.requiredMajorElectiveCredits),

    requiredLiberalSubjects: toFormNumber(ruleForm.requiredLiberalSubjects),
    requiredLiberalCredits: toFormNumber(ruleForm.requiredLiberalCredits),

    requiredGeneralSubjects: toFormNumber(ruleForm.requiredGeneralSubjects),
    requiredGeneralCredits: toFormNumber(ruleForm.requiredGeneralCredits),

    allowMajorElectiveOver: false,
    allowLiberalOver: true,
    allowGeneralOver: true,
    duplicateCheckEnabled: true,
    isActive: true,
    memo: null,
  };

  if (payload.requiredTotalCredits <= 0) {
    toast.error("총 필요 학점을 입력해주세요.");
    return;
  }

  try {
    if (rule?.id) {
      await updateRuleMut.mutateAsync({
        id: Number(rule.id),
        ...payload,
      });
      toast.success("학점 요약 기준이 수정되었습니다.");
    } else {
      await createRuleMut.mutateAsync(payload);
      toast.success("학점 요약 기준이 저장되었습니다.");
    }

    await refetch();
    setSettingOpen(false);
  } catch (e: any) {
    toast.error(e.message || "기준 저장 중 오류가 발생했습니다.");
  }
};

const updateAdministrativeProcedureStatus =
  async (
    procedureType:
      | "learner_registration"
      | "credit_recognition"
      | "degree_application"
      | "qualification_application",

    status:
      | "not_started"
      | "in_progress"
      | "completed"
      | "review_required"
  ) => {
    try {
      await administrativeProcedureMut.mutateAsync({
        studentId,
        procedureType,
        status,
        reportedDate: null,
        evidenceSummary: null,
        referenceType: null,
        referenceId: null,
        memo: null,
      });

      toast.success(
        "행정절차 상태가 변경되었습니다."
      );

      await refetch();
    } catch {
      /**
       * mutation onError에서 표시
       */
    }
  };

const updateAiNoteStatus =
  async (
    noteId: number,
    status:
      | "info"
      | "action_required"
      | "in_progress"
      | "resolved"
      | "dismissed"
  ) => {
    try {
      await updateAiNoteStatusMut.mutateAsync({
        studentId,
        noteId,
        status,
      });

      toast.success(
        "AI 관리 메모 상태가 변경되었습니다."
      );

      await refetch();
    } catch {
      // mutation onError
    }
  };

const markAiEventRead =
  async (
    eventId: number
  ) => {
    try {
      await markAiEventReadMut.mutateAsync({
        studentId,
        eventId,
      });

      await refetch();
    } catch {
      // mutation onError
    }
  };

const markAllAiEventsRead =
  async () => {
    if (
      unreadAiEventCount <= 0
    ) {
      return;
    }

    try {
      await markAllAiEventsReadMut.mutateAsync({
        studentId,
      });

      toast.success(
        "AI 업데이트를 모두 확인 처리했습니다."
      );

      await refetch();
    } catch {
      // mutation onError
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!student || !summary) {
    return (
      <div className="space-y-4">
        <Button
  variant="ghost"
  onClick={() =>
  setLocation(`/${organizationSlug}/students/${studentId}`)
}
>
          <ArrowLeft className="h-4 w-4 mr-2" />
          상세페이지로
        </Button>
        <p className="text-center text-muted-foreground py-20">
          학생 요약 정보를 찾을 수 없습니다.
        </p>
      </div>
    );
  }

const aiRiskLevel =
  String(
    riskSummary?.riskLevel ||
    "normal"
  );

const aiRiskLabel =
  aiRiskLevel === "danger"
    ? "위험"
    : aiRiskLevel === "warning"
      ? "주의"
      : "정상";

const aiRiskBadgeClass =
  aiRiskLevel === "danger"
    ? "bg-red-50 text-red-700 border-red-200"
    : aiRiskLevel === "warning"
      ? "bg-amber-50 text-amber-700 border-amber-200"
      : "bg-emerald-50 text-emerald-700 border-emerald-200";

const aiRiskScore =
  Number(
    riskSummary?.riskScore ||
    0
  );

const aiDuplicateSubjectCount =
  Number(
    riskSummary?.duplicateSubjectCount ||
    0
  );

const aiPracticeRequestCount =
  Number(
    riskSummary?.practiceRequestCount ||
    0
  );

const aiDangerCount =
  Number(
    riskSummary?.dangerCount ||
    0
  );

const aiWarningCount =
  Number(
    riskSummary?.warningCount ||
    0
  );

const aiInfoCount =
  Number(
    riskSummary?.infoCount ||
    0
  );

const requiredSubjectCount =
  riskSummary?.requiredSubjectCount ??
  null;

const completedSubjectCount =
  Number(
    riskSummary?.completedSubjectCount ??
    0
  );

const inProgressSubjectCount =
  Number(
    riskSummary?.inProgressSubjectCount ??
    0
  );

const scheduledSubjectCount =
  Number(
    riskSummary?.scheduledSubjectCount ??
    0
  );

const retakeRequiredSubjectCount =
  Number(
    riskSummary?.retakeRequiredSubjectCount ??
    0
  );

const reviewRequiredSubjectCount =
  Number(
    riskSummary?.reviewRequiredSubjectCount ??
    0
  );

const unassignedSubjectCount =
  riskSummary?.unassignedSubjectCount ??
  null;

const completionProgressPercent =
  riskSummary?.completionProgressPercent ??
  null;

const plannedProgressPercent =
  riskSummary?.plannedProgressPercent ??
  null;

const qualificationSummary =
  academicSummary?.qualification;

const degreeSummary =
  academicSummary?.degree;

/**
 * ─────────────────────────────
 * 공통엔진 필요요건 표시 데이터
 * ─────────────────────────────
 *
 * 과정별 자격요건은 서버 공통엔진의
 * displayRequirements를 그대로 사용한다.
 *
 * 프론트에서는 사회복지 / 보육 / 한국어 등
 * 과정명을 직접 판별하지 않는다.
 */
/**
 * ─────────────────────────────
 * 공통엔진 통합 필요요건 표시 데이터
 * ─────────────────────────────
 *
 * 학위 / 자격요건 모두 서버 공통엔진에서
 * 계산 완료된 displayRequirements만 사용한다.
 *
 * 프론트에서는
 * - 최종학력
 * - 과정명
 * - 필요학점
 * - 필요과목
 * 을 다시 계산하지 않는다.
 */
const combinedRequirements =
  requirements?.combined ??
  null;

const requirementDisplayMode =
  combinedRequirements
    ?.displayMode ??
  "qualification_only";

const degreeDisplayRequirements =
  combinedRequirements
    ?.displayRequirements
    ?.degree ??
  [];

const qualificationDisplayRequirements =
  combinedRequirements
    ?.displayRequirements
    ?.qualification ??
  [];

const unifiedDisplayRequirements = [
  ...qualificationDisplayRequirements.map(
    (
      requirement: any
    ) => ({
      ...requirement,

      sourceType:
        "qualification" as const,
    })
  ),

  ...degreeDisplayRequirements.map(
    (
      requirement: any
    ) => ({
      ...requirement,

      sourceType:
        "degree" as const,
    })
  ),
];

const studyPlanSummary =
  academicSummary?.studyPlan;

const timelineSummary =
  academicSummary?.timeline;

const getAdministrativeProcedure = (
  procedureType:
    | "learner_registration"
    | "credit_recognition"
    | "degree_application"
    | "qualification_application"
) => {
  return (
    administrativeProcedures.find(
      (item: any) =>
        item?.procedureType ===
        procedureType
    ) ?? null
  );
};

const learnerRegistrationProcedure =
  getAdministrativeProcedure(
    "learner_registration"
  );

const creditRecognitionProcedure =
  getAdministrativeProcedure(
    "credit_recognition"
  );

const degreeApplicationProcedure =
  getAdministrativeProcedure(
    "degree_application"
  );

const qualificationApplicationProcedure =
  getAdministrativeProcedure(
    "qualification_application"
  );

const academicWarnings =
  academicSummary?.warnings ?? [];

const academicUnresolvedReasons =
  academicSummary?.unresolvedReasons ?? [];

const academicSummaryLines =
  academicSummary?.summaryLines ?? [];

/**
 * 상세페이지에 실제 등록되어 있는 기존 학기.
 *
 * academicSummary.studyPlan을 우선 사용하고,
 * 없을 경우 Semester Planner 원본 결과를 사용한다.
 */
const existingAcademicSemesters =
  studyPlanSummary?.existingSemesters ??
  semesterPlan?.existingSemesters ??
  [];

const actualSemesterCount =
  existingAcademicSemesters
    .filter(
      (
        semester: any
      ) =>
        Number(
          semester
            ?.semesterOrder ||
          0
        ) >
        0
    )
    .length;

const academicSubjects =
  engine?.subjects ??
  [];

const actualPlanSubjects =
  academicSubjects.filter(
    (subject: any) =>
      subject?.source ===
      "plan"
  );

const actualSemesterNumbers =
  Array.from(
    new Set(
      actualPlanSubjects
        .map(
          (subject: any) =>
            Number(
              subject?.semesterNo ||
              0
            )
        )
        .filter(
          (semesterNo: number) =>
            Number.isFinite(
              semesterNo
            ) &&
            semesterNo > 0
        )
    )
  ).sort(
    (
      left,
      right
    ) =>
      left - right
  );

const getExistingSemester =
  (
    semesterNo: number
  ) =>
    existingAcademicSemesters.find(
      (semester: any) =>
        Number(
          semester?.semesterOrder ||
          0
        ) ===
        semesterNo
    ) ??
    null;

const getSemesterSubjects =
  (
    semesterNo: number
  ) =>
    actualPlanSubjects.filter(
      (subject: any) =>
        Number(
          subject?.semesterNo ||
          0
        ) ===
        semesterNo
    );

const getProgressLabel =
  (
    progressStatus:
      string | null | undefined
  ) => {
    switch (
      progressStatus
    ) {
      case "completed":
        return "수강완료";

      case "in_progress":
        return "진행중";

      case "scheduled":
        return "예정";

      case "retake_required":
        return "재수강 필요";

      case "review_required":
        return "확인 필요";

      default:
        return "확인 필요";
    }
  };

const getProgressBadgeClass =
  (
    progressStatus:
      string | null | undefined
  ) => {
    switch (
      progressStatus
    ) {
      case "completed":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";

      case "in_progress":
        return "bg-blue-50 text-blue-700 border-blue-200";

      case "scheduled":
        return "bg-slate-50 text-slate-700 border-slate-200";

      case "retake_required":
        return "bg-red-50 text-red-700 border-red-200";

      case "review_required":
        return "bg-amber-50 text-amber-700 border-amber-200";

      default:
        return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

const getSubjectValidationLabel = (
  status:
    | "normal"
    | "warning"
    | "danger"
    | string
    | null
    | undefined
) => {
  switch (status) {
    case "danger":
      return "설계 오류";

    case "warning":
      return "확인 필요";

    case "normal":
    default:
      return "정상";
  }
};

const getSubjectValidationBadgeClass = (
  status:
    | "normal"
    | "warning"
    | "danger"
    | string
    | null
    | undefined
) => {
  switch (status) {
    case "danger":
      return "bg-red-50 text-red-700 border-red-200";

    case "warning":
      return "bg-amber-50 text-amber-700 border-amber-200";

    case "normal":
    default:
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
  }
};

const getSubjectValidationContainerClass = (
  status:
    | "normal"
    | "warning"
    | "danger"
    | string
    | null
    | undefined
) => {
  switch (status) {
    case "danger":
      return "border-red-200 bg-red-50/40";

    case "warning":
      return "border-amber-200 bg-amber-50/40";

    case "normal":
    default:
      return "border-slate-200 bg-white";
  }
};

const normalizeDisplayDate = (
  value: unknown
): string | null => {
  const raw =
    String(
      value ??
      ""
    ).trim();

  if (!raw) {
    return null;
  }

  /**
   * 이미 YYYY-MM-DD 형태라면 그대로 사용
   */
  const directMatch =
    raw.match(
      /^(\d{4}-\d{2}-\d{2})/
    );

  if (directMatch) {
    return directMatch[1];
  }

  /**
   * DB Date 문자열 처리
   *
   * 예:
   * Fri Aug 28 2026 00:00:00 GMT+0000
   */
  const parsed =
    new Date(raw);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return null;
  }

  const year =
    parsed.getUTCFullYear();

  const month =
    String(
      parsed.getUTCMonth() +
      1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      parsed.getUTCDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
};

const actualStudyStartDate =
  existingAcademicSemesters
    .map(
      (
        semester: any
      ) =>
        normalizeDisplayDate(
          semester
            ?.actualStartDate
        )
    )
    .filter(
      (
        value:
          string | null
      ): value is string =>
        Boolean(value)
    )
    .sort()[0] ??
  null;

const displayStudyStartDate =
  actualStudyStartDate;

const qualificationRequiredSubjects =
  qualificationSummary?.requiredSubjects ?? null;

const qualificationCompletedSubjects =
  qualificationSummary?.completedSubjects ?? null;

const qualificationRemainingSubjects =
  qualificationSummary?.remainingSubjects ?? null;

const qualificationRequiredCredits =
  qualificationSummary?.requiredCredits ?? null;

const qualificationCompletedCredits =
  qualificationSummary?.completedCredits ?? null;

const qualificationRemainingCredits =
  qualificationSummary?.remainingCredits ?? null;

const qualificationPracticeHours =
  qualificationSummary?.practiceHours ?? null;

const requiresNewDegreeTrack =
  Boolean(
    degreeSummary?.requiresNewDegreeTrack
  );

const degreeRequiredTotalCredits =
  degreeSummary?.requiredTotalCredits ?? null;

const degreeCurrentTotalCredits =
  degreeSummary?.currentTotalCredits ?? 0;

const degreeRemainingTotalCredits =
  degreeSummary?.remainingTotalCredits ?? null;

const degreeRequiredMajorCredits =
  degreeSummary?.requiredMajorCredits ?? null;

const degreeCurrentMajorCredits =
  degreeSummary?.currentMajorCredits ?? 0;

const degreeRemainingMajorCredits =
  degreeSummary?.remainingMajorCredits ?? null;

const degreeRequiredLiberalCredits =
  degreeSummary?.requiredLiberalCredits ?? null;

const degreeCurrentLiberalCredits =
  degreeSummary?.currentLiberalCredits ?? 0;

const degreeRemainingLiberalCredits =
  degreeSummary?.remainingLiberalCredits ?? null;

const degreeCurrentGeneralCredits =
  degreeSummary?.currentGeneralCredits ?? 0;

const additionalSubjectCount =
  Math.max(
    Number(
      qualificationRequiredSubjects ||
      0
    ) -
      (
        completedSubjectCount +
        inProgressSubjectCount +
        scheduledSubjectCount
      ),
    0
  );

const additionalCredits =
  studyPlanSummary?.additionalCredits ?? 0;

const totalStudySemesterCount =
  actualSemesterCount;

const nominalDurationMonths =
  actualSemesterCount *
  4;

const estimatedStudyEndDate =
  studyPlanSummary?.estimatedStudyEndDate ?? null;

const academicCompletionDate =
  timelineSummary?.academicCompletionDate ?? null;

const creditRecognitionLabel =
  timelineSummary?.creditRecognitionLabel ?? null;

const degreeApplicationLabel =
  timelineSummary?.degreeApplicationLabel ?? null;

const degreeAwardLabel =
  timelineSummary?.degreeAwardLabel ?? null;

const qualificationEstimatedDate =
  timelineSummary?.qualificationEstimatedDate ?? null;

const qualificationMessage =
  timelineSummary?.qualificationMessage ?? "";

const academicStatus =
  academicSummary?.status ?? "review_required";

const academicCanExplain =
  Boolean(
    academicSummary?.canExplain
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button
  variant="ghost"
  size="icon"
  onClick={() =>
  setLocation(`/${organizationSlug}/students/${studentId}`)
}
>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1">
  <div className="flex flex-wrap items-center gap-2">
    <h1 className="text-xl font-bold tracking-tight">
      AI 학점요약
    </h1>

    <Badge
      variant="outline"
      className="bg-blue-50 text-blue-700 border-blue-200"
    >
      <BrainCircuit className="h-3.5 w-3.5 mr-1" />
      공통엔진 기반
    </Badge>

    <Badge
      variant="outline"
      className="bg-violet-50 text-violet-700 border-violet-200"
    >
      AI 자동분석
    </Badge>
  </div>

    <p className="text-sm text-muted-foreground mt-1">
    상세페이지의 원본 데이터를 기반으로 학점, 과목, 학위·자격요건,
    학기, 행정절차 및 위험도를 자동 분석합니다.
  </p>
</div>

      </div>

{/* ─────────────────────────────
    공통엔진 학습 진행현황 + 설계검사
───────────────────────────── */}
<Card className="border-blue-100 bg-gradient-to-r from-blue-50/60 to-white shadow-sm">
  <CardContent className="p-5">
    <div className="flex flex-col gap-5">
      <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-blue-600" />

              <h2 className="font-bold">
                학습 진행현황
              </h2>
            </div>

            <Badge
              variant="outline"
              className={aiRiskBadgeClass}
            >
              설계검사 {aiRiskLabel}
            </Badge>
          </div>

          <p className="text-sm text-muted-foreground mt-2">
            상세페이지의 실제 학기·과목과 공통엔진 기준을 비교한 현재 학습 진행상태입니다.
            아직 이수하지 않은 과목은 위험으로 처리하지 않으며,
            중복·잘못된 과목·설계 오류만 위험도로 표시합니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge
            variant="outline"
            className="bg-white"
          >
            설계 오류 {aiDangerCount + aiWarningCount}건
          </Badge>

          {retakeRequiredSubjectCount > 0 && (
            <Badge
              variant="outline"
              className="bg-red-50 text-red-700 border-red-200"
            >
              재수강 필요 {retakeRequiredSubjectCount}과목
            </Badge>
          )}

          {reviewRequiredSubjectCount > 0 && (
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-700 border-amber-200"
            >
              확인 필요 {reviewRequiredSubjectCount}과목
            </Badge>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-muted-foreground">
            전체 필요
          </p>

          <p className="text-2xl font-bold mt-1">
            {requiredSubjectCount !== null
              ? `${requiredSubjectCount}과목`
              : "-"}
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-muted-foreground">
            수강완료
          </p>

          <p className="text-2xl font-bold mt-1">
            {completedSubjectCount}과목
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-muted-foreground">
            진행중
          </p>

          <p className="text-2xl font-bold text-blue-600 mt-1">
            {inProgressSubjectCount}과목
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-muted-foreground">
            예정
          </p>

          <p className="text-2xl font-bold mt-1">
            {scheduledSubjectCount}과목
          </p>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <p className="text-xs text-muted-foreground">
            미배치
          </p>

          <p className="text-2xl font-bold mt-1">
            {unassignedSubjectCount !== null
              ? `${unassignedSubjectCount}과목`
              : "-"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">
              수강완료 진행률
            </p>

            <p className="text-sm font-bold">
              {completionProgressPercent !== null
                ? `${completionProgressPercent}%`
                : "-"}
            </p>
          </div>

          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden mt-3">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{
                width: `${Math.max(
                  0,
                  Math.min(
                    Number(
                      completionProgressPercent ??
                      0
                    ),
                    100
                  )
                )}%`,
              }}
            />
          </div>
        </div>

        <div className="rounded-xl border bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">
              학습계획 진행률
            </p>

            <p className="text-sm font-bold">
              {plannedProgressPercent !== null
                ? `${plannedProgressPercent}%`
                : "-"}
            </p>
          </div>

          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden mt-3">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{
                width: `${Math.max(
                  0,
                  Math.min(
                    Number(
                      plannedProgressPercent ??
                      0
                    ),
                    100
                  )
                )}%`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-white p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              설계 오류 검사
            </p>

            <p className="text-xs text-muted-foreground mt-1">
              현재 등록된 과목과 학기계획에서 실제 문제가 있는 항목만 집계합니다.
            </p>
          </div>

          <Badge
            variant="outline"
            className={aiRiskBadgeClass}
          >
            {aiRiskLabel}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="rounded-lg border bg-slate-50 p-3 text-center">
            <p className="text-xs text-muted-foreground">
              위험
            </p>

            <p className="text-lg font-bold text-red-600 mt-1">
              {aiDangerCount}
            </p>
          </div>

          <div className="rounded-lg border bg-slate-50 p-3 text-center">
            <p className="text-xs text-muted-foreground">
              주의
            </p>

            <p className="text-lg font-bold text-amber-600 mt-1">
              {aiWarningCount}
            </p>
          </div>

          <div className="rounded-lg border bg-slate-50 p-3 text-center">
            <p className="text-xs text-muted-foreground">
              참고
            </p>

            <p className="text-lg font-bold text-blue-600 mt-1">
              {aiInfoCount}
            </p>
          </div>
        </div>
      </div>
    </div>
  </CardContent>
</Card>

      <div className="space-y-5">
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1.45fr_1fr_1fr_1fr_1fr] gap-3">
            <Card className="border shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-full bg-blue-50 flex items-center justify-center">
                    <User className="h-7 w-7 text-blue-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-lg font-bold">{student.clientName} 학생</p>
                      <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200">
  <ShieldCheck className="h-3 w-3 mr-1" />
  공통엔진 적용
</Badge>

<Button
  type="button"
  size="sm"
  variant="outline"
  className="h-7 px-2 text-xs"
  onClick={() =>
    setSettingOpen(
      (prev) => !prev
    )
  }
>
  담당자 기준 확인
</Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      최종학력 : {plan?.finalEducation || "-"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      과정 : {plan?.desiredCourse || student.course || "-"}
                    </p>
<p className="text-sm text-muted-foreground">
  공통엔진 과정 : {academicSummary?.course?.courseLabel || "-"}
</p>

<p className="text-sm text-muted-foreground">
  적용기준 : {academicSummary?.course?.lawLabel || "-"}
</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm lg:col-span-4">
  <CardContent className="p-5">
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-blue-600" />

            <h2 className="text-base font-bold">
              전체 과정 요약
            </h2>
          </div>

          <p className="text-xs text-muted-foreground mt-1">
            현재 학력과 인정내역을 기준으로 공통엔진이 계산한 최종 학습과정입니다.
          </p>
        </div>

        <Badge
          variant="outline"
          className={
            academicStatus === "ready"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
          }
        >
          {academicStatus === "ready"
            ? "설계 완료"
            : "확인 필요"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-slate-50 p-4">
          <p className="text-xs text-muted-foreground">
            자격 필요과목
          </p>

          <div className="flex items-end gap-1 mt-2">
            <span className="text-2xl font-bold">
              {qualificationRequiredSubjects ?? "-"}
            </span>

            {qualificationRequiredSubjects !== null && (
              <span className="text-sm text-muted-foreground mb-0.5">
                과목
              </span>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            인정 {qualificationCompletedSubjects ?? "-"}과목
          </p>
        </div>

        <div className="rounded-xl border bg-slate-50 p-4">
          <p className="text-xs text-muted-foreground">
            앞으로 필요한 과목
          </p>

          <div className="flex items-end gap-1 mt-2">
            <span
              className={`text-2xl font-bold ${
                additionalSubjectCount > 0
                  ? "text-blue-600"
                  : "text-emerald-600"
              }`}
            >
              {additionalSubjectCount}
            </span>

            <span className="text-sm text-muted-foreground mb-0.5">
              과목
            </span>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            총 {additionalCredits}학점
          </p>
        </div>

        <div className="rounded-xl border bg-slate-50 p-4">
          <p className="text-xs text-muted-foreground">
            예상 학습기간
          </p>

          <div className="flex items-end gap-1 mt-2">
            <span className="text-2xl font-bold">
  {totalStudySemesterCount}
</span>

            <span className="text-sm text-muted-foreground mb-0.5">
              학기
            </span>
          </div>

          <p className="text-xs text-muted-foreground mt-2">
            약 {nominalDurationMonths}개월
          </p>
        </div>

        <div className="rounded-xl border bg-slate-50 p-4">
          <p className="text-xs text-muted-foreground">
            학위과정
          </p>

          <p
            className={`text-lg font-bold mt-2 ${
              requiresNewDegreeTrack
                ? "text-amber-600"
                : "text-emerald-600"
            }`}
          >
            {requiresNewDegreeTrack
              ? "추가 학위 필요"
              : "추가 학위 없음"}
          </p>

          <p className="text-xs text-muted-foreground mt-2">
            {requiresNewDegreeTrack
              ? `총 ${degreeRequiredTotalCredits ?? "-"}학점 기준`
              : "현재 최종학력 기준"}
          </p>
        </div>
      </div>
    </div>
  </CardContent>
</Card>
          </div>

{settingOpen && (
  <Card className="border border-blue-100 bg-blue-50/40 shadow-sm">
    <CardContent className="p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold">
  담당자 기준 확인 / 보정
</h2>

<p className="text-sm text-muted-foreground mt-1">
  공통엔진 자동분석과 별도로 기존 담당자 기준값을 확인하거나 보정할 수 있습니다.
  현재 단계에서는 기존 데이터 호환을 위해 유지되며,
  이후 MANUAL_OVERRIDE 구조와 연결할 예정입니다.
</p>
        </div>

        <Badge variant="outline" className="bg-white">
  담당자 관리영역
</Badge>

<div className="mt-4">
  <p className="text-xs text-muted-foreground mb-1">
    과정 기본값
  </p>

  <select
    value={selectedPreset}
    onChange={(e) => applyRulePreset(e.target.value)}
    className="h-10 w-full md:w-64 rounded-md border border-input bg-white px-3 text-sm"
  >
    <option value="">직접 입력</option>

    {Object.entries(RULE_PRESETS).map(([key, preset]) => (
      <option key={key} value={key}>
        {preset.label}
      </option>
    ))}
  </select>
</div>
      </div>

<div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        <RuleInput
          label="총 필요 학점"
          value={ruleForm.requiredTotalCredits}
          onChange={(v) => handleRuleFormChange("requiredTotalCredits", v)}
        />

        <RuleInput
          label="전공필수 과목"
          value={ruleForm.requiredMajorRequiredSubjects}
          onChange={(v) => handleRuleFormChange("requiredMajorRequiredSubjects", v)}
        />
        <RuleInput
          label="전공필수 학점"
          value={ruleForm.requiredMajorRequiredCredits}
          onChange={(v) => handleRuleFormChange("requiredMajorRequiredCredits", v)}
        />

        <RuleInput
          label="전공선택 과목"
          value={ruleForm.requiredMajorElectiveSubjects}
          onChange={(v) => handleRuleFormChange("requiredMajorElectiveSubjects", v)}
        />
        <RuleInput
          label="전공선택 학점"
          value={ruleForm.requiredMajorElectiveCredits}
          onChange={(v) => handleRuleFormChange("requiredMajorElectiveCredits", v)}
        />

        <RuleInput
          label="교양 과목"
          value={ruleForm.requiredLiberalSubjects}
          onChange={(v) => handleRuleFormChange("requiredLiberalSubjects", v)}
        />
        <RuleInput
          label="교양 학점"
          value={ruleForm.requiredLiberalCredits}
          onChange={(v) => handleRuleFormChange("requiredLiberalCredits", v)}
        />

        <RuleInput
          label="일반 과목"
          value={ruleForm.requiredGeneralSubjects}
          onChange={(v) => handleRuleFormChange("requiredGeneralSubjects", v)}
        />
        <RuleInput
          label="일반 학점"
          value={ruleForm.requiredGeneralCredits}
          onChange={(v) => handleRuleFormChange("requiredGeneralCredits", v)}
        />
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => setSettingOpen(false)}
        >
          닫기
        </Button>

        <Button
          type="button"
          onClick={saveRuleSetting}
          disabled={createRuleMut.isPending || updateRuleMut.isPending}
        >
          {createRuleMut.isPending || updateRuleMut.isPending
            ? "저장중..."
            : rule
            ? "기준 수정"
            : "기준 저장"}
        </Button>
      </div>
    </CardContent>
  </Card>
)}

          {/* ─────────────────────────────
    공통엔진 필요과정
───────────────────────────── */}
<Card className="border border-blue-100 shadow-sm">
  <CardContent className="p-5">
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-blue-600" />

            <h2 className="text-base font-bold">
              필요과정
            </h2>
          </div>

          <p className="text-xs text-muted-foreground mt-1">
            현재 학력과 인정내역을 기준으로
            공통엔진이 계산한 전체 충족조건입니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={
              academicStatus ===
              "ready"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }
          >
            {academicStatus ===
            "ready"
              ? "분석 완료"
              : "확인 필요"}
          </Badge>

          <Badge
            variant="outline"
            className="bg-white"
          >
            {requirementDisplayMode ===
            "degree_and_qualification"
              ? "학위 + 자격 통합과정"
              : "자격과정"}
          </Badge>
        </div>
      </div>

      {unifiedDisplayRequirements.length ===
      0 ? (
        <div className="rounded-lg border bg-slate-50 p-4">
          <p className="text-sm text-muted-foreground">
            표시 가능한 필요조건이 없습니다.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {unifiedDisplayRequirements.map(
            (
              requirement: any
            ) => {
              const hasRequired =
                requirement
                  ?.required !==
                  null &&
                requirement
                  ?.required !==
                  undefined;

              const hasCurrent =
                requirement
                  ?.current !==
                  null &&
                requirement
                  ?.current !==
                  undefined;

              const hasRemaining =
                requirement
                  ?.remaining !==
                  null &&
                requirement
                  ?.remaining !==
                  undefined;

              const isCompleted =
                requirement
                  ?.status ===
                "completed";

              const isReviewRequired =
                requirement
                  ?.status ===
                "review_required";

              const isDegreeRequirement =
                requirement
                  ?.sourceType ===
                "degree";

              return (
                <div
                  key={`${requirement.sourceType}-${requirement.key}`}
                  className="rounded-xl border bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold">
                          {requirement
                            ?.label ||
                            "-"}
                        </p>

                        <Badge
                          variant="outline"
                          className={
                            isDegreeRequirement
                              ? "bg-violet-50 text-violet-700 border-violet-200"
                              : "bg-blue-50 text-blue-700 border-blue-200"
                          }
                        >
                          {isDegreeRequirement
                            ? "학위"
                            : "자격"}
                        </Badge>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={
                        isCompleted
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : isReviewRequired
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                      }
                    >
                      {isCompleted
                        ? "충족"
                        : isReviewRequired
                          ? "확인 필요"
                          : "진행중"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-4">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        필요
                      </p>

                      <p className="font-bold mt-1">
                        {hasRequired
                          ? `${requirement.required}${requirement.unit || ""}`
                          : "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        현재
                      </p>

                      <p className="font-bold mt-1">
                        {hasCurrent
                          ? `${requirement.current}${requirement.unit || ""}`
                          : "-"}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground">
                        남음
                      </p>

                      <p
                        className={`font-bold mt-1 ${
                          hasRemaining &&
                          Number(
                            requirement
                              .remaining
                          ) >
                            0
                            ? "text-blue-600"
                            : hasRemaining
                              ? "text-emerald-600"
                              : ""
                        }`}
                      >
                        {hasRemaining
                          ? `${requirement.remaining}${requirement.unit || ""}`
                          : "-"}
                      </p>
                    </div>
                  </div>
                </div>
              );
            }
          )}
        </div>
      )}

      {requirementDisplayMode ===
        "qualification_only" && (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />

            현재 최종학력 기준으로 추가 학위과정이 필요하지 않습니다.
          </div>
        </div>
      )}

      {requirementDisplayMode ===
        "degree_and_qualification" && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
          <p className="text-xs text-blue-700">
            학위와 자격조건은 별도로 합산하지 않습니다.
            동일 과목으로 동시에 충족 가능한 부분은
            공통 과목설계 엔진에서 중복 없이 계산합니다.
          </p>
        </div>
      )}
    </div>
  </CardContent>
</Card>

{/* ─────────────────────────────
    AI 자격 / 학위 / 학습설계
───────────────────────────── */}
<div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
</div>

{/* ─────────────────────────────
    실제 학기별 수강현황
───────────────────────────── */}
<Card className="border shadow-sm">
  <CardContent className="p-5">
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div>
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-600" />

          <h2 className="text-base font-bold">
            학기별 수강현황
          </h2>
        </div>

        <p className="text-xs text-muted-foreground mt-1">
          상세페이지에 실제 등록된 학기와 과목을 기준으로 표시합니다.
        </p>
      </div>

      <Badge
        variant="outline"
        className="bg-blue-50 text-blue-700 border-blue-200"
      >
        실제 등록과목 {actualPlanSubjects.length}과목
      </Badge>
    </div>

    {actualSemesterNumbers.length ===
    0 ? (
      <div className="rounded-lg border bg-slate-50 p-4 text-sm text-muted-foreground">
        상세페이지에 등록된 학기별 과목이 없습니다.
      </div>
    ) : (
      <div className="space-y-4">
        {actualSemesterNumbers.map(
          (
            semesterNo
          ) => {
            const semester =
              getExistingSemester(
                semesterNo
              );

            const semesterSubjects =
              getSemesterSubjects(
                semesterNo
              );

            const majorRequiredSubjects =
              semesterSubjects.filter(
                (
                  subject: any
                ) =>
                  subject
                    ?.requirementType ===
                  "전공필수"
              );

            const majorElectiveSubjects =
              semesterSubjects.filter(
                (
                  subject: any
                ) =>
                  subject
                    ?.requirementType ===
                  "전공선택"
              );

            const liberalSubjects =
              semesterSubjects.filter(
                (
                  subject: any
                ) =>
                  subject
                    ?.requirementType ===
                  "교양"
              );

            const generalSubjects =
              semesterSubjects.filter(
                (
                  subject: any
                ) =>
                  subject
                    ?.requirementType ===
                  "일반"
              );

            const otherSubjects =
              semesterSubjects.filter(
                (
                  subject: any
                ) =>
                  ![
                    "전공필수",
                    "전공선택",
                    "교양",
                    "일반",
                  ].includes(
                    String(
                      subject
                        ?.requirementType ||
                      ""
                    )
                  )
              );

            const semesterStatus =
              semesterSubjects.some(
                (
                  subject: any
                ) =>
                  subject
                    ?.progressStatus ===
                  "retake_required"
              )
                ? "retake_required"
                : semesterSubjects.some(
                      (
                        subject: any
                      ) =>
                        subject
                          ?.progressStatus ===
                        "review_required"
                    )
                  ? "review_required"
                  : semesterSubjects.some(
                        (
                          subject: any
                        ) =>
                          subject
                            ?.progressStatus ===
                          "in_progress"
                      )
                    ? "in_progress"
                    : semesterSubjects.every(
                          (
                            subject: any
                          ) =>
                            subject
                              ?.progressStatus ===
                            "completed"
                        )
                      ? "completed"
                      : "scheduled";

            const renderSubjectGroup =
              (
                title: string,
                rows: any[]
              ) => {
                if (
                  rows.length ===
                  0
                ) {
                  return null;
                }

                return (
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="text-xs font-semibold text-muted-foreground">
                        {title}
                      </p>

                      <span className="text-xs text-muted-foreground">
                        {rows.length}과목
                      </span>
                    </div>

                    <div className="space-y-2">
  {rows.map(
    (
      subject:
        any,
      subjectIndex:
        number
    ) => {
      const validationStatus =
        subject?.validation
          ?.status ??
        "normal";

      const validationCodes =
        subject?.validation
          ?.codes ??
        [];

      const validationMessages =
        subject?.validation
          ?.messages ??
        [];

      return (
        <div
          key={`${semesterNo}-${subject.id ?? subject.subjectName}-${subjectIndex}`}
          className={`flex flex-col gap-3 rounded-lg border p-3 ${getSubjectValidationContainerClass(
            validationStatus
          )}`}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div>
              <p className="text-sm font-semibold">
                {subject.subjectName ||
                  "-"}
              </p>

              <p className="text-xs text-muted-foreground mt-1">
                {subject.credits ||
                  0}
                학점
                {" · "}
                {subject.category ||
                  subject.requirementType ||
                  "구분 확인 필요"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {validationStatus !==
                "normal" && (
                <Badge
                  variant="outline"
                  className={
                    getSubjectValidationBadgeClass(
                      validationStatus
                    )
                  }
                >
                  {getSubjectValidationLabel(
                    validationStatus
                  )}
                </Badge>
              )}

              <Badge
                variant="outline"
                className={
                  getProgressBadgeClass(
                    subject.progressStatus
                  )
                }
              >
                {getProgressLabel(
                  subject.progressStatus
                )}
              </Badge>
            </div>
          </div>

          {validationStatus !==
            "normal" &&
            validationMessages.length >
              0 && (
              <div className="rounded-lg border bg-white/70 p-3">
                <div className="space-y-1">
                  {validationMessages.map(
                    (
                      message:
                        string,
                      messageIndex:
                        number
                    ) => (
                      <p
                        key={`${semesterNo}-${subject.id ?? subject.subjectName}-validation-${messageIndex}`}
                        className={
                          validationStatus ===
                          "danger"
                            ? "text-xs text-red-700"
                            : "text-xs text-amber-700"
                        }
                      >
                        {message}
                      </p>
                    )
                  )}
                </div>

                {validationCodes.length >
                  0 && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    검사코드{" "}
                    {
                      validationCodes.length
                    }
                    건
                  </p>
                )}
              </div>
            )}
        </div>
      );
    }
  )}
</div>
                  </div>
                );
              };

            return (
              <div
                key={`actual-semester-${semesterNo}`}
                className="rounded-xl border bg-slate-50/50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold">
                        {semester
                          ?.semesterLabel ||
                          `${semesterNo}학기`}
                      </p>

                      <Badge
                        variant="outline"
                        className={
                          getProgressBadgeClass(
                            semesterStatus
                          )
                        }
                      >
                        {getProgressLabel(
                          semesterStatus
                        )}
                      </Badge>

                      <Badge
                        variant="outline"
                        className="bg-white"
                      >
                        상세페이지
                      </Badge>
                    </div>

                    <p className="text-xs text-muted-foreground mt-2">
                      개강일{" "}
                      {semester
                        ?.actualStartDate ||
                        semesterSubjects[
                          0
                        ]
                          ?.actualStartDate ||
                        "-"}
                    </p>
                  </div>

                  <Badge
                    variant="outline"
                    className="bg-white"
                  >
                    {
                      semesterSubjects.length
                    }
                    과목
                  </Badge>
                </div>

                <div className="space-y-4 mt-4">
                  {renderSubjectGroup(
                    "전공필수",
                    majorRequiredSubjects
                  )}

                  {renderSubjectGroup(
                    "전공선택",
                    majorElectiveSubjects
                  )}

                  {renderSubjectGroup(
                    "교양",
                    liberalSubjects
                  )}

                  {renderSubjectGroup(
                    "일반",
                    generalSubjects
                  )}

                  {renderSubjectGroup(
                    "기타 / 확인 필요",
                    otherSubjects
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>
    )}
  </CardContent>
</Card>

{/* ─────────────────────────────
    실제 학습기간
───────────────────────────── */}
<Card className="border shadow-sm">
  <CardContent className="p-5">
    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
      <div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-blue-600" />

          <h2 className="text-base font-bold">
            학습기간
          </h2>
        </div>

        <p className="text-xs text-muted-foreground mt-1">
          상세페이지 실제 개강일을 기준으로 시작일을 표시하고,
          종료일만 공통엔진이 현재 학습계획을 기준으로 예상합니다.
        </p>
      </div>

      <Badge
        variant="outline"
        className="bg-blue-50 text-blue-700 border-blue-200"
      >
        실제 일정 기준
      </Badge>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="rounded-xl border bg-slate-50 p-4">
        <p className="text-xs text-muted-foreground">
          학습 시작일
        </p>

        <p className="text-lg font-bold mt-2">
          {displayStudyStartDate || "-"}
        </p>

        <p className="text-xs text-muted-foreground mt-2">
  상세페이지 실제 최초 개강일
</p>
      </div>

      <div className="rounded-xl border bg-slate-50 p-4">
        <p className="text-xs text-muted-foreground">
          예상 학습 종료일
        </p>

        <p className="text-lg font-bold mt-2">
          {estimatedStudyEndDate || "-"}
        </p>

        <p className="text-xs text-muted-foreground mt-2">
          현재 등록된 학기와 남은 학습계획 기준
        </p>
      </div>
    </div>

    {academicCompletionDate && (
      <div className="mt-3 rounded-lg border bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            학업 완료 예상일
          </p>

          <p className="text-sm font-semibold">
            {academicCompletionDate}
          </p>
        </div>
      </div>
    )}
  </CardContent>
</Card>

{/* ─────────────────────────────
    행정절차
───────────────────────────── */}
<Card className="border shadow-sm">
  <CardContent className="p-5">
    <div className="flex items-center justify-between gap-3 mb-4">
      <div>
        <div className="flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5 text-blue-600" />

          <h2 className="text-base font-bold">
            행정절차 관리
          </h2>
        </div>

        <p className="text-xs text-muted-foreground mt-1">
          공통엔진 예상 일정과 실제 진행상태를 함께 표시합니다.
        </p>
      </div>

      <Badge
        variant="outline"
        className="bg-blue-50 text-blue-700 border-blue-200"
      >
        예상 + 실제
      </Badge>
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">

      {/* 학습자등록 */}
      <AdministrativeProcedureCard
  title="학습자등록"
  expectedValue={null}
  procedure={
    learnerRegistrationProcedure
  }
  procedureType="learner_registration"
  onStatusChange={
    updateAdministrativeProcedureStatus
  }
  saving={
    administrativeProcedureMut.isPending
  }
/>

      {/* 학점인정신청 */}
      <AdministrativeProcedureCard
  title="학점인정신청"
  expectedValue={
    creditRecognitionLabel
  }
  procedure={
    creditRecognitionProcedure
  }
  procedureType="credit_recognition"
  onStatusChange={
    updateAdministrativeProcedureStatus
  }
  saving={
    administrativeProcedureMut.isPending
  }
/>

      {/* 학위신청 */}
      <AdministrativeProcedureCard
  title="학위신청"
  expectedValue={
    degreeApplicationLabel
  }
  procedure={
    degreeApplicationProcedure
  }
  procedureType="degree_application"
  onStatusChange={
    updateAdministrativeProcedureStatus
  }
  saving={
    administrativeProcedureMut.isPending
  }
/>

      {/* 자격증신청 */}
      <AdministrativeProcedureCard
  title="자격증신청"
  expectedValue={
    qualificationEstimatedDate
  }
  procedure={
    qualificationApplicationProcedure
  }
  procedureType="qualification_application"
  onStatusChange={
    updateAdministrativeProcedureStatus
  }
  saving={
    administrativeProcedureMut.isPending
  }
/>
    </div>

    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="rounded-xl border bg-slate-50 p-4">
        <p className="text-xs text-muted-foreground">
          예상 학습 종료
        </p>

        <p className="font-semibold mt-1">
          {academicCompletionDate || "-"}
        </p>
      </div>

      <div className="rounded-xl border bg-slate-50 p-4">
        <p className="text-xs text-muted-foreground">
          예상 학위수여
        </p>

        <p className="font-semibold mt-1">
          {degreeAwardLabel || "-"}
        </p>
      </div>
    </div>

    {qualificationMessage && (
      <div className="mt-3 rounded-lg border bg-blue-50/50 p-3">
        <p className="text-xs text-muted-foreground">
          자격증 신청 안내
        </p>

        <p className="text-sm mt-1 leading-relaxed">
          {qualificationMessage}
        </p>
      </div>
    )}
  </CardContent>
</Card>

{/* ─────────────────────────────
    AI 종합판단
───────────────────────────── */}
<Card className="border border-blue-100 bg-blue-50/30 shadow-sm">
  <CardContent className="p-5">
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2">
        <BrainCircuit className="h-5 w-5 text-blue-600" />

        <h2 className="text-base font-bold">
          AI 종합판단
        </h2>
      </div>

      <Badge
        variant="outline"
        className={
          academicStatus === "ready" &&
          academicCanExplain
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-amber-50 text-amber-700 border-amber-200"
        }
      >
        {academicStatus === "ready" &&
        academicCanExplain
          ? "분석완료"
          : "확인필요"}
      </Badge>
    </div>

    <div className="space-y-2">
      {academicSummaryLines.map(
        (
          line: string,
          index: number
        ) => (
          <div
            key={index}
            className="rounded-lg border bg-white p-3 text-sm"
          >
            {line}
          </div>
        )
      )}
    </div>

    {academicWarnings.length > 0 && (
      <div className="mt-4 space-y-2">
        {academicWarnings.map(
          (
            warning: string,
            index: number
          ) => (
            <div
              key={index}
              className="rounded-lg border border-amber-100 bg-amber-50 p-3 text-sm text-amber-700"
            >
              {warning}
            </div>
          )
        )}
      </div>
    )}

    {academicUnresolvedReasons.length > 0 && (
      <div className="mt-4 space-y-2">
        {academicUnresolvedReasons.map(
          (
            reason: string,
            index: number
          ) => (
            <div
              key={index}
              className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700"
            >
              {reason}
            </div>
          )
        )}
      </div>
    )}
  </CardContent>
</Card>

<Card className="border shadow-sm">
  <CardContent className="p-5">
    <div className="flex items-center justify-between gap-3 mb-4">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-blue-600" />

        <h2 className="text-base font-bold">
          AI 위험도 검사
        </h2>
      </div>

      <Badge
        variant="outline"
        className={aiRiskBadgeClass}
      >
        {aiRiskLabel} · {aiRiskScore}점
      </Badge>
    </div>

    <div className="grid grid-cols-2 gap-2 mb-4">
      <div className="rounded-lg border bg-slate-50 p-3">
        <p className="text-xs text-muted-foreground">
          중복과목
        </p>

        <p className="text-lg font-bold mt-1">
          {aiDuplicateSubjectCount}
          <span className="text-xs font-normal ml-1">
            건
          </span>
        </p>
      </div>

      <div className="rounded-lg border bg-slate-50 p-3">
        <p className="text-xs text-muted-foreground">
          실습 요청
        </p>

        <p className="text-lg font-bold mt-1">
          {aiPracticeRequestCount}
          <span className="text-xs font-normal ml-1">
            건
          </span>
        </p>
      </div>
    </div>

    <div className="space-y-2">
      {academicRiskIssues.length === 0 ? (
        <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            현재 공통엔진에서 확인된 위험요소가 없습니다.
          </div>
        </div>
      ) : (
        academicRiskIssues.map(
          (
            issue: any,
            index: number
          ) => {
            const severity =
              String(
                issue?.severity ||
                "info"
              );

            const itemClass =
              severity === "danger"
                ? "border-red-100 bg-red-50"
                : severity === "warning"
                  ? "border-amber-100 bg-amber-50"
                  : "border-blue-100 bg-blue-50";

            const textClass =
              severity === "danger"
                ? "text-red-700"
                : severity === "warning"
                  ? "text-amber-700"
                  : "text-blue-700";

            return (
              <div
                key={`${issue?.code || "risk"}-${index}`}
                className={`rounded-lg border p-3 ${itemClass}`}
              >
                <div className={`font-semibold text-sm ${textClass}`}>
                  {issue?.title || "확인 필요"}
                </div>

                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {issue?.message || "-"}
                </p>

                {issue?.category && (
                  <p className="text-[11px] text-muted-foreground mt-2">
                    분류: {String(issue.category)}
                  </p>
                )}
              </div>
            );
          }
        )
      )}
    </div>
  </CardContent>
</Card>

<Card className="border shadow-sm">
  <CardContent className="p-5">
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-violet-600" />

            <h2 className="text-base font-bold">
              AI 관리 알림
            </h2>
          </div>

          <Badge
            variant="outline"
            className={
              unreadAiEventCount > 0
                ? "bg-violet-50 text-violet-700 border-violet-200"
                : "bg-slate-50 text-slate-600 border-slate-200"
            }
          >
            AI 업데이트 {unreadAiEventCount}
          </Badge>

          <Badge
            variant="outline"
            className={
              aiDangerCount > 0 ||
              academicUnresolvedReasons.length > 0
                ? "bg-red-50 text-red-700 border-red-200"
                : aiWarningCount > 0 ||
                    academicWarnings.length > 0
                  ? "bg-amber-50 text-amber-700 border-amber-200"
                  : "bg-emerald-50 text-emerald-700 border-emerald-200"
            }
          >
            {aiDangerCount > 0 ||
            academicUnresolvedReasons.length > 0
              ? "확인필요"
              : aiWarningCount > 0 ||
                  academicWarnings.length > 0
                ? "주의"
                : "공통엔진 정상"}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground mt-2">
          카카오 AI·시스템 AI의 중요 업데이트와 공통엔진 분석 결과를 함께 관리합니다.
        </p>
      </div>

      {unreadAiEventCount > 0 && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={
            markAllAiEventsReadMut.isPending
          }
          onClick={
            markAllAiEventsRead
          }
        >
          {markAllAiEventsReadMut.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              처리중
            </>
          ) : (
            "전체 확인"
          )}
        </Button>
      )}
    </div>

    {/* ─────────────────────────────
        AI 업데이트 이벤트
    ───────────────────────────── */}
    <div className="rounded-xl border bg-violet-50/30 p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold">
            AI 업데이트
          </h3>

          <p className="text-xs text-muted-foreground mt-1">
            실제 CRM 관리상 의미 있는 변경만 기록됩니다.
          </p>
        </div>

        <Badge
          variant="outline"
          className="bg-white"
        >
          미확인 {unreadAiEventCount}
        </Badge>
      </div>

      {aiEvents.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-4">
          <p className="text-sm text-muted-foreground text-center">
            아직 AI 업데이트 기록이 없습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {aiEvents
            .slice(0, 10)
            .map(
              (
                event: any,
                index: number
              ) => (
                <div
                  key={
                    event?.id ||
                    `ai-event-${index}`
                  }
                  className={`rounded-xl border p-3 ${
                    event?.isRead
                      ? "bg-white"
                      : "bg-violet-50 border-violet-200"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {!event?.isRead && (
                          <Badge className="bg-violet-600">
                            NEW
                          </Badge>
                        )}

                        <Badge
                          variant="outline"
                          className="bg-white"
                        >
                          {getAiEventTypeLabel(
                            event?.eventType
                          )}
                        </Badge>

                        <Badge
                          variant="outline"
                          className="bg-white"
                        >
                          {getAiManagementSourceLabel(
                            event?.sourceType
                          )}
                        </Badge>
                      </div>

                      <p className="text-sm font-semibold mt-2">
                        {event?.title ||
                          "AI 업데이트"}
                      </p>

                      {event?.message && (
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          {String(
                            event.message
                          )}
                        </p>
                      )}

                      <p className="text-[11px] text-muted-foreground mt-2">
                        {formatAiManagementDateTime(
                          event?.createdAt
                        )}
                      </p>
                    </div>

                    {!event?.isRead && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                          markAiEventReadMut.isPending
                        }
                        onClick={() =>
                          markAiEventRead(
                            Number(
                              event.id
                            )
                          )
                        }
                      >
                        확인
                      </Button>
                    )}
                  </div>
                </div>
              )
            )}
        </div>
      )}
    </div>

    {/* ─────────────────────────────
        AI 중요 관리메모
    ───────────────────────────── */}
    <div className="rounded-xl border bg-slate-50/50 p-4 mt-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 className="text-sm font-bold">
            AI 중요 문의 / 관리메모
          </h3>

          <p className="text-xs text-muted-foreground mt-1">
            전체 대화가 아니라 학습관리에 의미 있는 내용만 요약 저장됩니다.
          </p>
        </div>

        <Badge
          variant="outline"
          className="bg-white"
        >
          {aiNotes.length}건
        </Badge>
      </div>

      {aiNotes.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-white p-4">
          <p className="text-sm text-muted-foreground text-center">
            저장된 AI 중요 문의가 없습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {aiNotes
            .slice(0, 10)
            .map(
              (
                note: any,
                index: number
              ) => (
                <div
                  key={
                    note?.id ||
                    `ai-note-${index}`
                  }
                  className="rounded-xl border bg-white p-4"
                >
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="bg-slate-50"
                        >
                          {getAiNoteTypeLabel(
                            note?.noteType
                          )}
                        </Badge>

                        <Badge
                          variant="outline"
                          className={
                            note?.status ===
                            "action_required"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : note?.status ===
                                  "in_progress"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : note?.status ===
                                    "resolved"
                                  ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                  : "bg-slate-50 text-slate-600 border-slate-200"
                          }
                        >
                          {getAiNoteStatusLabel(
                            note?.status
                          )}
                        </Badge>

                        <Badge
                          variant="outline"
                          className="bg-white"
                        >
                          {getAiManagementSourceLabel(
                            note?.sourceType
                          )}
                        </Badge>
                      </div>

                      {note?.inquirySummary && (
                        <div className="mt-3">
                          <p className="text-[11px] text-muted-foreground">
                            문의
                          </p>

                          <p className="text-sm mt-1">
                            {String(
                              note.inquirySummary
                            )}
                          </p>
                        </div>
                      )}

                      <div className="mt-3">
                        <p className="text-[11px] text-muted-foreground">
                          AI 요약
                        </p>

                        <p className="text-sm mt-1 leading-relaxed">
                          {note?.aiSummary ||
                            "-"}
                        </p>
                      </div>

                      {note?.actionSummary && (
                        <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3">
                          <p className="text-[11px] text-amber-700">
                            담당자 확인사항
                          </p>

                          <p className="text-sm font-medium mt-1">
                            {String(
                              note.actionSummary
                            )}
                          </p>
                        </div>
                      )}

                      <p className="text-[11px] text-muted-foreground mt-3">
                        {formatAiManagementDateTime(
                          note?.createdAt
                        )}
                      </p>
                    </div>

                    <div className="w-full lg:w-36">
                      <p className="text-[11px] text-muted-foreground mb-1">
                        관리상태
                      </p>

                      <select
                        value={
                          note?.status ||
                          "info"
                        }
                        disabled={
                          updateAiNoteStatusMut.isPending
                        }
                        onChange={(e) =>
                          updateAiNoteStatus(
                            Number(
                              note.id
                            ),
                            e.target.value as
                              | "info"
                              | "action_required"
                              | "in_progress"
                              | "resolved"
                              | "dismissed"
                          )
                        }
                        className="h-9 w-full rounded-md border border-input bg-white px-2 text-xs"
                      >
                        <option value="info">
                          참고
                        </option>

                        <option value="action_required">
                          확인필요
                        </option>

                        <option value="in_progress">
                          처리중
                        </option>

                        <option value="resolved">
                          처리완료
                        </option>

                        <option value="dismissed">
                          제외
                        </option>
                      </select>
                    </div>
                  </div>
                </div>
              )
            )}
        </div>
      )}
    </div>

    {/* ─────────────────────────────
        공통엔진 분석 알림
    ───────────────────────────── */}
    <div className="mt-4">
      <div className="mb-3">
        <h3 className="text-sm font-bold">
          공통엔진 관리검사
        </h3>

        <p className="text-xs text-muted-foreground mt-1">
          상세페이지 원본을 기준으로 자동 계산한 위험 및 확인 항목입니다.
        </p>
      </div>

      {aiIssues.length === 0 &&
      academicWarnings.length === 0 &&
      academicUnresolvedReasons.length ===
        0 ? (
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            현재 공통엔진에서 확인된 관리 위험요소가 없습니다.
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {aiIssues.map(
            (
              issue: any,
              index: number
            ) => {
              const severity =
                String(
                  issue?.severity ||
                    "info"
                );

              const boxClass =
                severity ===
                "danger"
                  ? "border-red-100 bg-red-50"
                  : severity ===
                      "warning"
                    ? "border-amber-100 bg-amber-50"
                    : "border-blue-100 bg-blue-50";

              const titleClass =
                severity ===
                "danger"
                  ? "text-red-700"
                  : severity ===
                      "warning"
                    ? "text-amber-700"
                    : "text-blue-700";

              return (
                <div
                  key={`issue-${issue?.code || index}-${index}`}
                  className={`rounded-xl border p-3 ${boxClass}`}
                >
                  <div
                    className={`text-sm font-semibold ${titleClass}`}
                  >
                    {issue?.title ||
                      "확인 필요"}
                  </div>

                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {issue?.message ||
                      "-"}
                  </p>

                  {issue?.category && (
                    <div className="mt-2">
                      <Badge
                        variant="outline"
                        className="bg-white"
                      >
                        {String(
                          issue.category
                        )}
                      </Badge>
                    </div>
                  )}
                </div>
              );
            }
          )}

          {academicWarnings.map(
            (
              warning: string,
              index: number
            ) => (
              <div
                key={`academic-warning-${index}`}
                className="rounded-xl border border-amber-100 bg-amber-50 p-3"
              >
                <div className="text-sm font-semibold text-amber-700">
                  학업설계 주의
                </div>

                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {warning}
                </p>
              </div>
            )
          )}

          {academicUnresolvedReasons.map(
            (
              reason: string,
              index: number
            ) => (
              <div
                key={`academic-unresolved-${index}`}
                className="rounded-xl border border-red-100 bg-red-50 p-3"
              >
                <div className="text-sm font-semibold text-red-700">
                  담당자 확인 필요
                </div>

                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  {reason}
                </p>
              </div>
            )
          )}
        </div>
      )}
    </div>
  </CardContent>
</Card>
      </div>
    </div>
  </div>
);
}

function SummaryMiniCard({
  title,
  value,
  suffix,
  danger = false,
}: {
  title: string;
  value: any;
  suffix?: string;
  danger?: boolean;
}) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-5">
        <p className="text-xs text-muted-foreground font-medium">{title}</p>
        <div className={`text-3xl font-bold mt-3 ${danger ? "text-red-500" : "text-slate-900"}`}>
          {value}
          <span className="text-sm font-semibold ml-1">{suffix}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function RuleInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        placeholder="0"
        className="bg-white"
      />
    </div>
  );
}

function SummaryValue({
  label,
  value,
  suffix,
  danger = false,
}: {
  label: string;
  value: number | null | undefined;
  suffix?: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-lg border bg-slate-50 p-3">
      <p className="text-xs text-muted-foreground">
        {label}
      </p>

      <p
        className={`text-lg font-bold mt-1 ${
          danger
            ? "text-red-600"
            : "text-slate-900"
        }`}
      >
        {value ?? "-"}
        {value !== null &&
          value !== undefined &&
          suffix && (
            <span className="text-xs font-normal ml-1">
              {suffix}
            </span>
          )}
      </p>
    </div>
  );
}

function TimelineValue({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="rounded-lg border bg-slate-50 p-3">
      <p className="text-xs text-muted-foreground">
        {label}
      </p>

      <p className="font-semibold mt-1">
        {value || "-"}
      </p>
    </div>
  );
}

function AdministrativeProcedureCard({
  title,
  expectedValue,
  procedure,
  procedureType,
  onStatusChange,
  saving,
}: {
  title: string;

  expectedValue:
    | string
    | null
    | undefined;

  procedure: any;

  procedureType:
    | "learner_registration"
    | "credit_recognition"
    | "degree_application"
    | "qualification_application";

  onStatusChange: (
    procedureType:
      | "learner_registration"
      | "credit_recognition"
      | "degree_application"
      | "qualification_application",

    status:
      | "not_started"
      | "in_progress"
      | "completed"
      | "review_required"
  ) => Promise<void>;

  saving: boolean;
}) {
  const completedAt =
    procedure?.completedAt
      ? new Date(
          procedure.completedAt
        ).toLocaleString(
          "ko-KR"
        )
      : null;

  return (
    <div className="rounded-xl border p-4 bg-white">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">
            {title}
          </p>

          <p className="text-xs text-muted-foreground mt-1">
            예상 {expectedValue || "-"}
          </p>
        </div>

        <AdministrativeProcedureStatus
          status={
            procedure?.status
          }
        />
      </div>

<div className="mt-4">
  <p className="text-[11px] text-muted-foreground mb-1">
    담당자 상태 변경
  </p>

  <div className="flex gap-2">
    <select
      value={
        procedure?.status ||
        "not_started"
      }
      disabled={saving}
      onChange={async (e) => {
        await onStatusChange(
          procedureType,
          e.target.value as
            | "not_started"
            | "in_progress"
            | "completed"
            | "review_required"
        );
      }}
      className="h-9 flex-1 rounded-md border border-input bg-white px-3 text-sm"
    >
      <option value="not_started">
        미진행
      </option>

      <option value="in_progress">
        진행중
      </option>

      <option value="completed">
        완료
      </option>

      <option value="review_required">
        확인필요
      </option>
    </select>

    {saving && (
      <div className="h-9 px-3 flex items-center rounded-md border bg-slate-50">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    )}
  </div>
</div>

      <div className="mt-4 space-y-2 text-xs">
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">
            실제 상태
          </span>

          <span className="font-medium">
            {procedure
              ? procedure.status === "completed"
                ? "완료"
                : procedure.status === "in_progress"
                  ? "진행중"
                  : procedure.status === "review_required"
                    ? "확인필요"
                    : "미진행"
              : "미진행"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">
            완료일
          </span>

          <span className="font-medium">
            {completedAt || "-"}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">
            확인경로
          </span>

          <span className="font-medium">
            {getAdministrativeSourceLabel(
              procedure?.sourceType
            )}
          </span>
        </div>

        {procedure?.reportedDate && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">
              보고일
            </span>

            <span className="font-medium">
              {String(
                procedure.reportedDate
              )}
            </span>
          </div>
        )}
      </div>

      {procedure?.evidenceSummary && (
        <div className="mt-3 rounded-lg border bg-slate-50 p-3">
          <p className="text-[11px] text-muted-foreground">
            확인 근거
          </p>

          <p className="text-xs mt-1 leading-relaxed">
            {String(
              procedure.evidenceSummary
            )}
          </p>
        </div>
      )}

      {procedure?.memo && (
        <div className="mt-2 rounded-lg border border-dashed p-3">
          <p className="text-[11px] text-muted-foreground">
            관리 메모
          </p>

          <p className="text-xs mt-1 leading-relaxed">
            {String(
              procedure.memo
            )}
          </p>
        </div>
      )}
    </div>
  );
}

function AdministrativeProcedureStatus({
  status,
}: {
  status:
    | string
    | null
    | undefined;
}) {
  const normalized =
    String(
      status ||
      "not_started"
    );

  if (
    normalized ===
    "completed"
  ) {
    return (
      <Badge
        variant="outline"
        className="bg-emerald-50 text-emerald-700 border-emerald-200"
      >
        완료
      </Badge>
    );
  }

  if (
    normalized ===
    "in_progress"
  ) {
    return (
      <Badge
        variant="outline"
        className="bg-blue-50 text-blue-700 border-blue-200"
      >
        진행중
      </Badge>
    );
  }

  if (
    normalized ===
    "review_required"
  ) {
    return (
      <Badge
        variant="outline"
        className="bg-amber-50 text-amber-700 border-amber-200"
      >
        확인필요
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className="bg-slate-50 text-slate-600 border-slate-200"
    >
      미진행
    </Badge>
  );
}

function getAdministrativeSourceLabel(
  sourceType:
    | string
    | null
    | undefined
) {
  switch (
    String(sourceType || "")
  ) {
    case "STAFF":
      return "담당자";

    case "KAKAO_AI":
      return "카카오 AI";

    case "SYSTEM_AI":
      return "시스템 AI";

    case "SYSTEM":
      return "시스템";

    default:
      return "-";
  }
}

function getAiManagementSourceLabel(
  value: unknown
) {
  switch (
    String(value || "")
  ) {
    case "KAKAO_AI":
      return "카카오 AI";

    case "SYSTEM_AI":
      return "시스템 AI";

    case "STAFF":
      return "담당자";

    case "SYSTEM":
      return "시스템";

    default:
      return "-";
  }
}

function getAiEventTypeLabel(
  value: unknown
) {
  switch (
    String(value || "")
  ) {
    case "administrative_status_changed":
      return "행정절차";

    case "document_submitted":
      return "증빙자료";

    case "practice_condition_changed":
      return "실습조건";

    case "schedule_changed":
      return "일정변경";

    case "risk_changed":
      return "위험도";

    case "important_note_created":
      return "중요문의";

    case "learning_plan_changed":
      return "학습설계";

    default:
      return "기타";
  }
}

function getAiNoteTypeLabel(
  value: unknown
) {
  switch (
    String(value || "")
  ) {
    case "administrative":
      return "행정절차";

    case "practice":
      return "실습";

    case "schedule":
      return "일정";

    case "subject":
      return "과목";

    case "degree":
      return "학위";

    case "qualification":
      return "자격증";

    case "document":
      return "서류";

    case "risk":
      return "위험도";

    case "learning_plan":
      return "학습설계";

    default:
      return "일반";
  }
}

function getAiNoteStatusLabel(
  value: unknown
) {
  switch (
    String(value || "")
  ) {
    case "action_required":
      return "확인필요";

    case "in_progress":
      return "처리중";

    case "resolved":
      return "처리완료";

    case "dismissed":
      return "제외";

    default:
      return "참고";
  }
}

function formatAiManagementDateTime(
  value: unknown
) {
  if (!value) {
    return "-";
  }

  const date =
    new Date(
      String(value)
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "-";
  }

  return date.toLocaleString(
    "ko-KR"
  );
}