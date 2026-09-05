// src/components/Sidebar.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, BarChart3, ChevronRight, ChevronDown, ListTree, Wrench } from 'lucide-react';
import { useMemo, useCallback } from 'react';
import { TableOfContents as SharedToc, useSidebar } from 'wiki-formant/react';
import { cn } from '@/lib/utils';
import { usePagePath, useAuth } from '@/hooks';
import { getVisibleTags, type TagNode } from '@/lib/tags';

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

/**
 * The category list, expanding only the branch the reader is in. It used to be
 * top-level only, because every category page drew its children as cards and a
 * tree here made a third copy on screen next to those and the breadcrumbs. The
 * cards are gone from the pages whose article already routes to its own
 * sections, and this is where that navigation belongs: it persists while
 * reading a guide, where the card grid never reached.
 *
 * Only the active trail opens, so the rail shows one section's children rather
 * than the whole hierarchy, and the deepest matching node is the one marked
 * current — an ancestor is on the trail, not the page you are on.
 */
function CategoryTree({ nodes, parent = '', pathname, onNavigate }: {
  nodes: TagNode[]; parent?: string; pathname: string; onNavigate: () => void;
}) {
  return (
    <nav className="stack-sm">
      {nodes.map(node => {
        const path = parent ? `${parent}/${node.slug}` : node.slug;
        const href = `/${path}`;
        const onTrail = pathname === href || pathname.startsWith(`${href}/`);
        const children = (node.children ?? []).filter(c => !c.hidden);
        const openChildren = onTrail ? children : [];
        const isCurrent = onTrail && !openChildren.some(c => pathname.startsWith(`${href}/${c.slug}`));
        return (
          <div key={path}>
            <Link href={href} onClick={onNavigate} title={node.name}
              className={cn('nav-item', isCurrent && 'bg-accent-muted text-accent font-medium')}>
              <span className="truncate">{node.name}</span>
            </Link>
            {openChildren.length > 0 && (
              <div className="nav-subtree">
                <CategoryTree nodes={openChildren} parent={path} pathname={pathname} onNavigate={onNavigate} />
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  // Collapse state is `wiki-formant/react`, shared with the other wikis. It
  // remembers the reader's choice and lets the viewport supply only a default —
  // the local version reset the rail open on every resize across the breakpoint.
  const { open: sidebarOpen, setOpen: setSidebarOpen, isMobile, ready } = useSidebar();
  const { isAuthenticated } = useAuth();

  const closeMobile = useCallback(() => { if (isMobile) setSidebarOpen(false); }, [isMobile, setSidebarOpen]);
  const visibleTags = useMemo(() => getVisibleTags(), []);

  const { isHomepage, isCategory, isPage, isEdit, isHistory } = usePagePath();
  // Categories carry a hub article and a section index, both of which have
  // headings worth jumping to — they were the only long pages with no rail.
  const showToc = (isHomepage || isPage || isCategory) && !isEdit && !isHistory;

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

        <div className="stack-sm p-4">
          <span className="sidebar-label">Categories</span>
          <CategoryTree nodes={visibleTags} pathname={pathname} onNavigate={closeMobile} />
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
