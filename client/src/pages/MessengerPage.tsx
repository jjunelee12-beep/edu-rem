import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getSocket } from "@/lib/socket";
import { normalizeAssetUrl } from "@/lib/normalizeAssetUrl";

import MessengerSidebar from "@/components/messenger/MessengerSidebar";
import MessengerPopupWindow from "@/components/messenger/MessengerPopupWindow";
import ImagePreviewModal from "@/components/messenger/ImagePreviewModal";
import MessengerRoomInfo from "@/components/messenger/MessengerRoomInfo";

import {
  MessengerMessage,
  MessengerRoom,
  MessengerUser,
  getUsersById,
} from "@/components/messenger/mockMessengerData";

function roleToPosition(role?: string) {
  if (role === "superhost") return "슈퍼호스트";
  if (role === "host") return "호스트";
  if (role === "admin") return "관리자";
  return "직원";
}

function normalizeUsers(
  userList: any[],
  onlineUserIds: Set<number>
): MessengerUser[] {
  return (userList ?? []).map((user: any) => ({
    id: Number(user.id),
    name: user.name || user.username || "이름없음",
    position: user.positionName || user.position || roleToPosition(user.role),
    team: user.teamName || user.team || "미분류",
    avatar: normalizeAssetUrl(
      user.avatarUrl || user.profileImageUrl || user.avatar || ""
    ),
    status: onlineUserIds.has(Number(user.id)) ? "online" : "offline",
  }));
}

type OpenPopup =
  | {
      key: string;
      type: "room";
      roomId: number;
      minimized?: boolean;
    }
  | {
      key: string;
      type: "draft";
      targetUserId: number;
      minimized?: boolean;
    };

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl?: string;
  isImage?: boolean;
  isVideo?: boolean;
};

type MessengerPageProps = {
  companyName?: string;
  onRequestClose?: () => void;
};

type TypingStateMap = Record<number, number[]>;

async function emitDirectCreate(targetUserId: number): Promise<number> {
  const socket = await getSocket();

  return new Promise((resolve, reject) => {
    socket.emit(
      "direct:create",
      { targetUserId: Number(targetUserId) },
      (res: any) => {
        if (!res?.success) {
          reject(new Error(res?.message || "1:1 채팅방 생성 실패"));
          return;
        }

        const roomId = Number(res.roomId || 0);
        if (!roomId) {
          reject(new Error("생성된 채팅방 ID가 없습니다."));
          return;
        }

        resolve(roomId);
      }
    );
  });
}

async function emitMessageSend(payload: any) {
  const socket = await getSocket();

  return new Promise((resolve, reject) => {
    socket.emit("message:send", payload, (res: any) => {
      if (!res?.success) {
        reject(new Error(res?.message || "메시지 전송 실패"));
        return;
      }

      resolve({
        roomId: Number(res.roomId),
        messageId: Number(res.messageId),
      });
    });
  });
}

async function emitReadUpdate(roomId: number, lastReadMessageId: number) {
  const socket = await getSocket();

  return new Promise<void>((resolve, reject) => {
    socket.emit(
      "read:update",
      { roomId, lastReadMessageId },
      (res: any) => {
        if (!res?.success) {
          reject(new Error(res?.message || "읽음 처리 실패"));
          return;
        }
        resolve();
      }
    );
  });
}

async function emitRoomMute(roomId: number, isMuted: boolean): Promise<void> {
  const socket = await getSocket();

  return new Promise((resolve, reject) => {
    socket.emit(
      "room:mute",
      { roomId, isMuted },
      (res: any) => {
        if (!res?.success) return reject(new Error(res?.message));
        resolve();
      }
    );
  });
}

async function emitRoomLeave(roomId: number): Promise<void> {
  const socket = await getSocket();

  return new Promise((resolve, reject) => {
    socket.emit(
      "room:leave:confirm",
      {
        roomId: Number(roomId),
      },
      (res: any) => {
        if (!res?.success) {
          reject(new Error(res?.message || "방 나가기 실패"));
          return;
        }
        resolve();
      }
    );
  });
}

async function emitRoomMembersAdd(
  roomId: number,
  userIds: number[]
): Promise<{ addedUserIds: number[] }> {
  const socket = await getSocket();

  return new Promise((resolve, reject) => {
    socket.emit(
      "room:members:add",
      {
        roomId: Number(roomId),
        userIds: userIds.map(Number),
      },
      (res: any) => {
        if (!res?.success) {
          reject(new Error(res?.message || "참여자 추가 실패"));
          return;
        }

        resolve({
          addedUserIds: (res?.addedUserIds || []).map((v: any) => Number(v)),
        });
      }
    );
  });
}

async function emitTypingStart(roomId: number) {
  const socket = await getSocket();
  socket.emit("typing:start", { roomId });
}

async function emitTypingStop(roomId: number) {
  const socket = await getSocket();
  socket.emit("typing:stop", { roomId });
}

