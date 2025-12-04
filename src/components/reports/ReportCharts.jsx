import React from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { format, parseISO, startOfMonth } from 'date-fns';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const formatCurrency = (value) => `$${value.toLocaleString()}`;

export function PaymentTrendChart({ payments }) {
  // Aggregate payments by month
  const data = React.useMemo(() => {
    const grouped = {};
    payments.forEach(p => {
      if (!p.payment_date) return;
      const month = format(startOfMonth(parseISO(p.payment_date)), 'yyyy-MM');
      if (!grouped[month]) grouped[month] = 0;
      grouped[month] += p.total_amount || 0;
    });

    return Object.entries(grouped)
      .map(([month, amount]) => ({
        month,
        displayMonth: format(parseISO(month + '-01'), 'MMM yyyy'),
        amount
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12); // Last 12 months
  }, [payments]);

  return (
    <div className="h-[300px] w-full mt-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Payment Trend (Last 12 Months)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="displayMonth" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
          />
          <YAxis 
            tickFormatter={(val) => `$${val/1000}k`} 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
          />
          <Tooltip 
            formatter={(value) => formatCurrency(value)}
            labelStyle={{ color: '#64748b' }}
          />
          <Area 
            type="monotone" 
            dataKey="amount" 
            stroke="#2563eb" 
            fillOpacity={1} 
            fill="url(#colorAmount)" 
            name="Total Payments"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function InvoiceAgingChart({ agingData }) {
  const data = React.useMemo(() => [
    { name: '0-30 Days', value: agingData['current'] || 0, fill: '#3b82f6' },
    { name: '31-60 Days', value: agingData['30days'] || 0, fill: '#eab308' },
    { name: '61-90 Days', value: agingData['60days'] || 0, fill: '#f97316' },
    { name: '90+ Days', value: agingData['90plus'] || 0, fill: '#ef4444' },
  ], [agingData]);

  return (
    <div className="h-[300px] w-full mt-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Outstanding Balance by Age</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
          <XAxis type="number" hide />
          <YAxis 
            dataKey="name" 
            type="category" 
            width={80} 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
          />
          <Tooltip 
            formatter={(value) => formatCurrency(value)} 
            cursor={{fill: 'transparent'}}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={30}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function IncomeDistributionChart({ incomes, providers }) {
  const data = React.useMemo(() => {
    const grouped = {};
    incomes.forEach(inc => {
      const provider = providers.find(p => p.id === inc.provider_id);
      const name = provider ? provider.full_name.split(' ').pop() : 'Unknown'; // Last name
      if (!grouped[name]) grouped[name] = 0;
      grouped[name] += inc.total_amount || 0;
    });

    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10); // Top 10
  }, [incomes, providers]);

  return (
    <div className="h-[300px] w-full mt-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Top 10 Earners (Outside Income)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="name" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
          />
          <YAxis 
            tickFormatter={(val) => `$${val/1000}k`} 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
          />
          <Tooltip 
            formatter={(value) => formatCurrency(value)}
            cursor={{fill: '#f1f5f9'}}
          />
          <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Total Income" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SupplySpendingChart({ orders }) {
  const data = React.useMemo(() => {
    const grouped = {};
    orders.forEach(o => {
      if (!o.order_date) return;
      const month = format(startOfMonth(parseISO(o.order_date)), 'yyyy-MM');
      if (!grouped[month]) grouped[month] = 0;
      grouped[month] += o.total_amount || 0;
    });

    return Object.entries(grouped)
      .map(([month, amount]) => ({
        month,
        displayMonth: format(parseISO(month + '-01'), 'MMM'),
        amount
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);
  }, [orders]);

  return (
    <div className="h-[300px] w-full mt-4 bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Supply Spending (Last 12 Months)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="displayMonth" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
          />
          <YAxis 
            tickFormatter={(val) => `$${val}`} 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
          />
          <Tooltip 
            formatter={(value) => formatCurrency(value)}
          />
          <Line 
            type="monotone" 
            dataKey="amount" 
            stroke="#0ea5e9" 
            strokeWidth={2} 
            dot={{ fill: '#0ea5e9', strokeWidth: 2 }}
            activeDot={{ r: 6 }}
            name="Spending"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}