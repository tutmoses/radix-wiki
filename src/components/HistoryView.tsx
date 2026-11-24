// src/components/HistoryView.tsx

'use client';

import { useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RotateCcw, ChevronDown } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { useAuth } from '@/hooks';
import { UserAvatar } from '@/components/UserAvatar';
import { EmptyState } from '@/components/EmptyState';
import { changeSummary } from 'wiki-formant/revisions';
import { SortHeader, restoreViaPost, useRevisionRestore, useTableSort } from 'wiki-formant/react';
import { RevisionChanges } from 'wiki-formant/react-server';
import { cn, pagePath } from '@/lib/utils';
import { formatDay } from 'wiki-formant/freshness';
import { BLOCK_META } from '@/lib/block-utils';
import type { BlockType } from '@/types/blocks';
import type { HistoryChange } from 'wiki-formant/history';
import type { ChangeType } from 'wiki-formant/versioning';

interface RevisionData {
  id: string;
  title: string;
  version: string;
  changeType: ChangeType;
  changes: HistoryChange[];
  message?: string | null;
  createdAt: Date;
  author?: { id: string; displayName?: string | null; shortAddress: string; avatarUrl?: string | null };
}

type HistoryData = {
  currentVersion: string;
  revisions: RevisionData[];
  /** A deleted page's: none of its revisions is current, so any of them brings it back. */
  deleted?: { at: Date; by: RevisionData['author'] | null };
};

const TYPE_BADGE: Record<string, { label: string; variant: 'danger' | 'warning' | 'secondary' }> = {
  major: { label: 'Major', variant: 'danger' },
  minor: { label: 'Minor', variant: 'warning' },
  patch: { label: 'Patch', variant: 'secondary' },
};

const TYPE_WEIGHT: Record<ChangeType, number> = { none: 0, patch: 0, minor: 1, major: 2 };
const authorName = (r: RevisionData) => r.author?.displayName || r.author?.shortAddress || '';
const REVISION_COMPARATORS = {
  version: (a: RevisionData, b: RevisionData) => a.version.localeCompare(b.version, undefined, { numeric: true }),
  type: (a: RevisionData, b: RevisionData) => TYPE_WEIGHT[a.changeType] - TYPE_WEIGHT[b.changeType],
  changes: (a: RevisionData, b: RevisionData) => a.changes.length - b.changes.length,
  author: (a: RevisionData, b: RevisionData) => authorName(a).localeCompare(authorName(b)),
  date: (a: RevisionData, b: RevisionData) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
};
// Authors read A–Z first; everything else opens newest or largest first.
const firstDirection = (key: string): 'asc' | 'desc' => (key === 'author' ? 'asc' : 'desc');

// The counted phrasing is `wiki-formant/revisions`, the one the stored revision
// message already uses. The server has already dropped containers (this view
// never lists them); an empty set reads off the revision's own change type.
const summarize = (changes: HistoryChange[], changeType: ChangeType) => changes.length
  ? changeSummary({ changes, titleChanged: false })
  : changeType === 'major' ? 'Structural changes' : changeType === 'minor' ? 'Content updated' : changeType === 'patch' ? 'Metadata updated' : 'No changes';

// Editor labels, except that a content block is 'Text' where it is being read
// rather than inserted. An unknown type is a block this build no longer has.
const blockLabel = (type: string) => (type === 'content' ? 'Text' : BLOCK_META[type as BlockType]?.label ?? type);

// Diffed on the server (`wiki-formant/history`); the list is the package's.
function ExpandedChanges({ changes }: { changes: HistoryChange[] }) {
  return (
    <tr><td colSpan={6} className="p-0!">
      <div className="revision-changes-panel"><RevisionChanges changes={changes} label={blockLabel} /></div>
    </td></tr>
  );
}

