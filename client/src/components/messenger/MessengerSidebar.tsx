import { useMemo, useState } from "react";
import {
  Building2,
  MessageSquare,
  MoreHorizontal,
  Search,
  Settings,
  Bell,
} from "lucide-react";

import { Input } from "@/components/ui/input";
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

type SidebarTab = "org" | "rooms" | "more";

export default function MessengerSidebar({
  rooms,
  activeRoomId,
  users,
  onSelectRoom,
  onOpenDirectChat,
}: MessengerSidebarProps) {
  const [tab, setTab] = useState<SidebarTab>("org");
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

  const totalUnreadCount = useMemo(() => {
    return rooms.reduce((sum, room) => sum + Number(room.unreadCount || 0), 0);
  }, [rooms]);

  return (
    <aside className="flex h-full min-h-0 border-r border-slate-300 bg-[#eef2f7]">
      <div className="flex w-[72px] shrink-0 flex-col items-center justify-between border-r border-slate-300 bg-[#e3e8ee] py-4">
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => setTab("org")}
            className={`relative inline-flex h-12 w-12 items-center justify-center rounded-2xl transition ${
              tab === "org"
                ? "bg-[#ffeb59] text-slate-900 shadow-sm"
                : "text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
            }`}
            title="조직도"
          >
            <Building2 className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => setTab("rooms")}
            className={`relative inline-flex h-12 w-12 items-center justify-center rounded-2xl transition ${
              tab === "rooms"
                ? "bg-[#ffeb59] text-slate-900 shadow-sm"
                : "text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
            }`}
            title="채팅"
          >
            <MessageSquare className="h-5 w-5" />
            {totalUnreadCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                {totalUnreadCount > 99 ? "99+" : totalUnreadCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setTab("more")}
            className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl transition ${
              tab === "more"
                ? "bg-[#ffeb59] text-slate-900 shadow-sm"
                : "text-slate-500 hover:bg-slate-200/70 hover:text-slate-900"
            }`}
            title="더보기"
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm">
            <Bell className="h-4 w-4" />
          </div>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-600 shadow-sm">
            <Settings className="h-4 w-4" />
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-l border-slate-300 bg-[#f6f8fb]">
        <div className="border-b border-slate-300 px-4 py-4">
          {tab === "org" && (
            <>
              <h2 className="text-lg font-semibold text-slate-950">조직도</h2>
              <p className="mt-1 text-xs text-slate-500">
                조직원을 더블클릭하면 1:1 채팅을 시작합니다.
              </p>
            </>
          )}

          {tab === "rooms" && (
            <>
              <h2 className="text-lg font-semibold text-slate-950">채팅</h2>
              <p className="mt-1 text-xs text-slate-500">
                최근 채팅방과 안읽은 메시지를 확인합니다.
              </p>
            </>
          )}

          {tab === "more" && (
            <>
              <h2 className="text-lg font-semibold text-slate-950">더보기</h2>
              <p className="mt-1 text-xs text-slate-500">
                알림과 환경설정을 확인합니다.
              </p>
            </>
          )}

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={
                tab === "rooms"
                  ? "채팅방 검색"
                  : tab === "org"
                  ? "이름 / 팀 / 직급 검색"
                  : "설정 검색"
              }
              className="h-11 rounded-2xl border-slate-300 bg-white pl-9 text-slate-900 placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f6f8fb]">
          {tab === "org" && (
            <MessengerOrgPanel
              users={filteredUsers}
              onOpenDirectChat={onOpenDirectChat}
            />
          )}

          {tab === "rooms" &&
            (filteredRooms.length === 0 ? (
              <div className="px-4 py-10 text-sm text-slate-500">
                표시할 채팅방이 없습니다.
              </div>
            ) : (
              <div className="px-3 py-3">
                <div className="space-y-2">
                  {filteredRooms.map((room) => {
                    const isActive = Number(room.id) === Number(activeRoomId);

                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => onSelectRoom(Number(room.id))}
                        className={`flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition ${
                          isActive
                            ? "bg-[#fef3c7] ring-1 ring-amber-200"
                            : "bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                          {String(room.name || "R").slice(0, 1)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-slate-950">
                              {room.name || "채팅방"}
                            </p>
                            <span className="shrink-0 pt-0.5 text-[11px] text-slate-400">
                              {room.updatedAt || ""}
                            </span>
                          </div>

                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p className="truncate text-sm text-slate-500">
                              {room.lastMessage || "대화를 시작해보세요."}
                            </p>

                            {Number(room.unreadCount || 0) > 0 ? (
                              <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
                                {room.unreadCount}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

          {tab === "more" && (
            <div className="space-y-3 px-4 py-4">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl border border-slate-300 bg-white px-4 py-4 text-left transition hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-950">알림 설정</p>
                  <p className="mt-1 text-xs text-slate-500">
                    메시지 알림과 표시 방식을 관리합니다.
                  </p>
                </div>
              </button>

              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl border border-slate-300 bg-white px-4 py-4 text-left transition hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-950">채팅 환경설정</p>
                  <p className="mt-1 text-xs text-slate-500">
                    기본 창 동작과 표시 옵션을 관리합니다.
                  </p>
                </div>
              </button>

              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl border border-slate-300 bg-white px-4 py-4 text-left transition hover:bg-slate-50"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-950">파일 / 이미지 관리</p>
                  <p className="mt-1 text-xs text-slate-500">
                    최근 첨부 내역과 표시 방식을 확인합니다.
                  </p>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}