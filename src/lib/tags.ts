// src/lib/tags.ts - Optimized tag resolution with memoization

export interface TagNode {
  name: string;
  slug: string;
  children?: TagNode[];
  hidden?: boolean;
  xrd?: { create?: number; edit?: number; comment?: number };
}

export const TAG_HIERARCHY: TagNode[] = [
  {
    name: 'Contents',
    slug: 'contents',
    children: [
      {
        name: 'Tech',
        slug: 'tech',
        children: [
          { name: 'Comparisons', slug: 'comparisons' },
          { name: 'Core Concepts', slug: 'core-concepts' },
          { name: 'Core Protocols', slug: 'core-protocols' },
        ],
      },
      { name: 'Events', slug: 'events' },
      { name: 'Resources', slug: 'resources', children: [{ name: 'Legal', slug: 'legal' }, { name: 'Python Scripts', slug: 'python-scripts' }] },
      { name: 'Blog', slug: 'blog', xrd: { create: 50_000 } },
    ],
  },
  { name: 'Developers', slug: 'developers', children: [{ name: 'Learn', slug: 'learn' }, { name: 'Build', slug: 'build' }, { name: 'Patterns', slug: 'patterns' }, { name: 'Reference', slug: 'reference' }] },
  { name: 'Ecosystem', slug: 'ecosystem', xrd: { create: 20_000 } },
  { name: 'Jobs', slug: 'jobs' },
  { name: 'Community', slug: 'community', children: [{ name: 'RFPs', slug: 'rfps' }] },
  { name: 'Meta', slug: 'meta' },
];

const AUTHOR_ONLY_PATHS = new Set(['community', 'community/rfps', 'contents/blog']);

export interface TagPathContext {
  node: TagNode | null;
  isValid: boolean;
  isAuthorOnly: boolean;
  xrdRequirements: NonNullable<TagNode['xrd']>;
}

// Memoization cache
const resolveCache = new Map<string, TagPathContext>();

export function resolveTagPath(pathSegments: string[], hierarchy: TagNode[] = TAG_HIERARCHY): TagPathContext {
  const key = pathSegments.join('/');
  const cached = resolveCache.get(key);
  if (cached) return cached;

  const requirements: NonNullable<TagNode['xrd']> = {};
  let current: TagNode[] = hierarchy;
  let node: TagNode | null = null;

  for (const segment of pathSegments) {
    node = current.find(n => n.slug === segment) ?? null;
    if (!node) {
      const result = { node: null, isValid: false, isAuthorOnly: false, xrdRequirements: {} };
      resolveCache.set(key, result);
      return result;
    }
    if (node.xrd) Object.assign(requirements, node.xrd);
    current = node.children || [];
  }

  const isAuthorOnly = AUTHOR_ONLY_PATHS.has(key) || [...AUTHOR_ONLY_PATHS].some(p => key.startsWith(p + '/'));
  const result = { node, isValid: pathSegments.length > 0, isAuthorOnly, xrdRequirements: requirements };
  resolveCache.set(key, result);
  return result;
}

// Convenience wrappers - all use cached resolution
export const findTagByPath = (pathSegments: string[]): TagNode | null => resolveTagPath(pathSegments).node;
export const isValidTagPath = (pathSegments: string[]): boolean => resolveTagPath(pathSegments).isValid;
export const isAuthorOnlyPath = (tagPath: string): boolean => resolveTagPath(tagPath.split('/')).isAuthorOnly;
export const getXrdRequirements = (pathSegments: string[]): NonNullable<TagNode['xrd']> => resolveTagPath(pathSegments).xrdRequirements;
export const getVisibleTags = (hierarchy: TagNode[] = TAG_HIERARCHY): TagNode[] => hierarchy.filter(n => !n.hidden);