import React, { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
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
categoryId?: number;
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

function normalizeNumberText(value: string) {
  return String(value || "")
    .replace(/,/g, "")
    .trim();
}

function normalizeBooleanText(value: string) {
  return String(value || "").trim().toLowerCase() === "true";
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
const [finderRecommendedEducationCategoryId, setFinderRecommendedEducationCategoryId] =
  useState<number | null>(null);
const [finderRecommendedInstitutionCategoryId, setFinderRecommendedInstitutionCategoryId] =
  useState<number | null>(null);
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
const [filterCategory, setFilterCategory] = useState<{
  type: "education" | "institution";
  id: number;
} | null>(null);

const [newCategoryName, setNewCategoryName] = useState("");
const [categoryManageOpen, setCategoryManageOpen] = useState(false);

const [csvText, setCsvText] = useState("");
const [isCsvDragOver, setIsCsvDragOver] = useState(false);
const [csvMode, setCsvMode] = useState<"append" | "replace">("append");
const [deactivateOpen, setDeactivateOpen] = useState(false);
const [bulkInactiveReason, setBulkInactiveReason] = useState("일괄 비활성화");
const [bulkInactiveStartDate, setBulkInactiveStartDate] = useState("");
const [bulkInactiveEndDate, setBulkInactiveEndDate] = useState("");
const [bulkHideOnMapWhenInactive, setBulkHideOnMapWhenInactive] = useState(true);

const [deleteTarget, setDeleteTarget] = useState<FinderItem | null>(null);
const [csvPreviewRows, setCsvPreviewRows] = useState<string[][]>([]);
const [csvUploadSummary, setCsvUploadSummary] = useState<{
  mode: "append" | "replace";
  total: number;
  created: number;
  updated: number;
  failed: number;
  failedRows: Array<{ rowIndex: number; name?: string; address?: string; reason: string }>;
} | null>(null);

  const { data: practiceSupportList, isLoading } =
    trpc.practiceSupport.list.useQuery();

  const {
  data: educationCenterDb = [],
  refetch: refetchEducationCenters,
} = trpc.practiceEducationCenter.list.useQuery(undefined, {
  staleTime: 0,
  refetchOnMount: "always",
  refetchOnWindowFocus: true,
});

const {
  data: practiceInstitutionDbRaw = [],
  refetch: refetchPracticeInstitutions,
} = trpc.practiceInstitution.list.useQuery(undefined, {
  staleTime: 0,
  refetchOnMount: "always",
  refetchOnWindowFocus: true,
});

const practiceInstitutionDb = useMemo(
  () =>
    (practiceInstitutionDbRaw as any[]).filter(
      (item) => String(item.institutionType ?? "institution") === "institution"
    ),
  [practiceInstitutionDbRaw]
);

const {
  data: educationCategories = [],
  refetch: refetchEducationCategories,
} = trpc.practiceListCategory.list.useQuery(
  { listType: "education" },
  {
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  }
);

const {
  data: institutionCategories = [],
  refetch: refetchInstitutionCategories,
} = trpc.practiceListCategory.list.useQuery(
  { listType: "institution" },
  {
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  }
);


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
    onSuccess: async (result) => {
      await utils.practiceEducationCenter.list.invalidate();
      toast.success("실습교육원 CSV 등록이 완료되었습니다.");
      setCsvText("");
setCsvPreviewRows([]);
setIsCsvDragOver(false);
setCsvUploadSummary(result as any);
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
    onSuccess: async (result) => {
      await utils.practiceInstitution.list.invalidate();
      await refetchPracticeInstitutions();
      toast.success("실습기관 CSV 등록이 완료되었습니다.");
      setCsvText("");
      setCsvPreviewRows([]);
      setIsCsvDragOver(false);
      setCsvUploadSummary(result as any);
    },
    onError: (e) => toast.error(e.message || "실습기관 CSV 등록 실패"),
  });

const bulkDeactivateInstitutionsMut =
  trpc.practiceInstitution.bulkDeactivate.useMutation({
    onSuccess: async () => {
      await utils.practiceInstitution.list.invalidate();
      await refetchPracticeInstitutions();
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

const fixEducationCoordsMut =
  trpc.practiceEducationCenter.fixCoords.useMutation({
    onSuccess: (res) => {
      toast.success(
        `좌표 보정 완료 (${res.success}/${res.total})`
      );
      utils.practiceEducationCenter.list.invalidate();
    },
  });

const fixInstitutionCoordsMut =
  trpc.practiceInstitution.fixCoords.useMutation({
    onSuccess: async (res) => {
      toast.success(
        `좌표 보정 완료 (${res.success}/${res.total})`
      );
      await utils.practiceInstitution.list.invalidate();
      await refetchPracticeInstitutions();
    },
  });

const deleteInstitutionMut =
  trpc.practiceInstitution.delete.useMutation({
    onSuccess: async () => {
      await utils.practiceInstitution.list.invalidate();
      await refetchPracticeInstitutions();
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
practiceDate: row.practiceDate || "",
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

if (
  selectedRow?.paymentStatus === "결제" &&
  Number(selectedRow?.feeAmount || 0) <= 0
) {
  toast.error("결제 처리하려면 금액을 먼저 입력해주세요.");
  return;
}

    if (!selectedRow?.id) return;

    updatePracticeSupportMut.mutate({
      id: selectedRow.id,
      inputAddress: selectedRow.inputAddress || undefined,
      detailAddress: selectedRow.detailAddress || undefined,
      managerName: selectedRow.managerName || undefined,
      practiceHours: selectedRow.practiceHours
        ? Number(selectedRow.practiceHours)
        : undefined,
      practiceDate: selectedRow.practiceDate || undefined,
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

  const handleQuickPaymentChange = (row: any, nextStatus: PaymentStatus) => {
  if (nextStatus === "결제" && Number(row.feeAmount || 0) <= 0) {
    toast.error("먼저 금액을 입력한 뒤 결제 처리해주세요.");
    return;
  }

  updatePracticeSupportMut.mutate({
    id: row.id,
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

const findCategoryIdByCourseKeyword = (
  categories: any[],
  courseText: string,
  keywords: string[]
) => {
  const lowerCourse = String(courseText || "").toLowerCase();

  const matchedKeyword = keywords.find((kw) =>
    lowerCourse.includes(String(kw).toLowerCase())
  );

  if (!matchedKeyword) return null;

  const matchedCategory = categories.find((cat: any) =>
    String(cat.name || "").toLowerCase().includes(String(matchedKeyword).toLowerCase())
  );

  return matchedCategory ? Number(matchedCategory.id) : null;
};

const applyRecommendedFinderCategory = (row?: any | null) => {
  const courseText = String(row?.course || row?.desiredCourse || "").trim();
  if (!courseText) return;

  const institutionCategoryId =
    findCategoryIdByCourseKeyword(institutionCategories, courseText, [
      "사회복지사",
      "보육교사",
      "한국어교원",
    ]);

  const educationCategoryId =
    findCategoryIdByCourseKeyword(educationCategories, courseText, [
      "사회복지사",
      "보육교사",
      "한국어교원",
    ]);

  if (institutionCategoryId) {
  setFinderInstitutionCategoryId(institutionCategoryId);
  setFinderRecommendedInstitutionCategoryId(institutionCategoryId);
}

if (educationCategoryId) {
  setFinderEducationCategoryId(educationCategoryId);
  setFinderRecommendedEducationCategoryId(educationCategoryId);
}
};

  const openFinder = (row?: any | null) => {
refetchPracticeInstitutions();
refetchEducationCenters();
refetchInstitutionCategories();
refetchEducationCategories();

    const baseAddress = row?.inputAddress || row?.address || "";

    setFinderTargetRow(row || null);
    setFinderAddress(baseAddress.trim());
   setFinderIncludeEducationCenter(true);
setFinderIncludePracticeInstitution(true);
setFinderEducationCategoryId(null);
setFinderInstitutionCategoryId(null);
setFinderRecommendedEducationCategoryId(null);
setFinderRecommendedInstitutionCategoryId(null);
setFilterCategory(null);

applyRecommendedFinderCategory(row);

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
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
    skipEmptyLines: true,
  });

  if (parsed.errors?.length) {
    console.warn("[CSV PARSE ERROR]", parsed.errors);
  }

  return (parsed.data || []).map((row) =>
    (row || []).map((col) => String(col ?? "").trim())
  );
};

const getSampleCsvText = () => {
  if (masterListType === "education") {
    return [
      "이름,전화번호,주소,상세주소,금액,위도,경도,담당자명,가능과정,메모,사용여부,정렬순서",
      "위드원평생교육원,02-123-4567,서울 도봉구 방학동 123-4,3층,300000,37.123456,127.123456,홍길동,사회복지사2급,주말 가능,true,1",
    ].join("\n");
  }

  return [
    "이름,담당자명,전화번호,주소,상세주소,금액,위도,경도,가능과정,메모,사용여부,정렬순서",
    "보육사랑실습기관,김담당,02-123-4567,서울 도봉구 방학동 123-4,2층,200000,37.123456,127.123456,보육교사,야간 문의 필요,true,1",
  ].join("\n");
};

const downloadSampleCsv = () => {
  const csv = getSampleCsvText();
  const blob = new Blob(["\ufeff" + csv], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download =
    masterListType === "education"
      ? "practice-education-sample.csv"
      : "practice-institution-sample.csv";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const fillSampleCsvToEditor = () => {
  const sample = getSampleCsvText();
  setCsvText(sample);

  try {
    const parsed = parseCsvLines(sample);
    setCsvPreviewRows(parsed);
    setCsvUploadSummary(null);
    toast.success("샘플 CSV를 입력창에 넣었습니다.");
  } catch {
    setCsvPreviewRows([]);
    toast.error("샘플 CSV 파싱 중 오류가 발생했습니다.");
  }
};

const readCsvFile = async (file: File) => {
  const text = (await file.text()).replace(/^\uFEFF/, "");
  setCsvText(text);

  try {
    const parsed = parseCsvLines(text);
    setCsvPreviewRows(parsed);
  } catch {
    setCsvPreviewRows([]);
  }
};

const handleCsvFileChange = async (
  e: React.ChangeEvent<HTMLInputElement>
) => {
  const file = e.target.files?.[0];
  if (!file) return;

  await readCsvFile(file);
  e.target.value = "";
};

const handleCsvDrop = async (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  setIsCsvDragOver(false);

  const file = e.dataTransfer.files?.[0];
  if (!file) return;

  const lowerName = file.name.toLowerCase();
  if (!lowerName.endsWith(".csv") && file.type !== "text/csv") {
    toast.error("CSV 파일만 업로드할 수 있습니다.");
    return;
  }

  await readCsvFile(file);
};

const handleCsvDragOver = (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  setIsCsvDragOver(true);
};

const handleCsvDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  setIsCsvDragOver(false);
};

const copyFailedRows = async () => {
  if (!failedRowsText.trim()) {
    toast.error("복사할 실패 행이 없습니다.");
    return;
  }

  try {
    await navigator.clipboard.writeText(failedRowsText);
    toast.success("실패 행 CSV를 복사했습니다.");
  } catch {
    toast.error("클립보드 복사에 실패했습니다.");
  }
};

const downloadFailedRowsCsv = () => {
  if (!failedRowsText.trim()) {
    toast.error("다운로드할 실패 행이 없습니다.");
    return;
  }

  const blob = new Blob(["\ufeff" + failedRowsText], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download =
    masterListType === "education"
      ? "practice-education-failed-rows.csv"
      : "practice-institution-failed-rows.csv";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const applyFailedRowsToEditor = () => {
  if (!failedRowsText.trim()) {
    toast.error("적용할 실패 행이 없습니다.");
    return;
  }

  setCsvText(failedRowsText);

  try {
    const parsed = parseCsvLines(failedRowsText);
    setCsvPreviewRows(parsed);
    setCsvUploadSummary(null);
    toast.success("실패 행을 입력창에 다시 불러왔습니다.");
  } catch {
    setCsvPreviewRows([]);
    toast.error("실패 행 재적용 중 파싱 오류가 발생했습니다.");
  }
};

const handleUploadCsv = async () => {
  if (!csvText.trim()) {
    toast.error("CSV 내용을 입력해주세요.");
    return;
  }

setCsvUploadSummary(null);

if (!selectedCategoryId) {
  toast.error("먼저 등록할 리스트를 선택해주세요.");
  return;
}

  const rows = parseCsvLines(csvText);
  if (rows.length <= 1) {
    toast.error("헤더 포함 2줄 이상 필요합니다.");
    return;
  }

const header = rows[0]?.map((v) => String(v || "").trim());

if (masterListType === "education") {
  const expected = ["이름", "전화번호", "주소"];
  const ok = expected.every((key, idx) => header?.[idx] === key);

  if (!ok) {
    toast.error("실습교육원 CSV 헤더 형식이 올바르지 않습니다.");
    return;
  }
} else {
  const expected = ["이름", "담당자명", "전화번호"];
  const ok = expected.every((key, idx) => header?.[idx] === key);

  if (!ok) {
    toast.error("실습기관 CSV 헤더 형식이 올바르지 않습니다.");
    return;
  }
}

  const body = rows.slice(1);
if (csvPreviewWarnings.length > 0) {
  toast.error("업로드 전 확인 필요 항목이 있습니다.");
  return;
}

 if (masterListType === "education") {
  const educationRows = body.filter((cols) => cols[0]);

  const parsed: any[] = [];

  for (let i = 0; i < educationRows.length; i++) {
    const cols = educationRows[i];

    const address = cols[2] || "";
    const detailAddress = cols[3] || "";

    let latitude = normalizeNumberText(cols[5] || "");
let longitude = normalizeNumberText(cols[6] || "");

    if ((!latitude || !longitude) && address) {
      try {
        const geo = await geocodeAddress(address);
        latitude = String(geo.lat);
        longitude = String(geo.lng);
      } catch (error) {
        console.warn("[CSV][education] 좌표 변환 실패:", address, error);
      }
    }

    parsed.push({
      categoryId: selectedCategoryId || undefined,
      name: cols[0] || "",
      phone: cols[1] || "",
      address,
      detailAddress,
      feeAmount: normalizeNumberText(cols[4] || "0"),
      latitude,
      longitude,
      representativeName: cols[7] || "",
      availableCourse: cols[8] || "",
      memo: cols[9] || "",
      isActive: cols[10] ? normalizeBooleanText(cols[10]) : true,
sortOrder: cols[11] ? Number(normalizeNumberText(cols[11])) : i,
    });
  }

 bulkCreateEducationCentersMut.mutate({
  rows: parsed,
  mode: csvMode,
  categoryId: selectedCategoryId,
});
return;
}

const institutionRows = body.filter((cols) => cols[0]);

const parsed: any[] = [];

for (let i = 0; i < institutionRows.length; i++) {
  const cols = institutionRows[i];

  const address = cols[3] || "";
  const detailAddress = cols[4] || "";

  let latitude = normalizeNumberText(cols[6] || "");
let longitude = normalizeNumberText(cols[7] || "");

  if ((!latitude || !longitude) && address) {
    try {
      const geo = await geocodeAddress(address);
      latitude = String(geo.lat);
      longitude = String(geo.lng);
    } catch (error) {
      console.warn("[CSV][institution] 좌표 변환 실패:", address, error);
    }
  }

  parsed.push({
    institutionType: "institution" as const,
    categoryId: selectedCategoryId || undefined,
    name: cols[0] || "",
    representativeName: cols[1] || "",
    phone: cols[2] || "",
    address,
    detailAddress,
    price: normalizeNumberText(cols[5] || "0"),
    latitude,
    longitude,
    availableCourse: cols[8] || "",
    memo: cols[9] || "",
    isActive: cols[10] ? normalizeBooleanText(cols[10]) : true,
sortOrder: cols[11] ? Number(normalizeNumberText(cols[11])) : i,
  });
}

bulkCreateInstitutionsMut.mutate({
  rows: parsed,
  mode: csvMode,
  categoryId: selectedCategoryId,
});
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
if (
  filterCategory &&
  (
    filterCategory.type !== "education" ||
    Number(item.categoryId || 0) !== Number(filterCategory.id)
  )
) continue;
  const itemLat = toNum(item.latitude);
  const itemLng = toNum(item.longitude);
  const hasCoords = itemLat !== null && itemLng !== null;

  const distanceKm = hasCoords
    ? haversineDistanceKm(lat, lng, itemLat as number, itemLng as number)
    : null;

 nextResults.push({
  id: item.id,
  categoryId: item.categoryId,
    type: "education",
    name: item.name,
    representativeName: item.representativeName || "",
    phone: item.phone || "",
    address: [item.address, item.detailAddress].filter(Boolean).join(" "),
    price:
  item.feeAmount !== undefined && item.feeAmount !== null && item.feeAmount !== ""
    ? String(item.feeAmount)
    : item.price !== undefined && item.price !== null && item.price !== ""
    ? String(item.price)
    : "",
    distanceKm: hasCoords ? distanceKm!.toFixed(2) : "좌표없음",
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
if (
  filterCategory &&
  (
    filterCategory.type !== "institution" ||
    Number(item.categoryId || 0) !== Number(filterCategory.id)
  )
) continue;
  const itemLat = toNum(item.latitude);
  const itemLng = toNum(item.longitude);
  const hasCoords = itemLat !== null && itemLng !== null;

  const distanceKm = hasCoords
    ? haversineDistanceKm(lat, lng, itemLat as number, itemLng as number)
    : null;

  nextResults.push({
  id: item.id,
  categoryId: item.categoryId,
  type: "institution",
    name: item.name,
    representativeName: item.representativeName || "",
    phone: item.phone || "",
    address: [item.address, item.detailAddress].filter(Boolean).join(" "),
    price:
  item.price !== undefined && item.price !== null && item.price !== ""
    ? String(item.price)
    : item.feeAmount !== undefined && item.feeAmount !== null && item.feeAmount !== ""
    ? String(item.feeAmount)
    : "",
    distanceKm: hasCoords ? distanceKm!.toFixed(2) : "좌표없음",
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
  const da = Number.isFinite(Number(a.distanceKm)) ? Number(a.distanceKm) : 999999;
  const db = Number.isFinite(Number(b.distanceKm)) ? Number(b.distanceKm) : 999999;
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
    if (
      filterCategory &&
      (
        item.type !== filterCategory.type ||
        Number(item.categoryId || 0) !== Number(filterCategory.id)
      )
    ) {
      return false;
    }

    const lat = toNum(item.latitude);
    const lng = toNum(item.longitude);
    if (lat === null || lng === null) return false;

    const inactiveNow = isFinderItemInactiveNow(item);

    if (!inactiveNow) return true;
    if (item.hideOnMapWhenInactive === false) return true;

    return false;
  });
}, [finderResults, filterCategory]);

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

const masterItems = useMemo(() => {
  const base =
    masterListType === "education"
      ? (educationCenterDb as any[]).map((item) => ({
          ...item,
          type: "education" as const,
        }))
      : (practiceInstitutionDb as any[]).map((item) => ({
          ...item,
          type: "institution" as const,
        }));

  return base.filter((item) => {
    if (!selectedCategoryId) return true;
    return Number(item.categoryId || 0) === Number(selectedCategoryId);
  });
}, [
  masterListType,
  educationCenterDb,
  practiceInstitutionDb,
  selectedCategoryId,
]);

const failedRowsText = useMemo(() => {
  if (!csvUploadSummary?.failedRows?.length) return "";

  const header = "rowIndex,name,address,reason";
  const body = csvUploadSummary.failedRows.map((row) =>
    [
      row.rowIndex,
      `"${String(row.name || "").replace(/"/g, '""')}"`,
      `"${String(row.address || "").replace(/"/g, '""')}"`,
      `"${String(row.reason || "").replace(/"/g, '""')}"`,
    ].join(",")
  );

  return [header, ...body].join("\n");
}, [csvUploadSummary]);

const csvPreviewSummary = useMemo(() => {
  if (!csvPreviewRows.length) {
    return {
      total: 0,
      valid: 0,
      emptyNameRows: 0,
    };
  }

  const body = csvPreviewRows.slice(1);

  const valid = body.filter((row) => String(row?.[0] || "").trim()).length;
  const emptyNameRows = body.filter((row) => !String(row?.[0] || "").trim()).length;

  return {
    total: body.length,
    valid,
    emptyNameRows,
  };
}, [csvPreviewRows]);

const csvPreviewWarnings = useMemo(() => {
  if (csvPreviewRows.length <= 1) {
    return [];
  }

  const body = csvPreviewRows.slice(1);
  const warnings: string[] = [];

  const missingAddressCount =
    masterListType === "education"
      ? body.filter((row) => String(row?.[2] || "").trim() === "").length
      : body.filter((row) => String(row?.[3] || "").trim() === "").length;

  const invalidSortOrderCount = body.filter((row) => {
    const idx = 11;
    const v = String(row?.[idx] || "").trim();
    return v !== "" && Number.isNaN(Number(v));
  }).length;

  const invalidLatLngCount =
    masterListType === "education"
      ? body.filter((row) => {
          const lat = String(row?.[5] || "").trim();
          const lng = String(row?.[6] || "").trim();
          return (
            (lat !== "" && Number.isNaN(Number(normalizeNumberText(lat)))) ||
            (lng !== "" && Number.isNaN(Number(normalizeNumberText(lng))))
          );
        }).length
      : body.filter((row) => {
          const lat = String(row?.[6] || "").trim();
          const lng = String(row?.[7] || "").trim();
          return (
            (lat !== "" && Number.isNaN(Number(normalizeNumberText(lat)))) ||
            (lng !== "" && Number.isNaN(Number(normalizeNumberText(lng))))
          );
        }).length;

  if (missingAddressCount > 0) {
    warnings.push(`주소 누락 행 ${missingAddressCount}건`);
  }

  if (invalidSortOrderCount > 0) {
    warnings.push(`정렬순서 숫자 아님 ${invalidSortOrderCount}건`);
  }

  if (invalidLatLngCount > 0) {
    warnings.push(`위도/경도 숫자 형식 오류 ${invalidLatLngCount}건`);
  }

  return warnings;
}, [csvPreviewRows, masterListType]);

useEffect(() => {
  setCsvText("");
  setCsvPreviewRows([]);
  setCsvUploadSummary(null);
  setIsCsvDragOver(false);
}, [masterListType]);

useEffect(() => {
  if (!masterOpen && !finderOpen) return;

  refetchPracticeInstitutions();
  refetchEducationCenters();
  refetchInstitutionCategories();
  refetchEducationCategories();
}, [
  masterOpen,
  finderOpen,
  refetchPracticeInstitutions,
  refetchEducationCenters,
  refetchInstitutionCategories,
  refetchEducationCategories,
]);

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
  실습예정일
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
<th className="px-3 py-3 text-right font-medium text-muted-foreground">
  금액
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
  <div className="text-sm">{row.practiceDate || "-"}</div>
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

<td className="px-3 py-3 text-right font-medium">
  {Number(row.feeAmount || 0).toLocaleString()}원
</td>


                      <td className="px-3 py-3">
                        <Select
                          value={row.paymentStatus || "미결제"}
                          onValueChange={(v) =>
  handleQuickPaymentChange(row, v as PaymentStatus)
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
<div className="space-y-1">
  <Label className="text-xs">실습예정일</Label>
  <Input
    value={selectedRow.practiceDate || ""}
    onChange={(e) =>
      setSelectedRow((prev: any) => ({
        ...prev,
        practiceDate: e.target.value,
      }))
    }
    placeholder="예: 2026-09"
  />
</div>
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
<p className="text-xs text-muted-foreground">
  금액 입력 후 결제 상태를 "결제"로 저장하면 정산 리포트에 회사 매출로 자동 반영됩니다.
</p>
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
  <DialogContent className="h-[88vh] w-[98vw] !max-w-[1700px] overflow-hidden p-0">
    <div className="flex h-full flex-col">
      <div className="border-b px-6 py-4">
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="text-xl font-semibold">
            {masterListType === "education" ? "실습교육원 관리" : "실습기관 관리"}
          </DialogTitle>
          <DialogDescription>
            CSV 등록, 현재 목록 확인, 개별 삭제를 할 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border bg-slate-50/80 p-3">
  <Button
    type="button"
    variant={selectedCategoryId === null ? "default" : "outline"}
    size="sm"
    onClick={() => setSelectedCategoryId(null)}
    className="rounded-full"
  >
    전체
  </Button>

  {(masterListType === "education" ? educationCategories : institutionCategories).map((cat: any) => {
  const isSelected = Number(selectedCategoryId) === Number(cat.id);

    return (
      <Button
        key={`${masterListType}-${cat.id}`}
        type="button"
        variant={isSelected ? "default" : "outline"}
        size="sm"
        className={`rounded-full ${
          isSelected
            ? "shadow-sm"
            : "border-slate-200 bg-white hover:bg-slate-50"
        }`}
        onClick={() => setSelectedCategoryId(cat.id)}
      >
        {cat.name}
      </Button>
    );
  })}
</div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(560px,640px)_minmax(720px,1fr)]">
        <div className="border-r bg-slate-50/60 p-6">
          <div className="space-y-4">
            <div>
              <div className="text-sm font-semibold">
                {masterListType === "education" ? "실습교육원 CSV 등록" : "실습기관 CSV 등록"}
              </div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                아래 예시 형식대로 한 줄에 한 기관씩 입력한 뒤 등록하세요.
                <br />
                쉼표(,) 기준으로 구분됩니다.
              </div>
            </div>

            <div className="rounded-xl border bg-white p-4">
              <div className="mb-2 text-xs font-semibold text-slate-700">CSV 예시</div>

              {masterListType === "education" ? (
                <div className="space-y-2 text-xs leading-6 text-slate-600">
                  <div>이름, 전화번호, 주소, 상세주소, 금액, 위도, 경도, 담당자명, 가능과정, 메모, 사용여부, 정렬순서</div>
                  <div className="rounded-lg bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">
                    예시)
                    <br />
                    위드원평생교육원,02-123-4567,서울 도봉구 방학동 123-4,3층,300000,37.123456,127.123456,홍길동,사회복지사2급,주말 가능,true,1
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-xs leading-6 text-slate-600">
                  <div>이름, 담당자명, 전화번호, 주소, 상세주소, 금액, 위도, 경도, 가능과정, 메모, 사용여부, 정렬순서</div>
                  <div className="rounded-lg bg-slate-50 p-3 text-[11px] leading-5 text-slate-500">
                    예시)
                    <br />
                    보육사랑실습기관,김담당,02-123-4567,서울 도봉구 방학동 123-4,2층,200000,37.123456,127.123456,보육교사,야간 문의 필요,true,1
                  </div>
                </div>
              )}
            </div>
<div className="space-y-2">
  <Label>등록 방식</Label>
  <div className="flex gap-2">
    <Button
      type="button"
      variant={csvMode === "append" ? "default" : "outline"}
      size="sm"
      onClick={() => setCsvMode("append")}
    >
      기존 유지 + 추가/수정
    </Button>

    <Button
      type="button"
      variant={csvMode === "replace" ? "destructive" : "outline"}
      size="sm"
      onClick={() => setCsvMode("replace")}
    >
      선택 리스트 전체 초기화 후 등록
    </Button>
  </div>

  <div className="text-xs text-muted-foreground">
    {csvMode === "append"
      ? "같은 이름 + 주소 + 리스트 데이터는 수정하고, 없으면 새로 추가합니다."
      : "현재 선택한 리스트의 기존 데이터를 모두 지운 뒤 CSV로 다시 등록합니다."}
  </div>
</div>

       <div className="space-y-3">
  <div className="flex items-center justify-between">
    <Label>CSV 입력</Label>
    <div className="flex flex-wrap gap-2">
<Button
  type="button"
  variant="outline"
  size="sm"
  onClick={fillSampleCsvToEditor}
>
  예시 채우기
</Button>
<Button
        type="button"
        variant="outline"
        size="sm"
        onClick={downloadSampleCsv}
      >
        샘플 CSV 다운로드
      </Button>

      <label>
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleCsvFileChange}
        />
        <span className="inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-input bg-background px-3 text-sm shadow-xs transition hover:bg-accent hover:text-accent-foreground">
          파일 업로드
        </span>
      </label>
    </div>
  </div>

{csvPreviewRows.length > 0 && (
  <div className="rounded-xl border bg-white p-4 text-sm">
{csvPreviewWarnings.length > 0 && (
  <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm">
    <div className="font-semibold text-yellow-800">업로드 전 확인 필요</div>
    <div className="mt-2 space-y-1 text-xs text-yellow-700">
      {csvPreviewWarnings.map((warning, idx) => (
        <div key={idx}>- {warning}</div>
      ))}
    </div>
  </div>
)}
    <div className="font-semibold">업로드 전 미리보기</div>

    <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
      <div className="rounded-lg bg-slate-50 px-3 py-2">
        <div className="text-muted-foreground">전체 행</div>
        <div className="mt-1 font-medium">{csvPreviewSummary.total}건</div>
      </div>

      <div className="rounded-lg bg-emerald-50 px-3 py-2">
        <div className="text-emerald-700">이름 있는 행</div>
        <div className="mt-1 font-semibold text-emerald-800">
          {csvPreviewSummary.valid}건
        </div>
      </div>

      <div className="rounded-lg bg-yellow-50 px-3 py-2">
        <div className="text-yellow-700">이름 누락 행</div>
        <div className="mt-1 font-semibold text-yellow-800">
          {csvPreviewSummary.emptyNameRows}건
        </div>
      </div>
    </div>
  </div>
)}

{csvPreviewRows.length > 1 && (
  <div className="rounded-xl border bg-white">
    <div className="border-b px-4 py-3 text-sm font-semibold">
      미리보기 테이블
    </div>

    <div className="max-h-[260px] overflow-auto">
      <table className="w-full min-w-[900px] text-xs">
        <tbody>
          {csvPreviewRows.slice(0, 6).map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className={rowIdx === 0 ? "bg-slate-50 font-semibold" : "border-t"}
            >
              {row.slice(0, 6).map((cell, cellIdx) => (
                <td key={cellIdx} className="px-3 py-2 align-top">
                  {cell || "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
      상위 6행, 앞쪽 6열만 미리 표시합니다.
    </div>
  </div>
)}    

  <div
    onDrop={handleCsvDrop}
    onDragOver={handleCsvDragOver}
    onDragLeave={handleCsvDragLeave}
    className={`rounded-2xl border-2 border-dashed p-3 transition ${
      isCsvDragOver
        ? "border-blue-400 bg-blue-50"
        : "border-slate-200 bg-white"
    }`}
  >
    <div className="mb-2 text-xs text-muted-foreground">
      CSV 파일을 여기로 드래그해서 넣거나, 직접 붙여넣거나, 파일 업로드 버튼을 사용하세요.
    </div>

    <Textarea
  value={csvText}
  onChange={(e) => {
    const next = e.target.value;
    setCsvText(next);

    try {
      const parsed = parseCsvLines(next);
      setCsvPreviewRows(parsed);
    } catch {
      setCsvPreviewRows([]);
    }
  }}
      className="min-h-[260px] resize-none border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
      placeholder={
        masterListType === "education"
          ? "예시 형식에 맞춰 실습교육원 데이터를 붙여넣으세요."
          : "예시 형식에 맞춰 실습기관 데이터를 붙여넣으세요."
      }
    />
  </div>
</div>

<div className="flex flex-wrap gap-2">
  <Button
    type="button"
    className="min-w-[140px]"
    onClick={handleUploadCsv}
    disabled={
      bulkCreateEducationCentersMut.isPending ||
      bulkCreateInstitutionsMut.isPending
    }
  >
    {bulkCreateEducationCentersMut.isPending ||
    bulkCreateInstitutionsMut.isPending
      ? "등록중..."
      : "CSV 등록"}
  </Button>

  <Button
    type="button"
    variant="secondary"
    className="min-w-[140px]"
    onClick={() => {
      if (masterListType === "education") {
        fixEducationCoordsMut.mutate({ limit: 100 });
      } else {
        fixInstitutionCoordsMut.mutate({ limit: 100 });
      }
    }}
  >
    좌표 자동 보정
  </Button>
</div>     

            
{csvUploadSummary && (
  <div className="rounded-xl border bg-white p-4 text-sm">
    <div>
  <div className="font-semibold">업로드 결과</div>
  <div className="mt-1 text-xs text-muted-foreground">
    {csvUploadSummary.failed > 0
      ? "실패 행이 있어 확인 후 다시 등록이 필요합니다."
      : "모든 행이 정상 처리되었습니다."}
  </div>
</div>

    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
      <div className="rounded-lg bg-slate-50 px-3 py-2">
        <div className="text-muted-foreground">등록 방식</div>
        <div className="mt-1 font-medium">
          {csvUploadSummary.mode === "replace" ? "전체 초기화 후 등록" : "기존 유지 + 추가/수정"}
        </div>
      </div>

      <div className="rounded-lg bg-slate-50 px-3 py-2">
        <div className="text-muted-foreground">전체 행</div>
        <div className="mt-1 font-medium">{csvUploadSummary.total}건</div>
      </div>

      <div className="rounded-lg bg-emerald-50 px-3 py-2">
        <div className="text-emerald-700">신규 추가</div>
        <div className="mt-1 font-semibold text-emerald-800">
          {csvUploadSummary.created}건
        </div>
      </div>

      <div className="rounded-lg bg-blue-50 px-3 py-2">
        <div className="text-blue-700">기존 수정</div>
        <div className="mt-1 font-semibold text-blue-800">
          {csvUploadSummary.updated}건
        </div>
      </div>

      <div className="rounded-lg bg-red-50 px-3 py-2 col-span-2">
        <div className="text-red-700">실패</div>
        <div className="mt-1 font-semibold text-red-800">
          {csvUploadSummary.failed}건
        </div>
      </div>
    </div>

   {csvUploadSummary.failedRows?.length > 0 && (
  <div className="mt-4 space-y-2">
    <div className="flex items-center justify-between gap-2">
      <div className="text-xs font-semibold text-red-700">실패 행</div>

      <div className="flex flex-wrap gap-2">
  <Button
    type="button"
    variant="outline"
    size="sm"
    onClick={applyFailedRowsToEditor}
  >
    실패 행 다시 편집
  </Button>

  <Button
    type="button"
    variant="outline"
    size="sm"
    onClick={copyFailedRows}
  >
    실패 행 복사
  </Button>

  <Button
    type="button"
    variant="outline"
    size="sm"
    onClick={downloadFailedRowsCsv}
  >
    실패 CSV 다운로드
  </Button>
</div>
    </div>

    <div className="max-h-40 overflow-auto rounded-lg border">
          {csvUploadSummary.failedRows.map((item, idx) => (
            <div
              key={`${item.rowIndex}-${idx}`}
              className="border-b last:border-b-0 px-3 py-2 text-xs"
            >
              <div className="font-medium">
                {item.rowIndex}행 · {item.name || "-"}
              </div>
              <div className="text-muted-foreground">{item.address || "-"}</div>
              <div className="mt-1 text-red-600">{item.reason}</div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
)}
          </div>
        </div>

        <div className="flex min-w-[720px] flex-col p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">
                {masterListType === "education" ? "실습교육원 목록" : "실습기관 목록"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                선택한 리스트의 등록 기관을 확인하고 비활성설정/삭제를 할 수 있습니다.
              </div>
            </div>

<div className="flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
  <span>
    {selectedCategoryId
      ? `${
          (masterListType === "education" ? educationCategories : institutionCategories).find(
            (cat: any) => Number(cat.id) === Number(selectedCategoryId)
          )?.name || "선택된 리스트"
        } 표시 중`
      : "전체 리스트 표시 중"}
  </span>
  <span className="text-slate-400">•</span>
  <span>{masterItems.length}건</span>
</div>
            
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border bg-white">
            <div className="h-full overflow-auto">
              <table className="w-full min-w-[1200px] text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50">
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium">이름</th>
<th className="px-4 py-3 text-left font-medium">리스트</th>
<th className="px-4 py-3 text-left font-medium">주소</th>
<th className="px-4 py-3 text-left font-medium">전화번호</th>
<th className="px-4 py-3 text-left font-medium">가능과정</th>
<th className="px-4 py-3 text-left font-medium">상태</th>
<th className="px-4 py-3 text-right font-medium">관리</th>
                  </tr>
                </thead>

                <tbody>
                  {masterItems.map((item: any) => (

                    <tr
  key={`${item.type}-${item.id}`}
  className="border-b align-top transition hover:bg-slate-50/70"
>
                      <td className="px-4 py-3 font-medium">{item.name}</td>
<td className="px-4 py-3 text-slate-600">
  {(masterListType === "education" ? educationCategories : institutionCategories).find(
    (cat: any) => Number(cat.id) === Number(item.categoryId)
  )?.name || "-"}
</td>
<td className="px-4 py-3 text-slate-600">
  {[item.address, item.detailAddress].filter(Boolean).join(" ") || "-"}
</td>
                      <td className="px-4 py-3">{item.phone || "-"}</td>
                      <td className="px-4 py-3">{item.availableCourse || "-"}</td>
                      <td className="px-4 py-3">
  {item.isInactive ? (
    <span className="inline-flex rounded-full bg-yellow-100 px-2.5 py-1 text-xs font-semibold text-yellow-800">
      비활성
    </span>
  ) : item.isActive === false ? (
    <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700">
      미사용
    </span>
  ) : (
    <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      사용
    </span>
  )}
</td>
                      <td className="px-4 py-3 text-right">
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

                  {masterItems.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-14 text-center text-sm text-muted-foreground">
                        표시할 데이터가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
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
    className="h-screen w-screen max-w-none overflow-hidden rounded-none border-0 p-0 gap-0 sm:max-w-none"
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
  <div className="flex w-[460px] min-w-[460px] flex-col border-r bg-white">
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
  onChange={(checked) => {
    setFinderIncludeEducationCenter(checked);
    if (!checked) {
      setFinderEducationCategoryId(null);
      setFinderRecommendedEducationCategoryId(null);
    }
  }}
                    label="실습교육원"
                    activeClassName="bg-blue-50 text-blue-700 border-blue-200"
                  />

                  <FinderTypeToggle
  checked={finderIncludePracticeInstitution}
  onChange={(checked) => {
    setFinderIncludePracticeInstitution(checked);
    if (!checked) {
      setFinderInstitutionCategoryId(null);
      setFinderRecommendedInstitutionCategoryId(null);
    }
  }}
                    label="실습기관"
                    activeClassName="bg-orange-50 text-orange-700 border-orange-200"
                  />
                </div>

<div className="space-y-3">
  {finderIncludeEducationCenter && (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">
        실습교육원 리스트 선택 (전체 선택 시 모든 교육원 리스트가 함께 검색됩니다)
      </div>
      <div className="flex flex-wrap gap-2">
{educationCategories.length === 0 && (
  <div className="rounded-lg border border-dashed border-blue-200 bg-blue-50 px-3 py-3 text-xs text-blue-700">
    등록된 실습교육원 리스트가 없습니다. 상단의 <b>리스트 추가</b>에서 먼저 생성해주세요.
  </div>
)}
        <Button
  type="button"
  variant={finderEducationCategoryId === null ? "default" : "outline"}
  size="sm"
  className={
    finderEducationCategoryId === null
      ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
      : "border-blue-200 text-blue-700 hover:bg-blue-50"
  }
  onClick={() => {
    setFinderEducationCategoryId(null);
    setFinderRecommendedEducationCategoryId(null);
  }}
>
  전체
</Button>

        {educationCategories.map((cat: any) => {
  const isSelected = Number(finderEducationCategoryId) === Number(cat.id);
const isRecommended = Number(finderRecommendedEducationCategoryId) === Number(cat.id);

  return (
    <Button
      key={`finder-edu-${cat.id}`}
      type="button"
      variant={isSelected ? "default" : "outline"}
      size="sm"
      className={
        isSelected
          ? "bg-blue-600 hover:bg-blue-700 text-white border-blue-600"
          : "border-blue-200 text-blue-700 hover:bg-blue-50"
      }
      onClick={() => setFinderEducationCategoryId(cat.id)}
    >
      <span>{cat.name}</span>
      {isRecommended && (
        <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
          추천
        </span>
      )}
    </Button>
  );
})}
      </div>
    </div>
  )}

  {finderIncludePracticeInstitution && (
    <div className="space-y-2">
      <div className="text-xs font-medium text-muted-foreground">
        실습기관 리스트 선택 (전체 선택 시 모든 기관 리스트가 함께 검색됩니다)
      </div>
      <div className="flex flex-wrap gap-2">
{institutionCategories.length === 0 && (
  <div className="rounded-lg border border-dashed border-orange-200 bg-orange-50 px-3 py-3 text-xs text-orange-700">
    등록된 실습기관 리스트가 없습니다. 상단의 <b>리스트 추가</b>에서 먼저 생성해주세요.
  </div>
)}
        <Button
  type="button"
  variant={finderInstitutionCategoryId === null ? "default" : "outline"}
  size="sm"
  className={
    finderInstitutionCategoryId === null
      ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
      : "border-orange-200 text-orange-700 hover:bg-orange-50"
  }
  onClick={() => {
    setFinderInstitutionCategoryId(null);
    setFinderRecommendedInstitutionCategoryId(null);
  }}
>
  전체
</Button>

        {institutionCategories.map((cat: any) => {
  const isSelected = Number(finderInstitutionCategoryId) === Number(cat.id);
const isRecommended = Number(finderRecommendedInstitutionCategoryId) === Number(cat.id);

  return (
    <Button
      key={`finder-inst-${cat.id}`}
      type="button"
      variant={isSelected ? "default" : "outline"}
      size="sm"
      className={
        isSelected
          ? "bg-orange-500 hover:bg-orange-600 text-white border-orange-500"
          : "border-orange-200 text-orange-700 hover:bg-orange-50"
      }
      onClick={() => setFinderInstitutionCategoryId(cat.id)}
    >
      <span>{cat.name}</span>
      {isRecommended && (
        <span className="ml-2 rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-orange-700">
          추천
        </span>
      )}
    </Button>
  );
})}
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
{finderTargetRow?.course ? (
  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
    학생 희망과정을 기준으로 추천 리스트를 자동 선택했습니다.
    <div className="mt-1 font-medium text-blue-800">과정: {finderTargetRow.course}</div>
  </div>
) : null}

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

              <div className="min-h-0 flex-1 overflow-y-auto">
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
  <div
  key={`${item.type}-${item.id}`}
  className={`relative border-l-4 border-transparent ${
    isSelected
      ? item.type === "education"
        ? "border-l-blue-500 bg-blue-50"
        : "border-l-orange-500 bg-orange-50"
      : hasConfig
      ? "bg-yellow-50/80"
      : ""
  }`}
>
  <div
    className="w-full cursor-pointer p-4 pr-10 text-left transition hover:bg-slate-50"
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

                         <div className="flex items-center gap-2">
  {item.distanceKm && item.distanceKm !== "좌표없음" && (
    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      거리 {item.distanceKm}km
    </span>
  )}

  {item.distanceKm === "좌표없음" && (
    <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
      좌표 없음
    </span>
  )}
</div>
                          </div>
                        </div>
		</div>
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
                   <div className="mt-2">
  {selectedFinderItem.distanceKm &&
    selectedFinderItem.distanceKm !== "좌표없음" && (
      <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
        거리 {selectedFinderItem.distanceKm}km
      </span>
    )}

  {selectedFinderItem.distanceKm === "좌표없음" && (
    <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600">
      좌표 없음
    </span>
  )}
</div>
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

            <div className="relative flex-1 overflow-hidden bg-slate-100">
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