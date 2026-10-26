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
} from "lucide-react";

const BANNER = "/images/employment/practice-banner.png";
const PRACTICE_URL = "https://narangedu.liveklass.com/classes/257714";
const COMPANY_IMAGE = "/images/employment/company-default.png";
const SESSION_KEY = "withone-employment-session";
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

export default function EmploymentCenterPage() {
  const [session,setSession]=useState<{token:string;expiresAt:number}|null>(()=>readSession());
  const [name,setName]=useState("");
  const [phone,setPhone]=useState("");
  const [loginError,setLoginError]=useState("");
  const [keyword,setKeyword]=useState("");
  const [draftKeyword,setDraftKeyword]=useState("");
  const [searchAddress,setSearchAddress]=useState("");
  const [draftAddress,setDraftAddress]=useState("");
  const [referencePoint,setReferencePoint]=useState<{lat:number;lng:number}|null>(null);
// 주소 검색과 GPS 요청의 순서를 관리
const locationRequestRef = useRef(0);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [showDetail,setShowDetail]=useState(false);
  const [showList,setShowList]=useState(true);
  const [bannerFailed,setBannerFailed]=useState(false);
  const [imageFailed,setImageFailed]=useState(false);
  const verify=trpc.employmentCenter.verifyMember.useMutation();
 const jobsQuery = trpc.employmentCenter.nearbyJobs.useQuery(
  {
    token: session?.token || "",
    lat: referencePoint?.lat ?? 37.5665,
    lng: referencePoint?.lng ?? 126.978,
  },
  {
    enabled: !!session?.token && !!referencePoint,
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
  const detailQuery=trpc.employmentCenter.jobDetail.useQuery({token:session?.token||"",wantedAuthNo:selectedId||""},{enabled:!!session?.token && !!selectedId && showDetail,retry:false,refetchOnWindowFocus:false});
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

  useEffect(()=>{
    if(!session)return;
    const ms=session.expiresAt-Date.now();
    if(ms<=0){setSession(null);return;}
    const t=window.setTimeout(()=>{setSession(null);sessionStorage.removeItem(SESSION_KEY);},ms);
    return ()=>window.clearTimeout(t);
  },[session]);
  
  async function login(e:React.FormEvent){
    e.preventDefault();setLoginError("");
    const digits=phone.replace(/\D/g,"");
    if(name.trim().length<2||digits.length<10||digits.length>11){setLoginError("이름과 휴대폰 번호를 정확히 입력해주세요.");return;}
    try{
      const res=await verify.mutateAsync({clientName:name.trim(),phone:digits});
      if(!res.success||!res.token){setLoginError(res.message||"등록회원 정보를 확인하지 못했습니다.");return;}
      const next={token:res.token,expiresAt:Date.now()+res.expiresInSeconds*1000};
      sessionStorage.setItem(SESSION_KEY,JSON.stringify(next));setSession(next);
    }catch(err:any){setLoginError(err?.message||"회원 확인 중 오류가 발생했습니다.");}
  }
  function logout(){sessionStorage.removeItem(SESSION_KEY);setSession(null);setSelectedId(null);setShowDetail(false);}
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

    if (!session) return (
    <div className="min-h-screen bg-[#f2f7fd] text-slate-900">
      <div className="mx-auto min-h-screen max-w-[430px] bg-[#f2f7fd]">

        {/* 상단 배너 */}
        <div className="relative">
          <img
            src="/images/withone-employment-hero.png"
            alt="위드원교육 취업정보센터"
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
                위드원교육 수강생이라면
                <br />
                지금 바로 취업정보센터를 이용하실 수 있습니다.
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
              {verify.isPending ? "확인 중..." : "채용정보 확인하기"}
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
              아직 수강생이 아니신가요?
            </h3>

            <p className="mt-2 text-[12px] leading-5 text-slate-600">
              위드원교육의 사회복지사 자격증
              <br />
              교육과정을 확인해보세요.
            </p>

            <a
              href="https://edu-crm-five.vercel.app/team/with-one"
              className="mt-4 flex h-[42px] w-full items-center justify-center gap-2 rounded-xl border border-[#0967f6] bg-white text-[13px] font-bold text-[#0967f6]"
            >
              교육과정 보러가기
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
          <div className="flex items-center gap-2.5"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0967f6] text-white"><BriefcaseBusiness size={22}/></span><div><p className="text-[11px] font-extrabold tracking-wide text-blue-600">WITHONE EDUCATION</p><h1 className="text-[19px] font-black tracking-tight">취업정보센터</h1></div></div>
          <div className="flex items-center gap-2">
  <a
    href={STUDENT_PORTAL_URL}
    className="flex items-center gap-1 rounded-xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"
  >
    <ArrowLeft size={14} />
    학생일정포털
  </a>

  <button
    type="button"
    onClick={logout}
    className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-500"
  >
    나가기
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
      <p className="text-xs font-bold text-blue-600">위드원교육 안내</p>
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
