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
  let heartbeatInterval: NodeJS.Timeout | null = null;

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
            // Se mudou algo, atualiza (evita re-renders desnecessários se for igual)
            const current = get().instances;
            const hasChanges = JSON.stringify(current) !== JSON.stringify(data);
            
            if (hasChanges) {
                console.log(`⚡ [Realtime] Dados atualizados: ${data.length} instâncias encontradas.`);
                set({ instances: data });
            }
        }
    },

    initialize: async (companyId: string) => {
      // 1. Limpeza preventiva
      if (channel) get().disconnect();
      if (heartbeatInterval) clearInterval(heartbeatInterval);

      const supabase = createClient();
      console.log(`🔥 [Realtime] Conectando para empresa: ${companyId}`);

      // 2. FETCH INICIAL (SNAPSHOT)
      await get().refreshInstances(companyId);

      // 3. HEARTBEAT DE SEGURANÇA (O "F5 AUTOMÁTICO")
      // Verifica o banco a cada 3 segundos caso o WebSocket falhe ou demore
      heartbeatInterval = setInterval(async () => {
         // Só faz o polling se não tiver instâncias ou se estiver sincronizando (para garantir a barra fluida)
         const current = get().instances;
         const isSyncing = current.some(i => i.sync_status === 'syncing');
         const isEmpty = current.length === 0;

         if (isEmpty || isSyncing) {
             // console.log("💓 [Heartbeat] Verificando dados...");
             await get().refreshInstances(companyId);
         }
      }, 3000);

      // 4. CANAL REALTIME
      channel = supabase.channel(`company-room:${companyId}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'instances', 
          filter: `company_id=eq.${companyId}` 
        }, (payload) => {
            const currentInstances = get().instances;
            
            if (payload.eventType === 'DELETE') {
                console.log("❌ [Realtime] DELETE detectado");
                set({ instances: currentInstances.filter(i => i.id !== payload.old.id) });
            } 
            else if (payload.eventType === 'INSERT') {
                console.log("✨ [Realtime] INSERT detectado");
                set({ instances: [...currentInstances, payload.new as Instance] });
            } 
            else if (payload.eventType === 'UPDATE') {
                const updated = payload.new as Instance;
                // console.log(`🔄 [Realtime] UPDATE: ${updated.sync_percent}%`);
                set({ 
                    instances: currentInstances.map(i => i.id === updated.id ? updated : i) 
                });
            }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            set({ isConnected: true });
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            console.warn('🔴 [Realtime] Desconectado.');
            set({ isConnected: false });
          }
        });
    },

    disconnect: () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (channel) {
        const supabase = createClient();
        supabase.removeChannel(channel);
        channel = null;
      }
      set({ isConnected: false });
    }
  };
});
