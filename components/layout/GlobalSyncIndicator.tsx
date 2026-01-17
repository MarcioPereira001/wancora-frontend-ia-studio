'use client';

import React, { useEffect, useState } from 'react';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { RefreshCw, CheckCircle2, CloudDownload, Database } from 'lucide-react';

export function GlobalSyncIndicator() {
  const { instances } = useRealtimeStore();
  const [show, setShow] = useState(false);

  // Lógica de Detecção "Agressiva"
  // Objetivo: Mostrar o indicador ao MENOR sinal de atividade de sync, independente do status da conexão.
  const syncingInstance = instances.find(i => {
    const sync = i.sync_status || '';
    const percent = i.sync_percent;
    
    // Lista de status que gatilham o indicador
    const activeStates = ['syncing', 'importing_contacts', 'importing_messages', 'processing_history'];
    const isSyncing = activeStates.includes(sync);
    
    // Validação de progresso (qualquer coisa entre 0 e 99 é atividade válida)
    const hasProgress = typeof percent === 'number' && percent >= 0 && percent < 100;

    // REGRA DE OURO: Se o backend diz que está importando, NÓS MOSTRAMOS.
    // Não dependemos do i.status (connected/qrcode) pois pode haver delay na propagação desse estado.
    // Apenas filtramos se estiver explicitamente 'disconnected' para evitar mostrar dados obsoletos de sessões encerradas.
    return (isSyncing || hasProgress) && i.status !== 'disconnected';
  });

  useEffect(() => {
    if (syncingInstance) {
      setShow(true);
    } else {
      // Delay para transição suave de saída (mantém o "100%" visível por alguns segundos)
      if (show) {
          const timer = setTimeout(() => setShow(false), 4000);
          return () => clearTimeout(timer);
      }
    }
  }, [syncingInstance, show]);

  if (!syncingInstance && !show) return null;

  // Dados para exibição (Prioriza instância ativa, senão usa estado final 'completed' para animação de saída)
  const percent = syncingInstance?.sync_percent ?? 100;
  const currentStatus = syncingInstance?.sync_status;
  const isComplete = !syncingInstance && show; 

  // Texto Dinâmico
  let statusLabel = 'Sincronizando...';
  if (currentStatus === 'importing_contacts') statusLabel = 'Baixando Contatos';
  else if (currentStatus === 'importing_messages') statusLabel = 'Baixando Conversas';
  else if (currentStatus === 'processing_history') statusLabel = 'Processando Histórico';
  else if (isComplete) statusLabel = 'Sincronização Concluída';

  return (
    <div className="fixed bottom-6 right-6 z-[99999] pointer-events-none flex flex-col items-end gap-2">
      {/* Card Principal */}
      <div className="bg-[#09090b] border border-zinc-800 rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] p-4 w-80 animate-in slide-in-from-right-10 fade-in duration-500 pointer-events-auto ring-1 ring-white/10 relative overflow-hidden group">
        
        {/* Glow Effect no fundo para destaque */}
        <div className={`absolute -right-4 -top-4 w-24 h-24 bg-${isComplete ? 'emerald' : 'blue'}-500/20 blur-3xl rounded-full pointer-events-none group-hover:bg-${isComplete ? 'emerald' : 'blue'}-500/30 transition-all duration-1000`} />

        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg transition-colors duration-500 shadow-inner ${isComplete ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-600/10 text-blue-500'}`}>
               {isComplete ? (
                 <CheckCircle2 className="w-5 h-5" />
               ) : (
                 <RefreshCw className="w-5 h-5 animate-spin" />
               )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white leading-none mb-1 transition-all">
                {statusLabel}
              </span>
              <span className="text-[10px] text-zinc-400 font-medium">
                {isComplete ? 'Tudo pronto para uso.' : 'Não feche esta janela.'}
              </span>
            </div>
          </div>
          <span className={`text-xl font-mono font-bold tracking-tight transition-colors ${isComplete ? 'text-emerald-500' : 'text-zinc-200'}`}>
            {percent}%
          </span>
        </div>

        {/* Barra de Progresso */}
        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden relative z-10">
            <div 
              className={`h-full transition-all duration-500 ease-out relative ${isComplete ? 'bg-emerald-500' : 'bg-blue-600'}`}
              style={{ width: `${percent}%` }}
            >
                {!isComplete && (
                    <div className="absolute inset-0 bg-white/40 w-full animate-[shimmer_1s_infinite] -skew-x-12" />
                )}
            </div>
        </div>
      </div>
    </div>
  );
}