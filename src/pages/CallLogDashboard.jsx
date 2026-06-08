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
    const data = aggregateInboundByMonth(inbound, extToUser, benchmarkUserIds);
    return Array.isArray(data) ? [...data].sort((a, b) => (b.month || "").localeCompare(a.month || "")) : data;
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
    if (!Array.isArray(individualData)) return [];
    return individualData.filter(u => u.benchmark_group === 'Front Desk');
  }, [individualData]);

  const npCoordinatorData = useMemo(() => {
    if (!Array.isArray(individualData)) return [];
    return individualData.filter(u => u.benchmark_group === 'NP Coordinator');
  }, [individualData]);

  // Individual Performance = Front Desk + NP Coordinator only (no "Other")
  const individualPerformanceData = useMemo(() => {
    if (!Array.isArray(individualData)) return [];
    return individualData.filter(u => u.benchmark_group === 'Front Desk' || u.benchmark_group === 'NP Coordinator');
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
      console.log("npCoordinatorData:", Array.isArray(npCoordinatorData) ? `array (${npCoordinatorData.length})` : "NOT ARRAY");
      console.log("individualPerformanceData (FD+NPC):", Array.isArray(individualPerformanceData) ? `array (${individualPerformanceData.length})` : "NOT ARRAY");
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
      const WorkDaysPerWeek = 5;

      // Build a lookup map from user_name -> daily_goal from the UserDirectory
      const userGoalMap = {};
      users.forEach(u => {
        if (u.name) userGoalMap[u.name] = u.daily_goal || 0;
      });

      // ===== SHEET 1: CALL LOG EXECUTIVE REPORT =====
      const summary = wb.addWorksheet("Call Log Executive Report");
      summary.properties.tabColor = { argb: "FF1F3864" };
      // 10 columns: Label, Value, [spacer], Group, TotalCalls, Inbound, Outbound, Answered, Missed, AnsRate, OutRate, PctGoal
      summary.columns = [
        { width: 32 }, { width: 16 }, { width: 4 },
        { width: 22 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 }, { width: 12 },
        { width: 14 }, { width: 22 }, { width: 12 }
      ];

      // Row 1: Professional Header (Font size 18, Dark blue, Merged A-L)
      summary.mergeCells("A1:L1");
      const headerCell = summary.getCell("A1");
      const now = new Date();
      const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      headerCell.value = `Call Log Executive Report – ${monthYear}`;
      headerCell.font = { name: "Calibri", size: 18, bold: true, color: { argb: WHITE } };
      headerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
      headerCell.alignment = { horizontal: "left", vertical: "middle" };
      summary.getRow(1).height = 30;

      // Row 2: Timestamp (right-aligned, italic gray)
      summary.mergeCells("A2:L2");
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
      
      // NP Coordinator group totals
      let totalNPCInbound = 0, totalNPCAnswered = 0;
      npCoordinatorData.forEach(u => {
        totalNPCInbound += u.total_inbound || 0;
        totalNPCAnswered += u.total_answered || 0;
      });
      const npcRate = totalNPCInbound > 0 ? totalNPCAnswered / totalNPCInbound : 0;

      const rateMetricsData = [
        ["Inbound Answer Rate (All)", inboundRate, true],
        ["Front Desk Answer Rate", frontEndRate, true],
        ["NP Coordinator Answer Rate", npcRate, true],
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
      summary.mergeCells(`A${weekStartRow}:L${weekStartRow}`);
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
         const sortedWeeklyData = [...weeklyData].sort((a, b) => (b.week_start || "").localeCompare(a.week_start || ""));
         let wIdx = 0;
         while (wIdx < sortedWeeklyData.length) {
           const w = sortedWeeklyData[wIdx];
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

      // ===== SECTION C: PERFORMANCE BY BENCHMARK GROUP =====
      summary.addRow([]); // Spacer

      const groupSectionStartRow = summary.rowCount + 1;
      summary.mergeCells(`A${groupSectionStartRow}:L${groupSectionStartRow}`);
      const groupSectionHeader = summary.getCell(`A${groupSectionStartRow}`);
      groupSectionHeader.value = "Performance by Benchmark Group";
      groupSectionHeader.font = { name: "Calibri", size: 12, bold: true, color: { argb: WHITE } };
      groupSectionHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F6A73" } };
      groupSectionHeader.alignment = { horizontal: "left", vertical: "middle" };
      summary.getRow(groupSectionStartRow).height = 22;

      // Group totals sub-header
      const groupColHdr = summary.addRow([
        "Group", "Total Calls", "Inbound", "Outbound", "Answered", "Missed", "", "Answer Rate", "", "Outbound Contact Rate (30s+)", "", "% of Goal"
      ]);
      groupColHdr.eachCell((cell, colNum) => {
        if (cell.value) {
          cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: WHITE } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      });

      // Pre-compute per-group outbound metrics using raw outbound records mapped through extToUser
      const groupOutboundMap = { "Front Desk": { total: 0, connected: 0 }, "NP Coordinator": { total: 0, connected: 0 } };
      outbound.forEach(call => {
        const normalizedExt = String(call.extension || "").trim().replace(/[\s\-\(\)]/g, '').replace(/\D/g, '');
        const userObj = extToUser[normalizedExt] || extToUser[call.extension];
        const group = userObj ? userObj.benchmark_group : null;
        const key = group === "Front Desk" ? "Front Desk" : group === "NP Coordinator" ? "NP Coordinator" : null;
        if (key) {
          groupOutboundMap[key].total++;
          if ((call.duration_seconds || 0) >= 30) groupOutboundMap[key].connected++;
        }
      });

      // Build per-group metrics
      const buildGroupMetrics = (groupData, groupKey) => {
        let inb = 0, out = 0, ans = 0, mis = 0, outConn = 0, weeklyGoalSum = 0;
        groupData.forEach(u => {
          inb += u.total_inbound || 0;
          ans += u.total_answered || 0;
          mis += u.total_missed || 0;
          const dailyGoal = userGoalMap[u.user_name] || 0;
          weeklyGoalSum += dailyGoal * WorkDaysPerWeek;
        });
        out = groupOutboundMap[groupKey].total;
        outConn = groupOutboundMap[groupKey].connected;
        const ansRate = inb > 0 ? ans / inb : 0;
        const outRate = out > 0 ? outConn / out : 0;
        const pctGoal = weeklyGoalSum > 0 ? (ans + out) / weeklyGoalSum : 0;
        return { inb, out, ans, mis, outConn, ansRate, outRate, pctGoal, totalCalls: inb + out };
      };

      const fdMetrics = buildGroupMetrics(frontendData, "Front Desk");
      const npcMetrics = buildGroupMetrics(npCoordinatorData, "NP Coordinator");

      const groupRows = [
        ["Front Desk", fdMetrics],
        ["NP Coordinator", npcMetrics]
      ];

      const LIGHT_GRAY = "FFF2F2F2";
      const applyGroupCF = (cell, value, green, yellow) => {
        if (value >= green) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } };
          cell.font = { name: "Calibri", size: 11, color: { argb: "FF006100" } };
        } else if (value >= yellow) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFEB9C" } };
          cell.font = { name: "Calibri", size: 11, color: { argb: "FF9C6500" } };
        } else {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFC7CE" } };
          cell.font = { name: "Calibri", size: 11, color: { argb: "FF9C0006" } };
        }
      };

      groupRows.forEach(([label, m], gIdx) => {
        const fillArgb = gIdx % 2 === 0 ? LIGHT_GRAY : "FFFFFFFF";
        const gRow = summary.addRow([label, m.totalCalls, m.inb, m.out, m.ans, m.mis, "", m.ansRate, "", m.outRate, "", m.pctGoal]);
        gRow.getCell(1).font = { name: "Calibri", size: 11, bold: true };
        gRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
        // Numeric cols 2-6
        for (let i = 2; i <= 6; i++) {
          gRow.getCell(i).numFmt = "#,##0";
          gRow.getCell(i).alignment = { horizontal: "right" };
          gRow.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
        }
        // Answer Rate (col 8), Outbound Contact Rate (col 10), % of Goal (col 12)
        gRow.getCell(8).numFmt = "0.00%"; gRow.getCell(8).alignment = { horizontal: "right" };
        gRow.getCell(10).numFmt = "0.00%"; gRow.getCell(10).alignment = { horizontal: "right" };
        gRow.getCell(12).numFmt = "0.00%"; gRow.getCell(12).alignment = { horizontal: "right" };
        applyGroupCF(gRow.getCell(8), m.ansRate, 0.50, 0.20);
        applyGroupCF(gRow.getCell(10), m.outRate, 0.50, 0.20);
        applyGroupCF(gRow.getCell(12), m.pctGoal, 1.00, 0.90);
      });

      // ===== SECTION D: GROUP COMPARISON TABLE =====
      summary.addRow([]); // Spacer

      const compStartRow = summary.rowCount + 1;
      summary.mergeCells(`A${compStartRow}:L${compStartRow}`);
      const compHeader = summary.getCell(`A${compStartRow}`);
      compHeader.value = "Group Comparison Table";
      compHeader.font = { name: "Calibri", size: 12, bold: true, color: { argb: WHITE } };
      compHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F6A73" } };
      compHeader.alignment = { horizontal: "left", vertical: "middle" };
      summary.getRow(compStartRow).height = 22;

      const compColHdr = summary.addRow(["Group", "Answer Rate", "", "Outbound Contact Rate (30s+)", "", "% of Goal"]);
      compColHdr.eachCell((cell) => {
        if (cell.value) {
          cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: WHITE } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      });

      groupRows.forEach(([label, m], gIdx) => {
        const fillArgb = gIdx % 2 === 0 ? LIGHT_GRAY : "FFFFFFFF";
        const cRow = summary.addRow([label, m.ansRate, "", m.outRate, "", m.pctGoal]);
        cRow.getCell(1).font = { name: "Calibri", size: 11, bold: true };
        cRow.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
        cRow.getCell(2).numFmt = "0.00%"; cRow.getCell(2).alignment = { horizontal: "right" };
        cRow.getCell(4).numFmt = "0.00%"; cRow.getCell(4).alignment = { horizontal: "right" };
        cRow.getCell(6).numFmt = "0.00%"; cRow.getCell(6).alignment = { horizontal: "right" };
        applyGroupCF(cRow.getCell(2), m.ansRate, 0.50, 0.20);
        applyGroupCF(cRow.getCell(4), m.outRate, 0.50, 0.20);
        applyGroupCF(cRow.getCell(6), m.pctGoal, 0.50, 0.20);
        // Fill empty cells with row background
        [3, 5].forEach(i => {
          cRow.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
        });
      });

      // ===== SECTION E: KPI SUMMARY BY GROUP =====
      summary.addRow([]); // Spacer

      const kpiSummaryStartRow = summary.rowCount + 1;
      summary.mergeCells(`A${kpiSummaryStartRow}:L${kpiSummaryStartRow}`);
      const kpiSummaryHeader = summary.getCell(`A${kpiSummaryStartRow}`);
      kpiSummaryHeader.value = "KPI Summary by Group";
      kpiSummaryHeader.font = { name: "Calibri", size: 12, bold: true, color: { argb: WHITE } };
      kpiSummaryHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F6A73" } };
      kpiSummaryHeader.alignment = { horizontal: "left", vertical: "middle" };
      summary.getRow(kpiSummaryStartRow).height = 22;

      // KPI sub-header row
      const kpiSubHdr = summary.addRow(["Metric", "Front Desk", "", "NP Coordinator"]);
      kpiSubHdr.eachCell((cell) => {
        if (cell.value) {
          cell.font = { name: "Calibri", size: 10, bold: true, color: { argb: WHITE } };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
          cell.alignment = { horizontal: "center", vertical: "middle" };
        }
      });

      // Avg % of Goal per group
      const calcAvgGoalPct = (groupData) => {
        if (groupData.length === 0) return 0;
        let sum = 0;
        groupData.forEach(u => {
          const dg = userGoalMap[u.user_name] || 0;
          const wg = dg * WorkDaysPerWeek;
          const perf = (u.total_answered || 0) + (u.total_outbound || 0);
          sum += wg > 0 ? perf / wg : 0;
        });
        return sum / groupData.length;
      };

      const kpiSummaryData = [
        ["Total Answered", fdMetrics.ans, "", npcMetrics.ans],
        ["Total Outbound", fdMetrics.out, "", npcMetrics.out],
        ["Avg % of Goal", calcAvgGoalPct(frontendData), "", calcAvgGoalPct(npCoordinatorData)]
      ];

      kpiSummaryData.forEach((rowData, rIdx) => {
        const kRow = summary.addRow(rowData);
        const fillArgb = rIdx % 2 === 0 ? LIGHT_GRAY : "FFFFFFFF";
        kRow.getCell(1).font = { name: "Calibri", size: 11, bold: true };
        kRow.getCell(1).alignment = { horizontal: "left" };
        // Values in cols 2, 4
        [2, 4].forEach(colIdx => {
          const cell = kRow.getCell(colIdx);
          cell.font = { name: "Calibri", size: 11, bold: true };
          cell.alignment = { horizontal: "right" };
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
          if (rIdx === 2) { // Avg % of Goal
            cell.numFmt = "0.00%";
          } else {
            cell.numFmt = "#,##0";
          }
        });
        // Fill empty cell col 3
        kRow.getCell(3).fill = { type: "pattern", pattern: "solid", fgColor: { argb: fillArgb } };
      });

      summary.addRow([]); // Bottom spacer

      autoFitColumns(summary);

      // ===== WEEKLY PER-USER AGGREGATION HELPER =====
      // Builds: { weekStart -> { userId -> { user_name, total_inbound, total_answered, total_missed, total_outbound, outbound_connected, answer_rate, outbound_contact_rate, daily_goal, benchmark_group } } }
      const buildWeeklyUserMap = (filterGroup) => {
        const weekMap = {}; // weekStart -> userId -> metrics

        // Helper: get/init week bucket
        const getBucket = (weekStart, userId, userName, dailyGoal, bGroup) => {
          if (!weekMap[weekStart]) weekMap[weekStart] = {};
          if (!weekMap[weekStart][userId]) {
            weekMap[weekStart][userId] = {
              user_name: userName, daily_goal: dailyGoal, benchmark_group: bGroup,
              total_inbound: 0, total_answered: 0, total_missed: 0,
              total_outbound: 0, outbound_connected: 0
            };
          }
          return weekMap[weekStart][userId];
        };

        // Get Monday of week for a date string "YYYY-MM-DD"
        const getWeekStart = (dateStr) => {
          if (!dateStr) return null;
          const d = new Date(dateStr + 'T00:00:00');
          const day = d.getDay(); // 0=Sun
          const diff = day === 0 ? -6 : 1 - day; // adjust to Monday
          d.setDate(d.getDate() + diff);
          return d.toISOString().split('T')[0];
        };

        inbound.forEach(call => {
          const normalizedExt = String(call.extension || '').trim().replace(/[\s\-\(\)]/g, '').replace(/\D/g, '');
          const userObj = extToUser[normalizedExt] || extToUser[call.extension];
          if (!userObj) return;
          if (filterGroup && userObj.benchmark_group !== filterGroup && !(Array.isArray(filterGroup) && filterGroup.includes(userObj.benchmark_group))) return;
          const weekStart = getWeekStart(call.call_date);
          if (!weekStart) return;
          const dg = userGoalMap[userObj.name] || 0;
          const b = getBucket(weekStart, userObj.id, userObj.name, dg, userObj.benchmark_group);
          b.total_inbound++;
          if (call.answered) b.total_answered++;
          if (call.missed) b.total_missed++;
        });

        outbound.forEach(call => {
          const normalizedExt = String(call.extension || '').trim().replace(/[\s\-\(\)]/g, '').replace(/\D/g, '');
          const userObj = extToUser[normalizedExt] || extToUser[call.extension];
          if (!userObj) return;
          if (filterGroup && userObj.benchmark_group !== filterGroup && !(Array.isArray(filterGroup) && filterGroup.includes(userObj.benchmark_group))) return;
          const weekStart = getWeekStart(call.call_date);
          if (!weekStart) return;
          const dg = userGoalMap[userObj.name] || 0;
          const b = getBucket(weekStart, userObj.id, userObj.name, dg, userObj.benchmark_group);
          b.total_outbound++;
          if ((call.duration_seconds || 0) >= 30) b.outbound_connected++;
        });

        // Compute derived rates
        Object.values(weekMap).forEach(users => {
          Object.values(users).forEach(u => {
            u.answer_rate = u.total_inbound > 0 ? u.total_answered / u.total_inbound : 0;
            u.outbound_contact_rate = u.total_outbound > 0 ? u.outbound_connected / u.total_outbound : 0;
            u.weekly_goal = u.daily_goal * WorkDaysPerWeek;
            u.goal_percent = u.weekly_goal > 0 ? (u.total_answered + u.total_outbound) / u.weekly_goal : 0;
            u.avg_calls_per_day = (u.total_answered + u.outbound_connected) / WorkDaysPerWeek;
          });
        });

        return weekMap;
      };

      // Helper: write a weekly-sectioned performance sheet (no addTable, styled ranges)
      const writeWeeklyPerformanceSheet = (ws, weeklyUserMap, sheetTitle, includeGoals, sortByGoal, numColsTotal, monthYear) => {
        const WEEK_HDR_BG = "FF0F4C5C"; // dark teal
        const COL_HDR_BG  = "FF1F3864";
        const TOTAL_FILL   = "FFF2F2F2";
        const WHITE_FONT   = "FFFFFFFF";
        const numCols = numColsTotal;

        // Title row
        ws.mergeCells(`A1:${String.fromCharCode(64 + numCols)}1`);
        const titleCell = ws.getCell("A1");
        titleCell.value = `${sheetTitle} – ${monthYear}`;
        titleCell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FF1F3864" } };
        titleCell.alignment = { horizontal: "left", vertical: "middle" };
        titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
        ws.getRow(1).height = 28;
        ws.addRow([]); // spacer row 2

        // Column headers definition
        const headers = includeGoals
          ? ["User", "Inbound", "Outbound", "Avg Calls/Day", "Answered", "Missed", "Answer Rate", "Outbound Contact Rate", "Daily Goal", "Weekly Goal", "% of Goal"]
          : ["User", "Inbound", "Outbound", "Avg Calls/Day", "Answered", "Missed", "Answer Rate", "Outbound Contact Rate"];

        const applySoftCF = (cell, value, green, yellow) => {
          if (value >= green) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFC6EFCE" } };
            cell.font = { name: "Calibri", size: 11, color: { argb: "FF006100" } };
          } else if (value >= yellow) {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFE699" } };
            cell.font = { name: "Calibri", size: 11, color: { argb: "FF9C6500" } };
          } else {
            cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFCCCC" } };
            cell.font = { name: "Calibri", size: 11, color: { argb: "FF9C0006" } };
          }
        };

        const formatDateMMDDYYYY = (dateStr) => {
          if (!dateStr) return '';
          const parts = dateStr.split('-');
          if (parts.length === 3) return `${parts[1]}/${parts[2]}/${parts[0]}`;
          return dateStr;
        };

        // Sort weeks descending (newest first)
        const sortedWeeks = Object.keys(weeklyUserMap).sort((a, b) => b.localeCompare(a));

        sortedWeeks.forEach((weekStart) => {
          const usersInWeek = Object.values(weeklyUserMap[weekStart]);
          // Sort users within week
          const sortedUsers = [...usersInWeek].sort((a, b) => {
            if (sortByGoal) return (b.goal_percent || 0) - (a.goal_percent || 0);
            return (b.answer_rate || 0) - (a.answer_rate || 0);
          });

          // Week section header
          const weekRowNum = ws.rowCount + 1;
          ws.mergeCells(`A${weekRowNum}:${String.fromCharCode(64 + numCols)}${weekRowNum}`);
          const weekCell = ws.getCell(`A${weekRowNum}`);
          weekCell.value = `Week Starting: ${formatDateMMDDYYYY(weekStart)}`;
          weekCell.font = { name: "Calibri", size: 11, bold: true, color: { argb: WHITE_FONT } };
          weekCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: WEEK_HDR_BG } };
          weekCell.alignment = { horizontal: "left", vertical: "middle" };
          ws.getRow(weekRowNum).height = 22;

          // Column headers
          const colHdrRow = ws.addRow(headers);
          colHdrRow.height = 18;
          colHdrRow.eachCell((cell, colNum) => {
            if (colNum <= headers.length) {
              cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: WHITE_FONT } };
              cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COL_HDR_BG } };
              cell.alignment = { horizontal: colNum === 1 ? "left" : "center", vertical: "middle" };
            }
          });

          // Weekly totals accumulators
          let wTotInb = 0, wTotOut = 0, wTotAns = 0, wTotMis = 0, wTotGoal = 0, wTotWeekGoal = 0;
          let wGoalPcts = [], wAvgCPD = [], wAnsRates = [], wOutRates = [];

          // Data rows
          sortedUsers.forEach(u => {
            const rowValues = includeGoals
              ? [u.user_name, u.total_inbound, u.total_outbound, u.avg_calls_per_day, u.total_answered, u.total_missed, u.answer_rate, u.outbound_contact_rate, u.daily_goal, u.weekly_goal, u.goal_percent]
              : [u.user_name, u.total_inbound, u.total_outbound, u.avg_calls_per_day, u.total_answered, u.total_missed, u.answer_rate, u.outbound_contact_rate];

            const dataRow = ws.addRow(rowValues);
            dataRow.getCell(1).alignment = { horizontal: "left", vertical: "middle" };
            dataRow.getCell(4).numFmt = "0.00"; // Avg Calls/Day
            dataRow.getCell(7).numFmt = "0.00%"; // Answer Rate
            dataRow.getCell(8).numFmt = "0.00%"; // Outbound Contact Rate
            if (includeGoals) dataRow.getCell(11).numFmt = "0.00%"; // % of Goal
            for (let c = 2; c <= headers.length; c++) {
              dataRow.getCell(c).alignment = { horizontal: "center", vertical: "middle" };
            }
            // Conditional formatting on rate cols (data rows only)
            applySoftCF(dataRow.getCell(7), u.answer_rate, 0.50, 0.20);
            applySoftCF(dataRow.getCell(8), u.outbound_contact_rate, 0.50, 0.20);
            if (includeGoals) applySoftCF(dataRow.getCell(11), u.goal_percent, 1.00, 0.90);

            // Accumulate totals
            wTotInb += u.total_inbound; wTotOut += u.total_outbound;
            wTotAns += u.total_answered; wTotMis += u.total_missed;
            wTotGoal += u.daily_goal; wTotWeekGoal += u.weekly_goal;
            wGoalPcts.push(u.goal_percent); wAvgCPD.push(u.avg_calls_per_day);
            wAnsRates.push(u.answer_rate); wOutRates.push(u.outbound_contact_rate);
          });

          // Weekly TOTAL row
          const avg = arr => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
          const wTotAnsRate = wTotInb > 0 ? wTotAns / wTotInb : 0;
          const wTotOutRate = wTotOut > 0 ? (sortedUsers.reduce((s, u) => s + u.outbound_connected, 0) / wTotOut) : 0;
          const wAvgGoalPct = avg(wGoalPcts);
          const wAvgCPDVal = avg(wAvgCPD);

          const totalValues = includeGoals
            ? ["TOTAL", wTotInb, wTotOut, wAvgCPDVal, wTotAns, wTotMis, wTotAnsRate, wTotOutRate, wTotGoal, wTotWeekGoal, wAvgGoalPct]
            : ["TOTAL", wTotInb, wTotOut, wAvgCPDVal, wTotAns, wTotMis, wTotAnsRate, wTotOutRate];

          const totRow = ws.addRow(totalValues);
          totRow.font = { name: "Calibri", size: 11, bold: true };
          totRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_FILL } };
          totRow.getCell(1).alignment = { horizontal: "left" };
          totRow.getCell(1).border = { top: { style: "medium" } };
          totRow.getCell(4).numFmt = "0.00";
          totRow.getCell(7).numFmt = "0.00%";
          totRow.getCell(8).numFmt = "0.00%";
          if (includeGoals) totRow.getCell(11).numFmt = "0.00%";
          for (let c = 2; c <= headers.length; c++) {
            const tc = totRow.getCell(c);
            tc.border = { top: { style: "medium" } };
            tc.alignment = { horizontal: "center", vertical: "middle" };
            if (c !== 4 && c !== 7 && c !== 8 && c !== 11) tc.numFmt = "#,##0";
          }

          // Blank spacer row between weeks
          ws.addRow([]);
        });
      };

      // ===== SHEET 2: FRONT-END PERFORMANCE =====
      const frontEnd = wb.addWorksheet("Front-End Performance");
      frontEnd.properties.tabColor = { argb: "FF70AD47" };
      // Set fixed column widths (no autofit)
      frontEnd.columns = [
        { width: 22 }, { width: 12 }, { width: 12 }, { width: 16 },
        { width: 12 }, { width: 12 }, { width: 14 }, { width: 14 },
        { width: 14 }, { width: 14 }, { width: 14 }
      ];

      {
        const feWeeklyMap = buildWeeklyUserMap("Front Desk");
        writeWeeklyPerformanceSheet(frontEnd, feWeeklyMap, "Front-End Performance", true, true, 11, monthYear);
      }
      frontEnd.state = "visible";

      // ===== SHEET 3: NP COORDINATOR PERFORMANCE =====
      const npCoord = wb.addWorksheet("NP Coordinator Performance");
      npCoord.properties.tabColor = { argb: "FF7030A0" };
      npCoord.columns = [
        { width: 22 }, { width: 12 }, { width: 12 }, { width: 16 },
        { width: 12 }, { width: 12 }, { width: 14 }, { width: 14 },
        { width: 14 }, { width: 14 }, { width: 14 }
      ];
      {
        const npcWeeklyMap = buildWeeklyUserMap("NP Coordinator");
        writeWeeklyPerformanceSheet(npCoord, npcWeeklyMap, "NP Coordinator Performance", true, true, 11, monthYear);
      }
      npCoord.state = "visible";

      // ===== SHEET 4: INDIVIDUAL PERFORMANCE =====
      const individual = wb.addWorksheet("Individual Performance");
      individual.properties.tabColor = { argb: "FFED7D31" };
      individual.columns = [
        { width: 22 }, { width: 12 }, { width: 12 }, { width: 16 },
        { width: 12 }, { width: 12 }, { width: 14 }, { width: 14 }
      ];
      {
        const indWeeklyMap = buildWeeklyUserMap(["Front Desk", "NP Coordinator"]);
        writeWeeklyPerformanceSheet(individual, indWeeklyMap, "Individual Performance", false, false, 8, monthYear);
      }
      individual.state = "visible";

       // ===== PHASE 3: ADD CONFIG, FORMULA, AND RAW DATA SHEETS =====

       // 1. CONFIG_BENCHMARKS SHEET
       const configBenchmarks = wb.addWorksheet("Config_Benchmarks");
       configBenchmarks.properties.tabColor = { argb: "FF808080" };
       configBenchmarks.columns = [
         { header: "Name", width: 30 },
         { header: "Extensions", width: 30 },
         { header: "Location", width: 20 },
         { header: "Benchmark Group", width: 20 },
         { header: "Daily Goal", width: 12 },
         { header: "Include in Benchmark", width: 18 },
         { header: "Active", width: 10 },
         { header: "Role", width: 20 },
         { header: "Expected Answer Rate", width: 18 }
       ];

       configBenchmarks.getRow(1).eachCell((cell) => {
         cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
         cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF595959" } };
         cell.alignment = { horizontal: "center", vertical: "middle" };
         cell.border = {
           top: { style: "thin" },
           left: { style: "thin" },
           bottom: { style: "thin" },
           right: { style: "thin" }
         };
       });

       let configIdx = 0;
       while (configIdx < users.length) {
         const u = users[configIdx];
         const extStr = Array.isArray(u.extensions) ? u.extensions.join(", ") : u.extensions || "";
         const row = configBenchmarks.addRow([
           u.name || "",
           extStr,
           u.location || "",
           u.benchmark_group || "",
           u.daily_goal || 0,
           u.include_in_benchmark ? "Yes" : "No",
           u.active ? "Yes" : "No",
           u.role || "",
           u.expected_answer_rate || ""
         ]);
         for (let i = 1; i <= 9; i++) {
           row.getCell(i).alignment = { horizontal: "left" };
         }
         configIdx++;
       }

       autoFitColumns(configBenchmarks);
       configBenchmarks.protect("ENTIC_23!", {
         selectLockedCells: false,
         selectUnlockedCells: false
       });
       configBenchmarks.state = "hidden";

       // 2. FORMULA_REFERENCE SHEET
       const formulaRef = wb.addWorksheet("Formula_Reference");
       formulaRef.properties.tabColor = { argb: "FF7030A0" };
       formulaRef.columns = [{ width: 30 }, { width: 60 }];

       const formulaHeader = formulaRef.addRow(["Calculation", "Formula/Logic"]);
       formulaHeader.eachCell((cell) => {
         cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
         cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5B2C6F" } };
         cell.alignment = { horizontal: "center", vertical: "middle" };
         cell.border = {
           top: { style: "thin" },
           left: { style: "thin" },
           bottom: { style: "thin" },
           right: { style: "thin" }
         };
       });

       const formulaData = [
         ["Inbound Answer Rate", "= Answered Calls ÷ Total Inbound Calls"],
         ["Outbound Contact Rate (30s+)", "= Outbound Calls with duration ≥ 30 seconds ÷ Total Outbound Calls"],
         ["% of Goal", "= (Answered + Outbound) ÷ Weekly Goal"],
         ["Daily Goal", "= Expected Calls Per Hour × 7.5 hours"],
         ["Weekly Goal", "= Daily Goal × 5 work days"],
         ["Overall Contact Rate", "= (Answered + Outbound Connected) ÷ Total Calls"],
         ["Average % of Goal (Total Row)", "= Average of all individual % of Goal values"]
       ];

       let fIdx = 0;
       while (fIdx < formulaData.length) {
         const item = formulaData[fIdx];
         const fRow = formulaRef.addRow([item[0], item[1]]);
         fRow.getCell(1).font = { name: "Calibri", size: 10, bold: true };
         fRow.getCell(2).font = { name: "Calibri", size: 10 };
         fRow.alignment = { horizontal: "left", vertical: "top", wrapText: true };
         fIdx++;
       }

       autoFitColumns(formulaRef);
       formulaRef.protect("ENTIC_23!", {
         selectLockedCells: false,
         selectUnlockedCells: false
       });
       formulaRef.state = "hidden";

       // 3. RAW_IMPORTED_DATA SHEET
       const rawData = wb.addWorksheet("Raw_Imported_Data");
       rawData.properties.tabColor = { argb: "FFFFC000" };
       rawData.columns = [
         { header: "Date", width: 12 },
         { header: "Time", width: 10 },
         { header: "User", width: 20 },
         { header: "Extension", width: 12 },
         { header: "Direction", width: 12 },
         { header: "Duration (seconds)", width: 16 },
         { header: "Answered", width: 10 },
         { header: "WeekStart", width: 12 },
         { header: "Month", width: 12 },
         { header: "ParsedDurationSeconds", width: 20 }
       ];

       rawData.getRow(1).eachCell((cell) => {
         cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
         cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F4C5C" } };
         cell.alignment = { horizontal: "center", vertical: "middle" };
         cell.border = {
           top: { style: "thin" },
           left: { style: "thin" },
           bottom: { style: "thin" },
           right: { style: "thin" }
         };
       });

       // Add inbound data
       let inIdx = 0;
       while (inIdx < inbound.length) {
         const call = inbound[inIdx];
         const callDate = call.call_date || "";
         const callTime = call.call_time || "";
         const userObj = users.find(u => u.extensions && u.extensions.includes(call.extension));
         const userName = userObj ? userObj.name : "Unmapped";
         const weekStart = call.week_start || "";
         const month = call.month || "";
         const rawRow = rawData.addRow([
           callDate,
           callTime,
           userName,
           call.extension || "",
           "Inbound",
           call.duration_seconds || 0,
           call.answered ? "Yes" : "No",
           weekStart,
           month,
           call.duration_seconds || 0
         ]);
         for (let i = 1; i <= 10; i++) rawRow.getCell(i).alignment = { horizontal: "left" };
         inIdx++;
       }

       // Add outbound data
       let outIdx = 0;
       while (outIdx < outbound.length) {
         const call = outbound[outIdx];
         const callDate = call.call_date || "";
         const callTime = call.call_time || "";
         const userObj = users.find(u => u.extensions && u.extensions.includes(call.extension));
         const userName = userObj ? userObj.name : "Unmapped";
         const weekStart = call.week_start || "";
         const month = call.month || "";
         const parsedDur = call.duration_seconds || 0;
         const outRow = rawData.addRow([
           callDate,
           callTime,
           userName,
           call.extension || "",
           "Outbound",
           call.duration_seconds || 0,
           parsedDur >= 30 ? "Yes" : "No",
           weekStart,
           month,
           parsedDur
         ]);
         for (let i = 1; i <= 10; i++) outRow.getCell(i).alignment = { horizontal: "left" };
         outIdx++;
       }

       autoFitColumns(rawData);

       // Sheet visibility and tab colors
       summary.state = "visible";
       summary.properties.tabColor = { argb: "FF4472C4" };
       frontEnd.state = "visible";
       frontEnd.properties.tabColor = { argb: "FF70AD47" };
       npCoord.state = "visible";
       npCoord.properties.tabColor = { argb: "FF7030A0" };
       individual.state = "visible";
       individual.properties.tabColor = { argb: "FFED7D31" };
       rawData.state = "visible";

       // ===== PHASE 3 COMPLETE =====

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

            {/* NP Coordinator Performance */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>NP Coordinator Performance (NP Coordinator Benchmark)</CardTitle>
              </CardHeader>
              <CardContent>
                <IndividualPerformanceTable data={npCoordinatorData} showOutbound={true} defaultSort="overall_contact_rate" />
              </CardContent>
            </Card>

            {/* Individual Performance */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Individual Performance (Front Desk &amp; NP Coordinator)</CardTitle>
              </CardHeader>
              <CardContent>
                <IndividualPerformanceTable data={individualPerformanceData} showOutbound={true} defaultSort="overall_contact_rate" />
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