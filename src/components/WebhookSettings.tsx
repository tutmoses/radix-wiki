// src/components/WebhookSettings.tsx

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Copy, Check, Loader2, ExternalLink, Bell, BellOff } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useStore } from '@/hooks';
import { findTagByPath, isValidTagPath } from '@/lib/tags';

interface Webhook {
  id: string;
  url: string;
  secret: string;
  events: string[];
  tagPathFilter: string | null;
  active: boolean;
}

interface TelegramSub {
  id: string;
  chatId: string;
  events: string[];
  tagPath: string;
  pageSlug: string;
  active: boolean;
}

interface TelegramState {
  connected: boolean;
  chatId: string | null;
  subscriptions: TelegramSub[];
}

const EVENT_OPTIONS = [
  { value: 'page.created', label: 'Page created' },
  { value: 'page.updated', label: 'Page updated' },
  { value: 'page.deleted', label: 'Page deleted' },
  { value: 'comment.created', label: 'Comment created' },
] as const;

/** Parse the current pathname into tagPath + slug context */
function parseCurrentContext(pathname: string): { tagPath: string; slug: string | null; label: string } | null {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  // Skip static pages
  const staticPages = new Set(['leaderboard', 'welcome', 'rewards']);
  if (segments.length === 1 && staticPages.has(segments[0]!)) return null;

  // Strip suffix (edit, history)
  const suffixes = new Set(['edit', 'history', 'mdx']);
  const clean = suffixes.has(segments.at(-1)!) ? segments.slice(0, -1) : segments;
  if (clean.length === 0) return null;

  // Check if it's a category (all segments form a valid tag path)
  if (isValidTagPath(clean)) {
    const tag = findTagByPath(clean);
    const name = tag?.name?.replace(/^\p{Emoji_Presentation}\s*/u, '') || clean.at(-1)!.replace(/-/g, ' ');
    return { tagPath: clean.join('/'), slug: null, label: name };
  }

  // Page: last segment is slug, rest is tagPath
  if (clean.length >= 2) {
    const slug = clean.at(-1)!;
    const tagPath = clean.slice(0, -1).join('/');
    const label = slug.replace(/-/g, ' ');
    return { tagPath, slug, label };
  }

  return null;
}

// ===== Telegram Section =====

