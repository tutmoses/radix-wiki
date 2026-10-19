// src/components/RewardsSection.tsx – the airdrop admin, as the last section of /maintenance.
//
// It was /rewards, a page nothing linked to. `/api/admin/rewards` answers only the
// ADMIN_ADDRESS session, so for everyone else this renders nothing.

'use client';

import { useState } from 'react';
import { Download, CheckCircle, ExternalLink } from 'lucide-react';
import { useFetch, useAuth } from '@/hooks';
import { Button } from '@/components/ui';
import { DataTable, type Column } from '@/components/charts/DataTable';
import { DASHBOARD_URL } from '@/lib/radix/config';
import { formatDay } from 'wiki-formant/freshness';
import { sendJson } from '@/lib/utils';

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

const EDITOR_COLUMNS: Column<EditorShare>[] = [
  { k: 'editor', label: 'Editor', cellClass: 'font-medium', text: e => e.displayName || e.radixAddress, cell: e => e.displayName || e.radixAddress.slice(0, 16) + '...' },
  { k: 'points', label: 'Points', className: 'text-right', num: e => e.points, cell: e => e.points.toLocaleString('en-US') },
  { k: 'share', label: 'Share', className: 'text-right', num: e => e.share, cell: e => `${(e.share * 100).toFixed(1)}%` },
  { k: 'xrd', label: '$XRD', className: 'text-right', cellClass: 'font-medium text-accent', num: e => e.amountXrd, cell: e => e.amountXrd.toLocaleString('en-US') },
];
const AIRDROP_COLUMNS: Column<AirdropRecord>[] = [
  { k: 'date', label: 'Date', num: a => Date.parse(a.createdAt), cell: a => formatDay(a.createdAt) },
  { k: 'total', label: 'Total $XRD', className: 'text-right', cellClass: 'font-medium', num: a => a.totalXrd, cell: a => a.totalXrd.toLocaleString('en-US') },
  { k: 'editors', label: 'Editors', className: 'text-right', num: a => a.editorCount, cell: a => a.editorCount },
  {
    k: 'tx', label: 'Tx Hash', cellClass: 'font-mono text-small truncate max-w-48', text: a => a.txHash ?? '',
    cell: a => (a.txHash ? (
      <a href={`${DASHBOARD_URL}/transaction/${a.txHash}`} target="_blank" rel="noopener" className="row gap-1 text-accent">
        {a.txHash.slice(0, 16)}... <ExternalLink size={12} />
      </a>
    ) : '—'),
  },
];

export function RewardsSection() {
  const { isAuthenticated } = useAuth();
  const { data } = useFetch<RewardsData>(isAuthenticated ? '/api/admin/rewards' : null);
  const [txHash, setTxHash] = useState('');
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);

  // A 403 for everyone but the admin, so no data means no section.
  if (!data) return null;

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
      const res = await sendJson('/api/admin/rewards', 'POST', { txHash: txHash.trim(), totalXrd: data.treasury.balance, snapshot });
      if (res.ok) { setRecorded(true); setTxHash(''); }
    } finally {
      setRecording(false);
    }
  }

  return (
    <section className="stack" aria-labelledby="rewards">
      <div className="stack-sm">
        <h2 id="rewards">Rewards</h2>
        <p className="text-text-muted">Editor airdrops from the treasury. Only the admin account sees this section.</p>
      </div>

      {/* Treasury */}
      <div className="surface p-4 stack-sm">
        <h3 id="treasury" className="text-small text-text-muted uppercase tracking-wide">Treasury</h3>
        <p className="text-2xl font-bold text-accent">{Math.floor(data.treasury.balance).toLocaleString('en-US')} $XRD</p>
        <p className="text-small text-text-muted font-mono truncate">{data.treasury.address}</p>
      </div>

      {/* Editor shares */}
      <div className="stack-sm">
        <div className="spread">
          <h3 id="editor-shares">Editor Shares</h3>
          <Button onClick={handleDownloadCsv} variant="secondary" size="sm" className="gap-1">
            <Download size={14} /> CSV
          </Button>
        </div>
        <DataTable rows={data.editors} columns={EDITOR_COLUMNS} defaultKey="points" rowKey={e => e.id} empty="No editors with points yet." />
      </div>

      {/* Record airdrop */}
      <div className="surface p-4 stack-sm">
        <h3 id="record-airdrop">Record Airdrop</h3>
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
      <div className="stack-sm">
        <h3 id="airdrop-history">Airdrop History</h3>
        <DataTable rows={data.airdrops} columns={AIRDROP_COLUMNS} defaultKey="date" rowKey={a => a.id} empty="No airdrops yet." />
      </div>
    </section>
  );
}
