import {
  CheckCircle2,
  ChevronRight,
  Heart,
  Loader2,
  LogIn,
  Search,
  Send,
  ShieldCheck,
  Target,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import PublicStaffConsultationModal from "@/components/public/PublicStaffConsultationModal";

function normalizeImageUrl(raw?: string | null) {
  if (!raw) return "";
  const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("data:")) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (!API_BASE_URL) return raw;
  return raw.startsWith("/") ? `${API_BASE_URL}${raw}` : `${API_BASE_URL}/${raw}`;
}

function normalizeSpecialties(profile: any): string[] {
  if (!Array.isArray(profile?.specialties)) return [];
  return profile.specialties.map((item: unknown) => String(item || "").trim()).filter(Boolean);
}

function ConsultationStatus({ accepting }: { accepting: boolean }) {
  return accepting ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
      <CheckCircle2 className="h-3.5 w-3.5" /> 상담 가능
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
      상담 대기중
    </span>
  );
}

function StaffCard({ profile, onConsultation }: { profile: any; onConsultation: (profile: any) => void }) {
  const displayName = String(profile?.displayName || "담당자").trim();
  const positionName = String(profile?.publicPositionName || "").trim();
  const headline = String(profile?.headline || "회원님의 상황에 맞는 과정을 안내해드립니다.").trim();
  const imageUrl = normalizeImageUrl(profile?.profileImageUrl);
  const publicToken = String(profile?.publicToken || "").trim();
  const specialties = normalizeSpecialties(profile);
  const acceptingNewConsultations = profile?.acceptingNewConsultations !== false;

  const openProfile = () => {
    if (!publicToken) return;
    window.location.href = `/staff/${encodeURIComponent(publicToken)}`;
  };

  const openConsultation = () => {
    if (!publicToken || !acceptingNewConsultations) return;
    onConsultation(profile);
  };

  return (
    <article className="group overflow-hidden rounded-[18px] border border-slate-200/80 bg-white shadow-[0_8px_26px_rgba(15,23,42,0.045)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(15,23,42,0.08)]">
      <div className="relative h-[180px] overflow-hidden bg-slate-100 sm:h-[205px]">
        {imageUrl ? (
          <img src={imageUrl} alt={`${displayName} 담당자`} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.015]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-slate-300"><UserRound className="h-12 w-12" /></div>
        )}
        <div className="absolute left-3 top-3"><ConsultationStatus accepting={acceptingNewConsultations} /></div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex items-end gap-2">
          <h3 className="text-[19px] font-extrabold tracking-[-0.035em] text-[#0b1b3f]">{displayName}</h3>
          {positionName ? <span className="mb-[2px] truncate text-[11px] font-semibold text-slate-500">{positionName}</span> : null}
        </div>

        <p className="mt-2 line-clamp-2 min-h-[44px] text-[12px] leading-[22px] text-slate-500">“{headline}”</p>

        <div className="mt-3 flex min-h-6 flex-wrap gap-1.5">
          {specialties.slice(0, 2).map((specialty: string, index: number) => (
            <Badge key={`${specialty}-${index}`} variant="outline" className="h-6 rounded-full border-slate-200 bg-[#f8fafc] px-2.5 text-[10px] font-semibold text-slate-700">
              {specialty}
            </Badge>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" disabled={!publicToken} onClick={openProfile} className="h-10 rounded-[9px] border-blue-500 text-[11px] font-bold text-blue-600 hover:bg-blue-50 hover:text-blue-700">
            프로필 보기
          </Button>
          <Button type="button" disabled={!publicToken || !acceptingNewConsultations} onClick={openConsultation} className="h-10 rounded-[9px] bg-blue-600 text-[11px] font-bold text-white hover:bg-blue-700">
            <Send className="mr-1.5 h-3.5 w-3.5" /> 상담 신청하기
          </Button>
        </div>
      </div>
    </article>
  );
}

function FeatureItem({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-blue-100 bg-white/85 text-blue-600 shadow-sm">{icon}</div>
      <div>
        <div className="text-[12px] font-bold tracking-[-0.015em] text-[#10213f]">{title}</div>
        <div className="mt-0.5 text-[10px] font-medium leading-5 text-slate-500">{description}</div>
      </div>
    </div>
  );
}

export default function PublicStaffTeamPage() {
  const [, params] = useRoute("/team/:slug");
  const slug = String(params?.slug || "").trim().toLowerCase();
  const teamPageUrl = slug && typeof window !== "undefined" ? `${window.location.origin}/team/${encodeURIComponent(slug)}` : "";

  const [selectedSpecialty, setSelectedSpecialty] = useState("전체");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [consultationProfile, setConsultationProfile] = useState<any | null>(null);
  const [selectedManagement, setSelectedManagement] = useState("consultation");

  const managementItems = [
    { key: "consultation", number: "01", title: "상담 관리", shortTitle: "상담", description: "신규 상담부터 등록까지 모든 상담 내용을 기록하고 관리합니다.", image: "/images/management/management-consultation.png" },
    { key: "learning", number: "02", title: "학습 관리", shortTitle: "학습", description: "수강 현황부터 과제, 시험, 성적까지 학습 진행상황을 확인합니다.", image: "/images/management/management-learning.png" },
    { key: "practicum", number: "03", title: "실습 지원", shortTitle: "실습", description: "실습기관 확인부터 배정과 진행상황까지 체계적으로 지원합니다.", image: "/images/management/management-practicum.png" },
    { key: "administration", number: "04", title: "행정 관리", shortTitle: "행정", description: "학습자등록, 학점인정, 학위신청 등 중요한 행정 일정을 관리합니다.", image: "/images/management/management-administration.png" },
    { key: "certificate", number: "05", title: "자격증 취득", shortTitle: "자격증", description: "과정 이수 이후 자격증 신청과 발급 단계까지 확인합니다.", image: "/images/management/management-certificate.png" },
  ];

  const activeManagement = managementItems.find((item) => item.key === selectedManagement) || managementItems[0];
  const { data, isLoading, isError } = trpc.staffProfile.public.companyTeamPage.useQuery({ slug }, { enabled: slug.length > 0, retry: false });

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f5f8ff]"><div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" />담당자 소개 페이지를 불러오는 중입니다.</div></div>;
  }

  if (isError || !data) {
    return <div className="flex min-h-screen items-center justify-center bg-[#f5f8ff] px-5"><div className="w-full max-w-md rounded-[28px] border bg-white px-6 py-10 text-center shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100"><UsersRound className="h-7 w-7 text-slate-400" /></div><h1 className="mt-5 text-xl font-bold text-slate-950">페이지를 확인할 수 없습니다</h1><p className="mt-3 text-sm leading-6 text-slate-500">공개되지 않은 회사 담당자 페이지이거나 사용할 수 없는 링크입니다.</p></div></div>;
  }

  const publicData = data as any;
  const branding = publicData.branding || {};
  const settings = publicData.settings || {};
  const profiles = Array.isArray(publicData.profiles) ? publicData.profiles : [];
  const companyName = String(branding.companyName || "").trim();
  const companyLogoUrl = normalizeImageUrl(branding.companyLogoUrl);
  const pageTitle = String(settings.title || "").trim() || "당신의 배움 여정에\n함께하는 학습담당자를 만나보세요.";
  const description = String(settings.description || "").trim() || "과정과 상황에 맞는 담당자를 확인하고,\n지금 바로 1:1 상담을 신청할 수 있습니다.";

  const specialtyCountMap = new Map<string, number>();
  profiles.forEach((profile: any) => normalizeSpecialties(profile).forEach((specialty: string) => specialtyCountMap.set(specialty, (specialtyCountMap.get(specialty) || 0) + 1)));
  const specialtyOptions = Array.from(specialtyCountMap.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "ko"));

  const keyword = searchKeyword.trim().toLowerCase();
  const filteredProfiles = profiles.filter((profile: any) => {
    const specialties = normalizeSpecialties(profile);
    const matchesSpecialty = selectedSpecialty === "전체" || specialties.includes(selectedSpecialty);
    const haystack = [profile?.displayName, profile?.publicPositionName, profile?.headline, ...specialties]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    return matchesSpecialty && (!keyword || haystack.includes(keyword));
  });

  const scrollToStaff = () => document.getElementById("staff-list")?.scrollIntoView({ behavior: "smooth", block: "start" });

