import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  FileSpreadsheet,
  GraduationCap,
  History,
  Loader2,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  Search,
  Upload,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";

type PracticeMasterDataType =
  | "institution"
  | "education_center";

type PreviewTab =
  | "summary"
  | "unchanged"
  | "inserts"
  | "updates"
  | "reactivates"
  | "deactivates"
  | "reviews"
  | "invalidRows";

type ExcelUploadRow = {
  rowNumber: number;
  categoryName?: string | null;
  name: string;
  representativeName?: string | null;
  phone?: string | null;
  address?: string | null;
  detailAddress?: string | null;
  availableCourse?: string | null;

  price?: string | null;

  associationManagementNo?: string | null;
  selectionValidFrom?: string | null;
  selectionValidTo?: string | null;
  selectionStatus?: string | null;
};

type PracticeMasterPreview = {
  version?: number;

  dataType?:
    | "institution"
    | "education_center";

  analyzedAt?: string;

  summary?: {
    totalRows?: number;
    validRows?: number;
    invalidRows?: number;

    unchangedCount?: number;
    insertCount?: number;
    updateCount?: number;
    deactivateCount?: number;
    reactivateCount?: number;
    reviewCount?: number;
  };

  unchanged?: any[];
  inserts?: any[];
  updates?: any[];
  deactivates?: any[];
  reactivates?: any[];
  reviews?: any[];
  invalidRows?: any[];
};

const HEADER_ALIASES = {
    categoryName: [
    "구분",
    "기관구분",
    "교육원구분",
    "시설분류",
    "분류",
    "지역",
    "시도",
  ],

  name: [
    "기관명",
    "실습기관명",
    "교육원명",
    "실습교육원명",
    "평생교육원명",
    "명칭",
  ],

  representativeName: [
    "대표자",
    "대표자명",
    "기관장",
    "시설장",
    "원장",
    "담당자",
  ],

    phone: [
    "전화번호",
    "연락처",
    "기관연락처",
    "기관전화",
    "대표전화",
    "전화",
    "tel",
  ],

  address: [
    "주소",
    "소재지",
    "기관주소",
    "교육원주소",
    "도로명주소",
  ],

  detailAddress: [
    "상세주소",
    "주소상세",
    "나머지주소",
  ],

    availableCourse: [
    "가능과정",
    "교육과정",
    "실습과정",
    "운영과정",
    "과정",
    "비고",
  ],

  price: [
    "실습비",
    "실습비용",
    "비용",
    "금액",
  ],

  associationManagementNo: [
    "관리번호",
    "선정관리번호",
    "협회관리번호",
    "기관관리번호",
  ],

  selectionValidFrom: [
    "선정유효기간시작일",
    "선정유효시작일",
    "유효기간시작일",
    "유효시작일",
  ],

  selectionValidTo: [
    "선정유효기간종료일",
    "선정유효종료일",
    "유효기간종료일",
    "유효종료일",
  ],

  selectionValidPeriod: [
    "선정유효기간",
    "유효기간",
    "선정기간",
  ],

  selectionStatus: [
    "선정상태",
    "기관선정상태",
    "상태",
  ],
} as const;

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[(){}\[\].,_\-/:]/g, "")
    .toLowerCase();
}

function normalizeCellValue(
  value: unknown
) {
  if (
    value === undefined ||
    value === null
  ) {
    return null;
  }

  const text = String(value)
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ");

  return text || null;
}

function findHeaderColumnIndex(
  headerRow: unknown[],
  aliases: readonly string[]
) {
  const normalizedAliases =
    aliases.map(normalizeHeader);

  return headerRow.findIndex((cell) =>
    normalizedAliases.includes(
      normalizeHeader(cell)
    )
  );
}

function isCompletelyEmptyExcelRow(
  row: unknown[]
) {
  return row.every(
    (cell) =>
      normalizeCellValue(cell) === null
  );
}

function getExcelCellValue(
  row: unknown[],
  columnIndex: number
) {
  if (columnIndex < 0) {
    return null;
  }

  return normalizeCellValue(
    row[columnIndex]
  );
}

function normalizeExcelDateValue(
  value: unknown
) {
  const text =
    normalizeCellValue(value);

  if (!text) return null;

  const normalized =
    text
      .replace(/년/g, "-")
      .replace(/월/g, "-")
      .replace(/일/g, "")
      .replace(/[./]/g, "-")
      .replace(/\s+/g, "")
      .replace(/-+$/g, "");

  const match =
    normalized.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})$/
    );

  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  const date =
    new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function splitSelectionValidPeriod(
  value: unknown
) {
  const text =
    normalizeCellValue(value);

  if (!text) {
    return {
      from: null,
      to: null,
    };
  }

  const dateMatches =
    text.match(
      /\d{4}\s*(?:년|[./-])\s*\d{1,2}\s*(?:월|[./-])\s*\d{1,2}\s*일?\.?/g
    ) || [];

  if (dateMatches.length >= 2) {
    return {
      from:
        normalizeExcelDateValue(
          dateMatches[0]
        ),

      to:
        normalizeExcelDateValue(
          dateMatches[1]
        ),
    };
  }

  const parts =
    text.split(
      /\s*(?:~|∼|～|부터|까지)\s*/
    );

  return {
    from:
      normalizeExcelDateValue(
        parts[0]
      ),

    to:
      normalizeExcelDateValue(
        parts[1]
      ),
  };
}

