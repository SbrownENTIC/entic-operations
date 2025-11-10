import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X } from "lucide-react";

const PROGRAM_LOCATIONS = [
  "St. Francis",
  "Hartford Healthcare",
  "Yale New Haven",
  "Trinity Health",
  "Connecticut Children's",
  "Other"
];

export default function ProviderForm({ provider, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    status: 'active',
    role: '',
    program_locations: [],
    flu_vaccine_year: new Date().getFullYear(),
    flu_vaccine_date: '',
    notes: ''
  });

  useEffect(() => {
    if (provider) {
      setFormData({
        ...provider,
        program_locations: provider.program_locations || []
      });
    }
  }, [provider]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const toggleLocation = (location) => {
    setFormData(prev => ({
      ...prev,
      program_locations: prev.program_locations.includes(location)
        ? prev.program_locations.filter(l => l !== location)
        : [...prev.program_locations, location]
    }));
  };

  const showFluVaccine = formData.role === 'ENT DM';

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle>{provider ? 'Edit Provider' : 'Add New Provider'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name *</Label>
              <Input
                id="full_name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status *</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="role">Role</Label>
              <Input
                id="role"
                placeholder="e.g., ENT DM, Audiologist, PA"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
              />
            </div>

            {showFluVaccine && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="flu_vaccine_year">Flu Vaccine Year</Label>
                  <Input
                    id="flu_vaccine_year"
                    type="number"
                    value={formData.flu_vaccine_year}
                    onChange={(e) => setFormData({ ...formData, flu_vaccine_year: parseInt(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="flu_vaccine_date">Flu Vaccine Date</Label>
                  <Input
                    id="flu_vaccine_date"
                    type="date"
                    value={formData.flu_vaccine_date}
                    onChange={(e) => setFormData({ ...formData, flu_vaccine_date: e.target.value })}
                  />
                </div>
              </>
            )}

            <div className="space-y-2 md:col-span-2">
              <Label>Program/Locations</Label>
              <div className="grid grid-cols-2 gap-3 p-4 border border-slate-200 rounded-lg">
                {PROGRAM_LOCATIONS.map(location => (
                  <div key={location} className="flex items-center space-x-2">
                    <Checkbox
                      id={location}
                      checked={formData.program_locations.includes(location)}
                      onCheckedChange={() => toggleLocation(location)}
                    />
                    <label
                      htmlFor={location}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {location}
                    </label>
                  </div>
                ))}
              </div>
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
            {isLoading ? 'Saving...' : provider ? 'Update Provider' : 'Add Provider'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}