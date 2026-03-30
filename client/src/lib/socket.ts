import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export function getSocket() {
  if (socket) return socket;

  const apiBase =
    import.meta.env.VITE_API_BASE_URL?.trim() ||
    window.location.origin;

  socket = io(apiBase, {
    withCredentials: true,
    transports: ["websocket", "polling"],
  });

  return socket;
}

export function disconnectSocket() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
}