import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, isToday, parseISO } from "date-fns";
import { Edit, Package, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import SupplyOrderForm from "../components/supplies/SupplyOrderForm";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function TodaysOrders() {
  const [editingOrder, setEditingOrder] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['todays-orders'],
    queryFn: async () => {
      const allOrders = await base44.entities.SupplyOrder.list('-created_date', 100);
      // Filter to only show orders created today
      return allOrders.filter(order => {
        try {
          return isToday(parseISO(order.created_date));
        } catch (e) {
          return false;
        }
      });
    },
    refetchInterval: 30000 // Refresh every 30 seconds
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await base44.entities.SupplyOrder.update(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todays-orders'] });
      queryClient.invalidateQueries({ queryKey: ['supply-orders'] });
      queryClient.invalidateQueries({ queryKey: ['pending-review-orders'] });
      setEditingOrder(null);
    }
  });

  const canEdit = (order) => {
    try {
      const now = new Date();
      const createdDate = parseISO(order.created_date);
      
      // Check if order was created today
      if (!isToday(createdDate)) {
        return false;
      }

      // Check if it's before 5 PM EST
      const estTime = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
      const hour = estTime.getHours();
      
      return hour < 17; // Before 5 PM
    } catch (e) {
      return false;
    }
  };

  const handleEdit = (order) => {
    if (canEdit(order)) {
      setEditingOrder(order);
    }
  };

  const handleSubmit = async (updatedData) => {
    if (!editingOrder) return;

    // Check if items, quantities, or notes changed
    const itemsChanged = JSON.stringify(editingOrder.items) !== JSON.stringify(updatedData.items);
    const notesChanged = editingOrder.notes !== updatedData.notes;

    // Set the flag if relevant fields changed
    const dataToSubmit = {
      ...updatedData,
      updated_after_submission: itemsChanged || notesChanged ? true : updatedData.updated_after_submission
    };

    await updateMutation.mutateAsync({ id: editingOrder.id, data: dataToSubmit });
  };

  const getStatusColor = (status) => {
    const colors = {
      pending_review: 'bg-yellow-100 text-yellow-800',
      pending_fulfillment: 'bg-blue-100 text-blue-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      order_placed: 'bg-indigo-100 text-indigo-800',
      partially_received: 'bg-purple-100 text-purple-800',
      received: 'bg-slate-100 text-slate-800'
    };
    return colors[status] || 'bg-slate-100 text-slate-800';
  };

  const formatStatus = (status) => {
    return status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12 text-slate-500">Loading today's orders...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Today's Orders</h1>
          <p className="text-slate-600 mt-1">View and edit orders placed today (until 5 PM EST)</p>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Orders Placed Today
              <Badge variant="outline" className="ml-2">{orders.length} {orders.length === 1 ? 'order' : 'orders'}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {orders.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <Package className="w-12 h-12 mx-auto mb-4 text-slate-300" />
                <p>No orders placed today</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="text-left p-4 text-sm font-semibold text-slate-700">Order #</th>
                      <th className="text-left p-4 text-sm font-semibold text-slate-700">Category</th>
                      <th className="text-left p-4 text-sm font-semibold text-slate-700">Vendor</th>
                      <th className="text-left p-4 text-sm font-semibold text-slate-700">Location</th>
                      <th className="text-left p-4 text-sm font-semibold text-slate-700">Items</th>
                      <th className="text-right p-4 text-sm font-semibold text-slate-700">Total</th>
                      <th className="text-left p-4 text-sm font-semibold text-slate-700">Status</th>
                      <th className="text-left p-4 text-sm font-semibold text-slate-700">Time</th>
                      <th className="text-center p-4 text-sm font-semibold text-slate-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="p-4">
                          <span className="font-medium text-slate-900">{order.order_number || '-'}</span>
                          {order.updated_after_submission && (
                            <AlertCircle className="w-4 h-4 text-orange-500 inline-block ml-2" title="Order updated" />
                          )}
                        </td>
                        <td className="p-4">
                          <Badge variant="outline">
                            {order.category === 'clinical' ? 'Clinical' : 'Office'}
                          </Badge>
                        </td>
                        <td className="p-4 text-slate-700">{order.vendor || '-'}</td>
                        <td className="p-4 text-slate-700">{order.location}</td>
                        <td className="p-4 text-slate-700">{order.items?.length || 0} items</td>
                        <td className="p-4 text-right font-semibold text-slate-900">
                          ${(order.total_amount || 0).toFixed(2)}
                        </td>
                        <td className="p-4">
                          <Badge className={getStatusColor(order.status)}>
                            {formatStatus(order.status)}
                          </Badge>
                        </td>
                        <td className="p-4 text-sm text-slate-600">
                          {format(parseISO(order.created_date), 'h:mm a')}
                        </td>
                        <td className="p-4 text-center">
                          <Button
                            onClick={() => handleEdit(order)}
                            disabled={!canEdit(order)}
                            size="sm"
                            variant={canEdit(order) ? "default" : "ghost"}
                            className={canEdit(order) ? "" : "opacity-50 cursor-not-allowed"}
                          >
                            <Edit className="w-4 h-4 mr-1" />
                            {canEdit(order) ? 'Edit' : 'Locked'}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {!canEdit(orders[0]) && orders.length > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-orange-900">Editing Disabled</p>
              <p className="text-sm text-orange-700">Orders can only be edited before 5 PM EST on the day they were placed.</p>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!editingOrder} onOpenChange={(open) => !open && setEditingOrder(null)}>
        <DialogContent className="sm:max-w-[1200px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Order</DialogTitle>
          </DialogHeader>
          {editingOrder && (
            <SupplyOrderForm
              order={editingOrder}
              category={editingOrder.category}
              onSubmit={handleSubmit}
              onCancel={() => setEditingOrder(null)}
              isLoading={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}