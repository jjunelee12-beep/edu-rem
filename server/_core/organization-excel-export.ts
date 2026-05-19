import ExcelJS from "exceljs";
import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { throwAppError } from "./appError";
import { ERROR_CODES } from "./errorCodes";

function safeSheetName(name: string) {
  return String(name || "Sheet").slice(0, 31);
}

function formatDateTime(value: any) {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");

  return `${y}-${m}-${d} ${hh}:${mm}`;
}

function normalizeRows(rows: any[]) {
  return (rows || []).map((row) => {
    const next: Record<string, any> = {};

    for (const [key, value] of Object.entries(row || {})) {
      if (value instanceof Date) {
        next[key] = formatDateTime(value);
      } else if (value === null || value === undefined) {
        next[key] = "";
      } else {
        next[key] = value;
      }
    }

    return next;
  });
}

function addSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  rows: any[],
  fallbackHeaders: string[]
) {
  const worksheet = workbook.addWorksheet(safeSheetName(sheetName));
  const normalized = normalizeRows(rows);

  const headers =
    normalized.length > 0
      ? Object.keys(normalized[0])
      : fallbackHeaders;

  worksheet.columns = headers.map((header) => ({
    header,
    key: header,
    width: Math.min(Math.max(String(header).length + 8, 14), 35),
  }));

  for (const row of normalized) {
    worksheet.addRow(row);
  }

  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).alignment = {
    vertical: "middle",
    horizontal: "center",
  };

  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.alignment = {
        vertical: "middle",
        wrapText: true,
      };
    });
  });

  return worksheet;
}

function sanitizeFilePart(value: any) {
  return String(value || "organization")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function queryRows(query: any) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const [rows] = await db.execute(query);
  return Array.isArray(rows) ? (rows as any[]) : [];
}