function PopupRoomData({
  popup,
  usersById,
  currentUserId,
  pinned,
  onTogglePin,
  onClose,
  onMinimize,
  onOpenImage,
  input,
  pendingAttachments,
  onInputChange,
  onAddPendingAttachment,
  onRemovePendingAttachment,
  onDraftConverted,
  onMarkRoomViewed,
  onRefreshRooms,
  typingUserIds,
  roomMuted,
chatBackground,
onChangeBackground,
notificationEnabled,
  onToggleMuteRoom,
  onLeaveRoom,
  onOpenRoomInfo,
}: {
  popup: OpenPopup;
  usersById: Record<number, MessengerUser>;
  currentUserId: number | null;
  pinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onOpenImage: (url: string, name?: string) => void;
  input: string;
  pendingAttachments: PendingAttachment[];
  onInputChange: (value: string) => void;
  onAddPendingAttachment: (file: File) => void;
  onRemovePendingAttachment: (id: string) => void;
  onDraftConverted: (newPopup: OpenPopup) => void;
  onMarkRoomViewed: (roomId: number) => void;
  onRefreshRooms: () => Promise<void>;
  typingUserIds: number[];
  roomMuted: boolean;
chatBackground: string;
onChangeBackground: (value: string) => void;
notificationEnabled: boolean;
  onToggleMuteRoom: (roomId: number, isMuted: boolean) => Promise<void>;
  onLeaveRoom: (roomId: number) => Promise<void>;
  onOpenRoomInfo: (payload: {
    room: MessengerRoom | null;
    participants: MessengerUser[];
    messages: MessengerMessage[];
  }) => void;
}) {
  const { user } = useAuth();

  const roomId = popup.type === "room" ? popup.roomId : 0;

  const {
    data: messageRows = [],
    refetch: refetchMessages,
  } = trpc.messenger.messages.useQuery(
    { roomId: Number(roomId) },
    {
      enabled: popup.type === "room" && !!roomId,
      refetchOnWindowFocus: true,
    }
  );

  const {
    data: memberRows = [],
    refetch: refetchMembers,
  } = trpc.messenger.members.useQuery(
    { roomId: Number(roomId) },
    {
      enabled: popup.type === "room" && !!roomId,
      refetchOnWindowFocus: true,
    }
  );

  useEffect(() => {
  if (popup.type !== "room" || !roomId || popup.minimized) return;

  let socketRef: any;

  const handleNewMessage = async (payload: any) => {
    const incomingRoomId = Number(payload?.roomId || 0);
    if (incomingRoomId !== Number(roomId)) return;

    await refetchMessages();
    await refetchMembers();
    await onRefreshRooms();
  };

  const handleReadUpdate = async (payload: any) => {
    const incomingRoomId = Number(payload?.roomId || 0);
    if (incomingRoomId !== Number(roomId)) return;

    await refetchMembers();
    await onRefreshRooms();
  };

  (async () => {
    const socket = await getSocket();
    socketRef = socket;

    socket.emit("room:join", { roomId: Number(roomId) });
    socket.on("message:new", handleNewMessage);
    socket.on("read:update", handleReadUpdate);
  })();

  return () => {
    if (!socketRef) return;

    socketRef.emit("room:leave", { roomId: Number(roomId) });
    socketRef.off("message:new", handleNewMessage);
    socketRef.off("read:update", handleReadUpdate);
  };
}, [
  popup.type,
  roomId,
  popup.minimized,
  refetchMessages,
  refetchMembers,
  onRefreshRooms,
]);

  const room =
    popup.type === "room"
      ? {
          id: roomId,
          name:
            memberRows.length === 2
              ? memberRows.find((m: any) => Number(m.userId) !== Number(user?.id))
                  ?.name || "1:1 대화"
              : "채팅방",
          type:
            memberRows.length > 2
              ? ("group" as const)
              : ("direct" as const),
          participantIds: [],
          unreadCount: 0,
          lastMessage: "",
          updatedAt: "",
        }
      : null;

  const targetUser =
    popup.type === "draft"
      ? usersById[Number(popup.targetUserId)] || null
      : null;

  const participants = useMemo<MessengerUser[]>(() => {
    if (popup.type === "draft") return targetUser ? [targetUser] : [];

    return (memberRows as any[]).map((member: any) => ({
      id: Number(member.userId),
      name: member.name || member.username || "이름없음",
      position: member.positionName || roleToPosition(member.role),
      team: member.teamName || "미분류",
      avatar: normalizeAssetUrl(
        member.avatarUrl || member.profileImageUrl || member.avatar || ""
      ),
      status: "offline",
      lastReadMessageId: member.lastReadMessageId
        ? Number(member.lastReadMessageId)
        : null,
    })) as MessengerUser[];
  }, [popup.type, memberRows, targetUser]);

  const messages = useMemo<MessengerMessage[]>(() => {
    if (popup.type === "draft") return [];
    return (messageRows as any[]).map((m: any) => ({
      id: Number(m.id),
      roomId: Number(m.roomId),
      senderId: Number(m.senderId),
      type: m.messageType || "text",
      content: m.content || "",
      createdAtRaw: m.createdAt || "",
      createdAt: m.createdAt
        ? new Date(m.createdAt).toLocaleTimeString("ko-KR", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
      fileName: m.fileName || m.attachmentName || "",
      fileUrl: normalizeAssetUrl(m.fileUrl || m.attachmentUrl || ""),
    })) as MessengerMessage[];
  }, [popup.type, messageRows]);

  useEffect(() => {
    if (popup.type !== "room" || !roomId) return;
    if (!messages.length) return;

    const lastMessageId = messages[messages.length - 1]?.id;
    if (!lastMessageId) return;

    onMarkRoomViewed(Number(roomId));

    void emitReadUpdate(Number(roomId), Number(lastMessageId)).catch((err) => {
      console.error("[read:update] failed:", err);
    });
  }, [popup.type, roomId, messages, onMarkRoomViewed]);

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const uploadRes = await fetch(
      `${import.meta.env.VITE_API_BASE_URL || ""}/api/upload`,
      {
        method: "POST",
        body: formData,
        credentials: "include",
      }
    );

    if (!uploadRes.ok) {
      throw new Error("파일 업로드에 실패했습니다.");
    }

    return uploadRes.json();
  };

  const handleSend = async () => {
    const text = input.trim();
    const hasText = !!text;
    const hasAttachments = pendingAttachments.length > 0;

    if (!hasText && !hasAttachments) return;

    let targetRoomId = roomId;

    if (popup.type === "draft") {
      targetRoomId = await emitDirectCreate(Number(popup.targetUserId));

      onDraftConverted({
        key: `room-${targetRoomId}`,
        type: "room",
        roomId: targetRoomId,
        minimized: false,
      });
    }

    if (!targetRoomId) return;

    await emitTypingStop(Number(targetRoomId));

    if (hasText) {
      await emitMessageSend({
        roomId: Number(targetRoomId),
        messageType: "text",
        content: text,
      });
    }

    for (const item of pendingAttachments) {
      const uploaded = await uploadFile(item.file);
      const fileUrl = uploaded?.fileUrl;
      const fileName = uploaded?.fileName || item.file.name;
      if (!fileUrl) continue;

      const isImage = item.file.type.startsWith("image/");
      const messageType = isImage ? "image" : "file";
      const content = isImage ? "[이미지]" : `[파일] ${fileName}`;

      await emitMessageSend({
        roomId: Number(targetRoomId),
        messageType,
        content,
        fileUrl,
        fileName,
        fileType: item.file.type || undefined,
        fileSize: item.file.size,
      });
    }

    onInputChange("");
    pendingAttachments.forEach((item) => onRemovePendingAttachment(item.id));

    onMarkRoomViewed(Number(targetRoomId));

    await refetchMessages();
    await refetchMembers();
    await onRefreshRooms();
  };

  const handleTypingChange = (value: string) => {
    onInputChange(value);

    if (popup.type === "room" && roomId) {
      if (value.trim()) {
        void emitTypingStart(Number(roomId));
      } else {
        void emitTypingStop(Number(roomId));
      }
    }
  };

  return (
    <MessengerPopupWindow
      popupKey={popup.key}
      room={room}
      onOpenRoomInfo={() =>
        onOpenRoomInfo({
          room,
          participants,
          messages,
        })
      }
      targetUser={targetUser}
      participants={participants}
      messages={messages}
      usersById={usersById}
      currentUserId={currentUserId}
      input={input}
      pendingAttachments={pendingAttachments}
      onInputChange={handleTypingChange}
      onSend={handleSend}
      onAttachFile={onAddPendingAttachment}
      onRemovePendingAttachment={onRemovePendingAttachment}
      onOpenImage={onOpenImage}
      onClose={onClose}
      onMinimize={onMinimize}
onRestore={onMinimize}
      onTogglePin={onTogglePin}
      pinned={pinned}
      minimized={!!popup.minimized}
      rightOffset={560}
      typingUserIds={typingUserIds}
      roomMuted={roomMuted}
chatBackground={chatBackground}
onChangeBackground={onChangeBackground}
notificationEnabled={notificationEnabled}
      onToggleMute={
        popup.type === "room"
          ? async () => {
              await onToggleMuteRoom(Number(roomId), !roomMuted);
            }
          : undefined
      }
      onLeaveRoom={
  popup.type === "room"
    ? async () => {
        const ok = confirm("정말 채팅방을 나가시겠습니까?");
        if (!ok) return;

        await onLeaveRoom(Number(roomId));
        onClose();
      }
    : undefined
}
    />
  );
}

