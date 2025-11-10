import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil } from "lucide-react";
import SupplyForm from "../components/supplies/SupplyForm";

export default function Supplies() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingSupply, setEditingSupply] = useState(null);
  const queryClient = useQueryClient();

  const { data: supplies = [] } = useQuery({
    queryKey: ['supplies'],
    queryFn: () => base44.entities.Supply.list('item_name')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Supply.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplies'] });
      setShowForm(false);
      setEditingSupply(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Supply.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplies'] });
      setShowForm(false);
      setEditingSupply(null);
    }
  });

  const handleSubmit = (data) => {
    if (editingSupply) {
      updateMutation.mutate({ id: editingSupply.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredSupplies = supplies.filter(supply =>
    supply.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supply.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supply.supplier?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Supply Catalog</h1>
            <p className="text-slate-600 mt-1">Manage supply items and pricing</p>
          </div>
          <Button
            onClick={() => {
              setEditingSupply(null);
              setShowForm(true);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Supply
          </Button>
        </div>

        {showForm && (
          <SupplyForm
            supply={editingSupply}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingSupply(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        )}

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search supplies..."
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
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Item Name</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Description</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Current Price</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Unit</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Supplier</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSupplies.map((supply) => (
                    <tr key={supply.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-900">{supply.item_name}</td>
                      <td className="p-4 text-slate-600">{supply.description || '-'}</td>
                      <td className="p-4 font-medium text-green-600">${supply.current_price?.toFixed(2)}</td>
                      <td className="p-4 text-slate-600">{supply.unit || '-'}</td>
                      <td className="p-4 text-slate-600">{supply.supplier || '-'}</td>
                      <td className="p-4 text-right">
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            setEditingSupply(supply);
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
              {filteredSupplies.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No supplies found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}