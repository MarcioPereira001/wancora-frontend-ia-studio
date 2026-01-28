
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Validação defensiva para garantir que o cliente Supabase receba chaves válidas
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('CRITICAL: Supabase credentials missing in middleware config');
    return response;
  }

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

  // Tentar obter sessão.
  try {
      const { data: { session } } = await supabase.auth.getSession()

      // LISTA DE ROTAS PROTEGIDAS (ATUALIZADA)
      // Adicionado: /calendar, /connections, /campaigns
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
        // Exceção: O calendário PÚBLICO (/agendar/...) não deve redirecionar para login
        if (request.nextUrl.pathname.startsWith('/calendar/settings')) {
             return NextResponse.redirect(new URL('/auth/login', request.url))
        }
        // Se for a rota pública de agendamento (/agendar), deixa passar
        if (request.nextUrl.pathname.startsWith('/agendar')) {
             return response;
        }

        return NextResponse.redirect(new URL('/auth/login', request.url))
      }

      // Auth routes (redirect if logged in)
      if (session && request.nextUrl.pathname.startsWith('/auth')) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
  } catch (error) {
      console.error("Middleware Auth Error:", error);
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
