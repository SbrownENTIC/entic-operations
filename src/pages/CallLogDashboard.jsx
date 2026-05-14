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

  // Fetch aggregated metrics from backend
  const { data: metrics = {}, isLoading: metricsLoading } = useQuery({
    queryKey: ['call-metrics'],
    queryFn: () => base44.functions.invoke('getCallLogMetrics', {
      startDate: '2020-01-01',
      endDate: new Date().toISOString().split('T')[0]
    }).then(res => res.data)
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.UserDirectory.list()
  });

  const isLoading = metricsLoading || usersLoading;

  // Note: All aggregation moved to backend. Frontend only displays pre-computed metrics.

  // Handle Excel export (disabled - requires full backend aggregation)
  const handleExport = async () => {
    alert('Export feature requires full aggregation. Coming soon.');
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
  if (metrics.inbound === 0) warnings.push('No inbound call data imported');
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
                onClick={handleExport}
                disabled={isExporting || metrics.inbound === 0}
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
                value={(metrics.inbound + metrics.outbound).toLocaleString()}
                subtitle={`${metrics.inbound} inbound, ${metrics.outbound} outbound`}
                onClick={() => setSelectedMetric({ type: 'inbound', title: 'Inbound Calls', callType: 'inbound' })}
              />
              <KPICard
                title="Inbound"
                value={metrics.inbound.toLocaleString()}
                onClick={() => setSelectedMetric({ type: 'inbound', title: 'Inbound Calls', callType: 'inbound' })}
              />
              <KPICard
                title="Outbound"
                value={metrics.outbound.toLocaleString()}
                onClick={() => setSelectedMetric({ type: 'outbound', title: 'Outbound Calls', callType: 'outbound' })}
              />
              <KPICard
                title="Answered"
                value={metrics.answered.toLocaleString()}
                subtitle={`${formatPercent(metrics.inboundAnswerRate)} of inbound`}
                onClick={() => setSelectedMetric({ type: 'answered', title: 'Answered Calls', callType: 'inbound', filter: { answered: true } })}
              />
              <KPICard
                title="Outbound Answer Rate"
                value={formatPercent(metrics.outboundAnswerRate)}
                subtitle={`${metrics.connectedOutbound} answered of ${metrics.outbound}`}
                variant="rate"
                onClick={() => setSelectedMetric({ type: 'outbound-answered', title: 'Answered Outbound Calls', callType: 'outbound', filter: { result: 'answered' } })}
              />
            </div>

            {/* Second row KPI cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KPICard
                title="Missed"
                value={metrics.missed.toLocaleString()}
                variant="missed"
                onClick={() => setSelectedMetric({ type: 'missed', title: 'Missed Calls', callType: 'inbound', filter: { missed: true } })}
              />
              <KPICard
                title="Inbound Answer Rate (Benchmark)"
                value={formatPercent(metrics.benchmarkAnswerRate)}
                subtitle={`${metrics.benchmarkAnswered} answered of ${metrics.benchmarkInbound}`}
                variant="rate"
              />
              <KPICard
                title="Outbound Answer Rate (Benchmark)"
                value={formatPercent(metrics.benchmarkOutboundAnswerRate)}
                subtitle={`${metrics.benchmarkConnected} answered of ${metrics.benchmarkOutbound}`}
                variant="rate"
              />
            </div>

            {/* Aggregation tables temporarily disabled while backend aggregation is implemented */}
            <Card className="border-slate-200 shadow-sm bg-yellow-50">
              <CardContent className="p-6">
                <p className="text-sm text-slate-700">
                  Weekly, monthly, and performance tables will be re-enabled once backend aggregation is complete.
                  KPI cards are now loading from the backend with instant performance.
                </p>
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
                    queryClient.invalidateQueries({ queryKey: ['call-metrics'] });
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