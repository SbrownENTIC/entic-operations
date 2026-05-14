/**
 * ExcelMonthlySummary.jsx
 * Builds the "Monthly Summary" worksheet — the first and primary visible sheet.
 * Uses live Excel formulas for key metrics wherever possible so values auto-update
 * if data in the Raw_Imported_Data table is refreshed.
 */
import { formatDate, minutesToHHMMSS, secondsToHHMMSS } from "./ExcelExportHelpers";
import { calcInboundAnswerRate } from "./ExcelCallLogCalcs";

export function buildMonthlySummarySheet(wb, {
  periodLabel, generatedOn,
  totalCalls, totalInbound, totalOutbound,
  totalInboundAnswered, totalMissed, totalDurationSec, overallAvgDurationSec,
  weekRows,
  mkFill, mkFont, thinBorder,
  DARK_NAVY, SECTION_BG, ALT_ROW, WHITE, LIGHT_GRAY, HEADER_BG,
  addSectionHeader, styleTableHeader, arColor,
}) {
  const ws = wb.addWorksheet("Monthly Summary", { views: [{ showGridLines: false }] });

  ws.columns = [
    { width: 32 }, { width: 18 }, { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 }, { width: 14 }, { width: 22 }, { width: 18 }, { width: 24 },
  ];

  // ── Title ─────────────────────────────────────────────────────────────────
  ws.addRow([`${periodLabel} – Call Performance Report`, ...Array(9).fill("")]);
  ws.mergeCells("A1:J1");
  const titleCell = ws.getCell("A1");
  titleCell.font      = mkFont({ bold: true, size: 17, color: { argb: "FFFFFFFF" } });
  titleCell.fill      = mkFill(DARK_NAVY);
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 44;

  ws.addRow([`Reporting Period: ${periodLabel}`, "", "", `Generated: ${generatedOn}`, ...Array(6).fill("")]);
  ws.getCell("A2").font = mkFont({ bold: true, size: 11 });
  ws.getCell("D2").font = mkFont({ color: { argb: "FF666666" }, size: 10 });
  ws.getRow(2).height = 20;

  // ── Benchmark scope note ──────────────────────────────────────────────────
  ws.addRow(["⚠ Benchmark Metrics Calculated Using In-Benchmark Extensions Only", ...Array(9).fill("")]);
  ws.mergeCells("A3:J3");
  const benchNote = ws.getCell("A3");
  benchNote.font      = mkFont({ bold: true, size: 10, color: { argb: "FF1F3864" } });
  benchNote.fill      = mkFill("FFDCE6F1");
  benchNote.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(3).height = 20;

  // ── Clarifying note ───────────────────────────────────────────────────────
  ws.addRow([
    "Totals on this sheet reflect in-benchmark users only. Fax, voicemail, clinical, and admin lines are excluded. For CDR validation, see 'Inbound CDR'.",
    ...Array(9).fill(""),
  ]);
  ws.mergeCells(`A4:J4`);
  const noteCell = ws.getCell("A4");
  noteCell.font      = mkFont({ italic: true, size: 9, color: { argb: "FFAAAAAA" } });
  noteCell.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(4).height = 18;

  ws.addRow([]); ws.getRow(5).height = 6;

  // ── Section: Monthly KPI Summary (formula-driven where available) ─────────
  addSectionHeader(ws, "Monthly KPI Summary", 4);

  // Note row: answer rate formula explanation
  ws.addRow(["ℹ Answer Rate = Answered Inbound Calls ÷ Total Inbound Calls", ...Array(9).fill("")]);
  ws.mergeCells(`A${ws.rowCount}:J${ws.rowCount}`);
  const arNote = ws.getCell(`A${ws.rowCount}`);
  arNote.font      = mkFont({ italic: true, size: 9, color: { argb: "FF1F3864" } });
  arNote.fill      = mkFill("FFEEF2FA");
  arNote.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(ws.rowCount).height = 16;

  const metrics = [
    ["Total Calls",         totalCalls,           "number"],
    ["Inbound",             totalInbound,          "number"],
    ["Outbound",            totalOutbound,         "number"],
    ["Inbound Answered",    totalInboundAnswered,  "number"],
    ["Missed",              totalMissed,           "number"],
    ["Inbound Answer Rate", null,                  "percent_formula"],
    ["Total Duration",      secondsToHHMMSS(totalDurationSec),      "text"],
    ["Average Duration",    secondsToHHMMSS(overallAvgDurationSec), "text"],
  ];

  // Track row numbers for Inbound (B col) and Inbound Answered so we can write a formula
  let inboundKpiRow = null;
  let answeredKpiRow = null;

  metrics.forEach(([label, val, type], idx) => {
    const bgArgb = idx % 2 === 0 ? ALT_ROW : WHITE;
    const row = ws.addRow([label, val]);
    row.height = 19;
    const lc = row.getCell(1);
    const vc = row.getCell(2);
    lc.font = mkFont({ bold: true }); lc.fill = mkFill(bgArgb); lc.alignment = { horizontal: "center", vertical: "middle" };
    vc.font = mkFont({ bold: true, size: 12 }); vc.fill = mkFill(bgArgb); vc.alignment = { horizontal: "center", vertical: "middle" };
    if (label === "Inbound")         inboundKpiRow  = ws.rowCount;
    if (label === "Inbound Answered") answeredKpiRow = ws.rowCount;
    if (type === "number")  vc.numFmt = "#,##0";
    if (type === "percent_formula") {
      // Write Excel formula: =IF(B{inbound}=0,0,MIN(B{answered}/B{inbound},1))
      const inbRef  = inboundKpiRow  ? `B${inboundKpiRow}`  : "0";
      const ansRef  = answeredKpiRow ? `B${answeredKpiRow}` : "0";
      vc.value  = { formula: `=IF(${inbRef}=0,0,MIN(${ansRef}/${inbRef},1))`, result: totalInbound > 0 ? Math.min(totalInboundAnswered / totalInbound, 1) : 0 };
      vc.numFmt = "0.00%";
      vc.font   = mkFont({ bold: true, size: 12 });
    }
    [lc, vc].forEach(c => { c.border = { bottom: thinBorder }; });
  });

  // Freeze panes just below the KPI block header row
  ws.views = [{ showGridLines: false, state: "frozen", ySplit: 7, xSplit: 0 }];

  ws.addRow([]); ws.getRow(ws.rowCount).height = 8;

  // ── Section: Weekly Summary Table ─────────────────────────────────────────
  addSectionHeader(ws, "Weekly Summary", 9);

  const weekHRow = ws.addRow([
    "Week Start", "Week End", "Total Calls", "Inbound", "Outbound",
    "Answered", "Missed", "Answer Rate", "Total Duration",
  ]);
  styleTableHeader(weekHRow, 9);

  const weekTableStartRow = ws.rowCount + 1;
  const weekTableDataRows = [];

  if (weekRows.length === 0) {
    const er = ws.addRow(["No weekly data found for this month.", ...Array(8).fill("")]);
    ws.mergeCells(`A${ws.rowCount}:I${ws.rowCount}`);
    er.getCell(1).font = mkFont({ italic: true, color: { argb: "FF888888" } });
    er.height = 18;
  } else {
    weekRows.forEach((wk, idx) => {
      const ar       = wk.answer_rate;
      const { bg, fg } = arColor(ar);
      const bgArgb   = idx % 2 === 0 ? WHITE : LIGHT_GRAY;
      // Columns: A=Week Start, B=Week End, C=Total Calls, D=Inbound, E=Outbound, F=Answered, G=Missed, H=Answer Rate, I=Total Duration
      const dataRowNum = weekTableStartRow + idx; // header is at weekTableStartRow-1, data starts at weekTableStartRow
      const rowValues = [
        formatDate(wk.week_start), formatDate(wk.week_end),
        wk.total_calls, wk.inbound, wk.outbound,
        wk.answered, wk.missed,
        { formula: `=IF(D${dataRowNum}=0,0,MIN(F${dataRowNum}/D${dataRowNum},1))`, result: ar !== null ? ar : 0 },
        minutesToHHMMSS(wk.total_duration_minutes),
      ];
      const row = ws.addRow(rowValues);
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.fill = mkFill(bgArgb); cell.font = mkFont({}); cell.border = { bottom: thinBorder, right: thinBorder };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        if ([3, 4, 5, 6, 7].includes(colNum)) cell.numFmt = "#,##0";
        if (colNum === 8) {
          cell.numFmt = "0.00%";
          if (ar !== null) { cell.fill = mkFill(bg); cell.font = mkFont({ color: { argb: fg } }); }
        }
      });
      weekTableDataRows.push(rowValues);
    });
  }

  if (weekTableDataRows.length > 0) {
    const dataFirstRow = weekTableStartRow;
    const dataLastRow  = weekTableStartRow + weekTableDataRows.length - 1;
    const totalsRowNum = dataLastRow + 2; // +1 for header already counted, +1 for totals

    ws.addTable({
      name: "WeeklySummary",
      ref: `A${weekTableStartRow - 1}:I${dataLastRow}`,
      headerRow: true,
      totalsRow: true,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: [
        { name: "Week Start",     filterButton: true, totalsRowLabel: "MONTHLY TOTAL" },
        { name: "Week End",       filterButton: true, totalsRowLabel: "" },
        { name: "Total Calls",    filterButton: true, totalsRowFunction: "sum" },
        { name: "Inbound",        filterButton: true, totalsRowFunction: "sum" },
        { name: "Outbound",       filterButton: true, totalsRowFunction: "sum" },
        { name: "Answered",       filterButton: true, totalsRowFunction: "sum" },
        { name: "Missed",         filterButton: true, totalsRowFunction: "sum" },
        { name: "Answer Rate",    filterButton: true, totalsRowLabel: "" },
        { name: "Total Duration", filterButton: true, totalsRowLabel: "" },
      ],
      rows: weekTableDataRows,
    });

    // Override Answer Rate totals cell with a real formula: SUM(answered)/SUM(inbound)
    const totalsRow = ws.getRow(dataLastRow + 2);
    totalsRow.height = 20;
    totalsRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = mkFont({ bold: true, color: { argb: "FFFFFFFF" } });
      cell.fill = mkFill(DARK_NAVY);
      cell.alignment = { horizontal: colNum <= 2 ? "left" : "center", vertical: "middle" };
      if ([3, 4, 5, 6, 7].includes(colNum)) cell.numFmt = "#,##0";
      if (colNum === 8) {
        // =IF(SUM(D_first:D_last)=0,0,MIN(SUM(F_first:F_last)/SUM(D_first:D_last),1))
        cell.value  = { formula: `=IF(SUM(D${dataFirstRow}:D${dataLastRow})=0,0,MIN(SUM(F${dataFirstRow}:F${dataLastRow})/SUM(D${dataFirstRow}:D${dataLastRow}),1))`, result: 0 };
        cell.numFmt = "0.00%";
      }
    });
  }

  ws.addRow([]); ws.getRow(ws.rowCount).height = 8;

  // ── Section: User Breakdown (all weeks) ───────────────────────────────────
  addSectionHeader(ws, "Full User Breakdown (All Weeks)", 10);
  const instrHint = ws.addRow(["Filter by Week Start using the dropdown in the table header.", ...Array(9).fill("")]);
  ws.mergeCells(`A${ws.rowCount}:J${ws.rowCount}`);
  instrHint.height = 16;
  instrHint.getCell(1).font      = mkFont({ italic: true, size: 9, color: { argb: "FFAAAAAA" } });
  instrHint.getCell(1).alignment = { horizontal: "left", vertical: "middle" };

  return ws;
}