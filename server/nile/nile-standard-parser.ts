// server/nile/nile-standard-parser.ts

import * as cheerio from "cheerio";

import {
  buildNileCurriculumKey,
  normalizeNileSubjectName,

  type NileCollectedCurriculumSummary,
  type NileCollectedLiberalSubject,
  type NileCollectedMajorLiberalCompatibleSubject,
  type NileCollectedSubject,
  type NileDegreeLevel,
  type NileParsedCurriculum,
  type NileRequirementType,
} from "./nile-standard-types";


/* =========================================================
 * Constants
 * ========================================================= */

const NILE_BASE_URL =
  "https://www.cb.or.kr";

const DEFAULT_STANDARD_VERSION =
  "current";


/* =========================================================
 * Generic helpers
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


function decodeHtmlEntities(
  value: string
): string {
  if (!value) {
    return "";
  }

  const $ =
    cheerio.load(
      `<span>${value}</span>`
    );

  return cleanText(
    $("span").text()
  );
}


function toAbsoluteUrl(
  value:
    | string
    | null
    | undefined
): string | null {
  const raw =
    cleanText(value);

  if (!raw) {
    return null;
  }

  if (
    raw.startsWith(
      "javascript:"
    )
  ) {
    return null;
  }

  try {
    return new URL(
      raw,
      NILE_BASE_URL
    ).toString();
  } catch {
    return null;
  }
}


function parseInteger(
  value:
    | string
    | null
    | undefined,
  fallback = 0
): number {
  const matched =
    String(
      value || ""
    ).match(
      /-?\d+/
    );

  if (!matched) {
    return fallback;
  }

  const parsed =
    Number(
      matched[0]
    );

  if (
    !Number.isFinite(
      parsed
    )
  ) {
    return fallback;
  }

  return parsed;
}


function normalizeRequirementType(
  value:
    | string
    | null
    | undefined
): NileRequirementType | null {
  const text =
    cleanText(value)
      .replace(/\s+/g, "");

  if (
    text.includes(
      "전공필수"
    ) ||
    text === "전공필수"
  ) {
    return "전공필수";
  }

  if (
    text.includes(
      "전공선택"
    ) ||
    text === "전공선택"
  ) {
    return "전공선택";
  }

  return null;
}


function extractOfficialSubjectId(
  value:
    | string
    | null
    | undefined
): string | null {
  const source =
    String(
      value || ""
    );

  /**
   * 현재 국평원 상세페이지에서
   * 과목 정보 함수가 보통 다음 형태다.
   *
   * fnStd1_2_YomokInfo('19981300')
   */
  const functionMatch =
    source.match(
      /fnStd1_2_YomokInfo\s*\(\s*['"]([^'"]+)['"]/i
    );

  if (
    functionMatch?.[1]
  ) {
    return cleanText(
      functionMatch[1]
    );
  }

  /**
   * 다른 페이지/개정 대응용.
   */
  const numericMatch =
    source.match(
      /\b(\d{6,20})\b/
    );

  if (
    numericMatch?.[1]
  ) {
    return cleanText(
      numericMatch[1]
    );
  }

  return null;
}


function extractOfficialMajorIdFromUrl(
  value:
    | string
    | null
    | undefined
): string | null {
  const raw =
    String(
      value || ""
    );

  if (!raw) {
    return null;
  }

  try {
    const url =
      new URL(
        raw,
        NILE_BASE_URL
      );

    const id =
      cleanText(
        url.searchParams.get(
          "m_szMajorId"
        )
      );

    return id || null;
  } catch {
    const matched =
      raw.match(
        /m_szMajorId=([A-Za-z0-9_-]+)/i
      );

    return matched?.[1]
      ? cleanText(
          matched[1]
        )
      : null;
  }
}


/* =========================================================
 * Degree requirement
 * ========================================================= */

function getDefaultDegreeRequirements(
  params: {
    degreeLevel: NileDegreeLevel;

    associateDurationYears:
      | 2
      | 3
      | null;
  }
): {
  requiredTotalCredits: number;
  requiredMajorCredits: number;
  requiredLiberalCredits: number;
} {
  if (
    params.degreeLevel ===
    "bachelor"
  ) {
    return {
      requiredTotalCredits:
        140,

      requiredMajorCredits:
        60,

      requiredLiberalCredits:
        30,
    };
  }

  if (
    params.associateDurationYears ===
    3
  ) {
    return {
      requiredTotalCredits:
        120,

      requiredMajorCredits:
        54,

      requiredLiberalCredits:
        21,
    };
  }

  return {
    requiredTotalCredits:
      80,

    requiredMajorCredits:
      45,

    requiredLiberalCredits:
      15,
  };
}


/* =========================================================
 * Core requirement
 * ========================================================= */

