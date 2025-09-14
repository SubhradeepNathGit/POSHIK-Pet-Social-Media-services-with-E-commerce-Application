'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Activity, isPhotoVerb, humanizeVerb, timeAgo, shorten } from './FeedUtils';
import { CommentsThread } from './CommentsThread';
import { MiniImage } from './MiniImage';
import { DiffLabel } from './DiffLabel';
import { 
  IconMore, 
  IconHeart, 
  IconHeartSolid, 
  IconChat, 
  IconShare, 
  IconBookmark, 
  IconArrow 
} from './FeedIcons';

interface FeedItemProps {
  a: Activity;
  meId: string | null;
  open: boolean;
  onToggleLike: () => void;
  onToggleComments: () => void;
}

export function FeedItem({
  a,
  meId,
  open,
  onToggleLike,
  onToggleComments,
}: FeedItemProps) {
  const title = humanizeVerb(a);
  const isBeforeAfter =
    a.diff?.field === 'cover_url' ||
    a.diff?.field === 'avatar_url' ||
    a.verb === 'pet.photo_updated' ||
    a.verb === 'user.avatar_updated';

  const likes = a.likes_count ?? 0;
  const comments = a.comments_count ?? 0;

  return (
    <article className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300">
      {/* Post Header */}
      <header className="flex items-center justify-between px-4 py-4">
        <div className="flex items-center space-x-3">
          <div className="relative h-12 w-12 rounded-full overflow-hidden bg-gradient-to-br from-[#FF8A65] to-[#0e2a36] p-0.5">
            <div className="h-full w-full rounded-full overflow-hidden bg-white">
              {a.photo_url ? (
                <Image src={a.photo_url} alt="" fill className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#A1C6EA] to-[#0e2a36] text-white text-sm font-semibold">
                  {a.actor_id.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <div>
            <h3 className="font-semibold text-[#0d1b22] text-base">
              {a.actor_id === meId ? 'You' : `@${a.actor_id.slice(0, 12)}`}
            </h3>
            <p className="text-sm text-gray-500">{timeAgo(a.created_at)}</p>
          </div>
        </div>
        
        <button className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <IconMore />
        </button>
      </header>

      {/* Post Content */}
      <div className="px-4 pb-4">
        <p className="text-[#0d1b22] text-base leading-relaxed">{title}</p>
      </div>

      {/* Post Media/Diff */}
      {isBeforeAfter && a.diff ? (
        <div className="relative">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 p-4">
            <DiffLabel field={a.diff.field} />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <MiniImage url={a.diff.old} label="Before" />
              <MiniImage url={a.diff.new} label="After" />
            </div>
          </div>
        </div>
      ) : isPhotoVerb(a.verb) && a.photo_url ? (
        <div className="relative aspect-square min-h-[400px] max-h-[600px] overflow-hidden">
          <Image 
            src={a.photo_url} 
            alt="" 
            fill 
            className="object-cover" 
            sizes="(max-width: 600px) 100vw, 600px"
          />
        </div>
      ) : a.diff?.field ? (
        <div className="mx-4 mb-3 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 p-3">
          <DiffLabel field={a.diff.field} />
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="truncate rounded-md bg-white px-2 py-1 text-gray-700 shadow-sm border">
              {shorten(a.diff.old)}
            </span>
            <IconArrow className="text-gray-400 flex-shrink-0" />
            <span className="truncate rounded-md bg-white px-2 py-1 text-gray-700 shadow-sm border">
              {shorten(a.diff.new)}
            </span>
          </div>
        </div>
      ) : null}

      {/* Action Buttons */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <button
              onClick={onToggleLike}
              className="flex items-center space-x-1 transition-transform active:scale-95"
            >
              {a.liked_by_me ? (
                <IconHeartSolid className="h-7 w-7 text-red-500" />
              ) : (
                <IconHeart className="h-7 w-7 text-gray-700 hover:text-red-500" />
              )}
            </button>
            
            <button
              onClick={onToggleComments}
              className="flex items-center space-x-1 transition-transform active:scale-95"
            >
              <IconChat className="h-7 w-7 text-gray-700 hover:text-blue-500" />
            </button>
            
            <button className="flex items-center space-x-1 transition-transform active:scale-95">
              <IconShare className="h-7 w-7 text-gray-700 hover:text-green-500" />
            </button>
          </div>
          
          {a.subject_type === 'pet' && (
            <button className="transition-transform active:scale-95">
              <IconBookmark className="h-7 w-7 text-gray-700 hover:text-gray-900" />
            </button>
          )}
        </div>
      </div>

      {/* Likes and Comments Info */}
      <div className="px-4 py-3">
        {likes > 0 && (
          <p className="font-semibold text-base text-[#0d1b22] mb-2">
            {likes === 1 ? '1 like' : `${likes.toLocaleString()} likes`}
          </p>
        )}
        
        {comments > 0 && !open && (
          <button
            onClick={onToggleComments}
            className="text-gray-500 text-base hover:text-gray-700 transition-colors"
          >
            View all {comments} comment{comments !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* Comments Section */}
      {open && (
        <div className="border-t border-gray-100">
          <CommentsThread activity={a} meId={meId} />
        </div>
      )}

      {/* Quick Actions */}
      {a.subject_type === 'pet' && (
        <div className="px-4 py-4 border-t border-gray-100">
          <Link
            href={`/pets/${a.subject_id}`}
            className="inline-flex items-center space-x-1 text-base font-medium text-[#FF8A65] hover:text-[#0e2a36] transition-colors"
          >
            <span>View pet profile</span>
            <IconArrow className="h-4 w-4" />
          </Link>
        </div>
      )}
    </article>
  );
}








