import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';
import * as XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { dateRange = { start: '', end: '' }, selectedProgramGroup = 'all' } = body;

    console.log('Received body:', body);
    console.log('Received dateRange:', dateRange);
    console.log('Received selectedProgramGroup:', selectedProgramGroup);

    // Fetch all data
    const [invoices, payments, providers, programLocations, outsideIncome] = await Promise.all([
      base44.entities.Invoice.list('-invoice_date'),
      base44.entities.Payment.list('-payment_date'),
      base44.entities.Provider.list(),
      base44.entities.ProgramLocation.list(),
      base44.entities.OutsideIncome.list()
    ]);

    const formatCurrency = (amount) => {
      return amount || 0;
    };

    const sortByMonth = (invoices) => {
      const monthOrder = {
        'January': 1, 'February': 2, 'March': 3, 'April': 4, 'May': 5, 'June': 6,
        'July': 7, 'August': 8, 'September': 9, 'October': 10, 'November': 11, 'December': 12
      };
      
      return invoices.sort((a, b) => {
        if (!a.month || !b.month) return 0;
        const [aMonth, aYear] = a.month.split(' ');
        const [bMonth, bYear] = b.month.split(' ');
        
        const yearDiff = (parseInt(aYear) || 0) - (parseInt(bYear) || 0);
        if (yearDiff !== 0) return yearDiff;
        
        return (monthOrder[aMonth] || 0) - (monthOrder[bMonth] || 0);
      });
    };

    // Filter invoices
    const filteredInvoices = invoices.filter(inv => {
      if (!inv.invoice_date) return false;
      
      if (dateRange.start || dateRange.end) {
        const invDate = new Date(inv.invoice_date);
        const start = dateRange.start ? new Date(dateRange.start) : null;
        const end = dateRange.end ? new Date(dateRange.end) : null;

        if (start && invDate < start) return false;
        if (end && invDate > end) return false;
      }
      
      if (selectedProgramGroup !== 'all' && inv.program_group !== selectedProgramGroup) {
        return false;
      }
      return true;
    });

    const workbook = XLSX.utils.book_new();
    const programGroups = [...new Set(filteredInvoices.map(inv => inv.program_group).filter(Boolean))].sort();

    programGroups.forEach(programGroup => {
      const groupInvoices = filteredInvoices.filter(inv => inv.program_group === programGroup);
      const needsSeparation = programGroup === 'Hartford Hospital' || programGroup === 'St. Francis';
      
      if (needsSeparation) {
        const directorshipLocation = programLocations.find(pl => 
          pl.program_group === programGroup && pl.program_type === 'Directorship'
        );
        const onCallLocation = programLocations.find(pl => 
          pl.program_group === programGroup && pl.program_type === 'On-Call'
        );
        const directorshipRate = programGroup === 'Hartford Hospital' ? 3250 : 1750;

        // DIRECTORSHIP SECTION
        if (directorshipLocation) {
          const directorshipRows = [];
          directorshipRows.push(['Provider', 'Invoice Number', 'Month', 'Expected Payment', 'Payment Received', 'Date/Voucher Number', 'Date Paid Provider', 'Notes']);

          const directorshipInvoices = groupInvoices.filter(inv => {
            const linkedIncomes = (inv.outside_income_ids || []).map(incomeId => 
              outsideIncome.find(income => income.id === incomeId)
            ).filter(Boolean);

            const hasDirectorshipIncome = linkedIncomes.some(income => {
              if (income.facility_name && income.facility_name.toLowerCase().includes('directorship')) {
                return true;
              }
              if (income.program_location_id) {
                const incomeLocation = programLocations.find(pl => pl.id === income.program_location_id);
                if (incomeLocation?.program_type === 'Directorship') {
                  return true;
                }
              }
              return false;
            });
            
            if (hasDirectorshipIncome) return true;
            if (linkedIncomes.length === 0) {
              const amount = inv.amount_expected || inv.total || 0;
              return Math.abs(amount - directorshipRate) < 1;
            }
            return false;
          });

          sortByMonth(directorshipInvoices);
          let directorshipTotal = { expected: 0, received: 0 };

          directorshipInvoices.forEach(invoice => {
            // Simplified test data
            directorshipTotal.expected += 3250;
            directorshipTotal.received += 3250;

            directorshipRows.push([
              'Test Provider',
              'INV-001',
              'January 2025',
              3250,
              3250,
              '01/15/2025',
              '01/20/2025',
              'Test notes'
            ]);
          });

          directorshipRows.push(['TOTAL', '', '', directorshipTotal.expected, directorshipTotal.received, '', '', '']);
          
          const directorshipSheet = XLSX.utils.aoa_to_sheet(directorshipRows);
          directorshipSheet['!cols'] = [
            { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, 
            { wch: 25 }, { wch: 18 }, { wch: 30 }
          ];
          
          // Commented out for debugging
          // const range = XLSX.utils.decode_range(directorshipSheet['!ref']);
          // for (let R = 1; R <= range.e.r; R++) {
          //   ['D', 'E'].forEach(col => {
          //     const cellRef = col + (R + 1);
          //     if (directorshipSheet[cellRef] && typeof directorshipSheet[cellRef].v === 'number') {
          //       directorshipSheet[cellRef].z = '$#,##0.00';
          //     }
          //   });
          // }
          
          const sheetName = programGroup === 'Hartford Hospital' ? 'HH Directorship' : 'SF Directorship';
          XLSX.utils.book_append_sheet(workbook, directorshipSheet, sheetName.replace(/[:\\\/\?\*\[\]]/g, ''));
        }

        // ON-CALL SECTION
        if (onCallLocation) {
          const onCallRows = [];
          onCallRows.push(['Provider', 'Invoice Number', 'Month', 'Expected Payment', 'Payment Received', 'Date/Voucher Number', 'Date Paid Provider', 'Notes']);

          const onCallInvoices = groupInvoices.filter(inv => {
            const linkedIncomes = (inv.outside_income_ids || []).map(incomeId => 
              outsideIncome.find(income => income.id === incomeId)
            ).filter(Boolean);

            const hasDirectorshipIncome = linkedIncomes.some(income => {
              if (income.facility_name && income.facility_name.toLowerCase().includes('directorship')) {
                return true;
              }
              if (income.program_location_id) {
                const incomeLocation = programLocations.find(pl => pl.id === income.program_location_id);
                if (incomeLocation?.program_type === 'Directorship') {
                  return true;
                }
              }
              return false;
            });
            
            return !hasDirectorshipIncome;
          });

          sortByMonth(onCallInvoices);
          let onCallTotal = { expected: 0, received: 0 };

          onCallInvoices.forEach(invoice => {
            // Simplified test data
            onCallTotal.expected += 1500;
            onCallTotal.received += 1500;

            onCallRows.push([
              'Test Provider',
              'INV-002',
              'January 2025',
              1500,
              1500,
              '01/15/2025',
              '01/20/2025',
              'Test notes'
            ]);
          });

          onCallRows.push(['TOTAL', '', '', onCallTotal.expected, onCallTotal.received, '', '', '']);
          
          const onCallSheet = XLSX.utils.aoa_to_sheet(onCallRows);
          onCallSheet['!cols'] = [
            { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, 
            { wch: 25 }, { wch: 18 }, { wch: 30 }
          ];
          
          // Commented out for debugging
          // const range = XLSX.utils.decode_range(onCallSheet['!ref']);
          // for (let R = 1; R <= range.e.r; R++) {
          //   ['D', 'E'].forEach(col => {
          //     const cellRef = col + (R + 1);
          //     if (onCallSheet[cellRef] && typeof onCallSheet[cellRef].v === 'number') {
          //       onCallSheet[cellRef].z = '$#,##0.00';
          //     }
          //   });
          // }
          
          const sheetName = programGroup === 'Hartford Hospital' ? 'HH On-Call' : 'SF On-Call';
          XLSX.utils.book_append_sheet(workbook, onCallSheet, sheetName.replace(/[:\\\/\?\*\[\]]/g, ''));
        }
      } else {
        // Standard tracking
        const standardRows = [];
        standardRows.push(['Provider', 'Invoice Number', 'Month', 'Expected Payment', 'Payment Received', 'Date/Voucher Number', 'Date Paid Provider', 'Notes']);

        sortByMonth(groupInvoices);
        let groupTotal = { expected: 0, received: 0 };

        groupInvoices.forEach(invoice => {
          // Simplified test data
          groupTotal.expected += 2000;
          groupTotal.received += 2000;

          standardRows.push([
            'Test Provider',
            'INV-003',
            'January 2025',
            2000,
            2000,
            '01/15/2025',
            '01/20/2025',
            'Test notes'
          ]);
        });

        standardRows.push(['TOTAL', '', '', groupTotal.expected, groupTotal.received, '', '', '']);
        
        const standardSheet = XLSX.utils.aoa_to_sheet(standardRows);
        standardSheet['!cols'] = [
          { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, 
          { wch: 25 }, { wch: 18 }, { wch: 30 }
        ];
        
        // Commented out for debugging
        // const range = XLSX.utils.decode_range(standardSheet['!ref']);
        // for (let R = 1; R <= range.e.r; R++) {
        //   ['D', 'E'].forEach(col => {
        //     const cellRef = col + (R + 1);
        //     if (standardSheet[cellRef] && typeof standardSheet[cellRef].v === 'number') {
        //       standardSheet[cellRef].z = '$#,##0.00';
        //     }
        //   });
        // }
        
        let sheetName = programGroup.replace(/[:\\\/\?\*\[\]]/g, '');
        if (sheetName.length > 31) {
          sheetName = sheetName.substring(0, 31);
        }
        XLSX.utils.book_append_sheet(workbook, standardSheet, sheetName);
      }
    });

    const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
    const uint8Array = new Uint8Array(buffer);
    const today = new Date().toISOString().split('T')[0];

    return new Response(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename=payment_tracking_report_${today}.xlsx`
      }
    });

  } catch (error) {
    console.error('Error generating report:', error);
    return Response.json({ error: error.message, stack: error.stack }, { status: 500 });
  }
});