function parseCoreRequirement(
  pageText: string
): {
  hasCoreRequirement: boolean;
  requiredCoreSubjectCount:
    | number
    | null;
} {
  const normalized =
    cleanText(
      pageText
    );

  const hasCoreRequirement =
    normalized.includes(
      "전공필수 핵심제"
    );

  if (
    !hasCoreRequirement
  ) {
    return {
      hasCoreRequirement:
        false,

      requiredCoreSubjectCount:
        null,
    };
  }

  /**
   * 예:
   * 전공필수 5개 과목 이상 이수하면
   * 전공필수 요건 충족
   */
  const countMatch =
    normalized.match(
      /전공필수\s*(\d+)\s*개\s*과목\s*이상/i
    );

  const count =
    countMatch?.[1]
      ? Number(
          countMatch[1]
        )
      : null;

  return {
    hasCoreRequirement:
      true,

    requiredCoreSubjectCount:
      count &&
      Number.isFinite(count)
        ? count
        : null,
  };
}


/* =========================================================
 * Curriculum title
 * ========================================================= */

function parseMajorName(
  $: cheerio.CheerioAPI
): string {
  const pageText =
    cleanText(
      $.root().text()
    );

  /**
   * 현재 페이지:
   * 전공명 컴퓨터공학 전공(Computer Engineering)
   */
  const textMatch =
    pageText.match(
      /전공명\s*([^\n]+?전공)(?:\s*\(|\s*교육목표|$)/
    );

  if (
    textMatch?.[1]
  ) {
    return cleanText(
      textMatch[1]
    );
  }

  /**
   * h3/h4/title fallback.
   */
  const candidates =
    $(
      "h1, h2, h3, h4, strong, dt"
    )
      .map(
        (_, element) =>
          cleanText(
            $(element).text()
          )
      )
      .get();

  for (
    const candidate
    of candidates
  ) {
    if (
      candidate.includes(
        "전공"
      ) &&
      !candidate.includes(
        "전공필수"
      ) &&
      !candidate.includes(
        "전공선택"
      )
    ) {
      return candidate
        .replace(
          /^전공명\s*/,
          ""
        )
        .replace(
          /\([^)]*\)\s*$/,
          ""
        )
        .trim();
    }
  }

  return "";
}


/**
 * 학위명은 목록 collector에서 이미 확보하는 것을
 * 기본으로 하고, 상세페이지만 파싱할 경우를 위한 fallback.
 */
function resolveDegreeName(
  params: {
    degreeLevel: NileDegreeLevel;
    suppliedDegreeName?: string;
  }
): string {
  const supplied =
    cleanText(
      params.suppliedDegreeName
    );

  if (supplied) {
    return supplied;
  }

  /**
   * 정확한 학위명은 전공목록 collector가 공급해야 한다.
   * 여기서 임의로 학위명을 추측하지 않는다.
   */
  return params.degreeLevel ===
    "bachelor"
    ? "학사"
    : "전문학사";
}


/* =========================================================
 * Subject parsing
 * ========================================================= */

/**
 * HTML 하나에서 공식 과목 ID와 과목명을 연결하기 위해
 * onclick/href에 fnStd1_2_YomokInfo()가 들어간 노드를 먼저 찾는다.
 */
function collectSubjectAnchors(
  $: cheerio.CheerioAPI
): Array<{
  element: cheerio.AnyNode;
  subjectName: string;
  officialSubjectId:
    | string
    | null;
}> {
  const result:
    Array<{
      element: cheerio.AnyNode;
      subjectName: string;
      officialSubjectId:
        | string
        | null;
    }> =
    [];

  const seen =
    new Set<string>();

  $(
    "a, button, [onclick]"
  ).each(
    (_, element) => {
      const node =
        $(element);

      const href =
        node.attr("href") ||
        "";

      const onclick =
        node.attr(
          "onclick"
        ) ||
        "";

      const source =
        `${href} ${onclick}`;

      const officialSubjectId =
        extractOfficialSubjectId(
          source
        );

      if (
        !officialSubjectId
      ) {
        return;
      }

      let subjectName =
        cleanText(
          node.text()
        );

      /**
       * '교수', '요목' 링크에도 같은 ID가 붙을 수 있다.
       * 과목명 링크만 남긴다.
       */
      if (
        !subjectName ||
        subjectName === "교수" ||
        subjectName === "요목" ||
        subjectName.includes(
          "개설교육"
        ) ||
        subjectName.includes(
          "훈련기관"
        )
      ) {
        return;
      }

      subjectName =
        decodeHtmlEntities(
          subjectName
        );

      const key =
        `${officialSubjectId}:${normalizeNileSubjectName(subjectName)}`;

      if (
        seen.has(key)
      ) {
        return;
      }

      seen.add(key);

      result.push({
        element,
        subjectName,
        officialSubjectId,
      });
    }
  );

  return result;
}


