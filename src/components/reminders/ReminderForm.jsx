import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import { useFormState } from "@/components/FormContext";

export default function ReminderForm({ reminder, onSubmit, onCancel, isLoading }) {
  const { setIsDirty } = useFormState();
  const [formData, setFormData] = useState({
    reminder_name: '',
    reminder_type: 'Custom',
    email_subject: '',
    email_body: '',
    recipients: [],
    send_date: '',
    closure_date: '',
    reopen_date: '',
    closure_name: '',
    oncall_provider_list: '',
    oncall_phone_list: '',
    frequency: 'once',
    frequency_count: 1,
    status: 'active',
    notes: ''
  });

  // Track which fields have been manually edited to prevent auto-override
  const [manuallyEdited, setManuallyEdited] = useState({
    send_date: false,
    reopen_date: false,
    email_subject: false,
    oncall_provider_list: false,
    oncall_phone_list: false
  });

  const [newRecipient, setNewRecipient] = useState('');

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  const { data: onCallSchedules = [] } = useQuery({
    queryKey: ['oncall-schedules'],
    queryFn: () => base44.entities.OnCallSchedule.list()
  });

  const { data: externalContacts = [] } = useQuery({
    queryKey: ['external-contacts'],
    queryFn: () => base44.entities.ExternalContact.list()
  });

  // Reset manual edit flags when dates change to allow re-calculation
  const prevDatesRef = React.useRef({ closure_date: '', reopen_date: '' });
  useEffect(() => {
    if (formData.closure_date !== prevDatesRef.current.closure_date || 
        formData.reopen_date !== prevDatesRef.current.reopen_date) {
      if (prevDatesRef.current.closure_date !== '' || prevDatesRef.current.reopen_date !== '') {
        setManuallyEdited(prev => ({ 
          ...prev, 
          oncall_provider_list: false, 
          oncall_phone_list: false 
        }));
      }
      prevDatesRef.current = { 
        closure_date: formData.closure_date, 
        reopen_date: formData.reopen_date 
      };
    }
  }, [formData.closure_date, formData.reopen_date]);

  // Auto-populate on-call providers during closure period (only if not manually edited)
  useEffect(() => {
    if (formData.closure_date && formData.reopen_date && onCallSchedules.length > 0 
        && !manuallyEdited.oncall_provider_list && !manuallyEdited.oncall_phone_list) {
      const closureDate = new Date(formData.closure_date + 'T00:00:00');
      const reopenDate = new Date(formData.reopen_date + 'T00:00:00');
      
      // Find on-call schedules that overlap with closure period
      const onCallDuringClosure = onCallSchedules.filter(schedule => {
        // Exclude schedules that end on the closure date (outgoing provider at 8am)
        if (schedule.end_date === formData.closure_date) return false;

        // Exclude schedules that start on the reopen date (incoming provider at 8am)
        if (schedule.start_date === formData.reopen_date) return false;

        const startDate = new Date(schedule.start_date + 'T00:00:00');
        const endDate = new Date(schedule.end_date + 'T00:00:00');

        // Check for overlap
        return (closureDate >= startDate && closureDate <= endDate) ||
               (reopenDate >= startDate && reopenDate <= endDate) ||
               (startDate >= closureDate && startDate <= reopenDate);
      });

      if (onCallDuringClosure.length > 0) {
        // Sort schedules by start date to maintain chronological order
        const sortedSchedules = onCallDuringClosure.sort((a, b) => {
          return new Date(a.start_date) - new Date(b.start_date);
        });
        
        // Get providers in order of their on-call schedule
        const providerIds = [];
        const seenProviders = new Set();
        
        sortedSchedules.forEach(schedule => {
          if (!seenProviders.has(schedule.provider_id)) {
            providerIds.push(schedule.provider_id);
            seenProviders.add(schedule.provider_id);
          }
        });
        
        const onCallProviders = providerIds.map(id => providers.find(p => p.id === id)).filter(Boolean);
        
        // Build matched lists - keep phone in same order as provider name (even if empty)
        const providerNames = onCallProviders.map(p => p.full_name).join(', ');
        const phoneNumbers = onCallProviders.map(p => p.phone || 'N/A').join(', ');
        
        if (providerNames && providerNames !== formData.oncall_provider_list) {
          setFormData(prev => ({ 
            ...prev, 
            oncall_provider_list: providerNames,
            oncall_phone_list: phoneNumbers
          }));
        }
      }
    }
  }, [formData.closure_date, formData.reopen_date, onCallSchedules, providers, manuallyEdited.oncall_provider_list, manuallyEdited.oncall_phone_list]);

  useEffect(() => {
    if (reminder) {
      setFormData(reminder);
      // Mark all existing fields as manually edited to prevent auto-override on edit
      setManuallyEdited({
        send_date: !!reminder.send_date,
        reopen_date: !!reminder.reopen_date,
        email_subject: !!reminder.email_subject,
        oncall_provider_list: !!reminder.oncall_provider_list,
        oncall_phone_list: !!reminder.oncall_phone_list
      });
    }
  }, [reminder]);

  // Closure/Holiday to reopen date mapping
  const closureReopenDates = {
    'Labor Day': { '2025': '2025-09-02', '2026': '2026-09-08' },
    'Thanksgiving': { '2025': '2025-12-01', '2026': '2026-11-30' },
    'Christmas': { '2025': '2025-12-29', '2026': '2026-12-28' },
    'New Year\'s Day': { '2026': '2026-01-05' },
    'Easter': { '2026': '2026-04-07' },
    'Memorial Day': { '2026': '2026-05-26' }
  };

  // Auto-calculate send date when closure date changes (only if not manually edited)
  useEffect(() => {
    if (formData.closure_date && (formData.reminder_type === 'Holiday' || formData.reminder_type === 'Office Closure') && !manuallyEdited.send_date) {
      const closureDate = new Date(formData.closure_date + 'T00:00:00');
      const weekday = closureDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
      
      // Don't send emails for Saturday or Sunday closures
      if (weekday === 0 || weekday === 6) {
        setFormData(prev => ({ ...prev, send_date: '' }));
        return;
      }
      
      let daysToSubtract;
      switch (weekday) {
        case 1: // Monday - send on Thursday before (2 business days)
          daysToSubtract = -4;
          break;
        case 2: // Tuesday - send on Friday before (2 business days)
          daysToSubtract = -4;
          break;
        default: // Wednesday-Friday
          daysToSubtract = -2; // Two days before closure
          break;
        }
      
      const sendDate = new Date(closureDate);
      sendDate.setDate(sendDate.getDate() + daysToSubtract);
      
      const formattedSendDate = sendDate.toISOString().split('T')[0];
      
      if (formattedSendDate !== formData.send_date) {
        setFormData(prev => ({ ...prev, send_date: formattedSendDate }));
      }
    }
  }, [formData.closure_date, formData.reminder_type, manuallyEdited.send_date]);

  // Auto-populate reopen date based on closure name and closure year (only if not manually edited)
  useEffect(() => {
    if (formData.closure_date && formData.closure_name && (formData.reminder_type === 'Holiday' || formData.reminder_type === 'Office Closure') && !manuallyEdited.reopen_date) {
      const closureYear = new Date(formData.closure_date).getFullYear().toString();
      let reopenDate = closureReopenDates[formData.closure_name]?.[closureYear];
      
      // Validation: Ensure reopen date is after closure date
      if (reopenDate && formData.closure_date && reopenDate <= formData.closure_date) {
          // If predefined date is invalid (backwards), default to next day
          const nextDay = new Date(formData.closure_date);
          nextDay.setDate(nextDay.getDate() + 1);
          reopenDate = format(nextDay, 'yyyy-MM-dd');
      }

      if (reopenDate && reopenDate !== formData.reopen_date) {
        setFormData(prev => ({ ...prev, reopen_date: reopenDate, reopen_time: prev.reopen_time || '8:00 AM' }));
      }
    }
  }, [formData.closure_date, formData.closure_name, formData.reminder_type, manuallyEdited.reopen_date]);

  // Auto-set email subject for holidays (only if not manually edited)
  useEffect(() => {
    if (formData.closure_date && formData.closure_name && (formData.reminder_type === 'Holiday' || formData.reminder_type === 'Office Closure') && !manuallyEdited.email_subject) {
      // Calculate end date (last business day closed)
      let endDateFormatted = '';
      if (formData.reopen_date) {
        const endDate = new Date(formData.reopen_date + 'T00:00:00');
        endDate.setDate(endDate.getDate() - 1);
        while (endDate.getDay() === 0 || endDate.getDay() === 6) {
          endDate.setDate(endDate.getDate() - 1);
        }
        endDateFormatted = format(endDate, 'MM/dd/yyyy');
      }

      const startDateFormatted = format(parseISO(formData.closure_date), 'MM/dd/yyyy');
      const dateRange = endDateFormatted && endDateFormatted !== startDateFormatted 
        ? `${startDateFormatted}-${endDateFormatted}` 
        : startDateFormatted;

      const subject = `Office Closure Notification: ACCT6650- ${dateRange}— ${formData.closure_name}`;
      
      if (subject !== formData.email_subject) {
        setFormData(prev => ({ ...prev, email_subject: subject }));
      }
    }
  }, [formData.closure_date, formData.reopen_date, formData.closure_name, formData.reminder_type, manuallyEdited.email_subject]);

  // Auto-apply holiday template for email body when all required fields are available
  useEffect(() => {
    if ((formData.reminder_type === 'Holiday' || formData.reminder_type === 'Office Closure') && 
        formData.closure_date && 
        formData.reopen_date && 
        formData.closure_name && 
        formData.oncall_provider_list && 
        formData.oncall_phone_list &&
        !formData.email_body) {  // Only auto-apply if email body is empty
      
      const closureText = formData.closure_name && formData.closure_name !== 'Office Closure' ? ` for ${formData.closure_name}` : '';
      const closureTimeStr = formData.closure_time ? ` at ${formData.closure_time}` : '';
      const reopenTimeStr = formData.reopen_time || '8am';

      const template = `Good Morning All,
 
This email is to notify you that our office will be closed on ${format(parseISO(formData.closure_date), 'MMMM d, yyyy')}${closureTimeStr}${closureText}.

The offices will re-open at ${reopenTimeStr} on ${format(parseISO(formData.reopen_date), 'MMMM d, yyyy')}.

${formData.oncall_provider_list} ${formData.oncall_provider_list.includes(',') ? 'are' : 'is'} the on-call provider${formData.oncall_provider_list.includes(',') ? 's' : ''} and can be reached at ${formData.oncall_phone_list}.
 
Best Regards,
Steve Brown  
The Operations Team


`;

      setFormData(prev => ({ ...prev, email_body: template }));
    }
  }, [formData.reminder_type, formData.closure_date, formData.reopen_date, formData.closure_name, formData.oncall_provider_list, formData.oncall_phone_list, formData.email_body, formData.closure_time, formData.reopen_time]);



  const handleSubmit = (e) => {
    e.preventDefault();
    setIsDirty(false);
    onSubmit(formData);
  };

  const addRecipient = () => {
    if (newRecipient && !formData.recipients.includes(newRecipient)) {
      setIsDirty(true);
      setFormData({
        ...formData,
        recipients: [...formData.recipients, newRecipient]
      });
      setNewRecipient('');
    }
  };

  const removeRecipient = (email) => {
    setIsDirty(true);
    setFormData({
      ...formData,
      recipients: formData.recipients.filter(r => r !== email)
    });
  };

  const addProviderEmail = (providerId) => {
    const provider = providers.find(p => p.id === providerId);
    if (provider && provider.email && !formData.recipients.includes(provider.email)) {
      setIsDirty(true);
      setFormData({
        ...formData,
        recipients: [...formData.recipients, provider.email]
      });
    }
  };

  const addExternalContactEmail = (contactId) => {
    const contact = externalContacts.find(c => c.id === contactId);
    if (contact && contact.email && !formData.recipients.includes(contact.email)) {
      setIsDirty(true);
      setFormData({
        ...formData,
        recipients: [...formData.recipients, contact.email]
      });
    }
  };

  const useHolidayTemplate = () => {
    const closureText = formData.closure_name && formData.closure_name !== 'Office Closure' ? ` for ${formData.closure_name}` : '';
    const closureTimeStr = formData.closure_time ? ` at ${formData.closure_time}` : '';
    const reopenTimeStr = formData.reopen_time || '8am';

    const template = `Good Morning All,
 
This email is to notify you that our office will be closed on ${formData.closure_date ? format(parseISO(formData.closure_date), 'MMMM d, yyyy') : '(date of Closed)'}${closureTimeStr}${closureText}.

The offices will re-open at ${reopenTimeStr} on ${formData.reopen_date ? format(parseISO(formData.reopen_date), 'MMMM d, yyyy') : '(Re-Open Date)'}.

${formData.oncall_provider_list ? formData.oncall_provider_list : '(On-Call Provider List)'} ${formData.oncall_provider_list && formData.oncall_provider_list.includes(',') ? 'are' : 'is'} the on-call provider${formData.oncall_provider_list && formData.oncall_provider_list.includes(',') ? 's' : ''} and can be reached at ${formData.oncall_phone_list || '(On-call Phone List)'}.
 
Best Regards,
Steve Brown  
The Operations Team


`;

    let dateRange = '';
    if (formData.closure_date) {
      const startDateFormatted = format(parseISO(formData.closure_date), 'MM/dd/yyyy');
      let endDateFormatted = '';
      
      if (formData.reopen_date) {
        const endDate = new Date(formData.reopen_date + 'T00:00:00');
        endDate.setDate(endDate.getDate() - 1);
        while (endDate.getDay() === 0 || endDate.getDay() === 6) {
          endDate.setDate(endDate.getDate() - 1);
        }
        endDateFormatted = format(endDate, 'MM/dd/yyyy');
      }
      
      dateRange = endDateFormatted && endDateFormatted !== startDateFormatted 
        ? `${startDateFormatted}-${endDateFormatted}` 
        : startDateFormatted;
    }

    const subject = `Office Closure Notification: ACCT6650- ${dateRange}— ${formData.closure_name || ''}`;

    setFormData({
      ...formData,
      email_body: template,
      email_subject: subject
    });
  };

  return (
    <Card className="border-slate-200 shadow-sm max-h-[85vh] flex flex-col overflow-hidden">
      <CardHeader className="border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center justify-between">
          <CardTitle>{reminder ? 'Edit Reminder' : 'Create Reminder'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
        <CardContent className="p-6 space-y-6 overflow-y-auto flex-1">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="reminder_name">Reminder Name *</Label>
              <Input
                id="reminder_name"
                value={formData.reminder_name}
                onChange={(e) => { setIsDirty(true); setIsDirty(true); setFormData({ ...formData, reminder_name: e.target.value })}
                placeholder="e.g., License Renewal Reminder"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="reminder_type">Reminder Type</Label>
              <Select 
                value={formData.reminder_type} 
                onValueChange={(value) => setFormData({ ...formData, reminder_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="License Expiration">License Expiration</SelectItem>
                  <SelectItem value="Privilege Expiration">Privilege Expiration</SelectItem>
                  <SelectItem value="Holiday">Holiday</SelectItem>
                  <SelectItem value="Office Closure">Office Closure</SelectItem>
                  <SelectItem value="CME Due">CME Due</SelectItem>
                  <SelectItem value="Invoice Due">Invoice Due</SelectItem>
                  <SelectItem value="Custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="send_date">
                Send Date * 
                {manuallyEdited.send_date && formData.reminder_type === 'Holiday' && (
                  <span className="text-blue-600 text-xs ml-2">✏️ Manually edited</span>
                )}
              </Label>
              <DatePicker
                value={formData.send_date}
                onChange={(date) => { setIsDirty(true);
                  setIsDirty(true);
                  setFormData({ ...formData, send_date: date });
                  setManuallyEdited(prev => ({ ...prev, send_date: true }));
                }}
              />
              {(formData.reminder_type === 'Holiday' || formData.reminder_type === 'Office Closure') && formData.closure_date && (
                  <p className="text-xs text-slate-500">
                    {(() => {
                      const closureDate = new Date(formData.closure_date + 'T00:00:00');
                      const weekday = closureDate.getDay();
                      if (weekday === 0 || weekday === 6) {
                        return '⚠️ No email sent for weekend closures';
                      }
                      return manuallyEdited.send_date 
                        ? '✏️ Manually overridden - edit as needed' 
                        : '✨ Auto-calculated: last working day before closure';
                    })()}
                  </p>
                )}
              {formData.reminder_type !== 'Holiday' && formData.reminder_type !== 'Office Closure' && (
                <p className="text-xs text-slate-500">Date when reminder should be sent</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="frequency">Frequency *</Label>
              <Select 
                value={formData.frequency} 
                onValueChange={(value) => setFormData({ ...formData, frequency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">Once</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.frequency !== 'once' && (
              <div className="space-y-2">
                <Label htmlFor="frequency_count">Repeat Every</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="frequency_count"
                    type="number"
                    min="1"
                    value={formData.frequency_count}
                    onChange={(e) => { setIsDirty(true); setIsDirty(true); setFormData({ ...formData, frequency_count: parseInt(e.target.value) })}
                    className="w-24"
                  />
                  <span className="text-sm text-slate-600">
                    {formData.frequency === 'daily' ? 'day(s)' :
                     formData.frequency === 'weekly' ? 'week(s)' :
                     formData.frequency === 'monthly' ? 'month(s)' :
                     formData.frequency === 'quarterly' ? 'quarter(s)' :
                     'year(s)'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold text-slate-900">Office Closure Details</Label>
              <Button type="button" onClick={useHolidayTemplate} variant="outline" size="sm">
                Use Template
              </Button>
            </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="closure_name">Closure Name</Label>
                  <Select
                    value={formData.closure_name}
                    onValueChange={(value) => setFormData({ ...formData, closure_name: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select closure..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Office Closure">Office Closure</SelectItem>
                      <SelectItem value="Labor Day">Labor Day</SelectItem>
                      <SelectItem value="Thanksgiving">Thanksgiving</SelectItem>
                      <SelectItem value="Christmas">Christmas</SelectItem>
                      <SelectItem value="New Year's Day">New Year's Day</SelectItem>
                      <SelectItem value="Easter">Easter</SelectItem>
                      <SelectItem value="Memorial Day">Memorial Day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="closure_date">Closure Date</Label>
                  <DatePicker
                    value={formData.closure_date}
                    onChange={(date) => { setIsDirty(true); setIsDirty(true); setFormData({ ...formData, closure_date: date })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="closure_time">Closure Time (Optional)</Label>
                  <TimePicker
                    value={formData.closure_time || ''}
                    onChange={(value) => { setIsDirty(true); setFormData({ ...formData, closure_time: value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reopen_date">
                    Re-open Date
                    {manuallyEdited.reopen_date && formData.reminder_type === 'Holiday' && (
                      <span className="text-blue-600 text-xs ml-2">✏️ Manually edited</span>
                    )}
                  </Label>
                  <DatePicker
                    value={formData.reopen_date}
                    onChange={(date) => { setIsDirty(true);
                      setIsDirty(true);
                      setFormData({ ...formData, reopen_date: date });
                      setManuallyEdited(prev => ({ ...prev, reopen_date: true }));
                    }}
                  />
                  {formData.closure_name && formData.closure_date && (
                    <p className="text-xs text-slate-500">
                      {manuallyEdited.reopen_date 
                        ? '✏️ Manually overridden - edit as needed' 
                        : '✨ Auto-populated based on closure name'}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reopen_time">Reopen Time (Optional)</Label>
                  <TimePicker
                    value={formData.reopen_time || ''}
                    onChange={(value) => { setIsDirty(true); setFormData({ ...formData, reopen_time: value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="oncall_provider_list">
                    On-Call Provider(s)
                    {manuallyEdited.oncall_provider_list && formData.reminder_type === 'Holiday' && (
                      <span className="text-blue-600 text-xs ml-2">✏️ Manually edited</span>
                    )}
                  </Label>
                  <Input
                    id="oncall_provider_list"
                    value={formData.oncall_provider_list}
                    onChange={(e) => { setIsDirty(true);
                      setIsDirty(true);
                      setFormData({ ...formData, oncall_provider_list: e.target.value });
                      setManuallyEdited(prev => ({ ...prev, oncall_provider_list: true }));
                    }}
                    placeholder="Dr. John Smith"
                  />
                  {formData.closure_date && (
                    <p className="text-xs text-slate-500">
                      {manuallyEdited.oncall_provider_list 
                        ? '✏️ Manually overridden - edit as needed'
                        : formData.oncall_provider_list 
                          ? '✨ Auto-populated from on-call schedule' 
                          : '⚠️ No on-call provider found for this date'}
                    </p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="oncall_phone_list">
                    On-Call Phone Number(s)
                    {manuallyEdited.oncall_phone_list && formData.reminder_type === 'Holiday' && (
                      <span className="text-blue-600 text-xs ml-2">✏️ Manually edited</span>
                    )}
                  </Label>
                  <Input
                    id="oncall_phone_list"
                    value={formData.oncall_phone_list}
                    onChange={(e) => { setIsDirty(true);
                      setIsDirty(true);
                      setFormData({ ...formData, oncall_phone_list: e.target.value });
                      setManuallyEdited(prev => ({ ...prev, oncall_phone_list: true }));
                    }}
                    placeholder="860-123-4567"
                  />
                  {formData.closure_date && (
                    <p className="text-xs text-slate-500">
                      {manuallyEdited.oncall_phone_list 
                        ? '✏️ Manually overridden - edit as needed' 
                        : '✨ Auto-linked from provider record'}
                    </p>
                  )}
                </div>
              </div>
            </div>

          <div className="space-y-2">
            <Label htmlFor="email_subject">
              Email Subject *
              {manuallyEdited.email_subject && formData.reminder_type === 'Holiday' && (
                <span className="text-blue-600 text-xs ml-2">✏️ Manually edited</span>
              )}
            </Label>
            <Input
              id="email_subject"
              value={formData.email_subject}
              onChange={(e) => { setIsDirty(true);
                setIsDirty(true);
                setFormData({ ...formData, email_subject: e.target.value });
                setManuallyEdited(prev => ({ ...prev, email_subject: true }));
              }}
              placeholder="e.g., Your medical license expires in 30 days"
              required
            />
            {formData.reminder_type === 'Holiday' && formData.closure_date && formData.closure_name && (
              <p className="text-xs text-slate-500">
                {manuallyEdited.email_subject 
                  ? '✏️ Manually overridden - edit as needed' 
                  : '✨ Auto-formatted for holiday closure notification'}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="email_body">Email Body *</Label>
              <Button type="button" onClick={useHolidayTemplate} variant="outline" size="sm">
                Use Template
              </Button>
            </div>
            <Textarea
              id="email_body"
              value={formData.email_body}
              onChange={(e) => { setIsDirty(true); setIsDirty(true); setFormData({ ...formData, email_body: e.target.value })}
              rows={8}
              placeholder="Enter your email message here..."
              required
              className="font-mono text-sm"
            />
            <p className="text-xs text-slate-500">You can use HTML formatting in the email body</p>
          </div>

          <div className="space-y-3">
            <Label>Recipients *</Label>
            
            <div className="p-4 bg-slate-50 rounded-lg space-y-3">
              <div>
                <Label className="text-xs text-slate-600">Add Provider Email</Label>
                <Select onValueChange={addProviderEmail}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a provider to add..." />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map(provider => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.full_name} ({provider.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-slate-600">Add External Contact</Label>
                <Select onValueChange={addExternalContactEmail}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an external contact to add..." />
                  </SelectTrigger>
                  <SelectContent>
                    {externalContacts.map(contact => (
                      <SelectItem key={contact.id} value={contact.id}>
                        {contact.name} ({contact.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-slate-600">Or Add Email Manually</Label>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={newRecipient}
                    onChange={(e) => setNewRecipient(e.target.value)}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addRecipient();
                      }
                    }}
                  />
                  <Button type="button" onClick={addRecipient} variant="outline">
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {formData.recipients.length > 0 && (
              <div className="space-y-2">
                <Label className="text-xs text-slate-600">
                  {formData.recipients.length} Recipient(s)
                </Label>
                <div className="flex flex-wrap gap-2">
                  {formData.recipients.map((email, index) => (
                    <Badge key={index} variant="secondary" className="gap-2">
                      {email}
                      <button
                        type="button"
                        onClick={() => removeRecipient(email)}
                        className="hover:text-red-600"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => { setIsDirty(true); setIsDirty(true); setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Additional notes or context for this reminder..."
            />
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-100 p-6 flex justify-end gap-3 flex-shrink-0">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isLoading || formData.recipients.length === 0} 
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? 'Saving...' : reminder ? 'Update Reminder' : 'Create Reminder'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}