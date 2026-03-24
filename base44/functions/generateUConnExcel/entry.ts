import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import ExcelJS from 'npm:exceljs@4.4.0';
import { format, parseISO } from 'npm:date-fns@2.30.0';

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
    }).format(amount);
};

const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
        return format(parseISO(dateStr), 'MM-dd-yyyy');
    } catch (e) {
        return dateStr;
    }
};

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        
        // 1. Parse request
        const { invoice_id, save_to_record } = await req.json();
        if (!invoice_id) {
            return Response.json({ error: "invoice_id is required" }, { status: 400 });
        }

        // 2. Fetch Data
        const invoice = await base44.entities.Invoice.get(invoice_id);
        if (!invoice) {
            return Response.json({ error: "Invoice not found" }, { status: 404 });
        }

        // Get linked income records to build line items
        let lineItems = [];
        let grandTotal = 0;

        if (invoice.outside_income_ids && invoice.outside_income_ids.length > 0) {
            const allIncomes = await base44.entities.OutsideIncome.list();
            const linkedIncomes = allIncomes.filter(inc => invoice.outside_income_ids.includes(inc.id));
            const providers = await base44.entities.Provider.list();

            // Sort incomes by date
            linkedIncomes.sort((a, b) => {
                const dateA = a.work_dates?.[0] || '';
                const dateB = b.work_dates?.[0] || '';
                return dateA.localeCompare(dateB);
            });

            for (const income of linkedIncomes) {
                const provider = providers.find(p => p.id === income.provider_id);
                const providerName = provider ? provider.full_name : "Unknown Provider";
                const rate = income.rate || 1340;
                
                if (income.work_dates && income.work_dates.length > 0) {
                    for (const date of income.work_dates) {
                        const quantity = 1;
                        const lineTotal = rate * quantity;
                        grandTotal += lineTotal;

                        lineItems.push({
                            description: `${providerName} ${formatDate(date)}`,
                            quantity: quantity,
                            unitPrice: rate,
                            lineTotal: lineTotal
                        });
                    }
                }
            }
        }

        // 3. Create Excel Workbook
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Invoice');

        // Set column widths
        worksheet.columns = [
            { header: '', key: 'A', width: 20 },
            { header: '', key: 'B', width: 30 },
            { header: '', key: 'C', width: 15 },
            { header: '', key: 'D', width: 15 }
        ];

        // Title
        worksheet.mergeCells('A1:D2');
        const titleCell = worksheet.getCell('A1');
        titleCell.value = 'INVOICE';
        titleCell.font = { name: 'Arial', size: 24, color: { argb: 'FF808080' } }; // Gray color
        titleCell.alignment = { horizontal: 'right', vertical: 'middle' };

        // Company Info (Left)
        worksheet.getCell('A4').value = 'Ear, Nose & Throat Institute of CT';
        worksheet.getCell('A4').font = { bold: true, size: 11 };
        worksheet.getCell('A5').value = '599 Farmington Ave, Suite 201';
        worksheet.getCell('A6').value = 'Farmington, CT 06032';
        worksheet.getCell('A7').value = 'T: 860-284-4950 F: 860-284-4951';
        worksheet.getCell('A8').value = 'E: HConnolly@enticmd.com';

        // Invoice Details (Right)
        worksheet.getCell('C5').value = 'INVOICE NO.';
        worksheet.getCell('D5').value = invoice.invoice_number || '';
        worksheet.getCell('D5').alignment = { horizontal: 'right' };
        
        worksheet.getCell('C6').value = 'DATE';
        worksheet.getCell('D6').value = formatDate(invoice.invoice_date);
        worksheet.getCell('D6').alignment = { horizontal: 'right' };
        
        worksheet.getCell('C7').value = 'CUSTOMER ID';
        worksheet.getCell('D7').value = 'UCHCFC 182310658';
        worksheet.getCell('D7').alignment = { horizontal: 'right' };

        // TO Section
        worksheet.getCell('A10').value = 'TO';
        worksheet.getCell('A10').font = { bold: true };
        worksheet.getCell('A11').value = 'Allyson Moffo';
        worksheet.getCell('A12').value = 'Uconn Health';
        worksheet.getCell('A13').value = '263 Farmington Ave';
        worksheet.getCell('A14').value = 'Farmington, CT 06030-5338';
        worksheet.getCell('A15').value = 'e: amoffo@uchc.edu';

        // Table Header
        const headerRowIndex = 17;
        worksheet.getRow(headerRowIndex).values = ['QUANTITY', 'DESCRIPTION', 'UNIT PRICE', 'LINE TOTAL'];
        
        const headerRow = worksheet.getRow(headerRowIndex);
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }; // White text
        headerRow.eachCell((cell) => {
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF808080' } // Gray background
            };
            cell.alignment = { horizontal: 'center' };
        });
        // Adjust alignment for specific columns if needed
        worksheet.getCell(`B${headerRowIndex}`).alignment = { horizontal: 'left' };

        // Data Rows
        let currentRowIndex = 18;
        lineItems.forEach((item, index) => {
            const row = worksheet.getRow(currentRowIndex);
            row.values = [
                item.quantity,
                item.description,
                item.unitPrice,
                item.lineTotal
            ];

            // Formatting
            row.getCell(3).numFmt = '$#,##0.00'; // Unit Price
            row.getCell(4).numFmt = '$#,##0.00'; // Line Total
            
            // Alternating row colors (optional, but good for readability)
            if (index % 2 === 0) {
                row.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFF2F2F2' } // Light gray
                    };
                });
            }

            // Borders
            row.eachCell((cell) => {
                cell.border = {
                    bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } }
                };
            });

            currentRowIndex++;
        });

        // Add some empty rows to fill up space if needed (mimicking the PDF which had 20 rows)
        // Or just leave it dynamic. Excel handles dynamic well. Let's add a few empty rows for style if line items are few.
        const minRows = 10;
        const rowsToAdd = Math.max(0, minRows - lineItems.length);
        for (let i = 0; i < rowsToAdd; i++) {
            const row = worksheet.getRow(currentRowIndex);
            row.values = ['', '', '', ''];
            // Add border/styling
             if ((lineItems.length + i) % 2 === 0) {
                row.eachCell({ includeEmpty: true }, (cell) => {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
                });
            }
             row.eachCell({ includeEmpty: true }, (cell) => {
                cell.border = { bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } } };
            });
            currentRowIndex++;
        }

        // Totals Section
        currentRowIndex += 1;
        
        // Subtotal
        worksheet.getCell(`C${currentRowIndex}`).value = 'SUBTOTAL';
        worksheet.getCell(`C${currentRowIndex}`).font = { bold: true, color: { argb: 'FF808080' } };
        worksheet.getCell(`C${currentRowIndex}`).alignment = { horizontal: 'right' };
        
        worksheet.getCell(`D${currentRowIndex}`).value = grandTotal;
        worksheet.getCell(`D${currentRowIndex}`).numFmt = '$#,##0.00';
        worksheet.getCell(`D${currentRowIndex}`).font = { bold: true };
        
        currentRowIndex++;

        // Sales Tax
        worksheet.getCell(`C${currentRowIndex}`).value = 'SALES TAX';
        worksheet.getCell(`C${currentRowIndex}`).font = { bold: true, color: { argb: 'FF808080' } };
        worksheet.getCell(`C${currentRowIndex}`).alignment = { horizontal: 'right' };
        
        worksheet.getCell(`D${currentRowIndex}`).value = 0; // Assuming 0 tax as per previous logic
        worksheet.getCell(`D${currentRowIndex}`).numFmt = '$#,##0.00';
        worksheet.getCell(`D${currentRowIndex}`).font = { bold: true };

        currentRowIndex++;

        // Total
        worksheet.getCell(`C${currentRowIndex}`).value = 'TOTAL';
        worksheet.getCell(`C${currentRowIndex}`).font = { bold: true, color: { argb: 'FF808080' } };
        worksheet.getCell(`C${currentRowIndex}`).alignment = { horizontal: 'right' };
        
        worksheet.getCell(`D${currentRowIndex}`).value = grandTotal;
        worksheet.getCell(`D${currentRowIndex}`).numFmt = '$#,##0.00';
        worksheet.getCell(`D${currentRowIndex}`).font = { bold: true };
        worksheet.getCell(`D${currentRowIndex}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6E6E6' } };

        // Footer Message
        worksheet.mergeCells(`A${currentRowIndex + 2}:D${currentRowIndex + 2}`);
        const footerCell = worksheet.getCell(`A${currentRowIndex + 2}`);
        footerCell.value = 'Make all checks payable to: Ear, Nose & Throat Institute of CT\nTHANK YOU FOR YOUR BUSINESS!';
        footerCell.alignment = { horizontal: 'center', wrapText: true };
        footerCell.font = { italic: true };


        // Fetch provider for filename
        let filenameProvider = 'Provider';
        if (invoice.staff_member_id) {
            try {
                const provider = await base44.entities.Provider.get(invoice.staff_member_id);
                if (provider) filenameProvider = provider.full_name;
            } catch (e) {
                // ignore error
            }
        }
        
        // Sanitize filename
        filenameProvider = filenameProvider.replace(/[^a-zA-Z0-9 ]/g, "");
        const filename = `${filenameProvider}- UConn- ${invoice.month || 'Draft'}.xlsx`;

        // Generate Buffer
        const buffer = await workbook.xlsx.writeBuffer();

        // Check if we should save to record
        if (save_to_record) {
             const file = new File([buffer], filename, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
             
             // Upload file
             const { file_url } = await base44.integrations.Core.UploadFile({ file });
             
             // Update invoice record
             await base44.entities.Invoice.update(invoice.id, {
                 draft_invoice_url: file_url,
                 approved_invoice_url: file_url,
                 status: 'approved',
                 invoice_sent_to_vendor: false
             });
             
             return Response.json({ 
                 success: true, 
                 url: file_url,
                 filename: filename
             });
        }

        // Return Base64
        // Convert buffer to base64 string
        const base64 = btoa(
            new Uint8Array(buffer)
                .reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        return Response.json({ 
            file_base64: base64,
            filename: filename,
            content_type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});