/**
 * ExcelConfigSheets.jsx
 * Builds hidden reference/configuration worksheets for the call log workbook.
 * These sheets store benchmark thresholds and extension mappings so reporting
 * logic is configurable inside the workbook without code changes.
 */

export function buildConfigBenchmarksSheet(wb, { mkFill, mkFont, thinBorder, DARK_NAVY, ALT_ROW, WHITE }) {
  const ws = wb.addWorksheet("Config_Benchmarks", { views: [{ showGridLines: true }] });

  // === Header ===
  ws.columns = [
    { header: "Category",        key: "category",    width: 22 },
    { header: "Metric",          key: "metric",       width: 32 },
    { header: "Target Value",    key: "target",       width: 16 },
    { header: "Unit",            key: "unit",         width: 14 },
    { header: "Notes",           key: "notes",        width: 48 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = mkFont({ bold: true, color: { argb: "FFFFFFFF" } });
    cell.fill = mkFill(DARK_NAVY);
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { bottom: { style: "medium", color: { argb: "FFFFFFFF" } }, right: thinBorder };
  });

  const benchmarkData = [
    // Answer Rate thresholds
    ["Answer Rate", "Green Threshold (Good)",       0.5,  "Decimal", "Answer rate ≥ 50% shown in green"],
    ["Answer Rate", "Yellow Threshold (Warning)",   0.2,  "Decimal", "Answer rate ≥ 20% and < 50% shown in yellow"],
    ["Answer Rate", "Red Threshold (Poor)",         0.0,  "Decimal", "Answer rate < 20% shown in red"],
    // Role-based expected rates
    ["Phone Role",  "Call Center Expected AR",      0.85, "Decimal", "Expected inbound answer rate for Call Center extensions"],
    ["Phone Role",  "Client Facing Expected AR",    0.65, "Decimal", "Expected inbound answer rate for Client Facing extensions"],
    // Outbound rates
    ["Phone Role",  "Call Center Expected Outbound",0.15, "Decimal", "Expected outbound % of total for Call Center"],
    ["Phone Role",  "Client Facing Expected Outbound",0.25,"Decimal","Expected outbound % of total for Client Facing"],
    // Calls per hour
    ["Phone Role",  "Call Center Expected CPH",     10,   "Calls/hr","Expected calls per hour for Call Center"],
    ["Phone Role",  "Client Facing Expected CPH",   7,    "Calls/hr","Expected calls per hour for Client Facing"],
    ["Performance", "Work Days Per Week",            5,    "Days",   "Number of working days used for weekly goal calculation"],
    // Performance color thresholds
    ["Performance", "Green Threshold (At/Above Goal)", 1.0, "Decimal", "% of goal ≥ 100%"],
    ["Performance", "Yellow Threshold (Near Goal)",    0.9, "Decimal", "% of goal ≥ 90% and < 100%"],
    ["Performance", "Red Threshold (Below Goal)",      0.0, "Decimal", "% of goal < 90%"],
    // Location daily call goals
    ["Location Goal","Bloomfield – Check In Daily",  34, "Calls/day","Daily check-in call goal for Bloomfield"],
    ["Location Goal","Bloomfield – Check Out Daily", 35, "Calls/day","Daily check-out call goal for Bloomfield"],
    ["Location Goal","Manchester – Check In Daily",  28, "Calls/day","Daily check-in call goal for Manchester"],
    ["Location Goal","Manchester – Check Out Daily", 30, "Calls/day","Daily check-out call goal for Manchester"],
    ["Location Goal","Glastonbury – Check In Daily", 22, "Calls/day","Daily check-in call goal for Glastonbury"],
    ["Location Goal","Glastonbury – Check Out Daily",25, "Calls/day","Daily check-out call goal for Glastonbury"],
    ["Location Goal","Farmington – Check In Daily",  8,  "Calls/day","Daily check-in call goal for Farmington"],
    ["Location Goal","Farmington – Check Out Daily", 14, "Calls/day","Daily check-out call goal for Farmington"],
    ["Location Goal","Farmington – Phone Only Daily",32, "Calls/day","Daily phone-only call goal for Farmington"],
  ];

  benchmarkData.forEach((rowData, idx) => {
    const row = ws.addRow(rowData);
    row.height = 18;
    const bgArgb = idx % 2 === 0 ? WHITE : ALT_ROW;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill = mkFill(bgArgb);
      cell.font = mkFont({});
      cell.border = { bottom: thinBorder, right: thinBorder };
      cell.alignment = { horizontal: colNum <= 2 ? "left" : "center", vertical: "middle" };
      if (colNum === 3) cell.numFmt = "0.00";
    });
  });

  // Named Excel table so formulas in other sheets can reference Config_Benchmarks[Target Value]
  ws.addTable({
    name: "BenchmarkConfig",
    ref: `A1:E${1 + benchmarkData.length}`,
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleLight9", showRowStripes: true },
    columns: [
      { name: "Category",     filterButton: true },
      { name: "Metric",       filterButton: true },
      { name: "Target Value", filterButton: true },
      { name: "Unit",         filterButton: true },
      { name: "Notes",        filterButton: true },
    ],
    rows: benchmarkData,
  });

  // Sheet-level protection: allow only reading/sorting, no edits without password
  ws.protect("ENTIC_2023!", {
    selectLockedCells:   true,
    selectUnlockedCells: true,
    sort:  true,
    autoFilter: true,
  });

  ws.state = "hidden";
  return ws;
}

