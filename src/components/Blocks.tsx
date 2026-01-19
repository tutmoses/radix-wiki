// src/components/Blocks.tsx - Unified Block System with Tiptap (HTML-based)

'use client';

import { useState, useCallback, useEffect, type FC } from 'react';
import Link from 'next/link';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';
import TiptapTable from '@tiptap/extension-table';
import TiptapTableRow from '@tiptap/extension-table-row';
import TiptapTableCell from '@tiptap/extension-table-cell';
import TiptapTableHeader from '@tiptap/extension-table-header';
import TiptapYoutube from '@tiptap/extension-youtube';
import Placeholder from '@tiptap/extension-placeholder';
import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';

const Iframe = TiptapNode.create({
  name: 'iframe',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      src: { default: null },
      width: { default: '100%' },
      height: { default: '400' },
    };
  },
  parseHTML() {
    return [{ tag: 'iframe' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', { 'data-iframe-embed': '', class: 'iframe-embed' }, ['iframe', mergeAttributes(HTMLAttributes, { frameborder: '0', allowfullscreen: 'true' })]];
  },
});

import {
  Plus, Trash2, Copy, ChevronUp, ChevronDown, Pencil, Image,
  Minus, Code, Quote, Clock, FileText, Columns, Settings,
  Bold, Italic, Link2, Heading2, Heading3, List, TrendingUp, TableIcon, Youtube, Code2
} from 'lucide-react';
import { cn, formatRelativeTime, slugify } from '@/lib/utils';
import { findTagByPath } from '@/lib/tags';
import { usePages } from '@/hooks';
import { Button, Input, Badge, Dropdown } from '@/components/ui';
import type { WikiPage } from '@/types';

// ========== BLOCK TYPES & HELPERS (merged from blocks.ts) ==========

export type BlockType = 'content' | 'recentPages' | 'pageList' | 'columns' | 'assetPrice';

interface BaseBlock { id: string; type: BlockType; }

export interface ContentBlock extends BaseBlock { type: 'content'; text: string; }
export interface RecentPagesBlock extends BaseBlock { type: 'recentPages'; tagPath?: string; limit: number; }
export interface PageListBlock extends BaseBlock { type: 'pageList'; pageIds: string[]; }
export interface AssetPriceBlock extends BaseBlock { type: 'assetPrice'; resourceAddress?: string; showChange?: boolean; }
export interface Column { id: string; width?: 'auto' | '1/2' | '1/3' | '2/3' | '1/4' | '3/4'; blocks: LeafBlock[]; }
export interface ColumnsBlock extends BaseBlock { type: 'columns'; columns: Column[]; gap?: 'sm' | 'md' | 'lg'; align?: 'start' | 'center' | 'end' | 'stretch'; }

export type LeafBlock = ContentBlock | RecentPagesBlock | PageListBlock | AssetPriceBlock;
export type Block = LeafBlock | ColumnsBlock;

