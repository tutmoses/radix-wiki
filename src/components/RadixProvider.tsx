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
  const isAuthenticatingRef = useRef(false);
  const sessionCheckRef = useRef<Promise<boolean>>(Promise.resolve(false));
  const setSession = useStore(s => s.setSession);
  const setLoading = useStore(s => s.setLoading);
  const setConnected = useStore(s => s.setConnected);
  const setWalletData = useStore(s => s.setWalletData);
  const setRdtReady = useStore(s => s.setRdtReady);
  const _setRdtCallbacks = useStore(s => s._setRdtCallbacks);

  const createSessionFromWallet = useCallback(async (
    walletData: RadixWalletData,
    signedChallenge?: SignedChallenge,
  ) => {
    if (isAuthenticatingRef.current) return;
    isAuthenticatingRef.current = true;

    try {
      setLoading(true);
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accounts: walletData.accounts,
          persona: walletData.persona,
          signedChallenge,
        }),
      });

      if (response.ok) {
        const session = await response.json();
        setSession(session);
        if (session.isNewUser) router.push('/welcome');
      }
    } catch (error) {
      console.error('Session creation error:', error);
    } finally {
      setLoading(false);
      isAuthenticatingRef.current = false;
    }
  }, [setSession, setLoading, router]);

  // Check existing session immediately (fast, no heavy imports).
  // Stores a promise so the wallet subscription can await it before posting stale proofs.
  useEffect(() => {
    sessionCheckRef.current = fetch('/api/auth')
      .then(r => r.ok ? r.json() : null)
      .then(session => { if (session) { setSession(session); return true; } return false; })
      .catch(() => false)
      .finally(() => setLoading(false));
  }, [setSession, setLoading]);

  // Load Radix DApp Toolkit in parallel (heavy, deferred)
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

        // Provide ROLA challenge generator — fetches a one-time challenge from the server
        rdt.walletApi.provideChallengeGenerator(async () => {
          const res = await fetch('/api/auth/challenge');
          const { challenge } = await res.json();
          return challenge;
        });

        rdt.walletApi.setRequestData(
          DataRequestBuilder.accounts().atLeast(1).withProof(),
        );

        // Track first emission — it's always a cached replay from localStorage.
        // Only attempt auth on subsequent emissions (fresh user connects).
        let isFirstEmission = true;

        subscription = rdt.walletApi.walletData$.subscribe((walletData) => {
          const isCachedReplay = isFirstEmission;
          isFirstEmission = false;

          if (walletData.accounts.length > 0) {
            const data: RadixWalletData = {
              persona: walletData.persona ? { identityAddress: walletData.persona.identityAddress, label: walletData.persona.label } : undefined,
              accounts: walletData.accounts.map((a) => ({ address: a.address, label: a.label, appearanceId: a.appearanceId })),
            };
            setWalletData(data);
            setConnected(true);

            // Extract ROLA proof from the first account's proof of ownership
            const proof = walletData.proofs?.find(
              (p: { address: string }) => p.address === walletData.accounts[0]?.address,
            );

            if (proof && !isCachedReplay) {
              // Fresh wallet connection — create session if none exists
              sessionCheckRef.current.then(hasSession => {
                if (!hasSession) {
                  createSessionFromWallet(data, {
                    challenge: proof.challenge,
                    address: proof.address,
                    proof: proof.proof,
                  });
                }
              });
            } else if (isCachedReplay) {
              // Cached replay — can't use stale proof. If session is also gone,
              // silently re-trigger a fresh wallet request to get a new proof.
              sessionCheckRef.current.then(hasSession => {
                if (!hasSession) {
                  rdt.walletApi.sendRequest();
                }
              });
            }
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
  }, [setWalletData, setConnected, setSession, setLoading, setRdtReady, createSessionFromWallet, _setRdtCallbacks]);

  return <>{children}</>;
}

export default RadixProvider;
