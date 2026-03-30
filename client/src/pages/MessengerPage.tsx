import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getSocket } from "@/lib/socket";
import MessengerSidebar from "@/components/messenger/MessengerSidebar";
import MessengerChatWindow from "@/components/messenger/MessengerChatWindow";
import MessengerRoomInfo from "@/components/messenger/MessengerRoomInfo";
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
    avatar: user.avatarUrl || user.avatar || "",
    status: onlineUserIds.has(Number(user.id)) ? "online" : "offline",
  }));
}

export default function MessengerPage() {
  const { user } = useAuth();

  const socketRef = useRef<any>(null);
  const joinedRoomRef = useRef<number | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [liveMessages, setLiveMessages] = useState<MessengerMessage[] | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());
  const [typingUserIdsByRoom, setTypingUserIdsByRoom] = useState<Record<number, number[]>>({});
  const [previewImage, setPreviewImage] = useState<{
    open: boolean;
    url?: string;
    name?: string;
  }>({
    open: false,
  });

  const { data: userList = [], isLoading: usersLoading } =
    trpc.users.list.useQuery();

  const {
    data: roomRows = [],
    isLoading: roomsLoading,
    refetch: refetchRooms,
  } = trpc.messenger.myRooms.useQuery();

  const {
    data: messageRows = [],
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = trpc.messenger.messages.useQuery(
    { roomId: Number(selectedRoomId) },
    { enabled: !!selectedRoomId }
  );

  const {
    data: memberRows = [],
    isLoading: membersLoading,
    refetch: refetchMembers,
  } = trpc.messenger.members.useQuery(
    { roomId: Number(selectedRoomId) },
    { enabled: !!selectedRoomId }
  );

  const orgUsers = useMemo(
    () => normalizeUsers(userList as any[], onlineUserIds),
    [userList, onlineUserIds]
  );

  const fallbackUsersById = useMemo(() => getUsersById(), []);

  const usersById = useMemo(() => {
    const fromDb = orgUsers.reduce<Record<number, MessengerUser>>((acc, item) => {
      acc[Number(item.id)] = item;
      return acc;
    }, {});

    return {
      ...fallbackUsersById,
      ...fromDb,
    };
  }, [orgUsers, fallbackUsersById]);

  const mappedRooms = useMemo<MessengerRoom[]>(() => {
    return (roomRows as any[]).map((room: any) => {
      const roomType = room.roomType === "group" ? "group" : "direct";

      let roomName = room.title || "";

      if (!roomName) {
        if (roomType === "direct") {
          const otherName =
            room.otherUserName ||
            room.partnerName ||
            room.otherParticipantName ||
            "1:1 대화";

          roomName = otherName;
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
      };
    });
  }, [roomRows]);

  useEffect(() => {
    if (selectedRoomId) return;
    if (!mappedRooms.length) return;

    setSelectedRoomId(Number(mappedRooms[0].id));
  }, [mappedRooms, selectedRoomId]);

  const activeRoom = useMemo(
    () => mappedRooms.find((room) => Number(room.id) === Number(selectedRoomId)) ?? null,
    [mappedRooms, selectedRoomId]
  );

  const baseMessages = useMemo<MessengerMessage[]>(() => {
    return (messageRows as any[]).map((m: any) => ({
      id: Number(m.id),
      roomId: Number(m.roomId),
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
    }));
  }, [messageRows]);

  useEffect(() => {
    setLiveMessages(baseMessages);
  }, [baseMessages, selectedRoomId]);

  const currentMessages = liveMessages ?? baseMessages;

  const participants = useMemo<MessengerUser[]>(() => {
    return (memberRows as any[]).map((member: any) => ({
      id: Number(member.userId),
      name: member.name || member.username || "이름없음",
      position: member.positionName || roleToPosition(member.role),
      team: member.teamName || "미분류",
      avatar: member.avatarUrl || "",
      status: onlineUserIds.has(Number(member.userId)) ? "online" : "offline",
    }));
  }, [memberRows, onlineUserIds]);

  const lastReadByUserId = useMemo<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    (memberRows as any[]).forEach((member: any) => {
      map[Number(member.userId)] = Number(member.lastReadMessageId || 0);
    });
    return map;
  }, [memberRows]);

  const createDirectRoomMutation = trpc.messenger.directRoom.useMutation({
    onSuccess: async (res) => {
      if (res?.room?.id) {
        setSelectedRoomId(Number(res.room.id));
        await Promise.all([
          refetchRooms(),
          refetchMessages(),
          refetchMembers(),
        ]);
      }
    },
  });

  const sendMessageMutation = trpc.messenger.sendMessage.useMutation({
    onSuccess: async () => {
      setInput("");
      await Promise.all([
        refetchMessages(),
        refetchRooms(),
        refetchMembers(),
      ]);
    },
  });

  const addAttachmentMutation = trpc.messenger.addAttachment.useMutation();
  const markReadMutation = trpc.messenger.markRead.useMutation();

  useEffect(() => {
    if (!user?.id) return;

    const socket = getSocket();
    socketRef.current = socket;

    const handleConnect = () => {
      console.log("[socket connected]", socket.id);
    };

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

    const handleNewMessage = (message: any) => {
      if (!message) return;

      const normalized: MessengerMessage = {
        id: Number(message.id),
        roomId: Number(message.roomId),
        senderId: Number(message.senderId),
        type: message.messageType || "text",
        content: message.content || "",
        createdAt: message.createdAt
          ? new Date(message.createdAt).toLocaleTimeString("ko-KR", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        fileName: message.fileName || "",
        fileUrl: message.fileUrl || "",
      };

      if (Number(normalized.roomId) !== Number(selectedRoomId)) {
        refetchRooms();
        return;
      }

      setLiveMessages((prev) => {
        const safePrev = prev ?? [];
        const exists = safePrev.some((item) => Number(item.id) === Number(normalized.id));
        if (exists) return safePrev;
        return [...safePrev, normalized];
      });

      setTypingUserIdsByRoom((prev) => ({
        ...prev,
        [Number(normalized.roomId)]: [],
      }));

      refetchRooms();
    };

    const handleRoomListUpdate = async () => {
      await refetchRooms();
    };

    const handleReadUpdate = async (payload: any) => {
      if (Number(payload?.roomId) === Number(selectedRoomId)) {
        await refetchMembers();
      }
      await refetchRooms();
    };

    const handleTypingStart = (payload: any) => {
      const roomId = Number(payload?.roomId);
      const typingUserId = Number(payload?.userId);

      if (!roomId || !typingUserId) return;
      if (typingUserId === Number(user?.id)) return;

      setTypingUserIdsByRoom((prev) => {
        const current = prev[roomId] ?? [];
        if (current.includes(typingUserId)) return prev;

        return {
          ...prev,
          [roomId]: [...current, typingUserId],
        };
      });
    };

    const handleTypingStop = (payload: any) => {
      const roomId = Number(payload?.roomId);
      const typingUserId = Number(payload?.userId);

      if (!roomId || !typingUserId) return;

      setTypingUserIdsByRoom((prev) => {
        const current = prev[roomId] ?? [];
        return {
          ...prev,
          [roomId]: current.filter((id) => Number(id) !== typingUserId),
        };
      });
    };

    socket.on("connect", handleConnect);
    socket.on("online:users", handleOnlineUsers);
    socket.on("user:online", handleUserOnline);
    socket.on("user:offline", handleUserOffline);
    socket.on("message:new", handleNewMessage);
    socket.on("room:list:update", handleRoomListUpdate);
    socket.on("read:update", handleReadUpdate);
    socket.on("typing:start", handleTypingStart);
    socket.on("typing:stop", handleTypingStop);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("online:users", handleOnlineUsers);
      socket.off("user:online", handleUserOnline);
      socket.off("user:offline", handleUserOffline);
      socket.off("message:new", handleNewMessage);
      socket.off("room:list:update", handleRoomListUpdate);
      socket.off("read:update", handleReadUpdate);
      socket.off("typing:start", handleTypingStart);
      socket.off("typing:stop", handleTypingStop);
    };
  }, [user?.id, selectedRoomId, refetchRooms, refetchMembers]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    if (!selectedRoomId) return;

    if (joinedRoomRef.current && joinedRoomRef.current !== selectedRoomId) {
      socket.emit("room:leave", { roomId: joinedRoomRef.current });
    }

    socket.emit("room:join", { roomId: Number(selectedRoomId) });
    joinedRoomRef.current = Number(selectedRoomId);

    return () => {};
  }, [selectedRoomId]);

  useEffect(() => {
    if (!selectedRoomId) return;
    if (!currentMessages.length) return;

    const lastMessageId = Number(currentMessages[currentMessages.length - 1]?.id || 0);
    if (!lastMessageId) return;

    markReadMutation.mutate({
      roomId: Number(selectedRoomId),
      lastReadMessageId: lastMessageId,
    });

    const socket = socketRef.current;
    if (socket) {
      socket.emit("read:update", {
        roomId: Number(selectedRoomId),
        lastReadMessageId: lastMessageId,
      });
    }
  }, [selectedRoomId, currentMessages]);

  const handleSelectRoom = async (roomId: number) => {
    setSelectedRoomId(roomId);
    setLiveMessages(null);

    const row = (roomRows as any[]).find(
      (room: any) => Number(room.id) === Number(roomId)
    );

    await markReadMutation.mutateAsync({
      roomId: Number(roomId),
      lastReadMessageId: row?.lastMessageId ? Number(row.lastMessageId) : null,
    });

    await Promise.all([refetchRooms(), refetchMessages(), refetchMembers()]);
  };

  const handleOpenDirectChat = (targetUser: MessengerUser) => {
    const socket = socketRef.current;

    if (!socket) {
      createDirectRoomMutation.mutate({
        userId: Number(targetUser.id),
      });
      return;
    }

    socket.emit(
      "direct:create",
      { targetUserId: Number(targetUser.id) },
      async (res: any) => {
        if (res?.success && res?.roomId) {
          setSelectedRoomId(Number(res.roomId));
          setLiveMessages(null);
          await Promise.all([refetchRooms(), refetchMessages(), refetchMembers()]);
          return;
        }

        createDirectRoomMutation.mutate({
          userId: Number(targetUser.id),
        });
      }
    );
  };

  const handleSend = async () => {
    if (!activeRoom) return;

    const text = input.trim();
    if (!text) return;

    const socket = socketRef.current;

    if (socket) {
      socket.emit("message:send", {
        roomId: Number(activeRoom.id),
        content: text,
        messageType: "text",
      });
      socket.emit("typing:stop", {
        roomId: Number(activeRoom.id),
      });
      setInput("");
      return;
    }

    sendMessageMutation.mutate({
      roomId: Number(activeRoom.id),
      content: text,
      messageType: "text",
    });
  };

  const handleInputChange = (value: string) => {
    setInput(value);

    const socket = socketRef.current;
    if (!socket || !activeRoom) return;

    if (value.trim()) {
      socket.emit("typing:start", {
        roomId: Number(activeRoom.id),
      });

      if (typingTimeoutRef.current) {
        window.clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = window.setTimeout(() => {
        socket.emit("typing:stop", {
          roomId: Number(activeRoom.id),
        });
      }, 1200);
    } else {
      socket.emit("typing:stop", {
        roomId: Number(activeRoom.id),
      });
    }
  };

  const handleAttachFile = async (file: File) => {
    if (!activeRoom) return;

    const isImage = file.type.startsWith("image/");
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

    const socket = socketRef.current;

    if (socket) {
      socket.emit("message:send", {
        roomId: Number(activeRoom.id),
        content: isImage ? "[이미지]" : `[파일] ${fileName}`,
        messageType: isImage ? "image" : "file",
        fileUrl,
        fileName,
        fileType: file.type || undefined,
        fileSize: file.size,
      });
      return;
    }

    const sendRes = await sendMessageMutation.mutateAsync({
      roomId: Number(activeRoom.id),
      content: isImage ? "[이미지]" : `[파일] ${fileName}`,
      messageType: isImage ? "image" : "file",
    });

    if (!sendRes?.id) return;

    await addAttachmentMutation.mutateAsync({
      messageId: Number(sendRes.id),
      fileName,
      fileUrl,
      fileType: file.type || undefined,
      fileSize: file.size,
    });

    await Promise.all([refetchMessages(), refetchRooms()]);
  };

  const handleOpenImage = (url: string, name?: string) => {
    if (!url) return;
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

  const handleToggleNotifications = async () => {
    if (!activeRoom) return;

    const nextMuted = !!activeRoom.notificationsEnabled;

    const socket = socketRef.current;
    if (!socket) {
      alert("소켓이 연결되지 않았습니다.");
      return;
    }

    socket.emit(
      "room:mute",
      {
        roomId: Number(activeRoom.id),
        isMuted: nextMuted,
      },
      async (res: any) => {
        if (!res?.success) {
          alert(res?.message || "알림 설정 변경에 실패했습니다.");
          return;
        }

        await refetchRooms();
      }
    );
  };

  const handleLeaveRoom = async () => {
    if (!activeRoom) return;

    const ok = window.confirm("정말 이 채팅방에서 나가시겠습니까?");
    if (!ok) return;

    const socket = socketRef.current;
    if (!socket) {
      alert("소켓이 연결되지 않았습니다.");
      return;
    }

    socket.emit(
      "room:leave:confirm",
      {
        roomId: Number(activeRoom.id),
      },
      async (res: any) => {
        if (!res?.success) {
          alert(res?.message || "방 나가기에 실패했습니다.");
          return;
        }

        setSelectedRoomId(null);
        setLiveMessages(null);
        await refetchRooms();
      }
    );
  };

  const handleAddParticipant = () => {
    alert("대화 상대 추가 기능은 그룹방 멤버 추가 API 연결 후 활성화하면 됩니다.");
  };

  const typingUsers = useMemo(() => {
    if (!selectedRoomId) return [];
    const ids = typingUserIdsByRoom[Number(selectedRoomId)] ?? [];
    return ids
      .map((id) => usersById[Number(id)])
      .filter(Boolean);
  }, [selectedRoomId, typingUserIdsByRoom, usersById]);

  const isPageLoading = usersLoading || roomsLoading;
  const isRoomLoading = messagesLoading || membersLoading;

  return (
    <>
      <div className="h-[calc(100vh-120px)] overflow-hidden rounded-[28px] border bg-white shadow-sm">
        <div className="grid h-full grid-cols-1 xl:grid-cols-[340px_minmax(0,1fr)_320px]">
          <MessengerSidebar
            rooms={mappedRooms}
            activeRoomId={selectedRoomId}
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

          <div className="flex min-w-0 flex-col">
            {isPageLoading || (selectedRoomId && isRoomLoading && !liveMessages) ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                메신저 불러오는 중...
              </div>
            ) : (
              <MessengerChatWindow
                activeRoom={activeRoom}
                messages={currentMessages}
                usersById={usersById}
                currentUserId={user?.id ? Number(user.id) : null}
                input={input}
                onInputChange={handleInputChange}
                onSend={handleSend}
                onOpenImage={handleOpenImage}
                onAttachFile={handleAttachFile}
                participants={participants}
                lastReadByUserId={lastReadByUserId}
                typingUsers={typingUsers}
              />
            )}
          </div>

          <MessengerRoomInfo
            activeRoom={activeRoom}
            participants={participants}
            messages={currentMessages}
            onToggleNotifications={handleToggleNotifications}
            onLeaveRoom={handleLeaveRoom}
            onAddParticipant={handleAddParticipant}
          />
        </div>
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