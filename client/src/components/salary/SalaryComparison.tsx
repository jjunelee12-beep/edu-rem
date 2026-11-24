import { compareSalaryYears } from '../../lib/salary/salaryComparison';
import { won } from '../../lib/salary/salaryEngine';

export type SalaryComparisonProps = { facility: string; rank: string; step: number };
const signedMoney = (n: number | null) => n === null ? '—' : `${n > 0 ? '+' : ''}${won(n)}`;
const signedPercent = (n: number | null) => n === null ? '—' : `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
const tone = (n: number | null) => n === null || n === 0 ? 'text-slate-500' : n > 0 ? 'text-blue-700' : 'text-red-700';

export default function SalaryComparison({ facility, rank, step }: SalaryComparisonProps) {
  const { rows, total, warnings } = compareSalaryYears({ facility, rank, step });
  const max = Math.max(1, ...rows.map(row => row.monthly ?? 0));
  if (!rows.some(row => row.monthly !== null)) return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">해당 조건의 공식 급여 데이터가 없습니다.</p>;
  return <div className="min-w-0 space-y-4">
    <div><h2 className="text-base font-bold text-slate-900">연도별 기본급 비교</h2><p className="mt-1 text-xs leading-5 text-slate-500">{facility} · {rank} {step}호봉</p></div>
    {total && <section className="rounded-2xl bg-blue-50 p-4"><p className="text-xs font-medium text-blue-800">{total.fromYear}~{total.toYear}년 누적 변화</p><p className={`mt-1 text-2xl font-bold tabular-nums ${tone(total.percent)}`}>{signedPercent(total.percent)}</p><p className="mt-1 text-sm text-slate-700">월 기본급 {signedMoney(total.difference)} · 연간 기본급 {signedMoney(total.difference * 12)}</p></section>}
    <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4" aria-label="연도별 월 기본급 막대 그래프">
      <h3 className="text-sm font-bold text-slate-900">월 기본급 변화</h3>
      {rows.map((row, i) => <div key={row.year} className="space-y-1.5"><div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span className="font-medium text-slate-700">{row.year}년</span><strong className="tabular-nums text-slate-900">{row.monthly === null ? '공식 데이터 없음' : won(row.monthly)}</strong></div>{row.monthly !== null && <div className="h-3 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className={`h-full rounded-full ${i === rows.length - 1 ? 'bg-blue-600' : 'bg-blue-300'}`} style={{ width: `${row.monthly / max * 100}%` }}/></div>}<p className={`text-right text-xs tabular-nums ${tone(row.difference)}`}>{row.difference === null ? '전년 비교 데이터 없음' : `전년 대비 ${signedMoney(row.difference)} (${signedPercent(row.percent)})`}</p></div>)}
      <p className="text-xs text-slate-500">막대는 0원부터 최대 월 기본급까지 동일한 비율로 표시합니다.</p>
    </section>
    <section className="space-y-2"><h3 className="text-sm font-bold text-slate-900">상세 비교표</h3><div className="max-w-full overflow-x-auto rounded-xl border border-slate-200" tabIndex={0} role="region" aria-label="연도별 급여 상세 비교표"><table className="w-full whitespace-nowrap text-xs tabular-nums"><thead className="bg-slate-100 text-slate-700"><tr>{['연도','월 기본급','연간 기본급','월 인상액','연간 인상액','인상률'].map(label=><th key={label} scope="col" className="px-3 py-3 text-right">{label}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.year} className="border-t border-slate-200 odd:bg-white even:bg-slate-50"><th scope="row" className="px-3 py-3 text-left">{row.year}</th><td className="px-3 py-3 text-right">{row.monthly===null?'—':won(row.monthly)}</td><td className="px-3 py-3 text-right">{row.annual===null?'—':won(row.annual)}</td><td className={`px-3 py-3 text-right ${tone(row.difference)}`}>{signedMoney(row.difference)}</td><td className={`px-3 py-3 text-right ${tone(row.annualDifference)}`}>{signedMoney(row.annualDifference)}</td><td className={`px-3 py-3 text-right ${tone(row.percent)}`}>{signedPercent(row.percent)}</td></tr>)}</tbody></table></div><p className="text-xs text-slate-500">표를 좌우로 이동하여 확인하세요. 연간 기본급은 월 기본급 × 12개월입니다.</p></section>
    <section className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600"><h3 className="font-bold">자료 출처 및 안내</h3>{rows.map(row=><div key={row.year}>{row.source && /^https?:\/\//i.test(row.source) ? <a href={row.source} target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">{row.year}년 사회복지시설 종사자 인건비 가이드라인</a> : <span>{row.year}년 사회복지시설 종사자 인건비 가이드라인 (보건복지부)</span>}</div>)}{warnings.map(w=><p key={w} className="mt-2">{w}</p>)}<p>실제 지급액은 시설 및 지방자치단체 지침에 따라 달라질 수 있습니다.</p></section>
  </div>;
}
