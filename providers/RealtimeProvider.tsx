'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { useCRMStore } from '@/store/useCRMStore'; // Novo Import
import { whatsappService } from '@/services/whatsappService';

export default function RealtimeProvider({ children }: { children?: React.ReactNode }) {
  const { user } = useAuthStore();
  const { initialize: initConnections, disconnect, setInstances } = useRealtimeStore();
  const { initializeCRM } = useCRMStore(); // Novo Hook

  useEffect(() => {
    if (user?.company_id) {
      // 1. WhatsApp Connections (Snapshot + Socket)
      whatsappService.getAllInstances().then(data => {
          setInstances(data);
      });
      initConnections(user.company_id);

      // 2. CRM / Kanban (Snapshot + Socket) - GAMING MODE ON
      // Inicializa em background assim que o usuário loga
      initializeCRM(user.company_id);

    } else {
      disconnect();
    }

    return () => {
      // Cleanup gerido pelas stores
    };
  }, [user?.company_id, initConnections, disconnect, setInstances, initializeCRM]);

  return <>{children}</>;
}