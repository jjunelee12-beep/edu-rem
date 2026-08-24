import type {
  UnifiedQualificationRequirements,
} from "./qualification-requirement-merger";

import type {
  QualificationSubjectPlannerResult,
} from "./qualification-subject-planner";

import type {
  QualificationSemesterPlannerResult,
} from "./qualification-semester-planner";

import type {
  AdministrativeTimelinePlannerResult,
} from "./administrative-timeline-planner";

export type StudentAcademicSummaryStatus =
  | "ready"
  | "review_required";

export type StudentAcademicSummaryResult = {
  status:
    StudentAcademicSummaryStatus;

  canExplain:
    boolean;

  course: {
    courseKey:
      UnifiedQualificationRequirements["courseKey"];

    courseLabel:
      string;

    finalEducationGroup:
      UnifiedQualificationRequirements["finalEducationGroup"];

    finalEducationLabel:
      string;

    lawVersion:
      string | null;

    lawLabel:
      string | null;
  };

  qualification: {
    requiredSubjects:
      number | null;

    completedSubjects:
      number | null;

    remainingSubjects:
      number | null;

    requiredCredits:
      number | null;

    completedCredits:
      number | null;

    remainingCredits:
      number | null;

    practiceHours:
      number | null;
  };

retake: {
  count:
    number;

  subjects:
    Array<{
      id:
        number | null;

      semesterNo:
        number | null;

      subjectName:
        string;

      requirementType:
        string | null;

      category:
        string | null;

      credits:
        number;
    }>;
};

  /**
   * 법규 계산에 사용되는
   * 자격/학위 과목마스터 무결성 점검 결과.
   *
   * 정상인 경우 빈 배열이다.
   *
   * 예:
   * - 아동학 전필 마스터 7개 불일치
   * - 한국어교육 전필 마스터 7개 불일치
   * - 보육교사 아동전공 전필 마스터 불일치
   */
  masterIntegrity:
    Array<{
      code:
        string;

      title:
        string;

      expectedSubjects:
        number | null;

      actualSubjects:
        number | null;

      registeredSubjectNames:
        string[];

      message:
        string;
    }>;

  degree: {
    requiresNewDegreeTrack:
      boolean;

    degreeType:
      UnifiedQualificationRequirements["degree"]["degreeType"];

    degreeLabel:
      string | null;

    requiredTotalCredits:
      number | null;

    currentTotalCredits:
      number;

    remainingTotalCredits:
      number | null;

    requiredMajorCredits:
      number | null;

    currentMajorCredits:
      number;

    remainingMajorCredits:
      number | null;

        requiredLiberalCredits:
      number | null;

    currentLiberalCredits:
      number;

    remainingLiberalCredits:
      number | null;

    currentGeneralCredits:
      number;
  };

  studyPlan: {
    additionalSubjectCount:
      number;

    additionalCredits:
      number;

    semesterCount:
  number;

nominalDurationMonths:
  number;

estimatedStudyStartDate:
  string | null;

estimatedStudyEndDate:
  string | null;

firstSemesterLabel:
  string | null;

lastSemesterLabel:
  string | null;

existingSemesters:
  Array<{
    semesterOrder:
      number;

    semesterLabel:
      string | null;

    actualStartDate:
      string | null;

    subjectCount:
      number;

    subjectNames:
      string[];
  }>;

semesters:
  Array<{
        semesterOrder:
          number;

        semesterLabel:
          string;

        subjectCount:
          number;

estimatedStartDate:
  string;

estimatedEndDate:
  string;

        subjectNames:
          string[];

        annualSubjectCountAfterPlacement:
          number;
      }>;

    selectedSubjectNames:
      string[];
  };

  timeline: {
    academicCompletionSemesterLabel:
      string | null;

academicCompletionDate:
  string | null;

creditRecognitionLabel:
  string | null;

creditRecognitionYear:
  number | null;

creditRecognitionMonth:
  1 | 4 | 7 | 10 | null;

    degreeApplicationLabel:
      string | null;

    degreeApplicationStartDate:
      string | null;

    degreeApplicationEndDate:
      string | null;

    degreeAwardLabel:
      string | null;

    degreeAwardDate:
      string | null;

    qualificationApplicationBasis:
      AdministrativeTimelinePlannerResult["qualification"]["applicationBasis"];

    qualificationEstimatedDate:
      string | null;

    qualificationMessage:
      string;
  };

  /**
   * AI가 바로 답변에 사용할 수 있는
   * 공통 요약문.
   *
   * AI가 법규/학점을 다시 계산하지 않고
   * 이 배열의 서버 계산결과를 설명하도록 한다.
   */
  summaryLines:
    string[];

  warnings:
    string[];

  unresolvedReasons:
    string[];
};

