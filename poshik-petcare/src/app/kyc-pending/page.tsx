'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

type KycStatus = 'pending' | 'approved' | 'rejected';

export default function VetKycPendingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<KycStatus>('pending');
  const [msg, setMsg] = useState<string>('');

  // Load current vet row and set up realtime listener
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setMsg('You are not signed in. Redirecting…');
        return router.replace('/poshik-auth');
      }

      const { data: vet, error } = await supabase
        .from('veterinarian')
        .select('name, email, medical_doc_url, kyc_status')
        .eq('id', user.id)
        .maybeSingle();

      if (error || !vet) {
        setMsg(error?.message || 'No veterinarian profile found. Please sign up as a vet.');
        setLoading(false);
        return;
      }

      setName(vet.name ?? '');
      setEmail(vet.email ?? '');
      setFileName(vet.medical_doc_url ?? null);
      setStatus((vet.kyc_status as KycStatus) ?? 'pending');
      setLoading(false);

      // If already approved, go straight to dashboard
      if (vet.kyc_status === 'approved') {
        router.replace('/vet/dashboard');
        return;
      }

      // Realtime: listen for kyc_status changes for this vet
      channel = supabase
        .channel('vet-kyc-status')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'veterinarian',
            filter: `email=eq.${vet.email}`, // or filter by id if RLS allows returning id
          },
          (payload) => {
            const row = payload.new as { kyc_status?: KycStatus; medical_doc_url?: string };
            if (!row) return;
            if (row.medical_doc_url !== undefined) setFileName(row.medical_doc_url ?? null);
            if (row.kyc_status) {
              setStatus(row.kyc_status);
              if (row.kyc_status === 'approved') {
                setMsg('KYC approved! Redirecting…');
                router.replace('/vet/dashboard');
              }
            }
          }
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [router]);

  const statusBadge = useMemo(() => {
    const color =
      status === 'approved' ? 'bg-green-600' : status === 'rejected' ? 'bg-red-600' : 'bg-yellow-500';
    const text =
      status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Pending Review';
    return <span className={`rounded-full px-3 py-1 text-xs font-semibold text-white ${color}`}>{text}</span>;
  }, [status]);

  return (
    <main className="min-h-[100dvh] w-full bg-slate-800 py-10">
      <div className="mx-auto max-w-[900px] px-4 mt-40">
        <section className="rounded-[22px] bg-[#FF8A65] p-6 sm:p-8 md:p-10 text-white shadow-xl">
          <header className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-extrabold tracking-tight">KYC Verification</h1>
            <div className="flex items-center gap-2">
              {statusBadge}
              <button
                onClick={async () => { await supabase.auth.signOut(); location.href = '/signup'; }}
                className="rounded-full bg-[#0e2a36] px-4 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Sign out
              </button>
            </div>
          </header>

          <div className="rounded-2xl bg-white p-6 text-[#0d1b22] shadow-md">
            {loading ? (
              <div className="animate-pulse text-sm text-[#7b8b92]">Loading your KYC status…</div>
            ) : (
              <>
                <h2 className="mb-1 text-xl font-bold">Hello, Dr. {name || '—'}</h2>
                <p className="text-sm text-[#5a6b73]">{email || '—'}</p>

                <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                  <InfoTile title="Current Status">
                    <span className="font-semibold capitalize">{status}</span>
                  </InfoTile>
                  <InfoTile title="PDF Attached">
                    <span className="font-semibold">{fileName ? 'Yes' : 'No'}</span>
                  </InfoTile>
                  <InfoTile title="Next Step">
                    {status === 'pending' && <span>Our admin will review your registration shortly.</span>}
                    {status === 'rejected' && (
                      <span>
                        Your KYC was rejected. You can re-submit your details or contact support.
                      </span>
                    )}
                    {status === 'approved' && <span>Redirecting you to your dashboard…</span>}
                  </InfoTile>
                </div>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    onClick={async () => {
                      // Manual refresh in case realtime is blocked
                      const { data: { user } } = await supabase.auth.getUser();
                      if (!user) return;
                      const { data: vet } = await supabase
                        .from('veterinarian')
                        .select('kyc_status, medical_doc_url, name, email')
                        .eq('id', user.id)
                        .maybeSingle();

                      if (vet) {
                        setStatus(vet.kyc_status as KycStatus);
                        setFileName(vet.medical_doc_url ?? null);
                        setName(vet.name ?? '');
                        setEmail(vet.email ?? '');
                        if (vet.kyc_status === 'approved') {
                          setMsg('KYC approved! Redirecting…');
                          location.href = '/vet/dashboard';
                        }
                      }
                    }}
                    className="rounded-full bg-[#0e2a36] px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
                  >
                    Refresh Status
                  </button>

                  <a
                    href="/portal"
                    className="rounded-full bg-white/90 px-5 py-3 text-sm font-semibold text-[#e17824] hover:bg-white"
                  >
                    Back to Portal
                  </a>

                  {status === 'rejected' && (
                    <a
                      href="mailto:support@poshik.app?subject=Vet%20KYC%20Help"
                      className="rounded-full bg-red-600 px-5 py-3 text-sm font-semibold text-white hover:bg-red-700"
                    >
                      Contact Support
                    </a>
                  )}
                </div>
              </>
            )}
          </div>

          {msg && (
            <p className="mt-6 rounded-xl bg-white/90 px-4 py-3 text-sm font-medium text-[#7a2f00]">
              {msg}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}

/* ---------- tiny UI helpers ---------- */
function InfoTile({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[#f7fafb] p-4">
      <p className="text-xs font-medium text-[#5a6b73]">{title}</p>
      <div className="mt-1 text-sm text-[#0d1b22]">{children}</div>
    </div>
  );
}
