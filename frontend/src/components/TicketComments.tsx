import { useEffect, useState, useCallback } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { fetchComments, createComment } from '../utils/api';
import type { Comment, UserContext } from '../types/gantt';

interface TicketCommentsProps {
  ticketId: string;
  user?: UserContext | null;
}

export function TicketComments({ ticketId, user }: TicketCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchComments(ticketId)
      .then((data) => {
        if (!cancelled) setComments(data);
      })
      .catch(() => {
        if (!cancelled) setComments([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [ticketId]);

  const handleSubmit = useCallback(async () => {
    const content = newComment.trim();
    if (!content || submitting) return;

    const tempId = `temp-${Date.now()}`;
    const optimistic: Comment = {
      id: tempId,
      author: {
        id: user?.user_id ?? 'anonymous',
        display_name: user?.display_name ?? 'Anonymous',
        avatar_url: null,
      },
      content,
      created_at: new Date().toISOString(),
    };

    setComments((prev) => [...prev, optimistic]);
    setNewComment('');
    setSubmitting(true);

    try {
      const created = await createComment(ticketId, content);
      setComments((prev) => prev.map((c) => c.id === tempId ? created : c));
    } catch {
      setComments((prev) => prev.filter((c) => c.id !== tempId));
      setNewComment(content);
    } finally {
      setSubmitting(false);
    }
  }, [newComment, submitting, ticketId, user]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <span className="font-mono text-sm text-[#8C8278] uppercase tracking-widest animate-pulse">
          Loading comments...
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {comments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <MessageSquare className="w-8 h-8 text-[#8C8278] mb-3" />
          <p className="text-sm text-[#8C8278] font-medium">No comments yet</p>
        </div>
      )}

      {comments.map((comment) => (
        <div key={comment.id} className="border border-[#2C2824]/20 bg-[#F5EFE2]">
          {/* Comment header */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#E4DBCA] border-b border-[#2C2824]/15">
            {comment.author.avatar_url ? (
              <img
                src={comment.author.avatar_url}
                alt={comment.author.display_name}
                className="w-5 h-5 rounded-none border border-[#2C2824]/30 object-cover"
              />
            ) : (
              <div className="w-5 h-5 rounded-none border border-[#2C2824]/30 bg-[#D8CFC0] flex items-center justify-center text-[8px] font-bold">
                {comment.author.display_name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .slice(0, 2)}
              </div>
            )}
            <span className="font-bold text-xs">{comment.author.display_name}</span>
            <span className="text-[10px] font-mono text-[#8C8278] ml-auto">
              {new Date(comment.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
          {/* Comment body */}
          <div className="px-3 py-2 text-sm leading-relaxed markdown-prose">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.content}</ReactMarkdown>
          </div>
        </div>
      ))}

      {/* New comment input */}
      <div className="border-2 border-[#2C2824]/20 bg-[#F5EFE2] mt-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write a comment..."
          rows={3}
          className="w-full p-3 bg-transparent text-sm resize-none outline-none placeholder:text-[#8C8278] font-sans"
        />
        <div className="flex items-center justify-between px-3 py-2 border-t border-[#2C2824]/10">
          <span className="text-[10px] font-mono text-[#8C8278]">
            Markdown supported. Enter to send.
          </span>
          <button
            onClick={handleSubmit}
            disabled={!newComment.trim() || submitting}
            className="flex items-center gap-1 px-3 py-1 bg-[#2C2824] text-[#EDE5D4] text-[10px] font-mono uppercase font-bold tracking-wider border-2 border-[#2C2824] hover:shadow-[2px_2px_0_0_rgba(44,40,36,0.8)] transition-shadow disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-3 h-3" />
            {submitting ? 'Sending...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}
