// src/components/Discussion.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, Reply, Trash2, ChevronDown, ChevronUp, Send } from 'lucide-react';
import { cn, formatRelativeTime } from '@/lib/utils';
import { Button } from '@/components/ui';
import { InlineMarkdown } from '@/components/Blocks';
import { useIsAuthenticated, useAuth } from '@/hooks/useStore';
import type { WikiComment } from '@/types';

const MAX_DEPTH = 3;

function buildCommentTree(comments: WikiComment[]): WikiComment[] {
  const map = new Map<string, WikiComment>();
  const roots: WikiComment[] = [];
  
  comments.forEach(c => map.set(c.id, { ...c, replies: [] }));
  comments.forEach(c => {
    const comment = map.get(c.id)!;
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.replies!.push(comment);
    } else {
      roots.push(comment);
    }
  });
  
  return roots;
}

interface CommentFormProps {
  onSubmit: (content: string) => Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  compact?: boolean;
}

function CommentForm({ onSubmit, onCancel, placeholder = 'Write a comment...', autoFocus, compact }: CommentFormProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onSubmit(content.trim());
      setContent('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn('stack-2', compact ? 'pl-4' : '')}>
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder={placeholder}
        className={cn('input resize-none', compact ? 'min-h-16' : 'min-h-20')}
        rows={compact ? 2 : 3}
        autoFocus={autoFocus}
        onKeyDown={e => { if (e.key === 'Enter' && e.metaKey) handleSubmit(); }}
      />
      <div className="row justify-end">
        {onCancel && <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>}
        <Button size="sm" onClick={handleSubmit} disabled={!content.trim() || isSubmitting}>
          <Send size={14} />{isSubmitting ? 'Posting...' : 'Post'}
        </Button>
      </div>
    </div>
  );
}

interface CommentThreadProps {
  comment: WikiComment;
  depth: number;
  pageId: string;
  onReply: (parentId: string, content: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  currentUserId?: string;
}

function CommentThread({ comment, depth, pageId, onReply, onDelete, currentUserId }: CommentThreadProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const isAuthenticated = useIsAuthenticated();
  const canReply = isAuthenticated && depth < MAX_DEPTH;
  const isAuthor = currentUserId === comment.authorId;
  const hasReplies = comment.replies && comment.replies.length > 0;

  const handleReply = async (content: string) => {
    await onReply(comment.id, content);
    setShowReplyForm(false);
  };

  const handleDelete = async () => {
    if (!confirm('Delete this comment?')) return;
    setIsDeleting(true);
    try {
      await onDelete(comment.id);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={cn('stack-2', depth > 0 && 'pl-4 border-l border-border-muted')}>
      <div className="stack-1">
        <div className="row text-small">
          <span className="font-medium">{comment.author?.displayName || comment.author?.radixAddress?.slice(0, 12) + '...'}</span>
          <span className="text-muted">Â·</span>
          <span className="text-muted">{formatRelativeTime(comment.createdAt)}</span>
          {hasReplies && (
            <button onClick={() => setCollapsed(!collapsed)} className="row text-muted hover:text-text ml-auto">
              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              <span>{comment.replies!.length} {comment.replies!.length === 1 ? 'reply' : 'replies'}</span>
            </button>
          )}
        </div>
        <div className="paragraph text-text"><InlineMarkdown>{comment.content}</InlineMarkdown></div>
        <div className="row text-small">
          {canReply && (
            <button onClick={() => setShowReplyForm(!showReplyForm)} className="row text-muted hover:text-accent">
              <Reply size={14} /><span>Reply</span>
            </button>
          )}
          {isAuthor && (
            <button onClick={handleDelete} disabled={isDeleting} className="row text-muted hover:text-error">
              <Trash2 size={14} /><span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
            </button>
          )}
        </div>
      </div>
      
      {showReplyForm && (
        <CommentForm
          onSubmit={handleReply}
          onCancel={() => setShowReplyForm(false)}
          placeholder="Write a reply..."
          autoFocus
          compact
        />
      )}
      
      {hasReplies && !collapsed && (
        <div className="stack-3 mt-2">
          {comment.replies!.map(reply => (
            <CommentThread
              key={reply.id}
              comment={reply}
              depth={depth + 1}
              pageId={pageId}
              onReply={onReply}
              onDelete={onDelete}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface DiscussionProps {
  pageId: string;
}

export function Discussion({ pageId }: DiscussionProps) {
  const [comments, setComments] = useState<WikiComment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const isAuthenticated = useIsAuthenticated();
  const { user } = useAuth();

  const fetchComments = useCallback(async () => {
    try {
      const res = await fetch(`/api/comments?pageId=${pageId}`);
      if (res.ok) {
        const data = await res.json();
        setComments(buildCommentTree(data));
      }
    } catch (e) {
      console.error('Failed to fetch comments:', e);
    } finally {
      setIsLoading(false);
    }
  }, [pageId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const handlePost = async (content: string, parentId?: string) => {
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, parentId, pageId }),
    });
    if (res.ok) {
      await fetchComments();
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to post comment');
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' });
    if (res.ok) {
      await fetchComments();
    } else {
      alert('Failed to delete comment');
    }
  };

  const totalCount = comments.reduce((acc, c) => {
    const countReplies = (comment: WikiComment): number => 
      1 + (comment.replies?.reduce((a, r) => a + countReplies(r), 0) || 0);
    return acc + countReplies(c);
  }, 0);

  return (
    <section className="stack-4 pt-6 border-t border-border">
      <button onClick={() => setExpanded(!expanded)} className="spread w-full text-left">
        <div className="row">
          <MessageSquare size={20} className="text-accent" />
          <h3 className="font-semibold">Discussion</h3>
          <span className="text-muted">({totalCount})</span>
        </div>
        {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      
      {expanded && (
        <div className="stack-4">
          {isAuthenticated ? (
            <CommentForm onSubmit={content => handlePost(content)} placeholder="Start a discussion..." />
          ) : (
            <p className="text-muted surface p-4 text-center">Connect your wallet to join the discussion.</p>
          )}
          
          {isLoading ? (
            <div className="stack-3">
              {[1, 2].map(i => <div key={i} className="h-20 skeleton" />)}
            </div>
          ) : comments.length > 0 ? (
            <div className="stack-4">
              {comments.map(comment => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  depth={0}
                  pageId={pageId}
                  onReply={(parentId, content) => handlePost(content, parentId)}
                  onDelete={handleDelete}
                  currentUserId={user?.id}
                />
              ))}
            </div>
          ) : (
            <p className="text-muted text-center py-4">No comments yet. Be the first to start the discussion!</p>
          )}
        </div>
      )}
    </section>
  );
}

export default Discussion;