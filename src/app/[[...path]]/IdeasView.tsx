// src/app/[[...path]]/IdeasView.tsx

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, MessageSquare, LayoutGrid, List } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Badge, Button, Input } from '@/components/ui';
import { useAuth } from '@/hooks';
import { cn, slugify, formatRelativeTime } from '@/lib/utils';
import { findTagByPath, type SortOrder } from '@/lib/tags';
import { SortToggle } from './PageContent';
import type { WikiPage, PageMetadata, IdeasPage } from '@/types';

const IDEAS_STATUS_COLUMNS = ['Discussion', 'Proposed', 'Approved', 'In Progress', 'Testing', 'Done'] as const;
const PRIORITY_VARIANT: Record<string, 'danger' | 'warning' | 'success'> = { High: 'danger', Medium: 'warning', Low: 'success' };
const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'info' | 'success' | 'warning' | 'danger'> = {
  Discussion: 'default', Proposed: 'danger', Approved: 'warning', 'In Progress': 'info', Testing: 'secondary', Done: 'success',
};
const STATUS_TAB_COLOR: Record<string, string> = {
  Discussion: 'border-accent text-accent', Proposed: 'border-danger text-danger',
  Approved: 'border-warning text-warning', 'In Progress': 'border-info text-info',
  Testing: 'border-purple text-purple', Done: 'border-success text-success',
};
const STATUS_DOT: Record<string, string> = {
  Discussion: 'bg-accent', Proposed: 'bg-danger', Approved: 'bg-warning',
  'In Progress': 'bg-info', Testing: 'bg-purple', Done: 'bg-success',
};

function BoardCard({ page }: { page: WikiPage }) {
  const meta = (page.metadata as PageMetadata) || {};
  return (
    <Link href={`/${page.tagPath}/${page.slug}`} className="board-card">
      <span className="board-card-title">{page.title}</span>
      <div className="board-card-meta">
        {meta.priority && <Badge variant={PRIORITY_VARIANT[meta.priority] || 'default'}>{meta.priority}</Badge>}
        {meta.category && <Badge variant="secondary">{meta.category}</Badge>}
        {meta.owner && <span className="text-text-muted text-xs">{meta.owner.replace(/<[^>]*>/g, ' ').trim()}</span>}
      </div>
    </Link>
  );
}

