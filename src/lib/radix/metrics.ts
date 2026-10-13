// src/lib/radix/metrics.ts – the daily activity metrics by name, for every surface that offers
// them: the /charts pills, the network-chart block and its editor, the markdown twin. Kept
// apart from activity.ts, which imports Prisma, so client code can read the list.

export const ACTIVITY_METRICS = [
  { key: 'transactions', label: 'Transactions' },
  { key: 'activeAccounts', label: 'Active accounts' },
  { key: 'newAccounts', label: 'New accounts' },
  { key: 'newComponents', label: 'Components created' },
  { key: 'newResources', label: 'Resources created' },
  { key: 'nftsMinted', label: 'NFTs minted' },
  { key: 'feesXrd', label: 'Fees ($XRD)' },
  { key: 'burnedXrd', label: '$XRD burned' },
  { key: 'royaltiesXrd', label: 'Royalties ($XRD)' },
] as const;

export type ActivityMetric = (typeof ACTIVITY_METRICS)[number]['key'];

export const isActivityMetric = (key: unknown): key is ActivityMetric => ACTIVITY_METRICS.some(m => m.key === key);

export const activityLabel = (key: ActivityMetric) => ACTIVITY_METRICS.find(m => m.key === key)!.label;
