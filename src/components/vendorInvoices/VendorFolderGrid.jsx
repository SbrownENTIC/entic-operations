import React from 'react';
import { Folder } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";

export default function VendorFolderGrid({ invoices, onSelectVendor }) {
  // Group by vendor
  const vendorGroups = invoices.reduce((acc, inv) => {
    const name = inv.vendor_name || 'Unknown Vendor';
    if (!acc[name]) acc[name] = [];
    acc[name].push(inv);
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