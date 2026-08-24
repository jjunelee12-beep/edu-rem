import {
  CHILDCARE_TEACHER_2_RULE,
  CHILDCARE_TEACHER_CHARACTER_GROUPS,
  CHILDCARE_KNOWLEDGE_REQUIRED_GROUPS,
  CHILDCARE_PRACTICE_GROUPS,
  CHILDCARE_FACE_TO_FACE_GROUPS,

  CHILD_STUDY_DEGREE_RULE,

  KOREAN_TEACHER_2_RULE,

  LIFELONG_EDUCATOR_2_RULE,
  LIFELONG_EDUCATOR_REQUIRED_SUBJECTS,

 resolveChildcareTeacherArea,
resolveChildcareTeacherCharacterSlot,
resolveChildcareRequiredSlot,
resolveChildcarePracticeSlot,
resolveChildcareFaceToFaceSlot,

  resolveKoreanTeacherArea,
  resolveSocialWorkerRule,

  isFaceToFaceMasterSubject,

  type KoreanTeacherArea,
type ChildcareTeacherCharacterSlotKey,
type ChildcareRequiredSlotKey,
type ChildcarePracticeSlotKey,
} from "./risk-rule-master";

import {
  getConfirmedSubjectEquivalenceKey,
} from "./subject-equivalence-resolver";

export type QualificationRiskCourseKey =
  | "social_worker_2"
  | "childcare_teacher_2"
  | "child_study_degree"
  | "korean_teacher_2"
  | "lifelong_educator_2"
  | "unknown";

export type QualificationRecognizedSubject = {
  subjectName:
    string;

  requirementType:
    string | null;

  category:
    string | null;

  credits:
    number;

  source:
    "plan" |
    "transfer" |
    "extra";
};

export type QualificationRiskMasterItem = {
  id:
    number;

  catalogId:
    number;

  subjectName:
    string;

  requirementType:
    string | null;

  category:
    string | null;

  credits:
    number;

  isFaceToFace:
    boolean;
};

export type QualificationRuleIssue = {
  code:
    string;

  severity:
    "danger" |
    "warning" |
    "info";

  title:
    string;

  message:
    string;

  details?:
    Record<
      string,
      unknown
    >;
};

export type QualificationRuleAnalysis = {
  courseKey:
    QualificationRiskCourseKey;

  canAnalyze:
    boolean;

  issues:
    QualificationRuleIssue[];

  summary:
    Record<
      string,
      unknown
    >;
};

function toNumber(
  value:
    unknown
) {
  const normalized =
    Number(
      String(
        value ??
        "0"
      )
        .replace(
          /,/g,
          ""
        )
        .trim()
    );

  return Number.isFinite(
    normalized
  )
    ? normalized
    : 0;
}

function normalizeChildcareSubjectBaseName(
  value:
    unknown
) {
  return String(
    value ??
    ""
  )
    .trim()
    .replace(
      /\(대면\)/g,
      ""
    )
    .replace(
      /（대면）/g,
      ""
    )
    .replace(
      /\s+/g,
      ""
    )
    .toLowerCase();
}

export function resolveQualificationRiskCourseKey(
  courseName:
    unknown
): QualificationRiskCourseKey {
  const normalized =
    String(
      courseName ??
      ""
    )
      .trim()
      .replace(
        /\s+/g,
        ""
      )
      .toLowerCase();

  if (!normalized) {
    return "unknown";
  }

  if (
  /사회복지/.test(
    normalized
  ) ||
  /^사회(?:2급)?$/.test(
    normalized
  ) ||
  /^사복(?:2급)?$/.test(
    normalized
  )
) {
  return "social_worker_2";
}

  if (
    /보육교사/.test(
      normalized
    )
  ) {
    return "childcare_teacher_2";
  }

  if (
    /한국어교원|한국어교육/.test(
      normalized
    )
  ) {
    return "korean_teacher_2";
  }

  if (
    /평생교육/.test(
      normalized
    )
  ) {
    return "lifelong_educator_2";
  }

  if (
    /아동학|아동전문|아동가족/.test(
      normalized
    )
  ) {
    return "child_study_degree";
  }

  return "unknown";
}

function normalizeMasterItems(
  rows:
    any[]
): QualificationRiskMasterItem[] {
  return (
    rows ||
    []
  )
    .map(
      (
        row:
          any
      ) => ({
        id:
          Number(
            row?.id ||
            0
          ),

        catalogId:
          Number(
            row?.catalogId ||
            0
          ),

        subjectName:
          String(
            row?.subjectName ||
            ""
          ).trim(),

        requirementType:
          row?.requirementType
            ? String(
                row.requirementType
              ).trim()
            : null,

        category:
          row?.category
            ? String(
                row.category
              ).trim()
            : null,

        credits:
          toNumber(
            row?.credits
          ),

        isFaceToFace:
          isFaceToFaceMasterSubject(
            row?.subjectName
          ),
      })
    )
    .filter(
      (
        row
      ) =>
        Boolean(
          row.id &&
          row.subjectName
        )
    );
}

function createRecognizedKeySet(
  subjects:
    QualificationRecognizedSubject[]
) {
  return new Set(
    (
      subjects ||
      []
    )
      .map(
        (
          subject
        ) =>
          getConfirmedSubjectEquivalenceKey(
            subject.subjectName
          )
      )
      .filter(
        Boolean
      )
  );
}

/**
 * 동일교과목 key 기준으로
 * 과목 마스터 중복을 제거한다.
 *
 * 예:
 *
 * 사회복지학개론
 * 사회복지개론
 *
 * 두 행이 마스터에 동시에 있어도
 * 공식 동일교과목이면 한 과목으로만 계산한다.
 *
 * 동일 key가 여러 번 존재하면
 * 최초 등록된 마스터 행을 대표값으로 사용한다.
 */
function dedupeMasterItemsByEquivalenceKey(
  masterItems:
    QualificationRiskMasterItem[]
) {
  const map =
    new Map<
      string,
      QualificationRiskMasterItem
    >();

  for (
    const item
    of masterItems || []
  ) {
    const key =
      getConfirmedSubjectEquivalenceKey(
        item.subjectName
      );

    if (!key) {
      continue;
    }

    if (
      !map.has(
        key
      )
    ) {
      map.set(
        key,
        item
      );
    }
  }

  return Array.from(
    map.values()
  );
}

function getCompletedMasterItems(
  params: {
    masterItems:
      QualificationRiskMasterItem[];

    recognizedSubjects:
      QualificationRecognizedSubject[];
  }
) {
  const recognizedKeys =
    createRecognizedKeySet(
      params.recognizedSubjects
    );

  const uniqueMasterItems =
    dedupeMasterItemsByEquivalenceKey(
      params.masterItems
    );

  return uniqueMasterItems.filter(
    (
      masterItem
    ) => {
      const key =
        getConfirmedSubjectEquivalenceKey(
          masterItem.subjectName
        );

      return Boolean(
        key &&
        recognizedKeys.has(
          key
        )
      );
    }
  );
}

function getMissingMasterItems(
  params: {
    masterItems:
      QualificationRiskMasterItem[];

    recognizedSubjects:
      QualificationRecognizedSubject[];

    requirementType?:
      string |
      null;
  }
) {
  const recognizedKeys =
    createRecognizedKeySet(
      params.recognizedSubjects
    );

const uniqueMasterItems =
  dedupeMasterItemsByEquivalenceKey(
    params.masterItems
  );

  return uniqueMasterItems.filter(
    (
      masterItem
    ) => {
      if (
        params.requirementType &&
        masterItem.requirementType !==
          params.requirementType
      ) {
        return false;
      }

      const key =
        getConfirmedSubjectEquivalenceKey(
          masterItem.subjectName
        );

      if (!key) {
        return false;
      }

      return !recognizedKeys.has(
        key
      );
    }
  );
}

