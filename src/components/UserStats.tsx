// src/components/UserStats.tsx

'use client';

import { FileText, MessageSquare, Edit3, Calendar, Users, Shield, Star } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { useFetch } from '@/hooks';
import { UserAvatar } from '@/components/UserAvatar';

interface UserStatsData {
  userId: string;
  displayName: string | null;
  radixAddress: string;
  avatarUrl: string | null;
  memberSince: string;
  stats: {
    pages: number;
    comments: number;
    edits: number;
    uniqueContributions: number;
    accountAgeDays: number;
  };
  score: number;
  points: number;
  breakdown: {
    pages: number;
    edits: number;
    contributions: number;
    comments: number;
    tenure: number;
  };
}

function StatItem({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: number | string }) {
  return (
    <div className="stat-card">
      <Icon size={20} className="text-accent" />
      <span className="stat-value">{value}</span>
      <span className="text-small text-text-muted">{label}</span>
    </div>
  );
}

function ScoreRing({ score, points }: { score: number; points: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const tier = score >= 80 ? 'Trusted' : score >= 50 ? 'Active' : score >= 20 ? 'Member' : 'New';
  const tierColor = score >= 80 ? 'text-success' : score >= 50 ? 'text-accent' : score >= 20 ? 'text-info' : 'text-text-muted';

  return (
    <div className="score-ring">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-surface-2)" strokeWidth="8" />
          <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--color-accent)" strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-700" />
        </svg>
        <div className="absolute inset-0 center">
          <span className="text-h2 font-bold">{score}</span>
        </div>
      </div>
      <div className="stack-xs items-center">
        <div className="row">
          <Shield size={16} className={tierColor} />
          <span className={cn('font-medium', tierColor)}>{tier}</span>
        </div>
        <div className="row text-small">
          <Star size={12} className="text-accent" />
          <span className="text-text-muted">{points.toLocaleString()} pts</span>
        </div>
      </div>
    </div>
  );
}

export function UserStats({ authorId }: { authorId: string }) {
  const { data, isLoading } = useFetch<UserStatsData>(`/api/users/${authorId}/stats`);

  if (isLoading) {
    return (
      <section className="section-divider stack-sm">
        <h3 className="text-text-muted">Statistics</h3>
        <div className="stat-grid">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-24 skeleton rounded-lg" />)}
        </div>
      </section>
    );
  }

  if (!data) return null;

  return (
    <section className="section-divider stack-sm">
      <div className="center">
        <UserAvatar radixAddress={data.radixAddress} avatarUrl={data.avatarUrl} size="lg" />
      </div>
      <h3 className="text-text-muted">Contribution Points</h3>
      <div className="stat-grid">
        <ScoreRing score={data.score} points={data.points} />
        <StatItem icon={FileText} label="Pages" value={data.stats.pages} />
        <StatItem icon={Users} label="Contributions" value={data.stats.uniqueContributions} />
        <StatItem icon={Edit3} label="Edits" value={data.stats.edits} />
        <StatItem icon={Calendar} label="Member Since" value={formatDate(data.memberSince, { month: 'short', year: 'numeric' })} />
      </div>
      <p className="text-small text-text-muted text-center">Points may be considered in any future $EMOON airdrop for contributors.</p>
    </section>
  );
}

export default UserStats;
