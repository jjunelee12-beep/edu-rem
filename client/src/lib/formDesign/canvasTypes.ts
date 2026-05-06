export type FormCanvasElementType =
  | "text"
  | "image"
  | "button"
  | "shape"
  | "svg";

export type FormCanvasElementBase = {
  id: string;
  type: FormCanvasElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex?: number;
  locked?: boolean;
  hidden?: boolean;
requiredFormElement?: boolean;
};

export type FormCanvasTextElement = FormCanvasElementBase & {
  type: "text";
  text: string;
  fontSize: number;
  fontWeight: number;
fontFamily?: string;
color: string;
textAlign?: "left" | "center" | "right";
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
};

export type FormCanvasImageElement = FormCanvasElementBase & {
  type: "image";
  url: string;
  objectFit?: "cover" | "contain";
};

export type FormCanvasButtonElement = FormCanvasElementBase & {
  type: "button";
  text: string;
  backgroundColor: string;
  color: string;
  borderRadius: number;
  action?: "openForm" | "submit" | "link" | "tel";
  href?: string;
  telNumber?: string;
hoverEffect?: "none" | "lift" | "scale" | "glow";
};

export type FormCanvasShapeElement = FormCanvasElementBase & {
  type: "shape";
  shape: "rect" | "circle";
  backgroundColor: string;
  borderColor?: string;
  borderWidth?: number;
};

export type FormCanvasSvgElement = FormCanvasElementBase & {
  type: "svg";
  svgName:
    | "line"
    | "line-dashed"
    | "arrow-right"
    | "arrow-left"
    | "star"
    | "heart";
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
};

export type FormCanvasElement =
  | FormCanvasTextElement
  | FormCanvasImageElement
  | FormCanvasButtonElement
  | FormCanvasShapeElement
  | FormCanvasSvgElement;

export type FormCanvasConfig = {
  enabled: boolean;
  width: number;
  height: number;
  backgroundColor: string;
  elements: FormCanvasElement[];
};

export const DEFAULT_FORM_CANVAS_CONFIG: FormCanvasConfig = {
  enabled: false,
  width: 1080,
  height: 1920,
  backgroundColor: "#ffffff",
  elements: [],
};

export function createCanvasTextElement(): FormCanvasTextElement {
  return {
    id: `text-${Date.now()}`,
    type: "text",
    x: 80,
    y: 120,
    width: 600,
    height: 120,
    text: "새 텍스트",
    fontSize: 48,
    fontWeight: 800,
fontFamily: "Pretendard, sans-serif",
color: "#111827",
    textAlign: "left",
strokeColor: "#000000",
strokeWidth: 0,
shadowColor: "#000000",
shadowBlur: 0,
shadowOffsetX: 0,
shadowOffsetY: 0,
zIndex: 1,
  };
}

export function createCanvasImageElement(): FormCanvasImageElement {
  return {
    id: `image-${Date.now()}`,
    type: "image",
    x: 80,
    y: 300,
    width: 600,
    height: 420,
    url: "",
    objectFit: "cover",
    zIndex: 1,
  };
}

export function createCanvasButtonElement(): FormCanvasButtonElement {
  return {
    id: `button-${Date.now()}`,
    type: "button",
    x: 80,
    y: 820,
    width: 520,
    height: 110,
    text: "상담 신청하기",
    backgroundColor: "#111827",
    color: "#ffffff",
    borderRadius: 28,
    action: "openForm",
href: "",
telNumber: "",
hoverEffect: "lift",
zIndex: 1,
  };
}

export function createCanvasRectElement(): FormCanvasShapeElement {
  return {
    id: `shape-rect-${Date.now()}`,
    type: "shape",
    shape: "rect",
    x: 80,
    y: 980,
    width: 520,
    height: 220,
    backgroundColor: "#f3f4f6",
    borderColor: "#e5e7eb",
    borderWidth: 2,
    zIndex: 1,
  };
}

export function createCanvasCircleElement(): FormCanvasShapeElement {
  return {
    id: `shape-circle-${Date.now()}`,
    type: "shape",
    shape: "circle",
    x: 120,
    y: 980,
    width: 260,
    height: 260,
    backgroundColor: "#fef3c7",
    borderColor: "#f59e0b",
    borderWidth: 2,
    zIndex: 1,
  };
}

export function createCanvasSvgElement(
  svgName: FormCanvasSvgElement["svgName"] = "arrow-right"
): FormCanvasSvgElement {
  return {
    id: `svg-${svgName}-${Date.now()}`,
    type: "svg",
    svgName,
    x: 120,
    y: 120,
    width: 300,
    height: 120,
    fill: "#64748b",
    stroke: "#64748b",
    strokeWidth: 8,
    zIndex: 1,
  };
}

