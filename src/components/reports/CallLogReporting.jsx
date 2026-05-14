import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Phone, AlertCircle, CheckCircle, Loader2, Download, Trash2, Users } from "lucide-react";
import CallLogUserConfigAdmin from "./CallLogUserConfigAdmin";
import PerformanceViews from "./PerformanceViews";
import CdrUpload from "./CdrUpload";
import CdrInboundMetricsCard from "./CdrInboundMetricsCard";
import UserBreakdownTable from "./UserBreakdownTable";
import ExcelJS from "exceljs";
import { secondsToHHMMSS } from "./ExcelExportHelpers";
import { exportPeriodExcel as runExportPeriodExcel } from "./ExcelExportRunner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";

/** Format YYYY-MM-DD to M/D/YYYY for display */
function formatDate(str) {
  if (!str) return "";
  const [y, m, d] = str.split("-");
  return `${parseInt(m, 10)}/${parseInt(d, 10)}/${y}`;
}

// ---- Header normalization ----
function normalizeHeader(h) {
  return String(h).toLowerCase().replace(/\s+/g, ' ').trim();
}

// Required headers for Aggregated (Vonage User Summary) upload
const REQUIRED_NORMALIZED_AGGREGATED = [
  "user",
  "total calls",
  "inbound calls",
  "outbound calls",
  "answered calls",
  "missed calls",
  "total call duration (minutes)",
  "inbound call duration (minutes)",
  "outbound call duration (minutes)",
  "reporting period start",
  "reporting period end",
];

const PERIOD_COL_START = "reporting period start";
const PERIOD_COL_END   = "reporting period end";

/** Detect unique week (start, end) pairs from rows for display */
function detectWeekSummary(rows) {
  if (!rows || rows.length === 0) return [];
  const firstRow = rows[0];
  const rawKeys = Object.keys(firstRow);
  const startKey = rawKeys.find(k => normalizeHeader(k) === PERIOD_COL_START);
  const endKey   = rawKeys.find(k => normalizeHeader(k) === PERIOD_COL_END);
  if (!startKey || !endKey) return [];

  const seen = new Set();
  const pairs = [];
  for (const row of rows) {
    const start = toIsoDate(row[startKey]);
    const end   = toIsoDate(row[endKey]);
    if (!start || !end) continue;
    const key = `${start}|${end}`;
    if (!seen.has(key)) { seen.add(key); pairs.push({ start, end }); }
  }
  return pairs;
}

/** Convert Excel serial date or date string to YYYY-MM-DD */
function toIsoDate(val) {
  if (!val && val !== 0) return null;
  if (typeof val === "number") {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const day = String(val.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
  const s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const mdy4 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy4) return `${mdy4[3]}-${String(mdy4[1]).padStart(2,"0")}-${String(mdy4[2]).padStart(2,"0")}`;
  const mdy2 = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (mdy2) {
    const year = 2000 + parseInt(mdy2[3], 10);
    return `${year}-${String(mdy2[1]).padStart(2,"0")}-${String(mdy2[2]).padStart(2,"0")}`;
  }
  return null;
}

function validatePeriodColumns(rows) {
  if (!rows || rows.length === 0) return { error: "No data rows." };
  const firstRow = rows[0];
  const headers = Object.keys(firstRow).map(normalizeHeader);
  const hasStart = headers.includes(PERIOD_COL_START);
  const hasEnd   = headers.includes(PERIOD_COL_END);
  if (!hasStart || !hasEnd) {
    return { error: "Reporting Period Start and End columns are required in the worksheet." };
  }
  return { ok: true };
}

// ---- File parsing ----

async function readWorkbookFile(file) {
  const buffer = await file.arrayBuffer();
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheetNames = wb.worksheets.map(s => s.name);
  return { workbook: wb, sheetNames };
}

function serializeCellValue(val) {
  if (val == null) return "";
  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, "0");
    const d = String(val.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  if (typeof val === "object" && val.result != null) return serializeCellValue(val.result);
  if (typeof val === "object" && val.text != null) return val.text;
  if (typeof val === "object") return String(val);
  return val;
}

function sheetToJson(worksheet) {
  const rows = [];
  let headers = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
    const values = row.values.slice(1);
    if (rowNum === 1) {
      headers = values.map(v => (v == null ? "" : String(v)));
    } else {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = serializeCellValue(values[i]); });
      rows.push(obj);
    }
  });
  return rows;
}

function readCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const lines = text.split(/\r?\n/).filter(l => l.trim());
        if (!lines.length) { resolve([]); return; }
        const headers = lines[0].split(",").map(h => h.replace(/^"|"$/g, "").trim());
        const rows = lines.slice(1).map(line => {
          const cols = line.split(",").map(c => c.replace(/^"|"$/g, "").trim());
          const obj = {};
          headers.forEach((h, i) => { obj[h] = cols[i] ?? ""; });
          return obj;
        });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function formatPeriodLabel(period) {
  if (!period) return "";
  const key = period.monthly_key || period.reporting_period_start?.substring(0, 7);
  if (key) {
    const d = new Date(key + "-01T12:00:00");
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  const start = period.reporting_period_start;
  const fmtShort = (str) => {
    if (!str) return "";
    const [y, m, day] = str.split("-");
    return `${parseInt(m, 10)}/${parseInt(day, 10)}/${y}`;
  };
  return fmtShort(start);
}

const STATUS_COLORS = {
  "Monthly": "bg-blue-100 text-blue-800",
  "Monthly (Aggregated)": "bg-indigo-100 text-indigo-800",
  "Weekly": "bg-green-100 text-green-800",
  "Custom Range": "bg-purple-100 text-purple-800"
};

export default function CallLogReporting() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [workbook, setWorkbook] = useState(null);
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [weekSummary, setWeekSummary] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deleteDialogPeriod, setDeleteDialogPeriod] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [sortCol, setSortCol] = useState("user");
  const [sortDir, setSortDir] = useState("asc");
  const [userSearch, setUserSearch] = useState("");
  const [benchmarkOnly, setBenchmarkOnly] = useState(true);

  const { data: periods = [], isLoading: periodsLoading } = useQuery({
    queryKey: ["call-log-periods"],
    queryFn: async () => {
      const all = await base44.entities.CallLogPeriod.list();
      return all.sort((a, b) => (b.monthly_key || "").localeCompare(a.monthly_key || ""));
    }
  });

  React.useEffect(() => {
    if (!periods.length || selectedPeriod) return;
    setSelectedPeriod(periods[0]);
  }, [periods]);

  const batchFetch = async (entity, query, batchSize = 5000) => {
    let allRecords = [];
    let skip = 0;
    try {
      while (true) {
        const batch = await entity.filter(query, "-updated_date", batchSize, skip);
        if (!batch || batch.length === 0) break;
        allRecords = allRecords.concat(batch);
        if (batch.length < batchSize) break;
        skip += batchSize;
      }
    } catch (err) {
      console.error("Batch fetch error:", err);
      return [];
    }
    return allRecords;
  };

  const { data: userSummaries = [], isLoading: summariesLoading } = useQuery({
    queryKey: ["call-log-summaries", selectedPeriod?.id],
    queryFn: () => batchFetch(base44.entities.CallLogUserSummary, { period_id: selectedPeriod.id }),
    enabled: !!selectedPeriod?.id
  });

  const { data: allUserConfigs = [] } = useQuery({
    queryKey: ["call-log-user-configs"],
    queryFn: () => batchFetch(base44.entities.CallLogUserConfig, {}),
  });

  const { data: cdrUserStats = [] } = useQuery({
    queryKey: ["call-log-cdr-user-stats", selectedPeriod?.monthly_key],
    queryFn: async () => {
      const mk = selectedPeriod?.monthly_key; if (!mk) return [];
      console.log("[CDR_QUERY] Querying with monthly_key:", mk);
      try {
        const cdrUploads = await batchFetch(base44.entities.CallLogCdrUploads, {reporting_period_key: mk});
        console.log("[CDR_QUERY] Found uploads:", cdrUploads?.length); if (!cdrUploads?.length) return [];
        const stats = await batchFetch(base44.entities.CallLogCdrUserStats, {cdr_upload_id: cdrUploads[0].id});
        console.log("[CDR_QUERY] Got stats:", stats?.length, "first:", stats?.[0]); return stats || [];
      } catch (e) { console.error("[CDR_QUERY]", e); return []; }
    },
    enabled: !!selectedPeriod?.monthly_key
  });

  const userConfigMap = React.useMemo(() => {
    const map = {};
    for (const cfg of allUserConfigs) {
      if (cfg.user_name) map[cfg.user_name] = cfg;
    }
    return map;
  }, [allUserConfigs]);

  const sortedWeeks = React.useMemo(() => {
    const uploadedWeeks = selectedPeriod?.uploaded_weeks || [];
    return uploadedWeeks.slice().sort((a, b) => (a.week_start || "").localeCompare(b.week_start || ""));
  }, [selectedPeriod]);

  const norm = (s) => (s||"").trim().toLowerCase().replace(/\s+/g, " ");

  const benchmarkSet = React.useMemo(() => {
    console.log("CONFIG_NAMES_SAMPLE", allUserConfigs.slice(0,5).map(c=>({user_name:c.user_name,include_in_benchmark:c.include_in_benchmark})));
    console.log("SUMMARY_NAMES_SAMPLE", userSummaries.slice(0,5).map(u=>({user:u.user})));
    const s = new Set(allUserConfigs.filter(c => c.include_in_benchmark === true).map(c => norm(c.user_name)));
    console.log("BENCHMARK_SET_SIZE", s.size, [...s].slice(0,5));
    return s;
  }, [allUserConfigs, userSummaries]);

  // All summaries with call data, enriched
  const allEnrichedSummaries = React.useMemo(() => {
    return userSummaries.filter(u => (u.total_calls || 0) > 0).map(u => ({
      ...u,
      inbound_answer_rate: u.inbound > 0 ? ((Number(u.inbound || 0) - Number(u.missed || 0)) / Number(u.inbound)) * 100 : null,
      in_benchmark: benchmarkSet.has(norm(u.user)),
    }));
  }, [userSummaries, benchmarkSet]);

  // Benchmark-only summaries (include_in_benchmark === true)
  const enrichedSummaries = React.useMemo(() => {
    return allEnrichedSummaries.filter(u => u.in_benchmark);
  }, [allEnrichedSummaries]);

  // Active summaries based on toggle
  const displaySummaries = benchmarkOnly ? enrichedSummaries : allEnrichedSummaries;

  const TABLE_COLS = [
    { key: "user",                  label: "User",                    type: "alpha" },
    { key: "total_calls",           label: "Total Calls",             type: "num"   },
    { key: "inbound",               label: "Inbound",                 type: "num"   },
    { key: "outbound",              label: "Outbound",                type: "num"   },
    { key: "answered",              label: "Connected (All)",         type: "num"   },
    { key: "missed",                label: "Missed",                  type: "num"   },
    { key: "total_duration_seconds",label: "Duration (HH:MM:SS)",     type: "num"   },
    { key: "answer_rate",           label: "Inbound Answer Rate",     type: "num"   },
    { key: "avg_duration_seconds",  label: "Avg Duration (HH:MM:SS)", type: "num"   },
  ];

  const getSortValue = (u, key) => {
    if (key === "answer_rate") {
      const ar = u.inbound_answer_rate_cdr;
      return ar !== null ? ar / 100 : -1;
    }
    return u[key] ?? 0;
  };

  React.useEffect(() => { setUserSearch(""); setSortCol("user"); setSortDir("asc"); }, [selectedPeriod?.id]);

  const activeSummaries = [...displaySummaries]
    .sort((a, b) => {
      const col = TABLE_COLS.find(c => c.key === sortCol);
      if (!col) return 0;
      const dir = sortDir === "desc" ? -1 : 1;
      if (col.type === "alpha") {
        return dir * (a.user || "").trim().toLowerCase().localeCompare((b.user || "").trim().toLowerCase());
      }
      return dir * (getSortValue(a, sortCol) - getSortValue(b, sortCol));
    });

  const totalCalls          = activeSummaries.reduce((s, u) => s + (u.total_calls || 0), 0);
  const totalInbound        = activeSummaries.reduce((s, u) => s + (u.inbound || 0), 0);
  const totalOutbound       = activeSummaries.reduce((s, u) => s + (u.outbound || 0), 0);
  const totalInboundAnswered= activeSummaries.reduce((s, u) => s + (u.inbound_answered != null ? u.inbound_answered : (u.answered || 0)), 0);
  const totalMissed         = activeSummaries.reduce((s, u) => s + (u.missed || 0), 0);
  const totalDurationSec    = activeSummaries.reduce((s, u) => s + (u.total_duration_seconds || 0), 0);
  const overallAnswerRate   = totalInbound > 0 ? totalInboundAnswered / totalInbound : null;
  const overallAvgDurationSec = totalCalls > 0 ? totalDurationSec / totalCalls : 0;

  // ── Front-End Answer Rate (benchmark_group === "Front End") ──────────────
  const frontEndSummaries = React.useMemo(() => {
    return userSummaries.filter(u => {
      const cfg = allUserConfigs.find(c => norm(c.user_name) === norm(u.user));
      return cfg && cfg.benchmark_group === "Front End";
    });
  }, [userSummaries, allUserConfigs]);
  const feInbound  = frontEndSummaries.reduce((s, u) => s + (u.inbound || 0), 0);
  const feAnswered = frontEndSummaries.reduce((s, u) => s + (u.inbound_answered != null ? u.inbound_answered : Math.max((u.inbound || 0) - (u.missed || 0), 0)), 0);
  const feAnswerRate = feInbound > 0 ? feAnswered / feInbound : null;

  const resetUpload = () => {
    setShowUpload(false);
    setUploadFile(null);
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet("");
    setUploadError("");
    setWeekSummary([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadFile(file);
    setUploadError("");
    setWorkbook(null);
    setSheetNames([]);
    setSelectedSheet("");

    const isXlsx = file.name.toLowerCase().endsWith(".xlsx") || file.name.toLowerCase().endsWith(".xls");
    if (isXlsx) {
      try {
        const { workbook: wb, sheetNames: names } = await readWorkbookFile(file);
        setWorkbook(wb);
        setSheetNames(names);
        if (names.length === 1) {
          setSelectedSheet(names[0]);
          const ws = wb.getWorksheet(names[0]);
          if (ws) {
            const rows = sheetToJson(ws);
            const { error } = validatePeriodColumns(rows);
            if (error) setUploadError(error);
            else setWeekSummary(detectWeekSummary(rows));
          }
        }
      } catch (err) {
        console.error("Excel read error:", err);
        setUploadError("Failed to read Excel file: " + (err.message || "unknown error"));
      }
    } else {
      try {
        const rows = await readCSV(file);
        const { error } = validatePeriodColumns(rows);
        if (error) setUploadError(error);
        else setWeekSummary(detectWeekSummary(rows));
      } catch (err) {
        setUploadError("Failed to read CSV file.");
      }
    }
  };

  const getRows = async () => {
    const isXlsx = uploadFile?.name.toLowerCase().endsWith(".xlsx") || uploadFile?.name.toLowerCase().endsWith(".xls");
    if (isXlsx) {
      if (!workbook) return { error: "Failed to read workbook." };
      const sheetName = selectedSheet || workbook.worksheets[0]?.name;
      const worksheet = workbook.getWorksheet(sheetName);
      if (!worksheet) return { error: "Worksheet not found." };
      const rows = sheetToJson(worksheet);
      if (!rows || rows.length === 0) return { error: "Selected worksheet contains no data rows." };
      const normalizedHeaders = Object.keys(rows[0]).map(normalizeHeader);
      const missing = REQUIRED_NORMALIZED_AGGREGATED.filter(h => !normalizedHeaders.includes(h));
      if (missing.length > 0) return { error: `Missing required columns for Aggregated upload: ${missing.join(", ")}` };
      const { error: colError } = validatePeriodColumns(rows);
      if (colError) return { error: colError };
      return { rows };
    } else {
      try {
        const rows = await readCSV(uploadFile);
        if (!rows || rows.length === 0) return { error: "File contains no data rows." };
        const normalizedHeaders = Object.keys(rows[0]).map(normalizeHeader);
        const missing = REQUIRED_NORMALIZED_AGGREGATED.filter(h => !normalizedHeaders.includes(h));
        if (missing.length > 0) return { error: `Missing required columns for Aggregated upload: ${missing.join(", ")}` };
        const { error: colError } = validatePeriodColumns(rows);
        if (colError) return { error: colError };
        return { rows };
      } catch {
        return { error: "Failed to parse CSV file." };
      }
    }
  };

  const handleUpload = async () => {
    setUploadError("");
    if (!uploadFile) { setUploadError("Please select a file."); return; }

    const isXlsx = uploadFile.name.toLowerCase().endsWith(".xlsx") || uploadFile.name.toLowerCase().endsWith(".xls");
    if (isXlsx && sheetNames.length > 1 && !selectedSheet) {
      setUploadError("Please select a worksheet to import.");
      return;
    }

    setUploading(true);
    const { rows, error: rowError } = await getRows();
    if (rowError) {
      setUploadError(rowError);
      setUploading(false);
      return;
    }

    try {
      const response = await base44.functions.invoke("processCallLog", {
        rows,
        fileName: uploadFile.name
      });

      const result = response.data;

      if (result.error) {
        setUploadError(result.error);
        setUploading(false);
        return;
      }

      await queryClient.invalidateQueries({ queryKey: ["call-log-periods"] });
      queryClient.invalidateQueries({ queryKey: ["call-log-summaries"] });
      queryClient.invalidateQueries({ queryKey: ["cdr-metrics"] });

      const freshPeriods = await base44.entities.CallLogPeriod.list("-uploaded_at");
      if (freshPeriods.length > 0) setSelectedPeriod(freshPeriods[0]);

      if (result.all_duplicate) {
        toast({ title: "No New Data", description: result.message, variant: "destructive" });
      } else {
        toast({ title: "Upload Successful", description: result.message });
      }

      resetUpload();
    } catch (err) {
      setUploadError(err.message || "Upload failed.");
    }
    setUploading(false);
  };

  const handleDelete = async () => {
    if (!deleteDialogPeriod) return;
    setDeleting(true);
    const summaries = await base44.entities.CallLogUserSummary.filter({ period_id: deleteDialogPeriod.id });
    for (const s of summaries) {
      await base44.entities.CallLogUserSummary.delete(s.id);
    }
    await base44.entities.CallLogPeriod.delete(deleteDialogPeriod.id);
    queryClient.invalidateQueries({ queryKey: ["call-log-periods"] });
    if (selectedPeriod?.id === deleteDialogPeriod.id) setSelectedPeriod(null);
    setDeleteDialogPeriod(null);
    setDeleting(false);
    toast({ title: "Deleted", description: "Reporting period deleted." });
  };

  const exportPeriodExcel = () => runExportPeriodExcel({
    selectedPeriod,
    enrichedSummaries,        // always benchmark-only in export
    frontEndSummaries,
    totalCalls: enrichedSummaries.reduce((s, u) => s + (u.total_calls || 0), 0),
    totalInbound: enrichedSummaries.reduce((s, u) => s + (u.inbound || 0), 0),
    totalOutbound: enrichedSummaries.reduce((s, u) => s + (u.outbound || 0), 0),
    totalInboundAnswered: enrichedSummaries.reduce((s, u) => s + (u.inbound_answered != null ? u.inbound_answered : (u.answered || 0)), 0),
    totalMissed: enrichedSummaries.reduce((s, u) => s + (u.missed || 0), 0),
    totalDurationSec: enrichedSummaries.reduce((s, u) => s + (u.total_duration_seconds || 0), 0),
    overallAvgDurationSec: (() => { const tc = enrichedSummaries.reduce((s,u) => s+(u.total_calls||0),0); const dur = enrichedSummaries.reduce((s,u) => s+(u.total_duration_seconds||0),0); return tc > 0 ? dur/tc : 0; })(),
    formatPeriodLabel,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Phone className="w-5 h-5 text-blue-600" />
            Call Log Reporting
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Vonage call analytics by reporting period</p>
        </div>
      </div>

      <Tabs defaultValue="reporting">
        <TabsList className="mb-2">
          <TabsTrigger value="reporting" className="gap-2"><Phone className="w-3.5 h-3.5" /> Reporting</TabsTrigger>
          <TabsTrigger value="cdr" className="gap-2"><Upload className="w-3.5 h-3.5" /> Upload CDR</TabsTrigger>
          <TabsTrigger value="users" className="gap-2"><Users className="w-3.5 h-3.5" /> User Directory</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <CallLogUserConfigAdmin />
        </TabsContent>

        <TabsContent value="cdr">
          <CdrUpload
            periodKey={selectedPeriod?.monthly_key}
            periodType={selectedPeriod?.period_type || "month"}
            periodStart={selectedPeriod?.period_start}
            periodEnd={selectedPeriod?.period_end}
          />
        </TabsContent>

        <TabsContent value="reporting">
          <div className="flex justify-end">
            <Button onClick={() => setShowUpload(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Upload className="w-4 h-4" /> Upload Call Log
            </Button>
          </div>

          {/* Upload panel */}
          {showUpload && (
            <Card className="border-blue-200 bg-blue-50/40">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Upload Vonage Call Log Export</h3>
                  <Button variant="ghost" size="sm" onClick={resetUpload}>✕</Button>
                </div>

                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-600">Upload Type:</p>
                  <div className="flex items-center gap-3 text-xs font-medium flex-wrap">
                    <span className="px-2.5 py-1 rounded-full bg-blue-600 text-white shadow-sm">
                      ✓ User Summary (Aggregated)
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 cursor-default">
                      Inbound Call Detail (CDR)
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">For CDR inbound call-level detail, use the <strong>Upload CDR</strong> tab.</p>
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-700 block mb-1">
                    File (.xlsx or .csv) <span className="text-red-500">*</span>
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.csv"
                    onChange={handleFileSelect}
                    className="block w-full text-sm text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                  />
                  {uploadFile && (
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-green-600" /> {uploadFile.name}
                    </p>
                  )}
                </div>

                {/* Worksheet selector – only for multi-sheet xlsx */}
                {sheetNames.length > 1 && (
                  <div>
                    <label className="text-xs font-medium text-slate-700 block mb-1">
                      Select Worksheet to Import <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedSheet}
                      onChange={async e => {
                        const name = e.target.value;
                        setSelectedSheet(name);
                        setUploadError("");
                        setWeekSummary([]);
                        if (name && workbook) {
                          const ws = workbook.getWorksheet(name);
                          if (ws) {
                            const rows = sheetToJson(ws);
                            const { error } = validatePeriodColumns(rows);
                            if (error) setUploadError(error);
                            else setWeekSummary(detectWeekSummary(rows));
                          }
                        }
                      }}
                      className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— Choose a worksheet —</option>
                      {sheetNames.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {sheetNames.length === 1 && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-600" /> Worksheet: <strong>{sheetNames[0]}</strong> (auto-selected)
                  </p>
                )}

                {weekSummary.length > 0 && (
                  <div className="bg-white/70 border border-slate-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-slate-700 mb-2">
                      {weekSummary.length} week{weekSummary.length !== 1 ? "s" : ""} detected in worksheet:
                    </p>
                    <ul className="space-y-1">
                      {weekSummary.map((w, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
                          <CheckCircle className="w-3 h-3 text-green-600 shrink-0" />
                          <span>{formatDate(w.start)} – {formatDate(w.end)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="text-xs text-slate-500 bg-white/60 border border-slate-200 rounded p-2.5">
                  <strong>Required headers (Aggregated):</strong> User, Total Calls, Inbound Calls, Outbound Calls, Answered Calls, Missed Calls, Total Call Duration (Minutes), Inbound Call Duration (Minutes), Outbound Call Duration (Minutes), Reporting Period Start, Reporting Period End<br />
                  <span className="text-slate-400">Inbound Answer Rate = Answered Calls ÷ Inbound Calls. If Inbound Calls = 0, rate = 0%.</span>
                </div>

                {uploadError && (
                  <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {uploadError}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button onClick={handleUpload} disabled={uploading} className="gap-2 bg-blue-600 hover:bg-blue-700">
                    {uploading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                      : <><Upload className="w-4 h-4" /> Process Upload</>}
                  </Button>
                  <Button variant="outline" onClick={resetUpload}>Cancel</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Reporting Period Dropdown */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Reporting Period</label>
            {periodsLoading ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading...
              </div>
            ) : periods.length === 0 ? (
              <p className="text-sm text-slate-400">No periods uploaded yet.</p>
            ) : (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <select
                  value={selectedPeriod?.id || ""}
                  onChange={e => {
                    const p = periods.find(p => p.id === e.target.value);
                    setSelectedPeriod(p || null);
                  }}
                  className="border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[220px]"
                >
                  {periods.map(p => (
                    <option key={p.id} value={p.id}>{formatPeriodLabel(p)}</option>
                  ))}
                </select>
                {selectedPeriod && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-red-600 shrink-0"
                    title="Delete this period"
                    onClick={() => setDeleteDialogPeriod(selectedPeriod)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Dashboard */}
          {selectedPeriod && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 flex-wrap">
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_COLORS[selectedPeriod.status] || "bg-slate-100 text-slate-700"}`}>
                  {selectedPeriod.status}
                </span>
                {selectedPeriod.uploaded_weeks && selectedPeriod.uploaded_weeks.length > 0 && (
                  <span className="text-xs text-slate-500">
                    {selectedPeriod.uploaded_weeks.length} week{selectedPeriod.uploaded_weeks.length !== 1 ? "s" : ""} uploaded
                    <span className="text-slate-400 ml-1">
                      ({selectedPeriod.uploaded_weeks.map(w => {
                        const s = w.week_start?.split("-"); const e = w.week_end?.split("-");
                        return s && e ? `${parseInt(s[1])}/${parseInt(s[2])}–${parseInt(e[1])}/${parseInt(e[2])}` : "";
                      }).join(", ")})
                    </span>
                  </span>
                )}
                {/* Benchmark toggle */}
                <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-medium shadow-sm">
                  <button
                    onClick={() => setBenchmarkOnly(true)}
                    className={`px-3 py-1 rounded-md transition-all ${benchmarkOnly ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
                  >
                    Benchmark Only
                  </button>
                  <button
                    onClick={() => setBenchmarkOnly(false)}
                    className={`px-3 py-1 rounded-md transition-all ${!benchmarkOnly ? "bg-slate-700 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"}`}
                  >
                    All Extensions
                  </button>
                </div>
                <div className="ml-auto">
                  <Button variant="outline" size="sm" onClick={exportPeriodExcel} disabled={!enrichedSummaries || enrichedSummaries.length === 0} className="gap-2">
                    <Download className="w-4 h-4" /> Export Excel Report
                  </Button>
                </div>
              </div>
              {/* Scope notice */}
              <div className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded-md border ${benchmarkOnly ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                <span className="font-semibold">{benchmarkOnly ? "📊 Benchmark Only:" : "📋 All Extensions:"}</span>
                {benchmarkOnly
                  ? `Showing ${enrichedSummaries.length} in-benchmark users. Fax, voicemail, clinical, and admin lines excluded.`
                  : `Showing all ${allEnrichedSummaries.length} extensions. Export always uses Benchmark Only.`}
              </div>

              {summariesLoading ? (
                <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading...
                </div>
              ) : (
                <>
                  <CdrInboundMetricsCard
                    periodKey={selectedPeriod?.monthly_key}
                    periodType={selectedPeriod?.period_type || "month"}
                    periodStart={selectedPeriod?.period_start}
                    periodEnd={selectedPeriod?.period_end}
                    periodLabel={formatPeriodLabel(selectedPeriod)}
                    onUploadClick={() => {
                      const tabsList = document.querySelector('[value="cdr"]');
                      if (tabsList) tabsList.click();
                    }}
                  />

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Total Calls",    value: totalCalls.toLocaleString(),            color: "text-slate-900" },
                      { label: "Inbound",        value: totalInbound.toLocaleString(),           color: "text-blue-700" },
                      { label: "Outbound",       value: totalOutbound.toLocaleString(),          color: "text-indigo-700" },
                      { label: "Inbound Answered", value: totalInboundAnswered.toLocaleString(), color: "text-green-700" },
                      { label: "Missed",           value: totalMissed.toLocaleString(),          color: "text-red-600" },
                      { label: benchmarkOnly ? "Inbound Answer Rate (Benchmark)" : "Inbound Answer Rate (All)",
                        value: overallAnswerRate === null ? "—" : (overallAnswerRate * 100).toFixed(2) + "%",
                        color: overallAnswerRate === null ? "text-slate-400" : overallAnswerRate >= 0.8 ? "text-green-700" : overallAnswerRate >= 0.5 ? "text-yellow-700" : "text-red-600" },
                      { label: "Front-End Answer Rate",
                        value: feAnswerRate === null ? "—" : (feAnswerRate * 100).toFixed(2) + "%",
                        color: feAnswerRate === null ? "text-slate-400" : feAnswerRate >= 0.8 ? "text-green-700" : feAnswerRate >= 0.5 ? "text-yellow-700" : "text-red-600",
                        highlight: true },
                      { label: "Total Duration", value: secondsToHHMMSS(totalDurationSec),      color: "text-slate-700" },
                      { label: "Avg Duration",   value: secondsToHHMMSS(overallAvgDurationSec), color: "text-slate-700" },
                    ].map(m => (
                      <Card key={m.label} className={`shadow-sm ${m.highlight ? "border-blue-300 bg-blue-50/40" : "border-slate-200"}`}>
                        <CardContent className="p-4">
                          <p className={`text-xs font-medium mb-1 ${m.highlight ? "text-blue-600 font-semibold" : "text-slate-500"}`}>{m.label}</p>
                          <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                          {m.highlight && <p className="text-[10px] text-blue-400 mt-0.5">Front End staff only</p>}
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {sortedWeeks.length > 0 && (
                    <Card className="border-slate-200 shadow-sm">
                      <CardContent className="p-4">
                        <PerformanceViews sortedWeeks={sortedWeeks} userConfigMap={userConfigMap} />
                      </CardContent>
                    </Card>
                  )}

                  <UserBreakdownTable
                    summaries={displaySummaries}
                    sortCol={sortCol}
                    sortDir={sortDir}
                    onSortChange={(col, dir) => { setSortCol(col); setSortDir(dir); }}
                    userSearch={userSearch}
                    onSearchChange={setUserSearch}
                  />
                </>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!deleteDialogPeriod} onOpenChange={open => !open && setDeleteDialogPeriod(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reporting Period?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this reporting period and all associated user data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}