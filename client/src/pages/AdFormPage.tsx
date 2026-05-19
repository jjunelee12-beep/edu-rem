import { useEffect, useMemo, useState } from "react";
import { type UiConfig } from "@/lib/formDesign/shared";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import "@/styles/ad-form.css";
import {
  DEFAULT_FORM_CANVAS_CONFIG,
  createDefaultWithOneCanvasConfig,
} from "@/lib/formDesign/canvasTypes";
import FullScreenFormCanvasEditor from "@/components/forms/canvas/FullScreenFormCanvasEditor";
import { normalizeAssetUrl } from "@/lib/normalizeAssetUrl";


const DEFAULT_AD_CONFIG: UiConfig = {
  title: "학점은행제 맞춤 상담 신청",
subtitle: "전문 담당자가 학습 상황에 맞춰 무료로 안내드립니다.",
logoUrl: "",
heroImageUrl: "",
primaryColor: "#2563eb",
submitButtonText: "무료 상담 신청하기",
  agreementText: "개인정보 수집 및 이용에 동의합니다.",
  layoutType: "card",
  description: "",
  tags: "",
  isPinned: false,
  lastUsedAt: "",
canvas: createDefaultWithOneCanvasConfig(),
  mapping: {
    clientName: "clientName",
    phone: "phone",
    finalEducation: "finalEducation",
    desiredCourse: "desiredCourse",
    channel: "channel",
    notes: "notes",
  },
  fields: [
    {
      fieldKey: "clientName",
      label: "이름",
      placeholder: "이름",
      required: true,
      hidden: false,
      order: 1,
      type: "text",
    },
    {
      fieldKey: "phone",
      label: "전화번호",
      placeholder: "전화번호",
      required: true,
      hidden: false,
      order: 2,
      type: "phone",
    },
    {
      fieldKey: "finalEducation",
      label: "최종학력",
      placeholder: "최종학력 선택",
      required: true,
      hidden: false,
      order: 3,
      type: "select",
      options: [
        { label: "고등학교 졸업", value: "고등학교 졸업" },
        { label: "전문학사", value: "전문학사" },
        { label: "학사", value: "학사" },
        { label: "석사 이상", value: "석사 이상" },
        { label: "기타", value: "기타" },
      ],
    },
    {
      fieldKey: "desiredCourse",
      label: "희망과정",
      placeholder: "희망과정 선택",
      required: true,
      hidden: false,
      order: 4,
      type: "select",
      options: [
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
      label: "문의경로",
      placeholder: "문의경로",
      required: false,
      hidden: false,
      order: 5,
      type: "text",
    },
    {
      fieldKey: "notes",
      label: "상담내역",
      placeholder: "진행하시면서 걱정되시는 부분 적어주세요!",
      required: false,
      hidden: false,
      order: 6,
      type: "textarea",
    },
    {
      fieldKey: "agreed",
      label: "개인정보 수집 및 이용에 동의합니다.",
      placeholder: "",
      required: true,
      hidden: false,
      order: 7,
      type: "checkbox",
    },
  ],
};

export default function AdFormPage() {
  const [match, params] = useRoute("/ad-form/:token");
const { user } = useAuth();
const utils = trpc.useUtils();
  const token = match ? params.token : "";

  const [values, setValues] = useState<Record<string, any>>({
    clientName: "",
    phone: "",
    finalEducation: "",
    desiredCourse: "",
    channel: "광고폼",
    notes: "",
    agreed: false,
  });

  const [done, setDone] = useState(false);

const [editMode, setEditMode] = useState(false);
const [uiDraft, setUiDraft] = useState<UiConfig>(DEFAULT_AD_CONFIG);



const [selectedTemplateName, setSelectedTemplateName] = useState("");

const [isUploadingLogo, setIsUploadingLogo] = useState(false);
const [isUploadingHero, setIsUploadingHero] = useState(false);

  const formQuery = trpc.publicForm.getByToken.useQuery(
    { token, formType: "ad" },
    { enabled: !!token }
  );


  const submitMutation = trpc.publicForm.submit.useMutation({
    onSuccess: () => {
  setDone(true);
},
    onError: (err) => {
      alert(err.message || "접수 중 오류가 발생했습니다.");
    },
  });

const saveMyUiConfigMutation = trpc.formAdmin.saveMyUiConfig.useMutation({
  onSuccess: async () => {
    toast.success("내 광고페이지 꾸미기가 저장되었습니다.");
    await utils.publicForm.getByToken.invalidate({
      token,
      formType: "ad",
    });
    setEditMode(false);
  },
  onError: (err) => {
    toast.error(err.message || "저장 중 오류가 발생했습니다.");
  },
});

const saveAsTemplateMutation = trpc.formAdmin.saveAsTemplate.useMutation({
  onSuccess: async () => {
    toast.success("템플릿으로 저장되었습니다.");
    await templateListQuery.refetch();
  },
  onError: (err) => {
    toast.error(err.message || "템플릿 저장 중 오류가 발생했습니다.");
  },
});

const applyTemplateMutation = trpc.formAdmin.applyTemplateToMyForm.useMutation({
  onSuccess: async (_data, variables) => {

    const preview = templatePreviewQuery.data?.uiConfig;
    const appliedName = String(variables.templateName || "").trim();

    if (appliedName && preview) {
      touchTemplateMutation.mutate({
        formType: "ad",
        templateName: appliedName,
        uiConfig: {
          ...preview,
          lastUsedAt: new Date().toISOString(),
        },
      });
    }

    toast.success("템플릿을 현재 페이지에 적용했습니다.");
setSelectedTemplateName("");

    await utils.publicForm.getByToken.invalidate({
      token,
      formType: "ad",
    });
  },
onError: (err) => {
  toast.error(err.message || "템플릿 적용 중 오류가 발생했습니다.");
},
});

const deleteTemplateMutation = trpc.formAdmin.deleteTemplate.useMutation({
  onSuccess: async () => {
    toast.success("템플릿을 삭제했습니다.");
    await templateListQuery.refetch();
    setSelectedTemplateName("");
  },
  onError: (err) => {
    toast.error(err.message || "템플릿 삭제 중 오류가 발생했습니다.");
  },
});

const renameTemplateMutation = trpc.formAdmin.renameTemplate.useMutation({
  onSuccess: async () => {
    toast.success("템플릿 이름을 변경했습니다.");
    await templateListQuery.refetch();
    setSelectedTemplateName("");
  },
  onError: (err) => {
    toast.error(err.message || "템플릿 이름 변경 중 오류가 발생했습니다.");
  },
});

const duplicateTemplateMutation = trpc.formAdmin.duplicateTemplate.useMutation({
  onSuccess: async () => {
    toast.success("템플릿을 복제했습니다.");
    await templateListQuery.refetch();
    setSelectedTemplateName("");
  },
  onError: (err) => {
    toast.error(err.message || "템플릿 복제 중 오류가 발생했습니다.");
  },
});

const pinTemplateMutation = trpc.formAdmin.saveAsTemplate.useMutation({
  onSuccess: async () => {
    toast.success("템플릿 고정 상태를 변경했습니다.");
    await templateListQuery.refetch();
    await templatePreviewQuery.refetch();
  },
  onError: (err) => {
    toast.error(err.message || "템플릿 고정 상태 변경 중 오류가 발생했습니다.");
  },
});

const touchTemplateMutation = trpc.formAdmin.saveAsTemplate.useMutation({
  onError: () => {
    // 최근 사용 시간 기록 실패는 치명적이지 않으니 조용히 무시
  },
});
  const uiConfig = useMemo(
  () => (formQuery.data?.uiConfig as UiConfig) || DEFAULT_AD_CONFIG,
  [formQuery.data?.uiConfig]
);

const canEdit =
  !!user &&
  !!formQuery.data?.ok &&
  Number(formQuery.data?.assigneeId) === Number(user.id);

const templateListQuery = trpc.formAdmin.listTemplates.useQuery(
  { formType: "ad" },
  { enabled: canEdit }
);

const templatePreviewQuery = trpc.formAdmin.getNamedTemplate.useQuery(
  {
    formType: "ad",
    templateName: selectedTemplateName,
  },
  {
    enabled: !!canEdit && !!selectedTemplateName,
  }
);

const displayConfig = editMode ? uiDraft : uiConfig;

const safeDisplayConfig: UiConfig = {
  ...DEFAULT_AD_CONFIG,
  ...displayConfig,
  canvas:
  displayConfig?.canvas &&
  typeof displayConfig.canvas === "object" &&
  Array.isArray(displayConfig.canvas.elements) &&
  displayConfig.canvas.elements.length > 0
    ? {
        ...DEFAULT_FORM_CANVAS_CONFIG,
        ...displayConfig.canvas,
        enabled: true,
        elements: displayConfig.canvas.elements,
      }
    : createDefaultWithOneCanvasConfig(),
  mapping:
    displayConfig && typeof displayConfig.mapping === "object" && displayConfig.mapping
      ? displayConfig.mapping
      : DEFAULT_AD_CONFIG.mapping,
  fields: Array.isArray(displayConfig?.fields)
    ? displayConfig.fields
    : DEFAULT_AD_CONFIG.fields,
};

const canvasEnabled = Boolean(safeDisplayConfig.canvas?.enabled);

const normalizedFields = useMemo(() => {
  const incoming = Array.isArray(safeDisplayConfig.fields)
    ? safeDisplayConfig.fields
    : [];

  const incomingMap = new Map(
    incoming.map((field) => [String(field.fieldKey), field])
  );

  const merged = DEFAULT_AD_CONFIG.fields.map((defaultField) => {
    const saved = incomingMap.get(defaultField.fieldKey);

    if (!saved) {
      return { ...defaultField };
    }

    return {
      ...defaultField,
      ...saved,
      fieldKey: defaultField.fieldKey,
      hidden: false,
      required:
        defaultField.fieldKey === "notes"
          ? Boolean(saved.required ?? defaultField.required)
          : defaultField.fieldKey === "channel"
          ? Boolean(saved.required ?? defaultField.required)
          : true,
      options:
        saved.type === "select"
          ? Array.isArray(saved.options) && saved.options.length > 0
            ? saved.options
            : defaultField.options || []
          : undefined,
    };
  });

  const extraFields = incoming.filter(
    (field) =>
      !DEFAULT_AD_CONFIG.fields.some(
        (defaultField) => defaultField.fieldKey === field.fieldKey
      )
  );

  return [...merged, ...extraFields].sort((a, b) => a.order - b.order);
}, [safeDisplayConfig.fields]);

const sortedFields = useMemo(
  () =>
    [...normalizedFields]
      .filter((field) => !field.hidden)
      .sort((a, b) => a.order - b.order),
  [normalizedFields]
);

  const normalizedPhone = useMemo(() => {
    return String(values.phone ?? "")
      .replace(/\D/g, "")
      .slice(0, 11);
  }, [values.phone]);

  const formattedPhone = useMemo(() => {
    const digits = String(values.phone ?? "")
      .replace(/\D/g, "")
      .slice(0, 11);

    if (digits.length < 4) return digits;
    if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }, [values.phone]);

  const callPhone = formQuery.data?.phone || "";
  const callHref = `tel:${callPhone}`;

const safeColor = /^#([0-9A-F]{3}){1,2}$/i.test(
  safeDisplayConfig.primaryColor || ""
)
  ? safeDisplayConfig.primaryColor
  : "#5fc065";


useEffect(() => {
  if (!editMode) {
    setUiDraft(uiConfig);
  }
}, [uiConfig, editMode]);

useEffect(() => {
  setValues((prev) => {
    const next = { ...prev };
    let changed = false;

    for (const field of normalizedFields) {
      if (field.fieldKey in next) continue;

      if (field.fieldKey === "channel") {
        next[field.fieldKey] =
          field.placeholder?.trim() ||
          field.label?.trim() ||
          "광고폼";
      } else {
        next[field.fieldKey] = field.type === "checkbox" ? false : "";
      }

      changed = true;
    }

    return changed ? next : prev;
  });
}, [normalizedFields]);

useEffect(() => {
  setValues((prev) => {
    const allowedKeys = new Set(
  normalizedFields.map((field) => field.fieldKey)
);
    const next: Record<string, any> = {};
    let changed = false;

    for (const [key, value] of Object.entries(prev)) {
      if (allowedKeys.has(key)) {
        next[key] = value;
      } else {
        changed = true;
      }
    }

    return changed ? next : prev;
  });
}, [normalizedFields]);

  useEffect(() => {
    setValues((prev) => {
      const next = { ...prev };

      if (!prev.channel || prev.channel === "광고폼") {
        const channelField = normalizedFields.find(
  (field) => field.fieldKey === "channel"
);

        next.channel =
          channelField?.placeholder?.trim() ||
          channelField?.label?.trim() ||
          "광고폼";
      }

      return next;
    });
}, [normalizedFields]);

const handleUploadUiImage = async (
  file: File,
  target: "logoUrl" | "heroImageUrl"
) => {
  try {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("이미지는 5MB 이하만 업로드할 수 있습니다.");
      return;
    }

    if (target === "logoUrl") {
      setIsUploadingLogo(true);
    } else {
      setIsUploadingHero(true);
    }

    const formData = new FormData();
    formData.append("file", file);

    const uploadRes = await fetch(
      "/api/upload",
      {
        method: "POST",
        body: formData,
        credentials: "include",
      }
    );

    if (!uploadRes.ok) {
      throw new Error("이미지 업로드에 실패했습니다.");
    }

    const uploaded = await uploadRes.json();
    const uploadedUrl = uploaded?.fileUrl || uploaded?.url || "";

    if (!uploadedUrl) {
      throw new Error("업로드 URL을 찾을 수 없습니다.");
    }

    setUiDraft((prev) => ({
      ...prev,
      [target]: uploadedUrl,
    }));

    toast.success(
      target === "logoUrl" ? "로고 업로드 완료" : "상단 이미지 업로드 완료"
    );
  } catch (err: any) {
    toast.error(err?.message || "이미지 업로드 중 오류가 발생했습니다.");
  } finally {
    setIsUploadingLogo(false);
    setIsUploadingHero(false);
  }
};