export function createDefaultWithOneCanvasConfig(): FormCanvasConfig {
  return {
    enabled: true,
    width: 1080,
    height: 1920,
    backgroundColor: "#ffffff",
    elements: [
      {
        id: "default-logo",
        type: "image",
        x: 190,
        y: 250,
        width: 110,
        height: 70,
        url: "/images/logo.png",
        objectFit: "contain",
        zIndex: 1,
      },
      {
        id: "default-title",
        type: "text",
        x: 300,
        y: 245,
        width: 650,
        height: 150,
        text: "목표를 향한 배움의 길\n위드원 교육이 함께할게요",
        fontSize: 58,
        fontWeight: 900,
        color: "#111827",
        textAlign: "left",
        zIndex: 2,
      },
      {
        id: "default-subtitle",
        type: "text",
        x: 210,
        y: 430,
        width: 660,
        height: 70,
        text: "상담은 100% 무료로 진행됩니다.",
        fontSize: 36,
        fontWeight: 500,
        color: "#374151",
        textAlign: "center",
        zIndex: 3,
      },
      {
        id: "default-name-box",
        type: "shape",
        shape: "rect",
        x: 120,
        y: 560,
        width: 840,
        height: 105,
        backgroundColor: "#f9fafb",
        borderColor: "#d1d5db",
        borderWidth: 2,
        zIndex: 4,
requiredFormElement: true,
      },
      {
        id: "default-name-placeholder",
        type: "text",
        x: 160,
        y: 590,
        width: 300,
        height: 50,
        text: "이름",
        fontSize: 30,
        fontWeight: 400,
        color: "#9ca3af",
        textAlign: "left",
        zIndex: 5,
requiredFormElement: true,
      },
      {
        id: "default-phone-box",
        type: "shape",
        shape: "rect",
        x: 120,
        y: 700,
        width: 840,
        height: 105,
        backgroundColor: "#f9fafb",
        borderColor: "#d1d5db",
        borderWidth: 2,
        zIndex: 6,
requiredFormElement: true,
      },
      {
        id: "default-phone-placeholder",
        type: "text",
        x: 160,
        y: 730,
        width: 300,
        height: 50,
        text: "전화번호",
        fontSize: 30,
        fontWeight: 400,
        color: "#9ca3af",
        textAlign: "left",
        zIndex: 7,
requiredFormElement: true,
      },
      {
        id: "default-final-education-box",
        type: "shape",
        shape: "rect",
        x: 120,
        y: 840,
        width: 840,
        height: 90,
        backgroundColor: "#ffffff",
        borderColor: "#d1d5db",
        borderWidth: 2,
        zIndex: 8,
requiredFormElement: true,
      },
      {
        id: "default-final-education-placeholder",
        type: "text",
        x: 160,
        y: 865,
        width: 500,
        height: 45,
        text: "최종학력 선택",
        fontSize: 28,
        fontWeight: 500,
        color: "#111827",
        textAlign: "left",
        zIndex: 9,
requiredFormElement: true,
      },
      {
        id: "default-course-box",
        type: "shape",
        shape: "rect",
        x: 120,
        y: 960,
        width: 840,
        height: 90,
        backgroundColor: "#ffffff",
        borderColor: "#d1d5db",
        borderWidth: 2,
        zIndex: 10,
requiredFormElement: true,
      },
      {
        id: "default-course-placeholder",
        type: "text",
        x: 160,
        y: 985,
        width: 500,
        height: 45,
        text: "희망과정 선택",
        fontSize: 28,
        fontWeight: 500,
        color: "#111827",
        textAlign: "left",
        zIndex: 11,
requiredFormElement: true,
      },
      {
        id: "default-channel-box",
        type: "shape",
        shape: "rect",
        x: 120,
        y: 1080,
        width: 840,
        height: 105,
        backgroundColor: "#f9fafb",
        borderColor: "#d1d5db",
        borderWidth: 2,
        zIndex: 12,
requiredFormElement: true,
      },
      {
        id: "default-channel-placeholder",
        type: "text",
        x: 160,
        y: 1110,
        width: 720,
        height: 50,
        text: "문의경로 (예. 블로그, 인스타, 지인추천)",
        fontSize: 28,
        fontWeight: 400,
        color: "#9ca3af",
        textAlign: "left",
        zIndex: 13,
requiredFormElement: true,
      },
      {
        id: "default-notes-box",
        type: "shape",
        shape: "rect",
        x: 120,
        y: 1220,
        width: 840,
        height: 230,
        backgroundColor: "#ffffff",
        borderColor: "#d1d5db",
        borderWidth: 2,
        zIndex: 14,
requiredFormElement: true,
      },
      {
        id: "default-notes-placeholder",
        type: "text",
        x: 160,
        y: 1260,
        width: 720,
        height: 50,
        text: "진행하시면서 걱정되시는 부분 적어주세요!",
        fontSize: 26,
        fontWeight: 400,
        color: "#9ca3af",
        textAlign: "left",
        zIndex: 15,
requiredFormElement: true,
      },
      {
        id: "default-agreement",
        type: "text",
        x: 160,
        y: 1480,
        width: 720,
        height: 45,
        text: "□ 개인정보 수집 및 이용에 동의합니다.",
        fontSize: 24,
        fontWeight: 400,
        color: "#374151",
        textAlign: "left",
        zIndex: 16,
requiredFormElement: true,
      },
      {
        id: "default-submit-button",
        type: "button",
        x: 120,
        y: 1560,
        width: 840,
        height: 120,
        text: "1:1 맞춤 상담 받기",
        backgroundColor: "#5fc065",
        color: "#ffffff",
        borderRadius: 28,
        action: "openForm",
        href: "",
        telNumber: "",
        hoverEffect: "lift",
        zIndex: 17,
requiredFormElement: true,
      },
    ],
  };
}