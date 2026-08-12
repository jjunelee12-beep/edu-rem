export type RiskCourseKey =
  | "social_worker_2"
  | "childcare_teacher_2"
  | "child_study_degree"
  | "korean_teacher_2"
  | "lifelong_educator_2";

export type FinalEducationGroup =
  | "high_school"
  | "associate"
  | "bachelor"
  | "graduate"
  | "unknown";

export type DegreeRule = {
  degreeType:
    | "associate"
    | "bachelor"
    | "associate_second_major"
    | "bachelor_second_major";

  totalCredits:
    number | null;

  majorCredits:
    number;

  liberalCredits:
    number | null;

  requiredAccreditedCredits:
    number;

  requiresMajorRequired:
    true;
};

export const DEGREE_RULES = {
  associate: {
    degreeType:
      "associate",

    totalCredits:
      80,

    majorCredits:
      45,

    liberalCredits:
      15,

    requiredAccreditedCredits:
      18,

    requiresMajorRequired:
      true,
  },

  bachelor: {
    degreeType:
      "bachelor",

    totalCredits:
      140,

    majorCredits:
      60,

    liberalCredits:
      30,

    requiredAccreditedCredits:
      18,

    requiresMajorRequired:
      true,
  },

  associate_second_major: {
    degreeType:
      "associate_second_major",

    totalCredits:
      null,

    majorCredits:
      36,

    liberalCredits:
      null,

    requiredAccreditedCredits:
      18,

    requiresMajorRequired:
      true,
  },

  bachelor_second_major: {
    degreeType:
      "bachelor_second_major",

    totalCredits:
      null,

    majorCredits:
      48,

    liberalCredits:
      null,

    requiredAccreditedCredits:
      18,

    requiresMajorRequired:
      true,
  },
} satisfies Record<
  string,
  DegreeRule
>;

export const SOCIAL_WORKER_2_RULES = {
  oldLaw: {
    ruleKey:
      "social_worker_2_old",

    requiredSubjects:
      10,

    electiveSubjects:
      4,

    totalSubjects:
      14,

    practiceHours:
      120,

    /**
     * 날짜만으로 확정하지 않는다.
     * 2020년 시행 당시 관련 교과목/실습
     * 이수 또는 수강 상태를 별도 판정한다.
     */
    requiresTransitionCheck:
      true,
  },

  current: {
    ruleKey:
      "social_worker_2_current",

    requiredSubjects:
      10,

    electiveSubjects:
      7,

    totalSubjects:
      17,

    practiceHours:
      160,

    requiresTransitionCheck:
      false,
  },
} as const;

export type SocialWorkerLawVersion =
  | "old"
  | "current"
  | "unselected";

export type SocialWorkerRuleResolution = {
  lawVersion:
    SocialWorkerLawVersion;

  rule:
    typeof SOCIAL_WORKER_2_RULES.oldLaw |
    typeof SOCIAL_WORKER_2_RULES.current |
    null;

  canAnalyzeQualification:
    boolean;

  requiresManualSelection:
    boolean;

  message:
    string;
};

export function resolveSocialWorkerRule(
  lawVersion:
    unknown
): SocialWorkerRuleResolution {
  const normalized =
    String(
      lawVersion ??
      ""
    )
      .trim()
      .toLowerCase();

  if (
    normalized ===
      "old" ||
    normalized ===
      "구법"
  ) {
    return {
      lawVersion:
        "old",

      rule:
        SOCIAL_WORKER_2_RULES
          .oldLaw,

      canAnalyzeQualification:
        true,

      requiresManualSelection:
        false,

      message:
        "사회복지사 2급 구법 기준을 적용합니다.",
    };
  }

  if (
    normalized ===
      "current" ||
    normalized ===
      "new" ||
    normalized ===
      "신법"
  ) {
    return {
      lawVersion:
        "current",

      rule:
        SOCIAL_WORKER_2_RULES
          .current,

      canAnalyzeQualification:
        true,

      requiresManualSelection:
        false,

      message:
        "사회복지사 2급 신법 기준을 적용합니다.",
    };
  }

  return {
    lawVersion:
      "unselected",

    rule:
      null,

    canAnalyzeQualification:
      false,

    requiresManualSelection:
      true,

    message:
      "사회복지사 적용기준이 설정되지 않았습니다. 학생정보요약에서 구법 또는 신법을 선택해주세요.",
  };
}

