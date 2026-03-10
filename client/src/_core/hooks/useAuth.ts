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
      setUser(data);
      localStorage.setItem("manus-runtime-user-info", JSON.stringify(data));
    } catch (e) {
      setError(e);
      setUser(null);
      localStorage.removeItem("manus-runtime-user-info");
    } finally {
      setLoading(false);
    }
  }, [
]);

  const logout = useCallback(async () => {
    try {
      const res = await fetch(`/api/auth/me`
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
  }, [something]);

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