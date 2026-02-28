// Helper: builds the Monthly Summary section (rows 4+) on the main worksheet
// Called from CallLogReporting exportPeriodExcel after the title/period/generated rows are added.
import { minutesToHHMMSS, secondsToHHMMSS, formatDate, parseWeekDate, autoFitColumns } from "./ExcelExportHelpers";

export function buildMonthlySummarySection(ws, {
  periodLabel, totalCalls, totalInbound, totalOutbound, totalInboundAnswered,
  totalMissed, totalDurationSec, overallAvgDurationSec,
  mkFill, mkFont, thinBorder, addSectionHeader, styleTableHeader, arColor,
  DARK_NAVY, ALT_ROW, WHITE, LIGHT_GRAY,
  weekRows, userWeekRows, formatDateFn, minutesToHHMMSSFn, secondsToHHMMSSFn,
}) {
  // Section header
  addSectionHeader(ws, "Monthly Summary", 4);

  // Clarity note (informational only — no effect on calculations)
  const summaryNoteRow = ws.addRow([
    `Totals on this worksheet reflect operational call log activity. For inbound-only telecom validation from Vonage CDR, see the "Inbound CDR" worksheet.`,
    "", "", "", "", ""
  ]);
  ws.mergeCells(`A${ws.rowCount}:F${ws.rowCount}`);
  const summaryNoteCell = ws.getCell(`A${ws.rowCount}`);
  summaryNoteCell.font      = mkFont({ italic: true, size: 9, color: { argb: "FFAAAAAA" } });
  summaryNoteCell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
  summaryNoteRow.height = 24;

  // Metric rows
  const metrics = [
    ["Total Calls",         totalCalls,                                                                        "number"],
    ["Inbound",             totalInbound,                                                                      "number"],
    ["Outbound",            totalOutbound,                                                                     "number"],
    ["Inbound Answered",    totalInboundAnswered,                                                              "number"],
    ["Missed",              totalMissed,                                                                       "number"],
    ["Inbound Answer Rate", totalInbound > 0 ? Math.min(totalInboundAnswered, totalInbound) / totalInbound : "", "percent"],
    ["Total Duration",      secondsToHHMMSS(totalDurationSec),                                                "text"],
    ["Average Duration",    secondsToHHMMSS(overallAvgDurationSec),                                          "text"],
  ];
  metrics.forEach(([label, val, type], idx) => {
    const bgArgb = idx % 2 === 0 ? ALT_ROW : WHITE;
    const row = ws.addRow([label, val]);
    row.height = 18;
    const lc = row.getCell(1);
    const vc = row.getCell(2);
    lc.font  = mkFont({ bold: true });
    lc.fill  = mkFill(bgArgb);
    lc.alignment = { horizontal: "left", vertical: "middle" };
    vc.font  = mkFont({ bold: true, size: 12 });
    vc.fill  = mkFill(bgArgb);
    vc.alignment = { horizontal: "right", vertical: "middle" };
    if (type === "number")  vc.numFmt = "#,##0";
    if (type === "percent") vc.numFmt = "0.00%";
    [lc, vc].forEach(c => { c.border = { bottom: thinBorder }; });
  });
}