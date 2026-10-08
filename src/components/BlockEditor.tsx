// src/components/BlockEditor.tsx - Full editor with Tiptap (code-split)

'use client';

import { useState, useCallback, useMemo, memo, type ReactNode } from 'react';
import { useAccountQr } from '@/hooks';
import { EditorContent, type Editor } from '@tiptap/react';
import { TABLE_ACTIONS, ToolbarButton, insertEmbed, runTableAction, toolbarActions, uploadImageTo, useWikiEditor, type ToolbarAction, type ToolbarKey } from 'wiki-formant/editor';
import { BlockActions, useBlockOperations } from 'wiki-formant/react';
import { BANNER_VARIANTS } from 'wiki-formant/text';
import { Plus, Trash2, Copy, ChevronUp, ChevronDown, Upload, Minus, Code, Quote, Clock, FileText, Columns, Settings, Bold, Italic, Link2, Heading2, Heading3, Heading4, List, TrendingUp, TableIcon, Globe, LayoutList, LayoutGrid, Info, Rss, QrCode, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BLOCK_META, INSERTABLE_BLOCKS, ATOMIC_BLOCK_TYPES, createBlock, duplicateBlock } from '@/lib/block-utils';
import { resolveMapUrl } from 'wiki-formant/maps';
import { Button, Input, Dropdown } from '@/components/ui';
import { Iframe, YouTube, TwitterEmbed, MapEmbed, TabGroup, TabItem, CodeBlock, HeadingIds } from '@/lib/tiptap/extensions';
import type { Block, BlockType, ContentBlock, RecentPagesBlock, PageListBlock, AssetPriceBlock, RssFeedBlock, ColumnsBlock, InfoboxBlock, AtomicBlock, Column, LinkGridBlock, LinkGridGroup, TipJarBlock, ReferencesBlock, ReferenceItem, BannerBlock } from '@/types/blocks';

// The upload endpoint is this app's, so the hook takes the uploader rather than
// owning one. Module-level because the hook's upload callback depends on it.
const uploadImage = uploadImageTo('/api/upload');

// The upload POST, the paste scrubber, the embed dispatch, the extension set
// and the editor's own state are `wiki-formant/editor`, shared with caper,
// which had written all five character for character. Each repo carried
// exactly one half of a two-part bug — the mid-render ref write here, the
// missing blur flush there — and the shared hook carries both fixes.

type UrlPromptKind = 'link' | 'embed';

// The commands and their labels are `wiki-formant/editor`'s; the icons, and
// upload and embed between the two groups, are this wiki's.
const FORMAT_ACTIONS = toolbarActions(['bold', 'italic', 'code', 'link', 'h2', 'h3', 'h4', 'bulletList', 'blockquote', 'codeBlock', 'divider']);
const INSERT_ACTIONS = toolbarActions(['table', 'tabs']);
const TOOLBAR_ICONS: Partial<Record<ToolbarKey, LucideIcon>> = {
  bold: Bold, italic: Italic, code: Code, link: Link2, h2: Heading2, h3: Heading3, h4: Heading4,
  bulletList: List, blockquote: Quote, codeBlock: Code, divider: Minus, table: TableIcon, tabs: LayoutList,
};
const PRESSED = 'bg-accent text-text-inverted';

