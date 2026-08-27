// server/nile/validators/nile-standard-validator.ts

import {
  buildNileCurriculumKey,
  normalizeNileSubjectName,

  type NileCollectedDataset,
  type NileCollectedLiberalSubject,
  type NileCollectedMajorLiberalCompatibleSubject,
  type NileCollectedSubjectAlias,
  type NileParsedCurriculum,
  type NileValidationIssue,
  type NileValidationResult,
} from "../nile-standard-types";


/* =========================================================
 * Constants
 * ========================================================= */

/**
 * 자동 수집 결과가 지나치게 적을 경우
 * 잘못된 HTML / 차단 페이지 / 사이트 개편일 가능성이 있으므로
 * DB 전체 갱신을 차단하기 위한 최소 안전선.
 *
 * 정확한 공식 전공 수를 하드코딩하지 않는다.
 */
const MIN_FULL_CURRICULUM_COUNT =
  20;

const MIN_FULL_SUBJECT_COUNT =
  200;

const MIN_FULL_LIBERAL_COUNT =
  10;


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


function isPositiveInteger(
  value: unknown
): boolean {
  return (
    Number.isInteger(value) &&
    Number(value) > 0
  );
}


function isNonNegativeInteger(
  value: unknown
): boolean {
  return (
    Number.isInteger(value) &&
    Number(value) >= 0
  );
}


function pushIssue(
  issues: NileValidationIssue[],
  params: {
    level:
      | "error"
      | "warning";

    code: string;

    message: string;

    curriculumKey?: string | null;

    subjectName?: string | null;
  }
): void {
  issues.push({
    level:
      params.level,

    code:
      params.code,

    message:
      params.message,

    curriculumKey:
      params.curriculumKey ||
      null,

    subjectName:
      params.subjectName ||
      null,
  });
}


/* =========================================================
 * Degree requirement validation
 * ========================================================= */

function validateDegreeRequirements(
  curriculum:
    NileParsedCurriculum,
  issues:
    NileValidationIssue[]
): void {
  const key =
    curriculum.curriculumKey;

  if (
    curriculum.degreeLevel ===
    "bachelor"
  ) {
    if (
      curriculum
        .associateDurationYears !==
      null
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "BACHELOR_HAS_ASSOCIATE_DURATION",

          message:
            `학사 과정인데 associateDurationYears=${curriculum.associateDurationYears}가 설정되어 있습니다.`,

          curriculumKey:
            key,
        }
      );
    }

    if (
      curriculum
        .requiredTotalCredits !==
        140 ||
      curriculum
        .requiredMajorCredits !==
        60 ||
      curriculum
        .requiredLiberalCredits !==
        30
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "INVALID_BACHELOR_CREDIT_REQUIREMENT",

          message:
            [
              "학사 학위요건이 140/60/30과 다릅니다.",
              `total=${curriculum.requiredTotalCredits}`,
              `major=${curriculum.requiredMajorCredits}`,
              `liberal=${curriculum.requiredLiberalCredits}`,
            ].join(" / "),

          curriculumKey:
            key,
        }
      );
    }

    return;
  }


  /* -------------------------------------------------------
   * Associate
   * ------------------------------------------------------- */

  if (
    curriculum
      .associateDurationYears !==
      2 &&
    curriculum
      .associateDurationYears !==
      3
  ) {
    pushIssue(
      issues,
      {
        level:
          "error",

        code:
          "INVALID_ASSOCIATE_DURATION",

        message:
          `전문학사 과정의 수업연한이 2 또는 3이 아닙니다. value=${curriculum.associateDurationYears}`,

        curriculumKey:
          key,
      }
    );

    return;
  }


  if (
    curriculum
      .associateDurationYears ===
    2
  ) {
    if (
      curriculum
        .requiredTotalCredits !==
        80 ||
      curriculum
        .requiredMajorCredits !==
        45 ||
      curriculum
        .requiredLiberalCredits !==
        15
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "INVALID_ASSOCIATE_2Y_CREDIT_REQUIREMENT",

          message:
            [
              "2년제 전문학사 학위요건이 80/45/15와 다릅니다.",
              `total=${curriculum.requiredTotalCredits}`,
              `major=${curriculum.requiredMajorCredits}`,
              `liberal=${curriculum.requiredLiberalCredits}`,
            ].join(" / "),

          curriculumKey:
            key,
        }
      );
    }

    return;
  }


  if (
    curriculum
      .associateDurationYears ===
    3
  ) {
    if (
      curriculum
        .requiredTotalCredits !==
        120 ||
      curriculum
        .requiredMajorCredits !==
        54 ||
      curriculum
        .requiredLiberalCredits !==
        21
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "INVALID_ASSOCIATE_3Y_CREDIT_REQUIREMENT",

          message:
            [
              "3년제 전문학사 학위요건이 120/54/21과 다릅니다.",
              `total=${curriculum.requiredTotalCredits}`,
              `major=${curriculum.requiredMajorCredits}`,
              `liberal=${curriculum.requiredLiberalCredits}`,
            ].join(" / "),

          curriculumKey:
            key,
        }
      );
    }
  }
}


