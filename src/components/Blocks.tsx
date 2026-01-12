// src/components/Blocks.tsx - Unified Block System

'use client';

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  Plus, GripVertical, Trash2, Copy, ChevronUp, ChevronDown, Type, AlignLeft, Image, 
  AlertCircle, Minus, Code, Quote, Clock, FileText, Columns, Settings, Table, ListTree,
  AlertTriangle, CheckCircle, Info
} from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { findTagByPath } from '@/lib/tags';
import { Button, Input, Badge } from '@/components/ui';
import { 
  type Block, type ContentBlock, type BlockContent, type BlockType, type Column, 
  type ColumnsBlock, type TableBlock, type TocBlock, type MediaBlock, type HeadingBlock,
  createBlock, createContentBlock, duplicateBlock, createColumn, 
  BLOCK_REGISTRY, INSERTABLE_BLOCKS, CONTENT_BLOCK_TYPES 
} from '@/lib/blocks';
import type { WikiPage } from '@/types';

// Shared Constants & Utilities

const ICONS: Record<string, React.ReactNode> = {
  Type: <Type size={18} />, AlignLeft: <AlignLeft size={18} />, Image: <Image size={18} />,
  AlertCircle: <AlertCircle size={18} />, Minus: <Minus size={18} />, Code: <Code size={18} />,
  Quote: <Quote size={18} />, Clock: <Clock size={18} />, FileText: <FileText size={18} />,
  Columns: <Columns size={18} />, Table: <Table size={18} />, ListTree: <ListTree size={18} />,
};

const CALLOUT_CONFIG = {
  info: { className: 'callout-info', Icon: Info, iconClass: 'status-info' },
  warning: { className: 'callout-warning', Icon: AlertTriangle, iconClass: 'status-warning' },
  success: { className: 'callout-success', Icon: CheckCircle, iconClass: 'status-success' },
  error: { className: 'callout-error', Icon: AlertCircle, iconClass: 'status-error' },
} as const;

const slugify = (text: string) => text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

// Inline Markdown Parser

const INLINE_MARKDOWN_REGEX = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[(.+?)\]\((.+?)\))/g;
const LIST_ITEM_REGEX = /^[\s]*[-*â€¢]\s+(.+)$/;

function parseInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0, key = 0, match;
  INLINE_MARKDOWN_REGEX.lastIndex = 0;
  
  while ((match = INLINE_MARKDOWN_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const [full, , bold, italic, code, linkText, href] = match;
    if (bold) parts.push(<strong key={key++}>{bold}</strong>);
    else if (italic) parts.push(<em key={key++}>{italic}</em>);
    else if (code) parts.push(<code key={key++}>{code}</code>);
    else if (linkText && href) {
      const isExternal = href.startsWith('http');
      parts.push(isExternal
        ? <a key={key++} href={href} target="_blank" rel="noopener noreferrer" className="link">{linkText}</a>
        : <Link key={key++} href={href} className="link">{linkText}</Link>
      );
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length ? parts : [text];
}

function parseParagraphContent(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];
  let key = 0;

  const flushList = () => {
    if (!listItems.length) return;
    elements.push(
      <ul key={key++} className="pl-6 list-disc stack-1 my-2">
        {listItems.map((item, i) => <li key={i}>{parseInlineMarkdown(item)}</li>)}
      </ul>
    );
    listItems = [];
  };

  for (const line of lines) {
    const listMatch = line.match(LIST_ITEM_REGEX);
    if (listMatch) {
      listItems.push(listMatch[1]);
    } else {
      flushList();
      if (line.trim()) {
        elements.push(<span key={key++}>{parseInlineMarkdown(line)}</span>, <br key={key++} />);
      } else if (elements.length) {
        elements.push(<br key={key++} />);
      }
    }
  }
  flushList();
  while (elements.length && (elements.at(-1) as React.ReactElement)?.type === 'br') elements.pop();
  return <>{elements}</>;
}

// Shared Hooks

type FetchMode = { type: 'recent'; tagPath?: string; limit: number } | { type: 'byIds'; pageIds: string[] };

function usePages(mode: FetchMode) {
  const [pages, setPages] = useState<WikiPage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (mode.type === 'byIds' && !mode.pageIds.length) { setIsLoading(false); return; }
    (async () => {
      try {
        if (mode.type === 'recent') {
          const params = new URLSearchParams({ pageSize: mode.limit.toString(), published: 'true' });
          if (mode.tagPath) params.set('tagPath', mode.tagPath);
          const res = await fetch(`/api/wiki?${params}`);
          if (res.ok) setPages((await res.json()).items);
        } else {
          const results = await Promise.all(mode.pageIds.map(id => fetch(`/api/wiki/by-id/${id}`).then(r => r.ok ? r.json() : null)));
          setPages(results.filter(Boolean));
        }
      } catch (e) { console.error('Failed to fetch pages:', e); }
      finally { setIsLoading(false); }
    })();
  }, [mode.type, mode.type === 'recent' ? mode.tagPath : null, mode.type === 'recent' ? mode.limit : mode.pageIds.join(',')]);

  return { pages, isLoading };
}

