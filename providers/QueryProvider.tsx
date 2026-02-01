'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { QueryClient } from '@tanstack/query-core';
import React, { useState } from 'react';

interface QueryProviderProps {
  children?: React.ReactNode;
}

export default function QueryProvider({ children }: QueryProviderProps) {
  // Criação do client dentro do componente para evitar compartilhamento de estado no SSR
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Cache por 1 minuto para evitar refetching agressivo
        staleTime: 60 * 1000,
        // Retry apenas 1 vez em caso de erro para falhar rápido
        retry: 1,
        // Não refetchar janela em background para economizar recursos
        refetchOnWindowFocus: false,
      },
    },
  }));

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}