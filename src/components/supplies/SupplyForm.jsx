import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SupplyForm({ supply, supplies, onSubmit, onCancel, isLoading }) {
  const [formData, setFormData] = useState({
    item_number: '',
    product_name: '',
    vendor: '',
    unit_price: '',
    units: ''
  });

  useEffect(() => {
    if (supply) {
      setFormData({
        item_number: supply.item_number || '',
        product_name: supply.product_name || '',
        vendor: supply.vendor || '',
        unit_price: supply.unit_price || '',
        units: supply.units || ''
      });
    }
  }, [supply]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const submitData = {
      ...formData,
      unit_price: parseFloat(formData.unit_price) || 0
    };
    
    onSubmit(submitData);
  };

  // Get unique vendors from existing supplies
  const existingVendors = [...new Set(supplies?.map(s => s.vendor).filter(Boolean))];
  const commonVendors = ['Staples', 'Amazon Business', 'Office Depot', 'Cardinal Health', 'McKesson', 'Henry Schein'];
  const allVendors = [...new Set([...commonVendors, ...existingVendors])].sort();

  return (
    <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
      <CardHeader className="border-b border-slate-100">
        <CardTitle>{supply ? 'Edit Supply Item' : 'Add Supply Item'}</CardTitle>
      </CardHeader>
      <CardContent className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="item_number">Item Number</Label>
              <Input
                id="item_number"
                value={formData.item_number}
                onChange={(e) => setFormData({ ...formData, item_number: e.target.value })}
                placeholder="e.g., SKU-12345"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="product_name">Product Name *</Label>
              <Input
                id="product_name"
                value={formData.product_name}
                onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                placeholder="e.g., Copy Paper"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="vendor">Vendor</Label>
              <Input
                id="vendor"
                list="vendors"
                value={formData.vendor}
                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                placeholder="Select or type vendor name"
              />
              <datalist id="vendors">
                {allVendors.map((vendor) => (
                  <option key={vendor} value={vendor} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit_price">Unit Price *</Label>
              <Input
                id="unit_price"
                type="number"
                step="0.01"
                value={formData.unit_price}
                onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="units">Units</Label>
              <Input
                id="units"
                value={formData.units}
                onChange={(e) => setFormData({ ...formData, units: e.target.value })}
                placeholder="e.g., box, each, case"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="bg-blue-600 hover:bg-blue-700">
              {isLoading ? 'Saving...' : supply ? 'Update Supply' : 'Add Supply'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}