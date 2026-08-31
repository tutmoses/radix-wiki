// src/components/Sidebar.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, BarChart3, ChevronRight, ChevronDown, ListTree, Wrench } from 'lucide-react';
import { useMemo, useCallback } from 'react';
import { TableOfContents as SharedToc, useSidebar } from 'wiki-formant/react';
import { cn } from '@/lib/utils';
import { usePagePath, useAuth } from '@/hooks';
import { getVisibleTags } from '@/lib/tags';

function NavItem({ href, icon, label, isActive, onNavigate }: { href: string; icon: React.ReactNode; label: string; isActive?: boolean; onNavigate?: () => void }) {
  return (
    <Link href={href} onClick={onNavigate} className={cn('nav-item', isActive && 'bg-accent-muted text-accent font-medium')}>
      {icon}<span>{label}</span>
    </Link>
  );
}

// The rail's "on this page" list is `wiki-formant/react`, shared with the other
// wikis, which had written the same debounced MutationObserver and scroll-spy.
// Ids are injected server-side here (lib/html.ts -> wiki-formant/headings), so
// no `slug` is passed: an id is a URL, and one minted in the browser is not the
// one this wiki published.
const TableOfContents = () => (
  <SharedToc
    containerSelector="main"
    offsetVar="--header-height"
    classNames={{ root: 'stack-sm', button: 'toc-btn', label: 'toc-label', list: 'stack-xs pl-4', item: 'toc-item', itemActive: 'toc-item-active' }}
    icon={expanded => (
      <>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <ListTree size={16} />
      </>
    )}
    label="On This Page"
  />
);

export function Sidebar() {
  const pathname = usePathname();
  // Collapse state is `wiki-formant/react`, shared with the other wikis. It
  // remembers the reader's choice and lets the viewport supply only a default —
  // the local version reset the rail open on every resize across the breakpoint.
  const { open: sidebarOpen, setOpen: setSidebarOpen, isMobile, ready } = useSidebar();
  const { isAuthenticated } = useAuth();

  const closeMobile = useCallback(() => { if (isMobile) setSidebarOpen(false); }, [isMobile, setSidebarOpen]);
  const visibleTags = useMemo(() => getVisibleTags(), []);

  const { isHomepage, isPage, isEdit, isHistory } = usePagePath();
  const showToc = (isHomepage || isPage) && !isEdit && !isHistory;

  return (
    <aside className={cn('sidebar', sidebarOpen ? 'sidebar-open' : 'sidebar-closed', !ready && 'sidebar-instant')}>
      <div className="sidebar-scroll">
        <div className="stack-sm p-4">
          <nav className="stack-sm">
            <NavItem href="/" icon={<Home size={18} />} label="Home" isActive={pathname === '/'} onNavigate={closeMobile} />
            <NavItem href="/charts" icon={<BarChart3 size={18} />} label="Charts" isActive={pathname === '/charts' || pathname.startsWith('/charts/')} onNavigate={closeMobile} />
            <NavItem href="/leaderboard" icon={<Trophy size={18} />} label="Leaderboard" isActive={pathname === '/leaderboard'} onNavigate={closeMobile} />
            {/* Editorial work queues — reader nav stays free of maintenance machinery. */}
            {isAuthenticated && <NavItem href="/maintenance" icon={<Wrench size={18} />} label="Maintenance" isActive={pathname === '/maintenance'} onNavigate={closeMobile} />}
          </nav>
        </div>

        {/* Top-level sections only. Every category page already renders its own
            children as cards carrying a blurb and a page count, which a tree
            can't — mirroring the whole hierarchy here made it the third copy on
            screen, next to the breadcrumbs and those cards. */}
        <div className="stack-sm p-4">
          <span className="sidebar-label">Categories</span>
          <nav className="stack-sm">
            {visibleTags.map(node => (
              <Link key={node.slug} href={`/${node.slug}`} onClick={closeMobile} title={node.name}
                className={cn('nav-item', (pathname === `/${node.slug}` || pathname.startsWith(`/${node.slug}/`)) && 'bg-accent-muted text-accent font-medium')}>
                <span className="truncate">{node.name}</span>
              </Link>
            ))}
          </nav>
        </div>

        {showToc && (
          <div className="px-4 pb-4 border-t border-border-muted pt-4 flex-1">
            <TableOfContents />
          </div>
        )}
      </div>
    </aside>
  );
}

export default Sidebar;
