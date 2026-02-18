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

const getAnswerRateColor = (rate) => {
  if (rate >= 80) return 'FFD9EDD9'; // Light green background
  if (rate >= 50) return 'FFFEF3CD'; // Light yellow background
  return 'FFF8D7DA'; // Light red background
};

export async function generateExcelExport(summary, userBreakdown, reportTitle, startDate, endDate, status) {
  const workbook = XLSX.utils.book_new();
  
  // ===== FILE AND SHEET NAMING =====
  let sheetName = 'Call Log';
  let fileName = reportTitle;
  
  if (status === 'Monthly') {
    // Extract month/year from reportTitle (e.g., "December 2025 - Call Log")
    const monthYear = reportTitle.replace(' - Call Log', '');
    sheetName = monthYear;
    fileName = `${monthYear} - Call Log`;
  } else {
    // Weekly or Custom Range
    const startFormatted = formatDateForDisplay(startDate);
    const endFormatted = formatDateForDisplay(endDate);
    fileName = `Call Log - ${startFormatted} to ${endFormatted}`;
    sheetName = 'Call Log';
  }
  
  const ws_data = [];
  
  let rowIndex = 0;
  
  // Row 1: Title (bold, 16pt)
  ws_data[rowIndex] = [reportTitle];
  rowIndex++;
  
  // Row 2: Reporting Period with MM/DD/YYYY format
  const startFormatted = formatDateForDisplay(startDate);
  const endFormatted = formatDateForDisplay(endDate);
  ws_data[rowIndex] = [`Reporting Period: ${startFormatted} – ${endFormatted}`];
  rowIndex++;
  
  // Row 3: Generated On
  const now = new Date();
  const timestamp = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  ws_data[rowIndex] = [`Generated On: ${timestamp}`];
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
  
  sortedUsers.forEach((user, idx) => {
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
  
  // Convert to sheet
  const dataSheet = XLSX.utils.aoa_to_sheet(ws_data);
  
  // ===== APPLY FORMATTING =====
  
  // Title - bold, 16pt, dark blue text, light gray background
  if (dataSheet['A1']) {
    dataSheet['A1'].s = { 
      font: { bold: true, sz: 16, color: { rgb: 'FF1F4E79' } },
      fill: { fgColor: { rgb: 'FFF0F0F0' } },
      alignment: { horizontal: 'left', vertical: 'center' } 
    };
  }
  
  // Row 2 (Reporting Period) - bold label
  if (dataSheet['A2']) {
    dataSheet['A2'].s = {
      font: { bold: true, sz: 11 },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
  }
  
  // Row 3 (Generated On) - subtle gray, smaller font
  if (dataSheet['A3']) {
    dataSheet['A3'].s = {
      font: { sz: 10, color: { rgb: 'FF808080' } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
  }
  
  // KPI Header Row - bold, dark blue background, white text
  for (let i = 0; i < 2; i++) {
    const cell = XLSX.utils.encode_cell({ r: kpiHeaderRow, c: i });
    dataSheet[cell] = dataSheet[cell] || { t: 's', v: '' };
    dataSheet[cell].s = {
      font: { bold: true, color: { rgb: 'FFFFFFFF' } },
      fill: { fgColor: { rgb: 'FF1F4E79' } },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
      alignment: { horizontal: i === 0 ? 'left' : 'right', vertical: 'center' }
    };
  }
  
  // KPI Data Rows - light card-style background with borders, proper alignment
  for (let idx = kpiHeaderRow + 1; idx < kpiStartRow + 9; idx++) {
    for (let i = 0; i < 2; i++) {
      const cell = XLSX.utils.encode_cell({ r: idx, c: i });
      if (dataSheet[cell]) {
        const isBoldMetric = i === 0;
        dataSheet[cell].s = {
          font: { bold: isBoldMetric, color: isBoldMetric ? { rgb: 'FF404040' } : undefined, sz: 11 },
          fill: { fgColor: { rgb: i === 1 ? 'FFF2F2F2' : 'FFFAFBFC' } },
          border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
          alignment: { horizontal: i === 0 ? 'left' : 'right', vertical: 'center' }
        };
      }
    }
  }
  
  // Table Header Row - bold, white font, dark blue background
  for (let i = 0; i < 9; i++) {
    const cell = XLSX.utils.encode_cell({ r: tableHeaderRow, c: i });
    dataSheet[cell] = dataSheet[cell] || { t: 's', v: '' };
    dataSheet[cell].s = {
      font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 11 },
      fill: { fgColor: { rgb: 'FF1F4E79' } },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
      alignment: { horizontal: i === 0 ? 'left' : 'right', vertical: 'center' }
    };
  }
  
  // User Data Rows - alternating shading, answer rate coloring, and borders with alignment
  sortedUsers.forEach((user, idx) => {
    const rowNum = tableHeaderRow + 1 + idx;
    const isEvenRow = idx % 2 === 0;
    const backgroundColor = isEvenRow ? 'FFFFFFFF' : 'FFFFF9FAFB';
    
    for (let i = 0; i < 9; i++) {
      const cell = XLSX.utils.encode_cell({ r: rowNum, c: i });
      dataSheet[cell] = dataSheet[cell] || { t: 's', v: '' };
      const baseStyle = {
        border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } },
        alignment: { horizontal: i === 0 ? 'left' : 'right', vertical: 'center' },
        font: { sz: 10 }
      };
      
      // Answer rate color coding (column 7, 0-indexed)
      if (i === 7) {
        baseStyle.fill = { fgColor: { rgb: getAnswerRateColor(user.answer_rate_percent) } };
      } else {
        baseStyle.fill = { fgColor: { rgb: backgroundColor } };
      }
      
      dataSheet[cell].s = baseStyle;
    }
  });
  
  // ===== COLUMN SIZING =====
  dataSheet['!cols'] = [
    { wch: 22 }, // User
    { wch: 14 }, // Total Calls
    { wch: 12 }, // Inbound
    { wch: 12 }, // Outbound
    { wch: 12 }, // Answered
    { wch: 12 }, // Missed
    { wch: 16 }, // Total Duration
    { wch: 15 }, // Answer Rate
    { wch: 16 }  // Average Duration
  ];
  
  // Apply data type formatting to columns
  for (let row = tableHeaderRow + 1; row < tableHeaderRow + 1 + sortedUsers.length; row++) {
    // Total Calls, Inbound, Outbound, Answered, Missed (columns 1-5) - number with comma separator
    for (let col = 1; col <= 5; col++) {
      const cell = XLSX.utils.encode_cell({ r: row, c: col });
      if (dataSheet[cell]) {
        dataSheet[cell].t = 'n'; // Number type
        dataSheet[cell].s = {
          ...(dataSheet[cell].s || {}),
          numFmt: '#,##0' // Comma separator
        };
      }
    }
    
    // Answer Rate column (column 7) - percentage format with 1 decimal place
    const answerRateCell = XLSX.utils.encode_cell({ r: row, c: 7 });
    if (dataSheet[answerRateCell]) {
      dataSheet[answerRateCell].t = 'n';
      dataSheet[answerRateCell].s = {
        ...(dataSheet[answerRateCell].s || {}),
        numFmt: '0.0"%"'
      };
    }
  }
  
  // Format duration columns (6 and 8) as hh:mm:ss time format
  for (let row = tableHeaderRow + 1; row < tableHeaderRow + 1 + sortedUsers.length; row++) {
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
  
  // Freeze header row and title section (freeze up to table header row + 1 row)
  dataSheet['!freeze'] = { xSplit: 0, ySplit: tableHeaderRow + 1 };
  
  XLSX.utils.book_append_sheet(workbook, dataSheet, sheetName);
  
  // Download the file
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}