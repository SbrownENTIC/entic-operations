import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Eye, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Printer, AlertCircle, FileDown, CloudUpload, Upload, FileSpreadsheet, Mail } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO } from "date-fns";
import { useNavigate, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { formatDateToEST } from "@/components/DateUtils";
import InvoiceForm from "../components/invoices/InvoiceForm";
import InvoiceEmailQueueDialog from "../components/invoices/InvoiceEmailQueueDialog";
import { auditCreate, auditUpdate, auditDelete } from '@/lib/auditLogger';
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

export default function Invoices() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [preselectedIncomes, setPreselectedIncomes] = useState([]);
  const [sortField, setSortField] = useState('invoice_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedInvoices, setSelectedInvoices] = useState([]);
  const [bulkDateProviderPaid, setBulkDateProviderPaid] = useState('');
  const [bulkProviderPaid, setBulkProviderPaid] = useState(false);
  const [bulkStatusUpdate, setBulkStatusUpdate] = useState('');
  const [filterNoIncome, setFilterNoIncome] = useState(false);
  const [fixingHartford, setFixingHartford] = useState(false);
  const [syncingMonths, setSyncingMonths] = useState(false);
  const [fixMessage, setFixMessage] = useState('');
  const [syncingAirtable, setSyncingAirtable] = useState(false);
  const [uploadingId, setUploadingId] = useState(null);
  const [queueEmailInvoice, setQueueEmailInvoice] = useState(null);
  const fileInputRef = React.useRef(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

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

  const { data: payments = [] } = useQuery({
    queryKey: ['payments'],
    queryFn: () => base44.entities.Payment.list()
  });

  const { data: notificationQueue = [] } = useQuery({
    queryKey: ['invoice-email-notifications'],
    queryFn: () => base44.entities.NotificationQueue.filter({ notification_type: 'Invoice Email' }),
    refetchInterval: 15000
  });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const create = urlParams.get('create');
    const incomeIds = urlParams.get('incomes');
    const editId = urlParams.get('edit');
    const statusParam = urlParams.get('status');
    const searchParam = urlParams.get('search');
    
    if (statusParam) {
      setStatusFilter(statusParam);
    }

    if (searchParam) {
      setSearchTerm(searchParam);
    }

    if (create === 'true' && incomeIds) {
      setPreselectedIncomes(incomeIds.split(','));
      setShowForm(true);
      window.history.replaceState({}, '', createPageUrl("Invoices"));
    } else if (editId && invoices.length > 0) {
      const invoiceToEdit = invoices.find(inv => inv.id === editId);
      if (invoiceToEdit) {
        setEditingInvoice(invoiceToEdit);
        setShowForm(true);
        window.history.replaceState({}, '', createPageUrl("Invoices"));
      }
    } else if (!create && !editId) {
      // If no query params and form is open, close it (handled by navigation from Layout)
      // Only do this if we initiated a clear action or navigation
      // But we need to distinguish between "just loaded page" and "navigated back to root".
      // The Layout navigation will push to /Invoices.
      // If we are here and showForm is true, we should probably close it?
      // Actually, if we just navigate to /Invoices, showForm should be false.
      
      // However, managing this via useEffect on location might be tricky if state isn't synced.
      // Let's trust that if the user clicks "Invoices" link in Layout, it navigates to /Invoices.
      // And we need to react to that.
      if (location.search === '' && showForm) {
         setShowForm(false);
         setEditingInvoice(null);
         setPreselectedIncomes([]);
      }
    }
  }, [invoices, location.search]);

  // Scroll to top when form is opened
  useEffect(() => {
    if (showForm) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [showForm]);

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const invoice = await base44.entities.Invoice.create(data);
      
      if (data.outside_income_ids && data.outside_income_ids.length > 0) {
        for (const incomeId of data.outside_income_ids) {
          await base44.entities.OutsideIncome.update(incomeId, {
            invoice_id: invoice.id,
            invoice_month: data.month || '',
            status: 'invoiced'
          });
        }
      }

      // Auto-generate PDF based on program group
      const isUConn = data.program_group?.toLowerCase().includes('uconn');
      const isManchester = data.program_group && (
        data.program_group.toLowerCase().includes('manchester') || 
        data.program_group.toLowerCase().includes('echn')
      );

      if (isUConn || isManchester) {
          try {
            const functionName = isManchester ? 'generateManchesterPDF' : 'generateUConnExcel';
            const response = await base44.functions.invoke(functionName, { 
                invoice_id: invoice.id, 
                save_to_record: true 
            });

            if (response.data && response.data.url) {
              window.open(response.data.url, '_blank');

              // Sync UConn invoices to Airtable for emailing
              // REMOVED: Auto-sync disabled to allow for batched sending via dashboard
              /*
                if (isUConn) {
                  try {
                    await base44.functions.invoke('syncUConnInvoiceToAirtable', {
                      invoice_id: invoice.id,
                      pdf_url: response.data.url
                    });
                    console.log("UConn invoice synced to Airtable successfully");
                  } catch (syncError) {
                    console.error("Error syncing UConn invoice to Airtable:", syncError);
                  }
                }
              */
            }
          } catch (error) {
            console.error("Error auto-generating PDF:", error);
            // Don't fail the whole mutation if PDF gen fails, but log it
          }
      }
      
      // Auto-create Hartford Hospital Directorship invoice if this is an RVU invoice
      if (data.program_group === 'Hartford Hospital' && data.invoice_number && !data.invoice_number.includes('Directorship')) {
        // Fetch fresh list of incomes to ensure we have the latest data
        const allIncomes = await base44.entities.OutsideIncome.list();
        
        // Find the matching directorship outside income for this provider and month
        let directorshipIncome = allIncomes.find(inc => {
          const facilityMatch = inc.facility_name?.toLowerCase().includes('directorship');
          const providerMatch = inc.provider_id === data.staff_member_id;
          
          // Match month by comparing the date's month/year with invoice month
          let monthMatch = false;
          if (inc.work_dates && inc.work_dates.length > 0 && data.month) {
            try {
              const incomeDate = parseISO(inc.work_dates[0]);
              const incomeMonthYear = format(incomeDate, 'MMMM yyyy');
              monthMatch = incomeMonthYear === data.month;
            } catch (e) {
              monthMatch = false;
            }
          }
          
          // Check if it's unlinked OR already linked to this invoice (user selected it manually)
          const isPendingOrLinkedToCurrent = !inc.invoice_id || inc.invoice_id === invoice.id;
          return facilityMatch && providerMatch && monthMatch && isPendingOrLinkedToCurrent;
        });

        // If directorship income is found AND linked to the current invoice, we are done.
        // The user manually selected it, so no need to create a duplicate or a second invoice.
        if (directorshipIncome && directorshipIncome.invoice_id === invoice.id) {
           return invoice;
        }

        // If no income record exists, create one (Sourced from Invoice)
        if (!directorshipIncome) {
           let workDate = data.invoice_date;
           // Try to derive work date from invoice month (use 1st of month)
           if (data.month) {
               try {
                   const parts = data.month.split(' ');
                   if (parts.length === 2) {
                       const monthName = parts[0];
                       const year = parseInt(parts[1]);
                       const monthIndex = new Date(Date.parse(monthName + " 1, 2012")).getMonth();
                       const d = new Date(year, monthIndex, 1);
                       workDate = format(d, 'yyyy-MM-dd');
                   }
               } catch (e) {
                   console.warn("Could not parse month for date", e);
               }
           }

           directorshipIncome = await base44.entities.OutsideIncome.create({
               provider_id: data.staff_member_id,
               program_location_id: '691527907bf4ee75e9738b32', // Hartford Hospital (Directorship)
               facility_name: 'Hartford Hospital (Directorship)',
               total_amount: 3250,
               rate: 3250,
               days_worked: 0,
               status: 'pending',
               work_dates: [workDate],
               description: 'Auto-generated Directorship Income from Invoice'
           });
        }
        
        const directorshipIncomeIds = directorshipIncome ? [directorshipIncome.id] : [];
        
        const directorshipInvoice = await base44.entities.Invoice.create({
          invoice_number: `${data.invoice_number} (Directorship)`,
          program_group: 'Hartford Hospital',
          staff_member_id: data.staff_member_id,
          work_email: data.work_email,
          invoice_date: data.invoice_date,
          month: data.month,
          status: data.status || 'not_started',
          subtotal: 3250,
          total: 3250,
          amount_expected: 3250,
          outside_income_ids: directorshipIncomeIds,
          days_worked: 0,
          auto_generated: true
        });
        
        // Link the directorship income to the new invoice
        if (directorshipIncome) {
          await base44.entities.OutsideIncome.update(directorshipIncome.id, {
            invoice_id: directorshipInvoice.id,
            invoice_month: data.month || '',
            status: 'invoiced'
          });
        }
      }

      // Auto-create St. Francis Directorship invoice if this is an On-Call invoice (not directorship)
      // Only for Seth Brown
      const provider = providers.find(p => p.id === data.staff_member_id);
      const isSethBrown = provider?.full_name?.toLowerCase().includes('seth brown');

      if (isSethBrown && data.program_group === 'St. Francis' && data.invoice_number && !data.invoice_number.includes('Directorship')) {
        // Fetch fresh list of incomes
        const allIncomes = await base44.entities.OutsideIncome.list();
        
        // Find the matching directorship outside income for this provider and month
        let directorshipIncome = allIncomes.find(inc => {
          const facilityMatch = inc.facility_name?.toLowerCase().includes('directorship') && inc.facility_name?.toLowerCase().includes('francis');
          const providerMatch = inc.provider_id === data.staff_member_id;
          
          // Match month by comparing the date's month/year with invoice month
          let monthMatch = false;
          if (inc.work_dates && inc.work_dates.length > 0 && data.month) {
            try {
              const incomeDate = parseISO(inc.work_dates[0]);
              const incomeMonthYear = format(incomeDate, 'MMMM yyyy');
              monthMatch = incomeMonthYear === data.month;
            } catch (e) {
              monthMatch = false;
            }
          }
          
          // Check if it's unlinked OR already linked to this invoice (user selected it manually)
          const isPendingOrLinkedToCurrent = !inc.invoice_id || inc.invoice_id === invoice.id;
          return facilityMatch && providerMatch && monthMatch && isPendingOrLinkedToCurrent;
        });
        
        // If no income record exists (neither pending nor already selected), create one
        if (!directorshipIncome) {
           let workDate = data.invoice_date;
           // Try to derive work date from invoice month (use 1st of month)
           if (data.month) {
               try {
                   const parts = data.month.split(' ');
                   if (parts.length === 2) {
                       const monthName = parts[0];
                       const year = parseInt(parts[1]);
                       const monthIndex = new Date(Date.parse(monthName + " 1, 2012")).getMonth();
                       const d = new Date(year, monthIndex, 1);
                       workDate = format(d, 'yyyy-MM-dd');
                   }
               } catch (e) {
                   console.warn("Could not parse month for date", e);
               }
           }

           directorshipIncome = await base44.entities.OutsideIncome.create({
               provider_id: data.staff_member_id,
               program_location_id: '691527907bf4ee75e9738b2e', // St. Francis (Directorship)
               facility_name: 'St. Francis (Directorship)',
               total_amount: 1750,
               rate: 1750,
               days_worked: 0,
               status: 'pending',
               work_dates: [workDate],
               description: 'Auto-generated Directorship Income from Invoice'
           });
        }

        // Link the directorship income to the current invoice if not already linked
        if (directorshipIncome) {
           // Get the latest invoice state to be safe
           const currentInvoice = await base44.entities.Invoice.get(invoice.id);
           const currentIncomeIds = currentInvoice.outside_income_ids || [];
           
           if (!currentIncomeIds.includes(directorshipIncome.id)) {
              // 1. Link Income to Invoice
              await base44.entities.OutsideIncome.update(directorshipIncome.id, {
                invoice_id: invoice.id,
                invoice_month: data.month || '',
                status: 'invoiced'
              });

              // 2. Add Income to Invoice and Update Totals
              const newIncomeIds = [...currentIncomeIds, directorshipIncome.id];
              const addedAmount = directorshipIncome.total_amount || 1750;
              
              await base44.entities.Invoice.update(invoice.id, {
                outside_income_ids: newIncomeIds,
                subtotal: (currentInvoice.subtotal || 0) + addedAmount,
                total: (currentInvoice.total || 0) + addedAmount,
                amount_expected: (currentInvoice.amount_expected || 0) + addedAmount
              });
           }
        }
      }
      
      return invoice;
    },
    onSuccess: (invoice, data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['outside-income'] });
      setShowForm(false);
      setEditingInvoice(null);
      setPreselectedIncomes([]);
      auditCreate('Invoice', data).catch(e => console.error('[Audit]', e));
    },
    onError: (error) => {
      if (error?.status === 403 || error?.response?.status === 403 || error?.message?.includes('403')) {
        toast({
          variant: "destructive",
          title: "Permission Denied",
          description: "You do not have permission to create invoices."
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to create invoice: " + error.message
        });
      }
    }
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, statusChanged }) => {
      // If status was manually changed, set the override flag
      if (statusChanged) {
        data.manual_status_override = true;
      }
      
      const originalInvoice = invoices.find(inv => inv.id === id);
      const originalIncomeIds = originalInvoice?.outside_income_ids || [];
      const newIncomeIds = data.outside_income_ids || [];
      
      const unlinkedIncomes = originalIncomeIds.filter(incId => !newIncomeIds.includes(incId));
      const newlyLinkedIncomes = newIncomeIds.filter(incId => !originalIncomeIds.includes(incId));
      
      const invoice = await base44.entities.Invoice.update(id, data);
      
      for (const incomeId of unlinkedIncomes) {
        await base44.entities.OutsideIncome.update(incomeId, {
          invoice_id: null,
          invoice_month: null,
          status: 'pending'
        });
      }
      
      for (const incomeId of newlyLinkedIncomes) {
        await base44.entities.OutsideIncome.update(incomeId, {
          invoice_id: invoice.id,
          invoice_month: data.month || '',
          status: 'invoiced'
        });
      }
      
      for (const incomeId of newIncomeIds) {
        await base44.entities.OutsideIncome.update(incomeId, {
          invoice_month: data.month || ''
        });
      }
      
      return invoice;
    },
    onSuccess: (invoice, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['outside-income'] });
      setShowForm(false);
      const oldRecord = editingInvoice;
      setEditingInvoice(null);
      auditUpdate('Invoice', variables.id, variables.data, oldRecord).catch(e => console.error('[Audit]', e));
    },
    onError: (error) => {
      if (error?.status === 403 || error?.response?.status === 403 || error?.message?.includes('403')) {
        toast({
          variant: "destructive",
          title: "Permission Denied",
          description: "You do not have permission to update invoices."
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update invoice: " + error.message
        });
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (invoice) => {
      if (invoice.outside_income_ids && invoice.outside_income_ids.length > 0) {
        // Use Promise.all to handle updates in parallel and continue even if one fails
        await Promise.all(invoice.outside_income_ids.map(async (incomeId) => {
          try {
            await base44.entities.OutsideIncome.update(incomeId, {
              invoice_id: null,
              invoice_month: null,
              status: 'pending'
            });
          } catch (err) {
            console.warn(`Failed to unlink income ${incomeId}:`, err);
            // Continue with deletion even if unlinking fails (e.g. income record deleted)
          }
        }));
      }
      
      await base44.entities.Invoice.delete(invoice.id);
    },
    onSuccess: (result, invoice) => {
      const snapshot = deleteConfirm;
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['outside-income'] });
      setDeleteConfirm(null);
      auditDelete('Invoice', invoice.id, snapshot).catch(e => console.error('[Audit]', e));
    },
    onError: (error) => {
      if (error?.status === 403 || error?.response?.status === 403 || error?.message?.includes('403')) {
        toast({
          variant: "destructive",
          title: "Permission Denied",
          description: "You do not have permission to delete invoices."
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: `Failed to delete invoice: ${error.message}`
        });
      }
    }
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, updateData }) => {
      // Mark as manually overridden if status is being changed
      if (updateData.status) {
        updateData.manual_status_override = true;
      }
      const updates = ids.map(id => 
        base44.entities.Invoice.update(id, updateData)
      );
      return Promise.all(updates);
    },
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      // Non-blocking bulk audit log
      variables.ids.forEach(id => {
        const old = invoices.find(inv => inv.id === id) || null;
        auditUpdate('Invoice', id, variables.updateData, old).catch(e => console.error('[Audit]', e));
      });
      setSelectedInvoices([]);
      setBulkDateProviderPaid('');
      setBulkProviderPaid(false);
      setBulkStatusUpdate('');
    },
    onError: (error) => {
      if (error?.status === 403 || error?.response?.status === 403 || error?.message?.includes('403')) {
        toast({
          variant: "destructive",
          title: "Permission Denied",
          description: "You do not have permission to update these invoices."
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update invoices: " + error.message
        });
      }
    }
  });

  const handleSubmit = (data, statusChanged) => {
    if (editingInvoice) {
      updateMutation.mutate({ id: editingInvoice.id, data, statusChanged });
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



  const handleCancelForm = () => {
    setShowForm(false);
    setEditingInvoice(null);
    setPreselectedIncomes([]);
  };

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedInvoices(sortedInvoices.map(invoice => invoice.id));
    } else {
      setSelectedInvoices([]);
    }
  };

  const handleSelectInvoice = (invoiceId, checked) => {
    if (checked) {
      setSelectedInvoices([...selectedInvoices, invoiceId]);
    } else {
      setSelectedInvoices(selectedInvoices.filter(id => id !== invoiceId));
    }
  };

  const handleBulkUpdate = () => {
    if (selectedInvoices.length > 0) {
      const updateData = {};

      if (bulkDateProviderPaid) {
        updateData.date_provider_paid = bulkDateProviderPaid;
      }

      if (bulkProviderPaid) {
        updateData.provider_paid = true;
        updateData.status = 'provider_paid';
      }

      if (bulkStatusUpdate) {
        updateData.status = bulkStatusUpdate;
      }

      if (Object.keys(updateData).length > 0) {
        bulkUpdateMutation.mutate({ ids: selectedInvoices, updateData });
      }
    }
  };

  const handleMarkQuarterPaid = (quarterPrefix) => {
    const currentYear = new Date().getFullYear();
    const targetQuarter = `${quarterPrefix} ${currentYear}`;
    const today = new Date();

    // Calculate quarter end date
    let quarterEndDate;
    switch (quarterPrefix) {
      case 'Q1': quarterEndDate = new Date(currentYear, 2, 31); break; // March 31
      case 'Q2': quarterEndDate = new Date(currentYear, 5, 30); break; // June 30
      case 'Q3': quarterEndDate = new Date(currentYear, 8, 30); break; // Sept 30
      case 'Q4': quarterEndDate = new Date(currentYear, 11, 31); break; // Dec 31
      default: return;
    }

    // Normalize dates to start of day for comparison
    const isOver = today > quarterEndDate;

    if (!isOver) {
      alert(`Quarter ${quarterPrefix} of ${currentYear} is not yet complete.\n\nYou can only use this action after ${format(quarterEndDate, 'MMMM d, yyyy')}.`);
      return;
    }

    // Filter invoices for this quarter that aren't already paid to provider
    const targetInvoices = invoicesWithProviders.filter(inv => 
      inv.quarter === targetQuarter && 
      !inv.provider_paid && 
      inv.status !== 'provider_paid'
    );

    if (targetInvoices.length === 0) {
      alert(`No unpaid invoices found for ${targetQuarter}.`);
      return;
    }

    if (!window.confirm(`Are you sure you want to mark ${targetInvoices.length} invoices for ${targetQuarter} as 'Paid to Provider'?\n\nThis will:\n- Set status to 'Provider Paid'\n- Set paid date to today (${format(today, 'MM/dd/yyyy')})\n- Prevent further auto-updates`)) {
      return;
    }

    const ids = targetInvoices.map(inv => inv.id);
    const updateData = {
      status: 'provider_paid',
      provider_paid: true,
      date_provider_paid: format(today, 'yyyy-MM-dd'),
      manual_status_override: true
    };

    bulkUpdateMutation.mutate({ ids, updateData });
  };

  const handleSingleSyncToAirtable = async (invoice) => {
    const isManchester = invoice.program_group && (
       invoice.program_group.toLowerCase().includes('manchester') || 
       invoice.program_group.toLowerCase().includes('echn')
    );
    const isUConn = invoice.program_group?.toLowerCase().includes('uconn');
    const isHartford = invoice.program_group === 'Hartford Hospital';

    if (!isManchester && !isUConn && !isHartford) return;

    const targetName = isManchester ? 'Manchester' : isHartford ? 'Hartford Hospital' : 'UConn';
    if (!window.confirm(`Sync ${targetName} invoice ${invoice.invoice_number} to Airtable?`)) return;

    if (!invoice.approved_invoice_url) {
      alert('Cannot sync! This invoice does not have an approved PDF or Excel file. Please upload or generate one first.');
      return;
    }

    setSyncingAirtable(true);
    try {
      let functionName = 'syncUConnInvoiceToAirtable';
      if (isManchester) functionName = 'syncManchesterInvoiceToAirtable';
      if (isHartford) functionName = 'syncHartfordInvoiceToAirtable';

      await base44.functions.invoke(functionName, {
        invoices: [{ id: invoice.id, pdf_url: invoice.approved_invoice_url }]
      });

      const timestamp = new Date().toISOString();
      await base44.entities.Invoice.update(invoice.id, {
        status: 'sent_to_vendor',
        invoice_sent_to_vendor: true,
        sent_to_vendor_at: timestamp,
        manual_status_override: true
      });

      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      alert(`Successfully synced ${targetName} invoice to Airtable!`);
    } catch (error) {
      console.error("Sync error", error);
      let errorMessage = error.message;
      
      if (error.response) {
        if (error.response.data) {
           if (typeof error.response.data === 'object') {
             errorMessage = error.response.data.error || JSON.stringify(error.response.data);
             if (error.response.data.stack) {
                console.error("Server Stack:", error.response.data.stack);
             }
           } else {
             errorMessage = String(error.response.data);
           }
        } else {
           errorMessage = `Status ${error.response.status}: ${error.response.statusText}`;
        }
      }
      
      alert('Error syncing: ' + errorMessage);
    } finally {
      setSyncingAirtable(false);
    }
  };

  const handleBulkSyncToAirtable = async () => {
  if (!window.confirm(`Sync ${selectedInvoices.length} selected invoices to Airtable as ONE email?`)) return;

  setSyncingAirtable(true);
  const readyInvoices = [];
  const missingApproved = [];

  try {
  // 1. Check for approved invoice files
  for (const id of selectedInvoices) {
  const invoice = invoices.find(i => i.id === id);
  if (!invoice) continue;

  if (!invoice.approved_invoice_url) {
    missingApproved.push(invoice.invoice_number || 'Unknown Invoice');
  } else {
    readyInvoices.push({ id: invoice.id, pdf_url: invoice.approved_invoice_url });
  }
  }

  if (missingApproved.length > 0) {
    alert(`Cannot sync! The following invoices do not have an approved PDF or Excel file:\n\n${missingApproved.join('\n')}\n\nPlease ensure all selected invoices have an approved PDF or Excel file before syncing.`);
    setSyncingAirtable(false);
    return;
  }

  // 2. Send as a single batch
  if (readyInvoices.length > 0) {
    // Check if mixed types or predominantly one type
    const sampleInvoice = invoices.find(i => i.id === readyInvoices[0].id);
    const isManchester = sampleInvoice.program_group && (
       sampleInvoice.program_group.toLowerCase().includes('manchester') || 
       sampleInvoice.program_group.toLowerCase().includes('echn')
    );

    // Ensure all selected invoices match the type of the first one to avoid cross-sending
    const allMatch = readyInvoices.every(item => {
       const inv = invoices.find(i => i.id === item.id);
       const itemIsManchester = inv.program_group && (
           inv.program_group.toLowerCase().includes('manchester') || 
           inv.program_group.toLowerCase().includes('echn')
       );
       return isManchester === itemIsManchester;
    });

    if (!allMatch) {
        alert("Error: You have selected a mix of Manchester and UConn invoices. Please select only one type at a time for bulk syncing.");
        setSyncingAirtable(false);
        return;
    }

    const functionName = isManchester ? 'syncManchesterInvoiceToAirtable' : 'syncUConnInvoiceToAirtable';
    const targetName = isManchester ? 'Manchester' : 'UConn';

    await base44.functions.invoke(functionName, {
        invoices: readyInvoices
    });

    // Update status to 'sent_to_vendor' for all synced invoices
    const timestamp = new Date().toISOString();
    await Promise.all(readyInvoices.map(inv => 
      base44.entities.Invoice.update(inv.id, {
        status: 'sent_to_vendor',
        invoice_sent_to_vendor: true,
        sent_to_vendor_at: timestamp,
        manual_status_override: true
      })
    ));

    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    alert(`Successfully synced ${readyInvoices.length} ${targetName} invoices as one email and updated statuses!`);
    setSelectedInvoices([]);
  }

  } catch (error) {
  console.error("Bulk sync error", error);
  alert('Error syncing: ' + error.message);
  } finally {
  setSyncingAirtable(false);
  }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleGeneratePDF = async (invoice) => {
    try {
      let functionName = 'generateUConnExcel';
      let isExcel = true;

      // Check if it's a Manchester/ECHN invoice
      if (invoice.program_group && (
          invoice.program_group.toLowerCase().includes('manchester') || 
          invoice.program_group.toLowerCase().includes('echn')
      )) {
        functionName = 'generateManchesterPDF';
        isExcel = false;
      }

      const response = await base44.functions.invoke(functionName, { invoice_id: invoice.id });

      const base64Data = response.data?.file_base64 || response.data?.pdf_base64;

      if (base64Data) {
        // Convert Base64 to Blob
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const mimeType = isExcel 
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
          : 'application/pdf';

        const blob = new Blob([byteArray], { type: mimeType });

        // Trigger Download
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = response.data.filename || `Invoice_${invoice.invoice_number || 'draft'}.${isExcel ? 'xlsx' : 'pdf'}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("Error generating invoice:", error);
      alert("Failed to generate invoice. Please try again.");
    }
  };

  const handleFixHartfordInvoices = async () => {
    setFixingHartford(true);
    setFixMessage('');
    try {
      const response = await base44.functions.invoke('fixHartfordDirectorshipInvoices', {});
      setFixMessage(response.data.message);
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['outside-income'] });
    } catch (error) {
      setFixMessage('Error: ' + error.message);
    } finally {
      setFixingHartford(false);
    }
    };



    const handleInvoiceNumberClick = (invoice) => {
    setEditingInvoice(invoice);
    setPreselectedIncomes([]);
    setShowForm(true);
  };

  const handleQuickUploadClick = (invoice) => {
    setUploadingId(invoice.id);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset
      fileInputRef.current.click();
    }
  };

  const handleQuickUploadFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingId) return;

    const invoice = invoices.find(inv => inv.id === uploadingId);
    if (!invoice) return;

    const fileName = file.name?.toLowerCase() || '';
    const isAllowedInvoiceFile = fileName.endsWith('.pdf') || fileName.endsWith('.xls') || fileName.endsWith('.xlsx');
    if (!isAllowedInvoiceFile) {
      alert('Please attach a PDF or Excel file (.pdf, .xls, .xlsx).');
      e.target.value = '';
      setUploadingId(null);
      return;
    }

    try {
      // 1. Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // 2. Prepare updates
      const updates = {
        approved_invoice_url: file_url
      };

      // Auto-update status logic (matching form behavior)
      if (invoice.status !== 'paid_to_entic' && invoice.status !== 'provider_paid' && invoice.status !== 'sent_to_vendor') {
        updates.status = 'approved';
        updates.invoice_sent_to_vendor = false;
        updates.manual_status_override = true;
      }

      // 3. Update invoice
      await base44.entities.Invoice.update(uploadingId, updates);

      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setUploadingId(null);
    } catch (error) {
      console.error("Quick upload failed:", error);
      alert("Failed to upload invoice: " + error.message);
      setUploadingId(null);
    }
  };

  const formatCurrency = (amount) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };



  const invoicesWithProviders = invoices.map(invoice => {
    // Find all providers associated with this invoice (primary + linked via income)
    const linkedProviderIds = new Set();
    if (invoice.staff_member_id) linkedProviderIds.add(invoice.staff_member_id);

    if (invoice.outside_income_ids && invoice.outside_income_ids.length > 0) {
      invoice.outside_income_ids.forEach(incId => {
        const income = incomes.find(inc => inc.id === incId);
        if (income && income.provider_id) linkedProviderIds.add(income.provider_id);
      });
    }

    const linkedProviderNames = Array.from(linkedProviderIds).map(pid => 
      providers.find(p => p.id === pid)?.full_name
    ).filter(Boolean).join(' ');

    // Calculate Quarter
    const linkedPayments = payments.filter(p => 
      p.allocations?.some(a => a.invoice_id === invoice.id)
    );
    let quarter = '-';
    let latestPaymentTimestamp = 0;

    if (linkedPayments.length > 0) {
      const latest = [...linkedPayments].sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))[0];
      if (latest && latest.payment_date) {
        latestPaymentTimestamp = new Date(latest.payment_date).getTime();
        const d = parseISO(latest.payment_date);
        quarter = `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
      }
    }

    return {
      ...invoice,
      provider: providers.find(p => p.id === invoice.staff_member_id),
      providerName: providers.find(p => p.id === invoice.staff_member_id)?.full_name || '',
      linkedProviderNames, // For search purposes
      balance: (invoice.amount_expected || invoice.total || 0) - (invoice.amount_received || 0),
      hasOutsideIncome: invoice.outside_income_ids && invoice.outside_income_ids.length > 0,
      quarter,
      latestPaymentTimestamp
    };
    });

  const filteredInvoices = invoicesWithProviders.filter(invoice => {
    const matchesSearch = invoice.program_group?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.provider?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.linkedProviderNames?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.month?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesNoIncomeFilter = !filterNoIncome || (!invoice.hasOutsideIncome && !(invoice.program_group?.includes('St. Francis') && new Date(invoice.invoice_date) < new Date('2025-08-01')));
    const matchesStatus = statusFilter === 'all' || statusFilter.split(',').includes(invoice.status);
    
    return matchesSearch && matchesNoIncomeFilter && matchesStatus;
  });

  // Calculate total of selected invoices
  const selectedInvoicesTotal = React.useMemo(() => {
    return invoices
      .filter(inv => selectedInvoices.includes(inv.id))
      .reduce((sum, inv) => sum + (inv.total || 0), 0);
  }, [invoices, selectedInvoices]);

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
    } else if (sortField === 'quarter') {
      aValue = a.latestPaymentTimestamp || 0;
      bValue = b.latestPaymentTimestamp || 0;
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    } else if (sortField === 'manual_status_override') {
      aValue = a.manual_status_override ? 1 : 0;
      bValue = b.manual_status_override ? 1 : 0;
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
    not_started: "bg-gray-100 text-gray-700",
    draft: "bg-slate-200 text-slate-700",
    pending_providers_approval: "bg-yellow-100 text-yellow-800",
    pending_providers_time: "bg-orange-100 text-orange-800",
    sent_to_provider_for_approval: "bg-sky-100 text-sky-800",
    sent_to_provider_for_review: "bg-violet-100 text-violet-800",
    sent_for_approval: "bg-blue-100 text-blue-800",
    sent_to_coo_for_approval: "bg-indigo-100 text-indigo-800",
    approved: "bg-green-100 text-green-800",
    sent_to_vendor: "bg-teal-100 text-teal-800",
    paid_to_entic: "bg-amber-100 text-amber-800",
    provider_paid: "bg-purple-100 text-purple-800",
    partial: "bg-cyan-100 text-cyan-800"
  };

  const getStatusLabel = (invoice) => {
    if (invoice.status === 'paid_to_entic') return 'Paid To ENTIC';
    if (invoice.status === 'provider_paid') return 'Provider Paid';
    if (invoice.status === 'partial') return 'Partial';
    return invoice.status?.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getInvoiceEmailRecord = (invoiceId) => {
    const records = notificationQueue.filter(n => n.related_record_id === invoiceId);
    if (records.length === 0) return null;
    return [...records].sort((a, b) => new Date(b.created_date || 0) - new Date(a.created_date || 0))[0];
  };

  const getInvoiceEmailStatus = (invoice) => {
    const record = getInvoiceEmailRecord(invoice.id);
    if (!record) return { label: 'Not Queued', className: 'bg-slate-100 text-slate-600' };
    const classMap = {
      'Ready to Send': 'bg-blue-100 text-blue-800',
      Sent: 'bg-green-100 text-green-800',
      Failed: 'bg-red-100 text-red-800',
      Cancelled: 'bg-slate-100 text-slate-600'
    };
    return {
      label: record.status === 'Ready to Send' ? 'Queued' : record.status,
      className: classMap[record.status] || 'bg-slate-100 text-slate-600',
      record
    };
  };

  if (invoicesLoading || providersLoading) {
    return <ListPageSkeleton />;
  }

  return (
    <>
    <div className={`flex flex-col bg-slate-50 h-full min-h-0 ${showForm ? 'overflow-auto' : 'overflow-hidden'}`}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-content, .print-content * { visibility: visible; }
          .print-content { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none !important; }
          .print-content table { width: 100%; border-collapse: collapse; }
          .print-content th, .print-content td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          .print-content th { background-color: #f5f5f5; }
        }
      `}</style>
      <div className="flex-shrink-0 p-2 md:p-3">
        <div className="max-w-none w-full space-y-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 no-print">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
            <p className="text-slate-600 text-sm">Manage invoices for outside income</p>
          </div>
          {/* Hidden file input for quick upload */}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".pdf,.xls,.xlsx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={handleQuickUploadFile}
          />
          <div className="flex gap-3 flex-wrap">
            {user?.role === 'admin' && (
              <>
              <Button
                onClick={handleFixHartfordInvoices}
                variant="outline"
                disabled={fixingHartford}
                className="gap-2"
              >
                {fixingHartford ? 'Fixing...' : 'Fix & Sync Data'}
              </Button>
              </>
              )}
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
                  setEditingInvoice(null);
                  setPreselectedIncomes([]);
                  setShowForm(true);
                }}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Invoice
              </Button>
            )}
          </div>
        </div>

        {fixMessage && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-900">{fixMessage}</p>
          </div>
        )}

        {showForm && (
          <div className="no-print">
            <InvoiceForm
              invoice={editingInvoice}
              incomes={incomes}
              preselectedIncomes={preselectedIncomes}
              onSubmit={handleSubmit}
              onCancel={handleCancelForm}
              isLoading={createMutation.isPending || updateMutation.isPending}
              isReadOnly={user?.role !== 'admin'}
            />
          </div>
        )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-4 md:px-6 pb-4">
        <div className="max-w-none w-full h-full">
        <div className="print-content h-full flex flex-col">
          <div className="hidden print:block mb-4 flex-shrink-0">
            <h1 className="text-2xl font-bold">Invoices Report</h1>
            <p className="text-sm text-gray-600">Generated on {formatDateToEST(new Date())}</p>
          </div>

          <Card className="border-slate-200 shadow-sm h-full flex flex-col">
            <CardHeader className="border-b border-slate-100 space-y-2 no-print flex-shrink-0">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <div className="flex items-center gap-4 flex-1">
                  <Search className="w-5 h-5 text-slate-400" />
                  <Input
                    placeholder="Search invoices..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-md border-slate-200"
                    />
                    </div>

                    {user?.role === 'admin' && (
                      <div className="flex items-center gap-1">
                      {['Q1', 'Q2', 'Q3', 'Q4'].map(q => (
                      <Button
                        key={q}
                        variant="outline"
                        size="sm"
                        onClick={() => handleMarkQuarterPaid(q)}
                        disabled={bulkUpdateMutation.isPending}
                        className="h-auto py-1 px-1 text-[10px] leading-3 whitespace-normal w-[50px] text-center border-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                      >
                        Pay Provider {q}
                      </Button>
                      ))}
                      </div>
                    )}

                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px] bg-white">
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="not_started">Not Started</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="pending_providers_approval">Pending Approval</SelectItem>
                    <SelectItem value="pending_providers_time">Pending Time</SelectItem>
                    <SelectItem value="sent_to_provider_for_approval">Sent to Provider for Approval</SelectItem>
                    <SelectItem value="sent_to_provider_for_review">Sent to Provider for Review</SelectItem>
                    <SelectItem value="sent_to_coo_for_approval">Sent to COO for Approval</SelectItem>
                    <SelectItem value="sent_for_approval">Sent for Approval</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="sent_to_vendor">Sent to Vendor</SelectItem>
                    <SelectItem value="paid_to_entic">Paid to ENTIC</SelectItem>
                    <SelectItem value="provider_paid">Provider Paid</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant={filterNoIncome ? "default" : "outline"}
                  onClick={() => setFilterNoIncome(!filterNoIncome)}
                  className={filterNoIncome ? "bg-orange-600 hover:bg-orange-700" : ""}
                >
                  <AlertCircle className="w-4 h-4 mr-2" />
                  {filterNoIncome ? "Showing No Income" : "Show Without Income"}
                </Button>
                </div>


              {selectedInvoices.length > 0 && user?.role === 'admin' && (
                <div className="flex flex-col xl:flex-row items-center justify-between gap-2 p-1.5 bg-blue-50 rounded-lg border border-blue-200 shadow-sm">
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold text-slate-900 text-sm whitespace-nowrap">
                      {selectedInvoices.length} selected
                    </span>
                    <Button 
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedInvoices([])}
                      className="h-8 text-xs text-slate-600 hover:text-slate-900 hover:bg-blue-100"
                    >
                      Clear
                    </Button>
                    <div className="h-4 w-px bg-slate-300 mx-1" />
                    <span className="font-bold text-slate-900 text-sm whitespace-nowrap">
                      Total: <span className="text-blue-600">${formatCurrency(selectedInvoicesTotal)}</span>
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center justify-end gap-3 w-full">
                    <Select 
                      value={bulkStatusUpdate} 
                      onValueChange={setBulkStatusUpdate}
                    >
                      <SelectTrigger className="w-[180px] h-9 text-sm bg-white">
                        <SelectValue placeholder="Update Status..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not_started">Not Started</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="pending_providers_approval">Pending Providers Approval</SelectItem>
                        <SelectItem value="pending_providers_time">Pending Providers Time</SelectItem>
                        <SelectItem value="sent_to_provider_for_approval">Sent to Provider for Approval</SelectItem>
                        <SelectItem value="sent_to_provider_for_review">Sent to Provider for Review</SelectItem>
                        <SelectItem value="sent_to_coo_for_approval">Sent to COO for Approval</SelectItem>
                        <SelectItem value="sent_for_approval">Sent for Approval</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="sent_to_vendor">Sent to Vendor</SelectItem>
                        <SelectItem value="paid_to_entic">Paid to ENTIC</SelectItem>
                        <SelectItem value="provider_paid">Provider Paid</SelectItem>
                      </SelectContent>
                    </Select>

                    <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 px-2 py-0.5 h-9">
                      <span className="text-xs text-slate-500 whitespace-nowrap">Paid:</span>
                      <Input
                        type="date"
                        value={bulkDateProviderPaid}
                        onChange={(e) => setBulkDateProviderPaid(e.target.value)}
                        className="w-auto border-0 p-0 h-8 text-sm focus-visible:ring-0"
                      />
                    </div>

                    <div className="flex items-center gap-2 bg-white rounded-md border border-slate-200 px-2 h-9">
                      <input
                        type="checkbox"
                        id="bulk-provider-paid"
                        checked={bulkProviderPaid}
                        onChange={(e) => setBulkProviderPaid(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="bulk-provider-paid" className="text-sm text-slate-700 cursor-pointer whitespace-nowrap">
                        Mark Paid
                      </label>
                    </div>

                    <Button 
                      onClick={handleBulkUpdate}
                      size="sm"
                      disabled={(!bulkDateProviderPaid && !bulkProviderPaid && !bulkStatusUpdate) || bulkUpdateMutation.isPending}
                      className="bg-blue-600 hover:bg-blue-700 h-9 whitespace-nowrap"
                    >
                      {bulkUpdateMutation.isPending ? '...' : 'Update'}
                    </Button>

                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
              <div className="overflow-auto flex-1 print:max-h-none print:overflow-visible">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-700 w-10 no-print">
                        <input
                          type="checkbox"
                          checked={selectedInvoices.length === sortedInvoices.length && sortedInvoices.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
                      <th 
                        className="text-left px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 print:cursor-default"
                        onClick={() => handleSort('invoice_number')}
                      >
                        Invoice # <SortIcon field="invoice_number" />
                      </th>
                      <th 
                        className="text-left px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 print:cursor-default"
                        onClick={() => handleSort('program_group')}
                      >
                        Program Group <SortIcon field="program_group" />
                      </th>
                      <th 
                        className="text-left px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 print:cursor-default"
                        onClick={() => handleSort('providerName')}
                      >
                        Provider <SortIcon field="providerName" />
                      </th>
                      <th 
                        className="text-left px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 print:cursor-default"
                        onClick={() => handleSort('month')}
                      >
                        Month <SortIcon field="month" />
                      </th>
                      <th 
                        className="text-left px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 print:cursor-default"
                        onClick={() => handleSort('invoice_date')}
                      >
                        Date <SortIcon field="invoice_date" />
                      </th>
                      <th 
                        className="text-left px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 print:cursor-default"
                        onClick={() => handleSort('total')}
                      >
                        Total <SortIcon field="total" />
                      </th>
                      <th 
                        className="text-left px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 print:cursor-default"
                        onClick={() => handleSort('amount_received')}
                      >
                        Paid <SortIcon field="amount_received" />
                      </th>
                      <th 
                        className="text-left px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 print:cursor-default"
                        onClick={() => handleSort('quarter')}
                      >
                        Quarter <SortIcon field="quarter" />
                      </th>
                      <th 
                        className="text-left px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 print:cursor-default"
                        onClick={() => handleSort('balance')}
                      >
                        Balance <SortIcon field="balance" />
                      </th>
                      <th 
                        className="text-left px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 print:cursor-default"
                        onClick={() => handleSort('status')}
                      >
                        Status <SortIcon field="status" />
                      </th>
                      <th 
                        className="text-center px-3 py-2 text-xs font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 no-print"
                        onClick={() => handleSort('manual_status_override')}
                      >
                        Manual <SortIcon field="manual_status_override" />
                      </th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-slate-700 no-print">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedInvoices.map((invoice) => (
                      <tr key={invoice.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors print:hover:bg-white ${selectedInvoices.includes(invoice.id) ? 'bg-blue-50' : ''} ${!invoice.hasOutsideIncome ? 'bg-orange-50/30' : ''}`}>
                        <td className="px-3 py-2 no-print">
                          <input
                            type="checkbox"
                            checked={selectedInvoices.includes(invoice.id)}
                            onChange={(e) => handleSelectInvoice(invoice.id, e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-2 text-sm">
                          <button
                            onClick={() => handleInvoiceNumberClick(invoice)}
                            className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer text-left"
                          >
                            {invoice.invoice_number || '-'}
                          </button>
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-600">{invoice.program_group}</td>
                        <td className="px-3 py-2 text-sm text-slate-900">{invoice.provider?.full_name || '-'}</td>
                        <td className="px-3 py-2 text-sm text-slate-600">{invoice.month || '-'}</td>
                        <td className="px-3 py-2 text-sm text-slate-600">
                          {formatDateToEST(invoice.invoice_date)}
                        </td>
                        <td className="px-3 py-2 text-sm font-medium text-slate-900">
                          ${formatCurrency(invoice.total || 0)}
                        </td>
                        <td className="px-3 py-2 text-sm text-green-600 font-medium">
                          ${formatCurrency(invoice.amount_received || 0)}
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-600">
                          {invoice.quarter}
                        </td>
                        <td className="px-3 py-2 text-sm font-medium text-slate-900">
                          ${formatCurrency(invoice.balance)}
                        </td>
                        <td className="px-3 py-2">
                          <Badge className={`${statusColors[invoice.status]} text-[10px]`}>
                            {getStatusLabel(invoice)}
                          </Badge>
                          {(() => {
                            const emailStatus = getInvoiceEmailStatus(invoice);
                            return (
                              <div className="mt-1 space-y-0.5">
                                <Badge className={`${emailStatus.className} text-[10px]`}>Email: {emailStatus.label}</Badge>
                                {emailStatus.record?.sent_date && (
                                  <div className="text-[10px] text-slate-500">Sent: {formatDateToEST(emailStatus.record.sent_date)}</div>
                                )}
                                {emailStatus.record?.error_message && (
                                  <div className="text-[10px] text-red-600 max-w-[160px] truncate" title={emailStatus.record.error_message}>{emailStatus.record.error_message}</div>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-3 py-2 text-center no-print">
                          {invoice.manual_status_override && user?.role === 'admin' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await base44.entities.Invoice.update(invoice.id, { manual_status_override: false });
                                queryClient.invalidateQueries({ queryKey: ['invoices'] });
                              }}
                              className="text-orange-600 hover:text-orange-700 h-6 w-6 p-0"
                              title="Click to allow automatic status updates"
                            >
                              🔒
                            </Button>
                          )}
                          {invoice.manual_status_override && user?.role !== 'admin' && (
                            <span className="text-orange-600 h-6 w-6 p-0 flex items-center justify-center cursor-help" title="Manual status override active">
                              🔒
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right no-print">
                          <div className="flex gap-2 justify-end">
                            {!invoice.program_group?.includes('St. Francis') && invoice.program_group !== 'Hartford Hospital' && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleGeneratePDF(invoice)}
                                title={invoice.program_group?.toLowerCase().includes('uconn') ? "Generate Excel File" : "Generate PDF"}
                                className={invoice.program_group?.toLowerCase().includes('uconn') ? "text-green-600 hover:text-green-700" : "text-blue-600 hover:text-blue-700"}
                              >
                                {invoice.program_group?.toLowerCase().includes('uconn') ? (
                                  <FileSpreadsheet className="w-4 h-4" />
                                ) : (
                                  <FileDown className="w-4 h-4" />
                                )}
                              </Button>
                            )}

                            {user?.role === 'admin' && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleQuickUploadClick(invoice)}
                                disabled={uploadingId === invoice.id}
                                title="Upload Approved Invoice (PDF or Excel)"
                                className="text-teal-600 hover:text-teal-700"
                              >
                                <Upload className={`w-4 h-4 ${uploadingId === invoice.id ? 'animate-pulse' : ''}`} />
                              </Button>
                            )}

                            {user?.role === 'admin' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setQueueEmailInvoice(invoice)}
                                title="Queue Invoice Email"
                                className="text-purple-600 hover:text-purple-700"
                              >
                                <Mail className="w-4 h-4" />
                              </Button>
                            )}

                            {user?.role === 'admin' && (invoice.program_group?.includes('UConn') || invoice.program_group?.includes('Manchester') || invoice.program_group?.includes('ECHN') || invoice.program_group === 'Hartford Hospital') && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleSingleSyncToAirtable(invoice)}
                                disabled={syncingAirtable}
                                title="Sync to Airtable"
                                className="text-indigo-600 hover:text-indigo-700 relative"
                              >
                                <CloudUpload className="w-4 h-4" />
                                <span className="absolute -bottom-1.5 -right-1.5 text-[8px] font-bold bg-white rounded-full border border-slate-200 px-0.5 min-w-[16px] text-center shadow-sm">
                                  {invoice.program_group?.includes('UConn') ? 'UC' : invoice.program_group === 'Hartford Hospital' ? 'HH' : 'M'}
                                </span>
                              </Button>
                            )}
                            
                            {invoice.approved_invoice_url && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => window.open(invoice.approved_invoice_url, '_blank')}
                                title="View Approved Invoice File"
                                className="text-purple-600 hover:text-purple-700"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                            )}

                            {user?.role === 'admin' && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setDeleteConfirm(invoice)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sortedInvoices.length === 0 && (
                  <div className="p-4">
                    <EmptyState
                      title="No invoices found"
                      description={searchTerm ? "Try adjusting your search or filters" : "Create your first invoice to get started"}
                      action={
                        !searchTerm && user?.role === 'admin' && (
                          <Button
                            onClick={() => {
                              setEditingInvoice(null);
                              setPreselectedIncomes([]);
                              setShowForm(true);
                            }}
                            className="bg-blue-600 hover:bg-blue-700 mt-4"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Create Invoice
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

      <InvoiceEmailQueueDialog
        invoice={queueEmailInvoice}
        open={!!queueEmailInvoice}
        onOpenChange={(open) => !open && setQueueEmailInvoice(null)}
        onQueued={() => queryClient.invalidateQueries({ queryKey: ['invoice-email-notifications'] })}
      />

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
    </>
  );
}