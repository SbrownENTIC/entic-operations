import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Search, Check, CheckCircle, AlertCircle, HeartPulse, X, Image as ImageIcon, Edit, Clock, History, ChevronDown, ChevronUp } from "lucide-react";
import { format, isToday, parseISO } from "date-fns";

export default function PublicSupplyRequest() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    location: '', // No default location - user must select
    requester_name: 'Jalisa Henry',
    requester_email: 'JHenry@enticmd.com',
    requested_date: new Date().toISOString().split('T')[0],
    items: [],
    notes: ''
  });
  const [itemSelectOpen, setItemSelectOpen] = useState({});
  const [pendingQuantities, setPendingQuantities] = useState({}); // supply.id -> qty while in dropdown
  const [submitting, setSubmitting] = useState(false);
  const [isNewName, setIsNewName] = useState(false);
  const [isNewEmail, setIsNewEmail] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitStatus, setSubmitStatus] = useState(''); // 'success' or 'error'
  const [editingOrder, setEditingOrder] = useState(null);
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPastOrders, setShowPastOrders] = useState(false);
  const [pastOrdersLocation, setPastOrdersLocation] = useState('');
  const [pastOrdersSearch, setPastOrdersSearch] = useState('');
  const [autoLoadedForLocation, setAutoLoadedForLocation] = useState('');

  useEffect(() => {
    base44.auth.me()
      .then(() => setIsAuthenticated(true))
      .catch(() => setIsAuthenticated(false));
  }, []);

  const { data: supplies = [] } = useQuery({
    queryKey: ['supplies', 'office'],
    queryFn: () => base44.entities.Supply.filter({ category: 'office' })
  });

  const { data: pastOrders = [], isLoading: pastOrdersLoading } = useQuery({
    queryKey: ['past-public-orders', pastOrdersLocation],
    queryFn: async () => {
      const response = await base44.functions.invoke('getPastPublicOrders', { location: pastOrdersLocation, limit: 30 });
      return response.data?.orders || [];
    },
    enabled: showPastOrders
  });

  const { data: openOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['open-public-orders'],
    queryFn: async () => {
      const response = await base44.functions.invoke('getTodaysPublicOrders');
      return response.data || [];
    },
    refetchInterval: 30000
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      await base44.functions.invoke('updatePublicOrder', { id, data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['open-public-orders'] });
      resetForm();
      setSubmitStatus('success');
      setSubmitMessage('Your request has been submitted successfully!');
      setTimeout(() => {
        setSubmitMessage('');
        setSubmitStatus('');
      }, 3000);
    }
  });

  // Ensure defaults are set (fixes issues with hot reload or state persistence)
  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      requester_name: prev.requester_name || 'Jalisa Henry',
      requester_email: prev.requester_email || 'JHenry@enticmd.com'
    }));
  }, []);

  const resetForm = () => {
    setFormData({
      location: '',
      requester_name: 'Jalisa Henry',
      requester_email: 'JHenry@enticmd.com',
      requested_date: new Date().toISOString().split('T')[0],
      items: [],
      notes: ''
    });
    setEditingOrder(null);
    setAutoLoadedForLocation('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.location) {
      setSubmitStatus('error');
      setSubmitMessage('Please select a location');
      return;
    }

    if (!formData.requester_name || !formData.requester_email) {
      setSubmitStatus('error');
      setSubmitMessage('Please provide your name and email');
      return;
    }

    if (formData.items.length === 0) {
      setSubmitStatus('error');
      setSubmitMessage('Please add at least one item to your request');
      return;
    }

    setSubmitting(true);
    setSubmitMessage('');

    try {
      // Determine the order to update: either manually selected editingOrder, or auto-detected open order for location
      const targetOpenOrder = editingOrder || openOrders.find(
        o => o.location === formData.location && o.status === 'open'
      );

      if (targetOpenOrder) {
        // UPDATE existing open order → transition to pending_review
        await updateMutation.mutateAsync({
          id: targetOpenOrder.id,
          data: {
            items: formData.items,
            notes: formData.notes,
            location: formData.location,
            status: 'pending_review',
            order_date: targetOpenOrder.order_date,
            category: targetOpenOrder.category,
            vendor: targetOpenOrder.vendor,
            updated_after_submission: true
          }
        });
        // updateMutation onSuccess handles reset + success message
      } else {
        // CREATE new order directly as pending_review
        const response = await base44.functions.invoke('processSupplyRequest', formData);
        setSubmitStatus('success');
        setSubmitMessage(response.data.message || 'Request submitted successfully!');
        queryClient.invalidateQueries({ queryKey: ['open-public-orders'] });
        resetForm();
      }
    } catch (error) {
      setSubmitStatus('error');
      setSubmitMessage('Error: ' + (error.response?.data?.error || error.message));
    } finally {
      setSubmitting(false);
    }
  };



  const removeItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index)
    });
  };

  const updateItem = (index, field, value) => {
    const newItems = [...formData.items];
    newItems[index] = { ...newItems[index], [field]: value };
    setFormData({ ...formData, items: newItems });
  };

  const handleEditOrder = (order) => {
    // Only "open" draft orders are editable
    if (order.status !== 'open') {
      setSubmitStatus('error');
      setSubmitMessage('This order has already been submitted and cannot be edited.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setAutoLoadedForLocation(order.location);
    setEditingOrder(order);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => resetForm();

  // When editing, populate form with order data
  useEffect(() => {
    if (editingOrder) {
      setFormData(prev => ({
        ...prev,
        location: editingOrder.location,
        items: editingOrder.items || [],
        notes: editingOrder.notes || ''
      }));
    }
  }, [editingOrder]);

  // Auto-load open order when location is selected
  useEffect(() => {
    if (!formData.location || editingOrder) return;
    // Only auto-load once per location selection (avoid re-triggering on item edits)
    if (formData.location === autoLoadedForLocation) return;

    const openOrderForLocation = openOrders.find(
      o => o.location === formData.location && o.status === 'open'
    );

    if (openOrderForLocation) {
      setAutoLoadedForLocation(formData.location);
      setEditingOrder(openOrderForLocation);
    } else {
      setAutoLoadedForLocation(formData.location);
    }
  }, [formData.location, openOrders]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <div className="flex flex-col items-center gap-4 mb-2">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/691521cbabed77e5043c7037/267bf0119_thumbnail_ENTIC_horizontal_BKGD.png" 
              alt="ENTIC Logo" 
              className="h-16 w-auto"
            />
            <h1 className="text-3xl font-bold text-slate-900">Supply Request Form</h1>
          </div>
          <p className="text-slate-600 mt-2">Request supplies for your location</p>
        </div>

        {submitMessage && (
          <Card className={`border ${submitStatus === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
            <CardContent className="p-4 flex items-start gap-3">
              {submitStatus === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              )}
              <p className={`text-sm flex-1 ${submitStatus === 'error' ? 'text-red-900' : 'text-green-900'}`}>
                {submitMessage}
              </p>
            </CardContent>
          </Card>
        )}

        <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center justify-between">
              <span>{editingOrder ? `Edit Open Order — ${editingOrder.location}` : 'Request Details'}</span>
              {editingOrder && (
                <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel Edit
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="p-6 space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="requester_name">Your Name *</Label>
                  {isNewName ? (
                    <div className="flex gap-2">
                      <Input
                        id="requester_name"
                        value={formData.requester_name}
                        onChange={(e) => setFormData({ ...formData, requester_name: e.target.value })}
                        placeholder="Enter your full name"
                        required
                        autoFocus
                      />
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => { 
                          setIsNewName(false); 
                          setFormData(prev => ({ ...prev, requester_name: '' })); 
                        }}
                        title="Cancel custom name"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Select 
                      value={formData.requester_name} 
                      onValueChange={(value) => {
                        if (value === 'new') {
                          setIsNewName(true);
                          setFormData(prev => ({ ...prev, requester_name: '' }));
                        } else {
                          setFormData(prev => ({ ...prev, requester_name: value }));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your name" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Jalisa Henry">Jalisa Henry</SelectItem>
                        <SelectItem value="new" className="text-blue-600 font-medium">
                          <Plus className="w-3 h-3 inline mr-2" />
                          Add New Name...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requester_email">Your Email *</Label>
                  {isNewEmail ? (
                    <div className="flex gap-2">
                      <Input
                        id="requester_email"
                        type="email"
                        value={formData.requester_email}
                        onChange={(e) => setFormData({ ...formData, requester_email: e.target.value })}
                        placeholder="your.email@example.com"
                        required
                        autoFocus
                      />
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => { 
                          setIsNewEmail(false); 
                          setFormData(prev => ({ ...prev, requester_email: '' })); 
                        }}
                        title="Cancel custom email"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Select 
                      value={formData.requester_email} 
                      onValueChange={(value) => {
                        if (value === 'new') {
                          setIsNewEmail(true);
                          setFormData(prev => ({ ...prev, requester_email: '' }));
                        } else {
                          setFormData(prev => ({ ...prev, requester_email: value }));
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select your email" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="JHenry@enticmd.com">JHenry@enticmd.com</SelectItem>
                        <SelectItem value="new" className="text-blue-600 font-medium">
                          <Plus className="w-3 h-3 inline mr-2" />
                          Add New Email...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="location">Location *</Label>
                  <Select value={formData.location} onValueChange={(value) => { setAutoLoadedForLocation(''); setEditingOrder(null); setFormData(prev => ({ ...prev, location: value, items: [], notes: '' })); }} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Glastonbury">Glastonbury</SelectItem>
                      <SelectItem value="Manchester">Manchester</SelectItem>
                      <SelectItem value="Bloomfield">Bloomfield</SelectItem>
                      <SelectItem value="Farmington">Farmington</SelectItem>
                      <SelectItem value="Waterside">Waterside</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="requested_date">Request Date</Label>
                  <Input
                    id="requested_date"
                    type="date"
                    value={formData.requested_date}
                    onChange={(e) => setFormData({ ...formData, requested_date: e.target.value })}
                    disabled
                  />
                </div>
              </div>

              <div>
                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block">Search and Add Items</Label>
                    <Popover open={itemSelectOpen['main']} onOpenChange={(open) => setItemSelectOpen({ ...itemSelectOpen, 'main': open })}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-between font-normal"
                        >
                          <span>Search supplies to add...</span>
                          <Search className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search supplies..." />
                          <CommandEmpty>No supply found.</CommandEmpty>
                          <CommandGroup className="max-h-64 overflow-auto">
                            {supplies.map((supply) => {
                              const alreadyAdded = formData.items.some(item => item.supply_id === supply.id);
                              return (
                                <CommandItem
                                 key={supply.id}
                                 value={`${supply.item_number || ''} ${supply.product_name}`}
                                 onSelect={() => {
                                   if (!alreadyAdded) {
                                     const qty = pendingQuantities[supply.id] || 1;
                                     setFormData(prev => ({
                                      ...prev,
                                      items: [{
                                        supply_id: supply.id,
                                        supply_name: supply.product_name,
                                        quantity: qty,
                                        unit_price: supply.unit_price || 0,
                                        item_number: supply.item_number || ''
                                      }, ...prev.items]
                                     }));
                                     setPendingQuantities(prev => { const n = {...prev}; delete n[supply.id]; return n; });
                                   }
                                   // Don't close the popover - keep it open for multiple selections
                                 }}
                                 className="flex items-start gap-2 py-3"
                                 disabled={alreadyAdded}
                                >
                                 <Check
                                   className={`h-4 w-4 flex-shrink-0 mt-1 ${
                                     alreadyAdded ? "opacity-100" : "opacity-0"
                                   }`}
                                 />
                                 <div className="h-10 w-10 rounded-md bg-white border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                   {supply.image_url ? (
                                     <img 
                                       src={supply.image_url} 
                                       alt="" 
                                       className="h-full w-full object-contain p-0.5"
                                     />
                                   ) : (
                                     <ImageIcon className="h-5 w-5 text-slate-300" />
                                   )}
                                 </div>
                                 <div className="flex flex-col flex-1 min-w-0">
                                   <span className="break-words font-medium text-sm leading-snug">{supply.product_name}</span>
                                   <span className="text-xs text-slate-500">
                                     {supply.item_number && `Item# ${supply.item_number}`}
                                     {supply.units && ` • Units: ${supply.units}`}
                                   </span>
                                 </div>
                                 {!alreadyAdded && (
                                   <div className="flex-shrink-0 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                     <span className="text-xs text-slate-500">Qty:</span>
                                     <input
                                       type="number"
                                       min="1"
                                       value={pendingQuantities[supply.id] || 1}
                                       onChange={e => setPendingQuantities(prev => ({ ...prev, [supply.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                                       className="w-14 border border-slate-300 rounded px-1 py-0.5 text-sm text-center"
                                       onClick={e => e.stopPropagation()}
                                     />
                                   </div>
                                 )}
                                </CommandItem>
                              );
                            })}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {formData.items.length > 0 && (
                    <div>
                      <Label className="mb-2 block">Selected Items ({formData.items.length})</Label>
                      <div className="space-y-2">
                  {formData.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-slate-900">{item.supply_name}</p>
                        {item.item_number && <p className="text-sm text-slate-500">Item# {item.item_number}</p>}
                      </div>
                      <div className="w-24">
                        <Label className="text-xs text-slate-600">Quantity</Label>
                        <Input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value))}
                          min="1"
                          required
                          className="mt-1"
                        />
                      </div>
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(index)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes / Special Instructions</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                  placeholder="Any special instructions or notes about your request..."
                />
              </div>
            </CardContent>
            <CardFooter className="border-t border-slate-100 p-6 flex justify-end">
              <Button 
                type="submit" 
                disabled={submitting || formData.items.length === 0 || updateMutation.isPending} 
                className="bg-blue-600 hover:bg-blue-700"
              >
                {updateMutation.isPending ? 'Updating...' : submitting ? 'Submitting...' : editingOrder ? 'Update Order' : 'Submit Request'}
              </Button>
            </CardFooter>
          </form>
        </Card>

        {openOrders.length > 0 && (
          <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Open Orders
                <Badge variant="outline" className="ml-2">{openOrders.length}</Badge>
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">These orders are pending and can still be added to. Select a location above to automatically load the open order for that location.</p>
              <div className="mt-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search by location, items, or notes..."
                    value={orderSearchTerm}
                    onChange={(e) => setOrderSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {ordersLoading ? (
                <div className="p-8 text-center text-slate-500">Loading orders...</div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {[...openOrders]
                    .sort((a, b) => {
                      const statusOrder = { pending_review: 0, pending_fulfillment: 1 };
                      const sDiff = (statusOrder[a.status] ?? 99) - (statusOrder[b.status] ?? 99);
                      if (sDiff !== 0) return sDiff;
                      return new Date(b.created_date) - new Date(a.created_date);
                    })
                    .filter(order => {
                    if (!orderSearchTerm) return true;
                    const searchLower = orderSearchTerm.toLowerCase();
                    return (
                      order.location?.toLowerCase().includes(searchLower) ||
                      order.notes?.toLowerCase().includes(searchLower) ||
                      order.items?.some(item => item.supply_name?.toLowerCase().includes(searchLower))
                    );
                  }).map((order) => (
                    <div key={order.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{order.location}</span>
                            <Badge variant="outline" className="text-xs">
                              {order.items?.length || 0} items
                            </Badge>
                            <Badge className="bg-slate-100 text-slate-700 text-xs">
                              Open Draft
                            </Badge>
                            {order.updated_after_submission && (
                              <Badge className="bg-orange-100 text-orange-800 text-xs">Updated</Badge>
                            )}
                          </div>
                          <div className="text-sm text-slate-600">
                            <span className="font-medium">Submitted:</span> {new Date(order.created_date).toLocaleDateString('en-US', { 
                              timeZone: 'America/New_York', 
                              month: 'short', 
                              day: 'numeric', 
                              year: 'numeric' 
                            })}
                          </div>
                          {order.notes && (
                            <div className="text-sm text-slate-600">
                              <span className="font-medium">Notes:</span> {order.notes}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {order.items?.slice(0, 3).map((item, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {item.supply_name} (x{item.quantity})
                              </Badge>
                            ))}
                            {order.items?.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{order.items.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </div>
                        <Button
                          onClick={() => handleEditOrder(order)}
                          size="sm"
                          variant="default"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Past Orders */}
        <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardHeader
            className="border-b border-slate-100 cursor-pointer select-none"
            onClick={() => setShowPastOrders(v => !v)}
          >
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <History className="w-5 h-5" />
                Past Orders
              </span>
              {showPastOrders ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
            </CardTitle>
            {!showPastOrders && (
              <p className="text-sm text-slate-500 mt-1">Click to view previously submitted orders</p>
            )}
          </CardHeader>
          {showPastOrders && (
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={pastOrdersLocation} onValueChange={setPastOrdersLocation}>
                  <SelectTrigger className="sm:w-48">
                    <SelectValue placeholder="All locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>All Locations</SelectItem>
                    <SelectItem value="Glastonbury">Glastonbury</SelectItem>
                    <SelectItem value="Manchester">Manchester</SelectItem>
                    <SelectItem value="Bloomfield">Bloomfield</SelectItem>
                    <SelectItem value="Farmington">Farmington</SelectItem>
                    <SelectItem value="Waterside">Waterside</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search items or notes..."
                    value={pastOrdersSearch}
                    onChange={e => setPastOrdersSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              {pastOrdersLoading ? (
                <div className="py-6 text-center text-slate-500 text-sm">Loading past orders...</div>
              ) : pastOrders.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-sm">No past orders found.</div>
              ) : (
                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto rounded-lg border border-slate-100">
                  {pastOrders.filter(order => {
                    if (!pastOrdersSearch) return true;
                    const s = pastOrdersSearch.toLowerCase();
                    return (
                      order.location?.toLowerCase().includes(s) ||
                      order.notes?.toLowerCase().includes(s) ||
                      order.items?.some(item => item.supply_name?.toLowerCase().includes(s))
                    );
                  }).map(order => (
                    <div key={order.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-900 text-sm">{order.location}</span>
                            <span className="text-xs text-slate-400">{order.order_date}</span>
                            <Badge variant="outline" className="text-xs">{order.items?.length || 0} items</Badge>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {order.items?.map((item, idx) => (
                              <span key={idx} className="inline-flex items-center text-xs bg-slate-100 text-slate-700 rounded px-2 py-0.5">
                                {item.item_number && <span className="mr-1 text-slate-400 font-mono">#{item.item_number}</span>}
                                {item.supply_name} <span className="ml-1 text-slate-400">×{item.quantity}</span>
                              </span>
                            ))}
                          </div>
                          {order.notes && (
                            <p className="text-xs text-slate-500 mt-1 italic">{order.notes}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          )}
        </Card>

      </div>
    </div>
  );
}