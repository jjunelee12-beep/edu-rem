import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, PhoneCall, UserPlus, Banknote, TrendingUp, CheckCircle, XCircle } from "lucide-react";
import { useLocation } from "wouter";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount) + "원";
}

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: approvals, isLoading: approvalsLoading } = trpc.dashboard.monthApprovals.useQuery();
  const { data: usersList } = trpc.users.list.useQuery();

  const isAdmin = user?.role === "admin";
  const now = new Date();
  const monthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;

  const getUserName = (assigneeId: number) => {
    const u = usersList?.find((x: any) => x.id === assigneeId);
    return u?.name || "-";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {user?.name}님, 안녕하세요. {monthLabel} 현황입니다.
        </p>
      </div>

      {/* 통계 카드 5개 */}
      {statsLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-50 to-white">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">이번 달 상담</p>
                  <p className="text-2xl font-bold mt-1">{stats?.monthConsultations ?? 0}<span className="text-sm font-normal text-muted-foreground ml-1">건</span></p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <PhoneCall className="h-5 w-5 text-indigo-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-50 to-white">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">신규 등록 (결제완료)</p>
                  <p className="text-2xl font-bold mt-1">{stats?.monthNewRegistrations ?? 0}<span className="text-sm font-normal text-muted-foreground ml-1">건</span></p>
                  <p className="text-xs text-emerald-600 font-medium mt-0.5">{formatCurrency(stats?.monthNewRegistrationAmount ?? 0)}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <UserPlus className="h-5 w-5 text-emerald-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-amber-50 to-white">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">오늘 매출</p>
                  <p className="text-xl font-bold mt-1">{formatCurrency(stats?.todaySales ?? 0)}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Banknote className="h-5 w-5 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-rose-50 to-white">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">이번 달 매출</p>
                  <p className="text-xl font-bold mt-1">{formatCurrency(stats?.monthSales ?? 0)}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-rose-100 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-rose-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm bg-gradient-to-br from-violet-50 to-white">
            <CardContent className="pt-5 pb-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">이번 달 승인</p>
                  <p className="text-2xl font-bold mt-1">{approvals?.approved?.length ?? 0}<span className="text-sm font-normal text-muted-foreground ml-1">건</span></p>
                  <p className="text-xs text-violet-600 font-medium mt-0.5">{formatCurrency(approvals?.approvedTotal ?? 0)}</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center">
                  <CheckCircle className="h-5 w-5 text-violet-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 이번달 승인/불승인 내역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500" />
                이번 달 승인 내역
              </CardTitle>
              <div className="text-sm font-semibold text-emerald-600">
                {approvals?.approved?.length ?? 0}건 / {formatCurrency(approvals?.approvedTotal ?? 0)}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {approvalsLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : !approvals?.approved?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">이번 달 승인 내역이 없습니다.</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {approvals.approved.map((item: any) => (
                  <div key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-emerald-50/50 hover:bg-emerald-50 cursor-pointer transition-colors"
                    onClick={() => setLocation(`/students/${item.id}`)}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{item.clientName}</p>
                        <span className="text-xs text-muted-foreground">{item.phone}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.course}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-semibold text-emerald-700">
                        {item.paymentAmount ? formatCurrency(Number(item.paymentAmount)) : "-"}
                      </p>
                      {isAdmin && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">담당: {getUserName(item.assigneeId)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                이번 달 불승인 내역
              </CardTitle>
              <div className="text-sm font-semibold text-red-600">
                {approvals?.rejected?.length ?? 0}건 / {formatCurrency(approvals?.rejectedTotal ?? 0)}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {approvalsLoading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : !approvals?.rejected?.length ? (
              <p className="text-sm text-muted-foreground py-4 text-center">이번 달 불승인 내역이 없습니다.</p>
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {approvals.rejected.map((item: any) => (
                  <div key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-red-50/50 hover:bg-red-50 cursor-pointer transition-colors"
                    onClick={() => setLocation(`/students/${item.id}`)}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{item.clientName}</p>
                        <span className="text-xs text-muted-foreground">{item.phone}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.course}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-semibold text-red-600">
                        {item.paymentAmount ? formatCurrency(Number(item.paymentAmount)) : "-"}
                      </p>
                      {isAdmin && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">담당: {getUserName(item.assigneeId)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
