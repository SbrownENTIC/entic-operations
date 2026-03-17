/**
 * exportPeriodExcel — extracted from CallLogReporting to reduce file size.
 * Builds and downloads the full Excel workbook for a given call log period.
 */
import ExcelJS from "exceljs";
import { base44 } from "@/api/base44Client";
import { minutesToHHMMSS, secondsToHHMMSS, formatDate, parseWeekDate, autoFitColumns } from "./ExcelExportHelpers";
import { buildCdrSheet } from "./ExcelCdrSheet";
import {
  durationToMinutes,
  calcInboundAnswered,
  calcInboundAnswerRate,
  getPhoneRole,
  getExpectedAnswerRate,
  getAnswerRateStatus,
} from "./ExcelCallLogCalcs";

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

  const periodLabel = formatPeriodLabel(selectedPeriod);
  const uploadedWeeks = selectedPeriod.uploaded_weeks || [];

  const now = new Date();
  const generatedOn = now.toLocaleDateString("en-US", { month:"2-digit", day:"2-digit", year:"numeric" }) +
    " " + now.toLocaleTimeString("en-US", { hour:"numeric", minute:"2-digit", hour12:true });

  // ---- Colors ----
  const DARK_NAVY  = "FF1F3864";
  const SECTION_BG = "FF2E5096";
  const LIGHT_GRAY = "FFF5F5F5";
  const ALT_ROW    = "FFEEF2FA";
  const WHITE      = "FFFFFFFF";
  const HEADER_BG  = "FF344D7E";
  const mkFill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
  const mkFont = (opts) => ({ name: "Calibri", size: 11, ...opts });
  const thinBorder = { style: "thin", color: { argb: "FFDDDDDD" } };

  const addSectionHeader = (ws, text, numCols, startCol = "A") => {
    const row = ws.addRow([text, ...Array(numCols - 1).fill("")]);
    const endCol = String.fromCharCode(startCol.charCodeAt(0) + numCols - 1);
    ws.mergeCells(`${startCol}${ws.rowCount}:${endCol}${ws.rowCount}`);
    const cell = ws.getCell(`${startCol}${ws.rowCount}`);
    cell.font      = mkFont({ bold: true, size: 13, color: { argb: WHITE } });
    cell.fill      = mkFill(SECTION_BG);
    cell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    row.height = 24;
    return row;
  };

  const styleTableHeader = (row, numCols, leftAlignUpTo = 1) => {
    row.height = 30;
    for (let c = 1; c <= numCols; c++) {
      const cell = row.getCell(c);
      cell.font      = mkFont({ bold: true, color: { argb: WHITE } });
      cell.fill      = mkFill(HEADER_BG);
      cell.alignment = { horizontal: c <= leftAlignUpTo ? "left" : "center", vertical: "middle", wrapText: true };
      cell.border    = { bottom: { style: "medium", color: { argb: WHITE } }, right: thinBorder };
    }
  };

  const arColor = (rate) => {
    if (rate === null || rate === undefined) return { bg: WHITE, fg: "FF888888" };
    if (rate >= 0.5)  return { bg: "FFC6EFCE", fg: "FF276221" };
    if (rate >= 0.2)  return { bg: "FFFFEB9C", fg: "FF9C6500" };
    return                   { bg: "FFFFC7CE", fg: "FF9C0006" };
  };

  const perfColor = (pct) => {
    if (pct >= 1.0) return { bg: "FFC6EFCE", fg: "FF276221" };
    if (pct >= 0.9) return { bg: "FFFFEB9C", fg: "FF9C6500" };
    return               { bg: "FFFFC7CE", fg: "FF9C0006" };
  };

  // ---- Build weekly rows ----
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
    const inboundCount = totals.inbound || 0;
    const inboundAnswered = calcInboundAnswered(inboundCount, totals.missed || 0);
    const totalDurMin = durationToMinutes(totals.total_duration_minutes);
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
      missing_snapshot:       !Array.isArray(week.user_snapshot) || week.user_snapshot.length === 0,
    };
  });

  // ---- Build per-user-per-week rows ----
  const userWeekRows = [];
  sortedWeeks.forEach(week => {
    const snapshot = Array.isArray(week.user_snapshot) ? week.user_snapshot : [];
    if (snapshot.length === 0) {
      userWeekRows.push({ _warning: true, week_start: week.week_start, week_end: week.week_end });
      return;
    }
    snapshot.forEach(u => {
      const tc = u.total_calls || 0;
      // Convert duration fields to minutes (handles stored-as-minutes numbers or HH:MM:SS strings)
      const durMin    = durationToMinutes(u.total_duration_minutes);
      const inDurMin  = durationToMinutes(u.inbound_duration_minutes);
      const outDurMin = durationToMinutes(u.outbound_duration_minutes);
      const uInbound  = u.inbound || 0;
      const uMissed   = u.missed  || 0;
      // inbound_answered = max(inbound - missed, 0)
      const uInboundAnswered = calcInboundAnswered(uInbound, uMissed);
      // answer rate as decimal; 0 if no inbound calls
      const uAnswerRate = calcInboundAnswerRate(uInbound, uInboundAnswered);
      // Phone role + expected rate + status
      const phoneRole        = getPhoneRole(u.extension ?? null);
      const expectedRate     = getExpectedAnswerRate(phoneRole);
      const answerRateStatus = uInbound > 0 ? getAnswerRateStatus(uAnswerRate, expectedRate) : "";
      userWeekRows.push({
        week_start:                week.week_start,
        week_end:                  week.week_end,
        user:                      u.user || "",
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
    if (a._warning) return -1;
    if (b._warning) return 1;
    const nc = (a.user || "").localeCompare(b.user || "");
    if (nc !== 0) return nc;
    return (a.week_start || "").localeCompare(b.week_start || "");
  });

  // ---- Create workbook ----
  const wb = new ExcelJS.Workbook();
  wb.creator = "ENTIC Operations Center";
  const wsName = periodLabel.substring(0, 31);
  const ws = wb.addWorksheet(wsName, { views: [{ showGridLines: false }] });

  ws.columns = [
    { width: 14 }, { width: 14 }, { width: 30 }, { width: 13 }, { width: 13 },
    { width: 13 }, { width: 13 }, { width: 11 }, { width: 22 }, { width: 16 }, { width: 24 },
  ];

  // ==============================
  // SECTION 1: EXECUTIVE SUMMARY
  // ==============================
  ws.addRow([`${periodLabel} - Call Log`, ...Array(10).fill("")]);
  ws.mergeCells(`A1:K1`);
  const titleCell = ws.getCell("A1");
  titleCell.font      = mkFont({ bold: true, size: 16, color: { argb: WHITE } });
  titleCell.fill      = mkFill(DARK_NAVY);
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 40;

  ws.addRow([`Reporting Period: ${periodLabel}`]);
  ws.getCell("A2").font = mkFont({ bold: true });
  ws.getRow(2).height = 18;

  ws.addRow([`Generated On: ${generatedOn}`]);
  ws.getCell("A3").font = mkFont({ color: { argb: "FF666666" } });
  ws.getRow(3).height = 18;

  addSectionHeader(ws, "Monthly Summary", 4);

  { const nr = ws.addRow([`Totals on this worksheet reflect operational call log activity. For inbound-only telecom validation from Vonage CDR, see the "Inbound CDR" worksheet.`,"","","","",""]); ws.mergeCells(`A${ws.rowCount}:F${ws.rowCount}`); const nc = ws.getCell(`A${ws.rowCount}`); nc.font = mkFont({ italic: true, size: 9, color: { argb: "FFAAAAAA" } }); nc.alignment = { horizontal: "left", vertical: "middle", wrapText: true }; nr.height = 24; }

  const metrics = [
    ["Total Calls",         totalCalls,                                                                                  "number"],
    ["Inbound",             totalInbound,                                                                                "number"],
    ["Outbound",            totalOutbound,                                                                               "number"],
    ["Inbound Answered",    totalInboundAnswered,                                                                        "number"],
    ["Missed",              totalMissed,                                                                                 "number"],
    ["Inbound Answer Rate", totalInbound > 0 ? calcInboundAnswerRate(totalInbound, totalInboundAnswered) : "",           "percent"],
    ["Total Duration",      secondsToHHMMSS(totalDurationSec),                                                          "text"],
    ["Average Duration",    secondsToHHMMSS(overallAvgDurationSec),                                                     "text"],
  ];
  metrics.forEach(([label, val, type], idx) => {
    const bgArgb = idx % 2 === 0 ? ALT_ROW : WHITE;
    const row = ws.addRow([label, val]);
    row.height = 18;
    const lc = row.getCell(1); const vc = row.getCell(2);
    lc.font = mkFont({ bold: true }); lc.fill = mkFill(bgArgb); lc.alignment = { horizontal: "left", vertical: "middle" };
    vc.font = mkFont({ bold: true, size: 12 }); vc.fill = mkFill(bgArgb); vc.alignment = { horizontal: "right", vertical: "middle" };
    if (type === "number")  vc.numFmt = "#,##0";
    if (type === "percent") vc.numFmt = "0.00%";
    [lc, vc].forEach(c => { c.border = { bottom: thinBorder }; });
  });

  ws.addRow([]);

  // ==============================
  // SECTION 2: WEEKLY SUMMARY
  // ==============================
  addSectionHeader(ws, "Weekly Summary", 10);
  const weekHRow = ws.addRow(["Week Start","Week End","Total Calls","Inbound","Outbound","Answered","Missed","Answer Rate","Total Duration","Avg Duration"]);
  styleTableHeader(weekHRow, 10, 2);

  if (weekRows.length === 0) {
    const er = ws.addRow(["No weekly data found for this month.", ...Array(9).fill("")]);
    ws.mergeCells(`A${ws.rowCount}:J${ws.rowCount}`);
    er.getCell(1).font = mkFont({ italic: true, color: { argb: "FF888888" } });
    er.height = 18;
  } else {
    weekRows.forEach((wk, idx) => {
      const ar = wk.answer_rate;
      const { bg, fg } = arColor(ar);
      const bgArgb = idx % 2 === 0 ? WHITE : LIGHT_GRAY;
      const row = ws.addRow([
        formatDate(wk.week_start), formatDate(wk.week_end),
        wk.total_calls, wk.inbound, wk.outbound, wk.answered, wk.missed,
        ar !== null ? ar : "",
        minutesToHHMMSS(wk.total_duration_minutes),
        minutesToHHMMSS(wk.avg_duration_minutes),
      ]);
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.fill = mkFill(bgArgb); cell.font = mkFont({}); cell.border = { bottom: thinBorder, right: thinBorder };
        cell.alignment = { horizontal: colNum <= 2 ? "left" : "center", vertical: "middle" };
        if ([3,4,5,6,7].includes(colNum)) cell.numFmt = "#,##0";
        if (colNum === 8 && ar !== null) { cell.numFmt = "0.00%"; cell.fill = mkFill(bg); cell.font = mkFont({ color: { argb: fg } }); }
      });
    });
  }

  ws.addRow([]);

  // ==============================
  // SECTION 3: FULL USER BREAKDOWN
  // ==============================
  addSectionHeader(ws, "Full User Breakdown (All Weeks)", 11);
  const instrHint = ws.addRow(["To view a specific week, use the Week Start filter in the table header.", ...Array(10).fill("")]);
  ws.mergeCells(`A${ws.rowCount}:K${ws.rowCount}`);
  instrHint.height = 16;
  instrHint.getCell(1).font      = mkFont({ italic: true, size: 9, color: { argb: "FFAAAAAA" } });
  instrHint.getCell(1).alignment = { horizontal: "left", vertical: "middle" };

  const userTableStartRow = ws.rowCount + 1;

  const realUserRows = userWeekRows
    .filter(u => !u._warning && (u.total_calls || 0) > 0)
    .sort((a, b) => {
      const aHasAr = a.answer_rate !== null && a.answer_rate !== undefined;
      const bHasAr = b.answer_rate !== null && b.answer_rate !== undefined;
      if (aHasAr && !bHasAr) return -1;
      if (!aHasAr && bHasAr) return 1;
      if (aHasAr && bHasAr && a.answer_rate !== b.answer_rate) return a.answer_rate - b.answer_rate;
      return (a.user || "").localeCompare(b.user || "");
    });

  if (realUserRows.length === 0) {
    const er = ws.addRow(["No user-level weekly data found.", ...Array(10).fill("")]);
    ws.mergeCells(`A${ws.rowCount}:K${ws.rowCount}`);
    er.getCell(1).font = mkFont({ italic: true, color: { argb: "FF888888" } }); er.height = 18;
  } else {
    const userHRow = ws.addRow(["Week Start","Week End","User","Total Calls","Inbound","Outbound","Answered","Missed","Total Duration","Answer Rate","Avg Duration"]);
    styleTableHeader(userHRow, 11);
    ws.views = [{ showGridLines: false, state: "frozen", ySplit: userTableStartRow, xSplit: 0 }];

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
      const row = ws.addRow(rowValues);
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.fill = mkFill(bgArgb); cell.font = mkFont({}); cell.border = { bottom: thinBorder, right: thinBorder };
        cell.alignment = { horizontal: colNum <= 3 ? "left" : "center", vertical: "middle" };
        if ([4,5,6,7,8].includes(colNum)) cell.numFmt = "#,##0";
        if (colNum === 10 && ar !== null) { cell.numFmt = "0.00%"; cell.fill = mkFill(bg); cell.font = mkFont({ color: { argb: fg } }); }
      });
      tableRows.push(rowValues);
    });

    ws.addTable({
      name: "UserBreakdown",
      ref: `A${userTableStartRow}:K${ws.rowCount}`,
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

  // ==============================
  // PIVOT DATA SHEET
  // ==============================
  const wsPivot = wb.addWorksheet("Pivot Data", { views: [{ showGridLines: true, state: "frozen", ySplit: 1, xSplit: 0 }] });
  wsPivot.columns = [
    { header: "Week Start",     key: "week_start",             width: 16 },
    { header: "Week End",       key: "week_end",               width: 16 },
    { header: "User",           key: "user",                   width: 30 },
    { header: "Total Calls",    key: "total_calls",            width: 14 },
    { header: "Inbound",        key: "inbound",                width: 12 },
    { header: "Outbound",       key: "outbound",               width: 12 },
    { header: "Answered",       key: "answered",               width: 12 },
    { header: "Missed",         key: "missed",                 width: 12 },
    { header: "Total Duration", key: "total_duration_minutes", width: 22 },
    { header: "Answer Rate",    key: "answer_rate",            width: 14 },
    { header: "Avg Duration",   key: "avg_duration_minutes",   width: 22 },
  ];
  const pivotHeaderRow = wsPivot.getRow(1);
  pivotHeaderRow.height = 20;
  pivotHeaderRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = mkFont({ bold: true, color: { argb: WHITE } }); cell.fill = mkFill(DARK_NAVY);
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { bottom: { style: "medium", color: { argb: WHITE } }, right: thinBorder };
  });

  const pivotDataRows = [];
  userWeekRows.filter(u => !u._warning && (u.total_calls || 0) > 0).forEach(u => {
    pivotDataRows.push({
      week_start:             parseWeekDate(u.week_start),
      week_end:               parseWeekDate(u.week_end),
      user:                   u.user || "",
      total_calls:            u.total_calls,
      inbound:                u.inbound,
      outbound:               u.outbound,
      answered:               u.answered,
      missed:                 u.missed,
      total_duration_minutes: minutesToHHMMSS(u.total_duration_minutes),
      answer_rate:            u.answer_rate !== null && u.answer_rate !== undefined ? u.answer_rate : "",
      avg_duration_minutes:   minutesToHHMMSS(u.avg_duration_minutes),
    });
  });

  pivotDataRows.forEach((rowData, idx) => {
    const row = wsPivot.addRow(rowData);
    row.height = 17;
    const bgArgb = idx % 2 === 0 ? WHITE : ALT_ROW;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill = mkFill(bgArgb); cell.font = mkFont({}); cell.border = { bottom: thinBorder, right: thinBorder };
      cell.alignment = { horizontal: colNum <= 3 ? "left" : "center", vertical: "middle" };
      if (colNum === 1 || colNum === 2) cell.numFmt = "mmm d, yyyy";
      if ([4,5,6,7,8].includes(colNum)) cell.numFmt = "#,##0";
      if (colNum === 10 && rowData.answer_rate !== "") {
        cell.numFmt = "0.00%";
        const { bg, fg } = arColor(rowData.answer_rate);
        cell.fill = mkFill(bg); cell.font = mkFont({ color: { argb: fg } });
      }
    });
  });

  if (pivotDataRows.length > 0) {
    wsPivot.addTable({
      name: "PivotSource",
      ref: `A1:K${1 + pivotDataRows.length}`,
      headerRow: true, totalsRow: false,
      style: { theme: "TableStyleLight9", showRowStripes: true },
      columns: [
        { name: "Week Start", filterButton: true }, { name: "Week End", filterButton: true },
        { name: "User", filterButton: true }, { name: "Total Calls", filterButton: true },
        { name: "Inbound", filterButton: true }, { name: "Outbound", filterButton: true },
        { name: "Answered", filterButton: true }, { name: "Missed", filterButton: true },
        { name: "Total Duration", filterButton: true }, { name: "Answer Rate", filterButton: true },
        { name: "Avg Duration", filterButton: true },
      ],
      rows: pivotDataRows.map(r => [
        r.week_start, r.week_end, r.user, r.total_calls, r.inbound,
        r.outbound, r.answered, r.missed, r.total_duration_minutes,
        r.answer_rate, r.avg_duration_minutes
      ]),
    });
    const instrRow2 = wsPivot.addRow(["➤ To build a Pivot Table with Week Slicer: Select any cell in the table above → Insert → PivotTable → Add to New Sheet → Drag 'User' to Rows, metrics to Values, 'Week Start' to Filters → Insert → Slicer → Select 'Week Start'."]);
    wsPivot.mergeCells(`A${wsPivot.rowCount}:K${wsPivot.rowCount}`);
    instrRow2.getCell(1).font = mkFont({ italic: true, size: 10, color: { argb: "FF555555" } });
    instrRow2.getCell(1).alignment = { wrapText: true };
    instrRow2.height = 30;
  }

  autoFitColumns(ws);
  wsPivot.state = "hidden";

  // ==============================
  // LOAD USER CONFIGS
  // ==============================
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

  const LOCATION_GOALS = {
    Bloomfield:  { check_in: 34, check_out: 35 },
    Manchester:  { check_in: 28, check_out: 30 },
    Glastonbury: { check_in: 22, check_out: 25 },
    Farmington:  { check_in: 8,  check_out: 14, phone_only: 32 },
  };
  const WORK_DAYS_PER_WEEK = 5;

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

  // ==============================
  // SHEET 2: DESK PERFORMANCE
  // ==============================
  const wsDesk = wb.addWorksheet("Front End Performance", { views: [{ showGridLines: false }] });
  wsDesk.columns = [
    { width: 18 }, { width: 34 }, { width: 16 }, { width: 18 }, { width: 14 }, { width: 18 },
  ];

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

  const SUMMARY_BG = "FFE8F0FE"; const CARD_BORDER_COLOR = "FF2E5096";
  const CARD_W = 4; const CARD_GAP = 1; const CARDS_PER_ROW = 3; const CARD_H = 5;

  const applyCardBorder = (wsheet, startRow, startCol, numRows, numCols) => {
    const borderColor = { argb: CARD_BORDER_COLOR };
    for (let r = startRow; r < startRow + numRows; r++) {
      for (let c = startCol; c < startCol + numCols; c++) {
        const cell = wsheet.getCell(r, c);
        cell.border = {
          top:    r === startRow    ? { style: "medium", color: borderColor } : cell.border?.top,
          bottom: r === startRow + numRows - 1 ? { style: "medium", color: borderColor } : cell.border?.bottom,
          left:   c === startCol   ? { style: "medium", color: borderColor } : cell.border?.left,
          right:  c === startCol + numCols - 1 ? { style: "medium", color: borderColor } : cell.border?.right,
        };
      }
    }
  };

  const renderCard = (wsheet, startRow, startCol, headerText, cardMetrics) => {
    const hdrCell = wsheet.getCell(startRow, startCol);
    hdrCell.value = headerText;
    hdrCell.font = mkFont({ bold: true, size: 10, color: { argb: WHITE } }); hdrCell.fill = mkFill(DARK_NAVY);
    hdrCell.alignment = { horizontal: "center", vertical: "middle" };
    wsheet.getRow(startRow).height = 20;
    wsheet.mergeCells(startRow, startCol, startRow, startCol + CARD_W - 1);
    cardMetrics.forEach(([label, val, type], mi) => {
      const r = startRow + 1 + mi;
      wsheet.getRow(r).height = 17;
      for (let c = startCol; c < startCol + CARD_W; c++) wsheet.getCell(r, c).fill = mkFill(SUMMARY_BG);
      const lc = wsheet.getCell(r, startCol); const vc = wsheet.getCell(r, startCol + CARD_W - 1);
      lc.value = label; lc.font = mkFont({ size: 9, color: { argb: "FF444444" } }); lc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      vc.value = val; vc.font = mkFont({ bold: true, size: 10 }); vc.alignment = { horizontal: "right", vertical: "middle", indent: 1 };
      if (type === "number")  vc.numFmt = "#,##0";
      if (type === "percent") vc.numFmt = "0.00%";
    });
    applyCardBorder(wsheet, startRow, startCol, CARD_H, CARD_W);
  };

  [1,2,3,4].forEach((c,i) => wsDesk.getColumn(c).width = [18,12,12,12][i]);
  wsDesk.getColumn(5).width = 1;
  [6,7,8,9].forEach((c,i) => wsDesk.getColumn(c).width = [18,12,12,12][i]);
  wsDesk.getColumn(10).width = 1;
  [11,12,13,14].forEach((c,i) => wsDesk.getColumn(c).width = [18,12,12,12][i]);

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

  const deskSectionRow = wsDesk.addRow(["Detailed Front End Performance by Week", "", "", "", "", ""]);
  wsDesk.mergeCells(`A${wsDesk.rowCount}:F${wsDesk.rowCount}`);
  const deskSectionCell = wsDesk.getCell(`A${wsDesk.rowCount}`);
  deskSectionCell.font = mkFont({ bold: true, size: 13, color: { argb: WHITE } }); deskSectionCell.fill = mkFill(SECTION_BG);
  deskSectionCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 }; deskSectionRow.height = 24;

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
      cell.alignment = { horizontal: colNum <= 3 ? "left" : "center", vertical: "middle" };
      if ([4,5].includes(colNum)) cell.numFmt = "#,##0";
      if (colNum === 6) { cell.numFmt = "0.00%"; if (d.weeklyGoal > 0) { cell.fill = mkFill(bg); cell.font = mkFont({ color: { argb: fg } }); } }
    });
    deskTableRows.push(rowValues);
  });

  if (deskRows.length > 0) {
    wsDesk.addTable({ name: "DeskPerformance", ref: `A${deskTableStartRow}:F${wsDesk.rowCount}`, headerRow: true, totalsRow: false,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: [{ name: "Week Start", filterButton: true }, { name: "Desk", filterButton: true }, { name: "Location", filterButton: true },
        { name: "Total Answered", filterButton: true }, { name: "Weekly Goal", filterButton: true }, { name: "% of Weekly Goal", filterButton: true }],
      rows: deskTableRows,
    });
  }
  autoFitColumns(wsDesk);

  // ==============================
  // SHEET 3: INDIVIDUAL PERFORMANCE
  // ==============================
  const wsIndiv = wb.addWorksheet("Individual Performance", { views: [{ showGridLines: false }] });
  wsIndiv.columns = [{ width: 18 }, { width: 30 }, { width: 34 }, { width: 16 }, { width: 14 }, { width: 14 }, { width: 18 }];

  const indivRows = [];
  sortedWeeks.forEach(week => {
    const snapshot = Array.isArray(week.user_snapshot) ? week.user_snapshot : [];
    snapshot.forEach(u => {
      const userName = u.user || "";
      const answered = u.answered || 0;
      const eligible = isFrontDeskBenchmark(userName);
      const weeklyGoal = eligible ? getDeskGoal(userName) : 0;
      if (eligible && weeklyGoal > 0) {
        indivRows.push({ week_start: week.week_start, user: userName, desk: userName, location: getUserLocation(userName), answered, weeklyGoal, percentOfGoal: answered / weeklyGoal, isDeskUser: true });
      } else {
        indivRows.push({ week_start: week.week_start, user: userName, desk: "", location: getUserLocation(userName), answered, weeklyGoal: null, percentOfGoal: null, isDeskUser: false });
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

  wsIndiv.addRow([`${periodLabel} – Individual Performance`, "", "", "", "", "", ""]); wsIndiv.mergeCells("A1:G1");
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
  wsIndiv.addRow([]); wsIndiv.getRow(wsIndiv.rowCount).height = 6;

  const indivSectionRow = wsIndiv.addRow(["Detailed Individual Performance by Week", "", "", "", "", "", ""]);
  wsIndiv.mergeCells(`A${wsIndiv.rowCount}:G${wsIndiv.rowCount}`);
  const indivSectionCell = wsIndiv.getCell(`A${wsIndiv.rowCount}`);
  indivSectionCell.font = mkFont({ bold: true, size: 13, color: { argb: WHITE } }); indivSectionCell.fill = mkFill(SECTION_BG);
  indivSectionCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 }; indivSectionRow.height = 24;

  const indivTableStartRow = wsIndiv.rowCount + 1;
  const indivHRow = wsIndiv.addRow(["Week Start", "User", "Desk", "Location", "Answered", "Weekly Goal", "% of Weekly Goal"]);
  styleTableHeader(indivHRow, 7, 4);
  wsIndiv.views = [{ showGridLines: false, state: "frozen", ySplit: indivTableStartRow, xSplit: 0 }];

  const indivTableRows = [];
  indivRows.forEach((r, idx) => {
    const bgArgb = idx % 2 === 0 ? WHITE : ALT_ROW;
    const rowValues = [
      formatDate(r.week_start), r.user, r.desk || "", r.location || "", r.answered,
      r.weeklyGoal !== null && r.weeklyGoal !== undefined ? r.weeklyGoal : "",
      r.percentOfGoal !== null && r.percentOfGoal !== undefined ? r.percentOfGoal : "",
    ];
    const row = wsIndiv.addRow(rowValues); row.height = 18;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill = mkFill(bgArgb); cell.font = mkFont({}); cell.border = { bottom: thinBorder, right: thinBorder };
      cell.alignment = { horizontal: colNum <= 4 ? "left" : "center", vertical: "middle" };
      if (colNum === 5) cell.numFmt = "#,##0";
      if (colNum === 6 && r.weeklyGoal !== null && r.weeklyGoal !== undefined) cell.numFmt = "#,##0";
      if (colNum === 7) {
        cell.numFmt = "0.00%";
        if (r.percentOfGoal !== null && r.percentOfGoal !== undefined) {
          const { bg, fg } = perfColor(r.percentOfGoal); cell.fill = mkFill(bg); cell.font = mkFont({ color: { argb: fg } });
        }
      }
    });
    indivTableRows.push(rowValues);
  });

  if (indivRows.length > 0) {
    wsIndiv.addTable({ name: "IndividualPerformance", ref: `A${indivTableStartRow}:G${wsIndiv.rowCount}`, headerRow: true, totalsRow: false,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: [{ name: "Week Start", filterButton: true }, { name: "User", filterButton: true }, { name: "Desk", filterButton: true },
        { name: "Location", filterButton: true }, { name: "Answered", filterButton: true },
        { name: "Weekly Goal", filterButton: true }, { name: "% of Weekly Goal", filterButton: true }],
      rows: indivTableRows,
    });
  }
  autoFitColumns(wsIndiv);

  // ==============================
  // INBOUND CDR WORKSHEET
  // ==============================
  await buildCdrSheet(wb, { periodLabel, generatedOn, cdrUploadData, mkFill, mkFont, thinBorder, addSectionHeader, styleTableHeader, arColor, DARK_NAVY, ALT_ROW, WHITE, LIGHT_GRAY });

  // ---- Download ----
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${periodLabel} – Call Performance Report.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}