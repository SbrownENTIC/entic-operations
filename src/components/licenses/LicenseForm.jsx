import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";
import { differenceInDays, parseISO } from "date-fns";
import { DatePicker } from "@/components/ui/date-picker";
import { useFormState } from "@/components/FormContext";

const STANDARD_LICENSE_TYPES = [
  "Medical License",
  "Physician Assistant-Certified",
  "Audiologist License",
  "APRN License",
  "DEA License",
  "Controlled Substance Practitioner License"
];

export default function LicenseForm({ license, providers, onSubmit, onCancel, isLoading, isReadOnly }) {
  const { setIsDirty } = useFormState();
  const [formData, setFormData] = useState({
    provider_id: '',
    license_type: '',
    issue_date: '',
    expiration_date: '',
    status: 'active',
    document_url: '',
    notes: ''
  });

  const [selectValue, setSelectValue] = useState("");
  const [customTypeValue, setCustomTypeValue] = useState("");

  useEffect(() => {
    if (license) {
      setFormData(license);
      
      // Determine if it's a standard type or custom
      if (license.license_type && !STANDARD_LICENSE_TYPES.includes(license.license_type)) {
        setSelectValue("Other");
        setCustomTypeValue(license.license_type);
      } else {
        setSelectValue(license.license_type || "");
        setCustomTypeValue("");
      }
    }
  }, [license]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSelectChange = (value) => {
    setSelectValue(value);
    if (value === "Other") {
      setCustomTypeValue("");
      handleChange('license_type', "");
    } else {
      setCustomTypeValue("");
      handleChange('license_type', value);
    }
  };

  const handleCustomTypeChange = (e) => {
    const value = e.target.value;
    setCustomTypeValue(value);
    handleChange('license_type', value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsDirty(false);
    
    // Check if expiration date is more than 90 days away
    const today = new Date();
    const expirationDate = new Date(formData.expiration_date);
    const daysUntil = differenceInDays(expirationDate, today);
    
    // If more than 90 days, reset all reminder flags
    const dataToSubmit = { ...formData };
    if (daysUntil > 90) {
      dataToSubmit.reminder_30_sent = false;
      dataToSubmit.reminder_14_sent = false;
      dataToSubmit.reminder_7_sent = false;
    }
    
    onSubmit(dataToSubmit);
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle>{license ? 'Edit License' : 'Add License'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-6">
          {isReadOnly && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg mb-4">
              <p className="font-medium flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                View Only
              </p>
              <p className="text-sm mt-1">This license record is view-only.</p>
            </div>
          )}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="provider_id">Provider *</Label>
              <Select value={formData.provider_id} onValueChange={(value) => handleChange('provider_id', value)} disabled={isReadOnly}>
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
              <Label htmlFor="license_type">License Type *</Label>
              <Select value={selectValue} onValueChange={handleSelectChange} disabled={isReadOnly}>
                <SelectTrigger>
                  <SelectValue placeholder="Select license type" />
                </SelectTrigger>
                <SelectContent>
                  {STANDARD_LICENSE_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                  <SelectItem value="Other">Other (Enter Custom)</SelectItem>
                </SelectContent>
              </Select>
              
              {selectValue === "Other" && (
                <div className="mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <Label htmlFor="custom_license_type" className="text-xs text-slate-500">Custom License Name</Label>
                  <Input 
                    id="custom_license_type"
                    value={customTypeValue}
                    onChange={handleCustomTypeChange}
                    placeholder="Enter custom license name"
                    className="mt-1"
                    required={selectValue === "Other"}
                  />
                </div>
              )}
            </div>

            {license && (
              <div className="space-y-2">
                <Label htmlFor="internal_license_number">Internal License Number</Label>
                <Input
                  id="internal_license_number"
                  value={license.internal_license_number || ''}
                  disabled
                  className="bg-slate-100"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="issue_date">Issue Date</Label>
              <DatePicker
                value={formData.issue_date}
                onChange={(date) => handleChange('issue_date', date)}
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiration_date">Expiration Date *</Label>
              <DatePicker
                value={formData.expiration_date}
                onChange={(date) => handleChange('expiration_date', date)}
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={formData.status} onValueChange={(value) => handleChange('status', value)} disabled={isReadOnly}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="pending_renewal">Pending Renewal</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="document_url">Document URL</Label>
              <Input
                id="document_url"
                type="url"
                value={formData.document_url}
                onChange={(e) => handleChange('document_url', e.target.value)}
                placeholder="https://..."
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
              disabled={isReadOnly}
            />
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-100 p-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {!isReadOnly && (
            <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
              {isLoading ? 'Saving...' : license ? 'Update License' : 'Add License'}
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}