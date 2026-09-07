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
      if (
        !publicToken
      ) {
        return;
      }

      window.location.href =
        `/staff/${encodeURIComponent(
          publicToken
        )}`;
    };

  /**
   * 다음 단계에서
   * 이 함수만 상담 모달 OPEN으로 변경한다.
   *
   * 현재는 기존 공개 프로필의
   * 상담 기능을 그대로 사용할 수 있도록
   * 프로필 페이지로 연결한다.
   */
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
      <article className="rounded-[22px] border border-slate-200/80 bg-white p-3 shadow-sm md:hidden">
        <div className="flex gap-3">
          <div className="relative h-[112px] w-[92px] shrink-0 overflow-hidden rounded-[16px] bg-slate-100">
            {imageUrl ? (
              <img
                src={
                  imageUrl
                }
                alt={`${displayName} 담당자`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
                <UserRound className="h-8 w-8" />
              </div>
            )}

            <div className="absolute left-1.5 top-1.5">
              <ConsultationStatus
                accepting={
                  acceptingNewConsultations
                }
              />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h3 className="text-base font-black tracking-tight text-slate-950">
                {displayName}
              </h3>

              {positionName ? (
                <span className="text-xs font-semibold text-slate-500">
                  {positionName}
                </span>
              ) : null}
            </div>

            {specialties.length ? (
              <div className="mt-2 flex flex-wrap gap-1">
                {specialties
                  .slice(
                    0,
                    3
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
                        className="h-6 rounded-full border-slate-200 px-2 text-[10px] font-semibold text-slate-600"
                      >
                        {specialty}
                      </Badge>
                    )
                  )}
              </div>
            ) : null}

            {careerPreview ? (
              <p className="mt-2 line-clamp-1 text-[11px] leading-5 text-slate-500">
                {careerPreview}
              </p>
            ) : (
              <p className="mt-2 line-clamp-1 text-[11px] leading-5 text-slate-500">
                {headline}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-xl border-blue-200 text-xs font-bold text-blue-600 hover:bg-blue-50 hover:text-blue-700"
            disabled={
              !publicToken
            }
            onClick={
              openProfile
            }
          >
            프로필 보기
          </Button>

          <Button
            type="button"
            className="h-9 rounded-xl bg-blue-600 text-xs font-bold text-white hover:bg-blue-700"
            disabled={
              !publicToken ||
              !acceptingNewConsultations
            }
            onClick={
              openConsultation
            }
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            상담 신청
          </Button>
        </div>
      </article>

      {/* =========================
          DESKTOP CARD
      ========================= */}
      <article className="group hidden overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-950/[0.06] md:block">
        <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
          {imageUrl ? (
            <img
              src={
                imageUrl
              }
              alt={`${displayName} 담당자`}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
              <UserRound className="h-16 w-16" />

              <span className="mt-3 text-xs">
                담당자 프로필
              </span>
            </div>
          )}

          <div className="absolute left-4 top-4">
            <ConsultationStatus
              accepting={
                acceptingNewConsultations
              }
            />
          </div>
        </div>

        <div className="p-5 lg:p-6">
          <div className="flex flex-wrap items-end gap-x-2 gap-y-1">
            <h3 className="text-xl font-black tracking-tight text-slate-950">
              {displayName}
            </h3>

            {positionName ? (
              <span className="pb-0.5 text-sm font-semibold text-slate-500">
                {positionName}
              </span>
            ) : null}
          </div>

          <p className="mt-3 line-clamp-2 min-h-[48px] text-sm leading-6 text-slate-600">
            “{headline}”
          </p>

          {specialties.length ? (
            <div className="mt-4 flex min-h-[58px] flex-wrap content-start gap-1.5">
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
                      className="h-7 rounded-full border-slate-200 px-2.5 text-[11px] font-semibold text-slate-600"
                    >
                      {specialty}
                    </Badge>
                  )
                )}

              {specialties.length >
              4 ? (
                <Badge
                  variant="outline"
                  className="h-7 rounded-full border-slate-200 px-2.5 text-[11px] font-semibold text-slate-500"
                >
                  +
                  {specialties.length -
                    4}
                </Badge>
              ) : null}
            </div>
          ) : (
            <div className="min-h-[58px]" />
          )}

          {careerPreview ? (
            <div className="mt-4 rounded-xl bg-slate-50 px-3.5 py-3">
              <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                주요 경력
              </div>

              <div className="mt-1 line-clamp-1 text-xs font-semibold text-slate-700">
                {careerPreview}
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid grid-cols-1 gap-2">
            <Button
              type="button"
              className="h-11 rounded-xl bg-blue-600 font-bold text-white hover:bg-blue-700"
              disabled={
                !publicToken ||
                !acceptingNewConsultations
              }
              onClick={
                openConsultation
              }
            >
              <Send className="mr-2 h-4 w-4" />
              상담 신청하기
            </Button>

            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl border-blue-200 font-bold text-blue-600 hover:bg-blue-50 hover:text-blue-700"
              disabled={
                !publicToken
              }
              onClick={
                openProfile
              }
            >
              프로필 보기
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

  const footerIntroduction =
    String(
      settings.footerIntroduction ||
      ""
    ).trim();

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
    <div className="min-h-screen bg-[#f5f8ff] text-slate-950">
      {/* =========================
          HEADER
      ========================= */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-7">
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-500">
                <Sparkles className="h-4 w-4" />
              </div>
            )}

            <div className="min-w-0">
              <div className="truncate text-sm font-black tracking-tight text-slate-950">
                {companyName ||
                  "담당자 소개"}
              </div>

              <div className="truncate text-[10px] font-medium text-slate-400">
                함께 만드는 더 나은 내일
              </div>
            </div>
          </div>

          <nav className="hidden items-center gap-10 lg:flex">
            <button
              type="button"
              className="relative h-[72px] text-sm font-bold text-blue-600"
              onClick={
                scrollToStaff
              }
            >
              담당자 소개

              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-blue-600" />
            </button>

            <span className="text-sm font-semibold text-slate-400">
              교육과정
            </span>

            <span className="text-sm font-semibold text-slate-400">
              실제 후기
            </span>

            <span className="text-sm font-semibold text-slate-400">
              자주 묻는 질문
            </span>
          </nav>

          <Button
  type="button"
  className="hidden h-10 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 sm:inline-flex"
  onClick={
    scrollToStaff
  }
>
  담당자 선택하기
</Button>

          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700 sm:hidden"
            onClick={
              scrollToStaff
            }
            aria-label="담당자 목록 보기"
          >
            <UsersRound className="h-5 w-5" />
          </button>
        </div>
      </header>

      <main>
        {/* =========================
            HERO
        ========================= */}
        <section className="relative overflow-hidden border-b border-blue-100/60 bg-gradient-to-br from-white via-[#f5f9ff] to-[#eaf2ff]">
          <div className="pointer-events-none absolute -right-28 top-16 h-[360px] w-[360px] rounded-full bg-blue-200/20 blur-3xl" />

          <div className="pointer-events-none absolute -left-24 bottom-0 h-[260px] w-[260px] rounded-full bg-indigo-100/40 blur-3xl" />

          <div className="relative mx-auto max-w-7xl px-5 py-12 sm:px-7 sm:py-16 lg:py-20">
            <div className="max-w-3xl">
              {companyName ? (
                <div className="mb-3 text-xs font-black uppercase tracking-[0.14em] text-blue-600">
                  {companyName}
                </div>
              ) : null}

              <h1 className="max-w-3xl whitespace-pre-line text-[34px] font-black leading-[1.18] tracking-[-0.04em] text-slate-950 sm:text-5xl lg:text-[56px]">
                {pageTitle}
              </h1>

              <p className="mt-5 max-w-2xl whitespace-pre-line text-sm leading-7 text-slate-600 sm:text-base sm:leading-8">
                {description}
              </p>

              <div className="mt-8 grid gap-5 sm:grid-cols-3 lg:max-w-3xl">
                <FeatureItem
                  icon={
                    <UsersRound className="h-5 w-5" />
                  }
                  title="전문 분야별 상담"
                  description="과정별 전문 담당자 배정"
                />

                <FeatureItem
                  icon={
                    <Heart className="h-5 w-5" />
                  }
                  title="1:1 맞춤 설계"
                  description="개인 상황에 맞는 학습 설계"
                />

                <FeatureItem
                  icon={
                    <Target className="h-5 w-5" />
                  }
                  title="취득까지 책임 관리"
                  description="상담부터 실습·행정까지"
                />
              </div>
            </div>
          </div>
        </section>

        {/* =========================
            STAFF
        ========================= */}
        <section
          id="staff-list"
          className="scroll-mt-24"
        >
          <div className="mx-auto max-w-7xl px-5 py-10 sm:px-7 sm:py-14">
            <div className="mb-7">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
                  <BriefcaseBusiness className="h-4 w-4" />
                </div>

                <h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                  {staffSectionTitle}
                </h2>
              </div>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">
                {staffSectionDescription}
              </p>
            </div>

            {/* FILTER */}
            <div className="-mx-5 overflow-x-auto px-5 pb-2 sm:mx-0 sm:px-0">
              <div className="flex min-w-max gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setSelectedSpecialty(
                      "전체"
                    )
                  }
                  className={`rounded-full border px-5 py-2.5 text-xs font-bold transition ${
                    selectedSpecialty ===
                    "전체"
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/20"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-600"
                  }`}
                >
                  전체 (
                  {profiles.length}
                  )
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
                      className={`rounded-full border px-4 py-2.5 text-xs font-bold transition ${
                        selectedSpecialty ===
                        specialty
                          ? "border-blue-600 bg-blue-600 text-white shadow-sm shadow-blue-600/20"
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

            {filteredProfiles.length ? (
              <div className="mt-6 grid gap-3 md:grid-cols-2 md:gap-5 xl:grid-cols-3">
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
              <div className="mt-8 rounded-[24px] border border-slate-200 bg-white p-10 text-center shadow-sm">
                <UserRound className="mx-auto h-8 w-8 text-slate-300" />

                <h3 className="mt-4 font-bold text-slate-900">
                  해당 분야의 공개 담당자가 없습니다
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  다른 전문분야를 선택해 확인해주세요.
                </p>
              </div>
            )}

            {/* CONSULTATION CTA */}
            <div className="mt-8 flex flex-col gap-5 rounded-[24px] border border-blue-100 bg-gradient-to-r from-[#eef5ff] to-[#f8fbff] px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-7">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm">
                  <UsersRound className="h-6 w-6" />
                </div>

                <div>
                  <div className="text-base font-black text-slate-950">
                    어떤 담당자가 좋을지 고민되시나요?
                  </div>

                  <div className="mt-1 text-sm leading-6 text-slate-500">
                    과정, 지역, 상황에 맞는 담당자를 선택해보세요.
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-11 shrink-0 rounded-xl border-blue-300 bg-white px-5 font-bold text-blue-600 hover:bg-blue-50 hover:text-blue-700"
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
                    });
                }}
              >
                담당자 확인하기

                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* =========================
            COMPANY INTRO
        ========================= */}
        {footerIntroduction ? (
          <section className="border-y border-slate-200 bg-white">
            <div className="mx-auto max-w-4xl px-5 py-12 text-center sm:px-7">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                <Sparkles className="h-5 w-5" />
              </div>

              {companyName ? (
                <h2 className="mt-5 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">
                  {companyName}
                </h2>
              ) : null}

              <div className="mt-4 whitespace-pre-line text-sm leading-8 text-slate-600">
                {footerIntroduction}
              </div>
            </div>
          </section>
        ) : null}

        {/* =========================
            TRUST FOOTER
        ========================= */}
        <section className="bg-white">
          <div className="mx-auto grid max-w-7xl gap-5 px-5 py-8 sm:grid-cols-3 sm:px-7">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <ShieldCheck className="h-5 w-5 text-slate-700" />

              <div>
                <div className="font-bold text-slate-800">
                  정확한 정보 제공
                </div>

                <div className="mt-0.5">
                  교육부 기준에 따른 안내
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500">
              <Heart className="h-5 w-5 text-slate-700" />

              <div>
                <div className="font-bold text-slate-800">
                  무리한 권유 없음
                </div>

                <div className="mt-0.5">
                  회원님의 상황에 맞춰 안내
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-500">
              <Target className="h-5 w-5 text-slate-700" />

              <div>
                <div className="font-bold text-slate-800">
                  취득까지 과정 관리
                </div>

                <div className="mt-0.5">
                  담당자와 시스템이 함께 확인
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="border-t border-slate-200 bg-white px-5 py-8 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" />

            {companyName
              ? `${companyName} 공식 담당자 소개`
              : "공식 담당자 소개"}
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