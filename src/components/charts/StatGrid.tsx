// src/components/charts/StatGrid.tsx – the row of stat cards above a /charts table

import type { LucideIcon } from 'lucide-react';

export type Stat = { icon: LucideIcon; value: string; label: string };

export default function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="charts-stat-grid">
      {stats.map(({ icon: Icon, value, label }) => (
        <div key={label} className="stat-card">
          <Icon size={18} className="text-text-muted" />
          <span className="stat-value">{value}</span>
          <span className="text-small text-text-muted">{label}</span>
        </div>
      ))}
    </div>
  );
}
