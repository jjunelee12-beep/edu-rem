import { useState, useRef, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  X,
  Save,
  Copy,
  Lock,
  Loader2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import { formatPhone } from "@/lib/format";

// ─── Editable Cell (인라인 편집) ────────────────────────────────────
function EditableCell({
  value,
  onBlur,
  type = "text",
  disabled = false,
  className = "",
}: {
  value: string;
  onBlur: (v: string) => void;
  type?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (type !== "date") inputRef.current.select();
    }
  }, [editing, type]);

  if (disabled) {
    return <span className={`text-sm text-black ${className}`}>{value || "-"}</span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        className="w-full px-2 py-1 text-sm border rounded bg-white text-black focus:outline-none focus:ring-1 focus:ring-primary"
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (localVal !== value) onBlur(localVal);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setLocalVal(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <div
      className={`px-2 py-1 text-sm cursor-text rounded hover:bg-muted/30 min-h-[28px] flex items-center text-black ${className}`}
      onClick={() => setEditing(true)}
    >
      {value || <span className="text-muted-foreground/40">-</span>}
    </div>
  );
}

function formatDate(d: any) {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "-";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function StudentDetail() {
  const params = useParams<{ id: string }>();
  const studentId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const isAdmin = user?.role === "admin" || user?.role === "host";

  const { data: student, isLoading: studentLoading } = trpc.student.get.useQuery({ id: studentId });
  const { data: semesters } = trpc.semester.list.useQuery({ studentId });
  const { data: plan } = trpc.plan.get.useQuery({ studentId });
  const { data: allUsers } = trpc.users.list.useQuery();
  const { data: institutionList } = trpc.educationInstitution.list.useQuery();
  const { data: paymentSummary } = trpc.student.paymentSummary.useQuery({ studentId });
  const { data: refundList } = trpc.refund.listByStudent.useQuery({ studentId });

  const { data: planSemesterList } = trpc.planSemester.list.useQuery({ studentId });
  const { data: transferSubjectList } = trpc.transferSubject.list.useQuery({ studentId });

  const [selectedSemesterOrder, setSelectedSemesterOrder] = useState(1);

  const updateStudentMut = trpc.student.update.useMutation({
    onSuccess: () => utils.student.get.invalidate({ id: studentId }),
    onError: (e) => toast.error(e.message),
  });

  const createSemMut = trpc.semester.create.useMutation({
    onSuccess: async (_data, variables) => {
      await utils.semester.list.invalidate({ studentId });
      await utils.student.paymentSummary.invalidate({ studentId });
      setSelectedSemesterOrder(Number(variables.semesterOrder));
      toast.success("학기 추가 완료");
      setSemDialogOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateSemMut = trpc.semester.update.useMutation({
    onSuccess: () => {
      utils.semester.list.invalidate({ studentId });
      utils.student.paymentSummary.invalidate({ studentId });
      utils.student.get.invalidate({ id: studentId });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteSemMut = trpc.semester.delete.useMutation({
    onSuccess: () => {
      utils.semester.list.invalidate({ studentId });
      utils.student.paymentSummary.invalidate({ studentId });
      utils.student.get.invalidate({ id: studentId });
      toast.success("학기 삭제 완료");
    },
    onError: (e) => toast.error(e.message),
  });

  const copyPlannedMut = trpc.semester.copyPlannedToActual.useMutation({
    onSuccess: () => {
      utils.semester.list.invalidate({ studentId });
      utils.student.get.invalidate({ id: studentId });
      toast.success("예정 정보를 실제 결제 정보로 복사했습니다");
    },
    onError: (e) => toast.error(e.message),
  });

  const upsertPlanMut = trpc.plan.upsert.useMutation({
    onSuccess: () => {
      utils.plan.get.invalidate({ studentId });
      toast.success("플랜 저장 완료");
      setEditingPlan(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const createPlanSemesterMut = trpc.planSemester.create.useMutation({
    onSuccess: () => {
      utils.planSemester.list.invalidate({ studentId });
      toast.success("우리 플랜 과목 추가 완료");
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePlanSemesterMut = trpc.planSemester.update.useMutation({
    onSuccess: () => {
      utils.planSemester.list.invalidate({ studentId });
    },
    onError: (e) => toast.error(e.message),
  });

  const deletePlanSemesterMut = trpc.planSemester.delete.useMutation({
    onSuccess: () => {
      utils.planSemester.list.invalidate({ studentId });
      toast.success("우리 플랜 과목 삭제 완료");
    },
    onError: (e) => toast.error(e.message),
  });

  const createTransferSubjectMut = trpc.transferSubject.create.useMutation({
    onSuccess: () => {
      utils.transferSubject.list.invalidate({ studentId });
      toast.success("전적대 과목 추가 완료");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateTransferSubjectMut = trpc.transferSubject.update.useMutation({
    onSuccess: () => {
      utils.transferSubject.list.invalidate({ studentId });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteTransferSubjectMut = trpc.transferSubject.delete.useMutation({
    onSuccess: () => {
      utils.transferSubject.list.invalidate({ studentId });
      toast.success("전적대 과목 삭제 완료");
    },
    onError: (e) => toast.error(e.message),
  });

  const [editingPlan, setEditingPlan] = useState(false);
  const [planForm, setPlanForm] = useState({
    desiredCourse: "",
    finalEducation: "",
    totalTheorySubjects: "",
    hasPractice: false,
    practiceHours: "",
    practiceDate: "",
    practiceArranged: false,
    practiceStatus: "미섭외",
    specialNotes: "",
  });

  const [semDialogOpen, setSemDialogOpen] = useState(false);
  const [semForm, setSemForm] = useState({
  semesterOrder: "",
  plannedMonth: "",
  plannedInstitutionId: "",
  plannedSubjectCount: "",
  plannedAmount: "",
});

  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundForm, setRefundForm] = useState({
    refundAmount: "",
    refundDate: new Date().toISOString().slice(0, 10),
    reason: "",
  });

  const [editingRefundId, setEditingRefundId] = useState<number | null>(null);
  const [editRefundForm, setEditRefundForm] = useState({
    refundAmount: "",
    refundDate: "",
    reason: "",
  });

  const createRefundMut = trpc.refund.create.useMutation({
    onSuccess: () => {
      utils.student.paymentSummary.invalidate({ studentId });
      utils.refund.listByStudent.invalidate({ studentId });
      toast.success("환불 등록 완료");
      setRefundDialogOpen(false);
      setRefundForm({
        refundAmount: "",
        refundDate: new Date().toISOString().slice(0, 10),
        reason: "",
      });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateRefundMut = trpc.refund.update.useMutation({
    onSuccess: () => {
      utils.student.paymentSummary.invalidate({ studentId });
      utils.refund.listByStudent.invalidate({ studentId });
      toast.success("환불 수정 완료");
      setEditingRefundId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteRefundMut = trpc.refund.delete.useMutation({
    onSuccess: () => {
      utils.student.paymentSummary.invalidate({ studentId });
      utils.refund.listByStudent.invalidate({ studentId });
      toast.success("환불 삭제 완료");
    },
    onError: (e) => toast.error(e.message),
  });

  const userMap = new Map(allUsers?.map((u: any) => [u.id, u.name || "이름없음"]) ?? []);

  const handleStudentInstitutionChange = (value: string) => {
    updateStudentMut.mutate({
      id: studentId,
      institutionId: value ? Number(value) : undefined,
    } as any);
  };

  const handleStudentFieldBlur = (field: string, value: string) => {
    const payload: any = { id: studentId };

   if (field === "subjectCount") {
      payload[field] = value ? parseInt(value) : undefined;
    } else if (field === "startDate" || field === "paymentDate") {
      payload[field] = value || undefined;
    } else {
      payload[field] = value;
    }

    updateStudentMut.mutate(payload);
  };

  const handleSemFieldBlur = (semId: number, field: string, value: string) => {
    const payload: any = { id: semId };

    if (field === "plannedSubjectCount" || field === "actualSubjectCount") {
      payload[field] = value ? parseInt(value) : undefined;
    } else {
      payload[field] = value || undefined;
    }

    updateSemMut.mutate(payload);
  };

  const startEditPlan = () => {
    setPlanForm({
      desiredCourse: plan?.desiredCourse || "",
      finalEducation: plan?.finalEducation || "",
      totalTheorySubjects: plan?.totalTheorySubjects?.toString() || "",
      hasPractice: plan?.hasPractice || false,
      practiceHours: plan?.practiceHours?.toString() || "",
      practiceDate: plan?.practiceDate || "",
      practiceArranged: plan?.practiceArranged || false,
      practiceStatus: (plan as any)?.practiceStatus || "미섭외",
      specialNotes: plan?.specialNotes || "",
    });
    setEditingPlan(true);
  };

  const savePlan = () => {
    upsertPlanMut.mutate({
      studentId,
      desiredCourse: planForm.desiredCourse || undefined,
      finalEducation: planForm.finalEducation || undefined,
      totalTheorySubjects: planForm.totalTheorySubjects ? parseInt(planForm.totalTheorySubjects) : undefined,
      hasPractice: planForm.hasPractice,
      practiceHours: planForm.practiceHours ? parseInt(planForm.practiceHours) : undefined,
      practiceDate: planForm.practiceDate || undefined,
      practiceArranged: planForm.practiceArranged,
      practiceStatus: (planForm.practiceStatus as any) || undefined,
      specialNotes: planForm.specialNotes || undefined,
    });
  };

  const groupedPlanSemesters = useMemo(() => {
    const map = new Map<number, any[]>();
    (planSemesterList || []).forEach((row: any) => {
      const no = Number(row.semesterNo || 1);
      if (!map.has(no)) map.set(no, []);
      map.get(no)!.push(row);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([semesterNo, rows]) => ({
        semesterNo,
        rows: rows.sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
      }));
  }, [planSemesterList]);

  const sortedSemesters = useMemo(() => {
    return [...(semesters || [])].sort(
      (a: any, b: any) => Number(a.semesterOrder) - Number(b.semesterOrder)
    );
  }, [semesters]);
const totalSemesterCount = useMemo(() => {
  return sortedSemesters.length;
}, [sortedSemesters]);
  const selectedSemester = useMemo(() => {
    return sortedSemesters.find(
      (s: any) => Number(s.semesterOrder) === Number(selectedSemesterOrder)
    );
  }, [sortedSemesters, selectedSemesterOrder]);

  useEffect(() => {
    if (!sortedSemesters.length) {
      setSelectedSemesterOrder(1);
      return;
    }

    const exists = sortedSemesters.some(
      (s: any) => Number(s.semesterOrder) === Number(selectedSemesterOrder)
    );

    if (!exists) {
      setSelectedSemesterOrder(Number(sortedSemesters[0].semesterOrder));
    }
  }, [sortedSemesters, selectedSemesterOrder]);

  const openAddSemester = () => {
    const nextOrder =
      sortedSemesters.length > 0
        ? Math.max(...sortedSemesters.map((s: any) => Number(s.semesterOrder))) + 1
        : 1;

    setSemForm({
  semesterOrder: String(nextOrder),
  plannedMonth: "",
  plannedInstitutionId: "",
  plannedSubjectCount: "",
  plannedAmount: "",
});
    setSemDialogOpen(true);
  };

 const handleAddSemester = () => {
  const selectedInstitution = institutionList?.find(
    (inst: any) => Number(inst.id) === Number(semForm.plannedInstitutionId)
  );

  createSemMut.mutate({
    studentId,
    semesterOrder: parseInt(semForm.semesterOrder),
    plannedMonth: semForm.plannedMonth || undefined,
    plannedInstitutionId: semForm.plannedInstitutionId
      ? Number(semForm.plannedInstitutionId)
      : undefined,
    plannedInstitution: selectedInstitution?.name || undefined,
    plannedSubjectCount: semForm.plannedSubjectCount
      ? parseInt(semForm.plannedSubjectCount)
      : undefined,
    plannedAmount: semForm.plannedAmount || undefined,
  } as any);
};

  const nextPlanSemesterNo = useMemo(() => {
    if (!groupedPlanSemesters.length) return 1;
    return Math.max(...groupedPlanSemesters.map((g) => g.semesterNo)) + 1;
  }, [groupedPlanSemesters]);

  const planTotals = useMemo(() => {
    let major = 0;
    let liberal = 0;
    let general = 0;

    (planSemesterList || []).forEach((row: any) => {
      const c = Number(row.credits || 3);
      if (row.planCategory === "전공") major += c;
      if (row.planCategory === "교양") liberal += c;
      if (row.planCategory === "일반") general += c;
    });

    return {
      major,
      liberal,
      general,
      total: major + liberal + general,
    };
  }, [planSemesterList]);

  const transferTotals = useMemo(() => {
    let major = 0;
    let liberal = 0;
    let general = 0;

    (transferSubjectList || []).forEach((row: any) => {
      const c = Number(row.credits || 0);
      if (row.transferCategory === "전공") major += c;
      if (row.transferCategory === "교양") liberal += c;
      if (row.transferCategory === "일반") general += c;
    });

    return {
      major,
      liberal,
      general,
      total: major + liberal + general,
    };
  }, [transferSubjectList]);

  const finalTotals = useMemo(() => {
    const major = planTotals.major + transferTotals.major;
    const liberal = planTotals.liberal + transferTotals.liberal;
    const general = planTotals.general + transferTotals.general;

    return {
      major,
      liberal,
      general,
      total: major + liberal + general,
    };
  }, [planTotals, transferTotals]);

const registrationSummary = useMemo(() => {
  const toNumber = (v: any) =>
    Number(String(v ?? "0").replace(/,/g, "").trim()) || 0;

  const sem = selectedSemester;

  return {
    status: student?.status || "",
    startDate:
      sem?.actualStartDate ||
      (selectedSemesterOrder === 1 ? student?.startDate : "") ||
      "",
    paymentAmount: sem?.actualAmount
      ? toNumber(sem.actualAmount)
      : selectedSemesterOrder === 1
        ? toNumber(student?.paymentAmount)
        : 0,
    subjectCount:
      sem?.actualSubjectCount ??
      (selectedSemesterOrder === 1 ? student?.subjectCount : "") ??
      "",
    paymentDate:
      sem?.actualPaymentDate ||
      (selectedSemesterOrder === 1 ? student?.paymentDate : "") ||
      "",
    institution:
      sem?.actualInstitution ||
      (selectedSemesterOrder === 1 ? student?.institution : "") ||
      "",
  };
}, [selectedSemester, selectedSemesterOrder, student]);  

  const registrationInstitutionId = useMemo(() => {
    if (selectedSemester?.actualInstitutionId) {
      return selectedSemester.actualInstitutionId;
    }

    if (selectedSemesterOrder === 1) {
      return student?.institutionId || "";
    }

    return "";
  }, [selectedSemester, selectedSemesterOrder, student]);

  const handleAddPlanSemesterGroup = () => {
    createPlanSemesterMut.mutate({
      studentId,
      semesterNo: nextPlanSemesterNo,
      subjectName: "새 과목",
      category: "전공",
      requirementType: "전공선택",
      sortOrder: 0,
    } as any);
  };

  const handleAddPlanSubject = (semesterNo: number) => {
    const current = (planSemesterList || []).filter((x: any) => Number(x.semesterNo) === Number(semesterNo));
    if (current.length >= 8) {
      toast.error("우리 플랜은 학기당 최대 8과목까지 등록할 수 있습니다.");
      return;
    }

    createPlanSemesterMut.mutate({
      studentId,
      semesterNo,
      subjectName: "새 과목",
      category: "전공",
      requirementType: "전공선택",
      sortOrder: current.length,
    } as any);
  };

  const handlePlanSemesterBlur = (id: number, field: string, value: any) => {
    const payload: any = { id };

    if (field === "semesterNo" || field === "sortOrder") {
      payload[field] = value ? Number(value) : undefined;
    } else {
      payload[field] = value;
    }

    updatePlanSemesterMut.mutate(payload);
  };

  const handleAddTransferSubject = () => {
    if ((transferSubjectList?.length ?? 0) >= 100) {
      toast.error("전적대 과목은 최대 100개까지 등록할 수 있습니다.");
      return;
    }

    createTransferSubjectMut.mutate({
      studentId,
      schoolName: "전적대",
      subjectName: "새 과목",
      category: "전공",
      requirementType: "전공선택",
      credits: 3,
      sortOrder: transferSubjectList?.length ?? 0,
    } as any);
  };

  const handleTransferBlur = (id: number, field: string, value: any) => {
    const payload: any = { id };

    if (field === "credits" || field === "sortOrder") {
      payload[field] = value ? Number(value) : 0;
    } else {
      payload[field] = value;
    }

    updateTransferSubjectMut.mutate(payload);
  };

  const requirementBadgeClass = (type?: string | null) => {
    if (type === "전공필수") return "bg-red-50 text-red-600 border border-red-200";
    if (type === "전공선택") return "bg-white text-black border border-gray-300";
    if (type === "교양") return "bg-blue-50 text-blue-600 border border-blue-200";
    if (type === "일반") return "bg-gray-50 text-gray-600 border border-gray-200";
    return "bg-gray-50 text-gray-600 border border-gray-200";
  };

  if (studentLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setLocation("/students")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> 목록으로
        </Button>
        <p className="text-muted-foreground text-center py-20">학생 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const statusColor = (s: string) => {
    switch (s) {
      case "등록":
        return "bg-emerald-100 text-emerald-700";
      case "종료":
        return "bg-gray-200 text-gray-600";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/students")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{student.clientName}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {student.course} · 담당: {userMap.get(student.assigneeId) || "-"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge className={statusColor(student.status)}>{student.status}</Badge>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
  <CardHeader className="pb-3">
    <CardTitle className="text-base">
      매출 보고 / 등록 정보 - {selectedSemesterOrder}학기
    </CardTitle>
  </CardHeader>
  <CardContent>
    <div className="flex gap-2 mb-4 flex-wrap">
      {sortedSemesters.map((sem: any) => (
        <Button
          key={sem.id}
          type="button"
          size="sm"
          variant={
            Number(selectedSemesterOrder) === Number(sem.semesterOrder)
              ? "default"
              : "outline"
          }
          onClick={() => setSelectedSemesterOrder(Number(sem.semesterOrder))}
        >
          {sem.semesterOrder}학기
        </Button>
      ))}
    </div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
      <div>
        <p className="text-xs text-muted-foreground mb-0.5">이름</p>
        <EditableCell
          value={student.clientName}
          onBlur={(v) => handleStudentFieldBlur("clientName", v)}
          disabled
        />
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-0.5">연락처</p>
        <EditableCell
          value={formatPhone(student.phone)}
          onBlur={(v) => handleStudentFieldBlur("phone", v.replace(/\D/g, ""))}
          disabled
        />
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-0.5">등록 과정</p>
        <EditableCell
          value={student.course}
          onBlur={(v) => handleStudentFieldBlur("course", v)}
          disabled
        />
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-0.5">상태</p>
        <Select
  value={student.status || "등록"}
  onValueChange={(v) =>
    updateStudentMut.mutate({ id: studentId, status: v as "등록" | "종료" })
  }
>
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="등록">등록</SelectItem>
            <SelectItem value="종료">종료</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-0.5">개강 날짜</p>
        <EditableCell
          value={registrationSummary.startDate ? formatDate(registrationSummary.startDate) : ""}
          onBlur={(v) => handleStudentFieldBlur("startDate", v)}
          type="date"
        />
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-0.5">
          {selectedSemesterOrder}학기 결제 금액
        </p>
        <EditableCell
          value={
            registrationSummary.paymentAmount
              ? Number(registrationSummary.paymentAmount).toLocaleString() + "원"
              : ""
          }
          onBlur={(v) =>
            handleStudentFieldBlur("paymentAmount", v.replace(/[^0-9]/g, ""))
          }
        />
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-0.5">과목 수</p>
        <EditableCell
          value={registrationSummary.subjectCount?.toString() || ""}
          onBlur={(v) => handleStudentFieldBlur("subjectCount", v)}
        />
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-0.5">결제 일자</p>
        <EditableCell
          value={registrationSummary.paymentDate ? formatDate(registrationSummary.paymentDate) : ""}
          onBlur={(v) => handleStudentFieldBlur("paymentDate", v)}
          type="date"
        />
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-0.5">교육원</p>
        <div className="h-8 px-3 rounded-md border bg-muted/30 text-sm flex items-center text-black">
          {registrationInstitutionId
            ? institutionList?.find(
                (inst: any) => Number(inst.id) === Number(registrationInstitutionId)
              )?.name || "-"
            : "-"}
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-0.5">총 학기 수</p>
        <EditableCell
          value={sortedSemesters.length ? String(sortedSemesters.length) : "0"}
          onBlur={() => {}}
          disabled
        />
      </div>
    </div>

    {paymentSummary && (
      <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">총 결제예정 금액</p>
          <p className="text-lg font-bold text-blue-700">
            {Number(paymentSummary.totalRequired || 0).toLocaleString()}원
          </p>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">수납 완료 금액</p>
          <p className="text-lg font-bold text-emerald-700">
            {Number(paymentSummary.totalPaid || 0).toLocaleString()}원
          </p>
        </div>
        <div className="bg-red-50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">환불 금액</p>
          <p className="text-lg font-bold text-red-600">
            {Number(paymentSummary.totalRefund || 0) > 0
              ? `-${Number(paymentSummary.totalRefund).toLocaleString()}원`
              : "0원"}
          </p>
        </div>
        <div className="bg-amber-50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground">잔여 금액</p>
          <p className="text-lg font-bold text-amber-700">
            {Number(
              (paymentSummary.totalRequired || 0) - (paymentSummary.totalPaid || 0)
            ).toLocaleString()}
            원
          </p>
        </div>
      </div>
    )}
  </CardContent>
</Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">학기별 예정표 / 결제표</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setRefundDialogOpen(true)} className="gap-1 text-red-600 border-red-200 hover:bg-red-50">
              환불 등록
            </Button>
            <Button variant="outline" size="sm" onClick={openAddSemester} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> 학기 추가
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-[60px]">학기</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">예정 개강월</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">예정 교육원</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">예정 과목수</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">예정 금액</th>
                  <th className="px-3 py-2 text-left font-medium text-primary">실제 개강일</th>
                  <th className="px-3 py-2 text-left font-medium text-primary">실제 교육원</th>
                  <th className="px-3 py-2 text-left font-medium text-primary">실제 과목수</th>
                  <th className="px-3 py-2 text-left font-medium text-primary">실제 금액</th>
                  <th className="px-3 py-2 text-left font-medium text-primary">결제일</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground w-[50px]">완료</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground w-[100px]">관리</th>
                </tr>
              </thead>
              <tbody>
                {!semesters || semesters.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">등록된 학기가 없습니다.</td>
                  </tr>
                ) : (
                  semesters.map((sem: any) => (
                    <tr key={sem.id} className={`border-b last:border-0 ${sem.isCompleted ? "bg-emerald-50/50" : ""}`}>
                      <td className="px-3 py-1.5 font-medium text-sm">
                        {sem.semesterOrder}학기
                        {sem.isLocked && <Lock className="inline h-3 w-3 ml-1 text-amber-500" />}
                      </td>
                      <td className="px-1 py-0.5">
                        <EditableCell
                          value={sem.plannedMonth ? (sem.plannedMonth.length === 6 ? sem.plannedMonth.slice(0, 4) + "-" + sem.plannedMonth.slice(4) : sem.plannedMonth) : ""}
                          onBlur={(v) => handleSemFieldBlur(sem.id, "plannedMonth", v.replace(/-/g, "").slice(0, 6))}
                          disabled={sem.isLocked}
                        />
                      </td>
                      <td className="px-1 py-0.5">
                        <Select
                          value={sem.plannedInstitutionId ? String(sem.plannedInstitutionId) : ""}
                          onValueChange={(v) =>
                            updateSemMut.mutate({
                              id: sem.id,
                              plannedInstitutionId: Number(v),
                            } as any)
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="교육원 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {(institutionList || []).map((inst: any) => (
                              <SelectItem key={inst.id} value={String(inst.id)}>
                                {inst.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-1 py-0.5">
                        <EditableCell
                          value={sem.plannedSubjectCount?.toString() || ""}
                          onBlur={(v) => handleSemFieldBlur(sem.id, "plannedSubjectCount", v)}
                          disabled={sem.isLocked}
                        />
                      </td>
                      <td className="px-1 py-0.5">
                        <EditableCell
                          value={sem.plannedAmount ? Number(sem.plannedAmount).toLocaleString() : ""}
                          onBlur={(v) => handleSemFieldBlur(sem.id, "plannedAmount", v.replace(/[^0-9]/g, ""))}
                          disabled={sem.isLocked}
                        />
                      </td>

                      <td className="px-1 py-0.5">
                        <EditableCell
                          value={sem.actualStartDate ? (typeof sem.actualStartDate === "string" ? sem.actualStartDate.slice(0, 10) : new Date(sem.actualStartDate).toISOString().slice(0, 10)) : ""}
                          onBlur={(v) => handleSemFieldBlur(sem.id, "actualStartDate", v)}
                          type="date"
                          className="text-primary"
                        />
                      </td>
                      <td className="px-1 py-0.5">
                        <Select
                          value={sem.actualInstitutionId ? String(sem.actualInstitutionId) : ""}
                          onValueChange={(v) =>
                            updateSemMut.mutate({
                              id: sem.id,
                              actualInstitutionId: Number(v),
                            } as any)
                          }
                        >
                          <SelectTrigger className="h-8 text-sm text-primary">
                            <SelectValue placeholder="교육원 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {(institutionList || []).map((inst: any) => (
                              <SelectItem key={inst.id} value={String(inst.id)}>
                                {inst.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-1 py-0.5">
                        <EditableCell value={sem.actualSubjectCount?.toString() || ""} onBlur={(v) => handleSemFieldBlur(sem.id, "actualSubjectCount", v)} className="text-primary" />
                      </td>
                      <td className="px-1 py-0.5">
                        <EditableCell
                          value={sem.actualAmount ? Number(sem.actualAmount).toLocaleString() : ""}
                          onBlur={(v) => handleSemFieldBlur(sem.id, "actualAmount", v.replace(/[^0-9]/g, ""))}
                          className="text-primary font-medium"
                        />
                      </td>
                      <td className="px-1 py-0.5">
                        <EditableCell
                          value={sem.actualPaymentDate ? (typeof sem.actualPaymentDate === "string" ? sem.actualPaymentDate.slice(0, 10) : new Date(sem.actualPaymentDate).toISOString().slice(0, 10)) : ""}
                          onBlur={(v) => handleSemFieldBlur(sem.id, "actualPaymentDate", v)}
                          type="date"
                          className="text-primary"
                        />
                      </td>

                      <td className="px-3 py-1.5 text-center">
                        <Checkbox checked={sem.isCompleted} onCheckedChange={(checked) => updateSemMut.mutate({ id: sem.id, isCompleted: !!checked })} />
                      </td>

                      <td className="px-2 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="예정표 가져오기" onClick={() => copyPlannedMut.mutate({ id: sem.id })}>
                            <Copy className="h-3 w-3 text-blue-500" />
                          </Button>
                          {!sem.isLocked && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm("삭제하시겠습니까?")) deleteSemMut.mutate({ id: sem.id });
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
  <CardHeader className="flex flex-row items-center justify-between pb-3">
    <CardTitle className="text-base">플랜 요약</CardTitle>
    {!editingPlan ? (
      <Button variant="outline" size="sm" onClick={startEditPlan} className="gap-1">
        {plan ? "수정" : "작성"}
      </Button>
    ) : (
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditingPlan(false)}>
          취소
        </Button>
        <Button size="sm" onClick={savePlan} disabled={upsertPlanMut.isPending} className="gap-1">
          <Save className="h-3.5 w-3.5" /> 저장
        </Button>
      </div>
    )}
  </CardHeader>

  <CardContent>
    {!editingPlan ? (
      plan ? (
        <div className="space-y-3">
          <div className="bg-muted/50 rounded-lg p-4 text-sm">
            <p>
              <span className="font-medium">희망과정:</span> {plan.desiredCourse || "-"} ·{" "}
              <span className="font-medium">최종학력:</span> {plan.finalEducation || "-"} ·{" "}
              <span className="font-medium">이론 과목:</span> {plan.totalTheorySubjects ?? "-"}과목 ·{" "}
              <span className="font-medium">실습:</span> {plan.hasPractice ? "있음" : "없음"} ·{" "}
              <span className="font-medium">특이사항:</span> {plan.specialNotes || "없음"}
            </p>
          </div>

          {plan.hasPractice && (
            <div className="bg-blue-50 rounded-lg p-4 text-sm">
              <p className="font-medium text-blue-700 mb-1">실습 정보</p>
              <p>
                <span className="font-medium">실습 시간:</span> {plan.practiceHours ? plan.practiceHours + "시간" : "-"} ·{" "}
                <span className="font-medium">실습 예정일:</span> {plan.practiceDate || "-"} ·{" "}
                <span className="font-medium">섭외 상태:</span>{" "}
                {(plan as any).practiceStatus || (plan.practiceArranged ? "섭외완료" : "미섭외")}
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground py-4 text-center">
          아직 플랜이 작성되지 않았습니다.
        </p>
      )
    ) : (
      <div className="grid gap-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label className="text-xs">희망과정</Label>
            <Input
              value={planForm.desiredCourse}
              onChange={(e) => setPlanForm({ ...planForm, desiredCourse: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">최종학력</Label>
            <Input
              value={planForm.finalEducation}
              onChange={(e) => setPlanForm({ ...planForm, finalEducation: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">총 이론 과목 수</Label>
            <Input
              type="number"
              value={planForm.totalTheorySubjects}
              onChange={(e) => setPlanForm({ ...planForm, totalTheorySubjects: e.target.value })}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            checked={planForm.hasPractice}
            onCheckedChange={(checked) => setPlanForm({ ...planForm, hasPractice: !!checked })}
          />
          <Label className="text-sm">실습 필요</Label>
        </div>

        {planForm.hasPractice && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pl-6 border-l-2 border-blue-200">
            <div className="space-y-1">
              <Label className="text-xs">실습 시간</Label>
              <Input
                type="number"
                value={planForm.practiceHours}
                onChange={(e) => setPlanForm({ ...planForm, practiceHours: e.target.value })}
                placeholder="시간"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">실습 예정일</Label>
              <Input
                value={planForm.practiceDate}
                onChange={(e) => setPlanForm({ ...planForm, practiceDate: e.target.value })}
                placeholder="예: 2026-06"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">섭외 상태</Label>
              <select
                className="w-full h-9 px-3 text-sm border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                value={planForm.practiceStatus}
                onChange={(e) =>
                  setPlanForm({
                    ...planForm,
                    practiceStatus: e.target.value,
                    practiceArranged: e.target.value === "섭외완료",
                  })
                }
              >
                <option value="미섭외">미섭외</option>
                <option value="섭외중">섭외중</option>
                <option value="섭외완료">섭외완료</option>
              </select>
            </div>
          </div>
        )}

        <div className="space-y-1">
          <Label className="text-xs">특이사항</Label>
          <Textarea
            value={planForm.specialNotes}
            onChange={(e) => setPlanForm({ ...planForm, specialNotes: e.target.value })}
            rows={2}
          />
        </div>
      </div>
    )}
  </CardContent>
</Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">학생 플랜</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleAddPlanSemesterGroup} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> 학기 추가
            </Button>
            <Button variant="outline" size="sm" onClick={handleAddTransferSubject} className="gap-1">
              <Plus className="h-3.5 w-3.5" /> 전적대 추가
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm">우리 플랜 (학점은행제 / 과목당 3학점 고정)</h3>
              <p className="text-xs text-muted-foreground mt-1">학기당 최대 8과목까지 등록 가능합니다.</p>
            </div>

            {groupedPlanSemesters.length === 0 ? (
              <div className="border rounded-lg p-6 text-sm text-muted-foreground text-center">
                등록된 학기 플랜이 없습니다.
              </div>
            ) : (
              groupedPlanSemesters.map((group) => (
                <div key={group.semesterNo} className="border rounded-lg overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
                    <div className="font-medium">{group.semesterNo}학기</div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddPlanSubject(group.semesterNo)}
                      disabled={group.rows.length >= 8}
                    >
                      과목 추가
                    </Button>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-white">
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">과목명</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground w-[110px]">구분</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground w-[130px]">타입</th>
                          <th className="px-3 py-2 text-center font-medium text-muted-foreground w-[70px]">학점</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground w-[70px]">관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((row: any) => (
                          <tr key={row.id} className="border-b last:border-0">
                            <td className="px-2 py-1">
                              <EditableCell
                                value={row.subjectName || ""}
                                onBlur={(v) => handlePlanSemesterBlur(row.id, "subjectName", v)}
                                className={row.planRequirementType === "전공필수" ? "text-red-600 font-medium" : ""}
                              />
                            </td>
                            <td className="px-2 py-1">
                              <select
                                className="w-full h-8 px-2 text-sm border rounded bg-white"
                                value={row.planCategory || "전공"}
                                onChange={(e) => {
                                  const nextCategory = e.target.value;

                                  handlePlanSemesterBlur(row.id, "category", nextCategory);

                                  if (nextCategory === "교양") {
                                    handlePlanSemesterBlur(row.id, "requirementType", "교양");
                                  } else if (nextCategory === "일반") {
                                    handlePlanSemesterBlur(row.id, "requirementType", "일반");
                                  } else if (nextCategory === "전공") {
                                    handlePlanSemesterBlur(
                                      row.id,
                                      "requirementType",
                                      row.planRequirementType === "전공필수" ? "전공필수" : "전공선택"
                                    );
                                  }
                                }}
                              >
                                <option value="전공">전공</option>
                                <option value="교양">교양</option>
                                <option value="일반">일반</option>
                              </select>
                            </td>
                            <td className="px-2 py-1">
                              {row.planCategory === "전공" ? (
                                <select
                                  className={`w-full h-8 px-2 text-sm rounded ${requirementBadgeClass(row.planRequirementType)}`}
                                  value={row.planRequirementType || "전공선택"}
                                  onChange={(e) => handlePlanSemesterBlur(row.id, "requirementType", e.target.value)}
                                >
                                  <option value="전공필수">전공필수</option>
                                  <option value="전공선택">전공선택</option>
                                </select>
                              ) : (
                                <div
                                  className={`w-full h-8 px-2 text-sm rounded border flex items-center ${requirementBadgeClass(row.planCategory)}`}
                                >
                                  {row.planCategory}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center font-medium text-black">3</td>
                            <td className="px-2 py-1 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (confirm("과목을 삭제하시겠습니까?")) {
                                    deletePlanSemesterMut.mutate({ id: row.id });
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm">전적대 / 이전 이수과목</h3>
              <p className="text-xs text-muted-foreground mt-1">최대 100과목까지 등록 가능하며 학점은 직접 입력합니다.</p>
            </div>

            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">학교명</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">과목명</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground w-[110px]">구분</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground w-[130px]">타입</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground w-[80px]">학점</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground w-[70px]">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!transferSubjectList || transferSubjectList.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                          등록된 전적대 과목이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      transferSubjectList.map((row: any) => (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="px-2 py-1">
                            <EditableCell
                              value={row.schoolName || ""}
                              onBlur={(v) => handleTransferBlur(row.id, "schoolName", v)}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <EditableCell
                              value={row.subjectName || ""}
                              onBlur={(v) => handleTransferBlur(row.id, "subjectName", v)}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <select
                              className="w-full h-8 px-2 text-sm border rounded bg-white"
                              value={row.transferCategory || "전공"}
                              onChange={(e) => handleTransferBlur(row.id, "category", e.target.value)}
                            >
                              <option value="전공">전공</option>
                              <option value="교양">교양</option>
                              <option value="일반">일반</option>
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <select
                              className={`w-full h-8 px-2 text-sm rounded ${requirementBadgeClass(row.transferRequirementType)}`}
                              value={row.transferRequirementType || "전공선택"}
                              onChange={(e) => handleTransferBlur(row.id, "requirementType", e.target.value)}
                            >
                              <option value="전공필수">전공필수</option>
                              <option value="전공선택">전공선택</option>
                              <option value="교양">교양</option>
                              <option value="일반">일반</option>
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <EditableCell
                              value={row.credits?.toString() || ""}
                              onBlur={(v) => handleTransferBlur(row.id, "credits", v)}
                            />
                          </td>
                          <td className="px-2 py-1 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm("전적대 과목을 삭제하시겠습니까?")) {
                                  deleteTransferSubjectMut.mutate({ id: row.id });
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-lg border bg-blue-50 p-4">
              <div className="font-semibold text-sm text-blue-700 mb-2">우리 플랜</div>
              <div className="text-sm space-y-1">
                <div>전공: <span className="font-medium">{planTotals.major}학점</span></div>
                <div>교양: <span className="font-medium">{planTotals.liberal}학점</span></div>
                <div>일반: <span className="font-medium">{planTotals.general}학점</span></div>
                <div className="pt-1 border-t">총합: <span className="font-bold">{planTotals.total}학점</span></div>
              </div>
            </div>

            <div className="rounded-lg border bg-amber-50 p-4">
              <div className="font-semibold text-sm text-amber-700 mb-2">전적대</div>
              <div className="text-sm space-y-1">
                <div>전공: <span className="font-medium">{transferTotals.major}학점</span></div>
                <div>교양: <span className="font-medium">{transferTotals.liberal}학점</span></div>
                <div>일반: <span className="font-medium">{transferTotals.general}학점</span></div>
                <div className="pt-1 border-t">총합: <span className="font-bold">{transferTotals.total}학점</span></div>
              </div>
            </div>

            <div className="rounded-lg border bg-emerald-50 p-4">
              <div className="font-semibold text-sm text-emerald-700 mb-2">최종 합계</div>
              <div className="text-sm space-y-1">
                <div>전공: <span className="font-medium">{finalTotals.major}학점</span></div>
                <div>교양: <span className="font-medium">{finalTotals.liberal}학점</span></div>
                <div>일반: <span className="font-medium">{finalTotals.general}학점</span></div>
                <div className="pt-1 border-t">총합: <span className="font-bold">{finalTotals.total}학점</span></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={semDialogOpen} onOpenChange={setSemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>학기 추가</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">학기 순서</Label>
                <Input type="number" value={semForm.semesterOrder} onChange={(e) => setSemForm({ ...semForm, semesterOrder: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">개강 예정월</Label>
                <Input value={semForm.plannedMonth} onChange={(e) => setSemForm({ ...semForm, plannedMonth: e.target.value })} placeholder="예: 2026-09" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
  <div className="space-y-1">
    <Label className="text-xs">교육원</Label>
    <Select
      value={semForm.plannedInstitutionId}
      onValueChange={(v) => setSemForm({ ...semForm, plannedInstitutionId: v })}
    >
      <SelectTrigger className="h-9 text-sm">
        <SelectValue placeholder="교육원 선택" />
      </SelectTrigger>
      <SelectContent>
        {(institutionList || []).map((inst: any) => (
          <SelectItem key={inst.id} value={String(inst.id)}>
            {inst.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
  <div className="space-y-1">
    <Label className="text-xs">과목 수</Label>
    <Input
      type="number"
      value={semForm.plannedSubjectCount}
      onChange={(e) => setSemForm({ ...semForm, plannedSubjectCount: e.target.value })}
    />
  </div>
</div>

            <div className="space-y-1">
              <Label className="text-xs">예정 금액</Label>
              <Input value={semForm.plannedAmount} onChange={(e) => setSemForm({ ...semForm, plannedAmount: e.target.value })} placeholder="예: 500000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSemDialogOpen(false)}>취소</Button>
            <Button onClick={handleAddSemester} disabled={createSemMut.isPending}>추가</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {isAdmin && refundList && refundList.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-red-600">환불 내역</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-red-50/50">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">환불일</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">환불 금액</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">사유</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground w-[100px]">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {refundList.map((r: any) => (
                    <tr key={r.id} className="border-b last:border-0">
                      {editingRefundId === r.id ? (
                        <>
                          <td className="px-3 py-1.5">
                            <Input
                              type="date"
                              className="h-8 text-sm"
                              value={editRefundForm.refundDate}
                              onChange={(e) => setEditRefundForm({ ...editRefundForm, refundDate: e.target.value })}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input
                              className="h-8 text-sm text-right"
                              value={editRefundForm.refundAmount}
                              onChange={(e) => setEditRefundForm({ ...editRefundForm, refundAmount: e.target.value.replace(/[^0-9]/g, "") })}
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input
                              className="h-8 text-sm"
                              value={editRefundForm.reason}
                              onChange={(e) => setEditRefundForm({ ...editRefundForm, reason: e.target.value })}
                              placeholder="사유"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-emerald-600"
                                onClick={() => {
                                  if (!editRefundForm.refundAmount) {
                                    toast.error("금액을 입력하세요");
                                    return;
                                  }
                                  updateRefundMut.mutate({
                                    id: r.id,
                                    refundAmount: editRefundForm.refundAmount,
                                    refundDate: editRefundForm.refundDate,
                                    reason: editRefundForm.reason || undefined,
                                  });
                                }}
                                disabled={updateRefundMut.isPending}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingRefundId(null)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2 text-sm">
                            {r.refundDate ? (typeof r.refundDate === "string" ? r.refundDate.slice(0, 10) : new Date(r.refundDate).toISOString().slice(0, 10)) : "-"}
                          </td>
                          <td className="px-4 py-2 text-right text-red-600 font-medium">
                            -{Number(r.refundAmount).toLocaleString()}원
                          </td>
                          <td className="px-4 py-2 text-sm text-muted-foreground">{r.reason || "-"}</td>
                          <td className="px-2 py-2 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="수정"
                                onClick={() => {
                                  setEditingRefundId(r.id);
                                  setEditRefundForm({
                                    refundAmount: r.refundAmount?.toString() || "",
                                    refundDate: r.refundDate ? (typeof r.refundDate === "string" ? r.refundDate.slice(0, 10) : new Date(r.refundDate).toISOString().slice(0, 10)) : "",
                                    reason: r.reason || "",
                                  });
                                }}
                              >
                                <Pencil className="h-3 w-3 text-blue-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                title="삭제"
                                onClick={() => {
                                  if (confirm("환불 내역을 삭제하시겠습니까?")) deleteRefundMut.mutate({ id: r.id });
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {!isAdmin && refundList && refundList.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-red-600">환불 내역</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-red-50/50">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">환불일</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">환불 금액</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">사유</th>
                  </tr>
                </thead>
                <tbody>
                  {refundList.map((r: any) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-4 py-2 text-sm">
                        {r.refundDate ? (typeof r.refundDate === "string" ? r.refundDate.slice(0, 10) : new Date(r.refundDate).toISOString().slice(0, 10)) : "-"}
                      </td>
                      <td className="px-4 py-2 text-right text-red-600 font-medium">
                        -{Number(r.refundAmount).toLocaleString()}원
                      </td>
                      <td className="px-4 py-2 text-sm text-muted-foreground">{r.reason || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>환불 등록</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs">환불 금액</Label>
              <Input value={refundForm.refundAmount} onChange={(e) => setRefundForm({ ...refundForm, refundAmount: e.target.value })} placeholder="예: 300000" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">환불 일자</Label>
              <Input type="date" value={refundForm.refundDate} onChange={(e) => setRefundForm({ ...refundForm, refundDate: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">사유</Label>
              <Textarea value={refundForm.reason} onChange={(e) => setRefundForm({ ...refundForm, reason: e.target.value })} rows={2} placeholder="환불 사유" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>취소</Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!refundForm.refundAmount) {
                  toast.error("환불 금액을 입력하세요");
                  return;
                }
                createRefundMut.mutate({
                  studentId,
                  refundAmount: refundForm.refundAmount,
                  refundDate: refundForm.refundDate,
                  reason: refundForm.reason || undefined,
                });
              }}
              disabled={createRefundMut.isPending}
            >
              환불 등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}