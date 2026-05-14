import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';

export default function UnmappedExtensionsPanel() {
  const [assigning, setAssigning] = useState({});
  const queryClient = useQueryClient();

  const { data: inbound = [] } = useQuery({
    queryKey: ['inbound-calls'],
    queryFn: () => base44.entities.InboundCallRaw.list(),
  });

  const { data: outbound = [] } = useQuery({
    queryKey: ['outbound-calls'],
    queryFn: () => base44.entities.OutboundCallRaw.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['user-directory'],
    queryFn: () => base44.entities.UserDirectory.list(),
  });

  const activeUsers = useMemo(() => users.filter(u => u.active !== false), [users]);

  // Find unmapped extensions by checking UserDirectory.extensions array
  const unmappedData = useMemo(() => {
    // Build set of all mapped extensions from UserDirectory.extensions
    const mappedExts = new Set();
    users.forEach(user => {
      if (user.extensions && Array.isArray(user.extensions)) {
        user.extensions.forEach(ext => {
          mappedExts.add(ext);
        });
      }
    });

    const unmapped = {};

    // Process inbound
    inbound.forEach(call => {
      if (!mappedExts.has(call.extension)) {
        if (!unmapped[call.extension]) {
          unmapped[call.extension] = {
            extension: call.extension,
            inbound: 0,
            outbound: 0,
            firstSeen: call.call_date,
            lastSeen: call.call_date,
          };
        }
        unmapped[call.extension].inbound++;
        if (call.call_date < unmapped[call.extension].firstSeen) {
          unmapped[call.extension].firstSeen = call.call_date;
        }
        if (call.call_date > unmapped[call.extension].lastSeen) {
          unmapped[call.extension].lastSeen = call.call_date;
        }
      }
    });

    // Process outbound
    outbound.forEach(call => {
      if (!mappedExts.has(call.extension)) {
        if (!unmapped[call.extension]) {
          unmapped[call.extension] = {
            extension: call.extension,
            inbound: 0,
            outbound: 0,
            firstSeen: call.call_date,
            lastSeen: call.call_date,
          };
        }
        unmapped[call.extension].outbound++;
        if (call.call_date < unmapped[call.extension].firstSeen) {
          unmapped[call.extension].firstSeen = call.call_date;
        }
        if (call.call_date > unmapped[call.extension].lastSeen) {
          unmapped[call.extension].lastSeen = call.call_date;
        }
      }
    });

    return Object.values(unmapped);
  }, [inbound, outbound, users]);

  const handleAssign = async (extension, userId) => {
    if (!userId) return;

    setAssigning({ ...assigning, [extension]: true });

    try {
      // Find the user and add extension to their extensions array
      const user = users.find(u => u.id === userId);
      if (!user) {
        alert('User not found');
        return;
      }

      const currentExtensions = user.extensions || [];
      // Add extension if not already present
      if (!currentExtensions.includes(extension)) {
        currentExtensions.push(extension);
      }

      await base44.entities.UserDirectory.update(userId, {
        extensions: currentExtensions
      });

      queryClient.invalidateQueries({ queryKey: ['user-directory'] });
      queryClient.invalidateQueries({ queryKey: ['inbound-calls'] });
      queryClient.invalidateQueries({ queryKey: ['outbound-calls'] });
    } catch (error) {
      alert(`Assignment failed: ${error.message}`);
    } finally {
      setAssigning({ ...assigning, [extension]: false });
    }
  };

  if (unmappedData.length === 0) {
    return null;
  }

  return (
    <Alert variant="warning">
      <AlertTriangle className="w-4 h-4" />
      <AlertDescription>
        <div className="space-y-4">
          <div className="font-semibold">
            {unmappedData.length} unmapped extension(s) detected
          </div>
          <div className="space-y-3">
            {unmappedData.map((item) => (
              <div
                key={item.extension}
                className="flex items-center justify-between gap-4 bg-white/50 p-3 rounded border border-yellow-200"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono font-semibold">{item.extension}</div>
                  <div className="text-xs text-slate-600">
                    {item.inbound} inbound, {item.outbound} outbound • First seen:{' '}
                    {item.firstSeen} • Last seen: {item.lastSeen}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Select onValueChange={(userId) => handleAssign(item.extension, userId)}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Assign to user..." />
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
        </div>
      </AlertDescription>
    </Alert>
  );
}