// src/components/BlockEditor.tsx - Full editor with Tiptap (code-split)

'use client';

import { useState, useCallback, useEffect, useRef, useMemo, memo, type ReactNode } from 'react';
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
import { Plus, Trash2, Copy, ChevronUp, ChevronDown, Pencil, Upload, Minus, Code, Quote, Clock, FileText, Columns, Settings, Bold, Italic, Link2, Heading2, Heading3, Heading4, List, TrendingUp, TableIcon, Globe, LayoutList, X, Check, Info, Map, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SHIKI_LANGS, DEFAULT_LANG } from '@/lib/shiki';
import { BLOCK_META, INSERTABLE_BLOCKS, ATOMIC_BLOCK_TYPES, createBlock, duplicateBlock } from '@/lib/block-utils';
import { Button, Input, Dropdown } from '@/components/ui';
import type { Block, BlockType, ContentBlock, RecentPagesBlock, PageListBlock, AssetPriceBlock, ColumnsBlock, InfoboxBlock, InfoboxRow, AtomicBlock, Column } from '@/types/blocks';

// ========== TIPTAP EXTENSIONS ==========
const Iframe = TiptapNode.create({
  name: 'iframe',
  group: 'block',
  atom: true,
  addAttributes() { return { src: { default: null }, width: { default: '100%' }, height: { default: '400' } }; },
  parseHTML() { return [{ tag: 'iframe' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', { 'data-iframe-embed': '', class: 'iframe-embed' }, ['iframe', mergeAttributes(HTMLAttributes, { frameborder: '0', allowfullscreen: 'true' })]]; },
});

const YouTube = TiptapYoutube.extend({
  addPasteRules() {
    return [{
      find: /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)[^\s]*/g,
      handler: ({ match, chain, range }) => { if (match[0]) chain().deleteRange(range).setYoutubeVideo({ src: match[0] }).run(); },
    }];
  },
});

const TwitterEmbed = TiptapNode.create({
  name: 'twitterEmbed',
  group: 'block',
  atom: true,
  addAttributes() { return { tweetId: { default: null }, url: { default: null } }; },
  parseHTML() { return [{ tag: 'div[data-twitter-embed]', getAttrs: el => ({ tweetId: (el as HTMLElement).dataset.tweetId, url: (el as HTMLElement).dataset.url }) }]; },
  renderHTML({ node }) { return ['div', { 'data-twitter-embed': '', 'data-tweet-id': node.attrs.tweetId, 'data-url': node.attrs.url, class: 'twitter-embed' }, ['iframe', { src: `https://platform.twitter.com/embed/Tweet.html?id=${node.attrs.tweetId}&dnt=true`, frameborder: '0', allowfullscreen: 'true', scrolling: 'no' }]]; },
  addNodeView() { return ReactNodeViewRenderer(TwitterEmbedView); },
  addPasteRules() {
    return [{ find: /https?:\/\/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/g, handler: ({ match, chain, range }) => { const tweetId = match[1]; if (tweetId) chain().deleteRange(range).insertContent({ type: 'twitterEmbed', attrs: { tweetId, url: match[0] } }).run(); } }];
  },
});

function TwitterEmbedView({ node }: { node: any }) {
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== 'https://platform.twitter.com') return;
      const data = e.data?.['twttr.embed'];
      if (data?.method === 'twttr.private.resize' && data.params?.[0]?.height) {
        const iframe = containerRef.current?.querySelector('iframe');
        if (iframe) iframe.style.height = `${data.params[0].height}px`;
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);
  return <NodeViewWrapper><div ref={containerRef} className="twitter-embed"><iframe src={`https://platform.twitter.com/embed/Tweet.html?id=${node.attrs.tweetId}&dnt=true`} scrolling="no" allowFullScreen /></div></NodeViewWrapper>;
}

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
    const handler = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowLangs(false); };
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
              <button key={l} onClick={() => { updateAttributes({ language: l }); setShowLangs(false); }} className={cn('w-full px-3 py-1.5 text-left text-xs hover:bg-surface-2 transition-colors flex items-center justify-between', l === lang && 'text-accent')}>
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
  addAttributes() { return { ...this.parent?.(), language: { default: DEFAULT_LANG, parseHTML: el => el.querySelector('code')?.className?.match(/language-(\w+)/)?.[1] || DEFAULT_LANG } }; },
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
    if (tw) { e.chain().focus().insertContent({ type: 'twitterEmbed', attrs: { tweetId: tw[1], url } }).run(); return; }
    e.chain().focus().insertContent({ type: 'iframe', attrs: { src: url } }).run();
  }},
  { key: 'table', icon: TableIcon, active: 'table', action: e => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { key: 'tabs', icon: LayoutList, active: 'tabGroup', action: e => e.chain().focus().insertContent({ type: 'tabGroup', content: [{ type: 'tabItem', attrs: { title: 'Tab 1' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Content for tab 1' }] }] }, { type: 'tabItem', attrs: { title: 'Tab 2' }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Content for tab 2' }] }] }] }).run() },
];

