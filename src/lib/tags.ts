// src/lib/tags.ts

export interface TagNode {
  name: string;
  slug: string;
  children?: TagNode[];
  hidden?: boolean;
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
      { name: 'Blog', slug: 'blog' },
    ],
  },
  { name: 'Ecosystem', slug: 'ecosystem' },
  { name: 'News', slug: 'news' },
  { name: 'Jobs', slug: 'jobs' },
  { name: 'Community', slug: 'community' },
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