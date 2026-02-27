import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Upload, AlertCircle, CheckCircle, Loader2 } from "lucide-react";

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
  });
}

// --- Required headers (case-insensitive) ---
const REQUIRED_HEADERS = ["direction", "to", "result", "date/time", "duration"];

function normalizeKey(k) {
  return String(k).toLowerCase().trim();
}

function findKey(obj, normalized) {
  return Object.keys(obj).find(k => normalizeKey(k) === normalized);
}

function buildExtensionMap(configs) {
  const map = {}; // ext string -> user_name
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
  // Build per-user aggregates
  const users = {}; // user_name -> { inbound, inbound_answered }

  const ensure = (name) => {
    if (!users[name]) users[name] = { inbound: 0, inbound_answered: 0 };
  };

  let totalInbound = 0;
  let totalMapped = 0;
  let totalUnmapped = 0;

  for (const row of rows) {
    const dirKey    = findKey(row, "direction");
    const toKey     = findKey(row, "to");
    const resultKey = findKey(row, "result");

    if (!dirKey) continue;

    const direction = String(row[dirKey] || "").trim().toLowerCase();
    if (direction !== "inbound") continue;

    totalInbound++;

    const toRaw = toKey ? String(row[toKey] || "").trim() : "";
    const toLower = toRaw.toLowerCase();
    const result  = resultKey ? String(row[resultKey] || "").trim().toLowerCase() : "";

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
    if (result === "answered") users[userName].inbound_answered++;
  }

  const userRows = Object.entries(users).map(([name, vals]) => ({
    user: name,
    inbound: vals.inbound,
    inbound_answered: vals.inbound_answered,
    answer_rate: vals.inbound > 0 ? vals.inbound_answered / vals.inbound : null,
  })).sort((a, b) => {
    // Unmapped at bottom, then sort by inbound desc
    const aUnmapped = a.user.startsWith("Unmapped");
    const bUnmapped = b.user.startsWith("Unmapped");
    if (aUnmapped && !bUnmapped) return 1;
    if (!aUnmapped && bUnmapped) return -1;
    return b.inbound - a.inbound;
  });

  return { userRows, totalInbound, totalMapped, totalUnmapped };
}

export default function CdrUpload() {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null); // { userRows, totalInbound, totalMapped, totalUnmapped }

  const { data: configs = [] } = useQuery({
    queryKey: ["call-log-user-configs"],
    queryFn: () => base44.entities.CallLogUserConfig.list(),
  });

  const extensionMap = React.useMemo(() => buildExtensionMap(configs), [configs]);

  const reset = () => {
    setFile(null);
    setError("");
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setError("");
    setResult(null);
  };

  const handleProcess = async () => {
    if (!file) { setError("Please select a file."); return; }
    setError("");
    setProcessing(true);

    try {
      let rows;
      const text = await file.text();
      rows = parseCSV(text);

      if (!rows.length) { setError("File contains no data rows."); setProcessing(false); return; }

      // Validate required headers
      const sampleKeys = Object.keys(rows[0]).map(normalizeKey);
      const missing = REQUIRED_HEADERS.filter(h => !sampleKeys.includes(h));
      if (missing.length > 0) {
        setError(`Missing required column(s): ${missing.join(", ")}. Expected: Direction, To, Result, Date/Time, Duration`);
        setProcessing(false);
        return;
      }

      const processed = processRows(rows, extensionMap);
      setResult(processed);
    } catch (err) {
      setError("Failed to parse file: " + (err.message || "unknown error"));
    }
    setProcessing(false);
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
          Upload CDR (Inbound Mapping)
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Upload a Vonage CDR export to map inbound calls to users by extension.
          Required columns: <strong>Direction, To, Result, Date/Time, Duration</strong>
        </p>
      </div>

      <div className="bg-blue-50/40 border border-blue-200 rounded-lg p-4 space-y-3">
        <div>
          <label className="text-xs font-medium text-slate-700 block mb-1">
            CDR File (.csv) <span className="text-red-500">*</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
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
            disabled={processing || !file}
            className="gap-2 bg-blue-600 hover:bg-blue-700"
          >
            {processing
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Processing…</>
              : <><Upload className="w-3.5 h-3.5" /> Process CDR</>}
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
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total Inbound", value: result.totalInbound, color: "text-blue-700" },
              { label: "Mapped",        value: result.totalMapped,   color: "text-green-700" },
              { label: "Unmapped",      value: result.totalUnmapped, color: result.totalUnmapped > 0 ? "text-orange-600" : "text-slate-400" },
            ].map(m => (
              <div key={m.label} className="bg-white border border-slate-200 rounded-lg p-3 text-center shadow-sm">
                <p className="text-xs text-slate-500 mb-1">{m.label}</p>
                <p className={`text-2xl font-bold ${m.color}`}>{m.value.toLocaleString()}</p>
              </div>
            ))}
          </div>

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
                    className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/40" : ""} ${u.user.startsWith("Unmapped") ? "text-slate-400 italic" : ""}`}
                  >
                    <td className="px-3 py-2 font-medium">{u.user}</td>
                    <td className="px-3 py-2 text-right text-blue-700">{u.inbound.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-green-700">{u.inbound_answered.toLocaleString()}</td>
                    <td className={`px-3 py-2 text-right ${rateColor(u.answer_rate)}`}>
                      {formatRate(u.answer_rate)}
                    </td>
                  </tr>
                ))}
                {result.userRows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-slate-400">No inbound calls found in file.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400">{result.userRows.length} user{result.userRows.length !== 1 ? "s" : ""} with inbound activity</p>
        </div>
      )}
    </div>
  );
}