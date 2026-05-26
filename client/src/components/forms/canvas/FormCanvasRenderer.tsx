import { useEffect, useMemo, useState } from "react";
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
    const sidePadding = isMobile ? 24 : 48;
    const availableWidth = Math.max(320, windowWidth - sidePadding);

    if (typeof maxWidth === "number") {
      return Math.min(1, maxWidth / safeCanvasWidth);
    }

    return Math.min(1, availableWidth / safeCanvasWidth);
  }, [overrideScale, canvas.width, isMobile, windowWidth, maxWidth]);

  if (!canvas.enabled) return null;

  const width = canvas.width * scale;
  const height = canvas.height * scale;

  const visibleElements = canvas.elements.filter((element) => !element.hidden);

  const visualElements = visibleElements.filter((element: any) => {
    return element.type !== "formField" && element.type !== "formSubmit";
  });

  const rawFormFields = visibleElements.filter((element: any) => {
  return element.type === "formField";
});

const rawFormSubmits = visibleElements.filter((element: any) => {
  return element.type === "formSubmit";
});

const defaultCanvasForForm = createDefaultCompanyCanvasConfig();

const fallbackFormFields = defaultCanvasForForm.elements.filter((element: any) => {
  return element.type === "formField";
});

const fallbackFormSubmits = defaultCanvasForForm.elements.filter((element: any) => {
  return element.type === "formSubmit";
});

const inputLikeVisualShapes = visualElements
  .filter((element: any) => {
    if (element.type !== "shape") return false;

    const w = Number(element.width || 0);
    const h = Number(element.height || 0);

    return w >= 300 && h >= 30 && h <= 220;
  })
  .sort((a: any, b: any) => Number(a.y || 0) - Number(b.y || 0));

const emergencyFieldKeys = [
  { fieldKey: "clientName", inputType: "text", placeholder: "이름" },
  { fieldKey: "phone", inputType: "phone", placeholder: "전화번호" },
  { fieldKey: "finalEducation", inputType: "select", placeholder: "최종학력 선택" },
  { fieldKey: "desiredCourse", inputType: "select", placeholder: "희망과정 선택" },
  { fieldKey: "channel", inputType: "text", placeholder: "문의경로 (예. 블로그, 인스타, 지인추천)" },
  { fieldKey: "notes", inputType: "textarea", placeholder: "진행하시면서 걱정되시는 부분 적어주세요!" },
  { fieldKey: "agreed", inputType: "checkbox", placeholder: "", label: "개인정보 수집 및 이용에 동의합니다." },
];

const emergencyFormFields = emergencyFieldKeys.map((field, index) => {
  const shape = inputLikeVisualShapes[index];

  return {
    id: `emergency-${field.fieldKey}`,
    type: "formField",
    ...field,
    x: Number(shape?.x ?? 140),
    y: Number(shape?.y ?? 300 + index * 95),
    width: Number(shape?.width ?? 800),
    height: field.fieldKey === "agreed" ? 40 : Number(shape?.height ?? 72),
    zIndex: 1000,
  };
});

const REQUIRED_FORM_FIELD_KEYS = [
  "clientName",
  "phone",
  "finalEducation",
  "desiredCourse",
  "channel",
  "notes",
  "agreed",
];

const rawFormFieldKeys = new Set(
  rawFormFields
    .map((element: any) => String(element.fieldKey || "").trim())
    .filter(Boolean)
);

const hasAllRequiredFormFields = REQUIRED_FORM_FIELD_KEYS.every((key) =>
  rawFormFieldKeys.has(key)
);

const safeFormFields = hasAllRequiredFormFields
  ? rawFormFields
  : emergencyFormFields;

const formElements = [
  ...safeFormFields,
  ...(rawFormSubmits.length > 0 ? rawFormSubmits : fallbackFormSubmits),
];

