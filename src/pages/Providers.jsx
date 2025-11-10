import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Pencil, Trash2, Check, X as XIcon } from "lucide-react";
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
  const queryClient = useQueryClient();

  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list('-created_date')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Provider.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      setShowForm(false);
      setEditingProvider(null);
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

  const handleSubmit = (data) => {
    if (editingProvider) {
      updateMutation.mutate({ id: editingProvider.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredProviders = providers.filter(provider =>
    provider.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    provider.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    provider.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const currentYear = new Date().getFullYear();

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Providers</h1>
            <p className="text-slate-600 mt-1">Manage your medical providers</p>
          </div>
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
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Name</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Email</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Phone</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Role</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Status</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Flu Vaccine</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProviders.map((provider) => {
                    const showFluVaccine = provider.role === 'ENT DM';
                    const fluVaccineCurrent = provider.flu_vaccine_year === currentYear;
                    
                    return (
                      <tr key={provider.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                          <p className="font-medium text-slate-900">{provider.full_name}</p>
                        </td>
                        <td className="p-4 text-slate-600">{provider.email}</td>
                        <td className="p-4 text-slate-600">{provider.phone || '-'}</td>
                        <td className="p-4 text-slate-600">{provider.role || '-'}</td>
                        <td className="p-4">
                          <Badge variant={provider.status === 'active' ? 'default' : 'secondary'}>
                            {provider.status}
                          </Badge>
                        </td>
                        <td className="p-4">
                          {showFluVaccine ? (
                            <div className="flex items-center gap-2">
                              {fluVaccineCurrent && provider.flu_vaccine_date ? (
                                <>
                                  <Check className="w-5 h-5 text-green-600" />
                                  <span className="text-sm text-slate-700">{provider.flu_vaccine_date}</span>
                                </>
                              ) : (
                                <>
                                  <XIcon className="w-5 h-5 text-red-600" />
                                  <span className="text-sm text-slate-500">Not current</span>
                                </>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-slate-400">N/A</span>
                          )}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex gap-2 justify-end">
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
                            <Link to={createPageUrl(`ProviderDetail?id=${provider.id}`)}>
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
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
              {filteredProviders.length === 0 && (
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