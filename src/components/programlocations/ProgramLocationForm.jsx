import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

export default function ProgramLocationForm({ location, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    program_location: '',
    program_group: '',
    program_type: 'On-Call',
    daily_rate: 0,
    invoice_counter: 0,
    notes: ''
  });

  useEffect(() => {
    if (location) {
      setFormData(location);
    }
  }, [location]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle>{location ? 'Edit Program Location' : 'Add New Program Location'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="program_location">Program/Location Name *</Label>
              <Input
                id="program_location"
                value={formData.program_location}
                onChange={(e) => setFormData({ ...formData, program_location: e.target.value })}
                placeholder="e.g., Hartford Hospital (On-Call)"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="program_group">Program Group *</Label>
              <Input
                id="program_group"
                value={formData.program_group}
                onChange={(e) => setFormData({ ...formData, program_group: e.target.value })}
                placeholder="e.g., Hartford Hospital"
                required
              />
              <p className="text-xs text-slate-500">
                Group multiple locations together (e.g., all Hartford Hospital locations)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="program_type">Program Type *</Label>
              <Select value={formData.program_type} onValueChange={(value) => setFormData({ ...formData, program_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="On-Call">On-Call</SelectItem>
                  <SelectItem value="Directorship">Directorship</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="daily_rate">Daily Rate ($)</Label>
              <Input
                id="daily_rate"
                type="number"
                step="0.01"
                value={formData.daily_rate}
                onChange={(e) => setFormData({ ...formData, daily_rate: parseFloat(e.target.value) || 0 })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_counter">Invoice Counter</Label>
              <Input
                id="invoice_counter"
                type="number"
                value={formData.invoice_counter}
                onChange={(e) => setFormData({ ...formData, invoice_counter: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-slate-500">
                Used for auto-generating invoice numbers
              </p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-100 p-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
            {isLoading ? 'Saving...' : location ? 'Update Location' : 'Add Location'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}