import { useEffect, useMemo, useState } from "react";
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

type Props = {
  value?: FormCanvasConfig;
  onChange: (next: FormCanvasConfig) => void;
  onUploadImage?: (file: File) => Promise<string>;
  selectedElementId?: string | null;
  onSelectedElementIdChange?: (id: string | null) => void;
  compact?: boolean;
  renderFormPreview?: () => any;
};

function normalizeCanvas(value?: FormCanvasConfig): FormCanvasConfig {
  const defaultCanvas = createDefaultCompanyCanvasConfig();

  if (
    !value ||
    !Array.isArray(value.elements) ||
    value.elements.length === 0
  ) {
    return defaultCanvas;
  }

  return {
    ...defaultCanvas,
    ...value,
    enabled: true,
    elements: value.elements,
  };
}

export default function FormCanvasEditor({
  value,
  onChange,
  onUploadImage,
  selectedElementId,
  onSelectedElementIdChange,
  compact = false,
  renderFormPreview,
}: Props) {
  const canvas = normalizeCanvas(value);
  const [selectedId, setSelectedId] = useState<string | null>(null);
const actualSelectedId =
  typeof selectedElementId === "undefined" ? selectedId : selectedElementId;

const setActualSelectedId = (id: string | null) => {
  setSelectedId(id);
  onSelectedElementIdChange?.(id);
};

const [selectedIds, setSelectedIds] = useState<string[]>([]);
const [zoom, setZoom] = useState(compact ? 0.42 : 0.32);
useEffect(() => {
  if (!compact) return;
  setZoom(0.42);
}, [compact]);
const [snapEnabled, setSnapEnabled] = useState(true);
const [gridVisible, setGridVisible] = useState(true);
const [gridSnapEnabled, setGridSnapEnabled] = useState(true);
const [undoStack, setUndoStack] = useState<FormCanvasConfig[]>([]);
const [redoStack, setRedoStack] = useState<FormCanvasConfig[]>([]);
const [copiedElements, setCopiedElements] = useState<FormCanvasElement[]>([]);
const [historyDragStarted, setHistoryDragStarted] = useState(false);
const [historyResizeStarted, setHistoryResizeStarted] = useState(false);


const [dragState, setDragState] = useState<{
  ids: string[];
  startClientX: number;
  startClientY: number;
  startPositions: Record<string, { x: number; y: number }>;
} | null>(null);

const [resizeState, setResizeState] = useState<{
  id: string;
  handle: "nw" | "ne" | "sw" | "se";
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  startWidth: number;
  startHeight: number;
} | null>(null);

const [selectionBox, setSelectionBox] = useState<{
  startX: number;
  startY: number;
  x: number;
  y: number;
  width: number;
  height: number;
} | null>(null);

const [editingTextId, setEditingTextId] = useState<string | null>(null);

const [snapGuide, setSnapGuide] = useState<{
  x?: number;
  y?: number;
} | null>(null);

  const selectedElement = useMemo(
  () => canvas.elements.find((el) => el.id === actualSelectedId),
  [canvas.elements, actualSelectedId]
);

const isRequiredFormElement = (element?: FormCanvasElement | null) => {
  return Boolean((element as any)?.requiredFormElement);
};

const selectedElements = useMemo(
  () => canvas.elements.filter((el) => selectedIds.includes(el.id)),
  [canvas.elements, selectedIds]
);

const sortedVisibleElements = useMemo(() => {
  return [...canvas.elements]
    .filter((el) => !el.hidden)
    .sort((a, b) => Number(a.zIndex ?? 0) - Number(b.zIndex ?? 0));
}, [canvas.elements]);

const sortedLayerElements = useMemo(() => {
  return [...canvas.elements].sort(
    (a, b) => Number(b.zIndex ?? 0) - Number(a.zIndex ?? 0)
  );
}, [canvas.elements]);

const sanitizeElements = (elements: FormCanvasElement[]) => {
  return elements.map((el, i) => {
    const width = Math.max(40, Number(el.width) || 40);
    const height = Math.max(40, Number(el.height) || 40);

    return {
  ...el,
  x: Math.min(Math.max(0, Number(el.x) || 0), Math.max(0, canvas.width - width)),
  y: Math.min(Math.max(0, Number(el.y) || 0), Math.max(0, canvas.height - height)),
  width,
  height,
  zIndex: Number(el.zIndex) || i + 1,
  hidden: !!el.hidden,
  locked: !!el.locked,
  requiredFormElement: !!(el as any).requiredFormElement,
} as FormCanvasElement;
  });
};

const cloneCanvas = (target: FormCanvasConfig): FormCanvasConfig => ({
  ...target,
  elements: (target.elements || []).map((el) => ({ ...el } as FormCanvasElement)),
});

const pushUndoHistory = () => {
  setUndoStack((prev) => {
    const next = [...prev, cloneCanvas(canvas)];
    return next.slice(-50);
  });

  setRedoStack([]);
};

 const updateCanvas = (
  patch: Partial<FormCanvasConfig>,
  options?: { skipHistory?: boolean }
) => {
  const nextElements = patch.elements ?? canvas.elements;

  const nextCanvas: FormCanvasConfig = {
    ...canvas,
    ...patch,
    elements: sanitizeElements(nextElements),
  };

  if (!options?.skipHistory) {
    pushUndoHistory();
  }

  onChange(nextCanvas);
};

const updateCanvasElementsOnly = (elements: FormCanvasElement[]) => {
  onChange({
    ...canvas,
    elements,
  });
};

const undoCanvas = () => {
  setUndoStack((prev) => {
    if (prev.length === 0) return prev;

    const previous = prev[prev.length - 1];
    const rest = prev.slice(0, -1);

    setRedoStack((redoPrev) => [...redoPrev, cloneCanvas(canvas)].slice(-50));

    onChange(cloneCanvas(previous));
    setActualSelectedId(null);
    setSelectedIds([]);

    return rest;
  });
};

const redoCanvas = () => {
  setRedoStack((prev) => {
    if (prev.length === 0) return prev;

    const next = prev[prev.length - 1];
    const rest = prev.slice(0, -1);

    setUndoStack((undoPrev) => [...undoPrev, cloneCanvas(canvas)].slice(-50));

    onChange(cloneCanvas(next));
    setActualSelectedId(null);
    setSelectedIds([]);

    return rest;
  });
};

  const updateElement = (id: string, patch: Partial<FormCanvasElement>) => {
    updateCanvas({
      elements: canvas.elements.map((el) =>
        el.id === id ? ({ ...el, ...patch } as FormCanvasElement) : el
      ),
    });
  };

const updateElementPositionSize = (
  element: FormCanvasElement,
  patch: Partial<FormCanvasElement>
) => {
  const nextWidth = Math.max(40, Number(patch.width ?? element.width) || 40);
  const nextHeight = Math.max(40, Number(patch.height ?? element.height) || 40);

  const nextX = Math.min(
    Math.max(0, Number(patch.x ?? element.x) || 0),
    Math.max(0, canvas.width - nextWidth)
  );

  const nextY = Math.min(
    Math.max(0, Number(patch.y ?? element.y) || 0),
    Math.max(0, canvas.height - nextHeight)
  );

  updateElement(element.id, {
    ...patch,
    x: nextX,
    y: nextY,
    width: nextWidth,
    height: nextHeight,
  } as Partial<FormCanvasElement>);
};

  const addText = () => {
    const next = createCanvasTextElement();

    updateCanvas({
      enabled: true,
      elements: [...canvas.elements, next],
    });

    setActualSelectedId(next.id);
setSelectedIds([next.id]);
  };

  const addImage = () => {
    const next = createCanvasImageElement();

    updateCanvas({
      enabled: true,
      elements: [...canvas.elements, next],
    });

    setActualSelectedId(next.id);
setSelectedIds([next.id]);
  };

  const addButton = () => {
    const next = createCanvasButtonElement();

    updateCanvas({
      enabled: true,
      elements: [...canvas.elements, next],
    });

    setActualSelectedId(next.id);
setSelectedIds([next.id]);
  };

const addRect = () => {
  const next = createCanvasRectElement();

  updateCanvas({
    enabled: true,
    elements: [...canvas.elements, next],
  });

  setActualSelectedId(next.id);
setSelectedIds([next.id]);
};

const addCircle = () => {
  const next = createCanvasCircleElement();

  updateCanvas({
    enabled: true,
    elements: [...canvas.elements, next],
  });

  setActualSelectedId(next.id);
setSelectedIds([next.id]);
};

const addSvg = (
  svgName: "line" | "line-dashed" | "arrow-right" | "arrow-left" | "star" | "heart"
) => {
  const next = createCanvasSvgElement(svgName);

  updateCanvas({
    enabled: true,
    elements: [...canvas.elements, next],
  });

  setActualSelectedId(next.id);
  setSelectedIds([next.id]);
};

const uploadSelectedImage = async (file: File) => {
  if (!selectedElement || selectedElement.type !== "image") return;

  if (!onUploadImage) {
    alert("이미지 업로드 함수가 연결되어 있지 않습니다.");
    return;
  }

  const url = await onUploadImage(file);

  updateElement(selectedElement.id, {
    url,
  } as Partial<FormCanvasElement>);
};

const duplicateSelected = () => {
  const targets = selectedElements.length > 0 ? selectedElements : selectedElement ? [selectedElement] : [];
  const duplicatableTargets = targets.filter(
  (el) => !el.locked && !isRequiredFormElement(el)
);

  if (duplicatableTargets.length === 0) return;

  const copiedElements: FormCanvasElement[] = duplicatableTargets.map((element, index) => ({
    ...element,
    id: `${element.type}-${Date.now()}-${Math.floor(Math.random() * 10000)}-${element.id}`,
    x: element.x + 30,
    y: element.y + 30,
    zIndex:
  Math.max(0, ...canvas.elements.map((el) => Number(el.zIndex ?? 0))) +
  index +
  1,
  } as FormCanvasElement));

  updateCanvas({
  elements: [...canvas.elements, ...copiedElements],
});

  setActualSelectedId(copiedElements[copiedElements.length - 1]?.id ?? null);
  setSelectedIds(copiedElements.map((el) => el.id));
};

const duplicateElementById = (id: string) => {
  const target = canvas.elements.find((el) => el.id === id);
  if (!target || target.locked || isRequiredFormElement(target)) {
  if (target && isRequiredFormElement(target)) {
    alert("상담DB로 연결되는 기본 상담폼 요소는 복사할 수 없습니다. 위치/크기/디자인만 수정해주세요.");
  }
  return;
}

  const copied = {
    ...target,
    id: `${target.type}-${Date.now()}-${Math.floor(Math.random() * 10000)}-${target.id}`,
    x: target.x + 30,
    y: target.y + 30,
    zIndex: Math.max(0, ...canvas.elements.map((el) => Number(el.zIndex ?? 0))) + 1,
  } as FormCanvasElement;

  updateCanvas({
  elements: [...canvas.elements, copied],
});

  setActualSelectedId(copied.id);
  setSelectedIds([copied.id]);
};

const copySelectedElements = () => {
  const targets =
  selectedElements.length > 0
    ? selectedElements
    : selectedElement
      ? [selectedElement]
      : [];

if (targets.length === 0) return;

const blockedTargets = targets.filter((el) =>
  isRequiredFormElement(el)
);

if (blockedTargets.length > 0) {
  alert(
    "상담DB로 연결되는 기본 상담폼 요소는 복사할 수 없습니다."
  );
  return;
}

const copyableTargets = targets.filter(
  (el) => !el.locked
);

if (copyableTargets.length === 0) return;

setCopiedElements(
  copyableTargets.map(
    (el) => ({ ...el } as FormCanvasElement)
  )
);
};

const pasteCopiedElements = () => {
  if (copiedElements.length === 0) return;

  const maxZIndex = Math.max(
    0,
    ...canvas.elements.map((el) => Number(el.zIndex ?? 0))
  );

const filteredElements = copiedElements.filter(
  (el) => !isRequiredFormElement(el)
);

if (filteredElements.length === 0) {
  alert("복사 가능한 요소가 없습니다.");
  return;
}

 const pastedElements = filteredElements.map((element, index) => {
    const nextWidth = Number(element.width) || 100;
    const nextHeight = Number(element.height) || 100;

    const nextX = Math.min(
      Math.max(0, Number(element.x || 0) + 30),
      Math.max(0, canvas.width - nextWidth)
    );

    const nextY = Math.min(
      Math.max(0, Number(element.y || 0) + 30),
      Math.max(0, canvas.height - nextHeight)
    );

    return {
      ...element,
      id: `${element.type}-paste-${Date.now()}-${Math.floor(
        Math.random() * 10000
      )}-${index}`,
      x: nextX,
      y: nextY,
      zIndex: maxZIndex + index + 1,
      locked: false,
      hidden: false,
      requiredFormElement: false,
    } as FormCanvasElement;
  });

  updateCanvas({
    elements: [...canvas.elements, ...pastedElements],
  });

  setActualSelectedId(pastedElements[pastedElements.length - 1]?.id ?? null);
  setSelectedIds(pastedElements.map((el) => el.id));
};

const clearCanvasElements = () => {
  const protectedElements = canvas.elements.filter(
    (el) => el.locked || isRequiredFormElement(el)
  );

  const protectedCount = protectedElements.length;
  const removableCount = canvas.elements.length - protectedCount;

  if (removableCount <= 0) {
    alert("삭제할 수 있는 요소가 없습니다. 기본 상담폼 요소는 삭제할 수 없습니다.");
    return;
  }

  const ok = window.confirm(
    protectedCount > 0
      ? `잠금/기본 상담폼 요소 ${protectedCount}개는 유지하고, 나머지 ${removableCount}개 요소만 삭제할까요?`
      : "캔버스의 모든 요소를 삭제할까요?"
  );

  if (!ok) return;

  updateCanvas({
    elements: protectedElements,
  });

  setActualSelectedId(null);
  setSelectedIds([]);
};

const resetCanvas = () => {
  const protectedElements = canvas.elements.filter(
    (el) => el.locked || isRequiredFormElement(el)
  );

  const protectedCount = protectedElements.length;

  const ok = window.confirm(
    protectedCount > 0
      ? `잠금/기본 상담폼 요소 ${protectedCount}개는 유지하고, 캔버스 설정만 기본값으로 초기화할까요?`
      : "캔버스를 기본값으로 초기화할까요? 모든 요소와 배경 설정이 삭제됩니다."
  );

  if (!ok) return;

  const defaultCanvas = createDefaultCompanyCanvasConfig();

  updateCanvas({
    ...defaultCanvas,
    elements:
  protectedElements.length > 0
    ? [
        ...defaultCanvas.elements.filter(
          (el) => !protectedElements.some((protectedEl) => protectedEl.id === el.id)
        ),
        ...protectedElements,
      ]
    : defaultCanvas.elements,
  });

  setActualSelectedId(null);
  setSelectedIds([]);
};

const removeElementById = (id: string) => {
  const target = canvas.elements.find((el) => el.id === id);
  if (!target || target.locked) return;

  if (isRequiredFormElement(target)) {
    alert("상담DB로 연결되는 기본 상담폼 요소는 삭제할 수 없습니다. 위치/크기/디자인만 수정해주세요.");
    return;
  }

  updateCanvas({
    elements: canvas.elements.filter((el) => el.id !== id),
  });

  setActualSelectedId(null);
  setSelectedIds([]);
};

 const removeSelected = () => {
  const targetIds =
    selectedIds.length > 0
      ? selectedIds
      : actualSelectedId
        ? [actualSelectedId]
        : [];

  if (targetIds.length === 0) return;

  const targets = canvas.elements.filter((el) => targetIds.includes(el.id));

  if (targets.some((el) => isRequiredFormElement(el))) {
    alert("상담DB로 연결되는 기본 상담폼 요소는 삭제할 수 없습니다. 위치/크기/디자인만 수정해주세요.");
    return;
  }

  const removableIds = targets
    .filter((el) => !el.locked)
    .map((el) => el.id);

  if (removableIds.length === 0) return;

  updateCanvas({
    elements: canvas.elements.filter((el) => !removableIds.includes(el.id)),
  });

  setActualSelectedId(null);
  setSelectedIds([]);
};

const reorderElement = (
  id: string,
  mode: "front" | "forward" | "backward" | "back"
) => {
  const target = canvas.elements.find((el) => el.id === id);
  if (!target || target.locked || target.hidden) return;

  const visible = [...canvas.elements]
    .filter((el) => !el.hidden)
    .sort((a, b) => Number(a.zIndex ?? 0) - Number(b.zIndex ?? 0));

  const hidden = canvas.elements.filter((el) => el.hidden);

  const idx = visible.findIndex((el) => el.id === id);
  if (idx < 0) return;

  const nextVisible = [...visible];
  const [picked] = nextVisible.splice(idx, 1);

  if (!picked) return;

  if (mode === "front") {
    nextVisible.push(picked);
  }

  if (mode === "back") {
    nextVisible.unshift(picked);
  }

  if (mode === "forward") {
    nextVisible.splice(Math.min(nextVisible.length, idx + 1), 0, picked);
  }

  if (mode === "backward") {
    nextVisible.splice(Math.max(0, idx - 1), 0, picked);
  }

  const nextElements = [...nextVisible, ...hidden].map((el, index) => ({
    ...el,
    zIndex: index + 1,
  })) as FormCanvasElement[];

  updateCanvas({
    elements: nextElements,
  });
};

const getElementLabel = (element: FormCanvasElement) => {
  if (element.type === "text") {
    return `텍스트 · ${element.text?.slice(0, 12) || "새 텍스트"}`;
  }

  if (element.type === "image") {
    return "이미지";
  }

  if (element.type === "button") {
    return `버튼 · ${element.text?.slice(0, 12) || "버튼"}`;
  }

  if (element.type === "shape") {
    return element.shape === "circle" ? "원형 도형" : "사각형 도형";
  }

  return "요소";
};

  const scale = zoom;
  const canvasWidth = canvas.width * scale;
  const canvasHeight = canvas.height * scale;

const alignSelected = (
  type: "left" | "centerX" | "right" | "top" | "centerY" | "bottom"
) => {
  const targets =
    selectedElements.length > 0
      ? selectedElements.filter((el) => !el.locked)
      : selectedElement && !selectedElement.locked
        ? [selectedElement]
        : [];

  if (targets.length === 0) return;

  const minX = Math.min(...targets.map((el) => el.x));
  const minY = Math.min(...targets.map((el) => el.y));
  const maxX = Math.max(...targets.map((el) => el.x + el.width));
  const maxY = Math.max(...targets.map((el) => el.y + el.height));

  updateCanvas({
    elements: canvas.elements.map((el) => {
      if (!targets.some((target) => target.id === el.id)) return el;

      let nextX = el.x;
      let nextY = el.y;

      if (type === "left") nextX = minX;
      if (type === "centerX") nextX = Math.round((minX + maxX - el.width) / 2);
      if (type === "right") nextX = maxX - el.width;

      if (type === "top") nextY = minY;
      if (type === "centerY") nextY = Math.round((minY + maxY - el.height) / 2);
      if (type === "bottom") nextY = maxY - el.height;

      return {
        ...el,
        x: Math.min(Math.max(0, nextX), Math.max(0, canvas.width - el.width)),
        y: Math.min(Math.max(0, nextY), Math.max(0, canvas.height - el.height)),
      } as FormCanvasElement;
    }),
  });
};

const distributeSelected = (type: "horizontal" | "vertical") => {
  const targets = selectedElements.filter((el) => !el.locked);

  if (targets.length < 3) return;

  const sorted =
    type === "horizontal"
      ? [...targets].sort((a, b) => a.x - b.x)
      : [...targets].sort((a, b) => a.y - b.y);

  const first = sorted[0];
  const last = sorted[sorted.length - 1];

  if (!first || !last) return;

  if (type === "horizontal") {
    const totalWidth = sorted.reduce((sum, el) => sum + el.width, 0);
    const space = (last.x + last.width - first.x - totalWidth) / (sorted.length - 1);

    let cursor = first.x;

    updateCanvas({
      elements: canvas.elements.map((el) => {
        const target = sorted.find((item) => item.id === el.id);
        if (!target) return el;

        const nextX = cursor;
        cursor += target.width + space;

        return {
          ...el,
          x: Math.round(Math.min(Math.max(0, nextX), Math.max(0, canvas.width - el.width))),
        } as FormCanvasElement;
      }),
    });

    return;
  }

  const totalHeight = sorted.reduce((sum, el) => sum + el.height, 0);
  const space = (last.y + last.height - first.y - totalHeight) / (sorted.length - 1);

  let cursor = first.y;

  updateCanvas({
    elements: canvas.elements.map((el) => {
      const target = sorted.find((item) => item.id === el.id);
      if (!target) return el;

      const nextY = cursor;
      cursor += target.height + space;

      return {
        ...el,
        y: Math.round(Math.min(Math.max(0, nextY), Math.max(0, canvas.height - el.height))),
      } as FormCanvasElement;
    }),
  });
};

const selectElement = (element: FormCanvasElement, append = false) => {
  setActualSelectedId(element.id);

  if (append) {
    setSelectedIds((prev) =>
      prev.includes(element.id)
        ? prev.filter((id) => id !== element.id)
        : [...prev, element.id]
    );
    return;
  }

  setSelectedIds([element.id]);
};

const startDrag = (e: React.MouseEvent, element: FormCanvasElement) => {
  e.stopPropagation();

  if (element.locked) {
    selectElement(element, e.shiftKey);
    return;
  }

  selectElement(element, e.shiftKey);

  const nextSelectedIds = e.shiftKey
  ? selectedIds.includes(element.id)
    ? selectedIds.filter((id) => id !== element.id)
    : [...selectedIds, element.id]
  : [element.id];

const ids =
  nextSelectedIds.length > 1 && nextSelectedIds.includes(element.id)
    ? nextSelectedIds
    : [element.id];

if (e.shiftKey && !nextSelectedIds.includes(element.id)) {
  setDragState(null);
  return;
}

const startPositions: Record<string, { x: number; y: number }> = {};

ids.forEach((id) => {
  const el = canvas.elements.find((e) => e.id === id);
  if (el) {
    startPositions[id] = { x: el.x, y: el.y };
  }
});

setHistoryDragStarted(false);

setDragState({
  ids,
  startClientX: e.clientX,
  startClientY: e.clientY,
  startPositions,
});
};

const applyElementSnap = (
  moving: FormCanvasElement,
  nextX: number,
  nextY: number
) => {
  if (!snapEnabled) {
    return { x: nextX, y: nextY, guide: null };
  }

  const SNAP_DISTANCE = 8;

  let snappedX = nextX;
  let snappedY = nextY;
  let guide: { x?: number; y?: number } | null = null;

  const movingLeft = nextX;
  const movingCenterX = nextX + moving.width / 2;
  const movingRight = nextX + moving.width;

  const movingTop = nextY;
  const movingCenterY = nextY + moving.height / 2;
  const movingBottom = nextY + moving.height;

const canvasCenterX = canvas.width / 2;
const canvasCenterY = canvas.height / 2;

const canvasXPairs = [
  { moving: movingLeft, target: 0, next: 0 },
  { moving: movingCenterX, target: canvasCenterX, next: canvasCenterX - moving.width / 2 },
  { moving: movingRight, target: canvas.width, next: canvas.width - moving.width },
];

for (const pair of canvasXPairs) {
  if (Math.abs(pair.moving - pair.target) <= SNAP_DISTANCE) {
    snappedX = Math.round(pair.next);
    guide = { ...(guide || {}), x: pair.target };
    break;
  }
}

const canvasYPairs = [
  { moving: movingTop, target: 0, next: 0 },
  { moving: movingCenterY, target: canvasCenterY, next: canvasCenterY - moving.height / 2 },
  { moving: movingBottom, target: canvas.height, next: canvas.height - moving.height },
];

for (const pair of canvasYPairs) {
  if (Math.abs(pair.moving - pair.target) <= SNAP_DISTANCE) {
    snappedY = Math.round(pair.next);
    guide = { ...(guide || {}), y: pair.target };
    break;
  }
}

  const otherElements = canvas.elements.filter(
    (el) =>
      el.id !== moving.id &&
      !dragState?.ids.includes(el.id) &&
      !el.hidden
  );

  for (const target of otherElements) {
    const targetLeft = target.x;
    const targetCenterX = target.x + target.width / 2;
    const targetRight = target.x + target.width;

    const targetTop = target.y;
    const targetCenterY = target.y + target.height / 2;
    const targetBottom = target.y + target.height;

    const xPairs = [
      { moving: movingLeft, target: targetLeft, next: targetLeft },
      { moving: movingCenterX, target: targetCenterX, next: targetCenterX - moving.width / 2 },
      { moving: movingRight, target: targetRight, next: targetRight - moving.width },
      { moving: movingLeft, target: targetRight, next: targetRight },
      { moving: movingRight, target: targetLeft, next: targetLeft - moving.width },
    ];

    for (const pair of xPairs) {
      if (Math.abs(pair.moving - pair.target) <= SNAP_DISTANCE) {
        snappedX = Math.round(pair.next);
        guide = { ...(guide || {}), x: pair.target };
        break;
      }
    }

    const yPairs = [
      { moving: movingTop, target: targetTop, next: targetTop },
      { moving: movingCenterY, target: targetCenterY, next: targetCenterY - moving.height / 2 },
      { moving: movingBottom, target: targetBottom, next: targetBottom - moving.height },
      { moving: movingTop, target: targetBottom, next: targetBottom },
      { moving: movingBottom, target: targetTop, next: targetTop - moving.height },
    ];

    for (const pair of yPairs) {
      if (Math.abs(pair.moving - pair.target) <= SNAP_DISTANCE) {
        snappedY = Math.round(pair.next);
        guide = { ...(guide || {}), y: pair.target };
        break;
      }
    }
  }

  return {
    x: snappedX,
    y: snappedY,
    guide,
  };
};

const applyResizeSnap = (
  target: FormCanvasElement,
  nextWidth: number,
  nextHeight: number
) => {
  if (!snapEnabled) {
    return { width: nextWidth, height: nextHeight, guide: null };
  }

  const SNAP_DISTANCE = 8;

  let snappedWidth = nextWidth;
  let snappedHeight = nextHeight;
  let guide: { x?: number; y?: number } | null = null;

  const nextRight = target.x + nextWidth;
  const nextBottom = target.y + nextHeight;

  const xTargets = [
    0,
    canvas.width / 2,
    canvas.width,
    ...canvas.elements
      .filter((el) => el.id !== target.id && !el.hidden)
      .flatMap((el) => [el.x, el.x + el.width / 2, el.x + el.width]),
  ];

  for (const x of xTargets) {
    if (Math.abs(nextRight - x) <= SNAP_DISTANCE) {
      snappedWidth = Math.max(40, Math.round(x - target.x));
      guide = { ...(guide || {}), x };
      break;
    }
  }

  const yTargets = [
    0,
    canvas.height / 2,
    canvas.height,
    ...canvas.elements
      .filter((el) => el.id !== target.id && !el.hidden)
      .flatMap((el) => [el.y, el.y + el.height / 2, el.y + el.height]),
  ];

  for (const y of yTargets) {
    if (Math.abs(nextBottom - y) <= SNAP_DISTANCE) {
      snappedHeight = Math.max(40, Math.round(y - target.y));
      guide = { ...(guide || {}), y };
      break;
    }
  }

  return {
    width: snappedWidth,
    height: snappedHeight,
    guide,
  };
};

const handleDragMove = (e: React.MouseEvent) => {
  if (resizeState) {
    handleResizeMove(e);
    return;
  }

  if (!dragState) return;

if (!historyDragStarted) {
  pushUndoHistory();
  setHistoryDragStarted(true);
}

  const dx = (e.clientX - dragState.startClientX) / scale;
  const dy = (e.clientY - dragState.startClientY) / scale;


let nextSnapGuide: { x?: number; y?: number } | null = null;

  const updated = canvas.elements.map((el) => {
    if (!dragState.ids.includes(el.id)) return el;
    if (el.locked) return el;

    const start = dragState.startPositions[el.id];
    if (!start) return el;

    let nextX = Math.round(start.x + dx);
    let nextY = Math.round(start.y + dy);

    const GRID_SIZE = 20;

    if (gridSnapEnabled && !e.shiftKey) {
  nextX = Math.round(nextX / GRID_SIZE) * GRID_SIZE;
  nextY = Math.round(nextY / GRID_SIZE) * GRID_SIZE;
}

const snapped = !e.shiftKey
  ? applyElementSnap(el, nextX, nextY)
  : { x: nextX, y: nextY, guide: null };

if (snapped.guide && !nextSnapGuide) {
  nextSnapGuide = snapped.guide;
}

return {
  ...el,
  x: Math.min(Math.max(0, snapped.x), Math.max(0, canvas.width - el.width)),
  y: Math.min(Math.max(0, snapped.y), Math.max(0, canvas.height - el.height)),
} as FormCanvasElement;
  });

setSnapGuide(nextSnapGuide);
  updateCanvasElementsOnly(updated);
};

const endDrag = () => {
  setDragState(null);
  setSnapGuide(null);
  setHistoryDragStarted(false);
  endResize();
};

const startResize = (
  e: React.MouseEvent,
  element: FormCanvasElement,
  handle: "nw" | "ne" | "sw" | "se" = "se"
) => {
  e.stopPropagation();
  e.preventDefault();

  if (element.locked) return;

  setActualSelectedId(element.id);
  setSelectedIds([element.id]);
  setDragState(null);

  setHistoryResizeStarted(false);

  setResizeState({
    id: element.id,
    handle,
    startClientX: e.clientX,
    startClientY: e.clientY,
    startX: element.x,
    startY: element.y,
    startWidth: element.width,
    startHeight: element.height,
  });
};

const startAreaSelect = (e: React.MouseEvent<HTMLDivElement>) => {
  if (dragState || resizeState) return;

  const rect = e.currentTarget.getBoundingClientRect();
  const startX = (e.clientX - rect.left) / scale;
  const startY = (e.clientY - rect.top) / scale;

  setActualSelectedId(null);
  setSelectedIds([]);

  setSelectionBox({
    startX,
    startY,
    x: startX,
    y: startY,
    width: 0,
    height: 0,
  });
};

const updateAreaSelect = (e: React.MouseEvent<HTMLDivElement>) => {
  if (!selectionBox) return;

  const rect = e.currentTarget.getBoundingClientRect();
  const currentX = (e.clientX - rect.left) / scale;
  const currentY = (e.clientY - rect.top) / scale;

  const x = Math.min(selectionBox.startX, currentX);
  const y = Math.min(selectionBox.startY, currentY);
  const width = Math.abs(currentX - selectionBox.startX);
  const height = Math.abs(currentY - selectionBox.startY);

  setSelectionBox({
    ...selectionBox,
    x,
    y,
    width,
    height,
  });
};

const updateAreaSelectByClientPoint = (clientX: number, clientY: number) => {
  if (!selectionBox) return;

  const canvasEl = document.querySelector(
    "[data-form-canvas-stage='true']"
  ) as HTMLDivElement | null;

  if (!canvasEl) return;

  const rect = canvasEl.getBoundingClientRect();
  const currentX = (clientX - rect.left) / scale;
  const currentY = (clientY - rect.top) / scale;

  const x = Math.min(selectionBox.startX, currentX);
  const y = Math.min(selectionBox.startY, currentY);
  const width = Math.abs(currentX - selectionBox.startX);
  const height = Math.abs(currentY - selectionBox.startY);

  setSelectionBox({
    ...selectionBox,
    x,
    y,
    width,
    height,
  });
};

const endAreaSelect = () => {
  if (!selectionBox) return;

if (selectionBox.width < 4 && selectionBox.height < 4) {
  setActualSelectedId(null);
  setSelectedIds([]);
  setSelectionBox(null);
  return;
}

  const pickedIds = canvas.elements
    .filter((el) => !el.hidden)
    .filter((el) => {
      const elLeft = el.x;
      const elTop = el.y;
      const elRight = el.x + el.width;
      const elBottom = el.y + el.height;

      const boxLeft = selectionBox.x;
      const boxTop = selectionBox.y;
      const boxRight = selectionBox.x + selectionBox.width;
      const boxBottom = selectionBox.y + selectionBox.height;

      return (
        elLeft < boxRight &&
        elRight > boxLeft &&
        elTop < boxBottom &&
        elBottom > boxTop
      );
    })
    .map((el) => el.id);

  setSelectedIds(pickedIds);
  setActualSelectedId(pickedIds[pickedIds.length - 1] || null);
  setSelectionBox(null);
};

const handleResizeMove = (e: React.MouseEvent) => {
  if (!resizeState) return;

  if (!historyResizeStarted) {
    pushUndoHistory();
    setHistoryResizeStarted(true);
  }

  const target = canvas.elements.find((el) => el.id === resizeState.id);
  if (!target) return;

  const dx = (e.clientX - resizeState.startClientX) / scale;
  const dy = (e.clientY - resizeState.startClientY) / scale;

  let nextX = resizeState.startX;
  let nextY = resizeState.startY;
  let nextWidth = resizeState.startWidth;
  let nextHeight = resizeState.startHeight;

  if (resizeState.handle.includes("e")) {
    nextWidth = resizeState.startWidth + dx;
  }

  if (resizeState.handle.includes("s")) {
    nextHeight = resizeState.startHeight + dy;
  }

  if (resizeState.handle.includes("w")) {
    nextX = resizeState.startX + dx;
    nextWidth = resizeState.startWidth - dx;
  }

  if (resizeState.handle.includes("n")) {
    nextY = resizeState.startY + dy;
    nextHeight = resizeState.startHeight - dy;
  }

  nextWidth = Math.round(Math.max(40, nextWidth));
  nextHeight = Math.round(Math.max(40, nextHeight));

  const GRID_SIZE = 20;

  if (gridSnapEnabled && !e.shiftKey) {
    nextX = Math.round(nextX / GRID_SIZE) * GRID_SIZE;
    nextY = Math.round(nextY / GRID_SIZE) * GRID_SIZE;
    nextWidth = Math.round(nextWidth / GRID_SIZE) * GRID_SIZE;
    nextHeight = Math.round(nextHeight / GRID_SIZE) * GRID_SIZE;
  }

  nextWidth = Math.max(40, nextWidth);
  nextHeight = Math.max(40, nextHeight);

  nextX = Math.min(Math.max(0, nextX), Math.max(0, canvas.width - nextWidth));
  nextY = Math.min(Math.max(0, nextY), Math.max(0, canvas.height - nextHeight));

  if (nextX + nextWidth > canvas.width) {
    nextWidth = canvas.width - nextX;
  }

  if (nextY + nextHeight > canvas.height) {
    nextHeight = canvas.height - nextY;
  }

  setSnapGuide(null);

  updateCanvasElementsOnly(
    canvas.elements.map((el) =>
      el.id === target.id
        ? ({
            ...el,
            x: nextX,
            y: nextY,
            width: nextWidth,
            height: nextHeight,
          } as FormCanvasElement)
        : el
    )
  );
};

const endResize = () => {
  setResizeState(null);
  setHistoryResizeStarted(false);
};

const renderElementToolbar = (el: FormCanvasElement) => {
  const isSelected =
    actualSelectedId === el.id || selectedIds.includes(el.id);

  if (!isSelected || el.locked) return null;

  return (
    <div
      onMouseDown={(e) => e.stopPropagation()}
      className="absolute left-1/2 top-0 z-[10000] flex max-w-[220px] flex-wrap -translate-x-1/2 -translate-y-[calc(100%+8px)] items-center justify-center gap-1 rounded-lg border bg-white px-2 py-1 shadow-lg"
    >
      <button
        type="button"
        title="삭제"
        onClick={(e) => {
          e.stopPropagation();
          removeElementById(el.id);
        }}
        className="text-xs text-red-500 hover:underline"
      >
        삭제
      </button>

      <button
        type="button"
        title="복제"
        onClick={(e) => {
  e.stopPropagation();

  setActualSelectedId(el.id);
  setSelectedIds([el.id]);

  duplicateElementById(el.id);
}}
        className="text-xs text-slate-700 hover:underline"
      >
        복제
      </button>

<button
  type="button"
  title="맨 뒤로 보내기"
  onClick={(e) => {
  e.stopPropagation();

  setActualSelectedId(el.id);
  setSelectedIds([el.id]);

  reorderElement(el.id, "back");
}}
  className="text-xs text-slate-700 hover:underline"
>
  ⏪
</button>

      <button
        type="button"
        title="뒤로 보내기"
        onClick={(e) => {
  e.stopPropagation();

  setActualSelectedId(el.id);
  setSelectedIds([el.id]);

  reorderElement(el.id, "backward");
}}
        className="text-xs text-slate-700 hover:underline"
      >
        ◀
      </button>

      <button
        type="button"
        title="앞으로 보내기"
        onClick={(e) => {
  e.stopPropagation();

  setActualSelectedId(el.id);
  setSelectedIds([el.id]);

  reorderElement(el.id, "forward");
}}
        className="text-xs text-slate-700 hover:underline"
      >
        ▶
      </button>

<button
  type="button"
  title="맨 앞으로 보내기"
  onClick={(e) => {
  e.stopPropagation();

  setActualSelectedId(el.id);
  setSelectedIds([el.id]);

  reorderElement(el.id, "front");
}}
  className="text-xs text-slate-700 hover:underline"
>
  ⏩
</button>

      {el.type === "text" ? (
        <>
          <button
            type="button"
            title="굵게"
            onClick={(e) => {
  e.stopPropagation();

  setActualSelectedId(el.id);
  setSelectedIds([el.id]);

  updateElement(el.id, {
    fontWeight: el.fontWeight === 800 ? 400 : 800,
  } as Partial<FormCanvasElement>);
}}
            className="text-xs font-bold"
          >
            B
          </button>

          <input
            type="color"
            title="텍스트 색상"
            value={el.color || "#000000"}
            onChange={(e) => {
  setActualSelectedId(el.id);
  setSelectedIds([el.id]);

  updateElement(el.id, {
    color: e.target.value,
  } as Partial<FormCanvasElement>);
}}
            className="h-5 w-5 cursor-pointer border"
          />
        </>
      ) : null}
    </div>
  );
};

const renderSvgContent = (el: any) => {
  const stroke = el.stroke || "#64748b";
  const fill = el.fill || "#64748b";
  const strokeWidth = el.strokeWidth || 8;

  if (el.svgName === "line") {
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

  if (el.svgName === "line-dashed") {
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

  if (el.svgName === "arrow-right") {
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

  if (el.svgName === "arrow-left") {
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

  if (el.svgName === "star") {
    return (
      <polygon
        points="50,8 61,36 91,36 67,55 76,86 50,68 24,86 33,55 9,36 39,36"
        fill={fill}
      />
    );
  }

  if (el.svgName === "heart") {
    return (
      <path
        d="M50 85 C20 60 8 42 18 25 C27 10 43 16 50 30 C57 16 73 10 82 25 C92 42 80 60 50 85Z"
        fill={fill}
      />
    );
  }

  return null;
};

const renderResizeHandle = (element: FormCanvasElement) => {
  if (!selectedIds.includes(element.id)) return null;
  if (element.locked) return null;

  const handles = [
    {
      key: "nw",
      className:
        "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize",
    },
    {
      key: "ne",
      className:
        "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize",
    },
    {
      key: "sw",
      className:
        "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize",
    },
    {
      key: "se",
      className:
        "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize",
    },
  ] as const;

  return (
    <>
      {handles.map((handle) => (
        <span
          key={handle.key}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            startResize(e, element, handle.key);
          }}
          className={`absolute z-50 h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow-lg ring-2 ring-blue-200 hover:scale-110 active:scale-95 ${handle.className}`}
          title="크기 조절"
        />
      ))}
    </>
  );
};

useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
  const target = e.target as HTMLElement | null;
  const tagName = target?.tagName?.toLowerCase();

  if (e.key === "Escape") {
    e.preventDefault();
    setEditingTextId(null);
    setActualSelectedId(null);
    setSelectedIds([]);
    setDragState(null);
    setResizeState(null);
    setSelectionBox(null);
    setSnapGuide(null);
    return;
  }

  if (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target?.isContentEditable
  ) {
    return;
  }

    const isCtrlOrMeta = e.ctrlKey || e.metaKey;

if (isCtrlOrMeta && e.key.toLowerCase() === "c") {
  e.preventDefault();
  copySelectedElements();
  return;
}

if (isCtrlOrMeta && e.key.toLowerCase() === "v") {
  e.preventDefault();
  pasteCopiedElements();
  return;
}

    if (isCtrlOrMeta && e.key.toLowerCase() === "z") {
      e.preventDefault();

      if (e.shiftKey) {
        redoCanvas();
      } else {
        undoCanvas();
      }

      return;
    }

    if (isCtrlOrMeta && e.key.toLowerCase() === "y") {
      e.preventDefault();
      redoCanvas();
      return;
    }

    if (!selectedElement) return;

    const movableElements =
      selectedElements.length > 0
        ? selectedElements.filter((el) => !el.locked)
        : selectedElement.locked
          ? []
          : [selectedElement];

    if (movableElements.length === 0) return;

    const step = e.shiftKey ? 10 : 1;

    const moveSelectedByKeyboard = (dx: number, dy: number) => {
      if (movableElements.length <= 1) {
        const target = movableElements[0];
        if (!target) return;

        updateElementPositionSize(target, {
          x: target.x + dx,
          y: target.y + dy,
        });
        return;
      }

      updateCanvas({
        elements: canvas.elements.map((el) => {
          if (!selectedIds.includes(el.id) || el.locked) return el;

          return {
            ...el,
            x: Math.min(
              Math.max(0, el.x + dx),
              Math.max(0, canvas.width - el.width)
            ),
            y: Math.min(
              Math.max(0, el.y + dy),
              Math.max(0, canvas.height - el.height)
            ),
          } as FormCanvasElement;
        }),
      });
    };

    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveSelectedByKeyboard(0, -step);
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveSelectedByKeyboard(0, step);
    }

    if (e.key === "ArrowLeft") {
      e.preventDefault();
      moveSelectedByKeyboard(-step, 0);
    }

    if (e.key === "ArrowRight") {
      e.preventDefault();
      moveSelectedByKeyboard(step, 0);
    }

    if (e.key === "Delete" || e.key === "Backspace") {
      e.preventDefault();
      removeSelected();
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [
  selectedElement,
  selectedElements,
  selectedIds,
  actualSelectedId,
  canvas.elements,
  canvas.width,
  canvas.height,
  undoStack,
  redoStack,
copiedElements,
]);

useEffect(() => {
  const handleGlobalMouseMove = (e: MouseEvent) => {
    if (!selectionBox) return;
    updateAreaSelectByClientPoint(e.clientX, e.clientY);
  };

  const handleGlobalMouseUp = () => {
  endDrag();

    if (selectionBox) {
      endAreaSelect();
    }
  };

  window.addEventListener("mousemove", handleGlobalMouseMove);
  window.addEventListener("mouseup", handleGlobalMouseUp);

  return () => {
    window.removeEventListener("mousemove", handleGlobalMouseMove);
    window.removeEventListener("mouseup", handleGlobalMouseUp);
  };
}, [selectionBox, canvas.elements, scale]);

let renderedRequiredForm = false;

  return (
  <div
    className={
      compact
        ? "w-full"
        : "rounded-2xl border bg-white p-4 space-y-4"
    }
  >
    {!compact ? (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold">
            미리캔버스형 자유 디자인
          </h3>

          <p className="text-xs text-slate-500">
            텍스트 박스를 추가하고 위치/크기/색상을 조정할 수 있습니다.
            Shift 드래그/리사이즈 시 스냅 없이 자유 조정됩니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-lg border px-3 py-2 text-sm"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            <option value={0.25}>25%</option>
            <option value={0.32}>32%</option>
            <option value={0.5}>50%</option>
            <option value={0.75}>75%</option>
            <option value={1}>100%</option>
          </select>

          <button
            type="button"
            onClick={undoCanvas}
            disabled={undoStack.length === 0}
            className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            되돌리기
          </button>

          <button
            type="button"
            onClick={redoCanvas}
            disabled={redoStack.length === 0}
            className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            다시실행
          </button>


        </div>
      </div>
    ) : null}

    <div
      className={
        compact
          ? "block"
          : "grid gap-4 xl:grid-cols-[220px_1fr_360px]"
      }
    >
      {!compact ? (
        <div className="sticky top-4 max-h-[calc(100vh-120px)] self-start overflow-auto rounded-2xl border bg-slate-50 p-4 space-y-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900">
              요소 추가
            </h4>

            <p className="mt-1 text-xs text-slate-500">
              페이지에 넣을 요소를 선택하세요.
            </p>
          </div>

<div className="space-y-4">
  <div className="grid gap-2">
    <button
      type="button"
      onClick={addText}
      className="rounded-xl bg-slate-900 px-3 py-3 text-sm font-semibold text-white"
    >
      텍스트 추가
    </button>

    <button
      type="button"
      onClick={addImage}
      className="rounded-xl border bg-white px-3 py-3 text-sm font-semibold text-slate-700"
    >
      이미지 추가
    </button>

    <button
      type="button"
      onClick={addButton}
      className="rounded-xl border bg-white px-3 py-3 text-sm font-semibold text-slate-700"
    >
      상담 버튼 추가
    </button>
  </div>

  <div className="border-t pt-3">
    <div className="mb-2 flex items-center justify-between">
      <h5 className="text-sm font-bold text-slate-900">기본 도형</h5>
      <span className="text-xs font-semibold text-cyan-600">더보기</span>
    </div>

    <div className="grid grid-cols-4 gap-2 rounded-2xl bg-slate-100 p-2">
      <button
        type="button"
        onClick={addRect}
        title="사각형"
        className="flex h-14 items-center justify-center rounded-xl bg-white hover:bg-cyan-50"
      >
        <span className="block h-7 w-7 bg-slate-500" />
      </button>

      <button
        type="button"
        onClick={addCircle}
        title="원형"
        className="flex h-14 items-center justify-center rounded-xl bg-white hover:bg-cyan-50"
      >
        <span className="block h-8 w-8 rounded-full bg-slate-500" />
      </button>

      <button
        type="button"
        onClick={() => addSvg("star")}
        title="별"
        className="flex h-14 items-center justify-center rounded-xl bg-white text-slate-500 hover:bg-cyan-50"
      >
        <svg viewBox="0 0 100 100" className="h-9 w-9">
          <polygon
            points="50,8 61,36 91,36 67,55 76,86 50,68 24,86 33,55 9,36 39,36"
            fill="currentColor"
          />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => addSvg("heart")}
        title="하트"
        className="flex h-14 items-center justify-center rounded-xl bg-white text-slate-500 hover:bg-cyan-50"
      >
        <svg viewBox="0 0 100 100" className="h-9 w-9">
          <path
            d="M50 85 C20 60 8 42 18 25 C27 10 43 16 50 30 C57 16 73 10 82 25 C92 42 80 60 50 85Z"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>
  </div>

  <div className="border-t pt-3">
    <div className="mb-2 flex items-center justify-between">
      <h5 className="text-sm font-bold text-slate-900">선</h5>
      <span className="text-xs font-semibold text-cyan-600">더보기</span>
    </div>

    <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-100 p-2">
      <button
        type="button"
        onClick={() => addSvg("line")}
        title="실선"
        className="flex h-14 items-center justify-center rounded-xl bg-white hover:bg-cyan-50"
      >
        <span className="block h-0.5 w-12 rounded bg-slate-600" />
      </button>

      <button
        type="button"
        onClick={() => addSvg("line-dashed")}
        title="점선"
        className="flex h-14 items-center justify-center rounded-xl bg-white hover:bg-cyan-50"
      >
        <span
          className="block h-0.5 w-12 rounded"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, #475569 0 6px, transparent 6px 10px)",
          }}
        />
      </button>

      <button
        type="button"
        onClick={() => addSvg("arrow-right")}
        title="오른쪽 화살표"
        className="flex h-14 items-center justify-center rounded-xl bg-white text-slate-600 hover:bg-cyan-50"
      >
        <svg viewBox="0 0 100 100" className="h-10 w-12">
          <line
            x1="10"
            y1="50"
            x2="78"
            y2="50"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <polyline
            points="60,25 85,50 60,75"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  </div>

  <div className="border-t pt-3">
    <div className="mb-2 flex items-center justify-between">
      <h5 className="text-sm font-bold text-slate-900">기본 화살표</h5>
      <span className="text-xs font-semibold text-cyan-600">더보기</span>
    </div>

    <div className="grid grid-cols-4 gap-2 rounded-2xl bg-slate-100 p-2">
      <button
        type="button"
        onClick={() => addSvg("arrow-right")}
        title="오른쪽"
        className="flex h-14 items-center justify-center rounded-xl bg-white text-slate-500 hover:bg-cyan-50"
      >
        <svg viewBox="0 0 100 100" className="h-10 w-10">
          <line x1="10" y1="50" x2="78" y2="50" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
          <polyline points="60,25 85,50 60,75" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => addSvg("arrow-left")}
        title="왼쪽"
        className="flex h-14 items-center justify-center rounded-xl bg-white text-slate-500 hover:bg-cyan-50"
      >
        <svg viewBox="0 0 100 100" className="h-10 w-10">
          <line x1="22" y1="50" x2="90" y2="50" stroke="currentColor" strokeWidth="9" strokeLinecap="round" />
          <polyline points="40,25 15,50 40,75" fill="none" stroke="currentColor" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => addSvg("arrow-right")}
        title="굵은 오른쪽"
        className="flex h-14 items-center justify-center rounded-xl bg-white text-slate-500 hover:bg-cyan-50"
      >
        <span className="text-3xl font-black leading-none">→</span>
      </button>

      <button
        type="button"
        onClick={() => addSvg("arrow-left")}
        title="굵은 왼쪽"
        className="flex h-14 items-center justify-center rounded-xl bg-white text-slate-500 hover:bg-cyan-50"
      >
        <span className="text-3xl font-black leading-none">←</span>
      </button>
    </div>
  </div>
