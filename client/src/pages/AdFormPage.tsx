import { useMemo, useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import "@/styles/ad-form.css";

export default function AdFormPage() {
  const [match, params] = useRoute("/ad-form/:token");
  const token = match ? params.token : "";

  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [finalEducation, setFinalEducation] = useState("");
  const [desiredCourse, setDesiredCourse] = useState("");
  const [channel, setChannel] = useState("광고폼");
  const [notes, setNotes] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [done, setDone] = useState(false);
  const [openSheet, setOpenSheet] = useState(false);

  const formQuery = trpc.publicForm.getByToken.useQuery(
    { token, formType: "ad" },
    { enabled: !!token }
  );

  const submitMutation = trpc.publicForm.submit.useMutation({
    onSuccess: () => {
      setDone(true);
      setOpenSheet(false);
    },
    onError: (err) => {
      alert(err.message || "접수 중 오류가 발생했습니다.");
    },
  });

  const normalizedPhone = useMemo(() => {
    return phone.replace(/\D/g, "").slice(0, 11);
  }, [phone]);

  const formattedPhone = useMemo(() => {
    const digits = phone.replace(/\D/g, "").slice(0, 11);
    if (digits.length < 4) return digits;
    if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }, [phone]);

  const callPhone = formQuery.data?.phone || "";
  const callHref = `tel:${callPhone}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!clientName.trim()) return alert("이름을 입력해주세요.");
    if (normalizedPhone.length < 10) return alert("전화번호를 정확히 입력해주세요.");
    if (!finalEducation) return alert("최종학력을 선택해주세요.");
    if (!desiredCourse) return alert("희망과정을 선택해주세요.");
    if (!agreed) return alert("개인정보 수집 및 이용에 동의해주세요.");

    submitMutation.mutate({
      token,
      formType: "ad",
      clientName: clientName.trim(),
      phone: normalizedPhone,
      finalEducation,
      desiredCourse,
      channel,
      notes: notes.trim(),
    });
  };

  if (formQuery.isLoading) {
    return <div className="ad-form-loading">불러오는 중...</div>;
  }

  if (!token || !formQuery.data?.ok) {
    return <div className="ad-form-loading">유효하지 않은 광고폼 링크입니다.</div>;
  }

  return (
    <div className="ad-form-page">
      <div className="ad-form-hero">
        <div className="ad-form-hero-inner">
          <div className="ad-form-header">
            <h1 className="ad-form-title">
              <span className="ad-form-title-inner">
                <img
                  src="/images/logo.png"
                  alt="위드원 교육 로고"
                  className="ad-form-logo"
                />
                목표를 향한 배움의 길,
              </span>
              <br />
              위드원 교육이 함께할게요
            </h1>

            <p className="ad-form-subtitle">
              상담은 <strong>100% 무료</strong>로 진행됩니다.
            </p>
          </div>
        </div>
      </div>

      <div className="ad-form-content">
        <section className="ad-form-section">
          <h2>학점은행제 맞춤 상담</h2>
          <p>
            사회복지사, 보육교사, 학위과정 등 현재 상황에 맞춰
            빠르게 상담 도와드립니다.
          </p>
        </section>

        <section className="ad-form-section spacer"></section>
      </div>

      <div className="ad-form-bottom-bar">
        <a
          href={callPhone ? callHref : undefined}
          className={`ad-form-call-btn ${!callPhone ? "is-disabled" : ""}`}
          onClick={(e) => {
            if (!callPhone) {
              e.preventDefault();
              alert("직원 전화번호가 등록되어 있지 않습니다.");
            }
          }}
        >
          빠른 전화하기
        </a>

        <button
          type="button"
          className="ad-form-apply-btn"
          onClick={() => setOpenSheet(true)}
        >
          상담 신청
        </button>
      </div>

      <div
        className={`ad-form-sheet-backdrop ${openSheet ? "open" : ""}`}
        onClick={() => setOpenSheet(false)}
      />

      <div className={`ad-form-sheet ${openSheet ? "open" : ""}`}>
        <div className="ad-form-sheet-header">
          <h3>상담 신청</h3>
          <button type="button" onClick={() => setOpenSheet(false)}>
            닫기
          </button>
        </div>

        {done ? (
          <div className="ad-form-success">
            상담 신청이 접수되었습니다.
            <br />
            순차적으로 연락드리겠습니다.
          </div>
        ) : (
          <form className="ad-form-sheet-body" onSubmit={handleSubmit}>
            <input
              className="ad-form-input"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="이름"
            />

            <input
              className="ad-form-input"
              value={formattedPhone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="전화번호"
              inputMode="numeric"
            />

            <select
              className="ad-form-input"
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

            <select
              className="ad-form-input"
              value={desiredCourse}
              onChange={(e) => setDesiredCourse(e.target.value)}
            >
              <option value="">희망과정 선택</option>
              <option value="사회복지사">사회복지사</option>
              <option value="보육교사">보육교사</option>
              <option value="평생교육사">평생교육사</option>
              <option value="건강가정사">건강가정사</option>
              <option value="한국어교원">한국어교원</option>
              <option value="전문학사/학사">전문학사/학사</option>
              <option value="기타">기타</option>
            </select>

            <input
              className="ad-form-input"
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              placeholder="문의경로"
            />

            <textarea
              className="ad-form-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="진행하시면서 걱정되시는 부분 적어주세요!"
            />

            <label className="ad-form-agree">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              <span>개인정보 수집 및 이용에 동의합니다.</span>
            </label>

            <button
              type="submit"
              className="ad-form-submit"
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? "접수 중..." : "1:1 맞춤 상담 받기"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}