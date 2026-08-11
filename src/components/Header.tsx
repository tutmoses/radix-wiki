// src/components/Header.tsx

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { Search, Menu, X, Loader2, LogOut, ChevronDown, Edit, History, User, FileCode, Bell, Webhook, Database, MoreVertical, Quote, Link2, Check, Eye, EyeOff } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore, useAuth, useClickOutside, usePagePath, useFetch } from '@/hooks';
import { cn, shortenAddress, formatRelativeTime, getMatchSnippet, pagePath } from '@/lib/utils';
import Highlight from '@/components/Highlight';
import { Button, Dropdown } from '@/components/ui';
import { UserAvatar } from '@/components/UserAvatar';
import type { WikiPage, WikiNotification } from '@/types';
import type { LedgerAnchor } from '@/lib/radix/ledger';
import { WebhookSettings } from '@/components/WebhookSettings';
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
                  <UserAvatar radixAddress={n.actor.radixAddress} avatarUrl={n.actor.avatarUrl} size="sm" />
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
// One row shape for both the desktop dropdown and the mobile panel. The snippet is
// the passage the query matched, so a body-text hit doesn't read as an unrelated title.
function SearchResultRow({ page, query, onSelect }: { page: WikiPage; query: string; onSelect: (page: WikiPage) => void }) {
  const snippet = getMatchSnippet(page.content, query, 120);
  return (
    <button type="button" onClick={() => onSelect(page)} className="search-result">
      <div className="font-medium truncate"><Highlight text={page.title} query={query} /></div>
      <div className="text-small text-text-muted truncate">/{page.tagPath}/{page.slug}</div>
      {snippet && <p className="text-small text-text-muted line-clamp-1 mt-0.5"><Highlight text={snippet} query={query} /></p>}
    </button>
  );
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
  const [copied, setCopied] = useState<'cite' | 'link' | null>(null);
  const [watch, setWatch] = useState<{ connected: boolean; subId: string | null } | null>(null);
  const [watchBusy, setWatchBusy] = useState(false);

  const fetchWatch = useCallback(async () => {
    const res = await fetch('/api/telegram');
    if (!res.ok) return;
    const data = await res.json();
    const sub = (data.subscriptions || []).find((s: { tagPath: string; pageSlug: string; id: string }) => s.tagPath === tagPath && s.pageSlug === slug);
    setWatch({ connected: !!data.connected, subId: sub?.id ?? null });
  }, [tagPath, slug]);

  useEffect(() => {
    if (isAuthenticated && isPage) fetchWatch().catch(() => {});
  }, [isAuthenticated, isPage, fetchWatch]);

  const pageUrl = () => `${window.location.origin}/${tagPath}/${slug}`;
  const copy = async (kind: 'cite' | 'link', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch { /* clipboard unavailable */ }
  };

  const toggleWatch = async () => {
    if (!watch || watchBusy) return;
    if (!watch.connected) { onClose(); onConnectTelegram(); return; }
    setWatchBusy(true);
    try {
      if (watch.subId) {
        const res = await fetch(`/api/telegram?id=${watch.subId}`, { method: 'DELETE' });
        if (res.ok) { setWatch({ ...watch, subId: null }); showToast('No longer watching this page'); }
      } else {
        const res = await fetch('/api/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tagPath, pageSlug: slug, events: ['page.updated', 'comment.created'] }),
        });
        if (res.ok) { await fetchWatch(); showToast('Watching this page'); }
      }
    } finally { setWatchBusy(false); }
  };

  const title = isPage && slug ? slug.replace(/-/g, ' ') : 'RADIX Wiki';

  return (
    <Dropdown onClose={onClose}>
      {isAuthenticated && isPage && (
        <button className="dropdown-item" onClick={toggleWatch} disabled={watchBusy}>
          {watch?.subId ? <EyeOff size={16} /> : <Eye size={16} />}
          {watch?.subId ? 'Unwatch this page' : 'Watch this page'}
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
  const sidebarOpen = useStore(s => s.sidebarOpen);
  const toggleSidebar = useStore(s => s.toggleSidebar);
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

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WikiPage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const clearSearchResults = useCallback(() => { setSearchResults([]); setSearchOpen(false); }, []);
  const searchRef = useClickOutside<HTMLDivElement>(clearSearchResults);
  const desktopSearchRef = useClickOutside<HTMLFormElement>(clearSearchResults);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const desktopSearchInputRef = useRef<HTMLInputElement>(null);

  const goToSearchPage = useCallback(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    setSearchResults([]);
    setSearchOpen(false);
    setShowSearch(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }, [searchQuery, router]);

  // "/" focuses search from anywhere (Wikipedia-style), unless already typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return;
      e.preventDefault();
      const desktop = desktopSearchInputRef.current;
      if (desktop && desktop.offsetParent) desktop.focus();
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

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/wiki?${new URLSearchParams({ search: query, pageSize: '5' })}`);
      if (res.ok) setSearchResults((await res.json()).items || []);
    } catch (e) { console.error('Search failed:', e); }
    finally { setIsSearching(false); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => performSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  const handleSearchSelect = (page: WikiPage) => { setSearchQuery(''); setSearchResults([]); setSearchOpen(false); setShowSearch(false); router.push(pagePath(page.tagPath, page.slug)); };

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

          <form ref={desktopSearchRef} className="header-search" onSubmit={e => { e.preventDefault(); goToSearchPage(); }}>
            <Search className="search-icon-left" size={18} />
            <input ref={desktopSearchInputRef} type="search" placeholder="Search the wiki... ( / )" className="input pl-10" value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setSearchOpen(true); }}
              onKeyDown={e => { if (e.key === 'Escape') { setSearchQuery(''); setSearchResults([]); setSearchOpen(false); } }} />
            {isSearching && <Loader2 className="search-icon-right" size={18} />}
            {searchOpen && searchResults.length > 0 && (
              <div className="search-results">
                {searchResults.map(page => (
                  <SearchResultRow key={page.id} page={page} query={searchQuery.trim()} onSelect={handleSearchSelect} />
                ))}
                <button type="button" onClick={goToSearchPage} className="search-result search-result-all">
                  See all results for &ldquo;{searchQuery.trim()}&rdquo;
                </button>
              </div>
            )}
            {searchOpen && searchQuery.trim() && !isSearching && searchResults.length === 0 && (
              <div className="search-results">
                <div className="search-empty">No pages found for &ldquo;{searchQuery.trim()}&rdquo;</div>
              </div>
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
                    <UserAvatar radixAddress={user?.radixAddress || walletData?.accounts?.[0]?.address || ''} size="sm" />
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

        {showSearch && (
          <div ref={searchRef} className="search-panel sm:hidden">
            <div className="relative">
              <Search className="search-icon-left" size={18} />
              <input ref={searchInputRef} type="search" placeholder="Search the wiki..." className="input pl-10" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); goToSearchPage(); } else if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); setSearchResults([]); } }} />
              {isSearching && <Loader2 className="search-icon-right" size={18} />}

              {searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map(page => (
                    <SearchResultRow key={page.id} page={page} query={searchQuery.trim()} onSelect={handleSearchSelect} />
                  ))}
                </div>
              )}

              {searchQuery.trim() && !isSearching && searchResults.length === 0 && (
                <div className="search-empty">
                  No pages found for &ldquo;{searchQuery}&rdquo;
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;
