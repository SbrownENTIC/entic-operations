import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Download, Loader2 } from 'lucide-react';
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
  const [isExporting, setIsExporting] = useState(false);
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

  // Build extension to user map from UserDirectory.extensions
  const extToUser = useMemo(() => {
    const map = {};
    users.forEach(user => {
      if (user.extensions && Array.isArray(user.extensions)) {
        user.extensions.forEach(ext => {
          map[ext] = user;
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
    
    // Merge inbound and outbound data
    const merged = {};
    inboundByUser.forEach(u => {
      merged[u.user_id] = { ...u };
    });
    outboundByUser.forEach(u => {
      if (merged[u.user_id]) {
        merged[u.user_id] = { ...merged[u.user_id], ...u };
      } else {
        merged[u.user_id] = { ...u, total_inbound: 0, total_answered: 0 };
      }
    });
    return Object.values(merged);
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
      case 'outbound-answered':
        filteredData = outbound.filter(c => c.result === 'answered' && c.duration_seconds > 30);
        title = 'Answered Outbound Calls (>30s)';
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
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const response = await base44.functions.invoke('exportCallLogExcel', {
        monthlyData,
        weeklyData,
        monthlyOutboundData,
        weeklyOutboundData,
        frontendData,
        individualData,
        userDirectory: users,
        rawInbound: inbound,
        rawOutbound: outbound
      });

      // Download the file
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CallLog_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Validation warnings
  const warnings = [];
  if (inbound.length === 0) warnings.push('No inbound call data imported');
  if (users.filter(u => u.include_in_benchmark).length === 0) warnings.push('No benchmark users configured');
  if (metrics.unmappedCount > 0) warnings.push(`${metrics.unmappedCount} extensions are unmapped`);

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
                onClick={handleExport}
                disabled={isExporting || inbound.length === 0}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                {isExporting ? 'Exporting...' : 'Export to Excel'}
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

            {/* KPI Cards */}
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
                title="Outbound Answer Rate"
                value={formatPercent(metrics.outboundAnswerRate)}
                subtitle={`${metrics.connectedOutbound} answered of ${metrics.totalOutbound}`}
                variant="rate"
                onClick={() => setSelectedMetric(buildDetailData('outbound-answered'))}
              />
            </div>

            {/* Second row KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KPICard
                title="Missed"
                value={metrics.totalMissed.toLocaleString()}
                variant="missed"
                onClick={() => setSelectedMetric(buildDetailData('missed'))}
              />
              <KPICard
                title="Inbound Answer Rate (Benchmark)"
                value={formatPercent(metrics.benchmarkAnswerRate)}
                subtitle={`${metrics.benchmarkAnswered} answered of ${metrics.benchmarkInbound}`}
                variant="rate"
                onClick={() => setSelectedMetric(buildDetailData('benchmark-inbound'))}
              />
              <KPICard
                title="Front-End Answer Rate"
                value={formatPercent(metrics.frontDeskAnswerRate)}
                subtitle={`${metrics.frontDeskAnswered} answered of ${metrics.frontDeskInbound}`}
                variant="rate"
                onClick={() => setSelectedMetric(buildDetailData('frontend-inbound'))}
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
                <IndividualPerformanceTable data={frontendData} showOutbound={false} defaultSort="answer_rate" />
              </CardContent>
            </Card>

            {/* Individual Performance */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Individual Performance (All Users)</CardTitle>
              </CardHeader>
              <CardContent>
                <IndividualPerformanceTable data={individualData} showOutbound={true} />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Upload CDR Tab */}
          <TabsContent value="upload" className="space-y-6">
            <UnmappedExtensionsAlert />
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