// src/components/Blocks.tsx - Unified Block System with Tiptap (HTML-based)

'use client';

import { useState, useCallback, useRef, useEffect, type FC } from 'react';
import Link from 'next/link';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import {
  Plus, Trash2, Copy, ChevronUp, ChevronDown, Type, Image,
  AlertCircle, Minus, Code, Quote, Clock, FileText, Columns, Settings, Table, ListTree, Info,
  Bold, Italic, Link2, Heading2, Heading3, List, TrendingUp
} from 'lucide-react';
import { cn, formatRelativeTime, slugify } from '@/lib/utils';
import { findTagByPath } from '@/lib/tags';
import { usePages } from '@/hooks';
import { Button, Input, Badge } from '@/components/ui';
import {
  type Block, type ContentBlock, type BlockType, type Column,
  type ColumnsBlock, type TableBlock, type TocBlock, type MediaBlock, type TextBlock, type AssetPriceBlock,
  createBlock, duplicateBlock, createColumn, INSERTABLE_BLOCKS, CONTENT_BLOCK_TYPES
} from '@/lib/blocks';
import type { WikiPage } from '@/types';

type BlockContent = Block[];

const ICONS: Record<string, React.ReactNode> = {
  Type: <Type size={18} />, Image: <Image size={18} />, AlertCircle: <AlertCircle size={18} />,
  Minus: <Minus size={18} />, Code: <Code size={18} />, Quote: <Quote size={18} />,
  Clock: <Clock size={18} />, FileText: <FileText size={18} />, Columns: <Columns size={18} />,
  Table: <Table size={18} />, ListTree: <ListTree size={18} />, TrendingUp: <TrendingUp size={18} />,
};

// ========== HTML PROCESSING ==========
interface ProcessedHtml {
  html: string;
  headings: { text: string; level: number; id: string }[];
}

