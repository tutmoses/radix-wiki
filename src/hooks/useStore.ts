// src/hooks/useStore.ts

'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthSession, RadixWalletData } from '@/types';

interface AppStore {
  session: AuthSession | null;
  isLoading: boolean;
  isConnected: boolean;
  walletData: RadixWalletData | null;
  _rdtDisconnect: (() => void) | null;
  _rdtConnect: (() => void) | null;
  _setRdtCallbacks: (connect: (() => void) | null, disconnect: (() => void) | null) => void;
  setSession: (session: AuthSession | null) => void;
  setLoading: (isLoading: boolean) => void;
  setConnected: (isConnected: boolean) => void;
  setWalletData: (walletData: RadixWalletData | null) => void;
  connect: () => void;
  logout: () => Promise<void>;
}

export const useStore = create<AppStore>()(
  persist(
    (set, get) => ({
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