import type { SalaryRow } from '../../data/salary/types';

export type SalaryTableProps = {
  rows: SalaryRow[];
  selectedRank?: string;
  selectedStep?: number;
  onSelect?: (row: SalaryRow) => void;
};
const money = (value: number) => value.toLocaleString('ko-KR');

export default function SalaryTable({ rows, selectedRank, selectedStep, onSelect }: SalaryTableProps) {
  if (!rows.length) return <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">해당 조건의 공식 급여 데이터가 없습니다.</p>;
  const ranks = [...new Set(rows.map(row => row.rank))];
  const steps = [...new Set(rows.map(row => row.step))].sort((a, b) => a - b);
  const lookup = new Map(rows.map(row => [JSON.stringify([row.rank, row.step]), row] as const));
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold text-slate-900">직급별 기본급 권고 기준표</h2>
        <span className="text-xs text-slate-500">단위: 원 / 월</span>
      </div>
      <p className="text-xs leading-5 text-slate-500">{onSelect ? '금액을 누르면 해당 직급과 호봉의 급여 계산기로 이동합니다. ' : ''}표를 좌우로 이동하여 확인할 수 있습니다.</p>
      <div className="max-w-full overflow-auto rounded-xl border border-slate-200" tabIndex={0} role="region" aria-label="직급별 호봉표">
        <table className="w-full border-separate border-spacing-0 text-sm tabular-nums">
          <caption className="sr-only">사회복지시설 직급별 월 기본급 권고 기준</caption>
          <thead><tr>
            <th scope="col" className="sticky left-0 z-10 whitespace-nowrap border-b border-r bg-slate-100 px-3 py-3 text-center text-xs">호봉</th>
            {ranks.map(rank => <th key={rank} scope="col" className={`min-w-[120px] whitespace-nowrap border-b px-3 py-3 text-center text-xs ${rank === selectedRank ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-700'}`}>{rank}</th>)}
          </tr></thead>
          <tbody>{steps.map(step => <tr key={step} className="odd:bg-white even:bg-slate-50">
            <th scope="row" className="sticky left-0 z-10 whitespace-nowrap border-b border-r bg-slate-50 px-3 py-3 text-center text-xs font-semibold text-slate-700">{step}호봉</th>
            {ranks.map(rank => {
              const row = lookup.get(JSON.stringify([rank, step]));
              const selected = rank === selectedRank && step === selectedStep;
              return <td key={rank} className={`whitespace-nowrap border-b px-2 py-1 text-right ${selected ? 'bg-blue-50 font-bold text-blue-700' : 'text-slate-800'}`}>
                {row ? onSelect ? <button type="button" onClick={() => onSelect(row)} aria-label={`${rank} ${step}호봉 ${money(row.monthly)}원 급여 계산`} className="w-full rounded-lg px-2 py-2 text-right hover:bg-blue-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">{money(row.monthly)}</button> : <span className="block px-2 py-2">{money(row.monthly)}</span> : <span className="block px-2 py-2 text-slate-400" aria-label="해당 없음">—</span>}
              </td>;
            })}
          </tr>)}</tbody>
        </table>
      </div>
      <p className="text-xs leading-5 text-slate-500">세전 기본급 기준이며 수당은 포함하지 않습니다. ‘—’는 해당 직급의 공식 표에 없는 호봉입니다. 실제 지급액은 시설 및 지방자치단체 지침에 따라 달라질 수 있습니다.</p>
    </div>
  );
}
