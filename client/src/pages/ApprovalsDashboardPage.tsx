import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  FileText,
  Clock3,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
} from "lucide-react";

type ApprovalDocStatus = "draft" | "pending" | "approved" | "rejected" | "cancelled";
type ApprovalFormType = "attendance" | "business_trip" | "general";
type ViewTab = "pending" | "rejected" | "approved";

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

function getTabIcon(tab: ViewTab) {
  if (tab === "pending") return <Clock3 className="h-4 w-4 text-slate-500" />;
  if (tab === "rejected") return <XCircle className="h-4 w-4 text-slate-500" />;
  return <CheckCircle2 className="h-4 w-4 text-slate-500" />;
}

export default function ApprovalsDashboardPage() {
  const [, setLocation] = useLocation();

  const myDocumentsQuery = trpc.approval.myDocuments.useQuery();

  const [activeTab, setActiveTab] = useState<ViewTab>("pending");
  const [search, setSearch] = useState("");
  const [formTypeFilter, setFormTypeFilter] = useState<"all" | ApprovalFormType>("all");

  const allDocs = useMemo<ApprovalDocumentRow[]>(() => {
    return ((myDocumentsQuery.data ?? []) as ApprovalDocumentRow[]).slice();
  }, [myDocumentsQuery.data]);

  const pendingDocs = useMemo(
    () => allDocs.filter((doc) => doc.status === "pending" || doc.status === "draft"),
    [allDocs]
  );

  const rejectedDocs = useMemo(
    () => allDocs.filter((doc) => doc.status === "rejected"),
    [allDocs]
  );

  const approvedDocs = useMemo(
    () => allDocs.filter((doc) => doc.status === "approved"),
    [allDocs]
  );

  const currentBaseDocs = useMemo(() => {
    if (activeTab === "pending") return pendingDocs;
    if (activeTab === "rejected") return rejectedDocs;
    return approvedDocs;
  }, [activeTab, pendingDocs, rejectedDocs, approvedDocs]);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();

    return currentBaseDocs.filter((doc) => {
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
  }, [currentBaseDocs, formTypeFilter, search]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">전자결재 문서함</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            내가 신청한 전자결재 문서를 상태별로 확인할 수 있습니다.
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
        </div>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" />
            문서함 현황
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs text-muted-foreground">신청중</p>
            <p className="mt-2 text-2xl font-bold">{pendingDocs.length}</p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs text-muted-foreground">반려</p>
            <p className="mt-2 text-2xl font-bold">{rejectedDocs.length}</p>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs text-muted-foreground">승인완료</p>
            <p className="mt-2 text-2xl font-bold">{approvedDocs.length}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4 p-4">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ViewTab)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">신청중</TabsTrigger>
              <TabsTrigger value="rejected">반려</TabsTrigger>
              <TabsTrigger value="approved">승인완료</TabsTrigger>
            </TabsList>
          </Tabs>

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
            현재 보기:{" "}
            <span className="font-medium text-foreground">
              {activeTab === "pending"
                ? "신청중"
                : activeTab === "rejected"
                ? "반려"
                : "승인완료"}
            </span>
            {" · "}
            검색 결과:{" "}
            <span className="font-medium text-foreground">{filteredDocs.length}건</span>
          </div>
        </CardContent>
      </Card>

      {myDocumentsQuery.isLoading ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-muted-foreground">
          문서함을 불러오는 중입니다...
        </div>
      ) : myDocumentsQuery.isError ? (
        <div className="rounded-xl border bg-white p-8 text-center text-sm text-destructive">
          문서함 조회 중 오류가 발생했습니다.
        </div>
      ) : filteredDocs.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {getTabIcon(activeTab)}
              {activeTab === "pending"
                ? "신청중 문서"
                : activeTab === "rejected"
                ? "반려 문서"
                : "승인완료 문서"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            조건에 맞는 문서가 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredDocs.map((doc) => (
            <Card key={doc.id} className="border-slate-200">
              <CardContent className="p-5">
                <button
                  type="button"
                  onClick={() => setLocation(`/e-approval/${doc.id}`)}
                  className="w-full text-left"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{getFormTypeLabel(doc.formType)}</Badge>
                        <Badge variant={getStatusBadgeVariant(doc.status)}>
                          {getStatusLabel(doc.status)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {doc.documentNumber}
                        </span>
                      </div>

                      <p className="mt-3 truncate text-base font-semibold hover:underline">
                        {doc.title}
                      </p>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                        <span>구분: {doc.subType}</span>
                        <span>
                          시행일자: {formatDate(doc.targetDate || doc.startDate || doc.endDate)}
                        </span>
                        <span>신청일: {formatDateTime(doc.createdAt)}</span>
                      </div>

                      {doc.reason ? (
                        <div className="mt-4 line-clamp-2 rounded-lg border bg-slate-50 p-3 text-sm text-slate-700">
                          {doc.reason}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}