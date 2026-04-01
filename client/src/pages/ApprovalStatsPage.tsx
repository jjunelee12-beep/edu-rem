import { useMemo } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  BarChart3,
  RefreshCw,
  FileText,
  Clock3,
  CheckCircle2,
  XCircle,
} from "lucide-react";

type ApprovalDocStatus = "draft" | "pending" | "approved" | "rejected" | "cancelled";
type ApprovalFormType = "attendance" | "business_trip" | "general";

type ApprovalDocumentRow = {
  id: number;
  documentNumber: string;
  formType: ApprovalFormType;
  subType: string;
  title: string;
  reason?: string | null;
  targetDate?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status: ApprovalDocStatus;
  createdAt?: string | null;
  updatedAt?: string | null;
  finalApprovedAt?: string | null;
  rejectedAt?: string | null;
};

function getFormTypeLabel(formType: ApprovalFormType) {
  switch (formType) {
    case "attendance":
      return "근태";
    case "business_trip":
      return "출장";
    case "general":
      return "일반";
    default:
      return formType;
  }
}

function getStatusLabel(status: ApprovalDocStatus) {
  switch (status) {
    case "draft":
      return "임시저장";
    case "pending":
      return "신청중";
    case "approved":
      return "승인완료";
    case "rejected":
      return "반려";
    case "cancelled":
      return "취소";
    default:
      return status;
  }
}

function getStatusBadgeVariant(status: ApprovalDocStatus) {
  switch (status) {
    case "approved":
      return "default" as const;
    case "rejected":
      return "destructive" as const;
    default:
      return "secondary" as const;
  }
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export default function ApprovalStatsPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const role = user?.role ?? "";
const canView = role === "admin" || role === "host" || role === "superhost";

const myDocumentsQuery = trpc.approval.myDocuments.useQuery(undefined, {
  enabled: canView,
});

if (!canView) {
  return (
    <div className="p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>접근 권한 없음</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          전자결재 통계 메뉴는 관리자 이상만 접근할 수 있습니다.
        </CardContent>
      </Card>
    </div>
  );
}

  const docs = useMemo<ApprovalDocumentRow[]>(() => {
    return ((myDocumentsQuery.data ?? []) as ApprovalDocumentRow[]).slice();
  }, [myDocumentsQuery.data]);

  const stats = useMemo(() => {
    const total = docs.length;
    const pending = docs.filter((doc) => doc.status === "pending" || doc.status === "draft").length;
    const approved = docs.filter((doc) => doc.status === "approved").length;
    const rejected = docs.filter((doc) => doc.status === "rejected").length;

    const attendance = docs.filter((doc) => doc.formType === "attendance").length;
    const businessTrip = docs.filter((doc) => doc.formType === "business_trip").length;
    const general = docs.filter((doc) => doc.formType === "general").length;

    return {
      total,
      pending,
      approved,
      rejected,
      attendance,
      businessTrip,
      general,
    };
  }, [docs]);

  const recentDocs = useMemo(() => {
    return [...docs]
      .sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, 10);
  }, [docs]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">전자결재 통계</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            내 전자결재 문서 기준 통계를 확인할 수 있습니다.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => myDocumentsQuery.refetch()}
            disabled={myDocumentsQuery.isFetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${myDocumentsQuery.isFetching ? "animate-spin" : ""}`}
            />
            새로고침
          </Button>

          <Button type="button" variant="outline" onClick={() => setLocation("/e-approval")}>
            문서함으로
          </Button>
        </div>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="h-4 w-4" />
            전체 현황
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-4">
          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs text-muted-foreground">전체 문서</p>
            <p className="mt-2 text-2xl font-bold">{stats.total}</p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs text-muted-foreground">신청중</p>
            <p className="mt-2 text-2xl font-bold">{stats.pending}</p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs text-muted-foreground">승인완료</p>
            <p className="mt-2 text-2xl font-bold">{stats.approved}</p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs text-muted-foreground">반려</p>
            <p className="mt-2 text-2xl font-bold">{stats.rejected}</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">문서 유형별</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>근태</span>
              <span className="font-semibold">{stats.attendance}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>출장</span>
              <span className="font-semibold">{stats.businessTrip}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <span>일반</span>
              <span className="font-semibold">{stats.general}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">상태 요약</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock3 className="h-4 w-4" />
                신청중
              </div>
              <p className="mt-3 text-2xl font-bold">{stats.pending}</p>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle2 className="h-4 w-4" />
                승인완료
              </div>
              <p className="mt-3 text-2xl font-bold">{stats.approved}</p>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <XCircle className="h-4 w-4" />
                반려
              </div>
              <p className="mt-3 text-2xl font-bold">{stats.rejected}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            최근 신청 문서
          </CardTitle>
        </CardHeader>
        <CardContent>
          {myDocumentsQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">
              통계를 불러오는 중입니다...
            </div>
          ) : myDocumentsQuery.isError ? (
            <div className="text-sm text-destructive">
              통계 조회 중 오류가 발생했습니다.
            </div>
          ) : recentDocs.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              표시할 문서가 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {recentDocs.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setLocation(`/e-approval/${doc.id}`)}
                  className="w-full rounded-xl border p-4 text-left transition hover:bg-slate-50"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{getFormTypeLabel(doc.formType)}</Badge>
                    <Badge variant={getStatusBadgeVariant(doc.status)}>
                      {getStatusLabel(doc.status)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {doc.documentNumber}
                    </span>
                  </div>

                  <p className="mt-3 truncate text-sm font-semibold">{doc.title}</p>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>구분: {doc.subType}</span>
                    <span>신청일: {formatDateTime(doc.createdAt)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}