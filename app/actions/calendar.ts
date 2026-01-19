
'use server';

import { createClient } from '@/utils/supabase/server';
import { z } from 'zod';

const NotificationTriggerSchema = z.object({
    id: z.string(),
    type: z.enum(['on_booking', 'before_event']),
    time_amount: z.any().optional(), // Aceita string ou number
    time_unit: z.enum(['minutes', 'hours', 'days']).optional(),
    template: z.string(),
    active: z.boolean()
});

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
  is_active: z.boolean(),
  notification_config: z.object({
      admin_phone: z.string().optional().nullable(),
      admin_notifications: z.array(NotificationTriggerSchema).optional(),
      lead_notifications: z.array(NotificationTriggerSchema).optional()
  }).optional()
});

export type AvailabilityFormData = z.infer<typeof AvailabilitySchema>;

export async function getMyAvailability() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from('availability_rules')
    .select('*')
    .eq('user_id', user.id)
    .single();

  return data;
}

export async function saveAvailabilityRules(formData: AvailabilityFormData) {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Usuário não autenticado." };

  const { data: profile } = await supabase
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();

  if (!profile?.company_id) return { error: "Empresa não encontrada." };

  const validation = AvailabilitySchema.safeParse(formData);
  if (!validation.success) {
    return { error: "Dados inválidos.", details: validation.error.flatten() };
  }

  const payload = validation.data;

  let query = supabase.from('availability_rules').select('id').eq('slug', payload.slug);
  if (payload.id) {
      query = query.neq('id', payload.id);
  }
  const { data: conflict } = await query.single();

  if (conflict) {
      return { error: `O link personalziado "${payload.slug}" já está em uso.` };
  }

  // Prepara objeto para upsert, garantindo que notification_config vá junto
  const upsertData: any = {
      id: payload.id || undefined,
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
  };

  if (payload.notification_config) {
      upsertData.notification_config = payload.notification_config;
  }

  const { error } = await supabase
    .from('availability_rules')
    .upsert(upsertData);

  if (error) {
      console.error("Save Error:", error);
      return { error: "Erro ao salvar no banco de dados." };
  }

  return { success: true };
}
