/**
 * ExcelNormalizedDataSheet.jsx
 *
 * Builds the hidden "Normalized_Call_Data" worksheet.
 *
 * PURPOSE:
 * This sheet documents the data normalization logic and provides a flat,
 * audit-ready table of all processed call metrics used in KPI calculations.
 *
 * DATA SOURCE ARCHITECTURE NOTE:
 * ─────────────────────────────────────────────────────────────────────────────
 * The system ingests TWO distinct Vonage data sources:
 *
 *  1. OPERATIONAL KPIs  → Vonage Inbound CDR ("Inbound Calls" export)
 *     • Row-per-call-segment data
 *     • Contains: Direction, Result, Duration, Start Time, User/Extension
 *     • Used for: Answer Rate %, Abandoned Calls, Talk Time
 *     • Limitation: Does not include a universal cross-session Call ID in
 *       Vonage Business exports; deduplication is based on direction=Inbound
 *       and result=Answered vs Unanswered.
 *
 *  2. USER ACTIVITY METRICS → Vonage User Summary (Aggregated) export
 *     • Pre-aggregated per-user totals (already collapsed by Vonage)
 *     • Contains: Total Calls, Inbound, Outbound, Answered, Missed, Duration
 *     • IMPORTANT: Each hunt group ring / rollover attempt is counted separately
 *       by Vonage BEFORE aggregation. This inflates Missed Calls at the
 *       extension level — one patient call routed to 3 extensions may appear
 *       as 3 missed + 1 answered across the team.
 *     • Used for: User productivity, outbound activity, talk time per user
 *     • NOT suitable for: Operational answer rate, unique call counts
 *
 * NORMALIZATION APPROACH:
 * ─────────────────────────────────────────────────────────────────────────────
 * • Section A (Executive KPIs) uses CDR data when available.
 *   When CDR is not uploaded, Section A displays estimated metrics with a
 *   clear warning that values are derived from extension-level activity counts.
 *
 * • Section B (User Activity) always uses User Summary data.
 *   These metrics represent individual staff activity, not unique patient calls.
 */

