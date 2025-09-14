'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

/* ================= Types ================= */

type VetRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  medical_doc_url: string | null;
  kyc_status: 'pending' | 'approved' | 'rejected';
  avatar_url?: string | null;
};

/* ================= Main Component ================= */

export default function AdminDashboard() {
  const [firstName, setFirstName] = useState('');
  const [meId, setMeId] = useState<string | null>(null);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [pendingVets, setPendingVets] = useState<VetRow[]>([]);
  const [stats, setStats] = useState({ users: 0, vetsPending: 0, vetsApproved: 0 });
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error' | 'info'>('info');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);

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

      if (profile?.role === 'admin') {
        setFirstName(profile.first_name ?? '');
        setProfileAvatar((profile as any).avatar_url ?? null);
        
        await Promise.allSettled([
          loadPendingVets(setPendingVets).catch(e => handleError(e, 'Loading pending vets')),
          loadAdminStats(setStats).catch(e => handleError(e, 'Loading admin stats')),
        ]);
      }
    } catch (error: any) {
      handleError(error, 'User initialization');
    }
  }, [handleError]);

  useEffect(() => {
    initializeUser();
  }, [initializeUser]);

  const debouncedSearch = useMemo(() => {
    const timer = setTimeout(() => searchQuery, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const filteredRows = useMemo(() => {
    if (!searchQuery) return pendingVets;
    return pendingVets.filter(
      (vet) =>
        vet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        vet.email.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [pendingVets, searchQuery]);

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

      await Promise.allSettled([
        loadPendingVets(setPendingVets),
        loadAdminStats(setStats)
      ]);
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
              onUploaded={setProfileAvatar}
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
            <button 
              onClick={() => {
                loadPendingVets(setPendingVets);
                loadAdminStats(setStats);
              }} 
              className="btn-secondary p-2" 
              title="Refresh"
            >
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

