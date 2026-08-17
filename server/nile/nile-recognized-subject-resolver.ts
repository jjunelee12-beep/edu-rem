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
} from "./nile-standard-types";

import type {
  DegreeRequirementResolution,
} from "../ai/risk-rules/degree-requirement-resolver";

import type {
  QualificationRiskCourseKey,
  QualificationRecognizedSubject,
} from "../ai/risk-rules/qualification-risk-analyzer";


/* =========================================================
 * Public types
 * ========================================================= */

export type NileSubjectClassificationSource =
  | "major_required"
  | "major_elective"
  | "major_liberal_compatible"
  | "liberal"
  | "general"
  | "unresolved";


export type NileResolvedRecognizedSubject =
  QualificationRecognizedSubject & {
    nileClassificationSource:
      NileSubjectClassificationSource;

    nileCurriculumKey:
      string | null;

    nileOfficialSubjectId:
      string | null;

    originalRequirementType:
      string | null;

    originalCategory:
      string | null;

    classificationReason:
      string;
  };


export type NileRecognizedSubjectResolution = {
  canResolve:
    boolean;

  curriculum: {
    id:
      number;

    curriculumKey:
      string;

    degreeLevel:
      "associate" |
      "bachelor";

    degreeName:
      string;

    majorName:
      string;

    officialMajorId:
      string | null;
  } | null;

  subjects:
    NileResolvedRecognizedSubject[];

  warnings:
    string[];
};


/* =========================================================
 * Internal helpers
 * ========================================================= */

function cleanText(
  value:
    unknown
): string {
  return String(
    value ??
    ""
  )
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}


function normalizeCredits(
  value:
    unknown
): number {
  const number =
    Number(value);

  if (
    !Number.isFinite(
      number
    ) ||
    number <= 0
  ) {
    return 0;
  }

  return number;
}


function getTargetDegreeLevel(
  degreeRequirement:
    DegreeRequirementResolution
):
  | "associate"
  | "bachelor"
  | null {
  const degreeType =
    degreeRequirement
      .defaultDegreeRule
      ?.degreeType;

  if (
    degreeType ===
      "associate" ||
    degreeType ===
      "associate_second_major"
  ) {
    return "associate";
  }

  if (
    degreeType ===
      "bachelor" ||
    degreeType ===
      "bachelor_second_major"
  ) {
    return "bachelor";
  }

  return null;
}

type NileTargetCurriculumRule = {
  degreeLevel:
    | "associate"
    | "bachelor";

  officialMajorId:
    | string
    | null;

  exactMajorNames:
    string[];
};


const NILE_TARGET_CURRICULUM_RULES:
  Partial<
    Record<
      QualificationRiskCourseKey,
      NileTargetCurriculumRule[]
    >
  > = {
  social_worker_2: [
    {
      degreeLevel:
        "bachelor",

      officialMajorId:
        "AGAE",

      exactMajorNames: [
        "사회복지학 전공",
      ],
    },

    {
      degreeLevel:
        "associate",

      officialMajorId:
        null,

      exactMajorNames: [
        "사회복지 전공",
      ],
    },
  ],
};


function getExactTargetCurriculumRule(
  params: {
    courseKey:
      QualificationRiskCourseKey;

    degreeLevel:
      | "associate"
      | "bachelor";
  }
): NileTargetCurriculumRule | null {
  const rules =
    NILE_TARGET_CURRICULUM_RULES[
      params.courseKey
    ] || [];

  return (
    rules.find(
      rule =>
        rule.degreeLevel ===
        params.degreeLevel
    ) ||
    null
  );
}


/**
 * 우리가 현재 공식 NILE Master를 연결할
 * 주력 전공을 지정한다.
 *
 * officialMajorId를 코드에 하드코딩하지 않고
 * DB의 공식 majorName을 기준으로 찾는다.
 */
function getTargetMajorSearchTerms(
  courseKey:
    QualificationRiskCourseKey
): string[] {
  switch (
    courseKey
  ) {
    case "social_worker_2":
      return [
        "사회복지",
      ];

    case "childcare_teacher_2":
      return [
        "아동",
        "보육",
        "아동·가족",
        "아동가족",
      ];

    case "child_study_degree":
      return [
        "아동",
        "아동학",
      ];

    case "korean_teacher_2":
      return [
        "한국어",
        "한국어교육",
      ];

    default:
      return [];
  }
}


