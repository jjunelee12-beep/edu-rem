import {
  getConfirmedSubjectEquivalenceKey,
} from "./subject-equivalence-resolver";

import {
  isFaceToFaceMasterSubject,
} from "./risk-rule-master";

export type RiskRecommendationRequirementType =
  | "전공필수"
  | "전공선택"
  | "교양"
  | "일반";

export type RiskRecommendationMasterItem = {
  id:
    number;

  catalogId:
    number;

  subjectName:
    string;

  category:
    string | null;

  requirementType:
    string | null;

  credits:
    number;

  semesterNo:
    number | null;

  sortOrder:
    number;

  isActive:
    boolean;

  isFaceToFace:
    boolean;
};

export type RiskRecommendationExistingSubject = {
  subjectName:
    string;

  credits:
    number;

  source:
    "plan" |
    "transfer" |
    "extra";
};

export type RiskSubjectRecommendation = {
  masterSubjectId:
    number;

  catalogId:
    number;

  subjectName:
    string;

  category:
    string | null;

  requirementType:
    string | null;

  credits:
    number;

  semesterNo:
    number | null;

  isFaceToFace:
    boolean;

  reason:
    string;
};

export type BuildRiskSubjectRecommendationsParams = {
  masterItems:
    any[];

  existingSubjects:
    RiskRecommendationExistingSubject[];

  requirementType?:
    RiskRecommendationRequirementType |
    null;

  requiredCredits?:
    number |
    null;

  requiredSubjects?:
    number |
    null;

  requireFaceToFace?:
    boolean;

  excludeSubjectNames?:
    string[];

  limit?:
    number;
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

function normalizeMasterItem(
  row:
    any
): RiskRecommendationMasterItem {
  return {
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

    category:
      row?.category
        ? String(
            row.category
          ).trim()
        : null,

    requirementType:
      row?.requirementType
        ? String(
            row.requirementType
          ).trim()
        : null,

    credits:
      toNumber(
        row?.credits
      ),

    semesterNo:
      Number(
        row?.semesterNo ||
        0
      ) ||
      null,

    sortOrder:
      Number(
        row?.sortOrder ||
        0
      ),

    isActive:
      row?.isActive !==
      false,

    isFaceToFace:
      isFaceToFaceMasterSubject(
        row?.subjectName
      ),
  };
}

function createExistingSubjectKeySet(
  subjects:
    RiskRecommendationExistingSubject[]
) {
  return new Set(
    subjects
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

function createExcludedSubjectKeySet(
  subjectNames:
    string[]
) {
  return new Set(
    subjectNames
      .map(
        (
          subjectName
        ) =>
          getConfirmedSubjectEquivalenceKey(
            subjectName
          )
      )
      .filter(
        Boolean
      )
  );
}

export function buildRiskSubjectRecommendations(
  params:
    BuildRiskSubjectRecommendationsParams
): RiskSubjectRecommendation[] {
  const existingSubjectKeys =
    createExistingSubjectKeySet(
      params.existingSubjects ||
      []
    );

  const excludedSubjectKeys =
    createExcludedSubjectKeySet(
      params.excludeSubjectNames ||
      []
    );

  const requiredCredits =
    Math.max(
      0,
      toNumber(
        params.requiredCredits
      )
    );

  const requiredSubjects =
    Math.max(
      0,
      Math.floor(
        toNumber(
          params.requiredSubjects
        )
      )
    );

  const limit =
    Math.max(
      1,
      Math.min(
        30,
        Math.floor(
          toNumber(
            params.limit ??
            10
          )
        ) ||
        10
      )
    );

if (
  requiredCredits <= 0 &&
  requiredSubjects <= 0
) {
  return [];
}

  const candidates =
    (
      params.masterItems ||
      []
    )
      .map(
        normalizeMasterItem
      )
      .filter(
        (
          item
        ) => {
          if (
            !item.id ||
            !item.catalogId ||
            !item.subjectName ||
            item.credits <=
              0 ||
            !item.isActive
          ) {
            return false;
          }

          if (
            params.requirementType &&
            item.requirementType !==
              params.requirementType
          ) {
            return false;
          }

          if (
            params.requireFaceToFace ===
              true &&
            item.isFaceToFace !==
              true
          ) {
            return false;
          }

          const equivalenceKey =
            getConfirmedSubjectEquivalenceKey(
              item.subjectName
            );

          if (
            !equivalenceKey
          ) {
            return false;
          }

          /**
           * 전적대 / 추가입력 / 우리플랜에서
           * 이미 인정 중인 과목은 추천하지 않는다.
           *
           * 공식 동일교과목도 같은 Key가 되므로
           * 자동으로 추천 대상에서 제외된다.
           */
          if (
            existingSubjectKeys.has(
              equivalenceKey
            )
          ) {
            return false;
          }

          /**
           * 위험도 엔진에서 별도로
           * 제외 요청한 과목 역시 추천하지 않는다.
           */
          if (
            excludedSubjectKeys.has(
              equivalenceKey
            )
          ) {
            return false;
          }

          return true;
        }
      )
      .sort(
        (
          a,
          b
        ) => {
          const semesterA =
            a.semesterNo ??
            999;

          const semesterB =
            b.semesterNo ??
            999;

          if (
            semesterA !==
            semesterB
          ) {
            return (
              semesterA -
              semesterB
            );
          }

          if (
            a.sortOrder !==
            b.sortOrder
          ) {
            return (
              a.sortOrder -
              b.sortOrder
            );
          }

          return (
            a.id -
            b.id
          );
        }
      );

  const recommendations:
    RiskSubjectRecommendation[] =
    [];

  let accumulatedCredits =
    0;

  for (
    const candidate
    of candidates
  ) {
    if (
      recommendations.length >=
      limit
    ) {
      break;
    }

    const hasSatisfiedSubjectCount =
      requiredSubjects >
        0 &&
      recommendations.length >=
        requiredSubjects;

    const hasSatisfiedCredits =
      requiredCredits >
        0 &&
      accumulatedCredits >=
        requiredCredits;

    /**
     * 과목 수와 학점 조건이 둘 다 존재하면
     * 둘 다 충족했을 때 종료한다.
     */
    if (
      requiredSubjects >
        0 &&
      requiredCredits >
        0 &&
      hasSatisfiedSubjectCount &&
      hasSatisfiedCredits
    ) {
      break;
    }

    /**
     * 과목 수만 요구한 경우
     */
    if (
      requiredSubjects >
        0 &&
      requiredCredits ===
        0 &&
      hasSatisfiedSubjectCount
    ) {
      break;
    }

    /**
     * 학점만 요구한 경우
     */
    if (
      requiredCredits >
        0 &&
      requiredSubjects ===
        0 &&
      hasSatisfiedCredits
    ) {
      break;
    }

    recommendations.push({
      masterSubjectId:
        candidate.id,

      catalogId:
        candidate.catalogId,

      subjectName:
        candidate.subjectName,

      category:
        candidate.category,

      requirementType:
        candidate.requirementType,

      credits:
        candidate.credits,

      semesterNo:
        candidate.semesterNo,

      isFaceToFace:
        candidate.isFaceToFace,

      reason:
        params.requireFaceToFace ===
        true
          ? "현재 부족한 대면 교과목 조건을 충족하기 위해 과목 마스터에서 추천했습니다."
          : params.requirementType
            ? `${params.requirementType} 부족분을 충족하기 위해 과목 마스터에서 추천했습니다.`
            : "현재 부족한 학점 또는 과목 수를 충족하기 위해 과목 마스터에서 추천했습니다.",
    });

    accumulatedCredits +=
      candidate.credits;
  }

  return recommendations;
}