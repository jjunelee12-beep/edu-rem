import { useState } from "react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const onLogin = async () => {
    if (pending) return;

    setError("");

    if (!username.trim() || !password.trim()) {
      setError("아이디와 비밀번호를 입력해주세요.");
      return;
    }

    setPending(true);

    try {
      const res = await fetch(`/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setError(data?.message ?? "아이디 또는 비밀번호가 올바르지 않습니다.");
        setPending(false);
        return;
      }

      window.location.replace("/");
    } catch (_e) {
      setError("로그인 중 오류가 발생했습니다.");
      setPending(false);
    }
  };

  return (
    <div style={{ width: 360, margin: "120px auto", textAlign: "center" }}>
      <h2 style={{ marginBottom: 8 }}>위드원 교육 CRM</h2>

      <div style={{ marginBottom: 16, opacity: 0.7 }}>
        로그인 후 이용할 수 있습니다.
      </div>

      <input
        placeholder="아이디"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
        autoFocus
        disabled={pending}
      />

      <input
        placeholder="비밀번호"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 12 }}
        disabled={pending}
        onKeyDown={(e) => {
          if (e.key === "Enter") onLogin();
        }}
      />

      <button
        onClick={onLogin}
        style={{ width: "100%", padding: 10 }}
        disabled={pending}
      >
        {pending ? "로그인 중..." : "로그인"}
      </button>

      {error && <div style={{ marginTop: 12, color: "red" }}>{error}</div>}
    </div>
  );
}