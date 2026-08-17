// server/nile/nile-standard-seed.ts

import {
  and,
  eq,
} from "drizzle-orm";

import {
  getDb,
} from "../db";

import {
  nileStandardCurriculums,
  nileStandardSubjects,
  nileLiberalSubjects,
  nileMajorLiberalCompatibleSubjects,
  nileSubjectAliases,
} from "../../drizzle/schema";

import {
  normalizeNileSubjectName,

  type NileCollectedDataset,
  type NileSeedStats,
} from "./nile-standard-types";

import {
  assertValidNileStandardDataset,
} from "./validators/nile-standard-validator";


/* =========================================================
 * Public types
 * ========================================================= */

export type NileStandardDatasetSeedResult = {
  success: boolean;

  stats: NileSeedStats;

  curriculums: Array<{
    curriculumKey: string;

    curriculumId: number;

    subjectCount: number;
  }>;
};


export type NileStandardDatasetSeedOptions = {
  /**
   * true:
   * 전체 국평원 Master 동기화.
   *
   * 수집 결과에서 사라진 기존 공식 데이터는
   * isActive=false 처리한다.
   *
   * false:
   * 특정 전공 테스트/부분 동기화.
   *
   * 다른 전공/교양 데이터는 비활성화하지 않는다.
   */
  fullSync?: boolean;
};


/* =========================================================
 * Internal types
 * ========================================================= */

type MutableSeedStats = {
  curriculumCount: number;

  subjectCount: number;

  liberalSubjectCount: number;

  compatibleSubjectCount: number;

  aliasCount: number;

  insertedCount: number;

  updatedCount: number;

  deactivatedCount: number;
};


type CurriculumIdMap =
  Map<
    string,
    number
  >;


/* =========================================================
 * Generic helpers
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
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function nullableText(
  value:
    | string
    | null
    | undefined
): string | null {
  const text =
    cleanText(
      value
    );

  return text ||
    null;
}


function normalizeNullableNumber(
  value:
    | number
    | null
    | undefined
): number | null {
  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return null;
  }

  return parsed;
}


function normalizeInteger(
  value:
    | number
    | null
    | undefined,
  fallback = 0
): number {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return fallback;
  }

  return Math.trunc(
    parsed
  );
}


function createEmptyStats():
  MutableSeedStats {
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


function finalizeStats(
  stats:
    MutableSeedStats
): NileSeedStats {
  return {
    curriculumCount:
      stats.curriculumCount,

    subjectCount:
      stats.subjectCount,

    liberalSubjectCount:
      stats.liberalSubjectCount,

    compatibleSubjectCount:
      stats.compatibleSubjectCount,

    aliasCount:
      stats.aliasCount,

    insertedCount:
      stats.insertedCount,

    updatedCount:
      stats.updatedCount,

    deactivatedCount:
      stats.deactivatedCount,
  };
}


/* =========================================================
 * Curriculum helpers
 * ========================================================= */

async function findCurriculumId(
  params: {
    curriculumKey: string;

    standardVersion: string;
  }
): Promise<number | null> {
  const db =
    await getDb();

  if (!db) {
    throw new Error(
      "NILE curriculum 조회 중 DB 연결을 확인할 수 없습니다."
    );
  }


  const rows =
    await db
      .select({
        id:
          nileStandardCurriculums.id,
      })
      .from(
        nileStandardCurriculums
      )
      .where(
        and(
          eq(
            nileStandardCurriculums
              .curriculumKey,
            params.curriculumKey
          ),

          eq(
            nileStandardCurriculums
              .standardVersion,
            params.standardVersion
          )
        )
      )
      .limit(1);


  const id =
    Number(
      rows?.[0]?.id || 0
    );


  return id > 0
    ? id
    : null;
}


async function upsertCurriculum(
  params: {
    curriculumKey: string;

    degreeLevel:
      | "associate"
      | "bachelor";

    associateDurationYears:
      | 2
      | 3
      | null;

    degreeName: string;

    majorName: string;

    officialMajorId: string;

    requiredTotalCredits: number;

    requiredMajorCredits: number;

    requiredLiberalCredits: number;

    hasCoreRequirement: boolean;

    requiredCoreSubjectCount:
      | number
      | null;

    standardVersion: string;

    sourceUrl: string;

    sourceCheckedAt: Date;

    lastSyncedAt: Date;
  },

  stats:
    MutableSeedStats
): Promise<number> {
  const db =
    await getDb();

  if (!db) {
    throw new Error(
      "NILE curriculum seed 실행 중 DB 연결을 확인할 수 없습니다."
    );
  }


  const existingId =
    await findCurriculumId({
      curriculumKey:
        params.curriculumKey,

      standardVersion:
        params.standardVersion,
    });


  await db
    .insert(
      nileStandardCurriculums
    )
    .values({
      curriculumKey:
        params.curriculumKey,

      degreeLevel:
        params.degreeLevel,

      associateDurationYears:
        params.associateDurationYears,

      degreeName:
        params.degreeName,

      majorName:
        params.majorName,

      officialMajorId:
        params.officialMajorId,

      requiredTotalCredits:
        params.requiredTotalCredits,

      requiredMajorCredits:
        params.requiredMajorCredits,

      requiredLiberalCredits:
        params.requiredLiberalCredits,

      hasCoreRequirement:
        params.hasCoreRequirement,

      requiredCoreSubjectCount:
        params.requiredCoreSubjectCount,

      standardVersion:
        params.standardVersion,

      effectiveFrom:
        null,

      effectiveTo:
        null,

      sourceAuthority:
        "NILE",

      sourceUrl:
        params.sourceUrl,

      sourceCheckedAt:
        params.sourceCheckedAt,

      lastSyncedAt:
        params.lastSyncedAt,

      isActive:
        true,
    })
    .onDuplicateKeyUpdate({
      set: {
        degreeLevel:
          params.degreeLevel,

        associateDurationYears:
          params.associateDurationYears,

        degreeName:
          params.degreeName,

        majorName:
          params.majorName,

        officialMajorId:
          params.officialMajorId,

        requiredTotalCredits:
          params.requiredTotalCredits,

        requiredMajorCredits:
          params.requiredMajorCredits,

        requiredLiberalCredits:
          params.requiredLiberalCredits,

        hasCoreRequirement:
          params.hasCoreRequirement,

        requiredCoreSubjectCount:
          params.requiredCoreSubjectCount,

        sourceAuthority:
          "NILE",

        sourceUrl:
          params.sourceUrl,

        sourceCheckedAt:
          params.sourceCheckedAt,

        lastSyncedAt:
          params.lastSyncedAt,

        isActive:
          true,
      },
    });


  if (existingId) {
    stats.updatedCount +=
      1;
  } else {
    stats.insertedCount +=
      1;
  }


  const curriculumId =
    existingId ||
    await findCurriculumId({
      curriculumKey:
        params.curriculumKey,

      standardVersion:
        params.standardVersion,
    });


  if (
    !curriculumId ||
    curriculumId <= 0
  ) {
    throw new Error(
      `NILE curriculum ID 조회 실패: ${params.curriculumKey}`
    );
  }


  return curriculumId;
}


