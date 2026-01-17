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
  // Ação para forçar atualização manual se necessário
  refreshInstances: (companyId: string) => Promise<void>;
}

export const useRealtimeStore = create<RealtimeState>((set, get) => {
  let channel: RealtimeChannel | null = null;

  return {
    isConnected: false,
    instances: [], // Começa vazio, mas será preenchido IMEDIATAMENTE no initialize
    unreadCount: 0,

    setInstances: (instances) => set({ instances }),

    refreshInstances: async (companyId: string) => {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('instances')
            .select('*')
            .eq('company_id', companyId);
        
        if (data && !error) {
            console.log("⚡ [Realtime] Estado atualizado (Snapshot):", data.length, "instâncias");
            set({ instances: data });
        }
    },

    initialize: async (companyId: string) => {
      // 1. Evita duplicidade, mas garante que os dados estejam frescos
      if (channel && get().isConnected) {
          // Se já está conectado, apenas atualiza os dados para garantir
          get().refreshInstances(companyId);
          return;
      }

      const supabase = createClient();
      console.log(`🔥 [Realtime] Iniciando conexão AGRESSIVA para empresa: ${companyId}`);

      // 2. FETCH INICIAL (SNAPSHOT) - O Segredo do "Modo Jogo"
      // Carrega os dados IMEDIATAMENTE, não espera evento do socket
      await get().refreshInstances(companyId);

      // 3. Configura o Canal
      channel = supabase.channel(`company-room:${companyId}`)
        
        // --- MONITORAMENTO DE INSTÂNCIAS (ALTA FREQUÊNCIA) ---
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'instances', 
          filter: `company_id=eq.${companyId}` 
        }, (payload) => {
            const currentInstances = get().instances;
            
            // Lógica de Atualização Otimista (Instantânea)
            if (payload.eventType === 'DELETE') {
                console.log("❌ [Realtime] Instância removida:", payload.old.id);
                set({ instances: currentInstances.filter(i => i.id !== payload.old.id) });
            } else if (payload.eventType === 'INSERT') {
                console.log("✨ [Realtime] Nova instância:", payload.new.id);
                // Verifica duplicidade antes de adicionar
                if (!currentInstances.find(i => i.id === payload.new.id)) {
                    set({ instances: [...currentInstances, payload.new as Instance] });
                }
            } else if (payload.eventType === 'UPDATE') {
                // Atualização crítica para a barra de progresso (Sync)
                const updated = payload.new as Instance;
                // console.log(`🔄 [Realtime] Update ${updated.session_id}: ${updated.sync_status} (${updated.sync_percent}%)`);
                
                set({ 
                    instances: currentInstances.map(i => 
                        i.id === updated.id ? updated : i
                    ) 
                });
            }
        })

        // --- MONITORAMENTO DE STATUS DE CONEXÃO ---
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            console.log('🟢 [Realtime] Conectado e Sincronizado!');
            set({ isConnected: true });
            // Se reconectou, busca dados de novo para garantir que não perdeu nada no "blink"
            await get().refreshInstances(companyId);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            console.warn('🔴 [Realtime] Desconectado. Tentando reconectar...');
            set({ isConnected: false });
          }
        });
    },

    disconnect: () => {
      if (channel) {
        console.log('💤 [Realtime] Desconectando...');
        const supabase = createClient();
        supabase.removeChannel(channel);
        channel = null;
        set({ isConnected: false });
        // Nota: Não limpamos 'instances' aqui para evitar "flicker" na tela (tela branca)
        // deixamos os dados antigos até a nova conexão substituir.
      }
    }
  };
});
