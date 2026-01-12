// src/components/WikiLayout.tsx

'use client';

import { ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface WikiLayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
}

export function WikiLayout({ children, showSidebar = true }: WikiLayoutProps) {
  return (
    <div className="min-h-screen bg-surface-0">
      <Header />
      {showSidebar && <Sidebar />}
      <main className="min-h-[calc(100vh-4rem)] w-full">
        <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">{children}</div>
      </main>
    </div>
  );
}

export default WikiLayout;