'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { motion } from 'framer-motion';

type KycStatus = 'pending' | 'rejected' | 'approved';

export default function KycPendingPage() {
  const [status, setStatus] = useState<KycStatus>('pending');
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkKycStatus = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        
        if (authError || !user) {
          router.push('/signup');
          return;
        }

        const { data: vet, error: vetError } = await supabase
          .from('veterinarian')
          .select('kyc_status')
          .eq('id', user.id)
          .maybeSingle();

        if (vetError || !vet) {
          router.push('/modules/user');
          return;
        }

        const kycStatus = vet.kyc_status as KycStatus;
        setStatus(kycStatus);

        // If approved, redirect to vet dashboard
        if (kycStatus === 'approved') {
          router.push('/modules/vet');
          return;
        }
      } catch (error) {
        console.error('KYC status check error:', error);
        router.push('/signup');
      } finally {
        setIsLoading(false);
      }
    };

    checkKycStatus();
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FF8A65] to-[#f5f5dc]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF8A65] mx-auto mb-4"></div>
          <p className="text-gray-600">Checking your status...</p>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-gradient-to-br from-[#f5f5dc] via-white to-[#FF8A65]/20 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className={`max-w-md w-full ${config.bgColor} ${config.borderColor} border-2 rounded-2xl p-8 shadow-xl`}
      >
        <div className="text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="text-6xl mb-6"
          >
            {config.icon}
          </motion.div>
          
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`text-2xl font-bold mb-3 ${config.color}`}
          >
            {config.title}
          </motion.h2>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-gray-700 mb-6 leading-relaxed"
          >
            {config.description}
          </motion.p>
          
          {status === 'pending' && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-center gap-2 text-sm text-gray-600">
                <div className="animate-spin h-4 w-4 border-2 border-amber-500 border-t-transparent rounded-full"></div>
                Processing your application...
              </div>
              <p className="text-xs text-gray-500">
                This usually takes 1-2 business days
              </p>
            </motion.div>
          )}
          
          {status === 'rejected' && (
            <motion.button
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-red-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-red-700 transition-colors"
            >
              Contact Support
            </motion.button>
          )}
        </div>
      </motion.div>
    </div>
  );
}









