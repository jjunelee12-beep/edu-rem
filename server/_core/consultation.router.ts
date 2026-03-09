import { z } from "zod";
import { protectedProcedure, router } from "./trpc";
import { desc, eq } from "drizzle-orm";
import { consultations, students } from "../../drizzle/schema";

import {
  getDb,
  getConsultation,
  updateConsultation,
  deleteConsultation,
  createStudent,
  createConsultation,
} from "../db";

const CreateInput = z.object({
  consultDate: z.string().min(8),
  channel: z.string().optional().default(""),
  clientName: z.string().min(1),
  phone: z.string().min(8),
  finalEducation: z.string().optional().default(""),
  desiredCourse: z.string().optional().default(""),
  notes: z.string().optional().default(""),
  status: z.string().optional().default("상담중"),
});

const BulkCreateInput = z.object({
  rows: z.array(CreateInput).min(1),
});

const ImportCsvInput = z.object({
  csvText: z.string().min(1),
  hasHeader: z.boolean().default(true),
});

const UpdateInput = z.object({
  id: z.number(),
  consultDate: z.string().optional(),
  channel: z.string().optional(),
  clientName: z.string().optional(),
  phone: z.string().optional(),
  finalEducation: z.string().optional(),
  desiredCourse: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  assigneeId: z.number().optional(),
});

const DeleteInput = z.object({ id: z.number() });

function normalizePhone(v: string) {
  return (v ?? "").replace(/\D/g, "").slice(0, 11);
}

