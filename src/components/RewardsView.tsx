// src/components/RewardsView.tsx

'use client';

import { useState } from 'react';
import { Gift, Download, CheckCircle, ExternalLink } from 'lucide-react';
import { useFetch, useAuth } from '@/hooks';

interface EditorShare {
  id: string;
  displayName: string | null;
  radixAddress: string;
  points: number;
  share: number;
  amountXrd: number;
}

interface AirdropRecord {
  id: string;
  totalXrd: number;
  editorCount: number;
  txHash: string | null;
  createdAt: string;
}

interface RewardsData {
  treasury: { address: string; balance: number };
  totalPoints: number;
  editors: EditorShare[];
  airdrops: AirdropRecord[];
}

export default function RewardsView() {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, error } = useFetch<RewardsData>(isAuthenticated ? '/api/admin/rewards' : null);
  const [txHash, setTxHash] = useState('');
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);

  if (!isAuthenticated) {
    return (
      <div className="stack">
        <h1>Rewards Admin</h1>
        <p className="text-text-muted">Connect your wallet to access the rewards dashboard.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stack">
        <h1>Rewards Admin</h1>
        <p className="text-error">Access denied or failed to load rewards data.</p>
      </div>
    );
  }

  async function handleDownloadCsv() {
    const res = await fetch('/api/admin/rewards?format=csv');
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'airdrop.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleRecordAirdrop() {
    if (!txHash.trim() || !data) return;
    setRecording(true);
    try {
      const snapshot = data.editors.map(e => ({
        radixAddress: e.radixAddress,
        displayName: e.displayName,
        points: e.points,
        share: e.share,
        amountXrd: e.amountXrd,
      }));
      const res = await fetch('/api/admin/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ txHash: txHash.trim(), totalXrd: data.treasury.balance, snapshot }),
      });
      if (res.ok) { setRecorded(true); setTxHash(''); }
    } finally {
      setRecording(false);
    }
  }

  return (
    <div className="stack">
      <div className="stack-sm">
        <div className="row">
          <Gift size={24} className="text-accent" />
          <h1>Rewards Admin</h1>
        </div>
        <p className="text-text-muted">Manage wiki editor airdrop distributions from the treasury.</p>
      </div>

      {/* Treasury */}
      <div className="surface rounded-lg p-4 stack-sm">
        <h2 className="text-small text-text-muted uppercase tracking-wide">Treasury</h2>
        {isLoading ? (
          <div className="h-10 skeleton rounded" />
        ) : data && (
          <>
            <p className="text-2xl font-bold text-accent">{Math.floor(data.treasury.balance).toLocaleString()} XRD</p>
            <p className="text-small text-text-muted font-mono truncate">{data.treasury.address}</p>
          </>
        )}
      </div>

      {/* Editor shares */}
      <div className="surface rounded-lg overflow-hidden">
        <div className="p-4 border-b border-surface-2 row justify-between">
          <h2>Editor Shares</h2>
          <button onClick={handleDownloadCsv} className="btn btn-sm btn-secondary row gap-1" disabled={isLoading}>
            <Download size={14} /> CSV
          </button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-small text-text-muted border-b border-surface-2">
              <th className="p-3">Editor</th>
              <th className="p-3 text-right">Points</th>
              <th className="p-3 text-right">Share</th>
              <th className="p-3 text-right">XRD</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }, (_, i) => (
              <tr key={i} className="border-b border-surface-2">
                <td className="p-3" colSpan={4}><div className="h-6 skeleton rounded" /></td>
              </tr>
            ))}
            {data?.editors.map(e => (
              <tr key={e.id} className="border-b border-surface-2 last:border-0">
                <td className="p-3">
                  <span className="font-medium">{e.displayName || e.radixAddress.slice(0, 16) + '...'}</span>
                </td>
                <td className="p-3 text-right">{e.points.toLocaleString()}</td>
                <td className="p-3 text-right">{(e.share * 100).toFixed(1)}%</td>
                <td className="p-3 text-right font-medium text-accent">{e.amountXrd.toLocaleString()}</td>
              </tr>
            ))}
            {data && data.editors.length === 0 && (
              <tr><td colSpan={4} className="p-8 text-center text-text-muted">No editors with points yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Record airdrop */}
      <div className="surface rounded-lg p-4 stack-sm">
        <h2>Record Airdrop</h2>
        <p className="text-small text-text-muted">After distributing via Radix Desktop Tool, paste the transaction hash to record it.</p>
        <div className="row gap-2">
          <input
            type="text"
            value={txHash}
            onChange={e => setTxHash(e.target.value)}
            placeholder="Transaction hash..."
            className="input flex-1 font-mono text-small"
          />
          <button onClick={handleRecordAirdrop} className="btn btn-primary" disabled={recording || !txHash.trim()}>
            {recording ? 'Recording...' : 'Record'}
          </button>
        </div>
        {recorded && (
          <p className="text-success row gap-1"><CheckCircle size={14} /> Airdrop recorded successfully.</p>
        )}
      </div>

      {/* History */}
      {data && data.airdrops.length > 0 && (
        <div className="surface rounded-lg overflow-hidden">
          <div className="p-4 border-b border-surface-2">
            <h2>Airdrop History</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-left text-small text-text-muted border-b border-surface-2">
                <th className="p-3">Date</th>
                <th className="p-3 text-right">Total XRD</th>
                <th className="p-3 text-right">Editors</th>
                <th className="p-3">Tx Hash</th>
              </tr>
            </thead>
            <tbody>
              {data.airdrops.map(a => (
                <tr key={a.id} className="border-b border-surface-2 last:border-0">
                  <td className="p-3">{new Date(a.createdAt).toLocaleDateString()}</td>
                  <td className="p-3 text-right font-medium">{a.totalXrd.toLocaleString()}</td>
                  <td className="p-3 text-right">{a.editorCount}</td>
                  <td className="p-3 font-mono text-small truncate max-w-48">
                    {a.txHash ? (
                      <a href={`https://dashboard.radixdlt.com/transaction/${a.txHash}`} target="_blank" rel="noopener" className="row gap-1 text-accent">
                        {a.txHash.slice(0, 16)}... <ExternalLink size={12} />
                      </a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