function analyzeSocialWorker(
  params: {
    masterItems:
      QualificationRiskMasterItem[];

    recognizedSubjects:
      QualificationRecognizedSubject[];

    socialWorkerLawVersion:
      unknown;
  }
): QualificationRuleAnalysis {
  const issues:
    QualificationRuleIssue[] =
    [];

  const resolution =
    resolveSocialWorkerRule(
      params.socialWorkerLawVersion
    );

  if (
    !resolution.canAnalyzeQualification ||
    !resolution.rule
  ) {
    issues.push({
      code:
        "SOCIAL_WORKER_LAW_VERSION_UNSELECTED",

      severity:
        "warning",

      title:
        "사회복지 적용기준 미설정",

      message:
        resolution.message,
    });

    return {
      courseKey:
        "social_worker_2",

      canAnalyze:
        false,

      issues,

      summary: {
        lawVersion:
          resolution.lawVersion,
      },
    };
  }

  const completedMasterItems =
    getCompletedMasterItems({
      masterItems:
        params.masterItems,

      recognizedSubjects:
        params.recognizedSubjects,
    });

  const requiredCompleted =
    completedMasterItems.filter(
      (
        item
      ) =>
        item.requirementType ===
        "전공필수"
    );

  const electiveCompleted =
    completedMasterItems.filter(
      (
        item
      ) =>
        item.requirementType ===
        "전공선택"
    );

  const missingRequired =
    Math.max(
      resolution.rule
        .requiredSubjects -
        requiredCompleted.length,
      0
    );

  const missingElective =
    Math.max(
      resolution.rule
        .electiveSubjects -
        electiveCompleted.length,
      0
    );

  if (
    missingRequired >
    0
  ) {
    const candidates =
      getMissingMasterItems({
        masterItems:
          params.masterItems,

        recognizedSubjects:
          params.recognizedSubjects,

        requirementType:
          "전공필수",
      });

    issues.push({
      code:
        "SOCIAL_WORKER_REQUIRED_SUBJECT_SHORTAGE",

      severity:
        "danger",

      title:
        "사회복지 필수과목 부족",

      message:
        `사회복지사 2급 ${resolution.lawVersion === "old" ? "구법" : "신법"} 기준 필수 ${resolution.rule.requiredSubjects}과목 중 ${requiredCompleted.length}과목이 확인되어 ${missingRequired}과목 부족합니다.`,

      details: {
        required:
          resolution.rule
            .requiredSubjects,

        completed:
          requiredCompleted.length,

        remaining:
          missingRequired,

        missingCandidates:
          candidates.map(
            (
              item
            ) =>
              item.subjectName
          ),
      },
    });
  }

  if (
    missingElective >
    0
  ) {
    const candidates =
      getMissingMasterItems({
        masterItems:
          params.masterItems,

        recognizedSubjects:
          params.recognizedSubjects,

        requirementType:
          "전공선택",
      });

    issues.push({
      code:
        "SOCIAL_WORKER_ELECTIVE_SUBJECT_SHORTAGE",

      severity:
        "danger",

      title:
        "사회복지 선택과목 부족",

      message:
        `사회복지사 2급 ${resolution.lawVersion === "old" ? "구법" : "신법"} 기준 선택 ${resolution.rule.electiveSubjects}과목 중 ${electiveCompleted.length}과목이 확인되어 ${missingElective}과목 부족합니다.`,

      details: {
        required:
          resolution.rule
            .electiveSubjects,

        completed:
          electiveCompleted.length,

        remaining:
          missingElective,

        missingCandidates:
          candidates.map(
            (
              item
            ) =>
              item.subjectName
          ),
      },
    });
  }

  return {
    courseKey:
      "social_worker_2",

    canAnalyze:
      true,

    issues,

    summary: {
      lawVersion:
        resolution.lawVersion,

      requiredSubjects:
        resolution.rule
          .requiredSubjects,

      electiveSubjects:
        resolution.rule
          .electiveSubjects,

      totalSubjects:
        resolution.rule
          .totalSubjects,

      practiceHours:
        resolution.rule
          .practiceHours,

      completedRequiredSubjects:
        requiredCompleted.length,

      completedElectiveSubjects:
        electiveCompleted.length,

      remainingRequiredSubjects:
        missingRequired,

      remainingElectiveSubjects:
        missingElective,
    },
  };
}

function analyzeChildStudyDegree(
  params: {
    masterItems:
      QualificationRiskMasterItem[];

    recognizedSubjects:
      QualificationRecognizedSubject[];
  }
): QualificationRuleAnalysis {
  const issues:
    QualificationRuleIssue[] =
    [];

  const masterRequiredItems =
    params.masterItems.filter(
      (
        item
      ) =>
        item.requirementType ===
        "전공필수"
    );

  const expectedMasterRequiredCount =
    CHILD_STUDY_DEGREE_RULE
      .majorRequiredCore
      .masterRequiredSubjects;

  /**
   * 아동학 전공필수 마스터는
   * 정확히 7과목으로 구성되어 있어야 한다.
   *
   * 실제 과목명이 아직 법규 마스터에
   * 고정되어 있지 않으므로,
   * DB 마스터 개수가 틀리면
   * 학생 판정을 진행하지 않는다.
   */
  if (
    masterRequiredItems.length !==
    expectedMasterRequiredCount
  ) {
    issues.push({
      code:
        "CHILD_STUDY_MAJOR_REQUIRED_MASTER_INVALID",

      severity:
        "danger",

      title:
        "아동학 전공필수 마스터 확인 필요",

      message:
        `아동학 전공필수 마스터는 ${expectedMasterRequiredCount}과목이어야 하나 현재 ${masterRequiredItems.length}과목이 등록되어 있습니다. 과목 마스터를 확인한 뒤 다시 분석해야 합니다.`,

      details: {
        expectedSubjects:
          expectedMasterRequiredCount,

        actualSubjects:
          masterRequiredItems.length,

        registeredSubjectNames:
          masterRequiredItems.map(
            (
              item
            ) =>
              item.subjectName
          ),
      },
    });

    return {
      courseKey:
        "child_study_degree",

      canAnalyze:
        false,

      issues,

      summary: {
        masterRequiredSubjects:
          expectedMasterRequiredCount,

        actualMasterRequiredSubjects:
          masterRequiredItems.length,

        requiresMasterReview:
          true,
      },
    };
  }

  const completedMasterItems =
    getCompletedMasterItems({
      masterItems:
        masterRequiredItems,

      recognizedSubjects:
        params.recognizedSubjects,
    });

  const requiredCount =
    CHILD_STUDY_DEGREE_RULE
      .majorRequiredCore
      .minimumRequiredSubjects;

  const completedCount =
    completedMasterItems.length;

  const remainingCount =
    Math.max(
      requiredCount -
        completedCount,
      0
    );

  if (
    remainingCount >
    0
  ) {
    const missingItems =
      getMissingMasterItems({
        masterItems:
          masterRequiredItems,

        recognizedSubjects:
          params.recognizedSubjects,

        requirementType:
          "전공필수",
      });

    issues.push({
      code:
        "CHILD_STUDY_MAJOR_REQUIRED_CORE_SHORTAGE",

      severity:
        "danger",

      title:
        "아동학 전공필수 부족",

           message:
        `아동학 전공필수 마스터 ${expectedMasterRequiredCount}과목 중 최소 ${requiredCount}과목을 이수해야 하며 현재 ${completedCount}과목이 확인되어 ${remainingCount}과목 부족합니다.`,

      details: {
                masterRequiredSubjects:
          expectedMasterRequiredCount,

        requiredSubjects:
          requiredCount,

        completedSubjects:
          completedCount,

        remainingSubjects:
          remainingCount,

        completedSubjectNames:
          completedMasterItems.map(
            (
              item
            ) =>
              item.subjectName
          ),

        missingCandidates:
          missingItems.map(
            (
              item
            ) =>
              item.subjectName
          ),
      },
    });
  }

  return {
    courseKey:
      "child_study_degree",

    canAnalyze:
      true,

    issues,

    summary: {
            masterRequiredSubjects:
        expectedMasterRequiredCount,

      minimumRequiredSubjects:
        requiredCount,

      completedRequiredSubjects:
        completedCount,

      remainingRequiredSubjects:
        remainingCount,
    },
  };
}

