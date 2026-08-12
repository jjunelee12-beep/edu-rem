import type {
  UnifiedQualificationRequirements,
} from "./qualification-requirement-merger";

import type {
  QualificationRiskMasterItem,
  QualificationRecognizedSubject,
} from "./qualification-risk-analyzer";

import {
  resolveChildcareTeacherCharacterSlot,
  resolveChildcareRequiredSlot,
  resolveChildcarePracticeSlot,
  resolveChildcareFaceToFaceSlot,
  resolveKoreanTeacherArea,
  type ChildcareTeacherCharacterSlotKey,
  type ChildcareRequiredSlotKey,
  type ChildcarePracticeSlotKey,
  type KoreanTeacherArea,
} from "./risk-rule-master";

import {
  getConfirmedSubjectEquivalenceKey,
} from "./subject-equivalence-resolver";

export type QualificationPlannedSubjectReason =
  | "qualification_required"
  | "qualification_elective"
  | "qualification_area"
  | "face_to_face"
  | "practice"
  | "degree_major_required"
  | "degree_major_credit"
  | "degree_liberal_credit"
  | "degree_total_credit";

export type QualificationPlannedSubject = {
    /**
   * 이 과목이 어디에서 선택됐는지 구분한다.
   *
   * qualification_master:
   * subject_catalog_items
   *
   * degree_template:
   * course_subject_templates
   */
  source:
    | "qualification_master"
    | "degree_template";

  /**
   * source === qualification_master 일 때
   * subject_catalog_items.id
   */
  masterItemId:
    number | null;

  /**
   * source === qualification_master 일 때
   * subject_catalog_items.catalogId
   */
  catalogId:
    number | null;

  /**
   * source === degree_template 일 때
   * course_subject_templates.id
   */
  templateId:
    number | null;

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

  reasons:
    QualificationPlannedSubjectReason[];

  /**
   * 한 과목이 여러 법적 조건을
   * 동시에 만족하는 경우 기록한다.
   */
  satisfies: {
    qualification:
      boolean;

    degreeMajor:
      boolean;

    faceToFace:
      boolean;

    practice:
      boolean;

    slot:
      string | null;

    area:
      string | null;
  };
};

export type DegreeFillTemplateItem = {
  id:
    number;

  courseKey:
    string;

  subjectName:
    string;

  category:
    "전공" |
    "교양" |
    "일반";

  requirementType:
    "전공필수" |
    "전공선택" |
    "교양" |
    "일반" |
    null;

  sortOrder:
    number;
};

export type QualificationSubjectPlannerResult = {
  canPlan:
    boolean;

  courseKey:
    UnifiedQualificationRequirements["courseKey"];

  selectedSubjects:
    QualificationPlannedSubject[];

  selectedSubjectCount:
    number;

  selectedCredits:
    number;

  /**
   * 자격과목을 선택한 뒤
   * 학위 부족학점에서 얼마나 같이
   * 해결되는지 계산한 예상값.
   */
  projectedDegree: {
    remainingTotalCredits:
      number | null;

    remainingMajorCredits:
      number | null;

    remainingLiberalCredits:
      number | null;
  };

  /**
   * 자격 필수과목 선택 후에도
   * 학위를 위해 별도로 채워야 하는 부분.
   *
   * 아직 임의의 교양/일반 과목을
   * 만들어내지 않는다.
   */
  degreeFillRemaining: {
    totalCredits:
      number;

    majorCredits:
      number;

    liberalCredits:
      number;

    requiresAdditionalDegreeSubjects:
      boolean;
  };

  unresolvedRequirements:
    Array<{
      code:
        string;

      message:
        string;
    }>;

  warnings:
    string[];
};

function toNumber(
  value:
    unknown
) {
  const normalized =
    Number(
      value
    );

  return Number.isFinite(
    normalized
  )
    ? normalized
    : 0;
}

function getRecord(
  value:
    unknown
): Record<string, unknown> {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return {};
  }

  return value as
    Record<string, unknown>;
}

function getStringArray(
  value:
    unknown
): string[] {
  if (
    !Array.isArray(
      value
    )
  ) {
    return [];
  }

  return value
    .map(
      (
        item
      ) =>
        String(
          item ??
          ""
        ).trim()
    )
    .filter(
      Boolean
    );
}

