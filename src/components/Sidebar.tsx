// src/components/Sidebar.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ChevronRight, ChevronDown, ListTree } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn, slugify } from '@/lib/utils';
import { useStore } from '@/hooks';
import { getVisibleTags, isValidTagPath, type TagNode } from '@/lib/tags';

function NavItem({ href, icon, label, isActive }: { href: string; icon: React.ReactNode; label: string; isActive?: boolean }) {
  return (
    <Link href={href} className={cn('row px-3 py-2 rounded-md transition-colors', isActive ? 'bg-accent-muted text-accent font-medium' : 'text-muted hover:bg-surface-2 hover:text-text')}>
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
    <div className={cn(depth > 0 && 'ml-3')}>
      <div className="row">
        {hasChildren && <button onClick={() => setIsExpanded(!isExpanded)} className="icon-btn p-1 text-muted">{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>}
        <Link href={href} className={cn('flex-1 row px-2 py-1.5 rounded-md transition-colors', isActive ? 'bg-accent-muted text-accent font-medium' : 'text-muted hover:bg-surface-2 hover:text-text', !hasChildren && 'ml-5')}>{node.name}</Link>
      </div>
      {hasChildren && isExpanded && <div className="mt-1">{node.children!.map(child => <TagNavItem key={child.slug} node={child} parentPath={currentPath} pathname={pathname} depth={depth + 1} />)}</div>}
    </div>
  );
}

function TableOfContents() {
  const [headings, setHeadings] = useState<{ text: string; level: number; id: string }[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);

  useEffect(() => {
    const updateHeadings = () => {
      const els = document.querySelector('main')?.querySelectorAll('h1, h2, h3') || [];
      setHeadings(Array.from(els).map(el => {
        const text = el.textContent?.trim() || '';
        if (!el.id) el.id = slugify(text);
        return { text, level: parseInt(el.tagName[1]), id: el.id };
      }).filter(h => h.text));
    };

    updateHeadings();
    const observer = new MutationObserver(updateHeadings);
    const main = document.querySelector('main');
    if (main) observer.observe(main, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  if (!headings.length) return null;

  return (
    <div className="stack-sm">
      <button onClick={() => setIsExpanded(!isExpanded)} className="row px-3 py-2 text-muted hover:text-text transition-colors w-full">
        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <ListTree size={16} />
        <span className="text-small font-medium uppercase tracking-wide">On This Page</span>
      </button>
      {isExpanded && (
        <nav className="stack-xs pl-4">
          {headings.map((h, i) => (
            <button
              key={i}
              onClick={() => document.getElementById(h.id)?.scrollIntoView({ behavior: 'smooth' })}
              className="text-left text-small text-muted hover:text-accent transition-colors py-1 px-2 rounded truncate"
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
  const { sidebarOpen } = useStore();
  const visibleTags = getVisibleTags();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const segments = pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  const isEdit = last === 'edit';
  const isHistory = last === 'history';
  const viewSegs = (isEdit || isHistory) ? segments.slice(0, -1) : segments;
  const isHomepage = viewSegs.length === 0;
  const isPage = !isHomepage && !isValidTagPath(viewSegs) && viewSegs.length >= 2;
  const showToc = (isHomepage || isPage) && !isEdit && !isHistory;

  // Use mounted check to ensure server/client consistency
  const isOpen = mounted ? sidebarOpen : true;

  return (
    <aside className={cn('sticky top-16 h-[calc(100vh-4rem)] bg-surface-0 border-r border-border-muted shrink-0 transition-all duration-200 overflow-hidden', isOpen ? 'w-72' : 'w-0')}>
      <div className="flex flex-col h-full overflow-y-auto w-72 pb-24">
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
          <span className="text-small text-muted font-medium uppercase tracking-wide px-3">Categories</span>
          <nav className="stack-sm">
            {visibleTags.map(node => <TagNavItem key={node.slug} node={node} parentPath="" pathname={pathname} depth={0} />)}
          </nav>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;