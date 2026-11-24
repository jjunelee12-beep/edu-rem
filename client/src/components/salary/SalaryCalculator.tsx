import { useState } from 'react';
import { calculateSalary, calculateDetailedSalary, won } from '../../lib/salary/salaryEngine';
import { getSalaryRules } from '../../data/salary';

export type SalaryCalculatorProps = { base?: number; year?: number; facility?: string; rank?: string; step?: number };
const inputClass = 'mt-1 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-blue-500 focus:outline-none';
function Field({label,value,onChange,integer=false,max,placeholder}:{label:string;value:string;onChange:(v:string)=>void;integer?:boolean;max?:number;placeholder?:string}) {
 return <label className="block min-w-0 text-sm font-medium text-slate-700">{label}<input className={inputClass} type="number" inputMode={integer?'numeric':'decimal'} min={0} max={max} step={integer?1:'any'} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/></label>;
}
const n=(v:string)=>Number(v)||0;
function Amount({label,value}:{label:string;value:number}) {return <div className="flex flex-wrap justify-between gap-2 text-sm"><span className="text-slate-600">{label}</span><strong className="tabular-nums text-slate-900">{won(value)}</strong></div>}
export default function SalaryCalculator({base,year,facility,rank,step}:SalaryCalculatorProps) {
 const [manual,setManual]=useState('');
 const [spouse,setSpouse]=useState(false);
 const [children,setChildren]=useState('0');
 const [other,setOther]=useState('0');
 const [payments,setPayments]=useState('2');
 const [extension,setExtension]=useState('0');
 const [night,setNight]=useState('0');
 const [holiday8,setHoliday8]=useState('0');
 const [holidayOver,setHolidayOver]=useState('0');
 const [extra,setExtra]=useState('0');
 const [bonus,setBonus]=useState('0');
 const [deduct,setDeduct]=useState('');
 const [ordinary,setOrdinary]=useState('');
 const official=year!==undefined && !!facility && !!rank && step!==undefined;
 const rules=year===undefined?undefined:getSalaryRules(year);
 const result=official?calculateDetailedSalary({year:year!,facility:facility!,rank:rank!,step:step!,spouse,children:n(children),otherDependents:n(other),holidayPayments:n(payments),extensionHours:n(extension),nightHours:n(night),holidayHoursUpTo8:n(holiday8),holidayHoursOver8:n(holidayOver),otherMonthlyAllowance:n(extra),otherAnnualBonus:n(bonus),ordinaryMonthlyWageOverride:ordinary===''?undefined:n(ordinary),monthlyDeductions:deduct===''?undefined:n(deduct)}):null;
 const legacy=calculateSalary(base??n(manual),n(extra),n(bonus),n(deduct));
 const values=[extra,bonus,deduct,...(official?[children,other,payments,extension,night,holiday8,holidayOver,ordinary]:base===undefined?[manual]:[])];
 const invalid=values.some(v=>v!==''&&(!Number.isFinite(Number(v))||Number(v)<0)) || (official&&([children,other,payments].some(v=>!Number.isInteger(n(v)))||n(payments)>(rules?.holiday.paymentsPerYear??2)));
 return <div className="min-w-0 space-y-4">
 <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
 <h2 className="font-bold text-slate-900">기본급 및 수당 설정</h2>
 {official?<><p className="text-xs text-slate-500">{year}년 · {facility} · {rank} {step}호봉</p><p className="text-lg font-bold text-blue-700">{result?won(result.base):'공식 기본급 없음'}</p></>:base===undefined?<Field label="월 기본급 직접 입력 (원)" value={manual} onChange={setManual}/>:<p>공식 월 기본급: {won(base)}</p>}
 {official&&<><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={spouse} onChange={e=>setSpouse(e.target.checked)}/> 수당 지급 대상 배우자 있음</label><div className="grid grid-cols-2 gap-3"><Field label="대상 자녀 수" value={children} onChange={setChildren} integer/><Field label="기타 대상 부양가족 수" value={other} onChange={setOther} integer/><Field label="연간 명절휴가비 지급 횟수" value={payments} onChange={setPayments} integer max={rules?.holiday.paymentsPerYear??2}/></div><p className="text-xs text-slate-500">실제 수당 지급 요건을 충족하는 가족만 입력하세요.</p></>}
 <Field label="기타 월 수당 (원)" value={extra} onChange={setExtra}/><Field label="기타 연간 상여금 (원)" value={bonus} onChange={setBonus}/>
 </section>
 {official&&<section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3"><h2 className="font-bold">월 시간외근무</h2><div className="grid grid-cols-2 gap-3"><Field label="연장근로 (시간)" value={extension} onChange={setExtension}/><Field label="야간 가산 대상 (시간)" value={night} onChange={setNight}/><Field label="휴일근로 8시간 이내 합계" value={holiday8} onChange={setHoliday8}/><Field label="휴일근로 8시간 초과분 합계" value={holidayOver} onChange={setHolidayOver}/></div><p className="text-xs leading-5 text-slate-500">휴일근로는 연장근로와 중복 입력하지 마세요. 야간은 별도 가산분만 계산합니다. 휴일 8시간 기준은 각 휴일별로 구분하세요.</p><Field label="월 통상임금 직접 입력 (선택, 원)" value={ordinary} onChange={setOrdinary} placeholder="미입력 시 가이드라인 기준"/></section>}
 <section className="rounded-2xl border border-slate-200 bg-white p-4"><Field label="월 공제액 직접 입력 (선택, 원)" value={deduct} onChange={setDeduct} placeholder="세금 및 보험료 합계"/><p className="mt-2 text-xs text-slate-500">4대보험 및 소득세는 자동 계산하지 않습니다.</p></section>
 {invalid?<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">입력값과 지급 횟수를 확인해 주세요.</p>:official&&!result?<p role="alert" className="text-sm text-red-700">선택한 조건의 공식 급여 데이터가 없습니다.</p>:<section className="rounded-2xl bg-blue-50 p-4 space-y-3" aria-live="polite"><h2 className="font-bold text-blue-900">예상 급여</h2><div className="grid gap-3 sm:grid-cols-2"><div><p className="text-xs text-blue-800">세전 월급 (일반월)</p><p className="text-2xl font-bold tabular-nums text-blue-700">{won(result?.monthly??legacy.monthly)}</p></div><div><p className="text-xs text-blue-800">세전 연봉</p><p className="text-2xl font-bold tabular-nums text-blue-700">{won(result?.annual??legacy.annual)}</p></div></div><div className="space-y-2 border-t border-blue-200 pt-3">{result&&<><Amount label="월 기본급" value={result.base}/><Amount label="월 가족수당" value={result.family}/><Amount label="월 시간외근무수당" value={result.overtime}/><Amount label="연간 명절휴가비" value={result.annualHoliday}/>{result.annualHoliday>0&&<Amount label="명절 지급월 예상 급여" value={result.holidayMonth}/>}<Amount label="연봉 기준 월평균" value={result.averageMonthly}/><Amount label="월 통상임금 산정액" value={result.ordinaryMonthlyWage}/></>}<Amount label="기타 월 수당" value={Math.max(0,n(extra))}/><Amount label="기타 연간 상여금" value={Math.max(0,n(bonus))}/>{deduct!==''&&<Amount label="입력 공제액 기준 일반월 수령액" value={result?.net??legacy.net}/>}</div>{result?.warnings.map(w=><p key={w} className="text-xs leading-5 text-amber-800">{w}</p>)}</section>}
 <p className="text-xs leading-5 text-slate-500">권고 기준에 따른 예상치입니다. 연봉은 동일 월급이 12개월 유지된다고 가정하며, 실제 수당·근무조건·시설 및 지자체 지침에 따라 달라집니다.</p>
 </div>;
}