export const CHILDCARE_TEACHER_2_RULE = {
  /**
   * 보육교사 2급 전체 자격과목
   */
  totalSubjects:
    17,

  totalCredits:
    51,

  /**
   * 17과목 안의 영역별 구성
   */
  teacherCharacterSubjects:
    2,

  knowledgeRequiredSubjects:
    9,

  knowledgeElectiveSubjects:
    4,

  practiceSubjects:
    2,

  /**
   * 보육실습을 제외하고
   * 대면수업으로 이수해야 하는 교과조건
   */
  requiredFaceToFaceSubjects:
    8,

  /**
   * 보육실습
   */
  practiceHours:
    240,

  practiceWeeks:
    6,

  /**
   * CRM 마스터에서 대면수업 과목은
   * 과목명 "(대면)" 표시도 함께 사용한다.
   */
  faceToFaceMasterMarker:
    "(대면)",

  requiresFaceToFaceValidation:
    true,

  requiresDegree:
    true,
} as const;

export type ChildcareTeacherArea =
  | "teacher_character"
  | "knowledge_required"
  | "knowledge_elective"
  | "practice";

export type ChildcareRequiredSlotKey =
  | "childcare_intro"
  | "childcare_curriculum"
  | "infant_child_development"
  | "teaching_method"
  | "play_guidance"
  | "language_guidance"
  | "art_activity"
  | "math_science"
  | "safety_life";

export type ChildcarePracticeSlotKey =
  | "observation"
  | "practice";

export type ChildcareTeacherCharacterSlotKey =
  | "teacher_theory"
  | "child_rights";

/**
 * 교사인성 2과목.
 *
 * 같은 슬롯 안의 과목명은
 * 동일 법정 조건의 명칭 후보로 취급한다.
 */
export const CHILDCARE_TEACHER_CHARACTER_GROUPS = {
  teacher_theory: [
    "보육교사론",
    "보육교사(인성)론",
  ],

  child_rights: [
    "아동권리와복지",
  ],
} as const satisfies Record<
  ChildcareTeacherCharacterSlotKey,
  readonly string[]
>;

/**
 * 영역 판별용 전체 과목명 목록.
 */
export const CHILDCARE_TEACHER_CHARACTER_SUBJECTS =
  Object.values(
    CHILDCARE_TEACHER_CHARACTER_GROUPS
  ).flat();

/**
 * 보육지식과 기술 필수 9개 슬롯
 *
 * 같은 배열 내부 과목은
 * 여러 개 이수하여도 한 슬롯만 충족한다.
 */
export const CHILDCARE_KNOWLEDGE_REQUIRED_GROUPS = {
  childcare_intro: [
    "보육학개론",
  ],

  childcare_curriculum: [
    "보육과정",
  ],

  infant_child_development: [
    "영유아발달",
  ],

  teaching_method: [
    "영유아교수방법론",
  ],

  play_guidance: [
    "놀이지도",
  ],

  language_guidance: [
    "언어지도",
  ],

  art_activity: [
    "아동음악",
    "아동동작",
    "아동미술",
  ],

  math_science: [
    "아동수학지도",
    "아동과학지도",
  ],

  safety_life: [
    "아동안전관리",
    "아동생활지도",
  ],
} as const satisfies Record<
  ChildcareRequiredSlotKey,
  readonly string[]
>;

export const CHILDCARE_KNOWLEDGE_ELECTIVE_SUBJECTS = [
  "아동건강교육",
  "영유아사회정서지도",
  "아동문학교육",
  "아동상담론",
  "장애아지도",
  "특수아동이해",
  "어린이집운영관리",
  "영유아보육프로그램개발과평가",
  "보육정책론",
  "정신건강론",
  "인간행동과사회환경",
  "아동간호학",
  "아동영양학",
  "부모교육론",
  "가족복지론",
  "가족관계론",
  "지역사회복지론",
] as const;

export const CHILDCARE_PRACTICE_GROUPS = {
  observation: [
    "아동관찰및행동연구",
  ],

  practice: [
    "보육실습",
  ],
} as const satisfies Record<
  ChildcarePracticeSlotKey,
  readonly string[]
>;

/**
 * 대면수업 8개 조건.
 *
 * 보육실습은 여기 포함하지 않는다.
 *
 * 선택군은 하나의 대면조건으로 계산한다.
 */
export const CHILDCARE_FACE_TO_FACE_GROUPS = {
  teacher_theory: [
    "보육교사론",
    "보육교사(인성)론",
  ],

  child_rights: [
    "아동권리와복지",
  ],

  play_guidance: [
    "놀이지도",
  ],

  language_guidance: [
    "언어지도",
  ],

  art_activity: [
    "아동음악",
    "아동동작",
    "아동미술",
  ],

  math_science: [
    "아동수학지도",
    "아동과학지도",
  ],

  safety_life: [
    "아동안전관리",
    "아동생활지도",
  ],

  observation: [
    "아동관찰및행동연구",
  ],
} as const;

