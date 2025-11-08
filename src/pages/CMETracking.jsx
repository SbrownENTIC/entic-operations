import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import { format, parseISO } from "date-fns";
import CMEForm from "../components/cme/CMEForm";

export default function CMETracking() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingCME, setEditingCME] = useState(null);
  const queryClient = useQueryClient();

  const { data: cmes = [] } = useQuery({
    queryKey: ['cmes'],
    queryFn: () => base44.entities.CME.list('-completion_date')
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.CME.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cmes'] });
      setShowForm(false);
      setEditingCME(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.CME.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cmes'] });
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

  const cmesWithProviders = cmes.map(cme => ({
    ...cme,
    provider: providers.find(p => p.id === cme.provider_id)
  }));

  const filteredCMEs = cmesWithProviders.filter(cme =>
    cme.provider?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cme.course_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cme.provider_organization?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const providerTotals = {};
  cmesWithProviders.forEach(cme => {
    if (cme.provider) {
      providerTotals[cme.provider.full_name] = (providerTotals[cme.provider.full_name] || 0) + (cme.credits || 0);
    }
  });

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">CME Tracking</h1>
            <p className="text-slate-600 mt-1">Track Continuing Medical Education credits</p>
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

        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Object.entries(providerTotals).map(([providerName, total]) => (
            <Card key={providerName} className="border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <p className="text-sm text-slate-600 mb-1">{providerName}</p>
                <p className="text-2xl font-bold text-green-600">{total} <span className="text-sm font-normal text-slate-500">credits</span></p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
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
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Provider</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Course Name</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Credits</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Category</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Completed</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Provider Org</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCMEs.map((cme) => (
                    <tr key={cme.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <p className="font-medium text-slate-900">{cme.provider?.full_name}</p>
                      </td>
                      <td className="p-4 text-slate-600">{cme.course_name}</td>
                      <td className="p-4">
                        <Badge className="bg-green-100 text-green-800">{cme.credits}</Badge>
                      </td>
                      <td className="p-4 text-slate-600">{cme.category}</td>
                      <td className="p-4 text-slate-600">
                        {format(parseISO(cme.completion_date), 'MMM d, yyyy')}
                      </td>
                      <td className="p-4 text-slate-600">{cme.provider_organization || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredCMEs.length === 0 && (
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