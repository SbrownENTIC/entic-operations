import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, getYear, getMonth } from "date-fns";
import { Calendar, DollarSign } from "lucide-react";

export default function MonthlyFinancialsReport({ payments, formatCurrency }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString()); // 1-12

  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());
  const months = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  const filteredPayments = payments.filter(payment => {
    if (!payment.payment_date) return false;
    const paymentDate = parseISO(payment.payment_date);
    const paymentYear = getYear(paymentDate).toString();
    const paymentMonth = (getMonth(paymentDate) + 1).toString();

    return paymentYear === selectedYear && paymentMonth === selectedMonth;
  });

  const totalAmount = filteredPayments.reduce((sum, payment) => sum + (payment.total_amount || 0), 0);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Monthly Financials</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              View payments received for a specific month and year
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          <div className="flex flex-wrap gap-4 items-center bg-slate-50 p-4 rounded-lg border border-slate-100">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-slate-500" />
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px] bg-white">
                  <SelectValue placeholder="Select Month" />
                </SelectTrigger>
                <SelectContent>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Payment Details</h3>
            {filteredPayments.length > 0 ? (
              <div className="overflow-auto border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold text-slate-700">Date</th>
                      <th className="text-left p-3 font-semibold text-slate-700">Invoice Month</th>
                      <th className="text-left p-3 font-semibold text-slate-700">Payer</th>
                      <th className="text-left p-3 font-semibold text-slate-700">Reference</th>
                      <th className="text-left p-3 font-semibold text-slate-700">Method</th>
                      <th className="text-right p-3 font-semibold text-slate-700">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPayments
                      .sort((a, b) => new Date(b.payment_date) - new Date(a.payment_date))
                      .map((payment) => (
                      <tr key={payment.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-3 text-slate-600">
                          {format(parseISO(payment.payment_date), 'MMM d, yyyy')}
                        </td>
                        <td className="p-3 text-slate-600">
                          {payment.payment_month || '-'}
                        </td>
                        <td className="p-3 font-medium text-slate-900">{payment.payer || '-'}</td>
                        <td className="p-3 text-slate-600">{payment.reference_number || '-'}</td>
                        <td className="p-3 text-slate-600 capitalize">
                          {(payment.payment_method || '').replace('_', ' ')}
                        </td>
                        <td className="p-3 text-right font-medium text-green-700">
                          {formatCurrency(payment.total_amount || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-500">
                No payments found for {months.find(m => m.value === selectedMonth)?.label} {selectedYear}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}