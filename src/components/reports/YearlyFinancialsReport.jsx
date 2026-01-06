import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, getYear, getMonth } from "date-fns";
import { Calendar, DollarSign, TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function YearlyFinancialsReport({ payments, formatCurrency }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  
  const year0 = selectedYear;
  const year1 = (parseInt(selectedYear) - 1).toString();
  const year2 = (parseInt(selectedYear) - 2).toString();

  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  // Helper to process data for a specific year
  const getYearData = (year) => {
    const yearPayments = payments.filter(payment => {
      if (!payment.payment_date) return false;
      return getYear(parseISO(payment.payment_date)).toString() === year;
    });

    const totalAmount = yearPayments.reduce((sum, payment) => sum + (payment.total_amount || 0), 0);
    
    // Monthly breakdown [0-11]
    const monthlyTotals = Array.from({ length: 12 }, (_, i) => {
      const monthPayments = yearPayments.filter(payment => getMonth(parseISO(payment.payment_date)) === i);
      return monthPayments.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    });

    return {
      year,
      payments: yearPayments,
      totalAmount,
      count: yearPayments.length,
      monthlyTotals
    };
  };

  const dataYear0 = getYearData(year0);
  const dataYear1 = getYearData(year1);
  const dataYear2 = getYearData(year2);

  // Calculate percentage change
  const calculateChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const getMonthName = (monthIndex) => format(new Date(2024, monthIndex, 1), 'MMMM');

  const renderTrendIcon = (percent) => {
    if (Math.abs(percent) < 0.1) return <Minus className="w-3 h-3 text-slate-400" />;
    return percent > 0 
      ? <TrendingUp className="w-3 h-3 text-green-600" /> 
      : <TrendingDown className="w-3 h-3 text-red-600" />;
  };

  const renderTrendText = (percent) => {
    const colorClass = Math.abs(percent) < 0.1 ? 'text-slate-500' : percent > 0 ? 'text-green-600' : 'text-red-600';
    return (
      <span className={`text-xs font-medium flex items-center gap-1 ${colorClass}`}>
        {renderTrendIcon(percent)}
        {Math.abs(percent).toFixed(1)}%
      </span>
    );
  };

  const SummaryCard = ({ data, prevData, color, icon: Icon }) => {
    const change = prevData ? calculateChange(data.totalAmount, prevData.totalAmount) : null;
    
    return (
      <div className={`bg-${color}-50 p-6 rounded-xl border border-${color}-100 relative overflow-hidden`}>
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Icon className={`w-24 h-24 text-${color}-900`} />
        </div>
        <p className={`text-sm font-semibold text-${color}-800 uppercase tracking-wider mb-2`}>{data.year} Performance</p>
        <div className="flex items-baseline gap-2 mb-1">
          <h3 className={`text-3xl font-bold text-${color}-900`}>{formatCurrency(data.totalAmount)}</h3>
          {change !== null && renderTrendText(change)}
        </div>
        <p className={`${color === 'blue' ? 'text-blue-700' : 'text-slate-600'} font-medium mb-4`}>{data.count} total payments</p>
        
        <div className={`pt-4 border-t border-${color}-200/50 flex gap-4`}>
          <div>
              <span className={`text-xs text-${color}-600 block`}>Avg Payment</span>
              <span className={`font-semibold text-${color}-900`}>
                {formatCurrency(data.count > 0 ? data.totalAmount / data.count : 0)}
              </span>
          </div>
          <div>
              <span className={`text-xs text-${color}-600 block`}>Best Month</span>
              <span className={`font-semibold text-${color}-900`}>
                {(() => {
                  const max = Math.max(...data.monthlyTotals);
                  const index = data.monthlyTotals.indexOf(max);
                  return max > 0 ? getMonthName(index) : '-';
                })()}
              </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>3-Year Financial Comparison</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Comparing {year0}, {year1}, and {year2}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-700">Primary Year:</span>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[120px] bg-white">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map((year) => (
                  <SelectItem key={year} value={year}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-8">
          {/* Top Level Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <SummaryCard data={dataYear0} prevData={dataYear1} color="blue" icon={DollarSign} />
            <SummaryCard data={dataYear1} prevData={dataYear2} color="slate" icon={Calendar} />
            <SummaryCard data={dataYear2} prevData={null} color="slate" icon={Calendar} />
          </div>

          {/* Detailed Monthly Breakdown Table */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-500" />
              Monthly Breakdown Comparison
            </h3>
            <div className="overflow-hidden border border-slate-200 rounded-lg shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-4 font-semibold text-slate-700 w-1/5">Month</th>
                    <th className="text-right p-4 font-semibold text-slate-700 w-1/5">{year0}</th>
                    <th className="text-right p-4 font-semibold text-slate-700 w-1/5">{year1}</th>
                    <th className="text-right p-4 font-semibold text-slate-700 w-1/5">{year2}</th>
                    <th className="text-right p-4 font-semibold text-slate-700 w-1/5">Trend ({year0} vs {year1})</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {dataYear0.monthlyTotals.map((total0, index) => {
                    const total1 = dataYear1.monthlyTotals[index];
                    const total2 = dataYear2.monthlyTotals[index];
                    const diff = total0 - total1;
                    const changePercent = calculateChange(total0, total1);
                    const monthName = getMonthName(index);

                    return (
                      <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-medium text-slate-900">{monthName}</td>
                        <td className="p-4 text-right">
                          <span className={total0 > 0 ? "font-semibold text-blue-700" : "text-slate-400"}>
                            {formatCurrency(total0)}
                          </span>
                        </td>
                        <td className="p-4 text-right text-slate-600">
                          {formatCurrency(total1)}
                        </td>
                        <td className="p-4 text-right text-slate-500">
                          {formatCurrency(total2)}
                        </td>
                        <td className="p-4 text-right flex justify-end items-center gap-2">
                          <span className={diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-slate-400"}>
                             {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                          </span>
                          {total1 > 0 && renderTrendText(changePercent)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 font-bold border-t border-slate-200">
                    <td className="p-4 text-slate-900">TOTAL</td>
                    <td className="p-4 text-right text-blue-700">{formatCurrency(dataYear0.totalAmount)}</td>
                    <td className="p-4 text-right text-slate-700">{formatCurrency(dataYear1.totalAmount)}</td>
                    <td className="p-4 text-right text-slate-600">{formatCurrency(dataYear2.totalAmount)}</td>
                    <td className="p-4 text-right">
                       <span className={dataYear0.totalAmount - dataYear1.totalAmount >= 0 ? "text-green-600" : "text-red-600"}>
                         {dataYear0.totalAmount - dataYear1.totalAmount > 0 ? '+' : ''}
                         {formatCurrency(dataYear0.totalAmount - dataYear1.totalAmount)}
                       </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}