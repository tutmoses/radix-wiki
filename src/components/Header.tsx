// src/components/Header.tsx

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, Loader2, LogOut, User, FileCode, Bell, Database, MoreVertical, Quote, Check, Eye, EyeOff, Settings, History, KeyRound, MessagesSquare, Wallet } from 'lucide-react';
import { RailToggle, SearchField, useCopy, useClickOutside } from 'wiki-formant/react';
import { useState, useEffect, useCallback } from 'react';
import { SESSION_UNREADABLE, useStore, useAuth, usePagePath, useFetch, useWikiPathname } from '@/hooks';
import { ROOM_PATH } from '@/lib/trollbox';
import { cn, shortenAddress, pagePath } from '@/lib/utils';
import { SITE_NAME } from '@/lib/site';
import { AGO, useNow } from '@/lib/now';
import { isoDate, relativeTime } from 'wiki-formant/freshness';
import type { PageSummary } from '@/lib/wiki';
import { EmptyState, Highlight } from 'wiki-formant/react-server';
import { Button, Dropdown } from '@/components/ui';
import { SignInOptions } from '@/components/SignIn';
import { UserAvatar } from '@/components/UserAvatar';
import type { WikiNotification } from '@/types';
import { useTelegram } from '@/components/WebhookSettings';
import { LedgerDropdown, backupStanding, useLedgerBackup, type BackupStanding, type LedgerStatus } from '@/components/LedgerBackupView';

// Edit is not here: it sits beside the breadcrumb (`PageActions`). History is
// the view's to offer (`useHistoryLink`).
function usePageContext() {
  const { isHomepage, isPage, sectionPath, isEdit, isHistory, tagPath, slug } = usePagePath();
  const { isAuthenticated } = useAuth();
  const mdxPath = (isHomepage || isPage) ? (isHomepage ? '/api/wiki/mdx' : `/api/wiki/${tagPath}/${slug}/mdx`) : null;

  return {
    // On a category the menu holds one item, Watch, so it is there for signed-in readers only.
    hasTools: ((isHomepage || isPage) && !isHistory) || (!!sectionPath && isAuthenticated),
    hasLedger: isHomepage || isPage,
    sectionPath,
    canExportMdx: (isHomepage || isPage) && !isEdit && !isHistory,
    isPage,
    mdxPath,
    tagPath,
    slug,
  };
}

function notificationText(n: WikiNotification): string {
  const actor = n.actor.displayName || 'Someone';
  const title = n.page?.title ?? '';
  // A line in a card's room names the card; one in the wiki's own room, the trollbox.
  const where = n.page ? `on "${title}"` : 'in the trollbox';
  if (n.type === 'chat_mention') return `${actor} mentioned you ${where}`;
  if (n.type === 'chat_reply') return `${actor} replied to you ${where}`;
  switch (n.type) {
    case 'page_edited': return `${actor} edited "${title}"`;
    // A row written by another deploy can carry a type this one does not know.
    default: return `New activity from ${actor} on "${title}"`;
  }
}