/* =========================================================
 * Standard subject helpers
 * ========================================================= */

async function findStandardSubjectId(
  params: {
    curriculumId: number;

    normalizedSubjectName: string;
  }
): Promise<number | null> {
  const db =
    await getDb();

  if (!db) {
    throw new Error(
      "NILE subject 조회 중 DB 연결을 확인할 수 없습니다."
    );
  }


  const rows =
    await db
      .select({
        id:
          nileStandardSubjects.id,
      })
      .from(
        nileStandardSubjects
      )
      .where(
        and(
          eq(
            nileStandardSubjects
              .curriculumId,
            params.curriculumId
          ),

          eq(
            nileStandardSubjects
              .normalizedSubjectName,
            params.normalizedSubjectName
          )
        )
      )
      .limit(1);


  const id =
    Number(
      rows?.[0]?.id || 0
    );


  return id > 0
    ? id
    : null;
}


async function upsertStandardSubject(
  params: {
    curriculumId: number;

    subjectName: string;

    officialSubjectId:
      | string
      | null;

    requirementType:
      | "전공필수"
      | "전공선택";

    credits: number;

    lectureHours: number;

    practiceHours: number;

    isCoreRequired: boolean;

    sourceUrl:
      | string
      | null;

    sourceCheckedAt: Date;

    sortOrder: number;
  },

  stats:
    MutableSeedStats
): Promise<void> {
  const db =
    await getDb();

  if (!db) {
    throw new Error(
      "NILE subject seed 실행 중 DB 연결을 확인할 수 없습니다."
    );
  }


  const normalizedSubjectName =
    normalizeNileSubjectName(
      params.subjectName
    );


  if (
    !normalizedSubjectName
  ) {
    throw new Error(
      "NILE 과목 정규화 결과가 비어 있습니다."
    );
  }


  const existingId =
    await findStandardSubjectId({
      curriculumId:
        params.curriculumId,

      normalizedSubjectName,
    });


  await db
    .insert(
      nileStandardSubjects
    )
    .values({
      curriculumId:
        params.curriculumId,

      subjectName:
        params.subjectName,

      officialSubjectId:
        params.officialSubjectId,

      normalizedSubjectName,

      requirementType:
        params.requirementType,

      credits:
        params.credits,

      lectureHours:
        params.lectureHours,

      practiceHours:
        params.practiceHours,

      isCoreRequired:
        params.isCoreRequired,

      sourceUrl:
        params.sourceUrl,

      sourceCheckedAt:
        params.sourceCheckedAt,

      sortOrder:
        params.sortOrder,

      isActive:
        true,
    })
    .onDuplicateKeyUpdate({
      set: {
        subjectName:
          params.subjectName,

        officialSubjectId:
          params.officialSubjectId,

        requirementType:
          params.requirementType,

        credits:
          params.credits,

        lectureHours:
          params.lectureHours,

        practiceHours:
          params.practiceHours,

        isCoreRequired:
          params.isCoreRequired,

        sourceUrl:
          params.sourceUrl,

        sourceCheckedAt:
          params.sourceCheckedAt,

        sortOrder:
          params.sortOrder,

        isActive:
          true,
      },
    });


  if (existingId) {
    stats.updatedCount +=
      1;
  } else {
    stats.insertedCount +=
      1;
  }
}


/* =========================================================
 * Liberal subject helpers
 * ========================================================= */

async function findLiberalSubjectId(
  params: {
    normalizedSubjectName: string;

    standardVersion: string;
  }
): Promise<number | null> {
  const db =
    await getDb();

  if (!db) {
    throw new Error(
      "NILE 교양과목 조회 중 DB 연결을 확인할 수 없습니다."
    );
  }


  const rows =
    await db
      .select({
        id:
          nileLiberalSubjects.id,
      })
      .from(
        nileLiberalSubjects
      )
      .where(
        and(
          eq(
            nileLiberalSubjects
              .normalizedSubjectName,
            params.normalizedSubjectName
          ),

          eq(
            nileLiberalSubjects
              .standardVersion,
            params.standardVersion
          )
        )
      )
      .limit(1);


  const id =
    Number(
      rows?.[0]?.id || 0
    );


  return id > 0
    ? id
    : null;
}


