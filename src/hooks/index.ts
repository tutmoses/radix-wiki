// src/hooks/index.ts - Unified hooks

'use client';

import { useState, useEffect, useMemo, useRef, type RefObject } from 'react';
import { usePathname } from 'next/navigation';
import { create } from 'zustand';
import { isValidTagPath } from '@/lib/tags';
import type { WikiPage, AuthSession, RadixWalletData, WikiNotification } from '@/types';

// ========== CLICK OUTSIDE HOOK ==========

export function useClickOutside<T extends HTMLElement>(onClose: () => void): RefObject<T | null> {
  const ref = useRef<T>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  return ref;
}

// ========== FETCH HOOK ==========

export function useFetch<T>(url: string | null | undefined, opts?: { transform?: (data: any) => T; interval?: number }) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(!!url);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!url) { setIsLoading(false); return; }
    let cancelled = false;
    const doFetch = async () => {
      try {
        setIsLoading(true);
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.statusText);
        const json = await res.json();
        if (!cancelled) { setData(opts?.transform ? opts.transform(json) : json); setError(null); }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : 'Fetch failed'); }
      finally { if (!cancelled) setIsLoading(false); }
    };
    doFetch();
    const id = opts?.interval ? setInterval(doFetch, opts.interval) : undefined;
    return () => { cancelled = true; if (id) clearInterval(id); };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  return { data, isLoading, error };
}

// ========== VIEWPORT HOOK ==========

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);
    handler(mql);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isMobile;
}

// ========== PAGE PATH HOOK ==========

export function usePagePath() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  const isEdit = last === 'edit';
  const isHistory = last === 'history';
  const viewSegs = (isEdit || isHistory) ? segments.slice(0, -1) : segments;
  const isHomepage = viewSegs.length === 0;
  const isPage = !isHomepage && !isValidTagPath(viewSegs) && viewSegs.length >= 2;
  const viewPath = isHomepage ? '/' : `/${viewSegs.join('/')}`;
  const tagPath = isPage ? viewSegs.slice(0, -1).join('/') : null;
  const slug = isPage ? viewSegs[viewSegs.length - 1] : null;
  return { isHomepage, isPage, isEdit, isHistory, viewPath, tagPath, slug };
}

// ========== STORE ==========

export interface PageInfo {
  updatedAt: string | Date;
  createdAt: string | Date;
  author?: { id: string; displayName?: string | null; radixAddress: string; avatarUrl?: string | null } | null;
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
  toast: { message: string; type: 'success' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'info') => void;
  dismissToast: () => void;
  notifications: WikiNotification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markNotificationsRead: (ids?: string[]) => Promise<void>;
}

export const useStore = create<AppStore>()((set, get) => ({
  session: null,
  isLoading: true,
  isConnected: false,
  rdtReady: false,
  walletData: null,
  sidebarOpen: false,
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
    set({ session: null, isConnected: false, walletData: null, isLoading: false, notifications: [], unreadCount: 0 });
  },
  toast: null,
  showToast: (message, type = 'success') => {
    set({ toast: { message, type } });
    setTimeout(() => set({ toast: null }), 5000);
  },
  dismissToast: () => set({ toast: null }),
  notifications: [],
  unreadCount: 0,
  fetchNotifications: async () => {
    try {
      const res = await fetch('/api/notifications?pageSize=20');
      if (res.ok) {
        const data = await res.json();
        set({ notifications: data.items, unreadCount: data.unreadCount });
      }
    } catch { /* silent */ }
  },
  markNotificationsRead: async (ids) => {
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (ids) {
        set(s => ({
          notifications: s.notifications.map(n => ids.includes(n.id) ? { ...n, read: true } : n),
          unreadCount: Math.max(0, s.unreadCount - ids.length),
        }));
      } else {
        set(s => ({
          notifications: s.notifications.map(n => ({ ...n, read: true })),
          unreadCount: 0,
        }));
      }
    } catch { /* silent */ }
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