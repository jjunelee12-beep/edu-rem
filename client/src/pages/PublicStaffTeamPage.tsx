import {
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";

import { useRoute } from "wouter";

import { trpc } from "@/lib/trpc";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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

  if (raw.startsWith("//")) {
    return `https:${raw}`;
  }

  if (!API_BASE_URL) {
    return raw;
  }

  return raw.startsWith("/")
    ? `${API_BASE_URL}${raw}`
    : `${API_BASE_URL}/${raw}`;
}

function StaffCard({
  profile,
}: {
  profile: any;
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
    Array.isArray(
      profile?.specialties
    )
      ? profile.specialties
          .map(
            (item: unknown) =>
              String(
                item || ""
              ).trim()
          )
          .filter(Boolean)
      : [];

  const acceptingNewConsultations =
    profile?.acceptingNewConsultations !==
    false;

  const openProfile = () => {
    if (!publicToken) {
      return;
    }

    window.location.href =
      `/staff/${publicToken}`;
  };

  return (
    <article className="group overflow-hidden rounded-[26px] border border-slate-200/80 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-slate-950/[0.06]">
      {/* 이미지 */}
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
        {imageUrl ? (
          <img
            src={imageUrl}
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

        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />

        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-2">
          {acceptingNewConsultations ? (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 shadow-sm">
              <CheckCircle2 className="h-3.5 w-3.5" />
              신규상담 가능
            </div>
          ) : (
            <div className="inline-flex items-center rounded-full bg-white/90 px-3 py-1.5 text-[11px] font-semibold text-slate-500 shadow-sm">
              상담 준비중
            </div>
          )}
        </div>
      </div>

      {/* 내용 */}
      <div className="p-5 sm:p-6">
        <div className="flex items-end gap-2">
          <h3 className="text-xl font-black tracking-tight text-slate-950">
            {displayName}
          </h3>

          {positionName ? (
            <span className="pb-0.5 text-sm font-medium text-slate-500">
              {positionName}
            </span>
          ) : null}
        </div>

        <p className="mt-3 line-clamp-2 min-h-[48px] text-sm leading-6 text-slate-600">
          {headline}
        </p>

        {specialties.length ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {specialties
              .slice(0, 5)
              .map(
                (
                  specialty: string,
                  index: number
                ) => (
                  <Badge
                    key={`${specialty}-${index}`}
                    variant="secondary"
                    className="rounded-full px-2.5 py-1 text-[11px]"
                  >
                    {specialty}
                  </Badge>
                )
              )}

            {specialties.length >
            5 ? (
              <Badge
                variant="outline"
                className="rounded-full px-2.5 py-1 text-[11px]"
              >
                +
                {specialties.length -
                  5}
              </Badge>
            ) : null}
          </div>
        ) : null}

        <div className="mt-5 border-t pt-4">
          <Button
            type="button"
            variant="ghost"
            className="h-10 w-full justify-between rounded-xl px-3 font-semibold"
            disabled={!publicToken}
            onClick={openProfile}
          >
            담당자 자세히 보기

            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Button>
        </div>
      </div>
    </article>
  );
}

export default function PublicStaffTeamPage() {
  const [, params] =
    useRoute(
      "/team/:organizationId"
    );

  const organizationId =
    Number(
      params?.organizationId ||
      0
    );

  const {
    data,
    isLoading,
    isError,
  } =
    trpc.staffProfile.public.companyTeamPage.useQuery(
      {
        organizationId,
      },
      {
        enabled:
          Number.isFinite(
            organizationId
          ) &&
          organizationId > 0,

        retry:
          false,
      }
    );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9]">
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
      <div className="flex min-h-screen items-center justify-center bg-[#f6f7f9] px-5">
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

  /**
   * Host가 별도 제목을 작성한 경우 우선.
   *
   * 별도 제목이 없으면 회사명 기준으로 자동 생성.
   * 특정 회사명 하드코딩 금지.
   */
  const pageTitle =
    String(
      settings.title ||
      ""
    ).trim() ||
    (
      companyName
        ? `${companyName}과 함께하세요`
        : "담당자를 만나보세요"
    );

  const description =
    String(
      settings.description ||
      ""
    ).trim() ||
    "회원님의 상황과 목표에 맞는 전문 담당자를 확인해보세요.";

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
    "담당자별 전문 분야와 소개를 확인한 뒤 상세 프로필을 살펴보실 수 있습니다.";

  const footerIntroduction =
    String(
      settings.footerIntroduction ||
      ""
    ).trim();

  return (
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      {/* HEADER */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            {companyLogoUrl ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white">
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
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
                <Sparkles className="h-4 w-4" />
              </div>
            )}

            <div className="min-w-0">
              <div className="truncate text-sm font-bold tracking-tight">
                {companyName ||
                  "담당자 소개"}
              </div>

              <div className="text-[10px] text-slate-400">
                Professional Team
              </div>
            </div>
          </div>

          <div className="hidden items-center gap-1.5 text-xs font-medium text-slate-500 sm:flex">
            <ShieldCheck className="h-4 w-4" />
            공식 담당자 안내
          </div>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="relative overflow-hidden bg-slate-950 text-white">
          <div className="pointer-events-none absolute -right-28 -top-40 h-[420px] w-[420px] rounded-full border border-white/[0.05]" />

          <div className="pointer-events-none absolute -bottom-48 -left-24 h-[380px] w-[380px] rounded-full bg-white/[0.025]" />

          <div className="relative mx-auto max-w-7xl px-5 py-16 text-center sm:px-7 sm:py-20 lg:py-24">
            {companyLogoUrl ? (
              <div className="mx-auto mb-7 flex h-20 w-20 items-center justify-center overflow-hidden rounded-[22px] border border-white/10 bg-white p-2 shadow-2xl">
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
            ) : null}

            {companyName ? (
              <div className="mb-3 text-sm font-semibold tracking-wide text-slate-400">
                {companyName}
              </div>
            ) : null}

            <h1 className="mx-auto max-w-4xl text-3xl font-black tracking-tight sm:text-5xl lg:text-6xl">
              {pageTitle}
            </h1>

            <p className="mx-auto mt-6 max-w-2xl whitespace-pre-line text-sm leading-7 text-slate-300 sm:text-base sm:leading-8">
              {description}
            </p>

            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-xs font-medium text-slate-300">
              <UsersRound className="h-4 w-4" />
              공개 담당자{" "}
              {profiles.length}명
            </div>
          </div>
        </section>

        {/* 담당자 영역 */}
        <section className="mx-auto max-w-7xl px-5 py-14 sm:px-7 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>

            <h2 className="mt-5 text-2xl font-black tracking-tight sm:text-3xl">
              {staffSectionTitle}
            </h2>

            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-500">
              {staffSectionDescription}
            </p>
          </div>

          {profiles.length ? (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {profiles.map(
                (
                  profile: any,
                  index: number
                ) => (
                  <StaffCard
                    key={
                      profile?.publicToken ||
                      index
                    }
                    profile={
                      profile
                    }
                  />
                )
              )}
            </div>
          ) : (
            <div className="mx-auto mt-10 max-w-lg rounded-[24px] border bg-white p-10 text-center shadow-sm">
              <UserRound className="mx-auto h-8 w-8 text-slate-300" />

              <h3 className="mt-4 font-bold text-slate-900">
                공개된 담당자가 없습니다
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-500">
                현재 소개할 담당자 프로필을 준비하고 있습니다.
              </p>
            </div>
          )}
        </section>

        {/* 회사 소개 */}
        {footerIntroduction ? (
          <section className="border-y bg-white">
            <div className="mx-auto max-w-4xl px-5 py-14 text-center sm:px-7 sm:py-16">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <Sparkles className="h-5 w-5" />
              </div>

              {companyName ? (
                <h2 className="mt-5 text-xl font-black tracking-tight sm:text-2xl">
                  {companyName}
                </h2>
              ) : null}

              <div className="mt-4 whitespace-pre-line text-sm leading-8 text-slate-600">
                {footerIntroduction}
              </div>
            </div>
          </section>
        ) : null}

        <footer className="px-5 py-10 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" />

            {companyName
              ? `${companyName} 공식 담당자 소개`
              : "공식 담당자 소개"}
          </div>
        </footer>
      </main>
    </div>
  );
}