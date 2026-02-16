
'use server';

import { createClient } from '@/utils/supabase/server';
import { z } from 'zod';
import { unstable_noStore as noStore } from 'next/cache';

// URL do Backend (Padrão Docker/Local)
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001/api/v1';

const BookingSchema = z.object({
  slug: z.string(),
  date: z.string(),
  time: z.string(),
  name: z.string().min(2, "Nome curto"),
  phone: z.string().min(8, "Telefone inválido"), 
  email: z.string().optional().or(z.literal('')),
  notes: z.string().optional()
});

export type BookingData = z.infer<typeof BookingSchema>;

export async function getPublicRule(slug: string) {
  noStore(); // CRÍTICO: Impede que o Next.js faça cache do tema antigo. Garante WYSIWYG.
  
  const supabase = await createClient();
  
  // 1. Tenta via RPC (Mais rápido)
  const { data: rpcData, error } = await supabase.rpc('get_public_availability_by_slug', { p_slug: slug });
  
  if (rpcData && rpcData.length > 0) {
      return rpcData[0];
  }

  // 2. Fallback: Query direta se a RPC falhar ou não retornar os campos novos (Migration Safety)
  // CORREÇÃO: profile_pic_url em vez de avatar_url
  const { data: tableData } = await supabase
    .from('availability_rules')
    .select(`
        id,
        name,
        slug,
        days_of_week,
        start_hour,
        end_hour,
        slot_duration,
        event_goal,
        event_location_type,
        event_location_details,
        cover_url,
        theme_config, 
        is_active,
        profiles:user_id (name, profile_pic_url, email),
        companies:company_id (name)
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (tableData) {
      // Normaliza para o formato esperado pelo frontend
      return {
          ...tableData,
          rule_id: tableData.id,
          owner_name: tableData.profiles?.name,
          owner_avatar: tableData.profiles?.profile_pic_url, // Mapeamento correto
          company_name: tableData.companies?.name
      };
  }

  return null;
}

export async function getBusySlots(ruleId: string, date: string) {
  noStore(); // Dados de disponibilidade também não devem ter cache
  const supabase = await createClient();
  const { data } = await supabase.rpc('get_busy_slots', { p_rule_id: ruleId, p_date: date });
  return data || [];
}

export async function bookAppointment(formData: BookingData) {
  const supabase = await createClient();
  const validation = BookingSchema.safeParse(formData);

  if (!validation.success) return { error: "Dados inválidos." };

  const { slug, date, time, name, phone, email, notes } = validation.data;
  const cleanPhone = phone.replace(/\D/g, '');

  try {
      // 1. Criar Agendamento no Banco (RPC segura)
      const { data, error } = await supabase.rpc('create_public_appointment', {
          p_slug: slug,
          p_date: date,
          p_time: time,
          p_name: name,
          p_phone: cleanPhone, 
          p_email: email || '',
          p_notes: notes || ''
      });

      if (error) {
          console.error("[Booking] RPC Error:", error);
          return { error: "Erro ao salvar agendamento. Tente outro horário." };
      }

      if (data?.error) return { error: data.error };

      // 2. Disparar Webhook para Backend (Fire and Forget)
      if (data?.id) {
          // Busca o company_id para enviar ao backend correto
          const { data: appData } = await supabase.from('appointments').select('company_id').eq('id', data.id).single();
          
          if (appData) {
               const endpoint = `${API_URL}/appointments/confirm`;
               fetch(endpoint, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                      appointmentId: data.id,
                      companyId: appData.company_id
                  })
               }).catch(e => console.error("[Booking] Falha de conexão com Backend:", e.message));
          }
      }

      return { success: true };

  } catch (err: any) {
      console.error("[Booking] Exception:", err);
      return { error: "Erro inesperado no servidor." };
  }
}
