import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Printer, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import InvoiceForm from "../components/invoices/InvoiceForm";
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

export default function Invoices() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [preselectedIncomes, setPreselectedIncomes] = useState([]);
  const [sortField, setSortField] = useState('invoice_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [bulkDateProviderPaid, setBulkDateProviderPaid] = useState('');
  const [bulkProviderPaid, setBulkProviderPaid] = useState(false);
  const [bulkStatusUpdate, setBulkStatusUpdate] = useState('');
  const [filterNoIncome, setFilterNoIncome] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-invoice_date')
  });

  const { data: incomes = [] } = useQuery({
    queryKey: ['outside-income'],
    queryFn: () => base44.entities.OutsideIncome.list()
  });

  const { data: providers = [], isLoading: providersLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const create = urlParams.get('create');
    const incomeIds = urlParams.get('incomes');
    const editId = urlParams.get('edit');
    
    if (create === 'true' && incomeIds) {
      setPreselectedIncomes(incomeIds.split(','));
      setShowForm(true);
      window.history.replaceState({}, '', createPageUrl("Invoices"));
    } else if (editId && invoices.length > 0) {
      const invoiceToEdit = invoices.find(inv => inv.id === editId);
      if (invoiceToEdit) {
        setEditingInvoice(invoiceToEdit);
        setShowForm(true);
        window.history.replaceState({}, '', createPageUrl("Invoices"));
      }
    }
  }, [invoices]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const invoice = await base44.entities.Invoice.create(data);
      
      if (data.outside_income_ids && data.outside_income_ids.length > 0) {
        for (const incomeId of data.outside_income_ids) {
          await base44.entities.OutsideIncome.update(incomeId, {
            invoice_id: invoice.id,
            invoice_month: data.month || '',
            status: 'invoiced'
          });
        }
      }
      
      // Auto-create Hartford Hospital Directorship invoice if this is an RVU invoice
      if (data.program_group === 'Hartford Hospital' && data.invoice_number && !data.invoice_number.includes('Directorship')) {
        // Fetch fresh list of incomes to ensure we have the latest data
        const allIncomes = await base44.entities.OutsideIncome.list();
        
        // Find the matching directorship outside income for this provider and month
        const directorshipIncome = allIncomes.find(inc => {
          const facilityMatch = inc.facility_name?.toLowerCase().includes('directorship');
          const providerMatch = inc.provider_id === data.staff_member_id;
          
          // Match month by comparing the date's month/year with invoice month
          let monthMatch = false;
          if (inc.work_dates && inc.work_dates.length > 0 && data.month) {
            try {
              const incomeDate = parseISO(inc.work_dates[0]);
              const incomeMonthYear = format(incomeDate, 'MMMM yyyy');
              monthMatch = incomeMonthYear === data.month;
            } catch (e) {
              monthMatch = false;
            }
          }
          
          return facilityMatch && providerMatch && monthMatch && !inc.invoice_id;
        });
        
        const directorshipIncomeIds = directorshipIncome ? [directorshipIncome.id] : [];
        
        const directorshipInvoice = await base44.entities.Invoice.create({
          invoice_number: `${data.invoice_number} (Directorship)`,
          program_group: 'Hartford Hospital',
          staff_member_id: data.staff_member_id,
          work_email: data.work_email,
          invoice_date: data.invoice_date,
          month: data.month,
          status: data.status || 'not_started',
          subtotal: 3250,
          total: 3250,
          amount_expected: 3250,
          outside_income_ids: directorshipIncomeIds,
          days_worked: 0,
          notes: 'Auto-generated Directorship invoice'
        });
        
        // Link the directorship income to the new invoice
        if (directorshipIncome) {
          await base44.entities.OutsideIncome.update(directorshipIncome.id, {
            invoice_id: directorshipInvoice.id,
            invoice_month: data.month || '',
            status: 'invoiced'
          });
        }
      }
      
      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['outside-income'] });
      setShowForm(false);
      setEditingInvoice(null);
      setPreselectedIncomes([]);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, statusChanged }) => {
      // If status was manually changed, set the override flag
      if (statusChanged) {
        data.manual_status_override = true;
      }
      
      const originalInvoice = invoices.find(inv => inv.id === id);
      const originalIncomeIds = originalInvoice?.outside_income_ids || [];
      const newIncomeIds = data.outside_income_ids || [];
      
      const unlinkedIncomes = originalIncomeIds.filter(incId => !newIncomeIds.includes(incId));
      const newlyLinkedIncomes = newIncomeIds.filter(incId => !originalIncomeIds.includes(incId));
      
      const invoice = await base44.entities.Invoice.update(id, data);
      
      for (const incomeId of unlinkedIncomes) {
        await base44.entities.OutsideIncome.update(incomeId, {
          invoice_id: null,
          invoice_month: null,
          status: 'pending'
        });
      }
      
      for (const incomeId of newlyLinkedIncomes) {
        await base44.entities.OutsideIncome.update(incomeId, {
          invoice_id: invoice.id,
          invoice_month: data.month || '',
          status: 'invoiced'
        });
      }
      
      for (const incomeId of newIncomeIds) {
        await base44.entities.OutsideIncome.update(incomeId, {
          invoice_month: data.month || ''
        });
      }
      
      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['outside-income'] });
      setShowForm(false);
      setEditingInvoice(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (invoice) => {
      if (invoice.outside_income_ids && invoice.outside_income_ids.length > 0) {
        for (const incomeId of invoice.outside_income_ids) {
          await base44.entities.OutsideIncome.update(incomeId, {
            invoice_id: null,
            invoice_month: null,
            status: 'pending'
          });
        }
      }
      
      await base44.entities.Invoice.delete(invoice.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['outside-income'] });
      setDeleteConfirm(null);
    }
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, updateData }) => {
      // Mark as manually overridden if status is being changed
      if (updateData.status) {
        updateData.manual_status_override = true;
      }
      const updates = ids.map(id => 
        base44.entities.Invoice.update(id, updateData)
      );
      return Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSelectedInvoices([]);
      setBulkDateProviderPaid('');
      setBulkProviderPaid(false);
      setBulkStatusUpdate('');
    }
  });

  const handleSubmit = (data, statusChanged) => {
    if (editingInvoice) {
      updateMutation.mutate({ id: editingInvoice.id, data, statusChanged });
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

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingInvoice(null);
    setPreselectedIncomes([]);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedInvoices(sortedInvoices.map(invoice => invoice.id));
    } else {
      setSelectedInvoices([]);
    }
  };

  const handleSelectInvoice = (invoiceId, checked) => {
    if (checked) {
      setSelectedInvoices([...selectedInvoices, invoiceId]);
    } else {
      setSelectedInvoices(selectedInvoices.filter(id => id !== invoiceId));
    }
  };

  const handleBulkUpdate = () => {
    if (selectedInvoices.length > 0) {
      const updateData = {};
      
      if (bulkDateProviderPaid) {
        updateData.date_provider_paid = bulkDateProviderPaid;
      }
      
      if (bulkProviderPaid) {
        updateData.provider_paid = true;
        updateData.status = 'provider_paid';
      }
      
      if (bulkStatusUpdate) {
        updateData.status = bulkStatusUpdate;
      }
      
      if (Object.keys(updateData).length > 0) {
        bulkUpdateMutation.mutate({ ids: selectedInvoices, updateData });
      }
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleInvoiceNumberClick = (invoice) => {
    setEditingInvoice(invoice);
    setPreselectedIncomes([]);
    setShowForm(true);
  };

  const formatCurrency = (amount) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  if (invoicesLoading || providersLoading) {
    return (
      <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12 text-slate-500">Loading...</div>
        </div>
      </div>
    );
  }

  const invoicesWithProviders = invoices.map(invoice => ({
    ...invoice,
    provider: providers.find(p => p.id === invoice.staff_member_id),
    providerName: providers.find(p => p.id === invoice.staff_member_id)?.full_name || '',
    balance: (invoice.amount_expected || invoice.total || 0) - (invoice.amount_received || 0),
    hasOutsideIncome: invoice.outside_income_ids && invoice.outside_income_ids.length > 0
  }));

  const filteredInvoices = invoicesWithProviders.filter(invoice => {
    const matchesSearch = invoice.program_group?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.provider?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.month?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesNoIncomeFilter = !filterNoIncome || !invoice.hasOutsideIncome;
    
    return matchesSearch && matchesNoIncomeFilter;
  });

  const sortedInvoices = [...filteredInvoices].sort((a, b) => {
    let aValue, bValue;
    
    if (sortField === 'providerName') {
      aValue = a.providerName;
      bValue = b.providerName;
    } else if (sortField === 'invoice_date') {
      aValue = new Date(a.invoice_date);
      bValue = new Date(b.invoice_date);
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    } else if (sortField === 'total' || sortField === 'amount_received' || sortField === 'balance') {
      aValue = a[sortField] || 0;
      bValue = b[sortField] || 0;
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
    not_started: "bg-gray-100 text-gray-800",
    draft: "bg-gray-100 text-gray-800",
    pending_providers_approval: "bg-yellow-100 text-yellow-800",
    pending_providers_time: "bg-yellow-100 text-yellow-800",
    sent_for_approval: "bg-blue-100 text-blue-800",
    approved: "bg-green-100 text-green-800",
    sent_to_vendor: "bg-blue-100 text-blue-800",
    paid_to_entic: "bg-green-100 text-green-800",
    provider_paid: "bg-purple-100 text-purple-800",
    partial: "bg-blue-100 text-blue-800"
  };

  const getStatusLabel = (invoice) => {
    if (invoice.status === 'paid_to_entic') return 'Paid To ENTIC';
    if (invoice.status === 'provider_paid') return 'Provider Paid';
    if (invoice.status === 'partial') return 'Partial';
    return invoice.status?.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <>
    <div className="min-h-screen bg-slate-50 pb-8">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-content, .print-content * { visibility: visible; }
          .print-content { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-content table { width: 100%; border-collapse: collapse; }
          .print-content th, .print-content td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .print-content th { background-color: #f5f5f5; }
        }
      `}</style>
      <div className="p-2 md:p-3">
        <div className="max-w-7xl mx-auto space-y-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 no-print">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
            <p className="text-slate-600 text-sm">Manage invoices for outside income</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={handlePrint}
              variant="outline"
              className="gap-2"
            >
              <Printer className="w-4 h-4" />
              Print
            </Button>
            <Button
              onClick={() => {
                setEditingInvoice(null);
                setPreselectedIncomes([]);
                setShowForm(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Invoice
            </Button>
          </div>
        </div>

        {showForm && (
          <div className="no-print">
            <InvoiceForm
              invoice={editingInvoice}
              incomes={incomes}
              preselectedIncomes={preselectedIncomes}
              onSubmit={handleSubmit}
              onCancel={handleCancelForm}
              isLoading={createMutation.isPending || updateMutation.isPending}
            />
          </div>
        )}
        </div>
      </div>

      <div className="px-4 md:px-6 pb-4">
        <div className="max-w-7xl mx-auto">
        <div className="print-content">
          <div className="hidden print:block mb-4">
            <h1 className="text-2xl font-bold">Invoices Report</h1>
            <p className="text-sm text-gray-600">Generated on {format(new Date(), 'MMM d, yyyy')}</p>
          </div>

          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100 space-y-4 no-print">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <Search className="w-5 h-5 text-slate-400" />
                  <Input
                    placeholder="Search invoices..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-md border-slate-200"
                  />
                </div>
                <Button
                  variant={filterNoIncome ? "default" : "outline"}
                  onClick={() => setFilterNoIncome(!filterNoIncome)}
                  className={filterNoIncome ? "bg-orange-600 hover:bg-orange-700" : ""}
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {filterNoIncome ? "Showing No Income" : "Show Without Income"}
                </Button>
              </div>
              {selectedInvoices.length > 0 && (
                <div className="flex flex-col gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">
                      {selectedInvoices.length} selected
                    </span>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedInvoices([])}
                    >
                      Clear Selection
                    </Button>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-700">Status:</span>
                      <Select 
                        value={bulkStatusUpdate} 
                        onValueChange={setBulkStatusUpdate}
                      >
                        <SelectTrigger className="w-52 bg-white">
                          <SelectValue placeholder="Update Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="not_started">Not Started</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="pending_providers_approval">Pending Providers Approval</SelectItem>
                          <SelectItem value="pending_providers_time">Pending Providers Time</SelectItem>
                          <SelectItem value="sent_for_approval">Sent for Approval</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="sent_to_vendor">Sent to Vendor</SelectItem>
                          <SelectItem value="paid_to_entic">Paid to ENTIC</SelectItem>
                          <SelectItem value="provider_paid">Provider Paid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-700">Date Provider Paid:</span>
                      <Input
                        type="date"
                        value={bulkDateProviderPaid}
                        onChange={(e) => setBulkDateProviderPaid(e.target.value)}
                        className="w-48"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="bulk-provider-paid"
                        checked={bulkProviderPaid}
                        onChange={(e) => setBulkProviderPaid(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="bulk-provider-paid" className="text-sm text-slate-700 cursor-pointer">
                        Mark as Provider Paid
                      </label>
                    </div>

                    <Button 
                      onClick={handleBulkUpdate}
                      disabled={(!bulkDateProviderPaid && !bulkProviderPaid && !bulkStatusUpdate) || bulkUpdateMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {bulkUpdateMutation.isPending ? 'Updating...' : 'Update Selected'}
                    </Button>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[600px] print:max-h-none print:overflow-visible">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="text-left p-4 text-sm font-semibold text-slate-700 w-12 no-print">
                        <input
                          type="checkbox"
                          checked={selectedInvoices.length === sortedInvoices.length && sortedInvoices.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 print:cursor-default"
                        onClick={() => handleSort('invoice_number')}
                      >
                        Invoice # <SortIcon field="invoice_number" />
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 print:cursor-default"
                        onClick={() => handleSort('program_group')}
                      >
                        Program Group <SortIcon field="program_group" />
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 print:cursor-default"
                        onClick={() => handleSort('providerName')}
                      >
                        Provider <SortIcon field="providerName" />
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 print:cursor-default"
                        onClick={() => handleSort('month')}
                      >
                        Month <SortIcon field="month" />
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 print:cursor-default"
                        onClick={() => handleSort('invoice_date')}
                      >
                        Date <SortIcon field="invoice_date" />
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 print:cursor-default"
                        onClick={() => handleSort('total')}
                      >
                        Total <SortIcon field="total" />
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 print:cursor-default"
                        onClick={() => handleSort('amount_received')}
                      >
                        Paid <SortIcon field="amount_received" />
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 print:cursor-default"
                        onClick={() => handleSort('balance')}
                      >
                        Balance <SortIcon field="balance" />
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 print:cursor-default"
                        onClick={() => handleSort('status')}
                      >
                        Status <SortIcon field="status" />
                      </th>
                      <th className="text-center p-4 text-sm font-semibold text-slate-700 no-print">
                        Manual
                      </th>
                      <th className="text-right p-4 text-sm font-semibold text-slate-700 no-print">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedInvoices.map((invoice) => (
                      <tr key={invoice.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors print:hover:bg-white ${selectedInvoices.includes(invoice.id) ? 'bg-blue-50' : ''} ${!invoice.hasOutsideIncome ? 'bg-orange-50/30' : ''}`}>
                        <td className="p-4 no-print">
                          <input
                            type="checkbox"
                            checked={selectedInvoices.includes(invoice.id)}
                            onChange={(e) => handleSelectInvoice(invoice.id, e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-4">
                          <button
                            onClick={() => handleInvoiceNumberClick(invoice)}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                          >
                            {invoice.invoice_number || '-'}
                          </button>
                        </td>
                        <td className="p-4 text-slate-600">{invoice.program_group}</td>
                        <td className="p-4 text-slate-900">{invoice.provider?.full_name || '-'}</td>
                        <td className="p-4 text-slate-600">{invoice.month || '-'}</td>
                        <td className="p-4 text-slate-600">
                          {format(parseISO(invoice.invoice_date), 'MMM d, yyyy')}
                        </td>
                        <td className="p-4 font-medium text-slate-900">
                          ${formatCurrency(invoice.total || 0)}
                        </td>
                        <td className="p-4 text-green-600 font-medium">
                          ${formatCurrency(invoice.amount_received || 0)}
                        </td>
                        <td className="p-4 font-medium text-slate-900">
                          ${formatCurrency(invoice.balance)}
                        </td>
                        <td className="p-4">
                          <Badge className={statusColors[invoice.status]}>
                            {getStatusLabel(invoice)}
                          </Badge>
                        </td>
                        <td className="p-4 text-center no-print">
                          {invoice.manual_status_override && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await base44.entities.Invoice.update(invoice.id, { manual_status_override: false });
                                queryClient.invalidateQueries({ queryKey: ['invoices'] });
                              }}
                              className="text-orange-600 hover:text-orange-700"
                              title="Click to allow automatic status updates"
                            >
                              🔒
                            </Button>
                          )}
                        </td>
                        <td className="p-4 text-right no-print">
                          <div className="flex gap-2 justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setEditingInvoice(invoice);
                                setPreselectedIncomes([]);
                                setShowForm(true);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setDeleteConfirm(invoice)}
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
                {sortedInvoices.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    No invoices found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice {deleteConfirm?.invoice_number} for {deleteConfirm?.provider?.full_name}? This will reset the associated outside income records back to pending status. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteConfirm)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}