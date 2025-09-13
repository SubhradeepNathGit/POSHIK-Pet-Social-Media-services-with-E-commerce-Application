'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Sidebar from '../../components/sidebar';
import React from 'react';
import { X } from "lucide-react";



/* ================= Types ================= */

type Role = 'admin' | 'user' | 'vet' | 'none' | 'loading';

type VetRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  medical_doc_url: string | null;
  kyc_status: 'pending' | 'approved' | 'rejected';
  avatar_url?: string | null;
};

type PetRow = {
  id: string;
  owner_id: string;
  name: string;
  species?: string | null;
  breed?: string | null;
  avatar_url:string;
  photo_url?: string | null;
  dob?: string | null;
};
// UI type with a resolved, displayable URL
type PetUI = PetRow & { photo_resolved?: string | null };

// type NotificationRow = {
//   id: string;
//   user_id: string;
//   title: string;
//   body?: string | null;
//   created_at: string;
//   seen: boolean;
//   type?: string | null;
// };

type SidebarItem = { 
  label: string; 
  href?: string; 
  onClick?: () => void; 
  badge?: number;
  icon?: React.ReactNode;
};

/* ================= Error Boundary ================= */

class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Dashboard Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FF8A65] to-[#f5f5dc]">
          <Card className="max-w-md">
            <div className="text-center">
              <div className="text-red-500 text-4xl mb-4">⚠️</div>
              <h2 className="text-xl font-bold text-gray-800 mb-2">Something went wrong</h2>
              <p className="text-gray-600 mb-4">We're sorry, but something unexpected happened.</p>
              <button 
                onClick={() => window.location.reload()} 
                className="btn-primary"
              >
                Reload Page
              </button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}


/** True if string looks like an absolute/ready URL or a public asset path */
function isDirectUrl(raw?: string | null): boolean {
  if (!raw) return false;
  const s = raw.trim();
  return (
    s.startsWith('http://') ||
    s.startsWith('https://') ||
    s.startsWith('/') ||
    s.startsWith('data:') ||
    s.startsWith('blob:')
  );
}

/** Split "bucket/path/to/file.jpg" into {bucket, objectPath}. If no bucket, returns null. */
function splitBucketPath(path: string): { bucket: string; objectPath: string } | null {
  const clean = path.replace(/^\/+/, '');
  const firstSlash = clean.indexOf('/');
  if (firstSlash <= 0) return null;
  const bucket = clean.slice(0, firstSlash);
  const objectPath = clean.slice(firstSlash + 1);
  if (!bucket || !objectPath) return null;
  return { bucket, objectPath };
}

/**
 * Try to resolve a Supabase Storage *path* to a usable URL.
 * - Attempts a signed URL first (works for private buckets)
 * - Falls back to public URL
 * - Tries heuristics across common buckets if bucket isn't obvious
 */
async function resolveStoragePathToUrl(rawPath: string): Promise<string | null> {
  const path = rawPath.replace(/^\/+/, '');

  if (isDirectUrl(path)) return path;

  const knownBuckets = ['pets', 'pet-photos', 'pet_images', 'avatars', 'public', 'images'];

  const candidates: Array<{ bucket: string; objectPath: string }> = [];
  const split = splitBucketPath(path);
  if (split) {
    candidates.push({ bucket: split.bucket, objectPath: split.objectPath });
    for (const b of knownBuckets) {
      candidates.push({ bucket: b, objectPath: path });
    }
  } else {
    for (const b of knownBuckets) {
      candidates.push({ bucket: b, objectPath: path });
    }
  }

  for (const cand of candidates) {
    try {
      const signed = await supabase.storage
        .from(cand.bucket)
        .createSignedUrl(cand.objectPath, 60 * 60 * 24 * 7);
      if (signed?.data?.signedUrl) return signed.data.signedUrl;
    } catch {}
    try {
      const pub = supabase.storage.from(cand.bucket).getPublicUrl(cand.objectPath);
      if (pub?.data?.publicUrl) return pub.data.publicUrl;
    } catch {}
  }

  return null;
}

/** High-level resolver used by UI */
async function resolvePetPhotoUrl(raw?: string | null): Promise<string | null> {
  if (!raw) return null;
  if (isDirectUrl(raw)) return raw.trim();
  return await resolveStoragePathToUrl(raw);
}


/* ================= Custom Hooks ================= */

