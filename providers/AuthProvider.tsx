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
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          if (!pathname.startsWith('/auth') && pathname !== '/') {
            router.push('/auth/login');
          }
          setLoading(false);
          return;
        }

        // Busca dados reais do perfil para obter o company_id
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        if (error && !profile) {
            console.error("Erro ao buscar perfil:", error);
            // Fallback para metadados ou estado de erro, se necessário
        }

        setUser({
          id: session.user.id,
          email: session.user.email!,
          name: profile?.name || session.user.user_metadata.name || 'Usuário',
          role: profile?.role || 'admin',
          company_id: profile?.company_id || session.user.user_metadata.company_id
        });

      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_OUT') {
            setUser(null);
            router.push('/auth/login');
        } else if (event === 'SIGNED_IN' && session) {
            checkUser(); // Re-fetch profile on sign-in
        }
    });

    return () => subscription.unsubscribe();
  }, [pathname, router, setUser, setLoading, supabase]);

  return <>{children}</>;
}