import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";

const COURSES = ["사회복지사 2급", "보육교사 2급", "한국어교원 2급"];
const inputClass = "w-full h-[54px] rounded-2xl border border-slate-200 bg-slate-50/70 px-4 text-[15px] text-slate-900 outline-none transition focus:border-blue-400 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500";
const labelClass = "mb-2 block text-[14px] font-semibold text-slate-800";

function getSemesters() {
  const now = new Date();
  const year = now.getFullYear();
  const start = now.getMonth() < 6 ? 0 : 1;
  return Array.from({ length: 4 }, (_, i) => {
    const index = start + i;
    return `${year + Math.floor(index / 2)}년 ${(index % 2) + 1}학기`;
  });
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-0"><label className={labelClass}>{label} <span className="text-rose-500">*</span></label>{children}</div>;
}

export default function PracticeApplication() {
  const [, portalParams] = useRoute("/portal/:slug/practice-apply");
  const [, publicParams] = useRoute("/practice-apply/:slug");
  const slug = String(portalParams?.slug || publicParams?.slug || "").trim().toLowerCase();
  const fromPortal = Boolean(portalParams?.slug);
  const [token, setToken] = useState("");
const [ready, setReady] = useState(false);
const [requestId, setRequestId] = useState<number | null>(null);
  const semesters = useMemo(getSemesters, []);
  const [form, setForm] = useState({ name: "", phone: "", course: "", address: "", semester: "", month: "", hours: "160", days: "", assignee: "" });
  const set = (key: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  useEffect(() => {
    if (!fromPortal) { setReady(true); return; }
    try { setToken(localStorage.getItem(`student_portal_token:${slug}`) || ""); }
    finally { setReady(true); }
  }, [slug, fromPortal]);

  const applicationInfo = trpc.studentPortal.practiceApplicationInfo.useQuery(
    { token },
    {
      enabled: ready && fromPortal && !!token,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  useEffect(() => {
    if (!fromPortal || !applicationInfo.data?.authenticated) return;
    const info = applicationInfo.data;
setRequestId(info.requestId ?? null);

setForm(prev => ({
      ...prev,
      name: info.name || "",
      phone: info.phone || "",
      course: info.course || prev.course,
      address: info.address || prev.address,
      semester: info.semester || prev.semester,
      month: info.month || prev.month,
      
      hours: info.hours != null ? String(info.hours) : prev.hours,
      days: info.days || prev.days,
      assignee: info.assignee || prev.assignee,

    }));
  }, [fromPortal, applicationInfo.data]);

  const semesterOptions = useMemo(() => Array.from(new Set([...semesters, ...(form.semester && !semesters.includes(form.semester) ? [form.semester] : [])])), [semesters, form.semester]);
  const authenticated = fromPortal && Boolean(applicationInfo.data?.authenticated);
  const invalidSession = fromPortal && ready && (!token || applicationInfo.isError);
  const loadingSession = fromPortal && ready && !!token && applicationInfo.isPending;
  const canSubmit = Boolean(form.name.trim() && /^01\d{8,9}$/.test(form.phone.replace(/\D/g, "")) && form.course && form.address.trim() && form.semester && /^\d{4}-(0[1-9]|1[0-2])$/.test(form.month) && Number(form.hours) > 0 && form.days && form.assignee.trim());

  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const registeredMutation =
    trpc.studentPortal.submitPracticeApplication.useMutation();

  const publicMutation =
    trpc.practiceSupport.submitPublicApplication.useMutation();

  const submitting =
    registeredMutation.isPending || publicMutation.isPending;

  const handleSubmit = async () => {
    if (!canSubmit || submitting || submitted) return;
    if (fromPortal && !authenticated) return;

    setSubmitError("");

    const commonInput = {
      course: form.course as
        | "사회복지사 2급"
        | "보육교사 2급"
        | "한국어교원 2급",
      address: form.address.trim(),
      semester: form.semester,
      month: form.month,
      hours: Number(form.hours),
      days: form.days as "weekday" | "weekend" | "both",
      assignee: form.assignee.trim(),
    };

    try {
      if (fromPortal) {
        await registeredMutation.mutateAsync({
  token,
  requestId,
  ...commonInput,
});
      } else {
        await publicMutation.mutateAsync({
          slug,
          name: form.name.trim(),
          phone: form.phone.replace(/\D/g, ""),
          ...commonInput,
        });
      }

      setSubmitted(true);
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "신청 중 오류가 발생했습니다. 다시 시도해 주세요."
      );
    }
  };




  return <main className="min-h-screen bg-[#f5f8fd] pb-12 text-slate-900">
    <header className="sticky top-0 z-10 flex h-14 items-center justify-center bg-[#124687] px-4 text-[17px] font-bold text-white shadow-sm">
      <button type="button" onClick={() => window.location.assign(fromPortal ? `/portal/${slug}` : "/")} className="absolute left-4 text-2xl font-normal" aria-label="뒤로가기">‹</button>
      실습배정지원센터
    </header>
    <div className="mx-auto max-w-[480px]">
      <div className="relative overflow-hidden bg-[#e9f2ff]">
        <img src="/images/practice-application-banner.png" alt="현장실습 신청서 - 실습 배정을 위해 아래 정보를 입력해 주세요" className="block w-full" />
      </div>
      <div className="space-y-5 px-4 pt-5">
        <section className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4">
          <h2 className="mb-1 text-[15px] font-bold text-blue-900">신청 전 안내</h2>
          <p className="text-[13px] leading-6 text-slate-700">실습 학기, 예정월 및 실습시간은 반드시 담당 학습설계사와 확인 후 신청해 주세요.</p>
        </section>
        {loadingSession ? (
          <section className="rounded-2xl bg-white p-6 text-center text-sm text-slate-600">
            등록된 실습 정보를 불러오는 중입니다.
          </section>
        ) : invalidSession ? (
          <section className="rounded-2xl bg-white p-6 text-center text-sm">
            포털 로그인 세션이 만료되었거나 정보를 불러오지 못했습니다. 학생일정포털에서 다시 로그인해 주세요.
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
              <Field label="학기구분"><select className={inputClass} value={form.semester} onChange={e => set("semester", e.target.value)}><option value="">학기 선택</option>{semesterOptions.map(s => <option key={s} value={s}>{s}</option>)}</select></Field>
              <Field label="실습 예정월"><input className={inputClass} type="month" value={form.month} onChange={e => set("month", e.target.value)} /></Field>
              <Field label="실습시간"><div className="relative"><input className={`${inputClass} pr-16`} inputMode="numeric" type="number" min="1" max="1000" value={form.hours} onChange={e => set("hours", e.target.value)} /><span className="pointer-events-none absolute right-5 top-[17px] text-sm text-slate-500">시간</span></div></Field>
              <Field label="실습 진행일"><div className="grid grid-cols-3 gap-2">{[["weekday", "평일"], ["weekend", "주말"], ["both", "평일·주말"]].map(([value, label]) => <button key={value} type="button" onClick={() => set("days", value)} className={`min-h-[50px] rounded-2xl border px-1 text-[13px] font-semibold transition ${form.days === value ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{label}</button>)}</div><p className="mt-2 text-xs text-slate-500">선택한 내용은 실습배정지원센터 메모에 기록됩니다.</p></Field>
              
<Field label="담당자 성함">
  <input
    className={inputClass}
    value={form.assignee}
    disabled={fromPortal}
    placeholder="담당 학습설계사 성함"
    onChange={e => set("assignee", e.target.value)}
  />
</Field>

            </div>
          </section>
          
          {submitted ? (
            <div
              role="status"
              className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center"
            >
              <p className="text-lg font-bold text-green-800">
                실습 신청이 접수되었습니다.
              </p>
              <p className="mt-2 text-sm text-green-700">
                담당자가 신청 내용을 확인한 후 안내해 드립니다.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                !canSubmit ||
                submitting ||
                (fromPortal && !authenticated)
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

          <p className="text-center text-[13px] font-semibold text-slate-600">담당자와 꼭 상의 후 신청해 주세요.</p>
          <p className="text-center text-xs text-slate-400">신청 완료가 실습 배정 확정을 의미하지는 않습니다.</p>
          {!canSubmit && <p className="text-center text-xs text-slate-400">필수 입력항목을 확인해 주세요.</p>}
        </>)}
      </div>
    </div>
  </main>;
}
