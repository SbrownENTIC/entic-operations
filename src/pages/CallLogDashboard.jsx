import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { forceRefreshCallLogData } from '@/lib/callLogCache';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2, Download, RefreshCw } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatPercent, KPICard } from '@/components/calllog/CallLogMetrics';
import CallLogDetailModal from '@/components/calllog/CallLogDetailModal';
import WeeklyTable from '@/components/calllog/WeeklyTable';
import MonthlyTable from '@/components/calllog/MonthlyTable';
import IndividualPerformanceTable from '@/components/calllog/IndividualPerformanceTable';
import CDRUpload from '@/components/calllog/CDRUpload';
import UserDirectoryTable from '@/components/calllog/UserDirectoryTable';
import UnmappedExtensionsAlert from '@/components/calllog/UnmappedExtensionsAlert';
import GoalTrackingWidget from '@/components/calllog/GoalTrackingWidget';

const EMPTY_METRICS = {
  totalCalls: 0,
  totalInbound: 0,
  totalOutbound: 0,
  totalAnswered: 0,
  totalMissed: 0,
  inboundAnswerRate: 0,
  connectedOutbound: 0,
  outboundContactRate: 0,
  totalContacted: 0,
  overallContactRate: 0,
  benchmarkInbound: 0,
  benchmarkAnswered: 0,
  benchmarkAnswerRate: 0,
  frontDeskInbound: 0,
  frontDeskAnswered: 0,
  frontDeskAnswerRate: 0,
  unmappedCount: 0,
  unmappedExtensions: [],
};

const EMPTY_REPORT = {
  metrics: EMPTY_METRICS,
  weeklyData: [],
  monthlyData: [],
  individualData: [],
  users: [],
  unmappedData: [],
  inboundCount: 0,
  outboundCount: 0,
};

