import ExcelJS from "exceljs";

function toWon(value: any) {
  return Number(value || 0);
}

function wonFormat(value: any) {
  return `${toWon(value).toLocaleString()}원`;
}

function dateText(value: any) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ko-KR");
}

function revenueTypeLabel(type: string, status?: string) {
  if (status === "refunded") return "환불";
  if (type === "subject") return "일반과목";
  if (type === "private_certificate") return "민간자격증";
  if (type === "practice_support") return "실습배정";
  return type || "-";
}

function setThinBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: { style: "thin", color: { argb: "FFD1D5DB" } },
    left: { style: "thin", color: { argb: "FFD1D5DB" } },
    bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    right: { style: "thin", color: { argb: "FFD1D5DB" } },
  };
}

function styleLabelCell(cell: ExcelJS.Cell) {
  cell.font = { bold: true };
  cell.alignment = { vertical: "middle", horizontal: "center" };
  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFF8FAFC" },
  };
  setThinBorder(cell);
}

function styleValueCell(cell: ExcelJS.Cell, align: "left" | "center" | "right" = "left") {
  cell.alignment = { vertical: "middle", horizontal: align };
  setThinBorder(cell);
}

export async function buildSettlementPayslipExcel(payslipData: any) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("수당명세서");

  sheet.properties.defaultRowHeight = 24;
  sheet.views = [{ state: "frozen", ySplit: 0 }];

  sheet.columns = [
    { width: 16 },
    { width: 18 },
    { width: 16 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 14 },
  ];

  let row = 1;

  // 제목
  sheet.mergeCells(`A${row}:I${row}`);
  sheet.getCell(`A${row}`).value = "수당 명세서";
  sheet.getCell(`A${row}`).font = { bold: true, size: 18 };
  sheet.getCell(`A${row}`).alignment = { horizontal: "center", vertical: "middle" };
  row++;

  sheet.mergeCells(`A${row}:I${row}`);
  sheet.getCell(`A${row}`).value = `${payslipData.year}년 ${payslipData.month}월`;
  sheet.getCell(`A${row}`).font = { size: 11, color: { argb: "FF6B7280" } };
  sheet.getCell(`A${row}`).alignment = { horizontal: "center", vertical: "middle" };
  row += 2;

   // 기본 정보
  const companyName = payslipData.companyName || "-";
  const paymentDate = payslipData.paymentDate
    ? dateText(payslipData.paymentDate)
    : "-";
  const bankName = payslipData.bankName || "-";
  const bankAccount = payslipData.bankAccount || "-";

  sheet.getCell(`A${row}`).value = "회사명";
  styleLabelCell(sheet.getCell(`A${row}`));
  sheet.getCell(`B${row}`).value = companyName;
  styleValueCell(sheet.getCell(`B${row}`));

  sheet.getCell(`C${row}`).value = "성명";
  styleLabelCell(sheet.getCell(`C${row}`));
  sheet.getCell(`D${row}`).value = payslipData.assigneeName || "-";
  styleValueCell(sheet.getCell(`D${row}`));

  sheet.getCell(`E${row}`).value = "직급";
  styleLabelCell(sheet.getCell(`E${row}`));
  sheet.getCell(`F${row}`).value = payslipData.positionName || "-";
  styleValueCell(sheet.getCell(`F${row}`));

  sheet.getCell(`G${row}`).value = "지급일";
  styleLabelCell(sheet.getCell(`G${row}`));
  sheet.getCell(`H${row}`).value = paymentDate;
  styleValueCell(sheet.getCell(`H${row}`));
  setThinBorder(sheet.getCell(`I${row}`));
  row++;

  sheet.getCell(`A${row}`).value = "소속";
  styleLabelCell(sheet.getCell(`A${row}`));
  sheet.getCell(`B${row}`).value = payslipData.teamName || "-";
  styleValueCell(sheet.getCell(`B${row}`));

  sheet.getCell(`C${row}`).value = "부서";
  styleLabelCell(sheet.getCell(`C${row}`));
  sheet.getCell(`D${row}`).value = "-";
  styleValueCell(sheet.getCell(`D${row}`));

  sheet.getCell(`E${row}`).value = "은행명";
  styleLabelCell(sheet.getCell(`E${row}`));
  sheet.getCell(`F${row}`).value = bankName;
  styleValueCell(sheet.getCell(`F${row}`));

  sheet.getCell(`G${row}`).value = "계좌번호";
  styleLabelCell(sheet.getCell(`G${row}`));
  sheet.getCell(`H${row}`).value = bankAccount;
  styleValueCell(sheet.getCell(`H${row}`));
  setThinBorder(sheet.getCell(`I${row}`));
  row += 2;

  // 합계
  sheet.mergeCells(`A${row}:I${row}`);
  sheet.getCell(`A${row}`).value = "1. 수당 지급액";
  sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  row++;

  const summaryRows = [
    ["지급액 합계", wonFormat(payslipData.summary?.totalGrossAmount)],
    ["공제합계", wonFormat(payslipData.summary?.totalDeductionAmount)],
    ["수령액", wonFormat(payslipData.summary?.totalReceivableAmount)],
    ["세후 실수령액", wonFormat(payslipData.summary?.totalNetPayoutAmount)],
  ];

  for (const [label, value] of summaryRows) {
    sheet.getCell(`A${row}`).value = label;
    styleLabelCell(sheet.getCell(`A${row}`));
    sheet.mergeCells(`B${row}:D${row}`);
    sheet.getCell(`B${row}`).value = value;
    styleValueCell(sheet.getCell(`B${row}`), "right");

    sheet.getCell(`E${row}`).value = "";
    setThinBorder(sheet.getCell(`E${row}`));
    sheet.getCell(`F${row}`).value = "";
    setThinBorder(sheet.getCell(`F${row}`));
    sheet.getCell(`G${row}`).value = "";
    setThinBorder(sheet.getCell(`G${row}`));
    sheet.getCell(`H${row}`).value = "";
    setThinBorder(sheet.getCell(`H${row}`));
    sheet.getCell(`I${row}`).value = "";
    setThinBorder(sheet.getCell(`I${row}`));
    row++;
  }

  row++;

  // 지급/공제 항목
  sheet.mergeCells(`A${row}:D${row}`);
  sheet.getCell(`A${row}`).value = "2. 지급 항목";
  sheet.getCell(`A${row}`).font = { bold: true, size: 12 };

  sheet.mergeCells(`F${row}:I${row}`);
  sheet.getCell(`F${row}`).value = "3. 공제 항목";
  sheet.getCell(`F${row}`).font = { bold: true, size: 12 };
  row++;

  const paymentItems = [
    ["교육훈련비", payslipData.paymentItems?.educationSupportAmount || 0],
    ["학점수당", payslipData.paymentItems?.subjectAllowanceAmount || 0],
    ["민간수당", payslipData.paymentItems?.privateCertificateAllowanceAmount || 0],
    ["실습수당", payslipData.paymentItems?.practiceSupportAllowanceAmount || 0],
  ];

  const deductionItems = [
    ["환불공제", payslipData.deductionItems?.refundDeductionAmount || 0],
    ["적립금(학점)", payslipData.deductionItems?.taxDeductionAmount || 0],
    ["협약비", payslipData.deductionItems?.contractDeductionAmount || 0],
    ["기타공제", 0],
  ];

  const maxLen = Math.max(paymentItems.length, deductionItems.length);

  for (let i = 0; i < maxLen; i++) {
    const left = paymentItems[i] || ["", ""];
    const right = deductionItems[i] || ["", ""];

    sheet.getCell(`A${row}`).value = left[0];
    styleLabelCell(sheet.getCell(`A${row}`));
    sheet.mergeCells(`B${row}:D${row}`);
    sheet.getCell(`B${row}`).value = wonFormat(left[1]);
    styleValueCell(sheet.getCell(`B${row}`), "right");

    sheet.getCell(`F${row}`).value = right[0];
    styleLabelCell(sheet.getCell(`F${row}`));
    sheet.mergeCells(`G${row}:I${row}`);
    sheet.getCell(`G${row}`).value = wonFormat(right[1]);
    styleValueCell(sheet.getCell(`G${row}`), "right");

    row++;
  }

  row++;

  // 상세 내역 제목
  sheet.mergeCells(`A${row}:I${row}`);
  sheet.getCell(`A${row}`).value = "4. 상세 지급 내역";
  sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
  row++;

  const detailHeader = [
    "일자",
    "유형",
    "학생명",
    "제목",
    "총매출",
    "지급액",
    "세금",
    "실지급액",
    "상태",
  ];

  detailHeader.forEach((label, idx) => {
    const cell = sheet.getRow(row).getCell(idx + 1);
    cell.value = label;
    styleLabelCell(cell);
  });
  row++;

  const entries = payslipData.entries || [];

  if (entries.length === 0) {
    sheet.mergeCells(`A${row}:I${row}`);
    sheet.getCell(`A${row}`).value = "상세 지급 내역이 없습니다.";
    sheet.getCell(`A${row}`).alignment = { horizontal: "center", vertical: "middle" };
    setThinBorder(sheet.getCell(`A${row}`));
    row++;
  } else {
    for (const item of entries) {
      const values = [
        dateText(item.occurredAt),
        revenueTypeLabel(item.revenueType, item.settlementStatus),
        item.clientName || "-",
        item.title || "-",
        wonFormat(item.grossAmount),
        wonFormat(item.freelancerAmount),
        wonFormat(item.taxAmount),
        wonFormat(item.finalPayoutAmount),
        item.settlementStatus || "-",
      ];

      values.forEach((value, idx) => {
        const cell = sheet.getRow(row).getCell(idx + 1);
        cell.value = value;
        styleValueCell(
          cell,
          idx >= 4 && idx <= 7 ? "right" : idx === 8 ? "center" : "left"
        );
      });

      row++;
    }
  }

  row += 1;

  sheet.mergeCells(`A${row}:I${row}`);
  sheet.getCell(`A${row}`).value = "한 달 동안 수고하셨습니다.";
  sheet.getCell(`A${row}`).font = { italic: true, color: { argb: "FF6B7280" } };
  sheet.getCell(`A${row}`).alignment = { horizontal: "center", vertical: "middle" };

  const fileName = `수당명세서_${payslipData.assigneeName || "담당자"}_${payslipData.year}년${payslipData.month}월.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();

  return {
    fileName,
    buffer,
  };
}