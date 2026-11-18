// src/components/Trollbox.tsx

'use client';

import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BadgeCheck, Flag, Loader2, Trash2, X } from 'lucide-react';
import { useAuth, useStore } from '@/hooks';
import { CHANGE_WINDOW_MS, MAX_BODY, POLL_MS, type Me, type Message, type Read } from '@/lib/trollbox';
import { sendJson } from '@/lib/utils';
import { SignInOptions } from '@/components/SignIn';
import { Button } from '@/components/ui';

/** Distance from the foot inside which the log counts as pinned to it. */
const PIN_SLACK = 32;

const TIME = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
const DAY = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

/** The room: loading, a first read that failed, or its lines and whether older ones remain. */
type Room =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; messages: Message[]; earlier: boolean };

/** A request's JSON, or the route's own words for why not. */
async function ask<T>(request: Promise<Response>): Promise<T> {
  const res = await request;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'That did not go through. Try again.');
  return data as T;
}

const act = (id: number, action: string) => sendJson(`/api/trollbox/${id}`, 'POST', { action });

const LINK = /https?:\/\/[^\s<>"']+/g;

/**
 * A line's text. Only a holder's links are links: an account below the bar is
 * free to make, and a room that linked whatever one posted would be a billboard.
 */
function Body({ text, links }: { text: string; links: boolean }) {
  if (!links) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK)) {
    // The full stop or bracket that ends a sentence is not part of the address.
    const url = match[0].replace(/[.,;:!?)\]]+$/, '');
    parts.push(text.slice(last, match.index), <a key={match.index} href={url} target="_blank" rel="noopener noreferrer nofollow ugc">{url}</a>);
    last = match.index + url.length;
  }
  parts.push(text.slice(last));
  return <>{parts}</>;
}

