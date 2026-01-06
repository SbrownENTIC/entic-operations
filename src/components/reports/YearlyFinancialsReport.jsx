import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, getYear, getMonth } from "date-fns";
import { Calendar, DollarSign, BarChart3 } from "lucide-react";

export default function YearlyFinancialsReport({ payments, formatCurrency }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());

  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  const filteredPayments = payments.filter(payment => {
    if (!payment.payment_date) return false;
    const paymentDate = parseISO(payment.payment_date);
    const paymentYear = getYear(paymentDate).toString();

    return paymentYear === selectedYear;
  });

  const totalAmount = filteredPayments.reduce((sum, payment) => sum + (payment.total_amount || 0), 0);
  
  // Calculate monthly breakdown
  const monthlyBreakdown = Array.from({ length: 12 }, (_, i) => {
    const monthIndex = i; // 0-11
    const monthPayments = filteredPayments.filter(payment => {
      return getMonth(parseISO(payment.payment_date)) === monthIndex;
    });
    
    return {
      monthName: format(new Date(parseInt(selectedYear), monthIndex, 1), 'MMMM'),
      total: monthPayments.reduce((sum, p) => sum + (p.total_amount || 0), 0),
      count: monthPayments.length
    };
  });

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Yearly Financials</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              View payments received for a specific year
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="flex flex-wrap gap-4 items-center bg-slate-50 p-4 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Select Year:</span>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-green-50 p-6 rounded-lg border border-green-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800 mb-1">Total Payments Received ({selectedYear})</p>
                <p className="text-3xl font-bold text-green-700">{formatCurrency(totalAmount)}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
            
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800 mb-1">Number of Payments ({selectedYear})</p>
                <p className="text-3xl font-bold text-blue-700">{filteredPayments.length}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Monthly Breakdown</h3>
            <div className="overflow-auto border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
                  <tr>
                    <th className="text-left p-3 font-semibold text-slate-700">Month</th>
                    <th className="text-right p-3 font-semibold text-slate-700">Payments Count</th>
                    <th className="text-right p-3 font-semibold text-slate-700">Total Amount</th>
                    <th className="text-right p-3 font-semibold text-slate-700">% of Year</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyBreakdown.map((item) => (
                    <tr key={item.monthName} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-medium text-slate-900">
                        {item.monthName}
                      </td>
                      <td className="p-3 text-right text-slate-600">
                        {item.count}
                      </td>
                      <td className="p-3 text-right font-medium text-green-700">
                        {formatCurrency(item.total)}
                      </td>
                      <td className="p-3 text-right text-slate-500">
                        {totalAmount > 0 ? ((item.total / totalAmount) * 100).toFixed(1) + '%' : '0.0%'}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-slate-50 font-bold">
                    <td className="p-3 text-slate-900">Total</td>
                    <td className="p-3 text-right text-slate-900">{filteredPayments.length}</td>
                    <td className="p-3 text-right text-green-700">{formatCurrency(totalAmount)}</td>
                    <td className="p-3 text-right text-slate-900">100.0%</td>
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