import { useEffect, useMemo, useState, type CSSProperties } from "react";
import {
  createDefaultCompanyCanvasConfig,
  type FormCanvasConfig,
  type FormCanvasElement,
} from "@/lib/formDesign/canvasTypes";
import { normalizeAssetUrl } from "@/lib/normalizeAssetUrl";

type Props = {
  canvas?: FormCanvasConfig;
  onOpenForm?: () => void;
  onTel?: () => void;
  scale?: number;
  maxWidth?: number;
  renderForm?: () => React.ReactNode;

  values?: Record<string, any>;
  fields?: any[];
  onValueChange?: (fieldKey: string, value: any) => void;
  onSubmit?: () => void;
  isSubmitting?: boolean;
};

const REQUIRED_FIELD_KEYS = [
  "clientName",
  "phone",
  "finalEducation",
  "desiredCourse",
  "channel",
  "notes",
  "agreed",
];

const FIELD_LABELS: Record<string, string> = {
  clientName: "이름",
  phone: "전화번호",
  finalEducation: "최종학력",
  desiredCourse: "희망과정",
  channel: "문의경로",
  notes: "상담내용",
  agreed: "개인정보 수집 및 이용에 동의합니다.",
};

const FIELD_PLACEHOLDERS: Record<string, string> = {
  clientName: "이름",
  phone: "전화번호",
  finalEducation: "최종학력 선택",
  desiredCourse: "희망과정 선택",
  channel: "문의경로 (예. 블로그, 인스타, 지인추천)",
  notes: "진행하시면서 걱정되시는 부분 적어주세요!",
  agreed: "",
};

const FIELD_INPUT_TYPES: Record<string, string> = {
  clientName: "text",
  phone: "phone",
  finalEducation: "select",
  desiredCourse: "select",
  channel: "text",
  notes: "textarea",
  agreed: "checkbox",
};

const FIELD_VISUAL_TEXT_NEEDLES = [
  "이름",
  "이름을입력해주세요",
  "입력해주세요",
  "전화번호",
  "전화",
  "010",
  "0000",
  "최종학력",
  "학력",
  "최종학력선택",
  "선택",
  "희망과정",
  "희망과정선택",
  "과정",
  "문의경로",
  "문의경로입력",
  "경로",
  "상담내용",
  "상담내역",
  "진행하시면서",
  "걱정",
  "적어주세요",
  "개인정보",
  "동의",
  "수집및이용",
  "블로그",
  "인스타",
  "지인추천",
];

function normalizeCanvas(value?: FormCanvasConfig): FormCanvasConfig {
  const defaultCanvas = createDefaultCompanyCanvasConfig();

  return {
    ...defaultCanvas,
    ...(value || {}),
    enabled: value?.enabled ?? defaultCanvas.enabled,
    elements: Array.isArray(value?.elements)
      ? value.elements
      : defaultCanvas.elements,
  };
}

