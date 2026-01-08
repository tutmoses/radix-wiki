// src/components/layout/WikiLayout.tsx

'use client';

import { useState, ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface WikiLayoutProps {
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '4xl' | 'full';
  showSidebar?: boolean;
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '4xl': 'max-w-4xl',
  full: '',
};

export function WikiLayout({ children, maxWidth = 'full', showSidebar = true }: WikiLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-surface-0">
      <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} isMenuOpen={sidebarOpen} />
      <div className="flex items-start">
        {showSidebar && <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />}
        <main className="flex-1 min-h-[calc(100vh-4rem)]">
          <div className={`container py-8 ${maxWidthClasses[maxWidth]}`}>{children}</div>
        </main>
      </div>
    </div>
  );
}

export default WikiLayout;