// The bell carries notifications and nothing else; their settings are /settings.
function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const now = useNow();
  const router = useRouter();
  const notifications = useStore(s => s.notifications);
  const fetchNotifications = useStore(s => s.fetchNotifications);
  const markNotificationsRead = useStore(s => s.markNotificationsRead);

  if (notifications.status !== 'loaded') {
    return (
      <Dropdown className="notification-dropdown">
        {notifications.status === 'loading'
          ? <div className="center p-4"><Loader2 size={16} className="animate-spin text-text-muted" /></div>
          : <EmptyState title="Your notifications could not be loaded." action={<Button variant="ghost" size="sm" onClick={() => fetchNotifications()}>Try again</Button>} />}
      </Dropdown>
    );
  }

  return (
    <Dropdown className="notification-dropdown">
      {notifications.unread > 0 && (
        <div className="notification-header">
          <span />
          <button onClick={() => markNotificationsRead()} className="notification-mark-read">Mark all read</button>
        </div>
      )}
      {notifications.items.length === 0 ? (
        <EmptyState title="No notifications yet." />
      ) : (
        <div className="notification-list">
          {notifications.items.map(n => (
            <button key={n.id} className={cn('notification-item', !n.read && 'notification-unread')}
              onClick={() => {
                markNotificationsRead([n.id]);
                // One from the trollbox opens the room at its line; any other, its page, a card's room included.
                if (n.page) router.push(pagePath(n.page.tagPath, n.page.slug));
                else if (n.chatMessageId) useStore.setState({ chatOpen: true, chatLine: n.chatMessageId });
                onClose();
              }}>
              <UserAvatar seed={n.actor.id} avatarUrl={n.actor.avatarUrl} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-small truncate">{notificationText(n)}</div>
                <div className="text-xs text-text-muted">{relativeTime(n.createdAt, now, AGO)}</div>
              </div>
              {!n.read && <span className="notification-dot" />}
            </button>
          ))}
        </div>
      )}
    </Dropdown>
  );
}

/** One menu for the account: who is signed in, their profile, their notification settings, their ways in, the ways out. */
function AccountMenu({ name, hasWallet, profilePath, onClose, onLogout }: { name: string; hasWallet: boolean; profilePath: string | null; onClose: () => void; onLogout: (everywhere?: boolean) => void }) {
  const connect = useStore(s => s.connect);
  const passkey = useStore(s => s.passkey);
  const showToast = useStore(s => s.showToast);
  return (
    <Dropdown>
      <div className="dropdown-header">{name}</div>
      {profilePath && <Link href={profilePath} className="dropdown-item" onClick={onClose}><User size={16} />Profile</Link>}
      <Link href="/settings" className="dropdown-item" onClick={onClose}><Settings size={16} />Notification settings</Link>
      {!hasWallet && <button className="dropdown-item" onClick={() => { onClose(); connect(); }}><Wallet size={16} />Connect a wallet</button>}
      <button className="dropdown-item" onClick={async () => { onClose(); if (await passkey('register')) showToast('Passkey saved. It signs this account in on this device.'); }}>
        <KeyRound size={16} />Save a passkey
      </button>
      <button onClick={() => { onClose(); onLogout(); }} className="dropdown-item text-error hover:text-error/80">
        <LogOut size={16} />{hasWallet ? 'Disconnect' : 'Sign out'}
      </button>
      <button
        onClick={() => { onClose(); if (confirm('Sign out every browser and agent signed in with this account?')) onLogout(true); }}
        className="dropdown-item text-error hover:text-error/80"
      >
        <LogOut size={16} />Sign out everywhere
      </button>
    </Dropdown>
  );
}

// ===== Search =====
// The snippet is the passage the query matched (computed server-side by the
// shared summarizer), so a body-text hit doesn't read as an unrelated title.
const pageHref = (page: PageSummary) => pagePath(page.tagPath, page.slug);
const searchRow = (page: PageSummary, query: string) => (
  <>
    <div className="font-medium truncate"><Highlight text={page.title} query={query} /></div>
    <div className="subtext truncate">{pageHref(page)}</div>
    {page.snippet && <p className="subtext line-clamp-1 mt-0.5"><Highlight text={page.snippet} query={query} lead={24} /></p>}
  </>
);

// Module scope, so the reference is stable: `useTypeahead` runs it from an
// effect, and an inline arrow would re-search on every render. A refusal (a 429,
// say) rejects, which the typeahead does not cache as the query's answer.
async function searchPages(q: string, signal: AbortSignal): Promise<PageSummary[]> {
  const res = await fetch(`/api/wiki?${new URLSearchParams({ q, pageSize: '5' })}`, { signal });
  if (!res.ok) throw new Error(res.statusText || `Failed (${res.status})`);
  return (await res.json()).items || [];
}

