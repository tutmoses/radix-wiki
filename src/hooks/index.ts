// src/hooks/index.ts - Unified hooks

'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { create } from 'zustand';
import { parsePath } from '@/lib/path';
import { sendJson } from '@/lib/utils';
import type { AuthSession, RadixWalletData, WikiNotification } from '@/types';

// ========== FETCH HOOK ==========

/** Every variant carries `data`, so a caller can destructure it; only `loaded` holds any. */
type Fetched<T> =
  | { status: 'idle' | 'loading'; data: null; error: null }
  | { status: 'failed'; data: null; error: string }
  | { status: 'loaded'; data: T; error: null };

const IDLE = { status: 'idle', data: null, error: null } as const;
const LOADING = { status: 'loading', data: null, error: null } as const;

/** `interval` polls: a poll leaves the loaded state on screen until its answer replaces it. */
export function useFetch<T>(url: string | null | undefined, opts?: { transform?: (data: any) => T; interval?: number }): Fetched<T> {
  const [state, setState] = useState<Fetched<T>>(url ? LOADING : IDLE);

  useEffect(() => {
    if (!url) { setState(IDLE); return; }
    let cancelled = false;
    setState(LOADING);
    const doFetch = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.statusText || `Failed (${res.status})`);
        const json = await res.json();
        if (!cancelled) setState({ status: 'loaded', data: opts?.transform ? opts.transform(json) : json, error: null });
      } catch (e) { if (!cancelled) setState({ status: 'failed', data: null, error: e instanceof Error ? e.message : 'Fetch failed' }); }
    };
    doFetch();
    const id = opts?.interval ? setInterval(doFetch, opts.interval) : undefined;
    return () => { cancelled = true; if (id) clearInterval(id); };
  }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

// ========== PAGE PATH HOOK ==========

/**
 * `usePathname()`, with the root spelled the way the browser spells it.
 *
 * Next stores the root of an optional catch-all under the page path
 * `normalizePagePath('/')` gives it — `/index` — and on Vercel an ISR
 * regeneration renders the homepage at that path. `params` still arrives
 * empty, so the article itself is right, but `usePathname()` reads `/index`
 * on the server and `/` in the browser. Anything client-side that branches on
 * it then renders one thing into the cached HTML and another at hydration:
 * the header's page-tools button disappeared from the server render, which is
 * a structural mismatch, so React #418 hit every visitor to the homepage from
 * the first regeneration after a deploy — while the build-time prerender,
 * which does render at `/`, looked fine. `next start` never spells it the
 * other way, so it reproduces only in production.
 *
 * This is `denormalizePagePath`'s rule, applied where the pathname is read.
 */
export function useWikiPathname(): string {
  const pathname = usePathname();
  return pathname === '/index' ? '/' : pathname;
}

export function usePagePath() {
  const { type, tagPath, slug, suffix } = parsePath(useWikiPathname().split('/').filter(Boolean));
  const isHomepage = !tagPath && !slug && (type === 'homepage' || suffix !== null);
  const isPage = !!slug;
  return {
    isHomepage, isPage,
    /** A category's own page (its listing or hub), not its edit or history view. */
    sectionPath: type === 'category' && !suffix ? tagPath : null,
    isEdit: suffix === 'edit',
    isHistory: suffix === 'history',
    viewPath: isPage ? `/${tagPath}/${slug}` : '/',
    tagPath: isPage ? tagPath : null,
    slug: isPage ? slug : null,
  };
}

// ========== STORE ==========

/** The Radix dApp Toolkit: still loading, failed to load, or loaded with the wallet calls it offers. */
type Wallet =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | {
      kind: 'ready';
      /** Settles when the wallet answers: null once it has, else what to tell the reader. */
      connect: () => Promise<string | null>;
      disconnect: () => void;
      sendTransaction: (manifest: string) => Promise<{ transactionIntentHash: string }>;
    };

const WALLET_UNAVAILABLE = 'The Radix wallet toolkit did not load, so the wallet cannot be reached from this page. Reload and try again.';

