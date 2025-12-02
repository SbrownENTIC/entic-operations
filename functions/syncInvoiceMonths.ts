import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import { format, parseISO } from 'npm:date-fns@2.30.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const invoices = await base44.entities.Invoice.list();
    const allIncomes = await base44.entities.OutsideIncome.list();
    
    let updatedCount = 0;

    for (const invoice of invoices) {
      // Only process if month is missing
      if (!invoice.month && invoice.outside_income_ids && invoice.outside_income_ids.length > 0) {
        const linkedIncomes = allIncomes.filter(inc => invoice.outside_income_ids.includes(inc.id));
        
        // Collect all dates from linked incomes
        const allDates = linkedIncomes.reduce((acc, inc) => {
          return inc.work_dates ? [...acc, ...inc.work_dates] : acc;
        }, []).sort();

        if (allDates.length > 0) {
          try {
            // Use the month of the first date
            const date = parseISO(allDates[0]);
            const fullMonth = format(date, 'MMMM yyyy');
            
            // Update Invoice
            await base44.entities.Invoice.update(invoice.id, { month: fullMonth });
            
            // Update linked OutsideIncomes
            for (const income of linkedIncomes) {
                if (income.invoice_month !== fullMonth) {
                    await base44.entities.OutsideIncome.update(income.id, { invoice_month: fullMonth });
                }
            }
            
            updatedCount++;
          } catch (e) {
            console.error(`Error updating invoice ${invoice.invoice_number}:`, e);
          }
        }
      }
    }

    return Response.json({ message: `Successfully synced months for ${updatedCount} invoices` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});