export default function HistoryView({ data, tagPath, slug, isHomepage }: { data: HistoryData; tagPath: string; slug: string; isHomepage?: boolean }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { sorted, headerProps } = useTableSort<RevisionData, keyof typeof REVISION_COMPARATORS>(data.revisions, { defaultKey: 'date', comparators: REVISION_COMPARATORS, defaultDirection: firstDirection });

  const apiBase = isHomepage ? '/api/wiki' : `/api/wiki${pagePath(tagPath, slug)}`;
  const viewPath = isHomepage ? '/' : pagePath(tagPath, slug);
  // A deleted page's own address is gone, so Back goes to its category.
  const backPath = data.deleted ? `/${tagPath}` : viewPath;
  // Confirm, POST, report: `wiki-formant/react`. A failure shows above the table.
  const { restore, busyId, error: restoreError } = useRevisionRestore<string>(restoreViaPost(`${apiBase}/history`), {
    onRestored: () => router.push(viewPath),
  });

  return (
    <div className="stack">
      {!isHomepage && <Breadcrumbs path={[...tagPath.split('/'), slug].filter(Boolean)} suffix="History" />}
      <div className="spread">
        <h1 id={isHomepage ? 'homepage-history' : 'page-history'} className="m-0!">{isHomepage ? 'Homepage' : 'Page'} History</h1>
        <Link href={backPath}><Button variant="secondary" size="sm"><ArrowLeft size={16} />Back</Button></Link>
      </div>
      {data.deleted && (
        <p className="text-small" role="status">
          Deleted {formatDay(data.deleted.at, { month: 'short', day: 'numeric', year: 'numeric' })}
          {data.deleted.by && <> by {data.deleted.by.displayName || data.deleted.by.shortAddress}</>}.
          {isAuthenticated ? ' Restore any revision to bring the page back.' : ' Sign in to restore it.'}
        </p>
      )}
      {restoreError && <p className="text-error text-small" role="alert">{restoreError}</p>}
      {data.revisions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead>
              <tr className="text-left text-text-muted">
                <SortHeader {...headerProps('version')} className="history-cell font-medium history-col-version">Version</SortHeader>
                <SortHeader {...headerProps('type')} className="history-cell font-medium w-20 hidden-mobile">Type</SortHeader>
                <SortHeader {...headerProps('changes')} className="history-cell font-medium">Changes</SortHeader>
                <SortHeader {...headerProps('author')} className="history-cell font-medium hidden-mobile">Author</SortHeader>
                <SortHeader {...headerProps('date')} className="history-cell font-medium history-col-date">Date</SortHeader>
                {isAuthenticated && <th className="history-cell font-medium sm:w-24"></th>}
              </tr>
            </thead>
            <tbody>
              {sorted.map((rev, i) => {
                // The newest revision is the current one wherever the sort puts it.
                const isCurrent = !data.deleted && rev.id === data.revisions[0]?.id;
                const type = TYPE_BADGE[rev.changeType] ?? TYPE_BADGE.patch!;
                const { changes } = rev;
                const summary = summarize(changes, rev.changeType);
                const isExpanded = expandedId === rev.id;
                const author = rev.author && (
                  <Link href={`/leaderboard#u-${rev.author.id}`} className="row text-text-muted hover:text-accent">
                    <UserAvatar seed={rev.author.id} avatarUrl={rev.author.avatarUrl} size="sm" />
                    {rev.author.displayName || rev.author.shortAddress}
                  </Link>
                );
                return (
                  <Fragment key={rev.id}>
                    <tr className={cn('border-t border-border-muted hover:bg-surface-1/50', isCurrent && 'bg-accent/5', i === 0 && '[&>td]:rounded-none')}>
                      <td className="history-cell">
                        <span className="font-mono font-medium">v{rev.version}</span>
                        {isCurrent && <Badge variant="default" className="badge-sm ml-2">current</Badge>}
                      </td>
                      <td className="history-cell hidden-mobile"><Badge variant={type.variant}>{type.label}</Badge></td>
                      <td className="history-cell">
                        <div className="row gap-3">
                          <span className="text-xs text-text-muted">{summary}</span>
                          {changes.length > 0 && (
                            <button type="button" onClick={() => setExpandedId(isExpanded ? null : rev.id)} className="text-accent hover:text-accent-hover"
                              aria-label={`Changes in v${rev.version}`} aria-expanded={isExpanded}>
                              <ChevronDown size={14} className={cn('transition-transform', isExpanded && 'rotate-180')} />
                            </button>
                          )}
                        </div>
                        {/* The editor's own summary; one left blank was stored as the counted one above. */}
                        {rev.message && rev.message !== summary && <div className="caption mt-1 wrap-anywhere">{rev.message}</div>}
                        {/* A phone has no room for the author's column, so the author signs the change. */}
                        {author && <div className="show-mobile text-xs mt-1">{author}</div>}
                      </td>
                      <td className="history-cell truncate max-w-32 hidden-mobile">{author ?? '—'}</td>
                      <td className="history-cell text-text-muted">{formatDay(rev.createdAt, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}</td>
                      {isAuthenticated && (
                        <td className="history-cell">
                          {!isCurrent && (
                            <button type="button" onClick={() => restore(rev.id, `v${rev.version}`)} disabled={busyId === rev.id} className="restore-btn" aria-label={`Restore v${rev.version}`}>
                              <RotateCcw size={14} /><span className="hidden-mobile">{busyId === rev.id ? '…' : 'Restore'}</span>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                    {isExpanded && changes.length > 0 && <ExpandedChanges changes={changes} />}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="No revision history available." />
      )}
    </div>
  );
}
