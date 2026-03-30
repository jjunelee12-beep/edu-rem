import { useEffect, useMemo, useRef } from "react";
import { Send, Paperclip } from "lucide-react";

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
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        채팅방을 선택하세요.
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
    <div className="flex h-full flex-col">
      <div className="border-b px-4 py-3">
        <div className="text-sm font-semibold">
          {activeRoom.name || "채팅방"}
        </div>
        <div className="text-xs text-muted-foreground">
          {activeRoom.type === "direct" ? "1:1 대화" : "그룹 대화"}
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {groupedMessages.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground">
            아직 메시지가 없습니다.
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
                <div className="max-w-[70%] space-y-1">
                  {!isMine && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{sender?.name || "알수없음"}</span>
                      {sender?.status === "online" ? (
                        <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                      ) : (
                        <span className="inline-block h-2 w-2 rounded-full bg-gray-300" />
                      )}
                    </div>
                  )}

                  <div
                    className={`break-words rounded-xl px-3 py-2 text-sm ${
                      isMine
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {message.type === "text" && <span>{message.content}</span>}

                    {message.type === "image" && message.fileUrl && (
                      <img
                        src={message.fileUrl}
                        alt={message.fileName || "image"}
                        className="max-h-60 cursor-pointer rounded-md"
                        onClick={() => onOpenImage(message.fileUrl!, message.fileName)}
                      />
                    )}

                    {message.type === "file" && message.fileUrl && (
                      <a
                        href={message.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        {message.fileName || "파일 다운로드"}
                      </a>
                    )}
                  </div>

                  <div
                    className={`flex items-center gap-2 text-[11px] text-muted-foreground ${
                      isMine ? "justify-end" : "justify-start"
                    }`}
                  >
                    <span>{message.createdAt}</span>
                    {isMine ? (
                      <span>
                        {readCount > 0 ? `읽음 ${readCount}` : "안읽음"}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {typingUsers.length > 0 ? (
          <div className="text-xs text-muted-foreground">
            {typingUsers.map((u) => u.name).join(", ")}님이 입력 중...
          </div>
        ) : null}
      </div>

      <div className="border-t px-4 py-3">
        <div className="flex items-center gap-2">
          <label className="inline-flex">
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
            <Button type="button" variant="outline" size="icon" asChild>
              <span>
                <Paperclip className="h-4 w-4" />
              </span>
            </Button>
          </label>

          <Input
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="메시지를 입력하세요"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
          />

          <Button type="button" onClick={onSend}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}