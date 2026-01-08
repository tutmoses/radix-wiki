// src/components/editor/ContentRenderer.tsx

'use client';

import { generateHTML } from '@tiptap/html';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import type { JSONContent } from '@tiptap/react';
import { useMemo } from 'react';

const extensions = [
  StarterKit,
  Link,
  Image,
  Highlight.configure({ multicolor: true }),
  TaskList,
  TaskItem.configure({ nested: true }),
  Table,
  TableRow,
  TableCell,
  TableHeader,
];

interface ContentRendererProps {
  content: unknown;
  className?: string;
}

export function ContentRenderer({ content, className = '' }: ContentRendererProps) {
  const html = useMemo(() => {
    if (!content) return '';
    if (typeof content === 'string') return content;
    try {
      return generateHTML(content as JSONContent, extensions);
    } catch {
      return `<pre>${JSON.stringify(content, null, 2)}</pre>`;
    }
  }, [content]);

  return <div className={`tiptap-content ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default ContentRenderer;