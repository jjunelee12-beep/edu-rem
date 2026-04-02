import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Download,
  Minimize2,
  MoreHorizontal,
  Paperclip,
  Phone,
  Video,
  X,
  Pin,
  PinOff,
  Send,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import type {
  MessengerMessage,
  MessengerRoom,
  MessengerUser,
} from "@/components/messenger/mockMessengerData";

type MessengerPopupWindowProps = {
  popupKey: string;
  room: MessengerRoom | null;
  targetUser?: MessengerUser | null;
  participants: MessengerUser[];
  messages: MessengerMessage[];
  usersById: Record<number, MessengerUser>;
  currentUserId: number | null;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onAttachFile: (file: File) => void;
  onOpenImage: (url: string, name?: string) => void;
  onClose: () => void;
  onMinimize?: () => void;
  onToggleRoomInfo?: () => void;
  onTogglePin?: () => void;
  pinned?: boolean;
  rightOffset?: number;
  zIndex?: number;
};

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
  const date = new Date(String(message.createdAtRaw || message.createdAt || ""));
  if (Number.isNaN(date.getTime())) return String(message.createdAt || "");
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function MessengerPopupWindow({
  room,
  targetUser,
  participants,
  messages,
  usersById,
  currentUserId,
  input,
  onInputChange,
  onSend,
  onAttachFile,
  onOpenImage,
  onClose,
  onMinimize,
  onToggleRoomInfo,
  onTogglePin,
  pinned = false,
  rightOffset = 560,
  zIndex = 10010,
}: MessengerPopupWindowProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const title = room?.name || targetUser?.name || "새 대화";
  const titleAvatar =
    targetUser?.avatar ||
    participants[0]?.avatar ||
    usersById[Number(participants[0]?.id)]?.avatar ||
    "";

  const roomTypeText = room
    ? room.type === "direct"
      ? "1:1 대화"
      : `참여자 ${participants.length}명`
    : "새 1:1 대화";

  const safeMessages = useMemo(() => messages || [], [messages]);

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
  }, [timelineItems]);

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
    await onAttachFile(file);
  };

  return (
    <div
      className="fixed bottom-0 h-[700px] w-[430px] overflow-hidden rounded-t-[18px] border border-slate-300 bg-white shadow-[0_18px_45px_rgba(15,23,42,0.28)]"
      style={{ right: `${rightOffset}px`, zIndex }}
    >
      <div className="flex h-full flex-col">
        <div className="flex h-16 items-center justify-between border-b border-slate-200 bg-[#bfd4e6] px-4">
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
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 transition hover:bg-white/70"
            >
              <Phone className="h-4 w-4" />
            </button>

            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 transition hover:bg-white/70"
            >
              <Video className="h-4 w-4" />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((prev) => !prev)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-700 transition hover:bg-white/70"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-11 z-20 w-44 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onTogglePin?.();
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-900 transition hover:bg-slate-50"
                  >
                    {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                    {pinned ? "고정 해제" : "상단 고정"}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      onToggleRoomInfo?.();
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-slate-900 transition hover:bg-slate-50"
                  >
                    <Bell className="h-4 w-4" />
                    알림 / 정보
                  </button>
                </div>
              )}
            </div>

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

        <div
          ref={scrollRef}
          className="flex-1 space-y-4 overflow-y-auto bg-[#b2c7da] px-4 py-4"
        >
          {timelineItems.length === 0 ? (
            <div className="flex h-full items-center justify-center">
              <div className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-slate-500 shadow-sm">
                메시지를 보내면 채팅방이 생성됩니다.
              </div>
            </div>
          ) : (
            timelineItems.map((item) => {
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

              return (
                <div
                  key={item.key}
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
                        className={`overflow-hidden rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                          isMine
                            ? "rounded-br-md bg-[#ffeb59] text-slate-900"
                            : "rounded-bl-md bg-white text-slate-900"
                        }`}
                      >
                        {message.type === "text" && <span>{message.content}</span>}

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
                        {isMine ? <span>{readCount > 0 ? `읽음 ${readCount}` : ""}</span> : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-slate-200 bg-white px-3 py-3">
          <div className="flex items-end gap-2">
            <label className="inline-flex shrink-0">
              <input
                type="file"
                className="hidden"
                accept="image/*,video/*,.pdf,.zip,.hwp,.doc,.docx,.xls,.xlsx,.txt"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  onAttachFile(file);
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
              className="max-h-36 min-h-[44px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.shiftKey) {
                  return;
                }
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