import { useState } from "react";
import { GraduationCap } from "lucide-react";

export default function Login() {
  const companyName = "EduCanvas CRM";
const companySubtitle = "교육기관 통합 운영 SaaS 플랫폼";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

const [mode, setMode] = useState<
  "login" | "find_id" | "find_password"
>("login");

const [recoveryEmail, setRecoveryEmail] = useState("");
const [recoveryUsername, setRecoveryUsername] = useState("");
const [verificationCode, setVerificationCode] = useState("");

const [newPassword, setNewPassword] = useState("");
const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

const [recoveryMessage, setRecoveryMessage] = useState("");
const [recoveryName, setRecoveryName] = useState("");
const [recoveryPhone, setRecoveryPhone] = useState("");
const [codeSent, setCodeSent] = useState(false);
const [foundUsernames, setFoundUsernames] = useState<string[]>([]);

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

      const loginUser = data?.user as any;

if (!loginUser) {
  setError("로그인 응답에서 사용자 정보를 확인할 수 없습니다.");
  setPending(false);
  return;
}

localStorage.setItem("manus-runtime-user-info", JSON.stringify(loginUser));

if (loginUser.role === "superhost") {
  window.location.replace("/saas");
  return;
}

const slug =
  loginUser.organizationSlug ||
  loginUser.organization?.slug ||
  loginUser.organization?.organizationSlug;

if (slug) {
  window.location.replace(`/${slug}`);
  return;
}

window.location.replace("/");
    } catch (_e) {
      setError("로그인 중 오류가 발생했습니다.");
      setPending(false);
    }
  };

const sendRecoveryCode = async () => {
  setError("");
  setRecoveryMessage("");
  setFoundUsernames([]);

  if (!recoveryName.trim()) {
    setError("이름을 입력해주세요.");
    return;
  }

  if (!recoveryEmail.trim()) {
    setError("이메일을 입력해주세요.");
    return;
  }

  if (mode === "find_id" && !recoveryPhone.trim()) {
    setError("전화번호를 입력해주세요.");
    return;
  }

  if (mode === "find_password" && !recoveryUsername.trim()) {
    setError("아이디를 입력해주세요.");
    return;
  }

  try {
    const res = await fetch("/api/trpc/authRecovery.sendCode?batch=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        "0": {
          json: {
            organizationId: 1,
            purpose: mode === "find_id" ? "find_id" : "reset_password",
            name: recoveryName.trim(),
            phone: recoveryPhone.trim(),
            username: recoveryUsername.trim(),
            email: recoveryEmail.trim(),
          },
        },
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(
        data?.[0]?.error?.json?.message ||
          data?.error?.json?.message ||
          "인증코드 발송에 실패했습니다."
      );
    }


setVerificationCode("");
setNewPassword("");
setNewPasswordConfirm("");
    setCodeSent(true);
    setRecoveryMessage("인증코드가 발송되었습니다. 5분 이내에 입력해주세요.");
  } catch (e: any) {
    setError(e?.message || "인증코드 발송 중 오류가 발생했습니다.");
  }
};

const verifyFindId = async () => {
  setError("");
  setRecoveryMessage("");

  if (!verificationCode.trim()) {
    setError("인증코드를 입력해주세요.");
    return;
  }

  try {
    const res = await fetch("/api/trpc/authRecovery.verifyFindIdCode?batch=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        "0": {
          json: {
            organizationId: 1,
            email: recoveryEmail.trim(),
            code: verificationCode.trim(),
          },
        },
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(
        data?.[0]?.error?.json?.message ||
          data?.error?.json?.message ||
          "아이디 확인에 실패했습니다."
      );
    }

    const users = data?.[0]?.result?.data?.json?.users || [];
    setFoundUsernames(users.map((u: any) => String(u.username || "")));
    setRecoveryMessage("아이디 확인이 완료되었습니다.");
  } catch (e: any) {
    setError(e?.message || "아이디 확인 중 오류가 발생했습니다.");
  }
};

const resetRecoveryPassword = async () => {
  setError("");
  setRecoveryMessage("");

  if (!verificationCode.trim()) {
    setError("인증코드를 입력해주세요.");
    return;
  }

  if (!newPassword.trim() || !newPasswordConfirm.trim()) {
    setError("새 비밀번호를 입력해주세요.");
    return;
  }

  if (newPassword !== newPasswordConfirm) {
    setError("새 비밀번호가 서로 일치하지 않습니다.");
    return;
  }

  try {
    const res = await fetch("/api/trpc/authRecovery.resetPassword?batch=1", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        "0": {
          json: {
            organizationId: 1,
            name: recoveryName.trim(),
            username: recoveryUsername.trim(),
            email: recoveryEmail.trim(),
            code: verificationCode.trim(),
            newPassword,
            newPasswordConfirm,
          },
        },
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new Error(
        data?.[0]?.error?.json?.message ||
          data?.error?.json?.message ||
          "비밀번호 변경에 실패했습니다."
      );
    }

    setRecoveryMessage("비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.");
    setNewPassword("");
    setNewPasswordConfirm("");
    setVerificationCode("");
  } catch (e: any) {
    setError(e?.message || "비밀번호 변경 중 오류가 발생했습니다.");
  }
};

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f3f4f6] px-4">
      <div className="w-full max-w-[440px] rounded-[36px] border border-slate-200/80 bg-white px-8 py-9 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
  <GraduationCap className="h-10 w-10 text-slate-900" />
