// src/components/Header.tsx

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, Menu, X, Loader2, LogOut, User, FileCode, Bell, Database, MoreVertical, Quote, Check, Eye, EyeOff, Settings } from 'lucide-react';
import { useCopy, useSidebar, useTypeahead, useClickOutside } from 'wiki-formant/react';
import type { ComboboxOptionProps } from 'wiki-formant/combobox';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore, useAuth, usePagePath, useFetch } from '@/hooks';
import { cn, shortenAddress, pagePath } from '@/lib/utils';
import { SITE_NAME } from '@/lib/site';
import { AGO, useNow } from '@/lib/now';
import { isoDate, relativeTime } from 'wiki-formant/freshness';
import type { PageSummary } from '@/lib/wiki';
import Highlight from '@/components/Highlight';
import { Button, Dropdown } from '@/components/ui';
import { UserAvatar } from '@/components/UserAvatar';
import type { WikiNotification } from '@/types';
import type { LedgerAnchor } from '@/lib/radix/ledger';
import { useTelegram } from '@/components/WebhookSettings';
import { EmptyState } from '@/components/EmptyState';
import { LedgerDropdown } from '@/components/LedgerBackupView';

// Edit and History are not here: they sit beside the breadcrumb (`PageActions`).
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
  if (n.type === 'comment_on_page') return `${actor} commented on "${n.page.title}"`;
  if (n.type === 'comment_reply') return `${actor} replied to your comment on "${n.page.title}"`;
  return `${actor} edited "${n.page.title}"`;
}