const TABLE_ACTIONS: [string, string, boolean?][] = [['addColumnAfter', '+Col'], ['addRowAfter', '+Row'], ['deleteColumn', '-Col', true], ['deleteRow', '-Row', true], ['deleteTable', '-Tbl', true]];

function RichTextEditor({ value, onChange, placeholder = 'Write content...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const initialValueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  onChangeRef.current = onChange;

  const extensions = useMemo(() => [
    StarterKit.configure({ heading: { levels: [2, 3, 4] }, codeBlock: false }),
    TiptapLink.configure({ openOnClick: false, HTMLAttributes: { class: 'link' } }),
    TiptapImage.configure({ inline: false, allowBase64: true, HTMLAttributes: { class: 'rounded-lg max-w-full' } }),
    YouTube.configure({ controls: true, nocookie: true, modestBranding: true }),
    TiptapTable.configure({ resizable: false, HTMLAttributes: { class: 'tiptap-table' } }),
    TiptapTableRow, TiptapTableCell.configure({ HTMLAttributes: { class: 'p-2' } }),
    TiptapTableHeader.configure({ HTMLAttributes: { class: 'p-2 font-semibold bg-surface-1' } }),
    Iframe, TwitterEmbed, TabGroup, TabItem, CodeBlock, Placeholder.configure({ placeholder }),
  ], [placeholder]);

  const cleanPastedHtml = useCallback((html: string) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('style, script, meta, link, svg, canvas, noscript').forEach(el => el.remove());
    doc.querySelectorAll('*').forEach(el => {
      el.removeAttribute('style'); el.removeAttribute('class'); el.removeAttribute('id');
      Array.from(el.attributes).forEach(attr => { if (!['href', 'src', 'alt'].includes(attr.name)) el.removeAttribute(attr.name); });
    });
    return doc.body.innerHTML;
  }, []);

  const editor = useEditor({
    extensions,
    editorProps: { attributes: { class: 'outline-none focus:outline-none prose prose-invert min-h-20' }, transformPastedHTML: cleanPastedHtml },
    onUpdate: ({ editor }) => { clearTimeout(debounceRef.current); debounceRef.current = setTimeout(() => onChangeRef.current(editor.getHTML()), 150); },
    immediatelyRender: false,
    onCreate: ({ editor }) => { if (initialValueRef.current) queueMicrotask(() => editor.commands.setContent(initialValueRef.current)); },
  });

  useEffect(() => () => clearTimeout(debounceRef.current), []);
  useEffect(() => { if (!editor || editor.isFocused) return; const currentHtml = editor.getHTML(); if (currentHtml !== value) editor.commands.setContent(value); }, [value, editor]);

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
        <div className="sticky top-[var(--header-height)] z-40 flex flex-wrap gap-0.5 p-1 bg-surface-1 border border-border-muted rounded-md mb-2">
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
  return <div className="stack surface p-4 border-dashed"><div className="row text-muted"><Icon size={18} /><span className="font-medium">{label}</span></div>{children}</div>;
}

type BlockProps<T extends Block> = { block: T; onUpdate?: (b: T) => void };

const ContentBlockEdit = memo(function ContentBlockEdit({ block, onUpdate }: BlockProps<ContentBlock>) {
  return <RichTextEditor value={block.text} onChange={text => onUpdate?.({ ...block, text })} placeholder="Write content..." />;
});

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
      <label className="row"><input type="checkbox" checked={block.showChange ?? true} onChange={e => onUpdate?.({ ...block, showChange: e.target.checked })} className="w-4 h-4 rounded border-border" />Show 24h change</label>
    </EditWrapper>
  );
}

