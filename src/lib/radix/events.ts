// src/lib/radix/events.ts – what happened on the network, for the /charts markers.
//
// Each date is the one its wiki page states, and each marker links there, so a spike on a
// chart carries both its reason and the way into the article. A date known only to the
// month (the validator subsidy's end in June 2026) is left off: a marker on the first of
// the month would assert a day nobody recorded.

export interface NetworkEvent {
  /** UTC day, YYYY-MM-DD. */
  date: string;
  /** One word, to sit above a point: three events in September 2026 fall in adjacent weeks. */
  label: string;
  /** The event in full, for the linked list under the chart. */
  title: string;
  href: string;
}

export const NETWORK_EVENTS: NetworkEvent[] = [
  { date: '2023-09-28', label: 'Babylon', title: 'Babylon mainnet', href: '/contents/tech/releases/radix-mainnet-babylon' },
  { date: '2024-02-07', label: 'Anemone', title: 'Anemone update', href: '/contents/tech/releases/protocol-updates' },
  { date: '2024-06-07', label: 'Bottlenose', title: 'Bottlenose update', href: '/contents/tech/releases/protocol-updates' },
  { date: '2026-02-03', label: 'Rewards', title: 'Radix Rewards paid out', href: '/contents/history/radix-rewards' },
  { date: '2026-08-31', label: 'Halt', title: 'Hyperlane drain and network halt', href: '/contents/history/hyperlane-asset-drain-2026' },
  { date: '2026-09-11', label: 'Restart', title: 'Restart on Eagle Ray', href: '/contents/history/hyperlane-asset-drain-2026' },
  { date: '2026-09-29', label: 'Petition', title: 'HMRC petition against RDX Works', href: '/ecosystem/rdx-works' },
];

/** The events as chart markers: Unix seconds at the start of the UTC day. */
export const NETWORK_MARKERS = NETWORK_EVENTS.map(e => ({ time: Date.parse(`${e.date}T00:00:00Z`) / 1000, label: e.label }));
