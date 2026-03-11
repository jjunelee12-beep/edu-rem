export function formatPhone(phone: string | null | undefined) {
  const v = String(phone ?? "").replace(/\D/g, "");

  if (v.length === 11) {
    return `${v.slice(0, 3)}-${v.slice(3, 7)}-${v.slice(7)}`;
  }

  if (v.length === 10) {
    return `${v.slice(0, 3)}-${v.slice(3, 6)}-${v.slice(6)}`;
  }

  return phone || "-";
}