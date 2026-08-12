import type {
  AiPendingActionPreview,
  StudentRegistrationDraft,
  StudentRegistrationDraftSemester,
  StudentRegistrationDraftPlanSubject,
  StudentRegistrationDraftTransferSubject,
  StudentRegistrationDuplicateSubject,
  StudentRegistrationDraftPractice,
} from "./ai.types";

/**
 * 학생 통합등록 초안 생성 입력
 *
 * organizationId, userId, assigneeId는 프론트에서 직접 받지 않는다.
 * consultation 값과 서버 AI Context에서 확정한 값만 전달한다.
 */
export type BuildStudentRegistrationDraftInput = {
  /**
   * 사용자가 AI 채팅창에 입력한 등록 지시문
   */
  message: string;

  /**
   * 서버에서 organizationId 범위로 조회한 상담DB 원본
   */
  consultation: {
    id: number;
    clientName?: string | null;
    phone?: string | null;
    desiredCourse?: string | null;
    finalEducation?: string | null;
    assigneeId?: number | null;
    status?: string | null;
  };

  /**
   * 서버 AI Context에서 확정한 담당자 ID
   *
   * 일반적으로 상담DB assigneeId를 우선 사용하고,
   * 상담DB 담당자가 없을 때만 현재 사용자 ID를 사용한다.
   */
  fallbackAssigneeId: number;

  /**
   * AI가 설계한 앞으로 수강할 우리플랜 과목
   *
   * planSemesters 테이블에 저장할 대상이다.
   */
  planSubjects?: Array<{
    semesterNo?: number | null;
    subjectName: string;
    category?: "전공" | "교양" | "일반" | null;
    requirementType?:
      | "전공필수"
      | "전공선택"
      | "교양"
      | "일반"
      | null;
    credits?: number | null;
    isConfirmed?: boolean | null;
  }>; 

 /**
   * OCR 또는 별도 과목 추출 API에서 정리한 과목 목록
   */
  ocrSubjects?: Array<{
    semesterNo?: number | null;
    schoolName?: string | null;
    subjectName: string;
    category?: "전공" | "교양" | "일반" | null;
    requirementType?:
      | "전공필수"
      | "전공선택"
      | "교양"
      | "일반"
      | null;
    credits?: number | null;
    isConfirmed?: boolean | null;
  }>;

  /**
   * 기준일
   *
   * 테스트 시 고정할 수 있고,
   * 미입력 시 현재 시각을 사용한다.
   */
  now?: Date;
};

/**
 * 초안과 사용자 미리보기를 함께 반환한다.
 */
export type BuildStudentRegistrationDraftOutput = {
  draft: StudentRegistrationDraft;
  preview: AiPendingActionPreview;
};

type ParsedSemesterSeed = {
  semesterNo: number;
semesterLabel:
  string |
  null;
  plannedStartMonth: string | null;
  plannedInstitution: string | null;
  plannedSubjectCount: number | null;
  plannedAmount: number | null;
  actualStartDate: string | null;
  actualInstitution: string | null;
actualSubjectCount:
  number |
  null;
  actualPaymentAmount: number | null;
  paymentDate: string | null;
};

type ParsedNaturalLanguagePlanSubject = {
  semesterNo:
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

  isConfirmed:
    boolean;
};

type NaturalLanguageSubjectOperation =
  | "set"
  | "add"
  | "replace"
  | "remove";

const EDUCATION_KEYWORDS = [
  "고졸",
  "고등학교 졸업",
  "전문대졸",
  "전문학사",
  "2년제 졸업",
  "3년제 졸업",
  "대졸",
  "대학교 졸업",
  "4년제 졸업",
  "학사",
  "대학원졸",
  "석사",
  "박사",
] as const;

const COURSE_PATTERNS: Array<{
  pattern: RegExp;
  value: string;
}> = [
  {
    pattern: /사회복지사\s*2급|사복\s*2급|사회복지\s*2급/i,
    value: "사회복지사 2급",
  },
  {
    pattern: /보육교사\s*2급|보육\s*2급/i,
    value: "보육교사 2급",
  },
  {
    pattern: /평생교육사\s*2급|평생교육\s*2급/i,
    value: "평생교육사 2급",
  },
  {
    pattern: /한국어교원\s*2급|한국어\s*2급/i,
    value: "한국어교원 2급",
  },
  {
    pattern: /청소년지도사\s*2급|청소년지도\s*2급/i,
    value: "청소년지도사 2급",
  },
  {
    pattern: /건강가정사/i,
    value: "건강가정사",
  },
  {
    pattern: /장애영유아/i,
    value: "장애영유아",
  },
];

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function normalizePhone(value: unknown): string {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 11);
}

function normalizePositiveInteger(
  value: unknown
): number | null {
  const numberValue = Number(value);

  if (
    !Number.isFinite(numberValue) ||
    numberValue <= 0
  ) {
    return null;
  }

  return Math.floor(numberValue);
}

function normalizeNonNegativeNumber(
  value: unknown
): number | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numberValue = Number(
    String(value)
      .replace(/,/g, "")
      .replace(/[^\d.-]/g, "")
  );

  if (
    !Number.isFinite(numberValue) ||
    numberValue < 0
  ) {
    return null;
  }

  return numberValue;
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => normalizeText(value))
        .filter(Boolean)
    )
  );
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDate(
  year: number,
  month: number,
  day: number
): string | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const date = new Date(
    year,
    month - 1,
    day
  );

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function formatMonth(
  year: number,
  month: number
): string | null {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  return `${year}-${pad2(month)}`;
}

function resolveYearForMonth(params: {
  month: number;
  explicitYear?: number | null;
  now: Date;
}): number {
  if (
    params.explicitYear &&
    params.explicitYear >= 2000 &&
    params.explicitYear <= 2100
  ) {
    return params.explicitYear;
  }

  const currentYear =
    params.now.getFullYear();

  const currentMonth =
    params.now.getMonth() + 1;

  /**
   * 연도 없이 월만 입력한 경우:
   * 현재 월보다 4개월 이상 과거면 다음 해로 판단한다.
   *
   * 예:
   * 현재 11월, "3월 시작" → 다음 해 3월
   */
  if (
    params.month <
    currentMonth - 4
  ) {
    return currentYear + 1;
  }

  return currentYear;
}

function parseKoreanDate(
  text: string,
  now: Date
): string | null {
  const fullDateMatch =
    text.match(
      /(?:(20\d{2})\s*[년./-]\s*)?(\d{1,2})\s*[월./-]\s*(\d{1,2})\s*일?/
    );

  if (!fullDateMatch) {
    return null;
  }

  const explicitYear =
    fullDateMatch[1]
      ? Number(fullDateMatch[1])
      : null;

  const month =
    Number(fullDateMatch[2]);

  const day =
    Number(fullDateMatch[3]);

  const year =
    resolveYearForMonth({
      month,
      explicitYear,
      now,
    });

  return formatDate(
    year,
    month,
    day
  );
}

function parseKoreanMonth(
  text: string,
  now: Date
): string | null {
  const monthMatch =
    text.match(
      /(?:(20\d{2})\s*[년./-]\s*)?(\d{1,2})\s*월/
    );

  if (!monthMatch) {
    return null;
  }

  const explicitYear =
    monthMatch[1]
      ? Number(monthMatch[1])
      : null;

  const month =
    Number(monthMatch[2]);

  const year =
    resolveYearForMonth({
      month,
      explicitYear,
      now,
    });

  return formatMonth(
    year,
    month
  );
}

function parseMoneyFromText(
  text: string
): number | null {
  const normalized =
    normalizeText(
      text
    );

  /**
   * 예:
   * 52만 5천원
   * 52만5천원
   * 120만 3천 500원
   */
  const koreanUnitMatch =
    normalized.match(
      /(\d+(?:\.\d+)?)\s*만(?:\s*(\d+(?:\.\d+)?)\s*천)?(?:\s*(\d{1,3}))?\s*원?/
    );

  if (
    koreanUnitMatch
  ) {
    const manWon =
      Number(
        koreanUnitMatch[1] ||
        0
      ) *
      10_000;

    const thousandWon =
      Number(
        koreanUnitMatch[2] ||
        0
      ) *
      1_000;

    const remainderWon =
      Number(
        koreanUnitMatch[3] ||
        0
      );

    const total =
      Math.round(
        manWon +
        thousandWon +
        remainderWon
      );

    return Number.isFinite(
      total
    )
      ? total
      : null;
  }

  /**
   * 예:
   * 525,000원
   * 525000원
   */
  const wonMatch =
    normalized.match(
      /([\d,]+)\s*원/
    );

  if (
    wonMatch
  ) {
    return normalizeNonNegativeNumber(
      wonMatch[1]
    );
  }

  /**
   * 예:
   * 예정금액 525000
   * 결제금액: 525,000
   */
  const amountKeywordMatch =
    normalized.match(
      /(?:결제금액|실결제|예정금액|금액)\s*[:：]?\s*([\d,]+)/
    );

  if (
    amountKeywordMatch
  ) {
    return normalizeNonNegativeNumber(
      amountKeywordMatch[1]
    );
  }

  return null;
}

