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
import { MapPin, Phone, Search, User2, School } from "lucide-react";

type PracticeCoordinationStatus = "미섭외" | "섭외중" | "섭외완료" | "보류";
type PracticeRequestStatus = "요청" | "진행중" | "완료" | "취소";
type PaymentStatus = "결제대기" | "입금확인" | "완료" | "취소";

export default function PracticeSupportCenter() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "host";
  const utils = trpc.useUtils();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("전체");
  const [selectedRow, setSelectedRow] = useState<any | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const [finderOpen, setFinderOpen] = useState(false);
  const [finderAddress, setFinderAddress] = useState("");
  const [finderIncludeEducationCenter, setFinderIncludeEducationCenter] = useState(true);
  const [finderIncludePracticeInstitution, setFinderIncludePracticeInstitution] =
    useState(true);

  const { data: practiceSupportList, isLoading } =
    trpc.practiceSupport.list.useQuery();

  const updatePracticeSupportMut = trpc.practiceSupport.update.useMutation({
    onSuccess: async () => {
      await utils.practiceSupport.list.invalidate();
      toast.success("실습배정지원센터 정보가 수정되었습니다.");
    },
    onError: (e) => toast.error(e.message),
  });

  const filteredList = useMemo(() => {
    const keyword = search.trim();

    return (practiceSupportList || []).filter((row: any) => {
      const matchKeyword =
        !keyword ||
        String(row.clientName || "").includes(keyword) ||
        String(row.phone || "").includes(keyword) ||
        String(row.assigneeName || "").includes(keyword) ||
        String(row.course || "").includes(keyword) ||
        String(row.inputAddress || "").includes(keyword) ||
        String(row.selectedEducationCenterName || "").includes(keyword) ||
        String(row.selectedPracticeInstitutionName || "").includes(keyword);

      const matchStatus =
        statusFilter === "전체" ||
        String(row.coordinationStatus || "미섭외") === statusFilter;

      return matchKeyword && matchStatus;
    });
  }, [practiceSupportList, search, statusFilter]);

  const getCoordinationBadgeClass = (status?: string) => {
    switch (status) {
      case "섭외완료":
        return "bg-emerald-100 text-emerald-700 border border-emerald-200";
      case "섭외중":
        return "bg-blue-100 text-blue-700 border border-blue-200";
      case "보류":
        return "bg-amber-100 text-amber-700 border border-amber-200";
      default:
        return "bg-gray-100 text-gray-700 border border-gray-200";
    }
  };

  const getRequestBadgeClass = (status?: string) => {
    switch (status) {
      case "완료":
        return "bg-emerald-100 text-emerald-700 border border-emerald-200";
      case "진행중":
        return "bg-violet-100 text-violet-700 border border-violet-200";
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
      coordinationStatus: row.coordinationStatus || "미섭외",
      requestStatus: row.requestStatus || "요청",
      paymentStatus: row.paymentStatus || "결제대기",
      inputAddress: row.inputAddress || "",
      selectedEducationCenterName: row.selectedEducationCenterName || "",
      selectedEducationCenterAddress: row.selectedEducationCenterAddress || "",
      selectedEducationCenterDistanceKm:
        row.selectedEducationCenterDistanceKm?.toString?.() ||
        row.selectedEducationCenterDistanceKm ||
        "",
      selectedPracticeInstitutionName: row.selectedPracticeInstitutionName || "",
      selectedPracticeInstitutionAddress:
        row.selectedPracticeInstitutionAddress || "",
      selectedPracticeInstitutionDistanceKm:
        row.selectedPracticeInstitutionDistanceKm?.toString?.() ||
        row.selectedPracticeInstitutionDistanceKm ||
        "",
      feeAmount: row.feeAmount?.toString?.() || row.feeAmount || "0",
      note: row.note || "",
    });
    setDetailOpen(true);
  };

  const saveDetail = () => {
    if (!selectedRow?.id) return;

    updatePracticeSupportMut.mutate({
      id: selectedRow.id,
      inputAddress: selectedRow.inputAddress || undefined,
      coordinationStatus:
        selectedRow.coordinationStatus as PracticeCoordinationStatus,
      requestStatus: selectedRow.requestStatus as PracticeRequestStatus,
      selectedEducationCenterName:
        selectedRow.selectedEducationCenterName || undefined,
      selectedEducationCenterAddress:
        selectedRow.selectedEducationCenterAddress || undefined,
      selectedEducationCenterDistanceKm:
        selectedRow.selectedEducationCenterDistanceKm || undefined,
      selectedPracticeInstitutionName:
        selectedRow.selectedPracticeInstitutionName || undefined,
      selectedPracticeInstitutionAddress:
        selectedRow.selectedPracticeInstitutionAddress || undefined,
      selectedPracticeInstitutionDistanceKm:
        selectedRow.selectedPracticeInstitutionDistanceKm || undefined,
      feeAmount: selectedRow.feeAmount || undefined,
      paymentStatus: selectedRow.paymentStatus as PaymentStatus,
      note: selectedRow.note || undefined,
    } as any);
  };

  const handleQuickCoordinationChange = (
    id: number,
    nextStatus: PracticeCoordinationStatus
  ) => {
    updatePracticeSupportMut.mutate({
      id,
      coordinationStatus: nextStatus,
    } as any);
  };

  const handleQuickRequestChange = (
    id: number,
    nextStatus: PracticeRequestStatus
  ) => {
    updatePracticeSupportMut.mutate({
      id,
      requestStatus: nextStatus,
    } as any);
  };

  const handleQuickPaymentChange = (id: number, nextStatus: PaymentStatus) => {
    updatePracticeSupportMut.mutate({
      id,
      paymentStatus: nextStatus,
    } as any);
  };

  const handleFinderSearch = () => {
    toast.message(
      "실습찾기 기능은 지도 API + 기관 DB 연결 후 주소 기준 거리순 검색으로 붙이면 됩니다."
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">실습배정지원센터</h1>
          <p className="text-sm text-muted-foreground mt-1">
            실습 요청 학생을 깔끔한 리스트형으로 보고, 상태와 배정 정보를 관리합니다.
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
              <SelectItem value="미섭외">미섭외</SelectItem>
              <SelectItem value="섭외중">섭외중</SelectItem>
              <SelectItem value="섭외완료">섭외완료</SelectItem>
              <SelectItem value="보류">보류</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => setFinderOpen(true)} className="gap-2">
            <Search className="h-4 w-4" />
            실습찾기
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
              조회된 실습배정 요청이 없습니다.
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

                      <Badge className={getCoordinationBadgeClass(row.coordinationStatus)}>
                        {row.coordinationStatus || "미섭외"}
                      </Badge>

                      <Badge className={getRequestBadgeClass(row.requestStatus)}>
                        {row.requestStatus || "요청"}
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
                        과정: <span className="font-medium">{row.course || "-"}</span>
                      </span>
                      <span>
                        실습교육원:{" "}
                        <span className="font-medium">
                          {row.selectedEducationCenterName || "-"}
                        </span>
                      </span>
                      <span>
                        실습기관:{" "}
                        <span className="font-medium">
                          {row.selectedPracticeInstitutionName || "-"}
                        </span>
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span>
                        교육원 거리:{" "}
                        <span className="font-medium">
                          {row.selectedEducationCenterDistanceKm
                            ? `${row.selectedEducationCenterDistanceKm}km`
                            : "-"}
                        </span>
                      </span>
                      <span>
                        기관 거리:{" "}
                        <span className="font-medium">
                          {row.selectedPracticeInstitutionDistanceKm
                            ? `${row.selectedPracticeInstitutionDistanceKm}km`
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

                  <div className="flex flex-col gap-2 w-full xl:w-[280px]">
                    <Select
                      value={row.coordinationStatus || "미섭외"}
                      onValueChange={(v) =>
                        handleQuickCoordinationChange(
                          row.id,
                          v as PracticeCoordinationStatus
                        )
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="섭외상태" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="미섭외">미섭외</SelectItem>
                        <SelectItem value="섭외중">섭외중</SelectItem>
                        <SelectItem value="섭외완료">섭외완료</SelectItem>
                        <SelectItem value="보류">보류</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select
                      value={row.requestStatus || "요청"}
                      onValueChange={(v) =>
                        handleQuickRequestChange(row.id, v as PracticeRequestStatus)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="진행상태" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="요청">요청</SelectItem>
                        <SelectItem value="진행중">진행중</SelectItem>
                        <SelectItem value="완료">완료</SelectItem>
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
                      <School className="h-4 w-4" />
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>실습배정 상세 정보</DialogTitle>
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
                  <Label className="text-xs">과정</Label>
                  <Input value={selectedRow.course || ""} disabled />
                </div>

                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">입력 주소</Label>
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
                  <Label className="text-xs">섭외 상태</Label>
                  <Select
                    value={selectedRow.coordinationStatus || "미섭외"}
                    onValueChange={(v) =>
                      setSelectedRow((prev: any) => ({
                        ...prev,
                        coordinationStatus: v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="미섭외">미섭외</SelectItem>
                      <SelectItem value="섭외중">섭외중</SelectItem>
                      <SelectItem value="섭외완료">섭외완료</SelectItem>
                      <SelectItem value="보류">보류</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">진행 상태</Label>
                  <Select
                    value={selectedRow.requestStatus || "요청"}
                    onValueChange={(v) =>
                      setSelectedRow((prev: any) => ({
                        ...prev,
                        requestStatus: v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="요청">요청</SelectItem>
                      <SelectItem value="진행중">진행중</SelectItem>
                      <SelectItem value="완료">완료</SelectItem>
                      <SelectItem value="취소">취소</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">실습교육원명</Label>
                  <Input
                    value={selectedRow.selectedEducationCenterName || ""}
                    onChange={(e) =>
                      setSelectedRow((prev: any) => ({
                        ...prev,
                        selectedEducationCenterName: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">실습교육원 주소</Label>
                  <Input
                    value={selectedRow.selectedEducationCenterAddress || ""}
                    onChange={(e) =>
                      setSelectedRow((prev: any) => ({
                        ...prev,
                        selectedEducationCenterAddress: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">실습교육원 거리(km)</Label>
                  <Input
                    value={selectedRow.selectedEducationCenterDistanceKm || ""}
                    onChange={(e) =>
                      setSelectedRow((prev: any) => ({
                        ...prev,
                        selectedEducationCenterDistanceKm: e.target.value.replace(
                          /[^0-9.]/g,
                          ""
                        ),
                      }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">실습기관명</Label>
                  <Input
                    value={selectedRow.selectedPracticeInstitutionName || ""}
                    onChange={(e) =>
                      setSelectedRow((prev: any) => ({
                        ...prev,
                        selectedPracticeInstitutionName: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">실습기관 주소</Label>
                  <Input
                    value={selectedRow.selectedPracticeInstitutionAddress || ""}
                    onChange={(e) =>
                      setSelectedRow((prev: any) => ({
                        ...prev,
                        selectedPracticeInstitutionAddress: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">실습기관 거리(km)</Label>
                  <Input
                    value={selectedRow.selectedPracticeInstitutionDistanceKm || ""}
                    onChange={(e) =>
                      setSelectedRow((prev: any) => ({
                        ...prev,
                        selectedPracticeInstitutionDistanceKm: e.target.value.replace(
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
            <Button onClick={saveDetail} disabled={updatePracticeSupportMut.isPending}>
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={finderOpen} onOpenChange={setFinderOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>실습찾기</DialogTitle>
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

            <div className="flex gap-3 flex-wrap">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={finderIncludeEducationCenter}
                  onChange={(e) => setFinderIncludeEducationCenter(e.target.checked)}
                />
                실습교육원
              </label>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={finderIncludePracticeInstitution}
                  onChange={(e) =>
                    setFinderIncludePracticeInstitution(e.target.checked)
                  }
                />
                실습기관
              </label>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              현재 이 기능은 UI 먼저 구성한 상태다.
              <br />
              다음 단계에서 지도 API + 기관 DB 연결하면
              주소 기준 가까운 실습교육원 / 실습기관 리스트를 거리순으로 보여줄 수 있다.
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFinderOpen(false)}>
              닫기
            </Button>
            <Button onClick={handleFinderSearch}>실습처 찾기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}