
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

  return {
    isInitialized: false,
    leads: [],
    stages: [],

    initializeCRM: async (companyId: string) => {
        // Se já inicializou para esta empresa, não refaz o fetch pesado
        // Mas podemos querer reconectar o socket se ele caiu.
        const currentIsInit = get().isInitialized;
        
        const supabase = createClient();
        console.log(`🚀 [Gaming Mode] Inicializando Engine CRM: ${companyId}`);

        // 1. SNAPSHOT (Load Inicial) - Executa sempre para garantir consistência ao focar na aba
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
             // Se já existe canal, remove para evitar duplicidade de ouvintes
             supabase.removeChannel(channel);
        }

        channel = supabase.channel(`crm-gaming-mode:${companyId}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'leads', 
                filter: `company_id=eq.${companyId}` 
            }, (payload) => {
                const currentLeads = get().leads;

                // INSERT: Novo Lead entra no topo ou na posição correta
                if (payload.eventType === 'INSERT') {
                    const newLead = payload.new as Lead;
                    if (!currentLeads.find(l => l.id === newLead.id)) {
                        console.log("⚡ [CRM] Novo Lead recebido:", newLead.name);
                        set({ leads: [newLead, ...currentLeads] });
                    }
                }
                // UPDATE: Atualização de campo (mover card, mudar valor, etc)
                else if (payload.eventType === 'UPDATE') {
                    const updatedLead = payload.new as Lead;
                    // Mapeia e substitui. O React detectará a mudança e renderizará.
                    set({ 
                        leads: currentLeads.map(l => l.id === updatedLead.id ? updatedLead : l) 
                    });
                }
                // DELETE: Remoção
                else if (payload.eventType === 'DELETE') {
                    set({ 
                        leads: currentLeads.filter(l => l.id !== payload.old.id) 
                    });
                }
            })
            // Escuta mudanças nos Estágios (Stages) também
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'pipeline_stages',
                filter: `company_id=eq.${companyId}`
            }, async () => {
                // Se mudou estrutura do funil (nome, ordem), faz refresh dos stages
                const { data } = await supabase.from('pipeline_stages').select('*').eq('company_id', companyId).order('position');
                if(data) set({ stages: data as PipelineStage[] });
            })
            .subscribe((status) => {
                if(status === 'SUBSCRIBED') console.log("🟢 [CRM] Sincronização em Tempo Real Ativa.");
                if(status === 'CHANNEL_ERROR') console.error("🔴 [CRM] Erro na conexão Realtime.");
            });
    },

    // AÇÃO OTIMISTA: Move visualmente antes do servidor responder
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
