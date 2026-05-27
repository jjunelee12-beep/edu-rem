import { useMemo } from "react";
import { useRoute } from "wouter";
import { CreditCard } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function BillingRegisterPage() {
  const [, params] = useRoute("/billing/register/:token");
  const token = String(params?.token || "");

  const tokenQuery = trpc.saas.getBillingToken.useQuery(
    { token },
    {
      enabled: Boolean(token),
    }
  );

  const organization = tokenQuery.data?.organization;

  const displayAmount = useMemo(() => {
    const amount =
      Number(organization?.nextBillingAmount || 0) ||
      Number(organization?.billingAmount || 0);

    return amount.toLocaleString();
  }, [organization]);

  if (!token) {
    return <div className="p-6">잘못된 카드등록 링크입니다.</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-lg rounded-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            카드 등록
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {tokenQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">
              카드등록 정보를 확인하는 중입니다...
            </p>
          ) : tokenQuery.isError ? (
            <p className="text-sm text-red-600">
              유효하지 않거나 만료된 카드등록 링크입니다.
            </p>
          ) : (
            <>
              <div className="rounded-xl border bg-white p-4 text-sm">
                <p className="text-muted-foreground">회사명</p>
                <p className="mt-1 font-semibold">{organization?.name || "-"}</p>

                <p className="mt-4 text-muted-foreground">플랜</p>
                <p className="mt-1 font-semibold">
                  {organization?.customPlanName || organization?.planCode || "-"}
                </p>

                <p className="mt-4 text-muted-foreground">결제 예정 금액</p>
                <p className="mt-1 text-xl font-bold">{displayAmount}원</p>
              </div>

              <Button
                className="w-full"
                onClick={() => {
                  alert("다음 단계에서 Toss Billing 카드등록 창을 연결합니다.");
                }}
              >
                카드 등록하기
              </Button>

              <p className="text-xs text-muted-foreground">
                카드 등록 후 2주 체험 종료 시점부터 자동결제가 진행됩니다.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}