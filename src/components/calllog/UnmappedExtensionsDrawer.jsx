import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { X, ChevronDown, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export default function UnmappedExtensionsDrawer({ unmappedData, onClose }) {
  const [showAll, setShowAll] = useState(false);
  const [assigning, setAssigning] = useState({});
  const queryClient = useQueryClient();

  const { data: users = [] } = useQuery({
    queryKey: ['user-directory'],
    queryFn: () => base44.entities.UserDirectory.list(),
  });

  const activeUsers = useMemo(() => users.filter(u => u.active !== false), [users]);

  const displayData = useMemo(() => {
    const sorted = [...unmappedData].sort((a, b) => b.inbound - a.inbound);
    return showAll ? sorted : sorted.slice(0, 5);
  }, [unmappedData, showAll]);

  const handleAssign = async (extension, userId) => {
    if (!userId) return;

    setAssigning({ ...assigning, [extension]: true });

    try {
      const user = users.find(u => u.id === userId);
      if (!user) {
        alert('User not found');
        return;
      }

      const currentExtensions = user.extensions || [];
      if (!currentExtensions.includes(extension)) {
        currentExtensions.push(extension);
      }

      await base44.entities.UserDirectory.update(userId, {
        extensions: currentExtensions
      });

      queryClient.invalidateQueries({ queryKey: ['user-directory'] });
      queryClient.invalidateQueries({ queryKey: ['call-log-report'] });
    } catch (error) {
      alert(`Assignment failed: ${error.message}`);
    } finally {
      setAssigning({ ...assigning, [extension]: false });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end">
      <div className="w-full max-w-2xl bg-white shadow-xl flex flex-col max-h-screen">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Unmapped Extensions</h2>
            <p className="text-sm text-slate-600 mt-1">
              {unmappedData.length.toLocaleString()} total extensions found
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-3">
            {displayData.map((item) => (
              <div
                key={item.extension}
                className="flex items-center justify-between gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono font-bold text-slate-900">{item.extension}</div>
                  <div className="grid grid-cols-3 gap-4 mt-2 text-xs text-slate-600">
                    <div>
                      <p className="font-medium text-slate-700">{item.inbound}</p>
                      <p>Inbound</p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-700">{item.outbound}</p>
                      <p>Outbound</p>
                    </div>
                    <div>
                      <p className="font-medium text-slate-700">{item.lastSeen}</p>
                      <p>Last Seen</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Select 
                    onValueChange={(userId) => handleAssign(item.extension, userId)}
                    disabled={assigning[item.extension]}
                  >
                    <SelectTrigger className="w-40">
                      {assigning[item.extension] ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Assigning...</span>
                        </div>
                      ) : (
                        <SelectValue placeholder="Assign..." />
                      )}
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
            ))}
          </div>

          {/* Show All Button */}
          {!showAll && unmappedData.length > 5 && (
            <div className="flex justify-center mt-6">
              <Button
                variant="outline"
                onClick={() => setShowAll(true)}
                className="gap-2"
              >
                <ChevronDown className="w-4 h-4" />
                Show All {unmappedData.length} Extensions
              </Button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 p-6 bg-slate-50 flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}