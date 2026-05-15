import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import {
  publicProcedure,
  protectedProcedure,
  adminProcedure,
  hostProcedure,
superHostProcedure,
  router,
} from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { getOrganizationLimitStatus, getOrganizationFeatureFlags } from "./saasdb";
import { buildSettlementPayslipExcel } from "./_core/settlement-payslip-excel";
import { emitLiveNotification } from "./_core/live-notifications";
import { publicLeadRouter } from "./publicLead.router";
import bcrypt from "bcryptjs";
import { smsRouter } from "./_core/sms.router";
import Tesseract from "tesseract.js";
import OpenAI from "openai";
import { attendanceRouter } from "./attendance.router";
import { noticeRouter } from "./routes/notice.router";
import { scheduleRouter } from "./routes/schedule.router";
import { approvalRouter } from "./routes/approval.router";
import { privateCertificateMasterRouter } from "./routes/privateCertificateMaster";
import { subjectCatalogRouter } from "./routes/subjectCatalog";
import { FEATURE_FLAGS } from "./_core/featureFlags";
import { saasRouter } from "./saas.router";
import {
  uploadPrivateJsonObject,
  createPrivateDownloadUrl,
  readPrivateTextObject,
} from "./_core/objectStorage";

function isAdminOrHost(user: any) {
  return (
    user?.role === "admin" ||
    user?.role === "host" ||
    user?.role === "superhost"
  );
}

function canManageOwnFormOrHigher(currentUser: any, targetAssigneeId?: number | null) {
  if (!currentUser) return false;

  if (
    currentUser.role === "admin" ||
    currentUser.role === "host" ||
    currentUser.role === "superhost"
  ) {
    return true;
  }

  return Number(currentUser.id) === Number(targetAssigneeId);
}

function assertCanManageOwnFormOrHigher(currentUser: any, targetAssigneeId?: number | null) {
  if (!currentUser) {
    throw new Error("로그인이 필요합니다.");
  }

  if (!canManageOwnFormOrHigher(currentUser, targetAssigneeId)) {
    throw new Error("본인 페이지 또는 관리자만 수정할 수 있습니다.");
  }
}

function assertHostOrSuperhost(user: any) {
  if (!user) {
    throw new Error("로그인이 필요합니다.");
  }

  if (user.role !== "host" && user.role !== "superhost") {
    throw new Error("호스트 또는 슈퍼호스트만 접근할 수 있습니다.");
  }
}

function assertStudentEditable(params: {
  currentUser: any;
  student: any;
}) {
  const { currentUser, student } = params;

  if (!currentUser) {
    throw new Error("로그인이 필요합니다.");
  }

  if (
    currentUser.role === "host" ||
    currentUser.role === "superhost"
  ) {
    return true;
  }

  if (
    Number(student?.assigneeId || 0) ===
    Number(currentUser.id)
  ) {
    return true;
  }

  throw new Error("해당 학생은 담당자 또는 호스트만 수정할 수 있습니다.");
}

function normalizeAuditJson(value: any) {
  if (value === undefined) return null;
  if (value === null) return null;

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return value;
  }
}

function buildAuditDiff(beforeValue: any, afterValue: any) {
  const beforeObj = beforeValue || {};
  const afterObj = afterValue || {};

  const keys = Array.from(
    new Set([
      ...Object.keys(beforeObj),
      ...Object.keys(afterObj),
    ])
  );

  const diff: Record<string, any> = {};

  for (const key of keys) {
    const beforeRaw = beforeObj[key];
    const afterRaw = afterObj[key];

    const beforeText = JSON.stringify(beforeRaw ?? null);
    const afterText = JSON.stringify(afterRaw ?? null);

    if (beforeText !== afterText) {
      diff[key] = {
        before: beforeRaw ?? null,
        after: afterRaw ?? null,
      };
    }
  }

  return diff;
}

async function writeStudentAuditLog(params: {
  ctx: any;
  studentId: number;
  entityType: string;
  entityId?: number | null;
  action: "create" | "update" | "delete" | "restore" | "complete" | "uncomplete";
  title: string;
  beforeJson?: any;
  afterJson?: any;
}) {
  const organizationId = Number((params.ctx.user as any)?.organizationId || 0);

  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  await db.createStudentAuditLog({
    organizationId,
    studentId: Number(params.studentId),

    entityType: params.entityType,
    entityId: params.entityId ?? null,
    action: params.action,
    title: params.title,

    beforeJson: normalizeAuditJson(params.beforeJson),
    afterJson: normalizeAuditJson(params.afterJson),
    diffJson: buildAuditDiff(params.beforeJson, params.afterJson),

    actorUserId: Number(params.ctx.user.id),
    actorName:
      String((params.ctx.user as any)?.name || (params.ctx.user as any)?.username || "").trim() ||
      null,
    actorRole: String((params.ctx.user as any)?.role || "").trim() || null,

    ipAddress: null,
    userAgent: null,
  } as any);
}

function isSuperhost(user: any) {
  return user?.role === "superhost";
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
function cleanTransferRows(rows: any[]) {
  return (rows || [])
    .filter((row) => row && row.subjectName)
    .map((row, idx) => ({
      subjectName: String(row.subjectName || "").trim(),
      category:
        row.category === "교양" || row.category === "일반"
          ? row.category
          : "전공",
      requirementType:
        row.requirementType === "전공필수" ||
        row.requirementType === "전공선택" ||
        row.requirementType === "교양" ||
        row.requirementType === "일반"
          ? row.requirementType
          : row.category === "교양"
          ? "교양"
          : "전공선택",
      credits: Number(row.credits) > 0 ? Number(row.credits) : 3,
      sortOrder: idx,
    }))
    .filter((row) => row.subjectName.length >= 2);
}

const publicFormUiConfigSchema = z.object({
  title: z.string().optional().default(""),
  subtitle: z.string().optional().default(""),
  logoUrl: z.string().optional().default(""),
  heroImageUrl: z.string().optional().default(""),
  primaryColor: z.string().optional().default("#5fc065"),
  submitButtonText: z.string().optional().default("1:1 맞춤 상담 받기"),
  agreementText: z.string().optional().default("개인정보 수집 및 이용에 동의합니다."),
  layoutType: z.enum(["card", "bottomSheet"]).optional().default("card"),

  fields: z
    .array(
      z.object({
        fieldKey: z.string().min(1),
        label: z.string().optional().default(""),
        placeholder: z.string().optional().default(""),
        required: z.boolean().optional().default(false),
        hidden: z.boolean().optional().default(false),
        order: z.number().optional().default(0),
        type: z.enum(["text", "phone", "select", "textarea", "checkbox"]),
        options: z
          .array(
            z.object({
              label: z.string(),
              value: z.string(),
            })
          )
          .optional(),
      })
    )
    .optional()
    .default([]),

  mapping: z.record(z.string(), z.string()).optional().default({}),
  description: z.string().optional().default(""),
  tags: z.string().optional().default(""),
  isPinned: z.boolean().optional().default(false),
  lastUsedAt: z.string().optional().default(""),

  canvas: z
    .object({
      enabled: z.boolean().optional().default(false),
      width: z.number().optional().default(1080),
      height: z.number().optional().default(1920),
      backgroundColor: z.string().optional().default("#ffffff"),
      elements: z.array(z.any()).optional().default([]),
    })
    .optional(),
});

async function assertOrganizationFeatureEnabled(
  organizationId: number,
  featureKey:
    | "allowBackup"
    | "allowAuditLog"
    | "allowMessenger"
    | "allowPracticeCenter"
    | "allowSettlementReport"
    | "allowPrivateCertificate",
  message: string
) {
  const features = await getOrganizationFeatureFlags(organizationId);

  if (!features[featureKey]) {
    throw new Error(message);
  }
}


export const appRouter = router({
  system: systemRouter,
  leadForm: publicLeadRouter,
  sms: smsRouter,
saas: saasRouter,

organizationFeatures: protectedProcedure.query(async ({ ctx }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  return getOrganizationFeatureFlags(organizationId);
}),

backup: router({
  list: hostProcedure
    .input(
      z
        .object({
          limit: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
  if ((ctx.user as any)?.role === "superhost") {
    throw new Error("슈퍼호스트는 회사 백업 원문을 조회할 수 없습니다.");
  }

  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  if (!organizationId) {
    throw new Error("organizationId is required");
  }

const features = await getOrganizationFeatureFlags(organizationId);

if (!features.allowBackup) {
  throw new Error("현재 회사는 백업/복구 기능을 사용할 수 없습니다.");
}

  return db.listOrganizationBackups({
    organizationId,
    limit: input?.limit ?? 30,
  });
}),

downloadUrl: hostProcedure
  .input(
    z.object({
      id: z.number(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    if ((ctx.user as any)?.role === "superhost") {
      throw new Error("슈퍼호스트는 회사 백업 파일을 다운로드할 수 없습니다.");
    }

    const organizationId = Number((ctx.user as any)?.organizationId || 0);

    if (!organizationId) {
      throw new Error("organizationId is required");
    }

    const features = await getOrganizationFeatureFlags(organizationId);

    if (!features.allowBackup) {
      throw new Error("현재 회사는 백업/복구 기능을 사용할 수 없습니다.");
    }

    const backup = await db.getOrganizationBackupById(input.id, {
      organizationId,
    });

    if (!backup) {
      throw new Error("백업 파일을 찾을 수 없습니다.");
    }

    if (!backup.fileKey) {
      throw new Error("다운로드 가능한 백업 파일이 없습니다.");
    }

    const url = await createPrivateDownloadUrl({
      key: String(backup.fileKey),
      expiresInSeconds: 60 * 5,
    });

await db.createAuditLog({
  organizationId,
  actorUserId: Number(ctx.user.id),
  actorRole: String((ctx.user as any)?.role || ""),
  action: "organization.backup.download",
  targetType: "organization_backup",
  targetId: Number(input.id),
  memo: `회사 백업 다운로드 URL 발급: backupId=${input.id}`,
} as any);

    return {
      success: true,
      url,
      expiresInSeconds: 60 * 5,
    };
  }),

  create: hostProcedure
  .input(
    z
      .object({
        backupType: z
          .enum(["manual", "auto", "restore_snapshot"])
          .optional(),
      })
      .optional()
  )
  .mutation(async ({ ctx, input }) => {
    const organizationId = Number((ctx.user as any)?.organizationId || 0);

if ((ctx.user as any)?.role === "superhost") {
  throw new Error("슈퍼호스트는 회사 백업 원문을 생성할 수 없습니다.");
}

    if (!organizationId) {
      throw new Error("organizationId is required");
    }

const features = await getOrganizationFeatureFlags(organizationId);

if (!features.allowBackup) {
  throw new Error("현재 회사는 백업/복구 기능을 사용할 수 없습니다.");
}

const limitStatus = await getOrganizationLimitStatus(organizationId);

if (limitStatus.exceeded.storage) {
  throw new Error(
    `저장공간 제한을 초과했습니다. 현재 ${limitStatus.usage.storageUsedMb}MB / 제한 ${limitStatus.limits.maxStorageMb}MB`
  );
}

    const backupId = await db.createOrganizationBackupRecord({
      organizationId,
      requestedBy: Number(ctx.user.id),
      backupType: input?.backupType ?? "manual",
    });

    try {
      const exported = await db.exportOrganizationBackupData({
        organizationId,
        requestedBy: Number(ctx.user.id),
	actorRole: String((ctx.user as any)?.role || ""),
      });

const backupKey = `organization-backups/${organizationId}/${exported.fileName}`;

await uploadPrivateJsonObject({
  key: backupKey,
  json: exported.json,
});

      await db.markOrganizationBackupCompleted({
        id: Number(backupId),
        organizationId,
        fileUrl: null,
fileKey: backupKey,
        fileSizeBytes: exported.fileSizeBytes,
        tableCount: exported.tableCount,
        rowCount: exported.rowCount,
      });

      await db.createAuditLog({
        organizationId,
        actorUserId: Number(ctx.user.id),
        actorRole: String((ctx.user as any)?.role || ""),
        action: "organization.backup.create",
        targetType: "organization_backup",
        targetId: Number(backupId),
        memo: `회사 백업 생성: ${exported.fileName}`,
      } as any);

      return {
  success: true,
  id: Number(backupId),
  fileName: exported.fileName,
  fileSizeBytes: exported.fileSizeBytes,
  tableCount: exported.tableCount,
  rowCount: exported.rowCount,
};
    } catch (error: any) {
      await db.markOrganizationBackupFailed({
        id: Number(backupId),
        organizationId,
        errorMessage: error?.message || "백업 생성 실패",
      });

      throw error;
    }
  }),

  previewRestore: hostProcedure
  .input(
    z.object({
      backupId: z.number().int().positive(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const organizationId = Number((ctx.user as any)?.organizationId || 0);

    if ((ctx.user as any)?.role === "superhost") {
      throw new Error("슈퍼호스트는 회사 백업 원문을 검증할 수 없습니다.");
    }

    if (!organizationId) {
      throw new Error("organizationId is required");
    }

    const features = await getOrganizationFeatureFlags(organizationId);

    if (!features.allowBackup) {
      throw new Error("현재 회사는 백업/복구 기능을 사용할 수 없습니다.");
    }

    const backup = await db.getOrganizationBackupById(input.backupId, {
  organizationId,
});

    if (!backup) {
      throw new Error("백업을 찾을 수 없습니다.");
    }

    if (backup.status === "deleted") {
      throw new Error("삭제된 백업은 복구할 수 없습니다.");
    }

    if (!backup.fileKey) {
      throw new Error("백업 파일 경로가 없습니다.");
    }

    const backupText = await readPrivateTextObject({
  key: String(backup.fileKey),
});

    let parsed: any = null;

    try {
      parsed = JSON.parse(backupText);
    } catch {
      throw new Error("백업 파일 형식이 올바르지 않습니다.");
    }

    if (parsed?.app !== "Edu-CRM") {
      throw new Error("Edu-CRM 백업 파일이 아닙니다.");
    }

    if (parsed?.backupType !== "organization_full") {
      throw new Error("지원하지 않는 백업 유형입니다.");
    }

    if (Number(parsed?.organizationId) !== Number(organizationId)) {
      throw new Error("다른 회사의 백업 파일은 복구할 수 없습니다.");
    }

    const tables = parsed?.tables || {};
    const tableNames = Object.keys(tables);

    let rowCount = 0;

    for (const tableName of tableNames) {
      const rows = tables[tableName];
      if (Array.isArray(rows)) {
        rowCount += rows.length;
      }
    }

    return {
      success: true,
      backupId: input.backupId,
      organizationId,
      backupOrganizationId: Number(parsed.organizationId),
      organizationName: parsed?.organization?.name || "",
      organizationSlug: parsed?.organization?.slug || "",
      createdAt: parsed?.createdAt || null,
      tableCount: tableNames.length,
      rowCount,
      tables: tableNames.map((tableName) => ({
        tableName,
        rowCount: Array.isArray(tables[tableName])
          ? tables[tableName].length
          : 0,
      })),
    };
  }),

    restore: hostProcedure
    .input(
      z.object({
        backupId: z.number(),
        confirmText: z.string().min(1),
restoreReason: z.string().min(1).max(300),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = Number((ctx.user as any)?.organizationId || 0);

if ((ctx.user as any)?.role === "superhost") {
  throw new Error("슈퍼호스트는 회사 백업 원문을 복구할 수 없습니다.");
}

      if (!organizationId) {
        throw new Error("organizationId is required");
      }

const features = await getOrganizationFeatureFlags(organizationId);

if (!features.allowBackup) {
  throw new Error("현재 회사는 백업/복구 기능을 사용할 수 없습니다.");
}

      if (input.confirmText !== "복구합니다") {
        throw new Error("복구 확인 문구가 일치하지 않습니다.");
      }

      const backupRecord = await db.getOrganizationBackupById(input.backupId, {
  organizationId,
});

if (!backupRecord) {
  throw new Error("백업 파일을 찾을 수 없습니다.");
}

if (!backupRecord.fileKey) {
  throw new Error("백업 파일 경로가 없습니다.");
}

let parsed: any = null;
let backupText = "";

try {
  backupText = await readPrivateTextObject({
    key: String(backupRecord.fileKey),
  });

  parsed = JSON.parse(backupText);
} catch {
  throw new Error("백업 파일 형식이 올바르지 않습니다.");
}

      if (parsed?.app !== "Edu-CRM") {
        throw new Error("Edu-CRM 백업 파일이 아닙니다.");
      }

      if (parsed?.backupType !== "organization_full") {
        throw new Error("지원하지 않는 백업 유형입니다.");
      }

     if (Number(parsed?.organizationId) !== Number(organizationId)) {
  throw new Error("다른 회사의 백업 파일은 복구할 수 없습니다.");
}

const restoreLimitStatus = await getOrganizationLimitStatus(organizationId);

if (restoreLimitStatus.exceeded.storage) {
  throw new Error(
    `저장공간 제한을 초과했습니다. 현재 ${restoreLimitStatus.usage.storageUsedMb}MB / 제한 ${restoreLimitStatus.limits.maxStorageMb}MB`
  );
}

const snapshotBackupId = await db.createOrganizationBackupRecord({
  organizationId,
  requestedBy: Number(ctx.user.id),
  backupType: "restore_snapshot",
});

const snapshotExported = await db.exportOrganizationBackupData({
  organizationId,
  requestedBy: Number(ctx.user.id),
  actorRole: String((ctx.user as any)?.role || ""),
});

const snapshotKey = `organization-backups/${organizationId}/restore-snapshots/${snapshotExported.fileName}`;

await uploadPrivateJsonObject({
  key: snapshotKey,
  json: snapshotExported.json,
});

await db.markOrganizationBackupCompleted({
  id: Number(snapshotBackupId),
  organizationId,
  fileUrl: null,
  fileKey: snapshotKey,
  fileSizeBytes: snapshotExported.fileSizeBytes,
  tableCount: snapshotExported.tableCount,
  rowCount: snapshotExported.rowCount,
});

const restored = await db.restoreOrganizationBackupData({
  organizationId,
  backup: parsed,
  restoredBy: Number(ctx.user.id),
  actorRole: String((ctx.user as any)?.role || ""),
});

      await db.markOrganizationBackupRestored({
  id: Number(snapshotBackupId),
  organizationId,
  restoredBy: Number(ctx.user.id),
  restoreReason: input.restoreReason,
});

      await db.createAuditLog({
        organizationId,
        actorUserId: Number(ctx.user.id),
        actorRole: String((ctx.user as any)?.role || ""),
        action: "organization.backup.restore",
        targetType: "organization_backup",
        targetId: Number(snapshotBackupId),
        memo: `회사 백업 복구 완료: ${restored.restoredTableCount}개 테이블 / ${restored.restoredRowCount}개 데이터 / 사유: ${input.restoreReason}`,
      } as any);

      return {
        success: true,
        previewOnly: false,
        message: "백업 복구가 완료되었습니다.",
        tableCount: restored.restoredTableCount,
        rowCount: restored.restoredRowCount,
      };
    }),
}),

audit: router({
  list: hostProcedure
    .input(
      z
        .object({
          organizationId: z.number().optional(),
          action: z.string().optional(),
          actorUserId: z.number().optional(),
          targetType: z.string().optional(),
          limit: z.number().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const isSuperhostUser = (ctx.user as any)?.role === "superhost";

      const organizationId = isSuperhostUser
        ? input?.organizationId
        : Number((ctx.user as any)?.organizationId || 0);

      if (!isSuperhostUser && !organizationId) {
        throw new Error("organizationId is required");
      }

if (!isSuperhostUser) {
  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowAuditLog",
    "현재 회사는 감사로그 기능을 사용할 수 없습니다."
  );
}

      return db.listAuditLogs({
        organizationId,
        isSuperhost: isSuperhostUser,
        action: input?.action,
        actorUserId: input?.actorUserId,
        targetType: input?.targetType,
        limit: input?.limit ?? 100,
      });
    }),
}),

studentAudit: router({
  list: protectedProcedure
    .input(
      z.object({
        studentId: z.number(),
        limit: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const organizationId = Number((ctx.user as any)?.organizationId || 0);

      if (!organizationId) {
        throw new Error("organizationId is required");
      }

      const student = await db.getStudent(input.studentId, {
        organizationId,
      });

      if (!student) {
        throw new Error("학생을 찾을 수 없습니다.");
      }
      return db.listStudentAuditLogs({
        organizationId,
        studentId: input.studentId,
        limit: input.limit ?? 100,
      });
    }),
}),

attendance: attendanceRouter,
notice: noticeRouter,
schedule: scheduleRouter,
  approval: approvalRouter,
privateCertificateMaster: privateCertificateMasterRouter,
subjectCatalog: subjectCatalogRouter,

  privateCertificate: router({
    list: protectedProcedure
      .input(
        z
          .object({
            assigneeId: z.number().optional(),
          })
          .optional()
      )
     .query(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPrivateCertificate",
    "현재 회사는 민간자격증 기능을 사용할 수 없습니다."
  );

  const assigneeId = isAdminOrHost(ctx.user)
    ? input?.assigneeId
    : Number(ctx.user.id);

  return db.listPrivateCertificateRequests(assigneeId, {
    organizationId,
  });
}),

    listByStudent: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
        })
      )
      .query(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPrivateCertificate",
    "현재 회사는 민간자격증 기능을 사용할 수 없습니다."
  );

  const student = await db.getStudent(input.studentId, {
    organizationId,
  });
        if (!student) return [];
        return db.listPrivateCertificateRequestsByStudent(input.studentId, {
  organizationId,
});
      }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          assigneeId: z.number(),
          clientName: z.string().min(1),
          phone: z.string().min(1),
          assigneeName: z.string().optional().nullable(),
          privateCertificateMasterId: z.number().optional().nullable(),
          certificateName: z.string().min(1),
          inputAddress: z.string().optional().nullable(),
          note: z.string().optional().nullable(),
          requestStatus: z
            .enum(["요청", "안내완료", "입금대기", "입금확인", "진행중", "완료", "취소"])
            .optional(),
          feeAmount: z.string().optional(),
	freelancerInputAmount: z.string().optional(),
          paymentStatus: z.enum(["결제대기", "결제", "환불", "취소"]).optional(),
          paidAt: z.string().optional().nullable(),
          attachmentName: z.string().optional().nullable(),
          attachmentUrl: z.string().optional().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPrivateCertificate",
    "현재 회사는 민간자격증 기능을 사용할 수 없습니다."
  );

  const student = await db.getStudent(input.studentId, {
    organizationId,
  });
        if (!student) throw new Error("학생을 찾을 수 없습니다.");

        assertStudentEditable({
  currentUser: ctx.user,
  student,
});

          const id = await db.createPrivateCertificateRequest({
 organizationId,
          studentId: input.studentId,
          assigneeId: input.assigneeId,
          clientName: input.clientName.trim(),
          phone: input.phone.trim(),
          assigneeName: input.assigneeName?.trim() || null,
          privateCertificateMasterId: input.privateCertificateMasterId ?? null,
          certificateName: input.certificateName.trim(),
          inputAddress: input.inputAddress?.trim() || null,
          note: input.note ?? null,
          requestStatus: input.requestStatus ?? "요청",
          feeAmount: input.feeAmount ?? "0",
          freelancerInputAmount: input.freelancerInputAmount ?? "0",
          paymentStatus: input.paymentStatus ?? "결제대기",
          paidAt: input.paidAt ? new Date(input.paidAt) : null,
          attachmentName: input.attachmentName?.trim() || null,
          attachmentUrl: input.attachmentUrl?.trim() || null,
        } as any);

        if ((input.paymentStatus ?? "결제대기") === "결제") {
          await db.syncPrivateCertificateSettlementItemByRequestId(
  Number(id),
  Number(ctx.user.id),
  {
    organizationId,
  }
);
        }
const createdRequest = await db.getPrivateCertificateRequest(Number(id), {
  organizationId,
});

await writeStudentAuditLog({
  ctx,
  studentId: Number(input.studentId),
  entityType: "private_certificate",
  entityId: Number(id),
  action: "create",
  title: "민간자격증 요청 생성",
  beforeJson: null,
  afterJson: createdRequest,
});

        return { success: true, id };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          assigneeId: z.number().optional(),
          assigneeName: z.string().optional().nullable(),
          privateCertificateMasterId: z.number().optional().nullable(),
          certificateName: z.string().optional(),
          inputAddress: z.string().optional().nullable(),
          note: z.string().optional().nullable(),
          requestStatus: z
            .enum(["요청", "안내완료", "입금대기", "입금확인", "진행중", "완료", "취소"])
            .optional(),
          feeAmount: z.string().optional(),
freelancerInputAmount: z.string().optional(),
          paymentStatus: z.enum(["결제대기", "결제", "환불", "취소"]).optional(),
          paidAt: z.string().optional().nullable(),
          attachmentName: z.string().optional().nullable(),
          attachmentUrl: z.string().optional().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPrivateCertificate",
    "현재 회사는 민간자격증 기능을 사용할 수 없습니다."
  );

const beforeRequest = await db.getPrivateCertificateRequest(input.id, {
  organizationId,
});

if (!beforeRequest) {
  throw new Error("민간자격증 요청을 찾을 수 없습니다.");
}

const student = await db.getStudent(beforeRequest.studentId, {
  organizationId,
});

if (!student) {
  throw new Error("학생을 찾을 수 없습니다.");
}

assertStudentEditable({
  currentUser: ctx.user,
  student,
});

  const data: any = {};

        if (input.assigneeId !== undefined) data.assigneeId = input.assigneeId;
        if (input.assigneeName !== undefined) data.assigneeName = input.assigneeName?.trim() || null;
        if (input.privateCertificateMasterId !== undefined)
          data.privateCertificateMasterId = input.privateCertificateMasterId ?? null;
        if (input.certificateName !== undefined) data.certificateName = input.certificateName.trim();
        if (input.inputAddress !== undefined) data.inputAddress = input.inputAddress?.trim() || null;
        if (input.note !== undefined) data.note = input.note ?? null;
        if (input.requestStatus !== undefined) data.requestStatus = input.requestStatus;
        if (input.feeAmount !== undefined) data.feeAmount = input.feeAmount;
if (input.freelancerInputAmount !== undefined) {
  data.freelancerInputAmount = input.freelancerInputAmount;
}
        if (input.paymentStatus !== undefined) data.paymentStatus = input.paymentStatus;
        if (input.paidAt !== undefined) data.paidAt = input.paidAt ? new Date(input.paidAt) : null;
        if (input.attachmentName !== undefined) data.attachmentName = input.attachmentName?.trim() || null;
        if (input.attachmentUrl !== undefined) data.attachmentUrl = input.attachmentUrl?.trim() || null;

console.log("[privateCertificate.update router] input =", input);
console.log("[privateCertificate.update router] data =", data);

        await db.updatePrivateCertificateRequest(input.id, data, {
  organizationId,
});

const afterRequest = await db.getPrivateCertificateRequest(input.id, {
  organizationId,
});

await writeStudentAuditLog({
  ctx,
  studentId: Number(student.id),
  entityType: "private_certificate",
  entityId: Number(input.id),
  action: "update",
  title: "민간자격증 요청 수정",
  beforeJson: beforeRequest,
  afterJson: afterRequest,
});

        return { success: true };
      }),

    delete: protectedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input, ctx }) => {
    const organizationId = Number((ctx.user as any)?.organizationId || 0);

    await assertOrganizationFeatureEnabled(
      organizationId,
      "allowPrivateCertificate",
      "현재 회사는 민간자격증 기능을 사용할 수 없습니다."
    );

    const beforeRequest = await db.getPrivateCertificateRequest(input.id, {
      organizationId,
    });

    if (!beforeRequest) {
      throw new Error("민간자격증 요청을 찾을 수 없습니다.");
    }

    const student = await db.getStudent(beforeRequest.studentId, {
      organizationId,
    });

    if (!student) {
      throw new Error("학생을 찾을 수 없습니다.");
    }

    assertStudentEditable({
      currentUser: ctx.user,
      student,
    });

    await db.deletePrivateCertificateRequest(input.id, {
      organizationId,
    });

    await writeStudentAuditLog({
      ctx,
      studentId: Number(student.id),
      entityType: "private_certificate",
      entityId: Number(input.id),
      action: "delete",
      title: "민간자격증 요청 삭제",
      beforeJson: beforeRequest,
      afterJson: null,
    });

    return { success: true };
  }),


    requestRefund: protectedProcedure
      .input(
        z.object({
          requestId: z.number(),
          refundAmount: z.string(),
          refundReason: z.string().optional().nullable(),
        })
      )
     .mutation(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPrivateCertificate",
    "현재 회사는 민간자격증 기능을 사용할 수 없습니다."
  );

  await db.requestPrivateCertificateRefund({
    organizationId,
          requestId: input.requestId,
          refundAmount: input.refundAmount,
          refundReason: input.refundReason ?? null,
        });

        return { success: true };
      }),

    approveRefund: protectedProcedure
      .input(
        z.object({
          requestId: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPrivateCertificate",
    "현재 회사는 민간자격증 기능을 사용할 수 없습니다."
  );

  if (!isAdminOrHost(ctx.user)) {
    throw new Error("관리자 또는 호스트만 환불 승인할 수 있습니다.");
  }

  await db.approvePrivateCertificateRefund({
    organizationId,
          requestId: input.requestId,
          approvedBy: Number(ctx.user.id),
        });

        return { success: true };
      }),
  }),

  practiceSupport: router({
    list: protectedProcedure
  .input(
    z
      .object({
        assigneeId: z.number().optional(),
        month: z.string().optional(),
        status: z.enum(["전체", "미섭외", "섭외중", "섭외완료"]).optional(),
        search: z.string().optional(),
      })
      .optional()
  )
  .query(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPracticeCenter",
    "현재 회사는 실습배정지원센터 기능을 사용할 수 없습니다."
  );

  const assigneeId = isAdminOrHost(ctx.user)
    ? input?.assigneeId
    : Number(ctx.user.id);

  return db.listPracticeSupportRequests({
    organizationId,
  assigneeId,
  month: input?.month,
  status: input?.status,
  search: input?.search,
});
  }),

    listByStudent: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
        })
      )
      .query(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPracticeCenter",
    "현재 회사는 실습배정지원센터 기능을 사용할 수 없습니다."
  );

  const student = await db.getStudent(input.studentId, {
    organizationId,
  });
        if (!student) return [];
       return db.listPracticeSupportRequestsByStudent(input.studentId, {
  organizationId,
});
      }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
     .query(async ({ input, ctx }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPracticeCenter",
    "현재 회사는 실습배정지원센터 기능을 사용할 수 없습니다."
  );

  return db.getPracticeSupportRequest(input.id, {
    organizationId,
  });
}),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          semesterId: z.number().optional().nullable(),
          assigneeId: z.number(),
          clientName: z.string().min(1),
          phone: z.string().min(1),
          assigneeName: z.string().optional().nullable(),
          managerName: z.string().optional().nullable(),
          course: z.string().min(1),
          inputAddress: z.string().optional().nullable(),
          detailAddress: z.string().optional().nullable(),
         practiceHours: z.number().optional().nullable(),
