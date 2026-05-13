/**
 * ExcelExportRunner.jsx
 * Orchestrates the full operational reporting workbook.
 *
 * Visible sheets (in order):
 *   1. Monthly Summary       — KPI cards + weekly totals + full user breakdown
 *   2. Front End Performance — desk-by-desk weekly performance vs goal
 *   3. Individual Performance — individual user weekly performance
 *   4. Inbound CDR           — Vonage CDR upload validation data
 *
 * Hidden reference sheets:
 *   5. Config_Benchmarks     — all threshold / goal values
 *   6. Config_Extensions     — extension → user → role → location mapping
 *   7. Formula_Reference     — documentation of all formulas used
 *   8. Raw_Imported_Data     — flat table of every user-week row (pivot-ready)
 */
import ExcelJS from "exceljs";
import { base44 } from "@/api/base44Client";
import { minutesToHHMMSS, secondsToHHMMSS, formatDate, parseWeekDate, autoFitColumns } from "./ExcelExportHelpers";
import { buildCdrSheet } from "./ExcelCdrSheet";
import { buildMonthlySummarySheet } from "./ExcelMonthlySummary";
import {
  buildConfigBenchmarksSheet,
  buildConfigExtensionsSheet,
  buildFormulaReferenceSheet,
  buildRawImportedDataSheet,
} from "./ExcelConfigSheets";
import {
  durationToMinutes,
  calcInboundAnswered,
  calcInboundAnswerRate,
  getPhoneRole,
  getExpectedAnswerRate,
  getAnswerRateStatus,
} from "./ExcelCallLogCalcs";

// ── Shared style constants ───────────────────────────────────────────────────
const DARK_NAVY  = "FF1F3864";
const SECTION_BG = "FF2E5096";
const LIGHT_GRAY = "FFF5F5F5";
const ALT_ROW    = "FFEEF2FA";
const WHITE      = "FFFFFFFF";
const HEADER_BG  = "FF344D7E";

const mkFill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
const mkFont = (opts) => ({ name: "Calibri", size: 11, ...opts });
const thinBorder = { style: "thin", color: { argb: "FFDDDDDD" } };

// ── Call Center extensions (kept here as single source of truth) ─────────────
const CALL_CENTER_EXTENSIONS = new Set([101, 123, 128, 105, 116, 106, 113, 127, 126, 120, 403, 114, 124, 115]);

// ── Helper: section header row ───────────────────────────────────────────────
function addSectionHeader(ws, text, numCols, startCol = "A") {
  const row = ws.addRow([text, ...Array(numCols - 1).fill("")]);
  const endCol = String.fromCharCode(startCol.charCodeAt(0) + numCols - 1);
  ws.mergeCells(`${startCol}${ws.rowCount}:${endCol}${ws.rowCount}`);
  const cell = ws.getCell(`${startCol}${ws.rowCount}`);
  cell.font      = mkFont({ bold: true, size: 13, color: { argb: WHITE } });
  cell.fill      = mkFill(SECTION_BG);
  cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  row.height = 24;
  return row;
}

// ── Helper: style a table header row (all cols centered) ──────────────────────
function styleTableHeader(row, numCols) {
  row.height = 30;
  for (let c = 1; c <= numCols; c++) {
    const cell = row.getCell(c);
    cell.font      = mkFont({ bold: true, color: { argb: WHITE } });
    cell.fill      = mkFill(HEADER_BG);
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border    = { bottom: { style: "medium", color: { argb: WHITE } }, right: thinBorder };
  }
}

// ── Helper: color for answer rate ─────────────────────────────────────────────
function arColor(rate) {
  if (rate === null || rate === undefined) return { bg: WHITE, fg: "FF888888" };
  if (rate >= 0.5)  return { bg: "FFC6EFCE", fg: "FF276221" };
  if (rate >= 0.2)  return { bg: "FFFFEB9C", fg: "FF9C6500" };
  return                   { bg: "FFFFC7CE", fg: "FF9C0006" };
}

// ── Helper: color for performance vs goal ─────────────────────────────────────
function perfColor(pct) {
  if (pct >= 1.0) return { bg: "FFC6EFCE", fg: "FF276221" };
  if (pct >= 0.9) return { bg: "FFFFEB9C", fg: "FF9C6500" };
  return               { bg: "FFFFC7CE", fg: "FF9C0006" };
}

