// src/components/charts/CopyAddress.tsx – a ledger address, shortened, that copies in full

'use client';

import { Check, Copy } from 'lucide-react';
import { useCopy } from 'wiki-formant/react';
import { shortenAddress } from '@/lib/utils';

export function CopyAddress({ address }: { address: string }) {
  const { copied, copy } = useCopy();
  return (
    <button type="button" className="address-copy" onClick={() => copy(address)} title={address}>
      {shortenAddress(address, 10)}
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}
