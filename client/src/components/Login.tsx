import { useState } from "react";
import { Eye, EyeOff, Headphones, LockKeyhole, UserRound } from "lucide-react";

export default function Login() {
  const companyName = "EduCanvas CRM";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="min-h-screen bg-[#eef2f7]">
      <div className="grid min-h-screen w-full overflow-hidden lg:grid-cols-[1.22fr_0.78fr]">
        {/* LEFT VISUAL */}
        <section className="relative hidden overflow-hidden bg-[#020a22] lg:block">
          <img
            src="/images/login/login-crm-visual.png"
            alt="EduCanvas CRM"
            className="absolute inset-0 h-full w-full object-contain object-center"
          />

          <div className="absolute bottom-[1.5%] right-[2%] w-[42%] max-w-[440px]">
            <div className="absolute inset-[16%] rounded-full bg-blue-500/20 blur-3xl" />
            <img
              src="/images/login/login-ai-visual.png"
              alt="EduCanvas AI"
              className="relative z-10 w-full object-contain drop-shadow-[0_22px_45px_rgba(37,99,235,.32)]"
            />
          </div>
        </section>

        {/* RIGHT LOGIN */}
        <section
          className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-7 sm:px-7 lg:px-8 xl:px-10"
          style={{
            background:
              "radial-gradient(circle at 84% 12%, rgba(255,255,255,0.90) 0%, rgba(255,255,255,0) 28%), radial-gradient(circle at 8% 86%, rgba(95,121,255,0.24) 0%, rgba(95,121,255,0) 34%), linear-gradient(145deg, #dfe8ff 0%, #f4f4ff 46%, #d9d1ff 100%)",
          }}
        >
          <div className="pointer-events-none absolute -right-24 -top-20 h-72 w-72 rounded-full bg-white/35 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 -left-20 h-96 w-96 rounded-full bg-[#6f7cff]/30 blur-3xl" />
          <div className="pointer-events-none absolute left-[2%] top-[48%] h-36 w-36 opacity-30 [background-image:radial-gradient(circle,#7c8cff_1.4px,transparent_1.4px)] [background-size:14px_14px]" />
          <div className="pointer-events-none absolute right-[2%] top-[18%] h-40 w-40 opacity-25 [background-image:radial-gradient(circle,#8b7dff_1.4px,transparent_1.4px)] [background-size:14px_14px]" />

          <div className="relative w-full max-w-[520px] rounded-[30px] border border-white/90 bg-white/90 px-7 py-8 shadow-[0_28px_80px_rgba(58,73,150,0.18)] backdrop-blur-xl sm:px-9 sm:py-9">
            <div className="mb-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[18px] border border-blue-100 bg-[linear-gradient(145deg,#f1f5ff,#e8e5ff)] text-blue-600 shadow-[0_8px_24px_rgba(66,96,255,0.12)]">
                <LockKeyhole className="h-7 w-7" strokeWidth={1.8} />
              </div>

              <h1 className="mt-5 text-[34px] font-black tracking-[-0.04em] text-[#101828]">
                로그인
              </h1>

              <p className="mt-2 text-sm font-medium text-slate-400">
                {companyName}에 오신 것을 환영합니다.
              </p>
            </div>

            <div className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  아이디
                </span>
                <div className="relative">
                  <UserRound className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    placeholder="아이디를 입력해주세요"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    autoFocus
                    disabled={pending}
                  />
                </div>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-slate-700">
                  비밀번호
                </span>
                <div className="relative">
                  <LockKeyhole className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    placeholder="비밀번호를 입력해주세요"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-14 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    disabled={pending}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") onLogin();
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                    aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 보기"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </label>

              <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-slate-500">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                />
                아이디 저장
              </label>

              <button
                onClick={onLogin}
                className="h-14 w-full rounded-xl bg-gradient-to-r from-[#2d7cff] via-[#5368ff] to-[#7b35f5] text-sm font-black text-white shadow-[0_14px_30px_rgba(89,72,255,.24)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={pending}
              >
                {pending ? "로그인 중..." : "로그인"}
              </button>
            </div>

            <div className="mt-5 flex items-center justify-center gap-4 text-sm font-semibold">
              <button
                type="button"
                className="text-blue-600 transition hover:text-blue-800"
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

              <span className="h-3 w-px bg-slate-200" />

              <button
                type="button"
                className="text-blue-600 transition hover:text-blue-800"
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

            {mode === "login" && error ? (
              <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            ) : null}

            <div className="mt-8 rounded-2xl border border-slate-200 bg-white/80 px-5 py-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eef4ff] text-blue-600">
                  <Headphones className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-slate-800">
                    로그인에 문제가 있으신가요?
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    EduCanvas 고객센터로 문의해 주세요.
                  </p>
                </div>

                <a
                  href="https://edu-crm.kr"
                  className="shrink-0 text-xs font-black text-blue-600 transition hover:text-blue-800"
                >
                  고객센터 바로가기 →
                </a>
              </div>
            </div>

            <div className="mt-8 text-center text-[11px] text-slate-400">
              Powered by EduCanvas SaaS Platform
            </div>
          </div>
        </section>
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