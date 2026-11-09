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
import type { WebhookEvent } from '@/lib/webhooks';

interface Webhook {
  id: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  tagPathFilter: string | null;
  active: boolean;
}

interface TelegramSub {
  id: string;
  chatId: string;
  events: WebhookEvent[];
  tagPath: string;
  pageSlug: string;
  active: boolean;
}

interface TelegramState {
  connected: boolean;
  chatId: string | null;
  subscriptions: TelegramSub[];
}

/** The reader's Telegram link: loading, failed to load, or loaded. */
type Telegram =
  | { status: 'loading' }
  | { status: 'failed' }
  | ({ status: 'ready' } & TelegramState);

/** A connect link: none asked for, being made, waiting for Start in Telegram (polled until then), or refused. */
type ConnectLink =
  | { status: 'none' }
  | { status: 'requesting' }
  | { status: 'pending'; deepLink: string }
  | { status: 'failed'; error: string };

const EVENT_OPTIONS: { value: WebhookEvent; label: string }[] = [
  { value: 'page.created', label: 'Page created' },
  { value: 'page.updated', label: 'Page updated' },
  { value: 'page.deleted', label: 'Page deleted' },
  { value: 'comment.created', label: 'Comment created' },
];

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
  const [telegram, setTelegram] = useState<Telegram>({ status: 'loading' });
  const [link, setLink] = useState<ConnectLink>({ status: 'none' });
  // Numbers each connect: a request or poll answers only while its attempt is the newest.
  const attemptRef = useRef(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const showToast = useStore(s => s.showToast);

  const stopPoll = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  };

  /** Null where the route did not answer; a refresh after the first load keeps what is on screen. */
  const refresh = useCallback(async (): Promise<TelegramState | null> => {
    const res = await fetch('/api/telegram');
    if (!res.ok) return null;
    const data: TelegramState = await res.json();
    setTelegram({ status: 'ready', ...data });
    return data;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    refresh().catch(() => null).then(data => { if (!cancelled && !data) setTelegram({ status: 'failed' }); });
    return () => { cancelled = true; attemptRef.current++; stopPoll(); };
  }, [enabled, refresh]);

  // One attempt at a time: the button is disabled while a link is being made,
  // and a later press retires the earlier link and its poll.
  const connect = async () => {
    if (link.status === 'requesting') return;
    const attempt = ++attemptRef.current;
    stopPoll();
    setLink({ status: 'requesting' });
    try {
      const res = await postTelegram({});
      const data = await res.json().catch(() => ({}));
      if (attempt !== attemptRef.current) return;
      if (!res.ok || !data.deepLink) { setLink({ status: 'failed', error: data.error || 'A Telegram link could not be made. Try again.' }); return; }
      setLink({ status: 'pending', deepLink: data.deepLink });
      const started = Date.now();
      pollRef.current = setInterval(async () => {
        const connected = (await refresh().catch(() => null))?.connected ?? false;
        if (attempt !== attemptRef.current) return;
        const expired = Date.now() - started > LINK_TTL;
        if (!connected && !expired) return;
        attemptRef.current++;
        stopPoll();
        setLink({ status: 'none' });
        showToast(connected ? 'Telegram connected!' : 'The Telegram link expired. Press Connect Telegram for a new one.', connected ? 'success' : 'info');
      }, 3000);
    } catch {
      if (attempt === attemptRef.current) setLink({ status: 'failed', error: 'The request did not reach the wiki. Try again.' });
    }
  };

  /** Each answers whether the change was made; a dropped request is a no. */
  const subscribe = async (tagPath: string, pageSlug: string | null, events: WebhookEvent[]) => {
    const ok = await postTelegram({ tagPath, ...(pageSlug && { pageSlug }), events }).then(r => r.ok, () => false);
    if (ok) await refresh().catch(() => null);
    return ok;
  };

  const unsubscribe = async (id: string) => {
    const ok = await fetch(`/api/telegram?id=${id}`, { method: 'DELETE' }).then(r => r.ok, () => false);
    if (ok) await refresh().catch(() => null);
    return ok;
  };

  const disconnect = async () => {
    const ok = await fetch('/api/telegram', { method: 'DELETE' }).then(r => r.ok, () => false);
    if (ok) setTelegram({ status: 'ready', connected: false, chatId: null, subscriptions: [] });
    return ok;
  };

  // The bot's /stop pauses every row at once, and a subscribe resumes them all.
  const paused = telegram.status === 'ready' && telegram.subscriptions.some(s => !s.active);

  return { telegram, paused, link, connect, subscribe, unsubscribe, disconnect };
}

function TelegramSection({ watch }: { watch?: string }) {
  const { telegram: state, paused, link, connect, subscribe, unsubscribe, disconnect } = useTelegram();
  const [subscribing, setSubscribing] = useState(false);
  const showToast = useStore(s => s.showToast);

  const context = parseWatchTarget(watch);

  const handleSubscribe = async () => {
    if (!context) return;
    setSubscribing(true);
    // A section subscriber wants the new pages most of all; without
    // `page.created` a subscription to `blog` never delivered an issue.
    const events: WebhookEvent[] = context.slug
      ? ['page.updated', 'comment.created']
      : ['page.created', 'page.updated', 'comment.created'];
    try {
      if (await subscribe(context.tagPath, context.slug, events)) showToast(paused ? `Subscribed to ${context.label}; notifications resumed` : `Subscribed to ${context.label}`);
      else showToast(`Could not subscribe to ${context.label}. Try again.`, 'info');
    } finally { setSubscribing(false); }
  };

  const handleUnsubscribe = async (id: string) => {
    if (await unsubscribe(id)) showToast('Unsubscribed');
    else showToast('Could not unsubscribe. Try again.', 'info');
  };

  const handleDisconnect = async () => {
    if (await disconnect()) showToast('Telegram disconnected');
    else showToast('Telegram could not be disconnected. Try again.', 'info');
  };

  if (state.status === 'loading') return null;
  if (state.status === 'failed') return <p className="text-small text-text-muted px-3 py-2">Telegram settings could not be loaded. Reload to try again.</p>;

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

      {link.status === 'pending' ? (
        <div className="telegram-pending">
          <p className="text-small text-text-muted">Click the link below, then press Start in Telegram:</p>
          <a href={link.deepLink} target="_blank" rel="noopener noreferrer" className="telegram-deep-link">
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
          <Button variant="ghost" size="sm" onClick={connect} isLoading={link.status === 'requesting'}>Connect Telegram</Button>
          {link.status === 'failed' && <p className="text-error text-small">{link.error}</p>}
        </div>
      )}
    </div>
  );
}