async function upsertLiberalSubject(
  params: {
    subjectName: string;

    officialSubjectId:
      | string
      | null;

    credits: number;

    lectureHours: number;

    practiceHours: number;

    standardVersion: string;

    sourceUrl:
      | string
      | null;

    sourceCheckedAt: Date;
  },

  stats:
    MutableSeedStats
): Promise<void> {
  const db =
    await getDb();

  if (!db) {
    throw new Error(
      "NILE 교양과목 seed 실행 중 DB 연결을 확인할 수 없습니다."
    );
  }


  const normalizedSubjectName =
    normalizeNileSubjectName(
      params.subjectName
    );


  if (
    !normalizedSubjectName
  ) {
    throw new Error(
      `NILE 교양과목 정규화 실패: ${params.subjectName}`
    );
  }


  const existingId =
    await findLiberalSubjectId({
      normalizedSubjectName,

      standardVersion:
        params.standardVersion,
    });


  await db
    .insert(
      nileLiberalSubjects
    )
    .values({
      subjectName:
        params.subjectName,

      officialSubjectId:
        params.officialSubjectId,

      normalizedSubjectName,

      credits:
        params.credits,

      lectureHours:
        params.lectureHours,

      practiceHours:
        params.practiceHours,

      standardVersion:
        params.standardVersion,

      sourceUrl:
        params.sourceUrl,

      sourceCheckedAt:
        params.sourceCheckedAt,

      isActive:
        true,
    })
    .onDuplicateKeyUpdate({
      set: {
        subjectName:
          params.subjectName,

        officialSubjectId:
          params.officialSubjectId,

        credits:
          params.credits,

        lectureHours:
          params.lectureHours,

        practiceHours:
          params.practiceHours,

        sourceUrl:
          params.sourceUrl,

        sourceCheckedAt:
          params.sourceCheckedAt,

        isActive:
          true,
      },
    });


  if (existingId) {
    stats.updatedCount +=
      1;
  } else {
    stats.insertedCount +=
      1;
  }
}


/* =========================================================
 * Compatible subject helpers
 * ========================================================= */

async function findCompatibleSubjectId(
  params: {
    curriculumId: number;

    normalizedSubjectName: string;

    standardVersion: string;
  }
): Promise<number | null> {
  const db =
    await getDb();

  if (!db) {
    throw new Error(
      "NILE 전공교양 호환과목 조회 중 DB 연결을 확인할 수 없습니다."
    );
  }


  const rows =
    await db
      .select({
        id:
          nileMajorLiberalCompatibleSubjects.id,
      })
      .from(
        nileMajorLiberalCompatibleSubjects
      )
      .where(
        and(
          eq(
            nileMajorLiberalCompatibleSubjects
              .curriculumId,
            params.curriculumId
          ),

          eq(
            nileMajorLiberalCompatibleSubjects
              .normalizedSubjectName,
            params.normalizedSubjectName
          ),

          eq(
            nileMajorLiberalCompatibleSubjects
              .standardVersion,
            params.standardVersion
          )
        )
      )
      .limit(1);


  const id =
    Number(
      rows?.[0]?.id || 0
    );


  return id > 0
    ? id
    : null;
}


async function upsertCompatibleSubject(
  params: {
    curriculumId: number;

    subjectName: string;

    officialSubjectId:
      | string
      | null;

    majorRequirementType:
      | "전공필수"
      | "전공선택";

    credits: number;

    lectureHours: number;

    practiceHours: number;

    standardVersion: string;

    sourceUrl:
      | string
      | null;

    sourceCheckedAt: Date;
  },

  stats:
    MutableSeedStats
): Promise<void> {
  const db =
    await getDb();

  if (!db) {
    throw new Error(
      "NILE 전공교양 호환 seed 실행 중 DB 연결을 확인할 수 없습니다."
    );
  }


  const normalizedSubjectName =
    normalizeNileSubjectName(
      params.subjectName
    );


  if (
    !normalizedSubjectName
  ) {
    throw new Error(
      `NILE 전공교양 호환과목 정규화 실패: ${params.subjectName}`
    );
  }


  const existingId =
    await findCompatibleSubjectId({
      curriculumId:
        params.curriculumId,

      normalizedSubjectName,

      standardVersion:
        params.standardVersion,
    });


  await db
    .insert(
      nileMajorLiberalCompatibleSubjects
    )
    .values({
      curriculumId:
        params.curriculumId,

      subjectName:
        params.subjectName,

      officialSubjectId:
        params.officialSubjectId,

      normalizedSubjectName,

      majorRequirementType:
        params.majorRequirementType,

      credits:
        params.credits,

      lectureHours:
        params.lectureHours,

      practiceHours:
        params.practiceHours,

      standardVersion:
        params.standardVersion,

      sourceUrl:
        params.sourceUrl,

      sourceCheckedAt:
        params.sourceCheckedAt,

      isActive:
        true,
    })
    .onDuplicateKeyUpdate({
      set: {
        subjectName:
          params.subjectName,

        officialSubjectId:
          params.officialSubjectId,

        majorRequirementType:
          params.majorRequirementType,

        credits:
          params.credits,

        lectureHours:
          params.lectureHours,

        practiceHours:
          params.practiceHours,

        sourceUrl:
          params.sourceUrl,

        sourceCheckedAt:
          params.sourceCheckedAt,

        isActive:
          true,
      },
    });


  if (existingId) {
    stats.updatedCount +=
      1;
  } else {
    stats.insertedCount +=
      1;
  }
}


