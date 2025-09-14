'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

/* ================= Types ================= */

type Appointment = {
  id: string;
  created_at: string;
  status: 'pending' | 'accepted' | 'rejected';
  users: {
    first_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
};

/* ================= Main Component ================= */

export default function VetDashboard() {
  const [name, setName] = useState('');
  const [meId, setMeId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');
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

      const { data: vet, error: vetError } = await supabase
        .from('veterinarian')
        .select('name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();

      if (vetError) throw vetError;

      if (vet) {
        setName(vet.name ?? '');
        setAvatarUrl(vet.avatar_url ?? null);
      }
    } catch (error: any) {
      handleError(error, 'User initialization');
    }
  }, [handleError]);

  useEffect(() => {
    initializeUser();
  }, [initializeUser]);

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
              onUploaded={setAvatarUrl}
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
                : `Switch to "All" to see appointments with other statuses.`}
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

function IconMail({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
      <polyline points="22,6 12,13 2,6"/>
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

function IconCamera({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  );
}









