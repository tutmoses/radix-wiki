// src/lib/radix/config.ts

// Radix network configuration
export const RADIX_CONFIG = {
  // DApp Definition Address (Stokenet)
  dAppDefinitionAddress: process.env.NEXT_PUBLIC_RADIX_DAPP_DEFINITION_ADDRESS || 
    'account_tdx_2_12yh3ufj24atcr2x3975m3jqce5327yrlr27g49mgqfrur8ncunpxmy',
  
  // Network ID (2 = Stokenet, 1 = Mainnet)
  networkId: parseInt(process.env.NEXT_PUBLIC_RADIX_NETWORK_ID || '2', 10),
  
  // Application metadata
  applicationName: process.env.NEXT_PUBLIC_RADIX_APPLICATION_NAME || 'RADIX Wiki',
  applicationVersion: process.env.NEXT_PUBLIC_RADIX_APPLICATION_VERSION || '1.0.0',
  
  // App URL for origin validation
  applicationUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
} as const;

// Network ID enum for clarity
export enum RadixNetworkId {
  Mainnet = 1,
  Stokenet = 2,
}

// Get network name from ID
export function getNetworkName(networkId: number): string {
  switch (networkId) {
    case RadixNetworkId.Mainnet:
      return 'Mainnet';
    case RadixNetworkId.Stokenet:
      return 'Stokenet';
    default:
      return 'Unknown';
  }
}

// Gateway URLs for different networks
export const GATEWAY_URLS: Record<number, string> = {
  [RadixNetworkId.Mainnet]: 'https://mainnet.radixdlt.com',
  [RadixNetworkId.Stokenet]: 'https://stokenet.radixdlt.com',
};

export function getGatewayUrl(networkId: number = RADIX_CONFIG.networkId): string {
  return GATEWAY_URLS[networkId] || GATEWAY_URLS[RadixNetworkId.Stokenet];
}