const openStudentPortal = () => {
  if (!slug) return;

  window.location.href =
    `/portal/${encodeURIComponent(slug)}`;
};

  return (
    <>
      <div className="min-h-screen bg-white text-slate-950" style={{ fontFamily: 'Pretendard, "Noto Sans KR", sans-serif' }}>
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/95 backdrop-blur">
          <div className="mx-auto flex h-[72px] max-w-[1180px] items-center justify-between px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
  <button
    type="button"
    onClick={openStudentPortal}
    className="group flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-blue-100 bg-blue-50 px-3 text-[11px] font-extrabold text-blue-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-100 sm:h-11 sm:px-4 sm:text-[12px]"
    aria-label="업무포탈로 이동"
  >
    <LogIn className="h-4 w-4" />
    <span>업무포탈</span>
  </button>

  {companyLogoUrl ? (
    <img
      src={companyLogoUrl}
      alt={companyName || "회사 로고"}
      className="h-10 w-10 rounded-full border border-slate-200 object-contain"
    />
  ) : (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
      <UsersRound className="h-5 w-5" />
    </div>
  )}

  <div className="min-w-0">
    <div className="truncate text-[15px] font-extrabold tracking-[-0.03em] text-[#0b1b3f]">
      {companyName || "담당자 소개"}
    </div>

    <div className="mt-0.5 hidden text-[10px] text-slate-400 sm:block">
      함께 만드는 더 나은 내일
    </div>
  </div>
</div>
            <button type="button" onClick={scrollToStaff} className="relative hidden h-[72px] items-center text-[13px] font-bold text-blue-600 md:flex">담당자 소개<span className="absolute inset-x-0 bottom-0 h-[2px] bg-blue-600" /></button>
            <Button type="button" onClick={scrollToStaff} className="hidden h-11 rounded-[10px] bg-blue-600 px-5 text-[12px] font-bold text-white hover:bg-blue-700 sm:inline-flex"><Send className="mr-2 h-4 w-4" />담당자 선택하기</Button>
            <button type="button" onClick={scrollToStaff} className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 sm:hidden" aria-label="담당자 목록 보기"><UsersRound className="h-5 w-5" /></button>
          </div>
        </header>

        <main>
          <section className="relative overflow-hidden border-b border-blue-100/70 bg-[#f4f9ff]">
  {/* HERO PHOTO */}
  <div className="pointer-events-none absolute right-0 top-0 hidden h-full w-[44%] lg:block">
    <img
      src="/images/team/team-hero-learning-space.png"
      alt=""
      className="h-full w-full object-cover object-center"
    />

    <div className="absolute inset-0 bg-gradient-to-r from-[#edf6ff] via-[#edf6ff]/55 to-transparent" />

    <div className="absolute left-[10%] top-[24%] -rotate-[4deg] text-[#174f9e]">
      <div
        className="text-[24px] font-medium leading-[1.55]"
        style={{
          fontFamily: '"Nanum Pen Script", cursive',
        }}
      >
        배움이
        <br />
        더 나은 내일을 만듭니다.
      </div>

      <div className="ml-6 mt-1 h-[2px] w-[170px] -rotate-[3deg] bg-blue-500/80" />
    </div>
  </div>

  {/* LEFT GRADIENT */}
  <div className="absolute inset-0 bg-gradient-to-r from-[#f8fbff] via-[#eef7ff]/96 to-transparent" />

  <div className="relative mx-auto max-w-[1180px] px-4 py-10 sm:px-6 sm:py-12 lg:py-14">
    <div className="max-w-[760px]">
      <div className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.14em] text-blue-600">
        OUR TEAM
      </div>

      <h1 className="max-w-[760px] text-[32px] font-extrabold leading-[1.22] tracking-[-0.04em] text-[#10213f] sm:text-[40px] lg:text-[44px]">
        당신의 배움 여정에 함께하는
        <br className="hidden sm:block" />
        <span className="text-blue-600">
          학습담당자
        </span>
        를 만나보세요.
      </h1>

      <p className="mt-4 max-w-xl whitespace-pre-line text-[13px] font-medium leading-7 tracking-[-0.01em] text-slate-600 sm:text-[14px]">
        {description}
      </p>

      <div className="mt-7 grid gap-4 sm:grid-cols-3 sm:gap-5">
        <FeatureItem
          icon={<UsersRound className="h-5 w-5" />}
          title="전문 분야별 상담"
          description="과정별 전문 담당자 배정"
        />

        <FeatureItem
          icon={<Heart className="h-5 w-5" />}
          title="1:1 맞춤 설계"
          description="개인 상황에 맞는 학습 설계"
        />

        <FeatureItem
          icon={<Target className="h-5 w-5" />}
          title="취득까지 책임 관리"
          description="상담부터 학습·행정까지"
        />
      </div>
    </div>
  </div>
