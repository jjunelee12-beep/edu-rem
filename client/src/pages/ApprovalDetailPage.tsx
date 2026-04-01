import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getFieldSetting, type ApprovalFieldSetting } from "@/lib/approvalFieldSettings";
import { useAuth } from "@/_core/hooks/useAuth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  XCircle,
  Clock3,
  Printer,
} from "lucide-react";

function getFormTypeLabel(formType: string) {
  if (formType === "attendance") return "근태";
  if (formType === "business_trip") return "출장";
  if (formType === "general") return "일반";
  return formType;
}

function getStatusLabel(status: string) {
  if (status === "pending") return "신청중";
  if (status === "approved") return "승인완료";
  if (status === "rejected") return "반려";
  if (status === "draft") return "임시저장";
  if (status === "cancelled") return "취소";
  return status;
}


function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

function getLineCardClass(line: any, doc: any) {
  if (line.stepStatus === "approved") {
    return "border-emerald-200 bg-emerald-50";
  }

  if (line.stepStatus === "rejected") {
    return "border-red-200 bg-red-50";
  }

  if (
    line.stepStatus === "pending" &&
    doc?.status === "pending" &&
    Number(line.stepOrder) === Number(doc?.currentStepOrder)
  ) {
    return "border-blue-200 bg-blue-50";
  }

  return "border-slate-200 bg-white";
}

function getLineStatusLabel(line: any, doc: any) {
  if (
    line.stepStatus === "pending" &&
    doc?.status === "pending" &&
    Number(line.stepOrder) === Number(doc?.currentStepOrder)
  ) {
    return "현재 결재 차례";
  }

  if (line.stepStatus === "pending") return "대기";
  if (line.stepStatus === "approved") return "승인 완료";
  if (line.stepStatus === "rejected") return "반려";
  return line.stepStatus || "-";
}

export default function ApprovalDetailPage() {
  const [, params] = useRoute("/e-approval/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const role = user?.role ?? "";
  const isPrivileged =
    role === "admin" || role === "host" || role === "superhost";

  const id = Number(params?.id);
const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
const [rejectReason, setRejectReason] = useState("");

  const detailQuery = trpc.approval.detail.useQuery(
    { id },
    { enabled: !!id }
  );

  const data = detailQuery.data;
  const doc = data?.document;
  const lines = data?.lines ?? [];
  const logs = data?.logs ?? [];

const fieldSettingsQuery = trpc.approval.getFieldSettings.useQuery(
  { formType: (doc?.formType || "general") as "attendance" | "business_trip" | "general" },
  { enabled: !!doc?.formType }
);

const fieldSettings = (fieldSettingsQuery.data ?? []) as ApprovalFieldSetting[];

const detailField = getFieldSetting(fieldSettings, "attendanceDetailType", "상세 유형");
const startField = getFieldSetting(fieldSettings, "attendanceStartTime", "시작 시간");
const endField = getFieldSetting(fieldSettings, "attendanceEndTime", "종료 시간");

const destinationField = getFieldSetting(fieldSettings, "destination", "목적지");
const visitPlaceField = getFieldSetting(fieldSettings, "visitPlace", "방문처");
const companionField = getFieldSetting(fieldSettings, "companion", "동행자");

const deptField = getFieldSetting(fieldSettings, "requestDepartment", "요청 부서");
const noteField = getFieldSetting(fieldSettings, "extraNote", "추가 메모");

const approveMutation = trpc.approval.approve.useMutation({
  onSuccess: async () => {
    toast.success("승인 처리되었습니다.");
    await detailQuery.refetch();
  },
  onError: (err) => {
    toast.error(err.message || "승인 처리 중 오류가 발생했습니다.");
  },
});

const rejectMutation = trpc.approval.reject.useMutation({
  onSuccess: async () => {
    toast.success("반려 처리되었습니다.");
    setRejectDialogOpen(false);
    setRejectReason("");
    await detailQuery.refetch();
  },
  onError: (err) => {
    toast.error(err.message || "반려 처리 중 오류가 발생했습니다.");
  },
});

  if (detailQuery.isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        문서를 불러오는 중...
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="p-6 text-sm text-destructive">
        문서를 찾을 수 없습니다.
      </div>
    );
  }

  if (!isPrivileged && Number(doc.applicantUserId) !== Number(user?.id)) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>접근 권한 없음</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            본인 문서만 열람할 수 있습니다.
          </CardContent>
        </Card>
      </div>
    );
  }
