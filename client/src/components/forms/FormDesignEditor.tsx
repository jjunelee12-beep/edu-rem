import { useEffect, useMemo, useState } from "react";
import type { UiConfig } from "@/lib/formDesign/shared";

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

function getDefaultFieldLabel(fieldKey: string) {
  switch (fieldKey) {
    case "clientName":
      return "이름";
    case "phone":
      return "전화번호";
    case "finalEducation":
      return "최종학력";
    case "desiredCourse":
      return "희망과정";
    case "channel":
      return "문의경로";
    case "notes":
      return "상담내역";
    case "agreed":
      return "개인정보 수집 및 이용에 동의합니다.";
    default:
      return fieldKey || "새 항목";
  }
}

function getDefaultFieldPlaceholder(fieldKey: string) {
  switch (fieldKey) {
    case "clientName":
      return "이름";
    case "phone":
      return "전화번호";
    case "finalEducation":
      return "최종학력 선택";
    case "desiredCourse":
      return "희망과정 선택";
    case "channel":
      return "문의경로";
    case "notes":
      return "상담내용을 입력해주세요.";
    default:
      return "";
  }
}

function getDefaultFieldType(fieldKey: string): UiField["type"] {
  switch (fieldKey) {
    case "phone":
      return "phone";
    case "finalEducation":
    case "desiredCourse":
      return "select";
    case "notes":
      return "textarea";
    case "agreed":
      return "checkbox";
    default:
      return "text";
  }
}