const BLOCK_DEFAULTS: Record<BlockType, () => Omit<Block, 'id'>> = {
  content: () => ({ type: 'content', text: '' }),
  recentPages: () => ({ type: 'recentPages', limit: 5 }),
  pageList: () => ({ type: 'pageList', pageIds: [] }),
  assetPrice: () => ({ type: 'assetPrice', resourceAddress: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd', showChange: true }),
  columns: () => ({ type: 'columns', columns: [{ id: crypto.randomUUID(), blocks: [] }, { id: crypto.randomUUID(), blocks: [] }], gap: 'md', align: 'start' }),
};

const INSERTABLE_BLOCKS: readonly BlockType[] = ['content', 'columns', 'recentPages', 'pageList', 'assetPrice'];

export const createBlock = (type: BlockType): Block => ({ id: crypto.randomUUID(), ...BLOCK_DEFAULTS[type]() } as Block);
const createColumn = (): Column => ({ id: crypto.randomUUID(), blocks: [] });

export const createDefaultPageContent = (): Block[] => [{
  id: crypto.randomUUID(),
  type: 'content',
  text: '<h2>Getting Started</h2><p>Start writing your content here...</p>',
}];

function duplicateBlock(block: Block): Block {
  if (block.type === 'columns') {
    return { ...block, id: crypto.randomUUID(), columns: block.columns.map(col => ({ ...col, id: crypto.randomUUID(), blocks: col.blocks.map(b => ({ ...b, id: crypto.randomUUID() })) })) };
  }
  return { ...block, id: crypto.randomUUID() };
}

// ========== COMPONENT TYPES ==========

type BlockContent = Block[];

const ICONS: Record<string, React.ReactNode> = {
  Pencil: <Pencil size={18} />,
  Clock: <Clock size={18} />,
  FileText: <FileText size={18} />,
  Columns: <Columns size={18} />,
  TrendingUp: <TrendingUp size={18} />,
};

// ========== HTML PROCESSING ==========
function processHtml(html: string): string {
  if (!html.trim()) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('h1, h2, h3').forEach(el => {
    el.id = slugify(el.textContent?.trim() || '');
  });
  doc.querySelectorAll('a[href]').forEach(el => {
    const href = el.getAttribute('href') || '';
    el.classList.add('link');
    if (href.startsWith('http')) {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  });
  return doc.body.innerHTML;
}

function HtmlContent({ html, className }: { html: string; className?: string }) {
  const processed = processHtml(html);
  return processed ? <div className={className} dangerouslySetInnerHTML={{ __html: processed }} /> : null;
}

export function InlineHtml({ children }: { children: string }) {
  return <span dangerouslySetInnerHTML={{ __html: children.replace(/<\/?p>/g, '') }} />;
}

// ========== RICH TEXT EDITOR ==========
interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  showToolbar?: boolean;
  singleLine?: boolean;
  className?: string;
}

function RichTextToolbar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  const buttons: { action: () => void; isActive: boolean; icon: React.ReactNode; label: string }[] = [
    { action: () => editor.chain().focus().toggleBold().run(), isActive: editor.isActive('bold'), icon: <Bold size={14} />, label: 'Bold' },
    { action: () => editor.chain().focus().toggleItalic().run(), isActive: editor.isActive('italic'), icon: <Italic size={14} />, label: 'Italic' },
    { action: () => editor.chain().focus().toggleCode().run(), isActive: editor.isActive('code'), icon: <Code size={14} />, label: 'Inline Code' },
    { action: () => { const url = window.prompt('URL'); if (url) editor.chain().focus().setLink({ href: url }).run(); }, isActive: editor.isActive('link'), icon: <Link2 size={14} />, label: 'Link' },
    { action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: editor.isActive('heading', { level: 2 }), icon: <Heading2 size={14} />, label: 'H2' },
    { action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), isActive: editor.isActive('heading', { level: 3 }), icon: <Heading3 size={14} />, label: 'H3' },
    { action: () => editor.chain().focus().toggleBulletList().run(), isActive: editor.isActive('bulletList'), icon: <List size={14} />, label: 'List' },
    { action: () => editor.chain().focus().toggleBlockquote().run(), isActive: editor.isActive('blockquote'), icon: <Quote size={14} />, label: 'Quote' },
    { action: () => editor.chain().focus().toggleCodeBlock().run(), isActive: editor.isActive('codeBlock'), icon: <Code2 size={14} />, label: 'Code Block' },
    { action: () => editor.chain().focus().setHorizontalRule().run(), isActive: false, icon: <Minus size={14} />, label: 'Divider' },
    { action: () => { const url = window.prompt('Image URL'); if (url) editor.chain().focus().setImage({ src: url }).run(); }, isActive: false, icon: <Image size={14} />, label: 'Image' },
    { action: () => { const url = window.prompt('YouTube URL'); if (url) editor.chain().focus().setYoutubeVideo({ src: url }).run(); }, isActive: false, icon: <Youtube size={14} />, label: 'YouTube' },
    { action: () => { const url = window.prompt('Embed URL (widget, iframe, etc.)'); if (url) editor.chain().focus().insertContent({ type: 'iframe', attrs: { src: url } }).run(); }, isActive: editor.isActive('iframe'), icon: <Code2 size={14} />, label: 'Embed' },
    { action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(), isActive: editor.isActive('table'), icon: <TableIcon size={14} />, label: 'Table' },
  ];

  return (
    <div className="flex flex-wrap gap-0.5 p-1 bg-surface-1 border border-border-muted rounded-md mb-2">
      {buttons.map(({ action, isActive, icon, label }) => (
        <button key={label} type="button" onClick={action} className={cn('p-1.5 rounded transition-colors', isActive ? 'bg-accent text-text-inverted' : 'text-muted hover:bg-surface-2 hover:text-text')} title={label}>{icon}</button>
      ))}
      {editor.isActive('table') && (
        <>
          <div className="w-px h-6 bg-border-muted mx-1 self-center" />
          <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className="p-1.5 rounded text-muted hover:bg-surface-2 hover:text-text text-xs" title="Add column">+Col</button>
          <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className="p-1.5 rounded text-muted hover:bg-surface-2 hover:text-text text-xs" title="Add row">+Row</button>
          <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} className="p-1.5 rounded text-muted hover:bg-surface-2 hover:text-error text-xs" title="Delete column">-Col</button>
          <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} className="p-1.5 rounded text-muted hover:bg-surface-2 hover:text-error text-xs" title="Delete row">-Row</button>
          <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className="p-1.5 rounded text-muted hover:bg-surface-2 hover:text-error text-xs" title="Delete table">×Tbl</button>
        </>
      )}
    </div>
  );
}

