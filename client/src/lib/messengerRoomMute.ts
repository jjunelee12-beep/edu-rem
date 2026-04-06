const ROOM_MUTE_KEY = "messenger-muted-room-ids";

export function readMutedRoomIds(): number[] {
  try {
    const raw = localStorage.getItem(ROOM_MUTE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
  } catch {
    return [];
  }
}

export function isRoomMuted(roomId: number): boolean {
  if (!roomId) return false;
  return readMutedRoomIds().includes(Number(roomId));
}

export function setRoomMuted(roomId: number, muted: boolean) {
  const targetId = Number(roomId);
  if (!targetId) return;

  const current = readMutedRoomIds();
  const next = muted
    ? Array.from(new Set([...current, targetId]))
    : current.filter((id) => id !== targetId);

  localStorage.setItem(ROOM_MUTE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("messenger:settings-changed"));
}

export function toggleRoomMuted(roomId: number): boolean {
  const nextMuted = !isRoomMuted(roomId);
  setRoomMuted(roomId, nextMuted);
  return nextMuted;
}