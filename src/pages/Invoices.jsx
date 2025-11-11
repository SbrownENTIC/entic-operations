import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
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
    
    if (create === 'true' && incomeIds) {
      setPreselectedIncomes(incomeIds.split(','));
      setShowForm(true);
    }
  }, []);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const invoice = await base44.entities.Invoice.create(data);
      
      // Update outside income records with invoice_id and invoice_month
      if (data.outside_income_ids && data.outside_income_ids.length > 0) {
        for (const incomeId of data.outside_income_ids) {
          await base44.entities.OutsideIncome.update(incomeId, {
            invoice_id: invoice.id,
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
    mutationFn: async ({ id, data }) => {
      const invoice = await base44.entities.Invoice.update(id, data);
      
      // Update outside income records with invoice_month if changed
      if (data.outside_income_ids && data.outside_income_ids.length > 0) {
        for (const incomeId of data.outside_income_ids) {
          await base44.entities.OutsideIncome.update(incomeId, {
            invoice_month: data.month || ''
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
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (invoice) => {
      // Reset outside income records back to pending
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

  const handleSubmit = (data) => {
    if (editingInvoice) {
      updateMutation.mutate({ id: editingInvoice.id, data });
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

  // Format currency with commas
  const formatCurrency = (amount) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Only process data when both queries have loaded
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
    balance: (invoice.total || 0) - (invoice.amount_received || 0)
  }));

  const filteredInvoices = invoicesWithProviders.filter(invoice =>
    invoice.program_group?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.provider?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.month?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
    provider_paid: "bg-green-100 text-green-800",
    partial: "bg-blue-100 text-blue-800"
  };

  const getStatusLabel = (invoice) => {
    if (invoice.status === 'paid_to_entic') return 'Paid to ENTIC';
    if (invoice.status === 'provider_paid') return 'Provider Paid';
    if (invoice.status === 'partial') return 'Partial';
    return invoice.status?.replace(/_/g, ' ');
  };

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Invoices</h1>
            <p className="text-slate-600 mt-1">Manage invoices for outside income</p>
          </div>
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

        {showForm && (
          <InvoiceForm
            invoice={editingInvoice}
            incomes={incomes}
            preselectedIncomes={preselectedIncomes}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingInvoice(null);
              setPreselectedIncomes([]);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        )}

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search invoices..."
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
                      onClick={() => handleSort('invoice_number')}
                    >
                      Invoice # <SortIcon field="invoice_number" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('program_group')}
                    >
                      Program Group <SortIcon field="program_group" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('providerName')}
                    >
                      Provider <SortIcon field="providerName" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('month')}
                    >
                      Month <SortIcon field="month" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('invoice_date')}
                    >
                      Date <SortIcon field="invoice_date" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('total')}
                    >
                      Total <SortIcon field="total" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('amount_received')}
                    >
                      Paid <SortIcon field="amount_received" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('balance')}
                    >
                      Balance <SortIcon field="balance" />
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
                  {sortedInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-900">{invoice.invoice_number || '-'}</td>
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
                      <td className="p-4 text-right">
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
    </div>
  );
}