const currentPendingLine = [...lines]
  .sort((a: any, b: any) => Number(a.stepOrder) - Number(b.stepOrder))
  .find(
    (line: any) =>
      line.stepStatus === "pending" &&
      Number(line.stepOrder) === Number(doc.currentStepOrder)
  );

const canApproveHere =
  isPrivileged &&
  doc.status === "pending" &&
  !!currentPendingLine &&
  Number(currentPendingLine.approverUserId) === Number(user?.id);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* 상단 */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
  <div className="flex items-center gap-2">
    <Button variant="outline" onClick={() => setLocation("/e-approval")}>
      <ArrowLeft className="mr-2 h-4 w-4" />
      목록으로
    </Button>

    <Button
      variant="outline"
      onClick={() => setLocation(`/e-approval/${id}/print`)}
    >
      <Printer className="mr-2 h-4 w-4" />
      출력
    </Button>
  </div>

  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="outline">{getFormTypeLabel(doc.formType)}</Badge>
    <Badge>{getStatusLabel(doc.status)}</Badge>

    {canApproveHere ? (
      <>
        <Button
          type="button"
          onClick={() =>
            approveMutation.mutate({
              documentId: id,
              comment: "상세페이지 승인",
            })
          }
          disabled={approveMutation.isPending || rejectMutation.isPending}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {approveMutation.isPending ? "승인 처리 중..." : "승인"}
        </Button>

        <Button
          type="button"
          variant="destructive"
          onClick={() => setRejectDialogOpen(true)}
          disabled={approveMutation.isPending || rejectMutation.isPending}
        >
          <XCircle className="mr-2 h-4 w-4" />
          반려
        </Button>
      </>
    ) : null}
  </div>
</div>


	<Card>
  <CardHeader>
    <CardTitle>결재 진행 상태</CardTitle>
<div className="mt-2 text-sm text-muted-foreground">
  진행률:{" "}
  {(() => {
    const approvedCount = lines.filter((l: any) => l.stepStatus === "approved").length;
    return `${approvedCount} / ${lines.length}`;
  })()}
</div>
  </CardHeader>
  <CardContent className="grid gap-3 md:grid-cols-3">
    <div className="rounded-xl border bg-slate-50 p-4">
      <p className="text-xs text-muted-foreground">현재 상태</p>
      <p className="mt-2 text-base font-semibold">{getStatusLabel(doc.status)}</p>
    </div>

    <div className="rounded-xl border bg-slate-50 p-4">
      <p className="text-xs text-muted-foreground">현재 차수</p>
      <p className="mt-2 text-base font-semibold">
        {
  doc.currentStepOrder
    ? `${doc.currentStepOrder}차`
    : (() => {
        const pendingLine = lines.find((l: any) => l.stepStatus === "pending");
        return pendingLine ? `${pendingLine.stepOrder}차` : "-";
      })()
}
      </p>
    </div>

    <div className="rounded-xl border bg-slate-50 p-4">
      <p className="text-xs text-muted-foreground">전체 결재 단계</p>
      <p className="mt-2 text-base font-semibold">{lines.length}단계</p>
    </div>
  </CardContent>
