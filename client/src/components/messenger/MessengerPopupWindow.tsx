import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Minimize2,
  Paperclip,
  Search,
  Settings,
  X,
  Pin,
  PinOff,
  Send,
  MessageSquare,
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
  onToggleRoomInfo?: () => void;
  onTogglePin?: () => void;
  pinned?: boolean;
  minimized?: boolean;
  rightOffset?: number;
  topOffset?: number;
  zIndex?: number;
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

export default function MessengerPopupWindow({
  popupKey,
  room,
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
  onToggleRoomInfo,
  onTogglePin,
  pinned = false,
  minimized = false,
  rightOffset = 560,
  topOffset = 92,
  zIndex = 10010,
}: MessengerPopupWindowProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const dragRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState({
    right: rightOffset,
    top: topOffset,
  });
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);

  const title = room?.name || targetUser?.name || "새 대화";
  const titleAvatar =
    targetUser?.avatar ||
    participants[0]?.avatar ||
    usersById[Number(participants[0]?.id)]?.avatar ||
    "";

  const titlePosition =
    targetUser?.position ||
    participants.find((p) => Number(p.id) !== Number(currentUserId))?.position ||
    participants[0]?.position ||
    "";

  const roomTypeText = room
    ? `${titlePosition ? `${titlePosition} · ` : ""}${room.type === "direct" ? "1:1 대화" : `참여자 ${participants.length}명`}`
    : `${titlePosition ? `${titlePosition} · ` : ""}1:1 대화`;

  const roomBackground = useMemo(() => readRoomBackground(room?.id), [room?.id]);

  useEffect(() => {
    setPosition({
      right: rightOffset,
      top: topOffset,
    });
  }, [rightOffset, topOffset]);

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

  const timelineItems = useMemo(() => {
    const items: Array<
      | { kind: "date"; key: string; label: string }
      | { kind: "message"; key: string; message: MessengerMessage }
    > = [];

    let prevDateKey = "";

    safeMessages.forEach((message) => {
      const dateKey = getMessageDateKey(message);
      if (dateKey && dateKey !== prevDateKey) {
        items.push({
          kind: "date",
          key: `date-${dateKey}`,
          label: formatDateDividerLabel(dateKey),
        });
        prevDateKey = dateKey;
      }

      items.push({
        kind: "message",
        key: `msg-${message.id}`,
        message,
      });
    });

    return items;
  }, [safeMessages]);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [timelineItems, pendingAttachments]);

  useEffect(() => {
    if (!searchMatchedMessageIds.length) {
      setCurrentSearchIndex(0);
      return;
    }

    const targetId =
      searchMatchedMessageIds[
        Math.min(currentSearchIndex, searchMatchedMessageIds.length - 1)
      ];

    const element = messageRefs.current[String(targetId)];
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [searchMatchedMessageIds, currentSearchIndex]);

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

  const getReadCountForMyMessage = (messageId: number) => {
    if (!room) return 0;
    const others = participants.filter(
      (p) => Number(p.id) !== Number(currentUserId)
    );
    return others.length > 0 ? 1 : 0;
  };

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

  if (minimized) {
    return (
      <button
        type="button"
        onClick={onRestore}
        className="fixed bottom-4 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-left shadow-[0_10px_24px_rgba(15,23,42,0.18)] transition hover:bg-slate-50"
        style={{
          right: `${position.right}px`,
          zIndex,
          width: 220,
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
            {titleAvatar ? (
              <img
                src={titleAvatar}
                alt={title}
                className="h-full w-full object-cover"
              />
            ) : (
              <MessageSquare className="h-4 w-4" />
            )}
          </div>

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
      className="fixed h-[700px] w-[430px] overflow-hidden rounded-[18px] border border-slate-300 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.28)]"
      style={{
        right: `${position.right}px`,
        top: `${position.top}px`,
        zIndex,
      }}
    >
      <div
        ref={dragRef}
        className="flex h-full flex-col"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        <div
          className="cursor-move border-b border-slate-300 bg-[#bfd4e6]"
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            setDragging(true);
          }}
        >
          <div className="flex h-16 items-center justify-between px-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-white text-sm font-semibold text-slate-700">
                {titleAvatar ? (
                  <img
                    src={titleAvatar}
                    alt={title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span>{title?.slice(0, 1)}</span>
                )}
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">
                  {title}
                </p>
                <p className="truncate text-xs text-slate-600">{roomTypeText}</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setSearchOpen((prev) => !prev)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 transition hover:bg-white/70"
                title="채팅 검색"
              >
                <Search className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onToggleRoomInfo}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 transition hover:bg-white/70"
                title="설정"
              >
                <Settings className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onTogglePin}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 transition hover:bg-white/70"
                title={pinned ? "고정 해제" : "상단 고정"}
              >
                {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </button>

              <button
                type="button"
                onClick={onMinimize}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 transition hover:bg-white/70"
              >
                <Minimize2 className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 transition hover:bg-white/70"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {searchOpen && (
            <div className="border-t border-slate-300 bg-white px-4 py-2">
              <div className="flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3">
                <Search className="h-4 w-4 text-slate-500" />
                <input
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setCurrentSearchIndex(0);
                  }}
                  placeholder="통합검색"
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
          className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
          style={{
            backgroundColor: roomBackground ? undefined : "#b2c7da",
            backgroundImage: roomBackground ? `url(${roomBackground})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        >
          {timelineItems.length === 0 && pendingAttachments.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-slate-500 shadow-sm">
                메시지를 보내면 채팅방이 생성됩니다.
              </div>
            </div>
          ) : (
            <>
              {timelineItems.map((item) => {
                if (item.kind === "date") {
                  return (
                    <div key={item.key} className="flex justify-center">
                      <div className="rounded-full bg-slate-500/20 px-3 py-1 text-xs text-slate-700">
                        {item.label}
                      </div>
                    </div>
                  );
                }

                const message = item.message;
                const sender = usersById[Number(message.senderId)];
                const isMine = Number(message.senderId) === Number(currentUserId);
                const readCount = isMine ? getReadCountForMyMessage(Number(message.id)) : 0;
                const isMatched = searchMatchedMessageIds.includes(Number(message.id));
                const isCurrentMatched =
                  searchMatchedMessageIds[currentSearchIndex] === Number(message.id);

                return (
                  <div
                    key={item.key}
                    ref={(el) => {
                      messageRefs.current[String(message.id)] = el;
                    }}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`flex max-w-[80%] items-end gap-2 ${
                        isMine ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      {!isMine ? (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-sm font-semibold text-slate-700 shadow-sm">
                          {sender?.avatar ? (
                            <img
                              src={sender.avatar}
                              alt={sender?.name || "user"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span>{sender?.name?.slice(0, 1) || "?"}</span>
                          )}
                        </div>
                      ) : null}

                      <div className="min-w-0">
                        {!isMine && (
                          <div className="mb-1 px-1 text-xs font-medium text-slate-700">
                            {sender?.name || targetUser?.name || "알수없음"}
                          </div>
                        )}

                        <div
                          className={`overflow-hidden rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm transition ${
                            isMine
                              ? "rounded-br-md bg-[#ffeb59] text-slate-900"
                              : "rounded-bl-md bg-white text-slate-900"
                          } ${
                            isCurrentMatched
                              ? "ring-2 ring-blue-500"
                              : isMatched
                              ? "ring-1 ring-yellow-300"
                              : ""
                          }`}
                        >
                          {message.type === "text" && (
                            <span>{highlightText(String(message.content || ""), searchText)}</span>
                          )}

                          {message.type === "image" && message.fileUrl && (
                            <>
                              <img
                                src={message.fileUrl}
                                alt={message.fileName || "image"}
                                className="max-h-72 cursor-pointer rounded-xl object-cover"
                                onClick={() => onOpenImage(message.fileUrl!, message.fileName)}
                              />
                              <div className="mt-2 flex items-center gap-2">
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

                              <div className="mt-2 flex items-center gap-2">
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

                        <div
                          className={`mt-1 flex items-center gap-2 px-1 text-[11px] text-slate-500 ${
                            isMine ? "justify-end" : "justify-start"
                          }`}
                        >
                          <span>{message.createdAt}</span>
                          {isMine ? <span>{readCount > 0 ? `읽음 ${readCount}` : "전송됨"}</span> : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {pendingAttachments.length > 0 && (
                <div className="flex justify-end">
                  <div className="max-w-[80%] rounded-2xl rounded-br-md bg-[#fff8a6] px-4 py-3 text-sm shadow-sm">
                    <div className="mb-2 text-xs font-semibold text-slate-700">
                      전송 대기 중
                    </div>
                    <div className="space-y-2">
                      {pendingAttachments.map((item) => (
                        <div
                          key={item.id}
                          className="rounded-xl border border-amber-200 bg-white/80 p-2"
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
                            <div className="text-xs text-slate-700">{item.file.name}</div>
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
            </>
          )}
        </div>

        <div className="border-t border-slate-300 bg-[#f8fafc] px-3 py-3">
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
      </div>
    </div>
  );
}