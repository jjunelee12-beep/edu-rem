import { useMemo } from "react";
import { Bell, UserPlus, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";

import type {
  MessengerRoom,
  MessengerMessage,
  MessengerUser,
} from "@/components/messenger/mockMessengerData";

type MessengerRoomInfoProps = {
  activeRoom: MessengerRoom | null;
  participants: MessengerUser[];
  messages: MessengerMessage[];
  onToggleNotifications: () => void;
  onLeaveRoom: () => void;
  onAddParticipant: () => void;
};

export default function MessengerRoomInfo({
  activeRoom,
  participants,
  messages,
  onToggleNotifications,
  onLeaveRoom,
  onAddParticipant,
}: MessengerRoomInfoProps) {
  const imageMessages = useMemo(() => {
    return messages.filter(
      (m) => m.type === "image" && m.fileUrl
    );
  }, [messages]);

  const fileMessages = useMemo(() => {
    return messages.filter(
      (m) => m.type === "file" && m.fileUrl
    );
  }, [messages]);

  if (!activeRoom) {
    return (
      <aside className="hidden xl:flex h-full flex-col border-l bg-white">
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          채팅방 정보
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden xl:flex h-full flex-col border-l bg-white">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {/* 제목 */}
        <div>
          <div className="text-sm font-semibold">
            {activeRoom.name}
          </div>
          <div className="text-xs text-muted-foreground">
            {activeRoom.type === "direct" ? "1:1 채팅" : "그룹 채팅"}
          </div>
        </div>

        {/* 참여자 */}
        <div>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">
            참여자
          </div>

          <div className="space-y-2">
            {participants.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                  {p.name?.slice(0, 1)}
                </div>
                <div>
                  <div className="text-sm">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {p.position} / {p.team}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 사진 */}
        <div>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">
            사진
          </div>

          {imageMessages.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              사진 없음
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {imageMessages.slice(-9).map((img) => (
                <img
                  key={img.id}
                  src={img.fileUrl}
                  alt="img"
                  className="h-20 w-full object-cover rounded-md"
                />
              ))}
            </div>
          )}
        </div>

        {/* 파일 */}
        <div>
          <div className="mb-2 text-xs font-semibold text-muted-foreground">
            첨부파일
          </div>

          {fileMessages.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              파일 없음
            </div>
          ) : (
            <div className="space-y-2">
              {fileMessages.slice(-10).map((file) => (
                <a
                  key={file.id}
                  href={file.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="block text-sm text-blue-600 underline"
                >
                  {file.fileName || "파일"}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 하단 버튼 */}
      <div className="border-t p-4 space-y-2">
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={onToggleNotifications}
        >
          <Bell className="h-4 w-4" />
          알림 설정
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={onAddParticipant}
        >
          <UserPlus className="h-4 w-4" />
          대화상대 추가
        </Button>

        <Button
          variant="destructive"
          className="w-full justify-start gap-2"
          onClick={onLeaveRoom}
        >
          <LogOut className="h-4 w-4" />
          방 나가기
        </Button>
      </div>
    </aside>
  );
}