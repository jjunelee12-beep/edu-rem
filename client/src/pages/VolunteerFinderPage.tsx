import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { trpc } from "@/lib/trpc";

import VolunteerKakaoMap, {
  type VolunteerMapItem,
} from "@/components/VolunteerKakaoMap";

import {
  loadKakao,
} from "@/components/PracticeKakaoMap";

import {
  ArrowLeft,
  HeartHandshake,
  MapPin,
  LocateFixed,
  Search,
  CalendarDays,
  Clock3,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Map,
  List,
  X,
} from "lucide-react";

const CENTER_LOGO =
  "/images/employment-center/social-welfare-logo.png";

type Point = {
  lat: number;
  lng: number;
};

type VolunteerItem = {
  progrmRegistNo: string;
  progrmSj?: string;
  nanmmbyNm?: string;
  progrmBgnde?: string;
  progrmEndde?: string;
  progrmSttusSe?: string;
  sidoCd?: string;
  gugunCd?: string;
  adultPosblAt?: string;
  yngbgsPosblAt?: string;
  srvcClCode?: string;
  actPlace?: string;
  actBeginTm?: string;
  actEndTm?: string;
  noticeBgnde?: string;
  noticeEndde?: string;
  url?: string;
};

type SearchFilters = {
  keyword?: string;
  progrmBgnde?: string;
  progrmEndde?: string;
  adultPosblAt?: "Y";
  yngbgsPosblAt?: "Y";
};

const inputClass =
  "w-full min-w-0 rounded-xl border border-slate-200 " +
  "bg-white px-3 py-3 text-sm outline-none " +
  "focus:border-blue-500";

const geocodeCache = new Map<string, Point>();

function formatDate(value?: string) {
  const raw = String(value ?? "").trim();

  if (/^\d{8}$/.test(raw)) {
    return `${raw.slice(0, 4)}.${raw.slice(4, 6)}.${raw.slice(6, 8)}`;
  }

  return raw || "별도 확인";
}

function formatTime(value?: string | number) {
  const raw = String(value ?? "").trim();

  if (/^\d{1,2}$/.test(raw)) {
    const hour = Number(raw);

    if (hour <= 24) {
      return `${raw.padStart(2, "0")}:00`;
    }
  }

  if (/^\d{3,4}$/.test(raw)) {
    const time = raw.padStart(4, "0");
    return `${time.slice(0, 2)}:${time.slice(2)}`;
  }

  return raw || "별도 확인";
}

function getHomeUrl() {
  const hostname = window.location.hostname;

  return hostname === "welfareon.kr" ||
    hostname === "www.welfareon.kr"
    ? "/"
    : "/employment-center";
}

function getOfficialUrl(value?: string) {
  try {
    const url = new URL(String(value || ""));

    const allowed =
      url.hostname === "1365.go.kr" ||
      url.hostname.endsWith(".1365.go.kr");

    if (
      allowed &&
      ["https:", "http:"].includes(url.protocol)
    ) {
      url.protocol = "https:";
      return url.toString();
    }
  } catch {
    // 유효하지 않은 링크
  }

  return "https://www.1365.go.kr/";
}

function distanceKm(a: Point, b: Point) {
  const rad = Math.PI / 180;

  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) *
      Math.cos(b.lat * rad) *
      Math.sin(dLng / 2) ** 2;

  return (
    6371 *
    2 *
    Math.asin(Math.sqrt(Math.min(1, h)))
  );
}

async function geocodeAddress(
  address: string
): Promise<Point | null> {
  const text = address.trim();

  if (!text) return null;

  const cached = geocodeCache.get(text);

  if (cached) return cached;

  const kakao = await loadKakao();

  if (!kakao.maps.services?.Geocoder) {
    return null;
  }

  return new Promise((resolve) => {
    const geocoder =
      new kakao.maps.services.Geocoder();

    geocoder.addressSearch(
      text,
      (result: any[], status: string) => {
        if (
          status !==
            kakao.maps.services.Status.OK ||
          !result?.[0]
        ) {
          resolve(null);
          return;
        }

        const point = {
          lat: Number(result[0].y),
          lng: Number(result[0].x),
        };

        if (
          !Number.isFinite(point.lat) ||
          !Number.isFinite(point.lng)
        ) {
          resolve(null);
          return;
        }

        if (geocodeCache.size >= 500) {
          geocodeCache.clear();
        }

        geocodeCache.set(text, point);
        resolve(point);
      }
    );
  });
}

