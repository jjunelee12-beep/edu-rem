import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;
  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

const getAppErrorInfo = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) {
    return {
      appCode: "E902",
      appMessage: "알 수 없는 오류가 발생했습니다.",
    };
  }

  const data = error.data as any;

  return {
    appCode: data?.appCode || "E902",
    appMessage: data?.appMessage || error.message || "서버 오류가 발생했습니다.",
  };
};

const showGlobalApiError = (error: unknown) => {
  const { appCode, appMessage } = getAppErrorInfo(error);

  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent("app:api-error", {
      detail: {
        code: appCode,
        message: appMessage,
      },
    })
  );
};

queryClient.getQueryCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
showGlobalApiError(error);
  }
});

queryClient.getMutationCache().subscribe((event) => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
showGlobalApiError(error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `/api/trpc`,
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);