practiceDate: z.string().optional().nullable(),
includeEducationCenter: z.boolean().optional(),
          includePracticeInstitution: z.boolean().optional(),
          coordinationStatus: z.enum(["미섭외", "섭외중", "섭외완료"]).optional(),
          feeAmount: z.string().optional(),
          paymentStatus: z.enum(["미결제", "결제", "환불"]).optional(),
          paidAt: z.string().optional().nullable(),
          note: z.string().optional().nullable(),
          attachmentName: z.string().optional().nullable(),
          attachmentUrl: z.string().optional().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPracticeCenter",
    "현재 회사는 실습배정지원센터 기능을 사용할 수 없습니다."
  );

  const student = await db.getStudent(input.studentId, {
    organizationId,
  });

        if (!student) throw new Error("학생을 찾을 수 없습니다.");

        assertStudentEditable({
  currentUser: ctx.user,
  student,
});

         const id = await db.createPracticeSupportRequest({
  organizationId,
  studentId: input.studentId,
          semesterId: input.semesterId ?? null,
          assigneeId: input.assigneeId,
          clientName: input.clientName.trim(),
          phone: input.phone.trim(),
          assigneeName: input.assigneeName?.trim() || null,
          managerName: input.managerName?.trim() || null,
          course: input.course.trim(),
          inputAddress: input.inputAddress?.trim() || null,
          detailAddress: input.detailAddress?.trim() || null,
         practiceHours: input.practiceHours ?? null,
practiceDate: input.practiceDate ?? null, 
includeEducationCenter: input.includeEducationCenter ?? true,
          includePracticeInstitution: input.includePracticeInstitution ?? true,
          coordinationStatus: input.coordinationStatus ?? "미섭외",
          feeAmount: input.feeAmount ?? "0",
          paymentStatus: input.paymentStatus ?? "미결제",
          paidAt: input.paidAt ? new Date(input.paidAt) : null,
          note: input.note ?? null,
          attachmentName: input.attachmentName?.trim() || null,
          attachmentUrl: input.attachmentUrl?.trim() || null,
        } as any);

        if ((input.paymentStatus ?? "미결제") === "결제") {
          await db.syncPracticeSupportSettlementItemByRequestId(
  Number(id),
  Number(ctx.user.id),
  {
    organizationId,
  }
);
        }

const createdRequest = await db.getPracticeSupportRequest(Number(id), {
  organizationId,
});

await writeStudentAuditLog({
  ctx,
  studentId: Number(input.studentId),
  entityType: "practice_support",
  entityId: Number(id),
  action: "create",
  title: "실습 요청 생성",
  beforeJson: null,
  afterJson: createdRequest,
});

        return { success: true, id };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          semesterId: z.number().optional().nullable(),
          assigneeId: z.number().optional(),
          clientName: z.string().optional(),
          phone: z.string().optional(),
          assigneeName: z.string().optional().nullable(),
          managerName: z.string().optional().nullable(),
          course: z.string().optional(),
          inputAddress: z.string().optional().nullable(),
          detailAddress: z.string().optional().nullable(),
          practiceHours: z.number().optional().nullable(),
practiceDate: z.string().optional().nullable(),
includeEducationCenter: z.boolean().optional(),
          includePracticeInstitution: z.boolean().optional(),
          coordinationStatus: z.enum(["미섭외", "섭외중", "섭외완료"]).optional(),
          feeAmount: z.string().optional(),
          paymentStatus: z.enum(["미결제", "결제", "환불"]).optional(),
          paidAt: z.string().optional().nullable(),
          note: z.string().optional().nullable(),
          attachmentName: z.string().optional().nullable(),
          attachmentUrl: z.string().optional().nullable(),

selectedEducationCenterId: z.number().optional().nullable(),
selectedEducationCenterName: z.string().optional().nullable(),
selectedEducationCenterAddress: z.string().optional().nullable(),
selectedEducationCenterDistanceKm: z.string().optional().nullable(),

selectedPracticeInstitutionId: z.number().optional().nullable(),
selectedPracticeInstitutionName: z.string().optional().nullable(),
selectedPracticeInstitutionAddress: z.string().optional().nullable(),
selectedPracticeInstitutionDistanceKm: z.string().optional().nullable(),
        })
      )
          .mutation(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPracticeCenter",
    "현재 회사는 실습배정지원센터 기능을 사용할 수 없습니다."
  );

const beforeRequest = await db.getPracticeSupportRequest(input.id, {
  organizationId,
});

if (!beforeRequest) {
  throw new Error("실습 요청을 찾을 수 없습니다.");
}

const student = await db.getStudent(beforeRequest.studentId, {
  organizationId,
});

if (!student) {
  throw new Error("학생을 찾을 수 없습니다.");
}

assertStudentEditable({
  currentUser: ctx.user,
  student,
});

  const data: any = {};

        if (input.semesterId !== undefined) data.semesterId = input.semesterId ?? null;
        if (input.assigneeId !== undefined) data.assigneeId = input.assigneeId;
        if (input.clientName !== undefined) data.clientName = input.clientName.trim();
        if (input.phone !== undefined) data.phone = input.phone.trim();
        if (input.assigneeName !== undefined) data.assigneeName = input.assigneeName?.trim() || null;
        if (input.managerName !== undefined) data.managerName = input.managerName?.trim() || null;
        if (input.course !== undefined) data.course = input.course.trim();
        if (input.inputAddress !== undefined) data.inputAddress = input.inputAddress?.trim() || null;
        if (input.detailAddress !== undefined) data.detailAddress = input.detailAddress?.trim() || null;
        if (input.practiceHours !== undefined) data.practiceHours = input.practiceHours ?? null;
if (input.practiceDate !== undefined)
  data.practiceDate = input.practiceDate ?? null;
        if (input.includeEducationCenter !== undefined) data.includeEducationCenter = input.includeEducationCenter;
        if (input.includePracticeInstitution !== undefined)
          data.includePracticeInstitution = input.includePracticeInstitution;
        if (input.coordinationStatus !== undefined) data.coordinationStatus = input.coordinationStatus;
        if (input.feeAmount !== undefined) data.feeAmount = input.feeAmount;
        if (input.paymentStatus !== undefined) data.paymentStatus = input.paymentStatus;
        if (input.paidAt !== undefined) data.paidAt = input.paidAt ? new Date(input.paidAt) : null;
        if (input.note !== undefined) data.note = input.note ?? null;
        if (input.attachmentName !== undefined) data.attachmentName = input.attachmentName?.trim() || null;
        if (input.attachmentUrl !== undefined) data.attachmentUrl = input.attachmentUrl?.trim() || null;

if (input.selectedEducationCenterId !== undefined) {
  data.selectedEducationCenterId = input.selectedEducationCenterId ?? null;
}
if (input.selectedEducationCenterName !== undefined) {
  data.selectedEducationCenterName =
    input.selectedEducationCenterName?.trim() || null;
}
if (input.selectedEducationCenterAddress !== undefined) {
  data.selectedEducationCenterAddress =
    input.selectedEducationCenterAddress?.trim() || null;
}
if (input.selectedEducationCenterDistanceKm !== undefined) {
  data.selectedEducationCenterDistanceKm =
    input.selectedEducationCenterDistanceKm?.trim() || null;
}

if (input.selectedPracticeInstitutionId !== undefined) {
  data.selectedPracticeInstitutionId =
    input.selectedPracticeInstitutionId ?? null;
}
if (input.selectedPracticeInstitutionName !== undefined) {
  data.selectedPracticeInstitutionName =
    input.selectedPracticeInstitutionName?.trim() || null;
}
if (input.selectedPracticeInstitutionAddress !== undefined) {
  data.selectedPracticeInstitutionAddress =
    input.selectedPracticeInstitutionAddress?.trim() || null;
}
if (input.selectedPracticeInstitutionDistanceKm !== undefined) {
  data.selectedPracticeInstitutionDistanceKm =
    input.selectedPracticeInstitutionDistanceKm?.trim() || null;
}

if (Object.keys(data).length === 0) {
  throw new Error("수정할 값이 없습니다.");
}

        await db.updatePracticeSupportRequest(input.id, data, {
 organizationId,
});

const afterRequest = await db.getPracticeSupportRequest(input.id, {
  organizationId,
});

await writeStudentAuditLog({
  ctx,
  studentId: Number(student.id),
  entityType: "practice_support",
  entityId: Number(input.id),
  action: "update",
  title: "실습 요청 수정",
  beforeJson: beforeRequest,
  afterJson: afterRequest,
});

       if (input.paymentStatus === "결제") {
  await db.syncPracticeSupportSettlementItemByRequestId(
  Number(input.id),
  Number(ctx.user.id),
  {
    organizationId,
  }
);
}
        return { success: true };
      }),

    delete: protectedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ input, ctx }) => {
    const organizationId = Number((ctx.user as any)?.organizationId || 0);

    await assertOrganizationFeatureEnabled(
      organizationId,
      "allowPracticeCenter",
      "현재 회사는 실습배정지원센터 기능을 사용할 수 없습니다."
    );

    const beforeRequest = await db.getPracticeSupportRequest(input.id, {
      organizationId,
    });

    if (!beforeRequest) {
      throw new Error("실습 요청을 찾을 수 없습니다.");
    }

    const student = await db.getStudent(beforeRequest.studentId, {
      organizationId,
    });

    if (!student) {
      throw new Error("학생을 찾을 수 없습니다.");
    }

    assertStudentEditable({
      currentUser: ctx.user,
      student,
    });

    await db.deletePracticeSupportRequest(input.id, {
      organizationId,
    });

    await writeStudentAuditLog({
      ctx,
      studentId: Number(student.id),
      entityType: "practice_support",
      entityId: Number(input.id),
      action: "delete",
      title: "실습 요청 삭제",
      beforeJson: beforeRequest,
      afterJson: null,
    });

    return { success: true };
  }),


    requestRefund: protectedProcedure
      .input(
        z.object({
          requestId: z.number(),
          refundAmount: z.string(),
          refundReason: z.string().optional().nullable(),
        })
      )
     .mutation(async ({ input, ctx }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPracticeCenter",
    "현재 회사는 실습배정지원센터 기능을 사용할 수 없습니다."
  );

  await db.requestPracticeSupportRefund({
    organizationId,
    requestId: input.requestId,
          refundAmount: input.refundAmount,
          refundReason: input.refundReason ?? null,
        });

        return { success: true };
      }),

    approveRefund: protectedProcedure
      .input(
        z.object({
          requestId: z.number(),
        })
      )
     .mutation(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPracticeCenter",
    "현재 회사는 실습배정지원센터 기능을 사용할 수 없습니다."
  );

  if (!isAdminOrHost(ctx.user)) {
    throw new Error("관리자 또는 호스트만 환불 승인할 수 있습니다.");
  }

  await db.approvePracticeSupportRefund({
    organizationId,
  requestId: input.requestId,
  approvedBy: Number(ctx.user.id),
});

        return { success: true };
      }),

