import { useMemo, useState } from "react";
import { MessageSquare, Building2, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import MessengerOrgPanel from "@/components/messenger/MessengerOrgPanel";
import type {
  MessengerRoom,
  MessengerUser,
} from "@/components/messenger/mockMessengerData";

type MessengerSidebarProps = {
  rooms: MessengerRoom[];
  activeRoomId: number | null;
  users: MessengerUser[];
  onSelectRoom: (roomId: number) => void | Promise<void>;
  onOpenDirectChat: (user: MessengerUser) => void;
};

export default function MessengerSidebar({
  rooms,
  activeRoomId,
  users,
  onSelectRoom,
  onOpenDirectChat,
}: MessengerSidebarProps) {
  const [tab, setTab] = useState<"rooms" | "org">("rooms");
  const [search, setSearch] = useState("");

  const filteredRooms = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return rooms;

    return rooms.filter((room) => {
      return (
        String(room.name || "").toLowerCase().includes(keyword) ||
        String(room.lastMessage || "").toLowerCase().includes(keyword)
      );
    });
  }, [rooms, search]);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return users;

    return users.filter((user) => {
      return (
        String(user.name || "").toLowerCase().includes(keyword) ||
        String(user.position || "").toLowerCase().includes(keyword) ||
        String(user.team || "").toLowerCase().includes(keyword)
      );
    });
  }, [users, search]);

  return (
    <aside className="flex h-full min-h-0 flex-col border-r bg-white">
      <div className="border-b px-4 py-4">
        <h2 className="text-lg font-semibold">메신저</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          채팅 목록과 조직도를 확인할 수 있습니다.
        </p>

        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            variant={tab === "rooms" ? "default" : "outline"}
            className="flex-1 gap-2"
            onClick={() => setTab("rooms")}
          >
            <MessageSquare className="h-4 w-4" />
            채팅
          </Button>
          <Button
            type="button"
            variant={tab === "org" ? "default" : "outline"}
            className="flex-1 gap-2"
            onClick={() => setTab("org")}
          >
            <Building2 className="h-4 w-4" />
            조직도
          </Button>
        </div>

        <div className="relative mt-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === "rooms" ? "채팅 검색" : "이름/팀/직급 검색"}
            className="pl-9"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab === "rooms" ? (
          filteredRooms.length === 0 ? (
            <div className="px-4 py-8 text-sm text-muted-foreground">
              표시할 채팅방이 없습니다.
            </div>
          ) : (
            <div className="divide-y">
              {filteredRooms.map((room) => {
                const isActive = Number(room.id) === Number(activeRoomId);

                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => onSelectRoom(Number(room.id))}
                    className={`flex w-full items-start gap-3 px-4 py-4 text-left transition ${
                      isActive ? "bg-muted/60" : "hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                      {String(room.name || "R").slice(0, 1)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate font-medium">{room.name || "채팅방"}</p>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {room.updatedAt || ""}
                        </span>
                      </div>

                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="truncate text-sm text-muted-foreground">
                          {room.lastMessage || "대화를 시작해보세요."}
                        </p>

                        {Number(room.unreadCount || 0) > 0 ? (
                          <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-semibold text-primary-foreground">
                            {room.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          <MessengerOrgPanel
            users={filteredUsers}
            onOpenDirectChat={onOpenDirectChat}
          />
        )}
      </div>
    </aside>
  );
}