import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import EmploymentKakaoMap, {
  type EmploymentMapJob,
} from "@/components/EmploymentKakaoMap";

import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Clock3,
  ExternalLink,
  LocateFixed,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
  Home,
  Wallet,
  GraduationCap,
  FileText,
  CalendarDays,
  ChevronRight,
  ChevronLeft,
  BookOpen,
  ShieldCheck,
  MessageCircle,
  MapPinned,
} from "lucide-react";


const BANNER = "/images/employment/practice-banner.png";
const PRACTICE_URL = "https://narangedu.liveklass.com/classes/257714";
const COMPANY_IMAGE = "/images/employment/company-default.png";
const HERO_BANNER =
  "/images/employment-center/social-welfare-hero-bg.png";

const CENTER_LOGO =
  "/images/employment-center/social-welfare-logo.png";
const SESSION_KEY = "withone-employment-session";
const SUPPORT_PORTAL_SLUG = "with-one";

const SUPPORT_PORTAL_TOKEN_KEY =
  `student_portal_token:${SUPPORT_PORTAL_SLUG}`;

function readSupportPortalToken(): string {
  try {
    return (
      window.localStorage.getItem(
        SUPPORT_PORTAL_TOKEN_KEY
      ) || ""
    );
  } catch {
    return "";
  }
}

const TRIAL_DEVICE_STORAGE_KEY =
  "student_portal_trial_device:with-one";

function getEmploymentTrialDeviceToken(): string {
  const saved = window.localStorage.getItem(
    TRIAL_DEVICE_STORAGE_KEY
  );

  if (saved && /^[a-f0-9]{64}$/i.test(saved)) {
    return saved;
  }

  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);

  const token = Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");

  window.localStorage.setItem(
    TRIAL_DEVICE_STORAGE_KEY,
    token
  );

  return token;
}

const STUDENT_PORTAL_URL = "https://edu-crm-five.vercel.app/portal/with-one";
type Job = EmploymentMapJob & {
  employmentType?: string;
  registeredAt?: string;
  closesAt?: string;
  detailUrl?: string;
  occupationCode?: string;
  distanceKm?: number;
};

function readSession(): {token:string; expiresAt:number}|null {
  try { const data=JSON.parse(sessionStorage.getItem(SESSION_KEY)||"null"); return data?.token && data.expiresAt>Date.now()?data:null; } catch { return null; }
}
function shortDate(value?: string) { if (!value) return "미정"; const s=String(value); return s.length===8 && /^\d{8}$/.test(s)?`${s.slice(0,4)}.${s.slice(4,6)}.${s.slice(6,8)}`:s; }