function majorNameMatches(
  majorName:
    string,
  searchTerms:
    string[]
): boolean {
  const normalizedMajor =
    normalizeNileSubjectName(
      majorName
    );

  return searchTerms.some(
    (
      term
    ) =>
      normalizedMajor.includes(
        normalizeNileSubjectName(
          term
        )
      )
  );
}


/* =========================================================
 * Curriculum resolver
 * ========================================================= */

async function resolveTargetCurriculum(
  params: {
    courseKey:
      QualificationRiskCourseKey;

    degreeRequirement:
      DegreeRequirementResolution;
  }
) {
  const db =
    await getDb();

  if (!db) {
    throw new Error(
      "NILE 전공 판정용 DB를 확인할 수 없습니다."
    );
  }

  const degreeLevel =
    getTargetDegreeLevel(
      params.degreeRequirement
    );

  if (!degreeLevel) {
    return null;
  }

  const searchTerms =
    getTargetMajorSearchTerms(
      params.courseKey
    );

  if (
    searchTerms.length ===
    0
  ) {
    return null;
  }

  const rows =
    await db
      .select({
        id:
          nileStandardCurriculums.id,

        curriculumKey:
          nileStandardCurriculums
            .curriculumKey,

        degreeLevel:
          nileStandardCurriculums
            .degreeLevel,

        degreeName:
          nileStandardCurriculums
            .degreeName,

        majorName:
          nileStandardCurriculums
            .majorName,

        officialMajorId:
          nileStandardCurriculums
            .officialMajorId,

        standardVersion:
          nileStandardCurriculums
            .standardVersion,

        isActive:
          nileStandardCurriculums
            .isActive,
      })
      .from(
        nileStandardCurriculums
      )
      .where(
        and(
          eq(
            nileStandardCurriculums
              .degreeLevel,
            degreeLevel
          ),

          eq(
            nileStandardCurriculums
              .isActive,
            true
          )
        )
      );

  const exactRule =
  getExactTargetCurriculumRule({
    courseKey:
      params.courseKey,

    degreeLevel,
  });


if (exactRule) {
  if (
    exactRule.officialMajorId
  ) {
    const officialIdMatches =
      rows.filter(
        row =>
          cleanText(
            row.officialMajorId
          ).toUpperCase() ===
          exactRule
            .officialMajorId!
            .toUpperCase()
      );


    if (
      officialIdMatches.length ===
      1
    ) {
      const selected =
        officialIdMatches[0];

      return {
        id:
          Number(
            selected.id
          ),

        curriculumKey:
          selected.curriculumKey,

        degreeLevel:
          selected.degreeLevel,

        degreeName:
          selected.degreeName,

        majorName:
          selected.majorName,

        officialMajorId:
          selected.officialMajorId ||
          null,
      };
    }


    if (
      officialIdMatches.length >
      1
    ) {
      const currentMatches =
        officialIdMatches.filter(
          row =>
            cleanText(
              row.standardVersion
            ) ===
            "current"
        );


      if (
        currentMatches.length ===
        1
      ) {
        const selected =
          currentMatches[0];

        return {
          id:
            Number(
              selected.id
            ),

          curriculumKey:
            selected.curriculumKey,

          degreeLevel:
            selected.degreeLevel,

          degreeName:
            selected.degreeName,

          majorName:
            selected.majorName,

          officialMajorId:
            selected.officialMajorId ||
            null,
        };
      }


      return null;
    }
  }


  const exactNameMatches =
    rows.filter(
      row => {
        const rowMajorName =
          cleanText(
            row.majorName
          );

        return exactRule
          .exactMajorNames
          .some(
            officialName =>
              rowMajorName ===
              cleanText(
                officialName
              )
          );
      }
    );


  if (
    exactNameMatches.length ===
    1
  ) {
    const selected =
      exactNameMatches[0];

    return {
      id:
        Number(
          selected.id
        ),

      curriculumKey:
        selected.curriculumKey,

      degreeLevel:
        selected.degreeLevel,

      degreeName:
        selected.degreeName,

      majorName:
        selected.majorName,

      officialMajorId:
        selected.officialMajorId ||
        null,
    };
  }


  if (
    exactNameMatches.length >
    1
  ) {
    const currentMatches =
      exactNameMatches.filter(
        row =>
          cleanText(
            row.standardVersion
          ) ===
          "current"
      );


    if (
      currentMatches.length ===
      1
    ) {
      const selected =
        currentMatches[0];

      return {
        id:
          Number(
            selected.id
          ),

        curriculumKey:
          selected.curriculumKey,

        degreeLevel:
          selected.degreeLevel,

        degreeName:
          selected.degreeName,

        majorName:
          selected.majorName,

        officialMajorId:
          selected.officialMajorId ||
          null,
      };
    }


    return null;
  }
}


const candidates =
  rows.filter(
    row =>
      majorNameMatches(
        row.majorName,
        searchTerms
      )
  );


if (
  candidates.length ===
  0
) {
  return null;
}


if (
  candidates.length ===
  1
) {
  const selected =
    candidates[0];

  return {
    id:
      Number(
        selected.id
      ),

    curriculumKey:
      selected.curriculumKey,

    degreeLevel:
      selected.degreeLevel,

    degreeName:
      selected.degreeName,

    majorName:
      selected.majorName,

    officialMajorId:
      selected.officialMajorId ||
      null,
  };
}


const currentCandidates =
  candidates.filter(
    row =>
      cleanText(
        row.standardVersion
      ) ===
      "current"
  );


if (
  currentCandidates.length !==
  1
) {
  return null;
}


const selected =
  currentCandidates[0];


return {
  id:
    Number(
      selected.id
    ),

  curriculumKey:
    selected.curriculumKey,

  degreeLevel:
    selected.degreeLevel,

  degreeName:
    selected.degreeName,

  majorName:
    selected.majorName,

  officialMajorId:
    selected.officialMajorId ||
    null,
};
}