function useBlockOperations<T extends Block>(blocks: T[], setBlocks: (blocks: T[]) => void, createFn: (type: BlockType) => T) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const update = useCallback((index: number, block: T) => { const next = [...blocks]; next[index] = block; setBlocks(next); }, [blocks, setBlocks]);
  const remove = useCallback((index: number) => { setBlocks(blocks.filter((_, i) => i !== index)); setSelectedIndex(null); }, [blocks, setBlocks]);
  const duplicate = useCallback((index: number) => { const next = [...blocks]; next.splice(index + 1, 0, duplicateBlock(blocks[index]) as T); setBlocks(next); setSelectedIndex(index + 1); }, [blocks, setBlocks]);
  const move = useCallback((from: number, to: number) => { if (to < 0 || to >= blocks.length) return; const next = [...blocks]; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); setBlocks(next); setSelectedIndex(to); }, [blocks, setBlocks]);
  const insert = useCallback((type: BlockType, atIndex?: number) => { const next = [...blocks]; const index = atIndex ?? blocks.length; next.splice(index, 0, createFn(type)); setBlocks(next); setSelectedIndex(index); }, [blocks, setBlocks, createFn]);
  return { selectedIndex, setSelectedIndex, update, remove, duplicate, move, insert };
}

// TOC Helpers

function extractHeadings(content: BlockContent, maxDepth = 3): HeadingBlock[] {
  const headings: HeadingBlock[] = [];
  const process = (blocks: Block[]) => {
    for (const block of blocks) {
      if (block.type === 'heading' && block.level <= maxDepth && block.text.trim()) headings.push(block);
      else if (block.type === 'columns') block.columns.forEach(col => process(col.blocks));
    }
  };
  process(content);
  return headings;
}

// Editor-Only Components

function Selector<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="row wrap">
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)}
          className={cn('px-3 py-1 rounded-md border capitalize', value === opt ? 'bg-accent text-text-inverted border-accent' : 'border-border hover:bg-surface-2')}>
          {opt}
        </button>
      ))}
    </div>
  );
}

function InsertBlockMenu({ onInsert, onClose, blockTypes }: { onInsert: (type: BlockType) => void; onClose: () => void; blockTypes: readonly BlockType[] }) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div ref={menuRef} className="dropdown left-1/2 -translate-x-1/2 w-64 p-2">
      <div className="stack-2">
        {blockTypes.map(type => {
          const reg = BLOCK_REGISTRY[type];
          return <button key={type} onClick={() => { onInsert(type); onClose(); }} className="dropdown-item rounded-md">{ICONS[reg.icon]}<span>{reg.label}</span></button>;
        })}
      </div>
    </div>
  );
}

function InsertButton({ onInsert, compact, allowColumns = true }: { onInsert: (type: BlockType) => void; compact?: boolean; allowColumns?: boolean }) {
  const [showMenu, setShowMenu] = useState(false);
  const blockTypes = allowColumns ? INSERTABLE_BLOCKS : CONTENT_BLOCK_TYPES;
  return (
    <div className="relative center">
      <button onClick={() => setShowMenu(!showMenu)} className={cn('row text-muted hover:text-text border border-dashed border-border-muted hover:border-border rounded-md transition-colors', compact ? 'px-2 py-1 text-small rounded' : 'px-3 py-1.5')}>
        <Plus size={compact ? 14 : 16} /><span>{compact ? 'Add' : 'Add block'}</span>
      </button>
      {showMenu && <InsertBlockMenu onInsert={onInsert} onClose={() => setShowMenu(false)} blockTypes={blockTypes} />}
    </div>
  );
}

// Unified Block Components (mode: 'edit' | 'view')

type BlockProps<T extends Block = Block> = { block: T; mode: 'edit' | 'view'; onUpdate?: (b: Block) => void; allContent?: BlockContent };

function HeadingBlock({ block, mode, onUpdate }: BlockProps<Extract<Block, { type: 'heading' }>>) {
  if (mode === 'view') {
    const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3';
    return <Tag id={slugify(block.text)}>{block.text}</Tag>;
  }
  return (
    <div className="stack-2">
      <div className="row">
        {([1, 2, 3] as const).map(level => (
          <button key={level} onClick={() => onUpdate?.({ ...block, level })}
            className={cn('px-3 py-1 rounded-md border', block.level === level ? 'bg-accent text-text-inverted border-accent' : 'border-border hover:bg-surface-2')}>
            H{level}
          </button>
        ))}
      </div>
      <input type="text" value={block.text} onChange={e => onUpdate?.({ ...block, text: e.target.value })} placeholder="Heading text..."
        className={cn('input-ghost font-semibold', { 'text-h1': block.level === 1, 'text-h2': block.level === 2, 'text-h3': block.level === 3 })} />
    </div>
  );
}

