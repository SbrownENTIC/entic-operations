import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, ArrowUpDown, ArrowUp, ArrowDown, Trash2, CheckSquare, Upload, FileSpreadsheet } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
import SupplyForm from "../components/supplies/SupplyForm";


export default function ClinicalSupplyCatalog() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingSupply, setEditingSupply] = useState(null);
  const [sortField, setSortField] = useState('item_number');
  const [sortDirection, setSortDirection] = useState('asc');
  const [deletingSupply, setDeletingSupply] = useState(null);
  const [initializing, setInitializing] = useState(false);
  const [initMessage, setInitMessage] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const fileInputRef = React.useRef(null);

  const queryClient = useQueryClient();

  const { data: supplies = [], isLoading } = useQuery({
    queryKey: ['supplies', 'clinical'],
    queryFn: () => base44.entities.Supply.filter({ category: 'clinical' })
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Supply.create({ ...data, category: 'clinical' }),
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

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Supply.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplies'] });
      setDeletingSupply(null);
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      await Promise.all(ids.map(id => base44.entities.Supply.delete(id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplies'] });
      setIsBulkDeleting(false);
      setSelectedItems([]);
    }
  });

  const handleSubmit = (data) => {
    if (editingSupply) {
      updateMutation.mutate({ id: editingSupply.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setInitializing(true);
    setInitMessage('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target.result;
      try {
        const response = await base44.functions.invoke('importClinicalSupplies', { csvContent: text });
        setInitMessage(response.data.message);
        if (response.data.errors) {
           console.error("Import errors:", response.data.errors);
           setInitMessage(prev => prev + ` (${response.data.errors.length} errors)`);
        }
        queryClient.invalidateQueries({ queryKey: ['supplies'] });
      } catch (error) {
        setInitMessage('Error importing CSV: ' + (error.response?.data?.error || error.message));
      } finally {
        setInitializing(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
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
    supply.codes?.toLowerCase().includes(searchTerm.toLowerCase())
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

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedItems(filteredSupplies.map(s => s.id));
    } else {
      setSelectedItems([]);
    }
  };

  const handleSelectItem = (id, checked) => {
    if (checked) {
      setSelectedItems(prev => [...prev, id]);
    } else {
      setSelectedItems(prev => prev.filter(item => item !== id));
    }
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
    <>
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="flex-shrink-0 p-2 md:p-3">
        <div className="max-w-7xl mx-auto space-y-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Clinical Supply Catalog</h1>
            <p className="text-slate-600 text-sm">View item codes, descriptions, and prices</p>
          </div>
          <div className="flex gap-2">
            {selectedItems.length > 0 && (
              <Button
                variant="destructive"
                onClick={() => setIsBulkDeleting(true)}
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Selected ({selectedItems.length})
              </Button>
            )}
              <div className="relative">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept=".csv"
                  className="hidden"
                />
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={initializing}
                  variant="outline"
                  className="border-green-600 text-green-600 hover:bg-green-50"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {initializing ? 'Importing...' : 'Import CSV'}
                </Button>
              </div>
            <Button
              onClick={() => {
                setEditingSupply(null);
                setShowForm(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Item
            </Button>
          </div>
        </div>

        {initMessage && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <p className="text-sm text-blue-900">{initMessage}</p>
            </CardContent>
          </Card>
        )}

        {showForm && (
          <SupplyForm
            supply={editingSupply}
            supplies={supplies}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingSupply(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-4 md:px-6 pb-4">
        <div className="max-w-7xl mx-auto h-full">
        <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm h-full flex flex-col">
          <CardHeader className="border-b border-slate-100 space-y-4 flex-shrink-0">
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search by item code, description, or codes..."
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
                    <th className="p-4 w-[50px]">
                      <Checkbox 
                        checked={filteredSupplies.length > 0 && selectedItems.length === filteredSupplies.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('item_number')}
                    >
                      Item Code <SortIcon field="item_number" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('product_name')}
                    >
                      Descriptions <SortIcon field="product_name" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('codes')}
                    >
                      Codes <SortIcon field="codes" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('unit_price')}
                    >
                      Unit Price <SortIcon field="unit_price" />
                    </th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedSupplies.map((supply) => (
                    <tr key={supply.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <Checkbox 
                          checked={selectedItems.includes(supply.id)}
                          onCheckedChange={(checked) => handleSelectItem(supply.id, checked)}
                        />
                      </td>
                      <td className="p-4 text-slate-600">{supply.item_number || '-'}</td>
                      <td className="p-4 font-medium text-slate-900">{supply.product_name}</td>
                      <td className="p-4 text-slate-600">{supply.codes || '-'}</td>
                      <td className="p-4 text-slate-900 font-medium">
                        {formatCurrency(supply.unit_price || 0)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-1">
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
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setDeletingSupply(supply)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
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
    </div>

      <AlertDialog open={!!deletingSupply} onOpenChange={() => setDeletingSupply(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supply Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingSupply?.product_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deletingSupply.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isBulkDeleting} onOpenChange={setIsBulkDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Multiple Items</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedItems.length} selected items? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bulkDeleteMutation.mutate(selectedItems)}
              className="bg-red-600 hover:bg-red-700"
            >
              {bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete All Selected'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}