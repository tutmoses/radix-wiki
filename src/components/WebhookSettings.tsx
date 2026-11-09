// src/components/WebhookSettings.tsx

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Copy, Check, Loader2, ExternalLink, Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui';
import { EmptyState } from '@/components/EmptyState';
import { cn, sendJson } from '@/lib/utils';
import { useStore } from '@/hooks';
import { tagLabel } from '@/lib/tags';
import { parsePath } from '@/lib/path';
import { useCopy } from 'wiki-formant/react';

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

/** The page or category `/settings?watch=` names, as a subscription target; null where there is none. */
function parseWatchTarget(path = ''): { tagPath: string; slug: string | null; label: string } | null {
  const { tagPath, slug } = parsePath(path.split('/').filter(Boolean));
  if (!tagPath) return null;
  return slug
    ? { tagPath, slug, label: slug.replace(/-/g, ' ') }
    : { tagPath, slug: null, label: tagLabel(tagPath.split('/')) };
}

// ===== Telegram =====

const postTelegram = (body: object) => sendJson('/api/telegram', 'POST', body);

/** A connect link's token lives this long (`/api/telegram`), so polling for it stops then. */
const LINK_TTL = 10 * 60 * 1000;

/**
 * The `/api/telegram` client, shared by /settings and the page-tools watch toggle.
 *
 * `enabled` is false where there is nothing to ask about — the page-tools menu
 * opens for anonymous readers and off-page routes too.
 */
export function useTelegram(enabled = true) {
  const [state, setState] = useState<TelegramState | null>(null);
  const [loading, setLoading] = useState(true);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const showToast = useStore(s => s.showToast);

  const refresh = useCallback(async () => {
    const res = await fetch('/api/telegram');
    if (!res.ok) return false;
    const data: TelegramState = await res.json();
    setState(data);
    return data.connected;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    // Declared inside the effect, mirroring useFetch: the load owns its own
    // cancellation rather than settling into a component that has unmounted.
    const load = async () => {
      try { await refresh(); } catch { /* `state` stays null: the section says it could not load */ }
      finally { if (!cancelled) setLoading(false); }
    };
    load();
    return () => { cancelled = true; if (pollRef.current) clearInterval(pollRef.current); };
  }, [enabled, refresh]);

  const connect = async () => {
    const res = await postTelegram({});
    const link = res.ok ? (await res.json()).deepLink : null;
    if (!link) return;
    setDeepLink(link);
    // One poll at a time: a second press replaces the first's link and its poll.
    if (pollRef.current) clearInterval(pollRef.current);
    const started = Date.now();
    const poll = setInterval(async () => {
      const connected = await refresh().catch(() => false);
      if (pollRef.current !== poll) return;
      const expired = Date.now() - started > LINK_TTL;
      if (!connected && !expired) return;
      clearInterval(poll);
      pollRef.current = null;
      setDeepLink(null);
      showToast(connected ? 'Telegram connected!' : 'The Telegram link expired. Press Connect Telegram for a new one.', connected ? 'success' : 'info');
    }, 3000);
    pollRef.current = poll;
  };

  const subscribe = async (tagPath: string, pageSlug: string | null, events: string[]) => {
    const { ok } = await postTelegram({ tagPath, ...(pageSlug && { pageSlug }), events });
    if (ok) await refresh();
    return ok;
  };

  const unsubscribe = async (id: string) => {
    const { ok } = await fetch(`/api/telegram?id=${id}`, { method: 'DELETE' });
    if (ok) await refresh();
    return ok;
  };

  const disconnect = async () => {
    const { ok } = await fetch('/api/telegram', { method: 'DELETE' });
    if (ok) setState({ connected: false, chatId: null, subscriptions: [] });
    return ok;
  };

  // The bot's /stop pauses every row at once, and a subscribe resumes them all.
  const paused = !!state?.subscriptions.some(s => !s.active);

  return { state, loading, paused, deepLink, connect, subscribe, unsubscribe, disconnect };
}

