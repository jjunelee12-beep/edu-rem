import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, PhoneCall, UserPlus, Banknote, TrendingUp, CheckCircle, XCircle, Clock3, RotateCcw, BarChart3 } from "lucide-react";
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
  const toneClassMap: Record<string, string> = {
    default: "from-slate-50 to-white",
    indigo: "from-indigo-50 to-white",
    emerald: "from-emerald-50 to-white",
    amber: "from-amber-50 to-white",
    rose: "from-rose-50 to-white",
    violet: "from-violet-50 to-white",
    red: "from-red-50 to-white",
    blue: "from-blue-50 to-white",
    gray: "from-gray-50 to-white",
  };

  return (
    <Card className={`border-0 shadow-sm bg-gradient-to-br ${toneClassMap[tone] || toneClassMap.default}`}>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1 break-words">{value}</p>
            {subValue ? <p className="text-xs text-muted-foreground mt-1">{subValue}</p> : null}
          </div>
          <div className="h-10 w-10 rounded-lg bg-white/70 border flex items-center justify-center shrink-0">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Home() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: stats, isLoading: statsLoading } = trpc.dashboard.stats.useQuery();
  const { data: totalStats, isLoading: totalStatsLoading } = trpc.dashboard.totalStats.useQuery(
    undefined,
    {
      enabled: user?.role === "admin" || user?.role === "host",
    }
  );

  const isAdminOrHost = user?.role === "admin" || user?.role === "host";
  const now = new Date();
  const monthLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;

  const currentStats = stats || {};
  const overallStats = totalStats || {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">대시보드</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {user?.name}님, 안녕하세요. {monthLabel} 현황입니다.
        </p>
      </div>

      {statsLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* 이번달 핵심 통계 */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              <h2 className="text-base font-semibold">이번 달 핵심 지표</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8 gap-4">
              <StatCard
                title="이번 달 상담"
                value={`${currentStats.monthConsultationCount ?? 0}건`}
                icon={<PhoneCall className="h-5 w-5 text-indigo-600" />}
                tone="indigo"
              />

              <StatCard
                title="신규 등록"
                value={`${currentStats.monthRegistered ?? 0}건`}
                subValue="관리자 승인 기준"
                icon={<UserPlus className="h-5 w-5 text-emerald-600" />}
                tone="emerald"
              />

              <StatCard
                title="오늘 매출"
                value={formatCurrency(Number(currentStats.todaySales ?? 0))}
                subValue="환불 차감 전/후 기준 확인 필요"
                icon={<Banknote className="h-5 w-5 text-amber-600" />}
                tone="amber"
              />

              <StatCard
                title="이번 달 매출"
                value={formatCurrency(Number(currentStats.monthSales ?? 0))}
                subValue="승인 환불 차감 반영"
                icon={<TrendingUp className="h-5 w-5 text-rose-600" />}
                tone="rose"
              />

              <StatCard
                title="이번 달 환불"
                value={formatCurrency(Number(currentStats.monthRefund ?? 0))}
                subValue="승인된 환불 기준"
                icon={<RotateCcw className="h-5 w-5 text-red-600" />}
                tone="red"
              />

              <StatCard
                title="이번 달 승인"
                value={`${currentStats.monthApprovedCount ?? 0}건`}
                icon={<CheckCircle className="h-5 w-5 text-violet-600" />}
                tone="violet"
              />

              <StatCard
                title="이번 달 불승인"
                value={`${currentStats.monthRejectedCount ?? 0}건`}
                icon={<XCircle className="h-5 w-5 text-red-600" />}
                tone="red"
              />

              <StatCard
                title="이번 달 대기"
                value={`${currentStats.monthPendingCount ?? 0}건`}
                icon={<Clock3 className="h-5 w-5 text-slate-600" />}
                tone="gray"
              />
            </div>
          </div>

          {/* 이번달 승인/불승인/대기 요약 */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
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

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
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

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
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

      {/* 토탈 통계 */}
      {isAdminOrHost && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="text-base font-semibold">누적 통계</h2>
          </div>

          {totalStatsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7 gap-4">
              <StatCard
                title="토탈 상담"
                value={`${overallStats.totalConsultationCount ?? 0}건`}
                icon={<PhoneCall className="h-5 w-5 text-indigo-600" />}
                tone="indigo"
              />

              <StatCard
                title="토탈 등록"
                value={`${overallStats.totalRegisteredCount ?? 0}건`}
                icon={<UserPlus className="h-5 w-5 text-emerald-600" />}
                tone="emerald"
              />

              <StatCard
                title="토탈 매출"
                value={formatCurrency(Number(overallStats.totalSales ?? 0))}
                icon={<TrendingUp className="h-5 w-5 text-rose-600" />}
                tone="rose"
              />

              <StatCard
                title="토탈 환불"
                value={formatCurrency(Number(overallStats.totalRefund ?? 0))}
                icon={<RotateCcw className="h-5 w-5 text-red-600" />}
                tone="red"
              />

              <StatCard
                title="토탈 승인"
                value={`${overallStats.totalApprovedCount ?? 0}건`}
                icon={<CheckCircle className="h-5 w-5 text-violet-600" />}
                tone="violet"
              />

              <StatCard
                title="토탈 불승인"
                value={`${overallStats.totalRejectedCount ?? 0}건`}
                icon={<XCircle className="h-5 w-5 text-red-600" />}
                tone="red"
              />

              <StatCard
                title="토탈 대기"
                value={`${overallStats.totalPendingCount ?? 0}건`}
                icon={<Clock3 className="h-5 w-5 text-slate-600" />}
                tone="gray"
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}