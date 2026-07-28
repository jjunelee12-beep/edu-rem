import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Search,
  Plus,
  UserCheck,
} from "lucide-react";
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

type ExternalPrivateCertificateItem = {
  privateCertificateMasterId:
    number |
    null;

  certificateName:
    string;
};

type ExternalPrivateCertificateForm = {
  assigneeId: number | null;
  assigneeLoginId: string;
  assigneeName: string;

  clientName: string;
phone: string;

privateCertificateMasterId:
  number |
  null;

certificateName: string;

inputAddress: string;
  detailAddress: string;

  requestStatus:
    | "요청"
    | "안내완료"
    | "입금대기"
    | "입금확인"
    | "진행중"
    | "완료"
    | "취소";

  paymentStatus:
  | "결제대기"
  | "결제"
  | "환불"
  | "취소";

feeAmount: string;
freelancerInputAmount: string;
paidAt: string;
note: string;
};

function createEmptyExternalPrivateCertificateForm():
  ExternalPrivateCertificateForm {
  return {
    assigneeId: null,
    assigneeLoginId: "",
    assigneeName: "",

    clientName: "",
phone: "",

privateCertificateMasterId:
  null,

certificateName: "",

inputAddress: "",
    detailAddress: "",

    requestStatus: "요청",
paymentStatus: "결제대기",

feeAmount: "0",
freelancerInputAmount: "0",
paidAt: "",
note: "",
  };
}

export default function PrivateCertificateCenterPage() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const isAdmin =
  user?.role === "admin" ||
  user?.role === "host" ||
  user?.role === "superhost";

  const canCreateExternal =
    user?.role === "admin" ||
    user?.role === "host";

  const { data, isLoading } = trpc.privateCertificate.list.useQuery(undefined, {
    enabled: !!isAdmin,
  });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("전체");
  const [paymentFilter, setPaymentFilter] = useState<string>("전체");

  const [createOpen, setCreateOpen] =
  useState(false);

const {
  data:
    privateCertificateMasters = [],

  isLoading:
    isPrivateCertificateMastersLoading,
} =
  trpc.privateCertificateMaster.list.useQuery(
    undefined,
    {
      enabled:
        createOpen &&
        canCreateExternal,

      refetchOnWindowFocus:
        false,
    }
  );

const [assigneeSearchText, setAssigneeSearchText] =
  useState("");

  const [createForm, setCreateForm] =
    useState<ExternalPrivateCertificateForm>(
      createEmptyExternalPrivateCertificateForm
    );

const [
  createCertificateItems,
  setCreateCertificateItems,
] =
  useState<
    ExternalPrivateCertificateItem[]
  >([
   {
  privateCertificateMasterId:
    null,

  certificateName:
    "",
},
  ]);

  const normalizedAssigneeSearch =
    assigneeSearchText.trim();

  const {
    data: assigneeSearchResults = [],
    isFetching: isAssigneeSearching,
  } = trpc.users.searchAssignable.useQuery(
    {
      username:
        normalizedAssigneeSearch,
    },
    {
      enabled:
        createOpen &&
        canCreateExternal &&
        normalizedAssigneeSearch.length >= 2,

      staleTime:
        1000 * 30,

      refetchOnWindowFocus:
        false,
    }
  );

  const createExternalMut =
    trpc.privateCertificate.createExternal.useMutation({

      onError: (e) => {
        toast.error(
          e.message ||
          "민간자격증 신규등록에 실패했습니다."
        );
      },
    });


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

const patchRow = async (
  row: any,
  patch: Record<string, any>
) => {
  const id =
    Number(row?.id || 0);

  if (!id) {
    throw new Error(
      "수정할 민간자격증 요청 ID가 없습니다."
    );
  }

  await updateMut.mutateAsync({
    id,

    sourceType:
      row?.sourceType === "external"
        ? "external"
        : "student",

    ...patch,
  } as any);
};

const normalizeAmountInput = (value: string) => {
  return String(value || "").replace(/[^0-9]/g, "");
};

