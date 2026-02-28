// Helper: build Inbound CDR worksheet for Excel export
import { base44 } from "@/api/base44Client";
import { autoFitColumns } from "./ExcelExportHelpers";

export async function buildCdrSheet(wb, { periodLabel, generatedOn, cdrUploadData, mkFill, mkFont, thinBorder, addSectionHeader, styleTableHeader, arColor, DARK_NAVY, ALT_ROW, WHITE, LIGHT_GRAY }) {
  if (!cdrUploadData) {
    const wsCdrEmpty = wb.addWorksheet("Inbound CDR", { views: [{ showGridLines: false }] });
    wsCdrEmpty.columns = [{ width: 60 }];

    wsCdrEmpty.addRow([`${periodLabel} - Inbound CDR`, ...Array(4).fill("")]);
    wsCdrEmpty.mergeCells(`A1:E1`);
    const emptyTitleCell = wsCdrEmpty.getCell("A1");
    emptyTitleCell.font      = mkFont({ bold: true, size: 16, color: { argb: "FFFFFFFF" } });
    emptyTitleCell.fill      = mkFill(DARK_NAVY);
    emptyTitleCell.alignment = { horizontal: "center", vertical: "middle" };
    wsCdrEmpty.getRow(1).height = 40;
    wsCdrEmpty.addRow([`Reporting Period: ${periodLabel}`]);
    wsCdrEmpty.getCell("A2").font = mkFont({ bold: true });
    wsCdrEmpty.getRow(2).height = 18;
    wsCdrEmpty.addRow([`Generated On: ${generatedOn}`]);
    wsCdrEmpty.getCell("A3").font = mkFont({ color: { argb: "FF666666" } });
    wsCdrEmpty.getRow(3).height = 18;
    addSectionHeader(wsCdrEmpty, "Summary", 4);
    const emptyRow = wsCdrEmpty.addRow(["No inbound CDR uploaded for this period."]);
    emptyRow.getCell(1).font = mkFont({ italic: true, color: { argb: "FF888888" } });
    emptyRow.height = 18;
    wsCdrEmpty.addRow([]);
    const infoRow = wsCdrEmpty.addRow(["Upload the Vonage \"Inbound Calls\" export to populate these metrics."]);
    infoRow.getCell(1).font = mkFont({ italic: true, size: 10, color: { argb: "FFAAAAAA" } });
    infoRow.height = 18;
    return;
  }

  const wsCdr = wb.addWorksheet("Inbound CDR", { views: [{ showGridLines: false, state: "frozen", ySplit: 14, xSplit: 0 }] });
  wsCdr.columns = [
    { width: 30 }, { width: 14 }, { width: 14 }, { width: 18 }, { width: 18 },
  ];

  wsCdr.addRow([`${periodLabel} - Inbound CDR`, ...Array(4).fill("")]);
  wsCdr.mergeCells(`A1:E1`);
  const cdrTitleCell = wsCdr.getCell("A1");
  cdrTitleCell.font      = mkFont({ bold: true, size: 16, color: { argb: "FFFFFFFF" } });
  cdrTitleCell.fill      = mkFill(DARK_NAVY);
  cdrTitleCell.alignment = { horizontal: "center", vertical: "middle" };
  wsCdr.getRow(1).height = 40;

  wsCdr.addRow([`Reporting Period: ${periodLabel}`]);
  wsCdr.getCell("A2").font = mkFont({ bold: true });
  wsCdr.getRow(2).height = 18;
  wsCdr.addRow([`Generated On: ${generatedOn}`]);
  wsCdr.getCell("A3").font = mkFont({ color: { argb: "FF666666" } });
  wsCdr.getRow(3).height = 18;

  addSectionHeader(wsCdr, "Summary", 4);

  const cdrMetrics = [
    ["Total Inbound Calls",  cdrUploadData.total_inbound_calls,    "number"],
    ["Inbound Answered",     cdrUploadData.total_inbound_answered, "number"],
    ["Inbound Not Answered", cdrUploadData.total_unanswered,       "number"],
    ["Inbound Answer Rate",  cdrUploadData.total_inbound_calls > 0 ? Math.min(cdrUploadData.total_inbound_answered, cdrUploadData.total_inbound_calls) / cdrUploadData.total_inbound_calls : "", "percent"],
    ["Mapped Rows",          cdrUploadData.mapped_rows,            "number"],
    ["Unmapped Rows",        cdrUploadData.unmapped_rows,          "number"],
  ];

  cdrMetrics.forEach(([label, val, type], idx) => {
    const bgArgb = idx % 2 === 0 ? ALT_ROW : WHITE;
    const row = wsCdr.addRow([label, val]);
    row.height = 18;
    const lc = row.getCell(1); const vc = row.getCell(2);
    lc.font = mkFont({ bold: true }); lc.fill = mkFill(bgArgb); lc.alignment = { horizontal: "left", vertical: "middle" };
    vc.font = mkFont({ bold: true, size: 12 }); vc.fill = mkFill(bgArgb); vc.alignment = { horizontal: "right", vertical: "middle" };
    if (type === "number")  vc.numFmt = "#,##0";
    if (type === "percent") vc.numFmt = "0.00%";
    [lc, vc].forEach(c => { c.border = { bottom: thinBorder }; });
  });

  wsCdr.addRow([]);
  addSectionHeader(wsCdr, "User Breakdown", 5);

  const cdrTableHeaderRowNum = wsCdr.rowCount + 1;
  const cdrHRow = wsCdr.addRow(["User", "Inbound Calls", "Inbound Answered", "Inbound Not Answered", "Inbound Answer Rate"]);
  styleTableHeader(cdrHRow, 5, 1);

  let cdrStats = [];
  try {
    cdrStats = await base44.entities.CallLogCdrUserStats.filter({ cdr_upload_id: cdrUploadData.id });
  } catch (err) {
    console.warn("Could not load CDR user stats:", err);
  }
  cdrStats.sort((a, b) => (b.inbound_calls || 0) - (a.inbound_calls || 0));

  if (cdrStats.length === 0) {
    const emptyRow = wsCdr.addRow(["No inbound CDR data found for this period.", ...Array(4).fill("")]);
    wsCdr.mergeCells(`A${wsCdr.rowCount}:E${wsCdr.rowCount}`);
    emptyRow.getCell(1).font = mkFont({ italic: true, color: { argb: "FF888888" } });
    emptyRow.height = 18;
  } else {
    // Build table data rows
    const cdrTableRows = cdrStats.map(stat => {
      const inbound     = Number(stat.inbound_calls || 0);
      const answered    = Math.min(Number(stat.inbound_answered || 0), inbound);
      const notAnswered = inbound - answered;
      const ar          = inbound > 0 ? answered / inbound : null;
      return [stat.user_name, inbound, answered, notAnswered, ar !== null ? ar : ""];
    });

    // Register as official Excel Table — addTable writes both header and data rows
    wsCdr.addTable({
      name: "CdrUserStats",
      ref: `A${cdrTableHeaderRowNum}:E${cdrTableHeaderRowNum + cdrTableRows.length}`,
      headerRow: true,
      totalsRow: false,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: [
        { name: "User",                 filterButton: true },
        { name: "Inbound Calls",        filterButton: true },
        { name: "Inbound Answered",     filterButton: true },
        { name: "Inbound Not Answered", filterButton: true },
        { name: "Inbound Answer Rate",  filterButton: true },
      ],
      rows: cdrTableRows,
    });

    // Apply number/percent formatting and colors to data rows
    cdrStats.forEach((stat, idx) => {
      const inbound  = Number(stat.inbound_calls || 0);
      const answered = Math.min(Number(stat.inbound_answered || 0), inbound);
      const ar       = inbound > 0 ? answered / inbound : null;
      const row      = wsCdr.getRow(cdrTableHeaderRowNum + 1 + idx);
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.alignment = { horizontal: colNum === 1 ? "left" : "center", vertical: "middle" };
        if ([2, 3, 4].includes(colNum)) cell.numFmt = "#,##0";
        if (colNum === 5 && ar !== null) {
          cell.numFmt = "0.00%";
          const { bg, fg } = arColor(ar);
          cell.fill = mkFill(bg);
          cell.font = mkFont({ color: { argb: fg } });
        }
      });
    });

    autoFitColumns(wsCdr);
  }
}