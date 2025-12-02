import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { format, parseISO } from 'npm:date-fns@3.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all data
    const allInvoices = await base44.asServiceRole.entities.Invoice.list();
    const allIncomes = await base44.asServiceRole.entities.OutsideIncome.list();
    const allPayments = await base44.asServiceRole.entities.Payment.list();

    // ==========================================
    // 1. SYNC MONTHS Logic (Work Month = Invoice Month)
    // ==========================================
    let invoicesSynced = 0;
    let incomesSynced = 0;

    // 1a. Update Invoices missing month
    for (const invoice of allInvoices) {
      // If month is missing, try to fill it from linked incomes
      if (!invoice.month && invoice.outside_income_ids && invoice.outside_income_ids.length > 0) {
        const linkedIncomes = allIncomes.filter(inc => invoice.outside_income_ids.includes(inc.id));
        
        const allDates = linkedIncomes.reduce((acc, inc) => {
          return inc.work_dates ? [...acc, ...inc.work_dates] : acc;
        }, []).sort();

        if (allDates.length > 0) {
          try {
            const date = parseISO(allDates[0]);
            const fullMonth = format(date, 'MMMM yyyy');
            
            // Update Invoice
            await base44.asServiceRole.entities.Invoice.update(invoice.id, { month: fullMonth });
            invoicesSynced++;
            
            // Update linked OutsideIncomes
            for (const income of linkedIncomes) {
                if (income.invoice_month !== fullMonth) {
                    await base44.asServiceRole.entities.OutsideIncome.update(income.id, { invoice_month: fullMonth });
                    incomesSynced++;
                }
            }
          } catch (e) {
            console.error(`Error updating invoice ${invoice.invoice_number}:`, e);
          }
        }
      }
    }

    // 1b. Update OutsideIncome records so invoice_month equals Work Month (derived from work_dates)
    for (const income of allIncomes) {
        if (income.work_dates && income.work_dates.length > 0) {
            try {
                // Get unique months from work dates
                const uniqueMonths = new Set();
                income.work_dates.forEach(dateStr => {
                    const date = parseISO(dateStr);
                    uniqueMonths.add(format(date, 'MMMM yyyy'));
                });
                
                // If only one month is present in work_dates, enforce it as invoice_month
                // This applies even if not linked to an invoice yet, as per "Work Month Should equal invoice month"
                if (uniqueMonths.size === 1) {
                    const derivedMonth = Array.from(uniqueMonths)[0];
                    if (income.invoice_month !== derivedMonth) {
                        await base44.asServiceRole.entities.OutsideIncome.update(income.id, { invoice_month: derivedMonth });
                        incomesSynced++;
                    }
                }
            } catch (e) {
                console.error(`Error syncing income ${income.id}:`, e);
            }
        }
    }


    // ==========================================
    // 2. FIX HARTFORD DATA Logic
    // ==========================================
    // Get Hartford Hospital RVU/On-Call invoices (excluding Directorship)
    const hhInvoices = allInvoices.filter(inv => 
      inv.program_group === 'Hartford Hospital' && 
      !inv.invoice_number?.includes('Directorship')
    );

    let created = 0;
    let linked = 0;
    let skipped = 0;
    let paymentsReallocated = 0;

    for (const hhInvoice of hhInvoices) {
      // Check if directorship invoice already exists
      let directorshipInvoice = allInvoices.find(inv => 
        inv.invoice_number === `${hhInvoice.invoice_number} (Directorship)`
      );

      if (!directorshipInvoice) {
        // Find matching directorship outside income
        const directorshipIncome = allIncomes.find(inc => {
          const facilityMatch = inc.facility_name?.toLowerCase().includes('directorship');
          const providerMatch = inc.provider_id === hhInvoice.staff_member_id;
          
          let monthMatch = false;
          if (inc.work_dates && inc.work_dates.length > 0 && hhInvoice.month) {
            try {
              const incomeDate = parseISO(inc.work_dates[0]);
              const incomeMonthYear = format(incomeDate, 'MMMM yyyy');
              monthMatch = incomeMonthYear === hhInvoice.month;
            } catch (e) {
              monthMatch = false;
            }
          }
          
          return facilityMatch && providerMatch && monthMatch;
        });

        // Create directorship invoice
        directorshipInvoice = await base44.asServiceRole.entities.Invoice.create({
          invoice_number: `${hhInvoice.invoice_number} (Directorship)`,
          program_group: 'Hartford Hospital',
          staff_member_id: hhInvoice.staff_member_id,
          work_email: hhInvoice.work_email,
          invoice_date: hhInvoice.invoice_date,
          month: hhInvoice.month,
          status: hhInvoice.status || 'not_started',
          subtotal: 3250,
          total: 3250,
          amount_expected: 3250,
          outside_income_ids: directorshipIncome ? [directorshipIncome.id] : [],
          days_worked: 0,
          amount_received: 0,
          auto_generated: true
        });

        created++;

        // Link the directorship income if found
        if (directorshipIncome && !directorshipIncome.invoice_id) {
          await base44.asServiceRole.entities.OutsideIncome.update(directorshipIncome.id, {
            invoice_id: directorshipInvoice.id,
            invoice_month: hhInvoice.month || '',
            status: 'invoiced'
          });
          linked++;
        }
      } else {
        skipped++;
      }

      // Now handle payment reallocation
      // Find all payments that have allocations to this RVU/On-Call invoice
      const paymentsWithAllocations = allPayments.filter(payment => 
        payment.allocations?.some(alloc => alloc.invoice_id === hhInvoice.id)
      );

      for (const payment of paymentsWithAllocations) {
        const allocation = payment.allocations.find(alloc => alloc.invoice_id === hhInvoice.id);
        
        // Check if there's already an allocation to the directorship invoice
        const hasDirectorshipAllocation = payment.allocations.some(alloc => 
          alloc.invoice_id === directorshipInvoice.id
        );

        if (hasDirectorshipAllocation || !allocation || allocation.amount < 3250) {
          continue; // Skip if already reallocated or amount is too small
        }

        // Update the payment allocations
        const updatedAllocations = payment.allocations.map(alloc => {
          if (alloc.invoice_id === hhInvoice.id) {
            return {
              ...alloc,
              amount: alloc.amount - 3250
            };
          }
          return alloc;
        });

        // Add new allocation for directorship invoice
        updatedAllocations.push({
          invoice_id: directorshipInvoice.id,
          provider_id: hhInvoice.staff_member_id,
          amount: 3250,
          notes: 'Reallocated from RVU/On-Call invoice'
        });

        // Update the payment
        await base44.asServiceRole.entities.Payment.update(payment.id, {
          allocations: updatedAllocations
        });

        // Update amount_received on both invoices
        await base44.asServiceRole.entities.Invoice.update(hhInvoice.id, {
          amount_received: (hhInvoice.amount_received || 0) - 3250
        });

        await base44.asServiceRole.entities.Invoice.update(directorshipInvoice.id, {
          amount_received: (directorshipInvoice.amount_received || 0) + 3250
        });

        paymentsReallocated++;
      }
    }

    return Response.json({
      success: true,
      message: `Data Sync & Fix Completed: ${invoicesSynced} invoices synced, ${incomesSynced} incomes synced. Hartford fix: ${created} created, ${linked} linked, ${paymentsReallocated} payments reallocated.`,
      details: {
        invoicesSynced,
        incomesSynced,
        created,
        linked,
        skipped,
        paymentsReallocated
      }
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});