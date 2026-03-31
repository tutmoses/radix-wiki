// src/lib/tiptap/extensions.tsx — Custom Tiptap node extensions

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useClickOutside } from '@/hooks';
import { type Editor, NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer } from '@tiptap/react';
import TiptapYoutube from '@tiptap/extension-youtube';
import TiptapCodeBlock from '@tiptap/extension-code-block';
import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';
import { Plus, Code, ChevronDown, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CODE_LANGS, DEFAULT_LANG } from '@/lib/block-utils';
import { toMapEmbedUrl, resolveMapUrl } from '@/lib/map-utils';

// ========== IFRAME ==========

export const Iframe = TiptapNode.create({
  name: 'iframe',
  group: 'block',
  atom: true,
  addAttributes() { return { src: { default: null }, width: { default: '100%' }, height: { default: '400' } }; },
  parseHTML() { return [{ tag: 'iframe' }]; },
  renderHTML({ HTMLAttributes }) { return ['div', { 'data-iframe-embed': '', class: 'iframe-embed' }, ['iframe', mergeAttributes(HTMLAttributes, { frameborder: '0', allowfullscreen: 'true' })]]; },
});

// ========== YOUTUBE ==========

export const YouTube = TiptapYoutube.extend({
  addPasteRules() {
    return [{
      find: /https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]+)[^\s]*/g,
      handler: ({ match, chain, range }) => { if (match[0]) chain().deleteRange(range).setYoutubeVideo({ src: match[0] }).run(); },
    }];
  },
});

// ========== TWITTER ==========

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

export const TwitterEmbed = TiptapNode.create({
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

// ========== MAP ==========

export const MapEmbed = TiptapNode.create({
  name: 'mapEmbed',
  group: 'block',
  atom: true,
  addAttributes() { return { src: { default: null }, url: { default: null } }; },
  parseHTML() { return [{ tag: 'div[data-map-embed]', getAttrs: el => ({ src: (el as HTMLElement).querySelector('iframe')?.getAttribute('src'), url: (el as HTMLElement).dataset.url }) }]; },
  renderHTML({ node }) { return ['div', { 'data-map-embed': '', 'data-url': node.attrs.url || '', class: 'map-embed' }, ['iframe', { src: node.attrs.src, frameborder: '0', allowfullscreen: 'true', loading: 'lazy', referrerpolicy: 'no-referrer-when-downgrade' }]]; },
  addPasteRules() {
    const ext = this;
    const handler = ({ match, chain, range }: any) => {
      const url = match[0];
      const src = toMapEmbedUrl(url);
      if (src) { chain().deleteRange(range).insertContent({ type: 'mapEmbed', attrs: { src, url } }).run(); return; }
      if (/maps\.app\.goo\.gl|goo\.gl\/maps/.test(url)) {
        chain().deleteRange(range).insertContent({ type: 'mapEmbed', attrs: { src: 'about:blank', url } }).run();
        resolveMapUrl(url).then(resolved => {
          if (!resolved) return;
          const { doc } = ext.editor.state;
          doc.descendants((node, pos) => {
            if (node.type.name === 'mapEmbed' && node.attrs.url === url && node.attrs.src === 'about:blank') {
              ext.editor.chain().setNodeSelection(pos).updateAttributes('mapEmbed', { src: resolved }).run();
              return false;
            }
          });
        });
      }
    };
    return [
      { find: /https?:\/\/(?:www\.)?google\.[a-z.]+\/maps[^\s]*/g, handler },
      { find: /https?:\/\/maps\.app\.goo\.gl\/[^\s]+/g, handler },
      { find: /https?:\/\/goo\.gl\/maps\/[^\s]+/g, handler },
      { find: /https?:\/\/maps\.apple\.com[^\s]*/g, handler },
      { find: /https?:\/\/embed\.apple\.com\/maps[^\s]*/g, handler },
    ];
  },
});

// ========== TABS ==========

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

export const TabGroup = TiptapNode.create({
  name: 'tabGroup',
  group: 'block',
  content: 'tabItem+',
  addAttributes() { return { activeTab: { default: 0 } }; },
  parseHTML() { return [{ tag: 'div[data-tabs]' }]; },
  renderHTML({ HTMLAttributes, node }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-tabs': '', 'data-active-tab': node.attrs.activeTab }), 0]; },
  addNodeView() { return ReactNodeViewRenderer(TabGroupView); },
});

export const TabItem = TiptapNode.create({
  name: 'tabItem',
  group: 'tabItem',
  content: 'block+',
  defining: true,
  isolating: true,
  addAttributes() { return { title: { default: 'Tab' } }; },
  parseHTML() { return [{ tag: 'div[data-tab-item]', getAttrs: el => ({ title: (el as HTMLElement).getAttribute('data-tab-title') || 'Tab' }) }]; },
  renderHTML({ HTMLAttributes, node }) { return ['div', mergeAttributes(HTMLAttributes, { 'data-tab-item': '', 'data-tab-title': node.attrs.title }), 0]; },
});

// ========== CODE BLOCK ==========

function CodeBlockView({ node, updateAttributes }: { node: any; updateAttributes: (attrs: Record<string, any>) => void }) {
  const [showLangs, setShowLangs] = useState(false);
  const closeLangs = useCallback(() => setShowLangs(false), []);
  const dropdownRef = useClickOutside<HTMLDivElement>(closeLangs);
  const lang = node.attrs.language || DEFAULT_LANG;

  return (
    <NodeViewWrapper className="code-block-wrapper relative">
      <div ref={dropdownRef} className="absolute top-2 right-2 z-10">
        <button onClick={() => setShowLangs(!showLangs)} className="lang-btn">
          <Code size={12} /><span>{lang}</span><ChevronDown size={12} className={cn('transition-transform', showLangs && 'rotate-180')} />
        </button>
        {showLangs && (
          <div className="lang-dropdown">
            {CODE_LANGS.map(l => (
              <button key={l} onClick={() => { updateAttributes({ language: l }); setShowLangs(false); }} className={cn('lang-option', l === lang && 'text-accent')}>
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

export const CodeBlock = TiptapCodeBlock.extend({
  addAttributes() { return { ...this.parent?.(), language: { default: DEFAULT_LANG, parseHTML: el => el.querySelector('code')?.className?.match(/language-(\w+)/)?.[1] || DEFAULT_LANG } }; },
  addNodeView() { return ReactNodeViewRenderer(CodeBlockView); },
});
