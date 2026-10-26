import { useEffect, useMemo, useRef, useState } from "react";

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
  referencePoint?: { lat: number; lng: number } | null;
  onSelectJob?: (job: EmploymentMapJob) => void;
  className?: string;
};

declare global {
  interface Window {
    kakao: any;
  }
}

const KEY = import.meta.env.VITE_KAKAO_MAP_JS_KEY;
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

function markerImage(kakao: any, selected: boolean) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="37" viewBox="0 0 46 56"><path d="M23 2C11 2 2 11 2 23c0 15 21 31 21 31s21-16 21-31C44 11 35 2 23 2Z" fill="#0967F6" stroke="${selected ? "#0F172A" : "white"}" stroke-width="${selected ? 3 : 2}"/><rect x="13" y="20" width="20" height="15" rx="3" fill="white"/><path d="M19 20v-3a4 4 0 0 1 8 0v3" fill="none" stroke="white" stroke-width="2.5"/><path d="M13 26h20" stroke="#0967F6" stroke-width="1.5"/></svg>`;
  return new kakao.maps.MarkerImage(
  `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
  new kakao.maps.Size(30, 37),
  { offset: new kakao.maps.Point(15, 37) }
);
}

export default function EmploymentKakaoMap({
  jobs,
    selectedId,
  referencePoint,
  onSelectJob,
  className = "h-full w-full",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
    const markersRef = useRef<Map<string, any>>(new Map());
  const referenceMarkerRef = useRef<any>(null);
  const selectRef = useRef(onSelectJob);
const latestJobsRef = useRef(
  new Map<string, EmploymentMapJob>()
);

latestJobsRef.current = new Map(
  jobs.map((job) => [String(job.id), job])
);
  const [kakao, setKakao] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => { selectRef.current = onSelectJob; }, [onSelectJob]);

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
      markersRef.current.forEach((marker) => {
  marker.setMap(null);
});

markersRef.current.clear();

referenceMarkerRef.current?.setMap(null);
referenceMarkerRef.current = null;

mapRef.current = null;
    };
  }, []);

  
// 서버에서 전달받은 좌표를 그대로 사용
const located = useMemo<LocatedEmploymentJob[]>(() => {
  return jobs
    .map((job) => {
      const lat = Number(job.latitude);
      const lng = Number(job.longitude);

      if (
        job.latitude == null ||
        job.longitude == null ||
        !Number.isFinite(lat) ||
        !Number.isFinite(lng) ||
        lat < -90 ||
        lat > 90 ||
        lng < -180 ||
        lng > 180
      ) {
        return null;
      }

      return {
        ...job,
        latitude: lat,
        longitude: lng,
      };
    })
    .filter(
      (job): job is LocatedEmploymentJob => job !== null
    );
}, [jobs]);

// 공고 ID를 기준으로 마커를 추가·갱신·삭제
useEffect(() => {
  if (!kakao || !mapRef.current) return;

  const map = mapRef.current;
  const activeIds = new Set<string>();

  for (const job of located) {
    const id = String(job.id);
    activeIds.add(id);

    const position = new kakao.maps.LatLng(
      job.latitude,
      job.longitude
    );

    const selected = id === String(selectedId);

    let marker = markersRef.current.get(id);

    if (!marker) {
      marker = new kakao.maps.Marker({
        map,
        position,
        image: markerImage(kakao, selected),
        zIndex: selected ? 20 : 5,
      });

      kakao.maps.event.addListener(marker, "click", () => {
        const currentJob = latestJobsRef.current.get(id);
        if (currentJob) {
          selectRef.current?.(currentJob);
        }
      });

      markersRef.current.set(id, marker);
    } else {
      marker.setPosition(position);
      marker.setImage(markerImage(kakao, selected));
      marker.setZIndex(selected ? 20 : 5);
    }
  }

  for (const [id, marker] of markersRef.current) {
    if (!activeIds.has(id)) {
      marker.setMap(null);
      markersRef.current.delete(id);
    }
  }
}, [kakao, located, selectedId]);

  useEffect(() => {
    if (!kakao || !mapRef.current) return;

    referenceMarkerRef.current?.setMap(null);
    referenceMarkerRef.current = null;

    if (!referencePoint) return;

    const position = new kakao.maps.LatLng(
      referencePoint.lat,
      referencePoint.lng
    );

    const marker = new kakao.maps.CustomOverlay({
      position,
      yAnchor: 0.5,
      zIndex: 100,
      content: `
        <div style="
          width:20px;
          height:20px;
          border:4px solid white;
          border-radius:50%;
          background:#0967F6;
          box-shadow:0 0 0 8px rgba(9,103,246,.15),
                     0 2px 8px rgba(0,0,0,.2);
        "></div>
      `,
    });

    marker.setMap(mapRef.current);
    referenceMarkerRef.current = marker;

    return () => {
      marker.setMap(null);
      if (referenceMarkerRef.current === marker) {
        referenceMarkerRef.current = null;
      }
    };
  }, [kakao, referencePoint]);

 useEffect(() => {
  if (!kakao || !mapRef.current || !selectedId) return;

  const job = located.find(
    (item) => String(item.id) === String(selectedId)
  );

  if (!job || job.latitude == null || job.longitude == null) {
    return;
  }

  mapRef.current.panTo(
    new kakao.maps.LatLng(job.latitude, job.longitude)
  );
}, [selectedId, kakao, located]);

  useEffect(() => {
  if (!kakao || !mapRef.current || !referencePoint) return;

  const map = mapRef.current;

  const position = new kakao.maps.LatLng(
    referencePoint.lat,
    referencePoint.lng
  );

  map.setCenter(position);
  map.setLevel(5);
}, [kakao, referencePoint?.lat, referencePoint?.lng]);

  if (error) return <div className="flex h-full items-center justify-center bg-slate-100 p-4 text-center text-sm text-red-600">{error}</div>;
  return <div ref={containerRef} className={className} aria-label="채용공고 근무지 지도" />;
}