function analyzeKoreanTeacher(
  params: {
    masterItems:
      QualificationRiskMasterItem[];

    recognizedSubjects:
      QualificationRecognizedSubject[];
  }
): QualificationRuleAnalysis {
  const issues:
    QualificationRuleIssue[] =
    [];

  const areas: KoreanTeacherArea[] = [
    "area1",
    "area2",
    "area3",
    "area4",
    "area5",
  ];

  const areaLabels:
    Record<KoreanTeacherArea, string> = {
      area1:
        "1영역 한국어학",

      area2:
        "2영역 일반언어학 및 응용언어학",

      area3:
        "3영역 외국어로서의 한국어교육론",

      area4:
        "4영역 한국문화",

      area5:
        "5영역 한국어교육실습",
    };

  /**
   * 한국어교원 영역표에 존재하면서
   * 현재 CRM 과목 마스터에도 실제 존재하는
   * 과목만 자격 판정 대상으로 사용한다.
   */
  const koreanTeacherMasterItems =
    params.masterItems.filter(
      (
        item
      ) =>
        Boolean(
          resolveKoreanTeacherArea(
            item.subjectName
          )
        )
    );

  /**
   * 마스터 과목과 학생 인정과목을
   * 기존 동등과목 판정 기준으로 연결한다.
   */
  const completedKoreanTeacherItems =
    getCompletedMasterItems({
      masterItems:
        koreanTeacherMasterItems,

      recognizedSubjects:
        params.recognizedSubjects,
    });

  /**
   * 같은 과목이 중복으로 잡혀도
   * 자격학점은 한 번만 계산한다.
   */
  const completedUniqueItems =
    Array.from(
      new Map(
        completedKoreanTeacherItems.map(
          (
            item
          ) => [
            getConfirmedSubjectEquivalenceKey(
              item.subjectName
            ) ||
              item.subjectName,
            item,
          ]
        )
      ).values()
    );

  const areaCompletedCredits:
    Record<KoreanTeacherArea, number> = {
      area1:
        0,

      area2:
        0,

      area3:
        0,

      area4:
        0,

      area5:
        0,
    };

  const areaCompletedSubjects:
    Record<
      KoreanTeacherArea,
      string[]
    > = {
      area1:
        [],

      area2:
        [],

      area3:
        [],

      area4:
        [],

      area5:
        [],
    };

  for (
    const item
    of completedUniqueItems
  ) {
    const area =
      resolveKoreanTeacherArea(
        item.subjectName
      );

    if (!area) {
      continue;
    }

    areaCompletedCredits[area] +=
      toNumber(
        item.credits
      );

    areaCompletedSubjects[area].push(
      item.subjectName
    );
  }

  const areaRequiredCredits:
    Record<KoreanTeacherArea, number> = {
      area1:
        KOREAN_TEACHER_2_RULE
          .qualificationCredits
          .area1,

      area2:
        KOREAN_TEACHER_2_RULE
          .qualificationCredits
          .area2,

      area3:
        KOREAN_TEACHER_2_RULE
          .qualificationCredits
          .area3,

      area4:
        KOREAN_TEACHER_2_RULE
          .qualificationCredits
          .area4,

      area5:
        KOREAN_TEACHER_2_RULE
          .qualificationCredits
          .area5,
    };

  const areaRemainingCredits:
    Record<KoreanTeacherArea, number> = {
      area1:
        0,

      area2:
        0,

      area3:
        0,

      area4:
        0,

      area5:
        0,
    };

  /**
   * 영역별 부족학점 검사
   */
  for (
    const area
    of areas
  ) {
    const requiredCredits =
      areaRequiredCredits[area];

    const completedCredits =
      areaCompletedCredits[area];

    const remainingCredits =
      Math.max(
        requiredCredits -
          completedCredits,
        0
      );

    areaRemainingCredits[area] =
      remainingCredits;

    if (
      remainingCredits <=
      0
    ) {
      continue;
    }

    const missingCandidates =
      koreanTeacherMasterItems.filter(
        (
          item
        ) => {
          if (
            resolveKoreanTeacherArea(
              item.subjectName
            ) !==
            area
          ) {
            return false;
          }

          const completedKeySet =
            new Set(
              completedUniqueItems
                .map(
                  (
                    completedItem
                  ) =>
                    getConfirmedSubjectEquivalenceKey(
                      completedItem.subjectName
                    )
                )
                .filter(
                  Boolean
                )
            );

          const itemKey =
            getConfirmedSubjectEquivalenceKey(
              item.subjectName
            );

          return Boolean(
            itemKey &&
              !completedKeySet.has(
                itemKey
              )
          );
        }
      );

    issues.push({
      code:
        `KOREAN_TEACHER_${area.toUpperCase()}_CREDIT_SHORTAGE`,

      severity:
        "danger",

      title:
        `한국어교원 ${areaLabels[area]} 학점 부족`,

      message:
        `한국어교원 2급 ${areaLabels[area]} 기준 ${requiredCredits}학점 중 현재 ${completedCredits}학점이 확인되어 ${remainingCredits}학점 부족합니다.`,

      details: {
        area,

        areaLabel:
          areaLabels[area],

        requiredCredits,

        completedCredits,

        remainingCredits,

        completedSubjectNames:
          areaCompletedSubjects[
            area
          ],

        missingCandidates:
          missingCandidates.map(
            (
              item
            ) =>
              item.subjectName
          ),
      },
    });
  }

  /**
   * 전체 45학점 검사
   */
  const completedQualificationCredits =
    areas.reduce(
      (
        total,
        area
      ) =>
        total +
        areaCompletedCredits[
          area
        ],
      0
    );

  const remainingQualificationCredits =
    Math.max(
      KOREAN_TEACHER_2_RULE
        .qualificationCredits
        .total -
        completedQualificationCredits,
      0
    );

  if (
    remainingQualificationCredits >
    0
  ) {
    issues.push({
      code:
        "KOREAN_TEACHER_TOTAL_CREDIT_SHORTAGE",

      severity:
        "danger",

      title:
        "한국어교원 총 이수학점 부족",

      message:
        `한국어교원 2급 자격기준 총 ${KOREAN_TEACHER_2_RULE.qualificationCredits.total}학점 중 현재 ${completedQualificationCredits}학점이 확인되어 ${remainingQualificationCredits}학점 부족합니다.`,

      details: {
        requiredCredits:
          KOREAN_TEACHER_2_RULE
            .qualificationCredits
            .total,

        completedCredits:
          completedQualificationCredits,

        remainingCredits:
          remainingQualificationCredits,
      },
    });
  }

  /**
   * 학위 전공필수 7과목은
   * 자격 영역학점과 별도로 검사한다.
   */
  const masterRequiredItems =
    params.masterItems.filter(
      (
        item
      ) =>
        item.requirementType ===
        "전공필수"
    );

  const expectedDegreeMajorRequiredCount =
    KOREAN_TEACHER_2_RULE
      .degreeMajorRequiredSubjects;

  /**
   * 한국어교육 학위 전공필수 마스터는
   * 정확히 7과목이어야 한다.
   *
   * 과목명이 아직 규칙 마스터에
   * 고정되어 있지 않으므로
   * DB 마스터 자체가 틀리면
   * 학위 전필 판정을 확정하지 않는다.
   */
  if (
    masterRequiredItems.length !==
    expectedDegreeMajorRequiredCount
  ) {
    issues.push({
      code:
        "KOREAN_TEACHER_DEGREE_REQUIRED_MASTER_INVALID",

      severity:
        "danger",

      title:
        "한국어교육 전공필수 마스터 확인 필요",

      message:
        `한국어교육 학위 전공필수 마스터는 ${expectedDegreeMajorRequiredCount}과목이어야 하나 현재 ${masterRequiredItems.length}과목이 등록되어 있습니다. 과목 마스터를 확인한 뒤 다시 분석해야 합니다.`,

      details: {
        expectedSubjects:
          expectedDegreeMajorRequiredCount,

        actualSubjects:
          masterRequiredItems.length,

        registeredSubjectNames:
          masterRequiredItems.map(
            (
              item
            ) =>
              item.subjectName
          ),
      },
    });

    return {
      courseKey:
        "korean_teacher_2",

      canAnalyze:
        false,

      issues,

      summary: {
        requiredMajorSubjects:
          expectedDegreeMajorRequiredCount,

        actualMajorRequiredSubjects:
          masterRequiredItems.length,

        requiresMasterReview:
          true,
      },
    };
  }

  const completedRequiredItems =
    getCompletedMasterItems({
      masterItems:
        masterRequiredItems,

      recognizedSubjects:
        params.recognizedSubjects,
    });

    const requiredMajorCount =
    expectedDegreeMajorRequiredCount;

  const remainingMajorCount =
    Math.max(
      requiredMajorCount -
        completedRequiredItems.length,
      0
    );

  if (
    remainingMajorCount >
    0
  ) {
    const missingItems =
      getMissingMasterItems({
        masterItems:
          masterRequiredItems,

        recognizedSubjects:
          params.recognizedSubjects,

        requirementType:
          "전공필수",
      });

    issues.push({
      code:
        "KOREAN_TEACHER_DEGREE_REQUIRED_SHORTAGE",

      severity:
        "danger",

      title:
        "한국어교육 전공필수 부족",

      message:
        `한국어교육 학위 전공필수 ${requiredMajorCount}과목 중 현재 ${completedRequiredItems.length}과목이 확인되어 ${remainingMajorCount}과목 부족합니다.`,

      details: {
        requiredSubjects:
          requiredMajorCount,

        completedSubjects:
          completedRequiredItems.length,

        remainingSubjects:
          remainingMajorCount,

        missingCandidates:
          missingItems.map(
            (
              item
            ) =>
              item.subjectName
          ),
      },
    });
  }

  return {
    courseKey:
      "korean_teacher_2",

    canAnalyze:
      true,

    issues,

    summary: {
      qualificationTotalCredits:
        KOREAN_TEACHER_2_RULE
          .qualificationCredits
          .total,

      completedQualificationCredits,

      remainingQualificationCredits,

      areas: {
        area1: {
          requiredCredits:
            areaRequiredCredits.area1,

          completedCredits:
            areaCompletedCredits.area1,

          remainingCredits:
            areaRemainingCredits.area1,
        },

        area2: {
          requiredCredits:
            areaRequiredCredits.area2,

          completedCredits:
            areaCompletedCredits.area2,

          remainingCredits:
            areaRemainingCredits.area2,
        },

        area3: {
          requiredCredits:
            areaRequiredCredits.area3,

          completedCredits:
            areaCompletedCredits.area3,

          remainingCredits:
            areaRemainingCredits.area3,
        },

        area4: {
          requiredCredits:
            areaRequiredCredits.area4,

          completedCredits:
            areaCompletedCredits.area4,

          remainingCredits:
            areaRemainingCredits.area4,
        },

        area5: {
          requiredCredits:
            areaRequiredCredits.area5,

          completedCredits:
            areaCompletedCredits.area5,

          remainingCredits:
            areaRemainingCredits.area5,
        },
      },

      requiredMajorSubjects:
        requiredMajorCount,

      completedMajorSubjects:
        completedRequiredItems.length,

      remainingMajorSubjects:
        remainingMajorCount,
    },
  };
}