upsertByStudent: protectedProcedure
  .input(
    z.object({
      studentId: z.number(),
      semesterId: z.number().optional().nullable(),
      assigneeId: z.number(),
      clientName: z.string().min(1),
      phone: z.string().min(1),
      course: z.string().min(1),
      inputAddress: z.string().optional().nullable(),
      detailAddress: z.string().optional().nullable(),
      assigneeName: z.string().optional().nullable(),
      managerName: z.string().optional().nullable(),
      practiceHours: z.number().optional().nullable(),
      practiceDate: z.string().optional().nullable(),
      includeEducationCenter: z.boolean().optional(),
      includePracticeInstitution: z.boolean().optional(),
      coordinationStatus: z.enum(["미섭외","섭외중","섭외완료"]).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowPracticeCenter",
    "현재 회사는 실습배정지원센터 기능을 사용할 수 없습니다."
  );

const student = await db.getStudent(input.studentId, {
  organizationId,
});

if (!student) {
  throw new Error("학생을 찾을 수 없습니다.");
}

assertStudentEditable({
  currentUser: ctx.user,
  student,
});

  return db.upsertPracticeSupportRequestByStudent({
    organizationId,
    ...input,
  });
}),
  }),

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, {
        ...cookieOptions,
        maxAge: -1,
      });
      return { success: true } as const;
    }),
  }),

  users: router({
  list: protectedProcedure.query(async ({ ctx }) => {
  return db.getAllUsersDetailed({
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  });
}),

  me: protectedProcedure.query(async ({ ctx }) => {
    return await db.getMyProfile(Number(ctx.user.id));
  }),

  updateMyPhoto: protectedProcedure
    .input(
      z.object({
        profileImageUrl: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return await db.updateMyProfilePhoto({
        userId: Number(ctx.user.id),
        profileImageUrl: input.profileImageUrl,
      });
    }),

  changeMyPassword: protectedProcedure
    .input(
      z.object({
        newPassword: z.string().min(8),
        newPasswordConfirm: z.string().min(8),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (input.newPassword !== input.newPasswordConfirm) {
        throw new Error("새 비밀번호가 서로 일치하지 않습니다.");
      }

      return await db.changeMyPassword({
        userId: Number(ctx.user.id),
        newPassword: input.newPassword,
      });
    }),

  create: hostProcedure
    .input(
      z.object({
        openId: z.string().min(1),
        username: z.string().min(1),
        password: z.string().min(4),
        name: z.string().min(1),
        email: z.string().optional(),
        phone: z.string().optional(),
        role: z.enum(["staff", "admin", "host"]).default("staff"),
        bankName: z.string().optional(),
        bankAccount: z.string().optional(),
      })
    )
   .mutation(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  const limitStatus = await getOrganizationLimitStatus(organizationId);

  if (limitStatus.exceeded.users) {
    throw new Error(
      `사용자 수 제한을 초과했습니다. 현재 ${limitStatus.usage.userCount}명 / 제한 ${limitStatus.limits.maxUsers}명`
    );
  }

  const passwordHash = await bcrypt.hash(input.password, 10);

  await db.createUserAccount({
    organizationId,
        openId: input.openId.trim(),
        username: input.username.trim(),
        passwordHash,
        name: input.name.trim(),
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        role: input.role,
        bankName: input.bankName?.trim() || null,
        bankAccount: input.bankAccount?.trim() || null,
        loginMethod: "manual",
        isActive: true,
      });

      return { success: true };
    }),

  update: hostProcedure
    .input(
      z.object({
        id: z.number(),
        username: z.string().optional(),
        password: z.string().optional(),
        name: z.string().optional(),
        email: z.string().optional(),
        phone: z.string().optional(),
        bankName: z.string().optional(),
        bankAccount: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, password, ...rest } = input;

      let passwordHash: string | undefined = undefined;

      if (password !== undefined && password.trim() !== "") {
        passwordHash = await bcrypt.hash(password, 10);
      }

     await db.updateUserAccount(
  id,
  {
    username: rest.username?.trim(),
    name: rest.name?.trim(),
    email: rest.email?.trim(),
    phone: rest.phone?.trim(),
    bankName: rest.bankName?.trim(),
    bankAccount: rest.bankAccount?.trim(),
    passwordHash,
  },
  {
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  }
);

      return { success: true };
    }),

  updateRole: hostProcedure
    .input(
      z.object({
        id: z.number(),
        role: z.enum(["staff", "admin", "host"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db.updateUserRole(
  input.id,
  input.role,
  {
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  }
);

      return { success: true };
    }),

  updateActive: hostProcedure
    .input(
      z.object({
        id: z.number(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db.updateUserActive(
  input.id,
  input.isActive,
  {
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  }
);

      return { success: true };
    }),
}),

org: router({
  teams: router({
    list: protectedProcedure.query(async ({ ctx }) => {
  return db.listTeams({
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  });
}),

    create: hostProcedure
      .input(
        z.object({
          name: z.string().min(1),
          sortOrder: z.number().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  const id = await db.createTeam({
    organizationId: Number((ctx.user as any)?.organizationId || 0),
    name: input.name,
          sortOrder: input.sortOrder ?? 0,
          isActive: input.isActive ?? true,
        });

        return { success: true, id };
      }),

    update: hostProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          sortOrder: z.number().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  await db.updateTeam(
    input.id,
    {
      name: input.name,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
    },
    {
      organizationId: Number((ctx.user as any)?.organizationId || 0),
    }
  );

        return { success: true };
      }),

    delete: hostProcedure
      .input(
        z.object({
          id: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  await db.deleteTeam(input.id, {
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  });
        return { success: true };
      }),
  }),

  positions: router({
    list: protectedProcedure.query(async ({ ctx }) => {
  return db.listPositions({
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  });
}),

    create: hostProcedure
      .input(
        z.object({
          name: z.string().min(1),
          sortOrder: z.number().optional(),
          isActive: z.boolean().optional(),
settlementUnitAmount: z.string().optional(),
        })
      )
     .mutation(async ({ ctx, input }) => {
  const id = await db.createPosition({
    organizationId: Number((ctx.user as any)?.organizationId || 0),
    name: input.name,
    sortOrder: input.sortOrder ?? 0,
    isActive: input.isActive ?? true,
    settlementUnitAmount: input.settlementUnitAmount ?? "0",
  });

  return { success: true, id };
}),

    update: hostProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          sortOrder: z.number().optional(),
          isActive: z.boolean().optional(),
settlementUnitAmount: z.string().optional(),
        })
      )
     .mutation(async ({ ctx, input }) => {
  await db.updatePosition(
    input.id,
    {
      name: input.name,
      sortOrder: input.sortOrder,
      isActive: input.isActive,
      settlementUnitAmount: input.settlementUnitAmount,
    },
    {
      organizationId: Number((ctx.user as any)?.organizationId || 0),
    }
  );

  return { success: true };
}),

    delete: hostProcedure
      .input(
        z.object({
          id: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  await db.deletePosition(input.id, {
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  });
        return { success: true };
      }),
  }),

  userMappings: router({
    get: protectedProcedure
      .input(
        z.object({
          userId: z.number(),
        })
      )
      .query(async ({ ctx, input }) => {
  return db.getUserOrgMapping(input.userId, {
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  });
}),

    upsert: hostProcedure
      .input(
        z.object({
          userId: z.number(),
          teamId: z.number().nullable().optional(),
          positionId: z.number().nullable().optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const id = await db.upsertUserOrgMappingProtected({
organizationId: Number((ctx.user as any)?.organizationId || 0),
          actorRole: ctx.user.role,
          targetUserId: input.userId,
          teamId: input.teamId ?? null,
          positionId: input.positionId ?? null,
          sortOrder: input.sortOrder ?? 0,
        });

        return { success: true, id };
      }),

    delete: hostProcedure
      .input(
        z.object({
          userId: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
  await db.deleteUserOrgMapping(input.userId, {
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  });
        return { success: true };
      }),
  }),
}),

messenger: router({
  myRooms: protectedProcedure.query(async ({ ctx }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowMessenger",
    "현재 회사는 메신저 기능을 사용할 수 없습니다."
  );

  return db.listMyChatRooms(Number(ctx.user.id), {
    organizationId,
  });
}),

  directRoom: protectedProcedure
    .input(
      z.object({
        userId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowMessenger",
    "현재 회사는 메신저 기능을 사용할 수 없습니다."
  );

  const room = await db.getOrCreateDirectChatRoom({
    organizationId,
  actorUserId: Number(ctx.user.id),
  otherUserId: input.userId,
});

      return {
        success: true,
        room,
      };
    }),

  messages: protectedProcedure
    .input(
      z.object({
        roomId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowMessenger",
    "현재 회사는 메신저 기능을 사용할 수 없습니다."
  );

  return db.listChatMessages(input.roomId, Number(ctx.user.id), {
    organizationId,
  });
}),

  members: protectedProcedure
    .input(
      z.object({
        roomId: z.number(),
      })
    )
    .query(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowMessenger",
    "현재 회사는 메신저 기능을 사용할 수 없습니다."
  );

  return db.listChatRoomMembers(input.roomId, Number(ctx.user.id), {
    organizationId,
  });
}),

  sendMessage: protectedProcedure
    .input(
      z.object({
        roomId: z.number(),
        content: z.string().optional(),
        messageType: z.enum(["text", "image", "file", "system"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowMessenger",
    "현재 회사는 메신저 기능을 사용할 수 없습니다."
  );

  const messageId = await db.createChatMessage({
    organizationId,
  roomId: input.roomId,
  senderId: Number(ctx.user.id),
  messageType: input.messageType ?? "text",
  content: input.content ?? null,
});

      return {
  success: true,
  id: Number(messageId),
  roomId: Number(input.roomId),
  senderId: Number(ctx.user.id),
  content: input.content ?? null,
  messageType: input.messageType ?? "text",
};
    }),

  markRead: protectedProcedure
    .input(
      z.object({
        roomId: z.number(),
        lastReadMessageId: z.number().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowMessenger",
    "현재 회사는 메신저 기능을 사용할 수 없습니다."
  );

  await db.markChatRoomRead({
    organizationId,
  roomId: input.roomId,
  userId: Number(ctx.user.id),
  lastReadMessageId: input.lastReadMessageId,
});

      return { success: true };
    }),

  addAttachment: protectedProcedure
    .input(
      z.object({
        messageId: z.number(),
        fileName: z.string().min(1),
        fileUrl: z.string().min(1),
        fileType: z.string().optional(),
        fileSize: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowMessenger",
    "현재 회사는 메신저 기능을 사용할 수 없습니다."
  );

  const id = await db.createChatAttachment({
    organizationId,
        messageId: input.messageId,
        fileName: input.fileName,
        fileUrl: input.fileUrl,
        fileType: input.fileType ?? null,
        fileSize: input.fileSize ?? null,
      });

      return { success: true, id };
    }),
}),

  formAdmin: router({
  list: hostProcedure
    .input(z.object({
      formType: z.enum(["landing", "ad"]),
    }))
    .query(async ({ input, ctx }) => {
  return db.listLeadForms(input.formType, {
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  });
}),

  create: hostProcedure
  .input(z.object({
    assigneeId: z.number(),
    formType: z.enum(["landing", "ad"]),
    blueprintId: z.number().optional(),
  }))
    .mutation(async ({ input, ctx }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  const limitStatus = await getOrganizationLimitStatus(organizationId);

  if (limitStatus.exceeded.landingForms) {
    throw new Error(
      `랜딩/광고폼 생성 제한을 초과했습니다. 현재 ${limitStatus.usage.landingFormCount}개 / 제한 ${limitStatus.limits.maxLandingForms}개`
    );
  }

  if (input.blueprintId) {
  return db.createLeadFormFromBlueprint({
  organizationId,
  blueprintId: input.blueprintId,
  assigneeId: input.assigneeId,
});
}
// 👉 없으면 기존 방식
return db.createLeadForm(input.assigneeId, input.formType, {
  organizationId,
});
}),

  updateActive: hostProcedure
    .input(z.object({
      id: z.number(),
      isActive: z.boolean(),
    }))
   .mutation(async ({ input, ctx }) => {
  return db.updateLeadFormActive(input.id, input.isActive, {
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  });
}),

  getTemplate: hostProcedure
  .input(
    z.object({
      formType: z.enum(["landing", "ad"]),
    })
  )
 .query(async ({ input, ctx }) => {
  const template = await db.getLeadFormTemplate(input.formType, {
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  });

    return {
      success: true,
      uiConfig: template?.uiConfigJson
        ? JSON.parse(template.uiConfigJson)
        : {},
    };
  }),

renameTemplate: protectedProcedure
  .input(
    z.object({
      formType: z.enum(["landing", "ad"]),
      oldTemplateName: z.string().min(1),
      newTemplateName: z.string().min(1),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const updated = await db.renameNamedLeadFormTemplate({
  organizationId: Number((ctx.user as any)?.organizationId || 0),
  formType: input.formType,
      oldTemplateName: input.oldTemplateName.trim(),
      newTemplateName: input.newTemplateName.trim(),
      actorUserId: Number(ctx.user.id),
    });

    return {
      ok: true,
      token: updated?.token,
    };
  }),

  saveTemplate: hostProcedure
    .input(
      z.object({
        formType: z.enum(["landing", "ad"]),
        uiConfig: publicFormUiConfigSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await db.saveLeadFormTemplate({
  organizationId: Number((ctx.user as any)?.organizationId || 0),
  formType: input.formType,
        actorUserId: Number(ctx.user.id),
        uiConfig: input.uiConfig,
      });

      return { success: true, id };
    }),

  saveUiConfig: hostProcedure
  .input(
    z.object({
      id: z.number(),
      uiConfig: publicFormUiConfigSchema,
    })
  )
  .mutation(async ({ input, ctx }) => {
  await db.updateLeadFormUiConfig(input.id, input.uiConfig, {
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  });
    return { success: true };
  }),

  saveMyUiConfig: protectedProcedure
    .input(
      z.object({
        token: z.string(),
        formType: z.enum(["landing", "ad"]),
        uiConfig: publicFormUiConfigSchema,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await db.updateMyLeadFormUiConfig({
  organizationId: Number((ctx.user as any)?.organizationId || 0),
  token: input.token,
        formType: input.formType,
        userId: Number(ctx.user.id),
        uiConfig: input.uiConfig,
      });

      return { success: true, id };
    }),

listTemplates: protectedProcedure
  .input(
    z.object({
      formType: z.enum(["landing", "ad"]),
    })
  )
 .query(async ({ input, ctx }) => {
  const rows = await db.listLeadFormTemplates(input.formType, {
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  });

    const items = rows.map((row) => {
      let parsed: any = {};

      try {
        parsed = row.uiConfigJson ? JSON.parse(row.uiConfigJson) : {};
      } catch {
        parsed = {};
      }

      return {
        id: row.id,
        token: row.token,
        templateName: row.templateName,
        formType: row.formType,
        description: parsed?.description || "",
        tags: parsed?.tags || "",
        isPinned: Boolean(parsed?.isPinned),
        lastUsedAt: parsed?.lastUsedAt || "",
        canvas: parsed?.canvas || null,
      };
    });

    items.sort((a, b) => {
      if (a.isPinned !== b.isPinned) {
        return a.isPinned ? -1 : 1;
      }

      const aLast = a.lastUsedAt ? new Date(a.lastUsedAt).getTime() : 0;
      const bLast = b.lastUsedAt ? new Date(b.lastUsedAt).getTime() : 0;

      if (aLast !== bLast) {
        return bLast - aLast;
      }

      return Number(b.id || 0) - Number(a.id || 0);
    });

    return items;
  }),

saveAsTemplate: protectedProcedure
  .input(
    z.object({
      formType: z.enum(["landing", "ad"]),
      templateName: z.string().min(1),
      uiConfig: publicFormUiConfigSchema,
    })
  )
  .mutation(async ({ input, ctx }) => {
    const saved = await db.saveNamedLeadFormTemplate({
  organizationId: Number((ctx.user as any)?.organizationId || 0),
  formType: input.formType,
      templateName: input.templateName.trim(),
      uiConfig: input.uiConfig,
      actorUserId: Number(ctx.user.id),
    });

    return {
      ok: true,
      token: saved?.token,
    };
  }),

applyTemplateToMyForm: protectedProcedure
  .input(
    z.object({
      formType: z.enum(["landing", "ad"]),
      templateName: z.string().min(1),
      targetToken: z.string().min(1),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const updated = await db.applyNamedLeadFormTemplateToToken({
  organizationId: Number((ctx.user as any)?.organizationId || 0),
  formType: input.formType,
      templateName: input.templateName.trim(),
      targetToken: input.targetToken,
      actorUserId: Number(ctx.user.id),
    });

    return {
      ok: true,
      token: updated?.token,
    };
  }),

deleteTemplate: protectedProcedure
  .input(
    z.object({
      formType: z.enum(["landing", "ad"]),
      templateName: z.string().min(1),
    })
  )
  .mutation(async ({ input, ctx }) => {
    await db.deleteNamedLeadFormTemplate(
  input.formType,
  input.templateName.trim(),
  Number(ctx.user.id),
  {
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  }
);

    return {
      ok: true,
    };
  }),

duplicateTemplate: protectedProcedure
  .input(
    z.object({
      formType: z.enum(["landing", "ad"]),
      sourceTemplateName: z.string().min(1),
      newTemplateName: z.string().min(1),
    })
  )
  .mutation(async ({ input, ctx }) => {
    const created = await db.duplicateNamedLeadFormTemplate({
  organizationId: Number((ctx.user as any)?.organizationId || 0),
  formType: input.formType,
      sourceTemplateName: input.sourceTemplateName.trim(),
      newTemplateName: input.newTemplateName.trim(),
      actorUserId: Number(ctx.user.id),
    });

    return {
      ok: true,
      token: created?.token,
    };
  }),

}),

formBlueprintAdmin: router({
  list: hostProcedure
    .input(
      z.object({
        formType: z.enum(["landing", "ad"]),
      })
    )
    .query(async ({ input, ctx }) => {
      assertHostOrSuperhost(ctx.user);
      return db.listFormBlueprints(
  input.formType,
  {
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  }
);
    }),

  getById: hostProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .query(async ({ input, ctx }) => {
      assertHostOrSuperhost(ctx.user);

      const row = await db.getFormBlueprintById(
  input.id,
  {
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  }
);
      if (!row) {
        throw new Error("뼈대를 찾을 수 없습니다.");
      }

      return row;
    }),

  create: hostProcedure
    .input(
      z.object({
        formType: z.enum(["landing", "ad"]),
        name: z.string().min(1),
        description: z.string().nullable().optional(),
        uiConfig: publicFormUiConfigSchema,
      })
    )
    .mutation(async ({ input, ctx }) => {
      assertHostOrSuperhost(ctx.user);

      const created = await db.createFormBlueprint({
organizationId: Number((ctx.user as any)?.organizationId || 0),
        formType: input.formType,
        name: input.name,
        description: input.description ?? null,
        uiConfig: input.uiConfig,
        createdBy: Number(ctx.user.id),
      });

      return {
        ok: true,
        blueprint: created,
      };
    }),

  update: hostProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().nullable().optional(),
        uiConfig: publicFormUiConfigSchema.optional(),
        isActive: z.boolean().optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      assertHostOrSuperhost(ctx.user);

      const updated = await db.updateFormBlueprint({
organizationId: Number((ctx.user as any)?.organizationId || 0),
        id: input.id,
        name: input.name,
        description: input.description,
        uiConfig: input.uiConfig,
        isActive: input.isActive,
        isDefault: input.isDefault,
      });

      return {
        ok: true,
        blueprint: updated,
      };
    }),

  delete: hostProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      assertHostOrSuperhost(ctx.user);

      await db.deleteFormBlueprint(
  input.id,
  {
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  }
);

      return {
        ok: true,
      };
    }),

  createFormFromBlueprint: hostProcedure
    .input(
      z.object({
        blueprintId: z.number(),
        assigneeId: z.number(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      assertHostOrSuperhost(ctx.user);

      const created = await db.createLeadFormFromBlueprint({
  organizationId: Number((ctx.user as any)?.organizationId || 0),
  blueprintId: input.blueprintId,
  assigneeId: input.assigneeId,
});

      return {
        ok: true,
        token: created.token,
      };
    }),
}),

publicForm: router({
  getByToken: publicProcedure
    .input(
      z.object({
        token: z.string(),
        formType: z.enum(["landing", "ad"]),
      })
    )
    .query(async ({ input }) => {
      return db.getPublicFormByToken(input.token, input.formType);
    }),

  submit: publicProcedure
    .input(
      z.object({
        token: z.string(),
        formType: z.enum(["landing", "ad"]),
        clientName: z.string().min(1),
        phone: z.string().min(10),
        finalEducation: z.string().min(1),
        desiredCourse: z.string().min(1),
        channel: z.string().min(1),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const form = await db.getPublicFormByToken(
        input.token,
        input.formType
      );

      if (!form?.ok) {
        throw new Error("유효하지 않은 폼입니다.");
      }

const id = await db.createConsultation({
  organizationId: Number((form as any)?.form?.organizationId || 0),
  consultDate: new Date(),
  channel: input.channel,
  clientName: input.clientName,
  phone: input.phone,
  finalEducation: input.finalEducation,
  desiredCourse: input.desiredCourse,
  notes: input.notes ?? "",
  status: "상담중",
  assigneeId: form.assigneeId,
} as any);

return { success: true, id };

    }),
}),

notification: router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.listNotifications(Number(ctx.user.id), {
  organizationId: Number(ctx.user.organizationId || 0),
});
  }),

  markRead: protectedProcedure
    .input(
      z.object({
        id: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await db.markNotificationRead(input.id, Number(ctx.user.id), {
  organizationId: Number(ctx.user.organizationId || 0),
});
      return { success: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await db.markAllNotificationsRead(Number(ctx.user.id), {
  organizationId: Number(ctx.user.organizationId || 0),
});
    return { success: true };
  }),
}),

branding: router({
  getPublic: publicProcedure.query(async () => {
    return {
      organizationId: null,
      companyName: "위드원 교육",
      companyLogoUrl: null,
      messengerSubtitle: "사내 메신저",
    };
  }),

  get: protectedProcedure.query(async ({ ctx }) => {
    return db.getBrandingSettings({
      organizationId: Number((ctx.user as any)?.organizationId || 0),
    });
  }),

  save: hostProcedure
    .input(
      z.object({
        companyName: z.string().min(1),
        companyLogoUrl: z.string().optional().nullable(),
        messengerSubtitle: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const id = await db.saveBrandingSettings({
  organizationId: Number((ctx.user as any)?.organizationId || 0),
  companyName: input.companyName.trim(),
        companyLogoUrl: input.companyLogoUrl?.trim() || null,
        messengerSubtitle: input.messengerSubtitle.trim(),
        createdBy: Number(ctx.user.id),
        updatedBy: Number(ctx.user.id),
      } as any);

      return { success: true, id };
    }),
}),

  mobile: router({
  registerPushToken: publicProcedure
    .input(
      z.object({
        userId: z.number(),
        platform: z.string().min(1),
        expoPushToken: z.string().min(1),
        secret: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      if (input.secret !== process.env.MOBILE_TOKEN_SECRET) {
        throw new Error("인증에 실패했습니다.");
      }

      const user = await db.getUserById(input.userId);

if (!user) {
  throw new Error("유저를 찾을 수 없습니다.");
}

const id = await db.upsertDeviceToken({
  organizationId: Number((user as any).organizationId || 0),
  userId: input.userId,
  platform: input.platform,
  expoPushToken: input.expoPushToken,
});

      return { success: true, id };
    }),
}),

  educationInstitution: router({
    list: protectedProcedure.query(async ({ ctx }) => {
  return db.listEducationInstitutions({
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  });
}),

    create: hostProcedure
      .input(
        z.object({
          name: z.string().min(1),
          sortOrder: z.number().optional(),
settlementType: z.enum(["credit", "subject", "fixed"]).optional(),
unitCostAmount: z.string().optional(),
normalSubjectPrice: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
  const id = await db.createEducationInstitution({
    organizationId: Number((ctx.user as any)?.organizationId || 0),
    name: input.name.trim(),
    isActive: true,
    sortOrder: input.sortOrder ?? 0,
    settlementType: input.settlementType ?? "credit",
    unitCostAmount: input.unitCostAmount ?? "0",
    normalSubjectPrice: input.normalSubjectPrice ?? "75000",
  });

  return { id, success: true };
}),

    update: hostProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().optional(),
          isActive: z.boolean().optional(),
          sortOrder: z.number().optional(),
settlementType: z.enum(["credit", "subject", "fixed"]).optional(),
unitCostAmount: z.string().optional(),
normalSubjectPrice: z.string().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
  const { id, ...rest } = input;

  await db.updateEducationInstitution(id, rest, {
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  });

  return { success: true };
}),
  }),

  settlementSystem: router({
    listInstitutionPositionRates: protectedProcedure
      .input(
        z
          .object({
            educationInstitutionId: z.number().optional(),
          })
          .optional()
      )
     .query(async ({ input, ctx }) => {
  return db.listEducationInstitutionPositionRates(
    input?.educationInstitutionId,
    {
      organizationId: Number((ctx.user as any)?.organizationId || 0),
    }
  );
}),

    getInstitutionPositionRate: protectedProcedure
      .input(
        z.object({
          educationInstitutionId: z.number(),
          positionId: z.number(),
        })
      )
      .query(async ({ input, ctx }) => {
  return db.getEducationInstitutionPositionRate(
    input.educationInstitutionId,
    input.positionId,
    {
      organizationId: Number((ctx.user as any)?.organizationId || 0),
    }
  );
}),

    upsertInstitutionPositionRate: hostProcedure
      .input(
        z.object({
          educationInstitutionId: z.number(),
          positionId: z.number(),
          freelancerUnitAmount: z.string(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ input, ctx }) => {
  const id = await db.upsertEducationInstitutionPositionRate({
    organizationId: Number((ctx.user as any)?.organizationId || 0),
    educationInstitutionId: input.educationInstitutionId,
    positionId: input.positionId,
    freelancerUnitAmount: input.freelancerUnitAmount,
    isActive: input.isActive ?? true,
  });

  return { success: true, id };
}),

    deleteInstitutionPositionRate: hostProcedure
      .input(
        z.object({
          id: z.number(),
        })
      )
      .mutation(async ({ input, ctx }) => {
  await db.deleteEducationInstitutionPositionRate(input.id, {
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  });

  return { success: true };
}),

    listPrivateCertificateMastersForSettlement: protectedProcedure.query(
  async ({ ctx }) => {
    const organizationId = Number((ctx.user as any)?.organizationId || 0);

    if (!organizationId) {
      throw new Error("organizationId is required");
    }

    return db.listPrivateCertificateMasters({
      organizationId,
      activeOnly: false,
    });
  }
),

getSettings: protectedProcedure.query(async ({ ctx }) => {
  return db.getSettlementSettings({
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  });
}),

    saveSettings: hostProcedure
      .input(
        z.object({
          payoutDay: z.number().min(1).max(31),
        })
      )
      .mutation(async ({ input, ctx }) => {
  const id = await db.saveSettlementSettings({
    organizationId: Number((ctx.user as any)?.organizationId || 0),
    payoutDay: input.payoutDay,
  });

  return { success: true, id };
}),

    backfillSettlementItems: hostProcedure
      .mutation(async ({ ctx }) => {
        return await db.backfillSettlementItems(Number(ctx.user.id), {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
      }),

cleanupOrphanSettlementItems: hostProcedure
  .mutation(async ({ ctx }) => {
    return await db.cleanupOrphanSettlementItems({
      organizationId: Number((ctx.user as any)?.organizationId || 0),
    });
  }),
  }),

  ai: router({
    /**
     * AI 페이지 초기 진입용
     * 현재 로그인 유저 기준으로 사용 가능 기능 요약
     */
    bootstrap: protectedProcedure.query(async ({ ctx }) => {
      return {
        success: true,
        user: {
          id: Number(ctx.user.id),
          name: ctx.user.name,
          role: ctx.user.role,
        },
        capabilities: {
          canSearchStudents: true,
          canSearchConsultations: true,
          canReadNotifications: true,
          canCreateTransferSubject: true,
          canCreatePlanSemester: true,
          canRecommendPracticePlace: true,
          canModifyServer: false,
          canDeleteData: false,
          canAlterSchema: false,
        },
      };
    }),

    /**
     * 학생 / 상담 자연어 검색용 1차 버전
     */
    search: protectedProcedure
      .input(
        z.object({
          query: z.string().min(1),
        })
      )
      .query(async ({ ctx, input }) => {
        const q = input.query.trim();
        const assigneeId = isAdminOrHost(ctx.user)
          ? undefined
          : Number(ctx.user.id) || 1;

        const [students, consultations] = await Promise.all([
          db.listStudents(assigneeId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
}),
db.listConsultations(assigneeId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
}),
        ]);

        const qLower = q.toLowerCase();
        const qDigits = q.replace(/\D/g, "");

        const matchedStudents = (students || []).filter((item: any) => {
          return (
            String(item.clientName || "").toLowerCase().includes(qLower) ||
            String(item.phone || "").replace(/\D/g, "").includes(qDigits) ||
            String(item.course || "").toLowerCase().includes(qLower)
          );
        });

        const matchedConsultations = (consultations || []).filter((item: any) => {
          return (
            String(item.clientName || "").toLowerCase().includes(qLower) ||
            String(item.phone || "").replace(/\D/g, "").includes(qDigits) ||
            String(item.desiredCourse || "").toLowerCase().includes(qLower) ||
            String(item.notes || "").toLowerCase().includes(qLower)
          );
        });

        return {
          success: true,
          query: q,
          students: matchedStudents.slice(0, 20),
          consultations: matchedConsultations.slice(0, 20),
        };
      }),

    /**
     * AI 알림/누락 브리핑용
     */
    alerts: protectedProcedure.query(async ({ ctx }) => {
      const assigneeId = isAdminOrHost(ctx.user)
        ? undefined
        : Number(ctx.user.id) || 1;

      const [students, consultations, semesters] = await Promise.all([
        db.listStudents(assigneeId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
}),
db.listConsultations(assigneeId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
}),
db.listAllSemesters(assigneeId, undefined, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
}),
      ]);

      const paymentDateMissing = (students || []).filter(
        (s: any) => s.status === "등록" && !s.paymentDate
      );

      const paymentAmountMissing = (students || []).filter(
        (s: any) => s.status === "등록" && !s.paymentAmount
      );

      const consultationAssigneeMissing = (consultations || []).filter(
        (c: any) => !c.assigneeId
      );

      const practiceUnassigned = (semesters || []).filter(
        (s: any) => s.practiceStatus === "미섭외"
      );

      return {
        success: true,
        summary: {
          paymentDateMissingCount: paymentDateMissing.length,
          paymentAmountMissingCount: paymentAmountMissing.length,
          consultationAssigneeMissingCount: consultationAssigneeMissing.length,
          practiceUnassignedCount: practiceUnassigned.length,
        },
        items: {
          paymentDateMissing: paymentDateMissing.slice(0, 20),
          paymentAmountMissing: paymentAmountMissing.slice(0, 20),
          consultationAssigneeMissing: consultationAssigneeMissing.slice(0, 20),
          practiceUnassigned: practiceUnassigned.slice(0, 20),
        },
      };
    }),

    createTransferSubject: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          schoolName: z.string().optional(),
          subjectName: z.string().min(1),
          category: z.enum(["전공", "교양", "일반"]),
          requirementType: z.enum(["전공필수", "전공선택", "교양", "일반"]).optional(),
          credits: z.number().min(0).max(30).default(3),
          sortOrder: z.number().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const existing = await db.listTransferSubjects(input.studentId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
        if ((existing?.length ?? 0) >= 100) {
          throw new Error("전적대 과목은 최대 100개까지 등록할 수 있습니다");
        }

        const id = await db.createTransferSubject({
organizationId: Number((ctx.user as any)?.organizationId || 0),
          studentId: input.studentId,
          schoolName: input.schoolName?.trim() || null,
          subjectName: input.subjectName.trim(),
          transferCategory: input.category,
          transferRequirementType: input.requirementType ?? null,
          credits: input.credits,
          sortOrder: input.sortOrder ?? 0,
          attachmentName: input.attachmentName?.trim() || null,
          attachmentUrl: input.attachmentUrl?.trim() || null,
        } as any);

        if (db.createAiActionLog) {
          await db.createAiActionLog({
organizationId: Number((ctx.user as any)?.organizationId || 0),
            userId: Number(ctx.user.id),
            userName: ctx.user.name,
            action: "create_transfer_subject_manual",
            targetStudentId: student.id,
            targetStudentName: student.clientName,
            payload: input,
          });
        }

        return { success: true, id };
      }),

uploadTranscriptImage: protectedProcedure
  .input(
    z.object({
      studentId: z.number(),
      imageBase64: z.string(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const student = await db.getStudent(input.studentId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
    if (!student) throw new Error("학생 없음");

    if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
      throw new Error("권한 없음");
    }

    const { data: { text } } = await Tesseract.recognize(
      Buffer.from(input.imageBase64, "base64"),
      "kor+eng"
    );

    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    const subjects = lines
      .map((line) => {
        const match = line.match(/([가-힣A-Za-z\s]+)/);
        return match ? match[1].trim() : null;
      })
      .filter(Boolean);

    const rows = subjects.map((subjectName, idx) => ({
      subjectName,
      category: "전공" as const,
      requirementType: "전공선택" as const,
      credits: 3,
      sortOrder: idx,
    }));
let refinedRows = rows;

try {
  const response = await openai.responses.create({
    model: "gpt-5.4-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
              "너는 학점은행제 전적대 성적표 분석 전문가다. " +
              "OCR 결과를 바탕으로 과목명을 정리하고, " +
              "category는 전공/교양/일반 중 하나, " +
              "requirementType은 전공필수/전공선택/교양/일반 중 하나로 맞춰라. " +
              "불확실하면 보수적으로 전공/전공선택/3학점으로 둬라.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              rawText: text,
              draftRows: rows,
            }),
          },
        ],
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "transfer_subject_rows",
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            rows: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  subjectName: { type: "string" },
                  category: {
                    type: "string",
                    enum: ["전공", "교양", "일반"],
                  },
                  requirementType: {
                    type: ["string", "null"],
                    enum: ["전공필수", "전공선택", "교양", "일반", null],
                  },
                  credits: { type: "number" },
                },
                required: ["subjectName", "category", "requirementType", "credits"],
              },
            },
          },
          required: ["rows"],
        },
      },
    },
  });

  const parsed = JSON.parse(response.output_text || "{}");
  refinedRows = cleanTransferRows(parsed.rows || []);
} catch (err) {
  console.error("[GPT ERROR]", err);
}

    return {
  success: true,
  message: "AI가 성적표를 분석해서 과목을 정리했어요.",
  rows: refinedRows,
};
  }),

    createPlanSemester: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          semesterNo: z.number(),
          subjectName: z.string().min(1),
          category: z.enum(["전공", "교양", "일반"]),
          requirementType: z.enum(["전공필수", "전공선택", "교양", "일반"]).optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const existing = await db.listPlanSemesters(input.studentId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
        const semesterCount = existing.filter(
          (x: any) => Number(x.semesterNo) === Number(input.semesterNo)
        ).length;

        if (semesterCount >= 8) {
          throw new Error("우리 플랜은 학기당 최대 8과목까지 등록할 수 있습니다");
        }

        const id = await db.createPlanSemester({
organizationId: Number((ctx.user as any)?.organizationId || 0),
          studentId: input.studentId,
          semesterNo: input.semesterNo,
          subjectName: input.subjectName.trim(),
          planCategory: input.category,
          planRequirementType: input.requirementType ?? null,
          credits: 3,
          sortOrder: input.sortOrder ?? 0,
        } as any);

        if (db.createAiActionLog) {
          await db.createAiActionLog({
organizationId: Number((ctx.user as any)?.organizationId || 0),
            userId: Number(ctx.user.id),
            userName: ctx.user.name,
            action: "create_plan_semester_manual",
            targetStudentId: student.id,
            targetStudentName: student.clientName,
            payload: input,
          });
        }

        return { success: true, id };
      }),

    recommendPracticePlace: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!db.getPracticeRecommendationsForStudent) {
          throw new Error("db.ts에 getPracticeRecommendationsForStudent 함수를 먼저 추가해야 합니다.");
        }

        const student = await db.getStudent(input.studentId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const result = await db.getPracticeRecommendationsForStudent(input.studentId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});

        if (db.createAiActionLog) {
          await db.createAiActionLog({
organizationId: Number((ctx.user as any)?.organizationId || 0),
            userId: Number(ctx.user.id),
            userName: ctx.user.name,
            action: "recommend_practice_place",
            targetStudentId: student.id,
            targetStudentName: student.clientName,
            payload: { studentId: input.studentId },
          });
        }

        return {
          success: true,
          student: result.student,
          educationCenters: result.educationCenters,
          institutions: result.institutions,
          message: `${student.clientName} 학생 주소 기준으로 가장 가까운 실습교육원/기관 추천 결과를 정리했습니다.`,
        };
      }),

    chat: protectedProcedure
      .input(
        z.object({
          message: z.string().min(1),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const assigneeId = isAdminOrHost(ctx.user)
          ? undefined
          : Number(ctx.user.id) || 1;

        const [students, consultations] = await Promise.all([
          db.listStudents(assigneeId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
}),
db.listConsultations(assigneeId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
}),
        ]);
const userName = ctx.user.name || "사용자";

        const msg = input.message.trim();
        const msgLower = msg.toLowerCase();

        if (msg.includes("찾아")) {
          const keyword = msg.replace("찾아줘", "").replace("찾아", "").trim();
          const keywordLower = keyword.toLowerCase();
          const keywordDigits = keyword.replace(/\D/g, "");

          const matchedStudents = (students || []).filter((item: any) => {
            return (
              String(item.clientName || "").toLowerCase().includes(keywordLower) ||
              String(item.phone || "").replace(/\D/g, "").includes(keywordDigits) ||
              String(item.course || "").toLowerCase().includes(keywordLower)
            );
          });

          const matchedConsultations = (consultations || []).filter((item: any) => {
            return (
              String(item.clientName || "").toLowerCase().includes(keywordLower) ||
              String(item.phone || "").replace(/\D/g, "").includes(keywordDigits) ||
              String(item.desiredCourse || "").toLowerCase().includes(keywordLower)
            );
          });

          return {
            success: true,
            mode: "search",
            answer: `검색어 "${keyword}" 기준으로 학생 ${matchedStudents.length}건, 상담 ${matchedConsultations.length}건을 찾았어요.`,
            data: {
              students: matchedStudents.slice(0, 10),
              consultations: matchedConsultations.slice(0, 10),
            },
          };
        }

        if (msg.includes("누락") || msg.includes("결제")) {
          const paymentDateMissing = (students || []).filter(
            (s: any) => s.status === "등록" && !s.paymentDate
          );
          const paymentAmountMissing = (students || []).filter(
            (s: any) => s.status === "등록" && !s.paymentAmount
          );

          return {
            success: true,
            mode: "alert",
            answer: `확인해봤어요. 결제일 누락 ${paymentDateMissing.length}건, 결제금액 누락 ${paymentAmountMissing.length}건입니다.`,
            data: {
              paymentDateMissing: paymentDateMissing.slice(0, 10),
              paymentAmountMissing: paymentAmountMissing.slice(0, 10),
            },
          };
        }

        if (msgLower.includes("실습") && (msgLower.includes("가까운") || msgLower.includes("교육원") || msgLower.includes("기관"))) {
          return {
            success: true,
            mode: "general",
            answer: "실습 추천은 학생을 먼저 선택한 뒤 실행하는 방식으로 연결하는 것이 안전합니다. 프론트에서 recommend_practice_place 액션으로 연결해주세요.",
          };
        }

        try {
  const response = await openai.responses.create({
    model: "gpt-5.4-mini",
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text:
  `너는 학점은행제 CRM 내부 AI 작업도우미다. 현재 대화 상대 이름은 ${userName}이다. ` +
  "말투는 너무 기계적이지 않게 자연스럽고 간결하게 답해라. " +
  "모르는 것은 모른다고 하고, 현재 연결된 기능과 연결되지 않은 기능을 구분해서 안내해라. " +
  "현재 CRM에서 가능한 기능은 학생/상담 검색, 누락/결제 점검, 전적대 과목 입력, 우리 플랜 입력, 실습 추천이다.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: input.message,
          },
        ],
      },
    ],
  });

  return {
    success: true,
    mode: "general",
    answer:
      response.output_text?.trim() ||
      "답변을 생성하지 못했습니다.",
  };
} catch (err) {
  console.error("[ai.chat][openai error]", err);

  return {
    success: true,
    mode: "general",
    answer:
      "지금은 AI 답변 연결 중 오류가 있어서 기본 안내만 드릴게요. 학생/상담 검색, 누락/결제 점검, 전적대 과목 입력, 우리 플랜 입력, 실습 추천 기능부터 사용할 수 있어요.",
  };
}
      }),

        saveLearning: protectedProcedure
      .input(
        z.object({
          learningType: z.string().min(1),
          inputText: z.string().min(1),
          normalizedKey: z.string().min(1),
          targetStudentId: z.number().optional(),
          targetStudentName: z.string().optional(),
          payload: z.any(),
          feedback: z.string().optional(),
          isApproved: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!db.createAiLearningEntry) {
          throw new Error("db.ts에 createAiLearningEntry 함수를 먼저 추가해야 합니다.");
        }

        await db.createAiLearningEntry({
          organizationId: Number((ctx.user as any)?.organizationId || 0),
          userId: Number(ctx.user.id),
          userName: ctx.user.name,
          learningType: input.learningType,
          inputText: input.inputText,
          normalizedKey: input.normalizedKey,
          targetStudentId: input.targetStudentId ?? null,
          targetStudentName: input.targetStudentName ?? null,
          payload: input.payload,
          feedback: input.feedback ?? null,
          isApproved: input.isApproved ?? true,
        } as any);

        return { success: true };
      }),

    getLearningExamples: protectedProcedure
      .input(
        z.object({
          learningType: z.string().min(1),
          normalizedKey: z.string().optional(),
          keyword: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        if (!db.findSimilarAiLearning) {
          throw new Error("db.ts에 findSimilarAiLearning 함수를 먼저 추가해야 합니다.");
        }

        const examples = await db.findSimilarAiLearning({
organizationId: Number((ctx.user as any)?.organizationId || 0),
          learningType: input.learningType,
          normalizedKey: input.normalizedKey,
          keyword: input.keyword,
        });

        return {
          success: true,
          examples,
        };
      }),

    logs: superHostProcedure.query(async () => {
      return [];
    }),

    runAction: protectedProcedure
      .input(
        z.object({
          action: z.enum([
            "create_transfer_subject",
            "create_plan_semester",
            "recommend_practice_place",
          ]),
          studentKeyword: z.string().min(1),
          subjectName: z.string().min(1).optional(),
          category: z.enum(["전공", "교양", "일반"]).optional(),
          semesterNo: z.number().optional(),
          selectedStudentId: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const assigneeId = isAdminOrHost(ctx.user)
          ? undefined
          : Number(ctx.user.id) || 1;

        const students = await db.listStudents(assigneeId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
        const keyword = input.studentKeyword.trim();
        const keywordLower = keyword.toLowerCase();
        const keywordDigits = keyword.replace(/\D/g, "");

        let matchedStudents: any[] = [];

        if (input.selectedStudentId) {
          const selected = (students || []).find(
            (item: any) => Number(item.id) === Number(input.selectedStudentId)
          );

          if (!selected) {
            throw new Error("선택한 학생을 찾을 수 없습니다.");
          }

          matchedStudents = [selected];
        }

        if (!matchedStudents.length) {
          matchedStudents = (students || []).filter((item: any) => {
            return (
              String(item.clientName || "").toLowerCase().includes(keywordLower) ||
              String(item.phone || "").replace(/\D/g, "").includes(keywordDigits)
            );
          });
        }

        if (matchedStudents.length === 0) {
          throw new Error("해당 학생을 찾을 수 없습니다.");
        }

        if (matchedStudents.length > 1) {
          return {
            success: false,
            needsSelection: true,
            message: "동일하거나 유사한 학생이 여러 명입니다. 아래에서 선택해주세요.",
            candidates: matchedStudents.slice(0, 10).map((student: any) => ({
              id: student.id,
              clientName: student.clientName,
              phone: student.phone,
              course: student.course,
              status: student.status,
              institution: student.institution,
              finalEducation: student.finalEducation,
            })),
          };
        }

        const student = matchedStudents[0];

        if (input.action === "create_transfer_subject") {
          if (!input.subjectName?.trim()) {
            return {
              success: true,
              needsSelection: false,
              student: {
                id: student.id,
                name: student.clientName,
                phone: student.phone,
                course: student.course,
                finalEducation: student.finalEducation,
              },
              message: "전적대 입력 대상으로 학생을 찾았어요. 과목명과 구분을 확인한 뒤 실행할 수 있습니다.",
            };
          }

          if (!input.category) {
            throw new Error("전적대 과목 구분이 필요합니다.");
          }

          const id = await db.createTransferSubject({
            studentId: student.id,
            schoolName: null,
            subjectName: input.subjectName.trim(),
            transferCategory: input.category,
            transferRequirementType: null,
            credits: 3,
            sortOrder: 0,
            attachmentName: null,
            attachmentUrl: null,
          } as any);

          if (db.createAiActionLog) {
            await db.createAiActionLog({
organizationId: Number((ctx.user as any)?.organizationId || 0),
              userId: Number(ctx.user.id),
              userName: ctx.user.name,
              action: "create_transfer_subject",
              targetStudentId: student.id,
              targetStudentName: student.clientName,
              payload: input,
            });
          }

          if (db.createAiLearningEntry) {
            await db.createAiLearningEntry({
              userId: Number(ctx.user.id),
              userName: ctx.user.name,
              learningType: "transfer_subject_input",
              inputText: `${student.clientName} 전적대 ${input.subjectName} ${input.category}`,
              normalizedKey: `transfer_subject|${input.category}`,
              targetStudentId: student.id,
              targetStudentName: student.clientName,
              payload: input,
              feedback: null,
              isApproved: true,
            });
          }

          return {
            success: true,
            needsSelection: false,
            action: input.action,
            student: {
              id: student.id,
              name: student.clientName,
              phone: student.phone,
              course: student.course,
              finalEducation: student.finalEducation,
            },
            createdId: id,
            message: `${student.clientName} 학생의 전적대 과목 "${input.subjectName}" 입력이 완료되었습니다.`,
          };
        }

        if (input.action === "create_plan_semester") {
          if (!input.subjectName?.trim()) {
            return {
              success: true,
              needsSelection: false,
              student: {
                id: student.id,
                name: student.clientName,
                phone: student.phone,
                course: student.course,
                finalEducation: student.finalEducation,
              },
              message: "플랜 입력 대상으로 학생을 찾았어요. 학기, 과목명, 구분을 확인한 뒤 실행할 수 있습니다.",
            };
          }

          if (!input.semesterNo) {
            throw new Error("학기 정보가 필요합니다.");
          }

          if (!input.category) {
            throw new Error("플랜 과목 구분이 필요합니다.");
          }

          const existing = await db.listPlanSemesters(student.id, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
          const semesterCount = (existing || []).filter(
            (x: any) => Number(x.semesterNo) === Number(input.semesterNo)
          ).length;

          if (semesterCount >= 8) {
            throw new Error("우리 플랜은 학기당 최대 8과목까지 등록할 수 있습니다.");
          }

          const id = await db.createPlanSemester({
            studentId: student.id,
            semesterNo: input.semesterNo,
            subjectName: input.subjectName.trim(),
            planCategory: input.category,
            planRequirementType: null,
            credits: 3,
            sortOrder: 0,
          } as any);

          if (db.createAiActionLog) {
            await db.createAiActionLog({
organizationId: Number((ctx.user as any)?.organizationId || 0),
              userId: Number(ctx.user.id),
              userName: ctx.user.name,
              action: "create_plan_semester",
              targetStudentId: student.id,
              targetStudentName: student.clientName,
              payload: input,
            });
          }

          if (db.createAiLearningEntry) {
            await db.createAiLearningEntry({
              userId: Number(ctx.user.id),
              userName: ctx.user.name,
              learningType: "plan_semester_input",
              inputText: `${student.clientName} ${input.semesterNo}학기 ${input.subjectName} ${input.category}`,
              normalizedKey: `plan_semester|${input.semesterNo}|${input.category}`,
              targetStudentId: student.id,
              targetStudentName: student.clientName,
              payload: input,
              feedback: null,
              isApproved: true,
            });
          }

          return {
            success: true,
            needsSelection: false,
            action: input.action,
            student: {
              id: student.id,
              name: student.clientName,
              phone: student.phone,
              course: student.course,
              finalEducation: student.finalEducation,
            },
            createdId: id,
            message: `${student.clientName} 학생의 ${input.semesterNo}학기 플랜 과목 "${input.subjectName}" 입력이 완료되었습니다.`,
          };
        }

        if (input.action === "recommend_practice_place") {
          if (!db.getPracticeRecommendationsForStudent) {
            throw new Error("db.ts에 getPracticeRecommendationsForStudent 함수를 먼저 추가해야 합니다.");
          }

          const recommendations = await db.getPracticeRecommendationsForStudent(student.id, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});

          if (db.createAiActionLog) {
            await db.createAiActionLog({
organizationId: Number((ctx.user as any)?.organizationId || 0),
              userId: Number(ctx.user.id),
              userName: ctx.user.name,
              action: "recommend_practice_place",
              targetStudentId: student.id,
              targetStudentName: student.clientName,
              payload: input,
            });
          }

          const educationLines = (recommendations.educationCenters || [])
            .slice(0, 3)
            .map((item: any, idx: number) => `${idx + 1}. ${item.name} - ${item.distanceKm}km`);

          const institutionLines = (recommendations.institutions || [])
            .slice(0, 3)
            .map((item: any, idx: number) => `${idx + 1}. ${item.name} - ${item.distanceKm}km`);

          return {
            success: true,
            needsSelection: false,
            action: input.action,
            student: {
              id: student.id,
              name: student.clientName,
              phone: student.phone,
              course: student.course,
              finalEducation: student.finalEducation,
            },
            recommendations,
            message: [
              `${student.clientName} 학생 주소 기준으로 가장 가까운 실습 추천 결과를 정리했어요.`,
              "",
              "교육원 추천:",
              ...(educationLines.length ? educationLines : ["- 추천 가능한 교육원이 없습니다."]),
              "",
              "실습기관 추천:",
              ...(institutionLines.length ? institutionLines : ["- 추천 가능한 기관이 없습니다."]),
            ].join("\n"),
          };
        }

        throw new Error("지원하지 않는 액션입니다.");
      }),
  }),
  dashboard: router({
  monthApprovals: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = Number((ctx.user as any)?.organizationId || 0);
    const isAdminHost = isAdminOrHost(ctx.user);
    const assigneeId = isAdminHost ? undefined : Number(ctx.user.id);

    const stats = await db.getDashboardStats(assigneeId, {
      organizationId,
    });

    const monthEntries = await db.getMonthSalesEntries(assigneeId, {
      organizationId,
    });

    const students = await db.listStudents(assigneeId, {
      organizationId,
    });

    const approved = (students || []).filter(
      (s: any) => s.approvalStatus === "승인"
    );
    const rejected = (students || []).filter(
      (s: any) => s.approvalStatus === "불승인"
    );
    const pending = (students || []).filter(
      (s: any) => s.approvalStatus === "대기"
    );

    const approvedTotal = approved.reduce(
      (sum: number, s: any) =>
        sum + Number(s.netPaidAmount || s.paidAmount || 0),
      0
    );

    const rejectedTotal = rejected.reduce(
      (sum: number, s: any) =>
        sum + Number(s.netPaidAmount || s.paidAmount || 0),
      0
    );

    const pendingTotal = pending.reduce(
      (sum: number, s: any) =>
        sum + Number(s.netPaidAmount || s.paidAmount || 0),
      0
    );

    return {
      approved,
      rejected,
      pending,
      approvedTotal,
      rejectedTotal,
      pendingTotal,
      monthRefund: stats?.monthRefund ?? 0,
      totalRefund: stats?.totalRefund ?? 0,
      entries: monthEntries?.entries ?? [],
    };
  }),

  stats: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = Number((ctx.user as any)?.organizationId || 0);
    const isAdminHost = isAdminOrHost(ctx.user);
    const assigneeId = isAdminHost ? undefined : Number(ctx.user.id);

    return db.getDashboardStats(assigneeId, {
      organizationId,
    });
  }),

  totalStats: hostProcedure.query(async ({ ctx }) => {
    const organizationId = Number((ctx.user as any)?.organizationId || 0);

    return db.getDashboardStats(undefined, {
      organizationId,
    });
  }),

  monthSalesEntries: protectedProcedure.query(async ({ ctx }) => {
    const organizationId = Number((ctx.user as any)?.organizationId || 0);
    const isAdminHost = isAdminOrHost(ctx.user);
    const assigneeId = isAdminHost ? undefined : Number(ctx.user.id);

    return db.getMonthSalesEntries(assigneeId, {
      organizationId,
    });
  }),

  totalMonthSalesEntries: hostProcedure.query(async ({ ctx }) => {
    const organizationId = Number((ctx.user as any)?.organizationId || 0);

    return db.getMonthSalesEntries(undefined, {
      organizationId,
    });
  }),
}),
  consultation: router({
  list: protectedProcedure
    .input(
      z
        .object({
          showAll: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  const showAll = !!input?.showAll;
  const myId = Number(ctx.user.id) || 1;

  const assigneeId =
    isAdminOrHost(ctx.user) && showAll ? undefined : myId;

  return db.listConsultations(assigneeId, {
    organizationId,
  });
}), 

    create: protectedProcedure
      .input(
        z.object({
          consultDate: z.string(),
          channel: z.string(),
          clientName: z.string(),
          phone: z.string().max(30),
          finalEducation: z.string().optional(),
          desiredCourse: z.string().optional(),
          notes: z.string().optional(),
          status: z.string().default("상담중"),
        })
      )
      .mutation(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  const assigneeId = Number(ctx.user.id);
  const safeAssigneeId =
    Number.isFinite(assigneeId) && assigneeId > 0 ? assigneeId : 1;

  const id = await db.createConsultation({
    ...input,
    organizationId,
    consultDate: new Date(input.consultDate),
    finalEducation: input.finalEducation ?? "",
    assigneeId: safeAssigneeId,
  } as any);

  return { success: true, id };
}),

    bulkCreate: protectedProcedure
      .input(
        z.object({
mode: z.enum(["append", "replace"]).default("append"),
categoryId: z.number().nullable().optional(),
          rows: z.array(
            z.object({
              consultDate: z.string(),
              channel: z.string(),
              clientName: z.string(),
              phone: z.string(),
              finalEducation: z.string().optional(),
              desiredCourse: z.string().optional(),
              notes: z.string().optional(),
              status: z.string().default("상담중"),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {

const MAX_BULK_CONSULTATIONS = 500;

if (input.rows.length > MAX_BULK_CONSULTATIONS) {
  throw new Error(
    `상담DB 일괄등록은 서버 안정성을 위해 1회 최대 ${MAX_BULK_CONSULTATIONS}건까지만 가능합니다. 현재 ${input.rows.length}건입니다.`
  );
}

        const assigneeId = Number(ctx.user.id);
        const safeAssigneeId =
          Number.isFinite(assigneeId) && assigneeId > 0 ? assigneeId : 1;

        const dataList = input.rows.map((row) => ({
          ...row,
          consultDate: new Date(row.consultDate),
          finalEducation: row.finalEducation ?? "",
          assigneeId: safeAssigneeId,
        }));

        await db.bulkCreateConsultations(dataList as any);

        return {
          success: true,
          count: dataList.length,
        };
      }),

    importCsv: protectedProcedure
      .input(
        z.object({
          csvText: z.string(),
          hasHeader: z.boolean().default(true),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const assigneeId = Number(ctx.user.id);
        const safeAssigneeId =
          Number.isFinite(assigneeId) && assigneeId > 0 ? assigneeId : 1;

        const lines = input.csvText.trim().split("\n").filter((l) => l.trim());
        const startIdx = input.hasHeader ? 1 : 0;
        const rows: any[] = [];

        for (let i = startIdx; i < lines.length; i++) {
          const cols = lines[i].includes("\t")
            ? lines[i].split("\t")
            : lines[i].split(",");

          const consultDateStr =
            cols[0]?.trim() || new Date().toISOString().slice(0, 10);

          const channel = cols[1]?.trim() || "";
          const clientName = cols[2]?.trim() || "";
          const phone = (cols[3]?.trim() || "").replace(/\D/g, "").slice(0, 11);
          const finalEducation = cols[4]?.trim() || "";
          const desiredCourse = cols[5]?.trim() || "";
          const notes = cols[6]?.trim() || "";
          const status = cols[7]?.trim() || "상담중";

          if (!clientName || !phone) continue;

          rows.push({
            consultDate: new Date(consultDateStr),
            channel,
            clientName,
            phone,
            finalEducation,
            desiredCourse,
            notes,
            status,
            assigneeId: safeAssigneeId,
          });
        }

       if (rows.length === 0) {
  throw new Error("유효한 데이터가 없습니다");
}

const MAX_BULK_CONSULTATIONS = 500;

if (rows.length > MAX_BULK_CONSULTATIONS) {
  throw new Error(
    `CSV 임포트는 서버 안정성을 위해 1회 최대 ${MAX_BULK_CONSULTATIONS}건까지만 가능합니다. 현재 유효 데이터는 ${rows.length}건입니다.`
  );
}

await db.bulkCreateConsultations(rows as any);

        return {
          success: true,
          count: rows.length,
        };
      }),

    update: protectedProcedure
  .input(
    z.object({
      id: z.number(),
      consultDate: z.string().optional(),
      channel: z.string().optional(),
      clientName: z.string().optional(),
      phone: z.string().optional(),
      finalEducation: z.string().optional(),
      desiredCourse: z.string().optional(),
      notes: z.string().optional(),
      status: z.string().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const organizationId = Number((ctx.user as any)?.organizationId || 0);

    if (!organizationId) {
      throw new Error("organizationId is required");
    }

    const item = await db.getConsultation(input.id, {
      organizationId,
    });

    if (!item) {
      throw new Error("상담 기록을 찾을 수 없습니다");
    }

    const myId = Number(ctx.user.id) || 1;

    if (!isAdminOrHost(ctx.user) && item.assigneeId !== myId) {
      throw new Error("권한이 없습니다");
    }

    const { id, ...rest } = input;
    const data: any = { ...rest };

    if (ctx.user.role === "staff") {
      const allowedForStaff: any = {};

      if (rest.notes !== undefined) {
        allowedForStaff.notes = rest.notes;
      }

      if (rest.status !== undefined) {
        allowedForStaff.status = rest.status;
      }

      await db.updateConsultation(id, allowedForStaff, {
  organizationId,
});

      if (rest.status === "등록예정") {
        const linkedStudent = await db.getStudentByConsultationId(id, {
  organizationId,
});

        if (!linkedStudent) {
          const latestConsultation = await db.getConsultation(id, {
  organizationId,
});

          if (latestConsultation) {
            await db.createStudent({
  organizationId,
  clientName: latestConsultation.clientName,
              phone: latestConsultation.phone,
              course: latestConsultation.desiredCourse || "",
              finalEducation: latestConsultation.finalEducation || "",
              assigneeId: latestConsultation.assigneeId,
              consultationId: id,
            } as any);
          }
        }

        await db.syncStudentFromConsultation(id, {
  organizationId,
});
      }

      return { success: true };
    }

    if (rest.consultDate) {
      data.consultDate = new Date(rest.consultDate);
    }

    await db.updateConsultation(id, data, {
  organizationId,
});

    if (rest.status === "등록예정") {
     const linkedStudent = await db.getStudentByConsultationId(id, {
  organizationId,
});

      if (!linkedStudent) {
        const latestConsultation = await db.getConsultation(id, {
  organizationId,
});

        if (latestConsultation) {
          await db.createStudent({
  organizationId,
  clientName: latestConsultation.clientName,
            phone: latestConsultation.phone,
            course: latestConsultation.desiredCourse || "",
            finalEducation: latestConsultation.finalEducation || "",
            assigneeId: latestConsultation.assigneeId,
            consultationId: id,
          } as any);
        }
      }
    }

    await db.syncStudentFromConsultation(id, {
  organizationId,
});

    return { success: true };
  }),

    reassign: hostProcedure
      .input(
        z.object({
          id: z.number(),
          assigneeId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await db.reassignConsultationAndLinkedStudent(
          input.id,
          input.assigneeId
        );

        return { success: true };
      }),

    bulkReassign: hostProcedure
      .input(
        z.object({
          fromAssigneeId: z.number(),
          toAssigneeId: z.number(),
        })
      )
      .mutation(async ({ input }) => {
        await db.bulkReassignConsultationsAndLinkedStudents(
          input.fromAssigneeId,
          input.toAssigneeId
        );

        return { success: true };
      }),

    delete: hostProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const item = await db.getConsultation(input.id);

    if (!item) {
      throw new Error("상담 기록을 찾을 수 없습니다");
    }


    assertHostOrSuperhost(ctx.user);


    await db.deleteConsultation(input.id, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
  deletedBy: Number(ctx.user.id),
});

await db.createAuditLog({
  organizationId: Number((ctx.user as any)?.organizationId || 0),
  actorUserId: Number(ctx.user.id),
  actorRole: String((ctx.user as any)?.role || ""),
  action: "consultation.soft_delete",
  targetType: "consultation",
  targetId: input.id,
  memo: "상담DB 삭제 처리",
} as any);

    return { success: true };
  }),

listDeleted: hostProcedure
  .input(
    z
      .object({
        limit: z.number().optional(),
      })
      .optional()
  )
  .query(async ({ ctx, input }) => {
    return db.listDeletedConsultations({
      organizationId: Number((ctx.user as any)?.organizationId || 0),
      limit: input?.limit ?? 100,
    });
  }),

restore: hostProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const organizationId = Number((ctx.user as any)?.organizationId || 0);

    await db.restoreConsultation({
      id: input.id,
      organizationId,
    });

    await db.createAuditLog({
      organizationId,
      actorUserId: Number(ctx.user.id),
      actorRole: String((ctx.user as any)?.role || ""),
      action: "consultation.restore",
      targetType: "consultation",
      targetId: input.id,
      memo: "삭제된 상담DB 복구 처리",
    } as any);

    return { success: true };
  }),

  }),

  student: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const assigneeId = isAdminOrHost(ctx.user)
        ? undefined
        : Number(ctx.user.id) || 1;

      return db.listStudents(assigneeId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const item = await db.getStudent(input.id, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
        if (!item) return null;

        if (!isAdminOrHost(ctx.user) && item.assigneeId !== Number(ctx.user.id)) {
          return null;
        }

        return item;
      }),

    paymentSummary: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ input }) => {
        return db.getStudentPaymentSummary(input.studentId);
      }),

    create: protectedProcedure
      .input(
        z.object({
          clientName: z.string(),
          phone: z.string(),
          course: z.string(),
          startDate: z.string().optional(),
          paymentAmount: z.string().optional(),
          subjectCount: z.number().optional(),
          paymentDate: z.string().optional(),
          institution: z.string().optional(),
          totalSemesters: z.number().optional(),
          consultationId: z.number().optional(),
          address: z.string().optional(),
          detailAddress: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const data: any = {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
  ...input,
  assigneeId: Number(ctx.user.id) || 1,
};

        if (input.startDate) data.startDate = new Date(input.startDate);
        if (input.paymentDate) data.paymentDate = new Date(input.paymentDate);

        const id = await db.createStudent(data);
        return { id };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          clientName: z.string().optional(),
          phone: z.string().optional(),
          course: z.string().optional(),
          status: z.enum(["등록", "종료", "등록 종료"]).optional(),
          startDate: z.string().optional(),
          paymentAmount: z.string().optional(),
          subjectCount: z.number().optional(),
          paymentDate: z.string().optional(),
          institution: z.string().optional(),
          institutionId: z.number().optional(),
          totalSemesters: z.number().optional(),
          address: z.string().optional(),
          detailAddress: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        console.log("[student.update] input =", input);

        const item = await db.getStudent(input.id, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
        if (!item) throw new Error("학생 기록을 찾을 수 없습니다");

        const myId = Number(ctx.user.id) || 1;
        if (!isAdminOrHost(ctx.user) && item.assigneeId !== myId) {
          throw new Error("권한이 없습니다");
        }

        const { id, ...rest } = input;
        const data: any = { ...rest };

        if (rest.startDate) data.startDate = new Date(rest.startDate);
        if (rest.paymentDate) data.paymentDate = new Date(rest.paymentDate);

        console.log("[student.update] data =", data);

        await db.updateStudent(id, data, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
        return { success: true };
      }),

    updateAddressAndCoords: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          address: z.string().optional().nullable(),
          detailAddress: z.string().optional().nullable(),
          latitude: z.number().optional().nullable(),
          longitude: z.number().optional().nullable(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const item = await db.getStudent(input.studentId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
        if (!item) throw new Error("학생 기록을 찾을 수 없습니다");

        const myId = Number(ctx.user.id) || 1;
        if (!isAdminOrHost(ctx.user) && item.assigneeId !== myId) {
          throw new Error("권한이 없습니다");
        }

        await db.updateStudentAddressAndCoords({
  ...input,
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
        return { success: true };
      }),

    delete: protectedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async () => {
    throw new Error("학생 삭제는 상담 DB 페이지에서만 가능합니다.");
  }),

    registrationSummary: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
        if (!student) return null;

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return null;
        }

        return db.getStudentRegistrationSummary(input.studentId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
      }),
}),

  plan: router({
    get: protectedProcedure
  .input(z.object({ studentId: z.number() }))
  .query(async ({ ctx, input }) => {
    const organizationId = Number((ctx.user as any)?.organizationId || 0);

    const student = await db.getStudent(input.studentId, {
      organizationId,
    });

    console.log("[plan.get] student =", student);

    if (!student) {
      console.log("[plan.get] no student");
      return null;
    }

    if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
      console.log("[plan.get] no permission", {
        userId: ctx.user.id,
        assigneeId: student.assigneeId,
      });
      return null;
    }

    const plan = await db.getPlan(input.studentId, {
      organizationId,
    });

    console.log("[plan.get] plan =", plan);

    return plan ?? null;
  }),

    upsert: protectedProcedure
     .input(
  z.object({
    studentId: z.number(),
    desiredCourse: z.string().optional(),
    finalEducation: z.string().optional(),
    totalTheorySubjects: z.number().min(0).optional(),

    requiredMajorCount: z.number().min(0).optional(),
    electiveMajorCount: z.number().min(0).optional(),
    liberalCount: z.number().min(0).optional(),
    generalCount: z.number().min(0).optional(),

    hasPractice: z.boolean().optional(),
    practiceHours: z.number().optional(),
    practiceDate: z.string().optional(),
    practiceArranged: z.boolean().optional(),
    practiceStatus: z.enum(["미섭외", "섭외중", "섭외완료"]).optional(),
    specialNotes: z.string().optional(),
  }).superRefine((val, ctx) => {
    if (!FEATURE_FLAGS.PLAN_REQUIREMENT_ENFORCE) return;
    const totalTheorySubjects = Number(val.totalTheorySubjects ?? 0);
    const requiredMajorCount = Number(val.requiredMajorCount ?? 0);
    const electiveMajorCount = Number(val.electiveMajorCount ?? 0);
    const liberalCount = Number(val.liberalCount ?? 0);
    const generalCount = Number(val.generalCount ?? 0);

    const sum =
      requiredMajorCount +
      electiveMajorCount +
      liberalCount +
      generalCount;

    if (sum !== totalTheorySubjects) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["totalTheorySubjects"],
        message:
          `총 이론 과목 수(${totalTheorySubjects})와 분류 합계(${sum})가 일치하지 않습니다.`,
      });
    }
  })
)
      .mutation(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  const student = await db.getStudent(input.studentId, {
    organizationId,
  });

  if (!student) throw new Error("학생을 찾을 수 없습니다");

  if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
    throw new Error("권한이 없습니다");
  }

  const id = await db.upsertPlan({
    ...input,
    organizationId,
  } as any);

  return { id, success: true };
}),
  }),

  semester: router({
    list: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const organizationId = Number((ctx.user as any)?.organizationId || 0);

const student = await db.getStudent(input.studentId, {
  organizationId,
});
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listSemesters(input.studentId, {
  organizationId,
});
      }),

    listAll: protectedProcedure
  .input(
    z.object({
      plannedMonth: z.string().optional(),
    })
  )
  .query(async ({ ctx, input }) => {
    const organizationId = Number((ctx.user as any)?.organizationId || 0);

    if (!organizationId) {
      throw new Error("organizationId is required");
    }

    const assigneeId = isAdminOrHost(ctx.user)
      ? undefined
      : Number(ctx.user.id) || undefined;

    return db.listAllSemesters(assigneeId, input.plannedMonth, {
      organizationId,
    });
  }),

    create: protectedProcedure
      .input(
        z.object({
  studentId: z.number(),
  semesterOrder: z.number(),
  plannedMonth: z.string().optional(),
  plannedInstitution: z.string().optional(),
  plannedInstitutionId: z.number().optional(),
  plannedSubjectCount: z.number().optional(),
  plannedAmount: z.string().optional(),
  practiceStatus: z.enum(["미섭외", "섭외중", "섭외완료"]).optional(),
  primaryCourse: z.string().optional(),
  registeredCourses: z.array(z.string()).optional(),
})
      )
      .mutation(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  const student = await db.getStudent(input.studentId, {
    organizationId,
  });

  if (!student) throw new Error("학생을 찾을 수 없습니다");

  if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
    throw new Error("권한이 없습니다");
  }

  const id = await db.createSemester({
    ...input,
    organizationId,
    status: "등록",
    practiceStatus: input.practiceStatus ?? "미섭외",
    primaryCourse: input.primaryCourse || undefined,
    registeredCoursesJson:
      input.registeredCourses !== undefined
        ? JSON.stringify(
            input.registeredCourses
              .map((x) => String(x || "").trim())
              .filter(Boolean)
          )
        : undefined,
  } as any);

  if (input.plannedSubjectCount !== undefined && input.plannedSubjectCount > 0) {
    await db.syncPlanSemestersByCount(
  input.studentId,
  input.semesterOrder,
  input.plannedSubjectCount,
  {
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  }
);
  }

  return { id, success: true };
}),

    update: protectedProcedure
  .input(
    z.object({
      id: z.number(),
      plannedMonth: z.string().optional(),
      plannedInstitution: z.string().optional(),
      plannedSubjectCount: z.number().optional(),
      plannedAmount: z.string().optional(),
      plannedInstitutionId: z.number().optional(),
      actualInstitutionId: z.number().optional(),
      actualStartDate: z.string().optional(),
      actualInstitution: z.string().optional(),
      actualSubjectCount: z.number().optional(),
      actualAmount: z.string().optional(),
      actualPaymentDate: z.string().optional(),
      isCompleted: z.boolean().optional(),
      approvalStatus: z.enum(["요청전", "대기", "승인", "불승인"]).optional(),
      status: z.enum(["등록", "종료", "등록 종료"]).optional(),
      practiceStatus: z.enum(["미섭외", "섭외중", "섭외완료"]).optional(),
      practiceSupportRequestId: z.number().optional(),
      primaryCourse: z.string().optional(),
      registeredCourses: z.array(z.string()).optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const organizationId = Number((ctx.user as any)?.organizationId || 0);

    const sem = await db.getSemester(input.id, { organizationId });
    if (!sem) throw new Error("학기를 찾을 수 없습니다");

    const student = await db.getStudent(Number(sem.studentId), {
      organizationId,
    });

    if (!student) throw new Error("학생을 찾을 수 없습니다.");

    assertStudentEditable({
      currentUser: ctx.user,
      student,
    });

    const allSemsForStatusCheck = await db.listSemesters(sem.studentId, {
      organizationId,
    });

    const sortedSemsForStatusCheck = [...allSemsForStatusCheck].sort(
      (a: any, b: any) => Number(a.semesterOrder) - Number(b.semesterOrder)
    );

    const lastSem =
      sortedSemsForStatusCheck[sortedSemsForStatusCheck.length - 1];

    if (input.status === "등록 종료") {
      if (!lastSem || Number(lastSem.id) !== Number(sem.id)) {
        throw new Error("마지막 학기에서만 등록 종료할 수 있습니다");
      }
    }

    const { id, registeredCourses, ...rest } = input;
    const data: any = { ...rest };

    if (rest.actualStartDate) {
      data.actualStartDate = new Date(rest.actualStartDate);
    }

    if (rest.actualPaymentDate) {
      data.actualPaymentDate = new Date(rest.actualPaymentDate);
    }

    if (input.primaryCourse !== undefined) {
      data.primaryCourse = input.primaryCourse?.trim() || null;
    }

    if (registeredCourses !== undefined) {
      const cleanedCourses = registeredCourses
        .map((x) => String(x || "").trim())
        .filter(Boolean);

      data.registeredCoursesJson = JSON.stringify(cleanedCourses);

      if (input.primaryCourse === undefined) {
        data.primaryCourse = cleanedCourses[0] || null;
      }
    }

    const beforeSemester = sem;

    await db.updateSemester(id, data, {
      organizationId,
    });

    const afterSemester = await db.getSemester(id, {
      organizationId,
    });

    const semesterAction =
      beforeSemester?.isCompleted !== afterSemester?.isCompleted
        ? afterSemester?.isCompleted
          ? "complete"
          : "uncomplete"
        : "update";

    await writeStudentAuditLog({
      ctx,
      studentId: Number(beforeSemester.studentId),
      entityType: "semester",
      entityId: Number(id),
      action: semesterAction as any,
      title:
        semesterAction === "complete"
          ? `${beforeSemester.semesterOrder}학기 입력완료 체크`
          : semesterAction === "uncomplete"
            ? `${beforeSemester.semesterOrder}학기 입력완료 해제`
            : `${beforeSemester.semesterOrder}학기 학기별 예정표/결제표 수정`,
      beforeJson: beforeSemester,
      afterJson: afterSemester,
    });

    const shouldSyncSubjectSettlement =
      input.actualInstitutionId !== undefined ||
      input.actualSubjectCount !== undefined ||
      input.actualAmount !== undefined ||
      input.actualPaymentDate !== undefined ||
      input.actualStartDate !== undefined;

    if (shouldSyncSubjectSettlement) {
      await db.syncSubjectSettlementItemBySemesterId(
        id,
        Number(ctx.user.id),
        { organizationId }
      );
    }

    if (input.plannedSubjectCount !== undefined) {
      await db.syncPlanSemestersByCount(
        Number(sem.studentId),
        Number(sem.semesterOrder),
        input.plannedSubjectCount,
        { organizationId }
      );
    }

    if (input.status !== undefined) {
      const refreshedSems = await db.listSemesters(sem.studentId, {
        organizationId,
      });

      const sortedRefreshedSems = [...refreshedSems].sort(
        (a: any, b: any) => Number(a.semesterOrder) - Number(b.semesterOrder)
      );

      const refreshedLastSem =
        sortedRefreshedSems[sortedRefreshedSems.length - 1];

      const studentStatus =
        refreshedLastSem?.status === "등록 종료" ? "등록 종료" : "등록";

      await db.updateStudent(
        sem.studentId,
        { status: studentStatus },
        { organizationId }
      );
    }

    const allSems = await db.listSemesters(sem.studentId, {
      organizationId,
    });

    const firstActual = allSems
      .filter(
        (s: any) =>
          s.actualStartDate ||
          s.actualInstitutionId ||
          s.actualAmount ||
          s.actualPaymentDate
      )
      .sort(
        (a: any, b: any) =>
          Number(a.semesterOrder) - Number(b.semesterOrder)
      )[0];

    if (firstActual) {
      let institutionName: string | undefined = undefined;

      if (firstActual.actualInstitutionId) {
        const institutions = await db.listEducationInstitutions({
          organizationId,
        });

        const found = institutions.find(
          (x: any) => Number(x.id) === Number(firstActual.actualInstitutionId)
        );

        institutionName = found?.name;
      }

      const refreshedSems = await db.listSemesters(sem.studentId, {
        organizationId,
      });

      const sortedRefreshedSems = [...refreshedSems].sort(
        (a: any, b: any) => Number(a.semesterOrder) - Number(b.semesterOrder)
      );

      const refreshedLastSem =
        sortedRefreshedSems[sortedRefreshedSems.length - 1];

      const studentStatus =
        refreshedLastSem?.status === "등록 종료" ? "등록 종료" : "등록";

      await db.updateStudent(
        sem.studentId,
        {
          startDate: firstActual.actualStartDate || undefined,
          institutionId: firstActual.actualInstitutionId || undefined,
          institution: institutionName || undefined,
          subjectCount: firstActual.actualSubjectCount || undefined,
          paymentAmount: firstActual.actualAmount || undefined,
          paymentDate: firstActual.actualPaymentDate || undefined,
          status: studentStatus,
        },
        { organizationId }
      );
    }

    if (input.isCompleted) {
      await db.checkAndAutoComplete(sem.studentId, {
        organizationId,
      });
    }

    return { success: true };
  }),

    copyPlannedToActual: protectedProcedure
  .input(z.object({ id: z.number() }))
  .mutation(async ({ ctx, input }) => {
    const organizationId = Number((ctx.user as any)?.organizationId || 0);

    const sem = await db.getSemester(input.id, {
      organizationId,
    });

    if (!sem) throw new Error("학기를 찾을 수 없습니다");

    const student = await db.getStudent(Number(sem.studentId), {
      organizationId,
    });

    if (!student) throw new Error("학생을 찾을 수 없습니다.");

    assertStudentEditable({
      currentUser: ctx.user,
      student,
    });

    const raw = String(sem.plannedMonth || "").replace(/[^0-9]/g, "");

    const actualStartDate =
      raw.length === 6
        ? new Date(`${raw.slice(0, 4)}-${raw.slice(4, 6)}-01`)
        : undefined;

    const beforeSemester = sem;

    await db.updateSemester(
      input.id,
      {
        actualStartDate,
        actualInstitutionId: sem.plannedInstitutionId,
        actualInstitution: sem.plannedInstitution,
        actualSubjectCount: sem.plannedSubjectCount,
        actualAmount: sem.plannedAmount,
      },
      { organizationId }
    );

    const afterSemester = await db.getSemester(input.id, {
      organizationId,
    });

    await writeStudentAuditLog({
      ctx,
      studentId: Number(sem.studentId),
      entityType: "semester",
      entityId: Number(input.id),
      action: "update",
      title: `${sem.semesterOrder}학기 예정 정보를 실제 결제 정보로 복사`,
      beforeJson: beforeSemester,
      afterJson: afterSemester,
    });

    return { success: true };
  }),

approve: protectedProcedure
  .input(
    z.object({
      id: z.number(),
      approvalStatus: z.enum(["승인", "불승인"]),
    })
  )
  .mutation(async ({ ctx, input }) => {
    if (!isAdminOrHost(ctx.user)) {
      throw new Error("관리자 또는 호스트만 처리할 수 있습니다");
    }

    const organizationId = Number((ctx.user as any)?.organizationId || 0);

    if (!organizationId) {
      throw new Error("organizationId is required");
    }

    const now = new Date();

    const beforeSemester = await db.getSemester(Number(input.id), {
      organizationId,
    });

    if (!beforeSemester) {
      throw new Error("학기 정보를 찾을 수 없습니다.");
    }

    await db.updateSemester(
      Number(input.id),
      {
        approvalStatus: input.approvalStatus,
        approvedAt: input.approvalStatus === "승인" ? now : null,
        rejectedAt: input.approvalStatus === "불승인" ? now : null,
        isLocked: input.approvalStatus === "승인",
      } as any,
      {
        organizationId,
      }
    );

    const sem = await db.getSemester(Number(input.id), {
      organizationId,
    });

    if (!sem) {
      throw new Error("학기 정보를 찾을 수 없습니다.");
    }

    await db.syncSubjectSettlementItemBySemesterId(
      Number(input.id),
      Number(ctx.user.id),
      {
        organizationId,
      }
    );

    const student = await db.getStudent(Number(sem.studentId), {
      organizationId,
    });

    if (!student) {
      throw new Error("학생 정보를 찾을 수 없습니다.");
    }

    const allSems = await db.listSemesters(Number(student.id), {
      organizationId,
    });

    const hasApprovedSemester = (allSems || []).some(
      (row: any) => row.approvalStatus === "승인"
    );

    const beforeStudent = student;

    if (hasApprovedSemester) {
      await db.updateStudent(
        Number(student.id),
        {
          status: "등록",
          approvalStatus: "승인",
          approvedAt: now,
          rejectedAt: null,
        } as any,
        {
          organizationId,
        }
      );

      if (student.consultationId) {
        await db.updateConsultation(
          Number(student.consultationId),
          {
            status: "등록",
          } as any,
          {
            organizationId,
          }
        );
      }
    } else {
      await db.updateStudent(
        Number(student.id),
        {
          // students.status enum에는 등록예정이 없음
          // 등록예정 여부는 approvalStatus로 구분
          status: "등록",
          approvalStatus:
            input.approvalStatus === "불승인" ? "불승인" : "대기",
          approvedAt: null,
          rejectedAt: input.approvalStatus === "불승인" ? now : null,
        } as any,
        {
          organizationId,
        }
      );

      if (student.consultationId) {
        await db.updateConsultation(
          Number(student.consultationId),
          {
            status: "등록예정",
          } as any,
          {
            organizationId,
          }
        );
      }
    }

    const afterStudent = await db.getStudent(Number(student.id), {
      organizationId,
    });

    await writeStudentAuditLog({
      ctx,
      studentId: Number(student.id),
      entityType: "semester",
      entityId: Number(input.id),
      action: input.approvalStatus === "승인" ? "complete" : "update",
      title:
        input.approvalStatus === "승인"
          ? `${sem.semesterOrder}학기 승인 처리`
          : `${sem.semesterOrder}학기 불승인 처리`,
      beforeJson: {
        semester: beforeSemester,
        student: beforeStudent,
      },
      afterJson: {
        semester: sem,
        student: afterStudent,
      },
    });

    if (student.assigneeId) {
      const notificationTitle =
        input.approvalStatus === "승인" ? "학기 승인 완료" : "학기 불승인";

      const notificationLevel =
        input.approvalStatus === "승인" ? "success" : "danger";

      const notificationMessage =
        input.approvalStatus === "승인"
          ? `[학기 승인] ${student.clientName || "학생"} 학생의 ${sem.semesterOrder}학기 승인이 완료되었습니다.`
          : `[학기 불승인] ${student.clientName || "학생"} 학생의 ${sem.semesterOrder}학기가 불승인 처리되었습니다.`;

      const notificationId = await db.createNotification({
        organizationId,
        userId: Number(student.assigneeId),
        type: "approval",
        title: notificationTitle,
        level: notificationLevel,
        message: notificationMessage,
        relatedId: Number(input.id),
        isRead: false,
      } as any);

      emitLiveNotification({
        id: Number(notificationId),
        userId: Number(student.assigneeId),
        type: "approval",
        title: notificationTitle,
        level: notificationLevel,
        message: notificationMessage,
        relatedId: Number(input.id),
        isRead: false,
      });
    }

    return { success: true };
  }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  const sem = await db.getSemester(input.id, {
    organizationId,
  });

  if (sem?.isLocked) throw new Error("승인된 학기는 삭제할 수 없습니다.");

  await db.deleteSemester(input.id, {
    organizationId,
  });
        return { success: true };
      }),
  }),

  refund: router({
    listByStudent: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const organizationId = Number((ctx.user as any)?.organizationId || 0);

const student = await db.getStudent(input.studentId, {
  organizationId,
});
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listRefundsByStudent(input.studentId, {
  organizationId,
});
      }),

    listPending: protectedProcedure.query(async ({ ctx }) => {
      if (!isAdminOrHost(ctx.user)) {
throw new Error("관리자, 호스트 또는 슈퍼호스트만 확인할 수 있습니다");
      }

      return db.listPendingRefunds({
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
    }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          semesterId: z.number().optional().nullable(),
          refundAmount: z.string(),
          refundDate: z.string(),
          reason: z.string().optional(),
          refundType: z
            .enum(["부분환불", "전액환불", "환불후재등록", "교육원이동"])
            .optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const organizationId = Number((ctx.user as any)?.organizationId || 0);

const student = await db.getStudent(input.studentId, {
  organizationId,
});
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const id = await db.createRefund({
organizationId,
          studentId: input.studentId,
          semesterId: input.semesterId ?? null,
          assigneeId: student.assigneeId,
          refundAmount: input.refundAmount as any,
          refundDate: new Date(input.refundDate),
          reason: input.reason ?? "",
          refundType: input.refundType ?? "부분환불",
          approvalStatus: "대기",
          attachmentName: input.attachmentName ?? null,
          attachmentUrl: input.attachmentUrl ?? null,
        } as any);

        return { id, success: true };
      }),

   approve: protectedProcedure

  .input(z.object({ id: z.number() }))
  .mutation(async ({ ctx, input }) => {
    if (!isAdminOrHost(ctx.user)) {
      throw new Error("관리자 또는 호스트만 승인할 수 있습니다");
    }

    const organizationId = Number((ctx.user as any)?.organizationId || 0);

const targetRefund = await db.getRefundById(input.id, {
  organizationId,
});

await db.approveRefund(input.id, Number(ctx.user.id), {
  organizationId,
} as any);

    if (targetRefund?.assigneeId) {
      const studentName =
        targetRefund.clientName || `학생 #${targetRefund.studentId}`;

      const notificationId = await db.createNotification({
  organizationId,
  userId: Number(targetRefund.assigneeId),
        type: "approval",
        title: "환불 승인 완료",
        level: "success",
        message: `[환불 승인] ${studentName} 환불이 승인되었습니다.`,
        relatedId: Number(input.id),
        isRead: false,
      } as any);

      emitLiveNotification({
  organizationId,
  id: Number(notificationId),
  userId: Number(targetRefund.assigneeId),
        type: "approval",
        title: "환불 승인 완료",
        level: "success",
        message: `[환불 승인] ${studentName} 환불이 승인되었습니다.`,
        relatedId: Number(input.id),
        isRead: false,
      });
    }

    return { success: true };
  }),

    reject: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 불승인 처리할 수 있습니다");
        }

        const organizationId = Number((ctx.user as any)?.organizationId || 0);

