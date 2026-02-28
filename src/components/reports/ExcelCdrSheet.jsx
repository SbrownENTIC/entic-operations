// Helper: build Inbound CDR worksheet for Excel export
import { base44 } from "@/api/base44Client";
import { autoFitColumns } from "./ExcelExportHelpers";

export async function buildCdrSheet(wb, { periodLabel, generatedOn, cdrUploadData, mkFill, mkFont, thinBorder, styleTableHeader, arColor, DARK_NAVY, ALT_ROW, WHITE, LIGHT_GRAY }) {
  if (!cdrUploadData) {
    const wsCdrEmpty = wb.addWorksheet("Inbound CDR", { views: [{ showGridLines: false }] });
    wsCdrEmpty.columns = [{ width: 60 }];
    wsCdrEmpty.addRow(["No inbound CDR uploaded for this period. Upload the Vonage \"Inbound Calls\" export to populate these metrics."]);
    wsCdrEmpty.getCell("A1").font = mkFont({ italic: true, color: { argb: "FF888888" } });
    wsCdrEmpty.getRow(1).height = 18;
    autoFitColumns(wsCdrEmpty);
    return;
  }

  // Flat table: Row 1 = header, Row 2+ = data. Freeze only header row.
  const wsCdr = wb.addWorksheet("Inbound CDR", {
    views: [{ state: "frozen", ySplit: 1 }]
  });
  wsCdr.columns = [
    { width: 30 }, { width: 16 }, { width: 18 }, { width: 22 }, { width: 20 },
  ];

  // Load stats first so we can build the table immediately after the header
  let cdrStats = [];
  try {
    cdrStats = await base44.entities.CallLogCdrUserStats.filter({ cdr_upload_id: cdrUploadData.id });
  } catch (err) {
    console.warn("Could not load CDR user stats:", err);
  }
  cdrStats.sort((a, b) => (b.inbound_calls || 0) - (a.inbound_calls || 0));

  // Row 1: Table header
  const cdrHRow = wsCdr.addRow(["User", "Inbound Calls", "Inbound Answered", "Inbound Not Answered", "Inbound Answer Rate"]);
  styleTableHeader(cdrHRow, 5, 1);

  // Rows 2+: Data
  const cdrTableRows = [];
  cdrStats.forEach((stat, idx) => {
    const inbound     = Number(stat.inbound_calls || 0);
    const answered    = Math.min(Number(stat.inbound_answered || 0), inbound);
    const notAnswered = inbound - answered;
    const ar          = inbound > 0 ? answered / inbound : null;
    const bgArgb      = idx % 2 === 0 ? WHITE : LIGHT_GRAY;

    const rowValues = [stat.user_name, inbound, answered, notAnswered, ar !== null ? ar : ""];
    const row = wsCdr.addRow(rowValues);
    row.height = 18;
    cdrTableRows.push(rowValues);

    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill      = mkFill(bgArgb);
      cell.font      = mkFont({});
      cell.alignment = { horizontal: colNum === 1 ? "left" : "center", vertical: "middle" };
      cell.border    = { bottom: thinBorder, right: thinBorder };
      if ([2, 3, 4].includes(colNum)) cell.numFmt = "#,##0";
      if (colNum === 5 && ar !== null) {
        cell.numFmt = "0.00%";
        const { bg, fg } = arColor(ar);
        cell.fill = mkFill(bg);
        cell.font = mkFont({ color: { argb: fg } });
      }
    });
  });

  if (cdrStats.length === 0) {
    const emptyRow = wsCdr.addRow(["No inbound CDR data found for this period.", "", "", "", ""]);
    wsCdr.mergeCells(`A2:E2`);
    emptyRow.getCell(1).font = mkFont({ italic: true, color: { argb: "FF888888" } });
    emptyRow.height = 18;
  }

  if (cdrTableRows.length > 0) {
    wsCdr.addTable({
      name: "CdrUserStats",
      ref: `A1:E${wsCdr.rowCount}`,
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
  }

  // AutoFit LAST — after all rows and formatting are complete
  autoFitColumns(wsCdr);
}