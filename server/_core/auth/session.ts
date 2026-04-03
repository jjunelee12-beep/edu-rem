import cookie from "cookie";
import crypto from "crypto";

export const SESSION_COOKIE = "educrm_session";

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

function sign(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function getCookieHeader(req: any): string | undefined {
  if (!req) return undefined;

  if (typeof req.headers?.cookie === "string") {
    return req.headers.cookie;
  }

  if (typeof req.headers?.get === "function") {
    return req.headers.get("cookie") ?? undefined;
  }

  if (req.headers && typeof req.headers === "object") {
    const raw = req.headers.cookie ?? req.headers.Cookie;
    if (typeof raw === "string") return raw;
  }

  return undefined;
}

export function makeSessionCookie(userId: number, secret: string) {
  const issuedAt = Date.now();
  const payload = `${userId}.${issuedAt}`;
  const sig = sign(payload, secret);
  const value = `${payload}.${sig}`;

  return cookie.serialize(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export function clearSessionCookie() {
  return cookie.serialize(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: 0,
  });
}

export function readUserIdFromCookie(req: any, secret: string): number | null {
  try {
    const header = getCookieHeader(req);
    if (!header) {
      console.log("[session] no cookie header");
      return null;
    }

    const parsed = cookie.parse(header);
    const value = parsed[SESSION_COOKIE];
    if (!value) {
      console.log("[session] no session cookie");
      return null;
    }

    const parts = value.split(".");
    if (parts.length !== 3) {
      console.log("[session] invalid parts length", parts);
      return null;
    }

    const [userIdStr, tsStr, sig] = parts;
    const payload = `${userIdStr}.${tsStr}`;
    const expected = sign(payload, secret);

    if (expected !== sig) {
      console.log("[session] signature mismatch");
      return null;
    }

    const userId = Number(userIdStr);
    const issuedAt = Number(tsStr);

    if (!Number.isFinite(userId) || !Number.isFinite(issuedAt)) {
      console.log("[session] invalid userId or issuedAt");
      return null;
    }

    if (Date.now() - issuedAt > SESSION_MAX_AGE_MS) {
      console.log("[session] expired");
      return null;
    }

    console.log("[session] valid userId =", userId);
    return userId;
  } catch (err) {
    console.log("[session] read error =", err);
    return null;
  }
}