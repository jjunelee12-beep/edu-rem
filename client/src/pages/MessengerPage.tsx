import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

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

function PopupRoomData({
  popup,
  usersById,
  currentUserId,
  pinned,
  onTogglePin,
  onClose,
  onMinimize,
  onToggleRoomInfo,
  onOpenImage,
  input,
  onInputChange,
  onDraftConverted,
}: {
  popup: OpenPopup;
  usersById: Record<number, MessengerUser>;
  currentUserId: number | null;
  pinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onToggleRoomInfo: () => void;
  onOpenImage: (url: string, name?: string) => void;
  input: string;
  onInputChange: (value: string) => void;
  onDraftConverted: (newPopup: OpenPopup) => void;
}) {
  const { user } = useAuth();

  const roomId = popup.type === "room" ? popup.roomId : 0;

  const {
    data: messageRows = [],
    refetch: refetchMessages,
  } = trpc.messenger.messages.useQuery(
    { roomId: Number(roomId) },
    { enabled: popup.type === "room" && !!roomId }
  );

  const {
    data: memberRows = [],
    refetch: refetchMembers,
  } = trpc.messenger.members.useQuery(
    { roomId: Number(roomId) },
    { enabled: popup.type === "room" && !!roomId }
  );

  const sendMessageMutation = trpc.messenger.sendMessage.useMutation();
  const addAttachmentMutation = trpc.messenger.addAttachment.useMutation();
  const createDirectRoomMutation = trpc.messenger.directRoom.useMutation();

  const room =
    popup.type === "room"
      ? {
          id: roomId,
          name:
            memberRows.length === 2
              ? memberRows.find((m: any) => Number(m.userId) !== Number(user?.id))?.name || "1:1 대화"
              : "채팅방",
          type: "direct" as const,
          participantIds: [],
          unreadCount: 0,
          lastMessage: "",
          updatedAt: "",
        }
      : null;

  const targetUser =
    popup.type === "draft" ? usersById[Number(popup.targetUserId)] || null : null;

  const participants = useMemo<MessengerUser[]>(() => {
    if (popup.type === "draft") return targetUser ? [targetUser] : [];
    return (memberRows as any[]).map((member: any) => ({
      id: Number(member.userId),
      name: member.name || member.username || "이름없음",
      position: member.positionName || roleToPosition(member.role),
      team: member.teamName || "미분류",
      avatar: member.avatarUrl || member.profileImageUrl || "",
      status: "offline",
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
      fileUrl: m.fileUrl || m.attachmentUrl || "",
    })) as any;
  }, [popup.type, messageRows]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;

    if (popup.type === "room") {
      await sendMessageMutation.mutateAsync({
        roomId: Number(roomId),
        content: text,
        messageType: "text",
      });
      onInputChange("");
      await refetchMessages();
      await refetchMembers();
      return;
    }

    const created = await createDirectRoomMutation.mutateAsync({
      userId: Number(popup.targetUserId),
    });

    const createdRoomId = Number(created?.room?.id || created?.roomId || 0);
    if (!createdRoomId) return;

    await sendMessageMutation.mutateAsync({
      roomId: createdRoomId,
      content: text,
      messageType: "text",
    });

    onInputChange("");
    onDraftConverted({
      key: `room-${createdRoomId}`,
      type: "room",
      roomId: createdRoomId,
      minimized: false,
    });
  };

  const handleAttachFile = async (file: File) => {
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
      const sendRes = await sendMessageMutation.mutateAsync({
        roomId: Number(roomId),
        content,
        messageType,
      });

      if (sendRes?.id) {
        await addAttachmentMutation.mutateAsync({
          messageId: Number(sendRes.id),
          fileName,
          fileUrl,
          fileType: file.type || undefined,
          fileSize: file.size,
        });
      }

      await refetchMessages();
      await refetchMembers();
      return;
    }

    const created = await createDirectRoomMutation.mutateAsync({
      userId: Number(popup.targetUserId),
    });

    const createdRoomId = Number(created?.room?.id || created?.roomId || 0);
    if (!createdRoomId) return;

    const sendRes = await sendMessageMutation.mutateAsync({
      roomId: createdRoomId,
      content,
      messageType,
    });

    if (sendRes?.id) {
      await addAttachmentMutation.mutateAsync({
        messageId: Number(sendRes.id),
        fileName,
        fileUrl,
        fileType: file.type || undefined,
        fileSize: file.size,
      });
    }

    onDraftConverted({
      key: `room-${createdRoomId}`,
      type: "room",
      roomId: createdRoomId,
      minimized: false,
    });
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
      onInputChange={onInputChange}
      onSend={handleSend}
      onAttachFile={handleAttachFile}
      onOpenImage={onOpenImage}
      onClose={onClose}
      onMinimize={onMinimize}
      onToggleRoomInfo={onToggleRoomInfo}
      onTogglePin={onTogglePin}
      pinned={pinned}
      rightOffset={560}
    />
  );
}

