import { create } from 'zustand';
import { createClient } from '@/utils/supabase/client';
import { Lead, PipelineStage, KanbanColumn } from '@/types';
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
        // Evita re-inicialização se já estiver conectado e com dados
        if (get().isInitialized && channel) return;

        const supabase = createClient();
        console.log(`🚀 [CRM Realtime] Iniciando Motor Gaming Mode para: ${companyId}`);

        // 1. SNAPSHOT PARALELO (Leads + Stages)
        const [leadsRes, stagesRes] = await Promise.all([
            supabase.from('leads').select('*').eq('company_id', companyId).neq('status', 'archived'),
            supabase.from('pipeline_stages').select('*').eq('company_id', companyId).order('position')
        ]);

        if (leadsRes.error || stagesRes.error) {
            console.error("Erro no Snapshot CRM:", leadsRes.error || stagesRes.error);
            return;
        }

        set({ 
            leads: leadsRes.data as Lead[], 
            stages: stagesRes.data as PipelineStage[],
            isInitialized: true 
        });

        // 2. SUBSCRIPTION (Realtime Listener)
        if (channel) supabase.removeChannel(channel);

        channel = supabase.channel(`crm-gaming-mode:${companyId}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'leads', 
                filter: `company_id=eq.${companyId}` 
            }, (payload) => {
                const currentLeads = get().leads;

                // INSERT
                if (payload.eventType === 'INSERT') {
                    const newLead = payload.new as Lead;
                    if (!currentLeads.find(l => l.id === newLead.id)) {
                        set({ leads: [newLead, ...currentLeads] });
                    }
                }
                // UPDATE
                else if (payload.eventType === 'UPDATE') {
                    const updatedLead = payload.new as Lead;
                    set({ 
                        leads: currentLeads.map(l => l.id === updatedLead.id ? updatedLead : l) 
                    });
                }
                // DELETE
                else if (payload.eventType === 'DELETE') {
                    set({ 
                        leads: currentLeads.filter(l => l.id !== payload.old.id) 
                    });
                }
            })
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'pipeline_stages',
                filter: `company_id=eq.${companyId}`
            }, async (payload) => {
                // Para Stages, como a ordem importa muito, fazemos um refetch rápido para garantir integridade
                // Isso é raro acontecer, então o custo é baixo.
                const { data } = await supabase.from('pipeline_stages').select('*').eq('company_id', companyId).order('position');
                if(data) set({ stages: data as PipelineStage[] });
            })
            .subscribe((status) => {
                if(status === 'SUBSCRIBED') console.log("🟢 [CRM] Sincronização Ativa.");
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
