import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function ProviderForm({ provider, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    status: 'active',
    role: '',
    program_locations: [],
    termination_date: '',
    flu_vaccine_year: '',
    flu_vaccine_date: '',
    notes: ''
  });

  const [licenses, setLicenses] = useState([]);
  const [cmeRecords, setCmeRecords] = useState([]);
  const [showLicenses, setShowLicenses] = useState(false);
  const [showCME, setShowCME] = useState(false);

  const { data: programLocations = [] } = useQuery({
    queryKey: ['program-locations'],
    queryFn: () => base44.entities.ProgramLocation.list('program_location')
  });

  const { data: existingLicenses = [] } = useQuery({
    queryKey: ['licenses'],
    queryFn: () => base44.entities.License.list()
  });

  useEffect(() => {
    if (provider) {
      setFormData({
        ...provider,
        program_locations: provider.program_locations || [],
        termination_date: provider.termination_date || '',
        flu_vaccine_year: String(provider.flu_vaccine_year || ''),
        flu_vaccine_date: provider.flu_vaccine_date || ''
      });
    }
  }, [provider]);

  // Calculate flu vaccine year based on date
  const calculateFluVaccineYear = (dateString) => {
    if (!dateString) return '';
    
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11 (0 = January)
    
    // If date is after July (month >= 6, since 6 = July)
    if (month >= 6) {
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  };

  // Handle flu vaccine date change
  const handleFluVaccineDateChange = (dateString) => {
    const yearRange = calculateFluVaccineYear(dateString);
    setFormData({ 
      ...formData, 
      flu_vaccine_date: dateString,
      flu_vaccine_year: yearRange
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clean up formData to ensure flu_vaccine_year is a string or empty
    const cleanedData = {
      ...formData,
      flu_vaccine_year: String(formData.flu_vaccine_year || '')
    };
    
    // First create/update the provider
    const savedProvider = await onSubmit(cleanedData);
    
    // If creating a new provider and we have licenses or CME records
    if (!provider && savedProvider) {
      const providerId = savedProvider.id;
      
      // Create licenses
      for (const license of licenses) {
        const sameLicenseType = existingLicenses.filter(l => l.license_type === license.license_type);
        const nextId = sameLicenseType.length + 1;
        const internalNumber = `${license.license_type}-${String(nextId).padStart(3, '0')}`;
        
        await base44.entities.License.create({
          ...license,
          provider_id: providerId,
          internal_license_number: internalNumber
        });
      }
      
      // Create CME records
      for (const cme of cmeRecords) {
        await base44.entities.CME.create({
          ...cme,
          provider_id: providerId
        });
      }
    }
  };

  const toggleLocation = (locationId) => {
    setFormData(prev => ({
      ...prev,
      program_locations: prev.program_locations.includes(locationId)
        ? prev.program_locations.filter(l => l !== locationId)
        : [...prev.program_locations, locationId]
    }));
  };

  const addLicense = () => {
    setLicenses([...licenses, {
      license_type: 'MED',
      issue_date: '',
      expiration_date: '',
      status: 'active',
      notes: ''
    }]);
  };

  const removeLicense = (index) => {
    setLicenses(licenses.filter((_, i) => i !== index));
  };

  const updateLicense = (index, field, value) => {
    const newLicenses = [...licenses];
    newLicenses[index] = { ...newLicenses[index], [field]: value };
    setLicenses(newLicenses);
  };

  const addCME = () => {
    setCmeRecords([...cmeRecords, {
      course_name: '',
      credits: 0,
      completion_date: '',
      notes: ''
    }]);
  };

  const removeCME = (index) => {
    setCmeRecords(cmeRecords.filter((_, i) => i !== index));
  };

  const updateCME = (index, field, value) => {
    const newCME = [...cmeRecords];
    newCME[index] = { ...newCME[index], [field]: value };
    setCmeRecords(newCME);
  };

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
        <CardContent className="p-6 space-y-6">
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

            <div className="space-y-2">
              <Label htmlFor="termination_date">Termination Date / Last Day of Work</Label>
              <Input
                id="termination_date"
                type="date"
                value={formData.termination_date}
                onChange={(e) => setFormData({ ...formData, termination_date: e.target.value })}
              />
              <p className="text-xs text-slate-500">Provider will automatically become inactive on this date</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="flu_vaccine_date">Flu Vaccine Date</Label>
              <Input
                id="flu_vaccine_date"
                type="date"
                value={formData.flu_vaccine_date}
                onChange={(e) => handleFluVaccineDateChange(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="flu_vaccine_year">Flu Vaccine Year</Label>
              <Input
                id="flu_vaccine_year"
                type="text"
                value={formData.flu_vaccine_year}
                readOnly
                className="bg-slate-50 text-slate-600"
                placeholder="Auto-calculated from date"
              />
              <p className="text-xs text-slate-500">Automatically calculated based on vaccine date</p>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Program/Locations</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border border-slate-200 rounded-lg max-h-64 overflow-y-auto">
                {programLocations.map(location => (
                  <div key={location.id} className="flex items-start space-x-2">
                    <Checkbox
                      id={location.id}
                      checked={formData.program_locations.includes(location.id)}
                      onCheckedChange={() => toggleLocation(location.id)}
                    />
                    <label
                      htmlFor={location.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      <div>{location.program_location}</div>
                      {location.daily_rate > 0 && (
                        <div className="text-xs text-slate-500">${location.daily_rate}/day</div>
                      )}
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

          {!provider && (
            <>
              <Collapsible open={showLicenses} onOpenChange={setShowLicenses}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between">
                    <span>Add Licenses (Optional)</span>
                    {showLicenses ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-4">
                  {licenses.map((license, index) => (
                    <div key={index} className="p-4 border border-slate-200 rounded-lg space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-semibold text-sm">License {index + 1}</h4>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeLicense(index)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>License Type</Label>
                          <Select value={license.license_type} onValueChange={(value) => updateLicense(index, 'license_type', value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MED">MED</SelectItem>
                              <SelectItem value="PA">PA</SelectItem>
                              <SelectItem value="AUD">AUD</SelectItem>
                              <SelectItem value="APRN">APRN</SelectItem>
                              <SelectItem value="DEA">DEA</SelectItem>
                              <SelectItem value="CSP">CSP</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Issue Date</Label>
                          <Input type="date" value={license.issue_date} onChange={(e) => updateLicense(index, 'issue_date', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Expiration Date</Label>
                          <Input type="date" value={license.expiration_date} onChange={(e) => updateLicense(index, 'expiration_date', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addLicense}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add License
                  </Button>
                </CollapsibleContent>
              </Collapsible>

              <Collapsible open={showCME} onOpenChange={setShowCME}>
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="outline" className="w-full justify-between">
                    <span>Add CME Records (Optional)</span>
                    {showCME ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-4 space-y-4">
                  {cmeRecords.map((cme, index) => (
                    <div key={index} className="p-4 border border-slate-200 rounded-lg space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="font-semibold text-sm">CME Record {index + 1}</h4>
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeCME(index)}>
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Course Name</Label>
                          <Input value={cme.course_name} onChange={(e) => updateCME(index, 'course_name', e.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>Credits</Label>
                          <Input type="number" step="0.5" value={cme.credits} onChange={(e) => updateCME(index, 'credits', parseFloat(e.target.value))} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Completion Date</Label>
                          <Input type="date" value={cme.completion_date} onChange={(e) => updateCME(index, 'completion_date', e.target.value)} />
                        </div>
                      </div>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addCME}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add CME Record
                  </Button>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
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