function downloadBase64File(base64Data, filename, mimeType) {
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

export default function CallLogDashboard() {
  const [selectedMetric, setSelectedMetric] = useState(null);
  const [activeTab, setActiveTab] = useState('reporting');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const queryClient = useQueryClient();

  const { data: report = EMPTY_REPORT, isLoading: reportLoading } = useQuery({
    queryKey: ['call-log-report'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getCallLogReportBundle', {});
      return response.data?.report ?? EMPTY_REPORT;
    },
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const {
    metrics = EMPTY_METRICS,
    weeklyData = [],
    monthlyData = [],
    individualData = [],
    users = [],
    unmappedData = [],
    inboundCount = 0,
    outboundCount = 0,
  } = report;

  const hasData = inboundCount > 0 || outboundCount > 0;
  const isInitialLoading = reportLoading && !hasData && !isRefreshing;

  const frontendData = useMemo(
    () => individualData.filter((u) => u.benchmark_group === 'Front Desk'),
    [individualData]
  );

  const npCoordinatorData = useMemo(
    () => individualData.filter((u) => u.benchmark_group === 'NP Coordinator'),
    [individualData]
  );

  const individualPerformanceData = useMemo(
    () => individualData.filter(
      (u) => u.benchmark_group === 'Front Desk' || u.benchmark_group === 'NP Coordinator'
    ),
    [individualData]
  );

  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      await forceRefreshCallLogData(queryClient);
    } catch (error) {
      console.error('Call Log manual refresh failed:', error);
      alert('Failed to refresh call log data. Please try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleKpiClick = async (filterType) => {
    setSelectedMetric({
      type: filterType,
      title: 'Loading…',
      data: [],
      totalCount: 0,
      loading: true,
    });

    try {
      const response = await base44.functions.invoke('getCallLogDetailRecords', {
        filterType,
        limit: 500,
      });

      const payload = response.data;
      setSelectedMetric({
        type: filterType,
        title: payload?.title || 'Call Records',
        data: payload?.records || [],
        totalCount: payload?.totalCount || 0,
        loading: false,
      });
    } catch (error) {
      console.error('Failed to load KPI detail records:', error);
      setSelectedMetric(null);
      alert('Failed to load call details. Please try again.');
    }
  };

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const response = await base44.functions.invoke('exportCallLogExcel', {
        weeklyData,
        monthlyData,
        frontendData,
        individualData: individualPerformanceData,
      });

      const base64Data = response.data?.file_base64;
      if (!base64Data) {
        throw new Error(response.data?.error || 'Export failed');
      }

      downloadBase64File(
        base64Data,
        response.data.filename || `CallLog_Report_${new Date().toISOString().split('T')[0]}.xlsx`,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      );
    } catch (error) {
      alert(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="p-6 bg-slate-50 min-h-screen flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        <p className="text-sm text-slate-600">Building call log report…</p>
      </div>
    );
  }

  const warnings = [];
  if (inboundCount === 0) warnings.push('No inbound call data imported');
  if (users.filter((u) => u.include_in_benchmark).length === 0) {
    warnings.push('No benchmark users configured');
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Call Log Dashboard</h1>
            <p className="text-slate-600 mt-1">Inbound/outbound metrics and performance analysis</p>
          </div>
          <Button
            variant="outline"
            onClick={handleRefreshData}
            disabled={isRefreshing}
            className="gap-2 shrink-0 border-blue-200 text-blue-700 hover:bg-blue-50"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing…' : 'Refresh Data'}
          </Button>
        </div>

        {isRefreshing && (
          <Alert className="border-blue-200 bg-blue-50">
            <Loader2 className="w-4 h-4 animate-spin text-blue-700" />
            <AlertDescription className="text-blue-900">
              Rebuilding call log report from server…
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="reporting">Reporting</TabsTrigger>
            <TabsTrigger value="upload">Upload CDR</TabsTrigger>
            <TabsTrigger value="users">User Directory</TabsTrigger>
          </TabsList>

          <TabsContent value="reporting" className="space-y-6 mt-4">
            <div className="flex justify-end">
              <Button
                onClick={handleExportExcel}
                disabled={isExporting || (inboundCount === 0 && outboundCount === 0)}
                className="gap-2"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isExporting ? 'Exporting…' : 'Export to Excel'}
              </Button>
            </div>

            <UnmappedExtensionsAlert unmappedData={unmappedData} />

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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard
                title="Total Calls"
                value={metrics.totalCalls.toLocaleString()}
                subtitle={`${metrics.totalInbound} inbound, ${metrics.totalOutbound} outbound`}
                onClick={() => handleKpiClick('total')}
              />
              <KPICard
                title="Inbound"
                value={metrics.totalInbound.toLocaleString()}
                onClick={() => handleKpiClick('inbound')}
              />
              <KPICard
                title="Outbound"
                value={metrics.totalOutbound.toLocaleString()}
                onClick={() => handleKpiClick('outbound')}
              />
              <KPICard
                title="Answered"
                value={metrics.totalAnswered.toLocaleString()}
                subtitle={`${formatPercent(metrics.inboundAnswerRate)} of inbound`}
                onClick={() => handleKpiClick('answered')}
              />
              <KPICard
                title="Missed"
                value={metrics.totalMissed.toLocaleString()}
                variant="missed"
                onClick={() => handleKpiClick('missed')}
              />
              <KPICard
                title="Outbound Contact Rate"
                value={formatPercent(metrics.outboundContactRate)}
                subtitle={`${metrics.connectedOutbound} connected of ${metrics.totalOutbound}`}
                variant="rate"
                onClick={() => handleKpiClick('outbound-connected')}
              />
              <KPICard
                title="Benchmark Answer Rate"
                value={formatPercent(metrics.benchmarkAnswerRate)}
                subtitle={`${metrics.benchmarkAnswered} answered of ${metrics.benchmarkInbound}`}
                variant="rate"
                onClick={() => handleKpiClick('benchmark-inbound')}
              />
              <KPICard
                title="Overall Contact Rate"
                value={formatPercent(metrics.overallContactRate)}
                subtitle={`${metrics.totalContacted} contacted of ${metrics.totalCalls}`}
                variant="rate"
                onClick={() => handleKpiClick('overall-contacted')}
              />
            </div>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Weekly Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <WeeklyTable data={weeklyData} />
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Monthly KPI Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <MonthlyTable data={monthlyData} />
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Front-End Performance (Front Desk Benchmark)</CardTitle>
              </CardHeader>
              <CardContent>
                <IndividualPerformanceTable data={frontendData} showOutbound={true} defaultSort="overall_contact_rate" />
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>NP Coordinator Performance (NP Coordinator Benchmark)</CardTitle>
              </CardHeader>
              <CardContent>
                <IndividualPerformanceTable data={npCoordinatorData} showOutbound={true} defaultSort="overall_contact_rate" />
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Individual Performance (Front Desk &amp; NP Coordinator)</CardTitle>
              </CardHeader>
              <CardContent>
                <IndividualPerformanceTable data={individualPerformanceData} showOutbound={true} defaultSort="overall_contact_rate" />
              </CardContent>
            </Card>

            <GoalTrackingWidget individualData={individualData} users={users} />
          </TabsContent>

          <TabsContent value="upload" className="space-y-6 mt-4">
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-base">Import Call Records</CardTitle>
              </CardHeader>
              <CardContent>
                <CDRUpload
                  onUploadSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['call-log-report'] });
                  }}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-4">
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

        {selectedMetric && (
          <CallLogDetailModal
            metric={selectedMetric}
            loading={selectedMetric.loading}
            onClose={() => setSelectedMetric(null)}
          />
        )}
      </div>
    </div>
  );
}
