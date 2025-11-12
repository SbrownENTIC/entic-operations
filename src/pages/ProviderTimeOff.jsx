import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Calendar, ArrowUpDown, ArrowUp, ArrowDown, Download } from "lucide-react";
import { format, parseISO, differenceInDays, isWithinInterval, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from "date-fns";
import TimeOffForm from "../components/timeoff/TimeOffForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ProviderTimeOff() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingTimeOff, setEditingTimeOff] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sortField, setSortField] = useState('start_date');
  const [sortDirection, setSortDirection] = useState('asc');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const queryClient = useQueryClient();

  const { data: timeOffEntries = [], isLoading: timeOffLoading } = useQuery({
    queryKey: ['provider-timeoff'],
    queryFn: () => base44.entities.ProviderTimeOff.list('start_date')
  });

  const { data: providers = [], isLoading: providersLoading } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ProviderTimeOff.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-timeoff'] });
      setShowForm(false);
      setEditingTimeOff(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProviderTimeOff.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-timeoff'] });
      setShowForm(false);
      setEditingTimeOff(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProviderTimeOff.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-timeoff'] });
      setDeleteConfirm(null);
    }
  });

  const handleSubmit = (data) => {
    if (editingTimeOff) {
      updateMutation.mutate({ id: editingTimeOff.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const exportToCSV = () => {
    const rows = [
      ['Provider', 'Type', 'Start Date', 'End Date', 'Days', 'End Time', 'Reason', 'Status', 'Notes']
    ];
    
    sortedEntries.forEach(entry => {
      const provider = providers.find(p => p.id === entry.provider_id);
      const days = differenceInDays(parseISO(entry.end_date), parseISO(entry.start_date)) + 1;
      
      rows.push([
        provider?.full_name || '',
        entry.type?.replace(/_/g, ' ') || '',
        format(parseISO(entry.start_date), 'yyyy-MM-dd'),
        format(parseISO(entry.end_date), 'yyyy-MM-dd'),
        days,
        entry.partial_day_end_time || '',
        entry.reason || '',
        entry.status || '',
        entry.notes || ''
      ]);
    });
    
    const csvContent = rows.map(row => 
      row.map(cell => {
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return '"' + cellStr.replace(/"/g, '""') + '"';
        }
        return cellStr;
      }).join(',')
    ).join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `provider_timeoff_${format(new Date(), 'yyyy-MM-dd')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (timeOffLoading || providersLoading) {
    return (
      <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12 text-slate-500">Loading...</div>
        </div>
      </div>
    );
  }

  const entriesWithProviders = timeOffEntries.map(entry => ({
    ...entry,
    provider: providers.find(p => p.id === entry.provider_id),
    providerName: providers.find(p => p.id === entry.provider_id)?.full_name || '',
    days: differenceInDays(parseISO(entry.end_date), parseISO(entry.start_date)) + 1
  }));

  const filteredEntries = entriesWithProviders.filter(entry =>
    entry.providerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.type?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedEntries = [...filteredEntries].sort((a, b) => {
    let aValue, bValue;
    
    if (sortField === 'start_date' || sortField === 'end_date') {
      aValue = new Date(a[sortField]);
      bValue = new Date(b[sortField]);
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    } else if (sortField === 'days') {
      aValue = a.days || 0;
      bValue = b.days || 0;
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    } else {
      aValue = a[sortField] || '';
      bValue = b[sortField] || '';
    }
    
    const comparison = aValue.toString().toLowerCase().localeCompare(bValue.toString().toLowerCase());
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 ml-1 inline" />;
    return sortDirection === 'asc' ? 
      <ArrowUp className="w-4 h-4 ml-1 inline" /> : 
      <ArrowDown className="w-4 h-4 ml-1 inline" />;
  };

  const typeColors = {
    time_off: "bg-blue-100 text-blue-800",
    cme: "bg-purple-100 text-purple-800",
    partial_day: "bg-orange-100 text-orange-800",
    holiday: "bg-green-100 text-green-800"
  };

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    declined: "bg-red-100 text-red-800"
  };

  const formatType = (type) => {
    if (!type) return '';
    return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const formatStatus = (status) => {
    if (!status) return '';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  // Calendar view logic
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getEntriesForDay = (day) => {
    return sortedEntries.filter(entry => {
      const start = parseISO(entry.start_date);
      const end = parseISO(entry.end_date);
      return isWithinInterval(day, { start, end }) || isSameDay(day, start) || isSameDay(day, end);
    });
  };

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Provider Time Off & CME Tracker</h1>
            <p className="text-slate-600 mt-1">Track provider absences, partial days, and CME events</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setViewMode(viewMode === 'list' ? 'calendar' : 'list')}
              className="gap-2"
            >
              <Calendar className="w-4 h-4" />
              {viewMode === 'list' ? 'Calendar View' : 'List View'}
            </Button>
            <Button
              onClick={exportToCSV}
              variant="outline"
              className="border-blue-600 text-blue-600 hover:bg-blue-50 gap-2"
            >
              <Download className="w-4 h-4" />
              Export
            </Button>
            <Button
              onClick={() => {
                setEditingTimeOff(null);
                setShowForm(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Entry
            </Button>
          </div>
        </div>

        {showForm && (
          <TimeOffForm
            timeOff={editingTimeOff}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingTimeOff(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        )}

        {viewMode === 'list' ? (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center gap-4">
                <Search className="w-5 h-5 text-slate-400" />
                <Input
                  placeholder="Search by provider, reason, or type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-md border-slate-200"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th 
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('providerName')}
                      >
                        Provider <SortIcon field="providerName" />
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('type')}
                      >
                        Type <SortIcon field="type" />
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('start_date')}
                      >
                        Start Date <SortIcon field="start_date" />
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('end_date')}
                      >
                        End Date <SortIcon field="end_date" />
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('days')}
                      >
                        Days <SortIcon field="days" />
                      </th>
                      <th className="text-left p-4 text-sm font-semibold text-slate-700">
                        Reason
                      </th>
                      <th 
                        className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100"
                        onClick={() => handleSort('status')}
                      >
                        Status <SortIcon field="status" />
                      </th>
                      <th className="text-right p-4 text-sm font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedEntries.map((entry) => (
                      <tr key={entry.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="p-4 font-medium text-slate-900">{entry.provider?.full_name}</td>
                        <td className="p-4">
                          <Badge className={typeColors[entry.type]}>
                            {formatType(entry.type)}
                          </Badge>
                        </td>
                        <td className="p-4 text-slate-600">
                          {format(parseISO(entry.start_date), 'MMM d, yyyy')}
                        </td>
                        <td className="p-4 text-slate-600">
                          {format(parseISO(entry.end_date), 'MMM d, yyyy')}
                        </td>
                        <td className="p-4 text-slate-600">
                          {entry.days} {entry.days === 1 ? 'day' : 'days'}
                          {entry.partial_day_end_time && (
                            <span className="block text-xs text-orange-600">
                              Ends at {entry.partial_day_end_time}
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-slate-600">{entry.reason || '-'}</td>
                        <td className="p-4">
                          <Badge className={statusColors[entry.status]}>
                            {formatStatus(entry.status)}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex gap-2 justify-end">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => {
                                setEditingTimeOff(entry);
                                setShowForm(true);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setDeleteConfirm(entry)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sortedEntries.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    No entries found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold">
                  {format(currentMonth, 'MMMM yyyy')}
                </h2>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center font-semibold text-slate-700 text-sm p-2">
                    {day}
                  </div>
                ))}
                {calendarDays.map((day, index) => {
                  const dayEntries = getEntriesForDay(day);
                  const isToday = isSameDay(day, new Date());
                  
                  return (
                    <div
                      key={index}
                      className={`min-h-24 p-2 border rounded-lg ${
                        isToday ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-1">
                        {dayEntries.map((entry, idx) => (
                          <div
                            key={idx}
                            className={`text-xs p-1 rounded truncate ${
                              entry.type === 'time_off' ? 'bg-blue-100 text-blue-800' :
                              entry.type === 'cme' ? 'bg-purple-100 text-purple-800' :
                              entry.type === 'partial_day' ? 'bg-orange-100 text-orange-800' :
                              'bg-green-100 text-green-800'
                            }`}
                            title={`${entry.provider?.full_name} - ${entry.reason || entry.type}`}
                          >
                            {entry.provider?.full_name?.split(' ')[0]}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Time Off Entry</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this entry for {deleteConfirm?.provider?.full_name}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteConfirm.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}