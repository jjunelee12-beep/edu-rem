import * as db from "./db";

import {
  resolveNileRecognizedSubjects,
} from "./nile/nile-recognized-subject-resolver";

import {
  getConfirmedSubjectEquivalenceKey,
} from "./ai/risk-rules/subject-equivalence-resolver";

import {
  resolveSocialWorkerLaw,
} from "./ai/risk-rules/social-worker-law-resolver";

import {
  resolveDegreeRequirement,
} from "./ai/risk-rules/degree-requirement-resolver";

import {
  analyzeDegreeCredits,
  type DegreeCreditRecognizedSubject,
} from "./ai/risk-rules/degree-credit-analyzer";

import {
  analyzeQualificationRisk,
  type QualificationRiskMasterItem,
  type QualificationRecognizedSubject,
} from "./ai/risk-rules/qualification-risk-analyzer";

import {
  planQualificationSemesters,
} from "./ai/risk-rules/qualification-semester-planner";

import {
  planAdministrativeTimeline,
} from "./ai/risk-rules/administrative-timeline-planner";


import {
  planQualificationSubjects,
  type QualificationSubjectPlannerResult,
  type DegreeFillTemplateItem,
  type DegreeSubjectClassification,
} from "./ai/risk-rules/qualification-subject-planner";

import {
  mergeQualificationRequirements,
  type UnifiedQualificationRequirements,
} from "./ai/risk-rules/qualification-requirement-merger";



export async function loadSocialWorkerGuideCatalog(
  organizationId: number
) {
  if (
    !Number.isSafeInteger(organizationId) ||
    organizationId <= 0
  ) {
    throw new Error("올바른 교육기관 정보가 필요합니다.");
  }

  // 1. 기존 CRM 과정마스터 조회
  const catalogs = await db.listSubjectCatalogs({
    organizationId,
    activeOnly: true,
  });

  const catalog = catalogs.find(
    (item) =>
      String(item.canonicalKey ?? "").trim() ===
      "social_worker_2"
  );

  if (!catalog) {
    throw new Error(
      "사회복지사 2급 과정마스터를 찾을 수 없습니다."
    );
  }

  const catalogId = Number(catalog.id);

  // 2. 실제 자격과목 및 학위용 템플릿 조회
  const [masterItems, degreeTemplates] =
    await Promise.all([
      db.listSubjectCatalogItems({
        organizationId,
        catalogId,
        activeOnly: true,
      }),
      db.listCourseSubjectTemplates(undefined, {
        organizationId,
        catalogId,
      }),
    ]);

  if (!masterItems.length) {
    throw new Error(
      "사회복지사 2급 과목마스터가 비어 있습니다."
    );
  }

  return {
    catalogId,
    masterItems,
    degreeTemplates,
  };
}

export async function getSocialWorkerGuideSubjectOptions(
  organizationId: number
) {
  const catalog =
    await loadSocialWorkerGuideCatalog(
      organizationId
    );

  const seenKeys = new Set<string>();

  const requiredSubjects: Array<{
    subjectName: string;
    credits: number;
  }> = [];

  const electiveSubjects: Array<{
    subjectName: string;
    credits: number;
  }> = [];

  for (const item of catalog.masterItems) {
    const subjectName = String(
      item.subjectName ?? ""
    ).trim();

    const key =
      getConfirmedSubjectEquivalenceKey(
        subjectName
      );

    const requirementType = String(
      item.requirementType ?? ""
    ).trim();

    if (!subjectName || !key) continue;

    if (seenKeys.has(key)) continue;

    if (
      requirementType !== "전공필수" &&
      requirementType !== "전공선택"
    ) {
      continue;
    }

    seenKeys.add(key);

    const subject = {
      subjectName,
      credits: Number(item.credits ?? 3),
    };

    if (requirementType === "전공필수") {
      requiredSubjects.push(subject);
    } else {
      electiveSubjects.push(subject);
    }
  }

  return {
    requiredSubjects,
    electiveSubjects,
    requiredSubjectCount:
      requiredSubjects.length,
    electiveSubjectCount:
      electiveSubjects.length,
  };
}

