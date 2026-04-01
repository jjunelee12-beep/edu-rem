// client/src/lib/datetime.ts

/**
 * DB에서 오는 시간 문자열을 "로컬(KST) 기준"으로 안전하게 파싱
 */
export function parseKSTDate(dateStr?: string | null): Date | null {
  if (!dateStr) return null;

  // 이미 Date 객체면 그대로
  if (dateStr instanceof Date) return dateStr;

  // "2026-04-02 03:04:23" → "2026-04-02T03:04:23"
  const normalized = String(dateStr).replace(" ", "T");

  const d = new Date(normalized);

  if (Number.isNaN(d.getTime())) return null;

  return d;
}

/**
 * 시간 표시 (출근/퇴근용)
 */
export function formatTime(dateStr?: string | null) {
  const d = parseKSTDate(dateStr);
  if (!d) return "-";

  return d.toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * 날짜 표시
 */
export function formatDate(dateStr?: string | null) {
  const d = parseKSTDate(dateStr);
  if (!d) return "-";

  return d.toLocaleDateString("ko-KR");
}

/**
 * 날짜 + 시간
 */
export function formatDateTime(dateStr?: string | null) {
  const d = parseKSTDate(dateStr);
  if (!d) return "-";

  return d.toLocaleString("ko-KR");
}

/**
 * input datetime-local 용 변환 (⚠️ UTC 문제 해결 핵심)
 */
export function toDateTimeLocalValue(dateStr?: string | null) {
  const d = parseKSTDate(dateStr);
  if (!d) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${day}T${hour}:${minute}`;
}