// ===== Page tools =====
// One home for page-scoped actions (Wikipedia's Tools menu): watch, export,
// cite, ledger backup – instead of a row of header icons. History has its own
// icon beside it; Edit sits beside the breadcrumb.
function PageToolsDropdown({ onClose, mdxPath, tagPath, slug, isPage, sectionPath, ledgerColor, onOpenLedger }: {
  onClose: () => void; mdxPath: string | null;
  tagPath?: string; slug?: string; isPage: boolean;
  /** Set on a category page: Watch then watches the whole section. */
  sectionPath: string | null;
  ledgerColor: string | null; onOpenLedger: (() => void) | null;
}) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const showToast = useStore(s => s.showToast);
  const pageTitle = useStore(s => s.pageTitle);
  // `useCopy` from `wiki-formant/react`.
  const { copied, copy } = useCopy(1500);
  // What Watch watches: this page, or on a category page the whole section.
  // Which events each gets is the API's `subscriptionEvents`.
  const target = isPage && tagPath && slug
    ? { tagPath, slug, noun: 'page' }
    : sectionPath ? { tagPath: sectionPath, slug: '', noun: 'section' } : null;
  // The same `/api/telegram` client /settings uses, asked only when there is
  // something to watch and someone to watch it with.
  const { telegram, paused, subscribe, unsubscribe } = useTelegram(isAuthenticated && !!target);
  const [watchBusy, setWatchBusy] = useState(false);

  const watching = (target && telegram.status === 'ready' && telegram.subscriptions.find(s => s.tagPath === target.tagPath && s.pageSlug === target.slug)) || null;
  // Paused by the bot's /stop: Watch then resumes every subscription, this one included.
  const live = !!watching && !paused;

  const pageUrl = () => `${window.location.origin}${pagePath(tagPath ?? '', slug ?? '')}`;

  const toggleWatch = async () => {
    if (!target || telegram.status === 'loading' || watchBusy) return;
    if (telegram.status === 'failed') { showToast('Your Telegram settings could not be loaded. Reload to try again.', 'error'); return; }
    // Telegram is connected on /settings, which then offers this page or section.
    if (!telegram.connected) { onClose(); router.push(`/settings?watch=${encodeURIComponent(pagePath(target.tagPath, target.slug).slice(1))}`); return; }
    setWatchBusy(true);
    try {
      if (live) {
        if (await unsubscribe(watching.id)) showToast(`No longer watching this ${target.noun}`);
        else showToast(`This ${target.noun} could not be unwatched. Try again.`, 'error');
      } else if (await subscribe(target.tagPath, target.slug || null)) {
        showToast(paused ? `Watching this ${target.noun}; notifications resumed` : `Watching this ${target.noun}`);
      } else showToast(`This ${target.noun} could not be watched. Try again.`, 'error');
    } finally { setWatchBusy(false); }
  };

  const title = isPage && slug ? pageTitle ?? slug.replace(/-/g, ' ') : SITE_NAME;

  return (
    <Dropdown>
      {isAuthenticated && target && (
        <button className="dropdown-item" onClick={toggleWatch} disabled={watchBusy || telegram.status === 'loading'}>
          {live ? <EyeOff size={16} /> : <Eye size={16} />}
          {live ? `Unwatch this ${target.noun}` : watching ? `Resume watching this ${target.noun}` : `Watch this ${target.noun}`}
        </button>
      )}
      {mdxPath && <a href={mdxPath} className="dropdown-item" download onClick={onClose}><FileCode size={16} />Download MDX</a>}
      {/* The citation ends in the page's URL, so it is the copy-link item too. */}
      {isPage && (
        <button className="dropdown-item" onClick={() => copy(`"${title}." RADIX Wiki. Retrieved ${isoDate(new Date())}. ${pageUrl()}`)}>
          {copied ? <Check size={16} /> : <Quote size={16} />}Cite this page
        </button>
      )}
      {onOpenLedger && (
        <button className="dropdown-item" onClick={onOpenLedger}>
          <Database size={16} className={ledgerColor ?? undefined} />Ledger backup
        </button>
      )}
    </Dropdown>
  );
}

