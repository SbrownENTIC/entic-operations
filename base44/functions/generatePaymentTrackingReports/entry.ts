import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import ExcelJS from 'npm:exceljs';
import JSZip from 'npm:jszip@3.10.1';

Deno.serve(async (req) => {
    if (req.method !== 'POST') {
        return new Response('Method not allowed', { status: 405 });
    }

    try {
        const base44 = createClientFromRequest(req);
        // We can skip auth check for public pages if needed, but this is an internal report
        const user = await base44.auth.me();
        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json().catch(() => ({}));
        const { sections, exportDate = new Date().toISOString().split('T')[0] } = body;

        if (!sections || !Array.isArray(sections)) {
            return Response.json({ error: "Missing or invalid 'sections' in payload. It must be an array." }, { status: 400 });
        }

        // Map section titles to filenames and sheet names
        // Hartford Hospital - DIRECTORSHIP TRACKING -> Hartford_Hospital, Directorship
        const getFileInfo = (title) => {
            let filename = "Unknown";
            let sheetname = "Tracking";

            if (title.includes("Hartford Hospital")) {
                filename = "Outside_Income_Payment_Tracking_Hartford_Hospital";
                if (title.includes("DIRECTORSHIP")) sheetname = "Directorship";
                else if (title.includes("ON-CALL")) sheetname = "On-Call";
            } else if (title.includes("St. Francis")) {
                filename = "Outside_Income_Payment_Tracking_St_Francis";
                if (title.includes("DIRECTORSHIP")) sheetname = "Directorship";
                else if (title.includes("ON-CALL")) sheetname = "On-Call";
            } else if (title.includes("Manchester")) {
                filename = "Outside_Income_Payment_Tracking_Manchester_ECHN";
            } else if (title.includes("Quinnipiac")) {
                filename = "Outside_Income_Payment_Tracking_Quinnipiac_University";
            } else if (title.includes("UConn")) {
                filename = "Outside_Income_Payment_Tracking_UConn";
            } else if (title.includes("Nations Hearing")) {
                filename = "Outside_Income_Payment_Tracking_Nations_Hearing";
            } else {
                // Fallback for others
                filename = `Outside_Income_Payment_Tracking_${title.split(' - ')[0].replace(/[^a-zA-Z0-9]/g, '_')}`;
            }

            return { filename, sheetname };
        };

        const zip = new JSZip();

        // 1. Generate Master Workbook
        const masterWorkbook = new ExcelJS.Workbook();
        const summarySheet = masterWorkbook.addWorksheet('Summary');

        // Styles
        // Fill colors for highlighted columns
        const PAYMENT_RECEIVED_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9EAD3' } }; // light green
        const PAYMENT_DATE_FILL    = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCE6F1' } }; // light blue

        // Apply fill to all data cells (rows after headerRowNumber) in a named column
        const applyColumnFill = (sheet, headers, headerRowNumber, columnName, fill) => {
            const colIdx = headers.indexOf(columnName) + 1; // 1-based
            if (colIdx < 1) return;
            const lastRow = sheet.lastRow ? sheet.lastRow.number : headerRowNumber;
            for (let r = headerRowNumber + 1; r <= lastRow; r++) {
                const cell = sheet.getRow(r).getCell(colIdx);
                // Preserve existing style properties, only override fill
                const existing = cell.style || {};
                cell.style = { ...existing, fill };
            }
        };

        const titleStyle = {
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F81BD' } }, // Medium blue
            font: { bold: true, color: { argb: 'FFFFFFFF' } } // White
        };
        const headerStyle = {
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F497D' } }, // Darker blue
            font: { bold: true, color: { argb: 'FFFFFFFF' } }
        };
        const borderStyle = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
        };

        // Add export date to Summary
        summarySheet.addRow([`Exported: ${exportDate}`]);

        let allSectionsTotalExpected = 0;
        let allSectionsTotalReceived = 0;

        // Process each section for Master Summary and Detail Sheets
        for (const section of sections) {
            // --- Add to Summary Sheet ---
            summarySheet.addRow([]); // Spacer
            const titleRow = summarySheet.addRow([section.title]);
            // Merge cells for title? User didn't specify, but looks better.
            // Let's just apply style to the first few cells or whole row
            // summarySheet.mergeCells(`A${titleRow.number}:J${titleRow.number}`);
            titleRow.getCell(1).style = titleStyle;
            
            // Headers
            const headerRow = summarySheet.addRow(section.headers);
            headerRow.eachCell((cell) => {
                cell.style = headerStyle;
            });

            // Data
            let sectionExpected = 0;
            let sectionReceived = 0;

            section.rows.forEach(row => {
                const addedRow = summarySheet.addRow(row);
                addedRow.eachCell(cell => cell.border = borderStyle);
                
                // Assuming columns for Expected Payment and Payment Received.
                // We need to identify indices. They vary by section (Nations Hearing vs others).
                // Nations Hearing: Expected (col 4), Received (col 5) (indices 3, 4 zero-based -> 4, 5 one-based)
                // Others: Expected (col 3), Received (col 4) (indices 2, 3 zero-based -> 3, 4 one-based)
                // Wait, headers:
                // Nations: Voucher, Invoice, Month, Expected, Received ...
                // Others: Provider, Invoice, Month, Expected, Received ... (Directorship)
                // Others: Invoice, Month, Expected, Received ... (Normal)
                
                // Let's find index by header name
                const expectedIdx = section.headers.indexOf('Expected Payment') + 1;
                const receivedIdx = section.headers.indexOf('Payment Received') + 1;

                if (expectedIdx > 0) {
                    const cell = addedRow.getCell(expectedIdx);
                    cell.numFmt = '$#,##0.00';
                    sectionExpected += (typeof row[expectedIdx-1] === 'number' ? row[expectedIdx-1] : 0);
                }
                if (receivedIdx > 0) {
                    const cell = addedRow.getCell(receivedIdx);
                    cell.numFmt = '$#,##0.00';
                    sectionReceived += (typeof row[receivedIdx-1] === 'number' ? row[receivedIdx-1] : 0);
                }
            });

            // Section Total Row
            const totalRowData = new Array(section.headers.length).fill('');
            totalRowData[0] = 'TOTAL';
            const totalRow = summarySheet.addRow(totalRowData);
            
            const expIdx = section.headers.indexOf('Expected Payment') + 1;
            const recIdx = section.headers.indexOf('Payment Received') + 1;
            
            if (expIdx > 0) {
                const cell = totalRow.getCell(expIdx);
                cell.value = sectionExpected;
                cell.numFmt = '$#,##0.00';
                cell.font = { bold: true };
            }
            if (recIdx > 0) {
                const cell = totalRow.getCell(recIdx);
                cell.value = sectionReceived;
                cell.numFmt = '$#,##0.00';
                cell.font = { bold: true };
            }

            allSectionsTotalExpected += sectionExpected;
            allSectionsTotalReceived += sectionReceived;


            // --- Add Detail Sheet to Master Workbook ---
            const { sheetname } = getFileInfo(section.title);
            // Check if sheet name exists (e.g. distinct sections mapping to same sheet name? unlikely with provided logic)
            // But title "Hartford Hospital - DIRECTORSHIP TRACKING" maps to "Directorship"
            // If we have multiple with same name, we might overwrite. 
            // The mapping seems unique per section based on user prompt.
            // Wait, "Hartford Hospital - Directorship" is one sheet.
            
            // However, keys must be unique.
            // Let's prefix with organization if needed? No, user said "Detail worksheet... for Hartford Hospital - Directorship".
            // Actually, in Master Workbook, it says "One detail worksheet per section".
            // So for "Hartford Hospital - DIRECTORSHIP TRACKING", sheet name should probably be "Hartford - Directorship" or similar to be unique if there are multiple "Directorship" sheets (e.g. St Francis).
            // User list: "Hartford Hospital – Directorship", "St. Francis – Directorship".
            // So sheet names in Master should be unique.
            
            let masterSheetName = section.title.replace(' - TRACKING', '').replace(' - ', ' ');
            // Remove invalid characters for Excel sheet names: * ? : \ / [ ]
            masterSheetName = masterSheetName.replace(/[*?:\/\[\]]/g, ' ');
            // Shorten to 31 chars max for Excel
            if (masterSheetName.length > 31) masterSheetName = masterSheetName.substring(0, 31);
            
            // ExcelJS doesn't allow duplicate sheet names.
            // If masterSheetName already exists, append a number
            let uniqueMasterSheetName = masterSheetName;
            let counter = 1;
            while (masterWorkbook.getWorksheet(uniqueMasterSheetName)) {
                uniqueMasterSheetName = `${masterSheetName} ${counter++}`;
            }

            const detailSheet = masterWorkbook.addWorksheet(uniqueMasterSheetName);
            
            // Add Export Date
            detailSheet.addRow([`Exported: ${exportDate}`]);
            
            // Add Section Title
            const detTitleRow = detailSheet.addRow([section.title]);
            detTitleRow.getCell(1).style = titleStyle;
            
            // Headers
            const detHeaderRow = detailSheet.addRow(section.headers);
            detHeaderRow.eachCell(cell => cell.style = headerStyle);
            
            // Data
            section.rows.forEach(row => {
                const addedRow = detailSheet.addRow(row);
                addedRow.eachCell(cell => cell.border = borderStyle);
                
                if (expIdx > 0) addedRow.getCell(expIdx).numFmt = '$#,##0.00';
                if (recIdx > 0) addedRow.getCell(recIdx).numFmt = '$#,##0.00';
            });
            
            // Total
            const detTotalRow = detailSheet.addRow(totalRowData);
            if (expIdx > 0) {
                const cell = detTotalRow.getCell(expIdx);
                cell.value = sectionExpected;
                cell.numFmt = '$#,##0.00';
                cell.font = { bold: true };
            }
            if (recIdx > 0) {
                const cell = detTotalRow.getCell(recIdx);
                cell.value = sectionReceived;
                cell.numFmt = '$#,##0.00';
                cell.font = { bold: true };
            }
            
            // Apply column highlight fills by header name
            const detHeaderRowNumber = detHeaderRow.number;
            applyColumnFill(detailSheet, section.headers, detHeaderRowNumber, 'Payment Received', PAYMENT_RECEIVED_FILL);
            applyColumnFill(detailSheet, section.headers, detHeaderRowNumber, 'Payment Date', PAYMENT_DATE_FILL);

            // Auto-size columns (simple approximation)
            detailSheet.columns.forEach(column => {
                let maxLength = 0;
                column.eachCell({ includeEmpty: true }, cell => {
                    const columnLength = cell.value ? cell.value.toString().length : 10;
                    if (columnLength > maxLength) maxLength = columnLength;
                });
                column.width = maxLength < 10 ? 10 : (maxLength > 50 ? 50 : maxLength + 2);
            });
        }

        // Add Grand Total to Summary
        summarySheet.addRow([]);
        const grandTotalRow = summarySheet.addRow(['GRAND TOTAL', '', '', '', '', '', '', '']); // Padding
        // Need to place totals in correct columns? Summary sheet has mixed columns potentially?
        // Actually, Summary sheet simply lists *every record*.
        // If sections have different columns (e.g. Nations Hearing has Voucher first), then the Summary sheet will look messy if we align purely by column index.
        // The user said: "Lists every record from every section (all rows), grouped by section."
        // If columns differ, we can't easily align them in a single "Summary" sheet unless we unify the schema or just dump them.
        // But the user asked for "Grand Total row with Total Expected... and Total Payment...".
        // If the columns for these values shift between sections, a visual Grand Total column is hard.
        // However, I'll calculate it and maybe just put it at the bottom with labels.
        grandTotalRow.getCell(1).font = { bold: true };
        const grandTotalRow2 = summarySheet.addRow(['Total Expected:', allSectionsTotalExpected, 'Total Received:', allSectionsTotalReceived]);
        grandTotalRow2.getCell(2).numFmt = '$#,##0.00';
        grandTotalRow2.getCell(4).numFmt = '$#,##0.00';
        grandTotalRow2.eachCell(cell => cell.font = { bold: true });

        // Auto-size Summary columns
        summarySheet.columns.forEach(column => {
             let maxLength = 0;
             column.eachCell({ includeEmpty: true }, cell => {
                 const columnLength = cell.value ? cell.value.toString().length : 10;
                 if (columnLength > maxLength) maxLength = columnLength;
             });
             column.width = maxLength < 10 ? 10 : (maxLength > 50 ? 50 : maxLength + 2);
         });

        const masterBuffer = await masterWorkbook.xlsx.writeBuffer();
        zip.file("Outside_Income_Payment_Tracking_Master.xlsx", masterBuffer);


        // 2. Generate Individual Workbooks
        // Group sections by filename
        const workbooksMap = {}; // filename -> { sheetname -> section }

        for (const section of sections) {
            const { filename, sheetname } = getFileInfo(section.title);
            if (!workbooksMap[filename]) workbooksMap[filename] = [];
            workbooksMap[filename].push({ sheetname, section });
        }

        for (const [filename, items] of Object.entries(workbooksMap)) {
            const wb = new ExcelJS.Workbook();
            
            for (const { sheetname, section } of items) {
                let uniqueSheetName = sheetname;
                let counter = 1;
                while (wb.getWorksheet(uniqueSheetName)) {
                    uniqueSheetName = `${sheetname} ${counter++}`;
                }
                const sheet = wb.addWorksheet(uniqueSheetName);
                
                sheet.addRow([`Exported: ${exportDate}`]);
                
                const titleRow = sheet.addRow([section.title]);
                titleRow.getCell(1).style = titleStyle;
                
                const headerRow = sheet.addRow(section.headers);
                headerRow.eachCell(cell => cell.style = headerStyle);
                
                const expIdx = section.headers.indexOf('Expected Payment') + 1;
                const recIdx = section.headers.indexOf('Payment Received') + 1;
                let sectionExpected = 0;
                let sectionReceived = 0;

                section.rows.forEach(row => {
                    const addedRow = sheet.addRow(row);
                    addedRow.eachCell(cell => cell.border = borderStyle);
                    
                    if (expIdx > 0) {
                        addedRow.getCell(expIdx).numFmt = '$#,##0.00';
                        sectionExpected += (typeof row[expIdx-1] === 'number' ? row[expIdx-1] : 0);
                    }
                    if (recIdx > 0) {
                        addedRow.getCell(recIdx).numFmt = '$#,##0.00';
                        sectionReceived += (typeof row[recIdx-1] === 'number' ? row[recIdx-1] : 0);
                    }
                });
                
                const totalRowData = new Array(section.headers.length).fill('');
                totalRowData[0] = 'TOTAL';
                const totalRow = sheet.addRow(totalRowData);
                if (expIdx > 0) {
                    const cell = totalRow.getCell(expIdx);
                    cell.value = sectionExpected;
                    cell.numFmt = '$#,##0.00';
                    cell.font = { bold: true };
                }
                if (recIdx > 0) {
                    const cell = totalRow.getCell(recIdx);
                    cell.value = sectionReceived;
                    cell.numFmt = '$#,##0.00';
                    cell.font = { bold: true };
                }

                // Apply column highlight fills by header name
                const indivHeaderRowNumber = sheet.getRow(3).number; // row 1=export date, row 2=title, row 3=headers
                applyColumnFill(sheet, section.headers, indivHeaderRowNumber, 'Payment Received', PAYMENT_RECEIVED_FILL);
                applyColumnFill(sheet, section.headers, indivHeaderRowNumber, 'Payment Date', PAYMENT_DATE_FILL);

                sheet.columns.forEach(column => {
                    let maxLength = 0;
                    column.eachCell({ includeEmpty: true }, cell => {
                        const columnLength = cell.value ? cell.value.toString().length : 10;
                        if (columnLength > maxLength) maxLength = columnLength;
                    });
                    column.width = maxLength < 10 ? 10 : (maxLength > 50 ? 50 : maxLength + 2);
                });
            }

            const buffer = await wb.xlsx.writeBuffer();
            zip.file(`${filename}.xlsx`, buffer);
        }

        const zipContent = await zip.generateAsync({ type: "base64" });

        return Response.json({ zipContent });

    } catch (error) {
        return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
    }
});