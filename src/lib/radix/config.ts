// src/lib/radix/config.ts

export const RADIX_CONFIG = {
  dAppDefinitionAddress: process.env.NEXT_PUBLIC_RADIX_DAPP_DEFINITION_ADDRESS ||
    'account_rdx12xzx7as5hv9ahw9na8g0s7gtzvdcuvzrtdr96qhzyxcmn5dlmpmp23',
  networkId: parseInt(process.env.NEXT_PUBLIC_RADIX_NETWORK_ID || '1', 10),
  applicationName: process.env.NEXT_PUBLIC_RADIX_APPLICATION_NAME || 'RADIX Wiki',
  applicationVersion: process.env.NEXT_PUBLIC_RADIX_APPLICATION_VERSION || '1.0.0',
  applicationUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
} as const;

export enum RadixNetworkId {
  Mainnet = 1,
  Stokenet = 2,
}

const GATEWAY_URLS: Record<number, string> = {
  [RadixNetworkId.Mainnet]: 'https://mainnet.radixdlt.com',
  [RadixNetworkId.Stokenet]: 'https://stokenet.radixdlt.com',
};

export function getGatewayUrl(networkId = RADIX_CONFIG.networkId): string {
  return GATEWAY_URLS[networkId] || GATEWAY_URLS[RadixNetworkId.Mainnet];
}