import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";

export default function TimeOffForm({ timeOff, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    provider_id: '',
    start_date: '',
    end_date: '',
    type: 'time_off',
    partial_day_end_time: '',
    reason: '',
    status: 'pending',
    notes: ''
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  useEffect(() => {
    if (timeOff) {
      setFormData(timeOff);
    }
  }, [timeOff]);

  // Auto-set end date to start date if not set
  useEffect(() => {
    if (formData.start_date && !formData.end_date) {
      setFormData(prev => ({ ...prev, end_date: formData.start_date }));
    }
  }, [formData.start_date, formData.end_date]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle>{timeOff ? 'Edit Time Off Entry' : 'Add Time Off / CME'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="provider_id">Provider *</Label>
              <Select 
                value={formData.provider_id} 
                onValueChange={(value) => setFormData({ ...formData, provider_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map(provider => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="type">Type *</Label>
              <Select 
                value={formData.type} 
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="time_off">Time off</SelectItem>
                  <SelectItem value="cme">CME</SelectItem>
                  <SelectItem value="partial_day">Partial day</SelectItem>
                  <SelectItem value="holiday">Holiday</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date *</Label>
              <DatePicker
                value={formData.start_date}
                onChange={(date) => setFormData({ ...formData, start_date: date })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">End Date *</Label>
              <DatePicker
                value={formData.end_date}
                onChange={(date) => setFormData({ ...formData, end_date: date })}
              />
            </div>

            {formData.type === 'partial_day' && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="partial_day_end_time">End Time</Label>
                <Input
                  id="partial_day_end_time"
                  type="time"
                  value={formData.partial_day_end_time}
                  onChange={(e) => setFormData({ ...formData, partial_day_end_time: e.target.value })}
                  placeholder="e.g., 12:00 PM"
                />
              </div>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="e.g., Vacation, Conference, MLK Day"
              />
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
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="declined">Declined</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              placeholder="Additional notes or details"
            />
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-100 p-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
            {isLoading ? 'Saving...' : timeOff ? 'Update Entry' : 'Add Entry'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}