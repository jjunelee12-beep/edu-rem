// server/nile/run-nile-standard-sync.ts

import "dotenv/config";

import {
  eq,
} from "drizzle-orm";

import {
  getDb,
} from "../db";

import {
  nileStandardSyncRuns,
} from "../../drizzle/schema";

import {
  collectNileStandardDataset,
} from "./nile-standard-collector";

import {
  seedNileStandardDataset,
} from "./nile-standard-seed";

import {
  validateNileStandardDataset,
  summarizeNileValidation,
} from "./validators/nile-standard-validator";

import type {
  NileCollectorResult,
  NileFullSyncResult,
  NileSeedStats,
} from "./nile-standard-types";


/* =========================================================
 * Constants
 * ========================================================= */

const DEFAULT_STANDARD_VERSION =
  "current";


/* =========================================================
 * CLI options
 * ========================================================= */

type NileSyncCliOptions = {
  /**
   * true:
   * 전체 NILE Master 동기화.
   *
   * false:
   * --major 옵션으로 특정 전공 테스트.
   */
  fullSync: boolean;

  /**
   * 부분 테스트할 officialMajorId.
   *
   * 예:
   * AGAE
   * AACG
   */
  onlyMajorIds: string[];

  standardVersion: string;

  concurrency: number;
};


/* =========================================================
 * Helpers
 * ========================================================= */

function cleanText(
  value:
    | string
    | null
    | undefined
): string {
  return String(
    value || ""
  )
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}


function toErrorMessage(
  error: unknown
): string {
  if (
    error instanceof Error
  ) {
    return error.stack ||
      error.message;
  }

  return String(
    error ||
    "unknown error"
  );
}


function createEmptyStats():
  NileSeedStats {
  return {
    curriculumCount:
      0,

    subjectCount:
      0,

    liberalSubjectCount:
      0,

    compatibleSubjectCount:
      0,

    aliasCount:
      0,

    insertedCount:
      0,

    updatedCount:
      0,

    deactivatedCount:
      0,
  };
}


function parsePositiveInteger(
  value:
    | string
    | null
    | undefined,
  fallback: number
): number {
  const parsed =
    Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    return fallback;
  }

  return parsed;
}


/* =========================================================
 * CLI parser
 * ========================================================= */

/**
 * 기본 실행:
 *
 * npx tsx server/nile/run-nile-standard-sync.ts
 *
 * → 전체 sync
 *
 *
 * 특정 전공 테스트:
 *
 * npx tsx server/nile/run-nile-standard-sync.ts --major=AGAE
 *
 * 또는
 *
 * npx tsx server/nile/run-nile-standard-sync.ts --major=AGAE,AACG
 *
 *
 * 동시 요청 수:
 *
 * --concurrency=3
 */
function parseCliOptions():
  NileSyncCliOptions {
  const args =
    process.argv.slice(2);

  let standardVersion =
    DEFAULT_STANDARD_VERSION;

  let concurrency =
    3;

  const onlyMajorIds:
    string[] = [];


  for (
    const rawArg
    of args
  ) {
    const arg =
      cleanText(
        rawArg
      );


    if (
      arg.startsWith(
        "--major="
      )
    ) {
      const value =
        arg.slice(
          "--major=".length
        );


      const ids =
        value
          .split(",")
          .map(
            (item) =>
              cleanText(
                item
              )
                .toUpperCase()
          )
          .filter(Boolean);


      onlyMajorIds.push(
        ...ids
      );

      continue;
    }


    if (
      arg.startsWith(
        "--version="
      )
    ) {
      const value =
        cleanText(
          arg.slice(
            "--version=".length
          )
        );


      if (value) {
        standardVersion =
          value;
      }

      continue;
    }


    if (
      arg.startsWith(
        "--concurrency="
      )
    ) {
      concurrency =
        parsePositiveInteger(
          arg.slice(
            "--concurrency=".length
          ),
          3
        );
    }
  }


  const uniqueMajorIds =
    Array.from(
      new Set(
        onlyMajorIds
      )
    );


  return {
    fullSync:
      uniqueMajorIds.length ===
      0,

    onlyMajorIds:
      uniqueMajorIds,

    standardVersion,

    concurrency,
  };
}