function RichTextEditor({ value, onChange, placeholder = 'Write content...', showToolbar = true, singleLine = false, className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: singleLine ? false : { levels: [2, 3] },
        bulletList: singleLine ? false : undefined,
        orderedList: singleLine ? false : undefined,
        blockquote: singleLine ? false : undefined,
        codeBlock: singleLine ? false : undefined,
        horizontalRule: singleLine ? false : undefined,
        hardBreak: singleLine ? false : undefined,
      }),
      TiptapLink.configure({ openOnClick: false, HTMLAttributes: { class: 'link' } }),
      ...(singleLine ? [] : [
        TiptapImage.configure({ inline: false, allowBase64: true, HTMLAttributes: { class: 'rounded-lg max-w-full' } }),
        TiptapYoutube.configure({ controls: true, nocookie: true, modestBranding: true }),
        TiptapTable.configure({ resizable: false, HTMLAttributes: { class: 'tiptap-table' } }),
        TiptapTableRow,
        TiptapTableCell.configure({ HTMLAttributes: { class: 'p-2' } }),
        TiptapTableHeader.configure({ HTMLAttributes: { class: 'p-2 font-semibold bg-surface-1' } }),
        Iframe,
      ]),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editorProps: {
      attributes: { class: cn('outline-none focus:outline-none', singleLine ? '' : 'prose prose-invert min-h-20') },
      handleKeyDown: singleLine ? (_, event) => event.key === 'Enter' : undefined,
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (editor && !editor.isFocused && editor.getHTML() !== value) {
      editor.commands.setContent(value);
    }
  }, [value, editor]);

  return (
    <div className={cn('stack-sm', className)}>
      {showToolbar && !singleLine && <RichTextToolbar editor={editor} />}
      <div className={cn('tiptap-editor bg-surface-0 border border-border rounded-md focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-muted', singleLine ? 'px-3 py-2' : 'p-3 min-h-20')}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

// Block operations hook
function useBlockOperations<T extends Block>(blocks: T[], setBlocks: (blocks: T[]) => void, createFn: (type: BlockType) => T) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  return {
    selectedIndex,
    setSelectedIndex,
    update: useCallback((i: number, b: T) => setBlocks(blocks.map((x, j) => j === i ? b : x)), [blocks, setBlocks]),
    remove: useCallback((i: number) => { setBlocks(blocks.filter((_, j) => j !== i)); setSelectedIndex(null); }, [blocks, setBlocks]),
    duplicate: useCallback((i: number) => { const next = [...blocks]; next.splice(i + 1, 0, duplicateBlock(blocks[i]) as T); setBlocks(next); setSelectedIndex(i + 1); }, [blocks, setBlocks]),
    move: useCallback((from: number, to: number) => { if (to < 0 || to >= blocks.length) return; const next = [...blocks]; const [m] = next.splice(from, 1); next.splice(to, 0, m); setBlocks(next); setSelectedIndex(to); }, [blocks, setBlocks]),
    insert: useCallback((type: BlockType, at?: number) => { const next = [...blocks]; const i = at ?? blocks.length; next.splice(i, 0, createFn(type)); setBlocks(next); setSelectedIndex(i); }, [blocks, setBlocks, createFn]),
  };
}

