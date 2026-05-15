import React, { useState, useMemo, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Trash2, Plus, Edit2, Upload, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

export default function UserDirectoryTable() {
   const [search, setSearch] = useState('');
   const [editingUser, setEditingUser] = useState(null);
   const [formData, setFormData] = useState(null);
   const [importing, setImporting] = useState(false);
   const [importMessage, setImportMessage] = useState(null);
   const [sortColumn, setSortColumn] = useState('name');
   const [sortDirection, setSortDirection] = useState('asc');
   const [selectedUsers, setSelectedUsers] = useState([]);
   const [bulkEditDailyGoal, setBulkEditDailyGoal] = useState('');
   const [showBulkEdit, setShowBulkEdit] = useState(false);
   const fileInputRef = useRef(null);
   const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['user-directory'],
    queryFn: () => base44.entities.UserDirectory.list(),
  });

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const filtered = useMemo(() => {
    let results = users.filter(u =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      (u.role && u.role.toLowerCase().includes(search.toLowerCase()))
    );

    results.sort((a, b) => {
      let aVal, bVal;
      
      switch(sortColumn) {
        case 'name':
          aVal = (a.name || '').toLowerCase();
          bVal = (b.name || '').toLowerCase();
          break;
        case 'role':
          aVal = (a.role || '').toLowerCase();
          bVal = (b.role || '').toLowerCase();
          break;
        case 'extensions':
          aVal = a.extensions?.length || 0;
          bVal = b.extensions?.length || 0;
          break;
        case 'location':
          aVal = (a.location || '').toLowerCase();
          bVal = (b.location || '').toLowerCase();
          break;
        case 'benchmark_group':
          aVal = (a.benchmark_group || 'Other').toLowerCase();
          bVal = (b.benchmark_group || 'Other').toLowerCase();
          break;
        case 'expected_answer_rate':
          aVal = a.expected_answer_rate || 0;
          bVal = b.expected_answer_rate || 0;
          break;
        case 'daily_goal':
          aVal = a.daily_goal || 0;
          bVal = b.daily_goal || 0;
          break;
        case 'include_in_benchmark':
          aVal = a.include_in_benchmark ? 1 : 0;
          bVal = b.include_in_benchmark ? 1 : 0;
          break;
        case 'active':
          aVal = a.active !== false ? 1 : 0;
          bVal = b.active !== false ? 1 : 0;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return results;
  }, [users, search, sortColumn, sortDirection]);

  const getDefaultAnswerRate = (role) => {
    if (role === 'Call Center') return 0.85;
    if (role === 'Client Facing') return 0.65;
    return 0.8;
  };

  const handleNew = () => {
    setFormData({
      name: '',
      role: '',
      benchmark_group: 'Other',
      include_in_benchmark: false,
      expected_answer_rate: 0.8,
      active: true,
      extensions: [],
    });
    setEditingUser(null);
  };

  const handleEdit = (user) => {
    setFormData({ ...user });
    setEditingUser(user.id);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      alert('Name is required');
      return;
    }

    try {
      if (editingUser) {
        await base44.entities.UserDirectory.update(editingUser, formData);
      } else {
        await base44.entities.UserDirectory.create(formData);
      }
      queryClient.invalidateQueries({ queryKey: ['user-directory'] });
      setFormData(null);
      setEditingUser(null);
    } catch (error) {
      alert(`Save failed: ${error.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this user?')) return;
    try {
      await base44.entities.UserDirectory.delete(id);
      queryClient.invalidateQueries({ queryKey: ['user-directory'] });
    } catch (error) {
      alert(`Delete failed: ${error.message}`);
    }
  };

  const handleToggleActive = async (user) => {
    try {
      await base44.entities.UserDirectory.update(user.id, {
        active: !user.active,
      });
      queryClient.invalidateQueries({ queryKey: ['user-directory'] });
    } catch (error) {
      alert(`Update failed: ${error.message}`);
    }
  };

  const handleToggleBenchmark = async (user) => {
    try {
      await base44.entities.UserDirectory.update(user.id, {
        include_in_benchmark: !user.include_in_benchmark,
      });
      queryClient.invalidateQueries({ queryKey: ['user-directory'] });
    } catch (error) {
      alert(`Update failed: ${error.message}`);
    }
  };

  const handleToggleUserSelection = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === filtered.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filtered.map(u => u.id));
    }
  };

  const handleBulkUpdateDailyGoal = async () => {
    if (bulkEditDailyGoal === '' || selectedUsers.length === 0) {
      alert('Please select users and enter a daily goal');
      return;
    }

    const goalValue = parseFloat(bulkEditDailyGoal);
    if (isNaN(goalValue)) {
      alert('Daily goal must be a number');
      return;
    }

    try {
      let updateIdx = 0;
      while (updateIdx < selectedUsers.length) {
        const userId = selectedUsers[updateIdx];
        await base44.entities.UserDirectory.update(userId, {
          daily_goal: goalValue
        });
        updateIdx++;
      }
      queryClient.invalidateQueries({ queryKey: ['user-directory'] });
      setSelectedUsers([]);
      setBulkEditDailyGoal('');
      setShowBulkEdit(false);
      alert(`Updated daily goal for ${selectedUsers.length} user(s)`);
    } catch (error) {
      alert(`Bulk update failed: ${error.message}`);
    }
  };

  const handleImport = async (file) => {
    if (!file) return;

    // Validate file type
    const isCSV = file.name.endsWith('.csv');
    const isXLSX = file.name.endsWith('.xlsx');

    if (!isCSV && !isXLSX) {
      setImportMessage({
        type: 'error',
        text: 'Only .csv and .xlsx files are supported'
      });
      return;
    }

    setImporting(true);
    setImportMessage(null);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const fileContent = e.target.result.split(',')[1]; // Get base64 part
          const fileType = isCSV ? 'csv' : 'xlsx';
          
          const response = await base44.functions.invoke('importUserDirectory', {
            fileContent,
            fileType
          });

          setImportMessage({
            type: 'success',
            text: `User Directory Imported: ${response.data.users_created} Created, ${response.data.users_updated} Updated, ${response.data.extensions_synced} with extensions`,
            details: response.data.errors
          });

          // Refresh all queries
          queryClient.invalidateQueries({ queryKey: ['user-directory'] });
          queryClient.invalidateQueries({ queryKey: ['extensions'] });
          queryClient.invalidateQueries({ queryKey: ['inbound-calls'] });
          queryClient.invalidateQueries({ queryKey: ['outbound-calls'] });
        } catch (error) {
          setImportMessage({
            type: 'error',
            text: `Import failed: ${error.message}`
          });
        } finally {
          setImporting(false);
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        }
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setImportMessage({
        type: 'error',
        text: `File reading failed: ${error.message}`
      });
      setImporting(false);
    }
  };

  if (isLoading) return <div className="text-center py-4">Loading...</div>;

  return (
    <div className="space-y-4">
      {/* Import Message */}
      {importMessage && (
        <Alert variant={importMessage.type === 'error' ? 'destructive' : 'default'}>
          {importMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <CheckCircle className="w-4 h-4 text-green-600" />
          )}
          <AlertDescription>
            <div className="space-y-2">
              <div>{importMessage.text}</div>
              {importMessage.details && (
                <div className="text-xs space-y-1 mt-2">
                  {importMessage.details.map((err, i) => (
                    <div key={i} className="text-slate-600">{err}</div>
                  ))}
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex gap-3">
         <Input
           placeholder="Search by name or role..."
           value={search}
           onChange={(e) => setSearch(e.target.value)}
           className="flex-1"
         />
         <div>
           <input
             ref={fileInputRef}
             type="file"
             accept=".csv,.xlsx"
             className="hidden"
             onChange={(e) => handleImport(e.target.files?.[0])}
             disabled={importing}
           />
           <Button
             onClick={() => fileInputRef.current?.click()}
             disabled={importing}
             variant="outline"
             className="gap-2"
           >
             {importing ? (
               <Loader2 className="w-4 h-4 animate-spin" />
             ) : (
               <Upload className="w-4 h-4" />
             )}
             Import Directory
           </Button>
         </div>
         {selectedUsers.length > 0 && (
           <Button onClick={() => setShowBulkEdit(true)} variant="secondary" className="gap-2">
             Bulk Edit ({selectedUsers.length})
           </Button>
         )}
         <Button onClick={handleNew} className="gap-2">
           <Plus className="w-4 h-4" />
           Add User
         </Button>
       </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 border-b">
            <tr>
              <th className="text-center px-4 py-3 font-semibold">
                <Checkbox
                  checked={selectedUsers.length === filtered.length && filtered.length > 0}
                  onCheckedChange={handleSelectAll}
                />
              </th>
              <th 
                className="text-left px-4 py-3 font-semibold cursor-pointer hover:bg-slate-200"
                onClick={() => handleSort('name')}
              >
                Name {sortColumn === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="text-left px-4 py-3 font-semibold cursor-pointer hover:bg-slate-200"
                onClick={() => handleSort('role')}
              >
                Role {sortColumn === 'role' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="text-left px-4 py-3 font-semibold cursor-pointer hover:bg-slate-200"
                onClick={() => handleSort('extensions')}
              >
                Extensions {sortColumn === 'extensions' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="text-left px-4 py-3 font-semibold cursor-pointer hover:bg-slate-200"
                onClick={() => handleSort('location')}
              >
                Location {sortColumn === 'location' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="text-left px-4 py-3 font-semibold cursor-pointer hover:bg-slate-200"
                onClick={() => handleSort('benchmark_group')}
              >
                Benchmark Group {sortColumn === 'benchmark_group' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="text-center px-4 py-3 font-semibold cursor-pointer hover:bg-slate-200"
                onClick={() => handleSort('expected_answer_rate')}
              >
                Expected Answer Rate {sortColumn === 'expected_answer_rate' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="text-center px-4 py-3 font-semibold cursor-pointer hover:bg-slate-200"
                onClick={() => handleSort('daily_goal')}
              >
                Daily Goal {sortColumn === 'daily_goal' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="text-center px-4 py-3 font-semibold cursor-pointer hover:bg-slate-200"
                onClick={() => handleSort('include_in_benchmark')}
              >
                In Benchmark {sortColumn === 'include_in_benchmark' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="text-center px-4 py-3 font-semibold cursor-pointer hover:bg-slate-200"
                onClick={() => handleSort('active')}
              >
                Active {sortColumn === 'active' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th className="text-center px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user, i) => (
              <tr key={user.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="px-4 py-3 text-center">
                  <Checkbox
                    checked={selectedUsers.includes(user.id)}
                    onCheckedChange={() => handleToggleUserSelection(user.id)}
                  />
                </td>
                <td className="px-4 py-3">{user.name}</td>
                <td className="px-4 py-3 text-slate-600">{user.role || '-'}</td>
                <td className="px-4 py-3 text-slate-600 font-mono text-xs">
                  {user.extensions && user.extensions.length > 0 
                    ? user.extensions.join(', ')
                    : '-'}
                </td>
                <td className="px-4 py-3 text-slate-600">{user.location || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{user.benchmark_group || 'Other'}</td>
                <td className="px-4 py-3 text-center">
                  {user.include_in_benchmark ? `${Math.round((user.expected_answer_rate || 0.8) * 100)}%` : 'N/A'}
                </td>
                <td className="px-4 py-3 text-center">
                  {user.daily_goal || '-'}
                </td>
                <td className="px-4 py-3 text-center">
                  <Checkbox
                    checked={user.include_in_benchmark || false}
                    onCheckedChange={() => handleToggleBenchmark(user)}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  <Checkbox
                    checked={user.active !== false}
                    onCheckedChange={() => handleToggleActive(user)}
                  />
                </td>
                <td className="px-4 py-3 text-center space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(user)}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(user.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bulk Edit Dialog */}
       <Dialog open={showBulkEdit} onOpenChange={setShowBulkEdit}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>Bulk Update Daily Goal</DialogTitle>
           </DialogHeader>
           <div className="space-y-4">
             <div>
               <label className="text-sm font-medium">Selected Users: {selectedUsers.length}</label>
               <div className="mt-2 p-3 bg-slate-50 rounded text-sm text-slate-600 max-h-40 overflow-y-auto">
                 {filtered
                   .filter(u => selectedUsers.includes(u.id))
                   .map(u => <div key={u.id}>{u.name}</div>)}
               </div>
             </div>
             <div>
               <label className="text-sm font-medium">New Daily Goal</label>
               <Input
                 type="number"
                 min="0"
                 value={bulkEditDailyGoal}
                 onChange={(e) => setBulkEditDailyGoal(e.target.value)}
                 placeholder="Enter daily goal"
               />
             </div>
           </div>
           <DialogFooter>
             <Button variant="outline" onClick={() => setShowBulkEdit(false)}>
               Cancel
             </Button>
             <Button onClick={handleBulkUpdateDailyGoal}>Update {selectedUsers.length} User(s)</Button>
           </DialogFooter>
         </DialogContent>
       </Dialog>

       {/* Edit/Create Dialog */}
       <Dialog open={!!formData} onOpenChange={(open) => !open && setFormData(null)}>
         <DialogContent>
           <DialogHeader>
             <DialogTitle>{editingUser ? 'Edit User' : 'New User'}</DialogTitle>
           </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name *</label>
              <Input
                value={formData?.name || ''}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="User name"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Role</label>
              <Input
                value={formData?.role || ''}
                onChange={(e) => {
                  const newRole = e.target.value;
                  setFormData({ 
                    ...formData, 
                    role: newRole,
                    expected_answer_rate: getDefaultAnswerRate(newRole)
                  })
                }}
                placeholder="Job title"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Extensions</label>
              <Input
                value={(formData?.extensions || []).join(', ')}
                onChange={(e) => {
                  const exts = e.target.value
                    .split(',')
                    .map(ext => String(ext).trim())
                    .filter(ext => ext.length > 0);
                  setFormData({ ...formData, extensions: exts });
                }}
                placeholder="e.g., 101, 102, 103"
              />
              <p className="text-xs text-slate-500 mt-1">Comma-separated extension numbers</p>
            </div>
            <div>
              <label className="text-sm font-medium">Benchmark Group</label>
              <Select
                value={formData?.benchmark_group || 'Other'}
                onValueChange={(value) =>
                  setFormData({ ...formData, benchmark_group: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Front Desk">Front Desk</SelectItem>
                  <SelectItem value="NP Coordinator">NP Coordinator</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">Location</label>
              <Input
                value={formData?.location || ''}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                placeholder="Office location"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Expected Answer Rate (%)</label>
              {formData?.include_in_benchmark ? (
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round((formData?.expected_answer_rate || 0.8) * 100)}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      expected_answer_rate: parseInt(e.target.value) / 100,
                    })
                  }
                />
              ) : (
                <div className="p-2 bg-slate-100 rounded text-slate-600 text-sm">N/A - User not in benchmark</div>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Daily Goal</label>
              <Input
                type="number"
                min="0"
                value={formData?.daily_goal || ''}
                onChange={(e) =>
                  setFormData({ ...formData, daily_goal: e.target.value ? parseFloat(e.target.value) : null })
                }
                placeholder="Daily call goal"
              />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={formData?.include_in_benchmark || false}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, include_in_benchmark: checked })
                }
              />
              <label className="text-sm font-medium">Include in Benchmark</label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                checked={formData?.active !== false}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, active: checked })
                }
              />
              <label className="text-sm font-medium">Active</label>
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
    </div>
  );
}