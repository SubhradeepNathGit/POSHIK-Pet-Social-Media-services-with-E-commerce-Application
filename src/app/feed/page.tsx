'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/sidebar';

/* ================== Types ================== */

type Role = 'admin' | 'vet' | 'user' | 'none' | 'loading';

type Activity = {
  id: number;
  actor_id: string;
  verb: string;
  subject_type: string;
  subject_id: string;
  summary: string;
  diff: any;
  photo_url: string | null;
  visibility: 'owner_only' | 'public';
  owner_id: string;
  created_at: string;
  likes_count?: number;
  comments_count?: number;
  liked_by_me?: boolean;
};

type ActivityComment = {
  id: number;
  activity_id: number;
  user_id: string;
  body: string;
  created_at: string;
};

type SidebarItem = {
  label: string;
  href?: string;
  onClick?: () => void;
  badge?: number;
  icon?: React.ReactNode;
};

/* ================== Page ================== */

export default function FeedPage() {
  const router = useRouter();

  // Auth + profile basics
  const [meId, setMeId] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('loading');
  const [firstName, setFirstName] = useState<string>('');
  const [vetName, setVetName] = useState<string>('');
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [vetAvatar, setVetAvatar] = useState<string | null>(null);
  const [notiCount, setNotiCount] = useState<number>(0);

  // Feed
  const [items, setItems] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PAGE = 20;

  // which activity IDs have their comment thread expanded
  const [openThreads, setOpenThreads] = useState<Record<number, boolean>>({});

  // Infinite scroll observer target
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // ======== Initialize User (similar to dashboard) ========
  const initializeUser = useCallback(async () => {
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error('Auth error:', authError);
        setRole('none');
        return;
      }

      if (!user) {
        setRole('none');
        return;
      }

      setMeId(user.id);

      // Load profile with error handling
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('first_name, role, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Profile fetch error:', profileError);
        setRole('user');
        return;
      }

      if (profile) {
        const userRole = (profile.role as Role) || 'user';
        setRole(userRole);
        setFirstName(profile.first_name ?? '');
        setProfileAvatar(profile.avatar_url ?? null);

        // If user is a vet, also load vet-specific data
        if (userRole === 'vet') {
          const { data: vetProfile, error: vetError } = await supabase
            .from('vets')
            .select('name, avatar_url, unread_notifications')
            .eq('id', user.id)
            .maybeSingle();

          if (!vetError && vetProfile) {
            setVetName(vetProfile.name ?? '');
            setVetAvatar(vetProfile.avatar_url ?? null);
            setNotiCount(vetProfile.unread_notifications ?? 0);
          }
        } else {
          // For regular users, check if they have unread notifications
          const { data: userNotifications, error: notifError } = await supabase
            .from('users')
            .select('unread_notifications')
            .eq('id', user.id)
            .maybeSingle();

          if (!notifError && userNotifications) {
            setNotiCount(userNotifications.unread_notifications ?? 0);
          }
        }
      } else {
        setRole('user');
      }
    } catch (error) {
      console.error('Initialize user error:', error);
      setRole('user');
    }
  }, []);

  // ======== Avatar change handler ========
  const onAvatarChange = useCallback((newUrl: string) => {
    if (role === 'vet') {
      setVetAvatar(newUrl);
    } else {
      setProfileAvatar(newUrl);
    }
  }, [role]);

  // ======== Sidebar helpers ========
  const loadMyPets = useCallback(() => {
    router.push('/pets');
  }, [router]);

  const getSidebarItems = useCallback(
    (r: Role, count: number): SidebarItem[] => {
      const baseItems = {
        vet: [
          { label: 'Dashboard', href: '/dashboard', icon: <IconHome /> },
          { label: 'Appointments', href: '/appointments', icon: <IconCalendar /> },
          { label: 'Patients', href: '/patients', icon: <IconUsers /> },
          { label: 'Profile', href: '/settings/profile', icon: <IconUser /> },
          { label: 'Notifications', href: '/notifications', badge: count, icon: <IconBell /> },
        ],
        admin: [
          { label: 'Dashboard', href: '/admin', icon: <IconHome /> },
          { label: 'Analytics', href: '/admin/analytics', icon: <IconChart /> },
          { label: 'KYC Review', href: '/admin/kyc', icon: <IconShield /> },
          { label: 'Products', href: '/admin/products', icon: <IconPackage /> },
          { label: 'Orders', href: '/admin/orders', icon: <IconShoppingBag /> },
          { label: 'Profile', href: '/settings/profile', icon: <IconUser /> },
        ],
        user: [
          { label: 'Home', href: '/feed', icon: <IconHome /> },
          { label: 'Discover', href: '/discover', icon: <IconCompass /> },
          { label: 'Create', href: '/create', icon: <IconPlus /> },
          { label: 'My Pets', onClick: loadMyPets, icon: <IconHeart /> },
          { label: 'Profile', href: '/settings/profile', icon: <IconUser /> },
          { label: 'Cart', href: '/cart', icon: <IconShoppingBag /> },
          { label: 'Orders', href: '/orders', icon: <IconPackage /> },
        ],
      } as const;

      if (r === 'vet') return baseItems.vet.slice();
      if (r === 'admin') return baseItems.admin.slice();
      return baseItems.user.slice();
    },
    [loadMyPets]
  );

  const sidebar = (
    <Sidebar
      role={role === 'loading' || role === 'none' ? 'user' : role}
      name={role === 'vet' ? (vetName ? `Dr. ${vetName}` : 'Doctor') : (firstName || 'User')}
      avatarUrl={(role === 'vet' ? vetAvatar : profileAvatar) || undefined}
    />
  );

  /* ================== Effects ================== */
  useEffect(() => {
    (async () => {
      // Initialize user profile first
      await initializeUser();

      // Then load feed content
      await loadMore(true, meId);

      // Realtime: new activities
      const chActivities = supabase
        .channel('rt_activities')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' }, (payload) => {
          const row = payload.new as Activity;
          // Only show if visible (public or my own)
          if (row.visibility === 'public' || row.owner_id === meId) {
            setItems((prev) => (prev.some((p) => p.id === row.id) ? prev : [withSafeCounters(row), ...prev]));
          }
        })
        .subscribe();

      // Realtime: likes (insert/delete)
      const chLikes = supabase
        .channel('rt_activity_likes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_likes' }, (payload) => {
          const r: any = payload.new ?? payload.old;
          const aId = r?.activity_id as number | undefined;
          if (!aId) return;
          setItems((prev) =>
            prev.map((it) => {
              if (it.id !== aId) return it;
              if (payload.eventType === 'INSERT') {
                return {
                  ...it,
                  likes_count: (it.likes_count ?? 0) + 1,
                  liked_by_me: r.user_id === meId ? true : it.liked_by_me,
                };
              } else if (payload.eventType === 'DELETE') {
                return {
                  ...it,
                  likes_count: Math.max(0, (it.likes_count ?? 0) - 1),
                  liked_by_me: r.user_id === meId ? false : it.liked_by_me,
                };
              }
              return it;
            })
          );
        })
        .subscribe();

      // Realtime: comments (insert/delete)
      const chComments = supabase
        .channel('rt_activity_comments')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_comments' }, (payload) => {
          const r: any = payload.new ?? payload.old;
          const aId = r?.activity_id as number | undefined;
          if (!aId) return;
          setItems((prev) =>
            prev.map((it) => {
              if (it.id !== aId) return it;
              if (payload.eventType === 'INSERT') {
                return { ...it, comments_count: (it.comments_count ?? 0) + 1 };
              } else if (payload.eventType === 'DELETE') {
                return { ...it, comments_count: Math.max(0, (it.comments_count ?? 0) - 1) };
              }
              return it;
            })
          );
        })
        .subscribe();

      return () => {
        supabase.removeChannel(chActivities);
        supabase.removeChannel(chLikes);
        supabase.removeChannel(chComments);
      };
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializeUser]);

  // Infinite scroll observer
  useEffect(() => {
    if (!hasMore) return; // nothing to observe
    const el = loadMoreRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && !moreLoading) {
          loadMore(false);
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, moreLoading, items.length]);

  async function loadMore(reset = false, currentUserId: string | null = meId) {
    if (moreLoading) return;
    setMoreLoading(true);

    const from = reset ? 0 : items.length;
    const to = from + PAGE - 1;

    const { data, error } = await supabase
      .from('activities')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) console.error('feed load error:', error);

    let rows = (data ?? []).map(withSafeCounters) as Activity[];

    // mark liked_by_me (optional)
    if (currentUserId && rows.length) {
      const ids = rows.map((r) => r.id);
      const { data: myLikes, error: likeErr } = await supabase
        .from('activity_likes')
        .select('activity_id')
        .eq('user_id', currentUserId)
        .in('activity_id', ids);

      if (!likeErr && myLikes) {
        const liked = new Set(myLikes.map((l) => l.activity_id));
        rows = rows.map((r) => ({ ...r, liked_by_me: liked.has(r.id) }));
      }
    }

    setItems(reset ? rows : [...items, ...rows]);
    setHasMore(rows.length === PAGE);
    setLoading(false);
    setMoreLoading(false);
  }

  function toggleThread(aid: number) {
    setOpenThreads((prev) => ({ ...prev, [aid]: !prev[aid] }));
  }

  async function onToggleLike(a: Activity) {
    if (!meId) return;
    const liked = !!a.liked_by_me;

    // optimistic update
    setItems((prev) =>
      prev.map((it) =>
        it.id === a.id
          ? {
              ...it,
              liked_by_me: !liked,
              likes_count: (it.likes_count ?? 0) + (liked ? -1 : 1),
            }
          : it
      )
    );

    if (liked) {
      await supabase.from('activity_likes').delete().eq('activity_id', a.id).eq('user_id', meId);
    } else {
      await supabase.from('activity_likes').insert({ activity_id: a.id, user_id: meId });
    }
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-[#F8FBFF] to-white">
      <div className="flex">
        {/* Fixed Sidebar */}
        <aside className="hidden lg:block fixed left-0 top-0 h-screen w-64 xl:w-72 bg-white border-r border-gray-200 z-30">
          {sidebar}
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-h-screen lg:ml-64 xl:ml-72">
          {/* Top Banner with Breadcrumb */}
          <div className="relative w-full h-48 sm:h-64 md:h-72 lg:h-80 mb-8">
            <Image
              src="/images/statbg11.jpg"
              alt="Products Banner"
              fill
              priority
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-black/60 flex flex-col justify-center items-center text-center">
              <h1 className="text-3xl md:text-5xl font-bold text-white mb-2">News Feed</h1>
              <p className="text-sm md:text-base text-gray-200">
                Home / Profile / Feed
              </p>
            </div>
          </div>

          <div className="mx-80 mt-5  px-4 py-6 pb-24">
            {loading ? (
              <SkeletonList />
            ) : items.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                <div className="mb-4">
                  <IconHeart className="mx-auto h-12 w-12 text-gray-300" />
                </div>
                <p className="text-lg font-medium text-gray-900 mb-2">No posts yet</p>
                <p className="text-gray-500">Start following friends to see their posts here</p>
              </div>
            ) : (
              <div className="space-y-6">
                {items.map((a) => (
                  <FeedItem
                    key={a.id}
                    a={a}
                    meId={meId}
                    open={!!openThreads[a.id]}
                    onToggleLike={() => onToggleLike(a)}
                    onToggleComments={() => toggleThread(a.id)}
                  />
                ))}
              </div>
            )}

            {/* Infinite scroll sentinel + spinner */}
            <div ref={loadMoreRef} className="h-12" />
            {hasMore && (
              <div className="flex justify-center py-6">
                <Spinner show={moreLoading || loading} label={moreLoading ? 'Loading more…' : 'Loading…'} />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mobile Bottom Sidebar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
        <div className="backdrop-blur-xl bg-white/95 shadow-lg border-t border-gray-200 px-2 sm:px-4 py-2">
          <div className="flex justify-around">
            {getSidebarItems(role, notiCount).slice(0, 5).map((item, i) => (
              item.href ? (
                <Link
                  key={i}
                  href={item.href}
                  className="flex flex-col items-center py-2 px-3 text-[11px] sm:text-xs font-medium text-gray-600 hover:text-[#FF8A65] transition-colors relative"
                >
                  {item.icon}
                  <span className="mt-1 truncate max-w-12">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#FF8A65] text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center font-semibold">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </Link>
              ) : (
                <button
                  key={i}
                  onClick={item.onClick}
                  className="flex flex-col items-center py-2 px-3 text-[11px] sm:text-xs font-medium text-gray-600 hover:text-[#FF8A65] transition-colors relative"
                >
                  {item.icon}
                  <span className="mt-1 truncate max-w-12">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#FF8A65] text-white text-[10px] rounded-full h-5 w-5 flex items-center justify-center font-semibold">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </button>
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============== Instagram-Style Feed Item ============== */

function FeedItem({
  a,
  meId,
  open,
  onToggleLike,
  onToggleComments,
}: {
  a: Activity;
  meId: string | null;
  open: boolean;
  onToggleLike: () => void;
  onToggleComments: () => void;
}) {
  const title = humanizeVerb(a);
  const isBeforeAfter =
    a.diff?.field === 'cover_url' ||
    a.diff?.field === 'avatar_url' ||
    a.verb === 'pet.photo_updated' ||
    a.verb === 'user.avatar_updated';

  const likes = a.likes_count ?? 0;
  const comments = a.comments_count ?? 0;

  return (
    <article className="bg-white rounded-xl  border border-gray-200 shadow-sm hover:shadow-md transition-shadow duration-300">
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

/* ============== Comments Thread ============== */

function CommentsThread({ activity, meId }: { activity: Activity; meId: string | null }) {
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

/* ============== Helpers ============== */

function withSafeCounters(a: Activity): Activity {
  return {
    ...a,
    likes_count: a.likes_count ?? 0,
    comments_count: a.comments_count ?? 0,
    liked_by_me: a.liked_by_me ?? false,
  };
}

function isPhotoVerb(verb: string) {
  return (
    verb === 'pet.media_added' ||
    verb === 'pet.cover_updated' ||
    verb === 'pet.avatar_updated' ||
    verb === 'pet.photo_updated' ||
    verb === 'user.avatar_updated'
  );
}

function MiniImage({ url, label }: { url: string | null; label: string }) {
  const isImg = !!url && /(\.png|jpe?g|webp|gif|avif)$/i.test(url);
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2 shadow-sm">
      <p className="mb-2 text-xs font-semibold text-gray-600">{label}</p>
      <div className="relative h-32 w-full overflow-hidden rounded-md bg-gray-100">
        {isImg ? (
          <Image src={url as string} alt={label} fill sizes="200px" className="object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-gray-500 p-2 text-center">
            {shorten(url)}
          </div>
        )}
      </div>
    </div>
  );
}

function DiffLabel({ field }: { field: string }) {
  return (
    <p className="text-sm font-semibold text-[#0d1b22] mb-2">
      Updated <span className="rounded-full bg-gradient-to-r from-[#FF8A65] to-[#0e2a36] text-white px-2 py-1 text-xs font-medium">{field}</span>
    </p>
  );
}

function humanizeVerb(a: Activity) {
  if (a.summary) return a.summary;
  const map: Record<string, string> = {
    'pet.created': '🐾 Added a new furry friend',
    'pet.name_updated': '✏️ Gave their pet a new name',
    'pet.photo_updated': '📸 Updated their pet\'s photo',
    'pet.media_added': '📷 Shared a new photo',
    'pet.cover_updated': '🖼️ Updated their pet\'s cover photo',
    'pet.avatar_updated': '👤 Updated their pet\'s profile picture',
    'user.name_updated': '✨ Updated their name',
    'user.avatar_updated': '📸 Updated their profile picture',
  };
  return map[a.verb] ?? '📝 Made an update';
}

function shorten(v: any, max = 40) {
  if (!v) return '—';
  const s = String(v);
  if (s.startsWith('http')) return s.length > max ? s.slice(0, max) + '...' : s;
  return s.length > max ? s.slice(0, max) + '...' : s;
}

function timeAgo(iso: string) {
  const t = new Date(iso).getTime();
  const s = Math.max(1, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  return new Date(iso).toLocaleDateString();
}

function Spinner({ show, label }: { show: boolean; label?: string }) {
  if (!show) return null;
  return (
    <div className="flex items-center gap-3 text-sm text-gray-600">
      <div className="h-6 w-6 rounded-full border-2 border-gray-300 border-t-[#FF8A65] animate-spin" />
      {label && <span>{label}</span>}
    </div>
  );
}

/* ============== Skeletons ============== */
function SkeletonList() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm animate-pulse">
          {/* Header */}
          <div className="flex items-center space-x-3 p-4">
            <div className="h-10 w-10 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/3 rounded bg-gray-200" />
              <div className="h-3 w-1/4 rounded bg-gray-200" />
            </div>
            <div className="h-6 w-6 rounded-full bg-gray-200" />
          </div>
          
          {/* Content */}
          <div className="px-4 pb-3">
            <div className="h-4 w-3/4 rounded bg-gray-200" />
          </div>
          
          {/* Media */}
          <div className="aspect-square bg-gray-200" />
          
          {/* Actions */}
          <div className="p-4 space-y-3">
            <div className="flex space-x-6">
              <div className="h-6 w-6 rounded bg-gray-200" />
              <div className="h-6 w-6 rounded bg-gray-200" />
              <div className="h-6 w-6 rounded bg-gray-200" />
            </div>
            <div className="h-4 w-1/4 rounded bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============== Icons ============== */
function IconArrow({ className = "" }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14m-6-6 6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconMore() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
      <circle cx="12" cy="6" r="1.5" fill="currentColor" />
      <circle cx="12" cy="18" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconShare({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="18" cy="5" r="3"/>
      <circle cx="6" cy="12" r="3"/>
      <circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
  );
}

function IconBookmark({ className = "" }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 5 3 9H3c0-4 3-2 3-9Zm6 13a2.5 2.5 0 0 0 2.5-2.5h-5A2.5 2.5 0 0 0 12 21Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 21v-6h6v6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconCalendar() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconUsers() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 22a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconChart() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M3 3v18h18" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 15l4-4 3 3 5-6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconShield() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconPackage() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M21 16V8a2 2 0 0 0-1-1.73L13 2.27a2 2 0 0 0-2 0L4 6.27A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.27 6.96 12 12l8.73-5.04" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 22V12" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconShoppingBag() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M6 2h12l2 7H4l2-7Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 9h18l-1 11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2L3 9Z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 13a3 3 0 0 0 6 0" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconCompass() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.6" />
      <path d="M16 8l-2.5 6.5L7 17l2.5-6.5L16 8Z" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconHeart({ className = "" }: { className?: string }) {
  return (
    <svg className={`w-6 h-6 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function IconHeartSolid({ className = "" }: { className?: string }) {
  return (
    <svg className={`w-6 h-6 ${className}`} viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function IconChat({ className = "" }: { className?: string }) {
  return (
    <svg className={`w-6 h-6 ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}