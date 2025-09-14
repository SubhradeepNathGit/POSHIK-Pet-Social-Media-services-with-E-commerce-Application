'use client';

export type Activity = {
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

export function withSafeCounters(a: Activity): Activity {
  return {
    ...a,
    likes_count: a.likes_count ?? 0,
    comments_count: a.comments_count ?? 0,
    liked_by_me: a.liked_by_me ?? false,
  };
}

export function isPhotoVerb(verb: string) {
  return (
    verb === 'pet.media_added' ||
    verb === 'pet.cover_updated' ||
    verb === 'pet.avatar_updated' ||
    verb === 'pet.photo_updated' ||
    verb === 'user.avatar_updated'
  );
}

export function humanizeVerb(a: Activity) {
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

export function shorten(v: any, max = 40) {
  if (!v) return '—';
  const s = String(v);
  if (s.startsWith('http')) return s.length > max ? s.slice(0, max) + '...' : s;
  return s.length > max ? s.slice(0, max) + '...' : s;
}

export function timeAgo(iso: string) {
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






