import * as db from "./db";

import {
  resolveNileRecognizedSubjects,
} from "./nile/nile-recognized-subject-resolver";

import {
  getConfirmedSubjectEquivalenceKey,
} from "./ai/risk-rules/subject-equivalence-resolver";

import {
  resolveDegreeRequirement,
} from "./ai/risk-rules/degree-requirement-resolver";

import {
  analyzeDegreeCredits,
} from "./ai/risk-rules/degree-credit-analyzer";

import {
  analyzeQualificationRisk,
  type QualificationRiskMasterItem,
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
    new Map<string, DegreeSubjectClassification>();

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


export function buildSocialWorkerGuideRequirements(params: {
  educationGroup: EducationGroup;
  masterItems: QualificationRiskMasterItem[];
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

  // 2. 기존 학위학점 분석 엔진
  // 신규 학습자이므로 기존 이수학점 없음
  const degreeCreditAnalysis =
    analyzeDegreeCredits({
      degreeRequirement,
      recognizedSubjects: [],
    });

  // 3. 기존 자격증 과목요건 분석 엔진
  const qualificationAnalysis =
    analyzeQualificationRisk({
      courseName: "사회복지사 2급",
      masterItems: params.masterItems,
      recognizedSubjects: [],
      socialWorkerLawVersion: "current",
    });

  // 4. 기존 학위 + 자격증 통합 엔진
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
}) {
  // 기존 학위 및 자격요건 계산
  const analysis = buildSocialWorkerGuideRequirements({
    educationGroup: params.educationGroup,
    masterItems: params.masterItems,
  });

  // 실제 CRM 과목 자동설계 엔진 호출
  const subjectPlan = planQualificationSubjects({
    requirements: analysis.requirements,
    masterItems: params.masterItems,

    // 신규 학습자: 인정과목 및 수강예정 과목 없음
    recognizedSubjects: [],
    occupiedSubjects: [],

    // 기존 DB에서 가져온 학위용 과목 템플릿
    degreeTemplates: params.degreeTemplates,

    // 기존 과목 분류 엔진의 판정 결과
    degreeClassificationBySubjectKey:
      params.degreeClassificationBySubjectKey,
  });

  return {
    ...analysis,
    subjectPlan,
  };
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
}) {
  // 1. 실제 CRM 과목마스터 조회
  const catalog = await loadSocialWorkerGuideCatalog(
    params.organizationId
  );

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

  // 3. 학위 및 자격요건 계산
  const analysis = buildSocialWorkerGuideRequirements({
    educationGroup: params.educationGroup,
    masterItems,
  });

  // 4. 고졸자에게 필요한 NILE 공식 과목 분류
  const degreeClassificationBySubjectKey =
    await buildSocialWorkerGuideNileClassification({
      degreeRequirement: analysis.degreeRequirement,
      masterItems,
      degreeTemplates: catalog.degreeTemplates,
    });

  // 5. DB 학위 템플릿을 자동설계 엔진 형식으로 변환
  const degreeTemplates: DegreeFillTemplateItem[] =
    catalog.degreeTemplates.map((item) => {
      const subjectName = String(
        item.subjectName ?? ""
      ).trim();

      const subjectKey =
        getConfirmedSubjectEquivalenceKey(subjectName);

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

  // 6. 실제 과목 자동설계
  const subjectAnalysis = buildSocialWorkerGuideSubjectPlan({
    educationGroup: params.educationGroup,
    masterItems,
    degreeTemplates,
    degreeClassificationBySubjectKey,
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
  };
}