function IdeasListView({ pages, categoryFilter, statusFilter }: { pages: IdeasPage[]; categoryFilter: string; statusFilter: string }) {
  const filtered = useMemo(() => {
    let result = pages;
    if (categoryFilter) result = result.filter(p => (p.metadata as PageMetadata)?.category === categoryFilter);
    if (statusFilter) result = result.filter(p => (p.metadata as PageMetadata)?.status === statusFilter);
    return result;
  }, [pages, categoryFilter, statusFilter]);

  if (filtered.length === 0) return <div className="board-empty">No ideas yet.</div>;

  return (
    <div className="ideas-list">
      {filtered.map(p => {
        const meta = (p.metadata as PageMetadata) || {};
        return (
          <Link key={p.id} href={`/${p.tagPath}/${p.slug}`} className="ideas-row">
            <div className="ideas-row-main">
              <span className="ideas-row-title">{p.title}</span>
              <div className="ideas-row-badges">
                {meta.status && <Badge variant={STATUS_VARIANT[meta.status] || 'default'}>{meta.status}</Badge>}
                {meta.category && <Badge variant="secondary">{meta.category}</Badge>}
                {meta.priority && <Badge variant={PRIORITY_VARIANT[meta.priority] || 'default'}>{meta.priority}</Badge>}
              </div>
            </div>
            <div className="ideas-row-meta">
              <span className="ideas-row-replies"><MessageSquare size={14} />{p.replyCount}</span>
              <span className="ideas-row-activity">{formatRelativeTime(p.lastActivity)}</span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function sortPages(pages: IdeasPage[], sort: SortOrder): IdeasPage[] {
  return [...pages].sort((a, b) => {
    if (sort === 'title') return a.title.localeCompare(b.title);
    if (sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
  });
}

export default function IdeasView({ tagPath, pages, sort }: { tagPath: string[]; pages: IdeasPage[]; sort: SortOrder }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const pathStr = tagPath.join('/');
  const tag = findTagByPath(tagPath);
  const [view, setView] = useState<'list' | 'board'>('list');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const sorted = useMemo(() => sortPages(pages, sort), [pages, sort]);

  const columns = useMemo(() => {
    const filtered = categoryFilter ? sorted.filter(p => (p.metadata as PageMetadata)?.category === categoryFilter) : sorted;
    return IDEAS_STATUS_COLUMNS.map(status => ({
      status,
      items: filtered.filter(p => (p.metadata as PageMetadata)?.status === status),
    }));
  }, [sorted, categoryFilter]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of pages) {
      const c = (p.metadata as PageMetadata)?.category;
      if (c) set.add(c);
    }
    return [...set].sort();
  }, [pages]);

  return (
    <div className="stack">
      <Breadcrumbs path={tagPath} />
      <div className="spread">
        <h1>{tag?.name || tagPath[tagPath.length - 1]}</h1>
        <div className="row">
          <SortToggle sort={sort} tagPath={pathStr} />
          <button className={cn('icon-btn', view === 'list' && 'text-accent')} onClick={() => setView('list')} title="List view"><List size={18} /></button>
          <button className={cn('icon-btn', view === 'board' && 'text-accent')} onClick={() => setView('board')} title="Board view"><LayoutGrid size={18} /></button>
          {isAuthenticated && (
            showCreate ? (
              <>
                <Input value={newSlug} onChange={e => setNewSlug(e.target.value)} placeholder="idea-slug" className="w-48" onKeyDown={e => e.key === 'Enter' && newSlug.trim() && router.push(`/${pathStr}/${slugify(newSlug)}`)} autoFocus />
                <Button size="sm" onClick={() => { const s = slugify(newSlug); if (s) router.push(`/${pathStr}/${s}`); }} disabled={!newSlug.trim()}>Go</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
              </>
            ) : <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={16} />New Idea</Button>
          )}
        </div>
      </div>
      {view === 'list' ? (
        <div className="ideas-panel">
          <div className="status-tabs">
            <button className={cn('status-tab', statusFilter === '' && 'border-accent text-accent')} onClick={() => setStatusFilter('')}>All</button>
            {IDEAS_STATUS_COLUMNS.map(s => (
              <button key={s} className={cn('status-tab', statusFilter === s && STATUS_TAB_COLOR[s])} onClick={() => setStatusFilter(s)}>{s}</button>
            ))}
          </div>
          {categories.length > 0 && (
            <div className="status-tabs">
              <button className={cn('status-tab', categoryFilter === '' && 'border-text text-text')} onClick={() => setCategoryFilter('')}>All Types</button>
              {categories.map(c => (
                <button key={c} className={cn('status-tab', categoryFilter === c && 'border-text text-text')} onClick={() => setCategoryFilter(c)}>{c}</button>
              ))}
            </div>
          )}
          <IdeasListView pages={sorted} categoryFilter={categoryFilter} statusFilter={statusFilter} />
        </div>
      ) : (
        <div className="ideas-panel">
          {categories.length > 0 && (
            <div className="status-tabs">
              <button className={cn('status-tab', categoryFilter === '' && 'border-text text-text')} onClick={() => setCategoryFilter('')}>All Types</button>
              {categories.map(c => (
                <button key={c} className={cn('status-tab', categoryFilter === c && 'border-text text-text')} onClick={() => setCategoryFilter(c)}>{c}</button>
              ))}
            </div>
          )}
          <div className="board-columns">
          {columns.map(({ status, items }) => (
            <div key={status} className="board-column">
              <div className="board-column-head">
                <span className="flex items-center gap-2"><span className={cn('size-2 rounded-full', STATUS_DOT[status])} />{status}</span>
                <Badge>{items.length}</Badge>
              </div>
              <div className="board-column-body">
                {items.length > 0 ? items.map(p => <BoardCard key={p.id} page={p} />) : <div className="board-empty">No items</div>}
              </div>
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
