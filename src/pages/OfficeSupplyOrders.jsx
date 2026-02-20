import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, ArrowUpDown, ArrowUp, ArrowDown, CheckCircle2, Trash2, ClipboardList, Merge, Split } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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
import { useLocation } from "react-router-dom";

export default function OfficeSupplyOrders() {
  const urlParams = new URLSearchParams(window.location.search);
  const filterParam = urlParams.get('filter');
  
  const [showForm, setShowForm] = useState(false);
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(filterParam === 'pending' ? 'pending' : 'all');
  const [editingOrder, setEditingOrder] = useState(null);
  const [deletingOrder, setDeletingOrder] = useState(null);
  const [sortField, setSortField] = useState('order_date');
  const [sortDirection, setSortDirection] = useState('desc');
  const [summaryOrder, setSummaryOrder] = useState(null);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [isMerging, setIsMerging] = useState(false);
  const [splittingOrder, setSplittingOrder] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: user } = useQuery({
    queryKey: ['user'],
    queryFn: () => base44.auth.me()
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['supply-orders', 'office'],
    queryFn: () => base44.entities.SupplyOrder.filter({ category: 'office' }, '-order_date')
  });

  // Close form when navigating to root URL
  React.useEffect(() => {
    if (location.search === '' && showForm) {
      setShowForm(false);
      setEditingOrder(null);
    }
  }, [location.search]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.SupplyOrder.create({ ...data, category: 'office' }),
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

  const splitOrderMutation = useMutation({
    mutationFn: async ({ originalOrder, itemsToSplit, targetLocation }) => {
      const itemsToMove = [];
      const itemsToKeep = [];

      originalOrder.items.forEach((item, idx) => {
        const splitInfo = itemsToSplit.find(s => s.index === idx);
        if (splitInfo) {
          const moveQty = splitInfo.quantity;
          const remainingQty = (item.quantity || 0) - moveQty;
          if (moveQty > 0) {
            itemsToMove.push({ ...item, quantity: moveQty, line_total: moveQty * (item.unit_price || 0) });
          }
          if (remainingQty > 0) {
            itemsToKeep.push({ ...item, quantity: remainingQty, line_total: remainingQty * (item.unit_price || 0) });
          }
        } else {
          itemsToKeep.push(item);
        }
      });

      const subtotalMove = itemsToMove.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0);
      const subtotalKeep = itemsToKeep.reduce((sum, item) => sum + ((item.quantity || 0) * (item.unit_price || 0)), 0);
      const originalSubtotal = originalOrder.subtotal || (subtotalMove + subtotalKeep) || 1;
      const ratioMove = subtotalMove / originalSubtotal;
      const taxMove = (originalOrder.tax || 0) * ratioMove;
      const taxKeep = (originalOrder.tax || 0) - taxMove;

      await base44.entities.SupplyOrder.create({
        ...originalOrder,
        id: undefined,
        created_date: undefined,
        updated_date: undefined,
        location: targetLocation,
        order_number: `${originalOrder.order_number} - ${targetLocation}`,
        items: itemsToMove,
        subtotal: subtotalMove,
        tax: taxMove,
        total_amount: subtotalMove + taxMove,
        status: 'order_placed',
        notes: `Split from order ${originalOrder.order_number}.\n${originalOrder.notes || ''}`
      });

      await base44.entities.SupplyOrder.update(originalOrder.id, {
        items: itemsToKeep,
        subtotal: subtotalKeep,
        tax: taxKeep,
        total_amount: subtotalKeep + taxKeep
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supply-orders'] });
      setSplittingOrder(null);
      toast({ title: "Success", description: "Order split successfully." });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Error", description: error.message });
    }
  });

  const handleMergeOrders = async () => {
    if (selectedOrders.length < 2) return;
    
    // Client-side validation
    const ordersToMerge = orders.filter(o => selectedOrders.includes(o.id));
    const location = ordersToMerge[0]?.location;
    const sameLocation = ordersToMerge.every(o => o.location === location);
    
    if (!sameLocation) {
      toast({ variant: "destructive", title: "Merge Failed", description: "All selected orders must be for the same location." });
      return;
    }

    const validStatuses = ['pending_review', 'pending_fulfillment'];
    const invalidStatus = ordersToMerge.some(o => !validStatuses.includes(o.status));
    
    if (invalidStatus) {
       toast({ variant: "destructive", title: "Merge Failed", description: "Only pending orders can be merged." });
       return;
    }

    if (!confirm(`Are you sure you want to merge ${selectedOrders.length} orders? This will combine items into the oldest order and archive the rest.`)) {
      return;
    }

    setIsMerging(true);
    try {
      const response = await base44.functions.invoke('mergeSupplyOrders', { orderIds: selectedOrders });
      toast({ title: "Success", description: response.data.message });
      setSelectedOrders([]);
      queryClient.invalidateQueries({ queryKey: ['supply-orders'] });
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: error.message || "Failed to merge orders" });
    } finally {
      setIsMerging(false);
    }
  };

  const toggleSelectOrder = (orderId) => {
    setSelectedOrders(prev => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id));
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

  const safeFormatDate = (dateString) => formatDateToEST(dateString);

  if (ordersLoading) {
    return <ListPageSkeleton />;
  }

  return (
    <>
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
      <div className="flex-shrink-0 p-2 md:p-3">
        <div className="max-w-7xl mx-auto space-y-2">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Office Supply Orders</h1>
            <p className="text-slate-600 text-sm">Track office supply orders and deliveries</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedOrders.length > 1 && user?.role === 'admin' && (
              <Button
                onClick={handleMergeOrders}
                disabled={isMerging}
                variant="outline"
                className="bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
              >
                <Merge className="w-4 h-4 mr-2" />
                Merge ({selectedOrders.length})
              </Button>
            )}
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
        </div>

        {showForm && (
          <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
            <SupplyOrderForm
              order={editingOrder}
              category="office"
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

      <div className="flex-1 overflow-hidden px-4 md:px-6 pb-4">
        <div className="max-w-7xl mx-auto h-full">
        <Card className="border-slate-200 shadow-sm h-full flex flex-col">
          <CardHeader className="border-b border-slate-100 flex-shrink-0">
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
            </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
            <div className="overflow-auto h-full">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th className="p-4 w-12 bg-slate-50">
                      <Checkbox 
                        checked={filteredOrders.length > 0 && selectedOrders.length === filteredOrders.length}
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
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
                   <tr key={order.id} className={`border-b border-slate-100 transition-colors ${selectedOrders.includes(order.id) ? 'bg-blue-50/50' : 'hover:bg-slate-50'}`}>
                     <td className="p-4">
                       <Checkbox 
                         checked={selectedOrders.includes(order.id)}
                         onCheckedChange={() => toggleSelectOrder(order.id)}
                         aria-label={`Select order ${order.order_number}`}
                       />
                     </td>
                     <td className="p-4 text-slate-500 font-medium">{index + 1}</td>
                     <td className="p-4 font-medium text-slate-900">{order.order_number || '-'}</td>
                     <td className="p-4 text-slate-600">{order.vendor}</td>
                     <td className="p-4 text-slate-600">{order.location}</td>
                     <td className="p-4 text-slate-600">
                       {safeFormatDate(order.order_date)}
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
                            {order.items?.length > 0 && user?.role === 'admin' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSplittingOrder(order)}
                                title="Split Order"
                                className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                              >
                                <Split className="w-4 h-4" />
                              </Button>
                            )}

                             <>
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
                    description={searchTerm ? "Try adjusting your search terms" : "Create a new office supply order"}
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
        </div>
      </div>
    </div>

    <SplitOrderModal
      order={splittingOrder}
      isOpen={!!splittingOrder}
      onClose={() => setSplittingOrder(null)}
      onSplit={(originalOrder, itemsToSplit, targetLocation) =>
        splitOrderMutation.mutate({ originalOrder, itemsToSplit, targetLocation })
      }
      isLoading={splitOrderMutation.isPending}
    />
    </>
  );
}