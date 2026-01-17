
'use server';

import { createClient } from '@/utils/supabase/server';
import { z } from 'zod';

// Schema de Validação
const AvailabilitySchema = z.object({
  id: z.string().optional(),
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  slug: z.string()
    .min(3, "Slug muito curto")
    .regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
  days_of_week: z.array(z.number()).min(1, "Selecione pelo menos um dia"),
  start_hour: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM inválido"),
  end_hour: z.string().regex(/^\d{2}:\d{2}$/, "Formato HH:MM inválido"),
  slot_duration: z.number().min(15).max(120),
  is_active: z.boolean()
});

export type AvailabilityFormData = z.infer<typeof AvailabilitySchema>;

export async function getMyAvailability() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Busca a primeira regra vinculada ao usuário
  const { data } = await supabase
    .from('availability_rules')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return data;
}

export async function saveAvailabilityRules(formData: AvailabilityFormData) {
  const supabase = await createClient();
  
  // 1. Auth Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Usuário não autenticado." };

  // 2. Get Company ID (Security)
  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();

  if (!profile?.company_id) return { error: "Empresa não encontrada." };

  // 3. Validate Data
  const validation = AvailabilitySchema.safeParse(formData);
  if (!validation.success) {
    return { error: "Dados inválidos.", details: validation.error.flatten() };
  }

  const payload = validation.data;

  // 4. Slug Uniqueness Check
  // Verifica se existe outra regra com mesmo slug mas ID diferente
  let query = supabase.from('availability_rules').select('id').eq('slug', payload.slug);
  if (payload.id) {
      query = query.neq('id', payload.id);
  }
  const { data: conflict } = await query.single();

  if (conflict) {
      return { error: `O link personalziado "${payload.slug}" já está em uso.` };
  }

  // 5. Upsert
  const { error } = await supabase
    .from('availability_rules')
    .upsert({
        id: payload.id || undefined, // undefined faz o Postgres gerar novo UUID
        company_id: profile.company_id,
        user_id: user.id,
        name: payload.name,
        slug: payload.slug,
        days_of_week: payload.days_of_week,
        start_hour: payload.start_hour,
        end_hour: payload.end_hour,
        slot_duration: payload.slot_duration,
        is_active: payload.is_active,
        updated_at: new Date().toISOString()
    });

  if (error) {
      console.error("Save Error:", error);
      return { error: "Erro ao salvar no banco de dados." };
  }

  return { success: true };
}
