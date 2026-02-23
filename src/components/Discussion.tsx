// src/components/Discussion.tsx

'use client';

import { useState, useEffect, useCallback, useActionState } from 'react';
import { MessageSquare, Reply, Trash2, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { getXrdRequired } from '@/lib/tags';
import { Button } from '@/components/ui';
import { useAuth } from '@/hooks';
import { UserAvatar } from '@/components/UserAvatar';
import type { WikiComment } from '@/types';

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

type FormState = { error?: string; ok?: boolean };

function CommentForm({ onSubmit, onCancel, placeholder = 'Write a comment...', autoFocus, compact }: {
  onSubmit: (content: string) => Promise<void>; onCancel?: () => void; placeholder?: string; autoFocus?: boolean; compact?: boolean;
}) {
  const [state, action, isPending] = useActionState<FormState, FormData>(async (_, fd) => {
    const content = (fd.get('content') as string)?.trim();
    if (!content) return { error: 'Content required' };
    try { await onSubmit(content); return { ok: true }; } catch { return { error: 'Failed to post' }; }
  }, {});

  return (
    <form action={action} className={cn('stack-sm', compact && 'pl-4')}>
      <textarea name="content" placeholder={placeholder} defaultValue="" className={cn('input resize-none', compact ? 'min-h-16' : 'min-h-20')} rows={compact ? 2 : 3} autoFocus={autoFocus} key={state.ok ? Date.now() : 'form'} />
      {state.error && <p className="text-error text-small">{state.error}</p>}
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
  const { isAuthenticated } = useAuth();
  const canReply = isAuthenticated && depth < MAX_DEPTH;
  const isAuthor = currentUserId === comment.authorId;
  const hasReplies = comment.replies && comment.replies.length > 0;

  const [delState, delAction, isDeleting] = useActionState<FormState, FormData>(async (_prev, _fd) => {
    if (!confirm('Delete this comment?')) return {};
    try { await onDelete(comment.id); return { ok: true }; } catch { return { error: 'Failed to delete' }; }
  }, {});

  return (
    <div className={cn('stack-sm', depth > 0 && 'comment-thread')}>
      <div className="stack-xs">
        <div className="row text-small">
          {comment.author && <UserAvatar radixAddress={comment.author.radixAddress} avatarUrl={comment.author.avatarUrl} size="sm" />}
          <span className="font-medium">{comment.author?.displayName || comment.author?.radixAddress?.slice(0, 12) + '...'}</span>
          <span className="text-text-muted">·</span>
          <span className="text-text-muted">{formatRelativeTime(comment.createdAt)}</span>
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
        {delState.error && <p className="text-error text-small">{delState.error}</p>}
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

export function Discussion({ pageId, tagPath }: { pageId: string; tagPath: string }) {
  const [comments, setComments] = useState<WikiComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const { isAuthenticated, user } = useAuth();

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?pageId=${pageId}`);
      if (res.ok) {
        const data = await res.json();
        setComments(buildCommentTree(data.items));
      }
    } catch (e) { console.error('Failed to fetch comments:', e); }
    finally { setIsLoading(false); }
  }, [pageId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const handlePost = async (content: string, parentId?: string) => {
    const res = await fetch('/api/comments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, parentId, pageId }) });
    if (res.ok) await fetchComments();
    else throw new Error((await res.json()).error || 'Failed to post comment');
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' });
    if (res.ok) await fetchComments();
    else throw new Error('Failed to delete comment');
  };

  const countComments = (list: WikiComment[]): number => list.reduce((acc, c) => acc + 1 + countComments(c.replies || []), 0);

  return (
    <section className="section-divider stack">
      <button onClick={() => setExpanded(!expanded)} className="spread w-full text-left">
        <div className="row"><MessageSquare size={20} className="text-accent" /><h3 id="discussion" className="font-semibold">Discussion</h3><span className="text-text-muted">({countComments(comments)})</span></div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      {expanded && (
        <div className="stack">
          {isAuthenticated ? (
            <>
              <CommentForm onSubmit={c => handlePost(c)} placeholder="Start a discussion..." />
            </>
          ) : <p className="text-text-muted surface p-4 text-center">Connect your wallet to join the discussion.</p>}
          {isLoading ? <div className="stack">{[1, 2].map(i => <div key={i} className="h-20 skeleton" />)}</div>
            : comments.length > 0 ? <div className="stack">{comments.map(c => <CommentThread key={c.id} comment={c} depth={0} onReply={handlePost} onDelete={handleDelete} currentUserId={user?.id} />)}</div>
            : <p className="text-text-muted text-center py-4">No comments yet. Be the first to start the discussion!</p>}
        </div>
      )}
    </section>
  );
}

export default Discussion;