/* =========================================================
 * Sync run DB helpers
 * ========================================================= */

async function createSyncRun(
  params: {
    fullSync: boolean;

    standardVersion: string;

    onlyMajorIds: string[];

    startedAt: Date;
  }
): Promise<number> {
  const db =
    await getDb();


  if (!db) {
    throw new Error(
      "NILE Sync Run 생성용 DB가 없습니다."
    );
  }


  const curriculumKey =
    params.fullSync
      ? null
      : (
          params
            .onlyMajorIds
            .length > 0
            ? params
                .onlyMajorIds
                .join(",")
            : null
        );


  const insertResult =
    await db
      .insert(
        nileStandardSyncRuns
      )
      .values({
        syncType:
          params.fullSync
            ? "full"
            : "curriculum",

        status:
          "running",

        curriculumKey,

        standardVersion:
          params.standardVersion,

        curriculumCount:
          0,

        subjectCount:
          0,

        liberalSubjectCount:
          0,

        compatibleSubjectCount:
          0,

        insertedCount:
          0,

        updatedCount:
          0,

        deactivatedCount:
          0,

        errorMessage:
          null,

        startedAt:
          params.startedAt,

        finishedAt:
          null,
      });


  /**
   * mysql2 + drizzle의 insert 결과에서
   * insertId를 안전하게 읽는다.
   */
  const raw =
    insertResult as any;


  const syncRunId =
    Number(
      raw?.[0]?.insertId ??
      raw?.insertId ??
      0
    );


  if (
    syncRunId > 0
  ) {
    return syncRunId;
  }


  /**
   * insertId를 드라이버에서 직접 반환하지 않는 경우 fallback.
   *
   * 방금 생성한 running row를
   * startedAt / version 조건으로 찾는다.
   */
  const rows =
    await db
      .select({
        id:
          nileStandardSyncRuns.id,

        startedAt:
          nileStandardSyncRuns.startedAt,

        standardVersion:
          nileStandardSyncRuns.standardVersion,

        status:
          nileStandardSyncRuns.status,
      })
      .from(
        nileStandardSyncRuns
      )
      .where(
        eq(
          nileStandardSyncRuns.status,
          "running"
        )
      );


  const matched =
    rows
      .filter(
        (row) => {
          const versionMatched =
            cleanText(
              row.standardVersion
            ) ===
            params.standardVersion;


          const rowTime =
            row.startedAt instanceof Date
              ? row.startedAt.getTime()
              : new Date(
                  row.startedAt as any
                ).getTime();


          const startedDiffMs =
  Math.abs(
    rowTime -
    params.startedAt.getTime()
  );

const startedMatched =
  Number.isFinite(
    startedDiffMs
  ) &&
  startedDiffMs <=
    2_000;


          return (
            versionMatched &&
            startedMatched
          );
        }
      )
      .sort(
        (a, b) =>
          Number(b.id) -
          Number(a.id)
      )[0];


  const fallbackId =
    Number(
      matched?.id || 0
    );


  if (
    fallbackId <= 0
  ) {
    throw new Error(
      "NILE Sync Run ID를 확인할 수 없습니다."
    );
  }


  return fallbackId;
}


async function markSyncRunSuccess(
  params: {
    syncRunId: number;

    stats: NileSeedStats;

    finishedAt: Date;
  }
): Promise<void> {
  const db =
    await getDb();


  if (!db) {
    throw new Error(
      "NILE Sync Run 성공 기록용 DB가 없습니다."
    );
  }


  await db
    .update(
      nileStandardSyncRuns
    )
    .set({
      status:
        "success",

      curriculumCount:
        params.stats
          .curriculumCount,

      subjectCount:
        params.stats
          .subjectCount,

      liberalSubjectCount:
        params.stats
          .liberalSubjectCount,

      compatibleSubjectCount:
        params.stats
          .compatibleSubjectCount,

      insertedCount:
        params.stats
          .insertedCount,

      updatedCount:
        params.stats
          .updatedCount,

      deactivatedCount:
        params.stats
          .deactivatedCount,

      errorMessage:
        null,

      finishedAt:
        params.finishedAt,
    })
    .where(
      eq(
        nileStandardSyncRuns.id,
        params.syncRunId
      )
    );
}


