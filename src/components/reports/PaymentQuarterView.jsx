import React from "react";
import { format, parseISO } from "date-fns";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import ExcelJS from "exceljs";

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
        referenceNumber: payment.reference_number || '',
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

  const handleExport = async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Payment Quarter Allocation Summary');

    const COLS = 7; // A–G

    // ── Title block ──────────────────────────────────────────────────────────
    const titleRow = sheet.addRow(['Payment Allocation by Quarter']);
    titleRow.getCell(1).font = { bold: true, size: 14 };
    sheet.mergeCells(`A1:G1`);

    const subtitleRow = sheet.addRow([`Generated: ${format(new Date(), 'MMMM dd, yyyy')}`]);
    subtitleRow.getCell(1).font = { italic: true, size: 10, color: { argb: 'FF666666' } };
    sheet.mergeCells(`A2:G2`);

    sheet.addRow([]); // spacer row 3

    // ── Header row (row 4) ───────────────────────────────────────────────────
    // Col order: 1=Quarter 2=ProgramGroup 3=Provider 4=PaymentDate 5=Check/Voucher 6=InvoiceNum 7=Amount
    const headers = ['Payment Quarter', 'Program Group', 'Provider', 'Payment Date', 'Check/Voucher Number', 'Invoice Number', 'Allocation Amount'];
    const headerRow = sheet.addRow(headers);
    headerRow.eachCell(cell => {
      cell.font = { bold: true, size: 11, color: { argb: 'FF1F3864' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD6E4F0' } };
      cell.alignment = { vertical: 'middle', horizontal: cell.col === 7 ? 'right' : 'left' };
      cell.border = {
        bottom: { style: 'medium', color: { argb: 'FF4472C4' } },
      };
    });

    // Freeze row 4 (the header) — freeze below row 4
    sheet.views = [{ state: 'frozen', ySplit: 4 }];

    // AutoFilter on header row
    sheet.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: COLS } };

    // ── Data rows ────────────────────────────────────────────────────────────
    // Build sorted flat rows: quarter desc → program group asc → provider asc
    const allDataRows = [];
    sortedQuarters.forEach(quarter => {
      const sorted = [...byQuarter[quarter]].sort((a, b) => {
        const gCmp = a.programGroup.localeCompare(b.programGroup);
        if (gCmp !== 0) return gCmp;
        return a.provider.localeCompare(b.provider);
      });
      sorted.forEach(row => allDataRows.push({ ...row, quarter }));
    });

    // Convert "Q2 2026" → "2026 Q2" for display
    const fmtQuarter = (q) => {
      const m = q.match(/^Q(\d)\s+(\d{4})$/);
      return m ? `${m[2]} Q${m[1]}` : q;
    };

    const lightBand = 'FFF2F7FB';
    const whiteBand = 'FFFFFFFF';

    allDataRows.forEach((row, idx) => {
      const dataRow = sheet.addRow([
        fmtQuarter(row.quarter),
        row.programGroup,
        row.provider,
        parseISO(row.paymentDate),
        String(row.referenceNumber || ''),
        row.invoiceNumber,
        row.amount,
      ]);

      const bandColor = idx % 2 === 0 ? lightBand : whiteBand;

      dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bandColor } };
        cell.font = { size: 10 };
        cell.alignment = { vertical: 'middle' };

        if (colNumber === 4) { cell.numFmt = 'mm/dd/yyyy'; }
        if (colNumber === 5) { cell.numFmt = '@'; } // text format — preserve leading zeros
        if (colNumber === 7) {
          cell.numFmt = '$#,##0.00';
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        }
      });
    });

    // ── Quarter subtotal rows ─────────────────────────────────────────────────
    // Re-iterate to add subtotals per quarter group
    // Rebuild with subtotals inline
    // (clear data rows and redo with subtotals)
    // Simpler approach: we already added all rows above; add subtotals at the end per quarter
    // Actually, let's rebuild the sheet data section with subtotals grouped.
    // To keep it clean, we'll wipe data rows (rows 5+) and redo.

    // Remove the rows we just added
    while (sheet.rowCount > 4) {
      sheet.spliceRows(5, 1);
    }

    // Re-add with subtotals
    let rowIdx = 0;
    sortedQuarters.forEach(quarter => {
      const sorted = [...byQuarter[quarter]].sort((a, b) => {
        const gCmp = a.programGroup.localeCompare(b.programGroup);
        if (gCmp !== 0) return gCmp;
        return a.provider.localeCompare(b.provider);
      });

      sorted.forEach(row => {
        const dataRow = sheet.addRow([
          fmtQuarter(quarter),
          row.programGroup,
          row.provider,
          parseISO(row.paymentDate),
          String(row.referenceNumber || ''),
          row.invoiceNumber,
          row.amount,
        ]);
        const bandColor = rowIdx % 2 === 0 ? lightBand : whiteBand;
        dataRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bandColor } };
          cell.font = { size: 10 };
          cell.alignment = { vertical: 'middle' };
          if (colNumber === 4) { cell.numFmt = 'mm/dd/yyyy'; }
          if (colNumber === 5) { cell.numFmt = '@'; }
          if (colNumber === 7) { cell.numFmt = '$#,##0.00'; cell.alignment = { vertical: 'middle', horizontal: 'right' }; }
        });
        rowIdx++;
      });

      // Subtotal row for this quarter
      const qTotal = sorted.reduce((s, r) => s + r.amount, 0);
      const subtotalRow = sheet.addRow([`${fmtQuarter(quarter)} — Total`, '', '', '', '', '', qTotal]);
      subtotalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        cell.font = { bold: true, size: 10, color: { argb: 'FF1F3864' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDAE3F3' } };
        cell.alignment = { vertical: 'middle' };
        if (colNumber === 7) { cell.numFmt = '$#,##0.00'; cell.alignment = { vertical: 'middle', horizontal: 'right' }; }
        cell.border = { top: { style: 'thin', color: { argb: 'FF4472C4' } }, bottom: { style: 'thin', color: { argb: 'FF4472C4' } } };
      });
      rowIdx++;

      // Spacer
      sheet.addRow([]);
      rowIdx++;
    });

    // ── Column widths ────────────────────────────────────────────────────────
    const minWidths = [18, 26, 24, 16, 22, 20, 20];
    sheet.columns.forEach((col, i) => {
      let max = minWidths[i] || 14;
      col.eachCell({ includeEmpty: false }, cell => {
        const len = cell.value ? String(cell.value).length + 2 : 0;
        if (len > max) max = len;
      });
      col.width = Math.min(max, 40);
    });

    // ── Write & download ─────────────────────────────────────────────────────
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Payment_Quarter_Allocation_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Showing allocations for: <span className="font-medium text-slate-700">Hartford Hospital, UConn, HH - Manchester / ECHN, St. Francis</span>
        </p>
        <Button onClick={handleExport} variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          Export to Excel
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
                    <th className="text-left p-3 font-semibold text-slate-700">Payment Date</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Check/Voucher #</th>
                    <th className="text-left p-3 font-semibold text-slate-700">Invoice Number</th>
                    <th className="text-right p-3 font-semibold text-slate-700">Allocation Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {quarterRows.map((row, idx) => (
                    <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-3 text-slate-700">{row.programGroup}</td>
                      <td className="p-3 text-slate-900">{row.provider}</td>
                      <td className="p-3 text-slate-600">{format(parseISO(row.paymentDate), 'MM/dd/yyyy')}</td>
                      <td className="p-3 text-slate-600 font-mono">{row.referenceNumber || '-'}</td>
                      <td className="p-3 text-slate-600">{row.invoiceNumber}</td>
                      <td className="p-3 text-right font-medium text-slate-900">{formatCurrency(row.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-semibold border-t border-slate-200">
                    <td className="p-3" colSpan={4}>Quarter Total</td>
                    <td className="p-3" />
                    <td className="p-3 text-right text-slate-900">{formatCurrency(quarterTotal)}</td>
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