// src/components/UserStats.tsx

'use client';

import { useState, useEffect } from 'react';
import { FileText, MessageSquare, Edit3, Calendar, Users, Shield } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';

interface UserStatsData {
  userId: string;
  displayName: string | null;
  radixAddress: string;
  memberSince: string;
  stats: {
    pages: number;
    comments: number;
    edits: number;
    uniqueContributions: number;
    accountAgeDays: number;
  };
  score: number;
}

function StatItem({ icon: Icon, label, value }: { icon: typeof FileText; label: string; value: number | string }) {
  return (
    <div className="stack-xs items-center p-3 bg-surface-1 rounded-lg">
      <Icon size={20} className="text-accent" />
      <span className="text-h4 font-semibold">{value}</span>
      <span className="text-small text-muted">{label}</span>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const tier = score >= 80 ? 'Trusted' : score >= 50 ? 'Active' : score >= 20 ? 'Member' : 'New';
  const tierColor = score >= 80 ? 'text-success' : score >= 50 ? 'text-accent' : score >= 20 ? 'text-info' : 'text-muted';

  return (
    <div className="stack items-center p-4 bg-surface-1 rounded-xl">
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
        <span className="text-small text-muted">Reputation</span>
      </div>
    </div>
  );
}

export function UserStats({ authorId }: { authorId: string }) {
  const [data, setData] = useState<UserStatsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/users/${authorId}/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .finally(() => setIsLoading(false));
  }, [authorId]);

  if (isLoading) {
    return (
      <section className="stack-sm pt-6 border-t border-border">
        <h3 className="text-muted">Statistics</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-24 skeleton rounded-lg" />)}
        </div>
      </section>
    );
  }

  if (!data) return null;

  return (
    <section className="stack-sm pt-6 border-t border-border">
      <h3 className="text-muted">Statistics</h3>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <ScoreRing score={data.score} />
        <StatItem icon={FileText} label="Pages" value={data.stats.pages} />
        <StatItem icon={Users} label="Contributions" value={data.stats.uniqueContributions} />
        <StatItem icon={Edit3} label="Edits" value={data.stats.edits} />
        <StatItem icon={Calendar} label="Member Since" value={formatDate(data.memberSince, { month: 'short', year: 'numeric' })} />
      </div>
    </section>
  );
}

export default UserStats;