</section>

          <section id="staff-list" className="scroll-mt-24 bg-white">
            <div className="mx-auto max-w-[1180px] px-4 py-7 sm:px-6 sm:py-9">
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={searchKeyword} onChange={(event) => setSearchKeyword(event.target.value)} placeholder="담당자 이름 또는 전문분야를 검색해보세요." className="h-12 w-full rounded-full border border-slate-200 bg-white pl-11 pr-4 text-[12px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></div>
                <div className="flex h-12 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-[11px] font-bold text-blue-600">필터</div>
                <div className="flex h-12 items-center justify-center px-2 text-[11px] font-semibold text-slate-600">최신 등록순 <ChevronRight className="ml-1 h-3.5 w-3.5 rotate-90" /></div>
              </div>

              <div className="mt-3 -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0"><div className="flex min-w-max gap-2">
                <button type="button" onClick={() => setSelectedSpecialty("전체")} className={`rounded-full border px-4 py-2 text-[11px] font-bold transition ${selectedSpecialty === "전체" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-600"}`}>전체 ({profiles.length})</button>
                {specialtyOptions.map(([specialty, count]) => <button key={specialty} type="button" onClick={() => setSelectedSpecialty(specialty)} className={`rounded-full border px-4 py-2 text-[11px] font-bold transition ${selectedSpecialty === specialty ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:text-blue-600"}`}>{specialty} ({count})</button>)}
              </div></div>

              {filteredProfiles.length ? <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:gap-4">{filteredProfiles.map((profile: any, index: number) => <StaffCard key={profile?.publicToken || index} profile={profile} onConsultation={setConsultationProfile} />)}</div> : <div className="mt-8 rounded-[22px] border border-slate-200 bg-slate-50 p-10 text-center"><UserRound className="mx-auto h-8 w-8 text-slate-300" /><div className="mt-4 font-bold text-slate-900">조건에 맞는 공개 담당자가 없습니다</div><div className="mt-2 text-sm text-slate-500">검색어 또는 전문분야를 변경해 확인해주세요.</div></div>}
            </div>
          </section>

          <section className="border-y border-blue-100 bg-gradient-to-br from-[#eef8ff] via-[#f8fbff] to-[#e8f4ff]">
            <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 sm:py-12">
              <div className="grid gap-6 lg:grid-cols-[360px_1fr] lg:items-stretch">
                <div className="flex flex-col">
                  <div className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-blue-600">CARE MANAGEMENT SYSTEM</div>
                  <h2 className="mt-3 text-[29px] font-extrabold leading-[1.2] tracking-[-0.045em] text-[#0b1b3f] sm:text-[34px]">담당자가 바뀌어도<br />과정은 안전하게 이어집니다.</h2>
                  <p className="mt-3 text-[12px] leading-6 text-slate-600">상담부터 학습, 실습, 행정, 자격증 취득까지<br className="hidden sm:block" /> 모든 과정이 체계적으로 관리되어<br className="hidden sm:block" /> 언제나 같은 기준의 서비스로 진행됩니다.</p>

                  <div className="mt-5 grid grid-cols-5 gap-1 rounded-[16px] bg-white p-2 shadow-sm ring-1 ring-blue-100">
                    {managementItems.map((item, index) => {
                      const active = selectedManagement === item.key;
                      return <button key={item.key} type="button" onClick={() => setSelectedManagement(item.key)} className={`relative flex min-w-0 flex-col items-center rounded-[12px] px-1 py-2.5 transition ${active ? "bg-blue-600 text-white" : "text-slate-700 hover:bg-blue-50"}`}><div className={`flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-extrabold ${active ? "bg-white/15" : "bg-blue-50 text-blue-600"}`}>{item.number}</div><span className="mt-1.5 text-[9px] font-bold">{item.shortTitle}</span>{index < managementItems.length - 1 ? <ChevronRight className="absolute -right-[6px] top-[22px] z-10 hidden h-3 w-3 text-blue-300 sm:block" /> : null}</button>;
                    })}
                  </div>

                  <div className="mt-4 rounded-[16px] bg-white p-4 shadow-sm ring-1 ring-blue-100">
                    <div className="flex items-start gap-3"><div className="mt-0.5 text-[24px] font-light leading-none text-blue-600">!</div><div><div className="text-[15px] font-extrabold tracking-[-0.03em] text-[#0b1b3f]">{activeManagement.number}. {activeManagement.title}부터 시작합니다.</div><p className="mt-1 text-[11px] leading-5 text-slate-500">{activeManagement.description}</p></div></div>
                    <div className="mt-3 space-y-1.5 text-[11px] font-semibold text-slate-600"><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-blue-600" />개인 상황에 맞는 과정 관리</div><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-blue-600" />중요 일정과 진행상황 확인</div><div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-blue-600" />담당자가 지속적인 1:1 관리</div></div>
                  </div>
                </div>

                <div className="rounded-[20px] bg-white p-3 shadow-[0_14px_40px_rgba(15,23,42,0.06)] ring-1 ring-slate-200/80 sm:p-4">
                  <div className="overflow-hidden rounded-[14px] bg-[#eef3f8]"><img src={activeManagement.image} alt={`${activeManagement.title} 관리 화면`} className="block aspect-[16/9] w-full object-contain" /></div>
                  <div className="mt-3 grid grid-cols-5 gap-2">
                    {managementItems.map((item) => {
                      const active = selectedManagement === item.key;
                      return <button key={item.key} type="button" onClick={() => setSelectedManagement(item.key)} className="min-w-0"><div className={`overflow-hidden rounded-[8px] border-2 bg-slate-50 transition ${active ? "border-blue-600" : "border-transparent opacity-70 hover:opacity-100"}`}><img src={item.image} alt={`${item.title} 미리보기`} className="aspect-[16/10] w-full object-cover object-top" /></div><div className={`mt-1 truncate text-center text-[9px] font-bold ${active ? "text-blue-700" : "text-slate-500"}`}>{item.shortTitle} 화면</div></button>;
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="bg-white">
            <div className="mx-auto grid max-w-[1180px] gap-5 px-4 py-6 sm:grid-cols-3 sm:px-6">
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-[#0b1b3f]"><ShieldCheck className="h-5 w-5" /></div><div><div className="text-[12px] font-extrabold text-[#0b1b3f]">정확한 정보 제공</div><div className="mt-0.5 text-[10px] text-slate-500">교육부 기준에 따른 안내</div></div></div>
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-[#0b1b3f]"><UsersRound className="h-5 w-5" /></div><div><div className="text-[12px] font-extrabold text-[#0b1b3f]">투명한 과정 운영</div><div className="mt-0.5 text-[10px] text-slate-500">추가 비용 없는 명확한 안내</div></div></div>
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50 text-[#0b1b3f]"><Heart className="h-5 w-5" /></div><div><div className="text-[12px] font-extrabold text-[#0b1b3f]">끝까지 함께하는 관리</div><div className="mt-0.5 text-[10px] text-slate-500">자격증 취득까지 책임지고 함께합니다.</div></div></div>
            </div>
          </section>
        </main>
      </div>

      <PublicStaffConsultationModal open={Boolean(consultationProfile)} onClose={() => setConsultationProfile(null)} profile={consultationProfile} teamPageUrl={teamPageUrl || null} />
    </>
  );
}
