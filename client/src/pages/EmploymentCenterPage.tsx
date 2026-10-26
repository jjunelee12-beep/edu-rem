import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import EmploymentKakaoMap, { type EmploymentMapJob, type LocatedEmploymentJob } from "@/components/EmploymentKakaoMap";
import { ArrowLeft, ArrowRight, BriefcaseBusiness, ChevronLeft, ChevronRight, Clock3, ExternalLink, LocateFixed, LockKeyhole, MapPin, Search, ShieldCheck, SlidersHorizontal, X } from "lucide-react";

const BANNER = "/images/employment/practice-banner.png";
const PRACTICE_URL = "https://narangedu.liveklass.com/classes/257714";
const COMPANY_IMAGE = "/images/employment/company-default.png";
const SESSION_KEY = "withone-employment-session";
const STUDENT_PORTAL_URL = "https://edu-crm-five.vercel.app/portal/with-one";
type Job = EmploymentMapJob & { employmentType?: string; registeredAt?: string; closesAt?: string; detailUrl?: string; occupationCode?: string };

function kmBetween(a: {lat:number;lng:number}, b: {lat:number;lng:number}) {
  const r = Math.PI / 180, dLat = (b.lat-a.lat)*r, dLng=(b.lng-a.lng)*r;
  const v=Math.sin(dLat/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin(dLng/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(v),Math.sqrt(1-v));
}
function readSession(): {token:string; expiresAt:number}|null {
  try { const data=JSON.parse(sessionStorage.getItem(SESSION_KEY)||"null"); return data?.token && data.expiresAt>Date.now()?data:null; } catch { return null; }
}
function shortDate(value?: string) { if (!value) return "미정"; const s=String(value); return s.length===8 && /^\d{8}$/.test(s)?`${s.slice(0,4)}.${s.slice(4,6)}.${s.slice(6,8)}`:s; }

export default function EmploymentCenterPage() {
  const [session,setSession]=useState<{token:string;expiresAt:number}|null>(()=>readSession());
  const [name,setName]=useState("");
  const [phone,setPhone]=useState("");
  const [loginError,setLoginError]=useState("");
  const [page,setPage]=useState(1);
  const [keyword,setKeyword]=useState("");
  const [draftKeyword,setDraftKeyword]=useState("");
  const [sort,setSort]=useState<"recent"|"distance">("recent");
  const [searchAddress,setSearchAddress]=useState("");
const [regionFilter, setRegionFilter] = useState("");
const [work24Region, setWork24Region] = useState("");
const [selectedProvince, setSelectedProvince] = useState("");
const [selectedDistrict, setSelectedDistrict] = useState("");
  const [draftAddress,setDraftAddress]=useState("");
  const [referencePoint,setReferencePoint]=useState<{lat:number;lng:number}|null>(null);
  const [locatedJobs,setLocatedJobs]=useState<LocatedEmploymentJob[]>([]);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [showDetail,setShowDetail]=useState(false);
  const [showList,setShowList]=useState(true);
  const [bannerFailed,setBannerFailed]=useState(false);
  const [imageFailed,setImageFailed]=useState(false);
  const verify=trpc.employmentCenter.verifyMember.useMutation();
const regionsQuery = trpc.employmentCenter.regions.useQuery(
  { token: session?.token || "" },
  {
    enabled: !!session?.token,
    refetchOnWindowFocus: false,
    staleTime: 24 * 60 * 60 * 1000,
    retry: false,
  }
);

const provinces = regionsQuery.data || [];

const districts =
  provinces.find((region) => region.code === selectedProvince)
    ?.children || [];
  const jobsQuery = trpc.employmentCenter.jobs.useQuery(
  {
    token: session?.token || "",
    page,
    size: 30,
    ...(work24Region ? { region: work24Region } : {}),
  },
  {
    enabled: !!session?.token,
    refetchOnWindowFocus: false,
    retry: false,
  }
);
  const jobs=useMemo<Job[]>(()=> (jobsQuery.data?.jobs||[]) as Job[],[jobsQuery.data]);
  const detailQuery=trpc.employmentCenter.jobDetail.useQuery({token:session?.token||"",wantedAuthNo:selectedId||""},{enabled:!!session?.token && !!selectedId && showDetail,retry:false,refetchOnWindowFocus:false});
  const selected=jobs.find(j=>j.id===selectedId)||null;
  const positions=useMemo(()=>new Map(locatedJobs.map(j=>[j.id,j])),[locatedJobs]);
const mapJobs = useMemo(() => {
  const q = keyword.trim().toLowerCase();
  const region = regionFilter.trim().toLowerCase();

  return jobs.filter((job) => {
    const text = `${job.company} ${job.title} ${job.address}`.toLowerCase();
    const address = (job.address || "").toLowerCase();

    return (
      (!q || text.includes(q)) &&
      (!region || address.includes(region))
    );
  });
}, [jobs, keyword, regionFilter]);
  const filtered=useMemo(()=>{
    const q = keyword.trim().toLowerCase();
const region = regionFilter.trim().toLowerCase();

const list = jobs.filter((j) => {
  const text = `${j.company} ${j.title} ${j.address}`.toLowerCase();
  const address = (j.address || "").toLowerCase();

  const matchesKeyword = !q || text.includes(q);
  const matchesRegion = !region || address.includes(region);

  return matchesKeyword && matchesRegion;
});
    if(sort==="distance"&&referencePoint) list.sort((a,b)=>{
      const pa=positions.get(a.id),pb=positions.get(b.id);
      const da=pa?.latitude!=null&&pa.longitude!=null?kmBetween(referencePoint,{lat:pa.latitude,lng:pa.longitude}):Infinity;
      const db=pb?.latitude!=null&&pb.longitude!=null?kmBetween(referencePoint,{lat:pb.latitude,lng:pb.longitude}):Infinity;
      return da-db;
    });
    return list;
 },[jobs,keyword,regionFilter,sort,referencePoint,positions]);
  const total=jobsQuery.data?.total||0;
  const totalPages=Math.max(1,Math.ceil(total/30));

  useEffect(()=>{
    if(!session)return;
    const ms=session.expiresAt-Date.now();
    if(ms<=0){setSession(null);return;}
    const t=window.setTimeout(()=>{setSession(null);sessionStorage.removeItem(SESSION_KEY);},ms);
    return ()=>window.clearTimeout(t);
  },[session]);
  useEffect(() => {
  setSelectedId(null);
  setShowDetail(false);
  setLocatedJobs([]);
}, [page, work24Region]);
  useEffect(() => {
  if (!searchAddress || !window.kakao?.maps?.services) return;

  const kakao = window.kakao;
  const geocoder = new kakao.maps.services.Geocoder();

  geocoder.addressSearch(searchAddress, (items: any[], status: string) => {
    if (status === kakao.maps.services.Status.OK && items?.length) {
      setReferencePoint({
        lat: Number(items[0].y),
        lng: Number(items[0].x),
      });
      return;
    }

    const places = new kakao.maps.services.Places();

    places.keywordSearch(searchAddress, (results: any[], placeStatus: string) => {
      if (placeStatus === kakao.maps.services.Status.OK && results?.length) {
        setReferencePoint({
          lat: Number(results[0].y),
          lng: Number(results[0].x),
        });
      } else {
        setReferencePoint(null);
      }
    });
  });
}, [searchAddress]);
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

  setSearchAddress(address);
setPage(1);

const kakao = window.kakao;
  if (!kakao?.maps?.services) return;

  const places = new kakao.maps.services.Places();

  places.keywordSearch(address, (results: any[], status: string) => {
    if (status === kakao.maps.services.Status.OK && results?.length) {
      setReferencePoint({
        lat: Number(results[0].y),
        lng: Number(results[0].x),
      });
    }
  });
}
  function findCurrentLocation(){
    if(!navigator.geolocation){alert("위치 서비스를 사용할 수 없습니다.");return;}
    navigator.geolocation.getCurrentPosition(pos=>{
      setReferencePoint({lat:pos.coords.latitude,lng:pos.coords.longitude});
      const kakao=window.kakao;
      if(kakao?.maps?.services){new kakao.maps.services.Geocoder().coord2Address(pos.coords.longitude,pos.coords.latitude,(result:any[],status:string)=>{
        if(status===kakao.maps.services.Status.OK&&result?.[0]){const addr=result[0].road_address?.address_name||result[0].address?.address_name||"";setDraftAddress(addr);setSearchAddress(addr);}
      });}
    },()=>alert("현재 위치를 확인할 수 없습니다. 주소를 직접 입력해주세요."),{enableHighAccuracy:false,timeout:10000});
  }

  if(!session)return <div className="min-h-screen bg-[#f3f7fc] text-slate-900">
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-8">
      <a
  href={STUDENT_PORTAL_URL}
  className="mb-12 inline-flex items-center gap-2 text-sm font-semibold text-slate-500"
>
  <ArrowLeft size={17} />
  학생일정포털로 돌아가기
</a>
      <div className="mb-7 flex h-16 w-16 items-center justify-center rounded-[22px] bg-[#0967f6] text-white shadow-lg shadow-blue-200"><BriefcaseBusiness size={31}/></div>
      <p className="text-sm font-extrabold tracking-wide text-blue-600">WITHONE EDUCATION</p>
      <h1 className="mt-2 text-[31px] font-black leading-tight tracking-tight">위드원교육<br/>취업정보센터</h1>
      <p className="mt-4 text-[15px] leading-7 text-slate-500">사회복지 분야 채용정보를 지도에서 한눈에 확인하세요.<br/>등록회원이라면 무료로 이용할 수 있습니다.</p>
      <form onSubmit={login} className="mt-9 rounded-[28px] bg-white p-6 shadow-[0_15px_50px_rgba(15,49,92,.07)]">
        <div className="mb-5 flex items-center gap-2 text-lg font-black"><ShieldCheck size={22} className="text-blue-600"/> 등록회원 확인</div>
        <label className="mb-2 block text-sm font-bold text-slate-700">이름</label>
        <input value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="등록하신 이름" className="mb-5 h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base outline-none focus:border-blue-500"/>
        <label className="mb-2 block text-sm font-bold text-slate-700">휴대폰 번호</label>
        <input value={phone} onChange={e=>setPhone(e.target.value)} inputMode="tel" autoComplete="tel" placeholder="01012345678" className="h-13 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base outline-none focus:border-blue-500"/>
        {loginError&&<p role="alert" className="mt-3 text-sm text-red-600">{loginError}</p>}
        <button disabled={verify.isPending} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0967f6] px-5 py-4 text-base font-black text-white disabled:opacity-60">{verify.isPending?"확인 중...":"채용정보 확인하기"}<ArrowRight size={19}/></button>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400"><LockKeyhole size={13}/> 이름과 연락처로 등록 여부만 확인합니다.</p>
      </form>
      <p className="mt-auto pt-10 text-center text-xs text-slate-400">채용정보 제공: 고용24 · 채용 여부는 공고에서 확인해주세요.</p>
    </div>
  </div>;

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
              <div className="mt-3 grid grid-cols-2 gap-2">
          <select
            aria-label="시·도 선택"
            value={selectedProvince}
            disabled={regionsQuery.isLoading || regionsQuery.isError}
            onChange={(e) => {
              const code = e.target.value;

              setSelectedProvince(code);
setSelectedDistrict("");
setWork24Region(code);
setRegionFilter("");
setPage(1);

const province = provinces.find((region) => region.code === code);

if (province) {
  setSearchAddress(province.name);
} else {
  setSearchAddress("");
}
            }}
            className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700"
          >
            <option value="">전국 시·도</option>
            {provinces.map((region) => (
              <option key={region.code} value={region.code}>
                {region.name}
              </option>
            ))}
          </select>

          <select
            aria-label="시·군·구 선택"
            value={selectedDistrict}
            disabled={!selectedProvince || districts.length === 0}
            onChange={(e) => {
              const code = e.target.value;

              setSelectedDistrict(code);
setWork24Region(code || selectedProvince);
setPage(1);

const province = provinces.find(
  (region) => region.code === selectedProvince
);

const district = districts.find(
  (region) => region.code === code
);

setSearchAddress(
  [province?.name, district?.name].filter(Boolean).join(" ")
);
            }}
            className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700"
          >
            <option value="">전체 시·군·구</option>
            {districts.map((district) => (
              <option key={district.code} value={district.code}>
                {district.name}
              </option>
            ))}
          </select>
        </div>

        {regionsQuery.isError && (
          <p className="mt-2 text-xs text-red-600">
            지역 목록을 불러오지 못했습니다.
            <button
              type="button"
              onClick={() => regionsQuery.refetch()}
              className="ml-2 font-bold underline"
            >
              다시 시도
            </button>
          </p>
        )}
      </header>

      <div className="relative h-[42vh] min-h-[280px] max-h-[470px] bg-slate-100">
        <EmploymentKakaoMap
  jobs={mapJobs}
  selectedId={selectedId}
  searchAddress={searchAddress}
  onSelectJob={selectJob}
  onLocatedJobsChange={setLocatedJobs}
  className="h-full w-full"
