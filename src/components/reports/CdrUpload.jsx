import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Upload, AlertCircle, CheckCircle, Loader2, X } from "lucide-react";
import { formatDateToEST } from "@/components/DateUtils";

// --- CSV parsing (handles quoted fields with embedded commas) ---
function parseCSVLine(line) {
  const result = [];
  let inQuotes = false;
  let cur = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.replace(/^"|"$/g, "").trim());
  return lines.slice(1).map(line => {
    const cols = parseCSVLine(line).map(c => c.replace(/^"|"$/g, "").trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cols[i] ?? ""; });
    return obj;
  }).filter(row => Object.values(row).some(v => v !== ""));
}

function normalizeKey(k) {
  return String(k).toLowerCase().trim();
}

function findKey(obj, normalized) {
  return Object.keys(obj).find(k => normalizeKey(k) === normalized);
}

// Required headers (normalized)
const REQUIRED_HEADERS = ["to", "result"];

function buildExtensionMap(configs) {
  const map = {}; // normalized ext string -> user_name
  for (const cfg of configs) {
    const exts = Array.isArray(cfg.extensions) ? cfg.extensions
      : (cfg.extension ? [cfg.extension] : []);
    for (const ext of exts) {
      if (ext) map[String(ext).trim().toLowerCase()] = cfg.user_name;
    }
  }
  return map;
}

function processRows(rows, extensionMap) {
  const users = {}; // user_name -> { inbound, inbound_answered }
  const distinctResults = new Set();

  const ensure = (name) => {
    if (!users[name]) users[name] = { inbound: 0, inbound_answered: 0 };
  };

  let totalInbound = 0;
  let totalMapped = 0;
  let totalUnmapped = 0;
  let totalAnswered = 0;

  for (const row of rows) {
    const toKey     = findKey(row, "to");
    const resultKey = findKey(row, "result");

    // Every row is an inbound call
    totalInbound++;

    const toRaw   = toKey ? String(row[toKey] || "").trim() : "";
    const toLower = toRaw.toLowerCase();
    const resultNorm  = resultKey ? String(row[resultKey] || "").trim().toLowerCase() : "";

    // Track distinct Result values
    if (resultNorm) {
      distinctResults.add(resultNorm);
    }

    let userName;
    if (toLower && extensionMap[toLower]) {
      userName = extensionMap[toLower];
      totalMapped++;
    } else {
      userName = toRaw ? `Unmapped (${toRaw})` : "Unmapped Extension";
      totalUnmapped++;
    }

    ensure(userName);
    users[userName].inbound++;
    
    // Only count as answered if resultNorm is exactly "answered"
    if (resultNorm === "answered") {
      users[userName].inbound_answered++;
      totalAnswered++;
    }
  }

  const userRows = Object.entries(users).map(([name, vals]) => ({
    user: name,
    inbound: vals.inbound,
    inbound_answered: vals.inbound_answered,
    answer_rate: vals.inbound > 0 ? vals.inbound_answered / vals.inbound : null,
  })).sort((a, b) => {
    const aUnmapped = a.user.startsWith("Unmapped");
    const bUnmapped = b.user.startsWith("Unmapped");
    if (aUnmapped && !bUnmapped) return 1;
    if (!aUnmapped && bUnmapped) return -1;
    return b.inbound - a.inbound;
  });

  return { 
    userRows, 
    totalInbound, 
    totalMapped, 
    totalUnmapped,
    totalAnswered,
    totalUnanswered: totalInbound - totalAnswered,
    distinctResults: Array.from(distinctResults).sort()
  };
}

// Parse reporting period input like "January 2026" into { periodLabel, periodKey, periodStart, periodEnd }
function parseReportingPeriod(inputText) {
  const trimmed = inputText.trim().replace(/\s+/g, ' ');
  const parts = trimmed.split(/\s+/);
  
  if (parts.length !== 2) return null;
  
  const monthName = parts[0].toLowerCase();
  const year = parts[1];
  
  const monthMap = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12
  };
  
  const month = monthMap[monthName];
  if (!month || !/^\d{4}$/.test(year)) return null;
  
  const yearNum = parseInt(year, 10);
  const monthNum = String(month).padStart(2, '0');
  const periodKey = `${yearNum}-${monthNum}`;
  const periodLabel = `${parts[0]} ${year}`;
  const periodStart = `${yearNum}-${monthNum}-01`;
  
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? yearNum + 1 : yearNum;
  const nextMonthStr = String(nextMonth).padStart(2, '0');
  const periodEnd = `${nextYear}-${nextMonthStr}-01`;
  
  return { periodLabel, periodKey, periodStart, periodEnd };
}

