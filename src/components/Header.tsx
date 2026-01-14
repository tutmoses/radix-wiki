// src/components/Header.tsx

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, Search, Menu, X, Loader2, LogOut, ChevronDown, FileText } from 'lucide-react';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useStore, useAuth } from '@/hooks';
import { cn, shortenAddress } from '@/lib/utils';
import { Button } from '@/components/ui';
import type { WikiPage } from '@/types';

export function Header() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { session, walletData, isConnected, isLoading, logout, connect, sidebarOpen, toggleSidebar } = useStore();
  const [showSearch, setShowSearch] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<WikiPage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const displayName = session?.displayName || 
    walletData?.persona?.label ||
    (walletData?.accounts?.[0]?.address ? shortenAddress(walletData.accounts[0].address) : null) ||
    (session?.radixAddress ? shortenAddress(session.radixAddress) : 'Connected');

  const showAsConnected = isAuthenticated || (isConnected && walletData?.accounts?.length);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setShowUserMenu(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchResults([]);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (showSearch && searchInputRef.current) searchInputRef.current.focus();
  }, [showSearch]);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setSearchResults([]); return; }
    setIsSearching(true);
    try {
      const params = new URLSearchParams({ search: query, published: 'true', pageSize: '5' });
      const response = await fetch(`/api/wiki?${params}`);
      if (response.ok) setSearchResults((await response.json()).items || []);
    } catch (error) { console.error('Search failed:', error); }
    finally { setIsSearching(false); }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => performSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, performSearch]);

  const handleLogout = async () => { setShowUserMenu(false); await logout(); };
  const handleSearchSelect = (page: WikiPage) => { setSearchQuery(''); setSearchResults([]); setShowSearch(false); router.push(`/${page.tagPath}/${page.slug}`); };
  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && searchResults.length > 0) handleSearchSelect(searchResults[0]);
    else if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); setSearchResults([]); }
  };

  return (
    <header className="sticky top-0 z-50 bg-surface-0/80 backdrop-blur-md border-b border-border-muted">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="row h-16">
          <button onClick={toggleSidebar} className="icon-btn" aria-label="Toggle menu">
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <Link href="/" className="row shrink-0">
            <div className="center w-8 h-8 rounded-md bg-accent text-text-inverted"><BookOpen size={18} /></div>
            <span className="font-semibold text-lg hidden sm:block">RADIX Wiki</span>
          </Link>

          <div className="row ml-auto">
            <button onClick={() => setShowSearch(!showSearch)} className="icon-btn" aria-label="Search"><Search size={20} /></button>

            <div id="radix-connect-btn" ref={menuRef} className="relative">
              {isLoading ? (
                <div className="row surface px-3 py-1.5"><Loader2 size={14} className="animate-spin" /><span className="hidden sm:inline">Connecting...</span></div>
              ) : showAsConnected ? (
                <>
                  <button onClick={() => setShowUserMenu(!showUserMenu)} className="row surface px-2 sm:px-3 py-1.5 hover:bg-surface-2 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-success" />
                    <span className="font-medium hidden sm:inline">{displayName}</span>
                    <ChevronDown size={14} className={cn('transition-transform', showUserMenu && 'rotate-180')} />
                  </button>
                  {showUserMenu && (
                    <div className="dropdown">
                      <button onClick={handleLogout} className="dropdown-item text-error hover:text-error/80"><LogOut size={16} />Disconnect</button>
                    </div>
                  )}
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
              <input ref={searchInputRef} type="search" placeholder="Search pages..." className="input pl-10" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={handleSearchKeyDown} />
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