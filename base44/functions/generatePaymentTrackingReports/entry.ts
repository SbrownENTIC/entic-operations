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
        const { sections, exportDate = new Date().toISOString().split('T')[0], paymentQuarterRows = [] } = body;

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
        // Provider Revenue Summary sheet — slot 2, immediately after Summary
        const providerRevSheet = masterWorkbook.addWorksheet('Provider Revenue Summary', {
            properties: { tabColor: { argb: 'FF4F81BD' } }
        });

        // Payment Quarter View is intentionally NOT added to the Master workbook.
        // It remains available as an in-app view only.

        // Styles
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
        const yellowFill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };

        // Apply special column formatting by header name (not index)
        // "Payment Received" -> bold; "Payment Date" -> yellow fill
        const applyColumnFormatting = (addedRow, headers, existingNumFmt) => {
            const receivedIdx = headers.indexOf('Payment Received') + 1;
            const dateIdx = headers.indexOf('Payment Date') + 1;
            if (receivedIdx > 0) {
                const cell = addedRow.getCell(receivedIdx);
                cell.font = { ...(cell.font || {}), bold: true };
            }
            if (dateIdx > 0) {
                const cell = addedRow.getCell(dateIdx);
                cell.fill = yellowFill;
            }
        };

        // Add export date to Summary
        summarySheet.addRow([`Exported: ${exportDate}`]);

        // ── Helper: parse "MMM YYYY" sort key ───────────────────────────────
        const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
        const parseMonthStr = (str) => {
            // paymentDate is "YYYY-MM-DD"
            if (!str) return { year: 0, month: 0 };
            const d = new Date(str);
            return { year: d.getFullYear(), month: d.getMonth() + 1 };
        };
        const fmtMonthLabel = (dateStr) => {
            const d = new Date(dateStr);
            const mon = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getMonth()];
            return `${mon} ${d.getFullYear()}`;
        };
        const monthSortKey = (label) => {
            // "Jan 2026" → sortable number 202601
            const parts = label.split(' ');
            const monIdx = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].indexOf(parts[0]) + 1;
            return parseInt(parts[1]) * 100 + monIdx;
        };

        // Facilities tracked in the summary columns (in display order)
        const SUMMARY_FACILITIES = ['Hartford Hospital', 'St. Francis', 'UConn', 'HH - Manchester / ECHN'];

        // ── BUILD PROVIDER MONTHLY SUMMARY from paymentQuarterRows ──────────
        // Map: provider → month-label → facility → total
        const monthlyMap = {};
        (paymentQuarterRows || []).forEach(row => {
            if (!row.paymentDate || !row.provider) return;
            const label = fmtMonthLabel(row.paymentDate);
            if (!monthlyMap[row.provider]) monthlyMap[row.provider] = {};
            if (!monthlyMap[row.provider][label]) monthlyMap[row.provider][label] = {};
            const fac = row.programGroup || 'Other';
            monthlyMap[row.provider][label][fac] = (monthlyMap[row.provider][label][fac] || 0) + (row.amount || 0);
        });

        // Flatten into sorted rows: provider A-Z, then month newest-first
        const monthlyRows = [];
        Object.keys(monthlyMap).sort().forEach(provider => {
            const months = Object.keys(monthlyMap[provider]).sort((a, b) => monthSortKey(b) - monthSortKey(a));
            months.forEach(month => {
                const byFac = monthlyMap[provider][month];
                const hh = byFac['Hartford Hospital'] || 0;
                const sf = byFac['St. Francis'] || 0;
                const uc = byFac['UConn'] || 0;
                const manc = byFac['HH - Manchester / ECHN'] || 0;
                const total = Object.values(byFac).reduce((s, v) => s + v, 0);
                monthlyRows.push([provider, month, hh, sf, uc, manc, total]);
            });
        });

        // ── BUILD PROVIDER QUARTERLY SUMMARY ────────────────────────────────
        // Determine which year to show (current year from exportDate)
        const reportYear = new Date(exportDate).getFullYear() || new Date().getFullYear();
        // Map: provider → quarter-label → total
        const quarterlyMap = {};
        (paymentQuarterRows || []).forEach(row => {
            if (!row.quarter || !row.provider) return;
            if (!quarterlyMap[row.provider]) quarterlyMap[row.provider] = {};
            quarterlyMap[row.provider][row.quarter] = (quarterlyMap[row.provider][row.quarter] || 0) + (row.amount || 0);
        });

        // Determine all unique quarters across all providers, sorted desc for display
        const allQuarterSet = new Set();
        (paymentQuarterRows || []).forEach(row => { if (row.quarter) allQuarterSet.add(row.quarter); });
        // Sort quarters newest first
        const allQuarters = Array.from(allQuarterSet).sort((a, b) => {
            const [qa, ya] = [parseInt(a.slice(1,2)), parseInt(a.slice(3))];
            const [qb, yb] = [parseInt(b.slice(1,2)), parseInt(b.slice(3))];
            if (yb !== ya) return yb - ya;
            return qb - qa;
        });

        // Quarterly rows: provider A-Z
        const quarterlyRows = Object.keys(quarterlyMap).sort().map(provider => {
            const qData = quarterlyMap[provider];
            const row = [provider];
            allQuarters.forEach(q => row.push(qData[q] || 0));
            const ytd = Object.values(qData).reduce((s, v) => s + v, 0);
            row.push(ytd);
            return row;
        });

        // ── WRITE PROVIDER REVENUE SUMMARY SHEET ────────────────────────────
        // Section A — Provider Monthly Revenue Summary
        providerRevSheet.addRow([`Exported: ${exportDate}`]).getCell(1).font = { italic: true, size: 10, color: { argb: 'FF666666' } };
        providerRevSheet.addRow([]); // spacer

        const ms1Title = providerRevSheet.addRow(['SECTION A — PROVIDER MONTHLY REVENUE SUMMARY']);
        ms1Title.getCell(1).style = {
            font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F497D' } },
        };
        providerRevSheet.mergeCells(`A${ms1Title.number}:G${ms1Title.number}`);

        const monthlyHeaders = ['Provider', 'Month', 'Hartford Hospital', 'St. Francis', 'UConn', 'HH - Manchester / ECHN', 'Total'];
        const monthlyHeaderRow = providerRevSheet.addRow(monthlyHeaders);
        monthlyHeaderRow.eachCell(cell => { cell.style = headerStyle; });
        providerRevSheet.autoFilter = { from: { row: monthlyHeaderRow.number, column: 1 }, to: { row: monthlyHeaderRow.number, column: 7 } };
        // Freeze only header row (not export date or spacer rows) for better data scrolling
        providerRevSheet.views = [{ state: 'frozen', ySplit: monthlyHeaderRow.number }];

        const mCurrCols = [3, 4, 5, 6, 7];
        const mLightBand = 'FFF2F7FB';
        const mWhiteBand = 'FFFFFFFF';
        monthlyRows.forEach((row, idx) => {
            const addedRow = providerRevSheet.addRow(row);
            const bandColor = idx % 2 === 0 ? mLightBand : mWhiteBand;
            addedRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bandColor } };
                cell.border = borderStyle;
                if (mCurrCols.includes(colNum)) cell.numFmt = '$#,##0.00';
            });
            addedRow.getCell(7).font = { bold: true };
        });

        const mTotals = [
            'TOTAL', '',
            monthlyRows.reduce((s, r) => s + r[2], 0),
            monthlyRows.reduce((s, r) => s + r[3], 0),
            monthlyRows.reduce((s, r) => s + r[4], 0),
            monthlyRows.reduce((s, r) => s + r[5], 0),
            monthlyRows.reduce((s, r) => s + r[6], 0),
        ];
        const mTotalRow = providerRevSheet.addRow(mTotals);
        mTotalRow.eachCell((cell, colNum) => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDAE3F3' } };
            cell.border = borderStyle;
            if (mCurrCols.includes(colNum)) cell.numFmt = '$#,##0.00';
        });

        // Section B — Provider Quarterly Revenue Summary
        providerRevSheet.addRow([]); // spacer between sections
        const qs2Title = providerRevSheet.addRow(['SECTION B — PROVIDER QUARTERLY REVENUE SUMMARY']);
        qs2Title.getCell(1).style = {
            font: { bold: true, size: 12, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F497D' } },
        };
        const qTotalCols = allQuarters.length + 2;
        providerRevSheet.mergeCells(`A${qs2Title.number}:${String.fromCharCode(64 + Math.min(qTotalCols, 26))}${qs2Title.number}`);

        const quarterlyHeaders = ['Provider', ...allQuarters, 'YTD Total'];
        const quarterlyHeaderRow = providerRevSheet.addRow(quarterlyHeaders);
        quarterlyHeaderRow.eachCell(cell => { cell.style = headerStyle; });
        providerRevSheet.autoFilter = { from: { row: quarterlyHeaderRow.number, column: 1 }, to: { row: quarterlyHeaderRow.number, column: quarterlyHeaders.length } };

        const qCurrCols = quarterlyHeaders.map((_, i) => i + 1).filter(i => i > 1);
        const qLightBand = 'FFF7FBFF';
        quarterlyRows.forEach((row, idx) => {
            const addedRow = providerRevSheet.addRow(row);
            const bandColor = idx % 2 === 0 ? qLightBand : mWhiteBand;
            addedRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bandColor } };
                cell.border = borderStyle;
                if (qCurrCols.includes(colNum)) cell.numFmt = '$#,##0.00';
            });
            addedRow.getCell(quarterlyHeaders.length).font = { bold: true };
        });

        const qTotals = ['TOTAL'];
        allQuarters.forEach((q, i) => {
            qTotals.push(quarterlyRows.reduce((s, r) => s + (r[i + 1] || 0), 0));
        });
        qTotals.push(quarterlyRows.reduce((s, r) => s + (r[r.length - 1] || 0), 0));
        const qTotalRow = providerRevSheet.addRow(qTotals);
        qTotalRow.eachCell((cell, colNum) => {
            cell.font = { bold: true };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDAE3F3' } };
            cell.border = borderStyle;
            if (qCurrCols.includes(colNum)) cell.numFmt = '$#,##0.00';
        });

        // Auto-size Provider Revenue Summary columns
        const prsMinWidths = [24, 14, 18, 16, 14, 24, 16];
        providerRevSheet.columns.forEach((col, i) => {
            let max = prsMinWidths[i] || 14;
            col.eachCell({ includeEmpty: false }, cell => {
                const len = cell.value ? String(cell.value).length + 2 : 0;
                if (len > max) max = len;
            });
            col.width = Math.min(max, 40);
        });
        // ── END PROVIDER REVENUE SUMMARY SHEET ──────────────────────────────

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

            const expectedIdx = section.headers.indexOf('Expected Payment') + 1;
            const receivedIdx = section.headers.indexOf('Payment Received') + 1;

            section.rows.forEach(row => {
                const addedRow = summarySheet.addRow(row);
                addedRow.eachCell(cell => cell.border = borderStyle);

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
                applyColumnFormatting(addedRow, section.headers);
            });

            // Section Total Row
            const totalRowData = new Array(section.headers.length).fill('');
            totalRowData[0] = 'TOTAL';
            const totalRow = summarySheet.addRow(totalRowData);

            if (expectedIdx > 0) {
                const cell = totalRow.getCell(expectedIdx);
                cell.value = sectionExpected;
                cell.numFmt = '$#,##0.00';
                cell.font = { bold: true };
            }
            if (receivedIdx > 0) {
                const cell = totalRow.getCell(receivedIdx);
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

            // Enable AutoFilter on the header row (detail sheets have one section each)
            const numCols = section.headers.length;
            const headerRowNum = detHeaderRow.number;
            const lastCol = String.fromCharCode(64 + numCols); // A=1, B=2 ... up to Z
            detailSheet.autoFilter = {
                from: { row: headerRowNum, column: 1 },
                to: { row: headerRowNum, column: numCols }
            };
            
            // Data
            section.rows.forEach(row => {
                const addedRow = detailSheet.addRow(row);
                addedRow.eachCell(cell => cell.border = borderStyle);

                if (expectedIdx > 0) addedRow.getCell(expectedIdx).numFmt = '$#,##0.00';
                if (receivedIdx > 0) addedRow.getCell(receivedIdx).numFmt = '$#,##0.00';
                applyColumnFormatting(addedRow, section.headers);
            });

            // Total
            const detTotalRow = detailSheet.addRow(totalRowData);
            if (expectedIdx > 0) {
                const cell = detTotalRow.getCell(expectedIdx);
                cell.value = sectionExpected;
                cell.numFmt = '$#,##0.00';
                cell.font = { bold: true };
            }
            if (receivedIdx > 0) {
                const cell = detTotalRow.getCell(receivedIdx);
                cell.value = sectionReceived;
                cell.numFmt = '$#,##0.00';
                cell.font = { bold: true };
            }
            
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

        // Auto-size Summary columns — minimum widths for summary columns
        const summaryMinWidths = [24, 14, 18, 16, 14, 24, 16];
        summarySheet.columns.forEach((column, i) => {
             let maxLength = summaryMinWidths[i] || 12;
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

                // Enable AutoFilter on the header row
                sheet.autoFilter = {
                    from: { row: headerRow.number, column: 1 },
                    to: { row: headerRow.number, column: section.headers.length }
                };

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
                    applyColumnFormatting(addedRow, section.headers);
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