const handleUploadCanvasImage = async (file: File) => {
  if (file.size > 5 * 1024 * 1024) {
    toast.error("이미지는 5MB 이하만 업로드할 수 있습니다.");
    throw new Error("이미지는 5MB 이하만 업로드할 수 있습니다.");
  }

  const formData = new FormData();
  formData.append("file", file);

  const uploadRes = await fetch(
    "/api/upload",
    {
      method: "POST",
      body: formData,
      credentials: "include",
    }
  );

  if (!uploadRes.ok) {
    throw new Error("이미지 업로드에 실패했습니다.");
  }

  const uploaded = await uploadRes.json();
  const uploadedUrl = uploaded?.fileUrl || uploaded?.url || "";

  if (!uploadedUrl) {
    throw new Error("업로드 URL을 찾을 수 없습니다.");
  }

  toast.success("캔버스 이미지 업로드 완료");
  return normalizeAssetUrl(uploadedUrl);
};

  const updateValue = (fieldKey: string, nextValue: any) => {
    setValues((prev) => {
      if (prev[fieldKey] === nextValue) return prev;
      return { ...prev, [fieldKey]: nextValue };
    });
  };

  const validateBeforeSubmit = () => {
const clientName = String(values.clientName ?? "").trim();

if (!clientName) {
  alert("이름을 입력해주세요.");
  return false;
}

if (normalizedPhone.length < 10) {
  alert("전화번호를 정확히 입력해주세요.");
  return false;
}

if (!values.agreed) {
  alert(safeDisplayConfig.agreementText || "개인정보 수집 및 이용에 동의해주세요.");
  return false;
}
    for (const field of sortedFields) {
      const value = values[field.fieldKey];

      if (!field.required) continue;

      if (field.fieldKey === "agreed") {
        if (!value) {
          alert(safeDisplayConfig.agreementText || "개인정보 수집 및 이용에 동의해주세요.");
          return false;
        }
        continue;
      }

      if (field.fieldKey === "phone") {
        if (normalizedPhone.length < 10) {
          alert("전화번호를 정확히 입력해주세요.");
          return false;
        }
        continue;
      }

      if (String(value ?? "").trim() === "") {
        alert(`${field.label || "필수 항목"}을 입력해주세요.`);
        return false;
      }
    }

    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();

  if (submitMutation.isPending) return;
  if (!validateBeforeSubmit()) return;

  const mapping = {
  ...(safeDisplayConfig.mapping || {}),
  clientName: "clientName",
  phone: "phone",
  finalEducation: "finalEducation",
  desiredCourse: "desiredCourse",
  channel: "channel",
  notes: "notes",
};
  const payload: Record<string, any> = {
    token,
    formType: "ad",
  };

  Object.entries(values).forEach(([key, value]) => {
    const dbField = mapping[key];
    if (!dbField) return;
    if (key === "agreed") return;

    if (key === "phone") {
      payload[dbField] = normalizedPhone;
      return;
    }

    payload[dbField] = String(value ?? "").trim();
  });
payload.clientName = String(values.clientName ?? "").trim();
payload.phone = normalizedPhone;
payload.finalEducation = String(values.finalEducation ?? "").trim();
payload.desiredCourse = String(values.desiredCourse ?? "").trim();
payload.channel = String(values.channel ?? "").trim() || "광고폼";
payload.notes = String(values.notes ?? "").trim();

  submitMutation.mutate(payload as any);
};

