import * as db from "../db";

import {
  assertCanAccessStudent,
} from "./ai-permission";

import {
  analyzeStudentDetailRisk,
} from "./ai-risk-engine";

import type {
  AiUserContext,
  StudentDashboardNextAction,
  StudentDashboardPracticeItem,
  StudentDashboardScheduleItem,
  StudentDashboardSemesterItem,
  StudentDashboardSubjectItem,
  StudentDashboardToolOutput,
  StudentRiskSubjectItem,
} from "./ai.types";

/**
 * 숫자 또는 문자열 금액을 안전하게 숫자로 변환한다.
 */
function toNumber(
  value: unknown
): number {
  const normalized =
    Number(
      String(
        value ??
        "0"
      )
        .replace(/,/g, "")
        .trim()
    );

  return Number.isFinite(
    normalized
  )
    ? normalized
    : 0;
}

/**
 * 양의 정수 ID인지 확인한다.
 */
function normalizePositiveInteger(
  value: unknown
): number {
  const normalized =
    Number(value);

  if (
    !Number.isFinite(
      normalized
    ) ||
    normalized <= 0
  ) {
    return 0;
  }

  return Math.floor(
    normalized
  );
}

/**
 * 문자열을 안전하게 정리한다.
 */
function normalizeNullableString(
  value: unknown
): string | null {
  const normalized =
    String(
      value ??
      ""
    ).trim();

  return normalized ||
    null;
}

/**
 * Date 또는 문자열 날짜를 그대로 반환한다.
 *
 * AI Tool 결과에서는 Date와 string을 모두 허용한다.
 */
function normalizeNullableDate(
  value: unknown
): string | Date | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    value instanceof Date
  ) {
    return value;
  }

  const normalized =
    String(value).trim();

  return normalized ||
    null;
}

/**
 * 과목명 비교용 정규화
 *
 * 공백과 대소문자 차이 때문에
 * 동일 과목이 다른 과목으로 처리되는 것을 방지한다.
 */