export function buildNormalizedDataSheet(wb, {
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
}) {
  const ws = wb.addWorksheet("Normalized_Call_Data", { views: [{ showGridLines: false }] });
  ws.state = "veryHidden";
  ws.properties.tabColor = { argb: "FF4A4A4A" }; // Dark Charcoal

  ws.columns = [
    { width: 28 }, { width: 16 }, { width: 16 }, { width: 16 }, { width: 16 },
    { width: 16 }, { width: 16 }, { width: 18 }, { width: 18 }, { width: 20 },
  ];

  // ── Title ────────────────────────────────────────────────────────────────────
  ws.addRow(["Normalized_Call_Data — Data Architecture & Audit Layer", ...Array(9).fill("")]);
  ws.mergeCells(`A1:J1`);
  const titleCell = ws.getCell("A1");
  titleCell.font      = mkFont({ bold: true, size: 15, color: { argb: "FFFFFFFF" } });
  titleCell.fill      = mkFill(DARK_NAVY);
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 36;

  // ── Data Source Legend ───────────────────────────────────────────────────────
  ws.addRow([]); ws.getRow(ws.rowCount).height = 6;
  addSectionHeader(ws, "Data Source Architecture", 10);

  const legendRows = [
    ["SOURCE", "DATA TYPE", "FIELDS AVAILABLE", "USED FOR", "LIMITATION"],
    [
      "Vonage Inbound CDR",
      "Row-per-call",
      "Direction, Result, Duration, User, Extension, Start Time",
      "Operational KPIs: Answer Rate, Abandoned Calls, Talk Time",
      "Does not include cross-session Call ID in Business export tier"
    ],
    [
      "Vonage User Summary",
      "Pre-aggregated per user",
      "Total/Inbound/Outbound/Answered/Missed Calls, Duration",
      "User Activity: Staff productivity, outbound, talk time",
      "Hunt group rings counted per extension — inflates Missed Calls. NOT suitable for unique-call KPIs."
    ],
  ];

  legendRows.forEach((row, idx) => {
    const r = ws.addRow(row);
    r.height = idx === 0 ? 22 : 32;
    const isHeader = idx === 0;
    r.eachCell({ includeEmpty: true }, (cell, colNum) => {
      if (isHeader) {
        cell.font = mkFont({ bold: true, color: { argb: "FFFFFFFF" } });
        cell.fill = mkFill("FF344D7E");
      } else {
        cell.font = mkFont({ size: 10 });
        cell.fill = mkFill(idx % 2 === 0 ? ALT_ROW : WHITE);
      }
      cell.border = { bottom: thinBorder, right: thinBorder };
      cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    });
  });

  // ── KPI Methodology ──────────────────────────────────────────────────────────
  ws.addRow([]); ws.getRow(ws.rowCount).height = 6;
  addSectionHeader(ws, "KPI Calculation Methodology", 10);

  const methodRows = [
    ["METRIC", "SECTION", "DATA SOURCE", "FORMULA", "NOTES"],
    ["Total Unique Inbound Calls", "A – Operational", "CDR (preferred) / User Summary fallback", "COUNT of inbound call segments", "CDR: direction=Inbound rows. Fallback: sum of user inbound counts (may double-count routed calls)"],
    ["Calls Successfully Answered", "A – Operational", "CDR (preferred) / User Summary fallback", "COUNT where result=Answered", "CDR gives call-segment outcome. Fallback: inbound − missed per user"],
    ["Calls Abandoned/Missed", "A – Operational", "CDR (preferred) / User Summary fallback", "Inbound − Answered", "True abandonment = caller hung up before reaching any staff. User Summary cannot distinguish this from routing failures."],
    ["Answer Rate %", "A – Operational", "CDR (preferred) / User Summary fallback", "Answered ÷ Total Inbound", "CDR-based rate is more accurate. User Summary rate is inflated-denominator estimate."],
    ["Average Talk Time", "A – Operational", "CDR", "Total answered duration ÷ Answered calls", "Inbound duration only"],
    ["Outbound Calls", "B – User Activity", "User Summary", "SUM of outbound calls per user", "Staff-initiated calls only"],
    ["Calls Handled per User", "B – User Activity", "User Summary", "SUM of answered calls per user", "Includes both inbound answered and outbound calls"],
    ["Total Talk Time per User", "B – User Activity", "User Summary", "SUM of total call duration", "All directions combined"],
    ["Answer Rate per User", "B – User Activity", "User Summary", "(Inbound − Missed) ÷ Inbound", "Per-extension rate — inflated by routing. For trend analysis only, not absolute KPI."],
  ];

  methodRows.forEach((row, idx) => {
    const r = ws.addRow(row);
    r.height = idx === 0 ? 22 : 28;
    const isHeader = idx === 0;
    r.eachCell({ includeEmpty: true }, (cell) => {
      if (isHeader) {
        cell.font = mkFont({ bold: true, color: { argb: "FFFFFFFF" } });
        cell.fill = mkFill("FF344D7E");
      } else {
        cell.font = mkFont({ size: 10 });
        cell.fill = mkFill(idx % 2 === 0 ? ALT_ROW : WHITE);
      }
      cell.border = { bottom: thinBorder, right: thinBorder };
      cell.alignment = { horizontal: "left", vertical: "middle", wrapText: true };
    });
  });

  // ── CDR Availability Status ──────────────────────────────────────────────────
  ws.addRow([]); ws.getRow(ws.rowCount).height = 6;
  addSectionHeader(ws, "CDR Data Status for This Period", 10);

  const cdrStatusRow = ws.addRow([
    cdrUploadData
      ? "✓ CDR DATA AVAILABLE — Operational KPIs in Section A are CDR-sourced (more accurate)"
      : "⚠ NO CDR DATA — Section A Operational KPIs are estimated from User Summary. Upload the Vonage Inbound CDR export for accurate answer rate metrics.",
    ...Array(9).fill("")
  ]);
  ws.mergeCells(`A${ws.rowCount}:J${ws.rowCount}`);
  cdrStatusRow.height = 28;
  const cdrStatusCell = ws.getCell(`A${ws.rowCount}`);
  cdrStatusCell.font      = mkFont({ bold: true, size: 11, color: { argb: cdrUploadData ? "FF276221" : "FF9C0006" } });
  cdrStatusCell.fill      = mkFill(cdrUploadData ? "FFC6EFCE" : "FFFFC7CE");
  cdrStatusCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  cdrStatusCell.border    = { bottom: thinBorder };

  if (cdrUploadData) {
    const cdrMetaRows = [
      ["CDR Period Key",    cdrUploadData.reporting_period_key  || ""],
      ["Total Inbound",     cdrUploadData.total_inbound_calls   || 0],
      ["Total Answered",    cdrUploadData.total_inbound_answered || 0],
      ["Total Unanswered",  cdrUploadData.total_unanswered      || 0],
      ["Answer Rate",       cdrUploadData.total_inbound_calls > 0
          ? (Math.min(cdrUploadData.total_inbound_answered, cdrUploadData.total_inbound_calls) / cdrUploadData.total_inbound_calls)
          : 0
      ],
    ];
    cdrMetaRows.forEach(([label, val], idx) => {
      const r = ws.addRow([label, val, ...Array(8).fill("")]);
      r.height = 18;
      r.getCell(1).font = mkFont({ bold: true }); r.getCell(1).fill = mkFill(idx % 2 === 0 ? ALT_ROW : WHITE);
      r.getCell(2).font = mkFont({ bold: true, size: 12 }); r.getCell(2).fill = mkFill(idx % 2 === 0 ? ALT_ROW : WHITE);
      if (label === "Answer Rate") r.getCell(2).numFmt = "0.00%";
      else if (typeof val === "number") r.getCell(2).numFmt = "#,##0";
      r.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
      r.getCell(2).alignment = { horizontal: "right", vertical: "middle" };
      r.getCell(1).border = { bottom: thinBorder }; r.getCell(2).border = { bottom: thinBorder };
    });
  }

  // ── Normalized User-Week Data Table ──────────────────────────────────────────
  ws.addRow([]); ws.getRow(ws.rowCount).height = 6;
  addSectionHeader(ws, "Normalized User-Week Activity Data (User Summary Source)", 10);

  const noteRow = ws.addRow([
    "NOTE: These are extension-level activity counts from the Vonage User Summary. Missed Calls here may include hunt-group routing attempts, not purely abandoned patient calls.",
    ...Array(9).fill("")
  ]);
  ws.mergeCells(`A${ws.rowCount}:J${ws.rowCount}`);
  noteRow.height = 22;
  const noteCell = ws.getCell(`A${ws.rowCount}`);
  noteCell.font      = mkFont({ italic: true, size: 9, color: { argb: "FFAA6600" } });
  noteCell.fill      = mkFill("FFFFF4CE");
  noteCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  noteCell.border    = { bottom: thinBorder };

  const tableStartRow = ws.rowCount + 1;
  const hdr = ws.addRow([
    "Week Start", "Week End", "User", "Total Calls", "Inbound", "Outbound",
    "Answered", "Missed", "Total Duration", "Ext-Level Answer Rate"
  ]);
  hdr.height = 22;
  hdr.eachCell({ includeEmpty: true }, (cell) => {
    cell.font      = mkFont({ bold: true, color: { argb: "FFFFFFFF" } });
    cell.fill      = mkFill("FF344D7E");
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border    = { bottom: thinBorder, right: thinBorder };
  });

  const benchmarkNames = new Set(
    exportUserConfigs
      .filter(cfg => coerceBool(cfg.include_in_benchmark))
      .map(cfg => (cfg.user_name || "").trim().toLowerCase())
  );

  const dataRows = userWeekRows
    .filter(u => !u._warning && benchmarkNames.has((u.user || "").trim().toLowerCase()))
    .map(u => [
      formatDate(u.week_start),
      formatDate(u.week_end),
      u.user || "",
      u.total_calls || 0,
      u.inbound || 0,
      u.outbound || 0,
      u.answered || 0,
      u.missed || 0,
      minutesToHHMMSS(u.total_duration_minutes || 0),
      u.inbound > 0 ? u.answered / u.inbound : "",
    ]);

  dataRows.forEach((rowValues, idx) => {
    const r = ws.addRow(rowValues);
    r.height = 18;
    r.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill      = mkFill(idx % 2 === 0 ? WHITE : ALT_ROW);
      cell.font      = mkFont({ size: 10 });
      cell.border    = { bottom: thinBorder, right: thinBorder };
      cell.alignment = { horizontal: colNum <= 3 ? "left" : "center", vertical: "middle" };
      if ([4, 5, 6, 7, 8].includes(colNum)) cell.numFmt = "#,##0";
      if (colNum === 10 && rowValues[9] !== "") cell.numFmt = "0.00%";
    });
  });

  if (dataRows.length > 0) {
    ws.addTable({
      name: "NormalizedUserWeekData",
      ref: `A${tableStartRow}:J${tableStartRow + dataRows.length}`,
      headerRow: true,
      totalsRow: false,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: [
        { name: "Week Start",               filterButton: true },
        { name: "Week End",                 filterButton: true },
        { name: "User",                     filterButton: true },
        { name: "Total Calls",              filterButton: true },
        { name: "Inbound",                  filterButton: true },
        { name: "Outbound",                 filterButton: true },
        { name: "Answered",                 filterButton: true },
        { name: "Missed",                   filterButton: true },
        { name: "Total Duration",           filterButton: true },
        { name: "Ext-Level Answer Rate",    filterButton: true },
      ],
      rows: dataRows,
    });
  }

  return ws;
}