import {
  Award,
  BriefcaseBusiness,
  CheckCircle2,
  GraduationCap,
  HeartHandshake,
  Loader2,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";

import {
  useState,
} from "react";

import { useRoute } from "wouter";

import { trpc } from "@/lib/trpc";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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



type ProfileSectionTone =
  | "blue"
  | "green"
  | "violet"
  | "cyan";

function ProfileSection({
  icon,
  title,
  subtitle,
  label,
  number,
  tone = "blue",
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  label?: string;
  number?: string;
  tone?: ProfileSectionTone;
  children: React.ReactNode;
}) {
  const toneStyles = {
    blue: {
      card:
        "border-blue-100 bg-gradient-to-br from-white via-blue-50/40 to-blue-100/60",
      edge:
        "bg-blue-500",
      icon:
        "bg-blue-600 text-white shadow-blue-200",
      dot:
        "bg-blue-500",
      label:
        "text-blue-400",
      number:
        "text-blue-200/60",
      ghost:
        "text-blue-200/40",
    },

    green: {
      card:
        "border-emerald-100 bg-gradient-to-br from-white via-emerald-50/40 to-emerald-100/55",
      edge:
        "bg-emerald-500",
      icon:
        "bg-emerald-500 text-white shadow-emerald-200",
      dot:
        "bg-emerald-500",
      label:
        "text-emerald-500",
      number:
        "text-emerald-200/70",
      ghost:
        "text-emerald-200/40",
    },

    violet: {
      card:
        "border-violet-100 bg-gradient-to-br from-white via-violet-50/40 to-violet-100/55",
      edge:
        "bg-violet-500",
      icon:
        "bg-violet-500 text-white shadow-violet-200",
      dot:
        "bg-violet-500",
      label:
        "text-violet-400",
      number:
        "text-violet-200/70",
      ghost:
        "text-violet-200/40",
    },

    cyan: {
      card:
        "border-cyan-100 bg-gradient-to-br from-white via-cyan-50/40 to-sky-100/55",
      edge:
        "bg-cyan-500",
      icon:
        "bg-cyan-500 text-white shadow-cyan-200",
      dot:
        "bg-cyan-500",
      label:
        "text-cyan-500",
      number:
        "text-cyan-200/70",
      ghost:
        "text-cyan-200/40",
    },
  } as const;

  const currentTone =
    toneStyles[tone];

  return (
    <section
      className={`group relative overflow-hidden rounded-[24px] border p-5 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-md sm:p-7 ${currentTone.card}`}
    >
      {/* 왼쪽 컬러 포인트 */}
      <div
        className={`absolute bottom-0 left-0 top-0 w-1 ${currentTone.edge}`}
      />

      {/* 우측 배경 숫자 */}
      {number ? (
        <div
          className={`pointer-events-none absolute bottom-1 right-5 select-none text-[72px] font-black leading-none tracking-[-0.08em] sm:right-7 sm:text-[92px] ${currentTone.number}`}
        >
          {number}
        </div>
      ) : null}

      {/* 배경 원 */}
      <div
        className={`pointer-events-none absolute -bottom-16 -right-12 h-44 w-44 rounded-full ${currentTone.ghost}`}
      />

      <div className="relative z-10">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg ${currentTone.icon}`}
          >
            {icon}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black tracking-[-0.025em] text-slate-950 sm:text-xl">
                  {title}
                </h2>

                {subtitle ? (
                  <p className="mt-1 text-xs font-medium leading-5 text-slate-500 sm:text-[13px]">
                    {subtitle}
                  </p>
                ) : null}
              </div>

              {label ? (
                <div
                  className={`hidden shrink-0 pt-1 text-[10px] font-black tracking-[0.08em] sm:block ${currentTone.label}`}
                >
                  {label}
                </div>
              ) : null}
            </div>

            <div className="mt-4 whitespace-pre-line text-[14px] font-medium leading-7 text-slate-700 sm:text-[15px]">
              {children}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function PublicStaffProfilePage() {
const [
  consultationOpen,
  setConsultationOpen,
] =
  useState(
    false
  );

  const [, params] =
    useRoute(
      "/staff/:token"
    );

  const token =
    String(
      params?.token ||
      ""
    ).trim();

  const {
  data: publicData,
  isLoading,
  isError,
} =
  trpc.staffProfile.public.getByToken.useQuery(
      {
        token,
      },
      {
        enabled:
          Boolean(token),

        retry:
          false,
      }
    );

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          담당자 프로필을 불러오는 중입니다.
        </div>
      </div>
    );
  }

 if (
  isError ||
  !publicData ||
  !(publicData as any)?.profile
) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="w-full max-w-md rounded-[28px] border bg-white px-6 py-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
            <UserRound className="h-7 w-7 text-slate-400" />
          </div>

          <h1 className="mt-5 text-xl font-bold text-slate-950">
            프로필을 확인할 수 없습니다
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-500">
            공개되지 않은 담당자이거나
            사용할 수 없는 링크입니다.
          </p>
        </div>
      </div>
    );
  }

  const data =
  (publicData as any)
    .profile;

const branding =
  (publicData as any)
    .branding || {};

const organization =
  (publicData as any)
    .organization || {};

const organizationSlug =
  String(
    organization.slug ||
    ""
  )
    .trim()
    .toLowerCase();

const teamPageEnabled =
  organization.teamPageEnabled ===
  true;

const teamPageUrl =
  organizationSlug &&
  teamPageEnabled &&
  typeof window !==
    "undefined"
    ? `${window.location.origin}/team/${encodeURIComponent(
        organizationSlug
      )}`
    : "";

const companyName =
  String(
    branding.companyName ||
    ""
  ).trim();

const companyLogoUrl =
  normalizeImageUrl(
    branding.companyLogoUrl
  );

  const displayName =
    String(
      data.displayName ||
      "담당자"
    ).trim();

  const positionName =
    String(
      data.publicPositionName ||
      ""
    ).trim();

  const headline =
    String(
      data.headline ||
      "회원님의 상황에 맞는 학습과정을 함께 안내해드립니다."
    ).trim();

  const introduction =
    String(
      data.introduction ||
      ""
    ).trim();

  const careerText =
    String(
      data.careerText ||
      ""
    ).trim();

  const awardText =
    String(
      data.awardText ||
      ""
    ).trim();

  const qualificationText =
    String(
      data.qualificationText ||
      ""
    ).trim();

  const consultationStyle =
    String(
      data.consultationStyle ||
      ""
    ).trim();

  const publicPhone =
    String(
      data.publicPhone ||
      ""
    ).trim();

  const profileImageUrl =
    normalizeImageUrl(
      data.profileImageUrl
    );

  const specialties =
    Array.isArray(
      data.specialties
    )
      ? data.specialties
          .map(
            (item: unknown) =>
              String(
                item || ""
              ).trim()
          )
          .filter(Boolean)
      : [];

  const acceptingNewConsultations =
    data.acceptingNewConsultations !==
    false;

  const showPhone =
    Boolean(
      data.showPhone
    ) &&
    Boolean(publicPhone);

  const showConsultationButton =
  data.showConsultationButton !==
  false;

  const hasDetailedProfile =
    Boolean(
      introduction ||
        careerText ||
        awardText ||
        qualificationText ||
        consultationStyle
    );

  const callPhone = () => {
    if (!publicPhone) {
      return;
    }

    window.location.href =
      `tel:${publicPhone.replace(
        /\D/g,
        ""
      )}`;
  };

  const openConsultation =
  () => {
    if (
      !acceptingNewConsultations
    ) {
      return;
    }

    setConsultationOpen(
      true
    );
  };

  return (
  <>
    <div className="min-h-screen bg-[#f6f7f9] text-slate-950">
      {/* 상단 */}
      <header className="border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
  {companyLogoUrl ? (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-white">
      <img
        src={companyLogoUrl}
        alt={
          companyName
            ? `${companyName} 로고`
            : "회사 로고"
        }
        className="h-full w-full object-contain"
      />
    </div>
  ) : (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
      <Sparkles className="h-4 w-4" />
    </div>
  )}

  <div className="min-w-0">
    <div className="truncate text-sm font-bold tracking-tight text-slate-950">
      {companyName ||
        "담당자 소개"}
    </div>

    <div className="text-[10px] text-slate-400">
      담당자 소개
    </div>
  </div>
</div>

          <div className="hidden items-center gap-1.5 text-xs font-medium text-slate-500 sm:flex">
            <ShieldCheck className="h-4 w-4" />
            공식 담당자 프로필
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-7 sm:py-8">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[30px] bg-slate-950 text-white shadow-xl shadow-slate-950/10">
          <div className="pointer-events-none absolute -right-20 -top-28 h-80 w-80 rounded-full bg-white/[0.04]" />

          <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full border border-white/[0.06]" />

          <div className="relative grid gap-8 px-6 py-8 sm:px-9 sm:py-10 lg:grid-cols-[1fr_280px] lg:items-center lg:px-12 lg:py-12">
            <div className="order-2 lg:order-1">
              <div className="flex flex-wrap items-center gap-2">
                {acceptingNewConsultations ? (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 ring-1 ring-inset ring-emerald-300/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                    현재 신규 상담 가능
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300">
                    현재 상담 준비중
                  </div>
                )}

                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.07] px-3 py-1.5 text-xs text-slate-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  공식 담당자
                </div>
              </div>

              <div className="mt-6">
{companyName ? (
  <div className="mb-2 text-sm font-semibold text-slate-400">
    {companyName}
  </div>
) : null}
                <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
                  <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                    {displayName}
                  </h1>

                  {positionName ? (
                    <span className="pb-1 text-base font-medium text-slate-300">
                      {positionName}
                    </span>
                  ) : null}
                </div>

                <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
                  {headline}
                </p>
              </div>

              {specialties.length ? (
                <div className="mt-6 flex flex-wrap gap-2">
                  {specialties.map(
                    (
                      specialty: string,
                      index: number
                    ) => (
                      <span
  key={`${specialty}-${index}`}
  className="rounded-full border border-white/20 bg-white px-3 py-1.5 text-xs font-semibold text-slate-900 shadow-sm"
>
  {specialty}
</span>
                    )
                  )}
                </div>
              ) : null}

              {(showConsultationButton ||
                showPhone) ? (
                <div className="mt-8 flex flex-col gap-2.5 sm:flex-row">
                  {showConsultationButton ? (
                    <Button
  type="button"
  size="lg"
  disabled={
    !acceptingNewConsultations
  }
  onClick={
    openConsultation
  }
  className="h-12 rounded-xl bg-white px-6 font-bold text-slate-950 hover:bg-slate-100"
>
                      <MessageCircle className="mr-2 h-4 w-4" />
                      상담 문의하기
                    </Button>
                  ) : null}    
            </div>

            {/* 프로필 사진 */}
            <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
              <div className="relative">
                <div className="absolute -inset-3 rounded-[34px] border border-white/10" />

                <div className="relative h-52 w-52 overflow-hidden rounded-[28px] border border-white/10 bg-white/10 shadow-2xl sm:h-60 sm:w-60">
                  {profileImageUrl ? (
                    <img
                      src={
                        profileImageUrl
                      }
                      alt={`${displayName} 담당자`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center text-slate-500">
                      <UserRound className="h-20 w-20" />

                      <span className="mt-3 text-xs">
                        담당자 프로필
                      </span>
                    </div>
                  )}
                </div>

                {acceptingNewConsultations ? (
                  <div className="absolute -bottom-3 -right-3 flex h-11 w-11 items-center justify-center rounded-2xl border-4 border-slate-950 bg-emerald-400 text-slate-950 shadow-lg">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* 본문 */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            {introduction ? (
  <section className="relative overflow-hidden rounded-[28px] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-blue-100/70 shadow-sm">
    {/* CSS 장식 */}
    <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-200/30" />

    <div className="pointer-events-none absolute right-20 top-8 h-24 w-24 rotate-45 rounded-[28px] bg-blue-100/40" />

    {/* INTRO 상단 */}
    <div className="relative border-b border-blue-100/80 px-6 pb-6 pt-6 sm:px-8 sm:pb-7 sm:pt-7">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-200">
          <HeartHandshake className="h-6 w-6" />
        </div>

        <div className="min-w-0">
          <div className="text-[10px] font-black tracking-[0.12em] text-blue-500">
            INTRODUCTION
          </div>

          <h2 className="mt-1.5 text-xl font-black tracking-[-0.035em] text-slate-950 sm:text-2xl">
            안녕하세요,{" "}
            <span className="text-blue-600">
              {displayName}
            </span>
            입니다.
          </h2>

          <p className="mt-2 max-w-lg text-[13px] font-medium leading-6 text-slate-600 sm:text-sm">
            학생 한 분, 한 분의 목표를 끝까지 함께하는
            <br className="hidden sm:block" />
            학습 설계 파트너가 되겠습니다.
          </p>
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <div className="max-w-[230px] text-right">
          <div className="text-4xl font-black leading-4 text-blue-300/70">
            “
          </div>

          <div className="-mt-1 text-sm font-bold leading-6 text-slate-600">
            당신의 목표에
            <br />
            가까워지는 길,
            <br />
            함께하겠습니다.
          </div>
        </div>
      </div>
    </div>

    {/* 실제 소개글 */}
    <div className="relative m-4 rounded-[20px] border border-white/80 bg-white/80 px-5 py-5 shadow-sm backdrop-blur-sm sm:m-5 sm:px-7 sm:py-6">
      <div className="whitespace-pre-line text-[14px] font-medium leading-7 text-slate-700 sm:text-[15px] sm:leading-8">
        {introduction}
      </div>
    </div>
  </section>
) : null}

           {careerText ? (
  <ProfileSection
    icon={
      <BriefcaseBusiness className="h-5 w-5" />
    }
    title="주요 경력"
    subtitle="다년간의 경험으로 더 정확한 길을 안내합니다."
    label="EXPERIENCE"
    number="01"
    tone="blue"
  >
    {careerText}
  </ProfileSection>
) : null}

            {awardText ? (
  <ProfileSection
    icon={
      <Award className="h-5 w-5" />
    }
    title="수상 이력"
    subtitle="신뢰할 수 있는 결과와 경험입니다."
    label="AWARDS"
    number="02"
    tone="green"
  >
    {awardText}
  </ProfileSection>
) : null}

            {qualificationText ? (
  <ProfileSection
    icon={
      <GraduationCap className="h-5 w-5" />
    }
    title="자격 · 교육 이력"
    subtitle="전문성과 신뢰를 바탕으로 상담합니다."
    label="CERTIFICATION"
    number="03"
    tone="violet"
  >
    {qualificationText}
  </ProfileSection>
) : null}

            {consultationStyle ? (
  <ProfileSection
    icon={
      <HeartHandshake className="h-5 w-5" />
    }
    title="상담 스타일"
    subtitle="복잡한 내용도 쉽게, 중요한 내용은 정확하게 안내합니다."
    label="CONSULTING STYLE"
    number="04"
    tone="cyan"
  >
    {consultationStyle}

    <div className="mt-5 flex items-start gap-3 rounded-2xl border border-white/70 bg-white/60 px-4 py-3.5 backdrop-blur-sm">
      <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600" />

      <p className="text-[12px] font-bold leading-5 text-slate-700 sm:text-[13px]">
        등록으로 끝나는 상담이 아닌,
        학습설계부터 자격증 취득까지 끝까지 관리하는 상담을 지향합니다.
      </p>
    </div>
  </ProfileSection>
) : null}
            {!hasDetailedProfile ? (
              <section className="rounded-[24px] border border-slate-200/80 bg-white p-8 text-center shadow-sm">
                <Sparkles className="mx-auto h-6 w-6 text-slate-400" />

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  상세 소개는 준비 중입니다.
                </p>
              </section>
            ) : null}
          </div>

          {/* 우측 상담 카드 */}
          <aside className="lg:sticky lg:top-5 lg:self-start">
            <div className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white shadow-sm">
              <div className="border-b bg-slate-50 px-5 py-4">
                <div className="text-sm font-bold text-slate-950">
                  상담 안내
                </div>

                <div className="mt-1 text-xs leading-5 text-slate-500">
                  궁금한 내용을 담당자에게
                  직접 문의해보세요.
                </div>
              </div>

              <div className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 overflow-hidden rounded-xl bg-slate-100">
                    {profileImageUrl ? (
                      <img
                        src={
                          profileImageUrl
                        }
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <UserRound className="h-6 w-6 text-slate-400" />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="truncate font-bold text-slate-950">
                      {displayName}
                      {positionName
                        ? ` ${positionName}`
                        : ""}
                    </div>

                    <div className="mt-0.5 text-xs text-slate-500">
                      {acceptingNewConsultations
                        ? "현재 상담 가능합니다."
                        : "현재 신규상담 준비중입니다."}
                    </div>
                  </div>
                </div>

                {specialties.length ? (
                  <div className="mt-5">
                    <div className="mb-2 text-xs font-semibold text-slate-500">
                      전문 상담 분야
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {specialties
                        .slice(
                          0,
                          8
                        )
                        .map(
                          (
                            specialty: string,
                            index: number
                          ) => (
                            <Badge
  key={`${specialty}-${index}`}
  variant="outline"
  className="rounded-full border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700"
>
  {specialty}
</Badge>
                          )
                        )}
                    </div>
                  </div>
                ) : null}

                {(showConsultationButton ||
                  showPhone) ? (
                    <div className="mt-6 grid gap-2">
                      {showConsultationButton ? (
                        <Button
  type="button"
  className="h-11 w-full rounded-xl"
  disabled={
    !acceptingNewConsultations
  }
  onClick={
    openConsultation
  }
>
                          <MessageCircle className="mr-2 h-4 w-4" />
                          상담 문의하기
                        </Button>
                      ) : null}

                      {showPhone ? (
                        <Button
  type="button"
  variant="outline"
  className="h-11 w-full rounded-xl border-slate-300 bg-white font-semibold text-slate-800 hover:bg-slate-50"
  onClick={callPhone}
>
  <Phone className="mr-2 h-4 w-4" />
  전화 상담
</Button>
                      ) : null}
                    </div>
                  ) : null}

                <div className="mt-5 rounded-xl bg-slate-50 px-4 py-3">
                  <div className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />

                    <p className="text-[11px] leading-5 text-slate-500">
                      담당자가 직접 공개한
                      프로필 및 상담 정보입니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>

{teamPageUrl ? (
  <section className="mt-6 overflow-hidden rounded-[24px] border border-blue-200 bg-gradient-to-r from-blue-50 via-white to-blue-100/80 shadow-sm">
    <div className="flex flex-col gap-5 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
          <UserRound className="h-6 w-6" />
        </div>

        <div>
          <div className="text-base font-black tracking-tight text-slate-950">
            더 많은 전문가와 함께하세요
          </div>

          <div className="mt-1 text-xs leading-5 text-slate-500">
            {companyName || "교육기관"}의 다른 학습담당자들도 만나보세요.
          </div>
        </div>
      </div>

      <Button
        type="button"
        onClick={() => {
          window.location.href =
            teamPageUrl;
        }}
        className="h-12 shrink-0 rounded-xl bg-blue-600 px-7 font-bold text-white hover:bg-blue-700"
      >
        다른 담당자 보기
        <span className="ml-2">
          →
        </span>
      </Button>
    </div>
  </section>
) : null}

        <footer className="py-10 text-center">
          <div className="inline-flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            안전한 담당자 공개 프로필
          </div>
        </footer>
            </main>
    </div>

    <PublicStaffConsultationModal
  open={
    consultationOpen
  }
  onClose={() => {
    setConsultationOpen(
      false
    );
  }}
  profile={
    data
  }
  teamPageUrl={
    teamPageUrl ||
    null
  }
/>
  </>
);
}