/* =========================================================
 * Core requirement validation
 * ========================================================= */

function validateCoreRequirement(
  curriculum:
    NileParsedCurriculum,
  issues:
    NileValidationIssue[]
): void {
  const key =
    curriculum.curriculumKey;

  const requiredSubjects =
    curriculum.subjects.filter(
      (subject) =>
        subject
          .requirementType ===
        "전공필수"
    );

  const coreSubjects =
    requiredSubjects.filter(
      (subject) =>
        subject.isCoreRequired
    );


  if (
    !curriculum
      .hasCoreRequirement
  ) {
    if (
      curriculum
        .requiredCoreSubjectCount !==
      null
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "CORE_COUNT_WITHOUT_CORE_POLICY",

          message:
            `핵심제가 아닌데 requiredCoreSubjectCount=${curriculum.requiredCoreSubjectCount}가 있습니다.`,

          curriculumKey:
            key,
        }
      );
    }

    if (
      coreSubjects.length > 0
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "CORE_SUBJECT_WITHOUT_CORE_POLICY",

          message:
            `핵심제가 아닌 전공에 isCoreRequired 과목 ${coreSubjects.length}개가 존재합니다.`,

          curriculumKey:
            key,
        }
      );
    }

    return;
  }


  if (
    !isPositiveInteger(
      curriculum
        .requiredCoreSubjectCount
    )
  ) {
    pushIssue(
      issues,
      {
        level:
          "error",

        code:
          "INVALID_CORE_REQUIRED_COUNT",

        message:
          `핵심제 전공인데 requiredCoreSubjectCount가 유효하지 않습니다. value=${curriculum.requiredCoreSubjectCount}`,

        curriculumKey:
          key,
      }
    );

    return;
  }


  if (
    requiredSubjects.length ===
    0
  ) {
    pushIssue(
      issues,
      {
        level:
          "error",

        code:
          "CORE_POLICY_WITHOUT_REQUIRED_SUBJECTS",

        message:
          "핵심제가 적용됐지만 전공필수 과목이 없습니다.",

        curriculumKey:
          key,
      }
    );

    return;
  }


  if (
    Number(
      curriculum
        .requiredCoreSubjectCount
    ) >
    requiredSubjects.length
  ) {
    pushIssue(
      issues,
      {
        level:
          "error",

        code:
          "CORE_COUNT_EXCEEDS_REQUIRED_SUBJECTS",

        message:
          [
            "핵심제 최소 이수과목 수가 전공필수 전체 과목 수보다 큽니다.",
            `requiredCoreSubjectCount=${curriculum.requiredCoreSubjectCount}`,
            `requiredSubjects=${requiredSubjects.length}`,
          ].join(" / "),

        curriculumKey:
          key,
      }
    );
  }


  if (
    coreSubjects.length ===
    0
  ) {
    pushIssue(
      issues,
      {
        level:
          "warning",

        code:
          "CORE_SUBJECT_FLAG_MISSING",

        message:
          "핵심제 전공인데 isCoreRequired=true 과목이 없습니다.",

        curriculumKey:
          key,
      }
    );
  }
}


/* =========================================================
 * Curriculum subject validation
 * ========================================================= */

