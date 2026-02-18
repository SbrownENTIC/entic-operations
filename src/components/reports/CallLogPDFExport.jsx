import React from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const formatDuration = (seconds) => {
  if (!seconds) return "00:00:00";
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const getAnswerRateColor = (rate) => {
  if (rate >= 85) return 'bg-green-100 text-green-800';
  if (rate >= 70) return 'bg-yellow-100 text-yellow-800';
  return 'bg-red-100 text-red-800';
};

export async function generatePDFExport(summary, userBreakdown, reportTitle, startDate, endDate) {
  // Create a temporary div to render the report
  const tempDiv = document.createElement('div');
  tempDiv.style.position = 'absolute';
  tempDiv.style.left = '-9999px';
  tempDiv.style.width = '1200px';
  tempDiv.style.backgroundColor = 'white';
  tempDiv.style.padding = '40px';
  
  // Create HTML content
  tempDiv.innerHTML = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1f2937;">
      
      <!-- HEADER -->
      <div style="margin-bottom: 40px; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div>
            <h1 style="margin: 0 0 5px 0; font-size: 28px; font-weight: 700; color: #1f2937;">${reportTitle}</h1>
            <p style="margin: 0; font-size: 14px; color: #6b7280;">Ear, Nose & Throat Institute of CT</p>
          </div>
          <div style="text-align: right; font-size: 12px; color: #6b7280;">
            <p style="margin: 0;">Generated: ${new Date().toLocaleString()}</p>
            <p style="margin: 5px 0 0 0;">Period: ${startDate} – ${endDate}</p>
          </div>
        </div>
      </div>

      <!-- KPI SUMMARY CARDS -->
      <div style="margin-bottom: 40px;">
        <h2 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #1f2937;">Key Performance Indicators</h2>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px;">
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #f9fafb;">
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Total Calls</p>
            <p style="margin: 0; font-size: 32px; font-weight: 700; color: #1f2937;">${summary.total_calls}</p>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #f9fafb;">
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Inbound</p>
            <p style="margin: 0; font-size: 32px; font-weight: 700; color: #059669;">${summary.inbound_calls}</p>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #f9fafb;">
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Outbound</p>
            <p style="margin: 0; font-size: 32px; font-weight: 700; color: #7c3aed;">${summary.outbound_calls}</p>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #f9fafb;">
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Answered</p>
            <p style="margin: 0; font-size: 32px; font-weight: 700; color: #0369a1;">${summary.answered_calls}</p>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #f9fafb;">
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Missed</p>
            <p style="margin: 0; font-size: 32px; font-weight: 700; color: #dc2626;">${summary.missed_calls}</p>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #f9fafb;">
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Answer Rate</p>
            <p style="margin: 0; font-size: 32px; font-weight: 700; color: #1f2937;">${(summary.answer_rate_percent || 0).toFixed(1)}%</p>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #f9fafb;">
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Total Duration</p>
            <p style="margin: 0; font-size: 24px; font-weight: 700; color: #1f2937; font-family: monospace;">${formatDuration(summary.total_duration_seconds)}</p>
          </div>
          <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; background: #f9fafb;">
            <p style="margin: 0 0 10px 0; font-size: 12px; color: #6b7280; text-transform: uppercase; font-weight: 600;">Avg Duration</p>
            <p style="margin: 0; font-size: 24px; font-weight: 700; color: #1f2937; font-family: monospace;">${formatDuration(summary.avg_call_duration_seconds)}</p>
          </div>
        </div>
      </div>

      <!-- USER BREAKDOWN TABLE -->
      <div>
        <h2 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #1f2937;">User Breakdown</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f3f4f6; border-bottom: 2px solid #e5e7eb;">
              <th style="padding: 12px; text-align: left; font-weight: 600; color: #1f2937;">User</th>
              <th style="padding: 12px; text-align: right; font-weight: 600; color: #1f2937;">Total</th>
              <th style="padding: 12px; text-align: right; font-weight: 600; color: #1f2937;">Inbound</th>
              <th style="padding: 12px; text-align: right; font-weight: 600; color: #1f2937;">Outbound</th>
              <th style="padding: 12px; text-align: right; font-weight: 600; color: #1f2937;">Answered</th>
              <th style="padding: 12px; text-align: right; font-weight: 600; color: #1f2937;">Missed</th>
              <th style="padding: 12px; text-align: center; font-weight: 600; color: #1f2937;">Duration</th>
              <th style="padding: 12px; text-align: center; font-weight: 600; color: #1f2937;">Rate</th>
              <th style="padding: 12px; text-align: center; font-weight: 600; color: #1f2937;">Avg</th>
            </tr>
          </thead>
          <tbody>
            ${userBreakdown.map((user, idx) => `
              <tr style="border-bottom: 1px solid #e5e7eb; background: ${idx % 2 === 0 ? '#ffffff' : '#f9fafb'};">
                <td style="padding: 12px; color: #1f2937; font-weight: 500;">${user.user}</td>
                <td style="padding: 12px; text-align: right; color: #1f2937;">${user.total_calls}</td>
                <td style="padding: 12px; text-align: right; color: #059669;">${user.inbound_calls}</td>
                <td style="padding: 12px; text-align: right; color: #7c3aed;">${user.outbound_calls}</td>
                <td style="padding: 12px; text-align: right; color: #1f2937;">${user.answered_calls}</td>
                <td style="padding: 12px; text-align: right; color: #dc2626;">${user.missed_calls}</td>
                <td style="padding: 12px; text-align: center; font-family: monospace; font-size: 11px;">${formatDuration(user.total_duration_seconds)}</td>
                <td style="padding: 12px; text-align: center;">
                  <span style="padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; ${user.answer_rate_percent >= 85 ? 'background: #dcfce7; color: #166534;' : user.answer_rate_percent >= 70 ? 'background: #fef3c7; color: #92400e;' : 'background: #fee2e2; color: #991b1b;'}">
                    ${user.answer_rate_percent.toFixed(1)}%
                  </span>
                </td>
                <td style="padding: 12px; text-align: center; font-family: monospace; font-size: 11px;">${formatDuration(user.avg_call_duration_seconds)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.body.appendChild(tempDiv);

  try {
    // Convert HTML to canvas
    const canvas = await html2canvas(tempDiv, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    // Create PDF
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 10;

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= pageHeight - 20;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 20;
    }

    pdf.save(`${reportTitle}.pdf`);
  } finally {
    document.body.removeChild(tempDiv);
  }
}

export async function generateCSVExport(userBreakdown, reportTitle, startDate, endDate) {
  const lines = [
    [reportTitle],
    [`Reporting Period: ${startDate} – ${endDate}`],
    [`Generated: ${new Date().toLocaleString()}`],
    [],
    ['User', 'Total Calls', 'Inbound', 'Outbound', 'Answered', 'Missed', 'Duration (HH:MM:SS)', 'Answer Rate (%)', 'Avg Duration (HH:MM:SS)'],
    ...userBreakdown
      .filter(u => u.total_calls > 0)
      .sort((a, b) => b.total_calls - a.total_calls)
      .map(u => [
        u.user,
        u.total_calls,
        u.inbound_calls,
        u.outbound_calls,
        u.answered_calls,
        u.missed_calls,
        formatDuration(u.total_duration_seconds),
        u.answer_rate_percent.toFixed(1),
        formatDuration(u.avg_call_duration_seconds)
      ])
  ];

  const csv = lines.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${reportTitle}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}