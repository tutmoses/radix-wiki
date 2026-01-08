// src/components/editor/EditorToolbar.tsx

'use client';

import { type Editor, type JSONContent } from '@tiptap/react';
import { Bold, Italic, Strikethrough, Code, Heading1, Heading2, Heading3, List, ListOrdered, ListChecks, Quote, Minus, Link, Image, Table, Undo, Redo, Highlighter, Save } from 'lucide-react';
import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';

interface EditorToolbarProps {
  editor: Editor;
  onSave?: (content: JSONContent) => void;
}

function ToolbarButton({ onClick, isActive, disabled, title, children }: { onClick: () => void; isActive?: boolean; disabled?: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn('p-1.5 rounded-md hover:bg-surface-2 disabled:opacity-50', isActive && 'bg-accent-muted text-accent')}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="w-px h-6 bg-border-muted mx-1" />;
}

export function EditorToolbar({ editor, onSave }: EditorToolbarProps) {
  const [linkUrl, setLinkUrl] = useState('');
  const [showLinkInput, setShowLinkInput] = useState(false);

  const addLink = useCallback(() => {
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
      setLinkUrl('');
      setShowLinkInput(false);
    }
  }, [editor, linkUrl]);

  const addImage = useCallback(() => {
    const url = window.prompt('Enter image URL:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }, [editor]);

  const insertTable = useCallback(() => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }, [editor]);

  const iconSize = 18;

  return (
    <div className="flex flex-wrap items-center gap-1 bg-surface-0 border border-border rounded-lg p-2 shadow-sm">
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Bold (âŒ˜B)"><Bold size={iconSize} /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Italic (âŒ˜I)"><Italic size={iconSize} /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Strikethrough"><Strikethrough size={iconSize} /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} isActive={editor.isActive('code')} title="Inline code"><Code size={iconSize} /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive('highlight')} title="Highlight"><Highlighter size={iconSize} /></ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} title="Heading 1"><Heading1 size={iconSize} /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} title="Heading 2"><Heading2 size={iconSize} /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} title="Heading 3"><Heading3 size={iconSize} /></ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Bullet list"><List size={iconSize} /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Numbered list"><ListOrdered size={iconSize} /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive('taskList')} title="Task list"><ListChecks size={iconSize} /></ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Quote"><Quote size={iconSize} /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule"><Minus size={iconSize} /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} title="Code block"><Code size={iconSize} /></ToolbarButton>

      <ToolbarDivider />

      <div className="relative">
        <ToolbarButton onClick={() => setShowLinkInput(!showLinkInput)} isActive={editor.isActive('link')} title="Add link"><Link size={iconSize} /></ToolbarButton>
        {showLinkInput && (
          <div className="absolute top-full left-0 mt-1 p-2 bg-surface-0 border border-border rounded-md shadow-md z-10">
            <div className="flex items-center gap-1">
              <input type="url" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://..." className="w-48 px-2 py-1 text-sm border border-border rounded-md" onKeyDown={(e) => e.key === 'Enter' && addLink()} />
              <button onClick={addLink} className="px-2 py-1 text-sm bg-accent text-text-inverted rounded-md">Add</button>
            </div>
          </div>
        )}
      </div>
      <ToolbarButton onClick={addImage} title="Add image"><Image size={iconSize} /></ToolbarButton>
      <ToolbarButton onClick={insertTable} title="Insert table"><Table size={iconSize} /></ToolbarButton>

      <ToolbarDivider />

      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (âŒ˜Z)"><Undo size={iconSize} /></ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (âŒ˜â‡§Z)"><Redo size={iconSize} /></ToolbarButton>

      {onSave && (
        <>
          <div className="flex-1" />
          <button onClick={() => onSave(editor.getJSON())} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-accent text-text-inverted rounded-md" title="Save (âŒ˜S)">
            <Save size={16} />
            <span>Save</span>
          </button>
        </>
      )}
    </div>
  );
}

export default EditorToolbar;