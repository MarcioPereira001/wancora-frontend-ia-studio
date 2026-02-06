
import { create } from 'zustand';
import { createClient } from '@/utils/supabase/client';
import { Instance } from '@/types';

interface RealtimeState {
  isConnected: boolean;
  instances: Instance[];
  unreadCount: number;
  
  // Novo Estado para Gatilho Manual
  forcedSyncId: string | null;
  
  // Estado para Alerta de Desconexão (Interceptador)
  isDisconnectModalOpen: boolean;

  // Actions
  initialize: (companyId: string) => Promise<void>;
  disconnect: () => void;
  setInstances: (instances: Instance[]) => void;
  refreshInstances: (companyId: string) => Promise<void>;
  triggerSyncAnimation: (instanceId: string) => void; 
  clearSyncAnimation: () => void;
  
  // Action do Modal
  setDisconnectModalOpen: (isOpen: boolean) => void;
}

export const useRealtimeStore = create<RealtimeState>((set, get) => {
  let channel: any = null;

  return {
    isConnected: false,
    instances: [], 
    unreadCount: 0,
    forcedSyncId: null,
    isDisconnectModalOpen: false,

    setInstances: (instances) => set({ instances }),

    triggerSyncAnimation: (instanceId) => set({ forcedSyncId: instanceId }),
    clearSyncAnimation: () => set({ forcedSyncId: null }),
    
    setDisconnectModalOpen: (isOpen) => set({ isDisconnectModalOpen: isOpen }),

    refreshInstances: async (companyId: string) => {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('instances')
            .select('*')
            .eq('company_id', companyId);
        
        if (data && !error) {
            set({ instances: data });
        }
    },

    initialize: async (companyId: string) => {
      await get().refreshInstances(companyId);

      if (channel) return; 

      const supabase = createClient();
      console.log(`🔥 [Realtime] Monitorando Instâncias: ${companyId}`);

      channel = supabase.channel(`company-room:${companyId}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'instances', 
          filter: `company_id=eq.${companyId}` 
        }, (payload) => {
            const currentInstances = get().instances;
            
            if (payload.eventType === 'DELETE') {
                set({ instances: currentInstances.filter(i => i.id !== payload.old.id) });
            } else if (payload.eventType === 'INSERT') {
                if (!currentInstances.find(i => i.id === payload.new.id)) {
                    set({ instances: [...currentInstances, payload.new as Instance] });
                }
            } else if (payload.eventType === 'UPDATE') {
                const updated = payload.new as Instance;
                set({ 
                    instances: currentInstances.map(i => 
                        i.id === updated.id ? updated : i
                    ) 
                });
            }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') set({ isConnected: true });
          if (status === 'CLOSED') set({ isConnected: false });
        });
    },

    disconnect: () => {
      if (channel) {
        const supabase = createClient();
        supabase.removeChannel(channel);
        channel = null;
        set({ isConnected: false });
      }
    }
  };
});