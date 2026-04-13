import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";
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
  const [, navigate] = useLocation();
  const now = new Date();

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [detailTypeFilter, setDetailTypeFilter] = useState<string>("all");
  const [selectedPayslipAssigneeId, setSelectedPayslipAssigneeId] = useState<number | null>(null);
  const [payslipOpen, setPayslipOpen] = useState(false);

  const isAdminOrHost =
    user?.role === "admin" ||
    user?.role === "host" ||
    user?.role === "superhost";

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

  const { data: detailData, isLoading: isDetailLoading } =
    trpc.settlement.entries.useQuery(
      {
        year,
        month,
        assigneeId: filterAssignee !== "all" ? Number(filterAssignee) : undefined,
      },
      {
        enabled: isAdminOrHost,
      }
    );  

  const {
    data: payslipData,
    isLoading: isPayslipLoading,
  } = trpc.settlement.payslip.useQuery(
    {
      year,
      month,
      assigneeId: selectedPayslipAssigneeId || 0,
    },
    {
      enabled: isAdminOrHost && !!selectedPayslipAssigneeId && payslipOpen,
    }
  );

  const downloadPayslipExcelMutation =
    trpc.settlement.downloadPayslipExcel.useMutation({
      onError: (err) => {
        toast.error(err.message || "엑셀 다운로드 중 오류가 발생했습니다.");
      },
    });


  const years = useMemo(() => {
    const arr = [];
    for (let y = 2024; y <= now.getFullYear() + 1; y++) arr.push(y);
    return arr;
  }, [now]);

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => i + 1),
    []
  );

  const totalSales =
    report?.reduce(
      (sum: number, r: any) => sum + Number(r.totalGrossSales || 0),
      0
    ) ?? 0;

  const totalRefunds =
    report?.reduce(
      (sum: number, r: any) => sum + Number(r.totalRefundGross || 0),
      0
    ) ?? 0;

  const totalFreelancerAmount =
    report?.reduce(
      (sum: number, r: any) => sum + Number(r.netFreelancerAmount || 0),
      0
    ) ?? 0;

  const totalTax =
    report?.reduce(
      (sum: number, r: any) => sum + Number(r.netTaxAmount || 0),
      0
    ) ?? 0;

  const totalPayout =
    report?.reduce(
      (sum: number, r: any) => sum + Number(r.netFinalPayoutAmount || 0),
      0
    ) ?? 0;

  const totalCompanyProfit =
    report?.reduce(
      (sum: number, r: any) => sum + Number(r.netCompanyProfit || 0),
      0
    ) ?? 0;

  const getRevenueTypeLabel = (type: string, status?: string) => {
    if (status === "refunded") return "환불";
    if (type === "subject") return "일반과목";
    if (type === "private_certificate") return "민간자격증";
    if (type === "practice_support") return "실습배정";
    return type || "-";
  };

  const openSourceDetail = (row: any) => {
    const studentId = Number(row?.studentId || 0);
    if (!studentId) return;

    const isRefund = row?.settlementStatus === "refunded";

    if (isRefund) {
      navigate(`/students/${studentId}?tab=refund`);
      return;
    }

    if (row?.revenueType === "private_certificate") {
      navigate(`/students/${studentId}?tab=private-certificate`);
      return;
    }

    if (row?.revenueType === "practice_support") {
      navigate(`/students/${studentId}?tab=practice-support`);
      return;
    }

    navigate(`/students/${studentId}?tab=semester`);
  };

  const filteredDetailEntries = useMemo(() => {
    const entries = detailData?.entries || [];

    if (detailTypeFilter === "all") return entries;

    if (detailTypeFilter === "refund") {
      return entries.filter((row: any) => row.settlementStatus === "refunded");
    }

    return entries.filter((row: any) => row.revenueType === detailTypeFilter);
  }, [detailData, detailTypeFilter]);

  const filteredDetailSummary = useMemo(() => {
    return {
      totalGrossAmount: filteredDetailEntries.reduce(
        (sum: number, row: any) => sum + Number(row.grossAmount || 0),
        0
      ),
      totalFreelancerAmount: filteredDetailEntries.reduce(
        (sum: number, row: any) => sum + Number(row.freelancerAmount || 0),
        0
      ),
      totalTaxAmount: filteredDetailEntries.reduce(
        (sum: number, row: any) => sum + Number(row.taxAmount || 0),
        0
      ),
      totalFinalPayoutAmount: filteredDetailEntries.reduce(
        (sum: number, row: any) => sum + Number(row.finalPayoutAmount || 0),
        0
      ),
      totalCompanyProfit: filteredDetailEntries.reduce(
        (sum: number, row: any) => sum + Number(row.companyProfit || 0),
        0
      ),
    };
  }, [filteredDetailEntries]);

  const downloadCSV = () => {
    if (!report || report.length === 0) return;

    const headers = [
      "담당자",
      "총매출",
      "환불",
      "순매출",
      "프리랜서 지급액",
      "세금",
      "최종 지급액",
      "회사 순이익",
    ];

    const rows = report.map((r: any) => [
      r.assigneeName,
      r.totalGrossSales,
      r.totalRefundGross,
      r.netSales,
      r.netFreelancerAmount,
      r.netTaxAmount,
      r.netFinalPayoutAmount,
      r.netCompanyProfit,
    ]);

    rows.push([
      "합계",
      totalSales,
      totalRefunds,
      totalSales - totalRefunds,
      totalFreelancerAmount,
      totalTax,
      totalPayout,
      totalCompanyProfit,
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

  const downloadDetailCSV = () => {
    if (!filteredDetailEntries || filteredDetailEntries.length === 0) return;

    const headers = [
      "일자",
      "유형",
      "담당자",
      "학생명",
      "제목",
      "총매출",
      "프리랜서 지급액",
      "세금",
      "최종 지급액",
      "회사 순이익",
      "상태",
      "비고",
    ];

    const rows = filteredDetailEntries.map((row: any) => [
      row.occurredAt
        ? new Date(row.occurredAt).toLocaleDateString("ko-KR")
        : "",
      getRevenueTypeLabel(row.revenueType, row.settlementStatus),
      row.assigneeName || "",
      row.clientName || "",
      row.title || "",
      row.grossAmount || 0,
      row.freelancerAmount || 0,
      row.taxAmount || 0,
      row.finalPayoutAmount || 0,
      row.companyProfit || 0,
      row.settlementStatus || "",
      row.note || "",
    ]);

    rows.push([
      "합계",
      "",
      "",
      "",
      "",
      filteredDetailSummary.totalGrossAmount,
      filteredDetailSummary.totalFreelancerAmount,
      filteredDetailSummary.totalTaxAmount,
      filteredDetailSummary.totalFinalPayoutAmount,
      filteredDetailSummary.totalCompanyProfit,
      "",
      "",
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
    a.download = `정산상세원장_${year}년${month}월_${detailTypeFilter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadPayslipExcel = async (assigneeId?: number) => {
    const targetAssigneeId =
      Number(assigneeId || selectedPayslipAssigneeId || 0);

    if (!targetAssigneeId) {
      toast.error("담당자 정보가 없습니다.");
      return;
    }

    try {
      const result = await downloadPayslipExcelMutation.mutateAsync({
        year,
        month,
        assigneeId: targetAssigneeId,
      });

      if (!result?.base64 || !result?.fileName) {
        toast.error("엑셀 파일 생성 결과가 올바르지 않습니다.");
        return;
      }

      const byteCharacters = atob(result.base64);
      const byteNumbers = new Array(byteCharacters.length);

      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.fileName;
      a.click();
      URL.revokeObjectURL(url);

      toast.success("정산 명세서 엑셀 다운로드가 완료되었습니다.");
    } catch (error) {
      console.error("[handleDownloadPayslipExcel]", error);
    }
  };

  if (!isAdminOrHost) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <ShieldAlert className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">
          관리자, 호스트 또는 슈퍼호스트만 접근할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">월별 정산 리포트</h1>
          <p className="text-muted-foreground mt-1">
  담당자별 총매출 · 환불 · 프리랜서 지급액 · 세금 · 최종 지급액 · 회사 순이익을 집계합니다.
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

      <div className="grid gap-4 md:grid-cols-6">
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
              프리랜서 지급액
            </CardTitle>
            <Banknote className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {totalFreelancerAmount.toLocaleString()}원
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

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
  회사 순이익
</CardTitle>
            <Banknote className="h-4 w-4 text-violet-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-violet-600">
              {totalCompanyProfit.toLocaleString()}원
            </div>
          </CardContent>
        </Card>
      </div>

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
                    총매출
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    환불 차감
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    순매출
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    프리랜서 지급액
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    세금
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    최종 지급액
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    회사 순이익
                  </th>
<th className="px-4 py-3 text-center font-medium text-muted-foreground">
  명세서
</th>
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      불러오는 중...
                    </td>
                  </tr>
                ) : !report || report.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
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
                          {Number(r.totalGrossSales || 0).toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-right text-destructive">
                          {Number(r.totalRefundGross || 0) > 0
                            ? `-${Number(r.totalRefundGross).toLocaleString()}원`
                            : "0원"}
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {Number(r.netSales || 0).toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-right text-blue-600">
                          {Number(r.netFreelancerAmount || 0).toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-right text-amber-600">
                          -{Number(r.netTaxAmount || 0).toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">
                          {Number(r.netFinalPayoutAmount || 0).toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-violet-600">
                          {Number(r.netCompanyProfit || 0).toLocaleString()}원
                        </td>
<td className="px-4 py-3 text-center">
  <div className="flex flex-col items-center gap-2">
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        if (!r.assigneeId) {
          toast.error("담당자 정보가 없습니다.");
          return;
        }
        setSelectedPayslipAssigneeId(Number(r.assigneeId));
        setPayslipOpen(true);
      }}
    >
      명세서 보기
    </Button>

    <Button
      variant="default"
      size="sm"
      onClick={() => handleDownloadPayslipExcel(Number(r.assigneeId))}
      disabled={downloadPayslipExcelMutation.isPending}
    >
      엑셀 다운로드
    </Button>
  </div>
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
                        {totalFreelancerAmount.toLocaleString()}원
                      </td>
                      <td className="px-4 py-3 text-right text-amber-600">
                        -{totalTax.toLocaleString()}원
                      </td>
                      <td className="px-4 py-3 text-right text-emerald-600">
                        {totalPayout.toLocaleString()}원
                      </td>
                      <td className="px-4 py-3 text-right text-violet-600">
                        {totalCompanyProfit.toLocaleString()}원
                      </td>
<td className="px-4 py-3"></td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {payslipOpen && selectedPayslipAssigneeId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
  <CardTitle className="text-base">
    {year}년 {month}월 담당자 정산 명세서
  </CardTitle>

  <div className="flex items-center gap-2">
    <Button
      variant="default"
      size="sm"
      onClick={() => handleDownloadPayslipExcel()}
      disabled={
        downloadPayslipExcelMutation.isPending || !selectedPayslipAssigneeId
      }
      className="gap-1.5"
    >
      <Download className="h-4 w-4" />
      엑셀 다운로드
    </Button>

    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        setPayslipOpen(false);
        setSelectedPayslipAssigneeId(null);
      }}
    >
      닫기
    </Button>
  </div>
</CardHeader>

          <CardContent>
            {isPayslipLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                명세서 불러오는 중...
              </div>
            ) : !payslipData ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                명세서 데이터가 없습니다.
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-xl border p-4">
                  <div className="text-lg font-bold">수당 명세서</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {payslipData.year}년 {payslipData.month}월
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-4 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">성명</div>
                      <div className="font-medium">{payslipData.assigneeName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">직급</div>
                      <div className="font-medium">{payslipData.positionName || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">소속</div>
                      <div className="font-medium">{payslipData.teamName || "-"}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">부서</div>
                      <div className="font-medium">-</div>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">지급액 합계</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xl font-bold">
                      {Number(
                        payslipData.summary?.totalGrossAmount || 0
                      ).toLocaleString()}원
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">공제합계</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xl font-bold text-destructive">
                      {Number(
                        payslipData.summary?.totalDeductionAmount || 0
                      ).toLocaleString()}원
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">수령액</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xl font-bold">
                      {Number(
                        payslipData.summary?.totalReceivableAmount || 0
                      ).toLocaleString()}원
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">세후 실수령액</CardTitle>
                    </CardHeader>
                    <CardContent className="text-xl font-bold text-emerald-600">
                      {Number(
                        payslipData.summary?.totalNetPayoutAmount || 0
                      ).toLocaleString()}원
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">지급 항목</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>교육훈련비</span>
                        <span>
                          {Number(
                            payslipData.paymentItems?.educationSupportAmount || 0
                          ).toLocaleString()}원
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>학점수당</span>
                        <span>
                          {Number(
                            payslipData.paymentItems?.subjectAllowanceAmount || 0
                          ).toLocaleString()}원
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>민간수당</span>
                        <span>
                          {Number(
                            payslipData.paymentItems?.privateCertificateAllowanceAmount || 0
                          ).toLocaleString()}원
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>실습수당</span>
                        <span>
                          {Number(
                            payslipData.paymentItems?.practiceSupportAllowanceAmount || 0
                          ).toLocaleString()}원
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">공제 항목</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span>환불공제</span>
                        <span>
                          {Number(
                            payslipData.deductionItems?.refundDeductionAmount || 0
                          ).toLocaleString()}원
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>적립금(학점)</span>
                        <span>
                          {Number(
                            payslipData.deductionItems?.taxDeductionAmount || 0
                          ).toLocaleString()}원
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>협약비</span>
                        <span>
                          {Number(
                            payslipData.deductionItems?.contractDeductionAmount || 0
                          ).toLocaleString()}원
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">상세 지급 내역</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="px-4 py-3 text-left">일자</th>
                            <th className="px-4 py-3 text-left">유형</th>
                            <th className="px-4 py-3 text-left">학생명</th>
                            <th className="px-4 py-3 text-left">제목</th>
                            <th className="px-4 py-3 text-right">총매출</th>
                            <th className="px-4 py-3 text-right">지급액</th>
                            <th className="px-4 py-3 text-right">세금</th>
                            <th className="px-4 py-3 text-right">실지급액</th>
                            <th className="px-4 py-3 text-center">상태</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payslipData.entries?.length ? (
                            payslipData.entries.map((row: any) => (
                              <tr key={row.id} className="border-b last:border-0">
                                <td className="px-4 py-3">
                                  {row.occurredAt
                                    ? new Date(row.occurredAt).toLocaleDateString("ko-KR")
                                    : "-"}
                                </td>
                                <td className="px-4 py-3">
                                  {getRevenueTypeLabel(
                                    row.revenueType,
                                    row.settlementStatus
                                  )}
                                </td>
                                <td className="px-4 py-3">{row.clientName || "-"}</td>
                                <td className="px-4 py-3">
                                  <div className="max-w-[260px] truncate">
                                    {row.title || "-"}
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {Number(row.grossAmount || 0).toLocaleString()}원
                                </td>
                                <td className="px-4 py-3 text-right text-blue-600">
                                  {Number(row.freelancerAmount || 0).toLocaleString()}원
                                </td>
                                <td className="px-4 py-3 text-right text-amber-600">
                                  -{Number(row.taxAmount || 0).toLocaleString()}원
                                </td>
                                <td className="px-4 py-3 text-right text-emerald-600">
                                  {Number(row.finalPayoutAmount || 0).toLocaleString()}원
                                </td>
                                <td className="px-4 py-3 text-center">
                                  {row.settlementStatus || "-"}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={9}
                                className="px-4 py-10 text-center text-muted-foreground"
                              >
                                상세 지급 내역이 없습니다.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {year}년 {month}월 정산 상세 원장
          </CardTitle>

          <div className="flex items-center gap-2">
            <Select value={detailTypeFilter} onValueChange={setDetailTypeFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="전체 유형" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 유형</SelectItem>
                <SelectItem value="subject">일반과목</SelectItem>
                <SelectItem value="private_certificate">민간자격증</SelectItem>
                <SelectItem value="practice_support">실습배정</SelectItem>
                <SelectItem value="refund">환불</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={downloadDetailCSV}
              disabled={!filteredDetailEntries || filteredDetailEntries.length === 0}
              className="gap-1.5"
            >
              <Download className="h-4 w-4" />
              상세 CSV
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    일자
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    유형
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    담당자
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    학생명
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    제목
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    총매출
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    프리랜서 지급액
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    세금
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    최종 지급액
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    회사 순이익
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">
                    원본
                  </th>
                </tr>
              </thead>

              <tbody>
                {isDetailLoading ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      상세 원장 불러오는 중...
                    </td>
                  </tr>
                ) : !filteredDetailEntries || filteredDetailEntries.length === 0 ? (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-4 py-12 text-center text-muted-foreground"
                    >
                      해당 조건의 상세 원장 데이터가 없습니다.
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredDetailEntries.map((row: any) => (
                      <tr
                        key={row.id}
                        onClick={() => openSourceDetail(row)}
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          {row.occurredAt
                            ? new Date(row.occurredAt).toLocaleDateString("ko-KR")
                            : "-"}
                        </td>
                        <td className="px-4 py-3">
                          {getRevenueTypeLabel(row.revenueType, row.settlementStatus)}
                        </td>
                        <td className="px-4 py-3">{row.assigneeName || "-"}</td>
                        <td className="px-4 py-3 font-medium text-blue-600">
                          {row.clientName || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="max-w-[280px] truncate" title={row.title || "-"}>
                            {row.title || "-"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {Number(row.grossAmount || 0).toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-right text-blue-600">
                          {Number(row.freelancerAmount || 0).toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-right text-amber-600">
                          -{Number(row.taxAmount || 0).toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-right text-emerald-600">
                          {Number(row.finalPayoutAmount || 0).toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-right text-violet-600">
                          {Number(row.companyProfit || 0).toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              openSourceDetail(row);
                            }}
                          >
                            원본 보기
                          </Button>
                        </td>
                      </tr>
                    ))}

                    <tr className="bg-muted/50 font-bold">
                      <td colSpan={5} className="px-4 py-3 text-right">
                        합계
                      </td>

                      <td className="px-4 py-3 text-right">
                        {filteredDetailSummary.totalGrossAmount.toLocaleString()}원
                      </td>

                      <td className="px-4 py-3 text-right text-blue-600">
                        {filteredDetailSummary.totalFreelancerAmount.toLocaleString()}원
                      </td>

                      <td className="px-4 py-3 text-right text-amber-600">
                        -{filteredDetailSummary.totalTaxAmount.toLocaleString()}원
                      </td>

                      <td className="px-4 py-3 text-right text-emerald-600">
                        {filteredDetailSummary.totalFinalPayoutAmount.toLocaleString()}원
                      </td>

                      <td className="px-4 py-3 text-right text-violet-600">
                        {filteredDetailSummary.totalCompanyProfit.toLocaleString()}원
                      </td>

                      <td className="px-4 py-3"></td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
  * 정산 기준: 결제 완료 건 기준 · 일반과목은 총매출에서 교육원 정산 금액을 먼저 차감한 뒤 회사 매출을 계산하고, 그 회사 매출 안에서 프리랜서 지급액과 세금을 반영하여 회사 순이익을 계산합니다. 환불 발생 시 해당 월 정산에서 차감됩니다.
</p>
    </div>
  );
}