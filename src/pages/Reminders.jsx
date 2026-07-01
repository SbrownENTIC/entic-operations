import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Send, Clock, Mail, ArrowUpDown, ArrowUp, ArrowDown, RotateCcw, CheckCircle, AlertCircle, CloudUpload, RefreshCw, BellRing, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import ReminderForm from "../components/reminders/ReminderForm";
import EmptyState from "@/components/ui/EmptyState";
import { ListPageSkeleton } from "@/components/ui/LoadingSkeletons";
import { useLocation } from "react-router-dom";
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

export default function Reminders() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingReminder, setEditingReminder] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sortField, setSortField] = useState('send_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [statusMessage, setStatusMessage] = useState(null);
  const [airtableSyncing, setAirtableSyncing] = useState(false);
  const [queuingId, setQueuingId] = useState(null);
  const [bulkQueueing, setBulkQueueing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => base44.entities.Reminder.list('-send_date')
  });

  const { data: notificationQueue = [] } = useQuery({
    queryKey: ['notification-queue'],
    queryFn: () => base44.entities.NotificationQueue.list('-created_date'),
    refetchInterval: 15000
  });

  // Close form when navigating to root URL
  React.useEffect(() => {
    if (location.search === '' && showForm) {
      setShowForm(false);
      setEditingReminder(null);
    }
  }, [location.search]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Reminder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      setShowForm(false);
      setEditingReminder(null);
    },
    onError: (error) => {
      if (error?.status === 403 || error?.response?.status === 403 || error?.message?.includes('403')) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to create reminders." });
      } else {
        toast({ variant: "destructive", title: "Error", description: error.message });
      }
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Reminder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      setShowForm(false);
      setEditingReminder(null);
    },
    onError: (error) => {
      if (error?.status === 403 || error?.response?.status === 403 || error?.message?.includes('403')) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to update reminders." });
      } else {
        toast({ variant: "destructive", title: "Error", description: error.message });
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Reminder.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      setDeleteConfirm(null);
    },
    onError: (error) => {
      if (error?.status === 403 || error?.response?.status === 403 || error?.message?.includes('403')) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to delete reminders." });
      } else {
        toast({ variant: "destructive", title: "Error", description: error.message });
      }
    }
  });

  const sendReminderMutation = useMutation({
    mutationFn: async (reminder) => {
      // Build the email body with dynamic values for holiday reminders
      let emailBody = reminder.email_body;
      
      if (reminder.reminder_type === 'Holiday' && reminder.closure_date) {
        emailBody = `Good Morning All,
 
This email is to notify you that our office will be closed on ${format(parseISO(reminder.closure_date), 'MMMM d, yyyy')} for the ${reminder.holiday_name || 'Holiday'} Holiday.

The offices will re-open at 8am on ${reminder.reopen_date ? format(parseISO(reminder.reopen_date), 'MMMM d, yyyy') : 'the next business day'}.

${reminder.oncall_provider_list || '(On-Call Provider)'} on call during office closure is the on-call provider and can be reached at ${reminder.oncall_phone_list || '(phone number)'}.
 
Best Regards,
Steve Brown  
The Operations Team`;
      }
      
      const results = [];
      
      // Sync reminder to Airtable for each recipient
      for (const recipient of reminder.recipients) {
        try {
          const result = await base44.functions.invoke('syncReminderToAirtable', {
              recipient: recipient,
              subject: reminder.email_subject,
              body: emailBody,
              from_name: 'ENTIC Operations Team',
              reminder_name: reminder.reminder_name,
              reminder_type: reminder.reminder_type,
              send_date: reminder.send_date
          });
          results.push({ recipient, success: true, response: result });
        } catch (error) {
          results.push({ recipient, success: false, error: error.message });
        }
      }
      
      // Update reminder with last sent date and increment send count
      const now = new Date().toISOString();
      await base44.entities.Reminder.update(reminder.id, {
        last_sent_date: now,
        send_count: (reminder.send_count || 0) + 1
      });
      
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      
      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;
      
      if (failCount === 0) {
        setStatusMessage({
          type: 'success',
          message: `✅ Successfully sent ${successCount} email(s)!`
        });
      } else {
        const failedRecipients = results.filter(r => !r.success).map(r => r.recipient).join(', ');
        setStatusMessage({
          type: 'warning',
          message: `⚠️ Sent ${successCount} email(s), but ${failCount} failed: ${failedRecipients}`
        });
      }
      
      setTimeout(() => setStatusMessage(null), 5000);
    },
    onError: (error) => {
      setStatusMessage({
        type: 'error',
        message: `❌ Error sending emails: ${error.message}`
      });
      setTimeout(() => setStatusMessage(null), 5000);
    }
  });

  const resetReminderMutation = useMutation({
    mutationFn: ({ id }) => base44.entities.Reminder.update(id, {
      last_sent_date: null,
      send_count: 0,
      status: 'active'
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      setStatusMessage({
        type: 'success',
        message: '✅ Reminder reset successfully!'
      });
      setTimeout(() => setStatusMessage(null), 3000);
    },
    onError: (error) => {
      if (error?.status === 403 || error?.response?.status === 403 || error?.message?.includes('403')) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to reset reminders." });
      } else {
        toast({ variant: "destructive", title: "Error", description: error.message });
      }
    }
  });

  const handleSubmit = (data) => {
    if (editingReminder) {
      updateMutation.mutate({ id: editingReminder.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSendReminder = (reminder) => {
    if (window.confirm(`Send reminder "${reminder.reminder_name}" to ${reminder.recipients.length} recipient(s)?`)) {
      sendReminderMutation.mutate(reminder);
    }
  };

  const handleResetReminder = (reminder) => {
    if (window.confirm(`Reset "${reminder.reminder_name}"? This will clear the last sent date and reset times sent to 0.`)) {
      resetReminderMutation.mutate({ id: reminder.id });
    }
  };

  const handleQueueNotification = async (reminder) => {
    setQueuingId(reminder.id);
    try {
      const res = await base44.functions.invoke('queueClosureNotification', { reminder_id: reminder.id });
      if (res.data.duplicate) {
        toast({ variant: "destructive", title: "Already queued", description: res.data.message });
      } else {
        toast({ title: "✅ Notification queued!", description: `Queued for ${res.data.recipient_count} recipient(s). Power Automate will send it on the send date.` });
      }
      queryClient.invalidateQueries({ queryKey: ['notification-queue'] });
    } catch (error) {
      toast({ variant: "destructive", title: "Queue failed", description: error.response?.data?.error || error.message });
    } finally {
      setQueuingId(null);
    }
  };

  const handleBulkQueueClosures = async () => {
    setBulkQueueing(true);
    try {
      const res = await base44.functions.invoke('queueBulkClosureNotifications', {});
      toast({ title: "Closure notifications queued", description: res.data.message });
      queryClient.invalidateQueries({ queryKey: ['notification-queue'] });
    } catch (error) {
      toast({ variant: "destructive", title: "Bulk queue failed", description: error.response?.data?.error || error.message });
    } finally {
      setBulkQueueing(false);
    }
  };

  const handleSyncToAirtable = async () => {
    setAirtableSyncing(true);
    setStatusMessage(null); // Use statusMessage for airtable feedback too
    try {
      const response = await base44.functions.invoke('syncOfficeClosuresToAirtable', {});
      setStatusMessage({
        type: 'success',
        message: response.data.message
      });
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      setStatusMessage({
        type: 'error',
        message: 'Error syncing to Airtable: ' + errorMessage
      });
    } finally {
      setAirtableSyncing(false);
    }
  };

  if (isLoading) {
    return <ListPageSkeleton />;
  }

  const filteredReminders = reminders.filter(reminder =>
    reminder.reminder_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reminder.reminder_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    reminder.email_subject?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedReminders = [...filteredReminders].sort((a, b) => {
    let aValue, bValue;
    
    if (sortField === 'send_date' || sortField === 'last_sent_date') {
      aValue = a[sortField] ? new Date(a[sortField]) : new Date(0);
      bValue = b[sortField] ? new Date(b[sortField]) : new Date(0);
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    } else if (sortField === 'send_count') {
      aValue = a.send_count || 0;
      bValue = b.send_count || 0;
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    } else {
      aValue = a[sortField] || '';
      bValue = b[sortField] || '';
    }
    
    const comparison = aValue.toString().toLowerCase().localeCompare(bValue.toString().toLowerCase());
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 ml-1 inline" />;
    return sortDirection === 'asc' ? 
      <ArrowUp className="w-4 h-4 ml-1 inline" /> : 
      <ArrowDown className="w-4 h-4 ml-1 inline" />;
  };

  const statusColors = {
    active: "bg-green-100 text-green-800",
    inactive: "bg-gray-100 text-gray-800",
    completed: "bg-blue-100 text-blue-800"
  };

  const getNotificationType = (reminder) => {
    if (reminder.reminder_type === 'Holiday') return 'Holiday Closure';
    if (reminder.reminder_type === 'Office Closure' || reminder.reminder_type === 'Inclement Weather') return 'Office Closure';
    if (reminder.reminder_type === 'Reminder Notification') return 'Reminder Notification';
    return null;
  };

  const getQueueRecord = (reminder) => {
    const notificationType = getNotificationType(reminder);
    if (!notificationType) return null;
    return notificationQueue.find(n =>
      n.notification_type === notificationType &&
      n.related_record_id === reminder.id &&
      (n.send_date || '') === (reminder.send_date || '') &&
      (n.closure_date || '') === (reminder.closure_date || '')
    ) || null;
  };

  const queueStatusColors = {
    "Not Queued": "bg-gray-100 text-gray-700",
    "Queued": "bg-blue-100 text-blue-800",
    "Sent": "bg-green-100 text-green-800",
    "Failed": "bg-red-100 text-red-800",
    "Cancelled": "bg-slate-100 text-slate-700"
  };

  const getQueueLabel = (record) => {
    if (!record) return 'Not Queued';
    if (record.status === 'Ready to Send') return 'Queued';
    return record.status || 'Not Queued';
  };

  const typeColors = {
    "License Expiration": "bg-red-100 text-red-800",
    "Privilege Expiration": "bg-orange-100 text-orange-800",
    "Holiday": "bg-green-100 text-green-800",
    "Office Closure": "bg-indigo-100 text-indigo-800",
    "Inclement Weather": "bg-slate-100 text-slate-800",
    "Reminder Notification": "bg-cyan-100 text-cyan-800",
    "CME Due": "bg-purple-100 text-purple-800",
    "Invoice Due": "bg-yellow-100 text-yellow-800",
    "Custom": "bg-blue-100 text-blue-800"
  };

  return (
    <>
    <div className="h-full min-h-0 overflow-hidden flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="flex-shrink-0 p-2 md:p-3">
        <div className="max-w-none w-full space-y-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Notifications & Closures</h1>
            <p className="text-slate-600 text-sm">Manage automated email reminders, notifications, and office closures</p>
          </div>
          <div className="flex gap-2">
            {user?.role === 'admin' && (
              <>
                <Button asChild variant="outline" className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 gap-2">
                  <Link to="/NotificationQueue">
                    <BellRing className="w-4 h-4" />
                    Notification Queue
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </Button>
                <Button
                  onClick={handleSyncToAirtable}
                  disabled={airtableSyncing}
                  variant="outline"
                  className="border-purple-300 text-purple-700 hover:bg-purple-50 gap-2"
                >
                  {airtableSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
                  Sync to Airtable
                </Button>
                <Button
                  onClick={handleBulkQueueClosures}
                  disabled={bulkQueueing}
                  variant="outline"
                  className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 gap-2"
                >
                  {bulkQueueing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
                  Queue Closure Notifications
                </Button>
                <Button
                  onClick={() => {
                    setEditingReminder(null);
                    setShowForm(true);
                  }}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Reminder
                </Button>
              </>
            )}
          </div>
        </div>

        {user?.role === 'admin' && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3 no-print">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-blue-700 text-sm">
              Email delivery is now handled through Power Automate / Notification Queue. Airtable sync is legacy and should only be used if directed.
            </p>
          </div>
        )}

        {statusMessage && (
          <Card className={`border-2 ${
            statusMessage.type === 'success' ? 'border-green-300 bg-green-50' :
            statusMessage.type === 'warning' ? 'border-yellow-300 bg-yellow-50' :
            'border-red-300 bg-red-50'
          }`}>
            <CardContent className="p-4 flex items-center gap-3">
              {statusMessage.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-orange-600" />
              )}
              <p className={`font-medium ${
                statusMessage.type === 'success' ? 'text-green-900' :
                statusMessage.type === 'warning' ? 'text-yellow-900' :
                'text-red-900'
              }`}>
                {statusMessage.message}
              </p>
            </CardContent>
          </Card>
        )}

        {showForm && (
          <ReminderForm
            reminder={editingReminder}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingReminder(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-4 md:px-6 pb-4">
        <div className="max-w-none w-full h-full">
        <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm h-full flex flex-col">
          <CardHeader className="border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search reminders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md border-slate-200"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="overflow-auto h-full">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('reminder_name')}
                    >
                      Reminder Name <SortIcon field="reminder_name" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('reminder_type')}
                    >
                      Type <SortIcon field="reminder_type" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('send_date')}
                    >
                      Send Date <SortIcon field="send_date" />
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700 bg-slate-50">
                      Queue Status
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('frequency')}
                    >
                      Frequency <SortIcon field="frequency" />
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700 bg-slate-50">
                      Recipients
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('last_sent_date')}
                    >
                      Last Sent <SortIcon field="last_sent_date" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('send_count')}
                    >
                      Times Sent <SortIcon field="send_count" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('status')}
                    >
                      Status <SortIcon field="status" />
                    </th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700 bg-slate-50">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedReminders.map((reminder) => (
                    <tr key={reminder.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <div className="font-medium text-slate-900">{reminder.reminder_name}</div>
                        <div className="text-sm text-slate-600 truncate max-w-xs">
                          {reminder.email_subject}
                        </div>
                        {reminder.reminder_type === 'Holiday' && reminder.closure_date && (
                          <div className="text-xs text-slate-500 mt-1">
                            Closes: {format(parseISO(reminder.closure_date), 'MMM d, yyyy')}
                            {reminder.reopen_date && ` • Reopens: ${format(parseISO(reminder.reopen_date), 'MMM d, yyyy')}`}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge className={typeColors[reminder.reminder_type]}>
                          {reminder.reminder_type}
                        </Badge>
                      </td>
                      <td className="p-4 text-slate-600">
                        {reminder.send_date ? format(parseISO(reminder.send_date), 'MMM d, yyyy') : '-'}
                      </td>
                      <td className="p-4">
                        {(() => {
                          const queueRecord = getQueueRecord(reminder);
                          const label = getQueueLabel(queueRecord);
                          return (
                            <div className="space-y-1">
                              <Badge className={queueStatusColors[label]}>{label}</Badge>
                              {reminder.closure_date && (
                                <div className="text-xs text-slate-500">Closure: {format(parseISO(reminder.closure_date), 'MMM d, yyyy')}</div>
                              )}
                              {queueRecord?.sent_date && (
                                <div className="text-xs text-slate-500">Sent: {format(parseISO(queueRecord.sent_date), 'MMM d, yyyy h:mm a')}</div>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="p-4 text-slate-600">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span className="capitalize">{reminder.frequency}</span>
                          {reminder.frequency !== 'once' && reminder.frequency_count > 1 && (
                            <span className="text-xs text-slate-500">({reminder.frequency_count}x)</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-slate-600">
                        <div className="flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          <span>{reminder.recipients?.length || 0}</span>
                        </div>
                      </td>
                      <td className="p-4 text-slate-600">
                        {reminder.last_sent_date 
                          ? format(parseISO(reminder.last_sent_date), 'MMM d, yyyy HH:mm') 
                          : 'Never'}
                      </td>
                      <td className="p-4 text-slate-600 text-center">
                        {reminder.send_count || 0}
                      </td>
                      <td className="p-4">
                        <Badge className={statusColors[reminder.status]}>
                          {reminder.status?.charAt(0).toUpperCase() + reminder.status?.slice(1)}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        {user?.role === 'admin' && (
                          <div className="flex gap-2 justify-end">
                            {(['Office Closure', 'Holiday', 'Inclement Weather'].includes(reminder.reminder_type) || (reminder.reminder_type === 'Reminder Notification' && reminder.email_notification_eligible === true)) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleQueueNotification(reminder)}
                                disabled={queuingId === reminder.id}
                                title="Queue email notification for Power Automate"
                                className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                              >
                                {queuingId === reminder.id
                                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                                  : <BellRing className="w-4 h-4" />}
                              </Button>
                            )}
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleResetReminder(reminder)}
                              disabled={resetReminderMutation.isPending}
                              title="Reset last sent and times sent"
                              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => handleSendReminder(reminder)}
                              disabled={sendReminderMutation.isPending || reminder.status !== 'active'}
                              title="Send reminder now"
                            >
                              <Send className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setEditingReminder(reminder);
                                setShowForm(true);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setDeleteConfirm(reminder)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sortedReminders.length === 0 && (
                <div className="p-4">
                  <EmptyState
                    title="No reminders found"
                    description={searchTerm ? "Try adjusting your search terms" : "Set up automated email reminders"}
                    action={
                      !searchTerm && user?.role === 'admin' && (
                        <Button
                          onClick={() => {
                            setEditingReminder(null);
                            setShowForm(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 mt-4"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Reminder
                        </Button>
                      )
                    }
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reminder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the reminder "{deleteConfirm?.reminder_name}"? This action cannot be undone.
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
    </>
  );
}