function ParagraphBlock({ block, mode, onUpdate }: BlockProps<Extract<Block, { type: 'paragraph' }>>) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  if (mode === 'view') return <div className="paragraph">{parseParagraphContent(block.text)}</div>;

  const updateWithCursor = useCallback((newText: string, cursorPos: number) => {
    onUpdate?.({ ...block, text: newText });
    setTimeout(() => { if (textareaRef.current) textareaRef.current.selectionStart = textareaRef.current.selectionEnd = cursorPos; }, 0);
  }, [block, onUpdate]);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const { selectionStart: start, selectionEnd: end } = e.currentTarget;
    
    // Check for HTML content first (preserves links from rich text)
    const htmlContent = e.clipboardData.getData('text/html');
    if (htmlContent) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlContent, 'text/html');
      const walkNode = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as Element;
          if (el.tagName === 'A') {
            const href = el.getAttribute('href');
            const text = el.textContent || '';
            return href && text ? `[${text}](${href})` : text;
          }
          if (el.tagName === 'BR') return '\n';
          if (['P', 'DIV'].includes(el.tagName)) {
            const content = Array.from(el.childNodes).map(walkNode).join('');
            return content + '\n\n';
          }
          if (el.tagName === 'LI') {
            const content = Array.from(el.childNodes).map(walkNode).join('');
            return '- ' + content + '\n';
          }
          return Array.from(el.childNodes).map(walkNode).join('');
        }
        return '';
      };
      const converted = walkNode(doc.body).trim().replace(/\n{3,}/g, '\n\n');
      if (converted !== e.clipboardData.getData('text').trim()) {
        e.preventDefault();
        updateWithCursor(block.text.slice(0, start) + converted + block.text.slice(end), start + converted.length);
        return;
      }
    }

    const pastedText = e.clipboardData.getData('text');
    if (/^[\s]*[-*â€¢]\s|^[\s]*\d+[.)]\s/m.test(pastedText)) {
      e.preventDefault();
      const normalized = pastedText.split('\n').map(line => line.replace(/^[\s]*[-*â€¢]\s/, '- ').replace(/^[\s]*\d+[.)]\s/, '- ')).join('\n');
      updateWithCursor(block.text.slice(0, start) + normalized + block.text.slice(end), start + normalized.length);
      return;
    }
    const urlRegex = /https?:\/\/[^\s]+/g;
    const trimmed = pastedText.trim();
    // Single URL pasted
    if (/^https?:\/\/[^\s]+$/.test(trimmed)) {
      e.preventDefault();
      const selectedText = block.text.slice(start, end);
      const linkText = selectedText || new URL(trimmed).hostname.replace(/^www\./, '');
      const markdownLink = `[${linkText}](${trimmed})`;
      updateWithCursor(block.text.slice(0, start) + markdownLink + block.text.slice(end), start + markdownLink.length);
      return;
    }
    // Text containing URLs - convert them to markdown links
    if (urlRegex.test(pastedText)) {
      e.preventDefault();
      const converted = pastedText.replace(urlRegex, url => {
        try {
          const linkText = new URL(url).hostname.replace(/^www\./, '');
          return `[${linkText}](${url})`;
        } catch { return url; }
      });
      updateWithCursor(block.text.slice(0, start) + converted + block.text.slice(end), start + converted.length);
    }
  };

  return (
    <div className="stack-2">
      <textarea ref={textareaRef} value={block.text} onChange={e => onUpdate?.({ ...block, text: e.target.value })} onPaste={handlePaste}
        placeholder="Write paragraph... (supports **bold**, *italic*, `code`, [links](url), and - list items)" className="input-ghost min-h-15 resize-none" rows={3} />
      <small>Supports: **bold**, *italic*, `code`, [link](url), - list items</small>
    </div>
  );
}

