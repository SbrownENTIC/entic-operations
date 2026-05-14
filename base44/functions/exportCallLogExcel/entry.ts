import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import XLSX from 'npm:xlsx@0.18.5';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { monthlyData = [], weeklyData = [], monthlyOutboundData = [], weeklyOutboundData = [], frontendData = [], individualData = [], userDirectory = [], rawInbound = [], rawOutbound = [] } = body;

    const workbook = XLSX.utils.book_new();
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' });

    // ===== SHEET 1: Monthly KPI Summary =====
    const monthlyWSData = [];
    
    monthlyWSData.push(['Call Log Performance Report – May 2026']);
    monthlyWSData.push([`Generated on: ${today}`]);
    monthlyWSData.push([]);
    monthlyWSData.push(['Monthly KPI Summary']);
    
    // KPI rows
    const kpiStartRow = monthlyWSData.length;
    if (monthlyData && monthlyData.length > 0) {
      const latestMonth = monthlyData[monthlyData.length - 1];
      const latestOutbound = monthlyOutboundData?.find(o => o.month === latestMonth.month);
      
      const connectedOutbound = latestOutbound?.connected_outbound || 0;
      const outboundRate = latestMonth.total_outbound === 0 ? 0 : Math.min(connectedOutbound / latestMonth.total_outbound, 1.0);
      const totalAnswered = (latestMonth.total_answered || 0) + connectedOutbound;
      const totalCalls = (latestMonth.total_inbound || 0) + (latestMonth.total_outbound || 0);
      const overallRate = totalCalls === 0 ? 0 : Math.min(totalAnswered / totalCalls, 1.0);

      monthlyWSData.push(['Total Calls', (latestMonth.total_inbound || 0) + (latestMonth.total_outbound || 0)]);
      monthlyWSData.push(['Inbound', latestMonth.total_inbound || 0]);
      monthlyWSData.push(['Outbound', latestMonth.total_outbound || 0]);
      monthlyWSData.push(['Answered', latestMonth.total_answered || 0]);
      monthlyWSData.push(['Missed', latestMonth.total_missed || 0]);
      monthlyWSData.push(['Inbound Answer Rate', latestMonth.answer_rate || 0]);
      monthlyWSData.push(['Outbound Contact Rate', outboundRate]);
      monthlyWSData.push(['Overall Contact Rate', overallRate]);
    }

    monthlyWSData.push([]);
    monthlyWSData.push([]);
    monthlyWSData.push(['Weekly Roll-Up']);
    
    const weeklyTableHeaderRow = monthlyWSData.length;
    monthlyWSData.push(['Week', 'Inbound', 'Answered', 'Missed', 'Outbound', 'Outbound Connected (≥30s)', 'Inbound Answer Rate', 'Outbound Contact Rate', 'Overall Contact Rate']);

    if (weeklyData && weeklyData.length > 0) {
      weeklyData.forEach((row) => {
        const outboundOutbound = weeklyOutboundData?.find(o => o.week_start === row.week_start);
        const outboundConnected = outboundOutbound?.connected_outbound || 0;
        const outboundRate = row.total_outbound === 0 ? 0 : Math.min(outboundConnected / row.total_outbound, 1.0);
        const totalAnswered = (row.total_answered || 0) + outboundConnected;
        const totalCalls = (row.total_inbound || 0) + (row.total_outbound || 0);
        const overallRate = totalCalls === 0 ? 0 : Math.min(totalAnswered / totalCalls, 1.0);

        monthlyWSData.push([
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

    const monthlyWS = XLSX.utils.aoa_to_sheet(monthlyWSData);
    monthlyWS['!cols'] = [{ wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(workbook, monthlyWS, 'Monthly KPI Summary');

    // ===== SHEET 2: Weekly Summary =====
    const weeklyWSData = [];
    weeklyWSData.push(['Weekly Summary – May 2026']);
    weeklyWSData.push([`Generated on: ${today}`]);
    weeklyWSData.push([]);
    weeklyWSData.push(['Week', 'Inbound', 'Answered', 'Missed', 'Inbound Answer Rate', 'Outbound', 'Outbound Connected (≥30s)', 'Outbound Contact Rate', 'Overall Contact Rate']);

    if (weeklyData && weeklyData.length > 0) {
      weeklyData.forEach((row) => {
        const outboundOutbound = weeklyOutboundData?.find(o => o.week_start === row.week_start);
        const outboundConnected = outboundOutbound?.connected_outbound || 0;
        const outboundRate = row.total_outbound === 0 ? 0 : Math.min(outboundConnected / row.total_outbound, 1.0);
        const totalAnswered = (row.total_answered || 0) + outboundConnected;
        const totalCalls = (row.total_inbound || 0) + (row.total_outbound || 0);
        const overallRate = totalCalls === 0 ? 0 : Math.min(totalAnswered / totalCalls, 1.0);

        weeklyWSData.push([
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

    const weeklyWS = XLSX.utils.aoa_to_sheet(weeklyWSData);
    weeklyWS['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(workbook, weeklyWS, 'Weekly Summary');

    // ===== SHEET 3: Individual Performance =====
    const indivWSData = [];
    indivWSData.push(['Individual Performance – May 2026']);
    indivWSData.push([`Generated on: ${today}`]);
    indivWSData.push([]);
    indivWSData.push(['User', 'Inbound', 'Answered', 'Missed', 'Inbound Answer Rate', 'Outbound Attempts', 'Outbound Connected (≥30s)', 'Outbound Contact Rate', 'Overall Contact Rate', 'Avg Duration (Minutes)']);

    if (individualData && individualData.length > 0) {
      individualData.forEach((row) => {
        indivWSData.push([
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

      indivWSData.push([
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

    const indivWS = XLSX.utils.aoa_to_sheet(indivWSData);
    indivWS['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(workbook, indivWS, 'Individual Performance');

    // ===== SHEET 4: Front-End Performance =====
    const frontWSData = [];
    frontWSData.push(['Front-End Performance (Front Desk Benchmark) – May 2026']);
    frontWSData.push([`Generated on: ${today}`]);
    frontWSData.push([]);
    frontWSData.push(['User', 'Inbound', 'Answered', 'Missed', 'Inbound Answer Rate', 'Outbound Attempts', 'Outbound Connected (≥30s)', 'Outbound Contact Rate', 'Overall Contact Rate', 'Avg Duration (Minutes)']);

    if (frontendData && frontendData.length > 0) {
      frontendData.forEach((row) => {
        frontWSData.push([
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

      frontWSData.push([
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

    const frontWS = XLSX.utils.aoa_to_sheet(frontWSData);
    frontWS['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(workbook, frontWS, 'Front-End Performance');

    // ===== SHEET 5: User Directory =====
    const dirWSData = [];
    dirWSData.push(['User Name', 'Extension(s)', 'Location', 'Benchmark Group', 'Include In Benchmark', 'Active']);

    if (userDirectory && userDirectory.length > 0) {
      userDirectory.forEach((row) => {
        dirWSData.push([
          row.name || '',
          (row.extensions || []).join(', ') || '',
          row.location || '',
          row.benchmark_group || '',
          row.include_in_benchmark ? 'Yes' : 'No',
          row.active ? 'Yes' : 'No'
        ]);
      });
    }

    const dirWS = XLSX.utils.aoa_to_sheet(dirWSData);
    dirWS['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }, { wch: 18 }, { wch: 18 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(workbook, dirWS, 'User Directory');

    // ===== SHEET 6: Raw Imported Data =====
    const rawWSData = [];
    rawWSData.push(['Call Date', 'Call Time', 'Extension', 'Caller/Dialed', 'Duration (sec)', 'Result/Disposition', 'Direction', 'Answered/Flag', 'Location']);

    if (rawInbound && rawInbound.length > 0) {
      rawInbound.forEach((row) => {
        rawWSData.push([
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
        rawWSData.push([
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

    const rawWS = XLSX.utils.aoa_to_sheet(rawWSData);
    rawWS['!cols'] = [{ wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 15 }];
    XLSX.utils.book_append_sheet(workbook, rawWS, 'Raw Imported Data');

    // Generate buffer using XLSX.write() - proper Deno conversion
    const arr = XLSX.write(workbook, {
      type: 'array',
      bookType: 'xlsx'
    });

    // Convert array of bytes to Uint8Array properly
    const uint8 = new Uint8Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      uint8[i] = arr[i];
    }

    return new Response(uint8, {
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