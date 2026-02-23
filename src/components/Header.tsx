// src/components/Header.tsx

'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, usePathname } from 'next/navigation';
import { Search, Menu, X, Loader2, LogOut, ChevronDown, FileText, Edit, History, User, Info, Clock, FileCode } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore, useAuth, useClickOutside, usePagePath, type PageInfo } from '@/hooks';
import { cn, shortenAddress, formatRelativeTime, formatDate, userProfileSlug } from '@/lib/utils';
import { Button, Dropdown } from '@/components/ui';
import { UserAvatar } from '@/components/UserAvatar';
import type { WikiPage } from '@/types';

function usePageContext() {
  const { isHomepage, isPage, isEdit, isHistory, viewPath, tagPath, slug } = usePagePath();
  const { isAuthenticated } = useAuth();
  const mdxPath = (isHomepage || isPage) ? (isHomepage ? '/api/wiki/mdx' : `/api/wiki/${tagPath}/${slug}/mdx`) : null;

  return {
    canEdit: isAuthenticated && (isHomepage || isPage) && !isEdit && !isHistory,
    canShowHistory: (isHomepage || isPage) && !isHistory,
    canShowInfo: (isHomepage || isPage) && !isEdit && !isHistory,
    canExportMdx: (isHomepage || isPage) && !isEdit && !isHistory,
    editPath: isHomepage ? '/edit' : `${viewPath}/edit`,
    historyPath: (isHomepage || isPage) ? (isHomepage ? '/history' : `${viewPath}/history`) : null,
    mdxPath,
  };
}

function PageInfoDropdown({ page, onClose }: { page: PageInfo; onClose: () => void }) {
  return (
    <Dropdown onClose={onClose} className="w-64 p-3">
      <div className="stack-sm text-small">
        {page.author && (
          <div className="row">
            <UserAvatar radixAddress={page.author.radixAddress} avatarUrl={page.author.avatarUrl} size="sm" />
            <span className="text-muted">Author:</span>
            <span className="truncate">{page.author.displayName || page.author.radixAddress.slice(0, 16)}...</span>
          </div>
        )}
        <div className="row">
          <Clock size={14} className="text-muted shrink-0" />
          <span className="text-muted">Updated:</span>
          <span>{formatRelativeTime(page.updatedAt)}</span>
        </div>
        <div className="row">
          <Clock size={14} className="text-muted shrink-0" />
          <span className="text-muted">Created:</span>
          <span>{formatDate(page.createdAt)}</span>
        </div>
        {page.revisionCount > 0 && (
          <div className="row">
            <FileText size={14} className="text-muted shrink-0" />
            <span className="text-muted">Revisions:</span>
            <span>{page.revisionCount}</span>
          </div>
        )}
      </div>
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
  const _pendingConnect = useStore(s => s._pendingConnect);
  const pageInfo = useStore(s => s.pageInfo);
  const { canEdit, canShowHistory, canShowInfo, canExportMdx, editPath, historyPath, mdxPath } = usePageContext();
  const [showSearch, setShowSearch] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WikiPage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const clearSearchResults = useCallback(() => setSearchResults([]), []);
  const searchRef = useClickOutside<HTMLDivElement>(clearSearchResults);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const displayName = user?.displayName || walletData?.persona?.label ||
    (walletData?.accounts?.[0]?.address ? shortenAddress(walletData.accounts[0].address) : null) ||
    (user?.radixAddress ? shortenAddress(user.radixAddress) : 'Connected');

  const showAsConnected = isAuthenticated || (isConnected && walletData?.accounts?.length);
  const userProfilePath = user ? `/community/${userProfileSlug(user.displayName, user.radixAddress)}` : null;

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

  const handleSearchSelect = (page: WikiPage) => { setSearchQuery(''); setSearchResults([]); setShowSearch(false); router.push(`/${page.tagPath}/${page.slug}`); };

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
  };

  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-bar">
          <button onClick={toggleSidebar} className="icon-btn" aria-label="Toggle menu">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <Link href="/" className="row shrink-0">
            <Image src="/logo.png" alt="RADIX Wiki" width={240} height={240} className="logo-mark" priority />
            <span className="logo-text">RADIX Wiki</span>
          </Link>

          <div className="header-actions">
            <button onClick={() => setShowSearch(!showSearch)} className="icon-btn" aria-label="Search"><Search size={20} /></button>

            {canShowInfo && pageInfo && (
              <div className="relative">
                <button onClick={() => setShowInfo(!showInfo)} className="icon-btn" aria-label="Page info"><Info size={20} /></button>
                {showInfo && <PageInfoDropdown page={pageInfo} onClose={() => setShowInfo(false)} />}
              </div>
            )}

            {canExportMdx && mdxPath && <a href={mdxPath} className="icon-btn" aria-label="Download MDX" download><FileCode size={20} /></a>}
            {canEdit && <Link href={editPath} className="icon-btn" aria-label="Edit page"><Edit size={20} /></Link>}
            {canShowHistory && historyPath && <Link href={historyPath} className="icon-btn" aria-label="Page history"><History size={20} /></Link>}
            {isAuthenticated && userProfilePath && <Link href={userProfilePath} className="icon-btn" aria-label="Your profile"><User size={20} /></Link>}

            <div id="radix-connect-btn" className="relative">
              {isLoading || _pendingConnect ? (
                <div className="user-pill-loading"><Loader2 size={14} className="animate-spin" /><span className="hidden-mobile">Connecting...</span></div>
              ) : showAsConnected ? (
                <>
                  <button onClick={() => setShowUserMenu(!showUserMenu)} className="user-pill">
                    <UserAvatar radixAddress={user?.radixAddress || walletData?.accounts?.[0]?.address || ''} size="sm" />
                    <span className="font-medium hidden-mobile">{displayName}</span>
                    <ChevronDown size={14} className={cn('transition-transform', showUserMenu && 'rotate-180')} />
                  </button>
                  {showUserMenu && <UserMenuDropdown onClose={() => setShowUserMenu(false)} onLogout={handleLogout} />}
                </>
              ) : (
                <Button variant="primary" size="sm" onClick={connect}>
                  <span className="hidden-mobile">Connect Wallet</span>
                  <span className="hidden-desktop">Connect</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {showSearch && (
          <div ref={searchRef} className="search-panel">
            <div className="relative">
              <Search className="search-icon-left" size={18} />
              <input ref={searchInputRef} type="search" placeholder="Search pages..." className="input pl-10" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && searchResults.length) handleSearchSelect(searchResults[0]); else if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); setSearchResults([]); } }} />
              {isSearching && <Loader2 className="search-icon-right" size={18} />}

              {searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map(page => (
                    <button key={page.id} onClick={() => handleSearchSelect(page)} className="search-result">
                      <FileText size={16} className="text-accent shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{page.title}</div>
                        <div className="text-small text-muted truncate">/{page.tagPath}/{page.slug}</div>
                      </div>
                    </button>
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
