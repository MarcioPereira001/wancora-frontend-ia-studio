'use client';

import React, { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setLoading } = useAuthStore();
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session && !pathname.startsWith('/auth')) {
        router.push('/auth/login');
        setLoading(false);
        return;
      }

      if (session) {
        // Fetch additional user data if needed from a 'users' table
        // For MVP, using metadata or mocking structure
        setUser({
          id: session.user.id,
          email: session.user.email!,
          name: session.user.user_metadata.name || 'Usuário',
          role: session.user.user_metadata.role || 'admin',
          company_id: session.user.user_metadata.company_id || 'default_company'
        });
      }
      setLoading(false);
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!session && !pathname.startsWith('/auth')) {
            router.push('/auth/login');
        }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router, setUser, setLoading, supabase.auth]);

  return <>{children}</>;
}
