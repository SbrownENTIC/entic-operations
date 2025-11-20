import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, parseISO } from "date-fns";
import SupplyOrderForm from "../components/supplies/SupplyOrderForm";

export default function SupplyOrders() {
  const urlParams = new URLSearchParams(window.location.search);
  const filterParam = urlParams.get('filter');
  
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(filterParam === 'pending_review' ? 'pending_review' : 'all');
  const [editingOrder, setEditingOrder] = useState(null);
  const [deletingOrder, setDeletingOrder] = useState(null);
  const [sortField, setSortField] = useState('order_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filling, setFilling] = useState(false);
  const [fillMessage, setFillMessage] = useState('');
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

  const markReceivedMutation = useMutation({
    mutationFn: (order) => {
      const updatedItems = order.items.map(item => ({ ...item, received: true }));
      return base44.entities.SupplyOrder.update(order.id, { 
        status: 'received',
        items: updatedItems
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supply-orders'] });
    }
  });

  const markOrderedMutation = useMutation({
    mutationFn: (order) => {
      return base44.entities.SupplyOrder.update(order.id, { status: 'order_placed' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supply-orders'] });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SupplyOrder.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supply-orders'] });
      setDeletingOrder(null);
    }
  });

  const handleSubmit = (data) => {
    if (editingOrder) {
      updateMutation.mutate({ id: editingOrder.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleFillItemNumbers = async () => {
    setFilling(true);
    setFillMessage('');
    setShowForm(false);
    setEditingOrder(null);
    try {
      const response = await base44.functions.invoke('fillSupplyOrderItemNumbers');
      setFillMessage(response.data.message);
      await queryClient.refetchQueries({ queryKey: ['supply-orders'] });
    } catch (error) {
      setFillMessage('Error: ' + (error.response?.data?.error || error.message));
    } finally {
      setFilling(false);
    }
  };

  // Format currency with commas
  const formatCurrency = (amount) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.location?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    let aValue, bValue;
    
    if (sortField === 'order_date') {
      aValue = a[sortField] ? new Date(a[sortField]) : new Date(0);
      bValue = b[sortField] ? new Date(b[sortField]) : new Date(0);
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    } else if (sortField === 'total_amount') {
      aValue = a.total_amount || 0;
      bValue = b.total_amount || 0;
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    } else {
      aValue = a[sortField] || '';
      bValue = b[sortField] || '';
    }
    
    const comparison = aValue.toString().toLowerCase().localeCompare(bValue.toString().toLowerCase());
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 ml-1 inline" />;
    return sortDirection === 'asc' ? 
      <ArrowUp className="w-4 h-4 ml-1 inline" /> : 
      <ArrowDown className="w-4 h-4 ml-1 inline" />;
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

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Supply Orders</h1>
            <p className="text-slate-600 mt-1">Track supply orders and deliveries</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleFillItemNumbers}
              variant="outline"
              disabled={filling}
              className="border-purple-600 text-purple-600 hover:bg-purple-50"
            >
              {filling ? 'Filling...' : 'Fill Item Numbers'}
            </Button>
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
        </div>

        {fillMessage && (
          <Card className="border-purple-200 bg-purple-50">
            <CardContent className="p-4">
              <p className="text-sm text-purple-900">{fillMessage}</p>
            </CardContent>
          </Card>
        )}

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
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                <Search className="w-5 h-5 text-slate-400" />
                <Input
                  placeholder="Search orders..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="border-slate-200"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="pending_fulfillment">Pending Fulfillment</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="order_placed">Order Placed</SelectItem>
                  <SelectItem value="partially_received">Partially Received</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[calc(100vh-230px)]">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700 bg-slate-50 w-16">
                      #
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('order_number')}
                    >
                      Order # <SortIcon field="order_number" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('vendor')}
                    >
                      Vendor <SortIcon field="vendor" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('location')}
                    >
                      Location <SortIcon field="location" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('order_date')}
                    >
                      Order Date <SortIcon field="order_date" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('total_amount')}
                    >
                      Total <SortIcon field="total_amount" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('status')}
                    >
                      Status <SortIcon field="status" />
                    </th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700 bg-slate-50">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedOrders.map((order, index) => (
                   <tr key={order.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                     <td className="p-4 text-slate-500 font-medium">{index + 1}</td>
                     <td className="p-4 font-medium text-slate-900">{order.order_number || '-'}</td>
                     <td className="p-4 text-slate-600">{order.vendor}</td>
                     <td className="p-4 text-slate-600">{order.location}</td>
                     <td className="p-4 text-slate-600">
                       {format(parseISO(order.order_date), 'MMM d, yyyy')}
                     </td>
                     <td className="p-4 font-medium text-green-600">
                       ${formatCurrency(order.total_amount || 0)}
                     </td>
                     <td className="p-4">
                       <Badge className={statusColors[order.status]}>
                         {formatStatus(order.status)}
                       </Badge>
                     </td>
                     <td className="p-4 text-right">
                       <div className="flex flex-col gap-2 items-end">
                         {order.status !== 'order_placed' && order.status !== 'received' && (
                           <Button 
                             variant="outline"
                             size="sm"
                             onClick={() => {
                               if (!order.order_number || order.order_number.trim() === '') {
                                 alert('Please ensure to update order number, before marking as ordered.');
                                 return;
                               }
                               markOrderedMutation.mutate(order);
                             }}
                             className="text-blue-600 border-blue-600 hover:bg-blue-50 w-full"
                             disabled={markOrderedMutation.isPending}
                           >
                             Mark Ordered
                           </Button>
                         )}
                         {order.status !== 'received' && (
                           <Button 
                             variant="outline"
                             size="sm"
                             onClick={() => markReceivedMutation.mutate(order)}
                             className="text-green-600 border-green-600 hover:bg-green-50 w-full"
                             disabled={markReceivedMutation.isPending}
                           >
                             <CheckCircle2 className="w-4 h-4 mr-1" />
                             Mark Received
                           </Button>
                         )}
                         <div className="flex gap-2 justify-end w-full">
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
                           <Button 
                             variant="ghost" 
                             size="sm"
                             onClick={() => setDeletingOrder(order)}
                             className="text-red-600 hover:text-red-700 hover:bg-red-50"
                           >
                             <Trash2 className="w-4 h-4" />
                           </Button>
                         </div>
                       </div>
                     </td>
                   </tr>
                  ))}
                </tbody>
              </table>
              {sortedOrders.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No orders found
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <AlertDialog open={!!deletingOrder} onOpenChange={() => setDeletingOrder(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Supply Order</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this order? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingOrder && deleteMutation.mutate(deletingOrder.id)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}