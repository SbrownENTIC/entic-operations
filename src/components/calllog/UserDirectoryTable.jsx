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

export default function UserDirectoryTable() {
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [formData, setFormData] = useState(null);
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

  const handleNew = () => {
    setFormData({
      name: '',
      role: '',
      benchmark_group: 'Other',
      include_in_benchmark: false,
      expected_answer_rate: 0.8,
      active: true,
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

  if (isLoading) return <div className="text-center py-4">Loading...</div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <Input
          placeholder="Search by name or role..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1"
        />
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
              <th className="text-left px-4 py-3 font-semibold">Benchmark Group</th>
              <th className="text-center px-4 py-3 font-semibold">In Benchmark</th>
              <th className="text-center px-4 py-3 font-semibold">Answer Rate</th>
              <th className="text-center px-4 py-3 font-semibold">Active</th>
              <th className="text-center px-4 py-3 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user, i) => (
              <tr key={user.id} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                <td className="px-4 py-3">{user.name}</td>
                <td className="px-4 py-3 text-slate-600">{user.role || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{user.benchmark_group || 'Other'}</td>
                <td className="px-4 py-3 text-center">
                  <Checkbox
                    checked={user.include_in_benchmark || false}
                    onCheckedChange={() => handleToggleBenchmark(user)}
                  />
                </td>
                <td className="px-4 py-3 text-center">
                  {Math.round((user.expected_answer_rate || 0.8) * 100)}%
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
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
                placeholder="Job title"
              />
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
              <label className="text-sm font-medium">Expected Answer Rate (%)</label>
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