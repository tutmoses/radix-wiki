// src/components/HistoryView.tsx

'use client';

import { useState, useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RotateCcw, Plus, Minus, Pencil, Move, ChevronDown } from 'lucide-react';
import { Button, Badge, SortHead } from '@/components/ui';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { useAuth } from '@/hooks';
import { UserAvatar } from '@/components/UserAvatar';
import { changeSummary } from 'wiki-formant/revisions';
import { useTableSort } from 'wiki-formant/react';
import { formatDate, cn, pagePath } from '@/lib/utils';
import { stripHtml } from '@/lib/content';
import { BLOCK_META } from '@/lib/block-utils';
import type { BlockType } from '@/types/blocks';
import type { BlockChange } from '@/lib/versioning';

interface RevisionData {
  id: string;
  title: string;
  version: string;
  changeType: string;
  changes: BlockChange[] | null;
  message?: string | null;
  createdAt: Date;
  author?: { id: string; displayName?: string | null; shortAddress: string; avatarUrl?: string | null };
}

export type HistoryData = { currentVersion: string; revisions: RevisionData[] } | null;

const TYPE_BADGE: Record<string, { label: string; variant: 'danger' | 'warning' | 'secondary' }> = {
  major: { label: 'Major', variant: 'danger' },
  minor: { label: 'Minor', variant: 'warning' },
  patch: { label: 'Patch', variant: 'secondary' },
};

const CONTAINER_TYPES = new Set(['infobox', 'columns']);

const TYPE_WEIGHT: Record<string, number> = { patch: 0, minor: 1, major: 2 };
const authorName = (r: RevisionData) => r.author?.displayName || r.author?.shortAddress || '';
const REVISION_COMPARATORS = {
  version: (a: RevisionData, b: RevisionData) => a.version.localeCompare(b.version, undefined, { numeric: true }),
  type: (a: RevisionData, b: RevisionData) => (TYPE_WEIGHT[a.changeType] ?? 0) - (TYPE_WEIGHT[b.changeType] ?? 0),
  changes: (a: RevisionData, b: RevisionData) => (a.changes?.length ?? 0) - (b.changes?.length ?? 0),
  author: (a: RevisionData, b: RevisionData) => authorName(a).localeCompare(authorName(b)),
  date: (a: RevisionData, b: RevisionData) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
};
// Authors read A–Z first; everything else opens newest or largest first.
const firstDirection = (key: string): 'asc' | 'desc' => (key === 'author' ? 'asc' : 'desc');
const NO_REVISIONS: RevisionData[] = [];

// The counted phrasing is `wiki-formant/revisions`, the one the stored revision
// message already uses. Containers are dropped first (this view never lists
// them) and an empty set reads off the revision's own change type instead.
function ChangeSummary({ changes, changeType }: { changes: BlockChange[]; changeType: string }) {
  const visible = changes.filter(c => !CONTAINER_TYPES.has(c.type));
  const summary = visible.length
    ? changeSummary({ changes: visible, titleChanged: false })
    : changeType === 'major' ? 'Structural changes' : changeType === 'minor' ? 'Content updated' : changeType === 'patch' ? 'Metadata updated' : 'No changes';
  return <span className="text-xs text-text-muted">{summary}</span>;
}

function ContentDiff({ from, to }: { from: string; to: string }) {
  const [parts, setParts] = useState<[number, string][] | null>(null);

  useEffect(() => {
    const a = stripHtml(from || '');
    const b = stripHtml(to || '');
    if (a === b) return;
    import('fast-diff').then(({ default: fastDiff }) => {
      setParts(fastDiff(a, b).filter(([, t]) => t.trim()));
    });
  }, [from, to]);

  if (!parts || parts.length === 0) return null;

  return (
    <div className="mt-1 text-xs leading-relaxed">
      {parts.map(([type, text], i) =>
        type === -1 ? <span key={i} className="text-error/80 line-through">{text}</span>
        : type === 1 ? <span key={i} className="text-success bg-success/10 rounded-xs px-0.5">{text}</span>
        : <span key={i} className="text-text-muted">{text.length > 60 ? text.slice(0, 30) + '…' + text.slice(-30) : text}</span>
      )}
    </div>
  );
}

function formatBlockPath(path: string, type: string): string {
  const parts = path.replace('root.', '').split('.');
  const segments: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 'columns' && parts[i + 1] !== undefined) {
      segments.push(`Col ${parseInt(parts[i + 1]!) + 1}`);
      i++; // skip the column index
    } else if (parts[i] === 'blocks' && parts[i + 1] !== undefined) {
      segments.push(`Block ${parseInt(parts[i + 1]!) + 1}`);
      i++; // skip the block index
    } else if (!isNaN(parseInt(parts[i]!))) {
      segments.push(`Block ${parseInt(parts[i]!) + 1}`);
    }
  }

  const location = segments.length ? segments.join(' → ') : 'root';
  // Editor labels, except that a content block is 'Text' where it is being read
  // rather than inserted. An unknown type is a block this build no longer has.
  const typeLabel = type === 'content' ? 'Text' : BLOCK_META[type as BlockType]?.label ?? type;
  return `${typeLabel} at ${location}`;
}