function parseJsonValue<T>(
  value: unknown,
  fallback: T
): T {
  if (
    value === null ||
    value === undefined
  ) {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }

  return value as T;
}

function formatDate(
  value?: string | Date | null
) {
  if (!value) return "-";

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "-";
  }

  return date.toLocaleString("ko-KR");
}

function getDataTypeLabel(
  dataType?: string | null
) {
  return dataType ===
    "education_center"
    ? "실습교육원"
    : "실습기관";
}

function getStatusLabel(
  status?: string | null
) {
  switch (status) {
    case "analyzing":
      return "분석 중";

    case "preview_ready":
      return "미리보기 완료";

    case "running":
      return "동기화 중";

    case "completed":
      return "완료";

    case "failed":
      return "실패";

    case "cancelled":
      return "취소";

    default:
      return status || "-";
  }
}

function getStatusClassName(
  status?: string | null
) {
  switch (status) {
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";

    case "preview_ready":
      return "border-blue-200 bg-blue-50 text-blue-700";

    case "running":
    case "analyzing":
      return "border-amber-200 bg-amber-50 text-amber-700";

    case "failed":
      return "border-red-200 bg-red-50 text-red-700";

    case "cancelled":
      return "border-slate-200 bg-slate-50 text-slate-600";

    default:
      return "border-slate-200 bg-slate-50 text-slate-600";
  }
}