export async function buildSocialWorkerGuideNileClassification(
  params: {
    degreeRequirement: ReturnType<
      typeof resolveDegreeRequirement
    >;
    masterItems: Array<{
      subjectName: string;
      requirementType?: string | null;
      category?: string | null;
    }>;
    degreeTemplates: Array<{
      subjectName: string;
      requirementType?: string | null;
      category?: string | null;
    }>;
  }
) {
  const classificationMap =
  new Map<
    string,
    DegreeSubjectClassification & {
      isLiberalCompatible?: boolean;
    }
  >();

  // 전문대졸 이상: 신규 학위 불필요
  if (!params.degreeRequirement.requiresNewDegreeTrack) {
    return classificationMap;
  }

  const candidateMap = new Map<
    string,
    {
      subjectName: string;
      requirementType: string | null;
      category: string | null;
      credits: number;
      source: "plan";
    }
  >();

  // 기존 CRM과 동일한 과목 후보 구성
  for (const item of [
    ...params.masterItems,
    ...params.degreeTemplates,
  ]) {
    const subjectName = String(
      item.subjectName ?? ""
    ).trim();

    if (!subjectName) continue;

    const key =
      getConfirmedSubjectEquivalenceKey(subjectName);

    if (!key || candidateMap.has(key)) continue;

    candidateMap.set(key, {
      subjectName,
      requirementType: item.requirementType ?? null,
      category: item.category ?? null,
      credits: 3,
      source: "plan",
    });
  }

  if (candidateMap.size === 0) {
    throw new Error(
      "학위설계용 과목 후보가 없습니다."
    );
  }

  const nileResult =
    await resolveNileRecognizedSubjects({
      courseKey: "social_worker_2",
      degreeRequirement: params.degreeRequirement,
      subjects: Array.from(candidateMap.values()),
    });

  // 공식 분류 실패 시 잘못된 학위설계 방지
  if (!nileResult.canResolve) {
    throw new Error(
      nileResult.warnings.join(" / ") ||
      "NILE 공식 학위분류를 확인할 수 없습니다."
    );
  }

  for (const subject of nileResult.subjects) {
    const key =
      getConfirmedSubjectEquivalenceKey(
        subject.subjectName
      );

    if (!key) continue;

    const category = subject.category;
    const requirementType = subject.requirementType;

    if (
      category !== "전공" &&
      category !== "교양" &&
      category !== "일반"
    ) {
      continue;
    }

    if (
      requirementType !== "전공필수" &&
      requirementType !== "전공선택" &&
      requirementType !== "교양" &&
      requirementType !== "일반"
    ) {
      continue;
    }

    classificationMap.set(key, {
  category,
  requirementType,

  isLiberalCompatible:
    subject.nileClassificationSource ===
      "major_liberal_compatible" &&
    category === "전공" &&
    requirementType === "전공선택",
});
  }

  if (classificationMap.size === 0) {
    throw new Error(
      "NILE 공식 과목 분류 결과가 비어 있습니다."
    );
  }

  return classificationMap;
}



type EducationGroup =
  | "college_or_higher"
  | "high_school";

export type SocialWorkerGuidePersonalInput = {
  educationGroup: EducationGroup;

  previousStudy:
    | "none"
    | "yes"
    | "unknown";

  completedSubjects: Array<{
    subjectName: string;
    completionYear: number | null;
  }>;

  existingCredits: {
    major: number;
    liberal: number;
    general: number;
  };

  creditStatus:
    | "none"
    | "known"
    | "unknown";
};


