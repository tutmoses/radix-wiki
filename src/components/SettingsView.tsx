// src/components/SettingsView.tsx – /settings: an account's Telegram link and webhooks.
//
// Lived as a "Webhooks" tab inside the notification bell, so the bell held two
// things and the settings had no address to send anyone to.

'use client';

import { AuthRequired } from '@/components/AuthRequired';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { WebhookSettings } from '@/components/WebhookSettings';
import { useAuth } from '@/hooks';

export default function SettingsView({ watch }: { watch?: string }) {
  const { status } = useAuth();

  if (status !== 'signed-in') {
    return <AuthRequired status={status} title="Notification settings" reason="Connect your Radix wallet to manage Telegram and webhook notifications." />;
  }

  return (
    <div className="stack">
      <Breadcrumbs path={['settings']} />
      <h1 id="notification-settings">Notification settings</h1>
      <div className="settings-panel"><WebhookSettings watch={watch} /></div>
    </div>
  );
}
