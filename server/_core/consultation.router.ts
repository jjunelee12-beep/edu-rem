import { z } from "zod";
import { protectedProcedure, router } from "./trpc";
import { and, desc, eq, inArray } from "drizzle-orm";
import { consultations, students } from "../../drizzle/schema";

import {
  getDb,
  getConsultation,
  updateConsultation,
  deleteConsultation,
  createStudent,
  createConsultation,
  getUserTeamMemberIds,
  reassignConsultationAndLinkedStudent,
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

const ReassignInput = z.object({
  id: z.number(),
  assigneeId: z.number(),
});

const ListInput = z
  .object({
    showAll: z.boolean().optional().default(false),
  })
  .optional();

function normalizePhone(v: string) {
  return (v ?? "").replace(/\D/g, "").slice(0, 11);
}

function toAssigneeId(user: any): number {
  const n = Number(user?.id);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function isHost(user: any) {
  return user?.role === "host";
}

function isAdmin(user: any) {
  return user?.role === "admin";
}

function isStaff(user: any) {
  return user?.role === "staff";
}

function splitCsvLine(line: string) {
  return line.includes("\t") ? line.split("\t") : line.split(",");
}

async function upsertConsultationByPhone(params: {
organizationId: number;
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
  .where(
    and(
      eq(
        consultations.organizationId,
        params.organizationId
      ),
      eq(
        consultations.phone,
        phone
      ),
      eq(
        consultations.assigneeId,
        params.assigneeId
      )
    )
  )
  .limit(1);

  const patch: any = {
organizationId: params.organizationId,
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
  await db
    .update(consultations)
    .set(patch)
    .where(
      and(
        eq(
          consultations.id,
          existing.id
        ),
        eq(
          consultations.organizationId,
          params.organizationId
        ),
        eq(
          consultations.assigneeId,
          params.assigneeId
        )
      )
    );

  return {
    id: existing.id as number,
    action: "updated" as const,
  };
}

  const insertId = await createConsultation({
  ...patch,
  organizationId: params.organizationId,
});
  return { id: Number(insertId), action: "created" as const };
}

export const consultationRouter = router({
  list: protectedProcedure
  .input(ListInput)
  .query(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) return [];

const host = isHost(ctx.user);
const admin = isAdmin(ctx.user);

const assigneeId = toAssigneeId(ctx.user);

const organizationId = Number(
  (ctx.user as any)?.organizationId || 0
);

let where: any;

// HOST가 전체 DB 보기를 체크한 경우
if (host && input?.showAll) {
  where = eq(
    consultations.organizationId,
    organizationId
  );
}
// ADMIN이 팀 DB 보기를 체크한 경우
else if (admin && input?.showAll) {
  const teamMemberIds =
    await getUserTeamMemberIds(
      assigneeId,
      {
        organizationId,
      }
    );

  where = and(
    eq(
      consultations.organizationId,
      organizationId
    ),
    inArray(
      consultations.assigneeId,
      teamMemberIds
    )
  );
}
// HOST 기본 / ADMIN 기본 / STAFF는 본인 DB
else {
  where = and(
    eq(
      consultations.organizationId,
      organizationId
    ),
    eq(
      consultations.assigneeId,
      assigneeId
    )
  );
}

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
organizationId: Number((ctx.user as any)?.organizationId || 0),
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
    const organizationId = Number((ctx.user as any)?.organizationId || 0);
const assigneeId = toAssigneeId(ctx.user);

    let created = 0;
    let updated = 0;

    for (const r of input.rows) {
      if (!r.clientName) continue;
      const phone = normalizePhone(r.phone);
      if (!phone) continue;

      const res = await upsertConsultationByPhone({
  organizationId,
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
    const organizationId = Number((ctx.user as any)?.organizationId || 0);
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
  organizationId,
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

    const prev = await getConsultation(input.id, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
    if (!prev) return { ok: false };

   const host = isHost(ctx.user);
const myId = toAssigneeId(ctx.user);

const isOwnConsultation =
  Number(prev.assigneeId) === myId;

// HOST가 아니면 본인 담당 상담만 수정 가능
if (!host && !isOwnConsultation) {
  throw new Error(
    "권한이 없습니다. 본인 담당 상담만 수정할 수 있습니다."
  );
}

// 담당자 변경은 HOST만 가능
if (!host && input.assigneeId !== undefined) {
  throw new Error(
    "권한이 없습니다. 담당자는 호스트만 변경할 수 있습니다."
  );
}

const nextStatus = input.status ?? prev.status;

const isCancelRegistration =
  prev.status === "등록" &&
  nextStatus !== "등록";

// 이미 등록된 상담의 상태 취소는 HOST만 가능
if (isCancelRegistration && !host) {
  throw new Error(
    "등록 완료된 상담의 상태는 변경할 수 없습니다."
  );
}

    const patch: any = {};

if (host) {
  // HOST는 모든 필드 수정 가능
  if (input.consultDate !== undefined) {
    patch.consultDate =
      input.consultDate as any;
  }

  if (input.channel !== undefined) {
    patch.channel = input.channel;
  }

  if (input.clientName !== undefined) {
    patch.clientName = input.clientName;
  }

  if (input.phone !== undefined) {
    patch.phone = normalizePhone(input.phone);
  }

  if (input.finalEducation !== undefined) {
    patch.finalEducation =
      input.finalEducation;
  }

  if (input.desiredCourse !== undefined) {
    patch.desiredCourse =
      input.desiredCourse;
  }

  if (input.notes !== undefined) {
    patch.notes = input.notes;
  }

  if (input.status !== undefined) {
    patch.status = input.status;
  }

  if (input.assigneeId !== undefined) {
    patch.assigneeId = input.assigneeId;
  }
} else {
  // ADMIN / STAFF는 본인 상담의
  // 상담내역과 상태만 수정 가능

  const forbiddenFields: string[] = [];

  if (input.consultDate !== undefined) {
    forbiddenFields.push("상담일");
  }

  if (input.channel !== undefined) {
    forbiddenFields.push("문의경로");
  }

  if (input.clientName !== undefined) {
    forbiddenFields.push("이름");
  }

  if (input.phone !== undefined) {
    forbiddenFields.push("연락처");
  }

  if (input.finalEducation !== undefined) {
    forbiddenFields.push("최종학력");
  }

  if (input.desiredCourse !== undefined) {
    forbiddenFields.push("희망과정");
  }

  if (input.assigneeId !== undefined) {
    forbiddenFields.push("담당자");
  }

  if (forbiddenFields.length > 0) {
    throw new Error(
      `수정 권한이 없습니다: ${forbiddenFields.join(", ")}`
    );
  }

  if (input.notes !== undefined) {
    patch.notes = input.notes;
  }

  if (input.status !== undefined) {
    patch.status = input.status;
  }
}

    if (Object.keys(patch).length > 0) {
      await updateConsultation(input.id, patch, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
    }

    if (nextStatus === "등록" && prev.status !== "등록") {
      const [existingStudent] = await db
        .select({ id: students.id })
        .from(students)
        .where(
  and(
    eq(students.organizationId, Number((ctx.user as any)?.organizationId || 0)),
    eq(students.consultationId, input.id)
  )
)
        .limit(1);

      if (!existingStudent) {
        const nextName = input.clientName ?? prev.clientName;
        const nextPhone = normalizePhone(input.phone ?? prev.phone);
        const nextCourse = (input.desiredCourse ?? prev.desiredCourse ?? "").trim() || "미정";
        const assigneeId = (input.assigneeId ?? prev.assigneeId ?? myId) as any;

        await createStudent({
  organizationId: Number((ctx.user as any)?.organizationId || 0),
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

reassign: protectedProcedure
  .input(ReassignInput)
  .mutation(async ({ input, ctx }) => {
    const organizationId = Number(
      (ctx.user as any)?.organizationId || 0
    );

    const host = isHost(ctx.user);

    if (!host) {
      throw new Error(
        "권한이 없습니다. 담당자는 호스트만 변경할 수 있습니다."
      );
    }

    const prev = await getConsultation(input.id, {
      organizationId,
    });

    if (!prev) {
      throw new Error(
        "상담 기록을 찾을 수 없습니다."
      );
    }

    await reassignConsultationAndLinkedStudent(
      input.id,
      input.assigneeId,
      {
        organizationId,
      }
    );

    return {
      ok: true,
    };
  }),

  delete: protectedProcedure.input(DeleteInput).mutation(async ({ input, ctx }) => {
    const prev = await getConsultation(input.id, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
    if (!prev) return { ok: true };

    const host = isHost(ctx.user);

if (!host) {
  throw new Error(
    "권한이 없습니다. 상담 삭제는 호스트만 가능합니다."
  );
}

    await deleteConsultation(input.id, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
    return { ok: true };
  }),
});