function ExpandedChanges({ changes }: { changes: BlockChange[] }) {
  const visible = changes.filter(c => !CONTAINER_TYPES.has(c.type));
  return (
    <tr><td colSpan={6} className="p-0!">
      <div className="bg-surface-0 p-3 border-t border-border-muted stack-sm">
        {visible.map((c, i) => {
          const icons = { added: <Plus size={12} className="text-success" />, removed: <Minus size={12} className="text-error" />, modified: <Pencil size={12} className="text-warning" />, moved: <Move size={12} className="text-info" /> };
          const colors = { added: 'text-success', removed: 'text-error', modified: 'text-warning', moved: 'text-info' };
          const textAttr = c.attributes?.text as { from: string; to: string } | undefined;
          const fromText = c.leafDiff?.from ?? textAttr?.from ?? '';
          const toText = c.leafDiff?.to ?? textAttr?.to ?? '';
          const hasTextChange = fromText || toText;
          return (
            <div key={i} className="text-xs">
              <div className="row gap-2">
                {icons[c.action]}
                <span className={cn('capitalize font-medium', colors[c.action])}>{c.action}</span>
                <span className="text-text-muted">—</span>
                <span>{formatBlockPath(c.path, c.type)}</span>
              </div>
              {hasTextChange && <ContentDiff from={fromText} to={toText} />}
            </div>
          );
        })}
      </div>
    </td></tr>
  );
}

export function HistoryView({ data, tagPath, slug, isHomepage }: { data: HistoryData; tagPath: string; slug: string; isHomepage?: boolean }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { sorted, headerProps } = useTableSort<RevisionData, keyof typeof REVISION_COMPARATORS>(data?.revisions ?? NO_REVISIONS, { defaultKey: 'date', comparators: REVISION_COMPARATORS, defaultDirection: firstDirection });

  const apiBase = isHomepage ? '/api/wiki' : `/api/wiki${pagePath(tagPath, slug)}`;
  const viewPath = isHomepage ? '/' : pagePath(tagPath, slug);

  if (!data) {
    return (
      <div className="stack">
        {!isHomepage && <Breadcrumbs path={[...tagPath.split('/'), slug].filter(Boolean)} suffix="History" />}
        <div className="surface p-12 text-center"><p className="text-error">Page not found</p></div>
      </div>
    );
  }

  const handleRestore = async (revisionId: string) => {
    if (!confirm('Restore this revision?')) return;
    setRestoringId(revisionId);
    try {
      const r = await fetch(`${apiBase}/history`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revisionId }) });
      if (r.ok) router.push(viewPath);
      else alert((await r.json()).error || 'Failed to restore');
    } catch { alert('Failed to restore'); }
    finally { setRestoringId(null); }
  };

  return (
    <div className="stack">
      {!isHomepage && <Breadcrumbs path={[...tagPath.split('/'), slug].filter(Boolean)} suffix="History" />}
      <div className="spread">
        <h1 id={isHomepage ? 'homepage-history' : 'page-history'} className="m-0!">{isHomepage ? 'Homepage' : 'Page'} History</h1>
        <Link href={viewPath}><Button variant="secondary" size="sm"><ArrowLeft size={16} />Back</Button></Link>
      </div>
      {data.revisions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead>
              <tr className="text-left text-text-muted">
                <SortHead {...headerProps('version')} className="py-2 px-3 font-medium w-24">Version</SortHead>
                <SortHead {...headerProps('type')} className="py-2 px-3 font-medium w-20">Type</SortHead>
                <SortHead {...headerProps('changes')} className="py-2 px-3 font-medium">Changes</SortHead>
                <SortHead {...headerProps('author')} className="py-2 px-3 font-medium">Author</SortHead>
                <SortHead {...headerProps('date')} className="py-2 px-3 font-medium w-36">Date</SortHead>
                <th className="py-2 px-3 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((rev, i) => {
                // The newest revision is the current one wherever the sort puts it.
                const isCurrent = rev.id === data.revisions[0]?.id;
                const type = TYPE_BADGE[rev.changeType] ?? TYPE_BADGE.patch!;
                const changes = rev.changes || [];
                const isExpanded = expandedId === rev.id;
                return (
                  <Fragment key={rev.id}>
                    <tr className={cn('border-t border-border-muted hover:bg-surface-1/50', isCurrent && 'bg-accent/5', i === 0 && '[&>td]:rounded-none')}>
                      <td className="py-2 px-3">
                        <span className="font-mono font-medium">v{rev.version}</span>
                        {isCurrent && <Badge variant="default" className="ml-2 text-xs py-0">current</Badge>}
                      </td>
                      <td className="py-2 px-3"><Badge variant={type.variant}>{type.label}</Badge></td>
                      <td className="py-2 px-3">
                        <div className="row gap-3">
                          <ChangeSummary changes={changes} changeType={rev.changeType} />
                          {changes.length > 0 && (
                            <button onClick={() => setExpandedId(isExpanded ? null : rev.id)} className="text-accent hover:text-accent-hover">
                              <ChevronDown size={14} className={cn('transition-transform', isExpanded && 'rotate-180')} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 truncate max-w-32">
                        {rev.author ? (
                          <Link href={`/leaderboard#u-${rev.author.id}`} className="row text-text-muted hover:text-accent">
                            <UserAvatar seed={rev.author.id} avatarUrl={rev.author.avatarUrl} size="sm" />
                            {rev.author.displayName || rev.author.shortAddress}
                          </Link>
                        ) : '—'}
                      </td>
                      <td className="py-2 px-3 text-text-muted">{formatDate(rev.createdAt, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="py-2 px-3">
                        {isAuthenticated && !isCurrent && (
                          <button onClick={() => handleRestore(rev.id)} disabled={restoringId === rev.id} className="restore-btn">
                            <RotateCcw size={14} /><span>{restoringId === rev.id ? '…' : 'Restore'}</span>
                          </button>
                        )}
                      </td>
                    </tr>
                    {isExpanded && changes.length > 0 && <ExpandedChanges changes={changes} />}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="surface p-12 text-center"><p className="text-text-muted">No revision history available.</p></div>
      )}
    </div>
  );
}

export default HistoryView;