function TelegramSection({ watch }: { watch?: string }) {
  const { state, loading, paused, deepLink, connect, subscribe, unsubscribe, disconnect } = useTelegram();
  const [subscribing, setSubscribing] = useState(false);
  const showToast = useStore(s => s.showToast);

  const context = parseWatchTarget(watch);

  const handleSubscribe = async () => {
    if (!context) return;
    setSubscribing(true);
    // A section subscriber wants the new pages most of all; without
    // `page.created` a subscription to `blog` never delivered an issue.
    const events = context.slug
      ? ['page.updated', 'comment.created']
      : ['page.created', 'page.updated', 'comment.created'];
    try {
      if (await subscribe(context.tagPath, context.slug, events)) showToast(paused ? `Subscribed to ${context.label}; notifications resumed` : `Subscribed to ${context.label}`);
    } finally { setSubscribing(false); }
  };

  const handleUnsubscribe = async (id: string) => {
    if (await unsubscribe(id)) showToast('Unsubscribed');
  };

  const handleDisconnect = async () => {
    if (await disconnect()) showToast('Telegram disconnected');
  };

  if (loading) return null;
  if (!state) return <p className="text-small text-text-muted px-3 py-2">Telegram settings could not be loaded. Reload to try again.</p>;

  // Scoped subscriptions, paused or not (excludes the connection-only record with no scope)
  const subs = state.subscriptions.filter(s => s.tagPath !== '');

  // Check if current context is already subscribed
  const isCurrentSubscribed = context && subs.some(s =>
    s.tagPath === context.tagPath && s.pageSlug === (context.slug ?? ''),
  );

  return (
    <div className="telegram-section">
      <div className="spread px-3 py-2">
        <span className="text-small font-medium">Telegram</span>
        {state.connected && (
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
      ) : state.connected ? (
        <div className="telegram-subs">
          {/* Subscribe to current context */}
          {paused && (
            <p className="text-xs text-text-muted">Paused from Telegram with /stop. Subscribing to any page or section resumes them all.</p>
          )}
          {context && (!isCurrentSubscribed || paused) && (
            <button onClick={handleSubscribe} disabled={subscribing} className="telegram-subscribe-btn">
              <Bell size={14} />
              <span>{isCurrentSubscribed ? 'Resume notifications' : context.slug ? `Subscribe to "${context.label}"` : `Subscribe to ${context.label}`}</span>
              {subscribing && <Loader2 size={12} className="animate-spin" />}
            </button>
          )}
          {context && isCurrentSubscribed && !paused && (
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
                  <button onClick={() => handleUnsubscribe(sub.id)} className="icon-btn icon-btn-remove" title="Unsubscribe" aria-label="Unsubscribe">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {subs.length === 0 && !context && (
            <EmptyState title="No subscriptions yet." description="Use Watch this page in a page's Tools menu to get its edits and comments in Telegram." />
          )}
        </div>
      ) : (
        <div className="telegram-connect">
          <Button variant="ghost" size="sm" onClick={connect}>Connect Telegram</Button>
        </div>
      )}
    </div>
  );
}

// ===== Webhooks Section =====

/** `watch` is a page or section path to offer a Telegram subscription for. */
export function WebhookSettings({ watch }: { watch?: string }) {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [newSecret, setNewSecret] = useState<string | null>(null);
  // `useCopy` from `wiki-formant/react`. The version here did not await the
  // write and showed "Copied" whether or not it succeeded — for a webhook secret
  // shown once, that is the reader pasting nothing and having no way to tell.
  const { copied, copy } = useCopy();
  const [url, setUrl] = useState('https://');
  const [events, setEvents] = useState<string[]>(['page.created', 'page.updated']);
  const [tagFilter, setTagFilter] = useState('');
  const [error, setError] = useState('');
  const showToast = useStore(s => s.showToast);

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch('/api/webhooks');
      if (res.ok) setWebhooks(await res.json());
    } catch { /* the list stays as it was */ }
    finally { setLoading(false); }
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
    try {
      const res = await sendJson('/api/webhooks', 'POST', { url, events, tagPathFilter: tagFilter || undefined });
      if (res.ok) {
        const webhook = await res.json();
        setNewSecret(webhook.secret);
        setShowForm(false);
        setUrl('https://');
        setEvents(['page.created', 'page.updated']);
        setTagFilter('');
        await fetchWebhooks();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || 'Failed to create');
      }
    } catch { setError('Failed to create: the request did not reach the wiki.'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setWebhooks(prev => prev.filter(w => w.id !== id));
      showToast('Webhook deleted');
    }
  };

  const copySecret = () => {
    if (newSecret) void copy(newSecret);
  };

  return (
    <div className="webhook-content">
      {/* Telegram section */}
      <TelegramSection watch={watch} />

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
                <button onClick={copySecret} className="icon-btn" title="Copy secret" aria-label="Copy secret">
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <button onClick={() => setNewSecret(null)} className="text-xs text-text-muted hover:text-text cursor-pointer">Dismiss</button>
            </div>
          )}

          {/* Webhook list */}
          {webhooks.length === 0 && !showForm ? (
            <EmptyState title="No custom webhooks." action={<Button variant="ghost" size="sm" onClick={() => setShowForm(true)}><Plus size={14} />Add webhook</Button>} />
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
                  <button onClick={() => handleDelete(w.id)} className="icon-btn icon-btn-remove" title="Delete webhook" aria-label="Delete webhook">
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