export default function MessengerPage({
  onRequestClose,
}: MessengerPageProps) {
  const { user } = useAuth();

  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());
  const [typingByRoom, setTypingByRoom] = useState<TypingStateMap>({});
  const [previewImage, setPreviewImage] = useState<{
    open: boolean;
    url?: string;
    name?: string;
  }>({
    open: false,
  });

  const [openPopups, setOpenPopups] = useState<OpenPopup[]>([]);
  const [popupInputs, setPopupInputs] = useState<Record<string, string>>({});
  const [popupPendingAttachments, setPopupPendingAttachments] = useState<
    Record<string, PendingAttachment[]>
  >({});
  const [pinnedRoomIds, setPinnedRoomIds] = useState<number[]>([]);
  const [locallyViewedRoomIds, setLocallyViewedRoomIds] = useState<number[]>([]);

  const [roomInfoOpen, setRoomInfoOpen] = useState(false);
  const [roomInfoRoomId, setRoomInfoRoomId] = useState<number | null>(null);
  const [roomInfoParticipants, setRoomInfoParticipants] = useState<
    MessengerUser[]
  >([]);
  const [roomInfoMessages, setRoomInfoMessages] = useState<MessengerMessage[]>(
    []
  );

  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteSearch, setInviteSearch] = useState("");
  const [selectedInviteUserIds, setSelectedInviteUserIds] = useState<number[]>(
    []
  );
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
const [notificationEnabled, setNotificationEnabled] = useState(true);
const [chatBackground, setChatBackground] = useState("");

  const { data: userList = [] } = trpc.users.list.useQuery();
  const { data: roomRows = [], refetch: refetchRooms } =
    trpc.messenger.myRooms.useQuery(undefined, {
      refetchOnWindowFocus: true,
    });

  useEffect(() => {
    const saved = localStorage.getItem("messenger-pinned-room-ids");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        setPinnedRoomIds(parsed.map((v) => Number(v)).filter(Boolean));
      }
    } catch {}
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "messenger-pinned-room-ids",
      JSON.stringify(pinnedRoomIds)
    );
  }, [pinnedRoomIds]);

 