// The bell carries notifications and nothing else; their settings are /settings.
function NotificationDropdown({ onClose }: { onClose: () => void }) {
  const now = useNow();
  const router = useRouter();
  const notifications = useStore(s => s.notifications);
  const markNotificationsRead = useStore(s => s.markNotificationsRead);
  const unreadCount = useStore(s => s.unreadCount);

  return (
    <Dropdown onClose={onClose} className="notification-dropdown">
      {unreadCount > 0 && (
        <div className="notification-header">
          <span />
          <button onClick={() => markNotificationsRead()} className="notification-mark-read">Mark all read</button>
        </div>
      )}
      {notifications.length === 0 ? (
        <EmptyState title="No notifications yet." />
      ) : (
        <div className="notification-list">
          {notifications.map(n => (
            <button key={n.id} className={cn('notification-item', !n.read && 'notification-unread')}
              onClick={() => { markNotificationsRead([n.id]); router.push(pagePath(n.page.tagPath, n.page.slug)); onClose(); }}>
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

/** One menu for the account: who is connected, their profile, their notification settings, the ways out. */
function AccountMenu({ name, profilePath, onClose, onLogout }: { name: string; profilePath: string | null; onClose: () => void; onLogout: (everywhere?: boolean) => void }) {
  return (
    <Dropdown onClose={onClose}>
      <div className="dropdown-header">{name}</div>
      {profilePath && <Link href={profilePath} className="dropdown-item" onClick={onClose}><User size={16} />Profile</Link>}
      <Link href="/settings" className="dropdown-item" onClick={onClose}><Settings size={16} />Notification settings</Link>
      <button onClick={() => { onClose(); onLogout(); }} className="dropdown-item text-error hover:text-error/80">
        <LogOut size={16} />Disconnect
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
function SearchResultRow({ page, query, active, onSelect, onHover, optionProps }: {
  page: PageSummary; query: string; active?: boolean; onSelect: (page: PageSummary) => void; onHover?: () => void;
  optionProps: ComboboxOptionProps;
}) {
  return (
    // The listbox contract is `wiki-formant/combobox`.
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
// One home for page-scoped actions (Wikipedia's Tools menu): watch, export,
// cite, ledger backup – instead of a row of header icons. History and Edit sit
// beside the breadcrumb.
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
  // What Watch watches: this page, or on a category page the whole section,
  // which also wants `page.created` – without it a blog subscription never
  // delivered an issue.
  const target = isPage && tagPath && slug
    ? { tagPath, slug, noun: 'page', events: ['page.updated', 'comment.created'] }
    : sectionPath ? { tagPath: sectionPath, slug: '', noun: 'section', events: ['page.created', 'page.updated', 'comment.created'] } : null;
  // The same `/api/telegram` client /settings uses, asked only when there is
  // something to watch and someone to watch it with.
  const { state: telegram, subscribe, unsubscribe } = useTelegram(isAuthenticated && !!target);
  const [watchBusy, setWatchBusy] = useState(false);

  const watching = (target && telegram?.subscriptions.find(s => s.tagPath === target.tagPath && s.pageSlug === target.slug)) ?? null;

  const pageUrl = () => `${window.location.origin}/${tagPath}/${slug}`;

  const toggleWatch = async () => {
    if (!target || !telegram || watchBusy) return;
    // Telegram is connected on /settings, which then offers this page or section.
    if (!telegram.connected) { onClose(); router.push(`/settings?watch=${encodeURIComponent(pagePath(target.tagPath, target.slug).slice(1))}`); return; }
    setWatchBusy(true);
    try {
      if (watching) { if (await unsubscribe(watching.id)) showToast(`No longer watching this ${target.noun}`); }
      else if (await subscribe(target.tagPath, target.slug || null, target.events)) showToast(`Watching this ${target.noun}`);
    } finally { setWatchBusy(false); }
  };

  const title = isPage && slug ? pageTitle ?? slug.replace(/-/g, ' ') : SITE_NAME;

  return (
    <Dropdown onClose={onClose}>
      {isAuthenticated && target && (
        <button className="dropdown-item" onClick={toggleWatch} disabled={watchBusy}>
          {watching ? <EyeOff size={16} /> : <Eye size={16} />}
          {watching ? `Unwatch this ${target.noun}` : `Watch this ${target.noun}`}
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
  const isLoading = useStore(s => s.isLoading);
  const logout = useStore(s => s.logout);
  const connect = useStore(s => s.connect);
  // Shared with the rail through wiki-formant's SidebarProvider.
  const { open: sidebarOpen, toggle: toggleSidebar } = useSidebar();
  const isConnecting = useStore(s => s.isConnecting);
  const fetchNotifications = useStore(s => s.fetchNotifications);
  const unreadCount = useStore(s => s.unreadCount);
  const { hasTools, hasLedger, sectionPath, canExportMdx, isPage, mdxPath, tagPath, slug } = usePageContext();
  const [showSearch, setShowSearch] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
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

  const handleLogout = async (everywhere?: boolean) => {
    setShowUserMenu(false);
    await logout(everywhere);
  };

  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-bar">
          <button onClick={toggleSidebar} className="icon-btn" title={sidebarOpen ? 'Close menu' : 'Open menu'} aria-label="Toggle menu" aria-expanded={sidebarOpen}>
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <Link href="/" className="row shrink-0">
            <Image src="/logo.png" alt={SITE_NAME} width={240} height={240} className="size-8 object-contain" priority />
            <span className="logo-text">{SITE_NAME}</span>
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

            {hasTools && (
              <div className="relative">
                <button onClick={() => setShowTools(!showTools)} className="icon-btn" title="Page tools" aria-label="Page tools" aria-expanded={showTools}>
                  <MoreVertical size={20} />
                </button>
                {showTools && (
                  <PageToolsDropdown
                    onClose={() => setShowTools(false)}
                    mdxPath={canExportMdx ? mdxPath : null}
                    tagPath={tagPath ?? undefined} slug={slug ?? undefined} isPage={isPage} sectionPath={sectionPath}
                    ledgerColor={isAuthenticated ? ledgerIconColor : null}
                    onOpenLedger={isAuthenticated && hasLedger ? () => setShowLedger(true) : null}
                  />
                )}
                {showLedger && <LedgerDropdown onClose={() => setShowLedger(false)} tagPath={tagPath ?? null} slug={slug ?? null} />}
              </div>
            )}

            {isAuthenticated && (
              <div className="relative">
                <button onClick={() => setShowNotifications(!showNotifications)} className="icon-btn" title="Notifications" aria-label="Notifications" aria-expanded={showNotifications}>
                  <Bell size={20} />
                  {unreadCount > 0 && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                </button>
                {showNotifications && <NotificationDropdown onClose={() => setShowNotifications(false)} />}
              </div>
            )}

            <div id="radix-connect-btn" className="relative">
              {isLoading || isConnecting ? (
                <div className="user-pill"><Loader2 size={14} className="animate-spin" /><span className="hidden sm:inline">Connecting...</span></div>
              ) : showAsConnected ? (
                <>
                  <button onClick={() => setShowUserMenu(!showUserMenu)} className="icon-btn" title={displayName} aria-expanded={showUserMenu} aria-label="Account menu">
                    <UserAvatar seed={user?.id || walletData?.accounts?.[0]?.address || ''} size="md" />
                  </button>
                  {showUserMenu && <AccountMenu name={displayName} profilePath={userProfilePath} onClose={() => setShowUserMenu(false)} onLogout={handleLogout} />}
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