export function buildConfigExtensionsSheet(wb, { mkFill, mkFont, thinBorder, DARK_NAVY, ALT_ROW, WHITE, exportUserConfigs, CALL_CENTER_EXTENSIONS, userWeekRows }) {
  const ws = wb.addWorksheet("Config_Extensions", { views: [{ showGridLines: true }] });

  ws.columns = [
    { header: "User Name",            key: "user_name",        width: 32 },
    { header: "Extension(s)",         key: "extensions",       width: 18 },
    { header: "Phone Role",           key: "phone_role",       width: 18 },
    { header: "Location",             key: "location",         width: 18 },
    { header: "Benchmark Group",      key: "benchmark_group",  width: 20 },
    { header: "Include In Benchmark", key: "in_benchmark",     width: 22 },
    { header: "Active",               key: "active",           width: 10 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = mkFont({ bold: true, color: { argb: "FFFFFFFF" } });
    cell.fill = mkFill(DARK_NAVY);
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: "FFFFFFFF" } }, right: thinBorder };
  });

  const coerceBool = (val) => {
    if (typeof val === "boolean") return val;
    if (val === null || val === undefined) return false;
    return ["true", "yes", "1", "x", "✓", "checked"].includes(String(val).toLowerCase().trim());
  };

  // Build rows from user configs.
  // Extensions are stored in cfg.extensions (array of strings) per the CallLogUserConfig schema.
  // Additionally, cross-reference userWeekRows (raw imported call log data) to fill gaps where
  // the config record has no extensions but the imported data has a "Ext(s)" / extension value.
  const rawExtByUser = {};
  (userWeekRows || []).forEach(u => {
    if (!u.user || u._warning) return;
    const name = u.user.trim();
    if (!rawExtByUser[name]) rawExtByUser[name] = new Set();
    // u.extension comes from the "Ext(s)" column parsed during import
    if (u.extension !== null && u.extension !== undefined && u.extension !== "") {
      rawExtByUser[name].add(String(u.extension).trim());
    }
  });

  const extensionRows = (exportUserConfigs || [])
    .filter(cfg => cfg.user_name)
    .sort((a, b) => (a.user_name || "").localeCompare(b.user_name || ""))
    .map(cfg => {
      // cfg.extensions is the canonical array field (plural) from CallLogUserConfig
      const cfgExts = Array.isArray(cfg.extensions) ? cfg.extensions.map(e => String(e).trim()).filter(Boolean) : [];

      // Supplement with any extensions seen in raw imported data for this user
      const rawExts = rawExtByUser[cfg.user_name] ? [...rawExtByUser[cfg.user_name]] : [];
      const allExts = [...new Set([...cfgExts, ...rawExts])];
      const extDisplay = allExts.length > 0 ? allExts.join(", ") : "";

      // Determine phone role: Call Center if any extension is in the known set
      let role = "Client Facing";
      if (CALL_CENTER_EXTENSIONS && allExts.length > 0) {
        const extNums = allExts.map(Number);
        if (extNums.some(e => !isNaN(e) && CALL_CENTER_EXTENSIONS.has(e))) {
          role = "Call Center";
        }
      }

      return [
        cfg.user_name || "",
        extDisplay,
        role,
        cfg.location && cfg.location !== "N/A" ? cfg.location : "",
        cfg.benchmark_group || "",
        coerceBool(cfg.include_in_benchmark) ? "Yes" : "No",
        cfg.active === false ? "No" : "Yes",
      ];
    });

  extensionRows.forEach((rowData, idx) => {
    const row = ws.addRow(rowData);
    row.height = 18;
    const bgArgb = idx % 2 === 0 ? WHITE : ALT_ROW;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = mkFill(bgArgb);
      cell.font = mkFont({});
      cell.border = { bottom: thinBorder, right: thinBorder };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    // Left-align name column
    row.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
  });

  if (extensionRows.length > 0) {
    ws.addTable({
      name: "ExtensionConfig",
      ref: `A1:G${1 + extensionRows.length}`,
      headerRow: true,
      totalsRow: false,
      style: { theme: "TableStyleLight9", showRowStripes: true },
      columns: [
        { name: "User Name",            filterButton: true },
        { name: "Extension(s)",         filterButton: true },
        { name: "Phone Role",           filterButton: true },
        { name: "Location",             filterButton: true },
        { name: "Benchmark Group",      filterButton: true },
        { name: "Include In Benchmark", filterButton: true },
        { name: "Active",               filterButton: true },
      ],
      rows: extensionRows,
    });
  }

  ws.protect("ENTIC_2023!", {
    selectLockedCells:   true,
    selectUnlockedCells: true,
    sort: true,
    autoFilter: true,
  });

  ws.state = "hidden";
  return ws;
}

