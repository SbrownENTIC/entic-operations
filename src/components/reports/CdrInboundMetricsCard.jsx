import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Eye, Copy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDateToEST } from "@/components/DateUtils";

export default function CdrInboundMetricsCard({
  periodKey,
  periodType,
  periodStart,
  periodEnd,
  periodLabel,
  onUploadClick,
}) {
  const [showUnmappedModal, setShowUnmappedModal] = useState(false);

  const { data: cdrData } = useQuery({
    queryKey: ["cdr-metrics", periodKey],
    queryFn: async () => {
      if (!periodKey) return null;
      
      const upload = await base44.entities.CallLogCdrUploads.filter({
        reporting_period_key: periodKey,
      });
      if (!upload.length) return null;

      const cdrUpload = upload[0];
      const stats = await base44.entities.CallLogCdrUserStats.filter({
        cdr_upload_id: cdrUpload.id,
      });

      return {
        upload: cdrUpload,
        stats: stats || [],
      };
    },
    enabled: !!periodKey,
  });

  if (!cdrData) {
    return (
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Upload className="w-4 h-4 text-blue-600" />
            Inbound CDR, Phone Answering Metrics
          </CardTitle>
          <p className="text-xs text-slate-500 mt-1">
            Uses Vonage "Inbound Calls" export. Mapped by extension (To) to the User Directory.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                const cdrTab = document.querySelector('button[value="cdr"]');
                if (cdrTab) cdrTab.click();
              }}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <Upload className="w-3.5 h-3.5" /> Upload Inbound CDR
            </Button>
          </div>
          <p className="text-xs text-slate-500">
            No inbound CDR uploaded for this period. Upload the Vonage "Inbound Calls" export to populate these metrics.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { upload, stats } = cdrData;
  const topUsers = stats.sort((a, b) => b.inbound_calls - a.inbound_calls).slice(0, 10);

  const answerRateColor = (rate) => {
    if (rate >= 0.9) return "text-green-600 font-semibold";
    if (rate >= 0.8) return "text-amber-600 font-semibold";
    return "text-red-600 font-semibold";
  };

  const copyUnmappedExtensions = () => {
    if (!upload.unmapped_extensions || upload.unmapped_extensions.length === 0) return;
    const text = upload.unmapped_extensions.map(u => u.extension).join("\n");
    navigator.clipboard.writeText(text);
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-600" />
              Inbound CDR, Phone Answering Metrics
            </CardTitle>
            <p className="text-xs text-slate-500 mt-1">
              Uses Vonage "Inbound Calls" export. Mapped by extension (To) to the User Directory.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={onUploadClick}
            variant="outline"
            className="gap-2"
          >
            <Upload className="w-3.5 h-3.5" /> Replace for this period
          </Button>
        </div>

        <p className="text-xs text-slate-600">
          Saved for {periodLabel}, uploaded{" "}
          {formatDateToEST(upload.uploaded_at, "MMM d, yyyy 'at' h:mm a")}
        </p>

        {/* KPI Mini Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
          {[
            {
              label: "Total Inbound",
              value: upload.total_inbound_calls.toLocaleString(),
              color: "text-blue-700",
            },
            {
              label: "Answered",
              value: upload.total_inbound_answered.toLocaleString(),
              color: "text-green-700",
            },
            {
              label: "Not Answered",
              value: upload.total_unanswered.toLocaleString(),
              color: upload.total_unanswered > 0 ? "text-red-600" : "text-slate-400",
            },
            {
              label: "Inbound Answer Rate",
              value: upload.total_inbound_calls > 0
                ? ((upload.total_inbound_answered / upload.total_inbound_calls) * 100).toFixed(1) + "%"
                : "—",
              color:
                upload.total_inbound_calls > 0
                  ? upload.total_inbound_answered / upload.total_inbound_calls >= 0.9
                    ? "text-green-700"
                    : upload.total_inbound_answered / upload.total_inbound_calls >= 0.8
                    ? "text-amber-600"
                    : "text-red-600"
                  : "text-slate-400",
            },
            {
              label: "Mapped",
              value: upload.mapped_rows.toLocaleString(),
              color: "text-slate-700",
            },
            {
              label: "Unmapped",
              value: upload.unmapped_rows.toLocaleString(),
              color: upload.unmapped_rows > 0 ? "text-orange-600" : "text-slate-400",
            },
          ].map((m) => (
            <div
              key={m.label}
              className="bg-white border border-slate-200 rounded-lg p-2.5 text-center shadow-sm"
            >
              <p className="text-xs text-slate-500 mb-1">{m.label}</p>
              <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
            </div>
          ))}
        </div>

        {/* Top Users Table */}
        {topUsers.length > 0 && (
          <div className="overflow-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-2.5 py-2 font-semibold text-slate-600">User</th>
                  <th className="text-right px-2.5 py-2 font-semibold text-slate-600">Inbound</th>
                  <th className="text-right px-2.5 py-2 font-semibold text-slate-600">Answered</th>
                  <th className="text-right px-2.5 py-2 font-semibold text-slate-600">Not Answered</th>
                  <th className="text-right px-2.5 py-2 font-semibold text-slate-600">Answer Rate</th>
                </tr>
              </thead>
              <tbody>
                {topUsers.map((u, i) => (
                  <tr
                    key={u.id}
                    className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/40" : ""}`}
                  >
                    <td className="px-2.5 py-2 font-medium text-slate-800">{u.user_name}</td>
                    <td className="px-2.5 py-2 text-right text-blue-700">
                      {u.inbound_calls.toLocaleString()}
                    </td>
                    <td className="px-2.5 py-2 text-right text-green-700">
                      {u.inbound_answered.toLocaleString()}
                    </td>
                    <td className="px-2.5 py-2 text-right text-slate-700">
                      {u.inbound_unanswered.toLocaleString()}
                    </td>
                    <td className={`px-2.5 py-2 text-right ${answerRateColor(u.inbound_answer_rate)}`}>
                      {u.inbound_calls > 0
                        ? (u.inbound_answer_rate * 100).toFixed(1) + "%"
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Unmapped Extensions */}
        {upload.unmapped_rows > 0 && upload.unmapped_extensions && upload.unmapped_extensions.length > 0 && (
          <div className="pt-2 border-t border-slate-200">
            <button
              onClick={() => setShowUnmappedModal(true)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
            >
              <Eye className="w-3.5 h-3.5" />
              View {upload.unmapped_rows} unmapped extension
              {upload.unmapped_rows !== 1 ? "s" : ""}
            </button>
          </div>
        )}
      </CardContent>

      {/* Unmapped Extensions Modal */}
      <Dialog open={showUnmappedModal} onOpenChange={setShowUnmappedModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unmapped Extensions</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="overflow-auto rounded-lg border border-slate-200 max-h-64">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold text-slate-600">Extension</th>
                    <th className="text-right px-3 py-2 font-semibold text-slate-600">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {upload.unmapped_extensions.map((u, i) => (
                    <tr key={i} className={`border-b border-slate-100 ${i % 2 !== 0 ? "bg-slate-50/40" : ""}`}>
                      <td className="px-3 py-2 font-medium text-slate-800">{u.extension}</td>
                      <td className="px-3 py-2 text-right text-slate-600">{u.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={copyUnmappedExtensions}
              className="gap-2 w-full"
            >
              <Copy className="w-3.5 h-3.5" />
              Copy list as text
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}