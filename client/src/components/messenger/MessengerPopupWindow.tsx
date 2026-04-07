import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Minimize2,
  Maximize2,
  Paperclip,
  Search,
  X,
  Pin,
  PinOff,
  Send,
  Bell,
  BellOff,
  LogOut,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { normalizeAssetUrl } from "@/lib/normalizeAssetUrl";
import type {
  MessengerMessage,
  MessengerRoom,
  MessengerUser,
} from "@/components/messenger/mockMessengerData";

type PendingAttachment = {
  id: string;
  file: File;
  previewUrl?: string;
  isImage?: boolean;
  isVideo?: boolean;
};

type MessengerPopupWindowProps = {
  popupKey: string;
  room: MessengerRoom | null;
  onOpenRoomInfo?: () => void;
  targetUser?: MessengerUser | null;
  participants: MessengerUser[];
  messages: MessengerMessage[];
  usersById: Record<number, MessengerUser>;
  currentUserId: number | null;
  input: string;
  pendingAttachments: PendingAttachment[];
  onInputChange: (value: string) => void;
  onSend: () => void;
  onAttachFile: (file: File) => void;
  onRemovePendingAttachment: (id: string) => void;
  onOpenImage: (url: string, name?: string) => void;
  onClose: () => void;
  onMinimize?: () => void;
  onRestore?: () => void;
  onTogglePin?: () => void;
  onToggleMute?: () => void | Promise<void>;
  onLeaveRoom?: () => void | Promise<void>;
  pinned?: boolean;
  minimized?: boolean;
  rightOffset?: number;
  topOffset?: number;
  zIndex?: number;
  typingUserIds?: number[];
  roomMuted?: boolean;
  chatBackground?: string;
  onChangeBackground?: (value: string) => void;
  notificationEnabled?: boolean;
};

const ROOM_BG_KEY = "messenger-room-backgrounds";

function isVideoFile(url?: string, fileName?: string) {
  const target = `${url || ""} ${fileName || ""}`.toLowerCase();
  return [".mp4", ".webm", ".ogg", ".mov", "video/"].some((token) =>
    target.includes(token)
  );
}

