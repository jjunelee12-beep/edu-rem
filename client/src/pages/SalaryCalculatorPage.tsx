import { useState } from 'react';
import { salaryYears, latestSalaryYear, getSalaryYear, getSalaryFacilities, getSalaryRanks, getSalarySteps, getSalaryTable } from '../data/salary';
import SalaryTable from '../components/salary/SalaryTable';
import SalaryCalculator from '../components/salary/SalaryCalculator';
import CareerCalculator from '../components/salary/CareerCalculator';
import SalaryComparison from '../components/salary/SalaryComparison';

const tabs = [ ['table','사회복지사 급여표'], ['salary','급여 계산기'], ['career','호봉 계산기'], ['compare','연도별 급여 비교'] ] as const;
type Tab = typeof tabs[number][0];
const field = 'mt-1 block w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 focus:border-blue-500 focus:outline-none';
export default function SalaryCalculatorPage() {
  const [tab,setTab] = useState<Tab>('table');
  const [year,setYear] = useState(latestSalaryYear);
  const [facility,setFacility] = useState('사회·노인 이용시설(사회복지직)');
  const [rank,setRank] = useState('사회복지사');
  const [step,setStep] = useState(1);
  const data = getSalaryYear(year);
  const facilities = getSalaryFacilities(year);
  const f = facilities.includes(facility) ? facility : facilities[0] ?? '';
  const ranks = getSalaryRanks(year,f);
  const r = ranks.includes(rank) ? rank : ranks.includes('사회복지사') ? '사회복지사' : ranks[0] ?? '';
  const steps = getSalarySteps(year,f,r);
  const s = steps.includes(step) ? step : steps.filter(n=>n<=step).slice(-1)[0] ?? steps[0] ?? 1;
  const home = typeof window !== 'undefined' && ['welfareon.kr','www.welfareon.kr'].includes(window.location.hostname) ? '/' : '/employment-center';
  const valid = !!data && !!f && !!r && steps.length > 0;
  const openSalary = (nextRank:string,nextStep:number) => { setRank(nextRank); setStep(nextStep); setTab('salary'); };
  return <div className="min-h-dvh bg-slate-100 text-slate-900">
    <main className="mx-auto min-h-dvh max-w-[960px] bg-slate-50 pb-10">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <a href={home} className="flex min-w-0 items-center gap-2"><img src="/images/employment-center/social-welfare-symbol-only.png" alt="" className="h-10 w-10 shrink-0 object-contain"/><div><p className="text-xs font-bold text-blue-600">사회복지 통합지원센터</p><p className="text-sm font-bold">급여·호봉 정보</p></div></a>
        <a href={home} className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold">센터 홈</a>
      </header>
      <div className="space-y-4 p-4 sm:p-6">
        <section className="rounded-2xl bg-gradient-to-br from-blue-700 to-blue-500 p-5 text-white sm:p-7"><p className="text-xs font-semibold text-blue-100">보건복지부 인건비 가이드라인 기준</p><h1 className="mt-2 text-xl font-bold sm:text-2xl">사회복지사 급여·호봉 정보</h1><p className="mt-2 text-sm leading-6 text-blue-50">공식 기본급과 예상 급여, 경력에 따른 호봉을 한곳에서 확인하세요.</p></section>
        <nav aria-label="급여 정보 메뉴" className="grid grid-cols-2 gap-2 sm:grid-cols-4">{tabs.map(([key,label])=><button type="button" key={key} aria-pressed={tab===key} onClick={()=>setTab(key)} className={`rounded-xl border px-2 py-3 text-sm font-bold ${tab===key?'border-blue-600 bg-blue-600 text-white':'border-slate-200 bg-white text-slate-700 hover:bg-blue-50'}`}>{label}</button>)}</nav>
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"><h2 className="font-bold">조회 조건</h2><div className="grid gap-3 sm:grid-cols-2">
          {tab!=='compare'&&<label className="block text-sm font-medium">기준 연도<select className={field} value={year} onChange={e=>setYear(Number(e.target.value))}>{salaryYears.map(y=><option key={y.year} value={y.year}>{y.year}년</option>)}</select></label>}
          <label className="block text-sm font-medium">시설 유형<select className={field} value={f} onChange={e=>{setFacility(e.target.value);setRank('사회복지사');setStep(1);}}>{facilities.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
          <label className="block text-sm font-medium">{tab==='table'?'강조할 직급':'직급'}<select className={field} value={r} onChange={e=>{setRank(e.target.value);setStep(1);}}>{ranks.map(v=><option key={v} value={v}>{v}</option>)}</select></label>
          {tab!=='career'&&<label className="block text-sm font-medium">호봉<select className={field} value={s} onChange={e=>setStep(Number(e.target.value))}>{steps.map(v=><option key={v} value={v}>{v}호봉</option>)}</select></label>}
        </div>{tab==='compare'&&<p className="text-xs text-slate-500">전체 연도를 비교합니다. 선택 가능한 직급과 호봉은 {year}년 기준입니다.</p>}</section>
        {!valid?<p role="alert" className="rounded-xl bg-white p-4 text-sm text-slate-600">해당 조건의 공식 급여 데이터가 없습니다.</p>:<section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 sm:p-5">
          <div hidden={tab!=='table'}><SalaryTable rows={getSalaryTable(year,f)} selectedRank={r} selectedStep={s} onSelect={row=>openSalary(row.rank,row.step)}/></div>
          <div hidden={tab!=='salary'}><SalaryCalculator year={year} facility={f} rank={r} step={s}/></div>
          <div hidden={tab!=='career'}><CareerCalculator year={year} facility={f} rank={r} onStep={n=>openSalary(r,n)}/></div>
          <div hidden={tab!=='compare'}><SalaryComparison facility={f} rank={r} step={s}/></div>
        </section>}
        <footer className="space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-xs leading-5 text-slate-600"><h2 className="font-bold">자료 출처 및 이용 안내</h2><p>보건복지부 사회복지시설 종사자 인건비 가이드라인. 권고 기준이며 실제 급여는 시설·지방자치단체 지침 및 근로조건에 따라 달라집니다. 어린이집 및 노인장기요양보험법에 따른 노인의료복지시설·재가노인복지시설 등 적용 제외 시설은 별도 기준을 확인하세요.</p>{(tab==='compare'?salaryYears:data?[data]:[]).map(y=><div key={y.year}>{y.source&&/^https?:\/\//i.test(y.source)?<a className="text-blue-700 underline" href={y.source} target="_blank" rel="noopener noreferrer">{y.sourceInfo.title}</a>:<span>{y.sourceInfo.title}</span>}<span> · {y.sourceInfo.pages}</span></div>)}<p>호봉 계산은 365일 단위 추정이며 실수령액은 직접 입력한 공제액 기준입니다.</p></footer>
      </div>
    </main>
  </div>;
}
