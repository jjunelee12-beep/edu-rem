import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Trash2, Search } from "lucide-react";
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
  "결제",
  "환불",
  "취소",
] as const;

function formatDate(v: any) {
  if (!v) return "-";
  const d = typeof v === "string" ? new Date(v) : v;
  if (isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function toNumber(v: any) {
  return Number(String(v ?? "0").replace(/,/g, "").replace(/[^0-9.-]/g, "").trim()) || 0;
}

export default function PrivateCertificateCenterPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const isAdmin =
  user?.role === "admin" ||
  user?.role === "host" ||
  user?.role === "superhost";

  const { data, isLoading } = trpc.privateCertificate.list.useQuery(undefined, {
    enabled: !!isAdmin,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("전체");
  const [paymentFilter, setPaymentFilter] = useState<string>("전체");


  const updateMut = trpc.privateCertificate.update.useMutation({
  onSuccess: async () => {
    await utils.privateCertificate.list.invalidate();
    toast.success("민간자격증 요청이 수정되었습니다.");
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

const patchRow = async (id: number, patch: Record<string, any>) => {
  await updateMut.mutateAsync({
    id,
    ...patch,
  });
};

const normalizeAmountInput = (value: string) => {
  return String(value || "").replace(/[^0-9]/g, "");
};

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
  return filteredRows.filter((row: any) => row.paymentStatus === "결제").length;
}, [filteredRows]);

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          뒤로가기
        </Button>
        <div className="text-sm text-muted-foreground py-10 text-center">
         관리자, 호스트 또는 슈퍼호스트만 접근할 수 있습니다.
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
          <h1 className="text-2xl font-bold tracking-tight">민간자격증 관리</h1>
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
            <p className="text-xs text-muted-foreground">결제완료 건수</p>
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
            <div className="overflow-x-auto rounded-xl border bg-white">
  <table className="w-full min-w-[1500px] text-sm">
    <thead className="bg-slate-50 border-b">
      <tr className="text-left">
        <th className="px-3 py-3 font-medium">학생명</th>
        <th className="px-3 py-3 font-medium">연락처</th>
        <th className="px-3 py-3 font-medium">담당자</th>
        <th className="px-3 py-3 font-medium">자격증</th>
        <th className="px-3 py-3 font-medium">주소</th>
        <th className="px-3 py-3 font-medium">요청일</th>
        <th className="px-3 py-3 font-medium">요청상태</th>
        <th className="px-3 py-3 font-medium">결제상태</th>
        <th className="px-3 py-3 font-medium">금액</th>
        <th className="px-3 py-3 font-medium">입금확인일</th>
        <th className="px-3 py-3 font-medium">메모</th>
        <th className="px-3 py-3 font-medium text-center">관리</th>
      </tr>
    </thead>

    <tbody>
      {!filteredRows.length ? (
        <tr>
          <td colSpan={12} className="px-3 py-10 text-center text-muted-foreground">
            조회된 민간자격증 요청이 없습니다.
          </td>
        </tr>
      ) : (
        filteredRows.map((row: any) => (
          <tr key={`${row.id}-${row.updatedAt || ""}`} className="border-b align-top">
            <td className="px-3 py-3 font-medium">{row.clientName || "-"}</td>
            <td className="px-3 py-3">{formatPhone(row.phone || "") || "-"}</td>
            <td className="px-3 py-3">{row.assigneeName || "-"}</td>
            <td className="px-3 py-3">{row.certificateName || "-"}</td>

            <td className="px-3 py-3 min-w-[220px]">
              <Input
                defaultValue={row.inputAddress || ""}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next === String(row.inputAddress || "").trim()) return;
                  patchRow(Number(row.id), { inputAddress: next || null });
                }}
              />
            </td>

            <td className="px-3 py-3 whitespace-nowrap">
              {formatDate(row.createdAt)}
            </td>

            <td className="px-3 py-3 min-w-[140px]">
              <Select
  value={row.requestStatus || "요청"}
  onValueChange={(value) => {
    if (value === row.requestStatus) return;

    if (value === "완료") {
      patchRow(Number(row.id), {
        requestStatus: value,
        paymentStatus: row.paymentStatus === "결제" ? row.paymentStatus : "결제",
        paidAt: row.paidAt ? formatDate(row.paidAt) : getTodayDateString(),
      });
      return;
    }

    patchRow(Number(row.id), { requestStatus: value });
  }}
>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUEST_STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </td>

            <td className="px-3 py-3 min-w-[140px]">
              <Select
  value={row.paymentStatus || "결제대기"}
  onValueChange={(value) => {
    if (value === row.paymentStatus) return;

    if (value === "결제") {
      patchRow(Number(row.id), {
        paymentStatus: value,
        requestStatus:
          row.requestStatus === "완료" ? "완료" : "입금확인",
        paidAt: row.paidAt ? formatDate(row.paidAt) : getTodayDateString(),
      });
      return;
    }

    if (value === "결제대기") {
      patchRow(Number(row.id), {
        paymentStatus: value,
        requestStatus:
          row.requestStatus === "입금확인" ? "입금대기" : row.requestStatus,
        paidAt: null,
      });
      return;
    }

    if (value === "환불") {
      patchRow(Number(row.id), {
        paymentStatus: value,
        paidAt: row.paidAt ? formatDate(row.paidAt) : null,
      });
      return;
    }

    if (value === "취소") {
      patchRow(Number(row.id), {
        paymentStatus: value,
        requestStatus: "취소",
        paidAt: null,
      });
      return;
    }

    patchRow(Number(row.id), { paymentStatus: value });
  }}
>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </td>

            <td className="px-3 py-3 min-w-[120px]">
              <Input
                defaultValue={row.feeAmount?.toString() || ""}
                inputMode="numeric"
                onBlur={(e) => {
                  const next = normalizeAmountInput(e.target.value);
                  const current = String(row.feeAmount || "").replace(/[^0-9]/g, "");
                  if (next === current) return;
                  patchRow(Number(row.id), { feeAmount: next || "0" });
                }}
              />
            </td>

            <td className="px-3 py-3 min-w-[150px]">
              <Input
  type="date"
  defaultValue={row.paidAt ? formatDate(row.paidAt) : ""}
  onChange={(e) => {
    const next = e.target.value || null;
    const current = row.paidAt ? formatDate(row.paidAt) : "";
    if ((next || "") === current) return;

    patchRow(Number(row.id), {
      paidAt: next,
      paymentStatus: next ? "결제" : row.paymentStatus,
      requestStatus: next
        ? row.requestStatus === "완료"
          ? "완료"
          : "입금확인"
        : row.requestStatus,
    });
  }}
/>
            </td>

            <td className="px-3 py-3 min-w-[240px]">
              <Textarea
                defaultValue={row.note || ""}
                className="min-h-[72px]"
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next === String(row.note || "").trim()) return;
                  patchRow(Number(row.id), { note: next || null });
                }}
              />
            </td>

            <td className="px-3 py-3 text-center">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  const ok = window.confirm("이 민간자격증 요청을 삭제할까요?");
                  if (!ok) return;
                  deleteMut.mutate({ id: Number(row.id) });
                }}
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
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
    </div>
  );
}