interface AppStore {
  session: AuthSession | null;
  /** The session check on load, a wallet request in flight, or neither. */
  auth: 'checking' | 'connecting' | 'idle';
  wallet: Wallet;
  walletData: RadixWalletData | null;
  /** The connect attempt in flight, named by its 60s backstop timer. */
  _connectTimeout: ReturnType<typeof setTimeout> | null;
  /** Ends the attempt `timeout` names, and only that one, telling the reader `message` if there is one. */
  _endConnect: (timeout: ReturnType<typeof setTimeout>, message?: string | null) => void;
  setWallet: (wallet: Wallet) => void;
  sendTransaction: (manifest: string) => Promise<{ transactionIntentHash: string }>;
  setSession: (session: AuthSession | null) => void;
  sessionChecked: () => void;
  setWalletData: (walletData: RadixWalletData | null) => void;
  connect: () => void;
  logout: (everywhere?: boolean) => Promise<void>;
  /** `timer` is the toast's own dismissal, cleared when another replaces it. */
  toast: { message: string; type: 'success' | 'info'; timer: ReturnType<typeof setTimeout> } | null;
  showToast: (message: string, type?: 'success' | 'info') => void;
  dismissToast: () => void;
  /** The article on screen, set by `PageView`, so the header's citation can name it. */
  pageTitle: string | null;
  notifications: WikiNotification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markNotificationsRead: (ids?: string[]) => Promise<void>;
}

// The wallet's answer ends the attempt, so a rejection or a failed challenge
// says so at once rather than leaving "Connecting..." up until the backstop.
function sendConnect(wallet: Extract<Wallet, { kind: 'ready' }>, timeout: ReturnType<typeof setTimeout>) {
  wallet.connect()
    .catch(() => 'The Radix Wallet request failed. Try again.')
    .then(message => useStore.getState()._endConnect(timeout, message));
}

export const useStore = create<AppStore>()((set, get) => ({
  session: null,
  auth: 'checking',
  wallet: { kind: 'loading' },
  walletData: null,
  _connectTimeout: null,
  _endConnect: (timeout, message) => {
    if (get()._connectTimeout !== timeout) return;
    clearTimeout(timeout);
    set({ auth: 'idle', _connectTimeout: null });
    if (message) get().showToast(message, 'info');
  },
  setWallet: (wallet) => {
    const { wallet: prev, auth, _connectTimeout } = get();
    set({ wallet });
    // A connect clicked while the toolkit loaded was waiting for it.
    if (prev.kind !== 'loading' || auth !== 'connecting' || !_connectTimeout) return;
    if (wallet.kind === 'ready') sendConnect(wallet, _connectTimeout);
    else if (wallet.kind === 'unavailable') get()._endConnect(_connectTimeout, WALLET_UNAVAILABLE);
  },
  sendTransaction: async (manifest) => {
    const { wallet } = get();
    if (wallet.kind !== 'ready') throw new Error(wallet.kind === 'unavailable' ? WALLET_UNAVAILABLE : 'Wallet not connected');
    return wallet.sendTransaction(manifest);
  },
  setSession: (session) => set({ session }),
  sessionChecked: () => set(s => s.auth === 'checking' ? { auth: 'idle' } : {}),
  setWalletData: (walletData) => set({ walletData }),
  connect: () => {
    const { wallet, _connectTimeout } = get();
    if (wallet.kind === 'unavailable') { get().showToast(WALLET_UNAVAILABLE, 'info'); return; }
    if (_connectTimeout) clearTimeout(_connectTimeout);
    const timeout = setTimeout(() => get()._endConnect(timeout,
      'No response from the Radix Wallet. Make sure the wallet app or Connector extension is reachable, then try again.'), 60_000);
    set({ auth: 'connecting', _connectTimeout: timeout });
    if (wallet.kind === 'ready') sendConnect(wallet, timeout);
  },
  logout: async (everywhere = false) => {
    const { wallet } = get();
    try {
      await fetch(everywhere ? '/api/auth?everywhere' : '/api/auth', { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to clear server session:', error);
    }
    if (wallet.kind === 'ready') wallet.disconnect();
    set({ session: null, walletData: null, notifications: [], unreadCount: 0 });
  },
  toast: null,
  showToast: (message, type = 'success') => {
    const prev = get().toast;
    if (prev) clearTimeout(prev.timer);
    set({ toast: { message, type, timer: setTimeout(() => set({ toast: null }), 5000) } });
  },
  dismissToast: () => {
    const prev = get().toast;
    if (prev) clearTimeout(prev.timer);
    set({ toast: null });
  },
  pageTitle: null,
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
      await sendJson('/api/notifications', 'PATCH', { ids });
      if (ids) {
        // Only the ones still unread lower the count: clicking a read notification marks nothing.
        set(s => ({
          notifications: s.notifications.map(n => ids.includes(n.id) ? { ...n, read: true } : n),
          unreadCount: Math.max(0, s.unreadCount - s.notifications.filter(n => ids.includes(n.id) && !n.read).length),
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
  const isAuthenticated = !!session && new Date(session.expiresAt) > new Date();
  const user = useMemo(() => session ? {
    id: session.userId,
    radixAddress: session.radixAddress,
    personaAddress: session.personaAddress,
    displayName: session.displayName,
  } : null, [session]);
  return useMemo(() => ({ user, isAuthenticated, walletData }), [user, isAuthenticated, walletData]);
};