function useAsyncError() {
  const [error, setError] = useState<Error | null>(null);
  
  const throwError = useCallback((error: Error) => {
    setError(error);
    throw error;
  }, []);

  if (error) throw error;
  
  return throwError;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

/* ================= Main Component ================= */

export default function Portal() {
  const throwAsyncError = useAsyncError();
  const [role, setRole] = useState<Role>('loading');
  const [firstName, setFirstName] = useState('');
  const [meId, setMeId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [retryCount, setRetryCount] = useState(0);

  const [vetKyc, setVetKyc] = useState<VetRow['kyc_status'] | null>(null);
  const [vetName, setVetName] = useState<string>('');
  const [vetAvatar, setVetAvatar] = useState<string | null>(null);

  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [pendingVets, setPendingVets] = useState<VetRow[]>([]);
  const [stats, setStats] = useState({ users: 0, vetsPending: 0, vetsApproved: 0 });
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error' | 'info'>('info');

  const [notiCount, setNotiCount] = useState(0);
  const [showPets, setShowPets] = useState(false);
  const [pets, setPets] = useState<PetUI[]>([]);
  const [petsLoading, setPetsLoading] = useState(false);
  

  // Network status monitoring
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const showMessage = useCallback((message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMsg(message);
    setMsgType(type);
    setTimeout(() => setMsg(''), 5000);
  }, []);

  const handleError = useCallback((error: any, context = 'Operation') => {
    console.error(`${context} error:`, error);
    const message = error?.message || `${context} failed. Please try again.`;
    showMessage(message, 'error');
  }, [showMessage]);

  const initializeUser = useCallback(async (maxRetries = 3) => {
    try {
      setMsg('');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) throw authError;
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

      if (profileError && !profileError.message.includes('duplicate key')) {
        throw profileError;
      }

      if (profile?.role === 'admin') {
        setRole('admin');
        setFirstName(profile.first_name ?? '');
        setProfileAvatar((profile as any).avatar_url ?? null);
        
        await Promise.allSettled([
          loadPendingVets(setPendingVets).catch(e => handleError(e, 'Loading pending vets')),
          loadAdminStats(setStats).catch(e => handleError(e, 'Loading admin stats')),
          loadNotiCount(user.id, 'admin', setNotiCount).catch(e => handleError(e, 'Loading notifications')),
        ]);
        return;
      }

      // Try vet profile
      try {
        const { data: vet, error: vetError } = await supabase
          .from('veterinarian')
          .select('kyc_status, name, avatar_url')
          .eq('id', user.id)
          .maybeSingle();

        if (vetError && !vetError.message.includes('column') && !vetError.message.includes('relation')) {
          throw vetError;
        }

        if (vet) {
          setRole('vet');
          setVetKyc(vet.kyc_status);
          setVetName(vet.name ?? '');
          setVetAvatar((vet as any).avatar_url ?? null);
          await loadNotiCount(user.id, 'vet', setNotiCount).catch(e => handleError(e, 'Loading vet notifications'));
          return;
        }
      } catch (vetErr: any) {
        if (!vetErr.message.includes('avatar_url')) {
          console.warn('Vet profile error:', vetErr);
        }
      }

      // Default to user
      if (profile) {
        setRole('user');
        setFirstName(profile.first_name ?? '');
        setProfileAvatar((profile as any).avatar_url ?? null);
        await loadNotiCount(user.id, 'user', setNotiCount).catch(e => handleError(e, 'Loading user notifications'));
        return;
      }

      setRole('none');
    } catch (error: any) {
      if (retryCount < maxRetries && isOnline) {
        console.warn(`Initialization attempt ${retryCount + 1} failed, retrying...`);
        setRetryCount(prev => prev + 1);
        setTimeout(() => initializeUser(maxRetries), 1000 * Math.pow(2, retryCount));
        return;
      }
      
      handleError(error, 'User initialization');
      setRole('none');
    }
  }, [retryCount, isOnline, handleError]);

  useEffect(() => {
    initializeUser();
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      setBusy('logout');
      await supabase.auth.signOut();
      window.location.href = '/signup';
    } catch (error) {
      handleError(error, 'Logout');
    } finally {
      setBusy('');
    }
  }, [handleError]);

  const handleDeleteAccount = useCallback(async () => {
    if (!meId) return;
    if (!confirm('Delete your account? This cannot be undone.')) return;

    try {
      setBusy('delete');
      await Promise.allSettled([
        supabase.from('veterinarian').delete().eq('id', meId),
        supabase.from('users').delete().eq('id', meId),
      ]);

      await supabase.auth.signOut();
      window.location.href = '/signup';
    } catch (e) {
      handleError(e, 'Account deletion');
    } finally {
      setBusy('');
    }
  }, [meId, handleError]);

  const loadMyPets = useCallback(async () => {
    if (!meId) return;
    
    try {
      setShowPets(true);
      setPetsLoading(true);
      
      const { data, error } = await supabase
        .from('pets')
        .select('id, owner_id, name, species, breed, avatar_url, photo_url, dob')
        .eq('owner_id', meId)
        .order('created_at', { ascending: true });
        
      if (error) throw error;

      const petsWithPhotos = await Promise.all(
  (data ?? []).map(async (p) => {
    const primary =
      p.avatar_url ??
      p.photo_url ??
      null;

    return {
      ...p,
      photo_resolved: await resolvePetPhotoUrl(primary),
    };
  })
);

setPets(petsWithPhotos);

    
    } catch (error) {
      handleError(error, 'Loading pets');
    } finally {
      setPetsLoading(false);
    }
  }, [meId, handleError]);

  const content = useMemo(() => {
    if (role === 'loading') return <LoadingCard />;

    if (role === 'admin')
      return (
        <AdminDashboard
          firstName={firstName}
          meId={meId}
          rows={pendingVets}
          stats={stats}
          busy={busy}
          setBusy={setBusy}
          showMessage={showMessage}
          profileAvatar={profileAvatar}
          onAvatarChange={setProfileAvatar}
          refresh={async () => {
            await Promise.allSettled([
              loadPendingVets(setPendingVets),
              loadAdminStats(setStats)
            ]);
          }}
        />
      );

    if (role === 'vet') {
      if (vetKyc === 'approved') {
        return (
          <VetDashboard
            name={vetName}
            meId={meId}
            avatarUrl={vetAvatar}
            onAvatarChange={setVetAvatar}
            showMessage={showMessage}
          />
        );
      }
      return <KycPending status={vetKyc ?? 'pending'} />;
    }

    if (role === 'user')
      return (
        <UserDashboard
          firstName={firstName}
          meId={meId}
          profileAvatar={profileAvatar}
          onAvatarChange={setProfileAvatar}
          showMessage={showMessage}
          onExploreMyPets={loadMyPets}
        />
      );

    return (
      <Card>
        <div className="text-center py-8">
          <div className="text-6xl mb-4">🔐</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Authentication Required</h2>
          <p className="text-gray-600 mb-4">Please sign in to access your dashboard.</p>
          <Link href="/signup" className="btn-primary">
            Sign In
          </Link>
        </div>
      </Card>
    );
  }, [role, firstName, meId, pendingVets, stats, busy, vetKyc, vetName, vetAvatar, profileAvatar, showMessage, loadMyPets]);

  const getSidebarItems = useCallback((r: Role, count: number): SidebarItem[] => {
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
    };

    const items =
      r === 'vet' || r === 'admin' || r === 'user'
        ? baseItems[r]
        : [];
    return [
      ...items,
      { label: 'Settings', href: '/settings', icon: <IconSettings /> },
      { label: 'Delete Account', onClick: handleDeleteAccount, icon: <IconTrash /> },
      { label: 'Log Out', onClick: handleLogout, icon: <IconLogOut /> },
    ];
  }, [loadMyPets, handleDeleteAccount, handleLogout]);

  const sidebar = (
    <Sidebar
      role={role === 'loading' || role === 'none' ? 'user' : role}
      name={
        role === 'vet'
          ? (vetName ? `Dr. ${vetName}` : 'Doctor')
          : (firstName || 'User')
      }
      avatarUrl={(role === 'vet' ? vetAvatar : profileAvatar) || undefined}
    />
  );

  return (
  <ErrorBoundary>
      <main className="min-h-screen bg-gradient-to-br from-[#f5f5dc] via-white to-[#FF8A65]/20">
    {/*  Top Banner with Breadcrumb */}
      <div className="relative w-full h-48 sm:h-64 md:h-72 lg:h-80 ">
        <Image
          src="/images/statbg7.jpg" // put your banner in /public
          alt="Products Banner"
          fill
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/40 flex flex-col justify-center items-center text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-white">
            Profile
          </h1>
          <p className="text-sm md:text-base text-gray-200 mt-2">
            Home / Profile
          </p>
        </div>
      </div>


  

 <div className="min-h-screen bg-transparent flex">
  {/* Sidebar */}
  <aside className="hidden lg:block w-64 xl:w-72 shrink-0 bg-white h-screen sticky top-0">
    <div className="">
      {sidebar}
    </div>
  </aside>

  {/* Main Content */}
  <div className="flex-1 min-w-0">
    {/* Mobile Bottom Sidebar */}
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
      <div className="backdrop-blur-xl bg-white/90 border-t border-gray-200 px-4 py-2">
        <div className="flex justify-around">
          {getSidebarItems(role, notiCount).slice(0, 5).map((item, i) => (
            <button
              key={i}
              onClick={item.onClick}
              className="flex flex-col items-center py-2 px-3 text-xs font-medium text-gray-600 hover:text-[#FF8A65] transition-colors relative"
            >
              {item.icon}
              <span className="mt-1 truncate max-w-12">{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>

    {/* Page Content */}
    <div className="container mx-auto px-3 sm:px-4 md:px-6 max-w-7xl py-6">
      <div className="bg-transparent  rounded-2xl p-4 sm:p-6 md:p-8">
        {/* Header */}
        <header className=" mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <motion.h1 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="text-2xl md:text-3xl font-bold text-[#FF8A65]"
            >
              Welcome to POSHIK
            </motion.h1>
            <motion.p 
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-gray-600 text-sm"
            >
              Premium Pet Care Services at Your Fingertips
            </motion.p>
          </div>
          
          <div className="flex items-center gap-3 text-md text-[#FF8A65] mr-1 text-extrabold">
            <span
              className="px-3 py-1 rounded-full bg-[#FF8A65] text-white font-semibold border border-white/20"
            >
              {role === 'admin'
                ? `Admin${firstName ? ` • ${firstName}` : ''}`
                : role === 'vet'
                ? `Vet • ${vetKyc ?? 'pending'}`
                : role === 'user'
                ? `User${firstName ? ` • ${firstName}` : ''}`
                : 'Guest'}
            </span>
          </div>
        </header>

        {/* Dynamic content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={role + (vetKyc ?? '')}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            {content}
          </motion.div>
        </AnimatePresence>

        {/* Message Display */}
        <AnimatePresence>
          {msg && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mt-6 rounded-xl p-4 shadow-sm ${
                msgType === 'error' ? 'bg-red-50 text-red-800 border border-red-200' :
                msgType === 'success' ? 'bg-green-50 text-green-800 border border-green-200' :
                'bg-blue-50 text-blue-800 border border-blue-200'
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg">
                  {msgType === 'error' ? '❌' : msgType === 'success' ? '✅' : 'ℹ️'}
                </span>
                <p className="text-sm font-medium">{msg}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  </div>
</div>


       {/* My Pets Modal */}
<AnimatePresence>
  {showPets && (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && setShowPets(false)}
    >
      <motion.div
        className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", duration: 0.3 }}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h3 className="text-2xl font-bold text-gray-800">My Pets 🐾</h3>
          <button
            onClick={() => setShowPets(false)}
            className="rounded-full bg-gray-100 p-2 text-gray-600 hover:bg-gray-200 transition-colors"
          >
            <IconX size={20} />
          </button>
        </div>

        {/* Loading State */}
        {petsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-48 bg-gray-200 rounded-xl mb-3" />
                <div className="h-4 bg-gray-200 rounded mb-2" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : pets.length === 0 ? (
          /* Empty State */
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🐱</div>
            <h4 className="text-xl font-semibold text-gray-800 mb-2">
              No pets added yet
            </h4>
            <p className="text-gray-600 mb-4">
              Add your first furry friend to get started!
            </p>
            <Link href="/pets/new" className="btn-primary">
              Add Pet
            </Link>
          </div>
        ) : (
          /* Pets Grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {pets.map((pet, index) => (
              <motion.div
                key={pet.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="group relative overflow-hidden rounded-2xl bg-white shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {/* Pet Image */}
                <div className="relative h-48 w-full bg-gradient-to-br from-gray-100 to-gray-200">
                 {pet.photo_resolved ? (
  <Image
    src={pet.photo_resolved}
    alt={pet.name || "Pet"}
    fill
    sizes="100%"
    className="object-cover group-hover:scale-105 transition-transform duration-300"
  />
) : (
  <div className="flex h-full w-full items-center justify-center text-4xl">
    {pet.name?.[0]}
  </div>
)}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                </div>

                {/* Pet Info */}
                <div className="p-4">
                  <h4 className="font-bold text-lg text-gray-800 mb-1">
                    {pet.name}
                  </h4>
                  <p className="text-sm text-gray-600 mb-3">
                    {pet.species || "Pet"}
                    {pet.breed && ` • ${pet.breed}`}
                    {pet.dob &&
                      ` • Born ${new Date(pet.dob).toLocaleDateString()}`}
                  </p>
                  <div className="flex gap-2">
                    <Link
                      href={`/pets/${pet.id}`}
                      className="btn-primary text-center text-s px-3 py-1.5 rounded-full"
                    >
                      View Profile
                    </Link>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

      </main>
    </ErrorBoundary>
  );
}

export function AdminDashboard({
  firstName,
  meId,
  rows,
  stats,
  busy,
  setBusy,
  showMessage,
  refresh,
  profileAvatar,
  onAvatarChange,
}: {
  firstName: string;
  meId: string | null;
  rows: VetRow[];
  stats: { users: number; vetsPending: number; vetsApproved: number };
  busy: string;
  setBusy: (s: string) => void;
  showMessage: (msg: string, type?: "success" | "error" | "info") => void;
  refresh: () => Promise<void>;
  profileAvatar: string | null;
  onAvatarChange: (url: string | null) => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);

  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

  const filteredRows = useMemo(() => {
    if (!debouncedSearch) return rows;
    return rows.filter(
      (vet) =>
        vet.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        vet.email.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [rows, debouncedSearch]);

  async function setKyc(id: string, status: "approved" | "rejected") {
    try {
      setBusy(id);
      const { data, error } = await supabase
        .from("veterinarian")
        .update({
          kyc_status: status,
          approved_by: meId ?? null,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select("id, kyc_status")
        .single();

      if (error) throw error;
      if (!data) throw new Error("No row returned. Check table configuration.");

      await refresh();
      showMessage(
        `Veterinarian ${
          status === "approved" ? "approved" : "rejected"
        } successfully!`,
        "success"
      );
    } catch (err: any) {
      console.error("KYC update error:", err);
      showMessage(err?.message ?? "Failed to update KYC status.", "error");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <Card className="bg-gradient-to-r from-[#FF8A65]/10 to-[#f5f5dc]/10 border-[#FF8A65]/20">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-4">
            <AvatarPicker
              currentUrl={profileAvatar}
              meId={meId}
              table="users"
              showMessage={showMessage}
              onUploaded={onAvatarChange}
            />
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">
                Hello, {firstName || "Admin"}
              </h2>
              <p className="text-gray-600">
                Here's what's happening on Poshik today.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Metric
              title="Total Users"
              value={stats.users}
              icon={<IconUsers />}
              gradient="from-blue-500 to-indigo-600"
              trend="+12%"
            />
            <Metric
              title="Pending KYC"
              value={stats.vetsPending}
              icon={<IconShield />}
              gradient="from-amber-500 to-orange-600"
              trend={stats.vetsPending > 0 ? "Needs attention" : "All clear"}
            />
            <Metric
              title="Approved Vets"
              value={stats.vetsApproved}
              icon={<IconMedal />}
              gradient="from-emerald-500 to-teal-600"
              trend="+3 this week"
            />
          </div>
        </div>
      </Card>

      {/* KYC Review Section */}
      <Card>
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-1">
              KYC Review Center
            </h3>
            <p className="text-gray-600 text-sm">
              Review and approve veterinarian applications
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field pl-10 pr-4 w-64"
                placeholder="Search veterinarians..."
              />
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">
                <IconSearch size={16} />
              </span>
            </div>
            <button onClick={refresh} className="btn-secondary p-2" title="Refresh">
              <IconRefresh size={16} />
            </button>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📋</div>
            <h4 className="text-xl font-semibold text-gray-800 mb-2">
              {searchQuery ? "No matching applications" : "No pending applications"}
            </h4>
            <p className="text-gray-600">
              {searchQuery
                ? "Try adjusting your search terms."
                : "All veterinarian applications have been reviewed."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRows.map((vet, index) => (
              <motion.div
                key={vet.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="kyc-card"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="h-16 w-16 rounded-full overflow-hidden ring-2 ring-[#FF8A65]/30">
                        <Image
                          src={vet.avatar_url || "/images/avatar-placeholder.png"}
                          width={64}
                          height={64}
                          alt={vet.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-amber-400 rounded-full flex items-center justify-center">
                        <span className="text-xs">👨‍⚕️</span>
                      </div>
                    </div>

                    <div className="flex-1">
                      <h4 className="font-bold text-lg text-gray-800">{vet.name}</h4>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mt-1">
                        <span className="flex items-center gap-1">
                          <IconMail size={14} />
                          {vet.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <IconPhone size={14} />
                          {vet.phone || "Not provided"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className={`status-badge ${
                            vet.medical_doc_url
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          Medical License: {vet.medical_doc_url ? "Provided" : "Missing"}
                        </span>
                        <span className="status-badge bg-amber-100 text-amber-800">
                          Status: {vet.kyc_status}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    {vet.medical_doc_url && (
                      <button
                        onClick={() => setSelectedDoc(vet.medical_doc_url!)}
                        className="btn-secondary text-sm flex items-center gap-2"
                      >
                        <IconDocument size={16} />
                        View Document
                      </button>
                    )}

                    <button
                      disabled={busy === vet.id}
                      onClick={() => setKyc(vet.id, "approved")}
                      className="btn-success text-sm flex items-center gap-2"
                    >
                      <IconCheck size={16} />
                      {busy === vet.id ? "Processing..." : "Approve"}
                    </button>

                    <button
                      disabled={busy === vet.id}
                      onClick={() => setKyc(vet.id, "rejected")}
                      className="btn-danger text-sm flex items-center gap-2"
                    >
                      <IconX size={16} />
                      {busy === vet.id ? "Processing..." : "Reject"}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>

      {/* PDF Preview Modal */}
     <AnimatePresence>
  {selectedDoc && (
    <motion.div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => e.target === e.currentTarget && setSelectedDoc(null)}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden"
      >
        <div className="flex justify-between items-center p-4 border-b">
          <h4 className="text-lg font-semibold text-gray-800">
            Medical Document
          </h4>
          <button
            onClick={() => setSelectedDoc(null)}
            className="text-gray-500 hover:text-gray-800"
          >
            <span className="text-2xl">❌</span>
          </button>
        </div>
        <iframe
          src={selectedDoc}
          className="flex-1 w-full"
          title="Medical Document"
        />
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

    </div>
  );
}

function KycPending({ status }: { status: 'pending' | 'rejected' | 'approved' }) {
  const statusConfig = {
    pending: {
      icon: '⏳',
      title: 'Application Under Review',
      description: 'Your veterinarian application is being reviewed by our team.',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
      borderColor: 'border-amber-200',
    },
    rejected: {
      icon: '❌',
      title: 'Application Rejected',
      description: 'Your application has been rejected. Please contact support for more information.',
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
    },
    approved: {
      icon: '✅',
      title: 'Application Approved',
      description: 'Congratulations! Your application has been approved.',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
  };

  const config = statusConfig[status];

  return (
    <Card className={`${config.bgColor} ${config.borderColor}`}>
      <div className="text-center py-8">
        <div className="text-6xl mb-4">{config.icon}</div>
        <h2 className={`text-2xl font-bold mb-3 ${config.color}`}>
          {config.title}
        </h2>
        <p className="text-gray-700 mb-6 max-w-md mx-auto">
          {config.description}
        </p>
        
        {status === 'pending' && (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
              <div className="animate-spin h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full"></div>
              Processing your application...
            </div>
            <p className="text-xs text-gray-500">
              This usually takes 1-2 business days
            </p>
          </div>
        )}
        
        {status === 'rejected' && (
          <button className="btn-primary">
            Contact Support
          </button>
        )}
      </div>
    </Card>
  );
}

function VetDashboard({
  name,
  meId,
  avatarUrl,
  onAvatarChange,
  showMessage,
}: {
  name: string;
  meId: string | null;
  avatarUrl: string | null;
  onAvatarChange: (url: string | null) => void;
  showMessage: (msg: string, type?: 'success' | 'error' | 'info') => void;
}) {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');

  useEffect(() => {
    if (!meId) return;

    const fetchAppointments = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('appointments')
          .select('id, created_at, status, users(first_name, email, avatar_url)')
          .eq('vet_id', meId)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setAppointments(data || []);
      } catch (error: any) {
        console.error('Fetch appointments error:', error);
        showMessage('Failed to load appointments', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [meId, showMessage]);

  async function updateStatus(id: string, status: 'accepted' | 'rejected') {
    try {
      setBusyId(id);
      const { error } = await supabase
        .from('appointments')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
      showMessage(`Appointment ${status} successfully!`, 'success');
    } catch (err: any) {
      console.error('Update status error:', err);
      showMessage('Failed to update appointment status', 'error');
    } finally {
      setBusyId(null);
    }
  }

  const filteredAppointments = useMemo(() => {
    if (filter === 'all') return appointments;
    return appointments.filter(a => a.status === filter);
  }, [appointments, filter]);

  const stats = useMemo(() => {
    return {
      total: appointments.length,
      pending: appointments.filter(a => a.status === 'pending').length,
      accepted: appointments.filter(a => a.status === 'accepted').length,
      rejected: appointments.filter(a => a.status === 'rejected').length,
    };
  }, [appointments]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-[#FF8A65]/10 to-[#f5f5dc]/10 border-[#FF8A65]/20">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-4">
            <AvatarPicker
              currentUrl={avatarUrl}
              meId={meId}
              table="veterinarian"
              showMessage={showMessage}
              onUploaded={onAvatarChange}
            />
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-1">
                Welcome, {name ? `Dr. ${name}` : 'Doctor'} 🩺
              </h2>
              <p className="text-gray-600">Manage your appointments and patients</p>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="text-center p-3 bg-white rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-[#FF8A65]">{stats.total}</p>
              <p className="text-xs text-gray-600">Total</p>
            </div>
            <div className="text-center p-3 bg-white rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
              <p className="text-xs text-gray-600">Pending</p>
            </div>
            <div className="text-center p-3 bg-white rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-green-600">{stats.accepted}</p>
              <p className="text-xs text-gray-600">Accepted</p>
            </div>
            <div className="text-center p-3 bg-white rounded-lg shadow-sm">
              <p className="text-2xl font-bold text-red-600">{stats.rejected}</p>
              <p className="text-xs text-gray-600">Rejected</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Appointments */}
      <Card>
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-1">Appointments</h3>
            <p className="text-gray-600 text-sm">Manage your patient appointments</p>
          </div>
          
          <div className="flex gap-2">
            {(['all', 'pending', 'accepted', 'rejected'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  filter === f
                    ? 'bg-[#FF8A65] text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
                {f !== 'all' && stats[f] > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-white/20 rounded-full">
                    {stats[f]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="h-12 w-12 bg-gray-200 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-1/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredAppointments.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📅</div>
            <h4 className="text-xl font-semibold text-gray-800 mb-2">
              {filter === 'all' ? 'No appointments yet' : `No ${filter} appointments`}
            </h4>
            <p className="text-gray-600">
              {filter === 'all' 
                ? 'Your appointments will appear here once patients book with you.'
                : `Switch to "All" to see appointments with other statuses.`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredAppointments.map((appointment, index) => (
              <motion.div
                key={appointment.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="appointment-card"
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full overflow-hidden bg-gray-100">
                      <Image
                        src={appointment.users?.avatar_url || '/images/avatar-placeholder.png'}
                        width={48}
                        height={48}
                        alt={appointment.users?.first_name || 'Patient'}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    
                    <div className="flex-1">
                      <h4 className="font-semibold text-gray-800">
                        {appointment.users?.first_name || 'Unknown Patient'}
                      </h4>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <IconMail size={14} />
                          {appointment.users?.email}
                        </span>
                        <span className="flex items-center gap-1">
                          <IconCalendar size={14} />
                          {new Date(appointment.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-2">
                        <span className={`status-badge ${
                          appointment.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                          appointment.status === 'accepted' ? 'bg-green-100 text-green-800' :
                          appointment.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {appointment.status?.charAt(0).toUpperCase() + appointment.status?.slice(1) || 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {appointment.status === 'pending' && (
                    <div className="flex gap-3">
                      <button
                        disabled={busyId === appointment.id}
                        onClick={() => updateStatus(appointment.id, 'accepted')}
                        className="btn-success text-sm flex items-center gap-2"
                      >
                        <IconCheck size={16} />
                        {busyId === appointment.id ? 'Processing...' : 'Accept'}
                      </button>
                      
                      <button
                        disabled={busyId === appointment.id}
                        onClick={() => updateStatus(appointment.id, 'rejected')}
                        className="btn-danger text-sm flex items-center gap-2"
                      >
                        <IconX size={16} />
                        {busyId === appointment.id ? 'Processing...' : 'Reject'}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function UserDashboard({
  firstName,
  meId,
  profileAvatar,
  onAvatarChange,
  showMessage,
  onExploreMyPets,
}: {
  firstName: string;
  meId: string | null;
  profileAvatar: string | null;
  onAvatarChange: (url: string | null) => void;
  showMessage: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onExploreMyPets: () => void;
}) {
  return (
    <div className="space-y-6 ">
      {/* Welcome Section */}
     <Card className="!bg-[#FF8A55]">

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-4 ">
            <div className="ring-4 ring-[#f5f5dc] rounded-full bg-white">
    <AvatarPicker
      currentUrl={profileAvatar}
      meId={meId}
      table="users"
      showMessage={showMessage}
      onUploaded={onAvatarChange}
    
    />
  </div>
            <div>
              <h2 className="text-2xl font-bold text-[#f5f5dc] mb-1">
                Hello{firstName ? `, ${firstName}` : ''}
              </h2>
              <p className="text-[#f5f5dc]">Your journey starts here with Us</p>
            </div>
          </div>

         
        </div>
      </Card>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <FeatureCard
          title="Pet Profiles"
          description="Create detailed profiles for all your furry friends with photos, medical history, and more."
          icon="🐶🐰🦜🐈"
          gradient="from-[#FF7A00] to-[#FF3D00]"
          action="Manage Pets"
          onClick={onExploreMyPets}
        />
        
        <FeatureCard
          title="Book Appointments"
          description="Find qualified veterinarians near you and schedule appointments with ease."
          icon="📅🩺💉🏥"
          gradient="from-[#5F97C9] to-[#64B5F6]"
          action="Book Now"
          href="/appointments/new"
        />
        
        <FeatureCard
          title="Shop Products"
          description="Browse premium pet food, medicines, and accessories for your beloved pets."
          icon="🏷️🛒💳🛍️"
          gradient="from-[#FF5F3E] to-[#FF007F]"
          action="Shop Now"
          href="/products"
        />
        
       
      </div>

      {/* Recent Activity */}
      <Card>
        <h3 className="text-xl font-bold text-[#FF8A65] ">Recent Activity</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-transparent rounded-lg">
            
            <div className="flex-1">
              <p className="font-medium text-gray-800">Welcome to Poshik</p>
              <p className="text-sm text-gray-600">Complete your profile to get personalized recommendations</p>
            </div>
            <span className="text-xs text-gray-500">Just now</span>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ================= UI Components ================= */

function Card({ 
  children, 
  className = '' 
}: { 
  children: React.ReactNode; 
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`bg-white/80 backdrop-blur-sm border border-white/30 rounded-2xl p-6 shadow-lg hover:shadow-xl transition-shadow duration-300 ${className}`}
    >
      {children}
    </motion.div>
  );
}

function LoadingCard() {
  return (
    <Card>
      <div className="animate-pulse space-y-4">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 bg-gray-200 rounded-full" />
          <div className="space-y-2 flex-1">
            <div className="h-4 bg-gray-200 rounded w-1/4" />
            <div className="h-3 bg-gray-200 rounded w-1/2" />
          </div>
        </div>
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-4 bg-gray-200 rounded w-1/2" />
        </div>
      </div>
    </Card>
  );
}

function Metric({
  title,
  value,
  icon,
  gradient,
  trend,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  gradient: string;
  trend?: string;
}) {
  return (
    <div className="relative overflow-hidden bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow duration-300">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg bg-gradient-to-br ${gradient} p-2.5 text-white shadow-md`}>
          {icon}
        </div>
        <div className="flex-1">
          <p className="text-xs text-gray-600 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-800 leading-tight">{value}</p>
          {trend && (
            <p className="text-xs text-gray-500 mt-0.5">{trend}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  label,
  href,
  onClick,
  icon,
  color,
}: {
  label: string;
  href?: string;
  onClick?: () => void;
  icon: string;
  color: string;
}) {
  const Component: any = href ? Link : 'button';
  const props = href ? { href } : { onClick, type: 'button' };

  return (
    <Component
      {...props}
      className="group relative overflow-hidden bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 hover:scale-105"
    >
      <div className="flex flex-col items-center text-center gap-2">
        <div className={`h-10 w-10 rounded-lg ${color} flex items-center justify-center text-white text-lg shadow-md group-hover:scale-110 transition-transform duration-300`}>
          {icon}
        </div>
        <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">
          {label}
        </span>
      </div>
    </Component>
  );
}

function FeatureCard({
  title,
  description,
  icon,
  gradient,
  action,
  href,
  onClick,
}: {
  title: string;
  description: string;
  icon: string;
  gradient: string;
  action: string;
  href?: string;
  onClick?: () => void;
}) {
  const Component: any = href ? Link : 'button';
  const props = href ? { href } : { onClick, type: 'button' };

  return (
    <div className="group relative overflow-hidden bg-white rounded-2xl p-6 shadow-sm  transition-all duration-300 hover:scale-105">
      {/* Background gradient */}
      <div className={`absolute -top-10 -right-10 h-32 w-32 bg-gradient-to-br ${gradient} opacity-20 rounded-full blur-xl group-hover:scale-350 transition-transform duration-500`} />
      
      <div className="relative z-10">
        <div className="text-4xl mb-4">{icon}</div>
        <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-gray-600 text-sm mb-6 leading-relaxed">{description}</p>
        
        <Component
          {...props}
          className={`inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r ${gradient} text-white rounded-lg font-medium text-sm shadow-md hover:shadow-lg transition-all duration-300 group-hover:translate-x-1`}
        >
          {action}
          <span className="group-hover:translate-x-0.5 transition-transform duration-300">→</span>
        </Component>
      </div>
    </div>
  );
}

function AvatarPicker({
  currentUrl,
  meId,
  table,
  showMessage,
  onUploaded,
}: {
  currentUrl: string | null;
  meId: string | null;
  table: 'users' | 'veterinarian';
  showMessage: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onUploaded: (url: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const handlePick = useCallback(() => {
    fileRef.current?.click();
  }, []);

  const onFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!meId) {
      showMessage('Not signed in', 'error');
      return;
    }

    // Validate file
    if (!file.type.startsWith('image/')) {
      showMessage('Please select a valid image file', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showMessage('Image must be less than 5MB', 'error');
      return;
    }

    try {
      setUploading(true);
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${meId}/avatar-${Date.now()}.${ext}`;
      
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, {
          upsert: true,
          contentType: file.type,
        });
        
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage
        .from('avatars')
        .getPublicUrl(path);
        
      const publicUrl = pub?.publicUrl ?? '';

      const { error: dbErr } = await supabase
        .from(table)
        .update({ avatar_url: publicUrl } as any)
        .eq('id', meId);
        
      if (dbErr) throw dbErr;

      onUploaded(publicUrl);
      showMessage('Profile picture updated successfully!', 'success');
    } catch (err: any) {
      console.error('Avatar upload error:', err);
      showMessage(err?.message ?? 'Failed to upload profile picture', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }, [meId, table, showMessage, onUploaded]);

  return (
    <div className="relative group">
      <div className="h-20 w-20 rounded-full overflow-hidden ring-4 ring-[#FF8A65]/30 shadow-lg">
        <Image
          src={currentUrl || '/images/avatar-placeholder.png'}
          alt="Profile"
          width={80}
          height={80}
          className="h-full w-full object-cover"
        />
      </div>
      
      <button
        onClick={handlePick}
        disabled={uploading}
        className="absolute -bottom-1 -right-1 h-8 w-8 bg-[#FF8A65] text-white rounded-full flex items-center justify-center shadow-lg hover:bg-[#FF8A65]/90 transition-all duration-300 hover:scale-110 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Upload profile picture"
      >
        {uploading ? (
          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
        ) : (
          <IconCamera size={16} />
        )}
      </button>
      
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
    </div>
  );
}

/* ================= Icons ================= */

function IconHome({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
      <polyline points="9,22 9,12 15,12 15,22"/>
    </svg>
  );
}

function IconUsers({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  );
}

function IconShield({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  );
}

function IconMedal({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="6"/>
      <path d="M8.5 14L7 22l5-3 5 3-1.5-8"/>
    </svg>
  );
}

function IconCheck({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12"/>
    </svg>
  );
}

function IconX({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}

function IconSearch({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/>
      <path d="M21 21l-4.35-4.35"/>
    </svg>
  );
}

function IconRefresh({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23,4 23,10 17,10"/>
      <polyline points="1,20 1,14 7,14"/>
      <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
    </svg>
  );
}

function IconMail({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
    </svg>
  );
}

function IconPhone({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
    </svg>
  );
}

function IconDocument({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
    </svg>
  );
}

function IconCalendar({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/>
      <line x1="8" y1="2" x2="8" y2="6"/>
      <line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
}

function IconUser({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function IconBell({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
      <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
}

function IconChart({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  );
}

function IconPackage({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
      <polyline points="3.27,6.96 12,12.01 20.73,6.96"/>
      <line x1="12" y1="22.08" x2="12" y2="12"/>
    </svg>
  );
}

function IconShoppingBag({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10a4 4 0 0 1-8 0"/>
    </svg>
  );
}

function IconCompass({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/>
      <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88 16.24,7.76"/>
    </svg>
  );
}

function IconPlus({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  );
}

function IconHeart({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  );
}

function IconSettings({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
    </svg>
  );
}

function IconTrash({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3,6 5,6 21,6"/>
      <path d="M19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"/>
      <line x1="10" y1="11" x2="10" y2="17"/>
      <line x1="14" y1="11" x2="14" y2="17"/>
    </svg>
  );
}

function IconLogOut({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16,17 21,12 16,7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

function IconCamera({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  );
}

/* ================= Data Loading Functions ================= */

async function loadPendingVets(setRows: (r: VetRow[]) => void) {
  try {
    const { data, error } = await supabase
      .from('veterinarian')
      .select('id,name,email,phone,medical_doc_url,kyc_status,avatar_url')
      .eq('kyc_status', 'pending')
      .order('created_at', { ascending: true });
      
    if (error) throw error;
    setRows((data ?? []) as VetRow[]);
  } catch (error) {
    console.error('Load pending vets error:', error);
    setRows([]);
  }
}

async function loadAdminStats(setStats: (s: { users: number; vetsPending: number; vetsApproved: number }) => void) {
  try {
    const [usersResult, pendingResult, approvedResult] = await Promise.allSettled([
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('veterinarian').select('id', { count: 'exact', head: true }).eq('kyc_status', 'pending'),
      supabase.from('veterinarian').select('id', { count: 'exact', head: true }).eq('kyc_status', 'approved'),
    ]);

    const users = usersResult.status === 'fulfilled' ? usersResult.value.count ?? 0 : 0;
    const vetsPending = pendingResult.status === 'fulfilled' ? pendingResult.value.count ?? 0 : 0;
    const vetsApproved = approvedResult.status === 'fulfilled' ? approvedResult.value.count ?? 0 : 0;

    setStats({ users, vetsPending, vetsApproved });
  } catch (error) {
    console.error('Load admin stats error:', error);
    setStats({ users: 0, vetsPending: 0, vetsApproved: 0 });
  }
}

async function loadNotiCount(userId: string, _role: 'user' | 'vet' | 'admin', setCount: (n: number) => void) {
  try {
    const { count, error } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('seen', false);
      
    if (error) throw error;
    setCount(count ?? 0);
  } catch (error) {
    console.error('Load notification count error:', error);
    setCount(0);
  }
}