function processHtml(html: string): ProcessedHtml {
  if (!html.trim()) return { html: '', headings: [] };
  
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const headings: ProcessedHtml['headings'] = [];
  
  doc.querySelectorAll('h1, h2, h3').forEach(el => {
    const text = el.textContent?.trim() || '';
    const id = slugify(text);
    el.id = id;
    headings.push({ text, level: parseInt(el.tagName[1]), id });
  });
  
  doc.querySelectorAll('a[href]').forEach(el => {
    const href = el.getAttribute('href') || '';
    el.classList.add('link');
    if (href.startsWith('http')) {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  });
  
  return { html: doc.body.innerHTML, headings };
}

function HtmlContent({ html, className }: { html: string; className?: string }) {
  const { html: processed } = processHtml(html);
  if (!processed) return null;
  return <div className={className} dangerouslySetInnerHTML={{ __html: processed }} />;
}

export function InlineHtml({ children }: { children: string }) {
  const stripped = children.replace(/<\/?p>/g, '');
  return <span dangerouslySetInnerHTML={{ __html: stripped }} />;
}

// Legacy alias for compatibility
export const InlineMarkdown = InlineHtml;

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
    { action: () => editor.chain().focus().toggleCode().run(), isActive: editor.isActive('code'), icon: <Code size={14} />, label: 'Code' },
    { action: () => { const url = window.prompt('URL'); if (url) editor.chain().focus().setLink({ href: url }).run(); }, isActive: editor.isActive('link'), icon: <Link2 size={14} />, label: 'Link' },
    { action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), isActive: editor.isActive('heading', { level: 2 }), icon: <Heading2 size={14} />, label: 'H2' },
    { action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(), isActive: editor.isActive('heading', { level: 3 }), icon: <Heading3 size={14} />, label: 'H3' },
    { action: () => editor.chain().focus().toggleBulletList().run(), isActive: editor.isActive('bulletList'), icon: <List size={14} />, label: 'List' },
  ];

  return (
    <div className="flex flex-wrap gap-0.5 p-1 bg-surface-1 border border-border-muted rounded-md mb-2">
      {buttons.map(({ action, isActive, icon, label }) => (
        <button key={label} type="button" onClick={action} className={cn('p-1.5 rounded transition-colors', isActive ? 'bg-accent text-text-inverted' : 'text-muted hover:bg-surface-2 hover:text-text')} title={label}>{icon}</button>
      ))}
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
        codeBlock: false,
        hardBreak: singleLine ? false : undefined,
      }),
      TiptapLink.configure({ openOnClick: false, HTMLAttributes: { class: 'link' } }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    editorProps: {
      attributes: { class: cn('outline-none focus:outline-none', singleLine ? '' : 'prose prose-invert min-h-20') },
      handleKeyDown: singleLine ? (_, event) => { if (event.key === 'Enter') return true; return false; } : undefined,
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

// Extract headings from all blocks
function extractHeadings(content: BlockContent, maxDepth = 3) {
  const headings: { text: string; level: number; id: string }[] = [];

  const processBlocks = (blocks: Block[]) => {
    for (const block of blocks) {
      if (block.type === 'text') {
        headings.push(...processHtml(block.text).headings.filter(h => h.level <= maxDepth));
      } else if (block.type === 'columns') {
        block.columns.forEach(c => processBlocks(c.blocks));
      }
    }
  };

  processBlocks(content);
  return headings;
}

// Block component props
type BlockProps<T extends Block = Block> = { block: T; onUpdate?: (b: Block) => void; allContent?: BlockContent };

// ========== VIEW COMPONENTS ==========
const TextView: FC<BlockProps<TextBlock>> = ({ block }) => <HtmlContent html={block.text} />;
const DividerView: FC<BlockProps> = () => <hr />;
const QuoteView: FC<BlockProps<Extract<Block, {type:'quote'}>>> = ({ block }) => <blockquote><HtmlContent html={block.text} />{block.attribution && <cite className="block mt-2 not-italic text-muted">ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â {block.attribution}</cite>}</blockquote>;
const CalloutView: FC<BlockProps<Extract<Block, {type:'callout'}>>> = ({ block }) => <div className="callout"><Info size={20} className="shrink-0 mt-0.5 text-info" /><div className="stack-sm flex-1 min-w-0">{block.title && <strong>{block.title}</strong>}<HtmlContent html={block.text} /></div></div>;
const CodeView: FC<BlockProps<Extract<Block, {type:'code'}>>> = ({ block }) => <div className="relative">{block.language && <small className="absolute top-2 right-2">{block.language}</small>}<pre><code>{block.code}</code></pre></div>;

const MediaView: FC<BlockProps<MediaBlock>> = ({ block }) => {
  if (!block.src) return null;
  const getEmbedUrl = (url: string) => {
    const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&]+)/);
    if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
    const vm = url.match(/vimeo\.com\/(\d+)/);
    return vm ? `https://player.vimeo.com/video/${vm[1]}` : url;
  };
  const content = block.mediaType === 'image' ? <img src={block.src} alt={block.alt || ''} className="rounded-lg max-w-full" />
    : block.mediaType === 'video' ? <video src={block.src} className="rounded-lg max-w-full" controls />
    : <div className="w-full aspect-video rounded-lg overflow-hidden surface"><iframe src={getEmbedUrl(block.src)} className="w-full h-full border-0" allowFullScreen /></div>;
  return <figure className="stack-sm">{content}{block.caption && <figcaption className="text-muted text-center"><InlineHtml>{block.caption}</InlineHtml></figcaption>}</figure>;
};

