'use client';

import React, { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/useToast';

interface AuthProviderProps {
  children?: React.ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const { setUser, setLoading, user: currentUser } = useAuthStore();
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();
  const { addToast } = useToast();

  useEffect(() => {
    let mounted = true;

    const checkUser = async () => {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;

        if (!session) {
          if (!pathname?.startsWith('/auth') && pathname !== '/') {
            router.replace('/auth/login');
          }
          if (mounted) {
            setUser(null);
            setLoading(false);
          }
          return;
        }

        // Se já temos o usuário carregado e o ID bate, não fazemos fetch de novo (Performance)
        if (currentUser?.id === session.user.id) {
            if (mounted) setLoading(false);
            return;
        }

        // Busca dados do perfil com retry simples para evitar race condition no cadastro
        let profile = null;
        let attempts = 0;
        
        while (!profile && attempts < 3) {
            const { data, error } = await supabase
                .from('profiles')
                .select('*, companies(name, plan, status)')
                .eq('id', session.user.id)
                .single();
            
            if (!error && data) {
                profile = data;
            } else if (error.code === 'PGRST116') {
                // Perfil não encontrado, espera um pouco (pode estar sendo criado)
                await new Promise(r => setTimeout(r, 1000));
                attempts++;
            } else {
                console.error("Erro ao buscar perfil:", error);
                break;
            }
        }

        if (mounted) {
            setUser({
              id: session.user.id,
              email: session.user.email!,
              name: profile?.name || session.user.user_metadata.full_name || 'Usuário',
              role: profile?.role || 'user',
              company_id: profile?.company_id,
              avatar_url: profile?.profile_pic_url
            });
        }

      } catch (error) {
        console.error("Auth check failed:", error);
        // Em caso de erro crítico de token inválido, faz logout
        if ((error as any)?.message?.includes('token')) {
            await supabase.auth.signOut();
            router.push('/auth/login');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    checkUser();

    // Listener para eventos de Auth (Logout em outra aba, etc)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
            setUser(null);
            router.push('/auth/login');
        } else if (event === 'SIGNED_IN' && session) {
            // Se o usuário logou, mas o estado global está vazio, recarrega
            if (!useAuthStore.getState().user) {
                checkUser();
            }
        }
    });

    return () => { 
        mounted = false;
        subscription.unsubscribe();
    };
  }, [pathname, router, setUser, setLoading, supabase]);

  return <>{children}</>;
}