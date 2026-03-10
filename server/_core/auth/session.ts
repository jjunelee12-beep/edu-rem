import cookie from "cookie";
import crypto from "crypto";

export const SESSION_COOKIE = "educrm_session";

function sign(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

export function makeSessionCookie(userId: number, secret: string) {
  const payload = `${userId}.${Date.now()}`;
  const sig = sign(payload, secret);
  const value = `${payload}.${sig}`;

  return cookie.serialize(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export function clearSessionCookie() {
  return cookie.serialize(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  });
}

export function readUserIdFromCookie(req: any, secret: string): number | null {
  const header = req.headers?.cookie;
  if (!header) return null;

  const parsed = cookie.parse(header);
  const value = parsed[SESSION_COOKIE];
  if (!value) return null;

  const parts = value.split(".");
  if (parts.length !== 3) return null;

  const [userIdStr, tsStr, sig] = parts;
  const payload = `${userIdStr}.${tsStr}`;
  const expected = sign(payload, secret);
  if (expected !== sig) return null;

  const userId = Number(userIdStr);
  return Number.isFinite(userId) ? userId : null;
}