// src/components/BlockEditor.tsx - Full editor with Tiptap (code-split)

'use client';

import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useEditor, EditorContent, type Editor, NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';
import TiptapTable from '@tiptap/extension-table';
import TiptapTableRow from '@tiptap/extension-table-row';
import TiptapTableCell from '@tiptap/extension-table-cell';
import TiptapTableHeader from '@tiptap/extension-table-header';
import TiptapYoutube from '@tiptap/extension-youtube';
import Placeholder from '@tiptap/extension-placeholder';
import TiptapCodeBlock from '@tiptap/extension-code-block';
import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';
import {
  Plus, Trash2, Copy, ChevronUp, ChevronDown, Pencil, Upload,
  Minus, Code, Quote, Clock, FileText, Columns, Settings, ListTree,
  Bold, Italic, Link2, Heading2, Heading3, Heading4, List, TrendingUp, TableIcon, Globe, LayoutList, X, Check,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SHIKI_LANGS, DEFAULT_LANG } from '@/lib/shiki';
import { Button, Input, Dropdown } from '@/components/ui';
import type { Block, BlockType, ContentBlock, RecentPagesBlock, PageListBlock, AssetPriceBlock, ColumnsBlock, LeafBlock, Column } from '@/types/blocks';

export type { Block, BlockType, ContentBlock, RecentPagesBlock, PageListBlock, AssetPriceBlock, TocBlock, ColumnsBlock, Column, LeafBlock } from '@/types/blocks';

const BLOCK_META: Record<BlockType, { label: string; icon: LucideIcon }> = {
  content: { label: 'Content', icon: Pencil },
  recentPages: { label: 'Recent Pages', icon: Clock },
  pageList: { label: 'Page List', icon: FileText },
  assetPrice: { label: 'Asset Price', icon: TrendingUp },
  toc: { label: 'Table of Contents', icon: ListTree },
  columns: { label: 'Columns', icon: Columns },
};

