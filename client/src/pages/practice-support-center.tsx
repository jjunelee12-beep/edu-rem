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
  Settings2,
  CalendarDays,
  AlertTriangle,
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

  isInactive?: boolean;
  inactiveReason?: string;
  inactiveStartDate?: string | null;
  inactiveEndDate?: string | null;
  hideOnMapWhenInactive?: boolean;
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

function toDateOnly(value?: string | null) {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateOnly(value?: string | null) {
  const d = toDateOnly(value);
  if (!d) return "-";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function isFinderItemInactiveNow(item: FinderItem) {
  if (!item.isInactive) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const start = toDateOnly(item.inactiveStartDate);
  const end = toDateOnly(item.inactiveEndDate);

  if (!start && !end) return true;
  if (start && !end) return today >= start;
  if (!start && end) return today <= end;
  return !!(start && end && today >= start && today <= end);
}

function hasFinderInactiveConfig(item: FinderItem) {
  return !!(
    item.isInactive ||
    item.inactiveReason ||
    item.inactiveStartDate ||
    item.inactiveEndDate
  );
}

function getFinderInactiveText(item: FinderItem) {
  if (!hasFinderInactiveConfig(item)) return "";

  const reason = item.inactiveReason?.trim() || "비활성화";
  const start = formatDateOnly(item.inactiveStartDate);
  const end = formatDateOnly(item.inactiveEndDate);

  if (item.inactiveStartDate && item.inactiveEndDate) {
    return `${reason} (${start} ~ ${end})`;
  }

  if (item.inactiveStartDate && !item.inactiveEndDate) {
    return `${reason} (${start}부터 사용 불가)`;
  }

  if (!item.inactiveStartDate && item.inactiveEndDate) {
    return `${reason} (${end}까지 사용 불가)`;
  }

  return reason;
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
const [finderEducationCategoryId, setFinderEducationCategoryId] = useState<number | null>(null);
const [finderInstitutionCategoryId, setFinderInstitutionCategoryId] = useState<number | null>(null);
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

  const [finderSettingsItem, setFinderSettingsItem] = useState<FinderItem | null>(
    null
  );
  const [finderInactiveEnabled, setFinderInactiveEnabled] = useState(false);
  const [finderInactiveStartDate, setFinderInactiveStartDate] = useState("");
  const [finderInactiveEndDate, setFinderInactiveEndDate] = useState("");
  const [finderInactiveReason, setFinderInactiveReason] = useState("");
  const [finderHideOnMapWhenInactive, setFinderHideOnMapWhenInactive] =
    useState(true);

const isHostManager =
  user?.role === "host" || user?.role === "superhost";

const [masterOpen, setMasterOpen] = useState(false);
const [masterListType, setMasterListType] = useState<"education" | "institution">("education");
const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
const [newCategoryName, setNewCategoryName] = useState("");
const [categoryManageOpen, setCategoryManageOpen] = useState(false);

const [csvText, setCsvText] = useState("");
const [deactivateOpen, setDeactivateOpen] = useState(false);
const [bulkInactiveReason, setBulkInactiveReason] = useState("일괄 비활성화");
const [bulkInactiveStartDate, setBulkInactiveStartDate] = useState("");
const [bulkInactiveEndDate, setBulkInactiveEndDate] = useState("");
const [bulkHideOnMapWhenInactive, setBulkHideOnMapWhenInactive] = useState(true);

const [deleteTarget, setDeleteTarget] = useState<FinderItem | null>(null);

  const { data: practiceSupportList, isLoading } =
    trpc.practiceSupport.list.useQuery();

  const { data: educationCenterDb = [] } =
  trpc.practiceEducationCenter.list.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
  });

const { data: practiceInstitutionDb = [] } =
  trpc.practiceInstitution.list.useQuery(
    {
      institutionType: "institution",
    },
    {
      staleTime: 1000 * 60 * 5,
    }
  );

const { data: educationCategories = [] } =
  trpc.practiceListCategory.list.useQuery({ listType: "education" });

const { data: institutionCategories = [] } =
  trpc.practiceListCategory.list.useQuery({ listType: "institution" });


  const updatePracticeSupportMut = trpc.practiceSupport.update.useMutation({
    onSuccess: async () => {
      await utils.practiceSupport.list.invalidate();
      toast.success("실습배정지원센터 정보가 수정되었습니다.");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateEducationAvailabilityMut =
    trpc.practiceEducationCenter.updateAvailability.useMutation({
      onSuccess: async () => {
        await Promise.all([
          utils.practiceEducationCenter.list.invalidate(),
        ]);
        toast.success("실습교육원 비활성화 설정이 저장되었습니다.");
      },
      onError: (e) => toast.error(e.message || "실습교육원 설정 저장 실패"),
    });

  const updateInstitutionAvailabilityMut =
    trpc.practiceInstitution.updateAvailability.useMutation({
      onSuccess: async () => {
        await Promise.all([
          utils.practiceInstitution.list.invalidate(),
        ]);
        toast.success("실습기관 비활성화 설정이 저장되었습니다.");
      },
      onError: (e) => toast.error(e.message || "실습기관 설정 저장 실패"),
    });

const bulkCreateEducationCentersMut =
  trpc.practiceEducationCenter.bulkCreate.useMutation({
    onSuccess: async () => {
      await utils.practiceEducationCenter.list.invalidate();
      toast.success("실습교육원 CSV 등록이 완료되었습니다.");
      setCsvText("");
    },
    onError: (e) => toast.error(e.message || "실습교육원 CSV 등록 실패"),
  });

const bulkDeactivateEducationCentersMut =
  trpc.practiceEducationCenter.bulkDeactivate.useMutation({
    onSuccess: async () => {
      await utils.practiceEducationCenter.list.invalidate();
      toast.success("실습교육원 전체 비활성화가 완료되었습니다.");
      setDeactivateOpen(false);
    },
    onError: (e) => toast.error(e.message || "실습교육원 전체 비활성화 실패"),
  });

const bulkCreateInstitutionsMut =
  trpc.practiceInstitution.bulkCreate.useMutation({
    onSuccess: async () => {
      await utils.practiceInstitution.list.invalidate();
      toast.success("실습기관 CSV 등록이 완료되었습니다.");
      setCsvText("");
    },
    onError: (e) => toast.error(e.message || "실습기관 CSV 등록 실패"),
  });

const bulkDeactivateInstitutionsMut =
  trpc.practiceInstitution.bulkDeactivate.useMutation({
    onSuccess: async () => {
      await utils.practiceInstitution.list.invalidate();
      toast.success("실습기관 전체 비활성화가 완료되었습니다.");
      setDeactivateOpen(false);
    },
    onError: (e) => toast.error(e.message || "실습기관 전체 비활성화 실패"),
  });

const deleteEducationCenterMut =
  trpc.practiceEducationCenter.delete.useMutation({
    onSuccess: async () => {
      await utils.practiceEducationCenter.list.invalidate();
      toast.success("실습교육원이 삭제되었습니다.");
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e.message || "실습교육원 삭제 실패"),
  });

const deleteInstitutionMut =
  trpc.practiceInstitution.delete.useMutation({
    onSuccess: async () => {
      await utils.practiceInstitution.list.invalidate();
      toast.success("실습기관이 삭제되었습니다.");
      setDeleteTarget(null);
    },
    onError: (e) => toast.error(e.message || "실습기관 삭제 실패"),
  });

const createCategoryMut = trpc.practiceListCategory.create.useMutation({
  onSuccess: async () => {
    await Promise.all([
      utils.practiceListCategory.list.invalidate(),
    ]);
    toast.success("리스트가 추가되었습니다.");
    setNewCategoryName("");
  },
  onError: (e) => toast.error(e.message || "리스트 추가 실패"),
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
setFinderEducationCategoryId(null);
setFinderInstitutionCategoryId(null);
setFinderResults(buildFinderBaseResults(row));
    setSelectedFinderItem(null);
    setFinderSearchPoint(null);
    setFinderResolvedAddress("");
    setFinderSettingsItem(null);
    setFinderOpen(true);
  };

  const openFinderSettings = (item: FinderItem) => {
    setFinderSettingsItem(item);
    setFinderInactiveEnabled(!!item.isInactive);
    setFinderInactiveStartDate(String(item.inactiveStartDate || "").slice(0, 10));
    setFinderInactiveEndDate(String(item.inactiveEndDate || "").slice(0, 10));
    setFinderInactiveReason(item.inactiveReason || "");
    setFinderHideOnMapWhenInactive(item.hideOnMapWhenInactive ?? true);
  };

  const applyFinderItemLocalPatch = (
    itemId: string | number,
    itemType: FinderItemType,
    patch: Partial<FinderItem>
  ) => {
    setFinderResults((prev) =>
      prev.map((item) =>
        String(item.id) === String(itemId) && item.type === itemType
          ? { ...item, ...patch }
          : item
      )
    );

    setSelectedFinderItem((prev) => {
      if (!prev) return prev;
      if (String(prev.id) !== String(itemId) || prev.type !== itemType) return prev;
      return { ...prev, ...patch };
    });

    setFinderSettingsItem((prev) => {
      if (!prev) return prev;
      if (String(prev.id) !== String(itemId) || prev.type !== itemType) return prev;
      return { ...prev, ...patch };
    });
  };
const parseCsvLines = (text: string) => {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split(",").map((col) => col.trim()));
};

const handleUploadCsv = () => {
  if (!csvText.trim()) {
    toast.error("CSV 내용을 입력해주세요.");
    return;
  }

  const rows = parseCsvLines(csvText);
  if (rows.length <= 1) {
    toast.error("헤더 포함 2줄 이상 필요합니다.");
    return;
  }

  const body = rows.slice(1);

  if (masterListType === "education") {
    const parsed = body
  .filter((cols) => cols[0])
  .map((cols, idx) => ({
    categoryId: selectedCategoryId || undefined,
    name: cols[0] || "",
    phone: cols[1] || "",
    address: cols[2] || "",
    detailAddress: cols[3] || "",
    feeAmount: cols[4] || "0",
    latitude: cols[5] || "",
    longitude: cols[6] || "",
    representativeName: cols[7] || "",
    availableCourse: cols[8] || "",
    memo: cols[9] || "",
    isActive: cols[10] ? cols[10] === "true" : true,
    sortOrder: cols[11] ? Number(cols[11]) : idx,
  }));

    bulkCreateEducationCentersMut.mutate({ rows: parsed });
    return;
  }

  const parsed = body
  .filter((cols) => cols[0])
  .map((cols, idx) => ({
    institutionType: "institution" as const,
    categoryId: selectedCategoryId || undefined,
    name: cols[0] || "",
    representativeName: cols[1] || "",
    phone: cols[2] || "",
    address: cols[3] || "",
    detailAddress: cols[4] || "",
    price: cols[5] || "0",
    latitude: cols[6] || "",
    longitude: cols[7] || "",
    availableCourse: cols[8] || "",
    memo: cols[9] || "",
    isActive: cols[10] ? cols[10] === "true" : true,
    sortOrder: cols[11] ? Number(cols[11]) : idx,
  }));

  bulkCreateInstitutionsMut.mutate({ rows: parsed });
};

const handleBulkDeactivate = () => {
  if (masterListType === "education") {
    bulkDeactivateEducationCentersMut.mutate({
      inactiveReason: bulkInactiveReason || "일괄 비활성화",
      inactiveStartDate: bulkInactiveStartDate || null,
      inactiveEndDate: bulkInactiveEndDate || null,
      hideOnMapWhenInactive: bulkHideOnMapWhenInactive,
    });
    return;
  }

  bulkDeactivateInstitutionsMut.mutate({
    institutionType: "institution",
    inactiveReason: bulkInactiveReason || "일괄 비활성화",
    inactiveStartDate: bulkInactiveStartDate || null,
    inactiveEndDate: bulkInactiveEndDate || null,
    hideOnMapWhenInactive: bulkHideOnMapWhenInactive,
  });
};

const handleDeleteMasterItem = () => {
  if (!deleteTarget) return;

  if (deleteTarget.type === "education") {
    deleteEducationCenterMut.mutate({ id: Number(deleteTarget.id) });
    return;
  }

  deleteInstitutionMut.mutate({ id: Number(deleteTarget.id) });
};

  const saveFinderSettings = async () => {
    if (!finderSettingsItem) {
      toast.error("설정할 기관이 없습니다.");
      return;
    }

    const payload = {
      id: Number(finderSettingsItem.id),
      isInactive: finderInactiveEnabled,
      inactiveReason: finderInactiveReason.trim() || null,
      inactiveStartDate: finderInactiveStartDate || null,
      inactiveEndDate: finderInactiveEndDate || null,
      hideOnMapWhenInactive: finderHideOnMapWhenInactive,
    };

    if (!payload.id || Number.isNaN(payload.id)) {
      toast.error("저장할 기관 ID가 올바르지 않습니다.");
      return;
    }

    try {
      if (finderSettingsItem.type === "education") {
        await updateEducationAvailabilityMut.mutateAsync(payload as any);
      } else {
        await updateInstitutionAvailabilityMut.mutateAsync(payload as any);
      }

      applyFinderItemLocalPatch(finderSettingsItem.id, finderSettingsItem.type, {
        isInactive: finderInactiveEnabled,
        inactiveReason: finderInactiveReason.trim() || "",
        inactiveStartDate: finderInactiveStartDate || null,
        inactiveEndDate: finderInactiveEndDate || null,
        hideOnMapWhenInactive: finderHideOnMapWhenInactive,
      });

      toast.success("비활성화 설정이 반영되었습니다.");
    } catch (e: any) {
      toast.error(e?.message || "비활성화 설정 저장 중 오류가 발생했습니다.");
    }
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
  const educationItems = (educationCenterDb as any[]).filter((item) => {
    if (!finderEducationCategoryId) return true;
    return Number(item.categoryId || 0) === finderEducationCategoryId;
  });

  for (const item of educationItems) {
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
            isInactive: !!item.isInactive,
            inactiveReason: item.inactiveReason || "",
            inactiveStartDate: item.inactiveStartDate || null,
            inactiveEndDate: item.inactiveEndDate || null,
            hideOnMapWhenInactive: item.hideOnMapWhenInactive ?? true,
          });
        }
      }

      if (finderIncludePracticeInstitution) {
  const institutionItems = (practiceInstitutionDb as any[]).filter((item) => {
    if (!finderInstitutionCategoryId) return true;
    return Number(item.categoryId || 0) === finderInstitutionCategoryId;
  });

  for (const item of institutionItems) {
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
            isInactive: !!item.isInactive,
            inactiveReason: item.inactiveReason || "",
            inactiveStartDate: item.inactiveStartDate || null,
            inactiveEndDate: item.inactiveEndDate || null,
            hideOnMapWhenInactive: item.hideOnMapWhenInactive ?? true,
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
      setFinderSettingsItem(null);

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

    if (isFinderItemInactiveNow(selectedFinderItem)) {
      toast.error(
        getFinderInactiveText(selectedFinderItem) ||
          "현재 비활성화된 기관은 반영할 수 없습니다."
      );
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

  const mapVisibleFinderResults = useMemo(() => {
    return finderResults.filter((item) => {
      const inactiveNow = isFinderItemInactiveNow(item);

      if (!inactiveNow) return true;
      if (item.hideOnMapWhenInactive === false) return true;

      return false;
    });
  }, [finderResults]);

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

  const savingFinderSettings =
    updateEducationAvailabilityMut.isPending ||
    updateInstitutionAvailabilityMut.isPending;

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
{isHostManager && (
  <div className="mt-3 flex flex-wrap items-center gap-2">
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        setMasterListType("education");
        setSelectedCategoryId(null);
        setMasterOpen(true);
      }}
    >
      교육원 리스트 관리
    </Button>

    <Button
      type="button"
      variant="outline"
      onClick={() => {
        setMasterListType("institution");
        setSelectedCategoryId(null);
        setMasterOpen(true);
      }}
    >
      기관 리스트 관리
    </Button>

    <Button
      type="button"
      variant="outline"
      onClick={() => setCategoryManageOpen(true)}
    >
      리스트 추가
    </Button>

    <Button
      type="button"
      variant="destructive"
      onClick={() => setDeactivateOpen(true)}
    >
      일괄 비활성화
    </Button>
  </div>
)}

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
<Dialog open={masterOpen} onOpenChange={setMasterOpen}>
  <DialogContent className="max-w-6xl">
    <DialogHeader>
      <DialogTitle>
        {masterListType === "education" ? "실습교육원 관리" : "실습기관 관리"}
      </DialogTitle>
      <DialogDescription>
        CSV 등록, 현재 목록 확인, 개별 삭제를 할 수 있습니다.
      </DialogDescription>
    </DialogHeader>

<div className="flex flex-wrap gap-2">
  {(masterListType === "education" ? educationCategories : institutionCategories).map((cat: any) => (
    <Button
      key={cat.id}
      type="button"
      variant={selectedCategoryId === cat.id ? "default" : "outline"}
      size="sm"
      onClick={() => setSelectedCategoryId(cat.id)}
    >
      {cat.name}
    </Button>
  ))}
</div>

    <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-3">
        <Label>CSV 입력</Label>
        <Textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          rows={16}
          placeholder={
            masterListType === "education"
              ? "name,phone,address,detailAddress,feeAmount,latitude,longitude,representativeName,availableCourse,memo,isActive,sortOrder"
              : "name,representativeName,phone,address,detailAddress,price,latitude,longitude,availableCourse,memo,isActive,sortOrder"
          }
        />
        <Button type="button" onClick={handleUploadCsv} className="w-full">
          CSV 등록
        </Button>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border">
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b">
                  <th className="px-3 py-2 text-left">이름</th>
                  <th className="px-3 py-2 text-left">주소</th>
                  <th className="px-3 py-2 text-left">전화</th>
                  <th className="px-3 py-2 text-left">상태</th>
                  <th className="px-3 py-2 text-right">관리</th>
                </tr>
              </thead>
              <tbody>
                {(masterListType === "education"
  ? (educationCenterDb as any[])
      .filter((item) => {
        if (!selectedCategoryId) return true;
        return Number(item.categoryId || 0) === selectedCategoryId;
      })
      .map((item) => ({
        ...item,
        type: "education" as const,
      }))
  : (practiceInstitutionDb as any[])
      .filter((item) => {
        if (!selectedCategoryId) return true;
        return Number(item.categoryId || 0) === selectedCategoryId;
      })
      .map((item) => ({
        ...item,
        type: "institution" as const,
      }))
).map((item: any) => (
                  <tr key={`${item.type}-${item.id}`} className="border-b">
                    <td className="px-3 py-2">{item.name}</td>
                    <td className="px-3 py-2">
                      {[item.address, item.detailAddress].filter(Boolean).join(" ")}
                    </td>
                    <td className="px-3 py-2">{item.phone || "-"}</td>
                    <td className="px-3 py-2">
                      {item.isInactive ? "비활성" : item.isActive === false ? "미사용" : "사용"}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            openFinderSettings({
                              id: item.id,
                              type: item.type,
                              name: item.name,
                              address: item.address,
                              isInactive: item.isInactive,
                              inactiveReason: item.inactiveReason,
                              inactiveStartDate: item.inactiveStartDate,
                              inactiveEndDate: item.inactiveEndDate,
                              hideOnMapWhenInactive: item.hideOnMapWhenInactive,
                            } as any)
                          }
                        >
                          비활성설정
                        </Button>

                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setDeleteTarget({
                              id: item.id,
                              type: item.type,
                              name: item.name,
                            } as any)
                          }
                        >
                          삭제
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </DialogContent>
</Dialog>
<Dialog open={deactivateOpen} onOpenChange={setDeactivateOpen}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>일괄 비활성화</DialogTitle>
      <DialogDescription>
        선택한 마스터 전체를 한 번에 비활성화합니다. 지도 숨김도 같이 적용할 수 있습니다.
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-4">
      <div className="space-y-2">
        <Label>대상</Label>
        <Select
          value={masterListType}
          onValueChange={(v) => setMasterListType(v as "education" | "institution")}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="education">실습교육원</SelectItem>
            <SelectItem value="institution">실습기관</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>사유</Label>
        <Input
          value={bulkInactiveReason}
          onChange={(e) => setBulkInactiveReason(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>시작일</Label>
          <Input
            type="date"
            value={bulkInactiveStartDate}
            onChange={(e) => setBulkInactiveStartDate(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>종료일</Label>
          <Input
            type="date"
            value={bulkInactiveEndDate}
            onChange={(e) => setBulkInactiveEndDate(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-lg border px-3 py-2">
        <div>
          <div className="text-sm font-medium">비활성 시 지도에서 숨기기</div>
        </div>
        <Button
          type="button"
          variant={bulkHideOnMapWhenInactive ? "default" : "outline"}
          size="sm"
          onClick={() =>
            setBulkHideOnMapWhenInactive((prev) => !prev)
          }
        >
          {bulkHideOnMapWhenInactive ? "ON" : "OFF"}
        </Button>
      </div>
    </div>

    <DialogFooter>
      <Button type="button" variant="outline" onClick={() => setDeactivateOpen(false)}>
        취소
      </Button>
      <Button type="button" variant="destructive" onClick={handleBulkDeactivate}>
        확인 후 일괄 비활성화
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
<Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
  <DialogContent className="max-w-md">
    <DialogHeader>
      <DialogTitle>기관 삭제</DialogTitle>
      <DialogDescription>
        {deleteTarget?.name} 항목을 삭제합니다. 정말 진행하시겠습니까?
      </DialogDescription>
    </DialogHeader>

    <DialogFooter>
      <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
        취소
      </Button>
      <Button type="button" variant="destructive" onClick={handleDeleteMasterItem}>
        삭제 확인
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

<Dialog open={categoryManageOpen} onOpenChange={setCategoryManageOpen}>
  <DialogContent className="max-w-2xl">
    <DialogHeader>
      <DialogTitle>리스트 관리</DialogTitle>
      <DialogDescription>
        실습배정지원센터에서 사용할 리스트를 직접 추가합니다.
      </DialogDescription>
    </DialogHeader>

    <div className="space-y-5">
      <div className="rounded-xl border p-4 space-y-4">
        <div className="font-medium">새 리스트 추가</div>

        <div className="space-y-2">
          <Label>리스트 구분</Label>
          <Select
            value={masterListType}
            onValueChange={(v) => setMasterListType(v as "education" | "institution")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="education">실습교육원 리스트</SelectItem>
              <SelectItem value="institution">실습기관 리스트</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>리스트 이름</Label>
          <Input
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            placeholder="예: 사회복지사 실습기관 / 보육교사 실습기관"
          />
        </div>

        <Button
          type="button"
          onClick={() => {
            if (!newCategoryName.trim()) {
              toast.error("리스트 이름을 입력해주세요.");
              return;
            }

            createCategoryMut.mutate({
              name: newCategoryName.trim(),
              listType: masterListType,
            });
          }}
        >
          리스트 추가
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border p-4">
          <div className="mb-3 font-medium">실습교육원 리스트</div>
          <div className="space-y-2">
            {educationCategories.length === 0 ? (
              <div className="text-sm text-muted-foreground">등록된 리스트가 없습니다.</div>
            ) : (
              educationCategories.map((cat: any) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <span className="text-sm">{cat.name}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMasterListType("education");
                      setSelectedCategoryId(cat.id);
                      setMasterOpen(true);
                      setCategoryManageOpen(false);
                    }}
                  >
                    열기
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border p-4">
          <div className="mb-3 font-medium">실습기관 리스트</div>
          <div className="space-y-2">
            {institutionCategories.length === 0 ? (
              <div className="text-sm text-muted-foreground">등록된 리스트가 없습니다.</div>
            ) : (
              institutionCategories.map((cat: any) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <span className="text-sm">{cat.name}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setMasterListType("institution");
                      setSelectedCategoryId(cat.id);
                      setMasterOpen(true);
                      setCategoryManageOpen(false);
                    }}
                  >
                    열기
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>

    <DialogFooter>
      <Button type="button" variant="outline" onClick={() => setCategoryManageOpen(false)}>
        닫기
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
            <div className="flex w-[380px] min-w-[380px] flex-col border-r bg-white">
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

<div className="space-y-3">
  {finderIncludeEducationCenter && (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">
        실습교육원 리스트 선택
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={finderEducationCategoryId === null ? "default" : "outline"}
          size="sm"
          onClick={() => setFinderEducationCategoryId(null)}
        >
          전체
        </Button>

        {educationCategories.map((cat: any) => (
          <Button
            key={`finder-edu-${cat.id}`}
            type="button"
            variant={finderEducationCategoryId === cat.id ? "default" : "outline"}
            size="sm"
            onClick={() => setFinderEducationCategoryId(cat.id)}
          >
            {cat.name}
          </Button>
        ))}
      </div>
    </div>
  )}

  {finderIncludePracticeInstitution && (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">
        실습기관 리스트 선택
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={finderInstitutionCategoryId === null ? "default" : "outline"}
          size="sm"
          onClick={() => setFinderInstitutionCategoryId(null)}
        >
          전체
        </Button>

        {institutionCategories.map((cat: any) => (
          <Button
            key={`finder-inst-${cat.id}`}
            type="button"
            variant={finderInstitutionCategoryId === cat.id ? "default" : "outline"}
            size="sm"
            onClick={() => setFinderInstitutionCategoryId(cat.id)}
          >
            {cat.name}
          </Button>
        ))}
      </div>
    </div>
  )}
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
  위 주소를 기준으로 선택한 리스트의 실습교육원 / 실습기관을 거리순으로 보여줍니다.
</div>
                  </div>
                )}
              </div>

              <div className="border-b px-4 py-3 text-sm">
                <div className="font-medium">검색 결과</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  왼쪽 리스트는 최대 100건까지 표시되고, 비활성 기관도 남아있지만
                  지도에서는 비활성 기간 동안 숨길 수 있습니다.
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
                      const inactiveNow = isFinderItemInactiveNow(item);
                      const hasConfig = hasFinderInactiveConfig(item);

                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          type="button"
                          className={`relative w-full p-4 text-left transition hover:bg-muted/30 ${
                            isSelected
                              ? item.type === "education"
                                ? "bg-blue-50"
                                : "bg-orange-50"
                              : hasConfig
                              ? "bg-yellow-50/80"
                              : ""
                          }`}
                          onClick={() => setSelectedFinderItem(item)}
                        >
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openFinderSettings(item);
                            }}
                            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-lg border bg-white text-gray-600 transition hover:bg-gray-50"
                            title="비활성화 설정"
                          >
                            <Settings2 className="h-4 w-4" />
                          </button>

                          <div className="space-y-2 pr-10">
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

                            {hasConfig ? (
                              <div className="space-y-1">
                                <div className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-800">
                                  {inactiveNow ? "현재 비활성화" : "비활성화 설정 있음"}
                                </div>
                                <div className="text-xs text-yellow-700">
                                  {getFinderInactiveText(item)}
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-emerald-600">사용 가능</div>
                            )}

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
                    {hasFinderInactiveConfig(selectedFinderItem) && (
                      <div className="mt-2 text-yellow-700">
                        {getFinderInactiveText(selectedFinderItem)}
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
                    disabled={
                      !selectedFinderItem ||
                      updatePracticeSupportMut.isPending ||
                      (selectedFinderItem
                        ? isFinderItemInactiveNow(selectedFinderItem)
                        : false)
                    }
                  >
                    선택 반영
                  </Button>
                </div>
              </div>
            </div>

            <div className="relative min-w-0 flex-1 bg-gray-100">
              <div className="h-full w-full">
                <KakaoMap
                  address={finderAddress}
                  searchTrigger={finderSearchTrigger}
                  includeEducationCenter={finderIncludeEducationCenter}
                  includePracticeInstitution={finderIncludePracticeInstitution}
                  results={mapVisibleFinderResults}
                  selectedResult={
                    selectedFinderItem && !isFinderItemInactiveNow(selectedFinderItem)
                      ? selectedFinderItem
                      : null
                  }
                  searchPoint={finderSearchPoint}
                  searchPointLabel={finderResolvedAddress || finderAddress}
                  showSearchPointMarker={true}
                  onSelectResult={(item: FinderItem) => setSelectedFinderItem(item)}
                />
              </div>

              {finderSettingsItem ? (
                <div className="absolute bottom-5 right-5 z-10 w-[360px] rounded-2xl border bg-white/95 p-4 shadow-xl backdrop-blur">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Settings2 className="h-4 w-4 text-yellow-700" />
                        <p className="font-semibold">기관 비활성화 설정</p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {getTypeLabel(finderSettingsItem.type)} · {finderSettingsItem.name}
                      </p>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setFinderSettingsItem(null)}
                    >
                      닫기
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="rounded-xl bg-yellow-50 px-3 py-3 text-xs text-yellow-800">
                      전화 확인 후 올해 안함 / 현재 사용 안함 / 특정 기간 사용 불가
                      같은 정보를 저장하면, 왼쪽 리스트는 노란색으로 표시되고
                      지도에서는 기간 중 자동 숨김 처리할 수 있습니다.
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">사용 상태</Label>
                      <Select
                        value={finderInactiveEnabled ? "inactive" : "active"}
                        onValueChange={(v) => setFinderInactiveEnabled(v === "inactive")}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">사용 가능</SelectItem>
                          <SelectItem value="inactive">비활성화</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          시작일
                        </Label>
                        <Input
                          type="date"
                          value={finderInactiveStartDate}
                          onChange={(e) => setFinderInactiveStartDate(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" />
                          종료일
                        </Label>
                        <Input
                          type="date"
                          value={finderInactiveEndDate}
                          onChange={(e) => setFinderInactiveEndDate(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        비활성화 사유
                      </Label>
                      <Textarea
                        rows={4}
                        value={finderInactiveReason}
                        onChange={(e) => setFinderInactiveReason(e.target.value)}
                        placeholder="예: 2026년 운영 안함 / 올해 실습 미운영 / 현재 전화 후 사용 중단 확인"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label className="text-xs">비활성 기간 지도 표시</Label>
                      <Select
                        value={finderHideOnMapWhenInactive ? "hide" : "show"}
                        onValueChange={(v) =>
                          setFinderHideOnMapWhenInactive(v === "hide")
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hide">지도에서 숨김</SelectItem>
                          <SelectItem value="show">지도에도 표시</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="rounded-xl bg-muted/40 px-3 py-3 text-xs text-muted-foreground">
                      <div>현재 미리보기</div>
                      <div className="mt-1 text-yellow-700">
                        {finderInactiveEnabled
                          ? `${
                              finderInactiveReason.trim() || "비활성화"
                            } ${
                              finderInactiveStartDate || finderInactiveEndDate
                                ? `(${finderInactiveStartDate || "-"} ~ ${
                                    finderInactiveEndDate || "미정"
                                  })`
                                : ""
                            }`
                          : "사용 가능"}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setFinderSettingsItem(null)}
                      >
                        닫기
                      </Button>
                      <Button
                        className="flex-1"
                        onClick={saveFinderSettings}
                        disabled={savingFinderSettings}
                      >
                        저장
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}