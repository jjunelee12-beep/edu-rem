import { useEffect, useMemo, useState } from "react";
import FormDesignEditor from "@/components/forms/FormDesignEditor";
import { type UiConfig } from "@/lib/formDesign/shared";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";
import "@/styles/public-lead-form.css";
import "@/styles/ad-form.css";

const DEFAULT_LEAD_CONFIG: UiConfig = {
  title: "목표를 향한 배움의 길, 위드원 교육이 함께할게요",
  subtitle: "상담은 100% 무료로 진행됩니다.",
  logoUrl: "/images/logo.png",
  heroImageUrl: "",
  primaryColor: "#5fc065",
  submitButtonText: "1:1 맞춤 상담 받기",
  agreementText: "개인정보 수집 및 이용에 동의합니다.",
  layoutType: "card",
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
        { label: "청소년지도사", value: "청소년지도사" },
        { label: "산업기사/기사", value: "산업기사/기사" },
        { label: "전문학사/학사", value: "전문학사/학사" },
        { label: "기타", value: "기타" },
      ],
    },
    {
      fieldKey: "channel",
      label: "문의경로",
      placeholder: "문의경로 (예. 블로그, 인스타, 지인추천)",
      required: true,
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

export default function PublicLeadFormPage() {
  const [match, params] = useRoute("/form/:token");
const { user } = useAuth();
const utils = trpc.useUtils();
  const token = match ? params.token : "";

  const [values, setValues] = useState<Record<string, any>>({
    clientName: "",
    phone: "",
    finalEducation: "",
    desiredCourse: "",
    channel: "",
    notes: "",
    agreed: false,
  });

  const [done, setDone] = useState(false);
const [openSheet, setOpenSheet] = useState(false);
const [editMode, setEditMode] = useState(false);
const [uiDraft, setUiDraft] = useState<UiConfig>(DEFAULT_LEAD_CONFIG);


const [templateName, setTemplateName] = useState("");
const [selectedTemplateName, setSelectedTemplateName] = useState("");
const [renameTemplateName, setRenameTemplateName] = useState("");
const [duplicateTemplateName, setDuplicateTemplateName] = useState("");

const [isUploadingLogo, setIsUploadingLogo] = useState(false);
const [isUploadingHero, setIsUploadingHero] = useState(false);

  const formQuery = trpc.publicForm.getByToken.useQuery(
    { token, formType: "landing" },
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
    toast.success("내 랜딩페이지 꾸미기가 저장되었습니다.");
    await utils.publicForm.getByToken.invalidate({
      token,
      formType: "landing",
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
      formType: "landing",
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
    formType: "landing",
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
  () => (formQuery.data?.uiConfig as UiConfig) || DEFAULT_LEAD_CONFIG,
  [formQuery.data?.uiConfig]
);

const canEdit =
  !!user &&
  !!formQuery.data?.ok &&
  Number(formQuery.data?.assigneeId) === Number(user.id);

const templateListQuery = trpc.formAdmin.listTemplates.useQuery(
  { formType: "landing" },
  { enabled: canEdit }
);

const templatePreviewQuery = trpc.formAdmin.getNamedTemplate.useQuery(
  {
    formType: "landing",
    templateName: selectedTemplateName,
  },
  {
    enabled: !!canEdit && !!selectedTemplateName,
  }
);

const displayConfig = editMode ? uiDraft : uiConfig;




  const sortedFields = useMemo(
  () =>
    [...displayConfig.fields]
      .filter((field) => !field.hidden)
      .sort((a, b) => a.order - b.order),
  [displayConfig.fields]
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

const safeColor = /^#([0-9A-F]{3}){1,2}$/i.test(displayConfig.primaryColor || "")
  ? displayConfig.primaryColor
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

    for (const field of displayConfig.fields) {
      if (field.fieldKey in next) continue;

      next[field.fieldKey] = field.type === "checkbox" ? false : "";
      changed = true;
    }

    return changed ? next : prev;
  });
}, [displayConfig.fields]);

useEffect(() => {
  setValues((prev) => {
    const allowedKeys = new Set(displayConfig.fields.map((field) => field.fieldKey));
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
}, [displayConfig.fields]);

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
          alert(displayConfig.agreementText || "개인정보 수집 및 이용에 동의해주세요.");
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
  ...(displayConfig.mapping || {}),
};

  const payload: Record<string, any> = {
    token,
    formType: "landing",
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
    formType: "landing",
    uiConfig: uiDraft,
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
    formType: "landing",
    templateName: safeName,
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
    formType: "landing",
    templateName: safeName,
    targetToken: token,
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
    formType: "landing",
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
    formType: "landing",
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
    formType: "landing",
    templateName: safeName,
    uiConfig: {
      ...preview,
      isPinned: !Boolean(preview.isPinned),
    },
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
  formType: "landing",
  templateName: safeName,
  uiConfig: uiDraft,
});
};


  const renderField = (field: any) => {
    const value = values[field.fieldKey];

    if (field.type === "checkbox") {
      return (
        <label key={field.fieldKey} className="lead-form-agree">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => updateValue(field.fieldKey, e.target.checked)}
          />
          <span>{displayConfig.agreementText || field.label}</span>
        </label>
      );
    }

    if (field.type === "textarea") {
      return (
        <textarea
          key={field.fieldKey}
          className="lead-form-textarea"
          value={String(value ?? "")}
          onChange={(e) => updateValue(field.fieldKey, e.target.value)}
          placeholder={field.placeholder || field.label}
        />
      );
    }

    if (field.type === "select") {
      return (
        <div key={field.fieldKey} className="lead-form-select-wrap">
          <select
            className="lead-form-select"
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
          <span className="lead-form-select-arrow">⌄</span>
        </div>
      );
    }

    if (field.fieldKey === "phone") {
      return (
        <input
          key={field.fieldKey}
          className=" premium-input"
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
        className=" premium-input"
        value={String(value ?? "")}
        onChange={(e) => updateValue(field.fieldKey, e.target.value)}
        placeholder={field.placeholder || field.label}
        autoComplete={field.fieldKey === "clientName" ? "name" : "off"}
      />
    );
  };

  if (formQuery.isLoading) {
    return (
      <PageShell>
        <div className="lead-form-state-box">
          <h2 className="lead-form-state-title">불러오는 중입니다...</h2>
          <p className="lead-form-state-text">잠시만 기다려주세요.</p>
        </div>
      </PageShell>
    );
  }

  if (!token || !formQuery.data?.ok) {
    return (
      <PageShell>
        <div className="lead-form-state-box">
          <h2 className="lead-form-state-title">유효하지 않은 링크입니다.</h2>
          <p className="lead-form-state-text">관리자에게 문의해주세요.</p>
        </div>
      </PageShell>
    );
  }

  if (done) {
    return (
      <PageShell>
        <div className="lead-form-state-box">
          <h2 className="lead-form-state-title">상담 신청이 접수되었습니다.</h2>
          <p className="lead-form-state-text">
            순차적으로 확인 후 빠르게 연락드리겠습니다.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div className="lead-form-card">
        <div className="lead-form-header">
  <h1 className="lead-form-title">
    <span className="lead-form-title-line lead-form-title-line--first">
      {displayConfig.logoUrl ? (
        <img
          src={displayConfig.logoUrl}
          alt="폼 로고"
          className="lead-form-logo"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : null}
      <span>{displayConfig.title.split(",")[0]?.trim() || displayConfig.title}</span>
    </span>

    {displayConfig.title.includes(",") ? (
      <span className="lead-form-title-line">
        {displayConfig.title.split(",").slice(1).join(",").trim()}
      </span>
    ) : null}
  </h1>

  <p className="lead-form-subtitle">{displayConfig.subtitle}</p>
</div>

{canEdit ? (
  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
    <button
      type="button"
      className="premium-submit-button"
      style={{
        backgroundColor: editMode ? "#334155" : safeColor,
        width: "auto",
        padding: "12px 18px",
      }}
      onClick={() => setEditMode((prev) => !prev)}
    >
      {editMode ? "꾸미기 닫기" : "내 페이지 꾸미기"}
    </button>
  </div>
) : null}

        {displayConfig.heroImageUrl ? (
  <div style={{ marginBottom: 16 }}>
    <img
      src={displayConfig.heroImageUrl}
      alt="상단 이미지"
      style={{
        width: "100%",
        borderRadius: 20,
        display: "block",
      }}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = "none";
      }}
    />
  </div>
) : null}

{canEdit && editMode ? (
  <div style={{ marginBottom: 20 }}>
    <FormDesignEditor
      mode="landing"
      title="랜딩페이지"
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

        {displayConfig.layoutType === "card" ? (
  <form className="lead-form-body" onSubmit={handleSubmit}>
    {sortedFields.map(renderField)}

    <button
      type="submit"
      className="premium-submit-button"
      style={{ backgroundColor: safeColor }}
      disabled={submitMutation.isPending}
    >
      {submitMutation.isPending
        ? "접수 중..."
        : displayConfig.submitButtonText || "1:1 맞춤 상담 받기"}
    </button>
  </form>
) : (
  <>
    <div style={{ display: "flex", justifyContent: "center", marginTop: 16 }}>
      <button
        type="button"
        className="premium-submit-button"
        style={{ backgroundColor: safeColor, maxWidth: 420 }}
        onClick={() => setOpenSheet(true)}
      >
        {displayConfig.submitButtonText || "1:1 맞춤 상담 받기"}
      </button>
    </div>

    <div
      className={`ad-form-sheet-backdrop ${openSheet ? "open" : ""}`}
      onClick={() => setOpenSheet(false)}
    />

    <div className={`ad-form-sheet ${openSheet ? "open" : ""}`}>
      <div className="ad-form-sheet-header">
        <h3>{displayConfig.submitButtonText || "상담 신청"}</h3>
        <button type="button" onClick={() => setOpenSheet(false)}>
          닫기
        </button>
      </div>

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
            : displayConfig.submitButtonText || "1:1 맞춤 상담 받기"}
        </button>
      </form>
    </div>
  </>
)}
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="lead-form-page">{children}</div>;
}