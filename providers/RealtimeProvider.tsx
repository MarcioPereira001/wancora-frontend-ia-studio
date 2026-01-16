'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { whatsappService } from '@/services/whatsappService';

export default function RealtimeProvider({ children }: { children?: React.ReactNode }) {
  const { user } = useAuthStore();
  const { initialize, disconnect, setInstances } = useRealtimeStore();

  useEffect(() => {
    if (user?.company_id) {
      // 1. Carga Inicial de Dados (Snapshot)
      whatsappService.getAllInstances().then(data => {
          setInstances(data);
      });

      // 2. Assinatura do Socket
      initialize(user.company_id);
    } else {
      disconnect();
    }

    // Cleanup ao desmontar ou deslogar
    return () => {
      // Não desconectamos imediatamente para evitar flicker em navegação rápida,
      // a store gerencia a reconexão se o ID mudar.
    };
  }, [user?.company_id, initialize, disconnect, setInstances]);

  return <>{children}</>;
}