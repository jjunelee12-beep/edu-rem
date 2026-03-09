import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldAlert,
  Calculator,
  TrendingDown,
  Banknote,
  Download,
  Receipt,
} from "lucide-react";

export default function Settlement() {
  const { user } = useAuth();
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [filterAssignee, setFilterAssignee] = useState<string>("all");

  const isAdminOrHost =
    user?.role === "admin" || user?.role === "host";

  const { data: allUsers } = trpc.users.list.useQuery(undefined, {
    enabled: isAdminOrHost,
  });

  const { data: report, isLoading } = trpc.settlement.report.useQuery(
    {
      year,
      month,
      assigneeId: filterAssignee !== "all" ? Number(filterAssignee) : undefined,
    },
    {
      enabled: isAdminOrHost,
    }
  );

  const years = useMemo(() => {
    const arr = [];
    for (let y = 2024; y <= now.getFullYear() + 1; y++) arr.push(y);
    return arr;
  }, [now]);

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => i + 1),
    []
  );

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

  const totalSales =
    report?.reduce((sum: number, r: any) => sum + Number(r.totalSales || 0), 0) ?? 0;

  const totalRefunds =
    report?.reduce((sum: number, r: any) => sum + Number(r.totalRefunds || 0), 0) ?? 0;

  const totalCommission =
    report?.reduce((sum: number, r: any) => sum + Number(r.commission || 0), 0) ?? 0;

  const totalTax =
    report?.reduce((sum: number, r: any) => sum + Number(r.tax || 0), 0) ?? 0;

  const totalPayout =
    report?.reduce((sum: number, r: any) => sum + Number(r.finalPayout || 0), 0) ?? 0;

  const downloadCSV = () => {
    if (!report || report.length === 0) return;

    const headers = [
      "담당자",
      "결제완료 매출",
      "환불 차감",
      "순매출",
      "수수료(50%)",
      "세금(3.3%)",
      "최종 지급액",
    ];

    const rows = report.map((r: any) => [
      r.assigneeName,
      r.totalSales,
      r.totalRefunds,
      r.netSales,
      r.commission,
      r.tax,
      r.finalPayout,
    ]);

    rows.push([
      "합계",
      totalSales,
      totalRefunds,
      totalSales - totalRefunds,
      totalCommission,
      totalTax,
      totalPayout,
    ]);

    const csvContent =
      "\uFEFF" +
      [headers.join(","), ...rows.map((r: any) => r.join(","))].join("\n");

    const blob = new Blob([csvContent], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `정산리포트_${year}년${month}월.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">월별 정산 리포트</h1>
          <p className="text-muted-foreground mt-1">
            담당자별 결제완료 매출 집계 · 수수료 50% · 3.3% 세금 공제
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={downloadCSV}
          disabled={!report || report.length === 0}
          className="gap-1.5"
        >
          <Download className="h-4 w-4" />
          CSV 다운로드
        </Button>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-[120px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}년
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={String(m)}>
                {m}월
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="전체 담당자" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 담당자</SelectItem>
            {allUsers?.map((u: any) => (
              <SelectItem key={u.id} value={String(u.id)}>
                {u.name || "이름없음"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 요약 카드 */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              총 매출
            </CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSales.toLocaleString()}원</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              총 환불
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              -{totalRefunds.toLocaleString()}원
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              수수료 (50%)
            </CardTitle>
            <Banknote className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {totalCommission.toLocaleString()}원
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              세금 (3.3%)
            </CardTitle>
            <Receipt className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-600">
              -{totalTax.toLocaleString()}원
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              최종 지급액
            </CardTitle>
            <Banknote className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {totalPayout.toLocaleString()}원
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 상세 테이블 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {year}년 {month}월 담당자별 정산
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    담당자
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    결제완료 매출
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    환불 차감
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    순매출
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    수수료 (50%)
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    세금 (3.3%)
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    최종 지급액
                  </th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      불러오는 중...
                    </td>
                  </tr>
                ) : !report || report.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      해당 월에 정산 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  <>
                    {report.map((r: any) => (
                      <tr
                        key={r.assigneeId}
                        className="border-b last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-4 py-3 font-medium">{r.assigneeName}</td>
                        <td className="px-4 py-3 text-right">
                          {Number(r.totalSales || 0).toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-right text-destructive">
                          {Number(r.totalRefunds || 0) > 0
                            ? `-${Number(r.totalRefunds).toLocaleString()}원`
                            : "0원"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {Number(r.netSales || 0).toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-right text-blue-600">
                          {Number(r.commission || 0).toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-right text-amber-600">
                          -{Number(r.tax || 0).toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">
                          {Number(r.finalPayout || 0).toLocaleString()}원
                        </td>
                      </tr>
                    ))}

                    <tr className="bg-muted/50 font-bold">
                      <td className="px-4 py-3">합계</td>
                      <td className="px-4 py-3 text-right">
                        {totalSales.toLocaleString()}원
                      </td>
                      <td className="px-4 py-3 text-right text-destructive">
                        {totalRefunds > 0
                          ? `-${totalRefunds.toLocaleString()}원`
                          : "0원"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {(totalSales - totalRefunds).toLocaleString()}원
                      </td>
                      <td className="px-4 py-3 text-right text-blue-600">
                        {totalCommission.toLocaleString()}원
                      </td>
                      <td className="px-4 py-3 text-right text-amber-600">
                        -{totalTax.toLocaleString()}원
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600">
                        {totalPayout.toLocaleString()}원
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        * 정산 기준: 결제 완료 건 (승인된 건만 포함) · 수수료: 순매출의 50% · 세금: 수수료의 3.3% 공제 · 환불 발생 시 해당 월 정산에서 차감
      </p>
    </div>
  );
}