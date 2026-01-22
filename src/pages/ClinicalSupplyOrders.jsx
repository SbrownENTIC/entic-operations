import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, Trash2, ClipboardList, Split } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
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
import { formatDateToEST } from "@/components/DateUtils";
import SupplyOrderForm from "../components/supplies/SupplyOrderForm";
import SplitOrderModal from "../components/supplies/SplitOrderModal";
import EmptyState from "@/components/ui/EmptyState";
import { ListPageSkeleton } from "@/components/ui/LoadingSkeletons";


export default function ClinicalSupplyOrders() {
  const urlParams = new URLSearchParams(window.location.search);
  const filterParam = urlParams.get('filter');
  
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(filterParam === 'pending' ? 'pending' : 'all');
  const [editingOrder, setEditingOrder] = useState(null);
  const [deletingOrder, setDeletingOrder] = useState(null);
  const [sortField, setSortField] = useState('order_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [summaryOrder, setSummaryOrder] = useState(null);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [splittingOrder, setSplittingOrder] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['supply-orders', 'clinical'],
    queryFn: () => base44.entities.SupplyOrder.filter({ category: 'clinical' }, '-order_date', 1000)
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SupplyOrder.create({ ...data, category: 'clinical' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supply-orders'] });
      setShowForm(false);
      setEditingOrder(null);
    },
    onError: (error) => {
      if (error?.status === 403 || error?.response?.status === 403 || error?.message?.includes('403')) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to create orders." });
      } else {
        toast({ variant: "destructive", title: "Error", description: error.message });
      }
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.SupplyOrder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supply-orders'] });
      setShowForm(false);
      setEditingOrder(null);
    },
    onError: (error) => {
      if (error?.status === 403 || error?.response?.status === 403 || error?.message?.includes('403')) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to update orders." });
      } else {
        toast({ variant: "destructive", title: "Error", description: error.message });
      }
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
    },
    onError: (error) => {
      if (error?.status === 403 || error?.response?.status === 403 || error?.message?.includes('403')) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to mark orders as received." });
      } else {
        toast({ variant: "destructive", title: "Error", description: error.message });
      }
    }
  });

  const markOrderedMutation = useMutation({
    mutationFn: (order) => {
      return base44.entities.SupplyOrder.update(order.id, { status: 'order_placed' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supply-orders'] });
    },
    onError: (error) => {
      if (error?.status === 403 || error?.response?.status === 403 || error?.message?.includes('403')) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to mark orders as ordered." });
      } else {
        toast({ variant: "destructive", title: "Error", description: error.message });
      }
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.SupplyOrder.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supply-orders'] });
      setDeletingOrder(null);
    },
    onError: (error) => {
      if (error?.status === 403 || error?.response?.status === 403 || error?.message?.includes('403')) {
        toast({ variant: "destructive", title: "Permission Denied", description: "You do not have permission to delete orders." });
      } else {
        toast({ variant: "destructive", title: "Error", description: error.message });
      }
    }
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      const batchSize = 10;
      for (let i = 0; i < ids.length; i += batchSize) {
        const batch = ids.slice(i, i + batchSize);
        await Promise.all(batch.map(id => base44.entities.SupplyOrder.delete(id)));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supply-orders'] });
      setSelectedOrders([]);
      setBulkDeleteConfirm(false);
    }
  });

  const bulkMarkReceivedMutation = useMutation({
    mutationFn: async (ids) => {
      // Filter out orders that are already received to avoid redundant updates
      const ordersToUpdate = orders.filter(o => ids.includes(o.id) && o.status !== 'received');
      
      await Promise.all(ordersToUpdate.map(order => {
        const updatedItems = (order.items || []).map(item => ({ ...item, received: true }));
        return base44.entities.SupplyOrder.update(order.id, { 
          status: 'received',
          items: updatedItems
        });
      }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supply-orders'] });
      setSelectedOrders([]);
    }
  });

  const splitOrderMutation = useMutation({
    mutationFn: async ({ originalOrder, itemsToSplit, targetLocation }) => {
      // itemsToSplit is array of { index, quantity }
      
      // 1. Construct lists of items for new order (move) and remaining (keep)
      const itemsToMove = [];
      const itemsToKeep = [];

      originalOrder.items.forEach((item, idx) => {
        const splitInfo = itemsToSplit.find(s => s.index === idx);
        
        if (splitInfo) {
          // Move specified quantity
          const moveQty = splitInfo.quantity;
          const remainingQty = (item.quantity || 0) - moveQty;
          
          if (moveQty > 0) {
            itemsToMove.push({
              ...item,
              quantity: moveQty,
              line_total: moveQty * (item.unit_price || 0)
            });
          }
          
          if (remainingQty > 0) {
            itemsToKeep.push({
              ...item,
              quantity: remainingQty,
              line_total: remainingQty * (item.unit_price || 0)
            });
          }
          // if remainingQty <= 0, item is fully moved and removed from original
        } else {
          // Keep item as is
          itemsToKeep.push(item);
        }
      });
      
      // 2. Calculate new totals
      const subtotalMove = itemsToMove.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0);
      const subtotalKeep = itemsToKeep.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0);
      
      const originalSubtotal = originalOrder.subtotal || (subtotalMove + subtotalKeep) || 1; // avoid div by 0
      const ratioMove = subtotalMove / originalSubtotal;
      
      const taxMove = (originalOrder.tax || 0) * ratioMove;
      const taxKeep = (originalOrder.tax || 0) - taxMove;
      
      const totalMove = subtotalMove + taxMove;
      const totalKeep = subtotalKeep + taxKeep;

      // 3. Create new order
      await base44.entities.SupplyOrder.create({
        ...originalOrder,
        id: undefined, // Create new ID
        created_date: undefined,
        updated_date: undefined,
        location: targetLocation,
        order_number: `${originalOrder.order_number} - ${targetLocation}`,
        items: itemsToMove,
        subtotal: subtotalMove,
        tax: taxMove,
        total_amount: totalMove,
        status: 'order_placed', // New order starts as placed
        notes: `Split from order ${originalOrder.order_number}. \n${originalOrder.notes || ''}`
      });

      // 4. Update original order
      await base44.entities.SupplyOrder.update(originalOrder.id, {
        items: itemsToKeep,
        subtotal: subtotalKeep,
        tax: taxKeep,
        total_amount: totalKeep
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supply-orders'] });
      setSplittingOrder(null);
    }
  });

  const handleToggleSelect = (id, checked) => {
    if (id === 'all') {
      if (checked) {
        setSelectedOrders(filteredOrders.map(o => o.id));
      } else {
        setSelectedOrders([]);
      }
    } else {
      if (checked) {
        setSelectedOrders(prev => [...prev, id]);
      } else {
        setSelectedOrders(prev => prev.filter(i => i !== id));
      }
    }
  };

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

  // Format currency with commas
  const formatCurrency = (amount) => {
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.vendor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.location?.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesStatus = true;
    if (statusFilter === 'pending') {
      matchesStatus = order.status === 'pending_review' || order.status === 'pending_fulfillment';
    } else if (statusFilter !== 'all') {
      matchesStatus = order.status === statusFilter;
    }
    
    return matchesSearch && matchesStatus;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    let aValue, bValue;
    
    if (sortField === 'order_date' || sortField === 'updated_date') {
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

  const safeFormatDate = (dateString) => formatDateToEST(dateString);

  if (ordersLoading) {
    return <ListPageSkeleton />;
  }

  return (
    <>
    <div className="min-h-screen bg-slate-50 pb-8">
      <div className="p-2 md:p-3">
        <div className="max-w-7xl mx-auto space-y-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Clinical Supply Orders</h1>
            <p className="text-slate-600 text-sm">Track clinical supply orders and deliveries</p>
          </div>
          {user?.role === 'admin' && (
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
          )}
        </div>

        {showForm && (
          <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
            <SupplyOrderForm
              order={editingOrder}
              category="clinical"
              onSubmit={handleSubmit}
              onCancel={() => {
                setShowForm(false);
                setEditingOrder(null);
              }}
              isLoading={createMutation.isPending || updateMutation.isPending}
            />
          </div>
        )}
        </div>
      </div>

      <div className="px-4 md:px-6 pb-4">
        <div className="max-w-7xl mx-auto">
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
                  <SelectItem value="pending">Pending (Review/Fulfillment)</SelectItem>
                  <SelectItem value="pending_review">Pending Review</SelectItem>
                  <SelectItem value="pending_fulfillment">Pending Fulfillment</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="order_placed">Order Placed</SelectItem>
                  <SelectItem value="partially_received">Partially Received</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                </SelectContent>
              </Select>
              {user?.role === 'admin' && selectedOrders.length > 0 && (
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="text-green-600 border-green-200 hover:bg-green-50"
                    onClick={() => bulkMarkReceivedMutation.mutate(selectedOrders)}
                    disabled={bulkMarkReceivedMutation.isPending}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Mark Received ({selectedOrders.length})
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => setBulkDeleteConfirm(true)}
                  >
                    Delete Selected ({selectedOrders.length})
                  </Button>
                </div>
              )}
            </div>
            </CardHeader>
            <CardContent className="p-0">
            <div className="overflow-auto max-h-[600px]">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700 bg-slate-50 w-10">
                      <input
                        type="checkbox"
                        checked={filteredOrders.length > 0 && selectedOrders.length === filteredOrders.length}
                        onChange={(e) => handleToggleSelect('all', e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                    </th>
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
                      onClick={() => handleSort('updated_date')}
                    >
                      Date Modified <SortIcon field="updated_date" />
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
                     <td className="p-4">
                       <input
                         type="checkbox"
                         checked={selectedOrders.includes(order.id)}
                         onChange={(e) => handleToggleSelect(order.id, e.target.checked)}
                         className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                       />
                     </td>
                     <td className="p-4 text-slate-500 font-medium">{index + 1}</td>
                     <td className="p-4 font-medium text-slate-900">{order.order_number || '-'}</td>
                     <td className="p-4 text-slate-600">{order.vendor}</td>
                     <td className="p-4 text-slate-600">{order.location}</td>
                     <td className="p-4 text-slate-600">
                       {safeFormatDate(order.order_date)}
                     </td>
                     <td className="p-4 text-slate-600">
                       {safeFormatDate(order.updated_date)}
                     </td>
                     <td className={`p-4 font-medium ${order.total_amount < 0 || order.order_type === 'return' ? 'text-red-600' : 'text-green-600'}`}>
                       {order.order_type === 'return' && <span className="text-xs bg-red-100 text-red-800 px-1.5 py-0.5 rounded mr-2">Return</span>}
                       ${formatCurrency(order.total_amount || 0)}
                     </td>
                     <td className="p-4">
                       <Badge className={statusColors[order.status]}>
                         {formatStatus(order.status)}
                       </Badge>
                     </td>
                     <td className="p-4 text-right">
                       <div className="flex flex-col gap-2 items-end">
                         {user?.role === 'admin' && order.status !== 'order_placed' && order.status !== 'received' && (
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
                         {user?.role === 'admin' && order.status !== 'received' && (
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
                             onClick={() => setSummaryOrder(order)}
                             title="View Order Summary"
                           >
                             <ClipboardList className="w-4 h-4" />
                           </Button>
                           {user?.role === 'admin' && (
                             <>
                               <Button 
                                 variant="ghost" 
                                 size="sm"
                                 onClick={() => setSplittingOrder(order)}
                                 title="Split Order"
                               >
                                 <Split className="w-4 h-4" />
                               </Button>
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
                             </>
                           )}
                         </div>
                       </div>
                     </td>
                   </tr>
                  ))}
                </tbody>
              </table>
              {sortedOrders.length === 0 && (
                <div className="p-4">
                  <EmptyState
                    title="No orders found"
                    description={searchTerm ? "Try adjusting your search terms" : "Create a new clinical supply order"}
                    action={
                      !searchTerm && user?.role === 'admin' && (
                        <Button
                          onClick={() => {
                            setEditingOrder(null);
                            setShowForm(true);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 mt-4"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          New Order
                        </Button>
                      )
                    }
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <AlertDialog open={!!summaryOrder} onOpenChange={() => setSummaryOrder(null)}>
          <AlertDialogContent className="max-w-lg">
            <AlertDialogHeader>
              <AlertDialogTitle>Order Summary</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                    <p className="font-semibold text-blue-900 text-lg">{summaryOrder?.location}</p>
                    {summaryOrder?.order_number && (
                      <p className="text-sm text-blue-700">Order #: {summaryOrder.order_number}</p>
                    )}
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 sticky top-0">
                        <tr>
                          <th className="text-left p-2 font-semibold text-slate-700">Item #</th>
                          <th className="text-left p-2 font-semibold text-slate-700">Product</th>
                          <th className="text-left p-2 font-semibold text-slate-700">Lot #</th>
                          <th className="text-right p-2 font-semibold text-slate-700">Qty</th>
                        </tr>
                      </thead>
                    </table>
                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-sm">
                        <tbody>
                          {summaryOrder?.items?.map((item, idx) => (
                            <tr key={idx} className="border-t border-slate-200">
                              <td className="p-2 text-slate-900 font-mono">{item.item_number || '-'}</td>
                              <td className="p-2 text-slate-700">{item.supply_name}</td>
                              <td className="p-2 text-slate-600 font-mono text-xs">{item.lot_number || '-'}</td>
                              <td className="p-2 text-right font-semibold text-slate-900">{item.quantity}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Close</AlertDialogCancel>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

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

        <AlertDialog open={bulkDeleteConfirm} onOpenChange={setBulkDeleteConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Multiple Orders</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {selectedOrders.length} selected orders? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => bulkDeleteMutation.mutate(selectedOrders)}
                className="bg-red-600 hover:bg-red-700"
              >
                {bulkDeleteMutation.isPending ? "Deleting..." : "Delete All"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <SplitOrderModal
          order={splittingOrder}
          isOpen={!!splittingOrder}
          onClose={() => setSplittingOrder(null)}
          onSplit={(originalOrder, itemsToSplit, targetLocation) => {
            splitOrderMutation.mutate({ originalOrder, itemsToSplit, targetLocation });
          }}
          isLoading={splitOrderMutation.isPending}
        />
        </div>
      </div>
    </div>
    </>
  );
}