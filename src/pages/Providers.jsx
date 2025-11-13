import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Pencil, Trash2, CheckCircle, XCircle, AlertCircle, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ProviderForm from "../components/providers/ProviderForm";
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

export default function Providers() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingProvider, setEditingProvider] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sortField, setSortField] = useState('full_name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [checkingTerminations, setCheckingTerminations] = useState(false);
  const [terminationMessage, setTerminationMessage] = useState('');
  const queryClient = useQueryClient();

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list('full_name')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Provider.create(data),
    onSuccess: (newProvider) => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      setShowForm(false);
      return newProvider;
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Provider.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      setShowForm(false);
      setEditingProvider(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Provider.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      setDeleteConfirm(null);
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
    provider.role?.toLowerCase().includes(searchTerm.toLowerCase())
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
    return (
      <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12 text-slate-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Providers</h1>
            <p className="text-slate-600 mt-1">Manage provider information and credentials</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={handleCheckTerminations}
              disabled={checkingTerminations}
              variant="outline"
              className="gap-2"
            >
              <AlertCircle className={`w-4 h-4 ${checkingTerminations ? 'animate-spin' : ''}`} />
              {checkingTerminations ? 'Checking...' : 'Check Terminations'}
            </Button>
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
          </div>
        </div>

        {terminationMessage && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <p className="text-sm text-blue-900">{terminationMessage}</p>
            </CardContent>
          </Card>
        )}

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

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
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
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
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
                      onClick={() => handleSort('status')}
                    >
                      Status <SortIcon field="status" />
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
                    
                    return (
                      <tr key={provider.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-medium text-slate-900">{provider.full_name}</td>
                        <td className="p-4 text-slate-600">{provider.role || '-'}</td>
                        <td className="p-4 text-slate-600">{provider.email}</td>
                        <td className="p-4">
                          <Badge variant={provider.status === 'active' ? 'default' : 'secondary'}>
                            {provider.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-slate-600">
                          {provider.termination_date || '-'}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {hasFluVaccine ? (
                              <>
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <span className="text-sm text-slate-600">{provider.flu_vaccine_date}</span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-5 h-5 text-red-600" />
                                <span className="text-sm text-slate-400">Not current</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex gap-2 justify-end">
                            <Link to={`${createPageUrl("ProviderDetail")}?id=${provider.id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
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
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {sortedProviders.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No providers found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
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