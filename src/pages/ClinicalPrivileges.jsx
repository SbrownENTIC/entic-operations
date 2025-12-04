import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { differenceInDays, format, parseISO } from "date-fns";
import PrivilegeForm from "../components/privileges/PrivilegeForm";
import EmptyState from "@/components/ui/EmptyState";
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

export default function ClinicalPrivileges() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingPrivilege, setEditingPrivilege] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sortField, setSortField] = useState('expiration_date');
  const [sortDirection, setSortDirection] = useState('asc');
  const [filterExpiring, setFilterExpiring] = useState(false);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('filter') === 'expiring_30') {
      setFilterExpiring(true);
    }
  }, []);

  const { data: privileges = [] } = useQuery({
    queryKey: ['privileges'],
    queryFn: () => base44.entities.ClinicalPrivilege.list('-expiration_date')
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ClinicalPrivilege.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['privileges'] });
      setShowForm(false);
      setEditingPrivilege(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ClinicalPrivilege.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['privileges'] });
      setShowForm(false);
      setEditingPrivilege(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ClinicalPrivilege.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['privileges'] });
      setDeleteConfirm(null);
    }
  });

  const handleSubmit = (data) => {
    if (editingPrivilege) {
      updateMutation.mutate({ id: editingPrivilege.id, data });
    } else {
      createMutation.mutate(data);
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

  const privilegesWithProviders = privileges.map(priv => ({
    ...priv,
    provider: providers.find(p => p.id === priv.provider_id),
    daysUntilExpiration: differenceInDays(parseISO(priv.expiration_date), new Date()),
    providerName: providers.find(p => p.id === priv.provider_id)?.full_name || ''
  }));

  const filteredPrivileges = privilegesWithProviders.filter(priv => {
    const matchesSearch = priv.provider?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      priv.facility_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesExpiring = !filterExpiring || (priv.daysUntilExpiration > 0 && priv.daysUntilExpiration <= 30);

    return matchesSearch && matchesExpiring;
  });

  const sortedPrivileges = [...filteredPrivileges].sort((a, b) => {
    let aValue, bValue;
    
    if (sortField === 'providerName') {
      aValue = a.providerName;
      bValue = b.providerName;
    } else if (sortField === 'daysUntilExpiration') {
      aValue = a.daysUntilExpiration;
      bValue = b.daysUntilExpiration;
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    } else if (sortField === 'granted_date' || sortField === 'expiration_date') {
      aValue = new Date(a[sortField]);
      bValue = new Date(b[sortField]);
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

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-slate-50">
      <div className="flex-shrink-0 p-2 md:p-3">
        <div className="max-w-7xl mx-auto space-y-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Clinical Privileges</h1>
            <p className="text-slate-600 text-sm">Track provider privileges at various facilities</p>
          </div>
          <Button
            onClick={() => {
              setEditingPrivilege(null);
              setShowForm(true);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Privilege
          </Button>
        </div>

        {showForm && (
          <PrivilegeForm
            privilege={editingPrivilege}
            providers={providers}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingPrivilege(null);
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
                placeholder="Search privileges..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md border-slate-200"
              />
              {filterExpiring && (
                <Button 
                  variant="secondary" 
                  onClick={() => {
                    setFilterExpiring(false);
                    window.history.replaceState({}, '', window.location.pathname);
                  }}
                  className="bg-orange-100 text-orange-800 hover:bg-orange-200"
                >
                  expiring soon x
                </Button>
              )}
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
                      onClick={() => handleSort('facility_name')}
                    >
                      Facility <SortIcon field="facility_name" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('granted_date')}
                    >
                      Granted <SortIcon field="granted_date" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('expiration_date')}
                    >
                      Expires <SortIcon field="expiration_date" />
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
                  {sortedPrivileges.map((priv) => {
                    const isExpired = priv.daysUntilExpiration <= 0;
                    const isExpiringSoon = priv.daysUntilExpiration > 0 && priv.daysUntilExpiration <= 30;

                    return (
                      <tr key={priv.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                          <p className="font-medium text-slate-900">{priv.provider?.full_name}</p>
                        </td>
                        <td className="p-4 text-slate-600">{priv.facility_name}</td>
                        <td className="p-4 text-slate-600">
                          {format(parseISO(priv.granted_date), 'MMM d, yyyy')}
                        </td>
                        <td className="p-4 text-slate-600">
                          {format(parseISO(priv.expiration_date), 'MMM d, yyyy')}
                        </td>
                        <td className="p-4">
                          <Badge 
                            variant={isExpired ? "destructive" : isExpiringSoon ? "outline" : "secondary"}
                            className={isExpiringSoon && !isExpired ? "border-orange-300 text-orange-700" : ""}
                          >
                            {isExpired ? 'Expired' : isExpiringSoon ? `${priv.daysUntilExpiration}d` : 'Active'}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex gap-2 justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setEditingPrivilege(priv);
                                setShowForm(true);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setDeleteConfirm(priv)}
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
              {sortedPrivileges.length === 0 && (
                <div className="p-4">
                  <EmptyState
                    title="No privileges found"
                    description={searchTerm ? "Try adjusting your search terms" : "Track clinical privileges for your providers"}
                    action={
                      !searchTerm && (
                        <Button
                          onClick={() => {
                            setEditingPrivilege(null);
                            setShowForm(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 mt-4"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Privilege
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
            <AlertDialogTitle>Delete Clinical Privilege</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the privilege for {deleteConfirm?.provider?.full_name} at {deleteConfirm?.facility_name}? This action cannot be undone.
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