/* =========================================================
 * Alias helpers
 * ========================================================= */

async function findAliasId(
  params: {
    curriculumId:
      | number
      | null;

    normalizedAliasSubjectName: string;

    aliasType:
      | "official_equivalent"
      | "legacy_name"
      | "normalization"
      | "manual_verified";
  }
): Promise<number | null> {
  const db =
    await getDb();

  if (!db) {
    throw new Error(
      "NILE alias 조회 중 DB 연결을 확인할 수 없습니다."
    );
  }


  const rows =
    await db
      .select({
        id:
          nileSubjectAliases.id,

        curriculumId:
          nileSubjectAliases.curriculumId,

        aliasType:
          nileSubjectAliases.aliasType,
      })
      .from(
        nileSubjectAliases
      )
      .where(
        eq(
          nileSubjectAliases
            .normalizedAliasSubjectName,
          params.normalizedAliasSubjectName
        )
      );


  const found =
    rows.find(
      (row) => {
        const rowCurriculumId =
          row.curriculumId ===
            null ||
          row.curriculumId ===
            undefined
            ? null
            : Number(
                row.curriculumId
              );

        return (
          rowCurriculumId ===
            params.curriculumId &&
          row.aliasType ===
            params.aliasType
        );
      }
    );


  const id =
    Number(
      found?.id || 0
    );


  return id > 0
    ? id
    : null;
}


async function upsertAlias(
  params: {
    curriculumId:
      | number
      | null;

    canonicalSubjectName: string;

    canonicalOfficialSubjectId:
      | string
      | null;

    aliasSubjectName: string;

    normalizedAliasSubjectName: string;

    aliasType:
      | "official_equivalent"
      | "legacy_name"
      | "normalization"
      | "manual_verified";

    standardVersion:
      | string
      | null;

    sourceUrl:
      | string
      | null;

    verifiedAt:
      | Date
      | null;
  },

  stats:
    MutableSeedStats
): Promise<void> {
  const db =
    await getDb();

  if (!db) {
    throw new Error(
      "NILE alias seed 실행 중 DB 연결을 확인할 수 없습니다."
    );
  }


  const existingId =
    await findAliasId({
      curriculumId:
        params.curriculumId,

      normalizedAliasSubjectName:
        params.normalizedAliasSubjectName,

      aliasType:
        params.aliasType,
    });


  if (existingId) {
    await db
      .update(
        nileSubjectAliases
      )
      .set({
        curriculumId:
          params.curriculumId,

        canonicalSubjectName:
          params.canonicalSubjectName,

        canonicalOfficialSubjectId:
          params.canonicalOfficialSubjectId,

        aliasSubjectName:
          params.aliasSubjectName,

        normalizedAliasSubjectName:
          params.normalizedAliasSubjectName,

        aliasType:
          params.aliasType,

        standardVersion:
          params.standardVersion,

        sourceUrl:
          params.sourceUrl,

        verifiedAt:
          params.verifiedAt,

        isActive:
          true,
      })
      .where(
        eq(
          nileSubjectAliases.id,
          existingId
        )
      );


    stats.updatedCount +=
      1;

    return;
  }


  await db
    .insert(
      nileSubjectAliases
    )
    .values({
      curriculumId:
        params.curriculumId,

      canonicalSubjectName:
        params.canonicalSubjectName,

      canonicalOfficialSubjectId:
        params.canonicalOfficialSubjectId,

      aliasSubjectName:
        params.aliasSubjectName,

      normalizedAliasSubjectName:
        params.normalizedAliasSubjectName,

      aliasType:
        params.aliasType,

      standardVersion:
        params.standardVersion,

      sourceUrl:
        params.sourceUrl,

      verifiedAt:
        params.verifiedAt,

      isActive:
        true,
    });


  stats.insertedCount +=
    1;
}


/* =========================================================
 * Deactivation - standard subjects
 * ========================================================= */

async function deactivateMissingStandardSubjects(
  params: {
    curriculumId: number;

    activeNormalizedNames:
      Set<string>;
  },

  stats:
    MutableSeedStats
): Promise<void> {
  const db =
    await getDb();

  if (!db) {
    throw new Error(
      "NILE 과목 비활성화 중 DB 연결을 확인할 수 없습니다."
    );
  }


  const rows =
    await db
      .select({
        id:
          nileStandardSubjects.id,

        normalizedSubjectName:
          nileStandardSubjects
            .normalizedSubjectName,

        isActive:
          nileStandardSubjects
            .isActive,
      })
      .from(
        nileStandardSubjects
      )
      .where(
        eq(
          nileStandardSubjects
            .curriculumId,
          params.curriculumId
        )
      );


  for (
    const row
    of rows
  ) {
    if (
      row.isActive !==
      true
    ) {
      continue;
    }


    if (
      params
        .activeNormalizedNames
        .has(
          row
            .normalizedSubjectName
        )
    ) {
      continue;
    }


    await db
      .update(
        nileStandardSubjects
      )
      .set({
        isActive:
          false,
      })
      .where(
        eq(
          nileStandardSubjects.id,
          row.id
        )
      );


    stats.deactivatedCount +=
      1;
  }
}


/* =========================================================
 * Deactivation - liberal
 * ========================================================= */

