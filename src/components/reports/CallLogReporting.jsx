/**
 * CallLogReporting
 *
 * CDR-driven operational analytics module.
 * Source of truth: normalized_call_summary from CallLogCdrUploads (deduplicated by Call ID).
 *
 * Architecture:
 *   - "Analytics" tab: operational KPIs driven by normalized CDR data
 *   - "Upload CDR" tab: ingest raw Vonage CDR exports
 *   - "User Directory" tab: manage user/extension/benchmark config
 */
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Upload, Users, Trash2, Loader2, Download } from "lucide-react";
import CallLogUserConfigAdmin from "./CallLogUserConfigAdmin";
import CdrUpload from "./CdrUpload";
import CdrOperationalDashboard from "./CdrOperationalDashboard";
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

function formatPeriodLabel(period) {
  if (!period) return "";
  const key = period.monthly_key || period.reporting_period_start?.substring(0, 7);
  if (key) {
    const d = new Date(key + "-01T12:00:00");
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  }
  return period.reporting_period_start || "";
}

export default function CallLogReporting() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedPeriodKey, setSelectedPeriodKey] = useState(null);
  const [deleteDialogPeriod, setDeleteDialogPeriod] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState("analytics");
  const [exporting, setExporting] = useState(false);

  // ── Load all CDR uploads (one per period) as the period selector source ──
  const { data: cdrUploads = [], isLoading: uploadsLoading } = useQuery({
    queryKey: ["cdr-uploads-all"],
    queryFn: async () => {
      const all = await base44.entities.CallLogCdrUploads.list("-period_start");
      // Deduplicate by reporting_period_key (keep most recent upload per period)
      const seen = new Set();
      return all.filter(u => {
        if (seen.has(u.reporting_period_key)) return false;
        seen.add(u.reporting_period_key);
        return true;
      }).sort((a, b) => (b.reporting_period_key || "").localeCompare(a.reporting_period_key || ""));
    },
  });

  // Auto-select most recent period
  React.useEffect(() => {
    if (!selectedPeriodKey && cdrUploads.length > 0) {
      setSelectedPeriodKey(cdrUploads[0].reporting_period_key);
    }
  }, [cdrUploads, selectedPeriodKey]);

  const selectedUpload = cdrUploads.find(u => u.reporting_period_key === selectedPeriodKey) || null;
  const periodLabelStr = selectedUpload
    ? (() => {
        const key = selectedUpload.reporting_period_key;
        if (/^\d{4}-\d{2}$/.test(key)) {
          const d = new Date(key + "-01T12:00:00");
          return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        }
        return key;
      })()
    : "";

  // ── Delete period (CDR upload + user stats) ───────────────────────────────
  const handleDelete = async () => {
    if (!deleteDialogPeriod) return;
    setDeleting(true);
    try {
      // Delete user stats
      const stats = await base44.entities.CallLogCdrUserStats.filter({ cdr_upload_id: deleteDialogPeriod.id });
      for (const s of stats) await base44.entities.CallLogCdrUserStats.delete(s.id);
      // Delete the upload record
      await base44.entities.CallLogCdrUploads.delete(deleteDialogPeriod.id);
      queryClient.invalidateQueries({ queryKey: ["cdr-uploads-all"] });
      queryClient.invalidateQueries({ queryKey: ["cdr-operational"] });
      if (selectedPeriodKey === deleteDialogPeriod.reporting_period_key) {
        setSelectedPeriodKey(null);
      }
      toast({ title: "Deleted", description: "CDR period data deleted." });
    } catch (err) {
      toast({ title: "Error", description: err.message || "Delete failed.", variant: "destructive" });
    }
    setDeleteDialogPeriod(null);
    setDeleting(false);
  };

  // ── Excel export ──────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!selectedUpload) return;
    setExporting(true);
    try {
      // Build a minimal period-compatible object for the existing Excel runner
      const syntheticPeriod = {
        id: selectedUpload.id,
        monthly_key: selectedUpload.reporting_period_key,
        period_start: selectedUpload.period_start,
        period_end: selectedUpload.period_end,
        period_type: selectedUpload.period_type,
        uploaded_weeks: [],
      };

      // Load user configs for the export
      const userConfigs = await base44.entities.CallLogUserConfig.list();
      const norm = selectedUpload.normalized_call_summary;

      await runExportPeriodExcel({
        selectedPeriod: syntheticPeriod,
        enrichedSummaries: [],        // no legacy aggregated summaries
        frontEndSummaries: [],
        totalCalls: norm?.total_unique_calls || 0,
        totalInbound: norm?.total_unique_inbound || 0,
        totalOutbound: norm?.total_unique_outbound || 0,
        totalInboundAnswered: norm?.inbound_answered || 0,
        totalMissed: norm?.inbound_truly_missed || 0,
        totalDurationSec: norm?.total_talk_seconds || 0,
        overallAvgDurationSec: norm?.avg_talk_seconds || 0,
        formatPeriodLabel: () => periodLabelStr,
      });
    } catch (err) {
      toast({ title: "Export Error", description: err.message || "Export failed.", variant: "destructive" });
    }
    setExporting(false);
  };

  return (
    <div className="space-y-4">
      {/* Module header */}
      <div>
        <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <Phone className="w-5 h-5 text-blue-600" />
          Call Log Analytics
        </h2>
        <p className="text-sm text-slate-500 mt-0.5">
          True operational call metrics — normalized from raw Vonage CDR data, deduplicated by Call ID
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-2">
          <TabsTrigger value="analytics" className="gap-2">
            <Phone className="w-3.5 h-3.5" /> Analytics
          </TabsTrigger>
          <TabsTrigger value="cdr" className="gap-2">
            <Upload className="w-3.5 h-3.5" /> Upload CDR
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-3.5 h-3.5" /> User Directory
          </TabsTrigger>
        </TabsList>

        {/* ── Analytics Tab ────────────────────────────────────────────────── */}
        <TabsContent value="analytics">
          <div className="space-y-4">
            {/* Period selector + actions */}
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">Reporting Period</label>
              {uploadsLoading ? (
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Loading…
                </div>
              ) : cdrUploads.length === 0 ? (
                <div className="flex items-center gap-3">
                  <p className="text-sm text-slate-400">No CDR periods uploaded yet.</p>
                  <Button size="sm" onClick={() => setActiveTab("cdr")} className="gap-2 bg-blue-600 hover:bg-blue-700">
                    <Upload className="w-3.5 h-3.5" /> Upload CDR
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <select
                    value={selectedPeriodKey || ""}
                    onChange={e => setSelectedPeriodKey(e.target.value || null)}
                    className="border border-slate-300 rounded-md px-3 py-2 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[220px]"
                  >
                    {cdrUploads.map(u => {
                      const key = u.reporting_period_key;
                      let label = key;
                      if (/^\d{4}-\d{2}$/.test(key)) {
                        const d = new Date(key + "-01T12:00:00");
                        label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
                      }
                      return <option key={key} value={key}>{label}</option>;
                    })}
                  </select>

                  {selectedUpload && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-slate-400 hover:text-red-600 shrink-0"
                      title="Delete this period"
                      onClick={() => setDeleteDialogPeriod(selectedUpload)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}

                  <div className="ml-auto">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExport}
                      disabled={!selectedUpload || exporting}
                      className="gap-2"
                    >
                      {exporting
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Exporting…</>
                        : <><Download className="w-4 h-4" /> Export Excel Report</>}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Dashboard */}
            {selectedPeriodKey && (
              <CdrOperationalDashboard
                periodKey={selectedPeriodKey}
                periodLabel={periodLabelStr}
                onUploadCdrClick={() => setActiveTab("cdr")}
              />
            )}
          </div>
        </TabsContent>

        {/* ── Upload CDR Tab ────────────────────────────────────────────────── */}
        <TabsContent value="cdr">
          <CdrUpload
            onUploadComplete={(periodKey) => {
              queryClient.invalidateQueries({ queryKey: ["cdr-uploads-all"] });
              queryClient.invalidateQueries({ queryKey: ["cdr-operational", periodKey] });
              setSelectedPeriodKey(periodKey);
              setActiveTab("analytics");
              toast({ title: "CDR Uploaded", description: "Switching to analytics view." });
            }}
          />
        </TabsContent>

        {/* ── User Directory Tab ────────────────────────────────────────────── */}
        <TabsContent value="users">
          <CallLogUserConfigAdmin />
        </TabsContent>
      </Tabs>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteDialogPeriod} onOpenChange={open => !open && setDeleteDialogPeriod(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete This Period?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all CDR data and user stats for{" "}
              <strong>{deleteDialogPeriod?.reporting_period_key}</strong>. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-red-600 hover:bg-red-700">
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}