import { getSalaryRules, getSalarySteps } from '../../data/salary';

export type Career = { start: string; end: string; rate: number; kind?: 'work' | 'military' | 'other' };
export type CareerOptions = { year?: number; facility?: string; rank?: string; appointmentDate?: string };
const DAY = 86400000;
function date(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('날짜를 입력해 주세요.');
  const n = Date.parse(value + 'T00:00:00Z');
  if (!Number.isFinite(n) || new Date(n).toISOString().slice(0,10) !== value) throw new Error('유효한 날짜를 입력해 주세요.');
  return n;
}
const iso = (n: number) => new Date(n).toISOString().slice(0,10);
function anniversary(start: number, years: number) {
  const d = new Date(start), y = d.getUTCFullYear() + years, m = d.getUTCMonth();
  const last = new Date(Date.UTC(y,m+1,0)).getUTCDate();
  return Date.UTC(y,m,Math.min(d.getUTCDate(),last));
}
// 공식 경력 환산 세칙은 시설별 지침에 따름. 아래는 일수 기반 예상치.
export function calculateCareer(rows: Career[], options: CareerOptions = {}) {
  const rules = getSalaryRules(options.year ?? 2026);
  if (!rules) throw new Error('지원하지 않는 기준 연도입니다.');
  const appointment = options.appointmentDate ? date(options.appointmentDate) : null;
  const intervals = rows.map(r => {
    const a = date(r.start), b = date(r.end);
    if (b < a || !Number.isFinite(r.rate) || r.rate < 0 || r.rate > 100) throw new Error('기간과 인정률(0~100%)을 확인해 주세요.');
    if (appointment !== null && b >= appointment) throw new Error('이전 경력은 임용일 전일까지 입력해 주세요.');
    return { ...r, a, b };
  }).sort((a,b)=>a.a-b.a);
  if (intervals.some((r,i)=>i>0 && r.a<=intervals[i-1].b)) throw new Error('중복 경력 기간을 제거해 주세요.');
  const details = intervals.map(r => ({ start:r.start,end:r.end,rate:r.rate,kind:r.kind ?? 'work',actualDays:(r.b-r.a)/DAY+1, recognizedDays:((r.b-r.a)/DAY+1)*r.rate/100 }));
  const days = Math.floor(details.reduce((s,r)=>s+r.recognizedDays,0));
  const unit = 365 * rules.step.yearsPerStep;
  const completedSteps = Math.floor(days/unit);
  const remainingDays = days % unit;
  const uncappedStep = rules.step.initial + completedSteps;
  const steps = options.facility && options.rank ? getSalarySteps(options.year ?? 2026,options.facility,options.rank) : [];
  if (options.facility && options.rank && !steps.length) throw new Error('시설과 직급을 확인해 주세요.');
  const maxStep = steps.length ? Math.max(...steps) : null;
  const estimatedStep = maxStep === null ? uncappedStep : Math.min(maxStep,uncappedStep);
  let nextPromotionDate: string | null = null;
  if (appointment !== null && (maxStep === null || estimatedStep < maxStep)) {
    const full = anniversary(appointment,rules.step.yearsPerStep);
    const due = new Date(Math.max(appointment,full-remainingDays*DAY));
    const day = rules.step.promotionDayOfMonth;
    const candidate = Date.UTC(due.getUTCFullYear(),due.getUTCMonth(),day);
    nextPromotionDate = iso(candidate >= due.getTime() ? candidate : Date.UTC(due.getUTCFullYear(),due.getUTCMonth()+1,day));
  }
  return { days, estimatedStep, uncappedStep, maxStep, remainingDays, recognizedYears: Math.floor(days/365), nextPromotionDate, details, warnings: ['365일 단위 예상 환산입니다. 실제 경력 인정률, 역법상 기간 계산 및 승급 제한은 시설별 지침과 임용권자 확인이 필요합니다.'] };
}
