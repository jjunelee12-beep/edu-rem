import { findSalary, getSalaryRules } from '../../data/salary';

export function nonnegative(value: number) { return Number.isFinite(value) ? Math.max(0, value) : 0; }
export const won = (n: number) => Math.round(n).toLocaleString('ko-KR') + '원';
// 기존 화면 호환용
export function calculateSalary(base: number, monthlyAllowance: number, annualBonus: number, monthlyDeductions: number) {
  const monthly = nonnegative(base) + nonnegative(monthlyAllowance);
  return { monthly, annual: monthly * 12 + nonnegative(annualBonus), net: Math.max(0, monthly - nonnegative(monthlyDeductions)) };
}
export type SalaryInput = {
  year: number; facility: string; rank: string; step: number;
  spouse?: boolean; children?: number; otherDependents?: number;
  holidayPayments?: number; extensionHours?: number; nightHours?: number;
  holidayHoursUpTo8?: number; holidayHoursOver8?: number;
  otherMonthlyAllowance?: number; otherAnnualBonus?: number;
  ordinaryMonthlyWageOverride?: number; monthlyDeductions?: number;
};
const count = (n = 0) => Math.floor(nonnegative(n));
export function calculateDetailedSalary(input: SalaryInput) {
  const row = findSalary(input.year, input.facility, input.rank, input.step);
  const rules = getSalaryRules(input.year);
  if (!row || !rules) return null;
  const warnings: string[] = [];
  const base = row.monthly;
  const children = count(input.children);
  const spouse = input.spouse ? 1 : 0;
  const other = Math.min(count(input.otherDependents), Math.max(0, rules.family.dependentLimit - spouse - children));
  const eligibleChildren = rules.family.childrenExemptFromLimit ? children : Math.min(children, Math.max(0, rules.family.dependentLimit - spouse));
  const family = spouse * rules.family.spouse + other * rules.family.otherDependent + Math.min(eligibleChildren, 1) * rules.family.firstChild + (eligibleChildren >= 2 ? rules.family.secondChild : 0) + Math.max(0, eligibleChildren - 2) * rules.family.subsequentChild;
  const payments = Math.min(rules.holiday.paymentsPerYear, count(input.holidayPayments ?? rules.holiday.paymentsPerYear));
  const holidayPerPayment = Math.round(base * rules.holiday.ratePerPayment);
  const annualHoliday = holidayPerPayment * payments;
  const ordinaryMonthlyWage = input.ordinaryMonthlyWageOverride === undefined ? base + (rules.holiday.includedInOrdinaryWage === true ? base * rules.holiday.ratePerPayment * rules.holiday.paymentsPerYear / 12 : 0) : nonnegative(input.ordinaryMonthlyWageOverride);
  if (rules.holiday.includedInOrdinaryWage === null && input.ordinaryMonthlyWageOverride === undefined) warnings.push('통상임금은 기본급으로 가정했습니다. 실제 산정 기준을 확인하세요.');
  const hourly = ordinaryMonthlyWage / rules.overtime.monthlyOrdinaryWageDivisor;
  const pay = (hours: number | undefined, premium: number | null, label: string, premiumOnly = false) => {
    const h = nonnegative(hours ?? 0);
    if (premium === null) { if (h > 0) warnings.push(`${label} 기준 미확인: 합계에서 제외했습니다.`); return 0; }
    return Math.round(h * hourly * (premium + (premiumOnly ? 0 : 1)));
  };
  const extension = pay(input.extensionHours, rules.overtime.extensionPremium, '연장근로');
  const night = pay(input.nightHours, rules.overtime.nightPremium, '야간근로', true);
  const holidayWork = pay(input.holidayHoursUpTo8, rules.overtime.holidayUpTo8HoursPremium, '휴일근로 8시간 이내') + pay(input.holidayHoursOver8, rules.overtime.holidayOver8HoursPremium, '휴일근로 8시간 초과');
  const overtime = extension + night + holidayWork;
  const otherMonthlyAllowance = nonnegative(input.otherMonthlyAllowance ?? 0);
  const monthly = base + family + overtime + otherMonthlyAllowance;
  const annual = monthly * 12 + annualHoliday + nonnegative(input.otherAnnualBonus ?? 0);
  const net = input.monthlyDeductions === undefined ? null : Math.max(0, monthly - nonnegative(input.monthlyDeductions));
  return { base, family, eligibleChildren, eligibleOtherDependents: other, holidayPerPayment, annualHoliday, ordinaryMonthlyWage, hourly, extension, night, holidayWork, overtime, monthly, annual, averageMonthly: annual / 12, holidayMonth: monthly + holidayPerPayment, net, warnings };
}