async function markSyncRunFailed(
  params: {
    syncRunId: number;

    errorMessage: string;

    stats?: NileSeedStats;

    finishedAt: Date;
  }
): Promise<void> {
  const db =
    await getDb();


  if (!db) {
    console.error(
      "[NILE SYNC] 실패 이력을 DB에 기록할 수 없습니다."
    );

    return;
  }


  const stats =
    params.stats ||
    createEmptyStats();


  await db
    .update(
      nileStandardSyncRuns
    )
    .set({
      status:
        "failed",

      curriculumCount:
        stats.curriculumCount,

      subjectCount:
        stats.subjectCount,

      liberalSubjectCount:
        stats.liberalSubjectCount,

      compatibleSubjectCount:
        stats.compatibleSubjectCount,

      insertedCount:
        stats.insertedCount,

      updatedCount:
        stats.updatedCount,

      deactivatedCount:
        stats.deactivatedCount,

      errorMessage:
        params.errorMessage
          .slice(
            0,
            50_000
          ),

      finishedAt:
        params.finishedAt,
    })
    .where(
      eq(
        nileStandardSyncRuns.id,
        params.syncRunId
      )
    );
}


/* =========================================================
 * Collector failure helper
 * ========================================================= */

function buildCollectorError(
  result:
    NileCollectorResult
): Error {
  const messages =
    result.errors
      .filter(Boolean);


  if (
    messages.length === 0
  ) {
    return new Error(
      "NILE Collector가 실패했지만 오류 메시지가 없습니다."
    );
  }


  return new Error(
    [
      `NILE Collector 실패 (${messages.length} errors)`,
      ...messages
        .slice(
          0,
          30
        )
        .map(
          (
            message,
            index
          ) =>
            `${index + 1}. ${message}`
        ),
    ].join("\n")
  );
}


/* =========================================================
 * Main sync
 * ========================================================= */

