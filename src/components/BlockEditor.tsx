// src/components/BlockEditor.tsx

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Plus, GripVertical, Trash2, Copy, ChevronUp, ChevronDown, Type, AlignLeft, Image, AlertCircle, Minus, Code, Quote, List, Clock, FileText, Link as LinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Input } from '@/components/ui';
import { type Block, type BlockContent, type BlockType, createBlock, duplicateBlock, BLOCK_REGISTRY, INSERTABLE_BLOCKS } from '@/lib/blocks';

const ICONS: Record<string, React.ReactNode> = {
  Type: <Type size={18} />, AlignLeft: <AlignLeft size={18} />, Image: <Image size={18} />,
  AlertCircle: <AlertCircle size={18} />, Minus: <Minus size={18} />, Code: <Code size={18} />,
  Quote: <Quote size={18} />, List: <List size={18} />, Clock: <Clock size={18} />,
  FileText: <FileText size={18} />, Link: <LinkIcon size={18} />,
};

interface EditorProps<T extends Block> { block: T; onUpdate: (b: Block) => void; }

// Selector buttons
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

// Block editors
function HeadingEditor({ block, onUpdate }: EditorProps<Extract<Block, { type: 'heading' }>>) {
  const levels = [1, 2, 3] as const;
  return (
    <div className="stack-2">
      <div className="row">
        {levels.map(level => (
          <button key={level} onClick={() => onUpdate({ ...block, level })}
            className={cn('px-3 py-1 rounded-md border', block.level === level ? 'bg-accent text-text-inverted border-accent' : 'border-border hover:bg-surface-2')}>
            H{level}
          </button>
        ))}
      </div>
      <input type="text" value={block.text} onChange={e => onUpdate({ ...block, text: e.target.value })}
        placeholder="Heading text..." className={cn('input-ghost font-semibold', block.level === 1 && 'text-h1', block.level === 2 && 'text-h2', block.level === 3 && 'text-h3')} />
    </div>
  );
}

function ParagraphEditor({ block, onUpdate }: EditorProps<Extract<Block, { type: 'paragraph' }>>) {
  return (
    <div className="stack-2">
      <textarea value={block.text} onChange={e => onUpdate({ ...block, text: e.target.value })}
        placeholder="Write paragraph... (supports **bold**, *italic*, `code`, [links](url))"
        className="input-ghost min-h-[60px] resize-none" rows={3} />
      <small>Supports: **bold**, *italic*, `code`, [link text](url)</small>
    </div>
  );
}

function ImageEditor({ block, onUpdate }: EditorProps<Extract<Block, { type: 'image' }>>) {
  return (
    <div className="stack">
      <Input label="Image URL" type="url" value={block.src} onChange={e => onUpdate({ ...block, src: e.target.value })} placeholder="https://..." />
      <Input label="Alt text" value={block.alt || ''} onChange={e => onUpdate({ ...block, alt: e.target.value })} placeholder="Describe the image..." />
      <Input label="Caption (optional)" value={block.caption || ''} onChange={e => onUpdate({ ...block, caption: e.target.value })} placeholder="Image caption..." />
      {block.src && <img src={block.src} alt={block.alt || ''} className="rounded-lg max-h-48 object-contain" />}
    </div>
  );
}

function CalloutEditor({ block, onUpdate }: EditorProps<Extract<Block, { type: 'callout' }>>) {
  return (
    <div className="stack">
      <Selector options={['info', 'warning', 'success', 'error'] as const} value={block.variant} onChange={variant => onUpdate({ ...block, variant })} />
      <Input label="Title (optional)" value={block.title || ''} onChange={e => onUpdate({ ...block, title: e.target.value })} placeholder="Callout title..." />
      <textarea value={block.text} onChange={e => onUpdate({ ...block, text: e.target.value })} placeholder="Callout content..."
        className="input min-h-[60px] resize-none" rows={2} />
    </div>
  );
}

