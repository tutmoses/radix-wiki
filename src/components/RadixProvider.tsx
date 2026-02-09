// src/components/RadixProvider.tsx

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useStore } from '@/hooks';
import { RADIX_CONFIG } from '@/lib/radix/config';
import type { RadixWalletData } from '@/types';

type RadixDappToolkitType = Awaited<ReturnType<typeof import('@radixdlt/radix-dapp-toolkit').RadixDappToolkit>>;

export function RadixProvider({ children }: { children: React.ReactNode }) {
  const rdtRef = useRef<RadixDappToolkitType | null>(null);
  const isAuthenticatingRef = useRef(false);
  const { setSession, setLoading, setConnected, setWalletData, setRdtReady, _setRdtCallbacks } = useStore();

  const createSessionFromWallet = useCallback(async (walletData: RadixWalletData) => {
    if (isAuthenticatingRef.current) return;
    isAuthenticatingRef.current = true;

    try {
      setLoading(true);
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accounts: walletData.accounts, persona: walletData.persona }),
      });

      if (response.ok) {
        const session = await response.json();
        setSession(session);
      }
    } catch (error) {
      console.error('Session creation error:', error);
    } finally {
      setLoading(false);
      isAuthenticatingRef.current = false;
    }
  }, [setSession, setLoading]);

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
        rdt.walletApi.setRequestData(DataRequestBuilder.accounts().atLeast(1));

        subscription = rdt.walletApi.walletData$.subscribe((walletData) => {
          if (walletData.accounts.length > 0) {
            const data: RadixWalletData = {
              persona: walletData.persona ? { identityAddress: walletData.persona.identityAddress, label: walletData.persona.label } : undefined,
              accounts: walletData.accounts.map((a) => ({ address: a.address, label: a.label, appearanceId: a.appearanceId })),
            };
            setWalletData(data);
            setConnected(true);
            createSessionFromWallet(data);
          } else {
            setWalletData(null);
            setConnected(false);
            setSession(null);
            setLoading(false);
          }
        });

        // Set callbacks + rdtReady AFTER subscription is wired — flushes any pending connect
        setRdtReady(true);
        _setRdtCallbacks(
          () => rdt.walletApi.sendRequest(),
          () => rdt.disconnect()
        );
      } catch (error) {
        console.error('Failed to initialize Radix DApp Toolkit:', error);
        setRdtReady(true); // Mark ready even on failure so button doesn't spin forever
      }

      try {
        const response = await fetch('/api/auth');
        if (response.ok) {
          const session = await response.json();
          if (session) setSession(session);
        }
      } catch (error) {
        console.error('Failed to check session:', error);
      } finally {
        setLoading(false);
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