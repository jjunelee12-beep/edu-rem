import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Search,
} from "lucide-react";

type ApprovalDocStatus = "draft" | "pending" | "approved" | "rejected" | "cancelled";
type ApprovalFormType = "attendance" | "business_trip" | "general";

type PendingApprovalRow = {
  id: number;
  lineId: number;
  stepOrder: number;
  stepStatus: string;
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

function formatDate(value?: string | null) {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return String(value).slice(0, 10);
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return String(value);
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

export default function ApprovalInboxPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const role = user?.role ?? "";
  const canView = role === "admin" || role === "host" || role === "superhost";

  const pendingQuery = trpc.approval.pendingForMe.useQuery(undefined, {
    enabled: canView,
  });

  const approveMutation = trpc.approval.approve.useMutation({
    onSuccess: () => {
      toast.success("승인 처리되었습니다.");
      void pendingQuery.refetch();
    },
    onError: (err) => {
      toast.error(err.message || "승인 처리 중 오류가 발생했습니다.");
    },
  });

  const rejectMutation = trpc.approval.reject.useMutation({
    onSuccess: () => {
      toast.success("반려 처리되었습니다.");
      setRejectDialogOpen(false);
      setRejectReason("");
      setSelectedRejectDocumentId(null);
      void pendingQuery.refetch();
    },
    onError: (err) => {
      toast.error(err.message || "반려 처리 중 오류가 발생했습니다.");
    },
  });

  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRejectDocumentId, setSelectedRejectDocumentId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [search, setSearch] = useState("");
  const [formTypeFilter, setFormTypeFilter] = useState<"all" | ApprovalFormType>("all");

  const docs = useMemo<PendingApprovalRow[]>(() => {
    return ((pendingQuery.data ?? []) as PendingApprovalRow[]).slice();
  }, [pendingQuery.data]);

  
const filteredDocs = useMemo(() => {
  const q = search.trim().toLowerCase();

  return docs.filter((doc) => {
    if (doc.stepStatus !== "pending") {
      return false;
    }

    if (formTypeFilter !== "all" && doc.formType !== formTypeFilter) {
      return false;
    }

    if (!q) return true;

    const merged = [
      doc.documentNumber,
      doc.title,
      doc.subType,
      doc.reason,
      doc.targetDate,
      doc.startDate,
      doc.endDate,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return merged.includes(q);
  });
}, [docs, formTypeFilter, search]);

  if (!canView) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>접근 권한 없음</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            전자결재 승인 메뉴는 관리자 이상만 접근할 수 있습니다.
          </CardContent>
        </Card>
      </div>
    );
  }

  const openRejectDialog = (documentId: number) => {
    setSelectedRejectDocumentId(documentId);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const submitReject = () => {
    if (!selectedRejectDocumentId) {
      toast.error("반려할 문서를 찾을 수 없습니다.");
      return;
    }

    if (!rejectReason.trim()) {
      toast.error("반려 사유를 입력하세요.");
      return;
    }

    rejectMutation.mutate({
      documentId: selectedRejectDocumentId,
      comment: rejectReason.trim(),
    });
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">전자결재 승인</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            현재 내 승인 차례인 문서를 확인하고 승인 또는 반려 처리할 수 있습니다.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => pendingQuery.refetch()}
          disabled={pendingQuery.isFetching}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${pendingQuery.isFetching ? "animate-spin" : ""}`}
          />
          새로고침
        </Button>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4" />
            승인 대기 현황
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs text-muted-foreground">내 승인 대기 건수</p>
            <p className="mt-2 text-2xl font-bold">{docs.length}</p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs text-muted-foreground">권한</p>
            <p className="mt-2 text-base font-semibold">
              {role === "superhost" ? "슈퍼호스트" : role === "host" ? "호스트" : "관리자"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-[1fr_180px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="문서번호, 제목, 구분, 사유, 시행일자 검색"
                className="pl-9"
              />
            </div>

            <Select
              value={formTypeFilter}
              onValueChange={(value) =>
                setFormTypeFilter(value as "all" | ApprovalFormType)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="문서 구분" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 문서</SelectItem>
                <SelectItem value="attendance">근태</SelectItem>
                <SelectItem value="business_trip">출장</SelectItem>
                <SelectItem value="general">일반</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-xl border bg-slate-50 px-4 py-3 text-sm text-muted-foreground">
            검색 결과:{" "}
            <span className="font-medium text-foreground">{filteredDocs.length}건</span>
          </div>
        </CardContent>
      </Card>

      {pendingQuery.isLoading ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-muted-foreground">
          승인 문서를 불러오는 중입니다...
        </div>
      ) : pendingQuery.isError ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-destructive">
          승인 문서 조회 중 오류가 발생했습니다.
        </div>
      ) : filteredDocs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>승인 대기 문서</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            조건에 맞는 승인 대기 문서가 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredDocs.map((doc) => {
            const processing =
              approveMutation.isPending || rejectMutation.isPending;

            return (
              <Card key={doc.id} className="border-slate-200">
                <CardContent className="p-5">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{getFormTypeLabel(doc.formType)}</Badge>
                        <Badge variant="secondary">{getStatusLabel(doc.status)}</Badge>
                        <Badge variant="outline">결재순서 {doc.stepOrder}차</Badge>
                        <span className="text-xs text-muted-foreground">
                          {doc.documentNumber}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setLocation(`/e-approval/${doc.id}`)}
                        className="mt-3 block text-left"
                      >
                        <p className="truncate text-base font-semibold hover:underline">
                          {doc.title}
                        </p>
                      </button>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>구분: {doc.subType}</span>
                        <span>
                          시행일자: {formatDate(doc.targetDate || doc.startDate || doc.endDate)}
                        </span>
                        <span>신청일: {formatDateTime(doc.createdAt)}</span>
                      </div>

                      {doc.reason ? (
                        <div className="mt-4 rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">
                          {doc.reason}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-row gap-2 lg:flex-col">
                     <Button
  type="button"
  onClick={() => {
    if (doc.stepStatus !== "pending") {
      toast.error("현재 승인할 수 없는 상태입니다.");
      return;
    }

    approveMutation.mutate({
      documentId: doc.id,
      comment: "승인",
    });
  }}
  disabled={processing}
>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        승인
                      </Button>

                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => openRejectDialog(doc.id)}
                        disabled={processing}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        반려
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>반려 사유 입력</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              반려 사유는 신청자에게 그대로 남습니다.
            </p>

            <Textarea
              rows={6}
              placeholder="반려 사유를 입력하세요."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={rejectMutation.isPending}
            >
              취소
            </Button>

            <Button
              type="button"
              variant="destructive"
              onClick={submitReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "반려 처리 중..." : "반려 확정"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}