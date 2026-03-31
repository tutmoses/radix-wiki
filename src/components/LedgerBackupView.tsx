// src/components/LedgerBackupView.tsx — Header dropdown for on-chain wiki backup

'use client';

import { useState } from 'react';
import { Upload, Download, CheckCircle, AlertCircle, ExternalLink, Loader2 } from 'lucide-react';
import { useFetch, useAuth, useStore } from '@/hooks';
import { Dropdown } from '@/components/ui';
import type { PageSnapshot, LedgerAnchor } from '@/lib/radix/ledger';

interface LedgerStatus {
  anchor: LedgerAnchor | null;
  hoursSinceAnchor: number | null;
}

interface PrepareResult {
  manifest: string;
  title: string;
  compressedSizeKB: number;
  timestamp: string;
}

interface RecoverResult {
  anchor: LedgerAnchor | null;
  pages: PageSnapshot[];
  recoveredCount: number;
}

interface LedgerDropdownProps {
  onClose: () => void;
  tagPath: string | null;
  slug: string | null;
}

export function LedgerDropdown({ onClose, tagPath, slug }: LedgerDropdownProps) {
  const { user } = useAuth();
  const sendTransaction = useStore(s => s.sendTransaction);
  const accountAddress = user?.radixAddress ?? null;

  const statusUrl = accountAddress ? `/api/ledger/status?address=${accountAddress}` : null;
  const { data: status, isLoading } = useFetch<LedgerStatus>(statusUrl);

  const [stage, setStage] = useState<'idle' | 'preparing' | 'signing' | 'done' | 'error'>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const [tab, setTab] = useState<'backup' | 'recover'>('backup');
  const [recoverAddress, setRecoverAddress] = useState('');
  const [recoveredPages, setRecoveredPages] = useState<PageSnapshot[] | null>(null);
  const [recovering, setRecovering] = useState(false);

  const canBackup = !!tagPath && !!slug;
  const lastBackupIsThisPage = status?.anchor?.slug === slug;

  async function handleBackup() {
    if (!canBackup) return;
    setStage('preparing');
    setBackupError(null);
    setTxHash(null);
    try {
      const res = await fetch('/api/ledger/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tagPath, slug }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed (${res.status})`);
      }
      const { manifest } = await res.json() as PrepareResult;
      setStage('signing');
      const result = await sendTransaction(manifest);
      setTxHash(result.transactionIntentHash);
      setStage('done');
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Backup failed');
      setStage('error');
    }
  }

  async function handleRecover() {
    const address = recoverAddress.trim() || accountAddress;
    if (!address) return;
    setRecovering(true);
    setBackupError(null);
    setRecoveredPages(null);
    try {
      const res = await fetch(`/api/ledger/recover?address=${encodeURIComponent(address)}`);
      if (!res.ok) throw new Error('Recovery failed');
      const data = await res.json() as RecoverResult;
      setRecoveredPages(data.pages);
    } catch (err) {
      setBackupError(err instanceof Error ? err.message : 'Recovery failed');
    } finally {
      setRecovering(false);
    }
  }

  const explorerBase = 'https://dashboard.radixdlt.com/transaction/';
  const busy = stage === 'preparing' || stage === 'signing';

  return (
    <Dropdown onClose={onClose} className="ledger-dropdown">
      <div className="notification-tabs">
        <button onClick={() => setTab('backup')} className={`notification-tab ${tab === 'backup' ? 'notification-tab-active' : ''}`}>
          <Upload size={14} />Backup
        </button>
        <button onClick={() => setTab('recover')} className={`notification-tab ${tab === 'recover' ? 'notification-tab-active' : ''}`}>
          <Download size={14} />Recover
        </button>
      </div>

      {tab === 'backup' ? (
        <div className="ledger-panel">
          {/* Status */}
          <div className="ledger-status-row">
            {isLoading ? (
              <Loader2 size={14} className="animate-spin text-text-muted" />
            ) : status?.anchor ? (
              <>
                <CheckCircle size={14} className="text-success shrink-0" />
                <span className="text-small">
                  Last backup: {status.anchor.slug}
                  {status.anchor.pageVersion && <span className="text-text-muted"> v{status.anchor.pageVersion}</span>}
                </span>
                <span className="text-xs text-text-muted">
                  {status.hoursSinceAnchor !== null && `${status.hoursSinceAnchor}h ago`}
                </span>
                {accountAddress && (
                  <a href={`https://dashboard.radixdlt.com/account/${accountAddress}`} target="_blank" rel="noopener" className="text-text-muted hover:text-accent shrink-0">
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

          {lastBackupIsThisPage && status?.anchor && (
            <div className="text-xs text-success">This page is already backed up</div>
          )}

          {/* Action */}
          {canBackup ? (
            <button className="ledger-action-btn" onClick={handleBackup} disabled={busy}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {stage === 'preparing' ? 'Preparing…' :
               stage === 'signing' ? 'Sign in wallet…' :
               stage === 'done' ? 'Done!' : `Backup "${slug}" to ledger`}
            </button>
          ) : (
            <div className="text-xs text-text-muted">Navigate to a wiki page to back it up.</div>
          )}

          {stage === 'done' && txHash && (
            <a href={`${explorerBase}${txHash}`} target="_blank" rel="noopener" className="ledger-tx-link">
              View transaction <ExternalLink size={12} />
            </a>
          )}

          {backupError && stage === 'error' && (
            <div className="text-error text-xs">{backupError}</div>
          )}

          <div className="text-xs text-text-muted">
            Compresses this page and stores it as metadata on your Radix account.
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

          {recoveredPages !== null && (
            recoveredPages.length > 0 ? (
              <div className="ledger-recovered-list">
                {recoveredPages.map(p => (
                  <div key={p.id} className="ledger-recovered-item">
                    <span className="text-small font-medium truncate">{p.title}</span>
                    <span className="text-xs text-text-muted">{p.tagPath} {p.version && `v${p.version}`}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-text-muted">No wiki backup found on this account.</div>
            )
          )}

          {backupError && tab === 'recover' && (
            <div className="text-error text-xs">{backupError}</div>
          )}
        </div>
      )}
    </Dropdown>
  );
}

export default LedgerDropdown;