export const CHILD_STUDY_DEGREE_RULE = {
  majorRequiredCore: {
    masterRequiredSubjects:
      7,

    minimumRequiredSubjects:
      5,
  },
} as const;

export const KOREAN_TEACHER_2_RULE = {
  qualificationCredits: {
    area1:
      6,

    area2:
      6,

    area3:
      24,

    area4:
      6,

    area5:
      3,

    total:
      45,
  },

  /**
   * CRM 학위 마스터의 전공필수 7과목은
   * 학위 전필 판정에 사용한다.
   *
   * 한국어교원 자격 자체는
   * 1~5영역 학점기준으로 별도 판정한다.
   */
  degreeMajorRequiredSubjects:
    7,
} as const;

export const LIFELONG_EDUCATOR_2_RULE = {
  totalSubjects:
    10,

  totalCredits:
    30,

  requiredSubjects:
    5,

  electiveSubjects:
    5,

  requiredCredits:
    15,

  electiveCredits:
    15,
} as const;

export const LIFELONG_EDUCATOR_REQUIRED_SUBJECTS = [
  "평생교육론",
  "평생교육방법론",
  "평생교육경영론",
  "평생교육프로그램개발론",
  "평생교육실습",
] as const;

export type KoreanTeacherArea =
  | "area1"
  | "area2"
  | "area3"
  | "area4"
  | "area5";

export const KOREAN_TEACHER_AREA_SUBJECTS = {
  area1: [
    "외국어로서의한국어학개론",
    "한국어학개론",
    "한국어음운론",
    "한국어문법론",
    "한국어어휘론",
    "한국어의미론",
    "한국어화용론",
    "한국어사",
    "한국어어문규범",
  ],

  area2: [
    "언어학개론",
    "일반언어학및응용언어학",
    "응용언어학",
    "대조언어학",
    "사회언어학",
    "심리언어학",
    "외국어습득론",
  ],

  area3: [
    "외국어로서의한국어교육개론",
    "외국어로서의한국어교재론",
    "외국어로서의한국어문법교육론",
    "외국어로서의한국어발음교육론",
    "외국어로서의한국어어휘교육론",
    "외국어로서의한국어이해교육론",
    "외국어로서의한국어표현교육론",
    "외국어로서의한국어읽기교육론",
    "외국어로서의한국어쓰기교육론",
    "외국어로서의한국어듣기교육론",
    "외국어로서의한국어말하기교육론",
    "외국어로서의한국어평가론",
    "외국어로서의한국어교육과정및교수요목설계",
    "외국어로서의한국어교육과정론",
    "외국어로서의한국어교수이론",
    "외국어로서의한국어능력평가론",
  ],

  area4: [
    "한국문화교육론",
    "한국문화론",
    "한국의현대문화",
    "한국의전통문화",
    "한국문학개론",
    "한국현대문학론",
    "한국고전문학론",
  ],

  area5: [
    "외국어로서의한국어교육실습",
    "한국어교육실습",
  ],
} as const satisfies Record<
  KoreanTeacherArea,
  readonly string[]
>;

function normalizeChildcareRuleSubjectName(
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
    .replace(
      /[()（）·ㆍ.,_-]/g,
      ""
    )
    .toLowerCase();
}

export function resolveChildcareTeacherArea(
  subjectName:
    unknown
): ChildcareTeacherArea | null {
  const normalized =
    normalizeChildcareRuleSubjectName(
      subjectName
    );

  if (!normalized) {
    return null;
  }

  const teacherCharacterMatched =
    CHILDCARE_TEACHER_CHARACTER_SUBJECTS
      .some(
        (
          candidate
        ) =>
          normalizeChildcareRuleSubjectName(
            candidate
          ) ===
          normalized
      );

  if (teacherCharacterMatched) {
    return "teacher_character";
  }

  for (
    const subjectNames
    of Object.values(
      CHILDCARE_KNOWLEDGE_REQUIRED_GROUPS
    )
  ) {
    const matched =
      subjectNames.some(
        (
          candidate
        ) =>
          normalizeChildcareRuleSubjectName(
            candidate
          ) ===
          normalized
      );

    if (matched) {
      return "knowledge_required";
    }
  }

  const electiveMatched =
    CHILDCARE_KNOWLEDGE_ELECTIVE_SUBJECTS
      .some(
        (
          candidate
        ) =>
          normalizeChildcareRuleSubjectName(
            candidate
          ) ===
          normalized
      );

  if (electiveMatched) {
    return "knowledge_elective";
  }

  for (
    const subjectNames
    of Object.values(
      CHILDCARE_PRACTICE_GROUPS
    )
  ) {
    const matched =
      subjectNames.some(
        (
          candidate
        ) =>
          normalizeChildcareRuleSubjectName(
            candidate
          ) ===
          normalized
      );

    if (matched) {
      return "practice";
    }
  }

  return null;
}

