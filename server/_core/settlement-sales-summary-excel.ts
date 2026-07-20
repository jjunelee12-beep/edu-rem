import ExcelJS from "exceljs";

function toNumber(value: any) {
  return (
    Number(
      String(value ?? "0")
        .replace(/,/g, "")
        .trim()
    ) || 0
  );
}

function setThinBorder(cell: ExcelJS.Cell) {
  cell.border = {
    top: {
      style: "thin",
      color: { argb: "FFD9D9D9" },
    },
    left: {
      style: "thin",
      color: { argb: "FFD9D9D9" },
    },
    bottom: {
      style: "thin",
      color: { argb: "FFD9D9D9" },
    },
    right: {
      style: "thin",
      color: { argb: "FFD9D9D9" },
    },
  };
}

function styleMainHeader(cell: ExcelJS.Cell) {
  cell.font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
  };

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF548235" },
  };

  cell.alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  setThinBorder(cell);
}

function styleSummaryTitle(cell: ExcelJS.Cell) {
  cell.font = {
    bold: true,
    color: { argb: "FFFFFFFF" },
    size: 13,
  };

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF70AD47" },
  };

  cell.alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  setThinBorder(cell);
}

function styleSummaryLabel(cell: ExcelJS.Cell) {
  cell.font = {
    bold: true,
    color: { argb: "FF000000" },
  };

  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2F0D9" },
  };

  cell.alignment = {
    horizontal: "left",
    vertical: "middle",
  };

  setThinBorder(cell);
}

function styleSummaryValue(cell: ExcelJS.Cell) {
  cell.alignment = {
    horizontal: "right",
    vertical: "middle",
  };

  cell.numFmt = '#,##0"원"';
  setThinBorder(cell);
}

function styleDataCell(
  cell: ExcelJS.Cell,
  alignment: "left" | "center" | "right" = "left"
) {
  cell.alignment = {
    horizontal: alignment,
    vertical: "middle",
  };

  setThinBorder(cell);
}

