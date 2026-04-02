// client/src/lib/datetime.ts

function hasExplicitTimezone(value: string) {
  return /([zZ]|[+-]\d{2}:\d{2})$/.test(value);
}

/**
 * DB 문자열을 안전하게 Date로 변환
 *
 * 전제:
 * - "2026-04-02 07:35:20" 같이 timezone 없는 DATETIME 문자열은
 *   서버/DB UTC 값으로 들어온다고 보고 "Z"를 붙여 UTC로 해석한다.
 * - 이미 Z / +09:00 같은 timezone 정보가 있으면 그대로 사용한다.
 * - 날짜만 있는 "2026-04-02" 형식도 처리한다.
 */
export function parseKSTDate(dateStr?: string | Date | null): Date | null {
  if (!dateStr) return null;
  if (dateStr instanceof Date) {
    return Number.isNaN(dateStr.getTime()) ? null : dateStr;
  }

  const raw = String(dateStr).trim();
  if (!raw) return null;

  // "2026-04-02 03:04:23" -> "2026-04-02T03:04:23"
  const normalized = raw.replace(" ", "T");

  let iso = normalized;

  // timezone 정보가 없으면 UTC 기준으로 간주
  if (!hasExplicitTimezone(iso)) {
    iso += "Z";
  }

  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;

  return d;
}

export function formatTime(dateStr?: string | Date | null) {
  const d = parseKSTDate(dateStr);
  if (!d) return "-";

  return d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Seoul",
  });
}

export function formatDate(dateStr?: string | Date | null) {
  const d = parseKSTDate(dateStr);
  if (!d) return "-";

  return d.toLocaleDateString("ko-KR", {
    timeZone: "Asia/Seoul",
  });
}

export function formatDateTime(dateStr?: string | Date | null) {
  const d = parseKSTDate(dateStr);
  if (!d) return "-";

  return d.toLocaleString("ko-KR", {
    hour12: true,
    timeZone: "Asia/Seoul",
  });
}

/**
 * datetime-local input용
 * UTC 기준 문자열 -> KST 로컬 입력값으로 변환
 */
export function toDateTimeLocalValue(dateStr?: string | Date | null) {
  const d = parseKSTDate(dateStr);
  if (!d) return "";

  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}