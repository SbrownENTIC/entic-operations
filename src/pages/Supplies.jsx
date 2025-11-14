import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import SupplyForm from "../components/supplies/SupplyForm";

export default function Supplies() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingSupply, setEditingSupply] = useState(null);
  const [sortField, setSortField] = useState('product_name');
  const [sortDirection, setSortDirection] = useState('asc');

  const queryClient = useQueryClient();

  const { data: supplies = [], isLoading } = useQuery({
    queryKey: ['supplies'],
    queryFn: () => base44.entities.Supply.list()
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

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredSupplies = supplies.filter(supply =>
    supply.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supply.item_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supply.units?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedSupplies = [...filteredSupplies].sort((a, b) => {
    let aValue = a[sortField] || '';
    let bValue = b[sortField] || '';
    
    if (sortField === 'unit_price') {
      aValue = parseFloat(aValue) || 0;
      bValue = parseFloat(bValue) || 0;
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
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

  const formatCurrency = (amount) => {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12 text-slate-500">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Supply Catalog</h1>
            <p className="text-slate-600 mt-1">Manage your supply inventory</p>
          </div>
          <Button
            onClick={() => {
              setEditingSupply(null);
              setShowForm(true);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Supply Item
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

        <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-100 space-y-4">
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
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('item_number')}
                    >
                      Item Number <SortIcon field="item_number" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('product_name')}
                    >
                      Product Name <SortIcon field="product_name" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('unit_price')}
                    >
                      Unit Price <SortIcon field="unit_price" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('units')}
                    >
                      Units <SortIcon field="units" />
                    </th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSupplies.map((supply) => (
                    <tr key={supply.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-slate-600">{supply.item_number || '-'}</td>
                      <td className="p-4 font-medium text-slate-900">{supply.product_name}</td>
                      <td className="p-4 text-slate-900 font-medium">
                        {formatCurrency(supply.unit_price || 0)}
                      </td>
                      <td className="p-4 text-slate-600">{supply.units || '-'}</td>
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
              {sortedSupplies.length === 0 && (
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