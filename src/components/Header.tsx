// src/components/Header.tsx

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { Search, Menu, X, Loader2, LogOut, ChevronDown, Edit, History, User, FileCode, Bell, Webhook, Database, MoreVertical, Quote, Link2, Check, Eye, EyeOff } from 'lucide-react';
import { useCopy, useSidebar, useTypeahead } from 'wiki-formant/react';
import type { ComboboxOptionProps } from 'wiki-formant/combobox';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore, useAuth, useClickOutside, usePagePath, useFetch } from '@/hooks';
import { cn, shortenAddress, formatRelativeTime, pagePath } from '@/lib/utils';
import type { PageSummary } from '@/lib/wiki';
import Highlight from '@/components/Highlight';
import { Button, Dropdown } from '@/components/ui';
import { UserAvatar } from '@/components/UserAvatar';
import type { WikiPage, WikiNotification } from '@/types';
import type { LedgerAnchor } from '@/lib/radix/ledger';
import { WebhookSettings, useTelegram } from '@/components/WebhookSettings';
import { LedgerDropdown } from '@/components/LedgerBackupView';

function usePageContext() {
  const { isHomepage, isPage, isEdit, isHistory, viewPath, tagPath, slug } = usePagePath();
  const { isAuthenticated } = useAuth();
  const mdxPath = (isHomepage || isPage) ? (isHomepage ? '/api/wiki/mdx' : `/api/wiki/${tagPath}/${slug}/mdx`) : null;

  return {
    canEdit: isAuthenticated && (isHomepage || isPage) && !isEdit && !isHistory,
    canShowHistory: (isHomepage || isPage) && !isHistory,
    canExportMdx: (isHomepage || isPage) && !isEdit && !isHistory,
    isPage,
    editPath: isHomepage ? '/edit' : `${viewPath}/edit`,
    historyPath: (isHomepage || isPage) ? (isHomepage ? '/history' : `${viewPath}/history`) : null,
    mdxPath,
    tagPath,
    slug,
  };
}

function notificationText(n: WikiNotification): string {
  const actor = n.actor.displayName || 'Someone';
  if (n.type === 'comment_on_page') return `${actor} commented on "${n.page.title}"`;
  if (n.type === 'comment_reply') return `${actor} replied to your comment on "${n.page.title}"`;
  return `${actor} edited "${n.page.title}"`;
}

