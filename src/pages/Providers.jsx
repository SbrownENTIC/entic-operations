import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Pencil, Trash2, CheckCircle, XCircle, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown, RefreshCw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, parseISO } from "date-fns";
import ProviderForm from "../components/providers/ProviderForm";
import EmptyState from "@/components/ui/EmptyState";
import { ListPageSkeleton } from "@/components/ui/LoadingSkeletons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { auditCreate, auditUpdate, auditDelete } from '@/lib/auditLogger';

export default function Providers() {
  // Force rebuild timestamp: 2026-01-16
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingProvider, setEditingProvider] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sortField, setSortField] = useState('full_name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [checkingTerminations, setCheckingTerminations] = useState(false);
  const [terminationMessage, setTerminationMessage] = useState('');
  const [selectedProviders, setSelectedProviders] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list('full_name')
  });

  // Automatically check and update terminations when providers load
  React.useEffect(() => {
    if (providers.length > 0) {
      const checkTerminations = async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let updated = false;
        for (const provider of providers) {
          // 1. Check for Terminations
          if (provider.status === 'active' && provider.termination_date) {
            const terminationDate = new Date(provider.termination_date);
            terminationDate.setHours(0, 0, 0, 0);
            
            if (terminationDate <= today) {
              await base44.entities.Provider.update(provider.id, {
                ...provider,
                status: 'inactive',
                flu_vaccine_year: String(provider.flu_vaccine_year || '')
              });
              updated = true;
            }
          }

          // 2. Check for Future Start Dates (Pending)
          if (provider.start_date) {
            const startDate = new Date(provider.start_date);
            startDate.setHours(0, 0, 0, 0);

            // If start date is in future, set to pending (unless already pending)
            // We allow inactive -> pending transition to catch new hires that might have been defaulted to inactive
            if (startDate > today && provider.status !== 'pending') {
               await base44.entities.Provider.update(provider.id, {
                 ...provider,
                 status: 'pending',
                 flu_vaccine_year: String(provider.flu_vaccine_year || '')
               });
               updated = true;
            }

            // If start date arrived, activate pending providers
            if (startDate <= today && provider.status === 'pending') {
               await base44.entities.Provider.update(provider.id, {
                 ...provider,
                 status: 'active',
                 flu_vaccine_year: String(provider.flu_vaccine_year || '')
               });
               updated = true;
            }
          }
        }
        
        if (updated) {
          queryClient.invalidateQueries({ queryKey: ['providers'] });
        }
      };
      
      checkTerminations();
    }
  }, [providers.length, queryClient]);

  // Close form when navigating to root URL (clearing params)
  React.useEffect(() => {
    if (location.search === '' && showForm) {
      setShowForm(false);
      setEditingProvider(null);
    }
  }, [location.search]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Provider.create(data),
    onSuccess: (newProvider, data) => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      setShowForm(false);
      toast({ title: "Success", description: "Provider added successfully." });
      // Non-blocking audit log
      auditCreate('Provider', data).catch(e => console.error('[Audit]', e));
      return newProvider;
    },
    onError: (error) => {
      if (error?.status === 403 || error?.response?.status === 403 || error?.message?.includes('403')) {
        toast({
          variant: "destructive",
          title: "Permission Denied",
          description: "You do not have permission to add new records."
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to add provider: " + error.message
        });
      }
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Provider.update(id, data),
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      setShowForm(false);
      setEditingProvider(null);
      toast({ title: "Success", description: "Provider updated successfully." });
      // Non-blocking audit log — pass editingProvider as the old record snapshot
      auditUpdate('Provider', variables.id, variables.data, editingProvider).catch(e => console.error('[Audit]', e));
    },
    onError: (error) => {
      if (error?.status === 403 || error?.response?.status === 403 || error?.message?.includes('403')) {
        toast({
          variant: "destructive",
          title: "Permission Denied",
          description: "You do not have permission to update records."
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update provider: " + error.message
        });
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Provider.delete(id),
    onSuccess: (result, id) => {
      const snapshot = deleteConfirm;
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      setDeleteConfirm(null);
      toast({ title: "Success", description: "Provider deleted successfully." });
      // Non-blocking audit log
      auditDelete('Provider', id, snapshot).catch(e => console.error('[Audit]', e));
    },
    onError: (error) => {
      if (error?.status === 403 || error?.response?.status === 403 || error?.message?.includes('403')) {
        toast({
          variant: "destructive",
          title: "Permission Denied",
          description: "You do not have permission to delete records."
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to delete provider: " + error.message
        });
      }
    }
  });

  const handleSubmit = async (data) => {
    if (editingProvider) {
      await updateMutation.mutateAsync({ id: editingProvider.id, data });
    } else {
      return await createMutation.mutateAsync(data);
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

  const handleCheckTerminations = async () => {
    setCheckingTerminations(true);
    setTerminationMessage('');
    try {
      const response = await base44.functions.invoke('checkProviderTerminations', {});
      setTerminationMessage(response.data.message);
      queryClient.invalidateQueries({ queryKey: ['providers'] });
    } catch (error) {
      setTerminationMessage('Error checking terminations: ' + error.message);
    } finally {
      setCheckingTerminations(false);
    }
  };

  const handleSyncToAirtable = async () => {
    if (selectedProviders.length === 0) return;
    
    setIsSyncing(true);
    try {
      const response = await base44.functions.invoke('manualSyncProvidersToAirtable', { 
        provider_ids: selectedProviders 
      });
      
      const { success, failed, skipped } = response.data;
      
      if (success.length > 0) {
        toast({
          title: "Sync Complete",
          description: `Successfully synced ${success.length} provider(s) to Airtable.`,
        });
      }
      
      if (failed.length > 0) {
        toast({
          variant: "destructive",
          title: "Sync Issues",
          description: `Failed to sync ${failed.length} provider(s). Check console for details.`,
        });
        console.error("Failed syncs:", failed);
      }

      if (skipped.length > 0) {
        toast({
          variant: "warning",
          title: "Sync Skipped",
          description: `${skipped.length} provider(s) skipped (no matching Airtable record found).`,
        });
      }

      setSelectedProviders([]);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Sync Error",
        description: "Failed to sync providers: " + error.message
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedProviders.length === sortedProviders.length) {
      setSelectedProviders([]);
    } else {
      setSelectedProviders(sortedProviders.map(p => p.id));
    }
  };

  const toggleSelectProvider = (id) => {
    if (selectedProviders.includes(id)) {
      setSelectedProviders(selectedProviders.filter(pId => pId !== id));
    } else {
      setSelectedProviders([...selectedProviders, id]);
    }
  };



  // Calculate current flu season
  const currentFluSeason = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    
    if (month >= 6) { // July onwards
      return `${year}-${year + 1}`;
    } else {
      return `${year - 1}-${year}`;
    }
  }, []);

  const filteredProviders = providers.filter(provider =>
    provider.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    provider.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    provider.role?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    provider.phone_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedProviders = [...filteredProviders].sort((a, b) => {
    let aValue, bValue;
    
    if (sortField === 'flu_vaccine_status') {
      // Sort by flu vaccine status
      const aHasVaccine = a.flu_vaccine_year === currentFluSeason && a.flu_vaccine_date;
      const bHasVaccine = b.flu_vaccine_year === currentFluSeason && b.flu_vaccine_date;
      aValue = aHasVaccine ? 1 : 0;
      bValue = bHasVaccine ? 1 : 0;
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

  if (isLoading) {
    return <ListPageSkeleton />;
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-50">
      <div className="flex-shrink-0 p-2 md:p-3">
        <div className="max-w-7xl mx-auto space-y-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Providers</h1>
            <p className="text-slate-600 text-sm">Manage provider information and credentials</p>
          </div>
          <div className="flex gap-2">
            {selectedProviders.length > 0 && user?.role === 'admin' && (
              <Button
                onClick={handleSyncToAirtable}
                variant="outline"
                className="gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                disabled={isSyncing}
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                Sync to Airtable ({selectedProviders.length})
              </Button>
            )}
            {user?.role === 'admin' && (
              <Button
                onClick={() => {
                  setEditingProvider(null);
                  setShowForm(true);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Provider
              </Button>
            )}
          </div>
        </div>

        {showForm && (
          <ProviderForm
            provider={editingProvider}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingProvider(null);
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
                placeholder="Search providers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md border-slate-200"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden bg-slate-50/50">
            <div className="overflow-auto h-full">
              {/* Mobile Card View */}
              <div className="md:hidden space-y-4 p-4">
                {sortedProviders.map((provider) => {
                  const hasFluVaccine = provider.flu_vaccine_year === currentFluSeason && provider.flu_vaccine_date;
                  const capitalizedStatus = provider.status ? provider.status.charAt(0).toUpperCase() + provider.status.slice(1) : '';
                  
                  return (
                    <div key={provider.id} className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-3">
                      <div className="flex items-start gap-3">
                        {user?.role === 'admin' && (
                          <div className="pt-1">
                            <Checkbox 
                              checked={selectedProviders.includes(provider.id)}
                              onCheckedChange={() => toggleSelectProvider(provider.id)}
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <Link 
                                to={`${createPageUrl("ProviderDetail")}?id=${provider.id}`}
                            className="font-medium text-blue-600 hover:text-blue-800 text-lg"
                          >
                            {provider.full_name}
                          </Link>
                          <div className="text-sm text-slate-500">{provider.role || '-'}</div>
                        </div>
                        <Badge variant={provider.status === 'active' ? 'default' : 'secondary'}>
                          {capitalizedStatus}
                        </Badge>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Email:</span>
                          <span className="text-slate-900 truncate max-w-[200px]">{provider.email}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Start Date:</span>
                          <span className="text-slate-900">
                            {provider.start_date ? format(parseISO(provider.start_date), 'MM-dd-yyyy') : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-100">
                          <span className="text-slate-500">Termination:</span>
                          <span className="text-slate-900">
                            {provider.termination_date ? format(parseISO(provider.termination_date), 'MM-dd-yyyy') : '-'}
                          </span>
                        </div>
                        {provider.role === 'ENT MD' && (
                          <div className="flex justify-between py-1 items-center">
                            <span className="text-slate-500">Flu Vaccine:</span>
                            {hasFluVaccine ? (
                              <div className="flex items-center text-green-600 gap-1">
                                <CheckCircle className="w-4 h-4" />
                                <span>{format(parseISO(provider.flu_vaccine_date), 'MM/dd')}</span>
                              </div>
                            ) : (
                              <div className="flex items-center text-red-600 gap-1">
                                <XCircle className="w-4 h-4" />
                                <span>Missing</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Link to={`${createPageUrl("ProviderDetail")}?id=${provider.id}`}>
                          <Button variant="outline" size="sm" className="h-8">
                            <Eye className="w-4 h-4 mr-1" /> View
                          </Button>
                        </Link>
                        {user?.role === 'admin' && (
                          <>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-8"
                              onClick={() => {
                                setEditingProvider(provider);
                                setShowForm(true);
                              }}
                            >
                              <Pencil className="w-4 h-4 mr-1" /> Edit
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              className="h-8 text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                              onClick={() => setDeleteConfirm(provider)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <table className="w-full hidden md:table bg-white">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 z-10">
                  <tr>
                    {user?.role === 'admin' && (
                      <th className="w-12 p-4 text-left bg-slate-50">
                        <Checkbox 
                          checked={sortedProviders.length > 0 && selectedProviders.length === sortedProviders.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </th>
                    )}
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('full_name')}
                    >
                      Name <SortIcon field="full_name" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('role')}
                    >
                      Role <SortIcon field="role" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('email')}
                    >
                      Email <SortIcon field="email" />
                    </th>
                    <th 
                     className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                     onClick={() => handleSort('phone_number')}
                    >
                     Phone Number <SortIcon field="phone_number" />
                    </th>
                    <th 
                     className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                     onClick={() => handleSort('status')}
                    >
                     Status <SortIcon field="status" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('start_date')}
                    >
                      Start Date <SortIcon field="start_date" />
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">
                      Termination Date
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('flu_vaccine_status')}
                    >
                      Flu Vaccine ({currentFluSeason}) <SortIcon field="flu_vaccine_status" />
                    </th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProviders.map((provider) => {
                    const hasFluVaccine = provider.flu_vaccine_year === currentFluSeason && provider.flu_vaccine_date;
                    const capitalizedStatus = provider.status ? provider.status.charAt(0).toUpperCase() + provider.status.slice(1) : '';
                    
                    return (
                      <tr key={provider.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        {user?.role === 'admin' && (
                          <td className="p-4">
                            <Checkbox 
                              checked={selectedProviders.includes(provider.id)}
                              onCheckedChange={() => toggleSelectProvider(provider.id)}
                            />
                          </td>
                        )}
                        <td className="p-4">
                                  <Link 
                                    to={`${createPageUrl("ProviderDetail")}?id=${provider.id}`}
                                    className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    {provider.full_name}
                                  </Link>
                                </td>
                        <td className="p-4 text-slate-600">{provider.role || '-'}</td>
                        <td className="p-4 text-slate-600">{provider.email}</td>
                        <td className="p-4 text-slate-600">{provider.phone_number || '—'}</td>
                        <td className="p-4">
                          <Badge variant={provider.status === 'active' ? 'default' : 'secondary'}>
                            {capitalizedStatus}
                          </Badge>
                        </td>
                        <td className="p-4 text-slate-600">
                          {provider.start_date ? format(parseISO(provider.start_date), 'MM-dd-yyyy') : '-'}
                        </td>
                        <td className="p-4 text-slate-600">
                          {provider.termination_date ? format(parseISO(provider.termination_date), 'MM-dd-yyyy') : '-'}
                        </td>
                        <td className="p-4">
                          {provider.role === 'ENT MD' ? (
                            <div className="flex items-center gap-2">
                              {hasFluVaccine ? (
                                <>
                                  <CheckCircle className="w-5 h-5 text-green-600" />
                                  <span className="text-sm text-slate-600">
                                    {format(parseISO(provider.flu_vaccine_date), 'MM-dd-yyyy')}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <XCircle className="w-5 h-5 text-red-600" />
                                  <span className="text-sm text-slate-400">Not current</span>
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex gap-2 justify-end">
                            <Link to={`${createPageUrl("ProviderDetail")}?id=${provider.id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                            {user?.role === 'admin' && (
                              <>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => {
                                    setEditingProvider(provider);
                                    setShowForm(true);
                                  }}
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => setDeleteConfirm(provider)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {sortedProviders.length === 0 && (
                <div className="p-4">
                  <EmptyState
                    title="No providers found"
                    description={searchTerm ? "Try adjusting your search terms" : "Get started by adding your first provider"}
                    action={
                      !searchTerm && user?.role === 'admin' && (
                        <Button
                          onClick={() => {
                            setEditingProvider(null);
                            setShowForm(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 mt-4"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Provider
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

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Provider</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteConfirm?.full_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteConfirm.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}