const openCreateDialog = () => {
  if (!canCreateExternal) {
    toast.error(
      "관리자 또는 호스트만 신규 등록할 수 있습니다."
    );
    return;
  }

  setCreateForm(
    createEmptyExternalPrivateCertificateForm()
  );

  setAssigneeSearchText("");

setCreateCertificateItems([
  {
  privateCertificateMasterId:
    null,

  certificateName:
    "",
},
]);

setCreateOpen(true);
};

const closeCreateDialog = () => {
  if (createExternalMut.isPending) {
    return;
  }

  setCreateOpen(false);
setAssigneeSearchText("");

setCreateCertificateItems([
  {
    privateCertificateMasterId:
      null,

    certificateName:
      "",
  },
]);

setCreateForm(
  createEmptyExternalPrivateCertificateForm()
);
};

const selectAssignee = (row: any) => {
  const assigneeId =
    Number(row?.id || 0);

  if (!assigneeId) {
    toast.error(
      "담당자 정보가 올바르지 않습니다."
    );
    return;
  }

  const loginId =
    String(
      row?.loginId ||
      row?.username ||
      ""
    ).trim();

  const name =
    String(
      row?.name ||
      row?.userName ||
      ""
    ).trim();

  setCreateForm((prev) => ({
    ...prev,

    assigneeId,
    assigneeLoginId:
      loginId,
    assigneeName:
      name,
  }));
};

const selectPrivateCertificateMaster = (
  itemIndex:
    number,

  value:
    string
) => {
  const privateCertificateMasterId =
    Number(
      value
    );

  const selectedMaster =
    (
      Array.isArray(
        privateCertificateMasters
      )
        ? privateCertificateMasters
        : []
    ).find(
      (
        row:
          any
      ) =>
        Number(
          row?.id ||
          0
        ) ===
        privateCertificateMasterId
    );

  if (
    !selectedMaster
  ) {
    return;
  }

  const certificateName =
    String(
      selectedMaster
        ?.certificateName ||
      selectedMaster
        ?.name ||
      ""
    ).trim();

  setCreateCertificateItems(
    (
      prev
    ) =>
      prev.map(
        (
          item,
          index
        ) =>
          index === itemIndex
            ? {
                ...item,

                privateCertificateMasterId,

                certificateName,
              }
            : item
      )
  );
};

const addCreateCertificateItem =
  () => {
    setCreateCertificateItems(
      (
        prev
      ) => [
        ...prev,

        {
          privateCertificateMasterId:
            null,

          certificateName:
            "",
        },
      ]
    );
  };

const removeCreateCertificateItem = (
  itemIndex:
    number
) => {
  setCreateCertificateItems(
    (
      prev
    ) => {
      if (
        prev.length <= 1
      ) {
        toast.error(
          "민간자격증 과정은 한 개 이상 필요합니다."
        );

        return prev;
      }

      return prev.filter(
        (
          _,
          index
        ) =>
          index !== itemIndex
      );
    }
  );
};

