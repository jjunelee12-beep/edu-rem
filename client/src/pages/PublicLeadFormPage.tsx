import { useMemo, useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import "@/styles/public-lead-form.css";

export default function PublicLeadFormPage() {
  const [match, params] = useRoute("/form/:token");
  const token = match ? params.token : "";

  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [finalEducation, setFinalEducation] = useState("");
  const [desiredCourse, setDesiredCourse] = useState("");
  const [channel, setChannel] = useState("");
  const [notes, setNotes] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState(false);

  const normalizedPhone = useMemo(() => {
    return phone.replace(/\D/g, "").slice(0, 11);
  }, [phone]);

  const formattedPhone = useMemo(() => {
    const digits = phone.replace(/\D/g, "").slice(0, 11);

    if (digits.length < 4) return digits;
    if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }, [phone]);

  const formQuery = trpc.leadForm.getByToken.useQuery(
    { token },
    { enabled: !!token }
  );

  const submitMutation = trpc.leadForm.submit.useMutation({
    onSuccess: () => {
      setDone(true);
    },
    onError: (err) => {
      alert(err.message || "접수 중 오류가 발생했습니다.");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (submitMutation.isPending) return;

    if (!clientName.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    if (normalizedPhone.length < 10) {
      alert("전화번호를 정확히 입력해주세요.");
      return;
    }

    if (!finalEducation) {
      alert("최종학력을 선택해주세요.");
      return;
    }

    if (!desiredCourse) {
      alert("희망과정을 선택해주세요.");
      return;
    }

    if (!channel.trim()) {
      alert("문의경로를 입력해주세요.");
      return;
    }

    if (!agreed) {
      alert("개인정보 수집 및 이용에 동의해주세요.");
      return;
    }

    submitMutation.mutate({
      token,
      clientName: clientName.trim(),
      phone: normalizedPhone,
      finalEducation,
      desiredCourse,
      channel: channel.trim(),
      notes: notes.trim(),
    });
  };

  if (formQuery.isLoading) {
    return (
      <PageShell>
        <div className="lead-form-state-box">
          <h2 className="lead-form-state-title">불러오는 중입니다...</h2>
          <p className="lead-form-state-text">잠시만 기다려주세요.</p>
        </div>
      </PageShell>
    );
  }

  if (!token || !formQuery.data?.ok) {
    return (
      <PageShell>
        <div className="lead-form-state-box">
          <h2 className="lead-form-state-title">유효하지 않은 링크입니다.</h2>
          <p className="lead-form-state-text">관리자에게 문의해주세요.</p>
        </div>
      </PageShell>
    );
  }

  if (done) {
    return (
      <PageShell>
        <div className="lead-form-state-box">
          <h2 className="lead-form-state-title">상담 신청이 접수되었습니다.</h2>
          <p className="lead-form-state-text">
            순차적으로 확인 후 빠르게 연락드리겠습니다.
          </p>
        </div>
      </PageShell>
    );
  }

  return (
  <PageShell>
    <div className="lead-form-card">
<div className="lead-form-header">
  <h1 className="lead-form-title">
    <span className="lead-form-title-line lead-form-title-line--first">
      <img
        src="/images/logo.png"
        alt="위드원 교육 로고"
        className="lead-form-logo"
      />
      <span>목표를 향한 배움의 길,</span>
    </span>
    <span className="lead-form-title-line">위드원 교육이 함께할게요</span>
  </h1>

  <p className="lead-form-subtitle">
    상담은 <strong>100% 무료</strong>로 진행됩니다.
  </p>
</div>
      {/* 🔥 여기 안으로 들어가야됨 */}
      <form className="lead-form-body" onSubmit={handleSubmit}>
        <input
          className="lead-form-input"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="이름"
          autoComplete="name"
        />

        <input
          className="lead-form-input"
          value={formattedPhone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="전화번호"
          inputMode="numeric"
          autoComplete="tel"
        />

        <div className="lead-form-select-wrap">
          <select
            className="lead-form-select"
            value={finalEducation}
            onChange={(e) => setFinalEducation(e.target.value)}
          >
            <option value="">최종학력 선택</option>
            <option value="고등학교 졸업">고등학교 졸업</option>
            <option value="전문학사">전문학사</option>
            <option value="학사">학사</option>
            <option value="석사 이상">석사 이상</option>
            <option value="기타">기타</option>
          </select>
          <span className="lead-form-select-arrow">⌄</span>
        </div>

        <div className="lead-form-select-wrap">
          <select
            className="lead-form-select"
            value={desiredCourse}
            onChange={(e) => setDesiredCourse(e.target.value)}
          >
            <option value="">희망과정 선택</option>
            <option value="사회복지사">사회복지사</option>
            <option value="보육교사">보육교사</option>
            <option value="평생교육사">평생교육사</option>
            <option value="건강가정사">건강가정사</option>
            <option value="한국어교원">한국어교원</option>
            <option value="청소년지도사">청소년지도사</option>
            <option value="산업기사/기사">산업기사/기사</option>
            <option value="전문학사/학사">전문학사/학사</option>
            <option value="기타">기타</option>
          </select>
          <span className="lead-form-select-arrow">⌄</span>
        </div>

        <input
          className="lead-form-input"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          placeholder="문의경로 (예. 블로그, 인스타, 지인추천)"
        />

        <textarea
          className="lead-form-textarea"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="진행하시면서 걱정되시는 부분 적어주세요!"
        />

        <label className="lead-form-agree">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>개인정보 수집 및 이용에 동의합니다.</span>
        </label>

        <button
          type="submit"
          className="lead-form-submit"
          disabled={submitMutation.isPending}
        >
          {submitMutation.isPending ? "접수 중..." : "1:1 맞춤 상담 받기"}
        </button>
      </form>

    </div>
  </PageShell>
);
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="lead-form-page">{children}</div>;
}