export default function MessengerPage({
  companyName = "위드원 교육",
  onRequestClose,
}: MessengerPageProps) {
  const { user } = useAuth();

  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());
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
  const { data: roomRows = [], refetch: refetchRooms } = trpc.messenger.myRooms.useQuery();

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;

      const visiblePopups = openPopups.filter((popup) => !popup.minimized);
      if (roomInfoOpenFor) {
        setRoomInfoOpenFor(null);
        return;
      }

      if (visiblePopups.length > 0) {
        const lastPopup = visiblePopups[visiblePopups.length - 1];
        setOpenPopups((prev) => prev.filter((popup) => popup.key !== lastPopup.key));
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

  const handleSelectRoom = async (roomId: number) => {
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

    await refetchRooms();
  };

  const handleOpenDirectChat = (targetUser: MessengerUser) => {
    setOpenPopups((prev) => {
      const exists = prev.some(
        (popup) => popup.type === "draft" && popup.targetUserId === Number(targetUser.id)
      );
      if (exists) {
        return prev.map((popup) =>
          popup.type === "draft" && popup.targetUserId === Number(targetUser.id)
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

  const popupItems = useMemo(() => {
    return openPopups.filter((popup) => !popup.minimized);
  }, [openPopups]);

  return (
    <>
      <div className="relative h-full overflow-hidden bg-[#eef2f7]">
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-300 bg-white px-4 py-3">
            <p className="text-sm font-semibold text-slate-950">{companyName}</p>
          </div>

          <div className="h-[calc(100%-53px)]">
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
          </div>
        </div>

        {popupItems.map((popup, index) => {
          const roomId = popup.type === "room" ? popup.roomId : 0;
          const room =
            popup.type === "room"
              ? mappedRooms.find((item) => Number(item.id) === Number(roomId)) || null
              : null;

          return (
            <PopupRoomData
              key={popup.key}
              popup={popup}
              usersById={usersById}
              currentUserId={user?.id ? Number(user.id) : null}
              pinned={room?.id ? pinnedRoomIds.includes(Number(room.id)) : false}
              onTogglePin={() => {
                if (room?.id) togglePinRoom(Number(room.id));
              }}
              onClose={() => closePopup(popup.key)}
              onMinimize={() => toggleMinimizePopup(popup.key)}
              onToggleRoomInfo={() =>
                setRoomInfoOpenFor((prev) => (prev === popup.key ? null : popup.key))
              }
              onOpenImage={handleOpenImage}
              input={popupInputs[popup.key] || ""}
              onInputChange={(value) => handleInputChange(popup.key, value)}
              onDraftConverted={(newPopup) => {
                setOpenPopups((prev) =>
                  prev.map((item) => (item.key === popup.key ? newPopup : item))
                );
                refetchRooms();
              }}
            />
          );
        })}

        {popupItems.map((popup) => {
          if (roomInfoOpenFor !== popup.key) return null;

          const targetUser =
            popup.type === "draft" ? usersById[Number(popup.targetUserId)] : null;
          const participants = targetUser ? [targetUser] : [];
          const room =
            popup.type === "room"
              ? mappedRooms.find((item) => Number(item.id) === Number(popup.roomId)) || null
              : null;

          return (
            <MessengerRoomInfo
              key={`info-${popup.key}`}
              open
              activeRoom={room}
              participants={participants}
              messages={[]}
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