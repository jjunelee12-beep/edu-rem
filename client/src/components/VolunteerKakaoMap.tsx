import { useEffect, useRef, useState } from "react";
import { loadKakao } from "./PracticeKakaoMap";

export type VolunteerMapItem = {
  id: string;
  title: string;
  institution: string;
  address: string;
  lat: number;
  lng: number;
};

type Props = {
  items: VolunteerMapItem[];
  referencePoint: {
    lat: number;
    lng: number;
  } | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
};

export default function VolunteerKakaoMap({
  items,
  referencePoint,
  selectedId,
  onSelect,
  className = "h-[340px] w-full",
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const originMarkerRef = useRef<any>(null);
  const infoRef = useRef<any>(null);
  const onSelectRef = useRef(onSelect);

  const [sdk, setSdk] = useState<any>(null);
  const [error, setError] = useState("");

  onSelectRef.current = onSelect;

  useEffect(() => {
    let active = true;

    loadKakao()
      .then((kakao) => {
        if (!active || !containerRef.current) return;

        mapRef.current = new kakao.maps.Map(
          containerRef.current,
          {
            center: new kakao.maps.LatLng(
              37.5665,
              126.978
            ),
            level: 7,
          }
        );

        setSdk(kakao);
      })
      .catch(() => {
        if (active) {
          setError("지도를 불러오지 못했습니다.");
        }
      });

    return () => {
      active = false;

      markersRef.current.forEach((marker) =>
        marker.setMap(null)
      );

      markersRef.current.clear();
      originMarkerRef.current?.setMap(null);
      infoRef.current?.close();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!sdk || !mapRef.current) return;

    const map = mapRef.current;

    originMarkerRef.current?.setMap(null);

    if (!referencePoint) return;

    const position = new sdk.maps.LatLng(
      referencePoint.lat,
      referencePoint.lng
    );

    originMarkerRef.current =
      new sdk.maps.CustomOverlay({
        map,
        position,
        yAnchor: 0.5,
        zIndex: 100,
        content: `
          <div style="
            width:18px;
            height:18px;
            border:4px solid white;
            border-radius:50%;
            background:#2563eb;
            box-shadow:0 0 0 8px rgba(37,99,235,.15);
          "></div>
        `,
      });

    map.panTo(position);
  }, [
    sdk,
    referencePoint?.lat,
    referencePoint?.lng,
  ]);

  useEffect(() => {
    if (!sdk || !mapRef.current) return;

    const map = mapRef.current;

    infoRef.current?.close();

    markersRef.current.forEach((marker) =>
      marker.setMap(null)
    );

    markersRef.current.clear();

    const bounds = new sdk.maps.LatLngBounds();

    let count = 0;

    for (const item of items) {
      if (
        !Number.isFinite(item.lat) ||
        !Number.isFinite(item.lng) ||
        item.lat < 33 ||
        item.lat > 39 ||
        item.lng < 124 ||
        item.lng > 132
      ) {
        continue;
      }

      const position = new sdk.maps.LatLng(
        item.lat,
        item.lng
      );

      const marker = new sdk.maps.Marker({
        map,
        position,
        title: item.title,
      });

      sdk.maps.event.addListener(
        marker,
        "click",
        () => {
          onSelectRef.current(item.id);
        }
      );

      markersRef.current.set(item.id, marker);
      bounds.extend(position);
      count++;
    }

    if (referencePoint) {
      bounds.extend(
        new sdk.maps.LatLng(
          referencePoint.lat,
          referencePoint.lng
        )
      );
    }

    if (count > 0) {
      map.setBounds(bounds);

      if (count === 1 && !referencePoint) {
        map.setLevel(5);
      }
    }
  }, [
    sdk,
    items,
    referencePoint?.lat,
    referencePoint?.lng,
  ]);

  useEffect(() => {
    if (!sdk || !mapRef.current) return;

    infoRef.current?.close();

    if (!selectedId) return;

    const item = items.find(
      (row) => row.id === selectedId
    );

    const marker =
      markersRef.current.get(selectedId);

    if (!item || !marker) return;

    const map = mapRef.current;

    map.panTo(marker.getPosition());
    map.setLevel(5);

    const wrapper = document.createElement("div");

    wrapper.style.cssText =
      "min-width:190px;max-width:240px;" +
      "padding:12px;font-size:12px;line-height:1.6;";

    const title = document.createElement("strong");
    title.textContent = item.title;

    const institution = document.createElement("div");
    institution.textContent = item.institution;

    const address = document.createElement("div");
    address.textContent = item.address;

    wrapper.append(title, institution, address);

    const info = new sdk.maps.InfoWindow({
      content: wrapper,
      removable: true,
    });

    info.open(map, marker);

    infoRef.current = info;
  }, [sdk, selectedId, items]);

  if (error) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-slate-50 text-xs text-red-600`}
      >
        {error}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={className}
      aria-label="봉사활동 장소 지도"
    />
  );
}