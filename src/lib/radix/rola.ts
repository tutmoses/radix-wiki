// src/lib/radix/rola.ts

import type { SignedChallenge } from '@/types';
import { RADIX_CONFIG, getGatewayUrl } from './config';
import { prisma } from '@/lib/prisma/client';

export async function generateChallenge(): Promise<{ challenge: string; expiresAt: Date }> {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const challenge = Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const expirationSeconds = parseInt(process.env.CHALLENGE_EXPIRATION || '300', 10);
  const expiresAt = new Date(Date.now() + expirationSeconds * 1000);

  await prisma.challenge.create({ data: { challenge, expiresAt } });
  return { challenge, expiresAt };
}

export async function validateChallenge(challenge: string): Promise<boolean> {
  const stored = await prisma.challenge.findUnique({ where: { challenge } });

  if (!stored || stored.expiresAt < new Date()) {
    if (stored) await prisma.challenge.delete({ where: { id: stored.id } });
    return false;
  }

  await prisma.challenge.delete({ where: { id: stored.id } });
  return true;
}

export async function verifySignedChallenge(
  signedChallenge: SignedChallenge,
  expectedOrigin: string
): Promise<{ isValid: boolean; error?: string }> {
  try {
    const challengeValid = await validateChallenge(signedChallenge.challenge);
    if (!challengeValid) {
      return { isValid: false, error: 'Invalid or expired challenge' };
    }

    const gatewayUrl = getGatewayUrl(RADIX_CONFIG.networkId);

    const entityResponse = await fetch(`${gatewayUrl}/state/entity/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addresses: [signedChallenge.address],
        aggregation_level: 'Vault',
        opt_ins: {
          ancestor_identities: false,
          component_royalty_config: false,
          component_royalty_vault_balance: false,
          package_royalty_vault_balance: false,
          non_fungible_include_nfids: false,
          explicit_metadata: ['owner_keys'],
        },
      }),
    });

    if (!entityResponse.ok) {
      return { isValid: false, error: 'Failed to verify with Radix Gateway' };
    }

    const entityData = await entityResponse.json();
    const items = entityData.items || [];
    if (items.length === 0) {
      return { isValid: false, error: 'Entity not found on network' };
    }

    const metadata = items[0].metadata?.items || [];
    const ownerKeysEntry = metadata.find((m: { key: string }) => m.key === 'owner_keys');

    if (!ownerKeysEntry) {
      return { isValid: false, error: 'No owner_keys metadata found' };
    }

    const ownerKeys = ownerKeysEntry.value?.typed?.values || [];
    const providedKeyHash = await hashPublicKey(signedChallenge.proof.publicKey);

    const keyMatches = ownerKeys.some((key: { value: string }) =>
      key.value === providedKeyHash || key.value === signedChallenge.proof.publicKey
    );

    if (!keyMatches) {
      return { isValid: false, error: 'Public key does not match owner keys' };
    }

    const messageToVerify = `ROLA${signedChallenge.challenge}${RADIX_CONFIG.dAppDefinitionAddress}${expectedOrigin}`;

    const signatureValid = await verifySignature(
      messageToVerify,
      signedChallenge.proof.signature,
      signedChallenge.proof.publicKey,
      signedChallenge.proof.curve
    );

    if (!signatureValid) {
      return { isValid: false, error: 'Invalid signature' };
    }

    return { isValid: true };
  } catch (error) {
    console.error('ROLA verification error:', error);
    return { isValid: false, error: 'Verification failed' };
  }
}

async function hashPublicKey(publicKey: string): Promise<string> {
  const keyBytes = hexToBytes(publicKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyBytes.buffer as ArrayBuffer);
  return bytesToHex(new Uint8Array(hashBuffer).slice(-29));
}

async function verifySignature(
  message: string,
  signature: string,
  publicKey: string,
  curve: 'curve25519' | 'secp256k1'
): Promise<boolean> {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = hexToBytes(signature);
    const publicKeyBytes = hexToBytes(publicKey);

    if (curve === 'curve25519') {
      const key = await crypto.subtle.importKey(
        'raw',
        publicKeyBytes.buffer as ArrayBuffer,
        { name: 'Ed25519' },
        false,
        ['verify']
      );
      return crypto.subtle.verify('Ed25519', key, signatureBytes.buffer as ArrayBuffer, messageBytes);
    } else {
      const key = await crypto.subtle.importKey(
        'raw',
        publicKeyBytes.buffer as ArrayBuffer,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      );
      return crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        key,
        signatureBytes.buffer as ArrayBuffer,
        messageBytes
      );
    }
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  const bytes = new Uint8Array(cleanHex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function cleanupExpiredChallenges(): Promise<number> {
  const result = await prisma.challenge.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}