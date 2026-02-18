import * as XLSX from 'xlsx';

const formatDuration = (seconds) => {
  if (!seconds) return "00:00:00";
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatDateForDisplay = (dateStr) => {
  const [y, m, d] = dateStr.split('-');
  return `${m}/${d}/${y}`;
};

export async function generateExcelExport(summary, userBreakdown, reportTitle, startDate, endDate, status) {
  const workbook = XLSX.utils.book_new();
  
  // Sheet naming
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
  }
  
  const ws_data = [];
  let rowIndex = 0;
  
  // ===== HEADER SECTION =====
  // Row 1: Title (merged)
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
  
  // Blank row for spacing
  rowIndex++;
  
  // ===== METRICS SECTION (Card Style) =====
  const metricsStartRow = rowIndex;
  
  // Metrics headers (hidden but needed for structure)
  ws_data[rowIndex] = ['Metric', 'Value'];
  const metricsHeaderRow = rowIndex;
  rowIndex++;
  
  const metricsData = [
    ['Total Calls', summary.total_calls],
    ['Inbound Calls', summary.inbound_calls],
    ['Outbound Calls', summary.outbound_calls],
    ['Answered Calls', summary.answered_calls],
    ['Missed Calls', summary.missed_calls],
    ['Answer Rate', (summary.answer_rate_percent || 0)],
    ['Total Duration', formatDuration(summary.total_duration_seconds)],
    ['Average Duration', formatDuration(summary.avg_call_duration_seconds)]
  ];
  
  metricsData.forEach(metric => {
    ws_data[rowIndex] = metric;
    rowIndex++;
  });
  
  const metricsEndRow = rowIndex - 1;
  
  // Blank row
  rowIndex++;
  
  // ===== DATA TABLE =====
  const tableHeaderRow = rowIndex;
  ws_data[rowIndex] = [
    'User',
    'Total Calls',
    'Inbound',
    'Outbound',
    'Answered',
    'Missed',
    'Total Duration',
    'Answer Rate %',
    'Average Duration'
  ];
  rowIndex++;
  
  // Filter & sort users
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
  const ws = XLSX.utils.aoa_to_sheet(ws_data);
  
  // ===== STYLING =====
  
  // Title: 18pt bold, white on dark navy
  const titleCell = XLSX.utils.encode_cell({ r: titleRow, c: 0 });
  if (!ws[titleCell]) ws[titleCell] = { t: 's', v: reportTitle };
  ws[titleCell].s = {
    font: { bold: true, sz: 18, color: { rgb: 'FFFFFFFF' } },
    fill: { fgColor: { rgb: 'FF1F4E79' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: { 
      bottom: { style: 'medium', color: { rgb: 'FF1F4E79' } }
    }
  };
  
  // Period: bold on light gray
  const periodCell = XLSX.utils.encode_cell({ r: periodRow, c: 0 });
  if (!ws[periodCell]) ws[periodCell] = { t: 's', v: `Reporting Period: ${startFormatted} – ${endFormatted}` };
  ws[periodCell].s = {
    font: { bold: true, sz: 11, color: { rgb: 'FF333333' } },
    fill: { fgColor: { rgb: 'FFF5F5F5' } },
    alignment: { horizontal: 'left', vertical: 'center' }
  };
  
  // Generated: subtle gray
  const generatedCell = XLSX.utils.encode_cell({ r: generatedRow, c: 0 });
  if (!ws[generatedCell]) ws[generatedCell] = { t: 's', v: `Generated On: ${timestamp}` };
  ws[generatedCell].s = {
    font: { sz: 10, color: { rgb: 'FF666666' } },
    alignment: { horizontal: 'left', vertical: 'center' }
  };
  
  // ===== METRICS CARD STYLING =====
  const metricsLightGray = 'FFFAFBFC';
  const metricsBorder = { style: 'thin', color: { rgb: 'FFD0D0D0' } };
  
  // Metrics header row (hidden label row, styled as card top)
  const metricsHeaderMetricCell = XLSX.utils.encode_cell({ r: metricsHeaderRow, c: 0 });
  const metricsHeaderValueCell = XLSX.utils.encode_cell({ r: metricsHeaderRow, c: 1 });
  
  if (!ws[metricsHeaderMetricCell]) ws[metricsHeaderMetricCell] = { t: 's', v: 'Metric' };
  if (!ws[metricsHeaderValueCell]) ws[metricsHeaderValueCell] = { t: 's', v: 'Value' };
  
  // Don't show header text, but style it
  ws[metricsHeaderMetricCell].s = {
    fill: { fgColor: { rgb: metricsLightGray } },
    border: { 
      top: metricsBorder,
      left: metricsBorder,
      right: { style: 'thin', color: { rgb: 'FFD0D0D0' } }
    },
    alignment: { horizontal: 'left', vertical: 'center' }
  };
  
  ws[metricsHeaderValueCell].s = {
    fill: { fgColor: { rgb: metricsLightGray } },
    border: { 
      top: metricsBorder,
      right: metricsBorder
    },
    alignment: { horizontal: 'right', vertical: 'center' }
  };
  
  // Metrics data rows (card body)
  for (let r = metricsHeaderRow + 1; r <= metricsEndRow; r++) {
    const metricCell = XLSX.utils.encode_cell({ r, c: 0 });
    const valueCell = XLSX.utils.encode_cell({ r, c: 1 });
    
    if (!ws[metricCell]) ws[metricCell] = { t: 's', v: '' };
    if (!ws[valueCell]) ws[valueCell] = { t: 's', v: '' };
    
    const isLastRow = r === metricsEndRow;
    
    ws[metricCell].s = {
      font: { bold: true, sz: 11, color: { rgb: 'FF555555' } },
      fill: { fgColor: { rgb: metricsLightGray } },
      border: {
        left: metricsBorder,
        right: { style: 'thin', color: { rgb: 'FFD0D0D0' } },
        bottom: isLastRow ? metricsBorder : { style: 'thin', color: { rgb: 'FFEFEFEF' } }
      },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
    
    ws[valueCell].s = {
      font: { bold: false, sz: 13, color: { rgb: 'FF000000' } },
      fill: { fgColor: { rgb: metricsLightGray } },
      border: {
        right: metricsBorder,
        bottom: isLastRow ? metricsBorder : { style: 'thin', color: { rgb: 'FFEFEFEF' } }
      },
      alignment: { horizontal: 'right', vertical: 'center' }
    };
    
    // Number formatting
    const metricName = ws_data[r][0];
    if (metricName === 'Answer Rate') {
      ws[valueCell].z = '0.0"%"';
    } else if (['Total Calls', 'Inbound Calls', 'Outbound Calls', 'Answered Calls', 'Missed Calls'].includes(metricName)) {
      ws[valueCell].z = '#,##0';
    }
  }
  
  // ===== TABLE STYLING =====
  
  // Table header: white text on dark navy
  const tableHeaderStyle = {
    font: { bold: true, color: { rgb: 'FFFFFFFF' }, sz: 11 },
    fill: { fgColor: { rgb: 'FF1F4E79' } },
    border: {
      top: { style: 'thin', color: { rgb: 'FF1F4E79' } },
      bottom: { style: 'thin', color: { rgb: 'FF1F4E79' } },
      left: { style: 'thin', color: { rgb: 'FF1F4E79' } },
      right: { style: 'thin', color: { rgb: 'FF1F4E79' } }
    },
    alignment: { horizontal: 'center', vertical: 'center' }
  };
  
  for (let c = 0; c < 9; c++) {
    const cell = XLSX.utils.encode_cell({ r: tableHeaderRow, c });
    if (!ws[cell]) ws[cell] = { t: 's', v: '' };
    ws[cell].s = tableHeaderStyle;
  }
  
  // Table data rows: alternating shades
  sortedUsers.forEach((user, idx) => {
    const rowNum = tableDataStartRow + idx;
    const isEvenRow = idx % 2 === 0;
    const bgColor = isEvenRow ? 'FFFFFFFF' : 'FFFFF9FAFB';
    
    for (let c = 0; c < 9; c++) {
      const cell = XLSX.utils.encode_cell({ r: rowNum, c });
      if (!ws[cell]) ws[cell] = { t: c > 0 ? 'n' : 's', v: '' };
      
      ws[cell].s = {
        font: { sz: 10, color: { rgb: 'FF000000' } },
        fill: { fgColor: { rgb: bgColor } },
        border: {
          top: { style: 'thin', color: { rgb: 'FFE0E0E0' } },
          bottom: { style: 'thin', color: { rgb: 'FFE0E0E0' } },
          left: { style: 'thin', color: { rgb: 'FFE0E0E0' } },
          right: { style: 'thin', color: { rgb: 'FFE0E0E0' } }
        },
        alignment: { horizontal: c === 0 ? 'left' : 'right', vertical: 'center' }
      };
      
      // Number formatting
      if (c >= 1 && c <= 5) {
        ws[cell].z = '#,##0';
      } else if (c === 7) {
        ws[cell].z = '0.0';
      }
    }
  });
  
  // ===== COLUMN WIDTHS =====
  ws['!cols'] = [
    { wch: 28 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 }
  ];
  
  // ===== MERGE TITLE CELL =====
  ws['!merges'] = [
    { s: { r: titleRow, c: 0 }, e: { r: titleRow, c: 8 } }
  ];
  
  // ===== FREEZE PANES =====
  ws['!freeze'] = { xSplit: 0, ySplit: tableHeaderRow + 1 };
  
  // ===== PAGE SETUP - LANDSCAPE, FIT TO ONE PAGE =====
  ws['!pageSetup'] = {
    paperSize: 1,
    orientation: 'landscape',
    fitToPage: true,
    fitToHeight: 0,
    fitToWidth: 1
  };
  
  ws['!pageMargins'] = { left: 0.5, right: 0.5, top: 0.75, bottom: 0.75, header: 0.5, footer: 0.5 };
  
  // Hide gridlines
  ws['!sheetView'] = [{ showGridLines: false }];
  
  // Add auto filters to table header
  ws['!autoFilter'] = { ref: `A${tableHeaderRow + 1}:I${tableDataEndRow + 1}` };
  
  XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}