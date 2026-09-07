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
      edge: "bg-blue-500",
      icon: "bg-blue-600 text-white",
      label: "text-blue-500",
      number: "text-blue-100",
    },
    green: {
      edge: "bg-emerald-500",
      icon: "bg-emerald-500 text-white",
      label: "text-emerald-500",
      number: "text-emerald-100",
    },
    violet: {
      edge: "bg-violet-500",
      icon: "bg-violet-500 text-white",
      label: "text-violet-500",
      number: "text-violet-100",
    },
    cyan: {
      edge: "bg-cyan-500",
      icon: "bg-cyan-500 text-white",
      label: "text-cyan-500",
      number: "text-cyan-100",
    },
  } as const;

  const currentTone = toneStyles[tone];

  return (
    <section className="group relative overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.04)]">
      <div className={`absolute inset-y-0 left-0 w-[3px] ${currentTone.edge}`} />

      {number ? (
        <div
          className={`pointer-events-none absolute bottom-3 right-5 z-0 select-none text-[64px] font-black leading-none tracking-[-0.07em] sm:bottom-2 sm:right-7 sm:text-[76px] ${currentTone.number}`}
        >
          {number}
        </div>
      ) : null}

      <div className="relative z-10 flex items-start gap-4 px-5 py-5 pr-[86px] sm:px-6 sm:py-6 sm:pr-[118px]">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] shadow-[0_8px_20px_rgba(15,23,42,0.10)] ${currentTone.icon}`}>
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[18px] font-extrabold tracking-[-0.03em] text-[#10213f] sm:text-[20px]">
                {title}
              </h2>

              {subtitle ? (
                <p className="mt-0.5 text-[11px] font-medium leading-5 text-slate-500 sm:text-[12px]">
                  {subtitle}
                </p>
              ) : null}
            </div>

            {label ? (
              <div className={`hidden shrink-0 pt-1 text-[9px] font-extrabold tracking-[0.05em] sm:block ${currentTone.label}`}>
                {label}
              </div>
            ) : null}
          </div>

          <div className="mt-3 whitespace-pre-line text-[12px] font-medium leading-6 text-slate-700 sm:text-[13px] sm:leading-7">
            {children}
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
    <div
      className="min-h-screen bg-[#f5f7fb] text-slate-950"
      style={{ fontFamily: 'Pretendard, "Noto Sans KR", sans-serif' }}
    >
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="mx-auto grid h-[70px] max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            {companyLogoUrl ? (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                <img
                  src={companyLogoUrl}
                  alt={companyName ? `${companyName} 로고` : "회사 로고"}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <Sparkles className="h-4 w-4" />
              </div>
            )}

            <div className="min-w-0">
              <div className="truncate text-[15px] font-extrabold tracking-[-0.025em] text-[#10213f]">
                {companyName || "담당자 소개"}
              </div>
              <div className="mt-0.5 truncate text-[10px] font-medium text-slate-400">
                함께 만드는 더 나은 내일
              </div>
            </div>
          </div>

          <div className="hidden h-full items-center md:flex">
            <div className="relative flex h-full items-center px-5 text-[13px] font-bold text-blue-600">
              담당자 소개
              <span className="absolute inset-x-0 bottom-0 h-[2px] bg-blue-600" />
            </div>
          </div>

          <div className="flex justify-end">
            {showConsultationButton ? (
              <Button
                type="button"
                disabled={!acceptingNewConsultations}
                onClick={openConsultation}
                className="h-10 rounded-[10px] bg-blue-600 px-4 text-[11px] font-bold text-white shadow-[0_8px_20px_rgba(37,99,235,0.20)] hover:bg-blue-700 sm:h-11 sm:px-5 sm:text-[12px]"
              >
                <MessageCircle className="mr-1.5 h-4 w-4" />
                상담 신청하기
              </Button>
            ) : (
              <div />
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5 sm:px-7 sm:py-7">
        {/* HERO */}
        <section className="relative overflow-hidden rounded-[24px] bg-[#020817] text-white shadow-[0_18px_42px_rgba(15,23,42,0.12)]">
  {/* 배경 장식 */}
  <div className="pointer-events-none absolute -right-20 -top-24 h-[320px] w-[320px] rounded-full bg-blue-500/[0.055]" />
  <div className="pointer-events-none absolute -bottom-36 left-[34%] h-[300px] w-[300px] rounded-full border border-white/[0.045]" />

  <div className="relative grid gap-6 px-5 py-6 sm:px-8 sm:py-7 lg:grid-cols-[minmax(0,1fr)_250px] lg:items-center lg:px-9 lg:py-8">
    {/* LEFT */}
    <div className="order-2 min-w-0 lg:order-1">
      <div className="flex flex-wrap items-center gap-2">
        {acceptingNewConsultations ? (
  <div className="inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3.5 text-[11px] font-extrabold tracking-[-0.02em] text-emerald-500 shadow-sm">
    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
    현재 신규 상담 가능
  </div>
) : (
  <div className="inline-flex h-8 items-center gap-1.5 rounded-full border border-amber-200 bg-white px-3.5 text-[11px] font-extrabold tracking-[-0.02em] text-amber-500 shadow-sm">
    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
    현재 상담 준비중
  </div>
)}

<div className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 text-[11px] font-bold tracking-[-0.02em] text-slate-500 shadow-sm">
  <ShieldCheck className="h-3.5 w-3.5 text-slate-400" />
  공식 담당자
</div>
      </div>

      {companyName ? (
        <div className="mt-5 text-[11px] font-semibold tracking-[-0.01em] text-blue-200/80">
          {companyName}
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
        <h1 className="text-[34px] font-extrabold leading-none tracking-[-0.035em] text-white sm:text-[38px]">
          {displayName}
        </h1>

        {positionName ? (
          <span className="pb-1 text-[13px] font-semibold tracking-[-0.01em] text-slate-300 sm:text-[14px]">
            {positionName}
          </span>
        ) : null}
      </div>

      <p className="mt-4 max-w-[620px] text-[14px] font-medium leading-[1.75] tracking-[-0.015em] text-slate-300 sm:text-[15px]">
        {headline}
      </p>

      {specialties.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {specialties.map((specialty: string, index: number) => (
            <span
              key={`${specialty}-${index}`}
              className="rounded-[9px] border border-white/15 bg-white/[0.08] px-3 py-1.5 text-[10px] font-semibold tracking-[-0.01em] text-white"
            >
              {specialty}
            </span>
          ))}
        </div>
      ) : null}

      {showConsultationButton ? (
        <div className="mt-5">
          <Button
            type="button"
            disabled={!acceptingNewConsultations}
            onClick={openConsultation}
            className="h-10 rounded-[10px] bg-white px-5 text-[11px] font-bold tracking-[-0.01em] text-slate-950 hover:bg-slate-100"
          >
            <MessageCircle className="mr-2 h-4 w-4" />
            상담 문의하기
          </Button>
        </div>
      ) : null}
    </div>

    {/* RIGHT PROFILE IMAGE */}
    <div className="order-1 flex justify-center lg:order-2 lg:justify-end">
      <div className="relative">
        <div className="absolute -inset-2 rounded-[26px] border border-white/10" />

        <div className="relative h-[205px] w-[205px] overflow-hidden rounded-[22px] border-[9px] border-white bg-white shadow-[0_18px_45px_rgba(0,0,0,0.28)] sm:h-[220px] sm:w-[220px]">
          {profileImageUrl ? (
            <img
              src={profileImageUrl}
              alt={`${displayName} 담당자`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center bg-slate-100 text-slate-400">
              <UserRound className="h-14 w-14" />
              <span className="mt-2 text-xs">담당자 프로필</span>
            </div>
          )}
        </div>

        {acceptingNewConsultations ? (
          <div className="absolute -bottom-2 -right-2 flex h-10 w-10 items-center justify-center rounded-[14px] border-4 border-[#020817] bg-emerald-400 text-[#020817] shadow-lg">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </div>
  </div>
</section>

        {/* MAIN CONTENT */}
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="space-y-4">
            {introduction ? (
              <section className="relative overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.045)]">
                <div className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full bg-blue-100/45" />
                <div className="pointer-events-none absolute right-10 top-4 h-24 w-24 rotate-45 rounded-[28px] bg-blue-50/90" />

                <div className="relative border-b border-slate-100 px-5 py-5 sm:px-6">
                  <div className="flex items-start gap-3.5">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-blue-600 text-white shadow-[0_8px_20px_rgba(37,99,235,0.18)]">
                      <HeartHandshake className="h-5 w-5" />
                    </div>

                    <div className="min-w-0 flex-1 pr-[92px] sm:pr-[150px]">
                      <div className="text-[9px] font-extrabold tracking-[0.12em] text-blue-500">
                        INTRODUCTION
                      </div>

                      <h2 className="mt-1.5 text-[20px] font-extrabold tracking-[-0.035em] text-[#10213f] sm:text-[24px]">
                        안녕하세요,{" "}
                        <span className="text-blue-600">
                          {displayName}
                        </span>
                        입니다.
                      </h2>

                      <p className="mt-2 text-[12px] font-medium leading-6 text-slate-600 sm:text-[13px]">
                        학생 한 분, 한 분의 목표를 끝까지 함께하는
                        <br className="hidden sm:block" />
                        학습 설계 파트너가 되겠습니다.
                      </p>
                    </div>
                  </div>

                  <div className="absolute right-5 top-5 hidden max-w-[145px] text-right sm:block">
                    <div className="text-4xl font-black leading-4 text-blue-100">“</div>
                    <div className="-mt-1 text-[12px] font-bold leading-5 text-slate-600">
                      당신의 목표에
                      <br />
                      가까워지는 길,
                      <br />
                      함께하겠습니다.
                    </div>
                  </div>
                </div>

                <div className="relative px-5 py-5 sm:px-6 sm:py-6">
                  <div className="whitespace-pre-line text-[13px] font-medium leading-7 text-slate-700 sm:text-[14px] sm:leading-8">
                    {introduction}
                  </div>
                </div>
              </section>
            ) : null}

            {careerText ? (
              <ProfileSection
                icon={<BriefcaseBusiness className="h-5 w-5" />}
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
                icon={<Award className="h-5 w-5" />}
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
                icon={<GraduationCap className="h-5 w-5" />}
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
                icon={<HeartHandshake className="h-5 w-5" />}
                title="상담 스타일"
                subtitle="복잡한 내용도 쉽게, 중요한 내용은 정확하게 안내합니다."
                label="CONSULTING STYLE"
                number="04"
                tone="cyan"
              >
                {consultationStyle}

                <div className="mt-4 flex items-start gap-3 rounded-[14px] border border-cyan-100 bg-cyan-50/55 px-4 py-3">
                  <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-cyan-600" />

                  <p className="text-[11px] font-bold leading-5 text-slate-700 sm:text-[12px]">
                    등록으로 끝나는 상담이 아닌,
                    학습설계부터 자격증 취득까지 끝까지 관리하는 상담을 지향합니다.
                  </p>
                </div>
              </ProfileSection>
            ) : null}

            {!hasDetailedProfile ? (
              <section className="rounded-[22px] border border-slate-200 bg-white p-8 text-center shadow-sm">
                <Sparkles className="mx-auto h-6 w-6 text-slate-400" />
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  상세 소개는 준비 중입니다.
                </p>
              </section>
            ) : null}
          </div>

          {/* RIGHT CONSULTATION CARD */}
          <aside className="lg:sticky lg:top-[88px] lg:self-start">
            <div className="overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_8px_28px_rgba(15,23,42,0.045)]">
              <div className="border-b border-slate-100 px-5 py-4">
                <div className="text-[14px] font-extrabold tracking-[-0.02em] text-[#10213f]">
                  담당자 정보
                </div>
                <div className="mt-3 h-[2px] w-14 rounded-full bg-emerald-400" />
              </div>

              <div className="p-5">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-slate-100">
                    {profileImageUrl ? (
                      <img
                        src={profileImageUrl}
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
                    <div className="truncate text-[14px] font-extrabold text-[#10213f]">
                      {displayName}
                      {positionName ? ` ${positionName}` : ""}
                    </div>
                    {companyName ? (
                      <div className="mt-0.5 truncate text-[11px] text-slate-500">
                        {companyName}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="mt-5 space-y-4 border-t border-slate-100 pt-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 text-slate-500">
                      <UserRound className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-slate-500">상담 가능 여부</div>
                      <div className={`mt-1 flex items-center gap-1.5 text-[12px] font-bold ${acceptingNewConsultations ? "text-emerald-600" : "text-amber-600"}`}>
                        <span className={`h-2 w-2 rounded-full ${acceptingNewConsultations ? "bg-emerald-500" : "bg-amber-500"}`} />
                        {acceptingNewConsultations ? "상담 가능" : "상담 준비중"}
                      </div>
                    </div>
                  </div>

                  {specialties.length ? (
                    <div>
                      <div className="mb-2 text-[10px] font-bold text-slate-500">
                        전문 상담 분야
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {specialties.slice(0, 8).map((specialty: string, index: number) => (
                          <Badge
                            key={`${specialty}-${index}`}
                            variant="outline"
                            className="rounded-full border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-medium text-slate-700"
                          >
                            {specialty}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                {(showConsultationButton || showPhone) ? (
                  <div className="mt-5 grid gap-2">
                    {showConsultationButton ? (
                      <Button
                        type="button"
                        disabled={!acceptingNewConsultations}
                        onClick={openConsultation}
                        className="h-11 w-full rounded-[10px] bg-blue-600 text-[12px] font-bold text-white hover:bg-blue-700"
                      >
                        <MessageCircle className="mr-2 h-4 w-4" />
                        상담 신청하기
                      </Button>
                    ) : null}

                    {showPhone ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-full rounded-[10px] border-slate-300 bg-white text-[12px] font-semibold text-slate-800 hover:bg-slate-50"
                        onClick={callPhone}
                      >
                        <Phone className="mr-2 h-4 w-4" />
                        전화 상담
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4 rounded-[12px] border border-slate-100 bg-slate-50 px-4 py-3">
                  <div className="flex gap-2">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                    <p className="text-[10px] leading-5 text-slate-500">
                      담당자가 직접 공개한 프로필 및 상담 정보입니다.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {teamPageUrl ? (
          <section className="mt-5 overflow-hidden rounded-[18px] border border-blue-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <UserRound className="h-5 w-5" />
                </div>

                <div>
                  <div className="text-[14px] font-extrabold tracking-[-0.02em] text-[#10213f]">
                    더 많은 전문가와 함께하세요
                  </div>
                  <div className="mt-1 text-[11px] leading-5 text-slate-500">
                    {companyName || "교육기관"}의 다른 학습담당자들도 만나보세요.
                  </div>
                </div>
              </div>

              <Button
                type="button"
                onClick={() => {
                  window.location.href = teamPageUrl;
                }}
                className="h-10 shrink-0 rounded-[10px] bg-blue-600 px-5 text-[11px] font-bold text-white hover:bg-blue-700"
              >
                다른 담당자 보기
                <span className="ml-2">→</span>
              </Button>
            </div>
          </section>
        ) : null}

        <footer className="py-7 text-center">
          <div className="inline-flex items-center gap-1.5 text-[10px] text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5" />
            안전한 담당자 공개 프로필
          </div>
        </footer>
      </main>
    </div>

    <PublicStaffConsultationModal
      open={consultationOpen}
      onClose={() => {
        setConsultationOpen(false);
      }}
      profile={data}
      teamPageUrl={teamPageUrl || null}
    />
  </>
);
}