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

      window.kakao.maps.load(() => {
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
    <div className="flex h-full min-h-0 w-full items-center justify-center rounded-none border-0 px-4 text-sm text-red-500">
      {error}
    </div>
  );
}

return <div ref={mapRef} className="h-full min-h-0 w-full rounded-none border-0" />;
}