import { useEffect, useMemo, useRef, useState } from "react";

type FinderItem = {
  id: number;
  name: string;
  address?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  institutionType?: "education" | "institution";
  distanceKm?: number | null;
};

type KakaoMapProps = {
  address?: string;
  searchTrigger?: number;
  includeEducationCenter?: boolean;
  includePracticeInstitution?: boolean;
  results?: FinderItem[];
  selectedResult?: FinderItem | null;
  onSelectResult?: (item: FinderItem) => void;
};

declare global {
  interface Window {
    kakao: any;
  }
}

const FALLBACK_KAKAO_JS_KEY = "541dd56098645e0bc150bc07fb6dc542";
const KAKAO_JS_KEY =
  import.meta.env.VITE_KAKAO_MAP_JS_KEY || FALLBACK_KAKAO_JS_KEY;

console.log("ENV:", import.meta.env);
console.log("KAKAO KEY:", KAKAO_JS_KEY);

function toNum(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function loadKakaoMapScript(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!KAKAO_JS_KEY) {
      reject(new Error("카카오맵 JS 키가 없습니다."));
      return;
    }

    if (window.kakao?.maps) {
      console.log("[KAKAO] already loaded");
      window.kakao.maps.load(() => resolve(window.kakao));
      return;
    }

    const scriptSrc = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false&libraries=services`;
    console.log("[KAKAO] script src =", scriptSrc);

    const existing = document.querySelector(
      'script[data-kakao-map="true"]'
    ) as HTMLScriptElement | null;

    if (existing) {
      console.log("[KAKAO] existing script found");

      const onLoad = () => {
        if (!window.kakao?.maps) {
          reject(new Error("카카오맵 객체가 없습니다."));
          return;
        }
        window.kakao.maps.load(() => {
          console.log("[KAKAO] maps loaded from existing script");
          resolve(window.kakao);
        });
      };

      const onError = () => {
        console.error("[KAKAO] existing script load failed");
        reject(new Error("카카오맵 스크립트 로드 실패"));
      };

      if ((existing as any).dataset.loaded === "true" && window.kakao?.maps) {
        onLoad();
        return;
      }

      existing.addEventListener("load", onLoad, { once: true });
      existing.addEventListener("error", onError, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.dataset.kakaoMap = "true";
    script.src = scriptSrc;

    script.onload = () => {
      (script as any).dataset.loaded = "true";
      console.log("[KAKAO] script loaded");

      if (!window.kakao?.maps) {
        reject(new Error("카카오맵 객체가 로드되지 않았습니다."));
        return;
      }

      window.kakao.maps.load(() => {
        console.log("[KAKAO] maps.load complete");
        resolve(window.kakao);
      });
    };

    script.onerror = (e) => {
      console.error("[KAKAO SCRIPT ERROR]", e, scriptSrc);
      reject(new Error("카카오맵 스크립트 로드 실패"));
    };

    document.head.appendChild(script);
  });
}

export default function KakaoMap({
  address,
  searchTrigger,
  results = [],
  selectedResult,
  onSelectResult,
}: KakaoMapProps) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapObjRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const geocoderRef = useRef<any>(null);

  const [error, setError] = useState<string>("");

  const normalizedAddress = useMemo(() => (address || "").trim(), [address]);

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

        console.log("[KAKAO] map initialized");
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
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
    };
  }, []);

  useEffect(() => {
    const map = mapObjRef.current;
    const geocoder = geocoderRef.current;
    if (!map || !geocoder) return;
    if (!normalizedAddress) return;

    geocoder.addressSearch(normalizedAddress, (result: any[], status: string) => {
      if (status !== window.kakao.maps.services.Status.OK || !result?.length) {
        console.warn("[KAKAO] 주소 검색 실패:", normalizedAddress, status);
        return;
      }

      const y = Number(result[0].y);
      const x = Number(result[0].x);
      const pos = new window.kakao.maps.LatLng(y, x);

      map.setCenter(pos);
      console.log("[KAKAO] address centered:", normalizedAddress, y, x);
    });
  }, [normalizedAddress, searchTrigger]);

  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !window.kakao?.maps) return;

    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    const bounds = new window.kakao.maps.LatLngBounds();
    let hasMarker = false;

    for (const item of results) {
      const lat = toNum(item.latitude);
      const lng = toNum(item.longitude);

      if (lat === null || lng === null) continue;

      const pos = new window.kakao.maps.LatLng(lat, lng);
      const marker = new window.kakao.maps.Marker({
        map,
        position: pos,
      });

      window.kakao.maps.event.addListener(marker, "click", () => {
        onSelectResult?.(item);
      });

      markersRef.current.push(marker);
      bounds.extend(pos);
      hasMarker = true;
    }

    if (hasMarker) {
      map.setBounds(bounds);
      console.log("[KAKAO] markers rendered:", markersRef.current.length);
    }
  }, [results, onSelectResult]);

  useEffect(() => {
    const map = mapObjRef.current;
    if (!map || !selectedResult || !window.kakao?.maps) return;

    const lat = toNum(selectedResult.latitude);
    const lng = toNum(selectedResult.longitude);

    if (lat === null || lng === null) return;

    const pos = new window.kakao.maps.LatLng(lat, lng);
    map.setCenter(pos);

    console.log("[KAKAO] selected result centered:", selectedResult.name);
  }, [selectedResult]);

  if (error) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-md border px-4 text-sm text-red-500">
        {error}
      </div>
    );
  }

  return <div ref={mapRef} className="h-[500px] w-full rounded-md border" />;
}