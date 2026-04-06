import { useMemo, useState } from "react";
import {
  Building2,
  MessageSquare,
  Search,
  Settings,
  Bell,
  ChevronRight,
  Image as ImageIcon,
  Paperclip,
  PencilLine,
  Pin,
  BellOff,
  LogOut,
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
  currentUser?: MessengerUser | null;
  typingRoomIds?: number[];
  pinnedRoomIds?: number[];
  onSelectRoom: (roomId: number) => void | Promise<void>;
  onOpenDirectChat: (user: MessengerUser) => void;
  onTogglePinRoom: (roomId: number) => void;
  onToggleMuteRoom: (roomId: number, isMuted: boolean) => void | Promise<void>;
  onLeaveRoom: (roomId: number) => void | Promise<void>;
};

type SidebarTab = "org" | "rooms" | "notificationSettings" | "chatSettings";

function formatRoomTimeLabel(value?: string) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const now = new Date();

  const isSameDay =
    now.getFullYear() === date.getFullYear() &&
    now.getMonth() === date.getMonth() &&
    now.getDate() === date.getDate();

  if (isSameDay) {
    return date.toLocaleTimeString("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return "어제";
  if (diffDays < 7) {
    return ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  }

  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getLastMessagePreview(value?: string) {
  const text = String(value || "").trim();
  if (!text) return "대화를 시작해보세요.";
  if (text === "[이미지]") return "사진";
  if (text.startsWith("[파일]")) return text.replace("[파일]", "").trim() || "파일";
  return text;
}

function getLastMessageIcon(value?: string) {
  const text = String(value || "").trim();
  if (text === "[이미지]") return ImageIcon;
  if (text.startsWith("[파일]")) return Paperclip;
  return null;
}

export default function MessengerSidebar({
  rooms,
  activeRoomId,
  users,
  currentUser,
  typingRoomIds = [],
  pinnedRoomIds = [],
  onSelectRoom,
  onOpenDirectChat,
  onTogglePinRoom,
  onToggleMuteRoom,
  onLeaveRoom,
}: MessengerSidebarProps) {
  const [tab, setTab] = useState<SidebarTab>("org");
  const [search, setSearch] = useState("");
  const [hoveredRoomId, setHoveredRoomId] = useState<number | null>(null);

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

  const typingRoomIdSet = useMemo(() => {
    return new Set((typingRoomIds || []).map((id) => Number(id)));
  }, [typingRoomIds]);

  const pinnedRoomIdSet = useMemo(() => {
    return new Set((pinnedRoomIds || []).map((id) => Number(id)));
  }, [pinnedRoomIds]);

  const showSearch = tab === "org" || tab === "rooms";

  return (
    <aside className="flex h-full min-h-0 border-r border-black/5 bg-[#f4f5f8]">
      <div className="flex w-[72px] shrink-0 flex-col items-center justify-between border-r border-black/5 bg-[#dfe3e8] py-4">
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => setTab("org")}
            className={`relative inline-flex h-12 w-12 items-center justify-center rounded-2xl transition ${
              tab === "org"
                ? "bg-[#ffdd00] text-black shadow-[0_8px_20px_rgba(15,23,42,0.12)]"
                : "bg-white text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] hover:bg-white hover:text-black"
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
                ? "bg-[#ffdd00] text-black shadow-[0_8px_20px_rgba(15,23,42,0.12)]"
                : "bg-white text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] hover:bg-white hover:text-black"
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
        </div>

        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={() => setTab("notificationSettings")}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl transition ${
              tab === "notificationSettings"
                ? "bg-[#ffdd00] text-black shadow-[0_8px_20px_rgba(15,23,42,0.12)]"
                : "bg-white text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] hover:bg-white hover:text-black"
            }`}
            title="알림 설정"
          >
            <Bell className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setTab("chatSettings")}
            className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl transition ${
              tab === "chatSettings"
                ? "bg-[#ffdd00] text-black shadow-[0_8px_20px_rgba(15,23,42,0.12)]"
                : "bg-white text-slate-700 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] hover:bg-white hover:text-black"
            }`}
            title="채팅 환경설정"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[#f7f8fb]">
        <div className="border-b border-black/5 bg-[#f7f8fb] px-4 py-4">
          {currentUser && (
            <div className="mb-4 rounded-2xl bg-white px-3 py-3 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                  {currentUser.avatar ? (
                    <img
                      src={currentUser.avatar}
                      alt={currentUser.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{currentUser.name?.slice(0, 1) || "?"}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-black">
                    {currentUser.name}
                  </p>
                  <p className="truncate text-xs text-slate-600">
                    {currentUser.position || "직급 미지정"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === "rooms" && (
            <>
              <h2 className="text-lg font-semibold tracking-tight text-black">
                채팅
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                최근 채팅방과 안읽은 메시지를 확인합니다.
              </p>
            </>
          )}

          {tab === "org" && (
            <>
              <h2 className="text-lg font-semibold tracking-tight text-black">
                조직도
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                조직원을 더블클릭하면 1:1 채팅을 시작합니다.
              </p>
            </>
          )}

          {tab === "notificationSettings" && (
            <>
              <h2 className="text-lg font-semibold tracking-tight text-black">
                알림 설정
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                메신저 알림 표시 방식을 설정합니다.
              </p>
            </>
          )}

          {tab === "chatSettings" && (
            <>
              <h2 className="text-lg font-semibold tracking-tight text-black">
                채팅 환경설정
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                채팅창 기본 동작과 표시 옵션을 설정합니다.
              </p>
            </>
          )}

          {showSearch && (
            <div className="relative mt-4">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  tab === "rooms" ? "채팅방 검색" : "이름 / 팀 / 직급 검색"
                }
                className="h-11 rounded-2xl border-0 bg-white pl-9 text-sm text-black placeholder:text-slate-400 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08)] focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-[#f7f8fb]">
          {tab === "org" && (
            <MessengerOrgPanel
              users={filteredUsers}
              currentUser={currentUser}
              onOpenDirectChat={onOpenDirectChat}
            />
          )}

          {tab === "rooms" &&
            (filteredRooms.length === 0 ? (
              <div className="px-4 py-10 text-sm text-slate-600">
                표시할 채팅방이 없습니다.
              </div>
            ) : (
              <div className="px-3 py-3">
                <div className="space-y-2">
                  {filteredRooms.map((room) => {
                    const roomId = Number(room.id);
                    const isActive = roomId === Number(activeRoomId);
                    const isTyping = typingRoomIdSet.has(roomId);
                    const isPinned = pinnedRoomIdSet.has(roomId);
                    const isMuted = room.notificationsEnabled === false;
                    const showQuickActions =
                      hoveredRoomId === roomId || isActive;

                    const PreviewIcon = getLastMessageIcon(room.lastMessage);
                    const previewText = getLastMessagePreview(room.lastMessage);
                    const timeLabel = formatRoomTimeLabel(room.updatedAt);

                    return (
                      <div
                        key={room.id}
                        onMouseEnter={() => setHoveredRoomId(roomId)}
                        onMouseLeave={() => setHoveredRoomId((prev) => (prev === roomId ? null : prev))}
                        className={`group relative rounded-2xl border transition ${
                          isActive
                            ? "border-yellow-300 bg-[#fff5b8] shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
                            : "border-black/8 bg-white shadow-[0_4px_12px_rgba(15,23,42,0.04)] hover:bg-white hover:shadow-[0_8px_18px_rgba(15,23,42,0.06)]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onSelectRoom(roomId)}
                          className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left"
                        >
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
  {(room as any).avatar ? (
    <img
      src={String((room as any).avatar)}
      alt={room.name || "채팅방"}
      className="h-full w-full object-cover"
    />
  ) : (
    <span>{String(room.name || "R").slice(0, 1)}</span>
  )}
</div>

                          <div className="min-w-0 flex-1 pr-16">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <p className="truncate text-sm font-semibold text-black">
                                  {room.name || "채팅방"}
                                </p>

                                {isPinned ? (
                                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                                    <Pin className="h-3 w-3" />
                                  </span>
                                ) : null}

                                {isMuted ? (
                                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                    <BellOff className="h-3 w-3" />
                                  </span>
                                ) : null}
                              </div>

                              <span className="shrink-0 pt-0.5 text-[11px] text-slate-500">
                                {timeLabel}
                              </span>
                            </div>

                            <div className="mt-1 flex items-center justify-between gap-2">
                              {isTyping ? (
                                <div className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-emerald-600">
                                  <PencilLine className="h-3.5 w-3.5 shrink-0" />
                                  <p className="truncate">입력 중...</p>
                                </div>
                              ) : (
                                <div className="flex min-w-0 items-center gap-1.5 text-sm text-slate-600">
                                  {PreviewIcon ? (
                                    <PreviewIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                  ) : null}
                                  <p className="truncate">{previewText}</p>
                                </div>
                              )}

                              {Number(room.unreadCount || 0) > 0 ? (
                                <span className="inline-flex min-w-[22px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[11px] font-bold text-white">
                                  {room.unreadCount}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </button>

                        {showQuickActions ? (
                          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-xl bg-white/95 px-1 py-1 shadow-[0_6px_18px_rgba(15,23,42,0.08)] backdrop-blur-sm">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onTogglePinRoom(roomId);
                              }}
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition ${
                                isPinned
                                  ? "bg-amber-50 text-amber-600"
                                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              }`}
                              title={isPinned ? "고정 해제" : "상단 고정"}
                            >
                              <Pin className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await onToggleMuteRoom(roomId, !isMuted);
                              }}
                              className={`inline-flex h-7 w-7 items-center justify-center rounded-lg transition ${
                                isMuted
                                  ? "bg-slate-100 text-slate-700"
                                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              }`}
                              title={isMuted ? "알림 켜기" : "알림 끄기"}
                            >
                              <BellOff className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await onLeaveRoom(roomId);
                              }}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                              title="방 나가기"
                            >
                              <LogOut className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

          {tab === "notificationSettings" && (
            <div className="space-y-3 px-4 py-4">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-4 text-left transition shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] hover:bg-white hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07),0_8px_18px_rgba(15,23,42,0.05)]"
              >
                <div>
                  <p className="text-sm font-semibold text-black">
                    브라우저 알림
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    새 메시지 도착 시 브라우저 알림을 표시합니다.
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>

              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-4 text-left transition shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] hover:bg-white hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07),0_8px_18px_rgba(15,23,42,0.05)]"
              >
                <div>
                  <p className="text-sm font-semibold text-black">
                    안읽은 메시지 표시
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    채팅 목록과 뱃지에 안읽은 개수를 표시합니다.
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          )}

          {tab === "chatSettings" && (
            <div className="space-y-3 px-4 py-4">
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-2xl bg-white px-4 py-4 text-left transition shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] hover:bg-white hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07),0_8px_18px_rgba(15,23,42,0.05)]"
              >
                <div>
                  <p className="text-sm font-semibold text-black">
                    Enter 전송
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Enter로 전송하고 Shift + Enter로 줄바꿈합니다.
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}