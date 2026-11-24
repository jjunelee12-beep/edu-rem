import { findSalary, salaryYears } from '../../data/salary';

// 기존 화면과 호환되는 금액 비교 함수.
export function compareSalary(previous: number, current: number) {
  if (!Number.isFinite(previous) || !Number.isFinite(current) || previous < 0 || current < 0) {
    throw new Error('유효한 급여 금액을 입력해 주세요.');
  }
  const difference = current - previous;
  return { difference, percent: previous > 0 ? difference / previous * 100 : null };
}

export type SalaryComparisonInput = { facility: string; rank: string; step: number };
export type SalaryComparisonRow = {
  year: number; monthly: number | null; annual: number | null;
  difference: number | null; percent: number | null;
  annualDifference: number | null; source: string;
};

// 동일 직급·호봉의 권고 기본급만 비교. 수당·세금 및 승급 효과는 제외.
export function compareSalaryYears(input: SalaryComparisonInput) {
  const years = [...salaryYears].sort((a, b) => a.year - b.year);
  const rows: SalaryComparisonRow[] = years.map(dataset => {
    const monthly = findSalary(dataset.year, input.facility, input.rank, input.step)?.monthly ?? null;
    const previous = findSalary(dataset.year - 1, input.facility, input.rank, input.step)?.monthly ?? null;
    const change = monthly !== null && previous !== null ? compareSalary(previous, monthly) : null;
    return { year: dataset.year, monthly, annual: monthly === null ? null : monthly * 12,
      difference: change?.difference ?? null, percent: change?.percent ?? null,
      annualDifference: change ? change.difference * 12 : null, source: dataset.source };
  });
  const first = rows[0], last = rows[rows.length - 1];
  const total = first?.monthly != null && last?.monthly != null && first.year !== last.year
    ? { fromYear: first.year, toYear: last.year, ...compareSalary(first.monthly, last.monthly) } : null;
  return { rows, total, warnings: ['동일 시설·직급·호봉의 권고 기본급 비교이며, 수당 및 실제 지급액은 포함하지 않습니다.'] };
}
