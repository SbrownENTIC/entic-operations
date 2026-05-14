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
import { buildNormalizedDataSheet } from "./ExcelNormalizedDataSheet";
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

// ── Call Center extensions — must mirror ExcelCallLogCalcs.jsx ───────────────
const CALL_CENTER_EXTENSIONS = new Set([
  353, 7, 163, 101, 82, 86, 55, 38, 4, 104, 112, 120, 128,
  127, 114, 124, 126, 116, 106, 113, 115, 123, 105, 403,
]);

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
  frontEndSummaries = [],
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

  // ── Load user configs FIRST — needed for extension resolution in userWeekRows ─
  const exportUserConfigs = await base44.entities.CallLogUserConfig.list();
  const exportUserConfigMap = {};
  for (const cfg of exportUserConfigs) {
    if (cfg.user_name) exportUserConfigMap[cfg.user_name] = cfg;
  }

  // ── Build sorted week rows ──────────────────────────────────────────────────
  const sortedWeeks = uploadedWeeks
    .slice()
    .sort((a, b) => (a.week_start || "").localeCompare(b.week_start || ""));

  // Pre-build a temporary benchmark name set for weekRows filtering.
  // (Full coerceBool-based set is built after userWeekRows; this early pass uses the same logic.)
  const _earlyBenchmarkNames = new Set(
    exportUserConfigs
      .filter(cfg => {
        const v = cfg.include_in_benchmark;
        if (typeof v === "boolean") return v;
        if (v === null || v === undefined) return false;
        return ["true", "yes", "1", "x", "✓", "checked"].includes(String(v).toLowerCase().trim());
      })
      .map(cfg => (cfg.user_name || "").trim().toLowerCase())
  );

  const weekRows = sortedWeeks.map(week => {
    // Only sum benchmark users so Weekly Summary matches Monthly KPI
    const snap = Array.isArray(week.user_snapshot) ? week.user_snapshot : [];
    const benchSnap = snap.filter(u => _earlyBenchmarkNames.has((u.user || "").trim().toLowerCase()));
    const totals = {
      total_calls:            benchSnap.reduce((s, u) => s + (u.total_calls || 0), 0),
      inbound:                benchSnap.reduce((s, u) => s + (u.inbound || 0), 0),
      outbound:               benchSnap.reduce((s, u) => s + (u.outbound || 0), 0),
      answered:               benchSnap.reduce((s, u) => s + (u.answered || 0), 0),
      missed:                 benchSnap.reduce((s, u) => s + (u.missed || 0), 0),
      total_duration_minutes: benchSnap.reduce((s, u) => s + durationToMinutes(u.total_duration_minutes), 0),
    };
    const inboundCount    = totals.inbound || 0;
    const inboundAnswered = calcInboundAnswered(inboundCount, totals.missed || 0);
    const totalDurMin     = durationToMinutes(totals.total_duration_minutes);
    return {
      week_start:             week.week_start,
      week_end:               week.week_end,
      total_calls:            totals.total_calls || 0,
      inbound:                inboundCount,
      outbound:               totals.outbound || 0,
      answered:               inboundAnswered,
      missed:                 totals.missed || 0,
      total_duration_minutes: totalDurMin,
      avg_duration_minutes:   totals.total_calls > 0 ? totalDurMin / totals.total_calls : 0,
      answer_rate:            inboundCount > 0 ? calcInboundAnswerRate(inboundCount, inboundAnswered) : null,
      user_snapshot:          snap, // keep full snapshot for other sheets
    };
  });

  // ── Build per-user-per-week rows ────────────────────────────────────────────
  // NOTE: user_snapshot does not store extension — resolve it from CallLogUserConfig
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

      // Resolve extension from user config (snapshot doesn't store it)
      const cfg = exportUserConfigMap[u.user] || null;
      const cfgExts = Array.isArray(cfg?.extensions) ? cfg.extensions : [];
      // Use first extension from config; fall back to any extension field on snapshot
      const resolvedExtension = cfgExts.length > 0 ? cfgExts[0] : (u.extension ?? null);

      const phoneRole        = getPhoneRole(resolvedExtension);
      const expectedRate     = getExpectedAnswerRate(phoneRole);
      const answerRateStatus = uInbound > 0 ? getAnswerRateStatus(uAnswerRate, expectedRate) : "";
      userWeekRows.push({
        week_start:                week.week_start,
        week_end:                  week.week_end,
        user:                      u.user || "",
        extension:                 resolvedExtension,
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

  // ── Load CDR data ─────────────────────────────────────────────────────────
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
    // benchmark_group must be "Front Desk" AND in_benchmark must be true
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

  // ── Recompute Monthly KPI totals from weekRows — same source as Weekly Summary ──
  // Only include benchmark users so KPI and Weekly Summary are always aligned.
  // weekRows already contain totals per week; we need per-user-per-week to apply the
  // benchmark filter. We use userWeekRows (already built above) filtered to benchmark users.
  const benchmarkUserNames = new Set(
    exportUserConfigs
      .filter(cfg => coerceBool(cfg.include_in_benchmark))
      .map(cfg => (cfg.user_name || "").trim().toLowerCase())
  );
  const benchmarkUserWeekRows = userWeekRows.filter(
    u => !u._warning && benchmarkUserNames.has((u.user || "").trim().toLowerCase())
  );

  const kpiTotalCalls           = benchmarkUserWeekRows.reduce((s, u) => s + (u.total_calls || 0), 0);
  const kpiTotalInbound         = benchmarkUserWeekRows.reduce((s, u) => s + (u.inbound || 0), 0);
  const kpiTotalOutbound        = benchmarkUserWeekRows.reduce((s, u) => s + (u.outbound || 0), 0);
  const kpiTotalInboundAnswered = benchmarkUserWeekRows.reduce((s, u) => s + (u.answered || 0), 0);
  const kpiTotalMissed          = benchmarkUserWeekRows.reduce((s, u) => s + (u.missed || 0), 0);
  // Duration: userWeekRows stores minutes; convert to seconds for the KPI display
  const kpiTotalDurationSec     = benchmarkUserWeekRows.reduce((s, u) => s + (u.total_duration_minutes || 0) * 60, 0);
  const kpiAvgDurationSec       = kpiTotalCalls > 0 ? kpiTotalDurationSec / kpiTotalCalls : 0;

  console.log("[KPI_ALIGN] Benchmark user count:", benchmarkUserNames.size);
  console.log("[KPI_ALIGN] Benchmark userWeekRows count:", benchmarkUserWeekRows.length);
  console.log("[KPI_ALIGN] KPI totalCalls:", kpiTotalCalls, "weekRows sum:", weekRows.reduce((s,w)=>s+(w.total_calls||0),0));
  console.log("[KPI_ALIGN] KPI totalInbound:", kpiTotalInbound, "weekRows sum:", weekRows.reduce((s,w)=>s+(w.inbound||0),0));

  // ── Create workbook ────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator   = "ENTIC Operations Center";
  wb.created   = new Date();
  wb.modified  = new Date();

  // ── Build CDR KPIs for Section A (when CDR data is available) ────────────
  let cdrKpis = null;
  if (cdrUploadData) {
    const totalInb  = cdrUploadData.total_inbound_calls    || 0;
    const totalAns  = Math.min(cdrUploadData.total_inbound_answered || 0, totalInb);
    const totalAban = cdrUploadData.total_unanswered       || (totalInb - totalAns);
    // avg talk time: if stored on cdrUploadData use it, otherwise estimate from duration
    const avgTalkSec = cdrUploadData.avg_talk_time_seconds
      || (totalAns > 0 ? (cdrUploadData.total_duration_seconds || 0) / totalAns : 0);
    cdrKpis = {
      totalInbound:   totalInb,
      totalAnswered:  totalAns,
      totalAbandoned: totalAban,
      answerRate:     totalInb > 0 ? totalAns / totalInb : 0,
      abandonRate:    totalInb > 0 ? totalAban / totalInb : 0,
      avgTalkTimeSec: avgTalkSec,
    };
  }

  // ── SHEET 1: Monthly Summary ───────────────────────────────────────────────
  const wsSummary = buildMonthlySummarySheet(wb, {
    periodLabel, generatedOn,
    // Section B / Weekly — User Summary benchmark totals
    totalCalls:           kpiTotalCalls,
    totalInbound:         kpiTotalInbound,
    totalOutbound:        kpiTotalOutbound,
    totalInboundAnswered: kpiTotalInboundAnswered,
    totalMissed:          kpiTotalMissed,
    totalDurationSec:     kpiTotalDurationSec,
    overallAvgDurationSec: kpiAvgDurationSec,
    // Section A — CDR operational KPIs (null when not uploaded)
    cdrKpis,
    weekRows,
    ...styleCtx,
  });
  wsSummary.properties.tabColor = { argb: "FF1F4E79" }; // Dark Blue

  // Append full user breakdown table to Monthly Summary — benchmark-only users
  const realUserRows = userWeekRows
    .filter(u => !u._warning && (u.total_calls || 0) > 0 && coerceBool(exportUserConfigMap[u.user]?.include_in_benchmark))
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
  wsDesk.properties.tabColor = { argb: "FF2E7D6F" }; // Teal

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
    // Re-apply percentage format to SUBTOTAL totals cell after addTable
    const deskTotalsRowNum = deskTableStartRow + deskTableRows.length + 1;
    wsDesk.getCell(deskTotalsRowNum, 6).numFmt = "0.00%";
  }
  autoFitColumns(wsDesk);

  // ── SHEET 3: Individual Performance (no Desk column) ─────────────────────
  const wsIndiv = wb.addWorksheet("Individual Performance", { views: [{ showGridLines: false }] });
  wsIndiv.properties.tabColor = { argb: "FF6C757D" }; // Medium Gray
  wsIndiv.columns = [{ width: 18 }, { width: 34 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 18 }];

  const indivRows = [];
  sortedWeeks.forEach(week => {
    const snapshot = Array.isArray(week.user_snapshot) ? week.user_snapshot : [];
    snapshot.forEach(u => {
      const userName = u.user || "";
      // Individual Performance sheet: only include benchmark users
      if (!coerceBool(exportUserConfigMap[userName]?.include_in_benchmark)) return;
      const answered   = u.answered || 0;
      const eligible   = isFrontDeskBenchmark(userName);
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
    // Re-apply percentage format to SUBTOTAL totals cell after addTable
    const indivTotalsRowNum = indivTableStartRow + indivTableRows.length + 1;
    wsIndiv.getCell(indivTotalsRowNum, 6).numFmt = "0.00%";
  }
  autoFitColumns(wsIndiv);

  // ── SHEET 4: Inbound CDR — tab color applied inside buildCdrSheet ─────────
  await buildCdrSheet(wb, {
    periodLabel, generatedOn, cdrUploadData,
    mkFill, mkFont, thinBorder, addSectionHeader, styleTableHeader,
    arColor, DARK_NAVY, ALT_ROW, WHITE, LIGHT_GRAY,
  });

  // ── SHEET 5: Front-End Inbound Answer Rate ────────────────────────────────
  const wsFrontEnd = wb.addWorksheet("Front-End Inbound Answer Rate", { views: [{ showGridLines: false }] });
  wsFrontEnd.properties.tabColor = { argb: "FF5A4E8C" }; // Deep Purple
  wsFrontEnd.columns = [
    { width: 34 }, // User
    { width: 14 }, // Total Calls
    { width: 14 }, // Inbound
    { width: 14 }, // Answered
    { width: 14 }, // Missed
    { width: 16 }, // Answer Rate
    { width: 18 }, // Inbound Duration
    { width: 20 }, // Reporting Period
  ];

  // Title
  wsFrontEnd.addRow([`${periodLabel} – Front-End Inbound Answer Rate`, "", "", "", "", "", "", ""]);
  wsFrontEnd.mergeCells("A1:H1");
  const feTitle = wsFrontEnd.getCell("A1");
  feTitle.font = mkFont({ bold: true, size: 16, color: { argb: WHITE } });
  feTitle.fill = mkFill(DARK_NAVY);
  feTitle.alignment = { horizontal: "center", vertical: "middle" };
  wsFrontEnd.getRow(1).height = 40;

  wsFrontEnd.addRow([]); wsFrontEnd.getRow(2).height = 6;
  wsFrontEnd.addRow([`Reporting Period: ${periodLabel}`]); wsFrontEnd.getCell("A3").font = mkFont({ bold: true }); wsFrontEnd.getRow(3).height = 18;
  wsFrontEnd.addRow([`Generated On: ${generatedOn}`]); wsFrontEnd.getCell("A4").font = mkFont({ color: { argb: "FF666666" } }); wsFrontEnd.getRow(4).height = 18;
  wsFrontEnd.addRow([`Scope: In-Benchmark Front Desk staff only (benchmark_group = "Front Desk" AND include_in_benchmark = true). Inbound calls only in denominator.`]); wsFrontEnd.getCell("A5").font = mkFont({ italic: true, size: 10, color: { argb: "FF888888" } }); wsFrontEnd.getRow(5).height = 16;
  wsFrontEnd.addRow([]); wsFrontEnd.getRow(6).height = 6;

  // Summary aggregate row
  const feUsers = (frontEndSummaries || []).filter(u => (u.total_calls || 0) > 0);
  const feAggInbound  = feUsers.reduce((s, u) => s + (u.inbound || 0), 0);
  const feAggAnswered = feUsers.reduce((s, u) => {
    const inb = u.inbound || 0;
    const ans = u.inbound_answered != null ? Math.min(u.inbound_answered, inb) : Math.max(inb - (u.missed || 0), 0);
    return s + ans;
  }, 0);
  const feAggMissed   = feUsers.reduce((s, u) => s + (u.missed || 0), 0);
  const feAggTotal    = feUsers.reduce((s, u) => s + (u.total_calls || 0), 0);
  // Cap at 100%, return 0 if no inbound calls
  const feAggRate     = feAggInbound > 0 ? Math.min(feAggAnswered / feAggInbound, 1) : 0;
  const feAggDurSec   = feUsers.reduce((s, u) => s + (u.inbound_duration_seconds || 0), 0);

  addSectionHeader(wsFrontEnd, "Front-End Inbound Aggregate Summary", 8);
  const feSumRow = wsFrontEnd.addRow([
    "ALL FRONT-END STAFF", feAggTotal, feAggInbound, feAggAnswered, feAggMissed,
    feAggRate !== null ? feAggRate : "", secondsToHHMMSS(feAggDurSec), periodLabel
  ]);
  feSumRow.height = 22;
  feSumRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
    cell.fill = mkFill("FFDCE6F1");
    cell.font = mkFont({ bold: true });
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { bottom: thinBorder, right: thinBorder };
    if ([2, 3, 4, 5].includes(colNum)) cell.numFmt = "#,##0";
    if (colNum === 6 && feAggRate !== null) {
      cell.numFmt = "0.00%";
      const { bg, fg } = arColor(feAggRate);
      cell.fill = mkFill(bg); cell.font = mkFont({ bold: true, color: { argb: fg } });
    }
  });

  wsFrontEnd.addRow([]); wsFrontEnd.getRow(wsFrontEnd.rowCount).height = 8;
  addSectionHeader(wsFrontEnd, "Front-End Inbound User Breakdown", 8);

  const feTableStartRow = wsFrontEnd.rowCount + 1;
  const feHRow = wsFrontEnd.addRow(["User", "Total Calls", "Inbound", "Answered", "Missed", "Answer Rate", "Inbound Duration", "Reporting Period"]);
  styleTableHeader(feHRow, 8);
  wsFrontEnd.views = [{ showGridLines: false, state: "frozen", ySplit: feTableStartRow, xSplit: 0 }];

  const feTableRows = [];
  const feSorted = [...feUsers].sort((a, b) => {
    const calcAr = (u) => {
      const inb = u.inbound || 0;
      if (inb === 0) return 0;
      const ans = u.inbound_answered != null ? Math.min(u.inbound_answered, inb) : Math.max(inb - (u.missed || 0), 0);
      return Math.min(ans / inb, 1);
    };
    return calcAr(a) - calcAr(b); // lowest first
  });

  feSorted.forEach((u, idx) => {
    const inbound  = u.inbound || 0;
    const answered = u.inbound_answered != null
      ? Math.min(u.inbound_answered, inbound)
      : Math.max(inbound - (u.missed || 0), 0);
    const missed   = u.missed || 0;
    // Cap at 100%, return 0 (not null) when no inbound calls
    const ar       = inbound > 0 ? Math.min(answered / inbound, 1) : 0;
    const durSec   = u.inbound_duration_seconds || 0;
    const bgArgb   = idx % 2 === 0 ? WHITE : ALT_ROW;
    const rowValues = [u.user || "", u.total_calls || 0, inbound, answered, missed, ar !== null ? ar : "", secondsToHHMMSS(durSec), periodLabel];
    const row = wsFrontEnd.addRow(rowValues);
    row.height = 18;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill = mkFill(bgArgb);
      cell.font = mkFont({});
      cell.border = { bottom: thinBorder, right: thinBorder };
      cell.alignment = { horizontal: colNum === 1 ? "left" : "center", vertical: "middle" };
      if ([2, 3, 4, 5].includes(colNum)) cell.numFmt = "#,##0";
      if (colNum === 6 && ar !== null) {
        cell.numFmt = "0.00%";
        const { bg, fg } = arColor(ar);
        cell.fill = mkFill(bg); cell.font = mkFont({ color: { argb: fg } });
      }
    });
    feTableRows.push(rowValues);
  });

  if (feTableRows.length === 0) {
    const er = wsFrontEnd.addRow(["No Front-End staff data found for this period.", ...Array(7).fill("")]);
    wsFrontEnd.mergeCells(`A${wsFrontEnd.rowCount}:H${wsFrontEnd.rowCount}`);
    er.getCell(1).font = mkFont({ italic: true, color: { argb: "FF888888" } });
    er.height = 18;
  } else {
    wsFrontEnd.addTable({
      name: "FrontEndInboundAnswerRate",
      ref: `A${feTableStartRow}:H${wsFrontEnd.rowCount}`,
      headerRow: true, totalsRow: false,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: [
        { name: "User", filterButton: true },
        { name: "Total Calls", filterButton: true },
        { name: "Inbound", filterButton: true },
        { name: "Answered", filterButton: true },
        { name: "Missed", filterButton: true },
        { name: "Answer Rate", filterButton: true },
        { name: "Inbound Duration", filterButton: true },
        { name: "Reporting Period", filterButton: true },
      ],
      rows: feTableRows,
    });
  }
  autoFitColumns(wsFrontEnd);

  // ── HIDDEN SHEET 6 (was 5): Config_Benchmarks ────────────────────────────
  buildConfigBenchmarksSheet(wb, { mkFill, mkFont, thinBorder, DARK_NAVY, ALT_ROW, WHITE });

  // ── HIDDEN SHEET 6: Config_Extensions ────────────────────────────────────
  buildConfigExtensionsSheet(wb, {
    mkFill, mkFont, thinBorder, DARK_NAVY, ALT_ROW, WHITE,
    exportUserConfigs,
    CALL_CENTER_EXTENSIONS,
    userWeekRows, // provides raw "Ext(s)" values from imported call log data
  });

  // ── HIDDEN SHEET 7: Formula_Reference ────────────────────────────────────
  buildFormulaReferenceSheet(wb, { mkFill, mkFont, thinBorder, DARK_NAVY, ALT_ROW, WHITE });

  // ── HIDDEN SHEET 8: Raw_Imported_Data ────────────────────────────────────
  buildRawImportedDataSheet(wb, {
    mkFill, mkFont, thinBorder, DARK_NAVY, ALT_ROW, WHITE,
    userWeekRows,
    parseWeekDate,
  });

  // ── HIDDEN SHEET 9: Normalized_Call_Data — data architecture + audit layer ─
  buildNormalizedDataSheet(wb, {
    mkFill, mkFont, thinBorder,
    DARK_NAVY, ALT_ROW, WHITE, SECTION_BG,
    addSectionHeader,
    userWeekRows,
    cdrUploadData,
    exportUserConfigs,
    coerceBool,
    formatDate,
    minutesToHHMMSS,
    secondsToHHMMSS,
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