function uniqueStrings(
  values:
    Array<
      string |
      null |
      undefined
    >
) {
  return Array.from(
    new Set(
      values
        .map(
          (
            value
          ) =>
            String(
              value ??
              ""
            ).trim()
        )
        .filter(
          Boolean
        )
    )
  );
}

function resolveCourseLabel(
  courseKey:
    UnifiedQualificationRequirements["courseKey"]
) {
  switch (
    courseKey
  ) {
    case "social_worker_2":
      return "사회복지사 2급";

    case "childcare_teacher_2":
      return "보육교사 2급";

    case "korean_teacher_2":
      return "한국어교원 2급";

    case "child_study_degree":
      return "아동학사";

    case "lifelong_educator_2":
      return "평생교육사 2급";

    default:
      return "과정 미확인";
  }
}

function resolveFinalEducationLabel(
  value:
    UnifiedQualificationRequirements["finalEducationGroup"]
) {
  switch (
    value
  ) {
    case "high_school":
      return "고졸/대학 중퇴";

    case "associate":
      return "전문학사";

    case "bachelor":
      return "학사";

    case "graduate":
      return "대학원 이상";

    default:
      return "최종학력 확인 필요";
  }
}

function resolveDegreeLabel(
  value:
    UnifiedQualificationRequirements["degree"]["degreeType"]
) {
  switch (
    value
  ) {
    case "associate":
      return "전문학사";

    case "bachelor":
      return "학사";

    case "associate_second_major":
      return "전문학사 타전공";

    case "bachelor_second_major":
      return "학사 타전공";

    default:
      return null;
  }
}

function resolveLawLabel(
  lawVersion:
    unknown
) {
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
    return "구법";
  }

  if (
    normalized ===
      "current" ||
    normalized ===
      "new" ||
    normalized ===
      "신법"
  ) {
    return "신법";
  }

  if (
    normalized ===
    "review_required"
  ) {
    return "적용기준 확인 필요";
  }

  return null;
}

function buildQualificationSummaryLine(
  requirements:
    UnifiedQualificationRequirements
) {
  const {
    requiredSubjects,
    completedSubjects,
    remainingSubjects,
    requiredCredits,
    completedCredits,
    remainingCredits,
  } =
    requirements
      .qualification;

  if (
    requiredSubjects !==
      null &&
    completedSubjects !==
      null &&
    remainingSubjects !==
      null
  ) {
    return (
      `자격요건은 총 ${requiredSubjects}과목 중 ` +
      `${completedSubjects}과목이 인정되며 ` +
      `${remainingSubjects}과목이 남아 있습니다.` +
      (
        requiredCredits !==
          null &&
        completedCredits !==
          null &&
        remainingCredits !==
          null
          ? ` 학점 기준은 ${requiredCredits}학점 중 ${completedCredits}학점 인정, ${remainingCredits}학점 부족입니다.`
          : ""
      )
    );
  }

  if (
    requiredCredits !==
      null &&
    completedCredits !==
      null &&
    remainingCredits !==
      null
  ) {
    return (
      `자격 영역 기준 ${requiredCredits}학점 중 ` +
      `${completedCredits}학점이 인정되며 ` +
      `${remainingCredits}학점이 남아 있습니다.`
    );
  }

  return null;
}