function findRequirementTypeNearElement(
  $: cheerio.CheerioAPI,
  element: cheerio.AnyNode
): NileRequirementType | null {
  let current =
    $(element);

  /**
   * 우선 가장 가까운 li/tr/div/dl 등에서 찾는다.
   */
  for (
    let depth = 0;
    depth < 8;
    depth += 1
  ) {
    const parent =
      current.parent();

    if (
      parent.length === 0
    ) {
      break;
    }

    const parentText =
      cleanText(
        parent.text()
      );

    const requirementType =
      normalizeRequirementType(
        parentText
      );

    if (
      requirementType
    ) {
      return requirementType;
    }

    current =
      parent;
  }

  /**
   * 앞쪽 형제/텍스트 fallback.
   */
  let previous =
    $(element);

  for (
    let i = 0;
    i < 10;
    i += 1
  ) {
    const prev =
      previous.prev();

    if (
      prev.length === 0
    ) {
      break;
    }

    const requirementType =
      normalizeRequirementType(
        prev.text()
      );

    if (
      requirementType
    ) {
      return requirementType;
    }

    previous =
      prev;
  }

  return null;
}


function findSubjectMetaNearElement(
  $: cheerio.CheerioAPI,
  element: cheerio.AnyNode
): {
  credits: number;
  lectureHours: number;
  practiceHours: number;
} {
  let current =
    $(element);

  let blockText =
    "";

  /**
   * 과목명과 학점/시간이 같이 있는 가장 가까운 컨테이너 탐색.
   */
  for (
    let depth = 0;
    depth < 8;
    depth += 1
  ) {
    const parent =
      current.parent();

    if (
      parent.length === 0
    ) {
      break;
    }

    const text =
      cleanText(
        parent.text()
      );

    if (
      /학점\s*[:：]?\s*\d+/i.test(
        text
      ) &&
      /강의시간\s*[:：]?\s*\d+/i.test(
        text
      )
    ) {
      blockText =
        text;

      break;
    }

    current =
      parent;
  }

  /**
   * DOM 구조가 달라졌다면 주변 HTML을 더 넓게 본다.
   */
  if (
    !blockText
  ) {
    const parent =
      $(element)
        .parent()
        .parent();

    blockText =
      cleanText(
        parent.text()
      );
  }

  const creditMatch =
    blockText.match(
      /학점\s*[:：]?\s*(\d+)/i
    );

  const lectureMatch =
    blockText.match(
      /강의시간\s*[:：]?\s*(\d+)/i
    );

  const practiceMatch =
    blockText.match(
      /실습시간\s*[:：]?\s*(\d+)/i
    );

  return {
    credits:
      creditMatch?.[1]
        ? Number(
            creditMatch[1]
          )
        : 0,

    lectureHours:
      lectureMatch?.[1]
        ? Number(
            lectureMatch[1]
          )
        : 0,

    practiceHours:
      practiceMatch?.[1]
        ? Number(
            practiceMatch[1]
          )
        : 0,
  };
}


function buildSubjectDetailUrl(
  officialSubjectId:
    | string
    | null
): string | null {
  if (
    !officialSubjectId
  ) {
    return null;
  }

  /**
   * 교수요목 상세 라우트는 collector 단계에서
   * 실제 href를 발견하면 그 URL을 우선 사용한다.
   *
   * JS 함수만 존재하는 경우에는 공식 ID만 저장하고
   * 임의 URL을 생성하지 않는다.
   */
  return null;
}