</div>

          <h1 className="text-[32px] font-bold tracking-tight text-slate-950">
            {companyName}
          </h1>

          <p className="mt-2 text-sm font-medium text-slate-500">
            {companySubtitle}
          </p>

          <p className="mt-1 text-sm text-slate-400">
  학사 · 정산 · 상담 · 실습 · 전자결재 통합 관리
</p>
        </div>

        <div className="space-y-3">
          <input
            placeholder="아이디"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-13 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70"
            autoFocus
            disabled={pending}
          />

          <input
            placeholder="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-13 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200/70"
            disabled={pending}
            onKeyDown={(e) => {
              if (e.key === "Enter") onLogin();
            }}
          />

          <button
            onClick={onLogin}
            className="mt-2 h-13 w-full rounded-2xl bg-slate-950 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
          >
            {pending ? "로그인 중..." : "로그인"}
          </button>
        </div>

<div className="mt-4 flex items-center justify-center gap-3 text-xs text-slate-500">
  <button
    type="button"
    className="hover:text-slate-900"
    onClick={() => {
      setMode("find_id");
      setError("");
      setRecoveryMessage("");
setRecoveryName("");
setRecoveryPhone("");
setRecoveryEmail("");
setVerificationCode("");
setCodeSent(false);
setFoundUsernames([]);
    }}
  >
    아이디 찾기
  </button>

  <span>•</span>

  <button
    type="button"
    className="hover:text-slate-900"
    onClick={() => {
      setMode("find_password");
      setError("");
      setRecoveryMessage("");
setRecoveryName("");
setRecoveryUsername("");
setRecoveryEmail("");
setVerificationCode("");
setNewPassword("");
setNewPasswordConfirm("");
setCodeSent(false);
    }}
  >
    비밀번호 찾기
  </button>
</div>

{mode !== "login" ? (
  <div className="mt-4 text-center">
    <button
      type="button"
      className="text-xs text-slate-500 hover:text-slate-900"
      onClick={() => {
        setMode("login");
        setRecoveryMessage("");
        setError("");
      }}
    >
      로그인으로 돌아가기
    </button>
  </div>
) : null}
        {mode === "login" && error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

<div className="mt-6 text-center text-[11px] text-slate-400">
  Powered by EduCanvas SaaS Platform
</div>
            </div>

      {mode !== "login" ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-[420px] rounded-[28px] bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  {mode === "find_id" ? "아이디 찾기" : "비밀번호 찾기"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  가입 정보 확인 후 이메일 인증코드를 입력해주세요.
                </p>
              </div>

              <button
                type="button"
                className="rounded-full px-2 py-1 text-sm text-slate-400 hover:bg-slate-100 hover:text-slate-900"
                onClick={() => {
                  setMode("login");
                  setError("");
                  setRecoveryMessage("");
                }}
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <input
                placeholder="이름"
                value={recoveryName}
                onChange={(e) => setRecoveryName(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none focus:ring-4 focus:ring-slate-200"
              />

              {mode === "find_id" ? (
                <input
                  placeholder="전화번호"
                  value={recoveryPhone}
                  onChange={(e) => setRecoveryPhone(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none focus:ring-4 focus:ring-slate-200"
                />
              ) : (
                <input
                  placeholder="아이디"
                  value={recoveryUsername}
                  onChange={(e) => setRecoveryUsername(e.target.value)}
                  className="h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none focus:ring-4 focus:ring-slate-200"
                />
              )}

              <input
                placeholder="이메일"
                value={recoveryEmail}
                onChange={(e) => setRecoveryEmail(e.target.value)}
                className="h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none focus:ring-4 focus:ring-slate-200"
              />

              <button
  type="button"
  onClick={sendRecoveryCode}
  className="h-12 w-full rounded-2xl bg-slate-950 text-sm font-semibold text-white"
>
  인증코드 발송
</button>

              {codeSent ? (
                <>
                  <input
                    placeholder="인증코드 6자리"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value)}
                    className="h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none focus:ring-4 focus:ring-slate-200"
                  />

                  {mode === "find_password" ? (
                    <>
                      <input
                        type="password"
                        placeholder="새 비밀번호"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none focus:ring-4 focus:ring-slate-200"
                      />

                      <input
                        type="password"
                        placeholder="새 비밀번호 확인"
                        value={newPasswordConfirm}
                        onChange={(e) => setNewPasswordConfirm(e.target.value)}
                        className="h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none focus:ring-4 focus:ring-slate-200"
                      />
                    </>
                  ) : null}

                  <button
  type="button"
  onClick={mode === "find_id" ? verifyFindId : resetRecoveryPassword}
  className="h-12 w-full rounded-2xl bg-slate-800 text-sm font-semibold text-white"
>
  {mode === "find_id" ? "아이디 확인" : "비밀번호 변경"}
</button>
                </>
              ) : null}
            </div>

{error ? (
  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
    {error}
  </div>
) : null}

            {recoveryMessage ? (
              <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
                {recoveryMessage}
              </div>
            ) : null}

            {foundUsernames.length > 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                <div className="mb-1 font-semibold">가입된 아이디</div>
                {foundUsernames.map((item) => (
                  <div key={item}>{item}</div>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}