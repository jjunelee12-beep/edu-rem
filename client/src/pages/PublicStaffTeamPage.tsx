import {
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  Heart,
  Loader2,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  UserRound,
  UsersRound,
} from "lucide-react";

import {
  useState,
  type ReactNode,
} from "react";

import {
  useRoute,
} from "wouter";

import {
  trpc,
} from "@/lib/trpc";

import {
  Badge,
} from "@/components/ui/badge";

import {
  Button,
} from "@/components/ui/button";

import PublicStaffConsultationModal from "@/components/public/PublicStaffConsultationModal";

function normalizeImageUrl(
  raw?: string | null
) {
  if (!raw) {
    return "";
  }

  const API_BASE_URL =
    (
      import.meta.env.VITE_API_BASE_URL ||
      ""
    ).replace(/\/$/, "");

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://") ||
    raw.startsWith("data:")
  ) {
    return raw;
  }

  if (
    raw.startsWith("//")
  ) {
    return `https:${raw}`;
  }

  if (
    !API_BASE_URL
  ) {
    return raw;
  }

  return raw.startsWith("/")
    ? `${API_BASE_URL}${raw}`
    : `${API_BASE_URL}/${raw}`;
}

function normalizeSpecialties(
  profile: any
): string[] {
  if (
    !Array.isArray(
      profile?.specialties
    )
  ) {
    return [];
  }

  return profile.specialties
    .map(
      (item: unknown) =>
        String(
          item || ""
        ).trim()
    )
    .filter(Boolean);
}

function getCareerPreview(
  profile: any
) {
  const careerText =
    String(
      profile?.careerText ||
      ""
    ).trim();

  if (
    !careerText
  ) {
    return "";
  }

  const firstLine =
    careerText
      .split(/\r?\n/)
      .map(
        (item: string) =>
          item.trim()
      )
      .find(Boolean) ||
    "";

  if (
    firstLine.length <= 34
  ) {
    return firstLine;
  }

  return `${firstLine.slice(
    0,
    34
  )}…`;
}

function ConsultationStatus({
  accepting,
}: {
  accepting: boolean;
}) {
  if (
    accepting
  ) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
        <CheckCircle2 className="h-3.5 w-3.5" />
        상담 가능
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
      상담 대기중
    </span>
  );
}

