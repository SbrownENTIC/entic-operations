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
import { Plus, Trash2, Search, Check, CheckCircle, AlertCircle, HeartPulse, X, Image as ImageIcon, Edit, Clock } from "lucide-react";
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
  const [submitting, setSubmitting] = useState(false);
  const [isNewName, setIsNewName] = useState(false);
  const [isNewEmail, setIsNewEmail] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [submitStatus, setSubmitStatus] = useState(''); // 'success' or 'error'
  const [editingOrder, setEditingOrder] = useState(null);
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    base44.auth.me()
      .then(() => setIsAuthenticated(true))
      .catch(() => setIsAuthenticated(false));
  }, []);

  const { data: supplies = [] } = useQuery({
    queryKey: ['supplies', 'office'],
    queryFn: () => base44.entities.Supply.filter({ category: 'office' })
  });

  const { data: todaysOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['todays-public-orders'],
    queryFn: async () => {
      // Use backend function to fetch orders securely for public users
      const response = await base44.functions.invoke('getTodaysPublicOrders');
      return response.data || [];
    },
    refetchInterval: 30000
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      // Use backend function to update orders securely for public users
      await base44.functions.invoke('updatePublicOrder', { id, data });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todays-public-orders'] });
      setEditingOrder(null);
      setSubmitStatus('success');
      setSubmitMessage('Order updated successfully!');
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.items.length === 0) {
      setSubmitStatus('error');
      setSubmitMessage('Please add at least one item to your request');
      return;
    }

    if (!formData.requester_name || !formData.requester_email) {
      setSubmitStatus('error');
      setSubmitMessage('Please provide your name and email');
      return;
    }

    if (!formData.location) {
      setSubmitStatus('error');
      setSubmitMessage('Please select a location');
      return;
    }

    setSubmitting(true);
    setSubmitMessage('');

    try {
      const response = await base44.functions.invoke('processSupplyRequest', formData);
      setSubmitStatus('success');
      setSubmitMessage(response.data.message || 'Request submitted successfully!');
      
      // Reset form
      setFormData({
        location: '',
        requester_name: '',
        requester_email: '',
        requested_date: new Date().toISOString().split('T')[0],
        items: [],
        notes: ''
      });
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

  const canEdit = (order) => {
    try {
      // Only public form orders are editable
      if (order.submission_source !== 'public_form') return false;

      const now = new Date();
      
      // 1. Time check: Strictly before 22:00 UTC
      if (now.getUTCHours() >= 22) return false;

      // 2. Date check: Order must be from today (UTC)
      const todayUTC = now.toISOString().split('T')[0];
      
      // Check order_date
      if (order.order_date === todayUTC) return true;
      
      // Fallback: Check created_date converted to UTC YYYY-MM-DD
      if (order.created_date) {
        const createdUTC = new Date(order.created_date).toISOString().split('T')[0];
        if (createdUTC === todayUTC) return true;
      }

      return false;
    } catch (e) {
      console.error("Edit check error", e);
      return false;
    }
  };

  const handleEditOrder = (order) => {
    if (!canEdit(order)) return;
    
    // Check if order has already been placed
    if (order.status === 'order_placed' || order.status === 'partially_received' || order.status === 'received') {
      setSubmitStatus('error');
      setSubmitMessage('This order has already been placed and cannot be edited. Please submit a new order instead.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    
    setEditingOrder(order);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdateOrder = async (e) => {
    e.preventDefault();
    if (!editingOrder) return;

    // Check if order has already been placed
    if (editingOrder.status === 'order_placed' || editingOrder.status === 'partially_received' || editingOrder.status === 'received') {
      setSubmitStatus('error');
      setSubmitMessage('This order has already been placed and cannot be edited. Please submit a new order instead.');
      cancelEdit();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const itemsChanged = JSON.stringify(editingOrder.items) !== JSON.stringify(formData.items);
    const notesChanged = editingOrder.notes !== formData.notes;

    const dataToSubmit = {
      ...formData,
      order_date: editingOrder.order_date,
      status: editingOrder.status,
      category: editingOrder.category,
      vendor: editingOrder.vendor,
      updated_after_submission: itemsChanged || notesChanged ? true : editingOrder.updated_after_submission
    };

    await updateMutation.mutateAsync({ id: editingOrder.id, data: dataToSubmit });
  };

  const cancelEdit = () => {
    setEditingOrder(null);
    setFormData({
      location: '',
      requester_name: 'Jalisa Henry',
      requester_email: 'JHenry@enticmd.com',
      requested_date: new Date().toISOString().split('T')[0],
      items: [],
      notes: ''
    });
  };

  // When editing, populate form with order data
  useEffect(() => {
    if (editingOrder) {
      setFormData({
        location: editingOrder.location,
        requester_name: 'Jalisa Henry',
        requester_email: 'JHenry@enticmd.com',
        requested_date: new Date().toISOString().split('T')[0],
        items: editingOrder.items || [],
        notes: editingOrder.notes || ''
      });
    }
  }, [editingOrder]);

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
              <span>{editingOrder ? 'Edit Order' : 'Request Details'}</span>
              {editingOrder && (
                <Button type="button" variant="ghost" size="sm" onClick={cancelEdit}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel Edit
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <form onSubmit={editingOrder ? handleUpdateOrder : handleSubmit}>
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
                  <Select value={formData.location} onValueChange={(value) => setFormData({ ...formData, location: value })} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a location" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Glastonbury">Glastonbury</SelectItem>
                      <SelectItem value="Manchester">Manchester</SelectItem>
                      <SelectItem value="Bloomfield">Bloomfield</SelectItem>
                      <SelectItem value="Farmington">Farmington</SelectItem>
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
                                  onSelect={(currentValue) => {
                                    if (!alreadyAdded) {
                                      setFormData(prev => ({
                                       ...prev,
                                       items: [...prev.items, {
                                         supply_id: supply.id,
                                         supply_name: supply.product_name,
                                         quantity: 1,
                                         unit_price: supply.unit_price || 0,
                                         item_number: supply.item_number || ''
                                       }]
                                      }));
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
                                      {supply.vendor && ` • ${supply.vendor}`}
                                    </span>
                                  </div>
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

        {todaysOrders.length > 0 && (
          <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Today's Orders
                <Badge variant="outline" className="ml-2">{todaysOrders.length}</Badge>
              </CardTitle>
              <p className="text-sm text-slate-600 mt-1">Orders can be edited until 5:00 PM EST</p>
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
                  {todaysOrders.filter(order => {
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
                          disabled={!canEdit(order)}
                          size="sm"
                          variant={canEdit(order) ? "default" : "ghost"}
                          className={canEdit(order) ? "" : "opacity-50 cursor-not-allowed"}
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          {canEdit(order) ? 'Edit' : 'Locked'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}