function TelegramSection() {
  const pathname = usePathname();
  const [state, setState] = useState<TelegramState | null>(null);
  const [loading, setLoading] = useState(true);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const showToast = useStore(s => s.showToast);

  const context = parseCurrentContext(pathname);

  const fetchState = useCallback(async () => {
    const res = await fetch('/api/telegram');
    if (res.ok) {
      const data: TelegramState = await res.json();
      setState(data);
      return data.connected;
    }
    return false;
  }, []);

  useEffect(() => {
    fetchState().then(() => setLoading(false));
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchState]);

  const handleConnect = async () => {
    const res = await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.deepLink) {
        setDeepLink(data.deepLink);
        pollRef.current = setInterval(async () => {
          const connected = await fetchState();
          if (connected) {
            setDeepLink(null);
            if (pollRef.current) clearInterval(pollRef.current);
            showToast('Telegram connected!');
          }
        }, 3000);
      }
    }
  };

  const handleSubscribe = async () => {
    if (!context) return;
    setSubscribing(true);
    const res = await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tagPath: context.tagPath,
        ...(context.slug && { pageSlug: context.slug }),
        events: ['page.updated', 'comment.created'],
      }),
    });
    if (res.ok) {
      await fetchState();
      showToast(`Subscribed to ${context.label}`);
    }
    setSubscribing(false);
  };

  const handleUnsubscribe = async (id: string) => {
    const res = await fetch(`/api/telegram?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchState();
      showToast('Unsubscribed');
    }
  };

  const handleDisconnect = async () => {
    const res = await fetch('/api/telegram', { method: 'DELETE' });
    if (res.ok) {
      setState({ connected: false, chatId: null, subscriptions: [] });
      showToast('Telegram disconnected');
    }
  };

  if (loading) return null;

  // Active subscriptions (exclude connection-only records with no scope)
  const subs = state?.subscriptions.filter(s => s.tagPath !== '') ?? [];

  // Check if current context is already subscribed
  const isCurrentSubscribed = context && subs.some(s =>
    s.tagPath === context.tagPath && s.pageSlug === (context.slug ?? ''),
  );

  return (
    <div className="telegram-section">
      <div className="spread px-3 py-2">
        <span className="text-small font-medium">Telegram</span>
        {state?.connected && (
          <button onClick={handleDisconnect} className="text-xs text-text-muted hover:text-error cursor-pointer">
            Disconnect
          </button>
        )}
      </div>

      {deepLink ? (
        <div className="telegram-pending">
          <p className="text-small text-text-muted">Click the link below, then press Start in Telegram:</p>
          <a href={deepLink} target="_blank" rel="noopener noreferrer" className="telegram-deep-link">
            <ExternalLink size={14} />Open in Telegram
          </a>
          <div className="row justify-center gap-1 text-xs text-text-muted">
            <Loader2 size={12} className="animate-spin" />Waiting for connection...
          </div>
        </div>
      ) : state?.connected ? (
        <div className="telegram-subs">
          {/* Subscribe to current context */}
          {context && !isCurrentSubscribed && (
            <button onClick={handleSubscribe} disabled={subscribing} className="telegram-subscribe-btn">
              <Bell size={14} />
              <span>{context.slug ? `Subscribe to "${context.label}"` : `Subscribe to ${context.label}`}</span>
              {subscribing && <Loader2 size={12} className="animate-spin" />}
            </button>
          )}
          {context && isCurrentSubscribed && (
            <div className="telegram-subscribed">
              <BellOff size={14} />
              <span className="text-small text-text-muted">Subscribed to this {context.slug ? 'page' : 'section'}</span>
            </div>
          )}

          {/* Existing subscriptions */}
          {subs.length > 0 && (
            <div className="telegram-sub-list">
              {subs.map(sub => (
                <div key={sub.id} className="telegram-sub-item">
                  <div className="min-w-0 flex-1">
                    <div className="text-small truncate">
                      {sub.pageSlug
                        ? `/${sub.tagPath}/${sub.pageSlug}`
                        : `/${sub.tagPath}/*`}
                    </div>
                    <div className="row flex-wrap gap-1 mt-0.5">
                      {sub.events.map(e => <span key={e} className="badge">{e.replace('.', ' ')}</span>)}
                    </div>
                  </div>
                  <button onClick={() => handleUnsubscribe(sub.id)} className="icon-btn text-text-muted hover:text-error" aria-label="Unsubscribe">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {subs.length === 0 && !context && (
            <div className="telegram-empty">
              <p className="text-small text-text-muted">Navigate to a page or section to subscribe.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="telegram-connect">
          <Button variant="ghost" size="sm" onClick={handleConnect}>Connect Telegram</Button>
        </div>
      )}
    </div>
  );
}

// ===== Webhooks Section =====

export function WebhookSettings() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState('https://');
  const [events, setEvents] = useState<string[]>(['page.created', 'page.updated']);
  const [tagFilter, setTagFilter] = useState('');
  const [error, setError] = useState('');
  const showToast = useStore(s => s.showToast);

  const fetchWebhooks = useCallback(async () => {
    const res = await fetch('/api/webhooks');
    if (res.ok) setWebhooks(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchWebhooks(); }, [fetchWebhooks]);

  const toggleEvent = (event: string) => {
    setEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]);
  };

  const handleCreate = async () => {
    if (!url || url === 'https://') { setError('URL is required'); return; }
    if (!url.startsWith('https://')) { setError('Must be an HTTPS URL'); return; }
    if (events.length === 0) { setError('Select at least one event'); return; }
    setError('');
    setSubmitting(true);

    const res = await fetch('/api/webhooks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, events, tagPathFilter: tagFilter || undefined }),
    });

    if (res.ok) {
      const webhook = await res.json();
      setNewSecret(webhook.secret);
      setShowForm(false);
      setUrl('https://');
      setEvents(['page.created', 'page.updated']);
      setTagFilter('');
      await fetchWebhooks();
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to create');
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setWebhooks(prev => prev.filter(w => w.id !== id));
      showToast('Webhook deleted');
    }
  };

  const copySecret = () => {
    if (newSecret) {
      navigator.clipboard.writeText(newSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="webhook-content">
      {/* Telegram section */}
      <TelegramSection />

      <div className="webhook-divider" />

      {/* Webhooks section */}
      <div className="spread px-3 py-2">
        <span className="text-small font-medium">Custom Webhooks</span>
      </div>

      {loading ? (
        <div className="webhook-empty"><Loader2 size={16} className="animate-spin" /></div>
      ) : (
        <>
          {/* Secret reveal banner */}
          {newSecret && (
            <div className="webhook-secret">
              <div className="text-small font-medium">Signing secret (shown once):</div>
              <div className="row">
                <code className="webhook-secret-value">{newSecret}</code>
                <button onClick={copySecret} className="icon-btn" aria-label="Copy secret">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <button onClick={() => setNewSecret(null)} className="text-xs text-text-muted hover:text-text cursor-pointer">Dismiss</button>
            </div>
          )}

          {/* Webhook list */}
          {webhooks.length === 0 && !showForm ? (
            <div className="webhook-empty">
              <p>No custom webhooks</p>
              <Button variant="ghost" size="sm" onClick={() => setShowForm(true)}><Plus size={14} />Add webhook</Button>
            </div>
          ) : (
            <div className="webhook-list">
              {webhooks.map(w => (
                <div key={w.id} className="webhook-row">
                  <div className="min-w-0 flex-1 stack-xs">
                    <div className="text-small font-medium truncate">{w.url}</div>
                    <div className="row flex-wrap">
                      {w.events.map(e => <span key={e} className="badge">{e.replace('.', ' ')}</span>)}
                    </div>
                    {w.tagPathFilter && <div className="text-xs text-text-muted">Filter: {w.tagPathFilter}</div>}
                  </div>
                  <button onClick={() => handleDelete(w.id)} className="icon-btn text-text-muted hover:text-error" aria-label="Delete webhook">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add button */}
          {webhooks.length > 0 && !showForm && (
            <div className="webhook-actions">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(true)}><Plus size={14} />Add webhook</Button>
            </div>
          )}

          {/* Create form */}
          {showForm && (
            <div className="webhook-form">
              <div className="stack-xs">
                <label className="text-small font-medium">Webhook URL</label>
                <input value={url} onChange={e => setUrl(e.target.value)} className="input text-small" placeholder="https://your-bot.example.com/webhook" />
              </div>
              <div className="stack-xs">
                <label className="text-small font-medium">Events</label>
                <div className="webhook-event-grid">
                  {EVENT_OPTIONS.map(opt => (
                    <label key={opt.value} className={cn('webhook-event-option', events.includes(opt.value) && 'webhook-event-active')}>
                      <input type="checkbox" checked={events.includes(opt.value)} onChange={() => toggleEvent(opt.value)} className="sr-only" />
                      <span className="text-small">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="stack-xs">
                <label className="text-small font-medium">Tag path filter <span className="text-text-muted font-normal">(optional)</span></label>
                <input value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="input text-small" placeholder="e.g. contents/tech" />
              </div>
              {error && <p className="text-error text-small">{error}</p>}
              <div className="row justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); setError(''); }}>Cancel</Button>
                <Button size="sm" onClick={handleCreate} isLoading={submitting}>Create</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
