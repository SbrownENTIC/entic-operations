import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function SplitOrderModal({ order, isOpen, onClose, onSplit, isLoading }) {
  const [targetLocation, setTargetLocation] = useState("");
  const [selectedItemIndices, setSelectedItemIndices] = useState([]);
  const [splitQuantities, setSplitQuantities] = useState({});
  
  useEffect(() => {
    if (isOpen) {
      setTargetLocation("");
      setSelectedItemIndices([]);
      setSplitQuantities({});
    }
  }, [isOpen, order]);

  if (!order) return null;

  const locations = ['Glastonbury', 'Manchester', 'Bloomfield', 'Farmington', 'Waterside'].filter(
    loc => loc !== order.location
  );

  const handleToggleItem = (index) => {
    setSelectedItemIndices(prev => {
      if (prev.includes(index)) {
        const newQuantities = { ...splitQuantities };
        delete newQuantities[index];
        setSplitQuantities(newQuantities);
        return prev.filter(i => i !== index);
      } else {
        setSplitQuantities(prevQ => ({
          ...prevQ,
          [index]: order.items[index].quantity || 0
        }));
        return [...prev, index];
      }
    });
  };

  const handleQuantityChange = (index, value) => {
    const maxQty = order.items[index].quantity || 0;
    let newQty = parseFloat(value);
    
    if (isNaN(newQty)) newQty = 0;
    if (newQty < 0) newQty = 0;
    if (newQty > maxQty) newQty = maxQty;
    
    setSplitQuantities(prev => ({
      ...prev,
      [index]: newQty
    }));
  };

  const handleSplit = () => {
    if (!targetLocation || selectedItemIndices.length === 0) return;
    
    // Prepare items with their split quantities
    const itemsToSplit = selectedItemIndices.map(index => ({
      index,
      quantity: splitQuantities[index] || 0
    })).filter(item => item.quantity > 0);

    if (itemsToSplit.length === 0) return;

    onSplit(order, itemsToSplit, targetLocation);
  };

  const selectedSubtotal = selectedItemIndices.reduce((sum, index) => {
    const item = order.items[index];
    const qty = splitQuantities[index] || 0;
    return sum + (qty * (item.unit_price || 0));
  }, 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Split Order to Different Location</DialogTitle>
          <DialogDescription>
            Select items to move to a new order. A new order will be created for the selected location.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label>Target Location</Label>
            <Select value={targetLocation} onValueChange={setTargetLocation}>
              <SelectTrigger>
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label>Select Items to Move</Label>
              <span className="text-sm text-slate-500">
                {selectedItemIndices.length} items selected (${selectedSubtotal.toFixed(2)})
              </span>
            </div>
            <div className="border rounded-md">
              <div className="grid grid-cols-12 gap-2 p-3 bg-slate-50 border-b text-sm font-medium text-slate-700">
                <div className="col-span-1"></div>
                <div className="col-span-6">Product</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-3 text-right">Total</div>
              </div>
              <ScrollArea className="h-[200px]">
                {order.items.map((item, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 p-3 border-b last:border-0 items-center hover:bg-slate-50">
                    <div className="col-span-1 flex justify-center">
                      <Checkbox 
                        checked={selectedItemIndices.includes(index)}
                        onCheckedChange={() => handleToggleItem(index)}
                      />
                    </div>
                    <div className="col-span-6 text-sm">
                      <div className="font-medium">{item.supply_name}</div>
                      {item.item_number && <div className="text-xs text-slate-500">#{item.item_number}</div>}
                    </div>
                    <div className="col-span-2 text-sm text-right flex items-center justify-end gap-1">
                      {selectedItemIndices.includes(index) ? (
                        <div className="flex items-center gap-1">
                          <Input 
                            type="number" 
                            className="h-7 w-16 text-right px-1 py-0"
                            value={splitQuantities[index] || ''}
                            onChange={(e) => handleQuantityChange(index, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                          />
                          <span className="text-xs text-slate-400">/ {item.quantity}</span>
                        </div>
                      ) : (
                        <span>{item.quantity}</span>
                      )}
                    </div>
                    <div className="col-span-3 text-sm text-right font-medium">
                      ${((splitQuantities[index] || (selectedItemIndices.includes(index) ? 0 : item.quantity)) * (item.unit_price || 0)).toFixed(2)}
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </div>
          </div>

          {targetLocation && (
             <div className="bg-blue-50 p-3 rounded-md text-sm text-blue-800 border border-blue-100">
               New order will be created: <strong>#{order.order_number} - {targetLocation}</strong>
             </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button 
            onClick={handleSplit} 
            disabled={!targetLocation || selectedItemIndices.length === 0 || isLoading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isLoading ? "Splitting..." : "Split Order"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}