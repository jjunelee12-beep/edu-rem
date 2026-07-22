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
  plannedStartMonth: string | null;
  plannedInstitution: string | null;
  plannedSubjectCount: number | null;
  plannedAmount: number | null;
  actualStartDate: string | null;
  actualInstitution: string | null;
  actualPaymentAmount: number | null;
  paymentDate: string | null;
};

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
  const manWonMatch =
    text.match(
      /(\d+(?:\.\d+)?)\s*만\s*원?/
    );

  if (manWonMatch) {
    return Math.round(
      Number(manWonMatch[1]) *
        10000
    );
  }

  const wonMatch =
    text.match(
      /([\d,]+)\s*원/
    );

  if (wonMatch) {
    return normalizeNonNegativeNumber(
      wonMatch[1]
    );
  }

  const amountKeywordMatch =
    text.match(
      /(?:결제금액|실결제|예정금액|금액)\s*[:：]?\s*([\d,]+)/
    );

  if (amountKeywordMatch) {
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

function parseSemesterNo(
  text: string
): number | null {
  const match =
    text.match(
      /(\d{1,2})\s*학기/
    );

  return match
    ? normalizePositiveInteger(
        match[1]
      )
    : null;
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
  text: string
): string | null {
  const labeledMatch =
    text.match(
      /(?:교육원|기관|수강처|진행처)\s*[:：]?\s*([가-힣A-Za-z0-9()·._-]{2,40})/
    );

  if (
    labeledMatch?.[1]
  ) {
    return normalizeText(
      labeledMatch[1]
    );
  }

  const commonInstitutionMatch =
    text.match(
      /([가-힣A-Za-z0-9()·._-]{2,30}(?:원격평생교육원|평생교육원|사이버평생교육원|사이버에듀|원격|교육원))/
    );

  return commonInstitutionMatch?.[1]
    ? normalizeText(
        commonInstitutionMatch[1]
      )
    : null;
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
        plannedStartMonth: null,
        plannedInstitution: null,
        plannedSubjectCount: null,
        plannedAmount: null,
        actualStartDate: null,
        actualInstitution: null,
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
      parseSemesterNo(segment);

    if (segmentSemesterNo) {
      activeSemesterNo =
        segmentSemesterNo;
    }

    const seed =
      ensureSeed(
        activeSemesterNo
      );

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

    if (
      /결제일|입금일|납부일/i.test(
        segment
      ) &&
      date
    ) {
      seed.paymentDate =
        date;
    }

    if (
      /개강일|시작일|실제\s*시작|수업\s*시작/i.test(
        segment
      ) &&
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
        !seed.plannedStartMonth
      ) {
        seed.plannedStartMonth =
          month;
      }

      if (
        amount !== null
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
          null
        ) {
          seed.plannedAmount =
            amount;
        }
      }

      if (
        subjectCount !== null
      ) {
        seed.plannedSubjectCount =
          subjectCount;
      }

      if (institution) {
        if (
          /실제|확정|등록|수강/i.test(
            segment
          )
        ) {
          seed.actualInstitution =
            institution;
        } else if (
          !seed.plannedInstitution
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
          semesterNo: 1,
          plannedStartMonth: null,
          plannedInstitution: null,
          plannedSubjectCount: null,
          plannedAmount: null,
          actualStartDate: null,
          actualInstitution: null,
          actualPaymentAmount: null,
          paymentDate: null,
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

function buildPlanSubjects(
  input: BuildStudentRegistrationDraftInput
): StudentRegistrationDraftPlanSubject[] {
  const rows =
    input.planSubjects || [];

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
            ) || 1,

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
            "server",

          isConfirmed:
            row.isConfirmed !== false,
        };
      }
    )
    .filter(
      (
        row
      ): row is StudentRegistrationDraftPlanSubject =>
        row !== null
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
  message: string
): boolean | null {
  if (
    /실습\s*(?:없음|불필요|안\s*함|제외)|실습을?\s*하지\s*않/i.test(
      message
    )
  ) {
    return false;
  }

  if (
    /실습\s*(?:필요|있음|진행|포함)|실습도|현장실습/i.test(
      message
    )
  ) {
    return true;
  }

  return null;
}

function extractPracticeHours(
  message: string
): number | null {
  const match =
    message.match(
      /실습\s*(\d{2,3})\s*시간|(\d{2,3})\s*시간\s*실습/i
    );

  return normalizePositiveInteger(
    match?.[1] ||
    match?.[2]
  );
}

function extractPracticeSemesterNo(
  message: string
): number | null {
  const match =
    message.match(
      /(\d{1,2})\s*학기[^.\n]*실습|실습[^.\n]*(\d{1,2})\s*학기/i
    );

  return normalizePositiveInteger(
    match?.[1] ||
    match?.[2]
  );
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
  clientName: string;
  phone: string;
  assigneeId: number;
  courseName: string | null;
  finalEducation: string | null;
  planSubjects:
    StudentRegistrationDraftPlanSubject[];
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
    params.planSubjects.length === 0
  ) {
    missing.push(
      "우리플랜 과목"
    );
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

  const semesterNos =
    params.semesters.map(
      (semester) =>
        semester.semesterNo
    );

  if (
    new Set(
      semesterNos
    ).size !==
    semesterNos.length
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

  if (
    params.practice === null
  ) {
    warnings.push(
      "실습 필요 여부가 확정되지 않았습니다."
    );
  } else if (
    params.practice.required &&
    params.practice.requiredHours ===
      null
  ) {
    warnings.push(
      "실습이 필요하지만 실습 시간이 입력되지 않았습니다."
    );
  }

  return uniqueStrings(
    warnings
  );
}

function semesterToPreviewItems(
  semester: StudentRegistrationDraftSemester
): string[] {
  return [
    `학기: ${semester.semesterNo}학기`,
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
                `${semesterNo}학기 우리플랜 과목`,

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
      "전적대 및 기존 이수 과목",

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
      "실습 설계",

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
      "중복과목 검사",

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

  return {
        title:
      "학생 과목설계 저장 확인",

        summary:
      `${draft.student.clientName || "회원"}의 상담DB와 전적대 정보를 기준으로 등록예정 학생 및 과목설계 초안을 만들었습니다.`,

    sections: [
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
            `${semester.semesterNo}학기 예정표`,
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
      "상담DB 원본과 현재 권한을 다시 확인합니다.",
      "상담 상태를 등록예정으로 변경합니다.",
      "등록예정 학생 기본정보를 생성합니다.",
      "학생 플랜 요약을 저장합니다.",
      "학기별 과목설계를 저장합니다.",
      "전적대 및 기존 이수 과목을 저장합니다.",
      "우리플랜과 전적대 과목의 중복을 다시 검사합니다.",
      "실습 설계정보를 저장합니다.",
      "학생 감사로그와 AI 실행로그를 기록합니다.",
      "승인 요청·정산·입력완료 처리는 실행하지 않습니다.",
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
      planSubjects,
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
          "등록",
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