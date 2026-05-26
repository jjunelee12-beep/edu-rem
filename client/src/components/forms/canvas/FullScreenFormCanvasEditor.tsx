import { useRef, useState } from "react";
import FormCanvasEditor from "./FormCanvasEditor";
import type { UiConfig } from "@/lib/formDesign/shared";
import {
createDefaultCompanyCanvasConfig,
  createCanvasTextElement,
  createCanvasImageElement,
  createCanvasButtonElement,
  createCanvasRectElement,
 createCanvasCircleElement,
createCanvasSvgElement,
type FormCanvasConfig,
type FormCanvasElement,
} from "@/lib/formDesign/canvasTypes";

type ToolKey =
  | "template"
  | "element"
  | "text"
  | "image"
  | "upload"
  | "background"
  | "button"
  | "form"
  | "host";

type Props = {
  value: UiConfig;
  onChange: (next: UiConfig) => void;
  onSave: () => void;
  onClose: () => void;
  onUploadCanvasImage?: (file: File) => Promise<string>;
  isHostEditor?: boolean;
  renderFormPreview?: () => any;
};

function normalizeCanvas(canvas?: FormCanvasConfig): FormCanvasConfig {
  const defaultCanvas = createDefaultCompanyCanvasConfig();

  if (
    !canvas ||
    !Array.isArray(canvas.elements) ||
    canvas.elements.length === 0
  ) {
    return defaultCanvas;
  }

 return {
  ...defaultCanvas,
  ...canvas,
  enabled: true,
  elements: canvas.elements.filter(
    (element: any) =>
      element.type !== "form" &&
      element.id !== "required-form-element"
  ),
};
}

