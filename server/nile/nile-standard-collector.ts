// server/nile/nile-standard-collector.ts

import {
  assertNileCurriculumParseComplete,
  parseNileCurriculumDetail,
  parseNileCurriculumList,
  parseNileLiberalSubjects,
  parseNileMajorLiberalCompatibleSubjects,
} from "./nile-standard-parser";

import {
  buildNileCurriculumKey,
  normalizeNileSubjectName,

  type NileCollectedCurriculumSummary,
  type NileCollectedDataset,
  type NileCollectedLiberalSubject,
  type NileCollectedMajorLiberalCompatibleSubject,
  type NileCollectorResult,
  type NileDegreeLevel,
  type NileHttpResponse,
  type NileParsedCurriculum,
} from "./nile-standard-types";


/* =========================================================
 * Constants
 * ========================================================= */

const NILE_BASE_URL =
  "https://www.cb.or.kr";

const BACHELOR_LIST_URL =
  `${NILE_BASE_URL}/creditbank/stdPro/nStdPro1_1.do`;

const ASSOCIATE_LIST_URL =
  `${NILE_BASE_URL}/creditbank/stdPro/nStdPro2_1.do`;

const LIBERAL_LIST_URL =
  `${NILE_BASE_URL}/creditbank/stdPro/nStdPro3_1.do`;

const COMPATIBLE_LIST_URL =
  `${NILE_BASE_URL}/creditbank/stdPro/nStdPro4_1.do`;

const DEFAULT_STANDARD_VERSION =
  "current";

/**
 * 국평원 서버에 너무 많은 요청을 동시에 보내지 않는다.
 */
const DEFAULT_CONCURRENCY =
  3;

const DEFAULT_REQUEST_TIMEOUT_MS =
  20_000;

const DEFAULT_RETRY_COUNT =
  3;

const DEFAULT_RETRY_DELAY_MS =
  800;


/* =========================================================
 * Internal types
 * ========================================================= */

type CollectorOptions = {
  standardVersion?: string;

  concurrency?: number;

  requestTimeoutMs?: number;

  retryCount?: number;

  /**
   * 특정 전공만 테스트할 경우 사용.
   *
   * 예:
   * ["AGAE", "AACG"]
   */
  onlyMajorIds?: string[];

  /**
   * true이면 교양도 수집.
   */
  includeLiberalSubjects?: boolean;

  /**
   * true이면 전공교양 호환과목도 수집.
   */
  includeCompatibleSubjects?: boolean;
};


type CurriculumCollectionResult = {
  curriculums: NileParsedCurriculum[];

  warnings: string[];

  errors: string[];
};


/* =========================================================
 * Basic helpers
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
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function sleep(
  ms: number
): Promise<void> {
  return new Promise(
    (resolve) => {
      setTimeout(
        resolve,
        ms
      );
    }
  );
}


function normalizePositiveInteger(
  value: number | undefined,
  fallback: number
): number {
  const numberValue =
    Number(value);

  if (
    !Number.isFinite(numberValue) ||
    numberValue <= 0
  ) {
    return fallback;
  }

  return Math.floor(
    numberValue
  );
}


function normalizeMajorIds(
  values:
    | string[]
    | undefined
): Set<string> | null {
  if (
    !values ||
    values.length === 0
  ) {
    return null;
  }

  const result =
    new Set<string>();

  for (
    const value
    of values
  ) {
    const normalized =
      cleanText(value)
        .toUpperCase();

    if (normalized) {
      result.add(
        normalized
      );
    }
  }

  return result.size > 0
    ? result
    : null;
}


/* =========================================================
 * HTTP
 * ========================================================= */

function createAbortSignal(
  timeoutMs: number
): {
  signal: AbortSignal;
  clear: () => void;
} {
  const controller =
    new AbortController();

  const timer =
    setTimeout(
      () => {
        controller.abort();
      },
      timeoutMs
    );

  return {
    signal:
      controller.signal,

    clear:
      () => {
        clearTimeout(
          timer
        );
      },
  };
}