function StaffCard({
  profile,
  onConsultation,
}: {
  profile: any;
  onConsultation: (
    profile: any
  ) => void;
}) {
  const displayName =
    String(
      profile?.displayName ||
      "담당자"
    ).trim();

  const positionName =
    String(
      profile?.publicPositionName ||
      ""
    ).trim();

  const headline =
    String(
      profile?.headline ||
      "회원님의 상황에 맞는 과정을 안내해드립니다."
    ).trim();

  const imageUrl =
    normalizeImageUrl(
      profile?.profileImageUrl
    );

  const publicToken =
    String(
      profile?.publicToken ||
      ""
    ).trim();

  const specialties =
    normalizeSpecialties(
      profile
    );

  const careerPreview =
    getCareerPreview(
      profile
    );

  const acceptingNewConsultations =
    profile
      ?.acceptingNewConsultations !==
    false;

  const openProfile =
    () => {
      if (!publicToken) {
        return;
      }

      window.location.href =
        `/staff/${encodeURIComponent(
          publicToken
        )}`;
    };

  const openConsultation =
    () => {
      if (
        !publicToken ||
        !acceptingNewConsultations
      ) {
        return;
      }

      onConsultation(
        profile
      );
    };

  return (
    <>
      {/* =========================
          MOBILE CARD
      ========================= */}
      <article className="flex min-h-[168px] overflow-hidden rounded-[18px] border border-slate-200/80 bg-white p-3 shadow-[0_6px_22px_rgba(15,23,42,0.04)] md:hidden">
        <div className="relative h-[118px] w-[96px] shrink-0 overflow-hidden rounded-[14px] bg-slate-100">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${displayName} 담당자`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-300">
              <UserRound className="h-9 w-9" />
            </div>
          )}

          <div className="absolute left-1.5 top-1.5 origin-top-left scale-[0.84]">
            <ConsultationStatus
              accepting={
                acceptingNewConsultations
              }
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col pl-3">
          <div className="flex h-[24px] items-end gap-1.5 overflow-hidden">
            <h3 className="truncate text-[15px] font-black tracking-[-0.02em] text-slate-950">
              {displayName}
            </h3>

            {positionName ? (
              <span className="mb-[1px] max-w-[90px] truncate text-[9px] font-bold text-blue-600">
                {positionName}
              </span>
            ) : null}
          </div>

          <div className="mt-1 h-[38px] overflow-hidden">
            <p className="line-clamp-2 text-[10px] leading-[19px] text-slate-500">
              “{headline}”
            </p>
          </div>

          <div className="mt-1.5 flex h-[25px] gap-1 overflow-hidden">
            {specialties
              .slice(
                0,
                2
              )
              .map(
                (
                  specialty:
                    string,
                  index:
                    number
                ) => (
                  <Badge
                    key={`${specialty}-${index}`}
                    variant="outline"
                    className="h-6 max-w-[86px] rounded-full border-slate-200 bg-slate-50 px-2 text-[9px] font-bold text-slate-600"
                  >
                    <span className="truncate">
                      {specialty}
                    </span>
                  </Badge>
                )
              )}
          </div>

          <div className="mt-auto flex h-[22px] items-center gap-1.5 overflow-hidden text-[9px] font-semibold text-slate-500">
            <BriefcaseBusiness className="h-3 w-3 shrink-0 text-slate-400" />

            <span className="truncate">
              {careerPreview ||
                "상세 프로필에서 확인"}
            </span>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              variant="outline"
              disabled={
                !publicToken
              }
              onClick={
                openProfile
              }
              className="h-8 rounded-[9px] border-blue-200 px-1 text-[9px] font-bold text-blue-600 hover:bg-blue-50"
            >
              프로필 보기
            </Button>

            <Button
              type="button"
              disabled={
                !publicToken ||
                !acceptingNewConsultations
              }
              onClick={
                openConsultation
              }
              className="h-8 rounded-[9px] bg-blue-600 px-1 text-[9px] font-bold text-white hover:bg-blue-700"
            >
              상담 신청
            </Button>
          </div>
        </div>
      </article>

      {/* =========================
          DESKTOP CARD
      ========================= */}
      <article className="group hidden h-[458px] flex-col overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.04)] transition duration-300 hover:-translate-y-1 hover:border-blue-100 hover:shadow-[0_14px_36px_rgba(15,23,42,0.08)] md:flex">
        <div className="relative h-[190px] shrink-0 overflow-hidden bg-slate-100">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={`${displayName} 담당자`}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.02]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-slate-300">
              <UserRound className="h-12 w-12" />
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/20 to-transparent" />

          <div className="absolute left-3 top-3">
            <ConsultationStatus
              accepting={
                acceptingNewConsultations
              }
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col p-4">
          <div className="flex h-[28px] items-end gap-2 overflow-hidden">
            <h3 className="truncate text-[18px] font-black tracking-[-0.03em] text-slate-950">
              {displayName}
            </h3>

            {positionName ? (
              <span className="mb-[2px] max-w-[100px] truncate text-[10px] font-bold text-blue-600">
                {positionName}
              </span>
            ) : null}
          </div>

          <div className="mt-2 h-[42px] overflow-hidden">
            <p className="line-clamp-2 text-[11px] leading-[21px] text-slate-500">
              “{headline}”
            </p>
          </div>

          <div className="mt-3 flex h-[54px] flex-wrap content-start gap-1.5 overflow-hidden">
            {specialties
              .slice(
                0,
                4
              )
              .map(
                (
                  specialty:
                    string,
                  index:
                    number
                ) => (
                  <Badge
                    key={`${specialty}-${index}`}
                    variant="outline"
                    className="h-6 max-w-[118px] rounded-full border-slate-200 bg-slate-50 px-2.5 text-[9px] font-bold text-slate-600"
                  >
                    <span className="truncate">
                      {specialty}
                    </span>
                  </Badge>
                )
              )}

            {specialties.length >
            4 ? (
              <Badge
                variant="outline"
                className="h-6 rounded-full border-slate-200 bg-slate-50 px-2.5 text-[9px] font-bold text-slate-500"
              >
                +
                {specialties.length -
                  4}
              </Badge>
            ) : null}
          </div>

          <div className="mt-3 flex h-[44px] shrink-0 items-center gap-2 rounded-[12px] bg-[#f7f9fc] px-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-white text-blue-600 shadow-sm">
              <BriefcaseBusiness className="h-3.5 w-3.5" />
            </div>

            <div className="min-w-0">
              <div className="text-[8px] font-bold text-slate-400">
                주요 경력
              </div>

              <div className="mt-0.5 truncate text-[10px] font-bold text-slate-700">
                {careerPreview ||
                  "상세 프로필에서 확인"}
              </div>
            </div>
          </div>

          <div className="mt-auto grid grid-cols-2 gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              disabled={
                !publicToken
              }
              onClick={
                openProfile
              }
              className="h-9 rounded-[10px] border-blue-200 text-[10px] font-bold text-blue-600 hover:bg-blue-50 hover:text-blue-700"
            >
              프로필 보기
            </Button>

            <Button
              type="button"
              disabled={
                !publicToken ||
                !acceptingNewConsultations
              }
              onClick={
                openConsultation
              }
              className="h-9 rounded-[10px] bg-blue-600 text-[10px] font-bold text-white hover:bg-blue-700"
            >
              <Send className="mr-1.5 h-3 w-3" />
              상담 신청
            </Button>
          </div>
        </div>
      </article>
    </>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
 icon:
  ReactNode;

  title:
    string;

  description:
    string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-blue-600 text-white shadow-sm shadow-blue-600/20">
        {icon}
      </div>

      <div>
        <div className="text-sm font-black text-slate-950">
          {title}
        </div>

        <div className="mt-0.5 text-xs leading-5 text-slate-500">
          {description}
        </div>
      </div>
    </div>
  );
}

export default function PublicStaffTeamPage() {
  const [, params] =
    useRoute(
      "/team/:slug"
    );

  const slug =
    String(
      params?.slug ||
      ""
    )
      .trim()
      .toLowerCase();

const teamPageUrl =
  slug &&
  typeof window !==
    "undefined"
    ? `${window.location.origin}/team/${encodeURIComponent(
        slug
      )}`
    : "";

  const [
    selectedSpecialty,
    setSelectedSpecialty,
  ] =
    useState(
      "전체"
    );

const [
  consultationProfile,
  setConsultationProfile,
] =
  useState<any | null>(
    null
  );

const [
  selectedManagement,
  setSelectedManagement,
] =
  useState(
    "consultation"
  );

const managementItems = [
  {
    key: "consultation",
    number: "01",
    title: "상담 관리",
    shortTitle: "상담",
    description:
      "신규 상담부터 등록까지 모든 상담 내용을 기록하고 관리합니다.",
    image:
      "/images/management/management-consultation.png",
  },
  {
    key: "learning",
    number: "02",
    title: "학습 관리",
    shortTitle: "학습",
    description:
      "수강 현황부터 과제, 시험, 성적까지 학습 진행상황을 확인합니다.",
    image:
      "/images/management/management-learning.png",
  },
  {
    key: "practicum",
    number: "03",
    title: "실습 지원",
    shortTitle: "실습",
    description:
      "실습기관 확인부터 배정과 진행상황까지 체계적으로 지원합니다.",
    image:
      "/images/management/management-practicum.png",
  },
  {
    key: "administration",
    number: "04",
    title: "행정 관리",
    shortTitle: "행정",
    description:
      "학습자등록, 학점인정, 학위신청 등 중요한 행정 일정을 관리합니다.",
    image:
      "/images/management/management-administration.png",
  },
  {
    key: "certificate",
    number: "05",
    title: "자격증 취득",
    shortTitle: "자격증",
    description:
      "과정 이수 이후 자격증 신청과 발급 단계까지 확인합니다.",
    image:
      "/images/management/management-certificate.png",
  },
];

const activeManagement =
  managementItems.find(
    (item) =>
      item.key ===
      selectedManagement
  ) ||
  managementItems[0];

  const {
    data,
    isLoading,
    isError,
  } =
    trpc.staffProfile.public
      .companyTeamPage
      .useQuery(
        {
          slug,
        },
        {
          enabled:
            slug.length >
            0,

          retry:
            false,
        }
      );

  if (
    isLoading
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f8ff]">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />

          담당자 소개 페이지를 불러오는 중입니다.
        </div>
      </div>
    );
  }

  if (
    isError ||
    !data
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-5">
        <div className="w-full max-w-md rounded-[28px] border bg-white px-6 py-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <UsersRound className="h-7 w-7 text-slate-400" />
          </div>

          <h1 className="mt-5 text-xl font-bold text-slate-950">
            페이지를 확인할 수 없습니다
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            공개되지 않은 회사 담당자 페이지이거나
            사용할 수 없는 링크입니다.
          </p>
        </div>
      </div>
    );
  }

  const publicData =
    data as any;

  const branding =
    publicData.branding ||
    {};

  const settings =
    publicData.settings ||
    {};

  const profiles =
    Array.isArray(
      publicData.profiles
    )
      ? publicData.profiles
      : [];

  const companyName =
    String(
      branding.companyName ||
      ""
    ).trim();

  const companyLogoUrl =
    normalizeImageUrl(
      branding.companyLogoUrl
    );

  const pageTitle =
    String(
      settings.title ||
      ""
    ).trim() ||
    "당신의 목표를 함께할 학습담당자를 만나보세요.";

  const description =
    String(
      settings.description ||
      ""
    ).trim() ||
    `${companyName || "교육"}의 전문 학습담당자들이 처음 상담부터 자격증 취득까지 함께합니다.`;

  const staffSectionTitle =
    String(
      settings.staffSectionTitle ||
      ""
    ).trim() ||
    "함께할 담당자를 소개합니다";

  const staffSectionDescription =
    String(
      settings.staffSectionDescription ||
      ""
    ).trim() ||
    "전문 분야를 선택해 회원님에게 맞는 담당자를 확인해보세요.";

  const specialtyCountMap =
  new Map<string, number>();

profiles.forEach(
  (profile: any) => {
    normalizeSpecialties(
      profile
    ).forEach(
      (specialty: string) => {
        specialtyCountMap.set(
          specialty,
          (
            specialtyCountMap.get(
              specialty
            ) || 0
          ) + 1
        );
      }
    );
  }
);

const specialtyOptions =
  Array.from(
    specialtyCountMap.entries()
  )
    .sort(
      (
        left,
        right
      ) =>
        right[1] -
          left[1] ||
        left[0].localeCompare(
          right[0],
          "ko"
        )
    );

const filteredProfiles =
  selectedSpecialty === "전체"
    ? profiles
    : profiles.filter(
        (profile: any) =>
          normalizeSpecialties(
            profile
          ).includes(
            selectedSpecialty
          )
      );

  const scrollToStaff =
    () => {
      document
        .getElementById(
          "staff-list"
        )
        ?.scrollIntoView({
          behavior:
            "smooth",
          block:
            "start",
        });
    };

return (
  <>
    <div className="min-h-screen bg-[#f7f9fc] text-slate-950">
      {/* ========================================
          HEADER
      ======================================== */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            {companyLogoUrl ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
                <img
                  src={
                    companyLogoUrl
                  }
                  alt={
                    companyName
                      ? `${companyName} 로고`
                      : "회사 로고"
                  }
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <Sparkles className="h-4 w-4" />
              </div>
            )}

            <div className="min-w-0">
              <div className="truncate text-[14px] font-black tracking-[-0.02em] text-slate-950">
                {companyName ||
                  "담당자 소개"}
              </div>

              <div className="truncate text-[10px] font-medium text-slate-400">
                함께 만드는 더 나은 내일
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-7 md:flex">
            <button
              type="button"
              onClick={
                scrollToStaff
              }
              className="relative h-[68px] text-[13px] font-bold text-blue-600"
            >
              담당자 소개

              <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-blue-600" />
            </button>
          </div>

          <Button
            type="button"
            onClick={
              scrollToStaff
            }
            className="hidden h-10 rounded-full bg-blue-600 px-5 text-[12px] font-bold text-white hover:bg-blue-700 sm:inline-flex"
          >
            담당자 선택하기
          </Button>

          <button
            type="button"
            onClick={
              scrollToStaff
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 sm:hidden"
            aria-label="담당자 목록 보기"
          >
            <UsersRound className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main>
        {/* ========================================
            HERO
        ======================================== */}
        <section className="relative overflow-hidden border-b border-blue-100/60 bg-gradient-to-br from-white via-[#f7faff] to-[#edf4ff]">
          <div className="pointer-events-none absolute -right-28 -top-20 h-[360px] w-[360px] rounded-full bg-blue-200/20 blur-3xl" />

          <div className="pointer-events-none absolute -left-24 bottom-0 h-[280px] w-[280px] rounded-full bg-indigo-100/40 blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-4 py-11 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
            <div className="max-w-[760px]">
              <div className="mb-3 text-[10px] font-black uppercase tracking-[0.18em] text-blue-600 sm:text-xs">
                Professional Staff
              </div>

              <h1 className="whitespace-pre-line text-[34px] font-black leading-[1.17] tracking-[-0.045em] text-slate-950 sm:text-[46px] lg:text-[52px]">
                {pageTitle}
              </h1>

              <p className="mt-4 max-w-2xl whitespace-pre-line text-[13px] leading-7 text-slate-600 sm:text-[15px] sm:leading-8">
                {description}
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-3 sm:gap-5">
                <FeatureItem
                  icon={
                    <UsersRound className="h-5 w-5" />
                  }
                  title="전문 분야별 상담"
                  description="과정에 맞는 담당자 확인"
                />

                <FeatureItem
                  icon={
                    <Heart className="h-5 w-5" />
                  }
                  title="1:1 맞춤 설계"
                  description="개인 상황에 맞는 과정 안내"
                />

                <FeatureItem
                  icon={
                    <Target className="h-5 w-5" />
                  }
                  title="취득까지 과정 관리"
                  description="학습·실습·행정까지 확인"
                />
              </div>
            </div>
          </div>
        </section>

        {/* ========================================
            STAFF
        ======================================== */}
        <section
          id="staff-list"
          className="scroll-mt-24 bg-white"
        >
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
            <div className="mb-7">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-blue-600">
                Our Staff
              </div>

              <h2 className="mt-2 text-[24px] font-black tracking-[-0.035em] text-slate-950 sm:text-[30px]">
                {staffSectionTitle}
              </h2>

              <p className="mt-2 max-w-2xl text-[13px] leading-6 text-slate-500 sm:text-sm">
                {staffSectionDescription}
              </p>
            </div>

            {/* FILTER */}
            <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
              <div className="flex min-w-max gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedSpecialty(
                      "전체"
                    )
                  }
                  className={`rounded-full border px-4 py-2 text-[11px] font-bold transition ${
                    selectedSpecialty ===
                    "전체"
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-600"
                  }`}
                >
                  전체 (
                  {profiles.length})
                </button>

                {specialtyOptions.map(
                  ([
                    specialty,
                    count,
                  ]) => (
                    <button
                      key={
                        specialty
                      }
                      type="button"
                      onClick={() =>
                        setSelectedSpecialty(
                          specialty
                        )
                      }
                      className={`rounded-full border px-4 py-2 text-[11px] font-bold transition ${
                        selectedSpecialty ===
                        specialty
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-600"
                      }`}
                    >
                      {specialty} (
                      {count})
                    </button>
                  )
                )}
              </div>
            </div>

            {/* STAFF GRID */}
            {filteredProfiles.length ? (
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
                {filteredProfiles.map(
                  (
                    profile:
                      any,
                    index:
                      number
                  ) => (
                    <StaffCard
                      key={
                        profile
                          ?.publicToken ||
                        index
                      }
                      profile={
                        profile
                      }
                      onConsultation={(
                        selectedProfile
                      ) => {
                        setConsultationProfile(
                          selectedProfile
                        );
                      }}
                    />
                  )
                )}
              </div>
            ) : (
              <div className="mt-8 rounded-[22px] border border-slate-200 bg-slate-50 p-10 text-center">
                <UserRound className="mx-auto h-8 w-8 text-slate-300" />

                <div className="mt-4 font-bold text-slate-900">
                  해당 분야의 공개 담당자가 없습니다
                </div>

                <div className="mt-2 text-sm text-slate-500">
                  다른 전문분야를 선택해 확인해주세요.
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ========================================
            MANAGEMENT SYSTEM
        ======================================== */}
        <section className="border-y border-blue-100 bg-gradient-to-br from-[#f7fbff] via-white to-[#edf5ff]">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
            <div className="grid gap-8 lg:grid-cols-[330px_1fr] lg:items-end">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                  Care Management System
                </div>

                <h2 className="mt-3 text-[28px] font-black leading-[1.25] tracking-[-0.04em] text-slate-950 sm:text-[34px]">
                  담당자가 바뀌어도
                  <br />
                  과정은 안전하게 이어집니다.
                </h2>

                <p className="mt-4 text-[13px] leading-7 text-slate-600 sm:text-sm">
                  상담부터 학습, 실습,
                  행정, 자격증 취득까지
                  주요 과정이 기록되어
                  중단 없이 이어서
                  관리할 수 있습니다.
                </p>
              </div>

              {/* PROCESS */}
              <div className="grid grid-cols-5 gap-1 rounded-[22px] border border-blue-100 bg-white p-3 shadow-sm sm:gap-2 sm:p-4">
                {managementItems.map(
                  (
                    item,
                    index
                  ) => {
                    const active =
                      selectedManagement ===
                      item.key;

                    return (
                      <button
                        key={
                          item.key
                        }
                        type="button"
                        onClick={() =>
                          setSelectedManagement(
                            item.key
                          )
                        }
                        className={`relative flex min-w-0 flex-col items-center rounded-[16px] px-1 py-3 transition sm:px-2 ${
                          active
                            ? "bg-blue-50"
                            : "hover:bg-slate-50"
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-black sm:h-11 sm:w-11 ${
                            active
                              ? "bg-blue-600 text-white"
                              : "bg-blue-50 text-blue-600"
                          }`}
                        >
                          {item.number}
                        </div>

                        <div
                          className={`mt-2 truncate text-[9px] font-black sm:text-[11px] ${
                            active
                              ? "text-blue-700"
                              : "text-slate-800"
                          }`}
                        >
                          {item.shortTitle}
                        </div>

                        {index <
                        managementItems.length -
                          1 ? (
                          <ChevronRight className="absolute -right-2 top-[25px] hidden h-4 w-4 text-blue-300 sm:block" />
                        ) : null}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* ACTIVE SCREEN */}
            <div className="mt-7 overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.06)]">
              <div className="border-b border-slate-100 px-5 py-4 sm:flex sm:items-center sm:justify-between sm:px-6">
                <div>
                  <div className="text-[12px] font-black text-blue-600">
                    {
                      activeManagement.title
                    }
                  </div>

                  <div className="mt-1 text-[12px] leading-6 text-slate-500 sm:text-[13px]">
                    {
                      activeManagement.description
                    }
                  </div>
                </div>
              </div>

              <div className="bg-[#eef3f8] p-2 sm:p-4 lg:p-5">
                <img
                  src={
                    activeManagement.image
                  }
                  alt={`${activeManagement.title} 관리 화면`}
                  className="mx-auto block w-full rounded-[14px] border border-slate-200 bg-white object-contain shadow-sm"
                />
              </div>
            </div>

            {/* CONTINUITY */}
            <div className="mt-6 grid gap-5 rounded-[22px] border border-blue-100 bg-white px-5 py-6 sm:px-7 lg:grid-cols-[1fr_auto] lg:items-center">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                  <ShieldCheck className="h-6 w-6" />
                </div>

                <div>
                  <div className="text-[17px] font-black tracking-[-0.025em] text-slate-950">
                    담당자가 바뀌어도,
                    과정은 이어집니다.
                  </div>

                  <div className="mt-1.5 max-w-2xl text-[12px] leading-6 text-slate-500 sm:text-[13px]">
                    상담 기록과 학습 진행,
                    실습 지원 및 행정 일정 등
                    과정의 주요 내용이
                    체계적으로 관리됩니다.
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-5 gap-y-2 text-[11px] font-bold text-slate-600 sm:grid-cols-3">
                {[
                  "상담 기록",
                  "학습 관리",
                  "실습 지원",
                  "행정 일정",
                  "자격증 취득",
                  "지속적인 관리",
                ].map(
                  (label) => (
                    <div
                      key={
                        label
                      }
                      className="flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="h-4 w-4 text-blue-600" />
                      {label}
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================
            FINAL CTA
        ======================================== */}
        <section className="bg-white">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-5 rounded-[24px] border border-blue-100 bg-gradient-to-r from-[#f4f8ff] to-[#eef5ff] px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                  <UsersRound className="h-6 w-6" />
                </div>

                <div>
                  <div className="text-[17px] font-black tracking-[-0.025em] text-slate-950">
                    원하는 담당자를
                    찾기 어려우신가요?
                  </div>

                  <div className="mt-1 text-[12px] leading-6 text-slate-500 sm:text-[13px]">
                    전문분야를 확인하고
                    회원님에게 맞는 담당자에게
                    직접 상담을 신청해보세요.
                  </div>
                </div>
              </div>

              <Button
                type="button"
                onClick={() => {
                  setSelectedSpecialty(
                    "전체"
                  );

                  document
                    .getElementById(
                      "staff-list"
                    )
                    ?.scrollIntoView({
                      behavior:
                        "smooth",
                      block:
                        "start",
                    });
                }}
                className="h-11 shrink-0 rounded-xl bg-blue-600 px-6 text-[12px] font-bold text-white hover:bg-blue-700"
              >
                담당자 확인하기
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* ========================================
            FOOTER
        ======================================== */}
        <footer className="border-t border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              {companyLogoUrl ? (
                <img
                  src={
                    companyLogoUrl
                  }
                  alt={
                    companyName ||
                    "회사 로고"
                  }
                  className="h-8 w-8 rounded-full border border-slate-200 object-contain"
                />
              ) : null}

              <div>
                <div className="text-[12px] font-black text-slate-800">
                  {companyName ||
                    "공식 담당자 소개"}
                </div>

                <div className="mt-0.5 text-[10px] text-slate-400">
                  공식 담당자 안내 페이지
                </div>
              </div>
            </div>

            <div className="text-[10px] text-slate-400">
              담당자와 시스템이 함께
              과정을 확인합니다.
            </div>
          </div>
        </footer>
      </main>
    </div>
    <PublicStaffConsultationModal
      open={
        Boolean(
          consultationProfile
        )
      }
      onClose={() => {
        setConsultationProfile(
          null
        );
      }}
      profile={
        consultationProfile
      }
      teamPageUrl={
        teamPageUrl ||
        null
      }
    />
  </>
);
}