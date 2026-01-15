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
      { name: 'Blog', slug: 'blog', xrd: { create: 50_000 } },
    ],
  },
  { name: 'Ecosystem', slug: 'ecosystem', xrd: { create: 20_000 } },
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
  return node.children ? findTagByPath(rest, node.children) : null;
}

export function isValidTagPath(pathSegments: string[]): boolean {
  return pathSegments.length > 0 && findTagByPath(pathSegments) !== null;
}

const AUTHOR_ONLY_PATHS = ['community', 'community/rfps', 'contents/blog'] as const;

export function isAuthorOnlyPath(tagPath: string): boolean {
  return AUTHOR_ONLY_PATHS.some(p => tagPath === p || tagPath.startsWith(p + '/'));
}

export function getXrdRequirements(pathSegments: string[]): NonNullable<TagNode['xrd']> {
  const requirements: NonNullable<TagNode['xrd']> = {};
  let current: TagNode[] = TAG_HIERARCHY;

  for (const segment of pathSegments) {
    const node = current.find(n => n.slug === segment);
    if (!node) break;
    if (node.xrd) Object.assign(requirements, node.xrd);
    current = node.children || [];
  }

  return requirements;
}