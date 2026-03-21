// src/components/WebhookSettings.tsx

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Trash2, Copy, Check, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useStore } from '@/hooks';

interface Webhook {
  id: string;
  url: string;
  secret: string;
  events: string[];
  tagPathFilter: string | null;
  active: boolean;
}

interface TelegramLink {
  id: string;
  chatId: string;
  events: string[];
  tagPathFilter: string | null;
  active: boolean;
}

const EVENT_OPTIONS = [
  { value: 'page.created', label: 'Page created' },
  { value: 'page.updated', label: 'Page updated' },
  { value: 'page.deleted', label: 'Page deleted' },
  { value: 'comment.created', label: 'Comment created' },
] as const;

// ===== Telegram Section =====

function TelegramSection() {
  const [link, setLink] = useState<TelegramLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>(['page.created', 'page.updated']);
  const [tagFilter, setTagFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const showToast = useStore(s => s.showToast);

  const fetchLink = useCallback(async () => {
    const res = await fetch('/api/telegram');
    if (res.ok) {
      const data = await res.json();
      if (data?.id) {
        setLink(data);
        setEvents(data.events);
        setTagFilter(data.tagPathFilter || '');
        return true;
      }
    }
    return false;
  }, []);

  useEffect(() => {
    fetchLink().then(() => setLoading(false));
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchLink]);

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
        // Poll for completion
        pollRef.current = setInterval(async () => {
          const linked = await fetchLink();
          if (linked) {
            setDeepLink(null);
            if (pollRef.current) clearInterval(pollRef.current);
            showToast('Telegram connected!');
          }
        }, 3000);
      } else if (data.id) {
        setLink(data);
      }
    }
  };

  const handleSaveEvents = async () => {
    setSaving(true);
    const res = await fetch('/api/telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events, tagPathFilter: tagFilter || undefined }),
    });
    if (res.ok) {
      const data = await res.json();
      setLink(data);
      showToast('Settings saved');
    }
    setSaving(false);
  };

  const handleDisconnect = async () => {
    const res = await fetch('/api/telegram', { method: 'DELETE' });
    if (res.ok) {
      setLink(null);
      setEvents(['page.created', 'page.updated']);
      setTagFilter('');
      showToast('Telegram disconnected');
    }
  };

  const toggleEvent = (event: string) => {
    setEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]);
  };

  if (loading) return null;

  return (
    <div className="telegram-section">
      <div className="spread px-3 py-2">
        <span className="text-small font-medium">Telegram</span>
        {link && (
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
      ) : link ? (
        <div className="webhook-form">
          <div className="row gap-2">
            <span className="badge badge-success">Connected</span>
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
            <label className="text-small font-medium">Tag filter <span className="text-text-muted font-normal">(optional)</span></label>
            <input value={tagFilter} onChange={e => setTagFilter(e.target.value)} className="input text-small" placeholder="e.g. contents/tech" />
          </div>
          <div className="row justify-end">
            <Button size="sm" onClick={handleSaveEvents} isLoading={saving}>Save</Button>
          </div>
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
