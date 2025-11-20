import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Pencil, ArrowUpDown, ArrowUp, ArrowDown, Upload, Image as ImageIcon, Download, Trash2 } from "lucide-react";
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

export default function Supplies() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingSupply, setEditingSupply] = useState(null);
  const [sortField, setSortField] = useState('item_number');
  const [sortDirection, setSortDirection] = useState('asc');
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [deletingSupply, setDeletingSupply] = useState(null);

  // Check URL parameters for search term
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const search = params.get('search');
    if (search) {
      setSearchTerm(search);
    }
  }, []);

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

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Supply.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplies'] });
      setDeletingSupply(null);
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
    const file = event.target.files[0];
    if (!file) return;

    setImporting(true);
    setImportMessage('');

    try {
      // Upload the file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Import the supplies
      const response = await base44.functions.invoke('importSuppliesWithImages', { file_url });

      setImportMessage(response.data.message);
      queryClient.invalidateQueries({ queryKey: ['supplies'] });
    } catch (error) {
      const errorDetails = error.response?.data?.details || error.response?.data?.error || error.message;
      setImportMessage('Error importing file: ' + errorDetails);
    } finally {
      setImporting(false);
      event.target.value = '';
    }
  };

  const handleExport = () => {
    const rows = [
      ['Item Number', 'Product Name', 'Vendor', 'Unit Price', 'Units', 'Image URL']
    ];

    supplies.forEach(supply => {
      rows.push([
        supply.item_number || '',
        supply.product_name || '',
        supply.vendor || '',
        supply.unit_price || '',
        supply.units || '',
        supply.image_url || ''
      ]);
    });

    const csvContent = rows.map(row => 
      row.map(cell => {
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return '"' + cellStr.replace(/"/g, '""') + '"';
        }
        return cellStr;
      }).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `supply_catalog_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    supply.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
    
    if (sortField === 'item_number') {
      // Try to parse as numbers for proper numeric sorting
      const aNum = parseFloat(aValue);
      const bNum = parseFloat(bValue);
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }
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
    <>
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="flex-shrink-0 p-6 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Supply Catalog</h1>
            <p className="text-slate-600 mt-1">Manage your supply inventory</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleExport}
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                className="hidden"
                disabled={importing}
              />
              <Button
                type="button"
                variant="outline"
                disabled={importing}
                onClick={(e) => e.currentTarget.previousElementSibling.click()}
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <Upload className="w-4 h-4 mr-2" />
                {importing ? 'Importing...' : 'Import Excel'}
              </Button>
            </label>
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
        </div>

        {importMessage && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <p className="text-sm text-blue-900">{importMessage}</p>
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

      <div className="flex-1 overflow-hidden px-6 md:px-8 pb-6">
        <div className="max-w-7xl mx-auto h-full">
        <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm h-full flex flex-col">
          <CardHeader className="border-b border-slate-100 space-y-4 flex-shrink-0">
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
          <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="overflow-auto h-full">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700 w-20">
                      Image
                    </th>
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
                      onClick={() => handleSort('vendor')}
                    >
                      Vendor <SortIcon field="vendor" />
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
                      <td className="p-4">
                        {supply.image_url ? (
                          <img 
                            src={supply.image_url} 
                            alt={supply.product_name}
                            className="w-16 h-16 object-contain rounded border border-slate-200"
                          />
                        ) : (
                          <div className="w-16 h-16 bg-slate-100 rounded border border-slate-200 flex items-center justify-center">
                            <ImageIcon className="w-6 h-6 text-slate-400" />
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-slate-600">{supply.item_number || '-'}</td>
                      <td className="p-4 font-medium text-slate-900">{supply.product_name}</td>
                      <td className="p-4 text-slate-600">{supply.vendor || '-'}</td>
                      <td className="p-4 text-slate-900 font-medium">
                        {formatCurrency(supply.unit_price || 0)}
                      </td>
                      <td className="p-4 text-slate-600">{supply.units || '-'}</td>
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
  );
}