export function createDefaultCompanyCanvasConfig(): FormCanvasConfig {
  return {
    enabled: true,
    width: 1080,
    height: 1920,
    backgroundColor: "#ffffff",
    elements: [
      {
        id: "required-title",
        type: "text",
        x: 90,
        y: 110,
        width: 900,
        height: 90,
        text: "학점은행제 맞춤 상담 신청",
        fontSize: 54,
        fontWeight: 900,
        fontFamily: "Pretendard, sans-serif",
        color: "#111827",
        textAlign: "center",
        zIndex: 1,
      },
      {
        id: "required-subtitle",
        type: "text",
        x: 120,
        y: 210,
        width: 840,
        height: 70,
        text: "전문 담당자가 학습 상황에 맞춰 무료로 안내드립니다.",
        fontSize: 30,
        fontWeight: 700,
        fontFamily: "Pretendard, sans-serif",
        color: "#475569",
        textAlign: "center",
        zIndex: 2,
      },
      {
        id: "required-form-box",
        type: "shape",
        shape: "rect",
        x: 110,
        y: 320,
        width: 860,
        height: 860,
        backgroundColor: "#ffffff",
        borderColor: "#e5e7eb",
        borderWidth: 2,
        zIndex: 3,
      },
      {
        id: "required-form-element",
        type: "form",
        x: 170,
        y: 380,
        width: 740,
        height: 700,
        zIndex: 30,
        requiredFormElement: true,
      } as any,
    ],
  };
}
const createCanvasId = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

export function createCanvasTextElement(): FormCanvasTextElement {
  return {
    id: createCanvasId("text"),
    type: "text",
    x: 120,
    y: 120,
    width: 360,
    height: 80,
    text: "새 텍스트",
    fontSize: 32,
    fontWeight: 700,
    fontFamily: "Pretendard, sans-serif",
    color: "#111827",
    textAlign: "left",
    zIndex: 100,
  };
}

export function createCanvasImageElement(): FormCanvasImageElement {
  return {
    id: createCanvasId("image"),
    type: "image",
    x: 120,
    y: 120,
    width: 320,
    height: 220,
    url: "",
    objectFit: "cover",
    borderRadius: 16,
    zIndex: 100,
  };
}

export function createCanvasButtonElement(): FormCanvasButtonElement {
  return {
    id: createCanvasId("button"),
    type: "button",
    x: 120,
    y: 120,
    width: 320,
    height: 80,
    text: "버튼",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    borderRadius: 18,
    action: "openForm",
    hoverEffect: "lift",
    zIndex: 100,
  };
}

export function createCanvasRectElement(): FormCanvasShapeElement {
  return {
    id: createCanvasId("rect"),
    type: "shape",
    shape: "rect",
    x: 120,
    y: 120,
    width: 260,
    height: 160,
    backgroundColor: "#e2e8f0",
    borderColor: "#cbd5e1",
    borderWidth: 1,
    zIndex: 100,
  };
}

export function createCanvasCircleElement(): FormCanvasShapeElement {
  return {
    id: createCanvasId("circle"),
    type: "shape",
    shape: "circle",
    x: 120,
    y: 120,
    width: 180,
    height: 180,
    backgroundColor: "#e2e8f0",
    borderColor: "#cbd5e1",
    borderWidth: 1,
    zIndex: 100,
  };
}

export function createCanvasSvgElement(
  svgName: "line" | "line-dashed" | "arrow-right" | "arrow-left" | "star" | "heart"
): FormCanvasSvgElement {
  return {
    id: createCanvasId("svg"),
    type: "svg",
    svgName,
    x: 120,
    y: 120,
    width: 180,
    height: 80,
    stroke: "#64748b",
    fill: "#64748b",
    strokeWidth: 8,
    zIndex: 100,
  };
}