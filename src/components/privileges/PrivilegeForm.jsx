import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Search, Check } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DatePicker } from "@/components/ui/date-picker";

export default function PrivilegeForm({ privilege, providers, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    provider_id: '',
    facility_name: '',
    granted_date: new Date().toISOString().split('T')[0],
    expiration_date: '',
    status: 'active',
    notes: ''
  });
  
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (privilege) {
      setFormData(privilege);
    }
  }, [privilege]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const facilities = [
    "Bloomfield",
    "Hartford Hospital",
    "St. Francis",
    "UConn",
    "Manchester / ECHN",
    "CCMC",
    "CTSC- CT Surgery Center"
  ];

  const selectedProvider = providers.find(p => p.id === formData.provider_id);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle>{privilege ? 'Edit Clinical Privilege' : 'Add Clinical Privilege'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="provider_id">Provider *</Label>
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                  >
                    {selectedProvider ? selectedProvider.full_name : "Select provider..."}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search providers..." />
                    <CommandEmpty>No provider found.</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      {providers.map((provider) => (
                        <CommandItem
                          key={provider.id}
                          value={provider.full_name}
                          onSelect={() => {
                            setFormData({ ...formData, provider_id: provider.id });
                            setOpen(false);
                          }}
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              formData.provider_id === provider.id ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          {provider.full_name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label htmlFor="facility_name">Facility *</Label>
              <Select value={formData.facility_name} onValueChange={(value) => setFormData({ ...formData, facility_name: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select facility" />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map(facility => (
                    <SelectItem key={facility} value={facility}>
                      {facility}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="granted_date">Granted Date *</Label>
              <DatePicker
                value={formData.granted_date}
                onChange={(date) => setFormData({ ...formData, granted_date: date })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiration_date">Expiration Date *</Label>
              <DatePicker
                value={formData.expiration_date}
                onChange={(date) => setFormData({ ...formData, expiration_date: date })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
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
            />
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-100 p-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
            {isLoading ? 'Saving...' : privilege ? 'Update Privilege' : 'Add Privilege'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}