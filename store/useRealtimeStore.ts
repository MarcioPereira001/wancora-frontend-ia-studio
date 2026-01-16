import { create } from 'zustand';
import { createClient } from '@/utils/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Instance, Message, Contact } from '@/types';
import { useAuthStore } from './useAuthStore';

interface RealtimeState {
  isConnected: boolean;
  instances: Instance[];
  // Cache leve para contadores e status rápido
  unreadCount: number;
  
  // Actions
  initialize: (companyId: string) => void;
  disconnect: () => void;
  setInstances: (instances: Instance[]) => void;
}

export const useRealtimeStore = create<RealtimeState>((set, get) => {
  let channel: RealtimeChannel | null = null;

  return {
    isConnected: false,
    instances: [],
    unreadCount: 0,

    setInstances: (instances) => set({ instances }),

    initialize: (companyId: string) => {
      // Evita múltiplas conexões se já estiver conectado na mesma empresa
      if (channel && get().isConnected) return;

      const supabase = createClient();
      console.log(`[Realtime] Iniciando conexão para empresa: ${companyId}`);

      // Canal Global da Empresa (Escuta tudo que é relevante)
      channel = supabase.channel(`company-room:${companyId}`)
        
        // 1. INSTÂNCIAS (Monitoramento de Conexão/QR Code)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'instances', 
          filter: `company_id=eq.${companyId}` 
        }, (payload) => {
            const currentInstances = get().instances;
            
            if (payload.eventType === 'DELETE') {
                set({ instances: currentInstances.filter(i => i.id !== payload.old.id) });
            } else {
                // INSERT ou UPDATE
                const newInstance = payload.new as Instance;
                const exists = currentInstances.find(i => i.id === newInstance.id);
                
                if (exists) {
                    set({ instances: currentInstances.map(i => i.id === newInstance.id ? newInstance : i) });
                } else {
                    set({ instances: [...currentInstances, newInstance] });
                }
            }
        })

        // 2. MENSAGENS (Contadores Globais e Toasts)
        // Nota: O Chat específico escuta suas próprias mensagens, aqui focamos em eventos globais
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `company_id=eq.${companyId}`
        }, (payload) => {
            // Lógica futura: Tocar som de notificação global se não estiver no chat
            // const msg = payload.new as Message;
            // console.log("[Realtime] Nova mensagem global detectada");
        })

        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            set({ isConnected: true });
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            set({ isConnected: false });
          }
        });
    },

    disconnect: () => {
      if (channel) {
        console.log('[Realtime] Desconectando...');
        const supabase = createClient();
        supabase.removeChannel(channel);
        channel = null;
        set({ isConnected: false, instances: [] });
      }
    }
  };
});