function RichTextEditor({ value, onChange, placeholder = 'Write content...' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [urlPrompt, setUrlPrompt] = useState<UrlPromptKind | null>(null);
  const [urlValue, setUrlValue] = useState('');

  // This wiki's own nodes, built from its class names and icons. Memoised
  // because a fresh array would tear the editor down and lose the selection.
  const nodes = useMemo(() => [YouTube, Iframe, TwitterEmbed, MapEmbed, TabGroup, TabItem, CodeBlock, HeadingIds], []);

  const { editor, fileInputRef, isUploading, handleFileChange, triggerUpload, isActive } = useWikiEditor({
    value,
    onChange,
    placeholder,
    nodes,
    proseClass: 'prose prose-invert',
    uploadImage,
  });

  const togglePrompt = (kind: UrlPromptKind) => { setUrlPrompt(urlPrompt === kind ? null : kind); setUrlValue(''); };

  // `link` has no `run`: it needs a URL, so it opens the prompt.
  const actionButton = (a: ToolbarAction, e: Editor) => {
    const Icon = TOOLBAR_ICONS[a.key];
    const pressed = isActive(a.active) || (a.key === 'link' && urlPrompt === 'link');
    return (
      <ToolbarButton key={a.key} label={a.label} pressed={a.active ? pressed : undefined}
        onPress={() => (a.run ? a.run(e) : togglePrompt('link'))} className={cn('toolbar-btn', pressed && PRESSED)}>
        {Icon && <Icon size={14} />}
      </ToolbarButton>
    );
  };

  const applyUrl = () => {
    const url = urlValue.trim();
    if (editor && url && urlPrompt) {
      if (urlPrompt === 'link') editor.chain().focus().setLink({ href: url }).run();
      else insertEmbed(editor, url, { resolveMapUrl });
    }
    setUrlPrompt(null);
    setUrlValue('');
  };

  return (
    <div className="stack-sm">
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp,image/avif" className="hidden" onChange={handleFileChange} />
      {editor && (
        <div className="toolbar">
          {FORMAT_ACTIONS.map(a => actionButton(a, editor))}
          <ToolbarButton label="Upload image" onPress={triggerUpload} className="toolbar-btn"><Upload size={14} /></ToolbarButton>
          <ToolbarButton label="Embed" pressed={urlPrompt === 'embed'} onPress={() => togglePrompt('embed')} className={cn('toolbar-btn', urlPrompt === 'embed' && PRESSED)}><Globe size={14} /></ToolbarButton>
          {INSERT_ACTIONS.map(a => actionButton(a, editor))}
          {editor.isActive('table') && (
            <>
              <div className="toolbar-divider" />
              {TABLE_ACTIONS.map(([cmd, txt, danger]) => (
                <button key={cmd} type="button" onClick={() => runTableAction(editor, cmd)} className={cn('toolbar-btn text-xs', danger && 'hover:text-error')}>{txt}</button>
              ))}
            </>
          )}
        </div>
      )}
      {editor && urlPrompt && (
        <div className="row">
          <Input
            autoFocus
            value={urlValue}
            onChange={e => setUrlValue(e.target.value)}
            placeholder={urlPrompt === 'link' ? 'https://…' : 'YouTube, Twitter/X, Maps, or iframe URL'}
            onKeyDown={e => {
              if (e.key === 'Enter') { e.preventDefault(); applyUrl(); }
              else if (e.key === 'Escape') { setUrlPrompt(null); setUrlValue(''); }
            }}
          />
          <Button size="sm" onClick={applyUrl}>Insert</Button>
          <Button size="sm" variant="ghost" onClick={() => { setUrlPrompt(null); setUrlValue(''); }}>Cancel</Button>
        </div>
      )}
      <div className={cn('tiptap-editor tiptap-field', isUploading && 'tiptap-field-disabled')}>
        <EditorContent editor={editor} />
        {isUploading && <div className="text-center text-text-muted text-small py-2">Uploading image...</div>}
      </div>
    </div>
  );
}

// ========== EDIT COMPONENTS ==========
function EditWrapper({ icon: Icon, label, children }: { icon: LucideIcon; label: string; children: ReactNode }) {
  return <div className="edit-wrapper"><div className="edit-wrapper-label"><Icon size={18} /><span className="font-medium">{label}</span></div>{children}</div>;
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
      {block.pageIds.length > 0 && <div className="stack-sm">{block.pageIds.map((id, i) => <div key={i} className="row"><span className="flex-1 text-small truncate">{id}</span><button onClick={() => onUpdate?.({ ...block, pageIds: block.pageIds.filter((_, j) => j !== i) })} className="icon-btn icon-btn-remove" title="Remove page" aria-label="Remove page"><Trash2 size={14} /></button></div>)}</div>}
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
        <small className="text-text-muted">Enter any Radix resource address to fetch its price</small>
      </div>
      <label className="row"><input type="checkbox" checked={block.showChange ?? true} onChange={e => onUpdate?.({ ...block, showChange: e.target.checked })} className="w-4 h-4 rounded border-border" />Show 24h change</label>
      <label className="row"><input type="checkbox" checked={block.showChart ?? false} onChange={e => onUpdate?.({ ...block, showChart: e.target.checked })} className="w-4 h-4 rounded border-border" />Show price chart</label>
      {block.showChart && (
        <div className="stack-xs">
          <label className="font-medium text-small">Default timeframe</label>
          <div className="toggle-group">
            {(['24h', '7d', '30d'] as const).map(tf => (
              <button key={tf} onClick={() => onUpdate?.({ ...block, chartTimeframe: tf })} className={`toggle-option ${(block.chartTimeframe || '7d') === tf ? 'toggle-option-active' : ''}`}>
                {{ '24h': '24H', '7d': '7D', '30d': '30D' }[tf]}
              </button>
            ))}
          </div>
        </div>
      )}
    </EditWrapper>
  );
}

