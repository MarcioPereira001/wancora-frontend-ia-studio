
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

// Helper para logar erros críticos direto no banco (bypassing backend se ele estiver off)
async function logCriticalError(source: string, message: string, meta: any) {
    const supabase = await createClient();
    await supabase.from('system_logs').insert({
        level: 'fatal',
        source: 'frontend',
        message: `[${source}] ${message}`,
        metadata: meta,
        created_at: new Date().toISOString()
    });
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
          await logCriticalError('BookingRPC', error.message, { code: error.code, details: error.details });
          console.error("❌ [Booking] Erro RPC:", error);
          if (error.code === '42725') return { error: `Erro interno de configuração (Função duplicada).` };
          if (error.code === 'P0001') return { error: error.message };
          return { error: `Erro no servidor: ${error.message}` };
      }

      if (data && data.error) {
          await logCriticalError('BookingLogic', data.error, data);
          console.error("❌ [Booking] Erro Lógico RPC:", data.error);
          return { error: `${data.error}` };
      }

      // 2. Disparar Notificação (Webhook Interno para o Backend)
      // Este passo é crucial. Se o backend estiver online, ele envia a mensagem.
      if (data?.id) {
          const { data: appData } = await supabase.from('appointments').select('company_id').eq('id', data.id).single();
          
          if (appData) {
               const targetUrl = `${API_URL}/appointments/confirm`;
               
               // Executa fetch sem esperar o retorno total da UI, mas loga erro se falhar
               fetch(targetUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                      appointmentId: data.id,
                      companyId: appData.company_id
                  })
               }).then(async (res) => {
                   if (!res.ok) {
                       const txt = await res.text();
                       console.error(`❌ [Booking] Backend rejeitou confirmação: ${res.status} - ${txt}`);
                       await logCriticalError('BookingAPI', `Backend Error ${res.status}`, { response: txt });
                   } else {
                       console.log(`✅ [Booking] Confirmação disparada com sucesso.`);
                   }
               }).catch(async (fetchErr) => {
                   console.error("❌ [Booking] Backend inalcançável:", fetchErr);
                   await logCriticalError('BookingAPI', 'Backend Unreachable', { error: fetchErr.message });
               });
          }
      }

      return { success: true };

  } catch (err: any) {
      await logCriticalError('BookingFatal', err.message, { stack: err.stack });
      console.error("❌ [Booking] Exception Fatal:", err);
      return { error: "Erro inesperado ao processar agendamento." };
  }
}
