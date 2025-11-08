import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, ChevronLeft, ChevronRight } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, isSameDay, startOfWeek, endOfWeek, startOfDay } from "date-fns";
import OnCallForm from "../components/oncall/OnCallForm";

const PROVIDER_COLORS = [
  "bg-green-500",
  "bg-orange-500", 
  "bg-yellow-500",
  "bg-blue-500",
  "bg-purple-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-red-500",
  "bg-indigo-500",
  "bg-cyan-500"
];

export default function OnCallSchedule() {
  const [showForm, setShowForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
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

  const handleEditSchedule = (schedule) => {
    setEditingSchedule(schedule);
    setShowForm(true);
  };

  // Assign consistent colors to providers
  const providerColorMap = useMemo(() => {
    const map = {};
    providers.forEach((provider, index) => {
      map[provider.id] = PROVIDER_COLORS[index % PROVIDER_COLORS.length];
    });
    return map;
  }, [providers]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const weeks = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  const schedulesWithProviders = schedules.map(schedule => ({
    ...schedule,
    provider: providers.find(p => p.id === schedule.provider_id),
    color: providerColorMap[schedule.provider_id] || PROVIDER_COLORS[0]
  }));

  const getSchedulesForDay = (day) => {
    const dayStart = startOfDay(day);
    return schedulesWithProviders.filter(schedule => {
      const start = startOfDay(parseISO(schedule.start_date));
      const end = startOfDay(parseISO(schedule.end_date));
      return dayStart >= start && dayStart <= end;
    });
  };

  const isFirstDayOfSchedule = (schedule, day, weekDays) => {
    const scheduleStart = startOfDay(parseISO(schedule.start_date));
    const dayStart = startOfDay(day);
    
    // First day of the schedule overall
    if (isSameDay(scheduleStart, dayStart)) return true;
    
    // First day of the week (Sunday) if schedule continues from previous week
    if (day.getDay() === 0 && dayStart > scheduleStart) return true;
    
    return false;
  };

  const getScheduleSpan = (schedule, day, weekDays) => {
    const scheduleStart = startOfDay(parseISO(schedule.start_date));
    const scheduleEnd = startOfDay(parseISO(schedule.end_date));
    const dayStart = startOfDay(day);
    
    const dayIndex = weekDays.findIndex(d => isSameDay(d, day));
    let span = 0;
    
    for (let i = dayIndex; i < weekDays.length; i++) {
      const currentDay = startOfDay(weekDays[i]);
      if (currentDay >= scheduleStart && currentDay <= scheduleEnd) {
        span++;
      } else {
        break;
      }
    }
    
    return span;
  };

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-[1800px] mx-auto space-y-6">
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

        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="bg-white overflow-x-auto">
              {/* Calendar Header */}
              <div className="grid grid-cols-7 border-b border-slate-200 min-w-[900px]">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="p-3 text-center text-sm font-semibold text-slate-700 border-r border-slate-200 last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="min-w-[900px]">
                {weeks.map((week, weekIndex) => (
                  <div key={weekIndex} className="grid grid-cols-7" style={{ minHeight: '100px' }}>
                    {week.map((day, dayIndex) => {
                      const daySchedules = getSchedulesForDay(day);
                      const isCurrentMonth = isSameMonth(day, currentMonth);
                      
                      return (
                        <div
                          key={dayIndex}
                          className={`border-r border-b border-slate-200 last:border-r-0 p-2 relative ${
                            !isCurrentMonth ? 'bg-slate-50' : 'bg-white'
                          }`}
                        >
                          <div className={`text-sm font-medium mb-2 ${
                            !isCurrentMonth ? 'text-slate-400' : 'text-slate-700'
                          }`}>
                            {format(day, 'd')}
                          </div>
                          
                          <div className="space-y-1">
                            {daySchedules.map((schedule, schedIndex) => {
                              const isFirstDay = isFirstDayOfSchedule(schedule, day, week);
                              
                              if (!isFirstDay) return null;
                              
                              const span = getScheduleSpan(schedule, day, week);
                              
                              return (
                                <div
                                  key={schedule.id}
                                  onClick={() => handleEditSchedule(schedule)}
                                  className={`absolute left-2 right-0 ${schedule.color} text-white text-xs px-2 py-1.5 rounded cursor-pointer hover:opacity-90 transition-opacity shadow-sm z-10`}
                                  style={{
                                    width: `calc(${span * 100}% + ${(span - 1) * 100}%)`,
                                    top: `${40 + schedIndex * 36}px`
                                  }}
                                >
                                  <div className="font-semibold truncate">
                                    {schedule.start_time} - {schedule.end_time}
                                  </div>
                                  <div className="font-medium truncate">
                                    {schedule.provider?.full_name}
                                  </div>
                                  {schedule.provider?.phone && (
                                    <div className="truncate text-[10px] opacity-90">
                                      {schedule.provider.phone}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}