export async function buildOrganizationExcelExport(params: {
  organizationId: number;
  requestedBy: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const organizationId = Number(params.organizationId || 0);

  if (!Number.isFinite(organizationId) || organizationId <= 0) {
    throwAppError(
  ERROR_CODES.ORGANIZATION_REQUIRED,
  "organizationId is required",
  400
);
  }

  const [orgRows] = await db.execute(sql`
    SELECT
      id,
      name,
      slug,
      businessName,
      businessNumber,
      planCode,
      status
    FROM organizations
    WHERE id = ${organizationId}
    LIMIT 1
  `);

  const organization = Array.isArray(orgRows) ? (orgRows as any[])[0] : null;

  if (!organization) {
    throw new Error("회사를 찾을 수 없습니다.");
  }

  const workbook = new ExcelJS.Workbook();

  workbook.creator = "EduCanvas CRM";
  workbook.created = new Date();
  workbook.modified = new Date();

  const createdAt = new Date();

  const summaryRows = [
    {
      항목: "회사명",
      값: organization.name || "",
    },
    {
      항목: "회사 슬러그",
      값: organization.slug || "",
    },
    {
      항목: "사업자명",
      값: organization.businessName || "",
    },
    {
      항목: "사업자번호",
      값: organization.businessNumber || "",
    },
    {
      항목: "플랜",
      값: organization.planCode || "",
    },
    {
      항목: "상태",
      값: organization.status || "",
    },
    {
      항목: "내보내기 일시",
      값: formatDateTime(createdAt),
    },
  ];

  addSheet(workbook, "요약", summaryRows, ["항목", "값"]);

  const consultations = await queryRows(sql`
    SELECT
      consultDate AS 상담일,
      channel AS 유입경로,
      clientName AS 이름,
      phone AS 연락처,
      finalEducation AS 최종학력,
      desiredCourse AS 희망과정,
      notes AS 상담내용,
      status AS 상태,
      assigneeId AS 담당자ID,
      createdAt AS 생성일,
      updatedAt AS 수정일
    FROM consultations
    WHERE organizationId = ${organizationId}
      AND deletedAt IS NULL
    ORDER BY createdAt DESC
  `);

  addSheet(workbook, "상담DB", consultations, [
    "상담일",
    "유입경로",
    "이름",
    "연락처",
    "최종학력",
    "희망과정",
    "상담내용",
    "상태",
    "담당자ID",
    "생성일",
    "수정일",
  ]);

  const students = await queryRows(sql`
    SELECT
      s.clientName AS 학생명,
      s.phone AS 연락처,
      s.course AS 과정,
      s.status AS 상태,
      u.name AS 담당자,
      s.paymentAmount AS 결제금액,
      s.paymentDate AS 결제일,
      s.approvalStatus AS 승인상태,
      s.startDate AS 개강일,
      s.subjectCount AS 과목수,
      s.institution AS 교육원,
      s.createdAt AS 생성일,
      s.updatedAt AS 수정일
    FROM students s
    LEFT JOIN users u
      ON u.id = s.assigneeId
     AND u.organizationId = s.organizationId
    WHERE s.organizationId = ${organizationId}
      AND s.deletedAt IS NULL
    ORDER BY s.createdAt DESC
  `);

  addSheet(workbook, "학생관리", students, [
    "학생명",
    "연락처",
    "과정",
    "상태",
    "담당자",
    "결제금액",
    "결제일",
    "승인상태",
    "개강일",
    "과목수",
    "교육원",
    "생성일",
    "수정일",
  ]);

  const semesters = await queryRows(sql`
    SELECT
      s.clientName AS 학생명,
      sem.semesterOrder AS 학기,
      sem.status AS 상태,
      sem.plannedMonth AS 예정월,
      sem.plannedInstitution AS 예정교육원,
      sem.plannedSubjectCount AS 예정과목수,
      sem.plannedAmount AS 예정금액,
      sem.actualStartDate AS 실제개강일,
      sem.actualPaymentDate AS 실제결제일,
      sem.actualSubjectCount AS 실제과목수,
      sem.actualAmount AS 실제결제금액,
      sem.approvalStatus AS 승인상태,
      sem.approvedAt AS 승인일,
      sem.updatedAt AS 수정일
    FROM semesters sem
    LEFT JOIN students s
      ON s.id = sem.studentId
     AND s.organizationId = sem.organizationId
    WHERE sem.organizationId = ${organizationId}
    ORDER BY s.clientName ASC, sem.semesterOrder ASC
  `);

  addSheet(workbook, "학기결제", semesters, [
    "학생명",
    "학기",
    "상태",
    "예정월",
    "예정교육원",
    "예정과목수",
    "예정금액",
    "실제개강일",
    "실제결제일",
    "실제과목수",
    "실제결제금액",
    "승인상태",
    "승인일",
    "수정일",
  ]);

  const planSubjects = await queryRows(sql`
    SELECT
      s.clientName AS 학생명,
      ps.semesterNo AS 학기,
      ps.subjectName AS 과목명,
      ps.planCategory AS 구분,
      ps.planRequirementType AS 이수구분,
      ps.credits AS 학점,
      ps.sortOrder AS 정렬,
      ps.createdAt AS 생성일,
      ps.updatedAt AS 수정일
    FROM plan_semesters ps
    LEFT JOIN students s
      ON s.id = ps.studentId
     AND s.organizationId = ps.organizationId
    WHERE ps.organizationId = ${organizationId}
    ORDER BY s.clientName ASC, ps.semesterNo ASC, ps.sortOrder ASC
  `);

  addSheet(workbook, "플랜과목", planSubjects, [
    "학생명",
    "학기",
    "과목명",
    "구분",
    "이수구분",
    "학점",
    "정렬",
    "생성일",
    "수정일",
  ]);

  const transferSubjects = await queryRows(sql`
    SELECT
      s.clientName AS 학생명,
      ts.schoolName AS 학교명,
      ts.subjectName AS 과목명,
      ts.transferCategory AS 구분,
      ts.transferRequirementType AS 이수구분,
      ts.credits AS 학점,
      ts.sortOrder AS 정렬,
      ts.attachmentName AS 첨부파일명,
      ts.attachmentUrl AS 첨부파일URL,
      ts.createdAt AS 생성일,
      ts.updatedAt AS 수정일
    FROM transfer_subjects ts
    LEFT JOIN students s
      ON s.id = ts.studentId
     AND s.organizationId = ts.organizationId
    WHERE ts.organizationId = ${organizationId}
    ORDER BY s.clientName ASC, ts.sortOrder ASC
  `);

  addSheet(workbook, "전적대과목", transferSubjects, [
    "학생명",
    "학교명",
    "과목명",
    "구분",
    "이수구분",
    "학점",
    "정렬",
    "첨부파일명",
    "첨부파일URL",
    "생성일",
    "수정일",
  ]);

  const refunds = await queryRows(sql`
    SELECT
      s.clientName AS 학생명,
      sem.semesterOrder AS 학기,
      r.refundAmount AS 환불금액,
      r.refundDate AS 환불일,
      r.refundType AS 환불유형,
      r.reason AS 사유,
      r.approvalStatus AS 승인상태,
      r.approvedAt AS 승인일,
      r.rejectedAt AS 불승인일,
      u.name AS 담당자,
      r.attachmentName AS 첨부파일명,
      r.attachmentUrl AS 첨부파일URL,
      r.createdAt AS 생성일,
      r.updatedAt AS 수정일
    FROM refunds r
    LEFT JOIN students s
      ON s.id = r.studentId
     AND s.organizationId = r.organizationId
    LEFT JOIN semesters sem
      ON sem.id = r.semesterId
     AND sem.organizationId = r.organizationId
    LEFT JOIN users u
      ON u.id = r.assigneeId
     AND u.organizationId = r.organizationId
    WHERE r.organizationId = ${organizationId}
    ORDER BY r.createdAt DESC
  `);

  addSheet(workbook, "환불", refunds, [
    "학생명",
    "학기",
    "환불금액",
    "환불일",
    "환불유형",
    "사유",
    "승인상태",
    "승인일",
    "불승인일",
    "담당자",
    "첨부파일명",
    "첨부파일URL",
    "생성일",
    "수정일",
  ]);

  const practiceSupport = await queryRows(sql`
  SELECT
    clientName AS 이름,
    phone AS 연락처,
    assigneeName AS 담당자,
    managerName AS 관리담당자,
    course AS 과정,
    inputAddress AS 입력주소,
    detailAddress AS 상세주소,
    coordinationStatus AS 섭외상태,
    paymentStatus AS 결제상태,
    feeAmount AS 수수료,
    paidAt AS 입금일,
    practiceHours AS 실습시간,
    practiceDate AS 실습예정일,
    selectedPracticeInstitutionName AS 실습기관명,
    selectedPracticeInstitutionAddress AS 실습기관주소,
    selectedPracticeInstitutionDistanceKm AS 실습기관거리,
    selectedEducationCenterName AS 실습교육원명,
    selectedEducationCenterAddress AS 실습교육원주소,
    selectedEducationCenterDistanceKm AS 실습교육원거리,
    refundStatus AS 환불상태,
    refundAmount AS 환불금액,
    refundReason AS 환불사유,
    note AS 메모,
    attachmentName AS 첨부파일명,
    attachmentUrl AS 첨부파일URL,
    createdAt AS 생성일,
    updatedAt AS 수정일
  FROM practice_support_requests
  WHERE organizationId = ${organizationId}
  ORDER BY createdAt DESC
`);

  addSheet(workbook, "실습배정", practiceSupport, [
    "이름",
    "연락처",
    "과정",
    "입력주소",
    "상세주소",
    "요청상태",
    "섭외상태",
    "결제상태",
    "수수료",
    "입금일",
    "담당자명",
    "실습시간",
    "실습예정일",
    "기관명",
    "교육원명",
    "생성일",
    "수정일",
  ]);

  const privateCertificates = await queryRows(sql`
    SELECT
      clientName AS 이름,
      phone AS 연락처,
      certificateName AS 자격증명,
      requestStatus AS 요청상태,
      paymentStatus AS 결제상태,
      feeAmount AS 결제금액,
      freelancerInputAmount AS 프리랜서입력금액,
      paidAt AS 결제일,
      assigneeName AS 담당자명,
      attachmentName AS 첨부파일명,
      attachmentUrl AS 첨부파일URL,
      createdAt AS 생성일,
      updatedAt AS 수정일
    FROM private_certificate_requests
    WHERE organizationId = ${organizationId}
    ORDER BY createdAt DESC
  `);

  addSheet(workbook, "민간자격증", privateCertificates, [
    "이름",
    "연락처",
    "자격증명",
    "요청상태",
    "결제상태",
    "결제금액",
    "프리랜서입력금액",
    "결제일",
    "담당자명",
    "첨부파일명",
    "첨부파일URL",
    "생성일",
    "수정일",
  ]);

  const settlement = await queryRows(sql`
  SELECT
    si.revenueType AS 매출유형,
    si.title AS 제목,
    COALESCE(s.clientName, '') AS 학생명,
    si.institutionName AS 교육원,
    si.subjectType AS 과목유형,
    si.subjectCount AS 과목수,
    si.quantity AS 수량,
    si.occurredAt AS 발생일,
    si.grossAmount AS 총매출,
    si.companyAmount AS 회사몫,
    si.freelancerAmount AS 프리랜서금액,
    si.taxAmount AS 세금,
    si.finalPayoutAmount AS 최종지급액,
    si.companyProfit AS 회사순이익,
    si.settlementStatus AS 정산상태,
    si.note AS 메모,
    si.createdAt AS 생성일,
    si.updatedAt AS 수정일
  FROM settlement_items si
  LEFT JOIN students s
    ON s.id = si.studentId
   AND s.organizationId = si.organizationId
  WHERE si.organizationId = ${organizationId}
  ORDER BY si.occurredAt DESC, si.createdAt DESC
`);

  addSheet(workbook, "정산내역", settlement, [
    "매출유형",
    "제목",
    "학생명",
    "교육원",
    "과목유형",
    "과목수",
    "수량",
    "발생일",
    "총매출",
    "회사몫",
    "프리랜서금액",
    "세금",
    "최종지급액",
    "회사순이익",
    "정산상태",
    "메모",
    "생성일",
    "수정일",
  ]);

  const users = await queryRows(sql`
    SELECT
      username AS 아이디,
      name AS 이름,
      email AS 이메일,
      phone AS 연락처,
      role AS 권한,
      isActive AS 활성상태,
      displayNo AS 표시번호,
      lastSignedIn AS 마지막로그인,
      createdAt AS 생성일,
      updatedAt AS 수정일
    FROM users
    WHERE organizationId = ${organizationId}
    ORDER BY displayNo ASC, createdAt ASC
  `);

  addSheet(workbook, "직원목록", users, [
    "아이디",
    "이름",
    "이메일",
    "연락처",
    "권한",
    "활성상태",
    "표시번호",
    "마지막로그인",
    "생성일",
    "수정일",
  ]);

  const buffer = await workbook.xlsx.writeBuffer();

  const slug = sanitizeFilePart(organization.slug || organization.id);
  const stamp = createdAt
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "_")
    .replace("Z", "");

  return {
    fileName: `educanvas-company-export_${slug}_${stamp}.xlsx`,
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    base64: Buffer.from(buffer).toString("base64"),
  };
}