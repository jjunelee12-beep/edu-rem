import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_FORM_CANVAS_CONFIG,
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
  return {
    ...DEFAULT_FORM_CANVAS_CONFIG,
    ...(value || {}),
    elements: Array.isArray(value?.elements) ? value.elements : [],
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

    if (isMobile) {
      const sidePadding = 24;
      const availableWidth = Math.max(320, windowWidth - sidePadding);
      return Math.min(1, Math.max(0.85, availableWidth / safeCanvasWidth));
    }

    const desktopMaxWidth = maxWidth ?? 430;
    return Math.min(1, desktopMaxWidth / safeCanvasWidth);
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
    justifyContent: isMobile ? "flex-start" : "center",
    margin: isMobile ? "10px 0 18px" : "18px 0",
    overflowX: isMobile ? "auto" : "visible",
    scrollbarWidth: "none",
    msOverflowStyle: "none",
    padding: isMobile ? "0 8px" : 0,
    boxSizing: "border-box",
  }}
>
      <div
  style={{
          position: "relative",
          width,
          height,
          maxWidth: "100%",
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
  ? Math.max(14, 34 * scale)
  : Math.max(13, 34 * scale),
                    fontWeight: 900,
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
                    borderRadius: element.shape === "circle" ? "999px" : 18,
                  }}
                />
              );
            }

            return null;
          })}
      </div>
    </div>
  );
}