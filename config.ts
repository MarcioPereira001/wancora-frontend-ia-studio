// Configuração centralizada das credenciais
// BLINDAGEM: Garantindo que as chaves nunca sejam undefined ou string vazia
// As credenciais hardcoded abaixo são o FALLBACK DE SEGURANÇA para garantir conexão "Real".

const ENV_BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;
const ENV_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ENV_SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Use o valor do env APENAS se ele existir e não for vazio, caso contrário use o hardcoded (REAL)
export const BACKEND_URL = (ENV_BACKEND && ENV_BACKEND.length > 0) 
    ? ENV_BACKEND 
    : "https://wancora-backend.onrender.com/api/v1";

export const SUPABASE_URL = (ENV_SUPABASE_URL && ENV_SUPABASE_URL.length > 0)
    ? ENV_SUPABASE_URL
    : "https://idqziziytpsuwxajroic.supabase.co";

export const SUPABASE_ANON_KEY = (ENV_SUPABASE_KEY && ENV_SUPABASE_KEY.length > 0)
    ? ENV_SUPABASE_KEY
    : "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlkcXppeml5dHBzdXd4YWpyb2ljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc4NDAyMDAsImV4cCI6MjA4MzQxNjIwMH0.h2BdykG_cesAqbIIS4D4bOCC5wktC8TVBg9uY7CyAQY";

export const COMPANY_ID = "default_company";
