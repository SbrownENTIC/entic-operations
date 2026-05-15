import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { TrendingUp } from 'lucide-react';

export default function GoalTrackingWidget({ individualData, users }) {
  // Calculate goal metrics for each user
  const goalMetrics = useMemo(() => {
    if (!individualData || !users) return [];

    return individualData
      .map(user => {
        const userConfig = users.find(u => u.id === user.user_id);
        if (!userConfig || !userConfig.daily_goal) return null;

        const dailyGoal = userConfig.daily_goal;
        const weeklyGoal = dailyGoal * 5; // 5 work days
        const totalInbound = user.total_inbound || 0;

        // Estimate weekly based on assuming data is roughly 1 week
        const weeklyTotal = totalInbound;
        const weeklyPercent = weeklyGoal > 0 ? (weeklyTotal / weeklyGoal) : 0;

        return {
          userId: user.user_id,
          userName: user.user_name || 'Unknown',
          dailyGoal,
          weeklyGoal,
          weeklyTotal,
          weeklyPercent: Math.min(weeklyPercent, 1.5), // Cap at 150% for display
          status: weeklyPercent >= 0.85 ? 'green' : weeklyPercent >= 0.7 ? 'yellow' : 'red'
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.weeklyPercent - a.weeklyPercent);
  }, [individualData, users]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'green': return 'text-green-600';
      case 'yellow': return 'text-amber-600';
      case 'red': return 'text-red-600';
      default: return 'text-slate-600';
    }
  };

  const getProgressColor = (status) => {
    switch (status) {
      case 'green': return 'bg-green-500';
      case 'yellow': return 'bg-amber-500';
      case 'red': return 'bg-red-500';
      default: return 'bg-slate-500';
    }
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Weekly Goal Tracking
        </CardTitle>
      </CardHeader>
      <CardContent>
        {goalMetrics.length === 0 ? (
          <p className="text-sm text-slate-500">No users with daily goals configured.</p>
        ) : (
          <div className="space-y-4">
            {goalMetrics.map((metric) => (
              <div key={metric.userId} className="space-y-2">
                <div className="flex justify-between items-baseline">
                  <h3 className="font-medium text-sm text-slate-900">{metric.userName}</h3>
                  <span className={`text-sm font-semibold ${getStatusColor(metric.status)}`}>
                    {(metric.weeklyPercent * 100).toFixed(0)}% of {metric.weeklyGoal} goal
                  </span>
                </div>
                <Progress
                  value={Math.min(metric.weeklyPercent * 100, 150)}
                  className="h-2"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{metric.weeklyTotal} calls</span>
                  <span>Daily: {metric.dailyGoal}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}