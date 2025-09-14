'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

/* ================= Types ================= */

type PetRow = {
  id: string;
  owner_id: string;
  name: string;
  species?: string | null;
  breed?: string | null;
  avatar_url: string;
  photo_url?: string | null;
  dob?: string | null;
};

type PetUI = PetRow & { photo_resolved?: string | null };

/* ================= Main Component ================= */

export default function UserDashboard() {
  const [firstName, setFirstName] = useState('');
  const [meId, setMeId] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [showPets, setShowPets] = useState(false);
  const [pets, setPets] = useState<PetUI[]>([]);
  const [petsLoading, setPetsLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error' | 'info'>('info');

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

  const initializeUser = useCallback(async () => {
    try {
      setMsg('');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) throw authError;
      if (!user) return;
      
      setMeId(user.id);

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('first_name, role, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError && !profileError.message.includes('duplicate key')) {
        throw profileError;
      }

      if (profile) {
        setFirstName(profile.first_name ?? '');
        setProfileAvatar((profile as any).avatar_url ?? null);
      }
    } catch (error: any) {
      handleError(error, 'User initialization');
    }
  }, [handleError]);

  useEffect(() => {
    initializeUser();
  }, [initializeUser]);

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
          const primary = p.avatar_url ?? p.photo_url ?? null;
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

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <Card className="!bg-[#FF8A55]">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="ring-4 ring-[#f5f5dc] rounded-full bg-white">
              <AvatarPicker
                currentUrl={profileAvatar}
                meId={meId}
                table="users"
                showMessage={showMessage}
                onUploaded={setProfileAvatar}
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
          onClick={loadMyPets}
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
        <h3 className="text-xl font-bold text-[#FF8A65]">Recent Activity</h3>
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
    <div className="group relative overflow-hidden bg-white rounded-2xl p-6 shadow-sm transition-all duration-300 hover:scale-105">
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

function IconX({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18"/>
      <line x1="6" y1="6" x2="18" y2="18"/>
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

/* ================= Utility Functions ================= */

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







