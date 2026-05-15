import { useCallback, useEffect, useMemo, useState } from "react";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath = "/" } =
    options ?? {};

  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<any | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

const pathname = window.location.pathname;

const isPublicPage =
  pathname === "/login" ||
  pathname.startsWith("/form/") ||
  pathname.startsWith("/ad-form/");

if (isPublicPage) {
  setUser(null);
  setLoading(false);
  setError(null);
  return;
}

const cachedUser = localStorage.getItem("manus-runtime-user-info");

if (!cachedUser && !redirectOnUnauthenticated) {
  setUser(null);
  setLoading(false);
  setError(null);
  return;
}

try {
  const res = await fetch(`/api/auth/me`, {
        credentials: "include",
      });

      if (!res.ok) {
        setUser(null);
        localStorage.removeItem("manus-runtime-user-info");
        return;
      }

      const data = await res.json();
const nextUser = data?.user ?? data;

setUser(nextUser);
localStorage.setItem("manus-runtime-user-info", JSON.stringify(nextUser));
    } catch (e) {
      setError(e);
      setUser(null);
      localStorage.removeItem("manus-runtime-user-info");
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetch(`/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {
      console.error("logout error", e);
    } finally {
      setUser(null);
      localStorage.removeItem("manus-runtime-user-info");
      window.location.replace("/");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const state = useMemo(() => {
    return {
      user,
      loading,
      error,
      isAuthenticated: Boolean(user),
    };
  }, [user, loading, error]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (loading) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;
    window.location.replace(redirectPath);
  }, [redirectOnUnauthenticated, redirectPath, loading, state.user]);

  return {
    ...state,
    refresh,
    logout,
  };
}