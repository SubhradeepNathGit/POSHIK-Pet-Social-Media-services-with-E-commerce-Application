'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/sidebar';
import FeedHeader from '@/components/feed/FeedHeader';
import { FeedItem } from '@/components/feed/FeedItem';
import { SkeletonList, Spinner } from '@/components/feed/FeedSkeleton';
import { MobileNavigation } from '@/components/feed/MobileNavigation';
import { Activity, withSafeCounters } from '@/components/feed/FeedUtils';
import { IconHeart } from '@/components/feed/FeedIcons';

/* ================== Types ================== */

type Role = 'admin' | 'vet' | 'user' | 'none' | 'loading';

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
          <FeedHeader /> 

          <div className="mx-80 mt-5 px-4 py-6 pb-24">
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

      <MobileNavigation 
        role={role} 
        notiCount={notiCount} 
        loadMyPets={loadMyPets} 
      />
    </div>
  );
}