const targetRefund = await db.getRefundById(input.id, {
  organizationId,
});

await db.rejectRefund(input.id, Number(ctx.user.id), {
  organizationId,
} as any);

if (targetRefund?.assigneeId) {
  const studentName =
    targetRefund.clientName || `학생 #${targetRefund.studentId}`;

  const notificationId = await db.createNotification({
  organizationId,
  userId: Number(targetRefund.assigneeId),
    type: "approval",
    title: "환불 반려",
    level: "danger",
    message: `[환불 반려] ${studentName} 환불이 반려되었습니다.`,
    relatedId: Number(input.id),
    isRead: false,
  } as any);

  emitLiveNotification({
  organizationId,
  id: Number(notificationId),
  userId: Number(targetRefund.assigneeId),
    type: "approval",
    title: "환불 반려",
    level: "danger",
    message: `[환불 반려] ${studentName} 환불이 반려되었습니다.`,
    relatedId: Number(input.id),
    isRead: false,
  });
}

return { success: true };
      }),

   update: protectedProcedure
  .input(
    z.object({
      id: z.number(),
      semesterId: z.number().optional().nullable(),
      refundAmount: z.string().optional(),
      refundDate: z.string().optional(),
      reason: z.string().optional(),
      refundType: z
        .enum(["부분환불", "전액환불", "환불후재등록", "교육원이동"])
        .optional(),
      attachmentName: z.string().optional(),
      attachmentUrl: z.string().optional(),
    })
  )
      .mutation(async ({ ctx, input }) => {
  const data: any = {};

  if (input.semesterId !== undefined) data.semesterId = input.semesterId ?? null;
  if (input.refundAmount !== undefined) data.refundAmount = input.refundAmount;
  if (input.refundDate !== undefined)
    data.refundDate = input.refundDate ? new Date(input.refundDate) : null;
  if (input.reason !== undefined) data.reason = input.reason;
  if (input.refundType !== undefined) data.refundType = input.refundType;
  if (input.attachmentName !== undefined)
    data.attachmentName = input.attachmentName?.trim() || null;
  if (input.attachmentUrl !== undefined)
    data.attachmentUrl = input.attachmentUrl?.trim() || null;

  await db.updateRefund(input.id, data, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
return { success: true };
}),

    delete: hostProcedure
      .input(z.object({ id: z.number() }))
     .mutation(async ({ ctx, input }) => {
  await db.deleteRefund(input.id, {
    organizationId: Number((ctx.user as any)?.organizationId || 0),
  });
  return { success: true };
}),
  }),

  planSemester: router({
    list: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const organizationId = Number((ctx.user as any)?.organizationId || 0);

const student = await db.getStudent(input.studentId, {
  organizationId,
});
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listPlanSemesters(input.studentId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
      }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          semesterNo: z.number(),
          subjectName: z.string().min(1),
          category: z.enum(["전공", "교양", "일반"]),
          requirementType: z.enum(["전공필수", "전공선택", "교양", "일반"]).optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const organizationId = Number((ctx.user as any)?.organizationId || 0);

const student = await db.getStudent(input.studentId, {
  organizationId,
});
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const existing = await db.listPlanSemesters(input.studentId, {
  organizationId,
});
        const semesterCount = existing.filter(
          (x: any) => Number(x.semesterNo) === Number(input.semesterNo)
        ).length;

        if (semesterCount >= 8) {
          throw new Error("우리 플랜은 학기당 최대 8과목까지 등록할 수 있습니다");
        }

        const id = await db.createPlanSemester({
organizationId: Number((ctx.user as any)?.organizationId || 0),
          studentId: input.studentId,
          semesterNo: input.semesterNo,
          subjectName: input.subjectName.trim(),
          planCategory: input.category,
          planRequirementType: input.requirementType ?? null,
          credits: 3,
          sortOrder: input.sortOrder ?? 0,
        } as any);

        return { id, success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          subjectName: z.string().optional(),
          category: z.enum(["전공", "교양", "일반"]).optional(),
          requirementType: z.enum(["전공필수", "전공선택", "교양", "일반"]).optional(),
          semesterNo: z.number().optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const data: any = {};

        if (input.subjectName !== undefined) data.subjectName = input.subjectName.trim();
        if (input.category !== undefined) data.planCategory = input.category;
        if (input.requirementType !== undefined) data.planRequirementType = input.requirementType;
        if (input.semesterNo !== undefined) data.semesterNo = input.semesterNo;
        if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

        await db.updatePlanSemester(input.id, data, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deletePlanSemester(input.id, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
        return { success: true };
      }),
  }),

  transferSubject: router({
    list: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listTransferSubjects(input.studentId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
      }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          schoolName: z.string().optional(),
          subjectName: z.string().min(1),
          category: z.enum(["전공", "교양", "일반"]),
          requirementType: z.enum(["전공필수", "전공선택", "교양", "일반"]).optional(),
          credits: z.number().min(0).max(30),
          sortOrder: z.number().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const student = await db.getStudent(input.studentId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const existing = await db.listTransferSubjects(input.studentId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
        if ((existing?.length ?? 0) >= 100) {
          throw new Error("전적대 과목은 최대 100개까지 등록할 수 있습니다");
        }

        const id = await db.createTransferSubject({
 organizationId: Number((ctx.user as any)?.organizationId || 0),
          studentId: input.studentId,
          schoolName: input.schoolName?.trim() || null,
          subjectName: input.subjectName.trim(),
          transferCategory: input.category,
          transferRequirementType: input.requirementType ?? null,
          credits: input.credits,
          sortOrder: input.sortOrder ?? 0,
          attachmentName: input.attachmentName?.trim() || null,
          attachmentUrl: input.attachmentUrl?.trim() || null,
        } as any);

        return { id, success: true };
      }),

    bulkCreate: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          count: z.number().min(1).max(100),
          schoolName: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const organizationId = Number((ctx.user as any)?.organizationId || 0);

const student = await db.getStudent(input.studentId, {
  organizationId,
});
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

       const existing = await db.listTransferSubjects(input.studentId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
        const existingCount = existing?.length ?? 0;

        if (existingCount + input.count > 100) {
          throw new Error("전적대 과목은 최대 100개까지 등록할 수 있습니다");
        }

        const rows = Array.from({ length: input.count }).map((_, i) => ({
  organizationId,
  studentId: input.studentId,
          schoolName: input.schoolName?.trim() || "전적대",
          subjectName: `새 과목${existingCount + i + 1}`,
          transferCategory: "전공" as const,
          transferRequirementType: "전공선택" as const,
          credits: 3,
          sortOrder: existingCount + i,
          attachmentName: null,
          attachmentUrl: null,
        }));

        await db.bulkCreateTransferSubjects(rows as any);

        return { success: true, count: input.count };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          schoolName: z.string().optional(),
          subjectName: z.string().optional(),
          category: z.enum(["전공", "교양", "일반"]).optional(),
          requirementType: z.enum(["전공필수", "전공선택", "교양", "일반"]).optional(),
          credits: z.number().min(0).max(30).optional(),
          sortOrder: z.number().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const data: any = {};

        if (input.schoolName !== undefined) data.schoolName = input.schoolName.trim();
        if (input.subjectName !== undefined) data.subjectName = input.subjectName.trim();
        if (input.category !== undefined) data.transferCategory = input.category;
        if (input.requirementType !== undefined) data.transferRequirementType = input.requirementType;
        if (input.credits !== undefined) data.credits = input.credits;
        if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;
        if (input.attachmentName !== undefined) data.attachmentName = input.attachmentName.trim();
        if (input.attachmentUrl !== undefined) data.attachmentUrl = input.attachmentUrl.trim();

        await db.updateTransferSubject(input.id, data, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteTransferSubject(input.id, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
        return { success: true };
      }),
  }),

  transferAttachment: router({
    list: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const organizationId = Number((ctx.user as any)?.organizationId || 0);

const student = await db.getStudent(input.studentId, {
  organizationId,
});
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listTransferAttachments(input.studentId, {
  organizationId,
});
      }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          fileName: z.string().min(1),
          fileUrl: z.string().min(1),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const organizationId = Number((ctx.user as any)?.organizationId || 0);

const student = await db.getStudent(input.studentId, {
  organizationId,
});
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const existing = await db.listTransferAttachments(input.studentId, {
  organizationId,
});
        if ((existing?.length ?? 0) >= 4) {
          throw new Error("첨부파일은 최대 4개까지 등록할 수 있습니다");
        }

        const id = await db.createTransferAttachment({
organizationId,
          studentId: input.studentId,
          fileName: input.fileName.trim(),
          fileUrl: input.fileUrl.trim(),
          sortOrder: input.sortOrder ?? (existing?.length ?? 0),
        } as any);

        return { id, success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          fileName: z.string().optional(),
          fileUrl: z.string().optional(),
          sortOrder: z.number().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const data: any = {};
        if (input.fileName !== undefined) data.fileName = input.fileName.trim();
        if (input.fileUrl !== undefined) data.fileUrl = input.fileUrl.trim();
        if (input.sortOrder !== undefined) data.sortOrder = input.sortOrder;

        await db.updateTransferAttachment(input.id, data);
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteTransferAttachment(input.id);
        return { success: true };
      }),
  }),