export default function PracticeMasterSyncPage() {
  const fileInputRef =
    useRef<HTMLInputElement | null>(
      null
    );

  const [dataType, setDataType] =
    useState<PracticeMasterDataType>(
      "institution"
    );

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [sourceVersion, setSourceVersion] =
    useState("");

  const [activePreviewTab, setActivePreviewTab] =
    useState<PreviewTab>("summary");

  const [
    selectedHistoryId,
    setSelectedHistoryId,
  ] = useState<number | null>(null);

  const [
    confirmationText,
    setConfirmationText,
  ] = useState("");

const [
  isWatchingExecution,
  setIsWatchingExecution,
] = useState(false);

  const utils = trpc.useUtils();

  const summaryQuery =
    trpc.saas.getPracticeMasterSummary.useQuery(
      undefined,
      {
        retry: false,
      }
    );

  const historyQuery =
    trpc.saas.listPracticeMasterSyncHistory.useQuery(
      {
        dataType: "all",
        status: "all",
        limit: 100,
      },
      {
        retry: false,
      }
    );

  const historyDetailQuery =
    trpc.saas.getPracticeMasterSyncHistory.useQuery(
      {
        id: selectedHistoryId || 0,
      },
      {
        enabled:
          Number(selectedHistoryId || 0) >
          0,

        retry: false,
      }
    );

  const createHistoryMutation =
    trpc.saas.createPracticeMasterSyncHistory.useMutation();

  const analyzeMutation =
    trpc.saas.analyzePracticeMasterSync.useMutation();

  const executeMutation =
    trpc.saas.executePracticeMasterSync.useMutation();

  const currentHistory =
  historyDetailQuery.data || null;

useEffect(() => {
  if (
    !selectedHistoryId ||
    !isWatchingExecution
  ) {
    return;
  }

  if (
    currentHistory?.status ===
      "completed" ||
    currentHistory?.status ===
      "failed" ||
    currentHistory?.status ===
      "cancelled"
  ) {
    setIsWatchingExecution(false);

    void Promise.all([
      historyQuery.refetch(),
      summaryQuery.refetch(),
    ]);

    return;
  }

  const intervalId =
    window.setInterval(() => {
      void Promise.all([
        historyDetailQuery.refetch(),
        historyQuery.refetch(),
        summaryQuery.refetch(),
      ]);
    }, 3000);

  return () => {
    window.clearInterval(
      intervalId
    );
  };
}, [
  selectedHistoryId,
  isWatchingExecution,
  currentHistory?.status,
  historyDetailQuery.refetch,
  historyQuery.refetch,
  summaryQuery.refetch,
]);

const currentPreview =
    useMemo(() => {
      return parseJsonValue<PracticeMasterPreview>(
        (currentHistory as any)
          ?.previewJson,
        {}
      );
    }, [currentHistory]);

  const previewSummary =
    currentPreview.summary || {};

  const isBusy =
    createHistoryMutation.isPending ||
    analyzeMutation.isPending ||
    executeMutation.isPending;

  const selectedSummary =
    dataType === "institution"
      ? summaryQuery.data?.institution
      : summaryQuery.data
          ?.educationCenter;

  const refreshAll = async () => {
    await Promise.all([
      utils.saas.getPracticeMasterSummary.invalidate(),
      utils.saas.listPracticeMasterSyncHistory.invalidate(),
    ]);

    if (selectedHistoryId) {
      await utils.saas.getPracticeMasterSyncHistory.invalidate(
        {
          id: selectedHistoryId,
        }
      );
    }
  };

  const resetUpload = () => {
    setSelectedFile(null);
    setSourceVersion("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file =
      event.target.files?.[0] || null;

    if (!file) {
      setSelectedFile(null);
      return;
    }

    const lowerName =
      file.name.toLowerCase();

    const isExcelFile =
      lowerName.endsWith(".xlsx") ||
      lowerName.endsWith(".xls");

    if (!isExcelFile) {
      toast.error(
        "엑셀 파일(.xlsx, .xls)만 업로드할 수 있습니다."
      );

      event.target.value = "";
            setSelectedFile(null);
      return;
    }

    const maxFileSize =
      20 * 1024 * 1024;

    if (file.size > maxFileSize) {
      toast.error(
        "엑셀 파일은 최대 20MB까지 업로드할 수 있습니다."
      );

      event.target.value = "";
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);

    if (!sourceVersion) {
      const today =
        new Date()
          .toISOString()
          .slice(0, 10);

      setSourceVersion(today);
    }
  };

    const readExcelRows = async (
    file: File
  ): Promise<ExcelUploadRow[]> => {
    const XLSX =
      await import("xlsx");

    const arrayBuffer =
      await file.arrayBuffer();

    const workbook =
      XLSX.read(arrayBuffer, {
        type: "array",
        cellDates: false,
      });

    if (
      workbook.SheetNames.length === 0
    ) {
      throw new Error(
        "엑셀 파일에 시트가 없습니다."
      );
    }

    let selectedSheetName:
      | string
      | null = null;

    let selectedSheetRows:
      unknown[][] = [];

    let selectedHeaderRowIndex = -1;

        let selectedColumnIndexes: {
      categoryName: number;
      name: number;
      representativeName: number;
      phone: number;
      address: number;
      detailAddress: number;
      availableCourse: number;

      price: number;

      associationManagementNo: number;
      selectionValidPeriod: number;
      selectionValidFrom: number;
      selectionValidTo: number;
      selectionStatus: number;
    } | null = null;

    for (
      const sheetName of
      workbook.SheetNames
    ) {
      const worksheet =
        workbook.Sheets[sheetName];

      if (!worksheet) {
        continue;
      }

      const sheetRows =
        XLSX.utils.sheet_to_json<
          unknown[]
        >(worksheet, {
          header: 1,
          defval: "",
          raw: false,
          blankrows: false,
        });

      if (
        sheetRows.length === 0
      ) {
        continue;
      }

      const headerSearchLimit =
        Math.min(
          sheetRows.length,
          30
        );

      for (
        let rowIndex = 0;
        rowIndex <
        headerSearchLimit;
        rowIndex += 1
      ) {
        const candidateRow =
          Array.isArray(
            sheetRows[rowIndex]
          )
            ? sheetRows[rowIndex]
            : [];

        const nameColumnIndex =
          findHeaderColumnIndex(
            candidateRow,
            HEADER_ALIASES.name
          );

        const addressColumnIndex =
          findHeaderColumnIndex(
            candidateRow,
            HEADER_ALIASES.address
          );

        const phoneColumnIndex =
          findHeaderColumnIndex(
            candidateRow,
            HEADER_ALIASES.phone
          );

                const managementNoColumnIndex =
          findHeaderColumnIndex(
            candidateRow,
            HEADER_ALIASES
              .associationManagementNo
          );

        const selectionValidPeriodColumnIndex =
          findHeaderColumnIndex(
            candidateRow,
            HEADER_ALIASES
              .selectionValidPeriod
          );

        const selectionValidFromColumnIndex =
          findHeaderColumnIndex(
            candidateRow,
            HEADER_ALIASES
              .selectionValidFrom
          );

        const selectionValidToColumnIndex =
          findHeaderColumnIndex(
            candidateRow,
            HEADER_ALIASES
              .selectionValidTo
          );

        const selectionStatusColumnIndex =
          findHeaderColumnIndex(
            candidateRow,
            HEADER_ALIASES
              .selectionStatus
          );

        const hasSelectionPeriodHeader =
          selectionValidPeriodColumnIndex >= 0 ||
          (
            selectionValidFromColumnIndex >= 0 &&
            selectionValidToColumnIndex >= 0
          );

        const hasRequiredHeader =
          dataType === "institution"
            ? nameColumnIndex >= 0 &&
              addressColumnIndex >= 0 &&
              managementNoColumnIndex >= 0 &&
              hasSelectionPeriodHeader &&
              selectionStatusColumnIndex >= 0
            : nameColumnIndex >= 0;

        const hasSupportingHeader =
          addressColumnIndex >= 0 ||
          phoneColumnIndex >= 0 ||
          findHeaderColumnIndex(
            candidateRow,
            HEADER_ALIASES
              .representativeName
          ) >= 0;

        if (
          !hasRequiredHeader ||
          !hasSupportingHeader
        ) {
          continue;
        }

        selectedSheetName =
          sheetName;

        selectedSheetRows =
          sheetRows;

        selectedHeaderRowIndex =
          rowIndex;

        selectedColumnIndexes = {
          categoryName:
            findHeaderColumnIndex(
              candidateRow,
              HEADER_ALIASES
                .categoryName
            ),

          name:
            nameColumnIndex,

          representativeName:
            findHeaderColumnIndex(
              candidateRow,
              HEADER_ALIASES
                .representativeName
            ),

          phone:
            phoneColumnIndex,

          address:
            addressColumnIndex,

          detailAddress:
            findHeaderColumnIndex(
              candidateRow,
              HEADER_ALIASES
                .detailAddress
            ),

                    availableCourse:
            findHeaderColumnIndex(
              candidateRow,
              HEADER_ALIASES
                .availableCourse
            ),

          price:
            findHeaderColumnIndex(
              candidateRow,
              HEADER_ALIASES.price
            ),

          associationManagementNo:
            findHeaderColumnIndex(
              candidateRow,
              HEADER_ALIASES
                .associationManagementNo
            ),

          selectionValidPeriod:
            findHeaderColumnIndex(
              candidateRow,
              HEADER_ALIASES
                .selectionValidPeriod
            ),

          selectionValidFrom:
            findHeaderColumnIndex(
              candidateRow,
              HEADER_ALIASES
                .selectionValidFrom
            ),

          selectionValidTo:
            findHeaderColumnIndex(
              candidateRow,
              HEADER_ALIASES
                .selectionValidTo
            ),

          selectionStatus:
            findHeaderColumnIndex(
              candidateRow,
              HEADER_ALIASES
                .selectionStatus
            ),
        };

        break;
      }

      if (
        selectedSheetName &&
        selectedColumnIndexes
      ) {
        break;
      }
    }

    if (
      !selectedSheetName ||
      !selectedColumnIndexes ||
      selectedHeaderRowIndex < 0
    ) {
      throw new Error(
        dataType === "institution"
                    ? "실습기관 엑셀의 필수 열을 찾을 수 없습니다. 기관명, 기관주소, 관리 번호, 선정 유효기간, 선정상태 열을 확인해주세요."
          : "엑셀에서 교육원명 열을 찾을 수 없습니다. 열 제목이 교육원명·실습교육원명 형태인지 확인해주세요."
      );
    }

    const dataRows =
      selectedSheetRows.slice(
        selectedHeaderRowIndex + 1
      );

    const parsedRows =
      dataRows
        .map((rawRow, index) => {
          const row =
            Array.isArray(rawRow)
              ? rawRow
              : [];

          const actualRowNumber =
            selectedHeaderRowIndex +
            index +
            2;

          return {
            row,
            actualRowNumber,
          };
        })
        .filter(
          ({ row }) =>
            !isCompletelyEmptyExcelRow(
              row
            )
        )
        .map(
          ({
            row,
            actualRowNumber,
          }) => {
            const name =
              getExcelCellValue(
                row,
                selectedColumnIndexes.name
              ) || "";

            const selectionPeriod =
              splitSelectionValidPeriod(
                getExcelCellValue(
                  row,
                  selectedColumnIndexes
                    .selectionValidPeriod
                )
              );

            const selectionValidFrom =
              normalizeExcelDateValue(
                getExcelCellValue(
                  row,
                  selectedColumnIndexes
                    .selectionValidFrom
                )
              ) ||
              selectionPeriod.from;

            const selectionValidTo =
              normalizeExcelDateValue(
                getExcelCellValue(
                  row,
                  selectedColumnIndexes
                    .selectionValidTo
                )
              ) ||
              selectionPeriod.to;

            return {
              rowNumber:
                actualRowNumber,

              categoryName:
                getExcelCellValue(
                  row,
                  selectedColumnIndexes
                    .categoryName
                ),

              name,

              representativeName:
                getExcelCellValue(
                  row,
                  selectedColumnIndexes
                    .representativeName
                ),

              phone:
                getExcelCellValue(
                  row,
                  selectedColumnIndexes
                    .phone
                ),

              address:
                getExcelCellValue(
                  row,
                  selectedColumnIndexes
                    .address
                ),

              detailAddress:
                getExcelCellValue(
                  row,
                  selectedColumnIndexes
                    .detailAddress
                ),

                            availableCourse:
                getExcelCellValue(
                  row,
                  selectedColumnIndexes
                    .availableCourse
                ),

              price:
                dataType === "institution"
                  ? String(
                      getExcelCellValue(
                        row,
                        selectedColumnIndexes
                          .price
                      ) || ""
                    )
                      .replace(/,/g, "")
                      .trim() || null
                  : null,

              associationManagementNo:
                dataType === "institution"
                  ? getExcelCellValue(
                      row,
                      selectedColumnIndexes
                        .associationManagementNo
                    )
                  : null,

              selectionValidFrom:
                dataType === "institution"
                  ? selectionValidFrom
                  : null,

              selectionValidTo:
                dataType === "institution"
                  ? selectionValidTo
                  : null,

              selectionStatus:
                dataType === "institution"
                  ? getExcelCellValue(
                      row,
                      selectedColumnIndexes
                        .selectionStatus
                    )
                  : null,
            };
          }
        );

    if (
      parsedRows.length === 0
    ) {
      throw new Error(
        `${selectedSheetName} 시트에 분석할 데이터 행이 없습니다.`
      );
    }

    return parsedRows;
  };

  const handleAnalyze = async () => {
    if (!selectedFile) {
      toast.error(
        "분석할 엑셀 파일을 선택해주세요."
      );
      return;
    }

    try {
      const rows =
        await readExcelRows(
          selectedFile
        );

      const history =
        await createHistoryMutation.mutateAsync(
          {
            dataType,

            sourceType:
              "social_worker_association",

            sourceFileName:
              selectedFile.name,

            sourceVersion:
              sourceVersion.trim() ||
              null,

            memo:
              dataType === "institution"
                ? "사회복지사협회 실습기관 공용 마스터 동기화"
                : "실습교육원 공용 마스터 동기화",
          }
        );

      const historyId =
        Number((history as any)?.id || 0);

      if (!historyId) {
        throw new Error(
          "동기화 이력 ID가 생성되지 않았습니다."
        );
      }

      if (
        dataType === "institution"
      ) {
        await analyzeMutation.mutateAsync(
          {
            syncHistoryId:
              historyId,

            dataType:
              "institution",

            institutionRows:
              rows.map((row) => ({
                ...row,
                address:
                  row.address || "",
              })),
          }
        );
      } else {
        await analyzeMutation.mutateAsync(
          {
            syncHistoryId:
              historyId,

            dataType:
              "education_center",

            educationCenterRows:
              rows,
          }
        );
      }

      setSelectedHistoryId(historyId);
      setActivePreviewTab("summary");
      setConfirmationText("");

setIsWatchingExecution(true);

await refreshAll();

toast.success(
        "엑셀 분석이 완료되었습니다."
      );
    } catch (error: any) {
      toast.error(
        error?.message ||
          "엑셀 분석 중 오류가 발생했습니다."
      );
    }
  };

  const handleExecute = async () => {
    if (!selectedHistoryId) {
      toast.error(
        "실행할 동기화 이력을 선택해주세요."
      );
      return;
    }

    if (
      confirmationText.trim() !==
      "동기화 실행"
    ) {
      toast.error(
        "'동기화 실행'을 정확히 입력해주세요."
      );
      return;
    }

  try {
  await executeMutation.mutateAsync(
    {
      syncHistoryId:
        selectedHistoryId,

      confirmationText:
        confirmationText.trim(),
    }
  );

  setConfirmationText("");

  await refreshAll();

  toast.success(
    "동기화를 시작했습니다. 완료될 때까지 잠시 기다려주세요."
  );
} catch (error: any) {
  toast.error(
    error?.message ||
      "공용 실습 데이터 동기화 시작에 실패했습니다."
  );
}
  };

const selectHistory = (
  id: number
) => {
  setSelectedHistoryId(id);
  setActivePreviewTab("summary");
  setConfirmationText("");
  setIsWatchingExecution(false);
};

  const previewTabs: Array<{
    key: PreviewTab;
    label: string;
    count?: number;
  }> = [
    {
      key: "summary",
      label: "요약",
    },
    {
      key: "unchanged",
      label: "유지",
      count:
        currentPreview.unchanged
          ?.length || 0,
    },
    {
      key: "inserts",
      label: "신규",
      count:
        currentPreview.inserts
          ?.length || 0,
    },
    {
      key: "updates",
      label: "변경",
      count:
        currentPreview.updates
          ?.length || 0,
    },
    {
      key: "reactivates",
      label: "재활성",
      count:
        currentPreview.reactivates
          ?.length || 0,
    },
    {
      key: "deactivates",
      label: "비활성",
      count:
        currentPreview.deactivates
          ?.length || 0,
    },
    {
      key: "reviews",
      label: "확인 필요",
      count:
        currentPreview.reviews
          ?.length || 0,
    },
    {
      key: "invalidRows",
      label: "오류",
      count:
        currentPreview.invalidRows
          ?.length || 0,
    },
  ];

  const activePreviewRows =
    activePreviewTab === "summary"
      ? []
      : (
          currentPreview[
            activePreviewTab
          ] || []
        );

  const canExecute =
    currentHistory?.status ===
      "preview_ready" &&
    Number(
      currentHistory.invalidRows || 0
    ) === 0 &&
    Number(
      currentHistory.reviewCount || 0
    ) === 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>

            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-black">
                공용 실습 데이터 관리
              </h1>

              <p className="mt-1 text-sm text-slate-600">
                실습기관과 실습교육원
                공용 마스터를 분석하고
                안전하게 동기화합니다.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void refreshAll();
          }}
          disabled={isBusy}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className="h-4 w-4" />
          새로고침
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SummaryCard
          icon={Building2}
          title="실습기관 마스터"
          selected={
            dataType === "institution"
          }
          totalCount={
            summaryQuery.data
              ?.institution.totalCount || 0
          }
          activeCount={
            summaryQuery.data
              ?.institution.activeCount || 0
          }
          inactiveCount={
            summaryQuery.data
              ?.institution.inactiveCount || 0
          }
          lastSyncedAt={
            summaryQuery.data
              ?.institution.lastSyncedAt
          }
          sourceVersion={
            summaryQuery.data
              ?.institution.sourceVersion
          }
          onClick={() =>
            setDataType("institution")
          }
        />

        <SummaryCard
          icon={GraduationCap}
          title="실습교육원 마스터"
          selected={
            dataType ===
            "education_center"
          }
          totalCount={
            summaryQuery.data
              ?.educationCenter
              .totalCount || 0
          }
          activeCount={
            summaryQuery.data
              ?.educationCenter
              .activeCount || 0
          }
          inactiveCount={
            summaryQuery.data
              ?.educationCenter
              .inactiveCount || 0
          }
          lastSyncedAt={
            summaryQuery.data
              ?.educationCenter
              .lastSyncedAt
          }
          sourceVersion={
            summaryQuery.data
              ?.educationCenter
              .sourceVersion
          }
          onClick={() =>
            setDataType(
              "education_center"
            )
          }
        />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.35fr)_minmax(380px,0.65fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-black">
                엑셀 업로드 및 분석
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                현재 선택:
                {" "}
                <span className="font-bold text-primary">
                  {getDataTypeLabel(
                    dataType
                  )}
                </span>
              </p>
            </div>

            <FileSpreadsheet className="h-6 w-6 text-slate-400" />
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_240px]">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={
                  handleFileChange
                }
                className="hidden"
              />

              <button
                type="button"
                onClick={() =>
                  fileInputRef.current?.click()
                }
                disabled={isBusy}
                className="flex min-h-[150px] w-full flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-300 bg-slate-50 px-5 text-center transition hover:border-primary/50 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Upload className="h-8 w-8 text-slate-500" />

                <span className="mt-3 text-sm font-extrabold text-black">
                  {selectedFile
                    ? selectedFile.name
                    : "엑셀 파일 선택"}
                </span>

                <span className="mt-1 text-xs text-slate-500">
                  .xlsx 또는 .xls
                </span>
              </button>
            </div>

            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-slate-700">
                  자료 버전
                </span>

                <input
                  value={sourceVersion}
                  onChange={(event) =>
                    setSourceVersion(
                      event.target.value
                    )
                  }
                  placeholder="2026-07-20"
                  disabled={isBusy}
                  className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm text-black outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-slate-100"
                />
              </label>

              <button
                type="button"
                onClick={handleAnalyze}
                disabled={
                  !selectedFile ||
                  isBusy
                }
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-sm font-extrabold text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createHistoryMutation.isPending ||
                analyzeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}

                분석 미리보기
              </button>

              <button
                type="button"
                onClick={resetUpload}
                disabled={isBusy}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                선택 초기화
              </button>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />

              <p>
                분석 단계에서는 공용
                마스터 데이터가 변경되지
                않습니다. 미리보기에서
                오류와 확인 필요 항목이
                모두 0건인 경우에만 실제
                동기화를 실행할 수 있습니다.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-extrabold text-black">
                선택한 마스터 현황
              </h2>

              <p className="mt-1 text-sm text-slate-600">
                {getDataTypeLabel(
                  dataType
                )}
              </p>
            </div>

            {summaryQuery.isLoading && (
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            )}
          </div>

          <div className="mt-5 grid grid-cols-3 gap-3">
            <MiniStat
              label="전체"
              value={
                selectedSummary
                  ?.totalCount || 0
              }
            />

            <MiniStat
              label="활성"
              value={
                selectedSummary
                  ?.activeCount || 0
              }
            />

            <MiniStat
              label="비활성"
              value={
                selectedSummary
                  ?.inactiveCount || 0
              }
            />
          </div>

          <div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm">
            <InfoRow
              label="최근 동기화"
              value={formatDate(
                selectedSummary
                  ?.lastSyncedAt
              )}
            />

            <InfoRow
              label="최근 버전"
              value={
                selectedSummary
                  ?.sourceVersion ||
                "-"
              }
            />
          </div>
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-5 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-extrabold text-black">
              분석 미리보기
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              동기화 이력을 선택하면
              상세 분석 결과를 확인할 수
              있습니다.
            </p>
          </div>

          {currentHistory && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-700">
                #
                {currentHistory.id}
              </span>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-bold ${getStatusClassName(
                  currentHistory.status
                )}`}
              >
                {getStatusLabel(
                  currentHistory.status
                )}
              </span>

              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700">
                {getDataTypeLabel(
                  currentHistory.dataType
                )}
              </span>
            </div>
          )}
        </div>

        {!selectedHistoryId ? (
          <div className="px-5 py-16 text-center">
            <History className="mx-auto h-10 w-10 text-slate-300" />

            <p className="mt-3 text-sm font-bold text-slate-700">
              선택된 동기화 이력이
              없습니다.
            </p>

            <p className="mt-1 text-xs text-slate-500">
              아래 이력 목록에서 항목을
              선택해주세요.
            </p>
          </div>
        ) : historyDetailQuery.isLoading ? (
          <div className="flex items-center justify-center px-5 py-16">
            <Loader2 className="h-7 w-7 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="flex overflow-x-auto border-b border-slate-200 px-4">
              {previewTabs.map(
                (tab) => {
                  const isActive =
                    activePreviewTab ===
                    tab.key;

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() =>
                        setActivePreviewTab(
                          tab.key
                        )
                      }
                      className={`flex h-12 shrink-0 items-center gap-2 border-b-2 px-4 text-sm font-bold transition ${
                        isActive
                          ? "border-primary text-primary"
                          : "border-transparent text-slate-500 hover:text-black"
                      }`}
                    >
                      {tab.label}

                      {tab.count !==
                        undefined && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700">
                          {tab.count}
                        </span>
                      )}
                    </button>
                  );
                }
              )}
            </div>

            <div className="p-5">
              {activePreviewTab ===
              "summary" ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
                  <PreviewStat
                    label="전체 행"
                    value={
                      previewSummary.totalRows ||
                      0
                    }
                  />

                  <PreviewStat
                    label="정상 행"
                    value={
                      previewSummary.validRows ||
                      0
                    }
                  />

                  <PreviewStat
                    label="유지"
                    value={
                      previewSummary.unchangedCount ||
                      0
                    }
                  />

                  <PreviewStat
                    label="신규"
                    value={
                      previewSummary.insertCount ||
                      0
                    }
                  />

                  <PreviewStat
                    label="변경"
                    value={
                      previewSummary.updateCount ||
                      0
                    }
                  />

                  <PreviewStat
                    label="재활성"
                    value={
                      previewSummary.reactivateCount ||
                      0
                    }
                  />

                  <PreviewStat
                    label="비활성"
                    value={
                      previewSummary.deactivateCount ||
                      0
                    }
                  />

                  <PreviewStat
                    label="확인/오류"
                    value={
                      Number(
                        previewSummary.reviewCount ||
                          0
                      ) +
                      Number(
                        previewSummary.invalidRows ||
                          0
                      )
                    }
                    danger={
                      Number(
                        previewSummary.reviewCount ||
                          0
                      ) +
                        Number(
                          previewSummary.invalidRows ||
                            0
                        ) >
                      0
                    }
                  />
                </div>
              ) : activePreviewRows.length ===
                0 ? (
                <div className="py-14 text-center text-sm text-slate-500">
                  표시할 항목이 없습니다.
                </div>
              ) : (
                <PreviewTable
                  rows={
                    activePreviewRows
                  }
                  tab={
                    activePreviewTab
                  }
                />
              )}
            </div>

            {currentHistory?.status ===
              "preview_ready" && (
              <div className="border-t border-slate-200 bg-slate-50 px-5 py-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                  <div>
                    <h3 className="text-sm font-extrabold text-black">
                      실제 동기화 실행
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      실행 후 공용 마스터의
                      신규·변경·비활성 상태가
                      반영됩니다. 회사별 수정
                      데이터는 변경되지
                      않습니다.
                    </p>
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
                    <input
                      value={
                        confirmationText
                      }
                      onChange={(event) =>
                        setConfirmationText(
                          event.target.value
                        )
                      }
                      placeholder="동기화 실행"
                      disabled={
                        !canExecute ||
                        executeMutation.isPending
                      }
                      className="h-11 min-w-[240px] rounded-2xl border border-slate-200 bg-white px-3 text-sm text-black outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:bg-slate-100"
                    />

                    <button
                      type="button"
                      onClick={
                        handleExecute
                      }
                      disabled={
                        !canExecute ||
                        confirmationText.trim() !==
                          "동기화 실행" ||
                        executeMutation.isPending
                      }
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 text-sm font-extrabold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {executeMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <PlayCircle className="h-4 w-4" />
                      )}

                      동기화 실행
                    </button>
                  </div>
                </div>

                {!canExecute && (
                  <div className="mt-3 flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                    <XCircle className="h-4 w-4" />

                    오류 또는 확인 필요
                    항목이 남아 있어 실행할
                    수 없습니다.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-5">
          <div>
            <h2 className="text-lg font-extrabold text-black">
              동기화 이력
            </h2>

            <p className="mt-1 text-sm text-slate-600">
              최근 공용 마스터 분석 및 실행
              내역입니다.
            </p>
          </div>

          <History className="h-6 w-6 text-slate-400" />
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200 text-left text-xs font-bold text-slate-600">
                <th className="px-5 py-3">
                  번호
                </th>

                <th className="px-5 py-3">
                  유형
                </th>

                <th className="px-5 py-3">
                  파일명
                </th>

                <th className="px-5 py-3">
                  버전
                </th>

                <th className="px-5 py-3">
                  상태
                </th>

                <th className="px-5 py-3">
                  전체
                </th>

                <th className="px-5 py-3">
                  신규
                </th>

                <th className="px-5 py-3">
                  변경
                </th>

                <th className="px-5 py-3">
                  비활성
                </th>

                <th className="px-5 py-3">
                  생성일
                </th>

                <th className="px-5 py-3">
                  보기
                </th>
              </tr>
            </thead>

            <tbody>
              {historyQuery.isLoading ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-5 py-12 text-center"
                  >
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                  </td>
                </tr>
              ) : (
                (
                  historyQuery.data || []
                ).map((row: any) => {
                  const isSelected =
                    Number(row.id) ===
                    Number(
                      selectedHistoryId
                    );

                  return (
                    <tr
                      key={row.id}
                      className={`border-b border-slate-100 text-sm ${
                        isSelected
                          ? "bg-primary/5"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-5 py-4 font-bold text-black">
                        #{row.id}
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        {getDataTypeLabel(
                          row.dataType
                        )}
                      </td>

                      <td className="max-w-[240px] truncate px-5 py-4 text-slate-700">
                        {row.sourceFileName ||
                          "-"}
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        {row.sourceVersion ||
                          "-"}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${getStatusClassName(
                            row.status
                          )}`}
                        >
                          {getStatusLabel(
                            row.status
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        {Number(
                          row.totalRows || 0
                        ).toLocaleString()}
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        {Number(
                          row.insertCount ||
                            0
                        ).toLocaleString()}
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        {Number(
                          row.updateCount ||
                            0
                        ).toLocaleString()}
                      </td>

                      <td className="px-5 py-4 text-slate-700">
                        {Number(
                          row.deactivateCount ||
                            0
                        ).toLocaleString()}
                      </td>

                      <td className="px-5 py-4 text-slate-600">
                        {formatDate(
                          row.createdAt
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <button
                          type="button"
                          onClick={() =>
                            selectHistory(
                              Number(row.id)
                            )
                          }
                          className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-primary/40 hover:text-primary"
                        >
                          상세보기
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}

              {!historyQuery.isLoading &&
                (
                  historyQuery.data || []
                ).length === 0 && (
                  <tr>
                    <td
                      colSpan={11}
                      className="px-5 py-14 text-center text-sm text-slate-500"
                    >
                      아직 동기화 이력이
                      없습니다.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  title,
  selected,
  totalCount,
  activeCount,
  inactiveCount,
  lastSyncedAt,
  sourceVersion,
  onClick,
}: {
  icon: any;
  title: string;
  selected: boolean;
  totalCount: number;
  activeCount: number;
  inactiveCount: number;
  lastSyncedAt?: string | Date | null;
  sourceVersion?: string | null;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-3xl border p-5 text-left shadow-sm transition ${
        selected
          ? "border-primary bg-primary/5 ring-2 ring-primary/10"
          : "border-slate-200 bg-white hover:border-primary/30"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
              selected
                ? "bg-primary text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>

          <div>
            <p className="font-extrabold text-black">
              {title}
            </p>

            <p className="mt-1 text-xs text-slate-500">
              최근 버전:
              {" "}
              {sourceVersion || "-"}
            </p>
          </div>
        </div>

        {selected && (
          <CheckCircle2 className="h-5 w-5 text-primary" />
        )}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <MiniStat
          label="전체"
          value={totalCount}
        />

        <MiniStat
          label="활성"
          value={activeCount}
        />

        <MiniStat
          label="비활성"
          value={inactiveCount}
        />
      </div>

      <p className="mt-4 text-xs text-slate-500">
        최근 동기화:
        {" "}
        {formatDate(lastSyncedAt)}
      </p>
    </button>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
      <p className="text-xs font-bold text-slate-500">
        {label}
      </p>

      <p className="mt-1 text-lg font-extrabold text-black">
        {Number(value || 0).toLocaleString()}
      </p>
    </div>
  );
}

function PreviewStat({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-4 py-4 ${
        danger
          ? "border-red-200 bg-red-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <p
        className={`text-xs font-bold ${
          danger
            ? "text-red-600"
            : "text-slate-500"
        }`}
      >
        {label}
      </p>

      <p
        className={`mt-2 text-xl font-extrabold ${
          danger
            ? "text-red-700"
            : "text-black"
        }`}
      >
        {Number(value || 0).toLocaleString()}
      </p>
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">
        {label}
      </span>

      <span className="text-right font-bold text-black">
        {value}
      </span>
    </div>
  );
}

function PreviewTable({
  rows,
  tab,
}: {
  rows: any[];
  tab: PreviewTab;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-[1550px] w-full">
        <thead className="bg-slate-50">
          <tr className="border-b border-slate-200 text-left text-xs font-bold text-slate-600">
            <th className="px-4 py-3">
              행
            </th>

            <th className="px-4 py-3">
              마스터 ID
            </th>

            <th className="px-4 py-3">
              기관명
            </th>

            <th className="px-4 py-3">
              전화번호
            </th>

            <th className="px-4 py-3">
              주소
            </th>

            <th className="px-4 py-3">
              관리번호
            </th>

            <th className="px-4 py-3">
              선정상태
            </th>

            <th className="px-4 py-3">
              선정유효기간
            </th>

            <th className="px-4 py-3">
              변경 필드
            </th>

            <th className="px-4 py-3">
              내용
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map(
            (row, index) => {
              const incoming =
                row?.incoming ||
                row?.row ||
                {};

              const existing =
                row?.existing || {};

              const name =
                incoming?.name ||
                existing?.name ||
                "-";

              const phone =
                incoming?.phone ||
                existing?.phone ||
                "-";

              const address =
                incoming?.address ||
                existing?.address ||
                "-";

              const managementNo =
                incoming?.associationManagementNo ||
                existing?.associationManagementNo ||
                "-";

              const selectionStatus =
                incoming?.selectionStatus ||
                existing?.selectionStatus ||
                "-";

              const selectionValidFrom =
                incoming?.selectionValidFrom ||
                existing?.selectionValidFrom ||
                "";

              const selectionValidTo =
                incoming?.selectionValidTo ||
                existing?.selectionValidTo ||
                "";

              const selectionValidPeriod =
                selectionValidFrom &&
                selectionValidTo
                  ? `${selectionValidFrom} ~ ${selectionValidTo}`
                  : selectionValidFrom
                    ? `${selectionValidFrom}부터`
                    : selectionValidTo
                      ? `${selectionValidTo}까지`
                      : "-";

              const message =
                row?.message ||
                row?.reason ||
                (
                  row?.errors || []
                ).join(", ") ||
                "-";

              return (
                <tr
                  key={`${tab}-${row?.rowNumber || row?.masterId || index}-${index}`}
                  className="border-b border-slate-100 text-sm last:border-b-0"
                >
                  <td className="px-4 py-4 font-bold text-black">
                    {row?.rowNumber
                      ? `${row.rowNumber}행`
                      : "-"}
                  </td>

                  <td className="px-4 py-4 text-slate-700">
                    {row?.masterId ||
                      "-"}
                  </td>

                  <td className="px-4 py-4 font-bold text-black">
                    {name}
                  </td>

                  <td className="px-4 py-4 text-slate-700">
                    {phone}
                  </td>

                  <td className="max-w-[360px] px-4 py-4 text-slate-700">
                    {address}
                  </td>

                  <td className="px-4 py-4 text-slate-700">
                    {managementNo}
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex rounded-full border px-2 py-1 text-xs font-bold ${
                        String(
                          selectionStatus
                        ).includes("취소")
                          ? "border-red-200 bg-red-50 text-red-700"
                          : String(
                              selectionStatus
                            ).includes("정지")
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : selectionStatus ===
                                "정상"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                              : "border-slate-200 bg-slate-50 text-slate-600"
                      }`}
                    >
                      {selectionStatus}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-4 py-4 text-slate-700">
                    {selectionValidPeriod}
                  </td>

                  <td className="px-4 py-4 text-slate-700">
                    {Array.isArray(
                      row?.changedFields
                    ) &&
                    row.changedFields
                      .length > 0
                      ? row.changedFields.join(
                          ", "
                        )
                      : "-"}
                  </td>

                  <td className="max-w-[360px] px-4 py-4 text-slate-700">
                    {message}
                  </td>
                </tr>
              );
            }
          )}
        </tbody>
      </table>
    </div>
  );
}