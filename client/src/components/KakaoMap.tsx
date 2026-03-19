import { useEffect, useMemo, useRef, useState } from "react";
console.log("ENV:", import.meta.env);
console.log("KAKAO KEY:", import.meta.env.VITE_KAKAO_MAP_JS_KEY);
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

const KAKAO_JS_KEY = import.meta.env.VITE_KAKAO_MAP_JS_KEY;

function toNum(v: any) {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function loadKakaoMapScript(): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!KAKAO_JS_KEY) {
      reject(new Error("VITE_KAKAO_MAP_JS_KEY 환경변수가 없습니다."));
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
      existing.addEventListener("load", () => {
        if (!window.kakao?.maps) {
          reject(new Error("카카오맵 객체가 없습니다."));
          return;
        }
        window.kakao.maps.load(() => resolve(window.kakao));
      });

      existing.addEventListener("error", () => {
        reject(new Error("카카오맵 스크립트 로드 실패"));
      });

      return;
    }

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.dataset.kakaoMap = "true";
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false&libraries=services`;

    console.log("[KAKAO] script src =", script.src);

    script.onload = () => {
      if (!window.kakao?.maps) {
        reject(new Error("카카오맵 객체가 로드되지 않았습니다."));
        return;
      }

      window.kakao.maps.load(() => {
        console.log("[KAKAO] maps loaded");
        resolve(window.kakao);
      });
    };

    script.onerror = () => {
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

        const center = new kakao.maps.LatLng(37.5665, 126.978); // 서울 기본값
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
  }, [selectedResult]);

  if (error) {
    return (
      <div className="flex h-[500px] items-center justify-center rounded-md border text-sm text-red-500">
        {error}
      </div>
    );
  }

  return <div ref={mapRef} className="h-[500px] w-full rounded-md border" />;
}