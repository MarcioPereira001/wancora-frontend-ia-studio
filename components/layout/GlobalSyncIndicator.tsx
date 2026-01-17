'use client';

import React, { useEffect, useState } from 'react';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { RefreshCw, CheckCircle2, CloudDownload } from 'lucide-react';

export function GlobalSyncIndicator() {
  const { instances } = useRealtimeStore();
  const [show, setShow] = useState(false);

  // LOG DE DIAGNÓSTICO: Verifique o console do navegador (F12)
  useEffect(() => {
    if (instances.length > 0) {
        // Descomente se quiser ver o fluxo bruto
        // console.log("🔍 [GlobalSync DEBUG] Instances carregadas:", instances);
    }
  }, [instances]);

  // Encontra QUALQUER instância que esteja sincronizando ou com progresso pendente
  const syncingInstance = instances.find(i => {
    // Lógica Relaxada: Acreditamos no status de sync ou na porcentagem
    // Mesmo que o status principal seja 'connecting' ou 'open'
    
    const status = i.sync_status || '';
    const percent = i.sync_percent !== undefined ? i.sync_percent : 100;

    // Verifica status novo ('syncing') e antigos
    const isSyncStatus = status === 'syncing' || status === 'importing_contacts' || status === 'importing_messages';
    
    // Verifica se a porcentagem está "viva" (entre 1 e 99)
    const isPercentageActive = percent > 0 && percent < 100;

    // Só exibimos se houver atividade real
    const isActive = isSyncStatus || isPercentageActive;
    
    if (isActive) {
        console.log(`[GlobalSync] Ativando para sessão ${i.session_id}: ${status} (${percent}%)`);
    }

    return isActive;
  });

  useEffect(() => {
    if (syncingInstance) {
      setShow(true);
    } else {
      // Pequeno delay para esconder suavemente quando terminar (exibe 100% brevemente)
      if (show) {
          const timer = setTimeout(() => setShow(false), 3000);
          return () => clearTimeout(timer);
      }
    }
  }, [syncingInstance, show]);

  if (!syncingInstance && !show) return null;

  const percent = syncingInstance?.sync_percent !== undefined ? syncingInstance.sync_percent : 100;
  const isComplete = !syncingInstance && show; // Estado final antes de sumir
  const currentStatus = syncingInstance?.sync_status;

  let statusLabel = 'Sincronizando...';
  if (currentStatus === 'syncing') {
     if (percent < 20) statusLabel = 'Organizando Contatos';
     else if (percent < 80) statusLabel = 'Baixando Histórico';
     else statusLabel = 'Finalizando...';
  }
  else if (currentStatus === 'importing_contacts') statusLabel = 'Importando Contatos';
  else if (currentStatus === 'importing_messages') statusLabel = 'Baixando Histórico';
  
  if (isComplete) statusLabel = 'Sincronização Concluída';

  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[99999] pointer-events-auto">
      {/* Card Flutuante com Sombra Forte e Animação */}
      <div className="bg-[#09090b] border border-zinc-800 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] p-4 w-80 animate-in slide-in-from-right-10 fade-in duration-500 pointer-events-auto ring-1 ring-white/5">
        
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors duration-500 ${isComplete ? 'bg-emerald-500/10' : 'bg-blue-600/10'}`}>
               {isComplete ? (
                 <CheckCircle2 className="w-5 h-5 text-emerald-500" />
               ) : (
                 <CloudDownload className="w-5 h-5 text-blue-500 animate-bounce" />
               )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white leading-none mb-1 transition-all">
                {statusLabel}
              </span>
              <span className="text-[10px] text-zinc-400 font-medium">
                {isComplete ? 'Sistema atualizado.' : 'Não feche o sistema.'}
              </span>
            </div>
          </div>
          <span className={`text-lg font-mono font-bold transition-colors ${isComplete ? 'text-emerald-500' : 'text-white'}`}>
            {percent}%
          </span>
        </div>

        {/* Barra de Progresso */}
        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden relative">
            <div 
              className={`h-full transition-all duration-700 ease-out relative ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-600 to-cyan-400'}`}
              style={{ width: `${percent}%` }}
            >
                {!isComplete && (
                    <div className="absolute inset-0 bg-white/30 w-full animate-[shimmer_1.5s_infinite] -skew-x-12" />
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
