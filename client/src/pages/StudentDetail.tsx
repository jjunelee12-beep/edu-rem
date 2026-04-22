import { useState, useRef, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  X,
  Save,
  Copy,
  Lock,
  Loader2,
  Pencil,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation, useParams } from "wouter";
import { formatPhone } from "@/lib/format";

function EditableCell({
  value,
  onBlur,
  type = "text",
  disabled = false,
  className = "",
}: {
  value: string;
  onBlur: (v: string) => void;
  type?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalVal(value);
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (type !== "date") inputRef.current.select();
    }
  }, [editing, type]);

  if (disabled) {
    return <span className={`text-sm text-black ${className}`}>{value || "-"}</span>;
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        className="w-full px-2 py-1 text-sm border rounded bg-white text-black focus:outline-none focus:ring-1 focus:ring-primary"
        value={localVal}
        onChange={(e) => setLocalVal(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (localVal !== value) onBlur(localVal);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setLocalVal(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  return (
    <div
      className={`px-2 py-1 text-sm cursor-text rounded hover:bg-muted/30 min-h-[28px] flex items-center text-black ${className}`}
      onClick={() => setEditing(true)}
    >
      {value || <span className="text-muted-foreground/40">-</span>}
    </div>
  );
}

function formatDate(d: any) {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "-";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toNumber(v: any) {
  return Number(String(v ?? "0").replace(/,/g, "").replace(/[^0-9.-]/g, "").trim()) || 0;
}

function normalizePlannedMonthToDate(plannedMonth?: string | null) {
  const raw = String(plannedMonth || "").trim().replace(/[^0-9]/g, "");
  if (raw.length !== 6) return "";
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-01`;
}

function formatPlannedMonth(plannedMonth?: string | null) {
  const raw = String(plannedMonth || "").trim().replace(/[^0-9]/g, "");
  if (raw.length !== 6) return "";
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-01`;
}

type TemplateTabType = "전공필수" | "전공선택" | "교양" | "일반";

export default function StudentDetail() {
  const params = useParams<{ id: string }>();
  const studentId = parseInt(params.id || "0");
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const isAdmin = user?.role === "admin" || user?.role === "host";
  const planSectionRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const planFieldRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});
  const transferFieldRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});

const semesterSectionRef = useRef<HTMLDivElement | null>(null);
const planSummarySectionRef = useRef<HTMLDivElement | null>(null);
const privateCertificateSectionRef = useRef<HTMLDivElement | null>(null);
const practiceSupportSectionRef = useRef<HTMLDivElement | null>(null);
const refundSectionRef = useRef<HTMLDivElement | null>(null);
const lastHandledTabRef = useRef<string>("");
const [highlightSection, setHighlightSection] = useState<
  "" | "semester" | "private-certificate" | "practice-support" | "refund"
>("");

  const { data: student, isLoading: studentLoading } = trpc.student.get.useQuery({ id: studentId });
  const { data: semesters } = trpc.semester.list.useQuery({ studentId });
  const { data: plan } = trpc.plan.get.useQuery({ studentId });
  const { data: allUsers } = trpc.users.list.useQuery();
  const { data: institutionList } = trpc.educationInstitution.list.useQuery();
  const { data: refundList } = trpc.refund.listByStudent.useQuery({ studentId });
  const { data: planSemesterList } = trpc.planSemester.list.useQuery({ studentId });
  const { data: transferSubjectList } = trpc.transferSubject.list.useQuery({ studentId });
  const { data: transferAttachmentList } = trpc.transferAttachment.list.useQuery({ studentId });
  
const { data: privateCertificateMasterList } =
  trpc.privateCertificateMaster.list.useQuery({
    activeOnly: true,
  });

const { data: subjectCatalogList } =
  trpc.subjectCatalog.list.useQuery({
    activeOnly: true,
  });

const { data: privateCertificateRequestList } =
  trpc.privateCertificate.listByStudent.useQuery({ studentId });

const { data: practiceSupportList } =
  trpc.practiceSupport.listByStudent.useQuery({ studentId });


  const [selectedSemesterOrder, setSelectedSemesterOrder] = useState(1);
  const [uploadingRefund, setUploadingRefund] = useState(false);
  const [uploadingRefundEditId, setUploadingRefundEditId] = useState<number | null>(null);
  const [uploadingTransferCommon, setUploadingTransferCommon] = useState(false);
  const [uploadingTransferRowId, setUploadingTransferRowId] = useState<number | null>(null);

  const [privateCertDialogOpen, setPrivateCertDialogOpen] = useState(false);
  const [selectedPrivateCertNames, setSelectedPrivateCertNames] = useState<string[]>([]);

const [privateCertAddress, setPrivateCertAddress] = useState("");
const [privateCertDetailAddress, setPrivateCertDetailAddress] = useState("");

useEffect(() => {
  if (!privateCertDialogOpen) return;

  setPrivateCertAddress(String((student as any)?.address || "").trim());
  setPrivateCertDetailAddress(String((student as any)?.detailAddress || "").trim());
}, [privateCertDialogOpen, student]);

const [courseDialogOpen, setCourseDialogOpen] = useState(false);
const [courseDialogSemester, setCourseDialogSemester] = useState<any>(null);
const [selectedRegisteredCourses, setSelectedRegisteredCourses] = useState<string[]>([]);
const [primaryRegisteredCourse, setPrimaryRegisteredCourse] = useState("");

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);

  const apiBase = import.meta.env.VITE_API_BASE_URL || "";

const res = await fetch(`${apiBase}/api/upload`, {
  method: "POST",
  body: formData,
  credentials: "include",
});

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "파일 업로드에 실패했습니다.");
    }

    const data = await res.json();

    return {
      fileName: data.fileName || file.name,
      fileUrl: data.fileUrl,
    };
  }

 const requestedPrivateCertList = privateCertificateRequestList || [];
const privateCertificateOptions = privateCertificateMasterList || [];

const createPrivateCertificateRequestMut =
  trpc.privateCertificate.create.useMutation({
    onError: (e) => toast.error(e.message),
  });


const deletePrivateCertificateRequestMut =
  trpc.privateCertificate.delete.useMutation({
    onSuccess: async () => {
      await utils.privateCertificate.listByStudent.invalidate({ studentId })
      toast.success("민간자격증 요청 삭제 완료");
    },
    onError: (e) => toast.error(e.message),
  });

const submitPrivateCertRequest = async () => {
  if (!selectedPrivateCertNames.length) {
    toast.error("요청할 민간자격증을 선택해주세요.");
    return;
  }

  if (!student) {
    toast.error("학생 정보를 찾을 수 없습니다.");
    return;
  }

  const assigneeId = Number(student.assigneeId || 0);
  const clientName = String(student.clientName || "").trim();
  const phone = String(student.phone || "").trim();

  if (!assigneeId) {
    toast.error("담당자 정보가 없어 민간자격증 요청을 생성할 수 없습니다.");
    return;
  }

  if (!clientName) {
    toast.error("학생 이름 정보가 없어 민간자격증 요청을 생성할 수 없습니다.");
    return;
  }

  if (!phone) {
    toast.error("학생 연락처 정보가 없어 민간자격증 요청을 생성할 수 없습니다.");
    return;
  }

  try {
    for (const name of selectedPrivateCertNames) {
      const master = (privateCertificateOptions || []).find(
        (row: any) => String(row.certificateName || row.name || "").trim() === String(name).trim()
      );

      await createPrivateCertificateRequestMut.mutateAsync({
  studentId,
  assigneeId,
  clientName,
  phone,
  assigneeName: String(student.assigneeName || "").trim() || null,
  privateCertificateMasterId: master?.id ? Number(master.id) : null,
  certificateName: name,
  inputAddress:
    [privateCertAddress, privateCertDetailAddress]
      .map((x) => String(x || "").trim())
      .filter(Boolean)
      .join(" ") || null,
  note: null,
        requestStatus: "요청",
        feeAmount: "0",
        freelancerInputAmount: "0",
        paymentStatus: "결제대기",
        paidAt: null,
        attachmentName: null,
        attachmentUrl: null,
      } as any);
    }

    await utils.privateCertificate.listByStudent.invalidate({ studentId });
setPrivateCertDialogOpen(false);
setSelectedPrivateCertNames([]);
setPrivateCertAddress("");
setPrivateCertDetailAddress("");
toast.success("민간자격증 요청 완료");
  } catch (e: any) {
    toast.error(e.message || "민간자격증 요청 중 오류가 발생했습니다.");
  }
};

  const togglePrivateCert = (name: string) => {
    setSelectedPrivateCertNames((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]
    );
  };


  const [transferAddCount, setTransferAddCount] = useState("1");

  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
const [templateDialogSemesterNo, setTemplateDialogSemesterNo] = useState<number | null>(null);
const [selectedCatalogId, setSelectedCatalogId] = useState<number | null>(null);
const [templateTab, setTemplateTab] = useState<TemplateTabType>("전공필수");
const [selectedTemplateIds, setSelectedTemplateIds] = useState<number[]>([]);

