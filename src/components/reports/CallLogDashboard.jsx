import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, RefreshCw, Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Clock, Voicemail, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import CallLogUploader from './CallLogUploader';
import ExportFormatDialog from './ExportFormatDialog';
import { generatePDFExport, generateExcelExport } from './CallLogPDFExport';
import { format, subMonths, startOfMonth } from 'date-fns';

// Helper to format seconds to HH:MM:SS
const formatDuration = (seconds) => {
  if (!seconds) return "00:00:00";
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

export default function CallLogDashboard({ user }) {
  const [selectedMonth, setSelectedMonth] = useState(format(startOfMonth(new Date()), 'yyyy-MM-01'));
  const [selectedUser, setSelectedUser] = useState('all');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
  // Generate last 12 months for dropdown
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = subMonths(new Date(), i);
    return {
      value: format(startOfMonth(d), 'yyyy-MM-01'),
      label: format(d, 'MMMM yyyy')
    };
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['callLogStats', selectedMonth, selectedUser],
    queryFn: () => base44.functions.invoke('getCallLogStats', { 
      month: selectedMonth, 
      user: selectedUser 
    }).then(res => res.data),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const summary = data?.summary || {};
  const rawUserBreakdown = data?.user_breakdown || [];
  // Filter out users with zero calls as per requirement
  const userBreakdown = rawUserBreakdown.filter(u => u.total_calls > 0);

  const handleExportClick = () => {
    if (!userBreakdown.length) return;
    setExportDialogOpen(true);
  };

  const handleExportFormat = async (format) => {
    setIsExporting(true);
    try {
      if (format === 'pdf') {
        await generatePDFExport(summary, userBreakdown, selectedMonth);
      } else if (format === 'excel') {
        await generateExcelExport(summary, userBreakdown, selectedMonth);
      } else if (format === 'csv') {
        // Raw CSV export
        const headers = [
          'User', 'Total Calls', 'Inbound', 'Outbound', 'Answered', 'Missed', 'Voicemail', 
          'Total Duration', 'Answer Rate %', 'Avg Duration'
        ];
        
        const csvContent = [
          headers.join(','),
          ...userBreakdown.map(u => [
            `"${u.user}"`,
            u.total_calls,
            u.inbound_calls,
            u.outbound_calls,
            u.answered_calls,
            u.missed_calls,
            u.voicemail_calls,
            formatDuration(u.total_duration_seconds),
            u.answer_rate_percent.toFixed(1),
            formatDuration(u.avg_call_duration_seconds)
          ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `call_logs_${selectedMonth}.csv`;
        link.click();
      }
    } finally {
      setIsExporting(false);
      setExportDialogOpen(false);
    }
  };

  const pieData = [
    { name: 'Answered', value: summary.answered_calls || 0 },
    { name: 'Missed', value: summary.missed_calls || 0 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold">Call Log Reporting</h2>
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Select Month" />
            </SelectTrigger>
            <SelectContent>
              {months.map(m => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedUser} onValueChange={setSelectedUser}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Users" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              {/* If we had a user list, map here. For now rely on data or pre-defined list if available */}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => refetch()} title="Refresh Data">
            <RefreshCw className="w-4 h-4" />
          </Button>

          <Button variant="outline" onClick={handleExportClick} disabled={isExporting}>
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Export Report
              </>
            )}
          </Button>
        </div>
      </div>

      {user?.role === 'admin' && (
        <CallLogUploader onUploadSuccess={refetch} />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard title="Total Calls" value={summary.total_calls} icon={Phone} color="text-blue-600" />
        <MetricCard title="Inbound" value={summary.inbound_calls} icon={PhoneIncoming} color="text-green-600" />
        <MetricCard title="Outbound" value={summary.outbound_calls} icon={PhoneOutgoing} color="text-purple-600" />
        <MetricCard title="Total Duration" value={formatDuration(summary.total_duration_seconds)} icon={Clock} color="text-slate-600" />
        
        <MetricCard title="Answered" value={summary.answered_calls} icon={CheckCircleIcon} color="text-teal-600" />
        <MetricCard title="Missed" value={summary.missed_calls} icon={PhoneMissed} color="text-red-600" />
        <MetricCard title="Answer Rate" value={`${(summary.answer_rate_percent || 0).toFixed(1)}%`} icon={PercentIcon} color="text-indigo-600" />
        <MetricCard title="Avg Duration" value={formatDuration(summary.avg_call_duration_seconds)} icon={Clock} color="text-orange-600" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Answered vs Missed</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={index === 0 ? '#4ade80' : '#f87171'} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Calls by User</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
              <BarChart data={userBreakdown.slice(0, 20)}> {/* Limit to top 20 for readability */}
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="user" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="inbound_calls" stackId="a" fill="#4ade80" name="Inbound" />
                <Bar dataKey="outbound_calls" stackId="a" fill="#818cf8" name="Outbound" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>User Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead className="text-right">Total Calls</TableHead>
                  <TableHead className="text-right">Inbound</TableHead>
                  <TableHead className="text-right">Outbound</TableHead>
                  <TableHead className="text-right">Answered</TableHead>
                  <TableHead className="text-right">Missed</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-right">Answer Rate</TableHead>
                  <TableHead className="text-right">Avg Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {userBreakdown.map((user) => (
                  <TableRow key={user.user}>
                    <TableCell className="font-medium">{user.user}</TableCell>
                    <TableCell className="text-right">{user.total_calls}</TableCell>
                    <TableCell className="text-right">{user.inbound_calls}</TableCell>
                    <TableCell className="text-right">{user.outbound_calls}</TableCell>
                    <TableCell className="text-right">{user.answered_calls}</TableCell>
                    <TableCell className="text-right">{user.missed_calls}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatDuration(user.total_duration_seconds)}</TableCell>
                    <TableCell className="text-right">
                      <span className={`px-2 py-1 rounded text-xs ${user.answer_rate_percent >= 80 ? 'bg-green-100 text-green-800' : user.answer_rate_percent >= 50 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                        {user.answer_rate_percent.toFixed(1)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs">{formatDuration(user.avg_call_duration_seconds)}</TableCell>
                  </TableRow>
                ))}
                {userBreakdown.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center h-24 text-muted-foreground">
                      No data found for selected period.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <ExportFormatDialog 
        open={exportDialogOpen}
        onOpenChange={setExportDialogOpen}
        onExport={handleExportFormat}
        isLoading={isExporting}
      />
    </div>
  );
}

function MetricCard({ title, value, icon: Icon, color }) {
  return (
    <Card>
      <CardContent className="p-6 flex items-center justify-between space-y-0">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <div className={`text-2xl font-bold ${color}`}>{value || 0}</div>
        </div>
        {Icon && <Icon className={`h-8 w-8 opacity-20 ${color}`} />}
      </CardContent>
    </Card>
  );
}

// Icons
function PercentIcon(props) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="19" x2="5" y1="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}

function CheckCircleIcon(props) {
    return (
        <svg
        {...props}
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    )
}