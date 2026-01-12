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

// Default XRD requirements (used when no tag-specific value exists)
export const XRD_DEFAULTS = {
  homepage: { edit: 20_000 },
  create: 5_000,
  edit: 20_000,
  comment: 10_000,
} as const;

export const TAG_HIERARCHY: TagNode[] = [
  {
    name: 'System',
    slug: 'system',
    hidden: true,
  },
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
      { name: 'Resources', slug: 'resources' },
      { name: 'Blog', slug: 'blog', xrd: { create: 50_000 },
      },
    ],
  },
  { name: 'Ecosystem', slug: 'ecosystem', xrd: { create: 20_000 },},
  { name: 'News', slug: 'news' },
  { name: 'Jobs', slug: 'jobs' },
  { name: 'Community', slug: 'community', children: [
    { name: 'RFPs', slug: 'rfps' },
  ]},
];

export function getVisibleTags(hierarchy: TagNode[] = TAG_HIERARCHY): TagNode[] {
  return hierarchy.filter(node => !node.hidden);
}

export function findTagByPath(pathSegments: string[], hierarchy: TagNode[] = TAG_HIERARCHY): TagNode | null {
  if (pathSegments.length === 0) return null;

  const [current, ...rest] = pathSegments;
  const node = hierarchy.find(n => n.slug === current);

  if (!node) return null;
  if (rest.length === 0) return node;
  if (!node.children) return null;

  return findTagByPath(rest, node.children);
}

export function isValidTagPath(pathSegments: string[]): boolean {
  if (pathSegments.length === 0) return false;
  return findTagByPath(pathSegments) !== null;
}

// Paths where only the original author can edit their own pages
const AUTHOR_ONLY_PATHS = ['community', 'community/rfps', 'contents/blog'] as const;

export function isAuthorOnlyPath(tagPath: string): boolean {
  return AUTHOR_ONLY_PATHS.some(p => tagPath === p || tagPath.startsWith(p + '/'));
}

// Walk up the tag tree collecting XRD requirements (child values override parent)
export function getXrdRequirements(pathSegments: string[]): NonNullable<TagNode['xrd']> {
  const requirements: NonNullable<TagNode['xrd']> = {};
  let current: TagNode[] = TAG_HIERARCHY;

  for (const segment of pathSegments) {
    const node = current.find(n => n.slug === segment);
    if (!node) break;

    // Merge requirements (child overrides parent)
    if (node.xrd) {
      if (node.xrd.create !== undefined) requirements.create = node.xrd.create;
      if (node.xrd.edit !== undefined) requirements.edit = node.xrd.edit;
      if (node.xrd.comment !== undefined) requirements.comment = node.xrd.comment;
    }

    current = node.children || [];
  }

  return requirements;
}