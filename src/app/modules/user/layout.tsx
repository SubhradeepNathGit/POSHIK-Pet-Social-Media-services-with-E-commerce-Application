'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/sidebar';

interface UserLayoutProps {
  children: React.ReactNode;
}

export default function UserLayout({ children }: UserLayoutProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [userInfo, setUserInfo] = useState<{
    name: string;
    avatarUrl: string | null;
  }>({ name: '', avatarUrl: null });
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          router.push('/signup');
          return;
        }

        // Check if user is a regular user (not admin or vet)
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('first_name, role, avatar_url')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError || !profile) {
          router.push('/signup');
          return;
        }

        // Redirect admin and vet users to their respective dashboards
        if (profile.role === 'admin') {
          router.push('/modules/admin');
          return;
        }
        
        if (profile.role === 'vet') {
          router.push('/modules/vet');
          return;
        }

        setUserInfo({
          name: profile.first_name || 'User',
          avatarUrl: profile.avatar_url
        });
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
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FF8A65] to-[#f5f5dc]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8A65] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f5dc] via-white to-[#FF8A65]/20">
      {/* Top Banner */}
      <div className="relative w-full h-48 sm:h-64 md:h-72 lg:h-80">
        <div className="absolute inset-0 bg-gradient-to-r from-[#FF8A65] to-[#f5f5dc] flex flex-col justify-center items-center text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-white">
            User Dashboard
          </h1>
          <p className="text-sm md:text-base text-gray-200 mt-2">
            Home / User
          </p>
        </div>
      </div>

      <div className="min-h-screen bg-transparent flex">
        {/* Sidebar */}
        <aside className="hidden lg:block w-64 xl:w-72 shrink-0 bg-white h-screen sticky top-0">
          <Sidebar
            role="user"
            name={userInfo.name}
            avatarUrl={userInfo.avatarUrl || undefined}
          />
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="container mx-auto px-3 sm:px-4 md:px-6 max-w-7xl py-6">
            <div className="bg-transparent rounded-2xl p-4 sm:p-6 md:p-8">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}







