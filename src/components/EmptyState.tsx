// src/components/EmptyState.tsx – the one rendering of "there is nothing here".
//
// A 404, a sign-in wall, an empty table and a filtered-out grid used to be four
// shapes: a status card, an inline `.empty-state` div, a chart panel and a dozen
// hand-styled sentences. No 'use client', so the error boundary, the server
// chart panels and the client views all render the same markup.

import type { ReactNode } from 'react';
import { slugifyHeading } from 'wiki-formant/headings';
import { cn } from '@/lib/utils';

export function EmptyState({ title, description, action, as = 'p', className }: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** `h1` when the state is the whole page: a 404, an error, a sign-in wall. */
  as?: 'p' | 'h1';
  className?: string;
}) {
  return (
    <div className={cn('empty-state', className)}>
      {as === 'h1' ? <h1 id={slugifyHeading(title)}>{title}</h1> : <p className="empty-state-title">{title}</p>}
      {description && <div className="empty-state-desc">{description}</div>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}
