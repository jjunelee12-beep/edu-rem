import { useMemo } from "react";
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

      if (!map[team]) {
        map[team] = [];
      }

      map[team].push(user);
    });

    return map;
  }, [users]);

  const sortedTeams = useMemo(() => {
    return Object.keys(groupedUsers).sort((a, b) => a.localeCompare(b));
  }, [groupedUsers]);

  return (
    <div className="px-3 py-3">
      <div className="mb-3 px-2 text-[11px] text-muted-foreground">
        조직원을 더블클릭하면 1:1 채팅을 시작합니다.
      </div>

      {sortedTeams.length === 0 ? (
        <div className="px-2 py-6 text-sm text-muted-foreground">
          표시할 조직원이 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {sortedTeams.map((teamName) => {
            const members = groupedUsers[teamName] || [];

            return (
              <div key={teamName}>
                <div className="mb-2 px-2 text-xs font-semibold text-muted-foreground">
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
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-muted/40"
                        title="더블클릭하여 1:1 채팅 시작"
                      >
                        <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-semibold">
                          {member.name?.slice(0, 1) || "?"}
                          <span
                            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-white ${
                              isOnline ? "bg-green-500" : "bg-gray-300"
                            }`}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">
                            {member.name}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
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