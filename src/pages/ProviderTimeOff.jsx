import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Calendar, ArrowUpDown, ArrowUp, ArrowDown, Download, X, Check, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format, parseISO, differenceInDays, isWithinInterval, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay } from "date-fns";
import TimeOffForm from "../components/timeoff/TimeOffForm";
import BulkSyncModal from "../components/timeoff/BulkSyncModal";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ProviderTimeOff() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingTimeOff, setEditingTimeOff] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sortField, setSortField] = useState('start_date');
  const [sortDirection, setSortDirection] = useState('asc');
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'calendar'
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedEntries, setSelectedEntries] = useState([]);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkProvider, setBulkProvider] = useState('');
  const [bulkReason, setBulkReason] = useState('');
  const [providerSelectOpen, setProviderSelectOpen] = useState(false);
  const [viewingDayEntries, setViewingDayEntries] = useState(null); // New state for day entries modal
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
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

  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ ids, updateData }) => {
      const updates = ids.map(id => 
        base44.entities.ProviderTimeOff.update(id, updateData)
      );
      return Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-timeoff'] });
      setSelectedEntries([]);
      setBulkStatus('');
      setBulkProvider('');
      setBulkReason('');
    }
  });

  const handleSubmit = async (data) => {
    if (editingTimeOff) {
      updateMutation.mutate({ id: editingTimeOff.id, data });
    } else {
      if (Array.isArray(data)) {
        // Handle multiple entries (bulk creation)
        try {
          await Promise.all(data.map(entry => base44.entities.ProviderTimeOff.create(entry)));
          queryClient.invalidateQueries({ queryKey: ['provider-timeoff'] });
          setShowForm(false);
          setEditingTimeOff(null);
        } catch (error) {
          console.error("Error creating multiple time off entries:", error);
          // Optionally show error toast
        }
      } else {
        createMutation.mutate(data);
      }
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

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedEntries(sortedEntries.map(entry => entry.id));
    } else {
      setSelectedEntries([]);
    }
  };

  const handleSelectEntry = (entryId, checked) => {
    if (checked) {
      setSelectedEntries([...selectedEntries, entryId]);
    } else {
      setSelectedEntries(selectedEntries.filter(id => id !== entryId));
    }
  };

  const handleBulkUpdateStatus = () => {
    if (selectedEntries.length > 0 && bulkStatus) {
      bulkUpdateMutation.mutate({ ids: selectedEntries, updateData: { status: bulkStatus } });
    }
  };

  const handleBulkUpdateProvider = () => {
    if (selectedEntries.length > 0 && bulkProvider) {
      bulkUpdateMutation.mutate({ ids: selectedEntries, updateData: { provider_id: bulkProvider } });
    }
  };

  const handleBulkUpdateReason = () => {
    if (selectedEntries.length > 0 && bulkReason) {
      bulkUpdateMutation.mutate({ ids: selectedEntries, updateData: { reason: bulkReason } });
    }
  };

  const handleSync = async ({ providerId, datesToAdd, idsToDelete }) => {
    setIsSyncing(true);
    try {
      // 1. Delete removed entries
      if (idsToDelete.length > 0) {
        await Promise.all(idsToDelete.map(id => base44.entities.ProviderTimeOff.delete(id)));
      }

      // 2. Add new entries
      if (datesToAdd.length > 0) {
        const newEntries = datesToAdd.map(dateStr => ({
          provider_id: providerId,
          start_date: dateStr,
          end_date: dateStr, // Single day default
          type: 'time_off',
          status: 'approved',
          reason: 'Bulk Sync Import'
        }));
        // Batch create (could be large, doing in parallel)
        await Promise.all(newEntries.map(entry => base44.entities.ProviderTimeOff.create(entry)));
      }

      queryClient.invalidateQueries({ queryKey: ['provider-timeoff'] });
      setShowSyncModal(false);
      // Optional: Show success toast
    } catch (error) {
      console.error("Sync failed", error);
      alert("Sync failed: " + error.message);
    } finally {
      setIsSyncing(false);
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
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Add empty cells for days before the start of the month to align with weekday headers
  const startDayOfWeek = getDay(monthStart); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const calendarDays = [...Array(startDayOfWeek).fill(null), ...monthDays];

  const getEntriesForDay = (day) => {
    if (!day) return []; // Handle null days for padding
    return sortedEntries.filter(entry => {
      const start = parseISO(entry.start_date);
      const end = parseISO(entry.end_date);
      return isWithinInterval(day, { start, end }) || isSameDay(day, start) || isSameDay(day, end);
    });
  };

  const selectedProviderForBulk = providers.find(p => p.id === bulkProvider);

  return (
    <>
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="flex-shrink-0 p-2 md:p-3">
        <div className="max-w-7xl mx-auto space-y-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Provider Time Off & CME Tracker</h1>
            <p className="text-slate-600 text-sm">Track provider absences, partial days, and CME events</p>
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
              onClick={() => setShowSyncModal(true)}
              variant="outline"
              className="border-green-600 text-green-600 hover:bg-green-50 gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Bulk Sync
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

        <BulkSyncModal
          isOpen={showSyncModal}
          onClose={() => setShowSyncModal(false)}
          providers={providers}
          existingEntries={timeOffEntries}
          onSync={handleSync}
          isLoading={isSyncing}
        />
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-4 md:px-6 pb-4">
        <div className="max-w-7xl mx-auto h-full">
        {viewMode === 'list' ? (
          <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm h-full flex flex-col">
            <CardHeader className="border-b border-slate-100 space-y-4 flex-shrink-0">
              <div className="flex items-center gap-4">
                <Search className="w-5 h-5 text-slate-400" />
                <Input
                  placeholder="Search by provider, reason, or type..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="max-w-md border-slate-200"
                />
              </div>
              {selectedEntries.length > 0 && (
                <div className="flex flex-col gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">
                      {selectedEntries.length} selected
                    </span>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedEntries([])}
                    >
                      Clear Selection
                    </Button>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-700">Change Provider:</span>
                      <Popover open={providerSelectOpen} onOpenChange={setProviderSelectOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={providerSelectOpen}
                            className="w-64 justify-between font-normal"
                          >
                            {selectedProviderForBulk ? selectedProviderForBulk.full_name : "Select provider..."}
                            <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search providers..." />
                            <CommandEmpty>No provider found.</CommandEmpty>
                            <CommandGroup className="max-h-64 overflow-auto">
                              {providers.map((provider) => (
                                <CommandItem
                                  key={provider.id}
                                  value={provider.full_name}
                                  onSelect={() => {
                                    setBulkProvider(provider.id);
                                    setProviderSelectOpen(false);
                                  }}
                                >
                                  <Check
                                    className={`mr-2 h-4 w-4 ${
                                      bulkProvider === provider.id ? "opacity-100" : "opacity-0"
                                    }`}
                                  />
                                  {provider.full_name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </Command>
                        </PopoverContent>
                      </Popover>
                      <Button 
                        onClick={handleBulkUpdateProvider}
                        disabled={!bulkProvider || bulkUpdateMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {bulkUpdateMutation.isPending ? 'Updating...' : 'Update Provider'}
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-700">Change Status:</span>
                      <Select value={bulkStatus} onValueChange={setBulkStatus}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Select status..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="declined">Declined</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        onClick={handleBulkUpdateStatus}
                        disabled={!bulkStatus || bulkUpdateMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {bulkUpdateMutation.isPending ? 'Updating...' : 'Update Status'}
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-slate-700">Change Reason:</span>
                      <Input
                        placeholder="Enter reason..."
                        value={bulkReason}
                        onChange={(e) => setBulkReason(e.target.value)}
                        className="w-64"
                      />
                      <Button 
                        onClick={handleBulkUpdateReason}
                        disabled={!bulkReason || bulkUpdateMutation.isPending}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        {bulkUpdateMutation.isPending ? 'Updating...' : 'Update Reason'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
              <div className="overflow-auto h-full">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                    <tr>
                      <th className="text-left p-4 text-sm font-semibold text-slate-700 w-12">
                        <input
                          type="checkbox"
                          checked={selectedEntries.length === sortedEntries.length && sortedEntries.length > 0}
                          onChange={(e) => handleSelectAll(e.target.checked)}
                          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        />
                      </th>
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
                      <tr key={entry.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedEntries.includes(entry.id) ? 'bg-blue-50' : ''}`}>
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={selectedEntries.includes(entry.id)}
                            onChange={(e) => handleSelectEntry(entry.id, e.target.checked)}
                            className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                        </td>
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
                    No time off entries found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200 shadow-sm h-full flex flex-col">
            <CardHeader className="border-b border-slate-100 flex-shrink-0">
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
            <CardContent className="p-6 flex-1 overflow-auto">
              <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="text-center font-semibold text-slate-700 text-sm p-2">
                    {day}
                  </div>
                ))}
                {calendarDays.map((day, index) => {
                  if (!day) {
                    // Render empty div for padding before the first day of the month
                    return <div key={`empty-${index}`} className="min-h-24" />;
                  }
                  
                  const dayEntries = getEntriesForDay(day);
                  const isToday = isSameDay(day, new Date());
                  
                  return (
                    <div
                      key={index}
                      className={`min-h-24 p-2 border rounded-lg ${dayEntries.length > 0 ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${
                        isToday ? 'bg-blue-50 border-blue-300' : 'bg-white border-slate-200'
                      }`}
                      onClick={() => dayEntries.length > 0 && setViewingDayEntries({ day, entries: dayEntries })}
                    >
                      <div className={`text-sm font-medium mb-1 ${isToday ? 'text-blue-700' : 'text-slate-700'}`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-1">
                        {dayEntries.slice(0, 3).map((entry, idx) => (
                          <div
                            key={idx}
                            className={`text-xs p-1.5 rounded ${
                              entry.type === 'time_off' ? 'bg-blue-100 text-blue-800' :
                              entry.type === 'cme' ? 'bg-purple-100 text-purple-800' :
                              entry.type === 'partial_day' ? 'bg-orange-100 text-orange-800' :
                              'bg-green-100 text-green-800'
                            }`}
                            title={`${entry.provider?.full_name} - ${entry.reason || formatType(entry.type)}`}
                          >
                            <div className="font-medium truncate">{entry.provider?.full_name}</div>
                            <div className="text-xs opacity-75">{formatType(entry.type)}</div>
                          </div>
                        ))}
                        {dayEntries.length > 3 && (
                          <div className="text-xs text-slate-500 font-medium px-1">
                            +{dayEntries.length - 3} more
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
        </div>
      </div>
    </div>

      {/* Add/Edit Time Off Modal */}
      <Dialog open={showForm} onOpenChange={(open) => {
        if (!open) {
          setShowForm(false);
          setEditingTimeOff(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 [&>button]:hidden">
          <TimeOffForm
            timeOff={editingTimeOff}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingTimeOff(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Day Entries Modal */}
      <Dialog open={!!viewingDayEntries} onOpenChange={() => setViewingDayEntries(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {viewingDayEntries && format(viewingDayEntries.day, 'EEEE, MMMM d, yyyy')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-96 overflow-y-auto pr-2 -mr-2"> {/* Added pr-2 -mr-2 for custom scrollbar spacing */}
            {viewingDayEntries?.entries.map((entry) => (
              <div key={entry.id} className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-semibold text-slate-900">{entry.provider?.full_name}</span>
                      <Badge className={typeColors[entry.type]}>
                        {formatType(entry.type)}
                      </Badge>
                      <Badge className={statusColors[entry.status]}>
                        {formatStatus(entry.status)}
                      </Badge>
                    </div>
                    <div className="text-sm text-slate-600 space-y-1">
                      <div>
                        <span className="font-medium">Dates:</span> {format(parseISO(entry.start_date), 'MMM d')} - {format(parseISO(entry.end_date), 'MMM d, yyyy')} ({entry.days} {entry.days === 1 ? 'day' : 'days'})
                      </div>
                      {entry.reason && (
                        <div>
                          <span className="font-medium">Reason:</span> {entry.reason}
                        </div>
                      )}
                      {entry.partial_day_end_time && (
                        <div className="text-orange-600">
                          <span className="font-medium">Ends at:</span> {entry.partial_day_end_time}
                        </div>
                      )}
                      {entry.notes && (
                        <div>
                          <span className="font-medium">Notes:</span> {entry.notes}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 pl-4">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setEditingTimeOff(entry);
                        setShowForm(true);
                        setViewingDayEntries(null); // Close the day entries modal when editing
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => {
                        setDeleteConfirm(entry);
                        setViewingDayEntries(null); // Close the day entries modal to show alert dialog
                      }}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

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
    </>
  );
}