function NotificationDropdown({ onClose, initialTab }: { onClose: () => void; initialTab?: 'notifications' | 'webhooks' }) {
  const router = useRouter();
  const notifications = useStore(s => s.notifications);
  const markNotificationsRead = useStore(s => s.markNotificationsRead);
  const unreadCount = useStore(s => s.unreadCount);
  const [tab, setTab] = useState<'notifications' | 'webhooks'>(initialTab ?? 'notifications');

  return (
    <Dropdown onClose={onClose} className="notification-dropdown">
      <div className="notification-tabs">
        <button onClick={() => setTab('notifications')} className={cn('notification-tab', tab === 'notifications' && 'notification-tab-active')}>
          <Bell size={14} />Notifications
          {unreadCount > 0 && <span className="notification-badge-inline">{unreadCount}</span>}
        </button>
        <button onClick={() => setTab('webhooks')} className={cn('notification-tab', tab === 'webhooks' && 'notification-tab-active')}>
          <Webhook size={14} />Webhooks
        </button>
      </div>

      {tab === 'notifications' ? (
        <>
          {unreadCount > 0 && (
            <div className="notification-header">
              <span />
              <button onClick={() => markNotificationsRead()} className="notification-mark-read">Mark all read</button>
            </div>
          )}
          {notifications.length === 0 ? (
            <div className="notification-empty">No notifications yet</div>
          ) : (
            <div className="notification-list">
              {notifications.map(n => (
                <button key={n.id} className={cn('notification-item', !n.read && 'notification-unread')}
                  onClick={() => { markNotificationsRead([n.id]); router.push(pagePath(n.page.tagPath, n.page.slug)); onClose(); }}>
                  <UserAvatar seed={n.actor.id} avatarUrl={n.actor.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="text-small truncate">{notificationText(n)}</div>
                    <div className="text-xs text-text-muted">{formatRelativeTime(n.createdAt)}</div>
                  </div>
                  {!n.read && <span className="notification-dot" />}
                </button>
              ))}
            </div>
          )}
        </>
      ) : (
        <WebhookSettings />
      )}
    </Dropdown>
  );
}

function UserMenuDropdown({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  return (
    <Dropdown onClose={onClose}>
      <button onClick={() => { onClose(); onLogout(); }} className="dropdown-item text-error hover:text-error/80">
        <LogOut size={16} />Disconnect
      </button>
    </Dropdown>
  );
}

// ===== Search =====
// The snippet is the passage the query matched (computed server-side by the
// shared summarizer), so a body-text hit doesn't read as an unrelated title.
function SearchResultRow({ page, query, active, onSelect, onHover, optionProps }: {
  page: PageSummary; query: string; active?: boolean; onSelect: (page: PageSummary) => void; onHover?: () => void;
  optionProps: ComboboxOptionProps;
}) {
  return (
    // The row used to carry a bare `aria-selected`, which is not an attribute a
    // plain button takes. The listbox contract is `wiki-formant/combobox` now.
    <button type="button" onClick={() => onSelect(page)} onMouseEnter={onHover}
      className={cn('search-result', active && 'search-result-active')} {...optionProps}>
      <div className="font-medium truncate"><Highlight text={page.title} query={query} /></div>
      <div className="text-small text-text-muted truncate">{pagePath(page.tagPath, page.slug)}</div>
      {page.snippet && <p className="text-small text-text-muted line-clamp-1 mt-0.5"><Highlight text={page.snippet} query={query} /></p>}
    </button>
  );
}

// Module scope, so the reference is stable: `useTypeahead` runs it from an
// effect, and an inline arrow would re-search on every render.
async function searchPages(q: string, signal: AbortSignal): Promise<PageSummary[]> {
  const res = await fetch(`/api/wiki?${new URLSearchParams({ q, pageSize: '5' })}`, { signal });
  if (!res.ok) return [];
  return (await res.json()).items || [];
}

// ===== Page tools =====
// One home for page-scoped actions (Wikipedia's Tools menu): history, export,
// cite/permalink, watch, ledger backup — instead of a row of header icons.
function PageToolsDropdown({ onClose, historyPath, mdxPath, tagPath, slug, isPage, ledgerColor, onOpenLedger, onConnectTelegram }: {
  onClose: () => void; historyPath: string | null; mdxPath: string | null;
  tagPath?: string; slug?: string; isPage: boolean;
  ledgerColor: string | null; onOpenLedger: (() => void) | null; onConnectTelegram: () => void;
}) {
  const { isAuthenticated } = useAuth();
  const showToast = useStore(s => s.showToast);
  // `useCopy` from `wiki-formant/react`, keyed: two copyable things, one indicator.
  const { copied, copy: copyText } = useCopy<'cite' | 'link'>(1500);
  // The same `/api/telegram` client the settings panel uses, asked only when
  // there is a page to watch and someone to watch it with.
  const { state: telegram, subscribe, unsubscribe } = useTelegram(isAuthenticated && isPage);
  const [watchBusy, setWatchBusy] = useState(false);

  const watching = telegram?.subscriptions.find(s => s.tagPath === tagPath && s.pageSlug === slug) ?? null;

  const pageUrl = () => `${window.location.origin}/${tagPath}/${slug}`;
  const copy = async (kind: 'cite' | 'link', text: string) => {
    await copyText(text, kind);
  };

  const toggleWatch = async () => {
    if (!telegram || watchBusy) return;
    if (!telegram.connected) { onClose(); onConnectTelegram(); return; }
    setWatchBusy(true);
    try {
      if (watching) { if (await unsubscribe(watching.id)) showToast('No longer watching this page'); }
      else if (tagPath && await subscribe(tagPath, slug ?? null, ['page.updated', 'comment.created'])) showToast('Watching this page');
    } finally { setWatchBusy(false); }
  };

  const title = isPage && slug ? slug.replace(/-/g, ' ') : 'RADIX Wiki';

  return (
    <Dropdown onClose={onClose}>
      {isAuthenticated && isPage && (
        <button className="dropdown-item" onClick={toggleWatch} disabled={watchBusy}>
          {watching ? <EyeOff size={16} /> : <Eye size={16} />}
          {watching ? 'Unwatch this page' : 'Watch this page'}
        </button>
      )}
      {historyPath && <Link href={historyPath} className="dropdown-item" onClick={onClose}><History size={16} />Page history</Link>}
      {mdxPath && <a href={mdxPath} className="dropdown-item" download onClick={onClose}><FileCode size={16} />Download MDX</a>}
      {isPage && (
        <>
          <button className="dropdown-item" onClick={() => copy('cite', `"${title}." RADIX Wiki. Retrieved ${new Date().toISOString().slice(0, 10)}. ${pageUrl()}`)}>
            {copied === 'cite' ? <Check size={16} /> : <Quote size={16} />}Cite this page
          </button>
          <button className="dropdown-item" onClick={() => copy('link', pageUrl())}>
            {copied === 'link' ? <Check size={16} /> : <Link2 size={16} />}Permalink
          </button>
        </>
      )}
      {onOpenLedger && (
        <button className="dropdown-item" onClick={() => { onClose(); onOpenLedger(); }}>
          <Database size={16} className={ledgerColor ?? undefined} />Ledger backup
        </button>
      )}
    </Dropdown>
  );
}

export function Header() {
  const router = useRouter();
  const { isAuthenticated, user, walletData } = useAuth();
  const isConnected = useStore(s => s.isConnected);
  const isLoading = useStore(s => s.isLoading);
  const rdtReady = useStore(s => s.rdtReady);
  const logout = useStore(s => s.logout);
  const connect = useStore(s => s.connect);
  // Shared with the rail through wiki-formant's SidebarProvider.
  const { open: sidebarOpen, toggle: toggleSidebar } = useSidebar();
  const isConnecting = useStore(s => s.isConnecting);
  const fetchNotifications = useStore(s => s.fetchNotifications);
  const unreadCount = useStore(s => s.unreadCount);
  const { canEdit, canShowHistory, canExportMdx, isPage, editPath, historyPath, mdxPath, tagPath, slug } = usePageContext();
  const [showSearch, setShowSearch] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationsTab, setNotificationsTab] = useState<'notifications' | 'webhooks'>('notifications');
  const [showLedger, setShowLedger] = useState(false);
  const [showTools, setShowTools] = useState(false);

  // Ledger backup status for icon color
  const accountAddress = user?.radixAddress ?? null;
  const ledgerStatusUrl = accountAddress && tagPath && slug
    ? `/api/ledger/status?address=${accountAddress}&tagPath=${encodeURIComponent(tagPath)}&slug=${encodeURIComponent(slug)}`
    : accountAddress ? `/api/ledger/status?address=${accountAddress}` : null;
  const { data: ledgerStatus } = useFetch<{ anchor: LedgerAnchor | null; currentPageVersion: string | null }>(ledgerStatusUrl);

  const ledgerIconColor = (() => {
    if (!ledgerStatus?.anchor) return 'text-error';
    if (ledgerStatus.anchor.slug === slug && ledgerStatus.anchor.pageVersion === ledgerStatus.currentPageVersion) return 'text-success';
    if (ledgerStatus.anchor.slug === slug) return 'text-warning';
    return 'text-error';
  })();

  const [searchOpen, setSearchOpen] = useState(false);
  // The search field's state machine is `wiki-formant/react`, shared with the
  // other wikis. This surface had no keyboard navigation at all and no guard
  // against an older response landing after a newer one — on a wiki whose
  // search IS its primary navigation.
  const {
    query: searchQuery,
    setQuery: setSearchQuery,
    items: searchResults,
    highlight,
    setHighlight,
    isSearching,
    onKeyDown: onSearchKeyDown,
    clearItems,
    reset: resetSearch,
    combobox,
  } = useTypeahead<PageSummary>({
    fetch: searchPages,
    onPick: page => handleSearchSelect(page),
    onEscape: () => { setSearchOpen(false); setShowSearch(false); },
  });
  // `searchOpen` is passed because the hook keeps its results when the dropdown
  // closes, and an aria-activedescendant pointing into a list that is not
  // rendered is worse than none.
  const searchCombobox = combobox(undefined, searchOpen);
  const clearSearchResults = useCallback(() => { clearItems(); setSearchOpen(false); }, [clearItems]);
  const searchRef = useClickOutside<HTMLFormElement>(clearSearchResults);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const goToSearchPage = useCallback(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    clearItems();
    setSearchOpen(false);
    setShowSearch(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }, [searchQuery, router, clearItems]);

  // "/" focuses search from anywhere (Wikipedia-style), unless already typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      e.preventDefault();
      // Below `sm` the one field is hidden until the toggle reveals it, and an
      // `offsetParent` of null is how that reads from here.
      const input = searchInputRef.current;
      if (input?.offsetParent) input.focus();
      else setShowSearch(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const displayName = user?.displayName || walletData?.persona?.label ||
    (walletData?.accounts?.[0]?.address ? shortenAddress(walletData.accounts[0].address) : null) ||
    (user?.radixAddress ? shortenAddress(user.radixAddress) : 'Connected');

  const showAsConnected = isAuthenticated;
  const userProfilePath = user ? `/leaderboard#u-${user.id}` : null;

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    const onFocus = () => fetchNotifications();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(interval); window.removeEventListener('focus', onFocus); };
  }, [isAuthenticated, fetchNotifications]);

  useEffect(() => {
    if (showSearch && searchInputRef.current) searchInputRef.current.focus();
  }, [showSearch]);

  // A declaration, not a const: `onPick` above is wired before this point.
  function handleSearchSelect(page: PageSummary) {
    resetSearch();
    setSearchOpen(false);
    setShowSearch(false);
    router.push(pagePath(page.tagPath, page.slug));
  }

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
  };

  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-bar">
          <button onClick={toggleSidebar} className="icon-btn" title={sidebarOpen ? 'Close menu' : 'Open menu'} aria-label="Toggle menu" aria-expanded={sidebarOpen}>
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <Link href="/" className="row shrink-0">
            <Image src="/logo.png" alt="RADIX Wiki" width={240} height={240} className="size-8 object-contain" priority />
            <span className="logo-text">RADIX Wiki</span>
          </Link>

          {/* One field for both breakpoints: shown inline above `sm`, revealed by
              the toggle below it. The two copies had drifted, and the desktop one
              was the broken half — it nested `.search-empty` (itself absolutely
              placed) inside `.search-results`, which is `overflow-hidden`, so
              "No pages found" was clipped to a bordered 2px strip. */}
          <form ref={searchRef} className={cn('header-search', showSearch && 'header-search-open')}
            onSubmit={e => { e.preventDefault(); goToSearchPage(); }}>
            <Search className="search-icon-left" size={18} />
            <input ref={searchInputRef} type="search" placeholder="Search the wiki..." className="input pl-10" value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onKeyDown={onSearchKeyDown} {...searchCombobox.inputProps} />
            {isSearching && <Loader2 className="search-icon-right" size={18} />}
            {searchOpen && searchResults.length > 0 && (
              <div className="search-results" {...searchCombobox.listProps}>
                {searchResults.map((page, i) => (
                  <SearchResultRow key={page.url} page={page} query={searchQuery.trim()} active={i === highlight}
                    onHover={() => setHighlight(i)} onSelect={handleSearchSelect}
                    optionProps={searchCombobox.optionProps(i)} />
                ))}
                <button type="button" onClick={goToSearchPage} className="search-result search-result-all">
                  See all results for &ldquo;{searchQuery.trim()}&rdquo;
                </button>
              </div>
            )}
            {searchOpen && searchQuery.trim() && !isSearching && searchResults.length === 0 && (
              <div className="search-empty">No pages found for &ldquo;{searchQuery.trim()}&rdquo;</div>
            )}
          </form>

          <div className="header-actions">
            <button onClick={() => setShowSearch(!showSearch)} className="icon-btn sm:hidden" title="Search" aria-label="Search" aria-expanded={showSearch}><Search size={20} /></button>

            {canEdit && <Link href={editPath} className="icon-btn" title="Edit page" aria-label="Edit page"><Edit size={20} /></Link>}

            {(canShowHistory || canExportMdx) && (
              <div className="relative">
                <button onClick={() => setShowTools(!showTools)} className="icon-btn" title="Page tools" aria-label="Page tools" aria-expanded={showTools}>
                  <MoreVertical size={20} />
                </button>
                {showTools && (
                  <PageToolsDropdown
                    onClose={() => setShowTools(false)}
                    historyPath={canShowHistory ? historyPath : null}
                    mdxPath={canExportMdx ? mdxPath : null}
                    tagPath={tagPath ?? undefined} slug={slug ?? undefined} isPage={isPage}
                    ledgerColor={isAuthenticated ? ledgerIconColor : null}
                    onOpenLedger={isAuthenticated ? () => setShowLedger(true) : null}
                    onConnectTelegram={() => { setNotificationsTab('webhooks'); setShowNotifications(true); }}
                  />
                )}
                {showLedger && <LedgerDropdown onClose={() => setShowLedger(false)} tagPath={tagPath ?? null} slug={slug ?? null} />}
              </div>
            )}

            {isAuthenticated && userProfilePath && <Link href={userProfilePath} className="icon-btn" title="Your profile" aria-label="Your profile"><User size={20} /></Link>}

            {isAuthenticated && (
              <div className="relative">
                <button onClick={() => { setNotificationsTab('notifications'); setShowNotifications(!showNotifications); }} className="icon-btn" title="Notifications" aria-label="Notifications" aria-expanded={showNotifications}>
                  <Bell size={20} />
                  {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </button>
                {showNotifications && <NotificationDropdown onClose={() => setShowNotifications(false)} initialTab={notificationsTab} />}
              </div>
            )}

            <div id="radix-connect-btn" className="relative">
              {isLoading || isConnecting ? (
                <div className="user-pill"><Loader2 size={14} className="animate-spin" /><span className="hidden sm:inline">Connecting...</span></div>
              ) : showAsConnected ? (
                <>
                  <button onClick={() => setShowUserMenu(!showUserMenu)} className="user-pill" aria-expanded={showUserMenu} aria-label="User menu">
                    <UserAvatar seed={user?.id || walletData?.accounts?.[0]?.address || ''} size="sm" />
                    <span className="font-medium hidden sm:inline">{displayName}</span>
                    <ChevronDown size={14} className={cn('transition-transform', showUserMenu && 'rotate-180')} />
                  </button>
                  {showUserMenu && <UserMenuDropdown onClose={() => setShowUserMenu(false)} onLogout={handleLogout} />}
                </>
              ) : (
                <Button variant="primary" size="sm" onClick={connect}>
                  <span className="hidden sm:inline">Connect Wallet</span>
                  <span className="sm:hidden">Connect</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
