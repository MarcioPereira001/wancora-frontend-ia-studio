
'use client';

import { useEffect } from 'react';
import { useCRMStore } from '@/store/useCRMStore';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { useAuthStore } from '@/store/useAuthStore';

export function FocusGuard() {
  const { initializeCRM } = useCRMStore();
  const { refreshInstances } = useRealtimeStore();
  // Nota: Hooks de lista como useChatList são locais. O FocusGuard foca em Stores Globais.

  useEffect(() => {
    const onFocus = () => {
      // console.log("👀 [FocusGuard] Janela ativa. Verificando integridade de dados...");
      
      // Apenas se já tiver usuário logado e empresa definida
      // Acessamos o estado diretamente para evitar dependências desnecessárias no useEffect
      const authState = useAuthStore.getState();
      
      if (authState.user?.company_id) {
          const companyId = authState.user.company_id;
          
          // Soft Refresh: Recarrega dados sem piscar a tela (substituição silenciosa)
          // Isso garante que se o Socket desconectou em background, os dados são atualizados via REST
          initializeCRM(companyId);
          refreshInstances(companyId);
      }
    };

    window.addEventListener('focus', onFocus);
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') onFocus();
    });

    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('visibilitychange', () => {});
    };
  }, [initializeCRM, refreshInstances]);

  return null;
}
