import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Trash2, Plus, Edit2, AlertCircle, Upload, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

export default function ExtensionMappingTable() {
  const [search, setSearch] = useState('');
  const [editingExt, setEditingExt] = useState(null);
  const [formData, setFormData] = useState(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ['user-directory'],
    queryFn: () => base44.entities.UserDirectory.list(),
  });

  // Extract extensions from UserDirectory extension column
  const extensions = useMemo(() => {
    return users
      .filter(u => u.extension && u.extension.trim())
      .map(u => ({
        id: u.id,
        extension: u.extension,
        user_id: u.id,
      }));
  }, [users]);

  const activeUsers = useMemo(
    () => users.filter((u) => u.active !== false),
    [users]
  );

  const userMap = useMemo(() => {
    const map = {};
    users.forEach((u) => {
      map[u.id] = u;
    });
    return map;
  }, [users]);

  const filtered = useMemo(() => {
    return extensions.filter((e) =>
      e.extension.includes(search) ||
      (userMap[e.user_id]?.name || '').toLowerCase().includes(search.toLowerCase())
    );
  }, [extensions, search, userMap]);

  const handleNew = () => {
    setFormData({
      extension: '',
      user_id: '',
    });
    setEditingExt(null);
  };

  const handleEdit = (ext) => {
    setFormData({ ...ext });
    setEditingExt(ext.id);
  };

  const handleSave = async () => {
    if (!formData.extension.trim()) {
      alert('Extension is required');
      return;
    }
    if (!formData.user_id) {
      alert('User is required');
      return;
    }

    try {
      await base44.entities.UserDirectory.update(editingExt, { extension: formData.extension });
      queryClient.invalidateQueries({ queryKey: ['user-directory'] });
      setFormData(null);
      setEditingExt(null);
    } catch (error) {
      alert(`Save failed: ${error.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this extension?')) return;
    try {
      await base44.entities.UserDirectory.update(id, { extension: '' });
      queryClient.invalidateQueries({ queryKey: ['user-directory'] });
    } catch (error) {
      alert(`Delete failed: ${error.message}`);
    }
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportLoading(true);
    setImportResult(null);

    try {
      const fileType = file.name.endsWith('.xlsx') ? 'xlsx' : 'csv';
      const reader = new FileReader();

      reader.onload = async (event) => {
        try {
          const fileContent = event.target?.result?.split(',')[1] || event.target?.result;
          const response = await base44.functions.invoke('importUserDirectory', {
            fileContent,
            fileType,
          });

          setImportResult({
            success: response.data.success,
            users_created: response.data.users_created || 0,
            users_updated: response.data.users_updated || 0,
            extensions_created: response.data.extensions_created || 0,
            extensions_updated: response.data.extensions_updated || 0,
            skipped: response.data.skipped || 0,
            errors: response.data.errors,
          });

          if (response.data.success) {
            queryClient.invalidateQueries({ queryKey: ['user-directory'] });
          }
        } catch (error) {
          setImportResult({
            success: false,
            error: error.message || 'Import failed',
          });
        } finally {
          setImportLoading(false);
        }
      };

      reader.readAsDataURL(file);
    } catch (error) {
      setImportResult({
        success: false,
        error: error.message || 'File reading failed',
      });
      setImportLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
         <Input
           placeholder="Search by extension or user..."
           value={search}
           onChange={(e) => setSearch(e.target.value)}
           className="flex-1"
         />
         <Button onClick={handleNew} className="gap-2">
           <Plus className="w-4 h-4" />
           Add Extension
         </Button>
         <Button 
           onClick={() => setImportDialogOpen(true)} 
           variant="outline"
           className="gap-2"
         >
           <Upload className="w-4 h-4" />
           Import
         </Button>
       </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Extension</th>
              <th className="text-left px-4 py-3 font-semibold">Name</th>
              <th className="text-center px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ext, i) => {
              const user = userMap[ext.user_id];
              const userNotFound = ext.user_id && !user;
              return (
              <tr key={ext.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="px-4 py-3 font-mono">{ext.extension}</td>
                <td className="px-4 py-3 flex items-center gap-2">
                  {user?.name || 'Unknown'}
                  {userNotFound && (
                    <AlertCircle className="w-4 h-4 text-yellow-600" title="User not found in directory" />
                  )}
                </td>
                <td className="px-4 py-3 text-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(ext)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(ext.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Edit/Create Dialog */}
       <Dialog open={!!formData} onOpenChange={(open) => !open && setFormData(null)}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>
               {editingExt ? 'Edit Extension' : 'New Extension Mapping'}
             </DialogTitle>
           </DialogHeader>
           <div className="space-y-4">
             <div>
               <label className="text-sm font-medium">Extension *</label>
               <Input
                 value={formData?.extension || ''}
                 onChange={(e) =>
                   setFormData({ ...formData, extension: e.target.value })
                 }
                 placeholder="e.g., 2001"
               />
             </div>
             <div>
               <label className="text-sm font-medium">Assign to User *</label>
               <Select
                 value={formData?.user_id || ''}
                 onValueChange={(value) =>
                   setFormData({ ...formData, user_id: value })
                 }
               >
                 <SelectTrigger>
                   <SelectValue placeholder="Select user..." />
                 </SelectTrigger>
                 <SelectContent>
                   {activeUsers.map((user) => (
                     <SelectItem key={user.id} value={user.id}>
                       {user.name}
                     </SelectItem>
                   ))}
                 </SelectContent>
               </Select>
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setFormData(null)}>
               Cancel
             </Button>
             <Button onClick={handleSave}>Save</Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>

       {/* Import Dialog */}
       <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Import Extension Mapping</DialogTitle>
           </DialogHeader>
           <div className="space-y-4">
             {!importResult ? (
               <>
                 <p className="text-sm text-slate-600">
                   Upload a CSV or Excel file with user directory data (must include Name and Extensions columns).
                 </p>
                 <div className="border-2 border-dashed rounded-lg p-6 text-center">
                   <input
                     type="file"
                     accept=".csv,.xlsx"
                     onChange={handleImportFile}
                     disabled={importLoading}
                     className="hidden"
                     id="extension-import-input"
                   />
                   <label htmlFor="extension-import-input" className="cursor-pointer">
                     <Button
                       variant="outline"
                       disabled={importLoading}
                       className="gap-2"
                       asChild
                     >
                       <span>
                         {importLoading ? (
                           <>
                             <Loader2 className="w-4 h-4 animate-spin" />
                             Importing...
                           </>
                         ) : (
                           <>
                             <Upload className="w-4 h-4" />
                             Choose File
                           </>
                         )}
                       </span>
                     </Button>
                   </label>
                 </div>
               </>
             ) : (
               <div className="space-y-3">
                 {importResult.success ? (
                   <>
                     <div className="bg-green-50 border border-green-200 rounded p-3 text-sm">
                       <p className="font-medium text-green-900">Import Successful</p>
                       <p className="text-green-800 mt-1">
                         Users: {importResult.users_created} created, {importResult.users_updated} updated
                       </p>
                       <p className="text-green-800">
                         Extensions: {importResult.extensions_created} created, {importResult.extensions_updated} updated
                       </p>
                       {importResult.skipped > 0 && (
                         <p className="text-green-800">{importResult.skipped} rows skipped</p>
                       )}
                     </div>
                     {importResult.errors && importResult.errors.length > 0 && (
                       <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm max-h-48 overflow-y-auto">
                         <p className="font-medium text-yellow-900">Issues:</p>
                         {importResult.errors.map((err, i) => (
                           <p key={i} className="text-yellow-800 text-xs">{err}</p>
                         ))}
                       </div>
                     )}
                   </>
                 ) : (
                   <div className="bg-red-50 border border-red-200 rounded p-3 text-sm">
                     <p className="font-medium text-red-900">Import Failed</p>
                     <p className="text-red-800 mt-1">{importResult.error}</p>
                   </div>
                 )}
               </div>
             )}
           </div>
           <DialogFooter>
             {importResult && (
               <Button
                 onClick={() => {
                   setImportResult(null);
                   setImportDialogOpen(false);
                 }}
               >
                 Close
               </Button>
             )}
           </DialogFooter>
         </DialogContent>
       </Dialog>
      </div>
      );
      }