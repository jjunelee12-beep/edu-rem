import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;
let socketTokenPromise: Promise<string | null> | null = null;

function getSocketBaseUrl() {
  const envBase = import.meta.env.VITE_API_BASE_URL?.trim();
  if (envBase) {
    return envBase.replace(/\/$/, "");
  }

  return window.location.origin.replace(/\/$/, "");
}

async function getSocketToken() {
  if (!socketTokenPromise) {
    socketTokenPromise = fetch(`/api/auth/socket-token`, {
      credentials: "include",
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        return data?.socketToken || null;
      })
      .catch(() => null);
  }

  const token = await socketTokenPromise;
  socketTokenPromise = null;
  return token;
}

export async function getSocket() {
  if (socket) {
    if (!socket.connected && !socket.active) {
      socket.connect();
    }
    return socket;
  }

  const apiBase = getSocketBaseUrl();
  const socketToken = await getSocketToken();

  socket = io(apiBase, {
    withCredentials: true,
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
    auth: {
      socketToken,
    },
  });

  socket.on("connect", () => {
    console.log("[socket] connected:", socket?.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("[socket] disconnected:", reason);
  });

  socket.on("connect_error", async (error) => {
    console.error("[socket] connect_error:", error?.message || error);

    // 토큰 만료/누락이면 1회 재발급 시도
    if (
      String(error?.message || "").includes("UNAUTHORIZED") &&
      socket
    ) {
      const newToken = await getSocketToken();
      if (newToken) {
        socket.auth = { socketToken: newToken };
        socket.connect();
      }
    }
  });

  socket.on("reconnect_attempt", (attempt) => {
    console.log("[socket] reconnect_attempt:", attempt);
  });

  socket.on("reconnect", (attempt) => {
    console.log("[socket] reconnected:", attempt);
  });

  return socket;
}

export function disconnectSocket() {
  if (!socket) return;

  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
}