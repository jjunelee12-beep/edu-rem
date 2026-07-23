import { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  Loader2,
  Phone,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";

const EDUCATION_OPTIONS = [
  "고등학교 졸업",
  "전문대 졸업",
  "4년제 대학교 졸업",
  "대학교 재학",
  "대학교 중퇴",
  "대학원 졸업",
  "기타",
];

const CONSULTATION_TIME_OPTIONS = [
  "오전 09:00~12:00",
  "점심 12:00~13:00",
  "오후 13:00~18:00",
  "저녁 18:00~21:00",
  "시간 상관없음",
];

function normalizePhone(value: string) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, 11);
}

function formatPhone(value: string) {
  const digits = normalizePhone(value);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 7) {
    return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  }

  if (digits.length <= 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export default function WithOneLanding() {

  // 하단 고정 버튼을 눌렀을 때 나오는 팝업 상담폼
const [clientName, setClientName] = useState("");
const [phone, setPhone] = useState("");
const [finalEducation, setFinalEducation] = useState("");
const [consultationTime, setConsultationTime] = useState("");
const [privacyAgreed, setPrivacyAgreed] = useState(false);

// 랜딩 이미지 마지막에 항상 노출되는 인라인 상담폼
const [inlineClientName, setInlineClientName] = useState("");
const [inlinePhone, setInlinePhone] = useState("");
const [inlineFinalEducation, setInlineFinalEducation] = useState("");
const [inlineConsultationTime, setInlineConsultationTime] = useState("");
const [inlinePrivacyAgreed, setInlinePrivacyAgreed] = useState(false);

const [showConsultForm, setShowConsultForm] = useState(false);
const [showComplete, setShowComplete] = useState(false);
const [showInlineComplete, setShowInlineComplete] = useState(false);

// 현재 어느 상담폼에서 전송했는지 구분
const [submitSource, setSubmitSource] = useState<"modal" | "inline" | null>(
  null
);

  const submitMutation = trpc.withOneLanding.submit.useMutation({
  onSuccess: () => {
    if (submitSource === "inline") {
      setShowInlineComplete(true);

      setInlineClientName("");
      setInlinePhone("");
      setInlineFinalEducation("");
      setInlineConsultationTime("");
      setInlinePrivacyAgreed(false);

      window.setTimeout(() => {
        document
          .getElementById("withone-inline-consultation")
          ?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
      }, 50);

      return;
    }

    setShowComplete(true);
  },

  onError: (error) => {
    toast.error(error.message || "상담 신청 중 오류가 발생했습니다.");
  },

  onSettled: () => {
    setSubmitSource(null);
  },
});

  useEffect(() => {
  if (!showConsultForm) {
    return;
  }

  const originalOverflow = document.body.style.overflow;
  document.body.style.overflow = "hidden";

  return () => {
    document.body.style.overflow = originalOverflow;
  };
}, [showConsultForm]);

  const openConsultForm = () => {
  setShowComplete(false);
  setShowConsultForm(true);
};

const closeConsultForm = () => {
  setShowConsultForm(false);
  setShowComplete(false);

  setClientName("");
  setPhone("");
  setFinalEducation("");
  setConsultationTime("");
  setPrivacyAgreed(false);
};

  const handleSubmit = (event?: React.FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    const normalizedName = clientName.trim();
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedName) {
      toast.error("이름을 입력해주세요.");
      return;
    }

    if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
      toast.error("올바른 연락처를 입력해주세요.");
      return;
    }

    if (!privacyAgreed) {
      toast.error("개인정보 수집 및 이용에 동의해주세요.");
      return;
    }

    if (submitMutation.isPending) {
      return;
    }

setSubmitSource("modal");

    submitMutation.mutate({
      clientName: normalizedName,
      phone: normalizedPhone,
      finalEducation,
      consultationTime,
      privacyAgreed: true,
    });
  };