function RssFeedBlockEdit({ block, onUpdate }: BlockProps<RssFeedBlock>) {
  return (
    <EditWrapper icon={Rss} label="RSS Feed Widget">
      <Input label="Feed URL" value={block.url} onChange={e => onUpdate?.({ ...block, url: e.target.value })} placeholder="https://example.com/feeds.json" />
      <div className="row"><span>Show</span><input type="number" min={1} max={100} value={block.limit || 20} onChange={e => onUpdate?.({ ...block, limit: parseInt(e.target.value) || 20 })} className="input w-16 text-center" /><span>items per page</span></div>
    </EditWrapper>
  );
}

export function InfoboxEditor({ block, onChange }: { block: InfoboxBlock; onChange?: (block: InfoboxBlock) => void }) {
  const setBlocks = useCallback((blocks: AtomicBlock[]) => onChange?.({ ...block, blocks }), [block, onChange]);
  const { selectedIndex, setSelectedIndex, update, remove, duplicate, move, insert } = useBlockOperations(block.blocks || [], setBlocks, DUPLICATE_ATOMIC);
  const handleBlockUpdate = useCallback((i: number, b: Block) => update(i, b as AtomicBlock), [update]);
  const add = (type: BlockType) => insert(createBlock(type) as AtomicBlock);

  return (
    <div className="edit-wrapper">
      <div className="edit-wrapper-label"><Info size={18} /><span className="font-medium">Sidebar Content</span></div>
      <div className="stack-sm">
        {(block.blocks?.length ?? 0) === 0 ? (
          <div className="empty-state"><p className="text-text-muted text-small mb-2">Empty sidebar</p><InsertButton onInsert={add} compact blockTypes={ATOMIC_BLOCK_TYPES} /></div>
        ) : (
          <>
            {(block.blocks || []).map((b, i) => <BlockWrapper key={b.id} block={b} index={i} total={(block.blocks || []).length} isSelected={selectedIndex === i} onSelect={setSelectedIndex} onUpdate={handleBlockUpdate} onDelete={remove} onDuplicate={duplicate} onMove={move} compact />)}
            <InsertButton onInsert={add} compact blockTypes={ATOMIC_BLOCK_TYPES} />
          </>
        )}
      </div>
    </div>
  );
}