export function buildFormulaReferenceSheet(wb, { mkFill, mkFont, thinBorder, DARK_NAVY, ALT_ROW, WHITE }) {
  const ws = wb.addWorksheet("Formula_Reference", { views: [{ showGridLines: true }] });

  ws.columns = [
    { header: "Metric",      key: "metric",      width: 30 },
    { header: "Formula",     key: "formula",     width: 50 },
    { header: "Description", key: "description", width: 60 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = mkFont({ bold: true, color: { argb: "FFFFFFFF" } });
    cell.fill = mkFill(DARK_NAVY);
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = { bottom: { style: "medium", color: { argb: "FFFFFFFF" } }, right: thinBorder };
  });

  const formulas = [
    ["Inbound Answered",    "=MAX(Inbound - Missed, 0)",                      "Inbound calls minus missed, floored at 0"],
    ["Inbound Answer Rate", "=Inbound Answered / Inbound Calls",               "Decimal ratio; formatted as percentage in reports"],
    ["% of Weekly Goal",    "=Total Answered / Weekly Goal",                   "Decimal ratio; formatted as percentage in reports"],
    ["Weekly Goal",         "=Daily Rate * Work Days Per Week (5)",            "Daily rate from Config_Benchmarks × 5 working days"],
    ["Answer Rate: Green",  "≥ 0.50 (50%)",                                   "See Config_Benchmarks: Answer Rate – Green Threshold"],
    ["Answer Rate: Yellow", "≥ 0.20 and < 0.50",                              "See Config_Benchmarks: Answer Rate – Yellow Threshold"],
    ["Answer Rate: Red",    "< 0.20 (20%)",                                   "See Config_Benchmarks: Answer Rate – Red Threshold"],
    ["Perf Goal: Green",    "≥ 1.00 (100% of goal)",                          "See Config_Benchmarks: Performance – Green Threshold"],
    ["Perf Goal: Yellow",   "≥ 0.90 and < 1.00",                              "See Config_Benchmarks: Performance – Yellow Threshold"],
    ["Perf Goal: Red",      "< 0.90 (90% of goal)",                           "See Config_Benchmarks: Performance – Red Threshold"],
    ["Calls Per Hour",      "=Total Calls / 7.5 (hours per shift)",           "Productivity metric — hours per shift assumed 7.5"],
    ["Outbound Rate",       "=Outbound Calls / Total Calls",                  "Fraction of total calls that were outbound"],
    ["Phone Role",          "VLOOKUP(Extension, Config_Extensions, 3, FALSE)","Derived from Config_Extensions table"],
    ["Expected Answer Rate","IF(Phone Role = 'Call Center', 0.85, 0.65)",     "Role-based benchmark from Config_Benchmarks"],
    ["Expected Outbound %", "IF(Phone Role = 'Call Center', 0.15, 0.25)",     "Role-based benchmark from Config_Benchmarks"],
    ["Expected CPH",        "IF(Phone Role = 'Call Center', 10, 7)",          "Role-based benchmark from Config_Benchmarks"],
  ];

  formulas.forEach((rowData, idx) => {
    const row = ws.addRow(rowData);
    row.height = 18;
    const bgArgb = idx % 2 === 0 ? WHITE : ALT_ROW;
    row.eachCell({ includeEmpty: true }, (cell) => {
      cell.fill = mkFill(bgArgb);
      cell.font = mkFont({});
      cell.border = { bottom: thinBorder, right: thinBorder };
      cell.alignment = { horizontal: "left", vertical: "middle" };
    });
  });

  ws.addTable({
    name: "FormulaRef",
    ref: `A1:C${1 + formulas.length}`,
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleLight9", showRowStripes: true },
    columns: [
      { name: "Metric",      filterButton: true },
      { name: "Formula",     filterButton: true },
      { name: "Description", filterButton: true },
    ],
    rows: formulas,
  });

  ws.protect("ENTIC_2023!", {
    selectLockedCells:   true,
    selectUnlockedCells: true,
    sort: true,
  });

  ws.state = "hidden";
  return ws;
}

