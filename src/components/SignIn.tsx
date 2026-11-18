// src/components/SignIn.tsx

'use client';

import { useState } from 'react';
import { KeyRound, Wallet } from 'lucide-react';
import { useStore } from '@/hooks';
import { Button, Input } from '@/components/ui';

/** The longest name a passkey account can take, as `@/lib/passkey` holds it to. */
const NAME_MAX = 24;

/**
 * The two ways in, wherever they are offered: the header's menu and the
 * trollbox's foot. A wallet signs in the account its $XRD belongs to; a passkey
 * signs in an account that saved one, or makes one for a reader with no wallet.
 */
export function SignInOptions({ onDone }: { onDone?: () => void }) {
  const connect = useStore(s => s.connect);
  const passkey = useStore(s => s.passkey);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const run = async (ceremony: 'register' | 'login') => {
    setBusy(true);
    const done = await passkey(ceremony, name);
    setBusy(false);
    if (done) onDone?.();
  };

  return (
    <>
      <button type="button" className="dropdown-item" onClick={() => { onDone?.(); connect(); }}><Wallet size={16} />Radix Wallet</button>
      <button type="button" className="dropdown-item" disabled={busy} onClick={() => run('login')}><KeyRound size={16} />Passkey</button>
      <form className="signin-new" onSubmit={e => { e.preventDefault(); run('register'); }}>
        <label htmlFor="signin-name" className="text-small text-text-muted">No wallet? Pick a name and save a passkey. A passkey account can chat; editing needs a wallet.</label>
        <Input id="signin-name" value={name} onChange={e => setName(e.target.value)} placeholder="Name" autoComplete="nickname" minLength={2} maxLength={NAME_MAX} required />
        <Button type="submit" variant="secondary" size="sm" disabled={busy}>Create account</Button>
      </form>
    </>
  );
}