function buildSocialWorkerGuideRecognizedSubjects(params: {
  masterItems: QualificationRiskMasterItem[];
  personalInput?: SocialWorkerGuidePersonalInput;
}) {
  const recognizedSubjects: QualificationRecognizedSubject[] = [];

  const transferSubjects: Array<{
    subjectName: string;
    completionYear: number | null;
  }> = [];

  const unmatchedSubjects: string[] = [];

  const seenKeys = new Set<string>();

  const input = params.personalInput;

  if (input?.previousStudy === "yes") {
    for (const subject of input.completedSubjects) {
      const key = getConfirmedSubjectEquivalenceKey(
        subject.subjectName
      );

      if (!key) continue;

      const master = params.masterItems.find(
        item =>
          getConfirmedSubjectEquivalenceKey(
            item.subjectName
          ) === key
      );

      if (!master) {
        unmatchedSubjects.push(subject.subjectName);
        continue;
      }

      // 동일과목이 여러 번 입력되어도
      // 법규 판정에는 이수연도 정보를 보존
      transferSubjects.push({
        subjectName: master.subjectName,
        completionYear: subject.completionYear,
      });

      // 인정과목은 한 번만 계산
      if (seenKeys.has(key)) continue;

      seenKeys.add(key);

      recognizedSubjects.push({
        subjectName: master.subjectName,
        requirementType: master.requirementType,
        category: master.category,
        credits: Number(master.credits ?? 0),
        source: "transfer",
      });
    }
  }

  const lawResolution = resolveSocialWorkerLaw({
    masterItems: params.masterItems,
    transferSubjects,
  });

  const lawVersion =
    lawResolution.effectiveLawVersion ?? "current";

  const requiresReview =
    input?.previousStudy === "unknown" ||
    input?.creditStatus === "unknown" ||
    (
      input?.previousStudy === "yes" &&
      recognizedSubjects.length === 0
    ) ||
    unmatchedSubjects.length > 0 ||
    lawResolution.requiresReview;

  return {
    recognizedSubjects,
    transferSubjects,
    unmatchedSubjects,
    lawResolution,
    lawVersion,
    requiresReview,
  };
}

function buildSocialWorkerGuideDegreeSubjects(params: {
  personalInput?: SocialWorkerGuidePersonalInput;

  recognizedSubjects: QualificationRecognizedSubject[];

  degreeClassificationBySubjectKey?: Map<
    string,
    DegreeSubjectClassification
  >;
}) {
  const input = params.personalInput;

  const subjects: DegreeCreditRecognizedSubject[] = [];

  let requiresReview = false;

  if (!input || input.educationGroup !== "high_school") {
    return {
      subjects,
      requiresReview,
    };
  }

  // 기존 사회복지 과목을 공식 학위분류로 변환
  for (const subject of params.recognizedSubjects) {
    const key = getConfirmedSubjectEquivalenceKey(
      subject.subjectName
    );

    const classification =
      params.degreeClassificationBySubjectKey?.get(key);

    if (!classification) {
      requiresReview = true;
      continue;
    }

    subjects.push({
      ...subject,
      category: classification.category,
      requirementType: classification.requirementType,
    });
  }

  if (input.creditStatus !== "known") {
    return {
      subjects,
      requiresReview:
        requiresReview ||
        input.creditStatus === "unknown",
    };
  }

  // 기존 이수과목에 포함된 학점
  const countedCredits = {
    major: 0,
    liberal: 0,
    general: 0,
  };

  for (const subject of subjects) {
    if (subject.category === "전공") {
      countedCredits.major += subject.credits;
    } else if (subject.category === "교양") {
      countedCredits.liberal += subject.credits;
    } else if (subject.category === "일반") {
      countedCredits.general += subject.credits;
    }
  }

  const creditGroups = [
    {
      key: "major",
      category: "전공",
      requirementType: "전공선택",
    },
    {
      key: "liberal",
      category: "교양",
      requirementType: "교양",
    },
    {
      key: "general",
      category: "일반",
      requirementType: "일반",
    },
  ] as const;

  for (const group of creditGroups) {
    const totalCredits = Number(
      input.existingCredits[group.key]
    );

    if (
      !Number.isSafeInteger(totalCredits) ||
      totalCredits < 0 ||
      totalCredits > 140
    ) {
      throw new Error(
        "기존 보유학점을 정확하게 입력해 주세요."
      );
    }

   const remainingCredits =
  totalCredits - countedCredits[group.key];

if (remainingCredits < 0) {
  throw new Error(
    "입력한 보유학점과 기존 사회복지 이수과목의 학점이 일치하지 않습니다."
  );
}

    if (remainingCredits === 0) continue;

    // 개인별 예상일 계산에만 사용하는 집계 학점
    subjects.push({
      subjectName:
        `사전설계보유학점_${group.key}`,

      category: group.category,

      requirementType: group.requirementType,

      credits: remainingCredits,

      source: "transfer",
    });
  }

  // 성적증명서 확인 전에는 확정학점이 아님
  requiresReview = true;

  return {
    subjects,
    requiresReview,
  };
}

