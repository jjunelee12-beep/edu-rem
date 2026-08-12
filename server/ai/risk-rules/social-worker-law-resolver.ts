import {
  getConfirmedSubjectEquivalenceKey,
} from "./subject-equivalence-resolver";

export type SocialWorkerAutoLawVersion =
  | "old"
  | "current"
  | "review_required";

export type SocialWorkerLawResolutionSource =
  | "manual"
  | "transfer_pre_2020"
  | "transfer_post_2020"
  | "no_previous_social_worker_subject"
  | "transfer_year_unknown";

export type SocialWorkerLawEvidenceSubject = {
  subjectName:
    string;

  completionYear:
    number | null;

  completionSemester:
    string | null;

  matchedMasterSubjectName:
    string | null;
};

export type SocialWorkerAutoLawResolution = {
  lawVersion:
    SocialWorkerAutoLawVersion;

  /**
   * 기존 qualification-risk-analyzer에
   * 바로 넘길 수 있는 확정값.
   *
   * review_required이면 null.
   */
  effectiveLawVersion:
    "old" |
    "current" |
    null;

  source:
    SocialWorkerLawResolutionSource;

  isConfirmed:
    boolean;

  requiresReview:
    boolean;

  message:
    string;

  evidenceSubjects:
    SocialWorkerLawEvidenceSubject[];

  unknownYearSubjects:
    SocialWorkerLawEvidenceSubject[];
};

export type ResolveSocialWorkerLawParams = {
  /**
   * 사회복지사 과정의 과목 마스터.
   *
   * 반드시 해당 학생 과정과 매칭된
   * 사회복지사 마스터만 전달한다.
   */
  masterItems:
    any[];

  /**
   * 학생 전적대 과목 원본.
   *
   * completionYear /
   * completionSemester가 포함되어 있어야 한다.
   */
  transferSubjects:
    any[];

  /**
   * 담당자가 이미 확정한 구법/신법 값.
   *
   * 수동 확인값이 존재하면
   * 자동추정보다 우선한다.
   */
  manualLawVersion?:
    unknown;
};

function normalizeText(
  value:
    unknown
) {
  return String(
    value ??
    ""
  ).trim();
}

function normalizeYear(
  value:
    unknown
): number | null {
  const year =
    Math.floor(
      Number(
        value
      )
    );

  if (
    !Number.isFinite(
      year
    ) ||
    year < 1900 ||
    year > 2200
  ) {
    return null;
  }

  return year;
}

function normalizeManualLawVersion(
  value:
    unknown
):
  | "old"
  | "current"
  | null {
  const normalized =
    normalizeText(
      value
    )
      .toLowerCase();

  if (
    normalized ===
      "old" ||
    normalized ===
      "구법"
  ) {
    return "old";
  }

  if (
    normalized ===
      "current" ||
    normalized ===
      "new" ||
    normalized ===
      "신법"
  ) {
    return "current";
  }

  return null;
}

function buildMasterSubjectMap(
  masterItems:
    any[]
) {
  const map =
    new Map<
      string,
      string
    >();

  for (
    const item
    of masterItems || []
  ) {
    const subjectName =
      normalizeText(
        item?.subjectName
      );

    if (!subjectName) {
      continue;
    }

    const equivalenceKey =
      getConfirmedSubjectEquivalenceKey(
        subjectName
      );

    if (!equivalenceKey) {
      continue;
    }

    /**
     * 동일교과목 그룹이 여러 마스터 과목에
     * 걸리더라도 최초 마스터명을 근거로 사용한다.
     */
    if (
      !map.has(
        equivalenceKey
      )
    ) {
      map.set(
        equivalenceKey,
        subjectName
      );
    }
  }

  return map;
}

