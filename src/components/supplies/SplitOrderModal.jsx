import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, ArrowRightLeft } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function SplitOrderModal({ isOpen, onClose, order }) {
  const [selectedItems, setSelectedItems] = useState([]);
  const [targetLocation, setTargetLocation] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const locations = [
    "Glastonbury",
    "Manchester",
    "Bloomfield",
    "Farmington"
  ].filter(loc => loc !== order?.location);

  const toggleItem = (index) => {
    setSelectedItems(prev => 
      prev.includes(index) 
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };

  const splitMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('splitSupplyOrder', {
        order_id: order.id,
        item_indices: selectedItems,
        target_location: targetLocation
      });
      if (response.data.error) throw new Error(response.data.error);
      return response.data;
    },
    onSuccess: (data) => {
      toast({
        title: "Order Split Successful",
        description: `Created new order #${data.new_order_number} for ${targetLocation}`,
      });
      queryClient.invalidateQueries({ queryKey: ['supply-order'] });
      queryClient.invalidateQueries({ queryKey: ['supplies'] });
      onClose();
      // Optional: Redirect to new order? For now, just stay here and refresh.
    },
    onError: (error) => {
      toast({
        title: "Error Splitting Order",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  if (!order) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Move Items to Another Location</DialogTitle>
          <DialogDescription>
            Select items to move from <strong>{order.location}</strong> to a new location. 
            This will create a new order and invoice for the selected items.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>New Location</Label>
            <Select value={targetLocation} onValueChange={setTargetLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Select location..." />
              </SelectTrigger>
              <SelectContent>
                {locations.map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Select Items to Move</Label>
            <div className="border rounded-md divide-y max-h-[300px] overflow-y-auto">
              {order.items?.map((item, index) => (
                <div key={index} className="flex items-center p-3 hover:bg-slate-50">
                  <Checkbox 
                    id={`item-${index}`}
                    checked={selectedItems.includes(index)}
                    onCheckedChange={() => toggleItem(index)}
                    className="mr-3"
                  />
                  <div className="flex-1">
                    <label 
                      htmlFor={`item-${index}`} 
                      className="text-sm font-medium text-slate-900 cursor-pointer block"
                    >
                      {item.supply_name}
                    </label>
                    <div className="text-xs text-slate-500">
                      Qty: {item.quantity} × ${item.unit_price?.toFixed(2)} = ${(item.line_total || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs text-slate-500 text-right">
              {selectedItems.length} items selected
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={() => splitMutation.mutate()} 
            disabled={!targetLocation || selectedItems.length === 0 || selectedItems.length === order.items?.length || splitMutation.isPending}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {splitMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Moving Items...
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Move Items & Create New Invoice
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}