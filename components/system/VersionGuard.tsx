
'use client';

import { useEffect } from 'react';

export function VersionGuard() {
  useEffect(() => {
    // Função para lidar com erros de carregamento de chunk (Deploy novo vs Cache antigo)
    const handleChunkError = (event: ErrorEvent | PromiseRejectionEvent) => {
      const error = 'reason' in event ? event.reason : event.error;
      const message = error?.message || '';
      const stack = error?.stack || '';

      // Padrões de erro que indicam arquivos JS faltando no servidor (404)
      const isChunkError = 
        message.includes('ChunkLoadError') || 
        message.includes('Loading chunk') ||
        message.includes('Unexpected token') || // As vezes o 404 retorna HTML em vez de JS
        stack.includes('ChunkLoadError');

      if (isChunkError) {
        console.warn('🔄 [VersionGuard] Nova versão detectada ou arquivo corrompido. Recarregando...');
        
        // Prevenção de Loop Infinito: Só recarrega se o último reload foi há mais de 10s
        const lastReload = sessionStorage.getItem('last_chunk_reload');
        const now = Date.now();

        if (!lastReload || now - parseInt(lastReload) > 10000) {
          sessionStorage.setItem('last_chunk_reload', String(now));
          window.location.reload();
        }
      }
    };

    window.addEventListener('error', handleChunkError);
    window.addEventListener('unhandledrejection', handleChunkError);

    return () => {
      window.removeEventListener('error', handleChunkError);
      window.removeEventListener('unhandledrejection', handleChunkError);
    };
  }, []);

  return null;
}
