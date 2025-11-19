import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Package, Calendar, MapPin, DollarSign } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function SupplyOrderDetail() {
  const [orderId, setOrderId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOrderId(params.get('id'));
  }, []);

  const { data: order, isLoading } = useQuery({
    queryKey: ['supply-order', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const orders = await base44.entities.SupplyOrder.filter({ id: orderId });
      return orders[0];
    },
    enabled: !!orderId
  });

  const formatCurrency = (amount) => {
    return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const statusColors = {
    pending_review: "bg-yellow-100 text-yellow-800",
    pending_fulfillment: "bg-blue-100 text-blue-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    order_placed: "bg-blue-100 text-blue-800",
    partially_received: "bg-yellow-100 text-yellow-800",
    received: "bg-green-100 text-green-800"
  };

  const formatStatus = (status) => {
    if (!status) return '-';
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (isLoading || !order) {
    return (
      <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
        <div className="max-w-5xl mx-auto">
          <div className="text-center py-12 text-slate-500">
            {isLoading ? 'Loading order details...' : 'Order not found'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Link to={createPageUrl('Reports')} className="text-blue-600 hover:text-blue-800">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Order Details</h1>
            <p className="text-slate-600 mt-1">Order #{order.order_number || 'N/A'}</p>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-4">
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Order Date</p>
                  <p className="font-semibold text-slate-900">
                    {format(parseISO(order.order_date), 'MMM d, yyyy')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Location</p>
                  <p className="font-semibold text-slate-900">{order.location}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Total Amount</p>
                  <p className="font-semibold text-slate-900">
                    {formatCurrency(order.total_amount || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Package className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600">Status</p>
                  <Badge className={statusColors[order.status]}>
                    {formatStatus(order.status)}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Item</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Item Number</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700">Quantity</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700">Unit Price</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700">Line Total</th>
                    <th className="text-center p-4 text-sm font-semibold text-slate-700">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map((item, index) => (
                    <tr key={index} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-4">
                        <p className="font-medium text-slate-900">{item.supply_name}</p>
                      </td>
                      <td className="p-4 text-slate-600">
                        {item.item_number || '-'}
                      </td>
                      <td className="p-4 text-right text-slate-600">{item.quantity}</td>
                      <td className="p-4 text-right text-slate-600">
                        {formatCurrency(item.unit_price || 0)}
                      </td>
                      <td className="p-4 text-right font-medium text-slate-900">
                        {formatCurrency((item.quantity || 0) * (item.unit_price || 0))}
                      </td>
                      <td className="p-4 text-center">
                        {item.received ? (
                          <Badge className="bg-green-100 text-green-800">Yes</Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-600">No</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td colSpan="4" className="p-4 text-right font-semibold text-slate-900">
                      Subtotal:
                    </td>
                    <td className="p-4 text-right font-semibold text-slate-900">
                      {formatCurrency(order.subtotal || 0)}
                    </td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan="4" className="p-4 text-right font-semibold text-slate-900">
                      Tax:
                    </td>
                    <td className="p-4 text-right font-semibold text-slate-900">
                      {formatCurrency(order.tax || 0)}
                    </td>
                    <td></td>
                  </tr>
                  <tr>
                    <td colSpan="4" className="p-4 text-right text-lg font-bold text-slate-900">
                      Total:
                    </td>
                    <td className="p-4 text-right text-lg font-bold text-green-600">
                      {formatCurrency(order.total_amount || 0)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>

        {order.notes && (
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <p className="text-slate-700 whitespace-pre-wrap">{order.notes}</p>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Link to={createPageUrl('Reports')}>
            <Button variant="outline">Back to Reports</Button>
          </Link>
          <Link to={createPageUrl('SupplyOrders')}>
            <Button className="bg-blue-600 hover:bg-blue-700">View All Orders</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}