import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getSocket } from "@/lib/socket";
import { normalizeAssetUrl } from "@/lib/normalizeAssetUrl";

import MessengerSidebar from "@/components/messenger/MessengerSidebar";
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

  const sendMessageMutation = trpc.messenger.sendMessage.useMutation();
const markReadMutation = trpc.messenger.markRead.useMutation();

useEffect(() => {
  if (popup.type !== "room" || !roomId || popup.minimized) return;

  const socket = getSocket();

  const handleNewMessage = async (payload: any) => {
    const incomingRoomId = Number(payload?.roomId || 0);
    if (incomingRoomId !== Number(roomId)) return;

    await refetchMessages();
    await refetchMembers();
  };

  socket.on("message:new", handleNewMessage);

  return () => {
    socket.off("message:new", handleNewMessage);
  };
}, [popup.type, roomId, popup.minimized, refetchMessages, refetchMembers]);

  const addAttachmentMutation = trpc.messenger.addAttachment.useMutation();
  const createDirectRoomMutation = trpc.messenger.directRoom.useMutation();

  const room =
    popup.type === "room"
      ? {
          id: roomId,
          name:
            memberRows.length === 2
              ? memberRows.find((m: any) => Number(m.userId) !== Number(user?.id))
                  ?.name || "1:1 대화"
              : "채팅방",
          type: "direct" as const,
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

  const participants = useMemo<any[]>(() => {
  if (popup.type === "draft") return targetUser ? [targetUser] : [];

  return (memberRows as any[]).map((member: any) => ({
    id: Number(member.userId),
    name: member.name || member.username || "이름없음",
    position: member.positionName || roleToPosition(member.role),
    team: member.teamName || "미분류",
    avatar: normalizeAssetUrl(
      member.avatarUrl || member.profileImageUrl || ""
    ),
    status: "offline",
    lastReadMessageId: member.lastReadMessageId
      ? Number(member.lastReadMessageId)
      : null,
  }));
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


  markReadMutation.mutate({
    roomId: Number(roomId),
    lastReadMessageId: Number(lastMessageId),
  });
}, [popup.type, roomId, messages.length]);  


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
      const created = await createDirectRoomMutation.mutateAsync({
        userId: Number(popup.targetUserId),
      });

      targetRoomId = Number(created?.room?.id || created?.roomId || 0);
      if (!targetRoomId) return;

      onDraftConverted({
        key: `room-${targetRoomId}`,
        type: "room",
        roomId: targetRoomId,
        minimized: false,
      });
    }

    if (hasText) {
      await sendMessageMutation.mutateAsync({
        roomId: Number(targetRoomId),
        content: text,
        messageType: "text",
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

      const sendRes = await sendMessageMutation.mutateAsync({
        roomId: Number(targetRoomId),
        content,
        messageType,
      });

      if (sendRes?.id) {
        await addAttachmentMutation.mutateAsync({
          messageId: Number(sendRes.id),
          fileName,
          fileUrl,
          fileType: item.file.type || undefined,
          fileSize: item.file.size,
        });
      }
    }

    onInputChange("");
    pendingAttachments.forEach((item) => onRemovePendingAttachment(item.id));

    if (targetRoomId) {
      onMarkRoomViewed(Number(targetRoomId));
    }

    await refetchMessages();
    await refetchMembers();
  };

  return (
    <MessengerPopupWindow
      popupKey={popup.key}
      room={room}
      targetUser={targetUser}
      participants={participants}
      messages={messages}
      usersById={usersById}
      currentUserId={currentUserId}
      input={input}
      pendingAttachments={pendingAttachments}
      onInputChange={onInputChange}
      onSend={handleSend}
      onAttachFile={onAddPendingAttachment}
      onRemovePendingAttachment={onRemovePendingAttachment}
      onOpenImage={onOpenImage}
      onClose={onClose}
      onMinimize={onMinimize}
      onTogglePin={onTogglePin}
      pinned={pinned}
      minimized={!!popup.minimized}
      rightOffset={560}
    />
  );
}

