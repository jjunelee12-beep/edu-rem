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
DialogDescription,
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
  MapPin,
  Phone,
  Search,
  User2,
  School,
  Clock3,
  Building2,
} from "lucide-react";

import KakaoMapBase from "@/components/KakaoMap";
const KakaoMap: any = KakaoMapBase;

type PracticeCoordinationStatus = "미섭외" | "섭외중" | "섭외완료";
type PaymentStatus = "미결제" | "결제";

type FinderItemType = "education" | "institution";

type FinderItem = {
  id: string | number;
  type: FinderItemType;
  name: string;
  representativeName?: string;
  phone?: string;
  address?: string;
  price?: string;
  distanceKm?: string | number;
};

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
  const [finderIncludeEducationCenter, setFinderIncludeEducationCenter] =
    useState(true);
  const [finderIncludePracticeInstitution, setFinderIncludePracticeInstitution] =
    useState(true);
  const [finderTargetRow, setFinderTargetRow] = useState<any | null>(null);
  const [finderSearchTrigger, setFinderSearchTrigger] = useState(0);
  const [finderResults, setFinderResults] = useState<FinderItem[]>([]);
  const [selectedFinderItem, setSelectedFinderItem] = useState<FinderItem | null>(
    null
  );

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
      const mergedAddress = `${row.inputAddress || ""} ${row.detailAddress || ""}`;

      const matchKeyword =
        !keyword ||
        String(row.clientName || "").includes(keyword) ||
        String(row.phone || "").includes(keyword) ||
        String(row.managerName || "").includes(keyword) ||
        String(row.assigneeName || "").includes(keyword) ||
        String(row.course || "").includes(keyword) ||
        mergedAddress.includes(keyword) ||
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
      default:
        return "bg-gray-100 text-gray-700 border border-gray-200";
    }
  };

  const getPaymentBadgeClass = (status?: string) => {
    switch (status) {
      case "결제":
        return "bg-emerald-100 text-emerald-700 border border-emerald-200";
      default:
        return "bg-gray-100 text-gray-700 border border-gray-200";
    }
  };

  const openDetail = (row: any) => {
    setSelectedRow({
      ...row,
      coordinationStatus: row.coordinationStatus || "미섭외",
      paymentStatus: row.paymentStatus || "미결제",
      inputAddress: row.inputAddress || "",
      detailAddress: row.detailAddress || "",
      managerName: row.managerName || row.assigneeName || "",
      practiceHours:
        row.practiceHours?.toString?.() || row.practiceHours || "",
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
      detailAddress: selectedRow.detailAddress || undefined,
      managerName: selectedRow.managerName || undefined,
      practiceHours: selectedRow.practiceHours
        ? Number(selectedRow.practiceHours)
        : undefined,
      coordinationStatus:
        selectedRow.coordinationStatus as PracticeCoordinationStatus,
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

  const handleQuickPaymentChange = (id: number, nextStatus: PaymentStatus) => {
    updatePracticeSupportMut.mutate({
      id,
      paymentStatus: nextStatus,
    } as any);
  };

  const buildFinderBaseResults = (row?: any | null): FinderItem[] => {
    const result: FinderItem[] = [];

    if (finderIncludeEducationCenter && row?.selectedEducationCenterName) {
      result.push({
        id: `education-${row.id}`,
        type: "education",
        name: row.selectedEducationCenterName,
        address: row.selectedEducationCenterAddress || "",
        distanceKm: row.selectedEducationCenterDistanceKm || "",
      });
    }

    if (finderIncludePracticeInstitution && row?.selectedPracticeInstitutionName) {
      result.push({
        id: `institution-${row.id}`,
        type: "institution",
        name: row.selectedPracticeInstitutionName,
        address: row.selectedPracticeInstitutionAddress || "",
        distanceKm: row.selectedPracticeInstitutionDistanceKm || "",
      });
    }

    return result;
  };

  const openFinder = (row?: any | null) => {
    setFinderTargetRow(row || null);
    setFinderAddress(row?.inputAddress || "");
    setFinderIncludeEducationCenter(true);
    setFinderIncludePracticeInstitution(true);
    setFinderResults(buildFinderBaseResults(row));
    setSelectedFinderItem(null);
    setFinderOpen(true);
  };

  const handleFinderSearch = () => {
    if (!finderAddress.trim()) {
      toast.error("주소를 입력해주세요.");
      return;
    }

    setFinderSearchTrigger((prev) => prev + 1);

    // 현재는 실기관 DB 연결 전이므로 저장된 값 중심으로 먼저 보여줌
    const base = buildFinderBaseResults(finderTargetRow);

    setFinderResults(base);
    setSelectedFinderItem(base[0] ?? null);

    if (base.length === 0) {
      toast.message(
        "현재는 지도 레이아웃만 먼저 붙인 상태입니다. 기관 DB + 거리 계산 연결 후 리스트가 자동으로 채워집니다."
      );
    }
  };

  const applyFinderSelectionToDetail = () => {
    if (!selectedFinderItem) {
      toast.error("선택된 기관이 없습니다.");
      return;
    }

    if (!selectedRow && finderTargetRow) {
      openDetail(finderTargetRow);
      return;
    }

    if (!selectedRow) {
      toast.error("상세 수정할 행을 먼저 선택해주세요.");
      return;
    }

    if (selectedFinderItem.type === "education") {
      setSelectedRow((prev: any) => ({
        ...prev,
        selectedEducationCenterName: selectedFinderItem.name || "",
        selectedEducationCenterAddress: selectedFinderItem.address || "",
        selectedEducationCenterDistanceKm:
          selectedFinderItem.distanceKm?.toString?.() ||
          selectedFinderItem.distanceKm ||
          "",
      }));
    } else {
      setSelectedRow((prev: any) => ({
        ...prev,
        selectedPracticeInstitutionName: selectedFinderItem.name || "",
        selectedPracticeInstitutionAddress: selectedFinderItem.address || "",
        selectedPracticeInstitutionDistanceKm:
          selectedFinderItem.distanceKm?.toString?.() ||
          selectedFinderItem.distanceKm ||
          "",
      }));
    }

    setFinderOpen(false);
    toast.success("선택한 기관 정보를 상세 수정창에 반영했습니다.");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">실습배정지원센터</h1>
          <p className="text-sm text-muted-foreground mt-1">
            실습 요청 학생을 리스트형으로 관리하고, 실습교육원 / 실습기관 배정과 결제 상태를 관리합니다.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="이름 / 연락처 / 과정 / 담당자 / 주소 검색"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[280px]"
          />

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="실습섭외 전체" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="전체">전체 상태</SelectItem>
              <SelectItem value="미섭외">미섭외</SelectItem>
              <SelectItem value="섭외중">섭외중</SelectItem>
              <SelectItem value="섭외완료">섭외완료</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => openFinder(null)} className="gap-2">
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

        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-16 text-center">
              불러오는 중...
            </div>
          ) : filteredList.length === 0 ? (
            <div className="text-sm text-muted-foreground py-16 text-center">
              조회된 실습배정 요청이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1500px]">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground w-[60px]">
                      No
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                      이름
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                      전화번호
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                      희망과정
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground min-w-[220px]">
                      상세주소
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                      실습교육원명
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                      실습기관명
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                      실습시간
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground w-[140px]">
                      결제
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground w-[140px]">
                      실습섭외
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                      담당자
                    </th>
                    <th className="px-3 py-3 text-right font-medium text-muted-foreground w-[220px]">
                      관리
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredList.map((row: any, idx: number) => (
                    <tr key={row.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-3 py-3 text-sm text-muted-foreground">
                        {idx + 1}
                      </td>

                      <td className="px-3 py-3">
                        <div className="font-medium">{row.clientName || "-"}</div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="inline-flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                          {formatPhone(row.phone || "") || "-"}
                        </div>
                      </td>

                      <td className="px-3 py-3">{row.course || "-"}</td>

                      <td className="px-3 py-3">
                        <div className="text-sm">
                          <div>{row.inputAddress || "-"}</div>
                          <div className="text-muted-foreground">
                            {row.detailAddress || ""}
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="space-y-1">
                          <div className="font-medium">
                            {row.selectedEducationCenterName || "-"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.selectedEducationCenterDistanceKm
                              ? `${row.selectedEducationCenterDistanceKm}km`
                              : ""}
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="space-y-1">
                          <div className="font-medium">
                            {row.selectedPracticeInstitutionName || "-"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.selectedPracticeInstitutionDistanceKm
                              ? `${row.selectedPracticeInstitutionDistanceKm}km`
                              : ""}
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        {row.practiceHours ? `${row.practiceHours}시간` : "-"}
                      </td>

                      <td className="px-3 py-3">
                        <Select
                          value={row.paymentStatus || "미결제"}
                          onValueChange={(v) =>
                            handleQuickPaymentChange(row.id, v as PaymentStatus)
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="미결제">미결제</SelectItem>
                            <SelectItem value="결제">결제</SelectItem>
                          </SelectContent>
                        </Select>

                        <div className="mt-1">
                          <Badge className={getPaymentBadgeClass(row.paymentStatus)}>
                            {row.paymentStatus || "미결제"}
                          </Badge>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <Select
                          value={row.coordinationStatus || "미섭외"}
                          onValueChange={(v) =>
                            handleQuickCoordinationChange(
                              row.id,
                              v as PracticeCoordinationStatus
                            )
                          }
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="미섭외">미섭외</SelectItem>
                            <SelectItem value="섭외중">섭외중</SelectItem>
                            <SelectItem value="섭외완료">섭외완료</SelectItem>
                          </SelectContent>
                        </Select>

                        <div className="mt-1">
                          <Badge
                            className={getCoordinationBadgeClass(
                              row.coordinationStatus
                            )}
                          >
                            {row.coordinationStatus || "미섭외"}
                          </Badge>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="inline-flex items-center gap-1">
                          <User2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {row.managerName || row.assigneeName || "-"}
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => openFinder(row)}
                          >
                            <Search className="h-3.5 w-3.5" />
                            실습찾기
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1"
                            onClick={() => openDetail(row)}
                          >
                            <School className="h-3.5 w-3.5" />
                            상세수정
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-4xl">
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
                  <Label className="text-xs">희망과정</Label>
                  <Input value={selectedRow.course || ""} disabled />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">담당자명</Label>
                  <Input
                    value={selectedRow.managerName || ""}
                    onChange={(e) =>
                      setSelectedRow((prev: any) => ({
                        ...prev,
                        managerName: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">기본주소</Label>
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
                  <Label className="text-xs">상세주소</Label>
                  <Input
                    value={selectedRow.detailAddress || ""}
                    onChange={(e) =>
                      setSelectedRow((prev: any) => ({
                        ...prev,
                        detailAddress: e.target.value,
                      }))
                    }
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">실습시간</Label>
                  <Input
                    value={selectedRow.practiceHours || ""}
                    onChange={(e) =>
                      setSelectedRow((prev: any) => ({
                        ...prev,
                        practiceHours: e.target.value.replace(/[^0-9]/g, ""),
                      }))
                    }
                    placeholder="예: 160"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">실습섭외</Label>
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
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">결제 상태</Label>
                  <Select
                    value={selectedRow.paymentStatus || "미결제"}
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
                      <SelectItem value="미결제">미결제</SelectItem>
                      <SelectItem value="결제">결제</SelectItem>
                    </SelectContent>
                  </Select>
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

                <div className="space-y-1 md:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">메모</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => openFinder(selectedRow)}
                    >
                      기관찾기
                    </Button>
                  </div>

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
  <DialogContent
    aria-describedby="practice-finder-desc"
    className="max-w-[99vw] w-[99vw] h-[96vh] p-0 overflow-hidden"
  >
    {/* 헤더 */}
    <DialogHeader className="px-6 pt-5 pb-4 border-b bg-white">
      <DialogTitle className="text-lg font-semibold">
        실습찾기
      </DialogTitle>

      <DialogDescription id="practice-finder-desc" className="text-sm text-muted-foreground">
        학생 주소 기준으로 가까운 실습교육원 / 실습기관을 검색합니다.
      </DialogDescription>
    </DialogHeader>

    {/* 전체 영역 */}
    <div className="flex h-[calc(96vh-90px)]">
      
      {/* ===================== 왼쪽 패널 ===================== */}
      <div className="w-[320px] min-w-[320px] border-r bg-white flex flex-col">

        {/* 검색 영역 */}
        <div className="p-4 border-b space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">주소 검색</Label>

            <div className="flex gap-2">
              <Input
                placeholder="예: 서울 도봉구 방학동..."
                value={finderAddress}
                onChange={(e) => setFinderAddress(e.target.value)}
              />
              <Button onClick={handleFinderSearch} className="shrink-0">
                검색
              </Button>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={finderIncludeEducationCenter}
                onChange={(e) =>
                  setFinderIncludeEducationCenter(e.target.checked)
                }
              />
              실습교육원
            </label>

            <label className="inline-flex items-center gap-2">
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

          {finderTargetRow && (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <div>대상: {finderTargetRow.clientName || "-"}</div>
              <div>
                주소: {finderTargetRow.inputAddress || "-"}{" "}
                {finderTargetRow.detailAddress || ""}
              </div>
            </div>
          )}
        </div>

        {/* 결과 리스트 */}
        <div className="flex-1 overflow-y-auto">
          {finderResults.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              <div className="font-medium mb-2">검색 결과</div>
              <div className="rounded-lg border bg-muted/30 p-4 leading-6">
                아직 기관 DB 검색 기능이 연결되지 않은 상태입니다.
                <br />
                다음 단계에서 가까운 기관 리스트가 표시됩니다.
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {finderResults.map((item) => {
                const isSelected =
                  String(selectedFinderItem?.id || "") === String(item.id);

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`w-full text-left p-4 hover:bg-muted/30 transition ${
                      isSelected ? "bg-blue-50" : ""
                    }`}
                    onClick={() => setSelectedFinderItem(item)}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            item.type === "education"
                              ? "bg-violet-100 text-violet-700"
                              : "bg-emerald-100 text-emerald-700"
                          }
                        >
                          {item.type === "education"
                            ? "교육원"
                            : "실습기관"}
                        </Badge>

                        <span className="font-medium truncate">
                          {item.name}
                        </span>
                      </div>

                      {item.address && (
                        <div className="text-xs text-muted-foreground">
                          {item.address}
                        </div>
                      )}

                      {item.distanceKm && (
                        <div className="text-sm font-medium text-blue-600">
                          {item.distanceKm}km
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 하단 버튼 */}
        <div className="p-4 border-t flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setFinderOpen(false)}
          >
            닫기
          </Button>

          <Button
            className="flex-1"
            onClick={applyFinderSelectionToDetail}
            disabled={!selectedFinderItem}
          >
            선택 반영
          </Button>
        </div>
      </div>

      {/* ===================== 오른쪽 지도 ===================== */}
      <div className="flex-1 min-w-0 bg-gray-100">
        <div className="w-full h-full">
          <KakaoMap
            address={finderAddress}
            searchTrigger={finderSearchTrigger}
            includeEducationCenter={finderIncludeEducationCenter}
            includePracticeInstitution={finderIncludePracticeInstitution}
            results={finderResults}
            selectedResult={selectedFinderItem}
            onSelectResult={(item: FinderItem) =>
              setSelectedFinderItem(item)
            }
          />
        </div>
      </div>
    </div>
  </DialogContent>
</Dialog>
    </div>
  );
}