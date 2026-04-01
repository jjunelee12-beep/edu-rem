import { useEffect, useMemo, useRef, useState } from "react";

type FinderItem = {
  id: string | number;
  name: string;
  address?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  type?: "education" | "institution";
  institutionType?: "education" | "institution";
  distanceKm?: number | string | null;

  isInactive?: boolean;
  inactiveReason?: string;
  inactiveStartDate?: string | null;
  inactiveEndDate?: string | null;
  hideOnMapWhenInactive?: boolean;
};

type KakaoMapProps = {
  address?: string;
  searchTrigger?: number;
  includeEducationCenter?: boolean;
  includePracticeInstitution?: boolean;
  results?: FinderItem[];
  selectedResult?: FinderItem | null;
  onSelectResult?: (item: FinderItem) => void;
  searchPoint?: {
    lat: number;
    lng: number;
  } | null;
  searchPointLabel?: string;
  showSearchPointMarker?: boolean;
};

declare global {
  interface Window {
    kakao: any;
  }
}

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_MAP_JS_KEY;

function toNum(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function loadKakaoMapScript(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!KAKAO_JS_KEY) {
      reject(new Error("카카오맵 키가 설정되지 않았습니다."));
      return;
    }

    if (window.kakao?.maps) {
      window.kakao.maps.load(() => resolve(window.kakao));
      return;
    }

    const existing = document.querySelector(
      'script[data-kakao-map="true"]'
    ) as HTMLScriptElement | null;

    if (existing) {
      if ((existing as any).dataset.loaded === "true" && window.kakao?.maps) {
        window.kakao.maps.load(() => resolve(window.kakao));
        return;
      }

      existing.addEventListener(
        "load",
        () => {
          if (!window.kakao?.maps) {
            reject(new Error("카카오맵 객체가 없습니다."));
            return;
          }
          window.kakao.maps.load(() => resolve(window.kakao));
        },
        { once: true }
      );

      existing.addEventListener(
        "error",
        () => reject(new Error("카카오맵 스크립트 로드 실패")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.dataset.kakaoMap = "true";
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false&libraries=services`;

    script.onload = () => {
      (script as any).dataset.loaded = "true";

      if (!window.kakao?.maps) {
        reject(new Error("카카오맵 객체가 로드되지 않았습니다."));
        return;
      }

      window.kakao.maps.load(() => resolve(window.kakao));
    };

    script.onerror = () => reject(new Error("카카오맵 스크립트 로드 실패"));
    document.head.appendChild(script);
  });
}

function getTypeLabel(type: "education" | "institution") {
  return type === "education" ? "실습교육원" : "실습기관";
}

function getTypeClasses(type: "education" | "institution") {
  return type === "education"
    ? {
        badgeBg: "#dbeafe",
        badgeColor: "#1d4ed8",
        borderColor: "#bfdbfe",
      }
    : {
        badgeBg: "#ffedd5",
        badgeColor: "#c2410c",
        borderColor: "#fdba74",
      };
}

function toDateOnly(value?: string | null) {
  if (!value) return null;
  const s = String(value).slice(0, 10);
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isFinderItemInactiveNow(item?: FinderItem | null) {
  if (!item?.isInactive) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const start = toDateOnly(item.inactiveStartDate);
  const end = toDateOnly(item.inactiveEndDate);

  if (!start && !end) return true;
  if (start && !end) return today >= start;
  if (!start && end) return today <= end;
  return !!(start && end && today >= start && today <= end);
}

function getInactiveText(item?: FinderItem | null) {
  if (!item) return "";
  if (!item.isInactive && !item.inactiveReason && !item.inactiveStartDate && !item.inactiveEndDate) {
    return "";
  }

  const reason = item.inactiveReason?.trim() || "비활성화";
  const start = item.inactiveStartDate ? String(item.inactiveStartDate).slice(0, 10) : "";
  const end = item.inactiveEndDate ? String(item.inactiveEndDate).slice(0, 10) : "";

  if (start && end) return `${reason} (${start} ~ ${end})`;
  if (start && !end) return `${reason} (${start}부터 사용 불가)`;
  if (!start && end) return `${reason} (${end}까지 사용 불가)`;
  return reason;
}

export default function KakaoMap({
  address,
  searchTrigger,
  results = [],
  selectedResult,
  onSelectResult,
  searchPoint = null,
  searchPointLabel = "",
  showSearchPointMarker = false,
}: KakaoMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObjRef = useRef<any>(null);
  const geocoderRef = useRef<any>(null);

  const resultMarkersRef = useRef<any[]>([]);
  const resultOverlaysRef = useRef<any[]>([]);
  const selectedOverlayRef = useRef<any>(null);
  const searchMarkerRef = useRef<any>(null);
  const searchOverlayRef = useRef<any>(null);

  const [error, setError] = useState("");

  const normalizedAddress = useMemo(() => (address || "").trim(), [address]);

  const safeSelectedResult = useMemo(() => {
    if (!selectedResult) return null;
    if (isFinderItemInactiveNow(selectedResult) && selectedResult.hideOnMapWhenInactive !== false) {
      return null;
    }
    return selectedResult;
  }, [selectedResult]);

  function clearResultLayers() {
    resultMarkersRef.current.forEach((m) => m.setMap(null));
    resultOverlaysRef.current.forEach((o) => o.setMap(null));
    resultMarkersRef.current = [];
    resultOverlaysRef.current = [];
  }

  function clearSearchLayer() {
    if (searchMarkerRef.current) {
      searchMarkerRef.current.setMap(null);
      searchMarkerRef.current = null;
    }
    if (searchOverlayRef.current) {
      searchOverlayRef.current.setMap(null);
      searchOverlayRef.current = null;
    }
  }

  function clearSelectedOverlay() {
    if (selectedOverlayRef.current) {
      selectedOverlayRef.current.setMap(null);
      selectedOverlayRef.current = null;
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        setError("");
        const kakao = await loadKakaoMapScript();
        if (cancelled || !mapRef.current) return;

        const center = new kakao.maps.LatLng(37.5665, 126.978);
        const map = new kakao.maps.Map(mapRef.current, {
          center,
          level: 5,
        });

        mapObjRef.current = map;
        geocoderRef.current = new kakao.maps.services.Geocoder();
      } catch (e: any) {
        console.error("[KAKAO ERROR]", e);
        if (!cancelled) {
          setError(e?.message || "카카오맵 초기화 실패");
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      clearResultLayers();
      clearSearchLayer();
      clearSelectedOverlay();
    };
  }, []);

  useEffect(() => {
    const map = mapObjRef.current;
    const geocoder = geocoderRef.current;
    if (!map || !geocoder) return;
    if (!normalizedAddress) return;

    geocoder.addressSearch(normalizedAddress, (result: any[], status: string) => {
      if (status !== window.kakao.maps.services.Status.OK || !result?.length) {
        return;
      }

      const y = Number(result[0].y);
      const x = Number(result[0].x);
      const pos = new window.kakao.maps.LatLng(y, x);
      map.setCenter(pos);
    });
  }, [normalizedAddress, searchTrigger]);

  useEffect(() => {
    const map = mapObjRef.current;
    const kakao = window.kakao;
    if (!map || !kakao?.maps) return;

    clearSearchLayer();

    if (!showSearchPointMarker || !searchPoint) return;

    const pos = new kakao.maps.LatLng(searchPoint.lat, searchPoint.lng);

    const marker = new kakao.maps.Marker({
      map,
      position: pos,
      zIndex: 20,
    });

    const content = `
      <div style="
        padding:8px 10px;
        background:#ecfdf5;
        border:1px solid #86efac;
        border-radius:10px;
        font-size:12px;
        color:#166534;
        box-shadow:0 2px 8px rgba(0,0,0,0.08);
        white-space:nowrap;
      ">
        <div style="font-weight:700; margin-bottom:2px;">검색 기준 주소</div>
        <div>${searchPointLabel || "입력 주소"}</div>
      </div>
    `;

    const overlay = new kakao.maps.CustomOverlay({
      position: pos,
      content,
      yAnchor: 1.7,
      zIndex: 21,
    });

    overlay.setMap(map);
    searchMarkerRef.current = marker;
    searchOverlayRef.current = overlay;
  }, [searchPoint, searchPointLabel, showSearchPointMarker]);

  useEffect(() => {
    const map = mapObjRef.current;
    const kakao = window.kakao;
    if (!map || !kakao?.maps) return;

    clearResultLayers();

    const bounds = new kakao.maps.LatLngBounds();
    let hasMarker = false;

    if (showSearchPointMarker && searchPoint) {
      bounds.extend(new kakao.maps.LatLng(searchPoint.lat, searchPoint.lng));
      hasMarker = true;
    }

    for (const item of results) {
      const lat = toNum(item.latitude);
      const lng = toNum(item.longitude);
      if (lat === null || lng === null) continue;

      const type = (item.type || item.institutionType || "institution") as
        | "education"
        | "institution";

      const colors = getTypeClasses(type);
      const inactiveNow = isFinderItemInactiveNow(item);
      const pos = new kakao.maps.LatLng(lat, lng);

      const marker = new kakao.maps.Marker({
        map,
        position: pos,
        zIndex: inactiveNow ? 3 : 5,
      });

      const inactiveText = getInactiveText(item);

      const overlayHtml = `
        <div style="
          padding:8px 10px;
          background:white;
          border:1px solid ${inactiveNow ? "#facc15" : colors.borderColor};
          border-radius:12px;
          font-size:12px;
          color:#111827;
          box-shadow:0 2px 8px rgba(0,0,0,0.10);
          min-width:150px;
        ">
          <div style="margin-bottom:6px; display:flex; gap:6px; flex-wrap:wrap;">
            <span style="
              display:inline-flex;
              padding:2px 8px;
              border-radius:999px;
              font-size:11px;
              font-weight:700;
              background:${colors.badgeBg};
              color:${colors.badgeColor};
            ">
              ${getTypeLabel(type)}
            </span>
            ${
              inactiveNow
                ? `<span style="
                    display:inline-flex;
                    padding:2px 8px;
                    border-radius:999px;
                    font-size:11px;
                    font-weight:700;
                    background:#fef3c7;
                    color:#92400e;
                  ">비활성화</span>`
                : ""
            }
          </div>
          <div style="font-weight:700; margin-bottom:2px;">${item.name}</div>
          ${
            inactiveText
              ? `<div style="margin-top:4px; color:#a16207; line-height:1.4;">${inactiveText}</div>`
              : ""
          }
          ${
            item.distanceKm !== null &&
            item.distanceKm !== undefined &&
            item.distanceKm !== ""
              ? `<div style="margin-top:4px; color:#2563eb; font-weight:700;">${item.distanceKm}km</div>`
              : ""
          }
        </div>
      `;

      const overlay = new kakao.maps.CustomOverlay({
        position: pos,
        content: overlayHtml,
        yAnchor: 1.7,
        zIndex: inactiveNow ? 4 : 6,
      });

      kakao.maps.event.addListener(marker, "click", () => {
        onSelectResult?.(item);
      });

      kakao.maps.event.addListener(marker, "mouseover", () => {
        overlay.setMap(map);
      });

      kakao.maps.event.addListener(marker, "mouseout", () => {
        if (String(safeSelectedResult?.id || "") !== String(item.id)) {
          overlay.setMap(null);
        }
      });

      resultMarkersRef.current.push(marker);
      resultOverlaysRef.current.push(overlay);

      if (String(safeSelectedResult?.id || "") === String(item.id)) {
        overlay.setMap(map);
      }

      bounds.extend(pos);
      hasMarker = true;
    }

    if (hasMarker) {
      map.setBounds(bounds);
    }
  }, [results, onSelectResult, safeSelectedResult, searchPoint, showSearchPointMarker]);

  useEffect(() => {
    const map = mapObjRef.current;
    const kakao = window.kakao;
    if (!map || !safeSelectedResult || !kakao?.maps) return;

    clearSelectedOverlay();

    const lat = toNum(safeSelectedResult.latitude);
    const lng = toNum(safeSelectedResult.longitude);
    if (lat === null || lng === null) return;

    const type = (safeSelectedResult.type ||
      safeSelectedResult.institutionType ||
      "institution") as "education" | "institution";
    const colors = getTypeClasses(type);
    const inactiveNow = isFinderItemInactiveNow(safeSelectedResult);
    const inactiveText = getInactiveText(safeSelectedResult);

    const pos = new kakao.maps.LatLng(lat, lng);
    map.setCenter(pos);

    const selectedHtml = `
      <div style="
        padding:10px 12px;
        background:white;
        border:2px solid ${inactiveNow ? "#eab308" : colors.badgeColor};
        border-radius:12px;
        font-size:12px;
        color:#111827;
        box-shadow:0 4px 14px rgba(0,0,0,0.16);
        min-width:180px;
      ">
        <div style="margin-bottom:6px; display:flex; gap:6px; flex-wrap:wrap;">
          <span style="
            display:inline-flex;
            padding:2px 8px;
            border-radius:999px;
            font-size:11px;
            font-weight:700;
            background:${colors.badgeBg};
            color:${colors.badgeColor};
          ">
            선택됨 · ${getTypeLabel(type)}
          </span>
          ${
            inactiveNow
              ? `<span style="
                  display:inline-flex;
                  padding:2px 8px;
                  border-radius:999px;
                  font-size:11px;
                  font-weight:700;
                  background:#fef3c7;
                  color:#92400e;
                ">비활성화</span>`
              : ""
          }
        </div>
        <div style="font-weight:700; margin-bottom:2px;">${safeSelectedResult.name}</div>
        ${
          inactiveText
            ? `<div style="margin-top:4px; color:#a16207; line-height:1.4;">${inactiveText}</div>`
            : ""
        }
        ${
          safeSelectedResult.distanceKm !== null &&
          safeSelectedResult.distanceKm !== undefined &&
          safeSelectedResult.distanceKm !== ""
            ? `<div style="margin-top:4px; color:#2563eb; font-weight:700;">${safeSelectedResult.distanceKm}km</div>`
            : ""
        }
      </div>
    `;

    const overlay = new kakao.maps.CustomOverlay({
      position: pos,
      content: selectedHtml,
      yAnchor: 1.9,
      zIndex: 30,
    });

    overlay.setMap(map);
    selectedOverlayRef.current = overlay;
  }, [safeSelectedResult]);

  if (error) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center rounded-none border-0 px-4 text-sm text-red-500">
        {error}
      </div>
    );
  }

  return <div ref={mapRef} className="h-full min-h-0 w-full rounded-none border-0" />;
}