function analyzeChildcareTeacher(
  params: {
    masterItems:
      QualificationRiskMasterItem[];

    recognizedSubjects:
      QualificationRecognizedSubject[];
  }
): QualificationRuleAnalysis {
  const issues:
    QualificationRuleIssue[] =
    [];

  /**
   * ─────────────────────────────
   * 1. 보육교사 공식 마스터만 추출
   * ─────────────────────────────
   *
   * 아동학 전체 마스터를 그냥 세지 않는다.
   * 보육교사 공식 17과목 영역에 해당하는
   * 마스터 과목만 자격 판정 대상으로 사용한다.
   */
  const childcareMasterItems =
    params.masterItems.filter(
      (
        item
      ) =>
        Boolean(
          resolveChildcareTeacherArea(
            item.subjectName
          )
        )
    );

  /**
   * 인정과목을 보육교사 마스터와 연결한다.
   */
  const completedMasterItems =
    getCompletedMasterItems({
      masterItems:
        childcareMasterItems,

      recognizedSubjects:
        params.recognizedSubjects,
    });

  /**
   * 같은 과목 또는 공식 동일교과목이
   * 중복으로 들어와도 한 번만 인정한다.
   */
  const completedUniqueItems =
    Array.from(
      new Map(
        completedMasterItems.map(
          (
            item
          ) => [
            getConfirmedSubjectEquivalenceKey(
              item.subjectName
            ) ||
              normalizeChildcareSubjectBaseName(
                item.subjectName
              ),

            item,
          ]
        )
      ).values()
    );

   /**
   * ─────────────────────────────
   * 2. 교사인성 2슬롯
   * ─────────────────────────────
   *
   * 보육교사론 / 보육교사(인성)론은
   * 서로 다른 두 과목으로 세지 않고
   * teacher_theory 하나의 조건으로 처리한다.
   */
  const completedTeacherCharacterSlots =
    new Map<
      ChildcareTeacherCharacterSlotKey,
      QualificationRiskMasterItem
    >();

  for (
    const item
    of completedUniqueItems
  ) {
    const slot =
      resolveChildcareTeacherCharacterSlot(
        item.subjectName
      );

    if (
      slot &&
      !completedTeacherCharacterSlots.has(
        slot
      )
    ) {
      completedTeacherCharacterSlots.set(
        slot,
        item
      );
    }
  }

  const teacherCharacterSlotKeys =
    Object.keys(
      CHILDCARE_TEACHER_CHARACTER_GROUPS
    ) as ChildcareTeacherCharacterSlotKey[];

  const missingTeacherCharacterSlots =
    teacherCharacterSlotKeys.filter(
      (
        slot
      ) =>
        !completedTeacherCharacterSlots.has(
          slot
        )
    );

  const completedTeacherCharacterCount =
    completedTeacherCharacterSlots.size;

  const remainingTeacherCharacter =
    missingTeacherCharacterSlots.length;

  if (
    remainingTeacherCharacter >
    0
  ) {
    issues.push({
      code:
        "CHILDCARE_TEACHER_CHARACTER_SHORTAGE",

      severity:
        "danger",

      title:
        "보육교사 교사인성 영역 부족",

      message:
        `교사인성 ${CHILDCARE_TEACHER_2_RULE.teacherCharacterSubjects}개 조건 중 ${completedTeacherCharacterCount}개가 확인되어 ${remainingTeacherCharacter}개 조건이 부족합니다.`,

      details: {
        requiredSubjects:
          CHILDCARE_TEACHER_2_RULE
            .teacherCharacterSubjects,

        completedSubjects:
          completedTeacherCharacterCount,

        remainingSubjects:
          remainingTeacherCharacter,

        completedSlots:
          Array.from(
            completedTeacherCharacterSlots.keys()
          ),

        completedSubjectNames:
          Array.from(
            completedTeacherCharacterSlots.values()
          ).map(
            (
              item
            ) =>
              item.subjectName
          ),

        missingSlots:
          missingTeacherCharacterSlots,

        missingCandidates:
          missingTeacherCharacterSlots.flatMap(
            (
              slot
            ) =>
              CHILDCARE_TEACHER_CHARACTER_GROUPS[
                slot
              ]
          ),
      },
    });
  }

  /**
   * ─────────────────────────────
   * 3. 보육지식과 기술 필수 9슬롯
   * ─────────────────────────────
   *
   * 아동음악/아동동작/아동미술 등은
   * 여러 개 이수해도 필수 슬롯은 하나만 충족한다.
   */
  const completedRequiredSlots =
    new Map<
      ChildcareRequiredSlotKey,
      QualificationRiskMasterItem
    >();

  for (
    const item
    of completedUniqueItems
  ) {
    const slot =
      resolveChildcareRequiredSlot(
        item.subjectName
      );

    if (
      slot &&
      !completedRequiredSlots.has(
        slot
      )
    ) {
      completedRequiredSlots.set(
        slot,
        item
      );
    }
  }

  const requiredSlotKeys =
    Object.keys(
      CHILDCARE_KNOWLEDGE_REQUIRED_GROUPS
    ) as ChildcareRequiredSlotKey[];

  const missingRequiredSlots =
    requiredSlotKeys.filter(
      (
        slot
      ) =>
        !completedRequiredSlots.has(
          slot
        )
    );

  const completedKnowledgeRequired =
    completedRequiredSlots.size;

  const remainingKnowledgeRequired =
    missingRequiredSlots.length;

  if (
    remainingKnowledgeRequired >
    0
  ) {
    const missingCandidates =
      missingRequiredSlots.flatMap(
        (
          slot
        ) =>
          CHILDCARE_KNOWLEDGE_REQUIRED_GROUPS[
            slot
          ]
      );

    issues.push({
      code:
        "CHILDCARE_KNOWLEDGE_REQUIRED_SHORTAGE",

      severity:
        "danger",

      title:
        "보육지식과 기술 필수영역 부족",

      message:
        `보육지식과 기술 필수 ${CHILDCARE_TEACHER_2_RULE.knowledgeRequiredSubjects}개 조건 중 ${completedKnowledgeRequired}개가 확인되어 ${remainingKnowledgeRequired}개 조건이 부족합니다.`,

      details: {
        requiredSubjects:
          CHILDCARE_TEACHER_2_RULE
            .knowledgeRequiredSubjects,

        completedSubjects:
          completedKnowledgeRequired,

        remainingSubjects:
          remainingKnowledgeRequired,

        completedSlots:
          Array.from(
            completedRequiredSlots.keys()
          ),

        missingSlots:
          missingRequiredSlots,

        missingCandidates,
      },
    });
  }

  /**
   * ─────────────────────────────
   * 4. 보육지식과 기술 선택 4과목
   * ─────────────────────────────
   */
  const completedKnowledgeElective =
    completedUniqueItems.filter(
      (
        item
      ) =>
        resolveChildcareTeacherArea(
          item.subjectName
        ) ===
        "knowledge_elective"
    );

  const remainingKnowledgeElective =
    Math.max(
      CHILDCARE_TEACHER_2_RULE
        .knowledgeElectiveSubjects -
        completedKnowledgeElective.length,
      0
    );

  if (
    remainingKnowledgeElective >
    0
  ) {
    const completedKeys =
      new Set(
        completedKnowledgeElective.map(
          (
            item
          ) =>
            normalizeChildcareSubjectBaseName(
              item.subjectName
            )
        )
      );

    const missingCandidates =
      childcareMasterItems
        .filter(
          (
            item
          ) =>
            resolveChildcareTeacherArea(
              item.subjectName
            ) ===
              "knowledge_elective" &&
            !completedKeys.has(
              normalizeChildcareSubjectBaseName(
                item.subjectName
              )
            )
        )
        .map(
          (
            item
          ) =>
            item.subjectName
        );

    issues.push({
      code:
        "CHILDCARE_KNOWLEDGE_ELECTIVE_SHORTAGE",

      severity:
        "danger",

      title:
        "보육지식과 기술 선택영역 부족",

      message:
        `보육지식과 기술 선택 ${CHILDCARE_TEACHER_2_RULE.knowledgeElectiveSubjects}과목 이상이 필요하며 현재 ${completedKnowledgeElective.length}과목이 확인되어 ${remainingKnowledgeElective}과목 부족합니다.`,

      details: {
        requiredSubjects:
          CHILDCARE_TEACHER_2_RULE
            .knowledgeElectiveSubjects,

        completedSubjects:
          completedKnowledgeElective.length,

        remainingSubjects:
          remainingKnowledgeElective,

        completedSubjectNames:
          completedKnowledgeElective.map(
            (
              item
            ) =>
              item.subjectName
          ),

        missingCandidates,
      },
    });
  }

  /**
   * ─────────────────────────────
   * 5. 보육실무 2과목
   * ─────────────────────────────
   *
   * 아동관찰 및 행동연구
   * 보육실습
   */
  const completedPracticeSlots =
    new Map<
      ChildcarePracticeSlotKey,
      QualificationRiskMasterItem
    >();

  for (
    const item
    of completedUniqueItems
  ) {
    const slot =
      resolveChildcarePracticeSlot(
        item.subjectName
      );

    if (
      slot &&
      !completedPracticeSlots.has(
        slot
      )
    ) {
      completedPracticeSlots.set(
        slot,
        item
      );
    }
  }

  const practiceSlotKeys =
    Object.keys(
      CHILDCARE_PRACTICE_GROUPS
    ) as ChildcarePracticeSlotKey[];

  const missingPracticeSlots =
    practiceSlotKeys.filter(
      (
        slot
      ) =>
        !completedPracticeSlots.has(
          slot
        )
    );

  const remainingPracticeSubjects =
    missingPracticeSlots.length;

  if (
    remainingPracticeSubjects >
    0
  ) {
    issues.push({
      code:
        "CHILDCARE_PRACTICE_AREA_SHORTAGE",

      severity:
        "danger",

      title:
        "보육실무 영역 부족",

      message:
        `보육실무 ${CHILDCARE_TEACHER_2_RULE.practiceSubjects}과목 중 ${completedPracticeSlots.size}과목이 확인되어 ${remainingPracticeSubjects}과목 부족합니다.`,

      details: {
        requiredSubjects:
          CHILDCARE_TEACHER_2_RULE
            .practiceSubjects,

        completedSubjects:
          completedPracticeSlots.size,

        remainingSubjects:
          remainingPracticeSubjects,

        completedSlots:
          Array.from(
            completedPracticeSlots.keys()
          ),

        missingSlots:
          missingPracticeSlots,

        missingCandidates:
          missingPracticeSlots.flatMap(
            (
              slot
            ) =>
              CHILDCARE_PRACTICE_GROUPS[
                slot
              ]
          ),
      },
    });
  }

  /**
   * 보육실습 자체는 별도 표시한다.
   */
  const hasChildcarePractice =
    completedPracticeSlots.has(
      "practice"
    );

  if (!hasChildcarePractice) {
    issues.push({
      code:
        "CHILDCARE_PRACTICE_MISSING",

      severity:
        "danger",

      title:
        "보육실습 미이수",

      message:
        `보육실습 과목과 ${CHILDCARE_TEACHER_2_RULE.practiceHours}시간 실습요건 확인이 필요합니다.`,

      details: {
        practiceHours:
          CHILDCARE_TEACHER_2_RULE
            .practiceHours,

        practiceWeeks:
          CHILDCARE_TEACHER_2_RULE
            .practiceWeeks,
      },
    });
  }

  /**
   * ─────────────────────────────
   * 6. 대면수업 8개 조건
   * ─────────────────────────────
   *
   * 중요:
   * 보육실습은 대면수업 8과목에 포함하지 않는다.
   */
  const completedFaceToFaceSlots =
    new Map<
      string,
      QualificationRiskMasterItem
    >();

  for (
    const item
    of completedUniqueItems
  ) {
    /**
     * 현재 CRM에서는 "(대면)" 표시가 있는
     * 마스터 과목을 대면 이수로 확인한다.
     */
    if (
      !isFaceToFaceMasterSubject(
        item.subjectName
      )
    ) {
      continue;
    }

    const slot =
      resolveChildcareFaceToFaceSlot(
        item.subjectName
      );

    if (
      slot &&
      !completedFaceToFaceSlots.has(
        slot
      )
    ) {
      completedFaceToFaceSlots.set(
        slot,
        item
      );
    }
  }

  const faceToFaceSlotKeys =
    Object.keys(
      CHILDCARE_FACE_TO_FACE_GROUPS
    );

  const missingFaceToFaceSlots =
    faceToFaceSlotKeys.filter(
      (
        slot
      ) =>
        !completedFaceToFaceSlots.has(
          slot
        )
    );

  const completedFaceToFaceCount =
    completedFaceToFaceSlots.size;

  const remainingFaceToFaceCount =
    missingFaceToFaceSlots.length;

  if (
    remainingFaceToFaceCount >
    0
  ) {
    issues.push({
      code:
        "CHILDCARE_FACE_TO_FACE_SHORTAGE",

      severity:
        "danger",

      title:
        "보육교사 대면수업 부족",

      message:
        `대면수업 ${CHILDCARE_TEACHER_2_RULE.requiredFaceToFaceSubjects}개 조건 중 ${completedFaceToFaceCount}개가 확인되어 ${remainingFaceToFaceCount}개 조건이 부족합니다.`,

      details: {
        requiredSubjects:
          CHILDCARE_TEACHER_2_RULE
            .requiredFaceToFaceSubjects,

        completedSubjects:
          completedFaceToFaceCount,

        remainingSubjects:
          remainingFaceToFaceCount,

        completedSlots:
          Array.from(
            completedFaceToFaceSlots.keys()
          ),

        missingSlots:
          missingFaceToFaceSlots,

        missingCandidates:
          missingFaceToFaceSlots.flatMap(
            (
              slot
            ) =>
              (
                CHILDCARE_FACE_TO_FACE_GROUPS as
                  Record<
                    string,
                    readonly string[]
                  >
              )[slot] || []
          ),
      },
    });
  }

  /**
   * ─────────────────────────────
   * 7. 최종 17과목 계산
   * ─────────────────────────────
   *
   * 영역을 전부 충족시키면
   * 2 + 9 + 4 + 2 = 17.
   *
   * 총과목을 별도로 아무 과목이나 세지 않고
   * 공식 영역 인정과목만 계산한다.
   */
  const completedQualificationSubjects =
  completedTeacherCharacterCount +
    completedKnowledgeRequired +
    Math.min(
      completedKnowledgeElective.length,
      CHILDCARE_TEACHER_2_RULE
        .knowledgeElectiveSubjects
    ) +
    completedPracticeSlots.size;

  const remainingQualificationSubjects =
    remainingTeacherCharacter +
    remainingKnowledgeRequired +
    remainingKnowledgeElective +
    remainingPracticeSubjects;

  /**
   * 자격으로 실제 인정된 과목들의 학점.
   *
   * 필수 선택군에서 같은 슬롯을 여러 과목 들은 경우
   * 한 과목만 자격 필수로 계산한다.
   */
  const qualificationItems =
    [
  ...Array.from(
    completedTeacherCharacterSlots.values()
  ),

  ...Array.from(
        completedRequiredSlots.values()
      ),

      ...completedKnowledgeElective.slice(
        0,
        CHILDCARE_TEACHER_2_RULE
          .knowledgeElectiveSubjects
      ),

      ...Array.from(
        completedPracticeSlots.values()
      ),
    ];

  const qualificationUniqueItems =
    Array.from(
      new Map(
        qualificationItems.map(
          (
            item
          ) => [
            getConfirmedSubjectEquivalenceKey(
              item.subjectName
            ) ||
              normalizeChildcareSubjectBaseName(
                item.subjectName
              ),

            item,
          ]
        )
      ).values()
    );

  const completedQualificationCredits =
    qualificationUniqueItems.reduce(
      (
        total,
        item
      ) =>
        total +
        toNumber(
          item.credits
        ),
      0
    );

  const remainingQualificationCredits =
    Math.max(
      CHILDCARE_TEACHER_2_RULE
        .totalCredits -
        completedQualificationCredits,
      0
    );

  if (
    remainingQualificationCredits >
    0
  ) {
    issues.push({
      code:
        "CHILDCARE_TOTAL_CREDIT_SHORTAGE",

      severity:
        "danger",

      title:
        "보육교사 이수학점 부족",

      message:
        `보육교사 2급 ${CHILDCARE_TEACHER_2_RULE.totalCredits}학점 기준 중 현재 ${completedQualificationCredits}학점이 확인되어 ${remainingQualificationCredits}학점 부족합니다.`,

      details: {
        requiredCredits:
          CHILDCARE_TEACHER_2_RULE
            .totalCredits,

        completedCredits:
          completedQualificationCredits,

        remainingCredits:
          remainingQualificationCredits,
      },
    });
  }

  /**
   * ─────────────────────────────
   * 8. 아동전공 학위 전공필수 핵심조건
   * ─────────────────────────────
   *
   * 보육교사 2급은 자격과목 17과목만
   * 충족하면 끝나는 것이 아니라
   * 아동·보육 관련 학위요건도 함께
   * 충족해야 한다.
   *
   * CRM 아동학 전공필수 마스터 7과목 중
   * 최소 5과목을 이수해야 한다.
   *
   * 이 5과목은 17과목에 추가되는
   * 별도 5과목이라는 뜻이 아니다.
   *
   * 17과목 안에서 해당 전공필수 과목을
   * 이미 이수했다면 동시에 충족된다.
   */
  const childcareDegreeMajorRequiredItems =
    params.masterItems.filter(
      (
        item
      ) =>
        item.requirementType ===
        "전공필수"
    );

  const expectedChildcareDegreeMajorRequiredCount =
    CHILD_STUDY_DEGREE_RULE
      .majorRequiredCore
      .masterRequiredSubjects;

  /**
   * 보육교사 학위요건에 사용하는
   * 아동전공 전공필수 마스터도
   * 정확히 7과목이어야 한다.
   *
   * 아동학사 분석과 동일하게
   * 마스터 자체가 잘못된 상태에서는
   * 학생의 학위 전필 충족여부를
   * 확정하지 않는다.
   */
  if (
    childcareDegreeMajorRequiredItems.length !==
    expectedChildcareDegreeMajorRequiredCount
  ) {
    issues.push({
      code:
        "CHILDCARE_DEGREE_MAJOR_REQUIRED_MASTER_INVALID",

      severity:
        "danger",

      title:
        "보육교사 아동전공 필수 마스터 확인 필요",

      message:
        `보육교사 학위요건에 사용하는 아동전공 전공필수 마스터는 ${expectedChildcareDegreeMajorRequiredCount}과목이어야 하나 현재 ${childcareDegreeMajorRequiredItems.length}과목이 등록되어 있습니다. 과목 마스터를 확인한 뒤 다시 분석해야 합니다.`,

      details: {
        expectedSubjects:
          expectedChildcareDegreeMajorRequiredCount,

        actualSubjects:
          childcareDegreeMajorRequiredItems.length,

        registeredSubjectNames:
          childcareDegreeMajorRequiredItems.map(
            (
              item
            ) =>
              item.subjectName
          ),
      },
    });

    return {
      courseKey:
        "childcare_teacher_2",

      canAnalyze:
        false,

      issues,

      summary: {
        requiredSubjects:
          CHILDCARE_TEACHER_2_RULE
            .totalSubjects,

        requiredCredits:
          CHILDCARE_TEACHER_2_RULE
            .totalCredits,

        masterRequiredSubjects:
          expectedChildcareDegreeMajorRequiredCount,

        actualMasterRequiredSubjects:
          childcareDegreeMajorRequiredItems.length,

        requiresMasterReview:
          true,
      },
    };
  }

  const completedChildcareDegreeMajorRequiredItems =
    getCompletedMasterItems({
      masterItems:
        childcareDegreeMajorRequiredItems,

      recognizedSubjects:
        params.recognizedSubjects,
    });

  const requiredChildcareDegreeMajorCount =
    CHILD_STUDY_DEGREE_RULE
      .majorRequiredCore
      .minimumRequiredSubjects;

  const completedChildcareDegreeMajorCount =
    completedChildcareDegreeMajorRequiredItems
      .length;

  const remainingChildcareDegreeMajorCount =
    Math.max(
      requiredChildcareDegreeMajorCount -
        completedChildcareDegreeMajorCount,
      0
    );

  if (
    remainingChildcareDegreeMajorCount >
    0
  ) {
    const missingChildcareDegreeMajorItems =
      getMissingMasterItems({
        masterItems:
          childcareDegreeMajorRequiredItems,

        recognizedSubjects:
          params.recognizedSubjects,

        requirementType:
          "전공필수",
      });

    issues.push({
      code:
        "CHILDCARE_DEGREE_MAJOR_REQUIRED_CORE_SHORTAGE",

      severity:
        "danger",

      title:
        "보육교사 아동전공 필수과목 부족",

            message:
        `아동전공 학위 전공필수 마스터 ${expectedChildcareDegreeMajorRequiredCount}과목 중 최소 ${requiredChildcareDegreeMajorCount}과목을 이수해야 하며 현재 ${completedChildcareDegreeMajorCount}과목이 확인되어 ${remainingChildcareDegreeMajorCount}과목 부족합니다.`,

      details: {
                masterRequiredSubjects:
          expectedChildcareDegreeMajorRequiredCount,

        requiredSubjects:
          requiredChildcareDegreeMajorCount,

        completedSubjects:
          completedChildcareDegreeMajorCount,

        remainingSubjects:
          remainingChildcareDegreeMajorCount,

        completedSubjectNames:
          completedChildcareDegreeMajorRequiredItems.map(
            (
              item
            ) =>
              item.subjectName
          ),

        missingCandidates:
          missingChildcareDegreeMajorItems.map(
            (
              item
            ) =>
              item.subjectName
          ),
      },
    });
  }

  /**
   * ─────────────────────────────
   * 9. 최종 결과
   * ─────────────────────────────
   */
  return {
    courseKey:
      "childcare_teacher_2",

    canAnalyze:
      true,

    issues,

    summary: {
      requiredSubjects:
        CHILDCARE_TEACHER_2_RULE
          .totalSubjects,

      requiredCredits:
        CHILDCARE_TEACHER_2_RULE
          .totalCredits,

      completedSubjects:
        completedQualificationSubjects,

      completedCredits:
        completedQualificationCredits,

      remainingSubjects:
        remainingQualificationSubjects,

      remainingCredits:
        remainingQualificationCredits,

      areas: {
        teacherCharacter: {
  requiredSubjects:
    CHILDCARE_TEACHER_2_RULE
      .teacherCharacterSubjects,

  completedSubjects:
    completedTeacherCharacterCount,

  remainingSubjects:
    remainingTeacherCharacter,

  completedSlots:
    Array.from(
      completedTeacherCharacterSlots.keys()
    ),

  completedSubjectNames:
    Array.from(
      completedTeacherCharacterSlots.values()
    ).map(
      (
        item
      ) =>
        item.subjectName
    ),

  missingSlots:
    missingTeacherCharacterSlots,
},

        knowledgeRequired: {
          requiredSubjects:
            CHILDCARE_TEACHER_2_RULE
              .knowledgeRequiredSubjects,

          completedSubjects:
            completedKnowledgeRequired,

          remainingSubjects:
            remainingKnowledgeRequired,

          completedSlots:
            Array.from(
              completedRequiredSlots.keys()
            ),

          missingSlots:
            missingRequiredSlots,
        },

        knowledgeElective: {
          requiredSubjects:
            CHILDCARE_TEACHER_2_RULE
              .knowledgeElectiveSubjects,

          completedSubjects:
            completedKnowledgeElective.length,

          remainingSubjects:
            remainingKnowledgeElective,

          completedSubjectNames:
            completedKnowledgeElective.map(
              (
                item
              ) =>
                item.subjectName
            ),
        },

        practice: {
          requiredSubjects:
            CHILDCARE_TEACHER_2_RULE
              .practiceSubjects,

          completedSubjects:
            completedPracticeSlots.size,

          remainingSubjects:
            remainingPracticeSubjects,

          hasChildcarePractice,

          practiceHours:
            CHILDCARE_TEACHER_2_RULE
              .practiceHours,

          practiceWeeks:
            CHILDCARE_TEACHER_2_RULE
              .practiceWeeks,
        },
      },

      faceToFace: {
        requiredSubjects:
          CHILDCARE_TEACHER_2_RULE
            .requiredFaceToFaceSubjects,

        completedSubjects:
          completedFaceToFaceCount,

        remainingSubjects:
          remainingFaceToFaceCount,

        completedSlots:
          Array.from(
            completedFaceToFaceSlots.keys()
          ),

        missingSlots:
          missingFaceToFaceSlots,
      },
    /**
       * 아동전공 학위 전공필수 핵심조건.
       *
       * 자격과목 17과목과 별도 추가과목으로
       * 합산하지 않고 동시에 충족 가능한
       * 학위조건으로 관리한다.
       */
            degreeMajorRequiredCore: {
        masterRequiredSubjects:
          expectedChildcareDegreeMajorRequiredCount,

        requiredSubjects:
          requiredChildcareDegreeMajorCount,

        completedSubjects:
          completedChildcareDegreeMajorCount,

        remainingSubjects:
          remainingChildcareDegreeMajorCount,

        completedSubjectNames:
          completedChildcareDegreeMajorRequiredItems.map(
            (
              item
            ) =>
              item.subjectName
          ),
      },
    },
  };
}