type BlockProps<T extends Block = Block> = { block: T; onUpdate?: (b: Block) => void; allContent?: BlockContent };

// ========== VIEW COMPONENTS ==========
const ContentView: FC<BlockProps<ContentBlock>> = ({ block }) => <HtmlContent html={block.text} className="prose-content" />;

function PageCard({ page, compact }: { page: WikiPage; compact?: boolean }) {
  const leafTag = findTagByPath(page.tagPath.split('/'));
  const href = `/${page.tagPath}/${page.slug}`;
  if (compact) return <Link href={href} className="group row p-3 surface hover:bg-surface-2 transition-colors"><FileText size={16} className="text-accent" /><span className="group-hover:text-accent transition-colors">{page.title}</span></Link>;
  return (
    <Link href={href} className="group">
      <div className="row items-start gap-3 p-4 surface-interactive h-full">
        <FileText size={18} className="text-accent shrink-0 mt-0.5" />
        <div className="stack-sm min-w-0 overflow-hidden">
          <span className="font-medium group-hover:text-accent transition-colors truncate">{page.title}</span>
          {page.excerpt && <p className="text-muted line-clamp-2">{page.excerpt}</p>}
          <div className="row flex-wrap mt-auto pt-2 overflow-hidden"><small className="row shrink-0"><Clock size={12} />{formatRelativeTime(page.updatedAt)}</small>{leafTag && <Badge variant="secondary" className="truncate max-w-full">{leafTag.name}</Badge>}</div>
        </div>
      </div>
    </Link>
  );
}

const RecentPagesView: FC<BlockProps<Extract<Block, {type:'recentPages'}>>> = ({ block }) => {
  const { pages, isLoading } = usePages({ type: 'recent', tagPath: block.tagPath, limit: block.limit });
  if (isLoading) return <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-4">{Array.from({ length: Math.min(block.limit, 3) }, (_, i) => <div key={i} className="h-32 skeleton" />)}</div>;
  if (!pages.length) return <p className="text-muted">No pages found.</p>;
  return <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-2 gap-4">{pages.map(p => <PageCard key={p.id} page={p} />)}</div>;
};

const PageListView: FC<BlockProps<Extract<Block, {type:'pageList'}>>> = ({ block }) => {
  const { pages, isLoading } = usePages({ type: 'byIds', pageIds: block.pageIds });
  if (isLoading) return <div className="row-md"><div className="flex-1 h-20 skeleton" /></div>;
  if (!pages.length) return <p className="text-muted">No pages selected.</p>;
  return <div className="row-md wrap">{pages.map(p => <PageCard key={p.id} page={p} compact />)}</div>;
};

function useResourcePrice(resourceAddress?: string) {
  const [data, setData] = useState<{ price: number; change24h?: number; symbol?: string; name?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resourceAddress) { setError('No resource address'); setIsLoading(false); return; }

    const fetchPrice = async () => {
      try {
        const res = await fetch(`https://api.ociswap.com/tokens/${resourceAddress}`);
        if (!res.ok) throw new Error('Token not found');
        const json = await res.json();
        const priceNow = parseFloat(json.price?.usd?.now) || 0;
        const price24h = parseFloat(json.price?.usd?.['24h']) || 0;
        const change24h = price24h > 0 ? ((priceNow - price24h) / price24h) * 100 : undefined;
        setData({ price: priceNow, change24h, symbol: json.symbol, name: json.name });
        setError(priceNow === 0 ? 'Price unavailable' : null);
      } catch {
        setError('Price unavailable');
      } finally { setIsLoading(false); }
    };

    setIsLoading(true);
    fetchPrice();
    const interval = setInterval(fetchPrice, 60000);
    return () => clearInterval(interval);
  }, [resourceAddress]);

  return { data, isLoading, error };
}

