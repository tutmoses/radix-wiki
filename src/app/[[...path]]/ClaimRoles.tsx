// src/app/[[...path]]/ClaimRoles.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks';
import { readAssignee } from '@/lib/assignee';
import { getMetadataKeys } from '@/lib/tags';
import { categoryLabel, mustReload, pagePath, sendJson, shortenAddress } from '@/lib/utils';
import type { WikiPage } from '@/types';

/**
 * A card's people fields as one-click roles: an open role the reader can take,
 * and the role they hold, which they can step down from. One role per person,
 * so the lead and the deputy are two people. The save is the editor's, with the
 * same $XRD gate and the same refusal when the card moved on.
 */
export function ClaimRoles({ page }: { page: WikiPage }) {
  const router = useRouter();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!user) return null;

  const metadata = (page.metadata ?? {}) as Record<string, unknown>;
  const roles = getMetadataKeys(page.tagPath.split('/'))
    .filter(k => k.type === 'user')
    .map(k => {
      const holder = readAssignee(metadata[k.key]);
      return { key: k.key, name: categoryLabel(k.label).replace(/:$/, ''), open: holder.kind === 'none', mine: holder.kind === 'member' && holder.id === user.id };
    });
  const held = roles.find(r => r.mine);
  const offers = held ? [held] : roles.filter(r => r.open);
  if (!offers.length) return null;

  const me = user.displayName || shortenAddress(user.radixAddress);
  const act = async (key: string, role: string, take: boolean) => {
    setBusy(true);
    setError(null);
    const { [key]: _old, ...rest } = metadata;
    const next = take ? { ...rest, [key]: JSON.stringify({ id: user.id, name: me, address: shortenAddress(user.radixAddress) }) } : rest;
    try {
      const res = await sendJson(`/api/wiki${pagePath(page.tagPath, page.slug)}`, 'PUT', {
        metadata: next, baseVersion: page.version,
        revisionMessage: take ? `${me} took the ${role} role` : `${me} stepped down as ${role}`,
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return router.refresh();
      setError(mustReload(res.status, data) ? 'This card changed since you opened it. Reload and try again.' : data.error || 'Could not save.');
    } catch {
      setError('Could not save.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack-xs">
      <div className="row flex-wrap">
        {offers.map(r => (
          <Button key={r.key} size="sm" variant={r.mine ? 'ghost' : 'primary'} disabled={busy} onClick={() => act(r.key, r.name, !r.mine)}>
            {r.mine ? `Step down as ${r.name}` : `Claim ${r.name}`}
          </Button>
        ))}
      </div>
      {error && <span className="text-error text-xs">{error}</span>}
    </div>
  );
}
