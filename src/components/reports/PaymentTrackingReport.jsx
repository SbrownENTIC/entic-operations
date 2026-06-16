import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Building2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import {
  isDirectorshipOutsideIncome,
  getLinkedIncomes,
  getInvoiceTypeSplit,
  splitReceivedFromPayments,
  inferSplitTypeFromAmount,
  getSplitInvoicePaymentAttribution,
} from "@/lib/stFrancisPaymentSplit";

// ── Payment Quarter View helpers (mirrors PaymentQuarterView.jsx logic) ──────
const QUARTER_ALLOWED_GROUPS = ['Hartford Hospital', 'UConn', 'HH - Manchester / ECHN', 'St. Francis'];

const normalizeQGroup = (name) => {
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

const sortQuartersDesc = (a, b) => {
  const [qa, ya] = [parseInt(a.slice(1, 2)), parseInt(a.slice(3))];
  const [qb, yb] = [parseInt(b.slice(1, 2)), parseInt(b.slice(3))];
  if (yb !== ya) return yb - ya;
  return qb - qa;
};

const getOutsideIncomeProgramGroup = (income, programLocations = [], normalizeGroup) => {
  if (!income) return '';
  if (income.program_location_id) {
    const loc = programLocations.find((pl) => pl.id === income.program_location_id);
    if (loc?.program_group) return normalizeGroup(loc.program_group);
  }
  return normalizeGroup(income.facility_name || '');
};

const isDirectorshipInvoice = (invoice, outsideIncome = [], programLocations = []) => {
  if (!invoice) return false;
  if (invoice.invoice_number?.includes('(Directorship)')) return true;
  return getLinkedIncomes(invoice, outsideIncome).some((inc) =>
    isDirectorshipOutsideIncome(inc, programLocations)
  );
};

const getIncomeMonthLabel = (income) => {
  const dateStr = Array.isArray(income?.work_dates) && income.work_dates[0]
    ? income.work_dates[0]
    : income?.created_date;
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), 'MMMM yyyy');
  } catch {
    return '';
  }
};

const formatPaymentMeta = (attribution) => {
  if (!attribution?.payment?.payment_date) {
    return { paymentDate: '', voucherNumber: '', paymentQuarter: '', paymentNotes: '' };
  }
  const pDate = parseISO(attribution.payment.payment_date);
  const q = Math.floor(pDate.getMonth() / 3) + 1;
  return {
    paymentDate: format(pDate, 'MM/dd/yyyy'),
    paymentQuarter: `Q${q} ${pDate.getFullYear()}`,
    voucherNumber: attribution.payment.reference_number || '',
    paymentNotes: attribution.notes || '',
  };
};

