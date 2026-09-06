// src/components/charts/LedgerUnavailable.tsx — shown when the Gateway will not answer a state read

import { AlertTriangle } from 'lucide-react';
import { getLedgerStatus } from '@/lib/radix/network';

/**
 * The honest rendering of an unreadable ledger. Every number on /charts is derived from
 * `/state/*`, and when those refuse, the alternative to this panel is a page of zeros —
 * which is what /charts showed for the six days after mainnet halted on 31 August 2026.
 * The stamp is real even then, so it is worth printing: it says how far back the last
 * agreed round is, which is the reader's actual question.
 */
export default async function LedgerUnavailable({ what }: { what: string }) {
  const status = await getLedgerStatus();
  const stoppedFor = status?.lastRoundAt
    ? Math.floor((Date.now() - new Date(status.lastRoundAt).getTime()) / 3_600_000)
    : null;

  return (
    <div className="ledger-unavailable">
      <AlertTriangle size={18} className="text-accent" />
      <div className="stack-xs">
        <strong>{what} is unavailable.</strong>
        <p className="text-small text-text-muted">
          The Radix Gateway is not answering state reads, so there are no live numbers to show.
          No figure is displayed rather than a zero, because a zero here would be a measurement
          that was never taken.
        </p>
        {status && (
          <p className="text-small text-text-muted">
            Last ledger state seen: epoch {status.epoch.toLocaleString()}, state version{' '}
            {status.stateVersion.toLocaleString()}
            {status.lastRoundAt && (
              <> — the last round agreed at {status.lastRoundAt.replace('T', ' ').slice(0, 19)} UTC
              {stoppedFor !== null && stoppedFor >= 1 && <>, {stoppedFor.toLocaleString()} hours ago</>}.</>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
