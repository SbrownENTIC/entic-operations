
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil } from "lucide-react"; // Added Pencil icon
import { differenceInDays, format, parseISO } from "date-fns";
import PrivilegeForm from "../components/privileges/PrivilegeForm";

export default function ClinicalPrivileges() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingPrivilege, setEditingPrivilege] = useState(null);
  const queryClient = useQueryClient();

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

  const handleSubmit = (data) => {
    if (editingPrivilege) {
      updateMutation.mutate({ id: editingPrivilege.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const privilegesWithProviders = privileges.map(priv => ({
    ...priv,
    provider: providers.find(p => p.id === priv.provider_id),
    daysUntilExpiration: differenceInDays(parseISO(priv.expiration_date), new Date())
  }));

  const filteredPrivileges = privilegesWithProviders.filter(priv =>
    priv.provider?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    priv.facility_name?.toLowerCase().includes(searchTerm.toLowerCase())
    // Removed privilege_type from search criteria
  );

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Clinical Privileges</h1>
            <p className="text-slate-600 mt-1">Track provider privileges at various facilities</p>
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

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search privileges..."
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
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Facility</th>
                    {/* Removed Privilege Type header */}
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Granted</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Expires</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Status</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700">Actions</th> {/* Added Actions header */}
                  </tr>
                </thead>
                <tbody>
                  {filteredPrivileges.map((priv) => {
                    const isExpired = priv.daysUntilExpiration <= 0;
                    const isExpiringSoon = priv.daysUntilExpiration > 0 && priv.daysUntilExpiration <= 30;

                    return (
                      <tr key={priv.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                          <p className="font-medium text-slate-900">{priv.provider?.full_name}</p>
                        </td>
                        <td className="p-4 text-slate-600">{priv.facility_name}</td>
                        {/* Removed Privilege Type data cell */}
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
                        <td className="p-4 text-right"> {/* Added Actions data cell */}
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
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredPrivileges.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No privileges found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