function VolunteerDetail({
  item,
  onClose,
}: {
  item: VolunteerItem;
  onClose: () => void;
}) {
  const detail = trpc.volunteer.detail.useQuery(
    {
      progrmRegistNo: item.progrmRegistNo,
    },
    {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    }
  );

  const data = {
    ...item,
    ...(detail.data || {}),
  };

  const fields = [
    ["모집기관", data.nanmmbyNm],
    ["활동장소", data.actPlace],
    [
      "활동기간",
      `${formatDate(data.progrmBgnde)} ~ ${formatDate(data.progrmEndde)}`,
    ],
    [
      "활동시간",
      `${formatTime(data.actBeginTm)} ~ ${formatTime(data.actEndTm)}`,
    ],
    [
      "모집기간",
      `${formatDate(data.noticeBgnde)} ~ ${formatDate(data.noticeEndde)}`,
    ],
    ["활동요일", data.actWkdy],
    ["모집인원", data.rcritNmpr],
    ["신청인원", data.appTotal],
    ["문의전화", data.telno],
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="max-h-[88dvh] w-full max-w-[480px] overflow-y-auto rounded-t-3xl bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-black">
            봉사활동 상세정보
          </h2>

          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg p-2"
          >
            <X size={20} />
          </button>
        </div>

        <h3 className="text-lg font-black leading-7 text-slate-900">
          {data.progrmSj}
        </h3>

        <p className="mt-1 text-xs text-slate-500">
          프로그램 번호: {item.progrmRegistNo}
        </p>

        {detail.isLoading && (
          <p className="mt-4 rounded-xl bg-blue-50 p-3 text-xs text-blue-700">
            상세정보를 불러오고 있습니다...
          </p>
        )}

        {detail.isError && (
          <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            상세조회에 실패하여 목록 정보를 표시합니다.
          </p>
        )}

        <div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4">
          {fields.map(([label, value]) => (
            <div
              key={String(label)}
              className="flex gap-3 text-xs leading-5"
            >
              <span className="w-16 shrink-0 font-bold text-slate-500">
                {label}
              </span>

              <span className="min-w-0 flex-1 break-words text-slate-800">
                {String(value ?? "").trim() ||
                  "별도 확인"}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 p-4">
          <p className="text-sm font-black">
            참여 가능 대상
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {[
              ["성인", data.adultPosblAt],
              ["청소년", data.yngbgsPosblAt],
              ["단체", data.grpPosblAt],
              ["가족", data.familyPosblAt],
            ].map(([label, value]) => (
              <span
                key={String(label)}
                className={`rounded-lg px-3 py-2 text-xs font-bold ${
                  value === "Y"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {label}{" "}
                {value === "Y"
                  ? "가능"
                  : value === "N"
                    ? "불가"
                    : "확인 필요"}
              </span>
            ))}
          </div>
        </div>

        {data.progrmCn && (
          <div className="mt-5">
            <h4 className="text-sm font-black">
              봉사활동 내용
            </h4>

            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
              {String(data.progrmCn)}
            </p>
          </div>
        )}

        <a
          href={getOfficialUrl(item.url)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-4 text-sm font-bold text-white"
        >
          1365 공식 사이트에서 확인
          <ExternalLink size={16} />
        </a>

        <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">
          실제 봉사활동 신청 및 모집 여부는
          1365 자원봉사포털에서 확인해 주세요.
        </p>
      </div>
    </div>
  );
}

export default function VolunteerFinderPage() {
  const [keyword, setKeyword] = useState("");
  const [address, setAddress] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [target, setTarget] = useState<
    "all" | "adult" | "youth"
  >("all");

  const [filters, setFilters] =
    useState<SearchFilters>({});

  const [pageNo, setPageNo] = useState(1);

  const [origin, setOrigin] =
    useState<Point | null>(null);

  const [locationError, setLocationError] =
    useState("");

  const [searchError, setSearchError] =
    useState("");

  const [locating, setLocating] =
    useState(false);

  const [view, setView] =
    useState<"map" | "list">("map");

  const [sort, setSort] =
    useState<"default" | "distance">("default");

  const [selectedId, setSelectedId] =
    useState<string | null>(null);

  const [detailItem, setDetailItem] =
    useState<VolunteerItem | null>(null);

  const [mapItems, setMapItems] =
    useState<VolunteerMapItem[]>([]);

  const [mapping, setMapping] =
    useState(false);

  const listRef = useRef<HTMLDivElement>(null);

  const query = trpc.volunteer.list.useQuery(
    {
      ...filters,
      pageNo,
      numOfRows: 20,
    },
    {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000,
    }
  );

  const items = useMemo<VolunteerItem[]>(
    () => query.data?.items || [],
    [query.data]
  );

  const totalCount =
    query.data?.totalCount || 0;

  const totalPages = Math.min(
    1000,
    Math.max(1, Math.ceil(totalCount / 20))
  );

  useEffect(() => {
    let active = true;

    setMapItems([]);
    setSelectedId(null);
    setMapping(items.length > 0);

    async function locateItems() {
      const located: VolunteerMapItem[] = [];

      try {
        for (const item of items) {
          if (!active) return;

          const place =
            String(item.actPlace || "").trim();

          if (!place) continue;

          let point: Point | null = null;

          try {
            point = await geocodeAddress(place);
          } catch {
            continue;
          }

          if (!active) return;

          if (!point) continue;

          located.push({
            id: String(item.progrmRegistNo),
            title: item.progrmSj || "봉사활동",
            institution: item.nanmmbyNm || "",
            address: place,
            ...point,
          });
        }

        if (active) {
          setMapItems(located);
        }
      } finally {
        if (active) {
          setMapping(false);
        }
      }
    }

    void locateItems();

    return () => {
      active = false;
    };
  }, [items]);

  const distanceMap = useMemo(() => {
    const result = new Map<string, number>();

    if (!origin) return result;

    for (const item of mapItems) {
      result.set(
        item.id,
        distanceKm(origin, item)
      );
    }

    return result;
  }, [mapItems, origin]);

  const sortedItems = useMemo(() => {
    if (sort !== "distance" || !origin) {
      return items;
    }

    return [...items].sort(
      (a, b) =>
        (distanceMap.get(
          String(a.progrmRegistNo)
        ) ?? Infinity) -
        (distanceMap.get(
          String(b.progrmRegistNo)
        ) ?? Infinity)
    );
  }, [items, sort, origin, distanceMap]);

  const searchAddress = async () => {
    if (!address.trim()) {
      setLocationError("주소를 입력해 주세요.");
      return;
    }

    setLocating(true);
    setLocationError("");

    try {
      const point =
        await geocodeAddress(address);

      if (!point) {
        setLocationError(
          "주소를 찾지 못했습니다. 도로명 주소로 검색해 주세요."
        );
        return;
      }

      setOrigin(point);
      setSort("distance");
    } catch {
      setLocationError(
        "주소 검색 중 오류가 발생했습니다."
      );
    } finally {
      setLocating(false);
    }
  };

  const getCurrentLocation = () => {
    setLocationError("");

    if (!navigator.geolocation) {
      setLocationError(
        "현재 위치를 사용할 수 없는 환경입니다."
      );
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setOrigin({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });

        setAddress("현재 위치");
        setSort("distance");
        setLocating(false);
      },
      () => {
        setLocationError(
          "위치 확인에 실패했습니다. 위치 권한을 확인해 주세요."
        );

        setLocating(false);
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  };

  const handleSearch = () => {
    setSearchError("");

    if (
      startDate &&
      endDate &&
      startDate > endDate
    ) {
      setSearchError(
        "종료일은 시작일 이후로 선택해 주세요."
      );
      return;
    }

    setPageNo(1);
    setSelectedId(null);

    setFilters({
      keyword: keyword.trim() || undefined,

      progrmBgnde:
        startDate.replace(/-/g, "") ||
        undefined,

      progrmEndde:
        endDate.replace(/-/g, "") ||
        undefined,

      adultPosblAt:
        target === "adult" ? "Y" : undefined,

      yngbgsPosblAt:
        target === "youth" ? "Y" : undefined,
    });
  };

  const resetSearch = () => {
    setKeyword("");
    setStartDate("");
    setEndDate("");
    setTarget("all");
    setFilters({});
    setPageNo(1);
    setSearchError("");
    setSelectedId(null);
  };

  const changePage = (next: number) => {
    setPageNo(next);
    setSelectedId(null);

    listRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  return (
    <div className="min-h-dvh bg-slate-100">
      <main className="mx-auto min-h-dvh max-w-[480px] bg-[#f5f7fa] pb-10">

        {/* 상단 헤더 */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">

          <a
            href={getHomeUrl()}
            className="flex min-w-0 items-center gap-2"
          >
            <img
              src={CENTER_LOGO}
              alt="사회복지 통합지원센터"
              className="h-10 w-10 shrink-0 object-contain"
            />

            <div className="min-w-0">
              <p className="truncate text-[11px] font-bold text-blue-600">
                사회복지 통합지원센터
              </p>

              <p className="text-sm font-black text-slate-900">
                봉사활동 찾기
              </p>
            </div>
          </a>

          <a
            href={getHomeUrl()}
            className="flex shrink-0 items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold text-slate-600"
          >
            <ArrowLeft size={14} />
            센터 홈
          </a>
        </header>

        <div className="space-y-4 px-4 pt-4">

          {/* 상단 소개 */}
          <section className="rounded-2xl bg-gradient-to-br from-blue-700 to-blue-500 p-5 text-white">
            <HeartHandshake
              size={30}
              className="mb-3"
            />

            <h1 className="text-2xl font-black">
              봉사활동 찾기
            </h1>

            <p className="mt-2 text-xs leading-6 text-blue-100">
              나에게 맞는 봉사활동을 찾고
              사회복지를 직접 경험해 보세요.
            </p>

            <p className="mt-3 text-[11px] text-blue-100">
              1365 자원봉사포털 공공데이터 제공
            </p>
          </section>

          {/* 위치 설정 */}
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-black">
                <MapPin
                  size={18}
                  className="text-blue-600"
                />
                검색 기준 위치
              </h2>

              <button
                type="button"
                onClick={getCurrentLocation}
                disabled={locating}
                className="flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-2 text-[11px] font-bold text-blue-700"
              >
                <LocateFixed size={14} />
                현재 위치
              </button>
            </div>

            <div className="flex gap-2">
              <input
                className={inputClass}
                placeholder="도로명 주소를 입력하세요"
                value={address}
                onChange={(e) =>
                  setAddress(e.target.value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void searchAddress();
                  }
                }}
              />

              <button
                type="button"
                disabled={locating}
                onClick={searchAddress}
                className="shrink-0 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white"
              >
                확인
              </button>
            </div>

            {locating && (
              <p className="text-xs text-blue-600">
                위치를 확인하고 있습니다...
              </p>
            )}

            {locationError && (
              <p className="text-xs text-red-600">
                {locationError}
              </p>
            )}

            {origin && (
              <p className="text-xs font-bold text-blue-600">
                기준 위치 설정 완료
              </p>
            )}

            <p className="text-[11px] leading-5 text-slate-500">
              기준 위치는 지도 표시와 현재 검색 결과의
              거리순 정렬에 사용됩니다.
            </p>
          </section>

          {/* 검색 필터 */}
          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="flex items-center gap-2 text-sm font-black">
              <Search
                size={18}
                className="text-blue-600"
              />
              봉사활동 검색
            </h2>

            <input
              className={inputClass}
              value={keyword}
              onChange={(e) =>
                setKeyword(e.target.value)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleSearch();
                }
              }}
              placeholder="봉사활동 검색어 입력"
              maxLength={100}
            />

            <div>
              <p className="mb-2 text-xs font-bold text-slate-700">
                참여 대상
              </p>

              <div className="grid grid-cols-3 gap-2">
                {[
                  ["all", "전체"],
                  ["adult", "성인"],
                  ["youth", "청소년"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() =>
                      setTarget(
                        value as typeof target
                      )
                    }
                    className={`rounded-xl border py-3 text-xs font-bold ${
                      target === value
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-slate-200 text-slate-600"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <label className="min-w-0">
                <span className="mb-1 block text-xs font-bold text-slate-600">
                  활동 시작일
                </span>

                <input
                  type="date"
                  className={inputClass}
                  value={startDate}
                  onChange={(e) =>
                    setStartDate(e.target.value)
                  }
                />
              </label>

              <label className="min-w-0">
                <span className="mb-1 block text-xs font-bold text-slate-600">
                  활동 종료일
                </span>

                <input
                  type="date"
                  className={inputClass}
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) =>
                    setEndDate(e.target.value)
                  }
                />
              </label>
            </div>

            {searchError && (
              <p className="text-xs text-red-600">
                {searchError}
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetSearch}
                className="rounded-xl border px-4 text-xs font-bold text-slate-600"
              >
                초기화
              </button>

              <button
                type="button"
                onClick={handleSearch}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white"
              >
                <Search size={16} />
                봉사활동 검색하기
              </button>
            </div>
          </section>

          {/* 지도 / 목록 전환 */}
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-200/70 p-1">
            <button
              type="button"
              onClick={() => setView("map")}
              className={`flex items-center justify-center gap-2 rounded-lg py-3 text-xs font-bold ${
                view === "map"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              <Map size={16} />
              지도 보기
            </button>

            <button
              type="button"
              onClick={() => setView("list")}
              className={`flex items-center justify-center gap-2 rounded-lg py-3 text-xs font-bold ${
                view === "list"
                  ? "bg-white text-blue-700 shadow-sm"
                  : "text-slate-500"
              }`}
            >
              <List size={16} />
              목록 보기
            </button>
          </div>

          {/* 지도 */}
          {view === "map" && (
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <VolunteerKakaoMap
                items={mapItems}
                referencePoint={origin}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);

                  const item = items.find(
                    (row) =>
                      String(
                        row.progrmRegistNo
                      ) === id
                  );

                  if (item) {
                    setDetailItem(item);
                  }
                }}
              />

              <p className="border-t px-3 py-3 text-[11px] leading-5 text-slate-500">
                {mapping
                  ? "봉사활동 위치를 확인하고 있습니다..."
                  : `현재 페이지 지도 표시 ${mapItems.length}건 / ${items.length}건`}
                <br />
                정확한 주소를 확인할 수 없는 공고는
                목록에서 확인하실 수 있습니다.
              </p>
            </section>
          )}

          {/* 검색 결과 */}
          <section
            ref={listRef}
            className="scroll-mt-24 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900">
                검색 결과{" "}
                <span className="text-blue-600">
                  {totalCount.toLocaleString()}건
                </span>
              </h2>

              <select
                value={sort}
                onChange={(e) =>
                  setSort(
                    e.target.value as typeof sort
                  )
                }
                className="rounded-lg border bg-white px-2 py-2 text-xs font-bold"
              >
                <option value="default">
                  기본순
                </option>

                <option
                  value="distance"
                  disabled={!origin}
                >
                  현재 페이지 거리순
                </option>
              </select>
            </div>

            {query.isLoading && (
              <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">
                봉사활동 정보를 불러오고 있습니다...
              </div>
            )}

            {query.isError && (
              <div className="rounded-2xl border border-red-100 bg-white p-5 text-center">
                <p className="text-sm font-bold text-red-600">
                  봉사활동 조회에 실패했습니다.
                </p>

                <button
                  type="button"
                  onClick={() => query.refetch()}
                  className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white"
                >
                  다시 시도
                </button>
              </div>
            )}

            {!query.isLoading &&
              !query.isError &&
              items.length === 0 && (
                <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500">
                  검색된 봉사활동이 없습니다.
                </div>
              )}

            {sortedItems.map((item) => {
              const id = String(
                item.progrmRegistNo
              );

              const distance =
                distanceMap.get(id);

              const hasLocation =
                mapItems.some(
                  (row) => row.id === id
                );

              return (
                <article
                  key={id}
                  className={`space-y-3 rounded-2xl border bg-white p-4 shadow-sm ${
                    selectedId === id
                      ? "border-blue-500"
                      : "border-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">
                      봉사활동
                    </span>

                    {item.adultPosblAt === "Y" && (
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] text-slate-600">
                        성인
                      </span>
                    )}

                    {item.yngbgsPosblAt === "Y" && (
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] text-slate-600">
                        청소년
                      </span>
                    )}

                    {distance !== undefined && (
                      <span className="ml-auto text-xs font-bold text-blue-600">
                        {distance.toFixed(1)}km
                      </span>
                    )}
                  </div>

                  <h3 className="break-words text-sm font-black leading-6 text-slate-900">
                    {item.progrmSj ||
                      "봉사활동"}
                  </h3>

                  <p className="text-xs font-bold text-slate-500">
                    {item.nanmmbyNm ||
                      "모집기관 별도 확인"}
                  </p>

                  <div className="space-y-2 text-xs leading-5 text-slate-600">
                    <p className="flex gap-2">
                      <MapPin
                        size={15}
                        className="mt-0.5 shrink-0"
                      />
                      {item.actPlace ||
                        "활동장소 별도 확인"}
                    </p>

                    <p className="flex gap-2">
                      <CalendarDays
                        size={15}
                        className="mt-0.5 shrink-0"
                      />
                      {formatDate(
                        item.progrmBgnde
                      )}{" "}
                      ~{" "}
                      {formatDate(
                        item.progrmEndde
                      )}
                    </p>

                    <p className="flex gap-2">
                      <Clock3
                        size={15}
                        className="mt-0.5 shrink-0"
                      />
                      {formatTime(
                        item.actBeginTm
                      )}{" "}
                      ~{" "}
                      {formatTime(
                        item.actEndTm
                      )}
                    </p>
                  </div>

                  {hasLocation && (
                    <button
                      type="button"
                      onClick={() => {
                        setView("map");
                        setSelectedId(id);
                      }}
                      className="text-xs font-bold text-blue-600"
                    >
                      지도에서 위치 확인
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(id);
                        setDetailItem(item);
                      }}
                      className="rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-700"
                    >
                      상세정보
                    </button>

                    <a
                      href={getOfficialUrl(
                        item.url
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1 rounded-xl bg-blue-600 py-3 text-xs font-bold text-white"
                    >
                      1365 확인
                      <ExternalLink size={13} />
                    </a>
                  </div>
                </article>
              );
            })}

            {totalPages > 1 &&
              !query.isError && (
                <div className="flex items-center justify-center gap-4 py-4">
                  <button
                    type="button"
                    disabled={pageNo <= 1}
                    onClick={() =>
                      changePage(pageNo - 1)
                    }
                    className="rounded-lg border bg-white p-2 disabled:opacity-30"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <span className="text-xs font-bold">
                    {pageNo} / {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={
                      pageNo >= totalPages
                    }
                    onClick={() =>
                      changePage(pageNo + 1)
                    }
                    className="rounded-lg border bg-white p-2 disabled:opacity-30"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              )}
          </section>

          <footer className="rounded-xl bg-slate-100 p-4 text-[11px] leading-6 text-slate-500">
            제공기관: 행정안전부
            <br />
            데이터 출처: 1365 자원봉사포털
            <br />
            봉사활동 정보 및 실제 모집 여부는
            공식 사이트에서 확인해 주세요.
          </footer>
        </div>
      </main>

      {detailItem && (
        <VolunteerDetail
          key={detailItem.progrmRegistNo}
          item={detailItem}
          onClose={() => setDetailItem(null)}
        />
      )}
    </div>
  );
}