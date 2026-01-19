
'use server';

import { createClient } from '@/utils/supabase/server';
import { z } from 'zod';

// Schema para validação do formulário de agendamento
const BookingSchema = z.object({
  slug: z.string(),
  date: z.string(), // YYYY-MM-DD
  time: z.string(), // HH:MM
  name: z.string().min(3, "Nome muito curto"),
  phone: z.string().min(10, "Telefone inválido (com DDD)"),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().optional()
});

export type BookingData = z.infer<typeof BookingSchema>;

export async function getPublicRule(slug: string) {
  const supabase = await createClient();
  
  // Chama a RPC criada no passo SQL
  const { data, error } = await supabase.rpc('get_public_availability_by_slug', {
    p_slug: slug
  });

  if (error || !data || data.length === 0) {
    console.error("Erro ao buscar regra pública:", error);
    return null;
  }

  return data[0]; // Retorna a primeira linha
}

export async function getBusySlots(ruleId: string, date: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase.rpc('get_busy_slots', {
    p_rule_id: ruleId,
    p_date: date
  });

  if (error) return [];
  return data;
}

export async function bookAppointment(formData: BookingData) {
  const supabase = await createClient();
  const validation = BookingSchema.safeParse(formData);

  if (!validation.success) {
    console.error("❌ [Public Calendar] Erro de validação Zod:", validation.error);
    return { error: "Dados inválidos." };
  }

  const { slug, date, time, name, phone, email, notes } = validation.data;

  try {
      console.log(`📅 [Public Calendar] Tentando agendar para ${name} em ${date} às ${time} (Slug: ${slug})`);

      // Chama a função segura no banco (Security Definer)
      // Isso evita erros de RLS para usuários anônimos
      const { data, error } = await supabase.rpc('create_public_appointment', {
          p_slug: slug,
          p_date: date,
          p_time: time,
          p_name: name,
          p_phone: phone,
          p_email: email || '',
          p_notes: notes || ''
      });

      if (error) {
          console.error("❌ [Public Calendar] Erro RPC Supabase:", error);
          throw new Error(error.message);
      }

      // Verifica retorno lógico da função SQL
      if (data && data.error) {
          console.error("❌ [Public Calendar] Erro Lógico SQL:", data.error);
          throw new Error(data.error);
      }

      console.log("✅ [Public Calendar] Agendamento criado com sucesso via RPC.");
      return { success: true };

  } catch (err: any) {
      console.error("❌ [Public Calendar] Exceção Crítica:", err);
      return { error: "Erro ao processar agendamento. Tente novamente." };
  }
}
