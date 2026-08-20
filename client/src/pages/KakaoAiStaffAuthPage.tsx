import {
  useEffect,
  useState,
  type FormEvent,
} from "react";
import {
  useLocation,
  useRoute,
} from "wouter";

type AuthStatus =
  | "loading"
  | "ready"
  | "submitting"
  | "success"
  | "expired"
  | "unavailable"
  | "error";

type StaffAuthStatusResponse = {
  success?: boolean;
  status?: string;
  usable?: boolean;
  tokenExpiresAt?: string | null;
  code?: string;
  message?: string;
};

type StaffAuthLoginResponse = {
  success?: boolean;
  authenticated?: boolean;
  user?: {
    name?: string | null;
    username?: string | null;
    role?: string | null;
  };
  sessionExpiresAt?: string | null;
  code?: string;
  message?: string;
};

export default function KakaoAiStaffAuthPage() {
  const [, params] = useRoute(
    "/kakao-ai/staff-auth/:token"
  );

  const [, setLocation] =
    useLocation();

  const token =
    String(
      params?.token || ""
    ).trim();

  const [status, setStatus] =
    useState<AuthStatus>(
      "loading"
    );

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [expiresAt, setExpiresAt] =
    useState<
      string | null
    >(null);

  const [authenticatedUser, setAuthenticatedUser] =
    useState<
      StaffAuthLoginResponse["user"] | null
    >(null);

  useEffect(() => {
    let cancelled =
      false;

    async function checkSession() {
      if (!token) {
        setStatus(
          "unavailable"
        );

        setMessage(
          "유효하지 않은 담당자 인증 링크입니다."
        );

        return;
      }

      setStatus(
        "loading"
      );

      try {
        const response =
          await fetch(
            `/api/kakao-ai/staff-auth/${encodeURIComponent(
              token
            )}`,
            {
              method:
                "GET",

              headers: {
                Accept:
                  "application/json",
              },

              credentials:
                "include",
            }
          );

        const data =
          (await response.json()) as StaffAuthStatusResponse;

        if (cancelled) {
          return;
        }

        if (
          response.ok &&
          data.success ===
            true &&
          data.usable ===
            true
        ) {
          setExpiresAt(
            data.tokenExpiresAt ||
              null
          );

          setMessage(
            ""
          );

          setStatus(
            "ready"
          );

          return;
        }

        if (
          response.status ===
            410 ||
          data.code ===
            "AUTH_TOKEN_EXPIRED"
        ) {
          setStatus(
            "expired"
          );

          setMessage(
            data.message ||
              "담당자 인증 링크가 만료되었습니다. 카카오톡에서 /staff를 다시 입력해주세요."
          );

          return;
        }

        setStatus(
          "unavailable"
        );

        setMessage(
          data.message ||
            "이미 사용되었거나 더 이상 사용할 수 없는 담당자 인증 링크입니다."
        );
      } catch (
        error
      ) {
        if (cancelled) {
          return;
        }

        console.error(
          "[KAKAO AI STAFF AUTH PAGE GET ERROR]",
          error
        );

        setStatus(
          "error"
        );

        setMessage(
          "담당자 인증 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
        );
      }
    }

    void checkSession();

    return () => {
      cancelled =
        true;
    };
  }, [token]);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (
      status ===
        "submitting"
    ) {
      return;
    }

    const normalizedUsername =
      username.trim();

    if (
      !normalizedUsername ||
      !password
    ) {
      setMessage(
        "아이디와 비밀번호를 입력해주세요."
      );

      return;
    }

    setStatus(
      "submitting"
    );

    setMessage(
      ""
    );

    try {
      const response =
        await fetch(
          `/api/kakao-ai/staff-auth/${encodeURIComponent(
            token
          )}/login`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",

              Accept:
                "application/json",
            },

            credentials:
              "include",

            body:
              JSON.stringify({
                username:
                  normalizedUsername,

                password,
              }),
          }
        );

      const data =
        (await response.json()) as StaffAuthLoginResponse;

      if (
        response.ok &&
        data.success ===
          true &&
        data.authenticated ===
          true
      ) {
        setAuthenticatedUser(
          data.user ||
            null
        );

        setMessage(
          data.message ||
            "담당자 인증이 완료되었습니다. 카카오톡으로 돌아가 업무비서를 이용해주세요."
        );

        setPassword(
          ""
        );

        setStatus(
          "success"
        );

        return;
      }

      if (
        response.status ===
          410 ||
        data.code ===
          "AUTH_TOKEN_EXPIRED"
      ) {
        setStatus(
          "expired"
        );

        setMessage(
          data.message ||
            "담당자 인증 링크가 만료되었습니다. 카카오톡에서 /staff를 다시 입력해주세요."
        );

        return;
      }

      if (
        response.status ===
          404 ||
        data.code ===
          "AUTH_SESSION_NOT_FOUND"
      ) {
        setStatus(
          "unavailable"
        );

        setMessage(
          data.message ||
            "유효하지 않은 담당자 인증 링크입니다."
        );

        return;
      }

      setStatus(
        "ready"
      );

      setMessage(
        data.message ||
          "아이디 또는 비밀번호를 확인해주세요."
      );
    } catch (
      error
    ) {
      console.error(
        "[KAKAO AI STAFF AUTH PAGE LOGIN ERROR]",
        error
      );

      setStatus(
        "ready"
      );

      setMessage(
        "담당자 인증 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요."
      );
    }
  }

  const isBusy =
    status ===
      "loading" ||
    status ===
      "submitting";

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-md items-center">
        <div className="w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white">
              AI
            </div>

            <h1 className="text-xl font-bold text-slate-900">
              담당자 인증
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              EduCanvas 카카오 AI 업무비서를 이용하려면
              CRM 담당자 계정 인증이 필요합니다.
            </p>
          </div>

          <div className="px-6 py-6">
            {status ===
              "loading" && (
              <div className="py-10 text-center">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />

                <p className="mt-4 text-sm text-slate-500">
                  인증 링크를 확인하고 있습니다.
                </p>
              </div>
            )}

            {(status ===
              "ready" ||
              status ===
                "submitting") && (
              <form
                onSubmit={
                  handleSubmit
                }
                className="space-y-5"
              >
                <div>
                  <label
                    htmlFor="username"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    아이디
                  </label>

                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    value={
                      username
                    }
                    disabled={
                      isBusy
                    }
                    onChange={(
                      event
                    ) =>
                      setUsername(
                        event
                          .target
                          .value
                      )
                    }
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-100"
                    placeholder="CRM 아이디"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    비밀번호
                  </label>

                  <input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    value={
                      password
                    }
                    disabled={
                      isBusy
                    }
                    onChange={(
                      event
                    ) =>
                      setPassword(
                        event
                          .target
                          .value
                      )
                    }
                    className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-slate-900 focus:ring-1 focus:ring-slate-900 disabled:bg-slate-100"
                    placeholder="CRM 비밀번호"
                  />
                </div>

                {message && (
                  <div className="rounded-lg bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-700">
                    {message}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={
                    isBusy
                  }
                  className="h-11 w-full rounded-lg bg-slate-900 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {status ===
                  "submitting"
                    ? "인증 중..."
                    : "담당자 인증"}
                </button>

                {expiresAt && (
                  <p className="text-center text-xs text-slate-400">
                    보안을 위해 인증 링크는 일정 시간이 지나면
                    만료됩니다.
                  </p>
                )}
              </form>
            )}

            {status ===
              "success" && (
              <div className="py-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl text-emerald-700">
                  ✓
                </div>

                <h2 className="mt-5 text-lg font-bold text-slate-900">
                  담당자 인증 완료
                </h2>

                {authenticatedUser?.name && (
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {
                      authenticatedUser.name
                    }님
                  </p>
                )}

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {message}
                </p>

                <div className="mt-6 rounded-lg bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                  이 페이지를 닫고 카카오톡으로 돌아가
                  업무비서에게 다시 요청해주세요.
                </div>
              </div>
            )}

            {(status ===
              "expired" ||
              status ===
                "unavailable" ||
              status ===
                "error") && (
              <div className="py-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-xl font-bold text-amber-700">
                  !
                </div>

                <h2 className="mt-5 text-lg font-bold text-slate-900">
                  {status ===
                  "expired"
                    ? "인증 링크 만료"
                    : "담당자 인증 불가"}
                </h2>

                <p className="mt-3 text-sm leading-6 text-slate-500">
                  {message}
                </p>

                <button
                  type="button"
                  onClick={() =>
                    setLocation(
                      "/login"
                    )
                  }
                  className="mt-6 h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  CRM 로그인으로 이동
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 bg-slate-50 px-6 py-4">
            <p className="text-center text-xs leading-5 text-slate-400">
              이 인증은 카카오 AI 업무비서 사용을 위한
              담당자 확인 절차이며 CRM 웹 로그인과는
              별도로 처리됩니다.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}