async function fetchNilePageOnce(
  params: {
    url: string;
    timeoutMs: number;
  }
): Promise<NileHttpResponse> {
  const abort =
    createAbortSignal(
      params.timeoutMs
    );

  try {
    const response =
      await fetch(
        params.url,
        {
          method:
            "GET",

          headers: {
            /**
             * 일반 브라우저 요청과 유사한 최소 헤더만 사용.
             */
            "User-Agent":
              "EduCanvas-NILE-Sync/1.0",

            Accept:
              "text/html,application/xhtml+xml",

            "Accept-Language":
              "ko-KR,ko;q=0.9,en;q=0.5",

            "Cache-Control":
              "no-cache",
          },

          signal:
            abort.signal,

          redirect:
            "follow",
        }
      );

    const text =
      await response.text();

    return {
      url:
        response.url ||
        params.url,

      status:
        response.status,

      ok:
        response.ok,

      text,
    };
  } finally {
    abort.clear();
  }
}


async function fetchNilePage(
  params: {
    url: string;

    timeoutMs: number;

    retryCount: number;
  }
): Promise<NileHttpResponse> {
  let lastError:
    unknown = null;

  for (
    let attempt = 1;
    attempt <= params.retryCount;
    attempt += 1
  ) {
    try {
      const response =
        await fetchNilePageOnce({
          url:
            params.url,

          timeoutMs:
            params.timeoutMs,
        });

      if (
        response.ok &&
        response.text.trim()
      ) {
        return response;
      }

      lastError =
        new Error(
          `HTTP ${response.status}`
        );
    } catch (error) {
      lastError =
        error;
    }

    if (
      attempt <
      params.retryCount
    ) {
      await sleep(
        DEFAULT_RETRY_DELAY_MS *
        attempt
      );
    }
  }

  const message =
    lastError instanceof Error
      ? lastError.message
      : String(
          lastError ||
          "unknown error"
        );

  throw new Error(
    `NILE 페이지 요청 실패: ${params.url} / ${message}`
  );
}


/* =========================================================
 * Concurrency helper
 * ========================================================= */

async function mapWithConcurrency<
  T,
  R
>(
  items: T[],
  concurrency: number,
  worker: (
    item: T,
    index: number
  ) => Promise<R>
): Promise<R[]> {
  if (
    items.length === 0
  ) {
    return [];
  }

  const safeConcurrency =
    Math.max(
      1,
      Math.min(
        concurrency,
        items.length
      )
    );

  const results =
    new Array<R>(
      items.length
    );

  let cursor =
    0;

  async function runWorker():
    Promise<void> {
    while (true) {
      const index =
        cursor;

      cursor += 1;

      if (
        index >=
        items.length
      ) {
        return;
      }

      results[index] =
        await worker(
          items[index],
          index
        );
    }
  }

  await Promise.all(
    Array.from(
      {
        length:
          safeConcurrency,
      },
      () =>
        runWorker()
    )
  );

  return results;
}


/* =========================================================
 * Curriculum list
 * ========================================================= */

async function collectCurriculumSummaries(
  params: {
    degreeLevel: NileDegreeLevel;

    listUrl: string;

    timeoutMs: number;

    retryCount: number;
  }
): Promise<
  NileCollectedCurriculumSummary[]
> {
  console.log(
    "[NILE COLLECTOR] curriculum list fetch",
    {
      degreeLevel:
        params.degreeLevel,

      url:
        params.listUrl,
    }
  );

  const response =
    await fetchNilePage({
      url:
        params.listUrl,

      timeoutMs:
        params.timeoutMs,

      retryCount:
        params.retryCount,
    });

  const summaries =
    parseNileCurriculumList({
      html:
        response.text,

      sourceUrl:
        response.url,

      degreeLevel:
        params.degreeLevel,
    });

  if (
    summaries.length === 0
  ) {
    throw new Error(
      [
        "NILE 전공목록 파싱 실패",
        `degreeLevel=${params.degreeLevel}`,
        `url=${params.listUrl}`,
      ].join(" / ")
    );
  }

  console.log(
    "[NILE COLLECTOR] curriculum list done",
    {
      degreeLevel:
        params.degreeLevel,

      count:
        summaries.length,
    }
  );

  return summaries;
}


/* =========================================================
 * Curriculum detail
 * ========================================================= */

