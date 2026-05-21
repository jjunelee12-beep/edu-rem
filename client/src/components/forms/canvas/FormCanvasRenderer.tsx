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
};

function normalizeCanvas(value?: FormCanvasConfig): FormCanvasConfig {
  const defaultCanvas = createDefaultCompanyCanvasConfig();

  return {
    ...defaultCanvas,
    ...(value || {}),
    enabled: value?.enabled ?? defaultCanvas.enabled,
    elements: Array.isArray(value?.elements) ? value.elements : defaultCanvas.elements,
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
          borderRadius: isMobile ? 18 : 24,
          backgroundColor: canvas.backgroundColor || "#ffffff",
          boxShadow: "0 18px 50px rgba(15, 23, 42, 0.14)",
          touchAction: "manipulation",
        }}
      >
        {canvas.elements
          .filter((element) => !element.hidden)
          .map((element) => {
            const baseStyle: React.CSSProperties = {
              position: "absolute",
              left: element.x * scale,
              top: element.y * scale,
              width: element.width * scale,
              height: element.height * scale,
              zIndex: element.zIndex ?? 1,
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
    ? {
        transform: `${baseTransform} translateY(-2px)`.trim(),
      }
    : hoverEffect === "scale"
    ? {
        transform: `${baseTransform} scale(1.03)`.trim(),
      }
    : hoverEffect === "glow"
    ? {
        boxShadow: "0 14px 34px rgba(15, 23, 42, 0.28)",
      }
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
    e.currentTarget.style.boxShadow = "0 10px 24px rgba(15, 23, 42, 0.18)";
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
transition: "transform 160ms ease, box-shadow 160ms ease, filter 160ms ease",
                  }}
                >
                  {element.text}
                </button>
              );
            }

            if (element.type === "shape") {
              return (
                <div
                  key={element.id}
                  style={{
                    ...baseStyle,
                    backgroundColor: element.backgroundColor,
                    border:
                      element.borderWidth && element.borderColor
                        ? `${element.borderWidth * scale}px solid ${
                            element.borderColor
                          }`
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
        overflow: "visible",
      }}
    >
      {renderSvgContent()}
    </svg>
  );
}

            return null;
          })}
      </div>
    </div>
  );
}