function parseSubjectsFromAnchors(
  $: cheerio.CheerioAPI
): NileCollectedSubject[] {
  const result:
    NileCollectedSubject[] =
    [];

  /**
   * 현재 국평원 표준교육과정 상세페이지는
   * 과목 하나를 li 단위로 구성한다.
   *
   * 각 li 내부에:
   * - badgeWrap > em : 전공필수 / 전공선택
   * - nameBlock dt a : 과목명 / 공식 과목 ID
   * - nameBlock dd   : 학점 / 강의시간 / 실습시간
   *
   * 따라서 상위 DOM을 탐색해서 구분을 추측하지 않고
   * 과목 li 자체에서 필요한 정보를 읽는다.
   */
  $(
    ".listDateR01 > li"
  ).each(
    (
      _index,
      element
    ) => {
      const row =
        $(element);

      const requirementText =
        cleanText(
          row
            .find(
              ".badgeWrap em"
            )
            .first()
            .text()
        );

      const requirementType =
        normalizeRequirementType(
          requirementText
        );

      if (
        !requirementType
      ) {
        return;
      }

      const subjectAnchor =
        row
          .find(
            ".nameBlock dt a"
          )
          .first();

      if (
        subjectAnchor.length ===
        0
      ) {
        return;
      }

      const subjectName =
        cleanText(
          subjectAnchor.text()
        );

      if (
        !subjectName
      ) {
        return;
      }

      const href =
        subjectAnchor.attr(
          "href"
        ) || "";

      const officialSubjectId =
        extractOfficialSubjectId(
          href
        );

      /**
       * 과목 메타정보는 동일 li 내부의
       * nameBlock dd에서만 읽는다.
       */
      const metaText =
        cleanText(
          row
            .find(
              ".nameBlock dd"
            )
            .first()
            .text()
        );

      const creditMatch =
        metaText.match(
          /학점\s*:\s*(\d+)/i
        );

      const lectureMatch =
        metaText.match(
          /강의시간\s*:\s*(\d+)/i
        );

      const practiceMatch =
        metaText.match(
          /실습시간\s*:\s*(\d+)/i
        );

      const credits =
        creditMatch
          ? Number(
              creditMatch[1]
            )
          : 0;

      const lectureHours =
        lectureMatch
          ? Number(
              lectureMatch[1]
            )
          : 0;

      const practiceHours =
        practiceMatch
          ? Number(
              practiceMatch[1]
            )
          : 0;

      if (
        !Number.isFinite(
          credits
        ) ||
        credits <= 0
      ) {
        return;
      }

      const normalizedName =
        normalizeNileSubjectName(
          subjectName
        );

      if (
        !normalizedName
      ) {
        return;
      }

      /**
 * 동일한 과목명이 공식 페이지에 여러 행으로 존재할 수 있다.
 *
 * 공식 과목 ID가 있으면 ID 기준으로 중복 제거하고,
 * ID가 없으면 실제 DOM 행(index)을 기준으로 구분한다.
 *
 * 과목명만으로 중복 제거하면 AQAC의 '해상척후조'처럼
 * 공식 페이지에 동일명 과목이 2행 존재하는 경우
 * 정상 과목 하나가 유실된다.
 */

      result.push({
        officialSubjectId,

        subjectName,

        requirementType,

        credits,

        lectureHours:
          Number.isFinite(
            lectureHours
          )
            ? lectureHours
            : 0,

        practiceHours:
          Number.isFinite(
            practiceHours
          )
            ? practiceHours
            : 0,

        isCoreRequired:
          false,

        sortOrder:
          result.length + 1,

        sourceUrl:
          buildSubjectDetailUrl(
            officialSubjectId
          ),
      });
    }
  );

  return result;
}


/* =========================================================
 * Text fallback parser
 * ========================================================= */

/**
 * 사이트 DOM 구조가 바뀌거나 과목 링크가
 * 추출되지 않았을 때 사용할 보조 파서.
 *
 * 공식 과목 ID는 HTML의 JS 호출에서 최대한 찾아 붙인다.
 */
function parseSubjectsFromTextFallback(
  html: string,
  $: cheerio.CheerioAPI
): NileCollectedSubject[] {
  const rootText =
    cleanText(
      $.root().text()
    );

  const result:
    NileCollectedSubject[] =
    [];

  /**
   * 전공필수 / 전공선택 블록을 텍스트 기준으로 분리.
   */
  const tokens =
    rootText
      .replace(
        /(전공필수|전공선택)/g,
        "\n$1\n"
      )
      .split("\n")
      .map(
        (value) =>
          cleanText(
            value
          )
      )
      .filter(Boolean);

  let currentRequirement:
    NileRequirementType | null =
    null;

  const rowPattern =
    /^(.+?)\s+학점\s*[:：]?\s*(\d+)\s*강의시간\s*[:：]?\s*(\d+)\s*실습시간\s*[:：]?\s*(\d+)/;

  for (
    const token
    of tokens
  ) {
    const requirement =
      normalizeRequirementType(
        token
      );

    if (
      requirement &&
      (
        token === "전공필수" ||
        token === "전공선택"
      )
    ) {
      currentRequirement =
        requirement;

      continue;
    }

    if (
      !currentRequirement
    ) {
      continue;
    }

    const match =
      token.match(
        rowPattern
      );

    if (
      !match
    ) {
      continue;
    }

    const subjectName =
      cleanText(
        match[1]
      );

    if (
      !subjectName
    ) {
      continue;
    }

    const escapedName =
      subjectName.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

    const nearbyIdRegex =
      new RegExp(
        `fnStd1_2_YomokInfo\\s*\\(\\s*['"]([^'"]+)['"][\\s\\S]{0,500}?${escapedName}|${escapedName}[\\s\\S]{0,500}?fnStd1_2_YomokInfo\\s*\\(\\s*['"]([^'"]+)['"]`,
        "i"
      );

    const idMatch =
      html.match(
        nearbyIdRegex
      );

    const officialSubjectId =
      idMatch?.[1] ||
      idMatch?.[2] ||
      null;

    result.push({
      officialSubjectId,

      subjectName,

      requirementType:
        currentRequirement,

      credits:
        Number(
          match[2]
        ),

      lectureHours:
        Number(
          match[3]
        ),

      practiceHours:
        Number(
          match[4]
        ),

      isCoreRequired:
        false,

      sortOrder:
        result.length + 1,

      sourceUrl:
        null,
    });
  }

  return result;
}


