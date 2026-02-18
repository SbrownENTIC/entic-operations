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
  
  // ===== SHEET NAMING =====
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
  ws_data[rowIndex] = [reportTitle];
  const titleRow = rowIndex;
  rowIndex++;
  
  const startFormatted = formatDateForDisplay(startDate);
  const endFormatted = formatDateForDisplay(endDate);
  ws_data[rowIndex] = [`Reporting Period: ${startFormatted} – ${endFormatted}`];
  const periodRow = rowIndex;
  rowIndex++;
  
  const now = new Date();
  const timestamp = `${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  ws_data[rowIndex] = [`Generated On: ${timestamp}`];
  rowIndex++;
  
  // Blank row
  rowIndex++;
  
  // ===== KPI SUMMARY SECTION =====
  const kpiStartRow = rowIndex;
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
    'Answer Rate (%)',
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
  const titleCellRef = XLSX.utils.encode_cell({ r: titleRow, c: 0 });
  const periodCellRef = XLSX.utils.encode_cell({ r: periodRow, c: 0 });
  const generatedCellRef = XLSX.utils.encode_cell({ r: rowIndex - sortedUsers.length - 4, c: 0 });
  
  // Ensure cells exist
  if (!ws[titleCellRef]) ws[titleCellRef] = { t: 's', v: reportTitle };
  if (!ws[periodCellRef]) ws[periodCellRef] = { t: 's', v: `Reporting Period: ${startFormatted} – ${endFormatted}` };
  
  // Title: 18pt bold, dark blue, thick bottom border
  ws[titleCellRef].s = {
    font: { bold: true, sz: 18, color: { rgb: 'FF1F4E79' } },
    alignment: { horizontal: 'left', vertical: 'center' },
    border: { bottom: { style: 'medium', color: { rgb: 'FF1F4E79' } } }
  };
  
  // Period: bold label
  ws[periodCellRef].s = {
    font: { bold: true, sz: 11, color: { rgb: 'FF333333' } },
    alignment: { horizontal: 'left', vertical: 'center' }
  };
  
  // Generated: subtle gray
  ws[generatedCellRef].s = {
    font: { sz: 10, color: { rgb: 'FF666666' } },
    alignment: { horizontal: 'left', vertical: 'center' }
  };
  
  // KPI Header: white text on dark blue background
  const kpiMetricHeader = XLSX.utils.encode_cell({ r: kpiStartRow, c: 0 });
  const kpiValueHeader = XLSX.utils.encode_cell({ r: kpiStartRow, c: 1 });
  
  if (!ws[kpiMetricHeader]) ws[kpiMetricHeader] = { t: 's', v: 'Metric' };
  if (!ws[kpiValueHeader]) ws[kpiValueHeader] = { t: 's', v: 'Value' };
  
  const kpiHeaderStyle = {
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
  
  ws[kpiMetricHeader].s = kpiHeaderStyle;
  ws[kpiValueHeader].s = kpiHeaderStyle;
  
  // KPI Data rows: light gray value column, subtle borders
  for (let r = kpiStartRow + 1; r <= kpiEndRow; r++) {
    const metricCell = XLSX.utils.encode_cell({ r, c: 0 });
    const valueCell = XLSX.utils.encode_cell({ r, c: 1 });
    
    if (!ws[metricCell]) ws[metricCell] = { t: 's', v: '' };
    if (!ws[valueCell]) ws[valueCell] = { t: 's', v: '' };
    
    ws[metricCell].s = {
      font: { bold: true, sz: 11, color: { rgb: 'FF333333' } },
      fill: { fgColor: { rgb: 'FFFAFBFC' } },
      border: {
        top: { style: 'thin', color: { rgb: 'FFD3D3D3' } },
        bottom: { style: 'thin', color: { rgb: 'FFD3D3D3' } },
        left: { style: 'thin', color: { rgb: 'FFD3D3D3' } },
        right: { style: 'thin', color: { rgb: 'FFD3D3D3' } }
      },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
    
    ws[valueCell].s = {
      font: { bold: false, sz: 14, color: { rgb: 'FF000000' } },
      fill: { fgColor: { rgb: 'FFF2F2F2' } },
      border: {
        top: { style: 'thin', color: { rgb: 'FFD3D3D3' } },
        bottom: { style: 'thin', color: { rgb: 'FFD3D3D3' } },
        left: { style: 'thin', color: { rgb: 'FFD3D3D3' } },
        right: { style: 'thin', color: { rgb: 'FFD3D3D3' } }
      },
      alignment: { horizontal: 'right', vertical: 'center' }
    };
  }
  
  // TABLE HEADER: white text on dark blue
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
  
  // DATA ROWS: alternating shades with conditional answer rate coloring
  sortedUsers.forEach((user, idx) => {
    const rowNum = tableDataStartRow + idx;
    const isEvenRow = idx % 2 === 0;
    const bgColor = isEvenRow ? 'FFFFFFFF' : 'FFFFF9FAFB';
    
    for (let c = 0; c < 9; c++) {
      const cell = XLSX.utils.encode_cell({ r: rowNum, c });
      if (!ws[cell]) ws[cell] = { t: c > 0 ? 'n' : 's', v: '' };
      
      let cellBg = { fgColor: { rgb: bgColor } };
      
      // Conditional formatting for Answer Rate (column 7)
      if (c === 7) {
        const rate = user.answer_rate_percent || 0;
        if (rate >= 90) {
          cellBg = { fgColor: { rgb: 'FFE8F5E9' } };
        } else if (rate >= 70) {
          cellBg = { fgColor: { rgb: 'FFF9F5E9' } };
        } else {
          cellBg = { fgColor: { rgb: 'FFFFE9E9' } };
        }
      }
      
      ws[cell].s = {
        font: { sz: 10, color: { rgb: 'FF000000' } },
        fill: cellBg,
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
    { wch: 25 },
    { wch: 14 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 18 },
    { wch: 15 },
    { wch: 18 }
  ];
  
  // ===== MERGE TITLE CELL =====
  ws['!merges'] = [
    { s: { r: titleRow, c: 0 }, e: { r: titleRow, c: 8 } }
  ];
  
  // ===== FREEZE PANES & HIDE GRIDLINES =====
  ws['!freeze'] = { xSplit: 0, ySplit: tableHeaderRow + 1 };
  ws.pageSetupView = { gridLines: false, pageBreakPreview: false };
  
  // ===== PAGE SETUP =====
  ws['!print'] = {
    gridLines: false,
    headings: false
  };
  
  XLSX.utils.book_append_sheet(workbook, ws, sheetName);
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}