import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ExternalLink, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";

export default function FinancialDetailModal({ isOpen, onClose, title, invoices, providers, payments = [], type, programGroup }) {
  const [sortField, setSortField] = React.useState(null);
  const [sortDirection, setSortDirection] = React.useState('desc');

  const formatCurrency = (amount) => {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getStatusLabel = (invoice) => {
    if (invoice.status === 'paid_to_entic') return 'Paid to ENTIC';
    if (invoice.status === 'provider_paid') return 'Provider Paid';
    if (invoice.status === 'partial') return 'Partial';
    return invoice.status?.replace(/_/g, ' ');
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

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedInvoices = React.useMemo(() => {
    if (!sortField) return invoices;
    
    return [...invoices].sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];
      
      if (sortField === 'provider') {
      aValue = providers.find(p => p.id === a.staff_member_id)?.full_name || '';
      bValue = providers.find(p => p.id === b.staff_member_id)?.full_name || '';
      } else if (sortField === 'quarter') {
      const getQuarterTimestamp = (inv) => {
        const linkedPayments = payments.filter(p => 
          p.allocations?.some(a => a.invoice_id === inv.id)
        );
        if (linkedPayments.length > 0) {
          const latest = [...linkedPayments].sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))[0];
          return latest && latest.payment_date ? new Date(latest.payment_date).getTime() : 0;
        }
        return 0;
      };
      aValue = getQuarterTimestamp(a);
      bValue = getQuarterTimestamp(b);
      } else if (sortField === 'invoice_date') {
        aValue = new Date(a.invoice_date || 0);
        bValue = new Date(b.invoice_date || 0);
      } else if (sortField === 'month') {
        const getMonthValue = (str) => {
          if (!str) return 0;
          // Try parsing as date first (handles "January 2025")
          const date = new Date(str);
          if (!isNaN(date.getTime())) return date.getTime();
          
          // Fallback for just month names
          const months = {
            'january': 1, 'jan': 1, 'february': 2, 'feb': 2, 'march': 3, 'mar': 3, 
            'april': 4, 'apr': 4, 'may': 5, 'june': 6, 'jun': 6, 'july': 7, 'jul': 7, 
            'august': 8, 'aug': 8, 'september': 9, 'sep': 9, 'october': 10, 'oct': 10, 
            'november': 11, 'nov': 11, 'december': 12, 'dec': 12
          };
          const val = months[str.toString().toLowerCase().split(' ')[0]] || 0;
          return val;
        };
        aValue = getMonthValue(a.month);
        bValue = getMonthValue(b.month);
      } else if (sortField === 'outstanding') {
        aValue = (a.amount_expected || a.total || 0) - (a.amount_received || 0);
        bValue = (b.amount_expected || b.total || 0) - (b.amount_received || 0);
      } else if (['total', 'amount_received'].includes(sortField)) {
        aValue = parseFloat(aValue || 0);
        bValue = parseFloat(bValue || 0);
      } else {
        aValue = String(aValue || '').toLowerCase();
        bValue = String(bValue || '').toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [invoices, sortField, sortDirection, providers]);

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 inline opacity-30" />;
    return sortDirection === 'asc' ? 
      <ArrowUp className="w-3 h-3 ml-1 inline" /> : 
      <ArrowDown className="w-3 h-3 ml-1 inline" />;
  };

  // Calculate total for this view
  let totalAmount = 0;
  if (type === 'paidToENTIC') {
    totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount_received || 0), 0);
  } else if (type === 'owedToProviders') {
    totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount_received || 0), 0);
  } else if (type === 'outstanding') {
    totalAmount = invoices.reduce((sum, inv) => {
      const outstanding = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
      return sum + outstanding;
    }, 0);
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{title}</span>
            <span className="text-2xl font-bold text-blue-600">{formatCurrency(totalAmount)}</span>
          </DialogTitle>
          {programGroup && (
            <p className="text-sm text-slate-500">Program/Location: {programGroup}</p>
          )}
        </DialogHeader>
        
        <div className="space-y-3 mt-4">
          {sortedInvoices.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No invoices found for this category
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th 
                      className="text-left p-3 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('invoice_number')}
                    >
                      Invoice # <SortIcon field="invoice_number" />
                    </th>
                    <th 
                      className="text-left p-3 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('program_group')}
                    >
                      Program <SortIcon field="program_group" />
                    </th>
                    <th 
                      className="text-left p-3 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('provider')}
                    >
                      Provider <SortIcon field="provider" />
                    </th>
                    <th 
                      className="text-left p-3 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('month')}
                    >
                      Month <SortIcon field="month" />
                    </th>
                    <th 
                      className="text-left p-3 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('invoice_date')}
                    >
                      Date <SortIcon field="invoice_date" />
                    </th>
                    <th 
                      className="text-left p-3 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('quarter')}
                    >
                      Quarter <SortIcon field="quarter" />
                    </th>
                    <th 
                      className="text-left p-3 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('quarter')}
                    >
                      Payment Date <SortIcon field="quarter" />
                    </th>
                    <th 
                      className="text-right p-3 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('total')}
                    >
                      Total <SortIcon field="total" />
                    </th>
                    {type === 'paidToENTIC' || type === 'owedToProviders' ? (
                      <th 
                        className="text-right p-3 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none"
                        onClick={() => handleSort('amount_received')}
                      >
                        Received <SortIcon field="amount_received" />
                      </th>
                    ) : (
                      <th 
                        className="text-right p-3 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none"
                        onClick={() => handleSort('outstanding')}
                      >
                        Outstanding <SortIcon field="outstanding" />
                      </th>
                    )}
                    <th 
                      className="text-left p-3 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 select-none"
                      onClick={() => handleSort('status')}
                    >
                      Status <SortIcon field="status" />
                    </th>
                    <th className="text-center p-3 text-xs font-semibold text-slate-700">View</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedInvoices.map((invoice) => {
                    const provider = providers.find(p => p.id === invoice.staff_member_id);
                    const outstanding = (invoice.amount_expected || invoice.total || 0) - (invoice.amount_received || 0);

                    return (
                      <tr key={invoice.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 text-sm font-medium text-slate-900">
                          {invoice.invoice_number || '-'}
                        </td>
                        <td className="p-3 text-sm text-slate-600">{invoice.program_group}</td>
                        <td className="p-3 text-sm text-slate-900">{provider?.full_name || '-'}</td>
                        <td className="p-3 text-sm text-slate-600">{invoice.month || '-'}</td>
                        <td className="p-3 text-sm text-slate-600">
                          {format(parseISO(invoice.invoice_date), 'MMM d, yyyy')}
                        </td>
                        <td className="p-3 text-sm text-slate-600">
                          {(() => {
                            const linkedPayments = payments.filter(p => 
                              p.allocations?.some(a => a.invoice_id === invoice.id)
                            );
                            if (linkedPayments.length > 0) {
                              const latest = [...linkedPayments].sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))[0];
                              if (latest && latest.payment_date) {
                                const d = parseISO(latest.payment_date);
                                return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
                              }
                            }
                            return '-';
                          })()}
                        </td>
                        <td className="p-3 text-sm text-right font-medium text-slate-900">
                          {formatCurrency(invoice.total || 0)}
                        </td>
                        {type === 'paidToENTIC' || type === 'owedToProviders' ? (
                          <td className="p-3 text-sm text-right font-medium text-green-600">
                            {formatCurrency(invoice.amount_received || 0)}
                          </td>
                        ) : (
                          <td className="p-3 text-sm text-right font-medium text-orange-600">
                            {formatCurrency(outstanding)}
                          </td>
                        )}
                        <td className="p-3">
                          <Badge className={`${statusColors[invoice.status]} text-xs`}>
                            {getStatusLabel(invoice)}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Link 
                            to={`${createPageUrl("Invoices")}?edit=${invoice.id}`}
                            className="text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot className="bg-slate-50 border-t-2 border-slate-300">
                  <tr>
                    <td colSpan="5" className="p-3 text-sm font-bold text-slate-900">Total</td>
                    <td className="p-3 text-sm text-right font-bold text-slate-900">
                      {formatCurrency(invoices.reduce((sum, inv) => sum + (inv.total || 0), 0))}
                    </td>
                    <td className="p-3 text-sm text-right font-bold text-blue-600">
                      {formatCurrency(totalAmount)}
                    </td>
                    <td colSpan="3"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}