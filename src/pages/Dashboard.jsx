import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { differenceInDays, parseISO, format, subMonths, startOfDay } from "date-fns";
import { createPageUrl } from "@/utils";
import FinancialDetailModal from "../components/dashboard/FinancialDetailModal";
import { DashboardSkeleton } from "@/components/ui/LoadingSkeletons";

// Widgets
import AlertsWidget from "../components/dashboard/AlertsWidget";
import SummaryCardsWidget from "../components/dashboard/SummaryCardsWidget";
import PendingInvoicesWidget from "../components/dashboard/PendingInvoicesWidget";
import MissingInvoicesWidget from "../components/dashboard/MissingInvoicesWidget";
import LicenseExpirationsWidget from "../components/dashboard/LicenseExpirationsWidget";
import InvoiceSummaryWidget from "../components/dashboard/InvoiceSummaryWidget";
import FinancialOverviewWidget from "../components/dashboard/FinancialOverviewWidget";
import FinancialByProgramWidget from "../components/dashboard/FinancialByProgramWidget";
import CMEComplianceWidget from "../components/dashboard/CMEComplianceWidget";
import DashboardCustomizer, { DEFAULT_WIDGETS } from "../components/dashboard/DashboardCustomizer";

export default function Dashboard() {
  // Force rebuild timestamp: 2026-01-22
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [invoiceLocationFilter, setInvoiceLocationFilter] = useState('all');
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    invoices: [],
    type: '',
    programGroup: null
  });

  const queryClient = useQueryClient();

  // Common error handler for all queries
  const handleQueryError = (error) => {
    console.error('Dashboard query error:', error);
    // Don't redirect or throw - just log and let the query return empty data
    return [];
  };

  // Initialize config from sessionStorage
  const [dashboardConfig, setDashboardConfig] = useState(() => {
    return sessionStorage.getItem('dashboard_config');
  });

  const handleConfigChange = (newConfig) => {
    sessionStorage.setItem('dashboard_config', newConfig);
    setDashboardConfig(newConfig);
  };

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      try {
        return await base44.auth.me();
      } catch (error) {
        if (error.code === 'ECONNABORTED') return null;
        throw error;
      }
    },
    retry: false
  });

  const { data: providers = [], isLoading: providersLoading, isError: providersError } = useQuery({
    queryKey: ['providers'],
    queryFn: async () => {
      try {
        return await base44.entities.Provider.list();
      } catch (error) {
        return handleQueryError(error);
      }
    },
    retry: false,
    staleTime: 30000
  });

  const { data: licenses = [], isLoading: licensesLoading, isError: licensesError } = useQuery({
    queryKey: ['licenses'],
    queryFn: async () => {
      try {
        return await base44.entities.License.list();
      } catch (error) {
        return handleQueryError(error);
      }
    },
    retry: false,
    staleTime: 30000
  });

  const { data: privileges = [], isLoading: privilegesLoading, isError: privilegesError } = useQuery({
    queryKey: ['privileges'],
    queryFn: async () => {
      try {
        return await base44.entities.ClinicalPrivilege.list();
      } catch (error) {
        return handleQueryError(error);
      }
    },
    retry: false,
    staleTime: 30000
  });

  const { data: invoices = [], isLoading: invoicesLoading, isError: invoicesError } = useQuery({
    queryKey: ['invoices'],
    queryFn: async () => {
      try {
        return await base44.entities.Invoice.list();
      } catch (error) {
        return handleQueryError(error);
      }
    },
    retry: false,
    staleTime: 30000
  });

  const { data: cmeRecords = [], isLoading: cmeLoading, isError: cmeError } = useQuery({
    queryKey: ['cme'],
    queryFn: async () => {
      try {
        return await base44.entities.CME.list();
      } catch (error) {
        return handleQueryError(error);
      }
    },
    retry: false,
    staleTime: 30000
  });

  const { data: payments = [], isLoading: paymentsLoading, isError: paymentsError } = useQuery({
    queryKey: ['payments'],
    queryFn: async () => {
      try {
        return await base44.entities.Payment.list();
      } catch (error) {
        return handleQueryError(error);
      }
    },
    retry: false,
    staleTime: 30000
  });

  const { data: supplyOrders = [], isLoading: supplyOrdersLoading } = useQuery({
    queryKey: ['flagged-supply-orders'],
    queryFn: async () => {
      try {
        const allOrders = await base44.entities.SupplyOrder.list('-order_date');
        return allOrders.filter(order => 
          (order.status === 'pending_review' || order.status === 'pending_fulfillment') &&
          order.category === 'office'
        );
      } catch (error) {
        return handleQueryError(error);
      }
    },
    retry: false,
    staleTime: 30000
  });

  const { data: pendingVendorInvoices = [], isLoading: vendorInvoicesLoading } = useQuery({
    queryKey: ['pending-vendor-invoices'],
    queryFn: async () => {
      try {
        // Fetch invoices that are pending review
        const results = await base44.entities.VendorInvoice.filter({ status: 'pending_review' });
        return results;
      } catch (error) {
        return handleQueryError(error);
      }
    },
    retry: false,
    staleTime: 30000
  });

  const { data: rejectedVendorInvoices = [], isLoading: rejectedVendorInvoicesLoading } = useQuery({
    queryKey: ['rejected-vendor-invoices'],
    queryFn: async () => {
      try {
        // Fetch invoices that are rejected
        const results = await base44.entities.VendorInvoice.filter({ status: 'rejected' });
        return results;
      } catch (error) {
        return handleQueryError(error);
      }
    },
    retry: false,
    staleTime: 30000
  });

  const { data: partiallyReceivedOrders = [] } = useQuery({
    queryKey: ['partially-received-orders'],
    queryFn: async () => {
      try {
        return await base44.entities.SupplyOrder.filter({ status: 'partially_received' });
      } catch (error) {
        return handleQueryError(error);
      }
    },
    retry: false,
    staleTime: 30000
  });

  const { data: updatedOrders = [] } = useQuery({
    queryKey: ['updated-supply-orders'],
    queryFn: async () => {
      try {
        const orders = await base44.entities.SupplyOrder.filter({ updated_after_submission: true });
        // Exclude orders that have already been placed or received
        const processedStatuses = ['order_placed', 'received', 'partially_received', 'rejected'];
        return orders.filter(order => !processedStatuses.includes(order.status));
        } catch (error) {
        return handleQueryError(error);
      }
    },
    retry: false,
    staleTime: 30000
  });

  const { data: outsideIncomes = [] } = useQuery({
    queryKey: ['outside-income'],
    queryFn: async () => {
      try {
        return await base44.entities.OutsideIncome.list();
      } catch (error) {
        return handleQueryError(error);
      }
    },
    retry: false,
    staleTime: 30000
  });

  const { data: programLocations = [] } = useQuery({
    queryKey: ['program-locations'],
    queryFn: async () => {
      try {
        return await base44.entities.ProgramLocation.list();
      } catch (error) {
        return handleQueryError(error);
      }
    },
    retry: false,
    staleTime: 30000
  });

  const { data: invoiceWaivers = [] } = useQuery({
  queryKey: ['invoice-waivers'],
  queryFn: async () => {
  try {
  return await base44.entities.InvoiceWaiver.list();
  } catch (error) {
  return handleQueryError(error);
  }
  },
  retry: false,
  staleTime: 30000
  });

  const { data: cmeWaivers = [] } = useQuery({
  queryKey: ['cme-waivers'],
  queryFn: async () => {
  try {
  return await base44.entities.CMEWaiver.list();
  } catch (error) {
  return handleQueryError(error);
  }
  },
  retry: false,
  staleTime: 30000
  });

  const createWaiverMutation = useMutation({
    mutationFn: (data) => base44.entities.InvoiceWaiver.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-waivers'] });
    }
  });

  const deleteWaiverMutation = useMutation({
    mutationFn: (id) => base44.entities.InvoiceWaiver.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice-waivers'] });
    }
  });

  const createCMEWaiverMutation = useMutation({
  mutationFn: (data) => base44.entities.CMEWaiver.create(data),
  onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: ['cme-waivers'] });
  }
  });

  // Calculate up-to-date financial items (invoices + direct outside income) based on payments
  const processedFinancialItems = React.useMemo(() => {
    const invoiceAllocations = {};
    const incomeAllocations = {};

    payments.forEach(payment => {
      payment.allocations?.forEach(allocation => {
        if (allocation.invoice_id) {
          invoiceAllocations[allocation.invoice_id] = (invoiceAllocations[allocation.invoice_id] || 0) + (allocation.amount || 0);
        }
        if (allocation.outside_income_id) {
          incomeAllocations[allocation.outside_income_id] = (incomeAllocations[allocation.outside_income_id] || 0) + (allocation.amount || 0);
        }
      });
    });

    const items = invoices.map(inv => {
      let programGroup = inv.program_group;

      // Normalize inconsistent Manchester/ECHN names
      if (programGroup === 'HH - Manchester / ECHN' || programGroup === 'HH - Manchester/ECHN') {
        programGroup = 'HH- Manchester/ECHN';
      }

      return {
        ...inv,
        program_group: programGroup,
        type: 'invoice',
        amount_received: invoiceAllocations[inv.id] || 0
      };
    });

    // Add standalone Outside Income items (direct payers) that are not linked to an invoice
    // Only include known direct payers and Hartford/St. Francis (for directorships etc) to avoid double-counting invoiced programs
    const directPayers = ['Quinnipiac University', 'Nations Hearing'];
    
    const directIncomeItems = outsideIncomes.filter(inc => 
      !inc.invoice_id && 
      inc.facility_name && 
      (
        directPayers.includes(inc.facility_name) ||
        inc.facility_name.includes('Hartford Hospital') || 
        inc.facility_name.includes('St. Francis')
      )
    );
    
    directIncomeItems.forEach(inc => {
       const received = incomeAllocations[inc.id] || 0;
       
       // Map status equivalent for dashboard logic
       let mappedStatus = 'draft';
       if (inc.status === 'entic_paid') mappedStatus = 'paid_to_entic';
       else if (inc.status === 'paid') mappedStatus = 'paid_to_entic'; 
       else if (inc.status === 'invoiced') mappedStatus = 'sent_to_vendor'; 
       else if (received >= (inc.total_amount || 0) && (inc.total_amount || 0) > 0) mappedStatus = 'paid_to_entic';
       else if (received > 0) mappedStatus = 'sent_to_vendor'; // Partial payment usually means active
       else mappedStatus = 'sent_to_vendor'; // Default direct income to active/sent state so it shows as outstanding
       
       // Normalize program group name for Hartford and St. Francis to ensure aggregation
       let programGroup = inc.facility_name;
       if (programGroup.includes('Hartford Hospital')) programGroup = 'Hartford Hospital';
       if (programGroup.includes('St. Francis')) programGroup = 'St. Francis';

       items.push({
         id: inc.id,
         invoice_number: inc.external_invoice_number || 'Direct',
         program_group: programGroup, 
         amount_expected: inc.amount_due || inc.total_amount || 0,
         total: inc.amount_due || inc.total_amount || 0,
         amount_received: received,
         status: mappedStatus,
         provider_paid: false, 
         invoice_date: inc.work_dates?.[0] || inc.created_date,
         staff_member_id: inc.provider_id,
         type: 'direct_income',
         original_status: inc.status
       });
    });

    return items;
  }, [invoices, payments, outsideIncomes]);

  // Missing Prior Month Invoices Tracking
  const targetProviderNames = [
    "belachew tessema",
    "benjamin wycherly",
    "erin alday",
    "hailun wang",
    "jerlon chi",
    "kimberly rutherford",
    "ryan drake",
    "seth brown",
    "stephen wolfe"
  ];

  const previousMonthDate = subMonths(new Date(), 1);
  const previousMonthStr = format(previousMonthDate, 'MMMM yyyy');

  const targetProviders = providers.filter(p => 
    p.status === 'active' && 
    targetProviderNames.some(name => p.full_name.toLowerCase().includes(name))
  );

  const providersMissingPriorInvoice = targetProviders.map(provider => {
    // Determine expected program groups
    let expectedGroups = new Set();
    const isTessema = provider.full_name.toLowerCase().includes('belachew tessema');
    
    if (isTessema) {
      expectedGroups.add('Hartford Hospital');
    } else if (provider.program_locations && provider.program_locations.length > 0) {
      // Map locations to groups
      provider.program_locations.forEach(locName => {
        // 1. Try exact match from ProgramLocation entity
        const progLoc = programLocations.find(pl => pl.program_location === locName);
        if (progLoc && progLoc.program_group) {
          expectedGroups.add(progLoc.program_group);
        } else {
          // 2. Fallback heuristic for when ProgramLocation entity lookup fails
          const lowerLoc = locName.toLowerCase();
          if (lowerLoc.includes('hartford hospital')) expectedGroups.add('Hartford Hospital');
          else if (lowerLoc.includes('st. francis') || lowerLoc.includes('saint francis')) expectedGroups.add('St. Francis');
          else if (lowerLoc.includes('uconn')) expectedGroups.add('UConn');
          else if (lowerLoc.includes('manchester') || lowerLoc.includes('echn')) expectedGroups.add('Manchester / ECHN');
          else if (lowerLoc.includes('ccmc')) expectedGroups.add('CCMC');
          else if (lowerLoc.includes('bloomfield') || lowerLoc.includes('basc')) expectedGroups.add('Bloomfield');
        }
      });
    }

    // If no groups found/mapped, fallback to 'ANY' (backward compatibility)
    if (expectedGroups.size === 0) {
      expectedGroups.add('ANY');
    }

    const missingGroups = [];

    expectedGroups.forEach(group => {
      // 1. Check if waived (Global or Specific)
      const isWaived = invoiceWaivers.some(w => 
        w.provider_id === provider.id && 
        w.month === previousMonthStr && 
        (!w.program_group || w.program_group === group || (group === 'ANY'))
      );

      if (isWaived) return; // Skip if waived

      // 2. Check if invoice exists
      const hasInvoice = invoices.some(inv => {
        const matchProvider = inv.staff_member_id === provider.id;
        const matchMonth = inv.month === previousMonthStr;
        if (!matchProvider || !matchMonth) return false;

        if (group === 'ANY') return true;
        return inv.program_group === group;
      });

      if (hasInvoice) return; // Skip if invoice exists

      // 3. Check linked income
      const hasLinkedIncome = outsideIncomes.some(inc => {
        const matchProvider = inc.provider_id === provider.id;
        const matchMonth = (inc.invoice_month === previousMonthStr || inc.workMonth === previousMonthStr);
        if (!matchProvider || !matchMonth || !inc.invoice_id) return false;

        if (group === 'ANY') return true;
        
        const linkedInvoice = invoices.find(inv => inv.id === inc.invoice_id);
        return linkedInvoice && linkedInvoice.program_group === group;
      });

      if (hasLinkedIncome) return;

      missingGroups.push(group);
    });

    if (missingGroups.length > 0) {
      return { ...provider, missingGroups };
    }
    return null;
  }).filter(Boolean);

  // Providers with pending approval invoices (Any Date)
  const providersWithPendingInvoices = React.useMemo(() => {
    const relevantStatuses = ['pending_providers_approval', 'sent_for_approval', 'sent_to_provider_for_approval', 'sent_to_provider_for_review'];
    const pendingInvoices = invoices.filter(inv => relevantStatuses.includes(inv.status));
    
    const providerCounts = {};

    pendingInvoices.forEach(inv => {
        const invoiceProviderIds = new Set();
        
        // Add primary staff member
        if (inv.staff_member_id) invoiceProviderIds.add(inv.staff_member_id);

        // Add providers from linked outside incomes (for joint invoices)
        if (inv.outside_income_ids && inv.outside_income_ids.length > 0) {
            inv.outside_income_ids.forEach(incId => {
                const income = outsideIncomes.find(inc => inc.id === incId);
                if (income && income.provider_id) {
                    invoiceProviderIds.add(income.provider_id);
                }
            });
        }

        // Increment count for each unique provider on this invoice
        invoiceProviderIds.forEach(pid => {
            providerCounts[pid] = (providerCounts[pid] || 0) + 1;
        });
    });
    
    // Also collect program groups per provider
    const providerGroups = {};
    pendingInvoices.forEach(inv => {
      const invoiceProviderIds = new Set();
      if (inv.staff_member_id) invoiceProviderIds.add(inv.staff_member_id);
      if (inv.outside_income_ids && inv.outside_income_ids.length > 0) {
        inv.outside_income_ids.forEach(incId => {
          const income = outsideIncomes.find(inc => inc.id === incId);
          if (income && income.provider_id) invoiceProviderIds.add(income.provider_id);
        });
      }
      invoiceProviderIds.forEach(pid => {
        if (!providerGroups[pid]) providerGroups[pid] = new Set();
        if (inv.program_group) providerGroups[pid].add(inv.program_group);
      });
    });

    return Object.entries(providerCounts).map(([id, count]) => {
        const provider = providers.find(p => p.id === id);
        if (!provider) return null;
        return { ...provider, pendingCount: count, programGroups: Array.from(providerGroups[id] || []) };
    }).filter(Boolean).sort((a, b) => b.pendingCount - a.pendingCount);
  }, [invoices, providers, outsideIncomes]);

  // Format currency with commas
  const formatCurrency = (amount) => {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Check if there were any errors loading critical data
  const hasErrors = providersError || licensesError || privilegesError || invoicesError || cmeError || paymentsError;
  
  // Provider counts
  const activeProviders = providers.filter(p => p.status === 'active').length;

  // License expiration tracking
  const today = startOfDay(new Date());
  const licensesExpiring60Days = licenses.filter(l => {
    const provider = providers.find(p => p.id === l.provider_id);
    if (!provider || provider.status !== 'active') return false;
    const days = differenceInDays(parseISO(l.expiration_date), today);
    return days > 0 && days <= 60;
  });
  const licensesExpiring30Days = licenses.filter(l => {
    const provider = providers.find(p => p.id === l.provider_id);
    if (!provider || provider.status !== 'active') return false;
    const days = differenceInDays(parseISO(l.expiration_date), today);
    return days > 0 && days <= 30;
  });
  const licensesExpiring14Days = licenses.filter(l => {
    const provider = providers.find(p => p.id === l.provider_id);
    if (!provider || provider.status !== 'active') return false;
    const days = differenceInDays(parseISO(l.expiration_date), today);
    return days > 0 && days <= 14;
  });
  const licensesExpiring7Days = licenses.filter(l => {
    const provider = providers.find(p => p.id === l.provider_id);
    if (!provider || provider.status !== 'active') return false;
    const days = differenceInDays(parseISO(l.expiration_date), today);
    return days > 0 && days <= 7;
  });

  // Privilege expiration tracking - only privileges expiring within 30 days (not already expired)
  const privilegesExpiring30Days = privileges.filter(p => {
    const provider = providers.find(prov => prov.id === p.provider_id);
    if (provider?.status !== 'active') return false;
    const days = differenceInDays(parseISO(p.expiration_date), today);
    return days > 0 && days <= 30;
  });

  // Financial metrics - Total using processedFinancialItems for consistency
  const programsExcludedFromProviderPay = ['Nations Hearing', 'Quinnipiac University'];

  const totalPaidToENTIC = processedFinancialItems.reduce((sum, inv) => sum + (inv.amount_received || 0), 0);

  const totalOwedToProviders = processedFinancialItems
    .filter(inv => (inv.amount_received > 0) && !inv.provider_paid && !programsExcludedFromProviderPay.includes(inv.program_group))
    .reduce((sum, inv) => sum + (inv.amount_received || 0), 0);

  const outstandingToENTIC = processedFinancialItems
    .filter(inv => inv.status !== 'paid_to_entic' && inv.status !== 'provider_paid')
    .reduce((sum, inv) => {
      const outstanding = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
      return sum + (outstanding > 0 ? outstanding : 0);
    }, 0);

  const unallocatedPayments = payments.reduce((sum, payment) => sum + (payment.unallocated_amount || 0), 0);

  // Financial metrics by Program/Location
  const financialsByProgram = {};
  processedFinancialItems.forEach(inv => {
    const program = inv.program_group || 'Unassigned';
    
    if (!financialsByProgram[program]) {
      financialsByProgram[program] = {
        paidToENTIC: 0,
        owedToProviders: 0,
        outstanding: 0
      };
    }
    
    if (inv.amount_received > 0) {
      financialsByProgram[program].paidToENTIC += (inv.amount_received || 0);
      
      if (!inv.provider_paid && !programsExcludedFromProviderPay.includes(program)) {
        financialsByProgram[program].owedToProviders += (inv.amount_received || 0);
      }
    }
    
    const outstanding = (inv.amount_expected || inv.total || 0) - (inv.amount_received || 0);
    if (outstanding > 0 && inv.status !== 'paid_to_entic' && inv.status !== 'provider_paid') {
      financialsByProgram[program].outstanding += outstanding;
    }
  });

  const programsSorted = Object.keys(financialsByProgram).sort();

  // Invoice tracking
  const sentForApprovalInvoices = invoices.filter(inv => 
    inv.status === 'sent_for_approval'
  ).length;

  const sentToCOOInvoices = invoices.filter(inv => 
    inv.status === 'sent_to_coo_for_approval'
  ).length;

  const sentToProviderForApprovalCount = invoices.filter(inv => 
    inv.status === 'sent_to_provider_for_approval'
  ).length;

  const sentToProviderForReviewCount = invoices.filter(inv => 
    inv.status === 'sent_to_provider_for_review'
  ).length;

  const pendingProviderApprovalCount = invoices.filter(inv => 
    inv.status === 'pending_providers_approval'
  ).length;

  const pendingProviderTimeCount = invoices.filter(inv => 
    inv.status === 'pending_providers_time'
  ).length;

  const draftInvoices = invoices.filter(inv => 
    inv.status === 'draft'
  ).length;

  const overdueInvoices = invoices.filter(inv => {
    if (!inv.sent_to_vendor_at) return false;
    const daysSinceSent = differenceInDays(today, parseISO(inv.sent_to_vendor_at)); // today is already startOfDay from previous edit
    return daysSinceSent > 30 && inv.status !== 'paid_to_entic' && inv.status !== 'provider_paid';
  }).length;

  const uconnPendingVendorInvoices = invoices.filter(inv => 
    inv.program_group === 'UConn' && inv.status === 'approved'
  ).length;

  const approvedInvoicesCount = invoices.filter(inv => 
    inv.status === 'approved'
  ).length;

  // CME compliance for doctors
  const doctors = providers.filter(p => p.role === 'ENT MD' && p.status === 'active');
  const cmeByProvider = {};
  cmeRecords.forEach(record => {
    if (!cmeByProvider[record.provider_id]) {
      cmeByProvider[record.provider_id] = 0;
    }
    cmeByProvider[record.provider_id] += record.credits || 0;
  });

  const currentYear = new Date().getFullYear();
  const doctorsCompliant = doctors.filter(doc => {
    const hasCredits = (cmeByProvider[doc.id] || 0) >= 3;
    const isWaived = cmeWaivers.some(w => w.provider_id === doc.id && w.year === currentYear);
    return hasCredits || isWaived;
  }).length;

  const doctorsNonCompliant = doctors.filter(doc => {
    const credits = cmeByProvider[doc.id] || 0;
    const isWaived = cmeWaivers.some(w => w.provider_id === doc.id && w.year === currentYear);
    return credits < 3 && !isWaived;
  });

  const openFinancialDetail = (type, programGroup = null) => {
    let filteredInvoices = [];
    let title = '';

    if (type === 'paidToENTIC') {
      filteredInvoices = processedFinancialItems.filter(inv => 
        inv.amount_received > 0
      );
      if (programGroup) {
        filteredInvoices = filteredInvoices.filter(inv => inv.program_group === programGroup);
        title = `Paid to ENTIC - ${programGroup}`;
      } else {
        title = 'Total Paid to ENTIC';
      }
    } else if (type === 'owedToProviders') {
      filteredInvoices = processedFinancialItems.filter(inv => 
        (inv.amount_received > 0) && !inv.provider_paid
      );
      if (programGroup) {
        filteredInvoices = filteredInvoices.filter(inv => inv.program_group === programGroup);
        title = `Owed to Providers - ${programGroup}`;
      } else {
        title = 'Total Owed to Providers';
      }
    } else if (type === 'outstanding') {
      filteredInvoices = processedFinancialItems.filter(inv => 
        inv.status !== 'paid_to_entic' && inv.status !== 'provider_paid' && (inv.amount_expected > (inv.amount_received || 0))
      );
      if (programGroup) {
        filteredInvoices = filteredInvoices.filter(inv => inv.program_group === programGroup);
        title = `Outstanding to ENTIC - ${programGroup}`;
      } else {
        title = 'Total Outstanding to ENTIC';
      }
    }

    // Sort by date descending (newest first)
    filteredInvoices.sort((a, b) => {
      const dateA = a.invoice_date ? new Date(a.invoice_date) : new Date(0);
      const dateB = b.invoice_date ? new Date(b.invoice_date) : new Date(0);
      return dateB - dateA;
    });

    setModalState({
      isOpen: true,
      title,
      invoices: filteredInvoices,
      type,
      programGroup
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      title: '',
      invoices: [],
      type: '',
      programGroup: null
    });
  };

  const exportToCSV = (data, filename) => {
    const csvContent = data.map(row => 
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
    link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportFinancialOverview = () => {
    const rows = [
      ['Financial Overview Summary', '', '', ''],
      ['Category', 'Amount', '', ''],
      ['Outstanding to ENTIC', formatCurrency(outstandingToENTIC), '', ''],
      ['Total Paid to ENTIC', formatCurrency(totalPaidToENTIC), '', ''],
      ['Owed to Providers', formatCurrency(totalOwedToProviders), '', ''],
      ['Unallocated Payments', formatCurrency(unallocatedPayments), '', ''],
      ['', '', '', ''],
      ['Program/Location', 'Outstanding to ENTIC', 'Paid to ENTIC', 'Owed to Providers']
    ];
    
    programsSorted.forEach(program => {
      const data = financialsByProgram[program];
      rows.push([
        program,
        formatCurrency(data.outstanding),
        formatCurrency(data.paidToENTIC),
        formatCurrency(data.owedToProviders)
      ]);
    });
    
    rows.push([
      'Total',
      formatCurrency(outstandingToENTIC),
      formatCurrency(totalPaidToENTIC),
      formatCurrency(totalOwedToProviders)
    ]);
    
    exportToCSV(rows, 'financial_overview');
  };

  const exportLicenseExpirations = () => {
    const rows = [
      ['Provider Name', 'License Type', 'Internal Number', 'Expiration Date', 'Days Until Expiration', 'Status']
    ];
    
    licensesExpiring60Days.forEach(license => {
      const provider = providers.find(p => p.id === license.provider_id);
      const daysUntil = differenceInDays(parseISO(license.expiration_date), today);
      rows.push([
        provider?.full_name || '',
        license.license_type,
        license.internal_license_number,
        format(parseISO(license.expiration_date), 'yyyy-MM-dd'),
        daysUntil,
        daysUntil <= 7 ? 'Critical (7 days)' : 
        daysUntil <= 14 ? 'High Priority (14 days)' : 
        daysUntil <= 30 ? 'Medium Priority (30 days)' : 
        'Low Priority (60 days)'
      ]);
    });
    
    exportToCSV(rows, 'license_expirations');
  };

  const exportCMECompliance = () => {
    const rows = [
      ['Provider Name', 'Total CME Credits', 'Compliance Status']
    ];
    
    doctors.forEach(doctor => {
      const credits = cmeByProvider[doctor.id] || 0;
      rows.push([
        doctor.full_name,
        credits,
        credits >= 3 ? 'Compliant' : 'Non-Compliant'
      ]);
    });
    
    exportToCSV(rows, 'cme_compliance');
  };

  const exportInvoiceSummary = () => {
    const rows = [
      ['Invoice Summary', '', ''],
      ['Category', 'Count', ''],
      ['Sent for Approval Invoices', sentForApprovalInvoices, ''],
      ['Draft Invoices', draftInvoices, ''],
      ['Overdue Invoices (30+ days)', overdueInvoices, ''],
      ['Paid Invoices', invoices.filter(inv => inv.status === 'paid_to_entic' || inv.status === 'provider_paid').length, ''],
      ['', '', ''],
      ['Invoice Number', 'Program Group', 'Provider', 'Date', 'Status', 'Total', 'Amount Received']
    ];
    
    // Filter invoices for export based on the current UI filter
    const invoicesToExport = invoiceLocationFilter === 'all' 
      ? invoices
      : invoices.filter(inv => inv.program_group === invoiceLocationFilter);

    invoicesToExport.forEach(inv => {
      const provider = providers.find(p => p.id === inv.staff_member_id);
      rows.push([
        inv.invoice_number || '',
        inv.program_group || '',
        provider?.full_name || '',
        inv.invoice_date ? format(parseISO(inv.invoice_date), 'yyyy-MM-dd') : '',
        inv.status,
        inv.total || 0,
        inv.amount_received || 0
      ]);
    });
    
    exportToCSV(rows, 'invoice_summary');
  };

  // Get unique program groups from invoices for the filter
  const availableLocations = ['all', ...new Set(invoices.map(inv => inv.program_group).filter(Boolean))].sort((a, b) => {
    if (a === 'all') return -1; // 'all' always first
    if (b === 'all') return 1;
    return a.localeCompare(b);
  });

  const isLoading = providersLoading || licensesLoading || privilegesLoading || 
                    invoicesLoading || cmeLoading || paymentsLoading || supplyOrdersLoading || vendorInvoicesLoading || rejectedVendorInvoicesLoading;

  if (hasErrors) {
    return (
      <div className="p-6 md:p-8 bg-slate-50 min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <AlertCircle className="w-12 h-12 text-orange-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Unable to Load Dashboard</h3>
            <p className="text-slate-600 mb-6">There was an issue loading your dashboard data. This might be a temporary connectivity problem.</p>
            <div className="space-y-2">
              <Button 
                onClick={() => window.location.reload()} 
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Try Again
              </Button>
              <Button 
                onClick={() => window.location.href = createPageUrl("Providers")}
                variant="outline"
                className="w-full"
              >
                Go to Providers Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  // Determine widget order and visibility
  let widgetsToRender = DEFAULT_WIDGETS;
  if (dashboardConfig) {
    try {
      const config = JSON.parse(dashboardConfig);
      // Merge with defaults to handle potential new widgets
      const merged = config.map(w => ({
        ...DEFAULT_WIDGETS.find(dw => dw.id === w.id) || w,
        ...w
      }));
      const missing = DEFAULT_WIDGETS.filter(dw => !config.find(w => w.id === dw.id));
      widgetsToRender = [...merged, ...missing];
    } catch (e) {
      console.error("Failed to parse user dashboard config", e);
    }
  }

  const renderWidget = (widgetId) => {
    switch (widgetId) {
      case 'alerts':
        return (
          <AlertsWidget
            approvedInvoicesCount={approvedInvoicesCount}
            uconnPendingVendorInvoices={uconnPendingVendorInvoices}
            sentForApprovalInvoices={sentForApprovalInvoices}
            sentToCOOInvoices={sentToCOOInvoices}
            sentToProviderForApprovalCount={sentToProviderForApprovalCount}
            sentToProviderForReviewCount={sentToProviderForReviewCount}
            pendingProviderApprovalCount={pendingProviderApprovalCount}
            pendingProviderTimeCount={pendingProviderTimeCount}
            privilegesExpiring30Days={privilegesExpiring30Days}
            partiallyReceivedCount={partiallyReceivedOrders.length}
            updatedOrdersCount={updatedOrders.length}
          />
        );
      case 'summary_cards':
        return (
          <SummaryCardsWidget
            supplyOrders={supplyOrders}
            draftInvoices={draftInvoices}
            licensesExpiring14Days={licensesExpiring14Days}
            pendingVendorInvoices={pendingVendorInvoices}
            rejectedVendorInvoices={rejectedVendorInvoices}
          />
        );
      case 'pending_invoices':
        return (
          <PendingInvoicesWidget
            providersWithPendingInvoices={providersWithPendingInvoices}
          />
        );
      case 'missing_invoices':
            return (
              <MissingInvoicesWidget
                providersMissingPriorInvoice={providersMissingPriorInvoice}
                previousMonthStr={previousMonthStr}
                createWaiverMutation={createWaiverMutation}
                deleteWaiverMutation={deleteWaiverMutation}
              />
            );
      case 'license_expirations':
        return (
          <LicenseExpirationsWidget
            licensesExpiring7Days={licensesExpiring7Days}
            licensesExpiring14Days={licensesExpiring14Days}
            licensesExpiring30Days={licensesExpiring30Days}
            licensesExpiring60Days={licensesExpiring60Days}
            providers={providers}
            exportLicenseExpirations={exportLicenseExpirations}
          />
        );
      case 'invoice_summary':
        return (
          <InvoiceSummaryWidget
            invoices={invoices}
            providers={providers}
            invoiceLocationFilter={invoiceLocationFilter}
            setInvoiceLocationFilter={setInvoiceLocationFilter}
            availableLocations={availableLocations}
            exportInvoiceSummary={exportInvoiceSummary}
          />
        );
      case 'financial_overview':
        return (
          <FinancialOverviewWidget
            outstandingToENTIC={outstandingToENTIC}
            totalPaidToENTIC={totalPaidToENTIC}
            totalOwedToProviders={totalOwedToProviders}
            unallocatedPayments={unallocatedPayments}
            formatCurrency={formatCurrency}
            exportFinancialOverview={exportFinancialOverview}
            openFinancialDetail={openFinancialDetail}
          />
        );
      case 'financial_by_program':
        return (
          <FinancialByProgramWidget
            programsSorted={programsSorted}
            financialsByProgram={financialsByProgram}
            outstandingToENTIC={outstandingToENTIC}
            totalPaidToENTIC={totalPaidToENTIC}
            totalOwedToProviders={totalOwedToProviders}
            formatCurrency={formatCurrency}
            openFinancialDetail={openFinancialDetail}
          />
        );
      case 'cme_compliance':
        return (
          <CMEComplianceWidget
            doctors={doctors}
            cmeByProvider={cmeByProvider}
            doctorsCompliant={doctorsCompliant}
            doctorsNonCompliant={doctorsNonCompliant}
            exportCMECompliance={exportCMECompliance}
            createCMEWaiverMutation={createCMEWaiverMutation}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <style>{`
        @keyframes slow-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .animate-slow-pulse {
          animation: slow-pulse 3.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes alert-glow {
          0%, 100% { 
            box-shadow: 0 0 20px rgba(220, 38, 38, 0.4), 0 0 40px rgba(220, 38, 38, 0.2);
          }
          50% { 
            box-shadow: 0 0 30px rgba(220, 38, 38, 0.6), 0 0 60px rgba(220, 38, 38, 0.3);
          }
        }
        @keyframes yellow-glow {
          0%, 100% { 
            box-shadow: 0 0 20px rgba(202, 138, 4, 0.4), 0 0 40px rgba(202, 138, 4, 0.2);
          }
          50% { 
            box-shadow: 0 0 30px rgba(202, 138, 4, 0.6), 0 0 60px rgba(202, 138, 4, 0.3);
          }
        }
        @keyframes alert-scale {
          0%, 100% { 
            transform: scale(1);
          }
          50% { 
            transform: scale(1.03);
          }
        }
        .animate-alert-glow {
          animation: alert-glow 3.2s ease-in-out infinite, alert-scale 3.2s ease-in-out infinite;
        }
        .animate-yellow-glow {
          animation: yellow-glow 3.2s ease-in-out infinite, alert-scale 3.2s ease-in-out infinite;
        }
      `}</style>
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
            <p className="text-slate-600 mt-1">Overview of your medical practice</p>
          </div>
          <DashboardCustomizer 
            currentConfig={dashboardConfig}
            onConfigChange={handleConfigChange}
          />
        </div>

        {syncMessage && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <p className="text-sm text-blue-900">{syncMessage}</p>
            </CardContent>
          </Card>
        )}

        {widgetsToRender.map(widget => (
          widget.visible && (
            <div key={widget.id}>
              {renderWidget(widget.id)}
            </div>
          )
        ))}
      </div>

      <FinancialDetailModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        title={modalState.title}
        invoices={modalState.invoices}
        providers={providers}
        payments={payments}
        type={modalState.type}
        programGroup={modalState.programGroup}
      />
    </div>
  );
}