const buildSeparatedProgramSections = ({
  programGroup,
  groupInvoices,
  payments,
  providers,
  outsideIncome,
  programLocations,
  sortByMonth,
  normalizeGroup,
}) => {
  const headers = [
    'Provider', 'Invoice Number', 'Month', 'Expected Payment', 'Payment Received',
    'Payment Date', 'Payment Quarter', 'Voucher Number', 'Date Paid Provider', 'Allocation/Notes',
  ];

  const directorshipSection = {
    title: `${programGroup} - DIRECTORSHIP TRACKING`,
    headers,
    rows: [],
  };
  const onCallSection = {
    title: `${programGroup} - ON-CALL TRACKING`,
    headers,
    rows: [],
  };

  const pushTrackingRow = (section, {
    providerName,
    invoiceNumber,
    month,
    expectedAmount,
    receivedAmount,
    paymentMeta,
    dateProviderPaid = '',
    notes = '',
  }) => {
    section.rows.push([
      providerName,
      invoiceNumber || '',
      month || '',
      expectedAmount,
      receivedAmount,
      paymentMeta.paymentDate,
      paymentMeta.paymentQuarter,
      paymentMeta.voucherNumber,
      dateProviderPaid,
      notes,
    ]);
  };

  sortByMonth(groupInvoices);

  groupInvoices.forEach((invoice) => {
    const provider = providers.find((p) => p.id === invoice.staff_member_id);
    const providerName = provider?.full_name || 'Unknown';
    const paymentAttribution = getSplitInvoicePaymentAttribution(
      invoice,
      payments,
      outsideIncome,
      programLocations,
      programGroup
    );
    const directorshipPaymentMeta = formatPaymentMeta(paymentAttribution.directorship);
    const onCallPaymentMeta = formatPaymentMeta(paymentAttribution.onCall);
    const split = getInvoiceTypeSplit(invoice, outsideIncome, programLocations, programGroup);
    const { directorshipReceived, onCallReceived } = splitReceivedFromPayments(
      invoice,
      payments,
      outsideIncome,
      programLocations,
      programGroup
    );
    const shouldHideNotes = invoice.auto_generated || (invoice.notes && (
      invoice.notes.toLowerCase().includes('auto-generated') ||
      invoice.notes.toLowerCase().includes('auto-created')
    ));
    const baseInvoiceNotes = shouldHideNotes ? '' : (invoice.notes || '');
    const dateProviderPaid = invoice.date_provider_paid
      ? format(parseISO(invoice.date_provider_paid), 'MM/dd/yyyy')
      : '';

    if (split.directorshipExpected > 0) {
      pushTrackingRow(directorshipSection, {
        providerName,
        invoiceNumber: invoice.invoice_number,
        month: invoice.month,
        expectedAmount: split.directorshipExpected,
        receivedAmount: split.onCallExpected > 0 ? directorshipReceived : (invoice.amount_received || 0),
        paymentMeta: directorshipReceived > 0 ? directorshipPaymentMeta : formatPaymentMeta(null),
        dateProviderPaid,
        notes: [baseInvoiceNotes, directorshipReceived > 0 ? directorshipPaymentMeta.paymentNotes : '']
          .filter(Boolean)
          .join('; '),
      });
    }

    if (split.onCallExpected > 0) {
      pushTrackingRow(onCallSection, {
        providerName,
        invoiceNumber: invoice.invoice_number,
        month: invoice.month,
        expectedAmount: split.onCallExpected,
        receivedAmount: split.directorshipExpected > 0 ? onCallReceived : (invoice.amount_received || 0),
        paymentMeta: onCallReceived > 0 ? onCallPaymentMeta : formatPaymentMeta(null),
        dateProviderPaid,
        notes: [baseInvoiceNotes, onCallReceived > 0 ? onCallPaymentMeta.paymentNotes : '']
          .filter(Boolean)
          .join('; '),
      });
    }
  });

  const seenOutsideIncomeAllocations = new Set();
  payments.forEach((payment) => {
    if (!payment.payment_date) return;

    payment.allocations?.forEach((allocation) => {
      if (!allocation.outside_income_id || allocation.invoice_id) return;

      const dedupeKey = `${payment.id}:${allocation.outside_income_id}:${allocation.amount}`;
      if (seenOutsideIncomeAllocations.has(dedupeKey)) return;
      seenOutsideIncomeAllocations.add(dedupeKey);

      const income = outsideIncome.find((inc) => inc.id === allocation.outside_income_id);
      if (!income) return;

      const incomeGroup = getOutsideIncomeProgramGroup(income, programLocations, normalizeGroup);
      if (incomeGroup !== programGroup) return;

      const isDirectorship = isDirectorshipOutsideIncome(income, programLocations);
      const section = isDirectorship ? directorshipSection : onCallSection;
      const provider = providers.find((p) => p.id === (allocation.provider_id || income.provider_id));
      const providerName = provider?.full_name || 'Unknown';
      const pDate = parseISO(payment.payment_date);
      const paymentMeta = {
        paymentDate: format(pDate, 'MM/dd/yyyy'),
        paymentQuarter: `Q${Math.floor(pDate.getMonth() / 3) + 1} ${pDate.getFullYear()}`,
        voucherNumber: payment.reference_number || '',
        paymentNotes: '',
      };
      const linkedInvoice = income.invoice_id
        ? groupInvoices.find((inv) => inv.id === income.invoice_id)
        : null;

      pushTrackingRow(section, {
        providerName,
        invoiceNumber: linkedInvoice?.invoice_number || income.external_invoice_number || income.facility_name,
        month: getIncomeMonthLabel(income) || linkedInvoice?.month,
        expectedAmount: income.amount_due || income.total_amount || allocation.amount || 0,
        receivedAmount: allocation.amount || 0,
        paymentMeta,
        notes: [income.description, income.notes].filter(Boolean).join('; '),
      });
    });
  });

  return { directorshipSection, onCallSection };
};