function LinkGridBlockEdit({ block, onUpdate }: BlockProps<LinkGridBlock>) {
  const updateGroup = (i: number, group: LinkGridGroup) =>
    onUpdate?.({ ...block, groups: block.groups.map((g, j) => j === i ? group : g) });
  const removeGroup = (i: number) =>
    onUpdate?.({ ...block, groups: block.groups.filter((_, j) => j !== i) });
  const addGroup = () =>
    onUpdate?.({ ...block, groups: [...block.groups, { id: crypto.randomUUID(), heading: 'Group', links: [] }] });

  return (
    <EditWrapper icon={LayoutGrid} label="Link Grid">
      <Input label="Intro (optional)" value={block.intro || ''} onChange={e => onUpdate?.({ ...block, intro: e.target.value || undefined })} placeholder="Optional preface paragraph" />
      <div className="stack">
        {block.groups.map((group, gi) => (
          <div key={group.id} className="edit-wrapper">
            <div className="spread">
              <Input label="Heading" value={group.heading} onChange={e => updateGroup(gi, { ...group, heading: e.target.value })} />
              <button onClick={() => removeGroup(gi)} className="icon-btn icon-btn-remove p-1" title="Remove group" aria-label="Remove group"><Trash2 size={14} /></button>
            </div>
            <Input label="Description (optional, HTML)" value={group.description || ''} onChange={e => updateGroup(gi, { ...group, description: e.target.value || undefined })} placeholder="Optional prose paragraph above the link pills" />
            <div className="stack-sm">
              {group.links.map((link, li) => (
                <div key={li} className="row">
                  <input type="text" value={link.label} onChange={e => updateGroup(gi, { ...group, links: group.links.map((l, k) => k === li ? { ...l, label: e.target.value } : l) })} placeholder="Label" className="flex-1 input" />
                  <input type="text" value={link.href} onChange={e => updateGroup(gi, { ...group, links: group.links.map((l, k) => k === li ? { ...l, href: e.target.value } : l) })} placeholder="/path or https://..." className="flex-1 input" />
                  <button onClick={() => updateGroup(gi, { ...group, links: group.links.filter((_, k) => k !== li) })} className="icon-btn icon-btn-remove" title="Remove link" aria-label="Remove link"><Trash2 size={14} /></button>
                </div>
              ))}
              <Button size="sm" onClick={() => updateGroup(gi, { ...group, links: [...group.links, { label: '', href: '' }] })}>+ Add link</Button>
            </div>
          </div>
        ))}
        <Button size="sm" onClick={addGroup}>+ Add group</Button>
      </div>
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
        <div className="row text-text-muted"><Columns size={18} /><span className="font-medium">{block.columns.length} Column Layout</span></div>
        <div className="row">
          <button onClick={() => setShowSettings(!showSettings)} className={cn('icon-btn p-1', showSettings && 'bg-surface-2')} title="Column settings" aria-label="Column settings"><Settings size={14} /></button>
          {block.columns.length < 4 && <button onClick={addColumn} className="text-accent text-small hover:text-accent-hover">+ Add Column</button>}
        </div>
      </div>
      {showSettings && (
        <div className="toggle-group">
          <div className="row"><span className="text-small text-text-muted">Gap:</span><div className="row flex-wrap">{gaps.map(opt => <button key={opt} onClick={() => onUpdate?.({ ...block, gap: opt })} className={(block.gap || 'md') === opt ? 'toggle-option border-accent bg-accent text-text-inverted' : 'toggle-option'}>{opt}</button>)}</div></div>
          <div className="row"><span className="text-small text-text-muted">Align:</span><div className="row flex-wrap">{aligns.map(opt => <button key={opt} onClick={() => onUpdate?.({ ...block, align: opt })} className={(block.align || 'start') === opt ? 'toggle-option border-accent bg-accent text-text-inverted' : 'toggle-option'}>{opt}</button>)}</div></div>
        </div>
      )}
      <div className={cn('flex', gapClass)}>{block.columns.map((col, i) => <ColumnEditor key={col.id} column={col} onUpdate={c => updateColumn(i, c)} onDelete={() => deleteColumn(i)} canDelete={block.columns.length > 1} />)}</div>
    </div>
  );
}

// ========== BLOCK OPERATIONS ==========
// `useBlockOperations` is `wiki-formant/react`; creating and duplicating a block
// stay here, since the union is this repo's. A container holds atomic blocks only.
const DUPLICATE = { duplicate: duplicateBlock };
const DUPLICATE_ATOMIC = { duplicate: (b: AtomicBlock) => duplicateBlock(b) as AtomicBlock };

function ColumnEditor({ column, onUpdate, onDelete, canDelete }: { column: Column; onUpdate: (col: Column) => void; onDelete: () => void; canDelete: boolean }) {
  const setBlocks = useCallback((blocks: AtomicBlock[]) => onUpdate({ ...column, blocks }), [column, onUpdate]);
  const { selectedIndex, setSelectedIndex, update, remove, duplicate, move, insert } = useBlockOperations(column.blocks || [], setBlocks, DUPLICATE_ATOMIC);
  const handleUpdate = useCallback((i: number, b: Block) => update(i, b as AtomicBlock), [update]);
  const add = (type: BlockType) => insert(createBlock(type) as AtomicBlock);

  return (
    <div className="column-editor">
      <div className="spread"><span className="column-header">Column</span>{canDelete && <button onClick={onDelete} className="icon-btn icon-btn-remove p-1" title="Delete column" aria-label="Delete column"><Trash2 size={14} /></button>}</div>
      {(column.blocks?.length ?? 0) === 0 ? (
        <div className="py-6 text-center"><p className="text-text-muted text-small mb-2">Empty column</p><InsertButton onInsert={add} compact blockTypes={ATOMIC_BLOCK_TYPES} /></div>
      ) : (
        <div className="stack-sm">
          {(column.blocks || []).map((block, i) => <BlockWrapper key={block.id} block={block} index={i} total={(column.blocks || []).length} isSelected={selectedIndex === i} onSelect={setSelectedIndex} onUpdate={handleUpdate} onDelete={remove} onDuplicate={duplicate} onMove={move} compact />)}
          <InsertButton onInsert={add} compact blockTypes={ATOMIC_BLOCK_TYPES} />
        </div>
      )}
    </div>
  );
}