export default function CdrUpload({ periodKey: propPeriodKey, periodType, periodStart: propPeriodStart, periodEnd: propPeriodEnd }) {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [manualPeriodInput, setManualPeriodInput] = useState("");
  const [periodValidationError, setPeriodValidationError] = useState("");
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  // Format period label from props (month format)
  const formatPeriodLabelFromProps = React.useCallback(() => {
    if (!propPeriodKey) return "No period selected";
    if (periodType === "month" && propPeriodStart) {
      try {
        const date = new Date(propPeriodStart + "T12:00:00Z");
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
        }
      } catch (e) {
        console.error("Invalid date:", propPeriodStart);
      }
    }
    return `${propPeriodStart} to ${propPeriodEnd}`;
  }, [propPeriodKey, periodType, propPeriodStart, propPeriodEnd]);

  // Use manual period if provided, otherwise fall back to prop
  const [parsedPeriod, setParsedPeriod] = useState(() => {
    // Initialize from props if available
    if (propPeriodKey && propPeriodStart && propPeriodEnd && periodType === "month") {
      return { periodKey: propPeriodKey, periodStart: propPeriodStart, periodEnd: propPeriodEnd, periodLabel: formatPeriodLabelFromProps() };
    }
    return null;
  });

  // Sync with parent props when they change
  React.useEffect(() => {
    if (propPeriodKey && propPeriodStart && propPeriodEnd) {
      const label = formatPeriodLabelFromProps();
      setManualPeriodInput(label);
      setParsedPeriod({
        periodKey: propPeriodKey,
        periodStart: propPeriodStart,
        periodEnd: propPeriodEnd,
        periodLabel: label
      });
      setPeriodValidationError("");
    }
  }, [propPeriodKey, propPeriodStart, propPeriodEnd, formatPeriodLabelFromProps]);

  const periodKey = parsedPeriod?.periodKey || propPeriodKey;
  const periodStart = parsedPeriod?.periodStart || propPeriodStart;
  const periodEnd = parsedPeriod?.periodEnd || propPeriodEnd;
  const effectivePeriodLabel = parsedPeriod?.periodLabel || formatPeriodLabelFromProps();

  const { data: configs = [] } = useQuery({
    queryKey: ["call-log-user-configs"],
    queryFn: () => base44.entities.CallLogUserConfig.list(),
  });

  const { data: existingCdr } = useQuery({
    queryKey: ["cdr-upload", periodKey],
    queryFn: async () => {
      if (!periodKey) return null;
      const records = await base44.entities.CallLogCdrUploads.filter({
        reporting_period_key: periodKey
      });
      return records.length > 0 ? records[0] : null;
    },
    enabled: !!periodKey
  });

  const extensionMap = React.useMemo(() => buildExtensionMap(configs), [configs]);

  const reset = () => {
    setFile(null);
    setError("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePeriodInput = (value) => {
    setManualPeriodInput(value);
    setPeriodValidationError("");
    
    if (!value.trim()) {
      setParsedPeriod(null);
      return;
    }
    
    const parsed = parseReportingPeriod(value);
    if (parsed) {
      setParsedPeriod(parsed);
    } else {
      setPeriodValidationError('Reporting Period must be like "January 2026".');
      setParsedPeriod(null);
    }
  };

  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setError("");
    setResult(null);
  };

  const parseXLSX = async (file) => {
    const ExcelJS = (await import("exceljs")).default;
    const workbook = new ExcelJS.Workbook();
    const buffer = await file.arrayBuffer();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];
    const rows = [];
    let headers = [];
    sheet.eachRow((row, rowNumber) => {
      const values = row.values.slice(1); // exceljs row.values is 1-indexed, index 0 is null
      if (rowNumber === 1) {
        headers = values.map(v => String(v ?? "").trim());
      } else {
        const obj = {};
        headers.forEach((h, i) => { obj[h] = values[i] != null ? String(values[i]).trim() : ""; });
        if (Object.values(obj).some(v => v !== "")) rows.push(obj);
      }
    });
    return rows;
  };

  const handleProcess = async () => {
    if (!file) { setError("Please select a file."); return; }
    if (!periodKey) { 
      setError("Please enter a Reporting Period (example January 2026) before processing."); 
      return; 
    }
    setError("");
    setProcessing(true);

    try {
      let rows;
      const isXLSX = file.name.toLowerCase().endsWith(".xlsx");
      if (isXLSX) {
        rows = await parseXLSX(file);
      } else {
        const text = await file.text();
        rows = parseCSV(text);
      }

      if (!rows.length) {
        setError("File contains no data rows.");
        setProcessing(false);
        return;
      }

      // Validate required headers
      const sampleKeys = Object.keys(rows[0]).map(normalizeKey);
      const missing = REQUIRED_HEADERS.filter(h => !sampleKeys.includes(h));
      if (missing.length > 0) {
        setError(`Missing required column(s): ${missing.join(", ")}. Expected headers: Direction, To, From, Destination Device, Date/Time, Result, Duration, Location`);
        setProcessing(false);
        return;
      }

      const processed = processRows(rows, extensionMap);
      setResult(processed);

      // Auto-save after processing
      await handleSave(processed, file.name);
    } catch (err) {
      setError("Failed to parse file: " + (err.message || "unknown error"));
    }
    setProcessing(false);
  };

  const handleSave = async (processed, fileName) => {
    if (!processed || !periodKey) {
      setError("Missing period or processing data");
      return;
    }

    if (!periodStart || !periodEnd) {
      setError("Period dates not set. Please enter a Reporting Period.");
      return;
    }

    console.log("[CdrUpload] Saving CDR for period_key:", periodKey, "with", processed.userRows.length, "user rows");

    setSaving(true);
    try {
      // Build unmapped extensions list (top 10 by count)
      const unmappedExtMap = {};
      processed.userRows
        .filter(u => u.user.startsWith("Unmapped"))
        .forEach(u => {
          const ext = u.user.replace("Unmapped (", "").replace(")", "");
          unmappedExtMap[ext] = (unmappedExtMap[ext] || 0) + u.inbound;
        });

      const unmappedExts = Object.entries(unmappedExtMap)
        .map(([ext, count]) => ({ extension: ext, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Build user stats for database
      const userStats = processed.userRows
        .filter(u => !u.user.startsWith("Unmapped"))
        .map(u => ({
          user_name: u.user,
          extension: null,
          location: null,
          inbound_calls: u.inbound,
          inbound_answered: u.inbound_answered,
          inbound_unanswered: u.inbound - u.inbound_answered,
          inbound_answer_rate: u.answer_rate !== null && u.answer_rate !== undefined ? u.answer_rate : 0
        }));

      const response = await base44.functions.invoke('saveCdrUpload', {
        reporting_period_key: periodKey,
        period_type: periodType || 'month',
        period_start: periodStart,
        period_end: periodEnd,
        original_filename: fileName,
        total_rows: processed.totalInbound,
        total_inbound_calls: processed.totalInbound,
        total_inbound_answered: processed.totalAnswered,
        total_unanswered: processed.totalUnanswered,
        mapped_rows: processed.totalMapped,
        unmapped_rows: processed.totalUnmapped,
        unmapped_extensions: unmappedExts,
        userStats
      });

      if (response.data?.success) {
        // Refetch existing CDR
        // Note: normally useQuery auto refetch, but we can manually invalidate if needed
      }
    } catch (err) {
      console.error("Failed to save CDR:", err);
      setError("Failed to save CDR data: " + (err.message || "unknown error"));
    }
    setSaving(false);
  };

  const formatRate = (rate) => {
    if (rate === null || rate === undefined) return "—";
    return (rate * 100).toFixed(1) + "%";
  };

  const rateColor = (rate) => {
    if (rate === null) return "text-slate-400";
    if (rate >= 0.8) return "text-green-700 font-semibold";
    if (rate >= 0.5) return "text-yellow-700 font-semibold";
    return "text-red-600 font-semibold";
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
          <Upload className="w-4 h-4 text-blue-600" />
          Inbound Call Detail (CDR)
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Upload a Vonage inbound CDR export. Every row is treated as an inbound call.
          Calls are mapped to users via the <strong>To</strong> (extension) column against the User Directory.
        </p>

        {existingCdr && (
          <div className="mt-2 flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>
              Saved for {effectivePeriodLabel}, uploaded {formatDateToEST(existingCdr.uploaded_at, "MMM d, yyyy 'at' h:mm a")}
            </span>
          </div>
        )}

        <div className="mt-2 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs text-amber-800">
          <strong>Upload Type: Inbound Call Detail (CDR)</strong> — feeds advanced analytics only.<br />
          For monthly performance dashboards, use <strong>Reporting → Upload Call Log</strong>.
        </div>

        <p className="text-xs text-slate-400 mt-1">
          Required columns: Direction, To, From, Destination Device, Date/Time, Result, Duration, Location
        </p>
      </div>

      <div className="bg-blue-50/40 border border-blue-200 rounded-lg p-4 space-y-3">
       <div>
         <label className="text-xs font-medium text-slate-700 block mb-1">
           Reporting Period <span className="text-red-500">*</span>
         </label>
         <input
           type="text"
           placeholder="January 2026"
           value={manualPeriodInput}
           onChange={(e) => handlePeriodInput(e.target.value)}
           className="w-full px-3 py-2 text-sm border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
           style={{
             borderColor: periodValidationError ? '#dc2626' : undefined,
             backgroundColor: periodValidationError ? '#fef2f2' : undefined
           }}
         />
         {periodValidationError && (
           <p className="text-xs text-red-600 mt-1">{periodValidationError}</p>
         )}
         {!periodValidationError && manualPeriodInput && parsedPeriod && (
           <p className="text-xs text-green-600 mt-1">✓ {parsedPeriod.periodLabel}</p>
         )}
         <p className="text-xs text-slate-500 mt-1">
           Enter the month and year this file covers, example January 2026.
         </p>
       </div>

       <div>
         <label className="text-xs font-medium text-slate-700 block mb-1">
           CDR File (.csv or .xlsx) <span className="text-red-500">*</span>
         </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            onChange={handleFileSelect}
            className="block w-full text-sm text-slate-700 file:mr-4 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
          />
          {file && (
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-600" /> {file.name}
            </p>
          )}
        </div>

        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded p-2.5 text-xs text-red-700">
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {error}
          </div>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={handleProcess}
            disabled={processing || saving || !file || !periodKey}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            {processing || saving
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {saving ? "Saving…" : "Processing…"}</>
              : <><Upload className="w-3.5 h-3.5" /> {existingCdr ? "Replace CDR for this period" : "Process & Save CDR"}</>}
          </Button>
          {(file || result) && (
            <Button size="sm" variant="outline" onClick={reset}>Clear</Button>
          )}
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-3">
          {/* Summary bar */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total Inbound Calls", value: result.totalInbound,     color: "text-blue-700" },
              { label: "Total Answered",     value: result.totalAnswered,     color: "text-green-700" },
              { label: "Total Unanswered",   value: result.totalUnanswered,   color: result.totalUnanswered > 0 ? "text-red-600" : "text-slate-400" },
              { label: "Mapped",             value: result.totalMapped,       color: "text-slate-700" },
            ].map(m => (
              <div key={m.label} className="bg-white border border-slate-200 rounded-lg p-3 text-center shadow-sm">
                <p className="text-xs text-slate-500 mb-1">{m.label}</p>
                <p className={`text-2xl font-bold ${m.color}`}>{m.value.toLocaleString()}</p>
              </div>
            ))}
          </div>

          {/* Distinct Result values */}
          {result.distinctResults.length > 0 && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <p className="text-xs font-medium text-slate-700 mb-2">Distinct Result Values Detected:</p>
              <div className="flex flex-wrap gap-2">
                {result.distinctResults.map(r => (
                  <span key={r} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-white border border-slate-200 text-slate-700">
                    {r}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* User table */}
          <div className="overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left px-3 py-2.5 text-xs font-semibold text-slate-600">User</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600">Inbound Calls</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600">Inbound Answered</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600">Inbound Answer Rate</th>
                </tr>
              </thead>
              <tbody>
                {result.userRows.map((u, i) => (
                  <tr
                    key={u.user}
                    className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/40" : ""} ${u.user.startsWith("Unmapped") ? "opacity-60" : ""}`}
                  >
                    <td className={`px-3 py-2 font-medium ${u.user.startsWith("Unmapped") ? "italic text-slate-400" : "text-slate-800"}`}>
                      {u.user}
                    </td>
                    <td className="px-3 py-2 text-right text-blue-700">{u.inbound.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-green-700">{u.inbound_answered.toLocaleString()}</td>
                    <td className={`px-3 py-2 text-right ${rateColor(u.answer_rate)}`}>
                      {formatRate(u.answer_rate)}
                    </td>
                  </tr>
                ))}
                {result.userRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-slate-400">No rows found in file.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400">
            {result.userRows.filter(u => !u.user.startsWith("Unmapped")).length} mapped user{result.userRows.filter(u => !u.user.startsWith("Unmapped")).length !== 1 ? "s" : ""}
            {result.totalUnmapped > 0 && ` · ${result.totalUnmapped} unmapped call${result.totalUnmapped !== 1 ? "s" : ""}`}
          </p>
        </div>
      )}
    </div>
  );
}