import * as db from "../db";
import { listOrganizations } from "../saasdb";
import {
  uploadPrivateJsonObject,
  deletePrivateObject,
} from "./objectStorage";

let autoBackupTimer: NodeJS.Timeout | null = null;
let isRunning = false;

function getAutoBackupIntervalMs() {
  const hours = Number(process.env.AUTO_BACKUP_INTERVAL_HOURS || 24);
  const safeHours = Number.isFinite(hours) && hours > 0 ? hours : 24;

  return safeHours * 60 * 60 * 1000;
}

function isAutoBackupEnabled() {
  return String(process.env.AUTO_BACKUP_ENABLED || "").toLowerCase() === "true";
}

async function runAutoBackupOnce() {
  if (!isAutoBackupEnabled()) {
    console.log("[AUTO BACKUP] disabled");
    return;
  }

  if (isRunning) {
    console.log("[AUTO BACKUP] skipped: already running");
    return;
  }

  isRunning = true;

  try {
    const organizations = await listOrganizations();

    const targets = (organizations || []).filter((org: any) => {
      return (
        Number(org.id || 0) > 0 &&
        String(org.status || "") === "active" &&
        Boolean(org.allowAutoBackup)
      );
    });

    console.log("[AUTO BACKUP] start", {
      targetCount: targets.length,
    });

    for (const org of targets) {
      const organizationId = Number(org.id);

      let backupId: number | null = null;

      try {
        backupId = Number(
          await db.createOrganizationBackupRecord({
            organizationId,
            requestedBy: Number(org.ownerUserId || 0) || 1,
            backupType: "auto",
          })
        );

        const exported = await db.exportOrganizationBackupData({
          organizationId,
          requestedBy: Number(org.ownerUserId || 0) || 1,
          actorRole: "system",
        });

        const backupKey = `organization-backups/${organizationId}/auto/${exported.fileName}`;

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
          actorUserId: null,
          actorRole: "system",
          action: "organization.backup.auto.create",
          targetType: "organization_backup",
          targetId: Number(backupId),
          memo: `자동 백업 생성: ${exported.fileName}`,
        } as any);

        console.log("[AUTO BACKUP] completed", {
          organizationId,
          backupId,
          fileName: exported.fileName,
        });

const oldBackups = await db.listAutoBackupsToPrune({
  organizationId,
  keepCount: 7,
});

for (const oldBackup of oldBackups) {
  const oldFileKey = String((oldBackup as any).fileKey || "");

  if (oldFileKey) {
    try {
      await deletePrivateObject({
        key: oldFileKey,
      });
    } catch (deleteError: any) {
      console.warn("[AUTO BACKUP] old file delete failed", {
        organizationId,
        backupId: Number((oldBackup as any).id),
        fileKey: oldFileKey,
        message: deleteError?.message || String(deleteError),
      });
    }
  }

  await db.deleteOrganizationBackupRecord({
    organizationId,
    id: Number((oldBackup as any).id),
  });

  console.log("[AUTO BACKUP] pruned old backup", {
    organizationId,
    backupId: Number((oldBackup as any).id),
    fileKey: oldFileKey || null,
  });
}
      } catch (error: any) {
        console.error("[AUTO BACKUP] failed", {
          organizationId,
          backupId,
          message: error?.message || String(error),
        });

        if (backupId) {
          await db.markOrganizationBackupFailed({
            id: Number(backupId),
            organizationId,
            errorMessage: error?.message || "자동 백업 실패",
          });
        }
      }
    }

    console.log("[AUTO BACKUP] finished");
  } finally {
    isRunning = false;
  }
}

export function startAutoBackupScheduler() {
  if (!isAutoBackupEnabled()) {
    console.log("[AUTO BACKUP] scheduler disabled");
    return;
  }

  if (autoBackupTimer) {
    console.log("[AUTO BACKUP] scheduler already started");
    return;
  }

  const intervalMs = getAutoBackupIntervalMs();

  console.log("[AUTO BACKUP] scheduler started", {
    intervalHours: intervalMs / 60 / 60 / 1000,
  });

  autoBackupTimer = setInterval(() => {
    runAutoBackupOnce().catch((error) => {
      console.error("[AUTO BACKUP] scheduler error", error);
    });
  }, intervalMs);

  if (process.env.AUTO_BACKUP_RUN_ON_START === "true") {
    runAutoBackupOnce().catch((error) => {
      console.error("[AUTO BACKUP] startup run error", error);
    });
  }
}