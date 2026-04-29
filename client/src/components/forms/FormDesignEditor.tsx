import { useEffect, useMemo, useState } from "react";
import type { UiConfig } from "@/lib/formDesign/shared";
import FormCanvasEditor from "@/components/forms/canvas/FormCanvasEditor";
import FormCanvasRenderer from "@/components/forms/canvas/FormCanvasRenderer";

type FormDesignEditorProps = {
  mode: "landing" | "ad";
  title: string;
  value: UiConfig;
  onChange: (next: UiConfig) => void;

  canManageTemplates?: boolean;
  templateList?: any[];
  selectedTemplateName?: string;
  onSelectedTemplateNameChange?: (value: string) => void;

  onSave?: () => void;
  onSaveAsTemplate?: (templateName: string) => void;
  onApplyTemplate?: (templateName: string) => void;
  onDeleteTemplate?: (templateName: string) => void;
  onRenameTemplate?: (oldName: string, newName: string) => void;
  onDuplicateTemplate?: (sourceName: string, newName: string) => void;
  onTogglePinTemplate?: (templateName: string) => void;

  isSaving?: boolean;
  isUploadingLogo?: boolean;
  isUploadingHero?: boolean;
  onUploadImage?: (
    file: File,
    target: "logoUrl" | "heroImageUrl"
  ) => Promise<void> | void;
onUploadCanvasImage?: (file: File) => Promise<string>;
};

type UiField = UiConfig["fields"][number];

const FIELD_TYPE_OPTIONS: Array<UiField["type"]> = [
  "text",
  "phone",
  "select",
  "textarea",
  "checkbox",
];

const DEFAULT_FIELD_KEYS = [
  "clientName",
  "phone",
  "finalEducation",
  "desiredCourse",
  "channel",
  "notes",
  "agreed",
];

const LOCKED_FORM_FIELD_KEYS = [
  "clientName",
  "phone",
  "finalEducation",
  "desiredCourse",
  "channel",
  "notes",
  "agreed",
];

const LOCKED_MAPPING_KEYS = [
  "clientName",
  "phone",
  "finalEducation",
  "desiredCourse",
  "channel",
  "notes",
];

function isLockedFormFieldKey(fieldKey: string) {
  return LOCKED_FORM_FIELD_KEYS.includes(String(fieldKey || ""));
}

function isLockedMappingKey(fieldKey: string) {
  return LOCKED_MAPPING_KEYS.includes(String(fieldKey || ""));
}

function cloneConfig(value: UiConfig): UiConfig {
  return {
    ...value,
    mapping: { ...(value.mapping || {}) },
    fields: (value.fields || []).map((field) => ({
      ...field,
      options: field.options
        ? field.options.map((option) => ({ ...option }))
        : undefined,
    })),
  };
}

function normalizeColor(input: string) {
  const raw = String(input || "").trim();
  if (!raw) return "#5fc065";
  if (/^#([0-9a-f]{3}){1,2}$/i.test(raw)) return raw;
  if (/^([0-9a-f]{3}){1,2}$/i.test(raw)) return `#${raw}`;
  return "#5fc065";
}

function sortFields(fields: UiField[]) {
  return [...fields].sort((a, b) => {
    const orderDiff = Number(a.order || 0) - Number(b.order || 0);
    if (orderDiff !== 0) return orderDiff;
    return String(a.fieldKey || "").localeCompare(String(b.fieldKey || ""));
  });
}

export default function FormDesignEditor({
  mode,
  title,
  value,
  onChange,

  canManageTemplates = false,
  templateList = [],
  selectedTemplateName = "",
  onSelectedTemplateNameChange,

  onSave,
  onSaveAsTemplate,
  onApplyTemplate,
  onDeleteTemplate,
  onRenameTemplate,
  onDuplicateTemplate,
  onTogglePinTemplate,

  isSaving = false,
  isUploadingLogo = false,
  isUploadingHero = false,
  onUploadImage,
onUploadCanvasImage,
}: FormDesignEditorProps) {
  const [templateNameDraft, setTemplateNameDraft] = useState("");
  const [renameTemplateDraft, setRenameTemplateDraft] = useState("");
  const [duplicateTemplateDraft, setDuplicateTemplateDraft] = useState("");
const [templateSearch, setTemplateSearch] = useState("");
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, string>>({});
const [activeTab, setActiveTab] = useState<
  "basic" | "canvas" | "fields" | "templates"
>("basic");

const [showPreviewSummary, setShowPreviewSummary] = useState(false);
const [showAdvancedFields, setShowAdvancedFields] = useState(false);
const [lastSavedSnapshot, setLastSavedSnapshot] = useState("");
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
const [autoSaveStatus, setAutoSaveStatus] = useState<
  "idle" | "waiting" | "saving" | "saved" | "error"
>("idle");

const [autoSaveEnabled, setAutoSaveEnabled] = useState(() => {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem("formDesignEditor:autoSave") !== "off";
});

useEffect(() => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    "formDesignEditor:autoSave",
    autoSaveEnabled ? "on" : "off"
  );
}, [autoSaveEnabled]);

  const safeValue = useMemo(() => cloneConfig(value), [value]);
const currentSnapshot = useMemo(() => {
  try {
    return JSON.stringify(safeValue);
  } catch {
    return "";
  }
}, [safeValue]);

useEffect(() => {
  if (!lastSavedSnapshot) {
    setLastSavedSnapshot(currentSnapshot);
    setHasUnsavedChanges(false);
    return;
  }

  setHasUnsavedChanges(currentSnapshot !== lastSavedSnapshot);
}, [currentSnapshot, lastSavedSnapshot]);

useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (!hasUnsavedChanges) return;

    e.preventDefault();
    e.returnValue = "";
  };

  window.addEventListener("beforeunload", handleBeforeUnload);
  return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [hasUnsavedChanges]);