function analyzeLifelongEducator(
  params: {
    masterItems:
      QualificationRiskMasterItem[];

    recognizedSubjects:
      QualificationRecognizedSubject[];
  }
): QualificationRuleAnalysis {
  const issues:
    QualificationRuleIssue[] =
    [];

  const recognizedKeys =
    createRecognizedKeySet(
      params.recognizedSubjects
    );

  const requiredMasterItems =
    params.masterItems.filter(
      (
        item
      ) => {
        const itemKey =
          getConfirmedSubjectEquivalenceKey(
            item.subjectName
          );

        return (
          itemKey &&
          LIFELONG_EDUCATOR_REQUIRED_SUBJECTS.some(
            (
              subjectName
            ) =>
              getConfirmedSubjectEquivalenceKey(
                subjectName
              ) ===
              itemKey
          )
        );
      }
    );

  const completedRequiredItems =
    requiredMasterItems.filter(
      (
        item
      ) =>
        recognizedKeys.has(
          getConfirmedSubjectEquivalenceKey(
            item.subjectName
          )
        )
    );

  const electiveMasterItems =
    params.masterItems.filter(
      (
        item
      ) =>
        item.requirementType ===
        "전공선택"
    );

  const completedElectiveItems =
    electiveMasterItems.filter(
      (
        item
      ) =>
        recognizedKeys.has(
          getConfirmedSubjectEquivalenceKey(
            item.subjectName
          )
        )
    );

  const completedRequiredCount =
    completedRequiredItems.length;

  const completedElectiveCount =
    completedElectiveItems.length;

  const completedRequiredCredits =
    completedRequiredItems.reduce(
      (
        total,
        item
      ) =>
        total +
        toNumber(
          item.credits
        ),
      0
    );

  const completedElectiveCredits =
    completedElectiveItems.reduce(
      (
        total,
        item
      ) =>
        total +
        toNumber(
          item.credits
        ),
      0
    );

  const completedTotalSubjects =
    completedRequiredCount +
    completedElectiveCount;

  const completedTotalCredits =
    completedRequiredCredits +
    completedElectiveCredits;

const remainingRequiredCredits =
  Math.max(
    LIFELONG_EDUCATOR_2_RULE
      .requiredCredits -
      completedRequiredCredits,
    0
  );

const remainingElectiveCredits =
  Math.max(
    LIFELONG_EDUCATOR_2_RULE
      .electiveCredits -
      completedElectiveCredits,
    0
  );

  const remainingRequiredSubjects =
    Math.max(
      LIFELONG_EDUCATOR_2_RULE
        .requiredSubjects -
        completedRequiredCount,
      0
    );

  const remainingElectiveSubjects =
    Math.max(
      LIFELONG_EDUCATOR_2_RULE
        .electiveSubjects -
        completedElectiveCount,
      0
    );

  const remainingTotalSubjects =
    Math.max(
      LIFELONG_EDUCATOR_2_RULE
        .totalSubjects -
        completedTotalSubjects,
      0
    );

  const remainingTotalCredits =
    Math.max(
      LIFELONG_EDUCATOR_2_RULE
        .totalCredits -
        completedTotalCredits,
      0
    );

if (
  remainingRequiredCredits >
  0
) {
  issues.push({
    code:
      "LIFELONG_EDUCATOR_REQUIRED_CREDIT_SHORTAGE",

    severity:
      "danger",

    title:
      "평생교육사 필수학점 부족",

    message:
      `평생교육사 2급 필수 ${LIFELONG_EDUCATOR_2_RULE.requiredCredits}학점 중 현재 ${completedRequiredCredits}학점이 확인되어 ${remainingRequiredCredits}학점 부족합니다.`,

    details: {
      requiredCredits:
        LIFELONG_EDUCATOR_2_RULE
          .requiredCredits,

      completedCredits:
        completedRequiredCredits,

      remainingCredits:
        remainingRequiredCredits,
    },
  });
}

if (
  remainingElectiveCredits >
  0
) {
  issues.push({
    code:
      "LIFELONG_EDUCATOR_ELECTIVE_CREDIT_SHORTAGE",

    severity:
      "danger",

    title:
      "평생교육사 선택학점 부족",

    message:
      `평생교육사 2급 선택 ${LIFELONG_EDUCATOR_2_RULE.electiveCredits}학점 중 현재 ${completedElectiveCredits}학점이 확인되어 ${remainingElectiveCredits}학점 부족합니다.`,

    details: {
      requiredCredits:
        LIFELONG_EDUCATOR_2_RULE
          .electiveCredits,

      completedCredits:
        completedElectiveCredits,

      remainingCredits:
        remainingElectiveCredits,
    },
  });
}

  if (
    remainingRequiredSubjects >
    0
  ) {
    const missingRequired =
      requiredMasterItems.filter(
        (
          item
        ) =>
          !recognizedKeys.has(
            getConfirmedSubjectEquivalenceKey(
              item.subjectName
            )
          )
      );

    issues.push({
      code:
        "LIFELONG_EDUCATOR_REQUIRED_SUBJECT_SHORTAGE",

      severity:
        "danger",

      title:
        "평생교육사 필수과목 부족",

      message:
        `평생교육사 2급 필수 ${LIFELONG_EDUCATOR_2_RULE.requiredSubjects}과목 중 현재 ${completedRequiredCount}과목이 확인되어 ${remainingRequiredSubjects}과목 부족합니다.`,

      details: {
        requiredSubjects:
          LIFELONG_EDUCATOR_2_RULE
            .requiredSubjects,

        completedSubjects:
          completedRequiredCount,

        remainingSubjects:
          remainingRequiredSubjects,

        missingCandidates:
          missingRequired.map(
            (
              item
            ) =>
              item.subjectName
          ),
      },
    });
  }

  if (
    remainingElectiveSubjects >
    0
  ) {
    const missingElective =
      electiveMasterItems.filter(
        (
          item
        ) =>
          !recognizedKeys.has(
            getConfirmedSubjectEquivalenceKey(
              item.subjectName
            )
          )
      );

    issues.push({
      code:
        "LIFELONG_EDUCATOR_ELECTIVE_SUBJECT_SHORTAGE",

      severity:
        "danger",

      title:
        "평생교육사 선택과목 부족",

      message:
        `평생교육사 2급 선택 ${LIFELONG_EDUCATOR_2_RULE.electiveSubjects}과목 중 현재 ${completedElectiveCount}과목이 확인되어 ${remainingElectiveSubjects}과목 부족합니다.`,

      details: {
        requiredSubjects:
          LIFELONG_EDUCATOR_2_RULE
            .electiveSubjects,

        completedSubjects:
          completedElectiveCount,

        remainingSubjects:
          remainingElectiveSubjects,

        missingCandidates:
          missingElective.map(
            (
              item
            ) =>
              item.subjectName
          ),
      },
    });
  }

  if (
    remainingTotalCredits >
    0
  ) {
    issues.push({
      code:
        "LIFELONG_EDUCATOR_TOTAL_CREDIT_SHORTAGE",

      severity:
        "danger",

      title:
        "평생교육사 총 이수학점 부족",

      message:
        `평생교육사 2급 기준 ${LIFELONG_EDUCATOR_2_RULE.totalCredits}학점 중 현재 ${completedTotalCredits}학점이 확인되어 ${remainingTotalCredits}학점 부족합니다.`,

      details: {
        requiredCredits:
          LIFELONG_EDUCATOR_2_RULE
            .totalCredits,

        completedCredits:
          completedTotalCredits,

        remainingCredits:
          remainingTotalCredits,
      },
    });
  }

  const hasPractice =
    completedRequiredItems.some(
      (
        item
      ) =>
        getConfirmedSubjectEquivalenceKey(
          item.subjectName
        ) ===
        getConfirmedSubjectEquivalenceKey(
          "평생교육실습"
        )
    );

  if (!hasPractice) {
    issues.push({
      code:
        "LIFELONG_EDUCATOR_PRACTICE_MISSING",

      severity:
        "danger",

      title:
        "평생교육실습 미이수",

      message:
        "평생교육사 2급 필수과목인 평생교육실습이 확인되지 않았습니다.",
    });
  }

  return {
    courseKey:
      "lifelong_educator_2",

    canAnalyze:
      true,

    issues,

    summary: {
      requiredSubjects:
        LIFELONG_EDUCATOR_2_RULE
          .requiredSubjects,

      electiveSubjects:
        LIFELONG_EDUCATOR_2_RULE
          .electiveSubjects,

      totalSubjects:
        LIFELONG_EDUCATOR_2_RULE
          .totalSubjects,

      totalCredits:
        LIFELONG_EDUCATOR_2_RULE
          .totalCredits,

      completedRequiredSubjects:
        completedRequiredCount,

      completedElectiveSubjects:
        completedElectiveCount,

      completedTotalSubjects,

completedTotalCredits,

completedRequiredCredits,

completedElectiveCredits,

remainingRequiredCredits,

remainingElectiveCredits,

remainingRequiredSubjects,

      remainingElectiveSubjects,

      remainingTotalSubjects,

      remainingTotalCredits,

      hasPractice,
    },
  };
}

