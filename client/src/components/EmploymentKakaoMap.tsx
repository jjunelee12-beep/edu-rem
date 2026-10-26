import { useCallback, useEffect, useRef, useState } from "react";

/** 고용24 공고의 실제 근무지 주소를 지도에 표시하는 취업정보센터 전용 지도 */
export type EmploymentMapJob = {
  id: string;
  company: string;
  title: string;
  address: string;
  salary?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type LocatedEmploymentJob = EmploymentMapJob & {
  latitude: number | null;
  longitude: number | null;
};

type Props = {
  jobs: EmploymentMapJob[];
  selectedId?: string | null;
  searchAddress?: string;
  onSelectJob?: (job: EmploymentMapJob) => void;
  onLocatedJobsChange?: (jobs: LocatedEmploymentJob[]) => void;
  className?: string;
};

declare global {
  interface Window {
    kakao: any;
  }
}

const KEY = import.meta.env.VITE_KAKAO_MAP_JS_KEY;
const addressCache = new Map<string, { lat: number; lng: number } | null>();
let sdkPromise: Promise<any> | null = null;

function loadKakao(): Promise<any> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    if (!KEY) {
      reject(new Error("VITE_KAKAO_MAP_JS_KEY가 설정되지 않았습니다."));
      return;
    }
    const ready = () => {
      if (!window.kakao?.maps) {
        reject(new Error("카카오 지도 SDK를 불러오지 못했습니다."));
        return;
      }
      window.kakao.maps.load(() => resolve(window.kakao));
    };
    if (window.kakao?.maps) return ready();
    const existing = document.querySelector<HTMLScriptElement>('script[data-kakao-map="true"]');
    if (existing) {
      existing.addEventListener("load", ready, { once: true });
      existing.addEventListener("error", () => reject(new Error("카카오 지도 SDK 로드 실패")), { once: true });
      // 기존 SDK가 이미 로드된 경우에도 대응
      if (window.kakao?.maps) ready();
      return;
    }
    const script = document.createElement("script");
    script.dataset.kakaoMap = "true";
    script.async = true;
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(KEY)}&autoload=false&libraries=services`;
    script.onload = ready;
    script.onerror = () => reject(new Error("카카오 지도 SDK 로드 실패"));
    document.head.appendChild(script);
  }).catch((err) => {
    sdkPromise = null;
    throw err;
  });
  return sdkPromise;
}

function findAddress(
  kakao: any,
  address: string,
  allowKeywordFallback = false
): Promise<{ lat: number; lng: number } | null> {
  const key = `${allowKeywordFallback ? "search" : "address"}:${address.trim()}`;
const query = address.trim();
  if (!query) return Promise.resolve(null);

  if (addressCache.has(key)) {
    return Promise.resolve(addressCache.get(key)!);
  }

  return new Promise((resolve) => {
    const geocoder = new kakao.maps.services.Geocoder();

    geocoder.addressSearch(query, (results: any[], status: string) => {
      if (status === kakao.maps.services.Status.OK && results?.length) {
        const lat = Number(results[0].y);
        const lng = Number(results[0].x);

        const coord =
          Number.isFinite(lat) && Number.isFinite(lng)
            ? { lat, lng }
            : null;

        addressCache.set(key, coord);
        resolve(coord);
        return;
      }

if (!allowKeywordFallback) {
  addressCache.set(key, null);
  resolve(null);
  return;
}

      // 정확한 주소가 아니면 장소명 검색으로 재시도
      const places = new kakao.maps.services.Places();

      places.keywordSearch(query, (items: any[], placeStatus: string) => {
        const coord =
          placeStatus === kakao.maps.services.Status.OK &&
          items?.length &&
          Number.isFinite(Number(items[0].y)) &&
          Number.isFinite(Number(items[0].x))
            ? {
                lat: Number(items[0].y),
                lng: Number(items[0].x),
              }
            : null;

        addressCache.set(key, coord);
        resolve(coord);
      });
    });
  });
}

function markerImage(kakao: any, selected: boolean) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="56" viewBox="0 0 46 56"><path d="M23 2C11 2 2 11 2 23c0 15 21 31 21 31s21-16 21-31C44 11 35 2 23 2Z" fill="#0967F6" stroke="${selected ? "#0F172A" : "white"}" stroke-width="${selected ? 3 : 2}"/><rect x="13" y="20" width="20" height="15" rx="3" fill="white"/><path d="M19 20v-3a4 4 0 0 1 8 0v3" fill="none" stroke="white" stroke-width="2.5"/><path d="M13 26h20" stroke="#0967F6" stroke-width="1.5"/></svg>`;
  return new kakao.maps.MarkerImage(
    `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    new kakao.maps.Size(46, 56),
    { offset: new kakao.maps.Point(23, 56) }
  );
}

export default function EmploymentKakaoMap({
  jobs,
  selectedId,
  searchAddress,
  onSelectJob,
  onLocatedJobsChange,
  className = "h-full w-full",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const selectedIdRef = useRef(selectedId);
  const selectRef = useRef(onSelectJob);
  const locatedRef = useRef(onLocatedJobsChange);
  const [kakao, setKakao] = useState<any>(null);
  const [error, setError] = useState("");
  const [located, setLocated] = useState<LocatedEmploymentJob[]>([]);

  useEffect(() => { selectedIdRef.current = selectedId; }, [selectedId]);
  useEffect(() => { selectRef.current = onSelectJob; }, [onSelectJob]);
  useEffect(() => { locatedRef.current = onLocatedJobsChange; }, [onLocatedJobsChange]);

  useEffect(() => {
    let active = true;
    loadKakao().then((sdk) => {
      if (!active || !containerRef.current) return;
      const map = new sdk.maps.Map(containerRef.current, {
        center: new sdk.maps.LatLng(37.5665, 126.978),
        level: 7,
      });
      mapRef.current = map;
      setKakao(sdk);
    }).catch((err) => { if (active) setError(err.message || "지도 로딩 실패"); });
    return () => {
      active = false;
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!kakao) return;
    let cancelled = false;
    (async () => {
      const result: LocatedEmploymentJob[] = [];
      // 카카오 지오코딩 과도 호출 방지: 순차 처리, 동일 주소는 캐시
      for (const job of jobs) {
        if (cancelled) return;
        let coord: { lat: number; lng: number } | null = null;
        const lat = job.latitude == null ? NaN : Number(job.latitude);
const lng = job.longitude == null ? NaN : Number(job.longitude);

if (
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  lat >= -90 &&
  lat <= 90 &&
  lng >= -180 &&
  lng <= 180
) {
  coord = { lat, lng };
} else {
  coord = await findAddress(kakao, job.address || "");
}
        result.push({ ...job, latitude: coord?.lat ?? null, longitude: coord?.lng ?? null });
      }
      if (!cancelled) {
        setLocated(result);
        locatedRef.current?.(result);
      }
    })();
    return () => { cancelled = true; };
  }, [jobs, kakao]);

  const draw = useCallback(() => {
    const map = mapRef.current;
    if (!map || !kakao) return;
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    for (const job of located) {
      if (job.latitude === null || job.longitude === null) continue;
      const position = new kakao.maps.LatLng(job.latitude, job.longitude);
      const marker = new kakao.maps.Marker({
        map,
        position,
        image: markerImage(kakao, String(job.id) === String(selectedIdRef.current)),
        zIndex: String(job.id) === String(selectedIdRef.current) ? 20 : 5,
      });
      kakao.maps.event.addListener(marker, "click", () => selectRef.current?.(job));
      markersRef.current.push(marker);
    }
    // 마커 갱신 시 사용자가 선택한 지도 중심을 유지
  }, [kakao, located]);

  useEffect(() => { draw(); }, [draw]);

  useEffect(() => {
    if (!kakao || !mapRef.current || !selectedId) return;
    const job = located.find((item) => String(item.id) === String(selectedId));
    if (!job || job.latitude === null || job.longitude === null) return;
    mapRef.current.panTo(new kakao.maps.LatLng(job.latitude, job.longitude));
    // 선택 마커만 강조하고 지도 전체 범위를 다시 맞추지 않음
    markersRef.current.forEach((marker, i) => {
      const mapped = located.filter((j) => j.latitude !== null && j.longitude !== null)[i];
      if (mapped) marker.setImage(markerImage(kakao, String(mapped.id) === String(selectedId)));
    });
  }, [selectedId, kakao, located]);

  useEffect(() => {
    if (!kakao || !mapRef.current || !searchAddress?.trim()) return;
    let cancelled = false;
    findAddress(kakao, searchAddress, true).then((coord) => {
      if (!cancelled && coord && mapRef.current) {
        mapRef.current.setCenter(new kakao.maps.LatLng(coord.lat, coord.lng));
        mapRef.current.setLevel(5);
      }
    });
    return () => { cancelled = true; };
  }, [kakao, searchAddress]);

  if (error) return <div className="flex h-full items-center justify-center bg-slate-100 p-4 text-center text-sm text-red-600">{error}</div>;
  return <div ref={containerRef} className={className} aria-label="채용공고 근무지 지도" />;
}