export async function buildSettlementSalesSummaryExcel(params: {
  year: number;
  month: number;
  assigneeName: string;
  entries: any[];
}) {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "EduCanvas CRM";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("매출 결산");

  sheet.properties.defaultRowHeight = 22;

  sheet.views = [
    {
      state: "frozen",
      ySplit: 4,
    },
  ];

  sheet.columns = [
    { key: "institutionName", width: 20 },
    { key: "clientName", width: 15 },
    { key: "studentLoginId", width: 18 },
    { key: "unitAmount", width: 16 },
    { key: "subjectCount", width: 13 },
    { key: "grossAmount", width: 17 },
    { key: "customerType", width: 13 },
    { width: 4 },
    { width: 4 },
    { width: 19 },
    { width: 21 },
  ];

  // 상단 제목
  sheet.mergeCells("A1:G1");

  const titleCell = sheet.getCell("A1");
  titleCell.value = `${params.month}월 매출 결산 파일`;
  titleCell.font = {
    bold: true,
    size: 16,
    color: { argb: "FFFFFFFF" },
  };
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF548235" },
  };
  titleCell.alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  sheet.getRow(1).height = 30;

  sheet.mergeCells("A2:G2");

  const descriptionCell = sheet.getCell("A2");
  descriptionCell.value =
    "이번 달에 입금 완료된 고객만 작성해 주세요.";
  descriptionCell.font = {
    bold: true,
    color: { argb: "FF375623" },
  };
  descriptionCell.alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  // 표 헤더
  const headerRow = sheet.getRow(4);

  const headers = [
    "교육원",
    "고객명",
    "아이디",
    "과목당 금액",
    "과목 개수",
    "총 결제 금액",
    "신규 / 기존",
  ];

  headers.forEach((label, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = label;
    styleMainHeader(cell);
  });

  headerRow.height = 25;

  // 자동 집계
  sheet.mergeCells("J1:K1");
  sheet.getCell("J1").value = "자동 집계";
  styleSummaryTitle(sheet.getCell("J1"));

  const summaryLabels = [
    "전체 결제 금액",
    "신규 결제 금액",
    "기존 결제 금액",
    "입금 고객 수",
    "평균 과목당 금액",
  ];

  summaryLabels.forEach((label, index) => {
    const rowNumber = index + 2;

    const labelCell = sheet.getCell(`J${rowNumber}`);
    labelCell.value = label;
    styleSummaryLabel(labelCell);

    const valueCell = sheet.getCell(`K${rowNumber}`);
    styleSummaryValue(valueCell);
  });

  const subjectEntries = (params.entries || []).filter(
    (row: any) =>
      String(row.revenueType || "") === "subject" &&
      String(row.settlementStatus || "") === "confirmed"
  );

  const firstDataRow = 5;
  let currentRow = firstDataRow;

  for (const entry of subjectEntries) {
    const grossAmount = toNumber(entry.grossAmount);
    const subjectCount = toNumber(entry.subjectCount);

    const unitAmount =
      subjectCount > 0
        ? Math.round(grossAmount / subjectCount)
        : 0;

    const row = sheet.getRow(currentRow);

    row.getCell(1).value =
      String(entry.institutionName || "").trim();

    row.getCell(2).value =
      String(entry.clientName || "").trim();

    row.getCell(3).value =
      String(entry.studentLoginId || "").trim();

    row.getCell(4).value = unitAmount;
    row.getCell(5).value = subjectCount;
    row.getCell(6).value = grossAmount;

    row.getCell(7).value =
      entry.customerTypeLabel ||
      (entry.customerType === "new" ? "신규" : "기존");

    styleDataCell(row.getCell(1));
    styleDataCell(row.getCell(2));
    styleDataCell(row.getCell(3), "center");
    styleDataCell(row.getCell(4), "right");
    styleDataCell(row.getCell(5), "center");
    styleDataCell(row.getCell(6), "right");
    styleDataCell(row.getCell(7), "center");

    row.getCell(4).numFmt = '#,##0"원"';
    row.getCell(5).numFmt = '0"개"';
    row.getCell(6).numFmt = '#,##0"원"';

    currentRow += 1;
  }

  // 데이터가 없어도 집계 수식 범위는 유효하도록 설정
  const lastDataRow = Math.max(currentRow - 1, firstDataRow);

  sheet.getCell("K2").value = {
    formula: `SUM(F${firstDataRow}:F${lastDataRow})`,
    result: subjectEntries.reduce(
      (sum: number, row: any) =>
        sum + toNumber(row.grossAmount),
      0
    ),
  };

  sheet.getCell("K3").value = {
    formula:
      `SUMIF(G${firstDataRow}:G${lastDataRow},"신규",` +
      `F${firstDataRow}:F${lastDataRow})`,
    result: subjectEntries
      .filter(
        (row: any) =>
          String(
            row.customerTypeLabel ||
              (row.customerType === "new" ? "신규" : "기존")
          ) === "신규"
      )
      .reduce(
        (sum: number, row: any) =>
          sum + toNumber(row.grossAmount),
        0
      ),
  };

  sheet.getCell("K4").value = {
    formula:
      `SUMIF(G${firstDataRow}:G${lastDataRow},"기존",` +
      `F${firstDataRow}:F${lastDataRow})`,
    result: subjectEntries
      .filter(
        (row: any) =>
          String(
            row.customerTypeLabel ||
              (row.customerType === "new" ? "신규" : "기존")
          ) === "기존"
      )
      .reduce(
        (sum: number, row: any) =>
          sum + toNumber(row.grossAmount),
        0
      ),
  };

  sheet.getCell("K5").value = {
    formula: `COUNTIF(B${firstDataRow}:B${lastDataRow},"<>")`,
    result: subjectEntries.filter(
      (row: any) =>
        String(row.clientName || "").trim()
    ).length,
  };

  const totalSubjectCount = subjectEntries.reduce(
    (sum: number, row: any) =>
      sum + toNumber(row.subjectCount),
    0
  );

  const totalGrossAmount = subjectEntries.reduce(
    (sum: number, row: any) =>
      sum + toNumber(row.grossAmount),
    0
  );

  sheet.getCell("K6").value = {
    formula:
      `IFERROR(SUM(F${firstDataRow}:F${lastDataRow})/` +
      `SUM(E${firstDataRow}:E${lastDataRow}),0)`,
    result:
      totalSubjectCount > 0
        ? Math.round(totalGrossAmount / totalSubjectCount)
        : 0,
  };

  // 최소한 빈 입력 행도 보이게 유지
  const minimumVisibleRow = Math.max(lastDataRow, 35);

  for (
    let rowNumber = firstDataRow;
    rowNumber <= minimumVisibleRow;
    rowNumber++
  ) {
    for (let column = 1; column <= 7; column++) {
      const cell = sheet.getRow(rowNumber).getCell(column);

      if (!cell.border) {
        setThinBorder(cell);
      }
    }
  }

  sheet.autoFilter = {
    from: "A4",
    to: `G${lastDataRow}`,
  };

  const safeAssigneeName =
    String(params.assigneeName || "담당자")
      .trim()
      .replace(/[\\/:*?"<>|]/g, "_");

  const fileName =
    `매출결산_${safeAssigneeName}_` +
    `${params.year}년${params.month}월.xlsx`;

  const buffer = await workbook.xlsx.writeBuffer();

  return {
    fileName,
    buffer,
    rowCount: subjectEntries.length,
  };
}