function parseSubjectCountFromText(
  text: string
): number | null {
  const match =
    text.match(
      /(\d{1,2})\s*과목/
    );

  return match
    ? normalizePositiveInteger(
        match[1]
      )
    : null;
}

/**
 * 담당자가 자연스럽게 사용하는
 * 학기별 입력 제목에서 과정상 학기 순서를 추출한다.
 *
 * 허용 예:
 * 1학기:
 * 2학기 -
 * 3학기 2027년 1학기
 * 과정 2학기: 2027년 1학기
 *
 * "2026년 2학기"는 연도별 학기 구분이므로
 * 과정상 2학기차로 해석하지 않는다.
 */
function parseSemesterHeadingNo(
  text:
    string
): number | null {
  const normalized =
    normalizeText(
      text
    );

  if (
    !normalized
  ) {
    return null;
  }

  const headingMatch =
  normalized.match(
    /^(?:과정\s*)?(\d{1,2})\s*학기(?:차)?(?=\s*(?:[:：-]|20\d{2}\s*년|(?:예정\s*)?(?:과목(?:명|목록)?|개강월|개강일|시작월|시작일|교육원|기관|수강처|예정금액|결제금액|실결제금액|결제일|입금일|납부일|과목수|과목\s*수)(?:\s*(?:추가|교체|변경|수정|정정|재설정|제외|삭제|제거|빼기))?\s*[:：]|$))/
  );

  if (
    !headingMatch
  ) {
    return null;
  }

  return normalizePositiveInteger(
    headingMatch[1]
  );
}

/**
 * 과정상 학기 순서를 추출한다.
 *
 * "1학기차", "두 번째 학기", "과정 2학기"처럼
 * 명확하게 순서를 뜻하는 표현만 인정한다.
 *
 * "2026년 2학기"의 2는 실제 학기 구분이므로
 * 과정 순서로 사용하지 않는다.
 */
function parseSemesterNo(
  text:
    string
): number | null {
  const normalized =
    normalizeText(
      text
    );

  const headingSemesterNo =
    parseSemesterHeadingNo(
      normalized
    );

  if (
    headingSemesterNo
  ) {
    return headingSemesterNo;
  }

  const semesterOrderMatch =
    normalized.match(
      /(?:과정\s*)?(\d{1,2})\s*학기차/
    ) ||
    normalized.match(
      /(?:과정\s*순서|학기\s*순서|순서)\s*[:：]?\s*(\d{1,2})/
    ) ||
    normalized.match(
      /(?:첫\s*번째|첫째)\s*학기/
    ) ||
    normalized.match(
      /(?:두\s*번째|둘째)\s*학기/
    ) ||
    normalized.match(
      /(?:세\s*번째|셋째)\s*학기/
    ) ||
    normalized.match(
      /(?:네\s*번째|넷째)\s*학기/
    );

  if (
    !semesterOrderMatch
  ) {
    return null;
  }

  if (
    /첫\s*번째|첫째/.test(
      semesterOrderMatch[0]
    )
  ) {
    return 1;
  }

  if (
    /두\s*번째|둘째/.test(
      semesterOrderMatch[0]
    )
  ) {
    return 2;
  }

  if (
    /세\s*번째|셋째/.test(
      semesterOrderMatch[0]
    )
  ) {
    return 3;
  }

  if (
    /네\s*번째|넷째/.test(
      semesterOrderMatch[0]
    )
  ) {
    return 4;
  }

  return normalizePositiveInteger(
    semesterOrderMatch[1]
  );
}

/**
 * 실제 연도별 학기 구분을 추출한다.
 *
 * 예:
 * 2026년 2학기
 * 2027년 1학기
 */
function parseSemesterLabel(
  text: string
): string | null {
  const match =
    normalizeText(
      text
    ).match(
      /(20\d{2})\s*년\s*([12])\s*학기/
    );

  if (
    !match
  ) {
    return null;
  }

  return `${match[1]}년 ${match[2]}학기`;
}

function extractFinalEducation(
  message: string,
  consultationValue?: string | null
): string | null {
  for (
    const keyword of
    EDUCATION_KEYWORDS
  ) {
    if (
      message.includes(keyword)
    ) {
      if (
        keyword === "고등학교 졸업"
      ) {
        return "고졸";
      }

      if (
        keyword === "전문학사" ||
        keyword === "2년제 졸업" ||
        keyword === "3년제 졸업"
      ) {
        return "전문대졸";
      }

      if (
        keyword === "대학교 졸업" ||
        keyword === "4년제 졸업" ||
        keyword === "학사"
      ) {
        return "대졸";
      }

      if (
        keyword === "석사" ||
        keyword === "박사"
      ) {
        return "대학원졸";
      }

      return keyword;
    }
  }

  const normalizedConsultation =
    normalizeText(
      consultationValue
    );

  return normalizedConsultation || null;
}

function extractCourseName(
  message: string,
  consultationValue?: string | null
): string | null {
  for (
    const item of
    COURSE_PATTERNS
  ) {
    if (
      item.pattern.test(message)
    ) {
      return item.value;
    }
  }

  const normalizedConsultation =
    normalizeText(
      consultationValue
    );

  return normalizedConsultation || null;
}

function extractInstitution(
  text:
    string
): string | null {
  const normalized =
    normalizeText(
      text
    );

  /**
   * 라벨 뒤에 수정 명령이 붙는 형식을 먼저 처리한다.
   *
   * 예:
   * 교육원 변경: 해밀원격평생교육원
   * 기관 수정: 서울사이버에듀
   * 수강처 재설정: 드림원격평생교육원
   */
  const correctionLabeledMatch =
    normalized.match(
      /(?:교육원|기관|수강처|진행처)\s*(?:변경|수정|교체|정정|재설정|다시\s*설정)\s*[:：]\s*([가-힣A-Za-z0-9()·._\-\s]{2,60})/
    );

  if (
    correctionLabeledMatch?.[1]
  ) {
    return normalizeText(
      correctionLabeledMatch[1]
    );
  }

  /**
   * 일반 라벨 형식
   *
   * 예:
   * 교육원: 해밀원격평생교육원
   * 기관: 서울사이버에듀
   */
  const labeledMatch =
    normalized.match(
      /(?:교육원|기관|수강처|진행처)\s*[:：]\s*([가-힣A-Za-z0-9()·._\-\s]{2,60})/
    );

  if (
    labeledMatch?.[1]
  ) {
    return normalizeText(
      labeledMatch[1]
    );
  }

  /**
   * 콜론 없이 입력한 일반 형식
   *
   * 수정 명령어를 교육원명으로 잘못 인식하지 않도록
   * 변경·수정·교체 등의 단어는 제외한다.
   */
  const unlabeledMatch =
    normalized.match(
      /(?:교육원|기관|수강처|진행처)\s+(?!(?:변경|수정|교체|정정|재설정|다시\s*설정)\b)([가-힣A-Za-z0-9()·._-]{2,60})/
    );

  if (
    unlabeledMatch?.[1]
  ) {
    return normalizeText(
      unlabeledMatch[1]
    );
  }

  const commonInstitutionMatch =
    normalized.match(
      /([가-힣A-Za-z0-9()·._-]{2,40}(?:원격평생교육원|사이버평생교육원|평생교육원|사이버에듀|원격|교육원))/
    );

  return commonInstitutionMatch?.[1]
    ? normalizeText(
        commonInstitutionMatch[1]
      )
    : null;
}

function isSemesterCorrectionSegment(
  text:
    string
): boolean {
  return /수정|변경|교체|정정|다시\s*설정|재설정/i.test(
    normalizeText(
      text
    )
  );
}

function splitIntoSegments(
  message: string
): string[] {
  const normalized =
    normalizeText(message);

  if (!normalized) {
    return [];
  }

  return normalized
    .split(
      /\n+|(?<=[.!?])\s+|[,;]+/
    )
    .map((segment) =>
      normalizeText(segment)
    )
    .filter(Boolean);
}