// ── Shared style context passed to helpers ────────────────────────────────────
const styleCtx = {
  mkFill, mkFont, thinBorder,
  DARK_NAVY, SECTION_BG, ALT_ROW, WHITE, LIGHT_GRAY, HEADER_BG,
  addSectionHeader, styleTableHeader, arColor, perfColor,
};

// ── Card renderer ─────────────────────────────────────────────────────────────
const SUMMARY_BG         = "FFE8F0FE";
const CARD_BORDER_COLOR  = "FF2E5096";
const CARD_W             = 4;
const CARD_GAP           = 1;
const CARDS_PER_ROW      = 3;
const CARD_H             = 5;

function applyCardBorder(wsheet, startRow, startCol, numRows, numCols) {
  const borderColor = { argb: CARD_BORDER_COLOR };
  for (let r = startRow; r < startRow + numRows; r++) {
    for (let c = startCol; c < startCol + numCols; c++) {
      const cell = wsheet.getCell(r, c);
      cell.border = {
        top:    r === startRow                ? { style: "medium", color: borderColor } : cell.border?.top,
        bottom: r === startRow + numRows - 1  ? { style: "medium", color: borderColor } : cell.border?.bottom,
        left:   c === startCol               ? { style: "medium", color: borderColor } : cell.border?.left,
        right:  c === startCol + numCols - 1 ? { style: "medium", color: borderColor } : cell.border?.right,
      };
    }
  }
}

function renderCard(wsheet, startRow, startCol, headerText, cardMetrics) {
  const hdrCell = wsheet.getCell(startRow, startCol);
  hdrCell.value = headerText;
  hdrCell.font  = mkFont({ bold: true, size: 10, color: { argb: WHITE } });
  hdrCell.fill  = mkFill(DARK_NAVY);
  hdrCell.alignment = { horizontal: "center", vertical: "middle" };
  wsheet.getRow(startRow).height = 20;
  wsheet.mergeCells(startRow, startCol, startRow, startCol + CARD_W - 1);
  cardMetrics.forEach(([label, val, type], mi) => {
    const r = startRow + 1 + mi;
    wsheet.getRow(r).height = 17;
    for (let c = startCol; c < startCol + CARD_W; c++) wsheet.getCell(r, c).fill = mkFill(SUMMARY_BG);
    const lc = wsheet.getCell(r, startCol);
    const vc = wsheet.getCell(r, startCol + CARD_W - 1);
    lc.value = label; lc.font = mkFont({ size: 9, color: { argb: "FF444444" } }); lc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    vc.value = val;   vc.font = mkFont({ bold: true, size: 10 });                vc.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
    if (type === "number")  vc.numFmt = "#,##0";
    if (type === "percent") vc.numFmt = "0.00%";
  });
  applyCardBorder(wsheet, startRow, startCol, CARD_H, CARD_W);
}

