// src/components/charts/DataTable.tsx — The sortable table behind every /charts list.
//
// Tokens and validators had a table each: same wrapper, same `#` column, same
// header state machine, same empty row, differing only in their columns. A
// column now carries its own header, comparator and cell; the rest lives here.

'use client';

import { useMemo, type ReactNode } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTableSort } from 'wiki-formant/react';

// `text` vs `num` decides more than the comparator: a text column opens A–Z on
// first press, a numeric one opens largest first.
export type Column<T> = {
  k: string;
  label: string;
  /** On the header cell and the body cells alike; `cellClass` is body-only. */
  className?: string;
  cellClass?: string | ((row: T) => string | undefined);
  cell: (row: T) => ReactNode;
} & ({ text: (row: T) => string } | { num: (row: T) => number });

// Module scope on purpose: declared inside the table's render, React sees a new
// component type on every render and remounts the whole header.
function SortHead<T>({ column, active, direction, onSort }: { column: Column<T>; active: boolean; direction: 'asc' | 'desc'; onSort: (key: string) => void }) {
  return (
    <th className={cn('data-table-th', column.className)}>
      <button onClick={() => onSort(column.k)} className={cn('sort-header', active && 'sort-header-active')}>
        {column.label}
        {active && (direction === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  );
}

export function DataTable<T>({ rows, columns, defaultKey, rowKey, limit, empty }: {
  rows: T[]; columns: Column<T>[]; defaultKey: string; rowKey: (row: T) => string; limit?: number; empty: string;
}) {
  const comparators = useMemo(
    () => Object.fromEntries(columns.map(c => [c.k, 'text' in c ? (a: T, b: T) => c.text(a).localeCompare(c.text(b)) : (a: T, b: T) => c.num(a) - c.num(b)] as const)),
    [columns],
  );
  const { sorted, sortKey, direction, toggle } = useTableSort(rows, {
    defaultKey,
    comparators,
    defaultDirection: key => (columns.some(c => c.k === key && 'text' in c) ? 'asc' : 'desc'),
  });
  // The limit slices the sorted rows, not the input: /charts shows the top ten
  // of whichever column the reader picked.
  const shown = limit ? sorted.slice(0, limit) : sorted;

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th className="data-table-th w-12">#</th>
            {columns.map(c => <SortHead key={c.k} column={c} active={sortKey === c.k} direction={direction} onSort={toggle} />)}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={rowKey(row)} className="data-table-row">
              <td className="data-table-td text-text-muted">{i + 1}</td>
              {columns.map(c => (
                <td key={c.k} className={cn('data-table-td', c.className, typeof c.cellClass === 'function' ? c.cellClass(row) : c.cellClass)}>{c.cell(row)}</td>
              ))}
            </tr>
          ))}
          {!shown.length && (
            <tr>
              <td colSpan={columns.length + 1} className="data-table-td text-center text-text-muted py-8">{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