useEffect(() => {
  if (!onSave) return;
  if (!autoSaveEnabled) return;
  if (isSaving) return;

  if (!hasUnsavedChanges) {
    if (autoSaveStatus !== "saved") {
      setAutoSaveStatus("saved");
    }
    return;
  }

  setAutoSaveStatus("waiting");

  const timer = window.setTimeout(() => {
    const repaired = repairRequiredDbFields(safeValue);

    if (!validateBeforeSave(repaired)) {
      setAutoSaveStatus("idle");
      return;
    }

    setAutoSaveStatus("saving");
    onChange(repaired);
    setLastSavedSnapshot(JSON.stringify(repaired));
    setHasUnsavedChanges(false);

    window.setTimeout(async () => {
  try {
    await onSave?.();
    setAutoSaveStatus("saved");
  } catch (error) {
    console.error("자동 저장 실패:", error);
    setAutoSaveStatus("error");
    setHasUnsavedChanges(true);
  }
}, 0);
  }, 2500);

  return () => window.clearTimeout(timer);
}, [currentSnapshot, hasUnsavedChanges, onSave, isSaving, safeValue, autoSaveEnabled]);

  const sortedFields = useMemo(
    () => sortFields(safeValue.fields || []),
    [safeValue.fields]
  );

  useEffect(() => {
  const next: Record<string, string> = {};
  const mapping = safeValue.mapping || {};

  for (const field of safeValue.fields || []) {
    next[field.fieldKey] = String(mapping[field.fieldKey] || field.fieldKey);
  }

  setMappingDrafts(next);
}, [safeValue.fields, safeValue.mapping]);

  const updateConfig = (updater: (prev: UiConfig) => UiConfig) => {
    const next = updater(cloneConfig(value));
    onChange(next);
  };

  const updateTopLevel = <K extends keyof UiConfig>(key: K, nextValue: UiConfig[K]) => {
    updateConfig((prev) => ({
      ...prev,
      [key]: nextValue,
    }));
  };

  const updateField = (
    targetKey: string,
    updater: (field: UiField) => UiField
  ) => {
    updateConfig((prev) => ({
      ...prev,
      fields: sortFields(
        (prev.fields || []).map((field) =>
          field.fieldKey === targetKey ? updater(field) : field
        )
      ),
    }));
  };

const updateFieldSafe = (
  targetKey: string,
  updater: (field: UiField) => UiField
) => {
  updateConfig((prev) => {
    const nextFields = sortFields(
      (prev.fields || []).map((field) => {
        if (field.fieldKey !== targetKey) return field;

        const next = updater(field);

        if (isLockedFormFieldKey(field.fieldKey)) {
  return {
    ...next,
    fieldKey: field.fieldKey,
    hidden: false,
    required:
      field.fieldKey === "notes"
        ? Boolean(next.required)
        : true,
  };
}

        return next;
      })
    );

    return {
      ...prev,
      fields: nextFields,
    };
  });
};

  const removeField = (targetKey: string) => {
  if (isLockedFormFieldKey(targetKey)) {
    alert("상담DB 필수 항목은 삭제할 수 없습니다.");
    return;
  }

  updateConfig((prev) => {
    const filtered = (prev.fields || []).filter(
      (field) => field.fieldKey !== targetKey
    );

    const nextFields = filtered.map((field, index) => ({
      ...field,
      order: index + 1,
    }));

    const nextMapping = { ...(prev.mapping || {}) };
    delete nextMapping[targetKey];

    return {
      ...prev,
      fields: nextFields,
      mapping: nextMapping,
    };
  });
};

  const moveField = (targetKey: string, direction: "up" | "down") => {
    updateConfig((prev) => {
      const fields = sortFields(prev.fields || []);
      const index = fields.findIndex((field) => field.fieldKey === targetKey);
      if (index < 0) return prev;

      const swapIndex = direction === "up" ? index - 1 : index + 1;
      if (swapIndex < 0 || swapIndex >= fields.length) return prev;

      const next = [...fields];
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];

      return {
        ...prev,
        fields: next.map((field, idx) => ({
          ...field,
          order: idx + 1,
        })),
      };
    });
  };

const addCustomField = () => {
  const nextOrder = (safeValue.fields || []).length + 1;
  const fieldKey = `customField_${Date.now()}`;

  updateConfig((prev) => ({
    ...prev,
    fields: [
      ...(prev.fields || []),
      {
        fieldKey,
        label: "추가 질문",
        placeholder: "추가로 받고 싶은 내용을 입력해주세요.",
        required: false,
        hidden: false,
        order: nextOrder,
        type: "text",
      },
    ],
    mapping: {
      ...(prev.mapping || {}),
      [fieldKey]: fieldKey,
    },
  }));
};

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!file || !onUploadImage) return;
    await onUploadImage(file, "logoUrl");
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.currentTarget.value = "";
    if (!file || !onUploadImage) return;
    await onUploadImage(file, "heroImageUrl");
  };

  const selectedTemplate = useMemo(() => {
    return (templateList || []).find(
      (item: any) =>
        String(item?.templateName || "").trim() === selectedTemplateName.trim()
    );
  }, [templateList, selectedTemplateName]);

const selectedTemplatePreviewScale = useMemo(() => {
  const canvasWidth = Number(selectedTemplate?.canvas?.width || 390);

  if (typeof window === "undefined") return 0.18;

  const isMobile = window.innerWidth < 768;

  if (!isMobile) return 0.18;

  return Math.min(1, Math.max(0.18, (window.innerWidth - 64) / canvasWidth));
}, [selectedTemplate]);

const templateNames = useMemo(() => {
  return new Set(
    (templateList || [])
      .map((item: any) => String(item?.templateName || "").trim())
      .filter(Boolean)
  );
}, [templateList]);

const filteredTemplateList = useMemo(() => {
  const keyword = templateSearch.trim().toLowerCase();

  return (templateList || [])
    .filter((item: any) => {
      const name = String(item?.templateName || "").toLowerCase();
      const description = String(item?.description || "").toLowerCase();
      const tags = String(item?.tags || "").toLowerCase();

      if (!keyword) return true;

      return (
        name.includes(keyword) ||
        description.includes(keyword) ||
        tags.includes(keyword)
      );
    })
    .sort((a: any, b: any) => {
      const pinnedA = Boolean(a?.isPinned);
      const pinnedB = Boolean(b?.isPinned);

      if (pinnedA !== pinnedB) return pinnedA ? -1 : 1;

      return String(a?.templateName || "").localeCompare(
        String(b?.templateName || ""),
        "ko"
      );
    });
}, [templateList, templateSearch]);

