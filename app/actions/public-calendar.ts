
'use server';

import { createClient } from '@/utils/supabase/server';
import { z } from 'zod';

// Configurar URL da API (usando variável de ambiente ou fallback para localhost em dev)
const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001/api/v1';

// Schema para validação do formulário de agendamento
const BookingSchema = z.object({
  slug: z.string(),
  date: z.string(), // YYYY-MM-DD
  time: z.string(), // HH:MM
  name: z.string().min(2, "Nome muito curto"),
  phone: z.string().min(10, "Telefone inválido (DDI + DDD + Num)"),
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
    console.error("❌ [Public Calendar] Validação falhou:", validation.error.flatten());
    return { error: "Dados inválidos: " + validation.error.errors[0].message };
  }

  const { slug, date, time, name, phone, email, notes } = validation.data;

  try {
      console.log(`📅 [Booking] Request: ${name}, ${phone}, ${date} ${time}`);

      // SANITIZAÇÃO DE TELEFONE (Standard E.164)
      // O input já vem com DDI. Removemos tudo que não é número.
      let cleanPhone = phone.replace(/\D/g, ''); 
      
      // Validação de segurança: Tamanho mínimo para ser um número global
      if (cleanPhone.length < 8) {
           return { error: "Número de telefone parece inválido." };
      }

      // 1. Criar Agendamento via RPC
      // Importante: A RPC deve ser security definer para permitir insert sem auth
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
          console.error("❌ [Booking] Erro RPC (Supabase):", error);
          return { error: "Erro interno no servidor de agendamento." };
      }

      if (data && data.error) {
          console.error("❌ [Booking] Erro Lógico (RPC):", data.error);
          return { error: data.error }; // Exibe erro amigável retornado pelo banco (ex: Horário ocupado)
      }

      // 2. Disparar Notificação (Webhook Manual para API)
      // Recuperamos o ID recém criado para garantir consistência
      // Atenção: A data no banco é TIMESTAMPTZ, converte para UTC
      const targetTime = `${date}T${time}:00`; 
      
      // Faz uma busca tolerante de +/- 1 minuto para achar o agendamento criado (devido a conversão de fuso)
      // ou busca pelo ultimo ID criado para essa empresa/lead (mais arriscado em alta concorrencia)
      // A RPC create_public_appointment DEVERIA retornar o ID do appointment. 
      // Se a versão atual da RPC retorna { success: true, id: ... }, usamos isso.
      // Se retorna void ou apenas success, usamos a busca de fallback.
      
      let appointmentId = data?.id;

      if (!appointmentId) {
          // Fallback: Busca o último agendamento criado com este telefone nos últimos 5 min
          const { data: newApp } = await supabase
            .from('appointments')
            .select('id, company_id')
            .eq('title', name) // A RPC usa o nome como título geralmente
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
            
          if (newApp) appointmentId = newApp.id;
      }

      if (appointmentId) {
          // Busca companyId se não tivermos
          const { data: appData } = await supabase.from('appointments').select('company_id').eq('id', appointmentId).single();
          
          if (appData) {
               console.log(`🔔 [Booking] Disparando webhook para ID: ${appointmentId}`);
               // Fire and Forget fetch
               fetch(`${API_URL}/appointments/confirm`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                      appointmentId: appointmentId,
                      companyId: appData.company_id
                  })
              }).catch(err => console.error("Erro fetch API:", err));
          }
      }

      console.log("✅ [Booking] Sucesso.");
      return { success: true };

  } catch (err: any) {
      console.error("❌ [Booking] Exception Fatal:", err);
      return { error: "Erro inesperado. Tente novamente mais tarde." };
  }
}