/* =========================================================
 * Subject consistency
 * ========================================================= */

function markCoreRequiredSubjects(
  subjects: NileCollectedSubject[],
  params: {
    hasCoreRequirement: boolean;
  }
): NileCollectedSubject[] {
  if (
    !params
      .hasCoreRequirement
  ) {
    return subjects.map(
      (subject) => ({
        ...subject,
        isCoreRequired:
          false,
      })
    );
  }

  /**
   * 핵심제가 있는 전공에서는
   * 공식 전공필수 과목들을 핵심제 후보로 표시한다.
   *
   * requiredCoreSubjectCount가 실제 충족 개수를 결정한다.
   */
  return subjects.map(
    (subject) => ({
      ...subject,

      isCoreRequired:
        subject
          .requirementType ===
        "전공필수",
    })
  );
}


function deduplicateSubjects(
  subjects: NileCollectedSubject[]
): NileCollectedSubject[] {
  const map =
    new Map<
      string,
      NileCollectedSubject
    >();

  for (
    const subject
    of subjects
  ) {
    const normalizedName =
      normalizeNileSubjectName(
        subject.subjectName
      );

    if (
      !normalizedName
    ) {
      continue;
    }

    const key =
  subject.officialSubjectId
    ? `${subject.requirementType}:id:${subject.officialSubjectId}`
    : `${subject.requirementType}:name:${normalizedName}:row:${subject.sortOrder}`;

    const existing =
      map.get(key);

    if (
      !existing
    ) {
      map.set(
        key,
        subject
      );

      continue;
    }

    /**
     * ID가 있는 결과를 우선.
     */
    if (
      !existing
        .officialSubjectId &&
      subject
        .officialSubjectId
    ) {
      map.set(
        key,
        subject
      );
    }
  }

  return Array.from(
    map.values()
  ).map(
    (
      subject,
      index
    ) => ({
      ...subject,
      sortOrder:
        index + 1,
    })
  );
}


/* =========================================================
 * Curriculum detail parser
 * ========================================================= */

export function parseNileCurriculumDetail(
  params: {
    html: string;

    sourceUrl: string;

    degreeLevel: NileDegreeLevel;

associateDurationYears?:
  | 2
  | 3
  | null;

    degreeName?: string;

    majorName?: string;

    officialMajorId?: string;

    standardVersion?: string;

    sourceCheckedAt?: Date;
  }
): NileParsedCurriculum {
  const html =
    String(
      params.html ||
      ""
    );

  if (
    !html.trim()
  ) {
    throw new Error(
      "NILE curriculum parser: HTML이 비어 있습니다."
    );
  }

  const $ =
    cheerio.load(
      html
    );

  const pageText =
    cleanText(
      $.root().text()
    );

  const sourceUrl =
    cleanText(
      params.sourceUrl
    );

  if (
    !sourceUrl
  ) {
    throw new Error(
      "NILE curriculum parser: sourceUrl이 없습니다."
    );
  }

  const officialMajorId =
    cleanText(
      params
        .officialMajorId
    ) ||
    extractOfficialMajorIdFromUrl(
      sourceUrl
    ) ||
    "";

  if (
    !officialMajorId
  ) {
    throw new Error(
      `NILE curriculum parser: officialMajorId 확인 실패 (${sourceUrl})`
    );
  }

  const majorName =
    cleanText(
      params.majorName
    ) ||
    parseMajorName(
      $
    );

  if (
    !majorName
  ) {
    throw new Error(
      `NILE curriculum parser: 전공명 확인 실패 (${officialMajorId})`
    );
  }

  const degreeName =
    resolveDegreeName({
      degreeLevel:
        params.degreeLevel,

      suppliedDegreeName:
        params.degreeName,
    });

  const core =
    parseCoreRequirement(
      pageText
    );

  let subjects =
    parseSubjectsFromAnchors(
      $
    );

  /**
   * DOM 기반 결과가 없으면 fallback.
   */
  if (
    subjects.length === 0
  ) {
    subjects =
      parseSubjectsFromTextFallback(
        html,
        $
      );
  }

  subjects =
    markCoreRequiredSubjects(
      subjects,
      {
        hasCoreRequirement:
          core
            .hasCoreRequirement,
      }
    );

  if (
    subjects.length === 0
  ) {
    throw new Error(
      `NILE curriculum parser: 과목 파싱 결과가 없습니다. (${officialMajorId} / ${majorName})`
    );
  }

  const requirements =
  getDefaultDegreeRequirements({
    degreeLevel:
      params.degreeLevel,

    associateDurationYears:
      params.degreeLevel ===
      "associate"
        ? (
            params
              .associateDurationYears ||
            2
          )
        : null,
  });

  const curriculumKey =
    buildNileCurriculumKey({
      degreeLevel:
        params.degreeLevel,

      officialMajorId,
    });

  return {
    curriculumKey,

    degreeLevel:
      params.degreeLevel,

associateDurationYears:
  params.degreeLevel ===
  "associate"
    ? (
        params
          .associateDurationYears ||
        2
      )
    : null,

    degreeName,

    majorName,

    officialMajorId,

    requiredTotalCredits:
      requirements
        .requiredTotalCredits,

    requiredMajorCredits:
      requirements
        .requiredMajorCredits,

    requiredLiberalCredits:
      requirements
        .requiredLiberalCredits,

    hasCoreRequirement:
      core
        .hasCoreRequirement,

    requiredCoreSubjectCount:
      core
        .requiredCoreSubjectCount,

    standardVersion:
      cleanText(
        params
          .standardVersion
      ) ||
      DEFAULT_STANDARD_VERSION,

    sourceUrl,

    sourceCheckedAt:
      params
        .sourceCheckedAt ||
      new Date(),

    subjects,
  };
}