export default function FullScreenFormCanvasEditor({
  value,
  onChange,
  onSave,
  onClose,
  onUploadCanvasImage,
  isHostEditor = false,
  renderFormPreview,
}: Props) {
  const [activeTool, setActiveTool] = useState<ToolKey>("text");
const uploadInputRef = useRef<HTMLInputElement | null>(null);
const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

const isRequiredFormElement = (element?: FormCanvasElement | null) => {
  if (!element) return false;

  if ((element as any).type === "form") return false;
  if ((element as any).id === "required-form-element") return false;

  return Boolean((element as any)?.requiredFormElement);
};

const canvas = normalizeCanvas(value.canvas);

const selectedElement =
  canvas.elements.find((element) => element.id === selectedElementId) || null;

const updateSelectedElement = (patch: Partial<FormCanvasElement>) => {
  if (!selectedElement) return;

  updateCanvas({
    ...canvas,
    elements: canvas.elements.map((element) =>
      element.id === selectedElement.id
        ? ({ ...element, ...patch } as FormCanvasElement)
        : element
    ),
  });
};

const removeSelectedElement = () => {
  if (!selectedElement) return;

  if (isRequiredFormElement(selectedElement)) {
    alert("상담DB로 연결되는 기본 상담폼 요소는 삭제할 수 없습니다. 위치/크기/디자인만 수정해주세요.");
    return;
  }

  updateCanvas({
    ...canvas,
    elements: canvas.elements.filter(
      (element) => element.id !== selectedElement.id
    ),
  });

  setSelectedElementId(null);
};

const duplicateSelectedElement = () => {
  if (!selectedElement) return;

  if (isRequiredFormElement(selectedElement)) {
    alert("상담DB로 연결되는 기본 상담폼 요소는 복사할 수 없습니다. 위치/크기/디자인만 수정해주세요.");
    return;
  }

  const copiedElement = {
    ...selectedElement,
    id: `${selectedElement.type}-${Date.now()}-${Math.floor(
      Math.random() * 10000
    )}`,
    x: selectedElement.x + 30,
    y: selectedElement.y + 30,
    zIndex:
      Math.max(
        0,
        ...canvas.elements.map((el) => Number(el.zIndex ?? 0))
      ) + 1,
    requiredFormElement: false,
  } as FormCanvasElement;

  updateCanvas({
    ...canvas,
    elements: [...canvas.elements, copiedElement],
  });

  setSelectedElementId(copiedElement.id);
};

const moveSelectedElementLayer = (
  mode: "front" | "forward" | "backward" | "back"
) => {
  if (!selectedElement) return;

  const visible = [...canvas.elements]
    .filter((el) => !el.hidden)
    .sort((a, b) => Number(a.zIndex ?? 0) - Number(b.zIndex ?? 0));

  const hidden = canvas.elements.filter((el) => el.hidden);

  const currentIndex = visible.findIndex(
    (element) => element.id === selectedElement.id
  );

  if (currentIndex < 0) return;

  const nextVisible = [...visible];
  const [picked] = nextVisible.splice(currentIndex, 1);

  if (!picked) return;

  if (mode === "front") {
    nextVisible.push(picked);
  }

  if (mode === "back") {
    nextVisible.unshift(picked);
  }

  if (mode === "forward") {
    nextVisible.splice(
      Math.min(nextVisible.length, currentIndex + 1),
      0,
      picked
    );
  }

  if (mode === "backward") {
    nextVisible.splice(Math.max(0, currentIndex - 1), 0, picked);
  }

  updateCanvas({
    ...canvas,
    elements: [...nextVisible, ...hidden].map((element, index) => ({
      ...element,
      zIndex: index + 1,
    })) as FormCanvasElement[],
  });
};

  const updateCanvas = (nextCanvas: FormCanvasConfig) => {
    onChange({
      ...value,
      canvas: {
        ...nextCanvas,
        enabled: true,
      },
    });
  };

  const appendElement = (element: any) => {
    updateCanvas({
      ...canvas,
      enabled: true,
      elements: [
        ...canvas.elements,
        {
          ...element,
          zIndex:
  Math.max(
    0,
    ...canvas.elements.map((el) => Number(el.zIndex ?? 0))
  ) + 1,
        },
      ],
    });
  };

  const addTitleText = () => {
    appendElement({
      ...createCanvasTextElement(),
      text: "제목 텍스트",
      x: 120,
      y: 120,
      width: 520,
      height: 100,
      fontSize: 72,
      fontWeight: 900,
      color: "#111827",
      textAlign: "center",
    });
  };

  const addSubText = () => {
    appendElement({
      ...createCanvasTextElement(),
      text: "부제목 내용을 입력하세요",
      x: 160,
      y: 260,
      width: 460,
      height: 70,
      fontSize: 34,
      fontWeight: 700,
      color: "#334155",
      textAlign: "center",
    });
  };

  const addBodyText = () => {
    appendElement({
      ...createCanvasTextElement(),
      text: "본문 텍스트를 입력하세요.",
      x: 160,
      y: 360,
      width: 460,
      height: 90,
      fontSize: 26,
      fontWeight: 500,
      color: "#475569",
      textAlign: "center",
    });
  };

  const addImageBox = () => {
    appendElement({
      ...createCanvasImageElement(),
      x: 160,
      y: 420,
      width: 420,
      height: 260,
    });
  };

  const addConsultButton = () => {
    appendElement({
      ...createCanvasButtonElement(),
      text: "1:1 맞춤 상담 받기",
      action: "openForm",
      x: 160,
      y: 760,
      width: 440,
      height: 90,
      backgroundColor: "#5fc065",
      color: "#ffffff",
      borderRadius: 28,
      hoverEffect: "lift",
    });
  };

  const addTelButton = () => {
    appendElement({
      ...createCanvasButtonElement(),
      text: "빠른 전화하기",
      action: "tel",
      x: 160,
      y: 880,
      width: 440,
      height: 90,
      backgroundColor: "#0f172a",
      color: "#ffffff",
      borderRadius: 28,
      hoverEffect: "scale",
    });
  };

  const addLinkButton = () => {
    appendElement({
      ...createCanvasButtonElement(),
      text: "자세히 보기",
      action: "link",
      href: "https://",
      x: 160,
      y: 1000,
      width: 440,
      height: 90,
      backgroundColor: "#2563eb",
      color: "#ffffff",
      borderRadius: 28,
      hoverEffect: "glow",
    });
  };

  const addRect = () => {
    appendElement({
      ...createCanvasRectElement(),
      x: 120,
      y: 520,
      width: 520,
      height: 260,
      backgroundColor: "#f8fafc",
      borderColor: "#e2e8f0",
      borderWidth: 2,
    });
  };

  const addCircle = () => {
    appendElement({
      ...createCanvasCircleElement(),
      x: 220,
      y: 520,
      width: 260,
      height: 260,
      backgroundColor: "#fde68a",
    });
  };

const addSvg = (
  svgName: "line" | "line-dashed" | "arrow-right" | "arrow-left" | "star" | "heart"
) => {
  appendElement({
    ...createCanvasSvgElement(svgName),
    x: 180,
    y: 520,
    width: svgName === "star" || svgName === "heart" ? 220 : 420,
    height: svgName === "star" || svgName === "heart" ? 220 : 100,
  });
};

  const setBackgroundColor = (color: string) => {
    updateCanvas({
      ...canvas,
      backgroundColor: color,
    });
  };

  const setCanvasSize = (width: number, height: number) => {
    updateCanvas({
      ...canvas,
      width,
      height,
    });
  };

  const handleUploadImage = async (file?: File) => {
    if (!file || !onUploadCanvasImage) return;

    const url = await onUploadCanvasImage(file);

    appendElement({
      ...createCanvasImageElement(),
      url,
      x: 140,
      y: 260,
      width: 520,
      height: 360,
      objectFit: "cover",
    });
  };

  const menuItems: Array<{ key: ToolKey; label: string; icon: string }> = [
  { key: "template", label: "템플릿", icon: "▦" },
  { key: "element", label: "요소", icon: "◇" },
  { key: "text", label: "텍스트", icon: "T" },
  { key: "image", label: "사진", icon: "▣" },
  { key: "upload", label: "업로드", icon: "⇧" },
  { key: "background", label: "배경", icon: "▧" },
  { key: "button", label: "버튼", icon: "▭" },
  { key: "form", label: "상담폼", icon: "☑" },
  ...(isHostEditor
    ? [{ key: "host" as ToolKey, label: "호스트", icon: "⚙" }]
    : []),
];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "#e8edf5",
        display: "flex",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: 76,
          background: "#fff",
          borderRight: "1px solid #e5e7eb",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "10px 0",
          gap: 8,
        }}
      >
        {menuItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
  setActiveTool(item.key);
  setSelectedElementId(null);
}}
            style={{
              width: 62,
              minHeight: 58,
              borderRadius: 14,
              border: "1px solid",
              borderColor: activeTool === item.key ? "#a5f3fc" : "transparent",
              background: activeTool === item.key ? "#ecfeff" : "#fff",
              color: activeTool === item.key ? "#0891b2" : "#334155",
              fontSize: 11,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            <div style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</div>
            <div style={{ marginTop: 5 }}>{item.label}</div>
          </button>
        ))}
      </div>

      <aside
        style={{
          width: 320,
          background: "#fff",
          borderRight: "1px solid #e5e7eb",
          padding: 18,
          overflowY: "auto",
        }}
      >
        <ToolPanel
  activeTool={activeTool}
  value={value}
  onChange={onChange}
  isHostEditor={isHostEditor}
  selectedElement={selectedElement}
  updateSelectedElement={updateSelectedElement}
  removeSelectedElement={removeSelectedElement}
  duplicateSelectedElement={duplicateSelectedElement}
  moveSelectedElementLayer={moveSelectedElementLayer}
  onClearSelectedElement={() => setSelectedElementId(null)}
          addTitleText={addTitleText}
          addSubText={addSubText}
          addBodyText={addBodyText}
          addImageBox={addImageBox}
          addConsultButton={addConsultButton}
          addTelButton={addTelButton}
          addLinkButton={addLinkButton}
          addRect={addRect}
          addCircle={addCircle}
