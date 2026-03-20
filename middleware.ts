
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  // 1. Definição inicial da resposta
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 2. Bypass para rotas estáticas e públicas (Performance)
  if (
      request.nextUrl.pathname.startsWith('/agendar') ||
      request.nextUrl.pathname.startsWith('/_next') ||
      request.nextUrl.pathname.startsWith('/api') ||
      request.nextUrl.pathname.includes('.') // Arquivos
  ) {
       return response;
  }

  try {
      // 3. Validação de Variáveis de Ambiente
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        console.warn('⚠️ Middleware: Supabase credentials missing. Passing request without auth check.');
        return response;
      }

      // 4. Criação do Cliente Supabase (Sintaxe @supabase/ssr v0.5+)
      const supabase = createServerClient(
        supabaseUrl,
        supabaseKey,
        {
          cookieOptions: {
            sameSite: 'none',
            secure: true,
          },
          cookies: {
            getAll() {
              return request.cookies.getAll()
            },
            setAll(cookiesToSet) {
              cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
              response = NextResponse.next({
                request: {
                  headers: request.headers,
                },
              })
              cookiesToSet.forEach(({ name, value, options }) =>
                response.cookies.set(name, value, options)
              )
            },
          },
        }
      )

      // 5. Gestão de Sessão (GetUser é mais seguro que GetSession em middleware)
      const { data: { user }, error } = await supabase.auth.getUser()

      // 6. Regras de Proteção de Rotas
      
      // Admin Protection
      if (request.nextUrl.pathname.startsWith('/admin')) {
          if (!user) {
             return NextResponse.redirect(new URL('/auth/login-admin', request.url))
          }
      }

      // App Protection (Dashboard, CRM, etc)
      if (!user && (
        request.nextUrl.pathname.startsWith('/dashboard') || 
        request.nextUrl.pathname.startsWith('/crm') || 
        request.nextUrl.pathname.startsWith('/chat') ||
        request.nextUrl.pathname.startsWith('/agents') ||
        request.nextUrl.pathname.startsWith('/settings') ||
        request.nextUrl.pathname.startsWith('/calendar') ||
        request.nextUrl.pathname.startsWith('/connections') ||
        request.nextUrl.pathname.startsWith('/campaigns')
      )) {
        // Exceção: O calendário PÚBLICO (/agendar/...) já foi tratado no topo
        if (!request.nextUrl.pathname.startsWith('/calendar/settings')) {
           return NextResponse.redirect(new URL('/auth/login', request.url))
        }
      }

      // Redirecionamento de Auth (Se já logado, não acessa login)
      if (user) {
          if (request.nextUrl.pathname === '/auth/login' || request.nextUrl.pathname === '/auth/register') {
              return NextResponse.redirect(new URL('/dashboard', request.url))
          }
          if (request.nextUrl.pathname === '/auth/login-admin') {
              return NextResponse.redirect(new URL('/admin/dashboard', request.url))
          }
      }

      return response

  } catch (e) {
      // 7. Fail Closed: Se o middleware crashar (ex: erro de rede, token malformado),
      // redireciona para o login para garantir a segurança.
      console.error('🔥 Middleware Critical Error:', e);
      
      // Se for rota pública, permite. Se não, bloqueia.
      if (
          request.nextUrl.pathname.startsWith('/dashboard') || 
          request.nextUrl.pathname.startsWith('/crm') || 
          request.nextUrl.pathname.startsWith('/chat') ||
          request.nextUrl.pathname.startsWith('/settings')
      ) {
          return NextResponse.redirect(new URL('/auth/login', request.url));
      }
      
      return response;
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
