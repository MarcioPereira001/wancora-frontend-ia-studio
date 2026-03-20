import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/config';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Se "next" estiver presente, redireciona para lá, senão vai para o dashboard
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    // Cria uma resposta de redirecionamento onde os cookies de sessão serão anexados
    const response = NextResponse.redirect(`${origin}${next}`);

    const supabase = createServerClient(
      SUPABASE_URL || '',
      SUPABASE_ANON_KEY || '',
      {
        cookieOptions: {
          sameSite: 'none',
          secure: true,
        },
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set({
                name,
                value,
                ...options,
              });
            });
          },
        },
      }
    );
    
    // A troca do código por sessão gera os cookies de acesso e atualização
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error) {
      // Retorna a resposta que contém os cookies definidos
      return response;
    }
  }

  // Se houver erro ou não houver código, redireciona para login com erro
  return NextResponse.redirect(`${origin}/auth/login?error=auth_code_error`);
}