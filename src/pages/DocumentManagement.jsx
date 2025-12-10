import React, { useState } from "react";
import { Folder, ArrowLeft, ChevronRight, FileText, Briefcase, FileSearch } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import VendorInvoicesView from "../components/documentManagement/VendorInvoicesView";
import { createPageUrl } from "@/utils";
import { useNavigate } from "react-router-dom";

export default function DocumentManagement() {
  const [currentSection, setCurrentSection] = useState(null);
  const navigate = useNavigate();

  // Folders definition
  const folders = [
    {
      id: "vendor_invoices",
      name: "Vendor Invoices",
      description: "Manage invoices from Henry Schein, McKesson, etc.",
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },

  ];

  if (currentSection === "vendor_invoices") {
    return (
      <div className="h-full flex flex-col">
        <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-2 sticky top-16 z-10">
           <Button 
             variant="ghost" 
             size="sm"
             onClick={() => setCurrentSection(null)}
             className="text-slate-500 hover:text-slate-800"
           >
             <ArrowLeft className="w-4 h-4 mr-1" />
             Documents
           </Button>
           <ChevronRight className="w-4 h-4 text-slate-300" />
           <span className="font-medium text-slate-900">Vendor Invoices</span>
        </div>
        <VendorInvoicesView />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Document Management</h1>
          <p className="text-slate-600 mt-2">Central repository for all organization documents.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {folders.map((folder) => (
            <Card 
              key={folder.id} 
              className={`hover:shadow-lg transition-all cursor-pointer border-slate-200 group ${folder.isPlaceholder ? 'opacity-80' : ''}`}
              onClick={() => {
                  if (folder.isPlaceholder) {
                      // Maybe show a toast that it's coming soon, but for now just do nothing or set section
                      // setCurrentSection(folder.id); 
                  } else {
                      setCurrentSection(folder.id);
                  }
              }}
            >
              <CardContent className="p-6 flex items-start gap-4">
                <div className={`p-3 rounded-xl ${folder.bgColor} ${folder.color} group-hover:scale-110 transition-transform`}>
                  <folder.icon className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900 mb-1 group-hover:text-blue-600 transition-colors">
                    {folder.name}
                  </h3>
                  <p className="text-sm text-slate-500">
                    {folder.description}
                  </p>
                  {folder.isPlaceholder && (
                      <span className="inline-block mt-2 text-xs font-medium bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                          Coming Soon
                      </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}