function InfoboxBlockEdit({ block, onUpdate }: BlockProps<InfoboxBlock>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const url = await uploadImage(file);
    if (url) onUpdate?.({ ...block, image: url });
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateRow = (i: number, row: InfoboxRow) => onUpdate?.({ ...block, rows: (block.rows || []).map((r, j) => j === i ? row : r) });
  const removeRow = (i: number) => onUpdate?.({ ...block, rows: (block.rows || []).filter((_, j) => j !== i) });
  const addRow = () => onUpdate?.({ ...block, rows: [...(block.rows || []), { label: '', value: '' }] });

  const setBlocks = useCallback((blocks: AtomicBlock[]) => onUpdate?.({ ...block, blocks }), [block, onUpdate]);
  const { selectedIndex, setSelectedIndex, update, remove, duplicate, move, insert } = useBlockOperations(block.blocks || [], setBlocks);
  const handleBlockUpdate = useCallback((i: number, b: Block) => update(i, b as AtomicBlock), [update]);

  return (
    <div className="stack surface p-4 border-dashed">
      <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageUpload} />
      
      <div className="spread">
        <div className="row text-muted"><Info size={18} /><span className="font-medium">Infobox Wrapper</span></div>
        <button onClick={() => setShowSettings(!showSettings)} className={cn('icon-btn p-1', showSettings && 'bg-surface-2')}><Settings size={14} /></button>
      </div>

      {showSettings && (
        <div className="stack-sm p-3 bg-surface-2 rounded-lg">
          <Input label="Title (optional)" value={block.title || ''} onChange={e => onUpdate?.({ ...block, title: e.target.value || undefined })} placeholder="e.g., Quick Facts" />
          
          <div className="stack-sm">
            <label className="font-medium">Image</label>
            {block.image ? (
              <div className="relative">
                <img src={block.image} alt="" className="w-full max-h-32 object-cover rounded-lg" />
                <div className="absolute top-2 right-2 row">
                  <button onClick={() => fileInputRef.current?.click()} className="icon-btn bg-surface-0/80 backdrop-blur-sm" disabled={isUploading}><Upload size={14} /></button>
                  <button onClick={() => onUpdate?.({ ...block, image: undefined })} className="icon-btn bg-surface-0/80 backdrop-blur-sm text-error"><X size={14} /></button>
                </div>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} disabled={isUploading} className="w-full py-4 border-2 border-dashed border-border-muted rounded-lg text-muted hover:text-text hover:border-border transition-colors text-small">
                {isUploading ? 'Uploading...' : 'Click to upload image'}
              </button>
            )}
            <Input label="Caption (optional)" value={block.caption || ''} onChange={e => onUpdate?.({ ...block, caption: e.target.value || undefined })} placeholder="Image caption" />
          </div>

          <div className="stack-sm">
            <label className="font-medium">Data Rows</label>
            {(block.rows || []).map((row, i) => (
              <div key={i} className="row">
                <input type="text" value={row.label} onChange={e => updateRow(i, { ...row, label: e.target.value })} placeholder="Label" className="input flex-1" />
                <input type="text" value={row.value} onChange={e => updateRow(i, { ...row, value: e.target.value })} placeholder="Value" className="input flex-1" />
                <button onClick={() => removeRow(i)} className="icon-btn text-muted hover:text-error"><Trash2 size={14} /></button>
              </div>
            ))}
            <Button size="sm" variant="ghost" onClick={addRow}><Plus size={14} />Add Row</Button>
          </div>

          <div className="stack-sm">
            <label className="font-medium row"><Map size={14} />Map Embed URL (optional)</label>
            <input type="text" value={block.mapUrl || ''} onChange={e => onUpdate?.({ ...block, mapUrl: e.target.value || undefined })} placeholder="https://www.google.com/maps/embed?..." className="input" />
          </div>
        </div>
      )}

      <div className="stack-sm pt-2 border-t border-border-muted">
        <span className="text-small text-muted uppercase tracking-wide">Content</span>
        {(block.blocks?.length ?? 0) === 0 ? (
          <div className="py-4 text-center"><p className="text-muted text-small mb-2">Empty infobox</p><InsertButton onInsert={insert} compact blockTypes={ATOMIC_BLOCK_TYPES} /></div>
        ) : (
          <div className="stack-sm">
            {(block.blocks || []).map((b, i) => <BlockWrapper key={b.id} block={b} index={i} total={(block.blocks || []).length} isSelected={selectedIndex === i} onSelect={setSelectedIndex} onUpdate={handleBlockUpdate} onDelete={remove} onDuplicate={duplicate} onMove={move} compact />)}
            <InsertButton onInsert={insert} compact blockTypes={ATOMIC_BLOCK_TYPES} />
          </div>
        )}
      </div>
    </div>
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
function useBlockOperations<T extends Block | AtomicBlock>(blocks: T[], setBlocks: (blocks: T[]) => void) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const blocksRef = useRef(blocks);
  const setBlocksRef = useRef(setBlocks);
  blocksRef.current = blocks;
  setBlocksRef.current = setBlocks;

  return {
    selectedIndex, setSelectedIndex,
    update: useCallback((i: number, b: T) => setBlocksRef.current(blocksRef.current.map((x, j) => j === i ? b : x)), []),
    remove: useCallback((i: number) => { setBlocksRef.current(blocksRef.current.filter((_, j) => j !== i)); setSelectedIndex(null); }, []),
    duplicate: useCallback((i: number) => { const next = [...blocksRef.current]; next.splice(i + 1, 0, duplicateBlock(blocksRef.current[i]) as T); setBlocksRef.current(next); setSelectedIndex(i + 1); }, []),
    move: useCallback((from: number, to: number) => { if (to < 0 || to >= blocksRef.current.length) return; const next = [...blocksRef.current]; const [m] = next.splice(from, 1); next.splice(to, 0, m); setBlocksRef.current(next); setSelectedIndex(to); }, []),
    insert: useCallback((type: BlockType, at?: number) => { const next = [...blocksRef.current]; const i = at ?? blocksRef.current.length; next.splice(i, 0, createBlock(type) as T); setBlocksRef.current(next); setSelectedIndex(i); }, []),
  };
}

