import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, PackagePlus, Calculator, DollarSign, Split } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

export default function InvoiceAllocator({ invoice, onOrderCreated }) {
    const [selectedIndices, setSelectedIndices] = useState(new Set());
    const [targetLocation, setTargetLocation] = useState("");
    const [taxAmount, setTaxAmount] = useState("0.00");
    const [notes, setNotes] = useState("");
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const lineItems = invoice.extracted_data?.line_items || [];

    const handleToggleItem = (index) => {
        const newSelected = new Set(selectedIndices);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedIndices(newSelected);
    };

    const handleSelectAll = (checked) => {
        if (checked) {
            const all = new Set(lineItems.map((_, i) => i));
            setSelectedIndices(all);
        } else {
            setSelectedIndices(new Set());
        }
    };

    // Calculate totals for selected items
    const selectedItems = lineItems.filter((_, i) => selectedIndices.has(i));
    const subtotal = selectedItems.reduce((sum, item) => sum + (item.total_price || 0), 0);
    const tax = parseFloat(taxAmount) || 0;
    const total = subtotal + tax;

    const createOrderMutation = useMutation({
        mutationFn: async () => {
            if (!targetLocation) throw new Error("Please select a target location.");
            if (selectedItems.length === 0) throw new Error("Please select at least one item.");

            // 1. Prepare items for SupplyOrder
            const orderItems = selectedItems.map(item => ({
                supply_name: item.description || "Unknown Item",
                item_number: item.item_code || "",
                quantity: item.quantity || 1,
                unit_price: item.unit_price || 0,
                line_total: item.total_price || 0,
                received: true // Assuming invoice means received
            }));

            // 2. Create the SupplyOrder
            const orderNumber = `${invoice.invoice_number}-${targetLocation.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
            
            const supplyOrderData = {
                order_number: orderNumber,
                vendor: invoice.vendor_name,
                location: targetLocation,
                order_date: invoice.invoice_date || new Date().toISOString().split('T')[0],
                status: 'received',
                category: 'clinical',
                order_type: invoice.invoice_type === 'credit_memo' ? 'return' : 'order',
                items: orderItems,
                subtotal: subtotal,
                tax: tax,
                total_amount: total,
                notes: `Allocated from Invoice #${invoice.invoice_number}. ${notes}`
            };

            const createdOrder = await base44.entities.SupplyOrder.create(supplyOrderData);

            // 3. Link to VendorInvoice
            // We need to fetch current invoice to get latest linked IDs to be safe, but we can just append
            // Actually, we should probably check if the prop is stale, but appending is usually safer if we use the prop
            // However, concurrent edits could be an issue. 
            // The safest way with the SDK is to update.
            const currentLinkedIds = invoice.linked_supply_order_ids || [];
            if (!currentLinkedIds.includes(createdOrder.id)) {
                await base44.entities.VendorInvoice.update(invoice.id, {
                    linked_supply_order_ids: [...currentLinkedIds, createdOrder.id]
                });
            }

            return createdOrder;
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['vendor-invoices'] });
            queryClient.invalidateQueries({ queryKey: ['linked-orders'] }); // Refresh the linked orders list in the other tab
            toast({
                title: "Order Created",
                description: `Created order ${data.order_number} for ${targetLocation} with ${selectedItems.length} items.`,
            });
            // Reset form
            setSelectedIndices(new Set());
            setTaxAmount("0.00");
            setNotes("");
            
            if (onOrderCreated) onOrderCreated(data);
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        }
    });

    if (lineItems.length === 0) {
        return (
            <div className="p-8 text-center text-slate-500 border rounded-lg border-dashed">
                No line items found in the extracted data for this invoice. 
                <br/>You may need to split/process the invoice again or manually create orders.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-6">
                {/* Left Column: Item Selection */}
                <div className="flex-1 space-y-4">
                    <Card>
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex justify-between items-center">
                                <span>Select Items to Allocate</span>
                                <Badge variant="outline">{selectedIndices.size} selected</Badge>
                            </CardTitle>
                            <CardDescription>
                                Choose the line items that belong to a specific location.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0 max-h-[400px] overflow-auto">
                            <Table>
                                <TableHeader className="bg-slate-50 sticky top-0">
                                    <TableRow>
                                        <TableHead className="w-[50px]">
                                            <Checkbox 
                                                checked={lineItems.length > 0 && selectedIndices.size === lineItems.length}
                                                onCheckedChange={handleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {lineItems.map((item, index) => (
                                        <TableRow 
                                            key={index} 
                                            className={selectedIndices.has(index) ? "bg-blue-50/50" : ""}
                                            onClick={() => handleToggleItem(index)}
                                        >
                                            <TableCell className="py-2" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox 
                                                    checked={selectedIndices.has(index)}
                                                    onCheckedChange={() => handleToggleItem(index)}
                                                />
                                            </TableCell>
                                            <TableCell className="py-2 text-xs">
                                                <div className="font-medium truncate max-w-[200px]" title={item.description}>
                                                    {item.description || "Item " + (index + 1)}
                                                </div>
                                                <div className="text-slate-500 flex gap-2 mt-0.5">
                                                    <span>{item.item_code}</span>
                                                    <span>Qty: {item.quantity}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-2 text-right font-medium text-xs">
                                                ${item.total_price?.toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Allocation Details */}
                <div className="md:w-1/3 space-y-4">
                    <Card className="bg-slate-50 border-slate-200">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Split className="w-4 h-4" /> Allocation Details
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Target Location</Label>
                                <Select value={targetLocation} onValueChange={setTargetLocation}>
                                    <SelectTrigger className="bg-white">
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
                                <Label>Tax Allocation</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-2 top-2.5 h-4 w-4 text-slate-500" />
                                    <Input 
                                        type="number" 
                                        step="0.01"
                                        min="0"
                                        value={taxAmount}
                                        onChange={(e) => setTaxAmount(e.target.value)}
                                        className="pl-8 bg-white"
                                        placeholder="0.00"
                                    />
                                </div>
                                <p className="text-xs text-slate-500">
                                    Enter the specific tax amount for these items/location.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label>Notes (Optional)</Label>
                                <Input 
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="e.g. Partial order"
                                    className="bg-white"
                                />
                            </div>

                            <div className="pt-4 border-t border-slate-200 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Subtotal ({selectedIndices.size} items):</span>
                                    <span>${subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Allocated Tax:</span>
                                    <span>${tax.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-lg pt-2">
                                    <span>Total:</span>
                                    <span>${total.toFixed(2)}</span>
                                </div>
                            </div>

                            <Button 
                                className="w-full mt-4" 
                                onClick={() => createOrderMutation.mutate()}
                                disabled={createOrderMutation.isPending || selectedIndices.size === 0 || !targetLocation}
                            >
                                {createOrderMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                    <PackagePlus className="w-4 h-4 mr-2" />
                                )}
                                Create Supply Order
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}