export default function Trollbox({ onSeen }: { onSeen: (id: number) => void }) {
  const { user, status: authStatus } = useAuth();
  const toggleChat = useStore(s => s.toggleChat);
  const [room, setRoom] = useState<Room>({ status: 'loading' });
  const [me, setMe] = useState<Me | null>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  // The lines with an action in flight: their buttons wait for it rather than send it twice.
  const [busy, setBusy] = useState<ReadonlySet<number>>(() => new Set());
  // The reader's own flags. The room's reads are the same for everyone, so they cannot say.
  const [flagged, setFlagged] = useState<ReadonlySet<number>>(() => new Set());
  // Collapsed bodies the reader asked for back, kept beside the log: a reveal is theirs, not the room's.
  const [revealed, setRevealed] = useState<Record<number, string>>({});
  // Non-zero only while the reader is scrolled up, so it is also "not at the foot".
  const [unread, setUnread] = useState(0);

  const logRef = useRef<HTMLDivElement>(null);
  // Everything up to here has been delivered. A ref: the interval reads what the last answer left.
  const cursor = useRef(0);
  const seen = useRef(new Set<number>());
  const pinned = useRef(true);
  // Numbers each read, so one answering after a newer one has landed is dropped.
  const reads = useRef(0);
  const lastRead = useRef(0);
  // The latest action, by number: only it may set or clear the error line.
  const attempts = useRef(0);
  // The log's height before older lines were put above it, so the view stays where it was.
  const heightBefore = useRef<number | null>(null);

  /** The newest page, from nothing: on opening, and after a gap too long to patch. */
  const load = useCallback(async () => {
    const read = ++reads.current;
    try {
      const data = await ask<Read>(fetch('/api/trollbox'));
      if (read !== reads.current) return;
      seen.current = new Set(data.messages.map(m => m.id));
      cursor.current = data.messages.at(-1)?.id ?? 0;
      lastRead.current = Date.now();
      pinned.current = true;
      setUnread(0);
      setRoom({ status: 'ready', messages: data.messages, earlier: !!data.earlier });
    } catch {
      // A failed read keeps the lines on screen; only a first read that fails says so.
      if (read === reads.current) setRoom(r => (r.status === 'ready' ? r : { status: 'failed' }));
    }
  }, []);

  /** New lines past the cursor, and the lines whose state has moved. */
  const poll = useCallback(async () => {
    // Moved lines are named for a while only, so a room away longer cannot trust what it holds.
    if (Date.now() - lastRead.current > CHANGE_WINDOW_MS / 2) return load();
    const read = ++reads.current;
    try {
      const data = await ask<Read>(fetch(`/api/trollbox?since=${cursor.current}`));
      if (read !== reads.current) return;
      lastRead.current = Date.now();
      const fresh = data.messages.filter(m => !seen.current.has(m.id));
      for (const m of fresh) seen.current.add(m.id);
      // Only over lines the server handed back: a line echoed from the composer
      // does not mean everything below its id was delivered.
      cursor.current = Math.max(cursor.current, ...data.messages.map(m => m.id));
      const moved = new Map(data.changed.map(m => [m.id, m]));
      if (!fresh.length && !moved.size) return;
      setRoom(r => (r.status !== 'ready' ? r : {
        ...r,
        messages: [...r.messages.map(m => { const now = moved.get(m.id); return now && now.line.state !== m.line.state ? now : m; }), ...fresh],
      }));
      if (!pinned.current) setUnread(n => n + fresh.length);
    } catch {
      // A dropped poll is not worth a word: the next tick asks again.
    }
  }, [load]);

  // Poll while the tab is visible. A hidden tab asking forever is the whole cost
  // of the room and nobody is reading it; coming back reads at once.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    const start = () => { if (!timer) { void poll(); timer = setInterval(poll, POLL_MS); } };
    const stop = () => { clearInterval(timer); timer = undefined; reads.current++; };
    const onVisibility = () => (document.hidden ? stop() : start());
    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [poll]);

  // What the reader may do here, asked again when who they are changes.
  const refreshMe = useCallback(() => ask<Me>(fetch('/api/trollbox/me')).then(setMe, () => {}), []);
  useEffect(() => { void refreshMe(); }, [refreshMe, user?.id, user?.radixAddress]);

  // On a phone the room is the whole screen, so the page behind it does not scroll.
  useEffect(() => {
    if (window.matchMedia('(min-width: 1024px)').matches) return;
    const { overflow } = document.documentElement.style;
    document.documentElement.style.overflow = 'hidden';
    return () => { document.documentElement.style.overflow = overflow; };
  }, []);

  const messages = room.status === 'ready' ? room.messages : null;

  // Follow the foot while the reader is at it; scrolling up parks the view.
  useLayoutEffect(() => {
    const log = logRef.current;
    if (!log) return;
    if (heightBefore.current !== null) {
      log.scrollTop += log.scrollHeight - heightBefore.current;
      heightBefore.current = null;
    } else if (pinned.current) log.scrollTop = log.scrollHeight;
  }, [messages]);

  const newest = messages?.at(-1)?.id;
  useEffect(() => { if (newest) onSeen(newest); }, [newest, onSeen]);

  const onScroll = () => {
    const log = logRef.current;
    if (!log) return;
    pinned.current = log.scrollHeight - log.scrollTop - log.clientHeight <= PIN_SLACK;
    if (pinned.current) setUnread(0);
  };

  const jumpToFoot = () => {
    const log = logRef.current;
    if (!log) return;
    log.scrollTop = log.scrollHeight;
    pinned.current = true;
    setUnread(0);
  };

  const replace = (message: Message) =>
    setRoom(r => (r.status !== 'ready' ? r : { ...r, messages: r.messages.map(m => (m.id === message.id ? message : m)) }));

  /**
   * One error line answers for whichever action started last, so each action
   * clears it on the way in and an earlier one settling later never writes over
   * it. A line's own action holds that line's buttons until it settles.
   */
  const run = async <T,>(call: () => Promise<T>, apply: (result: T) => void, lineId?: number) => {
    if (lineId !== undefined) {
      if (busy.has(lineId)) return false;
      setBusy(prev => new Set(prev).add(lineId));
    }
    const attempt = ++attempts.current;
    setError(null);
    try {
      apply(await call());
      return true;
    } catch (e) {
      if (attempt === attempts.current) setError((e as Error).message);
      return false;
    } finally {
      if (lineId !== undefined) setBusy(prev => { const next = new Set(prev); next.delete(lineId); return next; });
    }
  };

  const send = async () => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    const sent = await run(() => ask<{ message: Message }>(sendJson('/api/trollbox', 'POST', { body: text })), ({ message }) => {
      setBody('');
      pinned.current = true;
      setUnread(0);
      // Echoed without moving the cursor: the next poll delivers it again and it is dropped as seen.
      if (seen.current.has(message.id)) return;
      seen.current.add(message.id);
      setRoom(r => (r.status !== 'ready' ? r : { ...r, messages: [...r.messages, message] }));
    });
    setSending(false);
    // A refusal may be a mute that began since the room opened.
    if (!sent) void refreshMe();
  };

  const loadEarlier = () => {
    const first = messages?.[0];
    if (!first) return;
    void run(() => ask<Read>(fetch(`/api/trollbox?before=${first.id}`)), data => {
      const older = data.messages.filter(m => !seen.current.has(m.id));
      for (const m of older) seen.current.add(m.id);
      heightBefore.current = logRef.current?.scrollHeight ?? null;
      setRoom(r => (r.status !== 'ready' ? r : { ...r, messages: [...older, ...r.messages], earlier: !!data.earlier }));
    }, first.id);
  };

  const flag = (id: number) => run(() => ask<{ flagCount: number; hidden: boolean }>(act(id, 'flag')), ({ flagCount, hidden }) => {
    setFlagged(prev => new Set(prev).add(id));
    setRoom(r => (r.status !== 'ready' ? r : {
      ...r,
      messages: r.messages.map(m => (m.id === id ? { ...m, flagCount, line: hidden ? { state: 'hidden' } : m.line } : m)),
    }));
  }, id);
  const reveal = (id: number) => run(() => ask<{ body: string }>(act(id, 'reveal')), res => setRevealed(prev => ({ ...prev, [id]: res.body })), id);
  const restore = (id: number) => run(() => ask<{ message: Message }>(act(id, 'restore')), res => replace(res.message), id);
  const remove = (id: number) => run(() => ask<{ message: Message }>(fetch(`/api/trollbox/${id}`, { method: 'DELETE' })), res => replace(res.message), id);

  const signedIn = authStatus === 'signed-in';
  const mutedUntil = me?.mutedUntil && new Date(me.mutedUntil) > new Date() ? new Date(me.mutedUntil) : null;

  return (
    <section className="trollbox" aria-label="Trollbox" onKeyDown={e => { if (e.key === 'Escape') toggleChat(); }}>
      <header className="trollbox-head">
        <h2 className="trollbox-title">Trollbox</h2>
        <button type="button" className="icon-btn ml-auto" onClick={toggleChat} aria-label="Close the trollbox"><X size={18} /></button>
      </header>

      <div ref={logRef} className="trollbox-log" onScroll={onScroll} role="log" aria-live="polite">
        {room.status === 'loading' ? (
          <p className="trollbox-note"><Loader2 size={14} className="animate-spin inline" /></p>
        ) : room.status === 'failed' ? (
          <p className="trollbox-note">The room could not be read. <button type="button" className="trollbox-link" onClick={load}>Try again</button></p>
        ) : room.messages.length === 0 ? (
          <p className="trollbox-note">Nobody has said anything yet.</p>
        ) : (
          <>
            {room.earlier && <button type="button" className="trollbox-link self-center" onClick={loadEarlier}>Earlier lines</button>}
            {room.messages.map((m, i) => {
              const { line, author } = m;
              const at = new Date(m.at);
              const day = DAY.format(at);
              const newDay = i === 0 || DAY.format(new Date(room.messages[i - 1]!.at)) !== day;
              const mine = author.id === user?.id;
              const waiting = busy.has(m.id);
              const shown = line.state === 'live' ? line.body : line.state === 'hidden' ? revealed[m.id] ?? null : null;
              return (
                <Fragment key={m.id}>
                  {newDay && <div className="trollbox-day">{day}</div>}
                  <div className="trollbox-row">
                    <time className="trollbox-time" dateTime={m.at}>{TIME.format(at)}</time>
                    <span className="trollbox-name" data-standing={author.standing}>
                      {author.name}
                      {author.standing === 'holder' && <BadgeCheck size={12} className="trollbox-mark" aria-label="$XRD holder"><title>$XRD holder</title></BadgeCheck>}
                      {author.standing === 'guest' && <span className="trollbox-guest">guest</span>}
                    </span>
                    {shown !== null ? (
                      <span className={line.state === 'hidden' ? 'trollbox-note' : undefined}><Body text={shown} links={author.standing === 'holder'} /></span>
                    ) : (
                      <span className="trollbox-note">
                        {line.state === 'hidden' ? `[collapsed by holders · ${m.flagCount}]` : line.state === 'removed' ? '[removed]' : '[deleted]'}
                      </span>
                    )}
                    {line.state === 'hidden' && shown === null && signedIn && (
                      <button type="button" className="trollbox-link" onClick={() => reveal(m.id)} disabled={waiting}>show</button>
                    )}
                    {me?.admin && (line.state === 'hidden' || line.state === 'removed') && (
                      <button type="button" className="trollbox-link" onClick={() => restore(m.id)} disabled={waiting}>restore</button>
                    )}
                    {line.state === 'live' && signedIn && !mine && me?.holder !== false && (
                      <button type="button" className="trollbox-act" onClick={() => flag(m.id)} disabled={waiting || flagged.has(m.id)}
                        data-on={flagged.has(m.id) || m.flagCount > 0 || undefined}
                        title={flagged.has(m.id) ? `Flagged. ${m.flagCount} so far.` : 'Flag this line. A flag is weighed by your $XRD.'} aria-label="Flag this line">
                        <Flag size={12} />{m.flagCount > 0 && <span>{m.flagCount}</span>}
                      </button>
                    )}
                    {line.state === 'live' && (mine || me?.admin) && (
                      <button type="button" className="trollbox-act" onClick={() => remove(m.id)} disabled={waiting} title="Delete this line" aria-label="Delete this line">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </Fragment>
              );
            })}
          </>
        )}
      </div>

      {unread > 0 && <button type="button" className="trollbox-jump" onClick={jumpToFoot}>{unread} new</button>}
      {error && <p className="trollbox-error" role="alert">{error}</p>}

      <footer className="trollbox-foot">
        {authStatus === 'checking' ? null : !signedIn ? (
          signingIn ? <SignInOptions onDone={() => setSigningIn(false)} /> : <Button size="sm" className="w-full" onClick={() => setSigningIn(true)}>Sign in to chat</Button>
        ) : mutedUntil ? (
          <p className="trollbox-note">Holders collapsed three of your lines in a day. You can post again at {TIME.format(mutedUntil)}.</p>
        ) : (
          <form className="trollbox-form" onSubmit={e => { e.preventDefault(); void send(); }}>
            <textarea
              className="input trollbox-input"
              rows={1}
              value={body}
              onChange={e => setBody(e.target.value.slice(0, MAX_BODY))}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}
              placeholder="Say something"
              maxLength={MAX_BODY}
              aria-label="Message"
            />
            {MAX_BODY - body.length <= 50 && <span className="trollbox-count" aria-hidden="true">{MAX_BODY - body.length}</span>}
            <Button type="submit" size="sm" disabled={sending || !body.trim()}>Send</Button>
          </form>
        )}
      </footer>
    </section>
  );
}
