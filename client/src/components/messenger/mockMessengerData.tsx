export type MessengerUser = {
  id: number;
  name: string;
  position: string;
  team: string;
  avatar?: string;
  status?: "online" | "offline";
};

export type MessengerRoom = {
  id: number;
  name: string;
  type: "direct" | "group";
  participantIds: number[];
  unreadCount: number;
  lastMessage: string;
  updatedAt: string;
  notificationsEnabled?: boolean;
};

export type MessengerMessage = {
  id: number;
  roomId: number;
  senderId: number;
  type: "text" | "image" | "file" | "system";
  content?: string;
  createdAt: string;
  fileName?: string;
  fileUrl?: string;
};

export function getUsersById(): Record<number, MessengerUser> {
  return {};
}