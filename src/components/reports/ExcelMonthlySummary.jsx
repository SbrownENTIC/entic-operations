/**
 * ExcelMonthlySummary.jsx
 *
 * Builds the "Monthly Summary" worksheet with TWO DISTINCT REPORTING SECTIONS:
 *
 *  SECTION A — EXECUTIVE / OPERATIONAL KPIs
 *    Source: CDR data (preferred) or User Summary fallback with disclaimer
 *    Metrics: Unique inbound calls, answered, abandoned, answer rate, avg talk time
 *    Definition: A "missed" call = caller abandoned without reaching ANY live staff
 *
 *  SECTION B — USER ACTIVITY METRICS
 *    Source: User Summary (Vonage pre-aggregated export) — benchmark users only
 *    Metrics: Total calls, inbound, outbound, answered, missed, duration per user
 *    NOTE: Missed Calls here may include hunt-group routing ring attempts.
 *          These are extension-level activity counts, not unique patient calls.
 *
 *  SECTION C — WEEKLY SUMMARY TABLE
 *    Source: Same User Summary benchmark data (consistent with Section B)
 *    Monthly totals = SUM of all weekly rows (single source of truth)
 */

import { formatDate, minutesToHHMMSS, secondsToHHMMSS } from "./ExcelExportHelpers";
import { calcInboundAnswerRate } from "./ExcelCallLogCalcs";

