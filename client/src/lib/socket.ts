import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

function getSocketBaseUrl() {
  // 항상 같은 출처 사용 (Vercel → rewrite → Railway)
  return window.location.origin.replace(/\/$/, "");
}

export function getSocket() {
  if (socket) {
    if (!socket.connected && !socket.active) {
      socket.connect();
    }
    return socket;
  }

  const base = getSocketBaseUrl();

  socket = io(base, {
    path: "/socket.io", // 중요
    withCredentials: true,
    transports: ["websocket"], // polling 제거 (안정성 ↑)
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  socket.on("connect", () => {
    console.log("[socket] connected:", socket?.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("[socket] disconnected:", reason);
  });

  socket.on("connect_error", (error) => {
    console.error("[socket] connect_error:", error?.message || error);
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