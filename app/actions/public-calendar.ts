
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

      // SANITIZAÇÃO DE TELEFONE (Standard E.164-ish for BR)
      let cleanPhone = phone.replace(/\D/g, ''); // Remove tudo que não é dígito
      
      // Se tiver 10 ou 11 dígitos, assume que é BR sem DDI e adiciona 55
      if (cleanPhone.length >= 10 && cleanPhone.length <= 11) {
          cleanPhone = '55' + cleanPhone;
      }
      // Se não começar com 55 e for maior que 11, talvez já tenha outro DDI, mantém. 
      // Mas para BR, garantimos o 55.

      // 1. Criar Agendamento via RPC
      const { data, error } = await supabase.rpc('create_public_appointment', {
          p_slug: slug,
          p_date: date,
          p_time: time,
          p_name: name,
          p_phone: cleanPhone, // Envia o número limpo e com DDI
          p_email: email || '',
          p_notes: notes || ''
      });

      if (error) {
          console.error("❌ [Public Calendar] Erro RPC Supabase:", error);
          throw new Error(error.message);
      }

      if (data && data.error) {
          console.error("❌ [Public Calendar] Erro Lógico SQL:", data.error);
          throw new Error(data.error);
      }

      // 2. Disparar Notificação (Webhook Manual para API)
      const { data: newApp } = await supabase
          .from('appointments')
          .select('id, company_id')
          .eq('start_time', `${date}T${time}:00+00:00`) // Assumindo UTC do server action anterior
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

      if (newApp) {
          console.log(`🔔 [Public Calendar] Disparando notificação para ID: ${newApp.id}`);
          // Dispara fetch para a API do backend (Fire and Forget)
          fetch(`${API_URL}/appointments/confirm`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  appointmentId: newApp.id,
                  companyId: newApp.company_id
              })
          }).catch(err => console.error("Erro fetch API:", err));
      }

      console.log("✅ [Public Calendar] Agendamento criado com sucesso.");
      return { success: true };

  } catch (err: any) {
      console.error("❌ [Public Calendar] Exceção Crítica:", err);
      return { error: "Erro ao processar agendamento. Tente novamente." };
  }
}