export default function MessengerPage({
  companyName = "위드원 교육",
  onRequestClose,
}: MessengerPageProps) {
  const { user } = useAuth();

  const [onlineUserIds] = useState<Set<number>>(new Set());
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
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

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
  }, [openPopups, onRequestClose]);

  useEffect(() => {
    const openedRoomIds = openPopups
      .filter((popup) => !popup.minimized && popup.type === "room")
      .map((popup) => Number(popup.roomId))
      .filter(Boolean);

    window.dispatchEvent(
      new CustomEvent("messenger:opened-rooms-changed", {
        detail: { roomIds: openedRoomIds },
      })
    );
  }, [openPopups]);

  useEffect(() => {
    const handleOpenRoom = (event: Event) => {
      const custom = event as CustomEvent;
      const roomId = Number(custom.detail?.roomId || 0);
      if (!roomId) return;

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
  const socket = getSocket();

  const handleNewMessage = async () => {
    await refetchRooms();
  };

  socket.on("message:new", handleNewMessage);

  return () => {
    socket.off("message:new", handleNewMessage);
  };
}, [refetchRooms]);

  const orgUsers = useMemo(
    () => normalizeUsers(userList as any[], onlineUserIds),
    [userList, onlineUserIds]
  );

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
  }, [roomRows, pinnedRoomIds, locallyViewedRoomIds, visibleOpenRoomIds]);

  const handleMarkRoomViewed = (roomId: number) => {
    setLocallyViewedRoomIds((prev) =>
      prev.includes(roomId) ? prev : [...prev, roomId]
    );
  };

  const handleSelectRoom = async (roomId: number) => {
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

  const closePopup = (popupKey: string) => {
    setOpenPopups((prev) => prev.filter((popup) => popup.key !== popupKey));

    setPopupPendingAttachments((prev) => {
      const next = { ...prev };
      delete next[popupKey];
      return next;
    });
  };

  const toggleMinimizePopup = (popupKey: string) => {
    setOpenPopups((prev) =>
      prev.map((popup) =>
        popup.key === popupKey
          ? { ...popup, minimized: !popup.minimized }
          : popup
      )
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
              popupItems.find((popup) => popup.type === "room")?.type === "room"
                ? Number(
                    (popupItems.find((popup) => popup.type === "room") as {
                      roomId: number;
                    }).roomId
                  )
                : null
            }
            users={[...orgUsers]
              .filter((u) => Number(u.id) !== Number(user?.id))
              .sort((a, b) => {
                const teamCompare = String(a.team || "").localeCompare(
                  String(b.team || "")
                );
                if (teamCompare !== 0) return teamCompare;

                const posCompare = String(a.position || "").localeCompare(
                  String(b.position || "")
                );
                if (posCompare !== 0) return posCompare;

                return String(a.name || "").localeCompare(String(b.name || ""));
              })}
            onSelectRoom={handleSelectRoom}
            onOpenDirectChat={handleOpenDirectChat}
          />
        </div>

        {openPopups.map((popup, index) => {
          const roomId = popup.type === "room" ? popup.roomId : 0;

          const room =
            popup.type === "room"
              ? mappedRooms.find((item) => Number(item.id) === Number(roomId)) ||
                null
              : null;

          const pinned = room?.id
            ? pinnedRoomIds.includes(Number(room.id))
            : false;

          return (
            <PopupRoomData
              key={popup.key}
              popup={popup}
              usersById={usersById}
              currentUserId={user?.id ? Number(user.id) : null}
              pinned={pinned}
              onTogglePin={() => {
                if (room?.id) togglePinRoom(Number(room.id));
              }}
              onClose={() => closePopup(popup.key)}
              onMinimize={() => toggleMinimizePopup(popup.key)}
              onOpenImage={handleOpenImage}
              input={popupInputs[popup.key] || ""}
              pendingAttachments={popupPendingAttachments[popup.key] || []}
              onInputChange={(value) => handleInputChange(popup.key, value)}
              onAddPendingAttachment={(file) =>
                handleAddPendingAttachment(popup.key, file)
              }
              onRemovePendingAttachment={(id) =>
                handleRemovePendingAttachment(popup.key, id)
              }
              onDraftConverted={(newPopup) => {
                setOpenPopups((prev) =>
                  prev.map((item) => (item.key === popup.key ? newPopup : item))
                );

                setPopupPendingAttachments((prev) => {
                  const next = { ...prev };
                  next[newPopup.key] = prev[popup.key] || [];
                  delete next[popup.key];
                  return next;
                });

                if (newPopup.type === "room") {
                  handleMarkRoomViewed(Number(newPopup.roomId));
                }

                void refetchRooms();
              }}
              onMarkRoomViewed={handleMarkRoomViewed}
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