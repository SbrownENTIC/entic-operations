
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Pencil, Trash2, FileText, ArrowUpDown, ArrowUp, ArrowDown, Download, UserCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { parseISO, format } from "date-fns";
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
  const [bulkProviderId, setBulkProviderId] = useState("");
  const [sortField, setSortField] = useState('created_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [linkingOnCall, setLinkingOnCall] = useState(false);
  const [linkingProviders, setLinkingProviders] = useState(false);
  const [linkingUConnProviders, setLinkingUConnProviders] = useState(false);
  const [linkMessage, setLinkMessage] = useState('');
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

  const bulkUpdateProviderMutation = useMutation({
    mutationFn: async ({ ids, providerId }) => {
      const updates = ids.map(id =>
        base44.entities.OutsideIncome.update(id, { provider_id: providerId })
      );
      return Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outside-income'] });
      setSelectedIncomes([]);
      setBulkProviderId("");
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

  const handleBulkUpdateProvider = () => {
    if (selectedIncomes.length > 0 && bulkProviderId) {
      bulkUpdateProviderMutation.mutate({ ids: selectedIncomes, providerId: bulkProviderId });
    }
  };

  const handleLinkOnCallDates = async () => {
    setLinkingOnCall(true);
    setLinkMessage('');
    try {
      const response = await base44.functions.invoke('linkOutsideIncomeToOnCall', {});
      setLinkMessage(response.data.message);
      queryClient.invalidateQueries({ queryKey: ['outside-income'] });
    } catch (error) {
      setLinkMessage('Error linking on-call dates: ' + error.message);
    } finally {
      setLinkingOnCall(false);
    }
  };

  const handleLinkStFrancisProviders = async () => {
    setLinkingProviders(true);
    setLinkMessage('');
    try {
      const response = await base44.functions.invoke('linkStFrancisProviders', {});
      setLinkMessage(response.data.message);
      queryClient.invalidateQueries({ queryKey: ['outside-income'] });
    } catch (error) {
      setLinkMessage('Error linking providers: ' + error.message);
    } finally {
      setLinkingProviders(false);
    }
  };

  const handleLinkUConnProviders = async () => {
    setLinkingUConnProviders(true);
    setLinkMessage('');
    try {
      const response = await base44.functions.invoke('linkUConnProviders', {});
      setLinkMessage(response.data.message);
      queryClient.invalidateQueries({ queryKey: ['outside-income'] });
    } catch (error) {
      setLinkMessage('Error linking UConn providers: ' + error.message);
    } finally {
      setLinkingUConnProviders(false);
    }
  };

  const toggleSelection = (incomeId) => {
    setSelectedIncomes(prev =>
      prev.includes(incomeId)
        ? prev.filter(id => id !== incomeId)
        : [...prev, incomeId]
    );
  };

  const toggleAllSelection = () => {
    if (selectedIncomes.length === sortedIncomes.length) {
      setSelectedIncomes([]);
    } else {
      setSelectedIncomes(sortedIncomes.map(inc => inc.id));
    }
  };

  const createInvoiceFromSelected = () => {
    if (selectedIncomes.length === 0) return;
    const incomeIds = selectedIncomes.join(',');
    navigate(`${createPageUrl('Invoices')}?create=true&incomes=${incomeIds}`);
  };

  const exportToCSV = () => {
    const headers = ['Provider', 'Facility', 'Work Month', 'On-Call Start', 'Days/RVUs', 'Rate', 'Total Amount', 'Invoice Month', 'Status', 'Created Date'];
    const rows = sortedIncomes.map(income => [
      income.provider?.full_name || '',
      income.facility_name || '',
      income.workMonth,
      income.onCallStart ? format(parseISO(income.onCallStart), 'MM-dd-yyyy') : '-', // Use onCallStart for export
      income.isHartfordRVU ? `${formatNumber(income.total_rvus)} RVUs` : income.isDirectorship ? '-' : `${income.days_worked || 0} days`,
      income.rate || 0,
      income.total_amount || 0,
      income.invoice_month || '',
      income.status || '',
      format(new Date(income.created_date), 'yyyy-MM-dd')
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => {
        // Enclose values in double quotes and escape existing double quotes
        const stringCell = String(cell);
        return `"${stringCell.replace(/"/g, '""')}"`;
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `outside-income-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
  };

  // Get month from work dates
  const getWorkMonth = (income) => {
    if (!income.work_dates || income.work_dates.length === 0) return '-';

    try {
      // Get unique months from work dates
      const months = new Set();
      income.work_dates.forEach(dateStr => {
        const date = parseISO(dateStr);
        months.add(format(date, 'MMM yyyy'));
      });

      const monthArray = Array.from(months);
      if (monthArray.length === 1) {
        return monthArray[0];
      } else if (monthArray.length > 1) {
        return monthArray.join(', ');
      }
      return '-';
    } catch (error) {
      return '-';
    }
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
      programLocation: location,
      workMonth: getWorkMonth(income),
      onCallStart: income.work_dates && income.work_dates.length > 0 ? income.work_dates[0] : null
    };
  });

  const filteredIncomes = incomesWithProviders.filter(income =>
    income.provider?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    income.facility_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    income.invoice_month?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    income.workMonth?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedIncomes = [...filteredIncomes].sort((a, b) => {
    let aValue, bValue;

    if (sortField === 'providerName') {
      aValue = a.providerName;
      bValue = b.providerName;
    } else if (sortField === 'workMonth') {
      aValue = a.workMonth;
      bValue = b.workMonth;
    } else if (sortField === 'temp_oncall_start_date') { // The column header is 'temp_oncall_start_date' but we use 'onCallStart' for sorting
      aValue = a.onCallStart ? new Date(a.onCallStart) : null;
      bValue = b.onCallStart ? new Date(b.onCallStart) : null;

      // Handle null dates: nulls come last in asc, first in desc
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return sortDirection === 'asc' ? 1 : -1;
      if (bValue === null) return sortDirection === 'asc' ? -1 : 1;
      
      return sortDirection === 'asc' ? aValue.getTime() - bValue.getTime() : bValue.getTime() - aValue.getTime();
    }
    else if (sortField === 'days_worked' || sortField === 'total_rvus' || sortField === 'rate' || sortField === 'total_amount') {
      aValue = a[sortField] || 0;
      bValue = b[sortField] || 0;
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    } else if (sortField === 'created_date') {
      aValue = new Date(a.created_date);
      bValue = new Date(b.created_date);
      return sortDirection === 'asc' ? aValue.getTime() - bValue.getTime() : bValue.getTime() - aValue.getTime();
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
    <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Outside Income</h1>
            <p className="text-slate-600 mt-1">Track work performed at external facilities</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={exportToCSV}
              variant="outline"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </Button>
            <Button
              onClick={handleLinkOnCallDates}
              disabled={linkingOnCall}
              variant="outline"
              className="gap-2 border-purple-600 text-purple-600 hover:bg-purple-50"
            >
              <UserCheck className={`w-4 h-4 ${linkingOnCall ? 'animate-spin' : ''}`} />
              {linkingOnCall ? 'Linking...' : 'Link On-Call Dates'}
            </Button>
            <Button
              onClick={handleLinkStFrancisProviders}
              disabled={linkingProviders}
              variant="outline"
              className="gap-2 border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              <UserCheck className={`w-4 h-4 ${linkingProviders ? 'animate-spin' : ''}`} />
              {linkingProviders ? 'Linking...' : 'Link St. Francis Providers'}
            </Button>
            <Button
              onClick={handleLinkUConnProviders}
              disabled={linkingUConnProviders}
              variant="outline"
              className="gap-2 border-green-600 text-green-600 hover:bg-green-50"
            >
              <UserCheck className={`w-4 h-4 ${linkingUConnProviders ? 'animate-spin' : ''}`} />
              {linkingUConnProviders ? 'Linking...' : 'Link UConn Providers'}
            </Button>
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

        {showForm && (
          <OutsideIncomeForm
            income={editingIncome}
            providers={providers}
            programLocations={programLocations}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingIncome(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        )}

        {linkMessage && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <p className="text-sm text-blue-900">{linkMessage}</p>
            </CardContent>
          </Card>
        )}

        <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-100 space-y-4">
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search outside income..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md border-slate-200"
              />
            </div>

            {selectedIncomes.length > 0 && (
              <div className="flex flex-col gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">
                    {selectedIncomes.length} selected
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedIncomes([])}
                  >
                    Clear Selection
                  </Button>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-sm text-slate-700">Update Provider:</span>
                  <Select value={bulkProviderId} onValueChange={setBulkProviderId}>
                    <SelectTrigger className="w-64 bg-white">
                      <SelectValue placeholder="Select provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {providers.map(provider => (
                        <SelectItem key={provider.id} value={provider.id}>
                          {provider.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    onClick={handleBulkUpdateProvider}
                    disabled={!bulkProviderId || bulkUpdateProviderMutation.isPending}
                    className="bg-blue-600 hover:bg-blue-700 gap-2"
                  >
                    <UserCheck className="w-4 h-4" />
                    {bulkUpdateProviderMutation.isPending ? 'Updating...' : 'Update Selected'}
                  </Button>
                </div>
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[calc(100vh-230px)]">
              <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="text-left p-4 text-sm font-semibold text-slate-700 w-12">
                        <Checkbox
                          checked={selectedIncomes.length === sortedIncomes.length && sortedIncomes.length > 0}
                          onCheckedChange={toggleAllSelection}
                        />
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
                        onClick={() => handleSort('workMonth')}
                      >
                        Work Month <SortIcon field="workMonth" />
                      </th>
                      <th
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('temp_oncall_start_date')}
                      >
                        On-Call Start <SortIcon field="temp_oncall_start_date" />
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
                        onClick={() => handleSort('invoice_month')}
                      >
                        Invoice Month <SortIcon field="invoice_month" />
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
                      <tr key={income.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedIncomes.includes(income.id) ? 'bg-blue-50' : ''}`}>
                        <td className="p-4">
                          <Checkbox
                            checked={selectedIncomes.includes(income.id)}
                            onCheckedChange={() => toggleSelection(income.id)}
                          />
                        </td>
                        <td className="p-4 font-medium text-slate-900">
                          {income.provider?.full_name || '-'}
                        </td>
                        <td className="p-4 text-slate-600">{income.facility_name || '-'}</td>
                        <td className="p-4 text-slate-600 font-medium">{income.workMonth}</td>
                        <td className="p-4 text-slate-600">
                          {income.onCallStart ? format(parseISO(income.onCallStart), 'MM-dd-yyyy') : '-'}
                        </td>
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
                        <td className="p-4 text-slate-600">{income.invoice_month || '-'}</td>
                        <td className="p-4">
                          <Badge className={statusColors[income.status]}>
                            {income.status?.charAt(0).toUpperCase() + income.status?.slice(1)}
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
                  No income records found
                </div>
              )}
            </div>
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