async function collectSingleCurriculum(
  params: {
    summary:
      NileCollectedCurriculumSummary;

    standardVersion: string;

    timeoutMs: number;

    retryCount: number;
  }
): Promise<NileParsedCurriculum> {
  const {
    summary,
  } = params;

  console.log(
    "[NILE COLLECTOR] curriculum fetch",
    {
      degreeLevel:
        summary.degreeLevel,

      degreeName:
        summary.degreeName,

      majorName:
        summary.majorName,

      officialMajorId:
        summary.officialMajorId,
    }
  );

  const response =
    await fetchNilePage({
      url:
        summary.sourceUrl,

      timeoutMs:
        params.timeoutMs,

      retryCount:
        params.retryCount,
    });

  const checkedAt =
    new Date();

  const curriculum =
    parseNileCurriculumDetail({
      html:
        response.text,

      sourceUrl:
        response.url,

      degreeLevel:
        summary.degreeLevel,

associateDurationYears:
  summary.associateDurationYears,

      degreeName:
        summary.degreeName,

      majorName:
        summary.majorName,

      officialMajorId:
        summary.officialMajorId,

      standardVersion:
        params.standardVersion,

      sourceCheckedAt:
        checkedAt,
    });

  /**
   * 공식 페이지가 선언한 전필/전선 개수와
   * 실제 parser 결과가 다르면 여기서 실패시킨다.
   */
  assertNileCurriculumParseComplete({
    html:
      response.text,

    curriculum,
  });

  console.log(
    "[NILE COLLECTOR] curriculum done",
    {
      curriculumKey:
        curriculum.curriculumKey,

      officialMajorId:
        curriculum.officialMajorId,

      subjectCount:
        curriculum.subjects.length,
    }
  );

  return curriculum;
}


/* =========================================================
 * Degree collection
 * ========================================================= */

async function collectDegreeCurriculums(
  params: {
    degreeLevel: NileDegreeLevel;

    listUrl: string;

    standardVersion: string;

    concurrency: number;

    timeoutMs: number;

    retryCount: number;

    onlyMajorIds:
      Set<string>
      | null;
  }
): Promise<CurriculumCollectionResult> {
  const warnings:
    string[] = [];

  const errors:
    string[] = [];

  let summaries =
    await collectCurriculumSummaries({
      degreeLevel:
        params.degreeLevel,

      listUrl:
        params.listUrl,

      timeoutMs:
        params.timeoutMs,

      retryCount:
        params.retryCount,
    });

  if (
    params.onlyMajorIds
  ) {
    summaries =
      summaries.filter(
        (summary) =>
          params
            .onlyMajorIds!
            .has(
              summary
                .officialMajorId
                .toUpperCase()
            )
      );
  }

  /**
   * 동일 officialMajorId 중복 제거.
   */
  const uniqueMap =
    new Map<
      string,
      NileCollectedCurriculumSummary
    >();

  for (
    const summary
    of summaries
  ) {
    const key =
      `${summary.degreeLevel}:${summary.officialMajorId}`;

    if (
      !uniqueMap.has(
        key
      )
    ) {
      uniqueMap.set(
        key,
        summary
      );
    }
  }

  const uniqueSummaries =
    Array.from(
      uniqueMap.values()
    );

  const settled =
    await mapWithConcurrency(
      uniqueSummaries,
      params.concurrency,
      async (
        summary
      ) => {
        try {
          const curriculum =
            await collectSingleCurriculum({
              summary,

              standardVersion:
                params.standardVersion,

              timeoutMs:
                params.timeoutMs,

              retryCount:
                params.retryCount,
            });

          return {
            success:
              true as const,

            curriculum,
          };
        } catch (error) {
          return {
            success:
              false as const,

            summary,

            error:
              error instanceof Error
                ? error.message
                : String(error),
          };
        }
      }
    );

  const curriculums:
    NileParsedCurriculum[] =
    [];

  for (
    const item
    of settled
  ) {
    if (
      item.success
    ) {
      curriculums.push(
        item.curriculum
      );

      continue;
    }

    errors.push(
      [
        "전공 수집 실패",
        `degreeLevel=${item.summary.degreeLevel}`,
        `major=${item.summary.majorName}`,
        `officialMajorId=${item.summary.officialMajorId}`,
        item.error,
      ].join(" / ")
    );
  }

  /**
   * 일부 전공만 실패한 상태에서는
   * 절대로 full sync용 정상 데이터라고 보지 않는다.
   */
  if (
    errors.length > 0
  ) {
    warnings.push(
      `${params.degreeLevel} 전공 ${errors.length}개 수집 실패`
    );
  }

  return {
    curriculums,
    warnings,
    errors,
  };
}


