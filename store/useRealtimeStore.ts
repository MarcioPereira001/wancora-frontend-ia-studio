
import { create } from 'zustand';
import { createClient } from '@/utils/supabase/client';
import { Instance } from '@/types';
import { SystemLogger } from '@/lib/logger';

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
  let watchdogTimer: NodeJS.Timeout | null = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_ATTEMPTS = 5;

  const startWatchdog = (companyId: string) => {
      if (watchdogTimer) clearInterval(watchdogTimer);
      
      // Verifica a cada 10 segundos se a conexão caiu
      watchdogTimer = setInterval(() => {
          const state = get();
          if (!state.isConnected && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
              SystemLogger.warn(`[Watchdog] Conexão WebSocket perdida. Tentativa de reconexão ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS}`);
              reconnectAttempts++;
              // Para evitar loop infinito de intervalos, não chamamos initialize() completo,
              // mas apenas recriamos o canal.
              get().initialize(companyId);
          } else if (!state.isConnected && reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
              SystemLogger.error(`[Watchdog] Falha crítica: Impossível reconectar ao WebSocket após ${MAX_RECONNECT_ATTEMPTS} tentativas.`);
              if (watchdogTimer) clearInterval(watchdogTimer);
          }
      }, 10000);
  };

  const stopWatchdog = () => {
      if (watchdogTimer) {
          clearInterval(watchdogTimer);
          watchdogTimer = null;
      }
      reconnectAttempts = 0;
  };

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

      // Se já existe um canal, remove antes de recriar (evita memory leaks em reconexões)
      if (channel) {
          const supabase = createClient();
          await supabase.removeChannel(channel);
          channel = null;
      }

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
          if (status === 'SUBSCRIBED') {
              set({ isConnected: true });
              reconnectAttempts = 0; // Reseta tentativas ao conectar com sucesso
              SystemLogger.info(`[Realtime] WebSocket Conectado: ${companyId}`);
          }
          if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
              set({ isConnected: false });
              SystemLogger.warn(`[Realtime] WebSocket Desconectado/Erro: ${status}`);
          }
        });
        
        startWatchdog(companyId);
    },

    disconnect: () => {
      stopWatchdog();
      if (channel) {
        const supabase = createClient();
        supabase.removeChannel(channel);
        channel = null;
        set({ isConnected: false });
      }
    }
  };
});