courseTemplate: router({
  list: protectedProcedure
    .input(
      z
        .object({
          courseKey: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const organizationId = Number((ctx.user as any)?.organizationId || 0);

      if (!organizationId) {
        throw new Error("organizationId is required");
      }

      return db.listCourseSubjectTemplates(input?.courseKey, {
        organizationId,
      });
    }),

  create: hostProcedure
    .input(
      z.object({
        courseKey: z.string().min(1),
        subjectName: z.string().min(1),
        category: z.enum(["전공", "교양", "일반"]),
        requirementType: z
          .enum(["전공필수", "전공선택", "교양", "일반"])
          .optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = Number((ctx.user as any)?.organizationId || 0);

      if (!organizationId) {
        throw new Error("organizationId is required");
      }

      const id = await db.createCourseSubjectTemplate({
        organizationId,
        courseKey: input.courseKey.trim(),
        subjectName: input.subjectName.trim(),
        category: input.category,
        requirementType: input.requirementType ?? null,
        sortOrder: input.sortOrder ?? 0,
        isActive: true,
      } as any);

      return { id, success: true };
    }),

  applyToPlanSemester: protectedProcedure
    .input(
      z.object({
        studentId: z.number(),
        semesterNo: z.number(),
        subjectIds: z.array(z.number()).min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = Number((ctx.user as any)?.organizationId || 0);

      if (!organizationId) {
        throw new Error("organizationId is required");
      }

      const student = await db.getStudent(input.studentId, {
        organizationId,
      });
      if (!student) throw new Error("학생을 찾을 수 없습니다");

      if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
        throw new Error("권한이 없습니다");
      }

      const result = await db.bulkCreatePlanSemestersFromTemplate({
        organizationId,
        studentId: input.studentId,
        semesterNo: input.semesterNo,
        subjectIds: input.subjectIds,
      });

      return { success: true, count: result.count };
    }),
}), 

practiceEducationCenter: router({
  list: protectedProcedure
    .input(
      z.object({
        categoryId: z.number().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const organizationId = Number((ctx.user as any)?.organizationId || 0);

      if (!organizationId) {
        throw new Error("organizationId is required");
      }

      return db.listPracticeEducationCenters(input?.categoryId, {
        organizationId,
      });
    }),

  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const organizationId = Number((ctx.user as any)?.organizationId || 0);

      if (!organizationId) {
        throw new Error("organizationId is required");
      }

      return db.getPracticeEducationCenter(input.id, {
        organizationId,
      });
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        phone: z.string().optional(),
        address: z.string().optional(),
        detailAddress: z.string().optional(),
        feeAmount: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        note: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "host") {
        throw new Error("관리자 또는 호스트만 등록할 수 있습니다");
      }

      const organizationId = Number((ctx.user as any)?.organizationId || 0);

      if (!organizationId) {
        throw new Error("organizationId is required");
      }

      const id = await db.createPracticeEducationCenter({
        organizationId,
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        detailAddress: input.detailAddress?.trim() || null,
        feeAmount: input.feeAmount || "0",
        latitude: input.latitude || null,
        longitude: input.longitude || null,
        note: input.note || null,
        isActive: input.isActive ?? true,
        sortOrder: input.sortOrder ?? 0,
      } as any);

      return { id, success: true };
    }),

  bulkCreate: protectedProcedure
    .input(
      z.object({
        mode: z.enum(["append", "replace"]).default("append"),
        categoryId: z.number().nullable().optional(),
        rows: z.array(
          z.object({
            categoryId: z.number().optional(),
            representativeName: z.string().optional(),
            availableCourse: z.string().optional(),
            memo: z.string().optional(),
            name: z.string().min(1),
            phone: z.string().optional(),
            address: z.string().optional(),
            detailAddress: z.string().optional(),
            feeAmount: z.string().optional(),
            latitude: z.string().optional(),
            longitude: z.string().optional(),
            note: z.string().optional(),
            isActive: z.boolean().optional(),
            sortOrder: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "host" && ctx.user.role !== "superhost") {
        throw new Error("호스트만 등록할 수 있습니다");
      }

      const organizationId = Number((ctx.user as any)?.organizationId || 0);

      if (!organizationId) {
        throw new Error("organizationId is required");
      }

      return db.bulkCreatePracticeEducationCenters(
        input.rows.map((row, idx) => ({
          categoryId: row.categoryId ?? input.categoryId ?? null,
          representativeName: row.representativeName?.trim() || null,
          availableCourse: row.availableCourse?.trim() || null,
          memo: row.memo?.trim() || null,
          name: row.name.trim(),
          phone: row.phone?.trim() || null,
          address: row.address?.trim() || null,
          detailAddress: row.detailAddress?.trim() || null,
          feeAmount: row.feeAmount || "0",
          latitude: row.latitude || null,
          longitude: row.longitude || null,
          note: row.note?.trim() || null,
          isActive: row.isActive ?? true,
          sortOrder: row.sortOrder ?? idx,
        })),
        {
          organizationId,
          mode: input.mode,
          categoryId: input.categoryId ?? null,
        }
      );
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
        detailAddress: z.string().optional(),
        feeAmount: z.string().optional(),
        latitude: z.string().optional(),
        longitude: z.string().optional(),
        note: z.string().optional(),
        isActive: z.boolean().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "admin" && ctx.user.role !== "host") {
        throw new Error("관리자 또는 호스트만 수정할 수 있습니다");
      }

      const organizationId = Number((ctx.user as any)?.organizationId || 0);

      if (!organizationId) {
        throw new Error("organizationId is required");
      }

      const { id, ...rest } = input;
      await db.updatePracticeEducationCenter(id, rest as any, {
        organizationId,
      });

      return { success: true };
    }),

  updateAvailability: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        isInactive: z.boolean(),
        inactiveReason: z.string().nullable().optional(),
        inactiveStartDate: z.string().nullable().optional(),
        inactiveEndDate: z.string().nullable().optional(),
        hideOnMapWhenInactive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (
        ctx.user.role !== "admin" &&
        ctx.user.role !== "host" &&
        ctx.user.role !== "superhost"
      ) {
        throw new Error("관리자 또는 호스트만 수정할 수 있습니다");
      }

      const organizationId = Number((ctx.user as any)?.organizationId || 0);

      if (!organizationId) {
        throw new Error("organizationId is required");
      }

      await db.updatePracticeEducationCenterAvailability(
        input.id,
        {
          isInactive: input.isInactive,
          inactiveReason: input.inactiveReason ?? null,
          inactiveStartDate: input.inactiveStartDate ?? null,
          inactiveEndDate: input.inactiveEndDate ?? null,
          hideOnMapWhenInactive: input.hideOnMapWhenInactive ?? true,
        },
        { organizationId }
      );

      return { success: true };
    }),

  bulkDeactivate: protectedProcedure
    .input(
      z.object({
        inactiveReason: z.string().nullable().optional(),
        inactiveStartDate: z.string().nullable().optional(),
        inactiveEndDate: z.string().nullable().optional(),
        hideOnMapWhenInactive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.user.role !== "host" && ctx.user.role !== "superhost") {
        throw new Error("호스트만 일괄 비활성화할 수 있습니다");
      }

      const organizationId = Number((ctx.user as any)?.organizationId || 0);

      if (!organizationId) {
        throw new Error("organizationId is required");
      }

      return db.bulkDeactivatePracticeEducationCenters({
        organizationId,
        inactiveReason: input.inactiveReason ?? "일괄 비활성화",
        inactiveStartDate: input.inactiveStartDate ?? null,
        inactiveEndDate: input.inactiveEndDate ?? null,
        hideOnMapWhenInactive: input.hideOnMapWhenInactive ?? true,
      });
    }),

  fixCoords: protectedProcedure
    .input(
      z.object({
        limit: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = Number((ctx.user as any)?.organizationId || 0);

      if (!organizationId) {
        throw new Error("organizationId is required");
      }

      return db.fixMissingCoordinates({
        organizationId,
        type: "education",
        limit: input.limit,
      });
    }),

  delete: hostProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = Number((ctx.user as any)?.organizationId || 0);

      if (!organizationId) {
        throw new Error("organizationId is required");
      }

      await db.deletePracticeEducationCenter(input.id, {
        organizationId,
      });

      return { success: true };
    }),
}),
  practiceInstitution: router({
    list: protectedProcedure
  .input(
    z.object({
      institutionType: z.enum(["education", "institution"]).optional(),
      categoryId: z.number().optional(),
    }).optional()
  )
  .query(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  return db.listPracticeInstitutions({
    organizationId,
    institutionType: input?.institutionType,
    categoryId: input?.categoryId,
  });
}),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  return db.getPracticeInstitution(input.id, {
    organizationId,
  });
}),

    create: protectedProcedure
      .input(
        z.object({
          institutionType: z.enum(["education", "institution"]),
          name: z.string().min(1),
          representativeName: z.string().optional(),
          phone: z.string().optional(),
          address: z.string().min(1),
          detailAddress: z.string().optional(),
          price: z.string().optional(),
          latitude: z.string().optional(),
          longitude: z.string().optional(),
          availableCourse: z.string().optional(),
          memo: z.string().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 등록할 수 있습니다");
        }

const organizationId = Number((ctx.user as any)?.organizationId || 0);

if (!organizationId) {
  throw new Error("organizationId is required");
}

        const id = await db.createPracticeInstitution({
organizationId,
          institutionType: input.institutionType,
          name: input.name.trim(),
          representativeName: input.representativeName?.trim() || null,
          phone: input.phone?.trim() || null,
          address: input.address.trim(),
          detailAddress: input.detailAddress?.trim() || null,
          price: input.price || "0",
          latitude: input.latitude || null,
          longitude: input.longitude || null,
          availableCourse: input.availableCourse?.trim() || null,
          memo: input.memo || null,
          isActive: input.isActive ?? true,
        } as any);

        return { id, success: true };
      }),

    bulkCreate: protectedProcedure
      .input(
        z.object({
mode: z.enum(["append", "replace"]).default("append"),
categoryId: z.number().nullable().optional(),
          rows: z.array(
            z.object({
  institutionType: z.enum(["education", "institution"]),
  categoryId: z.number().optional(),
  name: z.string().min(1),
  representativeName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().min(1),
  detailAddress: z.string().optional(),
  price: z.string().optional(),
  latitude: z.string().optional(),
  longitude: z.string().optional(),
  availableCourse: z.string().optional(),
  memo: z.string().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().optional(),
})
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 등록할 수 있습니다");
        }

const organizationId = Number((ctx.user as any)?.organizationId || 0);

if (!organizationId) {
  throw new Error("organizationId is required");
}

       const result = await db.bulkCreatePracticeInstitutions(
  input.rows.map((row, idx) => ({
    institutionType: row.institutionType,
    categoryId: row.categoryId ?? null,
    name: row.name.trim(),
    representativeName: row.representativeName?.trim() || null,
    phone: row.phone?.trim() || null,
    address: row.address.trim(),
    detailAddress: row.detailAddress?.trim() || null,
    price: row.price || "0",
    latitude: row.latitude || null,
    longitude: row.longitude || null,
    availableCourse: row.availableCourse?.trim() || null,
    memo: row.memo || null,
    isActive: row.isActive ?? true,
    sortOrder: (row as any).sortOrder ?? idx,
  })) as any,
  {
  organizationId,
  mode: input.mode,
  categoryId: input.categoryId ?? null,
}
);

return result;
      }),

bulkDeactivate: protectedProcedure
  .input(
    z.object({
      institutionType: z.enum(["education", "institution"]).optional(),
      inactiveReason: z.string().nullable().optional(),
      inactiveStartDate: z.string().nullable().optional(),
      inactiveEndDate: z.string().nullable().optional(),
      hideOnMapWhenInactive: z.boolean().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
    if (ctx.user.role !== "host" && ctx.user.role !== "superhost") {
      throw new Error("호스트만 일괄 비활성화할 수 있습니다");
    }

const organizationId = Number((ctx.user as any)?.organizationId || 0);

if (!organizationId) {
  throw new Error("organizationId is required");
}

return db.bulkDeactivatePracticeInstitutions({
  organizationId,
  institutionType: input.institutionType,
      inactiveReason: input.inactiveReason ?? "일괄 비활성화",
      inactiveStartDate: input.inactiveStartDate ?? null,
      inactiveEndDate: input.inactiveEndDate ?? null,
      hideOnMapWhenInactive: input.hideOnMapWhenInactive ?? true,
    });
  }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          institutionType: z.enum(["education", "institution"]).optional(),
          name: z.string().optional(),
          representativeName: z.string().optional(),
          phone: z.string().optional(),
          address: z.string().optional(),
          detailAddress: z.string().optional(),
          price: z.string().optional(),
          latitude: z.string().optional(),
          longitude: z.string().optional(),
          availableCourse: z.string().optional(),
          memo: z.string().optional(),
          isActive: z.boolean().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 수정할 수 있습니다");
        }

        const { id, ...rest } = input;
        const data: any = {};

        if (rest.institutionType !== undefined) data.institutionType = rest.institutionType;
        if (rest.name !== undefined) data.name = rest.name.trim();
        if (rest.representativeName !== undefined) data.representativeName = rest.representativeName.trim();
        if (rest.phone !== undefined) data.phone = rest.phone.trim();
        if (rest.address !== undefined) data.address = rest.address.trim();
        if (rest.detailAddress !== undefined) data.detailAddress = rest.detailAddress.trim();
        if (rest.price !== undefined) data.price = rest.price;
        if (rest.latitude !== undefined) data.latitude = rest.latitude || null;
        if (rest.longitude !== undefined) data.longitude = rest.longitude || null;
        if (rest.availableCourse !== undefined) data.availableCourse = rest.availableCourse.trim();
        if (rest.memo !== undefined) data.memo = rest.memo;
        if (rest.isActive !== undefined) data.isActive = rest.isActive;

        const organizationId = Number((ctx.user as any)?.organizationId || 0);

if (!organizationId) {
  throw new Error("organizationId is required");
}

await db.updatePracticeInstitution(id, data, {
  organizationId,
});
        return { success: true };
      }),

  updateAvailability: protectedProcedure
    .input(
      z.object({
        id: z.number(),
        isInactive: z.boolean(),
        inactiveReason: z.string().nullable().optional(),
        inactiveStartDate: z.string().nullable().optional(),
        inactiveEndDate: z.string().nullable().optional(),
        hideOnMapWhenInactive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (
        ctx.user.role !== "admin" &&
        ctx.user.role !== "host" &&
        ctx.user.role !== "superhost"
      ) {
        throw new Error("관리자 또는 호스트만 수정할 수 있습니다");
      }

const organizationId = Number((ctx.user as any)?.organizationId || 0);

if (!organizationId) {
  throw new Error("organizationId is required");
}

      await db.updatePracticeInstitutionAvailability(
  input.id,
  {
    isInactive: input.isInactive,
    inactiveReason: input.inactiveReason ?? null,
    inactiveStartDate: input.inactiveStartDate ?? null,
    inactiveEndDate: input.inactiveEndDate ?? null,
    hideOnMapWhenInactive: input.hideOnMapWhenInactive ?? true,
  },
  { organizationId }
);

      return { success: true };
    }),

fixCoords: protectedProcedure
  .input(
    z.object({
      limit: z.number().optional(),
    })
  )
  .mutation(async ({ ctx, input }) => {
   const organizationId = Number((ctx.user as any)?.organizationId || 0);

if (!organizationId) {
  throw new Error("organizationId is required");
}

return db.fixMissingCoordinates({
  organizationId,
  type: "institution",
  limit: input.limit,
});
  }),

    delete: hostProcedure
      .input(z.object({ id: z.number() }))
     .mutation(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  if (!organizationId) {
    throw new Error("organizationId is required");
  }

  await db.deletePracticeInstitution(input.id, {
    organizationId,
  });
        return { success: true };
      }),
  }),

