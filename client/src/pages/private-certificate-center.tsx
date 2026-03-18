import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { ArrowLeft, Loader2, Pencil, Trash2, Search, Save } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { formatPhone } from "@/lib/format";

const REQUEST_STATUS_OPTIONS = [
  "요청",
  "안내완료",
  "입금대기",
  "입금확인",
  "진행중",
  "완료",
  "취소",
] as const;

const PAYMENT_STATUS_OPTIONS = [
  "결제대기",
  "입금확인",
  "완료",
  "취소",
] as const;

function formatDate(v: any) {
  if (!v) return "-";
  const d = typeof v === "string" ? new Date(v) : v;
  if (isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

function toNumber(v: any) {
  return Number(String(v ?? "0").replace(/,/g, "").replace(/[^0-9.-]/g, "").trim()) || 0;
}

export default function PrivateCertificateCenterPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const isAdmin = user?.role === "admin" || user?.role === "host";

  const { data, isLoading } = trpc.privateCertificate.list.useQuery(undefined, {
    enabled: !!isAdmin,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("전체");
  const [paymentFilter, setPaymentFilter] = useState<string>("전체");

  const [editOpen, setEditOpen] = useState(false);
  const [editingRow, setEditingRow] = useState<any | null>(null);
  const [form, setForm] = useState({
    certificateName: "",
    inputAddress: "",
    note: "",
    requestStatus: "요청",
    feeAmount: "",
    paymentStatus: "결제대기",
    paidAt: "",
    attachmentName: "",
    attachmentUrl: "",
  });

  const updateMut = trpc.privateCertificate.update.useMutation({
    onSuccess: async () => {
      await utils.privateCertificate.list.invalidate();
      toast.success("민간자격증 요청이 수정되었습니다.");
      setEditOpen(false);
      setEditingRow(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.privateCertificate.delete.useMutation({
    onSuccess: async () => {
      await utils.privateCertificate.list.invalidate();
      toast.success("민간자격증 요청이 삭제되었습니다.");
    },
    onError: (e) => toast.error(e.message),
  });

  const filteredRows = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return (data || []).filter((row: any) => {
      const matchesKeyword =
        !keyword ||
        String(row.clientName || "").toLowerCase().includes(keyword) ||
        String(row.phone || "").toLowerCase().includes(keyword) ||
        String(row.assigneeName || "").toLowerCase().includes(keyword) ||
        String(row.certificateName || "").toLowerCase().includes(keyword) ||
        String(row.inputAddress || "").toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "전체" || String(row.requestStatus || "") === statusFilter;

      const matchesPayment =
        paymentFilter === "전체" || String(row.paymentStatus || "") === paymentFilter;

      return matchesKeyword && matchesStatus && matchesPayment;
    });
  }, [data, search, statusFilter, paymentFilter]);

  const totalFee = useMemo(() => {
    return filteredRows.reduce((sum: number, row: any) => sum + toNumber(row.feeAmount), 0);
  }, [filteredRows]);

  const paidCount = useMemo(() => {
    return filteredRows.filter((row: any) => row.paymentStatus === "입금확인").length;
  }, [filteredRows]);

  const openEdit = (row: any) => {
    setEditingRow(row);
    setForm({
      certificateName: row.certificateName || "",
      inputAddress: row.inputAddress || "",
      note: row.note || "",
      requestStatus: row.requestStatus || "요청",
      feeAmount: row.feeAmount?.toString() || "",
      paymentStatus: row.paymentStatus || "결제대기",
      paidAt: row.paidAt ? formatDate(row.paidAt) : "",
      attachmentName: row.attachmentName || "",
      attachmentUrl: row.attachmentUrl || "",
    });
    setEditOpen(true);
  };

  const requestStatusBadge = (status: string) => {
    switch (status) {
      case "완료":
        return "bg-emerald-100 text-emerald-700";
      case "진행중":
        return "bg-blue-100 text-blue-700";
      case "입금확인":
        return "bg-violet-100 text-violet-700";
      case "취소":
        return "bg-red-100 text-red-700";
      default:
        return "bg-amber-100 text-amber-700";
    }
  };

  const paymentStatusBadge = (status: string) => {
    switch (status) {
      case "완료":
        return "bg-emerald-100 text-emerald-700";
      case "입금확인":
        return "bg-blue-100 text-blue-700";
      case "취소":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          뒤로가기
        </Button>
        <div className="text-sm text-muted-foreground py-10 text-center">
          관리자 또는 호스트만 접근할 수 있습니다.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">민간자격증 페이지</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            민간자격증 요청, 입금 확인, 진행 상태를 관리합니다.
          </p>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">전체 요청 수</p>
            <p className="text-2xl font-bold">{filteredRows.length}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">입금확인 건수</p>
            <p className="text-2xl font-bold text-blue-700">{paidCount}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">요청 금액 합계</p>
            <p className="text-2xl font-bold text-emerald-700">
              {totalFee.toLocaleString()}원
            </p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">완료 건수</p>
            <p className="text-2xl font-bold text-violet-700">
              {filteredRows.filter((x: any) => x.requestStatus === "완료").length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">검색 / 필터</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-[1fr_180px_180px] gap-3">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="이름 / 연락처 / 담당자 / 자격증 / 주소 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="요청상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="전체">전체 상태</SelectItem>
                {REQUEST_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger>
                <SelectValue placeholder="입금상태" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="전체">전체 결제상태</SelectItem>
                {PAYMENT_STATUS_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">민간자격증 요청 목록</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">학생명</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">연락처</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">담당자</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">자격증</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">주소</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">요청상태</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">결제상태</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">금액</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">요청일</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                        요청 데이터가 없습니다.
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map((row: any) => (
                      <tr key={row.id} className="border-b last:border-0">
                        <td className="px-4 py-3 font-medium">{row.clientName}</td>
                        <td className="px-4 py-3">{formatPhone(row.phone)}</td>
                        <td className="px-4 py-3">{row.assigneeName || "-"}</td>
                        <td className="px-4 py-3">{row.certificateName}</td>
                        <td className="px-4 py-3 max-w-[220px] truncate">{row.inputAddress || "-"}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={requestStatusBadge(row.requestStatus || "요청")}>
                            {row.requestStatus || "요청"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={paymentStatusBadge(row.paymentStatus || "결제대기")}>
                            {row.paymentStatus || "결제대기"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">
                          {toNumber(row.feeAmount).toLocaleString()}원
                        </td>
                        <td className="px-4 py-3 text-center">
                          {formatDate(row.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEdit(row)}
                              title="수정"
                            >
                              <Pencil className="h-4 w-4 text-blue-500" />
                            </Button>

                            <Button
                              variant="ghost"
                              size="icon"
                              title="삭제"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (!confirm("민간자격증 요청을 삭제하시겠습니까?")) return;
                                deleteMut.mutate({ id: row.id });
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>민간자격증 요청 수정</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">자격증명</Label>
                <Input
                  value={form.certificateName}
                  onChange={(e) => setForm({ ...form, certificateName: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">주소</Label>
                <Input
                  value={form.inputAddress}
                  onChange={(e) => setForm({ ...form, inputAddress: e.target.value })}
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">요청상태</Label>
                <Select
                  value={form.requestStatus}
                  onValueChange={(v) => setForm({ ...form, requestStatus: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUEST_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">결제상태</Label>
                <Select
                  value={form.paymentStatus}
                  onValueChange={(v) => setForm({ ...form, paymentStatus: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">금액</Label>
                <Input
                  value={form.feeAmount}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      feeAmount: e.target.value.replace(/[^0-9]/g, ""),
                    })
                  }
                  placeholder="예: 50000"
                />
              </div>
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">입금확인일</Label>
                <Input
                  type="date"
                  value={form.paidAt}
                  onChange={(e) => setForm({ ...form, paidAt: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">첨부파일명</Label>
                <Input
                  value={form.attachmentName}
                  onChange={(e) => setForm({ ...form, attachmentName: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">첨부파일 URL</Label>
                <Input
                  value={form.attachmentUrl}
                  onChange={(e) => setForm({ ...form, attachmentUrl: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">메모</Label>
              <Textarea
                rows={4}
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                placeholder="진행 메모"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              취소
            </Button>

            <Button
              onClick={() => {
                if (!editingRow) return;

                updateMut.mutate({
                  id: editingRow.id,
                  certificateName: form.certificateName || undefined,
                  inputAddress: form.inputAddress || undefined,
                  note: form.note || undefined,
                  requestStatus: form.requestStatus as any,
                  feeAmount: form.feeAmount || undefined,
                  paymentStatus: form.paymentStatus as any,
                  paidAt: form.paidAt || undefined,
                  attachmentName: form.attachmentName || undefined,
                  attachmentUrl: form.attachmentUrl || undefined,
                });
              }}
              disabled={updateMut.isPending}
              className="gap-1"
            >
              <Save className="h-4 w-4" />
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}