import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import CMEForm from "../components/cme/CMEForm";
import EmptyState from "@/components/ui/EmptyState";
import { ListPageSkeleton } from "@/components/ui/LoadingSkeletons";

export default function CMETracking() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCME, setEditingCME] = useState(null);
  const [sortField, setSortField] = useState('completion_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const queryClient = useQueryClient();

  const { data: cmeRecords = [] } = useQuery({
    queryKey: ['cme'],
    queryFn: () => base44.entities.CME.list('-completion_date')
  });

  const { data: providers = [], isLoading: providersLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CME.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cme'] });
      setShowForm(false);
      setEditingCME(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CME.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cme'] });
      setShowForm(false);
      setEditingCME(null);
    }
  });

  const handleSubmit = (data) => {
    if (editingCME) {
      updateMutation.mutate({ id: editingCME.id, data });
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

  const cmeWithProviders = cmeRecords.map(cme => ({
    ...cme,
    provider: providers.find(p => p.id === cme.provider_id),
    providerName: providers.find(p => p.id === cme.provider_id)?.full_name || ''
  }));

  const filteredCME = cmeWithProviders.filter(cme =>
    cme.provider?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cme.course_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedCME = [...filteredCME].sort((a, b) => {
    let aValue, bValue;
    
    if (sortField === 'providerName') {
      aValue = a.providerName;
      bValue = b.providerName;
    } else if (sortField === 'credits') {
      aValue = a.credits || 0;
      bValue = b.credits || 0;
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    } else if (sortField === 'completion_date') {
      aValue = new Date(a.completion_date);
      bValue = new Date(b.completion_date);
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    } else {
      aValue = a[sortField] || '';
      bValue = b[sortField] || '';
    }
    
    const comparison = aValue.toString().toLowerCase().localeCompare(bValue.toString().toLowerCase());
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const creditsPerProvider = {};
  cmeWithProviders.forEach(cme => {
    const providerId = cme.provider_id;
    if (!creditsPerProvider[providerId]) {
      creditsPerProvider[providerId] = {
        provider: cme.provider,
        totalCredits: 0
      };
    }
    creditsPerProvider[providerId].totalCredits += cme.credits || 0;
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
        <div className="max-w-7xl mx-auto w-full space-y-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">CME Tracking</h1>
            <p className="text-slate-600 text-sm">Track continuing medical education credits</p>
          </div>
          <Button
            onClick={() => {
              setEditingCME(null);
              setShowForm(true);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add CME
          </Button>
        </div>

        {showForm && (
          <CMEForm
            cme={editingCME}
            providers={providers}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingCME(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        )}

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="py-2">
            <h3 className="text-sm font-semibold text-slate-900">Credits by Provider</h3>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="max-h-[120px] overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {Object.values(creditsPerProvider).map(({ provider, totalCredits }) => (
                  <div key={provider?.id} className="p-2 bg-slate-50 rounded border border-slate-200 flex justify-between items-center">
                    <span className="text-xs font-medium text-slate-900 truncate mr-2">{provider?.full_name}</span>
                    <span className="text-sm font-bold text-blue-600 flex-shrink-0">{totalCredits.toFixed(1)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-4 md:px-6 pb-4">
        <div className="max-w-7xl mx-auto w-full h-full">
        <Card className="border-slate-200 shadow-sm h-full flex flex-col">
          <CardHeader className="border-b border-slate-100 flex-shrink-0">
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search CME records..."
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
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('providerName')}
                    >
                      Provider <SortIcon field="providerName" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('course_name')}
                    >
                      Course <SortIcon field="course_name" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('credits')}
                    >
                      Credits <SortIcon field="credits" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('completion_date')}
                    >
                      Completion Date <SortIcon field="completion_date" />
                    </th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700 bg-slate-50">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCME.map((cme) => (
                    <tr key={cme.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <p className="font-medium text-slate-900">{cme.provider?.full_name}</p>
                      </td>
                      <td className="p-4 text-slate-600">{cme.course_name}</td>
                      <td className="p-4">
                        <Badge variant="outline">{cme.credits} credits</Badge>
                      </td>
                      <td className="p-4 text-slate-600">
                        {format(parseISO(cme.completion_date), 'MMM d, yyyy')}
                      </td>
                      <td className="p-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setEditingCME(cme);
                            setShowForm(true);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {sortedCME.length === 0 && (
                <div className="p-4">
                  <EmptyState
                    title="No CME records found"
                    description={searchTerm ? "Try adjusting your search terms" : "Start tracking CME credits for your providers"}
                    action={
                      !searchTerm && (
                        <Button
                          onClick={() => {
                            setEditingCME(null);
                            setShowForm(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 mt-4"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add CME
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