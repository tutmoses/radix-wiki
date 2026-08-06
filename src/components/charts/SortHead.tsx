// src/components/charts/SortHead.tsx — Sortable header cell for the chart tables.
//
// Lives at module scope on purpose: defined inside a parent's render, React sees
// a new component type on every render and remounts the whole header.

import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortColumn<K extends string> = { k: K; label: string; className?: string };

export function SortHead<K extends string>({
  k,
  label,
  className,
  sortKey,
  sortDir,
  onSort,
}: SortColumn<K> & { sortKey: K; sortDir: 'asc' | 'desc'; onSort: (key: K) => void }) {
  const active = sortKey === k;
  return (
    <th className={cn('data-table-th', className)}>
      <button onClick={() => onSort(k)} className={cn('sort-header', active && 'sort-header-active')}>
        {label}
        {active && (sortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  );
}
