import { salary2024, salary2024Rules, salary2024Source } from './salary2024';
import { salary2025, salary2025Rules, salary2025Source } from './salary2025';
import { salary2026, salary2026Rules, salary2026Source } from './salary2026';
import type { SalaryDataset } from './types';
export type * from './types';
export const salaryYears: SalaryDataset[] = [
  { ...salary2026, rules: salary2026Rules, sourceInfo: salary2026Source },
  { ...salary2025, rules: salary2025Rules, sourceInfo: salary2025Source },
  { ...salary2024, rules: salary2024Rules, sourceInfo: salary2024Source },
];
export const latestSalaryYear = salaryYears[0].year;
export function getSalaryYear(year: number) { return salaryYears.find(y => y.year === year); }
export function getSalaryRules(year: number) { return getSalaryYear(year)?.rules; }
export function getSalaryFacilities(year: number) { return [...new Set((getSalaryYear(year)?.rows ?? []).map(r => r.facility))]; }
export function getSalaryRanks(year: number, facility: string) { return [...new Set((getSalaryYear(year)?.rows ?? []).filter(r => r.facility === facility).map(r => r.rank))]; }
export function getSalarySteps(year: number, facility: string, rank: string) { return [...new Set((getSalaryYear(year)?.rows ?? []).filter(r => r.facility === facility && r.rank === rank).map(r => r.step))].sort((a,b) => a-b); }
export function findSalary(year: number, facility: string, rank: string, step: number) { return getSalaryYear(year)?.rows.find(r => r.facility === facility && r.rank === rank && r.step === step); }
export function getSalaryTable(year: number, facility: string) { return (getSalaryYear(year)?.rows ?? []).filter(r => r.facility === facility); }
