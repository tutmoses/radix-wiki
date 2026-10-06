// src/components/LeaderboardView.tsx

'use client';

import { useMemo } from 'react';
import { Trophy, FileText, Edit3, MessageSquare, Star } from 'lucide-react';
import { UserAvatar } from '@/components/UserAvatar';
import { DataTable, type Column } from '@/components/charts/DataTable';
import Link from 'next/link';
import type { LeaderboardEntry } from '@/lib/scoring';

type RankedEntry = LeaderboardEntry & { rank: number };

const nameOf = (e: LeaderboardEntry) => e.displayName || e.shortAddress;

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="badge badge-accent">1st</span>;
  if (rank === 2) return <span className="badge badge-warning">2nd</span>;
  if (rank === 3) return <span className="badge badge-success">3rd</span>;
  return <span className="text-text-muted">#{rank}</span>;
}

function Contributor({ entry }: { entry: RankedEntry }) {
  const body = (
    <>
      <UserAvatar seed={entry.id} avatarUrl={entry.avatarUrl} size="sm" />
      <span className="font-medium truncate">{nameOf(entry)}</span>
    </>
  );
  return entry.profilePath ? <Link href={entry.profilePath} className="row">{body}</Link> : <span className="row">{body}</span>;
}

const COLUMNS: Column<RankedEntry>[] = [
  { k: 'rank', label: 'Rank', className: 'w-16', num: e => e.rank, ascending: true, cell: e => <RankBadge rank={e.rank} /> },
  { k: 'name', label: 'Contributor', text: nameOf, cell: e => <Contributor entry={e} /> },
  { k: 'pages', label: 'Pages', header: <FileText size={14} />, className: 'text-center hidden-mobile', num: e => e.pages, cell: e => e.pages },
  { k: 'edits', label: 'Edits', header: <Edit3 size={14} />, className: 'text-center hidden-mobile', num: e => e.edits, cell: e => e.edits },
  { k: 'comments', label: 'Comments', header: <MessageSquare size={14} />, className: 'text-center hidden-mobile', num: e => e.comments, cell: e => e.comments },
  { k: 'points', label: 'Points', header: <><Star size={14} /> Points</>, className: 'text-right', cellClass: 'font-medium text-accent', num: e => e.points, cell: e => e.points.toLocaleString('en-US') },
];

// Every contributor, resolved on the server. It fetched the top 25 after
// hydration, so a crawler read an empty table, and the `#u-<id>` anchors the
// header and page histories link to existed only for the top 25.
export default function LeaderboardView({ entries }: { entries: LeaderboardEntry[] }) {
  // Rank is the points order the server returns, so it stays with the
  // contributor when the table is sorted by another column.
  const ranked = useMemo(() => entries.map((e, i) => ({ ...e, rank: i + 1 })), [entries]);

  return (
    <div className="stack">
      <div className="stack-sm">
        <div className="row">
          <Trophy size={24} className="text-accent" />
          <h1 id="leaderboard">Leaderboard</h1>
        </div>
        <p className="text-text-muted">Top contributors ranked by points. Points may be considered in any future $EMOON airdrop.</p>
      </div>

      <DataTable
        rows={ranked} columns={COLUMNS} defaultKey="points" numbered={false}
        rowKey={e => e.id} rowId={e => `u-${e.id}`} empty="No contributors yet. Be the first!"
      />
    </div>
  );
}