function normalizeSubjectName(
  value: unknown
): string {
  return String(
    value ??
    ""
  )
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

/**
 * 위험도 엔진의 과목 구조를
 * 학생 Dashboard 과목 구조로 변환한다.
 */
function riskSubjectToDashboardSubject(
  subject:
    StudentRiskSubjectItem
): StudentDashboardSubjectItem {
  return {
    id:
      normalizePositiveInteger(
        subject.id
      ) ||
      null,

    source:
      subject.source,

    sourceLabel:
      normalizeNullableString(
        subject.sourceLabel
      ) ||
      (
        subject.source ===
          "plan"
          ? "우리플랜"
          : subject.source ===
              "transfer"
            ? "전적대"
            : "추가입력"
      ),

    subjectName:
      normalizeNullableString(
        subject.subjectName
      ) ||
      "과목명 미입력",

    requirementType:
      normalizeNullableString(
        subject.requirementType
      ),

    category:
      normalizeNullableString(
        subject.category
      ),

    credits:
      toNumber(
        subject.credits
      ),

    semesterNo:
      normalizePositiveInteger(
        subject.semesterNo
      ) ||
      null,

    /**
     * 기존 DB 과목에는 별도 확인 상태가 없으므로
     * 정상적으로 저장된 과목은 true로 반환한다.
     */
    isConfirmed:
      true,
  };
}

/**
 * 중복 과목 목록을 만든다.
 *
 * 위험도 엔진에서 반환한 전체 과목을 기준으로
 * 과목명이 두 번 이상 등장한 경우를 중복으로 본다.
 */
function buildDuplicateSubjects(
  subjects:
    StudentDashboardSubjectItem[]
): StudentDashboardSubjectItem[] {
  const subjectMap =
    new Map<
      string,
      StudentDashboardSubjectItem[]
    >();

  for (
    const subject of
    subjects
  ) {
    const normalizedName =
      normalizeSubjectName(
        subject.subjectName
      );

    if (!normalizedName) {
      continue;
    }

    const rows =
      subjectMap.get(
        normalizedName
      ) || [];

    rows.push(subject);

    subjectMap.set(
      normalizedName,
      rows
    );
  }

  const duplicates:
    StudentDashboardSubjectItem[] =
    [];

  for (
    const rows of
    subjectMap.values()
  ) {
    if (
      rows.length <= 1
    ) {
      continue;
    }

    duplicates.push(
      ...rows
    );
  }

  return duplicates;
}

/**
 * 중복 과목을 제외하고
 * 실제 인정 대상으로 사용할 과목을 만든다.
 *
 * 인정 우선순위:
 * 전적대 → 추가입력 → 우리플랜
 */
function buildRecognizedSubjects(
  subjects:
    StudentDashboardSubjectItem[]
): StudentDashboardSubjectItem[] {
  const priorityMap = {
    transfer: 1,
    extra: 2,
    plan: 3,
  } as const;

  const sorted =
    [...subjects].sort(
      (
        a,
        b
      ) => {
        const priorityDiff =
          priorityMap[a.source] -
          priorityMap[b.source];

        if (
          priorityDiff !== 0
        ) {
          return priorityDiff;
        }

        return (
          Number(
            a.id ||
            0
          ) -
          Number(
            b.id ||
            0
          )
        );
      }
    );

  const recognizedMap =
    new Map<
      string,
      StudentDashboardSubjectItem
    >();

  for (
    const subject of
    sorted
  ) {
    const normalizedName =
      normalizeSubjectName(
        subject.subjectName
      );

    if (
      !normalizedName ||
      subject.credits <= 0
    ) {
      continue;
    }

    if (
      recognizedMap.has(
        normalizedName
      )
    ) {
      continue;
    }

    recognizedMap.set(
      normalizedName,
      subject
    );
  }

  return Array.from(
    recognizedMap.values()
  );
}

/**
 * 학기 DB 데이터를 Dashboard 타입으로 변환한다.
 *
 * 기존 CRM의 학기 컬럼명이 변경될 가능성을 고려해
 * 일부 필드는 호환 가능한 이름을 함께 확인한다.
 */
function buildSemesterRows(
  rows: any[]
): StudentDashboardSemesterItem[] {
  return (
    rows ||
    []
  )
    .map(
      (
        row: any
      ) => ({
        id:
          normalizePositiveInteger(
            row.id
          ),

        semesterNo:
          normalizePositiveInteger(
            row.semesterNo ??
            row.semesterOrder
          ) ||
          null,

        plannedStartMonth:
          normalizeNullableString(
            row.plannedStartMonth
          ),

        plannedInstitution:
          normalizeNullableString(
            row.plannedInstitution
          ),

        actualStartDate:
          normalizeNullableDate(
            row.actualStartDate ??
            row.startDate
          ),

        actualInstitution:
          normalizeNullableString(
            row.actualInstitution ??
            row.institution
          ),

        plannedSubjectCount:
          row.plannedSubjectCount ===
            null ||
          row.plannedSubjectCount ===
            undefined
            ? null
            : toNumber(
                row.plannedSubjectCount
              ),

        plannedAmount:
          row.plannedAmount ??
          null,

        actualPaymentAmount:
          row.actualPaymentAmount ??
          row.paymentAmount ??
          null,

        paymentDate:
          normalizeNullableDate(
            row.paymentDate
          ),
      })
    )
    .filter(
      (
        row
      ) =>
        row.id > 0
    )
    .sort(
      (
        a,
        b
      ) =>
        Number(
          a.semesterNo ||
          0
        ) -
        Number(
          b.semesterNo ||
          0
        )
    );
}

/**
 * 실습 요청 데이터를 Dashboard 타입으로 변환한다.
 */
function buildPracticeRows(
  rows: any[]
): StudentDashboardPracticeItem[] {
  return (
    rows ||
    []
  )
    .map(
      (
        row: any
      ) => ({
        id:
          normalizePositiveInteger(
            row.id
          ),

        status:
          normalizeNullableString(
            row.status
          ),

        coordinationStatus:
          normalizeNullableString(
            row.coordinationStatus
          ),

        paymentStatus:
          normalizeNullableString(
            row.paymentStatus
          ),

        institutionName:
          normalizeNullableString(
            row.institutionName ??
            row.practiceInstitutionName
          ),

        institutionAddress:
          normalizeNullableString(
            row.institutionAddress ??
            row.practiceInstitutionAddress
          ),

        institutionPhone:
          normalizeNullableString(
            row.institutionPhone ??
            row.practiceInstitutionPhone
          ),

        plannedStartDate:
          normalizeNullableDate(
            row.plannedStartDate ??
            row.startDate
          ),

        plannedEndDate:
          normalizeNullableDate(
            row.plannedEndDate ??
            row.endDate
          ),

        feeAmount:
          row.feeAmount ??
          null,

        createdAt:
          normalizeNullableDate(
            row.createdAt
          ),
      })
    )
    .filter(
      (
        row
      ) =>
        row.id > 0
    )
    .sort(
      (
        a,
        b
      ) => {
        const aTime =
          new Date(
            String(
              a.createdAt ||
              0
            )
          ).getTime();

        const bTime =
          new Date(
            String(
              b.createdAt ||
              0
            )
          ).getTime();

        return bTime - aTime;
      }
    );
}

/**
 * 학생의 기본 누락정보를 정리한다.
 */
function buildMissingFields(
  student: any
): string[] {
  const missingFields:
    string[] = [];

  if (
    !normalizeNullableString(
      student.clientName
    )
  ) {
    missingFields.push(
      "회원명"
    );
  }

  if (
    !normalizeNullableString(
      student.phone
    )
  ) {
    missingFields.push(
      "연락처"
    );
  }

  if (
    !normalizeNullableString(
      student.course
    )
  ) {
    missingFields.push(
      "진행과정"
    );
  }

  if (
    !normalizeNullableString(
      student.finalEducation
    )
  ) {
    missingFields.push(
      "최종학력"
    );
  }

  if (
    !normalizePositiveInteger(
      student.assigneeId
    )
  ) {
    missingFields.push(
      "담당자"
    );
  }

  if (
    !normalizeNullableString(
      student.address
    )
  ) {
    missingFields.push(
      "주소"
    );
  }

  return missingFields;
}

/**
 * 위험도 및 현재 상태를 기반으로
 * 담당자가 다음에 처리해야 할 업무를 만든다.
 */
function buildNextActions(params: {
  student: any;

  semesters:
    StudentDashboardSemesterItem[];

  recognizedSubjects:
    StudentDashboardSubjectItem[];

  practiceRequests:
    StudentDashboardPracticeItem[];

  missingFields:
    string[];

  risk:
    Awaited<
      ReturnType<
        typeof analyzeStudentDetailRisk
      >
    >;
}): StudentDashboardNextAction[] {
  const actions:
    StudentDashboardNextAction[] =
    [];

  if (
    params.missingFields.length >
    0
  ) {
    actions.push({
      code:
        "COMPLETE_STUDENT_INFORMATION",

      priority:
        "high",

      title:
        "학생 누락정보 입력",

      message:
        `누락된 정보: ${params.missingFields.join(", ")}`,

      source:
        "student",
    });
  }

  if (
    params.semesters.length ===
    0
  ) {
    actions.push({
      code:
        "CREATE_SEMESTER_PLAN",

      priority:
        "high",

      title:
        "학기 예정표 확인",

      message:
        "등록된 학기 예정표가 없습니다. 학생의 개강 예정 학기와 교육원을 확인해야 합니다.",

      source:
        "semester",
    });
  }

  if (
    params.recognizedSubjects
      .length === 0
  ) {
    actions.push({
      code:
        "CHECK_SUBJECT_PLAN",

      priority:
        "high",

      title:
        "과목설계 확인",

      message:
        "인정 가능한 우리플랜 또는 전적대 과목이 없습니다. 과목설계와 기존 이수과목을 확인해야 합니다.",

      source:
        "subject",
    });
  }

  if (
    params.risk.summary
      .remainingCredits !==
      null &&
    params.risk.summary
      .remainingCredits > 0
  ) {
    actions.push({
      code:
        "REVIEW_REMAINING_CREDITS",

      priority:
        params.risk.summary
          .remainingCredits >= 6
          ? "high"
          : "medium",

      title:
        "남은 학점 확인",

      message:
        `현재 기준으로 ${params.risk.summary.remainingCredits}학점이 부족합니다. 다음 학기 과목설계를 확인해야 합니다.`,

      source:
        "credit",
    });
  }

  if (
    params.risk.payment
      .status ===
      "missing" ||
    params.risk.payment
      .status ===
      "not_confirmed"
  ) {
    actions.push({
      code:
        "CHECK_PAYMENT",

      priority:
        "high",

      title:
        "결제정보 확인",

      message:
        "결제금액 또는 결제일이 확정되지 않았습니다.",

      source:
        "payment",
    });
  }

  if (
    params.risk.payment
      .status ===
      "partial_refund" ||
    params.risk.payment
      .status ===
      "full_refund" ||
    params.risk.payment
      .status ===
      "refund_without_payment"
  ) {
    actions.push({
      code:
        "CHECK_REFUND",

      priority:
        "high",

      title:
        "환불 상태 확인",

      message:
        "환불 또는 결제 연결 상태를 확인해야 합니다.",

      source:
        "payment",
    });
  }

  const hasPracticeIssue =
    params.risk.issues.some(
      (
        issue
      ) =>
        issue.category ===
        "practice"
    );

  if (
    hasPracticeIssue ||
    (
      params.risk.sourceStatus
        .hasPlan &&
      params.practiceRequests
        .length === 0 &&
      /사회복지|보육|평생교육|실습/i.test(
        String(
          params.student.course ||
          ""
        )
      )
    )
  ) {
    actions.push({
      code:
        "CHECK_PRACTICE",

      priority:
        "high",

      title:
        "실습 진행 확인",

      message:
        "실습 필요 여부와 실습배정지원센터 요청 상태를 확인해야 합니다.",

      source:
        "practice",
    });
  }

  for (
    const issue of
    params.risk.issues
  ) {
    if (
      issue.severity !==
      "danger"
    ) {
      continue;
    }

    actions.push({
      code:
        `RISK_${issue.code}`,

      priority:
        "high",

      title:
        issue.title,

      message:
        issue.message,

      source:
        "risk",
    });
  }

  /**
   * 같은 code의 업무가 중복 생성되지 않도록 제거한다.
   */
  return Array.from(
    new Map(
      actions.map(
        (
          action
        ) => [
          action.code,
          action,
        ]
      )
    ).values()
  );
}

function buildScheduleRows(
  rows:
    any[]
): StudentDashboardScheduleItem[] {
  return (
    rows ||
    []
  )
    .map(
      (
        row:
          any
      ) => ({
        id:
          normalizePositiveInteger(
            row.id
          ),

        studentId:
          normalizePositiveInteger(
            row.studentId
          ) ||
          null,

        title:
          normalizeNullableString(
            row.title
          ) ||
          "일정",

        description:
          normalizeNullableString(
            row.description
          ),

        scheduleDate:
          normalizeNullableDate(
            row.scheduleDate
          ),

        startAt:
          normalizeNullableDate(
            row.startAt
          ),

        meridiem:
          normalizeNullableString(
            row.meridiem
          ),

        hour12:
          normalizePositiveInteger(
            row.hour12
          ) ||
          null,

        minute:
          row.minute ===
            null ||
          row.minute ===
            undefined
            ? null
            : toNumber(
                row.minute
              ),

        scope:
          normalizeNullableString(
            row.scope
          ),

        ownerUserId:
          normalizePositiveInteger(
            row.ownerUserId
          ) ||
          null,

        ownerUserName:
          normalizeNullableString(
            row.ownerUserName
          ),

       isNotified:
  row.isNotified ===
    true ||
  Number(
    row.isNotified
  ) ===
    1,
      })
    )
    .filter(
      (
        row
      ) =>
        row.id >
        0
    )
    .sort(
      (
        a,
        b
      ) => {
        const aTime =
          new Date(
            String(
              a.startAt ||
              0
            )
          ).getTime();

        const bTime =
          new Date(
            String(
              b.startAt ||
              0
            )
          ).getTime();

        return (
          aTime -
          bTime
        );
      }
    );
}

/**
 * 학생 종합 업무 현황 조회
 *
 * 이 함수는 조회만 수행한다.
 * DB를 수정하거나 Pending Action을 생성하지 않는다.
 */
export async function getStudentDashboard(
  params: {
    context:
      AiUserContext;

    studentId:
      number;
  }
): Promise<StudentDashboardToolOutput> {
  const studentId =
    normalizePositiveInteger(
      params.studentId
    );

  if (!studentId) {
    throw new Error(
      "올바른 학생 ID가 필요합니다."
    );
  }

  const organizationId =
    normalizePositiveInteger(
      params.context
        .organizationId
    );

  if (!organizationId) {
    throw new Error(
      "AI 조회 대상 회사가 지정되지 않았습니다."
    );
  }

  /**
   * 1. 학생을 먼저 조회한다.
   *
   * studentId만으로 조회하지 않고
   * 반드시 organizationId를 함께 사용한다.
   */
  const student =
    await db.getStudentById(
      studentId,
      {
        organizationId,
      }
    );

  if (!student) {
    throw new Error(
      "학생 정보를 찾을 수 없습니다."
    );
  }

  /**
   * 2. Staff/Admin/Host/Superhost 권한 범위를 검사한다.
   */
  assertCanAccessStudent({
    context:
      params.context,

    student,
  });

  /**
   * 3. 학생 Dashboard에 필요한 데이터를 병렬 조회한다.
   *
   * 위험도 엔진은 플랜, 과목, 학점, 결제,
   * 실습 상태를 서버에서 다시 조회하고 계산한다.
   */
 const [
  semesterRows,
  practiceRequestRows,
  scheduleRows,
  risk,
] =
  await Promise.all([
      db.listSemesters(
        studentId,
        {
          organizationId,
        }
      ),

      db.listPracticeSupportRequestsByStudent(
        studentId,
        {
          organizationId,
        }
      ),

db.listStudentSchedules(
  studentId,
  {
    organizationId,

    includePast:
      false,

    limit:
      100,
  }
),

      analyzeStudentDetailRisk({
        context:
          params.context,

        studentId,
      }),
    ]);

  const semesters =
    buildSemesterRows(
      semesterRows as any[]
    );

  const practiceRequests =
    buildPracticeRows(
      practiceRequestRows as any[]
    );

const schedules =
  buildScheduleRows(
    scheduleRows as
      any[]
  );

  const allSubjects =
    (
      risk.subjects ||
      []
    ).map(
      riskSubjectToDashboardSubject
    );

  const planSubjects =
    allSubjects.filter(
      (
        subject
      ) =>
        subject.source ===
        "plan"
    );

  const transferSubjects =
    allSubjects.filter(
      (
        subject
      ) =>
        subject.source ===
        "transfer"
    );

  const extraSubjects =
    allSubjects.filter(
      (
        subject
      ) =>
        subject.source ===
        "extra"
    );

  const recognizedSubjects =
    buildRecognizedSubjects(
      allSubjects
    );

  const duplicateSubjects =
    buildDuplicateSubjects(
      allSubjects
    );

  const missingFields =
    buildMissingFields(
      student
    );

  const nextActions =
    buildNextActions({
      student,

      semesters,

      recognizedSubjects,

      practiceRequests,

      missingFields,

      risk,
    });

  const plannedAmount =
    semesters.reduce(
      (
        sum,
        semester
      ) =>
        sum +
        toNumber(
          semester.plannedAmount
        ),
      0
    );

  return {
    student: {
      id:
        Number(
          student.id
        ),

      organizationId:
        Number(
          student.organizationId
        ),

      clientName:
        student.clientName ??
        null,

      phone:
        student.phone ??
        null,

      course:
        student.course ??
        null,

      status:
        student.status ??
        null,

      finalEducation:
        student.finalEducation ??
        null,

      startDate:
        student.startDate ??
        null,

      paymentAmount:
        student.paymentAmount ??
        null,

      paymentDate:
        student.paymentDate ??
        null,

      subjectCount:
        student.subjectCount ??
        null,

      institution:
        student.institution ??
        null,

      totalSemesters:
        student.totalSemesters ??
        null,

      approvalStatus:
        student.approvalStatus ??
        null,

      assigneeId:
        student.assigneeId ??
        null,

      address:
        student.address ??
        null,

      detailAddress:
        student.detailAddress ??
        null,
    },

    semesters,

    subjects: {
      plan:
        planSubjects,

      transfer:
        transferSubjects,

      extra:
        extraSubjects,

      recognized:
        recognizedSubjects,

      duplicates:
        duplicateSubjects,
    },

    creditSummary: {
      registeredSubjectCount:
        risk.summary
          .registeredSubjectCount,

      recognizedSubjectCount:
        risk.summary
          .totalSubjectCount,

      currentCredits:
        risk.summary
          .currentCredits,

      requiredCredits:
        risk.summary
          .requiredCredits,

      remainingCredits:
        risk.summary
          .remainingCredits,

      duplicateSubjectCount:
        risk.summary
          .duplicateSubjectCount,
    },

    paymentSummary: {
      plannedAmount,

      paidAmount:
        risk.payment
          .totalPaid,

      refundedAmount:
        risk.payment
          .totalRefund,

      actualPaidAmount:
        risk.payment
          .netPaymentAmount,

      paymentStatus:
        risk.payment
          .status,

      paymentDate:
        risk.payment
          .paymentDate,
    },

    practice: {
      required:
        risk.sourceStatus
          .hasPlan
          ? (
              /사회복지|보육|평생교육|실습/i.test(
                String(
                  student.course ||
                  ""
                )
              )
                ? true
                : null
            )
          : null,

      requestCount:
        practiceRequests.length,

      latestRequest:
        practiceRequests[0] ||
        null,

      requests:
        practiceRequests,
    },

    schedules,

    missingFields,

    risk: {
      riskLevel:
        risk.summary
          .riskLevel,

      riskScore:
        risk.summary
          .riskScore,

      totalIssueCount:
        risk.summary
          .totalIssueCount,

      items:
        risk.issues,
    },

    nextActions,

    generatedAt:
      new Date()
        .toISOString(),
  };
}