function CodeEditor({ block, onUpdate }: EditorProps<Extract<Block, { type: 'code' }>>) {
  const languages = ['typescript', 'javascript', 'python', 'rust', 'sql', 'bash', 'json', 'css', 'html'];
  return (
    <div className="stack">
      <div className="row wrap">
        {languages.map(lang => (
          <button key={lang} onClick={() => onUpdate({ ...block, language: lang })}
            className={cn('px-2 py-1 text-small rounded border', block.language === lang ? 'bg-accent text-text-inverted border-accent' : 'border-border hover:bg-surface-2')}>
            {lang}
          </button>
        ))}
      </div>
      <textarea value={block.code} onChange={e => onUpdate({ ...block, code: e.target.value })} placeholder="// Enter code..."
        className="input min-h-[120px] resize-none font-mono" rows={6} spellCheck={false} />
    </div>
  );
}

function QuoteEditor({ block, onUpdate }: EditorProps<Extract<Block, { type: 'quote' }>>) {
  return (
    <div className="stack border-l-4 border-accent pl-4">
      <textarea value={block.text} onChange={e => onUpdate({ ...block, text: e.target.value })}
        placeholder="Quote text..." className="input-ghost min-h-[60px] italic resize-none" rows={2} />
      <Input label="Attribution (optional)" value={block.attribution || ''} onChange={e => onUpdate({ ...block, attribution: e.target.value })} placeholder="— Author name" />
    </div>
  );
}

