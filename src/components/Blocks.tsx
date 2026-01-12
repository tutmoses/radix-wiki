// src/components/Blocks.tsx - Unified Block System

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  Plus, GripVertical, Trash2, Copy, ChevronUp, ChevronDown, Type, Image, 
  AlertCircle, Minus, Code, Quote, Clock, FileText, Columns, Settings, Table, ListTree,
  AlertTriangle, CheckCircle, Info
} from 'lucide-react';
import { cn, formatRelativeTime, parseInlineMarkdown, slugify } from '@/lib/utils';
import { findTagByPath } from '@/lib/tags';
import { Button, Input, Badge } from '@/components/ui';
import { 
  type Block, type ContentBlock, type BlockContent, type BlockType, type Column, 
  type ColumnsBlock, type TableBlock, type TocBlock, type MediaBlock, type TextBlock,
  createBlock, createContentBlock, duplicateBlock, createColumn, 
  BLOCK_REGISTRY, INSERTABLE_BLOCKS, CONTENT_BLOCK_TYPES 
} from '@/lib/blocks';
import type { WikiPage } from '@/types';

// Icons map
const ICONS: Record<string, React.ReactNode> = {
  Type: <Type size={18} />, Image: <Image size={18} />,
  AlertCircle: <AlertCircle size={18} />, Minus: <Minus size={18} />, Code: <Code size={18} />,
  Quote: <Quote size={18} />, Clock: <Clock size={18} />, FileText: <FileText size={18} />,
  Columns: <Columns size={18} />, Table: <Table size={18} />, ListTree: <ListTree size={18} />,
};

const CALLOUT_STYLES = {
  info: { cls: 'callout-info', Icon: Info, iconCls: 'status-info' },
  warning: { cls: 'callout-warning', Icon: AlertTriangle, iconCls: 'status-warning' },
  success: { cls: 'callout-success', Icon: CheckCircle, iconCls: 'status-success' },
  error: { cls: 'callout-error', Icon: AlertCircle, iconCls: 'status-error' },
} as const;

// List parsing for paragraphs
const LIST_ITEM_REGEX = /^[\s]*[-*Ã¢â‚¬Â¢Ã¢â€”Â¦Ã¢â€”â€¹Ã¢â€“ÂªÃ¢â€“Â¸Ã¢â€“Âº]\s+(.+)$/;

// Auto-resize textarea hook
function useAutoResize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  
  return ref;
}

