import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { format, parseISO } from "date-fns";
import OnCallForm from "../components/oncall/OnCallForm";

export default function OnCallSchedule() {
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const queryClient = useQueryClient();

  const { data: schedules = [] } = useQuery({
    queryKey: ['oncall-schedules'],
    queryFn: () => base44.entities.OnCallSchedule.list('-start_date')
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.OnCallSchedule.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oncall-schedules'] });
      setShowForm(false);
      setEditingSchedule(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.OnCallSchedule.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oncall-schedules'] });
      setShowForm(false);
      setEditingSchedule(null);
    }
  });

  const handleSubmit = (data) => {
    if (editingSchedule) {
      updateMutation.mutate({ id: editingSchedule.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const schedulesWithProviders = schedules.map(schedule => ({
    ...schedule,
    provider: providers.find(p => p.id === schedule.provider_id)
  }));

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">On-Call Schedule</h1>
            <p className="text-slate-600 mt-1">Manage provider on-call schedules</p>
          </div>
          <Button
            onClick={() => {
              setEditingSchedule(null);
              setShowForm(true);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Schedule
          </Button>
        </div>

        {showForm && (
          <OnCallForm
            schedule={editingSchedule}
            providers={providers}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingSchedule(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        )}

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <h2 className="text-lg font-semibold">Upcoming On-Call Shifts</h2>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Provider</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Start Date</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">End Date</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Time</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Location</th>
                  </tr>
                </thead>
                <tbody>
                  {schedulesWithProviders.map((schedule) => (
                    <tr key={schedule.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        <p className="font-medium text-slate-900">{schedule.provider?.full_name}</p>
                      </td>
                      <td className="p-4 text-slate-600">
                        {format(parseISO(schedule.start_date), 'MMM d, yyyy')}
                      </td>
                      <td className="p-4 text-slate-600">
                        {format(parseISO(schedule.end_date), 'MMM d, yyyy')}
                      </td>
                      <td className="p-4 text-slate-600">
                        {schedule.start_time && schedule.end_time 
                          ? `${schedule.start_time} - ${schedule.end_time}`
                          : '-'}
                      </td>
                      <td className="p-4 text-slate-600">{schedule.location || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {schedulesWithProviders.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No schedules found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}