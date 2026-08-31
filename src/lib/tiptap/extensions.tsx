// src/lib/tiptap/extensions.tsx — this wiki's binding of the shared editor nodes.
//
// The nodes themselves are `wiki-formant/tiptap`, shared with caper, which had
// written the same file. Both copies had drifted, in opposite directions: this
// one had grown tabs caper lacked, caper had extracted the Twitter helper this
// one still wrote out three times. Neither was behind, so neither looked like
// the one to fix.
//
// What stays here is the only part that was ever this wiki's: the class tokens,
// the icon set, the language list, and the API route a shortened map URL has to
// be resolved through.

'use client';

import { ChevronDown, Check, Code, Plus, X } from 'lucide-react';
import { createCodeBlock, createMapEmbed, createTabs } from 'wiki-formant/tiptap';
import { CODE_LANGS, DEFAULT_LANG } from '@/lib/block-utils';
import { resolveMapUrl } from '@/lib/map-utils';

export { Iframe, YouTube, TwitterEmbed } from 'wiki-formant/tiptap';

export const MapEmbed = createMapEmbed({ resolveMapUrl });

export const CodeBlock = createCodeBlock({
  langs: CODE_LANGS,
  defaultLang: DEFAULT_LANG,
  classNames: {
    wrapper: 'code-block-wrapper relative',
    control: 'absolute top-2 right-2 z-10',
    button: 'lang-btn',
    dropdown: 'lang-dropdown',
    option: 'lang-option',
    optionActive: 'text-accent',
  },
  icons: {
    lang: <Code size={12} />,
    chevron: open => <ChevronDown size={12} className={open ? 'transition-transform rotate-180' : 'transition-transform'} />,
    selected: <Check size={12} />,
  },
});

export const { TabGroup, TabItem } = createTabs({
  classNames: {
    editor: 'tabs-editor',
    list: 'tabs-list',
    tab: 'tab-button-edit',
    tabActive: 'active',
    title: 'tab-title-input',
    remove: 'tab-remove',
    add: 'tab-add',
    content: 'tabs-content',
  },
  icons: { add: <Plus size={14} />, remove: <X size={12} /> },
});