// ── LOCATION GOALS (single source of truth — also mirrored in Config_Benchmarks) ─
const LOCATION_GOALS = {
  Bloomfield:  { check_in: 34, check_out: 35 },
  Manchester:  { check_in: 28, check_out: 30 },
  Glastonbury: { check_in: 22, check_out: 25 },
  Farmington:  { check_in: 8,  check_out: 14, phone_only: 32 },
};
const WORK_DAYS_PER_WEEK = 5;

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN EXPORT FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════
export async function exportPeriodExcel({
  selectedPeriod,
  enrichedSummaries,
  totalCalls, totalInbound, totalOutbound,
  totalInboundAnswered, totalMissed, totalDurationSec, overallAvgDurationSec,
  formatPeriodLabel,
}) {
  if (!selectedPeriod) return;
  if (!enrichedSummaries || enrichedSummaries.length === 0) {
    alert("No user data to export for this period.");
    return;
  }

  const periodLabel  = formatPeriodLabel(selectedPeriod);
  const uploadedWeeks = selectedPeriod.uploaded_weeks || [];
  const now = new Date();
  const generatedOn = now.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }) +
    " " + now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  // ── Build sorted week rows ──────────────────────────────────────────────────
  const sortedWeeks = uploadedWeeks
    .slice()
    .sort((a, b) => (a.week_start || "").localeCompare(b.week_start || ""));

  const weekRows = sortedWeeks.map(week => {
    let totals;
    if (week.totals && typeof week.totals.total_calls === "number") {
      totals = week.totals;
    } else {
      const snap = Array.isArray(week.user_snapshot) ? week.user_snapshot : [];
      totals = {
        total_calls:            snap.reduce((s, u) => s + (u.total_calls || 0), 0),
        inbound:                snap.reduce((s, u) => s + (u.inbound || 0), 0),
        outbound:               snap.reduce((s, u) => s + (u.outbound || 0), 0),
        answered:               snap.reduce((s, u) => s + (u.answered || 0), 0),
        missed:                 snap.reduce((s, u) => s + (u.missed || 0), 0),
        total_duration_minutes: snap.reduce((s, u) => s + durationToMinutes(u.total_duration_minutes), 0),
      };
    }
    const inboundCount   = totals.inbound || 0;
    const inboundAnswered = calcInboundAnswered(inboundCount, totals.missed || 0);
    const totalDurMin    = durationToMinutes(totals.total_duration_minutes);
    return {
      week_start:             week.week_start,
      week_end:               week.week_end,
      total_calls:            totals.total_calls || 0,
      inbound:                inboundCount,
      outbound:               totals.outbound || 0,
      answered:               inboundAnswered,
      missed:                 totals.missed || 0,
      total_duration_minutes: totalDurMin,
      avg_duration_minutes:   (totals.total_calls || 0) > 0 ? totalDurMin / totals.total_calls : 0,
      answer_rate:            inboundCount > 0 ? calcInboundAnswerRate(inboundCount, inboundAnswered) : null,
      user_snapshot:          Array.isArray(week.user_snapshot) ? week.user_snapshot : [],
    };
  });

  // ── Build per-user-per-week rows ────────────────────────────────────────────
  const userWeekRows = [];
  sortedWeeks.forEach(week => {
    const snapshot = Array.isArray(week.user_snapshot) ? week.user_snapshot : [];
    if (snapshot.length === 0) {
      userWeekRows.push({ _warning: true, week_start: week.week_start, week_end: week.week_end });
      return;
    }
    snapshot.forEach(u => {
      const tc         = u.total_calls || 0;
      const durMin     = durationToMinutes(u.total_duration_minutes);
      const inDurMin   = durationToMinutes(u.inbound_duration_minutes);
      const outDurMin  = durationToMinutes(u.outbound_duration_minutes);
      const uInbound   = u.inbound || 0;
      const uMissed    = u.missed  || 0;
      const uInboundAnswered = calcInboundAnswered(uInbound, uMissed);
      const uAnswerRate      = calcInboundAnswerRate(uInbound, uInboundAnswered);
      const phoneRole        = getPhoneRole(u.extension ?? null);
      const expectedRate     = getExpectedAnswerRate(phoneRole);
      const answerRateStatus = uInbound > 0 ? getAnswerRateStatus(uAnswerRate, expectedRate) : "";
      userWeekRows.push({
        week_start:                week.week_start,
        week_end:                  week.week_end,
        user:                      u.user || "",
        extension:                 u.extension ?? null,
        total_calls:               tc,
        inbound:                   uInbound,
        outbound:                  u.outbound || 0,
        answered:                  uInboundAnswered,
        missed:                    uMissed,
        total_duration_minutes:    durMin,
        inbound_duration_minutes:  inDurMin,
        outbound_duration_minutes: outDurMin,
        avg_duration_minutes:      tc > 0 ? durMin / tc : 0,
        answer_rate:               uInbound > 0 ? uAnswerRate : null,
        phone_role:                phoneRole,
        expected_answer_rate:      expectedRate,
        answer_rate_status:        answerRateStatus,
      });
    });
  });
  userWeekRows.sort((a, b) => {
    if (a._warning && b._warning) return (a.week_start || "").localeCompare(b.week_start || "");
    if (a._warning) return -1; if (b._warning) return 1;
    const nc = (a.user || "").localeCompare(b.user || "");
    if (nc !== 0) return nc;
    return (a.week_start || "").localeCompare(b.week_start || "");
  });

  // ── Load user configs and CDR data ─────────────────────────────────────────
  const exportUserConfigs = await base44.entities.CallLogUserConfig.list();
  const exportUserConfigMap = {};
  for (const cfg of exportUserConfigs) {
    if (cfg.user_name) exportUserConfigMap[cfg.user_name] = cfg;
  }

  let cdrUploadData = null;
  try {
    const cdrUploads = await base44.entities.CallLogCdrUploads.filter({ reporting_period_key: selectedPeriod?.monthly_key || "" });
    if (cdrUploads.length > 0) cdrUploadData = cdrUploads[0];
  } catch (err) {
    console.warn("Could not load CDR data:", err);
  }

  const coerceBool = (val) => {
    if (typeof val === "boolean") return val;
    if (val === null || val === undefined) return false;
    return ["true", "yes", "1", "x", "✓", "checked"].includes(String(val).toLowerCase().trim());
  };

  const isFrontDeskBenchmark = (userName) => {
    const cfg = exportUserConfigMap[userName];
    if (!cfg) return false;
    const includeInBench = coerceBool(cfg.include_in_benchmark);
    const isActive = cfg.active === undefined || cfg.active === null ? true : coerceBool(cfg.active);
    return cfg.benchmark_group === "Front Desk" && includeInBench === true && isActive;
  };

  const getUserLocation = (userName) => {
    const cfg = exportUserConfigMap[userName];
    if (!cfg || !cfg.location || cfg.location === "N/A") return "";
    return cfg.location;
  };

  const getDeskGoal = (userName) => {
    const location = getUserLocation(userName);
    const goals = LOCATION_GOALS[location];
    if (!goals) return 0;
    const nameLower = (userName || "").toLowerCase();
    let deskType = "check_in";
    if (nameLower.includes("check out") || nameLower.includes("checkout")) deskType = "check_out";
    else if (nameLower.includes("check in") || nameLower.includes("checkin")) deskType = "check_in";
    else if (nameLower.includes("phone")) deskType = "phone_only";
    const dailyRate = goals[deskType] ?? goals["check_in"] ?? 0;
    return dailyRate * WORK_DAYS_PER_WEEK;
  };

  // ── Create workbook ────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator   = "ENTIC Operations Center";
  wb.created   = new Date();
  wb.modified  = new Date();

  // ── SHEET 1: Monthly Summary ───────────────────────────────────────────────
  const wsSummary = buildMonthlySummarySheet(wb, {
    periodLabel, generatedOn,
    totalCalls, totalInbound, totalOutbound,
    totalInboundAnswered, totalMissed, totalDurationSec, overallAvgDurationSec,
    weekRows,
    ...styleCtx,
  });

  // Append full user breakdown table to Monthly Summary (continues after the section header added in buildMonthlySummarySheet)
  const realUserRows = userWeekRows
    .filter(u => !u._warning && (u.total_calls || 0) > 0)
    .sort((a, b) => {
      const aHasAr = a.answer_rate !== null && a.answer_rate !== undefined;
      const bHasAr = b.answer_rate !== null && b.answer_rate !== undefined;
      if (aHasAr && !bHasAr) return -1; if (!aHasAr && bHasAr) return 1;
      if (aHasAr && bHasAr && a.answer_rate !== b.answer_rate) return a.answer_rate - b.answer_rate;
      return (a.user || "").localeCompare(b.user || "");
    });

  if (realUserRows.length === 0) {
    const er = wsSummary.addRow(["No user-level weekly data found.", ...Array(10).fill("")]);
    wsSummary.mergeCells(`A${wsSummary.rowCount}:K${wsSummary.rowCount}`);
    er.getCell(1).font = mkFont({ italic: true, color: { argb: "FF888888" } }); er.height = 18;
  } else {
    const userHRow = wsSummary.addRow(["Week Start", "Week End", "User", "Total Calls", "Inbound", "Outbound", "Answered", "Missed", "Total Duration", "Answer Rate", "Avg Duration"]);
    styleTableHeader(userHRow, 11);
    const userTableStartRow = wsSummary.rowCount;

    const tableRows = [];
    realUserRows.forEach((u, idx) => {
      const ar = u.answer_rate !== undefined ? u.answer_rate : null;
      const { bg, fg } = arColor(ar);
      const bgArgb = idx % 2 === 0 ? WHITE : ALT_ROW;
      const rowValues = [
        formatDate(u.week_start), formatDate(u.week_end), u.user || "",
        u.total_calls, u.inbound, u.outbound, u.answered, u.missed,
        minutesToHHMMSS(u.total_duration_minutes), ar !== null ? ar : "",
        minutesToHHMMSS(u.avg_duration_minutes),
      ];
      const row = wsSummary.addRow(rowValues);
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.fill = mkFill(bgArgb); cell.font = mkFont({}); cell.border = { bottom: thinBorder, right: thinBorder };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        if (colNum <= 3) cell.alignment = { horizontal: "left", vertical: "middle" };
        if ([4, 5, 6, 7, 8].includes(colNum)) cell.numFmt = "#,##0";
        if (colNum === 10 && ar !== null) { cell.numFmt = "0.00%"; cell.fill = mkFill(bg); cell.font = mkFont({ color: { argb: fg } }); }
      });
      tableRows.push(rowValues);
    });

    wsSummary.addTable({
      name: "UserBreakdown",
      ref: `A${userTableStartRow}:K${wsSummary.rowCount}`,
      headerRow: true, totalsRow: false,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: [
        { name: "Week Start", filterButton: true }, { name: "Week End", filterButton: true },
        { name: "User", filterButton: true }, { name: "Total Calls", filterButton: true },
        { name: "Inbound", filterButton: true }, { name: "Outbound", filterButton: true },
        { name: "Answered", filterButton: true }, { name: "Missed", filterButton: true },
        { name: "Total Duration", filterButton: true }, { name: "Answer Rate", filterButton: true },
        { name: "Avg Duration", filterButton: true },
      ],
      rows: tableRows,
    });
  }

  autoFitColumns(wsSummary);

  // ── SHEET 2: Front End Performance ────────────────────────────────────────
  const wsDesk = wb.addWorksheet("Front End Performance", { views: [{ showGridLines: false }] });

  const deskWeekMap = {};
  sortedWeeks.forEach(week => {
    const snapshot = Array.isArray(week.user_snapshot) ? week.user_snapshot : [];
    snapshot.forEach(u => {
      const userName = u.user || "";
      if (!isFrontDeskBenchmark(userName)) return;
      const key = `${week.week_start}||${userName}`;
      if (!deskWeekMap[key]) {
        deskWeekMap[key] = { week_start: week.week_start, desk: userName, location: getUserLocation(userName), weeklyGoal: getDeskGoal(userName), totalAnswered: 0 };
      }
      deskWeekMap[key].totalAnswered += (u.answered || 0);
    });
  });

  const deskRows = Object.values(deskWeekMap).sort((a, b) => {
    const wsCmp = a.week_start.localeCompare(b.week_start);
    if (wsCmp !== 0) return wsCmp;
    const aPct = a.weeklyGoal > 0 ? a.totalAnswered / a.weeklyGoal : 0;
    const bPct = b.weeklyGoal > 0 ? b.totalAnswered / b.weeklyGoal : 0;
    if (aPct !== bPct) return aPct - bPct;
    return a.desk.localeCompare(b.desk);
  });

  wsDesk.addRow([`${periodLabel} – Front End Performance`, "", "", "", "", ""]); wsDesk.mergeCells("A1:F1");
  const deskTitle = wsDesk.getCell("A1");
  deskTitle.font = mkFont({ bold: true, size: 16, color: { argb: WHITE } }); deskTitle.fill = mkFill(DARK_NAVY);
  deskTitle.alignment = { horizontal: "center", vertical: "middle" }; wsDesk.getRow(1).height = 40;
  wsDesk.addRow([]); wsDesk.getRow(2).height = 6;
  wsDesk.addRow([`Reporting Period: ${periodLabel}`]); wsDesk.getCell("A3").font = mkFont({ bold: true }); wsDesk.getRow(3).height = 18;
  wsDesk.addRow([`Generated On: ${generatedOn}`]); wsDesk.getCell("A4").font = mkFont({ color: { argb: "FF666666" } }); wsDesk.getRow(4).height = 18;
  wsDesk.addRow([]); wsDesk.getRow(5).height = 6;

  [1, 2, 3, 4].forEach((c, i) => wsDesk.getColumn(c).width = [18, 12, 12, 12][i]);
  wsDesk.getColumn(5).width = 1;
  [6, 7, 8, 9].forEach((c, i) => wsDesk.getColumn(c).width = [18, 12, 12, 12][i]);
  wsDesk.getColumn(10).width = 1;
  [11, 12, 13, 14].forEach((c, i) => wsDesk.getColumn(c).width = [18, 12, 12, 12][i]);

  const deskUniqueWeeks = [...new Set(deskRows.map(d => d.week_start))].sort();
  const numDeskCardRows = Math.ceil(deskUniqueWeeks.length / CARDS_PER_ROW);
  const deskCardStartRow = wsDesk.rowCount + 1;
  for (let i = 0; i < numDeskCardRows * CARD_H + Math.max(0, numDeskCardRows - 1); i++) { wsDesk.addRow([]); wsDesk.getRow(wsDesk.rowCount).height = 17; }

  deskUniqueWeeks.forEach((weekStart, idx) => {
    const cardRowIdx = Math.floor(idx / CARDS_PER_ROW); const cardColIdx = idx % CARDS_PER_ROW;
    const startRow = deskCardStartRow + cardRowIdx * (CARD_H + 1);
    const startCol = 1 + cardColIdx * (CARD_W + CARD_GAP);
    const weekDeskRows = deskRows.filter(d => d.week_start === weekStart);
    const weekPcts = weekDeskRows.map(d => d.weeklyGoal > 0 ? d.totalAnswered / d.weeklyGoal : 0);
    const weekTotalDesks = new Set(weekDeskRows.map(d => d.desk)).size;
    const weekAvgPct = weekPcts.length > 0 ? weekPcts.reduce((s, v) => s + v, 0) / weekPcts.length : 0;
    renderCard(wsDesk, startRow, startCol, `Week of ${formatDate(weekStart)}`, [
      ["Avg % of Goal", weekAvgPct, "percent"],
      ["≥ 100%", weekPcts.filter(p => p >= 1.0).length, "number"],
      ["< 90%",  weekPcts.filter(p => p < 0.9).length,  "number"],
      ["Total Desks", weekTotalDesks, "number"],
    ]);
  });

  wsDesk.addRow([]); wsDesk.getRow(wsDesk.rowCount).height = 8;
  addSectionHeader(wsDesk, "Detailed Front End Performance by Week", 6);

  const deskTableStartRow = wsDesk.rowCount + 1;
  const deskHRow = wsDesk.addRow(["Week Start", "Desk", "Location", "Total Answered", "Weekly Goal", "% of Weekly Goal"]);
  styleTableHeader(deskHRow, 6, 3);
  wsDesk.views = [{ showGridLines: false, state: "frozen", ySplit: deskTableStartRow, xSplit: 0 }];

  const deskTableRows = [];
  deskRows.forEach((d, idx) => {
    const pct = d.weeklyGoal > 0 ? d.totalAnswered / d.weeklyGoal : 0;
    const { bg, fg } = perfColor(pct);
    const bgArgb = idx % 2 === 0 ? WHITE : ALT_ROW;
    const rowValues = [formatDate(d.week_start), d.desk, d.location, d.totalAnswered, d.weeklyGoal, pct];
    const row = wsDesk.addRow(rowValues); row.height = 18;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill = mkFill(bgArgb); cell.font = mkFont({}); cell.border = { bottom: thinBorder, right: thinBorder };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      if (colNum <= 2) cell.alignment = { horizontal: "left", vertical: "middle" };
      if ([4, 5].includes(colNum)) cell.numFmt = "#,##0";
      if (colNum === 6) { cell.numFmt = "0.00%"; if (d.weeklyGoal > 0) { cell.fill = mkFill(bg); cell.font = mkFont({ color: { argb: fg } }); } }
    });
    deskTableRows.push(rowValues);
  });

  if (deskRows.length > 0) {
    wsDesk.addTable({
      name: "DeskPerformance",
      ref: `A${deskTableStartRow}:F${wsDesk.rowCount}`,
      headerRow: true, totalsRow: true,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: [
        { name: "Week Start", filterButton: true, totalsRowLabel: "TOTAL" },
        { name: "Desk", filterButton: true, totalsRowLabel: "" },
        { name: "Location", filterButton: true, totalsRowLabel: "" },
        { name: "Total Answered", filterButton: true, totalsRowFunction: "sum" },
        { name: "Weekly Goal", filterButton: true, totalsRowFunction: "sum" },
        { name: "% of Weekly Goal", filterButton: true, totalsRowFunction: "average" },
      ],
      rows: deskTableRows,
    });
  }
  autoFitColumns(wsDesk);

  // ── SHEET 3: Individual Performance (no Desk column) ─────────────────────
  const wsIndiv = wb.addWorksheet("Individual Performance", { views: [{ showGridLines: false }] });
  wsIndiv.columns = [{ width: 18 }, { width: 34 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 18 }];

  const indivRows = [];
  sortedWeeks.forEach(week => {
    const snapshot = Array.isArray(week.user_snapshot) ? week.user_snapshot : [];
    snapshot.forEach(u => {
      const userName  = u.user || "";
      const answered  = u.answered || 0;
      const eligible  = isFrontDeskBenchmark(userName);
      const weeklyGoal = eligible ? getDeskGoal(userName) : 0;
      if (eligible && weeklyGoal > 0) {
        indivRows.push({ week_start: week.week_start, user: userName, location: getUserLocation(userName), answered, weeklyGoal, percentOfGoal: answered / weeklyGoal, isDeskUser: true });
      } else {
        indivRows.push({ week_start: week.week_start, user: userName, location: getUserLocation(userName), answered, weeklyGoal: null, percentOfGoal: null, isDeskUser: false });
      }
    });
  });
  indivRows.sort((a, b) => {
    const aHas = a.percentOfGoal !== null && a.percentOfGoal !== undefined;
    const bHas = b.percentOfGoal !== null && b.percentOfGoal !== undefined;
    if (aHas && !bHas) return -1; if (!aHas && bHas) return 1;
    if (aHas && bHas && a.percentOfGoal !== b.percentOfGoal) return a.percentOfGoal - b.percentOfGoal;
    return a.week_start.localeCompare(b.week_start);
  });

  wsIndiv.addRow([`${periodLabel} – Individual Performance`, "", "", "", "", ""]); wsIndiv.mergeCells("A1:F1");
  const indivTitle = wsIndiv.getCell("A1");
  indivTitle.font = mkFont({ bold: true, size: 16, color: { argb: WHITE } }); indivTitle.fill = mkFill(DARK_NAVY);
  indivTitle.alignment = { horizontal: "center", vertical: "middle" }; wsIndiv.getRow(1).height = 40;
  wsIndiv.addRow([]); wsIndiv.getRow(2).height = 6;
  wsIndiv.addRow([`Reporting Period: ${periodLabel}`]); wsIndiv.getCell("A3").font = mkFont({ bold: true }); wsIndiv.getRow(3).height = 18;
  wsIndiv.addRow([`Generated On: ${generatedOn}`]); wsIndiv.getCell("A4").font = mkFont({ color: { argb: "FF666666" } }); wsIndiv.getRow(4).height = 18;
  wsIndiv.addRow([]); wsIndiv.getRow(5).height = 6;

  const indivUniqueWeeks = [...new Set(indivRows.map(r => r.week_start))].sort();
  const numIndivCardRows = Math.ceil(indivUniqueWeeks.length / CARDS_PER_ROW);
  const indivCardStartRow = wsIndiv.rowCount + 1;
  for (let i = 0; i < numIndivCardRows * CARD_H + Math.max(0, numIndivCardRows - 1); i++) { wsIndiv.addRow([]); wsIndiv.getRow(wsIndiv.rowCount).height = 17; }

  indivUniqueWeeks.forEach((weekStart, idx) => {
    const cardRowIdx = Math.floor(idx / CARDS_PER_ROW); const cardColIdx = idx % CARDS_PER_ROW;
    const startRow = indivCardStartRow + cardRowIdx * (CARD_H + 1);
    const startCol = 1 + cardColIdx * (CARD_W + CARD_GAP);
    const weekIndivRows = indivRows.filter(r => r.week_start === weekStart);
    const weekEligiblePcts = weekIndivRows.filter(r => r.isDeskUser).map(r => r.percentOfGoal || 0);
    const weekAvgPct = weekEligiblePcts.length > 0 ? weekEligiblePcts.reduce((s, v) => s + v, 0) / weekEligiblePcts.length : 0;
    renderCard(wsIndiv, startRow, startCol, `Week of ${formatDate(weekStart)}`, [
      ["Avg % of Goal", weekAvgPct, "percent"],
      ["≥ 100%", weekEligiblePcts.filter(p => p >= 1.0).length, "number"],
      ["< 90%",  weekEligiblePcts.filter(p => p < 0.9).length,  "number"],
      ["Total Users", new Set(weekIndivRows.map(r => r.user)).size, "number"],
    ]);
  });

  wsIndiv.addRow([]); wsIndiv.getRow(wsIndiv.rowCount).height = 8;
  addSectionHeader(wsIndiv, "Detailed Individual Performance by Week", 6);

  const indivTableStartRow = wsIndiv.rowCount + 1;
  // 6 columns: Week Start | User | Location | Answered | Weekly Goal | % of Weekly Goal
  const indivHRow = wsIndiv.addRow(["Week Start", "User", "Location", "Answered", "Weekly Goal", "% of Weekly Goal"]);
  styleTableHeader(indivHRow, 6);
  wsIndiv.views = [{ showGridLines: false, state: "frozen", ySplit: indivTableStartRow, xSplit: 0 }];

  const indivTableRows = [];
  indivRows.forEach((r, idx) => {
    const bgArgb = idx % 2 === 0 ? WHITE : ALT_ROW;
    const rowValues = [
      formatDate(r.week_start), r.user, r.location || "", r.answered,
      r.weeklyGoal !== null && r.weeklyGoal !== undefined ? r.weeklyGoal : "",
      r.percentOfGoal !== null && r.percentOfGoal !== undefined ? r.percentOfGoal : "",
    ];
    const row = wsIndiv.addRow(rowValues); row.height = 18;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill = mkFill(bgArgb); cell.font = mkFont({}); cell.border = { bottom: thinBorder, right: thinBorder };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      // Left-align text-heavy columns
      if (colNum <= 2) cell.alignment = { horizontal: "left", vertical: "middle" };
      if (colNum === 4) cell.numFmt = "#,##0";
      if (colNum === 5 && r.weeklyGoal !== null && r.weeklyGoal !== undefined) cell.numFmt = "#,##0";
      if (colNum === 6) {
        cell.numFmt = "0.00%";
        if (r.percentOfGoal !== null && r.percentOfGoal !== undefined) {
          const { bg, fg } = perfColor(r.percentOfGoal); cell.fill = mkFill(bg); cell.font = mkFont({ color: { argb: fg } });
        }
      }
    });
    indivTableRows.push(rowValues);
  });

  if (indivRows.length > 0) {
    wsIndiv.addTable({
      name: "IndividualPerformance",
      ref: `A${indivTableStartRow}:F${wsIndiv.rowCount}`,
      headerRow: true, totalsRow: true,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: [
        { name: "Week Start",       filterButton: true, totalsRowLabel: "TOTAL" },
        { name: "User",             filterButton: true, totalsRowLabel: "" },
        { name: "Location",         filterButton: true, totalsRowLabel: "" },
        { name: "Answered",         filterButton: true, totalsRowFunction: "sum" },
        { name: "Weekly Goal",      filterButton: true, totalsRowFunction: "sum" },
        { name: "% of Weekly Goal", filterButton: true, totalsRowFunction: "average" },
      ],
      rows: indivTableRows,
    });
  }
  autoFitColumns(wsIndiv);

  // ── SHEET 4: Inbound CDR ───────────────────────────────────────────────────
  await buildCdrSheet(wb, {
    periodLabel, generatedOn, cdrUploadData,
    mkFill, mkFont, thinBorder, addSectionHeader, styleTableHeader,
    arColor, DARK_NAVY, ALT_ROW, WHITE, LIGHT_GRAY,
  });

  // ── HIDDEN SHEET 5: Config_Benchmarks ─────────────────────────────────────
  buildConfigBenchmarksSheet(wb, { mkFill, mkFont, thinBorder, DARK_NAVY, ALT_ROW, WHITE });

  // ── HIDDEN SHEET 6: Config_Extensions ────────────────────────────────────
  buildConfigExtensionsSheet(wb, {
    mkFill, mkFont, thinBorder, DARK_NAVY, ALT_ROW, WHITE,
    exportUserConfigs,
    CALL_CENTER_EXTENSIONS,
  });

  // ── HIDDEN SHEET 7: Formula_Reference ────────────────────────────────────
  buildFormulaReferenceSheet(wb, { mkFill, mkFont, thinBorder, DARK_NAVY, ALT_ROW, WHITE });

  // ── HIDDEN SHEET 8: Raw_Imported_Data ────────────────────────────────────
  buildRawImportedDataSheet(wb, {
    mkFill, mkFont, thinBorder, DARK_NAVY, ALT_ROW, WHITE,
    userWeekRows,
    parseWeekDate,
  });

  // ── Download ──────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer();
  const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const link   = document.createElement("a");
  link.href    = URL.createObjectURL(blob);
  link.download = `${periodLabel} – Call Performance Report.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}