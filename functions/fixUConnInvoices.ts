import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // Get all UConn invoices
        const invoices = await base44.entities.Invoice.filter({
            program_group: { $regex: 'UConn', $options: 'i' }
        });
        
        // Filter for 72, 73, 74
        const targetNumbers = ['72', '73', '74'];
        const targets = invoices.filter(inv => targetNumbers.includes(inv.invoice_number));
        
        if (targets.length === 0) {
            return Response.json({ message: "No matching invoices found (72, 73, 74)" });
        }
        
        const results = [];
        
        for (const inv of targets) {
            try {
                // Call generateUConnExcel with save_to_record: true
                // This generates the Excel file, uploads it, and updates the invoice record
                const res = await base44.functions.invoke('generateUConnExcel', {
                    invoice_id: inv.id,
                    save_to_record: true
                });
                
                results.push({ 
                    invoice: inv.invoice_number, 
                    success: true, 
                    url: res.data?.url 
                });
            } catch (err) {
                 results.push({ 
                    invoice: inv.invoice_number, 
                    success: false, 
                    error: err.message 
                });
            }
        }

        return Response.json({ results });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});