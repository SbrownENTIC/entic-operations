import React from "react";
import { base44 } from "@/api/base44Client";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, Send } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

function getDefaultInvoiceRecipients(invoice) {
  const facility = String(invoice?.program_group || invoice?.facility_name || "").toLowerCase();
  const defaultCc = "steve.brown@enticmd.com;heldridge@enticmd.com";

  if (facility.includes("uconn") || facility.includes("university of connecticut")) {
    return {
      matched: true,
      to: "amoffo@uchc.edu;jserrano@uchc.edu",
      cc: defaultCc
    };
  }

  if (facility.includes("hartford") || facility.includes("hhc")) {
    return {
      matched: true,
      to: "ap@hhchealth.org",
      cc: defaultCc
    };
  }

  if (facility.includes("manchester") || facility.includes("echn")) {
    return {
      matched: true,
      to: "ap@hhchealth.org",
      cc: defaultCc
    };
  }

  if (facility.includes("test program")) {
    return {
      matched: true,
      to: "steve.brown@enticmd.com",
      cc: "brownsteven89@gmail.com;brownsteven89@icloud.com"
    };
  }

  return { matched: false, to: "", cc: "" };
}

export default function InvoiceEmailQueueDialog({ invoice, open, onOpenChange, onQueued }) {
  const { toast } = useToast();
  const [formData, setFormData] = React.useState({
    send_date: new Date().toLocaleDateString("en-CA"),
    to: "",
    cc: "",
    bcc: ""
  });

  React.useEffect(() => {
    if (invoice && open) {
      const defaultRecipients = getDefaultInvoiceRecipients(invoice);
      setFormData({
        send_date: new Date().toLocaleDateString("en-CA"),
        to: defaultRecipients.to,
        cc: defaultRecipients.cc,
        bcc: ""
      });
    }
  }, [invoice, open]);

  const queueMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke("queueInvoiceEmail", {
        invoice_id: invoice.id,
        send_date: formData.send_date,
        to: formData.to,
        cc: formData.cc,
        bcc: formData.bcc
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data?.success === false) {
        throw new Error(data.error || "Unable to queue invoice email.");
      }
      toast({ title: "Queued", description: "Invoice email queued for Power Automate." });
      onQueued?.();
      onOpenChange(false);
    },
    onError: (error) => {
      const message = error?.response?.data?.error || error?.message || "Unable to queue invoice email.";
      toast({ variant: "destructive", title: "Invoice Email Not Queued", description: message });
    }
  });

  if (!invoice) return null;

  const missingAttachment = !invoice.approved_invoice_url;
  const defaultRecipients = getDefaultInvoiceRecipients(invoice);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Queue Invoice Email</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
            <div className="font-medium text-slate-900">{invoice.invoice_number || "Invoice"}</div>
            <div className="text-slate-600">{invoice.program_group || "Facility not set"} • {invoice.month || "Month not set"}</div>
          </div>

          {missingAttachment && (
            <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Cannot queue invoice email because no approved invoice attachment is attached to this invoice.</span>
            </div>
          )}

          <p className="text-xs text-slate-600">
            {defaultRecipients.matched
              ? "Recipients auto-filled based on facility. Please review before queueing."
              : "No default recipients found for this facility. Please enter recipients manually."}
          </p>

          <div className="space-y-2">
            <Label htmlFor="invoice-email-send-date">Send Date</Label>
            <Input
              id="invoice-email-send-date"
              type="date"
              value={formData.send_date}
              onChange={(e) => setFormData(prev => ({ ...prev, send_date: e.target.value }))}
              disabled={missingAttachment || queueMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-email-to">To *</Label>
            <Input
              id="invoice-email-to"
              placeholder="recipient@example.com; second@example.com"
              value={formData.to}
              onChange={(e) => setFormData(prev => ({ ...prev, to: e.target.value }))}
              disabled={missingAttachment || queueMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-email-cc">CC</Label>
            <Input
              id="invoice-email-cc"
              placeholder="cc@example.com; secondcc@example.com"
              value={formData.cc}
              onChange={(e) => setFormData(prev => ({ ...prev, cc: e.target.value }))}
              disabled={missingAttachment || queueMutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invoice-email-bcc">BCC</Label>
            <Input
              id="invoice-email-bcc"
              placeholder="bcc@example.com"
              value={formData.bcc}
              onChange={(e) => setFormData(prev => ({ ...prev, bcc: e.target.value }))}
              disabled={missingAttachment || queueMutation.isPending}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={queueMutation.isPending}>Cancel</Button>
            <Button
              onClick={() => queueMutation.mutate()}
              disabled={missingAttachment || queueMutation.isPending || !formData.to.trim()}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              <Send className="h-4 w-4" />
              {queueMutation.isPending ? "Queueing..." : "Queue Email"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}