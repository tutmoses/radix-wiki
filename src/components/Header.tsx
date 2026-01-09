// src/components/Header.tsx

'use client';

import Link from 'next/link';
import { BookOpen, Search, Menu, X, Loader2, LogOut, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useStore, useIsAuthenticated } from '@/hooks/useStore';
import { cn, shortenAddress } from '@/lib/utils';
import { Button } from '@/components/ui';

interface HeaderProps {
  onMenuToggle?: () => void;
  isMenuOpen?: boolean;
}

export function Header({ onMenuToggle, isMenuOpen }: HeaderProps) {
  const isAuthenticated = useIsAuthenticated();
  const { session, walletData, isConnected, isLoading, logout, connect } = useStore();
  const [showSearch, setShowSearch] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const displayName = session?.displayName || 
    walletData?.persona?.label ||
    (walletData?.accounts?.[0]?.address ? shortenAddress(walletData.accounts[0].address) : null) ||
    (session?.radixAddress ? shortenAddress(session.radixAddress) : 'Connected');

  const showAsConnected = isAuthenticated || (isConnected && walletData?.accounts?.length);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setShowUserMenu(false);
    await logout();
  };

  return (
    <header className="sticky top-0 z-50 bg-surface-0/80 backdrop-blur-md border-b border-border-muted">
      <div className="container">
        <div className="flex items-center h-16 gap-3">
          <button onClick={onMenuToggle} className="p-2 rounded-md hover:bg-surface-2" aria-label="Toggle menu">
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-accent text-text-inverted">
              <BookOpen size={18} />
            </div>
            <span className="font-semibold text-lg hidden sm:block">RADIX Wiki</span>
          </Link>

          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => setShowSearch(!showSearch)} className="p-2 rounded-md hover:bg-surface-2" aria-label="Search">
              <Search size={20} />
            </button>

            <div id="radix-connect-btn" ref={menuRef} className="relative">
              {isLoading ? (
                <div className="flex items-center gap-2 bg-surface-1 px-3 py-1.5 rounded-md">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="text-sm hidden sm:inline">Connecting...</span>
                </div>
              ) : showAsConnected ? (
                <>
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 bg-surface-1 px-2 sm:px-3 py-1.5 rounded-md hover:bg-surface-2 transition-colors"
                  >
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm font-medium hidden sm:inline">{displayName}</span>
                    <ChevronDown size={14} className={cn('transition-transform', showUserMenu && 'rotate-180')} />
                  </button>
                  {showUserMenu && (
                    <div className="absolute right-0 top-full mt-2 w-48 bg-surface-1 border border-border rounded-md shadow-lg py-1 z-50">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-4 py-2 text-sm text-left hover:bg-surface-2 text-red-400 hover:text-red-300"
                      >
                        <LogOut size={16} />
                        Disconnect
                      </button>
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
          <div className="pb-4 animate-[slideUp_0.3s_ease-out]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" size={18} />
              <input
                type="search"
                placeholder="Search pages..."
                className="w-full pl-10 px-3 py-2 text-sm bg-surface-0 border border-border rounded-md focus:border-accent focus:ring-2 focus:ring-accent-muted focus:outline-none"
                autoFocus
              />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;