/* =========================================================
 * Alias resolver
 * ========================================================= */

async function resolveCanonicalNameFromAlias(
  params: {
    curriculumId:
      number;

    subjectName:
      string;
  }
): Promise<string | null> {
  const db =
    await getDb();

  if (!db) {
    return null;
  }

  const normalized =
    normalizeNileSubjectName(
      params.subjectName
    );

  if (!normalized) {
    return null;
  }

  const aliases =
    await db
      .select({
        curriculumId:
          nileSubjectAliases
            .curriculumId,

        canonicalSubjectName:
          nileSubjectAliases
            .canonicalSubjectName,

        normalizedAliasSubjectName:
          nileSubjectAliases
            .normalizedAliasSubjectName,

        isActive:
          nileSubjectAliases
            .isActive,
      })
      .from(
        nileSubjectAliases
      )
      .where(
        and(
          eq(
            nileSubjectAliases
              .normalizedAliasSubjectName,
            normalized
          ),

          eq(
            nileSubjectAliases
              .isActive,
            true
          )
        )
      );

  const curriculumAlias =
    aliases.find(
      (
        row
      ) =>
        Number(
          row.curriculumId ||
          0
        ) ===
        params.curriculumId
    );

  if (
    curriculumAlias
      ?.canonicalSubjectName
  ) {
    return cleanText(
      curriculumAlias
        .canonicalSubjectName
    );
  }

  const globalAlias =
    aliases.find(
      (
        row
      ) =>
        row.curriculumId ===
          null ||
        row.curriculumId ===
          undefined
    );

  return globalAlias
    ?.canonicalSubjectName
    ? cleanText(
        globalAlias
          .canonicalSubjectName
      )
    : null;
}


/* =========================================================
 * Single subject classification
 * ========================================================= */

