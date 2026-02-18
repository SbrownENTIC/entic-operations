import React, { useState } from 'react';
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";
import { format } from 'date-fns';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ReportingPeriodDetailModal({ open, onOpenChange, period, onRefresh }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState(period || {});
  const [errors, setErrors] = useState({});
  const { toast } = useToast();

  React.useEffect(() => {
    setFormData(period || {});
    setIsEditing(false);
    setErrors({});
  }, [period, open]);

  // Validate date is valid calendar date
  const isValidDate = (dateStr) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getFullYear() === year && 
           date.getMonth() === month - 1 && 
           date.getDate() === day;
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    // Validate dates
    const newErrors = {};
    
    if (!isValidDate(formData.reporting_period_start)) {
      newErrors.start = "Invalid calendar date";
    }
    if (!isValidDate(formData.reporting_period_end)) {
      newErrors.end = "Invalid calendar date";
    }
    
    const startDate = new Date(formData.reporting_period_start);
    const endDate = new Date(formData.reporting_period_end);
    if (startDate > endDate) {
      newErrors.date = "Start date must be before end date";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      // When manually edited, set period_detection_type to "manual"
      const updateData = {
        reporting_period_start: formData.reporting_period_start,
        reporting_period_end: formData.reporting_period_end,
        period_detection_type: "manual"
      };

      await base44.entities.CallLogPeriod.update(formData.id, updateData);
      
      toast({
        title: "Success",
        description: "Reporting period updated successfully. Detection type set to manual."
      });
      
      setIsEditing(false);
      setErrors({});
      onRefresh?.();
      onOpenChange(false);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to update period."
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!period) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reporting Period Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Period Start */}
          <div className="space-y-2">
            <Label className="font-semibold">Period Start</Label>
            {isEditing ? (
              <>
                <Input
                  type="date"
                  value={formData.reporting_period_start || ''}
                  onChange={(e) => handleChange('reporting_period_start', e.target.value)}
                />
                {errors.start && <p className="text-xs text-red-600">{errors.start}</p>}
              </>
            ) : (
              <div className="p-2 bg-slate-50 rounded text-sm">
                {formData.reporting_period_start || '-'}
              </div>
            )}
          </div>

          {/* Period End */}
          <div className="space-y-2">
            <Label className="font-semibold">Period End</Label>
            {isEditing ? (
              <>
                <Input
                  type="date"
                  value={formData.reporting_period_end || ''}
                  onChange={(e) => handleChange('reporting_period_end', e.target.value)}
                />
                {errors.end && <p className="text-xs text-red-600">{errors.end}</p>}
              </>
            ) : (
              <div className="p-2 bg-slate-50 rounded text-sm">
                {formData.reporting_period_end || '-'}
              </div>
            )}
          </div>

          {errors.date && <p className="text-xs text-red-600">{errors.date}</p>}

          {/* Upload Date (read-only) */}
          <div className="space-y-2">
            <Label className="font-semibold">Upload Date</Label>
            <div className="p-2 bg-slate-50 rounded text-sm text-slate-600">
              {formData.uploaded_at ? format(new Date(formData.uploaded_at), 'MMMM d, yyyy HH:mm') : '-'}
            </div>
          </div>

          {/* Uploaded By (read-only) */}
          <div className="space-y-2">
            <Label className="font-semibold">Uploaded By</Label>
            <div className="p-2 bg-slate-50 rounded text-sm text-slate-600">
              {formData.uploaded_by || '-'}
            </div>
          </div>

          {/* Source File Name (read-only) */}
          <div className="space-y-2">
            <Label className="font-semibold">Source File</Label>
            <div className="p-2 bg-slate-50 rounded text-sm text-slate-600 truncate">
              {formData.source_file_name || '-'}
            </div>
          </div>

          {/* Detection Type (read-only) */}
          <div className="space-y-2">
            <Label className="font-semibold">Detection Type</Label>
            <div className="p-2 bg-slate-50 rounded text-sm">
              {formData.period_detection_type === 'manual' ? 'Manual (locked)' : 'Auto-Detected'}
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 gap-2 p-3 bg-blue-50 rounded text-sm">
            <div>
              <div className="font-semibold text-blue-900">{formData.total_calls || 0}</div>
              <div className="text-xs text-blue-700">Total Calls</div>
            </div>
            <div>
              <div className="font-semibold text-blue-900">{formData.answered_calls || 0}</div>
              <div className="text-xs text-blue-700">Answered</div>
            </div>
            <div>
              <div className="font-semibold text-blue-900">{formData.missed_calls || 0}</div>
              <div className="text-xs text-blue-700">Missed</div>
            </div>
            <div>
              <div className="font-semibold text-blue-900">{((formData.answer_rate_percent || 0).toFixed(1))}%</div>
              <div className="text-xs text-blue-700">Answer Rate</div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          {!isEditing ? (
            <Button onClick={() => setIsEditing(true)}>
              Edit Period
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}