</div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-bold text-slate-900">
              선택 도구
            </h4>

            <div className="mt-2 grid gap-2">
              <button
                type="button"
                onClick={duplicateSelected}
                disabled={
  selectedElements.length > 0
    ? selectedElements.every((el) => el.locked || isRequiredFormElement(el))
    : !actualSelectedId ||
      selectedElement?.locked ||
      isRequiredFormElement(selectedElement)
}
                className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
              >
                선택 복제
              </button>

              <button
  type="button"
  onClick={removeSelected}
  disabled={
    selectedElements.length > 0
      ? selectedElements.every((el) => el.locked || isRequiredFormElement(el))
      : !actualSelectedId ||
        selectedElement?.locked ||
        isRequiredFormElement(selectedElement)
  }
                className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-40"
              >
                선택 삭제
              </button>
            </div>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-bold text-slate-900">
              레이어
            </h4>

            <div className="mt-2 flex flex-col gap-2">
              {sortedLayerElements.map((element) => {
                  const active =
  actualSelectedId === element.id || selectedIds.includes(element.id);

                  return (
                    <button
                      key={element.id}
                      type="button"
                      onClick={(e) => selectElement(element, e.shiftKey)}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${
                        active
                          ? "border-cyan-300 bg-cyan-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <span>
                        {element.hidden
                          ? "🙈"
                          : element.locked
                          ? "🔒"
                          : "📄"}
                      </span>

                      <div className="flex-1 overflow-hidden">
                        <div className="truncate font-semibold text-slate-800">
                          {getElementLabel(element)}
                        </div>

                        <div className="text-[11px] text-slate-400">
                          zIndex: {element.zIndex || 1}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          </div>

          <div className="border-t pt-3">
            <h4 className="text-sm font-bold text-slate-900">
              전체 관리
            </h4>

            <div className="mt-2 grid gap-2">
              <button
                type="button"
                onClick={clearCanvasElements}
                disabled={canvas.elements.length === 0}
                className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-red-600 disabled:opacity-40"
              >
                전체 삭제
              </button>

              <button
                type="button"
                onClick={resetCanvas}
                className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-red-700"
              >
                캔버스 초기화
              </button>

              <button
                type="button"
                onClick={() =>
                  updateCanvas({
                    elements: sanitizeElements(canvas.elements),
                  })
                }
                disabled={canvas.elements.length === 0}
                className="rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
              >
                요소 정리
              </button>
            </div>
          </div>
        </div>
      ) : null}

{compact ? (
  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
<div className="text-sm font-semibold text-slate-600">
  {selectedIds.length > 1
    ? `${selectedIds.length}개 선택됨`
    : selectedElement
      ? getElementLabel(selectedElement)
      : "선택된 요소 없음"}
</div>
  <div className="flex flex-wrap items-center gap-2">
    <button
      type="button"
      onClick={() => setZoom((prev) => Math.max(0.25, Number((prev - 0.05).toFixed(2))))}
      className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-700"
    >
      -
    </button>

    <span className="min-w-16 text-center text-sm font-bold text-slate-600">
      {Math.round(zoom * 100)}%
    </span>

    <button
      type="button"
      onClick={() => setZoom((prev) => Math.min(1, Number((prev + 0.05).toFixed(2))))}
      className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-700"
    >
      +
    </button>

<button
  type="button"
  onClick={() => setZoom(0.42)}
  className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-700"
>
  초기화
</button>

<button
  type="button"
  onClick={undoCanvas}
  disabled={undoStack.length === 0}
  className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
>
  되돌리기
</button>

<button
  type="button"
  onClick={redoCanvas}
  disabled={redoStack.length === 0}
  className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
>
  다시실행
</button>

<button
  type="button"
  onClick={() => setGridVisible((prev) => !prev)}
  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
    gridVisible
      ? "bg-slate-900 text-white"
      : "bg-white text-slate-700"
  }`}
>
  Grid
</button>

<button
  type="button"
  onClick={() => setSnapEnabled((prev) => !prev)}
  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
    snapEnabled
      ? "bg-slate-900 text-white"
      : "bg-white text-slate-700"
  }`}
>
  Snap
</button>

<button
  type="button"
  onClick={() => setGridSnapEnabled((prev) => !prev)}
  className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
    gridSnapEnabled
      ? "bg-slate-900 text-white"
      : "bg-white text-slate-700"
  }`}
>
  Grid Snap
</button>

  </div>
</div>
) : null}

        <div
  className={
    compact
      ? "h-full overflow-auto bg-slate-100 p-4"
      : "min-h-[760px] overflow-auto rounded-2xl border bg-slate-100 p-6"
  }
>
          <div
data-form-canvas-stage="true"
  className={`relative mx-auto overflow-hidden rounded-xl border bg-white shadow-sm ${
  dragState || resizeState ? "cursor-grabbing select-none" : "cursor-default"
}`}
  style={{
  width: canvasWidth,
  height: canvasHeight,
  backgroundImage: gridVisible
    ? "linear-gradient(to right, rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.18) 1px, transparent 1px)"
    : undefined,
  backgroundSize: gridVisible ? `${20 * scale}px ${20 * scale}px` : undefined,
  backgroundColor: canvas.backgroundColor || "#ffffff",
  border: compact ? "2px solid #64748b" : "1px solid #cbd5e1",
boxShadow: compact
  ? "0 28px 90px rgba(15, 23, 42, 0.28)"
  : "0 18px 50px rgba(15, 23, 42, 0.14)",
}}
  onMouseDown={startAreaSelect}
onMouseMove={(e) => {
  if (selectionBox) {
    updateAreaSelect(e);
    return;
  }

  handleDragMove(e);
}}
onMouseUp={() => {
  if (selectionBox) {
    endAreaSelect();
    return;
  }

  endDrag();
}}
onMouseLeave={() => {
  if (!selectionBox) {
    endDrag();
  }
}}
>
  {snapGuide?.x != null ? (
    <div
      className="pointer-events-none absolute top-0 bottom-0 z-[9998] w-0.5 bg-blue-500/80"
      style={{ left: snapGuide.x * scale }}
    />
  ) : null}

  {snapGuide?.y != null ? (
    <div
      className="pointer-events-none absolute left-0 right-0 z-[9998] h-0.5 bg-blue-500/80"
      style={{ top: snapGuide.y * scale }}
    />
  ) : null}

{selectionBox ? (
  <div
    className="pointer-events-none absolute z-[9997] rounded border border-blue-500 bg-blue-500/10"
    style={{
      left: selectionBox.x * scale,
      top: selectionBox.y * scale,
      width: selectionBox.width * scale,
      height: selectionBox.height * scale,
    }}
  />
) : null}

            {sortedVisibleElements.map((el) => {
                const isSelected = actualSelectedId === el.id || selectedIds.includes(el.id);
const isDragging = dragState?.ids.includes(el.id) ?? false;
const isResizing = resizeState?.id === el.id;
const isActiveMoving = isDragging || isResizing;

if (el.type === "form" || isRequiredFormElement(el)) {
  if (renderedRequiredForm) return null;
  renderedRequiredForm = true;

  const active =
    actualSelectedId === el.id || selectedIds.includes(el.id);

  return (
    <div
      key={el.id}
      onMouseDown={(e) => startDrag(e, el)}
      className={`absolute rounded-xl ${
        active
          ? "ring-2 ring-blue-400"
          : "hover:ring-1 hover:ring-slate-300"
      }`}
      style={{
        left: el.x * scale,
        top: el.y * scale,
        width: el.width * scale,
        height: el.height * scale,
        zIndex: isActiveMoving ? 9999 : el.zIndex ?? 1,
        overflow: "visible",
        background: "transparent",
      }}
    >
      <div
        style={{
          width: el.width,
          minHeight: el.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          pointerEvents: "none",
        }}
      >
        {renderFormPreview ? (
          renderFormPreview()
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              border: "1px dashed #94a3b8",
              borderRadius: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#64748b",
              fontWeight: 800,
              background: "rgba(255,255,255,0.7)",
            }}
          >
            상담폼 미리보기
          </div>
        )}
      </div>

      {renderElementToolbar(el)}
      {renderResizeHandle(el)}
    </div>
  );
}


                if (el.type === "text") {
                  return (
                    <div
                      key={el.id}
                      role="button"
                      tabIndex={0}
                      onMouseDown={(e) => {
  if (editingTextId === el.id) {
    e.stopPropagation();
    return;
  }

  startDrag(e, el);
}}
onDoubleClick={(e) => {
  e.stopPropagation();

  if (el.locked) return;

  setActualSelectedId(el.id);
setSelectedIds([el.id]);

pushUndoHistory();

setEditingTextId(el.id);
}}
                      className={`absolute ${isActiveMoving ? "pointer-events-none scale-[1.01] opacity-70 shadow-xl" : "pointer-events-auto scale-100 opacity-100"} ${el.locked ? "cursor-default" : "cursor-move"} select-none whitespace-pre-wrap rounded border ${
                        isSelected
  ? "border-blue-500 ring-2 ring-blue-300 shadow-md"
                          : el.locked ? "border-transparent" : "border-transparent transition-colors hover:border-slate-300"
                      }`}
                      style={{
                        left: el.x * scale,
                        top: el.y * scale,
                        width: el.width * scale,
                        height: el.height * scale,
                        zIndex: isActiveMoving ? 9999 : el.zIndex ?? 1,
                        color: el.color,
                        fontSize: el.fontSize * scale,
                        fontWeight: el.fontWeight,
fontFamily: el.fontFamily || "Pretendard, sans-serif",
                        textAlign: el.textAlign ?? "left",
                        lineHeight: 1.15,
WebkitTextStroke:
  el.strokeWidth && el.strokeWidth > 0
    ? `${el.strokeWidth * scale}px ${el.strokeColor || "#000000"}`
    : undefined,
textShadow:
  el.shadowBlur && el.shadowBlur > 0
    ? `${(el.shadowOffsetX || 0) * scale}px ${(el.shadowOffsetY || 0) * scale}px ${
        el.shadowBlur * scale
      }px ${el.shadowColor || "#000000"}`
    : undefined,
userSelect: "none",
  WebkitUserSelect: "none",
                      }}
                    >
  {editingTextId === el.id ? (
  <textarea
    autoFocus
    value={el.text}
    onChange={(e) =>
  updateCanvas(
    {
      elements: canvas.elements.map((item) =>
        item.id === el.id
          ? ({
              ...item,
              text: e.target.value,
            } as FormCanvasElement)
          : item
      ),
    },
    { skipHistory: true }
  )
}
    onBlur={() => {
  setEditingTextId(null);
}}
    onMouseDown={(e) => e.stopPropagation()}
onKeyDown={(e) => {
  e.stopPropagation();

  if (e.key === "Escape") {
    setEditingTextId(null);
  }

  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    setEditingTextId(null);
  }
}}
    className="h-full w-full resize-none border-none bg-transparent outline-none"
    style={{
      color: el.color,
      fontSize: el.fontSize * scale,
      fontWeight: el.fontWeight,
fontFamily: el.fontFamily || "Pretendard, sans-serif",
      textAlign: el.textAlign ?? "left",
      lineHeight: 1.15,
    }}
  />
) : (
  el.text
)}
{editingTextId === el.id ? null : renderElementToolbar(el)}
{editingTextId === el.id ? null : renderResizeHandle(el)}
</div>
                  );
                }

                if (el.type === "image") {
                  return (
                    <div
                      key={el.id}
                      role="button"
                      tabIndex={0}
                      onMouseDown={(e) => startDrag(e, el)}
                      className={`absolute ${isActiveMoving ? "pointer-events-none scale-[1.01] opacity-70 shadow-xl" : "pointer-events-auto scale-100 opacity-100"} ${el.locked ? "cursor-default" : "cursor-move"} overflow-hidden rounded border bg-slate-200 ${
                        isSelected
  ? "border-blue-500 ring-2 ring-blue-300 shadow-md"
                          : el.locked ? "border-transparent" : "border-transparent transition-colors hover:border-slate-300"
                      }`}
                      style={{
                        left: el.x * scale,
                        top: el.y * scale,
                        width: el.width * scale,
                        height: el.height * scale,
                        zIndex: isActiveMoving ? 9999 : el.zIndex ?? 1,
                      }}
                    >
                      {el.url ? (
                        <img
                          src={el.url}
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: el.objectFit ?? "cover",
                          }}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
                          이미지 URL 입력
                        </div>
                      )}

                      {renderElementToolbar(el)}
                      {renderResizeHandle(el)}
                    </div>
                  );
                }

                if (el.type === "button") {
                  return (
                    <div
                      key={el.id}
                      role="button"
                      tabIndex={0}
                      onMouseDown={(e) => startDrag(e, el)}
                      className={`absolute ${isActiveMoving ? "pointer-events-none scale-[1.01] opacity-70 shadow-xl" : "pointer-events-auto scale-100 opacity-100"} ${el.locked ? "cursor-default" : "cursor-move"} border ${
                        isSelected
                          ? "border-blue-500 ring-2 ring-blue-300 shadow-md"
                          : el.locked
                            ? "border-transparent"
                            : "border-transparent transition-colors hover:border-slate-300"
                      }`}
                      style={{
  left: el.x * scale,
  top: el.y * scale,
  width: el.width * scale,
  height: el.height * scale,
  zIndex: isActiveMoving ? 9999 : el.zIndex ?? 1,
  backgroundColor: el.backgroundColor,
  color: el.color,
  borderRadius: Number((el as any).borderRadius || 0) * scale,

  fontWeight: Number((el as any).fontWeight || 900),
  fontSize: Math.max(
    10,
    Number((el as any).fontSize || 34) * scale
  ),
  fontFamily: (el as any).fontFamily || "Pretendard, sans-serif",
  textAlign: (el as any).textAlign || "center",

  display: "flex",
  alignItems: "center",
  justifyContent:
    ((el as any).textAlign || "center") === "left"
      ? "flex-start"
      : ((el as any).textAlign || "center") === "right"
        ? "flex-end"
        : "center",
  padding: `0 ${Math.max(8, 14 * scale)}px`,
  lineHeight: 1.15,
  whiteSpace: "pre-wrap",
  wordBreak: "keep-all",
  overflow: "hidden",
  userSelect: "none",
}}
                    >
                      {el.text}

                      {renderElementToolbar(el)}
                      {renderResizeHandle(el)}
                    </div>
                  );
                }

                if (el.type === "shape") {
                  return (
                    <div
                      key={el.id}
                      role="button"
                      tabIndex={0}
                      onMouseDown={(e) => startDrag(e, el)}
                      className={`absolute ${isActiveMoving ? "pointer-events-none scale-[1.01] opacity-70 shadow-xl" : "pointer-events-auto scale-100 opacity-100"} ${el.locked ? "cursor-default" : "cursor-move"} ${
                        isSelected
                          ? "ring-2 ring-blue-300 shadow-md"
                          : el.locked
                            ? ""
                            : "hover:ring-1 hover:ring-slate-300"
                      }`}
                      style={{
                        left: el.x * scale,
                        top: el.y * scale,
                        width: el.width * scale,
                        height: el.height * scale,
                        zIndex: isActiveMoving ? 9999 : el.zIndex ?? 1,
                        backgroundColor: el.backgroundColor,
                        borderRadius: el.shape === "circle" ? "999px" : 0,
                        border: el.borderWidth
                          ? `${Math.max(1, el.borderWidth * scale)}px solid ${
                              el.borderColor || "transparent"
                            }`
                          : undefined,
                      }}
                    >
                      {renderElementToolbar(el)}
                      {renderResizeHandle(el)}
                    </div>
                  );
                }

if (el.type === "svg") {
  return (
    <div
      key={el.id}
      role="button"
      tabIndex={0}
      onMouseDown={(e) => startDrag(e, el)}
      className={`absolute ${isActiveMoving ? "pointer-events-none scale-[1.01] opacity-70 shadow-xl" : "pointer-events-auto scale-100 opacity-100"} ${el.locked ? "cursor-default" : "cursor-move"} ${
        isSelected
          ? "ring-2 ring-blue-300 shadow-md"
          : el.locked
            ? ""
            : "hover:ring-1 hover:ring-slate-300"
      }`}
      style={{
        left: el.x * scale,
        top: el.y * scale,
        width: el.width * scale,
        height: el.height * scale,
        zIndex: isActiveMoving ? 9999 : el.zIndex ?? 1,
      }}
    >
      <svg
        viewBox="0 0 100 100"
        width="100%"
        height="100%"
        preserveAspectRatio="none"
        style={{ overflow: "hidden" }}
      >
        {renderSvgContent(el)}
      </svg>

      {renderElementToolbar(el)}
      {renderResizeHandle(el)}
    </div>
  );
}

                return null;
              })}
          </div>
        </div>

        {!compact ? (
  <div className="sticky top-4 max-h-[calc(100vh-120px)] self-start overflow-auto rounded-2xl border bg-slate-50 p-4 space-y-4">
          <div className="space-y-2">
<div className="rounded-xl border bg-white p-3 space-y-2">
  <div className="flex items-center justify-between">
  <h4 className="font-bold">레이어</h4>

  <div className="flex items-center gap-1">
    <button
      type="button"
      title="전체 보이기"
      onClick={() =>
        updateCanvas({
          elements: canvas.elements.map((el, index) => ({
  ...el,
  hidden: false,
  zIndex: Number(el.zIndex ?? 0) || index + 1,
})),
        })
      }
      className="rounded border px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-slate-50"
    >
      전체보기
    </button>

    <button
      type="button"
      title="전체 잠금 해제"
      onClick={() =>
        updateCanvas({
          elements: canvas.elements.map((el) => ({
            ...el,
            locked: false,
          })),
        })
      }
      className="rounded border px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-slate-50"
    >
      잠금해제
    </button>

    <span className="text-xs text-slate-400">
      {canvas.elements.length}개
    </span>
  </div>
</div>

  {canvas.elements.length === 0 ? (
    <p className="text-xs text-slate-500">
      아직 추가된 요소가 없습니다.
    </p>
  ) : (
    <div className="max-h-56 space-y-1 overflow-auto">
      {sortedLayerElements.map((element) => {
          const isSelectedLayer =
  actualSelectedId === element.id || selectedIds.includes(element.id);
const layerIndex = sortedVisibleElements.findIndex((el) => el.id === element.id);
const isVisibleLayer = layerIndex >= 0;
const isBackMost = !isVisibleLayer || layerIndex <= 0;
const isFrontMost =
  !isVisibleLayer || layerIndex >= sortedVisibleElements.length - 1;
const isLayerLocked = !!element.locked;
const isLayerHidden = !!element.hidden;

          return (
  <div
    key={element.id}
    onClick={(e) => selectElement(element, e.shiftKey)}
    className={`flex w-full cursor-pointer items-center justify-between rounded-lg border px-2 py-2 text-left text-xs ${
      isSelectedLayer
        ? "border-blue-500 bg-blue-50 text-blue-700"
        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
    }`}
  >
    <span className="min-w-0 flex-1 truncate">
  {getElementLabel(element)}
</span>

    <span className="ml-2 flex shrink-0 items-center gap-0.5 text-[10px] text-slate-400">
      <button
        type="button"
        title={element.locked ? "잠금 해제" : "잠금"}
        onClick={(e) => {
          e.stopPropagation();
setActualSelectedId(element.id);
setSelectedIds([element.id]);
          updateElement(element.id, {
            locked: !element.locked,
          } as Partial<FormCanvasElement>);
        }}
        className="rounded px-1 hover:bg-slate-100"
      >
        {element.locked ? "🔒" : "🔓"}
      </button>

      <button
        type="button"
        title={element.hidden ? "보이기" : "숨김"}
        onClick={(e) => {
          e.stopPropagation();
setActualSelectedId(element.id);
setSelectedIds([element.id]);
          updateElement(element.id, {
  hidden: !element.hidden,
  zIndex: element.hidden
    ? Math.max(0, ...canvas.elements.map((el) => Number(el.zIndex ?? 0))) + 1
    : element.zIndex,
} as Partial<FormCanvasElement>);
        }}
        className="rounded px-1 hover:bg-slate-100"
      >
        {element.hidden ? "🙈" : "👁"}
      </button>

<button
  type="button"
  title="맨 앞으로"
disabled={isFrontMost || isLayerLocked || isLayerHidden}
  onClick={(e) => {
    e.stopPropagation();
    setActualSelectedId(element.id);
setSelectedIds([element.id]);
    reorderElement(element.id, "front");
  }}
  className="rounded px-1 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
>
  ⏫
</button>

<button
  type="button"
  title="앞으로"
disabled={isFrontMost || isLayerLocked || isLayerHidden}
  onClick={(e) => {
    e.stopPropagation();
    setActualSelectedId(element.id);
setSelectedIds([element.id]);
    reorderElement(element.id, "forward");
  }}
  className="rounded px-1 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
>
  ▲
</button>

<button
  type="button"
  title="뒤로"
disabled={isBackMost || isLayerLocked || isLayerHidden}
  onClick={(e) => {
    e.stopPropagation();
    setActualSelectedId(element.id);
setSelectedIds([element.id]);
    reorderElement(element.id, "backward");
  }}
  className="rounded px-1 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
>
  ▼
</button>

<button
  type="button"
  title="맨 뒤로"
disabled={isBackMost || isLayerLocked || isLayerHidden}
  onClick={(e) => {
    e.stopPropagation();
    setActualSelectedId(element.id);
setSelectedIds([element.id]);
    reorderElement(element.id, "back");
  }}
  className="rounded px-1 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
>
  ⏬
</button>
    </span>
  </div>
);
        })}
    </div>
  )}
</div>
            <h4 className="font-bold">캔버스 설정</h4>

            <label className="block text-xs font-medium">배경색</label>
            <input
              className="w-full rounded border p-2"
              value={canvas.backgroundColor}
              onChange={(e) =>
                updateCanvas({
                  backgroundColor: e.target.value,
                })
              }
              placeholder="#ffffff"
            />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium">가로</label>
                <input
                  type="number"
                  className="w-full rounded border p-2"
                  value={canvas.width}
                  onChange={(e) =>
                    updateCanvas({
                      width: Number(e.target.value) || 1080,
                    })
                  }
                />
              </div>

              <div>
                <label className="block text-xs font-medium">세로</label>
                <input
                  type="number"
                  className="w-full rounded border p-2"
                  value={canvas.height}
                  onChange={(e) =>
                    updateCanvas({
                      height: Number(e.target.value) || 1920,
                    })
                  }
                />
              </div>
            </div>
          </div>

          <div className="border-t pt-4 space-y-3">
            <div className="space-y-3">
  <div className="flex items-center justify-between">
  <h4 className="font-bold">선택 요소</h4>

  {selectedIds.length > 1 ? (
    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
      {selectedIds.length}개 선택
    </span>
  ) : null}
</div>
{selectedElement?.locked ? (
  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
    잠금된 요소입니다. 레이어에서 잠금 해제 후 수정할 수 있습니다.
  </p>
) : null}

{selectedElement?.type === "svg" ? (
  <div className="rounded-xl border bg-white p-3 space-y-3">
    <h5 className="text-sm font-bold text-slate-800">SVG / 선 설정</h5>

    <div>
      <label className="block text-xs font-medium">종류</label>
      <select
        className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
        value={selectedElement.svgName}
        disabled={selectedElement.locked}
        onChange={(e) =>
          updateElement(selectedElement.id, {
            svgName: e.target.value as any,
          } as Partial<FormCanvasElement>)
        }
      >
        <option value="line">실선</option>
        <option value="line-dashed">점선</option>
        <option value="arrow-right">오른쪽 화살표</option>
        <option value="arrow-left">왼쪽 화살표</option>
        <option value="star">별</option>
        <option value="heart">하트</option>
      </select>
    </div>

    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="block text-xs font-medium">채움 색상</label>
        <input
          type="color"
          className="h-10 w-full rounded border p-1 disabled:bg-slate-100 disabled:text-slate-400"
          value={selectedElement.fill || "#64748b"}
          disabled={selectedElement.locked}
          onChange={(e) =>
            updateElement(selectedElement.id, {
              fill: e.target.value,
            } as Partial<FormCanvasElement>)
          }
        />
      </div>

      <div>
        <label className="block text-xs font-medium">선 색상</label>
        <input
          type="color"
          className="h-10 w-full rounded border p-1 disabled:bg-slate-100 disabled:text-slate-400"
          value={selectedElement.stroke || "#64748b"}
          disabled={selectedElement.locked}
          onChange={(e) =>
            updateElement(selectedElement.id, {
              stroke: e.target.value,
            } as Partial<FormCanvasElement>)
          }
        />
      </div>
    </div>

    <div>
      <label className="block text-xs font-medium">선 두께</label>
      <input
        type="number"
        min={1}
        max={30}
        className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
        value={selectedElement.strokeWidth || 8}
        disabled={selectedElement.locked}
        onChange={(e) =>
          updateElement(selectedElement.id, {
            strokeWidth: Number(e.target.value) || 1,
          } as Partial<FormCanvasElement>)
        }
      />
    </div>
  </div>
) : null}

  {selectedElement ? (
  <>
  <div className="rounded-xl border bg-white p-2 space-y-2">
    <div className="text-xs font-semibold text-slate-600">정렬</div>

    <div className="grid grid-cols-3 gap-1">
      <button
        type="button"
        onClick={() => alignSelected("left")}
        disabled={
  selectedElements.length > 0
    ? selectedElements.every((el) => el.locked)
    : selectedElement.locked
}
        className="rounded border px-2 py-1 text-xs disabled:opacity-40"
      >
        좌
      </button>

      <button
        type="button"
        onClick={() => alignSelected("centerX")}
        disabled={
  selectedElements.length > 0
    ? selectedElements.every((el) => el.locked)
    : selectedElement.locked
}
        className="rounded border px-2 py-1 text-xs disabled:opacity-40"
      >
        가중앙
      </button>

      <button
        type="button"
        onClick={() => alignSelected("right")}
        disabled={
  selectedElements.length > 0
    ? selectedElements.every((el) => el.locked)
    : selectedElement.locked
}
        className="rounded border px-2 py-1 text-xs disabled:opacity-40"
      >
        우
      </button>

      <button
        type="button"
        onClick={() => alignSelected("top")}
        disabled={
  selectedElements.length > 0
    ? selectedElements.every((el) => el.locked)
    : selectedElement.locked
}
        className="rounded border px-2 py-1 text-xs disabled:opacity-40"
      >
        상
      </button>

      <button
        type="button"
        onClick={() => alignSelected("centerY")}
        disabled={
  selectedElements.length > 0
    ? selectedElements.every((el) => el.locked)
    : selectedElement.locked
}
        className="rounded border px-2 py-1 text-xs disabled:opacity-40"
      >
        세중앙
      </button>

      <button
        type="button"
        onClick={() => alignSelected("bottom")}
        disabled={
  selectedElements.length > 0
    ? selectedElements.every((el) => el.locked)
    : selectedElement.locked
}
        className="rounded border px-2 py-1 text-xs disabled:opacity-40"
      >
        하
      </button>
    </div>
  </div>
<div className="mt-2 grid grid-cols-2 gap-1">
  <button
    type="button"
    onClick={() => distributeSelected("horizontal")}
    disabled={selectedElements.filter((el) => !el.locked).length < 3}
    className="rounded border px-2 py-1 text-xs disabled:opacity-40"
  >
    가로 균등
  </button>

  <button
    type="button"
    onClick={() => distributeSelected("vertical")}
    disabled={selectedElements.filter((el) => !el.locked).length < 3}
    className="rounded border px-2 py-1 text-xs disabled:opacity-40"
  >
    세로 균등
  </button>
</div>
  </>
  ) : null}
</div>

{selectedElement && selectedIds.length <= 1 ? (
  <div className="rounded-xl border bg-white p-2 space-y-2">
    <div className="text-xs font-semibold text-slate-600">위치 / 크기</div>

    <div className="grid grid-cols-2 gap-2">
      <div>
        <label className="block text-xs font-medium">X</label>
        <input
          type="number"
          className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
          value={selectedElement.x}
          disabled={selectedElement.locked}
          onChange={(e) =>
            updateElementPositionSize(selectedElement, {
  x: Number(e.target.value) || 0,
})
          }
        />
      </div>

      <div>
        <label className="block text-xs font-medium">Y</label>
        <input
          type="number"
          className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
          value={selectedElement.y}
          disabled={selectedElement.locked}
          onChange={(e) =>
            updateElementPositionSize(selectedElement, {
  y: Number(e.target.value) || 0,
})
          }
        />
      </div>

      <div>
        <label className="block text-xs font-medium">가로</label>
        <input
          type="number"
          className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
          value={selectedElement.width}
          disabled={selectedElement.locked}
          onChange={(e) =>
            updateElementPositionSize(selectedElement, {
  width: Number(e.target.value) || 40,
})
          }
        />
      </div>

      <div>
        <label className="block text-xs font-medium">세로</label>
        <input
          type="number"
          className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
          value={selectedElement.height}
          disabled={selectedElement.locked}
          onChange={(e) =>
            updateElementPositionSize(selectedElement, {
  height: Number(e.target.value) || 40,
})
          }
        />
      </div>
    </div>
  </div>
) : null}

            {selectedIds.length > 1 ? (
  <p className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-700">
    여러 요소가 선택되었습니다. 드래그/방향키 이동/복제/삭제가 가능하며, 정렬/위치/크기/세부 편집은 단일 선택에서 가능합니다.
  </p>
) : !selectedElement ? (
              <p className="text-sm text-slate-500">
                캔버스에서 요소를 선택하세요.
              </p>
            ) : isTextElement(selectedElement) ? (
              <div className="space-y-3">
  <div>
    <label className="block text-xs font-medium">문구</label>
    <textarea
      className="min-h-24 w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
      value={selectedElement.text}
      disabled={selectedElement.locked}
      onChange={(e) =>
        updateElement(selectedElement.id, {
          text: e.target.value,
        } as Partial<FormCanvasElement>)
      }
    />
  </div>

<div>
  <label className="block text-xs font-medium">글꼴</label>
  <select
  className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
  value={selectedElement.fontFamily || "Pretendard, sans-serif"}
  disabled={selectedElement.locked}
  onChange={(e) =>
    updateElement(selectedElement.id, {
      fontFamily: e.target.value,
    } as Partial<FormCanvasElement>)
  }
>
  <option value="Pretendard, sans-serif">프리텐다드</option>

  <option value="'Noto Sans KR', sans-serif">
    Noto Sans KR
  </option>

  <option value="'Gothic A1', sans-serif">
    고딕 A1
  </option>

  <option value="'Nanum Gothic', sans-serif">
    나눔고딕
  </option>

  <option value="'Nanum Myeongjo', serif">
    나눔명조
  </option>

  <option value="'Black Han Sans', sans-serif">
    검은고딕
  </option>

  <option value="'Do Hyeon', sans-serif">
    도현체
  </option>

  <option value="'Jua', sans-serif">
    주아체
  </option>

  <option value="'Sunflower', sans-serif">
    썬플라워
  </option>

  <option value="'Poor Story', cursive">
    푸어스토리
  </option>

  <option value="'Orbit', sans-serif">
    Orbit
  </option>

  <option value="'Nanum Brush Script', cursive">
    나눔손글씨
  </option>

  <option value="'Arial', sans-serif">
    Arial
  </option>

  <option value="'Verdana', sans-serif">
    Verdana
  </option>

  <option value="'Tahoma', sans-serif">
    Tahoma
  </option>

  <option value="'Trebuchet MS', sans-serif">
    Trebuchet MS
  </option>

  <option value="'Georgia', serif">
    Georgia
  </option>

  <option value="'Times New Roman', serif">
    Times New Roman
  </option>

  <option value="'Courier New', monospace">
    Courier New
  </option>
</select>
</div>

  <div className="grid grid-cols-2 gap-2">
    <div>
      <label className="block text-xs font-medium">글자 크기</label>
      <input
        type="number"
        className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
        value={selectedElement.fontSize}
        disabled={selectedElement.locked}
        onChange={(e) =>
          updateElement(selectedElement.id, {
            fontSize: Number(e.target.value) || 16,
          } as Partial<FormCanvasElement>)
        }
      />
    </div>

    <div>
      <label className="block text-xs font-medium">굵기</label>
      <input
        type="number"
        className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
        value={selectedElement.fontWeight}
        disabled={selectedElement.locked}
        onChange={(e) =>
          updateElement(selectedElement.id, {
            fontWeight: Number(e.target.value) || 400,
          } as Partial<FormCanvasElement>)
        }
      />
    </div>
  </div>

  <div>
    <label className="block text-xs font-medium">글자색</label>
    <input
      className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
      value={selectedElement.color}
      disabled={selectedElement.locked}
      onChange={(e) =>
        updateElement(selectedElement.id, {
          color: e.target.value,
        } as Partial<FormCanvasElement>)
      }
      placeholder="#111827"
    />
  </div>

  <div>
    <label className="block text-xs font-medium">정렬</label>
    <select
      className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
      value={selectedElement.textAlign ?? "left"}
      disabled={selectedElement.locked}
      onChange={(e) =>
        updateElement(selectedElement.id, {
          textAlign: e.target.value as "left" | "center" | "right",
        } as Partial<FormCanvasElement>)
      }
    >
      <option value="left">왼쪽</option>
      <option value="center">가운데</option>
      <option value="right">오른쪽</option>
    </select>
  </div>

<div className="rounded-xl border bg-white p-3 space-y-3">
  <h5 className="text-sm font-bold text-slate-800">텍스트 효과</h5>

  <div className="grid grid-cols-2 gap-2">
    <div>
      <label className="block text-xs font-medium">외곽선 색상</label>
      <input
        type="color"
        className="h-10 w-full rounded border p-1"
        value={selectedElement.strokeColor || "#000000"}
        onChange={(e) =>
          updateElement(selectedElement.id, {
            strokeColor: e.target.value,
          } as Partial<FormCanvasElement>)
        }
      />
    </div>

    <div>
      <label className="block text-xs font-medium">외곽선 두께</label>
      <input
        type="number"
        min={0}
        max={12}
        className="w-full rounded border p-2"
        value={selectedElement.strokeWidth || 0}
        onChange={(e) =>
          updateElement(selectedElement.id, {
            strokeWidth: Number(e.target.value) || 0,
          } as Partial<FormCanvasElement>)
        }
      />
    </div>
  </div>

  <div className="grid grid-cols-2 gap-2">
    <div>
      <label className="block text-xs font-medium">그림자 색상</label>
      <input
        type="color"
        className="h-10 w-full rounded border p-1"
        value={selectedElement.shadowColor || "#000000"}
        onChange={(e) =>
          updateElement(selectedElement.id, {
            shadowColor: e.target.value,
          } as Partial<FormCanvasElement>)
        }
      />
    </div>

    <div>
      <label className="block text-xs font-medium">그림자 흐림</label>
      <input
        type="number"
        min={0}
        max={40}
        className="w-full rounded border p-2"
        value={selectedElement.shadowBlur || 0}
        onChange={(e) =>
          updateElement(selectedElement.id, {
            shadowBlur: Number(e.target.value) || 0,
          } as Partial<FormCanvasElement>)
        }
      />
    </div>
  </div>

  <div className="grid grid-cols-2 gap-2">
    <div>
      <label className="block text-xs font-medium">그림자 X</label>
      <input
        type="number"
        min={-50}
        max={50}
        className="w-full rounded border p-2"
        value={selectedElement.shadowOffsetX || 0}
        onChange={(e) =>
          updateElement(selectedElement.id, {
            shadowOffsetX: Number(e.target.value) || 0,
          } as Partial<FormCanvasElement>)
        }
      />
    </div>

    <div>
      <label className="block text-xs font-medium">그림자 Y</label>
      <input
        type="number"
        min={-50}
        max={50}
        className="w-full rounded border p-2"
        value={selectedElement.shadowOffsetY || 0}
        onChange={(e) =>
          updateElement(selectedElement.id, {
            shadowOffsetY: Number(e.target.value) || 0,
          } as Partial<FormCanvasElement>)
        }
      />
    </div>
  </div>
</div>
</div>
                      ) : isImageElement(selectedElement) ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium">이미지 URL</label>
                  <input
                    className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
                    value={selectedElement.url}
disabled={selectedElement.locked}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        url: e.target.value,
                      } as Partial<FormCanvasElement>)
                    }
                    placeholder="https://..."
                  />
                </div>

<div>
  <label className="block text-xs font-medium">이미지 업로드</label>
  <input
    type="file"
    accept="image/*"
disabled={selectedElement.locked}
    className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
    onChange={async (e) => {
      const file = e.target.files?.[0];
      e.currentTarget.value = "";
      if (!file) return;
      await uploadSelectedImage(file);
    }}
  />
</div>

                <div>
                  <label className="block text-xs font-medium">이미지 맞춤</label>
                  <select
                    className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
                    value={selectedElement.objectFit ?? "cover"}
disabled={selectedElement.locked}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        objectFit: e.target.value as "cover" | "contain",
                      } as Partial<FormCanvasElement>)
                    }
                  >
                    <option value="cover">채우기</option>
                    <option value="contain">전체 보이기</option>
                  </select>
                </div>
              </div>
            ) : isButtonElement(selectedElement) ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium">버튼 문구</label>
                  <input
                    className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
                    value={selectedElement.text}
disabled={selectedElement.locked}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        text: e.target.value,
                      } as Partial<FormCanvasElement>)
                    }
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium">배경색</label>
                  <input
                    className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
                    value={selectedElement.backgroundColor}
disabled={selectedElement.locked}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        backgroundColor: e.target.value,
                      } as Partial<FormCanvasElement>)
                    }
                    placeholder="#111827"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium">글자색</label>
                  <input
                    className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
                    value={selectedElement.color}
disabled={selectedElement.locked}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        color: e.target.value,
                      } as Partial<FormCanvasElement>)
                    }
                    placeholder="#ffffff"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium">둥글기</label>
                  <input
                    type="number"
                    className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
                    value={selectedElement.borderRadius}
disabled={selectedElement.locked}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        borderRadius: Number(e.target.value) || 0,
                      } as Partial<FormCanvasElement>)
                    }
                  />
                </div>
<div>
  <label className="block text-xs font-medium">버튼 애니메이션</label>
  <select
    className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
    value={selectedElement.hoverEffect || "none"}
    disabled={selectedElement.locked}
    onChange={(e) =>
      updateElement(selectedElement.id, {
        hoverEffect: e.target.value as "none" | "lift" | "scale" | "glow",
      } as Partial<FormCanvasElement>)
    }
  >
    <option value="none">없음</option>
    <option value="lift">살짝 위로</option>
    <option value="scale">살짝 확대</option>
    <option value="glow">그림자 강조</option>
  </select>
</div>

                <div>
                  <label className="block text-xs font-medium">버튼 동작</label>
                  <select
                    className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
                    value={selectedElement.action ?? "openForm"}
disabled={selectedElement.locked}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        action: e.target.value as "openForm" | "link" | "tel",
                      } as Partial<FormCanvasElement>)
                    }
                  >
                    <option value="openForm">상담신청 폼 열기</option>
<option value="link">외부 링크 열기</option>
<option value="tel">담당자 전화걸기</option>
                  </select>
                </div>

                {selectedElement.action === "link" ? (
  <div className="rounded-lg border bg-slate-50 p-2 space-y-2">
    <label className="block text-xs font-medium">외부 링크 URL</label>

    <input
      className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
      value={selectedElement.href || ""}
      disabled={selectedElement.locked}
      onChange={(e) =>
        updateElement(selectedElement.id, {
          href: e.target.value,
        } as Partial<FormCanvasElement>)
      }
      placeholder="예: https://naver.com 또는 naver.com"
    />

    <p className="text-[11px] text-slate-500">
      http 없이 입력해도 고객 페이지에서는 자동으로 https:// 가 붙습니다.
    </p>
  </div>
) : selectedElement.action === "tel" ? (
  <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 space-y-2">
    <label className="block text-xs font-medium text-amber-800">
      직접 연결할 전화번호
    </label>

    <input
      className="w-full rounded border p-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
      value={selectedElement.telNumber || ""}
      disabled={selectedElement.locked}
      onChange={(e) =>
        updateElement(selectedElement.id, {
          telNumber: e.target.value,
        } as Partial<FormCanvasElement>)
      }
      placeholder="예: 01012345678"
    />

    <p className="text-[11px] leading-relaxed text-amber-700">
      비워두면 토큰에 배정된 담당자 전화번호로 자동 연결됩니다.
    </p>
  </div>
) : (
  <div className="rounded-lg border border-blue-100 bg-blue-50 p-2 text-xs text-blue-700">
    클릭 시 상담신청 입력창이 열립니다.
  </div>
)}
<div className="rounded-lg border bg-white p-2 space-y-2">
  <div className="text-xs font-semibold text-slate-600">버튼 빠른 스타일</div>

  <div className="grid grid-cols-2 gap-2">
    <button
      type="button"
      disabled={selectedElement.locked}
      onClick={() =>
        updateElement(selectedElement.id, {
          backgroundColor: "#111827",
          color: "#ffffff",
          borderRadius: 18,
hoverEffect: "lift",
        } as Partial<FormCanvasElement>)
      }
      className="rounded border px-2 py-2 text-xs disabled:opacity-40"
    >
      블랙 CTA
    </button>

    <button
      type="button"
      disabled={selectedElement.locked}
      onClick={() =>
        updateElement(selectedElement.id, {
          backgroundColor: "#5fc065",
          color: "#ffffff",
          borderRadius: 999,
hoverEffect: "scale",
        } as Partial<FormCanvasElement>)
      }
      className="rounded border px-2 py-2 text-xs disabled:opacity-40"
    >
      초록 라운드
    </button>

    <button
      type="button"
      disabled={selectedElement.locked}
      onClick={() =>
        updateElement(selectedElement.id, {
          backgroundColor: "#f59e0b",
          color: "#111827",
          borderRadius: 16,
hoverEffect: "glow",
        } as Partial<FormCanvasElement>)
      }
      className="rounded border px-2 py-2 text-xs disabled:opacity-40"
    >
      옐로우 강조
    </button>

    <button
      type="button"
      disabled={selectedElement.locked}
      onClick={() =>
        updateElement(selectedElement.id, {
          backgroundColor: "#ffffff",
          color: "#111827",
          borderRadius: 18,
hoverEffect: "lift",
        } as Partial<FormCanvasElement>)
      }
      className="rounded border px-2 py-2 text-xs disabled:opacity-40"
    >
      화이트 버튼
    </button>
  </div>
</div>
              </div>
                        ) : isShapeElement(selectedElement) ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium">도형 종류</label>
                  <select
                    className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
                    value={selectedElement.shape}
disabled={selectedElement.locked}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        shape: e.target.value as "rect" | "circle",
                      } as Partial<FormCanvasElement>)
                    }
                  >
                    <option value="rect">사각형</option>
                    <option value="circle">원형</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium">배경색</label>
                  <input
                    className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
                    value={selectedElement.backgroundColor}
disabled={selectedElement.locked}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        backgroundColor: e.target.value,
                      } as Partial<FormCanvasElement>)
                    }
                    placeholder="#f3f4f6"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium">테두리색</label>
                  <input
                    className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
                    value={selectedElement.borderColor || ""}
disabled={selectedElement.locked}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        borderColor: e.target.value,
                      } as Partial<FormCanvasElement>)
                    }
                    placeholder="#e5e7eb"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium">테두리 두께</label>
                  <input
                    type="number"
                    className="w-full rounded border p-2 disabled:bg-slate-100 disabled:text-slate-400"
                    value={selectedElement.borderWidth ?? 0}
disabled={selectedElement.locked}
                    onChange={(e) =>
                      updateElement(selectedElement.id, {
                        borderWidth: Number(e.target.value) || 0,
                      } as Partial<FormCanvasElement>)
                    }
                  />
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                아직 지원하지 않는 요소입니다.
              </p>
            )}
          </div>
        </div>
  ) : null}
      </div>
    </div>
  );
}