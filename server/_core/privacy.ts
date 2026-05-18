export function maskName(name?: string | null) {
  const value = String(name || "").trim();
  if (!value) return "";

  if (value.length <= 2) return `${value[0]}*`;

  return value[0] + "*".repeat(value.length - 2) + value[value.length - 1];
}

export function maskPhone(phone?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length < 8) return "****";

  return `${digits.slice(0, 3)}-****-${digits.slice(-4)}`;
}

export function maskAddress(address?: string | null) {
  const value = String(address || "").trim();
  if (!value) return "";

  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return `${parts.join(" ")} ****`;

  return `${parts[0]} ${parts[1]} ****`;
}

export function maskEmail(email?: string | null) {
  const value = String(email || "").trim();
  if (!value || !value.includes("@")) return value ? "****" : "";

  const [id, domain] = value.split("@");
  if (!id || !domain) return "****";

  if (id.length <= 2) return `${id[0] || "*"}*@${domain}`;

  return `${id.slice(0, 2)}****@${domain}`;
}

export function maskMemo(value?: string | null) {
  const text = String(value || "").trim();
  return text ? "열람 제한" : value;
}

export function maskPersonalData<T extends Record<string, any>>(row: T): T {
  if (!row) return row;

  return {
    ...row,

    clientName:
      row.clientName !== undefined ? maskName(row.clientName) : row.clientName,
    studentClientName:
      row.studentClientName !== undefined
        ? maskName(row.studentClientName)
        : row.studentClientName,
    name: row.name !== undefined ? maskName(row.name) : row.name,
    userName: row.userName !== undefined ? maskName(row.userName) : row.userName,

    phone: row.phone !== undefined ? maskPhone(row.phone) : row.phone,
    studentPhone:
      row.studentPhone !== undefined ? maskPhone(row.studentPhone) : row.studentPhone,

    email: row.email !== undefined ? maskEmail(row.email) : row.email,

    address: row.address !== undefined ? maskAddress(row.address) : row.address,
    inputAddress:
      row.inputAddress !== undefined
        ? maskAddress(row.inputAddress)
        : row.inputAddress,
    detailAddress:
      row.detailAddress !== undefined ? "****" : row.detailAddress,

    notes: row.notes !== undefined ? maskMemo(row.notes) : row.notes,
    note: row.note !== undefined ? maskMemo(row.note) : row.note,
    memo: row.memo !== undefined ? maskMemo(row.memo) : row.memo,
  };
}

export function maskPersonalDataList<T extends Record<string, any>>(rows: T[]): T[] {
  return (rows || []).map((row) => maskPersonalData(row));
}