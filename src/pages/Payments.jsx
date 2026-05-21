import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Pencil, Trash2, DollarSign, Download, ArrowUpDown, ArrowUp, ArrowDown, AlertCircle, RefreshCw, Wrench, Printer, CheckSquare } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { useLocation } from "react-router-dom";
import { formatDateToEST } from "@/components/DateUtils";
import PaymentForm from "../components/payments/PaymentForm";
import PaymentDetailModal from "../components/payments/PaymentDetailModal";
import EmptyState from "@/components/ui/EmptyState";
import { ListPageSkeleton } from "@/components/ui/LoadingSkeletons";
import { useToast } from "@/components/ui/use-toast";
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
import { auditCreate, auditUpdate, auditDelete } from '@/lib/auditLogger';

export default function Payments() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingPayment, setEditingPayment] = useState(null);
  const [viewingPayment, setViewingPayment] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [sortField, setSortField] = useState('payment_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filterUnallocated, setFilterUnallocated] = useState(false);
  const [updatingMonths, setUpdatingMonths] = useState(false);
  const [fixingAllocations, setFixingAllocations] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const location = useLocation();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

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

  // Helper function to round to 2 decimal places and handle floating point precision
  const roundToTwo = (num) => {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  };

  // Check for URL parameters to auto-open a payment in edit mode
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const showUnallocated = urlParams.get('showUnallocated');
    const editPaymentId = urlParams.get('edit');

    if (showUnallocated === 'true') {
      setFilterUnallocated(true);
    }

    if (editPaymentId && payments.length > 0) {
      const paymentToEdit = payments.find(p => p.id === editPaymentId);
      if (paymentToEdit) {
        setEditingPayment(paymentToEdit);
        setShowForm(true);
      }
    }

    // Clear URL params after processing
    if (showUnallocated || editPaymentId) {
      window.history.replaceState({}, '', window.location.pathname);
    } else if (location.search === '' && showForm) {
      // If URL has no params and form is open, it means we navigated back to root
      setShowForm(false);
      setEditingPayment(null);
    }
  }, [payments, location.search]);

  // Update invoice amounts and statuses based on all payment allocations
  const updateInvoiceStatuses = async () => {
    if (invoices.length === 0 || payments.length === 0) return;

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

    for (const invoice of invoices) {
      const amountReceived = invoiceTotals[invoice.id] || 0;
      const amountExpected = invoice.amount_expected || invoice.total || 0;
      const balance = amountExpected - amountReceived;

      let newStatus = invoice.status;

      // Determine potential new status
      let potentialStatus = invoice.status;
      if (invoice.provider_paid) {
        potentialStatus = 'provider_paid';
      } else if (balance <= 0.01 && amountReceived > 0) {
        potentialStatus = 'paid_to_entic';
      } else if (amountReceived > 0 && balance > 0.01) {
        potentialStatus = 'partial';
      } else if (amountReceived === 0) {
        // If it was previously marked as paid/partial, but now has 0 received, revert to appropriate status
        if (['paid_to_entic', 'provider_paid', 'partial'].includes(invoice.status)) {
            if (invoice.invoice_sent_to_vendor) {
                potentialStatus = 'sent_to_vendor';
            } else if (invoice.invoice_sent_for_approval) {
                potentialStatus = 'sent_for_approval';
            } else {
                potentialStatus = 'draft'; 
            }
        }
      }

      // SELF-HEALING: Fix invalid 'pending' status caused by previous bug
      if (potentialStatus === 'pending') {
         if (invoice.invoice_sent_to_vendor) {
             potentialStatus = 'sent_to_vendor';
         } else if (invoice.invoice_sent_for_approval) {
             potentialStatus = 'sent_for_approval';
         } else {
             potentialStatus = 'pending_providers_approval'; // Restore to a valid default
         }
      }

      // Enforce status based on flags if no payment has been received yet
      if (amountReceived === 0 && !invoice.provider_paid) {
          if (invoice.invoice_sent_to_vendor && potentialStatus !== 'sent_to_vendor') {
              potentialStatus = 'sent_to_vendor';
          } else if (invoice.invoice_sent_for_approval && potentialStatus !== 'sent_for_approval' && !invoice.invoice_sent_to_vendor) {
              potentialStatus = 'sent_for_approval';
          }
      }

      // Update logic: 
      // 1. If not manually overridden, apply potential status
      // 2. If manually overridden, ONLY apply if it is 'paid_to_entic' (force update when fully paid)
      if (!invoice.manual_status_override || potentialStatus === 'paid_to_entic') {
        newStatus = potentialStatus;
      }

      const updateData = { amount_received: amountReceived };
      if (invoice.status !== newStatus) {
        updateData.status = newStatus;
      }

      if (invoice.amount_received !== amountReceived || invoice.status !== newStatus) {
        await base44.entities.Invoice.update(invoice.id, updateData);
      }
    }
  };

  // Auto-update on page load to sync existing data
  useEffect(() => {
    const updateData = async () => {
      if (paymentsLoading || invoicesLoading || providersLoading || payments.length === 0 || invoices.length === 0) return;

      for (const payment of payments) {
        const totalAllocated = payment.allocations?.reduce((sum, a) => sum + (a.amount || 0), 0) || 0;
        const unallocated = roundToTwo((payment.total_amount || 0) - totalAllocated);

        let newStatus = payment.status;
        if (Math.abs(unallocated) < 0.01 && totalAllocated > 0 && payment.status === 'pending') {
          newStatus = 'entic_paid';
        } else if (unallocated > 0.01 && (payment.status === 'cleared' || payment.status === 'entic_paid')) {
          newStatus = 'pending';
        }

        // Normalize tiny floating point errors to exactly 0
        const normalizedUnallocated = Math.abs(unallocated) < 0.01 ? 0 : unallocated;

        if (payment.unallocated_amount !== normalizedUnallocated || payment.status !== newStatus) {
          await base44.entities.Payment.update(payment.id, {
            unallocated_amount: normalizedUnallocated,
            status: newStatus
          });
        }
      }

      await updateInvoiceStatuses();

      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    };

    const timer = setTimeout(() => {
      updateData();
    }, 500);

    return () => clearTimeout(timer);

  }, [payments.length, invoices.length, paymentsLoading, invoicesLoading, providersLoading]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const totalAllocated = data.allocations?.reduce((sum, a) => sum + (a.amount || 0), 0) || 0;
      const unallocated = roundToTwo(data.total_amount - totalAllocated);

      let paymentMonth = data.payment_month;

      if (!paymentMonth) {
        const months = new Set();
        if (data.allocations) {
          data.allocations.forEach(allocation => {
            if (allocation.invoice_id) {
              const invoice = invoices.find(inv => inv.id === allocation.invoice_id);
              if (invoice && invoice.month) {
                months.add(invoice.month);
              }
            }
          });
        }
        paymentMonth = Array.from(months).sort().join(', ');
      }

      let status = data.status;
      if (Math.abs(unallocated) < 0.01 && totalAllocated > 0 && status === 'pending') {
        status = 'entic_paid';
      }

      const normalizedUnallocated = Math.abs(unallocated) < 0.01 ? 0 : unallocated;

      const payment = await base44.entities.Payment.create({
        ...data,
        payment_month: paymentMonth,
        unallocated_amount: normalizedUnallocated,
        status: status
      });

      await updateInvoiceStatuses();

      return payment;
    },
    onSuccess: (payment, data) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setShowForm(false);
      setEditingPayment(null);
      auditCreate('Payment', data, payment?.id).catch(e => console.error('[Audit]', e));
    },
    onError: (error) => {
      if (error?.status === 403 || error?.response?.status === 403 || error?.message?.includes('403')) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to create payments." });
      } else {
        toast({ variant: "destructive", title: "Error", description: error.message });
      }
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      const totalAllocated = data.allocations?.reduce((sum, a) => sum + (a.amount || 0), 0) || 0;
      const unallocated = roundToTwo(data.total_amount - totalAllocated);

      let paymentMonth = data.payment_month;

      if (!paymentMonth) {
        const months = new Set();
        if (data.allocations) {
          data.allocations.forEach(allocation => {
            if (allocation.invoice_id) {
              const invoice = invoices.find(inv => inv.id === allocation.invoice_id);
              if (invoice && invoice.month) {
                months.add(invoice.month);
              }
            }
          });
        }
        paymentMonth = Array.from(months).sort().join(', ');
      }

      let status = data.status;
      if (Math.abs(unallocated) < 0.01 && totalAllocated > 0 && status === 'pending') {
        status = 'entic_paid';
      } else if (unallocated > 0.01 && (status === 'cleared' || status === 'entic_paid')) {
        status = 'pending';
      }

      const normalizedUnallocated = Math.abs(unallocated) < 0.01 ? 0 : unallocated;

      const payment = await base44.entities.Payment.update(id, {
        ...data,
        payment_month: paymentMonth,
        unallocated_amount: normalizedUnallocated,
        status: status
      });

      await updateInvoiceStatuses();

      return payment;
    },
    onSuccess: (payment, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      const oldRecord = editingPayment;
      setShowForm(false);
      setEditingPayment(null);
      auditUpdate('Payment', variables.id, variables.data, oldRecord).catch(e => console.error('[Audit]', e));
    },
    onError: (error) => {
      if (error?.status === 403 || error?.response?.status === 403 || error?.message?.includes('403')) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to update payments." });
      } else {
        toast({ variant: "destructive", title: "Error", description: error.message });
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (payment) => {
      await base44.entities.Payment.delete(payment.id);

      await updateInvoiceStatuses();
    },
    onSuccess: (result, payment) => {
      const snapshot = deleteConfirm;
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setDeleteConfirm(null);
      auditDelete('Payment', payment.id, snapshot).catch(e => console.error('[Audit]', e));
    },
    onError: (error) => {
      if (error?.status === 403 || error?.response?.status === 403 || error?.message?.includes('403')) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to delete payments." });
      } else {
        toast({ variant: "destructive", title: "Error", description: error.message });
      }
    }
  });

  const unallocateMutation = useMutation({
    mutationFn: async ({ payment, allocationToRemove }) => {
      const updatedAllocations = (payment.allocations || []).filter(
        a => !(a.invoice_id === allocationToRemove.invoice_id &&
              a.provider_id === allocationToRemove.provider_id &&
              a.amount === allocationToRemove.amount)
      );

      const totalAllocated = updatedAllocations.reduce((sum, a) => sum + (a.amount || 0), 0);
      const unallocated = roundToTwo((payment.total_amount || 0) - totalAllocated);

      const months = new Set();
      if (updatedAllocations.length > 0) {
        updatedAllocations.forEach(allocation => {
          if (allocation.invoice_id) {
            const invoice = invoices.find(inv => inv.id === allocation.invoice_id);
            if (invoice && invoice.month) {
              months.add(invoice.month);
            }
          }
        });
      }
      const paymentMonth = Array.from(months).sort().join(', ');

      let status = payment.status;
      if (Math.abs(unallocated) < 0.01 && totalAllocated > 0) {
        status = 'entic_paid';
      } else if (unallocated > 0.01) {
        status = 'pending';
      }

      const normalizedUnallocated = Math.abs(unallocated) < 0.01 ? 0 : unallocated;

      await base44.entities.Payment.update(payment.id, {
        allocations: updatedAllocations,
        payment_month: paymentMonth,
        unallocated_amount: normalizedUnallocated,
        status: status
      });

      await updateInvoiceStatuses();
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      auditUpdate('Payment', variables.payment.id, { allocations: 'allocation_removed' }, variables.payment).catch(e => console.error('[Audit]', e));
      setViewingPayment(null);
    },
    onError: (error) => {
      if (error?.status === 403 || error?.response?.status === 403 || error?.message?.includes('403')) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to unallocate payments." });
      } else {
        toast({ variant: "destructive", title: "Error", description: error.message });
      }
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

  const handleUpdatePaymentMonths = async () => {
    setUpdatingMonths(true);
    setUpdateMessage('');
    try {
      const response = await base44.functions.invoke('updatePaymentMonths', {});
      setUpdateMessage(response.data.message);
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    } catch (error) {
      setUpdateMessage('Error updating payment months: ' + error.message);
    } finally {
      setUpdatingMonths(false);
    }
  };

  const handleFixPaymentAllocations = async () => {
    setFixingAllocations(true);
    setUpdateMessage('');
    try {
      const response = await base44.functions.invoke('fixPaymentAllocations', {});
      setUpdateMessage(response.data.message);
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    } catch (error) {
      setUpdateMessage('Error fixing payment allocations: ' + error.message);
    } finally {
      setFixingAllocations(false);
    }
  };

  const handleBulkStatusUpdate = async () => {
    if (!bulkStatus || selectedPaymentIds.size === 0) return;
    setBulkUpdating(true);
    const idsToUpdate = [...selectedPaymentIds];
    for (const id of idsToUpdate) {
      const old = payments.find(p => p.id === id) || null;
      await base44.entities.Payment.update(id, { status: bulkStatus });
      auditUpdate('Payment', id, { status: bulkStatus }, old).catch(e => console.error('[Audit]', e));
    }
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    setSelectedPaymentIds(new Set());
    setBulkStatus("");
    setBulkUpdating(false);
    toast({ title: "Success", description: `Updated ${idsToUpdate.length} payment(s) to "${bulkStatus}".` });
  };

  const toggleSelectPayment = (id) => {
    setSelectedPaymentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedPaymentIds.size === sortedPayments.length) {
      setSelectedPaymentIds(new Set());
    } else {
      setSelectedPaymentIds(new Set(sortedPayments.map(p => p.id)));
    }
  };

  const handleUnallocate = (allocation) => {
    if (viewingPayment) {
      unallocateMutation.mutate({
        payment: viewingPayment,
        allocationToRemove: allocation
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Export allocations to CSV
  const exportAllocations = () => {
    const rows = [];
    rows.push(['Payment Date', 'Payment Month', 'Payer', 'Payment Method', 'Reference Number', 'Payment Total', 'Payment Status', 'Payment Notes', 'Invoice Number', 'Program Group', 'Provider Name', 'Allocation Amount', 'Allocation Notes']);

    payments.forEach(payment => {
      if (payment.allocations && payment.allocations.length > 0) {
        payment.allocations.forEach(allocation => {
          const invoice = invoices.find(inv => inv.id === allocation.invoice_id);
          const provider = providers.find(p => p.id === allocation.provider_id);

          rows.push([
            format(parseISO(payment.payment_date), 'yyyy-MM-dd'),
            payment.payment_month || '',
            payment.payer || '',
            payment.payment_method || '',
            payment.reference_number || '',
            payment.total_amount || 0,
            payment.status || '',
            payment.notes || '', // Added Payment Notes here
            invoice?.invoice_number || '',
            invoice?.program_group || '',
            provider?.full_name || '',
            allocation.amount || 0,
            allocation.notes || ''
          ]);
        });
      } else {
        rows.push([
          format(parseISO(payment.payment_date), 'yyyy-MM-dd'),
          payment.payment_month || '',
          payment.payer || '',
          payment.payment_method || '',
          payment.reference_number || '',
          payment.total_amount || 0,
          payment.status || '',
          payment.notes || '', // Added Payment Notes here
          '',
          '',
          '',
          '',
          ''
        ]);
      }
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

  // Capitalize first letter
  const capitalize = (str) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // Only process data when all queries have loaded
  if (paymentsLoading || invoicesLoading || providersLoading) {
    return <ListPageSkeleton />;
  }

  const filteredPayments = payments.filter(payment => {
    const matchesSearch = payment.payer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      payment.reference_number?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesUnallocatedFilter = !filterUnallocated || (payment.unallocated_amount !== 0);

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

  const totalPayments = sortedPayments.reduce((sum, payment) => sum + (payment.total_amount || 0), 0);
  const totalUnallocated = sortedPayments.reduce((sum, payment) => sum + (payment.unallocated_amount || 0), 0);

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    cleared: "bg-green-100 text-green-800",
    reversed: "bg-red-100 text-red-800",
    entic_paid: "bg-blue-100 text-blue-800"
  };

  return (
    <>
    <div className="h-screen flex flex-col overflow-hidden bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .print-content, .print-content * { visibility: visible !important; }
          .print-content { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .print-content table { width: 100% !important; border-collapse: collapse !important; margin-top: 1rem !important; }
          .print-content th, .print-content td { border: 1px solid #ddd !important; padding: 8px !important; text-align: left !important; font-size: 10px !important; }
          .print-content th { background-color: #f5f5f5 !important; }
          .print-content .badge { padding: 2px 4px !important; font-size: 8px !important; }
          .print-content h1, .print-content p { color: #000 !important; }
          .print-content .card, .print-content .card-content { border: none !important; box-shadow: none !important; background: none !important; }
          .print-content .overflow-auto { overflow: visible !important; max-height: none !important; }
        }
      `}</style>
      <div className="flex-shrink-0 p-2 md:p-3">
        <div className="max-w-7xl mx-auto w-full space-y-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 no-print">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
            <p className="text-slate-600 text-sm">Track and allocate payments to invoices</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <Button
              onClick={exportAllocations}
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Export Allocations
            </Button>
            <Button
              onClick={handlePrint}
              variant="outline"
              className="gap-2"
            >
              <Printer className="w-4 h-4" />
              Print
            </Button>
            {user?.role === 'admin' && (
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
            )}
          </div>
        </div>

        {updateMessage && (
          <Card className="border-blue-200 bg-blue-50 no-print">
            <CardContent className="p-4">
              <p className="text-sm text-blue-900">{updateMessage}</p>
            </CardContent>
          </Card>
        )}

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 no-print">
          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-green-50 to-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600">Total Payments</p>
                  <div className="text-2xl font-bold text-green-700 mt-1">
                    ${formatCurrency(totalPayments)}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {sortedPayments.length} payment{sortedPayments.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <DollarSign className="w-10 h-10 text-green-600 opacity-20" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm bg-gradient-to-br from-orange-50 to-white">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-600">Unallocated Amount</p>
                  <div className="text-2xl font-bold text-orange-700 mt-1">
                    ${formatCurrency(totalUnallocated)}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Requires allocation
                  </p>
                </div>
                <AlertCircle className="w-10 h-10 text-orange-600 opacity-20" />
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
            isReadOnly={user?.role !== 'admin'}
          />
        )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-4 md:px-6 pb-4">
        <div className="max-w-7xl mx-auto w-full h-full">
        <div className="print-content h-full flex flex-col">
          <div className="hidden print:block mb-4 flex-shrink-0">
            <h1 className="text-2xl font-bold mb-1">Payments Report</h1>
            <p className="text-sm text-gray-600">Generated on {formatDateToEST(new Date())}</p>
          </div>

          <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm card h-full flex flex-col">
            <CardHeader className="border-b border-slate-100 space-y-4 no-print flex-shrink-0">
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
              {selectedPaymentIds.size > 0 && (
                <div className="flex items-center gap-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="text-sm font-medium text-blue-800">{selectedPaymentIds.size} selected</span>
                  <Select value={bulkStatus} onValueChange={setBulkStatus}>
                    <SelectTrigger className="w-44 h-8 text-xs">
                      <SelectValue placeholder="Set status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="reversed">Reversed</SelectItem>
                      <SelectItem value="entic_paid">ENTIC Paid</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    onClick={handleBulkStatusUpdate}
                    disabled={!bulkStatus || bulkUpdating}
                    className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                  >
                    {bulkUpdating ? "Updating..." : "Apply"}
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setSelectedPaymentIds(new Set())}>
                    Clear
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0 card-content flex-1 overflow-hidden">
              <div className="overflow-auto h-full print:max-h-none print:overflow-visible">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 w-8 no-print">
                        <Checkbox
                          checked={sortedPayments.length > 0 && selectedPaymentIds.size === sortedPayments.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-700 w-12">
                        #
                      </th>
                      <th
                        className="text-left px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 no-print"
                        onClick={() => handleSort('payment_date')}
                      >
                        Payment Date <SortIcon field="payment_date" />
                      </th>
                      <th
                        className="text-left px-3 py-2 text-xs font-semibold text-slate-700 print:block hidden"
                      >
                        Payment Date
                      </th>
                      <th
                        className="text-left px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('payment_month')}
                      >
                        Month <SortIcon field="payment_month" />
                      </th>
                      <th
                        className="text-left px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('payer')}
                      >
                        Payer <SortIcon field="payer" />
                      </th>
                      <th
                        className="text-left px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('payment_method')}
                      >
                        Method <SortIcon field="payment_method" />
                      </th>
                      <th
                        className="text-left px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('reference_number')}
                      >
                        Reference <SortIcon field="reference_number" />
                      </th>
                      <th
                        className="text-left px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('total_amount')}
                      >
                        Amount <SortIcon field="total_amount" />
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-700">
                        Unallocated
                      </th>
                      <th
                        className="text-left px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('status')}
                      >
                        Status <SortIcon field="status" />
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-700">Linked Invoices</th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-700">Allocations</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-700 no-print">Actions</th>
                      </tr>
                      </thead>
                      <tbody>
                    {sortedPayments.map((payment, index) => (
                      <tr key={payment.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                        selectedPaymentIds.has(payment.id) ? 'bg-blue-50' : payment.unallocated_amount > 0 ? 'bg-orange-50/30' : ''
                      }`}>
                        <td className="px-3 py-2 no-print">
                          <Checkbox
                            checked={selectedPaymentIds.has(payment.id)}
                            onCheckedChange={() => toggleSelectPayment(payment.id)}
                          />
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500 font-medium">
                          {index + 1}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">
                          {formatDateToEST(payment.payment_date)}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">
                          {payment.payment_month || '-'}
                        </td>
                        <td className="px-3 py-2 text-xs font-medium text-slate-900">{payment.payer}</td>
                        <td className="px-3 py-2 text-xs text-slate-600">{payment.payment_method?.replace(/_/g, ' ')}</td>
                        <td className="px-3 py-2 text-xs text-slate-600 font-mono">
                          {payment.reference_number || '-'}
                        </td>
                        <td className="px-3 py-2 text-xs font-medium text-green-600">
                          ${formatCurrency(payment.total_amount || 0)}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {payment.unallocated_amount > 0 ? (
                            <span className="font-bold text-orange-600">
                              ${formatCurrency(payment.unallocated_amount)}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={`${statusColors[payment.status]} badge text-[10px]`}>
                            {payment.status === 'entic_paid' ? 'ENTIC Paid' : capitalize(payment.status)}
                          </Badge>
                        </td>
                        <td className="px-3 py-2">
                          {payment.allocations && payment.allocations.length > 0 ? (
                            <div className="space-y-1">
                              {payment.allocations.map((allocation, idx) => {
                                const invoice = invoices.find(inv => inv.id === allocation.invoice_id);
                                return (
                                  <div key={idx} className="text-[10px]">
                                    <span className="font-medium text-slate-900">
                                      {invoice?.invoice_number || 'N/A'}
                                    </span>
                                    {invoice?.month && (
                                      <span className="text-slate-500 ml-1">
                                        ({invoice.month})
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[10px]">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600">
                          {payment.allocations?.length || 0} {payment.allocations?.length === 1 ? 'Allocation' : 'Allocations'}
                        </td>
                        <td className="px-3 py-2 text-right no-print">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setViewingPayment(payment)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {user?.role === 'admin' && (
                              <>
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
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sortedPayments.length === 0 && (
                  <div className="p-4">
                    <EmptyState
                      title="No payments found"
                      description={searchTerm ? "Try adjusting your search terms" : "Record your first payment"}
                      action={
                        !searchTerm && user?.role === 'admin' && (
                          <Button
                            onClick={() => {
                              setEditingPayment(null);
                              setShowForm(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 mt-4"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Record Payment
                          </Button>
                        )
                      }
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </div>

      {viewingPayment && (
        <PaymentDetailModal
          payment={viewingPayment}
          invoices={invoices}
          providers={providers}
          onClose={() => setViewingPayment(null)}
          onUnallocate={handleUnallocate}
          isReadOnly={user?.role !== 'admin'}
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
    </>
  );
}