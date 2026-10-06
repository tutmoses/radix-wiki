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
import { changeSummary } from 'wiki-formant/revisions';
import { SortHeader, restoreViaPost, useRevisionRestore, useTableSort } from 'wiki-formant/react';
import { RevisionChanges } from 'wiki-formant/react-server';
import { cn, pagePath } from '@/lib/utils';
import { formatDay } from 'wiki-formant/freshness';
import { BLOCK_META } from '@/lib/block-utils';
import type { BlockType } from '@/types/blocks';
import type { HistoryChange } from 'wiki-formant/history';

interface RevisionData {
  id: string;
  title: string;
  version: string;
  changeType: string;
  changes: HistoryChange[];
  message?: string | null;
  createdAt: Date;
  author?: { id: string; displayName?: string | null; shortAddress: string; avatarUrl?: string | null };
}

type HistoryData = { currentVersion: string; revisions: RevisionData[] } | null;

const TYPE_BADGE: Record<string, { label: string; variant: 'danger' | 'warning' | 'secondary' }> = {
  major: { label: 'Major', variant: 'danger' },
  minor: { label: 'Minor', variant: 'warning' },
  patch: { label: 'Patch', variant: 'secondary' },
};

const TYPE_WEIGHT: Record<string, number> = { patch: 0, minor: 1, major: 2 };
const authorName = (r: RevisionData) => r.author?.displayName || r.author?.shortAddress || '';
const REVISION_COMPARATORS = {
  version: (a: RevisionData, b: RevisionData) => a.version.localeCompare(b.version, undefined, { numeric: true }),
  type: (a: RevisionData, b: RevisionData) => (TYPE_WEIGHT[a.changeType] ?? 0) - (TYPE_WEIGHT[b.changeType] ?? 0),
  changes: (a: RevisionData, b: RevisionData) => a.changes.length - b.changes.length,
  author: (a: RevisionData, b: RevisionData) => authorName(a).localeCompare(authorName(b)),
  date: (a: RevisionData, b: RevisionData) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
};
// Authors read A–Z first; everything else opens newest or largest first.
const firstDirection = (key: string): 'asc' | 'desc' => (key === 'author' ? 'asc' : 'desc');
const NO_REVISIONS: RevisionData[] = [];

// The counted phrasing is `wiki-formant/revisions`, the one the stored revision
// message already uses. The server has already dropped containers (this view
// never lists them); an empty set reads off the revision's own change type.
function ChangeSummary({ changes, changeType }: { changes: HistoryChange[]; changeType: string }) {
  const summary = changes.length
    ? changeSummary({ changes, titleChanged: false })
    : changeType === 'major' ? 'Structural changes' : changeType === 'minor' ? 'Content updated' : changeType === 'patch' ? 'Metadata updated' : 'No changes';
  return <span className="text-xs text-text-muted">{summary}</span>;
}

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

export function HistoryView({ data, tagPath, slug, isHomepage }: { data: HistoryData; tagPath: string; slug: string; isHomepage?: boolean }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { sorted, headerProps } = useTableSort<RevisionData, keyof typeof REVISION_COMPARATORS>(data?.revisions ?? NO_REVISIONS, { defaultKey: 'date', comparators: REVISION_COMPARATORS, defaultDirection: firstDirection });

  const apiBase = isHomepage ? '/api/wiki' : `/api/wiki${pagePath(tagPath, slug)}`;
  const viewPath = isHomepage ? '/' : pagePath(tagPath, slug);
  // Confirm, POST, report: `wiki-formant/react`. A failure shows above the table.
  const { restore, busyId, error: restoreError } = useRevisionRestore<string>(restoreViaPost(`${apiBase}/history`), {
    onRestored: () => router.push(viewPath),
  });

  if (!data) {
    return (
      <div className="stack">
        {!isHomepage && <Breadcrumbs path={[...tagPath.split('/'), slug].filter(Boolean)} suffix="History" />}
        <div className="surface p-12 text-center"><p className="text-error">Page not found</p></div>
      </div>
    );
  }

  return (
    <div className="stack">
      {!isHomepage && <Breadcrumbs path={[...tagPath.split('/'), slug].filter(Boolean)} suffix="History" />}
      <div className="spread">
        <h1 id={isHomepage ? 'homepage-history' : 'page-history'} className="m-0!">{isHomepage ? 'Homepage' : 'Page'} History</h1>
        <Link href={viewPath}><Button variant="secondary" size="sm"><ArrowLeft size={16} />Back</Button></Link>
      </div>
      {restoreError && <p className="text-error text-small" role="alert">{restoreError}</p>}
      {data.revisions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead>
              <tr className="text-left text-text-muted">
                <SortHeader {...headerProps('version')} className="py-2 px-3 font-medium w-24">Version</SortHeader>
                <SortHeader {...headerProps('type')} className="py-2 px-3 font-medium w-20">Type</SortHeader>
                <SortHeader {...headerProps('changes')} className="py-2 px-3 font-medium">Changes</SortHeader>
                <SortHeader {...headerProps('author')} className="py-2 px-3 font-medium">Author</SortHeader>
                <SortHeader {...headerProps('date')} className="py-2 px-3 font-medium w-36">Date</SortHeader>
                <th className="py-2 px-3 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((rev, i) => {
                // The newest revision is the current one wherever the sort puts it.
                const isCurrent = rev.id === data.revisions[0]?.id;
                const type = TYPE_BADGE[rev.changeType] ?? TYPE_BADGE.patch!;
                const { changes } = rev;
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
                            <button type="button" onClick={() => setExpandedId(isExpanded ? null : rev.id)} className="text-accent hover:text-accent-hover"
                              aria-label={`Changes in v${rev.version}`} aria-expanded={isExpanded}>
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
                      <td className="py-2 px-3 text-text-muted">{formatDay(rev.createdAt, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}</td>
                      <td className="py-2 px-3">
                        {isAuthenticated && !isCurrent && (
                          <button type="button" onClick={() => restore(rev.id, `v${rev.version}`)} disabled={busyId === rev.id} className="restore-btn">
                            <RotateCcw size={14} /><span>{busyId === rev.id ? '…' : 'Restore'}</span>
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