function ListEditor({ block, onUpdate }: EditorProps<Extract<Block, { type: 'list' }>>) {
  const updateItem = (index: number, text: string) => {
    const items = [...block.items]; items[index] = { ...items[index], text };
    onUpdate({ ...block, items });
  };
  const toggleChecked = (index: number) => {
    const items = [...block.items]; items[index] = { ...items[index], checked: !items[index].checked };
    onUpdate({ ...block, items });
  };
  return (
    <div className="stack">
      <Selector options={['bullet', 'numbered', 'checklist'] as const} value={block.style} onChange={style => onUpdate({ ...block, style })} />
      <div className="stack-2">
        {block.items.map((item, i) => (
          <div key={i} className="row">
            {block.style === 'checklist' && <input type="checkbox" checked={item.checked || false} onChange={() => toggleChecked(i)} className="rounded" />}
            {block.style === 'bullet' && <span className="text-muted">•</span>}
            {block.style === 'numbered' && <span className="text-muted">{i + 1}.</span>}
            <input type="text" value={item.text} onChange={e => updateItem(i, e.target.value)} placeholder="List item..." className="flex-1 input-ghost" />
            <button onClick={() => block.items.length > 1 && onUpdate({ ...block, items: block.items.filter((_, j) => j !== i) })}
              className="icon-btn text-muted hover:text-red-400" disabled={block.items.length <= 1}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <button onClick={() => onUpdate({ ...block, items: [...block.items, { text: '' }] })} className="text-accent hover:text-accent-hover">+ Add item</button>
    </div>
  );
}

function RecentPagesEditor({ block, onUpdate }: EditorProps<Extract<Block, { type: 'recentPages' }>>) {
  return (
    <div className="stack surface p-4 border-dashed">
      <div className="row text-muted"><Clock size={18} /><span className="font-medium">Recent Pages Widget</span></div>
      <Input label="Filter by category (optional)" value={block.tagPath || ''} onChange={e => onUpdate({ ...block, tagPath: e.target.value || undefined })}
        placeholder="e.g., contents/tech" hint="Leave empty to show all recent pages" />
      <div className="row">
        <span>Show</span>
        <input type="number" min={1} max={20} value={block.limit} onChange={e => onUpdate({ ...block, limit: parseInt(e.target.value) || 5 })}
          className="input w-16 text-center" />
        <span>pages</span>
      </div>
    </div>
  );
}

function PageListEditor({ block, onUpdate }: EditorProps<Extract<Block, { type: 'pageList' }>>) {
  const [newPageId, setNewPageId] = useState('');
  const addPage = () => { if (newPageId.trim()) { onUpdate({ ...block, pageIds: [...block.pageIds, newPageId.trim()] }); setNewPageId(''); } };
  return (
    <div className="stack surface p-4 border-dashed">
      <div className="row text-muted"><FileText size={18} /><span className="font-medium">Curated Page List</span></div>
      {block.pageIds.length > 0 && (
        <div className="stack-2">
          {block.pageIds.map((id, i) => (
            <div key={i} className="row">
              <span className="flex-1 font-mono text-small truncate">{id}</span>
              <button onClick={() => onUpdate({ ...block, pageIds: block.pageIds.filter((_, j) => j !== i) })} className="icon-btn text-muted hover:text-red-400"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      )}
      <div className="row">
        <input type="text" value={newPageId} onChange={e => setNewPageId(e.target.value)} placeholder="Page ID..." className="flex-1 input" />
        <Button size="sm" onClick={addPage} disabled={!newPageId.trim()}>Add</Button>
      </div>
      <small>Add page IDs to create a curated list</small>
    </div>
  );
}

function EmbedEditor({ block, onUpdate }: EditorProps<Extract<Block, { type: 'embed' }>>) {
  return (
    <div className="stack">
      <Input label="Embed URL" type="url" value={block.url} onChange={e => onUpdate({ ...block, url: e.target.value })}
        placeholder="https://youtube.com/watch?v=..." hint="Supports YouTube and other embed URLs" />
      <div className="row">
        <span>Aspect ratio:</span>
        <Selector options={['16:9', '4:3', '1:1'] as const} value={block.aspectRatio || '16:9'} onChange={aspectRatio => onUpdate({ ...block, aspectRatio })} />
      </div>
    </div>
  );
}

function DividerEditor() {
  return <div className="py-2"><hr /><small className="block text-center mt-2">Horizontal divider</small></div>;
}

// Editor registry
const EDITORS: Record<BlockType, (props: { block: Block; onUpdate: (b: Block) => void }) => React.ReactNode> = {
  heading: p => <HeadingEditor {...p as EditorProps<Extract<Block, { type: 'heading' }>>} />,
  paragraph: p => <ParagraphEditor {...p as EditorProps<Extract<Block, { type: 'paragraph' }>>} />,
  image: p => <ImageEditor {...p as EditorProps<Extract<Block, { type: 'image' }>>} />,
  callout: p => <CalloutEditor {...p as EditorProps<Extract<Block, { type: 'callout' }>>} />,
  divider: () => <DividerEditor />,
  code: p => <CodeEditor {...p as EditorProps<Extract<Block, { type: 'code' }>>} />,
  quote: p => <QuoteEditor {...p as EditorProps<Extract<Block, { type: 'quote' }>>} />,
  list: p => <ListEditor {...p as EditorProps<Extract<Block, { type: 'list' }>>} />,
  recentPages: p => <RecentPagesEditor {...p as EditorProps<Extract<Block, { type: 'recentPages' }>>} />,
  pageList: p => <PageListEditor {...p as EditorProps<Extract<Block, { type: 'pageList' }>>} />,
  embed: p => <EmbedEditor {...p as EditorProps<Extract<Block, { type: 'embed' }>>} />,
};

function BlockWrapper({ block, index, total, isSelected, onSelect, onUpdate, onDelete, onDuplicate, onMoveUp, onMoveDown }: {
  block: Block; index: number; total: number; isSelected: boolean;
  onSelect: () => void; onUpdate: (b: Block) => void; onDelete: () => void;
  onDuplicate: () => void; onMoveUp: () => void; onMoveDown: () => void;
}) {
  const reg = BLOCK_REGISTRY[block.type];
  return (
    <div onClick={onSelect}
      className={cn('group relative row items-start gap-2 p-4 rounded-lg border transition-colors',
        isSelected ? 'border-accent bg-accent/5' : 'border-border-muted hover:border-border')}>
      <div className="stack-2 items-center opacity-0 group-hover:opacity-100 transition-opacity">
        <button className="icon-btn p-1 text-muted cursor-grab"><GripVertical size={16} /></button>
        <button onClick={e => { e.stopPropagation(); onMoveUp(); }} disabled={index === 0} className="icon-btn p-1 text-muted disabled:opacity-30"><ChevronUp size={14} /></button>
        <button onClick={e => { e.stopPropagation(); onMoveDown(); }} disabled={index === total - 1} className="icon-btn p-1 text-muted disabled:opacity-30"><ChevronDown size={14} /></button>
      </div>
      <div className="flex-1 min-w-0 stack">
        <div className="row text-muted">
          {ICONS[reg.icon]}<span className="text-small font-medium uppercase">{reg.label}</span>
        </div>
        {EDITORS[block.type]({ block, onUpdate })}
      </div>
      <div className="stack-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={e => { e.stopPropagation(); onDuplicate(); }} className="icon-btn p-1 text-muted" title="Duplicate"><Copy size={14} /></button>
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className="icon-btn p-1 text-muted hover:text-red-400" title="Delete"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

function InsertBlockMenu({ onInsert, onClose }: { onInsert: (type: BlockType) => void; onClose: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose(); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div ref={menuRef} className="dropdown left-1/2 -translate-x-1/2 w-64 p-2">
      <div className="stack-2">
        {INSERTABLE_BLOCKS.map(type => {
          const reg = BLOCK_REGISTRY[type];
          return (
            <button key={type} onClick={() => { onInsert(type); onClose(); }} className="dropdown-item rounded-md">
              {ICONS[reg.icon]}<span>{reg.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InsertBlockButton({ onInsert }: { onInsert: (type: BlockType) => void }) {
  const [showMenu, setShowMenu] = useState(false);
  return (
    <div className="relative center">
      <button onClick={() => setShowMenu(!showMenu)} className="row px-3 py-1.5 text-muted hover:text-text border border-dashed border-border-muted hover:border-border rounded-md transition-colors">
        <Plus size={16} /><span>Add block</span>
      </button>
      {showMenu && <InsertBlockMenu onInsert={onInsert} onClose={() => setShowMenu(false)} />}
    </div>
  );
}

export function BlockEditor({ content, onChange }: { content: BlockContent; onChange: (content: BlockContent) => void }) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const updateBlock = useCallback((index: number, block: Block) => {
    const newContent = [...content]; newContent[index] = block; onChange(newContent);
  }, [content, onChange]);

  const deleteBlock = useCallback((index: number) => {
    onChange(content.filter((_, i) => i !== index)); setSelectedIndex(null);
  }, [content, onChange]);

  const duplicateBlockAt = useCallback((index: number) => {
    const newContent = [...content]; newContent.splice(index + 1, 0, duplicateBlock(content[index]));
    onChange(newContent); setSelectedIndex(index + 1);
  }, [content, onChange]);

  const moveBlock = useCallback((from: number, to: number) => {
    if (to < 0 || to >= content.length) return;
    const newContent = [...content]; const [moved] = newContent.splice(from, 1);
    newContent.splice(to, 0, moved); onChange(newContent); setSelectedIndex(to);
  }, [content, onChange]);

  const insertBlock = useCallback((type: BlockType, atIndex?: number) => {
    const newBlock = createBlock(type);
    const newContent = [...content]; const index = atIndex ?? content.length;
    newContent.splice(index, 0, newBlock); onChange(newContent); setSelectedIndex(index);
  }, [content, onChange]);

  if (content.length === 0) {
    return (
      <div className="stack items-center py-12 text-center">
        <p className="text-muted">No content yet. Add your first block!</p>
        <InsertBlockButton onInsert={type => insertBlock(type)} />
      </div>
    );
  }

  return (
    <div className="stack">
      {content.map((block, index) => (
        <BlockWrapper key={block.id} block={block} index={index} total={content.length}
          isSelected={selectedIndex === index} onSelect={() => setSelectedIndex(index)}
          onUpdate={b => updateBlock(index, b)} onDelete={() => deleteBlock(index)}
          onDuplicate={() => duplicateBlockAt(index)} onMoveUp={() => moveBlock(index, index - 1)}
          onMoveDown={() => moveBlock(index, index + 1)} />
      ))}
      <InsertBlockButton onInsert={type => insertBlock(type)} />
    </div>
  );
}

export default BlockEditor;