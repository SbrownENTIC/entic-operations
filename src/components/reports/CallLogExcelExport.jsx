import * as XLSX from 'xlsx';

const formatDuration = (seconds) => {
  if (!seconds) return "00:00:00";
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatDateForDisplay = (dateStr) => {
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
};

export async function generateExcelExport(summary, userBreakdown, reportTitle, startDate, endDate, status) {
  const workbook = XLSX.utils.book_new();
  
  // ===== FILE AND SHEET NAMING =====
  let sheetName = 'Call Log';
  let fileName = reportTitle;
  
  if (status === 'Monthly') {
    const monthYear = reportTitle.replace(' - Call Log', '');
    sheetName = monthYear;
    fileName = `${monthYear} - Call Log`;
  } else {
    const startFormatted = formatDateForDisplay(startDate);
    const endFormatted = formatDateForDisplay(endDate);
    fileName = `Call Log - ${startFormatted} to ${endFormatted}`;
    sheetName = 'Call Log';
  }
  
  const ws_data = [];
  let rowIndex = 0;
  
  // Row 1: Title (will be merged)
  ws_data[rowIndex] = [reportTitle];
  const titleRow = rowIndex;
  rowIndex++;
  
  // Row 2: Reporting Period
  const startFormatted = formatDateForDisplay(startDate);
  const endFormatted = formatDateForDisplay(endDate);
  ws_data[rowIndex] = [`Reporting Period: ${startFormatted} – ${endFormatted}`];
  const periodRow = rowIndex;
  rowIndex++;
  
  // Row 3: Generated On
  const now = new Date();
  const timestamp = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  ws_data[rowIndex] = [`Generated On: ${timestamp}`];
  const generatedRow = rowIndex;
  rowIndex++;
  
  // Blank row
  rowIndex++;
  
  // ===== KPI SUMMARY SECTION =====
  const kpiStartRow = rowIndex;
  const kpiHeaderRow = rowIndex;
  ws_data[rowIndex] = ['Metric', 'Value'];
  rowIndex++;
  
  ws_data[rowIndex] = ['Total Calls', summary.total_calls];
  rowIndex++;
  ws_data[rowIndex] = ['Inbound', summary.inbound_calls];
  rowIndex++;
  ws_data[rowIndex] = ['Outbound', summary.outbound_calls];
  rowIndex++;
  ws_data[rowIndex] = ['Answered', summary.answered_calls];
  rowIndex++;
  ws_data[rowIndex] = ['Missed', summary.missed_calls];
  rowIndex++;
  ws_data[rowIndex] = ['Answer Rate (%)', (summary.answer_rate_percent || 0)];
  rowIndex++;
  ws_data[rowIndex] = ['Total Duration', formatDuration(summary.total_duration_seconds)];
  rowIndex++;
  ws_data[rowIndex] = ['Average Duration', formatDuration(summary.avg_call_duration_seconds)];
  const kpiEndRow = rowIndex;
  rowIndex++;
  
  // Blank row
  rowIndex++;
  
  // ===== USER BREAKDOWN TABLE =====
  const tableHeaderRow = rowIndex;
  ws_data[rowIndex] = [
    'User',
    'Total Calls',
    'Inbound',
    'Outbound',
    'Answered',
    'Missed',
    'Total Duration',
    'Answer Rate (%)',
    'Average Duration'
  ];
  rowIndex++;
  
  // User data rows (sorted by total_calls descending, filtered for > 0)
  const sortedUsers = userBreakdown
    .filter(u => u.total_calls > 0)
    .sort((a, b) => b.total_calls - a.total_calls);
  
  const tableDataStartRow = rowIndex;
  sortedUsers.forEach((user) => {
    ws_data[rowIndex] = [
      user.user,
      user.total_calls,
      user.inbound_calls,
      user.outbound_calls,
      user.answered_calls,
      user.missed_calls,
      formatDuration(user.total_duration_seconds),
      user.answer_rate_percent,
      formatDuration(user.avg_call_duration_seconds)
    ];
    rowIndex++;
  });
  const tableDataEndRow = rowIndex - 1;
  
  // Convert to sheet
  const dataSheet = XLSX.utils.aoa_to_sheet(ws_data);
  
  // ===== DISABLE GRIDLINES =====
  dataSheet.pageSetupView = { gridLines: false };
  
  // ===== TITLE SECTION FORMATTING =====
  
  // Merge title across columns (A1:I1)
  if (!dataSheet['!merges']) {
    dataSheet['!merges'] = [];
  }
  dataSheet['!merges'].push({ s: { r: titleRow, c: 0 }, e: { r: titleRow, c: 8 } });
  
  // Title styling - 18pt, bold, dark blue, thick bottom border
  if (dataSheet['A1']) {
    dataSheet['A1'].s = {
      font: { bold: true, sz: 18, color: { rgb: 'FF1F4E79' } },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: false },
      border: {
        bottom: { style: 'medium', color: { rgb: 'FF1F4E79' } }
      }
    };
  }
  
  // Reporting Period - bold label
  if (dataSheet['A2']) {
    dataSheet['A2'].s = {
      font: { bold: true, sz: 11, color: { rgb: 'FF333333' } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
  }
  
  // Generated On - subtle gray, 10pt
  if (dataSheet['A3']) {
    dataSheet['A3'].s = {
      font: { sz: 10, color: { rgb: 'FF666666' } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
  }
  
  // ===== KPI SUMMARY CARD SECTION =====
  // Header row with dark blue background
  for (let i = 0; i < 2; i++) {
    const cell = XLSX.utils.encode_cell({ r: kpiHeaderRow, c: i });
    dataSheet[cell] = dataSheet[cell] || { t: 's', v: '' };
    dataSheet[cell].s = {
      font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: 'FF1F4E79' } },
      border: { 
        top: { style: 'thin', color: { rgb: 'FF1F4E79' } },
        bottom: { style: 'thin', color: { rgb: 'FF1F4E79' } },
        left: { style: 'thin', color: { rgb: 'FF1F4E79' } },
        right: { style: 'thin', color: { rgb: 'FF1F4E79' } }
      },
      alignment: { horizontal: i === 0 ? 'left' : 'right', vertical: 'center' }
    };
  }
  
  // KPI Data Rows - card style with light gray value column
  for (let idx = kpiHeaderRow + 1; idx <= kpiEndRow; idx++) {
    for (let i = 0; i < 2; i++) {
      const cell = XLSX.utils.encode_cell({ r: idx, c: i });
      if (dataSheet[cell]) {
        dataSheet[cell].s = {
          font: { 
            bold: i === 0, 
            color: i === 0 ? { rgb: 'FF333333' } : { rgb: 'FF000000' },
            sz: i === 0 ? 11 : 14
          },
          fill: { fgColor: { rgb: i === 1 ? 'FFF2F2F2' : 'FFFAFBFC' } },
          border: { 
            top: { style: 'thin', color: { rgb: 'FFD3D3D3' } },
            bottom: { style: 'thin', color: { rgb: 'FFD3D3D3' } },
            left: { style: 'thin', color: { rgb: 'FFD3D3D3' } },
            right: { style: 'thin', color: { rgb: 'FFD3D3D3' } }
          },
          alignment: { horizontal: i === 0 ? 'left' : 'right', vertical: 'center' }
        };
      }
    }
  }
  
  // ===== DATA TABLE AS STRUCTURED EXCEL TABLE =====
  
  // Table Header Row - white text on dark blue
  for (let i = 0; i < 9; i++) {
    const cell = XLSX.utils.encode_cell({ r: tableHeaderRow, c: i });
    dataSheet[cell] = dataSheet[cell] || { t: 's', v: '' };
    dataSheet[cell].s = {
      font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: 'FF1F4E79' } },
      border: { 
        top: { style: 'thin', color: { rgb: 'FF1F4E79' } },
        bottom: { style: 'thin', color: { rgb: 'FF1F4E79' } },
        left: { style: 'thin', color: { rgb: 'FF1F4E79' } },
        right: { style: 'thin', color: { rgb: 'FF1F4E79' } }
      },
      alignment: { horizontal: i === 0 ? 'left' : 'center', vertical: 'center' }
    };
  }
  
  // User Data Rows - alternating shading with thin borders
  sortedUsers.forEach((user, idx) => {
    const rowNum = tableDataStartRow + idx;
    const isEvenRow = idx % 2 === 0;
    const backgroundColor = isEvenRow ? 'FFFFFFFF' : 'FFFFF9FAFB';
    
    for (let i = 0; i < 9; i++) {
      const cell = XLSX.utils.encode_cell({ r: rowNum, c: i });
      dataSheet[cell] = dataSheet[cell] || { t: 's', v: '' };
      
      // Special handling for answer rate column
      let cellFill = { fgColor: { rgb: backgroundColor } };
      if (i === 7) {
        const rate = user.answer_rate_percent || 0;
        if (rate >= 90) {
          cellFill = { fgColor: { rgb: 'FFE8F5E9' } }; // Subtle green
        } else if (rate >= 70) {
          cellFill = { fgColor: { rgb: 'FFF9F5E9' } }; // Subtle yellow
        } else {
          cellFill = { fgColor: { rgb: 'FFFFE9E9' } }; // Subtle red
        }
      }
      
      dataSheet[cell].s = {
        border: { 
          top: { style: 'thin', color: { rgb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { rgb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { rgb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { rgb: 'FFE0E0E0' } }
        },
        fill: cellFill,
        alignment: { horizontal: i === 0 ? 'left' : 'right', vertical: 'center' },
        font: { sz: 10 }
      };
    }
  });
  
  // ===== COLUMN WIDTHS & FORMATTING =====
  dataSheet['!cols'] = [
    { wch: 25 }, // User
    { wch: 14 }, // Total Calls
    { wch: 12 }, // Inbound
    { wch: 12 }, // Outbound
    { wch: 12 }, // Answered
    { wch: 12 }, // Missed
    { wch: 18 }, // Total Duration
    { wch: 15 }, // Answer Rate
    { wch: 18 }  // Average Duration
  ];
  
  // Apply data type and number formatting
  for (let row = tableDataStartRow; row <= tableDataEndRow; row++) {
    // Total Calls, Inbound, Outbound, Answered, Missed (columns 1-5) - number with comma separator
    for (let col = 1; col <= 5; col++) {
      const cell = XLSX.utils.encode_cell({ r: row, c: col });
      if (dataSheet[cell]) {
        dataSheet[cell].t = 'n';
        dataSheet[cell].s = {
          ...(dataSheet[cell].s || {}),
          numFmt: '#,##0'
        };
      }
    }
    
    // Answer Rate (column 7) - percentage format with 1 decimal place
    const answerRateCell = XLSX.utils.encode_cell({ r: row, c: 7 });
    if (dataSheet[answerRateCell]) {
      dataSheet[answerRateCell].t = 'n';
      dataSheet[answerRateCell].s = {
        ...(dataSheet[answerRateCell].s || {}),
        numFmt: '0.0"%"'
      };
    }
  }
  
  // Format duration columns (6 and 8) as hh:mm:ss
  for (let row = tableDataStartRow; row <= tableDataEndRow; row++) {
    for (const col of [6, 8]) {
      const cell = XLSX.utils.encode_cell({ r: row, c: col });
      if (dataSheet[cell]) {
        dataSheet[cell].s = {
          ...(dataSheet[cell].s || {}),
          numFmt: '[h]:mm:ss'
        };
      }
    }
  }
  
  // ===== FREEZE HEADER ROW & HIDE GRIDLINES =====
  dataSheet['!freeze'] = { xSplit: 0, ySplit: tableHeaderRow + 1 };
  dataSheet.pageSetupView = { gridLines: false };
  
  XLSX.utils.book_append_sheet(workbook, dataSheet, sheetName);
  
  // Download the file
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}