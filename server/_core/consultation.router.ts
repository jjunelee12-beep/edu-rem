import { z } from "zod";
import { protectedProcedure, router } from "./trpc";
import { desc, eq } from "drizzle-orm";
import { consultations, students } from "../../drizzle/schema";

// ✅ 너 프로젝트 DB 유틸
import {
  getDb,
  getConsultation,
  updateConsultation,
  deleteConsultation,
  createStudent,
  createConsultation,
} from "../db";

// ✅ ESM에서 로드 경로 확인
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
console.log("✅ consultation.router.ts LOADED:", __filename);
console.log("🔥 ROUTER BUILD ID =", "2026-03-05_1");

import { createRequire } from "node:module";
const require2 = createRequire(import.meta.url);
console.log("[PATH] router cwd:", process.cwd());
console.log("[PATH] router schema resolved:", require2.resolve("../../drizzle/schema"));

const CreateInput = z.object({
  consultDate: z.string().min(8), // YYYY-MM-DD
  channel: z.string().optional().default(""),
  clientName: z.string().min(1),
  phone: z.string().min(8),

  // ✅ 추가
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

  // ✅ 추가
  finalEducation: z.string().optional(),

  desiredCourse: z.string().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  assigneeId: z.number().optional(), // admin/host만 가능
});

const DeleteInput = z.object({ id: z.number() });

function normalizePhone(v: string) {
  return (v ?? "").replace(/\D/g, "").slice(0, 11);
}

function toAssigneeId(user: any): number {
  const n = Number(user?.id);
  // ✅ 0 / NaN 방지
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function isPrivileged(user: any) {
  return user?.role === "admin" || user?.role === "host";
}

function splitCsvLine(line: string) {
  return line.includes("\t") ? line.split("\t") : line.split(",");
}

/**
 * ✅ 폰번호 기준 중복 방지(업서트)
 * - 기존 상담이 있으면: 최신값으로 update
 * - 없으면: insert
 * - 반환: { id, action }
 */
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

  // ✅ 디버그: 업서트 진입 payload
  console.log("[UPSERT] IN:", {
    consultDate: params.consultDate,
    channel: params.channel,
    clientName: params.clientName,
    phone,
    finalEducation: params.finalEducation,
    desiredCourse: params.desiredCourse,
    notes: params.notes,
    status: params.status,
    assigneeId: params.assigneeId,
  });

  const [existing] = await db
    .select()
    .from(consultations)
    .where(eq(consultations.phone, phone))
    .limit(1);

  console.log("[UPSERT] EXISTING:", existing ? { id: existing.id, phone } : null);

  // ✅ 여기서 finalEducation 포함
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

  // ✅ 디버그: patch 키/값 확인
  console.log("[UPSERT] PATCH KEYS:", Object.keys(patch));
  console.log("[UPSERT] PATCH:", patch);

  if (existing) {
    console.log("[UPSERT] BRANCH: UPDATE", { id: existing.id, phone });
    await db.update(consultations).set(patch).where(eq(consultations.id, existing.id));
    return { id: existing.id as number, action: "updated" as const };
  }

  console.log("[UPSERT] BRANCH: INSERT", { phone });

  // ✅ 디버그: createConsultation에 실제로 들어가는 데이터 확인
  console.log("[INSERT] VALUES KEYS:", Object.keys(patch));
  console.log("[INSERT] VALUES:", patch);

  const insertId = await createConsultation(patch);

  console.log("[UPSERT] INSERT RESULT:", { insertId });

  return { id: Number(insertId), action: "created" as const };
}

