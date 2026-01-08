// src/lib/tags.ts

export interface TagNode {
  name: string;
  slug: string;
  children?: TagNode[];
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
      { name: 'Resources', slug: 'resources' },
      { name: 'Blog', slug: 'blog' },
    ],
  },
  { name: 'Ecosystem', slug: 'ecosystem' },
  { name: 'News', slug: 'news' },
  { name: 'Jobs', slug: 'jobs' },
  { name: 'Talent', slug: 'talent' },
];

export function getTagPath(node: TagNode, hierarchy: TagNode[] = TAG_HIERARCHY, path: string[] = []): string[] | null {
  for (const item of hierarchy) {
    if (item.slug === node.slug) {
      return [...path, item.slug];
    }
    if (item.children) {
      const result = getTagPath(node, item.children, [...path, item.slug]);
      if (result) return result;
    }
  }
  return null;
}

export function findTagBySlug(slug: string, hierarchy: TagNode[] = TAG_HIERARCHY): TagNode | null {
  for (const item of hierarchy) {
    if (item.slug === slug) return item;
    if (item.children) {
      const found = findTagBySlug(slug, item.children);
      if (found) return found;
    }
  }
  return null;
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

export function getFullPathForTag(slug: string, hierarchy: TagNode[] = TAG_HIERARCHY, currentPath: string[] = []): string[] | null {
  for (const node of hierarchy) {
    const newPath = [...currentPath, node.slug];
    if (node.slug === slug) return newPath;
    if (node.children) {
      const result = getFullPathForTag(slug, node.children, newPath);
      if (result) return result;
    }
  }
  return null;
}

export function getAllLeafTags(hierarchy: TagNode[] = TAG_HIERARCHY, parentPath: string[] = []): { tag: TagNode; path: string[] }[] {
  const leaves: { tag: TagNode; path: string[] }[] = [];
  
  for (const node of hierarchy) {
    const currentPath = [...parentPath, node.slug];
    if (!node.children || node.children.length === 0) {
      leaves.push({ tag: node, path: currentPath });
    } else {
      leaves.push(...getAllLeafTags(node.children, currentPath));
    }
  }
  
  return leaves;
}

export function getAllTags(hierarchy: TagNode[] = TAG_HIERARCHY, parentPath: string[] = []): { tag: TagNode; path: string[]; isLeaf: boolean }[] {
  const tags: { tag: TagNode; path: string[]; isLeaf: boolean }[] = [];
  
  for (const node of hierarchy) {
    const currentPath = [...parentPath, node.slug];
    const isLeaf = !node.children || node.children.length === 0;
    tags.push({ tag: node, path: currentPath, isLeaf });
    if (node.children) {
      tags.push(...getAllTags(node.children, currentPath));
    }
  }
  
  return tags;
}

export function isValidTagPath(pathSegments: string[]): boolean {
  if (pathSegments.length === 0) return false;
  return findTagByPath(pathSegments) !== null;
}

export function buildPageUrl(tagPath: string[], pageSlug: string): string {
  return `/${tagPath.join('/')}/${pageSlug}`;
}

export function parsePageUrl(urlPath: string): { tagPath: string[]; pageSlug: string } | null {
  const segments = urlPath.split('/').filter(Boolean);
  if (segments.length < 2) return null;
  
  const pageSlug = segments[segments.length - 1];
  const tagPath = segments.slice(0, -1);
  
  if (!isValidTagPath(tagPath)) return null;
  
  return { tagPath, pageSlug };
}