function validateCurriculumSubjects(
  curriculum:
    NileParsedCurriculum,
  issues:
    NileValidationIssue[]
): void {
  const key =
    curriculum.curriculumKey;

  if (
    curriculum.subjects.length ===
    0
  ) {
    pushIssue(
      issues,
      {
        level:
          "error",

        code:
          "EMPTY_CURRICULUM_SUBJECTS",

        message:
          "전공 과목목록이 비어 있습니다.",

        curriculumKey:
          key,
      }
    );

    return;
  }


  const sortOrders =
  new Set<number>();


  for (
    const subject
    of curriculum.subjects
  ) {
    const name =
      cleanText(
        subject.subjectName
      );

    const normalized =
      normalizeNileSubjectName(
        name
      );


    if (!name) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "EMPTY_SUBJECT_NAME",

          message:
            "과목명이 비어 있습니다.",

          curriculumKey:
            key,
        }
      );

      continue;
    }


    if (!normalized) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "EMPTY_NORMALIZED_SUBJECT_NAME",

          message:
            "정규화된 과목명이 비어 있습니다.",

          curriculumKey:
            key,

          subjectName:
            name,
        }
      );
    }

    if (
      subject
        .requirementType !==
        "전공필수" &&
      subject
        .requirementType !==
        "전공선택"
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "INVALID_REQUIREMENT_TYPE",

          message:
            `학습구분이 유효하지 않습니다: ${String(subject.requirementType)}`,

          curriculumKey:
            key,

          subjectName:
            name,
        }
      );
    }


    if (
      !isPositiveInteger(
        subject.credits
      )
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "INVALID_SUBJECT_CREDITS",

          message:
            `과목 학점이 유효하지 않습니다: ${subject.credits}`,

          curriculumKey:
            key,

          subjectName:
            name,
        }
      );
    }


    if (
      !isNonNegativeInteger(
        subject.lectureHours
      )
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "INVALID_LECTURE_HOURS",

          message:
            `강의시간이 유효하지 않습니다: ${subject.lectureHours}`,

          curriculumKey:
            key,

          subjectName:
            name,
        }
      );
    }


    if (
      !isNonNegativeInteger(
        subject.practiceHours
      )
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "INVALID_PRACTICE_HOURS",

          message:
            `실습시간이 유효하지 않습니다: ${subject.practiceHours}`,

          curriculumKey:
            key,

          subjectName:
            name,
        }
      );
    }


    if (
      !isPositiveInteger(
        subject.sortOrder
      )
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "INVALID_SORT_ORDER",

          message:
            `sortOrder가 유효하지 않습니다: ${subject.sortOrder}`,

          curriculumKey:
            key,

          subjectName:
            name,
        }
      );
    } else {
      if (
        sortOrders.has(
          subject.sortOrder
        )
      ) {
        pushIssue(
          issues,
          {
            level:
              "error",

            code:
              "DUPLICATE_SORT_ORDER",

            message:
              `동일 전공 내 sortOrder 중복: ${subject.sortOrder}`,

            curriculumKey:
              key,

            subjectName:
              name,
          }
        );
      }

      sortOrders.add(
        subject.sortOrder
      );
    }


    if (
      subject.officialSubjectId !==
        null &&
      !cleanText(
        subject
          .officialSubjectId
      )
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "EMPTY_OFFICIAL_SUBJECT_ID",

          message:
            "officialSubjectId가 빈 문자열입니다. null이어야 합니다.",

          curriculumKey:
            key,

          subjectName:
            name,
        }
      );
    }
  }
}


/* =========================================================
 * Curriculum validation
 * ========================================================= */

