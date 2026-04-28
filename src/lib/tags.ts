// src/lib/tags.ts - Optimized tag resolution with memoization

export interface MetadataKeyDefinition {
  key: string;
  label: string;
  type: 'text' | 'date' | 'url' | 'select' | 'user' | 'resource_address';
  required?: boolean;
  options?: string[]; // For select type
}

export type SortOrder = 'title' | 'newest' | 'oldest' | 'recent';

export interface TagNode {
  name: string;
  slug: string;
  description?: string;
  children?: TagNode[];
  hidden?: boolean;
  sort?: SortOrder;
  xrd?: { create?: number; edit?: number; comment?: number };
  metadataKeys?: MetadataKeyDefinition[];
}

export const TAG_HIERARCHY: TagNode[] = [
  { name: 'Homepage', slug: '', hidden: true, xrd: { edit: 100_000 } },
  {
    name: '📚 Contents',
    slug: 'contents',
    description: 'The encyclopedic core of RADIX Wiki — protocol fundamentals, ecosystem history, research, releases, and reference material on the Radix DLT.',
    children: [
      {
        name: 'Tech',
        slug: 'tech',
        description: 'Deep technical coverage of the Radix protocol — Cerberus consensus, Radix Engine, Scrypto, scalability research, and core architecture.',
        children: [
          { name: 'Comparisons', slug: 'comparisons', description: 'Side-by-side comparisons of Radix against Ethereum, Solana, and other ledgers — feature, performance, and architecture differences.' },
          { name: 'Core Concepts', slug: 'core-concepts', description: 'Foundational ideas behind Radix — assets as primitives, atomic composability, finality, sharding, and DeFi-native design.' },
          { name: 'Core Protocols', slug: 'core-protocols', description: 'The protocols that power Radix — Cerberus consensus, Radix Engine state machine, transaction manifests, and the ledger model.' },
          { name: 'DeSci', slug: 'desci', description: 'Decentralized science on Radix — IP-NFTs, research DAOs, and how asset-oriented programming enables verifiable scientific funding.' },
          { name: 'Releases', slug: 'releases', description: 'Major Radix protocol upgrades and Babylon-era release notes — what shipped, when, and what each release unlocks.' },
          { name: 'Research', slug: 'research', description: 'Active research efforts driving the Radix roadmap — Xi’an, Hyperscale, MFA Security Shield, RAC, and academic papers behind them.' },
          { name: 'Operations', slug: 'operations', hidden: true },
        ],
      },
      {
        name: 'History / Events',
        slug: 'history',
        sort: 'newest',
        description: 'A chronological record of Radix milestones — conferences, hackathons, mainnet upgrades, and pivotal community moments.',
        metadataKeys: [
          { key: 'attendees', label: 'Attendees:', type: 'text'},
          { key: 'date', label: 'Date:', type: 'date' },
          { key: 'location', label: 'Location:', type: 'text' },
          { key: 'type', label: 'Type:', type: 'select', options: ['Conference', 'Hackathon', 'Milestone', 'Workshop'] },
          { key: 'website', label: 'Website:', type: 'url' }
        ]},
      { name: 'Resources', slug: 'resources', description: 'Practical resources for Radix users and builders — legal templates, Python scripts, and external tooling references.', children: [
        { name: 'Legal', slug: 'legal', description: 'Legal templates, terms, and compliance references relevant to building and operating on Radix.' },
        { name: 'Python Scripts', slug: 'python-scripts', description: 'Reusable Python utilities for interacting with the Radix Gateway, Babylon transactions, and on-chain data.' },
      ] },
    ],
  },
  { name: '👾 Developers',
    slug: 'developers',
    metadataKeys: [
      { key: 'difficulty', label: 'Difficulty:', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced'] },
      { key: 'language', label: 'Language:', type: 'text' },
      { key: 'prerequisites', label: 'Prerequisites:', type: 'text' },
      { key: 'estimatedTime', label: 'Est. Time:', type: 'text' },
      { key: 'lastVerified', label: 'Last Verified:', type: 'date' },
    ],
    description: 'Build on Radix — tutorials, guides, design patterns, and API references for Scrypto, transaction manifests, and the Radix stack.',
    children: [
      { name: 'Getting Started', slug: 'getting-started', description: 'Install Scrypto, write your first blueprint, and deploy to the network.' },
      { name: 'Scrypto', slug: 'scrypto', description: 'Asset-oriented programming: resources, auth, testing, and design patterns.' },
      { name: 'Transactions', slug: 'transactions', description: 'Transaction manifests, lifecycle, and submission.' },
      { name: 'Frontend', slug: 'frontend', description: 'Connect wallets, read ledger state, and authenticate users.' },
      { name: 'Infrastructure', slug: 'infrastructure', description: 'Run a node, use the APIs, and integrate with Radix.' },
    ] },
  { name: '🌐 Ecosystem',
    slug: 'ecosystem',
    sort: 'recent',
    description: 'Projects building on Radix — DeFi protocols, NFT platforms, infrastructure, DAOs, and tooling, with status, team, and asset metadata.',
    metadataKeys: [
      { key: 'assets', label: 'Asset:', type: 'resource_address' },
      { key: 'status', label: 'Status:', type: 'select', options: ['🟢 Active','🟡 Testnet','🟠 Dormant','🔴 Closed'], required: true },
      { key: 'category', label: 'Category:', type: 'select', options: ['DAO Platform', 'DeSci', 'Education', 'Finance', 'Gaming', 'Healthcare', 'Infrastructure', 'Launchpad', 'LoFi', 'Media', 'NFT Platform', 'Oracle', 'Stablecoin', 'Studio', 'Token'], required: true },
      { key: 'founded', label: 'Founded:', type: 'date' },
      { key: 'website', label: 'Website:', type: 'url' },
      { key: 'x', label: 'X:', type: 'url' },
      { key: 'telegram', label: 'Telegram:', type: 'url' },
      { key: 'github', label: 'GitHub:', type: 'url' },
      { key: 'team', label: 'Team:', type: 'text' },
      { key: 'open positions', label: 'Open Positions:', type: 'text' },
    ],
    xrd: { create: 20_000 } },
  { name: '👥 Community', slug: 'community', sort: 'recent',
    description: 'Community member profiles, working groups, and contributor pages — the people, builders, and collectives shaping the Radix ecosystem.',
    metadataKeys: [
      { key: 'X', label: 'X:', type: 'url' },
    ],
  },
  { name: '✍️ Blog', slug: 'blog', sort: 'newest',
    description: 'Long-form essays and analysis from the RADIX Wiki community — protocol commentary, ecosystem deep-dives, and editorial pieces.',
    metadataKeys: [{ key: 'date', label: 'Published:', type: 'date' }], xrd: { create: 50_000 } },
  {
    name: '💡 Ideas Pipeline',
    slug: 'ideas',
    sort: 'recent' as SortOrder,
    description: 'A community-curated pipeline of proposals, feature requests, and research ideas for Radix — tracked from discussion through delivery.',
    metadataKeys: [
      { key: 'status', label: 'Status:', type: 'select', options: ['🔴 Discussion', '🟠 Proposed', '🟡 Approved', '🔵 In Progress', '🟣 Testing', '🟢 Done'], required: true },
      { key: 'priority', label: 'Priority:', type: 'select', options: ['㆔ High', '㆓ Medium', '⼀ Low'] },
      { key: 'category', label: 'Category:', type: 'select', options: ['⚙️ Protocol', '🌐 Ecosystem', '🛠️ Tooling', '🫂 Community', '⚖️ Governance'] },
      { key: 'assignee', label: 'Assignee:', type: 'user' },
    ],
    xrd: { create: 10_000, comment: 10_000 },
  },
];

const AUTHOR_ONLY_PATHS = new Set(['blog']);
const LOCKED_PAGES = new Set(['ecosystem/radix-namespace','ecosystem/xrd-domains']);
export const isLockedPage = (tagPath: string, slug: string): boolean => LOCKED_PAGES.has(`${tagPath}/${slug}`);

interface TagPathContext {
  node: TagNode | null;
  isValid: boolean;
  isAuthorOnly: boolean;
  sort: SortOrder;
  xrdRequirements: NonNullable<TagNode['xrd']>;
  metadataKeys: MetadataKeyDefinition[];
}

// Memoization cache
const resolveCache = new Map<string, TagPathContext>();

function resolveTagPath(pathSegments: string[], hierarchy: TagNode[] = TAG_HIERARCHY): TagPathContext {
  const key = pathSegments.join('/');
  const cached = resolveCache.get(key);
  if (cached) return cached;

  const requirements: NonNullable<TagNode['xrd']> = {};
  const metadataKeys: MetadataKeyDefinition[] = [];
  let current: TagNode[] = hierarchy;
  let node: TagNode | null = null;
  let sort: SortOrder = 'title';

  for (const segment of pathSegments) {
    node = current.find(n => n.slug === segment) ?? null;
    if (!node) {
      const result: TagPathContext = { node: null, isValid: false, isAuthorOnly: false, sort: 'title', xrdRequirements: {}, metadataKeys: [] };
      resolveCache.set(key, result);
      return result;
    }
    if (node.xrd) Object.assign(requirements, node.xrd);
    if (node.metadataKeys) metadataKeys.push(...node.metadataKeys);
    if (node.sort) sort = node.sort;
    current = node.children || [];
  }

  const isAuthorOnly = AUTHOR_ONLY_PATHS.has(key) || [...AUTHOR_ONLY_PATHS].some(p => key.startsWith(p + '/'));
  const result: TagPathContext = { node, isValid: pathSegments.length > 0, isAuthorOnly, sort, xrdRequirements: requirements, metadataKeys };
  resolveCache.set(key, result);
  return result;
}

// Convenience wrappers - all use cached resolution
export const findTagByPath = (pathSegments: string[]): TagNode | null => resolveTagPath(pathSegments).node;
export const isValidTagPath = (pathSegments: string[]): boolean => resolveTagPath(pathSegments).isValid;
export const isAuthorOnlyPath = (tagPath: string): boolean => resolveTagPath(tagPath.split('/')).isAuthorOnly;
export const canEditAuthorOnlyPage = (page: { authorId: string; editorIds?: string[] }, userId: string): boolean =>
  page.authorId === userId || (page.editorIds ?? []).includes(userId);
const XRD_DEFAULTS = { create: 10_000, edit: 20_000, comment: 10_000 } as const;

export function getXrdRequired(action: 'create' | 'edit' | 'comment', tagPath: string): number {
  return resolveTagPath(tagPath.split('/')).xrdRequirements[action] ?? XRD_DEFAULTS[action];
}
export const getMetadataKeys = (pathSegments: string[]): MetadataKeyDefinition[] => resolveTagPath(pathSegments).metadataKeys;
export const getSortOrder = (pathSegments: string[]): SortOrder => resolveTagPath(pathSegments).sort;
export const getVisibleTags = (hierarchy: TagNode[] = TAG_HIERARCHY): TagNode[] => hierarchy.filter(n => !n.hidden);