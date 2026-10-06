// src/components/charts/DataTable.tsx — The sortable table behind every /charts list.
//
// Tokens and validators had a table each: same wrapper, same `#` column, same
// header state machine, same empty row, differing only in their columns. A
// column now carries its own header, comparator and cell; the rest lives here.

'use client';

import { useMemo, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { SortHeader, useTableSort } from 'wiki-formant/react';

// `text` vs `num` decides more than the comparator: a text column opens A–Z on
// first press, a numeric one opens largest first unless it is `ascending`.
export type Column<T> = {
  k: string;
  /** The header text, and the header's accessible name when `header` replaces it with an icon. */
  label: string;
  header?: ReactNode;
  /** On the header cell and the body cells alike; `cellClass` is body-only. */
  className?: string;
  cellClass?: string | ((row: T) => string | undefined);
  cell: (row: T) => ReactNode;
} & ({ text: (row: T) => string } | { num: (row: T) => number; ascending?: boolean });

export function DataTable<T>({ rows, columns, defaultKey, rowKey, rowId, numbered = true, limit, empty }: {
  rows: T[]; columns: Column<T>[]; defaultKey: string; rowKey: (row: T) => string;
  /** An anchor per row, for tables that are linked into. */
  rowId?: (row: T) => string;
  /** The `#` column. A table whose rows carry their own rank turns it off. */
  numbered?: boolean;
  limit?: number; empty: string;
}) {
  const comparators = useMemo(
    () => Object.fromEntries(columns.map(c => [c.k, 'text' in c ? (a: T, b: T) => c.text(a).localeCompare(c.text(b)) : (a: T, b: T) => c.num(a) - c.num(b)] as const)),
    [columns],
  );
  const { sorted, headerProps } = useTableSort(rows, {
    defaultKey,
    comparators,
    defaultDirection: key => (columns.some(c => c.k === key && ('text' in c || c.ascending)) ? 'asc' : 'desc'),
  });
  // The limit slices the sorted rows, not the input: /charts shows the top ten
  // of whichever column the reader picked.
  const shown = limit ? sorted.slice(0, limit) : sorted;

  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {numbered && <th className="data-table-th w-12">#</th>}
            {columns.map(c => (
              <SortHeader key={c.k} {...headerProps(c.k)} label={c.header ? c.label : undefined} className={cn('data-table-th', c.className)}>{c.header ?? c.label}</SortHeader>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, i) => (
            <tr key={rowKey(row)} id={rowId?.(row)} className="data-table-row">
              {numbered && <td className="data-table-td text-text-muted">{i + 1}</td>}
              {columns.map(c => (
                <td key={c.k} className={cn('data-table-td', c.className, typeof c.cellClass === 'function' ? c.cellClass(row) : c.cellClass)}>{c.cell(row)}</td>
              ))}
            </tr>
          ))}
          {!shown.length && (
            <tr>
              <td colSpan={columns.length + Number(numbered)} className="data-table-td text-center text-text-muted py-8">{empty}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
