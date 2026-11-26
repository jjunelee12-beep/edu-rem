import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { trpc } from "@/lib/trpc";

const COURSES = ["사회복지사 2급", "보육교사 2급", "한국어교원 2급"];
const inputClass = "w-full h-[54px] rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-[15px] text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500";
const labelClass = "mb-2 block text-[14px] font-semibold text-slate-800";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-0"><label className={labelClass}>{label} <span className="text-rose-500">*</span></label>{children}</div>;
}

export default function PracticeSupportApplication() {
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", course: "", address: "", month: "", hours: "160", days: "" });
  const set = (key: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [key]: value }));
  useEffect(() => {
    try { setToken(localStorage.getItem("student_portal_token:with-one") || ""); } catch {} finally { setReady(true); }
  }, []);
  const info = trpc.practiceSupport.welfareApplicationInfo.useQuery({ token }, { enabled: ready && !!token, retry: false, refetchOnWindowFocus: false });
  const authenticated = Boolean(info.data?.authenticated);
  const loadingSession = ready && !!token && info.isPending;
  useEffect(() => {
    if (!info.data?.authenticated) return;
    const data = info.data;
    setForm(prev => ({ ...prev, name: data.name, phone: data.phone, course: COURSES.includes(data.course) ? data.course : prev.course, address: data.address || prev.address }));
  }, [info.data]);
  const hours = Number(form.hours);
  const canSubmit = Boolean(form.name.trim() && /^01\d{8,9}$/.test(form.phone.replace(/\D/g, "")) && COURSES.includes(form.course) && form.address.trim() && /^20\d{2}-(0[1-9]|1[0-2])$/.test(form.month) && Number.isInteger(hours) && hours >= 1 && hours <= 1000 && form.days);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const mutation = trpc.practiceSupport.submitWelfareApplication.useMutation();
  const submitting = mutation.isPending;
  const handleSubmit = async () => {
    if (!ready || loadingSession || !canSubmit || submitting || submitted) return;
    setSubmitError("");
    try {
      await mutation.mutateAsync({ token: authenticated ? token : undefined, name: form.name.trim(), phone: form.phone.replace(/\D/g, ""), course: form.course as "사회복지사 2급" | "보육교사 2급" | "한국어교원 2급", address: form.address.trim(), month: form.month, hours, days: form.days as "weekday" | "weekend" | "both" });
      setSubmitted(true);
    } catch (error) { setSubmitError(error instanceof Error ? error.message : "신청 중 오류가 발생했습니다."); }
  };

  return <main className="min-h-screen bg-[#f5f8fd] pb-12 text-slate-900 [color-scheme:light]">
    <header className="sticky top-0 z-10 flex h-14 items-center justify-center bg-[#124687] px-4 text-[17px] font-bold text-white shadow-sm">
      <button type="button" onClick={() => window.location.assign("/practice-support")} className="absolute left-4 text-2xl font-normal" aria-label="뒤로가기">‹</button>
      실습배정지원센터
    </header>
    <div className="mx-auto max-w-[480px]">
      <div className="relative overflow-hidden bg-[#e9f2ff]">
        <img src="/images/practice-application-banner.png" alt="현장실습 신청서 - 실습 배정을 위해 아래 정보를 입력해 주세요" className="block w-full" />
      </div>
      <div className="space-y-5 px-4 pt-5">
        <section className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4">
          <h2 className="mb-1 text-[15px] font-bold text-blue-900">신청 전 안내</h2>
          <p className="text-[13px] leading-6 text-slate-700">실습을 희망하시는 지역과 일정을 입력해 주세요. 실습배정지원센터에서 신청 내용을 확인한 후 연락드립니다.</p>
        </section>
        {loadingSession ? (
          <section className="rounded-2xl bg-white p-6 text-center text-sm text-slate-600">
            등록된 회원 정보를 불러오는 중입니다.
          </section>
        ) : (
        <>
          <section className="rounded-[24px] bg-white px-5 pb-7 pt-6 shadow-[0_4px_24px_rgba(23,57,102,0.04)]">
            <h2 className="mb-7 border-b border-slate-100 pb-4 text-[17px] font-bold">기본정보</h2>
            <div className="space-y-7">
              <Field label="이름"><input className={inputClass} value={form.name} disabled={authenticated} placeholder="이름을 입력해 주세요" onChange={e => set("name", e.target.value)} /></Field>
              <Field label="연락처"><input className={inputClass} inputMode="tel" value={form.phone} disabled={authenticated} placeholder="010-0000-0000" onChange={e => set("phone", e.target.value)} /></Field>
              <Field label="희망과정"><select className={inputClass} value={form.course} onChange={e => set("course", e.target.value)}><option value="">희망과정 선택</option>{COURSES.map(c => <option key={c} value={c}>{c}</option>)}</select></Field>
              <Field label="주소"><input className={inputClass} value={form.address} placeholder="거주지 주소를 입력해 주세요" onChange={e => set("address", e.target.value)} /></Field>
            </div>
          </section>
          <section className="rounded-[24px] bg-white px-5 pb-7 pt-6 shadow-[0_4px_24px_rgba(23,57,102,0.04)]">
            <h2 className="mb-7 border-b border-slate-100 pb-4 text-[17px] font-bold">실습 정보</h2>
            <div className="space-y-7">
              <Field label="실습 희망월"><input className={inputClass} type="month" value={form.month} onChange={e => set("month", e.target.value)} /></Field>
              <Field label="실습시간"><div className="relative"><input className={`${inputClass} pr-16`} inputMode="numeric" type="number" min="1" max="1000" value={form.hours} onChange={e => set("hours", e.target.value)} /><span className="pointer-events-none absolute right-5 top-[17px] text-sm text-slate-500">시간</span></div></Field>
              <Field label="실습 진행일"><div className="grid grid-cols-3 gap-2">{[["weekday", "평일"], ["weekend", "주말"], ["both", "평일·주말"]].map(([value, label]) => <button key={value} type="button" onClick={() => set("days", value)} className={`min-h-[50px] rounded-2xl border px-1 text-[13px] font-semibold transition ${form.days === value ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{label}</button>)}</div><p className="mt-2 text-xs text-slate-500">실습이 가능한 요일을 선택해 주세요.</p></Field>
              


            </div>
          </section>
          
          {submitted ? (
            <div
              role="status"
              className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center"
            >
              <p className="text-lg font-bold text-green-800">
                실습 배정 신청이 접수되었습니다.
              </p>
              <p className="mt-2 text-sm text-green-700">
                실습배정지원센터에서 신청 내용을 확인한 후 연락드립니다.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
  !ready ||
  loadingSession ||
  !canSubmit ||
  submitting
}
              className="h-14 w-full rounded-2xl bg-[#1655a2] text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "신청 접수 중..." : "실습 신청하기"}
            </button>
          )}

          {submitError && (
            <p role="alert" className="text-center text-sm text-red-600">
              {submitError}
            </p>
          )}

          <p className="text-center text-xs text-slate-400">신청 완료가 실습 배정 확정을 의미하지는 않습니다.</p>
          {!canSubmit && <p className="text-center text-xs text-slate-400">필수 입력항목을 확인해 주세요.</p>}
        </>)}
      </div>
    </div>
  </main>;
}