function useWindowWidth() {
  const [width, setWidth] = useState(() =>
    typeof window === "undefined" ? 390 : window.innerWidth
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleResize = () => setWidth(window.innerWidth);
    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return width;
}

const normalizeText = (value: any) =>
  String(value || "")
    .replace(/\s/g, "")
    .toLowerCase();

const getFieldKey = (element: any) => String(element?.fieldKey || "").trim();

const pickBestElement = (items: any[]) => {
  return [...items].sort((a, b) => {
    const areaA = Number(a.width || 0) * Number(a.height || 0);
    const areaB = Number(b.width || 0) * Number(b.height || 0);

    if (areaA !== areaB) return areaB - areaA;
    return Number(b.zIndex || 0) - Number(a.zIndex || 0);
  })[0];
};

export default function FormCanvasRenderer({
  canvas: rawCanvas,
  onOpenForm,
  onTel,
  scale: overrideScale,
  maxWidth,
  values = {},
  fields = [],
  onValueChange,
  onSubmit,
  isSubmitting = false,
}: Props) {
  const canvas = normalizeCanvas(rawCanvas);
  const windowWidth = useWindowWidth();
  const isMobile = windowWidth < 768;

  const scale = useMemo(() => {
  if (typeof overrideScale === "number") return overrideScale;

  const safeCanvasWidth = Math.max(1, Number(canvas.width) || 1080);
  const sidePadding = isMobile ? 20 : 48;
  const availableWidth = Math.max(320, windowWidth - sidePadding);

  if (typeof maxWidth === "number") {
    return Math.min(1, maxWidth / safeCanvasWidth);
  }

  return Math.min(1, availableWidth / safeCanvasWidth);
}, [overrideScale, canvas.width, isMobile, windowWidth, maxWidth]);

const renderScale = scale;
if (!canvas.enabled) return null;

const width = canvas.width * renderScale;
const height = canvas.height * renderScale;

  const visibleElements = canvas.elements.filter((element) => !element.hidden);

  const rawFormFields = visibleElements.filter(
    (element: any) => element.type === "formField"
  );

  const rawFormSubmits = visibleElements.filter(
    (element: any) => element.type === "formSubmit"
  );

  const hasUsableRawFormFields =
  rawFormFields.length >= 6 &&
  REQUIRED_FIELD_KEYS.slice(0, 6).every((key) =>
    rawFormFields.some(
      (field: any) =>
        getFieldKey(field) === key &&
        Number(field.width || 0) >= 240 &&
        Number(field.height || 0) >= 20
    )
  );

const hasRawFormFields = hasUsableRawFormFields;

  const visualElements = visibleElements.filter((element: any) => {
    return element.type !== "formField" && element.type !== "formSubmit";
  });

  const inputLikeVisualShapes = visualElements
    .filter((element: any) => {
      if (element.type !== "shape") return false;

      const w = Number(element.width || 0);
      const h = Number(element.height || 0);

      return w >= 240 && h >= 20 && h <= 280;
    })
    .sort((a: any, b: any) => Number(a.y || 0) - Number(b.y || 0));

  const isFieldLikeVisualText = (element: any) => {
    if (element.type !== "text") return false;

    const text = normalizeText(element.text);
    if (!text) return false;

    return FIELD_VISUAL_TEXT_NEEDLES.some((needle) =>
      text.includes(normalizeText(needle))
    );
  };

  const isFieldLikeVisualShape = (element: any) => {
    if (element.type !== "shape") return false;

    return inputLikeVisualShapes.some(
      (shape: any) => String(shape.id) === String(element.id)
    );
  };

const isPlaceholderLikeVisualText = (element: any) => {
  if (element.type !== "text") return false;

  const text = normalizeText(element.text);
  if (!text) return false;

  return [
    "이름을입력해주세요",
    "입력해주세요",
    "010",
    "0000",
    "최종학력선택",
    "희망과정선택",
    "문의경로입력",
    "블로그",
    "인스타",
    "지인추천",
        "진행하시면서",
    "걱정",
    "적어주세요",
    "개인정보수집및이용에동의합니다",
  ].some((needle) => text.includes(normalizeText(needle)));
};

  const defaultCanvasForForm = createDefaultCompanyCanvasConfig();

  const fallbackFormFields = defaultCanvasForForm.elements.filter(
    (element: any) => element.type === "formField"
  );

  const fallbackFormSubmits = defaultCanvasForForm.elements.filter(
    (element: any) => element.type === "formSubmit"
  );

  const rawFormFieldsByKey = new Map<string, any[]>();

  rawFormFields.forEach((element: any) => {
    const key = getFieldKey(element);
    if (!key) return;

    rawFormFieldsByKey.set(key, [
      ...(rawFormFieldsByKey.get(key) || []),
      element,
    ]);
  });

  const rawModeFormFields = REQUIRED_FIELD_KEYS.map((key) => {
    const picked = pickBestElement(rawFormFieldsByKey.get(key) || []);
    if (picked) return picked;

    return fallbackFormFields.find(
      (element: any) => getFieldKey(element) === key
    );
  }).filter(Boolean);

  const visualSubmitButton = visualElements.find((element: any) => {
    if (element.type !== "button") return false;

    const text = normalizeText(element.text);
    const action = String(element.action || "");

    return (
      action === "openForm" ||
      action === "submit" ||
      text.includes("상담") ||
      text.includes("신청") ||
      text.includes("받기")
    );
  });

  const submitElement = (() => {
    const rawSubmit = pickBestElement(rawFormSubmits);
    if (rawSubmit) return rawSubmit;

    if (visualSubmitButton) {
      return {
        id: "visual-button-as-submit",
        type: "formSubmit",
        text: (visualSubmitButton as any).text || "무료 상담 신청하기",
        x: Number((visualSubmitButton as any).x || 110),
        y: Number((visualSubmitButton as any).y || 1190),
        width: Number((visualSubmitButton as any).width || 860),
        height: Number((visualSubmitButton as any).height || 76),
        backgroundColor:
          (visualSubmitButton as any).backgroundColor || "#2563eb",
        color: (visualSubmitButton as any).color || "#ffffff",
        borderRadius: Number((visualSubmitButton as any).borderRadius || 18),
        fontSize: Number((visualSubmitButton as any).fontSize || 18),
        zIndex: 1000,
      } as FormCanvasElement;
    }

    return fallbackFormSubmits[0];
  })();

  const legacyVisualFormFields = REQUIRED_FIELD_KEYS.map((key, index) => {
  if (key === "agreed") {
    const notesShape = inputLikeVisualShapes[5];
    return {
      id: "legacy-field-agreed",
      type: "formField",
      fieldKey: "agreed",
      inputType: "checkbox",
      label: FIELD_LABELS.agreed,
      placeholder: "",
      x: Number(notesShape?.x ?? 110),
      y: Number(
        notesShape
          ? Number(notesShape.y || 0) + Number(notesShape.height || 0) + 24
          : 1120
      ),
      width: 860,
      height: 36,
      zIndex: 1000,
    } as any;
  }

  const shape = inputLikeVisualShapes[index];
  const fallback = fallbackFormFields.find(
    (element: any) => getFieldKey(element) === key
  );

  return {
    id: `legacy-field-${key}`,
    type: "formField",
    fieldKey: key,
    inputType: FIELD_INPUT_TYPES[key],
    label: "",
    placeholder: FIELD_PLACEHOLDERS[key],
    x: Number(shape?.x ?? fallback?.x ?? 110),
    y: Number(shape?.y ?? fallback?.y ?? 360 + index * 100),
    width: Number(shape?.width ?? fallback?.width ?? 860),
    height: Number(shape?.height ?? fallback?.height ?? 70),
    zIndex: 1000,
  } as any;
}).filter(Boolean);

const safeFormFields = hasRawFormFields
  ? rawModeFormFields
  : legacyVisualFormFields;

const formElements = [...safeFormFields, submitElement].filter(
  Boolean
) as FormCanvasElement[];

  const shouldHideLegacyFieldVisuals = true;
  const shouldHideVisualSubmitButton = Boolean(
    submitElement && visualSubmitButton
  );

  const getFieldMeta = (fieldKey: string) => {
    const field = fields.find((item: any) => String(item.fieldKey) === fieldKey);

    return {
      field,
      label: field?.label || FIELD_LABELS[fieldKey] || "",
      placeholder: field?.placeholder || FIELD_PLACEHOLDERS[fieldKey] || "",
      inputType: field?.type || FIELD_INPUT_TYPES[fieldKey] || "text",
      options: Array.isArray(field?.options) ? field.options : [],
    };
  };

  const updateFieldValue = (fieldKey: string, nextValue: any) => {
    if (fieldKey === "phone") {
      onValueChange?.(
        fieldKey,
        String(nextValue || "")
          .replace(/\D/g, "")
          .slice(0, 11)
      );
      return;
    }

    onValueChange?.(fieldKey, nextValue);
  };

  const handleButtonClick = (element: FormCanvasElement) => {
    if (element.type !== "button") return;

    if (element.action === "link" && element.href) {
      const href = element.href.startsWith("http")
        ? element.href
        : `https://${element.href}`;

      if ((element.target || "_blank") === "_self") {
        window.location.href = href;
        return;
      }

      window.open(href, "_blank", "noopener,noreferrer");
      return;
    }

    if (element.action === "tel") {
      const telNumber = String(element.telNumber || "").replace(/[^\d+]/g, "");

      if (telNumber) {
        window.location.href = `tel:${telNumber}`;
        return;
      }

      onTel?.();
      return;
    }

    if (element.action === "openForm" || element.action === "submit") {
      onSubmit?.();
    }
  };

  const renderFormElement = (element: FormCanvasElement) => {
    const baseStyle: CSSProperties = {
      position: "absolute",
      left: element.x * renderScale,
top: element.y * renderScale,
width: element.width * renderScale,
height: element.height * renderScale,
      zIndex: 1000 + Number((element as any).zIndex || 1),
      transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
      boxSizing: "border-box",
      pointerEvents: "auto",
    };

    if ((element as any).type === "formSubmit") {
      return (
        <button
          key={element.id}
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting}
          style={{
            ...baseStyle,
            border: "none",
            cursor: isSubmitting ? "not-allowed" : "pointer",
            backgroundColor: (element as any).backgroundColor || "#2563eb",
            color: (element as any).color || "#ffffff",
            borderRadius: Number((element as any).borderRadius || 18) * renderScale,
fontSize: Math.max(
  8,
  Number((element as any).fontSize || 18) * renderScale
),
            fontWeight: 900,
            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.18)",
          }}
        >
          {isSubmitting
            ? "접수 완료"
            : (element as any).text || "무료 상담 신청하기"}
        </button>
      );
    }

    if ((element as any).type !== "formField") return null;

    const fieldKey = getFieldKey(element);
    const { label, placeholder, inputType, options } = getFieldMeta(fieldKey);

    const value =
      fieldKey === "phone"
        ? String(values.phone ?? "")
        : fieldKey === "agreed"
          ? Boolean(values[fieldKey])
          : String(values[fieldKey] ?? "");

   const isLegacyVisualField = String((element as any).id || "").startsWith(
  "legacy-field-"
);

const labelText = String(
  (element as any).label || label || FIELD_LABELS[fieldKey] || ""
).trim();

const finalPlaceholder = String(
  (element as any).placeholder ||
    placeholder ||
    FIELD_PLACEHOLDERS[fieldKey] ||
    ""
).trim();

    if (inputType === "checkbox") {
      return (
        <label
          key={element.id}
          style={{
            ...baseStyle,
            display: "flex",
            alignItems: "center",
            gap: 8 * renderScale,
fontSize: Math.max(8, 14 * renderScale),
            color: "#334155",
            background: "transparent",
          }}
        >
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => updateFieldValue(fieldKey, e.target.checked)}
          />
         {labelText || FIELD_LABELS.agreed}
        </label>
      );
    }

    const labelHeight = labelText ? 26 * renderScale : 0;