/* =========================================================
 * Liberal subjects
 * ========================================================= */

async function collectLiberalSubjects(
  params: {
    standardVersion: string;

    timeoutMs: number;

    retryCount: number;
  }
): Promise<
  NileCollectedLiberalSubject[]
> {
  console.log(
    "[NILE COLLECTOR] liberal fetch",
    {
      url:
        LIBERAL_LIST_URL,
    }
  );

  const response =
    await fetchNilePage({
      url:
        LIBERAL_LIST_URL,

      timeoutMs:
        params.timeoutMs,

      retryCount:
        params.retryCount,
    });

  const subjects =
    parseNileLiberalSubjects({
      html:
        response.text,

      sourceUrl:
        response.url,

      standardVersion:
        params.standardVersion,

      sourceCheckedAt:
        new Date(),
    });

  if (
    subjects.length === 0
  ) {
    throw new Error(
      "NILE 교양과목 파싱 결과가 없습니다."
    );
  }

  console.log(
    "[NILE COLLECTOR] liberal done",
    {
      count:
        subjects.length,
    }
  );

  return subjects;
}


/* =========================================================
 * Curriculum lookup
 * ========================================================= */

function buildCurriculumLookup(
  curriculums:
    NileParsedCurriculum[]
): Map<
  string,
  string
> {
  const lookup =
    new Map<
      string,
      string
    >();

  for (
    const curriculum
    of curriculums
  ) {
    /**
     * 호환페이지에서 어떤 표기로 전공이 나타날지
     * 모르므로 여러 키를 같은 curriculumKey에 연결.
     */
    lookup.set(
      curriculum.majorName,
      curriculum.curriculumKey
    );

    lookup.set(
      curriculum.degreeName,
      curriculum.curriculumKey
    );

    lookup.set(
      `${curriculum.degreeName} ${curriculum.majorName}`,
      curriculum.curriculumKey
    );

    lookup.set(
      curriculum.officialMajorId,
      curriculum.curriculumKey
    );
  }

  return lookup;
}


/* =========================================================
 * Compatible subjects - parser direct mode
 * ========================================================= */

async function collectCompatibleSubjectsDirect(
  params: {
    curriculums:
      NileParsedCurriculum[];

    standardVersion: string;

    timeoutMs: number;

    retryCount: number;
  }
): Promise<
  NileCollectedMajorLiberalCompatibleSubject[]
> {
  console.log(
    "[NILE COLLECTOR] compatible fetch",
    {
      url:
        COMPATIBLE_LIST_URL,
    }
  );

  const response =
    await fetchNilePage({
      url:
        COMPATIBLE_LIST_URL,

      timeoutMs:
        params.timeoutMs,

      retryCount:
        params.retryCount,
    });

  const lookup =
    buildCurriculumLookup(
      params.curriculums
    );

  const result =
    parseNileMajorLiberalCompatibleSubjects({
      html:
        response.text,

      sourceUrl:
        response.url,

      curriculumLookup:
        lookup,

      standardVersion:
        params.standardVersion,

      sourceCheckedAt:
        new Date(),
    });

  return result;
}


/* =========================================================
 * Compatible subjects - derive fallback
 * ========================================================= */

/**
 * 국평원 전공교양 호환 페이지는 전공명 없이
 * 과목명 중심으로 내려오는 경우가 있으므로,
 *
 * 1. 호환 페이지에서 과목 목록 수집
 * 2. 전체 전공 Master와 교집합
 *
 * 방식으로 curriculum별 전공구분을 복원한다.
 */
