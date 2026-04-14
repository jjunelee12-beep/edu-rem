import { useEffect, useMemo, useState } from "react";
import FormDesignEditor from "@/components/forms/FormDesignEditor";
import { type UiConfig } from "@/lib/formDesign/shared";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import "@/styles/ad-form.css";

const DEFAULT_AD_CONFIG: UiConfig = {
  title: "목표를 향한 배움의 길, 위드원 교육이 함께할게요",
  subtitle: "상담은 100% 무료로 진행됩니다.",
  logoUrl: "/images/logo.png",
  heroImageUrl: "",
  primaryColor: "#5fc065",
  submitButtonText: "1:1 맞춤 상담 받기",
  agreementText: "개인정보 수집 및 이용에 동의합니다.",
  layoutType: "bottomSheet",
  description: "",
  tags: "",
  isPinned: false,
  lastUsedAt: "",
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
  const [openSheet, setOpenSheet] = useState(false);

const [editMode, setEditMode] = useState(false);
const [uiDraft, setUiDraft] = useState<UiConfig>(DEFAULT_AD_CONFIG);



const [templateName, setTemplateName] = useState("");
const [selectedTemplateName, setSelectedTemplateName] = useState("");
const [renameTemplateName, setRenameTemplateName] = useState("");
const [duplicateTemplateName, setDuplicateTemplateName] = useState("");

const [isUploadingLogo, setIsUploadingLogo] = useState(false);
const [isUploadingHero, setIsUploadingHero] = useState(false);

  const formQuery = trpc.publicForm.getByToken.useQuery(
    { token, formType: "ad" },
    { enabled: !!token }
  );


  const submitMutation = trpc.publicForm.submit.useMutation({
    onSuccess: () => {
      setDone(true);
      setOpenSheet(false);
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
    setTemplateName("");
  },
  onError: (err) => {
    toast.error(err.message || "템플릿 저장 중 오류가 발생했습니다.");
  },
});

const applyTemplateMutation = trpc.formAdmin.applyTemplateToMyForm.useMutation({
  onSuccess: async () => {
  const preview = templatePreviewQuery.data?.uiConfig;

  if (selectedTemplateName.trim() && preview) {
    touchTemplateMutation.mutate({
      formType: "ad",
      templateName: selectedTemplateName.trim(),
      uiConfig: {
        ...preview,
        lastUsedAt: new Date().toISOString(),
      },
    });
  }

  toast.success("템플릿을 현재 페이지에 적용했습니다.");

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
    setSelectedTemplateName(renameTemplateName.trim());
    setRenameTemplateName("");
  },
  onError: (err) => {
    toast.error(err.message || "템플릿 이름 변경 중 오류가 발생했습니다.");
  },
});

const duplicateTemplateMutation = trpc.formAdmin.duplicateTemplate.useMutation({
  onSuccess: async () => {
    toast.success("템플릿을 복제했습니다.");
    await templateListQuery.refetch();
    setSelectedTemplateName(duplicateTemplateName.trim());
    setDuplicateTemplateName("");
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
  mapping:
    displayConfig && typeof displayConfig.mapping === "object" && displayConfig.mapping
      ? displayConfig.mapping
      : DEFAULT_AD_CONFIG.mapping,
  fields: Array.isArray(displayConfig?.fields)
    ? displayConfig.fields
    : DEFAULT_AD_CONFIG.fields,
};

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
      `${import.meta.env.VITE_API_BASE_URL || ""}/api/upload`,
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

  const updateValue = (fieldKey: string, nextValue: any) => {
    setValues((prev) => {
      if (prev[fieldKey] === nextValue) return prev;
      return { ...prev, [fieldKey]: nextValue };
    });
  };

  const validateBeforeSubmit = () => {
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

  const fallbackMap = {
    clientName: "clientName",
    phone: "phone",
    finalEducation: "finalEducation",
    desiredCourse: "desiredCourse",
    channel: "channel",
    notes: "notes",
  };

const mapping = {
  ...fallbackMap,
  ...(safeDisplayConfig.mapping || {}),
  clientName:
    safeDisplayConfig.mapping?.clientName || "clientName",
  phone:
    safeDisplayConfig.mapping?.phone || "phone",
  finalEducation:
    safeDisplayConfig.mapping?.finalEducation || "finalEducation",
  desiredCourse:
    safeDisplayConfig.mapping?.desiredCourse || "desiredCourse",
  channel:
    safeDisplayConfig.mapping?.channel || "channel",
  notes:
    safeDisplayConfig.mapping?.notes || "notes",
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

  submitMutation.mutate(payload as any);
};

const handleSaveMyUiConfig = () => {
  if (!canEdit) {
    toast.error("본인에게 배정된 페이지만 수정할 수 있습니다.");
    return;
  }

  saveMyUiConfigMutation.mutate({
    token,
    formType: "ad",
    uiConfig: uiDraft,
  });
};

const handleSaveAsTemplate = () => {
  const safeName = templateName.trim();

  if (!safeName) {
    toast.error("템플릿 이름을 입력해주세요.");
    return;
  }

  const exists = (templateListQuery.data || []).some(
    (tpl: any) => String(tpl.templateName || "").trim().toLowerCase() === safeName.toLowerCase()
  );

  if (exists) {
    const ok = window.confirm(
      `"${safeName}" 템플릿이 이미 있습니다. 덮어쓸까요?`
    );
    if (!ok) return;
  }


  saveAsTemplateMutation.mutate({
  formType: "ad",
  templateName: safeName,
  uiConfig: uiDraft,
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

const handleDeleteTemplate = () => {
  const safeName = selectedTemplateName.trim();

  if (!safeName) {
    toast.error("삭제할 템플릿을 선택해주세요.");
    return;
  }

  const ok = window.confirm(`선택한 템플릿 "${safeName}" 을(를) 삭제할까요?`);
  if (!ok) return;

  deleteTemplateMutation.mutate({
    formType: "ad",
    templateName: safeName,
  });
};

const handleRenameTemplate = () => {
  const oldName = selectedTemplateName.trim();
  const newName = renameTemplateName.trim();

  if (!oldName) {
    toast.error("이름을 변경할 템플릿을 선택해주세요.");
    return;
  }

  if (!newName) {
    toast.error("새 템플릿 이름을 입력해주세요.");
    return;
  }

  if (oldName.toLowerCase() === newName.toLowerCase()) {
    toast.error("기존 이름과 다른 이름을 입력해주세요.");
    return;
  }

  const exists = (templateListQuery.data || []).some(
    (tpl: any) =>
      String(tpl.templateName || "").trim().toLowerCase() ===
      newName.toLowerCase()
  );

  if (exists) {
    toast.error("같은 이름의 템플릿이 이미 존재합니다.");
    return;
  }

  renameTemplateMutation.mutate({
    formType: "ad",
    oldTemplateName: oldName,
    newTemplateName: newName,
  });
};

const handleDuplicateTemplate = () => {
  const sourceName = selectedTemplateName.trim();
  const newName = duplicateTemplateName.trim();

  if (!sourceName) {
    toast.error("복제할 템플릿을 선택해주세요.");
    return;
  }

  if (!newName) {
    toast.error("복제할 새 템플릿 이름을 입력해주세요.");
    return;
  }

  if (sourceName.toLowerCase() === newName.toLowerCase()) {
    toast.error("기존 이름과 다른 새 이름을 입력해주세요.");
    return;
  }

  const exists = (templateListQuery.data || []).some(
    (tpl: any) =>
      String(tpl.templateName || "").trim().toLowerCase() ===
      newName.toLowerCase()
  );

  if (exists) {
    toast.error("같은 이름의 템플릿이 이미 존재합니다.");
    return;
  }

  duplicateTemplateMutation.mutate({
    formType: "ad",
    sourceTemplateName: sourceName,
    newTemplateName: newName,
  });
};

const handleTogglePinTemplate = () => {
  const safeName = selectedTemplateName.trim();

  if (!safeName) {
    toast.error("고정 상태를 변경할 템플릿을 선택해주세요.");
    return;
  }

  const preview = templatePreviewQuery.data?.uiConfig;
  if (!preview) {
    toast.error("템플릿 정보를 먼저 불러와주세요.");
    return;
  }

  pinTemplateMutation.mutate({
    formType: "ad",
    templateName: safeName,
    uiConfig: {
      ...preview,
      isPinned: !Boolean(preview.isPinned),
    },
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

  return (
    <div className="ad-form-page">
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
                {safeDisplayConfig.title.split(",")[0]?.trim() || safeDisplayConfig.title}
              </span>
              {safeDisplayConfig.title.includes(",") ? (
                <>
                  <br />
                  {safeDisplayConfig.title.split(",").slice(1).join(",").trim()}
                </>
              ) : null}
            </h1>

            <p className="ad-form-subtitle">
              {safeDisplayConfig.subtitle}
            </p>
          </div>

{canEdit ? (
  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
    <button
      type="button"
      className="premium-submit-button"
      style={{
        width: "auto",
        padding: "10px 14px",
        backgroundColor: editMode ? "#334155" : safeColor,
      }}
      onClick={() => setEditMode((prev) => !prev)}
    >
      {editMode ? "꾸미기 닫기" : "내 페이지 꾸미기"}
    </button>
  </div>
) : null}

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

{canEdit && editMode ? (
  <div style={{ marginTop: 16, maxWidth: 720, marginLeft: "auto", marginRight: "auto" }}>
    <FormDesignEditor
      mode="ad"
      title="광고페이지"
      value={uiDraft}
      onChange={setUiDraft}
      canManageTemplates={true}
      templateList={templateListQuery.data || []}
      selectedTemplateName={selectedTemplateName}
      onSelectedTemplateNameChange={setSelectedTemplateName}
      onSave={handleSaveMyUiConfig}
      onSaveAsTemplate={(name) => {
        setTemplateName(name);
      }}
      onApplyTemplate={(name) => {
        handleApplyTemplateByName(name);
      }}
      onDeleteTemplate={(name) => {
        setSelectedTemplateName(name);
        handleDeleteTemplate();
      }}
      onRenameTemplate={(oldName, newName) => {
        setSelectedTemplateName(oldName);
        setRenameTemplateName(newName);
        handleRenameTemplate();
      }}
      onDuplicateTemplate={(sourceName, newName) => {
        setSelectedTemplateName(sourceName);
        setDuplicateTemplateName(newName);
        handleDuplicateTemplate();
      }}
      onTogglePinTemplate={(name) => {
        setSelectedTemplateName(name);
        handleTogglePinTemplate();
      }}
      isSaving={saveMyUiConfigMutation.isPending}
      isUploadingLogo={isUploadingLogo}
      isUploadingHero={isUploadingHero}
      onUploadImage={handleUploadUiImage}
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
	{safeDisplayConfig.layoutType === "bottomSheet" ? (
  <>
    <div className="ad-form-bottom-bar">
      <a
        href={callPhone ? callHref : undefined}
        className={`ad-form-call-btn ${!callPhone ? "is-disabled" : ""}`}
        onClick={(e) => {
          if (!callPhone) {
            e.preventDefault();
            alert("직원 전화번호가 등록되어 있지 않습니다.");
          }
        }}
      >
        빠른 전화하기
      </a>

      <button
        type="button"
        className="ad-form-apply-btn"
        style={{ backgroundColor: safeColor }}
        onClick={() => setOpenSheet(true)}
      >
        상담 신청
      </button>
    </div>

    <div
      className={`ad-form-sheet-backdrop ${openSheet ? "open" : ""}`}
      onClick={() => setOpenSheet(false)}
    />

    <div className={`ad-form-sheet ${openSheet ? "open" : ""}`}>
      <div className="ad-form-sheet-header">
        <h3>{safeDisplayConfig.submitButtonText || "상담 신청"}</h3>
        <button type="button" onClick={() => setOpenSheet(false)}>
          닫기
        </button>
      </div>

      {done ? (
        <div className="ad-form-success">
          상담 신청이 접수되었습니다.
          <br />
          순차적으로 연락드리겠습니다.
        </div>
      ) : (
        <form className="ad-form-sheet-body" onSubmit={handleSubmit}>
          {sortedFields.map(renderField)}

          <button
            type="submit"
            className="premium-submit-button"
            style={{ backgroundColor: safeColor }}
            disabled={submitMutation.isPending}
          >
            {submitMutation.isPending
              ? "접수 중..."
              : safeDisplayConfig.submitButtonText || "1:1 맞춤 상담 받기"}
          </button>
        </form>
      )}
    </div>
  </>
) : (
  <div style={{ maxWidth: 720, margin: "24px auto 0", padding: "0 16px" }}>
    {done ? (
      <div className="ad-form-success">
        상담 신청이 접수되었습니다.
        <br />
        순차적으로 연락드리겠습니다.
      </div>
    ) : (
      <form className="ad-form-sheet-body" onSubmit={handleSubmit}>
        {sortedFields.map(renderField)}

        <button
          type="submit"
          className="premium-submit-button"
          style={{ backgroundColor: safeColor }}
          disabled={submitMutation.isPending}
        >
          {submitMutation.isPending
            ? "접수 중..."
            : safeDisplayConfig.submitButtonText || "1:1 맞춤 상담 받기"}
        </button>
      </form>
    )}
  </div>
)}
     </div> 
  );
}