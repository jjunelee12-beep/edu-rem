import { eq, desc } from "drizzle-orm";
import { getDb } from "./db";
import {
  organizations,
  users,
  brandingSettings,
  smsSettings,
} from "../drizzle/schema";

export async function getOrganizationById(id: number) {
  const db = await getDb();
  if (!db) return null;

  const rows = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1);

  return rows[0] || null;
}

export async function listOrganizations() {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(organizations)
    .orderBy(desc(organizations.id));
}

export async function createOrganization(input: {
  name: string;
  businessName?: string | null;
  businessNumber?: string | null;
  planCode?: "free" | "basic" | "pro" | "enterprise";
  maxUsers?: number;
  maxLandingForms?: number;
  maxSmsPerMonth?: number;
  memo?: string | null;
  createdBy?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const result: any = await db.insert(organizations).values({
    name: input.name.trim(),
    businessName: input.businessName?.trim() || null,
    businessNumber: input.businessNumber?.trim() || null,
    planCode: input.planCode || "basic",
    status: "active",
    maxUsers: input.maxUsers ?? 10,
    maxLandingForms: input.maxLandingForms ?? 10,
    maxSmsPerMonth: input.maxSmsPerMonth ?? 1000,
    memo: input.memo?.trim() || null,
    createdBy: input.createdBy ?? null,
    updatedBy: input.createdBy ?? null,
  } as any);

  const insertId = result?.insertId ?? result?.[0]?.insertId;
  return getOrganizationById(Number(insertId));
}

export async function updateOrganization(input: {
  id: number;
  name?: string;
  businessName?: string | null;
  businessNumber?: string | null;
  planCode?: "free" | "basic" | "pro" | "enterprise";
  status?: "active" | "inactive" | "suspended";
  maxUsers?: number;
  maxLandingForms?: number;
  maxSmsPerMonth?: number;
  memo?: string | null;
  updatedBy?: number | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(organizations)
    .set({
      name: input.name?.trim(),
      businessName:
        input.businessName === undefined
          ? undefined
          : input.businessName?.trim() || null,
      businessNumber:
        input.businessNumber === undefined
          ? undefined
          : input.businessNumber?.trim() || null,
      planCode: input.planCode,
      status: input.status,
      maxUsers: input.maxUsers,
      maxLandingForms: input.maxLandingForms,
      maxSmsPerMonth: input.maxSmsPerMonth,
      memo:
        input.memo === undefined
          ? undefined
          : input.memo?.trim() || null,
      updatedBy: input.updatedBy ?? undefined,
    } as any)
    .where(eq(organizations.id, input.id));

  return getOrganizationById(input.id);
}

export async function createOrganizationDefaults(input: {
  organizationId: number;
  actorUserId?: number | null;
  companyName: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db.insert(brandingSettings).values({
    organizationId: input.organizationId,
    companyName: input.companyName,
    messengerSubtitle: "사내 메신저",
    createdBy: input.actorUserId ?? null,
    updatedBy: input.actorUserId ?? null,
  } as any);

  await db.insert(smsSettings).values({
    organizationId: input.organizationId,
    provider: "aligo",
    isActive: false,
  } as any);

  return { ok: true };
}

export async function assignUserToOrganization(input: {
  userId: number;
  organizationId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  await db
    .update(users)
    .set({
      organizationId: input.organizationId,
    } as any)
    .where(eq(users.id, input.userId));

  return { ok: true };
}