useEffect(() => {
  let socketRef: any;

  const handleOnlineUsers = (data: any) => {
    setOnlineUserIds(new Set((data?.userIds || []).map((v: any) => Number(v))));
  };

  const handleUserOnline = ({ userId }: any) => {
    setOnlineUserIds((prev) => new Set([...prev, Number(userId)]));
  };

  const handleUserOffline = ({ userId }: any) => {
    setOnlineUserIds((prev) => {
      const next = new Set(prev);
      next.delete(Number(userId));
      return next;
    });
  };

  const handleRoomListUpdate = async () => {
    await refetchRooms();
  };

  const handleNewMessage = async () => {
    await refetchRooms();
  };

  const handleTypingStart = ({
    roomId,
    userId,
  }: {
    roomId: number;
    userId: number;
  }) => {
    const targetRoomId = Number(roomId);
    const targetUserId = Number(userId);

    if (!targetRoomId || !targetUserId) return;
    if (targetUserId === Number(user?.id)) return;

    setTypingByRoom((prev) => {
      const current = prev[targetRoomId] || [];
      if (current.includes(targetUserId)) return prev;

      return {
        ...prev,
        [targetRoomId]: [...current, targetUserId],
      };
    });
  };

  const handleTypingStop = ({
    roomId,
    userId,
  }: {
    roomId: number;
    userId: number;
  }) => {
    const targetRoomId = Number(roomId);
    const targetUserId = Number(userId);

    if (!targetRoomId || !targetUserId) return;

    setTypingByRoom((prev) => {
      const current = prev[targetRoomId] || [];
      const nextUsers = current.filter((id) => id !== targetUserId);

      return {
        ...prev,
        [targetRoomId]: nextUsers,
      };
    });
  };

  (async () => {
    const socket = await getSocket();
    socketRef = socket;

    socket.on("online:users", handleOnlineUsers);
    socket.on("user:online", handleUserOnline);
    socket.on("user:offline", handleUserOffline);
    socket.on("room:list:update", handleRoomListUpdate);
    socket.on("message:new", handleNewMessage);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);
  })();

  return () => {
    if (!socketRef) return;

    socketRef.off("online:users", handleOnlineUsers);
    socketRef.off("user:online", handleUserOnline);
    socketRef.off("user:offline", handleUserOffline);
    socketRef.off("room:list:update", handleRoomListUpdate);
    socketRef.off("message:new", handleNewMessage);
    socketRef.off("typing:start", handleTypingStart);
    socketRef.off("typing:stop", handleTypingStop);
  };
}, [refetchRooms, user?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      if (inviteDialogOpen) {
        setInviteDialogOpen(false);
        return;
      }

      if (roomInfoOpen) {
        setRoomInfoOpen(false);
        return;
      }

      const visiblePopups = openPopups.filter((popup) => !popup.minimized);

      if (visiblePopups.length > 0) {
        const lastPopup = visiblePopups[visiblePopups.length - 1];
        setOpenPopups((prev) =>
          prev.filter((popup) => popup.key !== lastPopup.key)
        );
        return;
      }

      onRequestClose?.();
      window.dispatchEvent(new Event("messenger:request-close-main"));
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openPopups, onRequestClose, roomInfoOpen, inviteDialogOpen]);

  
useEffect(() => {
  const emitOpenedRoomsChanged = () => {
    const openedRoomIds = openPopups
      .filter((popup) => {
        return (
          popup.type === "room" &&
          !popup.minimized &&
          document.visibilityState === "visible"
        );
      })
      .map((popup) => Number(popup.roomId))
      .filter(Boolean);

    console.log("[MessengerPage] emit opened rooms", {
      openPopups,
      visibilityState: document.visibilityState,
      openedRoomIds,
    });

    window.dispatchEvent(
      new CustomEvent("messenger:opened-rooms-changed", {
        detail: { roomIds: openedRoomIds },
      })
    );
  };

  emitOpenedRoomsChanged();

  const handleVisibilityChange = () => {
    emitOpenedRoomsChanged();
  };

  window.addEventListener("visibilitychange", handleVisibilityChange);

  return () => {
    window.removeEventListener("visibilitychange", handleVisibilityChange);
  };
}, [openPopups]);

  useEffect(() => {
    const handleOpenRoom = (event: Event) => {
  const custom = event as CustomEvent;
  const roomId = Number(custom.detail?.roomId || 0);
  if (!roomId) return;

  console.log("[MessengerPage] handleOpenRoom event fired", {
    roomId,
    detail: custom.detail,
  });

  setLocallyViewedRoomIds((prev) =>
    prev.includes(roomId) ? prev : [...prev, roomId]
  );

  setOpenPopups((prev) => {
    const exists = prev.some(
      (popup) => popup.type === "room" && Number(popup.roomId) === roomId
    );

    if (exists) {
      return prev.map((popup) =>
        popup.type === "room" && Number(popup.roomId) === roomId
          ? { ...popup, minimized: false }
          : popup
      );
    }

    return [
      ...prev,
      {
        key: `room-${roomId}`,
        type: "room",
        roomId,
        minimized: false,
      },
    ];
  });
};

    window.addEventListener(
      "messenger:open-room",
      handleOpenRoom as EventListener
    );

    return () => {
      window.removeEventListener(
        "messenger:open-room",
        handleOpenRoom as EventListener
      );
    };
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      void refetchRooms();
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [refetchRooms]);

useEffect(() => {
  const handleCloseMain = () => {
    setOpenPopups([]);
    setLocallyViewedRoomIds([]);
  };

  window.addEventListener("messenger:request-close-main", handleCloseMain);

  return () => {
    window.removeEventListener("messenger:request-close-main", handleCloseMain);
  };
}, []);

  const orgUsers = useMemo(
    () => normalizeUsers(userList as any[], onlineUserIds),
    [userList, onlineUserIds]
  );

 const currentUserProfile = useMemo<MessengerUser | null>(() => {
  const meFromList = orgUsers.find(
    (item) => Number(item.id) === Number(user?.id)
  );

  if (meFromList) {
    return {
      ...meFromList,
      avatar: normalizeAssetUrl(
        meFromList.avatar ||
          (user as any)?.profileImageUrl ||
          (user as any)?.avatarUrl ||
          ""
      ),
      status: "online",
    };
  }

  if (!user?.id) return null;

  return {
    id: Number(user.id),
    name: user.name || user.username || "이름없음",
    position:
      (user as any)?.positionName ||
      (user as any)?.position ||
      roleToPosition(user.role),
    team: (user as any)?.teamName || (user as any)?.team || "미분류",
    avatar: normalizeAssetUrl(
      (user as any)?.profileImageUrl ||
        (user as any)?.avatarUrl ||
        (user as any)?.avatar ||
        ""
    ),
    status: "online",
  };
}, [orgUsers, user]);

  const usersById = useMemo(() => {
    const fallbackUsersById = getUsersById();
    const fromDb = orgUsers.reduce<Record<number, MessengerUser>>(
      (acc, item) => {
        acc[Number(item.id)] = item;
        return acc;
      },
      {}
    );

    return {
      ...fallbackUsersById,
      ...fromDb,
    };
  }, [orgUsers]);

  const visibleOpenRoomIds = useMemo(() => {
    return openPopups
      .filter((popup) => popup.type === "room" && !popup.minimized)
      .map((popup) => Number(popup.roomId))
      .filter(Boolean);
  }, [openPopups]);

  const mappedRooms = useMemo<MessengerRoom[]>(() => {
    const mapped = (roomRows as any[]).map((room: any) => {
      const roomType = room.roomType === "group" ? "group" : "direct";

      let roomName = room.title || "";
      if (!roomName) {
        if (roomType === "direct") {
          roomName =
            room.otherUserName ||
            room.partnerName ||
            room.otherParticipantName ||
            "1:1 대화";
        } else {
          roomName = "그룹 대화";
        }
      }

      const roomId = Number(room.id);
      const isViewed =
        locallyViewedRoomIds.includes(roomId) ||
        visibleOpenRoomIds.includes(roomId);

      return {
        id: roomId,
        name: roomName,
        type: roomType,
        participantIds: [],
        unreadCount: isViewed ? 0 : Number(room.unreadCount || 0),
        lastMessage: room.lastMessageContent || "",
        updatedAt: room.lastMessageCreatedAt
          ? new Date(room.lastMessageCreatedAt).toISOString()
          : room.updatedAt
          ? new Date(room.updatedAt).toISOString()
          : "",
        notificationsEnabled: !room.isMuted,
	avatar: normalizeAssetUrl(
  room.otherUserProfileImageUrl || ""
),
        sortAt: room.lastMessageCreatedAt
          ? new Date(room.lastMessageCreatedAt).getTime()
          : room.updatedAt
          ? new Date(room.updatedAt).getTime()
          : 0,
      } as MessengerRoom & { sortAt: number };
    });

    return mapped
      .sort((a: any, b: any) => {
        const aPinned = pinnedRoomIds.includes(Number(a.id)) ? 1 : 0;
        const bPinned = pinnedRoomIds.includes(Number(b.id)) ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        return Number(b.sortAt || 0) - Number(a.sortAt || 0);
      })
      .map((room) => room as MessengerRoom);
  }, [roomRows, pinnedRoomIds, locallyViewedRoomIds, visibleOpenRoomIds]);

  const activeRoomForInfo = useMemo(() => {
    return (
      mappedRooms.find((room) => Number(room.id) === Number(roomInfoRoomId)) ||
      null
    );
  }, [mappedRooms, roomInfoRoomId]);

  const inviteSelectableUsers = useMemo(() => {
    const currentIds = new Set(roomInfoParticipants.map((p) => Number(p.id)));

    return orgUsers
      .filter((u) => Number(u.id) !== Number(user?.id))
      .filter((u) => !currentIds.has(Number(u.id)))
      .filter((u) => {
        const q = inviteSearch.trim().toLowerCase();
        if (!q) return true;

        return (
          String(u.name || "").toLowerCase().includes(q) ||
          String(u.team || "").toLowerCase().includes(q) ||
          String(u.position || "").toLowerCase().includes(q)
        );
      });
  }, [orgUsers, roomInfoParticipants, inviteSearch, user?.id]);

  const handleMarkRoomViewed = (roomId: number) => {
    setLocallyViewedRoomIds((prev) =>
      prev.includes(roomId) ? prev : [...prev, roomId]
    );
  };

  const handleSelectRoom = async (roomId: number) => {
  console.log("[MessengerPage] handleSelectRoom called", { roomId });

  handleMarkRoomViewed(roomId);

  setOpenPopups((prev) => {
    const exists = prev.some(
      (popup) => popup.type === "room" && popup.roomId === roomId
    );

    if (exists) {
      return prev.map((popup) =>
        popup.type === "room" && popup.roomId === roomId
          ? { ...popup, minimized: false }
          : popup
      );
    }

    return [
      ...prev,
      {
        key: `room-${roomId}`,
        type: "room",
        roomId,
        minimized: false,
      },
    ];
  });

  await refetchRooms();
};

  const handleOpenDirectChat = (targetUser: MessengerUser) => {
    setOpenPopups((prev) => {
      const exists = prev.some(
        (popup) =>
          popup.type === "draft" &&
          popup.targetUserId === Number(targetUser.id)
      );

      if (exists) {
        return prev.map((popup) =>
          popup.type === "draft" &&
          popup.targetUserId === Number(targetUser.id)
            ? { ...popup, minimized: false }
            : popup
        );
      }

      return [
        ...prev,
        {
          key: `draft-${targetUser.id}`,
          type: "draft",
          targetUserId: Number(targetUser.id),
          minimized: false,
        },
      ];
    });
  };

  const handleToggleRoomMute = async (roomId: number, isMuted: boolean) => {
    await emitRoomMute(Number(roomId), isMuted);
    await refetchRooms();
  };

  const handleLeaveRoom = async (roomId: number) => {
    await emitRoomLeave(Number(roomId));

    setOpenPopups((prev) =>
      prev.filter(
        (popup) =>
          !(popup.type === "room" && Number(popup.roomId) === Number(roomId))
      )
    );

    setLocallyViewedRoomIds((prev) =>
      prev.filter((id) => Number(id) !== Number(roomId))
    );

    if (Number(roomInfoRoomId) === Number(roomId)) {
      setRoomInfoOpen(false);
      setRoomInfoRoomId(null);
      setRoomInfoParticipants([]);
      setRoomInfoMessages([]);
      setInviteDialogOpen(false);
      setSelectedInviteUserIds([]);
      setInviteSearch("");
    }

    await refetchRooms();
  };

  const handleInviteSubmit = async () => {
    if (!activeRoomForInfo?.id) return;
    if (selectedInviteUserIds.length === 0) return;

    try {
      setInviteSubmitting(true);

      await emitRoomMembersAdd(
        Number(activeRoomForInfo.id),
        selectedInviteUserIds
      );

      await refetchRooms();

      setRoomInfoParticipants((prev) => {
        const existingIds = new Set(prev.map((p) => Number(p.id)));
        const appended = orgUsers.filter(
          (u) =>
            selectedInviteUserIds.includes(Number(u.id)) &&
            !existingIds.has(Number(u.id))
        );
        return [...prev, ...appended];
      });

      setSelectedInviteUserIds([]);
      setInviteSearch("");
      setInviteDialogOpen(false);
    } catch (error: any) {
      alert(error?.message || "참여자 추가에 실패했습니다.");
    } finally {
      setInviteSubmitting(false);
    }
  };

  const closePopup = (popupKey: string) => {
  console.log("[MessengerPage] closePopup called", { popupKey });

  setOpenPopups((prev) => {
    const target = prev.find((popup) => popup.key === popupKey);

    if (target?.type === "room") {
      setLocallyViewedRoomIds((ids) =>
        ids.filter((id) => Number(id) !== Number(target.roomId))
      );
    }

    return prev.filter((popup) => popup.key !== popupKey);
  });

  setPopupPendingAttachments((prev) => {
    const next = { ...prev };
    delete next[popupKey];
    return next;
  });
};

 const toggleMinimizePopup = (popupKey: string) => {
  setOpenPopups((prev) =>
    prev.map((popup) => {
      if (popup.key !== popupKey) return popup;

      const nextMinimized = !popup.minimized;

      if (popup.type === "room" && nextMinimized) {
        setLocallyViewedRoomIds((ids) =>
          ids.filter((id) => Number(id) !== Number(popup.roomId))
        );
      }

      return { ...popup, minimized: nextMinimized };
    })
  );
};

  const togglePinRoom = (roomId: number) => {
    setPinnedRoomIds((prev) =>
      prev.includes(roomId)
        ? prev.filter((id) => id !== roomId)
        : [roomId, ...prev]
    );
  };

  const handleInputChange = (popupKey: string, value: string) => {
    setPopupInputs((prev) => ({
      ...prev,
      [popupKey]: value,
    }));
  };

  const handleAddPendingAttachment = (popupKey: string, file: File) => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const previewUrl =
      isImage || isVideo ? URL.createObjectURL(file) : undefined;

    const item: PendingAttachment = {
      id: `${Date.now()}-${Math.random()}`,
      file,
      previewUrl,
      isImage,
      isVideo,
    };

    setPopupPendingAttachments((prev) => ({
      ...prev,
      [popupKey]: [...(prev[popupKey] || []), item],
    }));
  };

  const handleRemovePendingAttachment = (popupKey: string, id: string) => {
    setPopupPendingAttachments((prev) => ({
      ...prev,
      [popupKey]: (prev[popupKey] || []).filter((item) => item.id !== id),
    }));
  };

  const handleOpenImage = (url: string, name?: string) => {
    setPreviewImage({
      open: true,
      url,
      name,
    });
  };

  const handleCloseImage = () => {
    setPreviewImage({
      open: false,
      url: undefined,
      name: undefined,
    });
  };

  const popupItems = useMemo(() => {
    return openPopups.filter((popup) => !popup.minimized);
  }, [openPopups]);

  return (
    <>
      <div className="relative h-full overflow-hidden bg-[#f5f5f7]">
        <div className="h-full">
          <MessengerSidebar
            rooms={mappedRooms}
            activeRoomId={
              popupItems
                .filter((popup) => popup.type === "room")
                .map((popup) => Number(popup.roomId))[0] ?? null
            }
            users={orgUsers}
            currentUser={currentUserProfile}
            typingRoomIds={Object.keys(typingByRoom)
              .map((key) => Number(key))
              .filter((roomId) => (typingByRoom[roomId] || []).length > 0)}
            pinnedRoomIds={pinnedRoomIds}
	notificationEnabled={notificationEnabled}
onToggleNotification={() =>
  setNotificationEnabled((prev) => !prev)
}
            onSelectRoom={handleSelectRoom}
            onOpenDirectChat={handleOpenDirectChat}
            onTogglePinRoom={(roomId) => togglePinRoom(Number(roomId))}
            onToggleMuteRoom={handleToggleRoomMute}
            onLeaveRoom={handleLeaveRoom}
          />
        </div>

        {popupItems.map((popup, index) => {
          const rightOffset = 24 + index * 388;
          const input = popupInputs[popup.key] || "";
          const pendingAttachments = popupPendingAttachments[popup.key] || [];
          const typingUserIds =
            popup.type === "room" ? typingByRoom[Number(popup.roomId)] || [] : [];

          const roomSummary =
            popup.type === "room"
              ? mappedRooms.find((item) => Number(item.id) === Number(popup.roomId))
              : null;

          const roomMuted =
            roomSummary?.notificationsEnabled === false ? true : false;

          return (
            <div
              key={popup.key}
              className="pointer-events-none absolute bottom-0"
              style={{ right: rightOffset }}
            >
              <div className="pointer-events-auto">
                <PopupRoomData
                  popup={popup}
                  usersById={usersById}
                  currentUserId={user?.id ? Number(user.id) : null}
                  pinned={
                    popup.type === "room" &&
                    pinnedRoomIds.includes(Number(popup.roomId))
                  }
                  onTogglePin={() => {
                    if (popup.type === "room") {
                      togglePinRoom(Number(popup.roomId));
                    }
                  }}
                  onClose={() => closePopup(popup.key)}
                  onMinimize={() => toggleMinimizePopup(popup.key)}
                  onOpenImage={handleOpenImage}
                  input={input}
                  pendingAttachments={pendingAttachments}
                  onInputChange={(value) => handleInputChange(popup.key, value)}
                  onAddPendingAttachment={(file) =>
                    handleAddPendingAttachment(popup.key, file)
                  }
                  onRemovePendingAttachment={(id) =>
                    handleRemovePendingAttachment(popup.key, id)
                  }
                  onDraftConverted={(newPopup) => {
                    setOpenPopups((prev) =>
                      prev
                        .filter((item) => item.key !== popup.key)
                        .concat([newPopup])
                    );
                  }}
                  onMarkRoomViewed={handleMarkRoomViewed}
                  onRefreshRooms={refetchRooms}
                  typingUserIds={typingUserIds}
                  roomMuted={roomMuted}
	chatBackground={chatBackground}
onChangeBackground={setChatBackground}
notificationEnabled={notificationEnabled}
                  onToggleMuteRoom={handleToggleRoomMute}
                  onLeaveRoom={handleLeaveRoom}
                  onOpenRoomInfo={({ room, participants, messages }) => {
                    setRoomInfoRoomId(room?.id ? Number(room.id) : null);
                    setRoomInfoParticipants(participants);
                    setRoomInfoMessages(messages);
                    setRoomInfoOpen(true);
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <ImagePreviewModal
        open={previewImage.open}
        imageUrl={previewImage.url}
        imageName={previewImage.name}
        onClose={handleCloseImage}
      />

      <MessengerRoomInfo
        open={roomInfoOpen}
        activeRoom={activeRoomForInfo}
        participants={roomInfoParticipants}
        messages={roomInfoMessages}
        roomMuted={
          activeRoomForInfo?.id
            ? mappedRooms.find(
                (room) => Number(room.id) === Number(activeRoomForInfo.id)
              )?.notificationsEnabled === false
            : false
        }
notificationEnabled={notificationEnabled}
chatBackground={chatBackground}
onChangeBackground={setChatBackground}
        onClose={() => setRoomInfoOpen(false)}
        onToggleNotifications={async () => {
          if (!activeRoomForInfo?.id) return;

          const currentMuted =
            mappedRooms.find(
              (room) => Number(room.id) === Number(activeRoomForInfo.id)
            )?.notificationsEnabled === false;

          await handleToggleRoomMute(
            Number(activeRoomForInfo.id),
            !currentMuted
          );
        }}
        onLeaveRoom={() => {
  if (!roomInfoRoomId) return;

  const ok = confirm("정말 채팅방을 나가시겠습니까?");
  if (!ok) return;

  void handleLeaveRoom(Number(roomInfoRoomId));
  setRoomInfoOpen(false);
}}
        onAddParticipant={() => {
          if (activeRoomForInfo?.type !== "group") return;
          setSelectedInviteUserIds([]);
          setInviteSearch("");
          setInviteDialogOpen(true);
        }}
	onUpdateTitle={(title) => {
  if (!activeRoomForInfo?.id) return;

  (async () => {
    const socket = await getSocket();

    socket.emit(
      "room:title:update",
      {
        roomId: Number(activeRoomForInfo.id),
        title,
      },
      async (res: any) => {
        if (!res?.success) {
          alert(res?.message || "채팅방 이름 변경 실패");
          return;
        }

        await refetchRooms();

        setRoomInfoMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            roomId: Number(activeRoomForInfo.id),
            senderId: 0,
            type: "system",
            content: `채팅방 이름이 "${title}"(으)로 변경되었습니다.`,
            createdAtRaw: new Date().toISOString(),
            createdAt: new Date().toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
            }),
            fileName: "",
            fileUrl: "",
          },
        ]);
      }
    );
  })();
}}
      />

      {inviteDialogOpen && (
        <div className="fixed inset-0 z-[10040] flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-[520px] rounded-[24px] border border-slate-200 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.2)]">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <div className="text-base font-semibold text-slate-900">
                  참여자 추가
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  그룹 채팅방에 초대할 직원을 선택하세요.
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setInviteDialogOpen(false);
                  setSelectedInviteUserIds([]);
                  setInviteSearch("");
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-slate-700 transition hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <div className="px-5 py-4">
              <input
                value={inviteSearch}
                onChange={(e) => setInviteSearch(e.target.value)}
                placeholder="이름 / 팀 / 직급 검색"
                className="h-11 w-full rounded-2xl border border-slate-300 px-4 text-sm outline-none focus:border-slate-500"
              />

              <div className="mt-4 max-h-[360px] space-y-2 overflow-y-auto">
                {inviteSelectableUsers.length === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    초대 가능한 사용자가 없습니다.
                  </div>
                ) : (
                  inviteSelectableUsers.map((member) => {
                    const checked = selectedInviteUserIds.includes(
                      Number(member.id)
                    );

                    return (
                      <label
                        key={member.id}
                        className="flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 transition hover:bg-slate-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const nextChecked = e.target.checked;
                            setSelectedInviteUserIds((prev) =>
                              nextChecked
                                ? [...prev, Number(member.id)]
                                : prev.filter(
                                    (id) => Number(id) !== Number(member.id)
                                  )
                            );
                          }}
                        />

                        <div className="h-11 w-11 overflow-hidden rounded-full bg-slate-100">
                          {member.avatar ? (
                            <img
                              src={member.avatar}
                              alt={member.name}
                              className="h-full w-full object-cover"
                            />
                          ) : null}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-900">
                            {member.name}
                          </div>
                          <div className="truncate text-xs text-slate-500">
                            {member.team || "미분류"}
                            {member.position ? ` · ${member.position}` : ""}
                          </div>
                        </div>

                        <div
                          className={`text-xs font-medium ${
                            member.status === "online"
                              ? "text-emerald-600"
                              : "text-slate-400"
                          }`}
                        >
                          {member.status === "online" ? "온라인" : "오프라인"}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
              <div className="text-sm text-slate-500">
                선택됨 {selectedInviteUserIds.length}명
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInviteDialogOpen(false);
                    setSelectedInviteUserIds([]);
                    setInviteSearch("");
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm text-slate-700 transition hover:bg-slate-50"
                >
                  취소
                </button>

                <button
                  type="button"
                  disabled={
                    inviteSubmitting || selectedInviteUserIds.length === 0
                  }
                  onClick={() => {
                    void handleInviteSubmit();
                  }}
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {inviteSubmitting ? "추가 중..." : "참여자 추가"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}