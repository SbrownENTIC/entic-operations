import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Send, Clock, Mail, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import ReminderForm from "../components/reminders/ReminderForm";
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
  const [sortDirection, setSortDirection] = useState('asc');
  const queryClient = useQueryClient();

  const { data: reminders = [], isLoading } = useQuery({
    queryKey: ['reminders'],
    queryFn: () => base44.entities.Reminder.list('send_date')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Reminder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      setShowForm(false);
      setEditingReminder(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Reminder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      setShowForm(false);
      setEditingReminder(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Reminder.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      setDeleteConfirm(null);
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
Operations Project Coordinator`;
      }
      
      // Send emails to all recipients
      for (const recipient of reminder.recipients) {
        await base44.integrations.Core.SendEmail({
          to: recipient,
          subject: reminder.email_subject,
          body: emailBody,
          from_name: 'MedPractice Reminders'
        });
      }
      
      // Update reminder with last sent date and increment send count
      const now = new Date().toISOString();
      await base44.entities.Reminder.update(reminder.id, {
        last_sent_date: now,
        send_count: (reminder.send_count || 0) + 1
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
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

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12 text-slate-500">Loading...</div>
        </div>
      </div>
    );
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

  const typeColors = {
    "License Expiration": "bg-red-100 text-red-800",
    "Privilege Expiration": "bg-orange-100 text-orange-800",
    "Holiday": "bg-green-100 text-green-800",
    "CME Due": "bg-purple-100 text-purple-800",
    "Invoice Due": "bg-yellow-100 text-yellow-800",
    "Custom": "bg-blue-100 text-blue-800"
  };

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Reminders</h1>
            <p className="text-slate-600 mt-1">Manage automated email reminders and notifications</p>
          </div>
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
        </div>

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

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
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
          <CardContent className="p-0">
            <div className="overflow-x-auto">
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
                        <div className="flex gap-2 justify-end">
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sortedReminders.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No reminders found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
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
    </div>
  );
}