practiceListCategory: router({
  list: protectedProcedure
    .input(
      z.object({
        listType: z.enum(["education", "institution"]).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const organizationId = Number((ctx.user as any)?.organizationId || 0);

      if (!organizationId) {
        throw new Error("organizationId is required");
      }

      return db.listPracticeListCategories(input?.listType, {
        organizationId,
      });
    }),

  create: hostProcedure
    .input(
      z.object({
        name: z.string().min(1),
        listType: z.enum(["education", "institution"]),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = Number((ctx.user as any)?.organizationId || 0);

      if (!organizationId) {
        throw new Error("organizationId is required");
      }

      const id = await db.createPracticeListCategory({
        organizationId,
        name: input.name.trim(),
        listType: input.listType,
        description: input.description?.trim() || null,
        sortOrder: input.sortOrder ?? 0,
        isActive: true,
      } as any);

      return { success: true, id };
    }),

  update: hostProcedure
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        sortOrder: z.number().optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const organizationId = Number((ctx.user as any)?.organizationId || 0);

      if (!organizationId) {
        throw new Error("organizationId is required");
      }

      const { id, ...rest } = input;

      await db.updatePracticeListCategory(id, rest as any, {
        organizationId,
      });

      return { success: true };
    }),

  delete: hostProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const organizationId = Number((ctx.user as any)?.organizationId || 0);

      if (!organizationId) {
        throw new Error("organizationId is required");
      }

      await db.deletePracticeListCategory(input.id, {
        organizationId,
      });

      return { success: true };
    }),
}),

  jobSupport: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      const assigneeId = isAdminOrHost(ctx.user) ? undefined : Number(ctx.user.id) || 1;
      return db.listJobSupportRequests(assigneeId, {
  organizationId: Number((ctx.user as any)?.organizationId || 0),
});
    }),

    listByStudent: protectedProcedure
      .input(z.object({ studentId: z.number() }))
      .query(async ({ ctx, input }) => {
        const organizationId = Number((ctx.user as any)?.organizationId || 0);

const student = await db.getStudent(input.studentId, {
  organizationId,
});
        if (!student) return [];

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          return [];
        }

        return db.listJobSupportRequestsByStudent(input.studentId, {
  organizationId,
});
      }),

    create: protectedProcedure
      .input(
        z.object({
          studentId: z.number(),
          inputAddress: z.string().optional(),
          desiredArea: z.string().optional(),
          note: z.string().optional(),
          feeAmount: z.string().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const organizationId = Number((ctx.user as any)?.organizationId || 0);

const student = await db.getStudent(input.studentId, {
  organizationId,
});
        if (!student) throw new Error("학생을 찾을 수 없습니다");

        if (!isAdminOrHost(ctx.user) && student.assigneeId !== Number(ctx.user.id)) {
          throw new Error("권한이 없습니다");
        }

        const assignee = await db.getUserById(student.assigneeId);

        const id = await db.createJobSupportRequest({
organizationId,
          studentId: input.studentId,
          assigneeId: student.assigneeId,
          clientName: student.clientName,
          phone: student.phone,
          assigneeName: assignee?.name || null,
          inputAddress: input.inputAddress?.trim() || null,
          desiredArea: input.desiredArea?.trim() || null,
          includeWelfareCenter: true,
          includeCareCenter: true,
          includeEtcInstitution: false,
          supportStatus: "요청",
          feeAmount: input.feeAmount || "0",
          paymentStatus: "결제대기",
          note: input.note || null,
          attachmentName: input.attachmentName || null,
          attachmentUrl: input.attachmentUrl || null,
        } as any);

        return { id, success: true };
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number(),
          inputAddress: z.string().optional(),
          desiredArea: z.string().optional(),
          supportStatus: z.enum(["요청", "진행중", "면접안내", "완료", "보류", "취소"]).optional(),
          selectedInstitutionName: z.string().optional(),
          selectedInstitutionAddress: z.string().optional(),
          selectedInstitutionDistanceKm: z.string().optional(),
          feeAmount: z.string().optional(),
          paymentStatus: z.enum(["결제대기", "입금확인", "완료", "취소"]).optional(),
          paidAt: z.string().optional(),
          note: z.string().optional(),
          attachmentName: z.string().optional(),
          attachmentUrl: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!isAdminOrHost(ctx.user)) {
          throw new Error("관리자 또는 호스트만 수정할 수 있습니다");
        }

        const data: any = {};
        if (input.inputAddress !== undefined) data.inputAddress = input.inputAddress.trim();
        if (input.desiredArea !== undefined) data.desiredArea = input.desiredArea.trim();
        if (input.supportStatus !== undefined) data.supportStatus = input.supportStatus;
        if (input.selectedInstitutionName !== undefined) data.selectedInstitutionName = input.selectedInstitutionName.trim();
        if (input.selectedInstitutionAddress !== undefined) data.selectedInstitutionAddress = input.selectedInstitutionAddress.trim();
        if (input.selectedInstitutionDistanceKm !== undefined) data.selectedInstitutionDistanceKm = input.selectedInstitutionDistanceKm || null;
        if (input.feeAmount !== undefined) data.feeAmount = input.feeAmount;
        if (input.paymentStatus !== undefined) data.paymentStatus = input.paymentStatus;
        if (input.paidAt !== undefined) data.paidAt = input.paidAt ? new Date(input.paidAt) : null;
        if (input.note !== undefined) data.note = input.note;
        if (input.attachmentName !== undefined) data.attachmentName = input.attachmentName;
        if (input.attachmentUrl !== undefined) data.attachmentUrl = input.attachmentUrl;

        await db.updateJobSupportRequest(input.id, data);
        return { success: true };
      }),

    delete: hostProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.deleteJobSupportRequest(input.id);
        return { success: true };
      }),
  }),

    settlement: router({
    report: adminProcedure
      .input(
        z.object({
          year: z.number(),
          month: z.number(),
          assigneeId: z.number().optional(),
        })
      )
      .query(async ({ input, ctx }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowSettlementReport",
    "현재 회사는 정산 리포트 기능을 사용할 수 없습니다."
  );

  const canSeeAll = isAdminOrHost(ctx.user);

    return db.getSettlementReport(
    input.year,
    input.month,
    canSeeAll ? input.assigneeId : Number(ctx.user.id),
    {
      organizationId,
    }
  );
}),

    entries: adminProcedure
      .input(
        z.object({
          year: z.number(),
          month: z.number(),
          assigneeId: z.number().optional(),
        })
      )
      .query(async ({ input, ctx }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowSettlementReport",
    "현재 회사는 정산 리포트 기능을 사용할 수 없습니다."
  );

  const canSeeAll = isAdminOrHost(ctx.user);

  return db.getSettlementEntries({
  organizationId,
  year: input.year,
  month: input.month,
  assigneeId: canSeeAll ? input.assigneeId : Number(ctx.user.id),
});
      }),

    institutionSummary: hostProcedure
      .input(
        z.object({
          year: z.number(),
          month: z.number(),
        })
      )
      .query(async ({ input, ctx }) => {
  assertHostOrSuperhost(ctx.user);

  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowSettlementReport",
    "현재 회사는 정산 리포트 기능을 사용할 수 없습니다."
  );

  return db.getSettlementInstitutionSummary({
          year: input.year,
          month: input.month,
          organizationId,
        } as any);
      }),

    institutionEntries: hostProcedure
      .input(
        z.object({
          year: z.number(),
          month: z.number(),
          institutionName: z.string().min(1),
        })
      )
      .query(async ({ input, ctx }) => {
  assertHostOrSuperhost(ctx.user);

  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowSettlementReport",
    "현재 회사는 정산 리포트 기능을 사용할 수 없습니다."
  );

  return db.getSettlementInstitutionEntries({
          year: input.year,
          month: input.month,
          institutionName: input.institutionName,
          organizationId,
        } as any);
      }),

    institutionMonthlyTrend: hostProcedure
      .input(
        z.object({
          year: z.number(),
        })
      )
      .query(async ({ input, ctx }) => {
  assertHostOrSuperhost(ctx.user);

  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowSettlementReport",
    "현재 회사는 정산 리포트 기능을 사용할 수 없습니다."
  );

  return db.getSettlementInstitutionMonthlyTrend({
          year: input.year,
          organizationId,
        } as any);
      }),

    downloadPayslipExcel: protectedProcedure
      .input(
        z.object({
          year: z.number(),
          month: z.number(),
          assigneeId: z.number(),
        })
      )
     .mutation(async ({ ctx, input }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowSettlementReport",
    "현재 회사는 정산 리포트 기능을 사용할 수 없습니다."
  );

  const assigneeId = isAdminOrHost(ctx.user)
          ? input.assigneeId
          : Number(ctx.user.id);

        const payslipData = await db.getSettlementPayslip({
          year: input.year,
          month: input.month,
          assigneeId,
          organizationId,
        } as any);

        const { fileName, buffer } =
          await buildSettlementPayslipExcel(payslipData);

        const base64 = Buffer.from(buffer).toString("base64");

        return {
          success: true,
          fileName,
          base64,
        };
      }),

    payslip: adminProcedure
      .input(
        z.object({
          year: z.number(),
          month: z.number(),
          assigneeId: z.number(),
        })
      )
      .query(async ({ input, ctx }) => {
  const organizationId = Number((ctx.user as any)?.organizationId || 0);

  await assertOrganizationFeatureEnabled(
    organizationId,
    "allowSettlementReport",
    "현재 회사는 정산 리포트 기능을 사용할 수 없습니다."
  );

  const canSeeAll = isAdminOrHost(ctx.user);
        const targetAssigneeId = canSeeAll
          ? input.assigneeId
          : Number(ctx.user.id);

        return db.getSettlementPayslip({
          year: input.year,
          month: input.month,
          assigneeId: targetAssigneeId,
          organizationId,
        } as any);
      }),
  }),


  superhost: router({
  /**
   * 슈퍼호스트 홈 대시보드
   */
  dashboard: superHostProcedure.query(async () => {
    return {
      success: true,
      sections: [
        { key: "tenants", label: "테넌트 관리", status: "준비중" },
        { key: "layoutBuilder", label: "레이아웃 빌더", status: "준비중" },
        { key: "aiPolicy", label: "AI 정책 관리", status: "준비중" },
        { key: "security", label: "보안 분리", status: "진행중" },
      ],
    };
  }),

  /**
   * SaaS 기준:
   * superhost는 플랫폼 운영자일 뿐,
   * 각 회사 직원 계정은 각 회사 host가 직접 관리한다.
   */
  createUser: superHostProcedure
    .input(
      z.object({
        openId: z.string().min(1),
        username: z.string().min(1),
        password: z.string().min(4),
        name: z.string().min(1),
        email: z.string().optional(),
        phone: z.string().optional(),
        role: z.enum(["staff", "admin", "host", "superhost"]).default("staff"),
        bankName: z.string().optional(),
        bankAccount: z.string().optional(),
      })
    )
    .mutation(async () => {
      throw new Error("SaaS 운영자는 각 회사 직원을 직접 생성할 수 없습니다.");
    }),

  /**
   * SaaS 기준:
   * 각 회사 직원 권한 변경은 해당 회사 host가 처리한다.
   */
  updateUserRole: superHostProcedure
    .input(
      z.object({
        id: z.number(),
        role: z.enum(["staff", "admin", "host", "superhost"]),
      })
    )
    .mutation(async () => {
      throw new Error("SaaS 운영자는 각 회사 직원 권한을 직접 변경할 수 없습니다.");
    }),

  /**
   * SaaS 기준:
   * superhost도 전체 회사 직원 목록을 볼 수 없다.
   */
  listUsers: superHostProcedure.query(async () => {
    throw new Error("SaaS 운영자는 각 회사 직원을 직접 조회할 수 없습니다.");
  }),

  /**
   * superhost용 AI 정책 더미
   * 나중에 ai_policies 같은 테이블 생기면 연결
   */
  aiPolicy: router({
    get: superHostProcedure.query(async () => {
      return {
        success: true,
        policy: {
          allowSearch: true,
          allowCreateTransferSubject: true,
          allowCreatePlanSemester: true,
          allowDelete: false,
          allowSchemaChange: false,
          allowServerEdit: false,
        },
      };
    }),

        update: superHostProcedure
      .input(
        z.object({
          allowSearch: z.boolean(),
          allowCreateTransferSubject: z.boolean(),
          allowCreatePlanSemester: z.boolean(),
          allowDelete: z.boolean(),
          allowSchemaChange: z.boolean(),
          allowServerEdit: z.boolean(),
        })
      )
      .mutation(async ({ input }) => {
        return {
          success: true,
          policy: input,
        };
      }),
  }),
  }),
});

console.log("[ROUTER OK] planSemester loaded");
console.log("[ROUTER OK] transferSubject loaded");
console.log("[ROUTER OK] transferAttachment loaded");
console.log("[ROUTER OK] courseTemplate loaded");
console.log("[ROUTER OK] privateCertificate loaded");
console.log("[ROUTER OK] practiceSupport loaded");
console.log("[ROUTER OK] practiceInstitution loaded");
console.log("[ROUTER OK] jobSupport loaded");

export type AppRouter = typeof appRouter;