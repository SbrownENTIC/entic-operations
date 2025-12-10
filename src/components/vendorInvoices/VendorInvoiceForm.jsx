import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter } from "@/components/ui/dialog";
import { Loader2, ExternalLink, ArrowRight, Save, Link as LinkIcon, Unlink, CheckCircle2, Split } from "lucide-react";
import SupplyOrderMatcher from "./SupplyOrderMatcher";
import InvoiceAllocator from "./InvoiceAllocator";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";

export default function VendorInvoiceForm({ invoice, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = React.useState({
    vendor_name: invoice?.vendor_name || "",
    invoice_number: invoice?.invoice_number || "",
    invoice_date: invoice?.invoice_date || "",
    total_amount: invoice?.total_amount || 0,
    status: invoice?.status || "pending_review",
    location: invoice?.location || "",
    notes: invoice?.notes || "",
    linked_supply_order_ids: invoice?.linked_supply_order_ids || []
  });

  // Fetch linked orders details
  const { data: linkedOrders = [] } = useQuery({
      queryKey: ['linked-orders', formData.linked_supply_order_ids],
      queryFn: async () => {
          if (!formData.linked_supply_order_ids?.length) return [];
          // In a real app we'd have a bulk fetch by IDs or use Promise.all
          // using filter for now if supported or individual fetches
          // Since SDK doesn't support "in" query easily, we'll fetch individually or use a custom function if many
          // For now let's assume simple Promise.all of individual gets if IDs are few
          const promises = formData.linked_supply_order_ids.map(id => 
              base44.entities.SupplyOrder.list(null, 1, { id: id })
              .then(res => res[0])
              .catch(() => null)
          );
          const results = await Promise.all(promises);
          return results.filter(Boolean);
      },
      enabled: formData.linked_supply_order_ids?.length > 0
  });

  const handleLinkOrder = (order) => {
      const currentIds = formData.linked_supply_order_ids || [];
      if (!currentIds.includes(order.id)) {
          setFormData(prev => ({
              ...prev,
              linked_supply_order_ids: [...currentIds, order.id]
          }));
      }
  };

  const handleUnlinkOrder = (orderId) => {
      setFormData(prev => ({
          ...prev,
          linked_supply_order_ids: prev.linked_supply_order_ids.filter(id => id !== orderId)
      }));
  };

  React.useEffect(() => {
    if (invoice) {
      setFormData({
        vendor_name: invoice.vendor_name || "",
        invoice_number: invoice.invoice_number || "",
        invoice_date: invoice.invoice_date || "",
        total_amount: invoice.total_amount || 0,
        status: invoice.status || "pending_review",
        location: invoice.location || "",
        notes: invoice.notes || "",
        linked_supply_order_ids: invoice.linked_supply_order_ids || []
      });
    }
  }, [invoice]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const [activeTab, setActiveTab] = React.useState("details"); // details, linking, allocate

  const handleSelectChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const [pdfBlobUrl, setPdfBlobUrl] = React.useState(null);
  const [pdfLoading, setPdfLoading] = React.useState(false);
  const [pdfError, setPdfError] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    let url = null;

    const fetchPdf = async () => {
      if (!invoice?.document_url) return;
      
      try {
        setPdfLoading(true);
        setPdfError(false);
        const response = await fetch(invoice.document_url);
        if (!response.ok) throw new Error('Failed to load PDF');
        
        const blob = await response.blob();
        // Create a new blob with explicitly set type to ensure browser treats it as PDF
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        
        if (active) {
          url = URL.createObjectURL(pdfBlob);
          setPdfBlobUrl(url);
        }
      } catch (err) {
        console.error("Error loading PDF preview:", err);
        if (active) {
            setPdfError(true);
            // Fallback to original URL if fetch fails, though it might still have the original issue
            setPdfBlobUrl(invoice.document_url);
        }
      } finally {
        if (active) setPdfLoading(false);
      }
    };

    fetchPdf();

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [invoice?.document_url]);

  const [isNextAction, setIsNextAction] = React.useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      total_amount: parseFloat(formData.total_amount)
    }, isNextAction);
  };

  return (
    <form onSubmit={handleSubmit} className="py-4">
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-4">
            {/* Tabs for switching between Details and Linking */}
            <div className="flex space-x-1 rounded-lg bg-slate-100 p-1 mb-4">
                <button
                    type="button"
                    onClick={() => setActiveTab("details")}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-md py-1.5 text-sm font-medium transition-all ${
                        activeTab === "details" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-900"
                    }`}
                >
                    Invoice Details
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("linking")}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-md py-1.5 text-sm font-medium transition-all ${
                        activeTab === "linking" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-900"
                    }`}
                >
                    Link Orders 
                    {formData.linked_supply_order_ids?.length > 0 && (
                        <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] min-w-4 bg-blue-100 text-blue-700">
                            {formData.linked_supply_order_ids.length}
                        </Badge>
                    )}
                </button>
                <button
                    type="button"
                    onClick={() => setActiveTab("allocate")}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-md py-1.5 text-sm font-medium transition-all ${
                        activeTab === "allocate" ? "bg-white shadow text-slate-900" : "text-slate-500 hover:text-slate-900"
                    }`}
                >
                    Allocate Items
                </button>
            </div>

          {activeTab === "details" ? (
          <>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="vendor_name">Vendor Name</Label>
          <Input
            id="vendor_name"
            name="vendor_name"
            value={formData.vendor_name}
            onChange={handleChange}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invoice_number">Invoice Number</Label>
          <Input
            id="invoice_number"
            name="invoice_number"
            value={formData.invoice_number}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="invoice_date">Invoice Date</Label>
          <Input
            id="invoice_date"
            name="invoice_date"
            type="date"
            value={formData.invoice_date}
            onChange={handleChange}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="total_amount">Total Amount</Label>
          <Input
            id="total_amount"
            name="total_amount"
            type="number"
            step="0.01"
            value={formData.total_amount}
            onChange={handleChange}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="location">Location</Label>
          <Select
            value={formData.location}
            onValueChange={(value) => handleSelectChange("location", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select location" />
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
          <Label htmlFor="status">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => handleSelectChange("status", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending_review">Pending Review</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
              <SelectItem value="processed">Processed</SelectItem>
              <SelectItem value="order_placed">Order Placed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
            />
          </div>
          </>
          ) : activeTab === "linking" ? (
             <div className="space-y-6">
                 {/* Linked Orders List */}
                 <div className="space-y-3">
                     <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                         <LinkIcon className="w-4 h-4 text-green-600" />
                         Linked Clinical Supply Orders
                     </h3>
                     {linkedOrders.length > 0 ? (
                         <div className="space-y-2">
                             {linkedOrders.map(order => (
                                 <div key={order.id} className="flex items-center justify-between p-3 bg-green-50 border border-green-100 rounded-lg">
                                     <div>
                                         <div className="font-medium text-green-900 flex items-center gap-2">
                                             {order.order_number}
                                             <CheckCircle2 className="w-3 h-3 text-green-600" />
                                         </div>
                                         <div className="text-xs text-green-700 mt-1">
                                             {order.vendor} • ${order.total_amount?.toFixed(2)} • {format(parseISO(order.order_date), 'MMM d')}
                                         </div>
                                     </div>
                                     <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleUnlinkOrder(order.id)}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                                     >
                                         <Unlink className="w-4 h-4 mr-1" /> Unlink
                                     </Button>
                                 </div>
                             ))}
                         </div>
                     ) : (
                         <div className="text-sm text-slate-500 italic p-4 bg-slate-50 rounded border border-dashed border-slate-200 text-center">
                             No orders linked yet. Use the tool below to find matches.
                         </div>
                     )}
                 </div>

                 {/* Matcher Tool */}
                 <div className="pt-4 border-t border-slate-100">
                     <SupplyOrderMatcher 
                        invoice={invoice} 
                        onLink={handleLinkOrder}
                     />
                 </div>
             </div>
          ) : activeTab === "allocate" ? (
             <InvoiceAllocator 
                invoice={invoice}
                onOrderCreated={(newOrder) => {
                    handleLinkOrder(newOrder);
                    // Optionally switch to linking tab to show the new link
                    // setActiveTab("linking");
                }}
             />
          ) : null}

          <DialogFooter className="pt-4">
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading} 
                onClick={() => setIsNextAction(false)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading && !isNextAction ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save & Close
              </Button>
              <Button 
                type="submit" 
                disabled={isLoading} 
                onClick={(e) => {
                    // Make sure we validate form first if in linking tab
                    // Actually standard submit handles validation of required fields
                    // but they might be hidden. 
                    // However, we populated default values so it should be fine.
                    setIsNextAction(true);
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                {isLoading && isNextAction ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Save & Next
              </Button>
            </div>
          </DialogFooter>
        </div>

        {invoice?.document_url && (
          <div className="flex-1 border rounded-lg overflow-hidden bg-slate-50 flex flex-col h-[600px] lg:h-auto lg:min-h-full">
            <div className="p-2 border-b bg-white flex justify-between items-center shrink-0">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider px-2">Document Preview</span>
              <Button variant="ghost" size="sm" className="h-8" asChild>
                <a href={invoice.document_url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in New Tab
                </a>
              </Button>
            </div>
            <div className="flex-1 relative bg-white">
              {pdfLoading ? (
                <div className="absolute inset-0 flex items-center justify-center text-slate-400">
                   <Loader2 className="w-8 h-8 animate-spin" />
                   <span className="ml-2">Loading preview...</span>
                </div>
              ) : (
                 <iframe
                    src={pdfBlobUrl ? `${pdfBlobUrl}#toolbar=0&navpanes=0&scrollbar=0` : ''}
                    className="absolute inset-0 w-full h-full"
                    title="Invoice PDF"
                 />
              )}
            </div>
          </div>
        )}
      </div>
    </form>
  );
}