async function deactivateMissingLiberalSubjects(
  params: {
    standardVersion: string;

    activeNormalizedNames:
      Set<string>;
  },

  stats:
    MutableSeedStats
): Promise<void> {
  const db =
    await getDb();

  if (!db) {
    throw new Error(
      "NILE 교양 비활성화 중 DB 연결을 확인할 수 없습니다."
    );
  }


  const rows =
    await db
      .select({
        id:
          nileLiberalSubjects.id,

        normalizedSubjectName:
          nileLiberalSubjects
            .normalizedSubjectName,

        isActive:
          nileLiberalSubjects
            .isActive,
      })
      .from(
        nileLiberalSubjects
      )
      .where(
        eq(
          nileLiberalSubjects
            .standardVersion,
          params.standardVersion
        )
      );


  for (
    const row
    of rows
  ) {
    if (
      row.isActive !==
      true
    ) {
      continue;
    }


    if (
      params
        .activeNormalizedNames
        .has(
          row
            .normalizedSubjectName
        )
    ) {
      continue;
    }


    await db
      .update(
        nileLiberalSubjects
      )
      .set({
        isActive:
          false,
      })
      .where(
        eq(
          nileLiberalSubjects.id,
          row.id
        )
      );


    stats.deactivatedCount +=
      1;
  }
}


/* =========================================================
 * Deactivation - compatible
 * ========================================================= */

async function deactivateMissingCompatibleSubjects(
  params: {
    curriculumId: number;

    standardVersion: string;

    activeNormalizedNames:
      Set<string>;
  },

  stats:
    MutableSeedStats
): Promise<void> {
  const db =
    await getDb();

  if (!db) {
    throw new Error(
      "NILE 호환과목 비활성화 중 DB 연결을 확인할 수 없습니다."
    );
  }


  const rows =
    await db
      .select({
        id:
          nileMajorLiberalCompatibleSubjects.id,

        normalizedSubjectName:
          nileMajorLiberalCompatibleSubjects
            .normalizedSubjectName,

        isActive:
          nileMajorLiberalCompatibleSubjects
            .isActive,
      })
      .from(
        nileMajorLiberalCompatibleSubjects
      )
      .where(
        and(
          eq(
            nileMajorLiberalCompatibleSubjects
              .curriculumId,
            params.curriculumId
          ),

          eq(
            nileMajorLiberalCompatibleSubjects
              .standardVersion,
            params.standardVersion
          )
        )
      );


  for (
    const row
    of rows
  ) {
    if (
      row.isActive !==
      true
    ) {
      continue;
    }


    if (
      params
        .activeNormalizedNames
        .has(
          row
            .normalizedSubjectName
        )
    ) {
      continue;
    }


    await db
      .update(
        nileMajorLiberalCompatibleSubjects
      )
      .set({
        isActive:
          false,
      })
      .where(
        eq(
          nileMajorLiberalCompatibleSubjects.id,
          row.id
        )
      );


    stats.deactivatedCount +=
      1;
  }
}


/* =========================================================
 * Deactivation - aliases
 * ========================================================= */

async function deactivateMissingAliases(
  params: {
    standardVersion: string;

    activeKeys:
      Set<string>;
  },

  stats:
    MutableSeedStats
): Promise<void> {
  const db =
    await getDb();

  if (!db) {
    throw new Error(
      "NILE alias 비활성화 중 DB 연결을 확인할 수 없습니다."
    );
  }


  const rows =
    await db
      .select({
        id:
          nileSubjectAliases.id,

        curriculumId:
          nileSubjectAliases.curriculumId,

        normalizedAliasSubjectName:
          nileSubjectAliases
            .normalizedAliasSubjectName,

        aliasType:
          nileSubjectAliases.aliasType,

        standardVersion:
          nileSubjectAliases.standardVersion,

        isActive:
          nileSubjectAliases.isActive,
      })
      .from(
        nileSubjectAliases
      );


  for (
    const row
    of rows
  ) {
    if (
      row.isActive !==
      true
    ) {
      continue;
    }


    /**
     * 관리자가 직접 검증한 alias는
     * 자동 수집 결과에 없다고 지우면 안 된다.
     */
    if (
      row.aliasType ===
      "manual_verified"
    ) {
      continue;
    }


    if (
      cleanText(
        row.standardVersion
      ) !==
      params.standardVersion
    ) {
      continue;
    }


    const curriculumId =
      row.curriculumId ===
        null ||
      row.curriculumId ===
        undefined
        ? null
        : Number(
            row.curriculumId
          );


    const key =
      [
        curriculumId ===
          null
          ? "global"
          : String(
              curriculumId
            ),

        row.aliasType,

        row.normalizedAliasSubjectName,
      ].join(":");


    if (
      params
        .activeKeys
        .has(key)
    ) {
      continue;
    }


    await db
      .update(
        nileSubjectAliases
      )
      .set({
        isActive:
          false,
      })
      .where(
        eq(
          nileSubjectAliases.id,
          row.id
        )
      );


    stats.deactivatedCount +=
      1;
  }
}


/* =========================================================
 * Deactivation - curriculums
 * ========================================================= */