function collectSemesterSeeds(
  message: string,
  now: Date
): ParsedSemesterSeed[] {
  const segments =
    splitIntoSegments(message);

  const seedMap =
    new Map<
      number,
      ParsedSemesterSeed
    >();

  let activeSemesterNo = 1;

let activeSemesterLabel:
  string |
  null =
  null;

  const ensureSeed = (
    semesterNo: number
  ): ParsedSemesterSeed => {
    const existing =
      seedMap.get(semesterNo);

    if (existing) {
      return existing;
    }

    const created:
      ParsedSemesterSeed = {
        semesterNo,
semesterLabel:
  activeSemesterLabel,
        plannedStartMonth: null,
        plannedInstitution: null,
        plannedSubjectCount: null,
        plannedAmount: null,
        actualStartDate: null,
        actualInstitution: null,
actualSubjectCount:
  null,
        actualPaymentAmount: null,
        paymentDate: null,
      };

    seedMap.set(
      semesterNo,
      created
    );

    return created;
  };

  ensureSeed(1);

  for (
    const segment of segments
  ) {
    const segmentSemesterNo =
  parseSemesterNo(
    segment
  );

const segmentSemesterLabel =
  parseSemesterLabel(
    segment
  );

if (
  segmentSemesterNo
) {
  const semesterChanged =
    activeSemesterNo !==
    segmentSemesterNo;

  activeSemesterNo =
    segmentSemesterNo;

  /**
   * 새로운 과정 학기로 이동했는데
   * 현재 문장에 학기 구분이 없다면
   * 이전 학기의 연도·학기 값을 복사하지 않는다.
   */
  if (
    semesterChanged &&
    !segmentSemesterLabel
  ) {
    activeSemesterLabel =
      null;
  }
}

if (
  segmentSemesterLabel
) {
  activeSemesterLabel =
    segmentSemesterLabel;
}

const seed =
  ensureSeed(
    activeSemesterNo
  );

/**
 * 먼저 학기 예정표가 생성된 뒤
 * 같은 문장에서 학기 구분이 확인된 경우에도 반영한다.
 */
if (
  segmentSemesterLabel
) {
  seed.semesterLabel =
    segmentSemesterLabel;
}

    const date =
      parseKoreanDate(
        segment,
        now
      );

    const month =
      parseKoreanMonth(
        segment,
        now
      );

    const amount =
      parseMoneyFromText(
        segment
      );

    const subjectCount =
      parseSubjectCountFromText(
        segment
      );

    const institution =
      extractInstitution(
        segment
      );

const isCorrectionSegment =
  isSemesterCorrectionSegment(
    segment
  );

    const isPaymentDateSegment =
  /결제일|입금일|납부일/i.test(
    segment
  );

const isStartDateSegment =
  /개강일|시작일|실제\s*시작|수업\s*시작/i.test(
    segment
  );

if (
  isPaymentDateSegment &&
  date
) {
  seed.paymentDate =
    date;
}

if (
  isStartDateSegment &&
  date
) {
  seed.actualStartDate =
    date;
}

    if (
      !seed.actualStartDate &&
      date &&
      /개강|시작|수강/i.test(
        segment
      )
    ) {
      seed.actualStartDate =
        date;
    }

    if (
      /예정|예상|계획/i.test(
        segment
      )
    ) {
      if (month) {
        seed.plannedStartMonth =
          month;
      }

      if (
        amount !== null
      ) {
        seed.plannedAmount =
          amount;
      }

      if (
        subjectCount !== null
      ) {
        seed.plannedSubjectCount =
          subjectCount;
      }

      if (institution) {
        seed.plannedInstitution =
          institution;
      }
    } else {
      if (
  month &&
  !isPaymentDateSegment &&
  !isStartDateSegment &&
  (
    !seed.plannedStartMonth ||
    isCorrectionSegment
  )
) {
  seed.plannedStartMonth =
    month;
}

      if (
  amount !==
    null
) {
  if (
    /결제|입금|납부|실결제/i.test(
      segment
    )
  ) {
    seed.actualPaymentAmount =
      amount;
  } else if (
    seed.plannedAmount ===
      null ||
    isCorrectionSegment
  ) {
    seed.plannedAmount =
      amount;
  }
}

      if (
  subjectCount !==
    null
) {
  if (
    /실제|확정|등록|수강|이수/i.test(
      segment
    )
  ) {
    seed.actualSubjectCount =
      subjectCount;
  } else {
    seed.plannedSubjectCount =
      subjectCount;
  }
}

      if (
  institution
) {
  if (
    /실제|확정|등록|수강/i.test(
      segment
    )
  ) {
    seed.actualInstitution =
      institution;
  } else if (
    !seed.plannedInstitution ||
    isCorrectionSegment
  ) {
    seed.plannedInstitution =
      institution;
  }
}
    }
  }

  const result =
    Array.from(
      seedMap.values()
    )
      .filter((seed) => {
        if (
          seed.semesterNo !== 1
        ) {
          return true;
        }

        return (
  seed.semesterLabel !==
    null ||
  seed.plannedStartMonth !==
    null ||
  seed.plannedInstitution !==
    null ||
  seed.plannedSubjectCount !==
    null ||
  seed.plannedAmount !==
    null ||
  seed.actualStartDate !==
    null ||
  seed.actualInstitution !==
    null ||
  seed.actualSubjectCount !==
    null ||
  seed.actualPaymentAmount !==
    null ||
  seed.paymentDate !==
    null
);
      })
      .sort(
        (a, b) =>
          a.semesterNo -
          b.semesterNo
      );

  return result.length > 0
    ? result
    : [
        {
  semesterNo:
    1,

  semesterLabel:
    null,

  plannedStartMonth:
    null,

  plannedInstitution:
    null,

  plannedSubjectCount:
    null,

  plannedAmount:
    null,

  actualStartDate:
    null,

  actualInstitution:
    null,

actualSubjectCount:
  null,

  actualPaymentAmount:
    null,

  paymentDate:
    null,
},
      ];
}

function normalizeSubjectCategory(
  value: unknown,
  requirementType: unknown
):
  | "전공"
  | "교양"
  | "일반" {
  if (
    value === "교양" ||
    requirementType === "교양"
  ) {
    return "교양";
  }

  if (
    value === "일반" ||
    requirementType === "일반"
  ) {
    return "일반";
  }

  return "전공";
}

function normalizeRequirementType(
  value: unknown,
  category: "전공" | "교양" | "일반"
):
  | "전공필수"
  | "전공선택"
  | "교양"
  | "일반" {
  if (
    value === "전공필수" ||
    value === "전공선택" ||
    value === "교양" ||
    value === "일반"
  ) {
    return value;
  }

  if (
    category === "교양"
  ) {
    return "교양";
  }

  if (
    category === "일반"
  ) {
    return "일반";
  }

  return "전공선택";
}

function cleanNaturalLanguageSubjectName(
  value:
    unknown
): string | null {
  const normalized =
    normalizeText(
      value
    )
      .replace(
        /^[\d]+[.)]\s*/,
        ""
      )
      .replace(
        /^(?:과목|과목명)\s*[:：]\s*/,
        ""
      )
      .replace(
        /\s*(?:과목)?\s*$/,
        ""
      )
      .trim();

  if (
    normalized.length <
      2 ||
    normalized.length >
      100
  ) {
    return null;
  }

  /**
   * 학기 예정정보가 과목명으로 잘못 들어가는 것을 막는다.
   */
  if (
    /^(?:예정금액|결제금액|결제일|개강월|개강일|교육원|기관|수강처|학기구분|학기\s*구분|과목수|과목\s*수|실습시간|실습\s*시간)$/i.test(
      normalized
    )
  ) {
    return null;
  }

  /**
   * 금액, 날짜, 과목 수만 있는 값은
   * 과목명으로 인정하지 않는다.
   */
  if (
    /^\d[\d,]*(?:원|만원|천원|과목|월|일|시간)?$/.test(
      normalized
    )
  ) {
    return null;
  }

  return normalized;
}

function resolveNaturalLanguageSubjectClassification(
  value:
    string
): {
  category:
    "전공" |
    "교양" |
    "일반";

  requirementType:
    "전공필수" |
    "전공선택" |
    "교양" |
    "일반";

  subjectName:
    string;
} {
  const normalized =
    normalizeText(
      value
    );

  if (
    /^(?:전공필수|전필)\s*[:：-]?\s*/.test(
      normalized
    )
  ) {
    return {
      category:
        "전공",

      requirementType:
        "전공필수",

      subjectName:
        normalized.replace(
          /^(?:전공필수|전필)\s*[:：-]?\s*/,
          ""
        ),
    };
  }

  if (
    /^(?:전공선택|전선)\s*[:：-]?\s*/.test(
      normalized
    )
  ) {
    return {
      category:
        "전공",

      requirementType:
        "전공선택",

      subjectName:
        normalized.replace(
          /^(?:전공선택|전선)\s*[:：-]?\s*/,
          ""
        ),
    };
  }

  if (
    /^교양\s*[:：-]?\s*/.test(
      normalized
    )
  ) {
    return {
      category:
        "교양",

      requirementType:
        "교양",

      subjectName:
        normalized.replace(
          /^교양\s*[:：-]?\s*/,
          ""
        ),
    };
  }

  if (
    /^일반\s*[:：-]?\s*/.test(
      normalized
    )
  ) {
    return {
      category:
        "일반",

      requirementType:
        "일반",

      subjectName:
        normalized.replace(
          /^일반\s*[:：-]?\s*/,
          ""
        ),
    };
  }

  return {
    category:
      "전공",

    requirementType:
      "전공선택",

    subjectName:
      normalized,
  };
}

