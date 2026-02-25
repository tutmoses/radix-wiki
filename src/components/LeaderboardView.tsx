// src/components/LeaderboardView.tsx

'use client';

import { Trophy, FileText, Edit3, MessageSquare, Star } from 'lucide-react';
import { useFetch } from '@/hooks';
import { userProfileSlug } from '@/lib/utils';
import { UserAvatar } from '@/components/UserAvatar';
import Link from 'next/link';

interface LeaderboardEntry {
  id: string;
  displayName: string | null;
  radixAddress: string;
  avatarUrl: string | null;
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

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="badge badge-accent">1st</span>;
  if (rank === 2) return <span className="badge badge-warning">2nd</span>;
  if (rank === 3) return <span className="badge badge-success">3rd</span>;
  return <span className="text-text-muted">#{rank}</span>;
}

export function LeaderboardView() {
  const { data, isLoading } = useFetch<LeaderboardResponse>('/api/leaderboard');

  return (
    <div className="stack">
      <div className="stack-sm">
        <div className="row">
          <Trophy size={24} className="text-accent" />
          <h1>Leaderboard</h1>
        </div>
        <p className="text-text-muted">Top contributors ranked by points. Every contribution earns points toward a future XRD airdrop.</p>
      </div>

      <div className="surface rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="text-left text-small text-text-muted border-b border-surface-2">
              <th className="p-3 w-16">Rank</th>
              <th className="p-3">Contributor</th>
              <th className="p-3 text-center hidden-mobile"><FileText size={14} /></th>
              <th className="p-3 text-center hidden-mobile"><Edit3 size={14} /></th>
              <th className="p-3 text-center hidden-mobile"><MessageSquare size={14} /></th>
              <th className="p-3 text-right">
                <span className="row justify-end"><Star size={14} /> Points</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 10 }, (_, i) => (
              <tr key={i} className="border-b border-surface-2">
                <td className="p-3" colSpan={6}><div className="h-8 skeleton rounded" /></td>
              </tr>
            ))}
            {data?.items.map((entry, i) => (
              <tr key={entry.id} className="border-b border-surface-2 last:border-0">
                <td className="p-3"><RankBadge rank={i + 1} /></td>
                <td className="p-3">
                  <Link href={`/community/${userProfileSlug(entry.displayName, entry.radixAddress)}`} className="row">
                    <UserAvatar radixAddress={entry.radixAddress} avatarUrl={entry.avatarUrl} size="sm" />
                    <span className="font-medium truncate">{entry.displayName || entry.radixAddress.slice(0, 12) + '...'}</span>
                  </Link>
                </td>
                <td className="p-3 text-center hidden-mobile">{entry.pages}</td>
                <td className="p-3 text-center hidden-mobile">{entry.edits}</td>
                <td className="p-3 text-center hidden-mobile">{entry.comments}</td>
                <td className="p-3 text-right font-medium text-accent">{entry.points.toLocaleString()}</td>
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
