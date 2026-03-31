// src/app/[[...path]]/IdeasView.tsx

'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Plus, MessageSquare, LayoutGrid, List } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { UserAvatar } from '@/components/UserAvatar';
import { Badge, Button, Input } from '@/components/ui';
import { useAuth } from '@/hooks';
import { cn, slugify, formatRelativeTime } from '@/lib/utils';
import { findTagByPath, getMetadataKeys, type SortOrder } from '@/lib/tags';
import { SortToggle } from './PageContent';
import type { WikiPage, PageMetadata, IdeasPage } from '@/types';

function parseAssignee(raw?: string): { name: string; address: string } | null {
  if (!raw) return null;
  try { const p = JSON.parse(raw); return p.name ? p : null; } catch { return raw ? { name: raw, address: '' } : null; }
}

function AssigneeChip({ raw }: { raw?: string }) {
  const assignee = parseAssignee(raw);
  if (!assignee) return null;
  return (
    <span className="assignee-chip">
      {assignee.address ? <UserAvatar radixAddress={assignee.address} size="sm" /> : null}
      <span>{assignee.name}</span>
    </span>
  );
}

/** Strip leading emoji/symbol prefix from metadata values (e.g. "🔵 In Progress" → "In Progress") */
function normalizeField(raw?: string): string {
  if (!raw) return '';
  return raw.replace(/^[^\p{Lu}\p{Ll}\p{Nd}]+/u, '');
}

/** Derive a semantic color token from the emoji prefix in a tags.ts option string */
const EMOJI_COLOR: Record<string, string> = {
  '\u{1F534}': 'accent',   // 🔴
  '\u{1F7E0}': 'danger',   // 🟠
  '\u{1F7E1}': 'warning',  // 🟡
  '\u{1F535}': 'info',     // 🔵
  '\u{1F7E3}': 'purple',   // 🟣
  '\u{1F7E2}': 'success',  // 🟢
};

function emojiColor(raw: string): string {
  const cp = String.fromCodePoint(raw.codePointAt(0)!);
  return EMOJI_COLOR[cp] ?? 'default';
}

type ColorToken = string;
interface StatusOption { raw: string; label: string; color: ColorToken }

function parseSelectOptions(options: string[]): StatusOption[] {
  return options.map(raw => ({ raw, label: normalizeField(raw), color: emojiColor(raw) }));
}

const BADGE_VARIANT: Record<string, string> = {
  accent: 'default', danger: 'danger', warning: 'warning',
  info: 'info', purple: 'secondary', success: 'success', default: 'default',
};

function BoardCard({ page, priorityOptions }: { page: WikiPage; priorityOptions: StatusOption[] }) {
  const meta = (page.metadata as PageMetadata) || {};
  const prio = priorityOptions.find(o => o.label === normalizeField(meta.priority));
  return (
    <Link href={`/${page.tagPath}/${page.slug}`} className="board-card">
      <span className="board-card-title">{page.title}</span>
      <div className="board-card-meta">
        {meta.priority && <Badge variant={(BADGE_VARIANT[prio?.color ?? 'default'] ?? 'default') as 'default'}>{normalizeField(meta.priority)}</Badge>}
        {meta.category && <Badge variant="secondary">{normalizeField(meta.category)}</Badge>}
        <AssigneeChip raw={meta.assignee} />
      </div>
    </Link>
  );
}

function IdeasListView({ pages, categoryFilter, statusFilter, statusOptions, priorityOptions }: {
  pages: IdeasPage[]; categoryFilter: string; statusFilter: string;
  statusOptions: StatusOption[]; priorityOptions: StatusOption[];
}) {
  const filtered = useMemo(() => {
    let result = pages;
    if (categoryFilter) result = result.filter(p => normalizeField((p.metadata as PageMetadata)?.category) === categoryFilter);
    if (statusFilter) result = result.filter(p => normalizeField((p.metadata as PageMetadata)?.status) === statusFilter);
    return result;
  }, [pages, categoryFilter, statusFilter]);

  if (filtered.length === 0) return <div className="board-empty">No ideas yet.</div>;

  return (
    <div className="ideas-list">
      {filtered.map(p => {
        const meta = (p.metadata as PageMetadata) || {};
        const st = statusOptions.find(o => o.label === normalizeField(meta.status));
        const pr = priorityOptions.find(o => o.label === normalizeField(meta.priority));
        return (
          <Link key={p.id} href={`/${p.tagPath}/${p.slug}`} className="ideas-row">
            <div className="ideas-row-main">
              <span className="ideas-row-title">{p.title}</span>
              <div className="ideas-row-badges">
                {meta.status && <Badge variant={(BADGE_VARIANT[st?.color ?? 'default'] ?? 'default') as 'default'}>{normalizeField(meta.status)}</Badge>}
                {meta.category && <Badge variant="secondary">{normalizeField(meta.category)}</Badge>}
                {meta.priority && <Badge variant={(BADGE_VARIANT[pr?.color ?? 'default'] ?? 'default') as 'default'}>{normalizeField(meta.priority)}</Badge>}
              </div>
            </div>
            <div className="ideas-row-meta">
              <AssigneeChip raw={meta.assignee} />
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
  const [view, setView] = useState<'list' | 'board'>('board');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const metaKeys = useMemo(() => getMetadataKeys(tagPath), [tagPath]);
  const statusOptions = useMemo(() => parseSelectOptions(metaKeys.find(k => k.key === 'status')?.options ?? []), [metaKeys]);
  const priorityOptions = useMemo(() => parseSelectOptions(metaKeys.find(k => k.key === 'priority')?.options ?? []), [metaKeys]);

  const sorted = useMemo(() => sortPages(pages, sort), [pages, sort]);

  const columns = useMemo(() => {
    const filtered = categoryFilter
      ? sorted.filter(p => normalizeField((p.metadata as PageMetadata)?.category) === categoryFilter)
      : sorted;
    return statusOptions.map(opt => ({
      ...opt,
      items: filtered.filter(p => normalizeField((p.metadata as PageMetadata)?.status) === opt.label),
    }));
  }, [sorted, categoryFilter, statusOptions]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of pages) {
      const c = normalizeField((p.metadata as PageMetadata)?.category);
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
            {statusOptions.map(o => (
              <button key={o.label} className={cn('status-tab', statusFilter === o.label && `border-${o.color} text-${o.color}`)} onClick={() => setStatusFilter(o.label)}>{o.label}</button>
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
          <IdeasListView pages={sorted} categoryFilter={categoryFilter} statusFilter={statusFilter} statusOptions={statusOptions} priorityOptions={priorityOptions} />
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
          {columns.map(({ label, color, items }) => (
            <div key={label} className="board-column">
              <div className="board-column-head">
                <span className="flex items-center gap-2"><span className={cn('size-2 rounded-full', `bg-${color}`)} />{label}</span>
                <Badge>{items.length}</Badge>
              </div>
              <div className="board-column-body">
                {items.length > 0 ? items.map(p => <BoardCard key={p.id} page={p} priorityOptions={priorityOptions} />) : <div className="board-empty">No items</div>}
              </div>
            </div>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
