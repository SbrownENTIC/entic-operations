import * as XLSX from 'xlsx';

const formatDuration = (seconds) => {
  if (!seconds) return "00:00:00";
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const getAnswerRateColor = (rate) => {
  if (rate >= 85) return 'FFD9D9D9'; // Green background
  if (rate >= 70) return 'FFFFFFE0'; // Yellow background
  return 'FFFFE0E0'; // Red background
};

export async function generateExcelExport(summary, userBreakdown, reportTitle, startDate, endDate, status) {
  const workbook = XLSX.utils.book_new();
  
  // ===== DATA SHEET =====
  // Use reportTitle directly; if status is Monthly, it already includes month/year
  // Otherwise build from dates
  let sheetName = 'Call Log';
  let fileName = reportTitle;
  
  if (status === 'Monthly') {
    // Extract month/year from reportTitle (e.g., "December 2025 - Call Log")
    const monthYear = reportTitle.replace(' - Call Log', '');
    sheetName = monthYear;
    fileName = `${monthYear} - Call Log`;
  } else {
    // Weekly or Custom Range
    fileName = 'Call Log';
  }
  
  const ws_data = [];
  
  let rowIndex = 0;
  
  // Row 1: Title
  ws_data[rowIndex] = [reportTitle];
  rowIndex++;
  
  // Row 2: Reporting Period (convert YYYY-MM-DD to MM/DD/YYYY)
  const startFormatted = startDate.split('-').reverse().join('/');
  const endFormatted = endDate.split('-').reverse().join('/');
  ws_data[rowIndex] = [`Reporting Period: ${startFormatted} – ${endFormatted}`];
  rowIndex++;
  
  // Row 3: Generated On
  ws_data[rowIndex] = [`Generated On: ${new Date().toLocaleString()}`];
  rowIndex++;
  
  // Blank row
  rowIndex++;
  
  // KPI Summary Section
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
  ws_data[rowIndex] = ['Answer Rate (%)', (summary.answer_rate_percent || 0).toFixed(1)];
  rowIndex++;
  ws_data[rowIndex] = ['Total Duration', formatDuration(summary.total_duration_seconds)];
  rowIndex++;
  ws_data[rowIndex] = ['Average Duration', formatDuration(summary.avg_call_duration_seconds)];
  rowIndex++;
  
  // Blank row
  rowIndex++;
  
  // User Breakdown Table Header
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
      user.answer_rate_percent.toFixed(1),
      formatDuration(user.avg_call_duration_seconds)
    ];
    rowIndex++;
  });
  
  // Convert to sheet
  const dataSheet = XLSX.utils.aoa_to_sheet(ws_data);
  
  // Apply formatting
  // Title - bold, larger font
  if (dataSheet['A1']) {
    dataSheet['A1'].s = { font: { bold: true, sz: 16 }, alignment: { horizontal: 'left', vertical: 'center' } };
  }
  
  // KPI Header - bold with gray background
  for (let i = 0; i < 2; i++) {
    const cell = XLSX.utils.encode_cell({ r: kpiHeaderRow, c: i });
    dataSheet[cell] = dataSheet[cell] || { t: 's', v: '' };
    dataSheet[cell].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'FFF3F4F6' } },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    };
  }
  
  // Table Header - bold with gray background
  for (let i = 0; i < 9; i++) {
    const cell = XLSX.utils.encode_cell({ r: tableHeaderRow, c: i });
    dataSheet[cell] = dataSheet[cell] || { t: 's', v: '' };
    dataSheet[cell].s = {
      font: { bold: true },
      fill: { fgColor: { rgb: 'FFF3F4F6' } },
      border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
    };
  }
  
  // User rows - alternating shading and answer rate coloring
  sortedUsers.forEach((user, idx) => {
    const rowNum = tableHeaderRow + 1 + idx;
    const isEvenRow = idx % 2 === 0;
    const backgroundColor = isEvenRow ? 'FFFFFFFF' : 'FFFFF9FAFB';
    
    for (let i = 0; i < 9; i++) {
      const cell = XLSX.utils.encode_cell({ r: rowNum, c: i });
      dataSheet[cell] = dataSheet[cell] || { t: 's', v: '' };
      const baseStyle = {
        fill: { fgColor: { rgb: backgroundColor } },
        border: { top: { style: 'thin' }, bottom: { style: 'thin' }, left: { style: 'thin' }, right: { style: 'thin' } }
      };
      
      // Answer rate color coding (column 7, 0-indexed)
      if (i === 7) {
        baseStyle.fill = { fgColor: { rgb: getAnswerRateColor(user.answer_rate_percent) } };
      }
      
      dataSheet[cell].s = baseStyle;
    }
  });
  
  // Set column widths
  dataSheet['!cols'] = [
    { wch: 20 }, // User
    { wch: 12 }, // Total Calls
    { wch: 10 }, // Inbound
    { wch: 10 }, // Outbound
    { wch: 10 }, // Answered
    { wch: 10 }, // Missed
    { wch: 15 }, // Total Duration
    { wch: 13 }, // Answer Rate
    { wch: 15 }  // Average Duration
  ];
  
  // Freeze header row
  dataSheet['!freeze'] = { xSplit: 0, ySplit: tableHeaderRow + 1 };
  
  XLSX.utils.book_append_sheet(workbook, dataSheet, sheetName);
  
  // Write file with correct filename
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}