type Section = "home" | "jobs" | "funds" | "certificate" | "practice" | "resume" | "consultation" | "compare";
const SECTION_LABEL: Record<Section,string> = {
  home: "사회복지 통합지원센터", jobs: "일자리 찾기", funds: "지원금 찾기",
  certificate: "자격증 신청 예상일", practice: "실습기관 찾기", resume: "이력서·자기소개서",
  consultation: "학습설계 상담 신청", compare: "학습관리 서비스 비교",
};
const CARDS = [
  {key:"certificate" as Section, icon:CalendarDays, title:"자격증 신청 예상일", sub:"내 상황에 맞춰 확인", tint:"bg-indigo-50 text-indigo-600"},
  {key:"jobs" as Section, icon:BriefcaseBusiness, title:"일자리 찾기", sub:"GPS로 내 주변 채용공고", tint:"bg-blue-50 text-blue-600"},
  {key:"practice" as Section, icon:MapPinned, title:"실습기관 찾기", sub:"지역별 기관 탐색", tint:"bg-teal-50 text-teal-600"},
  {key:"funds" as Section, icon:Wallet, title:"지원금 찾기", sub:"관련 지원제도 확인", tint:"bg-amber-50 text-amber-600"},
  {key:"resume" as Section, icon:FileText, title:"이력서·자기소개서", sub:"모바일 작성 도구", tint:"bg-purple-50 text-purple-600"},
  {key:"consultation" as Section, icon:MessageCircle, title:"학습설계 상담 신청", sub:"개인별 학습계획 문의", tint:"bg-rose-50 text-rose-600"},
];
const CONSULTATION_TOKEN = (import.meta.env.VITE_SUPPORT_CONSULTATION_TOKEN || "").trim();
const todayKorea = () => new Intl.DateTimeFormat("en-CA", {timeZone:"Asia/Seoul",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
function SectionShell({children}: {children:React.ReactNode}) { return <div className="space-y-4 px-4 pb-24 pt-5">{children}</div>; }
function Field({label,children}:{label:string;children:React.ReactNode}) { return <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-700">{label}</span>{children}</label>; }
const inputStyle="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none focus:border-blue-500";

function CertificateWizard({onConsult}:{onConsult:()=>void}) {
 const [step,setStep]=useState(0);
 const [education,setEducation]=useState("");
 const [completed,setCompleted]=useState("");
 const [startDate,setStartDate]=useState(todayKorea);
 const query=trpc.socialWorkerGuide.getCalculationBasis.useQuery({startDate},{enabled:step===3 && /^\d{4}-\d{2}-\d{2}$/.test(startDate),refetchOnWindowFocus:false,retry:false});
 const groups=query.data?.educationGroups||[];
 const chosen=groups.find(g=>education==="고졸" ? g.key==="high_school" : g.key==="college_or_higher") || groups.find(g=>education==="고졸"?g.requiresDegree:!g.requiresDegree);
 return <SectionShell><div className="rounded-2xl bg-blue-50 p-4"><p className="text-xs font-bold text-blue-600">질문 {Math.min(step+1,4)} / 4</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-blue-100"><div className="h-full bg-blue-600 transition-all" style={{width:`${(Math.min(step+1,4)/4)*100}%`}}/></div><h2 className="mt-3 text-lg font-black">{["최종학력을 선택해 주세요","사회복지사 관련 과목을 이수하셨나요?","언제부터 시작하실 예정인가요?","자격증 신청 예상일"][step]}</h2></div>
 {step===0&&<div className="grid gap-2">{[["고졸","고등학교 졸업"],["대졸","전문대 졸업 이상"]].map(([v,label])=><button key={v} onClick={()=>{setEducation(v);setStep(1)}} className="rounded-xl border bg-white p-4 text-left text-sm font-bold hover:border-blue-500">{label}<ChevronRight className="float-right h-4 w-4"/></button>)}</div>}
 {step===1&&<div className="grid gap-2">{["없음 (처음 시작)","일부 과목 이수","17과목 및 실습 이수"].map(v=><button key={v} onClick={()=>{setCompleted(v);setStep(2)}} className="rounded-xl border bg-white p-4 text-left text-sm font-bold">{v}<ChevronRight className="float-right h-4 w-4"/></button>)}</div>}
 {step===2&&<div className="space-y-4"><Field label="학습 시작 예정일"><input type="date" className={inputStyle} value={startDate} onChange={e=>setStartDate(e.target.value)}/></Field><button onClick={()=>setStep(3)} disabled={!/^\d{4}-\d{2}-\d{2}$/.test(startDate)} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:opacity-40">예상일 확인하기</button></div>}
 {step===3&&<div className="space-y-4">{completed!=="없음 (처음 시작)"?<div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><b>개별 이수내역 확인 필요</b><p className="mt-2 text-slate-600">기존 이수과목과 학점인정 여부에 따라 신청일이 달라집니다. 아래 일정은 신규 시작자 기준 참고치이며, 개인별 확정 일정이 아닙니다.</p></div>:null}{query.isLoading&&<p className="text-sm">예상일을 계산하고 있습니다...</p>}{query.isError&&<p className="text-sm text-red-600">계산 결과를 불러오지 못했습니다.</p>}{chosen&&<div className="rounded-2xl border bg-white p-5"><p className="text-xs font-bold text-blue-600">{chosen.label} · 신규 시작 기준</p><p className="mt-2 text-3xl font-black text-slate-900">{chosen.expectedApplicationYear&&chosen.expectedApplicationMonth?`${chosen.expectedApplicationYear}년 ${chosen.expectedApplicationMonth}월`:"별도 확인 필요"}</p><p className="mt-2 text-xs text-slate-500">한국사회복지사협회 자격증 신청 예상시기이며 발급일은 아닙니다. 실제 개강일·과목·실습·학점인정 일정에 따라 달라집니다.</p></div>}<button onClick={onConsult} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white">개인별 학습설계 상담 신청</button></div>}
 {step>0&&<button onClick={()=>setStep(v=>v-1)} className="flex items-center gap-1 text-sm font-semibold text-slate-500"><ChevronLeft size={16}/> 이전 질문</button>}
 </SectionShell>;
}
function FundWizard(){
 const [step,setStep]=useState(0); const [category,setCategory]=useState("");const [region,setRegion]=useState("");const [keyword,setKeyword]=useState("");
 const query=trpc.gov24.list.useQuery({page:1,perPage:20,keyword},{enabled:step===3 && !!keyword,refetchOnWindowFocus:false,retry:false});
 return <SectionShell><div className="rounded-2xl bg-amber-50 p-4"><p className="text-xs font-bold text-amber-700">질문 {Math.min(step+1,4)} / 4</p><h2 className="mt-2 text-lg font-black">{["어떤 지원을 찾으시나요?","거주 지역을 선택해 주세요","검색 조건을 확인해 주세요","관련 지원제도 검색 결과"][step]}</h2></div>
 {step===0&&<div className="grid gap-2">{[["취업","취업·구직 지원"],["교육","교육·훈련 지원"],["청년","청년 지원"],["복지","생활·복지 지원"]].map(([v,label])=><button key={v} onClick={()=>{setCategory(v);setStep(1)}} className="rounded-xl border p-4 text-left text-sm font-bold">{label}<ChevronRight className="float-right h-4 w-4"/></button>)}</div>}
 {step===1&&<div className="space-y-3"><Field label="지역 (결과 확인용)"><select className={inputStyle} value={region} onChange={e=>setRegion(e.target.value)}><option value="">지역 선택</option>{["서울","경기","인천","부산","대구","대전","광주","울산","세종","강원","충북","충남","전북","전남","경북","경남","제주"].map(v=><option key={v}>{v}</option>)}</select></Field><button onClick={()=>setStep(2)} disabled={!region} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white disabled:opacity-40">다음</button></div>}
 {step===2&&<div className="space-y-3"><p className="text-sm text-slate-600">선택한 분야: <b>{category}</b> · 지역: <b>{region}</b></p><Field label="검색어 (변경 가능)"><input className={inputStyle} value={keyword||category} onChange={e=>setKeyword(e.target.value)}/></Field><button onClick={()=>{if(!keyword)setKeyword(category);setStep(3)}} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white">지원제도 검색하기</button></div>}
 {step===3&&<div className="space-y-3"><div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">정부24 공개 서비스 중 <b>{keyword}</b> 관련 결과입니다. <b>{region}</b> 거주자의 수급 가능 여부는 별도 확인해야 합니다.</div>{query.isLoading&&<p className="text-sm">지원제도를 조회하고 있습니다...</p>}{query.isError&&<p className="text-sm text-red-600">지원제도 조회에 실패했습니다. 잠시 후 다시 시도해 주세요.</p>}{query.data?.data?.map(item=><article key={item.서비스ID} className="rounded-xl border bg-white p-4"><p className="font-bold">{item.서비스명}</p><p className="mt-1 line-clamp-3 text-xs text-slate-600">{item.서비스목적요약||item.지원내용||"상세 조건 확인 필요"}</p><p className="mt-2 text-xs text-slate-400">{item.소관기관명||"담당기관 확인 필요"}</p>{item.상세조회URL&&/^https?:\/\//.test(item.상세조회URL)&&<a href={item.상세조회URL} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-bold text-blue-600">공식 안내 확인 ↗</a>}</article>)}{query.data?.data?.length===0&&<p className="text-sm">검색 결과가 없습니다. 검색어를 바꿔보세요.</p>}</div>}
 {step>0&&<button onClick={()=>setStep(v=>v-1)} className="flex items-center gap-1 text-sm text-slate-500"><ChevronLeft size={16}/> 이전</button>}</SectionShell>;
}
function ResumeEditor(){
 const [person,setPerson]=useState("");const [experience,setExperience]=useState("");const [motivation,setMotivation]=useState("");
 const draft=`이름: ${person}\n\n경험 및 강점\n${experience}\n\n지원동기 및 입사 후 포부\n${motivation}`;
 return <SectionShell><div className="rounded-xl bg-purple-50 p-4 text-sm text-slate-700">휴대폰에서 기본 내용을 작성하고 복사할 수 있습니다. 내용은 서버에 저장되지 않으며 화면을 닫으면 사라집니다.</div><Field label="이름"><input className={inputStyle} value={person} onChange={e=>setPerson(e.target.value)}/></Field><Field label="경험 및 강점"><textarea className={inputStyle} rows={5} value={experience} onChange={e=>setExperience(e.target.value)} placeholder="실습, 봉사, 직무 경험 등을 입력해 주세요"/></Field><Field label="지원동기 및 포부"><textarea className={inputStyle} rows={5} value={motivation} onChange={e=>setMotivation(e.target.value)}/></Field><button onClick={()=>navigator.clipboard.writeText(draft).then(()=>alert("작성 내용을 복사했습니다.")).catch(()=>alert("복사에 실패했습니다."))} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white">작성 내용 복사하기</button></SectionShell>;
}
function ConsultationForm(){
 const [clientName,setClientName]=useState("");const [phone,setPhone]=useState("");const [finalEducation,setFinalEducation]=useState("");const [desiredCourse,setDesiredCourse]=useState("사회복지사 2급");const [preferredContactTime,setPreferredContactTime]=useState("");const [notes,setNotes]=useState("");const [agree,setAgree]=useState(false);const [submitted,setSubmitted]=useState(false);const [error,setError]=useState("");
 const submit=trpc.staffProfile.public.submitConsultation.useMutation();
 async function handleSubmit(e:React.FormEvent){e.preventDefault();setError("");if(!agree)return setError("개인정보 수집·이용 동의가 필요합니다.");if(!CONSULTATION_TOKEN)return setError("상담 접수 설정이 아직 완료되지 않았습니다.");try{await submit.mutateAsync({publicToken:CONSULTATION_TOKEN,clientName:clientName.trim(),phone:phone.replace(/\D/g,""),finalEducation,desiredCourse,preferredContactTime:preferredContactTime||null,notes:`[사회복지 통합지원센터 유입]\n${notes}`.slice(0,500)});setSubmitted(true)}catch(e:any){setError(e?.message||"상담 접수에 실패했습니다.")}}
 if(submitted)return <SectionShell><div className="rounded-2xl border bg-white p-8 text-center"><ShieldCheck className="mx-auto h-12 w-12 text-emerald-600"/><h2 className="mt-4 text-xl font-black">상담 신청이 접수되었습니다.</h2><p className="mt-2 text-sm text-slate-500">담당자가 확인 후 연락드리겠습니다.</p></div></SectionShell>;
 return <SectionShell><div className="rounded-xl bg-blue-50 p-4 text-sm text-slate-700">개인별 사회복지사 2급 취득과정을 상담받을 수 있습니다. 상담 담당자의 개인 프로필은 공개되지 않습니다.</div><form className="space-y-4" onSubmit={handleSubmit}><Field label="이름 *"><input className={inputStyle} value={clientName} onChange={e=>setClientName(e.target.value)} required maxLength={100}/></Field><Field label="연락처 *"><input className={inputStyle} type="tel" inputMode="tel" value={phone} onChange={e=>setPhone(e.target.value)} required placeholder="010-1234-5678"/></Field><Field label="최종학력 *"><select className={inputStyle} value={finalEducation} onChange={e=>setFinalEducation(e.target.value)} required><option value="">선택해주세요</option>{["고등학교 졸업","전문대 졸업","4년제 대학교 졸업","대학원 졸업","기타"].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="희망과정 *"><select className={inputStyle} value={desiredCourse} onChange={e=>setDesiredCourse(e.target.value)}><option>사회복지사 2급</option><option>기타</option></select></Field><Field label="상담 가능 시간"><select className={inputStyle} value={preferredContactTime} onChange={e=>setPreferredContactTime(e.target.value)}><option value="">선택 안 함</option>{["언제든지","오전","오후","저녁"].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="문의내용"><textarea className={inputStyle} rows={4} maxLength={460} value={notes} onChange={e=>setNotes(e.target.value)}/></Field><label className="flex items-start gap-2 rounded-xl border p-3 text-xs text-slate-600"><input type="checkbox" checked={agree} onChange={e=>setAgree(e.target.checked)}/><span>상담 연락을 위해 이름·전화번호·학력·문의내용을 수집·이용하는 데 동의합니다. 실제 개인정보 처리 주체 및 보유기간은 운영기관의 개인정보 처리방침을 확인해 주세요.</span></label>{error&&<p role="alert" className="text-xs text-red-600">{error}</p>}<button disabled={submit.isPending||!agree} className="w-full rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white disabled:opacity-40">{submit.isPending?"접수 중...":"상담 신청하기"}</button></form></SectionShell>;
}
function PracticePage(){const [region,setRegion]=useState("");return <SectionShell><div className="rounded-xl bg-teal-50 p-4"><h2 className="font-bold">사회복지현장실습 기관 찾기</h2><p className="mt-2 text-xs leading-5 text-slate-600">실습기관은 보건복지부 지정 여부와 교육기관의 실습 인정 요건을 확인해야 합니다. 현재 공개 기관 검색 API는 연결되지 않았습니다.</p></div><Field label="희망 실습 지역"><input className={inputStyle} value={region} onChange={e=>setRegion(e.target.value)} placeholder="예: 서울 도봉구"/></Field><a href="https://www.welfare.net" target="_blank" rel="noreferrer" className="block rounded-xl border p-4 text-sm font-bold text-blue-600">한국사회복지사협회 공식 안내 확인 ↗</a><p className="text-xs text-slate-500">지역별 실습기관 자동 추천은 기관 검색 데이터 연동 후 활성화할 예정입니다.</p></SectionShell>}
function ComparePage(){return <SectionShell><p className="text-sm text-slate-600">학습관리 서비스를 선택할 때 확인해야 할 항목입니다. 특정 기관의 실제 제공 여부는 상담 전에 확인하세요.</p>{[["학사일정","개인별 수업·실습·행정 일정 확인"],["과목 누락 예방","필수·선택 과목 및 기존 이수내역 검토"],["실습 준비","선이수 요건·실습기관·실습 예정월 확인"],["행정절차","학습자등록·학점인정·학위신청 안내"],["자격증 신청","예상 신청시기와 협회 신청절차 확인"],["학생 포털","학생이 직접 진행상황을 조회할 수 있는지"]].map(([a,b])=><div key={a} className="rounded-xl border bg-white p-4"><p className="font-bold">{a}</p><p className="mt-1 text-xs text-slate-500">{b}</p></div>)}</SectionShell>}
export default function EmploymentCenterPage(){
const [portalToken, setPortalToken] = useState(
  readSupportPortalToken
);

const portalMeQuery =
  trpc.studentPortal.me.useQuery(
    { token: portalToken },
    {
      enabled: Boolean(portalToken),
      retry: false,
      refetchOnWindowFocus: true,
      refetchInterval: 60_000,
    }
  );

const isPortalLoggedIn =
  portalMeQuery.data?.authenticated === true;
useEffect(() => {
  const syncPortalToken = () => {
    setPortalToken(readSupportPortalToken());
  };

  window.addEventListener("storage", syncPortalToken);
  window.addEventListener("pageshow", syncPortalToken);

  return () => {
    window.removeEventListener("storage", syncPortalToken);
    window.removeEventListener("pageshow", syncPortalToken);
  };
}, []);
 const [section,setSection]=useState<Section>("home");
 const [menu,setMenu]=useState(false);
 const [session,setSession]=useState<{token:string;expiresAt:number}|null>(()=>readSession());
 useEffect(()=>{const onPop=()=>setSection("home");window.addEventListener("popstate",onPop);return()=>window.removeEventListener("popstate",onPop)},[]);
 const go=(next:Section)=>{setSection(next);setMenu(false);window.scrollTo({top:0,behavior:"smooth"})};
const portalLogout =
  trpc.studentPortal.logout.useMutation();

const signout = async () => {
  const token = readSupportPortalToken();

  if (token) {
    try {
      await portalLogout.mutateAsync({ token });
    } catch {
      alert("서버 로그아웃에 실패했습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    localStorage.removeItem(SUPPORT_PORTAL_TOKEN_KEY);
    setPortalToken("");
  }

  sessionStorage.removeItem(SESSION_KEY);
  setSession(null);
  go("home");
};

 return <div className="min-h-screen bg-[#f1f5fb] text-slate-900"><div className="mx-auto min-h-screen max-w-[560px] bg-[#f8fafc] shadow-[0_0_40px_rgba(18,48,88,.08)]">
 <header className="sticky top-0 z-40 border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur"><div className="flex items-center justify-between gap-2"><button onClick={()=>section==="home"?setMenu(v=>!v):go("home")} className="flex min-w-0 items-center gap-2 text-left">

<span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-blue-50">
  {section === "home" ? (
    <img
      src={CENTER_LOGO}
      alt="사회복지 통합지원센터"
      className="h-full w-full object-contain"
    />
  ) : (
    <ArrowLeft size={19} className="text-blue-700" />
  )}
</span>

<span className="min-w-0"><span className="block truncate text-[11px] font-bold text-blue-600">사회복지 통합지원센터</span><span className="block truncate text-sm font-black">{section==="home"?"나에게 필요한 정보를 한눈에":SECTION_LABEL[section]}</span></span></button><div className="flex shrink-0 items-center gap-2"><a href="/portal/with-one" className="rounded-lg bg-blue-50 px-2.5 py-2 text-[11px] font-bold text-blue-700">학사관리시스템</a><button onClick={()=>setMenu(v=>!v)} className="rounded-lg border p-2" aria-label="메뉴"><SlidersHorizontal size={17}/></button></div></div>
 {menu&&<nav className="mt-3 grid gap-1 rounded-xl bg-slate-50 p-2">{CARDS.map(c=><button key={c.key} onClick={()=>go(c.key)} className="rounded-lg px-3 py-2 text-left text-xs font-bold hover:bg-white">{c.title}</button>)}<a className="rounded-lg px-3 py-2 text-xs font-bold" href="/social-worker-guide">사회복지사 2급 취득 가이드</a><button onClick={()=>go("compare")} className="rounded-lg px-3 py-2 text-left text-xs font-bold">학습관리 비교</button>
<a
  href="/portal/with-one"
  className="rounded-lg px-3 py-2 text-xs font-bold"
>
  {isPortalLoggedIn
    ? "학사관리시스템으로 이동"
    : "학사관리시스템 로그인"}
</a>
{(isPortalLoggedIn || session) && (
  <button
    type="button"
    onClick={signout}
    disabled={portalLogout.isPending}
    className="rounded-lg px-3 py-2 text-left text-xs font-bold text-red-600 disabled:opacity-50"
  >
    {portalLogout.isPending ? "로그아웃 중..." : "로그아웃"}
  </button>
)}</nav>}</header>
 
{section === "home" && (
  <main className="px-4 pb-6">

    {/* 메인 배너 */}
    <section
      className="relative mt-4 overflow-hidden rounded-[22px] bg-gradient-to-br from-[#123f87] to-[#0869d8] px-5 py-6 text-white"
      style={{
        backgroundImage: `url("${HERO_BANNER}")`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="relative z-10 max-w-[78%]">
        <p className="text-[10px] font-bold tracking-wide text-blue-100">
          SOCIAL WELFARE SUPPORT
        </p>

        <h1 className="mt-3 text-[21px] font-black leading-[1.35] tracking-tight">
          사회복지 정보부터
          <br />
          취업 준비까지 한곳에서
        </h1>

        <p className="mt-3 text-[11px] leading-[1.7] text-blue-100">
          일자리, 실습, 지원제도, 자격증 신청시기를
          쉽고 빠르게 확인하세요.
        </p>
      </div>

      <div className="relative z-10 mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => go("certificate")}
          className="rounded-full bg-white px-4 py-2.5 text-[11px] font-extrabold text-blue-700 shadow-sm"
        >
          자격증 예상일 확인
        </button>

        <button
          type="button"
          onClick={() => go("jobs")}
          className="rounded-full border border-white/25 bg-blue-950/30 px-4 py-2.5 text-[11px] font-bold text-white"
        >
          내 주변 일자리
        </button>
      </div>
    </section>

    {/* 주요 서비스 */}
    <section className="mt-7">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[17px] font-black text-slate-900">
          <span className="h-5 w-1 rounded-full bg-blue-600" />
          주요 서비스
        </h2>

        <span className="rounded-full bg-blue-50 px-3 py-1 text-[11px] font-semibold text-blue-700">
          6개 서비스
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {CARDS.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => go(c.key)}
            className="group flex min-h-[91px] items-center gap-2 rounded-[17px] border border-slate-200/80 bg-white px-3 py-3 text-left shadow-[0_3px_12px_rgba(15,43,83,0.035)] transition-all hover:border-blue-200 hover:shadow-md active:scale-[0.99]"
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] ${c.tint}`}
            >
              <c.icon size={21} strokeWidth={2} />
            </span>

            <span className="min-w-0 flex-1">
              <span className="block break-keep text-[12px] font-extrabold leading-[1.35] text-slate-900">
                {c.title}
              </span>

              <span className="mt-1 block break-keep text-[10px] leading-[1.35] text-slate-500">
                {c.sub}
              </span>
            </span>

            <ChevronRight
              size={14}
              className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5"
            />
          </button>
        ))}
      </div>
    </section>

    {/* 취득 준비 가이드 */}
    <section className="mt-8">
      <h2 className="mb-3 flex items-center gap-2 text-[17px] font-black text-slate-900">
        <span className="h-5 w-1 rounded-full bg-blue-600" />
        취득 준비 가이드
      </h2>

      <div className="space-y-2.5">

        <a
          href="/social-worker-guide"
          className="group flex min-h-[86px] items-center gap-3 overflow-hidden rounded-[17px] border border-blue-100 bg-gradient-to-r from-white via-white to-blue-50 px-4 py-3 shadow-[0_3px_12px_rgba(15,43,83,0.035)]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-blue-100 text-blue-600">
            <BookOpen size={23} />
          </span>

          <span className="min-w-0 flex-1">
            <b className="block text-[13px] font-extrabold text-slate-900">
              사회복지사 2급 취득 가이드
            </b>

            <small className="mt-1 block text-[11px] leading-4 text-slate-500">
              이론·실습·행정절차·자격증 신청
            </small>
          </span>

          <ChevronRight
            size={18}
            className="shrink-0 text-slate-600"
          />
        </a>

        <button
          type="button"
          onClick={() => go("compare")}
          className="group flex min-h-[86px] w-full items-center gap-3 overflow-hidden rounded-[17px] border border-cyan-100 bg-gradient-to-r from-white via-white to-cyan-50 px-4 py-3 text-left shadow-[0_3px_12px_rgba(15,43,83,0.035)]"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-cyan-100 text-blue-600">
            <ShieldCheck size={23} />
          </span>

          <span className="min-w-0 flex-1">
            <b className="block text-[13px] font-extrabold text-slate-900">
              학습관리 서비스 비교
            </b>

            <small className="mt-1 block text-[11px] leading-4 text-slate-500">
              일정·과목·실습·행정 관리 항목
            </small>
          </span>

          <ChevronRight
            size={18}
            className="shrink-0 text-slate-600"
          />
        </button>
      </div>
    </section>

    

{/* 통합지원센터 푸터 */}
<footer className="mt-10 border-t border-slate-200 pt-4">

  {/* 가로 3단 구성 */}
  <div className="grid grid-cols-[1.35fr_1fr_1.1fr] gap-2">

    {/* 왼쪽: 센터 소개 */}
    <div className="min-w-0 pr-2">
      <div className="flex items-center gap-1">
        <img
          src={CENTER_LOGO}
          alt="사회복지 통합지원센터"
          className="h-7 w-7 shrink-0 object-contain"
        />
        <h3 className="text-[10px] font-black tracking-tight text-slate-900">
          사회복지 통합지원센터
        </h3>
      </div>

      <p className="mt-2 break-keep text-[9px] leading-[1.6] text-slate-500">
        사회복지사의 취득부터 취업까지,
        <br />
        필요한 정보를 한곳에서 제공합니다.
      </p>
    </div>

    {/* 가운데: 서비스 */}
    <div className="min-w-0 border-l border-slate-200 pl-3">
      <h4 className="mb-2 text-[10px] font-extrabold text-slate-900">
        서비스
      </h4>

      <div className="flex flex-col items-start gap-1">
        {[
          { label: "자격증 신청 예상일", key: "certificate" },
          { label: "일자리 찾기", key: "jobs" },
          { label: "실습기관 찾기", key: "practice" },
          { label: "지원금 찾기", key: "funds" },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => go(item.key as Section)}
            className="text-left text-[9px] leading-[1.4] text-slate-600 hover:text-blue-600"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>

    {/* 오른쪽: 문의사항 */}
    <div className="min-w-0 border-l border-slate-200 pl-3">
      <h4 className="mb-2 text-[10px] font-extrabold text-slate-900">
        문의사항
      </h4>

      <a
        href="tel:01093117148"
        className="flex items-center gap-1 text-[11px] font-black text-blue-600"
      >
        <span className="shrink-0">☎</span>
        <span>010-9311-7148</span>
      </a>

      <p className="mt-1 text-[9px] leading-[1.5] text-slate-500">
        이재준 (개발·운영 담당)
      </p>
    </div>
  </div>

  {/* 저작권 */}
  <div className="mt-4 border-t border-slate-200 py-3">
    <p className="text-[9px] text-slate-400">
      © 2026 사회복지 통합지원센터. All rights reserved.
    </p>
  </div>

</footer>



  </main>
)}

{section === "jobs" && (
  <LegacyEmploymentJobs
    portalToken={isPortalLoggedIn ? portalToken : ""}
    onPortalLogin={setPortalToken}
    onSessionChange={setSession}
    onBack={() => go("home")}
  />
)}
 {section==="funds"&&<FundWizard/>}
 {section==="certificate"&&<CertificateWizard onConsult={()=>go("consultation")}/>}
 {section==="practice"&&<PracticePage/>}
 {section==="resume"&&<ResumeEditor/>}
 {section==="consultation"&&<ConsultationForm/>}
 {section==="compare"&&<ComparePage/>}
 {section!=="home"&&<div className="fixed bottom-4 left-1/2 z-30 flex w-[min(92%,520px)] -translate-x-1/2 justify-between rounded-2xl border bg-white p-2 shadow-xl"><button onClick={()=>go("home")} className="flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold"><Home size={16}/> 통합지원센터 홈</button><a href="/social-worker-guide" className="flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"><BookOpen size={15}/> 취득 가이드</a></div>}
 </div></div>;
}


function PublicEmploymentJobs({
  onLogin,
}: {
  onLogin: () => void;
}) {
  const [page, setPage] = useState(1);
  const [bannerFailed, setBannerFailed] = useState(false);

  const jobsQuery =
    trpc.employmentCenter.publicLatestJobs.useQuery(
      { page, size: 10 },
      {
        retry: false,
        refetchOnWindowFocus: false,
        staleTime: 60_000,
      }
    );

  const jobs = jobsQuery.data?.jobs ?? [];
  const total = jobsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 10));

  return (
    <div className="min-h-screen bg-[#f7f9fd] px-4 pb-28 pt-5 text-slate-900">

      {/* 상단 안내 */}
      <div className="rounded-[22px] bg-gradient-to-br from-[#103d83] to-[#0967f6] px-5 py-6 text-white">
        <p className="text-[12px] font-bold text-blue-100">
          사회복지 통합지원센터
        </p>
        <h1 className="mt-2 text-[23px] font-black">
          사회복지 일자리 찾기
        </h1>
        <p className="mt-2 text-[12px] leading-5 text-blue-100">
          전국 사회복지 분야 채용공고를 확인하고
          내 주변 일자리도 찾아보세요.
        </p>
      </div>

      {/* 주소 검색 */}
      <div className="mt-5">
        <p className="mb-2 text-[13px] font-bold">
          지역·주소 검색
        </p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onLogin}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3.5 text-left"
          >
            <MapPin size={18} className="shrink-0 text-blue-600" />
            <span className="truncate text-[13px] text-slate-400">
              지역·주소 입력 (예: 서울 도봉구)
            </span>
          </button>

          <button
            type="button"
            onClick={onLogin}
            aria-label="주소 검색"
            className="rounded-xl bg-blue-600 px-3.5 text-white"
          >
            <Search size={19} />
          </button>

          <button
            type="button"
            onClick={onLogin}
            aria-label="내 위치 검색"
            className="rounded-xl border border-slate-200 bg-white px-3.5 text-blue-600"
          >
            <LocateFixed size={19} />
          </button>
        </div>
      </div>

      {/* 비로그인 지도 안내 */}
      <div className="mt-4 rounded-[20px] border border-blue-100 bg-white px-5 py-6 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50">
          <MapPinned size={25} className="text-blue-600" />
        </div>

        <h2 className="mt-3 text-[16px] font-black">
          내 주변 일자리를 지도에서 확인하세요
        </h2>

        <p className="mt-2 text-[12px] leading-5 text-slate-500">
          지도, 지역 검색, 내 위치, 정렬 변경,
          <br />
          채용공고 상세정보는 로그인 후 이용할 수 있습니다.
        </p>

        <button
          type="button"
          onClick={onLogin}
          className="mt-5 w-full rounded-xl bg-blue-600 py-3.5 text-[14px] font-bold text-white"
        >
          로그인하고 이용하기
        </button>
      </div>

      {/* 전국 채용공고 */}
      <section className="mt-7">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[12px] font-bold text-blue-600">
              고용24 채용정보
            </p>
            <h2 className="mt-1 text-[19px] font-black">
              전국 채용공고
            </h2>
            <p className="mt-1 text-[12px] text-slate-500">
              {jobsQuery.isSuccess
                ? `전체 ${total.toLocaleString()}건`
                : "채용정보 조회 중"}
            </p>
          </div>

          <button
            type="button"
            onClick={onLogin}
            className="flex shrink-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[12px] font-bold"
          >
            등록일순
            <SlidersHorizontal size={14} />
          </button>
        </div>

        {jobsQuery.isLoading && (
          <div className="mt-5 rounded-xl bg-white p-8 text-center text-sm text-slate-500">
            채용공고를 불러오고 있습니다...
          </div>
        )}

        {jobsQuery.isError && (
          <div className="mt-5 rounded-xl border bg-white p-5 text-center">
            <p className="text-sm text-red-600">
              채용공고를 불러오지 못했습니다.
            </p>
            <button
              type="button"
              onClick={() => jobsQuery.refetch()}
              className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white"
            >
              다시 시도
            </button>
          </div>
        )}

        {jobsQuery.isSuccess && jobs.length === 0 && (
          <p className="mt-5 rounded-xl bg-white p-8 text-center text-sm text-slate-500">
            표시할 채용공고가 없습니다.
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {jobs.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={onLogin}
              className="rounded-[18px] border border-slate-100 bg-white p-4 text-left shadow-[0_4px_16px_rgba(18,48,88,.04)] transition-colors active:bg-blue-50"
            >
              <p className="truncate text-[12px] font-bold text-blue-600">
                {job.company || "기관명 확인 필요"}
              </p>

              <h3 className="mt-2 line-clamp-2 min-h-[40px] text-[15px] font-extrabold leading-5">
                {job.title}
              </h3>

              <p className="mt-3 text-[13px] font-bold text-slate-800">
                {job.salary || "급여 정보 확인"}
              </p>

              <div className="mt-3 flex items-start gap-1 text-[12px] text-slate-500">
                <MapPin size={14} className="mt-0.5 shrink-0" />
                <span className="line-clamp-1">
                  {job.address || "근무지 확인 필요"}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                <span className="truncate">
                  {job.employmentType || "고용형태 확인"}
                </span>
                <span className="shrink-0">
                  {shortDate(job.closesAt)} 마감
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* 페이지 이동 */}
        {jobsQuery.isSuccess && totalPages > 1 && (
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((v) => Math.max(1, v - 1))}
              className="rounded-lg border bg-white px-4 py-2 text-xs font-bold disabled:opacity-40"
            >
              이전
            </button>

            <span className="text-[12px] font-bold text-slate-600">
              {page} / {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((v) => Math.min(totalPages, v + 1))}
              className="rounded-lg border bg-white px-4 py-2 text-xs font-bold disabled:opacity-40"
            >
              다음
            </button>
          </div>
        )}
      </section>

      {/* 기존 실무교육 배너 */}
      <a
        href={PRACTICE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-8 block overflow-hidden rounded-2xl bg-[#e9f3ff]"
      >
        {!bannerFailed ? (
          <img
            src={BANNER}
            alt="사회복지 실무교육 안내"
            className="w-full object-cover"
            onError={() => setBannerFailed(true)}
          />
        ) : (
          <div className="p-5">
            <p className="text-xs font-bold text-blue-600">
              사회복지 실무교육 안내
            </p>
            <p className="mt-2 text-lg font-black">
              실무교육 자세히 보기
            </p>
          </div>
        )}
      </a>

      <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">
        채용정보 제공: 고용24
        <br />
        실제 자격요건과 마감 여부는 원문에서 확인해주세요.
      </p>
    </div>
  );
}


function LegacyEmploymentJobs({
  portalToken,
  onPortalLogin,
  onSessionChange,
  onBack,
}: {
  portalToken: string;
  onPortalLogin: (token: string) => void;
  onSessionChange: (
    session: { token: string; expiresAt: number } | null
  ) => void;
  onBack: () => void;
}) {
  const [session,setSession]=useState<{token:string;expiresAt:number}|null>(()=>readSession());
const activeToken = portalToken || session?.token || "";
    const [name,setName]=useState("");
  const [phone,setPhone]=useState("");
  const [showLogin,setShowLogin]=useState(false);
  const [loginError,setLoginError]=useState("");
  const [keyword,setKeyword]=useState("");
  const [draftKeyword,setDraftKeyword]=useState("");
  const [draftAddress,setDraftAddress]=useState("");
  const [referencePoint,setReferencePoint]=useState<{lat:number;lng:number}|null>(null);
// 주소 검색과 GPS 요청의 순서를 관리
const locationRequestRef = useRef(0);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [showDetail,setShowDetail]=useState(false);
  const [showList,setShowList]=useState(true);
  const [bannerFailed,setBannerFailed]=useState(false);
  const [imageFailed,setImageFailed]=useState(false);
  const verify = trpc.studentPortal.login.useMutation();
 const jobsQuery = trpc.employmentCenter.nearbyJobs.useQuery(
  {
    token: activeToken,
    lat: referencePoint?.lat ?? 37.5665,
    lng: referencePoint?.lng ?? 126.978,
  },
  {
    enabled: !!activeToken && !!referencePoint,
    refetchOnWindowFocus: false,
    retry: false,
    refetchInterval: (query) =>
      query.state.data?.preparing ? 3000 : false,
  }
);
  const jobs = useMemo<Job[]>(() => {
  if (!referencePoint || !jobsQuery.data) return [];

  return (jobsQuery.data.jobs || []) as Job[];
}, [jobsQuery.data, referencePoint]);
  const detailQuery =
  trpc.employmentCenter.jobDetail.useQuery(
    {
      token: activeToken,
      wantedAuthNo: selectedId || "",
    },
    {
      enabled:
        Boolean(activeToken) &&
        Boolean(selectedId) &&
        showDetail,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );
  const selected=jobs.find(j=>j.id===selectedId)||null;
const mapJobs = useMemo<Job[]>(
  () => jobs.filter((job) => {
    const q = keyword.trim().toLowerCase();
    return (
      !q ||
      `${job.company} ${job.title} ${job.address}`
        .toLowerCase()
        .includes(q)
    );
  }),
  [jobs, keyword]
);

const filtered = mapJobs;
  const total = jobsQuery.data?.total ?? 0;
const displayedCount = filtered.length;
const nearbyCount = jobs.length;

  useEffect(() => {
  if (!session) return;

  const ms = session.expiresAt - Date.now();

  if (ms <= 0) {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    onSessionChange(null);
    return;
  }

  const timer = window.setTimeout(() => {
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    onSessionChange(null);
  }, ms);

  return () => window.clearTimeout(timer);
}, [session, onSessionChange]);
  
async function login(e: React.FormEvent) {
  e.preventDefault();
  setLoginError("");

  const digits = phone.replace(/\D/g, "");

  if (
    name.trim().length < 2 ||
    digits.length < 10 ||
    digits.length > 11
  ) {
    setLoginError(
      "이름과 휴대폰 번호를 정확히 입력해주세요."
    );
    return;
  }

  try {
    const deviceToken =
      getEmploymentTrialDeviceToken();

    const res = await verify.mutateAsync({
      slug: SUPPORT_PORTAL_SLUG,
      clientName: name.trim(),
      phone: digits,
      deviceToken,
    });

    if (!res.success || !res.token) {
      setLoginError(
        "등록회원 정보를 확인하지 못했습니다."
      );
      return;
    }

    // 학생일정포털과 공통으로 사용하는 토큰 저장
    window.localStorage.setItem(
      SUPPORT_PORTAL_TOKEN_KEY,
      res.token
    );

    // 이전 취업정보센터 세션 정리
    window.sessionStorage.removeItem(
      SESSION_KEY
    );

    setSession(null);
    onSessionChange(null);

    // 통합지원센터 전체에 로그인 상태 반영
    onPortalLogin(res.token);

    // 기존 채용공고 상세 화면 초기화
    setSelectedId(null);
    setShowDetail(false);

  } catch (err: any) {
    setLoginError(
      err?.message ||
      "회원 확인 중 오류가 발생했습니다."
    );
  }
}  

  function selectJob(job:EmploymentMapJob){setSelectedId(String(job.id));setShowDetail(true);setShowList(true);}
  function searchPlace(e: React.FormEvent) {
  e.preventDefault();

  const address = draftAddress.trim();
  if (!address) return;

  // 이전 주소 검색 및 GPS 요청 무효화
  const requestId = ++locationRequestRef.current;

  const kakao = window.kakao;

  if (!kakao?.maps?.services) {
    alert("지도를 준비하고 있습니다. 잠시 후 다시 검색해주세요.");
    return;
  }

  const applyLocation = (lat: number, lng: number) => {
    // 최신 검색 요청만 반영
    if (requestId !== locationRequestRef.current) return;

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      alert("검색한 위치의 좌표를 확인할 수 없습니다.");
      return;
    }
    setReferencePoint({ lat, lng });
    setSelectedId(null);
    setShowDetail(false);
  };

  const geocoder = new kakao.maps.services.Geocoder();

  geocoder.addressSearch(
    address,
    (results: any[], status: string) => {
      if (requestId !== locationRequestRef.current) return;

      if (
        status === kakao.maps.services.Status.OK &&
        results?.length
      ) {
        applyLocation(
          Number(results[0].y),
          Number(results[0].x)
        );
        return;
      }

      const places = new kakao.maps.services.Places();

      places.keywordSearch(
        address,
        (items: any[], placeStatus: string) => {
          if (requestId !== locationRequestRef.current) return;

          if (
            placeStatus === kakao.maps.services.Status.OK &&
            items?.length
          ) {
            applyLocation(
              Number(items[0].y),
              Number(items[0].x)
            );
          } else {
            alert("검색한 지역을 찾을 수 없습니다.");
          }
        }
      );
    }
  );
}

  function findCurrentLocation() {
  const requestId = ++locationRequestRef.current;

  if (!navigator.geolocation) {
    alert("위치 서비스를 사용할 수 없습니다.");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      if (requestId !== locationRequestRef.current) return;

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        alert("현재 위치의 좌표를 확인할 수 없습니다.");
        return;
      }

      setReferencePoint({ lat, lng });
      setDraftAddress("");
      setSelectedId(null);
      setShowDetail(false);
    },
    () => {
      if (requestId !== locationRequestRef.current) return;

      alert(
        "현재 위치를 확인할 수 없습니다. 주소를 직접 입력해주세요."
      );
    },
    {
      enableHighAccuracy: false,
      timeout: 10000,
    }
  );
}

        if (!activeToken && !showLogin) {
      return (
        <PublicEmploymentJobs
          onLogin={() => setShowLogin(true)}
        />
      );
    }

    if (!activeToken) return (
    <div className="min-h-screen bg-[#f2f7fd] text-slate-900">
      <div className="mx-auto min-h-screen max-w-[430px] bg-[#f2f7fd]">

        
        {/* 공개 채용공고로 돌아가기 */}
        <div className="px-4 pt-4">
          <button
            type="button"
            onClick={() => setShowLogin(false)}
            className="flex items-center gap-2 text-[13px] font-bold text-slate-600"
          >
            <ArrowLeft size={17} />
            채용공고 목록으로 돌아가기
          </button>
        </div>

        {/* 상단 배너 */}
        <div className="relative">

          <img
  src="/images/withone-employment-hero.png"
  alt="사회복지 통합지원센터 일자리 찾기"
  className="block h-auto w-full"
/>
        </div>

        {/* 등록회원 확인 */}
        <div className="relative z-10 -mt-5 px-4">
          <form
            onSubmit={login}
            className="rounded-[24px] bg-white px-5 pb-5 pt-6 shadow-[0_8px_30px_rgba(20,50,90,0.08)]"
          >
            <div className="mb-5">
              <div className="mb-3 h-[3px] w-8 rounded-full bg-[#0967f6]" />

              <h2 className="text-[21px] font-extrabold tracking-tight text-[#10223f]">
                등록회원 확인
              </h2>

              <p className="mt-2 text-[13px] leading-5 text-slate-500">
  등록회원은 이름과 휴대폰 번호로
  <br />
  학사관리시스템과 통합지원센터를
  <br />
  하나의 계정으로 이용할 수 있습니다.
</p>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="employment-member-name"
                  className="mb-2 block text-[13px] font-bold text-slate-800"
                >
                  이름
                </label>

                <input
                  id="employment-member-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="등록하신 이름을 입력해주세요"
                  className="h-[48px] w-full rounded-xl border border-[#dce5f1] bg-[#f8fafc] px-4 text-[14px] outline-none transition-colors focus:border-[#0967f6] focus:bg-white"
                />
              </div>

              <div>
                <label
                  htmlFor="employment-member-phone"
                  className="mb-2 block text-[13px] font-bold text-slate-800"
                >
                  휴대폰 번호
                </label>

                <input
                  id="employment-member-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="01012345678"
                  className="h-[48px] w-full rounded-xl border border-[#dce5f1] bg-[#f8fafc] px-4 text-[14px] outline-none transition-colors focus:border-[#0967f6] focus:bg-white"
                />
              </div>
            </div>

            {loginError && (
              <p role="alert" className="mt-3 text-[13px] text-red-600">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              disabled={verify.isPending}
              className="mt-5 flex h-[50px] w-full items-center justify-center gap-2 rounded-xl bg-[#0967f6] text-[15px] font-bold text-white shadow-[0_4px_12px_rgba(9,103,246,0.15)] transition-colors active:bg-blue-700 disabled:opacity-60"
            >
              {verify.isPending ? "로그인 중..." : "로그인하고 일자리 찾기"}
              <ArrowRight size={17} />
            </button>

            <p className="mt-4 text-center text-[11px] text-slate-400">
              이름과 휴대폰 번호로 등록 여부만 확인합니다.
            </p>
          </form>
        </div>

        {/* 비수강생 교육과정 안내 */}
        <div className="px-4 pb-5 pt-4">
          <div className="rounded-[20px] bg-[#e7f0fc] px-5 py-5">
            <h3 className="text-[16px] font-extrabold text-[#10223f]">
사회복지사 2급 취득을 준비하시나요?
            </h3>

            <p className="mt-2 text-[12px] leading-5 text-slate-600">
  취득과정부터 실습, 행정절차,
  <br />
  자격증 신청 예상일까지 확인해 보세요.
</p>

            <a
  href="/social-worker-guide"
  className="mt-4 flex h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-[#0967f6] bg-white text-[13px] font-bold text-[#0967f6]"
>
  사회복지사 2급 취득 가이드
  <ArrowRight size={15} />
</a>
          </div>
        </div>

        <p className="px-5 pb-8 text-center text-[11px] leading-5 text-slate-400">
          채용정보 제공: 고용24
          <br />
          실제 채용 조건과 마감 여부는 공고에서 확인해주세요.
        </p>
      </div>
    </div>
  );

  return <div className="min-h-screen bg-[#edf3fa] text-slate-900">
    <div className="relative mx-auto flex min-h-screen max-w-[560px] flex-col bg-white shadow-[0_0_40px_rgba(18,48,88,.09)]">
      <header className="z-20 bg-white px-5 pb-4 pt-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
    <BriefcaseBusiness size={23} />
  </div>

  <div className="min-w-0">
    <p className="text-[12px] font-bold text-blue-600">
      사회복지 통합지원센터
    </p>
    <h1 className="text-[21px] font-black tracking-tight text-[#10223f]">
      일자리 찾기
    </h1>
  </div>
</div>
          <div className="flex items-center gap-2">
  <a
    href={STUDENT_PORTAL_URL}
    className="flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"
  >
    <ArrowLeft size={14} />
    학사관리시스템
  </a>

  <button
    type="button"
    onClick={onBack}
    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500"
  >
    돌아가기
  </button>
</div>
        </div>
        <form onSubmit={searchPlace} className="mt-5 flex gap-2"><div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5"><MapPin size={19} className="shrink-0 text-blue-600"/><input value={draftAddress} onChange={e=>setDraftAddress(e.target.value)} placeholder="지역·주소 검색 (예: 서울 노원구)" className="min-w-0 flex-1 bg-transparent py-3.5 text-sm outline-none"/></div><button className="rounded-2xl bg-[#0967f6] px-4 text-sm font-bold text-white">검색</button><button type="button" onClick={findCurrentLocation} aria-label="현재 위치" className="rounded-2xl border border-slate-200 px-3 text-blue-600"><LocateFixed size={20}/></button></form>
      </header>

      <div className="relative h-[42vh] min-h-[280px] max-h-[470px] bg-slate-100">
        <EmploymentKakaoMap
  jobs={mapJobs}
  selectedId={selectedId}
  referencePoint={referencePoint}
  onSelectJob={selectJob}
  className="h-full w-full"
/>
        <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/95 px-3 py-2 text-xs font-extrabold text-blue-700 shadow-md">지도에 표시된 공고 {mapJobs.filter(
  job => job.latitude != null && job.longitude != null
).length}건</div>
        <button onClick={()=>setShowList(v=>!v)} className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-black text-blue-700 shadow-lg"><SlidersHorizontal size={16}/>{showList?"목록 접기":"공고 목록 보기"}</button>
      </div>
      {showList&&<section className="relative z-10 -mt-3 flex-1 rounded-t-[28px] bg-white px-4 pb-12 pt-5 shadow-[0_-8px_30px_rgba(14,41,80,.08)]">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200"/>
        <div className="flex items-end justify-between"><div><p className="text-xs font-bold text-blue-600">사회복지 분야 채용정보</p><h2 className="mt-1 text-[21px] font-black">
  가까운 채용공고{" "}
  <span className="text-blue-600">
    {nearbyCount}건
  </span>
</h2></div><div className="text-right">
  <p className="text-[11px] text-slate-400">
    출처: 고용24
  </p>
  <p className="mt-1 text-[11px] text-slate-400">
    전체 공고 {total.toLocaleString()}건
  </p>
</div></div>
        <form onSubmit={e=>{e.preventDefault();setKeyword(draftKeyword)}} className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3"><Search size={18} className="text-slate-400"/><input value={draftKeyword} onChange={e=>setDraftKeyword(e.target.value)} placeholder="회사명 또는 공고명 검색 (가까운 30건)" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"/><button className="text-xs font-extrabold text-blue-600">검색</button></form>
        <div className="mt-3 flex items-center justify-between">
  <span className="text-xs font-bold text-blue-600">
    거리순으로 표시 중
  </span>
  <span className="text-[11px] text-slate-400">
    가까운 공고 {displayedCount}건
  </span>
</div>
        {!referencePoint && (
  <p className="py-8 text-center text-sm text-slate-500">
    상단에서 주소를 검색하거나 현재 위치를 선택해주세요.
  </p>
)}

{referencePoint && jobsQuery.isLoading && (
  <p className="py-8 text-center text-sm text-slate-500">
    채용공고를 조회하고 있습니다...
  </p>
)}

{jobsQuery.data?.preparing && (
  <p>
    주변 채용공고를 검색하고 있습니다.
    검색된 공고부터 순서대로 표시됩니다.
  </p>
)}
{jobsQuery.isError && (
  <div className="py-8 text-center">
    <p className="text-sm text-red-600">
      채용공고를 불러오지 못했습니다.
    </p>

    <p className="mt-2 text-xs text-slate-500">
      {jobsQuery.error.message}
    </p>

    <button
      type="button"
      onClick={() => jobsQuery.refetch()}
      className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"
    >
      다시 시도
    </button>
  </div>
)}

        {referencePoint &&
!jobsQuery.isLoading &&
!jobsQuery.isError &&
!jobsQuery.data?.preparing &&
filtered.length === 0&&<p className="py-12 text-center text-sm text-slate-500">검색 조건에 맞는 채용공고가 없습니다.</p>}
        <div className="mt-4 space-y-3">{filtered.map(job=>{
          const distance = job.distanceKm ?? null;
          return <button key={job.id} onClick={()=>selectJob(job)} className={`flex w-full gap-3 rounded-2xl border p-3.5 text-left transition-colors ${selectedId===job.id?"border-blue-400 bg-blue-50":"border-slate-100 bg-white shadow-[0_4px_16px_rgba(18,48,88,.05)]"}`}>
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-blue-50">{!imageFailed?<img src={COMPANY_IMAGE} alt="공통 복지시설 이미지" className="h-full w-full object-cover" onError={()=>setImageFailed(true)}/>:<div className="flex h-full w-full items-center justify-center text-blue-500"><BriefcaseBusiness size={26}/></div>}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-blue-600">{job.company||"회사명 미표기"}</p><h3 className="mt-1 line-clamp-2 text-[14px] font-extrabold leading-snug">{job.title}</h3><p className="mt-2 flex items-start gap-1 text-xs text-slate-500"><MapPin size={13} className="mt-0.5 shrink-0"/><span className="line-clamp-1">{job.address||"근무지 확인 필요"}{distance!==null?` · ${distance.toFixed(1)}km`:""}</span></p><div className="mt-2 flex items-center justify-between gap-1"><span className="line-clamp-1 text-xs font-extrabold text-slate-800">{job.salary||"급여 정보 확인"}</span><span className="shrink-0 text-[11px] text-slate-400">{shortDate(job.closesAt)} 마감</span></div></div>
          </button>;
        })}</div>
        <a
  href={PRACTICE_URL}
  target="_blank"
  rel="noopener noreferrer"
  aria-label="나랑에듀 사회복지사 실무교육 자세히 보기"
  className="mt-8 block overflow-hidden rounded-2xl bg-[#e9f3ff] transition-transform hover:scale-[1.01]"
>
  {!bannerFailed ? (
    <img
      src={BANNER}
      alt="사회복지사 실무교육 자세히 보기"
      className="w-full object-cover"
      onError={() => setBannerFailed(true)}
    />
  ) : (
    <div className="p-5">
      <p className="text-xs font-bold text-blue-600">
  사회복지 실무교육 안내
</p>
      <p className="mt-1 text-lg font-black">
        사회복지 실무교육 자세히 보기 →
      </p>
    </div>
  )}
</a>
        <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">채용공고는 고용24 제공 정보이며, 실제 채용 조건과 마감 여부는 해당 공고에서 확인해주세요. 주소 변환이 불가능한 공고는 지도에 표시되지 않을 수 있습니다.</p>
      </section>}
      {showDetail&&selected&&<div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/45" onClick={()=>setShowDetail(false)}><div role="dialog" aria-modal="true" aria-label="채용공고 상세정보" onClick={e=>e.stopPropagation()} className="max-h-[82vh] w-full max-w-[560px] overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl"><div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200"/><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-blue-600">{selected.company}</p><h2 className="mt-2 text-xl font-black leading-snug">{selected.title}</h2></div><button onClick={()=>setShowDetail(false)} aria-label="닫기" className="rounded-full bg-slate-100 p-2"><X size={20}/></button></div><div className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-4 text-sm"><p className="flex gap-2"><MapPin size={18} className="shrink-0 text-blue-600"/>{selected.address||"근무지 정보 없음"}</p><p className="flex gap-2"><BriefcaseBusiness size={18} className="shrink-0 text-blue-600"/>{selected.salary||"급여 확인 필요"}</p><p className="flex gap-2"><Clock3 size={18} className="shrink-0 text-blue-600"/>마감일 {shortDate(selected.closesAt)}</p>{selected.employmentType&&<p className="text-slate-600">고용형태: {selected.employmentType}</p>}</div><p className="mt-5 text-sm font-bold">공고 상세정보</p>{detailQuery.isLoading&&<p className="mt-2 text-sm text-slate-500">상세정보를 확인하는 중...</p>}{detailQuery.isError&&<p className="mt-2 text-xs text-slate-500">상세정보를 불러오지 못했습니다. 고용24 원문에서 확인해주세요.</p>}{detailQuery.isSuccess&&<p className="mt-2 text-xs text-slate-500">고용24 상세공고를 조회했습니다. 자세한 지원조건과 모집내용은 원문에서 확인해주세요.</p>}<a href={selected.detailUrl||`https://www.work24.go.kr/`} target="_blank" rel="noopener noreferrer" className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0967f6] px-5 py-4 text-sm font-black text-white">고용24에서 공고 확인하기 <ExternalLink size={17}/></a></div></div>}
    </div>
  </div>;
}
