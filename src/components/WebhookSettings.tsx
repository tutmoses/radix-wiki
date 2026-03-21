// src/components/WebhookSettings.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Copy, Check, Loader2 } from 'lucide-react';
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

const EVENT_OPTIONS = [
  { value: 'page.created', label: 'Page created' },
  { value: 'page.updated', label: 'Page updated' },
  { value: 'page.deleted', label: 'Page deleted' },
  { value: 'comment.created', label: 'Comment created' },
] as const;

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

  if (loading) {
    return <div className="webhook-empty"><Loader2 size={16} className="animate-spin" /></div>;
  }

  return (
    <div className="webhook-content">
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
          <p>No webhooks yet</p>
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

      {/* Add button (when list has items) */}
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
    </div>
  );
}
