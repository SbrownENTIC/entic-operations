import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Upload, AlertCircle, ExternalLink, Edit, Search, Trash2 } from "lucide-react";
import { format, parseISO, subMonths } from "date-fns";
import { DatePicker } from "@/components/ui/date-picker";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useFormState } from "@/components/FormContext";

const INVOICE_STATUSES = [
  { value: "not_started", label: "Not Started" },
  { value: "draft", label: "Draft" },
  { value: "pending_providers_approval", label: "Pending Providers Approval" },
  { value: "pending_providers_time", label: "Pending Providers Time" },
  { value: "sent_to_provider_for_approval", label: "Sent to Provider for Approval" },
  { value: "sent_to_provider_for_review", label: "Sent to Provider for Review" },
  { value: "sent_to_coo_for_approval", label: "Sent to COO for Approval" },
  { value: "sent_for_approval", label: "Sent for Approval" },
  { value: "approved", label: "Approved" },
  { value: "sent_to_vendor", label: "Sent to Vendor" },
  { value: "paid_to_entic", label: "Paid to ENTIC" },
  { value: "provider_paid", label: "Provider Paid" }
];

export default function InvoiceForm({ invoice, incomes, preselectedIncomes = [], onSubmit, onCancel, isLoading, isReadOnly }) {
  const { setIsDirty } = useFormState();
  const [formData, setFormData] = useState({
    invoice_number: '',
    program_group: '',
    staff_member_id: '',
    work_email: '',
    invoice_date: new Date().toISOString().split('T')[0],
    month: '',
    status: 'not_started',
    outside_income_ids: [],
    days_worked: 0,
    subtotal: 0,
    total: 0,
    amount_expected: 0,
    amount_received: 0,
    under_over_amount: 0,
    date_provider_paid: '',
    provider_paid: false,
    invoice_ready_to_send: false,
    invoice_sent_for_approval: false,
    invoice_sent_to_vendor: false,
    draft_invoice_url: '',
    approved_invoice_url: '',
    notes: ''
  });

  const [uploadingDraft, setUploadingDraft] = useState(false);
  const [uploadingApproved, setUploadingApproved] = useState(false);
  const [incomeSearchTerm, setIncomeSearchTerm] = useState("");
  
  // Track if user has manually edited these fields
  const manualEditFlags = useRef({
    subtotal: false,
    total: false,
    amount_expected: false,
    status: false
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  const { data: programLocations = [] } = useQuery({
    queryKey: ['program-locations'],
    queryFn: () => base44.entities.ProgramLocation.list()
  });

  // Fetch all payments to show allocations to this invoice
  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list(),
    enabled: !!invoice
  });

  // Get unique program groups
  const programGroups = [...new Set(programLocations.map(pl => pl.program_group).filter(Boolean))].sort();

  // Find all payment allocations to this invoice
  const invoiceAllocations = invoice ? payments.filter(payment =>
    payment.allocations?.some(alloc => alloc.invoice_id === invoice.id)
  ).map(payment => ({
    payment,
    allocation: payment.allocations.find(alloc => alloc.invoice_id === invoice.id)
  })) : [];

  // Extract month from invoice number
  const extractMonthFromInvoiceNumber = (invoiceNumber) => {
    if (!invoiceNumber) return '';

    const monthPatterns = [
      /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/i,
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{4})\b/i
    ];

    for (const pattern of monthPatterns) {
      const match = invoiceNumber.match(pattern);
      if (match) {
        const monthName = match[1].charAt(0).toUpperCase() + match[1].slice(1).toLowerCase();
        return `${monthName} ${match[2]}`;
      }
    }

    return '';
  };

  useEffect(() => {
    if (invoice) {
      setFormData({
        ...invoice,
        outside_income_ids: invoice.outside_income_ids || []
      });
      // If editing existing invoice, mark all fields as manually edited
      // to prevent auto-updates overriding existing data.
      manualEditFlags.current = {
        subtotal: true,
        total: true,
        amount_expected: true,
        status: true
      };
      // Ensure form is not marked dirty immediately after loading existing data
      setIsDirty(false);
    } else if (preselectedIncomes.length > 0) {
      const selectedIncomes = incomes.filter(inc => preselectedIncomes.includes(inc.id));
      const totalDays = selectedIncomes.reduce((sum, inc) => sum + (inc.days_worked || 0), 0);
      const totalAmount = selectedIncomes.reduce((sum, inc) => sum + (inc.total_amount || 0), 0);

      const firstIncome = selectedIncomes[0];
      let programGroup = '';
      let staffMemberId = firstIncome?.provider_id || '';

      if (firstIncome?.program_location_id) {
        const programLocation = programLocations.find(pl => pl.id === firstIncome.program_location_id);
        if (programLocation) {
          programGroup = programLocation.program_group || '';
        }
      }

      // Auto-generate invoice number for non-UConn (e.g. "November 2025- O'Brien, Alday")
      let generatedInvoiceNumber = '';
      if (programGroup !== 'UConn' && selectedIncomes.length > 0) {
          let dateObj = new Date();
          const allDates = selectedIncomes.reduce((acc, inc) => {
              return inc.work_dates ? [...acc, ...inc.work_dates] : acc;
          }, []).sort();

          if (allDates.length > 0) {
              dateObj = parseISO(allDates[0]);
          }

          const monthYear = format(dateObj, 'MMMM yyyy');

          // Find all unique providers in selected incomes
          const uniqueProviderIds = [...new Set(selectedIncomes.map(inc => inc.provider_id).filter(Boolean))];
          const lastNames = uniqueProviderIds.map(pid => {
              const p = providers.find(prov => prov.id === pid);
              if (p) {
                  const nameParts = p.full_name.trim().split(' ');
                  return nameParts[nameParts.length - 1];
              }
              return '';
          }).filter(Boolean).join(', ');

          if (lastNames) {
              generatedInvoiceNumber = `${monthYear}- ${lastNames}`;
          }
      }

      setFormData(prev => ({
        ...prev,
        outside_income_ids: preselectedIncomes,
        program_group: programGroup,
        staff_member_id: staffMemberId,
        days_worked: totalDays,
        subtotal: totalAmount,
        total: totalAmount,
        amount_expected: totalAmount,
        invoice_number: generatedInvoiceNumber || prev.invoice_number
      }));
      // These values are auto-filled, so they are not manually edited yet.
      manualEditFlags.current = {
        subtotal: false,
        total: false,
        amount_expected: false,
        status: false
      };
    }
  }, [invoice, preselectedIncomes, incomes, programLocations, providers]);

  // Track dirty state - Handled by individual input change handlers to avoid auto-dirtying on load
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  // Reset dirty on unmount
  useEffect(() => {
    return () => setIsDirty(false);
  }, []);

  // Recalculate totals whenever outside_income_ids changes - BUT only if not manually edited
  useEffect(() => {
    const selectedIncomes = incomes.filter(inc => formData.outside_income_ids.includes(inc.id));
    const totalDays = selectedIncomes.reduce((sum, inc) => sum + (inc.days_worked || 0), 0);
    const totalAmount = selectedIncomes.reduce((sum, inc) => sum + (inc.total_amount || 0), 0);

    const updates = {
      days_worked: totalDays
    };

    // Auto-fill month based on linked income dates if month is missing
    if (!formData.month && selectedIncomes.length > 0) {
      const allDates = selectedIncomes.reduce((acc, inc) => {
        return inc.work_dates ? [...acc, ...inc.work_dates] : acc;
      }, []).sort();

      if (allDates.length > 0) {
        try {
          // Use the month of the first date
          const date = parseISO(allDates[0]);
          updates.month = format(date, 'MMMM yyyy');
        } catch (e) {
          console.error('Error parsing date for UConn month autofill:', e);
        }
      }
    }

    // Only update these fields if they haven't been manually edited
    if (!manualEditFlags.current.subtotal) {
      updates.subtotal = totalAmount;
    }
    if (!manualEditFlags.current.total) {
      updates.total = totalAmount;
    }
    if (!manualEditFlags.current.amount_expected) {
      updates.amount_expected = totalAmount;
    }

    setFormData(prev => ({
      ...prev,
      ...updates
    }));
  }, [formData.outside_income_ids, incomes, formData.program_group, formData.month]);

  useEffect(() => {
    const extractedMonth = extractMonthFromInvoiceNumber(formData.invoice_number);
    if (extractedMonth && !formData.month) {
      setFormData(prev => ({ ...prev, month: extractedMonth }));
    }
  }, [formData.invoice_number, formData.month]);

  useEffect(() => {
    const balance = (formData.amount_expected || 0) - (formData.amount_received || 0);
    setFormData(prev => ({ ...prev, under_over_amount: balance }));
  }, [formData.amount_expected, formData.amount_received]);

  useEffect(() => {
    // Get all unique provider IDs from linked incomes
    const selectedIncomes = incomes.filter(inc => formData.outside_income_ids.includes(inc.id));
    const linkedProviderIds = [...new Set(selectedIncomes.map(inc => inc.provider_id).filter(Boolean))];

    // If no linked providers, fallback to staff_member_id
    if (linkedProviderIds.length === 0 && formData.staff_member_id) {
      linkedProviderIds.push(formData.staff_member_id);
    } else if (formData.staff_member_id && !linkedProviderIds.includes(formData.staff_member_id)) {
       // Ensure primary staff member is included
       linkedProviderIds.push(formData.staff_member_id);
    }

    const emails = linkedProviderIds.map(pid => {
      const p = providers.find(prov => prov.id === pid);
      return p?.email;
    }).filter(Boolean);

    // Join unique emails
    const uniqueEmails = [...new Set(emails)].join(', ');

    if (uniqueEmails) {
      setFormData(prev => ({ ...prev, work_email: uniqueEmails }));
    }
  }, [formData.staff_member_id, formData.outside_income_ids, providers, incomes]);

  useEffect(() => {
    if (!manualEditFlags.current.status && formData.provider_paid) {
      setFormData(prev => ({ ...prev, status: 'provider_paid' }));
    }
  }, [formData.provider_paid]);

  useEffect(() => {
    if (!manualEditFlags.current.status && formData.invoice_sent_to_vendor && formData.status !== 'sent_to_vendor' && formData.status !== 'paid_to_entic' && formData.status !== 'provider_paid') {
      setFormData(prev => ({ ...prev, status: 'sent_to_vendor' }));
    }
  }, [formData.invoice_sent_to_vendor, formData.status]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsDirty(false);

    // Check if status was manually changed
    const statusChanged = invoice && invoice.status !== formData.status;

    let finalData = { ...formData };

    if (!finalData.invoice_number && finalData.program_group === 'UConn') {
      const uconnLocation = programLocations.find(pl => pl.program_group === 'UConn');
      if (uconnLocation) {
        const nextNumber = (uconnLocation.invoice_counter || 39) + 1;
        finalData.invoice_number = `${nextNumber}`;

        await base44.entities.ProgramLocation.update(uconnLocation.id, {
          invoice_counter: nextNumber
        });
      }
    }

    if (finalData.invoice_sent_for_approval && !invoice?.sent_for_approval_at && finalData.program_group !== 'St. Francis') {
      finalData.sent_for_approval_at = new Date().toISOString();
    } else if (!finalData.invoice_sent_for_approval) {
      finalData.sent_for_approval_at = invoice?.sent_for_approval_at || null;
    }

    if (finalData.invoice_sent_to_vendor && !invoice?.sent_to_vendor_at && finalData.program_group !== 'St. Francis') {
      finalData.sent_to_vendor_at = new Date().toISOString();
    } else if (!finalData.invoice_sent_to_vendor) {
      finalData.sent_to_vendor_at = invoice?.sent_to_vendor_at || null;
    }

    onSubmit(finalData, statusChanged);
  };

  const toggleIncome = (incomeId) => {
    setIsDirty(true);
    setFormData(prev => {
      const isSelected = prev.outside_income_ids.includes(incomeId);
      const newIncomeIds = isSelected 
        ? prev.outside_income_ids.filter(id => id !== incomeId)
        : [...prev.outside_income_ids, incomeId];
      
      // Auto-set program group and provider if this is the first income being added
      let updates = { outside_income_ids: newIncomeIds };
      
      if (!isSelected && prev.outside_income_ids.length === 0) {
        const income = incomes.find(inc => inc.id === incomeId);
        if (income?.program_location_id) {
          const programLocation = programLocations.find(pl => pl.id === income.program_location_id);
          if (programLocation) {
            updates.program_group = programLocation.program_group || '';
          }
        }
        if (income?.provider_id) {
          updates.staff_member_id = income.provider_id;
        }
      }
      
      return { ...prev, ...updates };
    });
  };

  const isAllowedInvoiceFile = (file) => {
    const name = file?.name?.toLowerCase() || '';
    return name.endsWith('.pdf') || name.endsWith('.xls') || name.endsWith('.xlsx');
  };

  const handleFileUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isAllowedInvoiceFile(file)) {
      alert('Please attach a PDF or Excel file (.pdf, .xls, .xlsx).');
      e.target.value = '';
      return;
    }

    setIsDirty(true);

    try {
      if (type === 'draft') setUploadingDraft(true);
      else setUploadingApproved(true);

      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      setFormData(prev => {
        const updates = {
          [type === 'draft' ? 'draft_invoice_url' : 'approved_invoice_url']: file_url
        };

        // Auto-update status to approved when approved invoice is uploaded (Ready to Send)
        if (type === 'approved' && prev.status !== 'paid_to_entic' && prev.status !== 'provider_paid' && prev.status !== 'sent_to_vendor') {
          updates.status = 'approved';
          updates.invoice_sent_to_vendor = false; // Not sent yet, just ready
          manualEditFlags.current.status = true;
        }

        // Auto-update status to draft when draft invoice is uploaded
        if (type === 'draft' && prev.status === 'not_started' && !manualEditFlags.current.status) {
          updates.status = 'draft';
          manualEditFlags.current.status = true;
        }

        return {
          ...prev,
          ...updates
        };
      });
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      if (type === 'draft') setUploadingDraft(false);
      else setUploadingApproved(false);
    }
  };

  // Mark field as manually edited when user changes it
  const handleManualEdit = (field, value) => {
    manualEditFlags.current[field] = true;
    setFormData({ ...formData, [field]: parseFloat(value) });
    setIsDirty(true);
  };

  // Incomes available for linking (not linked to other invoices OR linked to this invoice)
  const incomesAvailableForLinking = incomes.filter(inc => 
    !inc.invoice_id || inc.invoice_id === invoice?.id
  );

  // Calculate comprehensive income statistics based on ALL incomes
  const totalIncomes = incomes.length;
  const unlinkedIncomes = incomes.filter(inc => !inc.invoice_id).length;
  const linkedToOtherInvoices = incomes.filter(inc => inc.invoice_id && inc.invoice_id !== invoice?.id).length;
  const linkedToThisInvoice = formData.outside_income_ids.length;
  const availableToLink = incomesAvailableForLinking.length; // Count of incomes that can be shown/linked to this invoice

  // Filter incomes based on search term, using only those available for linking
  const filteredIncomes = incomesAvailableForLinking.filter(income => {
    if (!incomeSearchTerm) return true;

    const provider = providers.find(p => p.id === income.provider_id);
    const searchLower = incomeSearchTerm.toLowerCase();

    return (
      provider?.full_name?.toLowerCase().includes(searchLower) ||
      income.facility_name?.toLowerCase().includes(searchLower) ||
      income.total_amount?.toString().includes(searchLower)
    );
  });

  // Helper to ensure mutual exclusivity of status checkboxes
  const handleStatusCheckboxChange = (targetStatus, booleanFieldToSet, isChecked) => {
    if (!isChecked) {
      if (booleanFieldToSet) {
        handleChange(booleanFieldToSet, false);
      }
      return;
    }

    const updates = {};
    const booleanFields = ['provider_paid', 'invoice_ready_to_send', 'invoice_sent_for_approval', 'invoice_sent_to_vendor'];
    
    // Uncheck all boolean fields
    booleanFields.forEach(field => {
      updates[field] = false;
    });

    // Set the target boolean field
    if (booleanFieldToSet) {
      updates[booleanFieldToSet] = true;
    }

    // Update status
    if (targetStatus) {
      updates.status = targetStatus;
      manualEditFlags.current.status = true;
    }

    setFormData(prev => ({ ...prev, ...updates }));
    setIsDirty(true);
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle>{invoice ? 'Edit Invoice' : 'Create Invoice'}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onCancel}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="p-6 space-y-6">
          {isReadOnly && (
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg mb-4">
              <p className="font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                View Only
              </p>
              <p className="text-sm mt-1">This section is view-only. Please contact an administrator to make changes.</p>
            </div>
          )}
          {invoice && invoiceAllocations.length > 0 && (
            <Card className="border-orange-200 bg-orange-50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-orange-600" />
                  <CardTitle className="text-sm">Payment Allocations to This Invoice</CardTitle>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  Total received from {invoiceAllocations.length} payment(s): ${invoiceAllocations.reduce((sum, item) => sum + (item.allocation.amount || 0), 0).toFixed(2)}
                </p>
              </CardHeader>
              <CardContent className="space-y-2">
                {invoiceAllocations.map((item, idx) => (
                  <div key={idx} className="p-3 bg-white rounded border border-orange-200">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">
                          Payment from {item.payment.payer} - {format(parseISO(item.payment.payment_date), 'MMM d, yyyy')}
                        </p>
                        <p className="text-sm text-slate-600">
                          Reference: {item.payment.reference_number || 'N/A'}
                        </p>
                        <p className="text-sm text-slate-600">
                          Payment Total: ${item.payment.total_amount?.toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-orange-700">
                          ${item.allocation.amount?.toFixed(2)}
                        </p>
                        <p className="text-xs text-slate-500">allocated to this invoice</p>
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-orange-100 flex gap-2">
                      <a
                        href={`${createPageUrl("Payments")}?edit=${item.payment.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="text-xs gap-1"
                        >
                          <Edit className="w-3 h-3" />
                          Edit this payment
                        </Button>
                      </a>
                    </div>
                  </div>
                ))}
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                  <p className="text-sm text-blue-900 font-medium">
                    💡 To fix incorrect allocations: Click "Edit this payment" above to adjust the allocation amounts in a new tab.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="invoice_number">Invoice Number</Label>
              <Input
                id="invoice_number"
                value={formData.invoice_number}
                onChange={(e) => handleChange('invoice_number', e.target.value)}
                placeholder={formData.program_group === 'UConn' ? 'Auto-generated' : ''}
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="program_group">Program Group *</Label>
              <Select value={formData.program_group} onValueChange={(value) => handleChange('program_group', value)} disabled={isReadOnly}>
                <SelectTrigger>
                  <SelectValue placeholder="Select program group" />
                </SelectTrigger>
                <SelectContent>
                  {programGroups.map(group => (
                    <SelectItem key={group} value={group}>
                      {group}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff_member_id">Staff Member *</Label>
              <Select value={formData.staff_member_id} onValueChange={(value) => handleChange('staff_member_id', value)} disabled={isReadOnly}>
                <SelectTrigger>
                  <SelectValue placeholder="Select staff member" />
                </SelectTrigger>
                <SelectContent>
                  {providers.map(provider => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="work_email">Work Email</Label>
              <Input
                id="work_email"
                type="email"
                value={formData.work_email}
                readOnly
                className="bg-slate-50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoice_date">Invoice Date *</Label>
              <DatePicker
                value={formData.invoice_date}
                onChange={(date) => handleChange('invoice_date', date)}
                defaultMonth={subMonths(new Date(), 1)}
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="month">Month</Label>
              <Input
                id="month"
                placeholder="e.g., January 2024 (auto-filled from invoice #)"
                value={formData.month}
                onChange={(e) => handleChange('month', e.target.value)}
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">
                Status
                {invoice?.manual_status_override && (
                  <span className="ml-2 text-xs text-orange-600 font-normal">
                    🔒 Manual Override - Won't Auto-Update
                  </span>
                )}
              </Label>
              <Select 
                value={formData.status} 
                onValueChange={(value) => {
                  manualEditFlags.current.status = true;
                  handleChange('status', value);
                }}
                disabled={isReadOnly}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVOICE_STATUSES.map(status => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Days Worked</Label>
              <div className="text-xl font-semibold text-slate-900 p-3 bg-slate-50 rounded-lg">
                {formData.days_worked}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subtotal">Subtotal</Label>
              <Input
                id="subtotal"
                type="number"
                step="0.01"
                value={formData.subtotal}
                onChange={(e) => handleManualEdit('subtotal', e.target.value)}
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="total">Total</Label>
              <Input
                id="total"
                type="number"
                step="0.01"
                value={formData.total}
                onChange={(e) => handleManualEdit('total', e.target.value)}
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount_expected">Amount Expected</Label>
              <Input
                id="amount_expected"
                type="number"
                step="0.01"
                value={formData.amount_expected}
                onChange={(e) => handleManualEdit('amount_expected', e.target.value)}
                disabled={isReadOnly}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount_received">Amount Received (Auto-calculated)</Label>
              <Input
                id="amount_received"
                type="number"
                step="0.01"
                value={formData.amount_received}
                readOnly
                className="bg-slate-100"
              />
              <p className="text-xs text-slate-500">Calculated from payment allocations</p>
            </div>

            <div className="space-y-2">
              <Label>Under/Over Amount</Label>
              <div className={`text-xl font-bold p-3 rounded-lg ${
                (formData.under_over_amount || 0) > 0 ? 'bg-green-50 text-green-700' :
                (formData.under_over_amount || 0) < 0 ? 'bg-red-50 text-red-700' :
                'bg-slate-50 text-slate-700'
              }`}>
                ${(formData.under_over_amount || 0).toFixed(2)}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date_provider_paid">Date Provider Paid</Label>
              <DatePicker
                value={formData.date_provider_paid}
                onChange={(date) => handleChange('date_provider_paid', date)}
                disabled={isReadOnly}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="provider_paid"
                checked={formData.provider_paid}
                onCheckedChange={(checked) => handleStatusCheckboxChange('provider_paid', 'provider_paid', checked)}
                disabled={isReadOnly}
              />
              <label htmlFor="provider_paid" className="text-sm font-medium cursor-pointer">
                Provider Paid
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="invoice_ready_to_send"
                checked={formData.invoice_ready_to_send}
                onCheckedChange={(checked) => handleStatusCheckboxChange('approved', 'invoice_ready_to_send', checked)}
                disabled={isReadOnly}
              />
              <label htmlFor="invoice_ready_to_send" className="text-sm font-medium cursor-pointer">
                Invoice Ready to Send
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="invoice_sent_for_approval"
                checked={formData.invoice_sent_for_approval}
                onCheckedChange={(checked) => handleStatusCheckboxChange('sent_for_approval', 'invoice_sent_for_approval', checked)}
                disabled={isReadOnly}
              />
              <label htmlFor="invoice_sent_for_approval" className="text-sm font-medium cursor-pointer">
                Invoice Sent for Approval
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="invoice_sent_to_vendor"
                checked={formData.invoice_sent_to_vendor}
                onCheckedChange={(checked) => handleStatusCheckboxChange('sent_to_vendor', 'invoice_sent_to_vendor', checked)}
                disabled={isReadOnly}
              />
              <label htmlFor="invoice_sent_to_vendor" className="text-sm font-medium cursor-pointer">
                Invoice Sent to Vendor
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="pending_providers_time"
                checked={formData.status === 'pending_providers_time'}
                onCheckedChange={(checked) => handleStatusCheckboxChange('pending_providers_time', null, checked)}
                disabled={isReadOnly}
              />
              <label htmlFor="pending_providers_time" className="text-sm font-medium cursor-pointer">
                Provider Needs to Enter Time
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="pending_providers_approval"
                checked={formData.status === 'pending_providers_approval'}
                onCheckedChange={(checked) => handleStatusCheckboxChange('pending_providers_approval', null, checked)}
                disabled={isReadOnly}
              />
              <label htmlFor="pending_providers_approval" className="text-sm font-medium cursor-pointer">
                Pending Provider Approval
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="sent_to_provider_for_approval"
                checked={formData.status === 'sent_to_provider_for_approval'}
                onCheckedChange={(checked) => handleStatusCheckboxChange('sent_to_provider_for_approval', null, checked)}
                disabled={isReadOnly}
              />
              <label htmlFor="sent_to_provider_for_approval" className="text-sm font-medium cursor-pointer">
                Sent to Provider for Approval
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="sent_to_provider_for_review"
                checked={formData.status === 'sent_to_provider_for_review'}
                onCheckedChange={(checked) => handleStatusCheckboxChange('sent_to_provider_for_review', null, checked)}
                disabled={isReadOnly}
              />
              <label htmlFor="sent_to_provider_for_review" className="text-sm font-medium cursor-pointer">
                Sent to Provider for Review
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="sent_to_coo_for_approval"
                checked={formData.status === 'sent_to_coo_for_approval'}
                onCheckedChange={(checked) => handleStatusCheckboxChange('sent_to_coo_for_approval', null, checked)}
                disabled={isReadOnly}
              />
              <label htmlFor="sent_to_coo_for_approval" className="text-sm font-medium cursor-pointer">
                Sent to COO for Approval
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="sent_for_approval"
                checked={formData.status === 'sent_for_approval'}
                onCheckedChange={(checked) => handleStatusCheckboxChange('sent_for_approval', null, checked)}
                disabled={isReadOnly}
              />
              <label htmlFor="sent_for_approval" className="text-sm font-medium cursor-pointer">
                Sent to Vendor for Approval
              </label>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {formData.program_group !== 'St. Francis' && (
            <div className="space-y-2">
              <Label>Draft Invoice (PDF or Excel)</Label>
              <div className="flex gap-2">
                {!isReadOnly && (
                  <Input
                    type="file"
                    accept=".pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(e) => handleFileUpload(e, 'draft')}
                    disabled={uploadingDraft}
                    className="flex-1"
                  />
                )}
                {formData.draft_invoice_url && (
                  <>
                    <Button type="button" variant="outline" size="sm" asChild>
                      <a href={formData.draft_invoice_url} target="_blank" rel="noopener noreferrer">
                        View
                      </a>
                    </Button>
                    {!isReadOnly && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, draft_invoice_url: '' }));
                          setIsDirty(true);
                        }}
                        title="Remove file"
                        className="text-red-600 hover:text-red-700 px-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
            )}

            <div className="space-y-2">
              <Label>Approved Invoice (PDF or Excel)</Label>
              <div className="flex gap-2">
                {!isReadOnly && (
                  <Input
                    type="file"
                    accept=".pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(e) => handleFileUpload(e, 'approved')}
                    disabled={uploadingApproved}
                    className="flex-1"
                  />
                )}
                {formData.approved_invoice_url && (
                  <>
                    <Button type="button" variant="outline" size="sm" asChild>
                      <a href={formData.approved_invoice_url} target="_blank" rel="noopener noreferrer">
                        View
                      </a>
                    </Button>
                    {!isReadOnly && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFormData(prev => ({ ...prev, approved_invoice_url: '' }));
                          setIsDirty(true);
                        }}
                        title="Remove file"
                        className="text-red-600 hover:text-red-700 px-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </>
                )}
              </div>

            </div>

          </div>

          {incomesAvailableForLinking.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Outside Income Links</h3>
                <p className="text-sm text-slate-600">
                  {linkedToThisInvoice} of {availableToLink} available selected
                </p>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <p className="text-slate-600">Total Records</p>
                    <p className="text-xl font-bold text-blue-900">{totalIncomes}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Unlinked</p>
                    <p className="text-xl font-bold text-orange-700">{unlinkedIncomes}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Linked to Other Invoices</p>
                    <p className="text-xl font-bold text-purple-700">{linkedToOtherInvoices}</p>
                  </div>
                  <div>
                    <p className="text-slate-600">Linked to This Invoice</p>
                    <p className="text-xl font-bold text-green-700">{linkedToThisInvoice}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search by provider, facility, or amount..."
                  value={incomeSearchTerm}
                  onChange={(e) => setIncomeSearchTerm(e.target.value)}
                  className="max-w-md"
                />
              </div>

              <div className="border border-slate-200 rounded-lg p-4 max-h-96 overflow-y-auto space-y-2">
                {filteredIncomes.map(income => {
                  const provider = providers.find(p => p.id === income.provider_id);
                  const isLinkedToThisInvoice = formData.outside_income_ids.includes(income.id);
                  return (
                    <div key={income.id} className={`flex items-start space-x-2 p-3 hover:bg-slate-50 rounded border ${
                      isLinkedToThisInvoice ? 'border-blue-300 bg-blue-50' : 'border-slate-100'
                    }`}>
                      <Checkbox
                        id={income.id}
                        checked={isLinkedToThisInvoice}
                        onCheckedChange={() => toggleIncome(income.id)}
                        className="mt-1"
                        disabled={isReadOnly}
                      />
                      <label htmlFor={income.id} className="flex-1 text-sm cursor-pointer">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-blue-600">{provider?.full_name || 'Unknown Provider'}</span>
                          <span className="text-slate-400">•</span>
                          <span className="font-medium text-slate-900">{income.facility_name}</span>
                        </div>
                        <div className="text-slate-600">
                          {income.days_worked} days - ${income.total_amount?.toFixed(2)}
                          {isLinkedToThisInvoice && <span className="ml-2 text-xs text-blue-600 font-medium">✓ Linked to this invoice</span>}
                        </div>
                        {income.work_dates && income.work_dates.length > 0 && (
                          <div className="mt-2 text-xs text-slate-500">
                            <span className="font-medium">Dates worked:</span>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {income.work_dates.map((date, idx) => (
                                <span key={idx} className="inline-block bg-slate-100 px-2 py-0.5 rounded">
                                  {format(parseISO(date), 'MMM d, yyyy')}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </label>
                    </div>
                  );
                })}
                {filteredIncomes.length === 0 && (
                  <div className="text-center py-6 text-slate-500">
                    {incomeSearchTerm ? 'No matching income records' : 'No income records available'}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={3}
              disabled={isReadOnly}
            />
          </div>
        </CardContent>
        <CardFooter className="border-t border-slate-100 p-6 flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          {!isReadOnly && (
            <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
              {isLoading ? 'Saving...' : invoice ? 'Update Invoice' : 'Create Invoice'}
            </Button>
          )}
        </CardFooter>
      </form>
    </Card>
  );
}