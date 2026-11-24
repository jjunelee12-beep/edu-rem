export type SalaryRow = { facility: string; rank: string; step: number; monthly: number };
export type SalaryYear = { year: number; source: string; rows: SalaryRow[] };
export type SalaryYearNumber = 2024 | 2025 | 2026;
export type SalarySource = { title: string; pages: string; publisher: string };
export type SalaryRules = {
  holiday: { ratePerPayment: number; paymentsPerYear: number; includedInOrdinaryWage: boolean | null };
  family: { spouse: number; otherDependent: number; firstChild: number; secondChild: number; subsequentChild: number; dependentLimit: number; childrenExemptFromLimit: boolean };
  overtime: { monthlyOrdinaryWageDivisor: number; extensionPremium: number; nightPremium: number | null; holidayUpTo8HoursPremium: number | null; holidayOver8HoursPremium: number | null };
  promotion: { socialWorkerToSeniorYears: number; seniorToManagerYears: number; managerToDirectorYears: number; grade4To3Years: number; grade3To2Years: number; grade2To1Years: number };
  step: { initial: number; yearsPerStep: number; promotionDayOfMonth: number };
  commissionedDoctorMonthly: number;
};
export type SalaryDataset = SalaryYear & { rules: SalaryRules; sourceInfo: SalarySource };