function splitNaturalLanguageSubjectList(
  value:
    string
): string[] {
  return normalizeText(
    value
  )
    .split(
      /[,，、·ㆍ|/]+|\s*;\s*/
    )
    .map(
      (
        item
      ) =>
        normalizeText(
          item
        )
    )
    .filter(
      Boolean
    );
}

function parseNaturalLanguageSubjectOperation(
  line:
    string
): {
  operation:
    NaturalLanguageSubjectOperation;

  subjectText:
    string;
} | null {
  const normalized =
    normalizeText(
      line
    );

  if (
    !normalized
  ) {
    return null;
  }

  /**
   * 교체 명령
   *
   * 예:
   * 과목 교체: 사회복지학개론, 인간행동과사회환경
   * 과목 변경: 사회복지정책론
   * 우리플랜 과목 수정: 사회복지행정론
   */
  const replaceMatch =
    normalized.match(
      /(?:우리\s*플랜\s*)?과목(?:명|목록)?\s*(?:전체\s*)?(?:교체|변경|수정|재설정)\s*[:：]\s*(.+)$/i
    );

  if (
    replaceMatch?.[1]
  ) {
    return {
      operation:
        "replace",

      subjectText:
        replaceMatch[1],
    };
  }

  /**
   * 제외 명령
   *
   * 예:
   * 과목 제외: 사회복지학개론
   * 과목 삭제: 인간행동과사회환경
   * 우리플랜 과목 빼기: 사회복지정책론
   */
  const removeMatch =
    normalized.match(
      /(?:우리\s*플랜\s*)?과목(?:명|목록)?\s*(?:제외|삭제|제거|빼기)\s*[:：]\s*(.+)$/i
    );

  if (
    removeMatch?.[1]
  ) {
    return {
      operation:
        "remove",

      subjectText:
        removeMatch[1],
    };
  }

  /**
   * 추가 명령
   *
   * 예:
   * 과목 추가: 사회복지법제와실천
   * 우리플랜 과목 추가: 사회복지조사론
   */
  const addMatch =
    normalized.match(
      /(?:우리\s*플랜\s*)?과목(?:명|목록)?\s*추가\s*[:：]\s*(.+)$/i
    );

  if (
    addMatch?.[1]
  ) {
    return {
      operation:
        "add",

      subjectText:
        addMatch[1],
    };
  }

  /**
 * 기본 과목 입력
 *
 * 해당 학기의 서버 기본 과목을
 * 사용자가 입력한 목록으로 확정한다.
 *
 * 예:
 * 과목: 사회복지학개론
 * 과목목록: 사회복지학개론, 인간행동과사회환경
 */
  const defaultMatch =
    normalized.match(
      /(?:우리\s*플랜\s*)?과목(?:명|목록)?\s*[:：]\s*(.+)$/i
    );

  if (
  defaultMatch?.[1]
) {
  return {
    operation:
      "set",

    subjectText:
      defaultMatch[1],
  };
}

  return null;
}

function getNaturalLanguageSubjectKey(
  subject: {
    semesterNo:
      number;

    subjectName:
      string;
  }
): string {
  return [
    Number(
      subject.semesterNo ||
      1
    ),

    normalizeRegistrationSubjectName(
      subject.subjectName
    ),
  ].join(
    ":"
  );
}

function buildBaseNaturalLanguageSubjectMap(
  rows:
    BuildStudentRegistrationDraftInput["planSubjects"]
): Map<
  string,
  ParsedNaturalLanguagePlanSubject
> {
  const subjectMap =
    new Map<
      string,
      ParsedNaturalLanguagePlanSubject
    >();

  for (
    const row of
    rows ||
    []
  ) {
    const subjectName =
      cleanNaturalLanguageSubjectName(
        row.subjectName
      );

    if (
      !subjectName
    ) {
      continue;
    }

    const category =
      normalizeSubjectCategory(
        row.category,
        row.requirementType
      );

    const subject:
      ParsedNaturalLanguagePlanSubject = {
      semesterNo:
        normalizePositiveInteger(
          row.semesterNo
        ) ||
        1,

      subjectName,

      category,

      requirementType:
        normalizeRequirementType(
          row.requirementType,
          category
        ),

      credits:
        normalizePositiveInteger(
          row.credits
        ) ||
        3,

      isConfirmed:
        row.isConfirmed !==
        false,
    };

    subjectMap.set(
      getNaturalLanguageSubjectKey(
        subject
      ),
      subject
    );
  }

  return subjectMap;
}

function extractNaturalLanguagePlanSubjects(
  params: {
    message:
      string;

    baseSubjects:
      BuildStudentRegistrationDraftInput["planSubjects"];
  }
): ParsedNaturalLanguagePlanSubject[] {
  const normalizedMessage =
  String(
    params.message ||
    ""
  )
      .replace(
        /\r\n/g,
        "\n"
      )
      .replace(
        /\r/g,
        "\n"
      );

  const lines =
    normalizedMessage
      .split(
        /\n+/
      )
      .map(
        (
          line
        ) =>
          normalizeText(
            line
          )
      )
      .filter(
        Boolean
      );

  /**
   * 누적 대화의 입력 순서대로 과목 변경을 반영한다.
   *
   * Map을 사용하는 이유:
   * 같은 학기·같은 과목이 반복 입력되어도
   * 한 번만 유지하기 위함이다.
   */
  const subjectMap =
  buildBaseNaturalLanguageSubjectMap(
    params.baseSubjects
  );

  let activeSemesterNo =
    1;

  for (
    const line of
    lines
  ) {
    const lineSemesterNo =
      parseSemesterNo(
        line
      );

    if (
      lineSemesterNo
    ) {
      activeSemesterNo =
        lineSemesterNo;
    }

    const parsedOperation =
      parseNaturalLanguageSubjectOperation(
        line
      );

    if (
      !parsedOperation
    ) {
      continue;
    }

    const subjectValues =
      splitNaturalLanguageSubjectList(
        parsedOperation
          .subjectText
      );

    const parsedSubjects =
      subjectValues
        .map(
          (
            subjectValue
          ): ParsedNaturalLanguagePlanSubject | null => {
            const classification =
              resolveNaturalLanguageSubjectClassification(
                subjectValue
              );

            const subjectName =
              cleanNaturalLanguageSubjectName(
                classification
                  .subjectName
              );

            if (
              !subjectName
            ) {
              return null;
            }

            return {
              semesterNo:
                activeSemesterNo,

              subjectName,

              category:
                classification
                  .category,

              requirementType:
                classification
                  .requirementType,

              credits:
                3,

              isConfirmed:
                true,
            };
          }
        )
        .filter(
          (
            subject
          ): subject is ParsedNaturalLanguagePlanSubject =>
            subject !==
            null
        );

if (
  parsedOperation.operation ===
  "set"
) {
  /**
   * "1학기 과목:"처럼 명시된 기본 목록은
   * 해당 학기의 서버 기본 과목을 제거한 뒤
   * 사용자가 입력한 목록으로 확정한다.
   */
  for (
    const [
      key,
      subject,
    ] of subjectMap.entries()
  ) {
    if (
      subject.semesterNo ===
      activeSemesterNo
    ) {
      subjectMap.delete(
        key
      );
    }
  }

  for (
    const subject of
    parsedSubjects
  ) {
    subjectMap.set(
      getNaturalLanguageSubjectKey(
        subject
      ),
      subject
    );
  }

  continue;
}

    if (
      parsedOperation.operation ===
      "replace"
    ) {
      /**
       * 현재 활성 학기의 기존 자연어 과목만 모두 제거하고
       * 새 목록으로 다시 구성한다.
       */
      for (
        const [
          key,
          subject,
        ] of subjectMap.entries()
      ) {
        if (
          subject.semesterNo ===
          activeSemesterNo
        ) {
          subjectMap.delete(
            key
          );
        }
      }

      for (
        const subject of
        parsedSubjects
      ) {
        subjectMap.set(
          getNaturalLanguageSubjectKey(
            subject
          ),
          subject
        );
      }

      continue;
    }

    if (
      parsedOperation.operation ===
      "remove"
    ) {
      for (
        const subject of
        parsedSubjects
      ) {
        subjectMap.delete(
          getNaturalLanguageSubjectKey(
            subject
          )
        );
      }

      continue;
    }

    /**
     * add
     */
    for (
      const subject of
      parsedSubjects
    ) {
      subjectMap.set(
        getNaturalLanguageSubjectKey(
          subject
        ),
        subject
      );
    }
  }

  return Array.from(
    subjectMap.values()
  )
    .sort(
      (
        left,
        right
      ) =>
        left.semesterNo -
          right.semesterNo
    );
}

