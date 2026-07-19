// src/components/Sidebar.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Trophy, BarChart3, ChevronRight, ChevronDown, ListTree } from 'lucide-react';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useStore, useIsMobile, usePagePath } from '@/hooks';
import { getVisibleTags, type TagNode } from '@/lib/tags';

function NavItem({ href, icon, label, isActive, onNavigate }: { href: string; icon: React.ReactNode; label: string; isActive?: boolean; onNavigate?: () => void }) {
  return (
    <Link href={href} onClick={onNavigate} className={cn('nav-item', isActive && 'bg-accent-muted text-accent font-medium')}>
      {icon}<span>{label}</span>
    </Link>
  );
}

function TagNavItem({ node, parentPath, pathname, depth, onNavigate }: { node: TagNode; parentPath: string; pathname: string; depth: number; onNavigate?: () => void }) {
  const currentPath = parentPath ? `${parentPath}/${node.slug}` : node.slug;
  const href = `/${currentPath}`;
  const isActive = pathname === href || pathname.startsWith(href + '/');
  const hasChildren = node.children && node.children.length > 0;
  const [isExpanded, setIsExpanded] = useState(isActive);

  return (
    <div style={{ paddingLeft: `${depth * 0.75}rem` }}>
      <div className="row">
        {hasChildren && <button onClick={() => setIsExpanded(!isExpanded)} className="nav-indent">{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>}
        <Link href={href} onClick={onNavigate} title={node.name} className={cn('nav-link', !hasChildren && 'nav-leaf', isActive && 'bg-accent-muted text-accent font-medium')}>{node.name}</Link>
      </div>
      {hasChildren && isExpanded && <div className="mt-1">{node.children!.map(child => <TagNavItem key={child.slug} node={child} parentPath={currentPath} pathname={pathname} depth={depth + 1} onNavigate={onNavigate} />)}</div>}
    </div>
  );
}

function TableOfContents() {
  const [headings, setHeadings] = useState<{ text: string; level: number; id: string }[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const updateHeadings = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const els = document.querySelector('main')?.querySelectorAll('h1[id], h2[id], h3[id]') || [];
        const next = Array.from(els).map(el => ({
          text: el.textContent?.trim() || '',
          level: parseInt(el.tagName[1]!),
          id: el.id,
        })).filter(h => h.text && h.id);
        // Keep the same array reference when unchanged so the scroll-spy observer
        // isn't torn down by unrelated DOM mutations (live price ticker, RSS feed).
        setHeadings(prev =>
          prev.length === next.length && prev.every((h, i) => h.id === next[i]!.id && h.text === next[i]!.text)
            ? prev : next,
        );
      }, 200);
    };

    updateHeadings();
    const observer = new MutationObserver(updateHeadings);
    const main = document.querySelector('main');
    if (main) observer.observe(main, { childList: true, subtree: true, characterData: false, attributes: false });
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, []);

  // Scroll-spy: highlight the section currently under the top of the viewport.
  useEffect(() => {
    if (!headings.length) return;
    setActiveId(prev => prev || headings[0]!.id);
    const order = new Map(headings.map((h, i) => [h.id, i]));
    const visible = new Set<string>();
    const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const headerRem = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 4;
    const topOffset = Math.round(headerRem * rem + rem * 0.5);
    const observer = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) visible.add(e.target.id);
          else visible.delete(e.target.id);
        }
        if (!visible.size) return;
        let bestId = '';
        let bestIdx = Infinity;
        for (const id of visible) {
          const idx = order.get(id) ?? Infinity;
          if (idx < bestIdx) { bestIdx = idx; bestId = id; }
        }
        if (bestId) setActiveId(bestId);
      },
      { rootMargin: `-${topOffset}px 0px -75% 0px`, threshold: 0 },
    );
    headings.forEach(h => { const el = document.getElementById(h.id); if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [headings]);

  if (!headings.length) return null;

  return (
    <div className="stack-sm">
      <button onClick={() => setIsExpanded(!isExpanded)} className="toc-btn">
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <ListTree size={16} />
        <span className="toc-label">On This Page</span>
      </button>
      {isExpanded && (
        <nav className="stack-xs pl-4">
          {headings.map((h, i) => (
            <button
              key={i}
              onClick={() => { setActiveId(h.id); document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' }); }}
              className={cn('toc-item', activeId === h.id && 'toc-item-active')}
              aria-current={activeId === h.id ? 'location' : undefined}
              style={{ paddingLeft: `${(h.level - 1) * 0.75}rem` }}
            >
              {h.text}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const sidebarOpen = useStore(s => s.sidebarOpen);
  const setSidebarOpen = useStore(s => s.setSidebarOpen);
  const isMobile = useIsMobile();

  useEffect(() => setSidebarOpen(!isMobile), [isMobile, setSidebarOpen]);
  const closeMobile = useCallback(() => { if (isMobile) setSidebarOpen(false); }, [isMobile, setSidebarOpen]);
  const visibleTags = useMemo(() => getVisibleTags(), []);

  const { isHomepage, isPage, isEdit, isHistory } = usePagePath();
  const showToc = (isHomepage || isPage) && !isEdit && !isHistory;

  return (
    <aside className={cn('sidebar', sidebarOpen ? 'sidebar-open' : 'sidebar-closed')}>
      <div className="sidebar-scroll">
        <div className="stack-sm p-4">
          <nav className="stack-sm">
            <NavItem href="/" icon={<Home size={18} />} label="Home" isActive={pathname === '/'} onNavigate={closeMobile} />
            <NavItem href="/charts" icon={<BarChart3 size={18} />} label="Charts" isActive={pathname === '/charts' || pathname.startsWith('/charts/')} onNavigate={closeMobile} />
            <NavItem href="/leaderboard" icon={<Trophy size={18} />} label="Leaderboard" isActive={pathname === '/leaderboard'} onNavigate={closeMobile} />
          </nav>
        </div>

        {showToc && (
          <div className="px-4 pb-4 border-b border-border-muted">
            <TableOfContents />
          </div>
        )}

        <div className="stack-sm p-4 flex-1">
          <span className="sidebar-label">Categories</span>
          <nav className="stack-sm">
            {visibleTags.map(node => <TagNavItem key={node.slug} node={node} parentPath="" pathname={pathname} depth={0} onNavigate={closeMobile} />)}
          </nav>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
