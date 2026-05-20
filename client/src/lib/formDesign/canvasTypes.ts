export function createDefaultWithOneCanvasConfig(): FormCanvasConfig {
  const required = true;

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
	requiredFormElement: required,
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
	requiredFormElement: required,
      },
      {
        id: "required-form-box",
        type: "shape",
        shape: "rect",
        x: 110,
        y: 340,
        width: 860,
        height: 1040,
        backgroundColor: "#ffffff",
        borderColor: "#e5e7eb",
        borderWidth: 2,
        zIndex: 3,
	requiredFormElement: required,
      },
      ...[
        ["required-clientName", "이름", "이름을 입력해주세요", 410],
        ["required-phone", "전화번호", "010-0000-0000", 540],
        ["required-finalEducation", "최종학력", "최종학력 선택", 670],
        ["required-desiredCourse", "희망과정", "희망과정 선택", 800],
        ["required-channel", "문의경로", "문의경로 입력", 930],
        ["required-notes", "상담내용", "진행하시면서 걱정되시는 부분 적어주세요!", 1060],
        ["required-agreed", "개인정보 동의", "개인정보 수집 및 이용에 동의합니다.", 1210],
      ].flatMap(([id, label, placeholder, y], index) => [
        {
          id: `${id}-label`,
          type: "text",
          x: 170,
          y: Number(y),
          width: 260,
          height: 42,
          text: String(label),
          fontSize: 26,
          fontWeight: 800,
          fontFamily: "Pretendard, sans-serif",
          color: "#111827",
          textAlign: "left",
          zIndex: 10 + index * 2,
          requiredFormElement: required,
        } as FormCanvasTextElement,
        {
          id: `${id}-field`,
          type: "shape",
          shape: "rect",
          x: 170,
          y: Number(y) + 48,
          width: 740,
          height: id === "required-notes" ? 110 : 72,
          backgroundColor: "#f8fafc",
          borderColor: "#cbd5e1",
          borderWidth: 2,
          zIndex: 11 + index * 2,
          requiredFormElement: required,
        } as FormCanvasShapeElement,
        {
          id: `${id}-placeholder`,
          type: "text",
          x: 195,
          y: Number(y) + 60,
          width: 690,
          height: id === "required-notes" ? 80 : 48,
          text: String(placeholder),
          fontSize: 24,
          fontWeight: 600,
          fontFamily: "Pretendard, sans-serif",
          color: "#94a3b8",
          textAlign: "left",
          zIndex: 12 + index * 2,
          requiredFormElement: required,
        } as FormCanvasTextElement,
      ]),
      {
        id: "required-submit-button",
        type: "button",
        x: 170,
        y: 1320,
        width: 740,
        height: 90,
        text: "무료 상담 신청하기",
        backgroundColor: "#2563eb",
        color: "#ffffff",
        borderRadius: 26,
        action: "openForm",
        hoverEffect: "lift",
        zIndex: 40,
        requiredFormElement: required,
      },
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
