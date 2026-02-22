// src/hooks/index.ts - Unified hooks

'use client';

import { useState, useEffect, useMemo } from 'react';
import { create } from 'zustand';
import type { WikiPage, AuthSession, RadixWalletData } from '@/types';

// ========== VIEWPORT HOOK ==========

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mql);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

// ========== STORE ==========

export interface PageInfo {
  updatedAt: string | Date;
  createdAt: string | Date;
  author?: { id: string; displayName?: string | null; radixAddress: string } | null;
  revisionCount: number;
}

interface AppStore {
  session: AuthSession | null;
  isLoading: boolean;
  isConnected: boolean;
  rdtReady: boolean;
  walletData: RadixWalletData | null;
  sidebarOpen: boolean;
  pageInfo: PageInfo | null;
  _rdtDisconnect: (() => void) | null;
  _rdtConnect: (() => void) | null;
  _pendingConnect: boolean;
  _setRdtCallbacks: (connect: (() => void) | null, disconnect: (() => void) | null) => void;
  setRdtReady: (ready: boolean) => void;
  setSession: (session: AuthSession | null) => void;
  setLoading: (isLoading: boolean) => void;
  setConnected: (isConnected: boolean) => void;
  setWalletData: (walletData: RadixWalletData | null) => void;
  setSidebarOpen: (open: boolean) => void;
  setPageInfo: (info: PageInfo | null) => void;
  toggleSidebar: () => void;
  connect: () => void;
  logout: () => Promise<void>;
}

export const useStore = create<AppStore>()((set, get) => ({
  session: null,
  isLoading: true,
  isConnected: false,
  rdtReady: false,
  walletData: null,
  sidebarOpen: true,
  pageInfo: null,
  _rdtDisconnect: null,
  _rdtConnect: null,
  _pendingConnect: false,
  _setRdtCallbacks: (connect, disconnect) => {
    set({ _rdtConnect: connect, _rdtDisconnect: disconnect });
    // Flush any connect attempt that happened before RDT was ready
    if (connect && get()._pendingConnect) {
      set({ _pendingConnect: false });
      connect();
    }
  },
  setRdtReady: (rdtReady) => set({ rdtReady }),
  setSession: (session) => set({ session, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  setConnected: (isConnected) => set({ isConnected }),
  setWalletData: (walletData) => set({ walletData, isConnected: !!walletData }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  setPageInfo: (pageInfo) => set({ pageInfo }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  connect: () => {
    const { _rdtConnect, rdtReady } = get();
    if (_rdtConnect) {
      _rdtConnect();
    } else if (!rdtReady) {
      // RDT still initializing — queue the intent so it fires once ready
      set({ _pendingConnect: true });
    }
  },
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
}));

// ========== AUTH HOOK ==========

export const useAuth = () => {
  const session = useStore(s => s.session);
  const walletData = useStore(s => s.walletData);
  const isConnected = useStore(s => s.isConnected);
  const isAuthenticated = !!session && new Date(session.expiresAt) > new Date();
  const user = useMemo(() => session ? {
    id: session.userId,
    radixAddress: session.radixAddress,
    personaAddress: session.personaAddress,
    displayName: session.displayName,
  } : null, [session]);
  return useMemo(() => ({ user, isAuthenticated, isConnected, walletData }), [user, isAuthenticated, isConnected, walletData]);
};

// ========== PAGES HOOK ==========

type PageMode = 
  | { type: 'single'; tagPath: string; slug: string }
  | { type: 'recent'; tagPath?: string; limit: number; sort?: 'updatedAt' | 'title' }
  | { type: 'byIds'; pageIds: string[] };

type SingleResult = { page: WikiPage | null; status: 'loading' | 'found' | 'notfound' | 'error' };
type ListResult = { pages: WikiPage[]; isLoading: boolean };

export function usePages(mode: { type: 'single'; tagPath: string; slug: string }): SingleResult;
export function usePages(mode: { type: 'recent'; tagPath?: string; limit: number; sort?: 'updatedAt' | 'title' }): ListResult;
export function usePages(mode: { type: 'byIds'; pageIds: string[] }): ListResult;
export function usePages(mode: PageMode): SingleResult | ListResult {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [page, setPage] = useState<WikiPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [status, setStatus] = useState<'loading' | 'found' | 'notfound' | 'error'>('loading');

  // Memoize mode properties to prevent unnecessary re-fetches
  const modeConfig = useMemo(() => {
    if (mode.type === 'single') {
      return { type: 'single' as const, tagPath: mode.tagPath, slug: mode.slug, key: `${mode.tagPath}/${mode.slug}` };
    }
    if (mode.type === 'recent') {
      return { type: 'recent' as const, tagPath: mode.tagPath, limit: mode.limit, sort: mode.sort || 'updatedAt', key: `${mode.tagPath || ''}:${mode.limit}:${mode.sort || 'updatedAt'}` };
    }
    return { type: 'byIds' as const, pageIds: mode.pageIds, key: mode.pageIds.join(',') };
  }, [mode.type, mode.type === 'single' ? mode.tagPath : '', mode.type === 'single' ? mode.slug : '', mode.type === 'recent' ? mode.tagPath : '', mode.type === 'recent' ? mode.limit : 0, mode.type === 'recent' ? mode.sort : '', mode.type === 'byIds' ? mode.pageIds.join(',') : '']);

  useEffect(() => {
    if (modeConfig.type === 'byIds' && !modeConfig.pageIds.length) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    if (modeConfig.type === 'single') setStatus('loading');

    (async () => {
      try {
        if (modeConfig.type === 'single') {
          const res = await fetch(`/api/wiki/${modeConfig.tagPath}/${modeConfig.slug}`);
          if (res.ok) { setPage(await res.json()); setStatus('found'); }
          else setStatus(res.status === 404 ? 'notfound' : 'error');
        } else if (modeConfig.type === 'recent') {
          const params = new URLSearchParams({ pageSize: modeConfig.limit.toString() });
          if (modeConfig.tagPath) params.set('tagPath', modeConfig.tagPath);
          if (modeConfig.sort) params.set('sort', modeConfig.sort);
          const res = await fetch(`/api/wiki?${params}`);
          if (res.ok) setPages((await res.json()).items || []);
        } else {
          const res = await fetch(`/api/wiki/by-ids?ids=${modeConfig.pageIds.join(',')}`);
          if (res.ok) setPages(await res.json());
        }
      } catch {
        if (modeConfig.type === 'single') setStatus('error');
      } finally {
        setIsLoading(false);
      }
    })();
  }, [modeConfig]);

  if (mode.type === 'single') return { page, status };
  return { pages, isLoading };
}