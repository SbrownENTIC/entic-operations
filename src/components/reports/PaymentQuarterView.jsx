import React from "react";
import { format, parseISO } from "date-fns";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const ALLOWED_GROUPS = ['Hartford Hospital', 'UConn', 'HH - Manchester / ECHN', 'St. Francis'];

// Normalize Manchester variants to the canonical name
const normalizeGroup = (name) => {
  if (!name) return '';
  const lower = name.toLowerCase();
  if (lower.includes('manchester') || lower.includes('echn')) return 'HH - Manchester / ECHN';
  return name;
};

const getQuarter = (dateStr) => {
  const d = parseISO(dateStr);
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `Q${q} ${d.getFullYear()}`;
};

// Sort quarters newest first: "Q4 2025" > "Q3 2025" > ...
const sortQuartersDesc = (a, b) => {
  const [qa, ya] = [parseInt(a.slice(1, 2)), parseInt(a.slice(3))];
  const [qb, yb] = [parseInt(b.slice(1, 2)), parseInt(b.slice(3))];
  if (yb !== ya) return yb - ya;
  return qb - qa;
};

export default function PaymentQuarterView({ payments, invoices, providers, formatCurrency, onExport }) {
  // Build flat rows: only allocations where the linked invoice belongs to an allowed group
  const rows = [];

  payments.forEach(payment => {
    if (!payment.payment_date) return;
    (payment.allocations || []).forEach(allocation => {
      const invoice = invoices.find(inv => inv.id === allocation.invoice_id);
      const rawGroup = invoice?.program_group || '';
      const group = normalizeGroup(rawGroup);
      if (!ALLOWED_GROUPS.includes(group)) return;

      const provider = providers.find(p => p.id === allocation.provider_id);
      rows.push({
        quarter: getQuarter(payment.payment_date),
        paymentDate: payment.payment_date,
        programGroup: group,
        provider: provider?.full_name || '-',
        invoiceNumber: invoice?.invoice_number || '-',
        amount: allocation.amount || 0,
      });
    });
  });

  // Group by quarter
  const byQuarter = {};
  rows.forEach(row => {
    if (!byQuarter[row.quarter]) byQuarter[row.quarter] = [];
    byQuarter[row.quarter].push(row);
  });

  const sortedQuarters = Object.keys(byQuarter).sort(sortQuartersDesc);

  const handleExport = () => {
    const csvRows = [
      ['Payment Quarter View — Hartford Hospital, UConn, HH - Manchester / ECHN, St. Francis'],
      [],
      ['Payment Quarter', 'Program Group', 'Provider', 'Invoice Number', 'Allocation Amount', 'Payment Date'],
    ];

    sortedQuarters.forEach(quarter => {
      byQuarter[quarter].forEach(row => {
        csvRows.push([
          quarter,
          row.programGroup,
          row.provider,
          row.invoiceNumber,
          row.amount,
          format(parseISO(row.paymentDate), 'yyyy-MM-dd'),
        ]);
      });
      const total = byQuarter[quarter].reduce((s, r) => s + r.amount, 0);
      csvRows.push([`${quarter} TOTAL`, '', '', '', total, '']);
      csvRows.push([]);
    });

    onExport(csvRows, 'payment_quarter_view');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Showing allocations for: <span className="font-medium text-slate-700">Hartford Hospital, UConn, HH - Manchester / ECHN, St. Francis</span>
        </p>
        <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          Export to CSV
        </Button>
      </div>

      {sortedQuarters.length === 0 && (
        <div className="text-center py-12 text-slate-400">No payment data found for the selected program groups.</div>
      )}

      {sortedQuarters.map(quarter => {
        const quarterRows = byQuarter[quarter];
        const quarterTotal = quarterRows.reduce((s, r) => s + r.amount, 0);
        return (
          <div key={quarter} className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="bg-slate-700 text-white px-4 py-2 flex items-center justify-between">
              <span className="font-semibold">{quarter}</span>
              <span className="text-sm font-medium">{formatCurrency(quarterTotal)}</span>
            </div>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-3 font-semibold text-slate-700">Program Group</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Provider</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Invoice Number</th>
                    <th className="text-right p-3 font-semibold text-slate-700">Allocation Amount</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Payment Date</th>
                  </tr>
                </thead>
                <tbody>
                  {quarterRows.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-3 text-slate-700">{row.programGroup}</td>
                      <td className="p-3 text-slate-900">{row.provider}</td>
                      <td className="p-3 text-slate-600">{row.invoiceNumber}</td>
                      <td className="p-3 text-right font-medium text-slate-900">{formatCurrency(row.amount)}</td>
                      <td className="p-3 text-slate-600">{format(parseISO(row.paymentDate), 'MM/dd/yyyy')}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold border-t border-slate-200">
                    <td className="p-3" colSpan={3}>Quarter Total</td>
                    <td className="p-3 text-right text-slate-900">{formatCurrency(quarterTotal)}</td>
                    <td className="p-3" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}