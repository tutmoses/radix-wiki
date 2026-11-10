// src/components/SettingsView.tsx – /settings: an account's Telegram link and webhooks.
//
// Lived as a "Webhooks" tab inside the notification bell, so the bell held two
// things and the settings had no address to send anyone to.

'use client';

import { Breadcrumbs } from '@/components/Breadcrumbs';
import { EmptyState } from '@/components/EmptyState';
import { WebhookSettings } from '@/components/WebhookSettings';
import { Button } from '@/components/ui';
import { useAuth, useStore } from '@/hooks';

export default function SettingsView({ watch }: { watch?: string }) {
  const { status } = useAuth();
  const connect = useStore(s => s.connect);

  if (status === 'checking') return <div className="h-64 skeleton" />;
  if (status !== 'signed-in') {
    return (
      <EmptyState
        as="h1" title="Notification settings"
        description="Connect your Radix wallet to manage Telegram and webhook notifications."
        action={<Button onClick={connect} isLoading={status === 'connecting'}>Connect Wallet</Button>}
      />
    );
  }

  return (
    <div className="stack">
      <Breadcrumbs path={['settings']} />
      <h1 id="notification-settings">Notification settings</h1>
      <div className="settings-panel"><WebhookSettings watch={watch} /></div>
    </div>
  );
}
