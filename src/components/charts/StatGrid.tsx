// src/components/charts/StatGrid.tsx – the row of stat cards above a /charts table

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** `change` is a percentage, coloured by its sign, with what it compares against. */
export type Stat = { icon: LucideIcon; value: string; label: string; change?: { percent: number; label: string } };

export default function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="charts-stat-grid">
      {stats.map(({ icon: Icon, value, label, change }) => (
        <div key={label} className="stat-card">
          <Icon size={18} className="text-text-muted" />
          <span className="stat-value">{value}</span>
          <span className="text-small text-text-muted text-center">{label}</span>
          {change && isFinite(change.percent) && (
            <span className={cn('text-xs font-medium', change.percent >= 0 ? 'text-success' : 'text-error')}>
              {change.percent >= 0 ? '↑' : '↓'} {Math.abs(change.percent).toFixed(1)}% {change.label}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
