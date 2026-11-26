import { useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, GraduationCap, MapPin, Clock3, CheckCircle2, ChevronDown, FileText, ShieldCheck } from "lucide-react";

const BANNER = "/images/employment-center/practice-support-banner.png";
const FAQ = [
  ["실습 160시간만 하면 끝나나요?", "사회복지현장실습은 하나의 교과목입니다. 보통 약 4개월의 수강기간 중 지정된 실습인정기간에 현장실습 160시간을 이수하고, 세미나 등 교육원의 수업 요건도 충족해야 합니다."],
  ["대면 세미나는 실습기관에서 듣나요?", "아닙니다. 사회복지현장실습 과목을 수강하는 교육원의 지정 장소와 일정에 맞춰 참석합니다."],
  ["세미나와 실습을 따로 진행할 수 있나요?", "동일한 사회복지현장실습 과목에서 정한 일정과 인정 기준에 맞춰 모두 이수해야 합니다."],
  ["주말에만 실습할 수 있나요?", "주말 실습을 운영하는 기관의 수용 가능 인원과 교육원의 실습인정기간이 맞아야 합니다."],
  ["실습기관에 연락하면 무조건 받아주나요?", "기관마다 실습 가능 인원과 모집 일정, 면접 및 선발 기준이 달라 사전 확인이 필요합니다."],
];
const steps = ["회원님의 거주지와 실습 가능 일정 확인", "대면 세미나 및 실습인정기간에 맞는 교육원 확인", "실습 가능 기관 직접 확인 및 배정 지원", "기관 면접 및 실습 가능 여부 확인", "실습 신청서와 필요 서류 안내"];

