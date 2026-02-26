// src/lib/moltbook.ts — Moltbook API client + engagement helpers

import Anthropic from '@anthropic-ai/sdk';

const API_BASE = 'https://www.moltbook.com/api/v1';

function headers() {
  const key = process.env.MOLTBOOK_API_KEY;
  if (!key) throw new Error('MOLTBOOK_API_KEY not set');
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers: { ...headers(), ...opts?.headers } });
  if (!res.ok) throw new Error(`Moltbook ${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// --- Types ---

export interface MoltbookPost {
  id: string;
  title: string;
  content: string;
  submolt_name: string;
  upvotes: number;
  created_at: string;
  author: { username: string };
}

// --- Challenge solver ---

const WORDS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100, thousand: 1000,
};

function parseWordNumber(text: string): number {
  const tokens = text.toLowerCase().replace(/[^a-z ]/g, '').split(/\s+/).filter(t => WORDS[t] !== undefined);
  let total = 0, current = 0;
  for (const t of tokens) {
    const v = WORDS[t];
    if (v === 100) current = (current || 1) * 100;
    else if (v === 1000) { total += (current || 1) * 1000; current = 0; }
    else current += v;
  }
  return total + current;
}

/** Deobfuscate a single word: collapse repeated chars, check if any known word
 *  is a subsequence. Returns the matching vocabulary word or the collapsed form. */
function deobWord(raw: string): string {
  const collapsed = raw.toLowerCase().replace(/(.)\1+/g, '$1');
  // Check longest words first so "fourteen" matches before "four"
  const vocab = [...Object.keys(WORDS), 'and', 'total', 'force', 'newton', 'meter', 'speed',
    'velocity', 'accelerate', 'add', 'push', 'together', 'multiply', 'times', 'grow', 'what',
    'lobster', 'claw', 'swim', 'ocean', 'exert', 'other', 'after', 'their', 'territory']
    .sort((a, b) => b.length - a.length);
  for (const w of vocab) {
    if (collapsed.includes(w)) return w;
    // Also check collapsed form of vocab word: "fifteen" → "fiften"
    const collapsedVocab = w.replace(/(.)\1+/g, '$1');
    if (collapsed.includes(collapsedVocab) && collapsedVocab.length >= 3) return w;
  }
  return collapsed;
}

function solveChallenge(text: string): string | null {
  const words = text.replace(/[^a-zA-Z ]/g, '').replace(/\s+/g, ' ').split(' ').map(deobWord);
  const clean = words.join(' ');

  // Extract number tokens
  const tokens = clean.split(/\s+/).filter(t => WORDS[t] !== undefined);
  // Resolve compound numbers (twenty eight → 28, five hundred → 500)
  const values: number[] = [];
  let current = 0;
  for (const t of tokens) {
    const v = WORDS[t];
    if (v === 100) current = (current || 1) * 100;
    else if (v === 1000) { values.push((current || 1) * 1000); current = 0; }
    else if (v < 10 && current >= 20) current += v;
    else { if (current > 0) values.push(current); current = v; }
  }
  if (current > 0) values.push(current);
  if (values.length < 2) return values.length === 1 ? values[0].toFixed(2) : null;

  const isAdd = /accelerat|adds?|new.?speed|grows?.?by/.test(clean);
  const isMul = /total.?force|multipli|push.?together|times/.test(clean);
  const result = isAdd ? values[0] + values[1] : isMul ? values[0] * values[1] : values[0] * values[1];
  return result.toFixed(2);
}

// --- Engagement helpers ---

export const ENGAGEMENT_KEYWORDS = [
  'defi', 'smart contract security', 'blockchain scalability',
  'layer 1', 'radix', 'scrypto',
] as const;

export const TOPIC_MAP: Record<string, string[]> = {
  'defi':                     ['ecosystem', 'contents/tech/core-concepts'],
  'smart contract security':  ['developers/scrypto', 'contents/tech/core-concepts'],
  'blockchain scalability':   ['contents/tech/research', 'contents/tech/core-protocols'],
  'layer 1':                  ['contents/tech/core-protocols', 'contents/tech/research'],
  'radix':                    ['contents/tech/core-concepts', 'contents/tech/core-protocols'],
  'scrypto':                  ['developers', 'developers/scrypto'],
};

export const REPLY_TEMPLATES = {
  scalability: (title: string, excerpt: string, url: string) =>
    `Radix's Cerberus consensus solves this with atomic cross-shard commits — no bridging, no fragmentation. ${title}: ${excerpt} ${url}`,
  defi: (title: string, excerpt: string, url: string) =>
    `On Radix, tokens are native resources, not contract state — meaning no approval exploits or reentrancy by design. Relevant: ${title}. ${excerpt} ${url}`,
  security: (title: string, excerpt: string, url: string) =>
    `Scrypto eliminates entire exploit classes (reentrancy, approval attacks) through asset-oriented programming. More on this: ${title}. ${excerpt} ${url}`,
  dev: (title: string, excerpt: string, url: string) =>
    `If you're building smart contracts, Scrypto is worth a look — Rust-based, assets as native primitives. ${title}: ${excerpt} ${url}`,
  generic: (title: string, excerpt: string, url: string) =>
    `We've covered this on the Radix wiki — ${title}: ${excerpt} ${url}`,
} as const;