const BLOCK_DEFAULTS: Record<BlockType, () => Omit<Block, 'id'>> = {
  content: () => ({ type: 'content', text: '' }),
  recentPages: () => ({ type: 'recentPages', limit: 5 }),
  pageList: () => ({ type: 'pageList', pageIds: [] }),
  assetPrice: () => ({ type: 'assetPrice', resourceAddress: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd', showChange: true }),
  toc: () => ({ type: 'toc' }),
  columns: () => ({ type: 'columns', columns: [{ id: crypto.randomUUID(), blocks: [] }, { id: crypto.randomUUID(), blocks: [] }], gap: 'md', align: 'start' }),
};

const INSERTABLE_BLOCKS: readonly BlockType[] = ['content', 'columns', 'toc', 'recentPages', 'pageList', 'assetPrice'];

export const createBlock = (type: BlockType): Block => ({ id: crypto.randomUUID(), ...BLOCK_DEFAULTS[type]() } as Block);

export const createDefaultPageContent = (): Block[] => [
  { id: crypto.randomUUID(), type: 'content', text: '' },
  { id: crypto.randomUUID(), type: 'columns', columns: [
    { id: crypto.randomUUID(), blocks: [{ id: crypto.randomUUID(), type: 'toc' }] },
    { id: crypto.randomUUID(), blocks: [{ id: crypto.randomUUID(), type: 'content', text: '<h2>Getting Started</h2><p>Start writing your content here...</p>' }] },
  ], gap: 'md', align: 'start' },
  { id: crypto.randomUUID(), type: 'content', text: '' },
];

function duplicateBlock(block: Block): Block {
  if (block.type === 'columns') {
    return { ...block, id: crypto.randomUUID(), columns: block.columns.map(col => ({ ...col, id: crypto.randomUUID(), blocks: col.blocks.map(b => ({ ...b, id: crypto.randomUUID() })) })) };
  }
  return { ...block, id: crypto.randomUUID() };
}

// ========== TIPTAP EXTENSIONS ==========
const Iframe = TiptapNode.create({
  name: 'iframe',
  group: 'block',
  atom: true,
  addAttributes() { return { src: { default: null }, width: { default: '100%' }, height: { default: '400' } }; },
  parseHTML() { return [{ tag: 'iframe' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', { 'data-iframe-embed': '', class: 'iframe-embed' }, ['iframe', mergeAttributes(HTMLAttributes, { frameborder: '0', allowfullscreen: 'true' })]]; },
});

const TabGroup = TiptapNode.create({
  name: 'tabGroup',
  group: 'block',
  content: 'tabItem+',
  addAttributes() { return { activeTab: { default: 0 } }; },
  parseHTML() { return [{ tag: 'div[data-tabs]' }]; },
  renderHTML({ HTMLAttributes, node }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-tabs': '', 'data-active-tab': node.attrs.activeTab }), 0]; },
  addNodeView() { return ReactNodeViewRenderer(TabGroupView); },
});

const TabItem = TiptapNode.create({
  name: 'tabItem',
  group: 'tabItem',
  content: 'block+',
  defining: true,
  isolating: true,
  addAttributes() { return { title: { default: 'Tab' } }; },
  parseHTML() { return [{ tag: 'div[data-tab-item]', getAttrs: el => ({ title: (el as HTMLElement).getAttribute('data-tab-title') || 'Tab' }) }]; },
  renderHTML({ HTMLAttributes, node }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-tab-item': '', 'data-tab-title': node.attrs.title }), 0]; },
});

function TabGroupView({ node, getPos, editor, updateAttributes }: { node: any; getPos: () => number; editor: Editor; updateAttributes: (attrs: Record<string, any>) => void }) {
  const activeTab = node.attrs.activeTab ?? 0;
  const tabs = node.content.content || [];
  const setActiveTab = (i: number) => updateAttributes({ activeTab: i });
  const addTab = () => editor.chain().focus().insertContentAt(getPos() + node.nodeSize - 1, { type: 'tabItem', attrs: { title: `Tab ${tabs.length + 1}` }, content: [{ type: 'paragraph' }] }).run();
  const removeTab = (index: number) => {
    if (tabs.length <= 1) return;
    let tabPos = getPos() + 1;
    for (let i = 0; i < index; i++) tabPos += tabs[i].nodeSize;
    editor.chain().focus().deleteRange({ from: tabPos, to: tabPos + tabs[index].nodeSize }).run();
    if (activeTab >= tabs.length - 1) setActiveTab(Math.max(0, tabs.length - 2));
  };
  const renameTab = (index: number, title: string) => {
    let tabPos = getPos() + 1;
    for (let i = 0; i < index; i++) tabPos += tabs[i].nodeSize;
    const { tr } = editor.state;
    tr.setNodeMarkup(tabPos, undefined, { title });
    editor.view.dispatch(tr);
  };

  return (
    <NodeViewWrapper data-tabs="" data-active-tab={activeTab}>
      <div className="tabs-editor">
        <div className="tabs-list">
          {tabs.map((tab: any, i: number) => (
            <div key={i} className={cn('tab-button-edit', activeTab === i && 'active')}>
              <input type="text" value={tab.attrs.title} onChange={e => renameTab(i, e.target.value)} onClick={() => setActiveTab(i)} className="tab-title-input" />
              {tabs.length > 1 && <button onClick={() => removeTab(i)} className="tab-remove"><X size={12} /></button>}
            </div>
          ))}
          <button onClick={addTab} className="tab-add"><Plus size={14} /></button>
        </div>
        <div className="tabs-content"><NodeViewContent /></div>
      </div>
    </NodeViewWrapper>
  );
}

function CodeBlockView({ node, updateAttributes }: { node: any; updateAttributes: (attrs: Record<string, any>) => void }) {
  const [showLangs, setShowLangs] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const lang = node.attrs.language || DEFAULT_LANG;

  useEffect(() => {
    if (!showLangs) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowLangs(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showLangs]);

  return (
    <NodeViewWrapper className="code-block-wrapper relative">
      <div ref={dropdownRef} className="absolute top-2 right-2 z-10">
        <button onClick={() => setShowLangs(!showLangs)} className="row gap-1 px-2 py-1 bg-surface-2/80 hover:bg-surface-2 rounded text-xs text-muted hover:text-text transition-colors backdrop-blur-sm">
          <Code size={12} /><span>{lang}</span><ChevronDown size={12} className={cn('transition-transform', showLangs && 'rotate-180')} />
        </button>
        {showLangs && (
          <div className="absolute top-full right-0 mt-1 bg-surface-1 border border-border rounded shadow-lg max-h-48 overflow-y-auto min-w-28 z-50">
            {SHIKI_LANGS.map(l => (
              <button key={l} onClick={() => { updateAttributes({ language: l }); setShowLangs(false); }}
                className={cn('w-full px-3 py-1.5 text-left text-xs hover:bg-surface-2 transition-colors flex items-center justify-between', l === lang && 'text-accent')}>
                {l}{l === lang && <Check size={12} />}
              </button>
            ))}
          </div>
        )}
      </div>
      <pre><NodeViewContent as="code" className={`language-${lang}`} /></pre>
    </NodeViewWrapper>
  );
}

const CodeBlock = TiptapCodeBlock.extend({
  addAttributes() {
    return { ...this.parent?.(), language: { default: DEFAULT_LANG, parseHTML: el => el.querySelector('code')?.className?.match(/language-(\w+)/)?.[1] || DEFAULT_LANG } };
  },
  addNodeView() { return ReactNodeViewRenderer(CodeBlockView); },
});

// ========== UTILITIES ==========
async function uploadImage(file: File): Promise<string | null> {
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (!res.ok) { alert((await res.json()).error || 'Upload failed'); return null; }
    return (await res.json()).url;
  } catch { alert('Upload failed'); return null; }
}

// ========== RICH TEXT EDITOR ==========
const TOOLBAR_BUTTONS: { key: string; icon: LucideIcon; active?: string | [string, Record<string, unknown>]; action: (e: Editor, upload: () => void) => void }[] = [
  { key: 'bold', icon: Bold, active: 'bold', action: e => e.chain().focus().toggleBold().run() },
  { key: 'italic', icon: Italic, active: 'italic', action: e => e.chain().focus().toggleItalic().run() },
  { key: 'code', icon: Code, active: 'code', action: e => e.chain().focus().toggleCode().run() },
  { key: 'link', icon: Link2, active: 'link', action: e => { const url = window.prompt('URL'); if (url) e.chain().focus().setLink({ href: url }).run(); } },
  { key: 'h2', icon: Heading2, active: ['heading', { level: 2 }], action: e => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { key: 'h3', icon: Heading3, active: ['heading', { level: 3 }], action: e => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { key: 'h4', icon: Heading4, active: ['heading', { level: 4 }], action: e => e.chain().focus().toggleHeading({ level: 4 }).run() },
  { key: 'list', icon: List, active: 'bulletList', action: e => e.chain().focus().toggleBulletList().run() },
  { key: 'quote', icon: Quote, active: 'blockquote', action: e => e.chain().focus().toggleBlockquote().run() },
  { key: 'codeBlock', icon: Code, active: 'codeBlock', action: e => e.chain().focus().toggleCodeBlock().run() },
  { key: 'divider', icon: Minus, action: e => e.chain().focus().setHorizontalRule().run() },
  { key: 'upload', icon: Upload, action: (_, upload) => upload() },
  { key: 'embed', icon: Globe, action: e => {
    const url = window.prompt('Embed URL (YouTube, Twitter/X, or any iframe)');
    if (!url) return;
    const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)/);
    if (yt) { e.chain().focus().setYoutubeVideo({ src: url }).run(); return; }
    const tw = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
    e.chain().focus().insertContent({ type: 'iframe', attrs: { src: tw ? `https://platform.twitter.com/embed/Tweet.html?id=${tw[1]}` : url } }).run();
  }},
  { key: 'table', icon: TableIcon, active: 'table', action: e => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { key: 'tabs', icon: LayoutList, active: 'tabGroup', action: e => e.chain().focus().insertContent({
    type: 'tabGroup',
    content: [
      { type: 'tabItem', attrs: { title: 'Tab 1' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Content for tab 1' }] }] },
      { type: 'tabItem', attrs: { title: 'Tab 2' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Content for tab 2' }] }] },
    ],
  }).run() },
];

const TABLE_ACTIONS: [string, string, boolean?][] = [['addColumnAfter', '+Col'], ['addRowAfter', '+Row'], ['deleteColumn', '-Col', true], ['deleteRow', '-Row', true], ['deleteTable', '-Tbl', true]];

function RichTextEditor({ value, onChange, placeholder = 'Write content...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const initialValueRef = useRef(value);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] }, codeBlock: false }),
      TiptapLink.configure({ openOnClick: false, HTMLAttributes: { class: 'link' } }),
      TiptapImage.configure({ inline: false, allowBase64: true, HTMLAttributes: { class: 'rounded-lg max-w-full' } }),
      TiptapYoutube.configure({ controls: true, nocookie: true, modestBranding: true }),
      TiptapTable.configure({ resizable: false, HTMLAttributes: { class: 'tiptap-table' } }),
      TiptapTableRow, TiptapTableCell.configure({ HTMLAttributes: { class: 'p-2' } }),
      TiptapTableHeader.configure({ HTMLAttributes: { class: 'p-2 font-semibold bg-surface-1' } }),
      Iframe, TabGroup, TabItem, CodeBlock, Placeholder.configure({ placeholder }),
    ],
    editorProps: { attributes: { class: 'outline-none focus:outline-none prose prose-invert min-h-20' } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    immediatelyRender: false,
    onCreate: ({ editor }) => { 
      if (initialValueRef.current) {
        queueMicrotask(() => editor.commands.setContent(initialValueRef.current));
      }
    },
  });

  useEffect(() => {
    if (!editor || editor.isFocused || editor.getHTML() === value) return;
    editor.commands.setContent(value);
  }, [value, editor]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    setIsUploading(true);
    const url = await uploadImage(file);
    if (url) editor.chain().focus().setImage({ src: url }).run();
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isActive = (a?: string | [string, Record<string, unknown>]) => a ? (Array.isArray(a) ? editor?.isActive(a[0], a[1]) : editor?.isActive(a)) : false;

  return (
    <div className="stack-sm">
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleFileChange} />
      {editor && (
        <div className="sticky top-16 z-40 flex flex-wrap gap-0.5 p-1 bg-surface-1 border border-border-muted rounded-md mb-2">
          {TOOLBAR_BUTTONS.map(({ key, icon: Icon, active, action }) => (
            <button key={key} type="button" onClick={() => action(editor, () => fileInputRef.current?.click())} className={cn('p-1.5 rounded transition-colors', isActive(active) ? 'bg-accent text-text-inverted' : 'text-muted hover:bg-surface-2 hover:text-text')} title={key}><Icon size={14} /></button>
          ))}
          {editor.isActive('table') && (
            <>
              <div className="w-px h-6 bg-border-muted mx-1 self-center" />
              {TABLE_ACTIONS.map(([cmd, txt, danger]) => (
                <button key={cmd} type="button" onClick={() => (editor.chain().focus() as any)[cmd]().run()} className={cn('p-1.5 rounded text-muted hover:bg-surface-2 text-xs', danger && 'hover:text-error')}>{txt}</button>
              ))}
            </>
          )}
        </div>
      )}
      <div className={cn('tiptap-editor bg-surface-0 border border-border rounded-md p-3 min-h-20 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-muted', isUploading && 'opacity-50 pointer-events-none')}>
        <EditorContent editor={editor} />
        {isUploading && <div className="text-center text-muted text-small py-2">Uploading image...</div>}
      </div>
    </div>
  );
}

// ========== EDIT COMPONENTS ==========
function EditWrapper({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="stack surface p-4 border-dashed">
      <div className="row text-muted"><Icon size={18} /><span className="font-medium">{label}</span></div>
      {children}
    </div>
  );
}

type BlockProps<T extends Block> = { block: T; onUpdate?: (b: T) => void; allContent?: Block[] };

function ContentBlockEdit({ block, onUpdate }: BlockProps<ContentBlock>) {
  return <RichTextEditor value={block.text} onChange={text => onUpdate?.({ ...block, text })} placeholder="Write content..." />;
}

function RecentPagesBlockEdit({ block, onUpdate }: BlockProps<RecentPagesBlock>) {
  return (
    <EditWrapper icon={Clock} label="Recent Pages Widget">
      <Input label="Filter by category (optional)" value={block.tagPath || ''} onChange={e => onUpdate?.({ ...block, tagPath: e.target.value || undefined })} placeholder="e.g., contents/tech" hint="Leave empty to show all recent pages" />
      <div className="row"><span>Show</span><input type="number" min={1} max={20} value={block.limit} onChange={e => onUpdate?.({ ...block, limit: parseInt(e.target.value) || 5 })} className="input w-16 text-center" /><span>pages</span></div>
    </EditWrapper>
  );
}

function PageListBlockEdit({ block, onUpdate }: BlockProps<PageListBlock>) {
  const [newPageId, setNewPageId] = useState('');
  const addPage = () => { if (newPageId.trim()) { onUpdate?.({ ...block, pageIds: [...block.pageIds, newPageId.trim()] }); setNewPageId(''); } };
  return (
    <EditWrapper icon={FileText} label="Curated Page List">
      {block.pageIds.length > 0 && <div className="stack-sm">{block.pageIds.map((id, i) => <div key={i} className="row"><span className="flex-1 text-small truncate">{id}</span><button onClick={() => onUpdate?.({ ...block, pageIds: block.pageIds.filter((_, j) => j !== i) })} className="icon-btn text-muted hover:text-error"><Trash2 size={14} /></button></div>)}</div>}
      <div className="row"><input type="text" value={newPageId} onChange={e => setNewPageId(e.target.value)} placeholder="Page ID..." className="flex-1 input" /><Button size="sm" onClick={addPage} disabled={!newPageId.trim()}>Add</Button></div>
      <small>Add page IDs to create a curated list</small>
    </EditWrapper>
  );
}

function AssetPriceBlockEdit({ block, onUpdate }: BlockProps<AssetPriceBlock>) {
  return (
    <EditWrapper icon={TrendingUp} label="Asset Price Widget">
      <div className="stack-sm">
        <label className="font-medium">Resource Address</label>
        <input type="text" value={block.resourceAddress || ''} onChange={e => onUpdate?.({ ...block, resourceAddress: e.target.value })} placeholder="resource_rdx1..." className="input font-mono" />
        <small className="text-muted">Enter any Radix resource address to fetch its price</small>
      </div>
      <label className="row">
        <input type="checkbox" checked={block.showChange ?? true} onChange={e => onUpdate?.({ ...block, showChange: e.target.checked })} className="w-4 h-4 rounded border-border" />
        Show 24h change
      </label>
    </EditWrapper>
  );
}

function TocBlockEdit() {
  return (
    <EditWrapper icon={ListTree} label="Table of Contents">
      <p className="text-small text-muted">Auto-generated from page headings</p>
    </EditWrapper>
  );
}

function ColumnsBlockEdit({ block, onUpdate }: BlockProps<ColumnsBlock>) {
  const [showSettings, setShowSettings] = useState(false);
  const gapClass = { sm: 'gap-2', md: 'gap-4', lg: 'gap-6' }[block.gap || 'md'];
  const gaps = ['sm', 'md', 'lg'] as const;
  const aligns = ['start', 'center', 'end', 'stretch'] as const;

  const updateColumn = (i: number, col: Column) => onUpdate?.({ ...block, columns: block.columns.map((c, j) => j === i ? col : c) });
  const deleteColumn = (i: number) => block.columns.length > 1 && onUpdate?.({ ...block, columns: block.columns.filter((_, j) => j !== i) });
  const addColumn = () => block.columns.length < 4 && onUpdate?.({ ...block, columns: [...block.columns, { id: crypto.randomUUID(), blocks: [] }] });

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
        <div className="row-md p-3 bg-surface-2 rounded-lg">
          <div className="row"><span className="text-small text-muted">Gap:</span><div className="row wrap">{gaps.map(opt => <button key={opt} onClick={() => onUpdate?.({ ...block, gap: opt })} className={cn('px-3 py-1 rounded-md border capitalize', (block.gap || 'md') === opt ? 'bg-accent text-text-inverted border-accent' : 'border-border hover:bg-surface-2')}>{opt}</button>)}</div></div>
          <div className="row"><span className="text-small text-muted">Align:</span><div className="row wrap">{aligns.map(opt => <button key={opt} onClick={() => onUpdate?.({ ...block, align: opt })} className={cn('px-3 py-1 rounded-md border capitalize', (block.align || 'start') === opt ? 'bg-accent text-text-inverted border-accent' : 'border-border hover:bg-surface-2')}>{opt}</button>)}</div></div>
        </div>
      )}
      <div className={cn('flex', gapClass)}>{block.columns.map((col, i) => <ColumnEditor key={col.id} column={col} onUpdate={c => updateColumn(i, c)} onDelete={() => deleteColumn(i)} canDelete={block.columns.length > 1} />)}</div>
    </div>
  );
}

// ========== BLOCK OPERATIONS ==========
function useBlockOperations<T extends Block>(blocks: T[], setBlocks: (blocks: T[]) => void) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  return {
    selectedIndex, setSelectedIndex,
    update: useCallback((i: number, b: T) => setBlocks(blocks.map((x, j) => j === i ? b : x)), [blocks, setBlocks]),
    remove: useCallback((i: number) => { setBlocks(blocks.filter((_, j) => j !== i)); setSelectedIndex(null); }, [blocks, setBlocks]),
    duplicate: useCallback((i: number) => { const next = [...blocks]; next.splice(i + 1, 0, duplicateBlock(blocks[i]) as T); setBlocks(next); setSelectedIndex(i + 1); }, [blocks, setBlocks]),
    move: useCallback((from: number, to: number) => { if (to < 0 || to >= blocks.length) return; const next = [...blocks]; const [m] = next.splice(from, 1); next.splice(to, 0, m); setBlocks(next); setSelectedIndex(to); }, [blocks, setBlocks]),
    insert: useCallback((type: BlockType, at?: number) => { const next = [...blocks]; const i = at ?? blocks.length; next.splice(i, 0, createBlock(type) as T); setBlocks(next); setSelectedIndex(i); }, [blocks, setBlocks]),
  };
}

function ColumnEditor({ column, onUpdate, onDelete, canDelete }: { column: Column; onUpdate: (col: Column) => void; onDelete: () => void; canDelete: boolean }) {
  const setBlocks = useCallback((blocks: LeafBlock[]) => onUpdate({ ...column, blocks }), [column, onUpdate]);
  const { selectedIndex, setSelectedIndex, update, remove, move, insert } = useBlockOperations(column.blocks, setBlocks);
  const contentBlockTypes = INSERTABLE_BLOCKS.filter(t => t !== 'columns');
  return (
    <div className="flex-1 stack-sm p-3 bg-surface-1/50 border border-dashed border-border-muted rounded-lg">
      <div className="spread"><span className="text-small text-muted uppercase tracking-wide">Column</span>{canDelete && <button onClick={onDelete} className="icon-btn p-1 text-muted hover:text-error"><Trash2 size={14} /></button>}</div>
      {column.blocks.length === 0 ? (
        <div className="py-6 text-center"><p className="text-muted text-small mb-2">Empty column</p><InsertButton onInsert={insert} compact blockTypes={contentBlockTypes} /></div>
      ) : (
        <div className="stack-sm">
          {column.blocks.map((block, i) => <BlockWrapper key={block.id} block={block} index={i} total={column.blocks.length} isSelected={selectedIndex === i} onSelect={() => setSelectedIndex(i)} onUpdate={b => update(i, b as LeafBlock)} onDelete={() => remove(i)} onMoveUp={() => move(i, i - 1)} onMoveDown={() => move(i, i + 1)} compact />)}
          <InsertButton onInsert={insert} compact blockTypes={contentBlockTypes} />
        </div>
      )}
    </div>
  );
}

function renderBlockEdit(block: Block, onUpdate?: (b: Block) => void): ReactNode {
  switch (block.type) {
    case 'content': return <ContentBlockEdit block={block} onUpdate={onUpdate as any} />;
    case 'recentPages': return <RecentPagesBlockEdit block={block} onUpdate={onUpdate as any} />;
    case 'pageList': return <PageListBlockEdit block={block} onUpdate={onUpdate as any} />;
    case 'assetPrice': return <AssetPriceBlockEdit block={block} onUpdate={onUpdate as any} />;
    case 'toc': return <TocBlockEdit />;
    case 'columns': return <ColumnsBlockEdit block={block} onUpdate={onUpdate as any} />;
  }
}

function InsertButton({ onInsert, compact, blockTypes = INSERTABLE_BLOCKS }: { onInsert: (type: BlockType) => void; compact?: boolean; blockTypes?: readonly BlockType[] }) {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <div className="relative center">
      <button onClick={() => setShowMenu(!showMenu)} className={cn('row text-muted hover:text-text border border-dashed border-border-muted hover:border-border rounded-md transition-colors', compact ? 'px-2 py-1 text-small rounded' : 'px-3 py-1.5')}>
        <Plus size={compact ? 14 : 16} /><span>{compact ? 'Add' : 'Add block'}</span>
      </button>
      {showMenu && (
        <Dropdown onClose={() => setShowMenu(false)} className="left-1/2 -translate-x-1/2 w-64 p-2">
          <div className="stack-sm">{blockTypes.map(type => {
            const { label, icon: Icon } = BLOCK_META[type];
            return <button key={type} onClick={() => { onInsert(type); setShowMenu(false); }} className="dropdown-item rounded-md"><Icon size={18} /><span>{label}</span></button>;
          })}</div>
        </Dropdown>
      )}
    </div>
  );
}

function BlockWrapper({ block, index, total, isSelected, onSelect, onUpdate, onDelete, onDuplicate, onMoveUp, onMoveDown, compact }: {
  block: Block; index: number; total: number; isSelected: boolean;
  onSelect: () => void; onUpdate: (b: Block) => void; onDelete: () => void;
  onDuplicate?: () => void; onMoveUp: () => void; onMoveDown: () => void; compact?: boolean;
}) {
  const meta = BLOCK_META[block.type];
  const iconSize = compact ? 12 : 14;
  if (!meta) return (
    <div className={cn('rounded border border-warning/50 bg-warning/10', compact ? 'p-3' : 'p-4 rounded-lg')}>
      <div className="spread mb-2"><span className={cn('text-warning', compact ? 'text-small' : 'font-medium')}>Unknown block: {block.type}</span><button onClick={e => { e.stopPropagation(); onDelete(); }} className="icon-btn p-1 text-muted hover:text-error"><Trash2 size={iconSize} /></button></div>
    </div>
  );
  const Icon = meta.icon;
  return (
    <div onClick={onSelect} className={cn('group relative transition-colors',
      compact ? cn('p-3 rounded-md border', isSelected ? 'border-accent bg-accent/5' : 'border-transparent hover:border-border-muted hover:bg-surface-2/50')
        : cn('p-4 rounded-lg border', isSelected ? 'border-accent bg-accent/5' : 'border-border-muted hover:border-border', block.type === 'columns' && 'bg-surface-1/30')
    )}>
      <div className={cn('spread', compact ? 'mb-2' : 'mb-3')}>
        <div className="row">{!(compact || block.type === 'columns') && <div className="row text-muted"><Icon size={18} /><span className="text-small font-medium uppercase">{meta.label}</span></div>}</div>
        <div className="row opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={e => { e.stopPropagation(); onMoveUp(); }} disabled={index === 0} className="icon-btn p-1 text-muted disabled:opacity-30"><ChevronUp size={iconSize} /></button>
          <button onClick={e => { e.stopPropagation(); onMoveDown(); }} disabled={index === total - 1} className="icon-btn p-1 text-muted disabled:opacity-30"><ChevronDown size={iconSize} /></button>
          {onDuplicate && <button onClick={e => { e.stopPropagation(); onDuplicate(); }} className="icon-btn p-1 text-muted" title="Duplicate"><Copy size={iconSize} /></button>}
          <button onClick={e => { e.stopPropagation(); onDelete(); }} className="icon-btn p-1 text-muted hover:text-error" title="Delete"><Trash2 size={iconSize} /></button>
        </div>
      </div>
      {renderBlockEdit(block, onUpdate)}
    </div>
  );
}

// ========== PUBLIC API ==========
export function BlockEditor({ content, onChange }: { content: Block[]; onChange: (content: Block[]) => void }) {
  const { selectedIndex, setSelectedIndex, update, remove, duplicate, move, insert } = useBlockOperations(content, onChange);
  if (content.length === 0) return <div className="stack items-center py-12 text-center"><p className="text-muted">No content yet. Add your first block!</p><InsertButton onInsert={insert} /></div>;
  return (
    <div className="stack">
      {content.map((block, i) => <BlockWrapper key={block.id} block={block} index={i} total={content.length} isSelected={selectedIndex === i} onSelect={() => setSelectedIndex(i)} onUpdate={b => update(i, b)} onDelete={() => remove(i)} onDuplicate={() => duplicate(i)} onMoveUp={() => move(i, i - 1)} onMoveDown={() => move(i, i + 1)} />)}
      <InsertButton onInsert={insert} />
    </div>
  );
}

export default BlockEditor;