import { useEffect, useMemo, useRef } from "react";
import { MoreHorizontal, Paperclip, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import type {
  MessengerRoom,
  MessengerMessage,
  MessengerUser,
} from "@/components/messenger/mockMessengerData";

type MessengerChatWindowProps = {
  activeRoom: MessengerRoom | null;
  messages: MessengerMessage[];
  usersById: Record<number, MessengerUser>;
  currentUserId: number | null;
  input: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onOpenImage: (url: string, name?: string) => void;
  onAttachFile: (file: File) => void;
  participants: MessengerUser[];
  lastReadByUserId: Record<number, number>;
  typingUsers: MessengerUser[];
  onOpenRoomInfo: () => void;
};

export default function MessengerChatWindow({
  activeRoom,
  messages,
  usersById,
  currentUserId,
  input,
  onInputChange,
  onSend,
  onOpenImage,
  onAttachFile,
  participants,
  lastReadByUserId,
  typingUsers,
  onOpenRoomInfo,
}: MessengerChatWindowProps) {
  const groupedMessages = useMemo(() => {
    return messages || [];
  }, [messages]);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [groupedMessages, activeRoom?.id, typingUsers]);

  if (!activeRoom) {
    return (
      <div className="flex h-full flex-col items-center justify-center bg-[#f7f8fa] px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#ffeb59] text-slate-900 shadow-sm">
          <Send className="h-6 w-6" />
        </div>
        <p className="mt-4 text-base font-semibold text-slate-900">
          채팅방을 선택하세요
        </p>
        <p className="mt-2 text-sm text-slate-500">
          조직도에서 조직원을 선택하거나 채팅 목록에서 대화를 열 수 있습니다.
        </p>
      </div>
    );
  }

  const getReadCountForMyMessage = (messageId: number) => {
    const others = participants.filter(
      (p) => Number(p.id) !== Number(currentUserId)
    );

    return others.filter((p) => {
      const lastReadId = Number(lastReadByUserId[Number(p.id)] || 0);
      return lastReadId >= Number(messageId);
    }).length;
  };

  return (
    <div className="flex h-full flex-col bg-[#b2c7da]">
      <div className="border-b border-slate-200 bg-[#f8fafc] px-5 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-slate-950">
              {activeRoom.name || "채팅방"}
            </p>
            <p className="mt-1 truncate text-xs text-slate-500">
              {activeRoom.type === "direct"
                ? "1:1 대화"
                : `참여자 ${participants.length}명`}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden text-xs text-slate-400 md:block">
              {activeRoom.updatedAt || ""}
            </div>

            <button
              type="button"
              onClick={onOpenRoomInfo}
              className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-50"
              aria-label="채팅방 정보 열기"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-5 py-5"
      >
        {groupedMessages.length === 0 ? (
          <div className="flex justify-center">
            <div className="rounded-2xl bg-white/80 px-4 py-2 text-sm text-slate-500 shadow-sm">
              아직 메시지가 없습니다.
            </div>
          </div>
        ) : (
          groupedMessages.map((message) => {
            const sender = usersById[Number(message.senderId)];
            const isMine = Number(message.senderId) === Number(currentUserId);
            const readCount = isMine ? getReadCountForMyMessage(Number(message.id)) : 0;

            return (
              <div
                key={message.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex max-w-[78%] items-end gap-2 ${
                    isMine ? "flex-row-reverse" : "flex-row"
                  }`}
                >
                  {!isMine ? (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-sm font-semibold text-slate-700 shadow-sm">
                      {sender?.avatar ? (
                        <img
                          src={sender.avatar}
                          alt={sender?.name || "user"}
                          className="h-full w-full rounded-full object-cover"
                        />
                      ) : (
                        <span>{sender?.name?.slice(0, 1) || "?"}</span>
                      )}
                    </div>
                  ) : null}

                  <div className="min-w-0">
                    {!isMine && (
                      <div className="mb-1 px-1 text-xs font-medium text-slate-700">
                        {sender?.name || "알수없음"}
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
                        <img
                          src={message.fileUrl}
                          alt={message.fileName || "image"}
                          className="max-h-72 cursor-pointer rounded-xl object-cover"
                          onClick={() => onOpenImage(message.fileUrl!, message.fileName)}
                        />
                      )}

                      {message.type === "file" && message.fileUrl && (
                        <a
                          href={message.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-medium underline"
                        >
                          {message.fileName || "파일 다운로드"}
                        </a>
                      )}

                      {message.type === "system" && (
                        <span className="text-slate-500">{message.content}</span>
                      )}
                    </div>

                    <div
                      className={`mt-1 flex items-center gap-2 px-1 text-[11px] text-slate-500 ${
                        isMine ? "justify-end" : "justify-start"
                      }`}
                    >
                      <span>{message.createdAt}</span>
                      {isMine ? (
                        <span>{readCount > 0 ? `읽음 ${readCount}` : "안읽음"}</span>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {typingUsers.length > 0 ? (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-white/80 px-4 py-2 text-xs text-slate-500 shadow-sm">
              {typingUsers.map((u) => u.name).join(", ")}님이 입력 중...
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-slate-200 bg-white px-4 py-4">
        <div className="flex items-center gap-2">
          <label className="inline-flex shrink-0">
            <input
              type="file"
              className="hidden"
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

          <Input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="메시지를 입력하세요"
            className="h-11 rounded-2xl border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
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
  );
}