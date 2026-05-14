import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import ExcelJS from 'npm:exceljs@4.4.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { monthlyData = [], weeklyData = [], monthlyOutboundData = [], weeklyOutboundData = [], frontendData = [], individualData = [], userDirectory = [], rawInbound = [], rawOutbound = [] } = body;

    const workbook = new ExcelJS.Workbook();
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

    // ===== SHEET 1: Monthly KPI Summary =====
    const monthlyWS = workbook.addWorksheet('Monthly KPI Summary');
    
    monthlyWS.addRow(['Call Log Performance Report – May 2026']);
    monthlyWS.addRow([`Generated on: ${today}`]);
    monthlyWS.addRow([]);
    monthlyWS.addRow(['Monthly KPI Summary']);
    
    if (monthlyData && monthlyData.length > 0) {
      const latestMonth = monthlyData[monthlyData.length - 1];
      const latestOutbound = monthlyOutboundData?.find(o => o.month === latestMonth.month);
      
      const connectedOutbound = latestOutbound?.connected_outbound || 0;
      const outboundRate = latestMonth.total_outbound === 0 ? 0 : Math.min(connectedOutbound / latestMonth.total_outbound, 1.0);
      const totalAnswered = (latestMonth.total_answered || 0) + connectedOutbound;
      const totalCalls = (latestMonth.total_inbound || 0) + (latestMonth.total_outbound || 0);
      const overallRate = totalCalls === 0 ? 0 : Math.min(totalAnswered / totalCalls, 1.0);

      monthlyWS.addRow(['Total Calls', (latestMonth.total_inbound || 0) + (latestMonth.total_outbound || 0)]);
      monthlyWS.addRow(['Inbound', latestMonth.total_inbound || 0]);
      monthlyWS.addRow(['Outbound', latestMonth.total_outbound || 0]);
      monthlyWS.addRow(['Answered', latestMonth.total_answered || 0]);
      monthlyWS.addRow(['Missed', latestMonth.total_missed || 0]);
      monthlyWS.addRow(['Inbound Answer Rate', latestMonth.answer_rate || 0]);
      monthlyWS.addRow(['Outbound Contact Rate', outboundRate]);
      monthlyWS.addRow(['Overall Contact Rate', overallRate]);
    }

    monthlyWS.addRow([]);
    monthlyWS.addRow(['Weekly Roll-Up']);
    
    monthlyWS.addRow(['Week', 'Inbound', 'Answered', 'Missed', 'Outbound', 'Outbound Connected (≥30s)', 'Inbound Answer Rate', 'Outbound Contact Rate', 'Overall Contact Rate']);

    if (weeklyData && weeklyData.length > 0) {
      weeklyData.forEach((row) => {
        const outboundOutbound = weeklyOutboundData?.find(o => o.week_start === row.week_start);
        const outboundConnected = outboundOutbound?.connected_outbound || 0;
        const outboundRate = row.total_outbound === 0 ? 0 : Math.min(outboundConnected / row.total_outbound, 1.0);
        const totalAnswered = (row.total_answered || 0) + outboundConnected;
        const totalCalls = (row.total_inbound || 0) + (row.total_outbound || 0);
        const overallRate = totalCalls === 0 ? 0 : Math.min(totalAnswered / totalCalls, 1.0);

        monthlyWS.addRow([
          row.week_start || '',
          row.total_inbound || 0,
          row.total_answered || 0,
          row.total_missed || 0,
          row.total_outbound || 0,
          outboundConnected,
          row.answer_rate || 0,
          outboundRate,
          overallRate
        ]);
      });
    }

    monthlyWS.columns = [
      { width: 30 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 }
    ];

    // ===== SHEET 2: Weekly Summary =====
    const weeklyWS = workbook.addWorksheet('Weekly Summary');
    weeklyWS.addRow(['Weekly Summary – May 2026']);
    weeklyWS.addRow([`Generated on: ${today}`]);
    weeklyWS.addRow([]);
    weeklyWS.addRow(['Week', 'Inbound', 'Answered', 'Missed', 'Inbound Answer Rate', 'Outbound', 'Outbound Connected (≥30s)', 'Outbound Contact Rate', 'Overall Contact Rate']);

    if (weeklyData && weeklyData.length > 0) {
      weeklyData.forEach((row) => {
        const outboundOutbound = weeklyOutboundData?.find(o => o.week_start === row.week_start);
        const outboundConnected = outboundOutbound?.connected_outbound || 0;
        const outboundRate = row.total_outbound === 0 ? 0 : Math.min(outboundConnected / row.total_outbound, 1.0);
        const totalAnswered = (row.total_answered || 0) + outboundConnected;
        const totalCalls = (row.total_inbound || 0) + (row.total_outbound || 0);
        const overallRate = totalCalls === 0 ? 0 : Math.min(totalAnswered / totalCalls, 1.0);

        weeklyWS.addRow([
          row.week_start || '',
          row.total_inbound || 0,
          row.total_answered || 0,
          row.total_missed || 0,
          row.answer_rate || 0,
          row.total_outbound || 0,
          outboundConnected,
          outboundRate,
          overallRate
        ]);
      });
    }

    weeklyWS.columns = [
      { width: 15 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 15 },
      { width: 12 },
      { width: 18 },
      { width: 18 },
      { width: 18 }
    ];

    // ===== SHEET 3: Individual Performance =====
    const indivWS = workbook.addWorksheet('Individual Performance');
    indivWS.addRow(['Individual Performance – May 2026']);
    indivWS.addRow([`Generated on: ${today}`]);
    indivWS.addRow([]);
    indivWS.addRow(['User', 'Inbound', 'Answered', 'Missed', 'Inbound Answer Rate', 'Outbound Attempts', 'Outbound Connected (≥30s)', 'Outbound Contact Rate', 'Overall Contact Rate', 'Avg Duration (Minutes)']);

    if (individualData && individualData.length > 0) {
      individualData.forEach((row) => {
        indivWS.addRow([
          row.user_name || '',
          row.total_inbound || 0,
          row.total_answered || 0,
          row.total_missed || 0,
          row.answer_rate || 0,
          row.total_outbound || 0,
          row.outbound_connected || 0,
          row.outbound_contact_rate || 0,
          row.overall_contact_rate || 0,
          ((row.avg_duration_seconds || 0) / 60).toFixed(2)
        ]);
      });

      // Totals row
      const totalsInbound = individualData.reduce((sum, r) => sum + (r.total_inbound || 0), 0);
      const totalsAnswered = individualData.reduce((sum, r) => sum + (r.total_answered || 0), 0);
      const totalsMissed = individualData.reduce((sum, r) => sum + (r.total_missed || 0), 0);
      const totalsOutbound = individualData.reduce((sum, r) => sum + (r.total_outbound || 0), 0);
      const totalsOutboundConnected = individualData.reduce((sum, r) => sum + (r.outbound_connected || 0), 0);
      const totalDurationSeconds = individualData.reduce((sum, r) => sum + ((r.avg_duration_seconds || 0) * (r.total_inbound || 0)), 0);
      const totalInboundForDuration = individualData.reduce((sum, r) => sum + (r.total_inbound || 0), 0);

      const inboundAnswerRate = totalsInbound > 0 ? totalsAnswered / totalsInbound : 0;
      const outboundRate = totalsOutbound > 0 ? totalsOutboundConnected / totalsOutbound : 0;
      const totalAnswered = totalsAnswered + totalsOutboundConnected;
      const totalCalls = totalsInbound + totalsOutbound;
      const overallRate = totalCalls > 0 ? totalAnswered / totalCalls : 0;
      const avgDuration = totalInboundForDuration > 0 ? totalDurationSeconds / totalInboundForDuration / 60 : 0;

      indivWS.addRow([
        'TOTAL',
        totalsInbound,
        totalsAnswered,
        totalsMissed,
        inboundAnswerRate,
        totalsOutbound,
        totalsOutboundConnected,
        outboundRate,
        overallRate,
        avgDuration.toFixed(2)
      ]);
    }

    indivWS.columns = [
      { width: 25 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 15 },
      { width: 15 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 }
    ];

    // ===== SHEET 4: Front-End Performance =====
    const frontWS = workbook.addWorksheet('Front-End Performance');
    frontWS.addRow(['Front-End Performance (Front Desk Benchmark) – May 2026']);
    frontWS.addRow([`Generated on: ${today}`]);
    frontWS.addRow([]);
    frontWS.addRow(['User', 'Inbound', 'Answered', 'Missed', 'Inbound Answer Rate', 'Outbound Attempts', 'Outbound Connected (≥30s)', 'Outbound Contact Rate', 'Overall Contact Rate', 'Avg Duration (Minutes)']);

    if (frontendData && frontendData.length > 0) {
      frontendData.forEach((row) => {
        frontWS.addRow([
          row.user_name || '',
          row.total_inbound || 0,
          row.total_answered || 0,
          row.total_missed || 0,
          row.answer_rate || 0,
          row.total_outbound || 0,
          row.outbound_connected || 0,
          row.outbound_contact_rate || 0,
          row.overall_contact_rate || 0,
          ((row.avg_duration_seconds || 0) / 60).toFixed(2)
        ]);
      });

      // Totals row
      const totalsInbound = frontendData.reduce((sum, r) => sum + (r.total_inbound || 0), 0);
      const totalsAnswered = frontendData.reduce((sum, r) => sum + (r.total_answered || 0), 0);
      const totalsMissed = frontendData.reduce((sum, r) => sum + (r.total_missed || 0), 0);
      const totalsOutbound = frontendData.reduce((sum, r) => sum + (r.total_outbound || 0), 0);
      const totalsOutboundConnected = frontendData.reduce((sum, r) => sum + (r.outbound_connected || 0), 0);
      const totalDurationSeconds = frontendData.reduce((sum, r) => sum + ((r.avg_duration_seconds || 0) * (r.total_inbound || 0)), 0);
      const totalInboundForDuration = frontendData.reduce((sum, r) => sum + (r.total_inbound || 0), 0);

      const inboundAnswerRate = totalsInbound > 0 ? totalsAnswered / totalsInbound : 0;
      const outboundRate = totalsOutbound > 0 ? totalsOutboundConnected / totalsOutbound : 0;
      const totalAnswered = totalsAnswered + totalsOutboundConnected;
      const totalCalls = totalsInbound + totalsOutbound;
      const overallRate = totalCalls > 0 ? totalAnswered / totalCalls : 0;
      const avgDuration = totalInboundForDuration > 0 ? totalDurationSeconds / totalInboundForDuration / 60 : 0;

      frontWS.addRow([
        'TOTAL',
        totalsInbound,
        totalsAnswered,
        totalsMissed,
        inboundAnswerRate,
        totalsOutbound,
        totalsOutboundConnected,
        outboundRate,
        overallRate,
        avgDuration.toFixed(2)
      ]);
    }

    frontWS.columns = [
      { width: 25 },
      { width: 12 },
      { width: 12 },
      { width: 12 },
      { width: 15 },
      { width: 15 },
      { width: 18 },
      { width: 18 },
      { width: 18 },
      { width: 18 }
    ];

    // ===== SHEET 5: User Directory =====
    const dirWS = workbook.addWorksheet('User Directory');
    dirWS.addRow(['User Name', 'Extension(s)', 'Location', 'Benchmark Group', 'Include In Benchmark', 'Active']);

    if (userDirectory && userDirectory.length > 0) {
      userDirectory.forEach((row) => {
        dirWS.addRow([
          row.name || '',
          (row.extensions || []).join(', ') || '',
          row.location || '',
          row.benchmark_group || '',
          row.include_in_benchmark ? 'Yes' : 'No',
          row.active ? 'Yes' : 'No'
        ]);
      });
    }

    dirWS.columns = [
      { width: 25 },
      { width: 15 },
      { width: 15 },
      { width: 18 },
      { width: 18 },
      { width: 10 }
    ];

    // ===== SHEET 6: Raw Imported Data =====
    const rawWS = workbook.addWorksheet('Raw Imported Data');
    rawWS.addRow(['Call Date', 'Call Time', 'Extension', 'Caller/Dialed', 'Duration (sec)', 'Result/Disposition', 'Direction', 'Answered/Flag', 'Location']);

    if (rawInbound && rawInbound.length > 0) {
      rawInbound.forEach((row) => {
        rawWS.addRow([
          row.call_date || '',
          row.call_time || '',
          row.extension || '',
          row.caller_number || '',
          row.duration_seconds || 0,
          row.disposition || '',
          'Inbound',
          row.answered ? 'Yes' : 'No',
          ''
        ]);
      });
    }

    if (rawOutbound && rawOutbound.length > 0) {
      rawOutbound.forEach((row) => {
        rawWS.addRow([
          row.call_date || '',
          row.call_time || '',
          row.extension || '',
          row.dialed_number || '',
          row.duration_seconds || 0,
          row.result || '',
          'Outbound',
          row.result === 'answered' ? 'Yes' : 'No',
          row.location || ''
        ]);
      });
    }

    rawWS.columns = [
      { width: 12 },
      { width: 10 },
      { width: 12 },
      { width: 15 },
      { width: 15 },
      { width: 15 },
      { width: 10 },
      { width: 10 },
      { width: 15 }
    ];

    // Write to buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="CallLog_Report_${new Date().toISOString().split('T')[0]}.xlsx"`
      }
    });
  } catch (error) {
    console.error('Excel export error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});