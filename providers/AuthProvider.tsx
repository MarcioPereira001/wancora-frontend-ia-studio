
'use client';

import React, { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { useRouter, usePathname } from 'next/navigation';
import { useToast } from '@/hooks/useToast';
import { Loader2 } from 'lucide-react';

interface AuthProviderProps {
  children?: React.ReactNode;
}

export default function AuthProvider({ children }: AuthProviderProps) {
  const { setUser, setLoading, user: currentUser, hasHydrated } = useAuthStore();
  const supabase = createClient();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    // Só começa a checar auth DEPOIS que o Zustand carregou o localStorage (Fim do Spinner Infinito)
    if (!hasHydrated) return;

    const checkUser = async () => {
      // FAILSAFE: Timeout de 4 segundos. 
      // Se o Supabase não responder (comum no Opera GX ou net lenta), libera a UI ou vai pro login.
      const timeoutId = setTimeout(() => {
          if (mounted) {
              console.warn("⚠️ Auth Check Timeout - Forçando liberação da UI");
              setLoading(false);
              // Se não estiver em rota pública e não tiver usuário, manda pro login
              if (!currentUser && !pathname?.startsWith('/auth') && pathname !== '/') {
                   router.replace('/auth/login');
              }
          }
      }, 4000);

      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) throw sessionError;

        if (!session) {
          // Se não tem sessão e está em rota protegida -> Login
          if (!pathname?.startsWith('/auth') && pathname !== '/') {
            router.replace('/auth/login');
          }
          if (mounted) {
            setUser(null);
          }
          return;
        }

        // Se já temos o usuário e o ID bate, não bloqueia a tela, apenas atualiza em background (Performance)
        if (currentUser?.id === session.user.id) {
            // Background Refresh
            fetchProfile(session.user.id);
        } else {
            // First Load (Bloqueante)
            await fetchProfile(session.user.id);
        }

      } catch (error) {
        console.error("Auth check failed:", error);
        if ((error as any)?.message?.includes('token')) {
            await supabase.auth.signOut();
            router.push('/auth/login');
        }
      } finally {
        clearTimeout(timeoutId); // Limpa o timeout de segurança se respondeu a tempo
        if (mounted) setLoading(false);
      }
    };

    const fetchProfile = async (userId: string) => {
        let profile = null;
        let attempts = 0;
        
        // Tenta buscar perfil 3 vezes (Retry Logic para instabilidade)
        while (!profile && attempts < 3) {
            const { data, error } = await supabase
                .from('profiles')
                .select('*, companies(name, plan, status)')
                .eq('id', userId)
                .single();
            
            if (!error && data) {
                profile = data;
            } else {
                await new Promise(r => setTimeout(r, 1000));
                attempts++;
            }
        }

        if (mounted && profile) {
             setUser({
              id: userId,
              email: profile.email,
              name: profile.name || 'Usuário',
              role: profile.role || 'user',
              company_id: profile.company_id,
              avatar_url: profile.profile_pic_url
            });
        }
    }

    checkUser();

    // Listener de Mudança de Auth (Login/Logout em outras abas)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT') {
            setUser(null);
            router.push('/auth/login');
        } else if (event === 'SIGNED_IN' && session) {
             if (!useAuthStore.getState().user) {
                checkUser();
            }
        }
    });

    return () => { 
        mounted = false;
        subscription.unsubscribe();
    };
  }, [pathname, router, setUser, setLoading, hasHydrated]);

  // Enquanto o Zustand não hidrata do disco, mostra um loader leve para não piscar tela branca
  if (!hasHydrated) {
      return (
          <div className="h-screen w-full flex items-center justify-center bg-zinc-950">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
      )
  }

  return <>{children}</>;
}
