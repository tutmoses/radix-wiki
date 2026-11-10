// src/components/charts/StatGrid.tsx – the row of stat cards above a /charts table

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** `change` is a percentage, coloured by its sign, with what it compares against. */
export type Stat = { icon: LucideIcon; value: string; label: string; change?: { percent: number; label: string } };

/** A percentage change, arrowed and coloured by its sign; nothing when it could not be computed. */
export function Change({ percent, digits = 1, label, className }: { percent: number; digits?: number; label?: string; className?: string }) {
  if (!isFinite(percent)) return null;
  return (
    <span className={cn('font-medium', percent >= 0 ? 'text-success' : 'text-error', className)}>
      {percent >= 0 ? '↑' : '↓'} {Math.abs(percent).toFixed(digits)}%{label && ` ${label}`}
    </span>
  );
}

/** One figure under its icon, with what it is; `children` follow the label. */
export function StatCard({ icon, value, label, children }: { icon: ReactNode; value: ReactNode; label: string; children?: ReactNode }) {
  return (
    <div className="stat-card">
      {icon}
      <span className="stat-value">{value}</span>
      <span className="text-small text-text-muted text-center">{label}</span>
      {children}
    </div>
  );
}

export default function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="charts-stat-grid">
      {stats.map(({ icon: Icon, value, label, change }) => (
        <StatCard key={label} icon={<Icon size={18} className="text-text-muted" />} value={value} label={label}>
          {change && <Change percent={change.percent} label={change.label} className="text-xs" />}
        </StatCard>
      ))}
    </div>
  );
}