function MediaBlockComponent({ block, mode, onUpdate }: BlockProps<MediaBlock>) {
  const getEmbedUrl = (url: string) => {
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
    const vm = url.match(/vimeo\.com\/(\d+)/);
    if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
    return url;
  };

  if (mode === 'view') {
    if (!block.src) return null;
    const aspectClass = { '16:9': 'aspect-video', '4:3': 'aspect-[4/3]', '1:1': 'aspect-square', auto: '' }[block.aspectRatio || '16:9'];
    const content = {
      image: <img src={block.src} alt={block.alt || ''} className="rounded-lg max-w-full" />,
      video: <video src={block.src} className="rounded-lg max-w-full" controls />,
      embed: <div className={cn('w-full rounded-lg overflow-hidden surface', aspectClass)}><iframe src={getEmbedUrl(block.src)} className="w-full h-full border-0" allowFullScreen /></div>,
    }[block.mediaType];
    return <figure className="stack-2">{content}{block.caption && <figcaption className="text-muted text-center">{block.caption}</figcaption>}</figure>;
  }

  const detectMediaType = (url: string): 'image' | 'video' | 'embed' => {
    if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url)) return 'image';
    if (/\.(mp4|webm|ogg)$/i.test(url)) return 'video';
    return 'embed';
  };

  return (
    <div className="stack">
      <div className="row"><span className="text-small text-muted">Type:</span><Selector options={['image', 'video', 'embed'] as const} value={block.mediaType} onChange={mediaType => onUpdate?.({ ...block, mediaType })} /></div>
      <Input label={{ image: 'Image URL', video: 'Video URL', embed: 'Embed URL' }[block.mediaType]} type="url" value={block.src} onChange={e => onUpdate?.({ ...block, src: e.target.value, mediaType: detectMediaType(e.target.value) })} placeholder="https://..." />
      {block.mediaType === 'image' && <Input label="Alt text" value={block.alt || ''} onChange={e => onUpdate?.({ ...block, alt: e.target.value })} placeholder="Describe the image..." />}
      <Input label="Caption (optional)" value={block.caption || ''} onChange={e => onUpdate?.({ ...block, caption: e.target.value })} placeholder="Caption..." />
      {block.mediaType !== 'image' && <div className="row"><span className="text-small text-muted">Aspect ratio:</span><Selector options={['auto', '16:9', '4:3', '1:1'] as const} value={block.aspectRatio || 'auto'} onChange={aspectRatio => onUpdate?.({ ...block, aspectRatio })} /></div>}
      {block.src && block.mediaType === 'image' && <img src={block.src} alt={block.alt || ''} className="rounded-lg max-h-48 object-contain" />}
      {block.src && block.mediaType === 'video' && <video src={block.src} className="rounded-lg max-h-48" controls />}
    </div>
  );
}

function CalloutBlockComponent({ block, mode, onUpdate }: BlockProps<Extract<Block, { type: 'callout' }>>) {
  const { className, Icon, iconClass } = CALLOUT_CONFIG[block.variant];
  if (mode === 'view') {
    return (
      <div className={cn('callout', className)}>
        <Icon size={20} className={cn('shrink-0 mt-0.5', iconClass)} />
        <div className="stack-2">{block.title && <strong>{block.title}</strong>}<p>{parseInlineMarkdown(block.text)}</p></div>
      </div>
    );
  }
  return (
    <div className="stack">
      <Selector options={['info', 'warning', 'success', 'error'] as const} value={block.variant} onChange={variant => onUpdate?.({ ...block, variant })} />
      <Input label="Title (optional)" value={block.title || ''} onChange={e => onUpdate?.({ ...block, title: e.target.value })} placeholder="Callout title..." />
      <textarea value={block.text} onChange={e => onUpdate?.({ ...block, text: e.target.value })} placeholder="Callout content..." className="input min-h-15 resize-none" rows={2} />
    </div>
  );
}

function DividerBlock({ mode }: BlockProps<Extract<Block, { type: 'divider' }>>) {
  if (mode === 'view') return <hr />;
  return <div className="py-2"><hr /><small className="block text-center mt-2">Horizontal divider</small></div>;
}

function CodeBlockComponent({ block, mode, onUpdate }: BlockProps<Extract<Block, { type: 'code' }>>) {
  if (mode === 'view') {
    return (
      <div className="relative">
        {block.language && <small className="absolute top-2 right-2">{block.language}</small>}
        <pre><code>{block.code}</code></pre>
      </div>
    );
  }
  const languages = ['typescript', 'javascript', 'python', 'rust', 'sql', 'bash', 'json', 'css', 'html'];
  return (
    <div className="stack">
      <div className="row wrap">
        {languages.map(lang => (
          <button key={lang} onClick={() => onUpdate?.({ ...block, language: lang })}
            className={cn('px-2 py-1 text-small rounded border', block.language === lang ? 'bg-accent text-text-inverted border-accent' : 'border-border hover:bg-surface-2')}>
            {lang}
          </button>
        ))}
      </div>
      <textarea value={block.code} onChange={e => onUpdate?.({ ...block, code: e.target.value })} placeholder="// Enter code..." className="input min-h-30 resize-none font-mono" rows={6} spellCheck={false} />
    </div>
  );
}

function QuoteBlockComponent({ block, mode, onUpdate }: BlockProps<Extract<Block, { type: 'quote' }>>) {
  if (mode === 'view') {
    return <blockquote><p>{parseInlineMarkdown(block.text)}</p>{block.attribution && <cite className="block mt-2">â€” {block.attribution}</cite>}</blockquote>;
  }
  return (
    <div className="stack border-l-4 border-accent pl-4">
      <textarea value={block.text} onChange={e => onUpdate?.({ ...block, text: e.target.value })} placeholder="Quote text..." className="input-ghost min-h-15 italic resize-none" rows={2} />
      <Input label="Attribution (optional)" value={block.attribution || ''} onChange={e => onUpdate?.({ ...block, attribution: e.target.value })} placeholder="â€” Author name" />
    </div>
  );
}

