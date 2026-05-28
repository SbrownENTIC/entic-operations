import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Trash2, RefreshCw, Eye, CheckCircle, XCircle, Clock, Send, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useToast } from "@/components/ui/use-toast";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ListPageSkeleton } from "@/components/ui/LoadingSkeletons";

const STATUS_COLORS = {
  "Draft":          "bg-gray-100 text-gray-700",
  "Ready to Send":  "bg-blue-100 text-blue-800",
  "Sending":        "bg-yellow-100 text-yellow-800",
  "Sent":           "bg-green-100 text-green-800",
  "Failed":         "bg-red-100 text-red-800",
  "Cancelled":      "bg-slate-100 text-slate-600"
};

const STATUS_ICON = {
  "Draft":          <Clock className="w-3 h-3" />,
  "Ready to Send":  <Send className="w-3 h-3" />,
  "Sending":        <RefreshCw className="w-3 h-3 animate-spin" />,
  "Sent":           <CheckCircle className="w-3 h-3" />,
  "Failed":         <XCircle className="w-3 h-3" />,
  "Cancelled":      <AlertCircle className="w-3 h-3" />
};

export default function NotificationQueuePage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [viewRecord, setViewRecord] = useState(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: queue = [], isLoading } = useQuery({
    queryKey: ["notification-queue"],
    queryFn: () => base44.entities.NotificationQueue.list("-created_date"),
    refetchInterval: 15000
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.NotificationQueue.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-queue"] });
      setDeleteConfirm(null);
      toast({ title: "Deleted", description: "Notification record removed." });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => base44.entities.NotificationQueue.update(id, { status: "Cancelled", ready_to_send: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-queue"] });
      toast({ title: "Cancelled", description: "Notification cancelled — Power Automate will not pick it up." });
    }
  });

  const reactivateMutation = useMutation({
    mutationFn: (id) => base44.entities.NotificationQueue.update(id, { status: "Ready to Send", ready_to_send: true, error_message: null }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notification-queue"] });
      toast({ title: "Re-queued", description: "Notification set back to Ready to Send." });
    }
  });

  if (isLoading) return <ListPageSkeleton />;

  const filtered = queue.filter(r =>
    r.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.notification_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.closure_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.to?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    ready: queue.filter(r => r.status === "Ready to Send").length,
    sent: queue.filter(r => r.status === "Sent").length,
    failed: queue.filter(r => r.status === "Failed").length,
    total: queue.length
  };

  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Notification Queue</h1>
          <p className="text-slate-600 text-sm">Email notifications pending send via Power Automate / Outlook</p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total", value: stats.total, color: "bg-slate-100 text-slate-800" },
            { label: "Ready to Send", value: stats.ready, color: "bg-blue-100 text-blue-800" },
            { label: "Sent", value: stats.sent, color: "bg-green-100 text-green-800" },
            { label: "Failed", value: stats.failed, color: "bg-red-100 text-red-800" }
          ].map(s => (
            <Card key={s.label} className="border-0 shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">{s.label}</span>
                <Badge className={s.color + " text-base font-bold px-3"}>{s.value}</Badge>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Power Automate info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
          <Send className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-blue-900 text-sm">Power Automate Integration</p>
            <p className="text-blue-700 text-sm">Records with <strong>Status = Ready to Send</strong> are retrieved by Power Automate via the <code className="bg-blue-100 px-1 rounded text-xs">getReadyNotifications</code> function. Power Automate sends one Outlook email per record (all CC recipients on the same email) from <strong>Steve.brown@enticmd.com</strong>, then calls <code className="bg-blue-100 px-1 rounded text-xs">markNotificationSent</code> or <code className="bg-blue-100 px-1 rounded text-xs">markNotificationFailed</code> to update the status here.</p>
          </div>
        </div>

        {/* Table */}
        <Card className="border-slate-200 shadow-sm bg-white/80">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["notification-queue"] })}
                className="ml-auto gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="text-left p-4 font-semibold text-slate-700">Type</th>
                    <th className="text-left p-4 font-semibold text-slate-700">Subject</th>
                    <th className="text-left p-4 font-semibold text-slate-700">To</th>
                    <th className="text-left p-4 font-semibold text-slate-700">Send Date</th>
                    <th className="text-left p-4 font-semibold text-slate-700">Closure Date</th>
                    <th className="text-left p-4 font-semibold text-slate-700">Status</th>
                    <th className="text-left p-4 font-semibold text-slate-700">Sent Date</th>
                    <th className="text-left p-4 font-semibold text-slate-700">Sent By</th>
                    <th className="text-right p-4 font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-12 text-center text-slate-500">
                        No notifications in queue
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r) => (
                      <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-4">
                          <Badge className="bg-indigo-100 text-indigo-800">{r.notification_type}</Badge>
                          {r.closure_type && (
                            <div className="text-xs text-slate-500 mt-1">{r.closure_type}</div>
                          )}
                        </td>
                        <td className="p-4 max-w-xs">
                          <div className="font-medium text-slate-900 truncate">{r.subject}</div>
                          {r.error_message && (
                            <div className="text-xs text-red-600 mt-1 truncate">{r.error_message}</div>
                          )}
                        </td>
                        <td className="p-4 text-slate-600 max-w-xs">
                          <div className="truncate">{r.to}</div>
                          {r.cc && <div className="text-xs text-slate-400 truncate">CC: {r.cc}</div>}
                        </td>
                        <td className="p-4 text-slate-600">
                          {r.send_date ? (
                            <span className={r.send_date === new Date().toLocaleDateString('en-CA') ? 'font-semibold text-blue-700' : ''}>
                              {format(parseISO(r.send_date), 'MMM d, yyyy')}
                            </span>
                          ) : '—'}
                        </td>
                        <td className="p-4 text-slate-600">
                          {r.closure_date ? format(parseISO(r.closure_date), 'MMM d, yyyy') : '—'}
                        </td>
                        <td className="p-4">
                          <Badge className={STATUS_COLORS[r.status] + " gap-1"}>
                            {STATUS_ICON[r.status]}
                            {r.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-slate-600">
                          {r.sent_date ? format(parseISO(r.sent_date), 'MMM d, yyyy h:mm a') : '—'}
                        </td>
                        <td className="p-4 text-slate-600">
                          {r.sent_by || '—'}
                        </td>
                        <td className="p-4">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              title="View details"
                              onClick={() => setViewRecord(r)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {r.status === "Ready to Send" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Cancel this notification"
                                className="text-orange-600 hover:text-orange-700"
                                onClick={() => cancelMutation.mutate(r.id)}
                              >
                                <XCircle className="w-4 h-4" />
                              </Button>
                            )}
                            {(r.status === "Failed" || r.status === "Cancelled") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Re-queue for sending"
                                className="text-blue-600 hover:text-blue-700"
                                onClick={() => reactivateMutation.mutate(r.id)}
                              >
                                <RefreshCw className="w-4 h-4" />
                              </Button>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              title="Delete record"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => setDeleteConfirm(r)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Detail Dialog */}
      {viewRecord && (
        <Dialog open={!!viewRecord} onOpenChange={() => setViewRecord(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Notification Detail</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="font-semibold text-slate-600">Type:</span> {viewRecord.notification_type}</div>
                <div><span className="font-semibold text-slate-600">Status:</span> <Badge className={STATUS_COLORS[viewRecord.status]}>{viewRecord.status}</Badge></div>
                <div><span className="font-semibold text-slate-600">Closure Type:</span> {viewRecord.closure_type || '—'}</div>
                <div><span className="font-semibold text-slate-600">Send Date:</span> {viewRecord.send_date ? format(parseISO(viewRecord.send_date), 'MMM d, yyyy') : '—'}</div>
                <div><span className="font-semibold text-slate-600">Closure Date:</span> {viewRecord.closure_date ? format(parseISO(viewRecord.closure_date), 'MMM d, yyyy') : '—'}</div>
                <div><span className="font-semibold text-slate-600">Sent Date:</span> {viewRecord.sent_date ? format(parseISO(viewRecord.sent_date), 'MMM d, yyyy h:mm a') : '—'}</div>
                <div><span className="font-semibold text-slate-600">Sent By:</span> {viewRecord.sent_by || '—'}</div>
              </div>
              <div><span className="font-semibold text-slate-600">To:</span> {viewRecord.to || '—'}</div>
              {viewRecord.cc && <div><span className="font-semibold text-slate-600">CC:</span> {viewRecord.cc}</div>}
              {viewRecord.bcc && <div><span className="font-semibold text-slate-600">BCC:</span> {viewRecord.bcc}</div>}
              <div>
                <span className="font-semibold text-slate-600">Subject:</span>
                <p className="mt-1 text-slate-800">{viewRecord.subject}</p>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Body:</span>
                <pre className="mt-1 p-3 bg-slate-50 rounded text-xs whitespace-pre-wrap font-mono border">{viewRecord.body}</pre>
              </div>
              {viewRecord.error_message && (
                <div className="p-3 bg-red-50 border border-red-200 rounded">
                  <span className="font-semibold text-red-700">Error:</span>
                  <p className="text-red-700 text-xs mt-1">{viewRecord.error_message}</p>
                </div>
              )}
              {viewRecord.email_provider_message_id && (
                <div><span className="font-semibold text-slate-600">Message ID:</span> {viewRecord.email_provider_message_id}</div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirm */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Notification Record</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove this notification queue entry. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteConfirm.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}