export const consultationRouter = router({
  /**
   * ✅ staff: 본인 것만
   * ✅ admin/host: 전체
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];

    const privileged = isPrivileged(ctx.user);
    const assigneeId = toAssigneeId(ctx.user);

    // ✅ 디버그: list 호출/권한/유저
    console.log("[LIST] ctx.user:", ctx.user);
    console.log("[LIST] privileged:", privileged, "assigneeId:", assigneeId);

    const where = privileged ? undefined : eq(consultations.assigneeId, assigneeId);

    const rows = where
      ? await db.select().from(consultations).where(where).orderBy(desc(consultations.createdAt))
      : await db.select().from(consultations).orderBy(desc(consultations.createdAt));

    // ✅ 디버그: list 결과 샘플(0~3개)
    console.log(
      "[LIST] rows sample:",
      rows?.slice?.(0, 3)?.map?.((r: any) => ({
        id: r.id,
        phone: r.phone,
        finalEducation: r.finalEducation,
        assigneeId: r.assigneeId,
      }))
    );

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

  /**
   * ✅ 생성: 폰번호 기준 업서트
   * - assigneeId는 무조건 로그인 유저로
   */
 create: protectedProcedure.input(CreateInput).mutation(async ({ input, ctx }) => {
  console.log("[CREATE] RAW INPUT:", input);
  console.log("[CREATE] RAW INPUT KEYS:", Object.keys(input as any));
  console.log("[CREATE] RAW INPUT finalEducation:", (input as any).finalEducation);

  const assigneeId = toAssigneeId(ctx.user);

  const patch = {
    consultDate: input.consultDate,
    channel: input.channel ?? "",
    clientName: input.clientName,
    phone: input.phone,
    finalEducation: input.finalEducation ?? "",   // ✅ 강제 포함
    desiredCourse: input.desiredCourse ?? "",
    notes: input.notes ?? "",
    status: input.status ?? "상담중",
    assigneeId,
  };

  console.log("[CREATE] PATCH KEYS:", Object.keys(patch));
  console.log("[CREATE] PATCH finalEducation:", (patch as any).finalEducation);

  const insertId = await createConsultation(patch as any);

  return { id: Number(insertId) };
}),

  /**
   * ✅ 시트 붙여넣기: 폰번호 기준 업서트(루프)
   */
  bulkCreate: protectedProcedure.input(BulkCreateInput).mutation(async ({ input, ctx }) => {
    const assigneeId = toAssigneeId(ctx.user);

    console.log("[BULK] rows:", input.rows.length);
    console.log("[BULK] ctx.user:", ctx.user, "assigneeId:", assigneeId);

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

    console.log("[BULK] result:", { count: created + updated, created, updated });

    return { count: created + updated, created, updated };
  }),

  /**
   * ✅ CSV 임포트: 폰번호 기준 업서트(루프)
   * 열 순서:
   * 상담일, 문의경로, 이름, 연락처, 최종학력, 희망과정, 상담내역, 상태
   */
  importCsv: protectedProcedure.input(ImportCsvInput).mutation(async ({ input, ctx }) => {
    const assigneeId = toAssigneeId(ctx.user);

    console.log("[CSV] hasHeader:", input.hasHeader);
    console.log("[CSV] ctx.user:", ctx.user, "assigneeId:", assigneeId);

    const lines = input.csvText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const dataLines = input.hasHeader ? lines.slice(1) : lines;

    console.log("[CSV] lines:", lines.length, "dataLines:", dataLines.length);

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

    console.log("[CSV] result:", { count: created + updated, created, updated });

    return { count: created + updated, created, updated };
  }),

  /**
   * ✅ 수정 권한
   * - staff: 본인 것만 수정 가능
   * - admin/host: 모두 가능 + assigneeId 변경 가능
   *
   * ✅ 등록 취소 권한
   * - status가 '등록' -> 다른 값으로 바뀌는 건 admin/host만 가능
   *
   * ✅ 등록 처리(등록으로 바뀌는 순간 학생테이블 이관 + 중복방지: consultationId)
   */
  update: protectedProcedure.input(UpdateInput).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    // ✅ 디버그: update input / user
    console.log("[UPDATE] INPUT:", input);
    console.log("[UPDATE] ctx.user:", ctx.user);

    const prev = await getConsultation(input.id);
    if (!prev) return { ok: false };

    console.log("[UPDATE] PREV:", {
      id: prev.id,
      phone: prev.phone,
      finalEducation: prev.finalEducation,
      assigneeId: prev.assigneeId,
      status: prev.status,
    });

    const privileged = isPrivileged(ctx.user);
    const myId = toAssigneeId(ctx.user);

    console.log("[UPDATE] privileged:", privileged, "myId:", myId);

    // staff는 본인 상담만 수정 가능
    if (!privileged && Number(prev.assigneeId) !== myId) {
      throw new Error("권한이 없습니다 (본인 상담만 수정 가능)");
    }

    // staff는 assigneeId 변경 불가
    if (!privileged && input.assigneeId !== undefined) {
      throw new Error("권한이 없습니다 (담당자 변경 불가)");
    }

    const nextStatus = input.status ?? prev.status;

    // ✅ 등록 취소: admin/host만 가능
    const isCancelRegistration = prev.status === "등록" && nextStatus !== "등록";
    if (isCancelRegistration && !privileged) {
      throw new Error("등록 취소는 관리자/호스트만 가능합니다");
    }

    const patch: any = {};
    if (input.consultDate !== undefined) patch.consultDate = input.consultDate as any;
    if (input.channel !== undefined) patch.channel = input.channel;
    if (input.clientName !== undefined) patch.clientName = input.clientName;
    if (input.phone !== undefined) patch.phone = normalizePhone(input.phone);

    // ✅ 최종학력 반영
    if (input.finalEducation !== undefined) patch.finalEducation = input.finalEducation;

    if (input.desiredCourse !== undefined) patch.desiredCourse = input.desiredCourse;
    if (input.notes !== undefined) patch.notes = input.notes;
    if (input.status !== undefined) patch.status = input.status;
    if (input.assigneeId !== undefined) patch.assigneeId = input.assigneeId;

    console.log("[UPDATE] PATCH KEYS:", Object.keys(patch));
    console.log("[UPDATE] PATCH:", patch);

    // ✅ patch가 비면 업데이트 호출하지 않음 (No values to set 방지)
    if (Object.keys(patch).length > 0) {
      await updateConsultation(input.id, patch);
      console.log("[UPDATE] updateConsultation OK:", input.id);
    } else {
      console.log("[UPDATE] SKIP (empty patch):", input.id);
    }

    // ✅ 등록으로 처음 바뀌는 순간 학생 insert (중복 방지: consultationId)
    if (nextStatus === "등록" && prev.status !== "등록") {
      console.log("[UPDATE] STATUS CHANGED TO 등록 -> student insert check");

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

        console.log("[UPDATE] CREATE STUDENT:", {
          clientName: nextName,
          phone: nextPhone,
          course: nextCourse,
          assigneeId,
          consultationId: input.id,
        });

        await createStudent({
          clientName: nextName,
          phone: nextPhone,
          course: nextCourse,
          assigneeId,
          consultationId: input.id,
        } as any);

        console.log("[UPDATE] createStudent OK");
      } else {
        console.log("[UPDATE] student already exists:", existingStudent.id);
      }
    }

    return { ok: true };
  }),

  /**
   * ✅ 삭제 권한
   * - staff: 본인 것만 삭제 가능
   * - admin/host: 모두 가능
   */
  delete: protectedProcedure.input(DeleteInput).mutation(async ({ input, ctx }) => {
    console.log("[DELETE] INPUT:", input);
    console.log("[DELETE] ctx.user:", ctx.user);

    const prev = await getConsultation(input.id);
    if (!prev) return { ok: true };

    console.log("[DELETE] PREV:", {
      id: prev.id,
      assigneeId: prev.assigneeId,
      phone: prev.phone,
    });

    const privileged = isPrivileged(ctx.user);
    const myId = toAssigneeId(ctx.user);

    console.log("[DELETE] privileged:", privileged, "myId:", myId);

    if (!privileged && Number(prev.assigneeId) !== myId) {
      throw new Error("권한이 없습니다 (본인 상담만 삭제 가능)");
    }

    await deleteConsultation(input.id);
    console.log("[DELETE] deleteConsultation OK:", input.id);

    return { ok: true };
  }),
});