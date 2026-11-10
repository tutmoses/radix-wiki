// src/components/AuthRequired.tsx – a view that needs a session, opened without one

'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/ui';
import { SESSION_UNREADABLE, useStore, type AuthStatus } from '@/hooks';

export function PageSkeleton() {
  return (
    <div className="stack">
      <div className="h-8 w-48 skeleton rounded" />
      <div className="h-48 skeleton" />
      <div className="h-6 w-3/4 skeleton rounded" />
      <div className="h-6 w-1/2 skeleton rounded" />
    </div>
  );
}

/**
 * While the session is still being read it waits rather than asking a reader
 * who is signed in to connect. `reason` says what the wallet is for.
 */
export function AuthRequired({ status, title, reason, backHref }: { status: Exclude<AuthStatus, 'signed-in'>; title: string; reason: string; backHref?: string }) {
  const connect = useStore(s => s.connect);
  if (status === 'checking') return <PageSkeleton />;
  return (
    <EmptyState
      as="h1" title={title}
      description={status === 'unreadable' ? SESSION_UNREADABLE : reason}
      action={
        <div className="row justify-center">
          <Button onClick={connect} isLoading={status === 'connecting'}>Connect Wallet</Button>
          {backHref && <Link href={backHref}><Button variant="secondary"><ArrowLeft size={18} />Back</Button></Link>}
        </div>
      }
    />
  );
}