export function buildMonthlySummarySheet(wb, {
  periodLabel, generatedOn,
  // Section B / Weekly Summary — User Summary benchmark totals
  totalCalls, totalInbound, totalOutbound,
  totalInboundAnswered, totalMissed, totalDurationSec, overallAvgDurationSec,
  // Section A — CDR operational KPIs (optional, null when CDR not uploaded)
  cdrKpis,
  weekRows,
  mkFill, mkFont, thinBorder,
  DARK_NAVY, SECTION_BG, ALT_ROW, WHITE, LIGHT_GRAY, HEADER_BG,
  addSectionHeader, styleTableHeader, arColor,
}) {
  const ws = wb.addWorksheet("Monthly Summary", { views: [{ showGridLines: false }] });

  ws.columns = [
    { width: 34 }, { width: 18 }, { width: 14 }, { width: 14 },
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

  // ── Data source notice ───────────────────────────────────────────────────
  ws.addRow([]); ws.getRow(ws.rowCount).height = 6;

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION A — EXECUTIVE / OPERATIONAL KPIs
  // ══════════════════════════════════════════════════════════════════════════

  // Section A header with source badge
  const secARow = ws.addRow([
    "SECTION A — EXECUTIVE / OPERATIONAL KPIs", ...Array(9).fill("")
  ]);
  ws.mergeCells(`A${ws.rowCount}:J${ws.rowCount}`);
  const secACell = ws.getCell(`A${ws.rowCount}`);
  secACell.font      = mkFont({ bold: true, size: 13, color: { argb: "FFFFFFFF" } });
  secACell.fill      = mkFill("FF1F4E79");
  secACell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  secARow.height = 26;

  // CDR availability banner
  const hasCdr = !!(cdrKpis && cdrKpis.totalInbound > 0);
  const bannerArgbBg = hasCdr ? "FFC6EFCE" : "FFFFF4CE";
  const bannerArgbFg = hasCdr ? "FF276221" : "FF9C5700";
  const bannerText = hasCdr
    ? "✓ CDR DATA — Metrics below are sourced from Vonage Inbound CDR (call-level data). These represent true patient call outcomes."
    : "⚠ NO CDR UPLOADED — Metrics below are ESTIMATED from User Summary extension-level counts. Hunt-group ring attempts may inflate Missed Calls. Upload the Vonage Inbound CDR export for accurate KPIs.";

  const bannerRow = ws.addRow([bannerText, ...Array(9).fill("")]);
  ws.mergeCells(`A${ws.rowCount}:J${ws.rowCount}`);
  const bannerCell = ws.getCell(`A${ws.rowCount}`);
  bannerCell.font      = mkFont({ bold: true, size: 10, color: { argb: bannerArgbFg } });
  bannerCell.fill      = mkFill(bannerArgbBg);
  bannerCell.alignment = { horizontal: "left", vertical: "middle", indent: 1, wrapText: true };
  bannerCell.border    = { bottom: thinBorder };
  bannerRow.height = 28;

  if (!hasCdr) {
    // Additional warning note
    const warnRow = ws.addRow([
      "How to get accurate KPIs: Export the Vonage \"Inbound Calls\" (CDR) report for this period and upload it via the \"Upload CDR\" tab.",
      ...Array(9).fill("")
    ]);
    ws.mergeCells(`A${ws.rowCount}:J${ws.rowCount}`);
    const warnCell = ws.getCell(`A${ws.rowCount}`);
    warnCell.font      = mkFont({ italic: true, size: 9, color: { argb: "FF888888" } });
    warnCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    warnRow.height = 16;
  }

  // Determine values for Section A
  const secAInbound    = hasCdr ? cdrKpis.totalInbound         : totalInbound;
  const secAAnswered   = hasCdr ? cdrKpis.totalAnswered         : totalInboundAnswered;
  const secAAbandoned  = hasCdr ? cdrKpis.totalAbandoned        : totalMissed;
  const secAAnswerRate = secAInbound > 0 ? secAAnswered / secAInbound : 0;
  const secAAbandonRate = secAInbound > 0 ? secAAbandoned / secAInbound : 0;
  const secAAvgTalkSec  = hasCdr ? cdrKpis.avgTalkTimeSec       : overallAvgDurationSec;

  const secAMetrics = [
    { label: "Total Inbound Calls",         value: secAInbound,    fmt: "number",  note: hasCdr ? "CDR source" : "Est. from User Summary" },
    { label: "Calls Successfully Answered", value: secAAnswered,   fmt: "number",  note: hasCdr ? "CDR source" : "Est. (Inbound − Missed per user)" },
    { label: "Calls Abandoned / Missed",    value: secAAbandoned,  fmt: "number",  note: hasCdr ? "CDR source" : "Est. — may include routing ring attempts" },
    { label: "Answer Rate %",               value: secAAnswerRate, fmt: "percent", note: hasCdr ? "CDR source" : "Est. — inflated denominator warning" },
    { label: "Abandonment Rate %",          value: secAAbandonRate,fmt: "percent", note: hasCdr ? "CDR source" : "Est." },
    { label: "Avg Talk Time",               value: secondsToHHMMSS(secAAvgTalkSec), fmt: "text", note: hasCdr ? "CDR inbound duration" : "Est. from all calls" },
  ];

  secAMetrics.forEach(({ label, value, fmt, note }, idx) => {
    const bgArgb = idx % 2 === 0 ? "FFDCE6F1" : WHITE;
    const row = ws.addRow([label, value, "", note, ...Array(6).fill("")]);
    row.height = 22;
    const lc = row.getCell(1);
    const vc = row.getCell(2);
    const nc = row.getCell(4);
    lc.font = mkFont({ bold: true }); lc.fill = mkFill(bgArgb); lc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    vc.font = mkFont({ bold: true, size: 13 }); vc.fill = mkFill(bgArgb); vc.alignment = { horizontal: "center", vertical: "middle" };
    nc.font = mkFont({ italic: true, size: 9, color: { argb: "FF888888" } }); nc.fill = mkFill(bgArgb); nc.alignment = { horizontal: "left", vertical: "middle" };
    if (fmt === "number") vc.numFmt = "#,##0";
    if (fmt === "percent") {
      vc.numFmt = "0.00%";
      const { bg, fg } = arColor(value);
      if (!hasCdr) {
        // Gray out if estimated
        vc.fill = mkFill("FFF0F0F0");
        vc.font = mkFont({ bold: true, size: 13, color: { argb: "FFAAAAAA" } });
      } else {
        vc.fill = mkFill(bg);
        vc.font = mkFont({ bold: true, size: 13, color: { argb: fg } });
      }
    }
    for (let c = 1; c <= 10; c++) {
      const cell = row.getCell(c);
      if (!cell.fill || cell.fill.fgColor?.argb === undefined) cell.fill = mkFill(bgArgb);
      cell.border = { bottom: thinBorder };
    }
  });

  ws.addRow([]); ws.getRow(ws.rowCount).height = 8;

  // ── Freeze pane ────────────────────────────────────────────────────────────
  ws.views = [{ showGridLines: false, state: "frozen", ySplit: 10, xSplit: 0 }];

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION B — USER ACTIVITY METRICS (User Summary / Benchmark Users)
  // ══════════════════════════════════════════════════════════════════════════

  const secBRow = ws.addRow([
    "SECTION B — USER ACTIVITY METRICS (Benchmark Staff)", ...Array(9).fill("")
  ]);
  ws.mergeCells(`A${ws.rowCount}:J${ws.rowCount}`);
  const secBCell = ws.getCell(`A${ws.rowCount}`);
  secBCell.font      = mkFont({ bold: true, size: 13, color: { argb: "FFFFFFFF" } });
  secBCell.fill      = mkFill("FF2E5096");
  secBCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  secBRow.height = 26;

  // Scope note
  const scopeRow = ws.addRow([
    "Source: Vonage User Summary (pre-aggregated). Benchmark staff only. Missed Calls include hunt-group ring attempts — use for staff activity trends, not unique-call KPIs.",
    ...Array(9).fill("")
  ]);
  ws.mergeCells(`A${ws.rowCount}:J${ws.rowCount}`);
  const scopeCell = ws.getCell(`A${ws.rowCount}`);
  scopeCell.font      = mkFont({ italic: true, size: 9, color: { argb: "FF1F3864" } });
  scopeCell.fill      = mkFill("FFDCE6F1");
  scopeCell.alignment = { horizontal: "left", vertical: "middle", indent: 1, wrapText: true };
  scopeCell.border    = { bottom: thinBorder };
  scopeRow.height = 22;

  const secBMetrics = [
    ["Total Calls (All Staff)",        totalCalls,              "number"],
    ["Inbound (Extension-Level)",      totalInbound,            "number"],
    ["Outbound",                       totalOutbound,           "number"],
    ["Inbound Answered (Ext-Level)",   totalInboundAnswered,    "number"],
    ["Missed (Ext-Level — see note)",  totalMissed,             "number"],
    ["Ext-Level Answer Rate",          totalInbound > 0 ? totalInboundAnswered / totalInbound : 0, "percent_warn"],
    ["Total Talk Time",                secondsToHHMMSS(totalDurationSec),          "text"],
    ["Avg Duration per Call",          secondsToHHMMSS(overallAvgDurationSec),     "text"],
  ];

  secBMetrics.forEach(([label, val, type], idx) => {
    const bgArgb = idx % 2 === 0 ? ALT_ROW : WHITE;
    const row = ws.addRow([label, val]);
    row.height = 19;
    const lc = row.getCell(1);
    const vc = row.getCell(2);
    lc.font = mkFont({ bold: true }); lc.fill = mkFill(bgArgb); lc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    vc.font = mkFont({ bold: true, size: 12 }); vc.fill = mkFill(bgArgb); vc.alignment = { horizontal: "center", vertical: "middle" };
    if (type === "number")  vc.numFmt = "#,##0";
    if (type === "percent_warn") {
      vc.numFmt = "0.00%";
      // Always show grayed-out warning color — this rate is not operationally meaningful
      vc.fill = mkFill("FFF0F0F0");
      vc.font = mkFont({ bold: true, size: 12, color: { argb: "FFAAAAAA" } });
    }
    [lc, vc].forEach(c => { c.border = { bottom: thinBorder }; });
  });

  ws.addRow([]); ws.getRow(ws.rowCount).height = 8;

  // ══════════════════════════════════════════════════════════════════════════
  // SECTION C — WEEKLY SUMMARY TABLE
  // ══════════════════════════════════════════════════════════════════════════

  addSectionHeader(ws, "SECTION C — WEEKLY SUMMARY (User Activity by Week — Benchmark Staff)", 9);

  const instrHint = ws.addRow([
    "Weekly totals are User Summary benchmark data. Monthly total = SUM of all weeks. Use Section A for operational answer rate.",
    ...Array(8).fill("")
  ]);
  ws.mergeCells(`A${ws.rowCount}:I${ws.rowCount}`);
  instrHint.height = 16;
  instrHint.getCell(1).font      = mkFont({ italic: true, size: 9, color: { argb: "FFAAAAAA" } });
  instrHint.getCell(1).alignment = { horizontal: "left", vertical: "middle" };

  const weekTableStartRow = ws.rowCount + 1;
  const weekTableDataRows = [];

  if (!weekRows || weekRows.length === 0) {
    const er = ws.addRow(["No weekly data found for this month.", ...Array(8).fill("")]);
    ws.mergeCells(`A${ws.rowCount}:I${ws.rowCount}`);
    er.getCell(1).font = mkFont({ italic: true, color: { argb: "FF888888" } });
    er.height = 18;
  } else {
    weekRows.forEach((wk, idx) => {
      const ar       = wk.answer_rate;
      const bgArgb   = idx % 2 === 0 ? WHITE : LIGHT_GRAY;
      const rowValues = [
        formatDate(wk.week_start), formatDate(wk.week_end),
        wk.total_calls, wk.inbound, wk.outbound,
        wk.answered, wk.missed,
        ar !== null ? ar : "",
        minutesToHHMMSS(wk.total_duration_minutes),
      ];
      const row = ws.addRow(rowValues);
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.fill = mkFill(bgArgb); cell.font = mkFont({}); cell.border = { bottom: thinBorder, right: thinBorder };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        if ([3, 4, 5, 6, 7].includes(colNum)) cell.numFmt = "#,##0";
        if (colNum === 8 && ar !== null) {
          cell.numFmt = "0.00%";
          // Gray out — this is extension-level rate, not CDR-based
          cell.fill = mkFill("FFF0F0F0");
          cell.font = mkFont({ color: { argb: "FFAAAAAA" }, italic: true });
        }
      });
      weekTableDataRows.push(rowValues);
    });
  }

  if (weekTableDataRows.length > 0) {
    ws.addTable({
      name: "WeeklySummary",
      ref: `A${weekTableStartRow}:I${weekTableStartRow + weekTableDataRows.length + 1}`,
      headerRow: true,
      totalsRow: true,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: [
        { name: "Week Start",           filterButton: true, totalsRowLabel: "MONTHLY TOTAL" },
        { name: "Week End",             filterButton: true, totalsRowLabel: "" },
        { name: "Total Calls",          filterButton: true, totalsRowFunction: "sum" },
        { name: "Inbound",              filterButton: true, totalsRowFunction: "sum" },
        { name: "Outbound",             filterButton: true, totalsRowFunction: "sum" },
        { name: "Answered (Ext-Level)", filterButton: true, totalsRowFunction: "sum" },
        { name: "Missed (Ext-Level)",   filterButton: true, totalsRowFunction: "sum" },
        { name: "Ext Answer Rate ⚠",   filterButton: true, totalsRowFunction: "average" },
        { name: "Total Duration",       filterButton: true, totalsRowLabel: "" },
      ],
      rows: weekTableDataRows,
    });

    // Re-apply header row styling
    const headerRow = ws.getRow(weekTableStartRow);
    headerRow.height = 30;
    for (let c = 1; c <= 9; c++) {
      const cell = headerRow.getCell(c);
      cell.font      = mkFont({ bold: true, color: { argb: "FFFFFFFF" } });
      cell.fill      = mkFill(HEADER_BG);
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border    = { bottom: { style: "medium", color: { argb: "FFFFFFFF" } }, right: thinBorder };
    }

    // Style totals row
    const totalsRowNum = weekTableStartRow + weekTableDataRows.length + 1;
    const totalsRow = ws.getRow(totalsRowNum);
    totalsRow.height = 22;
    totalsRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font = mkFont({ bold: true, color: { argb: "FFFFFFFF" } });
      cell.fill = mkFill(DARK_NAVY);
      cell.alignment = { horizontal: colNum <= 2 ? "left" : "center", vertical: "middle" };
      if ([3, 4, 5, 6, 7].includes(colNum)) cell.numFmt = "#,##0";
      if (colNum === 8) cell.numFmt = "0.00%";
    });
    ws.getCell(totalsRowNum, 8).numFmt = "0.00%";
  }

  ws.addRow([]); ws.getRow(ws.rowCount).height = 8;

  // ── Section D: Full User Breakdown ────────────────────────────────────────
  addSectionHeader(ws, "SECTION D — FULL USER BREAKDOWN (All Weeks — Benchmark Staff)", 10);
  const instrHint2 = ws.addRow([
    "Filter by Week Start using the dropdown in the table header. Ext-Level Answer Rate is for trend comparison only — see Section A for operational rate.",
    ...Array(9).fill("")
  ]);
  ws.mergeCells(`A${ws.rowCount}:J${ws.rowCount}`);
  instrHint2.height = 16;
  instrHint2.getCell(1).font      = mkFont({ italic: true, size: 9, color: { argb: "FFAAAAAA" } });
  instrHint2.getCell(1).alignment = { horizontal: "left", vertical: "middle" };

  return ws;
}