function buildNewField(fieldKey: string, order: number): UiField {
  const type = getDefaultFieldType(fieldKey);

  return {
    fieldKey,
    label: getDefaultFieldLabel(fieldKey),
    placeholder: getDefaultFieldPlaceholder(fieldKey),
    required: fieldKey !== "notes",
    hidden: false,
    order,
    type,
    options:
      type === "select"
        ? [
            { label: "옵션 1", value: "옵션 1" },
            { label: "옵션 2", value: "옵션 2" },
          ]
        : undefined,
  };
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
}: FormDesignEditorProps) {
  const [templateNameDraft, setTemplateNameDraft] = useState("");
  const [renameTemplateDraft, setRenameTemplateDraft] = useState("");
  const [duplicateTemplateDraft, setDuplicateTemplateDraft] = useState("");
  const [newFieldKey, setNewFieldKey] = useState("");
  const [mappingDrafts, setMappingDrafts] = useState<Record<string, string>>({});

  const safeValue = useMemo(() => cloneConfig(value), [value]);

  const sortedFields = useMemo(
    () => sortFields(safeValue.fields || []),
    [safeValue.fields]
  );

  const availableFieldKeys = useMemo(() => {
    const used = new Set((safeValue.fields || []).map((field) => field.fieldKey));
    return DEFAULT_FIELD_KEYS.filter((key) => !used.has(key));
  }, [safeValue.fields]);

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

  const removeField = (targetKey: string) => {
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

  const addField = () => {
    const safeKey = newFieldKey.trim();
    if (!safeKey) return;

    const exists = (safeValue.fields || []).some(
      (field) => field.fieldKey === safeKey
    );
    if (exists) return;

    const nextOrder = (safeValue.fields || []).length + 1;

    updateConfig((prev) => ({
      ...prev,
      fields: [...(prev.fields || []), buildNewField(safeKey, nextOrder)],
      mapping: {
        ...(prev.mapping || {}),
        [safeKey]: safeKey,
      },
    }));

    setNewFieldKey("");
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
      </div>

      {canManageTemplates ? (
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
                템플릿 선택
              </div>
              <select
                value={selectedTemplateName}
                onChange={(e) =>
                  onSelectedTemplateNameChange?.(e.target.value)
                }
                style={selectStyle}
              >
                <option value="">템플릿 선택</option>
                {(templateList || []).map((item: any) => {
                  const name = String(item?.templateName || "");
                  const pinned = Boolean(item?.uiConfig?.isPinned);
                  return (
                    <option key={name} value={name}>
                      {pinned ? "📌 " : ""}
                      {name}
                    </option>
                  );
                })}
              </select>
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
              onClick={() => onSaveAsTemplate?.(templateNameDraft.trim())}
              style={solidButtonStyle}
            >
              템플릿 저장
            </button>

            <button
              type="button"
              onClick={() => onApplyTemplate?.(selectedTemplateName)}
              style={outlineButtonStyle}
            >
              템플릿 적용
            </button>

            <button
              type="button"
              onClick={() => onDeleteTemplate?.(selectedTemplateName)}
              style={dangerButtonStyle}
            >
              템플릿 삭제
            </button>

            <button
              type="button"
              onClick={() => onTogglePinTemplate?.(selectedTemplateName)}
              style={outlineButtonStyle}
            >
              {selectedTemplate?.uiConfig?.isPinned ? "핀 해제" : "핀 고정"}
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
                onClick={() =>
                  onRenameTemplate?.(
                    selectedTemplateName.trim(),
                    renameTemplateDraft.trim()
                  )
                }
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
                onClick={() =>
                  onDuplicateTemplate?.(
                    selectedTemplateName.trim(),
                    duplicateTemplateDraft.trim()
                  )
                }
                style={{ ...outlineButtonStyle, marginTop: 8, width: "100%" }}
              >
                템플릿 복제
              </button>
            </div>
          </div>
        </section>
      ) : null}

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

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 18,
          padding: 16,
          marginBottom: 20,
        }}
      >
        <div style={sectionTitleStyle}>필드 추가</div>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "minmax(180px, 240px) 1fr auto",
            alignItems: "end",
          }}
        >
          <div>
            <div style={labelStyle}>기본 키 선택</div>
            <select
              value={newFieldKey}
              onChange={(e) => setNewFieldKey(e.target.value)}
              style={selectStyle}
            >
              <option value="">추가할 필드 선택</option>
              {availableFieldKeys.map((key) => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
              <option value="customField">customField</option>
            </select>
          </div>

          <div style={{ fontSize: 12, color: "#64748b" }}>
            현재 없는 필드만 추가된다. `customField`는 사용자 정의 키로 추가 후
            fieldKey를 다시 바꿔서 사용할 수 있다.
          </div>

          <button type="button" onClick={addField} style={solidButtonStyle}>
            필드 추가
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
        <div style={sectionTitleStyle}>필드 상세 편집</div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {sortedFields.length === 0 ? (
            <div style={{ fontSize: 13, color: "#64748b" }}>
              등록된 필드가 없습니다.
            </div>
          ) : null}

          {sortedFields.map((field, index) => (
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
                  <button
                    type="button"
                    onClick={() => removeField(field.fieldKey)}
                    style={dangerButtonStyle}
                  >
                    삭제
                  </button>
                </div>
              </div>

              <div style={grid2Style}>
                <div>
                  <div style={labelStyle}>fieldKey</div>
                  <input
                    value={field.fieldKey}
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
                    style={inputStyle}
                  />
                </div>

                <div>
                  <div style={labelStyle}>DB 매핑 키</div>
                  <input
                    value={mappingDrafts[field.fieldKey] || field.fieldKey}
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
                    style={inputStyle}
                  />
                </div>

                <div>
                  <div style={labelStyle}>라벨</div>
                  <input
                    value={field.label || ""}
                    onChange={(e) =>
                      updateField(field.fieldKey, (prev) => ({
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
                      updateField(field.fieldKey, (prev) => ({
                        ...prev,
                        placeholder: e.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <div style={labelStyle}>타입</div>
                  <select
                    value={field.type}
                    onChange={(e) =>
                      updateField(field.fieldKey, (prev) => ({
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
                    style={selectStyle}
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
                      updateField(field.fieldKey, (prev) => ({
                        ...prev,
                        order: Number(e.target.value || 0),
                      }))
                    }
                    style={inputStyle}
                  />
                </div>

                <div>
                  <label style={checkRowStyle}>
                    <input
                      type="checkbox"
                      checked={Boolean(field.required)}
                      onChange={(e) =>
                        updateField(field.fieldKey, (prev) => ({
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
                      checked={Boolean(field.hidden)}
                      onChange={(e) =>
                        updateField(field.fieldKey, (prev) => ({
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

                {field.type === "select" ? (
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
                              updateField(field.fieldKey, (prev) => ({
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
                              updateField(field.fieldKey, (prev) => ({
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
                          <button
                            type="button"
                            onClick={() =>
                              updateField(field.fieldKey, (prev) => ({
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
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() =>
                          updateField(field.fieldKey, (prev) => ({
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
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

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

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={onSave}
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