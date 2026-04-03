import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

function getSocketBaseUrl() {
  const envBase = import.meta.env.VITE_API_BASE_URL?.trim();
  if (envBase) {
    return envBase.replace(/\/$/, "");
  }

  return window.location.origin.replace(/\/$/, "");
}

export function getSocket() {
  if (socket) {
    if (!socket.connected && !socket.active) {
      socket.connect();
    }
    return socket;
  }

  const apiBase = getSocketBaseUrl();

  socket = io(apiBase, {
    withCredentials: true,
    transports: ["websocket", "polling"],
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