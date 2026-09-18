// src/components/LeaderboardView.tsx

'use client';

import { useMemo } from 'react';
import { Trophy, FileText, Edit3, MessageSquare, Star } from 'lucide-react';
import { useTableSort } from 'wiki-formant/react';
import { useFetch } from '@/hooks';
import { UserAvatar } from '@/components/UserAvatar';
import { SortHead } from '@/components/ui';
import Link from 'next/link';

interface LeaderboardEntry {
  id: string;
  displayName: string | null;
  shortAddress: string;
  avatarUrl: string | null;
  profilePath: string | null;
  pages: number;
  edits: number;
  contributions: number;
  comments: number;
  points: number;
}

interface LeaderboardResponse {
  items: LeaderboardEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

type RankedEntry = LeaderboardEntry & { rank: number };
type NumericKey = 'rank' | 'pages' | 'edits' | 'comments' | 'points';

const nameOf = (e: LeaderboardEntry) => e.displayName || e.shortAddress;
const byNumber = (k: NumericKey) => (a: RankedEntry, b: RankedEntry) => a[k] - b[k];
const COMPARATORS = {
  rank: byNumber('rank'),
  name: (a: RankedEntry, b: RankedEntry) => nameOf(a).localeCompare(nameOf(b)),
  pages: byNumber('pages'),
  edits: byNumber('edits'),
  comments: byNumber('comments'),
  points: byNumber('points'),
};
// Rank and name read top-down; the counts open largest first.
const firstDirection = (key: keyof typeof COMPARATORS): 'asc' | 'desc' => (key === 'rank' || key === 'name' ? 'asc' : 'desc');

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="badge badge-accent">1st</span>;
  if (rank === 2) return <span className="badge badge-warning">2nd</span>;
  if (rank === 3) return <span className="badge badge-success">3rd</span>;
  return <span className="text-text-muted">#{rank}</span>;
}

export default function LeaderboardView() {
  const { data, isLoading } = useFetch<LeaderboardResponse>('/api/leaderboard');
  // Rank is the points order the API returns, so it stays with the contributor
  // when the table is sorted by another column.
  const ranked = useMemo(() => (data?.items ?? []).map((e, i) => ({ ...e, rank: i + 1 })), [data]);
  const { sorted, headerProps } = useTableSort<RankedEntry, keyof typeof COMPARATORS>(ranked, { defaultKey: 'points', comparators: COMPARATORS, defaultDirection: firstDirection });

  return (
    <div className="stack">
      <div className="stack-sm">
        <div className="row">
          <Trophy size={24} className="text-accent" />
          <h1 id="leaderboard">Leaderboard</h1>
        </div>
        <p className="text-text-muted">Top contributors ranked by points. Points may be considered in any future $EMOON airdrop.</p>
      </div>

      <div className="surface rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left text-small text-text-muted border-b border-surface-2">
              <SortHead {...headerProps('rank')} className="p-3 w-16">Rank</SortHead>
              <SortHead {...headerProps('name')} className="p-3">Contributor</SortHead>
              <SortHead {...headerProps('pages')} className="p-3 text-center hidden-mobile" title="Pages"><FileText size={14} /></SortHead>
              <SortHead {...headerProps('edits')} className="p-3 text-center hidden-mobile" title="Edits"><Edit3 size={14} /></SortHead>
              <SortHead {...headerProps('comments')} className="p-3 text-center hidden-mobile" title="Comments"><MessageSquare size={14} /></SortHead>
              <SortHead {...headerProps('points')} className="p-3 text-right"><Star size={14} /> Points</SortHead>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 10 }, (_, i) => (
              <tr key={i} className="border-b border-surface-2">
                <td className="p-3" colSpan={6}><div className="h-8 skeleton rounded" /></td>
              </tr>
            ))}
            {sorted.map(entry => (
              <tr key={entry.id} id={`u-${entry.id}`} className="border-b border-surface-2 last:border-0 target:bg-surface-2">
                <td className="p-3"><RankBadge rank={entry.rank} /></td>
                <td className="p-3">
                  {entry.profilePath ? (
                    <Link href={entry.profilePath} className="row">
                      <UserAvatar seed={entry.id} avatarUrl={entry.avatarUrl} size="sm" />
                      <span className="font-medium truncate">{entry.displayName || entry.shortAddress}</span>
                    </Link>
                  ) : (
                    <span className="row">
                      <UserAvatar seed={entry.id} avatarUrl={entry.avatarUrl} size="sm" />
                      <span className="font-medium truncate">{entry.displayName || entry.shortAddress}</span>
                    </span>
                  )}
                </td>
                <td className="p-3 text-center hidden-mobile">{entry.pages}</td>
                <td className="p-3 text-center hidden-mobile">{entry.edits}</td>
                <td className="p-3 text-center hidden-mobile">{entry.comments}</td>
                <td className="p-3 text-right font-medium text-accent">{entry.points.toLocaleString('en-US')}</td>
              </tr>
            ))}
            {data && data.items.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-text-muted">No contributors yet. Be the first!</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