function validateCurriculum(
  curriculum:
    NileParsedCurriculum,
  issues:
    NileValidationIssue[]
): void {
  const key =
    cleanText(
      curriculum
        .curriculumKey
    );

  const officialMajorId =
    cleanText(
      curriculum
        .officialMajorId
    );

  const majorName =
    cleanText(
      curriculum
        .majorName
    );

  const degreeName =
    cleanText(
      curriculum
        .degreeName
    );


  if (!key) {
    pushIssue(
      issues,
      {
        level:
          "error",

        code:
          "EMPTY_CURRICULUM_KEY",

        message:
          "curriculumKey가 없습니다.",
      }
    );
  }


  if (!officialMajorId) {
    pushIssue(
      issues,
      {
        level:
          "error",

        code:
          "EMPTY_OFFICIAL_MAJOR_ID",

        message:
          "officialMajorId가 없습니다.",

        curriculumKey:
          key,
      }
    );
  }


  if (
    key &&
    officialMajorId
  ) {
    try {
      const expectedKey =
        buildNileCurriculumKey({
          degreeLevel:
            curriculum.degreeLevel,

          officialMajorId,
        });

      if (
        expectedKey !==
        key
      ) {
        pushIssue(
          issues,
          {
            level:
              "error",

            code:
              "CURRICULUM_KEY_MISMATCH",

            message:
              `curriculumKey가 officialMajorId 기준 생성값과 다릅니다. expected=${expectedKey} actual=${key}`,

            curriculumKey:
              key,
          }
        );
      }
    } catch (error) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "CURRICULUM_KEY_BUILD_FAILED",

          message:
            error instanceof Error
              ? error.message
              : String(error),

          curriculumKey:
            key,
        }
      );
    }
  }


  if (!degreeName) {
    pushIssue(
      issues,
      {
        level:
          "error",

        code:
          "EMPTY_DEGREE_NAME",

        message:
          "학위명이 없습니다.",

        curriculumKey:
          key,
      }
    );
  }


  if (!majorName) {
    pushIssue(
      issues,
      {
        level:
          "error",

        code:
          "EMPTY_MAJOR_NAME",

        message:
          "전공명이 없습니다.",

        curriculumKey:
          key,
      }
    );
  }


  if (
    !cleanText(
      curriculum
        .standardVersion
    )
  ) {
    pushIssue(
      issues,
      {
        level:
          "error",

        code:
          "EMPTY_STANDARD_VERSION",

        message:
          "standardVersion이 없습니다.",

        curriculumKey:
          key,
      }
    );
  }


  if (
    !cleanText(
      curriculum.sourceUrl
    )
  ) {
    pushIssue(
      issues,
      {
        level:
          "error",

        code:
          "EMPTY_CURRICULUM_SOURCE_URL",

        message:
          "전공 공식 sourceUrl이 없습니다.",

        curriculumKey:
          key,
      }
    );
  }


  if (
    !(
      curriculum
        .sourceCheckedAt
      instanceof Date
    ) ||
    Number.isNaN(
      curriculum
        .sourceCheckedAt
        .getTime()
    )
  ) {
    pushIssue(
      issues,
      {
        level:
          "error",

        code:
          "INVALID_SOURCE_CHECKED_AT",

        message:
          "sourceCheckedAt이 유효한 Date가 아닙니다.",

        curriculumKey:
          key,
      }
    );
  }


  validateDegreeRequirements(
    curriculum,
    issues
  );

  validateCoreRequirement(
    curriculum,
    issues
  );

  validateCurriculumSubjects(
    curriculum,
    issues
  );
}


/* =========================================================
 * Cross curriculum validation
 * ========================================================= */

function validateCurriculumUniqueness(
  curriculums:
    NileParsedCurriculum[],
  issues:
    NileValidationIssue[]
): void {
  const curriculumKeys =
    new Set<string>();

  const officialMajorKeys =
    new Set<string>();


  for (
    const curriculum
    of curriculums
  ) {
    const key =
      cleanText(
        curriculum
          .curriculumKey
      );

    if (
      key &&
      curriculumKeys.has(key)
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "DUPLICATE_CURRICULUM_KEY",

          message:
            `curriculumKey 중복: ${key}`,

          curriculumKey:
            key,
        }
      );
    }

    if (key) {
      curriculumKeys.add(
        key
      );
    }


    const officialMajorId =
      cleanText(
        curriculum
          .officialMajorId
      );

    if (
      officialMajorId
    ) {
      const officialKey =
        `${curriculum.degreeLevel}:${officialMajorId}`;

      if (
        officialMajorKeys.has(
          officialKey
        )
      ) {
        pushIssue(
          issues,
          {
            level:
              "error",

            code:
              "DUPLICATE_OFFICIAL_MAJOR",

            message:
              `동일 degreeLevel에서 officialMajorId가 중복됐습니다: ${officialKey}`,

            curriculumKey:
              key,
          }
        );
      }

      officialMajorKeys.add(
        officialKey
      );
    }
  }
}


