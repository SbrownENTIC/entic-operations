import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter } from "@/components/ui/dialog";
import { Loader2, ExternalLink, ArrowRight, Save } from "lucide-react";

export default function VendorInvoiceForm({ invoice, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = React.useState({
    vendor_name: invoice?.vendor_name || "",
    invoice_number: invoice?.invoice_number || "",
    invoice_date: invoice?.invoice_date || "",
    total_amount: invoice?.total_amount || 0,
    status: invoice?.status || "pending_review",
    location: invoice?.location || "",
    notes: invoice?.notes || ""
  });

  React.useEffect(() => {
    if (invoice) {
      setFormData({
        vendor_name: invoice.vendor_name || "",
        invoice_number: invoice.invoice_number || "",
        invoice_date: invoice.invoice_date || "",
        total_amount: invoice.total_amount || 0,
        status: invoice.status || "pending_review",
        location: invoice.location || "",
        notes: invoice.notes || ""
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
                onClick={() => setIsNextAction(true)}
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