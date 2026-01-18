
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { createClient } from '@/utils/supabase/client';
import { RefreshCw, CheckCircle2, Database, Users, MessageSquare, Radio, Loader2, Map as MapIcon, HardDrive } from 'lucide-react';

export function GlobalSyncIndicator() {
  const { instances, forcedSyncId, clearSyncAnimation } = useRealtimeStore();
  const [show, setShow] = useState(false);
  const [localPercent, setLocalPercent] = useState(0);
  const [localStatus, setLocalStatus] = useState<string>('waiting');
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lógica Híbrida:
  // 1. Prioridade Absoluta: ID forçado pelo modal (Conexão Manual)
  // 2. Fallback: Qualquer instância conectada que não tenha terminado (F5 na página)
  const targetInstanceId = forcedSyncId || instances.find(i => 
      (i.status === 'connected' || i.status === 'connecting') && 
      i.status !== 'disconnected' &&
      i.sync_status !== 'completed'
  )?.id;

  useEffect(() => {
    // Se não tem alvo e não está mostrando, sai
    if (!targetInstanceId) {
        if (show && !forcedSyncId) {
             const timeout = setTimeout(() => { if(!targetInstanceId) setShow(false); }, 1000);
             return () => clearTimeout(timeout);
        }
        return;
    }

    // Se temos um ID forçado (Gatilho Manual), mostramos imediatamente
    if (forcedSyncId && !show) {
        setShow(true);
        setLocalStatus('waiting'); // Feedback instantâneo
        setLocalPercent(0);
    }

    const fetchDirectStatus = async () => {
        const supabase = createClient();
        
        const { data, error } = await supabase
            .from('instances')
            .select('sync_status, sync_percent, status')
            .eq('id', targetInstanceId)
            .single();

        if (data && !error) {
            const dbSyncStatus = data.sync_status || 'waiting';
            const dbPercent = data.sync_percent || 0;

            setLocalStatus(dbSyncStatus);
            setLocalPercent(dbPercent);

            // FINALIZAÇÃO
            if (dbSyncStatus === 'completed') {
                if (show) {
                    setLocalPercent(100);
                    setTimeout(() => {
                        setShow(false);
                        if(forcedSyncId) clearSyncAnimation(); // Limpa o gatilho manual
                    }, 4000);
                }
                return;
            }

            // EXIBIÇÃO CONTÍNUA
            // Se estamos num fluxo forçado OU o status é válido, mantém visível
            if (show || forcedSyncId || (data.status === 'connected' && dbSyncStatus !== 'completed')) {
                if (!show) setShow(true);
            } else if (data.status === 'disconnected') {
                setShow(false);
                if(forcedSyncId) clearSyncAnimation();
            }
        }
    };

    // Polling Agressivo
    fetchDirectStatus(); 
    intervalRef.current = setInterval(fetchDirectStatus, 1000);

    return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [targetInstanceId, forcedSyncId, show]);

  if (!show) return null;

  const isComplete = localPercent >= 100 || localStatus === 'completed';
  
  // Mapeamento Visual
  let statusLabel = 'Conexão Estabelecida';
  let Icon = Radio;
  let subLabel = 'Aguardando dados...';
  
  switch (localStatus) {
      case 'waiting': 
          statusLabel = 'Iniciando Sessão';
          subLabel = 'Conectado! Preparando download...';
          Icon = Loader2;
          break;
      case 'importing_contacts':
          statusLabel = 'Mapeando Contatos';
          subLabel = 'Identificando nomes e grupos...';
          Icon = Users;
          break;
      case 'importing_messages':
          statusLabel = 'Baixando Histórico';
          subLabel = 'Recuperando conversas recentes...';
          Icon = MessageSquare;
          break;
      case 'processing_history':
          statusLabel = 'Organizando CRM';
          subLabel = 'Indexando leads e mensagens...';
          Icon = Database;
          break;
      case 'completed':
          statusLabel = 'Tudo Pronto!';
          subLabel = 'Sincronização finalizada.';
          Icon = CheckCircle2;
          break;
      default:
          if (localPercent > 0) {
              statusLabel = 'Processando Dados';
              subLabel = 'Por favor, aguarde...';
              Icon = HardDrive;
          }
          break;
  }

  return (
    <div className="fixed bottom-6 right-6 z-[99999] pointer-events-auto">
      <div className="bg-[#09090b] border border-zinc-800 rounded-xl shadow-[0_0_80px_rgba(0,0,0,0.8)] p-4 w-80 animate-in slide-in-from-bottom-20 fade-in duration-500 ring-1 ring-white/10 relative overflow-hidden backdrop-blur-2xl">
        
        {/* Efeito de Fundo */}
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${isComplete ? 'via-emerald-500' : 'via-blue-600'} to-transparent opacity-75`} />

        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors duration-500 ${isComplete ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-blue-400'}`}>
               {isComplete ? (
                 <CheckCircle2 className="w-5 h-5" />
               ) : (
                 <Icon className={`w-5 h-5 ${localStatus === 'waiting' || localPercent < 100 ? 'animate-pulse' : ''}`} />
               )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-white leading-none mb-1 truncate">
                {statusLabel}
              </span>
              <span className="text-[10px] text-zinc-400 font-medium truncate max-w-[160px]">
                {subLabel}
              </span>
            </div>
          </div>
          <span className={`text-lg font-mono font-bold transition-colors ${isComplete ? 'text-emerald-500' : 'text-white'}`}>
            {localPercent}%
          </span>
        </div>

        {/* Barra de Progresso */}
        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden relative z-10">
            <div 
              className={`h-full transition-all duration-700 ease-out relative ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-600 to-cyan-400'}`}
              style={{ width: `${Math.max(5, localPercent)}%` }} 
            >
                {!isComplete && (
                    <div className="absolute inset-0 bg-white/30 w-full animate-[shimmer_1s_infinite] -skew-x-12" />
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
