import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, AlertTriangle, Pencil, ArrowUpDown, ArrowUp, ArrowDown, CloudUpload, RefreshCw } from "lucide-react";
import { differenceInDays, format, parseISO } from "date-fns";
import LicenseForm from "../components/licenses/LicenseForm";
import EmptyState from "@/components/ui/EmptyState";
import { ListPageSkeleton } from "@/components/ui/LoadingSkeletons";

export default function Licenses() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingLicense, setEditingLicense] = useState(null);
  const [sortField, setSortField] = useState('expiration_date');
  const [sortDirection, setSortDirection] = useState('asc');
  const [airtableSyncing, setAirtableSyncing] = useState(false);
  const [airtableMessage, setAirtableMessage] = useState('');
  const queryClient = useQueryClient();

  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('edit');

  const { data: licenses = [] } = useQuery({
    queryKey: ['licenses'],
    queryFn: () => base44.entities.License.list('-expiration_date')
  });

  const { data: providers = [], isLoading: providersLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  useEffect(() => {
    if (editId && licenses.length > 0) {
      const licenseToEdit = licenses.find(l => l.id === editId);
      if (licenseToEdit) {
        setEditingLicense(licenseToEdit);
        setShowForm(true);
        // Clear the URL parameter so we don't reopen on refresh/re-render
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [editId, licenses]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Generate internal license number
      const sameLicenseType = licenses.filter(l => l.license_type === data.license_type);
      const nextId = sameLicenseType.length + 1;
      const internalNumber = `${data.license_type}-${String(nextId).padStart(3, '0')}`;
      
      return base44.entities.License.create({
        ...data,
        internal_license_number: internalNumber
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      setShowForm(false);
      setEditingLicense(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.License.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      setShowForm(false);
      setEditingLicense(null);
    }
  });

  const handleSubmit = (data) => {
    if (editingLicense) {
      updateMutation.mutate({ id: editingLicense.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSyncToAirtable = async () => {
    setAirtableSyncing(true);
    setAirtableMessage('');
    try {
      const response = await base44.functions.invoke('syncLicensesToAirtable', {});
      setAirtableMessage(response.data.message);
    } catch (error) {
      const errorMessage = error.response?.data?.error || error.message;
      setAirtableMessage('Error syncing to Airtable: ' + errorMessage);
    } finally {
      setAirtableSyncing(false);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const licensesWithProviders = licenses.map(license => ({
    ...license,
    provider: providers.find(p => p.id === license.provider_id),
    daysUntilExpiration: differenceInDays(parseISO(license.expiration_date), new Date()),
    providerName: providers.find(p => p.id === license.provider_id)?.full_name || ''
  }));

  const filteredLicenses = licensesWithProviders.filter(license =>
    license.provider?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    license.license_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    license.internal_license_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedLicenses = [...filteredLicenses].sort((a, b) => {
    let aValue, bValue;
    
    if (sortField === 'providerName') {
      aValue = a.providerName;
      bValue = b.providerName;
    } else if (sortField === 'daysUntilExpiration') {
      aValue = a.daysUntilExpiration;
      bValue = b.daysUntilExpiration;
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    } else if (sortField === 'expiration_date') {
      aValue = new Date(a.expiration_date);
      bValue = new Date(b.expiration_date);
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    } else {
      aValue = a[sortField] || '';
      bValue = b[sortField] || '';
    }
    
    const comparison = aValue.toString().toLowerCase().localeCompare(bValue.toString().toLowerCase());
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 ml-1 inline" />;
    return sortDirection === 'asc' ? 
      <ArrowUp className="w-4 h-4 ml-1 inline" /> : 
      <ArrowDown className="w-4 h-4 ml-1 inline" />;
  };

  if (providersLoading) {
    return <ListPageSkeleton />;
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-50">
      <div className="flex-shrink-0 p-2 md:p-3">
        <div className="max-w-7xl mx-auto space-y-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">License Management</h1>
            <p className="text-slate-600 text-sm">Track provider licenses and expiration dates</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleSyncToAirtable}
              disabled={airtableSyncing}
              variant="outline"
              className="border-purple-300 text-purple-700 hover:bg-purple-50 gap-2"
            >
              {airtableSyncing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
              Sync to Airtable
            </Button>
            <Button
              onClick={() => {
                setEditingLicense(null);
                setShowForm(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add License
            </Button>
          </div>
        </div>

        {airtableMessage && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="p-4">
              <p className="text-sm text-green-900">{airtableMessage}</p>
            </CardContent>
          </Card>
        )}

        {showForm && (
          <LicenseForm
            license={editingLicense}
            providers={providers}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingLicense(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-4 md:px-6 pb-4">
        <div className="max-w-7xl mx-auto h-full">
        <Card className="border-slate-200 shadow-sm h-full flex flex-col">
          <CardHeader className="border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search licenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md border-slate-200"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="overflow-auto h-full">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('providerName')}
                    >
                      Provider <SortIcon field="providerName" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('license_type')}
                    >
                      License Type <SortIcon field="license_type" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('internal_license_number')}
                    >
                      Internal # <SortIcon field="internal_license_number" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('expiration_date')}
                    >
                      Expiration <SortIcon field="expiration_date" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('daysUntilExpiration')}
                    >
                      Days Until <SortIcon field="daysUntilExpiration" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('status')}
                    >
                      Status <SortIcon field="status" />
                    </th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLicenses.map((license) => {
                    const isExpired = license.daysUntilExpiration <= 0;
                    const isExpiringSoon = license.daysUntilExpiration > 0 && license.daysUntilExpiration <= 30;

                    return (
                      <tr key={license.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                          <p className="font-medium text-slate-900">{license.provider?.full_name}</p>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className="font-mono">
                            {license.license_type}
                          </Badge>
                        </td>
                        <td className="p-4 text-slate-600 font-mono text-sm">{license.internal_license_number}</td>
                        <td className="p-4 text-slate-600">
                          {format(parseISO(license.expiration_date), 'MMM d, yyyy')}
                        </td>
                        <td className="p-4">
                          {isExpired ? (
                            <span className="text-red-600 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4" />
                              Expired
                            </span>
                          ) : isExpiringSoon ? (
                            <span className="text-orange-600 font-semibold">{license.daysUntilExpiration} days</span>
                          ) : (
                            <span className="text-slate-600 font-medium">{license.daysUntilExpiration} days</span>
                          )}
                        </td>
                        <td className="p-4">
                          <Badge 
                            variant={isExpired ? "destructive" : isExpiringSoon ? "outline" : "secondary"}
                            className={isExpiringSoon && !isExpired ? "border-orange-300 text-orange-700" : ""}
                          >
                            {isExpired ? 'Expired' : isExpiringSoon ? 'Expiring Soon' : 'Active'}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setEditingLicense(license);
                              setShowForm(true);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {sortedLicenses.length === 0 && (
                <div className="p-4">
                  <EmptyState
                    title="No licenses found"
                    description={searchTerm ? "Try adjusting your search terms" : "Add license details to track expirations"}
                    action={
                      !searchTerm && (
                        <Button
                          onClick={() => {
                            setEditingLicense(null);
                            setShowForm(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 mt-4"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add License
                        </Button>
                      )
                    }
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  );
}