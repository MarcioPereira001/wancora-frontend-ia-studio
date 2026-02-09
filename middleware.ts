
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 1. ROTAS PÚBLICAS E ESTÁTICAS (BYPASS TOTAL DE AUTH)
  // Ignora assets, api, e rotas públicas para performance
  if (
      request.nextUrl.pathname.startsWith('/agendar') ||
      request.nextUrl.pathname.startsWith('/_next') ||
      request.nextUrl.pathname.startsWith('/api') ||
      request.nextUrl.pathname.includes('.') // Arquivos com extensão (imagens, etc)
  ) {
       return response;
  }

  // 2. VALIDAÇÃO DE CREDENCIAIS (FAIL SAFE)
  // Se não tiver credenciais, loga o erro mas permite o request passar (evita 500, mas o app vai falhar na ponta)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('CRITICAL: Supabase credentials missing in middleware. Check environment variables.');
    return response;
  }

  // Bloco de Segurança Global: Qualquer erro aqui dentro não deve derrubar o site (500)
  try {
      const supabase = createServerClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
          cookies: {
            get(name: string) {
              return request.cookies.get(name)?.value
            },
            set(name: string, value: string, options: CookieOptions) {
              request.cookies.set({
                name,
                value,
                ...options,
              })
              response = NextResponse.next({
                request: {
                  headers: request.headers,
                },
              })
              response.cookies.set({
                name,
                value,
                ...options,
              })
            },
            remove(name: string, options: CookieOptions) {
              request.cookies.set({
                name,
                value: '',
                ...options,
              })
              response = NextResponse.next({
                request: {
                  headers: request.headers,
                },
              })
              response.cookies.set({
                name,
                value: '',
                ...options,
              })
            },
          },
        }
      )

      // 3. VERIFICAÇÃO DE SESSÃO
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error) {
          // Se o Supabase retornar erro (ex: token malformado), ignora e trata como deslogado
          console.error("Middleware Session Error:", error.message);
      }

      // 4. REGRAS DE ROTEAMENTO (PROTEÇÃO)

      // Admin Protection
      if (request.nextUrl.pathname.startsWith('/admin')) {
          if (!session) {
             return NextResponse.redirect(new URL('/auth/login-admin', request.url))
          }
          // Verificação de Role idealmente seria aqui, mas requer query no banco.
          // Deixamos o layout.tsx fazer a checagem final de segurança (Super Admin).
      }

      // App Protection
      if (!session && (
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
        if (request.nextUrl.pathname.startsWith('/calendar/settings')) {
             return NextResponse.redirect(new URL('/auth/login', request.url))
        }
        return NextResponse.redirect(new URL('/auth/login', request.url))
      }

      // Auth Redirection (Se já logado, não acessa login)
      if (session) {
          if (request.nextUrl.pathname === '/auth/login' || request.nextUrl.pathname === '/auth/register') {
              return NextResponse.redirect(new URL('/dashboard', request.url))
          }
          if (request.nextUrl.pathname === '/auth/login-admin') {
              return NextResponse.redirect(new URL('/admin/dashboard', request.url))
          }
      }

  } catch (error) {
      // CATCH-ALL: Impede a Tela Branca da Morte (500)
      console.error("🔥 CRITICAL MIDDLEWARE ERROR:", error);
      // Em caso de erro crítico no middleware, permitimos o tráfego. 
      // O layout ou a página vão lidar com a falta de dados/auth.
      return response;
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}