addSvg={addSvg}
setBackgroundColor={setBackgroundColor}
          setCanvasSize={setCanvasSize}
          uploadInputRef={uploadInputRef}
          handleUploadImage={handleUploadImage}
        />
      </aside>

      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            height: 62,
            background: "#fff",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
          }}
        >
          <div style={{ fontWeight: 900, color: "#0f172a" }}>
            페이지 꾸미기
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onClose} style={outlineButtonStyle}>
              닫기
            </button>
            <button type="button" onClick={onSave} style={saveButtonStyle}>
              저장
            </button>
          </div>
        </header>

        <div
  style={{
    flex: 1,
    overflow: "auto",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    background:
      "radial-gradient(circle at top, #f8fafc 0, #e2e8f0 45%, #cbd5e1 100%)",
  }}
>
          <FormCanvasEditor
  value={canvas}
  onChange={updateCanvas}
  onUploadImage={onUploadCanvasImage}
  selectedElementId={selectedElementId}
  onSelectedElementIdChange={setSelectedElementId}
  compact
  renderFormPreview={renderFormPreview}
/>
        </div>
      </main>

      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.currentTarget.value = "";
          handleUploadImage(file);
        }}
      />
    </div>
  );
}

function ToolPanel({
  activeTool,
  value,
  onChange,
  isHostEditor,
  selectedElement,
  updateSelectedElement,
  removeSelectedElement,
  duplicateSelectedElement,
  moveSelectedElementLayer,
  onClearSelectedElement,
  addTitleText,
  addSubText,
  addBodyText,
  addImageBox,
  addConsultButton,
  addTelButton,
  addLinkButton,
  addRect,
addCircle,
addSvg,
setBackgroundColor,
  setCanvasSize,
  uploadInputRef,
  handleUploadImage,
}: any) {
  if (selectedElement) {
    return (
      <Panel title="선택 요소 편집">
        <div style={hintStyle}>
          선택됨: {selectedElement.type}
        </div>
<PanelButton onClick={onClearSelectedElement}>
  선택 해제 / 메뉴로 돌아가기
</PanelButton>
<PanelButton onClick={duplicateSelectedElement}>
  선택 요소 복제
</PanelButton>

<PanelButton onClick={removeSelectedElement}>
  선택 요소 삭제
</PanelButton>

<div style={sectionTitleStyle}>레이어 순서</div>

<PanelButton onClick={() => moveSelectedElementLayer("front")}>
  맨 앞으로 가져오기
</PanelButton>

<PanelButton onClick={() => moveSelectedElementLayer("forward")}>
  앞으로 보내기
</PanelButton>

<PanelButton onClick={() => moveSelectedElementLayer("backward")}>
  뒤로 보내기
</PanelButton>

<PanelButton onClick={() => moveSelectedElementLayer("back")}>
  맨 뒤로 보내기
</PanelButton>

        {"text" in selectedElement ? (
          <>
            <label style={labelStyle}>텍스트</label>
            <textarea
              value={selectedElement.text || ""}
              onChange={(e) =>
                updateSelectedElement({ text: e.target.value })
              }
              style={textareaStyle}
            />
          </>
        ) : null}

        {"fontSize" in selectedElement ? (
          <>
<label style={labelStyle}>글꼴</label>
<select
  value={selectedElement.fontFamily || "Pretendard, sans-serif"}
  onChange={(e) =>
    updateSelectedElement({ fontFamily: e.target.value } as any)
  }
  style={inputStyle}
>
  <option value="Pretendard, sans-serif">프리텐다드</option>
  <option value="'Noto Sans KR', sans-serif">Noto Sans KR</option>
  <option value="'Gothic A1', sans-serif">고딕 A1</option>
  <option value="'Nanum Gothic', sans-serif">나눔고딕</option>
  <option value="'Nanum Myeongjo', serif">나눔명조</option>
  <option value="'Black Han Sans', sans-serif">검은고딕</option>
  <option value="'Do Hyeon', sans-serif">도현체</option>
  <option value="'Jua', sans-serif">주아체</option>
  <option value="'Sunflower', sans-serif">썬플라워</option>
  <option value="'Poor Story', cursive">푸어스토리</option>
  <option value="'Orbit', sans-serif">Orbit</option>
  <option value="'Nanum Brush Script', cursive">나눔손글씨</option>
  <option value="'Arial', sans-serif">Arial</option>
  <option value="'Georgia', serif">Georgia</option>
</select>

            <label style={labelStyle}>글자 크기</label>
            <input
              type="number"
              value={selectedElement.fontSize || 24}
              onChange={(e) =>
                updateSelectedElement({ fontSize: Number(e.target.value) })
              }
              style={inputStyle}
            />

            <label style={labelStyle}>글자 색상</label>
            <input
              type="color"
              value={selectedElement.color || "#111827"}
              onChange={(e) =>
                updateSelectedElement({ color: e.target.value })
              }
              style={colorInputStyle}
            />

<label style={labelStyle}>글자 굵기</label>
<select
  value={selectedElement.fontWeight || 700}
  onChange={(e) =>
    updateSelectedElement({ fontWeight: Number(e.target.value) } as any)
  }
  style={inputStyle}
>
  <option value={400}>보통</option>
  <option value={700}>굵게</option>
  <option value={900}>아주 굵게</option>
</select>

<label style={labelStyle}>정렬</label>
<select
  value={selectedElement.textAlign || "left"}
  onChange={(e) =>
    updateSelectedElement({ textAlign: e.target.value as any })
  }
  style={inputStyle}
>
  <option value="left">왼쪽</option>
  <option value="center">가운데</option>
  <option value="right">오른쪽</option>
</select>
          </>
        ) : null}

{selectedElement.type === "image" ? (
  <>
    <label style={labelStyle}>이미지 URL</label>
    <input
      value={selectedElement.url || ""}
      onChange={(e) =>
        updateSelectedElement({ url: e.target.value } as any)
      }
      placeholder="/uploads/example.png"
      style={inputStyle}
    />

    <label style={labelStyle}>이미지 맞춤</label>
    <select
      value={selectedElement.objectFit || "cover"}
      onChange={(e) =>
        updateSelectedElement({ objectFit: e.target.value as any })
      }
      style={inputStyle}
    >
      <option value="cover">꽉 채우기</option>
      <option value="contain">전체 보이기</option>
      <option value="fill">늘려 채우기</option>
    </select>
  </>
) : null}

{selectedElement.type === "image" ? (
  <>
    <label style={labelStyle}>이미지 둥글기</label>
    <input
      type="number"
      value={(selectedElement as any).borderRadius || 0}
      onChange={(e) =>
        updateSelectedElement({ borderRadius: Number(e.target.value) } as any)
      }
      style={inputStyle}
    />
  </>
) : null}

        {"backgroundColor" in selectedElement ? (
          <>
            <label style={labelStyle}>배경 색상</label>
            <input
              type="color"
              value={selectedElement.backgroundColor || "#ffffff"}
              onChange={(e) =>
                updateSelectedElement({ backgroundColor: e.target.value })
              }
              style={colorInputStyle}
            />
          </>
        ) : null}

{selectedElement.type === "shape" ? (
  <>
    <label style={labelStyle}>테두리 색상</label>
    <input
      type="color"
      value={selectedElement.borderColor || "#e2e8f0"}
      onChange={(e) =>
        updateSelectedElement({ borderColor: e.target.value } as any)
      }
      style={colorInputStyle}
    />

    <label style={labelStyle}>테두리 두께</label>
    <input
      type="number"
      value={selectedElement.borderWidth || 0}
      onChange={(e) =>
        updateSelectedElement({ borderWidth: Number(e.target.value) } as any)
      }
      style={inputStyle}
    />

    <label style={labelStyle}>도형 종류</label>
    <select
      value={selectedElement.shape || "rect"}
      onChange={(e) =>
        updateSelectedElement({ shape: e.target.value as any })
      }
      style={inputStyle}
    >
      <option value="rect">사각형</option>
      <option value="circle">원형</option>
    </select>
  </>
) : null}

        {selectedElement.type === "button" ? (
          <>
            <label style={labelStyle}>버튼 동작</label>
            <select
              value={selectedElement.action || "openForm"}
              onChange={(e) =>
                updateSelectedElement({ action: e.target.value as any })
              }
              style={inputStyle}
            >
              <option value="openForm">상담폼 열기</option>
              <option value="tel">전화 연결</option>
              <option value="link">링크 열기</option>
            </select>

            <label style={labelStyle}>전화번호</label>
            <input
              value={selectedElement.telNumber || ""}
              onChange={(e) =>
                updateSelectedElement({ telNumber: e.target.value })
              }
              placeholder="01012345678"
              style={inputStyle}
            />

            <label style={labelStyle}>링크 URL</label>
            <input
              value={selectedElement.href || ""}
              onChange={(e) =>
                updateSelectedElement({ href: e.target.value })
              }
              placeholder="https://..."
              style={inputStyle}
            />

	<label style={labelStyle}>글자 크기</label>
<input
  type="number"
  value={selectedElement.fontSize || 34}
  onChange={(e) =>
    updateSelectedElement({ fontSize: Number(e.target.value) } as any)
  }
  style={inputStyle}
/>

<label style={labelStyle}>글자 굵기</label>
<select
  value={selectedElement.fontWeight || 900}
  onChange={(e) =>
    updateSelectedElement({ fontWeight: Number(e.target.value) } as any)
  }
  style={inputStyle}
>
  <option value={400}>보통</option>
  <option value={700}>굵게</option>
  <option value={900}>아주 굵게</option>
</select>

	<label style={labelStyle}>버튼 둥글기</label>
<input
  type="number"
  value={selectedElement.borderRadius || 0}
  onChange={(e) =>
    updateSelectedElement({ borderRadius: Number(e.target.value) })
  }
  style={inputStyle}
/>

<label style={labelStyle}>글자 색상</label>
<input
  type="color"
  value={selectedElement.color || "#ffffff"}
  onChange={(e) =>
    updateSelectedElement({ color: e.target.value })
  }
  style={colorInputStyle}
/>

<label style={labelStyle}>새창 열기</label>
<select
  value={selectedElement.target || "_blank"}
  onChange={(e) =>
    updateSelectedElement({ target: e.target.value as any })
  }
  style={inputStyle}
>
  <option value="_blank">새창</option>
  <option value="_self">현재창</option>
</select>

            <label style={labelStyle}>Hover 효과</label>
            <select
              value={selectedElement.hoverEffect || "none"}
              onChange={(e) =>
                updateSelectedElement({ hoverEffect: e.target.value as any })
              }
              style={inputStyle}
            >
              <option value="none">없음</option>
              <option value="lift">살짝 위로</option>
              <option value="scale">확대</option>
              <option value="glow">그림자 강조</option>
            </select>
          </>
        ) : null}

<label style={labelStyle}>요소 상태</label>

<div
  style={{
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  }}
>
  <button
    type="button"
    onClick={() =>
      updateSelectedElement({
        locked: !selectedElement.locked,
      } as any)
    }
    style={{
      ...panelButtonStyle,
      minHeight: 42,
      background: selectedElement.locked
        ? "#dbeafe"
        : "#f8fafc",
      borderColor: selectedElement.locked
        ? "#93c5fd"
        : "#e2e8f0",
    }}
  >
    {selectedElement.locked ? "잠금 해제" : "요소 잠금"}
  </button>

  <button
    type="button"
    onClick={() =>
      updateSelectedElement({
        hidden: !selectedElement.hidden,
      } as any)
    }
    style={{
      ...panelButtonStyle,
      minHeight: 42,
      background: selectedElement.hidden
        ? "#fee2e2"
        : "#f8fafc",
      borderColor: selectedElement.hidden
        ? "#fca5a5"
        : "#e2e8f0",
    }}
  >
    {selectedElement.hidden ? "숨김 해제" : "요소 숨김"}
  </button>
</div>

<label style={labelStyle}>회전</label>
<input
  type="number"
  value={(selectedElement as any).rotation || 0}
  onChange={(e) =>
    updateSelectedElement({ rotation: Number(e.target.value) } as any)
  }
  style={inputStyle}
  placeholder="0"
/>

        <label style={labelStyle}>위치 / 크기</label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <input
            type="number"
            value={selectedElement.x || 0}
            onChange={(e) => updateSelectedElement({ x: Number(e.target.value) })}
            style={inputStyle}
            placeholder="X"
          />
          <input
            type="number"
            value={selectedElement.y || 0}
            onChange={(e) => updateSelectedElement({ y: Number(e.target.value) })}
            style={inputStyle}
            placeholder="Y"
          />
          <input
            type="number"
            value={selectedElement.width || 100}
            onChange={(e) =>
              updateSelectedElement({ width: Number(e.target.value) })
            }
            style={inputStyle}
            placeholder="W"
          />
          <input
            type="number"
            value={selectedElement.height || 100}
            onChange={(e) =>
              updateSelectedElement({ height: Number(e.target.value) })
            }
            style={inputStyle}
            placeholder="H"
          />
        </div>
      </Panel>
    );
  }

  if (activeTool === "text") {
    return (
      <Panel title="텍스트">
        <PanelButton onClick={addTitleText}>제목 텍스트 추가</PanelButton>
        <PanelButton onClick={addSubText}>부제목 텍스트 추가</PanelButton>
        <PanelButton onClick={addBodyText}>본문 텍스트 추가</PanelButton>
      </Panel>
    );
  }

  if (activeTool === "button") {
    return (
      <Panel title="버튼">
        <PanelButton onClick={addConsultButton}>상담 신청 버튼</PanelButton>
        <PanelButton onClick={addTelButton}>전화 버튼</PanelButton>
        <PanelButton onClick={addLinkButton}>링크 버튼</PanelButton>
      </Panel>
    );
  }

  if (activeTool === "image") {
    return (
      <Panel title="사진">
        <PanelButton onClick={addImageBox}>이미지 박스 추가</PanelButton>
        <PanelButton onClick={() => uploadInputRef.current?.click()}>
          이미지 업로드해서 추가
        </PanelButton>
      </Panel>
    );
  }

  if (activeTool === "upload") {
    return (
      <Panel title="업로드">
        <PanelButton onClick={() => uploadInputRef.current?.click()}>
          내 이미지 업로드
        </PanelButton>
        <div style={hintStyle}>업로드한 이미지는 캔버스에 바로 추가됩니다.</div>
      </Panel>
    );
  }

  if (activeTool === "element") {
  return (
    <Panel title="요소">
      <div style={sectionTitleStyle}>기본 도형</div>

      <div style={assetGridStyle}>
        <AssetButton title="사각형" onClick={addRect}>
          <span style={{ width: 34, height: 34, background: "#64748b" }} />
        </AssetButton>

        <AssetButton title="원형" onClick={addCircle}>
          <span
            style={{
              width: 38,
              height: 38,
              borderRadius: 999,
              background: "#64748b",
            }}
          />
        </AssetButton>

        <AssetButton title="별" onClick={() => addSvg("star")}>
          <svg viewBox="0 0 100 100" style={{ width: 42, height: 42 }}>
            <polygon
              points="50,8 61,36 91,36 67,55 76,86 50,68 24,86 33,55 9,36 39,36"
              fill="#64748b"
            />
          </svg>
        </AssetButton>

        <AssetButton title="하트" onClick={() => addSvg("heart")}>
          <svg viewBox="0 0 100 100" style={{ width: 42, height: 42 }}>
            <path
              d="M50 85 C20 60 8 42 18 25 C27 10 43 16 50 30 C57 16 73 10 82 25 C92 42 80 60 50 85Z"
              fill="#64748b"
            />
          </svg>
        </AssetButton>
      </div>

      <div style={sectionTitleStyle}>선</div>

      <div style={assetGridStyle}>
        <AssetButton title="실선" onClick={() => addSvg("line")}>
          <span
            style={{
              width: 54,
              height: 4,
              borderRadius: 999,
              background: "#475569",
            }}
          />
        </AssetButton>

        <AssetButton title="점선" onClick={() => addSvg("line-dashed")}>
          <span
            style={{
              width: 54,
              height: 4,
              borderRadius: 999,
              background:
                "repeating-linear-gradient(to right, #475569 0 7px, transparent 7px 11px)",
            }}
          />
        </AssetButton>

        <AssetButton title="오른쪽 화살표" onClick={() => addSvg("arrow-right")}>
          <svg viewBox="0 0 100 100" style={{ width: 52, height: 52 }}>
            <line
              x1="10"
              y1="50"
              x2="78"
              y2="50"
              stroke="#475569"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <polyline
              points="60,25 85,50 60,75"
              fill="none"
              stroke="#475569"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </AssetButton>

        <AssetButton title="왼쪽 화살표" onClick={() => addSvg("arrow-left")}>
          <svg viewBox="0 0 100 100" style={{ width: 52, height: 52 }}>
            <line
              x1="22"
              y1="50"
              x2="90"
              y2="50"
              stroke="#475569"
              strokeWidth="8"
              strokeLinecap="round"
            />
            <polyline
              points="40,25 15,50 40,75"
              fill="none"
              stroke="#475569"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </AssetButton>
      </div>
    </Panel>
  );
}

  if (activeTool === "background") {
    return (
      <Panel title="배경">
        <div style={colorGridStyle}>
          {["#ffffff", "#f8fafc", "#fff7ed", "#fef3c7", "#ecfeff", "#fce7f3", "#111827", "#fbbf24"].map(
            (color) => (
              <button
                key={color}
                type="button"
                onClick={() => setBackgroundColor(color)}
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 14,
                  border: "1px solid #cbd5e1",
                  background: color,
                  cursor: "pointer",
                }}
              />
            )
          )}
        </div>

        <div style={{ height: 16 }} />

        <PanelButton onClick={() => setCanvasSize(1080, 1920)}>
          모바일 세로 1080×1920
        </PanelButton>
        <PanelButton onClick={() => setCanvasSize(1080, 1080)}>
          정사각형 1080×1080
        </PanelButton>
        <PanelButton onClick={() => setCanvasSize(1200, 630)}>
          OG 이미지 1200×630
        </PanelButton>
      </Panel>
    );
  }

  if (activeTool === "form") {
    return (
      <Panel title="상담폼">
        <PanelButton onClick={addConsultButton}>
          상담 신청 버튼 추가
        </PanelButton>
        <div style={hintStyle}>
          다음 단계에서 상담폼 자체를 캔버스 요소로 추가해서 이동/크기조절 가능하게 만들 예정입니다.
        </div>
      </Panel>
    );
  }

