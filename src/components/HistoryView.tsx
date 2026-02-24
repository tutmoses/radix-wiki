// src/components/HistoryView.tsx

'use client';

import { useState, useEffect, Fragment, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RotateCcw, Plus, Minus, Pencil, Move, ChevronDown } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { useAuth } from '@/hooks';
import { UserAvatar } from '@/components/UserAvatar';
import { formatDate, cn, userProfileSlug } from '@/lib/utils';
import type { BlockChange } from '@/lib/versioning';

interface RevisionData {
  id: string;
  title: string;
  version: string;
  changeType: string;
  changes: BlockChange[] | null;
  message?: string | null;
  createdAt: Date;
  author?: { id: string; displayName?: string | null; radixAddress: string; avatarUrl?: string | null };
}

export type HistoryData = { currentVersion: string; revisions: RevisionData[] } | null;

const TYPE_BADGE: Record<string, { label: string; variant: 'danger' | 'warning' | 'secondary' }> = {
  major: { label: 'Major', variant: 'danger' },
  minor: { label: 'Minor', variant: 'warning' },
  patch: { label: 'Patch', variant: 'secondary' },
};

function ChangeSummary({ changes }: { changes: BlockChange[] }) {
  const counts = changes.reduce((acc, c) => { acc[c.action] = (acc[c.action] || 0) + 1; return acc; }, {} as Record<string, number>);
  const parts: ReactElement[] = [];
  if (counts.added) parts.push(<span key="a" className="text-success">+{counts.added}</span>);
  if (counts.removed) parts.push(<span key="r" className="text-error">-{counts.removed}</span>);
  if (counts.modified) parts.push(<span key="m" className="text-warning">~{counts.modified}</span>);
  if (counts.moved) parts.push(<span key="v" className="text-info">↔{counts.moved}</span>);
  return <span className="row gap-1.5 text-xs font-mono">{parts.length ? parts : '—'}</span>;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
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
      segments.push(`Col ${parseInt(parts[i + 1]) + 1}`);
      i++; // skip the column index
    } else if (parts[i] === 'blocks' && parts[i + 1] !== undefined) {
      segments.push(`Block ${parseInt(parts[i + 1]) + 1}`);
      i++; // skip the block index
    } else if (!isNaN(parseInt(parts[i]))) {
      segments.push(`Block ${parseInt(parts[i]) + 1}`);
    }
  }

  const location = segments.length ? segments.join(' → ') : 'root';
  const typeLabel = type === 'content' ? 'Text' : type === 'recentPages' ? 'Recent Pages' : type === 'pageList' ? 'Page List' : type === 'assetPrice' ? 'Asset Price' : type === 'columns' ? 'Columns' : type;
  return `${typeLabel} at ${location}`;
}

function ExpandedChanges({ changes }: { changes: BlockChange[] }) {
  return (
    <tr><td colSpan={6} className="p-0!">
      <div className="bg-surface-0 p-3 border-t border-border-muted stack-sm">
        {changes.map((c, i) => {
          const icons = { added: <Plus size={12} className="text-success" />, removed: <Minus size={12} className="text-error" />, modified: <Pencil size={12} className="text-warning" />, moved: <Move size={12} className="text-info" /> };
          const colors = { added: 'text-success', removed: 'text-error', modified: 'text-warning', moved: 'text-info' };
          const textAttr = c.attributes?.text as { from: string; to: string } | undefined;
          const fromText = c.contentDiff?.from ?? textAttr?.from ?? '';
          const toText = c.contentDiff?.to ?? textAttr?.to ?? '';
          const hasTextChange = c.type === 'content' && (fromText || toText);
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

  const apiBase = isHomepage ? '/api/wiki' : `/api/wiki/${tagPath}/${slug}`;
  const viewPath = isHomepage ? '/' : `/${tagPath}/${slug}`;

  if (!data) {
    return (
      <div className="stack">
        {!isHomepage && <Breadcrumbs path={[...tagPath.split('/'), slug]} suffix="History" />}
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
      {!isHomepage && <Breadcrumbs path={[...tagPath.split('/'), slug]} suffix="History" />}
      <div className="spread">
        <h1 className="m-0!">{isHomepage ? 'Homepage' : 'Page'} History</h1>
        <Link href={viewPath}><Button variant="secondary" size="sm"><ArrowLeft size={16} />Back</Button></Link>
      </div>
      {data.revisions.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-small">
            <thead>
              <tr className="text-left text-text-muted">
                <th className="py-2 px-3 font-medium w-24">Version</th>
                <th className="py-2 px-3 font-medium w-20">Type</th>
                <th className="py-2 px-3 font-medium">Changes</th>
                <th className="py-2 px-3 font-medium">Author</th>
                <th className="py-2 px-3 font-medium w-36">Date</th>
                <th className="py-2 px-3 font-medium w-24"></th>
              </tr>
            </thead>
            <tbody>
              {data.revisions.map((rev, i) => {
                const isCurrent = i === 0;
                const type = TYPE_BADGE[rev.changeType] || TYPE_BADGE.patch;
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
                          <ChangeSummary changes={changes} />
                          {rev.message && <span className="text-text-muted truncate max-w-48">{rev.message}</span>}
                          {changes.length > 0 && (
                            <button onClick={() => setExpandedId(isExpanded ? null : rev.id)} className="text-accent hover:text-accent-hover">
                              <ChevronDown size={14} className={cn('transition-transform', isExpanded && 'rotate-180')} />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3 truncate max-w-32">
                        {rev.author ? (
                          <Link href={`/community/${userProfileSlug(rev.author.displayName, rev.author.radixAddress)}`} className="row text-text-muted hover:text-accent">
                            <UserAvatar radixAddress={rev.author.radixAddress} avatarUrl={rev.author.avatarUrl} size="sm" />
                            {rev.author.displayName || rev.author.radixAddress.slice(0, 12) + '…'}
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
