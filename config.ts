// Configuração centralizada das credenciais
// SEGURANÇA: Nenhuma chave é hardcoded. O sistema depende estritamente das variáveis de ambiente.

export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Validação de sanidade (Fail Fast)
if (typeof window !== 'undefined') {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.error("CRITICAL CONFIG ERROR: Supabase URL or Anon Key is missing. Check your environment variables.");
    }
}

// O COMPANY_ID não deve ser estático. Ele é dinâmico por usuário logado.
// Mantemos uma constante apenas para fallbacks extremos de tipagem, mas não para lógica de negócio.
export const DEFAULT_FALLBACK_COMPANY = "undefined_company";