export default function PracticeSupportPage() {
  const [open, setOpen] = useState<number | null>(0);
  const apply = () => {
  window.location.assign("/practice-support/apply");
};
  return (
    <main className="min-h-screen bg-[#f5f8fd] text-slate-900 [color-scheme:light]">
      <div className="mx-auto min-h-screen max-w-[480px] bg-white pb-32 shadow-sm">
        <header
  className="sticky top-0 z-30 flex h-14 items-center justify-center px-4 !bg-[#124687] !text-white"
  style={{
    backgroundColor: "#124687",
    color: "#ffffff",
  }}
>
          <a href="/employment-center" aria-label="통합지원센터로 돌아가기" className="absolute left-4 p-1"><ArrowLeft size={23}/></a>
          <h1 className="text-[17px] font-bold">실습배정지원센터</h1>
        </header>
        <img src={BANNER} alt="사회복지현장실습, 혼자 준비하지 마세요" className="block aspect-video w-full object-contain bg-blue-50" />
        <div className="space-y-10 px-5 py-7">
          <section>
            <p className="text-xs font-bold tracking-wide text-blue-700">실습 배정 안내</p>
            <h2 className="mt-2 text-[23px] font-black leading-snug">실습 배정은 왜 필요할까요?</h2>
            <p className="mt-3 text-[15px] leading-7 text-slate-600">현장실습은 기관만 찾는다고 끝나는 과정이 아닙니다. 다음 세 가지 일정이 모두 맞아야 안전하게 진행할 수 있습니다.</p>
            <div className="mt-5 space-y-2.5">
              {[
                {icon: CalendarDays, title:"회원 일정", desc:"평일·주말 및 실습 가능 시간"},
                {icon: GraduationCap, title:"실습교육원", desc:"실습인정기간 및 대면 세미나 일정"},
                {icon: MapPin, title:"실습기관", desc:"실습 가능 인원 및 운영 일정"},
              ].map(({icon: Icon,title,desc}) => <div key={title} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-4"><div className="rounded-xl bg-blue-50 p-3 text-blue-700"><Icon size={23}/></div><div><h3 className="font-bold">{title}</h3><p className="mt-1 text-sm text-slate-600">{desc}</p></div></div>)}
            </div>
          </section>
          <section>
            <h2 className="text-xl font-black">실습 일정은 이렇게 맞춰야 합니다</h2>
            <div className="mt-4 rounded-2xl bg-slate-50 p-4">
              <p className="text-xs font-bold text-blue-700">일정 예시 · 실제 일정은 교육원별 상이</p>
              <p className="mt-2 font-bold">3~6월 사회복지현장실습 수강</p>
              <div className="mt-4 grid grid-cols-4 gap-1 text-center text-xs font-bold text-slate-600">{["3월","4월","5월","6월"].map(m=><span key={m}>{m}</span>)}</div>
              <div className="mt-2 rounded-lg bg-blue-100 p-2 text-center text-xs font-bold text-blue-800">전체 교과목 수강기간</div>
              <div className="mt-2 grid grid-cols-4 gap-1"><div/><div className="col-span-2 rounded-lg bg-blue-700 p-2 text-center text-xs font-bold text-white">실습인정기간 예시</div><div/></div>
              <p className="mt-3 text-sm leading-6 text-slate-600">지정된 인정기간 안에 160시간을 이수하고 세미나 일정에도 출석해야 합니다.</p>
            </div>
            <div className="mt-3 space-y-2">{[["평일 4시간","40일"],["평일 8시간","20일"],["주말 토·일 각 8시간","10주"]].map(([a,b])=><div key={a} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-sm"><span className="flex items-center gap-2"><Clock3 size={16} className="text-blue-600"/>{a}</span><strong>{b}</strong></div>)}</div>
            <div className="mt-4 rounded-xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">인정기간 밖의 실습은 인정되지 않을 수 있으며, 필수 세미나 출석 요건을 충족하지 못하면 과락 또는 재수강이 발생할 수 있습니다.</div>
          </section>
          <section>
            <h2 className="text-xl font-black leading-snug">실습배정지원센터에서는<br/>어떻게 도와드릴까요?</h2>
            <p className="mt-3 text-[15px] leading-7 text-slate-600">특정 교육원의 일정에만 맞추기보다 거주지와 회원님의 일정에 맞는 교육원을 확인하고, 실습기관도 직접 확인하여 배정을 지원합니다.</p>
            <div className="mt-5 space-y-3">{steps.map((step,i)=><div key={step} className="flex items-center gap-3 rounded-xl border border-slate-200 p-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-700 text-sm font-bold text-white">{i+1}</span><span className="text-sm font-semibold leading-6">{step}</span></div>)}</div>
            <div className="mt-4 flex gap-3 rounded-2xl bg-blue-50 p-4 text-sm leading-6 text-blue-900"><CheckCircle2 className="mt-1 shrink-0" size={20}/><p>기관 목록만 전달하는 것이 아니라 실습 가능 여부 확인부터 배정까지 지원합니다. 최종 실습은 기관의 면접 및 승인 결과에 따라 확정됩니다.</p></div>
          </section>
          <section>
            <h2 className="text-xl font-black">실습 서류 준비 절차</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 p-4"><FileText className="mb-2 text-blue-700"/><h3 className="font-bold">1차 · 선이수 조건 확인</h3><p className="mt-2 text-sm leading-6 text-slate-600">전공필수 4과목과 전공선택 2과목 등 교육원이 요구하는 선이수 조건을 확인하고 해당 과목의 성적증명서를 준비합니다. 세부 기준은 교육원별로 확인해야 합니다.</p></div>
              <div className="rounded-2xl border border-slate-200 p-4"><FileText className="mb-2 text-blue-700"/><h3 className="font-bold">2차 · 실습 신청 서류</h3><p className="mt-2 text-sm leading-6 text-slate-600">실습기관이 정해지면 교육원 양식에 맞춰 실습신청서 및 실습기관 관련 서류를 준비합니다.</p></div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">{[["실습 세미나","30시간"],["현장실습","160시간"]].map(([a,b])=><div key={a} className="rounded-2xl bg-blue-50 p-4 text-center"><p className="text-sm font-bold text-blue-800">{a}</p><p className="mt-2 text-2xl font-black text-blue-900">{b}</p></div>)}</div>
            <p className="mt-2 text-xs leading-5 text-slate-500">현행 사회복지사 과정 기준이며 구법 적용 대상자는 별도 기준을 확인해야 합니다.</p>
          </section>
          <section>
            <h2 className="text-xl font-black">자주 묻는 질문</h2>
            <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200">{FAQ.map(([q,a],i)=><div key={q}><button type="button" aria-expanded={open===i} aria-controls={`practice-faq-${i}`} onClick={()=>setOpen(open===i?null:i)} className="flex w-full items-center justify-between gap-3 p-4 text-left text-sm font-bold"><span>{q}</span><ChevronDown size={18} className={`shrink-0 text-slate-500 transition-transform ${open===i?"rotate-180":""}`}/></button>{open===i&&<p id={`practice-faq-${i}`} className="px-4 pb-4 text-sm leading-6 text-slate-600">{a}</p>}</div>)}</div>
          </section>
          <section className="rounded-2xl bg-[#124687] p-5 text-white"><ShieldCheck size={28}/><h2 className="mt-3 text-xl font-black leading-snug">실습 때문에 자격증 취득을<br/>미루거나 포기하지 마세요.</h2><p className="mt-3 text-sm leading-6 text-blue-100">회원님의 상황에 맞는 안전한 실습 일정을 준비해 보세요.</p><button onClick={apply} className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-white p-3.5 font-bold text-[#124687]">실습 배정 신청하기 <ArrowRight size={18}/></button></section>
        </div>
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t border-slate-200 bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"><button onClick={apply} className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-[#124687] text-base font-bold text-white">실습 배정 신청하기 <ArrowRight size={20}/></button></div>
      </div>
    </main>
  );
}
