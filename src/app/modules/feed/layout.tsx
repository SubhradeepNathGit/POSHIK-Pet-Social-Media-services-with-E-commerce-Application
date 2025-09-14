'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/sidebar';

interface FeedLayoutProps {
  children: React.ReactNode;
}

export default function FeedLayout({ children }: FeedLayoutProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    name: string;
    avatarUrl: string | null;
    role: string;
  }>({ name: '', avatarUrl: null, role: 'user' });
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          router.push('/signup');
          return;
        }

        // Check user role and get profile info
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('first_name, role, avatar_url')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError || !profile) {
          router.push('/signup');
          return;
        }

        // Check if user is a vet
        if (profile.role === 'vet') {
          const { data: vet, error: vetError } = await supabase
            .from('veterinarian')
            .select('name, avatar_url')
            .eq('id', user.id)
            .maybeSingle();

          if (vetError || !vet) {
            router.push('/modules/user');
            return;
          }

          setUserInfo({
            name: vet.name || 'Doctor',
            avatarUrl: vet.avatar_url,
            role: 'vet'
          });
        } else {
          setUserInfo({
            name: profile.first_name || 'User',
            avatarUrl: profile.avatar_url,
            role: profile.role || 'user'
          });
        }

        setIsAuthorized(true);
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/signup');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (isLoading) {
    return null; // Let the main loader handle this
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f5dc] via-white to-[#FF8A65]/20">
      <div className="flex">
        {/* Fixed Sidebar */}
        <aside className="hidden lg:block fixed left-0 top-0 h-screen w-64 xl:w-72 bg-white border-r border-gray-200 z-30">
          <Sidebar
            role={userInfo.role as 'admin' | 'vet' | 'user'}
            name={userInfo.role === 'vet' ? `Dr. ${userInfo.name}` : userInfo.name}
            avatarUrl={userInfo.avatarUrl || undefined}
          />
        </aside>

        {/* Main content */}
        <main className="flex-1 flex flex-col min-h-screen lg:ml-64 xl:ml-72">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Sidebar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40">
        <div className="backdrop-blur-xl bg-white/95 shadow-lg border-t border-gray-200 px-2 sm:px-4 py-2">
          <div className="flex justify-around">
            {/* Mobile navigation items will be handled by the page component */}
          </div>
        </div>
      </div>
    </div>
  );
}