const AssetPriceView: FC<BlockProps<AssetPriceBlock>> = ({ block }) => {
  const { data, isLoading, error } = useResourcePrice(block.resourceAddress);

  if (!block.resourceAddress) return <p className="text-muted">No resource address configured</p>;
  if (isLoading) return <div className="surface p-4 animate-pulse"><div className="h-8 w-32 bg-surface-2 rounded" /></div>;
  if (error || !data || typeof data.price !== 'number') return <p className="text-error text-small">{error || 'Price unavailable'}</p>;

  const displayName = data.symbol || data.name || block.resourceAddress.slice(0, 20) + '...';
  const isPositive = (data.change24h ?? 0) >= 0;
  const priceStr = data.price < 0.01 ? data.price.toFixed(6) : data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });

  return (
    <div className="surface p-4 inline-flex items-center gap-4">
      <div className="stack-xs">
        <span className="text-small text-muted">{displayName}</span>
        <span className="text-h3 font-semibold">${priceStr}</span>
      </div>
      {block.showChange && typeof data.change24h === 'number' && (
        <span className={cn('text-small font-medium', isPositive ? 'text-success' : 'text-error')}>
          {isPositive ? '↑' : '↓'} {Math.abs(data.change24h).toFixed(2)}%
        </span>
      )}
    </div>
  );
};

const ColumnsView: FC<BlockProps<ColumnsBlock>> = ({ block, allContent = [] }) => {
  const gapClass = { sm: 'gap-2', md: 'gap-4', lg: 'gap-6' }[block.gap || 'md'];
  const alignClass = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' }[block.align || 'start'];
  return (
    <div className={cn('flex flex-col md:flex-row', gapClass, alignClass)}>
      {block.columns.map(col => <div key={col.id} className="flex-1 min-w-0 stack">{col.blocks.map(bl => <div key={bl.id}>{renderBlock(bl, 'view', undefined, allContent)}</div>)}</div>)}
    </div>
  );
};

// ========== EDIT COMPONENTS ==========
const ContentEdit: FC<BlockProps<ContentBlock>> = ({ block, onUpdate }) => (
  <RichTextEditor value={block.text} onChange={text => onUpdate?.({ ...block, text })} placeholder="Write content... Use toolbar for formatting, quotes, code blocks, and dividers." />
);

const RecentPagesEdit: FC<BlockProps<Extract<Block, {type:'recentPages'}>>> = ({ block, onUpdate }) => (
  <div className="stack surface p-4 border-dashed">
    <div className="row text-muted"><Clock size={18} /><span className="font-medium">Recent Pages Widget</span></div>
    <Input label="Filter by category (optional)" value={block.tagPath || ''} onChange={e => onUpdate?.({ ...block, tagPath: e.target.value || undefined })} placeholder="e.g., contents/tech" hint="Leave empty to show all recent pages" />
    <div className="row"><span>Show</span><input type="number" min={1} max={20} value={block.limit} onChange={e => onUpdate?.({ ...block, limit: parseInt(e.target.value) || 5 })} className="input w-16 text-center" /><span>pages</span></div>
  </div>
);

const PageListEdit: FC<BlockProps<Extract<Block, {type:'pageList'}>>> = ({ block, onUpdate }) => {
  const [newPageId, setNewPageId] = useState('');
  const addPage = () => { if (newPageId.trim()) { onUpdate?.({ ...block, pageIds: [...block.pageIds, newPageId.trim()] }); setNewPageId(''); } };
  return (
    <div className="stack surface p-4 border-dashed">
      <div className="row text-muted"><FileText size={18} /><span className="font-medium">Curated Page List</span></div>
      {block.pageIds.length > 0 && <div className="stack-sm">{block.pageIds.map((id, i) => <div key={i} className="row"><span className="flex-1 text-small truncate">{id}</span><button onClick={() => onUpdate?.({ ...block, pageIds: block.pageIds.filter((_, j) => j !== i) })} className="icon-btn text-muted hover:text-error"><Trash2 size={14} /></button></div>)}</div>}
      <div className="row"><input type="text" value={newPageId} onChange={e => setNewPageId(e.target.value)} placeholder="Page ID..." className="flex-1 input" /><Button size="sm" onClick={addPage} disabled={!newPageId.trim()}>Add</Button></div>
      <small>Add page IDs to create a curated list</small>
    </div>
  );
};