// ===== Webhooks Section =====

/** The reader's webhooks: loading, failed to load, or the list. */
type WebhookList =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'loaded'; items: Webhook[] };

/** The create form: shut, open (with the last refusal, if any), or its request in flight. */
type Form =
  | { kind: 'closed' }
  | { kind: 'open'; error: string | null }
  | { kind: 'submitting' };

const DEFAULT_EVENTS: WebhookEvent[] = ['page.created', 'page.updated'];

/** The listing shows a secret's tail only; the full one is shown once, on creation. */
const maskSecret = (w: Webhook): Webhook => ({ ...w, secret: `...${w.secret.slice(-8)}` });

/** `watch` is a page or section path to offer a Telegram subscription for. */
export function WebhookSettings({ watch }: { watch?: string }) {
  const [list, setList] = useState<WebhookList>({ status: 'loading' });
  const [form, setForm] = useState<Form>({ kind: 'closed' });
  const [newSecret, setNewSecret] = useState<string | null>(null);
  // `useCopy` from `wiki-formant/react`. The version here did not await the
  // write and showed "Copied" whether or not it succeeded — for a webhook secret
  // shown once, that is the reader pasting nothing and having no way to tell.
  const { copied, copy } = useCopy();
  const [url, setUrl] = useState('https://');
  const [events, setEvents] = useState<WebhookEvent[]>(DEFAULT_EVENTS);
  const [tagFilter, setTagFilter] = useState('');
  const showToast = useStore(s => s.showToast);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/webhooks')
      .then(res => (res.ok ? res.json() : Promise.reject()))
      .then((items: Webhook[]) => { if (!cancelled) setList({ status: 'loaded', items }); })
      .catch(() => { if (!cancelled) setList({ status: 'failed' }); });
    return () => { cancelled = true; };
  }, []);

  const toggleEvent = (event: WebhookEvent) => {
    setEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]);
  };

  const handleCreate = async () => {
    const refuse = (error: string) => setForm({ kind: 'open', error });
    if (!url || url === 'https://') return refuse('URL is required');
    if (!url.startsWith('https://')) return refuse('Must be an HTTPS URL');
    if (events.length === 0) return refuse('Select at least one event');
    setForm({ kind: 'submitting' });
    try {
      const res = await sendJson('/api/webhooks', 'POST', { url, events, tagPathFilter: tagFilter || undefined });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return refuse(data.error || 'Failed to create');
      }
      // The route answers with the row it wrote, so the list takes it without a refetch.
      const webhook: Webhook = await res.json();
      setNewSecret(webhook.secret);
      setList(l => (l.status === 'loaded' ? { status: 'loaded', items: [maskSecret(webhook), ...l.items] } : l));
      setForm({ kind: 'closed' });
      setUrl('https://');
      setEvents(DEFAULT_EVENTS);
      setTagFilter('');
    } catch { refuse('Failed to create: the request did not reach the wiki.'); }
  };

  const handleDelete = async (id: string) => {
    const ok = await fetch(`/api/webhooks/${id}`, { method: 'DELETE' }).then(r => r.ok, () => false);
    if (!ok) { showToast('The webhook could not be deleted. Try again.', 'info'); return; }
    setList(l => (l.status === 'loaded' ? { status: 'loaded', items: l.items.filter(w => w.id !== id) } : l));
    showToast('Webhook deleted');
  };

  const copySecret = () => {
    if (newSecret) void copy(newSecret);
  };

  const webhooks = list.status === 'loaded' ? list.items : [];
  const showForm = form.kind !== 'closed';
  const openForm = () => setForm({ kind: 'open', error: null });

  return (
    <div className="webhook-content">
      {/* Telegram section */}
      <TelegramSection watch={watch} />

      <div className="webhook-divider" />

      {/* Webhooks section */}
      <div className="spread px-3 py-2">
        <span className="text-small font-medium">Custom Webhooks</span>
      </div>

      {list.status === 'loading' ? (
        <div className="webhook-empty"><Loader2 size={16} className="animate-spin" /></div>
      ) : list.status === 'failed' ? (
        <p className="text-small text-text-muted px-3 py-2">Your webhooks could not be loaded. Reload to try again.</p>
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
            <EmptyState title="No custom webhooks." action={<Button variant="ghost" size="sm" onClick={openForm}><Plus size={14} />Add webhook</Button>} />
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
              <Button variant="ghost" size="sm" onClick={openForm}><Plus size={14} />Add webhook</Button>
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
              {form.kind === 'open' && form.error && <p className="text-error text-small">{form.error}</p>}
              <div className="row justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setForm({ kind: 'closed' })} disabled={form.kind === 'submitting'}>Cancel</Button>
                <Button size="sm" onClick={handleCreate} isLoading={form.kind === 'submitting'}>Create</Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