const handleInlineSubmit = (
  event: React.FormEvent<HTMLFormElement>
) => {
  event.preventDefault();

  const normalizedName = inlineClientName.trim();
  const normalizedPhone = normalizePhone(inlinePhone);

  if (!normalizedName) {
    toast.error("이름을 입력해주세요.");
    return;
  }

  if (normalizedPhone.length < 10 || normalizedPhone.length > 11) {
    toast.error("올바른 연락처를 입력해주세요.");
    return;
  }

  if (!inlinePrivacyAgreed) {
    toast.error("개인정보 수집 및 이용에 동의해주세요.");
    return;
  }

  if (submitMutation.isPending) {
    return;
  }

  setShowInlineComplete(false);
  setSubmitSource("inline");

  submitMutation.mutate({
    clientName: normalizedName,
    phone: normalizedPhone,
    finalEducation: inlineFinalEducation,
    consultationTime: inlineConsultationTime,
    privacyAgreed: true,
  });
};

  return (
    <div className="min-h-screen bg-[#eef1f5]">
      {/* PC에서는 모바일형 랜딩페이지가 중앙에 표시됩니다. */}
      <main className="relative mx-auto min-h-screen w-full max-w-[520px] overflow-hidden bg-white pb-[108px] shadow-2xl">
        {/* 긴 랜딩 디자인 이미지 */}
        {/* 랜딩 디자인 이미지 1~6 순서대로 출력 */}
<section className="w-full bg-white">
  {[
    "/images/withone/landingform1.png",
    "/images/withone/landingform2.png",
    "/images/withone/landingform3.png",
    "/images/withone/landingform4.png",
    "/images/withone/landingform5.png",
    "/images/withone/landingform6.png",
  ].map((src, index) => (
    <img
      key={src}
      src={src}
      alt={`위드원교육 사회복지사 2급 상담 안내 ${index + 1}`}
      className="block h-auto w-full"
      loading={index === 0 ? "eager" : "lazy"}
      draggable={false}
    />
  ))}
</section>

{/* 랜딩 이미지 마지막에 고정 노출되는 상담 신청 영역 */}
<section
  id="withone-inline-consultation"
  className="relative overflow-hidden bg-[#030503] px-4 pb-16 pt-14 sm:px-6"
>
  {/* 네온 배경 장식 */}
  <div className="pointer-events-none absolute -left-20 top-10 h-56 w-56 rounded-full bg-[#bfff00]/10 blur-[80px]" />
  <div className="pointer-events-none absolute -right-24 bottom-24 h-64 w-64 rounded-full bg-[#7dff00]/10 blur-[90px]" />

  <div className="pointer-events-none absolute left-1/2 top-0 h-px w-[88%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[#baff00]/80 to-transparent shadow-[0_0_18px_rgba(186,255,0,0.8)]" />

  <div className="relative mx-auto max-w-[460px]">
    {/* 상담폼 제목 */}
    <div className="text-center">
      <span className="inline-flex items-center rounded-full border border-[#baff00]/35 bg-[#baff00]/10 px-4 py-2 text-[12px] font-black tracking-[-0.02em] text-[#c8ff35] shadow-[0_0_22px_rgba(186,255,0,0.12)]">
        위드원교육 1:1 맞춤 상담
      </span>

      <h2 className="mt-5 break-keep text-[29px] font-black leading-[1.25] tracking-[-0.05em] text-white">
        궁금한 점을 남겨주시면
        <br />
        <span className="text-[#c3ff24]">빠르게 안내해드립니다</span>
      </h2>

      <p className="mt-3 break-keep text-[14px] leading-6 text-white/55">
        간단한 정보만 입력해 주세요.
        <br />
        담당자가 확인 후 순차적으로 연락드립니다.
      </p>
    </div>

    {/* 상담 입력 카드 */}
    <div className="relative mt-9 overflow-hidden rounded-[28px] border border-[#baff00]/25 bg-[#0a0d09]/95 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.5),0_0_35px_rgba(186,255,0,0.08)] sm:p-6">
      <div className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#c7ff3a] to-transparent shadow-[0_0_14px_rgba(199,255,58,0.8)]" />

      {showInlineComplete ? (
        <div className="flex min-h-[520px] flex-col items-center justify-center px-2 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-[#c3ff24]/40 bg-[#c3ff24]/10 shadow-[0_0_35px_rgba(195,255,36,0.2)]">
            <Check
              className="h-10 w-10 text-[#c3ff24]"
              strokeWidth={3}
            />
          </div>

          <h3 className="mt-7 text-[25px] font-black tracking-[-0.04em] text-white">
            상담 신청이 완료되었습니다
          </h3>

          <p className="mt-4 break-keep text-[15px] leading-7 text-white/60">
            담당자가 신청 내용을 확인한 후
            <br />
            순차적으로 연락드리겠습니다.
          </p>

          <button
            type="button"
            onClick={() => setShowInlineComplete(false)}
            className="mt-8 h-[58px] w-full rounded-2xl border border-[#c3ff24]/40 bg-[#c3ff24]/10 text-[16px] font-black text-[#c3ff24] transition hover:bg-[#c3ff24]/15 active:scale-[0.99]"
          >
            추가 상담 신청하기
          </button>
        </div>
      ) : (
        <form onSubmit={handleInlineSubmit}>
          <div className="grid grid-cols-2 gap-3">
            {/* 이름 */}
            <div>
              <label
                htmlFor="withone-inline-client-name"
                className="mb-2 block text-[13px] font-bold text-white/80"
              >
                이름 <span className="text-[#c3ff24]">*</span>
              </label>

              <div className="relative">
                <UserRound className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/35" />

                <input
                  id="withone-inline-client-name"
                  type="text"
                  value={inlineClientName}
                  onChange={(event) =>
                    setInlineClientName(event.target.value)
                  }
                  placeholder="이름"
                  autoComplete="name"
                  maxLength={100}
                  className="h-[56px] w-full rounded-2xl border border-white/10 bg-white/[0.055] pl-11 pr-3 text-[15px] font-medium text-white outline-none transition placeholder:text-white/25 focus:border-[#c3ff24]/70 focus:bg-white/[0.075] focus:ring-4 focus:ring-[#c3ff24]/10"
                />
              </div>
            </div>

            {/* 연락처 */}
            <div>
              <label
                htmlFor="withone-inline-phone"
                className="mb-2 block text-[13px] font-bold text-white/80"
              >
                연락처 <span className="text-[#c3ff24]">*</span>
              </label>

              <div className="relative">
                <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/35" />

                <input
                  id="withone-inline-phone"
                  type="tel"
                  inputMode="numeric"
                  value={formatPhone(inlinePhone)}
                  onChange={(event) =>
                    setInlinePhone(normalizePhone(event.target.value))
                  }
                  placeholder="010-0000-0000"
                  autoComplete="tel"
                  maxLength={13}
                  className="h-[56px] w-full rounded-2xl border border-white/10 bg-white/[0.055] pl-11 pr-3 text-[15px] font-medium text-white outline-none transition placeholder:text-white/25 focus:border-[#c3ff24]/70 focus:bg-white/[0.075] focus:ring-4 focus:ring-[#c3ff24]/10"
                />
              </div>
            </div>

            {/* 최종학력 */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="withone-inline-final-education"
                  className="text-[13px] font-bold text-white/80"
                >
                  최종학력
                </label>

                <span className="text-[11px] text-white/30">
                  선택
                </span>
              </div>

              <div className="relative">
                <select
                  id="withone-inline-final-education"
                  value={inlineFinalEducation}
                  onChange={(event) =>
                    setInlineFinalEducation(event.target.value)
                  }
                  className={`h-[56px] w-full appearance-none rounded-2xl border border-white/10 bg-[#11150f] px-3 pr-9 text-[14px] outline-none transition focus:border-[#c3ff24]/70 focus:ring-4 focus:ring-[#c3ff24]/10 ${
                    inlineFinalEducation
                      ? "text-white"
                      : "text-white/30"
                  }`}
                >
                  <option value="">최종학력 선택</option>

                  {EDUCATION_OPTIONS.map((option) => (
                    <option
                      key={option}
                      value={option}
                      className="bg-[#11150f] text-white"
                    >
                      {option}
                    </option>
                  ))}
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/35" />
              </div>
            </div>

            {/* 상담 가능 시간 */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="withone-inline-consultation-time"
                  className="text-[13px] font-bold text-white/80"
                >
                  상담 가능 시간
                </label>

                <span className="text-[11px] text-white/30">
                  선택
                </span>
              </div>

              <div className="relative">
                <select
                  id="withone-inline-consultation-time"
                  value={inlineConsultationTime}
                  onChange={(event) =>
                    setInlineConsultationTime(event.target.value)
                  }
                  className={`h-[56px] w-full appearance-none rounded-2xl border border-white/10 bg-[#11150f] px-3 pr-9 text-[14px] outline-none transition focus:border-[#c3ff24]/70 focus:ring-4 focus:ring-[#c3ff24]/10 ${
                    inlineConsultationTime
                      ? "text-white"
                      : "text-white/30"
                  }`}
                >
                  <option value="">상담시간 선택</option>

                  {CONSULTATION_TIME_OPTIONS.map((option) => (
                    <option
                      key={option}
                      value={option}
                      className="bg-[#11150f] text-white"
                    >
                      {option}
                    </option>
                  ))}
                </select>

                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-white/35" />
              </div>
            </div>
          </div>

          {/* 개인정보 동의 */}
          <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={inlinePrivacyAgreed}
                onChange={(event) =>
                  setInlinePrivacyAgreed(event.target.checked)
                }
                className="peer sr-only"
              />

              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-white/20 bg-black/20 transition peer-checked:border-[#c3ff24] peer-checked:bg-[#c3ff24] peer-checked:shadow-[0_0_15px_rgba(195,255,36,0.35)]">
                {inlinePrivacyAgreed && (
                  <Check
                    className="h-4 w-4 text-[#071000]"
                    strokeWidth={3.5}
                  />
                )}
              </span>

              <span className="flex-1">
                <span className="block text-[13px] font-bold leading-5 text-white/80">
                  개인정보 수집 및 이용에 동의합니다.
                  <span className="ml-1 text-[#c3ff24]">
                    (필수)
                  </span>
                </span>

                <span className="mt-1 block break-keep text-[11px] leading-5 text-white/35">
                  상담 안내를 위해 입력하신 정보를 수집합니다.
                </span>
              </span>
            </label>
          </div>

          {/* 상담 신청 버튼 */}
          <button
            type="submit"
            disabled={submitMutation.isPending}
            className="mt-5 flex h-[64px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#aaff00] via-[#cfff27] to-[#aaff00] text-[19px] font-black tracking-[-0.03em] text-[#071000] shadow-[0_13px_32px_rgba(170,255,0,0.22),0_0_22px_rgba(195,255,36,0.16)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitMutation.isPending && submitSource === "inline" ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                신청 중입니다
              </>
            ) : (
              "무료 상담 신청하기"
            )}
          </button>

          <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-white/35">
            <ShieldCheck className="h-4 w-4 text-[#c3ff24]/70" />
            입력하신 정보는 상담 안내 목적으로만 사용됩니다.
          </div>
        </form>
      )}
    </div>
  </div>
</section>
      </main>

      {/* 화면 하단 고정 상담 버튼 */}
      <div className="fixed inset-x-0 bottom-0 z-40">
        <div className="mx-auto w-full max-w-[520px] border-t border-black/5 bg-white/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_30px_rgba(15,32,61,0.16)] backdrop-blur-xl">
          <button
            type="button"
            onClick={openConsultForm}
            className="flex h-[60px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#245dbd] to-[#367be4] text-[18px] font-black text-white shadow-[0_10px_24px_rgba(42,105,206,0.3)] transition hover:brightness-105 active:scale-[0.99]"
          >
            <Phone className="h-5 w-5" />
            무료 상담 신청하기
          </button>
        </div>
      </div>
{/* 상담 신청 바텀시트 */}
{showConsultForm && (
  <div
    className="fixed inset-0 z-[100]"
    role="dialog"
    aria-modal="true"
    aria-labelledby="withone-consult-title"
  >
    {/* 바깥 어두운 배경 */}
    <button
      type="button"
      aria-label="상담 신청창 닫기"
      className="absolute inset-0 h-full w-full bg-[#101827]/60 backdrop-blur-[2px]"
      onClick={closeConsultForm}
    />

    {/* 상담 신청 바텀시트 */}
    <section
      className="absolute inset-x-0 bottom-0 mx-auto max-h-[92dvh] w-full max-w-[520px] overflow-y-auto rounded-t-[30px] bg-white shadow-[0_-20px_70px_rgba(0,0,0,0.25)]"
      onClick={(event) => event.stopPropagation()}
    >
      {/* 상단 고정 헤더 */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-[#edf0f4] bg-white/95 px-5 py-4 backdrop-blur-xl">
        <div>
          <h2
            id="withone-consult-title"
            className="text-[22px] font-black tracking-[-0.03em] text-[#17223b]"
          >
            무료 상담 신청
          </h2>

          <p className="mt-1 text-[13px] text-[#7a8496]">
            간단한 정보만 입력해주세요.
          </p>
        </div>

        <button
          type="button"
          onClick={closeConsultForm}
          aria-label="닫기"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f1f3f6] text-[#4f596c] transition hover:bg-[#e5e8ed]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* 입력폼 및 완료 화면 영역 */}
      <div className="relative px-5 pb-[max(28px,env(safe-area-inset-bottom))] pt-5 sm:px-6">
        <form
          onSubmit={handleSubmit}
          className="rounded-[24px] border border-[#e5eaf2] bg-white p-5 shadow-[0_16px_45px_rgba(28,53,94,0.1)]"
        >
          <div className="space-y-5">
            {/* 이름 */}
            <div>
              <label
                htmlFor="withone-client-name"
                className="mb-2 flex items-center gap-1.5 text-[15px] font-bold text-[#202b42]"
              >
                이름
                <span className="text-[#2d6cdf]">*</span>
              </label>

              <div className="relative">
                <UserRound className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98a2b5]" />

                <input
                  id="withone-client-name"
                  type="text"
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  placeholder="이름을 입력해주세요"
                  autoComplete="name"
                  maxLength={100}
                  className="h-[58px] w-full rounded-2xl border border-[#dce2eb] bg-[#fbfcfe] pl-12 pr-4 text-[16px] text-[#17223b] outline-none transition placeholder:text-[#abb3c1] focus:border-[#3975dc] focus:bg-white focus:ring-4 focus:ring-[#3975dc]/10"
                />
              </div>
            </div>

            {/* 연락처 */}
            <div>
              <label
                htmlFor="withone-phone"
                className="mb-2 flex items-center gap-1.5 text-[15px] font-bold text-[#202b42]"
              >
                연락처
                <span className="text-[#2d6cdf]">*</span>
              </label>

              <div className="relative">
                <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#98a2b5]" />

                <input
                  id="withone-phone"
                  type="tel"
                  inputMode="numeric"
                  value={formatPhone(phone)}
                  onChange={(event) =>
                    setPhone(normalizePhone(event.target.value))
                  }
                  placeholder="010-0000-0000"
                  autoComplete="tel"
                  maxLength={13}
                  className="h-[58px] w-full rounded-2xl border border-[#dce2eb] bg-[#fbfcfe] pl-12 pr-4 text-[16px] text-[#17223b] outline-none transition placeholder:text-[#abb3c1] focus:border-[#3975dc] focus:bg-white focus:ring-4 focus:ring-[#3975dc]/10"
                />
              </div>
            </div>

            {/* 최종학력 */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="withone-final-education"
                  className="text-[15px] font-bold text-[#202b42]"
                >
                  최종학력
                </label>

                <span className="text-xs font-medium text-[#8c96a9]">
                  선택
                </span>
              </div>

              <div className="relative">
                <select
                  id="withone-final-education"
                  value={finalEducation}
                  onChange={(event) =>
                    setFinalEducation(event.target.value)
                  }
                  className={`h-[58px] w-full appearance-none rounded-2xl border border-[#dce2eb] bg-[#fbfcfe] px-4 pr-12 text-[16px] outline-none transition focus:border-[#3975dc] focus:bg-white focus:ring-4 focus:ring-[#3975dc]/10 ${
                    finalEducation
                      ? "text-[#17223b]"
                      : "text-[#abb3c1]"
                  }`}
                >
                  <option value="">최종학력을 선택해주세요</option>

                  {EDUCATION_OPTIONS.map((option) => (
                    <option
                      key={option}
                      value={option}
                      className="text-[#17223b]"
                    >
                      {option}
                    </option>
                  ))}
                </select>

                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8f99aa]" />
              </div>
            </div>

            {/* 상담 가능 시간 */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="withone-consultation-time"
                  className="text-[15px] font-bold text-[#202b42]"
                >
                  상담 가능 시간
                </label>

                <span className="text-xs font-medium text-[#8c96a9]">
                  선택
                </span>
              </div>

              <div className="relative">
                <select
                  id="withone-consultation-time"
                  value={consultationTime}
                  onChange={(event) =>
                    setConsultationTime(event.target.value)
                  }
                  className={`h-[58px] w-full appearance-none rounded-2xl border border-[#dce2eb] bg-[#fbfcfe] px-4 pr-12 text-[16px] outline-none transition focus:border-[#3975dc] focus:bg-white focus:ring-4 focus:ring-[#3975dc]/10 ${
                    consultationTime
                      ? "text-[#17223b]"
                      : "text-[#abb3c1]"
                  }`}
                >
                  <option value="">상담 가능 시간을 선택해주세요</option>

                  {CONSULTATION_TIME_OPTIONS.map((option) => (
                    <option
                      key={option}
                      value={option}
                      className="text-[#17223b]"
                    >
                      {option}
                    </option>
                  ))}
                </select>

                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#8f99aa]" />
              </div>
            </div>

            {/* 개인정보 동의 */}
            <div className="rounded-2xl bg-[#f6f8fb] p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={privacyAgreed}
                  onChange={(event) =>
                    setPrivacyAgreed(event.target.checked)
                  }
                  className="peer sr-only"
                />

                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-[#c8d0dd] bg-white transition peer-checked:border-[#316fd5] peer-checked:bg-[#316fd5]">
                  {privacyAgreed && (
                    <Check
                      className="h-4 w-4 text-white"
                      strokeWidth={3}
                    />
                  )}
                </span>

                <span className="flex-1">
                  <span className="block text-[14px] font-bold leading-5 text-[#29344a]">
                    개인정보 수집 및 이용에 동의합니다.
                    <span className="ml-1 text-[#316fd5]">
                      (필수)
                    </span>
                  </span>

                  <span className="mt-1 block break-keep text-[12px] leading-5 text-[#7a8599]">
                    상담 안내를 위해 이름, 연락처, 최종학력 및 상담
                    가능 시간을 수집합니다.
                  </span>
                </span>
              </label>
            </div>

            {/* 실제 상담 신청 버튼 */}
            <button
              type="submit"
              disabled={submitMutation.isPending}
              className="flex h-[62px] w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#245dbd] to-[#367be4] text-[18px] font-black text-white shadow-[0_12px_25px_rgba(42,105,206,0.28)] transition hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  신청 중입니다
                </>
              ) : (
                "상담 신청하기"
              )}
            </button>

            <div className="flex items-center justify-center gap-1.5 text-[12px] text-[#8791a4]">
              <ShieldCheck className="h-4 w-4" />
              입력하신 정보는 상담 안내 목적으로만 사용됩니다.
            </div>
          </div>
        </form>

        {/* 상담 신청 완료 오버레이 */}
        {showComplete && (
          <div className="absolute inset-0 z-20 flex min-h-full items-center justify-center bg-white/75 px-5 py-8 backdrop-blur-[3px]">
            <div className="relative w-full max-w-[400px] rounded-[28px] border border-[#e4e8ef] bg-white px-6 pb-6 pt-8 text-center shadow-[0_24px_70px_rgba(15,32,61,0.24)]">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e8f7ee]">
                <Check
                  className="h-8 w-8 text-[#21a45b]"
                  strokeWidth={3}
                />
              </div>

              <h3 className="mt-5 text-[23px] font-black tracking-[-0.03em] text-[#17223b]">
                상담 신청이 완료되었습니다
              </h3>

              <p className="mt-4 break-keep text-[15px] leading-7 text-[#687388]">
                담당자가 신청 내용을 확인한 후
                <br />
                순차적으로 연락드리고 있습니다.
                <br />
                감사합니다.
              </p>

              <button
                type="button"
                onClick={() => setShowComplete(false)}
                className="mt-7 h-[56px] w-full rounded-2xl bg-[#2867ca] text-[17px] font-black text-white transition hover:bg-[#205bb6]"
              >
                확인
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  </div>
)}
    </div>
  );
}