const AssetPriceEdit: FC<BlockProps<AssetPriceBlock>> = ({ block, onUpdate }) => (
  <div className="stack surface p-4 border-dashed">
    <div className="row text-muted"><TrendingUp size={18} /><span className="font-medium">Asset Price Widget</span></div>
    <div className="stack-sm">
      <label className="font-medium">Resource Address</label>
      <input type="text" value={block.resourceAddress || ''} onChange={e => onUpdate?.({ ...block, resourceAddress: e.target.value })} placeholder="resource_rdx1..." className="input font-mono text-small" />
      <small className="text-muted">Enter any Radix resource address to fetch its price</small>
    </div>
    <label className="row">
      <input type="checkbox" checked={block.showChange ?? true} onChange={e => onUpdate?.({ ...block, showChange: e.target.checked })} className="w-4 h-4 rounded border-border" />
      Show 24h change
    </label>
  </div>
);

function ColumnEditor({ column, onUpdate, onDelete, canDelete }: { column: Column; onUpdate: (col: Column) => void; onDelete: () => void; canDelete: boolean }) {
  const setBlocks = useCallback((blocks: LeafBlock[]) => onUpdate({ ...column, blocks }), [column, onUpdate]);
  const { selectedIndex, setSelectedIndex, update, remove, move, insert } = useBlockOperations(column.blocks, setBlocks, createBlock as (type: BlockType) => LeafBlock);
  const contentBlockTypes = INSERTABLE_BLOCKS.filter(t => t !== 'columns');
  return (
    <div className="flex-1 min-w-0 stack-sm p-3 bg-surface-1/50 border border-dashed border-border-muted rounded-lg">
      <div className="spread"><span className="text-small text-muted uppercase tracking-wide">Column</span>{canDelete && <button onClick={onDelete} className="icon-btn p-1 text-muted hover:text-error"><Trash2 size={14} /></button>}</div>
      {column.blocks.length === 0 ? <div className="py-6 text-center"><p className="text-muted text-small mb-2">Empty column</p><InsertButton onInsert={insert} compact blockTypes={contentBlockTypes} /></div> : (
        <div className="stack-sm">
          {column.blocks.map((block, i) => <BlockWrapper key={block.id} block={block} index={i} total={column.blocks.length} isSelected={selectedIndex === i} onSelect={() => setSelectedIndex(i)} onUpdate={b => update(i, b as LeafBlock)} onDelete={() => remove(i)} onMoveUp={() => move(i, i - 1)} onMoveDown={() => move(i, i + 1)} compact />)}
          <InsertButton onInsert={insert} compact blockTypes={contentBlockTypes} />
        </div>
      )}
    </div>
  );
}

