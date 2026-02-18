import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Trash2, RotateCcw, Eye } from "lucide-react";
import { format, startOfMonth, endOfMonth, isWithinInterval, eachDayOfInterval } from 'date-fns';
import ReportingPeriodDetailModal from './ReportingPeriodDetailModal.jsx';

export default function ReportingPeriodsPanel({ selectedMonth, onRefresh }) {
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Parse dates as local dates only (YYYY-MM-DD format, no timezone conversion)
  const [year, month] = selectedMonth.split('-').map(Number);
  const monthDate = new Date(year, month - 1, 1);
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);

  // Fetch all periods for the selected month
  const { data: allPeriods = [], isLoading, refetch } = useQuery({
    queryKey: ['reportingPeriods', selectedMonth],
    queryFn: async () => {
      const periods = await base44.entities.CallLogPeriod.filter({});
      return periods.filter(p => {
        // Parse dates as local dates (no timezone conversion)
        const [startYear, startMonth, startDay] = p.reporting_period_start.split('-');
        const [endYear, endMonth, endDay] = p.reporting_period_end.split('-');
        const periodStart = new Date(parseInt(startYear), parseInt(startMonth) - 1, parseInt(startDay));
        const periodEnd = new Date(parseInt(endYear), parseInt(endMonth) - 1, parseInt(endDay));
        // Check if period overlaps with the selected month
        return periodStart <= monthEnd && periodEnd >= monthStart;
      });
    },
    staleTime: 5 * 60 * 1000,
  });

  // Get unique periods and process them
  const uniquePeriods = useMemo(() => {
    const seen = new Map();
    const unique = [];

    allPeriods.forEach(p => {
      const key = `${p.reporting_period_start}-${p.reporting_period_end}`;
      if (!seen.has(key)) {
        seen.set(key, []);
      }
      seen.get(key).push(p);
    });

    seen.forEach((records, key) => {
      const [start, end] = key.split('-');
      unique.push({
        key,
        reporting_period_start: start,
        reporting_period_end: end,
        records,
        isDuplicate: records.length > 1,
      });
    });

    return unique.sort((a, b) => new Date(a.reporting_period_start) - new Date(b.reporting_period_start));
  }, [allPeriods]);

  // Display periods as stored (no calculations, no timezone conversion)
  const periodsWithStatus = useMemo(() => {
    return uniquePeriods.map(p => {
      const [startYear, startMonth, startDay] = p.reporting_period_start.split('-').map(Number);
      const [endYear, endMonth, endDay] = p.reporting_period_end.split('-').map(Number);
      const start = new Date(startYear, startMonth - 1, startDay);
      const end = new Date(endYear, endMonth - 1, endDay);
      
      // Determine status based on date range logic
      let status = 'Custom Range';
      
      // Check if Monthly: start = first day of month AND end = last day of same month
      if (startDay === 1 && startMonth === endMonth && startYear === endYear) {
        const lastDayOfMonth = new Date(endYear, endMonth, 0).getDate();
        if (endDay === lastDayOfMonth) {
          status = 'Monthly';
        }
      }
      
      // Check if Weekly: date difference <= 7 days
      if (status === 'Custom Range') {
        const dayDiff = Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
        if (dayDiff <= 7) {
          status = 'Weekly';
        }
      }

      return { ...p, status };
    });
  }, [uniquePeriods]);

  // Calculate month completeness
  const completenessInfo = useMemo(() => {
    if (periodsWithStatus.length === 0) {
      return { status: 'Incomplete', label: 'Month Incomplete', color: 'bg-yellow-100 text-yellow-800' };
    }

    // Check if single full month record exists
    const fullMonthPeriods = periodsWithStatus.filter(p => p.status === 'Full Month');
    if (fullMonthPeriods.length >= 1) {
      return { status: 'Complete', label: 'Month Complete', color: 'bg-green-100 text-green-800' };
    }

    // Check if weekly periods cover entire month with no gaps
    const allDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const coveredDays = new Set();

    periodsWithStatus.forEach(p => {
      const [startYear, startMonth, startDay] = p.reporting_period_start.split('-');
      const [endYear, endMonth, endDay] = p.reporting_period_end.split('-');
      const periodDays = eachDayOfInterval({
        start: new Date(parseInt(startYear), parseInt(startMonth) - 1, parseInt(startDay)),
        end: new Date(parseInt(endYear), parseInt(endMonth) - 1, parseInt(endDay)),
      });
      periodDays.forEach(d => coveredDays.add(d.toDateString()));
    });

    const allDaysCovered = allDays.every(d => coveredDays.has(d.toDateString()));
    if (allDaysCovered) {
      return { status: 'Complete', label: 'Month Complete (Weekly Aggregated)', color: 'bg-green-100 text-green-800' };
    }

    return { status: 'Incomplete', label: 'Month Incomplete', color: 'bg-yellow-100 text-yellow-800' };
  }, [periodsWithStatus, monthStart, monthEnd]);

  const handleDelete = async (id) => {
    if (confirm('Delete this reporting period?')) {
      await base44.entities.CallLogPeriod.delete(id);
      refetch();
      if (onRefresh) onRefresh();
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-slate-500">Loading reporting periods...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-50 border-slate-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Reporting Periods Entered</CardTitle>
          <Badge className={completenessInfo.color}>
            {completenessInfo.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {periodsWithStatus.length === 0 ? (
          <div className="text-center py-6 text-slate-500">
            No reporting periods entered for {format(monthDate, 'MMMM yyyy')}
          </div>
        ) : (
          <div className="rounded-lg border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-100 hover:bg-slate-100">
                  <TableHead className="font-semibold">Period Start</TableHead>
                  <TableHead className="font-semibold">Period End</TableHead>
                  <TableHead className="font-semibold">Upload Date</TableHead>
                  <TableHead className="font-semibold">Uploaded By</TableHead>
                  <TableHead className="font-semibold">Source File</TableHead>
                  <TableHead className="font-semibold">Status</TableHead>
                  <TableHead className="font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {periodsWithStatus.map((period, idx) => {
                  const firstRecord = period.records[0];
                  return (
                    <TableRow key={period.key} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <TableCell className="font-medium">
                        {period.reporting_period_start}
                      </TableCell>
                      <TableCell>
                        {period.reporting_period_end}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {firstRecord?.uploaded_at ? new Date(firstRecord.uploaded_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">
                        {firstRecord?.uploaded_by || '-'}
                      </TableCell>
                      <TableCell className="text-sm text-slate-600 max-w-xs truncate" title={firstRecord?.source_file_name}>
                        {firstRecord?.source_file_name || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 items-center flex-wrap">
                          <Badge 
                            variant="outline"
                            className={period.displayType === 'Monthly' ? 'bg-green-50 text-green-700 border-green-200' : 
                                      period.displayType === 'Weekly' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                      'bg-slate-100 text-slate-700 border-slate-200'}
                          >
                            {period.displayType}
                          </Badge>
                          {period.isDuplicate && (
                            <Badge className="bg-red-100 text-red-700 border-red-200">
                              <AlertCircle className="w-3 h-3 mr-1" />
                              Duplicate
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setSelectedPeriod(firstRecord);
                              setDetailModalOpen(true);
                            }}
                            title="View details"
                            className="h-8 w-8 p-0"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            title="Recalculate month"
                            className="h-8 w-8 p-0"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handleDelete(firstRecord?.id)}
                            title="Delete period"
                            className="h-8 w-8 p-0 hover:text-red-600"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        <ReportingPeriodDetailModal 
          open={detailModalOpen}
          onOpenChange={setDetailModalOpen}
          period={selectedPeriod}
          onRefresh={() => {
            refetch();
            if (onRefresh) onRefresh();
          }}
        />
      </CardContent>
    </Card>
  );
}