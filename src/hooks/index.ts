// src/hooks/index.ts - Unified hooks

'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { create } from 'zustand';
import { isValidTagPath } from '@/lib/tags';
import type { WikiPage, AuthSession, RadixWalletData, WikiNotification } from '@/types';

// ========== CLICK OUTSIDE HOOK ==========

// `wiki-formant/react`, shared with the other wikis — all three had written this,
// and only this copy carried the `offsetParent` guard that keeps a container
// hidden at the current breakpoint from claiming outside-clicks. The package
// took this version; re-exported so call sites keep importing from `@/hooks`.
export { useClickOutside } from 'wiki-formant/react';

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



// ========== PAGE PATH HOOK ==========

export function usePagePath() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  const isEdit = last === 'edit';
  const isHistory = last === 'history';
  const viewSegs = (isEdit || isHistory) ? segments.slice(0, -1) : segments;
  const isHomepage = viewSegs.length === 0;
  const isCategory = !isHomepage && isValidTagPath(viewSegs);
  const isPage = !isHomepage && !isCategory && viewSegs.length >= 2;
  const viewPath = isHomepage ? '/' : `/${viewSegs.join('/')}`;
  const tagPath = isPage ? viewSegs.slice(0, -1).join('/') : null;
  const slug = isPage ? viewSegs[viewSegs.length - 1] : null;
  return { isHomepage, isCategory, isPage, isEdit, isHistory, viewPath, tagPath, slug };
}

// ========== STORE ==========

interface AppStore {
  session: AuthSession | null;
  isLoading: boolean;
  isConnected: boolean;
  isConnecting: boolean;
  rdtReady: boolean;
  walletData: RadixWalletData | null;
  _rdtDisconnect: (() => void) | null;
  _rdtConnect: (() => void) | null;
  _rdtSendTransaction: ((manifest: string) => Promise<{ transactionIntentHash: string }>) | null;
  _pendingConnect: boolean;
  _connectTimeout: ReturnType<typeof setTimeout> | null;
  _setRdtCallbacks: (connect: (() => void) | null, disconnect: (() => void) | null, sendTx?: ((manifest: string) => Promise<{ transactionIntentHash: string }>) | null) => void;
  sendTransaction: (manifest: string) => Promise<{ transactionIntentHash: string }>;
  setRdtReady: (ready: boolean) => void;
  setSession: (session: AuthSession | null) => void;
  setLoading: (isLoading: boolean) => void;
  setConnected: (isConnected: boolean) => void;
  setWalletData: (walletData: RadixWalletData | null) => void;
  clearConnecting: () => void;
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
  isConnecting: false,
  rdtReady: false,
  walletData: null,
  _rdtDisconnect: null,
  _rdtConnect: null,
  _rdtSendTransaction: null,
  _pendingConnect: false,
  _connectTimeout: null,
  _setRdtCallbacks: (connect, disconnect, sendTx) => {
    set({ _rdtConnect: connect, _rdtDisconnect: disconnect, _rdtSendTransaction: sendTx ?? null });
    // Flush any connect attempt that happened before RDT was ready
    if (connect && get()._pendingConnect) {
      set({ _pendingConnect: false });
      connect();
    }
  },
  sendTransaction: async (manifest) => {
    const { _rdtSendTransaction } = get();
    if (!_rdtSendTransaction) throw new Error('Wallet not connected');
    return _rdtSendTransaction(manifest);
  },
  setRdtReady: (rdtReady) => set({ rdtReady }),
  setSession: (session) => set({ session, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  setConnected: (isConnected) => set({ isConnected }),
  setWalletData: (walletData) => {
    const { _connectTimeout } = get();
    if (_connectTimeout) clearTimeout(_connectTimeout);
    set({ walletData, isConnected: !!walletData, isConnecting: false, _connectTimeout: null });
  },
  clearConnecting: () => {
    const { _connectTimeout } = get();
    if (_connectTimeout) clearTimeout(_connectTimeout);
    set({ isConnecting: false, _connectTimeout: null });
  },
  connect: () => {
    const { _rdtConnect, rdtReady, _connectTimeout } = get();
    if (_connectTimeout) clearTimeout(_connectTimeout);
    const timeout = setTimeout(() => {
      set({ isConnecting: false, _connectTimeout: null });
      get().showToast('No response from the Radix Wallet. Make sure the wallet app or Connector extension is reachable, then try again.', 'info');
    }, 60_000);
    set({ isConnecting: true, _connectTimeout: timeout });
    if (_rdtConnect) {
      _rdtConnect();
    } else if (!rdtReady) {
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

  // Callers pass `mode` as an inline object literal, so it is a new reference on
  // every render and cannot be a dependency itself. Flatten it to a primitive key
  // instead — one value the linter can check, covering every field used below.
  const modeKey =
    mode.type === 'single' ? `single:${mode.tagPath}/${mode.slug}`
    : mode.type === 'recent' ? `recent:${mode.tagPath || ''}:${mode.limit}:${mode.sort || 'updatedAt'}`
    : `byIds:${mode.pageIds.join(',')}`;

  // Memoize mode properties to prevent unnecessary re-fetches
  const modeConfig = useMemo(() => {
    if (mode.type === 'single') {
      return { type: 'single' as const, tagPath: mode.tagPath, slug: mode.slug, key: `${mode.tagPath}/${mode.slug}` };
    }
    if (mode.type === 'recent') {
      return { type: 'recent' as const, tagPath: mode.tagPath, limit: mode.limit, sort: mode.sort || 'updatedAt', key: `${mode.tagPath || ''}:${mode.limit}:${mode.sort || 'updatedAt'}` };
    }
    return { type: 'byIds' as const, pageIds: mode.pageIds, key: mode.pageIds.join(',') };
    // modeKey is the complete dependency: every `mode` field read above is folded
    // into it, and `mode` itself is a new object literal on every render, so
    // listing its fields would defeat the memo rather than tighten it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeKey]);

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