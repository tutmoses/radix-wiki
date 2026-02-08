// src/lib/shiki.ts - Shared syntax highlighting

type Highlighter = Awaited<ReturnType<typeof import('shiki').createHighlighter>>;

export const SHIKI_LANGS = ['javascript', 'typescript', 'css', 'json', 'bash', 'python', 'rust', 'sql', 'html', 'xml', 'jsx', 'tsx', 'markdown', 'yaml', 'toml'] as const;
const VALID_LANGS = new Set<string>(SHIKI_LANGS);
export const DEFAULT_LANG = 'rust';

let shikiInstance: Highlighter | null = null;
let shikiPromise: Promise<Highlighter> | null = null;

export function getShiki(): Promise<Highlighter> {
  if (shikiInstance) return Promise.resolve(shikiInstance);
  if (!shikiPromise) {
    shikiPromise = import('shiki').then(async ({ createHighlighter }) => {
      shikiInstance = await createHighlighter({ themes: ['github-dark'], langs: [...SHIKI_LANGS] });
      return shikiInstance;
    });
  }
  return shikiPromise;
}

export function highlightCodeBlocks(container: HTMLElement, highlighter: Highlighter) {
  container.querySelectorAll('pre:not([data-highlighted]) code, pre:not([data-highlighted]):not(:has(code))').forEach(el => {
    const pre = el.tagName === 'PRE' ? el : el.parentElement;
    if (!pre || pre.hasAttribute('data-highlighted')) return;
    const code = el.textContent || '';
    if (!code.trim()) return;
    const langMatch = el.className?.match(/language-(\w+)/);
    const lang = VALID_LANGS.has(langMatch?.[1] || '') ? langMatch![1] : DEFAULT_LANG;
    const html = highlighter.codeToHtml(code, { lang, theme: 'github-dark' });
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const newPre = temp.firstElementChild;
    if (newPre) {
      newPre.setAttribute('data-highlighted', 'true');
      pre.replaceWith(newPre);
    }
  });
}