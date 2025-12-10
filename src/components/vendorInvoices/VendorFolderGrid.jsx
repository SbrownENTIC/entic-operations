import React from 'react';
import { Folder } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";

export default function VendorFolderGrid({ invoices, onSelectVendor }) {
  // Helper to normalize vendor names (Title Case)
  const normalizeName = (name) => {
    if (!name) return 'Unknown Vendor';
    return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  // Group by normalized vendor name
  const vendorGroups = invoices.reduce((acc, inv) => {
    const rawName = inv.vendor_name || 'Unknown Vendor';
    const normalizedName = normalizeName(rawName);
    
    if (!acc[normalizedName]) acc[normalizedName] = [];
    acc[normalizedName].push({ ...inv, _display_vendor: normalizedName }); // Store normalized name for display consistency
    return acc;
  }, {});

  const vendors = Object.keys(vendorGroups).sort();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {vendors.map(vendor => (
        <Card 
          key={vendor} 
          className="hover:shadow-lg transition-all cursor-pointer border-slate-200 bg-white group hover:-translate-y-1"
          onClick={() => onSelectVendor(vendor)}
        >
          <CardContent className="p-6 flex flex-col items-center text-center gap-4">
            <div className="p-4 bg-blue-50 rounded-full group-hover:bg-blue-100 transition-colors">
              <Folder className="w-10 h-10 text-blue-600 fill-blue-200/50" />
            </div>
            <div className="w-full">
              <h3 className="font-semibold text-slate-900 truncate w-full" title={vendor}>
                {vendor}
              </h3>
              <p className="text-sm text-slate-500 mt-1 font-medium">
                {vendorGroups[vendor].length} {vendorGroups[vendor].length === 1 ? 'invoice' : 'invoices'}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
      {vendors.length === 0 && (
        <div className="col-span-full text-center py-12 text-slate-500">
          No invoices found.
        </div>
      )}
    </div>
  );
}