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
    const { dateRange, selectedProgramGroup } = body;

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
            const provider = providers.find(p => p.id === invoice.staff_member_id);
            const providerName = provider?.full_name || 'Unknown';

            let paymentInfo = '';
            payments.forEach(payment => {
              payment.allocations?.forEach(allocation => {
                if (allocation.invoice_id === invoice.id) {
                  const payDate = new Date(payment.payment_date).toLocaleDateString('en-US');
                  const voucher = payment.reference_number || '';
                  paymentInfo = `${payDate} / ${voucher}`;
                }
              });
            });

            const expectedAmount = invoice.amount_expected || invoice.total || 0;
            const receivedAmount = invoice.amount_received || 0;
            directorshipTotal.expected += expectedAmount;
            directorshipTotal.received += receivedAmount;

            directorshipRows.push([
              providerName,
              invoice.invoice_number || '',
              invoice.month || '',
              expectedAmount,
              receivedAmount,
              paymentInfo,
              invoice.date_provider_paid ? new Date(invoice.date_provider_paid).toLocaleDateString('en-US') : '',
              invoice.notes || ''
            ]);
          });

          directorshipRows.push(['TOTAL', '', '', directorshipTotal.expected, directorshipTotal.received, '', '', '']);
          
          const directorshipSheet = XLSX.utils.aoa_to_sheet(directorshipRows);
          directorshipSheet['!cols'] = [
            { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, 
            { wch: 25 }, { wch: 18 }, { wch: 30 }
          ];
          
          const range = XLSX.utils.decode_range(directorshipSheet['!ref']);
          for (let R = 1; R <= range.e.r; R++) {
            ['D', 'E'].forEach(col => {
              const cellRef = col + (R + 1);
              if (directorshipSheet[cellRef] && typeof directorshipSheet[cellRef].v === 'number') {
                directorshipSheet[cellRef].z = '$#,##0.00';
              }
            });
          }
          
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
            const provider = providers.find(p => p.id === invoice.staff_member_id);
            const providerName = provider?.full_name || 'Unknown';

            let paymentInfo = '';
            payments.forEach(payment => {
              payment.allocations?.forEach(allocation => {
                if (allocation.invoice_id === invoice.id) {
                  const payDate = new Date(payment.payment_date).toLocaleDateString('en-US');
                  const voucher = payment.reference_number || '';
                  paymentInfo = `${payDate} / ${voucher}`;
                }
              });
            });

            const expectedAmount = invoice.amount_expected || invoice.total || 0;
            const receivedAmount = invoice.amount_received || 0;
            onCallTotal.expected += expectedAmount;
            onCallTotal.received += receivedAmount;

            onCallRows.push([
              providerName,
              invoice.invoice_number || '',
              invoice.month || '',
              expectedAmount,
              receivedAmount,
              paymentInfo,
              invoice.date_provider_paid ? new Date(invoice.date_provider_paid).toLocaleDateString('en-US') : '',
              invoice.notes || ''
            ]);
          });

          onCallRows.push(['TOTAL', '', '', onCallTotal.expected, onCallTotal.received, '', '', '']);
          
          const onCallSheet = XLSX.utils.aoa_to_sheet(onCallRows);
          onCallSheet['!cols'] = [
            { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, 
            { wch: 25 }, { wch: 18 }, { wch: 30 }
          ];
          
          const range = XLSX.utils.decode_range(onCallSheet['!ref']);
          for (let R = 1; R <= range.e.r; R++) {
            ['D', 'E'].forEach(col => {
              const cellRef = col + (R + 1);
              if (onCallSheet[cellRef] && typeof onCallSheet[cellRef].v === 'number') {
                onCallSheet[cellRef].z = '$#,##0.00';
              }
            });
          }
          
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
          const provider = providers.find(p => p.id === invoice.staff_member_id);
          const providerName = provider?.full_name || 'Unknown';

          let paymentInfo = '';
          payments.forEach(payment => {
            payment.allocations?.forEach(allocation => {
              if (allocation.invoice_id === invoice.id) {
                const payDate = new Date(payment.payment_date).toLocaleDateString('en-US');
                const voucher = payment.reference_number || '';
                paymentInfo = `${payDate} / ${voucher}`;
              }
            });
          });

          const expectedAmount = invoice.amount_expected || invoice.total || 0;
          const receivedAmount = invoice.amount_received || 0;
          groupTotal.expected += expectedAmount;
          groupTotal.received += receivedAmount;

          standardRows.push([
            providerName,
            invoice.invoice_number || '',
            invoice.month || '',
            expectedAmount,
            receivedAmount,
            paymentInfo,
            invoice.date_provider_paid ? new Date(invoice.date_provider_paid).toLocaleDateString('en-US') : '',
            invoice.notes || ''
          ]);
        });

        standardRows.push(['TOTAL', '', '', groupTotal.expected, groupTotal.received, '', '', '']);
        
        const standardSheet = XLSX.utils.aoa_to_sheet(standardRows);
        standardSheet['!cols'] = [
          { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, 
          { wch: 25 }, { wch: 18 }, { wch: 30 }
        ];
        
        const range = XLSX.utils.decode_range(standardSheet['!ref']);
        for (let R = 1; R <= range.e.r; R++) {
          ['D', 'E'].forEach(col => {
            const cellRef = col + (R + 1);
            if (standardSheet[cellRef] && typeof standardSheet[cellRef].v === 'number') {
              standardSheet[cellRef].z = '$#,##0.00';
            }
          });
        }
        
        let sheetName = programGroup.replace(/[:\\\/\?\*\[\]]/g, '');
        if (sheetName.length > 31) {
          sheetName = sheetName.substring(0, 31);
        }
        XLSX.utils.book_append_sheet(workbook, standardSheet, sheetName);
      }
    });

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const today = new Date().toISOString().split('T')[0];

    return new Response(buffer, {
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