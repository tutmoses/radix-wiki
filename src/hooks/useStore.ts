// src/hooks/useStore.ts

'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AppStore, AuthSession, RadixWalletData, WikiPage } from '@/types';

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Auth state
      session: null,
      isLoading: true,
      isConnected: false,
      walletData: null,
      _rdtDisconnect: null,
      _rdtConnect: null,
      _setRdtCallbacks: (connect, disconnect) => set({ _rdtConnect: connect, _rdtDisconnect: disconnect }),
      setSession: (session) => set({ session, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      setConnected: (isConnected) => set({ isConnected }),
      setWalletData: (walletData) => set({ walletData, isConnected: !!walletData }),
      connect: () => get()._rdtConnect?.(),
      logout: async () => {
        const { _rdtDisconnect } = get();
        try {
          await fetch('/api/auth', { method: 'DELETE' });
        } catch (error) {
          console.error('Failed to clear server session:', error);
        }
        _rdtDisconnect?.();
        set({ session: null, isConnected: false, walletData: null, isLoading: false });
      },
      // Wiki state
      currentPage: null,
      recentPages: [],
      searchResults: [],
      setCurrentPage: (page) => set({ currentPage: page }),
      setRecentPages: (pages) => set({ recentPages: pages }),
      setSearchResults: (pages) => set({ searchResults: pages }),
    }),
    {
      name: 'radix-wiki-store',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ session: state.session, isConnected: state.isConnected }),
    }
  )
);

export const useIsAuthenticated = () => {
  const session = useStore((s) => s.session);
  return !!session && new Date(session.expiresAt) > new Date();
};

export const useAuth = () => {
  const { session, walletData, isConnected } = useStore();
  const user = session ? {
    id: session.userId,
    radixAddress: session.radixAddress,
    personaAddress: session.personaAddress,
    displayName: session.displayName,
  } : null;
  return { user, isConnected, walletData };
};