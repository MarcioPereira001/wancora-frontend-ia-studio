
import { create } from 'zustand';
import { createClient } from '@/utils/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Instance } from '@/types';

interface RealtimeState {
  isConnected: boolean;
  instances: Instance[];
  unreadCount: number;
  
  // Actions
  initialize: (companyId: string) => Promise<void>;
  disconnect: () => void;
  setInstances: (instances: Instance[]) => void;
  refreshInstances: (companyId: string) => Promise<void>;
}

export const useRealtimeStore = create<RealtimeState>((set, get) => {
  let channel: RealtimeChannel | null = null;

  return {
    isConnected: false,
    instances: [], 
    unreadCount: 0,

    setInstances: (instances) => set({ instances }),

    refreshInstances: async (companyId: string) => {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('instances')
            .select('*')
            .eq('company_id', companyId);
        
        if (data && !error) {
            // console.log("⚡ [Realtime] Snapshot atualizado:", data.length, "instâncias");
            set({ instances: data });
        }
    },

    initialize: async (companyId: string) => {
      // Fetch inicial (Snapshot) obrigatório ao montar
      await get().refreshInstances(companyId);

      if (channel) return; // Evita duplicação de canais

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
                // Adiciona novas instâncias instantaneamente
                if (!currentInstances.find(i => i.id === payload.new.id)) {
                    set({ instances: [...currentInstances, payload.new as Instance] });
                }
            } else if (payload.eventType === 'UPDATE') {
                // Atualização crítica: Isso dispara a re-renderização do GlobalSyncIndicator
                // porque o `activeInstance` lá depende dessa lista.
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
