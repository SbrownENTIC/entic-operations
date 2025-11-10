
import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import InvoiceForm from "../components/invoices/InvoiceForm";

export default function Invoices() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [preselectedIncomes, setPreselectedIncomes] = useState([]);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: invoices = [] } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => base44.entities.Invoice.list('-invoice_date')
  });

  const { data: incomes = [] } = useQuery({
    queryKey: ['outside-income'],
    queryFn: () => base44.entities.OutsideIncome.list()
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
      
      // Update outside income records with invoice_id
      if (data.outside_income_ids && data.outside_income_ids.length > 0) {
        for (const incomeId of data.outside_income_ids) {
          await base44.entities.OutsideIncome.update(incomeId, {
            invoice_id: invoice.id,
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
    mutationFn: ({ id, data }) => base44.entities.Invoice.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setShowForm(false);
      setEditingInvoice(null);
    }
  });

  const handleSubmit = (data) => {
    if (editingInvoice) {
      updateMutation.mutate({ id: editingInvoice.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredInvoices = invoices.filter(invoice =>
    invoice.program_group?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusColors = {
    draft: "bg-gray-100 text-gray-800",
    sent: "bg-blue-100 text-blue-800",
    partial: "bg-yellow-100 text-yellow-800",
    paid: "bg-green-100 text-green-800",
    overdue: "bg-red-100 text-red-800"
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
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Invoice #</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Program Group</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Date</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Total</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Paid</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Balance</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Status</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((invoice) => (
                    <tr key={invoice.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-900">{invoice.invoice_number || '-'}</td>
                      <td className="p-4 text-slate-600">{invoice.program_group}</td>
                      <td className="p-4 text-slate-600">
                        {format(parseISO(invoice.invoice_date), 'MMM d, yyyy')}
                      </td>
                      <td className="p-4 font-medium text-slate-900">
                        ${invoice.total?.toFixed(2)}
                      </td>
                      <td className="p-4 text-green-600 font-medium">
                        ${(invoice.amount_received || 0).toFixed(2)}
                      </td>
                      <td className="p-4 font-medium text-slate-900">
                        ${((invoice.total || 0) - (invoice.amount_received || 0)).toFixed(2)}
                      </td>
                      <td className="p-4">
                        <Badge className={statusColors[invoice.status]}>
                          {invoice.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredInvoices.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No invoices found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