export function buildRawImportedDataSheet(wb, { mkFill, mkFont, thinBorder, DARK_NAVY, ALT_ROW, WHITE, userWeekRows, parseWeekDate }) {
  const ws = wb.addWorksheet("Raw_Imported_Data", { views: [{ showGridLines: true, state: "frozen", ySplit: 1, xSplit: 0 }] });

  ws.columns = [
    { header: "Week Start",              key: "week_start",                width: 16 },
    { header: "Week End",                key: "week_end",                  width: 16 },
    { header: "User",                    key: "user",                      width: 30 },
    { header: "Extension",               key: "extension",                 width: 12 },
    { header: "Phone Role",              key: "phone_role",                width: 16 },
    { header: "Total Calls",             key: "total_calls",               width: 14 },
    { header: "Inbound",                 key: "inbound",                   width: 12 },
    { header: "Outbound",                key: "outbound",                  width: 12 },
    { header: "Answered",                key: "answered",                  width: 12 },
    { header: "Missed",                  key: "missed",                    width: 12 },
    { header: "Inbound Answer Rate",     key: "answer_rate",               width: 20 },
    { header: "Expected Answer Rate",    key: "expected_answer_rate",      width: 22 },
    { header: "Answer Rate Status",      key: "answer_rate_status",        width: 20 },
    { header: "Total Duration (min)",    key: "total_duration_minutes",    width: 20 },
    { header: "Inbound Duration (min)",  key: "inbound_duration_minutes",  width: 22 },
    { header: "Outbound Duration (min)", key: "outbound_duration_minutes", width: 23 },
    { header: "Avg Duration (min)",      key: "avg_duration_minutes",      width: 20 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell({ includeEmpty: true }, (cell) => {
    cell.font = mkFont({ bold: true, color: { argb: "FFFFFFFF" } });
    cell.fill = mkFill(DARK_NAVY);
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: "FFFFFFFF" } }, right: thinBorder };
  });

  const rawDataRows = [];
  (userWeekRows || []).filter(u => !u._warning && (u.total_calls || 0) > 0).forEach(u => {
    const rowData = [
      parseWeekDate ? parseWeekDate(u.week_start) : u.week_start,
      parseWeekDate ? parseWeekDate(u.week_end)   : u.week_end,
      u.user || "",
      u.extension ?? "",
      u.phone_role || "",
      u.total_calls || 0,
      u.inbound || 0,
      u.outbound || 0,
      u.answered || 0,
      u.missed || 0,
      u.answer_rate !== null && u.answer_rate !== undefined ? u.answer_rate : "",
      u.expected_answer_rate !== null && u.expected_answer_rate !== undefined ? u.expected_answer_rate : "",
      u.answer_rate_status || "",
      u.total_duration_minutes || 0,
      u.inbound_duration_minutes || 0,
      u.outbound_duration_minutes || 0,
      u.avg_duration_minutes || 0,
    ];
    rawDataRows.push(rowData);
  });

  rawDataRows.forEach((rowData, idx) => {
    const row = ws.addRow(rowData);
    row.height = 17;
    const bgArgb = idx % 2 === 0 ? WHITE : ALT_ROW;
    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.fill = mkFill(bgArgb);
      cell.font = mkFont({});
      cell.border = { bottom: thinBorder, right: thinBorder };
      cell.alignment = { horizontal: colNum <= 3 ? "left" : "center", vertical: "middle" };
      if (colNum === 1 || colNum === 2) cell.numFmt = "mmm d, yyyy";
      if ([6, 7, 8, 9, 10].includes(colNum)) cell.numFmt = "#,##0";
      if (colNum === 11 || colNum === 12) { cell.numFmt = "0.00%"; }
      if ([14, 15, 16, 17].includes(colNum)) cell.numFmt = "#,##0.00";
    });
  });

  if (rawDataRows.length > 0) {
    ws.addTable({
      name: "RawImportedData",
      ref: `A1:Q${1 + rawDataRows.length}`,
      headerRow: true,
      totalsRow: false,
      style: { theme: "TableStyleLight9", showRowStripes: true },
      columns: ws.columns.map(c => ({ name: c.header, filterButton: true })),
      rows: rawDataRows,
    });
  }

  ws.state = "hidden";
  return ws;
}