import { useMemo } from "react";
import { normalizeAssetUrl } from "@/lib/normalizeAssetUrl";
import type { MessengerUser } from "@/components/messenger/mockMessengerData";

type MessengerOrgPanelProps = {
  users: MessengerUser[];
  onOpenDirectChat: (user: MessengerUser) => void;
};

export default function MessengerOrgPanel({
  users,
  onOpenDirectChat,
}: MessengerOrgPanelProps) {
  const groupedUsers = useMemo(() => {
    const map: Record<string, MessengerUser[]> = {};

    (users || []).forEach((user) => {
      const team = user.team || "미분류";
      if (!map[team]) map[team] = [];
      map[team].push(user);
    });

    Object.keys(map).forEach((team) => {
      map[team] = [...map[team]].sort((a, b) => {
        const pos = String(a.position || "").localeCompare(String(b.position || ""));
        if (pos !== 0) return pos;
        return String(a.name || "").localeCompare(String(b.name || ""));
      });
    });

    return map;
  }, [users]);

  const sortedTeams = useMemo(() => {
    return Object.keys(groupedUsers).sort((a, b) => a.localeCompare(b));
  }, [groupedUsers]);

  return (
    <div className="px-3 py-3">
      {sortedTeams.length === 0 ? (
        <div className="px-2 py-6 text-sm text-slate-500">
          표시할 조직원이 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {sortedTeams.map((teamName) => {
            const members = groupedUsers[teamName] || [];

            return (
              <div key={teamName}>
                <div className="mb-2 px-2 text-xs font-semibold text-slate-500">
                  {teamName}
                </div>

                <div className="space-y-1">
                  {members.map((member) => {
                    const isOnline = member.status === "online";

                    return (
                      <button
                        key={member.id}
                        type="button"
                        onDoubleClick={() => onOpenDirectChat(member)}
                        className="flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left transition hover:bg-white"
                        title="더블클릭하여 1:1 채팅 시작"
                      >
                        <div className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-sm font-semibold text-slate-700">
                          {member.avatar ? (
                            <img
  src={normalizeAssetUrl(member.avatar)}
  alt={member.name}
  className="h-full w-full object-cover"
/>
                          ) : (
                            <span>{member.name?.slice(0, 1) || "?"}</span>
                          )}

                          <span
                            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-white ${
                              isOnline ? "bg-green-500" : "bg-gray-300"
                            }`}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-slate-900">
                            {member.name}
                          </div>
                          <div className="truncate text-xs text-slate-500">
                            {member.position}
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
      )}
    </div>
  );
}