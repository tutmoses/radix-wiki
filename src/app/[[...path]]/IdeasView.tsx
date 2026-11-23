// src/app/[[...path]]/IdeasView.tsx

'use client';

import { useState, useMemo, type ComponentProps } from 'react';
import Link from 'next/link';
import { MessageSquare, LayoutGrid, List, User } from 'lucide-react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { UserAvatar } from '@/components/UserAvatar';
import { Badge } from '@/components/ui';
import { categoryLabel, cn } from '@/lib/utils';
import { slugifyHeading } from 'wiki-formant/headings';
import { AGO, useNow } from '@/lib/now';
import { formatDay, relativeTime } from 'wiki-formant/freshness';
import { boardColumn, findTagByPath, getMetadataKeys, UNPLACED_COLUMN, type SortOrder } from '@/lib/tags';
import { NewPageControl, SortToggle } from './PageContent';
import type { PageMetadata, IdeasPage } from '@/types';
import { EmptyState } from '@/components/EmptyState';
import { readAssignee } from '@/lib/assignee';
import { CardProgress, isOverdue } from '@/components/CardProgress';

function TargetChip({ meta }: { meta: PageMetadata }) {
  const now = useNow();
  if (!meta.target) return null;
  const overdue = isOverdue(meta, now);
  return <span className={cn('assignee-chip', overdue && 'text-error')}>{overdue ? 'Overdue: ' : 'Target: '}{formatDay(meta.target, { month: 'short', day: 'numeric' })}</span>;
}

function AssigneeChip({ raw }: { raw?: string }) {
  const assignee = readAssignee(raw);
  if (assignee.kind === 'none') return null;
  return (
    <span className="assignee-chip">
      {assignee.kind === 'member' && assignee.address ? <UserAvatar seed={assignee.address} size="sm" /> : <User size={12} />}
      <span>{assignee.name}</span>
    </span>
  );
}

/** The colour token and badge an option takes from the emoji prefix of its tags.ts string. */
type Tone = { color: string; variant: ComponentProps<typeof Badge>['variant'] };
const DEFAULT_TONE: Tone = { color: 'default', variant: 'default' };
const EMOJI_TONE: Record<string, Tone> = {
  '\u{1F534}': { color: 'accent', variant: 'default' },     // 🔴
  '\u{1F7E0}': { color: 'danger', variant: 'danger' },      // 🟠
  '\u{1F7E1}': { color: 'warning', variant: 'warning' },    // 🟡
  '\u{1F535}': { color: 'info', variant: 'info' },          // 🔵
  '\u{1F7E3}': { color: 'purple', variant: 'secondary' },   // 🟣
  '\u{1F7E2}': { color: 'success', variant: 'success' },    // 🟢
  '\u{3194}': { color: 'danger', variant: 'danger' },       // ㆔ High
  '\u{3193}': { color: 'warning', variant: 'warning' },     // ㆓ Medium
  '\u{2F00}': { color: 'default', variant: 'secondary' },   // ⼀ Low
};

type StatusOption = { raw: string; label: string } & Tone;

function parseSelectOptions(options: string[]): StatusOption[] {
  return options.map(raw => ({ raw, label: categoryLabel(raw), ...(EMOJI_TONE[String.fromCodePoint(raw.codePointAt(0)!)] ?? DEFAULT_TONE) }));
}

/** A metadata value as a badge in its option's colour. */
function OptionBadge({ options, value, className }: { options: StatusOption[]; value?: string; className?: string }) {
  if (!value) return null;
  const label = categoryLabel(value);
  return <Badge variant={options.find(o => o.label === label)?.variant} className={className}>{label}</Badge>;
}

/**
 * A card read top to bottom: whose it is and how urgent, what it is, how far
 * along, then who has it, by when, and how much talk.
 */
function BoardCard({ page, priorityOptions }: { page: IdeasPage; priorityOptions: StatusOption[] }) {
  const meta = (page.metadata as PageMetadata) || {};
  return (
    <Link href={`/${page.tagPath}/${page.slug}`} className="board-card">
      {(meta.workingGroup || meta.priority) && (
        <div className="board-card-head">
          <span>{meta.workingGroup}</span>
          <OptionBadge options={priorityOptions} value={meta.priority} className="badge-sm shrink-0" />
        </div>
      )}
      <span className="board-card-title">{page.title}</span>
      <CardProgress progress={page.progress} />
      <div className="board-card-meta">
        <AssigneeChip raw={meta.assignee} />
        <TargetChip meta={meta} />
        {page.replyCount > 0 && <span className="assignee-chip ml-auto" title={`${page.replyCount} replies`}><MessageSquare size={12} />{page.replyCount}</span>}
      </div>
    </Link>
  );
}