const LEDGER_COLOR: Record<BackupStanding, string | null> = { unknown: null, none: 'text-error', stale: 'text-warning', current: 'text-success' };

/** The header menus: at most one is open, so opening one closes the other. */
type Menu = 'tools' | 'ledger' | 'notifications' | 'account' | 'signin' | null;

/**
 * One open menu for the header's actions row. A click outside the row or Escape
 * closes it; the row holds every menu's button, so a button's own click toggles
 * its menu, and another's switches to that one.
 */
function useHeaderMenu() {
  const [menu, setMenu] = useState<Menu>(null);
  const close = useCallback(() => setMenu(null), []);
  const ref = useClickOutside<HTMLDivElement>(close);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menu, close]);
  const toggle = (m: Exclude<Menu, null>) => setMenu(cur => (cur === m ? null : m));
  return { menu, open: setMenu, close, toggle, ref };
}

export function Header() {
  const router = useRouter();
  const { status: authStatus, isAuthenticated, user, walletData } = useAuth();
  const logout = useStore(s => s.logout);
  const fetchNotifications = useStore(s => s.fetchNotifications);
  // A count, or the read in flight or failed: a failed read is never shown as nothing unread.
  const bell = useStore(s => (s.notifications.status === 'loaded' ? s.notifications.unread : s.notifications.status));
  const historyHref = useStore(s => s.historyHref);
  const chatOpen = useStore(s => s.chatOpen);
  const chatUnread = useStore(s => s.chatUnread);
  const toggleChat = useStore(s => s.toggleChat);
  const pathname = useWikiPathname();
  const { hasTools, hasLedger, sectionPath, canExportMdx, isPage, mdxPath, tagPath, slug } = usePageContext();
  const { menu, open: openMenu, close: closeMenu, toggle: toggleMenu, ref: actionsRef } = useHeaderMenu();

  // The ledger backup status: the tools item's colour, and the ledger menu's status row.
  const accountAddress = user?.radixAddress ?? null;
  const ledgerStatusUrl = accountAddress && tagPath && slug
    ? `/api/ledger/status?address=${accountAddress}&tagPath=${encodeURIComponent(tagPath)}&slug=${encodeURIComponent(slug)}`
    : accountAddress ? `/api/ledger/status?address=${accountAddress}` : null;
  const ledgerStatus = useFetch<LedgerStatus>(ledgerStatusUrl);
  // A backup made from the menu, which outlives the menu, so the colour reads it too.
  const ledgerBackup = useLedgerBackup(accountAddress, tagPath ?? null, slug ?? null);

  const displayName = user?.displayName || walletData?.persona?.label ||
    (walletData?.accounts?.[0]?.address ? shortenAddress(walletData.accounts[0].address) : null) ||
    (user?.radixAddress ? shortenAddress(user.radixAddress) : 'Connected');

  // The leaderboard lists editors, and editing needs a wallet.
  const userProfilePath = user?.radixAddress ? `/leaderboard#u-${user.id}` : null;

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    const onFocus = () => fetchNotifications();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [isAuthenticated, fetchNotifications]);

  const handleLogout = async (everywhere?: boolean) => {
    closeMenu();
    await logout(everywhere);
  };

  return (
    <>
      <RailToggle />

      <Link href="/" className="row shrink-0">
        <Image src="/logo.png" alt={SITE_NAME} width={240} height={240} className="size-8 object-contain" priority />
        <span className="logo-text">{SITE_NAME}</span>
      </Link>

      {/* One field for both breakpoints, a magnifier until opened: inline in the
          bar above `sm`, its own row below it. */}
      <SearchField
        fetch={searchPages}
        action="/search"
        hrefOf={pageHref}
        renderRow={searchRow}
        navigate={href => router.push(href)}
        label="Search the wiki"
        placeholder="Search the wiki..."
        icon={<Search size={20} />}
        before={<Search className="search-icon-left" size={18} />}
        spinner={<Loader2 className="search-icon-right" size={18} />}
        classNames={{
          root: 'header-search',
          input: 'input pl-10',
          toggle: 'icon-btn text-inherit',
          list: 'search-results',
          item: 'search-result',
          itemActive: 'search-result-active',
          all: 'search-result search-result-all',
          note: 'search-empty',
        }}
        all={q => <>See all results for &ldquo;{q}&rdquo;</>}
        empty={q => <>No pages found for &ldquo;{q}&rdquo;</>}
        failed="Search did not answer. Press Enter for the full results page."
      />

      <div ref={actionsRef} className="header-actions">
        {historyHref && (
          <Link href={historyHref} prefetch={false} onClick={closeMenu} className="icon-btn text-inherit" title="History" aria-label="History"><History size={20} /></Link>
        )}

        {hasTools && (
          <div className="relative">
            <button onClick={() => toggleMenu('tools')} className="icon-btn" title="Page tools" aria-label="Page tools" aria-expanded={menu === 'tools' || menu === 'ledger'}>
              <MoreVertical size={20} />
            </button>
            {menu === 'tools' && (
              <PageToolsDropdown
                onClose={closeMenu}
                mdxPath={canExportMdx ? mdxPath : null}
                tagPath={tagPath ?? undefined} slug={slug ?? undefined} isPage={isPage} sectionPath={sectionPath}
                ledgerColor={LEDGER_COLOR[backupStanding(ledgerStatus, slug ?? null, ledgerBackup)]}
                onOpenLedger={isAuthenticated && hasLedger ? () => openMenu('ledger') : null}
              />
            )}
            {menu === 'ledger' && <LedgerDropdown tagPath={tagPath ?? null} slug={slug ?? null} status={ledgerStatus} />}
          </div>
        )}

        {/* On the room's own page the room is on screen, and there is nothing for the button to open. */}
        {pathname !== ROOM_PATH && (
          <button onClick={() => { closeMenu(); toggleChat(); }} className="icon-btn relative" title="Trollbox" aria-label="Trollbox" aria-expanded={chatOpen}>
            <MessagesSquare size={20} />
            {chatUnread && !chatOpen && <span className="trollbox-unread" title="New lines in the trollbox" />}
          </button>
        )}

        {isAuthenticated && (
          <div className="relative">
            <button onClick={() => toggleMenu('notifications')} className="icon-btn" title="Notifications" aria-label="Notifications" aria-expanded={menu === 'notifications'}>
              <Bell size={20} />
              {bell === 'failed'
                ? <span className="notification-badge notification-badge-failed" title="Your notifications could not be loaded">!</span>
                : typeof bell === 'number' && bell > 0 && <span className="notification-badge">{bell > 9 ? '9+' : bell}</span>}
            </button>
            {menu === 'notifications' && <NotificationDropdown onClose={closeMenu} />}
          </div>
        )}

        <div id="radix-connect-btn" className="relative">
          {authStatus === 'checking' || authStatus === 'connecting' ? (
            <div className="user-pill"><Loader2 size={14} className="animate-spin" /><span className="hidden sm:inline">Connecting...</span></div>
          ) : authStatus === 'signed-in' ? (
            <>
              <button onClick={() => toggleMenu('account')} className="icon-btn" title={displayName} aria-expanded={menu === 'account'} aria-label="Account menu">
                <UserAvatar seed={user?.id || walletData?.accounts?.[0]?.address || ''} size="md" />
              </button>
              {menu === 'account' && <AccountMenu name={displayName} hasWallet={!!user?.radixAddress} profilePath={userProfilePath} onClose={closeMenu} onLogout={handleLogout} />}
            </>
          ) : (
            <>
              <Button variant="primary" size="sm" onClick={() => toggleMenu('signin')} aria-expanded={menu === 'signin'} title={authStatus === 'unreadable' ? SESSION_UNREADABLE : undefined}>
                Sign in
              </Button>
              {menu === 'signin' && <Dropdown className="signin-menu"><SignInOptions onDone={closeMenu} /></Dropdown>}
            </>
          )}
        </div>
      </div>
    </>
  );
}
