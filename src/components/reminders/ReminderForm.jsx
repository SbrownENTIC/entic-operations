import React, { useState, useEffect } from "react";
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

export default function ReminderForm({ reminder, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    reminder_name: '',
    reminder_type: 'Custom',
    email_subject: '',
    email_body: '',
    recipients: [],
    send_date: '',
    closure_date: '',
    reopen_date: '',
    holiday_name: '',
    oncall_provider_list: '',
    oncall_phone_list: '',
    frequency: 'once',
    frequency_count: 1,
    status: 'active',
    notes: ''
  });

  const [newRecipient, setNewRecipient] = useState('');

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  useEffect(() => {
    if (reminder) {
      setFormData(reminder);
    }
  }, [reminder]);

  // Auto-calculate send date when closure date changes
  useEffect(() => {
    if (formData.closure_date && formData.reminder_type === 'Holiday') {
      const closureDate = new Date(formData.closure_date + 'T00:00:00');
      const weekday = closureDate.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
      
      let daysToSubtract;
      switch (weekday) {
        case 0: // Sunday
          daysToSubtract = -2; // -3 + 1 from formula
          break;
        case 1: // Monday - send on Friday before
          daysToSubtract = -3; // Go back to Friday
          break;
        case 6: // Saturday
          daysToSubtract = -1; // -2 + 1 from formula
          break;
        default: // Tuesday-Friday
          daysToSubtract = 0; // -1 + 1 from formula = same day (day before closure)
          break;
      }
      
      const sendDate = new Date(closureDate);
      sendDate.setDate(sendDate.getDate() + daysToSubtract);
      
      const formattedSendDate = sendDate.toISOString().split('T')[0];
      
      if (formattedSendDate !== formData.send_date) {
        setFormData(prev => ({ ...prev, send_date: formattedSendDate }));
      }
    }
  }, [formData.closure_date, formData.reminder_type]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const addRecipient = () => {
    if (newRecipient && !formData.recipients.includes(newRecipient)) {
      setFormData({
        ...formData,
        recipients: [...formData.recipients, newRecipient]
      });
      setNewRecipient('');
    }
  };

  const removeRecipient = (email) => {
    setFormData({
      ...formData,
      recipients: formData.recipients.filter(r => r !== email)
    });
  };

  const addProviderEmail = (providerId) => {
    const provider = providers.find(p => p.id === providerId);
    if (provider && provider.email && !formData.recipients.includes(provider.email)) {
      setFormData({
        ...formData,
        recipients: [...formData.recipients, provider.email]
      });
    }
  };

  const useHolidayTemplate = () => {
    const template = `Good Morning All,
 
This email is to notify you that our office will be closed on ${formData.closure_date ? format(parseISO(formData.closure_date), 'MMMM d, yyyy') : '(date of Closed)'} for the ${formData.holiday_name || '(Holiday Name)'} Holiday.

The offices will re-open at 8am on ${formData.reopen_date ? format(parseISO(formData.reopen_date), 'MMMM d, yyyy') : '(Re-Open Date)'}.

${formData.oncall_provider_list ? formData.oncall_provider_list : '(On-Call Provider List)'} on call during office closure ${formData.oncall_provider_list ? 'is' : 'are'} the on-call provider${formData.oncall_provider_list && !formData.oncall_provider_list.includes(',') ? '' : 's'} and can be reached at ${formData.oncall_phone_list || '(On-call Phone List)'}.
 
Best Regards,
Steve Brown  
Operations Project Coordinator`;

    setFormData({
      ...formData,
      email_body: template,
      email_subject: `Office Closure - ${formData.holiday_name || 'Holiday'}`
    });
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle>{reminder ? 'Edit Reminder' : 'Create Reminder'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="reminder_name">Reminder Name *</Label>
              <Input
                id="reminder_name"
                value={formData.reminder_name}
                onChange={(e) => setFormData({ ...formData, reminder_name: e.target.value })}
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
                  <SelectItem value="CME Due">CME Due</SelectItem>
                  <SelectItem value="Invoice Due">Invoice Due</SelectItem>
                  <SelectItem value="Custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="send_date">Send Date *</Label>
              <Input
                id="send_date"
                type="date"
                value={formData.send_date}
                onChange={(e) => setFormData({ ...formData, send_date: e.target.value })}
                required
                readOnly={formData.reminder_type === 'Holiday' && formData.closure_date}
                className={formData.reminder_type === 'Holiday' && formData.closure_date ? 'bg-slate-100' : ''}
              />
              <p className="text-xs text-slate-500">
                {formData.reminder_type === 'Holiday' 
                  ? 'Auto-calculated: last working day before closure' 
                  : 'Date when reminder should be sent'}
              </p>
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
                    onChange={(e) => setFormData({ ...formData, frequency_count: parseInt(e.target.value) })}
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

          {formData.reminder_type === 'Holiday' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold text-slate-900">Holiday Closure Details</Label>
                <Button type="button" onClick={useHolidayTemplate} variant="outline" size="sm">
                  Use Template
                </Button>
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="holiday_name">Holiday Name</Label>
                  <Input
                    id="holiday_name"
                    value={formData.holiday_name}
                    onChange={(e) => setFormData({ ...formData, holiday_name: e.target.value })}
                    placeholder="e.g., Thanksgiving"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="closure_date">Closure Date</Label>
                  <Input
                    id="closure_date"
                    type="date"
                    value={formData.closure_date}
                    onChange={(e) => setFormData({ ...formData, closure_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reopen_date">Re-open Date</Label>
                  <Input
                    id="reopen_date"
                    type="date"
                    value={formData.reopen_date}
                    onChange={(e) => setFormData({ ...formData, reopen_date: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="oncall_provider_list">On-Call Provider(s)</Label>
                  <Input
                    id="oncall_provider_list"
                    value={formData.oncall_provider_list}
                    onChange={(e) => setFormData({ ...formData, oncall_provider_list: e.target.value })}
                    placeholder="Dr. John Smith"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="oncall_phone_list">On-Call Phone Number(s)</Label>
                  <Input
                    id="oncall_phone_list"
                    value={formData.oncall_phone_list}
                    onChange={(e) => setFormData({ ...formData, oncall_phone_list: e.target.value })}
                    placeholder="860-123-4567"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email_subject">Email Subject *</Label>
            <Input
              id="email_subject"
              value={formData.email_subject}
              onChange={(e) => setFormData({ ...formData, email_subject: e.target.value })}
              placeholder="e.g., Your medical license expires in 30 days"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email_body">Email Body *</Label>
            <Textarea
              id="email_body"
              value={formData.email_body}
              onChange={(e) => setFormData({ ...formData, email_body: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Additional notes or context for this reminder..."
            />
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-100 p-6 flex justify-end gap-3">
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