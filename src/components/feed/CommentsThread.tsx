'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Activity } from './FeedUtils';
import { timeAgo } from './FeedUtils';

type ActivityComment = {
  id: number;
  activity_id: number;
  user_id: string;
  body: string;
  created_at: string;
};

interface CommentsThreadProps {
  activity: Activity;
  meId: string | null;
}

export function CommentsThread({ activity, meId }: CommentsThreadProps) {
  const [comments, setComments] = useState<ActivityComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('activity_comments')
        .select('*')
        .eq('activity_id', activity.id)
        .order('created_at', { ascending: true });
      if (error) console.error('comments load error:', error);
      setComments((data ?? []) as ActivityComment[]);
      setLoading(false);
    })();
  }, [activity.id]);

  async function addComment(e: React.FormEvent) {
    e.preventDefault();
    if (!meId) return;
    const body = input.trim();
    if (!body) return;

    try {
      setAdding(true);
      setInput('');

      // optimistic
      const tempId = Date.now();
      setComments((prev) => [
        ...prev,
        {
          id: tempId as any,
          activity_id: activity.id,
          user_id: meId,
          body,
          created_at: new Date().toISOString(),
        },
      ]);

      await supabase.from('activity_comments').insert({
        activity_id: activity.id,
        user_id: meId,
        body,
      });
    } finally {
      setAdding(false);
    }
  }

  async function deleteComment(c: ActivityComment) {
    if (!meId) return;
    if (!(c.user_id === meId || activity.owner_id === meId)) return;

    setComments((prev) => prev.filter((x) => x.id !== c.id));
    await supabase.from('activity_comments').delete().eq('id', c.id);
  }

  return (
    <div className="px-4 py-4">
      {loading ? (
        <div className="space-y-4">
          <div className="flex space-x-3">
            <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-gray-200 animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-gray-200 animate-pulse" />
            </div>
          </div>
        </div>
      ) : comments.length === 0 ? (
        <p className="text-gray-500 text-base text-center py-6">
          No comments yet. Be the first to comment!
        </p>
      ) : (
        <div className="space-y-4 mb-6">
          {comments.map((c) => (
            <div key={c.id} className="flex space-x-3">
              <div className="h-10 w-10 rounded-full overflow-hidden bg-gradient-to-br from-[#A1C6EA] to-[#0e2a36] flex items-center justify-center text-white text-sm font-semibold">
                {c.user_id === meId ? 'You' : c.user_id.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="bg-gray-50 rounded-2xl px-4 py-3">
                  <p className="font-semibold text-base text-[#0d1b22] mb-1">
                    {c.user_id === meId ? 'You' : `@${c.user_id.slice(0, 12)}`}
                  </p>
                  <p className="text-base text-gray-700 break-words leading-relaxed">{c.body}</p>
                </div>
                <div className="flex items-center space-x-4 mt-2 ml-4">
                  <span className="text-sm text-gray-500">{timeAgo(c.created_at)}</span>
                  <button className="text-sm text-gray-500 hover:text-gray-700 font-medium">
                    Like
                  </button>
                  <button className="text-sm text-gray-500 hover:text-gray-700 font-medium">
                    Reply
                  </button>
                  {(c.user_id === meId || activity.owner_id === meId) && (
                    <button
                      onClick={() => deleteComment(c)}
                      className="text-sm text-red-500 hover:text-red-700 font-medium"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Comment Input */}
      <form onSubmit={addComment} className="flex items-center space-x-3 pt-3 border-t border-gray-100">
        <div className="h-10 w-10 rounded-full overflow-hidden bg-gradient-to-br from-[#A1C6EA] to-[#0e2a36] flex items-center justify-center text-white text-sm font-semibold">
          {meId ? 'You' : '?'}
        </div>
        <div className="flex-1">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={meId ? 'Add a comment...' : 'Sign in to comment'}
            disabled={!meId || adding}
            className="w-full bg-transparent text-base placeholder-gray-500 focus:outline-none py-2"
          />
        </div>
        {input.trim() && (
          <button
            type="submit"
            disabled={!meId || adding}
            className="text-[#FF8A65] font-semibold text-base hover:text-[#0e2a36] disabled:opacity-50 transition-colors"
          >
            {adding ? 'Posting...' : 'Post'}
          </button>
        )}
      </form>
    </div>
  );
}