function buildDegreeSummaryLine(
  requirements:
    UnifiedQualificationRequirements
) {
  if (
    !requirements
      .degree
      .requiresNewDegreeTrack
  ) {
    return "현재 최종학력 기준으로 새 학위 취득과정은 필요하지 않습니다.";
  }

  const degree =
    requirements.degree;

  const degreeLabel =
    resolveDegreeLabel(
      degree.degreeType
    ) ||
    "학위";

  const parts:
    string[] =
    [];

  if (
    degree.requiredTotalCredits !==
      null &&
    degree.remainingTotalCredits !==
      null
  ) {
    parts.push(
      `총 ${degree.requiredTotalCredits}학점 중 현재 ${degree.currentTotalCredits}학점 인정, ${degree.remainingTotalCredits}학점 부족`
    );
  }

  if (
    degree.requiredMajorCredits !==
      null &&
    degree.remainingMajorCredits !==
      null
  ) {
    parts.push(
      `전공 ${degree.requiredMajorCredits}학점 기준 ${degree.remainingMajorCredits}학점 부족`
    );
  }

  if (
    degree.requiredLiberalCredits !==
      null &&
    degree.remainingLiberalCredits !==
      null
  ) {
    parts.push(
      `교양 ${degree.requiredLiberalCredits}학점 기준 ${degree.remainingLiberalCredits}학점 부족`
    );
  }

  if (
    parts.length ===
    0
  ) {
    return `${degreeLabel} 취득과정이 필요합니다.`;
  }

  return (
    `${degreeLabel} 취득이 필요하며 ` +
    `${parts.join(
      ", "
    )}입니다.`
  );
}

function buildSemesterSummaryLine(
  semesterPlan:
    QualificationSemesterPlannerResult
) {
  if (
    !semesterPlan.canPlan
  ) {
    return null;
  }

  if (
    semesterPlan
      .semesterCount <=
    0
  ) {
    return "추가 수강과목에 대한 신규 학기 배치는 필요하지 않습니다.";
  }

  const semesterLabels =
  semesterPlan
    .semesters
    .map(
      (
        semester
      ) =>
        `${semester.semesterLabel} ${semester.subjectCount}과목 ` +
        `(${semester.estimatedStartDate} ~ ${semester.estimatedEndDate})`
    )
    .join(
      " → "
    );

  return (
  `추가과목은 총 ${semesterPlan.semesterCount}개 학기로 배치되며 ` +
  `학기당 4개월 기준 총 ${semesterPlan.nominalDurationMonths}개월 과정입니다. ` +
  `${semesterLabels} 순서이며 ` +
  `최종 학습 종료 예상일은 ${semesterPlan.estimatedStudyEndDate || "확인 필요"}입니다.`
);
}