async function deactivateMissingCurriculums(
  params: {
    standardVersion: string;

    activeCurriculumKeys:
      Set<string>;
  },

  stats:
    MutableSeedStats
): Promise<void> {
  const db =
    await getDb();

  if (!db) {
    throw new Error(
      "NILE curriculum 비활성화 중 DB 연결을 확인할 수 없습니다."
    );
  }


  const rows =
    await db
      .select({
        id:
          nileStandardCurriculums.id,

        curriculumKey:
          nileStandardCurriculums
            .curriculumKey,

        isActive:
          nileStandardCurriculums
            .isActive,
      })
      .from(
        nileStandardCurriculums
      )
      .where(
        eq(
          nileStandardCurriculums
            .standardVersion,
          params.standardVersion
        )
      );


  for (
    const row
    of rows
  ) {
    if (
      row.isActive !==
      true
    ) {
      continue;
    }


    if (
      params
        .activeCurriculumKeys
        .has(
          row.curriculumKey
        )
    ) {
      continue;
    }


    await db
      .update(
        nileStandardCurriculums
      )
      .set({
        isActive:
          false,

        lastSyncedAt:
          new Date(),
      })
      .where(
        eq(
          nileStandardCurriculums.id,
          row.id
        )
      );


    /**
     * 전공 자체가 공식 목록에서 사라졌다면
     * 해당 전공의 과목도 모두 비활성화.
     */
    const subjectRows =
      await db
        .select({
          id:
            nileStandardSubjects.id,

          isActive:
            nileStandardSubjects.isActive,
        })
        .from(
          nileStandardSubjects
        )
        .where(
          eq(
            nileStandardSubjects
              .curriculumId,
            row.id
          )
        );


    for (
      const subjectRow
      of subjectRows
    ) {
      if (
        subjectRow.isActive !==
        true
      ) {
        continue;
      }


      await db
        .update(
          nileStandardSubjects
        )
        .set({
          isActive:
            false,
        })
        .where(
          eq(
            nileStandardSubjects.id,
            subjectRow.id
          )
        );


      stats.deactivatedCount +=
        1;
    }


    stats.deactivatedCount +=
      1;
  }
}


/* =========================================================
 * Curriculum seed
 * ========================================================= */

async function seedCurriculums(
  dataset:
    NileCollectedDataset,

  stats:
    MutableSeedStats
): Promise<{
  curriculumIdMap:
    CurriculumIdMap;

  seededCurriculums:
    NileStandardDatasetSeedResult[
      "curriculums"
    ];
}> {
  const curriculumIdMap:
    CurriculumIdMap =
    new Map();


  const seededCurriculums:
    NileStandardDatasetSeedResult[
      "curriculums"
    ] =
    [];


  const syncedAt =
    new Date();


  for (
    const curriculum
    of dataset.curriculums
  ) {
    const curriculumKey =
      cleanText(
        curriculum
          .curriculumKey
      );


    const curriculumId =
      await upsertCurriculum(
        {
          curriculumKey,

          degreeLevel:
            curriculum
              .degreeLevel,

          associateDurationYears:
            curriculum
              .degreeLevel ===
            "associate"
              ? (
                  curriculum
                    .associateDurationYears ||
                  2
                )
              : null,

          degreeName:
            cleanText(
              curriculum
                .degreeName
            ),

          majorName:
            cleanText(
              curriculum
                .majorName
            ),

          officialMajorId:
            cleanText(
              curriculum
                .officialMajorId
            ),

          requiredTotalCredits:
            normalizeInteger(
              curriculum
                .requiredTotalCredits
            ),

          requiredMajorCredits:
            normalizeInteger(
              curriculum
                .requiredMajorCredits
            ),

          requiredLiberalCredits:
            normalizeInteger(
              curriculum
                .requiredLiberalCredits
            ),

          hasCoreRequirement:
            curriculum
              .hasCoreRequirement ===
            true,

          requiredCoreSubjectCount:
            normalizeNullableNumber(
              curriculum
                .requiredCoreSubjectCount
            ),

          standardVersion:
            cleanText(
              curriculum
                .standardVersion
            ),

          sourceUrl:
            cleanText(
              curriculum
                .sourceUrl
            ),

          sourceCheckedAt:
            curriculum
              .sourceCheckedAt,

          lastSyncedAt:
            syncedAt,
        },

        stats
      );


    curriculumIdMap.set(
      curriculumKey,
      curriculumId
    );


    const activeSubjectNames =
      new Set<string>();


    for (
      const subject
      of curriculum.subjects
    ) {
      const subjectName =
        cleanText(
          subject
            .subjectName
        );


      const normalized =
        normalizeNileSubjectName(
          subjectName
        );


      activeSubjectNames.add(
        normalized
      );


      await upsertStandardSubject(
        {
          curriculumId,

          subjectName,

          officialSubjectId:
            nullableText(
              subject
                .officialSubjectId
            ),

          requirementType:
            subject
              .requirementType,

          credits:
            normalizeInteger(
              subject.credits
            ),

          lectureHours:
            normalizeInteger(
              subject
                .lectureHours
            ),

          practiceHours:
            normalizeInteger(
              subject
                .practiceHours
            ),

          isCoreRequired:
            subject
              .isCoreRequired ===
            true,

          sourceUrl:
            nullableText(
              subject.sourceUrl
            ) ||
            nullableText(
              curriculum.sourceUrl
            ),

          sourceCheckedAt:
            curriculum
              .sourceCheckedAt,

          sortOrder:
            normalizeInteger(
              subject
                .sortOrder
            ),
        },

        stats
      );


      stats.subjectCount +=
        1;
    }


    /**
     * 현재 전공의 공식 페이지에서
     * 사라진 과목은 비활성화.
     *
     * 부분 sync에서도 해당 전공 자체는
     * 완전한 상세페이지를 가져왔기 때문에 적용 가능.
     */
    await deactivateMissingStandardSubjects(
      {
        curriculumId,

        activeNormalizedNames:
          activeSubjectNames,
      },

      stats
    );


    stats.curriculumCount +=
      1;


    seededCurriculums.push({
      curriculumKey,

      curriculumId,

      subjectCount:
        curriculum
          .subjects
          .length,
    });


    console.log(
      "[NILE SEED] curriculum done",
      {
        curriculumKey,

        curriculumId,

        subjectCount:
          curriculum
            .subjects
            .length,
      }
    );
  }


  return {
    curriculumIdMap,
    seededCurriculums,
  };
}


