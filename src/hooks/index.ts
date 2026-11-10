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
export type Fetched<T> =
  | { status: 'idle' | 'loading'; data: null; error: null }
  | { status: 'failed'; data: null; error: string }
  | { status: 'loaded'; data: T; error: null };

const IDLE = { status: 'idle', data: null, error: null } as const;
const LOADING = { status: 'loading', data: null, error: null } as const;

/**
 * `interval` polls: a poll leaves the loaded state on screen until its answer
 * replaces it, and a poll that fails keeps it. Each request is numbered, so one
 * answering after a newer one has landed is dropped rather than shown over it.
 */
export function useFetch<T>(url: string | null | undefined, opts?: { transform?: (data: any) => T; interval?: number }): Fetched<T> {
  const [state, setState] = useState<Fetched<T>>(url ? LOADING : IDLE);

  useEffect(() => {
    if (!url) { setState(IDLE); return; }
    let started = 0;
    // The newest request whose answer is on screen; Infinity once the URL is left.
    let landed = 0;
    const land = (attempt: number, next: (s: Fetched<T>) => Fetched<T>) => {
      if (attempt <= landed) return;
      landed = attempt;
      setState(next);
    };
    setState(LOADING);
    const doFetch = async () => {
      const attempt = ++started;
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(res.statusText || `Failed (${res.status})`);
        const json = await res.json();
        const data: T = opts?.transform ? opts.transform(json) : json;
        land(attempt, () => ({ status: 'loaded', data, error: null }));
      } catch (e) {
        land(attempt, s => (s.status === 'loaded' ? s : { status: 'failed', data: null, error: e instanceof Error ? e.message : 'Fetch failed' }));
      }
    };
    doFetch();
    const id = opts?.interval ? setInterval(doFetch, opts.interval) : undefined;
    return () => { landed = Infinity; if (id) clearInterval(id); };
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

/** The session check on load, a wallet request in flight (named by its 60s backstop timer), or neither. */
type Auth =
  | { kind: 'checking' }
  | { kind: 'connecting'; timeout: ReturnType<typeof setTimeout> }
  | { kind: 'idle' };

/** The bell's notifications: the first read in flight, a first read that failed, or the list. */
type Notifications =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; items: WikiNotification[]; unread: number };

/**
 * Numbers each notifications read. A mark-read and a logout bump it too, so a
 * poll that set out before them cannot land after and put the old state back.
 */
let notificationsAttempt = 0;

const WALLET_UNAVAILABLE = 'The Radix wallet toolkit did not load, so the wallet cannot be reached from this page. Reload and try again.';

interface AppStore {
  session: AuthSession | null;
  auth: Auth;
  wallet: Wallet;
  walletData: RadixWalletData | null;
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
  notifications: Notifications;
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
  auth: { kind: 'checking' },
  wallet: { kind: 'loading' },
  walletData: null,
  _endConnect: (timeout, message) => {
    const { auth } = get();
    if (auth.kind !== 'connecting' || auth.timeout !== timeout) return;
    clearTimeout(timeout);
    set({ auth: { kind: 'idle' } });
    if (message) get().showToast(message, 'info');
  },
  setWallet: (wallet) => {
    const { wallet: prev, auth } = get();
    set({ wallet });
    // A connect clicked while the toolkit loaded was waiting for it.
    if (prev.kind !== 'loading' || auth.kind !== 'connecting') return;
    if (wallet.kind === 'ready') sendConnect(wallet, auth.timeout);
    else if (wallet.kind === 'unavailable') get()._endConnect(auth.timeout, WALLET_UNAVAILABLE);
  },
  sendTransaction: async (manifest) => {
    const { wallet } = get();
    if (wallet.kind !== 'ready') throw new Error(wallet.kind === 'unavailable' ? WALLET_UNAVAILABLE : 'Wallet not connected');
    return wallet.sendTransaction(manifest);
  },
  setSession: (session) => set({ session }),
  sessionChecked: () => set(s => s.auth.kind === 'checking' ? { auth: { kind: 'idle' } } : {}),
  setWalletData: (walletData) => set({ walletData }),
  connect: () => {
    const { wallet, auth } = get();
    if (wallet.kind === 'unavailable') { get().showToast(WALLET_UNAVAILABLE, 'info'); return; }
    if (auth.kind === 'connecting') clearTimeout(auth.timeout);
    const timeout = setTimeout(() => get()._endConnect(timeout,
      'No response from the Radix Wallet. Make sure the wallet app or Connector extension is reachable, then try again.'), 60_000);
    set({ auth: { kind: 'connecting', timeout } });
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
    notificationsAttempt++;
    set({ session: null, walletData: null, notifications: { status: 'loading' } });
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
  notifications: { status: 'loading' },
  fetchNotifications: async () => {
    const attempt = ++notificationsAttempt;
    try {
      const res = await fetch('/api/notifications?pageSize=20');
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      if (attempt === notificationsAttempt) set({ notifications: { status: 'loaded', items: data.items, unread: data.unreadCount } });
    } catch {
      // A failed poll keeps the list on screen; only a first read that fails says so.
      if (attempt === notificationsAttempt) set(s => (s.notifications.status === 'loaded' ? {} : { notifications: { status: 'failed' } }));
    }
  },
  markNotificationsRead: async (ids) => {
    const ok = await sendJson('/api/notifications', 'PATCH', { ids }).then(r => r.ok, () => false);
    if (!ok) { get().showToast('Your notifications could not be marked read. Try again.', 'info'); return; }
    notificationsAttempt++;
    set(({ notifications: n }) => {
      if (n.status !== 'loaded') return {};
      const marked = (id: string) => !ids || ids.includes(id);
      // Only the ones still unread lower the count: clicking a read notification marks nothing.
      const unread = ids ? Math.max(0, n.unread - n.items.filter(i => marked(i.id) && !i.read).length) : 0;
      return { notifications: { status: 'loaded', items: n.items.map(i => (marked(i.id) ? { ...i, read: true } : i)), unread } };
    });
  },
}));

// ========== AUTH HOOK ==========

/**
 * Where the reader stands: the session check on load, a wallet request in
 * flight, signed out, or signed in. A live session wins over a request still
 * settling, so the account shows as soon as the proof is accepted. `checking`
 * is not `signed-out`: a gate that waits for it does not tell a signed-in
 * reader to connect while their session is read.
 */
export type AuthStatus = 'checking' | 'connecting' | 'signed-out' | 'signed-in';

export const useAuth = () => {
  const session = useStore(s => s.session);
  const walletData = useStore(s => s.walletData);
  const pending = useStore(s => s.auth.kind);
  const isAuthenticated = !!session && new Date(session.expiresAt) > new Date();
  const status: AuthStatus = isAuthenticated ? 'signed-in' : pending === 'idle' ? 'signed-out' : pending;
  const user = useMemo(() => session ? {
    id: session.userId,
    radixAddress: session.radixAddress,
    personaAddress: session.personaAddress,
    displayName: session.displayName,
  } : null, [session]);
  return useMemo(() => ({ user, status, isAuthenticated, walletData }), [user, status, isAuthenticated, walletData]);
};
