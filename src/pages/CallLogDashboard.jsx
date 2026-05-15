import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2, Download } from 'lucide-react';
import ExcelJS from 'exceljs';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useCallMetrics, formatPercent, KPICard } from '@/components/calllog/CallLogMetrics';
import { 
  aggregateInboundByWeek, 
  aggregateInboundByMonth, 
  aggregateByUser,
  aggregateOutboundByUser,
  aggregateOutboundByWeek,
  aggregateOutboundByMonth
} from '@/components/calllog/AggregationLogic';
import CallLogDetailModal from '@/components/calllog/CallLogDetailModal';
import WeeklyTable from '@/components/calllog/WeeklyTable';
import MonthlyTable from '@/components/calllog/MonthlyTable';
import IndividualPerformanceTable from '@/components/calllog/IndividualPerformanceTable';
import CDRUpload from '@/components/calllog/CDRUpload';
import UserDirectoryTable from '@/components/calllog/UserDirectoryTable';
import UnmappedExtensionsAlert from '@/components/calllog/UnmappedExtensionsAlert';

export default function CallLogDashboard() {
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [activeTab, setActiveTab] = useState('reporting');
  const queryClient = useQueryClient();

  // Fetch all data with proper pagination to avoid 5000 record limit
  const fetchAllRecords = async (entity) => {
    let allRows = [];
    let skip = 0;
    const batchSize = 5000;

    while (true) {
      const batch = await entity.filter({}, '-updated_date', batchSize, skip);
      
      if (!batch || batch.length === 0) break;

      allRows = allRows.concat(batch);
      skip += batchSize;

      // Safety break if batch is smaller than requested (indicates end of data)
      if (batch.length < batchSize) break;
    }

    return allRows;
  };

  const { data: inbound = [], isLoading: inboundLoading } = useQuery({
    queryKey: ['inbound-calls'],
    queryFn: () => fetchAllRecords(base44.entities.InboundCallRaw)
  });

  const { data: outbound = [], isLoading: outboundLoading } = useQuery({
    queryKey: ['outbound-calls'],
    queryFn: () => fetchAllRecords(base44.entities.OutboundCallRaw)
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.UserDirectory.list()
  });

  const isLoading = inboundLoading || outboundLoading || usersLoading;

  // Helper to normalize extension
  const normalizeExtension = (ext) => {
    if (!ext || typeof ext !== 'string') return '';
    return String(ext).trim().replace(/[\s\-\(\)]/g, '').replace(/\D/g, '');
  };

  // Build extension to user map from UserDirectory.extensions
  // Store both normalized and original formats for flexible lookups
  const extToUser = useMemo(() => {
    const map = {};
    users.forEach(user => {
      if (user.extensions && Array.isArray(user.extensions)) {
        user.extensions.forEach(ext => {
          // Store original
          map[ext] = user;
          // Also store normalized version for formatted extensions
          const normalized = normalizeExtension(ext);
          if (normalized && normalized !== ext) {
            map[normalized] = user;
          }
        });
      }
    });
    return map;
  }, [users]);

  const benchmarkUserIds = useMemo(() => {
    return new Set(users.filter(u => u.include_in_benchmark).map(u => u.id));
  }, [users]);

  // Calculate metrics
  const metrics = useCallMetrics(inbound, outbound, users);

  // Aggregate data
  const weeklyData = useMemo(() => {
    return aggregateInboundByWeek(inbound, extToUser, benchmarkUserIds);
  }, [inbound, extToUser, benchmarkUserIds]);

  const monthlyData = useMemo(() => {
    return aggregateInboundByMonth(inbound, extToUser, benchmarkUserIds);
  }, [inbound, extToUser, benchmarkUserIds]);

  const weeklyOutboundData = useMemo(() => {
    return aggregateOutboundByWeek(outbound, extToUser, benchmarkUserIds);
  }, [outbound, extToUser, benchmarkUserIds]);

  const monthlyOutboundData = useMemo(() => {
    return aggregateOutboundByMonth(outbound, extToUser, benchmarkUserIds);
  }, [outbound, extToUser, benchmarkUserIds]);

  const individualData = useMemo(() => {
    const inboundByUser = aggregateByUser(inbound, extToUser, users);
    const outboundByUser = aggregateOutboundByUser(outbound, extToUser, users);
    
    // Build a map of answered outbound by user (for overall contact rate calculation)
    const answeredOutboundByUser = {};
    outbound.forEach(call => {
      const normalizedExt = call.extension?.trim().replace(/[\s\-\(\)]/g, '').replace(/\D/g, '') || '';
      const user = extToUser[normalizedExt] || extToUser[call.extension];
      if (!user) return;
      
      if (!answeredOutboundByUser[user.id]) {
        answeredOutboundByUser[user.id] = 0;
      }
      if (call.result === 'answered') {
        answeredOutboundByUser[user.id]++;
      }
    });
    
    // Merge inbound and outbound data with combined metrics
    const merged = {};
    inboundByUser.forEach(u => {
      merged[u.user_id] = { ...u };
    });
    outboundByUser.forEach(u => {
      if (merged[u.user_id]) {
        merged[u.user_id] = {
          ...merged[u.user_id],
          total_outbound: u.total_outbound,
          outbound_connected: u.outbound_connected,
          outbound_contact_rate: u.outbound_contact_rate,
          avg_duration_seconds: u.avg_duration_seconds
        };
      } else {
        merged[u.user_id] = {
          ...u,
          total_inbound: 0,
          total_answered: 0,
          answer_rate: 0,
          avg_duration_seconds: 0
        };
      }
    });
    
    // Calculate overall contact rate: (answered inbound + ALL answered outbound) / (total inbound + total outbound)
    return Object.values(merged).map(user => {
      const totalCalls = user.total_inbound + user.total_outbound;
      const allAnsweredOutbound = answeredOutboundByUser[user.user_id] || 0;
      const totalContacted = user.total_answered + allAnsweredOutbound;
      return {
        ...user,
        overall_contact_rate: totalCalls > 0 ? Math.min(totalContacted / totalCalls, 1.0) : 0
      };
    });
  }, [inbound, outbound, extToUser, users]);

  const frontendData = useMemo(() => {
    return individualData.filter(u => u.benchmark_group === 'Front Desk' && u.include_in_benchmark);
  }, [individualData]);

  // Build filtered datasets for KPI detail modals
  const buildDetailData = (filterType) => {
    const benchmarkUserIds = new Set(users.filter(u => u.include_in_benchmark).map(u => u.id));
    const frontDeskUserIds = new Set(users.filter(u => u.benchmark_group === 'Front Desk' && u.include_in_benchmark).map(u => u.id));
    const extToUserMap = {};
    users.forEach(user => {
      if (user.extensions && Array.isArray(user.extensions)) {
        user.extensions.forEach(ext => {
          extToUserMap[ext] = user;
        });
      }
    });

    let filteredData = [];
    let title = '';

    switch(filterType) {
      case 'total':
        filteredData = [...inbound, ...outbound];
        title = 'All Calls';
        break;
      case 'inbound':
        filteredData = [...inbound];
        title = 'Inbound Calls';
        break;
      case 'outbound':
        filteredData = [...outbound];
        title = 'Outbound Calls';
        break;
      case 'answered':
        filteredData = inbound.filter(c => c.answered);
        title = 'Answered Calls';
        break;
      case 'missed':
        filteredData = inbound.filter(c => c.missed);
        title = 'Missed Calls';
        break;
      case 'outbound-connected':
        filteredData = outbound.filter(c => c.result === 'answered' && (c.duration_seconds || 0) >= 30);
        title = 'Outbound Connected Calls (≥30s)';
        break;
      case 'overall-contacted':
        filteredData = [
          ...inbound.filter(c => c.answered),
          ...outbound.filter(c => c.result === 'answered')
        ];
        title = 'All Answered Inbound + Answered Outbound';
        break;
      case 'benchmark-inbound':
        filteredData = inbound.filter(c => {
          const user = extToUserMap[c.extension];
          return user && benchmarkUserIds.has(user.id);
        });
        title = 'Inbound Calls (Benchmark Users)';
        break;
      case 'frontend-inbound':
        filteredData = inbound.filter(c => {
          const user = extToUserMap[c.extension];
          return user && frontDeskUserIds.has(user.id);
        });
        title = 'Inbound Calls (Front Desk)';
        break;
      default:
        filteredData = [];
        title = 'Call Records';
    }

    return { type: filterType, title, data: filteredData };
  };

  // Handle Excel export
  const handleExportExcel = async () => {
    try {
      // Color constants
      const HEADER_BG = "FF1F3864";
      const WHITE = "FFFFFFFF";
      const KPI_BG = "FFF2F2F2";
      const ALT_ROW = "FFF7F9FC";
      const TOTAL_BG = "FFD9E1F2";
      const GREEN = "FFC6EFCE";
      const YELLOW = "FFFFEB9C";
      const RED = "FFFFC7CE";
      const baseFont = { name: "Calibri", size: 11 };

      // Calculate metrics
      let totalInbound = 0, totalOutbound = 0, totalAnswered = 0, totalMissed = 0;
      let totalOutboundConnected = 0, totalFrontEndInbound = 0, totalFrontEndAnswered = 0;

      if (monthlyData && monthlyData.length > 0) {
        const latest = monthlyData[monthlyData.length - 1];
        totalInbound = latest.total_inbound || 0;
        totalAnswered = latest.total_answered || 0;
        totalMissed = latest.total_missed || 0;
      }

      if (monthlyOutboundData && monthlyOutboundData.length > 0) {
        const latest = monthlyOutboundData[monthlyOutboundData.length - 1];
        totalOutbound = latest.total_outbound || 0;
        totalOutboundConnected = latest.connected_outbound || 0;
      }

      if (frontendData && frontendData.length > 0) {
        totalFrontEndInbound = frontendData.reduce((sum, u) => sum + (u.total_inbound || 0), 0);
        totalFrontEndAnswered = frontendData.reduce((sum, u) => sum + (u.total_answered || 0), 0);
      }

      const totalCalls = totalInbound + totalOutbound;
      const inboundRate = totalInbound > 0 ? totalAnswered / totalInbound : 0;
      const frontEndRate = totalFrontEndInbound > 0 ? totalFrontEndAnswered / totalFrontEndInbound : 0;
      const outboundContactRate = totalOutbound > 0 ? totalOutboundConnected / totalOutbound : 0;
      const totalContacted = totalAnswered + totalOutboundConnected;
      const overallContactRate = totalCalls > 0 ? totalContacted / totalCalls : 0;

      // Create workbook
      const wb = new ExcelJS.Workbook();
      wb.creator = "ENTIC Operations Center";
      wb.created = new Date();

      // Helper to apply header styling
      const applyHeaderStyle = (cell) => {
        cell.font = { ...baseFont, bold: true, color: { argb: WHITE } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border = { bottom: { style: "medium" } };
      };

      // Helper to auto-fit columns
      const autoFitColumns = (worksheet) => {
        worksheet.columns.forEach(col => {
          let maxLength = 12;
          col.eachCell({ includeEmpty: true }, cell => {
            maxLength = Math.max(maxLength, cell.value ? cell.value.toString().length : 0);
          });
          col.width = Math.min(maxLength + 2, 40);
        });
      };

      // ===== SHEET 1: EXECUTIVE SUMMARY =====
      const summary = wb.addWorksheet("Executive Summary");
      summary.properties.tabColor = { argb: "FF1F3864" };
      summary.columns = [{ width: 28 }, { width: 20 }];

      // Title
      summary.mergeCells("A1:B1");
      const titleCell = summary.getCell("A1");
      titleCell.value = "Call Log Executive Summary";
      titleCell.font = { name: "Calibri", size: 18, bold: true };
      titleCell.alignment = { horizontal: "center" };
      summary.getRow(1).height = 36;

      summary.addRow([]);

      // KPI rows
      const kpiRows = [
        ["Total Calls", totalCalls],
        ["Inbound", totalInbound],
        ["Outbound", totalOutbound],
        ["Answered", totalAnswered],
        ["Missed", totalMissed]
      ];

      kpiRows.forEach(([label, value]) => {
        const row = summary.addRow([label, value]);
        row.getCell(1).font = { ...baseFont, bold: true };
        row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: KPI_BG } };
        row.getCell(2).alignment = { horizontal: "right" };
      });

      summary.addRow([]);

      const metricRows = [
        ["Inbound Answer Rate", inboundRate],
        ["Front-End Answer Rate", frontEndRate],
        ["Outbound Contact Rate (30s+)", outboundContactRate],
        ["Overall Contact Rate", overallContactRate]
      ];

      metricRows.forEach(([label, value], idx) => {
        const rowNum = 9 + idx;
        const row = summary.addRow([label, value]);
        row.getCell(1).font = { ...baseFont, bold: true };
        row.getCell(2).numFmt = "0.00%";
        row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: KPI_BG } };
        row.getCell(2).alignment = { horizontal: "right" };
      });

      // Border around KPI block
      for (let i = 3; i <= 12; i++) {
        summary.getCell(`A${i}`).border = { left: { style: "thin" } };
        summary.getCell(`B${i}`).border = { right: { style: "thin" } };
      }
      for (let j = 1; j <= 2; j++) {
        summary.getCell(3, j).border = { ...(summary.getCell(3, j).border || {}), top: { style: "thin" } };
        summary.getCell(12, j).border = { ...(summary.getCell(12, j).border || {}), bottom: { style: "thin" } };
      }

      summary.views = [{ state: "frozen", ySplit: 3 }];
      autoFitColumns(summary);

      // ===== SHEET 2: WEEKLY SUMMARY =====
      const weekly = wb.addWorksheet("Weekly Summary");
      weekly.properties.tabColor = { argb: "FF00B0F0" };
      weekly.columns = [
        { header: "Week Starting", key: "week", width: 15 },
        { header: "Total Inbound", key: "inbound", width: 15 },
        { header: "Answered", key: "answered", width: 15 },
        { header: "Missed", key: "missed", width: 15 },
        { header: "Answer Rate", key: "rate", width: 15 }
      ];

      // Apply header styling
      weekly.getRow(1).eachCell((cell) => {
        applyHeaderStyle(cell);
      });

      let weeklyRowCount = 1;
      if (weeklyData && weeklyData.length > 0) {
        weeklyData.forEach((w, idx) => {
          const row = weekly.addRow({
            week: w.week_start || "",
            inbound: w.total_inbound || 0,
            answered: w.total_answered || 0,
            missed: w.total_missed || 0,
            rate: w.answer_rate || 0
          });

          // Alternating row shading
          if ((idx + 1) % 2 === 0) {
            row.eachCell((cell) => {
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ALT_ROW } };
            });
          }

          // Right align numeric columns
          row.getCell(2).alignment = { horizontal: "right" };
          row.getCell(3).alignment = { horizontal: "right" };
          row.getCell(4).alignment = { horizontal: "right" };
          row.getCell(5).numFmt = "0.00%";
          row.getCell(5).alignment = { horizontal: "right" };

          weeklyRowCount++;
        });
      }

      weekly.autoFilter = { from: "A1", to: `E${weekly.rowCount}` };
      weekly.views = [{ state: "frozen", ySplit: 1 }];
      autoFitColumns(weekly);

      // ===== SHEET 3: FRONT-END PERFORMANCE =====
      const frontEnd = wb.addWorksheet("Front-End Performance");
      frontEnd.properties.tabColor = { argb: "FF7030A0" };
      frontEnd.columns = [
        { header: "User", key: "user", width: 30 },
        { header: "Inbound", key: "inbound", width: 15 },
        { header: "Answered", key: "answered", width: 15 },
        { header: "Missed", key: "missed", width: 15 },
        { header: "Answer Rate", key: "rate", width: 15 }
      ];

      // Apply header styling
      frontEnd.getRow(1).eachCell((cell) => {
        applyHeaderStyle(cell);
      });

      if (frontendData && frontendData.length > 0) {
        // Sort by answer rate descending
        const sortedFrontend = [...frontendData].sort((a, b) => (b.answer_rate || 0) - (a.answer_rate || 0));

        sortedFrontend.forEach((u) => {
          const rate = u.answer_rate || 0;
          const row = frontEnd.addRow({
            user: u.user_name || "",
            inbound: u.total_inbound || 0,
            answered: u.total_answered || 0,
            missed: u.total_missed || 0,
            rate: rate
          });

          // Conditional coloring for answer rate
          let fillColor;
          if (rate >= 0.9) fillColor = GREEN;
          else if (rate >= 0.75) fillColor = YELLOW;
          else fillColor = RED;

          row.getCell(5).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillColor } };
          row.getCell(5).numFmt = "0.00%";
          row.getCell(2).alignment = { horizontal: "right" };
          row.getCell(3).alignment = { horizontal: "right" };
          row.getCell(4).alignment = { horizontal: "right" };
          row.getCell(5).alignment = { horizontal: "right" };
        });

        const frontEndTotalInbound = frontendData.reduce((sum, u) => sum + (u.total_inbound || 0), 0);
        const frontEndTotalAnswered = frontendData.reduce((sum, u) => sum + (u.total_answered || 0), 0);
        const frontEndTotalMissed = frontendData.reduce((sum, u) => sum + (u.total_missed || 0), 0);
        const frontEndTotalRate = frontEndTotalInbound > 0 ? frontEndTotalAnswered / frontEndTotalInbound : 0;

        const totalsRow = frontEnd.addRow({
          user: "TOTAL",
          inbound: frontEndTotalInbound,
          answered: frontEndTotalAnswered,
          missed: frontEndTotalMissed,
          rate: frontEndTotalRate
        });

        totalsRow.font = { ...baseFont, bold: true };
        totalsRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_BG } };
        totalsRow.getCell(5).numFmt = "0.00%";
      }

      frontEnd.autoFilter = { from: "A1", to: `E${frontEnd.rowCount}` };
      frontEnd.views = [{ state: "frozen", ySplit: 1 }];
      autoFitColumns(frontEnd);

      // ===== SHEET 4: INDIVIDUAL PERFORMANCE =====
      const individual = wb.addWorksheet("Individual Performance");
      individual.properties.tabColor = { argb: "FF7F7F7F" };
      individual.columns = [
        { header: "User", key: "user", width: 30 },
        { header: "Inbound", key: "inbound", width: 15 },
        { header: "Outbound", key: "outbound", width: 15 },
        { header: "Answered", key: "answered", width: 15 },
        { header: "Missed", key: "missed", width: 15 },
        { header: "Answer Rate", key: "rate", width: 15 },
        { header: "Avg Duration (Minutes)", key: "avgMin", width: 20 }
      ];

      // Apply header styling
      individual.getRow(1).eachCell((cell) => {
        applyHeaderStyle(cell);
      });

      let indivTotalInbound = 0, indivTotalOutbound = 0, indivTotalAnswered = 0, indivTotalMissed = 0;
      let indivTotalDurationSeconds = 0;

      if (individualData && individualData.length > 0) {
        // Sort by answer rate descending
        const sortedIndividual = [...individualData].sort((a, b) => (b.answer_rate || 0) - (a.answer_rate || 0));

        sortedIndividual.forEach((u) => {
          const inbound = u.total_inbound || 0;
          const outbound = u.total_outbound || 0;
          const answered = u.total_answered || 0;
          const missed = u.total_missed || 0;
          const avgDurationSec = u.avg_duration_seconds || 0;
          const rate = inbound > 0 ? answered / inbound : 0;

          const row = individual.addRow({
            user: u.user_name || "",
            inbound: inbound,
            outbound: outbound,
            answered: answered,
            missed: missed,
            rate: rate,
            avgMin: avgDurationSec / 60
          });

          row.getCell(6).numFmt = "0.00%";
          row.getCell(7).numFmt = "0.00";
          for (let i = 2; i <= 7; i++) {
            row.getCell(i).alignment = { horizontal: "right" };
          }

          indivTotalInbound += inbound;
          indivTotalOutbound += outbound;
          indivTotalAnswered += answered;
          indivTotalMissed += missed;
          indivTotalDurationSeconds += avgDurationSec * inbound;
        });

        const indivTotalRate = indivTotalInbound > 0 ? indivTotalAnswered / indivTotalInbound : 0;
        const indivAvgMinutes = indivTotalInbound > 0 ? indivTotalDurationSeconds / indivTotalInbound / 60 : 0;

        const totalsRow = individual.addRow({
          user: "TOTAL",
          inbound: indivTotalInbound,
          outbound: indivTotalOutbound,
          answered: indivTotalAnswered,
          missed: indivTotalMissed,
          rate: indivTotalRate,
          avgMin: indivAvgMinutes
        });

        totalsRow.font = { ...baseFont, bold: true };
        totalsRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_BG } };
        totalsRow.getCell(6).numFmt = "0.00%";
        totalsRow.getCell(7).numFmt = "0.00";
        for (let i = 2; i <= 7; i++) {
          totalsRow.getCell(i).alignment = { horizontal: "right" };
        }
      }

      individual.autoFilter = { from: "A1", to: `G${individual.rowCount}` };
      individual.views = [{ state: "frozen", ySplit: 1 }];
      autoFitColumns(individual);

      // Write buffer and download
      const buffer = await wb.xlsx.writeBuffer();

      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `CallLog_Report_${new Date().toISOString().split("T")[0]}.xlsx`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      alert(`Export failed: ${error.message}`);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Validation warnings (exclude unmapped count - handled by UnmappedExtensionsAlert)
  const warnings = [];
  if (inbound.length === 0) warnings.push('No inbound call data imported');
  if (users.filter(u => u.include_in_benchmark).length === 0) warnings.push('No benchmark users configured');

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Call Log Dashboard</h1>
            <p className="text-slate-600 mt-1">Inbound/outbound metrics and performance analysis</p>
          </div>
        </div>

        {/* Tabs */}
         <Tabs value={activeTab} onValueChange={setActiveTab}>
           <TabsList className="grid w-full grid-cols-3">
             <TabsTrigger value="reporting">Reporting</TabsTrigger>
             <TabsTrigger value="upload">Upload CDR</TabsTrigger>
             <TabsTrigger value="users">User Directory</TabsTrigger>
           </TabsList>

          {/* Reporting Tab */}
          <TabsContent value="reporting" className="space-y-6">
            <div className="flex justify-end">
              <Button
                onClick={handleExportExcel}
                disabled={inbound.length === 0 && outbound.length === 0}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                Export to Excel
              </Button>
            </div>

            {/* Unmapped Extensions Alert */}
            <UnmappedExtensionsAlert />

            {/* Warnings */}
            {warnings.length > 0 && (
              <Alert variant="warning">
                <AlertTriangle className="w-4 h-4" />
                <AlertDescription>
                  <div className="space-y-1">
                    {warnings.map((w, i) => (
                      <div key={i}>{w}</div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* KPI Cards - 2 rows of 4 */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Total Calls"
                value={metrics.totalCalls.toLocaleString()}
                subtitle={`${metrics.totalInbound} inbound, ${metrics.totalOutbound} outbound`}
                onClick={() => setSelectedMetric(buildDetailData('total'))}
              />
              <KPICard
                title="Inbound"
                value={metrics.totalInbound.toLocaleString()}
                onClick={() => setSelectedMetric(buildDetailData('inbound'))}
              />
              <KPICard
                title="Outbound"
                value={metrics.totalOutbound.toLocaleString()}
                onClick={() => setSelectedMetric(buildDetailData('outbound'))}
              />
              <KPICard
                title="Answered"
                value={metrics.totalAnswered.toLocaleString()}
                subtitle={`${formatPercent(metrics.inboundAnswerRate)} of inbound`}
                onClick={() => setSelectedMetric(buildDetailData('answered'))}
              />
              <KPICard
                title="Missed"
                value={metrics.totalMissed.toLocaleString()}
                variant="missed"
                onClick={() => setSelectedMetric(buildDetailData('missed'))}
              />
              <KPICard
                title="Outbound Contact Rate"
                value={formatPercent(metrics.outboundContactRate)}
                subtitle={`${metrics.connectedOutbound} connected of ${metrics.totalOutbound}`}
                variant="rate"
                onClick={() => setSelectedMetric(buildDetailData('outbound-connected'))}
              />
              <KPICard
                title="Benchmark Answer Rate"
                value={formatPercent(metrics.benchmarkAnswerRate)}
                subtitle={`${metrics.benchmarkAnswered} answered of ${metrics.benchmarkInbound}`}
                variant="rate"
                onClick={() => setSelectedMetric(buildDetailData('benchmark-inbound'))}
              />
              <KPICard
                title="Overall Contact Rate"
                value={formatPercent(metrics.overallContactRate)}
                subtitle={`${metrics.totalContacted} contacted of ${metrics.totalCalls}`}
                variant="rate"
                onClick={() => setSelectedMetric(buildDetailData('overall-contacted'))}
              />
            </div>

            {/* Weekly Summary */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Weekly Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <WeeklyTable data={weeklyData} />
              </CardContent>
            </Card>

            {/* Monthly Summary */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Monthly KPI Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <MonthlyTable data={monthlyData} />
              </CardContent>
            </Card>

            {/* Front-End Performance */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Front-End Performance (Front Desk Benchmark)</CardTitle>
              </CardHeader>
              <CardContent>
                <IndividualPerformanceTable data={frontendData} showOutbound={true} defaultSort="overall_contact_rate" />
              </CardContent>
            </Card>

            {/* Individual Performance */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Individual Performance (All Users)</CardTitle>
              </CardHeader>
              <CardContent>
                <IndividualPerformanceTable data={individualData} showOutbound={true} defaultSort="overall_contact_rate" />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Upload CDR Tab */}
          <TabsContent value="upload" className="space-y-6">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-base">Import Call Records</CardTitle>
              </CardHeader>
              <CardContent>
                <CDRUpload
                  onUploadSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['inbound-calls'] });
                    queryClient.invalidateQueries({ queryKey: ['outbound-calls'] });
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* User Directory Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>User Directory</CardTitle>
              </CardHeader>
              <CardContent>
                <UserDirectoryTable />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Detail Modal */}
        {selectedMetric && (
          <CallLogDetailModal
            metric={selectedMetric}
            onClose={() => setSelectedMetric(null)}
          />
        )}
      </div>
    </div>
  );
}