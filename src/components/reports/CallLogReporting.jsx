import React, { useState, useRef, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, Phone, AlertCircle, CheckCircle, Loader2, Download, Trash2, ChevronDown } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

// ---- Formatting helpers ----
function secondsToHHMMSS(seconds) {
  if (!seconds || seconds === 0) return "0:00:00";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatPercent(val) {
  if (!val && val !== 0) return "0.0%";
  return (val * 100).toFixed(1) + "%";
}

function formatDate(str) {
  if (!str) return "";
  const [y, m, d] = str.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
];

function periodLabel(period) {
  if (!period) return "";
  if (period.status === "Monthly") {
    const [y, m] = (period.reporting_period_start || "").split("-");
    if (y && m) return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
  }
  return `${period.reporting_period_start} to ${period.reporting_period_end}`;
}

// ---- Header normalization ----
function normalizeHeader(h) {
  return String(h).toLowerCase().replace(/\s+/g, ' ').trim();
}

const REQUIRED_NORMALIZED = [
  "user",
  "total calls",
  "inbound calls",
  "outbound calls",
  "answered calls",
  "missed calls",
  "voicemail calls",
  "total call duration (minutes)",
  "inbound call duration (minutes)",
  "outbound call duration (minutes)"
];

// ---- File parsing ----
// Reads the workbook and returns { sheetNames, workbook }
function readWorkbook(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        resolve({ sheetNames: workbook.SheetNames, workbook });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

// Parses rows from a specific sheet name
function parseSheetFromWorkbook(workbook, sheetName) {
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" });
}

// For CSV: parse directly into rows
function parseCSV(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: "string" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(sheet, { defval: "" }));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// Pick default period: current month if exists, else most recent
function pickDefaultPeriod(periods) {
  if (!periods || periods.length === 0) return null;
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const currentMonthPeriod = periods.find(p => {
    if (p.status !== "Monthly") return false;
    const [y, m] = (p.reporting_period_start || "").split("-");
    return parseInt(y, 10) === thisYear && parseInt(m, 10) === thisMonth;
  });
  return currentMonthPeriod || periods[0];
}

export default function CallLogReporting() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [parsedWorkbook, setParsedWorkbook] = useState(null); // { sheetNames, workbook }
  const [sheetNames, setSheetNames] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deleteDialogPeriod, setDeleteDialogPeriod] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [defaultSet, setDefaultSet] = useState(false);

  const { data: periods = [], isLoading: periodsLoading } = useQuery({
    queryKey: ["call-log-periods"],
    queryFn: () => base44.entities.CallLogPeriod.list("-uploaded_at")
  });

  // Auto-select default period on first load
  useEffect(() => {
    if (!defaultSet && periods.length > 0) {
      const def = pickDefaultPeriod(periods);
      if (def) setSelectedPeriodId(def.id);
      setDefaultSet(true);
    }
  }, [periods, defaultSet]);

  const selectedPeriod = periods.find(p => p.id === selectedPeriodId) || null;

  const { data: userSummaries = [], isLoading: summariesLoading } = useQuery({
    queryKey: ["call-log-summaries", selectedPeriodId],
    queryFn: () => base44.entities.CallLogUserSummary.filter({ period_id: selectedPeriodId }),
    enabled: !!selectedPeriodId
  });

  const activeSummaries = userSummaries
    .filter(u => (u.total_calls || 0) > 0)
    .sort((a, b) => (b.total_calls || 0) - (a.total_calls || 0));

  const totalCalls    = activeSummaries.reduce((s, u) => s + (u.total_calls || 0), 0);
  const totalInbound  = activeSummaries.reduce((s, u) => s + (u.inbound || 0), 0);
  const totalOutbound = activeSummaries.reduce((s, u) => s + (u.outbound || 0), 0);
  const totalAnswered = activeSummaries.reduce((s, u) => s + (u.answered || 0), 0);
  const totalMissed   = activeSummaries.reduce((s, u) => s + (u.missed || 0), 0);
  const totalDurationSec = activeSummaries.reduce((s, u) => s + (u.total_duration_seconds || 0), 0);
  const overallAnswerRate = totalCalls > 0 ? totalAnswered / totalCalls : 0;
  const overallAvgDurationSec = totalCalls > 0 ? totalDurationSec / totalCalls : 0;

  const resetUpload = () => {
    setShowUpload(false);
    setUploadFile(null);
    setUploadError("");
    setPeriodStart("");
    setPeriodEnd("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadFile(file);
    setUploadError("");
  };

  const handleUpload = async () => {
    setUploadError("");
    if (!uploadFile)    { setUploadError("Please select a file."); return; }
    if (!periodStart)   { setUploadError("Reporting Period Start Date is required."); return; }
    if (!periodEnd)     { setUploadError("Reporting Period End Date is required."); return; }
    if (periodEnd < periodStart) { setUploadError("End date must be on or after start date."); return; }

    setUploading(true);
    let rows;
    try {
      rows = await parseFile(uploadFile);
    } catch {
      setUploadError("Failed to parse file. Please check the file format.");
      setUploading(false);
      return;
    }

    if (!rows || rows.length === 0) {
      setUploadError("File contains no data rows.");
      setUploading(false);
      return;
    }

    const normalizedHeaders = Object.keys(rows[0]).map(normalizeHeader);
    const missing = REQUIRED_NORMALIZED.filter(h => !normalizedHeaders.includes(h));
    if (missing.length > 0) {
      setUploadError(`Invalid file format. Required headers missing: ${missing.join(", ")}`);
      setUploading(false);
      return;
    }

    try {
      const response = await base44.functions.invoke("processCallLog", {
        rows,
        periodStart,
        periodEnd,
        fileName: uploadFile.name
      });

      const result = response.data;
      if (result.error) {
        setUploadError(result.error);
        setUploading(false);
        return;
      }

      // Refresh periods, then auto-select the newly uploaded period
      await queryClient.invalidateQueries({ queryKey: ["call-log-periods"] });
      await queryClient.invalidateQueries({ queryKey: ["call-log-summaries"] });

      if (result.period_id) {
        setSelectedPeriodId(result.period_id);
      }

      toast({
        title: result.is_replacement ? "Period Replaced" : "Upload Successful",
        description: `Imported ${result.users_imported} user(s) for ${formatDate(periodStart)} – ${formatDate(periodEnd)} (${result.status}).`
      });

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
    if (selectedPeriodId === deleteDialogPeriod.id) {
      setSelectedPeriodId(null);
      setDefaultSet(false); // allow re-auto-select next available
    }
    setDeleteDialogPeriod(null);
    setDeleting(false);
    toast({ title: "Deleted", description: "Reporting period deleted." });
  };

  const exportPeriodCSV = () => {
    if (!selectedPeriod) return;
    const csvRows = [
      ["User","Total Calls","Inbound","Outbound","Answered","Missed","Duration (H:MM:SS)","Answer Rate (%)","Avg Duration (H:MM:SS)"],
      ...activeSummaries.map(u => [
        u.user,
        u.total_calls,
        u.inbound,
        u.outbound,
        u.answered,
        u.missed,
        secondsToHHMMSS(u.total_duration_seconds),
        formatPercent(u.answer_rate),
        secondsToHHMMSS(u.avg_duration_seconds)
      ]),
      [],
      ["TOTALS", totalCalls, totalInbound, totalOutbound, totalAnswered, totalMissed,
        secondsToHHMMSS(totalDurationSec), formatPercent(overallAnswerRate), secondsToHHMMSS(overallAvgDurationSec)]
    ];
    const csv = csvRows.map(r => r.map(c => {
      const cs = String(c);
      return cs.includes(",") || cs.includes('"') ? `"${cs.replace(/"/g, '""')}"` : cs;
    }).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `call_log_${selectedPeriod.reporting_period_start}_${selectedPeriod.reporting_period_end}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Phone className="w-5 h-5 text-blue-600" />
            Call Log Reporting
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">Upload Vonage exports and view call metrics by period</p>
        </div>
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
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Reporting Period Start Date <span className="text-red-500">*</span>
                </label>
                <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-700 block mb-1">
                  Reporting Period End Date <span className="text-red-500">*</span>
                </label>
                <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} />
              </div>
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
            <div className="text-xs text-slate-500 bg-white/60 border border-slate-200 rounded p-2.5">
              <strong>Required Vonage headers:</strong> User, Total Calls, Inbound Calls, Outbound Calls, Answered Calls, Missed Calls, Voicemail Calls, Total call Duration (Minutes), Inbound Call Duration (Minutes), Outbound call Duration (Minutes)<br />
              <span className="text-slate-400">Header matching is case-insensitive. Duration columns must be the numeric minutes columns.</span>
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

      {/* Period Selector */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 flex-1 min-w-[220px]">
              <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Select Reporting Period</label>
              {periodsLoading ? (
                <div className="flex items-center gap-2 text-slate-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                </div>
              ) : periods.length === 0 ? (
                <span className="text-sm text-slate-400">No periods available</span>
              ) : (
                <Select value={selectedPeriodId || ""} onValueChange={setSelectedPeriodId}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Choose a period..." />
                  </SelectTrigger>
                  <SelectContent>
                    {periods.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        {periodLabel(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {selectedPeriod && (
              <div className="flex items-center gap-2 ml-auto">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={exportPeriodCSV}>
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:text-red-700 hover:bg-red-50 gap-1.5"
                  onClick={() => setDeleteDialogPeriod(selectedPeriod)}
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Dashboard */}
      {selectedPeriodId && (
        summariesLoading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading metrics...
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary metric cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard label="Total Calls" value={totalCalls} color="blue" />
              <MetricCard label="Inbound" value={totalInbound} color="green" />
              <MetricCard label="Outbound" value={totalOutbound} color="indigo" />
              <MetricCard label="Answered" value={totalAnswered} color="emerald" />
              <MetricCard label="Missed" value={totalMissed} color="red" />
              <MetricCard label="Answer Rate" value={formatPercent(overallAnswerRate)} color="orange" />
              <MetricCard label="Total Duration" value={secondsToHHMMSS(totalDurationSec)} color="purple" />
              <MetricCard label="Avg Duration" value={secondsToHHMMSS(overallAvgDurationSec)} color="slate" />
            </div>

            {/* User Breakdown Table */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold text-slate-700">
                  User Breakdown — {activeSummaries.length} user{activeSummaries.length !== 1 ? "s" : ""}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {activeSummaries.length === 0 ? (
                  <div className="py-10 text-center text-slate-400 text-sm">No call data for this period.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                          <th className="text-left px-4 py-2.5 text-xs font-semibold text-slate-600">User</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600">Total</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600">Inbound</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600">Outbound</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600">Answered</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600">Missed</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600">Answer Rate</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600">Duration</th>
                          <th className="text-right px-3 py-2.5 text-xs font-semibold text-slate-600">Avg Duration</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeSummaries.map((u, i) => (
                          <tr key={u.id} className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/40" : ""}`}>
                            <td className="px-4 py-2.5 font-medium text-slate-800">{u.user}</td>
                            <td className="px-3 py-2.5 text-right text-slate-700 font-semibold">{u.total_calls ?? 0}</td>
                            <td className="px-3 py-2.5 text-right text-slate-600">{u.inbound ?? 0}</td>
                            <td className="px-3 py-2.5 text-right text-slate-600">{u.outbound ?? 0}</td>
                            <td className="px-3 py-2.5 text-right text-green-700 font-medium">{u.answered ?? 0}</td>
                            <td className="px-3 py-2.5 text-right text-red-600">{u.missed ?? 0}</td>
                            <td className="px-3 py-2.5 text-right">
                              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                                (u.answer_rate || 0) >= 0.9 ? "bg-green-100 text-green-800"
                                  : (u.answer_rate || 0) >= 0.7 ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                              }`}>
                                {formatPercent(u.answer_rate)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right text-slate-600 font-mono text-xs">{secondsToHHMMSS(u.total_duration_seconds)}</td>
                            <td className="px-3 py-2.5 text-right text-slate-600 font-mono text-xs">{secondsToHHMMSS(u.avg_duration_seconds)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-slate-100 border-t-2 border-slate-200">
                        <tr>
                          <td className="px-4 py-2.5 font-bold text-slate-800 text-xs uppercase tracking-wide">Totals</td>
                          <td className="px-3 py-2.5 text-right font-bold text-slate-800">{totalCalls}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-700">{totalInbound}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-slate-700">{totalOutbound}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-green-700">{totalAnswered}</td>
                          <td className="px-3 py-2.5 text-right font-semibold text-red-600">{totalMissed}</td>
                          <td className="px-3 py-2.5 text-right">
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                              overallAnswerRate >= 0.9 ? "bg-green-100 text-green-800"
                                : overallAnswerRate >= 0.7 ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                            }`}>
                              {formatPercent(overallAnswerRate)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold text-slate-700">{secondsToHHMMSS(totalDurationSec)}</td>
                          <td className="px-3 py-2.5 text-right font-mono text-xs font-semibold text-slate-700">{secondsToHHMMSS(overallAvgDurationSec)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )
      )}

      {!selectedPeriodId && !periodsLoading && periods.length === 0 && (
        <div className="py-16 text-center text-slate-400">
          <Phone className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No call log data yet.</p>
          <p className="text-sm mt-1">Upload a Vonage export to get started.</p>
        </div>
      )}

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

function MetricCard({ label, value, color }) {
  const colorMap = {
    blue:    "bg-blue-50 text-blue-700 border-blue-200",
    green:   "bg-green-50 text-green-700 border-green-200",
    indigo:  "bg-indigo-50 text-indigo-700 border-indigo-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    red:     "bg-red-50 text-red-700 border-red-200",
    orange:  "bg-orange-50 text-orange-700 border-orange-200",
    purple:  "bg-purple-50 text-purple-700 border-purple-200",
    slate:   "bg-slate-50 text-slate-700 border-slate-200",
  };
  return (
    <div className={`rounded-lg border px-4 py-3 ${colorMap[color] || colorMap.slate}`}>
      <p className="text-xs font-medium opacity-70">{label}</p>
      <p className="text-xl font-bold mt-0.5 font-mono">{value}</p>
    </div>
  );
}