function buildPlanSubjects(
  input:
    BuildStudentRegistrationDraftInput
): StudentRegistrationDraftPlanSubject[] {
  /**
   * 서버 카탈로그 과목을 기본값으로 만든 뒤
   * 누적된 자연어 명령을 입력 순서대로 적용한다.
   */
  const rows =
    extractNaturalLanguagePlanSubjects({
      message:
        input.message,

      baseSubjects:
        input.planSubjects,
    });

  return rows
    .map(
      (
        row
      ): StudentRegistrationDraftPlanSubject | null => {
        const subjectName =
          normalizeText(
            row.subjectName
          );

        if (
          subjectName.length <
            2
        ) {
          return null;
        }

        const category =
          normalizeSubjectCategory(
            row.category,
            row.requirementType
          );

        return {
          semesterNo:
            normalizePositiveInteger(
              row.semesterNo
            ) ||
            1,

          subjectName,

          category,

          requirementType:
            normalizeRequirementType(
              row.requirementType,
              category
            ),

          credits:
            normalizePositiveInteger(
              row.credits
            ) ||
            3,

          source:
            "server",

          isConfirmed:
            row.isConfirmed !==
            false,
        };
      }
    )
    .filter(
      (
        row
      ): row is StudentRegistrationDraftPlanSubject =>
        row !==
        null
    );
}

function buildTransferSubjects(
  input: BuildStudentRegistrationDraftInput
): StudentRegistrationDraftTransferSubject[] {
  const rows =
    input.ocrSubjects || [];

  return rows
    .map(
      (
        row
      ): StudentRegistrationDraftTransferSubject | null => {
        const subjectName =
          normalizeText(
            row.subjectName
          );

        if (
          subjectName.length < 2
        ) {
          return null;
        }

        const category =
          normalizeSubjectCategory(
            row.category,
            row.requirementType
          );

        return {
          semesterNo:
            normalizePositiveInteger(
              row.semesterNo
            ),

          schoolName:
            normalizeText(
              row.schoolName
            ) || null,

          subjectName,

          category,

          requirementType:
            normalizeRequirementType(
              row.requirementType,
              category
            ),

          credits:
            normalizePositiveInteger(
              row.credits
            ) || 3,

          source:
            "ocr",

          isConfirmed:
            row.isConfirmed !== false,
        };
      }
    )
    .filter(
      (
        row
      ): row is StudentRegistrationDraftTransferSubject =>
        row !== null
    );
}