const buildPaymentQuarterRows = (payments, invoices, providers, outsideIncome = [], programLocations = []) => {
  const rows = [];
  payments.forEach(payment => {
    if (!payment.payment_date) return;
    (payment.allocations || []).forEach(allocation => {
      if (allocation.outside_income_id && !allocation.invoice_id && allocation.provider_id) {
        const income = outsideIncome.find((inc) => inc.id === allocation.outside_income_id);
        const programGroup = getOutsideIncomeProgramGroup(income, programLocations, normalizeQGroup);
        if (QUARTER_ALLOWED_GROUPS.includes(programGroup)) {
          rows.push({
            quarter: getQuarter(payment.payment_date),
            paymentDate: payment.payment_date,
            referenceNumber: payment.reference_number || '',
            programGroup,
            provider: providers.find(p => p.id === allocation.provider_id)?.full_name || '-',
            invoiceNumber: income?.external_invoice_number || income?.facility_name || '-',
            isDirectorship: isDirectorshipOutsideIncome(income, programLocations),
            amount: allocation.amount || 0,
          });
          return;
        }

        rows.push({
          quarter: getQuarter(payment.payment_date),
          paymentDate: payment.payment_date,
          referenceNumber: payment.reference_number || '',
          programGroup: 'Other Professional Income',
          provider: providers.find(p => p.id === allocation.provider_id)?.full_name || '-',
          invoiceNumber: '-',
          isDirectorship: false,
          amount: allocation.amount || 0,
        });
        return;
      }

      const invoice = invoices.find(inv => inv.id === allocation.invoice_id);
      const group = normalizeQGroup(invoice?.program_group || '');
      if (!QUARTER_ALLOWED_GROUPS.includes(group)) return;
      const provider = providers.find(p => p.id === allocation.provider_id);
      let isDirectorship = isDirectorshipInvoice(invoice, outsideIncome, programLocations);
      if (allocation.outside_income_id) {
        const taggedIncome = outsideIncome.find((inc) => inc.id === allocation.outside_income_id);
        isDirectorship = isDirectorshipOutsideIncome(taggedIncome, programLocations);
      } else if (invoice) {
        const typeSplit = getInvoiceTypeSplit(invoice, outsideIncome, programLocations, group);
        if (typeSplit.directorshipExpected > 0 && typeSplit.onCallExpected > 0) {
          const inferred = inferSplitTypeFromAmount(invoice, outsideIncome, allocation.amount || 0);
          if (inferred === 'directorship') isDirectorship = true;
          else if (inferred === 'oncall') isDirectorship = false;
        }
      }
      const invoiceNum = invoice?.invoice_number || '-';
      rows.push({
        quarter: getQuarter(payment.payment_date),
        paymentDate: payment.payment_date,
        referenceNumber: payment.reference_number || '',
        programGroup: group,
        provider: provider?.full_name || '-',
        invoiceNumber: invoiceNum,
        isDirectorship,
        amount: allocation.amount || 0,
      });
    });
  });

  // Sort: quarter desc → program group asc → provider asc
  const byQuarter = {};
  rows.forEach(row => {
    if (!byQuarter[row.quarter]) byQuarter[row.quarter] = [];
    byQuarter[row.quarter].push(row);
  });
  const sortedQuarters = Object.keys(byQuarter).sort(sortQuartersDesc);
  const sorted = [];
  sortedQuarters.forEach(quarter => {
    const qRows = [...byQuarter[quarter]].sort((a, b) => {
      const g = a.programGroup.localeCompare(b.programGroup);
      return g !== 0 ? g : a.provider.localeCompare(b.provider);
    });
    qRows.forEach(r => sorted.push(r));
  });
  return sorted;
};
// ─────────────────────────────────────────────────────────────────────────────