// Reusable rich paste hook for text blocks
function useRichPaste(
  text: string,
  onUpdate: (newText: string) => void,
  options: { preserveHtml?: boolean } = { preserveHtml: true }
) {
  const autoResizeRef = useAutoResize(text);

  const htmlToMarkdown = useCallback((html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    
    const processNode = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
      if (node.nodeType !== Node.ELEMENT_NODE) return '';
      
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      const children = Array.from(el.childNodes).map(processNode).join('');
      
      switch (tag) {
        case 'a': {
          const href = el.getAttribute('href');
          return href ? `[${children}](${href})` : children;
        }
        case 'strong': case 'b': return `**${children}**`;
        case 'em': case 'i': return `*${children}*`;
        case 'code': return `\`${children}\``;
        case 'br': return '\n';
        case 'p': return children.trim() + '\n\n';
        case 'div': return children + '\n';
        case 'li': return `- ${children}\n`;
        case 'ul': case 'ol': return children + '\n';
        case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': case 'h6': 
          return children.trim() + '\n\n';
        default: return children;
      }
    };
    
    return processNode(doc.body).replace(/\n{3,}/g, '\n\n').trim();
  }, []);

  const normalizeListBullets = useCallback((content: string): string => {
    return content.split('\n').map(line => {
      const indentMatch = line.match(/^(\s*)/);
      const indent = indentMatch ? indentMatch[1] : '';
      return line
        .replace(/^(\s*)[-*Ã¢â‚¬Â¢Ã¢â€”Â¦Ã¢â€”â€¹Ã¢â€“ÂªÃ¢â€“Â¸Ã¢â€“Âº]\s+/, `${indent}- `)
        .replace(/^(\s*)\d+[.)]\s+/, `${indent}- `);
    }).join('\n');
  }, []);

  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const { selectionStart: start, selectionEnd: end } = e.currentTarget;
    const htmlData = e.clipboardData.getData('text/html');
    const plainText = e.clipboardData.getData('text');
    
    // HTML content - convert to markdown
    if (options.preserveHtml && htmlData) {
      e.preventDefault();
      const processed = normalizeListBullets(htmlToMarkdown(htmlData));
      onUpdate(text.slice(0, start) + processed + text.slice(end));
      setTimeout(() => { if (autoResizeRef.current) autoResizeRef.current.selectionStart = autoResizeRef.current.selectionEnd = start + processed.length; }, 0);
      return;
    }
    
    const trimmed = plainText.trim();
    
    // Single URL - wrap selection or create link
    if (/^https?:\/\/[^\s]+$/.test(trimmed)) {
      e.preventDefault();
      const selectedText = text.slice(start, end);
      const linkText = selectedText || new URL(trimmed).hostname.replace(/^www\./, '');
      const markdownLink = `[${linkText}](${trimmed})`;
      onUpdate(text.slice(0, start) + markdownLink + text.slice(end));
      setTimeout(() => { if (autoResizeRef.current) autoResizeRef.current.selectionStart = autoResizeRef.current.selectionEnd = start + markdownLink.length; }, 0);
      return;
    }
    
    // Check for lists or bare URLs
    const listPattern = /^[\s]*[-*Ã¢â‚¬Â¢Ã¢â€”Â¦Ã¢â€”â€¹Ã¢â€“ÂªÃ¢â€“Â¸Ã¢â€“Âº]\s+|^[\s]*\d+[.)]\s+/m;
    const hasLists = listPattern.test(plainText);
    const bareUrlPattern = /(?<!\]\()https?:\/\/[^\s\])<>]+/g;
    const hasBareUrls = bareUrlPattern.test(plainText);
    
    if (hasLists || hasBareUrls) {
      e.preventDefault();
      let processed = plainText;
      
      if (hasLists) processed = normalizeListBullets(processed);
      
      if (hasBareUrls) {
        processed = processed.replace(/(?<!\]\()https?:\/\/[^\s\])<>]+/g, url => {
          try {
            const cleanUrl = url.replace(/[.,;:!?)]+$/, '');
            const hostname = new URL(cleanUrl).hostname.replace(/^www\./, '');
            return `[${hostname}](${cleanUrl})${url.slice(cleanUrl.length)}`;
          } catch { return url; }
        });
      }
      
      onUpdate(text.slice(0, start) + processed + text.slice(end));
      setTimeout(() => { if (autoResizeRef.current) autoResizeRef.current.selectionStart = autoResizeRef.current.selectionEnd = start + processed.length; }, 0);
    }
  }, [text, onUpdate, htmlToMarkdown, normalizeListBullets, options.preserveHtml, autoResizeRef]);

  return { ref: autoResizeRef, handlePaste };
}

function parseParagraphContent(text: string): React.ReactNode {
  // Split by double newlines to get paragraphs
  const paragraphs = text.split(/\n\n+/);
  
  const renderParagraph = (para: string, paraKey: number): React.ReactNode => {
    const lines = para.split('\n');
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
          elements.push(<span key={key++}>{parseInlineMarkdown(line)}</span>);
          // Add line break for single newlines within a paragraph
          elements.push(<br key={key++} />);
        }
      }
    }
    flushList();
    // Remove trailing br
    while (elements.length && (elements.at(-1) as React.ReactElement)?.type === 'br') elements.pop();
    
    return <div key={paraKey} className={paraKey > 0 ? 'mt-4' : ''}>{elements}</div>;
  };

  if (paragraphs.length === 1) {
    return renderParagraph(paragraphs[0], 0);
  }

  return <>{paragraphs.filter(p => p.trim()).map((para, i) => renderParagraph(para, i))}</>;
}

