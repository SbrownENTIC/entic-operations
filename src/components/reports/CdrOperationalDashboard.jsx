/**
 * CdrOperationalDashboard
 *
 * Primary reporting component for the new CDR-driven analytics engine.
 * Drives all KPIs from normalized_call_summary (deduplicated by Call ID).
 * Raw extension-level stats are shown as secondary/reference data only.
 */
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Eye, Copy, Loader2, TrendingUp, Phone, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateToEST } from "@/components/DateUtils";

function fmt(n) {
  if (n === null || n === undefined) return "—";
  return Number(n).toLocaleString();
}
function fmtPct(n) {
  if (n === null || n === undefined) return "—";
  return (Number(n) * 100).toFixed(1) + "%";
}
function fmtSec(secs) {
  if (!secs) return "—";
  const s = Math.round(secs);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
}
function rateColor(rate) {
  if (rate === null || rate === undefined) return "text-slate-400";
  if (rate >= 0.8) return "text-green-700";
  if (rate >= 0.5) return "text-yellow-700";
  return "text-red-600";
}
function rateBarColor(rate) {
  if (rate >= 0.8) return "bg-green-500";
  if (rate >= 0.5) return "bg-yellow-400";
  return "bg-red-500";
}

export default function CdrOperationalDashboard({ periodKey, periodLabel, onUploadCdrClick }) {
  const [showUnmapped, setShowUnmapped] = useState(false);
  const [showRawStats, setShowRawStats] = useState(false);
  const [rawSortKey, setRawSortKey] = useState("inbound_calls");
  const [rawSortDir, setRawSortDir] = useState("desc");

  const { data: cdrData, isLoading } = useQuery({
    queryKey: ["cdr-operational", periodKey],
    queryFn: async () => {
      if (!periodKey) return null;
      const uploads = await base44.entities.CallLogCdrUploads.filter({ reporting_period_key: periodKey });
      if (!uploads.length) return null;
      const upload = uploads[0];
      const stats = await base44.entities.CallLogCdrUserStats.filter({ cdr_upload_id: upload.id });
      return { upload, stats: stats || [] };
    },
    enabled: !!periodKey,
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-slate-400 text-sm py-8">
        <Loader2 className="w-4 h-4 animate-spin" /> Loading operational metrics…
      </div>
    );
  }

  if (!cdrData) {
    return (
      <Card className="border-dashed border-slate-300 bg-slate-50">
        <CardContent className="p-6 text-center space-y-3">
          <Upload className="w-8 h-8 text-slate-400 mx-auto" />
          <div>
            <p className="font-semibold text-slate-700">No CDR Uploaded for This Period</p>
            <p className="text-xs text-slate-500 mt-1">
              Upload a Vonage Inbound CDR export to generate true operational KPIs.
            </p>
          </div>
          {onUploadCdrClick && (
            <Button size="sm" onClick={onUploadCdrClick} className="gap-2 bg-blue-600 hover:bg-blue-700">
              <Upload className="w-3.5 h-3.5" /> Go to Upload CDR
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  const { upload, stats } = cdrData;
  const norm = upload.normalized_call_summary;

  // ── Sort raw stats ────────────────────────────────────────────────────────
  const sortedStats = [...stats].sort((a, b) => {
    const av = a[rawSortKey] ?? 0;
    const bv = b[rawSortKey] ?? 0;
    if (typeof av === "string") return rawSortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
    return rawSortDir === "asc" ? av - bv : bv - av;
  });
  const handleRawSort = (key) => {
    if (rawSortKey === key) setRawSortDir(d => d === "asc" ? "desc" : "asc");
    else { setRawSortKey(key); setRawSortDir("desc"); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-slate-800">Operational Call Analytics</span>
          <span className="text-xs text-slate-400 font-normal">
            CDR uploaded {formatDateToEST(upload.uploaded_at, "MMM d, yyyy")}
          </span>
        </div>
        {onUploadCdrClick && (
          <Button size="sm" variant="outline" onClick={onUploadCdrClick} className="gap-1.5 text-xs">
            <Upload className="w-3 h-3" /> Replace CDR
          </Button>
        )}
      </div>

      {/* ── SECTION A: Normalized Operational KPIs ─────────────────────────── */}
      {norm ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-green-800 bg-green-100 px-2 py-0.5 rounded-full">
              ✓ True Call-Level KPIs — Deduplicated by Call ID
            </span>
          </div>

          {/* Primary KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              {
                label: "Unique Inbound Calls",
                value: fmt(norm.total_unique_inbound),
                color: "text-blue-700",
                sub: "Deduplicated patient interactions",
              },
              {
                label: "Calls Answered",
                value: fmt(norm.inbound_answered),
                color: "text-green-700",
                sub: `${fmtPct(norm.inbound_answer_rate)} answer rate`,
              },
              {
                label: "Truly Abandoned",
                value: fmt(norm.inbound_truly_missed),
                color: norm.inbound_truly_missed > 0 ? "text-red-600" : "text-slate-400",
                sub: `${fmtPct(norm.abandonment_rate)} abandonment rate`,
              },
              {
                label: "Voicemail",
                value: fmt(norm.inbound_voicemail),
                color: "text-amber-600",
                sub: "Caller left a message",
              },
            ].map(m => (
              <Card key={m.label} className="border-slate-200 shadow-sm">
                <CardContent className="p-3.5">
                  <p className="text-xs text-slate-500 mb-1">{m.label}</p>
                  <p className={`text-2xl font-bold ${m.color}`}>{m.value}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{m.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Answer Rate visual bar */}
          <Card className="border-blue-200 bg-blue-50/30 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-slate-800">True Answer Rate</span>
                <span className={`text-2xl font-bold ${rateColor(norm.inbound_answer_rate)}`}>
                  {fmtPct(norm.inbound_answer_rate)}
                </span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${rateBarColor(norm.inbound_answer_rate)}`}
                  style={{ width: `${Math.min((norm.inbound_answer_rate || 0) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>0%</span>
                <span>50% (warn)</span>
                <span>80% (target)</span>
                <span>100%</span>
              </div>
            </CardContent>
          </Card>

          {/* Secondary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Avg Talk Time", value: fmtSec(norm.avg_talk_seconds), color: "text-slate-800" },
              { label: "Avg Speed to Answer", value: fmtSec(norm.avg_speed_to_answer_seconds), color: "text-slate-800" },
              { label: "Total Unique Outbound", value: fmt(norm.total_unique_outbound), color: "text-indigo-700" },
              {
                label: "Routing Inflation Factor",
                value: norm.avg_routing_events_per_call ? `~${norm.avg_routing_events_per_call}x` : "—",
                color: "text-slate-500",
                sub: `${fmt(norm.total_raw_cdr_rows)} raw rows → ${fmt(norm.total_unique_inbound)} unique inbound calls`,
              },
            ].map(m => (
              <Card key={m.label} className="border-slate-200 shadow-sm">
                <CardContent className="p-3.5">
                  <p className="text-xs text-slate-500 mb-1">{m.label}</p>
                  <p className={`text-xl font-bold ${m.color}`}>{m.value}</p>
                  {m.sub && <p className="text-[10px] text-slate-400 mt-0.5">{m.sub}</p>}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Hourly breakdown — if available */}
          {norm.hourly_breakdown && norm.hourly_breakdown.length > 0 && (
            <HourlyBreakdown data={norm.hourly_breakdown} />
          )}

          {/* Location breakdown */}
          {norm.location_breakdown && norm.location_breakdown.length > 0 && (
            <LocationBreakdown data={norm.location_breakdown} />
          )}
        </div>
      ) : (
        /* Normalization summary missing — show raw KPIs only */
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-xs text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <div>
            <strong>Normalized metrics not available for this period.</strong> Re-upload the CDR file to generate
            true deduplicated call KPIs. Showing raw extension-level counts only.
          </div>
        </div>
      )}

      {/* ── SECTION B: Raw Extension Stats (reference) ──────────────────────── */}
      {stats.length > 0 && (
        <div>
          <button
            onClick={() => setShowRawStats(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            <Phone className="w-3.5 h-3.5" />
            {showRawStats ? "Hide" : "Show"} extension-level raw stats ({stats.length} users)
            <span className="text-[10px] text-slate-400 font-normal ml-1">(reference only — inflated by routing)</span>
          </button>

          {showRawStats && (
            <div className="mt-2 overflow-auto rounded-lg border border-slate-200 max-h-80">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    {[
                      { key: "user_name", label: "User", right: false },
                      { key: "inbound_calls", label: "Inbound Rows", right: true },
                      { key: "inbound_answered", label: "Answered Rows", right: true },
                      { key: "inbound_unanswered", label: "Unanswered Rows", right: true },
                      { key: "inbound_answer_rate", label: "Row-Level Rate", right: true },
                    ].map(col => (
                      <th
                        key={col.key}
                        onClick={() => handleRawSort(col.key)}
                        className={`px-2.5 py-2 font-semibold text-slate-600 cursor-pointer hover:bg-slate-100 ${col.right ? "text-right" : "text-left"}`}
                      >
                        {col.label} {rawSortKey === col.key ? (rawSortDir === "asc" ? "↑" : "↓") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedStats.map((u, i) => (
                    <tr key={u.id} className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/40" : ""}`}>
                      <td className="px-2.5 py-2 font-medium text-slate-700">{u.user_name}</td>
                      <td className="px-2.5 py-2 text-right text-blue-700">{fmt(u.inbound_calls)}</td>
                      <td className="px-2.5 py-2 text-right text-green-700">{fmt(u.inbound_answered)}</td>
                      <td className="px-2.5 py-2 text-right text-slate-500">{fmt(u.inbound_unanswered)}</td>
                      <td className={`px-2.5 py-2 text-right text-[10px] italic text-slate-400`}>
                        {u.inbound_calls > 0 ? fmtPct(u.inbound_answered / u.inbound_calls) : "—"}
                        <span className="ml-1 text-slate-300">(inflated)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Unmapped extensions */}
      {upload.unmapped_rows > 0 && upload.unmapped_extensions?.length > 0 && (
        <button
          onClick={() => setShowUnmapped(true)}
          className="flex items-center gap-1.5 text-xs text-orange-600 hover:text-orange-700 font-medium"
        >
          <Eye className="w-3.5 h-3.5" />
          {upload.unmapped_rows} unmapped extension row{upload.unmapped_rows !== 1 ? "s" : ""} — click to review
        </button>
      )}

      {/* Unmapped modal */}
      <Dialog open={showUnmapped} onOpenChange={setShowUnmapped}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unmapped Extensions</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-slate-500">
              These extensions appeared in the CDR but are not mapped in the User Directory.
              Add them in the User Directory tab to include them in future reports.
            </p>
            <div className="overflow-auto rounded-lg border border-slate-200 max-h-64">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Extension</th>
                    <th className="text-right px-3 py-2 font-semibold text-slate-600">Row Count</th>
                  </tr>
                </thead>
                <tbody>
                  {upload.unmapped_extensions.map((u, i) => (
                    <tr key={i} className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/40" : ""}`}>
                      <td className="px-3 py-2 font-mono text-slate-800">{u.extension}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{u.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2 w-full"
              onClick={() => {
                const text = upload.unmapped_extensions.map(u => u.extension).join("\n");
                navigator.clipboard.writeText(text);
              }}
            >
              <Copy className="w-3.5 h-3.5" /> Copy list
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Hourly Breakdown ──────────────────────────────────────────────────────
function HourlyBreakdown({ data }) {
  const maxTotal = Math.max(...data.map(h => h.total), 1);
  const businessHours = data.filter(h => h.hour >= 7 && h.hour <= 19);
  if (businessHours.length === 0) return null;

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-slate-700 mb-3">Peak Call Hours (Business Hours)</p>
        <div className="flex items-end gap-1 h-20">
          {businessHours.map(h => {
            const heightPct = (h.total / maxTotal) * 100;
            const answerRate = h.total > 0 ? h.answered / h.total : 0;
            const label = h.hour === 12 ? "12p" : h.hour > 12 ? `${h.hour - 12}p` : `${h.hour}a`;
            return (
              <div key={h.hour} className="flex-1 flex flex-col items-center gap-0.5" title={`${label}: ${h.total} calls, ${(answerRate * 100).toFixed(0)}% answered`}>
                <div className="w-full flex flex-col justify-end" style={{ height: "64px" }}>
                  <div
                    className={`w-full rounded-t transition-all ${answerRate >= 0.8 ? "bg-blue-500" : answerRate >= 0.5 ? "bg-yellow-400" : "bg-red-400"}`}
                    style={{ height: `${Math.max(heightPct, 2)}%` }}
                  />
                </div>
                <span className="text-[9px] text-slate-400 whitespace-nowrap">{label}</span>
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-slate-400 mt-2">Bar color: green ≥80% answered, yellow ≥50%, red &lt;50%</p>
      </CardContent>
    </Card>
  );
}

// ── Location Breakdown ────────────────────────────────────────────────────
function LocationBreakdown({ data }) {
  const filtered = data.filter(l => l.location && l.location !== "Unknown" && l.total > 0);
  if (!filtered.length) return null;

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-slate-700 mb-3">Calls by Location</p>
        <div className="space-y-2">
          {filtered.map(loc => {
            const answerRate = loc.total > 0 ? loc.answered / loc.total : 0;
            return (
              <div key={loc.location} className="flex items-center gap-3">
                <span className="text-xs font-medium text-slate-700 w-28 shrink-0">{loc.location}</span>
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${rateBarColor(answerRate)}`}
                    style={{ width: `${Math.min(answerRate * 100, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-slate-600 w-12 text-right">{fmtPct(answerRate)}</span>
                <span className="text-xs text-slate-400 w-16 text-right">{fmt(loc.total)} calls</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}