async function classifySingleSubject(
  params: {
    curriculum: {
      id:
        number;

      curriculumKey:
        string;
    };

    subject:
      QualificationRecognizedSubject;
  }
): Promise<NileResolvedRecognizedSubject> {
  const db =
    await getDb();

  if (!db) {
    throw new Error(
      "NILE 과목 판정용 DB를 확인할 수 없습니다."
    );
  }

  const originalName =
    cleanText(
      params.subject.subjectName
    );

  const originalRequirementType =
    params.subject
      .requirementType ??
    null;

  const originalCategory =
    params.subject
      .category ??
    null;

  const credits =
    normalizeCredits(
      params.subject.credits
    );

  const aliasCanonicalName =
    await resolveCanonicalNameFromAlias({
      curriculumId:
        params.curriculum.id,

      subjectName:
        originalName,
    });

  const lookupName =
    aliasCanonicalName ||
    originalName;

  const normalizedName =
    normalizeNileSubjectName(
      lookupName
    );


  /* -------------------------------------------------------
   * 1. 목표전공 공식 전필/전선
   * ------------------------------------------------------- */

  const majorRows =
    await db
      .select({
        subjectName:
          nileStandardSubjects
            .subjectName,

        officialSubjectId:
          nileStandardSubjects
            .officialSubjectId,

        normalizedSubjectName:
          nileStandardSubjects
            .normalizedSubjectName,

        requirementType:
          nileStandardSubjects
            .requirementType,
      })
      .from(
        nileStandardSubjects
      )
      .where(
        and(
          eq(
            nileStandardSubjects
              .curriculumId,
            params.curriculum.id
          ),

          eq(
            nileStandardSubjects
              .normalizedSubjectName,
            normalizedName
          ),

          eq(
            nileStandardSubjects
              .isActive,
            true
          )
        )
      )
      .limit(1);

  const major =
    majorRows[0];

  if (major) {
    const isRequired =
      major
        .requirementType ===
      "전공필수";

    return {
      ...params.subject,

      subjectName:
        originalName,

      credits,

      category:
        "전공",

      requirementType:
        isRequired
          ? "전공필수"
          : "전공선택",

      nileClassificationSource:
        isRequired
          ? "major_required"
          : "major_elective",

      nileCurriculumKey:
        params
          .curriculum
          .curriculumKey,

      nileOfficialSubjectId:
        major.officialSubjectId ||
        null,

      originalRequirementType,

      originalCategory,

      classificationReason:
        `${lookupName} 과목이 목표 전공의 공식 ${
          isRequired
            ? "전공필수"
            : "전공선택"
        } 과목으로 확인되었습니다.`,
    };
  }


  /* -------------------------------------------------------
   * 2. 전공교양 호환과목
   * ------------------------------------------------------- */

  const compatibleRows =
    await db
      .select({
        subjectName:
          nileMajorLiberalCompatibleSubjects
            .subjectName,

        officialSubjectId:
          nileMajorLiberalCompatibleSubjects
            .officialSubjectId,

        majorRequirementType:
          nileMajorLiberalCompatibleSubjects
            .majorRequirementType,
      })
      .from(
        nileMajorLiberalCompatibleSubjects
      )
      .where(
        and(
          eq(
            nileMajorLiberalCompatibleSubjects
              .curriculumId,
            params.curriculum.id
          ),

          eq(
            nileMajorLiberalCompatibleSubjects
              .normalizedSubjectName,
            normalizedName
          ),

          eq(
            nileMajorLiberalCompatibleSubjects
              .isActive,
            true
          )
        )
      )
      .limit(1);

  const compatible =
    compatibleRows[0];

  if (compatible) {
    return {
      ...params.subject,

      subjectName:
        originalName,

      credits,

      category:
        "전공",

      requirementType:
        compatible
          .majorRequirementType ===
          "전공필수"
          ? "전공필수"
          : "전공선택",

      nileClassificationSource:
        "major_liberal_compatible",

      nileCurriculumKey:
        params
          .curriculum
          .curriculumKey,

      nileOfficialSubjectId:
        compatible
          .officialSubjectId ||
        null,

      originalRequirementType,

      originalCategory,

      classificationReason:
        `${lookupName} 과목은 교양으로도 인정 가능하지만 현재 목표 전공에서는 ${compatible.majorRequirementType}으로 사용할 수 있는 호환과목입니다.`,
    };
  }


  /* -------------------------------------------------------
   * 3. 공식 교양
   * ------------------------------------------------------- */

  const liberalRows =
    await db
      .select({
        subjectName:
          nileLiberalSubjects
            .subjectName,

        officialSubjectId:
          nileLiberalSubjects
            .officialSubjectId,
      })
      .from(
        nileLiberalSubjects
      )
      .where(
        and(
          eq(
            nileLiberalSubjects
              .normalizedSubjectName,
            normalizedName
          ),

          eq(
            nileLiberalSubjects
              .isActive,
            true
          )
        )
      )
      .limit(1);

  const liberal =
    liberalRows[0];

  if (liberal) {
    return {
      ...params.subject,

      subjectName:
        originalName,

      credits,

      category:
        "교양",

      requirementType:
        "교양",

      nileClassificationSource:
        "liberal",

      nileCurriculumKey:
        params
          .curriculum
          .curriculumKey,

      nileOfficialSubjectId:
        liberal
          .officialSubjectId ||
        null,

      originalRequirementType,

      originalCategory,

      classificationReason:
        `${lookupName} 과목이 국가평생교육진흥원 교양과목 기준에 포함되어 교양으로 분류되었습니다.`,
    };
  }


  /* -------------------------------------------------------
   * 4. 목표전공도 아니고 공식 교양도 아님
   *
   * 전적대에서 취득한 유효 학점이라는 전제하에
   * 일반선택 후보로 분류한다.
   * ------------------------------------------------------- */

  return {
    ...params.subject,

    subjectName:
      originalName,

    credits,

    category:
      "일반",

    requirementType:
      "일반",

    nileClassificationSource:
      "general",

    nileCurriculumKey:
      params
        .curriculum
        .curriculumKey,

    nileOfficialSubjectId:
      null,

    originalRequirementType,

    originalCategory,

    classificationReason:
      `${lookupName} 과목은 현재 목표 전공의 전필/전선 및 공식 교양과목에서 확인되지 않아 일반선택으로 분류되었습니다.`,
  };
}