function createRecognizedKeySet(
  recognizedSubjects:
    QualificationRecognizedSubject[]
) {
  return new Set(
    (
      recognizedSubjects ||
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

function getMasterKey(
  item:
    QualificationRiskMasterItem
) {
  return (
    getConfirmedSubjectEquivalenceKey(
      item.subjectName
    ) ||
    `master:${item.id}`
  );
}

function uniqueMasterItems(
  items:
    QualificationRiskMasterItem[]
) {
  return Array.from(
    new Map(
      items.map(
        (
          item
        ) => [
          getMasterKey(
            item
          ),
          item,
        ]
      )
    ).values()
  );
}

function findMasterItemsByNames(
  masterItems:
    QualificationRiskMasterItem[],
  candidateNames:
    string[]
) {
  const candidateKeys =
    new Set(
      candidateNames
        .map(
          (
            name
          ) =>
            getConfirmedSubjectEquivalenceKey(
              name
            )
        )
        .filter(
          Boolean
        )
    );

  return uniqueMasterItems(
    masterItems.filter(
      (
        item
      ) => {
        const key =
          getConfirmedSubjectEquivalenceKey(
            item.subjectName
          );

        return Boolean(
          key &&
          candidateKeys.has(
            key
          )
        );
      }
    )
  );
}

function isAlreadyRecognized(
  item:
    QualificationRiskMasterItem,
  recognizedKeys:
    Set<string>
) {
  const key =
    getConfirmedSubjectEquivalenceKey(
      item.subjectName
    );

  return Boolean(
    key &&
    recognizedKeys.has(
      key
    )
  );
}

function addReason(
  reasons:
    QualificationPlannedSubjectReason[],
  reason:
    QualificationPlannedSubjectReason
) {
  if (
    !reasons.includes(
      reason
    )
  ) {
    reasons.push(
      reason
    );
  }
}

function buildPlannedSubject(
  item:
    QualificationRiskMasterItem
): QualificationPlannedSubject {
  return {
  source:
    "qualification_master",

  masterItemId:
    item.id,

  catalogId:
    item.catalogId,

  templateId:
    null,

  subjectName:
      item.subjectName,

    requirementType:
      item.requirementType,

    category:
      item.category,

    credits:
      toNumber(
        item.credits
      ),

    isFaceToFace:
      Boolean(
        item.isFaceToFace
      ),

    reasons:
      [],

    satisfies: {
      qualification:
        false,

      degreeMajor:
        item.requirementType ===
        "전공필수" ||
        item.requirementType ===
        "전공선택",

      faceToFace:
        Boolean(
          item.isFaceToFace
        ),

      practice:
        false,

      slot:
        null,

      area:
        null,
    },
  };
}

function buildDegreeTemplateSubject(
  item:
    DegreeFillTemplateItem
): QualificationPlannedSubject {
  return {
    source:
      "degree_template",

    masterItemId:
      null,

    catalogId:
      null,

    templateId:
      item.id,

    subjectName:
      item.subjectName,

    requirementType:
      item.requirementType,

    category:
      item.category,

    /**
     * 현재 CRM course subject template은
     * 플랜 등록 시 3학점으로 생성된다.
     */
    credits:
      3,

    isFaceToFace:
      false,

    reasons:
      [],

    satisfies: {
      qualification:
        false,

      degreeMajor:
        item.requirementType ===
          "전공필수" ||
        item.requirementType ===
          "전공선택" ||
        item.category ===
          "전공",

      faceToFace:
        false,

      practice:
        false,

      slot:
        null,

      area:
        null,
    },
  };
}

function getTemplateKey(
  item:
    DegreeFillTemplateItem
) {
  return (
    getConfirmedSubjectEquivalenceKey(
      item.subjectName
    ) ||
    `template:${item.id}`
  );
}

function isTemplateAlreadyUsed(
  item:
    DegreeFillTemplateItem,

  recognizedKeys:
    Set<string>,

  selectedMap:
    Map<
      string,
      QualificationPlannedSubject
    >
) {
  const key =
    getConfirmedSubjectEquivalenceKey(
      item.subjectName
    );

  if (!key) {
    return false;
  }

  if (
    recognizedKeys.has(
      key
    )
  ) {
    return true;
  }

  return selectedMap.has(
    key
  );
}

function getSelectedMap() {
  return new Map<
    string,
    QualificationPlannedSubject
  >();
}

function addSelectedSubject(
  selectedMap:
    Map<
      string,
      QualificationPlannedSubject
    >,
  item:
    QualificationRiskMasterItem,
  params: {
    reasons:
      QualificationPlannedSubjectReason[];

    qualification?:
      boolean;

    slot?:
      string | null;

    area?:
      string | null;

    practice?:
      boolean;
  }
) {
  const key =
    getMasterKey(
      item
    );

  let selected =
    selectedMap.get(
      key
    );

  if (!selected) {
    selected =
      buildPlannedSubject(
        item
      );

    selectedMap.set(
      key,
      selected
    );
  }

  for (
    const reason
    of params.reasons
  ) {
    addReason(
      selected.reasons,
      reason
    );
  }

  if (
    params.qualification
  ) {
    selected.satisfies
      .qualification =
      true;
  }

  if (
    params.slot
  ) {
    selected.satisfies.slot =
      params.slot;
  }

  if (
    params.area
  ) {
    selected.satisfies.area =
      params.area;
  }

  if (
    params.practice
  ) {
    selected.satisfies.practice =
      true;
  }

  if (
    item.isFaceToFace
  ) {
    selected.satisfies
      .faceToFace =
      true;
  }

  return selected;
}

function getIssueByCode(
  requirements:
    UnifiedQualificationRequirements,
  code:
    string
) {
  return requirements
    .qualification
    .requirementIssues
    .find(
      (
        issue
      ) =>
        issue.code ===
        code
    );
}

function getIssuesByPrefix(
  requirements:
    UnifiedQualificationRequirements,
  prefix:
    string
) {
  return requirements
    .qualification
    .requirementIssues
    .filter(
      (
        issue
      ) =>
        issue.code.startsWith(
          prefix
        )
    );
}

function selectBestCandidate(
  items:
    QualificationRiskMasterItem[],
  params?: {
    preferFaceToFace?:
      boolean;

    preferMajorRequired?:
      boolean;
  }
) {
  return [
    ...items,
  ].sort(
    (
      a,
      b
    ) => {
      let scoreA =
        0;

      let scoreB =
        0;

      if (
        params
          ?.preferFaceToFace
      ) {
        if (
          a.isFaceToFace
        ) {
          scoreA +=
            100;
        }

        if (
          b.isFaceToFace
        ) {
          scoreB +=
            100;
        }
      }

      if (
        params
          ?.preferMajorRequired
      ) {
        if (
          a.requirementType ===
          "전공필수"
        ) {
          scoreA +=
            80;
        }

        if (
          b.requirementType ===
          "전공필수"
        ) {
          scoreB +=
            80;
        }
      }

      /**
       * 동일 점수이면 마스터 순서를 유지한다.
       */
      if (
        scoreA !==
        scoreB
      ) {
        return (
          scoreB -
          scoreA
        );
      }

      return (
        Number(
          a.id
        ) -
        Number(
          b.id
        )
      );
    }
  )[0] ||
    null;
}

/**
 * 사회복지사 2급
 */
function planSocialWorkerSubjects(
  params: {
    requirements:
      UnifiedQualificationRequirements;

    masterItems:
      QualificationRiskMasterItem[];

    recognizedKeys:
      Set<string>;

    selectedMap:
      Map<
        string,
        QualificationPlannedSubject
      >;
  }
) {
  const issueCodes = [
    {
      code:
        "SOCIAL_WORKER_REQUIRED_SUBJECT_SHORTAGE",

      reason:
        "qualification_required" as const,
    },
    {
      code:
        "SOCIAL_WORKER_ELECTIVE_SUBJECT_SHORTAGE",

      reason:
        "qualification_elective" as const,
    },
  ];

  for (
    const config
    of issueCodes
  ) {
    const issue =
      getIssueByCode(
        params.requirements,
        config.code
      );

    if (!issue) {
      continue;
    }

    const details =
      getRecord(
        issue.details
      );

    const remaining =
      Math.max(
        Math.floor(
          toNumber(
            details.remaining
          )
        ),
        0
      );

    const candidateNames =
      getStringArray(
        details
          .missingCandidates
      );

    const candidates =
      findMasterItemsByNames(
        params.masterItems,
        candidateNames
      )
        .filter(
          (
            item
          ) =>
            !isAlreadyRecognized(
              item,
              params.recognizedKeys
            )
        );

    for (
      const item
      of candidates.slice(
        0,
        remaining
      )
    ) {
      addSelectedSubject(
        params.selectedMap,
        item,
        {
          reasons: [
            config.reason,
          ],

          qualification:
            true,
        }
      );
    }
  }
}

/**
 * 보육교사 2급
 */
function planChildcareTeacherSubjects(
  params: {
    requirements:
      UnifiedQualificationRequirements;

    masterItems:
      QualificationRiskMasterItem[];

    recognizedKeys:
      Set<string>;

    selectedMap:
      Map<
        string,
        QualificationPlannedSubject
      >;
  }
) {
  const {
    requirements,
    masterItems,
    recognizedKeys,
    selectedMap,
  } =
    params;

  const faceIssue =
    getIssueByCode(
      requirements,
      "CHILDCARE_FACE_TO_FACE_SHORTAGE"
    );

  const faceDetails =
    getRecord(
      faceIssue?.details
    );

  const missingFaceSlots =
    new Set(
      getStringArray(
        faceDetails
          .missingSlots
      )
    );

  const degreeIssue =
    getIssueByCode(
      requirements,
      "CHILDCARE_DEGREE_MAJOR_REQUIRED_CORE_SHORTAGE"
    );

  const degreeDetails =
    getRecord(
      degreeIssue?.details
    );

  let remainingDegreeMajorRequired =
    Math.max(
      Math.floor(
        toNumber(
          degreeDetails
            .remainingSubjects
        )
      ),
      0
    );

  const teacherIssue =
    getIssueByCode(
      requirements,
      "CHILDCARE_TEACHER_CHARACTER_SHORTAGE"
    );

  if (teacherIssue) {
    const details =
      getRecord(
        teacherIssue.details
      );

    const missingSlots =
      getStringArray(
        details.missingSlots
      ) as ChildcareTeacherCharacterSlotKey[];

    for (
      const slot
      of missingSlots
    ) {
      const candidates =
        masterItems
          .filter(
            (
              item
            ) =>
              resolveChildcareTeacherCharacterSlot(
                item.subjectName
              ) ===
              slot
          )
          .filter(
            (
              item
            ) =>
              !isAlreadyRecognized(
                item,
                recognizedKeys
              )
          );

      const faceSlotCandidates =
        candidates.filter(
          (
            item
          ) =>
            missingFaceSlots.has(
              String(
                resolveChildcareFaceToFaceSlot(
                  item.subjectName
                ) ||
                ""
              )
            )
        );

      const selected =
        selectBestCandidate(
          faceSlotCandidates.length >
            0
            ? faceSlotCandidates
            : candidates,
          {
            preferFaceToFace:
              true,

            preferMajorRequired:
              remainingDegreeMajorRequired >
              0,
          }
        );

      if (!selected) {
        continue;
      }

      const reasons:
        QualificationPlannedSubjectReason[] =
        [
          "qualification_required",
        ];

      const faceSlot =
        resolveChildcareFaceToFaceSlot(
          selected.subjectName
        );

      if (
        faceSlot &&
        missingFaceSlots.has(
          faceSlot
        )
      ) {
        reasons.push(
          "face_to_face"
        );

        missingFaceSlots.delete(
          faceSlot
        );
      }

      if (
        selected.requirementType ===
          "전공필수" &&
        remainingDegreeMajorRequired >
          0
      ) {
        reasons.push(
          "degree_major_required"
        );

        remainingDegreeMajorRequired -=
          1;
      }

      addSelectedSubject(
        selectedMap,
        selected,
        {
          reasons,

          qualification:
            true,

          slot,

          practice:
            false,
        }
      );
    }
  }

  const knowledgeIssue =
    getIssueByCode(
      requirements,
      "CHILDCARE_KNOWLEDGE_REQUIRED_SHORTAGE"
    );

  if (knowledgeIssue) {
    const details =
      getRecord(
        knowledgeIssue.details
      );

    const missingSlots =
      getStringArray(
        details.missingSlots
      ) as ChildcareRequiredSlotKey[];

    for (
      const slot
      of missingSlots
    ) {
      const candidates =
        masterItems
          .filter(
            (
              item
            ) =>
              resolveChildcareRequiredSlot(
                item.subjectName
              ) ===
              slot
          )
          .filter(
            (
              item
            ) =>
              !isAlreadyRecognized(
                item,
                recognizedKeys
              )
          );

      const preferredCandidates =
        candidates.filter(
          (
            item
          ) => {
            const faceSlot =
              resolveChildcareFaceToFaceSlot(
                item.subjectName
              );

            return Boolean(
              faceSlot &&
              missingFaceSlots.has(
                faceSlot
              )
            );
          }
        );

      const selected =
        selectBestCandidate(
          preferredCandidates.length >
            0
            ? preferredCandidates
            : candidates,
          {
            preferFaceToFace:
              true,

            preferMajorRequired:
              remainingDegreeMajorRequired >
              0,
          }
        );

      if (!selected) {
        continue;
      }

      const reasons:
        QualificationPlannedSubjectReason[] =
        [
          "qualification_required",
        ];

      const faceSlot =
        resolveChildcareFaceToFaceSlot(
          selected.subjectName
        );

      if (
        faceSlot &&
        missingFaceSlots.has(
          faceSlot
        )
      ) {
        addReason(
          reasons,
          "face_to_face"
        );

        missingFaceSlots.delete(
          faceSlot
        );
      }

      if (
        selected.requirementType ===
          "전공필수" &&
        remainingDegreeMajorRequired >
          0
      ) {
        addReason(
          reasons,
          "degree_major_required"
        );

        remainingDegreeMajorRequired -=
          1;
      }

      addSelectedSubject(
        selectedMap,
        selected,
        {
          reasons,

          qualification:
            true,

          slot,
        }
      );
    }
  }

  const electiveIssue =
    getIssueByCode(
      requirements,
      "CHILDCARE_KNOWLEDGE_ELECTIVE_SHORTAGE"
    );

  if (electiveIssue) {
    const details =
      getRecord(
        electiveIssue.details
      );

    const remaining =
      Math.max(
        Math.floor(
          toNumber(
            details
              .remainingSubjects
          )
        ),
        0
      );

    const candidateNames =
      getStringArray(
        details
          .missingCandidates
      );

    const candidates =
      findMasterItemsByNames(
        masterItems,
        candidateNames
      )
        .filter(
          (
            item
          ) =>
            !isAlreadyRecognized(
              item,
              recognizedKeys
            )
        )
        .sort(
          (
            a,
            b
          ) => {
            const aMajor =
              a.requirementType ===
              "전공필수"
                ? 1
                : 0;

            const bMajor =
              b.requirementType ===
              "전공필수"
                ? 1
                : 0;

            return (
              bMajor -
              aMajor ||
              a.id -
              b.id
            );
          }
        );

    for (
      const item
      of candidates.slice(
        0,
        remaining
      )
    ) {
      const reasons:
        QualificationPlannedSubjectReason[] =
        [
          "qualification_elective",
        ];

      if (
        item.requirementType ===
          "전공필수" &&
        remainingDegreeMajorRequired >
          0
      ) {
        reasons.push(
          "degree_major_required"
        );

        remainingDegreeMajorRequired -=
          1;
      }

      addSelectedSubject(
        selectedMap,
        item,
        {
          reasons,

          qualification:
            true,
        }
      );
    }
  }

  const practiceIssue =
    getIssueByCode(
      requirements,
      "CHILDCARE_PRACTICE_AREA_SHORTAGE"
    );

  if (practiceIssue) {
    const details =
      getRecord(
        practiceIssue.details
      );

    const missingSlots =
      getStringArray(
        details.missingSlots
      ) as ChildcarePracticeSlotKey[];

    for (
      const slot
      of missingSlots
    ) {
      const candidates =
        masterItems
          .filter(
            (
              item
            ) =>
              resolveChildcarePracticeSlot(
                item.subjectName
              ) ===
              slot
          )
          .filter(
            (
              item
            ) =>
              !isAlreadyRecognized(
                item,
                recognizedKeys
              )
          );

      const selected =
        selectBestCandidate(
          candidates,
          {
            preferFaceToFace:
              slot ===
              "observation",

            preferMajorRequired:
              remainingDegreeMajorRequired >
              0,
          }
        );

      if (!selected) {
        continue;
      }

      const reasons:
        QualificationPlannedSubjectReason[] =
        [
          slot ===
            "practice"
            ? "practice"
            : "qualification_required",
        ];

      const faceSlot =
        resolveChildcareFaceToFaceSlot(
          selected.subjectName
        );

      if (
        faceSlot &&
        missingFaceSlots.has(
          faceSlot
        )
      ) {
        reasons.push(
          "face_to_face"
        );

        missingFaceSlots.delete(
          faceSlot
        );
      }

      if (
        selected.requirementType ===
          "전공필수" &&
        remainingDegreeMajorRequired >
          0
      ) {
        reasons.push(
          "degree_major_required"
        );

        remainingDegreeMajorRequired -=
          1;
      }

      addSelectedSubject(
        selectedMap,
        selected,
        {
          reasons,

          qualification:
            true,

          slot,

          practice:
            slot ===
            "practice",
        }
      );
    }
  }

  /**
   * 자격 17과목을 선택하고도
   * 전공필수 5조건이 부족하다면
   * 이미 선택되지 않은 전공필수 과목을
   * 추가 후보로 선택한다.
   *
   * 이 경우에만 실제 추가과목이 될 수 있다.
   */
  if (
    remainingDegreeMajorRequired >
    0 &&
    degreeIssue
  ) {
    const candidateNames =
      getStringArray(
        degreeDetails
          .missingCandidates
      );

    const candidates =
      findMasterItemsByNames(
        masterItems,
        candidateNames
      )
        .filter(
          (
            item
          ) =>
            !isAlreadyRecognized(
              item,
              recognizedKeys
            )
        )
        .filter(
          (
            item
          ) =>
            !selectedMap.has(
              getMasterKey(
                item
              )
            )
        );

    for (
      const item
      of candidates.slice(
        0,
        remainingDegreeMajorRequired
      )
    ) {
      addSelectedSubject(
        selectedMap,
        item,
        {
          reasons: [
            "degree_major_required",
          ],

          qualification:
            false,
        }
      );
    }
  }
}

/**
 * 한국어교원 2급
 */
function planKoreanTeacherSubjects(
  params: {
    requirements:
      UnifiedQualificationRequirements;

    masterItems:
      QualificationRiskMasterItem[];

    recognizedKeys:
      Set<string>;

    selectedMap:
      Map<
        string,
        QualificationPlannedSubject
      >;
  }
) {
  const areaIssuePrefix =
    "KOREAN_TEACHER_AREA";

  const areaIssues =
    getIssuesByPrefix(
      params.requirements,
      areaIssuePrefix
    ).filter(
      (
        issue
      ) =>
        issue.code.endsWith(
          "_CREDIT_SHORTAGE"
        )
    );

  for (
    const issue
    of areaIssues
  ) {
    const details =
      getRecord(
        issue.details
      );

    const area =
      String(
        details.area ||
        ""
      ) as KoreanTeacherArea;

    if (
      ![
        "area1",
        "area2",
        "area3",
        "area4",
        "area5",
      ].includes(
        area
      )
    ) {
      continue;
    }

    let remainingCredits =
      Math.max(
        toNumber(
          details
            .remainingCredits
        ),
        0
      );

    const candidateNames =
      getStringArray(
        details
          .missingCandidates
      );

    const candidates =
      findMasterItemsByNames(
        params.masterItems,
        candidateNames
      )
        .filter(
          (
            item
          ) =>
            resolveKoreanTeacherArea(
              item.subjectName
            ) ===
            area
        )
        .filter(
          (
            item
          ) =>
            !isAlreadyRecognized(
              item,
              params.recognizedKeys
            )
        )
        .sort(
          (
            a,
            b
          ) => {
            const aRequired =
              a.requirementType ===
              "전공필수"
                ? 1
                : 0;

            const bRequired =
              b.requirementType ===
              "전공필수"
                ? 1
                : 0;

            return (
              bRequired -
              aRequired ||
              a.id -
              b.id
            );
          }
        );

    for (
      const item
      of candidates
    ) {
      if (
        remainingCredits <=
        0
      ) {
        break;
      }

      addSelectedSubject(
        params.selectedMap,
        item,
        {
          reasons: [
            "qualification_area",
          ],

          qualification:
            true,

          area,
        }
      );

      remainingCredits -=
        toNumber(
          item.credits
        );
    }
  }

  /**
   * 한국어교육 전공필수 7과목.
   *
   * 영역과목 선택으로 이미 충족된 과목은
   * 중복 추가하지 않는다.
   */
  const majorIssue =
    getIssueByCode(
      params.requirements,
      "KOREAN_TEACHER_DEGREE_REQUIRED_SHORTAGE"
    );

  if (!majorIssue) {
    return;
  }

  const details =
    getRecord(
      majorIssue.details
    );

  let remaining =
    Math.max(
      Math.floor(
        toNumber(
          details
            .remainingSubjects
        )
      ),
      0
    );

  const candidateNames =
    getStringArray(
      details
        .missingCandidates
    );

  const candidates =
    findMasterItemsByNames(
      params.masterItems,
      candidateNames
    )
      .filter(
        (
          item
        ) =>
          !isAlreadyRecognized(
            item,
            params.recognizedKeys
          )
      );

  for (
    const item
    of candidates
  ) {
    if (
      remaining <=
      0
    ) {
      break;
    }

    const existing =
      params.selectedMap.get(
        getMasterKey(
          item
        )
      );

    if (existing) {
      addReason(
        existing.reasons,
        "degree_major_required"
      );

      remaining -=
        1;

      continue;
    }

    addSelectedSubject(
      params.selectedMap,
      item,
      {
        reasons: [
          "degree_major_required",
        ],

        qualification:
          Boolean(
            resolveKoreanTeacherArea(
              item.subjectName
            )
          ),
      }
    );

    remaining -=
      1;
  }
}

/**
 * 아동학사
 */
function planChildStudyDegreeSubjects(
  params: {
    requirements:
      UnifiedQualificationRequirements;

    masterItems:
      QualificationRiskMasterItem[];

    recognizedKeys:
      Set<string>;

    selectedMap:
      Map<
        string,
        QualificationPlannedSubject
      >;
  }
) {
  const issue =
    getIssueByCode(
      params.requirements,
      "CHILD_STUDY_MAJOR_REQUIRED_CORE_SHORTAGE"
    );

  if (!issue) {
    return;
  }

  const details =
    getRecord(
      issue.details
    );

  const remaining =
    Math.max(
      Math.floor(
        toNumber(
          details
            .remainingSubjects
        )
      ),
      0
    );

  const candidateNames =
    getStringArray(
      details
        .missingCandidates
    );

  const candidates =
    findMasterItemsByNames(
      params.masterItems,
      candidateNames
    )
      .filter(
        (
          item
        ) =>
          !isAlreadyRecognized(
            item,
            params.recognizedKeys
          )
      );

  for (
    const item
    of candidates.slice(
      0,
      remaining
    )
  ) {
    addSelectedSubject(
      params.selectedMap,
      item,
      {
        reasons: [
          "degree_major_required",
        ],

        qualification:
          false,
      }
    );
  }
}

function planDegreeFillSubjects(
  params: {
    requirements:
      UnifiedQualificationRequirements;

    templates:
      DegreeFillTemplateItem[];

    recognizedKeys:
      Set<string>;

    selectedMap:
      Map<
        string,
        QualificationPlannedSubject
      >;
  }
) {
  let remainingTotal =
    Math.max(
      toNumber(
        params.requirements
          .degree
          .remainingTotalCredits
      ),
      0
    );

  let remainingMajor =
    Math.max(
      toNumber(
        params.requirements
          .degree
          .remainingMajorCredits
      ),
      0
    );

  let remainingLiberal =
    Math.max(
      toNumber(
        params.requirements
          .degree
          .remainingLiberalCredits
      ),
      0
    );

  /**
   * 먼저 자격 Planner에서 선택한 과목이
   * 학위요건도 얼마나 채우는지 차감한다.
   */
  for (
    const subject
    of params.selectedMap.values()
  ) {
    remainingTotal =
      Math.max(
        remainingTotal -
          subject.credits,
        0
      );

    const isMajor =
      subject.requirementType ===
        "전공필수" ||
      subject.requirementType ===
        "전공선택" ||
      subject.category ===
        "전공";

    if (isMajor) {
      remainingMajor =
        Math.max(
          remainingMajor -
            subject.credits,
          0
        );
    }

    const isLiberal =
      subject.requirementType ===
        "교양" ||
      subject.category ===
        "교양";

    if (isLiberal) {
      remainingLiberal =
        Math.max(
          remainingLiberal -
            subject.credits,
          0
        );
    }
  }

  const available =
    (params.templates || [])
      .filter(
        (
          item
        ) =>
          !isTemplateAlreadyUsed(
            item,
            params.recognizedKeys,
            params.selectedMap
          )
      )
      .sort(
        (
          a,
          b
        ) =>
          Number(
            a.sortOrder ||
            0
          ) -
            Number(
              b.sortOrder ||
              0
            ) ||
          a.id -
            b.id
      );

  /**
   * 1. 전공 부족 먼저
   */
  for (
    const item
    of available
  ) {
    if (
      remainingMajor <=
      0
    ) {
      break;
    }

    const isMajor =
      item.requirementType ===
        "전공필수" ||
      item.requirementType ===
        "전공선택" ||
      item.category ===
        "전공";

    if (!isMajor) {
      continue;
    }

    const key =
      getTemplateKey(
        item
      );

    if (
      params.selectedMap.has(
        key
      )
    ) {
      continue;
    }

    const subject =
      buildDegreeTemplateSubject(
        item
      );

    subject.reasons.push(
      "degree_major_credit"
    );

    params.selectedMap.set(
      key,
      subject
    );

    remainingMajor =
      Math.max(
        remainingMajor -
          3,
        0
      );

    remainingTotal =
      Math.max(
        remainingTotal -
          3,
        0
      );
  }

  /**
   * 2. 교양 부족
   */
  for (
    const item
    of available
  ) {
    if (
      remainingLiberal <=
      0
    ) {
      break;
    }

    const isLiberal =
      item.requirementType ===
        "교양" ||
      item.category ===
        "교양";

    if (!isLiberal) {
      continue;
    }

    const key =
      getTemplateKey(
        item
      );

    if (
      params.selectedMap.has(
        key
      )
    ) {
      continue;
    }

    const subject =
      buildDegreeTemplateSubject(
        item
      );

    subject.reasons.push(
      "degree_liberal_credit"
    );

    params.selectedMap.set(
      key,
      subject
    );

    remainingLiberal =
      Math.max(
        remainingLiberal -
          3,
        0
      );

    remainingTotal =
      Math.max(
        remainingTotal -
          3,
        0
      );
  }

  /**
   * 3. 전공/교양 충족 후
   * 전체 학점만 부족하면
   * 남은 어떤 인정 템플릿이든 사용 가능.
   *
   * 단 실제 마스터에 존재하는 과목만 고른다.
   */
  for (
    const item
    of available
  ) {
    if (
      remainingTotal <=
      0
    ) {
      break;
    }

    const key =
      getTemplateKey(
        item
      );

    if (
      params.selectedMap.has(
        key
      )
    ) {
      continue;
    }

    const subject =
      buildDegreeTemplateSubject(
        item
      );

    subject.reasons.push(
      "degree_total_credit"
    );

    params.selectedMap.set(
      key,
      subject
    );

    remainingTotal =
      Math.max(
        remainingTotal -
          3,
        0
      );
  }

  return {
    remainingTotalCredits:
      remainingTotal,

    remainingMajorCredits:
      remainingMajor,

    remainingLiberalCredits:
      remainingLiberal,
  };
}

export function planQualificationSubjects(
  params: {
    requirements:
      UnifiedQualificationRequirements;

    masterItems:
      QualificationRiskMasterItem[];

    recognizedSubjects:
      QualificationRecognizedSubject[];

    /**
     * 실제 학위 학점 채움용 과목 템플릿.
     */
    degreeTemplates:
      DegreeFillTemplateItem[];
  }
): QualificationSubjectPlannerResult {
  const {
    requirements,
  } =
    params;

  const warnings:
    string[] =
    [];

  const unresolvedRequirements:
    Array<{
      code:
        string;

      message:
        string;
    }> =
    [];

  if (
    !requirements.canPlan
  ) {
    return {
      canPlan:
        false,

      courseKey:
        requirements.courseKey,

      selectedSubjects:
        [],

      selectedSubjectCount:
        0,

      selectedCredits:
        0,

      projectedDegree: {
        remainingTotalCredits:
          requirements
            .degree
            .remainingTotalCredits,

        remainingMajorCredits:
          requirements
            .degree
            .remainingMajorCredits,

        remainingLiberalCredits:
          requirements
            .degree
            .remainingLiberalCredits,
      },

      degreeFillRemaining: {
        totalCredits:
          Math.max(
            toNumber(
              requirements
                .degree
                .remainingTotalCredits
            ),
            0
          ),

        majorCredits:
          Math.max(
            toNumber(
              requirements
                .degree
                .remainingMajorCredits
            ),
            0
          ),

        liberalCredits:
          Math.max(
            toNumber(
              requirements
                .degree
                .remainingLiberalCredits
            ),
            0
          ),

        requiresAdditionalDegreeSubjects:
          requirements
            .combined
            .hasRemainingDegreeRequirement,
      },

      unresolvedRequirements:
        requirements
          .blockingReasons
          .map(
            (
              message,
              index
            ) => ({
              code:
                `BLOCKING_${index + 1}`,

              message,
            })
          ),

      warnings,
    };
  }

  const recognizedKeys =
    createRecognizedKeySet(
      params
        .recognizedSubjects
    );

  const selectedMap =
    getSelectedMap();

  switch (
    requirements.courseKey
  ) {
    case "social_worker_2":
      planSocialWorkerSubjects({
        requirements,

        masterItems:
          params.masterItems,

        recognizedKeys,

        selectedMap,
      });

      break;

    case "childcare_teacher_2":
      planChildcareTeacherSubjects({
        requirements,

        masterItems:
          params.masterItems,

        recognizedKeys,

        selectedMap,
      });

      break;

    case "korean_teacher_2":
      planKoreanTeacherSubjects({
        requirements,

        masterItems:
          params.masterItems,

        recognizedKeys,

        selectedMap,
      });

      break;

    case "child_study_degree":
      planChildStudyDegreeSubjects({
        requirements,

        masterItems:
          params.masterItems,

        recognizedKeys,

        selectedMap,
      });

      break;

    default:
      unresolvedRequirements.push({
        code:
          "QUALIFICATION_SUBJECT_PLANNER_UNSUPPORTED",

        message:
          "현재 과정의 자동 과목선택 규칙이 아직 연결되지 않았습니다.",
      });
  }

  /**
   * 자격/전필 선택이 끝난 후
   * 실제 course subject template을 이용해
   * 남은 학위학점을 채운다.
   */
  const degreeFillResult =
    requirements
      .degree
      .requiresNewDegreeTrack
      ? planDegreeFillSubjects({
          requirements,

          templates:
            params.degreeTemplates,

          recognizedKeys,

          selectedMap,
        })
      : {
          remainingTotalCredits:
            0,

          remainingMajorCredits:
            0,

          remainingLiberalCredits:
            0,
        };

  const selectedSubjects =
    Array.from(
      selectedMap.values()
    );

  const selectedCredits =
    selectedSubjects.reduce(
      (
        total,
        subject
      ) =>
        total +
        toNumber(
          subject.credits
        ),
      0
    );

    const projectedRemainingTotal =
    requirements
      .degree
      .requiresNewDegreeTrack
      ? degreeFillResult
          .remainingTotalCredits
      : 0;

  const projectedRemainingMajor =
    requirements
      .degree
      .requiresNewDegreeTrack
      ? degreeFillResult
          .remainingMajorCredits
      : 0;

  const projectedRemainingLiberal =
    requirements
      .degree
      .requiresNewDegreeTrack
      ? degreeFillResult
          .remainingLiberalCredits
      : 0;


  const degreeFillTotal =
    Math.max(
      toNumber(
        projectedRemainingTotal
      ),
      0
    );

  const degreeFillMajor =
    Math.max(
      toNumber(
        projectedRemainingMajor
      ),
      0
    );

  const degreeFillLiberal =
    Math.max(
      toNumber(
        projectedRemainingLiberal
      ),
      0
    );

  if (
    degreeFillTotal >
      0 ||
    degreeFillMajor >
      0 ||
    degreeFillLiberal >
      0
  ) {
    warnings.push(
      "자격 필수과목 선택 후에도 학위 부족학점이 남아 있습니다. 교양·전공·일반 학점 충족용 과목은 별도 학위과목 마스터 연결 후 확정해야 합니다."
    );
  }

  /**
   * Analyzer가 부족조건을 냈지만
   * 현재 마스터에서 선택하지 못한 경우를 잡는다.
   */
  const qualificationDangerIssues =
    requirements
      .qualification
      .requirementIssues
      .filter(
        (
          issue
        ) =>
          issue.severity ===
          "danger"
      );

  for (
    const issue
    of qualificationDangerIssues
  ) {
    const details =
      getRecord(
        issue.details
      );

    const candidateNames =
      getStringArray(
        details
          .missingCandidates
      );

    /**
     * 후보 자체가 없는 행정/실습시간 문제는
     * 여기서는 과목 미선택 오류로 잡지 않는다.
     */
    if (
      candidateNames.length ===
      0
    ) {
      continue;
    }

    const candidateItems =
      findMasterItemsByNames(
        params.masterItems,
        candidateNames
      );

    if (
      candidateItems.length ===
      0
    ) {
      unresolvedRequirements.push({
        code:
          issue.code,

        message:
          `${issue.title}: 현재 과정 과목마스터에서 부족과목 후보를 찾지 못했습니다.`,
      });
    }
  }

  return {
    canPlan:
      unresolvedRequirements.length ===
      0,

    courseKey:
      requirements.courseKey,

    selectedSubjects,

    selectedSubjectCount:
      selectedSubjects.length,

    selectedCredits,

    projectedDegree: {
      remainingTotalCredits:
        projectedRemainingTotal,

      remainingMajorCredits:
        projectedRemainingMajor,

      remainingLiberalCredits:
        projectedRemainingLiberal,
    },

    degreeFillRemaining: {
      totalCredits:
        degreeFillTotal,

      majorCredits:
        degreeFillMajor,

      liberalCredits:
        degreeFillLiberal,

      requiresAdditionalDegreeSubjects:
        degreeFillTotal >
          0 ||
        degreeFillMajor >
          0 ||
        degreeFillLiberal >
          0,
    },

    unresolvedRequirements,

    warnings,
  };
}