export async function runNileStandardSync():
  Promise<NileFullSyncResult> {
  const options =
    parseCliOptions();


  const startedAt =
    new Date();


  let syncRunId =
    0;


  let currentStats:
    NileSeedStats =
    createEmptyStats();


  console.log(
    "[NILE SYNC] start",
    {
      fullSync:
        options.fullSync,

      standardVersion:
        options.standardVersion,

      concurrency:
        options.concurrency,

      onlyMajorIds:
        options.onlyMajorIds,
    }
  );


  try {
    /* -----------------------------------------------------
     * Sync history start
     * ----------------------------------------------------- */

    syncRunId =
      await createSyncRun({
        fullSync:
          options.fullSync,

        standardVersion:
          options
            .standardVersion,

        onlyMajorIds:
          options.onlyMajorIds,

        startedAt,
      });


    console.log(
      "[NILE SYNC] run created",
      {
        syncRunId,
      }
    );


    /* -----------------------------------------------------
     * Collector
     * ----------------------------------------------------- */

    console.log(
      "[NILE SYNC] collector start"
    );


    const collectorResult =
      await collectNileStandardDataset({
        standardVersion:
          options
            .standardVersion,

        concurrency:
          options.concurrency,

        onlyMajorIds:
          options.fullSync
            ? undefined
            : options
                .onlyMajorIds,

        /**
         * 전체 sync에서만
         * 교양/호환과목 전체 Master를 갱신한다.
         *
         * 특정 전공 테스트에서 공통 Master를
         * 건드리지 않도록 막는다.
         */
        includeLiberalSubjects:
          options.fullSync,

        includeCompatibleSubjects:
          options.fullSync,
      });


    if (
      !collectorResult.success ||
      !collectorResult.dataset
    ) {
      throw buildCollectorError(
        collectorResult
      );
    }


    const dataset =
      collectorResult.dataset;


    console.log(
      "[NILE SYNC] collector complete",
      {
        curriculumCount:
          dataset
            .curriculums
            .length,

        subjectCount:
          dataset
            .curriculums
            .reduce(
              (
                sum,
                curriculum
              ) =>
                sum +
                curriculum
                  .subjects
                  .length,
              0
            ),

        liberalSubjectCount:
          dataset
            .liberalSubjects
            .length,

        compatibleSubjectCount:
          dataset
            .majorLiberalCompatibleSubjects
            .length,

        aliasCount:
          dataset
            .subjectAliases
            .length,

        warnings:
          collectorResult
            .warnings
            .length,
      }
    );


    if (
      collectorResult
        .warnings
        .length >
      0
    ) {
      console.warn(
        "[NILE SYNC] collector warnings",
        collectorResult.warnings
      );
    }


    /* -----------------------------------------------------
     * Validator - explicit log
     * ----------------------------------------------------- */

    console.log(
      "[NILE SYNC] validator start"
    );


    const validation =
      validateNileStandardDataset(
        dataset,
        {
          fullSync:
            options.fullSync,
        }
      );


    const validationSummary =
      summarizeNileValidation(
        validation
      );


    console.log(
      "[NILE SYNC] validator result",
      validationSummary
    );


    if (
      !validation.valid
    ) {
      const errorIssues =
        validation
          .issues
          .filter(
            (issue) =>
              issue.level ===
              "error"
          );


      throw new Error(
        [
          `NILE Validator 실패 (${errorIssues.length} errors)`,

          ...errorIssues
            .slice(
              0,
              30
            )
            .map(
              (
                issue,
                index
              ) =>
                [
                  `${index + 1}.`,
                  issue.code,
                  issue.message,

                  issue.curriculumKey
                    ? `curriculum=${issue.curriculumKey}`
                    : "",

                  issue.subjectName
                    ? `subject=${issue.subjectName}`
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")
            ),
        ].join("\n")
      );
    }


    /* -----------------------------------------------------
     * Seed
     * ----------------------------------------------------- */

    console.log(
      "[NILE SYNC] seed start"
    );


    const seedResult =
      await seedNileStandardDataset(
        dataset,
        {
          fullSync:
            options.fullSync,
        }
      );


    currentStats =
      seedResult.stats;


    console.log(
      "[NILE SYNC] seed complete",
      currentStats
    );


    /* -----------------------------------------------------
     * Success history
     * ----------------------------------------------------- */

    const finishedAt =
      new Date();


    await markSyncRunSuccess({
      syncRunId,

      stats:
        currentStats,

      finishedAt,
    });


    const result:
      NileFullSyncResult = {
      success:
        true,

      syncRunId,

      startedAt,

      finishedAt,

      stats:
        currentStats,

      warnings:
        collectorResult
          .warnings,

      errors:
        [],
    };


    console.log(
      "[NILE SYNC] success",
      JSON.stringify(
        result,
        null,
        2
      )
    );


    return result;
  } catch (error) {
    const finishedAt =
      new Date();


    const errorMessage =
      toErrorMessage(
        error
      );


    console.error(
      "[NILE SYNC] failed",
      error
    );


    if (
      syncRunId > 0
    ) {
      try {
        await markSyncRunFailed({
          syncRunId,

          errorMessage,

          stats:
            currentStats,

          finishedAt,
        });
      } catch (
        historyError
      ) {
        console.error(
          "[NILE SYNC] failed-history update failed",
          historyError
        );
      }
    }


    const result:
      NileFullSyncResult = {
      success:
        false,

      syncRunId:
        syncRunId > 0
          ? syncRunId
          : null,

      startedAt,

      finishedAt,

      stats:
        currentStats,

      warnings:
        [],

      errors: [
        errorMessage,
      ],
    };


    return result;
  }
}


/* =========================================================
 * CLI
 * ========================================================= */

async function main():
  Promise<void> {
  const result =
    await runNileStandardSync();


  if (
    !result.success
  ) {
    process.exitCode =
      1;

    return;
  }


  process.exitCode =
    0;
}


main().catch(
  (error) => {
    console.error(
      "[NILE SYNC RUNNER] fatal",
      error
    );

    process.exitCode =
      1;
  }
);