function ColumnEditor({ column, onUpdate, onDelete, canDelete }: { column: Column; onUpdate: (col: Column) => void; onDelete: () => void; canDelete: boolean }) {
  const setBlocks = useCallback((blocks: AtomicBlock[]) => onUpdate({ ...column, blocks }), [column, onUpdate]);
  const { selectedIndex, setSelectedIndex, update, remove, duplicate, move, insert } = useBlockOperations(column.blocks || [], setBlocks);
  const handleUpdate = useCallback((i: number, b: Block) => update(i, b as AtomicBlock), [update]);

  return (
    <div className="flex-1 stack-sm p-3 bg-surface-1/50 border border-dashed border-border-muted rounded-lg">
      <div className="spread"><span className="text-small text-muted uppercase tracking-wide">Column</span>{canDelete && <button onClick={onDelete} className="icon-btn p-1 text-muted hover:text-error"><Trash2 size={14} /></button>}</div>
      {(column.blocks?.length ?? 0) === 0 ? (
        <div className="py-6 text-center"><p className="text-muted text-small mb-2">Empty column</p><InsertButton onInsert={insert} compact blockTypes={ATOMIC_BLOCK_TYPES} /></div>
      ) : (
        <div className="stack-sm">
          {(column.blocks || []).map((block, i) => <BlockWrapper key={block.id} block={block} index={i} total={(column.blocks || []).length} isSelected={selectedIndex === i} onSelect={setSelectedIndex} onUpdate={handleUpdate} onDelete={remove} onDuplicate={duplicate} onMove={move} compact />)}
          <InsertButton onInsert={insert} compact blockTypes={ATOMIC_BLOCK_TYPES} />
        </div>
      )}
    </div>
  );
}

function renderBlockEdit(block: Block | AtomicBlock, onUpdate?: (b: Block) => void): ReactNode {
  switch (block.type) {
    case 'content': return <ContentBlockEdit block={block} onUpdate={onUpdate as any} />;
    case 'recentPages': return <RecentPagesBlockEdit block={block} onUpdate={onUpdate as any} />;
    case 'pageList': return <PageListBlockEdit block={block} onUpdate={onUpdate as any} />;
    case 'assetPrice': return <AssetPriceBlockEdit block={block} onUpdate={onUpdate as any} />;
    case 'columns': return <ColumnsBlockEdit block={block} onUpdate={onUpdate as any} />;
    case 'infobox': return <InfoboxBlockEdit block={block} onUpdate={onUpdate as any} />;
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
          <div className="stack-sm">{blockTypes.map(type => { const { label, icon: Icon } = BLOCK_META[type]; return <button key={type} onClick={() => { onInsert(type); setShowMenu(false); }} className="dropdown-item rounded-md"><Icon size={18} /><span>{label}</span></button>; })}</div>
        </Dropdown>
      )}
    </div>
  );
}