if (activeTool === "host" && isHostEditor) {
  const updateFieldOptions = (
    fieldKey: string,
    options: Array<{ label: string; value: string }>
  ) => {
    onChange({
      ...value,
      fields: (value.fields || []).map((field: any) =>
        field.fieldKey === fieldKey
          ? {
              ...field,
              options,
            }
          : field
      ),
    });
  };

  const finalEducationField = (value.fields || []).find(
    (field: any) => field.fieldKey === "finalEducation"
  );

  const desiredCourseField = (value.fields || []).find(
    (field: any) => field.fieldKey === "desiredCourse"
  );

  const renderOptionEditor = (
    title: string,
    fieldKey: string,
    options: Array<{ label: string; value: string }>
  ) => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={sectionTitleStyle}>{title}</div>

        {options.map((option, index) => (
          <div
            key={`${fieldKey}-${index}`}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto",
              gap: 6,
            }}
          >
            <input
              value={option.label}
              onChange={(e) => {
                const nextOptions = options.map((item, itemIndex) =>
                  itemIndex === index
                    ? {
                        label: e.target.value,
                        value: e.target.value,
                      }
                    : item
                );

                updateFieldOptions(fieldKey, nextOptions);
              }}
              style={inputStyle}
            />

            <button
              type="button"
              onClick={() => {
                const nextOptions = options.filter(
                  (_item, itemIndex) => itemIndex !== index
                );

                updateFieldOptions(fieldKey, nextOptions);
              }}
              style={{
                ...panelButtonStyle,
                minHeight: 40,
                padding: "0 10px",
                color: "#dc2626",
              }}
            >
              삭제
            </button>
          </div>
        ))}

        <PanelButton
          onClick={() => {
            updateFieldOptions(fieldKey, [
              ...options,
              {
                label: "새 옵션",
                value: "새 옵션",
              },
            ]);
          }}
        >
          옵션 추가
        </PanelButton>
      </div>
    );
  };

  return (
    <Panel title="호스트 설정">
      <div style={hintStyle}>
        이 메뉴는 시스템관리에서 기본 디자인을 편집할 때만 표시됩니다.
        담당자 개인 페이지 꾸미기에서는 보이지 않습니다.
      </div>

      <label style={labelStyle}>개인정보 동의 문구</label>
      <textarea
        value={value.agreementText || ""}
        onChange={(e) =>
          onChange({
            ...value,
            agreementText: e.target.value,
          })
        }
        style={textareaStyle}
      />

      {renderOptionEditor(
        "최종학력 선택 옵션",
        "finalEducation",
        finalEducationField?.options || []
      )}

      {renderOptionEditor(
        "희망과정 선택 옵션",
        "desiredCourse",
        desiredCourseField?.options || []
      )}
    </Panel>
  );
}

  return (
    <Panel title="템플릿">
      <div style={hintStyle}>
        현재는 저장된 캔버스를 직접 편집하는 단계입니다. 다음에 템플릿 미리보기/적용 패널을 붙입니다.
      </div>
    </Panel>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 900,
          color: "#0f172a",
          marginBottom: 14,
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {children}
      </div>
    </div>
  );
}

function PanelButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} style={panelButtonStyle}>
      {children}
      <span style={{ marginLeft: "auto", fontSize: 18 }}>＋</span>
    </button>
  );
}

function AssetButton({
  title,
  children,
  onClick,
}: {
  title: string;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      style={assetButtonStyle}
    >
      {children}
    </button>
  );
}

const panelButtonStyle: React.CSSProperties = {
  minHeight: 48,
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  background: "#f8fafc",
  color: "#0f172a",
  fontSize: 14,
  fontWeight: 800,
  padding: "0 14px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  textAlign: "left",
};

const outlineButtonStyle: React.CSSProperties = {
  height: 38,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid #cbd5e1",
  background: "#fff",
  color: "#334155",
  fontWeight: 800,
  cursor: "pointer",
};

const saveButtonStyle: React.CSSProperties = {
  height: 38,
  padding: "0 18px",
  borderRadius: 10,
  border: "none",
  background: "#0f172a",
  color: "#fff",
  fontWeight: 900,
  cursor: "pointer",
};

const hintStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 14,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  color: "#64748b",
  fontSize: 13,
  lineHeight: 1.6,
};

const colorGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 46px)",
  gap: 10,
};

const assetGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: 8,
  padding: 10,
  borderRadius: 16,
  background: "#f1f5f9",
};

const assetButtonStyle: React.CSSProperties = {
  height: 58,
  border: "none",
  borderRadius: 14,
  background: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  color: "#475569",
  marginTop: 8,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 40,
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "0 10px",
  fontSize: 13,
  fontWeight: 700,
  boxSizing: "border-box",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 86,
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: 10,
  fontSize: 13,
  fontWeight: 700,
  resize: "vertical",
  boxSizing: "border-box",
};

const colorInputStyle: React.CSSProperties = {
  width: "100%",
  height: 42,
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: 4,
  background: "#fff",
  cursor: "pointer",
};

const sectionTitleStyle: React.CSSProperties = {
  marginTop: 12,
  paddingTop: 12,
  borderTop: "1px solid #e2e8f0",
  fontSize: 12,
  fontWeight: 900,
  color: "#64748b",
};