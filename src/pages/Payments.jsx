import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Pencil, Trash2 } from "lucide-react";
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
  const queryClient = useQueryClient();

  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list('-payment_date')
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list()
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Calculate unallocated amount
      const totalAllocated = data.allocations?.reduce((sum, a) => sum + (a.amount || 0), 0) || 0;
      const unallocated = data.total_amount - totalAllocated;
      
      // Auto-update status to entic_paid if fully allocated
      const status = unallocated === 0 ? 'entic_paid' : data.status;
      
      const payment = await base44.entities.Payment.create({
        ...data,
        unallocated_amount: unallocated,
        status: status
      });
      
      // Update invoices with payment amounts
      if (data.allocations && data.allocations.length > 0) {
        for (const allocation of data.allocations) {
          if (allocation.invoice_id) {
            const invoice = invoices.find(inv => inv.id === allocation.invoice_id);
            if (invoice) {
              const newAmountReceived = (invoice.amount_received || 0) + allocation.amount;
              
              await base44.entities.Invoice.update(allocation.invoice_id, {
                amount_received: newAmountReceived
              });
            }
          }
        }
      }
      
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
      // Calculate unallocated amount
      const totalAllocated = data.allocations?.reduce((sum, a) => sum + (a.amount || 0), 0) || 0;
      const unallocated = data.total_amount - totalAllocated;
      
      // Auto-update status to entic_paid if fully allocated
      const status = unallocated === 0 ? 'entic_paid' : data.status;
      
      return base44.entities.Payment.update(id, {
        ...data,
        unallocated_amount: unallocated,
        status: status
      });
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
      // Reverse invoice updates
      if (payment.allocations && payment.allocations.length > 0) {
        for (const allocation of payment.allocations) {
          if (allocation.invoice_id) {
            const invoice = invoices.find(inv => inv.id === allocation.invoice_id);
            if (invoice) {
              const newAmountReceived = Math.max(0, (invoice.amount_received || 0) - allocation.amount);
              
              await base44.entities.Invoice.update(allocation.invoice_id, {
                amount_received: newAmountReceived
              });
            }
          }
        }
      }
      
      await base44.entities.Payment.delete(payment.id);
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

  const filteredPayments = payments.filter(payment =>
    payment.payer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.reference_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search payments..."
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
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Payment Date</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Payer</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Method</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Reference</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Amount</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Status</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Allocations</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr key={payment.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-slate-600">
                        {format(parseISO(payment.payment_date), 'MMM d, yyyy')}
                      </td>
                      <td className="p-4 font-medium text-slate-900">{payment.payer}</td>
                      <td className="p-4 text-slate-600">{payment.payment_method?.replace(/_/g, ' ')}</td>
                      <td className="p-4 text-slate-600 font-mono text-sm">
                        {payment.reference_number || '-'}
                      </td>
                      <td className="p-4 font-medium text-green-600">
                        ${payment.total_amount?.toFixed(2) || '0.00'}
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
              {filteredPayments.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No payments found
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