/* =========================================================
 * Liberal seed
 * ========================================================= */

async function seedLiberalSubjects(
  dataset:
    NileCollectedDataset,

  stats:
    MutableSeedStats,

  fullSync: boolean
): Promise<void> {
  const activeNames =
    new Set<string>();


  for (
    const subject
    of dataset
      .liberalSubjects
  ) {
    const subjectName =
      cleanText(
        subject.subjectName
      );


    const normalized =
      normalizeNileSubjectName(
        subjectName
      );


    activeNames.add(
      normalized
    );


    await upsertLiberalSubject(
      {
        subjectName,

        officialSubjectId:
          nullableText(
            subject
              .officialSubjectId
          ),

        credits:
          normalizeInteger(
            subject.credits
          ),

        lectureHours:
          normalizeInteger(
            subject
              .lectureHours
          ),

        practiceHours:
          normalizeInteger(
            subject
              .practiceHours
          ),

        standardVersion:
          cleanText(
            subject
              .standardVersion
          ),

        sourceUrl:
          nullableText(
            subject.sourceUrl
          ),

        sourceCheckedAt:
          subject
            .sourceCheckedAt,
      },

      stats
    );


    stats.liberalSubjectCount +=
      1;
  }


  /**
   * 전체 동기화에서만
   * 교양 전체 목록의 삭제/비활성화를 판단한다.
   */
  if (
    fullSync &&
    dataset
      .liberalSubjects
      .length >
    0
  ) {
    await deactivateMissingLiberalSubjects(
      {
        standardVersion:
          dataset.standardVersion,

        activeNormalizedNames:
          activeNames,
      },

      stats
    );
  }
}


/* =========================================================
 * Compatible seed
 * ========================================================= */

async function seedCompatibleSubjects(
  dataset:
    NileCollectedDataset,

  curriculumIdMap:
    CurriculumIdMap,

  stats:
    MutableSeedStats,

  fullSync: boolean
): Promise<void> {
  const groupedActiveNames =
    new Map<
      number,
      Set<string>
    >();


  for (
    const subject
    of dataset
      .majorLiberalCompatibleSubjects
  ) {
    const curriculumId =
      curriculumIdMap.get(
        subject.curriculumKey
      );


    if (
      !curriculumId
    ) {
      throw new Error(
        `NILE 호환과목 curriculumId 없음: ${subject.curriculumKey} / ${subject.subjectName}`
      );
    }


    const subjectName =
      cleanText(
        subject.subjectName
      );


    const normalized =
      normalizeNileSubjectName(
        subjectName
      );


    let activeNames =
      groupedActiveNames.get(
        curriculumId
      );


    if (!activeNames) {
      activeNames =
        new Set<string>();

      groupedActiveNames.set(
        curriculumId,
        activeNames
      );
    }


    activeNames.add(
      normalized
    );


    await upsertCompatibleSubject(
      {
        curriculumId,

        subjectName,

        officialSubjectId:
          nullableText(
            subject
              .officialSubjectId
          ),

        majorRequirementType:
          subject
            .majorRequirementType,

        credits:
          normalizeInteger(
            subject.credits
          ),

        lectureHours:
          normalizeInteger(
            subject
              .lectureHours
          ),

        practiceHours:
          normalizeInteger(
            subject
              .practiceHours
          ),

        standardVersion:
          cleanText(
            subject
              .standardVersion
          ),

        sourceUrl:
          nullableText(
            subject.sourceUrl
          ),

        sourceCheckedAt:
          subject
            .sourceCheckedAt,
      },

      stats
    );


    stats.compatibleSubjectCount +=
      1;
  }


  if (!fullSync) {
    return;
  }


  /**
   * 전체 sync에서는 현재 수집된 모든 curriculum에 대해
   * 기존 호환과목 중 사라진 항목을 비활성화한다.
   */
  for (
    const [
      curriculumKey,
      curriculumId,
    ]
    of curriculumIdMap.entries()
  ) {
    const activeNames =
      groupedActiveNames.get(
        curriculumId
      ) ||
      new Set<string>();


    await deactivateMissingCompatibleSubjects(
      {
        curriculumId,

        standardVersion:
          dataset.standardVersion,

        activeNormalizedNames:
          activeNames,
      },

      stats
    );


    void curriculumKey;
  }
}


/* =========================================================
 * Alias seed
 * ========================================================= */