function IdeasListView({ pages, statusFilter, statusOptions, priorityOptions }: {
  pages: IdeasPage[]; statusFilter: string;
  statusOptions: StatusOption[]; priorityOptions: StatusOption[];
}) {
  const now = useNow();
  const filtered = useMemo(
    () => (statusFilter ? pages.filter(p => categoryLabel((p.metadata as PageMetadata)?.status) === statusFilter) : pages),
    [pages, statusFilter],
  );

  if (filtered.length === 0) return <EmptyState title={pages.length ? 'No ideas match this filter.' : 'No ideas yet.'} />;

  return (
    <div className="ideas-list">
      {filtered.map(p => {
        const meta = (p.metadata as PageMetadata) || {};
        return (
          <Link key={p.id} href={`/${p.tagPath}/${p.slug}`} className="ideas-row">
            <div className="ideas-row-main">
              <span className="ideas-row-title">{p.title}</span>
              <div className="ideas-row-badges">
                <OptionBadge options={statusOptions} value={meta.status} />
                {meta.workingGroup && <Badge variant="secondary">{meta.workingGroup}</Badge>}
                <OptionBadge options={priorityOptions} value={meta.priority} />
              </div>
            </div>
            <div className="ideas-row-meta">
              <CardProgress progress={p.progress} />
              <TargetChip meta={meta} />
              <AssigneeChip raw={meta.assignee} />
              <span className="ideas-row-replies"><MessageSquare size={14} />{p.replyCount}</span>
              <span className="ideas-row-activity">{relativeTime(p.lastActivity, now, AGO)}</span>
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
    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
  });
}

export default function IdeasView({ tagPath, pages, sort }: { tagPath: string[]; pages: IdeasPage[]; sort: SortOrder }) {
  const pathStr = tagPath.join('/');
  const tag = findTagByPath(tagPath);
  const [view, setView] = useState<'list' | 'board'>('board');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const metaKeys = useMemo(() => getMetadataKeys(tagPath), [tagPath]);
  const statusOptions = useMemo(() => parseSelectOptions(metaKeys.find(k => k.key === 'status')?.options ?? []), [metaKeys]);
  const priorityOptions = useMemo(() => parseSelectOptions(metaKeys.find(k => k.key === 'priority')?.options ?? []), [metaKeys]);

  // The working-group filter both views apply; the list adds its status filter.
  const filtered = useMemo(() => {
    const sorted = sortPages(pages, sort);
    return groupFilter ? sorted.filter(p => (p.metadata as PageMetadata)?.workingGroup === groupFilter) : sorted;
  }, [pages, sort, groupFilter]);

  const columns = useMemo(() => {
    // A card whose status the board does not offer gets a column of its own, as
    // get_ideas_board gives it, rather than appearing in none.
    const raws = statusOptions.map(o => o.raw);
    const unplaced = filtered.filter(p => boardColumn(p.metadata, raws) === null);
    return [
      ...statusOptions.map(opt => ({ ...opt, items: filtered.filter(p => boardColumn(p.metadata, raws) === opt.raw) })),
      ...(unplaced.length ? [{ raw: '', label: UNPLACED_COLUMN, ...DEFAULT_TONE, items: unplaced }] : []),
    ];
  }, [filtered, statusOptions]);

  // The groups the cards carry, in the order tags.ts lists them.
  const groups = useMemo(() => {
    const held = new Set(pages.map(p => (p.metadata as PageMetadata)?.workingGroup));
    return (metaKeys.find(k => k.key === 'workingGroup')?.options ?? []).filter(g => held.has(g));
  }, [pages, metaKeys]);

  // The one filter row both views carry.
  const groupTabs = groups.length > 0 && (
    <div className="status-tabs">
      <button className={cn('status-tab', groupFilter === '' && 'border-text text-text')} onClick={() => setGroupFilter('')}>All groups</button>
      {groups.map(g => (
        <button key={g} className={cn('status-tab', groupFilter === g && 'border-text text-text')} onClick={() => setGroupFilter(g)}>{g}</button>
      ))}
    </div>
  );

  return (
    <div className="stack">
      <Breadcrumbs path={tagPath} />
      <div className="spread">
        <h1 id={slugifyHeading(tag?.name || tagPath[tagPath.length - 1] || '')}>{tag?.name || tagPath[tagPath.length - 1]}</h1>
        {/* The board is the page's one region and the list view carries no
            headings at all, so without this the document is an h1 and nothing
            else. Named for a screen reader and an outline parser; the tabs
            below already say it on screen. */}
        <h2 className="sr-only">Ideas</h2>
        <div className="row">
          <SortToggle sort={sort} tagPath={pathStr} />
          <button className={cn('icon-btn', view === 'list' && 'text-accent')} onClick={() => setView('list')} title="List view"><List size={18} /></button>
          <button className={cn('icon-btn', view === 'board' && 'text-accent')} onClick={() => setView('board')} title="Board view"><LayoutGrid size={18} /></button>
          <NewPageControl tagPath={pathStr} noun="Idea" />
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
          {groupTabs}
          <IdeasListView pages={filtered} statusFilter={statusFilter} statusOptions={statusOptions} priorityOptions={priorityOptions} />
        </div>
      ) : (
        <div className="ideas-panel">
          {groupTabs}
          <div className="board-columns">
          {columns.map(({ label, color, items }) => (
            <div key={label} className="board-column">
              <h3 className="board-column-head">
                <span className="row"><span className={cn('size-2 rounded-full', `bg-${color}`)} />{label}</span>
                <Badge>{items.length}</Badge>
              </h3>
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
