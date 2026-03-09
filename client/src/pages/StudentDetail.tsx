import { useState, useRef, useEffect } from "react";
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
import { ArrowLeft, Plus, Trash2, Check, X, Save, Copy, Lock, Loader2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";

// ─── Editable Cell (인라인 편집) ────────────────────────────────────
function EditableCell({ value, onBlur, type = "text", disabled = false, className = "" }: {
  value: string; onBlur: (v: string) => void; type?: string; disabled?: boolean; className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setLocalVal(value); }, [value]);
  useEffect(() => { if (editing && inputRef.current) { inputRef.current.focus(); if (type !== "date") inputRef.current.select(); } }, [editing, type]);

  if (disabled) return <span className={`text-sm ${className}`}>{value || "-"}</span>;

  if (editing) {
    return (
      <input ref={inputRef} type={type}
        className="w-full px-2 py-1 text-sm border rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary"
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={() => { setEditing(false); if (localVal !== value) onBlur(localVal); }}
        onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") { setLocalVal(value); setEditing(false); } }}
      />
    );
  }
  return (
    <div className={`px-2 py-1 text-sm cursor-text rounded hover:bg-muted/30 min-h-[28px] flex items-center ${className}`}
      onClick={() => setEditing(true)}>
      {value || <span className="text-muted-foreground/40">-</span>}
    </div>
  );
}

