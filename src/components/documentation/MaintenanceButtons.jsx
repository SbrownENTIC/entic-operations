import React from "react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { Shield, PackagePlus, RefreshCw } from "lucide-react";

export function SyncHenryScheinButton() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const handleSync = async () => {
    if (!confirm("Sync unlinked Henry Schein invoices to Clinical Supply Orders?")) return;
    
    setLoading(true);
    toast({ title: "Sync Started", description: "Finding unlinked invoices..." });
    
    try {
      const res = await base44.functions.invoke('syncHenryScheinToOrders');
      toast({ 
        title: "Sync Completed", 
        description: `Created ${res.data.processed} new supply orders.` 
      });
    } catch (err) {
      toast({ 
        title: "Error", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleSync} disabled={loading} className="h-7 text-xs gap-1 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">
      <PackagePlus className="w-3 h-3" />
      {loading ? "Syncing..." : "Sync Henry Schein Orders"}
    </Button>
  );
}

export function FixVendorDataButton() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const handleFix = async () => {
    if (!confirm("Update all existing vendor invoices to fix capitalization (e.g. HENRY -> Henry) and link missing locations?")) return;
    
    setLoading(true);
    toast({ title: "Fix Started", description: "Scanning invoices..." });
    
    try {
      const res = await base44.functions.invoke('fixVendorInvoiceData');
      toast({ 
        title: "Fix Completed", 
        description: res.data.message
      });
    } catch (err) {
      toast({ 
        title: "Error", 
        description: err.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="outline" onClick={handleFix} disabled={loading} className="h-7 text-xs gap-1 bg-green-50 text-green-700 border-green-200 hover:bg-green-100">
      <RefreshCw className="w-3 h-3" />
      {loading ? "Fixing..." : "Fix Vendor Data"}
    </Button>
  );
}

export function ForceRedactHenryButton() {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const queryClient = useQueryClient();

  const handleForce = async () => {
    if (!confirm("Force re-redact all Henry Schein invoices with the new Bottom 35% rule? This will overwrite current files.")) return;

    setLoading(true);
    toast({ title: "Redaction Started", description: "Processing Henry Schein invoices..." });

    try {
      const res = await base44.functions.invoke('forceRedactAll');
      
      // Force a hard refresh of the list data
      await queryClient.resetQueries({ queryKey: ['vendor-invoices'] });
      await queryClient.invalidateQueries({ queryKey: ['vendor-invoices'] });

      console.log("Force Redact Results:", res.data);
      const successCount = res.data.details.filter(d => d.status === 'processed').length;
      const failCount = res.data.details.filter(d => d.status === 'error').length;

      if (failCount > 0) {
        const firstError = res.data.details.find(d => d.status === 'error')?.error;
        toast({ 
          title: "Completed with Errors", 
          description: `Success: ${successCount}, Failed: ${failCount}. Error: ${firstError}`,
          variant: "destructive"
        });
      } else {
        toast({ 
          title: "Completed Successfully", 
          description: `Processed ${successCount} invoices. Refresh page to see changes.`
        });
      }
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={handleForce} disabled={loading} className="h-7 text-xs gap-1 bg-red-50 text-red-700 border-red-200 hover:bg-red-100">
        <Shield className="w-3 h-3" />
        {loading ? "Processing..." : "Force Redact All"}
      </Button>
    </div>
  );
}