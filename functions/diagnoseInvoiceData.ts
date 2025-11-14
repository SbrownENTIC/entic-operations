import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        // Fetch all data
        const invoices = await base44.asServiceRole.entities.Invoice.list();
        const incomes = await base44.asServiceRole.entities.OutsideIncome.list();
        
        const issues = [];
        
        // Check 1: Invoices with missing or broken links
        for (const invoice of invoices) {
            const invoiceIncomeIds = invoice.outside_income_ids || [];
            
            // Check if all income IDs in invoice actually exist and point back
            for (const incomeId of invoiceIncomeIds) {
                const income = incomes.find(inc => inc.id === incomeId);
                if (!income) {
                    issues.push({
                        type: 'MISSING_INCOME',
                        severity: 'HIGH',
                        invoice_id: invoice.id,
                        invoice_number: invoice.invoice_number,
                        issue: `Invoice references income ${incomeId} that doesn't exist`
                    });
                } else if (income.invoice_id !== invoice.id) {
                    issues.push({
                        type: 'BROKEN_BACKLINK',
                        severity: 'HIGH',
                        invoice_id: invoice.id,
                        invoice_number: invoice.invoice_number,
                        income_id: income.id,
                        issue: `Income ${incomeId} is in invoice's array but income.invoice_id=${income.invoice_id}`
                    });
                }
            }
            
            // Check if invoice totals match linked incomes
            const linkedIncomes = incomes.filter(inc => invoiceIncomeIds.includes(inc.id));
            const calculatedTotal = linkedIncomes.reduce((sum, inc) => sum + (inc.total_amount || 0), 0);
            const calculatedDays = linkedIncomes.reduce((sum, inc) => sum + (inc.days_worked || 0), 0);
            
            if (Math.abs(calculatedTotal - (invoice.total || 0)) > 0.01) {
                issues.push({
                    type: 'TOTAL_MISMATCH',
                    severity: 'MEDIUM',
                    invoice_id: invoice.id,
                    invoice_number: invoice.invoice_number,
                    invoice_total: invoice.total,
                    calculated_total: calculatedTotal,
                    difference: calculatedTotal - (invoice.total || 0),
                    issue: `Invoice total $${invoice.total} doesn't match linked incomes $${calculatedTotal}`
                });
            }
            
            if (calculatedDays !== invoice.days_worked) {
                issues.push({
                    type: 'DAYS_MISMATCH',
                    severity: 'LOW',
                    invoice_id: invoice.id,
                    invoice_number: invoice.invoice_number,
                    invoice_days: invoice.days_worked,
                    calculated_days: calculatedDays,
                    issue: `Invoice days ${invoice.days_worked} doesn't match linked incomes ${calculatedDays}`
                });
            }
        }
        
        // Check 2: Orphaned income records (have invoice_id but invoice doesn't reference them)
        for (const income of incomes) {
            if (income.invoice_id) {
                const invoice = invoices.find(inv => inv.id === income.invoice_id);
                if (!invoice) {
                    issues.push({
                        type: 'ORPHANED_INCOME',
                        severity: 'HIGH',
                        income_id: income.id,
                        facility: income.facility_name,
                        amount: income.total_amount,
                        issue: `Income references invoice ${income.invoice_id} that doesn't exist`
                    });
                } else if (!invoice.outside_income_ids?.includes(income.id)) {
                    issues.push({
                        type: 'ONE_WAY_LINK',
                        severity: 'HIGH',
                        income_id: income.id,
                        invoice_id: invoice.id,
                        invoice_number: invoice.invoice_number,
                        facility: income.facility_name,
                        amount: income.total_amount,
                        issue: `Income.invoice_id points to invoice but invoice doesn't include this income in its array`
                    });
                }
            }
        }
        
        // Check 3: Income records with zero or missing totals
        const zeroTotals = incomes.filter(inc => !inc.total_amount || inc.total_amount === 0);
        if (zeroTotals.length > 0) {
            issues.push({
                type: 'ZERO_TOTALS',
                severity: 'MEDIUM',
                count: zeroTotals.length,
                income_ids: zeroTotals.map(inc => inc.id),
                issue: `${zeroTotals.length} income records have zero or missing total_amount`
            });
        }
        
        // Summary statistics
        const summary = {
            total_invoices: invoices.length,
            total_incomes: incomes.length,
            linked_incomes: incomes.filter(inc => inc.invoice_id).length,
            unlinked_incomes: incomes.filter(inc => !inc.invoice_id).length,
            total_issues: issues.length,
            high_severity: issues.filter(i => i.severity === 'HIGH').length,
            medium_severity: issues.filter(i => i.severity === 'MEDIUM').length,
            low_severity: issues.filter(i => i.severity === 'LOW').length
        };
        
        return Response.json({ 
            success: true,
            summary,
            issues: issues.sort((a, b) => {
                const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
                return severityOrder[a.severity] - severityOrder[b.severity];
            })
        });
        
    } catch (error) {
        console.error('Diagnose function error:', error);
        return Response.json({ 
            success: false, 
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});