export default function StudentDetail() {
  const params = useParams<{ id: string }>();
  const studentId = parseInt(params.id || "0");
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const isAdmin = user?.role === "admin";

  const { data: student, isLoading: studentLoading } = trpc.student.get.useQuery({ id: studentId });
  const { data: semesters } = trpc.semester.list.useQuery({ studentId });
  const { data: plan } = trpc.plan.get.useQuery({ studentId });
  const { data: allUsers } = trpc.users.list.useQuery();
  const { data: paymentSummary } = trpc.student.paymentSummary.useQuery({ studentId });
  const { data: refundList } = trpc.refund.listByStudent.useQuery({ studentId });

  const updateStudentMut = trpc.student.update.useMutation({
    onSuccess: () => utils.student.get.invalidate({ id: studentId }),
    onError: (e) => toast.error(e.message),
  });
  const createSemMut = trpc.semester.create.useMutation({
    onSuccess: () => { utils.semester.list.invalidate({ studentId }); utils.student.paymentSummary.invalidate({ studentId }); toast.success("학기 추가 완료"); setSemDialogOpen(false); },
    onError: (e) => toast.error(e.message),
  });
  const updateSemMut = trpc.semester.update.useMutation({
    onSuccess: () => { utils.semester.list.invalidate({ studentId }); utils.student.paymentSummary.invalidate({ studentId }); },
    onError: (e) => toast.error(e.message),
  });
  const deleteSemMut = trpc.semester.delete.useMutation({
    onSuccess: () => { utils.semester.list.invalidate({ studentId }); utils.student.paymentSummary.invalidate({ studentId }); toast.success("학기 삭제 완료"); },
    onError: (e) => toast.error(e.message),
  });
  const copyPlannedMut = trpc.semester.copyPlannedToActual.useMutation({
    onSuccess: () => { utils.semester.list.invalidate({ studentId }); toast.success("예정 정보를 실제 결제 정보로 복사했습니다"); },
    onError: (e) => toast.error(e.message),
  });
  const upsertPlanMut = trpc.plan.upsert.useMutation({
    onSuccess: () => { utils.plan.get.invalidate({ studentId }); toast.success("플랜 저장 완료"); setEditingPlan(false); },
    onError: (e) => toast.error(e.message),
  });
  const approveMut = trpc.student.approve.useMutation({
    onSuccess: () => { utils.student.get.invalidate({ id: studentId }); utils.semester.list.invalidate({ studentId }); toast.success("승인 상태 변경 완료"); },
    onError: (e) => toast.error(e.message),
  });

  // Plan edit state
  const [editingPlan, setEditingPlan] = useState(false);
  const [planForm, setPlanForm] = useState({
    desiredCourse: "", finalEducation: "", totalTheorySubjects: "",
    hasPractice: false, practiceHours: "", practiceDate: "", practiceArranged: false, practiceStatus: "미섭외", specialNotes: "",
  });

  // Semester dialog state
  const [semDialogOpen, setSemDialogOpen] = useState(false);
  const [semForm, setSemForm] = useState({
    semesterOrder: "", plannedMonth: "", plannedInstitution: "", plannedSubjectCount: "", plannedAmount: "",
  });

  // Refund dialog state
  const [refundDialogOpen, setRefundDialogOpen] = useState(false);
  const [refundForm, setRefundForm] = useState({ refundAmount: "", refundDate: new Date().toISOString().slice(0, 10), reason: "" });
  const [editingRefundId, setEditingRefundId] = useState<number | null>(null);
  const [editRefundForm, setEditRefundForm] = useState({ refundAmount: "", refundDate: "", reason: "" });
  const createRefundMut = trpc.refund.create.useMutation({
    onSuccess: () => { utils.student.paymentSummary.invalidate({ studentId }); utils.refund.listByStudent.invalidate({ studentId }); toast.success("환불 등록 완료"); setRefundDialogOpen(false); setRefundForm({ refundAmount: "", refundDate: new Date().toISOString().slice(0, 10), reason: "" }); },
    onError: (e) => toast.error(e.message),
  });
  const updateRefundMut = trpc.refund.update.useMutation({
    onSuccess: () => { utils.student.paymentSummary.invalidate({ studentId }); utils.refund.listByStudent.invalidate({ studentId }); toast.success("환불 수정 완료"); setEditingRefundId(null); },
    onError: (e) => toast.error(e.message),
  });
  const deleteRefundMut = trpc.refund.delete.useMutation({
    onSuccess: () => { utils.student.paymentSummary.invalidate({ studentId }); utils.refund.listByStudent.invalidate({ studentId }); toast.success("환불 삭제 완료"); },
    onError: (e) => toast.error(e.message),
  });

  const userMap = new Map(allUsers?.map((u: any) => [u.id, u.name || "이름없음"]) ?? []);

  const handleStudentFieldBlur = (field: string, value: string) => {
    const payload: any = { id: studentId };
    if (field === "subjectCount" || field === "totalSemesters") {
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
      practiceStatus: planForm.practiceStatus as any || undefined,
      specialNotes: planForm.specialNotes || undefined,
    });
  };

  const openAddSemester = () => {
    const nextOrder = (semesters?.length ?? 0) + 2; // 1학기는 학생 등록 시 기본
    setSemForm({
      semesterOrder: String(nextOrder),
      plannedMonth: "", plannedInstitution: "", plannedSubjectCount: "", plannedAmount: "",
    });
    setSemDialogOpen(true);
  };

  const handleAddSemester = () => {
    createSemMut.mutate({
      studentId,
      semesterOrder: parseInt(semForm.semesterOrder),
      plannedMonth: semForm.plannedMonth || undefined,
      plannedInstitution: semForm.plannedInstitution || undefined,
      plannedSubjectCount: semForm.plannedSubjectCount ? parseInt(semForm.plannedSubjectCount) : undefined,
      plannedAmount: semForm.plannedAmount || undefined,
    });
  };

  if (studentLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!student) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setLocation("/students")} className="gap-2"><ArrowLeft className="h-4 w-4" /> 목록으로</Button>
        <p className="text-muted-foreground text-center py-20">학생 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const statusColor = (s: string) => {
    switch (s) { case "등록": return "bg-emerald-100 text-emerald-700"; case "종료": return "bg-gray-200 text-gray-600"; default: return "bg-gray-100 text-gray-700"; }
  };
  const approvalColor = (s: string) => {
    switch (s) { case "승인": return "bg-emerald-100 text-emerald-700"; case "불승인": return "bg-red-100 text-red-700"; default: return "bg-amber-100 text-amber-700"; }
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/students")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{student.clientName}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {student.course} · 담당: {userMap.get(student.assigneeId) || "-"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={statusColor(student.status)}>{student.status}</Badge>
          <Badge className={approvalColor(student.approvalStatus)}>{student.approvalStatus}</Badge>
        </div>
      </div>

      {/* ─── 매출 보고 / 등록 정보 (인라인 편집) ─── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">매출 보고 / 등록 정보</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">이름</p>
              <EditableCell value={student.clientName} onBlur={(v) => handleStudentFieldBlur("clientName", v)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">연락처</p>
              <EditableCell value={student.phone} onBlur={(v) => handleStudentFieldBlur("phone", v)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">등록 과정</p>
              <EditableCell value={student.course} onBlur={(v) => handleStudentFieldBlur("course", v)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">상태</p>
              <Select value={student.status} onValueChange={(v) => updateStudentMut.mutate({ id: studentId, status: v as any })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="등록">등록</SelectItem>
                  <SelectItem value="종료">종료</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">개강 날짜</p>
              <EditableCell value={student.startDate ? new Date(student.startDate).toISOString().slice(0, 10) : ""} onBlur={(v) => handleStudentFieldBlur("startDate", v)} type="date" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">1학기 결제 금액</p>
              <EditableCell value={student.paymentAmount ? Number(student.paymentAmount).toLocaleString() + "원" : ""} onBlur={(v) => handleStudentFieldBlur("paymentAmount", v.replace(/[^0-9]/g, ""))} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">과목 수</p>
              <EditableCell value={student.subjectCount?.toString() || ""} onBlur={(v) => handleStudentFieldBlur("subjectCount", v)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">결제 일자</p>
              <EditableCell value={student.paymentDate ? new Date(student.paymentDate).toISOString().slice(0, 10) : ""} onBlur={(v) => handleStudentFieldBlur("paymentDate", v)} type="date" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">교육원</p>
              <EditableCell value={student.institution || ""} onBlur={(v) => handleStudentFieldBlur("institution", v)} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">총 학기 수</p>
              <EditableCell value={student.totalSemesters?.toString() || ""} onBlur={(v) => handleStudentFieldBlur("totalSemesters", v)} />
            </div>
          </div>

          {/* 결제 요약 */}
          {paymentSummary && (
            <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-blue-50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">총 결제예정 금액</p>
                <p className="text-lg font-bold text-blue-700">{Number(paymentSummary.totalRequired || 0).toLocaleString()}원</p>
              </div>
              <div className="bg-emerald-50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">수납 완료 금액</p>
                <p className="text-lg font-bold text-emerald-700">{Number(paymentSummary.totalPaid || 0).toLocaleString()}원</p>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">환불 금액</p>
                <p className="text-lg font-bold text-red-600">{Number(paymentSummary.totalRefund || 0) > 0 ? `-${Number(paymentSummary.totalRefund).toLocaleString()}원` : "0원"}</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground">잔여 금액</p>
                <p className="text-lg font-bold text-amber-700">{Number((paymentSummary.totalRequired || 0) - (paymentSummary.totalPaid || 0)).toLocaleString()}원</p>
              </div>
            </div>
          )}

          {/* 승인 버튼 (관리자 전용) */}
          {isAdmin && (
            <div className="mt-4 pt-4 border-t flex items-center gap-3">
              <span className="text-sm font-medium">승인 관리:</span>
              <Button size="sm" variant={student.approvalStatus === "승인" ? "default" : "outline"}
                className="gap-1" onClick={() => approveMut.mutate({ id: studentId, approvalStatus: "승인" })}>
                <Check className="h-3.5 w-3.5" /> 승인
              </Button>
              <Button size="sm" variant={student.approvalStatus === "불승인" ? "destructive" : "outline"}
                className="gap-1" onClick={() => approveMut.mutate({ id: studentId, approvalStatus: "불승인" })}>
                <X className="h-3.5 w-3.5" /> 불승인
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── 학기별 예정표 / 결제표 (인라인 편집) ─── */}
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
                  <tr><td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">등록된 학기가 없습니다.</td></tr>
                ) : (
                  semesters.map((sem: any) => (
                    <tr key={sem.id} className={`border-b last:border-0 ${sem.isCompleted ? "bg-emerald-50/50" : ""}`}>
                      <td className="px-3 py-1.5 font-medium text-sm">
                        {sem.semesterOrder}학기
                        {sem.isLocked && <Lock className="inline h-3 w-3 ml-1 text-amber-500" />}
                      </td>
                      {/* 예정 정보 - 잠금 시 편집 불가 */}
                      <td className="px-1 py-0.5"><EditableCell value={sem.plannedMonth ? (sem.plannedMonth.length === 6 ? sem.plannedMonth.slice(0,4) + "-" + sem.plannedMonth.slice(4) : sem.plannedMonth) : ""} onBlur={(v) => handleSemFieldBlur(sem.id, "plannedMonth", v.replace(/-/g, "").slice(0,6))} disabled={sem.isLocked} /></td>
                      <td className="px-1 py-0.5"><EditableCell value={sem.plannedInstitution || ""} onBlur={(v) => handleSemFieldBlur(sem.id, "plannedInstitution", v)} disabled={sem.isLocked} /></td>
                      <td className="px-1 py-0.5"><EditableCell value={sem.plannedSubjectCount?.toString() || ""} onBlur={(v) => handleSemFieldBlur(sem.id, "plannedSubjectCount", v)} disabled={sem.isLocked} /></td>
                      <td className="px-1 py-0.5"><EditableCell value={sem.plannedAmount ? Number(sem.plannedAmount).toLocaleString() : ""} onBlur={(v) => handleSemFieldBlur(sem.id, "plannedAmount", v.replace(/[^0-9]/g, ""))} disabled={sem.isLocked} /></td>
                      {/* 실제 결제 정보 - 항상 편집 가능 */}
                      <td className="px-1 py-0.5"><EditableCell value={sem.actualStartDate ? (typeof sem.actualStartDate === "string" ? sem.actualStartDate.slice(0, 10) : new Date(sem.actualStartDate).toISOString().slice(0, 10)) : ""} onBlur={(v) => handleSemFieldBlur(sem.id, "actualStartDate", v)} type="date" className="text-primary" /></td>
                      <td className="px-1 py-0.5"><EditableCell value={sem.actualInstitution || ""} onBlur={(v) => handleSemFieldBlur(sem.id, "actualInstitution", v)} className="text-primary" /></td>
                      <td className="px-1 py-0.5"><EditableCell value={sem.actualSubjectCount?.toString() || ""} onBlur={(v) => handleSemFieldBlur(sem.id, "actualSubjectCount", v)} className="text-primary" /></td>
                      <td className="px-1 py-0.5"><EditableCell value={sem.actualAmount ? Number(sem.actualAmount).toLocaleString() : ""} onBlur={(v) => handleSemFieldBlur(sem.id, "actualAmount", v.replace(/[^0-9]/g, ""))} className="text-primary font-medium" /></td>
                      <td className="px-1 py-0.5"><EditableCell value={sem.actualPaymentDate ? (typeof sem.actualPaymentDate === "string" ? sem.actualPaymentDate.slice(0, 10) : new Date(sem.actualPaymentDate).toISOString().slice(0, 10)) : ""} onBlur={(v) => handleSemFieldBlur(sem.id, "actualPaymentDate", v)} type="date" className="text-primary" /></td>
                      <td className="px-3 py-1.5 text-center">
                        <Checkbox checked={sem.isCompleted}
                          onCheckedChange={(checked) => updateSemMut.mutate({ id: sem.id, isCompleted: !!checked })} />
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="예정표 가져오기"
                            onClick={() => copyPlannedMut.mutate({ id: sem.id })}>
                            <Copy className="h-3 w-3 text-blue-500" />
                          </Button>
                          {!sem.isLocked && (
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => { if (confirm("삭제하시겠습니까?")) deleteSemMut.mutate({ id: sem.id }); }}>
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

      {/* ─── 플랜 요약 (인라인 편집) ─── */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">플랜 요약</CardTitle>
          {!editingPlan ? (
            <Button variant="outline" size="sm" onClick={startEditPlan} className="gap-1">
              {plan ? "수정" : "작성"}
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setEditingPlan(false)}>취소</Button>
              <Button size="sm" onClick={savePlan} disabled={upsertPlanMut.isPending} className="gap-1"><Save className="h-3.5 w-3.5" /> 저장</Button>
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
                      <span className="font-medium">섭외 상태:</span> {(plan as any).practiceStatus || (plan.practiceArranged ? "섭외완료" : "미섭외")}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">아직 플랜이 작성되지 않았습니다.</p>
            )
          ) : (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1"><Label className="text-xs">희망과정</Label><Input value={planForm.desiredCourse} onChange={(e) => setPlanForm({...planForm, desiredCourse: e.target.value})} /></div>
                <div className="space-y-1"><Label className="text-xs">최종학력</Label><Input value={planForm.finalEducation} onChange={(e) => setPlanForm({...planForm, finalEducation: e.target.value})} /></div>
                <div className="space-y-1"><Label className="text-xs">총 이론 과목 수</Label><Input type="number" value={planForm.totalTheorySubjects} onChange={(e) => setPlanForm({...planForm, totalTheorySubjects: e.target.value})} /></div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox checked={planForm.hasPractice} onCheckedChange={(checked) => setPlanForm({...planForm, hasPractice: !!checked})} />
                <Label className="text-sm">실습 필요</Label>
              </div>
              {planForm.hasPractice && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pl-6 border-l-2 border-blue-200">
                  <div className="space-y-1"><Label className="text-xs">실습 시간</Label><Input type="number" value={planForm.practiceHours} onChange={(e) => setPlanForm({...planForm, practiceHours: e.target.value})} placeholder="시간" /></div>
                  <div className="space-y-1"><Label className="text-xs">실습 예정일</Label><Input value={planForm.practiceDate} onChange={(e) => setPlanForm({...planForm, practiceDate: e.target.value})} placeholder="예: 2026-06" /></div>
                  <div className="space-y-1">
                    <Label className="text-xs">섭외 상태</Label>
                    <select className="w-full h-9 px-3 text-sm border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                      value={planForm.practiceStatus} onChange={(e) => setPlanForm({...planForm, practiceStatus: e.target.value, practiceArranged: e.target.value === "섭외완료"})}>
                      <option value="미섭외">미섭외</option>
                      <option value="섭외중">섭외중</option>
                      <option value="섭외완료">섭외완료</option>
                    </select>
                  </div>
                </div>
              )}
              <div className="space-y-1"><Label className="text-xs">특이사항</Label><Textarea value={planForm.specialNotes} onChange={(e) => setPlanForm({...planForm, specialNotes: e.target.value})} rows={2} /></div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── 학기 추가 다이얼로그 ─── */}
      <Dialog open={semDialogOpen} onOpenChange={setSemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>학기 추가</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label className="text-xs">학기 순서</Label><Input type="number" value={semForm.semesterOrder} onChange={(e) => setSemForm({...semForm, semesterOrder: e.target.value})} /></div>
              <div className="space-y-1"><Label className="text-xs">개강 예정월</Label><Input value={semForm.plannedMonth} onChange={(e) => setSemForm({...semForm, plannedMonth: e.target.value})} placeholder="예: 2026-09" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1"><Label className="text-xs">교육원</Label><Input value={semForm.plannedInstitution} onChange={(e) => setSemForm({...semForm, plannedInstitution: e.target.value})} /></div>
              <div className="space-y-1"><Label className="text-xs">과목 수</Label><Input type="number" value={semForm.plannedSubjectCount} onChange={(e) => setSemForm({...semForm, plannedSubjectCount: e.target.value})} /></div>
            </div>
            <div className="space-y-1"><Label className="text-xs">예정 금액</Label><Input value={semForm.plannedAmount} onChange={(e) => setSemForm({...semForm, plannedAmount: e.target.value})} placeholder="예: 500000" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSemDialogOpen(false)}>취소</Button>
            <Button onClick={handleAddSemester} disabled={createSemMut.isPending}>추가</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── 환불 내역 ─── */}
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
                            <Input type="date" className="h-8 text-sm" value={editRefundForm.refundDate}
                              onChange={(e) => setEditRefundForm({...editRefundForm, refundDate: e.target.value})} />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input className="h-8 text-sm text-right" value={editRefundForm.refundAmount}
                              onChange={(e) => setEditRefundForm({...editRefundForm, refundAmount: e.target.value.replace(/[^0-9]/g, "")})} />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input className="h-8 text-sm" value={editRefundForm.reason}
                              onChange={(e) => setEditRefundForm({...editRefundForm, reason: e.target.value})} placeholder="사유" />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600"
                                onClick={() => {
                                  if (!editRefundForm.refundAmount) { toast.error("금액을 입력하세요"); return; }
                                  updateRefundMut.mutate({ id: r.id, refundAmount: editRefundForm.refundAmount, refundDate: editRefundForm.refundDate, reason: editRefundForm.reason || undefined });
                                }} disabled={updateRefundMut.isPending}>
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
                              <Button variant="ghost" size="icon" className="h-7 w-7" title="수정"
                                onClick={() => {
                                  setEditingRefundId(r.id);
                                  setEditRefundForm({
                                    refundAmount: r.refundAmount?.toString() || "",
                                    refundDate: r.refundDate ? (typeof r.refundDate === "string" ? r.refundDate.slice(0, 10) : new Date(r.refundDate).toISOString().slice(0, 10)) : "",
                                    reason: r.reason || "",
                                  });
                                }}>
                                <Pencil className="h-3 w-3 text-blue-500" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" title="삭제"
                                onClick={() => { if (confirm("환불 내역을 삭제하시겠습니까?")) deleteRefundMut.mutate({ id: r.id }); }}>
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

      {/* 직원도 환불 내역 확인 가능 (수정/삭제 불가) */}
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

      {/* ─── 환불 등록 다이얼로그 ─── */}
      <Dialog open={refundDialogOpen} onOpenChange={setRefundDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>환불 등록</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-1"><Label className="text-xs">환불 금액</Label><Input value={refundForm.refundAmount} onChange={(e) => setRefundForm({...refundForm, refundAmount: e.target.value})} placeholder="예: 300000" /></div>
            <div className="space-y-1"><Label className="text-xs">환불 일자</Label><Input type="date" value={refundForm.refundDate} onChange={(e) => setRefundForm({...refundForm, refundDate: e.target.value})} /></div>
            <div className="space-y-1"><Label className="text-xs">사유</Label><Textarea value={refundForm.reason} onChange={(e) => setRefundForm({...refundForm, reason: e.target.value})} rows={2} placeholder="환불 사유" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialogOpen(false)}>취소</Button>
            <Button variant="destructive" onClick={() => {
              if (!refundForm.refundAmount) { toast.error("환불 금액을 입력하세요"); return; }
              createRefundMut.mutate({ studentId, refundAmount: refundForm.refundAmount, refundDate: refundForm.refundDate, reason: refundForm.reason || undefined });
            }} disabled={createRefundMut.isPending}>환불 등록</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
