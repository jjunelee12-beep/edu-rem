import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getSocket } from "@/lib/socket";

import MessengerSidebar from "@/components/messenger/MessengerSidebar";
import MessengerRoomInfo from "@/components/messenger/MessengerRoomInfo";
import MessengerPopupWindow from "@/components/messenger/MessengerPopupWindow";
import ImagePreviewModal from "@/components/messenger/ImagePreviewModal";

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
    avatar: user.avatarUrl || user.profileImageUrl || user.avatar || "",
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

type MessengerPageProps = {
  companyName?: string;
  onRequestClose?: () => void;
};

export default function MessengerPage({
  companyName = "위드원 교육",
  onRequestClose,
}: MessengerPageProps) {
  const { user } = useAuth();

  const socketRef = useRef<any>(null);
  const joinedRoomRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());
  const [typingUserIdsByRoom, setTypingUserIdsByRoom] = useState<Record<number, number[]>>({});
  const [roomInfoOpenFor, setRoomInfoOpenFor] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<{
    open: boolean;
    url?: string;
    name?: string;
  }>({
    open: false,
  });

  const [openPopups, setOpenPopups] = useState<OpenPopup[]>([]);
  const [popupInputs, setPopupInputs] = useState<Record<string, string>>({});
  const [pinnedRoomIds, setPinnedRoomIds] = useState<number[]>([]);

  const { data: userList = [] } = trpc.users.list.useQuery();
  const {
    data: roomRows = [],
    refetch: refetchRooms,
  } = trpc.messenger.myRooms.useQuery();

  const { data: allMessagesRows = [], refetch: refetchAllMessages } =
    trpc.messenger.allMessages?.useQuery?.() ?? ({ data: [], refetch: async () => {} } as any);

  const {
    data: memberRowsByRoom = [],
    refetch: refetchAllMembers,
  } = trpc.messenger.allMembers?.useQuery?.() ?? ({ data: [], refetch: async () => {} } as any);

  const addAttachmentMutation = trpc.messenger.addAttachment.useMutation();
  const sendMessageMutation = trpc.messenger.sendMessage.useMutation();
  const createDirectRoomMutation = trpc.messenger.directRoom.useMutation();
  const markReadMutation = trpc.messenger.markRead.useMutation();

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
    localStorage.setItem("messenger-pinned-room-ids", JSON.stringify(pinnedRoomIds));
  }, [pinnedRoomIds]);

  const orgUsers = useMemo(
    () => normalizeUsers(userList as any[], onlineUserIds),
    [userList, onlineUserIds]
  );

  const usersById = useMemo(() => {
    const fallbackUsersById = getUsersById();
    const fromDb = orgUsers.reduce<Record<number, MessengerUser>>((acc, item) => {
      acc[Number(item.id)] = item;
      return acc;
    }, {});
    return {
      ...fallbackUsersById,
      ...fromDb,
    };
  }, [orgUsers]);

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

      return {
        id: Number(room.id),
        name: roomName,
        type: roomType,
        participantIds: [],
        unreadCount: Number(room.unreadCount || 0),
        lastMessage: room.lastMessageContent || "",
        updatedAt: room.lastMessageCreatedAt
          ? new Date(room.lastMessageCreatedAt).toLocaleString("ko-KR")
          : room.updatedAt
          ? new Date(room.updatedAt).toLocaleString("ko-KR")
          : "",
        notificationsEnabled: !room.isMuted,
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
  }, [roomRows, pinnedRoomIds]);

  const messagesByRoomId = useMemo<Record<number, MessengerMessage[]>>(() => {
    const grouped: Record<number, MessengerMessage[]> = {};

    (allMessagesRows as any[]).forEach((m: any) => {
      const roomId = Number(m.roomId);
      if (!grouped[roomId]) grouped[roomId] = [];
      grouped[roomId].push({
        id: Number(m.id),
        roomId,
        senderId: Number(m.senderId),
        type: m.messageType || "text",
        content: m.content || "",
        createdAt: m.createdAt
          ? new Date(m.createdAt).toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        fileName: m.fileName || m.attachmentName || "",
        fileUrl: m.fileUrl || m.attachmentUrl || "",
      });
    });

    Object.keys(grouped).forEach((roomId) => {
      grouped[Number(roomId)] = grouped[Number(roomId)].sort(
        (a, b) => Number(a.id) - Number(b.id)
      );
    });

    return grouped;
  }, [allMessagesRows]);

  const membersByRoomId = useMemo<Record<number, MessengerUser[]>>(() => {
    const grouped: Record<number, MessengerUser[]> = {};

    (memberRowsByRoom as any[]).forEach((member: any) => {
      const roomId = Number(member.roomId);
      if (!grouped[roomId]) grouped[roomId] = [];
      grouped[roomId].push({
        id: Number(member.userId),
        name: member.name || member.username || "이름없음",
        position: member.positionName || roleToPosition(member.role),
        team: member.teamName || "미분류",
        avatar: member.avatarUrl || member.profileImageUrl || "",
        status: onlineUserIds.has(Number(member.userId)) ? "online" : "offline",
      });
    });

    return grouped;
  }, [memberRowsByRoom, onlineUserIds]);

  const openRoomPopup = (roomId: number) => {
    setOpenPopups((prev) => {
      const exists = prev.some((popup) => popup.type === "room" && popup.roomId === roomId);
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
  };

  const openDraftPopup = (targetUserId: number) => {
    setOpenPopups((prev) => {
      const matchedRoom = mappedRooms.find((room) =>
        room.type === "direct" &&
        room.name === (usersById[targetUserId]?.name || "")
      );

      if (matchedRoom) {
        const exists = prev.some(
          (popup) => popup.type === "room" && popup.roomId === Number(matchedRoom.id)
        );
        if (exists) {
          return prev.map((popup) =>
            popup.type === "room" && popup.roomId === Number(matchedRoom.id)
              ? { ...popup, minimized: false }
              : popup
          );
        }
        return [
          ...prev,
          {
            key: `room-${matchedRoom.id}`,
            type: "room",
            roomId: Number(matchedRoom.id),
            minimized: false,
          },
        ];
      }

      const exists = prev.some(
        (popup) => popup.type === "draft" && popup.targetUserId === targetUserId
      );
      if (exists) {
        return prev.map((popup) =>
          popup.type === "draft" && popup.targetUserId === targetUserId
            ? { ...popup, minimized: false }
            : popup
        );
      }

      return [
        ...prev,
        {
          key: `draft-${targetUserId}`,
          type: "draft",
          targetUserId,
          minimized: false,
        },
      ];
    });
  };

  const closePopup = (popupKey: string) => {
    setOpenPopups((prev) => prev.filter((popup) => popup.key !== popupKey));
    setRoomInfoOpenFor((prev) => (prev === popupKey ? null : prev));
  };

  const toggleMinimizePopup = (popupKey: string) => {
    setOpenPopups((prev) =>
      prev.map((popup) =>
        popup.key === popupKey ? { ...popup, minimized: !popup.minimized } : popup
      )
    );
  };

  const togglePinRoom = (roomId: number) => {
    setPinnedRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [roomId, ...prev]
    );
  };

  useEffect(() => {
    if (!user?.id) return;

    const socket = getSocket();
    socketRef.current = socket;

    const handleOnlineUsers = (payload: { userIds: number[] }) => {
      const ids = (payload?.userIds ?? []).map((id) => Number(id));
      setOnlineUserIds(new Set(ids));
    };

    const handleUserOnline = (payload: { userId: number }) => {
      const onlineId = Number(payload?.userId);
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.add(onlineId);
        return next;
      });
    };

    const handleUserOffline = (payload: { userId: number }) => {
      const offlineId = Number(payload?.userId);
      setOnlineUserIds((prev) => {
        const next = new Set(prev);
        next.delete(offlineId);
        return next;
      });
    };

    const handleNewMessage = async () => {
      await Promise.all([refetchRooms(), refetchAllMessages(), refetchAllMembers()]);
    };

    socket.on("online:users", handleOnlineUsers);
    socket.on("user:online", handleUserOnline);
    socket.on("user:offline", handleUserOffline);
    socket.on("message:new", handleNewMessage);
    socket.on("room:list:update", handleNewMessage);
    socket.on("read:update", handleNewMessage);

    return () => {
      socket.off("online:users", handleOnlineUsers);
      socket.off("user:online", handleUserOnline);
      socket.off("user:offline", handleUserOffline);
      socket.off("message:new", handleNewMessage);
      socket.off("room:list:update", handleNewMessage);
      socket.off("read:update", handleNewMessage);
    };
  }, [user?.id, refetchRooms, refetchAllMessages, refetchAllMembers]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      const visiblePopups = openPopups.filter((popup) => !popup.minimized);
      if (roomInfoOpenFor) {
        setRoomInfoOpenFor(null);
        return;
      }

      if (visiblePopups.length > 0) {
        closePopup(visiblePopups[visiblePopups.length - 1].key);
        return;
      }

      onRequestClose?.();
      window.dispatchEvent(new Event("messenger:request-close-main"));
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [openPopups, roomInfoOpenFor, onRequestClose]);

  const handleSelectRoom = async (roomId: number) => {
    openRoomPopup(roomId);

    const roomMessages = messagesByRoomId[roomId] || [];
    const lastMessageId = Number(roomMessages[roomMessages.length - 1]?.id || 0);

    if (lastMessageId) {
      try {
        await markReadMutation.mutateAsync({
          roomId,
          lastReadMessageId: lastMessageId,
        });
        await refetchRooms();
      } catch {}
    }
  };

  const handleOpenDirectChat = (targetUser: MessengerUser) => {
    openDraftPopup(Number(targetUser.id));
  };

  const handleInputChange = (popupKey: string, value: string) => {
    setPopupInputs((prev) => ({
      ...prev,
      [popupKey]: value,
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

  const sendMessageToRoom = async (
    roomId: number,
    content: string,
    messageType: "text" | "image" | "file" = "text",
    attachment?: {
      fileUrl?: string;
      fileName?: string;
      fileType?: string;
      fileSize?: number;
    }
  ) => {
    const socket = socketRef.current;

    if (socket) {
      socket.emit("message:send", {
        roomId,
        content,
        messageType,
        ...attachment,
      });
      return;
    }

    const sendRes = await sendMessageMutation.mutateAsync({
      roomId,
      content,
      messageType,
    });

    if (attachment?.fileUrl && sendRes?.id) {
      await addAttachmentMutation.mutateAsync({
        messageId: Number(sendRes.id),
        fileName: attachment.fileName || "",
        fileUrl: attachment.fileUrl,
        fileType: attachment.fileType,
        fileSize: attachment.fileSize,
      });
    }
  };

  const handleSendFromPopup = async (popup: OpenPopup) => {
    const raw = popupInputs[popup.key] || "";
    const text = raw.trim();
    if (!text) return;

    if (popup.type === "room") {
      await sendMessageToRoom(popup.roomId, text, "text");
      setPopupInputs((prev) => ({ ...prev, [popup.key]: "" }));
      await Promise.all([refetchRooms(), refetchAllMessages(), refetchAllMembers()]);
      return;
    }

    const targetUserId = popup.targetUserId;
    const createRes = await createDirectRoomMutation.mutateAsync({
      userId: Number(targetUserId),
    });

    const createdRoomId = Number(createRes?.room?.id || createRes?.roomId || 0);
    if (!createdRoomId) return;

    await sendMessageToRoom(createdRoomId, text, "text");
    setPopupInputs((prev) => ({ ...prev, [popup.key]: "" }));

    setOpenPopups((prev) =>
      prev.map((item) =>
        item.key === popup.key
          ? {
              key: `room-${createdRoomId}`,
              type: "room",
              roomId: createdRoomId,
              minimized: false,
            }
          : item
      )
    );

    await Promise.all([refetchRooms(), refetchAllMessages(), refetchAllMembers()]);
  };

  const handleAttachFileFromPopup = async (popup: OpenPopup, file: File) => {
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
      alert("파일 업로드에 실패했습니다.");
      return;
    }

    const uploaded = await uploadRes.json();
    const fileUrl = uploaded?.fileUrl;
    const fileName = uploaded?.fileName || file.name;

    if (!fileUrl) {
      alert("파일 URL을 가져오지 못했습니다.");
      return;
    }

    const isImage = file.type.startsWith("image/");
    const messageType = isImage ? "image" : "file";
    const content = isImage ? "[이미지]" : `[파일] ${fileName}`;

    if (popup.type === "room") {
      await sendMessageToRoom(popup.roomId, content, messageType, {
        fileUrl,
        fileName,
        fileType: file.type || undefined,
        fileSize: file.size,
      });
      await Promise.all([refetchRooms(), refetchAllMessages(), refetchAllMembers()]);
      return;
    }

    const createRes = await createDirectRoomMutation.mutateAsync({
      userId: Number(popup.targetUserId),
    });

    const createdRoomId = Number(createRes?.room?.id || createRes?.roomId || 0);
    if (!createdRoomId) return;

    await sendMessageToRoom(createdRoomId, content, messageType, {
      fileUrl,
      fileName,
      fileType: file.type || undefined,
      fileSize: file.size,
    });

    setOpenPopups((prev) =>
      prev.map((item) =>
        item.key === popup.key
          ? {
              key: `room-${createdRoomId}`,
              type: "room",
              roomId: createdRoomId,
              minimized: false,
            }
          : item
      )
    );

    await Promise.all([refetchRooms(), refetchAllMessages(), refetchAllMembers()]);
  };

  const popupItems = useMemo(() => {
    return openPopups.filter((popup) => !popup.minimized);
  }, [openPopups]);

  return (
    <>
      <div className="relative h-full overflow-hidden bg-white">
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-semibold text-slate-950">{companyName}</p>
            <p className="mt-1 text-xs text-slate-500">
              조직도에서 더블클릭하면 새 대화를 열 수 있습니다.
            </p>
          </div>

          <div className="grid h-[calc(100%-61px)] grid-cols-[320px_minmax(0,1fr)]">
            <MessengerSidebar
              rooms={mappedRooms}
              activeRoomId={null}
              users={[...orgUsers]
                .filter((u) => Number(u.id) !== Number(user?.id))
                .sort((a, b) => {
                  const teamCompare = String(a.team || "").localeCompare(String(b.team || ""));
                  if (teamCompare !== 0) return teamCompare;

                  const posCompare = String(a.position || "").localeCompare(String(b.position || ""));
                  if (posCompare !== 0) return posCompare;

                  return String(a.name || "").localeCompare(String(b.name || ""));
                })}
              onSelectRoom={handleSelectRoom}
              onOpenDirectChat={handleOpenDirectChat}
            />

            <div className="flex h-full items-center justify-center bg-[#f7f8fa] px-6 text-center">
              <div>
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-[#ffeb59] text-slate-900 shadow-sm">
                  <MessageSquareIcon />
                </div>
                <p className="mt-4 text-base font-semibold text-slate-900">
                  채팅방을 선택하세요
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  조직도에서 조직원을 선택하거나 채팅 목록에서 대화를 열 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </div>

        {popupItems.map((popup, index) => {
          const room =
            popup.type === "room"
              ? mappedRooms.find((item) => Number(item.id) === Number(popup.roomId)) || null
              : null;

          const targetUser =
            popup.type === "draft"
              ? usersById[Number(popup.targetUserId)] || null
              : room?.type === "direct"
              ? orgUsers.find((u) => u.name === room.name) || null
              : null;

          const participants =
            popup.type === "room"
              ? membersByRoomId[Number(popup.roomId)] || []
              : targetUser
              ? [targetUser]
              : [];

          const messages =
            popup.type === "room"
              ? messagesByRoomId[Number(popup.roomId)] || []
              : [];

          return (
            <MessengerPopupWindow
              key={popup.key}
              popupKey={popup.key}
              room={room}
              targetUser={targetUser}
              participants={participants}
              messages={messages}
              usersById={usersById}
              currentUserId={user?.id ? Number(user.id) : null}
              input={popupInputs[popup.key] || ""}
              onInputChange={(value) => handleInputChange(popup.key, value)}
              onSend={() => handleSendFromPopup(popup)}
              onAttachFile={(file) => handleAttachFileFromPopup(popup, file)}
              onOpenImage={handleOpenImage}
              onClose={() => closePopup(popup.key)}
              onMinimize={() => toggleMinimizePopup(popup.key)}
              onToggleRoomInfo={() =>
                setRoomInfoOpenFor((prev) => (prev === popup.key ? null : popup.key))
              }
              onTogglePin={() => {
                if (room?.id) togglePinRoom(Number(room.id));
              }}
              pinned={room?.id ? pinnedRoomIds.includes(Number(room.id)) : false}
              rightOffset={384 + index * 392}
              zIndex={10010 + index}
            />
          );
        })}

        {popupItems.map((popup) => {
          if (roomInfoOpenFor !== popup.key) return null;

          const room =
            popup.type === "room"
              ? mappedRooms.find((item) => Number(item.id) === Number(popup.roomId)) || null
              : null;

          const participants =
            popup.type === "room"
              ? membersByRoomId[Number(popup.roomId)] || []
              : popup.type === "draft"
              ? [usersById[Number(popup.targetUserId)]].filter(Boolean)
              : [];

          const messages =
            popup.type === "room"
              ? messagesByRoomId[Number(popup.roomId)] || []
              : [];

          return (
            <MessengerRoomInfo
              key={`info-${popup.key}`}
              open
              activeRoom={room}
              participants={participants}
              messages={messages}
              onClose={() => setRoomInfoOpenFor(null)}
              onToggleNotifications={() => {}}
              onLeaveRoom={() => {}}
              onAddParticipant={() => {}}
            />
          );
        })}
      </div>

      <ImagePreviewModal
        open={previewImage.open}
        imageUrl={previewImage.url}
        imageName={previewImage.name}
        onClose={handleCloseImage}
      />
    </>
  );
}

function MessageSquareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}