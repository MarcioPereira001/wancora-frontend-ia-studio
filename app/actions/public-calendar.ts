
'use server';

import { createClient } from '@/utils/supabase/server';
import { z } from 'zod';

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
  const supabase = await createClient();
  
  // RPC atualizada ou Select direto para garantir que novos campos venham
  // Fallback para select direto caso a RPC antiga não retorne os campos novos
  const { data: rpcData, error } = await supabase.rpc('get_public_availability_by_slug', { p_slug: slug });
  
  if (rpcData && rpcData.length > 0) {
      // Se a RPC já retorna tudo (SELECT *), ótimo.
      return rpcData[0];
  }

  // Fallback: Busca manual se a RPC falhar ou estiver desatualizada no banco
  const { data: tableData } = await supabase
    .from('availability_rules')
    .select(`
        *,
        profiles:user_id (name, avatar_url, email),
        companies:company_id (name)
    `)
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (tableData) {
      return {
          ...tableData,
          owner_name: tableData.profiles?.name,
          owner_avatar: tableData.profiles?.avatar_url,
          company_name: tableData.companies?.name,
          rule_id: tableData.id // Compatibilidade com frontend
      };
  }

  return null;
}

export async function getBusySlots(ruleId: string, date: string) {
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
          const { data: appData } = await supabase.from('appointments').select('company_id').eq('id', data.id).single();
          
          if (appData) {
               const endpoint = `${API_URL}/appointments/confirm`;
               // Fetch sem await
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