export function buildSocialWorkerGuideRequirements(params: {
  educationGroup: EducationGroup;
  masterItems: QualificationRiskMasterItem[];
  personalInput?: SocialWorkerGuidePersonalInput;

  degreeClassificationBySubjectKey?: Map<
    string,
    DegreeSubjectClassification
  >;
}) {
  const finalEducation =
    params.educationGroup === "high_school"
      ? "고졸"
      : "전문대졸";

  // 1. 기존 학위요건 엔진
  const degreeRequirement =
    resolveDegreeRequirement({
      courseKey: "social_worker_2",
      finalEducation,
    });

  // 2. 기존 이수과목 및 구법·신법 판정
  const previousStudyAnalysis =
    buildSocialWorkerGuideRecognizedSubjects({
      masterItems: params.masterItems,
      personalInput: params.personalInput,
    });

  // 3. 기존 보유학점 및 공식 학위분류 반영
const previousDegreeAnalysis =
  buildSocialWorkerGuideDegreeSubjects({
    personalInput: params.personalInput,

    recognizedSubjects:
      previousStudyAnalysis.recognizedSubjects,

    degreeClassificationBySubjectKey:
      params.degreeClassificationBySubjectKey,
  });

// 기존 공통 학위학점 분석 엔진
const degreeCreditAnalysis =
  analyzeDegreeCredits({
    degreeRequirement,

    recognizedSubjects:
      previousDegreeAnalysis.subjects,
  });

  // 4. 기존 자격증 과목요건 분석 엔진
  const qualificationAnalysis =
    analyzeQualificationRisk({
      courseName: "사회복지사 2급",
      masterItems: params.masterItems,

      recognizedSubjects:
        previousStudyAnalysis.recognizedSubjects,

      socialWorkerLawVersion:
        previousStudyAnalysis.lawVersion,
    });

  // 5. 기존 학위 + 자격증 통합 엔진
  const requirements =
    mergeQualificationRequirements({
      degreeRequirement,
      degreeCreditAnalysis,
      qualificationAnalysis,
    });

  return {
  degreeRequirement,
  degreeCreditAnalysis,
  qualificationAnalysis,
  requirements,
  previousStudyAnalysis,
  previousDegreeAnalysis,

  requiresReview:
    previousStudyAnalysis.requiresReview ||
    previousDegreeAnalysis.requiresReview,
};
}


export function buildSocialWorkerGuideSubjectPlan(params: {
  educationGroup: EducationGroup;
  masterItems: QualificationRiskMasterItem[];
  degreeTemplates: DegreeFillTemplateItem[];

  degreeClassificationBySubjectKey: Map<
    string,
    DegreeSubjectClassification
  >;

  personalInput?: SocialWorkerGuidePersonalInput;
}) {
  // 기존 학위 및 자격요건 계산
 const analysis = buildSocialWorkerGuideRequirements({
  educationGroup: params.educationGroup,
  masterItems: params.masterItems,
  personalInput: params.personalInput,

  degreeClassificationBySubjectKey:
    params.degreeClassificationBySubjectKey,
});

  // 기존 CRM 과목 자동설계 엔진 호출
  const subjectPlan = planQualificationSubjects({
    requirements: analysis.requirements,
    masterItems: params.masterItems,

    recognizedSubjects:
      analysis.previousStudyAnalysis.recognizedSubjects,

    occupiedSubjects: [],

    degreeTemplates: params.degreeTemplates,

    degreeClassificationBySubjectKey:
      params.degreeClassificationBySubjectKey,
  });

  return {
    ...analysis,
    subjectPlan,
  };
}

