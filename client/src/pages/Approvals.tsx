import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, ShieldAlert, Loader2, Paperclip, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function formatCurrency(amount: number | string | null | undefined) {
  if (!amount) return "-";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (isNaN(n) || n === 0) return "-";
  return new Intl.NumberFormat("ko-KR").format(n) + "원";
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

export default function Approvals() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();

  const { data: students, isLoading: studentsLoading } = trpc.student.list.useQuery();
  const { data: allUsers } = trpc.users.list.useQuery();

  const {
    data: pendingRefunds,
    isLoading: refundsLoading,
  } = trpc.refund.listPending.useQuery(undefined, {
    enabled:
  user?.role === "admin" ||
  user?.role === "host" ||
  user?.role === "superhost",
  });

  const approveStudentMutation = trpc.student.approve.useMutation({
  onSuccess: async () => {
    await Promise.all([
      utils.student.list.invalidate(),
      utils.dashboard.stats.invalidate(),
      utils.dashboard.totalStats.invalidate(),
      utils.semester.listAll.invalidate(),
    ]);
    toast.success("학생 승인 상태가 변경되었습니다. 승인 시 최종 등록 처리 및 반영 데이터가 갱신됩니다.");
  },
  onError: (e) => toast.error(e.message),
});

  const approveRefundMutation = trpc.refund.approve.useMutation({
  onSuccess: async () => {
    await Promise.all([
      utils.refund.listPending.invalidate(),
      utils.student.list.invalidate(),
      utils.dashboard.stats.invalidate(),
      utils.dashboard.totalStats.invalidate(),
      utils.semester.listAll.invalidate(),
    ]);
    toast.success("환불 승인 처리되었습니다.");
  },
  onError: (e) => toast.error(e.message),
});

  const rejectRefundMutation = trpc.refund.reject.useMutation({
  onSuccess: async () => {
    await Promise.all([
      utils.refund.listPending.invalidate(),
      utils.student.list.invalidate(),
      utils.dashboard.stats.invalidate(),
      utils.dashboard.totalStats.invalidate(),
      utils.semester.listAll.invalidate(),
    ]);
    toast.success("환불 불승인 처리되었습니다.");
  },
  onError: (e) => toast.error(e.message),
});

  const userMap = new Map(allUsers?.map((u: any) => [u.id, u.name || "이름없음"]) ?? []);

  const isAdminOrHost =
  user?.role === "admin" ||
  user?.role === "host" ||
  user?.role === "superhost";

  if (!isAdminOrHost) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <ShieldAlert className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">관리자 또는 호스트만 접근할 수 있습니다.</p>
      </div>
    );
  }

  if (studentsLoading || refundsLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pendingStudents =
  students?.filter(
    (s: any) =>
      s.approvalStatus === "대기" &&
      Number(s.completedSemesterCount || 0) > 0
  ) ?? [];
  const approvedStudents = students?.filter((s: any) => s.approvalStatus === "승인") ?? [];
  const rejectedStudents = students?.filter((s: any) => s.approvalStatus === "불승인") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">승인 관리</h1>
        <p className="text-muted-foreground mt-1">
  상담DB에서 등록예정으로 이관된 학생을 최종 승인/불승인 처리합니다. 학생 승인이 완료되어야 등록 확정, 매출 반영, 학기별 예정표 반영이 진행됩니다.
</p>
      </div>

      {/* 학생 승인 대기 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            학생 승인 대기
            {pendingStudents.length > 0 && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                {pendingStudents.length}건
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">이름</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">연락처</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">과정</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">결제금액</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">교육원</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">담당자</th>
	<th className="px-4 py-2.5 text-center font-medium text-muted-foreground">현재상태</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">처리</th>
                </tr>
              </thead>
              <tbody>
                {pendingStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      등록예정 상태의 승인 대기 학생이 없습니다.
                    </td>
                  </tr>
                ) : (
                  pendingStudents.map((s: any) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <button
                          className="font-medium text-primary hover:underline"
                          onClick={() => setLocation(`/students/${s.id}`)}
                        >
                          {s.clientName}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.phone || "-"}</td>
                      <td className="px-4 py-3">{s.course || "-"}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(s.paymentAmount)}
                      </td>
                      <td className="px-4 py-3">{s.institution || "-"}</td>
<td className="px-4 py-3 text-muted-foreground">
  {userMap.get(s.assigneeId) || "-"}
</td>
<td className="px-4 py-3 text-center">
  <Badge className="bg-amber-100 text-amber-700 text-[10px]">
    {s.approvalStatus === "승인" ? (s.status || "등록") : "등록예정"}
  </Badge>
</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 h-8"
                            onClick={() => {
  const ok = confirm(
    "이 학생을 승인하면 최종 등록 처리되고, 매출 반영 및 학기별 예정표 반영이 진행됩니다. 계속하시겠습니까?"
  );
  if (!ok) return;

  approveStudentMutation.mutate({
  id: Number(s.id),
  approvalStatus: "승인",
});
}}
                            disabled={approveStudentMutation.isPending}
                          >
                            <Check className="h-3.5 w-3.5" /> 승인
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-red-600 border-red-200 hover:bg-red-50 h-8"
                            onClick={() => {
  const ok = confirm(
    "이 학생을 불승인 처리하면 최종 등록되지 않습니다. 계속하시겠습니까?"
  );
  if (!ok) return;

  approveStudentMutation.mutate({
  id: Number(s.id),
  approvalStatus: "불승인",
});
}}
                            disabled={approveStudentMutation.isPending}
                          >
                            <X className="h-3.5 w-3.5" /> 불승인
                          </Button>
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

      {/* 환불 승인 대기 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-red-500" />
            환불 승인 대기
            {!!pendingRefunds?.length && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                {pendingRefunds.length}건
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
<div className="px-4 py-3 text-xs text-amber-700 bg-amber-50 border-b border-amber-100">
  여기서 승인된 학생만 최종 등록으로 확정됩니다. 상세페이지의 입력완료/결제입력은 사전 입력 데이터이며, 최종 확정 기준은 승인관리 승인입니다.
</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">학생</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">환불일</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">환불유형</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">환불금액</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">사유</th>
                  <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">첨부</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">담당자</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">처리</th>
                </tr>
              </thead>
              <tbody>
                {!pendingRefunds?.length ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      환불 승인 대기 건이 없습니다.
                    </td>
                  </tr>
                ) : (
                  pendingRefunds.map((r: any) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <button
                          className="font-medium text-primary hover:underline"
                          onClick={() => setLocation(`/students/${r.studentId}`)}
                        >
                          {r.studentId}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(r.refundDate)}</td>
                      <td className="px-4 py-3">{r.refundType || "-"}</td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">
                        -{formatCurrency(r.refundAmount)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{r.reason || "-"}</td>
                      <td className="px-4 py-3 text-center">
                        {r.attachmentUrl ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1"
                            onClick={() => window.open(r.attachmentUrl, "_blank")}
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            보기
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {userMap.get(r.assigneeId) || "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 h-8"
                            onClick={() => 
approveRefundMutation.mutate({ id: Number(r.id) })
}
                            disabled={approveRefundMutation.isPending}
                          >
                            <Check className="h-3.5 w-3.5" /> 승인
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-red-600 border-red-200 hover:bg-red-50 h-8"
                            onClick={() => 
rejectRefundMutation.mutate({ id: Number(r.id) })
}
                            disabled={rejectRefundMutation.isPending}
                          >
                            <X className="h-3.5 w-3.5" /> 불승인
                          </Button>
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

      {/* 승인 완료 학생 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
  학생 승인 완료 / 최종 등록
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              {approvedStudents.length}건
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">이름</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">연락처</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">과정</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">총 결제예정</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">실수납금액</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">담당자</th>
                  <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">상태</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">변경</th>
                </tr>
              </thead>
              <tbody>
                {approvedStudents.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">
                      승인된 학생이 없습니다.
                    </td>
                  </tr>
                ) : (
                  approvedStudents.map((s: any) => {
                    const paidAmount = Number(s.paidAmount || 0);
                    const approvedRefundAmount = Number(s.approvedRefundAmount || 0);
                    const netPaidAmount = Number(
                      s.netPaidAmount || paidAmount - approvedRefundAmount || 0
                    );

                    return (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="px-4 py-3">
                          <button
                            className="font-medium text-primary hover:underline"
                            onClick={() => setLocation(`/students/${s.id}`)}
                          >
                            {s.clientName}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{s.phone || "-"}</td>
                        <td className="px-4 py-3">{s.course || "-"}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {formatCurrency(s.totalRequired)}
                        </td>
                        <td
                          className="px-4 py-3 text-right font-medium text-emerald-600"
                          title={
                            approvedRefundAmount > 0
                              ? `수납 ${formatCurrency(paidAmount)} / 환불 ${formatCurrency(
                                  approvedRefundAmount
                                )} / 실수납 ${formatCurrency(netPaidAmount)}`
                              : undefined
                          }
                        >
                          {formatCurrency(netPaidAmount)}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {userMap.get(s.assigneeId) || "-"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
  {s.status || "등록"}
</Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-600 text-xs h-7"
                            onClick={() =>
  approveStudentMutation.mutate({
  id: Number(s.id),
  approvalStatus: "불승인",
})
}
                          >
                            불승인으로 변경
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 학생 불승인 */}
      {rejectedStudents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
  학생 불승인 / 등록 보류
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                {rejectedStudents.length}건
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
<div className="px-4 py-3 text-xs text-emerald-700 bg-emerald-50 border-b border-emerald-100">
  이 영역의 학생은 승인관리 승인이 완료되어 최종 등록 처리된 상태입니다. 매출 및 예정표 반영 대상입니다.
</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">이름</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">연락처</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">과정</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">결제금액</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">담당자</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">변경</th>
                  </tr>
                </thead>
                <tbody>
                  {rejectedStudents.map((s: any) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <button
                          className="font-medium text-primary hover:underline"
                          onClick={() => setLocation(`/students/${s.id}`)}
                        >
                          {s.clientName}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.phone || "-"}</td>
                      <td className="px-4 py-3">{s.course || "-"}</td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatCurrency(s.paymentAmount)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {userMap.get(s.assigneeId) || "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-emerald-600 text-xs h-7"
                          onClick={() => {
  const ok = confirm(
    "이 학생을 다시 승인하면 최종 등록 처리됩니다. 계속하시겠습니까?"
  );
  if (!ok) return;

  approveStudentMutation.mutate({
  id: Number(s.id),
  approvalStatus: "승인",
});
}}
                        >
                          승인으로 변경
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}