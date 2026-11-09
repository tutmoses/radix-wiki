// src/components/Discussion.tsx

'use client';

import { useState, useEffect, useCallback, useActionState, useMemo, useRef } from 'react';
import { MessageSquare, Reply, Trash2, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { cn, sendJson } from '@/lib/utils';
import { AGO, useNow } from '@/lib/now';
import { relativeTime } from 'wiki-formant/freshness';
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks';
import { UserAvatar } from '@/components/UserAvatar';
import type { WikiComment } from '@/types';
import { EmptyState } from '@/components/EmptyState';

const MAX_DEPTH = 3;

function buildCommentTree(comments: WikiComment[]): WikiComment[] {
  const map = new Map<string, WikiComment>();
  const roots: WikiComment[] = [];
  comments.forEach(c => map.set(c.id, { ...c, replies: [] }));
  comments.forEach(c => {
    const node = map.get(c.id)!;
    c.parentId && map.has(c.parentId) ? map.get(c.parentId)!.replies!.push(node) : roots.push(node);
  });
  return roots;
}

/**
 * The form's last submission: none yet, refused, or posted. `submissions` keys
 * the textarea, so a post remounts it empty.
 */
type FormState =
  | { kind: 'idle'; submissions: number }
  | { kind: 'refused'; error: string; submissions: number }
  | { kind: 'posted'; submissions: number };

function CommentForm({ onSubmit, onCancel, placeholder = 'Write a comment...', autoFocus, compact }: {
  onSubmit: (content: string) => Promise<void>; onCancel?: () => void; placeholder?: string; autoFocus?: boolean; compact?: boolean;
}) {
  const [state, action, isPending] = useActionState<FormState, FormData>(async (prev, fd) => {
    const content = (fd.get('content') as string)?.trim();
    if (!content) return { kind: 'refused', error: 'Content required', submissions: prev.submissions };
    // The submit counter is the textarea's key — bumping it remounts the field so
    // it clears. Date.now() here was impure and changed on every render, so a
    // posted comment re-mounted the box continuously and stole focus.
    try { await onSubmit(content); return { kind: 'posted', submissions: prev.submissions + 1 }; }
    catch (e) { return { kind: 'refused', error: e instanceof Error ? e.message : 'Failed to post', submissions: prev.submissions }; }
  }, { kind: 'idle', submissions: 0 });

  return (
    <form action={action} className={cn('stack-sm', compact && 'pl-4')}>
      <textarea name="content" placeholder={placeholder} defaultValue="" className={cn('input resize-none', compact ? 'min-h-16' : 'min-h-20')} rows={compact ? 2 : 3} autoFocus={autoFocus} key={state.submissions} />
      {state.kind === 'refused' && <p className="text-error text-small">{state.error}</p>}
      {state.kind === 'posted' && <p className="text-small text-text-muted">Posted.</p>}
      <div className="row justify-end">
        {onCancel && <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" size="sm" disabled={isPending}><Send size={14} />{isPending ? 'Posting...' : 'Post'}</Button>
      </div>
    </form>
  );
}

function CommentThread({ comment, depth, onReply, onDelete, currentUserId }: {
  comment: WikiComment; depth: number; onReply: (parentId: string, content: string) => Promise<void>; onDelete: (id: string) => Promise<void>; currentUserId?: string;
}) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const now = useNow();
  const { isAuthenticated } = useAuth();
  const canReply = isAuthenticated && depth < MAX_DEPTH;
  const isAuthor = currentUserId === comment.authorId;
  const hasReplies = comment.replies && comment.replies.length > 0;

  // The last delete's refusal, if any.
  const [delError, delAction, isDeleting] = useActionState<string | null, FormData>(async (_prev, _fd) => {
    if (!confirm('Delete this comment?')) return null;
    try { await onDelete(comment.id); return null; } catch { return 'Failed to delete'; }
  }, null);

  return (
    <div className={cn('stack-sm', depth > 0 && 'comment-thread')}>
      <div className="stack-xs">
        <div className="row text-small">
          {comment.author && <UserAvatar seed={comment.author.id} avatarUrl={comment.author.avatarUrl} size="sm" />}
          <span className="font-medium">{comment.author?.displayName || comment.author?.shortAddress || 'Unknown'}</span>
          <span className="text-text-muted">·</span>
          <span className="text-text-muted">{relativeTime(comment.createdAt, now, AGO)}</span>
          {hasReplies && (
            <button onClick={() => setCollapsed(!collapsed)} className="comment-action ml-auto">
              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              <span>{comment.replies!.length} {comment.replies!.length === 1 ? 'reply' : 'replies'}</span>
            </button>
          )}
        </div>
        <p className="text-text">{comment.content}</p>
        <div className="row text-small">
          {canReply && <button onClick={() => setShowReplyForm(!showReplyForm)} className="comment-action"><Reply size={14} /><span>Reply</span></button>}
          {isAuthor && (
            <form action={delAction}>
              <button type="submit" disabled={isDeleting} className="comment-delete">
                <Trash2 size={14} /><span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
              </button>
            </form>
          )}
        </div>
        {delError && <p className="text-error text-small">{delError}</p>}
      </div>
      {showReplyForm && <CommentForm onSubmit={c => onReply(comment.id, c).then(() => setShowReplyForm(false))} onCancel={() => setShowReplyForm(false)} placeholder="Write a reply..." autoFocus compact />}
      {hasReplies && !collapsed && (
        <div className="stack mt-2">
          {comment.replies!.map(r => <CommentThread key={r.id} comment={r} depth={depth + 1} onReply={onReply} onDelete={onDelete} currentUserId={currentUserId} />)}
        </div>
      )}
    </div>
  );
}

// A failed first load is its own state, not an empty thread; a failed refetch
// keeps the thread already on screen. `comments` is flat, as the route answers.
type Thread = { kind: 'loading' } | { kind: 'failed' } | { kind: 'loaded'; comments: WikiComment[] };

export function Discussion({ pageId }: { pageId: string }) {
  const [thread, setThread] = useState<Thread>({ kind: 'loading' });
  // Numbers each read, so a slow first load cannot land over the refetch after a post.
  const attemptRef = useRef(0);
  // Collapsed by default — talk shouldn't compete with the article (Wikipedia keeps it off-page entirely).
  const [expanded, setExpanded] = useState(false);
  const { isAuthenticated, user } = useAuth();

  // The list is edge-cached for a minute, so a refetch after the reader's own
  // post or delete names a fresh URL: the cached copy would not show it yet.
  const fetchComments = useCallback(async (fresh?: boolean) => {
    const attempt = ++attemptRef.current;
    try {
      const res = await fetch(`/api/comments?pageId=${pageId}${fresh ? `&t=${Date.now()}` : ''}`);
      if (!res.ok) throw new Error(res.statusText);
      const data = await res.json();
      if (attempt === attemptRef.current) setThread({ kind: 'loaded', comments: data.items });
    } catch (e) {
      console.error('Failed to fetch comments:', e);
      if (attempt === attemptRef.current) setThread(t => t.kind === 'loaded' ? t : { kind: 'failed' });
    }
  }, [pageId]);

  useEffect(() => {
    fetchComments();
    return () => { attemptRef.current++; };
  }, [fetchComments]);

  // The route answers with the comment it wrote, so the thread shows it at once
  // and keeps it if the refetch behind it fails: a post that seemed to vanish
  // was posted again.
  const handlePost = async (content: string, parentId?: string) => {
    const res = await sendJson('/api/comments', 'POST', { content, parentId, pageId });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Failed to post comment');
    setThread(t => (t.kind === 'loaded' ? { kind: 'loaded', comments: [...t.comments, data as WikiComment] } : t));
    void fetchComments(true);
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' });
    if (res.ok) await fetchComments(true);
    else throw new Error('Failed to delete comment');
  };

  const tree = useMemo(() => (thread.kind === 'loaded' ? buildCommentTree(thread.comments) : []), [thread]);

  return (
    <section className="section-divider stack">
      <button onClick={() => setExpanded(!expanded)} className="spread w-full text-left">
        <div className="row"><MessageSquare size={20} className="text-accent" /><h3 id="discussion" className="font-semibold">Discussion</h3>{thread.kind === 'loaded' && <span className="text-text-muted">({thread.comments.length})</span>}</div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {expanded && (
        <div className="stack">
          {isAuthenticated ? (
            <>
              <CommentForm onSubmit={c => handlePost(c)} placeholder="Start a discussion..." />
            </>
          ) : <p className="text-text-muted surface p-4 text-center">Connect your wallet to join the discussion.</p>}
          {thread.kind === 'loading' ? <div className="stack">{[1, 2].map(i => <div key={i} className="h-20 skeleton" />)}</div>
            : thread.kind === 'failed' ? <EmptyState title="The discussion could not be loaded." action={<Button variant="ghost" size="sm" onClick={() => fetchComments(true)}>Try again</Button>} />
            : tree.length > 0 ? <div className="stack">{tree.map(c => <CommentThread key={c.id} comment={c} depth={0} onReply={handlePost} onDelete={handleDelete} currentUserId={user?.id} />)}</div>
            : <EmptyState title="No comments yet." />}
        </div>
      )}
    </section>
  );
}