const ColumnsEdit: FC<BlockProps<ColumnsBlock>> = ({ block, onUpdate }) => {
  const [showSettings, setShowSettings] = useState(false);
  const updateColumn = (i: number, col: Column) => onUpdate?.({ ...block, columns: block.columns.map((c, j) => j === i ? col : c) });
  const deleteColumn = (i: number) => block.columns.length > 1 && onUpdate?.({ ...block, columns: block.columns.filter((_, j) => j !== i) });
  const addColumn = () => block.columns.length < 4 && onUpdate?.({ ...block, columns: [...block.columns, createColumn()] });
  const gaps = ['sm', 'md', 'lg'] as const;
  const aligns = ['start', 'center', 'end', 'stretch'] as const;
  return (
    <div className="stack">
      <div className="spread">
        <div className="row text-muted"><Columns size={18} /><span className="font-medium">{block.columns.length} Column Layout</span></div>
        <div className="row"><button onClick={() => setShowSettings(!showSettings)} className={cn('icon-btn p-1', showSettings && 'bg-surface-2')}><Settings size={14} /></button>{block.columns.length < 4 && <button onClick={addColumn} className="text-accent text-small hover:text-accent-hover">+ Add Column</button>}</div>
      </div>
      {showSettings && (
        <div className="row-md p-3 bg-surface-2 rounded-lg">
          <div className="row"><span className="text-small text-muted">Gap:</span><div className="row wrap">{gaps.map(opt => <button key={opt} onClick={() => onUpdate?.({ ...block, gap: opt })} className={cn('px-3 py-1 rounded-md border capitalize', (block.gap || 'md') === opt ? 'bg-accent text-text-inverted border-accent' : 'border-border hover:bg-surface-2')}>{opt}</button>)}</div></div>
          <div className="row"><span className="text-small text-muted">Align:</span><div className="row wrap">{aligns.map(opt => <button key={opt} onClick={() => onUpdate?.({ ...block, align: opt })} className={cn('px-3 py-1 rounded-md border capitalize', (block.align || 'start') === opt ? 'bg-accent text-text-inverted border-accent' : 'border-border hover:bg-surface-2')}>{opt}</button>)}</div></div>
        </div>
      )}
      <div className={cn('flex gap-4', { 'gap-2': block.gap === 'sm', 'gap-6': block.gap === 'lg' })}>{block.columns.map((col, i) => <ColumnEditor key={col.id} column={col} onUpdate={c => updateColumn(i, c)} onDelete={() => deleteColumn(i)} canDelete={block.columns.length > 1} />)}</div>
    </div>
  );
};

// ========== UNIFIED BLOCK REGISTRY ==========
type BlockComponent<T extends Block = Block> = FC<BlockProps<T>>;

const BLOCK_REGISTRY: Record<BlockType, { label: string; icon: string; View: BlockComponent<any>; Edit: BlockComponent<any> }> = {
  content: { label: 'Content', icon: 'Pencil', View: ContentView, Edit: ContentEdit },
  recentPages: { label: 'Recent Pages', icon: 'Clock', View: RecentPagesView, Edit: RecentPagesEdit },
  pageList: { label: 'Page List', icon: 'FileText', View: PageListView, Edit: PageListEdit },
  assetPrice: { label: 'Asset Price', icon: 'TrendingUp', View: AssetPriceView, Edit: AssetPriceEdit },
  columns: { label: 'Columns', icon: 'Columns', View: ColumnsView, Edit: ColumnsEdit },
};

function renderBlock(block: Block, mode: 'edit' | 'view', onUpdate?: (b: Block) => void, allContent: BlockContent = []): React.ReactNode {
  const reg = BLOCK_REGISTRY[block.type];
  if (!reg) return <p className="text-warning text-small">Unknown block: {block.type}</p>;
  const Component = mode === 'view' ? reg.View : reg.Edit;
  return <Component block={block} onUpdate={onUpdate} allContent={allContent} />;
}

function InsertBlockMenu({ onInsert, onClose, blockTypes }: { onInsert: (type: BlockType) => void; onClose: () => void; blockTypes: readonly BlockType[] }) {
  return (
    <Dropdown onClose={onClose} className="left-1/2 -translate-x-1/2 w-64 p-2">
      <div className="stack-sm">{blockTypes.map(type => {
        const r = BLOCK_REGISTRY[type];
        return <button key={type} onClick={() => { onInsert(type); onClose(); }} className="dropdown-item rounded-md">{ICONS[r.icon]}<span>{r.label}</span></button>;
      })}</div>
    </Dropdown>
  );
}

function InsertButton({ onInsert, compact, blockTypes = INSERTABLE_BLOCKS }: { onInsert: (type: BlockType) => void; compact?: boolean; blockTypes?: readonly BlockType[] }) {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <div className="relative center">
      <button onClick={() => setShowMenu(!showMenu)} className={cn('row text-muted hover:text-text border border-dashed border-border-muted hover:border-border rounded-md transition-colors', compact ? 'px-2 py-1 text-small rounded' : 'px-3 py-1.5')}>
        <Plus size={compact ? 14 : 16} /><span>{compact ? 'Add' : 'Add block'}</span>
      </button>
      {showMenu && <InsertBlockMenu onInsert={onInsert} onClose={() => setShowMenu(false)} blockTypes={blockTypes} />}
    </div>
  );
}

