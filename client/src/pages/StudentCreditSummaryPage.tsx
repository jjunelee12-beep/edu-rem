import { useEffect, useMemo, useState } from "react";
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
  AlertTriangle,
  CheckCircle2,
  Info,
  User,
} from "lucide-react";

function alertClass(level: string) {
  if (level === "danger") return "border-red-100 bg-red-50 text-red-700";
  if (level === "warning") return "border-amber-100 bg-amber-50 text-amber-700";
  if (level === "success") return "border-emerald-100 bg-emerald-50 text-emerald-700";
  return "border-blue-100 bg-blue-50 text-blue-700";
}

function alertIcon(level: string) {
  if (level === "success") return <CheckCircle2 className="h-4 w-4" />;
  if (level === "info") return <Info className="h-4 w-4" />;
  return <AlertTriangle className="h-4 w-4" />;
}

function statusBadgeClass(status: string) {
  if (status === "shortage") return "bg-red-50 text-red-600 border-red-100";
  if (status === "exceeded") return "bg-amber-50 text-amber-600 border-amber-100";
  return "bg-emerald-50 text-emerald-600 border-emerald-100";
}

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

  const categoryRows = useMemo(() => {
    const c = summary?.categories || {};
    return [c.majorRequired, c.majorElective, c.liberal, c.general].filter(Boolean);
  }, [summary]);

  const shortageRows = useMemo(() => {
    return categoryRows.filter(
      (row: any) =>
        Number(row.remainingSubjects || 0) > 0 ||
        Number(row.remainingCredits || 0) > 0 ||
        row.status === "exceeded"
    );
  }, [categoryRows]);

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

  const progress = Math.max(0, Math.min(Number(summary.progressRate || 0), 100));

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

        <div>
          <h1 className="text-xl font-bold tracking-tight">학생 정보 요약</h1>
          <p className="text-sm text-muted-foreground">
            학점 부족, 중복 과목, 이수 상태를 한눈에 검토합니다.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_180px] gap-5">
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
                      <Badge className="bg-blue-50 text-blue-600 border-blue-100">
                        {rule ? "기준적용" : "기준미설정"}
                      </Badge>
<Button
  type="button"
  size="sm"
  variant="outline"
  className="h-7 px-2 text-xs"
  onClick={() => setSettingOpen((prev) => !prev)}
>
  기준 설정
</Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      최종학력 : {plan?.finalEducation || "-"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      과정 : {plan?.desiredCourse || student.course || "-"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <SummaryMiniCard title="총 필요 학점" value={summary.requiredTotalCredits} suffix="학점" />
            <SummaryMiniCard title="취득 학점" value={summary.currentCredits} suffix="학점" />
            <SummaryMiniCard title="남은 학점" value={summary.remainingCredits} suffix="학점" danger />
            <SummaryMiniCard title="진행률" value={progress} suffix="%" />
          </div>

{settingOpen && (
  <Card className="border border-blue-100 bg-blue-50/40 shadow-sm">
    <CardContent className="p-5">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold">학점 요약 기준 설정</h2>
          <p className="text-sm text-muted-foreground mt-1">
            이 학생의 과정 기준에 맞춰 필요 과목/학점을 입력하면 아래 요약이 바로 재계산됩니다.
          </p>
        </div>

        <Badge variant="outline" className="bg-white">
          {rule ? "수정 모드" : "신규 설정"}
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

          <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_1fr] gap-5">
            <Card className="border shadow-sm">
              <CardContent className="p-5">
                <h2 className="text-base font-bold mb-4">학점 취득 현황</h2>

                <div className="overflow-hidden rounded-xl border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b">
                        <th className="text-left p-3">구분</th>
                        <th className="text-right p-3">필요</th>
                        <th className="text-right p-3">취득</th>
                        <th className="text-right p-3">남은</th>
                        <th className="text-center p-3">상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryRows.map((row: any) => (
                        <tr key={row.label} className="border-b last:border-b-0">
                          <td className="p-3 font-medium">{row.label}</td>
                          <td className="p-3 text-right">{row.requiredCredits}학점</td>
                          <td className="p-3 text-right">{row.currentCredits}학점</td>
                          <td className="p-3 text-right">{row.remainingCredits}학점</td>
                          <td className="p-3 text-center">
                            <Badge variant="outline" className={statusBadgeClass(row.status)}>
                              {row.status === "shortage"
                                ? "부족"
                                : row.status === "exceeded"
                                ? "초과"
                                : "충족"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="border shadow-sm">
              <CardContent className="p-5">
                <h2 className="text-base font-bold mb-4">학점 이수 진행률</h2>

                <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-5 items-center">
                  <div className="relative h-44 w-44 mx-auto">
                    <div
                      className="absolute inset-0 rounded-full"
                      style={{
                        background: `conic-gradient(#2563eb ${progress * 3.6}deg, #eaf1ff 0deg)`,
                      }}
                    />
                    <div className="absolute inset-[18px] rounded-full bg-white flex flex-col items-center justify-center">
                      <div className="text-4xl font-bold text-blue-600">{progress}%</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {summary.currentCredits}/{summary.requiredTotalCredits} 학점
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border bg-white p-4">
                    <h3 className="font-semibold text-sm mb-3">부족 학점 상세</h3>

                    <div className="space-y-2">
                      {shortageRows.length === 0 ? (
                        <div className="text-sm text-emerald-600 font-medium">
                          모든 구분의 기준을 충족했습니다.
                        </div>
                      ) : (
                        shortageRows.map((row: any) => (
                          <div key={row.label} className="text-sm flex gap-2">
                            <CheckCircle2 className="h-4 w-4 mt-0.5 text-slate-500" />
                            <div>
                              <span className="font-medium">{row.label}</span>{" "}
                              {row.status === "exceeded" ? (
                                <span className="text-amber-600">기준 초과 확인 필요</span>
                              ) : (
                                <span>
                                  {row.remainingCredits}학점 / {row.remainingSubjects}과목 부족
                                </span>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {summary.remainingCredits > 0 && (
                      <div className="mt-4 rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-600 font-semibold">
                        현재 계획으로는 졸업 또는 자격 요건 충족이 어렵습니다.
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="border shadow-sm">
          <CardContent className="p-5">
            <h2 className="text-base font-bold mb-4">학점 상태 알림</h2>

            <div className="space-y-3">
              {(summary.alerts || []).map((alert: any, index: number) => (
                <div
                  key={`${alert.title}-${index}`}
                  className={`rounded-xl border p-3 text-sm ${alertClass(alert.level)}`}
                >
                  <div className="flex items-center gap-2 font-semibold mb-1">
                    {alertIcon(alert.level)}
                    {alert.title}
                  </div>
                  <p className="leading-relaxed text-xs">{alert.message}</p>
                </div>
              ))}
            </div>

            <Button variant="outline" className="w-full mt-5">
              상세 리포트 보기
            </Button>
          </CardContent>
        </Card>
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