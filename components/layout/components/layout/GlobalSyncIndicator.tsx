'use client';

import React from 'react';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { RefreshCw, CloudDownload } from 'lucide-react';

export function GlobalSyncIndicator() {
  const { instances } = useRealtimeStore();
  
  // Pega a primeira instância conectada que esteja em processo de sync
  const activeInstance = instances.find(i => i.status === 'connected');
  
  if (!activeInstance) return null;
  
  const { sync_status, sync_percent, name } = activeInstance;
  
  // Verifica se está nos status de importação definidos no backend
  const isSyncing = (sync_status === 'importing_contacts' || sync_status === 'importing_messages') && 
                    (sync_percent !== undefined && sync_percent < 100);

  if (!isSyncing) return null;

  // Texto dinâmico
  const statusText = sync_status === 'importing_contacts' ? 'Importando Contatos' : 'Baixando Histórico';

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-80 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl p-4 animate-in slide-in-from-bottom-10 fade-in border-l-4 border-l-primary">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
             <div className="absolute inset-0 bg-emerald-500/20 rounded-full animate-ping"></div>
             <div className="bg-zinc-900 p-1.5 rounded-full border border-zinc-800 relative z-10">
                <RefreshCw className="w-4 h-4 text-emerald-500 animate-spin" />
             </div>
          </div>
          <div>
              <h4 className="text-sm font-bold text-white leading-none">{statusText}</h4>
              <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[150px]">{name}</p>
          </div>
        </div>
        <span className="text-lg font-mono font-bold text-emerald-400 tracking-tight">{sync_percent}%</span>
      </div>
      
      {/* Barra de Progresso */}
      <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden border border-zinc-800/50">
        <div 
          className="h-full bg-emerald-500 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(16,185,129,0.5)]"
          style={{ width: `${sync_percent}%` }}
        />
      </div>
      
      <div className="flex justify-between items-center mt-3">
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
            <CloudDownload className="w-3 h-3" />
            <span>Sincronizando em 2º plano...</span>
          </div>
      </div>
    </div>
  );
}