function normalizeRegistrationSubjectName(
  value: unknown
): string {
  return String(
    value ?? ""
  )
    .trim()
    .replace(/\s+/g, "")
    .replace(/[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/g, "")
    .replace(/[()（）[\]·ㆍ.,_-]/g, "")
    .toLowerCase();
}

function findDuplicateRegistrationSubjects(params: {
  planSubjects:
    StudentRegistrationDraftPlanSubject[];

  transferSubjects:
    StudentRegistrationDraftTransferSubject[];
}): StudentRegistrationDuplicateSubject[] {
  const subjectMap =
    new Map<
      string,
      {
        subjectName: string;
        sources: Set<"plan" | "transfer">;
        count: number;
      }
    >();

  const addSubject = (
    subjectName: string,
    source: "plan" | "transfer"
  ) => {
    const normalizedName =
      normalizeRegistrationSubjectName(
        subjectName
      );

    if (!normalizedName) {
      return;
    }

    const existing =
      subjectMap.get(
        normalizedName
      );

    if (existing) {
      existing.count += 1;
      existing.sources.add(
        source
      );
      return;
    }

    subjectMap.set(
      normalizedName,
      {
        subjectName,
        sources:
          new Set<
            "plan" | "transfer"
          >([
            source,
          ]),
        count: 1,
      }
    );
  };

  for (
    const subject of
    params.planSubjects
  ) {
    addSubject(
      subject.subjectName,
      "plan"
    );
  }

  for (
    const subject of
    params.transferSubjects
  ) {
    addSubject(
      subject.subjectName,
      "transfer"
    );
  }

  return Array.from(
    subjectMap.entries()
  )
    .filter(
      (
        [, value]
      ) =>
        value.count > 1
    )
    .map(
      (
        [
          normalizedName,
          value,
        ]
      ) => ({
        normalizedName,

        subjectName:
          value.subjectName,

        sources:
          Array.from(
            value.sources
          ),

        count:
          value.count,
      })
    );
}

function extractExplicitPracticeRequirement(
  message:
    string
): boolean | null {
  const normalized =
    String(
      message ||
      ""
    )
      .replace(
        /\r\n/g,
        "\n"
      )
      .replace(
        /\r/g,
        "\n"
      );

  const matches:
  Array<{
    index:
      number;

    required:
      boolean;

    priority:
      number;
  }> = [];

  const notRequiredPattern =
  /실습\s*(?:없음|불필요|안\s*함|안함|제외|미진행|필요\s*없음|필요\s*없다|필요\s*없습니다)|실습을?\s*하지\s*않(?:음|습니다|기로|아요|겠습니다)|실습\s*진행하지\s*않(?:음|습니다|기로|아요|겠습니다)/gi;

  for (
    const match of
    normalized.matchAll(
      notRequiredPattern
    )
  ) {
    matches.push({
  index:
    Number(
      match.index ||
      0
    ),

  required:
    false,

  priority:
    2,
});
  }

  const requiredPattern =
  /실습\s*(?:필요(?!\s*(?:없음|없다|없습니다|하지\s*않))|있음|진행(?!하지\s*않)|포함|해야\s*함|해야함)|실습도\s*(?:진행(?!하지\s*않)|포함|필요)|현장실습(?:\s*(?:필요(?!\s*(?:없음|없다|없습니다))|진행(?!하지\s*않)|포함))?/gi;

  for (
    const match of
    normalized.matchAll(
      requiredPattern
    )
  ) {
    matches.push({
  index:
    Number(
      match.index ||
      0
    ),

  required:
    true,

  priority:
    1,
});
  }

  if (
    matches.length ===
    0
  ) {
    return null;
  }

  matches.sort(
  (
    left,
    right
  ) => {
    if (
      left.index !==
      right.index
    ) {
      return (
        left.index -
        right.index
      );
    }

    return (
      left.priority -
      right.priority
    );
  }
);

  return matches[
    matches.length -
      1
  ].required;
}

function extractPracticeHours(
  message:
    string
): number | null {
  const normalized =
    String(
      message ||
      ""
    )
      .replace(
        /\r\n/g,
        "\n"
      )
      .replace(
        /\r/g,
        "\n"
      );

  const matches:
    Array<{
      index:
        number;

      hours:
        number;
    }> = [];

  const practiceHoursPattern =
    /실습\s*(?:시간\s*)?[:：]?\s*(\d{2,3})\s*시간|(\d{2,3})\s*시간\s*(?:의\s*)?실습/gi;

  for (
    const match of
    normalized.matchAll(
      practiceHoursPattern
    )
  ) {
    const hours =
      normalizePositiveInteger(
        match[1] ||
        match[2]
      );

    if (
      hours ===
      null
    ) {
      continue;
    }

    matches.push({
      index:
        Number(
          match.index ||
          0
        ),

      hours,
    });
  }

  if (
    matches.length ===
    0
  ) {
    return null;
  }

  matches.sort(
    (
      left,
      right
    ) =>
      left.index -
      right.index
  );

  return matches[
    matches.length -
      1
  ].hours;
}

function extractPracticeSemesterNo(
  message:
    string
): number | null {
  const normalized =
    String(
      message ||
      ""
    )
      .replace(
        /\r\n/g,
        "\n"
      )
      .replace(
        /\r/g,
        "\n"
      );

  const matches:
    Array<{
      index:
        number;

      semesterNo:
        number;
    }> = [];

  const semesterBeforePracticePattern =
    /(\d{1,2})\s*학기(?:차)?[^\n.]*실습/gi;

  for (
    const match of
    normalized.matchAll(
      semesterBeforePracticePattern
    )
  ) {
    const semesterNo =
      normalizePositiveInteger(
        match[1]
      );

    if (
      semesterNo ===
      null
    ) {
      continue;
    }

    matches.push({
      index:
        Number(
          match.index ||
          0
        ),

      semesterNo,
    });
  }

  const practiceBeforeSemesterPattern =
    /실습[^\n.]*(\d{1,2})\s*학기(?:차)?/gi;

  for (
    const match of
    normalized.matchAll(
      practiceBeforeSemesterPattern
    )
  ) {
    const semesterNo =
      normalizePositiveInteger(
        match[1]
      );

    if (
      semesterNo ===
      null
    ) {
      continue;
    }

    matches.push({
      index:
        Number(
          match.index ||
          0
        ),

      semesterNo,
    });
  }

  if (
    matches.length ===
    0
  ) {
    return null;
  }

  matches.sort(
    (
      left,
      right
    ) =>
      left.index -
      right.index
  );

  return matches[
    matches.length -
      1
  ].semesterNo;
}

function buildPracticeDraft(params: {
  message: string;
  courseName: string | null;
  semesters:
    StudentRegistrationDraftSemester[];
  now: Date;
}): StudentRegistrationDraftPractice | null {
  const required =
    extractExplicitPracticeRequirement(
      params.message
    );

  /**
   * 사용자가 실습 여부를 명확히 말하지 않았다면
   * 자격 과정만 보고 임의 확정하지 않는다.
   */
  if (
    required === null
  ) {
    return null;
  }

  if (
    required === false
  ) {
    return {
      required:
        false,

      courseName:
        null,

      semesterNo:
        null,

      plannedMonth:
        null,

      requiredHours:
        null,
    };
  }

  const semesterNo =
    extractPracticeSemesterNo(
      params.message
    ) ||
    params.semesters.at(-1)
      ?.semesterNo ||
    1;

  const semester =
    params.semesters.find(
      (row) =>
        row.semesterNo ===
        semesterNo
    );

  const plannedMonth =
    semester
      ?.plannedStartMonth ||
    parseKoreanMonth(
      params.message,
      params.now
    );

  const courseName =
    params.courseName ===
      "사회복지사 2급"
      ? "사회복지현장실습"
      : params.courseName ===
          "보육교사 2급"
        ? "보육실습"
        : params.courseName ===
            "평생교육사 2급"
          ? "평생교육실습"
          : params.courseName ===
              "한국어교원 2급"
            ? "한국어교육실습"
            : "현장실습";

  return {
    required:
      true,

    courseName,

    semesterNo,

    plannedMonth,

    requiredHours:
      extractPracticeHours(
        params.message
      ),
  };
}

function buildPlanSummary(params: {
  courseName: string | null;
  finalEducation: string | null;
  totalTheorySubjects: number | null;
  hasPractice: boolean | null;
  semesterCount: number;
}): string | null {
  const parts: string[] = [];

  if (
    params.finalEducation
  ) {
    parts.push(
      `${params.finalEducation} 기준`
    );
  }

  if (
    params.totalTheorySubjects !==
    null
  ) {
    parts.push(
      `이론 ${params.totalTheorySubjects}과목`
    );
  }

  if (
    params.hasPractice === true
  ) {
    parts.push(
      "실습 포함"
    );
  } else if (
    params.hasPractice === false
  ) {
    parts.push(
      "실습 제외"
    );
  }

  if (
    params.semesterCount > 0
  ) {
    parts.push(
      `${params.semesterCount}개 학기 진행`
    );
  }

  if (
    params.courseName
  ) {
    parts.unshift(
      params.courseName
    );
  }

  return parts.length > 0
    ? parts.join(" · ")
    : null;
}

function buildMissingFields(params: {
  clientName:
    string;

  phone:
    string;

  assigneeId:
    number;

  courseName:
    string |
    null;

  finalEducation:
    string |
    null;

  semesters:
  StudentRegistrationDraftSemester[];

planSubjects:
  StudentRegistrationDraftPlanSubject[];

practice:
  StudentRegistrationDraftPractice |
  null;
}): string[] {
  const missing: string[] = [];

  if (
    !params.clientName
  ) {
    missing.push(
      "회원명"
    );
  }

  if (
    params.phone.length < 10
  ) {
    missing.push(
      "연락처"
    );
  }

  if (
    params.assigneeId <= 0
  ) {
    missing.push(
      "담당자"
    );
  }

  if (
    !params.courseName
  ) {
    missing.push(
      "희망 과정"
    );
  }

  if (
    !params.finalEducation
  ) {
    missing.push(
      "최종학력"
    );
  }

if (
  params.practice ===
  null
) {
  missing.push(
    "실습 필요 여부"
  );
}

if (
  params.practice?.required ===
    true &&
  (
    params.practice.requiredHours ===
      null ||
    params.practice.requiredHours ===
      undefined ||
    Number(
      params.practice.requiredHours
    ) <= 0
  )
) {
  missing.push(
    "실습 시간"
  );
}

if (
  params.practice?.required ===
    true &&
  (
    params.practice.semesterNo ===
      null ||
    params.practice.semesterNo ===
      undefined ||
    Number(
      params.practice.semesterNo
    ) <= 0
  )
) {
  missing.push(
    "실습 예정 학기"
  );
}

if (
  params.practice?.required ===
    true &&
  params.practice.semesterNo !==
    null &&
  params.practice.semesterNo !==
    undefined &&
  !params.semesters.some(
    (
      semester
    ) =>
      Number(
        semester.semesterNo
      ) ===
      Number(
        params.practice
          ?.semesterNo
      )
  )
) {
  missing.push(
    "실습 예정 학기 정보"
  );
}

  if (
  params.planSubjects.length ===
  0
) {
  missing.push(
    "우리플랜 과목"
  );
}

if (
  params.semesters.length ===
  0
) {
  missing.push(
    "학기 정보"
  );
}

for (
  const semester of
  params.semesters
) {
  const semesterNo =
    Number(
      semester.semesterNo ||
      0
    );

  const semesterPrefix =
    semesterNo > 0
      ? `${semesterNo}학기차`
      : "학기";

  if (
    !String(
      semester.semesterLabel ||
      ""
    ).trim()
  ) {
    missing.push(
      `${semesterPrefix} 학기 구분`
    );
  }

  if (
    !String(
      semester.plannedStartMonth ||
      ""
    ).trim()
  ) {
    missing.push(
      `${semesterPrefix} 예정 개강월`
    );
  }

  if (
    !String(
      semester.plannedInstitution ||
      ""
    ).trim()
  ) {
    missing.push(
      `${semesterPrefix} 예정 교육원`
    );
  }

  if (
    semester.plannedSubjectCount ===
      null ||
    semester.plannedSubjectCount ===
      undefined ||
    Number(
      semester.plannedSubjectCount
    ) <= 0
  ) {
    missing.push(
      `${semesterPrefix} 예정 과목 수`
    );
  }

  if (
    semester.plannedAmount ===
      null ||
    semester.plannedAmount ===
      undefined ||
    Number(
      semester.plannedAmount
    ) < 0
  ) {
    missing.push(
      `${semesterPrefix} 예정금액`
    );
  }

  const semesterSubjectCount =
    params.planSubjects.filter(
      (
        subject
      ) =>
        Number(
          subject.semesterNo
        ) ===
        semesterNo
    ).length;

  if (
    semesterNo > 0 &&
    semesterSubjectCount ===
      0
  ) {
    missing.push(
      `${semesterPrefix} 우리플랜 과목`
    );
  }

  const hasActualPayment =
    semester.actualPaymentAmount !==
      null &&
    semester.actualPaymentAmount !==
      undefined;

  if (
    hasActualPayment &&
    !String(
      semester.paymentDate ||
      ""
    ).trim()
  ) {
    missing.push(
      `${semesterPrefix} 결제일`
    );
  }
}

return uniqueStrings(
  missing
);
}

function buildWarnings(params: {
  consultationStatus: string | null;

  semesters:
    StudentRegistrationDraftSemester[];

  planSubjects:
    StudentRegistrationDraftPlanSubject[];

  transferSubjects:
    StudentRegistrationDraftTransferSubject[];

  duplicateSubjects:
    StudentRegistrationDuplicateSubject[];

  practice:
    StudentRegistrationDraftPractice | null;
}): string[] {
  const warnings: string[] = [];

const semesterNos =
  Array.from(
    new Set(
      params.semesters
        .map(
          (
            semester
          ) =>
            Number(
              semester.semesterNo ||
              0
            )
        )
        .filter(
          (
            semesterNo
          ) =>
            Number.isFinite(
              semesterNo
            ) &&
            semesterNo >
              0
        )
    )
  )
    .sort(
      (
        left,
        right
      ) =>
        left -
        right
    );

if (
  semesterNos.length >
    1
) {
  const maximumSemesterNo =
    semesterNos[
      semesterNos.length -
        1
    ];

  const missingSemesterNos:
    number[] = [];

  for (
    let semesterNo =
      1;
    semesterNo <=
      maximumSemesterNo;
    semesterNo +=
      1
  ) {
    if (
      !semesterNos.includes(
        semesterNo
      )
    ) {
      missingSemesterNos.push(
        semesterNo
      );
    }
  }

  if (
    missingSemesterNos.length >
      0
  ) {
    warnings.push(
      `과정 학기 순서 중 ${missingSemesterNos
        .map(
          (
            semesterNo
          ) =>
            `${semesterNo}학기차`
        )
        .join(
          ", "
        )} 정보가 빠져 있습니다. 학기 순서를 확인해주세요.`
    );
  }
}

  if (
    params.consultationStatus &&
    ![
      "상담중",
      "등록예정",
      "등록",
    ].includes(
      params.consultationStatus
    )
  ) {
    warnings.push(
      `현재 상담 상태가 '${params.consultationStatus}'입니다. 학생 전환 대상이 맞는지 확인해주세요.`
    );
  }

    const duplicateCheckSemesterNos =
    params.semesters.map(
      (
        semester
      ) =>
        semester.semesterNo
    );

  if (
    new Set(
      duplicateCheckSemesterNos
    ).size !==
    duplicateCheckSemesterNos.length
  ) {
    warnings.push(
      "동일한 학기 번호가 중복되어 있습니다."
    );
  }

  for (
    const semester of
    params.semesters
  ) {
    const semesterSubjects =
      params.planSubjects.filter(
        (subject) =>
          subject.semesterNo ===
          semester.semesterNo
      );

    if (
      semester.plannedSubjectCount !==
        null &&
      semesterSubjects.length > 0 &&
      semester.plannedSubjectCount !==
        semesterSubjects.length
    ) {
      warnings.push(
        `${semester.semesterNo}학기 예정 과목 수는 ${semester.plannedSubjectCount}개인데 설계된 과목은 ${semesterSubjects.length}개입니다.`
      );
    }

    if (
      semester.actualPaymentAmount !==
        null &&
      semester.paymentDate ===
        null
    ) {
      warnings.push(
        `${semester.semesterNo}학기 실결제금액이 있으나 결제일이 없습니다.`
      );
    }
  }

  const unconfirmedPlanSubjects =
    params.planSubjects.filter(
      (subject) =>
        !subject.isConfirmed
    );

  if (
    unconfirmedPlanSubjects.length > 0
  ) {
    warnings.push(
      `우리플랜 중 ${unconfirmedPlanSubjects.length}개 과목은 확인이 필요합니다.`
    );
  }

  const unconfirmedTransferSubjects =
    params.transferSubjects.filter(
      (subject) =>
        !subject.isConfirmed
    );

  if (
    unconfirmedTransferSubjects.length > 0
  ) {
    warnings.push(
      `전적대 OCR 결과 중 ${unconfirmedTransferSubjects.length}개 과목은 인식 정확도 확인이 필요합니다.`
    );
  }

  if (
    params.duplicateSubjects.length > 0
  ) {
    warnings.push(
      `우리플랜과 전적대 과목에서 중복 과목 ${params.duplicateSubjects.length}건이 확인되었습니다.`
    );
  }

  return uniqueStrings(
    warnings
  );
}

function semesterToPreviewItems(
  semester:
    StudentRegistrationDraftSemester
): string[] {
  return [
    `과정 순서: ${semester.semesterNo}학기차`,
    `학기 구분: ${semester.semesterLabel || "미입력"}`,
    `예정 시작 월: ${semester.plannedStartMonth || "미입력"}`,
    `예정 교육원: ${semester.plannedInstitution || "미입력"}`,
    `예정 과목 수: ${
      semester.plannedSubjectCount !== null
        ? `${semester.plannedSubjectCount}과목`
        : "미입력"
    }`,
    `예정 금액: ${
      semester.plannedAmount !== null
        ? `${semester.plannedAmount.toLocaleString()}원`
        : "미입력"
    }`,
    `실제 개강일: ${semester.actualStartDate || "미입력"}`,
    `실제 교육원: ${semester.actualInstitution || "미입력"}`,
`실제 과목 수: ${
  semester.actualSubjectCount !== null &&
  semester.actualSubjectCount !== undefined
    ? `${semester.actualSubjectCount}과목`
    : "미입력"
}`,
`실제 결제금액: ${
  semester.actualPaymentAmount !== null
    ? `${semester.actualPaymentAmount.toLocaleString()}원`
    : "미입력"
}`,
    `결제일: ${semester.paymentDate || "미입력"}`,
  ];
}

function buildPreview(
  draft: StudentRegistrationDraft
): AiPendingActionPreview {
  const studentItems = [
    `회원명: ${draft.student.clientName || "미입력"}`,
    `연락처: ${draft.student.phone || "미입력"}`,
    `담당자 ID: ${
      draft.student.assigneeId > 0
        ? draft.student.assigneeId
        : "미입력"
    }`,
    `희망 과정: ${draft.student.desiredCourse || "미입력"}`,
    `최종학력: ${draft.student.finalEducation || "미입력"}`,
    `등록 상태: ${draft.student.status || "등록예정"}`,
  ];

  const planItems = [
    `과정명: ${draft.plan.courseName || "미입력"}`,
    `최종학력: ${draft.plan.finalEducation || "미입력"}`,
    `전체 이론 과목 수: ${
      draft.plan.totalTheorySubjects !== null
        ? `${draft.plan.totalTheorySubjects}과목`
        : "미입력"
    }`,
    `실습 필요 여부: ${
      draft.plan.hasPractice === null
        ? "확인 필요"
        : draft.plan.hasPractice
          ? "필요"
          : "불필요"
    }`,
    `플랜 요약: ${draft.plan.summaryText || "미입력"}`,
  ];

    const planSubjectSections =
    draft.planSubjects.length > 0
      ? Array.from(
          new Set(
            draft.planSubjects.map(
              (subject) =>
                subject.semesterNo
            )
          )
        )
          .sort(
            (a, b) =>
              a - b
          )
          .map(
            (semesterNo) => ({
              label:
  `${semesterNo}학기차 저장 예정 우리플랜 과목`,

              items:
                draft.planSubjects
                  .filter(
                    (subject) =>
                      subject.semesterNo ===
                      semesterNo
                  )
                  .map(
                    (
                      subject,
                      index
                    ) =>
                      `${index + 1}. ${subject.subjectName} · ${subject.requirementType} · ${subject.credits}학점${
                        subject.isConfirmed
                          ? ""
                          : " · 확인 필요"
                      }`
                  ),
            })
          )
      : [
          {
            label:
              "우리플랜 과목",

            items: [
              "설계된 우리플랜 과목이 없습니다.",
            ],
          },
        ];

  const transferSubjectSection = {
  label:
    "저장 예정 전적대 및 기존 이수 과목",

    items:
      draft.transferSubjects.length > 0
        ? draft.transferSubjects.map(
            (
              subject,
              index
            ) =>
              `${index + 1}. ${subject.subjectName} · ${subject.requirementType} · ${subject.credits}학점${
                subject.schoolName
                  ? ` · ${subject.schoolName}`
                  : ""
              }${
                subject.isConfirmed
                  ? ""
                  : " · 확인 필요"
              }`
          )
        : [
            "등록된 전적대 과목이 없습니다.",
          ],
  };

  const practiceSection = {
  label:
    "저장 예정 실습 설계",

    items:
      draft.practice === null
        ? [
            "실습 필요 여부를 확인해야 합니다.",
          ]
        : draft.practice.required
          ? [
              "실습 필요: 필요",
              `실습 과정: ${draft.practice.courseName || "미입력"}`,
              `실습 예정 학기: ${
                draft.practice.semesterNo !== null
                  ? `${draft.practice.semesterNo}학기`
                  : "미입력"
              }`,
              `실습 예정 월: ${draft.practice.plannedMonth || "미입력"}`,
              `실습 시간: ${
                draft.practice.requiredHours !== null
                  ? `${draft.practice.requiredHours}시간`
                  : "미입력"
              }`,
            ]
          : [
              "실습 필요: 불필요",
            ],
  };

  const duplicateSection = {
  label:
    "저장 전 중복과목 검사",

    items:
      draft.duplicateSubjects.length > 0
        ? draft.duplicateSubjects.map(
            (
              duplicate,
              index
            ) =>
              `${index + 1}. ${duplicate.subjectName} · ${duplicate.count}회 · 출처 ${duplicate.sources.join(", ")}`
          )
        : [
            "중복 과목이 없습니다.",
          ],
  };

const finalConfirmationSection = {
  label:
    "최종 확인",

  items: [
    "아래 표시된 회원정보, 학기정보, 교육원, 예정금액, 결제정보, 과목설계, 전적대 과목, 실습정보를 확인해주세요.",
    "승인하면 상담DB 상태를 등록예정으로 변경하고 등록예정 학생과 과목설계 정보를 실제 CRM에 저장합니다.",
    "표시된 내용이 다르면 승인하지 말고 수정할 내용을 AI에게 입력해주세요.",
  ],
};

  return {
        title:
  "등록예정 학생 생성 및 과목설계 최종 확인",

        summary:
  `${draft.student.clientName || "회원"}의 등록예정 학생 생성 및 과목설계 저장 전 최종 확인입니다. 아래 항목을 모두 확인한 뒤 승인해주세요.`,

    sections: [
  finalConfirmationSection,

  {
    label:
      "학생 기본정보",
    items:
      studentItems,
  },

  {
    label:
      "플랜 정보",
    items:
      planItems,
  },

      ...draft.semesters.map(
  (semester) => ({
    label:
      `${semester.semesterNo}학기차 학기정보`,
    items:
      semesterToPreviewItems(
        semester
      ),
  })
),

      ...planSubjectSections,

      transferSubjectSection,

      practiceSection,

      duplicateSection,
    ],

    changes: [],

        executionSteps: [
  "승인된 미리보기 버전과 현재 Pending Action 버전을 확인합니다.",
  "현재 로그인 사용자와 상담DB 담당자 권한을 다시 확인합니다.",
  "미리보기 생성 이후 상담DB 원본이 변경되지 않았는지 확인합니다.",
  "기존 학생으로 이미 전환된 상담DB인지 다시 확인합니다.",
  "필수값, 중복과목, 확인되지 않은 과목이 없는지 다시 검사합니다.",
  "상담DB 상태를 등록예정으로 변경합니다.",
  "등록예정 학생 기본정보와 플랜 요약을 저장합니다.",
  "학기정보와 학기별 우리플랜 과목을 저장합니다.",
  "전적대 및 기존 이수 과목을 저장합니다.",
  "실습 설계정보를 저장합니다.",
  "학생 감사로그와 AI 실행로그를 기록합니다.",
  "정산 반영, 승인관리 이동, 입력완료 처리는 실행하지 않습니다.",
],

    missingFields:
      draft.missingFields,

    warnings:
      draft.warnings,

    canConfirm:
      draft.canConfirm,
  };
}

/**
 * 사용자 문장과 상담DB, OCR 과목을 기반으로
 * 학생 통합등록 초안을 생성한다.
 *
 * 이 함수는 실제 DB를 변경하지 않는다.
 */
export function buildStudentRegistrationDraft(
  input: BuildStudentRegistrationDraftInput
): BuildStudentRegistrationDraftOutput {
  const now =
    input.now instanceof Date &&
    !Number.isNaN(
      input.now.getTime()
    )
      ? input.now
      : new Date();

  const message =
    normalizeText(
      input.message
    );

  const consultationId =
    normalizePositiveInteger(
      input.consultation?.id
    );

  if (!consultationId) {
    throw new Error(
      "상담DB ID가 올바르지 않습니다."
    );
  }

  const clientName =
    normalizeText(
      input.consultation
        ?.clientName
    );

  const phone =
    normalizePhone(
      input.consultation
        ?.phone
    );

  const consultationAssigneeId =
    normalizePositiveInteger(
      input.consultation
        ?.assigneeId
    );

  const fallbackAssigneeId =
    normalizePositiveInteger(
      input.fallbackAssigneeId
    );

  const assigneeId =
    consultationAssigneeId ||
    fallbackAssigneeId ||
    0;

  const courseName =
    extractCourseName(
      message,
      input.consultation
        ?.desiredCourse
    );

  const finalEducation =
    extractFinalEducation(
      message,
      input.consultation
        ?.finalEducation
    );

  const semesterSeeds =
    collectSemesterSeeds(
      message,
      now
    );

  const semesters:
    StudentRegistrationDraftSemester[] =
    semesterSeeds.map(
      (seed) => ({
        semesterNo:
          seed.semesterNo,

semesterLabel:
  seed.semesterLabel,

        plannedStartMonth:
          seed.plannedStartMonth,

        plannedInstitution:
          seed.plannedInstitution,

        plannedSubjectCount:
          seed.plannedSubjectCount,

        plannedAmount:
          seed.plannedAmount,

        actualStartDate:
          seed.actualStartDate,

        actualInstitution:
          seed.actualInstitution,

actualSubjectCount:
  seed.actualSubjectCount,

        actualPaymentAmount:
          seed.actualPaymentAmount,

        paymentDate:
          seed.paymentDate,

        isCompleted:
          false,
      })
    );

    const planSubjects =
    buildPlanSubjects(
      input
    );

  const transferSubjects =
    buildTransferSubjects(
      input
    );

  const duplicateSubjects =
    findDuplicateRegistrationSubjects({
      planSubjects,
      transferSubjects,
    });

  /**
   * AI가 설계한 우리플랜 과목의 학기 번호가
   * 메시지에서 추출한 예정 학기에 없으면
   * 해당 학기 예정표를 자동으로 추가한다.
   */
  const existingSemesterNoSet =
    new Set(
      semesters.map(
        (semester) =>
          Number(
            semester.semesterNo
          )
      )
    );

  const planSubjectSemesterNos =
    Array.from(
      new Set(
        planSubjects
          .map(
            (subject) =>
              Number(
                subject.semesterNo ||
                0
              )
          )
          .filter(
            (semesterNo) =>
              Number.isFinite(
                semesterNo
              ) &&
              semesterNo > 0
          )
      )
    )
      .sort(
        (a, b) =>
          a - b
      );

  for (
    const semesterNo of
    planSubjectSemesterNos
  ) {
    if (
      existingSemesterNoSet.has(
        semesterNo
      )
    ) {
      continue;
    }

    semesters.push({
      semesterNo,

semesterLabel:
  null,

      plannedStartMonth:
        null,

      plannedInstitution:
        null,

      plannedSubjectCount:
        null,

      plannedAmount:
        null,

      actualStartDate:
        null,

      actualInstitution:
        null,

actualSubjectCount:
  null,

      actualPaymentAmount:
        null,

      paymentDate:
        null,

      isCompleted:
        false,
    });

    existingSemesterNoSet.add(
      semesterNo
    );
  }

  semesters.sort(
    (a, b) =>
      Number(
        a.semesterNo
      ) -
      Number(
        b.semesterNo
      )
  );

   /**
   * 우리플랜 과목이 있고 학기 예정 과목 수가 비어 있으면
   * 해당 학기의 설계 과목 수로 예정 과목 수를 보완한다.
   */
  for (
    const semester of
    semesters
  ) {
    if (
      semester.plannedSubjectCount !==
      null
    ) {
      continue;
    }

        const count =
      planSubjects.filter(
        (subject) =>
          subject.semesterNo ===
          semester.semesterNo
      ).length;

    if (count > 0) {
      semester.plannedSubjectCount =
        count;
    }
  }

    const totalTheorySubjects =
    planSubjects.length > 0
      ? planSubjects.filter(
          (subject) =>
            !/실습/i.test(
              subject.subjectName
            )
        ).length
      : semesters.reduce(
          (
            sum,
            semester
          ) =>
            sum +
            Number(
              semester
                .plannedSubjectCount ||
                0
            ),
          0
        ) || null;

   const practice =
    buildPracticeDraft({
      message,
      courseName,
      semesters,
      now,
    });

  const hasPractice =
    practice === null
      ? null
      : practice.required;

    const missingFields =
  buildMissingFields({
    clientName,
    phone,
    assigneeId,
    courseName,
    finalEducation,

    semesters,

    planSubjects,

    practice,
  });

   const warnings =
    buildWarnings({
      consultationStatus:
        normalizeText(
          input.consultation
            ?.status
        ) || null,

      semesters,

      planSubjects,

      transferSubjects,

      duplicateSubjects,

      practice,
    });

   const hasUnconfirmedSubjects =
    planSubjects.some(
      (subject) =>
        !subject.isConfirmed
    ) ||
    transferSubjects.some(
      (subject) =>
        !subject.isConfirmed
    );

  const canConfirm =
    missingFields.length === 0 &&
    duplicateSubjects.length === 0 &&
    !hasUnconfirmedSubjects;

  const draft:
    StudentRegistrationDraft = {
      consultationId,

      student: {
        consultationId,
        clientName,
        phone,
        assigneeId,
        desiredCourse:
          courseName,
        finalEducation,
                status:
          "등록예정",
      },

      plan: {
        courseName,
        finalEducation,
        totalTheorySubjects,
        hasPractice,
        summaryText:
          buildPlanSummary({
            courseName,
            finalEducation,
            totalTheorySubjects,
            hasPractice,
            semesterCount:
              semesters.length,
          }),
      },

      semesters,

      planSubjects,

      transferSubjects,

      duplicateSubjects,

      practice,

      missingFields,

      warnings,

      canConfirm,

      createdAt:
        now.toISOString(),
    };

  return {
    draft,
    preview:
      buildPreview(draft),
  };
}