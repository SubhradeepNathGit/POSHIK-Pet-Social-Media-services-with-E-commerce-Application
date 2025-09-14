'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function DashboardRedirect() {
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkUserRole = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          router.push('/signup');
          return;
        }

        // Check user role and redirect accordingly
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError || !profile) {
          router.push('/signup');
          return;
        }

        // Check if user is a vet
        if (profile.role === 'vet') {
          const { data: vet } = await supabase
            .from('veterinarian')
            .select('id')
            .eq('id', user.id)
            .maybeSingle();
          
          if (vet) {
            router.push('/modules/vet');
            return;
          }
        }

        // Redirect based on role
        switch (profile.role) {
          case 'admin':
            router.push('/modules/admin');
            break;
          case 'user':
            router.push('/modules/user');
            break;
          case 'vet':
            router.push('/modules/vet');
            break;
          default:
            router.push('/modules/user');
        }
      } catch (error) {
        console.error('Role check error:', error);
        router.push('/signup');
      } finally {
        setIsLoading(false);
      }
    };

    checkUserRole();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FF8A65] to-[#f5f5dc]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8A65] mx-auto mb-4"></div>
          <p className="text-gray-600">Redirecting to your dashboard...</p>
        </div>
      </div>
    );
  }

  return null;
}