function formatDateDividerLabel(raw: string) {
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function getMessageDateKey(message: MessengerMessage) {
  const source = String(message.createdAtRaw || message.createdAt || "");
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return source;
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getMessageTimestamp(message: MessengerMessage) {
  const source = String(message.createdAtRaw || message.createdAt || "");
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return 0;
  return date.getTime();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function highlightText(text: string, query: string) {
  if (!query.trim()) return text;
  const regex = new RegExp(`(${escapeRegExp(query)})`, "ig");
  const parts = text.split(regex);

  return parts.map((part, index) =>
    regex.test(part) ? (
      <mark
        key={`${part}-${index}`}
        className="rounded bg-yellow-200 px-0.5 text-slate-900"
      >
        {part}
      </mark>
    ) : (
      <span key={`${part}-${index}`}>{part}</span>
    )
  );
}

function readRoomBackground(roomId?: number | null) {
  if (!roomId) return "";
  try {
    const raw = localStorage.getItem(ROOM_BG_KEY);
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    return parsed?.[String(roomId)] || "";
  } catch {
    return "";
  }
}

function getSafeAvatarUrl(raw?: string) {
  return normalizeAssetUrl(raw || "");
}

function AvatarCircle({
  name,
  avatar,
  className = "",
}: {
  name?: string;
  avatar?: string;
  className?: string;
}) {
  const safeAvatar = getSafeAvatarUrl(avatar);

  return (
    <div
      className={`flex items-center justify-center overflow-hidden rounded-full bg-white text-sm font-semibold text-slate-700 ${className}`}
    >
      {safeAvatar ? (
        <img
          src={safeAvatar}
          alt={name || "user"}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{name?.slice(0, 1) || "?"}</span>
      )}
    </div>
  );
}

function getMessagePreviewTypeLabel(message: MessengerMessage) {
  if (message.type === "image") return "사진";
  if (message.type === "file") return "파일";
  return "";
}

function getFirstUnreadMessageId(
  messages: MessengerMessage[],
  currentUserId: number | null,
  participants: MessengerUser[]
) {
  if (!messages.length || !currentUserId) return null;

  const me = participants.find(
    (p) => Number(p.id) === Number(currentUserId)
  );

  const myLastReadMessageId = me?.lastReadMessageId
    ? Number(me.lastReadMessageId)
    : 0;

  const firstUnread = messages.find(
    (message) =>
      Number(message.senderId) !== Number(currentUserId) &&
      Number(message.id) > myLastReadMessageId
  );

  return firstUnread ? Number(firstUnread.id) : null;
}

export default function MessengerPopupWindow({
  room,
  onOpenRoomInfo,
  targetUser,
  participants,
  messages,
  usersById,
  currentUserId,
  input,
  pendingAttachments,
  onInputChange,
  onSend,
  onAttachFile,
  onRemovePendingAttachment,
  onOpenImage,
  onClose,
  onMinimize,
  onRestore,
  onTogglePin,
  onToggleMute,
  onLeaveRoom,
  pinned = false,
  minimized = false,
  rightOffset = 560,
  topOffset = 92,
  zIndex = 10010,
  typingUserIds = [],
  roomMuted = false,
  chatBackground,
  onChangeBackground,
  notificationEnabled,
}: MessengerPopupWindowProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState({
    right: rightOffset,
    top: topOffset,
  });
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [, setForceRender] = useState(0);
  const [activeSearchMessageId, setActiveSearchMessageId] = useState<number | null>(
    null
  );
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [hasInitializedScroll, setHasInitializedScroll] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [size, setSize] = useState(() => {
    try {
      const saved = localStorage.getItem("messenger-popup-size");
      if (!saved) return { width: 430, height: 700 };
      const parsed = JSON.parse(saved);
      return {
        width: Number(parsed?.width) || 430,
        height: Number(parsed?.height) || 700,
      };
    } catch {
      return { width: 430, height: 700 };
    }
  });

  const resizingRef = useRef(false);

  const otherParticipant =
    participants.find((p) => Number(p.id) !== Number(currentUserId)) ||
    participants[0] ||
    targetUser ||
    null;

  const title =
    room?.name || targetUser?.name || otherParticipant?.name || "새 대화";
  const titleAvatar =
    targetUser?.avatar ||
    otherParticipant?.avatar ||
    participants[0]?.avatar ||
    "";
  const titlePosition =
    targetUser?.position ||
    otherParticipant?.position ||
    participants[0]?.position ||
    "";

  const roomTypeText = room
    ? `${titlePosition ? `${titlePosition} · ` : ""}${
        room.type === "direct" ? "1:1 대화" : `참여자 ${participants.length}명`
      }`
    : `${titlePosition ? `${titlePosition} · ` : ""}1:1 대화`;

  const savedRoomBackground = useMemo(() => readRoomBackground(room?.id), [room?.id]);

  const effectiveRoomBackground = useMemo(() => {
    if (typeof chatBackground === "string") return chatBackground;
    return savedRoomBackground;
  }, [chatBackground, savedRoomBackground]);

  const typingNames = useMemo(() => {
    return typingUserIds
      .map((id) => usersById[Number(id)]?.name)
      .filter(Boolean) as string[];
  }, [typingUserIds, usersById]);

  const typingLabel = useMemo(() => {
    if (typingNames.length === 0) return "";
    if (typingNames.length === 1) return `${typingNames[0]}님이 입력 중...`;
    return `${typingNames[0]} 외 ${typingNames.length - 1}명이 입력 중...`;
  }, [typingNames]);

  useEffect(() => {
    setPosition({
      right: rightOffset,
      top: topOffset,
    });
  }, [rightOffset, topOffset]);

  useEffect(() => {
    setHasInitializedScroll(false);
    setIsNearBottom(true);
  }, [room?.id]);

  useEffect(() => {
    const handleBackgroundChange = () => {
      setForceRender((prev) => prev + 1);
    };

    window.addEventListener("messenger:bg-changed", handleBackgroundChange);

    return () => {
      window.removeEventListener(
        "messenger:bg-changed",
        handleBackgroundChange
      );
    };
  }, []);

  const safeMessages = useMemo(() => messages || [], [messages]);

  const searchMatchedMessageIds = useMemo(() => {
    if (!searchText.trim()) return [];
    const q = searchText.trim().toLowerCase();

    return safeMessages
      .filter((message) =>
        String(message.content || "").toLowerCase().includes(q)
      )
      .map((message) => Number(message.id));
  }, [safeMessages, searchText]);

  const getReadCountForMyMessage = (messageId: number) => {
    if (!room) return 0;

    const others = participants.filter(
      (p: any) => Number(p.id) !== Number(currentUserId)
    );

    if (others.length === 0) return 0;

    const unreadUsers = others.filter((p: any) => {
      const lastReadMessageId = p.lastReadMessageId
        ? Number(p.lastReadMessageId)
        : 0;

      return lastReadMessageId < Number(messageId);
    });

    return unreadUsers.length;
  };

  const timelineItems = useMemo(() => {
    const items: Array<
      | { kind: "date"; key: string; label: string }
      | {
          kind: "message";
          key: string;
          message: MessengerMessage;
          isMine: boolean;
          showAvatar: boolean;
          showName: boolean;
          compact: boolean;
          showMeta: boolean;
          showReadMeta: boolean;
          readCount: number;
        }
    > = [];

    let prevDateKey = "";

    safeMessages.forEach((message, index) => {
      const dateKey = getMessageDateKey(message);
      if (dateKey && dateKey !== prevDateKey) {
        items.push({
          kind: "date",
          key: `date-${dateKey}`,
          label: formatDateDividerLabel(dateKey),
        });
        prevDateKey = dateKey;
      }

      const prev = safeMessages[index - 1];
      const next = safeMessages[index + 1];

      const isMine = Number(message.senderId) === Number(currentUserId);
      const prevSameSender =
        prev && Number(prev.senderId) === Number(message.senderId);
      const nextSameSender =
        next && Number(next.senderId) === Number(message.senderId);

      const prevGap =
        prev && getMessageTimestamp(message) - getMessageTimestamp(prev);
      const nextGap =
        next && getMessageTimestamp(next) - getMessageTimestamp(message);

      const closeToPrev = typeof prevGap === "number" && prevGap < 5 * 60 * 1000;
      const closeToNext = typeof nextGap === "number" && nextGap < 5 * 60 * 1000;

      const sameFlowWithPrev =
        prev &&
        getMessageDateKey(prev) === getMessageDateKey(message) &&
        prevSameSender &&
        closeToPrev;

      const sameFlowWithNext =
        next &&
        getMessageDateKey(next) === getMessageDateKey(message) &&
        nextSameSender &&
        closeToNext;

      const readCount = isMine ? getReadCountForMyMessage(Number(message.id)) : 0;
      const showMeta = !sameFlowWithNext;
      const showReadMeta = isMine && showMeta && readCount > 0;

      items.push({
        kind: "message",
        key: `msg-${message.id}`,
        message,
        isMine,
        showAvatar: !isMine && !sameFlowWithPrev,
        showName: !isMine && !sameFlowWithPrev,
        compact: !!sameFlowWithPrev,
        showMeta,
        showReadMeta,
        readCount,
      });
    });

    return items;
  }, [safeMessages, currentUserId, participants, room]);

  const firstUnreadMessageId = useMemo(() => {
    return getFirstUnreadMessageId(
      safeMessages,
      currentUserId,
      participants
    );
  }, [safeMessages, currentUserId, participants]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    if (!hasInitializedScroll) {
      el.scrollTop = el.scrollHeight;
      setHasInitializedScroll(true);
      return;
    }

    const lastTimelineItem = timelineItems[timelineItems.length - 1];
    const isMyLatestMessage =
      lastTimelineItem &&
      lastTimelineItem.kind === "message" &&
      Number(lastTimelineItem.message.senderId) === Number(currentUserId);

    if (isNearBottom || isMyLatestMessage) {
      el.scrollTop = el.scrollHeight;
    }
  }, [
    timelineItems,
    pendingAttachments,
    typingLabel,
    isNearBottom,
    hasInitializedScroll,
    currentUserId,
  ]);

  useEffect(() => {
    if (!searchMatchedMessageIds.length) {
      setCurrentSearchIndex(0);
      setActiveSearchMessageId(null);
      return;
    }

    const safeIndex = Math.min(
      currentSearchIndex,
      searchMatchedMessageIds.length - 1
    );

    const targetId = searchMatchedMessageIds[safeIndex];
    setActiveSearchMessageId(Number(targetId));

    const element = messageRefs.current[String(targetId)];
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [searchMatchedMessageIds, currentSearchIndex]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleScroll = () => {
      setIsNearBottom(checkIsNearBottom());
    };

    el.addEventListener("scroll", handleScroll);
    handleScroll();

    return () => {
      el.removeEventListener("scroll", handleScroll);
    };
  }, [room?.id]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      setPosition((prev) => ({
        right: Math.max(16, window.innerWidth - e.clientX - 210),
        top: Math.max(72, e.clientY - 20),
      }));
    };

    const handleMouseUp = () => {
      setDragging(false);
    };

    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "none";
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
    };
  }, [dragging]);

  useEffect(() => {
    const handleResizeMove = (e: MouseEvent) => {
      if (!resizingRef.current || isFullscreen) return;

      const nextWidth = Math.max(360, window.innerWidth - e.clientX);
      const nextHeight = Math.max(420, e.clientY - position.top);

      const nextSize = {
        width: nextWidth,
        height: nextHeight,
      };

      setSize(nextSize);
      localStorage.setItem("messenger-popup-size", JSON.stringify(nextSize));
    };

    const handleResizeUp = () => {
      resizingRef.current = false;
    };

    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeUp);

    return () => {
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeUp);
    };
  }, [position.top, isFullscreen]);

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = Array.from(e.clipboardData.items || []);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;

    const file = imageItem.getAsFile();
    if (!file) return;

    e.preventDefault();
    onAttachFile(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    files.forEach((file) => onAttachFile(file));
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const checkIsNearBottom = () => {
    const el = scrollRef.current;
    if (!el) return true;

    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;

    return distanceFromBottom < 120;
  };

  if (minimized) {
    return (
      <button
        type="button"
        onClick={onRestore}
        className="fixed bottom-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left shadow-[0_10px_24px_rgba(15,23,42,0.12)] transition hover:bg-slate-50"
        style={{
          right: `${position.right}px`,
          zIndex,
          width: 220,
        }}
      >
        <div className="flex items-center gap-3">
          <AvatarCircle
            name={title}
            avatar={titleAvatar}
            className="h-10 w-10 shrink-0"
          />

          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">
              {title}
            </div>
            <div className="truncate text-xs text-slate-500">
              {roomTypeText}
            </div>
          </div>
        </div>
      </button>
    );
  }

  return (
    <div
      className="fixed overflow-hidden rounded-[22px] border border-slate-200 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.16)]"
      style={{
        right: isFullscreen ? 0 : `${position.right}px`,
        top: isFullscreen ? 0 : `${position.top}px`,
        width: isFullscreen ? "100vw" : `${size.width}px`,
        height: isFullscreen ? "calc(100vh - 64px)" : `${size.height}px`,
        zIndex,
        borderRadius: isFullscreen ? 0 : 22,
      }}
    >
      <div
        className="flex h-full flex-col"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div
          className="cursor-move border-b border-slate-200 bg-[#d9dde3]"
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            if (isFullscreen) return;
            setDragging(true);
          }}
        >
          <div className="flex h-16 items-center justify-between px-4">
            <div className="flex min-w-0 items-center gap-3">
              <AvatarCircle
                name={title}
                avatar={titleAvatar}
                className="h-10 w-10 shrink-0"
              />

              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-semibold text-slate-950">
                    {title}
                  </p>

                  {pinned ? (
                    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                      <Pin className="h-3 w-3" />
                    </span>
                  ) : null}

                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
                      roomMuted
                        ? "bg-slate-100 text-slate-500"
                        : "bg-emerald-50 text-emerald-600"
                    }`}
                  >
                    {roomMuted ? (
                      <BellOff className="h-3 w-3" />
                    ) : (
                      <Bell className="h-3 w-3" />
                    )}
                  </span>
                </div>

                <p className="truncate text-xs text-slate-600">{roomTypeText}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (!room?.id) return;
                  onOpenRoomInfo?.();
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700 transition hover:bg-slate-50"
                title="채팅방 설정"
              >
                <span className="text-sm">⚙️</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSearchOpen((prev) => {
                    const next = !prev;

                    if (!next) {
                      setSearchText("");
                      setCurrentSearchIndex(0);
                      setActiveSearchMessageId(null);
                    }

                    return next;
                  });
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700 transition hover:bg-slate-50"
                title="채팅 검색"
              >
                <Search className="h-4 w-4" />
              </button>

              {onTogglePin ? (
                <button
                  type="button"
                  onClick={onTogglePin}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${
                    pinned
                      ? "bg-[#ffdd00] text-slate-900"
                      : "bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  title={pinned ? "고정 해제" : "상단 고정"}
                >
                  {pinned ? (
                    <PinOff className="h-4 w-4" />
                  ) : (
                    <Pin className="h-4 w-4" />
                  )}
                </button>
              ) : null}

              {onToggleMute ? (
                <button
                  type="button"
                  onClick={onToggleMute}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl transition ${
                    roomMuted
                      ? "bg-slate-100 text-slate-700"
                      : "bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                  title={roomMuted ? "알림 켜기" : "알림 끄기"}
                >
                  {roomMuted ? (
                    <BellOff className="h-4 w-4" />
                  ) : (
                    <Bell className="h-4 w-4" />
                  )}
                </button>
              ) : null}

              {onLeaveRoom ? (
                <button
                  type="button"
                  onClick={onLeaveRoom}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700 transition hover:bg-red-50 hover:text-red-600"
                  title="방 나가기"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              ) : null}

              <button
                type="button"
                onClick={() => setIsFullscreen((prev) => !prev)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700 transition hover:bg-slate-50"
                title={isFullscreen ? "전체화면 해제" : "전체화면"}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </button>

              {!isFullscreen && (
                <button
                  type="button"
                  onClick={onMinimize}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700 transition hover:bg-slate-50"
                >
                  <Minimize2 className="h-4 w-4" />
                </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-slate-700 transition hover:bg-slate-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {searchOpen && (
            <div className="border-t border-slate-200 bg-[#f5f5f7] px-4 py-2">
              <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setCurrentSearchIndex(0);
                  }}
                  placeholder="채팅 검색"
                  className="h-10 flex-1 bg-transparent text-sm outline-none"
                />
                {searchMatchedMessageIds.length > 0 ? (
                  <span className="text-xs text-slate-500">
                    {currentSearchIndex + 1}/{searchMatchedMessageIds.length}
                  </span>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    if (!searchMatchedMessageIds.length) return;
                    setCurrentSearchIndex((prev) =>
                      prev <= 0 ? searchMatchedMessageIds.length - 1 : prev - 1
                    );
                  }}
                  className="text-xs text-slate-500"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!searchMatchedMessageIds.length) return;
                    setCurrentSearchIndex((prev) =>
                      prev >= searchMatchedMessageIds.length - 1 ? 0 : prev + 1
                    );
                  }}
                  className="text-xs text-slate-500"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchText("");
                    setSearchOpen(false);
                    setCurrentSearchIndex(0);
                    setActiveSearchMessageId(null);
                  }}
                  className="text-slate-500"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{
            backgroundColor: !effectiveRoomBackground ? "#b7c7d8" : undefined,
            backgroundImage: !effectiveRoomBackground
              ? undefined
              : effectiveRoomBackground.startsWith("linear-gradient") ||
                effectiveRoomBackground.startsWith("url(")
              ? effectiveRoomBackground
              : effectiveRoomBackground.startsWith("data:")
              ? `url(${effectiveRoomBackground})`
              : undefined,
            backgroundSize:
              effectiveRoomBackground &&
              !effectiveRoomBackground.startsWith("linear-gradient")
                ? "cover"
                : undefined,
            backgroundPosition:
              effectiveRoomBackground &&
              !effectiveRoomBackground.startsWith("linear-gradient")
                ? "center"
                : undefined,
            backgroundRepeat:
              effectiveRoomBackground &&
              !effectiveRoomBackground.startsWith("linear-gradient")
                ? "no-repeat"
                : undefined,
          }}
        >
          {timelineItems.length === 0 && pendingAttachments.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="rounded-2xl bg-white/85 px-4 py-3 text-sm text-slate-500 shadow-sm">
                메시지를 보내면 채팅이 시작됩니다.
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {timelineItems.map((item) => {
                if (item.kind === "date") {
                  return (
                    <div key={item.key} className="flex justify-center py-1">
                      <div className="rounded-full bg-slate-500/15 px-3 py-1 text-xs text-slate-700">
                        {item.label}
                      </div>
                    </div>
                  );
                }

                if (item.kind === "message" && item.message.type === "system") {
                  return (
                    <div key={item.key} className="flex justify-center py-1">
                      <div className="rounded-full bg-slate-500/15 px-3 py-1 text-xs text-slate-700">
                        {item.message.content}
                      </div>
                    </div>
                  );
                }

                if (item.kind !== "message") return null;

                const {
                  message,
                  isMine,
                  showAvatar,
                  showName,
                  compact,
                  showMeta,
                  showReadMeta,
                  readCount,
                } = item;

                const sender = usersById[Number(message.senderId)];
                const isMatched = searchMatchedMessageIds.includes(Number(message.id));
                const isCurrentMatched =
                  Number(activeSearchMessageId) === Number(message.id);

                const senderName =
                  sender?.name ||
                  targetUser?.name ||
                  otherParticipant?.name ||
                  "알수없음";
                const senderAvatar =
                  sender?.avatar ||
                  targetUser?.avatar ||
                  otherParticipant?.avatar ||
                  "";

                const bubbleClass = isMine
                  ? "rounded-2xl rounded-br-md bg-[#ffdd00] text-slate-900"
                  : "rounded-2xl rounded-bl-md bg-white text-slate-900";

                return (
                  <div key={item.key}>
                    {Number(firstUnreadMessageId) === Number(message.id) && (
                      <div className="flex justify-center py-2">
                        <div className="rounded-full bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-500 shadow-sm">
                          여기부터 읽지 않은 메시지
                        </div>
                      </div>
                    )}

                    <div
                      ref={(el) => {
                        messageRefs.current[String(message.id)] = el;
                      }}
                      className={`flex ${isMine ? "justify-end" : "justify-start"} ${
                        compact ? "mt-[-4px]" : ""
                      }`}
                    >
                      <div
                        className={`flex max-w-[82%] items-end gap-2 ${
                          isMine ? "flex-row-reverse" : "flex-row"
                        }`}
                      >
                        {!isMine ? (
                          showAvatar ? (
                            <AvatarCircle
                              name={senderName}
                              avatar={senderAvatar}
                              className="h-9 w-9 shrink-0 self-start shadow-sm"
                            />
                          ) : (
                            <div className="h-9 w-9 shrink-0" />
                          )
                        ) : null}

                        <div className="min-w-0">
                          {!isMine && showName && (
                            <div className="mb-1 px-1 text-xs font-medium text-slate-700">
                              {senderName}
                            </div>
                          )}

                          <div
                            className={`overflow-hidden px-4 py-3 text-sm leading-relaxed shadow-sm transition ${
                              bubbleClass
                            } ${
                              isCurrentMatched
                                ? "ring-2 ring-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.15)]"
                                : isMatched
                                ? "ring-1 ring-yellow-300"
                                : ""
                            }`}
                          >
                            {message.type === "text" && (
                              <span>
                                {highlightText(
                                  String(message.content || ""),
                                  searchText
                                )}
                              </span>
                            )}

                            {message.type === "image" && message.fileUrl && (
                              <>
                                <img
                                  src={message.fileUrl}
                                  alt={message.fileName || "image"}
                                  className="max-h-72 cursor-pointer rounded-xl object-cover"
                                  onClick={() =>
                                    onOpenImage(message.fileUrl!, message.fileName)
                                  }
                                />
                                <div className="mt-2 flex items-center gap-2">
                                  <span className="text-[11px] font-medium opacity-75">
                                    {getMessagePreviewTypeLabel(message)}
                                  </span>
                                  <a
                                    href={message.fileUrl}
                                    download
                                    className="inline-flex items-center gap-1 text-xs underline"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    다운로드
                                  </a>
                                </div>
                              </>
                            )}

                            {message.type === "file" && message.fileUrl && (
                              <>
                                {isVideoFile(message.fileUrl, message.fileName) ? (
                                  <video
                                    controls
                                    className="max-h-72 rounded-xl"
                                    src={message.fileUrl}
                                  />
                                ) : null}

                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-medium opacity-75">
                                    {getMessagePreviewTypeLabel(message)}
                                  </span>
                                  <a
                                    href={message.fileUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="font-medium underline"
                                  >
                                    {message.fileName || "파일 다운로드"}
                                  </a>
                                  <a
                                    href={message.fileUrl}
                                    download
                                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700"
                                  >
                                    <Download className="h-4 w-4" />
                                  </a>
                                </div>
                              </>
                            )}
                          </div>

                          {showMeta && (
                            <div
                              className={`mt-1 flex items-center gap-1 px-1 text-[11px] text-slate-500 ${
                                isMine ? "justify-end" : "justify-start"
                              }`}
                            >
                              {showReadMeta ? (
                                <span className="min-w-[10px] text-right font-semibold leading-none text-amber-600">
                                  {readCount}
                                </span>
                              ) : null}
                              <span>{message.createdAt}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {typingLabel ? (
                <div className="flex justify-start">
                  <div className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm">
                    {typingLabel}
                  </div>
                </div>
              ) : null}

              {pendingAttachments.length > 0 && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[#fff3a6] px-4 py-3 text-sm shadow-sm">
                    <div className="mb-2 text-xs font-semibold text-slate-700">
                      전송 대기 중
                    </div>
                    <div className="space-y-2">
                      {pendingAttachments.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-amber-200 bg-white/85 p-2"
                        >
                          {item.isImage && item.previewUrl ? (
                            <img
                              src={item.previewUrl}
                              alt={item.file.name}
                              className="max-h-32 rounded-lg object-cover"
                            />
                          ) : item.isVideo && item.previewUrl ? (
                            <video
                              controls
                              className="max-h-32 rounded-lg"
                              src={item.previewUrl}
                            />
                          ) : (
                            <div className="text-xs text-slate-700">
                              {item.file.name}
                            </div>
                          )}

                          <div className="mt-2 flex items-center justify-between gap-2">
                            <div className="truncate text-xs text-slate-600">
                              {item.file.name}
                            </div>
                            <button
                              type="button"
                              onClick={() => onRemovePendingAttachment(item.id)}
                              className="text-xs text-red-500"
                            >
                              제거
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 bg-[#f5f5f7] px-3 py-3">
          <div className="flex items-end gap-2">
            <label className="inline-flex shrink-0">
              <input
                type="file"
                className="hidden"
                accept="image/*,video/*,.pdf,.zip,.hwp,.hwpx,.doc,.docx,.xls,.xlsx,.txt"
                onChange={(e) => {
                  const files = Array.from(e.target.files || []);
                  files.forEach((file) => onAttachFile(file));
                  e.currentTarget.value = "";
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 rounded-2xl border-slate-200 bg-white hover:bg-slate-50"
                asChild
              >
                <span>
                  <Paperclip className="h-4 w-4" />
                </span>
              </Button>
            </label>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onPaste={handlePaste}
              placeholder="메시지를 입력하세요"
              className="max-h-36 min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.shiftKey) return;
                if (e.key === "Enter") {
                  e.preventDefault();
                  onSend();
                }
              }}
            />

            <Button
              type="button"
              onClick={onSend}
              className="h-11 rounded-2xl px-4 font-medium"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {!isFullscreen && (
          <div
            onMouseDown={(e) => {
              e.stopPropagation();
              resizingRef.current = true;
            }}
            className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize"
            title="크기 조절"
          >
            <div className="absolute bottom-1 right-1 h-2.5 w-2.5 rounded-sm border-b-2 border-r-2 border-slate-400" />
          </div>
        )}
      </div>
    </div>
  );
}