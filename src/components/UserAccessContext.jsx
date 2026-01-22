import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const UserAccessContext = createContext({
  user: null,
  isAdmin: false,
  isReadOnly: true,
  isLoading: true,
});

export function UserAccessProvider({ children }) {
  const { data: user, isLoading } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => {
      try {
        // If we are on a public page that doesn't require auth, this might fail or return null
        // But the user said "requires login", so we assume auth.
        return await base44.auth.me();
      } catch (e) {
        return null;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: false,
  });

  const isAdmin = user?.role === 'admin';
  // If no user (not logged in), default to read-only/no access. 
  // If user is 'user', isReadOnly = true.
  const isReadOnly = !isAdmin;

  return (
    <UserAccessContext.Provider value={{ user, isAdmin, isReadOnly, isLoading }}>
      {children}
    </UserAccessContext.Provider>
  );
}

export const useUserAccess = () => useContext(UserAccessContext);