const submitExternalRequest = async () => {
  const clientName =
    createForm.clientName.trim();

  const phone =
    createForm.phone.replace(
      /\D/g,
      ""
    );

  if (!createForm.assigneeId) {
    toast.error(
      "담당자를 검색하여 선택해주세요."
    );
    return;
  }

  if (!clientName) {
    toast.error(
      "이름을 입력해주세요."
    );
    return;
  }

  if (
    phone.length < 10 ||
    phone.length > 11
  ) {
    toast.error(
      "올바른 연락처를 입력해주세요."
    );
    return;
  }

if (
  !createCertificateItems
    .length
) {
  toast.error(
    "민간자격증 과정을 추가해주세요."
  );

  return;
}

const invalidCertificateItem =
  createCertificateItems.find(
    (
      item
    ) =>
      !item
        .privateCertificateMasterId ||
      !item
        .certificateName
        .trim()
  );

if (
  invalidCertificateItem
) {
  toast.error(
    "모든 민간자격증 과정을 선택해주세요."
  );

  return;
}

  try {
  for (
    const certificateItem
    of createCertificateItems
  ) {
    await createExternalMut.mutateAsync({
      assigneeId:
        createForm.assigneeId,

      clientName,
      phone,

      privateCertificateMasterId:
        certificateItem
          .privateCertificateMasterId!,

      certificateName:
        certificateItem
          .certificateName
          .trim(),

      inputAddress:
        createForm
          .inputAddress
          .trim() ||
        null,

      detailAddress:
        createForm
          .detailAddress
          .trim() ||
        null,

      requestStatus:
        createForm
          .requestStatus,

      paymentStatus:
        createForm
          .paymentStatus,

      feeAmount:
  normalizeAmountInput(
    createForm
      .feeAmount
  ) ||
  "0",

      freelancerInputAmount:
        normalizeAmountInput(
          createForm
            .freelancerInputAmount
        ) ||
        "0",

      paidAt:
        createForm
          .paidAt ||
        null,

      note:
        createForm
          .note
          .trim() ||
        null,
    });
  }

  await utils
    .privateCertificate
    .list
    .invalidate();

  toast.success(
    `민간자격증 ${createCertificateItems.length}건이 신규 등록되었습니다.`
  );

  setCreateOpen(false);
  setAssigneeSearchText("");

  setCreateCertificateItems([
    {
      privateCertificateMasterId:
        null,

      certificateName:
        "",
    },
  ]);

  setCreateForm(
    createEmptyExternalPrivateCertificateForm()
  );
} catch {
  return;
}
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
            <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() =>
            setLocation("/")
          }
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight">
            민간자격증 관리
          </h1>

          <p className="mt-0.5 text-sm text-muted-foreground">
            민간자격증 요청, 입금 확인, 진행 상태를 관리합니다.
          </p>
        </div>

        {canCreateExternal && (
          <Button
            type="button"
            onClick={openCreateDialog}
          >
            <Plus className="mr-2 h-4 w-4" />
            신규 등록
          </Button>
        )}
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
          <tr
  key={`${
    row.sourceType === "external"
      ? "external"
      : "student"
  }-${row.id}-${row.updatedAt || ""}`}
  className="border-b align-top"
>
            <td className="px-3 py-3 font-medium">
  <div className="flex items-center gap-2">
    <span>
      {row.clientName || "-"}
    </span>

    {row.sourceType === "external" && (
      <span className="whitespace-nowrap rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
        직접등록
      </span>
    )}
  </div>