/* =========================================================
 * Curriculum list parser
 * ========================================================= */

/**
 * 학사/전문학사 전공 목록 페이지에서
 * 상세페이지 링크를 수집한다.
 *
 * collector가 해당 결과를 순회하며 상세페이지를 fetch한다.
 */
export function parseNileCurriculumList(
  params: {
    html: string;

    sourceUrl: string;

    degreeLevel: NileDegreeLevel;
  }
): NileCollectedCurriculumSummary[] {
  const html =
    String(
      params.html ||
      ""
    );

  if (
    !html.trim()
  ) {
    return [];
  }

  const $ =
    cheerio.load(
      html
    );

  const results:
  NileCollectedCurriculumSummary[] =
  [];

const seen =
  new Set<string>();

$(
  "a[href], [onclick]"
).each(
    (_, element) => {
      const node =
        $(element);

      const href =
        node.attr("href") ||
        "";

      const onclick =
        node.attr(
          "onclick"
        ) ||
        "";

      const combined =
        `${href} ${onclick}`;

      /**
       * 상세 URL querystring에서 majorId 탐색.
       */
      let officialMajorId =
        extractOfficialMajorIdFromUrl(
          href
        );

      if (
  !officialMajorId
) {
  /**
   * 현재 국평원 전공목록은
   *
   * javascript:fnMajorYomokList('AGAE')
   *
   * 형태로 전공 ID를 전달한다.
   */
  const functionMatch =
    combined.match(
      /fnMajorYomokList\s*\(\s*['"]([^'"]+)['"]\s*\)/i
    );

  if (
    functionMatch?.[1]
  ) {
    officialMajorId =
      cleanText(
        functionMatch[1]
      );
  }
}

if (
  !officialMajorId
) {
  /**
   * 과거/다른 페이지 형식 호환.
   */
  const parameterMatch =
    combined.match(
      /m_szMajorId[=,'"\s(]+([A-Za-z0-9_-]+)/i
    );

  officialMajorId =
    parameterMatch?.[1]
      ? cleanText(
          parameterMatch[1]
        )
      : null;
}

      if (
        !officialMajorId
      ) {
        return;
      }

      const rawText =
        cleanText(
          node.text()
        );

      if (
        !rawText
      ) {
        return;
      }

      /**
       * "(English Name)" 제거.
       */
      const majorName =
        rawText
          .replace(
            /\([^)]*\)\s*$/,
            ""
          )
          .replace(
            /^전공명\s*/,
            ""
          )
          .trim();

      if (
        !majorName ||
        !majorName.includes(
          "전공"
        )
      ) {
        return;
      }

      let degreeName =
        "";

      /**
       * 가장 가까운 상위 블록에서
       * 학위명 추출을 시도한다.
       */
      let current =
        node;

      for (
        let depth = 0;
        depth < 6;
        depth += 1
      ) {
        const parent =
          current.parent();

        if (
          parent.length === 0
        ) {
          break;
        }

        const text =
          cleanText(
            parent.text()
          );

        const degreeMatch =
          text.match(
            /(문학사|이학사|공학사|경영학사|행정학사|가정학사|미술학사|음악학사|체육학사|전문학사|행정전문학사|가정전문학사|공업전문학사|예술전문학사|체육전문학사)/
          );

        if (
          degreeMatch?.[1]
        ) {
          degreeName =
            degreeMatch[1];

          break;
        }

        current =
          parent;
      }

let associateDurationYears:
  | 2
  | 3
  | null =
  null;

if (
  params.degreeLevel ===
  "associate"
) {
  let current =
    node;

  for (
    let depth = 0;
    depth < 8;
    depth += 1
  ) {
    const parent =
      current.parent();

    if (
      parent.length === 0
    ) {
      break;
    }

    const text =
      cleanText(
        parent.text()
      );

    if (
      text.includes("3년제")
    ) {
      associateDurationYears =
        3;

      break;
    }

    if (
      text.includes("2년제")
    ) {
      associateDurationYears =
        2;

      break;
    }

    current =
      parent;
  }

  /**
   * 페이지에 별도 표기가 없으면
   * 2년제로 본다.
   */
  if (
    associateDurationYears ===
    null
  ) {
    associateDurationYears =
      2;
  }
}

      /**
       * onclick만 있는 경우 collector에서 URL을
       * 구성할 수 있도록 표준 상세 route를 만든다.
       */
      const typeCode =
        params.degreeLevel ===
        "bachelor"
          ? "A"
          : "B";

      const detailUrl =
        toAbsoluteUrl(
          href
        ) ||
        `${NILE_BASE_URL}/creditbank/stdPro/nStdPro1_1_1.do?m_szMajorId=${encodeURIComponent(
          officialMajorId
        )}&m_szType=${typeCode}`;

      const dedupeKey =
        `${params.degreeLevel}:${officialMajorId}`;

      if (
        seen.has(
          dedupeKey
        )
      ) {
        return;
      }

      seen.add(
        dedupeKey
      );

      results.push({
        degreeLevel:
          params.degreeLevel,

associateDurationYears,

        degreeName:
          degreeName ||
          (
            params.degreeLevel ===
            "bachelor"
              ? "학사"
              : "전문학사"
          ),

        majorName,

        officialMajorId,

        sourceUrl:
          detailUrl,
      });
    }
  );

  return results;
}