const handleSaveMyUiConfig = () => {
  if (!canEdit) {
    toast.error("본인에게 배정된 페이지만 수정할 수 있습니다.");
    return;
  }

  const safeUiConfig: UiConfig = {
    ...DEFAULT_AD_CONFIG,
    ...uiDraft,
    canvas:
      uiDraft?.canvas && typeof uiDraft.canvas === "object"
        ? {
            ...DEFAULT_FORM_CANVAS_CONFIG,
            ...uiDraft.canvas,
            elements: Array.isArray(uiDraft.canvas.elements)
              ? uiDraft.canvas.elements
              : [],
          }
        : DEFAULT_FORM_CANVAS_CONFIG,
    mapping:
      uiDraft?.mapping && typeof uiDraft.mapping === "object"
        ? uiDraft.mapping
        : DEFAULT_AD_CONFIG.mapping,
    fields: Array.isArray(uiDraft?.fields)
      ? uiDraft.fields
      : DEFAULT_AD_CONFIG.fields,
  };

  saveMyUiConfigMutation.mutate({
    token,
    formType: "ad",
    uiConfig: safeUiConfig,
  });
};



const handleApplyTemplateByName = (templateName: string) => {
  const safeName = String(templateName || "").trim();

  if (!safeName) {
    toast.error("적용할 템플릿을 선택해주세요.");
    return;
  }

  setSelectedTemplateName(safeName);

applyTemplateMutation.mutate({
    formType: "ad",
    templateName: safeName,
    targetToken: token,
  });
};
  const renderField = (field: any) => {
    const commonKey = field.fieldKey;
    const value = values[commonKey];

    if (field.type === "checkbox") {
      return (
        <label key={field.fieldKey} className="ad-form-agree">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => updateValue(field.fieldKey, e.target.checked)}
          />
          <span>{safeDisplayConfig.agreementText || field.label}</span>
        </label>
      );
    }

    if (field.type === "textarea") {
      return (
        <textarea
          key={field.fieldKey}
          className="ad-form-textarea"
          value={String(value ?? "")}
          onChange={(e) => updateValue(field.fieldKey, e.target.value)}
          placeholder={field.placeholder || field.label}
        />
      );
    }

    if (field.type === "select") {
      return (
        <select
          key={field.fieldKey}
          className="premium-select"
          value={String(value ?? "")}
          onChange={(e) => updateValue(field.fieldKey, e.target.value)}
        >
          <option value="">{field.placeholder || `${field.label} 선택`}</option>
          {(field.options || []).map((option) => (
            <option key={`${field.fieldKey}-${option.value}`} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
    }

    if (field.fieldKey === "phone") {
      return (
        <input
          key={field.fieldKey}
          className="premium-input"
          value={formattedPhone}
          onChange={(e) => updateValue(field.fieldKey, e.target.value)}
          placeholder={field.placeholder || field.label}
          inputMode="numeric"
          autoComplete="tel"
        />
      );
    }

    return (
      <input
        key={field.fieldKey}
        className="premium-input"
        value={String(value ?? "")}
        onChange={(e) => updateValue(field.fieldKey, e.target.value)}
        placeholder={field.placeholder || field.label}
        autoComplete={field.fieldKey === "clientName" ? "name" : "off"}
      />
    );
  };

  if (formQuery.isLoading) {
    return <div className="ad-form-loading">불러오는 중...</div>;
  }

  if (!token || !formQuery.data?.ok) {
    return <div className="ad-form-loading">유효하지 않은 광고폼 링크입니다.</div>;
  }

  if (canEdit && editMode) {
    return (
      <FullScreenFormCanvasEditor
        value={uiDraft}
        onChange={setUiDraft}
        onSave={handleSaveMyUiConfig}
        onClose={() => setEditMode(false)}
        onUploadCanvasImage={handleUploadCanvasImage}
      />
    );
  }
 return (
  <div
    className="ad-form-page"
    style={
      canvasEnabled
        ? {
            width: "100%",
            maxWidth: "none",
            padding: 0,
            margin: 0,
            overflowX: "hidden",
            background: "#f3f4f6",
          }
        : undefined
    }
  >
    {canEdit ? (
      <div
        style={{
          position: canvasEnabled ? "fixed" : "static",
          top: canvasEnabled ? 24 : undefined,
          right: canvasEnabled ? 24 : undefined,
          zIndex: canvasEnabled ? 30 : undefined,
          display: "flex",
          justifyContent: "flex-end",
          padding: canvasEnabled ? 0 : "16px",
        }}
      >
        <button
          type="button"
          className="premium-submit-button"
          style={{
            width: "auto",
            padding: "10px 14px",
            backgroundColor: editMode ? "#334155" : safeColor,
          }}
          onClick={() => setEditMode(true)}
        >
          내 페이지 꾸미기
        </button>
      </div>
    ) : null}

    {canvasEnabled ? (
  <div
    id="public-ad-form-section"
    className="mx-auto w-full max-w-xl px-4 pt-8 pb-10"
  >
    <form className="premium-form-card" onSubmit={handleSubmit}>
      <div className="mb-4">
        <h2 className="text-xl font-bold">
          {safeDisplayConfig.title || "학점은행제 맞춤 상담 신청"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {safeDisplayConfig.subtitle ||
            "전문 담당자가 학습 상황에 맞춰 무료로 안내드립니다."}
        </p>
      </div>

      {sortedFields.map(renderField)}

      <button
        type="submit"
        className="premium-submit-button"
        style={{ backgroundColor: safeColor }}
        disabled={submitMutation.isPending}
      >
        {submitMutation.isPending
          ? "접수 중..."
          : safeDisplayConfig.submitButtonText || "무료 상담 신청하기"}
      </button>
    </form>
  </div>
) : null}

    {!canvasEnabled ? (
      <>
        <div className="ad-form-hero">
          <div className="ad-form-hero-inner">
            <div className="ad-form-header">
              <h1 className="ad-form-title">
                <span className="ad-form-title-inner">
                  {safeDisplayConfig.logoUrl ? (
                    <img
                      src={safeDisplayConfig.logoUrl}
                      alt="폼 로고"
                      className="ad-form-logo"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : null}
                  {safeDisplayConfig.title.split(",")[0]?.trim() ||
                    safeDisplayConfig.title}
                </span>

                {safeDisplayConfig.title.includes(",") ? (
                  <>
                    <br />
                    {safeDisplayConfig.title.split(",").slice(1).join(",").trim()}
                  </>
                ) : null}
              </h1>

              <p className="ad-form-subtitle">{safeDisplayConfig.subtitle}</p>
            </div>

            {safeDisplayConfig.heroImageUrl ? (
              <div style={{ marginTop: 16 }}>
                <img
                  src={safeDisplayConfig.heroImageUrl}
                  alt="상단 이미지"
                  style={{
                    width: "100%",
                    maxWidth: 720,
                    borderRadius: 20,
                    display: "block",
                    margin: "0 auto",
                  }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>

        <div className="ad-form-content">
          <section className="ad-form-section">
            <h2>{safeDisplayConfig.title}</h2>
            <p>{safeDisplayConfig.subtitle}</p>
          </section>

          <section className="ad-form-section spacer"></section>
        </div>

       <div style={{ maxWidth: 720, margin: "24px auto 0", padding: "0 16px" }}>
  {done ? (
    <div className="ad-form-success">
      상담 신청이 접수되었습니다.
      <br />
      순차적으로 연락드리겠습니다.
    </div>
  ) : (
    <form className="premium-form-card" onSubmit={handleSubmit}>
      {sortedFields.map(renderField)}

      <button
        type="submit"
        className="premium-submit-button"
        style={{ backgroundColor: safeColor }}
        disabled={submitMutation.isPending}
      >
        {submitMutation.isPending
          ? "접수 중..."
          : safeDisplayConfig.submitButtonText || "무료 상담 신청하기"}
      </button>
    </form>
  )}
</div>
      </>
    ) : null}
  </div>
);
}