function BlockWrapper({ block, index, total, isSelected, onSelect, onUpdate, onDelete, onDuplicate, onMoveUp, onMoveDown, compact }: {
  block: Block; index: number; total: number; isSelected: boolean;
  onSelect: () => void; onUpdate: (b: Block) => void; onDelete: () => void;
  onDuplicate?: () => void; onMoveUp: () => void; onMoveDown: () => void; compact?: boolean;
}) {
  const reg = BLOCK_REGISTRY[block.type];
  const iconSize = compact ? 12 : 14;

  if (!reg) return (
    <div className={cn('rounded border border-warning/50 bg-warning/10', compact ? 'p-3' : 'p-4 rounded-lg')}>
      <div className="spread mb-2"><span className={cn('text-warning', compact ? 'text-small' : 'font-medium')}>Unknown block: {block.type}</span><button onClick={e => { e.stopPropagation(); onDelete(); }} className="icon-btn p-1 text-muted hover:text-error"><Trash2 size={iconSize} /></button></div>
    </div>
  );

  return (
    <div onClick={onSelect} className={cn('group relative transition-colors',
      compact ? cn('p-3 rounded-md border', isSelected ? 'border-accent bg-accent/5' : 'border-transparent hover:border-border-muted hover:bg-surface-2/50')
        : cn('p-4 rounded-lg border', isSelected ? 'border-accent bg-accent/5' : 'border-border-muted hover:border-border', block.type === 'columns' && 'bg-surface-1/30')
    )}>
      <div className={cn('spread', compact ? 'mb-2' : 'mb-3')}>
        <div className="row">
          {!(compact || block.type === 'columns') && <div className="row text-muted">{ICONS[reg.icon]}<span className="text-small font-medium uppercase">{reg.label}</span></div>}
        </div>
        <div className="row opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={e => { e.stopPropagation(); onMoveUp(); }} disabled={index === 0} className="icon-btn p-1 text-muted disabled:opacity-30"><ChevronUp size={iconSize} /></button>
          <button onClick={e => { e.stopPropagation(); onMoveDown(); }} disabled={index === total - 1} className="icon-btn p-1 text-muted disabled:opacity-30"><ChevronDown size={iconSize} /></button>
          {onDuplicate && <button onClick={e => { e.stopPropagation(); onDuplicate(); }} className="icon-btn p-1 text-muted" title="Duplicate"><Copy size={iconSize} /></button>}
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className="icon-btn p-1 text-muted hover:text-error" title="Delete"><Trash2 size={iconSize} /></button>
        </div>
      </div>
      {renderBlock(block, 'edit', onUpdate)}
    </div>
  );
}

export function BlockEditor({ content, onChange }: { content: BlockContent; onChange: (content: BlockContent) => void }) {
  const { selectedIndex, setSelectedIndex, update, remove, duplicate, move, insert } = useBlockOperations(content, onChange, createBlock);
  if (content.length === 0) return <div className="stack items-center py-12 text-center"><p className="text-muted">No content yet. Add your first block!</p><InsertButton onInsert={insert} /></div>;
  return (
    <div className="stack">
      {content.map((block, i) => <BlockWrapper key={block.id} block={block} index={i} total={content.length} isSelected={selectedIndex === i} onSelect={() => setSelectedIndex(i)} onUpdate={b => update(i, b)} onDelete={() => remove(i)} onDuplicate={() => duplicate(i)} onMoveUp={() => move(i, i - 1)} onMoveDown={() => move(i, i + 1)} />)}
      <InsertButton onInsert={insert} />
    </div>
  );
}

export function BlockRenderer({ content, className }: { content: BlockContent | unknown; className?: string }) {
  if (!content || !Array.isArray(content)) return null;
  return <div className={cn('stack', className)}>{(content as BlockContent).map(block => <div key={block.id}>{renderBlock(block, 'view', undefined, content as BlockContent)}</div>)}</div>;
}

export default BlockEditor;