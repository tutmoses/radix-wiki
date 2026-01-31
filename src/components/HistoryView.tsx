// src/components/HistoryView.tsx - Extracted history components (lazy-loaded)

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, RotateCcw, User, Plus, Minus, Pencil, Move, ChevronDown, ChevronUp, GitBranch } from 'lucide-react';
import { Button, Badge } from '@/components/ui';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { useAuth } from '@/hooks';
import { formatDate, cn } from '@/lib/utils';
import type { BlockChange } from '@/lib/versioning';

interface RevisionData {
  id: string;
  title: string;
  version: string;
  changeType: string;
  changes: BlockChange[] | null;
  message?: string | null;
  createdAt: Date;
  author?: { id: string; displayName?: string | null; radixAddress: string };
}

export type HistoryData = { currentVersion: string; revisions: RevisionData[] } | null;

const CHANGE_TYPE_STYLES = {
  major: { label: 'Major', variant: 'danger' as const, desc: 'Structural changes' },
  minor: { label: 'Minor', variant: 'warning' as const, desc: 'Content updates' },
  patch: { label: 'Patch', variant: 'secondary' as const, desc: 'Metadata changes' },
} as const;

const ACTION_ICONS = {
  added: { Icon: Plus, color: 'text-success', bg: 'bg-success/10' },
  removed: { Icon: Minus, color: 'text-error', bg: 'bg-error/10' },
  modified: { Icon: Pencil, color: 'text-warning', bg: 'bg-warning/10' },
  moved: { Icon: Move, color: 'text-info', bg: 'bg-info/10' },
} as const;

const BLOCK_TYPE_LABELS: Record<string, string> = {
  content: 'Content Block',
  recentPages: 'Recent Pages Widget',
  pageList: 'Page List Widget',
  assetPrice: 'Asset Price Widget',
  columns: 'Column Layout',
};

function formatPath(path: string): string {
  const parts = path.replace('root.', '').split('.');
  if (parts.length === 1) return `Block ${parseInt(parts[0]) + 1}`;
  const formatted: string[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 'columns' && parts[i + 1]) {
      formatted.push(`Column ${parseInt(parts[i + 1]) + 1}`);
      i += 2;
    } else if (!isNaN(parseInt(parts[i]))) {
      formatted.push(`Block ${parseInt(parts[i]) + 1}`);
    }
  }
  return formatted.join(' → ');
}

function ContentDiff({ from, to }: { from: string; to: string }) {
  const [result, setResult] = useState<Array<[number, string]> | null>(null);

  useEffect(() => {
    if (from === to) return;
    import('fast-diff').then(({ default: diff }) => setResult(diff(from || '', to || '')));
  }, [from, to]);

  if (!result) return null;

  return (
    <div className="text-xs leading-relaxed bg-surface-2/50 rounded p-2 mt-2 max-h-48 overflow-auto font-mono whitespace-pre-wrap break-all">
      {result.map(([type, text], i) => (
        <span key={i} className={cn(type === 1 && 'bg-success/25 text-success', type === -1 && 'bg-error/25 text-error line-through')}>{text}</span>
      ))}
    </div>
  );
}