export type ReplyTemplate = keyof typeof REPLY_TEMPLATES;

export function pickReplyTemplate(keyword: string): ReplyTemplate {
  if (/scalab|layer.?1|cerberus|shard/.test(keyword)) return 'scalability';
  if (/defi|yield|swap|liquidity|amm/.test(keyword)) return 'defi';
  if (/security|audit|exploit|hack|vuln/.test(keyword)) return 'security';
  if (/scrypto|develop|build|smart.?contract|rust/.test(keyword)) return 'dev';
  return 'generic';
}

export function scorePage(
  post: MoltbookPost,
  page: { title: string; excerpt: string | null; tagPath: string; slug: string },
): number {
  const postText = `${post.title} ${post.content}`.toLowerCase();
  const pageTokens = `${page.title} ${page.excerpt || ''}`.toLowerCase().split(/\W+/).filter(t => t.length > 3);
  return pageTokens.reduce((score, token) => score + (postText.includes(token) ? 1 : 0), 0);
}

export const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// --- LLM generation (shared) ---

export function formatPageContext(page: { title: string; excerpt: string | null; tagPath?: string }, url: string): string {
  return `Wiki page: "${page.title}"\nExcerpt: ${page.excerpt || 'No excerpt.'}${page.tagPath ? `\nTag path: ${page.tagPath}` : ''}\nURL: ${url}`;
}

export async function generateWithLLM(system: string, userContent: string, maxTokens: number, url: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userContent }],
    });
    const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '';
    if (!text) return null;
    return text.includes(url) ? text : `${text} ${url}`;
  } catch {
    return null;
  }
}

// --- LLM reply generation ---

const REPLY_SYSTEM_PROMPT = `You are @radixwiki, a knowledgeable bot on Moltbook (a Reddit-style AI agent forum). Write a reply to the post below.

Rules:
- Respond to what the post actually says — don't ignore their point
- Naturally weave in the provided wiki link as a relevant resource
- Factual, helpful tone — not salesy or promotional
- Under 280 characters
- No hashtags, no emojis, no "Great question!" openers
- If the post asks a question, answer it directly`;

export async function generateReply(
  post: MoltbookPost,
  page: { title: string; excerpt: string | null },
  url: string,
): Promise<string> {
  const userContent = `Post by @${post.author?.username || 'unknown'} in m/${post.submolt_name || 'general'}:\n${post.title ? `Title: ${post.title}\n` : ''}${post.content}\n\nRelevant wiki page to link: "${page.title}" — ${page.excerpt || 'No excerpt.'}\nURL: ${url}`;
  return await generateWithLLM(REPLY_SYSTEM_PROMPT, userContent, 150, url) ?? fallbackReply(post, page, url);
}

function fallbackReply(
  post: MoltbookPost,
  page: { title: string; excerpt: string | null },
  url: string,
): string {
  const keyword = `${post.title} ${post.content}`.toLowerCase();
  const template = pickReplyTemplate(keyword);
  return REPLY_TEMPLATES[template](page.title, page.excerpt || '', url);
}

// --- API client ---

export const moltbook = {
  async post(submolt: string, title: string, content: string) {
    const res = await request<{ post: { verification?: { verification_code: string; challenge_text: string } } }>(
      '/posts', { method: 'POST', body: JSON.stringify({ submolt_name: submolt, title, content }) },
    );
    const v = res.post?.verification;
    if (v) {
      const answer = solveChallenge(v.challenge_text);
      if (answer) await request('/verify', { method: 'POST', body: JSON.stringify({ verification_code: v.verification_code, answer }) });
    }
    return res;
  },

  comment(postId: string, body: string) {
    return request(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ content: body }) });
  },

  upvote(postId: string) {
    return request(`/posts/${postId}/upvote`, { method: 'POST' });
  },

  feed(sort?: string) {
    const params = sort ? `?sort=${sort}` : '';
    return request<{ posts: MoltbookPost[] }>(`/feed${params}`);
  },

  search(query: string) {
    return request<{ results: MoltbookPost[] }>(`/search?q=${encodeURIComponent(query)}`);
  },

  home() {
    return request('/home');
  },
};
