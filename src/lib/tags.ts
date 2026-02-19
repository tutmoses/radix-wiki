// src/lib/tags.ts - Optimized tag resolution with memoization

export interface MetadataKeyDefinition {
  key: string;
  label: string;
  type: 'text' | 'date' | 'url' | 'select';
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
    children: [
      {
        name: 'Tech',
        slug: 'tech',
        children: [
          { name: 'Comparisons', slug: 'comparisons' },
          { name: 'Core Concepts', slug: 'core-concepts' },
          { name: 'Core Protocols', slug: 'core-protocols' },
          { name: 'Releases', slug: 'releases' },
          { name: 'Research', slug: 'research' },
        ],
      },
      {
        name: 'History / Events',
        slug: 'history',
        sort: 'newest',
        metadataKeys: [
          { key: 'attendees', label: 'Attendees:', type: 'text'},
          { key: 'date', label: 'Date:', type: 'date' },
          { key: 'location', label: 'Location:', type: 'text' },
          { key: 'type', label: 'Type:', type: 'select', options: ['Conference', 'Hackathon', 'Milestone', 'Workshop'] },
          { key: 'website', label: 'Website:', type: 'url' }
        ]},
      { name: 'Resources', slug: 'resources', children: [{ name: 'Legal', slug: 'legal' }, { name: 'Python Scripts', slug: 'python-scripts' }] },
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
      { name: 'Quick Start', slug: 'quick-start', description: 'Get up and running with Radix development in minutes.' },
      { name: 'Learn', slug: 'learn', description: 'Core concepts and tutorials to get started with Radix development.' },
      { name: 'Build', slug: 'build', description: 'Step-by-step guides for setting up your environment, building dApps, and deploying to the Radix network.' },
      { name: 'Patterns', slug: 'patterns', description: 'Reusable design patterns for badge-gated auth, vaults, oracles, and more.' },
      { name: 'Reference', slug: 'reference', description: 'API references for Scrypto stdlib, SBOR serialization, transaction manifests, and the Gateway API.' },
      { name: 'Legacy Docs', slug: 'legacy-docs', children: [
        { name: 'Essentials', slug: 'essentials' },
        { name: 'Use', slug: 'use' },
        { name: 'Integrate', slug: 'integrate', children: [
          { name: 'Integrate with Radix', slug: 'integrate-with-radix', children: [
            { name: 'Exchange Integration Guide', slug: 'exchange-integration-guide' },
            { name: 'Updating from Olympia', slug: 'updating-from-olympia' },
          ]},
          { name: 'Network APIs', slug: 'network-apis' },
          { name: 'Radix Engine Toolkit', slug: 'radix-engine-toolkit', children: [
            { name: 'Usage Guide', slug: 'radix-engine-toolkit-usage-guide' },
          ]},
          { name: 'Rust Libraries', slug: 'rust-libraries' },
        ]},
        { name: 'Build', slug: 'build', children: [
          { name: 'Developer Quick Start', slug: 'developer-quick-start' },
          { name: 'Setting Up', slug: 'setting-up-for-scrypto-development' },
          { name: 'Learning Step-by-Step', slug: 'learning-step-by-step' },
          { name: 'dApp Development', slug: 'build-dapps', children: [
            { name: 'Application Stack', slug: 'dapp-application-stack', children: [
              { name: 'dApp SDKs', slug: 'dapp-sdks' },
            ]},
            { name: 'dApp Transactions', slug: 'dapp-transactions', children: [
              { name: 'Examples', slug: 'transaction-examples' },
            ]},
            { name: 'Before You Release', slug: 'before-you-release' },
          ]},
          { name: 'Scrypto', slug: 'scrypto-1', children: [
            { name: 'Authorization', slug: 'auth' },
            { name: 'Resources', slug: 'resources' },
            { name: 'Royalties', slug: 'royalties' },
            { name: 'Cryptography', slug: 'cryptography' },
            { name: 'Design Patterns', slug: 'scrypto-design-patterns' },
            { name: 'Testing', slug: 'testing' },
            { name: 'Tools', slug: 'tools-for-scrypto' },
          ]},
        ]},
        { name: 'Run', slug: 'run', children: [
          { name: 'Node', slug: 'node', children: [
            { name: 'Node Setup', slug: 'node-setup', children: [
              { name: 'Guided Setup', slug: 'node-setup-guided' },
              { name: 'Manual Setup', slug: 'manual-setup-advanced', children: [
                { name: 'Systemd', slug: 'node-setup-systemd' },
              ]},
            ]},
            { name: 'Maintenance', slug: 'node-maintenance-and-administration' },
            { name: 'Workbench', slug: 'workbench' },
          ]},
          { name: 'Network Gateway', slug: 'network-gateway', children: [
            { name: 'Setup', slug: 'network-gateway-setup', children: [
              { name: 'Custom Setup', slug: 'custom-setup' },
            ]},
            { name: 'Maintenance', slug: 'maintenance-1' },
          ]},
        ]},
        { name: 'Reference', slug: 'reference', children: [
          { name: 'Integrator Concepts', slug: 'babylon-technical-concepts' },
          { name: 'Radix Engine', slug: 'radix-engine', children: [
            { name: 'Native Blueprints', slug: 'native-blueprints' },
            { name: 'Costing and Limits', slug: 'costing-and-limits' },
            { name: 'Metadata', slug: 'metadata' },
          ]},
          { name: 'Transactions', slug: 'transactions', children: [
            { name: 'Manifest', slug: 'manifest' },
          ]},
          { name: 'SBOR Serialization', slug: 'sbor-serialization', children: [
            { name: 'Manifest SBOR', slug: 'manifest-sbor' },
            { name: 'Textual Representations', slug: 'sbor-textual-representations' },
            { name: 'Scrypto SBOR', slug: 'scrypto-sbor' },
          ]},
          { name: 'Standards', slug: 'standards', children: [
            { name: 'Metadata Standards', slug: 'metadata-standards' },
            { name: 'Non-fungible Standards', slug: 'non-fungible-standards' },
            { name: 'UI/UX Standards', slug: 'ui-ux-standards' },
          ]},
        ]},
        { name: 'Updates', slug: 'updates', children: [
          { name: 'Protocol Updates', slug: 'protocol-updates' },
          { name: 'Release Notes', slug: 'release-notes', children: [
            { name: 'Scrypto', slug: 'scrypto' },
          ]},
          { name: 'Roadmap', slug: 'roadmap', children: [
            { name: 'Wallets', slug: 'wallets' },
            { name: 'Scrypto', slug: 'scrypto' },
            { name: 'Node/Engine', slug: 'node-engine' },
            { name: 'Gateway', slug: 'gateway' },
            { name: 'Developer Tools', slug: 'developer-tools' },
          ]},
        ]},
      ]},
    ] },
  { name: '🌐 Ecosystem',
    slug: 'ecosystem',
    metadataKeys: [
      { key: 'status', label: 'Status:', type: 'select', options: ['🟢','🟠','🔴'], required: true },
      { key: 'category', label: 'Category:', type: 'select', options: ['Finance', 'Studio', 'Launchpad', 'DAO Platform', 'Media', 'Education', 'Infrastructure', 'Oracle', 'Healthcare', 'NFT Platform', 'LoFi', 'Gaming', 'Stablecoin', 'Token', 'Open Source', 'DeSci'], required: true },
      { key: 'founded', label: 'Founded:', type: 'date' },
      { key: 'website', label: 'Website:', type: 'url' },
      { key: 'socials', label: 'Socials:', type: 'text' },
      { key: 'team', label: 'Team:', type: 'text' },
      { key: 'assets', label: 'Assets:', type: 'text' },
      { key: 'open positions', label: 'Open Positions:', type: 'text' },
    ],
    xrd: { create: 20_000 } },
  { name: '👥 Community', slug: 'community', sort: 'recent' },
  { name: '✍️ Blog', slug: 'blog', sort: 'newest', metadataKeys: [{ key: 'date', label: 'Published:', type: 'date' }], xrd: { create: 50_000 } },
  { name: '🗣️ Forum', 
    slug: 'forum', 
    metadataKeys: [
      { key: 'category', label: 'Category:', type: 'select', options: ['🌐 General', '⚖️ Governance', '👾 Developers'], required: true }
    ],
    sort: 'recent',
    xrd: { create: 10_000, comment: 10_000 } },
  { name: '🧠 Meta', slug: 'meta' },
];

const AUTHOR_ONLY_PATHS = new Set(['community', 'blog', 'forum']);

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
const XRD_DEFAULTS = { create: 10_000, edit: 20_000, comment: 10_000 } as const;

export function getXrdRequired(action: 'create' | 'edit' | 'comment', tagPath: string): number {
  return resolveTagPath(tagPath.split('/')).xrdRequirements[action] ?? XRD_DEFAULTS[action];
}
export const getMetadataKeys = (pathSegments: string[]): MetadataKeyDefinition[] => resolveTagPath(pathSegments).metadataKeys;
export const getSortOrder = (pathSegments: string[]): SortOrder => resolveTagPath(pathSegments).sort;
export const getVisibleTags = (hierarchy: TagNode[] = TAG_HIERARCHY): TagNode[] => hierarchy.filter(n => !n.hidden);