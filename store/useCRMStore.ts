
import { create } from 'zustand';
import { createClient } from '@/utils/supabase/client';
import { Lead, PipelineStage } from '@/types';
import toast from 'react-hot-toast';

interface CRMState {
  isInitialized: boolean;
  leads: Lead[];
  stages: PipelineStage[];
  connectionError: string | null;
  
  // Actions
  initializeCRM: (companyId: string) => Promise<void>;
  moveLeadOptimistic: (leadId: string, toStageId: string, newPosition: number) => void;
  updateLeadPartial: (leadId: string, data: Partial<Lead>) => void;
  setConnectionError: (error: string | null) => void;
}

export const useCRMStore = create<CRMState>((set, get) => {
  let channel: any = null;
  const supabase = createClient();

  // Batching buffer para eventos real-time
  let eventBuffer: any[] = [];
  let flushTimeout: NodeJS.Timeout | null = null;

  const flushEvents = () => {
    if (eventBuffer.length === 0) return;
    
    const currentLeads = [...get().leads];
    let leadsChanged = false;

    eventBuffer.forEach(payload => {
        if (payload.eventType === 'INSERT') {
            const newLead = payload.new as Lead;
            if (!currentLeads.find(l => l.id === newLead.id)) {
                currentLeads.unshift(newLead);
                leadsChanged = true;
            }
        } else if (payload.eventType === 'UPDATE') {
            const updatedLead = payload.new as Lead;
            const index = currentLeads.findIndex(l => l.id === updatedLead.id);
            if (index !== -1) {
                currentLeads[index] = { ...currentLeads[index], ...updatedLead };
                leadsChanged = true;
            }
        } else if (payload.eventType === 'DELETE') {
            const index = currentLeads.findIndex(l => l.id === payload.old.id);
            if (index !== -1) {
                currentLeads.splice(index, 1);
                leadsChanged = true;
            }
        }
    });

    if (leadsChanged) {
        set({ leads: currentLeads });
    }
    
    eventBuffer = [];
    flushTimeout = null;
  };

  const queueEvent = (payload: any) => {
      eventBuffer.push(payload);
      if (!flushTimeout) {
          flushTimeout = setTimeout(flushEvents, 300); // 300ms batching window
      }
  };

  return {
    isInitialized: false,
    leads: [],
    stages: [],
    connectionError: null,

    setConnectionError: (error) => set({ connectionError: error }),

    initializeCRM: async (companyId: string) => {
        try {
            set({ connectionError: null });

            // 1. SNAPSHOT (Load Inicial)
            const [leadsRes, stagesRes] = await Promise.all([
                supabase.from('leads').select('*').eq('company_id', companyId).neq('status', 'archived'),
                supabase.from('pipeline_stages').select('*').eq('company_id', companyId).order('position')
            ]);

            if (leadsRes.error) throw leadsRes.error;
            if (stagesRes.error) throw stagesRes.error;

            set({ 
                leads: leadsRes.data as Lead[], 
                stages: stagesRes.data as PipelineStage[],
                isInitialized: true 
            });

            // 2. WEBSOCKET SUBSCRIPTION
            if (channel) supabase.removeChannel(channel);

            channel = supabase.channel(`crm-gaming-mode:${companyId}`)
                .on('postgres_changes', { 
                    event: '*', 
                    schema: 'public', 
                    table: 'leads', 
                    filter: `company_id=eq.${companyId}` 
                }, (payload) => {
                    queueEvent(payload);
                })
                // Escuta mudanças nos Estágios (Para consistência do Kanban)
                .on('postgres_changes', {
                    event: '*',
                    schema: 'public',
                    table: 'pipeline_stages',
                    filter: `company_id=eq.${companyId}`
                }, async () => {
                    const { data, error } = await supabase.from('pipeline_stages').select('*').eq('company_id', companyId).order('position');
                    if(data && !error) set({ stages: data as PipelineStage[] });
                })
                .subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        set({ connectionError: null });
                    } else if (status === 'CLOSED') {
                        console.warn('Supabase real-time connection closed.');
                    } else if (status === 'CHANNEL_ERROR') {
                        console.error('Supabase real-time connection error.');
                        set({ connectionError: 'Erro de conexão em tempo real. Tentando reconectar...' });
                        toast.error('Conexão perdida. Tentando reconectar...', { id: 'supabase-conn-error' });
                    }
                });
        } catch (error: any) {
            console.error('Erro ao inicializar CRM:', error);
            set({ connectionError: 'Falha ao carregar dados do CRM. Verifique sua conexão.' });
            toast.error('Falha ao carregar dados do CRM.', { id: 'crm-init-error' });
        }
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