async function seedAliases(
  dataset:
    NileCollectedDataset,

  curriculumIdMap:
    CurriculumIdMap,

  stats:
    MutableSeedStats,

  fullSync: boolean
): Promise<void> {
  const activeAliasKeys =
    new Set<string>();


  for (
    const alias
    of dataset.subjectAliases
  ) {
    const curriculumId =
      alias.curriculumKey
        ? (
            curriculumIdMap.get(
              alias.curriculumKey
            ) ||
            null
          )
        : null;


    if (
      alias.curriculumKey &&
      !curriculumId
    ) {
      throw new Error(
        `NILE alias curriculumId 없음: ${alias.curriculumKey} / ${alias.aliasSubjectName}`
      );
    }


    const aliasSubjectName =
      cleanText(
        alias.aliasSubjectName
      );


    const normalizedAliasSubjectName =
      normalizeNileSubjectName(
        aliasSubjectName
      );


    const effectiveNormalizedAlias =
      normalizedAliasSubjectName ||
      cleanText(
        alias
          .normalizedAliasSubjectName
      );


    if (
      !effectiveNormalizedAlias
    ) {
      throw new Error(
        `NILE alias 정규화 실패: ${alias.aliasSubjectName}`
      );
    }


    const aliasKey =
      [
        curriculumId ===
          null
          ? "global"
          : String(
              curriculumId
            ),

        alias.aliasType,

        effectiveNormalizedAlias,
      ].join(":");


    activeAliasKeys.add(
      aliasKey
    );


    await upsertAlias(
      {
        curriculumId,

        canonicalSubjectName:
          cleanText(
            alias
              .canonicalSubjectName
          ),

        canonicalOfficialSubjectId:
          nullableText(
            alias
              .canonicalOfficialSubjectId
          ),

        aliasSubjectName,

        normalizedAliasSubjectName:
          effectiveNormalizedAlias,

        aliasType:
          alias.aliasType,

        standardVersion:
          nullableText(
            alias.standardVersion
          ),

        sourceUrl:
          nullableText(
            alias.sourceUrl
          ),

        verifiedAt:
          alias.verifiedAt,
      },

      stats
    );


    stats.aliasCount +=
      1;
  }


  /**
 * alias 자동수집기는 아직 공식 데이터와 연결하지 않았다.
 *
 * 따라서 Collector가 alias를 0건 반환했다고 해서
 * 기존 공식 alias를 전부 비활성화하면 안 된다.
 *
 * 추후 공식 alias collector가 연결되고
 * dataset.subjectAliases가 실제 전체 목록을 담게 되면
 * 정상적으로 누락 alias를 비활성화한다.
 */
if (
  fullSync &&
  dataset.subjectAliases.length > 0
) {
  await deactivateMissingAliases(
    {
      standardVersion:
        dataset.standardVersion,

      activeKeys:
        activeAliasKeys,
    },

    stats
  );
}
}


/* =========================================================
 * Full dataset seed
 * ========================================================= */

/**
 * Collector가 만든 전체 NILE dataset을
 * DB Master에 반영한다.
 *
 * 실행 순서:
 *
 * 1. Validator
 * 2. Curriculum
 * 3. Standard Subjects
 * 4. Liberal Subjects
 * 5. Major/Liberal Compatible
 * 6. Aliases
 * 7. Missing rows deactivate
 */
export async function seedNileStandardDataset(
  dataset:
    NileCollectedDataset,

  options:
    NileStandardDatasetSeedOptions = {}
): Promise<NileStandardDatasetSeedResult> {
  const db =
    await getDb();


  if (!db) {
    throw new Error(
      "NILE 전체 Dataset Seed를 실행할 DB가 없습니다."
    );
  }


  const fullSync =
    options.fullSync !==
    false;


  /**
   * 가장 중요:
   *
   * DB를 건드리기 전에 전체 dataset 검증부터 한다.
   */
  assertValidNileStandardDataset(
    dataset,
    {
      fullSync,
    }
  );


  const stats =
    createEmptyStats();


  console.log(
    "[NILE SEED] dataset start",
    {
      fullSync,

      standardVersion:
        dataset.standardVersion,

      curriculumCount:
        dataset.curriculums.length,

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
    }
  );


  /* -------------------------------------------------------
   * Curriculum + subjects
   * ------------------------------------------------------- */

  const {
    curriculumIdMap,
    seededCurriculums,
  } =
    await seedCurriculums(
      dataset,
      stats
    );


  /* -------------------------------------------------------
   * Liberal
   * ------------------------------------------------------- */

  await seedLiberalSubjects(
    dataset,
    stats,
    fullSync
  );


  /* -------------------------------------------------------
   * Major/Liberal Compatible
   * ------------------------------------------------------- */

  await seedCompatibleSubjects(
    dataset,
    curriculumIdMap,
    stats,
    fullSync
  );


  /* -------------------------------------------------------
   * Alias
   * ------------------------------------------------------- */

  await seedAliases(
    dataset,
    curriculumIdMap,
    stats,
    fullSync
  );


  /* -------------------------------------------------------
   * Missing curriculum deactivate
   * ------------------------------------------------------- */

  if (fullSync) {
    const activeCurriculumKeys =
      new Set(
        dataset
          .curriculums
          .map(
            (
              curriculum
            ) =>
              curriculum
                .curriculumKey
          )
      );


    await deactivateMissingCurriculums(
      {
        standardVersion:
          dataset.standardVersion,

        activeCurriculumKeys,
      },

      stats
    );
  }


  const result:
    NileStandardDatasetSeedResult = {
    success:
      true,

    stats:
      finalizeStats(
        stats
      ),

    curriculums:
      seededCurriculums,
  };


  console.log(
    "[NILE SEED] dataset complete",
    result
  );


  return result;
}


/* =========================================================
 * Compatibility export
 * ========================================================= */

/**
 * 기존 run-nile-standard-seed.ts가 import하던 함수명은
 * 당장 TypeScript import 오류가 나지 않도록 남겨둔다.
 *
 * 단, 이제 실제 데이터는 Collector가 만든
 * NileCollectedDataset을 반드시 전달해야 한다.
 *
 * 다음 단계에서 기존 runner를
 * run-nile-standard-sync.ts로 교체할 예정이다.
 */
export async function seedNileStandardCurriculums(
  dataset?:
    NileCollectedDataset
): Promise<NileStandardDatasetSeedResult> {
  if (!dataset) {
    throw new Error(
      [
        "기존 수동 NILE Seed 방식은 종료되었습니다.",
        "collectNileStandardDataset()으로 전체 공식 데이터를 수집한 뒤",
        "seedNileStandardDataset(dataset)을 사용해야 합니다.",
      ].join(" ")
    );
  }


  return seedNileStandardDataset(
    dataset,
    {
      fullSync:
        true,
    }
  );
}