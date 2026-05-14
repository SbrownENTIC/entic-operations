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
import { Trash2, Plus, Edit2 } from 'lucide-react';
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
  const queryClient = useQueryClient();

  const { data: extensions = [] } = useQuery({
    queryKey: ['extensions'],
    queryFn: () => base44.entities.UserExtensions.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['user-directory'],
    queryFn: () => base44.entities.UserDirectory.list(),
  });

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
      if (editingExt) {
        await base44.entities.UserExtensions.update(editingExt, formData);
      } else {
        await base44.entities.UserExtensions.create(formData);
      }
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
      setFormData(null);
      setEditingExt(null);
    } catch (error) {
      alert(`Save failed: ${error.message}`);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this extension mapping?')) return;
    try {
      await base44.entities.UserExtensions.delete(id);
      queryClient.invalidateQueries({ queryKey: ['extensions'] });
    } catch (error) {
      alert(`Delete failed: ${error.message}`);
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
      </div>

      <div className="border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold">Extension</th>
              <th className="text-left px-4 py-3 font-semibold">Assigned User</th>
              <th className="text-center px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ext, i) => (
              <tr key={ext.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="px-4 py-3 font-mono">{ext.extension}</td>
                <td className="px-4 py-3">
                  {userMap[ext.user_id]?.name || 'Unknown'}
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
            ))}
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
    </div>
  );
}