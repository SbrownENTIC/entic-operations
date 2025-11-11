import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Pencil, Trash2, FileText, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import OutsideIncomeForm from "../components/income/OutsideIncomeForm";
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

export default function OutsideIncome() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingIncome, setEditingIncome] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [selectedIncomes, setSelectedIncomes] = useState([]);
  const [sortField, setSortField] = useState('created_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: incomes = [], isLoading: incomesLoading } = useQuery({
    queryKey: ['outside-income'],
    queryFn: () => base44.entities.OutsideIncome.list('-created_date')
  });

  const { data: providers = [], isLoading: providersLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  const { data: programLocations = [], isLoading: locationsLoading } = useQuery({
    queryKey: ['program-locations'],
    queryFn: () => base44.entities.ProgramLocation.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.OutsideIncome.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outside-income'] });
      setShowForm(false);
      setEditingIncome(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.OutsideIncome.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outside-income'] });
      setShowForm(false);
      setEditingIncome(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.OutsideIncome.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outside-income'] });
      setDeleteConfirm(null);
    }
  });

  const handleSubmit = (data) => {
    if (editingIncome) {
      updateMutation.mutate({ id: editingIncome.id, data });
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

  const toggleSelection = (incomeId) => {
    setSelectedIncomes(prev => 
      prev.includes(incomeId) 
        ? prev.filter(id => id !== incomeId)
        : [...prev, incomeId]
    );
  };

  const createInvoiceFromSelected = () => {
    if (selectedIncomes.length === 0) return;
    const incomeIds = selectedIncomes.join(',');
    navigate(`${createPageUrl('Invoices')}?create=true&incomes=${incomeIds}`);
  };

  // Format currency with commas
  const formatCurrency = (amount) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Format numbers with decimals
  const formatNumber = (num) => {
    return (num || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Check if income is Hartford Hospital RVU-based (exclude Directorship)
  const isHartfordHospitalRVU = (income) => {
    const location = programLocations.find(pl => pl.id === income.program_location_id);
    
    if (location) {
      const isHartford = location.program_group?.toLowerCase().includes('hartford hospital');
      const isDirectorship = location.program_type === 'Directorship';
      return isHartford && !isDirectorship;
    }
    
    // Fallback to facility name
    const isHartford = income.facility_name?.toLowerCase().includes('hartford hospital');
    const isDirectorship = income.facility_name?.toLowerCase().includes('directorship');
    return isHartford && !isDirectorship;
  };

  // Check if income is a Directorship program
  const isDirectorship = (income) => {
    const location = programLocations.find(pl => pl.id === income.program_location_id);
    return location?.program_type === 'Directorship';
  };

  // Wait for data to load before processing
  const isLoading = incomesLoading || providersLoading || locationsLoading;

  const incomesWithProviders = isLoading ? [] : incomes.map(income => {
    const location = programLocations.find(pl => pl.id === income.program_location_id);
    return {
      ...income,
      provider: providers.find(p => p.id === income.provider_id),
      providerName: providers.find(p => p.id === income.provider_id)?.full_name || '',
      isHartfordRVU: isHartfordHospitalRVU(income),
      isDirectorship: isDirectorship(income),
      programLocation: location
    };
  });

  const filteredIncomes = incomesWithProviders.filter(income =>
    income.provider?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    income.facility_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedIncomes = [...filteredIncomes].sort((a, b) => {
    let aValue, bValue;
    
    if (sortField === 'providerName') {
      aValue = a.providerName;
      bValue = b.providerName;
    } else if (sortField === 'days_worked' || sortField === 'total_rvus' || sortField === 'rate' || sortField === 'total_amount') {
      aValue = a[sortField] || 0;
      bValue = b[sortField] || 0;
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    } else if (sortField === 'created_date') {
      aValue = new Date(a.created_date);
      bValue = new Date(b.created_date);
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

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    invoiced: "bg-blue-100 text-blue-800",
    paid: "bg-green-100 text-green-800"
  };

  const pendingIncomes = sortedIncomes.filter(income => income.status === 'pending');
  const canCreateInvoice = selectedIncomes.length > 0 && 
    selectedIncomes.every(id => {
      const income = incomes.find(inc => inc.id === id);
      return income && income.status === 'pending';
    });

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Outside Income</h1>
            <p className="text-slate-600 mt-1">Track work performed at external facilities</p>
          </div>
          <div className="flex gap-3">
            {selectedIncomes.length > 0 && (
              <Button
                onClick={createInvoiceFromSelected}
                disabled={!canCreateInvoice}
                variant="outline"
                className="border-blue-600 text-blue-600 hover:bg-blue-50"
              >
                <FileText className="w-4 h-4 mr-2" />
                Create Invoice ({selectedIncomes.length})
              </Button>
            )}
            <Button
              onClick={() => {
                setEditingIncome(null);
                setShowForm(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={providersLoading}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Income
            </Button>
          </div>
        </div>

        {showForm && !providersLoading && (
          <OutsideIncomeForm
            income={editingIncome}
            providers={providers}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingIncome(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        )}

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search outside income..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md border-slate-200"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="text-center py-12 text-slate-500">Loading...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left p-4 text-sm font-semibold text-slate-700 w-12">
                        {pendingIncomes.length > 0 && (
                          <Checkbox
                            checked={pendingIncomes.every(inc => selectedIncomes.includes(inc.id))}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedIncomes(pendingIncomes.map(inc => inc.id));
                              } else {
                                setSelectedIncomes([]);
                              }
                            }}
                          />
                        )}
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('providerName')}
                      >
                        Provider <SortIcon field="providerName" />
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('facility_name')}
                      >
                        Facility <SortIcon field="facility_name" />
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('days_worked')}
                      >
                        Days/RVUs <SortIcon field="days_worked" />
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('rate')}
                      >
                        Rate <SortIcon field="rate" />
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('total_amount')}
                      >
                        Total <SortIcon field="total_amount" />
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('status')}
                      >
                        Status <SortIcon field="status" />
                      </th>
                      <th className="text-right p-4 text-sm font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedIncomes.map((income) => (
                      <tr key={income.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                          {income.status === 'pending' && (
                            <Checkbox
                              checked={selectedIncomes.includes(income.id)}
                              onCheckedChange={() => toggleSelection(income.id)}
                            />
                          )}
                        </td>
                        <td className="p-4 font-medium text-slate-900">
                          {income.provider?.full_name || '-'}
                        </td>
                        <td className="p-4 text-slate-600">{income.facility_name || '-'}</td>
                        <td className="p-4 text-slate-600 font-medium">
                          {income.isHartfordRVU ? (
                            <span className="text-blue-600">{formatNumber(income.total_rvus)} RVUs</span>
                          ) : income.isDirectorship ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            <span>{income.days_worked || 0} days</span>
                          )}
                        </td>
                        <td className="p-4 text-slate-600">
                          ${formatCurrency(income.rate || 0)}
                          {income.isHartfordRVU ? (
                            <span className="text-xs text-slate-500">/RVU</span>
                          ) : income.isDirectorship ? (
                            <span className="text-xs text-slate-500">/month</span>
                          ) : null}
                        </td>
                        <td className="p-4 font-medium text-green-600">
                          ${formatCurrency(income.total_amount || 0)}
                        </td>
                        <td className="p-4">
                          <Badge className={statusColors[income.status]}>
                            {income.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex gap-2 justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setEditingIncome(income);
                                setShowForm(true);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setDeleteConfirm(income)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sortedIncomes.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    No outside income records found
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Income Record</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this outside income record? This action cannot be undone.
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