async function deriveCompatibleSubjects(
  params: {
    curriculums:
      NileParsedCurriculum[];

    standardVersion: string;

    timeoutMs: number;

    retryCount: number;
  }
): Promise<
  NileCollectedMajorLiberalCompatibleSubject[]
> {
  const response =
    await fetchNilePage({
      url:
        COMPATIBLE_LIST_URL,

      timeoutMs:
        params.timeoutMs,

      retryCount:
        params.retryCount,
    });

  /**
   * 호환페이지의 과목 표현은
   * 교양 페이지와 유사한 과목 리스트이므로
   * 공통 과목 parser를 fallback으로 활용한다.
   */
  const compatibleBase =
    parseNileLiberalSubjects({
      html:
        response.text,

      sourceUrl:
        response.url,

      standardVersion:
        params.standardVersion,

      sourceCheckedAt:
        new Date(),
    });

  if (
    compatibleBase.length === 0
  ) {
    return [];
  }

  const compatibleMap =
    new Map<
      string,
      NileCollectedLiberalSubject
    >();

  for (
    const subject
    of compatibleBase
  ) {
    compatibleMap.set(
      normalizeNileSubjectName(
        subject.subjectName
      ),
      subject
    );
  }

  const results:
    NileCollectedMajorLiberalCompatibleSubject[] =
    [];

  for (
    const curriculum
    of params.curriculums
  ) {
    for (
      const subject
      of curriculum.subjects
    ) {
      const normalized =
        normalizeNileSubjectName(
          subject.subjectName
        );

      const compatible =
        compatibleMap.get(
          normalized
        );

      if (
        !compatible
      ) {
        continue;
      }

      results.push({
        curriculumKey:
          curriculum.curriculumKey,

        officialSubjectId:
          subject.officialSubjectId ||
          compatible.officialSubjectId,

        subjectName:
          subject.subjectName,

        majorRequirementType:
          subject.requirementType,

        credits:
          subject.credits,

        lectureHours:
          subject.lectureHours,

        practiceHours:
          subject.practiceHours,

        standardVersion:
          params.standardVersion,

        sourceUrl:
          response.url,

        sourceCheckedAt:
          new Date(),
      });
    }
  }

  return results;
}


/* =========================================================
 * Compatible subjects
 * ========================================================= */

async function collectCompatibleSubjects(
  params: {
    curriculums:
      NileParsedCurriculum[];

    standardVersion: string;

    timeoutMs: number;

    retryCount: number;
  }
): Promise<{
  subjects:
    NileCollectedMajorLiberalCompatibleSubject[];

  warnings:
    string[];
}> {
  const warnings:
    string[] = [];

  /**
   * 1차:
   * 호환페이지 자체에서 전공+과목 관계를 직접 파싱.
   */
  const direct =
    await collectCompatibleSubjectsDirect(
      params
    );

  if (
    direct.length > 0
  ) {
    console.log(
      "[NILE COLLECTOR] compatible direct done",
      {
        count:
          direct.length,
      }
    );

    return {
      subjects:
        direct,

      warnings,
    };
  }

  warnings.push(
    "전공교양 호환과목 direct parser 결과가 없어 전체 전공 교집합 방식으로 재계산했습니다."
  );

  /**
   * 2차:
   * 호환과목 명단과 전체 전공과목을 비교.
   */
  const derived =
    await deriveCompatibleSubjects(
      params
    );

  console.log(
    "[NILE COLLECTOR] compatible derived done",
    {
      count:
        derived.length,
    }
  );

  return {
    subjects:
      derived,

    warnings,
  };
}


/* =========================================================
 * Dataset validation
 * ========================================================= */

