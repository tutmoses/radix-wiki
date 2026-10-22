// src/components/MaintenanceView.tsx - Tracking categories, rendered as work queues.

import Link from 'next/link';
import { MaintenanceQueues } from 'wiki-formant/react-server';
import type { MaintenanceQueue } from 'wiki-formant/queues';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { EmptyState } from '@/components/EmptyState';

function MaintenanceView({ queues }: { queues: MaintenanceQueue[] }) {
  return (
    <div className="stack">
      <Breadcrumbs path={['maintenance']} />
      <h1 id="maintenance">Maintenance</h1>
      <p className="text-text-muted text-lg">
        Pages the wiki&rsquo;s own rules flag as needing work. Each queue is derived, not curated — fix the page and it
        leaves the list on the next revalidation.
      </p>
      <MaintenanceQueues
        queues={queues}
        link={Link}
        empty={<EmptyState title="Nothing needs attention." description="Every page is verified, linked, sourced and complete." />}
      />
    </div>
  );
}

export default MaintenanceView;
