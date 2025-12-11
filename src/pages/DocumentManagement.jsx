import React, { useState } from "react";
import { Folder, ArrowLeft, ChevronRight, Plus, FolderPlus, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import VendorInvoicesView from "../components/documentManagement/VendorInvoicesView";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";

export default function DocumentManagement() {
  const [currentSection, setCurrentSection] = useState(null); // 'vendor_invoices' or folderId
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newFolder, setNewFolder] = useState({ name: "", description: "" });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: customFolders = [] } = useQuery({
    queryKey: ['document-folders'],
    queryFn: () => base44.entities.DocumentFolder.list()
  });

  const createFolderMutation = useMutation({
    mutationFn: (data) => base44.entities.DocumentFolder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      setIsCreateOpen(false);
      setNewFolder({ name: "", description: "" });
      toast({ title: "Folder Created", description: "New folder added successfully." });
    }
  });

  // System folders
  const systemFolders = [
    {
      id: "vendor_invoices",
      name: "All Vendor Invoices",
      description: "Master list of all invoices from all sources.",
      icon: Folder,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      isSystem: true
    },
  ];

  const allFolders = [
    ...systemFolders,
    ...customFolders.map(f => ({
      id: f.id,
      name: f.name,
      description: f.description || "Custom folder",
      icon: Folder,
      color: "text-amber-600",
      bgColor: "bg-amber-100",
      isSystem: false
    }))
  ];

  const activeFolder = allFolders.find(f => f.id === currentSection);

  if (currentSection) {
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
           <span className="font-medium text-slate-900">{activeFolder?.name || "Folder"}</span>
        </div>
        <VendorInvoicesView 
          folderId={activeFolder?.isSystem ? null : activeFolder?.id} 
          folderName={activeFolder?.name}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Document Management</h1>
            <p className="text-slate-600 mt-2">Central repository for all organization documents.</p>
          </div>
          <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
            <FolderPlus className="w-4 h-4" />
            New Folder
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {allFolders.map((folder) => (
            <Card 
              key={folder.id} 
              className={`hover:shadow-lg transition-all cursor-pointer border-slate-200 group relative`}
              onClick={() => setCurrentSection(folder.id)}
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Folder</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Folder Name</Label>
                <Input 
                  value={newFolder.name}
                  onChange={(e) => setNewFolder({...newFolder, name: e.target.value})}
                  placeholder="e.g. Staples Invoices"
                />
              </div>
              <div className="space-y-2">
                <Label>Description (Optional)</Label>
                <Textarea 
                  value={newFolder.description}
                  onChange={(e) => setNewFolder({...newFolder, description: e.target.value})}
                  placeholder="What's in this folder?"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
              <Button 
                onClick={() => createFolderMutation.mutate(newFolder)}
                disabled={!newFolder.name || createFolderMutation.isPending}
              >
                {createFolderMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Folder
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}