/>
        <div className="pointer-events-none absolute left-4 top-4 rounded-full bg-white/95 px-3 py-2 text-xs font-extrabold text-blue-700 shadow-md">지도에 표시된 공고 {locatedJobs.filter(j=>j.latitude!=null&&j.longitude!=null).length}건</div>
        <button onClick={()=>setShowList(v=>!v)} className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-black text-blue-700 shadow-lg"><SlidersHorizontal size={16}/>{showList?"목록 접기":"공고 목록 보기"}</button>
      </div>
      {showList&&<section className="relative z-10 -mt-3 flex-1 rounded-t-[28px] bg-white px-4 pb-12 pt-5 shadow-[0_-8px_30px_rgba(14,41,80,.08)]">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200"/>
        <div className="flex items-end justify-between"><div><p className="text-xs font-bold text-blue-600">사회복지 분야 채용정보</p><h2 className="mt-1 text-[21px] font-black">채용공고 <span className="text-blue-600">{total.toLocaleString()}건</span></h2></div><p className="text-[11px] text-slate-400">출처: 고용24</p></div>
        <form onSubmit={e=>{e.preventDefault();setKeyword(draftKeyword)}} className="mt-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3"><Search size={18} className="text-slate-400"/><input value={draftKeyword} onChange={e=>setDraftKeyword(e.target.value)} placeholder="회사명 또는 공고명 검색 (현재 페이지)" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"/><button className="text-xs font-extrabold text-blue-600">검색</button></form>
        <div className="mt-3 flex items-center justify-between"><div className="flex gap-2"><button onClick={()=>setSort("recent")} className={`rounded-full px-3 py-2 text-xs font-bold ${sort==="recent"?"bg-blue-600 text-white":"bg-slate-100 text-slate-600"}`}>최신순</button><button onClick={()=>setSort("distance")} className={`rounded-full px-3 py-2 text-xs font-bold ${sort==="distance"?"bg-blue-600 text-white":"bg-slate-100 text-slate-600"}`}>거리순</button></div><span className="text-[11px] text-slate-400">{page} / {totalPages} 페이지</span></div>
{(regionFilter || work24Region) && (
  <button
    type="button"
    onClick={() => {
      setRegionFilter("");
setWork24Region("");
setSelectedProvince("");
setSelectedDistrict("");
setSearchAddress("");
setDraftAddress("");
setReferencePoint(null);
setSort("recent");
setPage(1);
    }}
    className="mt-3 rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700"
  >
    지역 검색 해제 ×
  </button>
)}       
 {sort==="distance"&&!referencePoint&&<p className="mt-3 rounded-xl bg-blue-50 px-3 py-2 text-xs text-blue-700">거리순 정렬은 상단에서 기준 주소를 검색하거나 현재 위치를 선택해주세요.</p>}
        {jobsQuery.isLoading&&<p className="py-12 text-center text-sm text-slate-500">채용공고를 불러오는 중입니다...</p>}
        {jobsQuery.isError&&<div className="py-8 text-center text-sm text-red-600"><p>{jobsQuery.error.message}</p><button onClick={()=>jobsQuery.refetch()} className="mt-3 rounded-xl bg-blue-600 px-4 py-2 font-bold text-white">다시 시도</button></div>}
        {!jobsQuery.isLoading&&!jobsQuery.isError&&filtered.length===0&&<p className="py-12 text-center text-sm text-slate-500">검색 조건에 맞는 채용공고가 없습니다.</p>}
        <div className="mt-4 space-y-3">{filtered.map(job=>{
          const pos=positions.get(job.id);
          const distance=referencePoint&&pos?.latitude!=null&&pos.longitude!=null?kmBetween(referencePoint,{lat:pos.latitude,lng:pos.longitude}):null;
          return <button key={job.id} onClick={()=>selectJob(job)} className={`flex w-full gap-3 rounded-2xl border p-3.5 text-left transition-colors ${selectedId===job.id?"border-blue-400 bg-blue-50":"border-slate-100 bg-white shadow-[0_4px_16px_rgba(18,48,88,.05)]"}`}>
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-blue-50">{!imageFailed?<img src={COMPANY_IMAGE} alt="공통 복지시설 이미지" className="h-full w-full object-cover" onError={()=>setImageFailed(true)}/>:<div className="flex h-full w-full items-center justify-center text-blue-500"><BriefcaseBusiness size={26}/></div>}</div>
            <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-blue-600">{job.company||"회사명 미표기"}</p><h3 className="mt-1 line-clamp-2 text-[14px] font-extrabold leading-snug">{job.title}</h3><p className="mt-2 flex items-start gap-1 text-xs text-slate-500"><MapPin size={13} className="mt-0.5 shrink-0"/><span className="line-clamp-1">{job.address||"근무지 확인 필요"}{distance!==null?` · ${distance.toFixed(1)}km`:""}</span></p><div className="mt-2 flex items-center justify-between gap-1"><span className="line-clamp-1 text-xs font-extrabold text-slate-800">{job.salary||"급여 정보 확인"}</span><span className="shrink-0 text-[11px] text-slate-400">{shortDate(job.closesAt)} 마감</span></div></div>
          </button>;
        })}</div>
        {totalPages>1&&<div className="mt-6 flex items-center justify-center gap-4"><button disabled={page<=1} onClick={()=>setPage(v=>v-1)} className="flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-30"><ChevronLeft size={17}/> 이전</button><span className="text-sm font-bold">{page} / {totalPages}</span><button disabled={page>=totalPages} onClick={()=>setPage(v=>v+1)} className="flex items-center gap-1 rounded-xl border px-3 py-2 text-sm font-bold disabled:opacity-30">다음 <ChevronRight size={17}/></button></div>}
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
