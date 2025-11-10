import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X } from "lucide-react";

export default function LicenseForm({ license, providers, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    provider_id: '',
    license_type: 'MED',
    issuing_state: '',
    issue_date: '',
    expiration_date: '',
    status: 'active',
    document_url: '',
    notes: ''
  });

  useEffect(() => {
    if (license) {
      setFormData(license);
    }
  }, [license]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle>{license ? 'Edit License' : 'Add New License'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="provider_id">Provider *</Label>
              <Select value={formData.provider_id} onValueChange={(value) => setFormData({ ...formData, provider_id: value })}>
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
              <Select value={formData.license_type} onValueChange={(value) => setFormData({ ...formData, license_type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="MED">MED - Medical License</SelectItem>
                  <SelectItem value="PA">PA - Physician Assistant</SelectItem>
                  <SelectItem value="AUD">AUD - Audiology</SelectItem>
                  <SelectItem value="APRN">APRN - Advanced Practice RN</SelectItem>
                  <SelectItem value="DEA">DEA - Drug Enforcement</SelectItem>
                  <SelectItem value="CSP">CSP - Controlled Substance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {license && (
              <div className="space-y-2">
                <Label>Internal License Number</Label>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono text-sm">
                  {license.internal_license_number}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="issuing_state">Issuing State</Label>
              <Input
                id="issuing_state"
                value={formData.issuing_state}
                onChange={(e) => setFormData({ ...formData, issuing_state: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="issue_date">Issue Date</Label>
              <Input
                id="issue_date"
                type="date"
                value={formData.issue_date}
                onChange={(e) => setFormData({ ...formData, issue_date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="expiration_date">Expiration Date *</Label>
              <Input
                id="expiration_date"
                type="date"
                value={formData.expiration_date}
                onChange={(e) => setFormData({ ...formData, expiration_date: e.target.value })}
                required
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
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="pending_renewal">Pending Renewal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="document_url">Document URL</Label>
              <Input
                id="document_url"
                type="url"
                placeholder="https://..."
                value={formData.document_url}
                onChange={(e) => setFormData({ ...formData, document_url: e.target.value })}
              />
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
            {isLoading ? 'Saving...' : license ? 'Update License' : 'Add License'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}