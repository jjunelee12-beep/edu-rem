import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { formatPhone } from "@/lib/format";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Briefcase, Search, MapPin, Phone, User2 } from "lucide-react";

type JobSupportStatus =
  | "요청"
  | "진행중"
  | "면접안내"
  | "완료"
  | "보류"
  | "취소";

type PaymentStatus = "결제대기" | "입금확인" | "완료" | "취소";

export default function JobSupportCenter() {
  const { user } = useAuth();
  const isAdmin =
  user?.role === "admin" ||
  user?.role === "host" ||
  user?.role === "superhost";
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("전체");
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [finderOpen, setFinderOpen] = useState(false);
  const [finderAddress, setFinderAddress] = useState("");
  const [finderDesiredArea, setFinderDesiredArea] = useState("");
  const [finderIncludeWelfare, setFinderIncludeWelfare] = useState(true);
  const [finderIncludeCare, setFinderIncludeCare] = useState(true);
  const [finderIncludeEtc, setFinderIncludeEtc] = useState(false);

  const { data: jobSupportList, isLoading } = trpc.jobSupport.list.useQuery();

  const updateJobSupportMut = trpc.jobSupport.update.useMutation({
    onSuccess: async () => {
      await utils.jobSupport.list.invalidate();
      toast.success("취업지원센터 정보가 수정되었습니다.");
    },
    onError: (e) => toast.error(e.message),
  });

  const filteredList = useMemo(() => {
    const keyword = search.trim();

    return (jobSupportList || []).filter((row: any) => {
      const matchKeyword =
        !keyword ||
        String(row.clientName || "").includes(keyword) ||
        String(row.phone || "").includes(keyword) ||
        String(row.assigneeName || "").includes(keyword) ||
        String(row.inputAddress || "").includes(keyword) ||
        String(row.desiredArea || "").includes(keyword) ||
        String(row.selectedInstitutionName || "").includes(keyword);

      const matchStatus =
        statusFilter === "전체" || String(row.supportStatus || "요청") === statusFilter;

      return matchKeyword && matchStatus;
    });
  }, [jobSupportList, search, statusFilter]);

  const getStatusBadgeClass = (status?: string) => {
    switch (status) {
      case "완료":
        return "bg-emerald-100 text-emerald-700 border border-emerald-200";
      case "면접안내":
        return "bg-blue-100 text-blue-700 border border-blue-200";
      case "진행중":
        return "bg-violet-100 text-violet-700 border border-violet-200";
      case "보류":
        return "bg-amber-100 text-amber-700 border border-amber-200";
      case "취소":
        return "bg-red-100 text-red-700 border border-red-200";
      default:
        return "bg-gray-100 text-gray-700 border border-gray-200";
    }
  };

  const getPaymentBadgeClass = (status?: string) => {
    switch (status) {
      case "완료":
        return "bg-emerald-100 text-emerald-700 border border-emerald-200";
      case "입금확인":
        return "bg-blue-100 text-blue-700 border border-blue-200";
      case "취소":
        return "bg-red-100 text-red-700 border border-red-200";
      default:
        return "bg-gray-100 text-gray-700 border border-gray-200";
    }
  };

  const openDetail = (row: any) => {
    setSelectedRow({
      ...row,
      supportStatus: row.supportStatus || "요청",
      paymentStatus: row.paymentStatus || "결제대기",
      inputAddress: row.inputAddress || "",
      desiredArea: row.desiredArea || "",
      selectedInstitutionName: row.selectedInstitutionName || "",
      selectedInstitutionAddress: row.selectedInstitutionAddress || "",
      selectedInstitutionDistanceKm:
        row.selectedInstitutionDistanceKm?.toString?.() ||
        row.selectedInstitutionDistanceKm ||
        "",
      feeAmount: row.feeAmount?.toString?.() || row.feeAmount || "0",
      note: row.note || "",
    });
    setDetailOpen(true);
  };

  const saveDetail = () => {
    if (!selectedRow?.id) return;

    updateJobSupportMut.mutate({
      id: selectedRow.id,
      inputAddress: selectedRow.inputAddress || undefined,
      desiredArea: selectedRow.desiredArea || undefined,
      supportStatus: selectedRow.supportStatus as JobSupportStatus,
      selectedInstitutionName: selectedRow.selectedInstitutionName || undefined,
      selectedInstitutionAddress: selectedRow.selectedInstitutionAddress || undefined,
      selectedInstitutionDistanceKm:
        selectedRow.selectedInstitutionDistanceKm || undefined,
      feeAmount: selectedRow.feeAmount || undefined,
      paymentStatus: selectedRow.paymentStatus as PaymentStatus,
      note: selectedRow.note || undefined,
    } as any);
  };

  const handleQuickStatusChange = (id: number, nextStatus: JobSupportStatus) => {
    updateJobSupportMut.mutate({
      id,
      supportStatus: nextStatus,
    } as any);
  };

  const handleQuickPaymentChange = (id: number, nextStatus: PaymentStatus) => {
    updateJobSupportMut.mutate({
      id,
      paymentStatus: nextStatus,
    } as any);
  };

  const handleFinderSearch = () => {
    toast.message(
      "취업찾기 기능은 지도 API / 기관 DB 연결 후 거리순 검색으로 붙이면 됩니다."
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">취업지원센터</h1>
          <p className="text-sm text-muted-foreground mt-1">
            취업 요청 학생을 상태별로 관리하고, 취업처 정보를 정리하는 페이지입니다.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="이름 / 연락처 / 담당자 / 주소 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[260px]"
          />

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="상태 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="전체">전체 상태</SelectItem>
              <SelectItem value="요청">요청</SelectItem>
              <SelectItem value="진행중">진행중</SelectItem>
              <SelectItem value="면접안내">면접안내</SelectItem>
              <SelectItem value="완료">완료</SelectItem>
              <SelectItem value="보류">보류</SelectItem>
              <SelectItem value="취소">취소</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => setFinderOpen(true)} className="gap-2">
            <Search className="h-4 w-4" />
            취업찾기
          </Button>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            요청 리스트 ({filteredList.length}건)
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-10 text-center">
              불러오는 중...
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-sm text-muted-foreground py-10 text-center">
              조회된 취업지원 요청이 없습니다.
            </div>
          ) : (
            filteredList.map((row: any) => (
              <div
                key={row.id}
                className="rounded-xl border bg-white p-4 hover:bg-muted/20 transition-colors"
              >
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-2 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-base">
                        {row.clientName || "-"}
                      </span>

                      <Badge className={getStatusBadgeClass(row.supportStatus)}>
                        {row.supportStatus || "요청"}
                      </Badge>

                      <Badge className={getPaymentBadgeClass(row.paymentStatus)}>
                        {row.paymentStatus || "결제대기"}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        {formatPhone(row.phone || "") || "-"}
                      </span>

                      <span className="inline-flex items-center gap-1">
                        <User2 className="h-3.5 w-3.5" />
                        담당자: {row.assigneeName || "-"}
                      </span>

                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        주소: {row.inputAddress || "-"}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span>
                        희망지역:{" "}
                        <span className="font-medium">
                          {row.desiredArea || "-"}
                        </span>
                      </span>
                      <span>
                        기관:{" "}
                        <span className="font-medium">
                          {row.selectedInstitutionName || "-"}
                        </span>
                      </span>
                      <span>
                        거리:{" "}
                        <span className="font-medium">
                          {row.selectedInstitutionDistanceKm
                            ? `${row.selectedInstitutionDistanceKm}km`
                            : "-"}
                        </span>
                      </span>
                    </div>

                    {row.note && (
                      <div className="text-sm text-muted-foreground rounded-lg bg-muted/40 px-3 py-2">
                        {row.note}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 w-full xl:w-[260px]">
                    <Select
                      value={row.supportStatus || "요청"}
                      onValueChange={(v) =>
                        handleQuickStatusChange(row.id, v as JobSupportStatus)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="진행상태" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="요청">요청</SelectItem>
                        <SelectItem value="진행중">진행중</SelectItem>
                        <SelectItem value="면접안내">면접안내</SelectItem>
                        <SelectItem value="완료">완료</SelectItem>
                        <SelectItem value="보류">보류</SelectItem>
                        <SelectItem value="취소">취소</SelectItem>
                      </SelectContent>
                    </Select>

                    {isAdmin && (
                      <Select
                        value={row.paymentStatus || "결제대기"}
                        onValueChange={(v) =>
                          handleQuickPaymentChange(row.id, v as PaymentStatus)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="결제상태" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="결제대기">결제대기</SelectItem>
                          <SelectItem value="입금확인">입금확인</SelectItem>
                          <SelectItem value="완료">완료</SelectItem>
                          <SelectItem value="취소">취소</SelectItem>
                        </SelectContent>
                      </Select>
                    )}

                    <Button
                      variant="outline"
                      onClick={() => openDetail(row)}
                      className="gap-2"
                    >
                      <Briefcase className="h-4 w-4" />
                      상세 / 수정
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>취업지원 상세 정보</DialogTitle>
          </DialogHeader>

          {selectedRow && (
            <div className="grid gap-4 py-2">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">이름</Label>
                  <Input value={selectedRow.clientName || ""} disabled />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">연락처</Label>
                  <Input value={formatPhone(selectedRow.phone || "")} disabled />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">담당자명</Label>
                  <Input value={selectedRow.assigneeName || ""} disabled />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">상태</Label>
                  <Select
                    value={selectedRow.supportStatus || "요청"}
                    onValueChange={(v) =>
                      setSelectedRow((prev: any) => ({
                        ...prev,
                        supportStatus: v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="요청">요청</SelectItem>
                      <SelectItem value="진행중">진행중</SelectItem>
                      <SelectItem value="면접안내">면접안내</SelectItem>
                      <SelectItem value="완료">완료</SelectItem>
                      <SelectItem value="보류">보류</SelectItem>
                      <SelectItem value="취소">취소</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">주소</Label>
                  <Input
                    value={selectedRow.inputAddress || ""}
                    onChange={(e) =>
                      setSelectedRow((prev: any) => ({
                        ...prev,
                        inputAddress: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">희망지역</Label>
                  <Input
                    value={selectedRow.desiredArea || ""}
                    onChange={(e) =>
                      setSelectedRow((prev: any) => ({
                        ...prev,
                        desiredArea: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">추천 기관명</Label>
                  <Input
                    value={selectedRow.selectedInstitutionName || ""}
                    onChange={(e) =>
                      setSelectedRow((prev: any) => ({
                        ...prev,
                        selectedInstitutionName: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">추천 기관 주소</Label>
                  <Input
                    value={selectedRow.selectedInstitutionAddress || ""}
                    onChange={(e) =>
                      setSelectedRow((prev: any) => ({
                        ...prev,
                        selectedInstitutionAddress: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">거리(km)</Label>
                  <Input
                    value={selectedRow.selectedInstitutionDistanceKm || ""}
                    onChange={(e) =>
                      setSelectedRow((prev: any) => ({
                        ...prev,
                        selectedInstitutionDistanceKm: e.target.value.replace(
                          /[^0-9.]/g,
                          ""
                        ),
                      }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">금액</Label>
                  <Input
                    value={selectedRow.feeAmount || ""}
                    onChange={(e) =>
                      setSelectedRow((prev: any) => ({
                        ...prev,
                        feeAmount: e.target.value.replace(/[^0-9]/g, ""),
                      }))
                    }
                  />
                </div>

                {isAdmin && (
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs">결제상태</Label>
                    <Select
                      value={selectedRow.paymentStatus || "결제대기"}
                      onValueChange={(v) =>
                        setSelectedRow((prev: any) => ({
                          ...prev,
                          paymentStatus: v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="결제대기">결제대기</SelectItem>
                        <SelectItem value="입금확인">입금확인</SelectItem>
                        <SelectItem value="완료">완료</SelectItem>
                        <SelectItem value="취소">취소</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">메모</Label>
                  <Textarea
                    rows={4}
                    value={selectedRow.note || ""}
                    onChange={(e) =>
                      setSelectedRow((prev: any) => ({
                        ...prev,
                        note: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailOpen(false)}>
              닫기
            </Button>
            <Button onClick={saveDetail} disabled={updateJobSupportMut.isPending}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={finderOpen} onOpenChange={setFinderOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>취업찾기</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs">주소 입력</Label>
              <Input
                placeholder="예: 서울 도봉구 방학동 ..."
                value={finderAddress}
                onChange={(e) => setFinderAddress(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">희망 지역</Label>
              <Input
                placeholder="예: 도봉구 / 노원구 / 강북구"
                value={finderDesiredArea}
                onChange={(e) => setFinderDesiredArea(e.target.value)}
              />
            </div>

            <div className="flex gap-3 flex-wrap">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={finderIncludeWelfare}
                  onChange={(e) => setFinderIncludeWelfare(e.target.checked)}
                />
                복지관
              </label>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={finderIncludeCare}
                  onChange={(e) => setFinderIncludeCare(e.target.checked)}
                />
                어린이집/보육기관
              </label>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={finderIncludeEtc}
                  onChange={(e) => setFinderIncludeEtc(e.target.checked)}
                />
                기타기관
              </label>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              현재 이 모달은 UI만 먼저 잡아둔 상태입니다.
              <br />
              다음 단계에서 지도 API + 기관 DB를 연결하면
              주소 기준 가까운 기관 순으로 결과 리스트를 띄울 수 있습니다.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFinderOpen(false)}>
              닫기
            </Button>
            <Button onClick={handleFinderSearch}>취업처 찾기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}