</Card>

      {/* 문서 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            문서 정보
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-4">
            <span>문서번호: {doc.documentNumber}</span>
            <span>작성자: {doc.applicantUserName}</span>
            <span>신청일: {formatDateTime(doc.createdAt)}</span>
          </div>

          import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getFieldSetting, type ApprovalFieldSetting } from "@/lib/approvalFieldSettings";
import { useAuth } from "@/_core/hooks/useAuth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  XCircle,
  Clock3,
  Printer,
} from "lucide-react";

function getFormTypeLabel(formType: string) {
  if (formType === "attendance") return "근태";
  if (formType === "business_trip") return "출장";
  if (formType === "general") return "일반";
  return formType;
}

function getStatusLabel(status: string) {
  if (status === "pending") return "신청중";
  if (status === "approved") return "승인완료";
  if (status === "rejected") return "반려";
  if (status === "draft") return "임시저장";
  if (status === "cancelled") return "취소";
  return status;
}


function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(
    d.getMinutes()
  ).padStart(2, "0")}`;
}

function getLineCardClass(line: any, doc: any) {
  if (line.stepStatus === "approved") {
    return "border-emerald-200 bg-emerald-50";
  }

  if (line.stepStatus === "rejected") {
    return "border-red-200 bg-red-50";
  }

  if (
    line.stepStatus === "pending" &&
    doc?.status === "pending" &&
    Number(line.stepOrder) === Number(doc?.currentStepOrder)
  ) {
    return "border-blue-200 bg-blue-50";
  }

  return "border-slate-200 bg-white";
}

function getLineStatusLabel(line: any, doc: any) {
  if (
    line.stepStatus === "pending" &&
    doc?.status === "pending" &&
    Number(line.stepOrder) === Number(doc?.currentStepOrder)
  ) {
    return "현재 결재 차례";
  }

  if (line.stepStatus === "pending") return "대기";
  if (line.stepStatus === "approved") return "승인 완료";
  if (line.stepStatus === "rejected") return "반려";
  return line.stepStatus || "-";
}

export default function ApprovalDetailPage() {
  const [, params] = useRoute("/e-approval/:id");
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const role = user?.role ?? "";
  const isPrivileged =
    role === "admin" || role === "host" || role === "superhost";

  const id = Number(params?.id);
const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
const [rejectReason, setRejectReason] = useState("");

  const detailQuery = trpc.approval.detail.useQuery(
    { id },
    { enabled: !!id }
  );

  const data = detailQuery.data;
  const doc = data?.document;
  const lines = data?.lines ?? [];
  const logs = data?.logs ?? [];

const fieldSettingsQuery = trpc.approval.getFieldSettings.useQuery(
  { formType: (doc?.formType || "general") as "attendance" | "business_trip" | "general" },
  { enabled: !!doc?.formType }
);

const fieldSettings = (fieldSettingsQuery.data ?? []) as ApprovalFieldSetting[];

const detailField = getFieldSetting(fieldSettings, "attendanceDetailType", "상세 유형");
const startField = getFieldSetting(fieldSettings, "attendanceStartTime", "시작 시간");
const endField = getFieldSetting(fieldSettings, "attendanceEndTime", "종료 시간");

const destinationField = getFieldSetting(fieldSettings, "destination", "목적지");
const visitPlaceField = getFieldSetting(fieldSettings, "visitPlace", "방문처");
const companionField = getFieldSetting(fieldSettings, "companion", "동행자");

const deptField = getFieldSetting(fieldSettings, "requestDepartment", "요청 부서");
const noteField = getFieldSetting(fieldSettings, "extraNote", "추가 메모");

const approveMutation = trpc.approval.approve.useMutation({
  onSuccess: async () => {
    toast.success("승인 처리되었습니다.");
    await detailQuery.refetch();
  },
  onError: (err) => {
    toast.error(err.message || "승인 처리 중 오류가 발생했습니다.");
  },
});

const rejectMutation = trpc.approval.reject.useMutation({
  onSuccess: async () => {
    toast.success("반려 처리되었습니다.");
    setRejectDialogOpen(false);
    setRejectReason("");
    await detailQuery.refetch();
  },
  onError: (err) => {
    toast.error(err.message || "반려 처리 중 오류가 발생했습니다.");
  },
});

  if (detailQuery.isLoading) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        문서를 불러오는 중...
      </div>
    );
  }

  if (!doc) {
    return (
      <div className="p-6 text-sm text-destructive">
        문서를 찾을 수 없습니다.
      </div>
    );
  }

  if (!isPrivileged && Number(doc.applicantUserId) !== Number(user?.id)) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>접근 권한 없음</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            본인 문서만 열람할 수 있습니다.
          </CardContent>
        </Card>
      </div>
    );
  }
const currentPendingLine = [...lines]
  .sort((a: any, b: any) => Number(a.stepOrder) - Number(b.stepOrder))
  .find(
    (line: any) =>
      line.stepStatus === "pending" &&
      Number(line.stepOrder) === Number(doc.currentStepOrder)
  );

const canApproveHere =
  isPrivileged &&
  doc.status === "pending" &&
  !!currentPendingLine &&
  Number(currentPendingLine.approverUserId) === Number(user?.id);

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* 상단 */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
  <div className="flex items-center gap-2">
    <Button variant="outline" onClick={() => setLocation("/e-approval")}>
      <ArrowLeft className="mr-2 h-4 w-4" />
      목록으로
    </Button>

    <Button
      variant="outline"
      onClick={() => setLocation(`/e-approval/${id}/print`)}
    >
      <Printer className="mr-2 h-4 w-4" />
      출력
    </Button>
  </div>

  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="outline">{getFormTypeLabel(doc.formType)}</Badge>
    <Badge>{getStatusLabel(doc.status)}</Badge>

    {canApproveHere ? (
      <>
        <Button
          type="button"
          onClick={() =>
            approveMutation.mutate({
              documentId: id,
              comment: "상세페이지 승인",
            })
          }
          disabled={approveMutation.isPending || rejectMutation.isPending}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {approveMutation.isPending ? "승인 처리 중..." : "승인"}
        </Button>

        <Button
          type="button"
          variant="destructive"
          onClick={() => setRejectDialogOpen(true)}
          disabled={approveMutation.isPending || rejectMutation.isPending}
        >
          <XCircle className="mr-2 h-4 w-4" />
          반려
        </Button>
      </>
    ) : null}
  </div>
</div>


	<Card>
  <CardHeader>
    <CardTitle>결재 진행 상태</CardTitle>
<div className="mt-2 text-sm text-muted-foreground">
  진행률:{" "}
  {(() => {
    const approvedCount = lines.filter((l: any) => l.stepStatus === "approved").length;
    return `${approvedCount} / ${lines.length}`;
  })()}
</div>
  </CardHeader>
  <CardContent className="grid gap-3 md:grid-cols-3">
    <div className="rounded-xl border bg-slate-50 p-4">
      <p className="text-xs text-muted-foreground">현재 상태</p>
      <p className="mt-2 text-base font-semibold">{getStatusLabel(doc.status)}</p>
    </div>

    <div className="rounded-xl border bg-slate-50 p-4">
      <p className="text-xs text-muted-foreground">현재 차수</p>
      <p className="mt-2 text-base font-semibold">
        {
  doc.currentStepOrder
    ? `${doc.currentStepOrder}차`
    : (() => {
        const pendingLine = lines.find((l: any) => l.stepStatus === "pending");
        return pendingLine ? `${pendingLine.stepOrder}차` : "-";
      })()
}
      </p>
    </div>

    <div className="rounded-xl border bg-slate-50 p-4">
      <p className="text-xs text-muted-foreground">전체 결재 단계</p>
      <p className="mt-2 text-base font-semibold">{lines.length}단계</p>
    </div>
  </CardContent>
</Card>

      {/* 문서 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            문서 정보
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-4">
            <span>문서번호: {doc.documentNumber}</span>
            <span>작성자: {doc.applicantUserName}</span>
            <span>신청일: {formatDateTime(doc.createdAt)}</span>
          </div>

          <div className="text-base font-semibold">{doc.title}</div>

          <div className="text-muted-foreground">
            {doc.subType} / 시행일자:{" "}
            {doc.targetDate || doc.startDate || doc.endDate || "-"}
          </div>

          {doc.reason && (
            <div className="rounded-lg border bg-slate-50 p-4">
              {doc.reason}
            </div>
          )}

          {doc.attachmentUrl ? (
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-sm font-medium">첨부파일</p>
              <a
                href={doc.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm text-primary underline"
              >
                {doc.attachmentName || "첨부파일 열기"}
              </a>
            </div>
          ) : null}

          {doc.status === "rejected" && doc.rejectedReason && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
              반려 사유: {doc.rejectedReason}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 승인 라인 */}
      <Card>
        <CardHeader>
          <CardTitle>승인 라인</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          
{[...lines]
  .sort((a: any, b: any) => Number(a.stepOrder) - Number(b.stepOrder))
  .map((line: any) => {
  const isCurrentPending =
    line.stepStatus === "pending" &&
    doc?.status === "pending" &&
    Number(line.stepOrder) === Number(doc?.currentStepOrder);

  return (
    <div
      key={line.id}
      className={`rounded-xl border p-4 ${getLineCardClass(line, doc)}`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
       <div className="min-w-0">
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="outline">{line.stepOrder}차 승인</Badge>

    {isCurrentPending ? (
      <Badge className="bg-blue-600 text-white hover:bg-blue-600">
        현재 차례
      </Badge>
    ) : null}
  </div>

  <p
    className={`mt-3 text-sm font-semibold ${
      isCurrentPending ? "text-blue-700" : "text-slate-900"
    }`}
  >
    {line.approverName || "-"}
  </p>

  <p className="mt-1 text-xs text-muted-foreground">
    {line.approverRole || "직급 정보 없음"}
  </p>

  {line.approvedAt ? (
    <div className="mt-1 text-xs text-muted-foreground">
      승인일: {formatDateTime(line.approvedAt)}
    </div>
  ) : null}
</div>
        </div>

        <div className="flex items-center gap-2">
          {line.stepStatus === "pending" && (
            <Badge variant={isCurrentPending ? "default" : "secondary"}>
              <Clock3 className="mr-1 h-3 w-3" />
              {getLineStatusLabel(line, doc)}
            </Badge>
          )}

          {line.stepStatus === "approved" && (
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              승인 완료
            </Badge>
          )}

          {line.stepStatus === "rejected" && (
            <Badge variant="destructive">
              <XCircle className="mr-1 h-3 w-3" />
              반려
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
})}

        </CardContent>
      </Card>

      {/* 로그 */}
      <Card>
        <CardHeader>
          <CardTitle>결재 로그</CardTitle>
        </CardHeader>

        <CardContent className="space-y-2 text-sm">
          {logs.length === 0 ? (
            <div className="text-muted-foreground">로그가 없습니다.</div>
          ) : (
            logs.map((log: any) => (
  <div
    key={log.id}
    className="rounded-lg border p-3"
  >
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div className="text-sm">
        <span className="font-medium">{log.actorUserName || "-"}</span>
        <span className="mx-2 text-muted-foreground">/</span>
        <span>{log.actionType || "-"}</span>
      </div>

      <div className="text-xs text-muted-foreground">
        {formatDateTime(log.createdAt)}
      </div>
    </div>

    {log.note ? (
      <div className="mt-2 text-xs text-muted-foreground">
        {log.note}
      </div>
    ) : null}
  </div>
))
          )}
        </CardContent>
      </Card>
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>반려 사유 입력</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              반려 사유는 신청자와 로그에 그대로 남습니다.
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
              onClick={() => {
                if (!rejectReason.trim()) {
                  toast.error("반려 사유를 입력하세요.");
                  return;
                }

                rejectMutation.mutate({
                  documentId: id,
                  comment: rejectReason.trim(),
                });
              }}
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

          {doc.attachmentUrl ? (
            <div className="rounded-lg border bg-slate-50 p-4">
              <p className="text-sm font-medium">첨부파일</p>
              <a
                href={doc.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-block text-sm text-primary underline"
              >
                {doc.attachmentName || "첨부파일 열기"}
              </a>
            </div>
          ) : null}

          {doc.status === "rejected" && doc.rejectedReason && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
              반려 사유: {doc.rejectedReason}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 승인 라인 */}
      <Card>
        <CardHeader>
          <CardTitle>승인 라인</CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          
{[...lines]
  .sort((a: any, b: any) => Number(a.stepOrder) - Number(b.stepOrder))
  .map((line: any) => {
  const isCurrentPending =
    line.stepStatus === "pending" &&
    doc?.status === "pending" &&
    Number(line.stepOrder) === Number(doc?.currentStepOrder);

  return (
    <div
      key={line.id}
      className={`rounded-xl border p-4 ${getLineCardClass(line, doc)}`}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
       <div className="min-w-0">
  <div className="flex flex-wrap items-center gap-2">
    <Badge variant="outline">{line.stepOrder}차 승인</Badge>

    {isCurrentPending ? (
      <Badge className="bg-blue-600 text-white hover:bg-blue-600">
        현재 차례
      </Badge>
    ) : null}
  </div>

  <p
    className={`mt-3 text-sm font-semibold ${
      isCurrentPending ? "text-blue-700" : "text-slate-900"
    }`}
  >
    {line.approverName || "-"}
  </p>

  <p className="mt-1 text-xs text-muted-foreground">
    {line.approverRole || "직급 정보 없음"}
  </p>

  {line.approvedAt ? (
    <div className="mt-1 text-xs text-muted-foreground">
      승인일: {formatDateTime(line.approvedAt)}
    </div>
  ) : null}
</div>
        </div>

        <div className="flex items-center gap-2">
          {line.stepStatus === "pending" && (
            <Badge variant={isCurrentPending ? "default" : "secondary"}>
              <Clock3 className="mr-1 h-3 w-3" />
              {getLineStatusLabel(line, doc)}
            </Badge>
          )}

          {line.stepStatus === "approved" && (
            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              승인 완료
            </Badge>
          )}

          {line.stepStatus === "rejected" && (
            <Badge variant="destructive">
              <XCircle className="mr-1 h-3 w-3" />
              반려
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
})}

        </CardContent>
      </Card>

      {/* 로그 */}
      <Card>
        <CardHeader>
          <CardTitle>결재 로그</CardTitle>
        </CardHeader>

        <CardContent className="space-y-2 text-sm">
          {logs.length === 0 ? (
            <div className="text-muted-foreground">로그가 없습니다.</div>
          ) : (
            logs.map((log: any) => (
  <div
    key={log.id}
    className="rounded-lg border p-3"
  >
    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
      <div className="text-sm">
        <span className="font-medium">{log.actorUserName || "-"}</span>
        <span className="mx-2 text-muted-foreground">/</span>
        <span>{log.actionType || "-"}</span>
      </div>

      <div className="text-xs text-muted-foreground">
        {formatDateTime(log.createdAt)}
      </div>
    </div>

    {log.note ? (
      <div className="mt-2 text-xs text-muted-foreground">
        {log.note}
      </div>
    ) : null}
  </div>
))
          )}
        </CardContent>
      </Card>
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>반려 사유 입력</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              반려 사유는 신청자와 로그에 그대로 남습니다.
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
              onClick={() => {
                if (!rejectReason.trim()) {
                  toast.error("반려 사유를 입력하세요.");
                  return;
                }

                rejectMutation.mutate({
                  documentId: id,
                  comment: rejectReason.trim(),
                });
              }}
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