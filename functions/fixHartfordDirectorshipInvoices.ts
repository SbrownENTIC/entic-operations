import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { format, parseISO } from 'npm:date-fns@3.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all Hartford Hospital invoices (excluding Directorship ones)
    const allInvoices = await base44.asServiceRole.entities.Invoice.list();
    const hhInvoices = allInvoices.filter(inv => 
      inv.program_group === 'Hartford Hospital' && 
      !inv.invoice_number?.includes('Directorship')
    );

    // Fetch all outside income records
    const allIncomes = await base44.asServiceRole.entities.OutsideIncome.list();

    let created = 0;
    let linked = 0;
    let skipped = 0;

    for (const hhInvoice of hhInvoices) {
      // Check if directorship invoice already exists
      const existingDirectorshipInvoice = allInvoices.find(inv => 
        inv.invoice_number === `${hhInvoice.invoice_number} (Directorship)`
      );

      if (existingDirectorshipInvoice) {
        skipped++;
        continue;
      }

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
      const directorshipInvoice = await base44.asServiceRole.entities.Invoice.create({
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
        notes: 'Auto-generated Directorship invoice (retroactive)'
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
    }

    return Response.json({
      success: true,
      message: `Fixed Hartford Hospital invoices: ${created} created, ${linked} linked, ${skipped} skipped`,
      details: {
        created,
        linked,
        skipped
      }
    });

  } catch (error) {
    return Response.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
});