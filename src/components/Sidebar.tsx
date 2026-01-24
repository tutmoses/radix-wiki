// src/components/Sidebar.tsx

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, ChevronRight, ChevronDown, Settings } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useStore, useAuth } from '@/hooks';
import { getVisibleTags, type TagNode } from '@/lib/tags';

function NavItem({ href, icon, label, isActive, onClick }: { href: string; icon: React.ReactNode; label: string; isActive?: boolean; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className={cn('row px-3 py-2 rounded-md transition-colors', isActive ? 'bg-accent-muted text-accent font-medium' : 'text-muted hover:bg-surface-2 hover:text-text')}>
      {icon}<span>{label}</span>
    </Link>
  );
}

function TagNavItem({ node, parentPath, pathname, onClose, depth }: { node: TagNode; parentPath: string; pathname: string; onClose?: () => void; depth: number }) {
  const currentPath = parentPath ? `${parentPath}/${node.slug}` : node.slug;
  const href = `/${currentPath}`;
  const isActive = pathname === href || pathname.startsWith(href + '/');
  const hasChildren = node.children && node.children.length > 0;
  const [isExpanded, setIsExpanded] = useState(isActive);

  return (
    <div className={cn(depth > 0 && 'ml-3')}>
      <div className="row">
        {hasChildren && <button onClick={() => setIsExpanded(!isExpanded)} className="icon-btn p-1 text-muted">{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</button>}
        <Link href={href} onClick={onClose} className={cn('flex-1 row px-2 py-1.5 rounded-md transition-colors', isActive ? 'bg-accent-muted text-accent font-medium' : 'text-muted hover:bg-surface-2 hover:text-text', !hasChildren && 'ml-5')}>{node.name}</Link>
      </div>
      {hasChildren && isExpanded && <div className="mt-1">{node.children!.map(child => <TagNavItem key={child.slug} node={child} parentPath={currentPath} pathname={pathname} onClose={onClose} depth={depth + 1} />)}</div>}
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { isAuthenticated } = useAuth();
  const { sidebarOpen, setSidebarOpen } = useStore();
  const visibleTags = getVisibleTags();
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <>
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 animate-[fade-in_0.2s_ease-out]" onClick={closeSidebar} />}
      <aside className={cn('fixed top-16 left-0 z-40 h-[calc(100vh-4rem)] w-72 max-w-[85vw] bg-surface-0 border-r border-border-muted transform transition-transform duration-200 ease-in-out', sidebarOpen ? 'translate-x-0' : '-translate-x-full')}>
        <div className="stack-lg p-4 h-full overflow-y-auto">
          <div className="stack-sm">
            <nav className="stack-sm">
              <NavItem href="/" icon={<Home size={18} />} label="Home" isActive={pathname === '/'} onClick={closeSidebar} />
            </nav>
          </div>
          <div className="stack-sm">
            <nav className="stack-sm">
              {visibleTags.map(node => <TagNavItem key={node.slug} node={node} parentPath="" pathname={pathname} onClose={closeSidebar} depth={0} />)}
            </nav>
          </div>
          {isAuthenticated && (
            <div className="mt-auto pt-4 border-t border-border-muted">
              <NavItem href="/settings" icon={<Settings size={18} />} label="Settings" isActive={pathname === '/settings'} onClick={closeSidebar} />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export default Sidebar;