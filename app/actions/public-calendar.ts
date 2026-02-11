'use server';

import { createClient } from '@/utils/supabase/server';
import { z } from 'zod';

// Configurar URL da API
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001/api/v1';

// Schema para validação do formulário de agendamento
const BookingSchema = z.object({
  slug: z.string(),
  date: z.string(), // YYYY-MM-DD
  time: z.string(), // HH:MM
  name: z.string().min(2, "Nome muito curto"),
  phone: z.string().min(8, "Telefone inválido"), 
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().optional()
});

export type BookingData = z.infer<typeof BookingSchema>;

export async function getPublicRule(slug: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase.rpc('get_public_availability_by_slug', {
    p_slug: slug
  });

  if (error || !data || data.length === 0) {
    console.error("Erro ao buscar regra pública:", error);
    return null;
  }

  return data[0]; 
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
    return { error: "Dados inválidos: " + validation.error.issues[0].message };
  }

  const { slug, date, time, name, phone, email, notes } = validation.data;
  let debugInfo: any = {};

  try {
      console.log(`📅 [Booking] Request: ${name}, ${phone}, ${date} ${time}`);

      // SANITIZAÇÃO DE TELEFONE
      let cleanPhone = phone.replace(/\D/g, ''); 
      if (cleanPhone.length < 8) return { error: "Número de telefone incompleto." };

      // 1. Criar Agendamento via RPC
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
          console.error("❌ [Booking] Erro RPC:", error);
          if (error.code === '42725') return { error: `Erro interno de configuração (Função duplicada).` };
          if (error.code === 'P0001') return { error: error.message };
          return { error: `Erro no servidor: ${error.message}` };
      }

      if (data && data.error) {
          console.error("❌ [Booking] Erro Lógico RPC:", data.error);
          return { error: `${data.error}` };
      }

      // 2. Disparar Notificação (Webhook Interno)
      // AWAIT EXPLÍCITO para capturar o log do backend
      if (data?.id) {
          const { data: appData } = await supabase.from('appointments').select('company_id').eq('id', data.id).single();
          
          if (appData) {
               try {
                   console.log(`🔔 [Booking] Chamando backend...`);
                   const response = await fetch(`${API_URL}/appointments/confirm`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ 
                          appointmentId: data.id,
                          companyId: appData.company_id
                      })
                   });
                   
                   const responseData = await response.json();
                   debugInfo = responseData.debug || { message: "Sem debug do backend" };
                   
                   if (!response.ok) {
                       console.error(`❌ [Booking] Falha Backend:`, responseData);
                       debugInfo.error = responseData.error;
                   } else {
                       console.log(`✅ [Booking] Backend Sucesso:`, debugInfo);
                   }

               } catch (fetchErr: any) {
                   console.error("❌ [Booking] Erro fetch API:", fetchErr);
                   debugInfo = { error: fetchErr.message, type: 'FETCH_ERROR' };
               }
          }
      }

      // Retorna sucesso E o debug para o cliente
      return { success: true, debug: debugInfo };

  } catch (err: any) {
      console.error("❌ [Booking] Exception Fatal:", err);
      return { error: "Erro inesperado.", debug: { exception: err.message } };
  }
}