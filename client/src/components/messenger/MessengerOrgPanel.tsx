import { useMemo, useState } from "react";
import { X, MessageSquare } from "lucide-react";
import { normalizeAssetUrl } from "@/lib/normalizeAssetUrl";
import type { MessengerUser } from "@/components/messenger/mockMessengerData";

type MessengerOrgPanelProps = {
  users: MessengerUser[];
  currentUser?: MessengerUser | null;
  onOpenDirectChat: (user: MessengerUser) => void;
};

function ProfileAvatar({
  name,
  avatar,
  online,
  size = "md",
}: {
  name?: string;
  avatar?: string;
  online?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg"
      ? "h-20 w-20 text-xl"
      : size === "sm"
      ? "h-10 w-10 text-sm"
      : "h-12 w-12 text-sm";

  const dotClass =
    size === "lg" ? "h-3.5 w-3.5 bottom-1 right-1" : "h-3 w-3 bottom-0 right-0";

  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden rounded-full bg-slate-100 font-semibold text-slate-700 ${sizeClass}`}
    >
      {avatar ? (
        <img
          src={normalizeAssetUrl(avatar)}
          alt={name}
          className="h-full w-full object-cover"
        />
      ) : (
        <span>{name?.slice(0, 1) || "?"}</span>
      )}

      <span
        className={`absolute rounded-full border-2 border-white ${
          online ? "bg-green-500" : "bg-slate-300"
        } ${dotClass}`}
      />
    </div>
  );
}

export default function MessengerOrgPanel({
  users,
  currentUser,
  onOpenDirectChat,
}: MessengerOrgPanelProps) {
  const [selectedUser, setSelectedUser] = useState<MessengerUser | null>(null);

  const groupedUsers = useMemo(() => {
    const sourceUsers = [...(users || [])];

    if (
      currentUser &&
      !sourceUsers.some((item) => Number(item.id) === Number(currentUser.id))
    ) {
      sourceUsers.unshift(currentUser);
    }

    const map: Record<string, MessengerUser[]> = {};

    sourceUsers.forEach((user) => {
      const team = user.team || "미분류";
      if (!map[team]) map[team] = [];
      map[team].push(user);
    });

    Object.keys(map).forEach((team) => {
      map[team] = [...map[team]].sort((a, b) => {
        if (currentUser) {
          if (Number(a.id) === Number(currentUser.id)) return -1;
          if (Number(b.id) === Number(currentUser.id)) return 1;
        }

        const pos = String(a.position || "").localeCompare(
          String(b.position || "")
        );
        if (pos !== 0) return pos;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
    });

    return map;
  }, [users, currentUser]);

  const sortedTeams = useMemo(() => {
    return Object.keys(groupedUsers).sort((a, b) => a.localeCompare(b));
  }, [groupedUsers]);

  const handleOpenChat = (user: MessengerUser) => {
    setSelectedUser(null);
    onOpenDirectChat(user);
  };

  return (
    <div className="px-3 py-3">
      {currentUser && (
        <div className="mb-4 rounded-2xl bg-white px-4 py-4 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">
          <div className="mb-2 text-xs font-semibold tracking-[0.02em] text-slate-600">
            내 프로필
          </div>

          <div className="flex items-center gap-3">
            <ProfileAvatar
              name={currentUser.name}
              avatar={currentUser.avatar}
              online
              size="md"
            />

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-black">
                {currentUser.name}
              </div>
              <div className="mt-0.5 truncate text-xs text-slate-600">
                {currentUser.position || "직급 미지정"}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-slate-500">
                {currentUser.team || "미분류"}
              </div>
            </div>
          </div>
        </div>
      )}

      {sortedTeams.length === 0 ? (
        <div className="rounded-2xl bg-white px-4 py-6 text-sm text-slate-600 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)]">
          표시할 조직원이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_250px]">
          {/* 좌측 조직도 리스트 */}
          <div className="space-y-4">
            {sortedTeams.map((teamName) => {
              const members = groupedUsers[teamName] || [];

              return (
                <div key={teamName}>
                  <div className="mb-2 px-2 text-xs font-semibold tracking-[0.02em] text-slate-600">
                    {teamName}
                  </div>

                  <div className="space-y-2">
                    {members.map((member) => {
                      const isOnline = member.status === "online";
                      const isMe =
                        currentUser &&
                        Number(member.id) === Number(currentUser.id);
                      const isSelected =
                        selectedUser &&
                        Number(member.id) === Number(selectedUser.id);

                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => setSelectedUser(member)}
                          onDoubleClick={() => handleOpenChat(member)}
                          className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                            isSelected
                              ? "bg-[#fff6c7] shadow-[inset_0_0_0_1px_rgba(250,204,21,0.45),0_8px_18px_rgba(15,23,42,0.05)]"
                              : "bg-white shadow-[inset_0_0_0_1px_rgba(15,23,42,0.06)] hover:bg-white hover:shadow-[inset_0_0_0_1px_rgba(15,23,42,0.07),0_8px_18px_rgba(15,23,42,0.05)]"
                          }`}
                          title={
                            isMe
                              ? "내 프로필"
                              : "한 번 클릭하면 프로필 보기, 더블클릭하면 바로 채팅"
                          }
                        >
                          <ProfileAvatar
                            name={member.name}
                            avatar={member.avatar}
                            online={isOnline}
                            size="sm"
                          />

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <div className="truncate text-sm font-semibold text-black">
                                {member.name}
                              </div>
                              {isMe && (
                                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                  나
                                </span>
                              )}
                            </div>

                            <div className="mt-0.5 truncate text-xs text-slate-600">
                              {member.position || "직급 미지정"}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* 우측 플로팅 스타일 프로필 카드 */}
          <div className="xl:sticky xl:top-3 xl:self-start">
            {selectedUser ? (
              <div className="overflow-hidden rounded-[26px] bg-white shadow-[0_18px_40px_rgba(15,23,42,0.10),inset_0_0_0_1px_rgba(15,23,42,0.06)]">
                <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-5">
                  <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                    <ProfileAvatar
                      name={selectedUser.name}
                      avatar={selectedUser.avatar}
                      online={selectedUser.status === "online"}
                      size="lg"
                    />

                    <div className="mt-4 w-full">
                      <div className="truncate text-lg font-bold text-slate-950">
                        {selectedUser.name}
                      </div>
                      <div className="mt-1 truncate text-sm font-medium text-slate-700">
                        {selectedUser.position || "직급 미지정"}
                      </div>
                      <div className="mt-1 truncate text-sm text-slate-500">
                        {selectedUser.team || "미분류"}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSelectedUser(null)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                    aria-label="닫기"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="px-5 pb-5">
                  <button
                    type="button"
                    onClick={() => handleOpenChat(selectedUser)}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[#ffdd00] px-4 text-sm font-semibold text-slate-900 transition hover:brightness-[0.98]"
                  >
                    <MessageSquare className="h-4 w-4" />
                    업무 대화 열기
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-[24px] bg-white/70 px-5 py-8 text-center shadow-[inset_0_0_0_1px_rgba(15,23,42,0.05)]">
                <div className="text-sm font-semibold text-slate-700">
                  프로필 보기
                </div>
                <div className="mt-2 text-xs leading-relaxed text-slate-500">
                  조직도에서 직원을 한 번 클릭하면
                  <br />
                  여기에서 상세 프로필을 볼 수 있습니다.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}