function TipJarBlockEdit({ block, onUpdate }: BlockProps<TipJarBlock>) {
  const { address, isValid, qr } = useAccountQr(block.address);
  return (
    <EditWrapper icon={QrCode} label="Tip Jar (QR)">
      <Input label="Heading" value={block.label || ''} onChange={e => onUpdate?.({ ...block, label: e.target.value })} placeholder="Tip the author ☕️" />
      <div className="stack-sm">
        <label className="font-medium">Radix account address</label>
        <input type="text" value={block.address || ''} onChange={e => onUpdate?.({ ...block, address: e.target.value })} placeholder="account_rdx12..." className="input font-mono" />
        <small className={!address || isValid ? 'text-text-muted' : 'text-error'}>
          {!address ? 'Paste your Radix account address — a scannable QR generates automatically.' : isValid ? 'Valid Radix account address.' : 'Not a valid Radix account address (must start with account_rdx or account_tdx_2_).'}
        </small>
      </div>
      <Input label="Message" value={block.message || ''} onChange={e => onUpdate?.({ ...block, message: e.target.value })} placeholder="Support independent writing on Radix." />
      {qr && <div className="tip-jar-qr tip-jar-qr-preview" dangerouslySetInnerHTML={{ __html: qr }} />}
    </EditWrapper>
  );
}

function BannerBlockEdit({ block, onUpdate }: BlockProps<BannerBlock>) {
  return (
    <EditWrapper icon={Info} label="Notice Banner">
      <div className="stack-sm">
        <label className="font-medium">Type</label>
        <div className="toggle-group flex-wrap">
          {BANNER_VARIANTS.map(v => (
            <button key={v.value} type="button" onClick={() => onUpdate?.({ ...block, variant: v.value })} className={cn('toggle-option', block.variant === v.value && 'toggle-option-active')}>{v.label}</button>
          ))}
        </div>
      </div>
      <Input label="Custom message (optional)" value={block.text || ''} onChange={e => onUpdate?.({ ...block, text: e.target.value || undefined })} placeholder="Leave empty to use the default notice text" />
    </EditWrapper>
  );
}

function ReferencesBlockEdit({ block, onUpdate }: BlockProps<ReferencesBlock>) {
  const items = block.items || [];
  const updateItem = (i: number, item: ReferenceItem) => onUpdate?.({ ...block, items: items.map((x, j) => j === i ? item : x) });
  const removeItem = (i: number) => onUpdate?.({ ...block, items: items.filter((_, j) => j !== i) });
  const addItem = () => onUpdate?.({ ...block, items: [...items, { id: crypto.randomUUID(), text: '', url: '' }] });
  return (
    <EditWrapper icon={List} label="References">
      <Input label="Heading" value={block.title || ''} onChange={e => onUpdate?.({ ...block, title: e.target.value || undefined })} placeholder="References" />
      <div className="stack-sm">
        {items.map((item, i) => (
          <div key={item.id} className="row">
            <span className="text-text-muted text-small w-5 text-right">{i + 1}.</span>
            <input type="text" value={item.text} onChange={e => updateItem(i, { ...item, text: e.target.value })} placeholder="Source title, author, publisher (HTML allowed)" className="flex-1 input" />
            <input type="text" value={item.url || ''} onChange={e => updateItem(i, { ...item, url: e.target.value || undefined })} placeholder="https://source-url" className="flex-1 input" />
            <button onClick={() => removeItem(i)} className="icon-btn icon-btn-remove" title="Remove reference" aria-label="Remove reference"><Trash2 size={14} /></button>
          </div>
        ))}
        <Button size="sm" onClick={addItem}>+ Add reference</Button>
      </div>
    </EditWrapper>
  );
}