/* =========================================================
 * Liberal validation
 * ========================================================= */

function validateLiberalSubjects(
  subjects:
    NileCollectedLiberalSubject[],
  issues:
    NileValidationIssue[]
): void {
  const names =
    new Set<string>();


  for (
    const subject
    of subjects
  ) {
    const name =
      cleanText(
        subject.subjectName
      );

    const normalized =
      normalizeNileSubjectName(
        name
      );


    if (!name) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "EMPTY_LIBERAL_SUBJECT_NAME",

          message:
            "교양과목명이 비어 있습니다.",
        }
      );

      continue;
    }


    if (
      names.has(
        normalized
      )
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "DUPLICATE_LIBERAL_SUBJECT",

          message:
            `교양과목 중복: ${name}`,

          subjectName:
            name,
        }
      );
    }

    names.add(
      normalized
    );


    if (
      !isPositiveInteger(
        subject.credits
      )
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "INVALID_LIBERAL_CREDITS",

          message:
            `교양과목 학점 오류: ${subject.credits}`,

          subjectName:
            name,
        }
      );
    }


    if (
      !isNonNegativeInteger(
        subject.lectureHours
      ) ||
      !isNonNegativeInteger(
        subject.practiceHours
      )
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "INVALID_LIBERAL_HOURS",

          message:
            [
              `교양과목 시간 오류`,
              `lecture=${subject.lectureHours}`,
              `practice=${subject.practiceHours}`,
            ].join(" / "),

          subjectName:
            name,
        }
      );
    }
  }
}


/* =========================================================
 * Compatible validation
 * ========================================================= */

function validateCompatibleSubjects(
  subjects:
    NileCollectedMajorLiberalCompatibleSubject[],
  curriculumKeys:
    Set<string>,
  issues:
    NileValidationIssue[]
): void {
  const uniqueKeys =
    new Set<string>();


  for (
    const subject
    of subjects
  ) {
    const curriculumKey =
      cleanText(
        subject
          .curriculumKey
      );

    const name =
      cleanText(
        subject
          .subjectName
      );

    const normalized =
      normalizeNileSubjectName(
        name
      );


    if (
      !curriculumKey ||
      !curriculumKeys.has(
        curriculumKey
      )
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "COMPATIBLE_UNKNOWN_CURRICULUM",

          message:
            `호환과목이 존재하지 않는 curriculumKey를 참조합니다: ${curriculumKey}`,

          curriculumKey,

          subjectName:
            name,
        }
      );
    }


    if (!name) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "EMPTY_COMPATIBLE_SUBJECT_NAME",

          message:
            "전공교양 호환과목명이 비어 있습니다.",

          curriculumKey,
        }
      );

      continue;
    }


    const uniqueKey =
      `${curriculumKey}:${normalized}`;

    if (
      uniqueKeys.has(
        uniqueKey
      )
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "DUPLICATE_COMPATIBLE_SUBJECT",

          message:
            `동일 전공의 호환과목이 중복됐습니다: ${name}`,

          curriculumKey,

          subjectName:
            name,
        }
      );
    }

    uniqueKeys.add(
      uniqueKey
    );


    if (
      subject
        .majorRequirementType !==
        "전공필수" &&
      subject
        .majorRequirementType !==
        "전공선택"
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "INVALID_COMPATIBLE_REQUIREMENT_TYPE",

          message:
            `호환과목 전공 학습구분이 잘못됐습니다: ${String(
              subject.majorRequirementType
            )}`,

          curriculumKey,

          subjectName:
            name,
        }
      );
    }


    if (
      !isPositiveInteger(
        subject.credits
      )
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "INVALID_COMPATIBLE_CREDITS",

          message:
            `호환과목 학점 오류: ${subject.credits}`,

          curriculumKey,

          subjectName:
            name,
        }
      );
    }
  }
}


/* =========================================================
 * Alias validation
 * ========================================================= */