// Shared Hooks
function usePages(mode: { type: 'recent'; tagPath?: string; limit: number } | { type: 'byIds'; pageIds: string[] }) {
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

function extractHeadings(content: BlockContent, maxDepth = 3): { text: string; level: number }[] {
  const headings: { text: string; level: number }[] = [];
  const headingRegex = /^(#{1,3})\s+(.+)$/gm;
  
  const process = (blocks: Block[]) => {
    for (const block of blocks) {
      if (block.type === 'text' && block.text.trim()) {
        let match;
        while ((match = headingRegex.exec(block.text)) !== null) {
          const level = match[1].length;
          if (level <= maxDepth) {
            headings.push({ text: match[2].trim(), level });
          }
        }
        headingRegex.lastIndex = 0;
      } else if (block.type === 'columns') {
        block.columns.forEach(col => process(col.blocks));
      }
    }
  };
  process(content);
  return headings;
}

// Selector component for options
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

// Insert Block Menu
function InsertBlockMenu({ onInsert, onClose, blockTypes }: { onInsert: (type: BlockType) => void; onClose: () => void; blockTypes: readonly BlockType[] }) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
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

// Block Props type
type BlockProps<T extends Block = Block> = { block: T; mode: 'edit' | 'view'; onUpdate?: (b: Block) => void; allContent?: BlockContent };

// Parse rich text with headings and paragraphs
function parseRichText(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let currentParagraph: string[] = [];
  let key = 0;

  const flushParagraph = () => {
    if (currentParagraph.length === 0) return;
    const paraText = currentParagraph.join('\n');
    elements.push(
      <div key={key++} className="paragraph">
        {parseParagraphContent(paraText)}
      </div>
    );
    currentParagraph = [];
  };

  for (const line of lines) {
    const h1Match = line.match(/^#\s+(.+)$/);
    const h2Match = line.match(/^##\s+(.+)$/);
    const h3Match = line.match(/^###\s+(.+)$/);

    if (h3Match) {
      flushParagraph();
      elements.push(<h3 key={key++} id={slugify(h3Match[1])}>{h3Match[1]}</h3>);
    } else if (h2Match) {
      flushParagraph();
      elements.push(<h2 key={key++} id={slugify(h2Match[1])}>{h2Match[1]}</h2>);
    } else if (h1Match) {
      flushParagraph();
      elements.push(<h1 key={key++} id={slugify(h1Match[1])}>{h1Match[1]}</h1>);
    } else if (line.trim() === '') {
      flushParagraph();
    } else {
      currentParagraph.push(line);
    }
  }
  flushParagraph();

  return elements.length > 0 ? <div className="stack-4">{elements}</div> : null;
}

// Block Renderers - View Mode
const ViewRenderers: Record<string, (block: Block, allContent: BlockContent) => React.ReactNode> = {
  text: (b) => {
    const t = b as TextBlock;
    return parseRichText(t.text);
  },
  divider: () => <hr />,
  quote: (b) => { const q = b as Extract<Block, {type:'quote'}>; return <blockquote><p>{parseInlineMarkdown(q.text)}</p>{q.attribution && <cite className="block mt-2">Ã¢â‚¬â€ {q.attribution}</cite>}</blockquote>; },
  callout: (b) => {
    const c = b as Extract<Block, {type:'callout'}>;
    const { cls, Icon, iconCls } = CALLOUT_STYLES[c.variant];
    return <div className={cn('callout', cls)}><Icon size={20} className={cn('shrink-0 mt-0.5', iconCls)} /><div className="stack-2">{c.title && <strong>{c.title}</strong>}<p>{parseInlineMarkdown(c.text)}</p></div></div>;
  },
  code: (b) => { const c = b as Extract<Block, {type:'code'}>; return <div className="relative">{c.language && <small className="absolute top-2 right-2">{c.language}</small>}<pre><code>{c.code}</code></pre></div>; },
  media: (b) => {
    const m = b as MediaBlock;
    if (!m.src) return null;
    const getEmbedUrl = (url: string) => {
      const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
      if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
      const vm = url.match(/vimeo\.com\/(\d+)/);
      if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
      return url;
    };
    const aspectClass = { '16:9': 'aspect-video', '4:3': 'aspect-[4/3]', '1:1': 'aspect-square', auto: '' }[m.aspectRatio || '16:9'];
    const content = m.mediaType === 'image' ? <img src={m.src} alt={m.alt || ''} className="rounded-lg max-w-full" />
      : m.mediaType === 'video' ? <video src={m.src} className="rounded-lg max-w-full" controls />
      : <div className={cn('w-full rounded-lg overflow-hidden surface', aspectClass)}><iframe src={getEmbedUrl(m.src)} className="w-full h-full border-0" allowFullScreen /></div>;
    return <figure className="stack-2">{content}{m.caption && <figcaption className="text-muted text-center">{m.caption}</figcaption>}</figure>;
  },
  table: (b) => {
    const t = b as TableBlock;
    if (!t.rows.length) return null;
    const [headerRow, bodyRows] = t.hasHeader ? [t.rows[0], t.rows.slice(1)] : [null, t.rows];
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          {headerRow && <thead><tr>{headerRow.cells.map((cell, i) => <th key={i} className="text-left p-2 border-b-2 border-border font-semibold bg-surface-1">{parseInlineMarkdown(cell)}</th>)}</tr></thead>}
          <tbody>{bodyRows.map((row, i) => <tr key={i} className="border-b border-border-muted hover:bg-surface-1/50">{row.cells.map((cell, j) => <td key={j} className="p-2">{parseInlineMarkdown(cell)}</td>)}</tr>)}</tbody>
        </table>
      </div>
    );
  },
  toc: (b, allContent) => {
    const t = b as TocBlock;
    const headings = extractHeadings(allContent, t.maxDepth || 3);
    if (!headings.length) return <p className="text-muted text-small">No headings found.</p>;
    return (
      <nav className="stack-2">
        {t.title && <h4 className="font-semibold">{t.title}</h4>}
        <ul className="stack-1">{headings.map((h, i) => <li key={i} style={{ paddingLeft: `${(h.level - 1) * 0.75}rem` }}><a href={`#${slugify(h.text)}`} className="link-muted text-small hover:text-accent">{h.text}</a></li>)}</ul>
      </nav>
    );
  },
  columns: (b, allContent) => {
    const c = b as ColumnsBlock;
    const gapClass = { sm: 'gap-2', md: 'gap-4', lg: 'gap-6' }[c.gap || 'md'];
    const alignClass = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch' }[c.align || 'start'];
    return (
      <div className={cn('flex flex-col md:flex-row', gapClass, alignClass)}>
        {c.columns.map(col => <div key={col.id} className="flex-1 min-w-0 stack-6">{col.blocks.map(bl => <div key={bl.id}>{renderBlock(bl, 'view', undefined, allContent)}</div>)}</div>)}
      </div>
    );
  },
};

// Page cards for recentPages/pageList
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

// Dynamic page blocks (need hooks)
function RecentPagesView({ block }: { block: Extract<Block, {type:'recentPages'}> }) {
  const { pages, isLoading } = usePages({ type: 'recent', tagPath: block.tagPath, limit: block.limit });
  if (isLoading) return <div className="row-4 wrap">{Array.from({ length: Math.min(block.limit, 3) }, (_, i) => <div key={i} className="flex-1 h-32 skeleton" />)}</div>;
  if (!pages.length) return <p className="text-muted">No pages found.</p>;
  return <div className="row-4 wrap">{pages.map(p => <PageCard key={p.id} page={p} variant="full" />)}</div>;
}

function PageListView({ block }: { block: Extract<Block, {type:'pageList'}> }) {
  const { pages, isLoading } = usePages({ type: 'byIds', pageIds: block.pageIds });
  if (isLoading) return <div className="row-4"><div className="flex-1 h-20 skeleton" /></div>;
  if (!pages.length) return <p className="text-muted">No pages selected.</p>;
  return <div className="row-4 wrap">{pages.map(p => <PageCard key={p.id} page={p} variant="compact" />)}</div>;
}

// Edit mode components

// Combined Text Block Editor (supports markdown headings and rich text)
function TextEdit({ block, onUpdate }: BlockProps<TextBlock>) {
  const { ref, handlePaste } = useRichPaste(block.text, text => onUpdate?.({ ...block, text }));

  return (
    <div className="stack-2">
      <textarea
        ref={ref}
        value={block.text}
        onChange={e => onUpdate?.({ ...block, text: e.target.value })}
        onPaste={handlePaste}
        placeholder="Write content... Use # for H1, ## for H2, ### for H3"
        className="input-ghost resize-none overflow-hidden min-h-20"
        rows={3}
      />
      <small>Supports: # H1, ## H2, ### H3, **bold**, *italic*, `code`, [link](url), - list items</small>
    </div>
  );
}

function MediaEdit({ block, onUpdate }: BlockProps<MediaBlock>) {
  const detectMediaType = (url: string): 'image' | 'video' | 'embed' => {
    try {
      const pathname = new URL(url).pathname;
      if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(pathname)) return 'image';
      if (/\.(mp4|webm|ogg)$/i.test(pathname)) return 'video';
    } catch {
      if (/\.(jpg|jpeg|png|gif|webp|svg)/i.test(url)) return 'image';
      if (/\.(mp4|webm|ogg)/i.test(url)) return 'video';
    }
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
    </div>
  );
}

function CalloutEdit({ block, onUpdate }: BlockProps<Extract<Block, {type:'callout'}>>) {
  const { ref, handlePaste } = useRichPaste(block.text, text => onUpdate?.({ ...block, text }));
  return (
    <div className="stack">
      <Selector options={['info', 'warning', 'success', 'error'] as const} value={block.variant} onChange={variant => onUpdate?.({ ...block, variant })} />
      <Input label="Title (optional)" value={block.title || ''} onChange={e => onUpdate?.({ ...block, title: e.target.value })} placeholder="Callout title..." />
      <textarea ref={ref} value={block.text} onChange={e => onUpdate?.({ ...block, text: e.target.value })} onPaste={handlePaste} placeholder="Callout content..." className="input min-h-15 resize-none" rows={2} />
    </div>
  );
}

function CodeEdit({ block, onUpdate }: BlockProps<Extract<Block, {type:'code'}>>) {
  const languages = ['typescript', 'javascript', 'python', 'rust', 'sql', 'bash', 'json', 'css', 'html'];
  return (
    <div className="stack">
      <div className="row wrap">
        {languages.map(lang => (
          <button key={lang} onClick={() => onUpdate?.({ ...block, language: lang })}
            className={cn('px-2 py-1 text-small rounded border', block.language === lang ? 'bg-accent text-text-inverted border-accent' : 'border-border hover:bg-surface-2')}>{lang}</button>
        ))}
      </div>
      <textarea value={block.code} onChange={e => onUpdate?.({ ...block, code: e.target.value })} placeholder="// Enter code..." className="input min-h-30 resize-none font-mono" rows={6} spellCheck={false} />
    </div>
  );
}

function QuoteEdit({ block, onUpdate }: BlockProps<Extract<Block, {type:'quote'}>>) {
  const { ref, handlePaste } = useRichPaste(block.text, text => onUpdate?.({ ...block, text }));
  return (
    <div className="stack border-l-4 border-accent pl-4">
      <textarea ref={ref} value={block.text} onChange={e => onUpdate?.({ ...block, text: e.target.value })} onPaste={handlePaste} placeholder="Quote text..." className="input-ghost min-h-15 italic resize-none" rows={2} />
      <Input label="Attribution (optional)" value={block.attribution || ''} onChange={e => onUpdate?.({ ...block, attribution: e.target.value })} placeholder="Ã¢â‚¬â€ Author name" />
    </div>
  );
}

function TableEdit({ block, onUpdate }: BlockProps<TableBlock>) {
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
        {block.rows[0]?.cells.length > 1 && <button onClick={() => deleteColumn(block.rows[0].cells.length - 1)} className="text-muted text-small hover:text-error">Ã¢Ë†â€™ Remove column</button>}
      </div>
    </div>
  );
}

function TocEdit({ block, onUpdate }: BlockProps<TocBlock>) {
  return (
    <div className="stack surface p-4 border-dashed">
      <div className="row text-muted"><ListTree size={18} /><span className="font-medium">Table of Contents</span></div>
      <Input label="Title (optional)" value={block.title || ''} onChange={e => onUpdate?.({ ...block, title: e.target.value || undefined })} placeholder="Contents" />
      <div className="row"><span>Max heading depth:</span><Selector options={['1', '2', '3'] as const} value={String(block.maxDepth || 3)} onChange={v => onUpdate?.({ ...block, maxDepth: parseInt(v) as 1 | 2 | 3 })} /></div>
      <small className="text-muted">Automatically generates from page headings (H1, H2, H3)</small>
    </div>
  );
}

function RecentPagesEdit({ block, onUpdate }: BlockProps<Extract<Block, {type:'recentPages'}>>) {
  return (
    <div className="stack surface p-4 border-dashed">
      <div className="row text-muted"><Clock size={18} /><span className="font-medium">Recent Pages Widget</span></div>
      <Input label="Filter by category (optional)" value={block.tagPath || ''} onChange={e => onUpdate?.({ ...block, tagPath: e.target.value || undefined })} placeholder="e.g., contents/tech" hint="Leave empty to show all recent pages" />
      <div className="row"><span>Show</span><input type="number" min={1} max={20} value={block.limit} onChange={e => onUpdate?.({ ...block, limit: parseInt(e.target.value) || 5 })} className="input w-16 text-center" /><span>pages</span></div>
    </div>
  );
}

function PageListEdit({ block, onUpdate }: BlockProps<Extract<Block, {type:'pageList'}>>) {
  const [newPageId, setNewPageId] = useState('');
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

// Column Editor
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

function ColumnsEdit({ block, onUpdate }: BlockProps<ColumnsBlock>) {
  const [showSettings, setShowSettings] = useState(false);
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

// Unified block renderer
function renderBlock(block: Block, mode: 'edit' | 'view', onUpdate?: (b: Block) => void, allContent: BlockContent = []): React.ReactNode {
  if (mode === 'view') {
    // Dynamic blocks need hooks
    if (block.type === 'recentPages') return <RecentPagesView block={block} />;
    if (block.type === 'pageList') return <PageListView block={block} />;
    return ViewRenderers[block.type]?.(block, allContent) ?? <p className="text-warning text-small">Unknown block: {block.type}</p>;
  }

  // Edit mode
  switch (block.type) {
    case 'text': return <TextEdit block={block} mode="edit" onUpdate={onUpdate} />;
    case 'media': return <MediaEdit block={block} mode="edit" onUpdate={onUpdate} />;
    case 'callout': return <CalloutEdit block={block} mode="edit" onUpdate={onUpdate} />;
    case 'divider': return <div className="py-2"><hr /><small className="block text-center mt-2">Horizontal divider</small></div>;
    case 'code': return <CodeEdit block={block} mode="edit" onUpdate={onUpdate} />;
    case 'quote': return <QuoteEdit block={block} mode="edit" onUpdate={onUpdate} />;
    case 'table': return <TableEdit block={block} mode="edit" onUpdate={onUpdate} />;
    case 'toc': return <TocEdit block={block} mode="edit" onUpdate={onUpdate} />;
    case 'recentPages': return <RecentPagesEdit block={block} mode="edit" onUpdate={onUpdate} />;
    case 'pageList': return <PageListEdit block={block} mode="edit" onUpdate={onUpdate} />;
    case 'columns': return <ColumnsEdit block={block} mode="edit" onUpdate={onUpdate} />;
    default: return <p className="text-warning text-small">Unknown block: {(block as Block).type}</p>;
  }
}

// Block Wrapper
interface BlockWrapperProps {
  block: Block; index: number; total: number; isSelected: boolean;
  onSelect: () => void; onUpdate: (b: Block) => void; onDelete: () => void;
  onDuplicate?: () => void; onMoveUp: () => void; onMoveDown: () => void; compact?: boolean;
}

function BlockWrapper({ block, index, total, isSelected, onSelect, onUpdate, onDelete, onDuplicate, onMoveUp, onMoveDown, compact }: BlockWrapperProps) {
  const reg = BLOCK_REGISTRY[block.type];
  const iconSize = compact ? 12 : 14;

  if (!reg) {
    return (
      <div className={cn('rounded border border-warning/50 bg-warning/10', compact ? 'p-3' : 'p-4 rounded-lg')}>
        <div className="spread mb-2">
          <span className={cn('text-warning', compact ? 'text-small' : 'font-medium')}>Unknown block: {block.type}</span>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className="icon-btn p-1 text-muted hover:text-error"><Trash2 size={iconSize} /></button>
        </div>
      </div>
    );
  }

  return (
    <div onClick={onSelect} className={cn('group relative transition-colors',
      compact ? cn('p-3 rounded-md border', isSelected ? 'border-accent bg-accent/5' : 'border-transparent hover:border-border-muted hover:bg-surface-2/50')
        : cn('p-4 rounded-lg border', isSelected ? 'border-accent bg-accent/5' : 'border-border-muted hover:border-border', block.type === 'columns' && 'bg-surface-1/30')
    )}>
      <div className={cn('spread', compact ? 'mb-2' : 'mb-3')}>
        <div className="row">
          {!compact && <div className="row opacity-0 group-hover:opacity-100 transition-opacity mr-2"><button className="icon-btn p-1 text-muted cursor-grab"><GripVertical size={16} /></button></div>}
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