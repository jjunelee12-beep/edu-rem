import { readUserIdFromCookie } from "./session";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { users } from "../../drizzle/schema";

export async function requireAuth(req: any, res: any, next: any) {
  const secret = process.env.SESSION_SECRET || "dev-secret";
  const userId = readUserIdFromCookie(req, secret);
  if (!userId) return res.status(401).json({ message: "not logged in" });

  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user || user.isActive === false) return res.status(401).json({ message: "not logged in" });

  req.user = user; // 이후 라우터에서 req.user.role 사용
  next();
}

export function requireRole(roles: Array<"host" | "admin" | "staff">) {
  return (req: any, res: any, next: any) => {
    const role = req.user?.role;
    if (!role || !roles.includes(role)) return res.status(403).json({ message: "forbidden" });
    next();
  };
}