export function resolveSocialWorkerLaw(
  params:
    ResolveSocialWorkerLawParams
): SocialWorkerAutoLawResolution {
  /**
   * ─────────────────────────────
   * 1. 담당자 수동 확정값 우선
   * ─────────────────────────────
   *
   * OCR이 애매한 경우 담당자가
   * 공식자료/성적표를 직접 확인해
   * old/current를 확정할 수 있도록 유지한다.
   */
  const manualLawVersion =
    normalizeManualLawVersion(
      params
        .manualLawVersion
    );

  if (
    manualLawVersion ===
    "old"
  ) {
    return {
      lawVersion:
        "old",

      effectiveLawVersion:
        "old",

      source:
        "manual",

      isConfirmed:
        true,

      requiresReview:
        false,

      message:
        "담당자가 사회복지사 2급 구법 적용대상으로 직접 확정했습니다.",

      evidenceSubjects:
        [],

      unknownYearSubjects:
        [],
    };
  }

  if (
    manualLawVersion ===
    "current"
  ) {
    return {
      lawVersion:
        "current",

      effectiveLawVersion:
        "current",

      source:
        "manual",

      isConfirmed:
        true,

      requiresReview:
        false,

      message:
        "담당자가 사회복지사 2급 신법 적용대상으로 직접 확정했습니다.",

      evidenceSubjects:
        [],

      unknownYearSubjects:
        [],
    };
  }

  /**
   * ─────────────────────────────
   * 2. 사회복지사 마스터 동일과목 Key 생성
   * ─────────────────────────────
   */
  const masterSubjectMap =
    buildMasterSubjectMap(
      params.masterItems ||
      []
    );

  /**
   * 마스터 자체가 없으면
   * 법규 자동판정을 확정하면 안 된다.
   */
  if (
    masterSubjectMap.size ===
    0
  ) {
    return {
      lawVersion:
        "review_required",

      effectiveLawVersion:
        null,

      source:
        "transfer_year_unknown",

      isConfirmed:
        false,

      requiresReview:
        true,

      message:
        "사회복지사 과목 마스터를 확인할 수 없어 구법/신법을 자동 판정할 수 없습니다.",

      evidenceSubjects:
        [],

      unknownYearSubjects:
        [],
    };
  }

  /**
   * ─────────────────────────────
   * 3. 전적대 중 사회복지사 인정과목만 추출
   * ─────────────────────────────
   */
  const matchedSubjects:
    SocialWorkerLawEvidenceSubject[] =
    [];

  for (
    const row
    of params
      .transferSubjects ||
    []
  ) {
    const subjectName =
      normalizeText(
        row?.subjectName
      );

    if (!subjectName) {
      continue;
    }

    const equivalenceKey =
      getConfirmedSubjectEquivalenceKey(
        subjectName
      );

    if (
      !equivalenceKey ||
      !masterSubjectMap.has(
        equivalenceKey
      )
    ) {
      /**
       * 사회복지사 마스터와 확정 동일과목이
       * 아니면 구법판정 근거로 사용하지 않는다.
       */
      continue;
    }

    matchedSubjects.push({
      subjectName,

      completionYear:
        normalizeYear(
          row?.completionYear
        ),

      completionSemester:
        normalizeText(
          row
            ?.completionSemester
        ) ||
        null,

      matchedMasterSubjectName:
        masterSubjectMap.get(
          equivalenceKey
        ) ||
        null,
    });
  }

  /**
   * ─────────────────────────────
   * 4. 기존 사회복지사 인정과목 자체가 없음
   * ─────────────────────────────
   *
   * 전적대에 사회복지 관련 인정과목이 없다면
   * 2020년 이전 이수 근거가 없으므로
   * 현행 기준으로 판정한다.
   */
  if (
    matchedSubjects.length ===
    0
  ) {
    return {
      lawVersion:
        "current",

      effectiveLawVersion:
        "current",

      source:
        "no_previous_social_worker_subject",

      isConfirmed:
        true,

      requiresReview:
        false,

      message:
        "전적대에서 사회복지사 자격과목으로 인정되는 기존 이수과목이 확인되지 않아 신법 기준을 적용합니다.",

      evidenceSubjects:
        [],

      unknownYearSubjects:
        [],
    };
  }

  /**
   * ─────────────────────────────
   * 5. 2020년 이전 이수과목 확인
   * ─────────────────────────────
   *
   * 사용자 운영기준:
   * 사회복지사 인정과목 중
   * 2020년 이전 이수내역이 하나라도 있으면 구법.
   */
  const oldLawEvidence =
    matchedSubjects.filter(
      (
        subject
      ) =>
        subject
          .completionYear !==
          null &&
        subject
          .completionYear <
          2020
    );

  if (
    oldLawEvidence.length >
    0
  ) {
    return {
      lawVersion:
        "old",

      effectiveLawVersion:
        "old",

      source:
        "transfer_pre_2020",

      isConfirmed:
        true,

      requiresReview:
        false,

      message:
        `전적대 사회복지사 인정과목 중 2020년 이전 이수과목 ${oldLawEvidence.length}건이 확인되어 구법 기준을 적용합니다.`,

      evidenceSubjects:
        oldLawEvidence,

      /**
       * 이미 구법 근거가 존재하므로
       * 다른 과목의 연도 누락은 구법판정을 막지 않는다.
       */
      unknownYearSubjects:
        matchedSubjects.filter(
          (
            subject
          ) =>
            subject
              .completionYear ===
            null
        ),
    };
  }

  /**
   * ─────────────────────────────
   * 6. 사회복지 인정과목인데 이수연도 불명확
   * ─────────────────────────────
   *
   * 이 과목이 실제로 2019년 이수일 수도 있으므로
   * 절대 임의로 신법 처리하지 않는다.
   */
  const unknownYearSubjects =
    matchedSubjects.filter(
      (
        subject
      ) =>
        subject
          .completionYear ===
        null
    );

  if (
    unknownYearSubjects.length >
    0
  ) {
    return {
      lawVersion:
        "review_required",

      effectiveLawVersion:
        null,

      source:
        "transfer_year_unknown",

      isConfirmed:
        false,

      requiresReview:
        true,

      message:
        `사회복지사 인정과목 ${unknownYearSubjects.length}건의 이수연도를 확인할 수 없어 구법/신법 확정이 필요합니다.`,

      evidenceSubjects:
        matchedSubjects.filter(
          (
            subject
          ) =>
            subject
              .completionYear !==
            null
        ),

      unknownYearSubjects,
    };
  }

  /**
   * ─────────────────────────────
   * 7. 인정과목이 모두 2020년 이후
   * ─────────────────────────────
   */
  return {
    lawVersion:
      "current",

    effectiveLawVersion:
      "current",

    source:
      "transfer_post_2020",

    isConfirmed:
      true,

    requiresReview:
      false,

    message:
      "전적대 사회복지사 인정과목이 모두 2020년 이후 이수로 확인되어 신법 기준을 적용합니다.",

    evidenceSubjects:
      matchedSubjects,

    unknownYearSubjects:
      [],
  };
}