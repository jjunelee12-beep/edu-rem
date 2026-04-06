import { useState } from "react";
import { Building2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { normalizeAssetUrl } from "@/lib/normalizeAssetUrl";

export default function Login() {
  const { data: branding } = trpc.branding.getPublic.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

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
    <div className="flex min-h-screen items-center justify-center bg-[#f3f4f6] px-4">
      <div className="w-full max-w-[440px] rounded-[36px] border border-slate-200/80 bg-white px-8 py-9 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-5 flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
            {companyLogoUrl ? (
              <img
                src={companyLogoUrl}
                alt={companyName}
                className="h-full w-full object-contain p-2"
                onError={() => {
                  console.log("[login logo] load failed:", companyLogoUrl);
                }}
              />
            ) : (
              <Building2 className="h-10 w-10 text-slate-900" />
            )}
          </div>

          <h1 className="text-[32px] font-bold tracking-tight text-slate-950">
            {companyName}
          </h1>

          <p className="mt-2 text-sm font-medium text-slate-500">
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

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}
      </div>
    </div>
  );
}