function validateCurriculumDataset(
  curriculums:
    NileParsedCurriculum[]
): string[] {
  const errors:
    string[] = [];

  const curriculumKeys =
    new Set<string>();

  const officialKeys =
    new Set<string>();

  for (
    const curriculum
    of curriculums
  ) {
    if (
      !curriculum.curriculumKey
    ) {
      errors.push(
        `curriculumKey 없음: ${curriculum.majorName}`
      );
    }

    if (
      curriculumKeys.has(
        curriculum.curriculumKey
      )
    ) {
      errors.push(
        `curriculumKey 중복: ${curriculum.curriculumKey}`
      );
    }

    curriculumKeys.add(
      curriculum.curriculumKey
    );

    const officialKey =
      `${curriculum.degreeLevel}:${curriculum.officialMajorId}`;

    if (
      officialKeys.has(
        officialKey
      )
    ) {
      errors.push(
        `officialMajorId 중복: ${officialKey}`
      );
    }

    officialKeys.add(
      officialKey
    );

    if (
      curriculum.subjects.length ===
      0
    ) {
      errors.push(
        `과목 없음: ${curriculum.curriculumKey}`
      );
    }

    const subjectNames =
      new Set<string>();

    for (
      const subject
      of curriculum.subjects
    ) {
      const normalized =
        normalizeNileSubjectName(
          subject.subjectName
        );

      if (
        !normalized
      ) {
        errors.push(
          `빈 과목명: ${curriculum.curriculumKey}`
        );

        continue;
      }

      if (
        subjectNames.has(
          normalized
        )
      ) {
        errors.push(
          `전공 내 중복과목: ${curriculum.curriculumKey} / ${subject.subjectName}`
        );
      }

      subjectNames.add(
        normalized
      );

      if (
        subject.credits <= 0
      ) {
        errors.push(
          `과목 학점 오류: ${curriculum.curriculumKey} / ${subject.subjectName}`
        );
      }
    }
  }

  return errors;
}


/* =========================================================
 * Full collector
 * ========================================================= */

export async function collectNileStandardDataset(
  options: CollectorOptions = {}
): Promise<NileCollectorResult> {
  const errors:
    string[] = [];

  const warnings:
    string[] = [];

  const standardVersion =
    cleanText(
      options.standardVersion
    ) ||
    DEFAULT_STANDARD_VERSION;

  const concurrency =
    normalizePositiveInteger(
      options.concurrency,
      DEFAULT_CONCURRENCY
    );

  const timeoutMs =
    normalizePositiveInteger(
      options.requestTimeoutMs,
      DEFAULT_REQUEST_TIMEOUT_MS
    );

  const retryCount =
    normalizePositiveInteger(
      options.retryCount,
      DEFAULT_RETRY_COUNT
    );

  const onlyMajorIds =
    normalizeMajorIds(
      options.onlyMajorIds
    );

  const includeLiberalSubjects =
    options.includeLiberalSubjects !==
    false;

  const includeCompatibleSubjects =
    options.includeCompatibleSubjects !==
    false;

  const collectedAt =
    new Date();

  console.log(
    "[NILE COLLECTOR] full collection start",
    {
      standardVersion,
      concurrency,

      onlyMajorIds:
        onlyMajorIds
          ? Array.from(
              onlyMajorIds
            )
          : null,
    }
  );

  try {
    /* -----------------------------------------------------
     * Bachelor
     * ----------------------------------------------------- */

    const bachelor =
      await collectDegreeCurriculums({
        degreeLevel:
          "bachelor",

        listUrl:
          BACHELOR_LIST_URL,

        standardVersion,

        concurrency,

        timeoutMs,

        retryCount,

        onlyMajorIds,
      });

    warnings.push(
      ...bachelor.warnings
    );

    errors.push(
      ...bachelor.errors
    );


    /* -----------------------------------------------------
     * Associate
     * ----------------------------------------------------- */

    const associate =
      await collectDegreeCurriculums({
        degreeLevel:
          "associate",

        listUrl:
          ASSOCIATE_LIST_URL,

        standardVersion,

        concurrency,

        timeoutMs,

        retryCount,

        onlyMajorIds,
      });

    warnings.push(
      ...associate.warnings
    );

    errors.push(
      ...associate.errors
    );


    const curriculums =
      [
        ...bachelor.curriculums,
        ...associate.curriculums,
      ];


    /* -----------------------------------------------------
     * Validate curriculum
     * ----------------------------------------------------- */

    const curriculumErrors =
      validateCurriculumDataset(
        curriculums
      );

    errors.push(
      ...curriculumErrors
    );


    /**
     * 전체 전공 중 하나라도 실패했다면
     * DB에 전체 sync할 데이터로 인정하지 않는다.
     */
    if (
      errors.length > 0
    ) {
      return {
        success:
          false,

        dataset:
          null,

        errors,

        warnings,
      };
    }


    /* -----------------------------------------------------
     * Liberal
     * ----------------------------------------------------- */

    let liberalSubjects:
      NileCollectedLiberalSubject[] =
      [];

    if (
      includeLiberalSubjects
    ) {
      try {
        liberalSubjects =
          await collectLiberalSubjects({
            standardVersion,

            timeoutMs,

            retryCount,
          });
      } catch (error) {
        errors.push(
          error instanceof Error
            ? error.message
            : String(error)
        );
      }
    }


    /* -----------------------------------------------------
     * Compatible
     * ----------------------------------------------------- */

    let compatibleSubjects:
      NileCollectedMajorLiberalCompatibleSubject[] =
      [];

    if (
      includeCompatibleSubjects
    ) {
      try {
        const compatible =
          await collectCompatibleSubjects({
            curriculums,

            standardVersion,

            timeoutMs,

            retryCount,
          });

        compatibleSubjects =
          compatible.subjects;

        warnings.push(
          ...compatible.warnings
        );

        /**
         * 호환과목은 공식 페이지가 존재하는데
         * 결과가 완전히 0이면 자동 DB 교체하면 안 된다.
         */
        if (
          compatibleSubjects.length ===
          0
        ) {
          errors.push(
            "NILE 전공교양 호환과목 수집 결과가 0건입니다."
          );
        }
      } catch (error) {
        errors.push(
          error instanceof Error
            ? error.message
            : String(error)
        );
      }
    }


    if (
      errors.length > 0
    ) {
      return {
        success:
          false,

        dataset:
          null,

        errors,

        warnings,
      };
    }


    /* -----------------------------------------------------
     * Dataset
     * ----------------------------------------------------- */

    const dataset:
      NileCollectedDataset = {
      collectedAt,

      standardVersion,

      curriculums,

      liberalSubjects,

      majorLiberalCompatibleSubjects:
        compatibleSubjects,

      /**
       * alias/equivalence는 공식 별도 데이터 확보 후
       * collector를 연결한다.
       *
       * AI가 자동 추측해서 alias를 만들지 않는다.
       */
      subjectAliases:
        [],
    };


    console.log(
      "[NILE COLLECTOR] full collection complete",
      {
        curriculumCount:
          dataset.curriculums.length,

        subjectCount:
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
            ),

        liberalSubjectCount:
          dataset
            .liberalSubjects
            .length,

        compatibleSubjectCount:
          dataset
            .majorLiberalCompatibleSubjects
            .length,

        warningCount:
          warnings.length,
      }
    );


    return {
      success:
        true,

      dataset,

      errors:
        [],

      warnings,
    };
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : String(error)
    );

    return {
      success:
        false,

      dataset:
        null,

      errors,

      warnings,
    };
  }
}


