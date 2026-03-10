import { useMemo, useState } from "react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";

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

  const formQuery = trpc.leadForm.getByToken.useQuery(
    { token },
    { enabled: !!token }
  );

  const submitMutation = trpc.leadForm.submit.useMutation({
    onSuccess: () => {
      setDone(true);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

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
    return <PageShell>불러오는 중입니다...</PageShell>;
  }

  if (!token || !formQuery.data?.ok) {
    return (
      <PageShell>
        <h2>유효하지 않은 링크입니다.</h2>
        <p>관리자에게 문의해주세요.</p>
      </PageShell>
    );
  }

  if (done) {
    return (
      <PageShell>
        <h2>상담 신청이 접수되었습니다.</h2>
        <p>순차적으로 상담드리고 있어 빠르게 연락드리겠습니다.</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>
          상담 신청
        </h1>
        <p style={{ color: "#666", fontSize: 14 }}>
          아래 정보를 입력해주시면 빠르게 안내드리겠습니다.
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
        <input
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          placeholder="이름"
          style={inputStyle}
        />

        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="전화번호"
          style={inputStyle}
        />

        <select
          value={finalEducation}
          onChange={(e) => setFinalEducation(e.target.value)}
          style={inputStyle}
        >
          <option value="">최종학력 선택</option>
          <option value="고등학교 졸업">고등학교 졸업</option>
          <option value="전문학사">전문학사</option>
          <option value="학사">학사</option>
          <option value="기타">기타</option>
        </select>

        <select
          value={desiredCourse}
          onChange={(e) => setDesiredCourse(e.target.value)}
          style={inputStyle}
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

        <input
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          placeholder="문의경로 (예: 블로그, 인스타, 지인추천)"
          style={inputStyle}
        />

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="진행하시면서 걱정되시는 부분 적어주세요!"
          style={textareaStyle}
        />

        <label style={{ fontSize: 14, color: "#444" }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ marginRight: 8 }}
          />
          개인정보 수집 및 이용에 동의합니다.
        </label>

        <button
          type="submit"
          disabled={submitMutation.isPending}
          style={buttonStyle}
        >
          {submitMutation.isPending ? "접수 중..." : "상담 신청하기"}
        </button>
      </form>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f6f7f9",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 460,
          background: "#fff",
          borderRadius: 16,
          padding: 28,
          boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
        }}
      >
        {children}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 46,
  padding: "0 14px",
  border: "1px solid #ddd",
  borderRadius: 10,
  fontSize: 14,
  boxSizing: "border-box",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 120,
  padding: "12px 14px",
  border: "1px solid #ddd",
  borderRadius: 10,
  fontSize: 14,
  boxSizing: "border-box",
  resize: "vertical",
  fontFamily: "inherit",
};

const buttonStyle: React.CSSProperties = {
  width: "100%",
  height: 48,
  border: "none",
  borderRadius: 10,
  background: "#111827",
  color: "#fff",
  fontSize: 15,
  cursor: "pointer",
};