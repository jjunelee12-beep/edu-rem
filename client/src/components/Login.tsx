import { useState } from "react";
import { Building2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { normalizeAssetUrl } from "@/lib/normalizeAssetUrl";

export default function Login() {
  const { data: branding } = trpc.branding.get.useQuery();

  const companyName = branding?.companyName || "위드원 교육";
  const companySubtitle = branding?.messengerSubtitle || "사내 메신저";
  const companyLogoUrl = normalizeAssetUrl(branding?.companyLogoUrl || "");

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
    <div className="flex min-h-screen items-center justify-center bg-[#f5f5f7] px-4">
      <div className="w-full max-w-[420px] rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_18px_50px_rgba(15,23,42,0.08)]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] bg-[#ffdd00] shadow-sm">
            {companyLogoUrl ? (
              <img
                src={companyLogoUrl}
                alt={companyName}
                className="h-full w-full object-cover"
              />
            ) : (
              <Building2 className="h-10 w-10 text-slate-900" />
            )}
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            {companyName}
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            {companySubtitle}
          </p>

          <p className="mt-1 text-sm text-slate-400">
            로그인 후 이용할 수 있습니다.
          </p>
        </div>

        <div className="space-y-3">
          <input
            placeholder="아이디"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            autoFocus
            disabled={pending}
          />

          <input
            placeholder="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 w-full rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-400"
            disabled={pending}
            onKeyDown={(e) => {
              if (e.key === "Enter") onLogin();
            }}
          />

          <button
            onClick={onLogin}
            className="h-12 w-full rounded-2xl bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={pending}
          >
            {pending ? "로그인 중..." : "로그인"}
          </button>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}