export function resolveStudentAcademicSummary(
  params: {
    requirements:
      UnifiedQualificationRequirements;

    subjectPlan:
      QualificationSubjectPlannerResult;

    semesterPlan:
      QualificationSemesterPlannerResult;

    administrativeTimeline:
      AdministrativeTimelinePlannerResult;

retakeSubjects:
  Array<{
    id:
      number | null;

    semesterNo:
      number | null;

    subjectName:
      string;

    requirementType:
      string | null;

    category:
      string | null;

    credits:
      number;
  }>;
  }
): StudentAcademicSummaryResult {
  const {
  requirements,
  subjectPlan,
  semesterPlan,
  administrativeTimeline,
} =
  params;

const retakeSubjects =
  Array.isArray(
    params.retakeSubjects
  )
    ? params.retakeSubjects
    : [];

  const courseLabel =
    resolveCourseLabel(
      requirements
        .courseKey
    );

  const finalEducationLabel =
    resolveFinalEducationLabel(
      requirements
        .finalEducationGroup
    );

  const lawVersion =
    requirements
      .qualification
      .lawVersion;

  const lawLabel =
    resolveLawLabel(
      lawVersion
    );

  const degreeLabel =
    resolveDegreeLabel(
      requirements
        .degree
        .degreeType
    );

  /**
   * ─────────────────────────────
   * 과목마스터 무결성 오류 추출
   * ─────────────────────────────
   *
   * Analyzer가 만들어 둔 서버 판정값만 사용한다.
   * 여기서 과목 수를 다시 계산하지 않는다.
   */
  const masterIntegrity =
    (
      requirements
        .qualification
        .requirementIssues ||
      []
    )
      .filter(
        (
          issue
        ) =>
          issue.code ===
            "CHILD_STUDY_MAJOR_REQUIRED_MASTER_INVALID" ||
          issue.code ===
            "KOREAN_TEACHER_DEGREE_REQUIRED_MASTER_INVALID" ||
          issue.code ===
            "CHILDCARE_DEGREE_MAJOR_REQUIRED_MASTER_INVALID"
      )
      .map(
        (
          issue
        ) => {
          const details =
            (
              issue.details &&
              typeof issue.details ===
                "object" &&
              !Array.isArray(
                issue.details
              )
            )
              ? issue.details as
                  Record<
                    string,
                    unknown
                  >
              : {};

          const expectedSubjects =
            Number(
              details
                .expectedSubjects
            );

          const actualSubjects =
            Number(
              details
                .actualSubjects
            );

          const registeredSubjectNames =
            Array.isArray(
              details
                .registeredSubjectNames
            )
              ? details
                  .registeredSubjectNames
                  .map(
                    (
                      subjectName
                    ) =>
                      String(
                        subjectName ??
                        ""
                      ).trim()
                  )
                  .filter(
                    Boolean
                  )
              : [];

          return {
            code:
              issue.code,

            title:
              issue.title,

            expectedSubjects:
              Number.isFinite(
                expectedSubjects
              )
                ? expectedSubjects
                : null,

            actualSubjects:
              Number.isFinite(
                actualSubjects
              )
                ? actualSubjects
                : null,

            registeredSubjectNames,

            message:
              issue.message,
          };
        }
      );

  const unresolvedReasons =
    uniqueStrings([
      ...(
        requirements
          .blockingReasons ||
        []
      ),

      ...(
        subjectPlan
          .unresolvedRequirements ||
        []
      ).map(
        (
          item
        ) =>
          item.message
      ),

      ...(
        semesterPlan
          .unresolvedReasons ||
        []
      ),

      ...(
        administrativeTimeline
          .unresolvedReasons ||
        []
      ),
    ]);

  const warnings =
    uniqueStrings([
      ...(
        subjectPlan
          .warnings ||
        []
      ),

      ...(
        semesterPlan
          .warnings ||
        []
      ),

      ...(
        administrativeTimeline
          .warnings ||
        []
      ),
    ]);

  const summaryLines:
    string[] =
    [];

  summaryLines.push(
    `${courseLabel} 과정이며 최종학력 판정은 ${finalEducationLabel}입니다.`
  );

  if (
    lawLabel
  ) {
    summaryLines.push(
      `사회복지사 적용기준은 ${lawLabel}으로 판정되었습니다.`
    );
  }

  if (
    masterIntegrity.length >
    0
  ) {
    for (
      const masterIssue
      of masterIntegrity
    ) {
      summaryLines.push(
        masterIssue.message
      );

      if (
        masterIssue
          .registeredSubjectNames
          .length >
        0
      ) {
        summaryLines.push(
          `현재 전공필수 마스터 등록과목: ${masterIssue.registeredSubjectNames.join(", ")}`
        );
      }
    }
  }

    const qualificationLine =
    requirements
      .qualification
      .canAnalyze
      ? buildQualificationSummaryLine(
          requirements
        )
      : null;

  if (
    qualificationLine
  ) {
    summaryLines.push(
      qualificationLine
    );
  }

if (
  retakeSubjects.length >
  0
) {
  summaryLines.push(
    `재수강이 필요한 과목은 ${retakeSubjects.length}과목이며 기존 인정 계산에서는 제외되어 다시 이수해야 합니다.`
  );
}

  const degreeLine =
    buildDegreeSummaryLine(
      requirements
    );

  if (
    degreeLine
  ) {
    summaryLines.push(
      degreeLine
    );
  }

  if (
    subjectPlan.canPlan
  ) {
    if (
      subjectPlan
        .selectedSubjectCount >
      0
    ) {
      summaryLines.push(
        `현재 인정내역과 학위·자격조건을 함께 반영하면 추가 수강계획은 ${subjectPlan.selectedSubjectCount}과목, ${subjectPlan.selectedCredits}학점입니다.`
      );
    } else {
      summaryLines.push(
        "현재 계산상 추가로 선택해야 할 수강과목은 없습니다."
      );
    }
  }

  const semesterLine =
    buildSemesterSummaryLine(
      semesterPlan
    );

  if (
    semesterLine
  ) {
    summaryLines.push(
      semesterLine
    );
  }

if (
  administrativeTimeline
    .academicCompletionDate
) {
  summaryLines.push(
    `최종 학습 종료 예상일은 ${administrativeTimeline.academicCompletionDate}입니다.`
  );
}

if (
  administrativeTimeline
    .creditRecognition
    .nextAvailableWindow
) {
  summaryLines.push(
    `최종 학습 종료 후 가장 빠른 학점인정신청 예상시점은 ${administrativeTimeline.creditRecognition.nextAvailableWindow.label}입니다.`
  );
}

  if (
    administrativeTimeline
      .degree
      .required &&
    administrativeTimeline
      .degree
      .applicationWindow
  ) {
    summaryLines.push(
      `학위신청 예상기간은 ${administrativeTimeline.degree.applicationWindow.label}이며 학위수여 예상시점은 ${administrativeTimeline.degree.estimatedAwardLabel || "확인 필요"}입니다.`
    );
  }

  if (
    administrativeTimeline
      .qualification
      .applicable
  ) {
    summaryLines.push(
      administrativeTimeline
        .qualification
        .message
    );
  }

  if (
    unresolvedReasons.length >
    0
  ) {
    summaryLines.push(
      `확정 전에 추가 확인이 필요한 항목이 ${unresolvedReasons.length}건 있습니다.`
    );
  }

  const status:
    StudentAcademicSummaryStatus =
    requirements
      .requiresReview ||
    !subjectPlan.canPlan ||
    !semesterPlan.canPlan ||
    !administrativeTimeline
      .canCalculate ||
    unresolvedReasons.length >
      0
      ? "review_required"
      : "ready";

  return {
    status,

    /**
     * review_required 상태여도
     * 확인된 범위까지는 설명 가능하다.
     */
    canExplain:
      true,

    course: {
      courseKey:
        requirements
          .courseKey,

      courseLabel,

      finalEducationGroup:
        requirements
          .finalEducationGroup,

      finalEducationLabel,

      lawVersion,

      lawLabel,
    },

    qualification: {
      requiredSubjects:
        requirements
          .qualification
          .requiredSubjects,

      completedSubjects:
        requirements
          .qualification
          .completedSubjects,

      remainingSubjects:
        requirements
          .qualification
          .remainingSubjects,

      requiredCredits:
        requirements
          .qualification
          .requiredCredits,

      completedCredits:
        requirements
          .qualification
          .completedCredits,

      remainingCredits:
        requirements
          .qualification
          .remainingCredits,

      practiceHours:
        requirements
          .qualification
          .practiceHours,
    },

    retake: {
      count:
        retakeSubjects.length,

      subjects:
        retakeSubjects,
    },

    masterIntegrity,

    degree: {
      requiresNewDegreeTrack:
        requirements
          .degree
          .requiresNewDegreeTrack,

      degreeType:
        requirements
          .degree
          .degreeType,

      degreeLabel,

      requiredTotalCredits:
        requirements
          .degree
          .requiredTotalCredits,

      currentTotalCredits:
        requirements
          .degree
          .currentTotalCredits,

      remainingTotalCredits:
        requirements
          .degree
          .remainingTotalCredits,

      requiredMajorCredits:
        requirements
          .degree
          .requiredMajorCredits,

      currentMajorCredits:
        requirements
          .degree
          .currentMajorCredits,

      remainingMajorCredits:
        requirements
          .degree
          .remainingMajorCredits,

      requiredLiberalCredits:
        requirements
          .degree
          .requiredLiberalCredits,

      currentLiberalCredits:
        requirements
          .degree
          .currentLiberalCredits,

      remainingLiberalCredits:
        requirements
          .degree
          .remainingLiberalCredits,

      currentGeneralCredits:
        requirements
          .degree
          .currentGeneralCredits,
    },

    studyPlan: {
      additionalSubjectCount:
        subjectPlan
          .selectedSubjectCount,

      additionalCredits:
        subjectPlan
          .selectedCredits,

      semesterCount:
        semesterPlan
          .semesterCount,

      nominalDurationMonths:
        semesterPlan
          .nominalDurationMonths,

      estimatedStudyStartDate:
        semesterPlan
          .estimatedStudyStartDate,

      estimatedStudyEndDate:
        semesterPlan
          .estimatedStudyEndDate,

      firstSemesterLabel:
        semesterPlan
          .firstSemesterLabel,

      lastSemesterLabel:
        semesterPlan
          .lastSemesterLabel,

existingSemesters:
  (
    semesterPlan
      .existingSemesters ||
    []
  ).map(
    (
      semester
    ) => ({
      semesterOrder:
        semester.semesterOrder,

      semesterLabel:
        semester.semesterLabel,

      actualStartDate:
        semester.actualStartDate,

      subjectCount:
        semester.subjectCount,

      subjectNames:
        (
          semester.subjects ||
          []
        ).map(
          (
            subject
          ) =>
            subject.subjectName
        ),
    })
  ),


      semesters:
        semesterPlan
          .semesters
          .map(
            (
              semester
            ) => ({
              semesterOrder:
                semester
                  .semesterOrder,

              semesterLabel:
                semester
                  .semesterLabel,

              subjectCount:
                semester
                  .subjectCount,

estimatedStartDate:
  semester
    .estimatedStartDate,

estimatedEndDate:
  semester
    .estimatedEndDate,

              subjectNames:
                semester
                  .subjects
                  .map(
                    (
                      subject
                    ) =>
                      subject
                        .subjectName
                  ),

              annualSubjectCountAfterPlacement:
                semester
                  .annualSubjectCountAfterPlacement,
            })
          ),

      selectedSubjectNames:
        subjectPlan
          .selectedSubjects
          .map(
            (
              subject
            ) =>
              subject
                .subjectName
          ),
    },

    timeline: {
      academicCompletionSemesterLabel:
        administrativeTimeline
          .academicCompletionSemesterLabel,

academicCompletionDate:
  administrativeTimeline
    .academicCompletionDate,

creditRecognitionLabel:
  administrativeTimeline
    .creditRecognition
    .nextAvailableWindow
    ?.label ??
  null,

creditRecognitionYear:
  administrativeTimeline
    .creditRecognition
    .nextAvailableWindow
    ?.year ??
  null,

creditRecognitionMonth:
  administrativeTimeline
    .creditRecognition
    .nextAvailableWindow
    ?.month ??
  null,

      degreeApplicationLabel:
        administrativeTimeline
          .degree
          .applicationWindow
          ?.label ??
        null,

      degreeApplicationStartDate:
        administrativeTimeline
          .degree
          .applicationWindow
          ?.startDate ??
        null,

      degreeApplicationEndDate:
        administrativeTimeline
          .degree
          .applicationWindow
          ?.endDate ??
        null,

      degreeAwardLabel:
        administrativeTimeline
          .degree
          .estimatedAwardLabel,

      degreeAwardDate:
        administrativeTimeline
          .degree
          .estimatedAwardDate,

      qualificationApplicationBasis:
        administrativeTimeline
          .qualification
          .applicationBasis,

      qualificationEstimatedDate:
        administrativeTimeline
          .qualification
          .earliestEstimatedDate,

      qualificationMessage:
        administrativeTimeline
          .qualification
          .message,
    },

    summaryLines,

    warnings,

    unresolvedReasons,
  };
}