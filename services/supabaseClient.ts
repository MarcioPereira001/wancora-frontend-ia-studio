import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error("CRITICAL ERROR: Supabase URL or Key is missing in configuration.");
}

// O client deve ser inicializado com as constantes do config.ts que garantem o fallback
// O parâmetro auth.persistSession deve ser true para manter o login no SPA
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
    }
});