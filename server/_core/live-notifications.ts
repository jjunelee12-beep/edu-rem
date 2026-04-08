import type { Server as SocketIOServer } from "socket.io";

type LiveAppNotificationPayload = {
  id: number;
  userId: number;
  type?: string | null;
  title?: string | null;
  level?: "normal" | "important" | "urgent" | "success" | "danger" | null;
  message: string;
  imageUrl?: string | null;
  relatedId?: number | null;
  isRead?: boolean;
  createdAt?: string | Date | null;
};

let liveIo: SocketIOServer | null = null;

export function setLiveNotificationIO(io: SocketIOServer) {
  liveIo = io;
}

export function emitLiveNotification(payload: LiveAppNotificationPayload) {
  const userId = Number(payload.userId);
  if (!liveIo || !userId) return;

  liveIo.to(`user:${userId}`).emit("notification:new", {
    id: Number(payload.id),
    userId,
    type: payload.type ?? "system",
    title: payload.title ?? null,
    level: payload.level ?? "normal",
    message: payload.message,
    imageUrl: payload.imageUrl ?? null,
    relatedId: payload.relatedId ?? null,
    isRead: payload.isRead ?? false,
    createdAt: payload.createdAt
      ? new Date(payload.createdAt).toISOString()
      : new Date().toISOString(),
  });
}