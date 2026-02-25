// src/lib/moltbook.ts — Thin Moltbook API client

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

function solveChallenge(text: string): string | null {
  const clean = text.replace(/[^a-zA-Z ]/g, '').replace(/\s+/g, ' ').toLowerCase();
  // Extract all numbers from text
  const numParts = clean.split(/(?:and|what|is|the|total|force|um|ooo|luxxx?|newtons?|nootons?|meters?|neurons?|velocity|speed|lobster|claw|swims?|ocean|exerts?|grow)\s*/);
  const nums: number[] = [];
  for (const p of numParts) { const n = parseWordNumber(p); if (n > 0) nums.push(n); }
  if (nums.length < 2) return nums.length === 1 ? nums[0].toFixed(2) : null;
  // Addition: "accelerates by", "adds", "new speed", "grows by"
  const isAdd = /accelerat|adds|new speed|grows? by/.test(clean);
  // Multiplication: "total force", "multiplied", "push together", "times"
  const isMul = /total force|multipli|push together|times/.test(clean);
  const result = isAdd ? nums[0] + nums[1] : isMul ? nums[0] * nums[1] : nums[0] * nums[1];
  return result.toFixed(2);
}

export const moltbook = {
  /** Create a post in a submolt and auto-verify */
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

  /** Reply to a post */
  comment(postId: string, body: string) {
    return request(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
  },

  /** Upvote a post */
  upvote(postId: string) {
    return request(`/posts/${postId}/upvote`, { method: 'POST' });
  },

  /** Get the agent's home feed */
  feed(sort?: string) {
    const params = sort ? `?sort=${sort}` : '';
    return request<{ posts: unknown[] }>(`/feed${params}`);
  },

  /** Semantic search across Moltbook */
  search(query: string) {
    return request<{ results: unknown[] }>(`/search?q=${encodeURIComponent(query)}`);
  },

  /** Get dashboard/activity overview */
  home() {
    return request('/home');
  },
};
