// src/components/RadixProvider.tsx

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/hooks';
import { RADIX_CONFIG } from '@/lib/radix/config';
import type { RadixWalletData, SignedChallenge } from '@/types';

type RadixDappToolkitType = Awaited<ReturnType<typeof import('@radixdlt/radix-dapp-toolkit').RadixDappToolkit>>;

export function RadixProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const rdtRef = useRef<RadixDappToolkitType | null>(null);
  const setSession = useStore(s => s.setSession);
  const setLoading = useStore(s => s.setLoading);
  const setConnected = useStore(s => s.setConnected);
  const setWalletData = useStore(s => s.setWalletData);
  const setRdtReady = useStore(s => s.setRdtReady);
  const _setRdtCallbacks = useStore(s => s._setRdtCallbacks);

  // Stable ref for router to avoid re-creating the dataRequestControl callback
  const routerRef = useRef(router);
  routerRef.current = router;

  const createSession = useCallback(async (
    walletData: RadixWalletData,
    proof: SignedChallenge,
  ) => {
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accounts: walletData.accounts,
        persona: walletData.persona,
        signedChallenge: proof,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error || 'Authentication failed');
    }

    const session = await response.json();
    setSession(session);
    if (session.isNewUser) routerRef.current.push('/welcome');
  }, [setSession]);

  // Check existing session on mount (fast, no heavy imports)
  useEffect(() => {
    fetch('/api/auth')
      .then(r => r.ok ? r.json() : null)
      .then(session => { if (session) setSession(session); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [setSession, setLoading]);

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
        // We never throw: if auth fails, RDT still proceeds so walletData$ emits
        // and clears isConnecting. isAuthenticated stays false (no session).
        rdt.walletApi.dataRequestControl(async (walletResponse) => {
          try {
            const account = walletResponse.accounts?.[0];
            const proof = walletResponse.proofs?.find(
              (p: { address: string }) => p.address === account?.address,
            );

            if (!account || !proof) return;

            const data: RadixWalletData = {
              persona: walletResponse.persona ? {
                identityAddress: walletResponse.persona.identityAddress,
                label: walletResponse.persona.label,
              } : undefined,
              accounts: walletResponse.accounts.map((a) => ({
                address: a.address, label: a.label, appearanceId: a.appearanceId,
              })),
            };

            await createSession(data, {
              challenge: proof.challenge,
              address: proof.address,
              proof: proof.proof,
            });
          } catch (error) {
            console.error('[ROLA] Auth failed:', error);
          }
        });

        // walletData$ only tracks connection state — auth is handled above
        subscription = rdt.walletApi.walletData$.subscribe((walletData) => {
          if (walletData.accounts.length > 0) {
            setWalletData({
              persona: walletData.persona ? { identityAddress: walletData.persona.identityAddress, label: walletData.persona.label } : undefined,
              accounts: walletData.accounts.map((a) => ({ address: a.address, label: a.label, appearanceId: a.appearanceId })),
            });
            setConnected(true);
          } else {
            setWalletData(null);
            setConnected(false);
          }
        });

        setRdtReady(true);
        _setRdtCallbacks(
          () => rdt.walletApi.sendRequest(),
          () => rdt.disconnect()
        );
      } catch (error) {
        console.error('Failed to initialize Radix DApp Toolkit:', error);
        setRdtReady(true);
      }
    })();

    return () => {
      subscription?.unsubscribe();
      _setRdtCallbacks(null, null);
    };
  }, [setWalletData, setConnected, setSession, setLoading, setRdtReady, createSession, _setRdtCallbacks]);

  return <>{children}</>;
}

export default RadixProvider;