</td>
            <td className="px-3 py-3">{formatPhone(row.phone || "") || "-"}</td>
            <td className="px-3 py-3">{row.assigneeName || "-"}</td>
            <td className="px-3 py-3">{row.certificateName || "-"}</td>

            <td className="px-3 py-3 min-w-[220px]">
              <Input
                defaultValue={row.inputAddress || ""}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (next === String(row.inputAddress || "").trim()) return;
                  patchRow(row, { inputAddress: next || null });
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
      patchRow(row, {
        requestStatus: value,
        paymentStatus: row.paymentStatus === "결제" ? row.paymentStatus : "결제",
        paidAt: row.paidAt ? formatDate(row.paidAt) : getTodayDateString(),
      });
      return;
    }

    patchRow(row, { requestStatus: value });
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
      patchRow(row, {
        paymentStatus: value,
        requestStatus:
          row.requestStatus === "완료" ? "완료" : "입금확인",
        paidAt: row.paidAt ? formatDate(row.paidAt) : getTodayDateString(),
      });
      return;
    }

    if (value === "결제대기") {
      patchRow(row, {
        paymentStatus: value,
        requestStatus:
          row.requestStatus === "입금확인" ? "입금대기" : row.requestStatus,
        paidAt: null,
      });
      return;
    }

    if (value === "환불") {
      patchRow(row, {
        paymentStatus: value,
        paidAt: row.paidAt ? formatDate(row.paidAt) : null,
      });
      return;
    }

    if (value === "취소") {
      patchRow(row, {
        paymentStatus: value,
        requestStatus: "취소",
        paidAt: null,
      });
      return;
    }

    patchRow(row, { paymentStatus: value });
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
                  patchRow(row, { feeAmount: next || "0" });
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

    patchRow(row, {
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
                  patchRow(row, { note: next || null });
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
                  deleteMut.mutate({
  id:
    Number(row.id),

  sourceType:
    row.sourceType === "external"
      ? "external"
      : "student",
});
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

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (open) {
            setCreateOpen(true);
            return;
          }

          closeCreateDialog();
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              민간자격증 신규 등록
            </DialogTitle>

            <DialogDescription>
              학생관리와 연결되지 않은 민간자격증 요청을 직접 등록합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <div className="space-y-3 rounded-xl border bg-slate-50 p-4">
              <div>
                <p className="text-sm font-semibold">
                  담당자 선택
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
  담당자의 로그인 아이디를 2자 이상 입력한 후 선택해주세요.
</p>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <Input
                  className="pl-9"
                  value={assigneeSearchText}
                  placeholder="로그인 아이디 입력"
                  onChange={(e) => {
                    setAssigneeSearchText(
                      e.target.value
                    );
                  }}
                />
              </div>

              {normalizedAssigneeSearch.length > 0 &&
                normalizedAssigneeSearch.length < 2 && (
                  <p className="text-xs text-muted-foreground">
                    두 글자 이상 입력해주세요.
                  </p>
                )}

              {isAssigneeSearching && (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  담당자를 검색하고 있습니다.
                </div>
              )}

              {normalizedAssigneeSearch.length >= 2 &&
                !isAssigneeSearching && (
                  <div className="max-h-48 space-y-2 overflow-y-auto">
                    {!assigneeSearchResults.length ? (
                      <div className="rounded-lg border border-dashed bg-white p-4 text-center text-sm text-muted-foreground">
                        검색된 담당자가 없습니다.
                      </div>
                    ) : (
                      assigneeSearchResults.map(
                        (assignee: any) => {
                          const loginId =
                            String(
                              assignee.loginId ||
                              assignee.username ||
                              ""
                            );

                          const name =
                            String(
                              assignee.name ||
                              assignee.userName ||
                              ""
                            );

                          const selected =
                            Number(
                              createForm.assigneeId ||
                              0
                            ) ===
                            Number(
                              assignee.id ||
                              0
                            );

                          return (
                            <button
                              key={assignee.id}
                              type="button"
                              className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition ${
                                selected
                                  ? "border-blue-400 bg-blue-50"
                                  : "bg-white hover:bg-slate-50"
                              }`}
                              onClick={() =>
                                selectAssignee(
                                  assignee
                                )
                              }
                            >
                              <div className="min-w-0">
  <p className="truncate text-sm font-semibold">
    {name
      ? `${name}(${loginId || "-"})`
      : loginId || "-"}
  </p>

  <p className="mt-1 text-xs text-muted-foreground">
    {assignee.role === "staff"
      ? "담당자"
      : assignee.role === "admin"
        ? "관리자"
        : assignee.role === "host"
          ? "호스트"
          : assignee.role || "-"}
  </p>
</div>

                              <span className="ml-3 text-xs font-medium text-blue-700">
                                {selected
                                  ? "선택됨"
                                  : "선택"}
                              </span>
                            </button>
                          );
                        }
                      )
                    )}
                  </div>
                )}

              {createForm.assigneeId && (
                <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                  <UserCheck className="h-5 w-5 text-emerald-700" />

                  <div>
  <p className="text-sm font-semibold text-emerald-800">
    {createForm.assigneeName
      ? `${createForm.assigneeName}(${createForm.assigneeLoginId || "-"})`
      : createForm.assigneeLoginId || "담당자 선택 완료"}
  </p>

  <p className="text-xs text-emerald-700">
    선택된 담당자
  </p>
</div>
                </div>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  이름
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <Input
                  value={createForm.clientName}
                  placeholder="회원 이름"
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      clientName:
                        e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  연락처
                  <span className="ml-1 text-red-500">
                    *
                  </span>
                </label>

                <Input
                  value={createForm.phone}
                  placeholder="010-0000-0000"
                  inputMode="numeric"
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,

                      phone:
                        e.target.value
                          .replace(
                            /[^0-9-]/g,
                            ""
                          )
                          .slice(0, 13),
                    }))
                  }
                />
              </div>

              <div className="space-y-3 md:col-span-2">
  <div className="flex items-center justify-between gap-3">
    <div>
      <label className="text-sm font-medium">
        자격증 과정
        <span className="ml-1 text-red-500">
          *
        </span>
      </label>

      <p className="mt-1 text-xs text-muted-foreground">
  신청할 자격증 과정을 추가해주세요.
</p>
    </div>

    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={
        addCreateCertificateItem
      }
    >
      <Plus className="mr-1 h-4 w-4" />
      자격증 추가
    </Button>
  </div>

  <div className="space-y-3">
    {createCertificateItems.map(
      (
        certificateItem,
        itemIndex
      ) => (
        <div
          key={
            itemIndex
          }
          className="grid gap-3 rounded-xl border bg-slate-50 p-3 md:grid-cols-[1fr_40px]"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              자격증명
            </label>

            <Select
              value={
                certificateItem
                  .privateCertificateMasterId
                  ? String(
                      certificateItem
                        .privateCertificateMasterId
                    )
                  : ""
              }
              onValueChange={
                (
                  value
                ) =>
                  selectPrivateCertificateMaster(
                    itemIndex,
                    value
                  )
              }
              disabled={
                isPrivateCertificateMastersLoading
              }
            >
              <SelectTrigger className="bg-white">
                <SelectValue
                  placeholder={
                    isPrivateCertificateMastersLoading
                      ? "불러오는 중"
                      : "민간자격증 과정 선택"
                  }
                />
              </SelectTrigger>

              <SelectContent>
                {(
                  Array.isArray(
                    privateCertificateMasters
                  )
                    ? privateCertificateMasters
                    : []
                ).map(
                  (
                    master:
                      any
                  ) => {
                    const certificateName =
                      String(
                        master
                          ?.certificateName ||
                        master
                          ?.name ||
                        `민간자격증 #${master.id}`
                      ).trim();

                    return (
                      <SelectItem
                        key={
                          Number(
                            master.id
                          )
                        }
                        value={
                          String(
                            master.id
                          )
                        }
                      >
                        {certificateName}
                      </SelectItem>
                    );
                  }
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={
                createCertificateItems
                  .length <= 1
              }
              onClick={
                () =>
                  removeCreateCertificateItem(
                    itemIndex
                  )
              }
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </div>
      )
    )}
  </div>
</div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  주소
                </label>

                <Input
                  value={createForm.inputAddress}
                  placeholder="기본 주소"
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      inputAddress:
                        e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  상세주소
                </label>

                <Input
                  value={createForm.detailAddress}
                  placeholder="상세주소"
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      detailAddress:
                        e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  요청상태
                </label>

                <Select
                  value={createForm.requestStatus}
                  onValueChange={(value) =>
                    setCreateForm((prev) => ({
                      ...prev,

                      requestStatus:
                        value as ExternalPrivateCertificateForm["requestStatus"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {REQUEST_STATUS_OPTIONS.map(
                      (status) => (
                        <SelectItem
                          key={status}
                          value={status}
                        >
                          {status}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  결제상태
                </label>

                <Select
                  value={createForm.paymentStatus}
                  onValueChange={(value) =>
                    setCreateForm((prev) => ({
                      ...prev,

                      paymentStatus:
                        value as ExternalPrivateCertificateForm["paymentStatus"],
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    {PAYMENT_STATUS_OPTIONS.map(
                      (status) => (
                        <SelectItem
                          key={status}
                          value={status}
                        >
                          {status}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  금액
                </label>

                <Input
                  value={createForm.feeAmount}
                  inputMode="numeric"
                  placeholder="0"
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,

                      feeAmount:
                        normalizeAmountInput(
                          e.target.value
                        ),
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  입금확인일
                </label>

                <Input
                  type="date"
                  value={createForm.paidAt}
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,

                      paidAt:
                        e.target.value,

                      paymentStatus:
                        e.target.value
                          ? "결제"
                          : prev.paymentStatus,
                    }))
                  }
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium">
                  메모
                </label>

                <Textarea
                  className="min-h-28"
                  value={createForm.note}
                  placeholder="요청 관련 메모"
                  onChange={(e) =>
                    setCreateForm((prev) => ({
                      ...prev,
                      note:
                        e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={
                createExternalMut.isPending
              }
              onClick={closeCreateDialog}
            >
              취소
            </Button>

            <Button
              type="button"
              disabled={
                createExternalMut.isPending
              }
              onClick={
                submitExternalRequest
              }
            >
              {createExternalMut.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}

              신규 등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}