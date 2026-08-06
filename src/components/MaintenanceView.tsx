// src/components/MaintenanceView.tsx - Tracking categories, rendered as work queues.

import Link from 'next/link';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { Card } from '@/components/ui';
import type { MaintenanceQueue } from '@/lib/maintenance';

export function MaintenanceView({ queues }: { queues: MaintenanceQueue[] }) {
  const total = queues.reduce((n, q) => n + q.items.length, 0);
  return (
    <div className="stack">
      <Breadcrumbs path={['maintenance']} />
      <h1>Maintenance</h1>
      <p className="text-text-muted text-lg">
        Pages the wiki&rsquo;s own rules flag as needing work. Each queue is derived, not curated — fix the page and it
        leaves the list on the next revalidation.
      </p>
      {total === 0 ? (
        <Card className="empty-state"><p className="text-text-muted">Nothing needs attention. Every page is verified, linked, sourced, and complete.</p></Card>
      ) : (
        queues.map(queue => (
          <section key={queue.key} className="maintenance-queue">
            <h2 id={queue.key}>{queue.title} <span className="maintenance-count">{queue.items.length}</span></h2>
            <p className="text-text-muted text-small">{queue.description}</p>
            <ul className="maintenance-list">
              {queue.items.map(item => (
                <li key={item.href} className="maintenance-item">
                  <Link href={item.href} className="link">{item.title}</Link>
                  <span className="maintenance-detail">{item.tagPath} · {item.detail}</span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

export default MaintenanceView;
