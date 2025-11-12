
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
  const [sortField, setSortField] = useState('item_name');
  const [sortDirection, setSortDirection] = useState('asc');
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

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredSupplies = supplies.filter(supply =>
    supply.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supply.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supply.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supply.vendor_item_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedSupplies = [...filteredSupplies].sort((a, b) => {
    let aValue, bValue;
    
    if (sortField === 'current_price') {
      aValue = a.current_price || 0;
      bValue = b.current_price || 0;
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
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('item_name')}
                    >
                      Item Name <SortIcon field="item_name" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('vendor')}
                    >
                      Vendor <SortIcon field="vendor" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('vendor_item_number')}
                    >
                      Vendor Item # <SortIcon field="vendor_item_number" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('description')}
                    >
                      Description <SortIcon field="description" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('current_price')}
                    >
                      Current Price <SortIcon field="current_price" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('unit')}
                    >
                      Unit <SortIcon field="unit" />
                    </th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700 bg-slate-50">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSupplies.map((supply) => (
                    <tr key={supply.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-900">{supply.item_name}</td>
                      <td className="p-4 text-slate-600">{supply.vendor || 'Staples'}</td>
                      <td className="p-4 text-slate-600 font-mono text-sm">{supply.vendor_item_number || '-'}</td>
                      <td className="p-4 text-slate-600">{supply.description || '-'}</td>
                      <td className="p-4 font-medium text-green-600">${supply.current_price?.toFixed(2)}</td>
                      <td className="p-4 text-slate-600">{supply.unit || '-'}</td>
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
