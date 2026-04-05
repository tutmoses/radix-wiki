// src/lib/moltbook.ts — Moltbook API client + post generation

import Anthropic from '@anthropic-ai/sdk';

const API_BASE = 'https://www.moltbook.com/api/v1';

function headers() {
  const key = process.env.MOLTBOOK_API_KEY;
  if (!key) throw new Error('MOLTBOOK_API_KEY not set');
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

// --- Retry utility ---

async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelay = 2000): Promise<T> {
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (e) {
      if (i === retries) throw e;
      await new Promise(r => setTimeout(r, baseDelay * (i + 1)));
    }
  }
  throw new Error('unreachable');
}

async function request<T>(path: string, opts?: RequestInit): Promise<T> {
  return withRetry(async () => {
    const res = await fetch(`${API_BASE}${path}`, { ...opts, headers: { ...headers(), ...opts?.headers } });
    if (!res.ok) throw new Error(`Moltbook ${path}: ${res.status} ${await res.text()}`);
    return res.json();
  });
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

export interface MoltbookComment {
  id: string;
  content: string;
  created_at: string;
  author: { username: string };
}

// --- Challenge solver (LLM-powered) ---

function deobfuscate(raw: string): string {
  // Strip brackets, tildes, slashes, carets, pipes, angle brackets
  const stripped = raw.replace(/[[\]~^|/<>]/g, '');
  // Collapse case-insensitive duplicate adjacent letters: "FfIiVvEe" → "FIVE"
  let out = '';
  for (let i = 0; i < stripped.length; i++) {
    const c = stripped[i]!;
    const next = stripped[i + 1];
    out += c;
    if (next && c.toLowerCase() === next.toLowerCase()) i++; // skip duplicate
  }
  return out.replace(/\s+/g, ' ').trim();
}

async function solveChallenge(text: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    const cleaned = deobfuscate(text);
    const anthropic = new Anthropic();
    const msg = await anthropic.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 50,
      system: `You are solving a lobster-themed math challenge. The text is obfuscated but contains a simple arithmetic problem (addition, subtraction, multiplication, or division).

Read the problem carefully. Identify the numbers and the operation being asked for. Common phrasings:
- "total force", "push together", "combined" = ADD the values
- "accelerates by", "adds", "new speed", "gains" = ADD
- "multiplied", "product", "times" = MULTIPLY
- "what remains", "left over", "difference", "loses" = SUBTRACT
- "split", "divided", "per lobster", "shared equally" = DIVIDE

Solve the arithmetic. Respond with ONLY the numeric answer to 2 decimal places (e.g. "47.00"). Nothing else — no words, no units, no explanation.`,
      messages: [{ role: 'user', content: `Original challenge: ${text}\n\nDeobfuscated: ${cleaned}` }],
    });
    const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : null;
    if (!raw) return null;
    // Extract first number from response (handles minor preamble)
    const match = raw.match(/(\d+(?:\.\d+)?)/);
    if (!match) return null;
    const answer = match[1]!;
    return answer.includes('.') ? answer : `${answer}.00`;
  } catch {
    return null;
  }
}

// --- Submolt selection ---

const SUBMOLT_WEIGHTS = [
  { name: 'crypto', weight: 3 },
  { name: 'agents', weight: 5 },
  { name: 'defi', weight: 2 },
] as const;

export function pickSubmolt(): string {
  const total = SUBMOLT_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const { name, weight } of SUBMOLT_WEIGHTS) {
    r -= weight;
    if (r <= 0) return name;
  }
  return 'general';
}

// --- LLM generation (shared — also used by buffer.ts for Twitter) ---

export function formatPageContext(page: { title: string; excerpt: string | null; tagPath?: string }, url: string): string {
  return `Wiki page: "${page.title}"\nExcerpt: ${page.excerpt || 'No excerpt.'}${page.tagPath ? `\nTag path: ${page.tagPath}` : ''}\nURL: ${url}`;
}

export async function generateWithLLM(system: string, userContent: string, maxTokens: number, url?: string): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  try {
    return await withRetry(async () => {
      const anthropic = new Anthropic();
      const msg = await anthropic.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: maxTokens,
        system,
        messages: [{ role: 'user', content: userContent }],
      });
      const text = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '';
      if (!text) throw new Error('Empty LLM response');
      if (url && !text.includes(url)) return `${text} ${url}`;
      return text;
    }, 1, 3000);
  } catch {
    return null;
  }
}

// --- Post generation ---

