// src/components/Sidebar.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ChevronRight, ChevronDown, ListTree } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useStore, useIsMobile } from '@/hooks';
import { getVisibleTags, isValidTagPath, type TagNode } from '@/lib/tags';

function NavItem({ href, icon, label, isActive }: { href: string; icon: React.ReactNode; label: string; isActive?: boolean }) {
  return (
    <Link href={href} className={isActive ? 'nav-item-active' : 'nav-item'}>
      {icon}<span>{label}</span>
    </Link>
  );
}

function TagNavItem({ node, parentPath, pathname, depth }: { node: TagNode; parentPath: string; pathname: string; depth: number }) {
  const currentPath = parentPath ? `${parentPath}/${node.slug}` : node.slug;
  const href = `/${currentPath}`;
  const isActive = pathname === href || pathname.startsWith(href + '/');
  const hasChildren = node.children && node.children.length > 0;
  const [isExpanded, setIsExpanded] = useState(isActive);

  return (
    <div style={{ paddingLeft: `${depth * 1.5}rem` }}>
      <div className="row">
        <span className="nav-indent">{hasChildren ? <button onClick={() => setIsExpanded(!isExpanded)} className="icon-btn p-1 text-muted">{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button> : null}</span>
        <Link href={href} className={isActive ? 'nav-link-active' : 'nav-link'}>{node.name}</Link>
      </div>
      {hasChildren && isExpanded && <div className="mt-1">{node.children!.map(child => <TagNavItem key={child.slug} node={child} parentPath={currentPath} pathname={pathname} depth={depth + 1} />)}</div>}
    </div>
  );
}

function TableOfContents() {
  const [headings, setHeadings] = useState<{ text: string; level: number; id: string }[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const updateHeadings = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const els = document.querySelector('main')?.querySelectorAll('h1[id], h2[id], h3[id]') || [];
        setHeadings(Array.from(els).map(el => ({
          text: el.textContent?.trim() || '',
          level: parseInt(el.tagName[1]),
          id: el.id,
        })).filter(h => h.text && h.id));
      }, 200);
    };

    updateHeadings();
    const observer = new MutationObserver(updateHeadings);
    const main = document.querySelector('main');
    if (main) observer.observe(main, { childList: true, subtree: true });
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, []);

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
              onClick={() => document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' })}
              className="toc-item"
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
  const visibleTags = useMemo(() => getVisibleTags(), []);

  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  const isEdit = last === 'edit';
  const isHistory = last === 'history';
  const viewSegs = (isEdit || isHistory) ? segments.slice(0, -1) : segments;
  const isHomepage = viewSegs.length === 0;
  const isPage = !isHomepage && !isValidTagPath(viewSegs) && viewSegs.length >= 2;
  const showToc = (isHomepage || isPage) && !isEdit && !isHistory;

  return (
    <aside className={cn('sidebar', sidebarOpen ? 'sidebar-open' : 'sidebar-closed')}>
      <div className="sidebar-scroll">
        <div className="stack-sm p-4">
          <nav className="stack-sm">
            <NavItem href="/" icon={<Home size={18} />} label="Home" isActive={pathname === '/'} />
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
            {visibleTags.map(node => <TagNavItem key={node.slug} node={node} parentPath="" pathname={pathname} depth={0} />)}
          </nav>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
