import React, { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Trash2, Search, Check, CheckCircle, AlertCircle, X,
  Image as ImageIcon, History, ChevronDown, ChevronUp, Loader2, RefreshCw
} from "lucide-react";

const LOCATIONS = ['Glastonbury', 'Manchester', 'Bloomfield', 'Farmington', 'Waterside'];

const OPEN_STATUSES = ['pending_review', 'pending_fulfillment'];

export default function PublicSupplyRequest() {
  const queryClient = useQueryClient();

  // Requester identity
  const [requesterName, setRequesterName] = useState('Jalisa Henry');
  const [requesterEmail, setRequesterEmail] = useState('JHenry@enticmd.com');
  const [isNewName, setIsNewName] = useState(false);
  const [isNewEmail, setIsNewEmail] = useState(false);

  // Location & persistent order state
  const [location, setLocation] = useState('');
  const [activeOrder, setActiveOrder] = useState(null); // the persistent open order
  const [loadingOrder, setLoadingOrder] = useState(false);

  // Items on the current order
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState('');

  // UI state
  const [pendingQuantities, setPendingQuantities] = useState({});
  const [itemSelectOpen, setItemSelectOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitStatus, setSubmitStatus] = useState('');

  // Past orders
  const [showPastOrders, setShowPastOrders] = useState(false);
  const [pastOrdersLocation, setPastOrdersLocation] = useState('');
  const [pastOrdersSearch, setPastOrdersSearch] = useState('');

  // Supplies catalog
  const { data: supplies = [] } = useQuery({
    queryKey: ['supplies', 'office'],
    queryFn: () => base44.entities.Supply.filter({ category: 'office' })
  });

  // Past orders
  const { data: pastOrders = [], isLoading: pastOrdersLoading } = useQuery({
    queryKey: ['past-public-orders', pastOrdersLocation],
    queryFn: async () => {
      const response = await base44.functions.invoke('getPastPublicOrders', { location: pastOrdersLocation, limit: 30 });
      return response.data?.orders || [];
    },
    enabled: showPastOrders
  });

  // Load or create the persistent open order for the selected location
  const loadOrderForLocation = useCallback(async (loc) => {
    if (!loc) return;
    setLoadingOrder(true);
    setActiveOrder(null);
    setItems([]);
    setNotes('');
    try {
      const response = await base44.functions.invoke('getOrCreatePublicOrder', { location: loc });
      const order = response.data?.order;
      if (order) {
        setActiveOrder(order);
        setItems(order.items || []);
        setNotes(order.notes || '');
      }
    } catch (err) {
      setSubmitStatus('error');
      setSubmitMessage('Failed to load order for location: ' + (err.message || 'Unknown error'));
    } finally {
      setLoadingOrder(false);
    }
  }, []);

  // When location changes, load the persistent order
  useEffect(() => {
    if (location) {
      loadOrderForLocation(location);
    } else {
      setActiveOrder(null);
      setItems([]);
      setNotes('');
    }
  }, [location]);

  const showMessage = (status, message) => {
    setSubmitStatus(status);
    setSubmitMessage(message);
    setTimeout(() => { setSubmitMessage(''); setSubmitStatus(''); }, 4000);
  };

  // Save current items to the persistent order
  const handleSave = async (e) => {
    e.preventDefault();

    if (!activeOrder) {
      showMessage('error', 'No active order loaded. Please select a location.');
      return;
    }
    if (items.length === 0) {
      showMessage('error', 'Please add at least one item before saving.');
      return;
    }
    if (!requesterName || !requesterEmail) {
      showMessage('error', 'Please provide your name and email.');
      return;
    }

    setSaving(true);
    try {
      // Run the same flag analysis logic via processSupplyRequest-style analysis
      // We update the persistent order with the latest items
      const analyzedItems = items.map(item => ({
        ...item,
        line_total: (item.quantity || 0) * (item.unit_price || 0)
      }));

      const subtotal = analyzedItems.reduce((sum, item) => sum + (item.line_total || 0), 0);

      const dataToUpdate = {
        items: analyzedItems,
        notes,
        subtotal,
        total_amount: subtotal,
        updated_after_submission: true,
        status: activeOrder.status // preserve existing status
      };

      const response = await base44.functions.invoke('updatePublicOrder', {
        id: activeOrder.id,
        data: dataToUpdate
      });

      // Refresh the order state
      const updated = response.data;
      if (updated) {
        setActiveOrder(updated);
        setItems(updated.items || []);
        setNotes(updated.notes || '');
      }

      showMessage('success', `Order saved for ${location}! Items have been added to the open order.`);
      queryClient.invalidateQueries({ queryKey: ['past-public-orders'] });
    } catch (err) {
      showMessage('error', 'Failed to save: ' + (err.response?.data?.error || err.message));
    } finally {
      setSaving(false);
    }
  };

  const addItem = (supply) => {
    if (items.some(i => i.supply_id === supply.id)) return;
    const qty = pendingQuantities[supply.id] || 1;
    setItems(prev => [{
      supply_id: supply.id,
      supply_name: supply.product_name,
      item_number: supply.item_number || '',
      quantity: qty,
      unit_price: supply.unit_price || 0,
      line_total: qty * (supply.unit_price || 0)
    }, ...prev]);
    setPendingQuantities(prev => { const n = { ...prev }; delete n[supply.id]; return n; });
  };

  const removeItem = (index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItemQty = (index, qty) => {
    setItems(prev => {
      const next = [...prev];
      next[index] = { ...next[index], quantity: qty, line_total: qty * (next[index].unit_price || 0) };
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
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

        {/* Status Message */}
        {submitMessage && (
          <Card className={`border ${submitStatus === 'error' ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
            <CardContent className="p-4 flex items-start gap-3">
              {submitStatus === 'success'
                ? <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
                : <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />}
              <p className={`text-sm flex-1 ${submitStatus === 'error' ? 'text-red-900' : 'text-green-900'}`}>
                {submitMessage}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Main Form */}
        <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="flex items-center justify-between">
              <span>Request Details</span>
              {activeOrder && (
                <Badge variant="outline" className="text-xs text-blue-700 border-blue-300 bg-blue-50">
                  Open Order #{activeOrder.id?.slice(-6).toUpperCase()}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <form onSubmit={handleSave}>
            <CardContent className="p-6 space-y-6">

              {/* Identity */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Your Name *</Label>
                  {isNewName ? (
                    <div className="flex gap-2">
                      <Input
                        value={requesterName}
                        onChange={e => setRequesterName(e.target.value)}
                        placeholder="Enter your full name"
                        required
                        autoFocus
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => { setIsNewName(false); setRequesterName(''); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Select value={requesterName} onValueChange={v => { if (v === 'new') { setIsNewName(true); setRequesterName(''); } else setRequesterName(v); }}>
                      <SelectTrigger><SelectValue placeholder="Select your name" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Jalisa Henry">Jalisa Henry</SelectItem>
                        <SelectItem value="new" className="text-blue-600 font-medium">
                          <Plus className="w-3 h-3 inline mr-2" />Add New Name...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Your Email *</Label>
                  {isNewEmail ? (
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        value={requesterEmail}
                        onChange={e => setRequesterEmail(e.target.value)}
                        placeholder="your.email@example.com"
                        required
                        autoFocus
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => { setIsNewEmail(false); setRequesterEmail(''); }}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <Select value={requesterEmail} onValueChange={v => { if (v === 'new') { setIsNewEmail(true); setRequesterEmail(''); } else setRequesterEmail(v); }}>
                      <SelectTrigger><SelectValue placeholder="Select your email" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="JHenry@enticmd.com">JHenry@enticmd.com</SelectItem>
                        <SelectItem value="new" className="text-blue-600 font-medium">
                          <Plus className="w-3 h-3 inline mr-2" />Add New Email...
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                {/* Location — triggers order load */}
                <div className="space-y-2 md:col-span-2">
                  <Label>Location *</Label>
                  <Select value={location} onValueChange={setLocation}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a location" />
                    </SelectTrigger>
                    <SelectContent>
                      {LOCATIONS.map(loc => (
                        <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Loading indicator */}
              {loadingOrder && (
                <div className="flex items-center gap-3 text-slate-500 py-4 justify-center">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm">Loading open order for {location}...</span>
                </div>
              )}

              {/* Order loaded banner */}
              {!loadingOrder && activeOrder && (
                <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
                  <span>
                    {items.length > 0
                      ? `Continuing open order — ${items.length} item(s) already added.`
                      : `New open order created for ${location}. Add items below.`}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-blue-700 hover:bg-blue-100 ml-2"
                    onClick={() => loadOrderForLocation(location)}
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Refresh
                  </Button>
                </div>
              )}

              {/* Items — only show when a location/order is loaded */}
              {!loadingOrder && activeOrder && (
                <div className="space-y-4">
                  <div>
                    <Label className="mb-2 block">Search and Add Items</Label>
                    <Popover open={itemSelectOpen} onOpenChange={setItemSelectOpen}>
                      <PopoverTrigger asChild>
                        <Button type="button" variant="outline" className="w-full justify-between font-normal">
                          <span>Search supplies to add...</span>
                          <Search className="h-4 w-4 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[400px] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search supplies..." />
                          <CommandEmpty>No supply found.</CommandEmpty>
                          <CommandGroup className="max-h-64 overflow-auto">
                            {supplies.map(supply => {
                              const alreadyAdded = items.some(i => i.supply_id === supply.id);
                              return (
                                <CommandItem
                                  key={supply.id}
                                  value={`${supply.item_number || ''} ${supply.product_name}`}
                                  onSelect={() => { if (!alreadyAdded) addItem(supply); }}
                                  className="flex items-start gap-2 py-3"
                                  disabled={alreadyAdded}
                                >
                                  <Check className={`h-4 w-4 flex-shrink-0 mt-1 ${alreadyAdded ? 'opacity-100' : 'opacity-0'}`} />
                                  <div className="h-10 w-10 rounded-md bg-white border border-slate-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                                    {supply.image_url
                                      ? <img src={supply.image_url} alt="" className="h-full w-full object-contain p-0.5" />
                                      : <ImageIcon className="h-5 w-5 text-slate-300" />}
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

                  {items.length > 0 && (
                    <div>
                      <Label className="mb-2 block">Items in this Order ({items.length})</Label>
                      <div className="space-y-2">
                        {items.map((item, index) => (
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
                                onChange={e => updateItemQty(index, parseFloat(e.target.value) || 1)}
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

                  <div className="space-y-2">
                    <Label>Notes / Special Instructions</Label>
                    <Textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Any special instructions or notes about your request..."
                    />
                  </div>
                </div>
              )}

              {/* Placeholder when no location selected */}
              {!location && (
                <div className="text-center py-8 text-slate-400">
                  <p className="text-sm">Select a location above to load or start an order.</p>
                </div>
              )}

            </CardContent>

            {activeOrder && (
              <CardFooter className="border-t border-slate-100 p-6 flex justify-end">
                <Button
                  type="submit"
                  disabled={saving || items.length === 0 || loadingOrder}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {saving ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</> : 'Save Items to Order'}
                </Button>
              </CardFooter>
            )}
          </form>
        </Card>

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
                    {LOCATIONS.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
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