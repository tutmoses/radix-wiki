// src/components/Header.tsx

'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { BookOpen, Search, Menu, X, Loader2, LogOut, ChevronDown, FileText, Edit, History, User, Info, Clock, FileCode } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore, useAuth } from '@/hooks';
import { cn, shortenAddress, formatRelativeTime, formatDate } from '@/lib/utils';
import { Button, Dropdown } from '@/components/ui';
import { isValidTagPath } from '@/lib/tags';
import type { WikiPage } from '@/types';

function usePageContext() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  
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
  
  const mdxPath = (isHomepage || isPage) ? (isHomepage ? '/api/wiki/mdx' : `/api/wiki/${tagPath}/${slug}/mdx`) : null;

  return {
    canEdit: isAuthenticated && (isHomepage || isPage) && !isEdit && !isHistory,
    canShowHistory: (isHomepage || isPage) && !isHistory,
    canShowInfo: (isHomepage || isPage) && !isEdit && !isHistory,
    canExportMdx: (isHomepage || isPage) && !isEdit && !isHistory,
    editPath: isHomepage ? '/edit' : `${viewPath}/edit`,
    historyPath: (isHomepage || isPage) ? (isHomepage ? '/history' : `${viewPath}/history`) : null,
    mdxPath,
    isHomepage,
    tagPath,
    slug,
  };
}

interface PageWithAuthor {
  id: string;
  updatedAt: string | Date;
  createdAt: string | Date;
  author?: { id: string; displayName?: string | null; radixAddress: string };
  revisions?: { id: string }[];
}

function PageInfoDropdown({ page, onClose }: { page: PageWithAuthor; onClose: () => void }) {
  return (
    <Dropdown onClose={onClose} className="w-64 p-3">
      <div className="stack-sm text-small">
        {page.author && (
          <div className="row">
            <User size={14} className="text-muted shrink-0" />
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
        {page.revisions?.length ? (
          <div className="row">
            <FileText size={14} className="text-muted shrink-0" />
            <span className="text-muted">Revisions:</span>
            <span>{page.revisions.length}</span>
          </div>
        ) : null}
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
  const { isAuthenticated, user } = useAuth();
  const { session, walletData, isConnected, isLoading, logout, connect, sidebarOpen, toggleSidebar } = useStore();
  const { canEdit, canShowHistory, canShowInfo, canExportMdx, editPath, historyPath, mdxPath, isHomepage, tagPath, slug } = usePageContext();
  const [showSearch, setShowSearch] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [pageData, setPageData] = useState<PageWithAuthor | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WikiPage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const displayName = session?.displayName || walletData?.persona?.label ||
    (walletData?.accounts?.[0]?.address ? shortenAddress(walletData.accounts[0].address) : null) ||
    (session?.radixAddress ? shortenAddress(session.radixAddress) : 'Connected');

  const showAsConnected = isAuthenticated || (isConnected && walletData?.accounts?.length);
  const userProfilePath = session?.radixAddress ? `/community/${session.radixAddress.slice(-16).toLowerCase()}` : null;

  useEffect(() => {
    if (canShowInfo) {
      const url = isHomepage ? '/api/wiki' : `/api/wiki/${tagPath}/${slug}`;
      fetch(url)
        .then(r => r.ok ? r.json() : null)
        .then(data => setPageData(data))
        .catch(() => setPageData(null));
    } else {
      setPageData(null);
    }
  }, [canShowInfo, isHomepage, tagPath, slug]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchResults([]);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
    <header className="sticky top-0 z-50 bg-surface-0/80 backdrop-blur-md border-b border-border-muted">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="row h-[var(--header-height)]">
          <button onClick={toggleSidebar} className="icon-btn" aria-label="Toggle menu">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <Link href="/" className="row shrink-0">
            <div className="center w-8 h-8 rounded-md bg-accent text-text-inverted"><BookOpen size={18} /></div>
            <span className="font-semibold text-lg hidden sm:block">RADIX Wiki</span>
          </Link>

          <div className="row ml-auto">
            <button onClick={() => setShowSearch(!showSearch)} className="icon-btn" aria-label="Search"><Search size={20} /></button>
            
            {canShowInfo && pageData && (
              <div className="relative">
                <button onClick={() => setShowInfo(!showInfo)} className="icon-btn" aria-label="Page info"><Info size={20} /></button>
                {showInfo && <PageInfoDropdown page={pageData} onClose={() => setShowInfo(false)} />}
              </div>
            )}
            
            {canExportMdx && mdxPath && <a href={mdxPath} className="icon-btn" aria-label="Download MDX" download><FileCode size={20} /></a>}
            {canEdit && <Link href={editPath} className="icon-btn" aria-label="Edit page"><Edit size={20} /></Link>}
            {canShowHistory && historyPath && <Link href={historyPath} className="icon-btn" aria-label="Page history"><History size={20} /></Link>}
            {isAuthenticated && userProfilePath && <Link href={userProfilePath} className="icon-btn" aria-label="Your profile"><User size={20} /></Link>}

            <div id="radix-connect-btn" className="relative">
              {isLoading ? (
                <div className="row surface px-3 py-1.5"><Loader2 size={14} className="animate-spin" /><span className="hidden sm:inline">Connecting...</span></div>
              ) : showAsConnected ? (
                <>
                  <button onClick={() => setShowUserMenu(!showUserMenu)} className="row surface px-2 sm:px-3 py-1.5 hover:bg-surface-2 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-success" />
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
          <div ref={searchRef} className="pb-4 animate-[slide-up_0.3s_ease-out]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input ref={searchInputRef} type="search" placeholder="Search pages..." className="input pl-10" value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && searchResults.length) handleSearchSelect(searchResults[0]); else if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); setSearchResults([]); } }} />
              {isSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 text-muted animate-spin" size={18} />}
              
              {searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-surface-1 border border-border rounded-lg shadow overflow-hidden z-50">
                  {searchResults.map(page => (
                    <button key={page.id} onClick={() => handleSearchSelect(page)} className="w-full row p-3 hover:bg-surface-2 transition-colors text-left">
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
                <div className="absolute top-full left-0 right-0 mt-2 bg-surface-1 border border-border rounded-lg shadow p-4 text-center text-muted z-50">
                  No pages found for "{searchQuery}"
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