/* =========================================================
 * Test collector
 * ========================================================= */

/**
 * 전체 수집 전에 특정 전공만 테스트할 때 사용.
 *
 * 예:
 *
 * collectNileStandardDatasetForTest(
 *   ["AGAE", "AACG"]
 * )
 */
export async function collectNileStandardDatasetForTest(
  officialMajorIds: string[]
): Promise<NileCollectorResult> {
  return collectNileStandardDataset({
    onlyMajorIds:
      officialMajorIds,

    concurrency:
      2,

    includeLiberalSubjects:
      false,

    includeCompatibleSubjects:
      false,
  });
}


/* =========================================================
 * Public constants
 * ========================================================= */

export const NILE_STANDARD_URLS = {
  bachelor:
    BACHELOR_LIST_URL,

  associate:
    ASSOCIATE_LIST_URL,

  liberal:
    LIBERAL_LIST_URL,

  compatible:
    COMPATIBLE_LIST_URL,
} as const;


/* =========================================================
 * Key helper
 * ========================================================= */

/**
 * 외부 코드에서 officialMajorId로
 * curriculumKey를 계산할 필요가 있을 때 사용.
 */
export function getNileCurriculumKey(
  degreeLevel: NileDegreeLevel,
  officialMajorId: string
): string {
  return buildNileCurriculumKey({
    degreeLevel,
    officialMajorId,
  });
}