const BlockWrapper = memo(function BlockWrapper({ block, index, total, isSelected, onSelect, onUpdate, onDelete, onDuplicate, onMove, compact }: {
  block: Block | AtomicBlock; index: number; total: number; isSelected: boolean;
  onSelect: (i: number) => void; onUpdate: (i: number, b: Block) => void; onDelete: (i: number) => void;
  onDuplicate: (i: number) => void; onMove: (from: number, to: number) => void; compact?: boolean;
}) {
  const meta = BLOCK_META[block.type];
  const iconSize = compact ? 12 : 14;
  const handleSelect = useCallback(() => onSelect(index), [onSelect, index]);
  const handleUpdate = useCallback((b: Block) => onUpdate(index, b), [onUpdate, index]);
  const handleDelete = useCallback(() => onDelete(index), [onDelete, index]);
  const handleDuplicate = useCallback(() => onDuplicate(index), [onDuplicate, index]);
  const handleMoveUp = useCallback(() => onMove(index, index - 1), [onMove, index]);
  const handleMoveDown = useCallback(() => onMove(index, index + 1), [onMove, index]);

  if (!meta) return (
    <div className={cn('rounded border border-warning/50 bg-warning/10', compact ? 'p-3' : 'p-4 rounded-lg')}>
      <div className="spread mb-2"><span className={cn('text-warning', compact ? 'text-small' : 'font-medium')}>Unknown block: {block.type}</span><button onClick={e => { e.stopPropagation(); handleDelete(); }} className="icon-btn p-1 text-muted hover:text-error"><Trash2 size={iconSize} /></button></div>
    </div>
  );
  const Icon = meta.icon;
  const isContainer = block.type === 'columns' || block.type === 'infobox';
  return (
    <div onClick={handleSelect} className={cn('group relative transition-colors', compact ? cn('p-3 rounded-md border', isSelected ? 'border-accent bg-accent/5' : 'border-transparent hover:border-border-muted hover:bg-surface-2/50') : cn('p-4 rounded-lg border', isSelected ? 'border-accent bg-accent/5' : 'border-border-muted hover:border-border', isContainer && 'bg-surface-1/30'))}>
      <div className={cn('spread', compact ? 'mb-2' : 'mb-3')}>
        <div className="row">{!(compact || isContainer) && <div className="row text-muted"><Icon size={18} /><span className="text-small font-medium uppercase">{meta.label}</span></div>}</div>
        <div className="row opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={e => { e.stopPropagation(); handleMoveUp(); }} disabled={index === 0} className="icon-btn p-1 text-muted disabled:opacity-30"><ChevronUp size={iconSize} /></button>
          <button onClick={e => { e.stopPropagation(); handleMoveDown(); }} disabled={index === total - 1} className="icon-btn p-1 text-muted disabled:opacity-30"><ChevronDown size={iconSize} /></button>
          {!compact && <button onClick={e => { e.stopPropagation(); handleDuplicate(); }} className="icon-btn p-1 text-muted" title="Duplicate"><Copy size={iconSize} /></button>}
          <button onClick={e => { e.stopPropagation(); handleDelete(); }} className="icon-btn p-1 text-muted hover:text-error" title="Delete"><Trash2 size={iconSize} /></button>
        </div>
      </div>
      {renderBlockEdit(block, handleUpdate)}
    </div>
  );
});

// ========== PUBLIC API ==========
export function BlockEditor({ content, onChange }: { content: Block[]; onChange: (content: Block[]) => void }) {
  const { selectedIndex, setSelectedIndex, update, remove, duplicate, move, insert } = useBlockOperations(content, onChange);
  if (content.length === 0) return <div className="stack items-center py-12 text-center"><p className="text-muted">No content yet. Add your first block!</p><InsertButton onInsert={insert} /></div>;
  return (
    <div className="stack">
      {content.map((block, i) => <BlockWrapper key={block.id} block={block} index={i} total={content.length} isSelected={selectedIndex === i} onSelect={setSelectedIndex} onUpdate={update} onDelete={remove} onDuplicate={duplicate} onMove={move} />)}
      <InsertButton onInsert={insert} />
    </div>
  );
}

export default BlockEditor;