function toAssigneeId(user: any): number {
  const n = Number(user?.id);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function isPrivileged(user: any) {
  return user?.role === "admin" || user?.role === "host";
}

function splitCsvLine(line: string) {
  return line.includes("\t") ? line.split("\t") : line.split(",");
}

async function upsertConsultationByPhone(params: {
  consultDate: string;
  channel: string;
  clientName: string;
  phone: string;
  finalEducation?: string;
  desiredCourse?: string;
  notes?: string;
  status?: string;
  assigneeId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const phone = normalizePhone(params.phone);
  if (!phone) throw new Error("phone is required");

  const [existing] = await db
    .select()
    .from(consultations)
    .where(eq(consultations.phone, phone))
    .limit(1);

  const patch: any = {
    consultDate: params.consultDate as any,
    channel: params.channel ?? "",
    clientName: params.clientName ?? "",
    phone,
    finalEducation: params.finalEducation ?? "",
    desiredCourse: params.desiredCourse ?? "",
    notes: params.notes ?? "",
    status: params.status ?? "상담중",
    assigneeId: params.assigneeId,
  };

  if (existing) {
    await db.update(consultations).set(patch).where(eq(consultations.id, existing.id));
    return { id: existing.id as number, action: "updated" as const };
  }

  const insertId = await createConsultation(patch);
  return { id: Number(insertId), action: "created" as const };
}

export const consultationRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const privileged = isPrivileged(ctx.user);
    const assigneeId = toAssigneeId(ctx.user);

    const where = privileged ? undefined : eq(consultations.assigneeId, assigneeId);

    const rows = where
      ? await db.select().from(consultations).where(where).orderBy(desc(consultations.createdAt))
      : await db.select().from(consultations).orderBy(desc(consultations.createdAt));

    return rows.map((r: any) => ({
      ...r,
      consultDate:
        typeof r.consultDate === "string"
          ? r.consultDate
          : r.consultDate
            ? new Date(r.consultDate).toISOString().slice(0, 10)
            : null,
      phone: r.phone ? String(r.phone) : "",
      finalEducation: r.finalEducation ?? "",
    }));
  }),

  create: protectedProcedure.input(CreateInput).mutation(async ({ input, ctx }) => {
    const assigneeId = toAssigneeId(ctx.user);

    const patch = {
      consultDate: input.consultDate,
      channel: input.channel ?? "",
      clientName: input.clientName,
      phone: input.phone,
      finalEducation: input.finalEducation ?? "",
      desiredCourse: input.desiredCourse ?? "",
      notes: input.notes ?? "",
      status: input.status ?? "상담중",
      assigneeId,
    };

    const insertId = await createConsultation(patch as any);
    return { id: Number(insertId) };
  }),

  bulkCreate: protectedProcedure.input(BulkCreateInput).mutation(async ({ input, ctx }) => {
    const assigneeId = toAssigneeId(ctx.user);

    let created = 0;
    let updated = 0;

    for (const r of input.rows) {
      if (!r.clientName) continue;
      const phone = normalizePhone(r.phone);
      if (!phone) continue;

      const res = await upsertConsultationByPhone({
        consultDate: r.consultDate,
        channel: r.channel ?? "",
        clientName: r.clientName,
        phone,
        finalEducation: r.finalEducation ?? "",
        desiredCourse: r.desiredCourse ?? "",
        notes: r.notes ?? "",
        status: r.status ?? "상담중",
        assigneeId,
      });

      if (res.action === "created") created += 1;
      else updated += 1;
    }

    return { count: created + updated, created, updated };
  }),

  importCsv: protectedProcedure.input(ImportCsvInput).mutation(async ({ input, ctx }) => {
    const assigneeId = toAssigneeId(ctx.user);

    const lines = input.csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const dataLines = input.hasHeader ? lines.slice(1) : lines;

    let created = 0;
    let updated = 0;

    for (const line of dataLines) {
      const cols = splitCsvLine(line);
      const consultDate = (cols[0] ?? "").trim() || new Date().toISOString().slice(0, 10);
      const channel = (cols[1] ?? "").trim();
      const clientName = (cols[2] ?? "").trim();
      const phone = normalizePhone((cols[3] ?? "").trim());
      const finalEducation = (cols[4] ?? "").trim();
      const desiredCourse = (cols[5] ?? "").trim();
      const notes = (cols[6] ?? "").trim();
      const status = (cols[7] ?? "").trim() || "상담중";

      if (!clientName || !phone) continue;

      const res = await upsertConsultationByPhone({
        consultDate,
        channel,
        clientName,
        phone,
        finalEducation,
        desiredCourse,
        notes,
        status,
        assigneeId,
      });

      if (res.action === "created") created += 1;
      else updated += 1;
    }

    return { count: created + updated, created, updated };
  }),

  update: protectedProcedure.input(UpdateInput).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    const prev = await getConsultation(input.id);
    if (!prev) return { ok: false };

    const privileged = isPrivileged(ctx.user);
    const myId = toAssigneeId(ctx.user);

    if (!privileged && Number(prev.assigneeId) !== myId) {
      throw new Error("권한이 없습니다 (본인 상담만 수정 가능)");
    }

    if (!privileged && input.assigneeId !== undefined) {
      throw new Error("권한이 없습니다 (담당자 변경 불가)");
    }

    const nextStatus = input.status ?? prev.status;

    const isCancelRegistration = prev.status === "등록" && nextStatus !== "등록";
    if (isCancelRegistration && !privileged) {
      throw new Error("등록 취소는 관리자/호스트만 가능합니다");
    }

    const patch: any = {};
    if (input.consultDate !== undefined) patch.consultDate = input.consultDate as any;
    if (input.channel !== undefined) patch.channel = input.channel;
    if (input.clientName !== undefined) patch.clientName = input.clientName;
    if (input.phone !== undefined) patch.phone = normalizePhone(input.phone);
    if (input.finalEducation !== undefined) patch.finalEducation = input.finalEducation;
    if (input.desiredCourse !== undefined) patch.desiredCourse = input.desiredCourse;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.status !== undefined) patch.status = input.status;
    if (input.assigneeId !== undefined) patch.assigneeId = input.assigneeId;

    if (Object.keys(patch).length > 0) {
      await updateConsultation(input.id, patch);
    }

    if (nextStatus === "등록" && prev.status !== "등록") {
      const [existingStudent] = await db
        .select({ id: students.id })
        .from(students)
        .where(eq(students.consultationId, input.id))
        .limit(1);

      if (!existingStudent) {
        const nextName = input.clientName ?? prev.clientName;
        const nextPhone = normalizePhone(input.phone ?? prev.phone);
        const nextCourse = (input.desiredCourse ?? prev.desiredCourse ?? "").trim() || "미정";
        const assigneeId = (input.assigneeId ?? prev.assigneeId ?? myId) as any;

        await createStudent({
          clientName: nextName,
          phone: nextPhone,
          course: nextCourse,
          assigneeId,
          consultationId: input.id,
        } as any);
      }
    }

    return { ok: true };
  }),

  delete: protectedProcedure.input(DeleteInput).mutation(async ({ input, ctx }) => {
    const prev = await getConsultation(input.id);
    if (!prev) return { ok: true };

    const privileged = isPrivileged(ctx.user);
    const myId = toAssigneeId(ctx.user);

    if (!privileged && Number(prev.assigneeId) !== myId) {
      throw new Error("권한이 없습니다 (본인 상담만 삭제 가능)");
    }

    await deleteConsultation(input.id);
    return { ok: true };
  }),
});