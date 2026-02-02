
import { create } from 'zustand';
import { createClient } from '@/utils/supabase/client';
import { Lead, PipelineStage } from '@/types';
import { RealtimeChannel } from '@supabase/supabase-js';

interface CRMState {
  isInitialized: boolean;
  leads: Lead[];
  stages: PipelineStage[];
  
  // Actions
  initializeCRM: (companyId: string) => Promise<void>;
  moveLeadOptimistic: (leadId: string, toStageId: string, newPosition: number) => void;
  updateLeadPartial: (leadId: string, data: Partial<Lead>) => void;
}

export const useCRMStore = create<CRMState>((set, get) => {
  let channel: RealtimeChannel | null = null;
  const supabase = createClient(); // Instância única fora para evitar recriação

  return {
    isInitialized: false,
    leads: [],
    stages: [],

    initializeCRM: async (companyId: string) => {
        // console.log(`🚀 [Gaming Mode] Inicializando Engine CRM: ${companyId}`);

        // 1. SNAPSHOT (Load Inicial) 
        const [leadsRes, stagesRes] = await Promise.all([
            supabase.from('leads').select('*').eq('company_id', companyId).neq('status', 'archived'),
            supabase.from('pipeline_stages').select('*').eq('company_id', companyId).order('position')
        ]);

        if (!leadsRes.error && !stagesRes.error) {
            set({ 
                leads: leadsRes.data as Lead[], 
                stages: stagesRes.data as PipelineStage[],
                isInitialized: true 
            });
        }

        // 2. WEBSOCKET SUBSCRIPTION (Event Driven)
        if (channel) {
             supabase.removeChannel(channel);
        }

        channel = supabase.channel(`crm-gaming-mode:${companyId}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'leads', 
                filter: `company_id=eq.${companyId}` 
            }, async (payload) => {
                const currentLeads = get().leads;

                // INSERT: Novo Lead
                if (payload.eventType === 'INSERT') {
                    const newLead = payload.new as Lead;
                    
                    // AUDITORIA: Verifica se o lead já está na lista para evitar duplicatas visuais
                    if (!currentLeads.find(l => l.id === newLead.id)) {
                        // console.log("⚡ [CRM] Novo Lead (Realtime):", newLead.name);
                        
                        // HIDRATAÇÃO: As vezes o payload vem incompleto (ex: trigger de banco).
                        // Buscamos o dado completo para garantir consistência.
                        const { data: hydratedLead } = await supabase
                            .from('leads')
                            .select('*')
                            .eq('id', newLead.id)
                            .single();
                            
                        set({ leads: [hydratedLead || newLead, ...currentLeads] });
                    }
                }
                // UPDATE: Atualização de campo
                else if (payload.eventType === 'UPDATE') {
                    const updatedLead = payload.new as Lead;
                    set({ 
                        leads: currentLeads.map(l => l.id === updatedLead.id ? { ...l, ...updatedLead } : l) 
                    });
                }
                // DELETE: Remoção
                else if (payload.eventType === 'DELETE') {
                    set({ 
                        leads: currentLeads.filter(l => l.id !== payload.old.id) 
                    });
                }
            })
            // Escuta mudanças nos Estágios
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'pipeline_stages',
                filter: `company_id=eq.${companyId}`
            }, async () => {
                const { data } = await supabase.from('pipeline_stages').select('*').eq('company_id', companyId).order('position');
                if(data) set({ stages: data as PipelineStage[] });
            })
            .subscribe((status) => {
                if(status === 'CHANNEL_ERROR') console.error("🔴 [CRM] Erro na conexão Realtime.");
            });
    },

    moveLeadOptimistic: (leadId, toStageId, newPosition) => {
        set((state) => ({
            leads: state.leads.map(l => 
                l.id === leadId 
                ? { ...l, pipeline_stage_id: toStageId, position: newPosition, updated_at: new Date().toISOString() } 
                : l
            )
        }));
    },

    updateLeadPartial: (leadId, data) => {
        set((state) => ({
            leads: state.leads.map(l => l.id === leadId ? { ...l, ...data } : l)
        }));
    }
  };
});
