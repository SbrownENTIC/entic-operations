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
import GoalTrackingWidget from '@/components/calllog/GoalTrackingWidget';

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

  // Helper to parse duration string "H:MM:SS" to seconds
  const parseDurationSeconds = (duration) => {
    if (!duration || typeof duration !== 'string') return 0;
    const parts = duration.split(':').map(p => parseInt(p, 10) || 0);
    if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
      return parts[0] * 60 + parts[1];
    }
    return 0;
  };

  // Calculate metrics
  const metrics = useCallMetrics(inbound, outbound, users);

  // Calculate outbound connected calls (duration >= 30 seconds)
  const outboundConnected = useMemo(() => {
    let count = 0;
    if (Array.isArray(outbound)) {
      outbound.forEach(call => {
        const seconds = parseDurationSeconds(call.duration_seconds);
        if (seconds >= 30) {
          count++;
        }
      });
    }
    return count;
  }, [outbound]);

  // Aggregate data
  const weeklyData = useMemo(() => {
    const inboundWeekly = aggregateInboundByWeek(inbound, extToUser, benchmarkUserIds);
    const outboundWeekly = aggregateOutboundByWeek(outbound, extToUser, benchmarkUserIds);

    // Merge weekly inbound and outbound by week_start
    const weekMap = {};
    if (Array.isArray(inboundWeekly)) {
      inboundWeekly.forEach(w => {
        weekMap[w.week_start] = { ...w };
      });
    }
    if (Array.isArray(outboundWeekly)) {
      outboundWeekly.forEach(w => {
        if (weekMap[w.week_start]) {
          weekMap[w.week_start].total_outbound = w.total_outbound || 0;
          weekMap[w.week_start].outbound_connected = w.outbound_connected || 0;
        } else {
          weekMap[w.week_start] = { ...w, total_inbound: 0, total_answered: 0, total_missed: 0 };
        }
      });
    }
    return Object.values(weekMap);
  }, [inbound, outbound, extToUser, benchmarkUserIds]);

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

    if (!Array.isArray(inboundByUser)) throw new Error("inboundByUser is not an array");
    if (!Array.isArray(outboundByUser)) throw new Error("outboundByUser is not an array");

    // Build a map of answered outbound by user (for overall contact rate calculation)
    const answeredOutboundByUser = {};
    if (Array.isArray(outbound)) {
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
      }

      // Merge inbound and outbound data with combined metrics
      const merged = {};
      if (Array.isArray(inboundByUser)) {
      inboundByUser.forEach(u => {
      merged[u.user_id] = { ...u };
      });
      }
      if (Array.isArray(outboundByUser)) {
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
      }

      // Calculate overall contact rate: (answered inbound + ALL answered outbound) / (total inbound + total outbound)
      const mergedValues = Object.values(merged);
      if (!Array.isArray(mergedValues)) throw new Error("mergedValues is not an array");
      return mergedValues.map(user => {
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
    if (!Array.isArray(individualData)) {
      console.error("individualData is not an array in frontendData memo:", individualData);
      return [];
    }
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

  // Handle Excel export - PHASE 1: Minimal stable export
  const handleExportExcel = async () => {
    try {
      // ===== VALIDATION: Log all datasets =====
      console.log("=== EXPORT VALIDATION ===");
      console.log("weeklyData:", Array.isArray(weeklyData) ? `array (${weeklyData.length})` : "NOT ARRAY");
      console.log("monthlyData:", Array.isArray(monthlyData) ? `array (${monthlyData.length})` : "NOT ARRAY");
      console.log("frontendData:", Array.isArray(frontendData) ? `array (${frontendData.length})` : "NOT ARRAY");
      console.log("individualData:", Array.isArray(individualData) ? `array (${individualData.length})` : "NOT ARRAY");
      console.log("inbound:", Array.isArray(inbound) ? `array (${inbound.length})` : "NOT ARRAY");
      console.log("outbound:", Array.isArray(outbound) ? `array (${outbound.length})` : "NOT ARRAY");
      
      // ===== STRICT VALIDATION =====
       if (!Array.isArray(weeklyData)) throw new Error("weeklyData must be an array");
       if (!Array.isArray(monthlyData)) throw new Error("monthlyData must be an array");
       if (!Array.isArray(frontendData)) throw new Error("frontendData must be an array");
       if (!Array.isArray(individualData)) throw new Error("individualData must be an array");
       if (!Array.isArray(inbound)) throw new Error("inbound must be an array");
       if (!Array.isArray(outbound)) throw new Error("outbound must be an array");

       // ===== PHASE 1: MINIMAL STABLE EXPORT =====
       // Colors & Fonts
       const HEADER_BG = "FF1F3864";
       const WHITE = "FFFFFFFF";
       const GREEN_BG = "FFC6EFCE";
       const YELLOW_BG = "FFFFEB9C";
       const RED_BG = "FFFFC7CE";
       const baseFont = { name: "Calibri", size: 11 };

       // ===== CALCULATE METRICS (defensive) =====
       let totalInbound = 0;
       let totalAnswered = 0;
       let totalMissed = 0;
       let totalFrontEndInbound = 0;
       let totalFrontEndAnswered = 0;

       // ===== OUTBOUND AGGREGATION (CRITICAL: must happen early) =====
       const totalOutbound = Array.isArray(outbound) ? outbound.length : 0;
       const totalOutboundConnected = Array.isArray(outbound)
         ? outbound.filter(call => {
             const parsedDurationSeconds = call.duration_seconds || 0;
             return parsedDurationSeconds >= 30;
           }).length
         : 0;

       console.log("Outbound total:", totalOutbound);
       console.log("Outbound connected:", totalOutboundConnected);

      // Extract latest monthly inbound metrics
      if (monthlyData.length > 0) {
        const latestMonth = monthlyData[monthlyData.length - 1];
        totalInbound = latestMonth.total_inbound || 0;
        totalAnswered = latestMonth.total_answered || 0;
        totalMissed = latestMonth.total_missed || 0;
      }

      // Extract frontend totals
      let idx = 0;
      while (idx < frontendData.length) {
        const user = frontendData[idx];
        totalFrontEndInbound += user.total_inbound || 0;
        totalFrontEndAnswered += user.total_answered || 0;
        idx++;
      }

      // Calculate rates
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
          col.width = Math.min(maxLength + 2, 50);
        });
      };

      // Apply color based on benchmark thresholds
      const applyConditionalColor = (cell, rate, greenThreshold, yellowThreshold) => {
        if (rate >= greenThreshold) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREEN_BG } };
        } else if (rate >= yellowThreshold) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: YELLOW_BG } };
        } else {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: RED_BG } };
        }
      };

      // ===== PHASE 2: PROFESSIONAL FORMATTING + GOAL TRACKING =====
      // Helper: get expected calls per hour based on role
      const getExpectedCallsPerHour = (role) => {
        if (role === "Call Center") return 10;
        if (role === "Client Facing") return 7;
        return 5; // default
      };

      // ===== SHEET 1: CALL LOG EXECUTIVE REPORT =====
      const summary = wb.addWorksheet("Call Log Executive Report");
      summary.properties.tabColor = { argb: "FF1F3864" };
      summary.columns = [{ width: 35 }, { width: 18 }];

      // Row 1: Professional Header (Font size 18, Dark blue, Merged A-B)
      summary.mergeCells("A1:B1");
      const headerCell = summary.getCell("A1");
      const now = new Date();
      const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      headerCell.value = `Call Log Executive Report – ${monthYear}`;
      headerCell.font = { name: "Calibri", size: 18, bold: true, color: { argb: WHITE } };
      headerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
      headerCell.alignment = { horizontal: "left", vertical: "middle" };
      summary.getRow(1).height = 30;

      // Row 2: Timestamp (right-aligned, italic gray)
      summary.mergeCells("A2:B2");
      const timestampCell = summary.getCell("A2");
      const formattedDate = now.toLocaleString('en-US', { 
        month: '2-digit', day: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true 
      });
      timestampCell.value = `Report Generated: ${formattedDate}`;
      timestampCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF666666" } };
      timestampCell.alignment = { horizontal: "right" };

      summary.addRow([]); // Blank row 3

      // ===== KPI BLOCK WITH CONDITIONAL FORMATTING =====
      const kpiData = [
        ["Total Calls", totalInbound + totalOutbound, false],
        ["Inbound", totalInbound, false],
        ["Outbound", totalOutbound, false],
        ["Answered", totalAnswered, false],
        ["Missed", totalMissed, false]
      ];
      
      const rateMetricsData = [
        ["Inbound Answer Rate", inboundRate, true],
        ["Front-End Answer Rate", frontEndRate, true],
        ["Outbound Contact Rate (30s+)", outboundContactRate, true],
        ["Overall Contact Rate", overallContactRate, true]
      ];

      if (!Array.isArray(kpiData)) throw new Error("kpiData is not an array");
      let kpiIdx = 0;
      while (kpiIdx < kpiData.length) {
        const item = kpiData[kpiIdx];
        const label = item[0];
        const val = item[1];
        
        const row = summary.addRow([label, val]);
        row.getCell(1).font = { name: "Calibri", size: 11, bold: true };
        row.getCell(2).numFmt = "#,##0";
        row.getCell(2).alignment = { horizontal: "right" };
        row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
        kpiIdx++;
      }

      // Rate metrics with conditional coloring (0.50=green, 0.20=yellow, <0.20=red)
      if (!Array.isArray(rateMetricsData)) throw new Error("rateMetricsData is not an array");
      let metricsIdx = 0;
      while (metricsIdx < rateMetricsData.length) {
        const item = rateMetricsData[metricsIdx];
        const label = item[0];
        const val = item[1];
        
        const row = summary.addRow([label, val]);
        row.getCell(1).font = { name: "Calibri", size: 11, bold: true };
        row.getCell(2).numFmt = "0.00%";
        row.getCell(2).alignment = { horizontal: "right" };
        
        // Conditional color: green (0.50+), yellow (0.20-0.50), red (<0.20)
        applyConditionalColor(row.getCell(2), val, 0.50, 0.20);
        
        metricsIdx++;
      }

      summary.addRow([]); // Blank row
      summary.addRow([]); // Blank row

      // ===== WEEKLY PERFORMANCE SECTION =====
      const weekStartRow = summary.rowCount + 1;
      summary.mergeCells(`A${weekStartRow}:F${weekStartRow}`);
      const weekHeader = summary.getCell(`A${weekStartRow}`);
      weekHeader.value = "Weekly Performance";
      weekHeader.font = { name: "Calibri", size: 12, bold: true, color: { argb: WHITE } };
      weekHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F6A73" } };
      weekHeader.alignment = { horizontal: "left", vertical: "middle" };
      summary.getRow(weekStartRow).height = 22;

      // Weekly column headers: Week Starting | Total Calls | Inbound | Outbound | Answered | Missed | Daily Goal | Weekly Goal | % of Goal
      const weekColHeaderRow = summary.addRow([
         "Week Starting", "Total Calls", "Inbound", "Outbound", "Answered", "Missed"
       ]);
      weekColHeaderRow.eachCell((cell) => {
        cell.font = { ...baseFont, bold: true, color: { argb: WHITE } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      // Weekly data - no goal columns
       if (!Array.isArray(weeklyData)) throw new Error("weeklyData iteration failed");
       if (weeklyData.length > 0) {
         let wIdx = 0;
         while (wIdx < weeklyData.length) {
           const w = weeklyData[wIdx];
           const weeklyInbound = w.total_inbound || 0;
           const weeklyOutbound = w.total_outbound || 0;
           const totalCalls = weeklyInbound + weeklyOutbound;

           console.log("Weekly Outbound:", weeklyOutbound);

           const row = summary.addRow([
             w.week_start || "",
             totalCalls,
             weeklyInbound,
             weeklyOutbound,
             w.total_answered || 0,
             w.total_missed || 0
           ]);

           // Format columns
           for (let i = 2; i <= 6; i++) {
             row.getCell(i).numFmt = "#,##0";
             row.getCell(i).alignment = { horizontal: "right" };
           }
           wIdx++;
         }

         // Monthly total row - no goal columns, no formatting
         const totRow = summary.addRow([
           "MONTHLY TOTAL",
           totalInbound + totalOutbound,
           totalInbound,
           totalOutbound,
           totalAnswered,
           totalMissed
         ]);
         totRow.font = { name: "Calibri", size: 11, bold: true };
         totRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E6E6" } };
         for (let i = 2; i <= 6; i++) {
           totRow.getCell(i).numFmt = "#,##0";
           totRow.getCell(i).alignment = { horizontal: "right" };
         }
       }

      summary.views = [{ state: "frozen", ySplit: weekStartRow + 2 }];
      autoFitColumns(summary);

      // ===== SHEET 2: FRONT-END PERFORMANCE WITH GOAL TRACKING =====
      const frontEnd = wb.addWorksheet("Front-End Performance");
      frontEnd.properties.tabColor = { argb: "FF0F6A73" };
      frontEnd.columns = [
        { header: "User", width: 30 },
        { header: "Inbound", width: 12 },
        { header: "Outbound", width: 12 },
        { header: "Answered", width: 12 },
        { header: "Missed", width: 12 },
        { header: "Answer Rate", width: 15 },
        { header: "Outbound Contact Rate", width: 18 },
        { header: "Daily Goal", width: 12 },
        { header: "Weekly Goal", width: 13 },
        { header: "% of Goal", width: 12 }
      ];

      frontEnd.getRow(1).eachCell((cell) => {
        cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: WHITE } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      if (!Array.isArray(frontendData)) throw new Error("frontendData is not an array");
      if (frontendData.length > 0) {
        const sorted = [...frontendData].sort((a, b) => (b.answer_rate || 0) - (a.answer_rate || 0));
        let totalInb = 0, totalOut = 0, totalAns = 0, totalMis = 0, totalOutConn = 0, totalGoal = 0, totalWeekGoal = 0;
        let frontIdx = 0;

        while (frontIdx < sorted.length) {
          const u = sorted[frontIdx];
          const ansRate = u.answer_rate || 0;
          const inbound = u.total_inbound || 0;
          const answered = u.total_answered || 0;
          const outbound = u.total_outbound || 0;
          const outConn = u.outbound_connected || 0;
          const outRate = outbound > 0 ? outConn / outbound : 0;
          const dailyGoal = getExpectedCallsPerHour("Call Center") * 7.5;
          const weeklyGoal = dailyGoal * 5; // 5 workdays hardcoded
          const goalActivity = answered + outbound; // Answered + Outbound only
          const goalPercent = weeklyGoal > 0 ? goalActivity / weeklyGoal : 0;
          
          const row = frontEnd.addRow([
            u.user_name || "",
            inbound,
            outbound,
            answered,
            u.total_missed || 0,
            ansRate,
            outRate,
            dailyGoal,
            weeklyGoal,
            goalPercent
          ]);

          row.getCell(2).numFmt = "#,##0";
          row.getCell(3).numFmt = "#,##0";
          row.getCell(4).numFmt = "#,##0";
          row.getCell(5).numFmt = "#,##0";
          row.getCell(6).numFmt = "0.00%";
          row.getCell(7).numFmt = "0.00%";
          row.getCell(8).numFmt = "#,##0";
          row.getCell(9).numFmt = "#,##0";
          row.getCell(10).numFmt = "0.00%";

          // Conditional formatting for Answer Rate (col 6), Outbound Contact Rate (col 7), and Goal % (col 10)
          applyConditionalColor(row.getCell(6), ansRate, 0.50, 0.20);
          applyConditionalColor(row.getCell(7), outRate, 0.50, 0.20);
          applyConditionalColor(row.getCell(10), goalPercent, 1.00, 0.90);

          for (let i = 2; i <= 10; i++) row.getCell(i).alignment = { horizontal: "right" };

          totalInb += inbound;
          totalOut += outbound;
          totalAns += answered;
          totalMis += u.total_missed || 0;
          totalOutConn += outConn;
          totalGoal = dailyGoal; // Last daily goal (same for all)
          totalWeekGoal = weeklyGoal;
          frontIdx++;
        }

        const totalAnsRate = totalInb > 0 ? totalAns / totalInb : 0;
        const totalOutRate = totalOut > 0 ? totalOutConn / totalOut : 0;
        const totalGoalActivity = totalAns + totalOut;
        const totalGoalPercent = totalWeekGoal > 0 ? totalGoalActivity / totalWeekGoal : 0;
        const totalsRow = frontEnd.addRow(["TOTAL", totalInb, totalOut, totalAns, totalMis, totalAnsRate, totalOutRate, totalGoal, totalWeekGoal, totalGoalPercent]);
        totalsRow.font = { name: "Calibri", size: 11, bold: true };
        totalsRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
        totalsRow.getCell(2).numFmt = "#,##0";
        totalsRow.getCell(3).numFmt = "#,##0";
        totalsRow.getCell(4).numFmt = "#,##0";
        totalsRow.getCell(5).numFmt = "#,##0";
        totalsRow.getCell(6).numFmt = "0.00%";
        totalsRow.getCell(7).numFmt = "0.00%";
        totalsRow.getCell(8).numFmt = "#,##0";
        totalsRow.getCell(9).numFmt = "#,##0";
        totalsRow.getCell(10).numFmt = "0.00%";
        for (let i = 2; i <= 10; i++) totalsRow.getCell(i).alignment = { horizontal: "right" };
      }

      frontEnd.autoFilter = { from: "A1", to: `J${frontEnd.rowCount}` };
      frontEnd.views = [{ state: "frozen", ySplit: 1 }];
      autoFitColumns(frontEnd);

      // ===== SHEET 3: INDIVIDUAL PERFORMANCE WITH GOAL TRACKING & CONDITIONAL FORMATTING =====
      const individual = wb.addWorksheet("Individual Performance");
      individual.properties.tabColor = { argb: "FF7F7F7F" };
      individual.columns = [
        { header: "User", width: 30 },
        { header: "Inbound", width: 12 },
        { header: "Outbound", width: 12 },
        { header: "Answered", width: 12 },
        { header: "Missed", width: 12 },
        { header: "Answer Rate", width: 15 },
        { header: "Outbound Contact Rate", width: 18 },
        { header: "Daily Goal", width: 12 },
        { header: "Weekly Goal", width: 13 },
        { header: "% of Goal", width: 12 },
        { header: "Avg Duration (min)", width: 16 }
      ];

      individual.getRow(1).eachCell((cell) => {
        cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: WHITE } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      if (!Array.isArray(individualData)) throw new Error("individualData is not an array");
      if (individualData.length > 0) {
        const sorted = [...individualData].sort((a, b) => (b.answer_rate || 0) - (a.answer_rate || 0));
        let totInb = 0, totOut = 0, totAns = 0, totMis = 0, totDur = 0, totOutConnected = 0, totalGoal = 0, totalWeekGoal = 0;
        let indIdx = 0;

        while (indIdx < sorted.length) {
          const u = sorted[indIdx];
          const inb = u.total_inbound || 0;
          const out = u.total_outbound || 0;
          const ans = u.total_answered || 0;
          const mis = u.total_missed || 0;
          const dur = u.avg_duration_seconds || 0;
          const outConn = u.outbound_connected || 0;
          const ansRate = inb > 0 ? ans / inb : 0;
          const outRate = out > 0 ? outConn / out : 0;
          const dailyGoal = getExpectedCallsPerHour(u.role || "Call Center") * 7.5;
          const weeklyGoal = dailyGoal * 5; // 5 workdays hardcoded
          const goalActivity = ans + out; // Answered + Outbound only
          const goalPercent = weeklyGoal > 0 ? goalActivity / weeklyGoal : 0;

          const row = individual.addRow([
            u.user_name || "",
            inb, out, ans, mis,
            ansRate,
            outRate,
            dailyGoal,
            weeklyGoal,
            goalPercent,
            dur / 60
          ]);

          for (let i = 2; i <= 11; i++) {
            if (i === 6 || i === 7 || i === 10) row.getCell(i).numFmt = "0.00%";
            else if (i === 11) row.getCell(i).numFmt = "0.00";
            else row.getCell(i).numFmt = "#,##0";
            row.getCell(i).alignment = { horizontal: "right" };
          }

          // Conditional formatting for Answer Rate (6), Outbound Rate (7), and Goal % (10)
          applyConditionalColor(row.getCell(6), ansRate, 0.50, 0.20);
          applyConditionalColor(row.getCell(7), outRate, 0.50, 0.20);
          applyConditionalColor(row.getCell(10), goalPercent, 1.00, 0.90);

          totInb += inb; totOut += out; totAns += ans; totMis += mis; totDur += dur * inb; totOutConnected += outConn;
          totalGoal = dailyGoal;
          totalWeekGoal = weeklyGoal;
          indIdx++;
        }

        const totAnsRate = totInb > 0 ? totAns / totInb : 0;
        const totOutRate = totOut > 0 ? totOutConnected / totOut : 0;
        const totGoalActivity = totAns + totOut;
        const totGoalPercent = totalWeekGoal > 0 ? totGoalActivity / totalWeekGoal : 0;
        const totalsRow = individual.addRow([
          "TOTAL", totInb, totOut, totAns, totMis,
          totAnsRate,
          totOutRate,
          totalGoal,
          totalWeekGoal,
          totGoalPercent,
          totInb > 0 ? totDur / totInb / 60 : 0
        ]);
        totalsRow.font = { name: "Calibri", size: 11, bold: true };
        totalsRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD9E1F2" } };
        for (let i = 2; i <= 11; i++) {
          if (i === 6 || i === 7 || i === 10) totalsRow.getCell(i).numFmt = "0.00%";
          else if (i === 11) totalsRow.getCell(i).numFmt = "0.00";
          else totalsRow.getCell(i).numFmt = "#,##0";
          totalsRow.getCell(i).alignment = { horizontal: "right" };
        }
      }

      individual.autoFilter = { from: "A1", to: `K${individual.rowCount}` };
      individual.views = [{ state: "frozen", ySplit: 1 }];
      autoFitColumns(individual);

      // ===== PHASE 2 COMPLETE: Professional formatting, goal tracking, conditional coloring =====

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

            {/* Weekly Goal Tracking */}
            <GoalTrackingWidget individualData={individualData} users={users} />
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