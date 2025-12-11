import React, { useState } from "react";
import { Folder, ArrowLeft, ChevronRight, Plus, FolderPlus, Loader2, MoreVertical, Pencil, Trash2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import VendorInvoicesView from "../components/documentManagement/VendorInvoicesView";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";

export default function DocumentManagement() {
  const [currentSection, setCurrentSection] = useState(null); // 'vendor_invoices' or folderId
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newFolder, setNewFolder] = useState({ name: "", description: "" });
  
  const [editingFolder, setEditingFolder] = useState(null); // Object of folder being edited
  const [deleteConfirm, setDeleteConfirm] = useState(null); // ID of folder to delete

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

  const updateFolderMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DocumentFolder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      setEditingFolder(null);
      toast({ title: "Folder Updated", description: "Folder details updated successfully." });
    }
  });

  const deleteFolderMutation = useMutation({
    mutationFn: (id) => base44.entities.DocumentFolder.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-folders'] });
      setDeleteConfirm(null);
      if (currentSection === deleteConfirm) setCurrentSection(null);
      toast({ title: "Folder Deleted", description: "Folder removed successfully." });
    }
  });

  const getColorClasses = (color) => {
    const colors = {
      blue: { text: "text-blue-600", bg: "bg-blue-100" },
      red: { text: "text-red-600", bg: "bg-red-100" },
      green: { text: "text-green-600", bg: "bg-green-100" },
      yellow: { text: "text-yellow-600", bg: "bg-yellow-100" },
      purple: { text: "text-purple-600", bg: "bg-purple-100" },
      indigo: { text: "text-indigo-600", bg: "bg-indigo-100" },
      pink: { text: "text-pink-600", bg: "bg-pink-100" },
      default: { text: "text-amber-600", bg: "bg-amber-100" }
    };
    return colors[color] || colors.default;
  };

  const allFolders = customFolders.filter(f => f.name.toLowerCase() !== "documentation" && f.name.toLowerCase() !== "system documents").map(f => {
    const colors = getColorClasses(f.color);
    return {
      id: f.id,
      name: f.name,
      description: f.description || "",
      icon: Folder,
      color: colors.text,
      bgColor: colors.bg,
      isSystem: false
    };
  });

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
          folderId={activeFolder?.id} 
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
            <h1 className="text-3xl font-bold text-slate-900">Documentation Database</h1>
            <p className="text-slate-600 mt-2">Central repository for all organization documents and invoices.</p>
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
                  <p className="text-sm text-slate-500 line-clamp-2">
                    {folder.description}
                  </p>
                </div>
                {!folder.isSystem && (
                  <div className="ml-auto -mr-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-slate-400 hover:text-slate-600"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => setEditingFolder(folder)}>
                          <Pencil className="w-4 h-4 mr-2" /> Edit Details
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="text-red-600 focus:text-red-600"
                          onClick={() => setDeleteConfirm(folder.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Delete Folder
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
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

        <Dialog open={!!editingFolder} onOpenChange={(open) => !open && setEditingFolder(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Folder</DialogTitle>
            </DialogHeader>
            {editingFolder && (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Folder Name</Label>
                  <Input 
                    value={editingFolder.name}
                    onChange={(e) => setEditingFolder({...editingFolder, name: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea 
                    value={editingFolder.description || ""}
                    onChange={(e) => setEditingFolder({...editingFolder, description: e.target.value})}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingFolder(null)}>Cancel</Button>
              <Button 
                onClick={() => updateFolderMutation.mutate({ id: editingFolder.id, data: { name: editingFolder.name, description: editingFolder.description } })}
                disabled={!editingFolder?.name || updateFolderMutation.isPending}
              >
                {updateFolderMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Folder</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this folder? This action cannot be undone. 
                Invoices inside this folder will not be deleted, but they will be unassigned.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteFolderMutation.mutate(deleteConfirm)}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete Folder
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}