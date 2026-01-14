// src/hooks/index.ts - Unified hooks

'use client';

import { useState, useEffect, useCallback } from 'react';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { WikiPage, AuthSession, RadixWalletData } from '@/types';

// ========== STORE ==========

interface AppStore {
  session: AuthSession | null;
  isLoading: boolean;
  isConnected: boolean;
  walletData: RadixWalletData | null;
  sidebarOpen: boolean;
  _rdtDisconnect: (() => void) | null;
  _rdtConnect: (() => void) | null;
  _setRdtCallbacks: (connect: (() => void) | null, disconnect: (() => void) | null) => void;
  setSession: (session: AuthSession | null) => void;
  setLoading: (isLoading: boolean) => void;
  setConnected: (isConnected: boolean) => void;
  setWalletData: (walletData: RadixWalletData | null) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
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
      sidebarOpen: false,
      _rdtDisconnect: null,
      _rdtConnect: null,
      _setRdtCallbacks: (connect, disconnect) => set({ _rdtConnect: connect, _rdtDisconnect: disconnect }),
      setSession: (session) => set({ session, isLoading: false }),
      setLoading: (isLoading) => set({ isLoading }),
      setConnected: (isConnected) => set({ isConnected }),
      setWalletData: (walletData) => set({ walletData, isConnected: !!walletData }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
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

// ========== AUTH HOOK ==========

export const useAuth = () => {
  const { session, walletData, isConnected } = useStore();
  const isAuthenticated = !!session && new Date(session.expiresAt) > new Date();
  const user = session ? {
    id: session.userId,
    radixAddress: session.radixAddress,
    personaAddress: session.personaAddress,
    displayName: session.displayName,
  } : null;
  return { user, isAuthenticated, isConnected, walletData };
};

// ========== PAGES HOOK ==========

type PageMode = 
  | { type: 'single'; tagPath: string; slug: string }
  | { type: 'recent'; tagPath?: string; limit: number }
  | { type: 'byIds'; pageIds: string[] };

type SingleResult = { page: WikiPage | null; status: 'loading' | 'found' | 'notfound' | 'error' };
type ListResult = { pages: WikiPage[]; isLoading: boolean };

export function usePages(mode: { type: 'single'; tagPath: string; slug: string }): SingleResult;
export function usePages(mode: { type: 'recent'; tagPath?: string; limit: number }): ListResult;
export function usePages(mode: { type: 'byIds'; pageIds: string[] }): ListResult;
export function usePages(mode: PageMode): SingleResult | ListResult {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [page, setPage] = useState<WikiPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<'loading' | 'found' | 'notfound' | 'error'>('loading');

  const modeKey = mode.type === 'single' ? `${mode.tagPath}/${mode.slug}`
    : mode.type === 'recent' ? `${mode.tagPath || ''}:${mode.limit}`
    : mode.pageIds.join(',');

  useEffect(() => {
    if (mode.type === 'byIds' && !mode.pageIds.length) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    if (mode.type === 'single') setStatus('loading');

    (async () => {
      try {
        if (mode.type === 'single') {
          const res = await fetch(`/api/wiki/${mode.tagPath}/${mode.slug}`);
          if (res.ok) { setPage(await res.json()); setStatus('found'); }
          else setStatus(res.status === 404 ? 'notfound' : 'error');
        } else if (mode.type === 'recent') {
          const params = new URLSearchParams({ pageSize: mode.limit.toString(), published: 'true' });
          if (mode.tagPath) params.set('tagPath', mode.tagPath);
          const res = await fetch(`/api/wiki?${params}`);
          if (res.ok) setPages((await res.json()).items);
        } else {
          const results = await Promise.all(mode.pageIds.map(id => fetch(`/api/wiki/by-id/${id}`).then(r => r.ok ? r.json() : null)));
          setPages(results.filter(Boolean));
        }
      } catch {
        if (mode.type === 'single') setStatus('error');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [mode.type, modeKey]);

  if (mode.type === 'single') return { page, status };
  return { pages, isLoading };
}

// ========== FORM HOOK ==========

export function useFormSubmit<T>(submitFn: (data: T) => Promise<boolean | void>) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = useCallback(async (data: T) => {
    if (isSubmitting) return false;
    setIsSubmitting(true);
    try { return await submitFn(data); }
    finally { setIsSubmitting(false); }
  }, [submitFn, isSubmitting]);
  return { isSubmitting, handleSubmit };
}