/* =========================================================
 * Public resolver
 * ========================================================= */

export async function resolveNileRecognizedSubjects(
  params: {
    courseKey:
      QualificationRiskCourseKey;

    degreeRequirement:
      DegreeRequirementResolution;

    subjects:
      QualificationRecognizedSubject[];
  }
): Promise<NileRecognizedSubjectResolution> {
  const warnings:
    string[] = [];

  const subjects =
    Array.isArray(
      params.subjects
    )
      ? params.subjects
      : [];

  /**
   * 별도 새 학위가 필요하지 않으면
   * 학위 영역 재분류 자체가 필요 없다.
   *
   * 자격과목 인정은 기존 qualification-risk-analyzer가
   * 과목명 기준으로 계속 처리한다.
   */
  if (
    !params
      .degreeRequirement
      .requiresNewDegreeTrack
  ) {
    return {
      canResolve:
        false,

      curriculum:
        null,

      subjects:
        subjects.map(
          (
            subject
          ) => ({
            ...subject,

            nileClassificationSource:
              "unresolved",

            nileCurriculumKey:
              null,

            nileOfficialSubjectId:
              null,

            originalRequirementType:
              subject
                .requirementType ??
              null,

            originalCategory:
              subject.category ??
              null,

            classificationReason:
              "새 학위과정이 필요하지 않아 NILE 학위영역 재분류를 수행하지 않았습니다.",
          })
        ),

      warnings,
    };
  }


  const curriculum =
    await resolveTargetCurriculum({
      courseKey:
        params.courseKey,

      degreeRequirement:
        params.degreeRequirement,
    });


  if (!curriculum) {
    warnings.push(
      "현재 희망 과정과 학위경로에 대응하는 NILE 공식 전공 Master를 찾지 못했습니다."
    );

    return {
      canResolve:
        false,

      curriculum:
        null,

      subjects:
        subjects.map(
          (
            subject
          ) => ({
            ...subject,

            nileClassificationSource:
              "unresolved",

            nileCurriculumKey:
              null,

            nileOfficialSubjectId:
              null,

            originalRequirementType:
              subject
                .requirementType ??
              null,

            originalCategory:
              subject.category ??
              null,

            classificationReason:
              "NILE 목표 전공 Master를 찾지 못해 기존 분류를 자동 변경하지 않았습니다.",
          })
        ),

      warnings,
    };
  }


  const resolvedSubjects:
    NileResolvedRecognizedSubject[] =
    [];


  for (
    const subject
    of subjects
  ) {
    resolvedSubjects.push(
      await classifySingleSubject({
        curriculum,

        subject,
      })
    );
  }


  return {
    canResolve:
      true,

    curriculum,

    subjects:
      resolvedSubjects,

    warnings,
  };
}