const { data: subjectCatalogItemList } =
  trpc.subjectCatalog.itemList.useQuery(
    {
      catalogId: Number(selectedCatalogId || 0),
      activeOnly: true,
    },
    {
      enabled: !!selectedCatalogId,
    }
  );

  const updateStudentMut = trpc.student.update.useMutation({
    onSuccess: async () => {
      await utils.student.get.invalidate({ id: studentId });
      toast.success("학생 정보가 수정되었습니다.");
    },
    onError: (e) => toast.error(e.message),
  });

  const createPlanSemesterMut = trpc.planSemester.create.useMutation({
    onSuccess: async () => {
      await utils.planSemester.list.invalidate({ studentId });
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePlanSemesterMut = trpc.planSemester.update.useMutation({
    onSuccess: async () => {
      await utils.planSemester.list.invalidate({ studentId });
    },
    onError: (e) => toast.error(e.message),
  });

  const deletePlanSemesterMut = trpc.planSemester.delete.useMutation({
    onSuccess: async () => {
      await utils.planSemester.list.invalidate({ studentId });
    },
    onError: (e) => toast.error(e.message),
  });

const applySubjectCatalogItemsToSemester = async () => {
  if (!templateDialogSemesterNo) {
    toast.error("학기 정보가 없습니다.");
    return;
  }

  if (!selectedTemplateIds.length) {
    toast.error("등록할 과목을 선택해주세요.");
    return;
  }

  const selectedRows = (subjectCatalogItemList || []).filter((row: any) =>
    selectedTemplateIds.includes(Number(row.id))
  );

  if (!selectedRows.length) {
    toast.error("선택된 과목 정보를 찾을 수 없습니다.");
    return;
  }

  const normalizedRows = selectedRows.map((row: any, index: number) => {
    const rawCategory = String(row.category || "").trim();

    const normalizedCategory =
      rawCategory === "전공필수" || rawCategory === "전공선택"
        ? "전공"
        : rawCategory === "교양"
        ? "교양"
        : rawCategory === "일반"
        ? "일반"
        : "전공";

    const normalizedRequirementType =
      rawCategory === "전공필수" || rawCategory === "전공선택"
        ? rawCategory
        : normalizedCategory === "교양"
        ? "교양"
        : normalizedCategory === "일반"
        ? "일반"
        : String(row.requirementType || "전공선택").trim() === "전공필수"
        ? "전공필수"
        : "전공선택";

    return {
      ...row,
      normalizedCategory,
      normalizedRequirementType,
      sortOrder: index,
    };
  });

  const ok = window.confirm(
    "현재 학기의 기존 과목을 모두 지우고 선택한 과목으로 덮어쓰시겠습니까?"
  );
  if (!ok) return;

  try {
    const currentRows = (planSemesterList || []).filter(
      (row: any) => Number(row.semesterNo) === Number(templateDialogSemesterNo)
    );

    // 1) 먼저 입력값 검증
    for (const row of normalizedRows) {
      if (!row.subjectName) {
        throw new Error("과목명 없는 항목이 포함되어 있습니다.");
      }

      if (!["전공", "교양", "일반"].includes(row.normalizedCategory)) {
        throw new Error(`잘못된 과목 구분값: ${row.normalizedCategory}`);
      }

      if (
        !["전공필수", "전공선택", "교양", "일반"].includes(
          row.normalizedRequirementType
        )
      ) {
        throw new Error(`잘못된 이수구분값: ${row.normalizedRequirementType}`);
      }
    }

    // 2) 검증 통과 후 기존 과목 삭제
    for (const row of currentRows) {
      await deletePlanSemesterMut.mutateAsync({ id: Number(row.id) });
    }

    // 3) 새 과목 등록
    for (const row of normalizedRows) {
      await createPlanSemesterMut.mutateAsync({
        studentId,
        semesterNo: Number(templateDialogSemesterNo),
        subjectName: String(row.subjectName).trim(),
        category: row.normalizedCategory,
        requirementType: row.normalizedRequirementType,
        sortOrder: row.sortOrder,
      } as any);
    }

    await utils.planSemester.list.invalidate({ studentId });

    toast.success(`과목 ${normalizedRows.length}개 등록 완료`);
    setTemplateDialogOpen(false);
    setSelectedTemplateIds([]);
  } catch (e: any) {
    toast.error(e.message || "일괄 등록 중 오류가 발생했습니다.");
  }
};

  const updateTransferSubjectMut = trpc.transferSubject.update.useMutation({
    onSuccess: async () => {
      await utils.transferSubject.list.invalidate({ studentId });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteTransferSubjectMut = trpc.transferSubject.delete.useMutation({
    onSuccess: async () => {
      await utils.transferSubject.list.invalidate({ studentId });
      toast.success("전적대 과목 삭제 완료");
    },
    onError: (e) => toast.error(e.message),
  });

  const bulkCreateTransferSubjectMut = trpc.transferSubject.bulkCreate.useMutation({
    onSuccess: async (res) => {
      await utils.transferSubject.list.invalidate({ studentId });
      toast.success(`전적대 과목 ${res.count}개 추가 완료`);
    },
    onError: (e) => toast.error(e.message),
  });

  const createTransferAttachmentMut = trpc.transferAttachment.create.useMutation({
    onSuccess: async () => {
      await utils.transferAttachment.list.invalidate({ studentId });
      toast.success("전적대 공통 첨부파일 등록 완료");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteTransferAttachmentMut = trpc.transferAttachment.delete.useMutation({
    onSuccess: async () => {
      await utils.transferAttachment.list.invalidate({ studentId });
      toast.success("전적대 공통 첨부파일 삭제 완료");
    },
    onError: (e) => toast.error(e.message),
  });


  const createSemMut = trpc.semester.create.useMutation({
    onSuccess: async () => {
      await utils.semester.list.invalidate({ studentId });
      await utils.planSemester.list.invalidate({ studentId });
      toast.success("학기 및 우리 플랜 자동 생성 완료");
      setSemDialogOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateSemMut = trpc.semester.update.useMutation({
    onSuccess: async () => {
      await utils.semester.list.invalidate({ studentId });
      await utils.student.get.invalidate({ id: studentId });
      await utils.planSemester.list.invalidate({ studentId });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteSemMut = trpc.semester.delete.useMutation({
    onSuccess: async () => {
      await utils.semester.list.invalidate({ studentId });
      await utils.student.get.invalidate({ id: studentId });
      await utils.planSemester.list.invalidate({ studentId });
      toast.success("학기 삭제 완료");
    },
    onError: (e) => toast.error(e.message),
  });

  const upsertPlanMut = trpc.plan.upsert.useMutation({
    onSuccess: async () => {
      await utils.plan.get.invalidate({ studentId });
      toast.success("플랜 저장 완료");
      setEditingPlan(false);
    },
    onError: (e) => toast.error(e.message),
  });
const upsertPracticeSupportByStudentMut =
  trpc.practiceSupport.upsertByStudent.useMutation({
    onError: (e) => toast.error(e.message),
  });

  const [editingPlan, setEditingPlan] = useState(false);
  const [planForm, setPlanForm] = useState({
  desiredCourse: "",
  finalEducation: "",
  totalTheorySubjects: "",
  hasPractice: false,
  practiceHours: "",
  practiceDate: "",
  practiceArranged: false,
  practiceStatus: "미섭외",
  specialNotes: "",
practiceAddress: "",
});

  const [semDialogOpen, setSemDialogOpen] = useState(false);
  const [semForm, setSemForm] = useState({
    semesterOrder: "",
    plannedMonth: "",
    plannedInstitutionId: "",
    plannedSubjectCount: "",
    plannedAmount: "",
  });
  
const [refundDialogOpen, setRefundDialogOpen] = useState(false);

    const [refundForm, setRefundForm] = useState({
  semesterId: "",
  refundAmount: "",
  refundDate: new Date().toISOString().slice(0, 10),
  reason: "",
  refundType: "부분환불",
  attachmentName: "",
  attachmentUrl: "",
});

  const [editingRefundId, setEditingRefundId] = useState<number | null>(null);
  const [editRefundForm, setEditRefundForm] = useState({
  semesterId: "",
  refundAmount: "",
  refundDate: "",
  reason: "",
  refundType: "부분환불",
  attachmentName: "",
  attachmentUrl: "",
});

   const createRefundMut = trpc.refund.create.useMutation({
  onSuccess: async () => {
    await utils.refund.listByStudent.invalidate({ studentId });
    toast.success("환불 요청 등록 완료");
  },
  onError: (e) => toast.error(e.message),
});

  const updateRefundMut = trpc.refund.update.useMutation({
    onSuccess: async () => {
      await utils.refund.listByStudent.invalidate({ studentId });
      toast.success("환불 수정 완료");
      setEditingRefundId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteRefundMut = trpc.refund.delete.useMutation({
    onSuccess: async () => {
      await utils.refund.listByStudent.invalidate({ studentId });
      toast.success("환불 삭제 완료");
    },
    onError: (e) => toast.error(e.message),
  });

  const userMap = new Map(allUsers?.map((u: any) => [u.id, u.name || "이름없음"]) ?? []);

  const sortedSemesters = useMemo(() => {
    return [...(semesters || [])].sort(
      (a: any, b: any) => Number(a.semesterOrder) - Number(b.semesterOrder)
    );
  }, [semesters]);

  const semesterMetaMap = useMemo(() => {
    return new Map(sortedSemesters.map((sem: any) => [Number(sem.semesterOrder), sem]));
  }, [sortedSemesters]);

  const groupedPlanSemesters = useMemo(() => {
    const map = new Map<number, any[]>();
    (planSemesterList || []).forEach((row: any) => {
      const no = Number(row.semesterNo || 1);
      if (!map.has(no)) map.set(no, []);
      map.get(no)!.push(row);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([semesterNo, rows]) => ({
        semesterNo,
        rows: rows.sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0)),
      }));
  }, [planSemesterList]);

  const selectedSemester = useMemo(() => {
    return sortedSemesters.find(
      (s: any) => Number(s.semesterOrder) === Number(selectedSemesterOrder)
    );
  }, [sortedSemesters, selectedSemesterOrder]);

const approvedRefundAmountMap = useMemo(() => {
  const map: Record<number, number> = {};

  (refundList || []).forEach((row: any) => {
    if (row.approvalStatus !== "승인") return;

    const semesterId = Number(row.semesterId || 0);
    if (!semesterId) return;

    map[semesterId] = (map[semesterId] || 0) + toNumber(row.refundAmount);
  });

  return map;
}, [refundList]);

const pendingRefundAmountMap = useMemo(() => {
  const map: Record<number, number> = {};

  (refundList || []).forEach((row: any) => {
    if (row.approvalStatus !== "대기") return;

    const semesterId = Number(row.semesterId || 0);
    if (!semesterId) return;

    map[semesterId] = (map[semesterId] || 0) + toNumber(row.refundAmount);
  });

  return map;
}, [refundList]);

const selectedPracticeSupport = useMemo(() => {
  if (!practiceSupportList?.length) return null;
  return practiceSupportList[0] ?? null;
}, [practiceSupportList]);


  const lastSemester = useMemo(() => {
    if (!sortedSemesters.length) return null;
    return sortedSemesters[sortedSemesters.length - 1];
  }, [sortedSemesters]);

  const isSelectedLastSemester = useMemo(() => {
    if (!selectedSemester || !lastSemester) return false;
    return Number(selectedSemester.id) === Number(lastSemester.id);
  }, [selectedSemester, lastSemester]);

  const selectedSemesterStatus = useMemo(() => {
    if (!selectedSemester) return "등록";
    return selectedSemester.status || "등록";
  }, [selectedSemester]);

const isApprovedSemester = selectedSemester?.approvalStatus === "승인";

const displayStudentStatus = useMemo(() => {
  if (!isApprovedSemester) return "등록예정";
  if (selectedSemester?.status === "등록 종료") return "등록 종료";
  return "등록";
}, [isApprovedSemester, selectedSemester]);

const canFinalizeRegistrationStatus = isApprovedSemester && isSelectedLastSemester;

  useEffect(() => {
    if (!sortedSemesters.length) {
      setSelectedSemesterOrder(1);
      return;
    }

    const exists = sortedSemesters.some(
      (s: any) => Number(s.semesterOrder) === Number(selectedSemesterOrder)
    );

    if (!exists) {
      setSelectedSemesterOrder(Number(sortedSemesters[0].semesterOrder));
    }
  }, [sortedSemesters, selectedSemesterOrder]);

useEffect(() => {
  if (studentLoading) return;

  const tab = new URLSearchParams(window.location.search).get("tab") || "";
  const tabKey = `${studentId}:${tab}:${location}`;

  if (!tab || lastHandledTabRef.current === tabKey) return;

  lastHandledTabRef.current = tabKey;

  window.setTimeout(() => {
    if (tab === "semester") {
  scrollToSection(semesterSectionRef.current);
  triggerSectionHighlight("semester");
  return;
}

    if (tab === "private-certificate") {
  scrollToSection(
    privateCertificateSectionRef.current || planSummarySectionRef.current
  );
  triggerSectionHighlight("private-certificate");
  return;
}

    if (tab === "practice-support") {
  scrollToSection(
    practiceSupportSectionRef.current || planSummarySectionRef.current
  );
  triggerSectionHighlight("practice-support");
  return;
}

    if (tab === "refund") {
  if (refundSectionRef.current) {
    scrollToSection(refundSectionRef.current);
    triggerSectionHighlight("refund");
  } else {
    setRefundDialogOpen(true);
    scrollToSection(semesterSectionRef.current);
    triggerSectionHighlight("semester");
  }
}
  }, 120);
}, [
  location,
  studentId,
  studentLoading,
  requestedPrivateCertList.length,
  selectedPracticeSupport?.id,
  refundList?.length,
]);

  const moveToPlanSemester = (semesterNo: number) => {
    const el = planSectionRefs.current[semesterNo];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

const scrollToSection = (el: HTMLDivElement | null) => {
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "start" });
};

const triggerSectionHighlight = (
  key: "" | "semester" | "private-certificate" | "practice-support" | "refund"
) => {
  if (!key) return;

  setHighlightSection(key);

  window.setTimeout(() => {
    setHighlightSection((prev) => (prev === key ? "" : prev));
  }, 2200);
};

  const getInstitutionName = (institutionId: any) => {
    if (!institutionId) return "";
    return (
      institutionList?.find((inst: any) => Number(inst.id) === Number(institutionId))?.name || ""
    );
  };

const courseOptions = useMemo(() => {
  const fromStudent = String(student?.course || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const fromPlan = String(plan?.desiredCourse || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

  const fallback = [
    "사회복지사2급",
    "보육교사",
    "평생교육사",
    "건강가정사",
    "한국어교원",
    "청소년지도사",
    "산업기사/기사",
    "전문학사/학사",
    "기타",
  ];

  return Array.from(new Set([...fromStudent, ...fromPlan, ...fallback]));
}, [student?.course, plan?.desiredCourse]);

const getRegisteredCourses = (sem: any): string[] => {
  if (Array.isArray(sem?.registeredCourses)) {
    return sem.registeredCourses
      .map((x: any) => String(x || "").trim())
      .filter(Boolean);
  }

  try {
    const parsed = JSON.parse(String(sem?.registeredCoursesJson || "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((x: any) => String(x || "").trim()).filter(Boolean);
  } catch {
    return sem?.primaryCourse ? [String(sem.primaryCourse).trim()] : [];
  }
};

const openCourseDialog = (sem: any) => {
  if (!sem) {
    toast.error("학기 정보가 없습니다.");
    return;
  }

  const currentCourses = getRegisteredCourses(sem);

  setCourseDialogSemester(sem);
  setSelectedRegisteredCourses(currentCourses);
  setPrimaryRegisteredCourse(
    String(sem?.primaryCourse || currentCourses[0] || "").trim()
  );
  setCourseDialogOpen(true);
};

const toggleRegisteredCourse = (course: string) => {
  setSelectedRegisteredCourses((prev) => {
    const exists = prev.includes(course);

    if (exists) {
      const next = prev.filter((x) => x !== course);

      if (primaryRegisteredCourse === course) {
        setPrimaryRegisteredCourse(next[0] || "");
      }

      return next;
    }

    const next = [...prev, course];

    if (!primaryRegisteredCourse) {
      setPrimaryRegisteredCourse(course);
    }

    return next;
  });
};

const saveRegisteredCourses = async () => {
  if (!courseDialogSemester) {
    toast.error("학기 정보가 없습니다.");
    return;
  }

  const cleaned = selectedRegisteredCourses
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  if (!cleaned.length) {
    toast.error("최소 1개 과정은 선택해야 합니다.");
    return;
  }

  const primary = cleaned.includes(primaryRegisteredCourse)
    ? primaryRegisteredCourse
    : cleaned[0];

  updateSemMut.mutate(
    {
      id: Number(courseDialogSemester.id),
      primaryCourse: primary,
      registeredCourses: cleaned,
    } as any,
    {
      onSuccess: async () => {
        await utils.semester.list.invalidate({ studentId });
        await utils.student.get.invalidate({ id: studentId });
        toast.success("학기별 등록 과정이 저장되었습니다.");
        setCourseDialogOpen(false);
        setCourseDialogSemester(null);
      },
      onError: (e) => toast.error(e.message),
    }
  );
};

  const getSemesterTitle = (semMeta: any, semesterNo: number) => {
  const dateText =
    semMeta?.actualStartDate
      ? formatDate(semMeta.actualStartDate)
      : semMeta?.plannedMonth
      ? formatPlannedMonth(semMeta.plannedMonth)
      : "";

  const instText =
    semMeta?.actualInstitution ||
    getInstitutionName(semMeta?.actualInstitutionId) ||
    semMeta?.plannedInstitution ||
    getInstitutionName(semMeta?.plannedInstitutionId) ||
    "";

  const courseText = getRegisteredCourses(semMeta).join(", ");

  return `${semesterNo}학기${dateText ? ` (${dateText})` : ""}${instText ? ` (${instText})` : ""}${courseText ? ` · ${courseText}` : ""}`;
};

  const handleSemFieldBlur = async (semId: number, field: string, value: string) => {
    const payload: any = { id: semId };

    if (field === "plannedSubjectCount" || field === "actualSubjectCount") {
      payload[field] = value ? parseInt(value) : undefined;
    } else {
      payload[field] = value || undefined;
    }

    updateSemMut.mutate(payload, {
      onSuccess: async () => {
        await utils.semester.list.invalidate({ studentId });
        await utils.planSemester.list.invalidate({ studentId });
      },
    });
  };

  const handleSelectedSemesterStatusChange = (nextStatus: "등록" | "등록 종료") => {
    if (!selectedSemester) {
      toast.error("선택된 학기가 없습니다.");
      return;
    }

    if (!isSelectedLastSemester) {
      toast.error("마지막 학기에서만 등록 종료할 수 있습니다.");
      return;
    }
  if (!isApprovedSemester) {
  toast.error("해당 학기 승인 완료 후에만 등록 상태를 변경할 수 있습니다.");
  return;
}

    updateSemMut.mutate(
      {
        id: selectedSemester.id,
        status: nextStatus,
      } as any,
      {
        onSuccess: async () => {
          await utils.semester.list.invalidate({ studentId });
          await utils.student.get.invalidate({ id: studentId });
          await utils.student.list.invalidate();

          updateStudentMut.mutate({
            id: studentId,
            status: nextStatus,
          } as any);
        },
        onError: (e) => toast.error(e.message),
      }
    );
  };

  const startEditPlan = () => {
  setPlanForm({
    desiredCourse: plan?.desiredCourse || "",
    finalEducation: plan?.finalEducation || "",
    totalTheorySubjects: plan?.totalTheorySubjects?.toString() || "",
    hasPractice: plan?.hasPractice || false,
    practiceHours: plan?.practiceHours?.toString() || "",
    practiceDate: plan?.practiceDate || "",
    practiceArranged: plan?.practiceArranged || false,
    practiceStatus:
  selectedPracticeSupport?.coordinationStatus ||
  (plan as any)?.practiceStatus ||
  "미섭외",
specialNotes: plan?.specialNotes || "",
practiceAddress:
  selectedPracticeSupport?.inputAddress ||
  (student as any)?.address ||
  "",
  });

  setEditingPlan(true);
};

 
const savePlan = async () => {
  try {
    await upsertPlanMut.mutateAsync({
      studentId,
      desiredCourse: planForm.desiredCourse || undefined,
      finalEducation: planForm.finalEducation || undefined,
      totalTheorySubjects: planForm.totalTheorySubjects
        ? parseInt(planForm.totalTheorySubjects)
        : undefined,
      hasPractice: planForm.hasPractice,
      practiceHours: planForm.practiceHours
        ? parseInt(planForm.practiceHours)
        : undefined,
      practiceDate: planForm.practiceDate || undefined,
      practiceArranged: planForm.practiceArranged,
      practiceStatus: (planForm.practiceStatus as any) || undefined,
      specialNotes: planForm.specialNotes || undefined,
    });

    if (planForm.hasPractice) {
      if (!student) {
        throw new Error("학생 정보를 찾을 수 없습니다.");
      }

      if (!planForm.desiredCourse?.trim()) {
        throw new Error("희망과정을 먼저 입력해주세요.");
      }

      await upsertPracticeSupportByStudentMut.mutateAsync({
  studentId,
  semesterId: null,
  assigneeId: Number(student.assigneeId || 0),
  clientName: String(student.clientName || "").trim(),
  phone: String(student.phone || "").trim(),
  course: String(planForm.desiredCourse || student.course || "").trim(),
  inputAddress:
    String(planForm.practiceAddress || (student as any)?.address || "").trim() || null,
        detailAddress: String((student as any)?.detailAddress || "").trim() || null,
        assigneeName: null,
        managerName: null,
        practiceHours: planForm.practiceHours
          ? Number(planForm.practiceHours)
          : null,
        practiceDate: planForm.practiceDate || null,
        includeEducationCenter: true,
        includePracticeInstitution: true,
        coordinationStatus:
          planForm.practiceStatus === "섭외중" || planForm.practiceStatus === "섭외완료"
            ? planForm.practiceStatus
            : "미섭외",
      });
    }

    await Promise.all([
      utils.plan.get.invalidate({ studentId }),
      utils.practiceSupport.listByStudent.invalidate({ studentId }),
      utils.semester.list.invalidate({ studentId }),
      utils.student.get.invalidate({ id: studentId }),
    ]);

    toast.success("플랜 및 실습 정보 저장 완료");
    setEditingPlan(false);
  } catch (e: any) {
    toast.error(e.message || "플랜 저장 중 오류가 발생했습니다.");
  }
};

  const openAddSemester = () => {
    const nextOrder =
      sortedSemesters.length > 0
        ? Math.max(...sortedSemesters.map((s: any) => Number(s.semesterOrder))) + 1
        : 1;

    setSemForm({
      semesterOrder: String(nextOrder),
      plannedMonth: "",
      plannedInstitutionId: "",
      plannedSubjectCount: "",
      plannedAmount: "",
    });
    setSemDialogOpen(true);
  };

  const handleAddSemester = () => {
    const selectedInstitution = institutionList?.find(
      (inst: any) => Number(inst.id) === Number(semForm.plannedInstitutionId)
    );

    createSemMut.mutate({
      studentId,
      semesterOrder: parseInt(semForm.semesterOrder),
      plannedMonth: semForm.plannedMonth || undefined,
      plannedInstitutionId: semForm.plannedInstitutionId
        ? Number(semForm.plannedInstitutionId)
        : undefined,
      plannedInstitution: selectedInstitution?.name || undefined,
      plannedSubjectCount: semForm.plannedSubjectCount
        ? parseInt(semForm.plannedSubjectCount)
        : undefined,
      plannedAmount: semForm.plannedAmount || undefined,
    } as any);
  };

  const planTotals = useMemo(() => {
    let major = 0;
    let liberal = 0;
    let general = 0;

    (planSemesterList || []).forEach((row: any) => {
      const c = Number(row.credits || 3);
      if (row.planCategory === "전공") major += c;
      if (row.planCategory === "교양") liberal += c;
      if (row.planCategory === "일반") general += c;
    });

    return {
      major,
      liberal,
      general,
      total: major + liberal + general,
    };
  }, [planSemesterList]);

  const transferTotals = useMemo(() => {
    let major = 0;
    let liberal = 0;
    let general = 0;

    (transferSubjectList || []).forEach((row: any) => {
      const c = Number(row.credits || 0);
      if (row.transferCategory === "전공") major += c;
      if (row.transferCategory === "교양") liberal += c;
      if (row.transferCategory === "일반") general += c;
    });

    return {
      major,
      liberal,
      general,
      total: major + liberal + general,
    };
  }, [transferSubjectList]);

  const finalTotals = useMemo(() => {
    const major = planTotals.major + transferTotals.major;
    const liberal = planTotals.liberal + transferTotals.liberal;
    const general = planTotals.general + transferTotals.general;

    return {
      major,
      liberal,
      general,
      total: major + liberal + general,
    };
  }, [planTotals, transferTotals]);

   const paymentSummaryCard = useMemo(() => {
    const totalRequired = (sortedSemesters || []).reduce(
      (sum: number, sem: any) => sum + toNumber(sem.plannedAmount),
      0
    );

    const totalPaid = (sortedSemesters || []).reduce((sum: number, sem: any) => {
      if (!sem.isCompleted) return sum;
      return sum + toNumber(sem.actualAmount);
    }, 0);

    const totalApprovedRefund = (refundList || []).reduce((sum: number, row: any) => {
      if (row.approvalStatus !== "승인") return sum;
      return sum + toNumber(row.refundAmount);
    }, 0);

    const netPaid = totalPaid - totalApprovedRefund;
    const remaining = Math.max(totalRequired - netPaid, 0);

    return {
      totalRequired,
      totalPaid,
      totalApprovedRefund,
      netPaid,
      remaining,
    };
  }, [sortedSemesters, refundList]);

  const registrationSummary = useMemo(() => {
  const sem = selectedSemester;
  const approvedRefund = sem?.id ? approvedRefundAmountMap[Number(sem.id)] || 0 : 0;

  return {
    status: student?.status || "",
    startDate: sem?.actualStartDate || "",
    paymentAmount: Math.max(0, toNumber(sem?.actualAmount) - approvedRefund),
    approvedRefundAmount: approvedRefund,
    subjectCount: sem?.actualSubjectCount ?? "",
    paymentDate: sem?.actualPaymentDate || "",
    institution:
      sem?.actualInstitution ||
      (sem?.actualInstitutionId ? getInstitutionName(sem.actualInstitutionId) : ""),
  };
}, [selectedSemester, student, institutionList, approvedRefundAmountMap]);

  const registrationInstitutionId = useMemo(() => {
    return selectedSemester?.actualInstitutionId || "";
  }, [selectedSemester]);

  const handleAddPlanSubject = (semesterNo: number) => {
    const current = (planSemesterList || []).filter(
      (x: any) => Number(x.semesterNo) === Number(semesterNo)
    );
    if (current.length >= 8) {
      toast.error("우리 플랜은 학기당 최대 8과목까지 등록할 수 있습니다.");
      return;
    }

    createPlanSemesterMut.mutate(
      {
        studentId,
        semesterNo,
        subjectName: `새 과목${current.length + 1}`,
        category: "전공",
        requirementType: "전공선택",
        sortOrder: current.length,
      } as any,
      {
        onSuccess: async () => {
          await utils.planSemester.list.invalidate({ studentId });
          toast.success("우리 플랜 과목 추가 완료");
        },
      }
    );
  };

  const handlePlanSemesterBlur = (id: number, field: string, value: any) => {
    const payload: any = { id };

    if (field === "semesterNo" || field === "sortOrder") {
      payload[field] = value ? Number(value) : undefined;
    } else {
      payload[field] = value;
    }

    updatePlanSemesterMut.mutate(payload);
  };

  const handleAddTransferSubjects = async () => {
    const count = Math.max(1, Math.min(100, Number(transferAddCount) || 1));
    const currentLen = transferSubjectList?.length ?? 0;

    if (currentLen + count > 100) {
      toast.error("전적대 과목은 최대 100개까지 등록할 수 있습니다.");
      return;
    }

    bulkCreateTransferSubjectMut.mutate({
      studentId,
      count,
      schoolName: "전적대",
    });
  };

  const handleTransferBlur = (id: number, field: string, value: any) => {
    const payload: any = { id };

    if (field === "credits" || field === "sortOrder") {
      payload[field] = value ? Number(value) : 0;
    } else {
      payload[field] = value;
    }

    updateTransferSubjectMut.mutate(payload);
  };

    const handleTransferAttachment = async (row: any, file: File) => {
    try {
      setUploadingTransferRowId(row.id);

      const uploaded = await uploadFile(file);

      updateTransferSubjectMut.mutate(
        {
          id: row.id,
          attachmentName: uploaded.fileName,
          attachmentUrl: uploaded.fileUrl,
        } as any,
        {
          onSuccess: async () => {
            await utils.transferSubject.list.invalidate({ studentId });
            toast.success("첨부파일이 저장되었습니다.");
          },
        }
      );
    } catch (e: any) {
      toast.error(e.message || "첨부 업로드에 실패했습니다.");
    } finally {
      setUploadingTransferRowId(null);
    }
  };

  const clearTransferAttachment = (row: any) => {
    updateTransferSubjectMut.mutate(
      {
        id: row.id,
        attachmentName: "",
        attachmentUrl: "",
      } as any,
      {
        onSuccess: async () => {
          await utils.transferSubject.list.invalidate({ studentId });
          toast.success("첨부파일이 해제되었습니다.");
        },
      }
    );
  };

  const requirementBadgeClass = (type?: string | null) => {
    if (type === "전공필수") return "bg-red-50 text-red-600 border border-red-200";
    if (type === "전공선택") return "bg-white text-black border border-gray-300";
    if (type === "교양") return "bg-blue-50 text-blue-600 border border-blue-200";
    if (type === "일반") return "bg-gray-50 text-gray-600 border border-gray-200";
    return "bg-gray-50 text-gray-600 border border-gray-200";
  };

 const handleCopyPlannedToActual = (sem: any) => {
  const actualStartDate = normalizePlannedMonthToDate(sem.plannedMonth);
  const today = new Date().toISOString().slice(0, 10);

  updateSemMut.mutate(
    {
      id: sem.id,
      actualStartDate: actualStartDate || undefined,
      actualInstitutionId: sem.plannedInstitutionId || undefined,
      actualSubjectCount: sem.plannedSubjectCount ?? undefined,
      actualAmount: sem.plannedAmount || undefined,
      actualPaymentDate: today,
    } as any,
    {
      onSuccess: async () => {
        await utils.semester.list.invalidate({ studentId });
        await utils.student.get.invalidate({ id: studentId });
        await utils.plan.get.invalidate({ studentId });
        toast.success("예정 정보를 실제 결제 정보로 복사했습니다.");
      },
    }
  );
};

  const focusPlanField = (key: string) => {
    const el = planFieldRefs.current[key];
    if (!el) return;
    window.requestAnimationFrame(() => el.focus());
  };

  const focusTransferField = (key: string) => {
    const el = transferFieldRefs.current[key];
    if (!el) return;
    window.requestAnimationFrame(() => el.focus());
  };

  const handlePlanNameKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    semesterNo: number,
    rowIndex: number,
    groupRows: any[]
  ) => {
    if (e.key !== "Tab" && e.key !== "Enter") return;
    e.preventDefault();

    const nextIndex = rowIndex + 1;
    if (nextIndex < groupRows.length) {
      focusPlanField(`plan-name-${semesterNo}-${nextIndex}`);
      return;
    }

    toast.message("마지막 과목입니다.");
  };

  const cycleSelectValue = (
    e: React.KeyboardEvent<HTMLSelectElement>,
    values: string[],
    currentValue: string,
    onChange: (next: string) => void
  ) => {
    if (e.key !== "Tab") return;
    e.preventDefault();

    const idx = values.indexOf(currentValue);
    const nextIdx = e.shiftKey
      ? (idx - 1 + values.length) % values.length
      : (idx + 1) % values.length;

    onChange(values[nextIdx]);
  };

 useEffect(() => {
  if (!subjectCatalogList?.length) {
    setSelectedCatalogId(null);
    return;
  }

  const exists = subjectCatalogList.some(
    (item: any) => Number(item.id) === Number(selectedCatalogId)
  );

  if (!exists) {
    setSelectedCatalogId(Number(subjectCatalogList[0].id));
  }
}, [subjectCatalogList, selectedCatalogId]);

  
  const currentSemesterPlanCount = useMemo(() => {
  if (!templateDialogSemesterNo) return 0;
  return (planSemesterList || []).filter(
    (row: any) => Number(row.semesterNo) === Number(templateDialogSemesterNo)
  ).length;
}, [planSemesterList, templateDialogSemesterNo]);

const templateSelectableCount = 8;

  const filteredTemplateList = useMemo(() => {
  return (subjectCatalogItemList || [])
    .filter(
      (row: any) =>
        String(row.requirementType || "").trim() === String(templateTab || "").trim()
    )
    .sort((a: any, b: any) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
}, [subjectCatalogItemList, templateTab]);

const selectedTemplateRows = useMemo(() => {
  const idSet = new Set(selectedTemplateIds.map((x) => Number(x)));
  return (subjectCatalogItemList || []).filter((row: any) =>
    idSet.has(Number(row.id))
  );
}, [subjectCatalogItemList, selectedTemplateIds]);  

const existingPlanSubjectMap = useMemo(() => {
  const map = new Map<string, number>();

  (planSemesterList || []).forEach((row: any) => {
    const key = String(row.subjectName || "").trim().replace(/\s+/g, " ");
    if (!key) return;

    if (!map.has(key)) {
      map.set(key, Number(row.semesterNo));
    }
  });

  return map;
}, [planSemesterList]);

  const toggleTemplateSubject = (id: number) => {
    const numericId = Number(id);
    const already = selectedTemplateIds.includes(numericId);

    if (already) {
      setSelectedTemplateIds((prev) => prev.filter((x) => x !== numericId));
      return;
    }

   if (selectedTemplateIds.length >= 8) {
  toast.error("일괄 등록은 최대 8과목까지 선택할 수 있습니다.");
  return;
}

    setSelectedTemplateIds((prev) => [...prev, numericId]);
  };

  const openTemplateDialog = (semesterNo: number) => {
  setTemplateDialogSemesterNo(semesterNo);
  setTemplateDialogOpen(true);
  setSelectedTemplateIds([]);
  setTemplateTab("전공필수");

  if (subjectCatalogList?.length) {
    setSelectedCatalogId(Number(subjectCatalogList[0].id));
  } else {
    toast.error("등록된 학점은행제 과정이 없습니다.");
  }
};

  if (studentLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setLocation("/students")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> 목록으로
        </Button>
        <p className="text-muted-foreground text-center py-20">학생 정보를 찾을 수 없습니다.</p>
      </div>
    );
  }

  const statusColor = (s: string) => {
  switch (s) {
    case "등록":
      return "bg-emerald-100 text-emerald-700";
    case "등록예정":
      return "bg-amber-100 text-amber-700";
    case "종료":
    case "등록 종료":
      return "bg-gray-200 text-gray-600";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/students")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{student.clientName}</h1>
          <p className="text-muted-foreground mt-0.5 text-sm">
  {(selectedSemester
    ? getRegisteredCourses(selectedSemester).join(", ") || student.course
    : student.course)}{" "}
  · 담당: {userMap.get(student.assigneeId) || "-"}
</p>
        </div>

        <div className="flex items-center gap-2">
  <Badge className={statusColor(displayStudentStatus)}>
    {displayStudentStatus}
  </Badge>

  <Badge
  className={
    selectedSemester?.approvalStatus === "승인"
      ? "bg-emerald-100 text-emerald-700"
      : selectedSemester?.approvalStatus === "불승인"
      ? "bg-red-100 text-red-700"
      : "bg-amber-100 text-amber-700"
  }
>
  {selectedSemester?.approvalStatus || "요청전"}
</Badge>
</div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
  {selectedSemester?.approvalStatus === "승인"
  ? `매출 보고 / 등록 정보 - ${selectedSemesterOrder}학기`
  : `예정 결제 / 승인대기 정보 - ${selectedSemesterOrder}학기`}
</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4 flex-wrap">
            {sortedSemesters.map((sem: any) => (
              <Button
                key={sem.id}
                type="button"
                size="sm"
                variant={
                  Number(selectedSemesterOrder) === Number(sem.semesterOrder)
                    ? "default"
                    : "outline"
                }
                onClick={() => setSelectedSemesterOrder(Number(sem.semesterOrder))}
              >
                {sem.semesterOrder}학기
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">이름</p>
              <EditableCell value={student.clientName} onBlur={() => {}} disabled />
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-0.5">연락처</p>
              <EditableCell value={formatPhone(student.phone)} onBlur={() => {}} disabled />
            </div>

            <div>
  <p className="text-xs text-muted-foreground mb-0.5">등록 과정</p>
  <EditableCell
    value={
      selectedSemester
        ? getRegisteredCourses(selectedSemester).join(", ") || student.course
        : student.course
    }
    onBlur={() => {}}
    disabled
  />
</div>

            <div>
              <p className="text-xs text-muted-foreground mb-0.5">상태</p>

              {canFinalizeRegistrationStatus ? (
  <Select
    value={selectedSemesterStatus || "등록"}
    onValueChange={(v) =>
      handleSelectedSemesterStatusChange(v as "등록" | "등록 종료")
    }
  >
    <SelectTrigger className="h-8 text-sm">
      <SelectValue />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="등록">등록</SelectItem>
      <SelectItem value="등록 종료">등록 종료</SelectItem>
    </SelectContent>
  </Select>
) : (
  <div className="h-8 px-3 rounded-md border bg-muted/30 text-sm flex items-center text-black">
    {displayStudentStatus}
  </div>
)}

             {!canFinalizeRegistrationStatus && (
  <p className="text-[11px] text-muted-foreground mt-1">
    {!isApprovedSemester
      ? "해당 학기 승인 완료 후 마지막 학기에서만 등록 종료할 수 있습니다."
      : "마지막 학기에서만 등록 종료할 수 있습니다."}
  </p>
)}
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-0.5">개강 날짜</p>
              <EditableCell
                value={registrationSummary.startDate ? formatDate(registrationSummary.startDate) : ""}
                onBlur={() => {}}
                type="date"
                disabled
              />
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-0.5">
                {selectedSemesterOrder}학기 결제 금액
              </p>
              <EditableCell
                value={
                  registrationSummary.paymentAmount
                    ? Number(registrationSummary.paymentAmount).toLocaleString() + "원"
                    : ""
                }
                onBlur={() => {}}
                disabled
              />
            </div>

{registrationSummary.approvedRefundAmount > 0 && (
  <p className="mt-1 text-[11px] text-red-600">
    환불 -{registrationSummary.approvedRefundAmount.toLocaleString()}원
  </p>
)}
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">과목 수</p>
              <EditableCell
                value={registrationSummary.subjectCount?.toString() || ""}
                onBlur={() => {}}
                disabled
              />
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-0.5">결제 일자</p>
              <EditableCell
                value={registrationSummary.paymentDate ? formatDate(registrationSummary.paymentDate) : ""}
                onBlur={() => {}}
                type="date"
                disabled
              />
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-0.5">교육원</p>
              <div className="h-8 px-3 rounded-md border bg-muted/30 text-sm flex items-center text-black">
                {registrationInstitutionId
                  ? institutionList?.find(
                      (inst: any) => Number(inst.id) === Number(registrationInstitutionId)
                    )?.name || "-"
                  : "-"}
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-0.5">총 학기 수</p>
              <EditableCell
                value={sortedSemesters.length ? String(sortedSemesters.length) : "0"}
                onBlur={() => {}}
                disabled
              />
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
  학기표의 입력완료 체크는 입력 상태 표시용입니다. 최종 등록 확정과 매출 반영은 승인관리에서 승인된 뒤 처리됩니다.
</div>
<div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">총 결제예정 금액</p>
              <p className="text-lg font-bold text-blue-700">
                {paymentSummaryCard.totalRequired.toLocaleString()}원
              </p>
            </div>
            <div className={`${isApprovedSemester ? "bg-emerald-50" : "bg-amber-50"} rounded-lg p-3`}>
  <p className="text-xs text-muted-foreground">
    {isApprovedSemester ? "수납 완료 금액" : "입력된 결제 금액"}
  </p>
  <p
    className={`text-lg font-bold ${
      isApprovedSemester ? "text-emerald-700" : "text-amber-700"
    }`}
  >
    {paymentSummaryCard.netPaid.toLocaleString()}원
  </p>
</div>
                       <div className="bg-red-50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">승인 환불 금액</p>
              <p className="text-lg font-bold text-red-600">
                {paymentSummaryCard.totalApprovedRefund > 0
                  ? `-${paymentSummaryCard.totalApprovedRefund.toLocaleString()}원`
                  : "0원"}
              </p>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">잔여 금액</p>
              <p className="text-lg font-bold text-amber-700">
                {paymentSummaryCard.remaining.toLocaleString()}원
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div ref={semesterSectionRef}>
  <Card
    className={`border-0 shadow-sm transition-all duration-500 ${
      highlightSection === "semester"
        ? "ring-2 ring-blue-400 bg-blue-50/40"
        : ""
    }`}
  >
    <CardHeader className="flex flex-row items-center justify-between pb-3">
      <CardTitle className="text-base">학기별 예정표 / 결제표</CardTitle>
          <div className="flex gap-2">
  <Button
    variant="outline"
    size="sm"
    onClick={() => {
      setSelectedPrivateCertNames([]);
      setPrivateCertDialogOpen(true);
    }}
    className="gap-1 text-blue-600 border-blue-200 hover:bg-blue-50"
  >
    민간자격증 요청
  </Button>

<Button
  variant="outline"
  size="sm"
  onClick={() => openCourseDialog(selectedSemester || sortedSemesters[0])}
  className="gap-1 text-violet-600 border-violet-200 hover:bg-violet-50"
>
  등록 과정 추가/수정
</Button>

  <Button
  variant="outline"
  size="sm"
  onClick={() => {
    setRefundForm((prev) => ({
      ...prev,
      semesterId: selectedSemester?.id ? String(selectedSemester.id) : "",
    }));
    setRefundDialogOpen(true);
  }}
  className="gap-1 text-red-600 border-red-200 hover:bg-red-50"
>
  환불 등록
</Button>

  <Button variant="outline" size="sm" onClick={openAddSemester} className="gap-1">
    <Plus className="h-3.5 w-3.5" /> 학기 추가
  </Button>
</div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground w-[60px]">학기</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">예정 개강월</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">예정 교육원</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">예정 과목수</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">예정 금액</th>
                  <th className="px-3 py-2 text-left font-medium text-primary">실제 개강일</th>
                  <th className="px-3 py-2 text-left font-medium text-primary">실제 교육원</th>
                  <th className="px-3 py-2 text-left font-medium text-primary">실제 과목수</th>
                  <th className="px-3 py-2 text-left font-medium text-primary">실제 금액</th>
                  <th className="px-3 py-2 text-left font-medium text-primary">결제일</th>
                  <th className="px-3 py-2 text-center font-medium text-muted-foreground w-[70px]">입력완료</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground w-[130px]">관리</th>
                </tr>
              </thead>
              <tbody>
                {!semesters || semesters.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                      등록된 학기가 없습니다.
                    </td>
                  </tr>
                ) : (
  semesters.map((sem: any) => {
    const approvedRefundAmount = approvedRefundAmountMap[Number(sem.id)] || 0;
    const pendingRefundAmount = pendingRefundAmountMap[Number(sem.id)] || 0;

    const displayPlannedAmount = Math.max(
      0,
      toNumber(sem.plannedAmount) - approvedRefundAmount
    );

    const displayActualAmount = Math.max(
      0,
      toNumber(sem.actualAmount) - approvedRefundAmount
    );

    return (
      <tr key={sem.id} className={`border-b last:border-0 ${sem.isCompleted ? "bg-emerald-50/50" : ""}`}>
                      <td className="px-3 py-1.5 font-medium text-sm">
                        {sem.semesterOrder}학기
                      </td>

                      <td className="px-1 py-0.5">
                        <EditableCell
                          value={sem.plannedMonth ? (sem.plannedMonth.length === 6 ? sem.plannedMonth.slice(0, 4) + "-" + sem.plannedMonth.slice(4) : sem.plannedMonth) : ""}
                          onBlur={(v) => handleSemFieldBlur(sem.id, "plannedMonth", v)}
                        />
                      </td>

                      <td className="px-1 py-0.5">
                        <Select
                          value={sem.plannedInstitutionId ? String(sem.plannedInstitutionId) : ""}
                          onValueChange={(v) =>
                            updateSemMut.mutate({
                              id: sem.id,
                              plannedInstitutionId: Number(v),
                            } as any)
                          }
                        >
                          <SelectTrigger className="h-8 text-sm">
                            <SelectValue placeholder="교육원 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {(institutionList || []).map((inst: any) => (
                              <SelectItem key={inst.id} value={String(inst.id)}>
                                {inst.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      <td className="px-1 py-0.5">
                        <EditableCell
                          value={sem.plannedSubjectCount?.toString() || ""}
                          onBlur={(v) => handleSemFieldBlur(sem.id, "plannedSubjectCount", v)}
                        />
                      </td>

                      <td className="px-1 py-0.5">
                        <div className="space-y-1">
  <EditableCell
    value={displayPlannedAmount ? displayPlannedAmount.toLocaleString() : ""}
    onBlur={(v) => {
      const nextValue = v.replace(/[^0-9]/g, "");
      const nextGross = toNumber(nextValue) + approvedRefundAmount;
      handleSemFieldBlur(sem.id, "plannedAmount", String(nextGross));
    }}
  />
  {approvedRefundAmount > 0 && (
    <div className="text-[11px] text-red-600">
      환불 -{approvedRefundAmount.toLocaleString()}원
    </div>
  )}
  {pendingRefundAmount > 0 && (
    <div className="text-[11px] text-amber-600">
      승인대기 {pendingRefundAmount.toLocaleString()}원
    </div>
  )}
</div>
                      </td>

                      <td className="px-1 py-0.5">
                        <EditableCell
                          value={sem.actualStartDate ? (typeof sem.actualStartDate === "string" ? sem.actualStartDate.slice(0, 10) : new Date(sem.actualStartDate).toISOString().slice(0, 10)) : ""}
                          onBlur={(v) => handleSemFieldBlur(sem.id, "actualStartDate", v)}
                          type="date"
                          className="text-primary"
                        />
                      </td>

                      <td className="px-1 py-0.5">
                        <Select
                          value={sem.actualInstitutionId ? String(sem.actualInstitutionId) : ""}
                          onValueChange={(v) =>
                            updateSemMut.mutate({
                              id: sem.id,
                              actualInstitutionId: Number(v),
                            } as any)
                          }
                        >
                          <SelectTrigger className="h-8 text-sm text-primary">
                            <SelectValue placeholder="교육원 선택" />
                          </SelectTrigger>
                          <SelectContent>
                            {(institutionList || []).map((inst: any) => (
                              <SelectItem key={inst.id} value={String(inst.id)}>
                                {inst.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      <td className="px-1 py-0.5">
                        <EditableCell
                          value={sem.actualSubjectCount?.toString() || ""}
                          onBlur={(v) => handleSemFieldBlur(sem.id, "actualSubjectCount", v)}
                          className="text-primary"
                        />
                      </td>

                      <td className="px-1 py-0.5">
                        <div className="space-y-1">
  <EditableCell
    value={displayActualAmount ? displayActualAmount.toLocaleString() : ""}
    onBlur={(v) => {
      const nextValue = v.replace(/[^0-9]/g, "");
      const nextGross = toNumber(nextValue) + approvedRefundAmount;
      handleSemFieldBlur(sem.id, "actualAmount", String(nextGross));
    }}
    className="text-primary font-medium"
  />
  {approvedRefundAmount > 0 && (
    <div className="text-[11px] text-red-600">
      환불 -{approvedRefundAmount.toLocaleString()}원
    </div>
  )}
  {pendingRefundAmount > 0 && (
    <div className="text-[11px] text-amber-600">
      승인대기 {pendingRefundAmount.toLocaleString()}원
    </div>
  )}
</div>
                      </td>

                      <td className="px-1 py-0.5">
                        <EditableCell
                          value={sem.actualPaymentDate ? (typeof sem.actualPaymentDate === "string" ? sem.actualPaymentDate.slice(0, 10) : new Date(sem.actualPaymentDate).toISOString().slice(0, 10)) : ""}
                          onBlur={(v) => handleSemFieldBlur(sem.id, "actualPaymentDate", v)}
                          type="date"
                          className="text-primary"
                        />
                      </td>

                      <td className="px-3 py-1.5 text-center">
  <div title="입력완료는 학기 정보 입력 여부만 표시합니다. 등록 확정 및 매출 반영은 승인관리 승인 후 처리됩니다.">
   <Checkbox
  checked={sem.isCompleted}
  onCheckedChange={(checked) => {
    if (!!checked && toNumber(sem.actualAmount) <= 0) {
      toast.error("입력완료 처리하려면 실제 금액을 먼저 입력해주세요.");
      return;
    }

    updateSemMut.mutate(
      {
        id: sem.id,
        isCompleted: !!checked,
        approvalStatus: checked ? "대기" : "요청전",
      } as any,
      {
        onSuccess: () => {
          toast.success(
            checked
              ? "학기 입력완료로 표시되었습니다. 승인관리에서 이 학기만 승인/불승인 처리할 수 있습니다."
              : "학기 입력완료가 해제되었습니다."
          );
        },
      }
    );
  }}
/>
  </div>
</td>

                      <td className="px-2 py-1.5 text-right">
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="우리 플랜으로 이동"
                            onClick={() => moveToPlanSemester(Number(sem.semesterOrder))}
                          >
                            <ArrowLeft className="h-3 w-3 text-violet-500 rotate-180" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="예정표 가져오기"
                            onClick={() => handleCopyPlannedToActual(sem)}
                          >
                            <Copy className="h-3 w-3 text-blue-500" />
                          </Button>

<Button
  variant="ghost"
  size="icon"
  className="h-7 w-7"
  title="등록 과정 설정"
  onClick={() => openCourseDialog(sem)}
>
  <Pencil className="h-3 w-3 text-violet-500" />
</Button>

                          {!sem.isLocked && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm("삭제하시겠습니까?")) deleteSemMut.mutate({ id: sem.id });
                              }}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
);
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
</div>

      <div ref={planSummarySectionRef}>
  <Card
    className={`border-0 shadow-sm transition-all duration-500 ${
      highlightSection === "private-certificate" ||
      highlightSection === "practice-support"
        ? "ring-2 ring-violet-400 bg-violet-50/30"
        : ""
    }`}
  >
    <CardHeader className="flex flex-row items-center justify-between pb-3">
      <CardTitle className="text-base">플랜 요약</CardTitle>
          {!editingPlan ? (
            <Button variant="outline" size="sm" onClick={startEditPlan} className="gap-1">
              {plan ? "수정" : "작성"}
            </Button>
          ) : (
            <div className="flex gap-2">
  <Button variant="outline" size="sm" onClick={() => setEditingPlan(false)}>
    취소
  </Button>

  <Button
    size="sm"
    onClick={savePlan}
    disabled={upsertPlanMut.isPending}
    className="gap-1"
  >
    <Save className="h-3.5 w-3.5" /> 저장
  </Button>
</div>
          )}
        </CardHeader>

        <CardContent>
          {!editingPlan ? (
            plan ? (
              <div className="space-y-3">
  <div className="bg-muted/50 rounded-lg p-4 text-sm">
    <p>
      <span className="font-medium">희망과정:</span> {plan.desiredCourse || "-"} ·{" "}
      <span className="font-medium">최종학력:</span> {plan.finalEducation || "-"} ·{" "}
      <span className="font-medium">이론 과목:</span> {plan.totalTheorySubjects ?? "-"}과목 ·{" "}
      <span className="font-medium">실습:</span> {plan.hasPractice ? "있음" : "없음"} ·{" "}
      <span className="font-medium">특이사항:</span> {plan.specialNotes || "없음"}
    </p>
  </div>

{requestedPrivateCertList.length > 0 && (
  <div
  ref={privateCertificateSectionRef}
  className={`rounded-lg p-4 text-sm border transition-all duration-500 ${
    highlightSection === "private-certificate"
      ? "bg-violet-100 border-violet-400 ring-2 ring-violet-300"
      : "bg-violet-50 border-violet-100"
  }`}
>
    <p className="font-medium text-violet-700 mb-2">민간자격증 요청확인</p>

    <div className="flex flex-wrap gap-2">
      {requestedPrivateCertList.map((item: any) => (
        <div
          key={item.id}
          className="inline-flex items-center gap-2 px-2 py-1 rounded-md bg-white border border-violet-200 text-xs"
        >
          <span className="text-violet-700">{item.certificateName}</span>

          <Badge className="bg-violet-100 text-violet-700 border border-violet-200">
            {item.requestStatus}
          </Badge>

          {isAdmin && (
            <button
              type="button"
              className="text-muted-foreground hover:text-destructive"
              onClick={() => {
                if (confirm("민간자격증 요청을 삭제하시겠습니까?")) {
                  deletePrivateCertificateRequestMut.mutate({ id: item.id });
                }
              }}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      ))}
    </div>

    <p className="text-xs text-violet-700/80 mt-2">
      요청된 민간자격증 내역입니다.
    </p>
  </div>
)} 

 {plan.hasPractice && (
  <div
    ref={practiceSupportSectionRef}
    className={`rounded-lg p-4 text-sm transition-all duration-500 ${
      highlightSection === "practice-support"
        ? "bg-blue-100 ring-2 ring-blue-300"
        : "bg-blue-50"
    }`}
  >
    <p className="font-medium text-blue-700 mb-1">실습 정보</p>
    <p>
      <span className="font-medium">실습 시간:</span>{" "}
      {selectedPracticeSupport?.practiceHours
        ? `${selectedPracticeSupport.practiceHours}시간`
        : plan.practiceHours
        ? `${plan.practiceHours}시간`
        : "-"}{" "}
      ·{" "}
      <span className="font-medium">실습 예정일:</span>{" "}
      {selectedPracticeSupport?.practiceDate || plan.practiceDate || "-"} ·{" "}
      <span className="font-medium">섭외 상태:</span>{" "}
      {selectedPracticeSupport?.coordinationStatus || "미섭외"}
    </p>

    <p className="mt-1">
      <span className="font-medium">주소:</span>{" "}
     {selectedPracticeSupport?.inputAddress ||
  selectedPracticeSupport?.detailAddress ||
  (student as any)?.address ||
  (student as any)?.detailAddress ||
  "-"}{" "}
      · <span className="font-medium">담당자:</span>{" "}
      {selectedPracticeSupport?.managerName ||
        selectedPracticeSupport?.assigneeName ||
        userMap.get(student.assigneeId) ||
        "-"}
    </p>
  </div>
)}
</div>
            ) : (
              <p className="text-sm text-muted-foreground py-4 text-center">
                아직 플랜이 작성되지 않았습니다.
              </p>
            )
          ) : (
            <div className="grid gap-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">희망과정</Label>
                  <Input
                    value={planForm.desiredCourse}
                    onChange={(e) => setPlanForm({ ...planForm, desiredCourse: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">최종학력</Label>
                  <Input
                    value={planForm.finalEducation}
                    onChange={(e) => setPlanForm({ ...planForm, finalEducation: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">총 이론 과목 수</Label>
                  <Input
                    type="number"
                    value={planForm.totalTheorySubjects}
                    onChange={(e) => setPlanForm({ ...planForm, totalTheorySubjects: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={planForm.hasPractice}
                  onCheckedChange={(checked) => setPlanForm({ ...planForm, hasPractice: !!checked })}
                />
                <Label className="text-sm">실습 필요</Label>
              </div>
              {planForm.hasPractice && (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6 border-l-2 border-blue-200">
    <div className="md:col-span-2">
      <p className="text-xs text-muted-foreground">
        실습교육원/실습기관 선택은 실습배정지원센터에서 진행됩니다.
      </p>
    </div>

    <div className="space-y-1">
      <Label className="text-xs">실습 시간</Label>
      <Input
        type="number"
        value={planForm.practiceHours}
        onChange={(e) =>
          setPlanForm({ ...planForm, practiceHours: e.target.value })
        }
        placeholder="시간"
      />
    </div>

    <div className="space-y-1">
      <Label className="text-xs">실습 예정일</Label>
      <Input
        value={planForm.practiceDate}
        onChange={(e) =>
          setPlanForm({ ...planForm, practiceDate: e.target.value })
        }
        placeholder="예: 2026-06"
      />
    </div>

    <div className="space-y-1 md:col-span-2">
      <Label className="text-xs">주소</Label>
      <Input
        value={planForm.practiceAddress}
        onChange={(e) =>
          setPlanForm({ ...planForm, practiceAddress: e.target.value })
        }
        placeholder="실습 진행 지역 입력 (상세주소 X) ..."
      />
    </div>

    <div className="space-y-1">
      <Label className="text-xs">섭외 상태</Label>
      <select
        className="w-full h-9 px-3 text-sm border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary"
        value={planForm.practiceStatus}
        onChange={(e) =>
          setPlanForm({
            ...planForm,
            practiceStatus: e.target.value,
            practiceArranged: e.target.value === "섭외완료",
          })
        }
      >
        <option value="미섭외">미섭외</option>
        <option value="섭외중">섭외중</option>
        <option value="섭외완료">섭외완료</option>
      </select>
    </div>
  </div>
)}

              <div className="space-y-1">
                <Label className="text-xs">특이사항</Label>
                <Textarea
                  value={planForm.specialNotes}
                  onChange={(e) => setPlanForm({ ...planForm, specialNotes: e.target.value })}
                  rows={2}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
</div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">학생 플랜</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-sm">우리 플랜 (학점은행제 / 과목당 3학점 고정)</h3>
              <p className="text-xs text-muted-foreground mt-1">
                학기별 예정표에서 학기를 추가하면 과목 수 기준으로 자동 생성됩니다.
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                과목명 입력칸에서 Enter / Tab 누르면 다음 과목명으로 이동합니다.
              </p>
            </div>

            {groupedPlanSemesters.length === 0 ? (
              <div className="border rounded-lg p-6 text-sm text-muted-foreground text-center">
                등록된 학기 플랜이 없습니다.
              </div>
            ) : (
              groupedPlanSemesters.map((group) => {
                const semMeta = semesterMetaMap.get(group.semesterNo);

                return (
                  <div
                    key={group.semesterNo}
                    ref={(el) => {
                      planSectionRefs.current[group.semesterNo] = el;
                    }}
                    className="border rounded-lg overflow-hidden"
                  >
                    <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-b">
                      <div className="font-medium">{getSemesterTitle(semMeta, group.semesterNo)}</div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAddPlanSubject(group.semesterNo)}
                          disabled={group.rows.length >= 8}
                        >
                          과목 추가
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openTemplateDialog(group.semesterNo)}
                        >
                          일괄 등록
                        </Button>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-white">
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground">과목명</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground w-[110px]">구분</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground w-[130px]">타입</th>
                            <th className="px-3 py-2 text-center font-medium text-muted-foreground w-[70px]">학점</th>
                            <th className="px-3 py-2 text-right font-medium text-muted-foreground w-[70px]">관리</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((row: any, rowIndex: number) => (
                            <tr key={row.id} className="border-b last:border-0">
                              <td className="px-2 py-1">
                                <Input
                                  ref={(el) => {
                                    planFieldRefs.current[`plan-name-${group.semesterNo}-${rowIndex}`] = el;
                                  }}
                                  defaultValue={row.subjectName || ""}
                                  className={`h-8 ${row.planRequirementType === "전공필수" ? "text-red-600 font-medium" : ""}`}
                                  onBlur={(e) => handlePlanSemesterBlur(row.id, "subjectName", e.target.value)}
                                  onKeyDown={(e) => handlePlanNameKeyDown(e, group.semesterNo, rowIndex, group.rows)}
                                />
                              </td>

                              <td className="px-2 py-1">
                                <select
                                  ref={(el) => {
                                    planFieldRefs.current[`plan-category-${group.semesterNo}-${rowIndex}`] = el;
                                  }}
                                  className="w-full h-8 px-2 text-sm border rounded bg-white"
                                  value={row.planCategory || "전공"}
                                  onChange={(e) => {
                                    const nextCategory = e.target.value;
                                    handlePlanSemesterBlur(row.id, "category", nextCategory);

                                    if (nextCategory === "교양") {
                                      handlePlanSemesterBlur(row.id, "requirementType", "교양");
                                    } else if (nextCategory === "일반") {
                                      handlePlanSemesterBlur(row.id, "requirementType", "일반");
                                    } else {
                                      handlePlanSemesterBlur(
                                        row.id,
                                        "requirementType",
                                        row.planRequirementType === "전공필수" ? "전공필수" : "전공선택"
                                      );
                                    }
                                  }}
                                  onKeyDown={(e) =>
                                    cycleSelectValue(
                                      e,
                                      ["전공", "교양", "일반"],
                                      row.planCategory || "전공",
                                      (next) => {
                                        handlePlanSemesterBlur(row.id, "category", next);

                                        if (next === "교양") {
                                          handlePlanSemesterBlur(row.id, "requirementType", "교양");
                                        } else if (next === "일반") {
                                          handlePlanSemesterBlur(row.id, "requirementType", "일반");
                                        } else {
                                          handlePlanSemesterBlur(
                                            row.id,
                                            "requirementType",
                                            row.planRequirementType === "전공필수" ? "전공필수" : "전공선택"
                                          );
                                        }
                                      }
                                    )
                                  }
                                >
                                  <option value="전공">전공</option>
                                  <option value="교양">교양</option>
                                  <option value="일반">일반</option>
                                </select>
                              </td>

                              <td className="px-2 py-1">
                                {row.planCategory === "전공" ? (
                                  <select
                                    ref={(el) => {
                                      planFieldRefs.current[`plan-type-${group.semesterNo}-${rowIndex}`] = el;
                                    }}
                                    className={`w-full h-8 px-2 text-sm rounded ${requirementBadgeClass(row.planRequirementType)}`}
                                    value={row.planRequirementType || "전공선택"}
                                    onChange={(e) => handlePlanSemesterBlur(row.id, "requirementType", e.target.value)}
                                    onKeyDown={(e) =>
                                      cycleSelectValue(
                                        e,
                                        ["전공필수", "전공선택"],
                                        row.planRequirementType || "전공선택",
                                        (next) => handlePlanSemesterBlur(row.id, "requirementType", next)
                                      )
                                    }
                                  >
                                    <option value="전공필수">전공필수</option>
                                    <option value="전공선택">전공선택</option>
                                  </select>
                                ) : (
                                  <div
                                    className={`w-full h-8 px-2 text-sm rounded border flex items-center ${requirementBadgeClass(row.planCategory)}`}
                                  >
                                    {row.planCategory}
                                  </div>
                                )}
                              </td>

                              <td className="px-3 py-2 text-center font-medium text-black">3</td>

                              <td className="px-2 py-1 text-right">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-destructive hover:text-destructive"
                                  onClick={() => {
                                    if (confirm("과목을 삭제하시겠습니까?")) {
                                      deletePlanSemesterMut.mutate(
                                        { id: row.id },
                                        {
                                          onSuccess: async () => {
                                            await utils.planSemester.list.invalidate({ studentId });
                                            toast.success("우리 플랜 과목 삭제 완료");
                                          },
                                        }
                                      );
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-semibold text-sm">전적대 / 이전 이수과목</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  최대 100과목까지 등록 가능하며 학점은 직접 입력합니다.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap justify-end">
                <Input
                  className="h-8 w-20"
                  value={transferAddCount}
                  onChange={(e) => setTransferAddCount(e.target.value.replace(/[^0-9]/g, ""))}
                />
                <Button size="sm" variant="outline" onClick={handleAddTransferSubjects}>
                  일괄 추가
                </Button>
                <>
  <input
    id="transfer-common-file"
    type="file"
    className="hidden"
    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.hwp"
    onChange={async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        setUploadingTransferCommon(true);
        const uploaded = await uploadFile(file);

        createTransferAttachmentMut.mutate({
          studentId,
          fileName: uploaded.fileName,
          fileUrl: uploaded.fileUrl,
        });
      } catch (err: any) {
        toast.error(err.message || "공통 첨부 업로드에 실패했습니다.");
      } finally {
        setUploadingTransferCommon(false);
        e.currentTarget.value = "";
      }
    }}
  />

  <Button
    size="sm"
    variant="outline"
    onClick={() => {
      const el = document.getElementById("transfer-common-file") as HTMLInputElement | null;
      el?.click();
    }}
    disabled={uploadingTransferCommon}
  >
    {uploadingTransferCommon ? "업로드중..." : "첨부 추가"}
  </Button>
</>
              </div>
            </div>

            {!!transferAttachmentList?.length && (
              <div className="flex flex-wrap gap-2">
                {transferAttachmentList.map((file: any) => (
                  <div
                    key={file.id}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border bg-white text-sm"
                  >
                    <a
                      href={file.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline"
                    >
                      {file.fileName}
                    </a>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-destructive"
                      onClick={() => {
                        if (confirm("첨부파일을 삭제하시겠습니까?")) {
                          deleteTransferAttachmentMut.mutate({ id: file.id });
                        }
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">학교명</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">과목명</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground w-[110px]">구분</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground w-[130px]">타입</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground w-[80px]">학점</th>
                      <th className="px-3 py-2 text-center font-medium text-muted-foreground w-[130px]">첨부파일</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground w-[150px]">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!transferSubjectList || transferSubjectList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                          등록된 전적대 과목이 없습니다.
                        </td>
                      </tr>
                    ) : (
                      transferSubjectList.map((row: any, rowIndex: number) => (
                        <tr key={row.id} className="border-b last:border-0">
                          <td className="px-2 py-1">
                            <Input
                              ref={(el) => {
                                transferFieldRefs.current[`transfer-school-${rowIndex}`] = el;
                              }}
                              defaultValue={row.schoolName || ""}
                              className="h-8"
                              onBlur={(e) => handleTransferBlur(row.id, "schoolName", e.target.value)}
                            />
                          </td>

                          <td className="px-2 py-1">
                            <Input
                              ref={(el) => {
                                transferFieldRefs.current[`transfer-subject-${rowIndex}`] = el;
                              }}
                              defaultValue={row.subjectName || ""}
                              className="h-8"
                              onBlur={(e) => handleTransferBlur(row.id, "subjectName", e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === "Tab") {
                                  e.preventDefault();
                                  focusTransferField(`transfer-subject-${rowIndex + 1}`);
                                }
                              }}
                            />
                          </td>

                          <td className="px-2 py-1">
                            <select
                              className="w-full h-8 px-2 text-sm border rounded bg-white"
                              value={row.transferCategory || "전공"}
                              onChange={(e) => {
                                const next = e.target.value;
                                handleTransferBlur(row.id, "category", next);

                                if (next === "교양") {
                                  handleTransferBlur(row.id, "requirementType", "교양");
                                } else if (next === "일반") {
                                  handleTransferBlur(row.id, "requirementType", "일반");
                                } else {
                                  handleTransferBlur(
                                    row.id,
                                    "requirementType",
                                    row.transferRequirementType === "전공필수" ? "전공필수" : "전공선택"
                                  );
                                }
                              }}
                              onKeyDown={(e) =>
                                cycleSelectValue(
                                  e,
                                  ["전공", "교양", "일반"],
                                  row.transferCategory || "전공",
                                  (next) => {
                                    handleTransferBlur(row.id, "category", next);

                                    if (next === "교양") {
                                      handleTransferBlur(row.id, "requirementType", "교양");
                                    } else if (next === "일반") {
                                      handleTransferBlur(row.id, "requirementType", "일반");
                                    } else {
                                      handleTransferBlur(
                                        row.id,
                                        "requirementType",
                                        row.transferRequirementType === "전공필수" ? "전공필수" : "전공선택"
                                      );
                                    }
                                  }
                                )
                              }
                            >
                              <option value="전공">전공</option>
                              <option value="교양">교양</option>
                              <option value="일반">일반</option>
                            </select>
                          </td>

                          <td className="px-2 py-1">
                            <select
                              className={`w-full h-8 px-2 text-sm rounded ${requirementBadgeClass(row.transferRequirementType)}`}
                              value={row.transferRequirementType || "전공선택"}
                              onChange={(e) => handleTransferBlur(row.id, "requirementType", e.target.value)}
                              onKeyDown={(e) => {
                                const list =
                                  row.transferCategory === "전공"
                                    ? ["전공필수", "전공선택"]
                                    : row.transferCategory === "교양"
                                    ? ["교양"]
                                    : ["일반"];

                                cycleSelectValue(
                                  e,
                                  list,
                                  row.transferRequirementType || list[0],
                                  (next) => handleTransferBlur(row.id, "requirementType", next)
                                );
                              }}
                            >
                              {row.transferCategory === "전공" && (
                                <>
                                  <option value="전공필수">전공필수</option>
                                  <option value="전공선택">전공선택</option>
                                </>
                              )}
                              {row.transferCategory === "교양" && <option value="교양">교양</option>}
                              {row.transferCategory === "일반" && <option value="일반">일반</option>}
                            </select>
                          </td>

                          <td className="px-2 py-1">
                            <Input
                              defaultValue={row.credits?.toString() || ""}
                              className="h-8 text-center"
                              onBlur={(e) => handleTransferBlur(row.id, "credits", e.target.value)}
                            />
                          </td>

                          <td className="px-2 py-1 text-center">
  {row.attachmentUrl ? (
    <a
      href={row.attachmentUrl}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-sm text-blue-600 underline"
      onClick={(e) => e.stopPropagation()}
    >
      <Paperclip className="h-3.5 w-3.5" />
      {row.attachmentName || "파일보기"}
    </a>
  ) : (
    <>
      <input
        id={`transfer-row-file-${row.id}`}
        type="file"
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.hwp"
        onChange={async (e) => {
          e.stopPropagation();
          const file = e.target.files?.[0];
          if (!file) return;
          await handleTransferAttachment(row, file);
          e.currentTarget.value = "";
        }}
      />

      <Button
        variant="outline"
        size="sm"
        disabled={uploadingTransferRowId === row.id}
        onClick={(e) => {
          e.stopPropagation();
          const el = document.getElementById(
            `transfer-row-file-${row.id}`
          ) as HTMLInputElement | null;
          el?.click();
        }}
      >
        {uploadingTransferRowId === row.id ? "업로드중..." : "첨부"}
      </Button>
    </>
  )}
</td>

                          <td className="px-2 py-1 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <>
  <input
    id={`transfer-row-file-change-${row.id}`}
    type="file"
    className="hidden"
    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.hwp"
    onChange={async (e) => {
      e.stopPropagation();
      const file = e.target.files?.[0];
      if (!file) return;
      await handleTransferAttachment(row, file);
      e.currentTarget.value = "";
    }}
  />

  <Button
    variant="ghost"
    size="sm"
    disabled={uploadingTransferRowId === row.id}
    onClick={(e) => {
      e.stopPropagation();
      const el = document.getElementById(
        `transfer-row-file-change-${row.id}`
      ) as HTMLInputElement | null;
      el?.click();
    }}
  >
    {uploadingTransferRowId === row.id ? "업로드중..." : row.attachmentUrl ? "변경" : "등록"}
  </Button>
</>

                              {row.attachmentUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-muted-foreground"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    clearTransferAttachment(row);
                                  }}
                                >
                                  해제
                                </Button>
                              )}

                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (confirm("전적대 과목을 삭제하시겠습니까?")) {
                                    deleteTransferSubjectMut.mutate({ id: row.id });
                                  }
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-lg border bg-blue-50 p-4">
              <div className="font-semibold text-sm text-blue-700 mb-2">우리 플랜</div>
              <div className="text-sm space-y-1">
                <div>전공: <span className="font-medium">{planTotals.major}학점</span></div>
                <div>교양: <span className="font-medium">{planTotals.liberal}학점</span></div>
                <div>일반: <span className="font-medium">{planTotals.general}학점</span></div>
                <div className="pt-1 border-t">총합: <span className="font-bold">{planTotals.total}학점</span></div>
              </div>
            </div>

            <div className="rounded-lg border bg-amber-50 p-4">
              <div className="font-semibold text-sm text-amber-700 mb-2">전적대</div>
              <div className="text-sm space-y-1">
                <div>전공: <span className="font-medium">{transferTotals.major}학점</span></div>
                <div>교양: <span className="font-medium">{transferTotals.liberal}학점</span></div>
                <div>일반: <span className="font-medium">{transferTotals.general}학점</span></div>
                <div className="pt-1 border-t">총합: <span className="font-bold">{transferTotals.total}학점</span></div>
              </div>
            </div>

            <div className="rounded-lg border bg-emerald-50 p-4">
              <div className="font-semibold text-sm text-emerald-700 mb-2">최종 합계</div>
              <div className="text-sm space-y-1">
                <div>전공: <span className="font-medium">{finalTotals.major}학점</span></div>
                <div>교양: <span className="font-medium">{finalTotals.liberal}학점</span></div>
                <div>일반: <span className="font-medium">{finalTotals.general}학점</span></div>
                <div className="pt-1 border-t">총합: <span className="font-bold">{finalTotals.total}학점</span></div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>
              {templateDialogSemesterNo ? `${templateDialogSemesterNo}학기 일괄 등록` : "일괄 등록"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid md:grid-cols-[180px_1fr] gap-4">
              <div className="space-y-2">
                <Label className="text-sm">과정 선택</Label>
<Select
  value={selectedCatalogId ? String(selectedCatalogId) : ""}
  onValueChange={(v) => {
    setSelectedCatalogId(Number(v));
    setSelectedTemplateIds([]);
    setTemplateTab("전공필수");
  }}
>
  <SelectTrigger className="h-9 text-sm">
    <SelectValue placeholder="과정 선택" />
  </SelectTrigger>
  <SelectContent>
    {(subjectCatalogList || []).map((item: any) => (
      <SelectItem key={item.id} value={String(item.id)}>
        {item.name}
      </SelectItem>
    ))}
  </SelectContent>
</Select>

                <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                  <div>현재 학기 기존 과목: <span className="font-medium">{currentSemesterPlanCount}</span>개</div>
<div>선택 가능 과목: <span className="font-medium">최대 8개</span></div>
<div>선택 과목: <span className="font-medium">{selectedTemplateIds.length}</span>개</div>
<div className="text-[11px] text-muted-foreground">
  등록 시 현재 학기 과목은 선택한 마스터 과목으로 덮어써집니다.
</div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {(["전공필수", "전공선택", "교양", "일반"] as TemplateTabType[]).map((tab) => (
                    <Button
                      key={tab}
                      type="button"
                      size="sm"
                      variant={templateTab === tab ? "default" : "outline"}
                      onClick={() => setTemplateTab(tab)}
                    >
                      {tab}
                    </Button>
                  ))}
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[360px] overflow-y-auto">
                   {!subjectCatalogItemList || !subjectCatalogList?.length ? (
  <div className="p-6 text-sm text-center text-muted-foreground">
    등록된 과정/과목 마스터가 없습니다.
  </div>
) : filteredTemplateList.length === 0 ? (
                      <div className="p-6 text-sm text-center text-muted-foreground">
                        선택한 과정 / 구분의 과목이 없습니다.
                      </div>
                    ) : (
                      <div className="divide-y">
                       {filteredTemplateList.map((row: any) => {
  const checked = selectedTemplateIds.includes(Number(row.id));

  const existingSemesterNo = existingPlanSubjectMap.get(
    String(row.subjectName || "").trim().replace(/\s+/g, " ")
  );

  const isDuplicatedInOtherSemester =
    existingSemesterNo !== undefined &&
    Number(existingSemesterNo) !== Number(templateDialogSemesterNo);

  const disabled =
    (!checked && selectedTemplateIds.length >= templateSelectableCount) ||
    isDuplicatedInOtherSemester;

                          return (
                           <label
  key={row.id}
  className={`flex items-center gap-3 px-4 py-3 text-sm ${
    disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
  }`}
>
  <Checkbox
    checked={checked}
    disabled={disabled}
    onCheckedChange={() => {
      if (isDuplicatedInOtherSemester) {
        toast.error(`이미 ${existingSemesterNo}학기에 등록된 과목입니다.`);
        return;
      }
      toggleTemplateSubject(Number(row.id));
    }}
  />
  <span className="flex-1">{row.subjectName}</span>

  {isDuplicatedInOtherSemester && (
    <span className="text-xs text-red-500">
      이미 {existingSemesterNo}학기 등록
    </span>
  )}
</label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {!!selectedTemplateRows.length && (
                  <div className="rounded-lg border bg-blue-50 p-3">
                    <div className="text-sm font-medium text-blue-700 mb-2">
                      선택된 과목 ({selectedTemplateRows.length}/{templateSelectableCount})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplateRows.map((row: any) => (
                        <div
                          key={row.id}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border text-xs"
                        >
                          <span>{row.subjectName}</span>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => toggleTemplateSubject(Number(row.id))}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
  variant="outline"
  onClick={() => {
    setPrivateCertDialogOpen(false);
    setSelectedPrivateCertNames([]);
    setPrivateCertAddress("");
    setPrivateCertDetailAddress("");
  }}
>
  취소
</Button>
            <Button
  onClick={applySubjectCatalogItemsToSemester}
  disabled={
    createPlanSemesterMut.isPending ||
    deletePlanSemesterMut.isPending ||
    selectedTemplateIds.length === 0
  }
>
  등록
</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={semDialogOpen} onOpenChange={setSemDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>학기 추가</DialogTitle></DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">학기 순서</Label>
                <Input
                  type="number"
                  value={semForm.semesterOrder}
                  onChange={(e) => setSemForm({ ...semForm, semesterOrder: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">개강 예정월</Label>
                <Input
                  value={semForm.plannedMonth}
                  onChange={(e) => setSemForm({ ...semForm, plannedMonth: e.target.value })}
                  placeholder="예: 2026-09"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">교육원</Label>
                <Select
                  value={semForm.plannedInstitutionId}
                  onValueChange={(v) => setSemForm({ ...semForm, plannedInstitutionId: v })}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="교육원 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {(institutionList || []).map((inst: any) => (
                      <SelectItem key={inst.id} value={String(inst.id)}>
                        {inst.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">과목 수</Label>
                <Input
                  type="number"
                  value={semForm.plannedSubjectCount}
                  onChange={(e) => setSemForm({ ...semForm, plannedSubjectCount: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">예정 금액</Label>
              <Input
                value={semForm.plannedAmount}
                onChange={(e) => setSemForm({ ...semForm, plannedAmount: e.target.value })}
                placeholder="예: 500000"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSemDialogOpen(false)}>취소</Button>
            <Button onClick={handleAddSemester} disabled={createSemMut.isPending}>추가</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

          {isAdmin && refundList && refundList.length > 0 && (
  <div ref={refundSectionRef}>
  <Card
    className={`border-0 shadow-sm transition-all duration-500 ${
      highlightSection === "refund"
        ? "ring-2 ring-red-400 bg-red-50/30"
        : ""
    }`}
  >
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-red-600">환불 요청 / 내역</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-red-50/50">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">환불일</th>
<th className="px-4 py-2 text-sm text-left">대상 학기</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">유형</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">환불 금액</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">사유</th>
                    <th className="px-4 py-2 text-center font-medium text-muted-foreground">첨부</th>
                    <th className="px-4 py-2 text-center font-medium text-muted-foreground">상태</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground w-[100px]">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {refundList.map((r: any) => (
                    <tr key={r.id} className="border-b last:border-0">
                      {editingRefundId === r.id ? (
                        <>
                          <td className="px-3 py-1.5">
                            <Input
                              type="date"
                              className="h-8 text-sm"
                              value={editRefundForm.refundDate}
                              onChange={(e) =>
                                setEditRefundForm({ ...editRefundForm, refundDate: e.target.value })
                              }
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <select
                              className="w-full h-8 px-2 text-sm border rounded bg-white"
                              value={editRefundForm.refundType}
                              onChange={(e) =>
                                setEditRefundForm({ ...editRefundForm, refundType: e.target.value })
                              }
                            >
                              <option value="부분환불">부분환불</option>
                              <option value="전액환불">전액환불</option>
                              <option value="환불후재등록">환불후재등록</option>
                              <option value="교육원이동">교육원이동</option>
                            </select>
                          </td>
                          <td className="px-3 py-1.5">
                            <Input
                              className="h-8 text-sm text-right"
                              value={editRefundForm.refundAmount}
                              onChange={(e) =>
                                setEditRefundForm({
                                  ...editRefundForm,
                                  refundAmount: e.target.value.replace(/[^0-9]/g, ""),
                                })
                              }
                            />
                          </td>
                          <td className="px-3 py-1.5">
                            <Input
                              className="h-8 text-sm"
                              value={editRefundForm.reason}
                              onChange={(e) =>
                                setEditRefundForm({ ...editRefundForm, reason: e.target.value })
                              }
                              placeholder="사유"
                            />
                          </td>
                          <td className="px-3 py-1.5">
  <div className="space-y-2">
    <input
      id={`refund-edit-file-${r.id}`}
      type="file"
      className="hidden"
      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.hwp"
      onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
          setUploadingRefundEditId(r.id);
          const uploaded = await uploadFile(file);

          setEditRefundForm((prev) => ({
            ...prev,
            attachmentName: uploaded.fileName,
            attachmentUrl: uploaded.fileUrl,
          }));

          toast.success("첨부파일 업로드 완료");
        } catch (err: any) {
          toast.error(err.message || "첨부 업로드 실패");
        } finally {
          setUploadingRefundEditId(null);
          e.currentTarget.value = "";
        }
      }}
    />

    <Button
      type="button"
      variant="outline"
      size="sm"
      className="w-full"
      disabled={uploadingRefundEditId === r.id}
      onClick={() => {
        const el = document.getElementById(
          `refund-edit-file-${r.id}`
        ) as HTMLInputElement | null;
        el?.click();
      }}
    >
      {uploadingRefundEditId === r.id ? "업로드중..." : "파일 첨부"}
    </Button>

    {editRefundForm.attachmentUrl ? (
      <a
        href={editRefundForm.attachmentUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-xs text-blue-600 underline break-all"
      >
        <Paperclip className="h-3.5 w-3.5" />
        {editRefundForm.attachmentName || "첨부파일"}
      </a>
    ) : (
      <span className="text-xs text-muted-foreground">첨부파일 없음</span>
    )}
  </div>
</td>
	

                          <td className="px-4 py-2 text-center">
                            <Badge
                              className={
                                r.approvalStatus === "승인"
                                  ? "bg-emerald-100 text-emerald-700 text-[10px]"
                                  : r.approvalStatus === "불승인"
                                  ? "bg-red-100 text-red-700 text-[10px]"
                                  : "bg-amber-100 text-amber-700 text-[10px]"
                              }
                            >
                              {r.approvalStatus || "대기"}
                            </Badge>
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-emerald-600"
                                onClick={() => {
                                  if (!editRefundForm.refundAmount) {
                                    toast.error("금액을 입력하세요");
                                    return;
                                  }
                                  updateRefundMut.mutate({
                                    id: r.id,
                                    refundAmount: editRefundForm.refundAmount,
semesterId: editRefundForm.semesterId ? Number(editRefundForm.semesterId) : null,
                                    refundDate: editRefundForm.refundDate,
                                    reason: editRefundForm.reason || undefined,
                                    refundType: editRefundForm.refundType || undefined,
                                    attachmentName: editRefundForm.attachmentName || undefined,
                                    attachmentUrl: editRefundForm.attachmentUrl || undefined,
                                  } as any);
                                }}
                                disabled={updateRefundMut.isPending}
                              >
                                <Check className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setEditingRefundId(null)}
                              >
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-2 text-sm">
                            {r.refundDate
                              ? typeof r.refundDate === "string"
                                ? r.refundDate.slice(0, 10)
                                : new Date(r.refundDate).toISOString().slice(0, 10)
                              : "-"}
                          </td>
<td className="px-4 py-2 text-sm">
  {r.semesterId
    ? (() => {
        const sem = sortedSemesters.find(
          (x: any) => Number(x.id) === Number(r.semesterId)
        );
        return sem ? `${sem.semesterOrder}학기` : "-";
      })()
    : "-"}
</td>
                          <td className="px-4 py-2 text-sm">{r.refundType || "-"}</td>
                          <td className="px-4 py-2 text-right text-red-600 font-medium">
                            -{Number(r.refundAmount).toLocaleString()}원
                          </td>
                          <td className="px-4 py-2 text-sm text-muted-foreground">{r.reason || "-"}</td>
                          <td className="px-4 py-2 text-center">
                            {r.attachmentUrl ? (
                              <a
                                href={r.attachmentUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-blue-600 underline"
                              >
                                <Paperclip className="h-3.5 w-3.5" />
                                {r.attachmentName || "첨부파일"}
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">-</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-center">
                            <Badge
                              className={
                                r.approvalStatus === "승인"
                                  ? "bg-emerald-100 text-emerald-700 text-[10px]"
                                  : r.approvalStatus === "불승인"
                                  ? "bg-red-100 text-red-700 text-[10px]"
                                  : "bg-amber-100 text-amber-700 text-[10px]"
                              }
                            >
                              {r.approvalStatus || "대기"}
                            </Badge>
                          </td>
                          <td className="px-2 py-2 text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="수정"
                                onClick={() => {
                                  setEditingRefundId(r.id);
                                  setEditRefundForm({
                                    refundAmount: r.refundAmount?.toString() || "",
semesterId: r.semesterId ? String(r.semesterId) : "",
                                    refundDate: r.refundDate
                                      ? typeof r.refundDate === "string"
                                        ? r.refundDate.slice(0, 10)
                                        : new Date(r.refundDate).toISOString().slice(0, 10)
                                      : "",
                                    reason: r.reason || "",
                                    refundType: r.refundType || "부분환불",
                                    attachmentName: r.attachmentName || "",
                                    attachmentUrl: r.attachmentUrl || "",
                                  });
                                }}
                              >
                                <Pencil className="h-3 w-3 text-blue-500" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                title="삭제"
                                onClick={() => {
                                  if (confirm("환불 요청을 삭제하시겠습니까?")) {
                                    deleteRefundMut.mutate({ id: r.id });
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
</div>
      )}

           {!isAdmin && refundList && refundList.length > 0 && (
  <div ref={refundSectionRef}>
  <Card
    className={`border-0 shadow-sm transition-all duration-500 ${
      highlightSection === "refund"
        ? "ring-2 ring-red-400 bg-red-50/30"
        : ""
    }`}
  >
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-red-600">환불 요청 / 내역</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-red-50/50">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">환불일</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">유형</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">환불 금액</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">사유</th>
                    <th className="px-4 py-2 text-center font-medium text-muted-foreground">첨부</th>
                    <th className="px-4 py-2 text-center font-medium text-muted-foreground">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {refundList.map((r: any) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-4 py-2 text-sm">
                        {r.refundDate
                          ? typeof r.refundDate === "string"
                            ? r.refundDate.slice(0, 10)
                            : new Date(r.refundDate).toISOString().slice(0, 10)
                          : "-"}
                      </td>
                      <td className="px-4 py-2 text-sm">{r.refundType || "-"}</td>
                      <td className="px-4 py-2 text-right text-red-600 font-medium">
                        -{Number(r.refundAmount).toLocaleString()}원
                      </td>
                      <td className="px-4 py-2 text-sm text-muted-foreground">{r.reason || "-"}</td>
                      <td className="px-4 py-2 text-center">
                        {r.attachmentUrl ? (
                          <a
                            href={r.attachmentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-blue-600 underline"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            {r.attachmentName || "첨부파일"}
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <Badge
                          className={
                            r.approvalStatus === "승인"
                              ? "bg-emerald-100 text-emerald-700 text-[10px]"
                              : r.approvalStatus === "불승인"
                              ? "bg-red-100 text-red-700 text-[10px]"
                              : "bg-amber-100 text-amber-700 text-[10px]"
                          }
                        >
                          {r.approvalStatus || "대기"}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
</div>
      )}
	      <Dialog open={privateCertDialogOpen} onOpenChange={setPrivateCertDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>민간자격증 요청</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid md:grid-cols-[180px_1fr] gap-4">
              <div className="space-y-2">
                <Label className="text-sm">민간자격증</Label>

                <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-1">
                  <div>
                    선택 가능 자격증: <span className="font-medium">제한 없음</span>
                  </div>
                  <div>
                    선택 자격증: <span className="font-medium">{selectedPrivateCertNames.length}</span>개
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    원하는 민간자격증을 선택 후 요청 버튼을 누르면 플랜 요약에 요청 내역이 표시됩니다.
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="border rounded-lg overflow-hidden">
                  <div className="max-h-[360px] overflow-y-auto">
                    <div className="divide-y">
                      {!privateCertificateOptions.length ? (
  <div className="p-6 text-sm text-center text-muted-foreground">
    등록된 민간자격증 마스터가 없습니다.
  </div>
) : (
  privateCertificateOptions.map((item: any) => {
    const name = String(item.name || "");
    const checked = selectedPrivateCertNames.includes(name);

    return (
      <label
        key={item.id}
        className="flex items-center gap-3 px-4 py-3 text-sm cursor-pointer"
      >
        <Checkbox
          checked={checked}
          onCheckedChange={() => togglePrivateCert(name)}
        />
        <span className="flex-1">{name}</span>
      </label>
    );
  })
)}
                    </div>
                  </div>
                </div>

                {!!selectedPrivateCertNames.length && (
                  <div className="rounded-lg border bg-violet-50 p-3">
                    <div className="text-sm font-medium text-violet-700 mb-2">
                      선택된 민간자격증 ({selectedPrivateCertNames.length})
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {selectedPrivateCertNames.map((name) => (
                        <div
                          key={name}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border text-xs"
                        >
                          <span>{name}</span>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={() => togglePrivateCert(name)}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
<div className="rounded-lg border p-4 space-y-3">
  <div className="grid gap-2">
    <Label className="text-sm">주소</Label>
    <Input
      value={privateCertAddress}
      onChange={(e) => setPrivateCertAddress(e.target.value)}
      placeholder="예: 서울 도봉구 ..."
    />
  </div>

  <div className="grid gap-2">
    <Label className="text-sm">상세주소</Label>
    <Input
      value={privateCertDetailAddress}
      onChange={(e) => setPrivateCertDetailAddress(e.target.value)}
      placeholder="상세주소 입력"
    />
  </div>

  <div className="text-[11px] text-muted-foreground">
    입력한 주소가 이번 민간자격증 요청들에 함께 저장됩니다.
  </div>
</div>

              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPrivateCertDialogOpen(false);
                setSelectedPrivateCertNames([]);
              }}
            >
              취소
            </Button>

            <Button
  onClick={submitPrivateCertRequest}
  disabled={
    createPrivateCertificateRequestMut.isPending ||
    selectedPrivateCertNames.length === 0
  }
>
  요청
</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

           <Dialog
  open={refundDialogOpen}
  onOpenChange={(open) => {
    if (createRefundMut.isPending) return;
    setRefundDialogOpen(open);
  }}
>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>환불 요청 등록</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1">
              <Label className="text-xs">환불 유형</Label>
              <select
                className="w-full h-9 px-3 text-sm border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                value={refundForm.refundType}
                onChange={(e) =>
                  setRefundForm({ ...refundForm, refundType: e.target.value })
                }
              >
                <option value="부분환불">부분환불</option>
                <option value="전액환불">전액환불</option>
                <option value="환불후재등록">환불후재등록</option>
                <option value="교육원이동">교육원이동</option>
              </select>
            </div>

<div className="space-y-1">
  <Label className="text-xs">환불 대상 학기</Label>
  <Select
    value={refundForm.semesterId}
    onValueChange={(v) =>
      setRefundForm((prev) => ({
        ...prev,
        semesterId: v,
      }))
    }
  >
    <SelectTrigger>
      <SelectValue placeholder="학기 선택" />
    </SelectTrigger>
    <SelectContent>
      {sortedSemesters.map((sem: any) => (
        <SelectItem key={sem.id} value={String(sem.id)}>
          {sem.semesterOrder}학기
          {sem.actualStartDate
            ? ` (${formatDate(sem.actualStartDate)})`
            : sem.plannedMonth
            ? ` (${formatPlannedMonth(sem.plannedMonth)})`
            : ""}
          {sem.actualInstitution ||
          (sem.actualInstitutionId
            ? ` / ${getInstitutionName(sem.actualInstitutionId)}`
            : sem.plannedInstitutionId
            ? ` / ${getInstitutionName(sem.plannedInstitutionId)}`
            : "")
            ? ` / ${
                sem.actualInstitution ||
                getInstitutionName(sem.actualInstitutionId) ||
                getInstitutionName(sem.plannedInstitutionId)
              }`
            : ""}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>

            <div className="space-y-1">
              <Label className="text-xs">환불 금액</Label>
              <Input
                value={refundForm.refundAmount}
                onChange={(e) =>
                  setRefundForm({
                    ...refundForm,
                    refundAmount: e.target.value.replace(/[^0-9]/g, ""),
                  })
                }
                placeholder="예: 300000"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">환불 일자</Label>
              <Input
                type="date"
                value={refundForm.refundDate}
                onChange={(e) =>
                  setRefundForm({ ...refundForm, refundDate: e.target.value })
                }
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">사유</Label>
              <Textarea
                value={refundForm.reason}
                onChange={(e) =>
                  setRefundForm({ ...refundForm, reason: e.target.value })
                }
                rows={2}
                placeholder="환불 사유"
              />
            </div>

            <div className="space-y-2">
  <Label className="text-xs">첨부파일</Label>

  <input
    id="refund-create-file"
    type="file"
    className="hidden"
    accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.hwp"
    onChange={async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        setUploadingRefund(true);
        const uploaded = await uploadFile(file);

        setRefundForm((prev) => ({
          ...prev,
          attachmentName: uploaded.fileName,
          attachmentUrl: uploaded.fileUrl,
        }));

        toast.success("첨부파일 업로드 완료");
      } catch (err: any) {
        toast.error(err.message || "첨부 업로드 실패");
      } finally {
        setUploadingRefund(false);
        e.currentTarget.value = "";
      }
    }}
  />

  <div className="flex items-center gap-2 flex-wrap">
    <Button
      type="button"
      variant="outline"
      onClick={() => {
        const el = document.getElementById("refund-create-file") as HTMLInputElement | null;
        el?.click();
      }}
      disabled={uploadingRefund}
    >
      {uploadingRefund ? "업로드중..." : "파일 첨부"}
    </Button>

    {refundForm.attachmentUrl ? (
      <a
        href={refundForm.attachmentUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm text-blue-600 underline"
      >
        <Paperclip className="h-3.5 w-3.5" />
        {refundForm.attachmentName || "첨부파일"}
      </a>
    ) : (
      <span className="text-xs text-muted-foreground">첨부파일 없음</span>
    )}
  </div>
</div>

            <div className="rounded-lg border bg-amber-50 px-3 py-2 text-xs text-amber-700">
              등록 시 바로 차감되지 않고, 관리자 승인 후 환불 금액이 반영됩니다.
            </div>
          </div>

          <DialogFooter>
            <Button
  variant="outline"
  onClick={() => setRefundDialogOpen(false)}
  disabled={createRefundMut.isPending}
>
  취소
</Button>
           <Button
  variant="destructive"
  onClick={async () => {
    if (!refundForm.refundAmount) {
      toast.error("환불 금액을 입력하세요.");
      return;
    }

    if (!refundForm.semesterId) {
      toast.error("환불 대상 학기를 선택해주세요.");
      return;
    }

    try {
      await createRefundMut.mutateAsync({
        studentId,
        semesterId: Number(refundForm.semesterId),
        refundAmount: refundForm.refundAmount,
        refundDate: refundForm.refundDate,
        reason: refundForm.reason || undefined,
        refundType: refundForm.refundType || undefined,
        attachmentName: refundForm.attachmentName || undefined,
        attachmentUrl: refundForm.attachmentUrl || undefined,
      } as any);

      requestAnimationFrame(() => {
        setRefundDialogOpen(false);
        setRefundForm({
          semesterId: selectedSemester?.id ? String(selectedSemester.id) : "",
          refundAmount: "",
          refundDate: new Date().toISOString().slice(0, 10),
          reason: "",
          refundType: "부분환불",
          attachmentName: "",
          attachmentUrl: "",
        });
      });
    } catch (e) {
      // onError에서 toast 처리하므로 여기서는 비워둬도 됨
    }
  }}
  disabled={createRefundMut.isPending}
>
  환불 요청 등록
</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

<Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
  <DialogContent className="max-w-lg">
    <DialogHeader>
      <DialogTitle>
        {courseDialogSemester?.semesterOrder || "-"}학기 등록 과정 설정
      </DialogTitle>
    </DialogHeader>

    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        학기별 등록 과정을 추가/삭제할 수 있고, 대표 과정을 변경할 수 있습니다.
      </div>

      <div className="space-y-2 max-h-[320px] overflow-auto">
        {courseOptions.map((course) => {
          const checked = selectedRegisteredCourses.includes(course);

          return (
            <label
              key={course}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border bg-white"
            >
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggleRegisteredCourse(course)}
                />
                <span className="text-sm">{course}</span>
              </div>

              {checked && (
                <button
                  type="button"
                  className={`text-xs px-2 py-1 rounded border ${
                    primaryRegisteredCourse === course
                      ? "bg-violet-100 text-violet-700 border-violet-200"
                      : "bg-gray-50 text-gray-600 border-gray-200"
                  }`}
                  onClick={() => setPrimaryRegisteredCourse(course)}
                >
                  대표과정
                </button>
              )}
            </label>
          );
        })}
      </div>

      <div className="text-xs text-muted-foreground">
        대표과정은 상단 등록 과정 표시 기준으로 사용됩니다.
      </div>
    </div>

    <DialogFooter>
      <Button
        variant="outline"
        onClick={() => {
          setCourseDialogOpen(false);
          setCourseDialogSemester(null);
        }}
      >
        취소
      </Button>
      <Button onClick={saveRegisteredCourses}>저장</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
    </div>
  );
}