import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  PhoneCall,
  UserPlus,
  Banknote,
  TrendingUp,
  CheckCircle,
  XCircle,
  Clock3,
  RotateCcw,
  BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("ko-KR").format(amount || 0) + "원";
}

function StatCard({
  title,
  value,
  subValue,
  icon,
  tone = "default",
}: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ReactNode;
  tone?: "default" | "indigo" | "emerald" | "amber" | "rose" | "violet" | "red" | "blue" | "gray";
}) {
  return (
    <Card>
      <CardContent className="px-5 pb-4 pt-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="mt-1 break-words text-2xl font-bold">{value}</p>
            {subValue ? <p className="mt-1 text-xs text-muted-foreground">{subValue}</p> : null}
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-white">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function OverviewDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: totalStats, isLoading: totalStatsLoading } =
    trpc.dashboard.totalStats.useQuery(undefined, {
      enabled:
        user?.role === "admin" ||
        user?.role === "host" ||
        user?.role === "superhost",
    });

  const isAdminOrHost =
    user?.role === "admin" ||
    user?.role === "host" ||
    user?.role === "superhost";

  const now = new Date();
  const monthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;

  const currentStats = stats || {};
  const overallStats = totalStats || {};

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
  <div>
    <h1 className="text-2xl font-bold tracking-tight">운영 대시보드</h1>
    <p className="mt-1 text-sm text-muted-foreground">
      {user?.name}님, 안녕하세요. {monthLabel} 현황입니다.
    </p>
  </div>

  {isAdminOrHost ? (
    <Button variant="outline" size="sm" onClick={() => setLocation("/settlement")}>
      정산 리포트 이동
    </Button>
  ) : null}
</div>

      {statsLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">이번 달 핵심 지표</h2>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard title="이번 달 상담" value={`${currentStats.monthConsultationCount ?? 0}건`} icon={<PhoneCall className="h-5 w-5 text-indigo-600" />} />
              <StatCard title="신규 등록" value={`${currentStats.monthRegistered ?? 0}건`} subValue="관리자 승인 기준" icon={<UserPlus className="h-5 w-5 text-emerald-600" />} />
            <StatCard
  title="오늘 매출"
  value={formatCurrency(Number(currentStats.todaySales ?? 0))}
  subValue="정산 원장 기준"
  icon={<Banknote className="h-5 w-5 text-amber-600" />}
/>

<StatCard
  title="이번 달 매출"
  value={formatCurrency(Number(currentStats.monthSales ?? 0))}
  subValue="정산 원장 · 승인 환불 반영"
  icon={<TrendingUp className="h-5 w-5 text-rose-600" />}
/>

<StatCard
  title="이번 달 환불"
  value={formatCurrency(Number(currentStats.monthRefund ?? 0))}
  subValue="정산 원장 환불 기준"
  icon={<RotateCcw className="h-5 w-5 text-red-600" />}
/>
              <StatCard title="이번 달 승인" value={`${currentStats.monthApprovedCount ?? 0}건`} icon={<CheckCircle className="h-5 w-5 text-violet-600" />} />
              <StatCard title="이번 달 불승인" value={`${currentStats.monthRejectedCount ?? 0}건`} icon={<XCircle className="h-5 w-5 text-red-600" />} />
              <StatCard title="이번 달 대기" value={`${currentStats.monthPendingCount ?? 0}건`} icon={<Clock3 className="h-5 w-5 text-slate-600" />} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  이번 달 승인 요약
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-3xl font-bold text-emerald-600">
                  {currentStats.monthApprovedCount ?? 0}건
                </div>
                <p className="text-sm text-muted-foreground">
                  학생 승인 완료 건수입니다.
                </p>
                <Button variant="outline" size="sm" onClick={() => setLocation("/approvals")}>
                  승인 관리로 이동
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <XCircle className="h-4 w-4 text-red-500" />
                  이번 달 불승인 요약
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-3xl font-bold text-red-600">
                  {currentStats.monthRejectedCount ?? 0}건
                </div>
                <p className="text-sm text-muted-foreground">
                  학생 불승인 처리 건수입니다.
                </p>
                <Button variant="outline" size="sm" onClick={() => setLocation("/approvals")}>
                  승인 관리로 이동
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Clock3 className="h-4 w-4 text-amber-500" />
                  이번 달 대기 요약
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-3xl font-bold text-amber-600">
                  {currentStats.monthPendingCount ?? 0}건
                </div>
                <p className="text-sm text-muted-foreground">
                  아직 승인/불승인 처리되지 않은 건수입니다.
                </p>
                <Button variant="outline" size="sm" onClick={() => setLocation("/approvals")}>
                  승인 관리로 이동
                </Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {isAdminOrHost && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">종합 통계</h2>
          </div>

          {totalStatsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard title="종합 상담" value={`${overallStats.totalConsultationCount ?? 0}건`} icon={<PhoneCall className="h-5 w-5 text-indigo-600" />} />
              <StatCard title="종합 등록" value={`${overallStats.totalRegisteredCount ?? 0}건`} icon={<UserPlus className="h-5 w-5 text-emerald-600" />} />
              <StatCard
  title="종합 매출"
  value={formatCurrency(Number(overallStats.totalSales ?? 0))}
  subValue="정산 원장 누적 기준"
  icon={<TrendingUp className="h-5 w-5 text-rose-600" />}
/>

<StatCard
  title="종합 환불"
  value={formatCurrency(Number(overallStats.totalRefund ?? 0))}
  subValue="정산 원장 누적 환불"
  icon={<RotateCcw className="h-5 w-5 text-red-600" />}
/>
              <StatCard title="종합 승인" value={`${overallStats.totalApprovedCount ?? 0}건`} icon={<CheckCircle className="h-5 w-5 text-violet-600" />} />
              <StatCard title="종합 불승인" value={`${overallStats.totalRejectedCount ?? 0}건`} icon={<XCircle className="h-5 w-5 text-red-600" />} />
              <StatCard title="종합 대기" value={`${overallStats.totalPendingCount ?? 0}건`} icon={<Clock3 className="h-5 w-5 text-slate-600" />} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}