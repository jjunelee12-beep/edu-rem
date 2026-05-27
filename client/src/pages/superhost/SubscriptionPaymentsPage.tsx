import { useMemo, useState } from "react";
import { CreditCard, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import SaasAdminGuard from "@/components/saas/SaasAdminGuard";

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  pending: "대기",
  paid: "성공",
  failed: "실패",
  refunded: "환불",
};

export default function SubscriptionPaymentsPage() {
  const { user } = useAuth();
  const [keyword, setKeyword] = useState("");
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);

  const paymentsQuery = trpc.saas.listSubscriptionPayments.useQuery(undefined, {
    enabled: user?.role === "superhost",
  });

  const eventsQuery = trpc.saas.listSubscriptionPaymentEvents.useQuery(
    {
      paymentId: selectedPaymentId,
      organizationId: null,
    },
    {
      enabled: user?.role === "superhost" && Boolean(selectedPaymentId),
    }
  );

  const payments = paymentsQuery.data ?? [];
  const events = eventsQuery.data ?? [];

  const filteredPayments = useMemo(() => {
    const q = keyword.trim().toLowerCase();

    if (!q) return payments;

    return payments.filter((row: any) => {
      return (
        String(row.organizationId || "").includes(q) ||
        String(row.planCode || "").toLowerCase().includes(q) ||
        String(row.customPlanName || "").toLowerCase().includes(q) ||
        String(row.paymentStatus || "").toLowerCase().includes(q) ||
        String(row.tossOrderId || "").toLowerCase().includes(q) ||
        String(row.tossPaymentKey || "").toLowerCase().includes(q)
      );
    });
  }, [payments, keyword]);

  const summary = useMemo(() => {
    return payments.reduce(
      (acc: any, row: any) => {
        const amount = Number(row.billingAmount || 0);

        acc.totalCount += 1;

        if (row.paymentStatus === "paid") {
          acc.paidCount += 1;
          acc.paidAmount += amount;
        } else if (row.paymentStatus === "failed") {
          acc.failedCount += 1;
          acc.failedAmount += amount;
        } else if (row.paymentStatus === "pending") {
          acc.pendingCount += 1;
          acc.pendingAmount += amount;
        }

        return acc;
      },
      {
        totalCount: 0,
        paidCount: 0,
        paidAmount: 0,
        failedCount: 0,
        failedAmount: 0,
        pendingCount: 0,
        pendingAmount: 0,
      }
    );
  }, [payments]);

  if (user?.role !== "superhost") {
    return (
      <div className="p-6">
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive">접근 권한 없음</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            이 페이지는 superhost 전용입니다.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <SaasAdminGuard>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <CreditCard className="h-6 w-6 text-primary" />
              결제 정산
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              SaaS 구독 결제 원장, 성공/실패 내역, 이벤트 로그를 확인합니다.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => paymentsQuery.refetch()}
            disabled={paymentsQuery.isFetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                paymentsQuery.isFetching ? "animate-spin" : ""
              }`}
            />
            새로고침
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">전체 결제건</p>
              <p className="mt-1 text-2xl font-bold">{summary.totalCount}</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">성공 금액</p>
              <p className="mt-1 text-2xl font-bold">
                {summary.paidAmount.toLocaleString()}원
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary.paidCount}건
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">대기 금액</p>
              <p className="mt-1 text-2xl font-bold">
                {summary.pendingAmount.toLocaleString()}원
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary.pendingCount}건
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">실패 금액</p>
              <p className="mt-1 text-2xl font-bold">
                {summary.failedAmount.toLocaleString()}원
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {summary.failedCount}건
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <CardTitle>결제 원장</CardTitle>

            <Input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="회사ID, 플랜, 상태, Toss 키 검색"
              className="md:w-80"
            />
          </CardHeader>

          <CardContent>
            {paymentsQuery.isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                결제내역 불러오는 중...
              </div>
            ) : filteredPayments.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                결제내역이 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="px-3 py-3">ID</th>
                      <th className="px-3 py-3">회사ID</th>
                      <th className="px-3 py-3">플랜</th>
                      <th className="px-3 py-3">금액</th>
                      <th className="px-3 py-3">상태</th>
                      <th className="px-3 py-3">결제주기</th>
                      <th className="px-3 py-3">결제일</th>
                      <th className="px-3 py-3">실패일</th>
                      <th className="px-3 py-3">Toss</th>
                      <th className="px-3 py-3">관리</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredPayments.map((payment: any) => (
                      <tr key={payment.id} className="border-b">
                        <td className="px-3 py-3">{payment.id}</td>
                        <td className="px-3 py-3">{payment.organizationId}</td>
                        <td className="px-3 py-3">
                          <div className="space-y-1">
                            <Badge variant="outline">
                              {payment.planCode || "-"}
                            </Badge>
                            {payment.customPlanName && (
                              <div className="text-xs text-muted-foreground">
                                {payment.customPlanName}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 font-medium">
                          {Number(payment.billingAmount || 0).toLocaleString()}원
                        </td>
                        <td className="px-3 py-3">
                          <Badge
                            variant={
                              payment.paymentStatus === "paid"
                                ? "default"
                                : payment.paymentStatus === "failed"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {PAYMENT_STATUS_LABEL[payment.paymentStatus] ||
                              payment.paymentStatus}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          <div>
                            시작:{" "}
                            {payment.billingCycleStart
                              ? new Date(payment.billingCycleStart).toLocaleDateString()
                              : "-"}
                          </div>
                          <div>
                            종료:{" "}
                            {payment.billingCycleEnd
                              ? new Date(payment.billingCycleEnd).toLocaleDateString()
                              : "-"}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {payment.paidAt
                            ? new Date(payment.paidAt).toLocaleString()
                            : "-"}
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {payment.failedAt
                            ? new Date(payment.failedAt).toLocaleString()
                            : "-"}
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          <div>order: {payment.tossOrderId || "-"}</div>
                          <div>payment: {payment.tossPaymentKey || "-"}</div>
                        </td>
                        <td className="px-3 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedPaymentId(Number(payment.id))}
                          >
                            이벤트
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {selectedPaymentId && (
          <Card className="rounded-2xl">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>결제 이벤트 #{selectedPaymentId}</CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSelectedPaymentId(null)}
              >
                닫기
              </Button>
            </CardHeader>

            <CardContent className="space-y-3">
              {eventsQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">
                  이벤트 불러오는 중...
                </div>
              ) : events.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  이벤트가 없습니다.
                </div>
              ) : (
                events.map((event: any) => (
                  <div
                    key={event.id}
                    className="rounded-lg border bg-background p-3 text-sm"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-medium">{event.eventType}</div>
                      <div className="text-xs text-muted-foreground">
                        {event.createdAt
                          ? new Date(event.createdAt).toLocaleString()
                          : "-"}
                      </div>
                    </div>

                    {event.message && (
                      <div className="mt-2 text-sm text-muted-foreground">
                        {event.message}
                      </div>
                    )}

                    {event.rawJson && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-muted-foreground">
                          rawJson 보기
                        </summary>
                        <pre className="mt-2 max-h-80 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">
                          {event.rawJson}
                        </pre>
                      </details>
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </SaasAdminGuard>
  );
}