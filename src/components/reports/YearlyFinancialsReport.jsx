import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, getYear, getMonth } from "date-fns";
import { Calendar, DollarSign, BarChart3 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function YearlyFinancialsReport({ payments, formatCurrency }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());

  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const filteredPayments = payments.filter(payment => {
    if (!payment.payment_date) return false;
    const paymentDate = parseISO(payment.payment_date);
    const paymentYear = getYear(paymentDate).toString();
    return paymentYear === selectedYear;
  });

  const totalAmount = filteredPayments.reduce((sum, payment) => sum + (payment.total_amount || 0), 0);

  // Aggregate by month
  const monthlyData = months.map((monthName, index) => {
    const monthPayments = filteredPayments.filter(payment => {
        const paymentDate = parseISO(payment.payment_date);
        return getMonth(paymentDate) === index;
    });
    const total = monthPayments.reduce((sum, p) => sum + (p.total_amount || 0), 0);
    return {
        name: monthName,
        shortName: monthName.substring(0, 3),
        total: total,
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
              View payments received for a specific year with monthly breakdown
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="flex flex-wrap gap-4 items-center bg-slate-50 p-4 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-slate-700">Year:</span>
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
                <p className="text-sm font-medium text-green-800 mb-1">Total Payments Received</p>
                <p className="text-3xl font-bold text-green-700">{formatCurrency(totalAmount)}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
            
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-800 mb-1">Number of Payments</p>
                <p className="text-3xl font-bold text-blue-700">{filteredPayments.length}</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div>
             <h3 className="text-lg font-semibold text-slate-900 mb-4">Monthly Breakdown</h3>
             <div className="h-[300px] w-full bg-white border rounded-lg p-4 mb-6">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthlyData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="shortName" axisLine={false} tickLine={false} />
                        <YAxis 
                            axisLine={false} 
                            tickLine={false} 
                            tickFormatter={(value) => `$${value/1000}k`}
                        />
                        <Tooltip 
                            formatter={(value) => [formatCurrency(value), 'Total Received']}
                            cursor={{ fill: '#f1f5f9' }}
                        />
                        <Bar dataKey="total" fill="#2563eb" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
             </div>
             
             <div className="overflow-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold text-slate-700">Month</th>
                      <th className="text-right p-3 font-semibold text-slate-700">Payments Count</th>
                      <th className="text-right p-3 font-semibold text-slate-700">Total Amount</th>
                      <th className="text-right p-3 font-semibold text-slate-700">Average Payment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((data) => (
                      <tr key={data.name} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 font-medium text-slate-900">{data.name}</td>
                        <td className="p-3 text-right text-slate-600">{data.count}</td>
                        <td className="p-3 text-right font-medium text-green-700">{formatCurrency(data.total)}</td>
                        <td className="p-3 text-right text-slate-600">
                            {formatCurrency(data.count > 0 ? data.total / data.count : 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 font-semibold">
                    <tr>
                        <td className="p-3 text-slate-900">TOTAL</td>
                        <td className="p-3 text-right text-slate-900">{filteredPayments.length}</td>
                        <td className="p-3 text-right text-green-700">{formatCurrency(totalAmount)}</td>
                        <td className="p-3 text-right text-slate-900">
                            {formatCurrency(filteredPayments.length > 0 ? totalAmount / filteredPayments.length : 0)}
                        </td>
                    </tr>
                  </tfoot>
                </table>
             </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}