const repairRequiredDbFields = (config: UiConfig): UiConfig => {
  const existingFields = config.fields || [];
  const existingByKey = new Map(existingFields.map((field) => [field.fieldKey, field]));

  const requiredDefaults: UiField[] = [
    {
      fieldKey: "clientName",
      label: existingByKey.get("clientName")?.label || "이름",
      placeholder: existingByKey.get("clientName")?.placeholder || "이름",
      required: true,
      hidden: false,
      order: 1,
      type: "text",
    },
    {
      fieldKey: "phone",
      label: existingByKey.get("phone")?.label || "전화번호",
      placeholder: existingByKey.get("phone")?.placeholder || "전화번호",
      required: true,
      hidden: false,
      order: 2,
      type: "phone",
    },
    {
      fieldKey: "finalEducation",
      label: existingByKey.get("finalEducation")?.label || "최종학력",
      placeholder: existingByKey.get("finalEducation")?.placeholder || "최종학력 선택",
      required: true,
      hidden: false,
      order: 3,
      type: "select",
      options: existingByKey.get("finalEducation")?.options || [
        { label: "고등학교 졸업", value: "고등학교 졸업" },
        { label: "전문학사", value: "전문학사" },
        { label: "학사", value: "학사" },
        { label: "석사 이상", value: "석사 이상" },
        { label: "기타", value: "기타" },
      ],
    },
    {
      fieldKey: "desiredCourse",
      label: existingByKey.get("desiredCourse")?.label || "희망과정",
      placeholder: existingByKey.get("desiredCourse")?.placeholder || "희망과정 선택",
      required: true,
      hidden: false,
      order: 4,
      type: "select",
      options: existingByKey.get("desiredCourse")?.options || [
        { label: "사회복지사", value: "사회복지사" },
        { label: "보육교사", value: "보육교사" },
        { label: "평생교육사", value: "평생교육사" },
        { label: "건강가정사", value: "건강가정사" },
        { label: "한국어교원", value: "한국어교원" },
        { label: "전문학사/학사", value: "전문학사/학사" },
        { label: "기타", value: "기타" },
      ],
    },
    {
      fieldKey: "channel",
      label: existingByKey.get("channel")?.label || "문의경로",
      placeholder: existingByKey.get("channel")?.placeholder || "문의경로",
      required: false,
      hidden: false,
      order: 5,
      type: "text",
    },
    {
      fieldKey: "notes",
      label: existingByKey.get("notes")?.label || "상담내역",
      placeholder: existingByKey.get("notes")?.placeholder || "진행하시면서 걱정되시는 부분 적어주세요!",
      required: false,
      hidden: false,
      order: 6,
      type: "textarea",
    },
    {
      fieldKey: "agreed",
      label: existingByKey.get("agreed")?.label || "개인정보 수집 및 이용에 동의합니다.",
      placeholder: "",
      required: true,
      hidden: false,
      order: 7,
      type: "checkbox",
    },
  ];

  const customFields = existingFields.filter(
    (field) => !DEFAULT_FIELD_KEYS.includes(field.fieldKey)
  );

  return {
    ...config,
    mapping: {
      ...(config.mapping || {}),
      clientName: "clientName",
      phone: "phone",
      finalEducation: "finalEducation",
      desiredCourse: "desiredCourse",
      channel: "channel",
      notes: "notes",
    },
    fields: sortFields([...requiredDefaults, ...customFields]).map((field, index) => ({
      ...field,
      order: index + 1,
    })),
  };
};

const validateBeforeSave = (config: UiConfig = safeValue) => {
  const fields = config.fields || [];
  const fieldKeys = new Set(fields.map((field) => field.fieldKey));

  for (const key of DEFAULT_FIELD_KEYS) {
    if (!fieldKeys.has(key)) {
      alert(`필수 기본 필드가 누락되었습니다: ${key}`);
      return false;
    }
  }

  const mapping = config.mapping || {};

const repairedMapping = {
  ...mapping,
  clientName: "clientName",
  phone: "phone",
  finalEducation: "finalEducation",
  desiredCourse: "desiredCourse",
  channel: "channel",
  notes: "notes",
};

  const requiredMappingKeys = [
    "clientName",
    "phone",
    "finalEducation",
    "desiredCourse",
    "channel",
    "notes",
  ];

  for (const key of requiredMappingKeys) {
    if (repairedMapping[key] !== key) {
      alert(`DB 매핑 키가 잘못되었습니다: ${key}`);
      return false;
    }
  }

  return true;
};

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: 24,
        background: "#fff",
        padding: 20,
        boxShadow: "0 10px 30px rgba(15, 23, 42, 0.06)",
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#0f172a",
            marginBottom: 6,
          }}
        >
          {title} 디자인 편집
        </div>
        <div style={{ fontSize: 13, color: "#64748b" }}>
          {mode === "landing"
            ? "랜딩페이지 레이아웃과 필드 구성을 편집합니다."
            : "광고페이지 레이아웃과 필드 구성을 편집합니다."}
        </div>
<div
  style={{
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 16,
    padding: 6,
    borderRadius: 16,
    background: "#f1f5f9",
  }}
>
  {[
  ["basic", "간단 설정"],
  ["canvas", "캔버스 꾸미기"],
  ["fields", "상담 항목"],
  ...(canManageTemplates ? [["templates", "템플릿"]] : []),
].map(([key, label]) => (
    <button
      key={key}
      type="button"
      onClick={() => setActiveTab(key as typeof activeTab)}
      style={{
        height: 38,
        padding: "0 14px",
        borderRadius: 12,
        border: "1px solid",
        borderColor: activeTab === key ? "#0f172a" : "transparent",
        background: activeTab === key ? "#0f172a" : "transparent",
        color: activeTab === key ? "#fff" : "#334155",
        fontSize: 13,
        fontWeight: 800,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  ))}
</div>
      </div>

      {canManageTemplates && activeTab === "templates" ? (
        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 18,
            padding: 16,
            marginBottom: 20,
            background: "#f8fafc",
          }}
        >
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              marginBottom: 12,
              color: "#0f172a",
            }}
          >
            템플릿 관리
          </div>

          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <div>
              <div style={{ fontSize: 12, marginBottom: 6, color: "#475569" }}>
                템플릿 선택 ({filteredTemplateList.length}/{templateList.length})
              </div>
<input
  value={templateSearch}
  onChange={(e) => setTemplateSearch(e.target.value)}
  placeholder="템플릿 이름/설명/태그 검색"
  style={{ ...inputStyle, marginBottom: 8 }}