export function resolveChildcareTeacherCharacterSlot(
  subjectName:
    unknown
): ChildcareTeacherCharacterSlotKey | null {
  const normalized =
    normalizeChildcareRuleSubjectName(
      subjectName
    );

  if (!normalized) {
    return null;
  }

  for (
    const [
      slotKey,
      subjectNames,
    ]
    of Object.entries(
      CHILDCARE_TEACHER_CHARACTER_GROUPS
    )
  ) {
    const matched =
      subjectNames.some(
        (
          candidate
        ) =>
          normalizeChildcareRuleSubjectName(
            candidate
          ) ===
          normalized
      );

    if (matched) {
      return slotKey as
        ChildcareTeacherCharacterSlotKey;
    }
  }

  return null;
}

export function resolveChildcareRequiredSlot(
  subjectName:
    unknown
): ChildcareRequiredSlotKey | null {
  const normalized =
    normalizeChildcareRuleSubjectName(
      subjectName
    );

  if (!normalized) {
    return null;
  }

  for (
    const [
      slotKey,
      subjectNames,
    ]
    of Object.entries(
      CHILDCARE_KNOWLEDGE_REQUIRED_GROUPS
    )
  ) {
    const matched =
      subjectNames.some(
        (
          candidate
        ) =>
          normalizeChildcareRuleSubjectName(
            candidate
          ) ===
          normalized
      );

    if (matched) {
      return slotKey as
        ChildcareRequiredSlotKey;
    }
  }

  return null;
}

export function resolveChildcarePracticeSlot(
  subjectName:
    unknown
): ChildcarePracticeSlotKey | null {
  const normalized =
    normalizeChildcareRuleSubjectName(
      subjectName
    );

  if (!normalized) {
    return null;
  }

  for (
    const [
      slotKey,
      subjectNames,
    ]
    of Object.entries(
      CHILDCARE_PRACTICE_GROUPS
    )
  ) {
    const matched =
      subjectNames.some(
        (
          candidate
        ) =>
          normalizeChildcareRuleSubjectName(
            candidate
          ) ===
          normalized
      );

    if (matched) {
      return slotKey as
        ChildcarePracticeSlotKey;
    }
  }

  return null;
}

export function resolveChildcareFaceToFaceSlot(
  subjectName:
    unknown
): string | null {
  const normalized =
    normalizeChildcareRuleSubjectName(
      subjectName
    );

  if (!normalized) {
    return null;
  }

  for (
    const [
      slotKey,
      subjectNames,
    ]
    of Object.entries(
      CHILDCARE_FACE_TO_FACE_GROUPS
    )
  ) {
    const matched =
      subjectNames.some(
        (
          candidate
        ) =>
          normalizeChildcareRuleSubjectName(
            candidate
          ) ===
          normalized
      );

    if (matched) {
      return slotKey;
    }
  }

  return null;
}

function normalizeKoreanTeacherSubjectName(
  value:
    unknown
) {
  return String(
    value ??
    ""
  )
    .trim()
    .replace(
      /\s+/g,
      ""
    )
    .replace(
      /[()（）·ㆍ.,_-]/g,
      ""
    )
    .toLowerCase();
}

export function resolveKoreanTeacherArea(
  subjectName:
    unknown
): KoreanTeacherArea | null {
  const normalized =
    normalizeKoreanTeacherSubjectName(
      subjectName
    );

  if (!normalized) {
    return null;
  }

  for (
    const [
      area,
      subjectNames,
    ]
    of Object.entries(
      KOREAN_TEACHER_AREA_SUBJECTS
    )
  ) {
    const matched =
      subjectNames.some(
        (
          candidate
        ) =>
          normalizeKoreanTeacherSubjectName(
            candidate
          ) ===
          normalized
      );

    if (matched) {
      return area as
        KoreanTeacherArea;
    }
  }

  return null;
}

export type RiskRecommendationReason =
  | "missing_required"
  | "missing_elective"
  | "missing_major_credit"
  | "missing_liberal_credit"
  | "duplicate_transfer"
  | "equivalent_subject"
  | "face_to_face_required"
  | "practice_required"
  | "replacement_needed";

export type RiskMasterSubjectCandidate = {
  id:
    number;

  catalogId:
    number;

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
    "일반";

  credits:
    number;

  semesterNo:
    number | null;

  isFaceToFace:
    boolean;

  recommendationReason:
    RiskRecommendationReason;
};

export function isFaceToFaceMasterSubject(
  subjectName:
    unknown
) {
  return String(
    subjectName ??
    ""
  ).includes(
    CHILDCARE_TEACHER_2_RULE
      .faceToFaceMasterMarker
  );
}