function validateAliases(
  aliases:
    NileCollectedSubjectAlias[],
  curriculumKeys:
    Set<string>,
  issues:
    NileValidationIssue[]
): void {
  const uniqueKeys =
    new Set<string>();


  for (
    const alias
    of aliases
  ) {
    const curriculumKey =
      cleanText(
        alias.curriculumKey
      );

    const canonical =
      cleanText(
        alias
          .canonicalSubjectName
      );

    const aliasName =
      cleanText(
        alias
          .aliasSubjectName
      );


    if (
      curriculumKey &&
      !curriculumKeys.has(
        curriculumKey
      )
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "ALIAS_UNKNOWN_CURRICULUM",

          message:
            `alias가 존재하지 않는 curriculumKey를 참조합니다: ${curriculumKey}`,

          curriculumKey,

          subjectName:
            aliasName,
        }
      );
    }


    if (
      !canonical ||
      !aliasName
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "INVALID_ALIAS_NAME",

          message:
            "alias의 canonicalSubjectName 또는 aliasSubjectName이 비어 있습니다.",

          curriculumKey:
            curriculumKey ||
            null,

          subjectName:
            aliasName ||
            canonical ||
            null,
        }
      );

      continue;
    }


    const normalizedAlias =
      normalizeNileSubjectName(
        aliasName
      );

    const uniqueKey =
      `${
        curriculumKey ||
        "global"
      }:${normalizedAlias}`;

    if (
      uniqueKeys.has(
        uniqueKey
      )
    ) {
      pushIssue(
        issues,
        {
          level:
            "error",

          code:
            "DUPLICATE_ALIAS",

          message:
            `동일 alias가 중복되었습니다: ${aliasName}`,

          curriculumKey:
            curriculumKey ||
            null,

          subjectName:
            aliasName,
        }
      );
    }

    uniqueKeys.add(
      uniqueKey
    );


    if (
      normalizeNileSubjectName(
        alias
          .normalizedAliasSubjectName
      ) !==
      normalizedAlias
    ) {
      pushIssue(
        issues,
        {
          level:
            "warning",

          code:
            "ALIAS_NORMALIZATION_MISMATCH",

          message:
            `저장된 normalizedAliasSubjectName과 현재 정규화 결과가 다릅니다.`,

          curriculumKey:
            curriculumKey ||
            null,

          subjectName:
            aliasName,
        }
      );
    }
  }
}


/* =========================================================
 * Dataset volume validation
 * ========================================================= */

function validateDatasetVolume(
  dataset:
    NileCollectedDataset,
  issues:
    NileValidationIssue[],
  params: {
    fullSync: boolean;
  }
): void {
  if (
    dataset.curriculums.length ===
    0
  ) {
    pushIssue(
      issues,
      {
        level:
          "error",

        code:
          "EMPTY_CURRICULUM_DATASET",

        message:
          "수집된 전공이 0개입니다.",
      }
    );

    return;
  }


  const totalSubjectCount =
    dataset.curriculums
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
      );


  if (
    params.fullSync &&
    dataset.curriculums.length <
      MIN_FULL_CURRICULUM_COUNT
  ) {
    pushIssue(
      issues,
      {
        level:
          "error",

        code:
          "TOO_FEW_CURRICULUMS",

        message:
          `전체 동기화인데 전공 수가 비정상적으로 적습니다. count=${dataset.curriculums.length}`,
      }
    );
  }


  if (
    params.fullSync &&
    totalSubjectCount <
      MIN_FULL_SUBJECT_COUNT
  ) {
    pushIssue(
      issues,
      {
        level:
          "error",

        code:
          "TOO_FEW_STANDARD_SUBJECTS",

        message:
          `전체 동기화인데 전공과목 수가 비정상적으로 적습니다. count=${totalSubjectCount}`,
      }
    );
  }


  if (
    params.fullSync &&
    dataset.liberalSubjects.length <
      MIN_FULL_LIBERAL_COUNT
  ) {
    pushIssue(
      issues,
      {
        level:
          "error",

        code:
          "TOO_FEW_LIBERAL_SUBJECTS",

        message:
          `전체 동기화인데 교양과목 수가 비정상적으로 적습니다. count=${dataset.liberalSubjects.length}`,
      }
    );
  }
}