/>
{templateSearch.trim() ? (
  <button
    type="button"
    onClick={() => setTemplateSearch("")}
    style={{ ...outlineButtonStyle, width: "100%", marginBottom: 8 }}
  >
    검색 초기화
  </button>
) : null}
              <select
                value={selectedTemplateName}
                onChange={(e) =>
                  onSelectedTemplateNameChange?.(e.target.value)
                }
                style={selectStyle}
              >
                <option value="">템플릿 선택</option>
                {filteredTemplateList.map((item: any) => {
                  const name = String(item?.templateName || "");
                  const pinned = Boolean(item?.isPinned);
                  return (
                    <option key={name} value={name}>
                      {pinned ? "📌 " : ""}
                      {name}
                    </option>
                  );
                })}
              </select>

{templateList.length === 0 ? (
  <div
    style={{
      marginTop: 8,
      padding: 10,
      borderRadius: 12,
      background: "#f8fafc",
      border: "1px solid #e2e8f0",
      color: "#64748b",
      fontSize: 12,
      fontWeight: 700,
    }}
  >
    저장된 템플릿이 없습니다. 현재 디자인을 템플릿으로 저장해보세요.
  </div>
) : null}

{templateList.length > 0 &&
templateSearch.trim() &&
filteredTemplateList.length === 0 ? (
  <div
    style={{
      marginTop: 8,
      padding: 10,
      borderRadius: 12,
      background: "#fff7ed",
      border: "1px solid #fed7aa",
      color: "#c2410c",
      fontSize: 12,
      fontWeight: 700,
    }}
  >
    검색 결과가 없습니다.
  </div>
) : null}

{selectedTemplateName &&
templateSearch.trim() &&
!filteredTemplateList.some(
  (item: any) =>
    String(item?.templateName || "").trim() === selectedTemplateName.trim()
) ? (
  <div
    style={{
      marginTop: 8,
      padding: 10,
      borderRadius: 12,
      background: "#eff6ff",
      border: "1px solid #bfdbfe",
      color: "#1d4ed8",
      fontSize: 12,
      fontWeight: 700,
    }}
  >
    현재 선택된 템플릿은 검색 결과에 없습니다.

    <button
      type="button"
      onClick={() => setTemplateSearch("")}
      style={{ ...outlineButtonStyle, width: "100%", marginTop: 8 }}
    >
      선택된 템플릿 보기
    </button>
  </div>
) : null}
	{selectedTemplate ? (
  <div
    style={{
      marginTop: 8,
      padding: 10,
      borderRadius: 12,
      background: "#fff",
      border: "1px solid #e2e8f0",
      fontSize: 12,
      color: "#475569",
      lineHeight: 1.6,
    }}
  >
    <div>설명: {selectedTemplate.description || "없음"}</div>
<div>태그: {selectedTemplate.tags || "없음"}</div>
<div>핀 고정: {selectedTemplate.isPinned ? "ON" : "OFF"}</div>
<div>캔버스: {selectedTemplate.canvas?.enabled ? "ON" : "OFF"}</div>
    <div>요소: {selectedTemplate.canvas?.elements?.length || 0}개</div>
<button
  type="button"
  onClick={() => {
  onSelectedTemplateNameChange?.("");
  setTemplateSearch("");
  setRenameTemplateDraft("");
  setDuplicateTemplateDraft("");
}}
  style={{ ...outlineButtonStyle, width: "100%", marginTop: 8 }}
>
  선택 해제
</button>
{selectedTemplate.canvas?.enabled ? (
  <div style={{ marginTop: 10 }}>
    <FormCanvasRenderer
  canvas={selectedTemplate.canvas}
  scale={selectedTemplatePreviewScale}
/>
  </div>
) : null}
  </div>
) : null}	
            </div>

            <div>
              <div style={{ fontSize: 12, marginBottom: 6, color: "#475569" }}>
                새 템플릿 이름
              </div>
              <input
                value={templateNameDraft}
                onChange={(e) => setTemplateNameDraft(e.target.value)}
                placeholder="예: 위드원 기본형"
                style={inputStyle}
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 12,
            }}
          >
            <button
              type="button"
              onClick={() => {
  const name = templateNameDraft.trim();

  if (!name) {
    alert("템플릿 이름을 입력해주세요.");
    return;
  }

if (templateNames.has(name)) {
  alert("이미 같은 이름의 템플릿이 있습니다.");
  return;
}


onSaveAsTemplate?.(name);
onSelectedTemplateNameChange?.(name);
setTemplateNameDraft("");
setRenameTemplateDraft("");
setDuplicateTemplateDraft("");
setTemplateSearch("");
}}
              style={solidButtonStyle}
            >
              템플릿 저장
            </button>

            <button
              type="button"
              onClick={() => {
  const name = selectedTemplateName.trim();

  if (!name) {
    alert("적용할 템플릿을 선택해주세요.");
    return;
  }

  const message = hasUnsavedChanges
    ? `"${name}" 템플릿을 현재 디자인에 적용할까요?\n\n현재 저장되지 않은 변경사항이 있습니다.\n템플릿을 적용하면 현재 편집 중인 디자인은 덮어쓰기 됩니다.`
    : `"${name}" 템플릿을 현재 디자인에 적용할까요?\n현재 편집 중인 디자인은 덮어쓰기 됩니다.`;

  const ok = window.confirm(message);

  if (!ok) return;

  onApplyTemplate?.(name);
setAutoSaveStatus("waiting");
setHasUnsavedChanges(true);
setTemplateSearch("");
setRenameTemplateDraft("");
setDuplicateTemplateDraft("");
}}
              style={outlineButtonStyle}
            >
              템플릿 적용
            </button>

            <button
              type="button"
              onClick={() => {
  const name = selectedTemplateName.trim();

  if (!name) {
    alert("삭제할 템플릿을 선택해주세요.");
    return;
  }

  const ok = window.confirm(
    `"${name}" 템플릿을 삭제할까요?\n삭제한 템플릿은 복구할 수 없습니다.`
  );

  if (!ok) return;

  onDeleteTemplate?.(name);
onSelectedTemplateNameChange?.("");
setTemplateSearch("");
setRenameTemplateDraft("");
setDuplicateTemplateDraft("");
}}
              style={dangerButtonStyle}
            >
              템플릿 삭제
            </button>

            <button
              type="button"
              onClick={() => {
  const name = selectedTemplateName.trim();

  if (!name) {
    alert("핀 고정할 템플릿을 선택해주세요.");
    return;
  }

  onTogglePinTemplate?.(name);
setTemplateSearch("");
setRenameTemplateDraft("");
setDuplicateTemplateDraft("");
}}
              style={outlineButtonStyle}
            >
              {selectedTemplate?.isPinned ? "핀 해제" : "핀 고정"}
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              marginTop: 16,
            }}
          >
            <div>
              <div style={{ fontSize: 12, marginBottom: 6, color: "#475569" }}>
                이름 변경
              </div>
              <input
                value={renameTemplateDraft}
                onChange={(e) => setRenameTemplateDraft(e.target.value)}
                placeholder="새 이름"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => {
  const oldName = selectedTemplateName.trim();
  const newName = renameTemplateDraft.trim();

  if (!oldName) {
    alert("이름을 변경할 템플릿을 선택해주세요.");
    return;
  }

  if (!newName) {
    alert("새 템플릿 이름을 입력해주세요.");
    return;
  }

  if (oldName === newName) {
    alert("기존 이름과 새 이름이 같습니다.");
    return;
  }

if (templateNames.has(newName)) {
  alert("이미 같은 이름의 템플릿이 있습니다.");
  return;
}

  onRenameTemplate?.(oldName, newName);
onSelectedTemplateNameChange?.(newName);
setRenameTemplateDraft("");
setDuplicateTemplateDraft("");
setTemplateSearch("");
}}
                style={{ ...outlineButtonStyle, marginTop: 8, width: "100%" }}
              >
                템플릿 이름 변경
              </button>
            </div>

            <div>
              <div style={{ fontSize: 12, marginBottom: 6, color: "#475569" }}>
                템플릿 복제
              </div>
              <input
                value={duplicateTemplateDraft}
                onChange={(e) => setDuplicateTemplateDraft(e.target.value)}
                placeholder="복제본 이름"
                style={inputStyle}
              />
              <button
                type="button"
                onClick={() => {
  const sourceName = selectedTemplateName.trim();
  const newName = duplicateTemplateDraft.trim();

  if (!sourceName) {
    alert("복제할 템플릿을 선택해주세요.");
    return;
  }

  if (!newName) {
    alert("복제본 이름을 입력해주세요.");
    return;
  }

  if (sourceName === newName) {
  alert("원본과 다른 이름을 입력해주세요.");
  return;
}

if (templateNames.has(newName)) {
  alert("이미 같은 이름의 템플릿이 있습니다.");
  return;
}

onDuplicateTemplate?.(sourceName, newName);
onSelectedTemplateNameChange?.(newName);
setDuplicateTemplateDraft("");
setRenameTemplateDraft("");
setTemplateSearch("");
}}
                style={{ ...outlineButtonStyle, marginTop: 8, width: "100%" }}
              >
                템플릿 복제
              </button>
            </div>
          </div>
        </section>
      ) : null}

