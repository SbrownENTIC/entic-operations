import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search, AlertCircle, CheckCircle2, Clock, Shield } from "lucide-react";
import { format, parseISO, differenceInDays, isPast, addDays } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ProviderLicensesReport() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: providers = [], isLoading: providersLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  const { data: licenses = [], isLoading: licensesLoading } = useQuery({
    queryKey: ['licenses'],
    queryFn: () => base44.entities.License.list()
  });

  const isLoading = providersLoading || licensesLoading;

  const getStatusColor = (license) => {
    if (!license.expiration_date) return "bg-gray-100 text-gray-800";
    
    const expDate = parseISO(license.expiration_date);
    const today = new Date();
    
    if (isPast(expDate)) {
      return "bg-red-100 text-red-800 border-red-200"; // Expired
    }
    
    const daysUntil = differenceInDays(expDate, today);
    
    if (daysUntil <= 30) {
      return "bg-orange-100 text-orange-800 border-orange-200"; // Expiring very soon
    }
    
    if (daysUntil <= 90) {
      return "bg-yellow-100 text-yellow-800 border-yellow-200"; // Expiring soon
    }
    
    return "bg-green-100 text-green-800 border-green-200"; // Good
  };

  const getStatusLabel = (license) => {
    if (!license.expiration_date) return "Unknown";
    
    const expDate = parseISO(license.expiration_date);
    const today = new Date();
    
    if (isPast(expDate)) return "Expired";
    
    const daysUntil = differenceInDays(expDate, today);
    
    if (daysUntil <= 30) return "Expiring < 30 Days";
    if (daysUntil <= 90) return "Expiring < 90 Days";
    
    return "Active";
  };

  // Process data
  const processedLicenses = licenses
    .map(license => {
      const provider = providers.find(p => p.id === license.provider_id);
      const statusLabel = getStatusLabel(license);
      const daysUntil = license.expiration_date ? differenceInDays(parseISO(license.expiration_date), new Date()) : null;
      
      return {
        ...license,
        provider_name: provider?.full_name || 'Unknown Provider',
        provider_status: provider?.status,
        status_label: statusLabel,
        days_until: daysUntil
      };
    })
    .filter(license => license.provider_status !== 'inactive');

  // Filter data
  const filteredLicenses = processedLicenses.filter(license => {
    const matchesSearch = 
      license.provider_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      license.license_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (license.internal_license_number || '').toLowerCase().includes(searchTerm.toLowerCase());
      
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "expired" && license.status_label === "Expired") ||
      (statusFilter === "expiring_soon" && (license.status_label === "Expiring < 30 Days" || license.status_label === "Expiring < 90 Days")) ||
      (statusFilter === "active" && license.status_label === "Active");
      
    return matchesSearch && matchesStatus;
  });

  const exportToCSV = () => {
    const headers = ['Provider', 'License Type', 'License Number', 'Issue Date', 'Expiration Date', 'Days Until Expiration', 'Status'];
    const rows = filteredLicenses.map(l => [
      l.provider_name,
      l.license_type,
      l.internal_license_number || '',
      l.issue_date || '',
      l.expiration_date || '',
      l.days_until !== null ? l.days_until : '',
      l.status_label
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `provider_licenses_report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Calculate summaries
  const totalLicenses = processedLicenses.length;
  const expiredCount = processedLicenses.filter(l => l.status_label === "Expired").length;
  const expiringSoonCount = processedLicenses.filter(l => l.status_label === "Expiring < 30 Days" || l.status_label === "Expiring < 90 Days").length;
  const activeCount = processedLicenses.filter(l => l.status_label === "Active").length;

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading license data...</div>;
  }

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle>Provider Licenses Report</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Tracking status and expirations for all provider licenses
            </p>
          </div>
          <Button onClick={exportToCSV} className="gap-2">
            <Download className="w-4 h-4" />
            Export to CSV
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-600">Total Licenses</span>
              </div>
              <p className="text-2xl font-bold text-slate-800">{totalLicenses}</p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">Active</span>
              </div>
              <p className="text-2xl font-bold text-green-700">{activeCount}</p>
            </div>

            <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-medium text-orange-700">Expiring Soon</span>
              </div>
              <p className="text-2xl font-bold text-orange-700">{expiringSoonCount}</p>
            </div>

            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-red-600" />
                <span className="text-sm font-medium text-red-700">Expired</span>
              </div>
              <p className="text-2xl font-bold text-red-700">{expiredCount}</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-4 items-center bg-slate-50 p-4 rounded-lg border border-slate-100">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
              <Input
                placeholder="Search by provider, license type, or number..."
                className="pl-9 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-full md:w-64">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="expiring_soon">Expiring Soon (90 Days)</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-3 font-semibold text-slate-700">Provider</th>
                    <th className="text-left p-3 font-semibold text-slate-700">License Type</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Number</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Issue Date</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Expiration</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLicenses.length > 0 ? (
                    filteredLicenses
                      .sort((a, b) => (a.days_until || 9999) - (b.days_until || 9999))
                      .map((license) => (
                      <tr key={license.id} className="hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-900">{license.provider_name}</td>
                        <td className="p-3 text-slate-600">{license.license_type}</td>
                        <td className="p-3 text-slate-600 font-mono text-xs">{license.internal_license_number || '-'}</td>
                        <td className="p-3 text-slate-600">
                          {license.issue_date ? format(parseISO(license.issue_date), 'MMM d, yyyy') : '-'}
                        </td>
                        <td className="p-3 text-slate-600">
                          {license.expiration_date ? (
                            <div className="flex flex-col">
                              <span>{format(parseISO(license.expiration_date), 'MMM d, yyyy')}</span>
                              {license.days_until !== null && (
                                <span className={`text-xs ${license.days_until < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                                  {license.days_until < 0 
                                    ? `${Math.abs(license.days_until)} days ago` 
                                    : `in ${license.days_until} days`}
                                </span>
                              )}
                            </div>
                          ) : '-'}
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className={getStatusColor(license)}>
                            {license.status_label}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" className="p-8 text-center text-slate-500">
                        No licenses found matching your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="text-xs text-slate-500 text-center">
            Showing {filteredLicenses.length} of {processedLicenses.length} total licenses
          </div>
        </div>
      </CardContent>
    </Card>
  );
}