/* =========================================================
 * Liberal arts parser
 * ========================================================= */

export function parseNileLiberalSubjects(
  params: {
    html: string;

    sourceUrl: string;

    standardVersion?: string;

    sourceCheckedAt?: Date;
  }
): NileCollectedLiberalSubject[] {
  const html =
    String(
      params.html ||
      ""
    );

  if (
    !html.trim()
  ) {
    return [];
  }

  const $ =
    cheerio.load(
      html
    );

  const checkedAt =
    params
      .sourceCheckedAt ||
    new Date();

  const standardVersion =
    cleanText(
      params.standardVersion
    ) ||
    DEFAULT_STANDARD_VERSION;

  const results:
    NileCollectedLiberalSubject[] =
    [];

  const anchors =
    collectSubjectAnchors(
      $
    );

  const seen =
    new Set<string>();

  for (
    const anchor
    of anchors
  ) {
    const meta =
      findSubjectMetaNearElement(
        $,
        anchor.element
      );

    if (
      !meta.credits
    ) {
      continue;
    }

    const normalized =
      normalizeNileSubjectName(
        anchor.subjectName
      );

    if (
      !normalized ||
      seen.has(
        normalized
      )
    ) {
      continue;
    }

    seen.add(
      normalized
    );

    results.push({
      officialSubjectId:
        anchor
          .officialSubjectId,

      subjectName:
        anchor.subjectName,

      credits:
        meta.credits,

      lectureHours:
        meta.lectureHours,

      practiceHours:
        meta.practiceHours,

      standardVersion,

      sourceUrl:
        cleanText(
          params.sourceUrl
        ) ||
        null,

      sourceCheckedAt:
        checkedAt,
    });
  }

  return results;
}


/* =========================================================
 * Major / Liberal compatible parser
 * ========================================================= */

