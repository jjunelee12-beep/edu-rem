import { useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    kakao: any;
  }
}

type FinderItem = {
  id: string | number;
  type?: "education" | "institution";
  name: string;
  representativeName?: string;
  phone?: string;
  address?: string;
  price?: string;
  distanceKm?: string | number;
  lat?: number;
  lng?: number;
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

const KAKAO_JS_KEY =
  import.meta.env.VITE_KAKAO_MAP_JS_KEY || "541dd56098645e0bc150bc07fb6dc542";

export default function KakaoMap({
  address = "",
  searchTrigger = 0,
  includeEducationCenter = true,
  includePracticeInstitution = true,
  results = [],
  selectedResult = null,
  onSelectResult,
}: KakaoMapProps) {
  const mapRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const geocoderRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [searchedCenter, setSearchedCenter] = useState<{ lat: number; lng: number } | null>(
    null
  );

  const filteredResults = useMemo(() => {
    return (results || []).filter((item) => {
      if (item.type === "education" && !includeEducationCenter) return false;
      if (item.type === "institution" && !includePracticeInstitution) return false;
      return true;
    });
  }, [results, includeEducationCenter, includePracticeInstitution]);

  const clearMarkers = () => {
    if (!markersRef.current?.length) return;
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];
  };

  const loadScript = () => {
    return new Promise<void>((resolve, reject) => {
      if (window.kakao?.maps) {
        resolve();
        return;
      }

      const existingScript = document.querySelector(
        'script[data-kakao-map="true"]'
      ) as HTMLScriptElement | null;

      if (existingScript) {
        existingScript.addEventListener("load", () => resolve());
        existingScript.addEventListener("error", () =>
          reject(new Error("카카오맵 스크립트 로드 실패"))
        );
        return;
      }

      const script = document.createElement("script");
      script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&autoload=false&libraries=services`;
      script.async = true;
      script.setAttribute("data-kakao-map", "true");

      script.onload = () => resolve();
      script.onerror = () => reject(new Error("카카오맵 스크립트 로드 실패"));

      document.head.appendChild(script);
    });
  };

  const initMap = () => {
    if (!window.kakao?.maps || !mapContainerRef.current) return;

    window.kakao.maps.load(() => {
      if (!mapContainerRef.current) return;

      const center = new window.kakao.maps.LatLng(37.5665, 126.978); // 서울시청
      const options = {
        center,
        level: 4,
      };

      const map = new window.kakao.maps.Map(mapContainerRef.current, options);
      const geocoder = new window.kakao.maps.services.Geocoder();
      const infoWindow = new window.kakao.maps.InfoWindow({ zIndex: 10 });

      mapRef.current = map;
      geocoderRef.current = geocoder;
      infoWindowRef.current = infoWindow;

      setIsReady(true);
    });
  };

  const moveToAddress = (addr: string) => {
    if (!addr?.trim()) return;
    if (!window.kakao?.maps || !geocoderRef.current || !mapRef.current) return;

    geocoderRef.current.addressSearch(addr, (result: any, status: any) => {
      if (status === window.kakao.maps.services.Status.OK && result?.[0]) {
        const lat = Number(result[0].y);
        const lng = Number(result[0].x);
        const coords = new window.kakao.maps.LatLng(lat, lng);

        mapRef.current.setCenter(coords);

        const marker = new window.kakao.maps.Marker({
          map: mapRef.current,
          position: coords,
        });

        // 검색 중심점 마커는 기존 결과 마커와 섞이지 않게 잠깐만 유지
        setTimeout(() => {
          marker.setMap(null);
        }, 1500);

        setSearchedCenter({ lat, lng });
      }
    });
  };

  const geocodeAddress = (addr: string) => {
    return new Promise<{ lat: number; lng: number } | null>((resolve) => {
      if (!addr?.trim()) {
        resolve(null);
        return;
      }

      if (!window.kakao?.maps || !geocoderRef.current) {
        resolve(null);
        return;
      }

      geocoderRef.current.addressSearch(addr, (result: any, status: any) => {
        if (status === window.kakao.maps.services.Status.OK && result?.[0]) {
          resolve({
            lat: Number(result[0].y),
            lng: Number(result[0].x),
          });
        } else {
          resolve(null);
        }
      });
    });
  };

  const renderResultMarkers = async () => {
    if (!window.kakao?.maps || !mapRef.current) return;

    clearMarkers();

    const bounds = new window.kakao.maps.LatLngBounds();
    let hasMarker = false;

    for (const item of filteredResults) {
      let lat = item.lat;
      let lng = item.lng;

      if ((!lat || !lng) && item.address) {
        const geo = await geocodeAddress(item.address);
        if (geo) {
          lat = geo.lat;
          lng = geo.lng;
        }
      }

      if (!lat || !lng) continue;

      const position = new window.kakao.maps.LatLng(lat, lng);

      const marker = new window.kakao.maps.Marker({
        position,
        map: mapRef.current,
      });

      window.kakao.maps.event.addListener(marker, "click", () => {
        if (infoWindowRef.current) {
          infoWindowRef.current.setContent(`
            <div style="padding:8px 10px; font-size:12px; min-width:180px;">
              <div style="font-weight:600; margin-bottom:4px;">${item.name || "-"}</div>
              <div style="color:#555;">${item.address || ""}</div>
              ${
                item.distanceKm
                  ? `<div style="margin-top:4px; color:#2563eb;">거리: ${item.distanceKm}km</div>`
                  : ""
              }
            </div>
          `);
          infoWindowRef.current.open(mapRef.current, marker);
        }

        if (onSelectResult) onSelectResult(item);
      });

      markersRef.current.push(marker);
      bounds.extend(position);
      hasMarker = true;
    }

    if (hasMarker) {
      mapRef.current.setBounds(bounds);
    } else if (searchedCenter) {
      const center = new window.kakao.maps.LatLng(searchedCenter.lat, searchedCenter.lng);
      mapRef.current.setCenter(center);
    }
  };

  const moveToSelectedResult = async () => {
    if (!selectedResult || !mapRef.current || !window.kakao?.maps) return;

    let lat = selectedResult.lat;
    let lng = selectedResult.lng;

    if ((!lat || !lng) && selectedResult.address) {
      const geo = await geocodeAddress(selectedResult.address);
      if (geo) {
        lat = geo.lat;
        lng = geo.lng;
      }
    }

    if (!lat || !lng) return;

    const coords = new window.kakao.maps.LatLng(lat, lng);
    mapRef.current.setCenter(coords);
    mapRef.current.setLevel(3);
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        await loadScript();
        if (!mounted) return;
        initMap();
      } catch (e) {
        console.error(e);
      }
    })();

    return () => {
      mounted = false;
      clearMarkers();
    };
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (!address?.trim()) return;
    moveToAddress(address);
  }, [isReady, searchTrigger]);

  useEffect(() => {
    if (!isReady) return;
    renderResultMarkers();
  }, [isReady, filteredResults, searchedCenter]);

  useEffect(() => {
    if (!isReady) return;
    moveToSelectedResult();
  }, [isReady, selectedResult]);

  return (
    <div className="relative w-full h-full">
      <div
        ref={mapContainerRef}
        style={{
          width: "100%",
          height: "100%",
          minHeight: "400px",
        }}
      />

      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm text-muted-foreground">
          지도를 불러오는 중...
        </div>
      )}
    </div>
  );
}