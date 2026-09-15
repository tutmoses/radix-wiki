// src/lib/radix/config.ts

export const RADIX_CONFIG = {
  dAppDefinitionAddress: process.env.NEXT_PUBLIC_RADIX_DAPP_DEFINITION_ADDRESS ||
    'account_rdx12xzx7as5hv9ahw9na8g0s7gtzvdcuvzrtdr96qhzyxcmn5dlmpmp23',
  networkId: parseInt(process.env.NEXT_PUBLIC_RADIX_NETWORK_ID || '1', 10),
  applicationName: process.env.NEXT_PUBLIC_RADIX_APPLICATION_NAME || 'RADIX Wiki',
  applicationVersion: process.env.NEXT_PUBLIC_RADIX_APPLICATION_VERSION || '1.0.0',
  applicationUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
} as const;

// Mainnet is 1, Stokenet 2. Everything else the app reads off the network is one of
// these two constants, so they are resolved once here rather than looked up per call.
const STOKENET = RADIX_CONFIG.networkId === 2;

/** The Gateway serving the configured network. */
export const GATEWAY_URL = STOKENET ? 'https://stokenet.radixdlt.com' : 'https://mainnet.radixdlt.com';

/** The $XRD resource on the configured network. */
export const XRD_ADDRESS = STOKENET
  ? 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc'
  : 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd';

/** OciSwap's public API, behind token prices and the price charts. */
export const OCISWAP_API = 'https://api.ociswap.com';

/** The Radix Dashboard, where a transaction or a resource links out to. */
export const DASHBOARD_URL = 'https://dashboard.radixdlt.com';

const ENTITY_PAGES: Record<string, [kind: string, path: string]> = {
  account: ['Account', 'account'],
  validator: ['Validator', 'network-staking'],
  pool: ['Pool', 'component'],
  component: ['Component', 'component'],
};

/** What a ledger address is, read from its prefix, and its page on the Radix Dashboard. */
export function dashboardEntity(address: string): { kind: string; href: string } {
  const prefix = address.slice(0, address.indexOf('_'));
  const [kind, path] = ENTITY_PAGES[prefix] ?? [prefix, 'component'];
  return { kind, href: `${DASHBOARD_URL}/${path}/${address}` };
}