function AttributeChange({ name, from, to }: { name: string; from: unknown; to: unknown }) {
  const formatValue = (v: unknown): string => {
    if (v === null || v === undefined) return '(empty)';
    if (typeof v === 'boolean') return v ? 'yes' : 'no';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  return (
    <div className="row text-xs py-0.5">
      <span className="text-muted w-20 shrink-0">{name}:</span>
      <span className="text-error/70 line-through truncate">{formatValue(from)}</span>
      <ArrowRight size={10} className="text-muted shrink-0" />
      <span className="text-success/90 truncate">{formatValue(to)}</span>
    </div>
  );
}

function BlockChangeItem({ change, expanded }: { change: BlockChange; expanded?: boolean }) {
  const { Icon, color, bg } = ACTION_ICONS[change.action];
  const typeLabel = BLOCK_TYPE_LABELS[change.type] || change.type;
  const location = formatPath(change.path);

  const textAttr = change.attributes?.text as { from: string; to: string } | undefined;
  const fromText = change.contentDiff?.from ?? textAttr?.from ?? '';
  const toText = change.contentDiff?.to ?? textAttr?.to ?? '';
  const hasTextChange = change.type === 'content' && (fromText || toText);
  const otherAttrs = change.attributes ? Object.entries(change.attributes).filter(([k]) => k !== 'text') : [];

  return (
    <div className={cn('rounded-md p-2', bg)}>
      <div className="row text-small">
        <Icon size={14} className={cn(color, 'shrink-0')} />
        <span className={cn('font-medium capitalize', color)}>{change.action}</span>
        <span className="text-muted">·</span>
        <span>{typeLabel}</span>
        <span className="text-muted text-xs ml-auto">{location}</span>
      </div>
      {expanded && (
        <div className="mt-2 pl-5">
          {hasTextChange && <ContentDiff from={fromText} to={toText} />}
          {otherAttrs.length > 0 && (
            <div className="stack-xs mt-2">
              {otherAttrs.map(([name, val]) => {
                const v = val as { from: unknown; to: unknown };
                return <AttributeChange key={name} name={name} from={v.from} to={v.to} />;
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChangeSummary({ changes }: { changes: BlockChange[] }) {
  const counts = changes.reduce((acc, c) => { acc[c.action] = (acc[c.action] || 0) + 1; return acc; }, {} as Record<string, number>);

  return (
    <div className="row flex-wrap gap-1">
      {counts.added && <span className="row text-xs text-success"><Plus size={10} />{counts.added} added</span>}
      {counts.removed && <span className="row text-xs text-error"><Minus size={10} />{counts.removed} removed</span>}
      {counts.modified && <span className="row text-xs text-warning"><Pencil size={10} />{counts.modified} modified</span>}
      {counts.moved && <span className="row text-xs text-info"><Move size={10} />{counts.moved} moved</span>}
    </div>
  );
}

function RevisionCard({ rev, isCurrent, canRestore, onRestore, isRestoring }: { rev: RevisionData; isCurrent: boolean; canRestore: boolean; onRestore: () => void; isRestoring: boolean }) {
  const [expanded, setExpanded] = useState(isCurrent);
  const changes = rev.changes || [];
  const typeStyle = CHANGE_TYPE_STYLES[rev.changeType as keyof typeof CHANGE_TYPE_STYLES] || CHANGE_TYPE_STYLES.patch;

  return (
    <div className={cn('surface p-4 rounded-lg', isCurrent && 'border-accent')}>
      <div className="stack-sm">
        <div className="spread">
          <div className="row flex-wrap">
            <div className="row"><GitBranch size={14} className="text-accent" /><span className="font-mono font-medium">v{rev.version}</span></div>
            <Badge variant={typeStyle.variant} title={typeStyle.desc}>{typeStyle.label}</Badge>
            {isCurrent && <Badge variant="default">Current</Badge>}
          </div>
          <div className="row">
            <span className="text-muted text-small">{formatDate(rev.createdAt, { hour: '2-digit', minute: '2-digit' })}</span>
            {canRestore && !isCurrent && (
              <Button variant="ghost" size="sm" onClick={onRestore} disabled={isRestoring}>
                <RotateCcw size={14} />{isRestoring ? 'Restoring...' : 'Restore'}
              </Button>
            )}
          </div>
        </div>
        <div className="row"><span className="font-medium">{rev.title}</span></div>
        {rev.message && <p className="text-muted text-small">{rev.message}</p>}
        <div className="spread text-small">
          <div className="row text-muted"><User size={14} /><span>{rev.author?.displayName || rev.author?.radixAddress.slice(0, 16) + '...'}</span></div>
          {changes.length > 0 && (
            <div className="row">
              <ChangeSummary changes={changes} />
              <button onClick={() => setExpanded(!expanded)} className="row text-accent hover:text-accent-hover ml-2">
                <span className="text-xs">{expanded ? 'hide' : 'details'}</span>
                {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          )}
        </div>
        {expanded && changes.length > 0 && (
          <div className="border-t border-border-muted pt-3 mt-1 stack-sm">
            {changes.map((change, i) => <BlockChangeItem key={`${change.id}-${i}`} change={change} expanded />)}
          </div>
        )}
      </div>
    </div>
  );
}

export function HistoryView({ data, tagPath, slug, isHomepage }: { data: HistoryData; tagPath: string; slug: string; isHomepage?: boolean }) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const [restoringId, setRestoringId] = useState<string | null>(null);

  const apiBase = isHomepage ? '/api/wiki' : `/api/wiki/${tagPath}/${slug}`;
  const viewPath = isHomepage ? '/' : `/${tagPath}/${slug}`;

  if (!data) {
    return (
      <div className="stack">
        {!isHomepage && <Breadcrumbs path={[...tagPath.split('/'), slug]} suffix="History" />}
        <div className="surface p-12 text-center rounded-lg"><p className="text-error">Page not found</p></div>
      </div>
    );
  }

  const handleRestore = async (revisionId: string) => {
    if (!confirm('Restore this revision? This will create a new version with the restored content.')) return;
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
        <div className="row">
          <h1 className="m-0!">{isHomepage ? 'Homepage History' : 'Version History'}</h1>
          <Badge variant="default" className="font-mono">v{data.currentVersion}</Badge>
        </div>
        <Link href={viewPath}>
          <Button variant="secondary" size="sm"><ArrowLeft size={16} />{isHomepage ? 'Back to Homepage' : 'Back to Page'}</Button>
        </Link>
      </div>
      {data.revisions.length > 0 ? (
        <div className="stack">
          {data.revisions.map((rev, i) => (
            <RevisionCard key={rev.id} rev={rev} isCurrent={i === 0} canRestore={isAuthenticated} onRestore={() => handleRestore(rev.id)} isRestoring={restoringId === rev.id} />
          ))}
        </div>
      ) : (
        <div className="surface p-12 text-center rounded-lg"><p className="text-muted">No revision history available.</p></div>
      )}
    </div>
  );
}

export default HistoryView;