import { useState } from 'react';
import { calculateCareer, type Career } from '../../lib/salary/careerEngine';
import { findSalary } from '../../data/salary';

export type CareerCalculatorProps = { onStep: (step: number) => void; year?: number; facility?: string; rank?: string };
type Draft = { id: number; start: string; end: string; rate: string; kind: NonNullable<Career['kind']> };
const blank = (id: number): Draft => ({ id, start: '', end: '', rate: '', kind: 'work' });
const field = 'mt-1 block w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm focus:border-blue-500 focus:outline-none';
const labels = { work: '근무경력', military: '군복무', other: '기타 경력' };
const fmt = (n: number) => n.toLocaleString('ko-KR', { maximumFractionDigits: 2 });

export default function CareerCalculator({ onStep, year = 2026, facility, rank }: CareerCalculatorProps) {
  const [rows, setRows] = useState<Draft[]>([]);
  const [nextId, setNextId] = useState(1);
  const [appointmentDate, setAppointmentDate] = useState('');
  const update = (id: number, patch: Partial<Draft>) => setRows(old => old.map(r => r.id === id ? { ...r, ...patch } : r));
  const add = (kind: Draft['kind']) => { setRows(old => [...old, { ...blank(nextId), kind }]); setNextId(n => n + 1); };
  let result: ReturnType<typeof calculateCareer> | undefined;
  let error = '';
  try {
    if (rows.some(r => !r.start || !r.end || r.rate.trim() === '')) throw new Error('각 경력의 시작일, 종료일 및 확인한 인정률을 입력해 주세요.');
    result = calculateCareer(rows.map(r => ({ start: r.start, end: r.end, rate: Number(r.rate), kind: r.kind })), { year, facility, rank, appointmentDate: appointmentDate || undefined });
  } catch (e) { error = e instanceof Error ? e.message : '경력 정보를 확인해 주세요.'; }
  const salary = result && facility && rank ? findSalary(year, facility, rank, result.estimatedStep) : undefined;
  return <div className="min-w-0 space-y-4">
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="font-bold text-slate-900">경력 인정 및 호봉 계산</h2>
      <p className="text-xs text-slate-500">{year}년{facility ? ` · ${facility}` : ''}{rank ? ` · ${rank}` : ''}</p>
      <label className="block text-sm font-medium text-slate-700">임용 예정일 (선택)<input type="date" className={field} value={appointmentDate} onChange={e => setAppointmentDate(e.target.value)} /></label>
      <p className="text-xs leading-5 text-slate-500">임용일을 입력하면 다음 승급 예정일도 추정합니다. 이전 경력은 임용일 전일까지 입력하세요.</p>
    </section>
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <h2 className="font-bold text-slate-900">이전 경력</h2>
      {!rows.length && <p className="text-sm text-slate-500">입력된 경력이 없습니다. 신규 임용자는 경력 없이 계산할 수 있습니다.</p>}
      {rows.map((r, i) => <div key={r.id} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-2"><strong className="text-sm">경력 {i + 1}</strong><button type="button" className="rounded-lg px-3 py-2 text-xs text-red-600" onClick={() => setRows(old => old.filter(x => x.id !== r.id))}>삭제</button></div>
        <label className="block text-sm">경력 유형<select className={field} value={r.kind} onChange={e => update(r.id, { kind: e.target.value as Draft['kind'] })}>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <div className="grid gap-3 sm:grid-cols-2"><label className="block min-w-0 text-sm">시작일<input className={field} type="date" value={r.start} onChange={e => update(r.id, { start: e.target.value })}/></label><label className="block min-w-0 text-sm">종료일<input className={field} type="date" value={r.end} min={r.start || undefined} onChange={e => update(r.id, { end: e.target.value })}/></label></div>
        <label className="block text-sm">기관에서 확인한 경력 인정률 (%)<input className={field} type="number" inputMode="decimal" min={0} max={100} step="any" placeholder="0~100" value={r.rate} onChange={e => update(r.id, { rate: e.target.value })}/></label>
      </div>)}
      <div className="grid grid-cols-2 gap-2"><button type="button" className="rounded-xl border border-blue-200 px-3 py-3 text-sm font-semibold text-blue-700" onClick={() => add('work')}>+ 근무경력 추가</button><button type="button" className="rounded-xl border border-blue-200 px-3 py-3 text-sm font-semibold text-blue-700" onClick={() => add('military')}>+ 군복무 추가</button></div>
      <p className="text-xs leading-5 text-slate-500">군복무를 포함한 인정률은 자동 지정하지 않습니다. 해당 시설의 경력 인정 지침을 확인한 뒤 입력하세요.</p>
    </section>
    {error && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
    {result && <section className="space-y-3 rounded-2xl bg-blue-50 p-4" aria-live="polite">
      <h2 className="font-bold text-blue-900">예상 호봉 계산 결과</h2>
      <p className="text-3xl font-bold text-blue-700">{result.estimatedStep}호봉</p>
      <dl className="space-y-2 border-t border-blue-200 pt-3 text-sm">
        <div className="flex justify-between gap-2"><dt>총 인정경력 (예상)</dt><dd>{result.recognizedYears}년 {result.days % 365}일</dd></div>
        <div className="flex justify-between gap-2"><dt>잔여 인정경력</dt><dd>{fmt(result.remainingDays)}일</dd></div>
        {result.maxStep !== null && <div className="flex justify-between gap-2"><dt>직급별 최고호봉</dt><dd>{result.maxStep}호봉</dd></div>}
        {result.uncappedStep !== result.estimatedStep && <div className="flex justify-between gap-2"><dt>상한 적용 전 예상호봉</dt><dd>{result.uncappedStep}호봉</dd></div>}
        <div className="flex justify-between gap-2"><dt>다음 승급 예정일 (추정)</dt><dd>{result.nextPromotionDate ?? (result.maxStep === result.estimatedStep ? '최고호봉 도달' : '임용일 입력 필요')}</dd></div>
        {salary && <div className="flex justify-between gap-2"><dt>예상 월 기본급</dt><dd className="font-bold">{fmt(salary.monthly)}원</dd></div>}
      </dl>
      {!!result.details.length && <div className="space-y-2 border-t border-blue-200 pt-3"><h3 className="text-sm font-semibold">경력별 환산 내역</h3>{result.details.map((r,i) => <div key={i} className="rounded-lg bg-white p-3 text-xs"><p>{labels[r.kind]} · {r.start} ~ {r.end}</p><p className="mt-1">실제 {fmt(r.actualDays)}일 × {fmt(r.rate)}% = {fmt(r.recognizedDays)}일</p></div>)}</div>}
      {result.warnings.map(w => <p key={w} className="text-xs leading-5 text-slate-600">{w}</p>)}
      <button type="button" disabled={!!(facility && rank && !salary)} className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50" onClick={() => onStep(result!.estimatedStep)}>이 호봉으로 급여 계산하기</button>
    </section>}
  </div>;
}