export function analyzeQualificationRisk(
  params: {
    courseName:
      unknown;

    masterItems:
      any[];

    recognizedSubjects:
      QualificationRecognizedSubject[];

    /**
     * 학생정보요약에 추후 추가할
     * 구법/신법 체크값을 그대로 넣는다.
     */
    socialWorkerLawVersion?:
      unknown;
  }
): QualificationRuleAnalysis {
  const courseKey =
    resolveQualificationRiskCourseKey(
      params.courseName
    );

  const masterItems =
    normalizeMasterItems(
      params.masterItems ||
      []
    );

  if (
    courseKey ===
    "social_worker_2"
  ) {
    return analyzeSocialWorker({
      masterItems,

      recognizedSubjects:
        params.recognizedSubjects,

      socialWorkerLawVersion:
        params.socialWorkerLawVersion,
    });
  }

  if (
    courseKey ===
    "childcare_teacher_2"
  ) {
    return analyzeChildcareTeacher({
      masterItems,

      recognizedSubjects:
        params.recognizedSubjects,
    });
  }

  if (
    courseKey ===
    "child_study_degree"
  ) {
    return analyzeChildStudyDegree({
      masterItems,

      recognizedSubjects:
        params.recognizedSubjects,
    });
  }

  if (
    courseKey ===
    "korean_teacher_2"
  ) {
    return analyzeKoreanTeacher({
      masterItems,

      recognizedSubjects:
        params.recognizedSubjects,
    });
  }

  if (
  courseKey ===
  "lifelong_educator_2"
) {
  return analyzeLifelongEducator({
    masterItems,

    recognizedSubjects:
      params.recognizedSubjects,
  });
}

  return {
    courseKey:
      "unknown",

    canAnalyze:
      false,

    issues: [],

    summary: {},
  };
}