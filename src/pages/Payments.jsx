import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Pencil, Trash2, DollarSign, Download, ArrowUpDown, ArrowUp, ArrowDown, AlertCircle } from "lucide-react";
import { format, parseISO } from "date-fns";
import PaymentForm from "../components/payments/PaymentForm";
import PaymentDetailModal from "../components/payments/PaymentDetailModal";
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

export default function Payments() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingPayment, setEditingPayment] = useState(null);
  const [viewingPayment, setViewingPayment] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sortField, setSortField] = useState('payment_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filterUnallocated, setFilterUnallocated] = useState(false);
  const queryClient = useQueryClient();

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list('-payment_date')
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list()
  });

  const { data: providers = [], isLoading: providersLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  // Check for showUnallocated URL parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const showUnallocated = urlParams.get('showUnallocated');
    
    if (showUnallocated === 'true') {
      setFilterUnallocated(true);
      // Clear URL params after processing
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Update invoice amounts and statuses based on all payment allocations
  const updateInvoiceStatuses = async () => {
    if (invoices.length === 0 || payments.length === 0) return;
    
    // Create a map of invoice totals from all payment allocations
    const invoiceTotals = {};
    
    for (const payment of payments) {
      if (payment.allocations) {
        for (const allocation of payment.allocations) {
          if (allocation.invoice_id) {
            invoiceTotals[allocation.invoice_id] = (invoiceTotals[allocation.invoice_id] || 0) + (allocation.amount || 0);
          }
        }
      }
    }
    
    // Update each invoice with the correct amount_received and status
    for (const invoice of invoices) {
      const amountReceived = invoiceTotals[invoice.id] || 0;
      const balance = (invoice.amount_expected || invoice.total || 0) - amountReceived;
      
      // Determine status based on payment
      let newStatus = invoice.status;
      if (balance <= 0 && amountReceived > 0) {
        newStatus = 'paid_to_entic';
      } else if (amountReceived > 0 && balance > 0) {
        newStatus = 'partial';
      }
      
      // Only update if values changed
      if (invoice.amount_received !== amountReceived || invoice.status !== newStatus) {
        await base44.entities.Invoice.update(invoice.id, {
          amount_received: amountReceived,
          status: newStatus
        });
      }
    }
  };

  // Auto-update on page load to sync existing data
  useEffect(() => {
    const updateData = async () => {
      // Only run if all data is loaded and not empty
      if (paymentsLoading || invoicesLoading || providersLoading || payments.length === 0 || invoices.length === 0) return;
      
      // Update payment unallocated amounts and auto-set to cleared when fully allocated
      for (const payment of payments) {
        const totalAllocated = payment.allocations?.reduce((sum, a) => sum + (a.amount || 0), 0) || 0;
        const unallocated = (payment.total_amount || 0) - totalAllocated;
        
        // Auto-update to cleared if fully allocated
        let newStatus = payment.status;
        if (unallocated === 0 && totalAllocated > 0 && payment.status === 'pending') {
          newStatus = 'cleared';
        }
        
        if (payment.unallocated_amount !== unallocated || payment.status !== newStatus) {
          await base44.entities.Payment.update(payment.id, {
            unallocated_amount: unallocated,
            status: newStatus
          });
        }
      }
      
      // Update all invoice statuses based on allocations
      await updateInvoiceStatuses();
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    };
    
    // Debounce or add a dependency to ensure this runs after initial data fetch is stable
    const timer = setTimeout(() => {
      updateData();
    }, 500); // Small delay to ensure all queries have settled

    return () => clearTimeout(timer);
    
  }, [payments.length, invoices.length, paymentsLoading, invoicesLoading, providersLoading]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const totalAllocated = data.allocations?.reduce((sum, a) => sum + (a.amount || 0), 0) || 0;
      const unallocated = data.total_amount - totalAllocated;
      
      // Auto-set to cleared if fully allocated
      let status = data.status;
      if (unallocated === 0 && totalAllocated > 0 && status === 'pending') {
        status = 'cleared';
      }
      
      const payment = await base44.entities.Payment.create({
        ...data,
        unallocated_amount: unallocated,
        status: status
      });
      
      // Update invoice statuses based on allocations
      await updateInvoiceStatuses();
      
      return payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setShowForm(false);
      setEditingPayment(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const totalAllocated = data.allocations?.reduce((sum, a) => sum + (a.amount || 0), 0) || 0;
      const unallocated = data.total_amount - totalAllocated;
      
      // Auto-set to cleared if fully allocated
      let status = data.status;
      if (unallocated === 0 && totalAllocated > 0 && status === 'pending') {
        status = 'cleared';
      }
      
      const payment = await base44.entities.Payment.update(id, {
        ...data,
        unallocated_amount: unallocated,
        status: status
      });
      
      // Update invoice statuses based on allocations
      await updateInvoiceStatuses();
      
      return payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setShowForm(false);
      setEditingPayment(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (payment) => {
      await base44.entities.Payment.delete(payment.id);
      
      // Update invoice statuses after deletion
      await updateInvoiceStatuses();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setDeleteConfirm(null);
    }
  });

  const handleSubmit = (data) => {
    if (editingPayment) {
      updateMutation.mutate({ id: editingPayment.id, data });
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

  // Export allocations to CSV
  const exportAllocations = () => {
    // Build CSV data with provider names
    const rows = [];
    rows.push(['Payment Date', 'Payer', 'Payment Method', 'Reference Number', 'Payment Total', 'Payment Status', 'Invoice Number', 'Program Group', 'Provider Name', 'Allocation Amount', 'Allocation Notes']);
    
    payments.forEach(payment => {
      if (payment.allocations && payment.allocations.length > 0) {
        payment.allocations.forEach(allocation => {
          const invoice = invoices.find(inv => inv.id === allocation.invoice_id);
          const provider = providers.find(p => p.id === allocation.provider_id);
          
          rows.push([
            format(parseISO(payment.payment_date), 'yyyy-MM-dd'),
            payment.payer || '',
            payment.payment_method || '',
            payment.reference_number || '',
            payment.total_amount || 0,
            payment.status || '',
            invoice?.invoice_number || '',
            invoice?.program_group || '',
            provider?.full_name || '',
            allocation.amount || 0,
            allocation.notes || ''
          ]);
        });
      } else {
        // Payment with no allocations
        rows.push([
          format(parseISO(payment.payment_date), 'yyyy-MM-dd'),
          payment.payer || '',
          payment.payment_method || '',
          payment.reference_number || '',
          payment.total_amount || 0,
          payment.status || '',
          '',
          '',
          '',
          '',
          ''
        ]);
      }
    });
    
    // Convert to CSV string
    const csvContent = rows.map(row => 
      row.map(cell => {
        const cellStr = String(cell);
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return '"' + cellStr.replace(/"/g, '""') + '"';
        }
        return cellStr;
      }).join(',')
    ).join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `payment_allocations_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Format currency with commas
  const formatCurrency = (amount) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Only process data when all queries have loaded
  if (paymentsLoading || invoicesLoading || providersLoading) {
    return (
      <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12 text-slate-500">Loading...</div>
        </div>
      </div>
    );
  }

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.payer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.reference_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesUnallocatedFilter = !filterUnallocated || (payment.unallocated_amount > 0);
    
    return matchesSearch && matchesUnallocatedFilter;
  });

  const sortedPayments = [...filteredPayments].sort((a, b) => {
    let aValue, bValue;
    
    if (sortField === 'payment_date') {
      aValue = new Date(a.payment_date);
      bValue = new Date(b.payment_date);
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    } else if (sortField === 'total_amount') {
      aValue = a.total_amount || 0;
      bValue = b.total_amount || 0;
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

  // Calculate total of all payments
  const totalPayments = sortedPayments.reduce((sum, payment) => sum + (payment.total_amount || 0), 0);
  const totalUnallocated = sortedPayments.reduce((sum, payment) => sum + (payment.unallocated_amount || 0), 0);

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    cleared: "bg-green-100 text-green-800",
    reversed: "bg-red-100 text-red-800",
    entic_paid: "bg-blue-100 text-blue-800"
  };

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Payments</h1>
            <p className="text-slate-600 mt-1">Track and allocate payments to invoices</p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={exportAllocations}
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Allocations
            </Button>
            <Button
              onClick={() => {
                setEditingPayment(null);
                setShowForm(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Record Payment
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-green-50 to-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total Payments</p>
                  <div className="text-4xl font-bold text-green-700 mt-2">
                    ${formatCurrency(totalPayments)}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    {sortedPayments.length} payment{sortedPayments.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <DollarSign className="w-16 h-16 text-green-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-orange-50 to-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Unallocated Amount</p>
                  <div className="text-4xl font-bold text-orange-700 mt-2">
                    ${formatCurrency(totalUnallocated)}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    Requires allocation to invoices
                  </p>
                </div>
                <AlertCircle className="w-16 h-16 text-orange-600 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {showForm && (
          <PaymentForm
            payment={editingPayment}
            invoices={invoices}
            providers={providers}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingPayment(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        )}

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex items-center gap-4 flex-1">
                <Search className="w-5 h-5 text-slate-400" />
                <Input
                  placeholder="Search payments..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-md border-slate-200"
                />
              </div>
              <Button
                variant={filterUnallocated ? "default" : "outline"}
                onClick={() => setFilterUnallocated(!filterUnallocated)}
                className={filterUnallocated ? "bg-orange-600 hover:bg-orange-700" : ""}
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                {filterUnallocated ? "Showing Unallocated" : "Show Unallocated Only"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700 w-16">
                      #
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('payment_date')}
                    >
                      Payment Date <SortIcon field="payment_date" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('payer')}
                    >
                      Payer <SortIcon field="payer" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('payment_method')}
                    >
                      Method <SortIcon field="payment_method" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('reference_number')}
                    >
                      Reference <SortIcon field="reference_number" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('total_amount')}
                    >
                      Amount <SortIcon field="total_amount" />
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">
                      Unallocated
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                      onClick={() => handleSort('status')}
                    >
                      Status <SortIcon field="status" />
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Allocations</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPayments.map((payment, index) => (
                    <tr key={payment.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                      payment.unallocated_amount > 0 ? 'bg-orange-50/30' : ''
                    }`}>
                      <td className="p-4 text-slate-500 font-medium">
                        {index + 1}
                      </td>
                      <td className="p-4 text-slate-600">
                        {format(parseISO(payment.payment_date), 'MMM d, yyyy')}
                      </td>
                      <td className="p-4 font-medium text-slate-900">{payment.payer}</td>
                      <td className="p-4 text-slate-600">{payment.payment_method?.replace(/_/g, ' ')}</td>
                      <td className="p-4 text-slate-600 font-mono text-sm">
                        {payment.reference_number || '-'}
                      </td>
                      <td className="p-4 font-medium text-green-600">
                        ${formatCurrency(payment.total_amount || 0)}
                      </td>
                      <td className="p-4">
                        {payment.unallocated_amount > 0 ? (
                          <span className="font-bold text-orange-600">
                            ${formatCurrency(payment.unallocated_amount)}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <Badge className={statusColors[payment.status]}>
                          {payment.status === 'entic_paid' ? 'ENTIC Paid' : payment.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-slate-600">
                        {payment.allocations?.length || 0} allocation(s)
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setViewingPayment(payment)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setEditingPayment(payment);
                              setShowForm(true);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setDeleteConfirm(payment)}
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
              {sortedPayments.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  {filterUnallocated ? 'No unallocated payments found' : 'No payments found'}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {viewingPayment && (
        <PaymentDetailModal
          payment={viewingPayment}
          invoices={invoices}
          providers={providers}
          onClose={() => setViewingPayment(null)}
        />
      )}

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payment</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payment from {deleteConfirm?.payer}? This will reverse all invoice allocations. This action cannot be undone.
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