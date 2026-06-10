import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Download, ShieldCheck, Loader2 } from 'lucide-react';
import { auditExport } from '@/lib/auditLogger';

const ACTION_COLORS = {
  CREATE: 'bg-green-100 text-green-800',
  UPDATE: 'bg-blue-100 text-blue-800',
  DELETE: 'bg-red-100 text-red-800',
  VIEW: 'bg-slate-100 text-slate-700',
  EXPORT: 'bg-purple-100 text-purple-800',
  AUTH_EVENT: 'bg-yellow-100 text-yellow-800',
  SECURITY_ALERT: 'bg-orange-100 text-orange-800',
  INTEGRITY_ALERT: 'bg-rose-100 text-rose-800',
};

export default function AuditLogPage() {
  const [filterUser, setFilterUser] = useState('');
  const [filterEntity, setFilterEntity] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['audit-logs'],
    queryFn: () => base44.entities.AuditLog.list('-timestamp', 2000),
  });

  const entityNames = useMemo(() => {
    const names = new Set(logs.map(l => l.entityName).filter(Boolean));
    return Array.from(names).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter(log => {
      if (filterUser && !log.userEmail?.toLowerCase().includes(filterUser.toLowerCase())) return false;
      if (filterEntity !== 'all' && log.entityName !== filterEntity) return false;
      if (filterAction !== 'all' && log.actionType !== filterAction) return false;
      if (filterDateFrom && log.timestamp < filterDateFrom) return false;
      if (filterDateTo && log.timestamp > filterDateTo + 'T23:59:59') return false;
      return true;
    });
  }, [logs, filterUser, filterEntity, filterAction, filterDateFrom, filterDateTo]);

  const handleExportCSV = () => {
    const headers = ['Timestamp', 'User Email', 'Entity', 'Record ID', 'Action', 'Field', 'Old Value', 'New Value'];
    const rows = filtered.map(l => [
      l.timestamp || '',
      l.userEmail || '',
      l.entityName || '',
      l.recordId || '',
      l.actionType || '',
      l.fieldName || '',
      l.oldValue || '',
      l.newValue || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `audit_log_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();

    // Fire-and-forget export audit log — never blocks the download
    auditExport({
      dateRange: { from: filterDateFrom || null, to: filterDateTo || null },
      filters: { user: filterUser || null, entity: filterEntity !== 'all' ? filterEntity : null, action: filterAction !== 'all' ? filterAction : null },
      recordCount: filtered.length,
    }).catch(function(e) { console.error('[Audit]', e); });
  };

  return (
    <div className="h-full min-h-0 overflow-hidden flex flex-col p-6 max-w-none w-full mx-auto gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-7 h-7 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Audit Log</h1>
            <p className="text-sm text-slate-500">HIPAA-compliant activity log — read-only, 6-year retention</p>
          </div>
        </div>
        <Button onClick={handleExportCSV} variant="outline" className="gap-2" disabled={filtered.length === 0}>
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <Input
              placeholder="Filter by user email..."
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
            />
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger><SelectValue placeholder="All Entities" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entities</SelectItem>
                {entityNames.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger><SelectValue placeholder="All Actions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                <SelectItem value="CREATE">CREATE</SelectItem>
                <SelectItem value="UPDATE">UPDATE</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
                <SelectItem value="AUTH_EVENT">AUTH_EVENT</SelectItem>
                <SelectItem value="VIEW">VIEW</SelectItem>
                <SelectItem value="EXPORT">EXPORT</SelectItem>
                <SelectItem value="SECURITY_ALERT">SECURITY_ALERT</SelectItem>
                <SelectItem value="INTEGRITY_ALERT">INTEGRITY_ALERT</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)} placeholder="From date" />
            <Input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)} placeholder="To date" />
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card className="flex-1 min-h-0 flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="text-base">
            {isLoading ? 'Loading...' : `${filtered.length.toLocaleString()} entries`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500">No audit entries found.</div>
          ) : (
            <div className="overflow-auto h-full">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600 whitespace-nowrap">Timestamp</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">User</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Entity</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Record ID</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Action</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Field</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">Old Value</th>
                    <th className="px-4 py-2 text-left font-semibold text-slate-600">New Value</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((log, idx) => (
                    <tr key={log.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-4 py-2 text-slate-500 whitespace-nowrap text-xs">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString('en-US') : '—'}
                      </td>
                      <td className="px-4 py-2 text-slate-700 text-xs">{log.userEmail || '—'}</td>
                      <td className="px-4 py-2 text-slate-700 font-medium">{log.entityName || '—'}</td>
                      <td className="px-4 py-2 text-slate-400 text-xs font-mono">{log.recordId ? log.recordId.substring(0, 12) + '…' : '—'}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${ACTION_COLORS[log.actionType] || 'bg-slate-100 text-slate-700'}`}>
                          {log.actionType}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-slate-600 text-xs">{log.fieldName || '—'}</td>
                      <td className="px-4 py-2 text-red-700 text-xs max-w-[160px] truncate" title={log.oldValue}>{log.oldValue || '—'}</td>
                      <td className="px-4 py-2 text-green-700 text-xs max-w-[160px] truncate" title={log.newValue}>{log.newValue || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}