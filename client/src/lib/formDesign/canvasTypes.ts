export type FormCanvasElementType = "text" | "image" | "button" | "shape";

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
};

export type FormCanvasTextElement = FormCanvasElementBase & {
  type: "text";
  text: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  textAlign?: "left" | "center" | "right";
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

export type FormCanvasElement =
  | FormCanvasTextElement
  | FormCanvasImageElement
  | FormCanvasButtonElement
  | FormCanvasShapeElement;

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
    color: "#111827",
    textAlign: "left",
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