import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, AlertTriangle, Pencil, ArrowUpDown, ArrowUp, ArrowDown, CloudUpload, RefreshCw, Trash2, BellRing } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { differenceInDays, format, parseISO } from "date-fns";
import { useLocation } from "react-router-dom";
import LicenseForm from "../components/licenses/LicenseForm";
import LicenseReminderStatus from "../components/licenses/LicenseReminderStatus";
import { auditCreate, auditUpdate, auditDelete } from '@/lib/auditLogger';
import EmptyState from "@/components/ui/EmptyState";
import { ListPageSkeleton } from "@/components/ui/LoadingSkeletons";

export default function Licenses() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [editingLicense, setEditingLicense] = useState(null);
  const [sortField, setSortField] = useState('expiration_date');
  const [sortDirection, setSortDirection] = useState('asc');
  const [airtableSyncing, setAirtableSyncing] = useState(false);
  const [airtableMessage, setAirtableMessage] = useState('');
  const [licenseQueueing, setLicenseQueueing] = useState(false);
  const [queueingLicenseId, setQueueingLicenseId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const queryClient = useQueryClient();
  const location = useLocation();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const urlParams = new URLSearchParams(window.location.search);
  const editId = urlParams.get('edit');
  const filterParam = urlParams.get('filter');

  useEffect(() => {
    if (filterParam) {
      setFilterType(filterParam);
    }
  }, [filterParam]);

  const { data: licenses = [] } = useQuery({
    queryKey: ['licenses'],
    queryFn: () => base44.entities.License.list('-expiration_date')
  });

  const { data: providers = [], isLoading: providersLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  const { data: notificationQueue = [] } = useQuery({
    queryKey: ['notification-queue'],
    queryFn: () => base44.entities.NotificationQueue.list('-created_date'),
    refetchInterval: 15000
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
    } else if (location.search === '' && showForm) {
      // Close form when navigating to root URL
      setShowForm(false);
      setEditingLicense(null);
    }
  }, [editId, licenses, location.search]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Generate internal license number
      const sameLicenseType = licenses.filter(l => l.license_type === data.license_type);
      const nextId = sameLicenseType.length + 1;
      const internalNumber = `${data.license_type}-${String(nextId).padStart(3, '0')}`;
      const payload = Object.assign({}, data, { internal_license_number: internalNumber });
      return base44.entities.License.create(payload);
    },
    onSuccess: (newLicense, data) => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      setShowForm(false);
      setEditingLicense(null);
      auditCreate('License', data).catch(e => console.error('[Audit]', e));
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.License.update(id, data),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      setShowForm(false);
      const oldRecord = editingLicense;
      setEditingLicense(null);
      auditUpdate('License', variables.id, variables.data, oldRecord).catch(e => console.error('[Audit]', e));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map(id => base44.entities.License.delete(id)));
    },
    onSuccess: (result, ids) => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      // Capture snapshots before clearing selection
      const deletedSnapshots = licenses.filter(l => ids.includes(l.id));
      setSelectedIds(new Set());
      deletedSnapshots.forEach(snap => {
        auditDelete('License', snap.id, snap).catch(e => console.error('[Audit]', e));
      });
    }
  });

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    
    if (window.confirm(`Are you sure you want to delete ${selectedIds.size} license(s)? This action cannot be undone.`)) {
      deleteMutation.mutate(Array.from(selectedIds));
    }
  };

  const toggleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds(new Set(filteredLicenses.map(l => l.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const toggleSelectOne = (id, checked) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSubmit = (data) => {
    if (editingLicense) {
      updateMutation.mutate({ id: editingLicense.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleQueueLicenseReminders = async () => {
    setLicenseQueueing(true);
    setAirtableMessage('');
    try {
      const response = await base44.functions.invoke('queueLicenseExpirationReminders', {});
      setAirtableMessage(response.data.message);
      queryClient.invalidateQueries({ queryKey: ['notification-queue'] });
    } catch (error) {
      setAirtableMessage('Error queueing license reminders: ' + (error.response?.data?.error || error.message));
    } finally {
      setLicenseQueueing(false);
    }
  };

  const handleQueueSingleLicense = async (license) => {
    setQueueingLicenseId(license.id);
    setAirtableMessage('');
    try {
      const response = await base44.functions.invoke('queueLicenseExpirationReminders', { license_id: license.id, manual: true });
      setAirtableMessage(response.data.message);
      queryClient.invalidateQueries({ queryKey: ['notification-queue'] });
    } catch (error) {
      setAirtableMessage('Error queueing license reminder: ' + (error.response?.data?.error || error.message));
    } finally {
      setQueueingLicenseId(null);
    }
  };

  const handleSyncToAirtable = async () => {
  setAirtableSyncing(true);
  setAirtableMessage('');
  try {
  const response = await base44.functions.invoke('syncLicensesToAirtable', {});

  let msg = response.data.message;

  // Removed debug info as requested


  setAirtableMessage(msg);
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

  const filteredLicenses = licensesWithProviders.filter(license => {
    const matchesSearch = license.provider?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      license.license_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      license.internal_license_number?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // When using an expiring filter (from dashboard link), only show active providers
    const isExpiringFilter = ['expiring_7', 'expiring_14', 'expiring_30', 'expiring_60'].includes(filterType);
    if (isExpiringFilter && license.provider?.status !== 'active') return false;

    if (filterType === 'expiring_7') {
      return license.daysUntilExpiration <= 7 && license.daysUntilExpiration > 0;
    }
    if (filterType === 'expiring_14') {
      return license.daysUntilExpiration <= 14 && license.daysUntilExpiration > 0;
    }
    if (filterType === 'expiring_30') {
      return license.daysUntilExpiration <= 30 && license.daysUntilExpiration > 0;
    }
    if (filterType === 'expiring_60') {
      return license.daysUntilExpiration <= 60 && license.daysUntilExpiration > 0;
    }
    if (filterType === 'expired') {
      return license.daysUntilExpiration <= 0;
    }

    return true;
  });

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
    <div className={`flex flex-col bg-slate-50 ${showForm ? 'min-h-[calc(100vh-9rem)]' : 'h-[calc(100vh-9rem)] overflow-hidden'}`}>
    <div className="flex-shrink-0 p-2 md:p-4">
      <div className="mx-auto space-y-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">License Management</h1>
            <p className="text-slate-600 text-sm">Track provider licenses and expiration dates</p>
          </div>
          <div className="flex gap-3">
            {user?.role === 'admin' && (
              <>
                {selectedIds.size > 0 && (
                  <Button
                    onClick={handleDeleteSelected}
                    variant="destructive"
                    className="gap-2"
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete ({selectedIds.size})
                  </Button>
                )}
                <Button
                  onClick={handleQueueLicenseReminders}
                  disabled={licenseQueueing}
                  variant="outline"
                  className="border-indigo-300 text-indigo-700 hover:bg-indigo-50 gap-2"
                >
                  {licenseQueueing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
                  Queue License Expiration Reminders
                </Button>
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
              </>
            )}
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
            isReadOnly={user?.role !== 'admin'}
          />
        )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-2 md:px-4 pb-4">
        <div className="h-full">
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
                    {user?.role === 'admin' && (
                      <th className="w-12 p-2">
                        <Checkbox 
                          checked={filteredLicenses.length > 0 && selectedIds.size === filteredLicenses.length}
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all"
                        />
                      </th>
                    )}
                    <th 
                      className="text-left p-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('providerName')}
                    >
                      Provider <SortIcon field="providerName" />
                    </th>
                    <th 
                      className="text-left p-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('license_type')}
                    >
                      License Type <SortIcon field="license_type" />
                    </th>
                    <th 
                      className="text-left p-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('internal_license_number')}
                    >
                      Internal # <SortIcon field="internal_license_number" />
                    </th>
                    <th 
                      className="text-left p-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('expiration_date')}
                    >
                      Expiration <SortIcon field="expiration_date" />
                    </th>
                    <th 
                      className="text-left p-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('daysUntilExpiration')}
                    >
                      Days <SortIcon field="daysUntilExpiration" />
                    </th>
                    <th 
                      className="text-left p-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('status')}
                    >
                      Status <SortIcon field="status" />
                    </th>
                    <th className="text-left p-2 text-xs font-semibold text-slate-700">Email</th>
                    <th className="text-left p-2 text-xs font-semibold text-slate-700">Reminder Status</th>
                    <th className="text-right p-2 text-xs font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedLicenses.map((license) => {
                    const isExpired = license.daysUntilExpiration <= 0;
                    const isExpiringSoon = license.daysUntilExpiration > 0 && license.daysUntilExpiration <= 30;

                    return (
                      <tr key={license.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors text-sm">
                         {user?.role === 'admin' && (
                           <td className="p-2">
                             <Checkbox 
                               checked={selectedIds.has(license.id)}
                               onCheckedChange={(checked) => toggleSelectOne(license.id, checked)}
                               aria-label={`Select license for ${license.provider?.full_name}`}
                             />
                           </td>
                         )}
                         <td className="p-2 font-medium text-slate-900 whitespace-nowrap">{license.provider?.full_name}</td>
                         <td className="p-2">
                           <Badge variant="outline" className="font-mono text-xs">{license.license_type}</Badge>
                         </td>
                         <td className="p-2 text-slate-600 font-mono text-xs">{license.internal_license_number}</td>
                         <td className="p-2 text-slate-600 whitespace-nowrap">{format(parseISO(license.expiration_date), 'MMM d')}</td>
                         <td className="p-2">
                           {isExpired ? (
                             <span className="text-red-600 font-medium flex items-center gap-1 whitespace-nowrap">
                               <AlertTriangle className="w-3 h-3" />
                               Expired
                             </span>
                           ) : isExpiringSoon ? (
                             <span className="text-orange-600 font-semibold whitespace-nowrap">{license.daysUntilExpiration}d</span>
                           ) : (
                             <span className="text-slate-600 font-medium whitespace-nowrap">{license.daysUntilExpiration}d</span>
                           )}
                         </td>
                         <td className="p-2">
                           <Badge 
                             variant={isExpired ? "destructive" : isExpiringSoon ? "outline" : "secondary"}
                             className={isExpiringSoon && !isExpired ? "border-orange-300 text-orange-700" : ""}
                           >
                             {isExpired ? 'Expired' : isExpiringSoon ? 'Soon' : 'Active'}
                           </Badge>
                         </td>
                         <td className="p-2 text-slate-600 text-xs max-w-[150px]">
                           <div className="truncate">{license.provider?.work_email || license.provider?.email || '—'}</div>
                         </td>
                         <td className="p-2 min-w-[180px]">
                           <LicenseReminderStatus
                             license={license}
                             notificationQueue={notificationQueue}
                             onQueue={handleQueueSingleLicense}
                             isQueueing={queueingLicenseId === license.id}
                             isAdmin={user?.role === 'admin'}
                           />
                         </td>
                         <td className="p-2 text-right">
                          {user?.role === 'admin' && (
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
                          )}
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