export function parseNileMajorLiberalCompatibleSubjects(
  params: {
    html: string;

    sourceUrl: string;

    curriculumLookup: Map<
      string,
      string
    >;

    standardVersion?: string;

    sourceCheckedAt?: Date;
  }
): NileCollectedMajorLiberalCompatibleSubject[] {
  const html =
    String(
      params.html ||
      ""
    );

  if (
    !html.trim()
  ) {
    return [];
  }

  const $ =
    cheerio.load(
      html
    );

  const checkedAt =
    params
      .sourceCheckedAt ||
    new Date();

  const standardVersion =
    cleanText(
      params.standardVersion
    ) ||
    DEFAULT_STANDARD_VERSION;

  const results:
    NileCollectedMajorLiberalCompatibleSubject[] =
    [];

  /**
   * 호환과목 페이지는 전공 정보와 과목 정보가
   * 같은 행/블록에 존재할 가능성이 높으므로
   * tr/li/div 단위로 조사한다.
   */
  $(
    "tr, li, dl, .list, .item, .row"
  ).each(
    (_, element) => {
      const node =
        $(element);

      const text =
        cleanText(
          node.text()
        );

      if (
        !text
      ) {
        return;
      }

      const requirementType =
        normalizeRequirementType(
          text
        );

      if (
        !requirementType
      ) {
        return;
      }

      let curriculumKey:
        string | null =
        null;

      for (
        const [
          lookupName,
          lookupKey,
        ]
        of params
          .curriculumLookup
          .entries()
      ) {
        if (
          text.includes(
            lookupName
          )
        ) {
          curriculumKey =
            lookupKey;

          break;
        }
      }

      if (
        !curriculumKey
      ) {
        return;
      }

      const subjectAnchor =
        node
          .find(
            "a, [onclick]"
          )
          .filter(
            (_, child) => {
              const childNode =
                $(child);

              return Boolean(
                extractOfficialSubjectId(
                  `${
                    childNode.attr(
                      "href"
                    ) || ""
                  } ${
                    childNode.attr(
                      "onclick"
                    ) || ""
                  }`
                )
              );
            }
          )
          .first();

      let subjectName =
        cleanText(
          subjectAnchor.text()
        );

      if (
        !subjectName ||
        subjectName ===
          "교수" ||
        subjectName ===
          "요목"
      ) {
        return;
      }

      const officialSubjectId =
        extractOfficialSubjectId(
          `${
            subjectAnchor.attr(
              "href"
            ) || ""
          } ${
            subjectAnchor.attr(
              "onclick"
            ) || ""
          }`
        );

      const meta =
        findSubjectMetaNearElement(
          $,
          subjectAnchor.get(0)
        );

      if (
        !meta.credits
      ) {
        return;
      }

      results.push({
        curriculumKey,

        officialSubjectId,

        subjectName,

        majorRequirementType:
          requirementType,

        credits:
          meta.credits,

        lectureHours:
          meta.lectureHours,

        practiceHours:
          meta.practiceHours,

        standardVersion,

        sourceUrl:
          cleanText(
            params.sourceUrl
          ) ||
          null,

        sourceCheckedAt:
          checkedAt,
      });
    }
  );

  const unique =
    new Map<
      string,
      NileCollectedMajorLiberalCompatibleSubject
    >();

  for (
    const item
    of results
  ) {
    const key =
      `${item.curriculumKey}:${normalizeNileSubjectName(
        item.subjectName
      )}`;

    if (
      !unique.has(
        key
      )
    ) {
      unique.set(
        key,
        item
      );
    }
  }

  return Array.from(
    unique.values()
  );
}


/* =========================================================
 * Validation helpers
 * ========================================================= */

export function countNileCurriculumSubjects(
  curriculum: NileParsedCurriculum
): {
  requiredCount: number;
  electiveCount: number;
  totalCount: number;
} {
  const requiredCount =
    curriculum.subjects
      .filter(
        (subject) =>
          subject
            .requirementType ===
          "전공필수"
      )
      .length;

  const electiveCount =
    curriculum.subjects
      .filter(
        (subject) =>
          subject
            .requirementType ===
          "전공선택"
      )
      .length;

  return {
    requiredCount,

    electiveCount,

    totalCount:
      requiredCount +
      electiveCount,
  };
}


export function parseDeclaredSubjectCounts(
  html: string
): {
  requiredCount:
    | number
    | null;

  electiveCount:
    | number
    | null;
} {
  const $ =
    cheerio.load(
      String(
        html || ""
      )
    );

  const text =
    cleanText(
      $.root().text()
    );

  /**
   * 예:
   * 세부교육과정표
   * (전공필수 7과목/전공선택 55과목)
   */
  const match =
    text.match(
      /전공필수\s*(\d+)\s*과목\s*\/?\s*전공선택\s*(\d+)\s*과목/i
    );

  return {
    requiredCount:
      match?.[1]
        ? Number(
            match[1]
          )
        : null,

    electiveCount:
      match?.[2]
        ? Number(
            match[2]
          )
        : null,
  };
}


/**
 * collector가 상세페이지를 가져온 직후
 * 파싱 누락 여부를 강하게 검사하는 용도.
 */
export function assertNileCurriculumParseComplete(
  params: {
    html: string;
    curriculum: NileParsedCurriculum;
  }
): void {
  const declared =
    parseDeclaredSubjectCounts(
      params.html
    );

  const actual =
    countNileCurriculumSubjects(
      params.curriculum
    );

  if (
    declared.requiredCount !==
      null &&
    declared.requiredCount !==
      actual.requiredCount
  ) {
    throw new Error(
      [
        "NILE 전공필수 파싱 개수 불일치",
        `curriculum=${params.curriculum.curriculumKey}`,
        `declared=${declared.requiredCount}`,
        `parsed=${actual.requiredCount}`,
      ].join(" / ")
    );
  }

  if (
    declared.electiveCount !==
      null &&
    declared.electiveCount !==
      actual.electiveCount
  ) {
    throw new Error(
      [
        "NILE 전공선택 파싱 개수 불일치",
        `curriculum=${params.curriculum.curriculumKey}`,
        `declared=${declared.electiveCount}`,
        `parsed=${actual.electiveCount}`,
      ].join(" / ")
    );
  }
}