function optimizeSocialWorkerGuideSubjectPlan(
  params: Parameters<
    typeof buildSocialWorkerGuideSubjectPlan
  >[0] & {
    startDate: string;
  }
) {
  // 기본 전공 인정 방식으로 설계
  const baseline =
    buildSocialWorkerGuideSubjectPlan(params);

  // 전문대졸 이상은 신규 학위설계 불필요
  if (
    !baseline.degreeRequirement.requiresNewDegreeTrack
  ) {
    return baseline;
  }

  // 이미 이수한 과목은 학점분류를 임의로 변경하지 않음
  const recognizedKeys = new Set(
    baseline.previousStudyAnalysis.recognizedSubjects.map(
      subject =>
        getConfirmedSubjectEquivalenceKey(
          subject.subjectName
        )
    )
  );

  // 공식 NILE 전공·교양 호환과목 조회
  const compatibleKeys = Array.from(
    params.degreeClassificationBySubjectKey.entries()
  )
    .filter(([key, classification]) => {
      const item = classification as
        DegreeSubjectClassification & {
          isLiberalCompatible?: boolean;
        };

      return (
        item.isLiberalCompatible === true &&
        item.category === "전공" &&
        item.requirementType === "전공선택" &&
        !recognizedKeys.has(key)
      );
    })
    .map(([key]) => key);

  if (compatibleKeys.length === 0) {
    return baseline;
  }

  type Candidate = typeof baseline;

  let best: Candidate = baseline;

  function getApplicationDate(
    candidate: Candidate
  ): string | null {
    if (!candidate.subjectPlan.canPlan) {
      return null;
    }

    const calculation =
      calculateSocialWorkerGuide({
        startDate: params.startDate,
        educationGroup: params.educationGroup,
        requirements: candidate.requirements,
        subjectPlan: candidate.subjectPlan,
      });

    return calculation.success &&
      "applicationDate" in calculation
      ? calculation.applicationDate ?? null
      : null;
  }

  let bestDate = getApplicationDate(best);

  function evaluate(keys: string[]) {
    const classificationMap = new Map(
      params.degreeClassificationBySubjectKey
    );

    // 자격증 과목 구분은 유지하고
    // 학위 인정 구분만 교양으로 변경
    for (const key of keys) {
      classificationMap.set(key, {
        category: "교양",
        requirementType: "교양",
      });
    }

    const candidate =
      buildSocialWorkerGuideSubjectPlan({
        ...params,

        degreeClassificationBySubjectKey:
          classificationMap,
      });

    if (!candidate.subjectPlan.canPlan) {
      return;
    }

    const projected =
      candidate.subjectPlan.projectedDegree;

    // 학위요건 미충족 설계는 제외
    if (
      projected.remainingMajorCredits > 0 ||
      projected.remainingLiberalCredits > 0 ||
      projected.remainingTotalCredits > 0
    ) {
      return;
    }

    const candidateDate =
      getApplicationDate(candidate);

    if (!candidateDate) return;

    const candidateCount =
      candidate.subjectPlan.selectedSubjectCount;

    const bestCount =
      best.subjectPlan.selectedSubjectCount;

    // 신청일 우선, 동일 신청일이면 최소 과목 우선
    const isBetter =
      !bestDate ||
      candidateDate < bestDate ||
      (
        candidateDate === bestDate &&
        candidateCount < bestCount
      );

    if (isBetter) {
      best = candidate;
      bestDate = candidateDate;
    }
  }

  // 호환과목별 조합 비교
  // 공개 API의 과도한 연산 방지
  if (compatibleKeys.length <= 8) {
    function search(
      index: number,
      selected: string[]
    ) {
      if (index === compatibleKeys.length) {
        if (selected.length > 0) {
          evaluate(selected);
        }

        return;
      }

      // 전공으로 인정
      search(index + 1, selected);

      // 교양으로 인정
      search(index + 1, [
        ...selected,
        compatibleKeys[index],
      ]);
    }

    search(0, []);
  } else {
    // 호환과목이 많을 경우 개별 및 전체 비교
    for (const key of compatibleKeys) {
      evaluate([key]);
    }

    evaluate(compatibleKeys);
  }

  return best;
}

