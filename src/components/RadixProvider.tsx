// src/components/RadixProvider.tsx

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/hooks';
import { RADIX_CONFIG } from '@/lib/radix/config';
import { sendJson } from '@/lib/utils';
import type { RadixWalletData, SignedChallenge } from '@/types';

type RadixDappToolkitType = Awaited<ReturnType<typeof import('@radixdlt/radix-dapp-toolkit').RadixDappToolkit>>;

// The wallet's state arrives twice — once through dataRequestControl, once on
// walletData$ — and carries proofs and persona data the app never stores. This
// is the narrowing to the two fields it does, written once for both.
const toWalletData = ({ persona, accounts }: RadixWalletData): RadixWalletData => ({
  persona: persona ? { identityAddress: persona.identityAddress, label: persona.label } : undefined,
  accounts: accounts.map(a => ({ address: a.address, label: a.label, appearanceId: a.appearanceId })),
});

// What the reader is told when the wallet request ends without an answer. A
// rejection in the wallet is the reader's own choice, so it needs no message.
const connectFailure = ({ error, message }: { error: string; message?: string }): string | null =>
  error === 'rejectedByUser' || error === 'canceledByUser' ? null
  : error === 'ChallengeGeneratorError' ? 'Sign-in could not start: the wiki did not issue a sign-in challenge. Try again in a moment.'
  : `The Radix Wallet did not connect${message ? ` (${message})` : ''}. Try again.`;

export function RadixProvider({ children }: { children: React.ReactNode }) {
  const rdtRef = useRef<RadixDappToolkitType | null>(null);
  const setSession = useStore(s => s.setSession);
  const sessionChecked = useStore(s => s.sessionChecked);
  const setWalletData = useStore(s => s.setWalletData);
  const setWallet = useStore(s => s.setWallet);

  const createSession = useCallback(async (
    walletData: RadixWalletData,
    proof: SignedChallenge,
  ) => {
    const response = await sendJson('/api/auth', 'POST', {
      accounts: walletData.accounts,
      persona: walletData.persona,
      signedChallenge: proof,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Authentication failed');
    }

    // The reader stays on the page they connected from.
    setSession(await response.json());
  }, [setSession]);

  // Check existing session on mount (fast, no heavy imports). The route answers
  // null for no session; a refusal or a dropped request is a check that failed.
  useEffect(() => {
    fetch('/api/auth')
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(r.statusText))))
      .then(session => { if (session) setSession(session); return true; }, () => false)
      .then(sessionChecked);
  }, [setSession, sessionChecked]);

  // Load Radix DApp Toolkit
  useEffect(() => {
    if (typeof window === 'undefined' || rdtRef.current) return;

    let subscription: { unsubscribe: () => void } | null = null;

    (async () => {
      try {
        const { RadixDappToolkit, DataRequestBuilder } = await import('@radixdlt/radix-dapp-toolkit');

        if (rdtRef.current) return;

        const rdt = RadixDappToolkit({
          dAppDefinitionAddress: RADIX_CONFIG.dAppDefinitionAddress,
          networkId: RADIX_CONFIG.networkId,
          applicationName: RADIX_CONFIG.applicationName,
          applicationVersion: RADIX_CONFIG.applicationVersion,
        });

        rdtRef.current = rdt;

        rdt.walletApi.provideChallengeGenerator(async () => {
          const res = await fetch('/api/auth/challenge');
          if (!res.ok) throw new Error(`Challenge endpoint returned ${res.status}`);
          const { challenge } = await res.json();
          return challenge;
        });

        rdt.walletApi.setRequestData(
          DataRequestBuilder.accounts().atLeast(1).withProof(),
        );

        // dataRequestControl intercepts wallet responses BEFORE RDT processes them.
        // Auth happens here — fires on sendRequest() responses, NOT cached replays.
        // We never throw: if auth fails, RDT still proceeds, the request settles
        // and ends the connect attempt. isAuthenticated stays false (no session).
        rdt.walletApi.dataRequestControl(async (walletResponse) => {
          try {
            const account = walletResponse.accounts?.[0];
            const proof = walletResponse.proofs?.find(
              (p: { address: string }) => p.address === account?.address,
            );

            if (!account || !proof) return;

            await createSession(toWalletData(walletResponse), {
              challenge: proof.challenge,
              address: proof.address,
              proof: proof.proof,
            });
          } catch (error) {
            console.error('[ROLA] Auth failed:', error);
            useStore.getState().showToast('Sign-in failed — the wallet proof could not be verified. Please try connecting again.', 'info');
          }
        });

        // walletData$ only tracks connection state — auth is handled above
        subscription = rdt.walletApi.walletData$.subscribe((walletData) => {
          setWalletData(walletData.accounts.length > 0 ? toWalletData(walletData) : null);
        });

        setWallet({
          kind: 'ready',
          connect: async () => {
            const r = await rdt.walletApi.sendRequest();
            return r.isErr() ? connectFailure(r.error) : null;
          },
          disconnect: () => rdt.disconnect(),
          sendTransaction: async (manifest: string) => {
            const r = await rdt.walletApi.sendTransaction({ transactionManifest: manifest });
            if (r.isErr()) throw new Error(r.error.message ?? 'Transaction failed');
            return { transactionIntentHash: r.value.transactionIntentHash };
          },
        });
      } catch (error) {
        console.error('Failed to initialize Radix DApp Toolkit:', error);
        setWallet({ kind: 'unavailable' });
      }
    })();

    return () => {
      subscription?.unsubscribe();
      setWallet({ kind: 'loading' });
    };
  }, [setWalletData, createSession, setWallet]);

  return <>{children}</>;
}
