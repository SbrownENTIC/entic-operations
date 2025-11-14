
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

  const { data: providers = [] } = useQuery({
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

  return (
    <div className="p-6 md:p-8 bg-slate-50 h-screen flex flex-col">
      <div className="max-w-7xl mx-auto w-full flex flex-col flex-1 gap-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">CME Tracking</h1>
            <p className="text-slate-600 mt-1">Track continuing medical education credits</p>
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
          <CardHeader>
            <h3 className="text-lg font-semibold text-slate-900">Credits by Provider</h3>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.values(creditsPerProvider).map(({ provider, totalCredits }) => (
                <div key={provider?.id} className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <p className="font-medium text-slate-900">{provider?.full_name}</p>
                  <p className="text-2xl font-bold text-blue-600 mt-2">{totalCredits.toFixed(1)} credits}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm flex flex-col flex-1 min-h-0">
          <CardHeader className="border-b border-slate-100 flex-none">
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
                <div className="text-center py-12 text-slate-500">
                  No CME records found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
