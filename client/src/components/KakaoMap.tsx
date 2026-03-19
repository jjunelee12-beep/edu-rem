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
        () => {
          reject(new Error("카카오맵 스크립트 로드 실패"));
        },
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

    script.onerror = () => {
      reject(new Error("카카오맵 스크립트 로드 실패"));
    };

    document.head.appendChild(script);
  });
}

function getMarkerImageByType(
  kakao: any,
  type: "search" | "education" | "institution" | "selected"
) {
  let imageSrc = "";
  const imageSize = new kakao.maps.Size(36, 36);

  switch (type) {
    case "search":
      imageSrc =
        "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png";
      break;
    case "education":
      imageSrc =
        "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_blue.png";
      break;
    case "institution":
      imageSrc =
        "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_orange.png";
      break;
    case "selected":
      imageSrc =
        "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_red.png";
      break;
    default:
      imageSrc =
        "https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/marker_blue.png";
      break;
  }

  return new kakao.maps.MarkerImage(imageSrc, imageSize);
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
  const overlayRef = useRef<any[]>([]);
  const searchMarkerRef = useRef<any>(null);
  const selectedMarkerRef = useRef<any>(null);

  const [error, setError] = useState<string>("");

  const normalizedAddress = useMemo(() => (address || "").trim(), [address]);

  function clearResultMarkers() {
    resultMarkersRef.current.forEach((m) => m.setMap(null));
    resultMarkersRef.current = [];

    overlayRef.current.forEach((o) => o.setMap(null));
    overlayRef.current = [];
  }

  function clearSearchMarker() {
    if (searchMarkerRef.current) {
      searchMarkerRef.current.setMap(null);
      searchMarkerRef.current = null;
    }
  }

  function clearSelectedMarker() {
    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.setMap(null);
      selectedMarkerRef.current = null;
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
      clearResultMarkers();
      clearSearchMarker();
      clearSelectedMarker();
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

    clearSearchMarker();

    if (!showSearchPointMarker || !searchPoint) return;

    const pos = new kakao.maps.LatLng(searchPoint.lat, searchPoint.lng);

    const marker = new kakao.maps.Marker({
      map,
      position: pos,
      image: getMarkerImageByType(kakao, "search"),
      zIndex: 10,
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
      yAnchor: 1.6,
      zIndex: 11,
    });

    overlay.setMap(map);
    searchMarkerRef.current = marker;
    overlayRef.current.push(overlay);
  }, [searchPoint, searchPointLabel, showSearchPointMarker]);

  useEffect(() => {
    const map = mapObjRef.current;
    const kakao = window.kakao;
    if (!map || !kakao?.maps) return;

    clearResultMarkers();

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

      const type =
        item.type || item.institutionType || "institution";

      const pos = new kakao.maps.LatLng(lat, lng);

      const marker = new kakao.maps.Marker({
        map,
        position: pos,
        image: getMarkerImageByType(
          kakao,
          type === "education" ? "education" : "institution"
        ),
        zIndex: 5,
      });

      const content = `
        <div style="
          padding:8px 10px;
          background:white;
          border:1px solid #e5e7eb;
          border-radius:10px;
          font-size:12px;
          color:#111827;
          box-shadow:0 2px 8px rgba(0,0,0,0.08);
          min-width:140px;
        ">
          <div style="font-weight:700; margin-bottom:2px;">${item.name}</div>
          <div style="color:#6b7280;">
            ${type === "education" ? "실습교육원" : "실습기관"}
          </div>
          ${
            item.distanceKm !== null &&
            item.distanceKm !== undefined &&
            item.distanceKm !== ""
              ? `<div style="margin-top:4px; color:#2563eb; font-weight:600;">${item.distanceKm}km</div>`
              : ""
          }
        </div>
      `;

      const overlay = new kakao.maps.CustomOverlay({
        position: pos,
        content,
        yAnchor: 1.6,
        zIndex: 6,
      });

      kakao.maps.event.addListener(marker, "click", () => {
        onSelectResult?.(item);
      });

      kakao.maps.event.addListener(marker, "mouseover", () => {
        overlay.setMap(map);
      });

      kakao.maps.event.addListener(marker, "mouseout", () => {
        if (String(selectedResult?.id || "") !== String(item.id)) {
          overlay.setMap(null);
        }
      });

      resultMarkersRef.current.push(marker);
      overlayRef.current.push(overlay);
      bounds.extend(pos);
      hasMarker = true;

      if (String(selectedResult?.id || "") === String(item.id)) {
        overlay.setMap(map);
      }
    }

    if (hasMarker) {
      map.setBounds(bounds);
    }
  }, [results, onSelectResult, selectedResult, searchPoint, showSearchPointMarker]);

  useEffect(() => {
    const map = mapObjRef.current;
    const kakao = window.kakao;
    if (!map || !selectedResult || !kakao?.maps) return;

    clearSelectedMarker();

    const lat = toNum(selectedResult.latitude);
    const lng = toNum(selectedResult.longitude);
    if (lat === null || lng === null) return;

    const pos = new kakao.maps.LatLng(lat, lng);

    const selectedMarker = new kakao.maps.Marker({
      map,
      position: pos,
      image: getMarkerImageByType(kakao, "selected"),
      zIndex: 20,
    });

    selectedMarkerRef.current = selectedMarker;
    map.setCenter(pos);
  }, [selectedResult]);

  if (error) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center rounded-none border-0 px-4 text-sm text-red-500">
        {error}
      </div>
    );
  }

  return <div ref={mapRef} className="h-full min-h-0 w-full rounded-none border-0" />;
}