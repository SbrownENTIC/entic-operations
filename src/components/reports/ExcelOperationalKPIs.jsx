/**
 * ExcelOperationalKPIs.js
 *
 * Builds the "Operational KPIs" worksheet — executive-facing metrics based on
 * TRUE unique call deduplication (one row per Call ID, not per extension ring event).
 *
 * This sheet is the answer to the "routing inflation" problem:
 * - Raw CDR: 1 call answered after ringing 12 extensions → 11 missed + 1 answered
 * - Normalized: that same call = 1 answered call (correct operational truth)
 */

import { formatSeconds } from "./CdrNormalization";

export function buildOperationalKPIsSheet(wb, {
  periodLabel, generatedOn,
  normalizedCalls, summary, hourlyBreakdown, locationBreakdown,
  mkFill, mkFont, thinBorder,
  DARK_NAVY, SECTION_BG, ALT_ROW, WHITE, LIGHT_GRAY, HEADER_BG,
  addSectionHeader, arColor,
}) {
  const ws = wb.addWorksheet("Operational KPIs", { views: [{ showGridLines: false }] });
  ws.properties.tabColor = { argb: "FFE65100" }; // Deep Orange — operationally distinct

  ws.columns = [
    { width: 32 }, { width: 18 }, { width: 18 }, { width: 18 },
    { width: 18 }, { width: 18 }, { width: 18 }, { width: 22 },
  ];

  // ── Title ──────────────────────────────────────────────────────────────────
  ws.addRow([`${periodLabel} – Operational Call Performance (True Unique Calls)`, ...Array(7).fill("")]);
  ws.mergeCells("A1:H1");
  const titleCell = ws.getCell("A1");
  titleCell.font      = mkFont({ bold: true, size: 17, color: { argb: "FFFFFFFF" } });
  titleCell.fill      = mkFill(DARK_NAVY);
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 44;

  ws.addRow([`Reporting Period: ${periodLabel}`, "", "", `Generated: ${generatedOn}`, ...Array(4).fill("")]);
  ws.getCell("A2").font = mkFont({ bold: true, size: 11 });
  ws.getCell("D2").font = mkFont({ color: { argb: "FF666666" }, size: 10 });
  ws.getRow(2).height = 20;

  // ── Methodology note ────────────────────────────────────────────────────────
  ws.addRow(["✅ These metrics are based on UNIQUE CALL IDs — each patient interaction counts once, regardless of how many extensions were rung.", ...Array(7).fill("")]);
  ws.mergeCells("A3:H3");
  const methodNote = ws.getCell("A3");
  methodNote.font      = mkFont({ bold: true, size: 10, color: { argb: "FF276221" } });
  methodNote.fill      = mkFill("FFC6EFCE");
  methodNote.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  ws.getRow(3).height = 20;

  ws.addRow(["⚠ COMPARE TO USER ACTIVITY sheet: If those numbers look much higher for Missed Calls, that's routing inflation — not real missed calls.", ...Array(7).fill("")]);
  ws.mergeCells("A4:H4");
  const compareNote = ws.getCell("A4");
  compareNote.font      = mkFont({ italic: true, size: 9, color: { argb: "FF9C6500" } });
  compareNote.fill      = mkFill("FFFFEB9C");
  compareNote.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
  ws.getRow(4).height = 18;

  ws.addRow([]); ws.getRow(5).height = 8;

  if (!summary || summary.total_unique_inbound === 0) {
    const noDataRow = ws.addRow(["No CDR data available. Upload CDR inbound/outbound files to see operational KPIs.", ...Array(7).fill("")]);
    ws.mergeCells(`A${ws.rowCount}:H${ws.rowCount}`);
    noDataRow.getCell(1).font = mkFont({ italic: true, color: { argb: "FF888888" } });
    noDataRow.height = 30;
    return ws;
  }

  // ── Section A: Executive KPI Summary ──────────────────────────────────────
  addSectionHeader(ws, "A. Executive KPI Summary — True Inbound Performance", 4);

  const kpiMetrics = [
    ["Total Unique Inbound Calls",   summary.total_unique_inbound,  "number",  "Total distinct patient calls received (by Call ID)"],
    ["Calls Successfully Answered",  summary.inbound_answered,      "number",  "Calls where any staff member picked up (duration > 0)"],
    ["Calls Went to Voicemail",      summary.inbound_voicemail,     "number",  "Caller reached voicemail (not truly missed — message left)"],
    ["Calls Truly Missed/Abandoned", summary.inbound_truly_missed,  "number",  "Caller hung up before anyone answered or voicemail picked up"],
    ["Inbound Answer Rate",          summary.inbound_answer_rate,   "percent", "Answered ÷ Total Unique Inbound (the correct operational rate)"],
    ["Abandonment Rate",             summary.abandonment_rate,      "percent", "Truly Missed ÷ Total Unique Inbound"],
    ["Avg Talk Time",                formatSeconds(summary.avg_talk_seconds), "text", "Average conversation duration for answered calls"],
    ["Avg Speed to Answer",          formatSeconds(summary.avg_speed_to_answer_seconds), "text", "Average time from first ring to answer"],
    ["Total Outbound Calls",         summary.total_unique_outbound, "number",  "Unique outbound calls made by staff"],
  ];

  kpiMetrics.forEach(([label, val, type, description], idx) => {
    const bgArgb = idx % 2 === 0 ? ALT_ROW : WHITE;
    const row = ws.addRow([label, val, "", description]);
    row.height = 19;
    const lc = row.getCell(1);
    const vc = row.getCell(2);
    const dc = row.getCell(4);
    lc.font = mkFont({ bold: true }); lc.fill = mkFill(bgArgb); lc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    vc.font = mkFont({ bold: true, size: 13 }); vc.fill = mkFill(bgArgb); vc.alignment = { horizontal: "center", vertical: "middle" };
    dc.font = mkFont({ italic: true, size: 9, color: { argb: "FF666666" } }); dc.fill = mkFill(bgArgb); dc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    if (type === "number") vc.numFmt = "#,##0";
    if (type === "percent") {
      vc.numFmt = "0.00%";
      const { bg, fg } = arColor(val);
      vc.fill = mkFill(bg);
      vc.font = mkFont({ bold: true, size: 13, color: { argb: fg } });
    }
    [lc, vc].forEach(c => { c.border = { bottom: thinBorder }; });
  });

  ws.addRow([]); ws.getRow(ws.rowCount).height = 8;

  // ── Routing Inflation Reference ──────────────────────────────────────────
  addSectionHeader(ws, "Routing Inflation Reference (Why Raw CDR Metrics Are Misleading)", 4);

  const inflationRows = [
    ["Total Raw CDR Rows (All Events)",      summary.total_raw_cdr_rows,              "number", "Every ring attempt to every extension — the inflated raw count"],
    ["Total Unique Calls (Normalized)",      summary.total_unique_inbound + summary.total_unique_outbound, "number", "After deduplication — the true call count"],
    ["Avg Routing Events per Call",          summary.avg_routing_events_per_call,     "decimal", "Avg number of extension rings per patient call"],
    ["Inflation Factor",
      summary.total_unique_inbound > 0
        ? Math.round(summary.total_raw_cdr_rows / (summary.total_unique_inbound + summary.total_unique_outbound) * 10) / 10
        : 0,
      "decimal", "Raw events ÷ unique calls — how much the raw data over-counts"],
  ];

  inflationRows.forEach(([label, val, type, description], idx) => {
    const bgArgb = idx % 2 === 0 ? ALT_ROW : WHITE;
    const row = ws.addRow([label, val, "", description]);
    row.height = 18;
    const lc = row.getCell(1);
    const vc = row.getCell(2);
    const dc = row.getCell(4);
    lc.font = mkFont({ bold: true }); lc.fill = mkFill(bgArgb); lc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    vc.font = mkFont({ bold: true, size: 12 }); vc.fill = mkFill(bgArgb); vc.alignment = { horizontal: "center", vertical: "middle" };
    dc.font = mkFont({ italic: true, size: 9, color: { argb: "FF666666" } }); dc.fill = mkFill(bgArgb); dc.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    if (type === "number") vc.numFmt = "#,##0";
    if (type === "decimal") vc.numFmt = "#,##0.0";
    [lc, vc].forEach(c => { c.border = { bottom: thinBorder }; });
  });

  ws.addRow([]); ws.getRow(ws.rowCount).height = 8;

  // ── Section B: Calls by Location ─────────────────────────────────────────
  if (locationBreakdown && locationBreakdown.length > 0) {
    addSectionHeader(ws, "B. Inbound Calls by Location", 6);

    const locHRow = ws.addRow(["Location", "Total Calls", "Answered", "Missed", "Voicemail", "Answer Rate"]);
    locHRow.height = 26;
    for (let c = 1; c <= 6; c++) {
      const cell = locHRow.getCell(c);
      cell.font = mkFont({ bold: true, color: { argb: "FFFFFFFF" } });
      cell.fill = mkFill(HEADER_BG);
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { bottom: { style: "medium", color: { argb: "FFFFFFFF" } }, right: thinBorder };
    }

    locationBreakdown.forEach((loc, idx) => {
      const bgArgb = idx % 2 === 0 ? WHITE : ALT_ROW;
      const ar = loc.total > 0 ? loc.answered / loc.total : 0;
      const { bg, fg } = arColor(ar);
      const row = ws.addRow([loc.location, loc.total, loc.answered, loc.missed, loc.voicemail, ar]);
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.fill = mkFill(bgArgb); cell.font = mkFont({}); cell.border = { bottom: thinBorder, right: thinBorder };
        cell.alignment = { horizontal: colNum === 1 ? "left" : "center", vertical: "middle" };
        if ([2, 3, 4, 5].includes(colNum)) cell.numFmt = "#,##0";
        if (colNum === 6) {
          cell.numFmt = "0.00%";
          cell.fill = mkFill(bg); cell.font = mkFont({ color: { argb: fg } });
        }
      });
      row.getCell(1).alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    });

    ws.addRow([]); ws.getRow(ws.rowCount).height = 8;
  }

  // ── Section C: Hourly Call Volume ─────────────────────────────────────────
  if (hourlyBreakdown && hourlyBreakdown.length > 0) {
    addSectionHeader(ws, "C. Peak Call Hours — Inbound Unique Calls", 5);

    const hrHRow = ws.addRow(["Hour", "Display", "Total Calls", "Answered", "Missed"]);
    hrHRow.height = 26;
    for (let c = 1; c <= 5; c++) {
      const cell = hrHRow.getCell(c);
      cell.font = mkFont({ bold: true, color: { argb: "FFFFFFFF" } });
      cell.fill = mkFill(HEADER_BG);
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = { bottom: { style: "medium", color: { argb: "FFFFFFFF" } }, right: thinBorder };
    }

    const sortedHours = [...hourlyBreakdown].sort((a, b) => a.hour - b.hour);
    const maxTotal = Math.max(...sortedHours.map(h => h.total));

    sortedHours.forEach((h, idx) => {
      const bgArgb = idx % 2 === 0 ? WHITE : ALT_ROW;
      const label = `${h.hour === 0 ? 12 : h.hour > 12 ? h.hour - 12 : h.hour}:00 ${h.hour < 12 ? "AM" : "PM"}`;
      // Highlight peak hours
      const isPeak = h.total === maxTotal;
      const row = ws.addRow([h.hour, label, h.total, h.answered, h.missed]);
      row.height = 17;
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.fill = mkFill(isPeak ? "FFFFD700" : bgArgb);
        cell.font = mkFont(isPeak ? { bold: true } : {});
        cell.border = { bottom: thinBorder, right: thinBorder };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        if ([3, 4, 5].includes(colNum)) cell.numFmt = "#,##0";
        if (colNum === 1) { cell.font = mkFont({ color: { argb: "FFAAAAAA" }, size: 9 }); } // hide raw hour num
      });
    });

    ws.addRow([]); ws.getRow(ws.rowCount).height = 8;
  }

  // ── Freeze panes ────────────────────────────────────────────────────────────
  ws.views = [{ showGridLines: false, state: "frozen", ySplit: 5, xSplit: 0 }];

  return ws;
}