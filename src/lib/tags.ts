// src/lib/tags.ts

export interface TagNode {
  name: string;
  slug: string;
  children?: TagNode[];
  hidden?: boolean;
  xrd?: {
    create?: number;
    edit?: number;
    comment?: number;
  };
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
      { name: 'Resources', slug: 'resources',},
      { name: 'Blog', slug: 'blog', xrd: { create: 50_000 } },
    ],
  },
  { name: 'Developers',
    slug: 'developers',
    children: [
          { name: 'Learn', slug: 'learn' },
          { name: 'Build', slug: 'build' },
          { name: 'Patterns', slug: 'patterns' },
          { name: 'Reference', slug: 'reference' },
        ],
  },
  { name: 'Ecosystem', slug: 'ecosystem', xrd: { create: 20_000 } },
  { name: 'Jobs', slug: 'jobs' },
  { name: 'Community', slug: 'community', children: [{ name: 'RFPs', slug: 'rfps' },]},
  { name: 'Meta', slug: 'meta' },
];

const AUTHOR_ONLY_PATHS = ['community', 'community/rfps', 'contents/blog'] as const;

// Single traversal that returns all needed context
export interface TagPathContext {
  node: TagNode | null;
  isValid: boolean;
  isAuthorOnly: boolean;
  xrdRequirements: NonNullable<TagNode['xrd']>;
}

export function resolveTagPath(pathSegments: string[], hierarchy: TagNode[] = TAG_HIERARCHY): TagPathContext {
  const requirements: NonNullable<TagNode['xrd']> = {};
  let current: TagNode[] = hierarchy;
  let node: TagNode | null = null;

  for (const segment of pathSegments) {
    node = current.find(n => n.slug === segment) ?? null;
    if (!node) return { node: null, isValid: false, isAuthorOnly: false, xrdRequirements: {} };
    if (node.xrd) Object.assign(requirements, node.xrd);
    current = node.children || [];
  }

  const tagPath = pathSegments.join('/');
  const isAuthorOnly = AUTHOR_ONLY_PATHS.some(p => tagPath === p || tagPath.startsWith(p + '/'));

  return { node, isValid: pathSegments.length > 0, isAuthorOnly, xrdRequirements: requirements };
}

// Convenience wrappers for common use cases
export function findTagByPath(pathSegments: string[]): TagNode | null {
  return resolveTagPath(pathSegments).node;
}

export function isValidTagPath(pathSegments: string[]): boolean {
  return resolveTagPath(pathSegments).isValid;
}

export function isAuthorOnlyPath(tagPath: string): boolean {
  return resolveTagPath(tagPath.split('/')).isAuthorOnly;
}

export function getXrdRequirements(pathSegments: string[]): NonNullable<TagNode['xrd']> {
  return resolveTagPath(pathSegments).xrdRequirements;
}

export function getVisibleTags(hierarchy: TagNode[] = TAG_HIERARCHY): TagNode[] {
  return hierarchy.filter(node => !node.hidden);
}