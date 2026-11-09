// src/components/LedgerBackupView.tsx — Header dropdown for on-chain wiki backup

'use client';

import { useState } from 'react';
import { Upload, Download, CheckCircle, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { useFetch, useAuth, useStore } from '@/hooks';
import { Dropdown } from '@/components/ui';
import type { RestoredPage, LedgerAnchor } from '@/lib/radix/ledger';
import { DASHBOARD_URL } from '@/lib/radix/config';
import { sendJson } from '@/lib/utils';

interface LedgerStatus {
  anchor: LedgerAnchor | null;
  hoursSinceAnchor: number | null;
  backupTxHash: string | null;
}

interface PrepareResult {
  manifest: string;
  title: string;
  sizeKB: number;
  timestamp: string;
}

interface RecoverResult {
  anchor: LedgerAnchor | null;
  pages: RestoredPage[];
  recoveredCount: number;
}

// Each tab's state machine carries its own result or error, so a failure on
// one never shows on the other.
type Backup =
  | { stage: 'idle' }
  | { stage: 'preparing' }
  | { stage: 'signing' }
  | { stage: 'done'; txHash: string }
  | { stage: 'error'; message: string };

type Recovery =
  | { stage: 'idle' }
  | { stage: 'reading' }
  | { stage: 'done'; pages: RestoredPage[] }
  | { stage: 'error'; message: string };

interface LedgerDropdownProps {
  tagPath: string | null;
  slug: string | null;
}

export function LedgerDropdown({ tagPath, slug }: LedgerDropdownProps) {
  const { user } = useAuth();
  const sendTransaction = useStore(s => s.sendTransaction);
  const accountAddress = user?.radixAddress ?? null;

  const statusUrl = accountAddress ? `/api/ledger/status?address=${accountAddress}` : null;
  const { data: status, status: statusFetch } = useFetch<LedgerStatus>(statusUrl);

  const [backup, setBackup] = useState<Backup>({ stage: 'idle' });
  const [tab, setTab] = useState<'backup' | 'recover'>('backup');
  const [recoverAddress, setRecoverAddress] = useState('');
  const [recovery, setRecovery] = useState<Recovery>({ stage: 'idle' });

  const canBackup = !!tagPath && !!slug;
  // The status endpoint is edge-cached, so a refetch would still read the
  // anchor from before this backup: once it is done, the backup is the status.
  const backedUp = backup.stage === 'done';
  const lastBackupIsThisPage = backedUp || status?.anchor?.slug === slug;

  async function handleBackup() {
    if (!canBackup) return;
    setBackup({ stage: 'preparing' });
    try {
      const res = await sendJson('/api/ledger/prepare', 'POST', { tagPath, slug });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }
      const { manifest } = await res.json() as PrepareResult;
      setBackup({ stage: 'signing' });
      const result = await sendTransaction(manifest);
      const hash = result.transactionIntentHash;
      setBackup({ stage: 'done', txHash: hash });
      // Persist tx hash to database (fire-and-forget)
      sendJson('/api/ledger/confirm', 'POST', { tagPath, slug, txHash: hash }).catch(() => {});
    } catch (err) {
      setBackup({ stage: 'error', message: err instanceof Error ? err.message : 'Backup failed' });
    }
  }

  async function handleRecover() {
    const address = recoverAddress.trim() || accountAddress;
    if (!address) return;
    setRecovery({ stage: 'reading' });
    try {
      const res = await fetch(`/api/ledger/recover?address=${encodeURIComponent(address)}`);
      if (!res.ok) throw new Error('Recovery failed');
      const data = await res.json() as RecoverResult;
      setRecovery({ stage: 'done', pages: data.pages });
    } catch (err) {
      setRecovery({ stage: 'error', message: err instanceof Error ? err.message : 'Recovery failed' });
    }
  }

  const explorerBase = `${DASHBOARD_URL}/transaction/`;
  const busy = backup.stage === 'preparing' || backup.stage === 'signing';
  const recovering = recovery.stage === 'reading';

  return (
    <Dropdown className="ledger-dropdown">
      <div className="dropdown-tabs">
        <button onClick={() => setTab('backup')} className={`dropdown-tab ${tab === 'backup' ? 'dropdown-tab-active' : ''}`}>
          <Upload size={14} />Backup
        </button>
        <button onClick={() => setTab('recover')} className={`dropdown-tab ${tab === 'recover' ? 'dropdown-tab-active' : ''}`}>
          <Download size={14} />Recover
        </button>
      </div>

      {tab === 'backup' ? (
        <div className="ledger-panel">
          {/* Status */}
          <div className="ledger-status-row">
            {backedUp ? (
              <>
                <CheckCircle size={14} className="text-success shrink-0" />
                <span className="text-small">Last backup: {slug}</span>
                <span className="text-xs text-text-muted">just now</span>
              </>
            ) : statusFetch === 'loading' ? (
              <Loader2 size={14} className="animate-spin text-text-muted" />
            ) : statusFetch === 'failed' ? (
              <>
                <AlertCircle size={14} className="text-error shrink-0" />
                <span className="text-small">Could not read your account&rsquo;s backup status</span>
              </>
            ) : status?.anchor ? (
              <>
                <CheckCircle size={14} className="text-success shrink-0" />
                <span className="text-small">
                  Last backup: {status.anchor.slug}
                  <span className="text-text-muted"> v{status.anchor.pageVersion}</span>
                </span>
                <span className="text-xs text-text-muted">
                  {status.hoursSinceAnchor !== null && `${status.hoursSinceAnchor}h ago`}
                </span>
                {status.backupTxHash && (
                  <a href={`${explorerBase}${status.backupTxHash}`} target="_blank" rel="noopener" className="text-text-muted hover:text-accent shrink-0">
                    <ExternalLink size={12} />
                  </a>
                )}
              </>
            ) : (
              <>
                <AlertCircle size={14} className="text-warning shrink-0" />
                <span className="text-small">No backup on your account yet</span>
              </>
            )}
          </div>

          {lastBackupIsThisPage && (
            <div className="text-xs text-success">This page is already backed up</div>
          )}

          {/* Action */}
          {canBackup ? (
            <button className="ledger-action-btn" onClick={handleBackup} disabled={busy || backedUp}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : backedUp ? <CheckCircle size={14} /> : <Upload size={14} />}
              {backup.stage === 'preparing' ? 'Preparing…' :
               backup.stage === 'signing' ? 'Sign in wallet…' :
               backedUp ? 'Done!' : `Backup "${slug}" to ledger`}
            </button>
          ) : (
            <div className="text-xs text-text-muted">Navigate to a wiki page to back it up.</div>
          )}

          {backup.stage === 'done' && (
            <a href={`${explorerBase}${backup.txHash}`} target="_blank" rel="noopener" className="ledger-tx-link">
              View transaction <ExternalLink size={12} />
            </a>
          )}

          {backup.stage === 'error' && (
            <div className="text-error text-xs">{backup.message}</div>
          )}

          <div className="text-xs text-text-muted">
            Stores this page as MDX metadata on your Radix account.
          </div>
        </div>
      ) : (
        <div className="ledger-panel">
          <div className="text-xs text-text-muted">
            Enter a Radix account address to recover wiki pages from.
          </div>
          <input
            className="input text-small"
            placeholder={accountAddress ? `Your account (${accountAddress.slice(0, 20)}…)` : 'account_rdx1...'}
            value={recoverAddress}
            onChange={e => setRecoverAddress(e.target.value)}
          />
          <button
            className="ledger-action-btn"
            onClick={handleRecover}
            disabled={recovering || (!recoverAddress.trim() && !accountAddress)}
          >
            {recovering ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {recovering ? 'Reading ledger…' : 'Recover pages'}
          </button>

          {recovery.stage === 'done' && (
            recovery.pages.length > 0 ? (
              <div className="ledger-recovered-list">
                {recovery.pages.map(p => (
                  <div key={p.slug} className="ledger-recovered-item">
                    <span className="text-small font-medium truncate">{p.title}</span>
                    <span className="text-xs text-text-muted">{p.tagPath} v{p.version}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-text-muted">No wiki backup found on this account.</div>
            )
          )}

          {recovery.stage === 'error' && (
            <div className="text-error text-xs">{recovery.message}</div>
          )}
        </div>
      )}
    </Dropdown>
  );
}