{activeTab === "basic" ? (
  <>
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div section-title="" style={sectionTitleStyle}>
          기본 정보
        </div>

        <div style={grid2Style}>
          <div>
            <div style={labelStyle}>제목</div>
            <input
              value={safeValue.title || ""}
              onChange={(e) => updateTopLevel("title", e.target.value)}
              placeholder="페이지 제목"
              style={inputStyle}
            />
          </div>

          <div>
            <div style={labelStyle}>부제목</div>
            <input
              value={safeValue.subtitle || ""}
              onChange={(e) => updateTopLevel("subtitle", e.target.value)}
              placeholder="페이지 부제목"
              style={inputStyle}
            />
          </div>

          <div>
            <div style={labelStyle}>대표색상</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="color"
                value={normalizeColor(safeValue.primaryColor || "#5fc065")}
                onChange={(e) =>
                  updateTopLevel("primaryColor", e.target.value)
                }
                style={{
                  width: 56,
                  height: 44,
                  border: "1px solid #e5e7eb",
                  borderRadius: 12,
                  background: "#fff",
                  padding: 4,
                }}
              />
              <input
                value={safeValue.primaryColor || ""}
                onChange={(e) =>
                  updateTopLevel("primaryColor", e.target.value)
                }
                placeholder="#5fc065"
                style={inputStyle}
              />
            </div>
          </div>

<div>
  <div style={labelStyle}>자유 디자인 캔버스</div>
  <button
    type="button"
    onClick={() => {
      updateTopLevel("canvas", {
        ...(safeValue.canvas || {}),
        enabled: !Boolean(safeValue.canvas?.enabled),
      });
      setActiveTab("canvas");
    }}
    style={{
      ...outlineButtonStyle,
      width: "100%",
      background: safeValue.canvas?.enabled ? "#0f172a" : "#fff",
      color: safeValue.canvas?.enabled ? "#fff" : "#334155",
      borderColor: safeValue.canvas?.enabled ? "#0f172a" : "#cbd5e1",
    }}
  >
    {safeValue.canvas?.enabled
      ? "캔버스 사용 중 · 꾸미러 가기"
      : "캔버스 사용하기"}
  </button>
</div>

          <div>
            <div style={labelStyle}>레이아웃</div>
            <select
              value={safeValue.layoutType || "card"}
              onChange={(e) =>
                updateTopLevel(
                  "layoutType",
                  e.target.value as UiConfig["layoutType"]
                )
              }
              style={selectStyle}
            >
              <option value="card">card</option>
              <option value="bottomSheet">bottomSheet</option>
            </select>
          </div>

          <div>
            <div style={labelStyle}>버튼 문구</div>
            <input
              value={safeValue.submitButtonText || ""}
              onChange={(e) =>
                updateTopLevel("submitButtonText", e.target.value)
              }
              placeholder="예: 1:1 맞춤 상담 받기"
              style={inputStyle}
            />
          </div>

          <div>
            <div style={labelStyle}>개인정보 동의 문구</div>
            <input
              value={safeValue.agreementText || ""}
              onChange={(e) =>
                updateTopLevel("agreementText", e.target.value)
              }
              placeholder="개인정보 수집 및 이용에 동의합니다."
              style={inputStyle}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={labelStyle}>설명</div>
            <textarea
              value={safeValue.description || ""}
              onChange={(e) => updateTopLevel("description", e.target.value)}
              placeholder="페이지 설명"
              style={textareaStyle}
            />
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <div style={labelStyle}>태그</div>
            <input
              value={safeValue.tags || ""}
              onChange={(e) => updateTopLevel("tags", e.target.value)}
              placeholder="쉼표로 구분"
              style={inputStyle}
            />
          </div>
        </div>
      </section>

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div style={sectionTitleStyle}>이미지 / URL</div>

        <div style={grid2Style}>
          <div>
            <div style={labelStyle}>로고 URL</div>
            <input
              value={safeValue.logoUrl || ""}
              onChange={(e) => updateTopLevel("logoUrl", e.target.value)}
              placeholder="https://..."
              style={inputStyle}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <label style={outlineButtonStyle}>
                {isUploadingLogo ? "업로드 중..." : "로고 업로드"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          </div>

          <div>
            <div style={labelStyle}>상단 이미지 URL</div>
            <input
              value={safeValue.heroImageUrl || ""}
              onChange={(e) => updateTopLevel("heroImageUrl", e.target.value)}
              placeholder="https://..."
              style={inputStyle}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <label style={outlineButtonStyle}>
                {isUploadingHero ? "업로드 중..." : "상단 이미지 업로드"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleHeroUpload}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          </div>
        </div>

        {(safeValue.logoUrl || safeValue.heroImageUrl) ? (
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              marginTop: 16,
            }}
          >
            {safeValue.logoUrl ? (
              <div style={previewCardStyle}>
                <div style={previewLabelStyle}>로고 미리보기</div>
                <img
                  src={safeValue.logoUrl}
                  alt="로고 미리보기"
                  style={imagePreviewStyle}
                />
              </div>
            ) : null}

            {safeValue.heroImageUrl ? (
              <div style={previewCardStyle}>
                <div style={previewLabelStyle}>상단 이미지 미리보기</div>
                <img
                  src={safeValue.heroImageUrl}
                  alt="상단 이미지 미리보기"
                  style={imagePreviewStyle}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
  </>
) : null}
{activeTab === "canvas" ? (
      <section style={{ marginBottom: 20 }}>
        <FormCanvasEditor
  value={safeValue.canvas}
  onChange={(nextCanvas) =>
    updateTopLevel("canvas", nextCanvas)
  }
  onUploadImage={onUploadCanvasImage}
/>
      </section>
) : null}

{activeTab === "fields" ? (
  <>
      <section
  style={{
    border: "1px solid #e5e7eb",
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
    background: "#f8fafc",
  }}
>
  <div style={sectionTitleStyle}>상담 항목 추가</div>

  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
      alignItems: "center",
      flexWrap: "wrap",
    }}
  >
    <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>
      이름, 전화번호, 최종학력, 희망과정은 기본 상담 DB 항목이라 자동으로 유지됩니다.
      <br />
      별도로 더 받고 싶은 질문만 추가하세요.
    </div>

    <button type="button" onClick={addCustomField} style={solidButtonStyle}>
      + 추가 질문 넣기
    </button>
  </div>
</section>

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div
  style={{
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    flexWrap: "wrap",
  }}
>
  <div style={{ ...sectionTitleStyle, marginBottom: 0 }}>
    상담 항목 편집
  </div>

  <button
    type="button"
    onClick={() => setShowAdvancedFields((prev) => !prev)}
    style={outlineButtonStyle}
  >
    {showAdvancedFields ? "고급 설정 숨기기" : "고급 설정 보기"}
  </button>
</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {sortedFields.length === 0 ? (
            <div style={{ fontSize: 13, color: "#64748b" }}>
              등록된 필드가 없습니다.
            </div>
          ) : null}

          {sortedFields.map((field, index) => {
  const isLockedField = isLockedFormFieldKey(field.fieldKey);
  const isLockedMapping = isLockedMappingKey(field.fieldKey);

  return (
            <div
              key={field.fieldKey}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: 18,
                padding: 14,
                background: "#fafafa",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 14,
                    color: "#0f172a",
                  }}
                >
                  {index + 1}. {field.label || field.fieldKey}
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {!isLockedField ? (
  <>
    <button
      type="button"
      onClick={() => moveField(field.fieldKey, "up")}
      style={outlineButtonStyle}
    >
      ↑ 위로
    </button>
    <button
      type="button"
      onClick={() => moveField(field.fieldKey, "down")}
      style={outlineButtonStyle}
    >
      ↓ 아래로
    </button>
  </>
) : null}
                  {!isLockedField ? (
  <button
    type="button"
    onClick={() => removeField(field.fieldKey)}
    style={dangerButtonStyle}
  >
    삭제
  </button>
) : null}
                </div>
              </div>

              <div style={grid2Style}>
{showAdvancedFields ? (
  <>
                <div>
                  <div style={labelStyle}>fieldKey</div>
                  <input
  value={field.fieldKey}
  disabled={isLockedField}
  onChange={(e) => {
                      const nextKey = e.target.value.trim();
                      if (!nextKey) return;

                      updateConfig((prev) => {
                        const nextFields = (prev.fields || []).map((item) =>
                          item.fieldKey === field.fieldKey
                            ? { ...item, fieldKey: nextKey }
                            : item
                        );

                        const nextMapping = { ...(prev.mapping || {}) };
                        const currentMapped =
                          nextMapping[field.fieldKey] || field.fieldKey;
                        delete nextMapping[field.fieldKey];
                        nextMapping[nextKey] = currentMapped;

                        return {
                          ...prev,
                          fields: nextFields,
                          mapping: nextMapping,
                        };
                      });
                    }}
                    style={{
  ...inputStyle,
  background: isLockedField ? "#f1f5f9" : "#fff",
  color: isLockedField ? "#64748b" : "#0f172a",
  cursor: isLockedField ? "not-allowed" : "text",
}}
                  />
                </div>

                <div>
                  <div style={labelStyle}>DB 매핑 키</div>
                  <input
  value={mappingDrafts[field.fieldKey] || field.fieldKey}
  disabled={isLockedMapping}
  onChange={(e) => {
                      const next = e.target.value;
                      setMappingDrafts((prev) => ({
                        ...prev,
                        [field.fieldKey]: next,
                      }));

                      updateConfig((prev) => ({
                        ...prev,
                        mapping: {
                          ...(prev.mapping || {}),
                          [field.fieldKey]: next.trim() || field.fieldKey,
                        },
                      }));
                    }}
                    placeholder="예: clientName"
                    style={{
  ...inputStyle,
  background: isLockedMapping ? "#f1f5f9" : "#fff",
  color: isLockedMapping ? "#64748b" : "#0f172a",
  cursor: isLockedMapping ? "not-allowed" : "text",
}}
                  />
                </div>
  </>
) : null}
                <div>
                  <div style={labelStyle}>라벨</div>
                  <input
                    value={field.label || ""}
                    onChange={(e) =>
                      updateFieldSafe(field.fieldKey, (prev) => ({
                        ...prev,
                        label: e.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <div style={labelStyle}>placeholder</div>
                  <input
                    value={field.placeholder || ""}
                    onChange={(e) =>
                      updateFieldSafe(field.fieldKey, (prev) => ({
                        ...prev,
                        placeholder: e.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </div>
{showAdvancedFields ? (
  <>
                <div>
                  <div style={labelStyle}>타입</div>
                  <select
  value={field.type}
  disabled={isLockedField}
  onChange={(e) =>
    updateFieldSafe(field.fieldKey, (prev) => ({
      ...prev,
      type: e.target.value as UiField["type"],
      options:
        e.target.value === "select"
          ? prev.options?.length
            ? prev.options
            : [
                { label: "옵션 1", value: "옵션 1" },
                { label: "옵션 2", value: "옵션 2" },
              ]
          : undefined,
    }))
  }
  style={{
    ...selectStyle,
    background: isLockedField ? "#f1f5f9" : "#fff",
    color: isLockedField ? "#64748b" : "#0f172a",
    cursor: isLockedField ? "not-allowed" : "pointer",
  }}
>
                    {FIELD_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <div style={labelStyle}>순서</div>
                  <input
                    type="number"
                    value={Number(field.order || 0)}
                    onChange={(e) =>
                      updateFieldSafe(field.fieldKey, (prev) => ({
                        ...prev,
                        order: Number(e.target.value || 0),
                      }))
                    }
                    style={inputStyle}
                  />
                </div>
  </>
) : null}
                <div>
                  <label style={checkRowStyle}>
                    <input
  type="checkbox"
  checked={
  field.fieldKey === "notes"
    ? Boolean(field.required)
    : isLockedField
    ? true
    : Boolean(field.required)
}
  disabled={isLockedField && field.fieldKey !== "notes"}
  onChange={(e) =>
    updateFieldSafe(field.fieldKey, (prev) => ({
      ...prev,
      required: e.target.checked,
    }))
  }
/>
필수 항목
                  </label>
                </div>

                <div>
                  <label style={checkRowStyle}>
                    <input
  type="checkbox"
  checked={isLockedField ? false : Boolean(field.hidden)}
  disabled={isLockedField}
  onChange={(e) =>
    updateFieldSafe(field.fieldKey, (prev) => ({
      ...prev,
      hidden: e.target.checked,
    }))
  }
/>
숨김 처리
                  </label>
                </div>

                {field.type === "checkbox" ? (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={labelStyle}>체크박스 문구</div>
                    <input
                      value={safeValue.agreementText || ""}
                      onChange={(e) =>
                        updateTopLevel("agreementText", e.target.value)
                      }
                      style={inputStyle}
                    />
                  </div>
                ) : null}

                {showAdvancedFields && field.type === "select" ? (
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={labelStyle}>옵션 관리</div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {(field.options || []).map((option, optionIndex) => (
                        <div
                          key={`${field.fieldKey}-${optionIndex}`}
                          style={{
                            display: "grid",
                            gap: 8,
                            gridTemplateColumns: "1fr 1fr auto",
                          }}
                        >
                          <input
                            value={option.label}
                            onChange={(e) =>
                              updateFieldSafe(field.fieldKey, (prev) => ({
                                ...prev,
                                options: (prev.options || []).map((item, idx) =>
                                  idx === optionIndex
                                    ? { ...item, label: e.target.value }
                                    : item
                                ),
                              }))
                            }
                            placeholder="표시명"
                            style={inputStyle}
                          />
                          <input
                            value={option.value}
                            onChange={(e) =>
                              updateFieldSafe(field.fieldKey, (prev) => ({
                                ...prev,
                                options: (prev.options || []).map((item, idx) =>
                                  idx === optionIndex
                                    ? { ...item, value: e.target.value }
                                    : item
                                ),
                              }))
                            }
                            placeholder="값"
                            style={inputStyle}
                          />
                          {!isLockedField ? (
  <button
    type="button"
    onClick={() =>
      updateFieldSafe(field.fieldKey, (prev) => ({
        ...prev,
        options: (prev.options || []).filter(
          (_, idx) => idx !== optionIndex
        ),
      }))
    }
    style={dangerButtonStyle}
  >
    삭제
  </button>
) : null}
                        </div>
                      ))}

                      {!isLockedField ? (
  <button
    type="button"
    onClick={() =>
      updateFieldSafe(field.fieldKey, (prev) => ({
        ...prev,
        options: [
          ...(prev.options || []),
          {
            label: `옵션 ${(prev.options || []).length + 1}`,
            value: `옵션 ${(prev.options || []).length + 1}`,
          },
        ],
      }))
    }
    style={outlineButtonStyle}
  >
    옵션 추가
  </button>
) : null}
                    </div>
                  </div>
                ) : null}
               </div>
            </div>
          );
          })}
        </div>
      </section>
  </>
) : null}

<div style={{ marginBottom: 20 }}>
  <button
    type="button"
    onClick={() => setShowPreviewSummary((prev) => !prev)}
    style={outlineButtonStyle}
  >
    {showPreviewSummary ? "미리보기 요약 접기" : "미리보기 요약 보기"}
  </button>
</div>

{showPreviewSummary ? (
      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 16,
          marginBottom: 20,
          background: "#f8fafc",
        }}
      >
        <div style={sectionTitleStyle}>미리보기 요약</div>

        <div style={previewCardStyle}>
          <div
            style={{
              display: "inline-flex",
              padding: "6px 10px",
              borderRadius: 999,
              background: "#e2e8f0",
              fontSize: 12,
              fontWeight: 600,
              color: "#334155",
              marginBottom: 12,
            }}
          >
            {safeValue.layoutType}
          </div>

          <div
            style={{
              fontSize: 22,
              fontWeight: 800,
              color: "#0f172a",
              marginBottom: 8,
            }}
          >
            {safeValue.title || "제목 없음"}
          </div>

          <div style={{ fontSize: 14, color: "#475569", marginBottom: 16 }}>
            {safeValue.subtitle || "부제목 없음"}
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <span style={badgeStyle}>
              대표색상 {normalizeColor(safeValue.primaryColor || "#5fc065")}
            </span>
            <span style={badgeStyle}>
              노출 필드 {(safeValue.fields || []).filter((f) => !f.hidden).length}개
            </span>
            <span style={badgeStyle}>
              템플릿 핀 {safeValue.isPinned ? "ON" : "OFF"}
            </span>
<span style={badgeStyle}>
  캔버스 {safeValue.canvas?.enabled ? "ON" : "OFF"}
</span>
<span style={badgeStyle}>
  요소 {safeValue.canvas?.elements?.length || 0}개
</span>
          </div>

          <div
            style={{
              border: "1px dashed #cbd5e1",
              borderRadius: 16,
              padding: 14,
              background: "#fff",
            }}
          >
            {(safeValue.fields || [])
  .filter((field) => !field.hidden)
  .sort((a, b) => a.order - b.order)
  .map((field) => (
    <div
      key={`preview-${field.fieldKey}`}
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: 8,
        padding: "8px 0",
        borderBottom: "1px solid #f1f5f9",
        fontSize: 13,
      }}
    >
      <span style={{ color: "#334155" }}>
        {field.label || field.fieldKey}
      </span>
      <span style={{ color: "#64748b" }}>
        {field.type}
        {field.required ? " / 필수" : ""}
      </span>
    </div>
  ))}
          </div>
        </div>
      </section>
) : null}

      <div
  style={{
    position: "sticky",
    bottom: 0,
    zIndex: 20,
    display: "flex",
    justifyContent: "flex-end",
    gap: 8,
    flexWrap: "wrap",
    padding: "12px 0 0",
    background: "linear-gradient(to top, #ffffff 70%, rgba(255,255,255,0))",
  }}
>
<div
  style={{
    marginRight: "auto",
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    fontWeight: 700,
    color:
  autoSaveStatus === "error"
    ? "#dc2626"
    : hasUnsavedChanges
    ? "#b45309"
    : "#16a34a",
  }}
>
  <span
    style={{
      width: 8,
      height: 8,
      borderRadius: 999,
      background:
  autoSaveStatus === "error"
    ? "#ef4444"
    : hasUnsavedChanges
    ? "#f59e0b"
    : "#22c55e",
      display: "inline-block",
    }}
  />
  {autoSaveStatus === "error"
  ? "저장 실패"
  : autoSaveStatus === "waiting"
  ? "자동 저장 대기"
  : autoSaveStatus === "saving" || isSaving
  ? "저장 중..."
  : hasUnsavedChanges
  ? "저장 필요"
  : "저장됨"}
</div>
<label
  style={{
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    fontWeight: 700,
    color: "#475569",
  }}
>
  <input
    type="checkbox"
    checked={autoSaveEnabled}
    onChange={(e) => setAutoSaveEnabled(e.target.checked)}
  />
  자동저장
</label>
        <button
          type="button"
          onClick={() => {
  const repaired = repairRequiredDbFields(safeValue);

  if (!validateBeforeSave(repaired)) return;

  setAutoSaveStatus("saving");

onChange(repaired);
setLastSavedSnapshot(JSON.stringify(repaired));
setHasUnsavedChanges(false);

setTimeout(async () => {
  try {
    await onSave?.();
    setAutoSaveStatus("saved");
  } catch (error) {
    console.error("디자인 저장 실패:", error);
    setAutoSaveStatus("error");
    setHasUnsavedChanges(true);
  }
}, 0);
}}
          disabled={!onSave || isSaving}
          style={{
            ...solidButtonStyle,
            opacity: !onSave || isSaving ? 0.6 : 1,
            cursor: !onSave || isSaving ? "not-allowed" : "pointer",
          }}
        >
          {isSaving ? "저장 중..." : "현재 디자인 저장"}
        </button>
      </div>
    </div>
  );
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  marginBottom: 14,
  color: "#0f172a",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  marginBottom: 6,
  color: "#475569",
  fontWeight: 600,
};

const grid2Style: React.CSSProperties = {
  display: "grid",
  gap: 12,
  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  border: "1px solid #dbe3ee",
  borderRadius: 12,
  padding: "0 12px",
  fontSize: 14,
  outline: "none",
  background: "#fff",
  boxSizing: "border-box",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 110,
  border: "1px solid #dbe3ee",
  borderRadius: 12,
  padding: 12,
  fontSize: 14,
  outline: "none",
  background: "#fff",
  resize: "vertical",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  height: 44,
  border: "1px solid #dbe3ee",
  borderRadius: 12,
  padding: "0 12px",
  fontSize: 14,
  outline: "none",
  background: "#fff",
  boxSizing: "border-box",
};

const solidButtonStyle: React.CSSProperties = {
  height: 40,
  padding: "0 14px",
  borderRadius: 12,
  border: "none",
  background: "#0f172a",
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const outlineButtonStyle: React.CSSProperties = {
  height: 40,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  textDecoration: "none",
  boxSizing: "border-box",
};

const dangerButtonStyle: React.CSSProperties = {
  height: 40,
  padding: "0 14px",
  borderRadius: 12,
  border: "1px solid #fecaca",
  background: "#fff1f2",
  color: "#be123c",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const checkRowStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 13,
  color: "#334155",
  minHeight: 44,
};

const previewCardStyle: React.CSSProperties = {
  border: "1px solid #e2e8f0",
  borderRadius: 18,
  padding: 14,
  background: "#fff",
};

const previewLabelStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  marginBottom: 8,
  fontWeight: 600,
};

const imagePreviewStyle: React.CSSProperties = {
  width: "100%",
  maxHeight: 240,
  objectFit: "contain",
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
};

const badgeStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 700,
  background: "#eff6ff",
  color: "#1d4ed8",
};