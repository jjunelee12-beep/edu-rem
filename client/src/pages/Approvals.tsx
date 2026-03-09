import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, X, ShieldAlert, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function formatCurrency(amount: number | string | null | undefined) {
  if (!amount) return "-";
  const n = typeof amount === "string" ? Number(amount) : amount;
  if (isNaN(n) || n === 0) return "-";
  return new Intl.NumberFormat("ko-KR").format(n) + "원";
}

export default function Approvals() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const { data: students, isLoading } = trpc.student.list.useQuery();
  const { data: allUsers } = trpc.users.list.useQuery();
  const approveMutation = trpc.student.approve.useMutation({
    onSuccess: () => {
      utils.student.list.invalidate();
      utils.dashboard.monthApprovals.invalidate();
      toast.success("승인 상태가 변경되었습니다.");
    },
    onError: (e) => toast.error(e.message),
  });

  const userMap = new Map(allUsers?.map((u: any) => [u.id, u.name || "이름없음"]) ?? []);

const isAdminOrHost =
  user?.role === "admin" || user?.role === "host";

if (!isAdminOrHost) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <ShieldAlert className="h-12 w-12 text-muted-foreground" />
      <p className="text-muted-foreground">
        관리자 또는 호스트만 접근할 수 있습니다.
      </p>
    </div>
  );
}

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const pendingStudents = students?.filter((s: any) => s.approvalStatus === "대기") ?? [];
  const approvedStudents = students?.filter((s: any) => s.approvalStatus === "승인") ?? [];
  const rejectedStudents = students?.filter((s: any) => s.approvalStatus === "불승인") ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">승인 관리</h1>
        <p className="text-muted-foreground mt-1">학생 플랜을 점검하고 승인/불승인 처리합니다. 승인된 건만 정산에 포함됩니다.</p>
      </div>

      {/* 승인 대기 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            승인 대기
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
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">처리</th>
                </tr>
              </thead>
              <tbody>
                {pendingStudents.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">승인 대기 건이 없습니다.</td></tr>
                ) : (
                  pendingStudents.map((s: any) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <button className="font-medium text-primary hover:underline" onClick={() => setLocation(`/students/${s.id}`)}>
                          {s.clientName}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.phone || "-"}</td>
                      <td className="px-4 py-3">{s.course || "-"}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(s.paymentAmount)}</td>
                      <td className="px-4 py-3">{s.institution || "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{userMap.get(s.assigneeId) || "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" className="gap-1 text-emerald-600 border-emerald-200 hover:bg-emerald-50 h-8"
                            onClick={() => approveMutation.mutate({ id: s.id, approvalStatus: "승인" })} disabled={approveMutation.isPending}>
                            <Check className="h-3.5 w-3.5" /> 승인
                          </Button>
                          <Button size="sm" variant="outline" className="gap-1 text-red-600 border-red-200 hover:bg-red-50 h-8"
                            onClick={() => approveMutation.mutate({ id: s.id, approvalStatus: "불승인" })} disabled={approveMutation.isPending}>
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

      {/* 승인 완료 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            승인 완료
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
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">수납금액</th>
                  <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">담당자</th>
                  <th className="px-4 py-2.5 text-center font-medium text-muted-foreground">상태</th>
                  <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">변경</th>
                </tr>
              </thead>
              <tbody>
                {approvedStudents.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">승인된 건이 없습니다.</td></tr>
                ) : (
                  approvedStudents.map((s: any) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <button className="font-medium text-primary hover:underline" onClick={() => setLocation(`/students/${s.id}`)}>
                          {s.clientName}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.phone || "-"}</td>
                      <td className="px-4 py-3">{s.course || "-"}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(s.totalRequired)}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600">{formatCurrency(s.paidAmount)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{userMap.get(s.assigneeId) || "-"}</td>
                      <td className="px-4 py-3 text-center">
                        <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">{s.status || "등록"}</Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" className="text-red-600 text-xs h-7"
                          onClick={() => approveMutation.mutate({ id: s.id, approvalStatus: "불승인" })}>
                          불승인으로 변경
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 불승인 */}
      {rejectedStudents.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              불승인
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                {rejectedStudents.length}건
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
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">결제금액</th>
                    <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">담당자</th>
                    <th className="px-4 py-2.5 text-right font-medium text-muted-foreground">변경</th>
                  </tr>
                </thead>
                <tbody>
                  {rejectedStudents.map((s: any) => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <button className="font-medium text-primary hover:underline" onClick={() => setLocation(`/students/${s.id}`)}>
                          {s.clientName}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{s.phone || "-"}</td>
                      <td className="px-4 py-3">{s.course || "-"}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatCurrency(s.paymentAmount)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{userMap.get(s.assigneeId) || "-"}</td>
                      <td className="px-4 py-3 text-right">
                        <Button size="sm" variant="ghost" className="text-emerald-600 text-xs h-7"
                          onClick={() => approveMutation.mutate({ id: s.id, approvalStatus: "승인" })}>
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
