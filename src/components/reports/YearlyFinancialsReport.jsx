import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, getYear, getMonth } from "date-fns";
import { Calendar, DollarSign, TrendingUp, TrendingDown, Minus } from "lucide-react";

export default function YearlyFinancialsReport({ payments, formatCurrency }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const previousYear = (parseInt(selectedYear) - 1).toString();

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
      payments: yearPayments,
      totalAmount,
      count: yearPayments.length,
      monthlyTotals
    };
  };

  const currentYearData = getYearData(selectedYear);
  const prevYearData = getYearData(previousYear);

  // Calculate percentage change
  const calculateChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const totalChange = calculateChange(currentYearData.totalAmount, prevYearData.totalAmount);
  const countChange = calculateChange(currentYearData.count, prevYearData.count);

  const getMonthName = (monthIndex) => format(new Date(2024, monthIndex, 1), 'MMMM');

  const renderTrendIcon = (percent) => {
    if (Math.abs(percent) < 0.1) return <Minus className="w-4 h-4 text-slate-400" />;
    return percent > 0 
      ? <TrendingUp className="w-4 h-4 text-green-600" /> 
      : <TrendingDown className="w-4 h-4 text-red-600" />;
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

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Yearly Financials Comparison</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Comparing {selectedYear} vs {previousYear}
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Selected Year Card */}
            <div className="bg-blue-50 p-6 rounded-xl border border-blue-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <DollarSign className="w-24 h-24 text-blue-900" />
              </div>
              <p className="text-sm font-semibold text-blue-800 uppercase tracking-wider mb-2">{selectedYear} Performance</p>
              <div className="flex items-baseline gap-2 mb-1">
                <h3 className="text-4xl font-bold text-blue-900">{formatCurrency(currentYearData.totalAmount)}</h3>
              </div>
              <p className="text-blue-700 font-medium mb-4">{currentYearData.count} total payments</p>
              
              <div className="pt-4 border-t border-blue-200/50 flex gap-4">
                <div>
                   <span className="text-xs text-blue-600 block">Avg Payment</span>
                   <span className="font-semibold text-blue-900">
                     {formatCurrency(currentYearData.count > 0 ? currentYearData.totalAmount / currentYearData.count : 0)}
                   </span>
                </div>
                <div>
                   <span className="text-xs text-blue-600 block">Best Month</span>
                   <span className="font-semibold text-blue-900">
                     {(() => {
                        const max = Math.max(...currentYearData.monthlyTotals);
                        const index = currentYearData.monthlyTotals.indexOf(max);
                        return max > 0 ? getMonthName(index) : '-';
                     })()}
                   </span>
                </div>
              </div>
            </div>

            {/* Previous Year Card */}
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-100 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-10">
                <Calendar className="w-24 h-24 text-slate-900" />
              </div>
              <p className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-2">{previousYear} Comparison</p>
              <div className="flex items-baseline gap-3 mb-1">
                <h3 className="text-4xl font-bold text-slate-700">{formatCurrency(prevYearData.totalAmount)}</h3>
                {renderTrendText(totalChange)}
              </div>
              <p className="text-slate-600 font-medium mb-4">{prevYearData.count} total payments</p>
              
              <div className="pt-4 border-t border-slate-200 flex gap-4">
                <div>
                   <span className="text-xs text-slate-500 block">Avg Payment</span>
                   <span className="font-semibold text-slate-700">
                     {formatCurrency(prevYearData.count > 0 ? prevYearData.totalAmount / prevYearData.count : 0)}
                   </span>
                </div>
                <div>
                   <span className="text-xs text-slate-500 block">Best Month</span>
                   <span className="font-semibold text-slate-700">
                     {(() => {
                        const max = Math.max(...prevYearData.monthlyTotals);
                        const index = prevYearData.monthlyTotals.indexOf(max);
                        return max > 0 ? getMonthName(index) : '-';
                     })()}
                   </span>
                </div>
              </div>
            </div>
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
                    <th className="text-left p-4 font-semibold text-slate-700 w-1/4">Month</th>
                    <th className="text-right p-4 font-semibold text-slate-700 w-1/4">{selectedYear}</th>
                    <th className="text-right p-4 font-semibold text-slate-700 w-1/4">{previousYear}</th>
                    <th className="text-right p-4 font-semibold text-slate-700 w-1/4">Difference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentYearData.monthlyTotals.map((currentTotal, index) => {
                    const prevTotal = prevYearData.monthlyTotals[index];
                    const diff = currentTotal - prevTotal;
                    const changePercent = calculateChange(currentTotal, prevTotal);
                    const monthName = getMonthName(index);

                    // Skip future months for current year if they have 0 data? 
                    // No, let's show all to complete the table.
                    
                    return (
                      <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-medium text-slate-900">{monthName}</td>
                        <td className="p-4 text-right">
                          <span className={currentTotal > 0 ? "font-semibold text-blue-700" : "text-slate-400"}>
                            {formatCurrency(currentTotal)}
                          </span>
                        </td>
                        <td className="p-4 text-right text-slate-600">
                          {formatCurrency(prevTotal)}
                        </td>
                        <td className="p-4 text-right flex justify-end items-center gap-2">
                          <span className={diff > 0 ? "text-green-600" : diff < 0 ? "text-red-600" : "text-slate-400"}>
                             {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                          </span>
                          {prevTotal > 0 && renderTrendText(changePercent)}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 font-bold border-t border-slate-200">
                    <td className="p-4 text-slate-900">TOTAL</td>
                    <td className="p-4 text-right text-blue-700">{formatCurrency(currentYearData.totalAmount)}</td>
                    <td className="p-4 text-right text-slate-700">{formatCurrency(prevYearData.totalAmount)}</td>
                    <td className="p-4 text-right">
                       <span className={currentYearData.totalAmount - prevYearData.totalAmount >= 0 ? "text-green-600" : "text-red-600"}>
                         {currentYearData.totalAmount - prevYearData.totalAmount > 0 ? '+' : ''}
                         {formatCurrency(currentYearData.totalAmount - prevYearData.totalAmount)}
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