const TableView: FC<BlockProps<TableBlock>> = ({ block }) => {
  if (!block.rows.length) return null;
  const [headerRow, bodyRows] = block.hasHeader ? [block.rows[0], block.rows.slice(1)] : [null, block.rows];
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        {headerRow && <thead><tr>{headerRow.cells.map((cell, i) => <th key={i} className="text-left p-2 font-semibold bg-surface-1"><InlineHtml>{cell}</InlineHtml></th>)}</tr></thead>}
        <tbody>{bodyRows.map((row, ri) => {
          const isFirst = ri === 0;
          const isLast = ri === bodyRows.length - 1;
          const needsTopRadius = !headerRow && isFirst;
          return (
            <tr key={ri} className={cn('hover:bg-surface-1/50', !isLast && 'border-b border-border-muted')}>
              {row.cells.map((cell, ci) => {
                const isFirstCell = ci === 0;
                const isLastCell = ci === row.cells.length - 1;
                return (
                  <td key={ci} className={cn('p-2',
                    needsTopRadius && isFirstCell && 'rounded-tl-(--radius)',
                    needsTopRadius && isLastCell && 'rounded-tr-(--radius)'
                  )}><InlineHtml>{cell}</InlineHtml></td>
                );
              })}
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
};

const TocView: FC<BlockProps<TocBlock>> = ({ block, allContent = [] }) => {
  const headings = extractHeadings(allContent, block.maxDepth || 3);
  if (!headings.length) return <p className="text-muted text-small">No headings found.</p>;
  return (
    <nav className="stack-sm">
      {block.title && <h4 className="font-semibold">{block.title}</h4>}
      <ul className="stack-xs">{headings.map((h, i) => <li key={i} style={{ paddingLeft: `${(h.level - 1) * 0.75}rem` }}><a href={`#${h.id}`} className="link text-small">{h.text}</a></li>)}</ul>
    </nav>
  );
};

function PageCard({ page, variant }: { page: WikiPage; variant: 'full' | 'compact' }) {
  const leafTag = findTagByPath(page.tagPath.split('/'));
  const href = `/${page.tagPath}/${page.slug}`;
  if (variant === 'compact') return <Link href={href} className="group row p-3 surface hover:bg-surface-2 transition-colors"><FileText size={16} className="text-accent" /><span className="group-hover:text-accent transition-colors">{page.title}</span></Link>;
  return (
    <Link href={href} className="flex-1 min-w-70 max-w-[calc(33.333%-1rem)] group">
      <div className="row items-start gap-3 p-4 surface-interactive h-full">
        <FileText size={18} className="text-accent shrink-0 mt-0.5" />
        <div className="stack-sm min-w-0">
          <span className="font-medium group-hover:text-accent transition-colors truncate">{page.title}</span>
          {page.excerpt && <p className="text-muted line-clamp-2">{page.excerpt}</p>}
          <div className="row mt-auto pt-2"><small className="row"><Clock size={12} />{formatRelativeTime(page.updatedAt)}</small>{leafTag && <Badge variant="secondary">{leafTag.name}</Badge>}</div>
        </div>
      </div>
    </Link>
  );
}

const RecentPagesView: FC<BlockProps<Extract<Block, {type:'recentPages'}>>> = ({ block }) => {
  const { pages, isLoading } = usePages({ type: 'recent', tagPath: block.tagPath, limit: block.limit });
  if (isLoading) return <div className="row-md wrap">{Array.from({ length: Math.min(block.limit, 3) }, (_, i) => <div key={i} className="flex-1 h-32 skeleton" />)}</div>;
  if (!pages.length) return <p className="text-muted">No pages found.</p>;
  return <div className="row-md wrap">{pages.map(p => <PageCard key={p.id} page={p} variant="full" />)}</div>;
};

const PageListView: FC<BlockProps<Extract<Block, {type:'pageList'}>>> = ({ block }) => {
  const { pages, isLoading } = usePages({ type: 'byIds', pageIds: block.pageIds });
  if (isLoading) return <div className="row-md"><div className="flex-1 h-20 skeleton" /></div>;
  if (!pages.length) return <p className="text-muted">No pages selected.</p>;
  return <div className="row-md wrap">{pages.map(p => <PageCard key={p.id} page={p} variant="compact" />)}</div>;
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
      }
      finally { setIsLoading(false); }
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
  const priceStr = data.price < 0.01 
    ? data.price.toFixed(6) 
    : data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 });

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
const TextEdit: FC<BlockProps<TextBlock>> = ({ block, onUpdate }) => (
  <RichTextEditor value={block.text} onChange={text => onUpdate?.({ ...block, text })} placeholder="Write content..." />
);

const DividerEdit: FC<BlockProps> = () => <div className="py-2"><hr /><small className="block text-center mt-2">Horizontal divider</small></div>;

const MediaEdit: FC<BlockProps<MediaBlock>> = ({ block, onUpdate }) => {
  const detectMediaType = (url: string): 'image' | 'video' | 'embed' => {
    try { const p = new URL(url).pathname; if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(p)) return 'image'; if (/\.(mp4|webm|ogg)$/i.test(p)) return 'video'; } catch {}
    return 'embed';
  };
  const mediaTypes = ['image', 'video', 'embed'] as const;
  return (
    <div className="stack">
      <div className="row"><span className="text-small text-muted">Type:</span><div className="row wrap">{mediaTypes.map(opt => <button key={opt} onClick={() => onUpdate?.({ ...block, mediaType: opt })} className={cn('px-3 py-1 rounded-md border capitalize', block.mediaType === opt ? 'bg-accent text-text-inverted border-accent' : 'border-border hover:bg-surface-2')}>{opt}</button>)}</div></div>
      <Input label={{ image: 'Image URL', video: 'Video URL', embed: 'Embed URL' }[block.mediaType]} type="url" value={block.src} onChange={e => onUpdate?.({ ...block, src: e.target.value, mediaType: detectMediaType(e.target.value) })} placeholder="https://..." />
      {block.mediaType === 'image' && <Input label="Alt text" value={block.alt || ''} onChange={e => onUpdate?.({ ...block, alt: e.target.value })} placeholder="Describe the image..." />}
      <div className="stack-sm">
        <label className="font-medium">Caption (optional)</label>
        <RichTextEditor value={block.caption || ''} onChange={caption => onUpdate?.({ ...block, caption })} placeholder="Add a caption..." showToolbar={false} singleLine />
      </div>
      {block.src && block.mediaType === 'image' && <img src={block.src} alt={block.alt || ''} className="rounded-lg max-h-48 object-contain" />}
    </div>
  );
};

const CalloutEdit: FC<BlockProps<Extract<Block, {type:'callout'}>>> = ({ block, onUpdate }) => (
  <div className="stack">
    <div className="stack-sm">
      <label className="font-medium">Title (optional)</label>
      <RichTextEditor value={block.title || ''} onChange={title => onUpdate?.({ ...block, title })} placeholder="Callout title..." showToolbar={false} singleLine />
    </div>
    <RichTextEditor value={block.text} onChange={text => onUpdate?.({ ...block, text })} placeholder="Callout content..." showToolbar={false} />
  </div>
);

const CodeEdit: FC<BlockProps<Extract<Block, {type:'code'}>>> = ({ block, onUpdate }) => {
  const languages = ['typescript', 'javascript', 'python', 'rust', 'sql', 'bash', 'json', 'css', 'html'];
  return (
    <div className="stack">
      <div className="row wrap">{languages.map(lang => <button key={lang} onClick={() => onUpdate?.({ ...block, language: lang })} className={cn('px-2 py-1 text-small rounded border', block.language === lang ? 'bg-accent text-text-inverted border-accent' : 'border-border hover:bg-surface-2')}>{lang}</button>)}</div>
      <textarea value={block.code} onChange={e => onUpdate?.({ ...block, code: e.target.value })} placeholder="// Enter code..." className="input min-h-30 resize-none font-mono" rows={6} spellCheck={false} />
    </div>
  );
};

const QuoteEdit: FC<BlockProps<Extract<Block, {type:'quote'}>>> = ({ block, onUpdate }) => (
  <div className="stack border-l-4 border-accent pl-4">
    <RichTextEditor value={block.text} onChange={text => onUpdate?.({ ...block, text })} placeholder="Quote text..." showToolbar={false} />
    <div className="stack-sm">
      <label className="font-medium">Attribution (optional)</label>
      <RichTextEditor value={block.attribution || ''} onChange={attribution => onUpdate?.({ ...block, attribution })} placeholder="ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â Author name" showToolbar={false} singleLine />
    </div>
  </div>
);

const TableEdit: FC<BlockProps<TableBlock>> = ({ block, onUpdate }) => {
  const updateCell = (ri: number, ci: number, v: string) => onUpdate?.({ ...block, rows: block.rows.map((row, r) => r === ri ? { ...row, cells: row.cells.map((c, i) => i === ci ? v : c) } : row) });
  const addRow = () => onUpdate?.({ ...block, rows: [...block.rows, { cells: Array(block.rows[0]?.cells.length || 2).fill('') }] });
  const addCol = () => onUpdate?.({ ...block, rows: block.rows.map(row => ({ ...row, cells: [...row.cells, ''] })) });
  const delRow = (i: number) => block.rows.length > 1 && onUpdate?.({ ...block, rows: block.rows.filter((_, j) => j !== i) });
  const delCol = (ci: number) => block.rows[0]?.cells.length > 1 && onUpdate?.({ ...block, rows: block.rows.map(row => ({ ...row, cells: row.cells.filter((_, i) => i !== ci) })) });

  return (
    <div className="stack">
      <label className="row"><input type="checkbox" checked={block.hasHeader ?? true} onChange={e => onUpdate?.({ ...block, hasHeader: e.target.checked })} className="rounded" /><span>First row is header</span></label>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse"><tbody>
          {block.rows.map((row, ri) => (
            <tr key={ri}>
              {row.cells.map((cell, ci) => (
                <td key={ci} className="p-1">
                  <RichTextEditor value={cell} onChange={v => updateCell(ri, ci, v)} placeholder={block.hasHeader && ri === 0 ? 'Header' : 'Cell'} showToolbar={false} singleLine className={cn(block.hasHeader && ri === 0 && 'font-semibold')} />
                </td>
              ))}
              <td className="p-1 w-8"><button onClick={() => delRow(ri)} className="icon-btn p-1 text-muted hover:text-error" disabled={block.rows.length <= 1}><Trash2 size={14} /></button></td>
            </tr>
          ))}
        </tbody></table>
      </div>
      <div className="row">
        <button onClick={addRow} className="text-accent text-small hover:text-accent-hover">+ Add row</button>
        <button onClick={addCol} className="text-accent text-small hover:text-accent-hover">+ Add column</button>
        {block.rows[0]?.cells.length > 1 && <button onClick={() => delCol(block.rows[0].cells.length - 1)} className="text-muted text-small hover:text-error">- Remove column</button>}
      </div>
    </div>
  );
};

const TocEdit: FC<BlockProps<TocBlock>> = ({ block, onUpdate }) => {
  const depths = ['1', '2', '3'] as const;
  return (
    <div className="stack surface p-4 border-dashed">
      <div className="row text-muted"><ListTree size={18} /><span className="font-medium">Table of Contents</span></div>
      <Input label="Title (optional)" value={block.title || ''} onChange={e => onUpdate?.({ ...block, title: e.target.value || undefined })} placeholder="Contents" />
      <div className="row"><span>Max heading depth:</span><div className="row wrap">{depths.map(opt => <button key={opt} onClick={() => onUpdate?.({ ...block, maxDepth: parseInt(opt) as 1 | 2 | 3 })} className={cn('px-3 py-1 rounded-md border', String(block.maxDepth || 3) === opt ? 'bg-accent text-text-inverted border-accent' : 'border-border hover:bg-surface-2')}>{opt}</button>)}</div></div>
      <small className="text-muted">Automatically generates from page headings (H2, H3)</small>
    </div>
  );
};

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
      <input
        type="text"
        value={block.resourceAddress || ''}
        onChange={e => onUpdate?.({ ...block, resourceAddress: e.target.value })}
        placeholder="resource_rdx1..."
        className="input font-mono text-small"
      />
      <small className="text-muted">Enter any Radix resource address to fetch its price</small>
    </div>
    <label className="row">
      <input type="checkbox" checked={block.showChange ?? true} onChange={e => onUpdate?.({ ...block, showChange: e.target.checked })} className="w-4 h-4 rounded border-border" />
      Show 24h change
    </label>
  </div>
);