export default function PaymentTrackingReport({ invoices, payments, providers, programLocations, outsideIncome, dateRange, formatCurrency, exportToCSV }) {
  const [selectedProgramGroup, setSelectedProgramGroup] = useState('all');
  const [isGenerating, setIsGenerating] = useState(false);

  const sortByMonth = (invoices) => {
    const monthOrder = {
      'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
      'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12
    };

    return invoices.sort((a, b) => {
      if (!a.month || !b.month) return 0;
      const aParts = (a.month || '').split(' ');
      const bParts = (b.month || '').split(' ');
      const aMonth = aParts[0] || '';
      const aYear = aParts[1] || '0';
      const bMonth = bParts[0] || '';
      const bYear = bParts[1] || '0';

      const yearDiff = (parseInt(bYear) || 0) - (parseInt(aYear) || 0);
      if (yearDiff !== 0) return yearDiff;

      return (monthOrder[bMonth] || 0) - (monthOrder[aMonth] || 0);
    });
  };

  const isOtherProfessionalAllocation = (allocation) =>
    allocation.outside_income_id &&
    !allocation.invoice_id &&
    allocation.provider_id;

  const cleanAutoNotes = (notes) => {
    if (!notes) return '';
    const lower = notes.toLowerCase();
    if (lower.includes('auto-generated') || lower.includes('auto-created')) return '';
    return notes;
  };

  const parseUsDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;
    const [month, day, year] = parts;
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  };

  const buildOtherProfessionalIncomeSection = (normalizeGroup) => {
    const headers = [
      'Payment Date',
      'Payment Month',
      'Payer',
      'Provider',
      'Service Date',
      'Expected Payment',
      'Payment Received',
      'Reference Number',
      'Payment Method',
      'Notes',
    ];

    const rows = [];

    payments.forEach((payment) => {
      if (!payment.payment_date) return;

      const pDate = parseISO(payment.payment_date);
      const start = dateRange.start ? parseISO(dateRange.start) : null;
      const end = dateRange.end ? parseISO(dateRange.end) : null;
      if (start && pDate < start) return;
      if (end && pDate > end) return;

      (payment.allocations || []).forEach((allocation) => {
        if (!isOtherProfessionalAllocation(allocation)) return;

        const income = outsideIncome.find((inc) => inc.id === allocation.outside_income_id);
        const provider = providers.find((p) => p.id === allocation.provider_id);
        const facilityName = payment.payer || income?.facility_name || '';

        const separatedProgramGroup = getOutsideIncomeProgramGroup(income, programLocations, normalizeGroup);
        if (separatedProgramGroup === 'St. Francis' || separatedProgramGroup === 'Hartford Hospital') {
          return;
        }

        if (selectedProgramGroup !== 'all') {
          const normalizedFacility = normalizeGroup(facilityName);
          if (
            normalizedFacility !== selectedProgramGroup &&
            facilityName !== selectedProgramGroup
          ) {
            return;
          }
        }

        const serviceDateStr = income?.work_dates?.[0];
        const serviceDate = serviceDateStr ? format(parseISO(serviceDateStr), 'MM/dd/yyyy') : '';
        const paymentDate = format(pDate, 'MM/dd/yyyy');
        const amount = allocation.amount || 0;
        const expectedAmount = income?.amount_due || income?.total_amount || amount;

        const notes = [
          allocation.notes,
          income?.description,
          cleanAutoNotes(income?.notes),
        ].filter(Boolean).join('; ');

        rows.push([
          paymentDate,
          payment.payment_month || '',
          facilityName,
          provider?.full_name || 'Unknown',
          serviceDate,
          expectedAmount,
          amount,
          payment.reference_number || '',
          (payment.payment_method || '').replace(/_/g, ' '),
          notes,
        ]);
      });
    });

    rows.sort((a, b) => {
      const ad = parseUsDate(a[0]);
      const bd = parseUsDate(b[0]);
      if (!ad && !bd) return 0;
      if (!ad) return 1;
      if (!bd) return -1;
      return bd - ad;
    });

    return {
      title: 'Other Professional Income - TRACKING',
      headers,
      rows,
    };
  };

  const downloadBackendReport = async (sections) => {
    try {
      setIsGenerating(true);
      const exportDate = format(new Date(), 'MMMM dd, yyyy');
      const paymentQuarterRows = buildPaymentQuarterRows(payments, invoices, providers, outsideIncome, programLocations);
      
      // Tag Hartford Hospital payments so backend can build the Payment Summary sheet
      const taggedPayments = (payments || []).map(p => {
        const isHartford = (p.payer || '').toLowerCase().includes('hartford') ||
          (p.allocations || []).some(a => (a.notes || '').toLowerCase().includes('hartford'));
        return isHartford ? { ...p, _isHartford: true } : p;
      });

      const response = await base44.functions.invoke('generatePaymentTrackingReports', {
        sections,
        exportDate,
        paymentQuarterRows,
        payments: taggedPayments,
      });

      if (response.data.error) throw new Error(response.data.error);

      // Decode base64 and download zip
      const byteCharacters = atob(response.data.zipContent);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/zip' });
      
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `Outside_Income_Payment_Tracking_Reports_${format(new Date(), 'yyyy-MM-dd')}.zip`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error("Failed to generate report:", error);
      const errorMessage = error.response?.data?.error || error.message || "Unknown error occurred";
      alert(`Failed to generate report: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateReport = () => {
    const filteredInvoices = invoices.filter(inv => {
      if (!inv.invoice_date || typeof inv.invoice_date !== 'string') return false;
      const invDate = parseISO(inv.invoice_date);
      const start = dateRange.start ? parseISO(dateRange.start) : null;
      const end = dateRange.end ? parseISO(dateRange.end) : null;

      if (start && invDate < start) return false;
      if (end && invDate > end) return false;
      
      if (selectedProgramGroup !== 'all' && inv.program_group !== selectedProgramGroup) {
        return false;
      }
      return true;
    });

    const directPayers = ['Quinnipiac University', 'Nations Hearing'];
    const filteredDirectIncome = outsideIncome.filter(inc => {
      if (!directPayers.includes(inc.facility_name)) return false;
      
      const dateStr = Array.isArray(inc.work_dates) && inc.work_dates[0] ? inc.work_dates[0] : inc.created_date;
      if (!dateStr || typeof dateStr !== 'string') return false;
      
      const incDate = parseISO(dateStr);
      const start = dateRange.start ? parseISO(dateRange.start) : null;
      const end = dateRange.end ? parseISO(dateRange.end) : null;

      if (start && incDate < start) return false;
      if (end && incDate > end) return false;
      
      if (selectedProgramGroup !== 'all' && inc.facility_name !== selectedProgramGroup) {
        return false;
      }
      return true;
    });

    const sections = [];

    // Helper to normalize program names (combines Manchester variations)
    const normalizeGroup = (name) => {
        if (!name) return '';
        const lower = name.toLowerCase();
        if (lower.includes('manchester') || lower.includes('echn')) return 'Manchester / ECHN';
        return name;
    };

    // Get unique normalized program groups
    const programGroups = new Set();
    filteredInvoices.forEach(inv => programGroups.add(normalizeGroup(inv.program_group)));
    filteredDirectIncome.forEach(inc => programGroups.add(normalizeGroup(inc.facility_name)));

    const sortedGroups = [...programGroups].filter(Boolean).sort((a, b) => {
      if (a === 'Nations Hearing') return 1;
      if (b === 'Nations Hearing') return -1;
      return a.localeCompare(b);
    });

    sortedGroups.forEach(programGroup => {
      const groupInvoices = filteredInvoices.filter(inv => normalizeGroup(inv.program_group) === programGroup);
      const groupDirectIncome = filteredDirectIncome.filter(inc => normalizeGroup(inc.facility_name) === programGroup);

      // Hartford Hospital and St. Francis need Directorship/On-Call separation
      const needsSeparation = programGroup === 'Hartford Hospital' || programGroup === 'St. Francis';
      const isDirectPayer = directPayers.includes(programGroup);

      if (isDirectPayer) {
        const isNationsHearing = programGroup === 'Nations Hearing';
        const headers = isNationsHearing
          ? ['Voucher Number', 'Invoice Number', 'Month', 'Expected Payment', 'Payment Received', 'Payment Date', 'Payment Quarter', 'Allocation/Notes']
          : ['Invoice Number', 'Month', 'Expected Payment', 'Payment Received', 'Payment Date', 'Payment Quarter', 'Voucher Number', '', 'Allocation/Notes'];
          
        const section = {
          title: `${programGroup} - TRACKING`,
          headers: headers,
          rows: []
        };

        // Process Direct Income Items
        const processedItems = groupDirectIncome.map(item => {
           const dateStr = Array.isArray(item.work_dates) && item.work_dates[0] ? item.work_dates[0] : item.created_date;
           const dateObj = dateStr ? parseISO(dateStr) : new Date();
           const monthStr = format(dateObj, 'MMMM yyyy');
           return { ...item, month: monthStr };
        });

        // Sort using existing helper
        sortByMonth(processedItems);

        const cleanNotes = (notes) => {
          if (!notes) return '';
          const lower = notes.toLowerCase();
          if (lower.includes('auto-generated') || lower.includes('auto-created')) return '';
          return notes;
        };

        if (isNationsHearing) {
          // Group by voucher number — one row per voucher
          const voucherMap = new Map();

          processedItems.forEach(item => {
            let voucherNumber = '';
            let paymentDateObj = null;
            let amountReceived = 0;

            payments.forEach(payment => {
              payment.allocations?.forEach(allocation => {
                if (allocation.outside_income_id === item.id) {
                  amountReceived += (allocation.amount || 0);
                  const pDate = parseISO(payment.payment_date);
                  if (!paymentDateObj || pDate < paymentDateObj) paymentDateObj = pDate;
                  voucherNumber = payment.reference_number || '';
                }
              });
            });

            const expectedAmount = item.amount_due || item.total_amount || 0;
            const invoiceNum = item.external_invoice_number || '-';
            const key = voucherNumber || invoiceNum; // fallback key if no voucher

            if (voucherMap.has(key)) {
              const existing = voucherMap.get(key);
              existing.expectedAmount += expectedAmount;
              existing.amountReceived += amountReceived;
              if (paymentDateObj && (!existing.paymentDateObj || paymentDateObj < existing.paymentDateObj)) {
                existing.paymentDateObj = paymentDateObj;
              }
              existing.invoiceNumbers.push(invoiceNum);
            } else {
              voucherMap.set(key, {
                voucherNumber,
                invoiceNumbers: [invoiceNum],
                month: item.month,
                expectedAmount,
                amountReceived,
                paymentDateObj,
              });
            }
          });

          voucherMap.forEach(v => {
            const paymentDate = v.paymentDateObj ? format(v.paymentDateObj, 'MM/dd/yyyy') : '';
            const q = v.paymentDateObj ? Math.floor(v.paymentDateObj.getMonth() / 3) + 1 : '';
            const paymentQuarter = v.paymentDateObj ? `Q${q} ${v.paymentDateObj.getFullYear()}` : '';
            section.rows.push([
              v.voucherNumber,
              v.invoiceNumbers.join(', '),
              v.month,
              v.expectedAmount,
              v.amountReceived,
              paymentDate,
              paymentQuarter,
              '' // Notes — not item-specific when grouped
            ]);
          });

        } else {
          processedItems.forEach(item => {
            let paymentDate = '';
            let voucherNumber = '';
            let paymentQuarter = '';
            let amountReceived = 0;

            payments.forEach(payment => {
              payment.allocations?.forEach(allocation => {
                if (allocation.outside_income_id === item.id) {
                  amountReceived += (allocation.amount || 0);
                  const pDate = parseISO(payment.payment_date);
                  paymentDate = format(pDate, 'MM/dd/yyyy');
                  const q = Math.floor(pDate.getMonth() / 3) + 1;
                  paymentQuarter = `Q${q} ${pDate.getFullYear()}`;
                  voucherNumber = payment.reference_number || '';
                }
              });
            });

            const expectedAmount = item.amount_due || item.total_amount || 0;
            section.rows.push([
              item.external_invoice_number || '-',
              item.month,
              expectedAmount,
              amountReceived,
              paymentDate,
              paymentQuarter,
              voucherNumber,
              '', // Date Paid Provider (N/A)
              cleanNotes(item.notes)
            ]);
          });
        }
        
        sections.push(section);

      } else if (needsSeparation) {
        const directorshipLocation = programLocations.find(pl =>
          pl.program_group === programGroup && pl.program_type === 'Directorship'
        );
        const onCallLocation = programLocations.find(pl =>
          pl.program_group === programGroup && pl.program_type === 'On-Call'
        );

        const { directorshipSection, onCallSection } = buildSeparatedProgramSections({
          programGroup,
          groupInvoices,
          payments,
          providers,
          outsideIncome,
          programLocations,
          sortByMonth,
          normalizeGroup,
        });

        if (directorshipLocation) {
          sections.push(directorshipSection);
        }

        if (onCallLocation) {
          sections.push(onCallSection);
        }

      } else {
        // Standard tracking for other locations
        const section = {
          title: `${programGroup} - TRACKING`,
          headers: ['Provider', 'Invoice Number', 'Month', 'Expected Payment', 'Payment Received', 'Payment Date', 'Payment Quarter', 'Voucher Number', 'Date Paid Provider', 'Allocation/Notes'],
          rows: []
        };

        sortByMonth(groupInvoices);

        groupInvoices.forEach(invoice => {
          const provider = providers.find(p => p.id === invoice.staff_member_id);
          const providerName = provider?.full_name || 'Unknown';

          // Find payment info
          let paymentDate = '';
          let voucherNumber = '';
          let paymentQuarter = '';
          payments.forEach(payment => {
            payment.allocations?.forEach(allocation => {
              if (allocation.invoice_id === invoice.id) {
                const pDate = parseISO(payment.payment_date);
                paymentDate = format(pDate, 'MM/dd/yyyy');
                const q = Math.floor(pDate.getMonth() / 3) + 1;
                paymentQuarter = `Q${q} ${pDate.getFullYear()}`;
                voucherNumber = payment.reference_number || '';
              }
            });
          });

          const expectedAmount = invoice.amount_expected || invoice.total || 0;
          const receivedAmount = invoice.amount_received || 0;

          const shouldHideNotes = invoice.auto_generated || (invoice.notes && (invoice.notes.toLowerCase().includes('auto-generated') || invoice.notes.toLowerCase().includes('auto-created')));
          section.rows.push([
            providerName,
            invoice.invoice_number || '',
            invoice.month || '',
            expectedAmount, // Number
            receivedAmount, // Number
            paymentDate,
            paymentQuarter,
            voucherNumber,
            invoice.date_provider_paid ? format(parseISO(invoice.date_provider_paid), 'MM/dd/yyyy') : '',
            shouldHideNotes ? '' : (invoice.notes || '')
          ]);
        });
        sections.push(section);
      }
    });

    const otherProfessionalSection = buildOtherProfessionalIncomeSection(normalizeGroup);
    if (otherProfessionalSection.rows.length > 0) {
      sections.push(otherProfessionalSection);
    }

    if (sections.length === 0) {
       alert("No data found for the selected filters. Please adjust your filters and try again.");
       return;
    }
    downloadBackendReport(sections);
    };

  const directPayerOptions = ['Quinnipiac University', 'Nations Hearing'];
  const relevantDirectIncome = outsideIncome.filter(inc => directPayerOptions.includes(inc.facility_name));
  const directGroups = relevantDirectIncome.map(inc => inc.facility_name);

  const otherProfessionalPayers = [...new Set(
    payments.flatMap((payment) =>
      (payment.allocations || [])
        .filter(isOtherProfessionalAllocation)
        .map(() => payment.payer)
        .filter(Boolean)
    )
  )];
  
  const programGroupOptions = ['all', ...new Set([
    ...invoices.map(inv => inv.program_group).filter(Boolean),
    ...directGroups,
    ...otherProfessionalPayers,
  ])].sort();

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Payment Tracking Report</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Track invoices by location with Directorship/On-Call breakdown, plus Other Professional Income
            </p>
          </div>
          <Button onClick={generateReport} className="gap-2" disabled={isGenerating}>
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isGenerating ? 'Generating...' : 'Export Reports (ZIP)'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Building2 className="w-5 h-5 text-slate-500" />
            <Select value={selectedProgramGroup} onValueChange={setSelectedProgramGroup}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {programGroupOptions.filter(g => g !== 'all').map(group => (
                  <SelectItem key={group} value={group}>{group}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          </div>
      </CardContent>
    </Card>
  );
}