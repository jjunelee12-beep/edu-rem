import { useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import { formatPhone } from "@/lib/format";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Phone,
  Search,
  User2,
  School,
  CheckCircle2,
  Navigation,
  MapPin,
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
  latitude?: string | number | null;
  longitude?: string | number | null;
};

declare global {
  interface Window {
    kakao: any;
  }
}

function toNum(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
) {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function waitForKakaoServices(timeout = 6000): Promise<any> {
  return new Promise((resolve, reject) => {
    const started = Date.now();

    const timer = setInterval(() => {
      if (window.kakao?.maps?.services) {
        clearInterval(timer);
        resolve(window.kakao);
        return;
      }

      if (Date.now() - started > timeout) {
        clearInterval(timer);
        reject(new Error("카카오 지도 서비스가 아직 로드되지 않았습니다."));
      }
    }, 100);
  });
}

async function geocodeAddress(
  keywordOrAddress: string
): Promise<{ lat: number; lng: number }> {
  const kakao = await waitForKakaoServices();

  return new Promise((resolve, reject) => {
    const geocoder = new kakao.maps.services.Geocoder();

    geocoder.addressSearch(keywordOrAddress, (result: any[], status: string) => {
      if (status === kakao.maps.services.Status.OK && result?.length) {
        resolve({
          lat: Number(result[0].y),
          lng: Number(result[0].x),
        });
        return;
      }

      const places = new kakao.maps.services.Places();

      places.keywordSearch(
        keywordOrAddress,
        (placeResult: any[], placeStatus: string) => {
          if (
            placeStatus !== kakao.maps.services.Status.OK ||
            !placeResult?.length
          ) {
            reject(new Error("주소 또는 장소명을 찾지 못했습니다."));
            return;
          }

          resolve({
            lat: Number(placeResult[0].y),
            lng: Number(placeResult[0].x),
          });
        }
      );
    });
  });
}

function getTypeLabel(type: FinderItemType) {
  return type === "education" ? "실습교육원" : "실습기관";
}

export default function PracticeSupportCenter() {
  const { user } = useAuth();
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
  const [isFinderSearching, setIsFinderSearching] = useState(false);

  const [finderSearchPoint, setFinderSearchPoint] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [finderResolvedAddress, setFinderResolvedAddress] = useState("");

  const { data: practiceSupportList, isLoading } =
    trpc.practiceSupport.list.useQuery();

  const { data: educationCenterDb = [] } =
    trpc.practiceEducationCenter.list.useQuery(undefined, {
      staleTime: 1000 * 60 * 5,
    });

  const { data: practiceInstitutionDb = [] } =
    trpc.practiceInstitution.list.useQuery(
      { institutionType: "institution" },
      {
        staleTime: 1000 * 60 * 5,
      }
    );

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
        String(row.managerName || "").includes(keyword) ||
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
      selectedEducationCenterId: row.selectedEducationCenterId || undefined,
      selectedEducationCenterName: row.selectedEducationCenterName || "",
      selectedEducationCenterAddress: row.selectedEducationCenterAddress || "",
      selectedEducationCenterDistanceKm:
        row.selectedEducationCenterDistanceKm?.toString?.() ||
        row.selectedEducationCenterDistanceKm ||
        "",
      selectedPracticeInstitutionId: row.selectedPracticeInstitutionId || undefined,
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
      selectedEducationCenterId: selectedRow.selectedEducationCenterId || undefined,
      selectedEducationCenterName:
        selectedRow.selectedEducationCenterName || undefined,
      selectedEducationCenterAddress:
        selectedRow.selectedEducationCenterAddress || undefined,
      selectedEducationCenterDistanceKm:
        selectedRow.selectedEducationCenterDistanceKm || undefined,
      selectedPracticeInstitutionId:
        selectedRow.selectedPracticeInstitutionId || undefined,
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
        id: row.selectedEducationCenterId || `education-${row.id}`,
        type: "education",
        name: row.selectedEducationCenterName,
        address: row.selectedEducationCenterAddress || "",
        distanceKm: row.selectedEducationCenterDistanceKm || "",
      });
    }

    if (finderIncludePracticeInstitution && row?.selectedPracticeInstitutionName) {
      result.push({
        id: row.selectedPracticeInstitutionId || `institution-${row.id}`,
        type: "institution",
        name: row.selectedPracticeInstitutionName,
        address: row.selectedPracticeInstitutionAddress || "",
        distanceKm: row.selectedPracticeInstitutionDistanceKm || "",
      });
    }

    return result;
  };

  const openFinder = (row?: any | null) => {
    const baseAddress = row?.inputAddress || row?.address || "";

    setFinderTargetRow(row || null);
    setFinderAddress(baseAddress.trim());
    setFinderIncludeEducationCenter(true);
    setFinderIncludePracticeInstitution(true);
    setFinderResults(buildFinderBaseResults(row));
    setSelectedFinderItem(null);
    setFinderSearchPoint(null);
    setFinderResolvedAddress("");
    setFinderOpen(true);
  };

  const handleFinderSearch = async () => {
    if (!finderAddress.trim()) {
      toast.error("주소를 입력해주세요.");
      return;
    }

    if (!finderIncludeEducationCenter && !finderIncludePracticeInstitution) {
      toast.error("실습교육원 또는 실습기관 중 하나 이상 선택해주세요.");
      return;
    }

    try {
      setIsFinderSearching(true);
      setFinderSearchTrigger((prev) => prev + 1);

      const { lat, lng } = await geocodeAddress(finderAddress.trim());
      setFinderSearchPoint({ lat, lng });
      setFinderResolvedAddress(finderAddress.trim());

      const nextResults: FinderItem[] = [];

      if (finderIncludeEducationCenter) {
        for (const item of educationCenterDb as any[]) {
          const itemLat = toNum(item.latitude);
          const itemLng = toNum(item.longitude);
          if (itemLat === null || itemLng === null) continue;

          const distanceKm = haversineDistanceKm(lat, lng, itemLat, itemLng);

          nextResults.push({
            id: item.id,
            type: "education",
            name: item.name,
            representativeName: item.representativeName || "",
            phone: item.phone || "",
            address: [item.address, item.detailAddress].filter(Boolean).join(" "),
            price: item.feeAmount ? String(item.feeAmount) : "",
            distanceKm: distanceKm.toFixed(2),
            latitude: item.latitude,
            longitude: item.longitude,
          });
        }
      }

      if (finderIncludePracticeInstitution) {
        for (const item of practiceInstitutionDb as any[]) {
          const itemLat = toNum(item.latitude);
          const itemLng = toNum(item.longitude);
          if (itemLat === null || itemLng === null) continue;

          const distanceKm = haversineDistanceKm(lat, lng, itemLat, itemLng);

          nextResults.push({
            id: item.id,
            type: "institution",
            name: item.name,
            representativeName: item.representativeName || "",
            phone: item.phone || "",
            address: [item.address, item.detailAddress].filter(Boolean).join(" "),
            price: item.price ? String(item.price) : "",
            distanceKm: distanceKm.toFixed(2),
            latitude: item.latitude,
            longitude: item.longitude,
          });
        }
      }

      nextResults.sort((a, b) => {
        const da = Number(a.distanceKm || 999999);
        const db = Number(b.distanceKm || 999999);
        return da - db;
      });

      const topResults = nextResults.slice(0, 100);

      setFinderResults(topResults);
      setSelectedFinderItem(topResults[0] ?? null);

      if (topResults.length === 0) {
        toast.message("검색 결과가 없습니다. 좌표가 등록된 기관 데이터를 확인해주세요.");
      } else {
        toast.success(`가까운 기관 ${topResults.length}건을 불러왔습니다.`);
      }
    } catch (e: any) {
      toast.error(e?.message || "기관 검색 중 오류가 발생했습니다.");
    } finally {
      setIsFinderSearching(false);
    }
  };

  const applyFinderSelectionToDetail = async () => {
    if (!selectedFinderItem) {
      toast.error("선택된 기관이 없습니다.");
      return;
    }

    const updatePayload =
      selectedFinderItem.type === "education"
        ? {
            selectedEducationCenterId: Number(selectedFinderItem.id) || undefined,
            selectedEducationCenterName: selectedFinderItem.name || "",
            selectedEducationCenterAddress: selectedFinderItem.address || "",
            selectedEducationCenterDistanceKm:
              selectedFinderItem.distanceKm?.toString?.() ||
              String(selectedFinderItem.distanceKm || ""),
          }
        : {
            selectedPracticeInstitutionId:
              Number(selectedFinderItem.id) || undefined,
            selectedPracticeInstitutionName: selectedFinderItem.name || "",
            selectedPracticeInstitutionAddress: selectedFinderItem.address || "",
            selectedPracticeInstitutionDistanceKm:
              selectedFinderItem.distanceKm?.toString?.() ||
              String(selectedFinderItem.distanceKm || ""),
          };

    if (selectedRow?.id) {
      setSelectedRow((prev: any) => ({
        ...prev,
        ...updatePayload,
      }));
      setFinderOpen(false);
      toast.success("선택한 기관 정보를 상세 수정창에 반영했습니다.");
      return;
    }

    if (finderTargetRow?.id) {
      try {
        await updatePracticeSupportMut.mutateAsync({
          id: finderTargetRow.id,
          ...updatePayload,
        } as any);
        setFinderOpen(false);
        toast.success("선택한 기관 정보를 요청 리스트에 바로 반영했습니다.");
      } catch (e: any) {
        toast.error(e?.message || "기관 반영 중 오류가 발생했습니다.");
      }
      return;
    }

    toast.error("반영할 대상 요청이 없습니다.");
  };

  const FinderTypeToggle = ({
    checked,
    onChange,
    label,
    activeClassName,
  }: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    activeClassName: string;
  }) => {
    return (
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
          checked
            ? activeClassName
            : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
        }`}
      >
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            checked ? "bg-current opacity-100" : "bg-gray-300"
          }`}
        />
        {label}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">실습배정지원센터</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            실습 요청 학생을 리스트형으로 관리하고, 실습교육원 / 실습기관 배정과
            실습섭외 · 결제 상태를 관리합니다.
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
            <div className="py-16 text-center text-sm text-muted-foreground">
              불러오는 중...
            </div>
          ) : filteredList.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              조회된 실습배정 요청이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1500px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40">
                    <th className="w-[60px] px-3 py-3 text-left font-medium text-muted-foreground">
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
                    <th className="min-w-[220px] px-3 py-3 text-left font-medium text-muted-foreground">
                      주소
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
                    <th className="w-[140px] px-3 py-3 text-left font-medium text-muted-foreground">
                      실습섭외
                    </th>
                    <th className="w-[140px] px-3 py-3 text-left font-medium text-muted-foreground">
                      결제
                    </th>
                    <th className="px-3 py-3 text-left font-medium text-muted-foreground">
                      담당자
                    </th>
                    <th className="w-[200px] px-3 py-3 text-right font-medium text-muted-foreground">
                      관리
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredList.map((row: any, idx: number) => (
                    <tr
                      key={row.id}
                      className="border-b last:border-0 hover:bg-muted/20"
                    >
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
                        <div className="text-sm">{row.inputAddress || "-"}</div>
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
                      </td>

                      <td className="px-3 py-3">
                        <div className="inline-flex items-center gap-1">
                          <User2 className="h-3.5 w-3.5 text-muted-foreground" />
                          {row.managerName || row.assigneeName || "-"}
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex flex-col items-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 w-[96px]"
                            onClick={() => openFinder(row)}
                          >
                            <Search className="h-3.5 w-3.5" />
                            실습찾기
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1 w-[96px]"
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
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>실습배정 상세 정보</DialogTitle>
            <DialogDescription>
              학생 주소, 실습교육원, 실습기관, 실습섭외 및 결제 상태를 위아래 구조로
              관리합니다.
            </DialogDescription>
          </DialogHeader>

          {selectedRow && (
            <div className="max-h-[75vh] overflow-y-auto space-y-5 py-2 pr-1">
              <div className="rounded-xl border p-4 space-y-4">
                <div className="font-semibold">학생 기본 정보</div>

                <div className="space-y-3">
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
                    <Label className="text-xs">주소</Label>
                    <Input
                      value={selectedRow.inputAddress || ""}
                      onChange={(e) =>
                        setSelectedRow((prev: any) => ({
                          ...prev,
                          inputAddress: e.target.value,
                        }))
                      }
                      placeholder="예: 서울 도봉구 방학동 ..."
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
                      placeholder="예: 401호"
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
                </div>
              </div>

              <div className="rounded-xl border p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">배정 정보</div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openFinder(selectedRow)}
                  >
                    기관찾기
                  </Button>
                </div>

                <div className="space-y-3">
                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="font-medium">
                      {selectedRow.selectedEducationCenterName || "-"}
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
                            selectedEducationCenterDistanceKm:
                              e.target.value.replace(/[^0-9.]/g, ""),
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border p-3 space-y-2">
                    <div className="font-medium">
                      {selectedRow.selectedPracticeInstitutionName || "-"}
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
                            selectedPracticeInstitutionDistanceKm:
                              e.target.value.replace(/[^0-9.]/g, ""),
                          }))
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border p-4 space-y-4">
                <div className="font-semibold">실습 관리 정보</div>

                <div className="space-y-3">
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
                    <Label className="text-xs">메모</Label>
                    <Textarea
                      rows={5}
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
          className="h-screen w-screen max-w-none overflow-hidden rounded-none border-0 p-0 sm:max-w-none"
        >
          <DialogHeader className="border-b bg-white px-6 pt-5 pb-4">
            <DialogTitle className="text-lg font-semibold">실습찾기</DialogTitle>
            <DialogDescription
              id="practice-finder-desc"
              className="text-sm text-muted-foreground"
            >
              학생 주소 기준으로 가까운 실습교육원 / 실습기관을 검색합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="flex h-[calc(100vh-72px)]">
            <div className="flex w-[360px] min-w-[360px] flex-col border-r bg-white">
              <div className="space-y-4 border-b p-4">
                <div className="space-y-1">
                  <Label className="text-xs">주소 검색</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="예: 서울 도봉구 방학동..."
                      value={finderAddress}
                      onChange={(e) => setFinderAddress(e.target.value)}
                    />
                    <Button
                      onClick={handleFinderSearch}
                      className="shrink-0"
                      disabled={isFinderSearching}
                    >
                      {isFinderSearching ? "검색중" : "검색"}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <FinderTypeToggle
                    checked={finderIncludeEducationCenter}
                    onChange={setFinderIncludeEducationCenter}
                    label="실습교육원"
                    activeClassName="bg-blue-50 text-blue-700 border-blue-200"
                  />

                  <FinderTypeToggle
                    checked={finderIncludePracticeInstitution}
                    onChange={setFinderIncludePracticeInstitution}
                    label="실습기관"
                    activeClassName="bg-orange-50 text-orange-700 border-orange-200"
                  />
                </div>

                {finderTargetRow && (
                  <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <div>대상: {finderTargetRow.clientName || "-"}</div>
                    <div>주소: {finderTargetRow.inputAddress || "-"}</div>
                  </div>
                )}

                {finderSearchPoint && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-3 text-xs">
                    <div className="flex items-center gap-2 font-medium text-green-700">
                      <CheckCircle2 className="h-4 w-4" />
                      검색 기준 주소
                    </div>
                    <div className="mt-1 text-gray-700">
                      {finderResolvedAddress || finderAddress}
                    </div>
                    <div className="mt-1 text-[11px] text-green-700">
                      위 주소를 기준으로 가까운 실습교육원 / 실습기관을 거리순으로
                      보여줍니다.
                    </div>
                  </div>
                )}
              </div>

              <div className="border-b px-4 py-3 text-sm">
                <div className="font-medium">검색 결과</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  가까운 순으로 최대 100건까지 표시됩니다.
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {finderResults.length === 0 ? (
                  <div className="p-4 text-sm text-muted-foreground">
                    <div className="rounded-lg border bg-muted/30 p-4 leading-6">
                      검색된 결과가 없습니다.
                      <br />
                      주소를 입력한 뒤 검색하거나, 좌표가 등록된 기관 데이터를
                      확인해주세요.
                    </div>
                  </div>
                ) : (
                  <div className="divide-y">
                    {finderResults.map((item) => {
                      const isSelected =
                        String(selectedFinderItem?.id || "") === String(item.id);

                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          type="button"
                          className={`w-full p-4 text-left transition hover:bg-muted/30 ${
                            isSelected
                              ? item.type === "education"
                                ? "bg-blue-50"
                                : "bg-orange-50"
                              : ""
                          }`}
                          onClick={() => setSelectedFinderItem(item)}
                        >
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                  item.type === "education"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-orange-100 text-orange-700"
                                }`}
                              >
                                {getTypeLabel(item.type)}
                              </span>

                              <span className="truncate font-medium">
                                {item.name}
                              </span>
                            </div>

                            {item.address && (
                              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>{item.address}</span>
                              </div>
                            )}

                            {item.phone && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Phone className="h-3.5 w-3.5 shrink-0" />
                                <span>{formatPhone(item.phone)}</span>
                              </div>
                            )}

                            {item.price && (
                              <div className="text-xs text-muted-foreground">
                                금액: {item.price}
                              </div>
                            )}

                            {item.distanceKm && (
                              <div className="flex items-center gap-2 text-sm font-medium text-blue-600">
                                <Navigation className="h-4 w-4" />
                                <span>{item.distanceKm}km</span>
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t p-4 space-y-3">
                {selectedFinderItem && (
                  <div className="rounded-lg border bg-muted/20 p-3 text-xs">
                    <div className="mb-1 font-medium">선택된 기관</div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          selectedFinderItem.type === "education"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {getTypeLabel(selectedFinderItem.type)}
                      </span>
                      <span>{selectedFinderItem.name}</span>
                    </div>
                    {selectedFinderItem.distanceKm && (
                      <div className="mt-1 text-muted-foreground">
                        거리: {selectedFinderItem.distanceKm}km
                      </div>
                    )}
                  </div>
                )}

                <div className="flex gap-2">
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
                    disabled={!selectedFinderItem || updatePracticeSupportMut.isPending}
                  >
                    선택 반영
                  </Button>
                </div>
              </div>
            </div>

            <div className="min-w-0 flex-1 bg-gray-100">
              <div className="h-full w-full">
                <KakaoMap
                  address={finderAddress}
                  searchTrigger={finderSearchTrigger}
                  includeEducationCenter={finderIncludeEducationCenter}
                  includePracticeInstitution={finderIncludePracticeInstitution}
                  results={finderResults}
                  selectedResult={selectedFinderItem}
                  searchPoint={finderSearchPoint}
                  searchPointLabel={finderResolvedAddress || finderAddress}
                  showSearchPointMarker={true}
                  onSelectResult={(item: FinderItem) => setSelectedFinderItem(item)}
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}