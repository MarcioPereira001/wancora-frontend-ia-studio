
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
    return { error: "Dados inválidos." };
  }

  const { slug, date, time, name, phone, email, notes } = validation.data;

  // 1. Recuperar dados da regra novamente para segurança (evitar injeção de IDs)
  const rule = await getPublicRule(slug);
  if (!rule) return { error: "Agenda não encontrada." };

  // 2. Identificar ou Criar Lead (Anti-Ghost)
  const cleanPhone = phone.replace(/\D/g, '');
  let leadId = null;

  // Tenta encontrar lead existente
  const { data: existingLead } = await supabase
    .from('leads')
    .select('id')
    .eq('company_id', rule.company_id)
    .ilike('phone', `%${cleanPhone}%`)
    .limit(1)
    .maybeSingle();

  if (existingLead) {
    leadId = existingLead.id;
  } else {
    // Cria novo lead
    // Precisamos do ID de um estágio padrão. Usamos o primeiro do pipeline default.
    const { data: defaultPipe } = await supabase
        .from('pipelines')
        .select('id')
        .eq('company_id', rule.company_id)
        .eq('is_default', true)
        .limit(1)
        .maybeSingle();
    
    let stageId = null;
    if (defaultPipe) {
        const { data: stage } = await supabase
            .from('pipeline_stages')
            .select('id')
            .eq('pipeline_id', defaultPipe.id)
            .eq('position', 0)
            .limit(1)
            .maybeSingle();
        stageId = stage?.id;
    }

    // Fallback: busca qualquer stage
    if (!stageId) {
        const { data: anyStage } = await supabase.from('pipeline_stages').select('id').eq('company_id', rule.company_id).limit(1).maybeSingle();
        stageId = anyStage?.id;
    }

    if (!stageId) return { error: "Erro interno: Pipeline não configurado na empresa." };

    const { data: newLead, error: createError } = await supabase.from('leads').insert({
        company_id: rule.company_id,
        name: name,
        phone: cleanPhone,
        email: email || null,
        pipeline_stage_id: stageId,
        status: 'new',
        temperature: 'warm',
        notes: `Agendado via Link Público: ${notes || ''}`
    }).select().single();

    if (createError) return { error: "Erro ao criar cadastro." };
    leadId = newLead.id;
  }

  // 3. Criar Agendamento
  const startTimeISO = `${date}T${time}:00`;
  // Calcula fim baseado na duração da regra
  const [h, m] = time.split(':').map(Number);
  const endDate = new Date(date);
  endDate.setHours(h);
  endDate.setMinutes(m + rule.slot_duration);
  const endTimeISO = endDate.toISOString();

  // Busca ID do usuário dono da regra para atribuir o agendamento
  // (A RPC get_public_rule retorna owner_name, mas precisamos do user_id real. 
  // Na verdade a RPC get_public_availability_by_slug retorna company_id e rule_id. 
  // Precisamos consultar a availability_rules interna para pegar o user_id correto se for RPC.
  // Mas como estamos no server action com supabase service role (ou definer), podemos consultar tables.
  // Vamos simplificar: A RPC get_public_availability_by_slug NÃO retorna user_id por segurança no SELECT do frontend.
  // Vamos fazer uma query direta aqui no server action que é seguro.)
  
  const { data: ruleInternal } = await supabase
    .from('availability_rules')
    .select('user_id')
    .eq('id', rule.rule_id)
    .single();

  if (!ruleInternal?.user_id) return { error: "Erro de configuração da agenda." };

  const { error: appError } = await supabase.from('appointments').insert({
      lead_id: leadId,
      user_id: ruleInternal.user_id,
      title: `Reunião com ${name}`,
      start_time: startTimeISO,
      end_time: endTimeISO,
      status: 'confirmed', // Auto-confirmação para simplificar
      origin: 'public_link',
      reminder_sent: false
  });

  if (appError) {
      console.error(appError);
      return { error: "Erro ao salvar agendamento." };
  }

  // Opcional: Criar log de atividade no lead
  await supabase.from('lead_activities').insert({
      company_id: rule.company_id,
      lead_id: leadId,
      type: 'log',
      content: `Agendou reunião para ${date} às ${time}.`,
      created_by: ruleInternal.user_id // Atribui ao dono da agenda
  });

  return { success: true };
}
