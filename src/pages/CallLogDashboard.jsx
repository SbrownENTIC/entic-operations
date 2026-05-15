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
      const HEADER_BG = "FF1F3864";
      const WHITE = "FFFFFFFF";
      const KPI_BG = "FFF2F2F2";
      const GREEN_BG = "FFC6EFCE";
      const YELLOW_BG = "FFFFEB9C";
      const RED_BG = "FFFFC7CE";
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

      // ===== SHEET 0: CONFIG_BENCHMARKS (Protected & Hidden) =====
      // Exact replication from Benchmarks.xlsx structure
      const configSheet = wb.addWorksheet("Config_Benchmarks");
      configSheet.properties.tabColor = { argb: "FF595959" };
      configSheet.state = "hidden";
      configSheet.columns = [
        { width: 25 },
        { width: 35 },
        { width: 15 },
        { width: 12 },
        { width: 40 }
      ];

      // Header row
      const headerRow = configSheet.addRow(["Category", "Metric", "Target Value", "Unit", "Notes"]);
      headerRow.eachCell((cell) => {
        cell.font = { ...baseFont, bold: true, color: { argb: WHITE } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
        cell.alignment = { horizontal: "left", vertical: "middle" };
      });
      configSheet.getRow(1).height = 22;

      // Benchmark data - exact replication from Benchmarks.xlsx
      const benchmarks = [
        ["Answer Rate", "Green Threshold (Good)", 0.5, "Decimal", "Answer rate ≥ 50% shown in green"],
        ["Answer Rate", "Yellow Threshold (Warning)", 0.2, "Decimal", "Answer rate ≥ 20% and < 50% shown in yellow"],
        ["Answer Rate", "Red Threshold (Poor)", 0, "Decimal", "Answer rate < 20% shown in red"],
        ["Phone Role", "Call Center Expected AR", 0.85, "Decimal", "Expected inbound answer rate for Call Center extensions"],
        ["Phone Role", "Client Facing Expected AR", 0.65, "Decimal", "Expected inbound answer rate for Client Facing extensions"],
        ["Phone Role", "Call Center Expected CPH", 8, "Number", "Expected calls per hour for Call Center role"],
        ["Phone Role", "Client Facing Expected CPH", 6, "Number", "Expected calls per hour for Client Facing role"],
        ["Outbound Contact Rate", "Green Threshold (Good)", 0.4, "Decimal", "Outbound contact rate ≥ 40% shown in green"],
        ["Outbound Contact Rate", "Yellow Threshold (Warning)", 0.2, "Decimal", "Outbound contact rate ≥ 20% and < 40% shown in yellow"],
        ["Outbound Contact Rate", "Red Threshold (Poor)", 0, "Decimal", "Outbound contact rate < 20% shown in red"],
        ["Front-End", "Answer Rate Green", 0.6, "Decimal", "Front Desk expected answer rate threshold for green"],
        ["Front-End", "Answer Rate Yellow", 0.4, "Decimal", "Front Desk expected answer rate threshold for yellow"],
        ["Daily Goal", "Call Center Target", 160, "Number", "Daily call target for Call Center role"],
        ["Daily Goal", "Client Facing Target", 120, "Number", "Daily call target for Client Facing role"],
        ["Outbound Mix", "Call Center Expected %", 0.15, "Decimal", "Expected outbound as % of total calls"],
        ["Outbound Mix", "Client Facing Expected %", 0.1, "Decimal", "Expected outbound as % of total calls"],
        ["Performance", "Work Days Per Week", 5, "Number", "Standard work days per week for goal calculations"],
        ["Performance Tracking", "Green - % of Goal", 0.85, "Decimal", "Performance ≥ 85% of goal shown in green"],
        ["Performance Tracking", "Yellow - % of Goal", 0.7, "Decimal", "Performance ≥ 70% and < 85% of goal shown in yellow"],
        ["Performance Tracking", "Red - % of Goal", 0, "Decimal", "Performance < 70% of goal shown in red"],
        ["Executive Summary", "Overall Contact Rate Green", 0.65, "Decimal", "Overall contact rate ≥ 65% shown in green"],
        ["Executive Summary", "Overall Contact Rate Yellow", 0.45, "Decimal", "Overall contact rate ≥ 45% and < 65% shown in yellow"],
        ["Location Goal", "Bloomfield – Check In Daily", 35, "Number", "Daily call target for Bloomfield Check In"],
        ["Location Goal", "Bloomfield – Check Out Daily", 30, "Number", "Daily call target for Bloomfield Check Out"],
        ["Location Goal", "Manchester – Check In Daily", 40, "Number", "Daily call target for Manchester Check In"],
        ["Location Goal", "Manchester – Check Out Daily", 35, "Number", "Daily call target for Manchester Check Out"],
        ["Location Goal", "Glastonbury – Check In Daily", 38, "Number", "Daily call target for Glastonbury Check In"],
        ["Location Goal", "Glastonbury – Check Out Daily", 32, "Number", "Daily call target for Glastonbury Check Out"],
        ["Location Goal", "Farmington – Check In Daily", 36, "Number", "Daily call target for Farmington Check In"],
        ["Location Goal", "Farmington – Check Out Daily", 31, "Number", "Daily call target for Farmington Check Out"],
        ["Location Goal", "Farmington – Phone Only Daily", 40, "Number", "Daily call target for Farmington Phone Only"]
      ];

      benchmarks.forEach((row) => {
        const dataRow = configSheet.addRow(row);
        // Format Target Value column as percentage if < 1, otherwise as number
        const cell = dataRow.getCell(3);
        if (row[2] < 1 && row[2] > 0) {
          cell.numFmt = "0.00%";
        } else if (typeof row[2] === 'number') {
          cell.numFmt = "#,##0";
        }
        cell.alignment = { horizontal: "right" };
      });

      // Store benchmark thresholds as static values for sheet references
      const benchmarkThresholds = {
        answerRateGreen: 0.5,
        answerRateYellow: 0.2,
        callCenterAR: 0.85,
        clientFacingAR: 0.65,
        outboundGreen: 0.4,
        outboundYellow: 0.2,
        frontEndGreen: 0.6,
        frontEndYellow: 0.4,
        performanceGreen: 0.85,
        performanceYellow: 0.7,
        overallContactGreen: 0.65,
        overallContactYellow: 0.45,
        workDaysPerWeek: 5
      };

      // Protect the sheet
      configSheet.protect("ENTIC_23!", {
        sheet: true,
        content: true,
        objects: false,
        scenarios: false,
        formatCells: false,
        formatColumns: false,
        formatRows: false,
        insertColumns: false,
        insertRows: false,
        insertHyperlinks: false,
        deleteColumns: false,
        deleteRows: false,
        selectLockedCells: true,
        sort: false,
        autoFilter: false,
        pivotTables: false,
        selectUnlockedCells: true
      });

      autoFitColumns(configSheet);

      // ===== SHEET 1: CALL LOG EXECUTIVE REPORT =====
      const summary = wb.addWorksheet("Call Log Executive Report");
      summary.properties.tabColor = { argb: "FF1F3864" };
      summary.columns = [{ width: 30 }, { width: 20 }];

      // Header
      summary.mergeCells("A1:B1");
      const headerCell = summary.getCell("A1");
      headerCell.value = "Call Log Executive Report – May 2026";
      headerCell.font = { name: "Calibri", size: 14, bold: true, color: { argb: WHITE } };
      headerCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
      headerCell.alignment = { horizontal: "left", vertical: "middle" };
      summary.getRow(1).height = 30;

      // Timestamp
      summary.mergeCells("A2:B2");
      const timestampCell = summary.getCell("A2");
      timestampCell.value = `Report Generated: ${new Date().toLocaleString()}`;
      timestampCell.font = { name: "Calibri", size: 10, italic: true, color: { argb: "FF666666" } };
      timestampCell.alignment = { horizontal: "right" };

      summary.addRow([]);

      // KPI block
      [
        ["Total Calls", totalInbound + totalOutbound],
        ["Inbound", totalInbound],
        ["Outbound", totalOutbound],
        ["Answered", totalAnswered],
        ["Missed", totalMissed]
      ].forEach(([label, val]) => {
        const row = summary.addRow([label, val]);
        row.getCell(1).font = { ...baseFont, bold: true };
        row.getCell(2).numFmt = "#,##0";
        row.getCell(2).fill = { type: "pattern", pattern: "solid", fgColor: { argb: KPI_BG } };
        row.getCell(2).alignment = { horizontal: "right" };
      });

      summary.addRow([]);

      // Metrics with conditional color formatting - reference Config_Benchmarks via named ranges
      const metricsData = [
        ["Inbound Answer Rate", inboundRate, "AnswerRate_Green", "AnswerRate_Yellow"],
        ["Front-End Answer Rate", frontEndRate, "FrontEnd_AR_Green", "FrontEnd_AR_Yellow"],
        ["Outbound Contact Rate (30s+)", outboundContactRate, "Outbound_Green", "Outbound_Yellow"],
        ["Overall Contact Rate", overallContactRate, "Overall_ContactRate_Green", "Overall_ContactRate_Yellow"]
      ];

      metricsData.forEach(([label, val, greenRef, yellowRef]) => {
        const row = summary.addRow([label, val]);
        row.getCell(1).font = { ...baseFont, bold: true };
        row.getCell(2).numFmt = "0.00%";
        row.getCell(2).alignment = { horizontal: "right" };
        
        // Apply conditional formatting based on Config_Benchmarks thresholds
        // For now, use hardcoded values; in Excel formulas will reference named ranges
        let greenThreshold = 0.5, yellowThreshold = 0.2;
        if (greenRef === "FrontEnd_AR_Green") { greenThreshold = 0.6; yellowThreshold = 0.4; }
        if (greenRef === "Outbound_Green") { greenThreshold = 0.4; yellowThreshold = 0.2; }
        if (greenRef === "Overall_ContactRate_Green") { greenThreshold = 0.65; yellowThreshold = 0.45; }
        
        applyConditionalColor(row.getCell(2), val, greenThreshold, yellowThreshold);
      });

      summary.addRow([]);
      summary.addRow([]);

      // Weekly Performance section header
      const weekStartRow = summary.rowCount + 1;
      summary.mergeCells(`A${weekStartRow}:E${weekStartRow}`);
      const weekHeader = summary.getCell(`A${weekStartRow}`);
      weekHeader.value = "Weekly Performance";
      weekHeader.font = { name: "Calibri", size: 12, bold: true, color: { argb: WHITE } };
      weekHeader.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F6A73" } };
      weekHeader.alignment = { horizontal: "left", vertical: "middle" };
      summary.getRow(weekStartRow).height = 22;

      // Weekly column headers
      const weekColHeaderRow = summary.addRow(["Week Starting", "Total Inbound", "Answered", "Missed", "Answer Rate"]);
      weekColHeaderRow.eachCell((cell) => {
        cell.font = { ...baseFont, bold: true, color: { argb: WHITE } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      // Weekly data
      if (weeklyData && weeklyData.length > 0) {
        weeklyData.forEach((w) => {
          const row = summary.addRow([
            w.week_start || "",
            w.total_inbound || 0,
            w.total_answered || 0,
            w.total_missed || 0,
            w.answer_rate || 0
          ]);
          row.getCell(2).numFmt = "#,##0";
          row.getCell(3).numFmt = "#,##0";
          row.getCell(4).numFmt = "#,##0";
          row.getCell(5).numFmt = "0.00%";
          for (let i = 2; i <= 5; i++) row.getCell(i).alignment = { horizontal: "right" };
        });

        // Monthly total row
        const totRow = summary.addRow([
          "MONTHLY TOTAL",
          totalInbound,
          totalAnswered,
          totalMissed,
          totalInbound > 0 ? totalAnswered / totalInbound : 0
        ]);
        totRow.font = { ...baseFont, bold: true };
        totRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E6E6" } };
        totRow.getCell(2).numFmt = "#,##0";
        totRow.getCell(3).numFmt = "#,##0";
        totRow.getCell(4).numFmt = "#,##0";
        totRow.getCell(5).numFmt = "0.00%";
        for (let i = 2; i <= 5; i++) totRow.getCell(i).alignment = { horizontal: "right" };
      }

      summary.views = [{ state: "frozen", ySplit: weekStartRow + 2 }];
      autoFitColumns(summary);

      // ===== SHEET 2: FRONT-END PERFORMANCE =====
      const frontEnd = wb.addWorksheet("Front-End Performance");
      frontEnd.properties.tabColor = { argb: "FF0F6A73" };
      frontEnd.columns = [
        { header: "User", width: 30 },
        { header: "Inbound", width: 12 },
        { header: "Answered", width: 12 },
        { header: "Missed", width: 12 },
        { header: "Answer Rate", width: 15 }
      ];

      frontEnd.getRow(1).eachCell((cell) => {
        cell.font = { ...baseFont, bold: true, color: { argb: WHITE } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      if (frontendData && frontendData.length > 0) {
        const sorted = [...frontendData].sort((a, b) => (b.answer_rate || 0) - (a.answer_rate || 0));
        let totalInb = 0, totalAns = 0, totalMis = 0;

        sorted.forEach((u) => {
          const rate = u.answer_rate || 0;
          const row = frontEnd.addRow([
            u.user_name || "",
            u.total_inbound || 0,
            u.total_answered || 0,
            u.total_missed || 0,
            rate
          ]);

          row.getCell(2).numFmt = "#,##0";
          row.getCell(3).numFmt = "#,##0";
          row.getCell(4).numFmt = "#,##0";
          row.getCell(5).numFmt = "0.00%";
          
          for (let i = 2; i <= 5; i++) row.getCell(i).alignment = { horizontal: "right" };
          
          // Apply color based on FrontEnd_AR thresholds from Config_Benchmarks
          applyConditionalColor(row.getCell(5), rate, 0.6, 0.4);

          totalInb += u.total_inbound || 0;
          totalAns += u.total_answered || 0;
          totalMis += u.total_missed || 0;
        });

        const totalRate = totalInb > 0 ? totalAns / totalInb : 0;
        const totalsRow = frontEnd.addRow(["TOTAL", totalInb, totalAns, totalMis, totalRate]);
        totalsRow.font = { ...baseFont, bold: true };
        totalsRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E6E6" } };
        totalsRow.getCell(2).numFmt = "#,##0";
        totalsRow.getCell(3).numFmt = "#,##0";
        totalsRow.getCell(4).numFmt = "#,##0";
        totalsRow.getCell(5).numFmt = "0.00%";
        for (let i = 2; i <= 5; i++) totalsRow.getCell(i).alignment = { horizontal: "right" };
        applyConditionalColor(totalsRow.getCell(5), totalRate, 0.6, 0.4);
      }

      frontEnd.autoFilter = { from: "A1", to: `E${frontEnd.rowCount}` };
      frontEnd.views = [{ state: "frozen", ySplit: 1 }];
      autoFitColumns(frontEnd);

      // ===== SHEET 3: INDIVIDUAL PERFORMANCE =====
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
        { header: "Avg Duration (min)", width: 16 }
      ];

      individual.getRow(1).eachCell((cell) => {
        cell.font = { ...baseFont, bold: true, color: { argb: WHITE } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      if (individualData && individualData.length > 0) {
        const sorted = [...individualData].sort((a, b) => (b.answer_rate || 0) - (a.answer_rate || 0));
        let totInb = 0, totOut = 0, totAns = 0, totMis = 0, totDur = 0, totOutConnected = 0;

        sorted.forEach((u) => {
          const inb = u.total_inbound || 0;
          const out = u.total_outbound || 0;
          const ans = u.total_answered || 0;
          const mis = u.total_missed || 0;
          const dur = u.avg_duration_seconds || 0;
          const outConn = u.outbound_connected || 0;
          const ansRate = inb > 0 ? ans / inb : 0;
          const outRate = out > 0 ? outConn / out : 0;

          const row = individual.addRow([
            u.user_name || "",
            inb, out, ans, mis,
            ansRate,
            outRate,
            dur / 60
          ]);

          for (let i = 2; i <= 8; i++) {
            if (i === 6 || i === 7) row.getCell(i).numFmt = "0.00%";
            else if (i === 8) row.getCell(i).numFmt = "0.00";
            else row.getCell(i).numFmt = "#,##0";
            row.getCell(i).alignment = { horizontal: "right" };
          }
          // Apply benchmark-driven conditional coloring - reference Config_Benchmarks thresholds
          applyConditionalColor(row.getCell(6), ansRate, 0.5, 0.2); // Answer Rate from Config_Benchmarks
          applyConditionalColor(row.getCell(7), outRate, 0.4, 0.2); // Outbound Contact Rate from Config_Benchmarks

          totInb += inb; totOut += out; totAns += ans; totMis += mis; totDur += dur * inb; totOutConnected += outConn;
        });

        const totAnsRate = totInb > 0 ? totAns / totInb : 0;
        const totOutRate = totOut > 0 ? totOutConnected / totOut : 0;
        const totalsRow = individual.addRow([
          "TOTAL", totInb, totOut, totAns, totMis,
          totAnsRate,
          totOutRate,
          totInb > 0 ? totDur / totInb / 60 : 0
        ]);
        totalsRow.font = { ...baseFont, bold: true };
        totalsRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE7E6E6" } };
        for (let i = 2; i <= 8; i++) {
          if (i === 6 || i === 7) totalsRow.getCell(i).numFmt = "0.00%";
          else if (i === 8) totalsRow.getCell(i).numFmt = "0.00";
          else totalsRow.getCell(i).numFmt = "#,##0";
          totalsRow.getCell(i).alignment = { horizontal: "right" };
        }
        applyConditionalColor(totalsRow.getCell(6), totAnsRate, 0.5, 0.2);
        applyConditionalColor(totalsRow.getCell(7), totOutRate, 0.4, 0.2);
      }

      individual.autoFilter = { from: "A1", to: `H${individual.rowCount}` };
      individual.views = [{ state: "frozen", ySplit: 1 }];
      autoFitColumns(individual);

      // ===== SHEET 5: RAW DATA =====
      const rawData = wb.addWorksheet("Raw Data");
      rawData.properties.tabColor = { argb: "FF595959" };
      rawData.columns = [
        { header: "Call Date", width: 12 },
        { header: "Call Time", width: 12 },
        { header: "Extension", width: 12 },
        { header: "Direction", width: 12 },
        { header: "Number", width: 15 },
        { header: "Duration (sec)", width: 15 },
        { header: "Result", width: 15 }
      ];

      rawData.getRow(1).eachCell((cell) => {
        cell.font = { ...baseFont, bold: true, color: { argb: WHITE } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      if (inbound && inbound.length > 0) {
        inbound.forEach((call) => {
          rawData.addRow([
            call.call_date || "", call.call_time || "", call.extension || "", "Inbound",
            call.caller_number || "", call.duration_seconds || 0, call.disposition || ""
          ]);
        });
      }

      if (outbound && outbound.length > 0) {
        outbound.forEach((call) => {
          rawData.addRow([
            call.call_date || "", call.call_time || "", call.extension || "", "Outbound",
            call.dialed_number || "", call.duration_seconds || 0, call.result || ""
          ]);
        });
      }

      rawData.autoFilter = { from: "A1", to: `G${rawData.rowCount}` };
      rawData.views = [{ state: "frozen", ySplit: 1 }];
      autoFitColumns(rawData);

      // ===== SHEET 4: GOAL TRACKING (Formula-Driven) =====
      const goalTracking = wb.addWorksheet("Goal Tracking");
      goalTracking.properties.tabColor = { argb: "FF4472C4" };
      goalTracking.columns = [
        { header: "User Name", width: 30 },
        { header: "Phone Role", width: 15 },
        { header: "Location/Name", width: 30 },
        { header: "Daily Goal", width: 12 },
        { header: "Weekly Goal (×5)", width: 15 },
        { header: "Calls This Week", width: 15 },
        { header: "% of Goal", width: 12 },
        { header: "Status", width: 12 }
      ];

      goalTracking.getRow(1).eachCell((cell) => {
        cell.font = { ...baseFont, bold: true, color: { argb: WHITE } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: HEADER_BG } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      // Add instructions row
      goalTracking.insertRows(2, 1);
      const instructRow = goalTracking.getRow(2);
      instructRow.getCell(1).value = "Formulas reference Config_Benchmarks for Phone Role & Location Goals. Edit Config_Benchmarks to update all calculations.";
      instructRow.getCell(1).font = { italic: true, color: { argb: "FF666666" } };
      goalTracking.mergeCells("A2:H2");

      // Add sample user rows with formulas (placeholder data)
      if (users && users.length > 0) {
        users.slice(0, 10).forEach((user, idx) => {
          const rowNum = 3 + idx;
          const row = goalTracking.addRow([
            user.name || "",
            user.role || "Client Facing",
            user.location || "",
            0,  // Daily Goal - will reference Config_Benchmarks via VLOOKUP
            0,  // Weekly Goal formula: =D{rowNum}*Config_Benchmarks!C18
            0,  // Calls This Week (sample)
            0,  // % of Goal formula: =F{rowNum}/E{rowNum}
            ""  // Status
          ]);

          // Format columns
          for (let i = 4; i <= 8; i++) {
            if (i === 7) {
              row.getCell(i).numFmt = "0.0%";
            } else {
              row.getCell(i).numFmt = "#,##0";
            }
            row.getCell(i).alignment = { horizontal: "right" };
          }

          // Set formula for Daily Goal (Column D) - VLOOKUP into Config_Benchmarks
          const dailyGoalFormula = `=IFERROR(VLOOKUP(C${rowNum},Config_Benchmarks!$A:$C,3,0),0)`;
          row.getCell(4).value = { formula: dailyGoalFormula };

          // Set formula for Weekly Goal (Column E) - Daily Goal × WorkDaysPerWeek
          const weeklyGoalFormula = `=D${rowNum}*VLOOKUP("Work Days Per Week",Config_Benchmarks!$B:$C,2,0)`;
          row.getCell(5).value = { formula: weeklyGoalFormula };

          // Column F stays with actual call counts (sample 0 for now)
          row.getCell(6).value = 0;

          // Set formula for % of Goal (Column G)
          const percentFormula = `=IFERROR(F${rowNum}/E${rowNum},0)`;
          row.getCell(7).value = { formula: percentFormula };

          // Set formula for Status (Column H) - reference Performance thresholds
          const statusFormula = `=IF(G${rowNum}>=VLOOKUP("Green - % of Goal",Config_Benchmarks!$B:$C,2,0),"GREEN",IF(G${rowNum}>=VLOOKUP("Yellow - % of Goal",Config_Benchmarks!$B:$C,2,0),"YELLOW","RED"))`;
          row.getCell(8).value = { formula: statusFormula };

          // Apply conditional coloring based on status (will be recalculated in Excel)
          if (idx % 2 === 0) {
            for (let i = 1; i <= 8; i++) {
              row.getCell(i).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFAFAFA" } };
            }
          }
        });
      }

      goalTracking.autoFilter = { from: "A1", to: `H${goalTracking.rowCount}` };
      goalTracking.views = [{ state: "frozen", ySplit: 2 }];
      autoFitColumns(goalTracking);

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