import { useEffect, useMemo, useRef, useState } from "react";

export type PracticeMapInstitution = {
  id: string;
  name: string;
  address: string;
  price: string | number | null;
  lat?: number | null;
  lng?: number | null;
};

type Props = {
  institutions: PracticeMapInstitution[];
  referencePoint: { lat: number; lng: number };
  selectedId?: string | null;
  onSelectInstitution?: (institution: PracticeMapInstitution) => void;
  className?: string;
};

const KEY = import.meta.env.VITE_KAKAO_MAP_JS_KEY;

let sdkPromise: Promise<any> | null = null;

export function loadKakao(): Promise<any> {
  if (sdkPromise) return sdkPromise;

  sdkPromise = new Promise((resolve, reject) => {
    if (!KEY) {
      reject(new Error("카카오 지도 JavaScript 키가 설정되지 않았습니다."));
      return;
    }

    const ready = () => {
      if (!window.kakao?.maps?.load) {
        reject(new Error("카카오 지도 SDK 초기화에 실패했습니다."));
        return;
      }

      window.kakao.maps.load(() => resolve(window.kakao));
    };

    if (window.kakao?.maps?.load) {
      ready();
      return;
    }

    // 기존 고용24 지도와 SDK 스크립트를 공유
    const existing = document.querySelector<HTMLScriptElement>(
  'script[src*="dapi.kakao.com/v2/maps/sdk.js"]'
);

    if (existing) {
      existing.addEventListener("load", ready, { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("카카오 지도 SDK 로딩 실패")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.dataset.kakaoMap = "true";
    script.async = true;
    script.src =
      `https://dapi.kakao.com/v2/maps/sdk.js` +
      `?appkey=${encodeURIComponent(KEY)}` +
      `&autoload=false&libraries=services`;

    script.onload = ready;
    script.onerror = () =>
      reject(new Error("카카오 지도 SDK 로딩 실패"));

    document.head.appendChild(script);
  }).catch((error) => {
    sdkPromise = null;
    throw error;
  });

  return sdkPromise;
}

function formatPrice(value: string | number | null) {
  if (value == null || String(value).trim() === "") {
    return "정보 없음";
  }

  const raw = String(value).trim();
  const numeric = raw.replace(/[,\s원₩]/g, "");

  return /^\d+(\.\d+)?$/.test(numeric)
    ? `${Number(numeric).toLocaleString("ko-KR")}원`
    : raw;
}

function validPosition(item: PracticeMapInstitution) {
  const lat = Number(item.lat);
  const lng = Number(item.lng);

  return (
    item.lat != null &&
    item.lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= 33 &&
    lat <= 39 &&
    lng >= 124 &&
    lng <= 132
  );
}

export default function PracticeKakaoMap({
  institutions,
  referencePoint,
  selectedId,
  onSelectInstitution,
  className = "h-full w-full",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const referenceMarkerRef = useRef<any>(null);
  const infoRef = useRef<any>(null);

  const onSelectRef = useRef(onSelectInstitution);
  const itemsRef = useRef(new Map<string, PracticeMapInstitution>());

  const [kakao, setKakao] = useState<any>(null);
  const [error, setError] = useState("");

  const located = useMemo(
    () => institutions.filter(validPosition),
    [institutions]
  );

  onSelectRef.current = onSelectInstitution;
  itemsRef.current = new Map(
    institutions.map((item) => [String(item.id), item])
  );

  // 지도 최초 생성
  useEffect(() => {
    let active = true;

    loadKakao()
      .then((sdk) => {
        if (!active || !containerRef.current) return;

        const map = new sdk.maps.Map(containerRef.current, {
          center: new sdk.maps.LatLng(
            referencePoint.lat,
            referencePoint.lng
          ),
          level: 6,
        });

        mapRef.current = map;
        setKakao(sdk);
      })
      .catch((err) => {
        if (active) {
          setError(err?.message || "지도를 불러오지 못했습니다.");
        }
      });

    return () => {
      active = false;

      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current.clear();

      referenceMarkerRef.current?.setMap(null);
      infoRef.current?.close();

      mapRef.current = null;
    };
  }, []);

  // 현재 위치 표시
  useEffect(() => {
    if (!kakao || !mapRef.current) return;

    referenceMarkerRef.current?.setMap(null);

    const position = new kakao.maps.LatLng(
      referencePoint.lat,
      referencePoint.lng
    );

    referenceMarkerRef.current = new kakao.maps.CustomOverlay({
      map: mapRef.current,
      position,
      yAnchor: 0.5,
      zIndex: 100,
      content: `
        <div style="
          width:18px;
          height:18px;
          border:4px solid white;
          border-radius:50%;
          background:#1677ff;
          box-shadow:0 0 0 9px rgba(22,119,255,.15),
                     0 2px 8px rgba(0,0,0,.2);
        "></div>
      `,
    });

    mapRef.current.panTo(position);
  }, [kakao, referencePoint.lat, referencePoint.lng]);

  // 실습기관 마커 생성 및 갱신
  useEffect(() => {
    if (!kakao || !mapRef.current) return;

    const map = mapRef.current;
    const activeIds = new Set<string>();

    for (const item of located) {
      const id = String(item.id);
      activeIds.add(id);

      const position = new kakao.maps.LatLng(
        Number(item.lat),
        Number(item.lng)
      );

      let marker = markersRef.current.get(id);

      if (!marker) {
        marker = new kakao.maps.Marker({
          map,
          position,
          title: item.name,
        });

        kakao.maps.event.addListener(marker, "click", () => {
  const current = itemsRef.current.get(id);
  if (!current) return;

  const position = marker.getPosition();

  map.panTo(position);
  map.setLevel(5);

  infoRef.current?.close();

  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "min-width:190px;max-width:240px;padding:12px;" +
    "font-size:12px;line-height:1.6;";

  const title = document.createElement("strong");
  title.textContent = current.name;

  const address = document.createElement("div");
  address.textContent = current.address;

  const price = document.createElement("div");
  price.textContent = `실습비 ${formatPrice(current.price)}`;

  wrapper.append(title, address, price);

  const info = new kakao.maps.InfoWindow({
    content: wrapper,
    removable: true,
  });

  info.open(map, marker);
  infoRef.current = info;

  onSelectRef.current?.(current);
});

        markersRef.current.set(id, marker);
      } else {
        marker.setPosition(position);
      }
    }

    for (const [id, marker] of markersRef.current) {
      if (!activeIds.has(id)) {
        marker.setMap(null);
        markersRef.current.delete(id);
      }
    }

    const bounds = new kakao.maps.LatLngBounds();

    bounds.extend(
      new kakao.maps.LatLng(
        referencePoint.lat,
        referencePoint.lng
      )
    );

    for (const item of located) {
      bounds.extend(
        new kakao.maps.LatLng(
          Number(item.lat),
          Number(item.lng)
        )
      );
    }

    map.setBounds(bounds);

    // 전국에 퍼진 기관 때문에 지도가 너무 축소되지 않도록 제한
    if (map.getLevel() > 8) {
      map.setLevel(8);
    }
  }, [kakao, located, referencePoint.lat, referencePoint.lng]);

  // 목록에서 기관을 선택하면 지도 이동 및 상세정보 표시
  useEffect(() => {
    if (!kakao || !mapRef.current || !selectedId) return;

    const item = located.find(
      (row) => String(row.id) === String(selectedId)
    );

    if (!item) return;

    const position = new kakao.maps.LatLng(
      Number(item.lat),
      Number(item.lng)
    );

    const map = mapRef.current;
    map.panTo(position);
    map.setLevel(5);

    infoRef.current?.close();

    const wrapper = document.createElement("div");
    wrapper.style.cssText =
      "min-width:190px;max-width:240px;padding:12px;" +
      "font-family:inherit;font-size:12px;line-height:1.6;";

    const title = document.createElement("strong");
    title.textContent = item.name;

    const address = document.createElement("div");
    address.textContent = item.address;

    const price = document.createElement("div");
    price.textContent = `실습비 ${formatPrice(item.price)}`;

    wrapper.append(title, address, price);

    const info = new kakao.maps.InfoWindow({
      content: wrapper,
      removable: true,
    });

    const marker = markersRef.current.get(String(item.id));

    if (marker) {
      info.open(map, marker);
      infoRef.current = info;
    }
  }, [kakao, located, selectedId]);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 p-4 text-center text-xs text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      aria-label="사회복지현장실습 기관 지도"
    />
  );
}