useEffect(() => {
  console.log("[FORM CANVAS DEBUG:init]", {
    canvasEnabled: canvas.enabled,
    canvasSize: {
      width: canvas.width,
      height: canvas.height,
      scaledWidth: width,
      scaledHeight: height,
      scale,
    },
    values,
    fields: fields.map((field: any) => ({
      fieldKey: field.fieldKey,
      type: field.type,
      optionsCount: Array.isArray(field.options) ? field.options.length : 0,
      hidden: field.hidden,
      required: field.required,
    })),
    formElements: formElements.map((el: any) => ({
      id: el.id,
      type: el.type,
      fieldKey: el.fieldKey,
      inputType: el.inputType,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      zIndex: el.zIndex,
      hidden: el.hidden,
    })),
    visualElements: visualElements.map((el: any) => ({
      id: el.id,
      type: el.type,
      x: el.x,
      y: el.y,
      width: el.width,
      height: el.height,
      zIndex: el.zIndex,
      hidden: el.hidden,
    })),
  });
}, [canvas.enabled, canvas.width, canvas.height, scale, width, height, fields, values, formElements, visualElements]);
useEffect(() => {
  const handlePointerDown = (event: PointerEvent) => {
    const target = document.elementFromPoint(event.clientX, event.clientY);

    console.log("[FORM CANVAS DEBUG:pointer]", {
  x: event.clientX,
  y: event.clientY,
  targetTag: target?.tagName,
  targetClass: (target as HTMLElement | null)?.className,
  targetId: (target as HTMLElement | null)?.id,
  targetOuterHTML: target?.outerHTML?.slice(0, 500),
  inputRects: Array.from(
    document.querySelectorAll("input, select, textarea")
  ).map((node: any) => {
    const rect = node.getBoundingClientRect();

    return {
      tag: node.tagName,
      fieldKey: node.dataset?.formFieldKey,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
      value: node.value,
    };
  }),
});
  };

  window.addEventListener("pointerdown", handlePointerDown, true);

  return () => {
    window.removeEventListener("pointerdown", handlePointerDown, true);
  };
}, []);

  const handleButtonClick = (element: FormCanvasElement) => {
    if (element.type !== "button") return;

    if (element.action === "link" && element.href) {
      const href = element.href.startsWith("http")
        ? element.href
        : `https://${element.href}`;

      const target = element.target || "_blank";

      if (target === "_self") {
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
      onOpenForm?.();
    }
  };

  const renderFormElement = (element: FormCanvasElement) => {
    const baseStyle: React.CSSProperties = {
  position: "absolute",
  left: element.x * scale,
  top: element.y * scale,
  width: element.width * scale,
  height: element.height * scale,
  zIndex: Number((element as any).zIndex || 1),
  transform: element.rotation ? `rotate(${element.rotation}deg)` : undefined,
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
            backgroundColor: (element as any).backgroundColor || "#5fc065",
            color: (element as any).color || "#ffffff",
            borderRadius: Number((element as any).borderRadius || 18) * scale,
            fontSize: Math.max(
              14,
              Number((element as any).fontSize || 18) * scale
            ),
            fontWeight: 900,
            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.18)",
            pointerEvents: "auto",
          }}
        >
          {isSubmitting
            ? "접수 중..."
            : (element as any).text || "1:1 맞춤 상담 받기"}
        </button>
      );
    }

    if ((element as any).type !== "formField") return null;

    const rawId = String((element as any).id || "");
    const rawFieldKey = String((element as any).fieldKey || "");
    const rawPlaceholder = String((element as any).placeholder || "");
    const rawLabel = String((element as any).label || "");
    const rawText = String((element as any).text || "");

    const normalizeKeyText = (text: string) =>
      String(text || "")
        .replace(/[_\-\s]/g, "")
        .toLowerCase();

    const sourceText = normalizeKeyText(
      `${rawId} ${rawFieldKey} ${rawPlaceholder} ${rawLabel} ${rawText}`
    );

    const resolveFieldKey = () => {
      if (rawFieldKey === "clientName") return "clientName";
      if (rawFieldKey === "phone") return "phone";
      if (rawFieldKey === "finalEducation") return "finalEducation";
      if (rawFieldKey === "desiredCourse") return "desiredCourse";
      if (rawFieldKey === "channel") return "channel";
      if (rawFieldKey === "notes") return "notes";
      if (rawFieldKey === "agreed") return "agreed";

      if (
        sourceText.includes("clientname") ||
        sourceText.includes("client") ||
        sourceText.includes("name") ||
        sourceText.includes("이름")
      ) {
        return "clientName";
      }

      if (
        sourceText.includes("phone") ||
        sourceText.includes("tel") ||
        sourceText.includes("전화")
      ) {
        return "phone";
      }

      if (
        sourceText.includes("finaleducation") ||
        sourceText.includes("final") ||
        sourceText.includes("education") ||
        sourceText.includes("최종학력") ||
        sourceText.includes("학력")
      ) {
        return "finalEducation";
      }

      if (
        sourceText.includes("desiredcourse") ||
        sourceText.includes("desired") ||
        sourceText.includes("course") ||
        sourceText.includes("희망과정") ||
        sourceText.includes("과정")
      ) {
        return "desiredCourse";
      }

      if (
        sourceText.includes("channel") ||
        sourceText.includes("문의경로") ||
        sourceText.includes("경로")
      ) {
        return "channel";
      }

      if (
        sourceText.includes("notes") ||
        sourceText.includes("memo") ||
        sourceText.includes("상담내역") ||
        sourceText.includes("걱정") ||
        sourceText.includes("부분")
      ) {
        return "notes";
      }

      if (
        sourceText.includes("agreed") ||
        sourceText.includes("agree") ||
        sourceText.includes("개인정보") ||
        sourceText.includes("동의")
      ) {
        return "agreed";
      }

      return rawFieldKey || rawId.replace("required-field-", "").replace("field-", "");
    };

    const fieldKey = resolveFieldKey();
    const field = fields.find((item: any) => String(item.fieldKey) === fieldKey);

    const inputType = (element as any).inputType || field?.type || "text";
    const placeholder =
      (element as any).placeholder || field?.placeholder || field?.label || "";
    const label = (element as any).label || field?.label || "";

    const fieldValue =
      fieldKey === "phone"
        ? String(values.phone ?? "")
        : String(values[fieldKey] ?? "");

    const controlStyle: React.CSSProperties = {
  ...baseStyle,
  width: Math.max(40, element.width * scale),
  height: Math.max(32, element.height * scale),
  boxSizing: "border-box",
  pointerEvents: "auto",
  userSelect: "text",
  WebkitUserSelect: "text",
  backgroundClip: "padding-box",
  zIndex: 1000 + Number((element as any).zIndex || 1),
};

    if (inputType === "textarea") {
  return (
    <textarea
  key={element.id}
  data-form-field-key={fieldKey}
  placeholder={placeholder}
  defaultValue={fieldValue}
  onFocus={() => console.log("[FORM CANVAS DEBUG:focus]", fieldKey, "textarea")}
  onInput={(e) => {
    const next = (e.currentTarget as HTMLTextAreaElement).value;
    console.log("[FORM CANVAS DEBUG:input]", fieldKey, next);
    onValueChange?.(fieldKey, next);
  }}
      style={{
        ...controlStyle,
        border: "1px solid #d1d5db",
        borderRadius: 12 * scale,
        padding: 14 * scale,
        fontSize: Math.max(14, 16 * scale),
        background: "#ffffff",
        resize: "none",
      }}
    />
  );
}

   if (inputType === "select") {
  const options = Array.isArray(field?.options) ? field.options : [];

  return (
    <select
  key={element.id}
  data-form-field-key={fieldKey}
  defaultValue={fieldValue}
  onFocus={() => console.log("[FORM CANVAS DEBUG:focus]", fieldKey, "select")}
  onChange={(e) => {
    console.log("[FORM CANVAS DEBUG:change]", fieldKey, e.target.value);
    onValueChange?.(fieldKey, e.target.value);
  }}
      style={{
        ...controlStyle,
        border: "1px solid #d1d5db",
        borderRadius: 12 * scale,
        padding: `0 ${14 * scale}px`,
        fontSize: Math.max(14, 16 * scale),
        background: "#ffffff",
        appearance: "auto",
        WebkitAppearance: "menulist",
      }}
    >
      <option value="">{placeholder || "선택"}</option>
      {options.map((option: any) => (
        <option key={`${fieldKey}-${option.value}`} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

    if (inputType === "checkbox") {
      return (
        <label
          key={element.id}
          style={{
            ...controlStyle,
            display: "flex",
            alignItems: "center",
            gap: 8 * scale,
            fontSize: Math.max(12, 14 * scale),
            color: "#334155",
            background: "transparent",
          }}
        >
          <input
  type="checkbox"
  defaultChecked={Boolean(values[fieldKey])}
  onChange={(e) => onValueChange?.(fieldKey, e.target.checked)}
/>
          {label || "개인정보 수집 및 이용 동의"}
        </label>
      );
    }

   return (
  <input
  key={element.id}
  data-form-field-key={fieldKey}
  placeholder={placeholder}
  defaultValue={fieldValue}
  inputMode={fieldKey === "phone" ? "numeric" : undefined}
  autoComplete={
    fieldKey === "clientName"
      ? "name"
      : fieldKey === "phone"
        ? "tel"
        : "off"
  }
  onFocus={() => console.log("[FORM CANVAS DEBUG:focus]", fieldKey, "input")}
  onInput={(e) => {
    const rawValue = (e.currentTarget as HTMLInputElement).value;
    const nextValue =
      fieldKey === "phone"
        ? rawValue.replace(/\D/g, "").slice(0, 11)
        : rawValue;

    console.log("[FORM CANVAS DEBUG:input]", fieldKey, nextValue);
    onValueChange?.(fieldKey, nextValue);
  }}
    style={{
      ...controlStyle,
      border: "1px solid #d1d5db",
      borderRadius: 12 * scale,
      padding: `0 ${14 * scale}px`,
      fontSize: Math.max(14, 16 * scale),
      background: "#f8fafc",
    }}
  />
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
        overflowX: "hidden",
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        padding: isMobile ? "12px" : "24px",
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
          const baseStyle: React.CSSProperties = {
  position: "absolute",
  left: element.x * scale,
  top: element.y * scale,
  width: element.width * scale,
  height: element.height * scale,
  zIndex: Math.min(Number(element.zIndex ?? 1), 100),
  transform: element.rotation
    ? `rotate(${element.rotation}deg)`
    : undefined,
};

          if (element.type === "text") {
            return (
              <div
                key={element.id}
                style={{
                  ...baseStyle,
                  pointerEvents: "none",
                  color: element.color,
                  fontSize: isMobile
                    ? Math.max(14, element.fontSize * scale)
                    : Math.max(11, element.fontSize * scale),
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
                  borderRadius: Number((element as any).borderRadius || 0) * scale,
                }}
              />
            );
          }

          if (element.type === "button") {
            const baseTransform = element.rotation
              ? `rotate(${element.rotation}deg)`
              : "";

            const hoverEffect = element.hoverEffect || "none";

            const hoverStyle =
              hoverEffect === "lift"
                ? { transform: `${baseTransform} translateY(-2px)`.trim() }
                : hoverEffect === "scale"
                  ? { transform: `${baseTransform} scale(1.03)`.trim() }
                  : hoverEffect === "glow"
                    ? { boxShadow: "0 14px 34px rgba(15, 23, 42, 0.28)" }
                    : {};

            return (
              <button
                key={element.id}
                type="button"
                onClick={() => handleButtonClick(element)}
                onMouseEnter={(e) => {
                  Object.assign(e.currentTarget.style, hoverStyle);
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = baseTransform;
                  e.currentTarget.style.boxShadow =
                    "0 10px 24px rgba(15, 23, 42, 0.18)";
                }}
                style={{
                  ...baseStyle,
                  width: isMobile
                    ? Math.max(element.width * scale, 120)
                    : element.width * scale,
                  height: isMobile
                    ? Math.max(element.height * scale, 44)
                    : element.height * scale,
                  minHeight: isMobile ? 44 : undefined,
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: element.backgroundColor,
                  color: element.color,
                  borderRadius: element.borderRadius * scale,
                  fontSize: isMobile
                    ? Math.max(14, Number((element as any).fontSize || 34) * scale)
                    : Math.max(13, Number((element as any).fontSize || 34) * scale),
                  fontWeight: Number((element as any).fontWeight || 900),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: isMobile ? "0 10px" : "0 14px",
                  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.18)",
                  WebkitTapHighlightColor: "transparent",
                  touchAction: "manipulation",
                  transition:
                    "transform 160ms ease, box-shadow 160ms ease, filter 160ms ease",
                }}
              >
                {element.text}
              </button>
            );
          }

          if (element.type === "shape") {

const isInputLikeShape = inputLikeVisualShapes.some(
  (shape: any) => shape.id === element.id
);

if (isInputLikeShape) {
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
                      ? `${element.borderWidth * scale}px solid ${element.borderColor}`
                      : undefined,
                  borderRadius:
                    element.shape === "circle"
                      ? "999px"
                      : Number((element as any).borderRadius ?? 18) * scale,
                }}
              />
            );
          }

          if (element.type === "svg") {
            const stroke = element.stroke || "#64748b";
            const fill = element.fill || "#64748b";
            const strokeWidth = Number(element.strokeWidth || 8) * scale;

            const renderSvgContent = () => {
              if (element.svgName === "line") {
                return (
                  <line
                    x1="8"
                    y1="50"
                    x2="92"
                    y2="50"
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                  />
                );
              }

              if (element.svgName === "line-dashed") {
                return (
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
                );
              }

              if (element.svgName === "arrow-right") {
                return (
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
                );
              }

              if (element.svgName === "arrow-left") {
                return (
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
                );
              }

              if (element.svgName === "star") {
                return (
                  <polygon
                    points="50,8 61,36 91,36 67,55 76,86 50,68 24,86 33,55 9,36 39,36"
                    fill={fill}
                  />
                );
              }

              if (element.svgName === "heart") {
                return (
                  <path
                    d="M50 85 C20 60 8 42 18 25 C27 10 43 16 50 30 C57 16 73 10 82 25 C92 42 80 60 50 85Z"
                    fill={fill}
                  />
                );
              }

              return null;
            };

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
                {renderSvgContent()}
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