// src/components/RewardsView.tsx

'use client';

import { useState } from 'react';
import { Gift, Download, CheckCircle, ExternalLink } from 'lucide-react';
import { useTableSort } from 'wiki-formant/react';
import { useFetch, useAuth } from '@/hooks';
import { Button, SortHead } from '@/components/ui';
import { DASHBOARD_URL } from '@/lib/radix/config';
import { formatDate } from '@/lib/utils';

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

const editorName = (e: EditorShare) => e.displayName || e.radixAddress;
const EDITOR_COMPARATORS = {
  editor: (a: EditorShare, b: EditorShare) => editorName(a).localeCompare(editorName(b)),
  points: (a: EditorShare, b: EditorShare) => a.points - b.points,
  share: (a: EditorShare, b: EditorShare) => a.share - b.share,
  xrd: (a: EditorShare, b: EditorShare) => a.amountXrd - b.amountXrd,
};
const AIRDROP_COMPARATORS = {
  date: (a: AirdropRecord, b: AirdropRecord) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  total: (a: AirdropRecord, b: AirdropRecord) => a.totalXrd - b.totalXrd,
  editors: (a: AirdropRecord, b: AirdropRecord) => a.editorCount - b.editorCount,
  tx: (a: AirdropRecord, b: AirdropRecord) => (a.txHash ?? '').localeCompare(b.txHash ?? ''),
};
// Names and hashes read A–Z first; amounts and dates open largest and newest first.
const firstDirection = (key: string): 'asc' | 'desc' => (key === 'editor' || key === 'tx' ? 'asc' : 'desc');
const NONE: never[] = [];

export default function RewardsView() {
  const { isAuthenticated } = useAuth();
  const { data, isLoading, error } = useFetch<RewardsData>(isAuthenticated ? '/api/admin/rewards' : null);
  const [txHash, setTxHash] = useState('');
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const editors = useTableSort<EditorShare, keyof typeof EDITOR_COMPARATORS>(data?.editors ?? NONE, { defaultKey: 'points', comparators: EDITOR_COMPARATORS, defaultDirection: firstDirection });
  const airdrops = useTableSort<AirdropRecord, keyof typeof AIRDROP_COMPARATORS>(data?.airdrops ?? NONE, { defaultKey: 'date', comparators: AIRDROP_COMPARATORS, defaultDirection: firstDirection });

  if (!isAuthenticated) {
    return (
      <div className="stack">
        <h1 id="rewards-admin">Rewards Admin</h1>
        <p className="text-text-muted">Connect your wallet to access the rewards dashboard.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stack">
        <h1 id="rewards-admin">Rewards Admin</h1>
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
          <h1 id="rewards-admin">Rewards Admin</h1>
        </div>
        <p className="text-text-muted">Manage wiki editor airdrop distributions from the treasury.</p>
      </div>

      {/* Treasury */}
      <div className="surface rounded-lg p-4 stack-sm">
        <h2 id="treasury" className="text-small text-text-muted uppercase tracking-wide">Treasury</h2>
        {isLoading ? (
          <div className="h-10 skeleton rounded" />
        ) : data && (
          <>
            <p className="text-2xl font-bold text-accent">{Math.floor(data.treasury.balance).toLocaleString('en-US')} $XRD</p>
            <p className="text-small text-text-muted font-mono truncate">{data.treasury.address}</p>
          </>
        )}
      </div>

      {/* Editor shares */}
      <div className="surface rounded-lg overflow-hidden">
        <div className="p-4 border-b border-surface-2 row justify-between">
          <h2 id="editor-shares">Editor Shares</h2>
          <Button onClick={handleDownloadCsv} variant="secondary" size="sm" className="gap-1" disabled={isLoading}>
            <Download size={14} /> CSV
          </Button>
        </div>
        <table className="w-full">
          <thead>
            <tr className="text-left text-small text-text-muted border-b border-surface-2">
              <SortHead {...editors.headerProps('editor')} className="p-3">Editor</SortHead>
              <SortHead {...editors.headerProps('points')} className="p-3 text-right">Points</SortHead>
              <SortHead {...editors.headerProps('share')} className="p-3 text-right">Share</SortHead>
              <SortHead {...editors.headerProps('xrd')} className="p-3 text-right">$XRD</SortHead>
            </tr>
          </thead>
          <tbody>
            {isLoading && Array.from({ length: 5 }, (_, i) => (
              <tr key={i} className="border-b border-surface-2">
                <td className="p-3" colSpan={4}><div className="h-6 skeleton rounded" /></td>
              </tr>
            ))}
            {editors.sorted.map(e => (
              <tr key={e.id} className="border-b border-surface-2 last:border-0">
                <td className="p-3">
                  <span className="font-medium">{e.displayName || e.radixAddress.slice(0, 16) + '...'}</span>
                </td>
                <td className="p-3 text-right">{e.points.toLocaleString('en-US')}</td>
                <td className="p-3 text-right">{(e.share * 100).toFixed(1)}%</td>
                <td className="p-3 text-right font-medium text-accent">{e.amountXrd.toLocaleString('en-US')}</td>
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
        <h2 id="record-airdrop">Record Airdrop</h2>
        <p className="text-small text-text-muted">After distributing via Radix Desktop Tool, paste the transaction hash to record it.</p>
        <div className="row gap-2">
          <input
            type="text"
            value={txHash}
            onChange={e => setTxHash(e.target.value)}
            placeholder="Transaction hash..."
            className="input flex-1 font-mono text-small"
          />
          <Button onClick={handleRecordAirdrop} disabled={recording || !txHash.trim()}>
            {recording ? 'Recording...' : 'Record'}
          </Button>
        </div>
        {recorded && (
          <p className="text-success row gap-1"><CheckCircle size={14} /> Airdrop recorded successfully.</p>
        )}
      </div>

      {/* History */}
      {data && data.airdrops.length > 0 && (
        <div className="surface rounded-lg overflow-hidden">
          <div className="p-4 border-b border-surface-2">
            <h2 id="airdrop-history">Airdrop History</h2>
          </div>
          <table className="w-full">
            <thead>
              <tr className="text-left text-small text-text-muted border-b border-surface-2">
                <SortHead {...airdrops.headerProps('date')} className="p-3">Date</SortHead>
                <SortHead {...airdrops.headerProps('total')} className="p-3 text-right">Total $XRD</SortHead>
                <SortHead {...airdrops.headerProps('editors')} className="p-3 text-right">Editors</SortHead>
                <SortHead {...airdrops.headerProps('tx')} className="p-3">Tx Hash</SortHead>
              </tr>
            </thead>
            <tbody>
              {airdrops.sorted.map(a => (
                <tr key={a.id} className="border-b border-surface-2 last:border-0">
                  <td className="p-3">{formatDate(a.createdAt)}</td>
                  <td className="p-3 text-right font-medium">{a.totalXrd.toLocaleString('en-US')}</td>
                  <td className="p-3 text-right">{a.editorCount}</td>
                  <td className="p-3 font-mono text-small truncate max-w-48">
                    {a.txHash ? (
                      <a href={`${DASHBOARD_URL}/transaction/${a.txHash}`} target="_blank" rel="noopener" className="row gap-1 text-accent">
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
