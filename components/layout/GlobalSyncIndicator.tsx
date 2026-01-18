
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { createClient } from '@/utils/supabase/client';
import { RefreshCw, CheckCircle2, CloudDownload, Database, Users, MessageSquare } from 'lucide-react';

export function GlobalSyncIndicator() {
  const { instances } = useRealtimeStore();
  const [show, setShow] = useState(false);
  const [localPercent, setLocalPercent] = useState(0);
  const [localStatus, setLocalStatus] = useState('');
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Encontra qualquer instância que esteja conectada ou processando
  // Prioriza instâncias que NÃO estão 'completed' nem 'disconnected'
  const activeInstance = instances.find(i => 
      i.status === 'connected' || 
      (i.sync_status && i.sync_status !== 'completed' && i.sync_status !== 'waiting')
  );

  useEffect(() => {
    // Se não tem instância ativa, reseta e esconde
    if (!activeInstance) {
        setShow(false);
        return;
    }

    const fetchDirectStatus = async () => {
        const supabase = createClient();
        
        const { data } = await supabase
            .from('instances')
            .select('sync_status, sync_percent, status')
            .eq('id', activeInstance.id)
            .single();

        if (data) {
            setLocalStatus(data.sync_status || '');
            setLocalPercent(data.sync_percent || 0);
            
            // LÓGICA DE EXIBIÇÃO ROBUSTA:
            // 1. Status conhecidos de sincronização
            const syncStates = ['importing_contacts', 'importing_messages', 'processing_history', 'syncing'];
            const isSyncingState = syncStates.includes(data.sync_status || '');
            
            // 2. Porcentagem em andamento (pega o caso de "Late Join")
            const isInProgress = (data.sync_percent || 0) > 0 && (data.sync_percent || 0) < 100;

            // 3. Deve mostrar?
            // Mostra se estiver num estado de sync, OU se a porcentagem estiver rodando,
            // DESDE QUE a conexão não esteja desconectada (para não mostrar lixo de memória)
            if ((isSyncingState || isInProgress) && data.status !== 'disconnected') {
                setShow(true);
            } 
            // 4. Finalização Graciosa
            else if (data.sync_percent === 100 && show) {
                 setTimeout(() => setShow(false), 5000); // 5s para o usuário ver o 100%
            }
        }
    };

    // Polling agressivo (1s) para garantir fluidez visual da barra
    fetchDirectStatus(); 
    intervalRef.current = setInterval(fetchDirectStatus, 1000);

    return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeInstance?.id, show]);

  if (!show) return null;

  const isComplete = localPercent >= 100;
  
  // Labels inteligentes baseados no status do Backend
  let statusLabel = 'Sincronizando...';
  let Icon = RefreshCw;

  switch (localStatus) {
      case 'importing_contacts':
          statusLabel = 'Importando Contatos';
          Icon = Users;
          break;
      case 'importing_messages':
          statusLabel = 'Baixando Histórico';
          Icon = MessageSquare;
          break;
      case 'processing_history':
          statusLabel = 'Organizando Chat';
          Icon = Database;
          break;
      case 'completed':
          statusLabel = 'Sincronização Concluída';
          Icon = CheckCircle2;
          break;
      default:
          // Fallback baseado na porcentagem
          if (localPercent < 20) statusLabel = 'Iniciando Motor...';
          else if (localPercent < 90) statusLabel = 'Sincronizando...';
          else statusLabel = 'Finalizando...';
          break;
  }

  return (
    // Z-Index Supremo (99999) para garantir que fique acima de qualquer Modal
    <div className="fixed bottom-6 right-6 z-[99999] pointer-events-auto">
      <div className="bg-[#09090b] border border-zinc-800 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] p-4 w-80 animate-in slide-in-from-bottom-10 fade-in duration-500 ring-1 ring-white/10 relative overflow-hidden">
        
        {/* Glow de fundo */}
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${isComplete ? 'via-emerald-500/50' : 'via-blue-500/50'} to-transparent opacity-50`} />

        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors duration-500 ${isComplete ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-600/10 text-blue-500'}`}>
               {isComplete ? (
                 <CheckCircle2 className="w-5 h-5" />
               ) : (
                 <Icon className={`w-5 h-5 ${localPercent < 100 ? 'animate-spin-slow' : ''}`} />
               )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white leading-none mb-1">
                {statusLabel}
              </span>
              <span className="text-[10px] text-zinc-400 font-medium">
                {isComplete ? 'Sistema pronto para uso.' : 'Mantenha esta janela aberta.'}
              </span>
            </div>
          </div>
          <span className={`text-lg font-mono font-bold transition-colors ${isComplete ? 'text-emerald-500' : 'text-white'}`}>
            {localPercent}%
          </span>
        </div>

        {/* Barra de Progresso Suave */}
        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden relative z-10">
            <div 
              className={`h-full transition-all duration-700 ease-out relative ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-600 to-cyan-400'}`}
              style={{ width: `${localPercent}%` }}
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