const gap = labelText ? 6 * renderScale : 0;
const inputTop = labelHeight + gap;
const inputHeight = Math.max(18, element.height * renderScale - inputTop);

    const inputStyle: CSSProperties = {
      position: "absolute",
      left: 0,
      top: inputTop,
      width: "100%",
      height: inputHeight,
      boxSizing: "border-box",
      pointerEvents: "auto",
      userSelect: "text",
      WebkitUserSelect: "text",
      border: "1px solid #d1d5db",
      borderRadius: 12 * renderScale,
padding: `0 ${14 * renderScale}px`,
fontSize: Math.max(8, 16 * renderScale),
     background: "#f8fafc",
      color: "#111827",
    };

    const labelNode = labelText ? (
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: "100%",
          height: labelHeight,
          display: "flex",
          alignItems: "center",
          fontSize: Math.max(8, 15 * renderScale),
          fontWeight: 800,
          color: "#111827",
          pointerEvents: "none",
          lineHeight: 1,
          overflow: "hidden",
          whiteSpace: "nowrap",
        }}
      >
        {labelText}
      </div>
    ) : null;

    if (inputType === "textarea") {
      return (
        <div key={element.id} style={baseStyle}>
          {labelNode}
          <textarea
            value={String(value ?? "")}
            placeholder={finalPlaceholder}
            onChange={(e) => updateFieldValue(fieldKey, e.target.value)}
            style={{
              ...inputStyle,
              padding: 14 * renderScale,
             background: "#ffffff",
              resize: "none",
            }}
          />
        </div>
      );
    }

    if (inputType === "select") {
      return (
        <div key={element.id} style={baseStyle}>
          {labelNode}
          <select
            value={String(value ?? "")}
            onChange={(e) => updateFieldValue(fieldKey, e.target.value)}
            style={{
              ...inputStyle,
              background: "#ffffff",
              appearance: "auto",
              WebkitAppearance: "menulist",
            }}
          >
            <option value="">{finalPlaceholder || "선택"}</option>
            {options.map((option: any) => (
              <option key={`${fieldKey}-${option.value}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );
    }

    return (
      <div key={element.id} style={baseStyle}>
        {labelNode}
        <input
          value={String(value ?? "")}
          placeholder={finalPlaceholder}
          inputMode={fieldKey === "phone" ? "numeric" : undefined}
          autoComplete={
            fieldKey === "clientName"
              ? "name"
              : fieldKey === "phone"
                ? "tel"
                : "off"
          }
          onChange={(e) => updateFieldValue(fieldKey, e.target.value)}
          style={inputStyle}
        />
      </div>
    );
  };

  return (
    <div
      className="form-canvas-renderer-scroll"
      style={{
        width: "100%",
        display: "flex",
        justifyContent: "center",
        margin: 0,
        overflowX: isMobile ? "auto" : "hidden",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        padding: isMobile ? "10px" : "24px",
        minHeight: "100vh",
        background: "#f3f4f6",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "relative",
          width,
          height,
          overflow: "hidden",
          isolation: "isolate",
          borderRadius: isMobile ? 18 : 24,
          backgroundColor: canvas.backgroundColor || "#ffffff",
          boxShadow: "0 18px 50px rgba(15, 23, 42, 0.14)",
        }}
      >
        {visualElements.map((element) => {
          const baseStyle: CSSProperties = {
  position: "absolute",
  left: element.x * renderScale,
  top: element.y * renderScale,
  width: element.width * renderScale,
  height: element.height * renderScale,
            zIndex: Math.min(Number(element.zIndex ?? 1), 100),
            transform: element.rotation
              ? `rotate(${element.rotation}deg)`
              : undefined,
          };

          if (element.type === "text") {
  if (shouldHideLegacyFieldVisuals && isFieldLikeVisualText(element)) {
    return null;
  }

  if (!hasRawFormFields && isPlaceholderLikeVisualText(element)) {
    return null;
  }

            return (
              <div
                key={element.id}
                style={{
                  ...baseStyle,
                  pointerEvents: "none",
                  color: element.color,
                  fontSize: Math.max(8, element.fontSize * renderScale),
                  fontWeight: element.fontWeight,
                  fontFamily: element.fontFamily || "Pretendard, sans-serif",
                  textAlign: element.textAlign ?? "left",
                  lineHeight: 1.15,
                  whiteSpace: "pre-wrap",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  wordBreak: "keep-all",
                }}
              >
                {element.text}
              </div>
            );
          }

          if (element.type === "image") {
            if (!element.url) return null;

            return (
              <img
                key={element.id}
                src={normalizeAssetUrl(element.url)}
                alt=""
                style={{
                  ...baseStyle,
                  pointerEvents: "none",
                  objectFit: element.objectFit ?? "cover",
                  display: "block",
                  borderRadius:
                    Number((element as any).borderRadius || 0) * renderScale,
                }}
              />
            );
          }

          if (element.type === "button") {
            if (
              shouldHideVisualSubmitButton &&
              visualSubmitButton &&
              String(visualSubmitButton.id) === String(element.id)
            ) {
              return null;
            }

            const baseTransform = element.rotation
              ? `rotate(${element.rotation}deg)`
              : "";

            return (
              <button
                key={element.id}
                type="button"
                onClick={() => handleButtonClick(element)}
                style={{
                  ...baseStyle,
                  width: element.width * renderScale,
height: element.height * renderScale,
minHeight: undefined,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: element.backgroundColor,
                  color: element.color,
                  borderRadius: element.borderRadius * renderScale,
                  fontSize: Math.max(
  8,
  Number((element as any).fontSize || 34) * renderScale
),
                  fontWeight: Number((element as any).fontWeight || 900),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: `0 ${14 * renderScale}px`,
                  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.18)",
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation",
                  transform: baseTransform,
                }}
              >
                {element.text}
              </button>
            );
          }

          if (element.type === "shape") {
            if (shouldHideLegacyFieldVisuals && isFieldLikeVisualShape(element)) {
              return null;
            }

            return (
              <div
                key={element.id}
                style={{
                  ...baseStyle,
                  pointerEvents: "none",
                  backgroundColor: element.backgroundColor,
                  border:
                    element.borderWidth && element.borderColor
                      ? `${element.borderWidth * renderScale}px solid ${element.borderColor}`
                      : undefined,
                  borderRadius:
                    element.shape === "circle"
                      ? "999px"
                      : Number((element as any).borderRadius ?? 18) * renderScale,
                }}
              />
            );
          }

          if (element.type === "svg") {
            const stroke = element.stroke || "#64748b";
            const fill = element.fill || "#64748b";
            const strokeWidth = Number(element.strokeWidth || 8) * renderScale;

            return (
              <svg
                key={element.id}
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                style={{
                  ...baseStyle,
                  pointerEvents: "none",
                  overflow: "visible",
                }}
              >
                {element.svgName === "line" ? (
                  <line
                    x1="8"
                    y1="50"
                    x2="92"
                    y2="50"
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                  />
                ) : null}

                {element.svgName === "line-dashed" ? (
                  <line
                    x1="8"
                    y1="50"
                    x2="92"
                    y2="50"
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeDasharray="10 8"
                    strokeLinecap="round"
                  />
                ) : null}

                {element.svgName === "arrow-right" ? (
                  <>
                    <line
                      x1="10"
                      y1="50"
                      x2="78"
                      y2="50"
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                    />
                    <polyline
                      points="60,25 85,50 60,75"
                      fill="none"
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                ) : null}

                {element.svgName === "arrow-left" ? (
                  <>
                    <line
                      x1="22"
                      y1="50"
                      x2="90"
                      y2="50"
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                    />
                    <polyline
                      points="40,25 15,50 40,75"
                      fill="none"
                      stroke={stroke}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </>
                ) : null}

                {element.svgName === "star" ? (
                  <polygon
                    points="50,8 61,36 91,36 67,55 76,86 50,68 24,86 33,55 9,36 39,36"
                    fill={fill}
                  />
                ) : null}

                {element.svgName === "heart" ? (
                  <path
                    d="M50 85 C20 60 8 42 18 25 C27 10 43 16 50 30 C57 16 73 10 82 25 C92 42 80 60 50 85Z"
                    fill={fill}
                  />
                ) : null}
              </svg>
            );
          }

          return null;
        })}

        {formElements.map(renderFormElement)}
      </div>
    </div>
  );
}