function renderBlockEdit(block: Block | AtomicBlock, onUpdate?: (b: Block) => void): ReactNode {
  switch (block.type) {
    case 'content': return <ContentBlockEdit block={block} onUpdate={onUpdate as any} />;
    case 'recentPages': return <RecentPagesBlockEdit block={block} onUpdate={onUpdate as any} />;
    case 'pageList': return <PageListBlockEdit block={block} onUpdate={onUpdate as any} />;
    case 'assetPrice': return <AssetPriceBlockEdit block={block} onUpdate={onUpdate as any} />;
    case 'rssFeed': return <RssFeedBlockEdit block={block} onUpdate={onUpdate as any} />;
    case 'columns': return <ColumnsBlockEdit block={block} onUpdate={onUpdate as any} />;
    case 'infobox': return <InfoboxEditor block={block} onChange={onUpdate as any} />;
    case 'linkGrid': return <LinkGridBlockEdit block={block} onUpdate={onUpdate as any} />;
    case 'tipJar': return <TipJarBlockEdit block={block} onUpdate={onUpdate as any} />;
    case 'banner': return <BannerBlockEdit block={block} onUpdate={onUpdate as any} />;
    case 'references': return <ReferencesBlockEdit block={block} onUpdate={onUpdate as any} />;
    // codeTabs, stats and testimonial have no visual editor.
    default: return null;
  }
}

function InsertButton({ onInsert, compact, blockTypes = INSERTABLE_BLOCKS }: { onInsert: (type: BlockType) => void; compact?: boolean; blockTypes?: readonly BlockType[] }) {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <div className="relative center">
      <button onClick={() => setShowMenu(!showMenu)} className={cn('insert-btn', compact && 'rounded px-2 py-1 text-small')}>
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

  if (!meta) return (
    <div className={cn('block-unknown', compact ? 'p-3' : 'p-4 rounded-lg')}>
      <div className="spread mb-2"><span className={cn('text-warning', compact ? 'text-small' : 'font-medium')}>Unknown block: {block.type}</span><button onClick={e => { e.stopPropagation(); onDelete(index); }} className="icon-btn icon-btn-remove p-1" title="Delete block" aria-label="Delete block"><Trash2 size={iconSize} /></button></div>
    </div>
  );
  const Icon = meta.icon;
  const isContainer = block.type === 'columns' || block.type === 'infobox';
  return (
    <div onClick={handleSelect} className={cn(
      'group',
      compact
        ? cn('block-wrapper-compact', isSelected && 'border-accent bg-accent/5')
        : cn('block-wrapper', isContainer && 'block-wrapper-container', isSelected && 'border-accent bg-accent/5')
    )}>
      <div className={cn('spread', compact ? 'mb-2' : 'mb-3')}>
        <div className="row">{!(compact || isContainer) && <div className="block-label"><Icon size={18} /><span className="block-label-text">{meta.label}</span></div>}</div>
        <BlockActions
          index={index} total={total} blockLabel={meta.label}
          ops={{ move: onMove, duplicate: onDuplicate, remove: onDelete }}
          icons={{
            up: <ChevronUp size={iconSize} />,
            down: <ChevronDown size={iconSize} />,
            duplicate: compact ? undefined : <Copy size={iconSize} />,
            remove: <Trash2 size={iconSize} />,
          }}
          className="block-actions" buttonClassName="icon-btn block-action"
        />
      </div>
      {renderBlockEdit(block, handleUpdate)}
    </div>
  );
});

// ========== PUBLIC API ==========
export function BlockEditor({ content, onChange }: { content: Block[]; onChange: (content: Block[]) => void }) {
  const { selectedIndex, setSelectedIndex, update, remove, duplicate, move, insert } = useBlockOperations(content, onChange, DUPLICATE);
  const add = (type: BlockType) => insert(createBlock(type));
  if (content.length === 0) return <div className="stack items-center empty-state"><p className="text-text-muted">No content yet. Add your first block!</p><InsertButton onInsert={add} /></div>;
  return (
    <div className="stack">
      {content.map((block, i) => <BlockWrapper key={block.id} block={block} index={i} total={content.length} isSelected={selectedIndex === i} onSelect={setSelectedIndex} onUpdate={update} onDelete={remove} onDuplicate={duplicate} onMove={move} />)}
      <InsertButton onInsert={add} />
    </div>
  );
}
