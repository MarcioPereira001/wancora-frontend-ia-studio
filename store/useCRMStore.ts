
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
  const supabase = createClient();

  return {
    isInitialized: false,
    leads: [],
    stages: [],

    initializeCRM: async (companyId: string) => {
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

        // 2. WEBSOCKET SUBSCRIPTION
        if (channel) supabase.removeChannel(channel);

        channel = supabase.channel(`crm-gaming-mode:${companyId}`)
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'leads', 
                filter: `company_id=eq.${companyId}` 
            }, (payload) => {
                const currentLeads = get().leads;

                // INSERT: Novo Lead
                if (payload.eventType === 'INSERT') {
                    const newLead = payload.new as Lead;
                    // Evita duplicata se já existir no estado
                    if (!currentLeads.find(l => l.id === newLead.id)) {
                        set({ leads: [newLead, ...currentLeads] });
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
            // Escuta mudanças nos Estágios (Para consistência do Kanban)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'pipeline_stages',
                filter: `company_id=eq.${companyId}`
            }, async () => {
                const { data } = await supabase.from('pipeline_stages').select('*').eq('company_id', companyId).order('position');
                if(data) set({ stages: data as PipelineStage[] });
            })
            .subscribe();
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