// Column Editor
function ColumnEditor({ column, onUpdate, onDelete, canDelete }: { column: Column; onUpdate: (col: Column) => void; onDelete: () => void; canDelete: boolean }) {
  const setBlocks = useCallback((blocks: ContentBlock[]) => onUpdate({ ...column, blocks }), [column, onUpdate]);
  const { selectedIndex, setSelectedIndex, update, remove, move, insert } = useBlockOperations(column.blocks, setBlocks, createBlock as (type: BlockType) => ContentBlock);
  return (
    <div className="flex-1 min-w-0 stack-sm p-3 bg-surface-1/50 border border-dashed border-border-muted rounded-lg">
      <div className="spread"><span className="text-small text-muted uppercase tracking-wide">Column</span>{canDelete && <button onClick={onDelete} className="icon-btn p-1 text-muted hover:text-error"><Trash2 size={14} /></button>}</div>
      {column.blocks.length === 0 ? <div className="py-6 text-center"><p className="text-muted text-small mb-2">Empty column</p><InsertButton onInsert={insert} compact allowColumns={false} /></div> : (
        <div className="stack-sm">
          {column.blocks.map((block, i) => <BlockWrapper key={block.id} block={block} index={i} total={column.blocks.length} isSelected={selectedIndex === i} onSelect={() => setSelectedIndex(i)} onUpdate={b => update(i, b as ContentBlock)} onDelete={() => remove(i)} onMoveUp={() => move(i, i - 1)} onMoveDown={() => move(i, i + 1)} compact />)}
          <InsertButton onInsert={insert} compact allowColumns={false} />
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
  text: { label: 'Text', icon: 'Type', View: TextView, Edit: TextEdit },
  media: { label: 'Media', icon: 'Image', View: MediaView, Edit: MediaEdit },
  callout: { label: 'Callout', icon: 'AlertCircle', View: CalloutView, Edit: CalloutEdit },
  divider: { label: 'Divider', icon: 'Minus', View: DividerView, Edit: DividerEdit },
  code: { label: 'Code', icon: 'Code', View: CodeView, Edit: CodeEdit },
  quote: { label: 'Quote', icon: 'Quote', View: QuoteView, Edit: QuoteEdit },
  table: { label: 'Table', icon: 'Table', View: TableView, Edit: TableEdit },
  toc: { label: 'Table of Contents', icon: 'ListTree', View: TocView, Edit: TocEdit },
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

// Insert menu
function InsertBlockMenu({ onInsert, onClose, blockTypes }: { onInsert: (type: BlockType) => void; onClose: () => void; blockTypes: readonly BlockType[] }) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={menuRef} className="dropdown left-1/2 -translate-x-1/2 w-64 p-2">
      <div className="stack-sm">{blockTypes.map(type => {
        const r = BLOCK_REGISTRY[type];
        return <button key={type} onClick={() => { onInsert(type); onClose(); }} className="dropdown-item rounded-md">{ICONS[r.icon]}<span>{r.label}</span></button>;
      })}</div>
    </div>
  );
}

function InsertButton({ onInsert, compact, allowColumns = true }: { onInsert: (type: BlockType) => void; compact?: boolean; allowColumns?: boolean }) {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <div className="relative center">
      <button onClick={() => setShowMenu(!showMenu)} className={cn('row text-muted hover:text-text border border-dashed border-border-muted hover:border-border rounded-md transition-colors', compact ? 'px-2 py-1 text-small rounded' : 'px-3 py-1.5')}>
        <Plus size={compact ? 14 : 16} /><span>{compact ? 'Add' : 'Add block'}</span>
      </button>
      {showMenu && <InsertBlockMenu onInsert={onInsert} onClose={() => setShowMenu(false)} blockTypes={allowColumns ? INSERTABLE_BLOCKS : CONTENT_BLOCK_TYPES} />}
    </div>
  );
}

// Block Wrapper
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

// Public Exports
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