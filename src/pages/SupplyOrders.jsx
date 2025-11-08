
import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil } from "lucide-react"; // Added Pencil import
import { format, parseISO } from "date-fns";
import SupplyOrderForm from "../components/supplies/SupplyOrderForm";

export default function SupplyOrders() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingOrder, setEditingOrder] = useState(null);
  const queryClient = useQueryClient();

  const { data: orders = [] } = useQuery({
    queryKey: ['supply-orders'],
    queryFn: () => base44.entities.SupplyOrder.list('-order_date')
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SupplyOrder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supply-orders'] });
      setShowForm(false);
      setEditingOrder(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SupplyOrder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supply-orders'] });
      setShowForm(false);
      setEditingOrder(null);
    }
  });

  const handleSubmit = (data) => {
    if (editingOrder) {
      updateMutation.mutate({ id: editingOrder.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const filteredOrders = orders.filter(order =>
    order.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    order.location?.toLowerCase().includes(searchTerm.toLowerCase()) // Added location to search
  );

  const statusColors = {
    ordered: "bg-blue-100 text-blue-800",
    shipped: "bg-purple-100 text-purple-800",
    delivered: "bg-green-100 text-green-800",
    cancelled: "bg-red-100 text-red-800"
  };

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Supply Orders</h1>
            <p className="text-slate-600 mt-1">Track and manage supply orders</p>
          </div>
          <Button
            onClick={() => {
              setEditingOrder(null);
              setShowForm(true);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Order
          </Button>
        </div>

        {showForm && (
          <SupplyOrderForm
            order={editingOrder}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingOrder(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        )}

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md border-slate-200"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Order #</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Vendor</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Location</th> {/* Added Location header */}
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Order Date</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Expected</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Status</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Amount</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700">Actions</th> {/* Added Actions header */}
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-medium text-slate-900">{order.order_number || '-'}</td>
                      <td className="p-4 text-slate-600">{order.vendor}</td>
                      <td className="p-4 text-slate-600">{order.location || '-'}</td> {/* Added Location data */}
                      <td className="p-4 text-slate-600">
                        {format(parseISO(order.order_date), 'MMM d, yyyy')}
                      </td>
                      <td className="p-4 text-slate-600">
                        {order.expected_delivery ? format(parseISO(order.expected_delivery), 'MMM d, yyyy') : '-'}
                      </td>
                      <td className="p-4">
                        <Badge className={statusColors[order.status]}>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="p-4 font-medium text-slate-900">
                        ${order.total_amount?.toFixed(2) || '0.00'}
                      </td>
                      <td className="p-4 text-right"> {/* Added Actions column */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingOrder(order);
                            setShowForm(true);
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredOrders.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No orders found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
