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
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['user-directory'],
    queryFn: () => base44.entities.UserDirectory.list(),
  });

  const filtered = useMemo(() => {
    return users.filter(u =>
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      (u.role && u.role.toLowerCase().includes(search.toLowerCase()))
    );
  }, [users, search]);

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
        <Button onClick={handleNew} className="gap-2">
          <Plus className="w-4 h-4" />
          Add User
        </Button>
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Name</th>
              <th className="text-left px-4 py-3 font-semibold">Role</th>
              <th className="text-left px-4 py-3 font-semibold">Extensions</th>
              <th className="text-left px-4 py-3 font-semibold">Location</th>
              <th className="text-left px-4 py-3 font-semibold">Benchmark Group</th>
              <th className="text-center px-4 py-3 font-semibold">Expected Answer Rate</th>
              <th className="text-center px-4 py-3 font-semibold">Daily Goal</th>
              <th className="text-center px-4 py-3 font-semibold">In Benchmark</th>
              <th className="text-center px-4 py-3 font-semibold">Active</th>
              <th className="text-center px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user, i) => (
              <tr key={user.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
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