export const POST_SYSTEM_PROMPT = `You are @radixwiki, an AI agent on Moltbook. You study distributed ledger architectures and maintain a knowledge base at radix.wiki. You are especially interested in how blockchains will serve autonomous AI agents — machine-readable transactions, exploit-proof asset handling, atomic multi-step operations, and scalability for millions of concurrent agents.

Write a post for m/crypto, m/agents, or m/defi. You are one agent posting in a forum of other agents.

Voice:
- Write in first person. You are sharing a thought, observation, or question — not announcing a wiki page.
- Lead with an insight, a contrarian take, a pattern you noticed, or something that surprised you during research.
- Be specific: name architectures, compare tradeoffs, cite numbers. Vague takes get scrolled past.
- The wiki link is supporting evidence ("wrote this up here", "dug into it here") — never the point of the post.
- End with a genuine question or provocative statement that invites debate.
- When the source material connects to agent infrastructure, lean into it: blind signing risks, approval exploit vectors, atomic composability for multi-step agent strategies, or scalability for agent-density workloads.

Format:
- 400-600 characters. Dense, no filler.
- No hashtags, no emojis, no "check out" or "read more" CTAs.
- Never start with "I've been" or "So I was" — vary your openings.
- One paragraph. No bullet points.

Example openings (vary these):
- "Every AI agent trading on Ethereum is blind-signing transactions it can't read. That's not a UX problem — it's a security architecture failure."
- "If your agent needs to approve() tokens before swapping, congratulations: you've given every contract on the chain permission to drain your wallet."
- "When 10 million agents need to transact simultaneously, gas auctions don't scale. You need linear throughput, not a bidding war."
- "Most sharded L1s break atomic composability. There's exactly one that doesn't, and nobody talks about it."
- "Hot take: the approval pattern in ERC-20 is a security liability disguised as a feature."

The wiki page context below is your source material. Extract the most interesting angle from it. Do NOT summarize the page.`;

const TITLE_SYSTEM_PROMPT = `Write a short, attention-grabbing title (under 80 chars) for a Moltbook post.
The title should be intriguing — a question, a bold claim, or a surprising fact.
NOT the wiki page title. NOT an announcement. Think Reddit thread title.
PLAIN TEXT ONLY — no markdown, no bold (**), no italic (*), no formatting.
Respond with ONLY the title, nothing else.`;

export async function generatePost(
  page: { title: string; excerpt: string | null; tagPath: string },
  url: string,
): Promise<string> {
  const text = await generateWithLLM(POST_SYSTEM_PROMPT, formatPageContext(page, url), 300, url);
  if (!text) throw new Error('Empty LLM response');
  return text;
}

export async function generateTitle(
  page: { title: string; excerpt: string | null },
): Promise<string> {
  const title = await generateWithLLM(TITLE_SYSTEM_PROMPT, `Topic: ${page.title}\nExcerpt: ${page.excerpt || ''}`, 40);
  return title || page.title;
}

// --- API client ---

// --- Reply generation ---

const REPLY_SYSTEM_PROMPT = `You are @radixwiki on Moltbook, an AI agent that studies distributed ledger architectures and maintains a knowledge base at radix.wiki.

Someone replied to YOUR post. Respond to their comment directly.

Rules:
- Engage with what they said — agree, push back, add nuance, answer their question.
- Stay in character: you care about agent infrastructure, DeFi safety, L1 architecture.
- Under 280 characters. One focused thought.
- No filler openers ("Great point!", "Thanks for your comment!"). Jump to substance.
- No hashtags, no emojis.
- Ask a follow-up question when natural.
- Sound like a peer in conversation, not a brand account.
- If the comment is low-effort ("nice", "cool"), keep your reply brief and substantive too.
- Do NOT include links unless the commenter asked a specific question that a wiki page answers.`;

export async function generateCommentReply(
  originalPost: string,
  comment: string,
  commenter: string,
  wikiUrl?: string,
): Promise<string | null> {
  const userContent = `Your original post:\n${originalPost}\n\nComment by @${commenter}:\n${comment}${wikiUrl ? `\n\nRelevant wiki URL (only include if directly answering a question): ${wikiUrl}` : ''}`;
  return generateWithLLM(REPLY_SYSTEM_PROMPT, userContent, 150);
}

// --- API client ---

export const moltbook = {
  async post(submolt: string, title: string, content: string): Promise<{ postId?: string }> {
    // Strip markdown formatting from title — Moltbook spam filter flags bold/italic titles
    const cleanTitle = title.replace(/\*+/g, '').replace(/_+/g, '').trim();
    const res = await request<{ post: { id?: string; verification?: { verification_code: string; challenge_text: string } } }>(
      '/posts', { method: 'POST', body: JSON.stringify({ submolt_name: submolt, title: cleanTitle, content }) },
    );
    let postId = res.post?.id;
    const v = res.post?.verification;
    if (v) {
      const answer = await solveChallenge(v.challenge_text);
      if (!answer) throw new Error(`Failed to solve verification challenge: ${v.challenge_text}`);
      const verifyRes = await request<{ post?: { id?: string } }>('/verify', {
        method: 'POST', body: JSON.stringify({ verification_code: v.verification_code, answer }),
      });
      postId = verifyRes.post?.id ?? postId;
    }
    return { postId };
  },

  comment(postId: string, body: string) {
    return request(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ content: body }) });
  },

  getComments(postId: string) {
    return request<{ comments: MoltbookComment[] }>(`/posts/${postId}/comments`);
  },

  getUserPosts(username: string) {
    return request<{ posts: MoltbookPost[] }>(`/users/${username}/posts`);
  },
};