function TableBlockComponent({ block, mode, onUpdate }: BlockProps<TableBlock>) {
  if (mode === 'view') {
    if (!block.rows.length) return null;
    const [headerRow, bodyRows] = block.hasHeader ? [block.rows[0], block.rows.slice(1)] : [null, block.rows];
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          {headerRow && <thead><tr>{headerRow.cells.map((cell, i) => <th key={i} className="text-left p-2 border-b-2 border-border font-semibold bg-surface-1">{parseInlineMarkdown(cell)}</th>)}</tr></thead>}
          <tbody>{bodyRows.map((row, i) => <tr key={i} className="border-b border-border-muted hover:bg-surface-1/50">{row.cells.map((cell, j) => <td key={j} className="p-2">{parseInlineMarkdown(cell)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  }

  const updateCell = (ri: number, ci: number, value: string) => onUpdate?.({ ...block, rows: block.rows.map((row, r) => r === ri ? { ...row, cells: row.cells.map((c, i) => i === ci ? value : c) } : row) });
  const addRow = () => onUpdate?.({ ...block, rows: [...block.rows, { cells: Array(block.rows[0]?.cells.length || 2).fill('') }] });
  const addColumn = () => onUpdate?.({ ...block, rows: block.rows.map(row => ({ ...row, cells: [...row.cells, ''] })) });
  const deleteRow = (i: number) => block.rows.length > 1 && onUpdate?.({ ...block, rows: block.rows.filter((_, j) => j !== i) });
  const deleteColumn = (ci: number) => block.rows[0]?.cells.length > 1 && onUpdate?.({ ...block, rows: block.rows.map(row => ({ ...row, cells: row.cells.filter((_, i) => i !== ci) })) });

  return (
    <div className="stack">
      <label className="row"><input type="checkbox" checked={block.hasHeader ?? true} onChange={e => onUpdate?.({ ...block, hasHeader: e.target.checked })} className="rounded" /><span>First row is header</span></label>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse"><tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri}>
              {row.cells.map((cell, ci) => <td key={ci} className="p-1"><input type="text" value={cell} onChange={e => updateCell(ri, ci, e.target.value)} placeholder={block.hasHeader && ri === 0 ? 'Header' : 'Cell'} className={cn('input w-full', block.hasHeader && ri === 0 && 'font-semibold')} /></td>)}
              <td className="p-1 w-8"><button onClick={() => deleteRow(ri)} className="icon-btn p-1 text-muted hover:text-error" disabled={block.rows.length <= 1}><Trash2 size={14} /></button></td>
            </tr>
          ))}
        </tbody></table>
      </div>
      <div className="row">
        <button onClick={addRow} className="text-accent text-small hover:text-accent-hover">+ Add row</button>
        <button onClick={addColumn} className="text-accent text-small hover:text-accent-hover">+ Add column</button>
        {block.rows[0]?.cells.length > 1 && <button onClick={() => deleteColumn(block.rows[0].cells.length - 1)} className="text-muted text-small hover:text-error">âˆ’ Remove column</button>}
      </div>
    </div>
  );
}

function TocBlockComponent({ block, mode, onUpdate, allContent = [] }: BlockProps<TocBlock>) {
  const headings = useMemo(() => extractHeadings(allContent, block.maxDepth || 3), [allContent, block.maxDepth]);

  if (mode === 'view') {
    if (!headings.length) return <p className="text-muted text-small">No headings found.</p>;
    return (
      <nav className="stack-2">
        {block.title && <h4 className="font-semibold">{block.title}</h4>}
        <ul className="stack-1">
          {headings.map((h, i) => <li key={i} style={{ paddingLeft: `${(h.level - 1) * 0.75}rem` }}><a href={`#${slugify(h.text)}`} className="link-muted text-small hover:text-accent">{h.text}</a></li>)}
        </ul>
      </nav>
    );
  }
  return (
    <div className="stack surface p-4 border-dashed">
      <div className="row text-muted"><ListTree size={18} /><span className="font-medium">Table of Contents</span></div>
      <Input label="Title (optional)" value={block.title || ''} onChange={e => onUpdate?.({ ...block, title: e.target.value || undefined })} placeholder="Contents" />
      <div className="row"><span>Max heading depth:</span><Selector options={['1', '2', '3'] as const} value={String(block.maxDepth || 3)} onChange={v => onUpdate?.({ ...block, maxDepth: parseInt(v) as 1 | 2 | 3 })} /></div>
      <small className="text-muted">Automatically generates from page headings (H1, H2, H3)</small>
    </div>
  );
}

// Page Card (view only)
function PageCard({ page, variant }: { page: WikiPage; variant: 'full' | 'compact' }) {
  const leafTag = findTagByPath(page.tagPath.split('/'));
  const href = `/${page.tagPath}/${page.slug}`;
  if (variant === 'compact') {
    return <Link href={href} className="group row p-3 surface hover:bg-surface-2 transition-colors"><FileText size={16} className="text-accent" /><span className="group-hover:text-accent transition-colors">{page.title}</span></Link>;
  }
  return (
    <Link href={href} className="flex-1 min-w-70 max-w-[calc(33.333%-1rem)] group">
      <div className="row items-start gap-3 p-4 surface-interactive h-full">
        <FileText size={18} className="text-accent shrink-0 mt-0.5" />
        <div className="stack-2 min-w-0">
          <span className="font-medium group-hover:text-accent transition-colors truncate">{page.title}</span>
          {page.excerpt && <p className="text-muted line-clamp-2">{page.excerpt}</p>}
          <div className="row mt-auto pt-2"><small className="row"><Clock size={12} />{formatRelativeTime(page.updatedAt)}</small>{leafTag && <Badge variant="secondary">{leafTag.name}</Badge>}</div>
        </div>
      </div>
    </Link>
  );
}

function RecentPagesBlockComponent({ block, mode, onUpdate }: BlockProps<Extract<Block, { type: 'recentPages' }>>) {
  const { pages, isLoading } = usePages({ type: 'recent', tagPath: block.tagPath, limit: block.limit });

  if (mode === 'view') {
    if (isLoading) return <div className="row-4 wrap">{Array.from({ length: Math.min(block.limit, 3) }, (_, i) => <div key={i} className="flex-1 h-32 skeleton" />)}</div>;
    if (!pages.length) return <p className="text-muted">No pages found.</p>;
    return <div className="row-4 wrap">{pages.map(page => <PageCard key={page.id} page={page} variant="full" />)}</div>;
  }
  return (
    <div className="stack surface p-4 border-dashed">
      <div className="row text-muted"><Clock size={18} /><span className="font-medium">Recent Pages Widget</span></div>
      <Input label="Filter by category (optional)" value={block.tagPath || ''} onChange={e => onUpdate?.({ ...block, tagPath: e.target.value || undefined })} placeholder="e.g., contents/tech" hint="Leave empty to show all recent pages" />
      <div className="row"><span>Show</span><input type="number" min={1} max={20} value={block.limit} onChange={e => onUpdate?.({ ...block, limit: parseInt(e.target.value) || 5 })} className="input w-16 text-center" /><span>pages</span></div>
    </div>
  );
}

function PageListBlockComponent({ block, mode, onUpdate }: BlockProps<Extract<Block, { type: 'pageList' }>>) {
  const { pages, isLoading } = usePages({ type: 'byIds', pageIds: block.pageIds });
  const [newPageId, setNewPageId] = useState('');

  if (mode === 'view') {
    if (isLoading) return <div className="row-4"><div className="flex-1 h-20 skeleton" /></div>;
    if (!pages.length) return <p className="text-muted">No pages selected.</p>;
    return <div className="row-4 wrap">{pages.map(page => <PageCard key={page.id} page={page} variant="compact" />)}</div>;
  }

  const addPage = () => { if (newPageId.trim()) { onUpdate?.({ ...block, pageIds: [...block.pageIds, newPageId.trim()] }); setNewPageId(''); } };
  return (
    <div className="stack surface p-4 border-dashed">
      <div className="row text-muted"><FileText size={18} /><span className="font-medium">Curated Page List</span></div>
      {block.pageIds.length > 0 && (
        <div className="stack-2">
          {block.pageIds.map((id, i) => (
            <div key={i} className="row"><span className="flex-1 font-mono text-small truncate">{id}</span><button onClick={() => onUpdate?.({ ...block, pageIds: block.pageIds.filter((_, j) => j !== i) })} className="icon-btn text-muted hover:text-error"><Trash2 size={14} /></button></div>
          ))}
        </div>
      )}
      <div className="row"><input type="text" value={newPageId} onChange={e => setNewPageId(e.target.value)} placeholder="Page ID..." className="flex-1 input" /><Button size="sm" onClick={addPage} disabled={!newPageId.trim()}>Add</Button></div>
      <small>Add page IDs to create a curated list</small>
    </div>
  );
}

// Columns Block (recursive)

function ColumnEditor({ column, onUpdate, onDelete, canDelete }: { column: Column; onUpdate: (col: Column) => void; onDelete: () => void; canDelete: boolean }) {
  const setBlocks = useCallback((blocks: ContentBlock[]) => onUpdate({ ...column, blocks }), [column, onUpdate]);
  const { selectedIndex, setSelectedIndex, update, remove, move, insert } = useBlockOperations(column.blocks, setBlocks, createContentBlock as (type: BlockType) => ContentBlock);

  return (
    <div className="flex-1 min-w-0 stack-2 p-3 bg-surface-1/50 border border-dashed border-border-muted rounded-lg">
      <div className="spread">
        <span className="text-small text-muted uppercase tracking-wide">Column</span>
        {canDelete && <button onClick={onDelete} className="icon-btn p-1 text-muted hover:text-error"><Trash2 size={14} /></button>}
      </div>
      {column.blocks.length === 0 ? (
        <div className="py-6 text-center"><p className="text-muted text-small mb-2">Empty column</p><InsertButton onInsert={insert} compact allowColumns={false} /></div>
      ) : (
        <div className="stack-2">
          {column.blocks.map((block, index) => (
            <BlockWrapper key={block.id} block={block} index={index} total={column.blocks.length} isSelected={selectedIndex === index}
              onSelect={() => setSelectedIndex(index)} onUpdate={b => update(index, b as ContentBlock)} onDelete={() => remove(index)}
              onMoveUp={() => move(index, index - 1)} onMoveDown={() => move(index, index + 1)} compact />
          ))}
          <InsertButton onInsert={insert} compact allowColumns={false} />
        </div>
      )}
    </div>
  );
}

function ColumnsBlockComponent({ block, mode, onUpdate, allContent = [] }: BlockProps<ColumnsBlock>) {
  const [showSettings, setShowSettings] = useState(false);
  const gapClass = { sm: 'gap-2', md: 'gap-4', lg: 'gap-6' }[block.gap || 'md'];
  const alignClass = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' }[block.align || 'start'];

  if (mode === 'view') {
    return (
      <div className={cn('flex flex-col md:flex-row', gapClass, alignClass)}>
        {block.columns.map(col => <div key={col.id} className="flex-1 min-w-0 stack-6">{col.blocks.map(b => <div key={b.id}>{renderBlock(b, 'view', undefined, allContent)}</div>)}</div>)}
      </div>
    );
  }

  const updateColumn = (i: number, col: Column) => onUpdate?.({ ...block, columns: block.columns.map((c, j) => j === i ? col : c) });
  const deleteColumn = (i: number) => block.columns.length > 1 && onUpdate?.({ ...block, columns: block.columns.filter((_, j) => j !== i) });
  const addColumn = () => block.columns.length < 4 && onUpdate?.({ ...block, columns: [...block.columns, createColumn()] });

  return (
    <div className="stack">
      <div className="spread">
        <div className="row text-muted"><Columns size={18} /><span className="font-medium">{block.columns.length} Column Layout</span></div>
        <div className="row">
          <button onClick={() => setShowSettings(!showSettings)} className={cn('icon-btn p-1', showSettings && 'bg-surface-2')}><Settings size={14} /></button>
          {block.columns.length < 4 && <button onClick={addColumn} className="text-accent text-small hover:text-accent-hover">+ Add Column</button>}
        </div>
      </div>
      {showSettings && (
        <div className="row-4 p-3 bg-surface-2 rounded-lg">
          <div className="row"><span className="text-small text-muted">Gap:</span><Selector options={['sm', 'md', 'lg'] as const} value={block.gap || 'md'} onChange={gap => onUpdate?.({ ...block, gap })} /></div>
          <div className="row"><span className="text-small text-muted">Align:</span><Selector options={['start', 'center', 'end', 'stretch'] as const} value={block.align || 'start'} onChange={align => onUpdate?.({ ...block, align })} /></div>
        </div>
      )}
      <div className={cn('flex gap-4', { 'gap-2': block.gap === 'sm', 'gap-6': block.gap === 'lg' })}>
        {block.columns.map((col, i) => <ColumnEditor key={col.id} column={col} onUpdate={c => updateColumn(i, c)} onDelete={() => deleteColumn(i)} canDelete={block.columns.length > 1} />)}
      </div>
    </div>
  );
}

// Block Rendering

function renderBlock(block: Block, mode: 'edit' | 'view', onUpdate?: (b: Block) => void, allContent: BlockContent = []): React.ReactNode {
  const props = { block, mode, onUpdate, allContent } as BlockProps;
  
  switch (block.type) {
    case 'heading': return <HeadingBlock {...props as BlockProps<Extract<Block, { type: 'heading' }>>} />;
    case 'paragraph': return <ParagraphBlock {...props as BlockProps<Extract<Block, { type: 'paragraph' }>>} />;
    case 'media': return <MediaBlockComponent {...props as BlockProps<MediaBlock>} />;
    case 'callout': return <CalloutBlockComponent {...props as BlockProps<Extract<Block, { type: 'callout' }>>} />;
    case 'divider': return <DividerBlock {...props as BlockProps<Extract<Block, { type: 'divider' }>>} />;
    case 'code': return <CodeBlockComponent {...props as BlockProps<Extract<Block, { type: 'code' }>>} />;
    case 'quote': return <QuoteBlockComponent {...props as BlockProps<Extract<Block, { type: 'quote' }>>} />;
    case 'table': return <TableBlockComponent {...props as BlockProps<TableBlock>} />;
    case 'toc': return <TocBlockComponent {...props as BlockProps<TocBlock>} />;
    case 'recentPages': return <RecentPagesBlockComponent {...props as BlockProps<Extract<Block, { type: 'recentPages' }>>} />;
    case 'pageList': return <PageListBlockComponent {...props as BlockProps<Extract<Block, { type: 'pageList' }>>} />;
    case 'columns': return <ColumnsBlockComponent {...props as BlockProps<ColumnsBlock>} />;
    // Legacy support
    case 'image' as BlockType: return <MediaBlockComponent block={{ ...block, type: 'media', mediaType: 'image' } as MediaBlock} mode={mode} onUpdate={onUpdate} />;
    case 'embed' as BlockType: return <MediaBlockComponent block={{ ...block, type: 'media', mediaType: 'embed', src: (block as any).url } as MediaBlock} mode={mode} onUpdate={onUpdate} />;
    case 'list' as BlockType: {
      const { style, items } = block as unknown as { style: string; items: { text: string; checked?: boolean }[] };
      if (style === 'checklist') return <ul className="stack-2">{items.map((item, i) => <li key={i} className="row items-start"><input type="checkbox" checked={item.checked} readOnly className="mt-1 rounded" /><span className={item.checked ? 'line-through text-muted' : ''}>{parseInlineMarkdown(item.text)}</span></li>)}</ul>;
      const Tag = style === 'numbered' ? 'ol' : 'ul';
      return <Tag className={cn('pl-6 stack-2', style === 'numbered' ? 'list-decimal' : 'list-disc')}>{items.map((item, i) => <li key={i}>{parseInlineMarkdown(item.text)}</li>)}</Tag>;
    }
    default: return <p className="text-warning text-small">Unknown block type: {(block as Block).type}</p>;
  }
}

// Block Wrapper (edit mode)

interface BlockWrapperProps {
  block: Block; index: number; total: number; isSelected: boolean;
  onSelect: () => void; onUpdate: (b: Block) => void; onDelete: () => void;
  onDuplicate?: () => void; onMoveUp: () => void; onMoveDown: () => void; compact?: boolean;
}

function BlockWrapper({ block, index, total, isSelected, onSelect, onUpdate, onDelete, onDuplicate, onMoveUp, onMoveDown, compact }: BlockWrapperProps) {
  const reg = BLOCK_REGISTRY[block.type];
  const isColumnsBlock = block.type === 'columns';
  const iconSize = compact ? 12 : 14;

  if (!reg) {
    return (
      <div className={cn('rounded border border-warning/50 bg-warning/10', compact ? 'p-3' : 'p-4 rounded-lg')}>
        <div className="spread mb-2">
          <span className={cn('text-warning', compact ? 'text-small' : 'font-medium')}>Legacy block: {block.type}</span>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className="icon-btn p-1 text-muted hover:text-error"><Trash2 size={iconSize} /></button>
        </div>
        <small className="text-muted">This block type is no longer supported. Delete and recreate.</small>
      </div>
    );
  }

  return (
    <div onClick={onSelect} className={cn('group relative transition-colors',
      compact ? cn('p-3 rounded-md border', isSelected ? 'border-accent bg-accent/5' : 'border-transparent hover:border-border-muted hover:bg-surface-2/50')
        : cn('p-4 rounded-lg border', isSelected ? 'border-accent bg-accent/5' : 'border-border-muted hover:border-border', isColumnsBlock && 'bg-surface-1/30')
    )}>
      <div className={cn('spread', compact ? 'mb-2' : 'mb-3')}>
        <div className="row">
          {!compact && <div className="row opacity-0 group-hover:opacity-100 transition-opacity mr-2"><button className="icon-btn p-1 text-muted cursor-grab"><GripVertical size={16} /></button></div>}
          {!(compact ? false : isColumnsBlock) && <div className="row text-muted">{ICONS[reg.icon]}<span className="text-small font-medium uppercase">{reg.label}</span></div>}
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

// Public Exports

export function BlockEditor({ content, onChange }: { content: BlockContent; onChange: (content: BlockContent) => void }) {
  const { selectedIndex, setSelectedIndex, update, remove, duplicate, move, insert } = useBlockOperations(content, onChange, createBlock);

  if (content.length === 0) {
    return <div className="stack items-center py-12 text-center"><p className="text-muted">No content yet. Add your first block!</p><InsertButton onInsert={insert} /></div>;
  }

  return (
    <div className="stack">
      {content.map((block, index) => (
        <BlockWrapper key={block.id} block={block} index={index} total={content.length} isSelected={selectedIndex === index}
          onSelect={() => setSelectedIndex(index)} onUpdate={b => update(index, b)} onDelete={() => remove(index)}
          onDuplicate={() => duplicate(index)} onMoveUp={() => move(index, index - 1)} onMoveDown={() => move(index, index + 1)} />
      ))}
      <InsertButton onInsert={insert} />
    </div>
  );
}

export function BlockRenderer({ content, className }: { content: BlockContent | unknown; className?: string }) {
  if (!content || !Array.isArray(content)) return null;
  return <div className={cn('stack-6', className)}>{(content as BlockContent).map(block => <div key={block.id}>{renderBlock(block, 'view', undefined, content as BlockContent)}</div>)}</div>;
}

export default BlockEditor;