export function calculateSocialWorkerGuide(params: {
  startDate: string;
  educationGroup: EducationGroup;
  requirements: UnifiedQualificationRequirements;
  subjectPlan: QualificationSubjectPlannerResult;
}) {
  const semesterPlan = planQualificationSemesters({
  subjectPlan: params.subjectPlan,
  existingSemesters: [],
  baseDate: params.startDate,

  allowOverlappingSemesters: true,
});

  if (!semesterPlan.canPlan) {
    return {
      success: false as const,
      semesterPlan,
      administrativeTimeline: null,
      reason: semesterPlan.unresolvedReasons,
    };
  }

  const administrativeTimeline =
    planAdministrativeTimeline({
      requirements: params.requirements,
      semesterPlan,
      existingSemesters: [],
      referenceDate: params.startDate,
    });

  const applicationDate =
    administrativeTimeline.qualification
      .earliestEstimatedDate;

  const valid =
    administrativeTimeline.canCalculate &&
    Boolean(applicationDate);

  return {
    success: valid,
    educationGroup: params.educationGroup,
    semesterCount: semesterPlan.semesterCount,
    studyStartDate:
      semesterPlan.estimatedStudyStartDate,
    studyEndDate:
      semesterPlan.estimatedStudyEndDate,
    applicationDate,
    requiresDegree:
      administrativeTimeline.requiresNewDegreeTrack,
    semesterPlan,
    administrativeTimeline,
  };
}


