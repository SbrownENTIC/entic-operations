import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, X } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { SupplySpendingChart } from "./ReportCharts";

export default function SupplyOrderReportView({ 
  orders = [], 
  title, 
  subtitle,
  dateRange,
  formatCurrency,
  onExport 
}) {
  const [supplyOrderDetail, setSupplyOrderDetail] = useState(null);

  const filterByDateRange = (items, dateField) => {
    if (!dateRange.start && !dateRange.end) return items;
    
    return items.filter(item => {
      const itemDate = new Date(item[dateField]);
      const start = dateRange.start ? new Date(dateRange.start) : null;
      const end = dateRange.end ? new Date(dateRange.end) : null;
      
      if (start && itemDate < start) return false;
      if (end && itemDate > end) return false;
      return true;
    });
  };

  return (
    <>
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{title}</CardTitle>
              <p className="text-sm text-slate-500 mt-1">
                {subtitle}
              </p>
            </div>
            <Button onClick={onExport} className="gap-2">
              <Download className="w-4 h-4" />
              Export to CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            <div>
              {(() => {
                const filtered = filterByDateRange(orders, 'order_date');
                return (
                  <>
                    <h3 className="text-sm font-semibold text-slate-900 mb-2">Order Status Summary ({filtered.length})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {(() => {
                        const orderPlaced = filtered.filter(o => o.status === 'order_placed');
                        const partiallyReceived = filtered.filter(o => o.status === 'partially_received');
                        const received = filtered.filter(o => o.status === 'received');
                        
                        return (
                          <>
                            <button
                              onClick={() => setSupplyOrderDetail({ 
                                type: 'status', 
                                name: 'Order Placed', 
                                data: { 
                                  count: orderPlaced.length, 
                                  total: orderPlaced.reduce((sum, o) => sum + (o.total_amount || 0), 0),
                                  orders: orderPlaced 
                                }
                              })}
                              className="bg-blue-50 p-3 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors text-left"
                            >
                              <p className="text-xs font-medium text-slate-700">Order Placed</p>
                              <p className="text-xl font-bold text-blue-700 mt-1">{orderPlaced.length}</p>
                              <p className="text-xs text-slate-600 mt-0.5">
                                {formatCurrency(orderPlaced.reduce((sum, o) => sum + (o.total_amount || 0), 0))}
                              </p>
                            </button>
                            <button
                              onClick={() => setSupplyOrderDetail({ 
                                type: 'status', 
                                name: 'Partially Received', 
                                data: { 
                                  count: partiallyReceived.length, 
                                  total: partiallyReceived.reduce((sum, o) => sum + (o.total_amount || 0), 0),
                                  orders: partiallyReceived 
                                }
                              })}
                              className="bg-yellow-50 p-3 rounded-lg border border-yellow-200 hover:bg-yellow-100 transition-colors text-left"
                            >
                              <p className="text-xs font-medium text-slate-700">Partially Received</p>
                              <p className="text-xl font-bold text-yellow-700 mt-1">{partiallyReceived.length}</p>
                              <p className="text-xs text-slate-600 mt-0.5">
                                {formatCurrency(partiallyReceived.reduce((sum, o) => sum + (o.total_amount || 0), 0))}
                              </p>
                            </button>
                            <button
                              onClick={() => setSupplyOrderDetail({ 
                                type: 'status', 
                                name: 'Received', 
                                data: { 
                                  count: received.length, 
                                  total: received.reduce((sum, o) => sum + (o.total_amount || 0), 0),
                                  orders: received 
                                }
                              })}
                              className="bg-green-50 p-3 rounded-lg border border-green-200 hover:bg-green-100 transition-colors text-left"
                            >
                              <p className="text-xs font-medium text-slate-700">Received</p>
                              <p className="text-xl font-bold text-green-700 mt-1">{received.length}</p>
                              <p className="text-xs text-slate-600 mt-0.5">
                                {formatCurrency(received.reduce((sum, o) => sum + (o.total_amount || 0), 0))}
                              </p>
                            </button>
                          </>
                        );
                      })()}
                    </div>
                  </>
                );
              })()}
            </div>

            <div>
              <h3 className="text-md font-semibold text-slate-900 mb-3">Average by Location</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {(() => {
                  const byLocation = {};
                  const filtered = filterByDateRange(orders, 'order_date');
                  filtered.forEach(order => {
                    const location = order.location || 'Unknown';
                    if (!byLocation[location]) {
                      byLocation[location] = { count: 0, total: 0, orders: [] };
                    }
                    byLocation[location].count++;
                    byLocation[location].total += order.total_amount || 0;
                    byLocation[location].orders.push(order);
                  });

                  return Object.entries(byLocation).sort(([a], [b]) => a.localeCompare(b)).map(([location, data]) => (
                    <button
                      key={location}
                      onClick={() => setSupplyOrderDetail({ type: 'location', name: location, data })}
                      className="bg-blue-50 p-4 rounded-lg border border-blue-200 hover:bg-blue-100 transition-colors text-left"
                    >
                      <p className="text-sm font-medium text-slate-700">{location}</p>
                      <p className="text-2xl font-bold text-blue-700 mt-1">
                        {formatCurrency(data.count > 0 ? data.total / data.count : 0)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">{data.count} orders • {formatCurrency(data.total)} total</p>
                    </button>
                  ));
                })()}
              </div>
            </div>

            <div>
              <h3 className="text-md font-semibold text-slate-900 mb-3">Average by Month & Location (Last 12 Months)</h3>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-semibold text-slate-700">Month</th>
                      {(() => {
                        const locations = [...new Set(orders.map(o => o.location || 'Unknown'))].sort();
                        return locations.map(loc => (
                          <th key={loc} className="text-right p-3 font-semibold text-slate-700">{loc}</th>
                        ));
                      })()}
                      <th className="text-right p-3 font-semibold text-slate-700 bg-slate-200">Month Order Average</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const byMonthLocation = {};
                      const filtered = filterByDateRange(orders, 'order_date');
                      filtered.forEach(order => {
                        const month = format(parseISO(order.order_date), 'yyyy-MM');
                        const location = order.location || 'Unknown';
                        if (!byMonthLocation[month]) byMonthLocation[month] = {};
                        if (!byMonthLocation[month][location]) {
                          byMonthLocation[month][location] = { count: 0, total: 0, orders: [] };
                        }
                        byMonthLocation[month][location].count++;
                        byMonthLocation[month][location].total += order.total_amount || 0;
                        byMonthLocation[month][location].orders.push(order);
                      });

                      const locations = [...new Set(orders.map(o => o.location || 'Unknown'))].sort();
                      
                      const monthRows = Object.entries(byMonthLocation)
                        .sort(([a], [b]) => b.localeCompare(a))
                        .slice(0, 12)
                        .map(([month, locationData]) => {
                          const monthTotal = Object.values(locationData).reduce((sum, d) => sum + d.total, 0);
                          const monthCount = Object.values(locationData).reduce((sum, d) => sum + d.count, 0);
                          const monthAvg = monthCount > 0 ? monthTotal / monthCount : 0;

                          return (
                            <tr key={month} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="p-3 font-medium text-slate-900">{format(parseISO(month + '-01'), 'MMM yyyy')}</td>
                              {locations.map(loc => {
                                const data = locationData[loc];
                                return (
                                  <td key={loc} className="p-3 text-right">
                                    {data ? (
                                      <button
                                        onClick={() => setSupplyOrderDetail({ type: 'month-location', name: `${format(parseISO(month + '-01'), 'MMM yyyy')} - ${loc}`, data })}
                                        className="text-green-700 font-medium hover:text-green-900 hover:underline"
                                      >
                                        {formatCurrency(data.total / data.count)}
                                      </button>
                                    ) : (
                                      <span className="text-slate-400">{formatCurrency(0)}</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="p-3 text-right font-bold bg-slate-50 text-slate-900">
                                {formatCurrency(monthAvg)}
                              </td>
                            </tr>
                          );
                        });

                      return monthRows;
                      })()}
                  </tbody>
                </table>
              </div>
            </div>

            <div>
              <h3 className="text-md font-semibold text-slate-900 mb-3">Average by Year & Location</h3>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-slate-700">Year</th>
                      {(() => {
                        const locations = [...new Set(orders.map(o => o.location || 'Unknown'))].sort();
                        return locations.map(loc => (
                          <th key={loc} className="text-right p-3 font-semibold text-slate-700">{loc}</th>
                        ));
                      })()}
                      <th className="text-right p-3 font-semibold text-slate-700 bg-slate-200">Yearly Order Average</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const byYearLocation = {};
                      const filtered = filterByDateRange(orders, 'order_date');
                      filtered.forEach(order => {
                        const year = format(parseISO(order.order_date), 'yyyy');
                        const location = order.location || 'Unknown';
                        if (!byYearLocation[year]) byYearLocation[year] = {};
                        if (!byYearLocation[year][location]) {
                          byYearLocation[year][location] = { count: 0, total: 0, orders: [] };
                        }
                        byYearLocation[year][location].count++;
                        byYearLocation[year][location].total += order.total_amount || 0;
                        byYearLocation[year][location].orders.push(order);
                      });

                      const locations = [...new Set(orders.map(o => o.location || 'Unknown'))].sort();
                      
                      return Object.entries(byYearLocation)
                        .sort(([a], [b]) => b.localeCompare(a))
                        .map(([year, locationData]) => {
                          const yearTotal = Object.values(locationData).reduce((sum, d) => sum + d.total, 0);
                          const yearCount = Object.values(locationData).reduce((sum, d) => sum + d.count, 0);
                          const yearAvg = yearCount > 0 ? yearTotal / yearCount : 0;

                          return (
                            <tr key={year} className="border-b border-slate-100 hover:bg-slate-50">
                              <td className="p-3 font-medium text-slate-900">{year}</td>
                              {locations.map(loc => {
                                const data = locationData[loc];
                                return (
                                  <td key={loc} className="p-3 text-right">
                                    {data ? (
                                      <button
                                        onClick={() => setSupplyOrderDetail({ type: 'year-location', name: `${year} - ${loc}`, data })}
                                        className="text-purple-700 font-medium hover:text-purple-900 hover:underline"
                                      >
                                        {formatCurrency(data.total / data.count)}
                                      </button>
                                    ) : (
                                      <span className="text-slate-400">-</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="p-3 text-right font-bold bg-slate-50 text-slate-900">
                                {formatCurrency(yearAvg)}
                              </td>
                            </tr>
                          );
                        });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              Click on any value to see detailed order breakdown. Average values help identify spending trends and budget planning.
            </p>
            <SupplySpendingChart orders={filterByDateRange(orders, 'order_date')} />
          </div>
        </CardContent>
      </Card>

      {supplyOrderDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSupplyOrderDetail(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">{supplyOrderDetail.name} - Order Details</h3>
              <button onClick={() => setSupplyOrderDetail(null)} className="text-slate-500 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-600">Total Orders</p>
                  <p className="text-2xl font-bold text-blue-700">{supplyOrderDetail.data.count}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-600">Total Spent</p>
                  <p className="text-2xl font-bold text-green-700">{formatCurrency(supplyOrderDetail.data.total)}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <p className="text-sm text-slate-600">Average Order</p>
                  <p className="text-2xl font-bold text-purple-700">
                    {formatCurrency(supplyOrderDetail.data.count > 0 ? supplyOrderDetail.data.total / supplyOrderDetail.data.count : 0)}
                  </p>
                </div>
              </div>

              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 border-b border-slate-200">
                    <tr>
                      <th className="text-left p-3 font-semibold text-slate-700">Order #</th>
                      <th className="text-left p-3 font-semibold text-slate-700">Date</th>
                      <th className="text-left p-3 font-semibold text-slate-700">Location</th>
                      <th className="text-right p-3 font-semibold text-slate-700">Items</th>
                      <th className="text-right p-3 font-semibold text-slate-700">Total</th>
                      <th className="text-left p-3 font-semibold text-slate-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                   {supplyOrderDetail.data.orders.sort((a, b) => new Date(b.order_date) - new Date(a.order_date)).map(order => (
                     <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50">
                       <td className="p-3">
                         <Link 
                           to={createPageUrl('SupplyOrderDetail') + '?id=' + order.id}
                           className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                         >
                           {order.order_number || '-'}
                         </Link>
                       </td>
                       <td className="p-3 text-slate-600">{format(parseISO(order.order_date), 'MMM d, yyyy')}</td>
                       <td className="p-3 text-slate-600">{order.location}</td>
                       <td className="p-3 text-right text-slate-600">{order.items?.length || 0}</td>
                       <td className="p-3 text-right font-medium text-green-700">{formatCurrency(order.total_amount || 0)}</td>
                       <td className="p-3">
                         <Badge className={
                           order.status === 'received' ? 'bg-green-100 text-green-800' :
                           order.status === 'partially_received' ? 'bg-yellow-100 text-yellow-800' :
                           'bg-blue-100 text-blue-800'
                         }>
                           {order.status === 'order_placed' ? 'Order Placed' :
                            order.status === 'partially_received' ? 'Partially Received' :
                            'Received'}
                         </Badge>
                       </td>
                     </tr>
                   ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}