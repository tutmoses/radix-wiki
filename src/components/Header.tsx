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
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="row h-16">
          <button onClick={onMenuToggle} className="icon-btn" aria-label="Toggle menu">
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

          <Link href="/" className="row shrink-0">
            <div className="center w-8 h-8 rounded-md bg-accent text-text-inverted">
              <BookOpen size={18} />
            </div>
            <span className="font-semibold text-lg hidden sm:block">RADIX Wiki</span>
          </Link>

          <div className="row ml-auto">
            <button onClick={() => setShowSearch(!showSearch)} className="icon-btn" aria-label="Search">
              <Search size={20} />
            </button>

            <div id="radix-connect-btn" ref={menuRef} className="relative">
              {isLoading ? (
                <div className="row surface px-3 py-1.5">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="hidden sm:inline">Connecting...</span>
                </div>
              ) : showAsConnected ? (
                <>
                  <button onClick={() => setShowUserMenu(!showUserMenu)} className="row surface px-2 sm:px-3 py-1.5 hover:bg-surface-2 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="font-medium hidden sm:inline">{displayName}</span>
                    <ChevronDown size={14} className={cn('transition-transform', showUserMenu && 'rotate-180')} />
                  </button>
                  {showUserMenu && (
                    <div className="dropdown">
                      <button onClick={handleLogout} className="dropdown-item text-red-400 hover:text-red-300">
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
          <div className="pb-4 animate-[slide-up_0.3s_ease-out]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
              <input type="search" placeholder="Search pages..." className="input pl-10" autoFocus />
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

export default Header;