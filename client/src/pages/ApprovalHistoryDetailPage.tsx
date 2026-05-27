import { useMemo } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  try {
    return new Date(value).toLocaleString("ko-KR");
  } catch {
    return value;
  }
}

function formatMoney(value: any) {
  const num = Number(value || 0);

  if (!Number.isFinite(num)) return "0원";

  return `${num.toLocaleString()}원`;
}

export default function ApprovalHistoryDetailPage() {
  const params = useParams<{
    organizationSlug: string;
    type: "semester" | "refund";
    id: string;
  }>();

  const type = String(params.type || "");
  const id = Number(params.id || 0);

  const { data, isLoading } =
    trpc.approvalHistory.detail.useQuery(
      {
        type: type as any,
        id,
      },
      {
        enabled:
          (type === "semester" || type === "refund") &&
          Number.isFinite(id) &&
          id > 0,
      }
    );

  const approvalStatus = String(
    (data as any)?.approvalStatus || ""
  ).trim();

  const isRejected =
    approvalStatus === "불승인" ||
    approvalStatus === "반려";

  const title = useMemo(() => {
    if (type === "refund") {
      return "환불 승인 상세";
    }

    return "학기 승인 상세";
  }, [type]);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">
          불러오는 중...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-6">
        <div className="text-sm text-red-500">
          승인 정보를 찾을 수 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {title}
        </h1>

        <div className="mt-2">
          <Badge
            variant={
              isRejected
                ? "destructive"
                : "default"
            }
          >
            {approvalStatus || "-"}
          </Badge>
        </div>
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">
                학생명
              </div>

              <div className="font-medium">
                {(data as any)?.clientName || "-"}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">
                과정
              </div>

              <div className="font-medium">
                {(data as any)?.course || "-"}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">
                담당자
              </div>

              <div className="font-medium">
                {(data as any)?.assigneeName || "-"}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">
                연락처
              </div>

              <div className="font-medium">
                {(data as any)?.phone || "-"}
              </div>
            </div>

            {type === "semester" ? (
              <>
                <div>
                  <div className="text-xs text-muted-foreground">
                    학기
                  </div>

                  <div className="font-medium">
                    {(data as any)?.semesterLabel ||
                      (data as any)?.semesterOrder ||
                      "-"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">
                    교육원
                  </div>

                  <div className="font-medium">
                    {(data as any)?.actualInstitution ||
                      "-"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">
                    결제 금액
                  </div>

                  <div className="font-medium">
                    {formatMoney(
                      (data as any)?.actualAmount
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <div className="text-xs text-muted-foreground">
                    환불 금액
                  </div>

                  <div className="font-medium">
                    {formatMoney(
                      (data as any)?.refundAmount
                    )}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">
                    환불 사유
                  </div>

                  <div className="font-medium whitespace-pre-wrap">
                    {(data as any)?.reason || "-"}
                  </div>
                </div>

                <div>
                  <div className="text-xs text-muted-foreground">
                    학기
                  </div>

                  <div className="font-medium">
                    {(data as any)?.semesterLabel ||
                      (data as any)?.semesterOrder ||
                      "-"}
                  </div>
                </div>
              </>
            )}

            <div>
              <div className="text-xs text-muted-foreground">
                승인일시
              </div>

              <div className="font-medium">
                {formatDateTime(
                  (data as any)?.approvedAt
                )}
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">
                반려일시
              </div>

              <div className="font-medium">
                {formatDateTime(
                  (data as any)?.rejectedAt
                )}
              </div>
            </div>
          </div>

          {isRejected && (
            <div className="border rounded-lg p-4 bg-red-50 space-y-2">
              <div className="text-sm font-semibold text-red-600">
                반려 사유
              </div>

              <div className="whitespace-pre-wrap text-sm">
                {(data as any)?.rejectionReason ||
                  "반려 사유 없음"}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}