export async function runSocialWorkerGuideCalculation(params: {
  startDate: string;
  educationGroup: EducationGroup;
  organizationId: number;
  personalInput?: SocialWorkerGuidePersonalInput;
}) {
  // 1. 실제 CRM 과목마스터 조회
  const catalog = await loadSocialWorkerGuideCatalog(
    params.organizationId
  );

console.log("[GUIDE TEMPLATE CHECK]", {
  organizationId: params.organizationId,
  catalogId: catalog.catalogId,
  total: catalog.degreeTemplates.length,
  liberal: catalog.degreeTemplates
    .filter(item =>
      item.category === "교양" ||
      item.requirementType === "교양"
    )
    .map(item => ({
      id: item.id,
      name: item.subjectName,
      catalogId: item.catalogId,
      courseKey: item.courseKey,
      category: item.category,
      requirementType: item.requirementType,
    })),
});

  // 2. DB 원본을 기존 자격요건 엔진 형식으로 변환
  const masterItems: QualificationRiskMasterItem[] =
    catalog.masterItems.map((item) => ({
      id: Number(item.id),
      catalogId: Number(item.catalogId),
      subjectName: String(item.subjectName ?? "").trim(),
      requirementType: item.requirementType ?? null,
      category: item.category ?? null,
      credits: Number(item.credits ?? 0),
      isFaceToFace: Boolean(item.isFaceToFace),
    }));

  // 3. 목표 학위요건 확인
const degreeRequirement =
  resolveDegreeRequirement({
    courseKey: "social_worker_2",

    finalEducation:
      params.educationGroup === "high_school"
        ? "고졸"
        : "전문대졸",
  });

// 4. NILE 공식 과목분류 우선 실행
const degreeClassificationBySubjectKey =
  await buildSocialWorkerGuideNileClassification({
    degreeRequirement,
    masterItems,
    degreeTemplates: catalog.degreeTemplates,
  });

  
  // 5. 기존 학위 템플릿 + CRM 과목마스터의 공식 교양과목 통합
  const templateKeys = new Set<string>();

  const degreeTemplates: DegreeFillTemplateItem[] =
    catalog.degreeTemplates.map((item) => {
      const subjectName = String(item.subjectName ?? "").trim();
      const subjectKey =
        getConfirmedSubjectEquivalenceKey(subjectName);

      if (subjectKey) templateKeys.add(subjectKey);

      const nileClassification = subjectKey
        ? degreeClassificationBySubjectKey.get(subjectKey)
        : undefined;

      const category =
        nileClassification?.category ?? item.category;

      const requirementType =
        nileClassification?.requirementType ??
        item.requirementType ??
        null;

      if (
        category !== "전공" &&
        category !== "교양" &&
        category !== "일반"
      ) {
        throw new Error(
          `${subjectName}: 학위 과목 분류를 확인할 수 없습니다.`
        );
      }

      if (
        requirementType !== null &&
        requirementType !== "전공필수" &&
        requirementType !== "전공선택" &&
        requirementType !== "교양" &&
        requirementType !== "일반"
      ) {
        throw new Error(
          `${subjectName}: 학위 과목 이수구분이 올바르지 않습니다.`
        );
      }

      return {
        id: Number(item.id),
        courseKey: String(item.courseKey ?? ""),
        subjectName,
        category,
        requirementType,
        sortOrder: Number(item.sortOrder ?? 0),
      };
    });

  // CRM 과목마스터에 추가된 공식 교양과목만 후보에 반영
  for (const item of catalog.masterItems) {
    if (
      item.category !== "교양" &&
      item.requirementType !== "교양"
    ) {
      continue;
    }

    const subjectName = String(item.subjectName ?? "").trim();
    const subjectKey =
      getConfirmedSubjectEquivalenceKey(subjectName);

    if (!subjectKey || templateKeys.has(subjectKey)) {
      continue;
    }

    const nileClassification =
      degreeClassificationBySubjectKey.get(subjectKey);

    // CRM 표시만 교양인 과목은 추가하지 않음
    if (
      nileClassification?.category !== "교양" ||
      nileClassification.requirementType !== "교양"
    ) {
      continue;
    }

    templateKeys.add(subjectKey);

    degreeTemplates.push({
      id: -Number(item.id),
      courseKey: "social_worker_2",
      subjectName,
      category: "교양",
      requirementType: "교양",
      sortOrder: Number(item.sortOrder ?? 0),
    });
  }

  console.log("[GUIDE DEGREE TEMPLATE MERGE]", {
    originalCount: catalog.degreeTemplates.length,
    mergedCount: degreeTemplates.length,
    liberalSubjects: degreeTemplates
      .filter(
        (item) =>
          item.category === "교양" &&
          item.requirementType === "교양"
      )
      .map((item) => item.subjectName),
  });


  // 6. 전공·교양 호환과목 최적화 설계
const subjectAnalysis =
  optimizeSocialWorkerGuideSubjectPlan({
    startDate: params.startDate,
    educationGroup: params.educationGroup,
    masterItems,
    degreeTemplates,
    degreeClassificationBySubjectKey,
    personalInput: params.personalInput,
  });

  // 7. 과목설계 실패 시 신청일 계산 중단
  if (!subjectAnalysis.subjectPlan.canPlan) {
    return {
      success: false as const,
      educationGroup: params.educationGroup,
      reason: subjectAnalysis.subjectPlan.unresolvedRequirements,
      subjectPlan: subjectAnalysis.subjectPlan,
      calculation: null,
    };
  }

  // 8. 기존 학기 및 행정절차 엔진 실행
  const calculation = calculateSocialWorkerGuide({
    startDate: params.startDate,
    educationGroup: params.educationGroup,
    requirements: subjectAnalysis.requirements,
    subjectPlan: subjectAnalysis.subjectPlan,
  });

  return {
  success: calculation.success,
  educationGroup: params.educationGroup,

  reason: calculation.success
    ? []
    : calculation.semesterPlan.unresolvedReasons,

  subjectPlan: subjectAnalysis.subjectPlan,

  calculation,

  personalAnalysis: {
    lawVersion:
      subjectAnalysis.previousStudyAnalysis.lawVersion,

    lawResolution:
      subjectAnalysis.previousStudyAnalysis.lawResolution,

    recognizedSubjects:
      subjectAnalysis.previousStudyAnalysis
        .recognizedSubjects,

    unmatchedSubjects:
      subjectAnalysis.previousStudyAnalysis
        .unmatchedSubjects,

    degreeCreditAnalysis:
      subjectAnalysis.degreeCreditAnalysis,

    qualificationRequirements:
      subjectAnalysis.requirements.qualification,

    degreeRequirements:
      subjectAnalysis.requirements.degree,

    remainingSubjectCount:
      subjectAnalysis.subjectPlan.selectedSubjectCount,

    requiresReview:
      subjectAnalysis.requiresReview,
  },
};
}