/* =========================================================
 * Main validator
 * ========================================================= */

export function validateNileStandardDataset(
  dataset:
    NileCollectedDataset,
  options?: {
    /**
     * true:
     * 전체 국평원 sync.
     *
     * false:
     * 특정 전공 테스트/부분 수집.
     */
    fullSync?: boolean;
  }
): NileValidationResult {
  const issues:
    NileValidationIssue[] =
    [];

  const fullSync =
    options?.fullSync !==
    false;


  if (
    !dataset ||
    typeof dataset !==
    "object"
  ) {
    return {
      valid:
        false,

      issues: [
        {
          level:
            "error",

          code:
            "INVALID_DATASET",

          message:
            "NILE dataset이 없습니다.",

          curriculumKey:
            null,

          subjectName:
            null,
        },
      ],
    };
  }


  if (
    !cleanText(
      dataset
        .standardVersion
    )
  ) {
    pushIssue(
      issues,
      {
        level:
          "error",

        code:
          "EMPTY_DATASET_STANDARD_VERSION",

        message:
          "dataset.standardVersion이 없습니다.",
      }
    );
  }


  if (
    !(
      dataset.collectedAt
      instanceof Date
    ) ||
    Number.isNaN(
      dataset
        .collectedAt
        .getTime()
    )
  ) {
    pushIssue(
      issues,
      {
        level:
          "error",

        code:
          "INVALID_DATASET_COLLECTED_AT",

        message:
          "dataset.collectedAt이 유효한 Date가 아닙니다.",
      }
    );
  }


  validateDatasetVolume(
    dataset,
    issues,
    {
      fullSync,
    }
  );


  validateCurriculumUniqueness(
    dataset.curriculums,
    issues
  );


  for (
    const curriculum
    of dataset.curriculums
  ) {
    validateCurriculum(
      curriculum,
      issues
    );
  }


  validateLiberalSubjects(
    dataset.liberalSubjects,
    issues
  );


  const curriculumKeys =
    new Set(
      dataset.curriculums.map(
        (curriculum) =>
          curriculum
            .curriculumKey
      )
    );


  validateCompatibleSubjects(
    dataset
      .majorLiberalCompatibleSubjects,
    curriculumKeys,
    issues
  );


  validateAliases(
    dataset.subjectAliases,
    curriculumKeys,
    issues
  );


  const errorCount =
    issues.filter(
      (issue) =>
        issue.level ===
        "error"
    ).length;


  return {
    valid:
      errorCount ===
      0,

    issues,
  };
}


/* =========================================================
 * Assert helper
 * ========================================================= */

/**
 * Seed 직전 사용.
 *
 * error가 하나라도 있으면 DB 수정 자체를 시작하지 않는다.
 */
export function assertValidNileStandardDataset(
  dataset:
    NileCollectedDataset,
  options?: {
    fullSync?: boolean;
  }
): void {
  const result =
    validateNileStandardDataset(
      dataset,
      options
    );


  if (
    result.valid
  ) {
    return;
  }


  const errors =
    result.issues.filter(
      (issue) =>
        issue.level ===
        "error"
    );


  const message =
    errors
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
      )
      .join("\n");


  throw new Error(
    [
      `NILE Dataset 검증 실패 (${errors.length} errors)`,
      message,
    ].join("\n")
  );
}


/* =========================================================
 * Summary helper
 * ========================================================= */

export function summarizeNileValidation(
  result:
    NileValidationResult
): {
  valid: boolean;

  errorCount: number;

  warningCount: number;

  errorCodes: string[];

  warningCodes: string[];
} {
  const errors =
    result.issues.filter(
      (issue) =>
        issue.level ===
        "error"
    );

  const warnings =
    result.issues.filter(
      (issue) =>
        issue.level ===
        "warning"
    );


  return {
    valid:
      result.valid,

    errorCount:
      errors.length,

    warningCount:
      warnings.length,

    errorCodes:
      Array.from(
        new Set(
          errors.map(
            (issue) =>
              issue.code
          )
        )
      ),

    warningCodes:
      Array.from(
        new Set(
          warnings.map(
            (issue) =>
              issue.code
          )
        )
      ),
  };
}