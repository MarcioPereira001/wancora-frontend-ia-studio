
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { createClient } from '@/utils/supabase/client';
import { RefreshCw, CheckCircle2, Database, Users, MessageSquare, Radio, Loader2, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

export function GlobalSyncIndicator() {
  const { forcedSyncId, clearSyncAnimation, instances } = useRealtimeStore();
  const { user } = useAuthStore();
  const [show, setShow] = useState(false);
  const [isVisible, setIsVisible] = useState(false); 
  const [localPercent, setLocalPercent] = useState(0);
  const [localStatus, setLocalStatus] = useState<string>('waiting');
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closingRef = useRef(false); 

  // Lógica de Alvo: Usa o ID forçado (QR Code recente) OU procura um que esteja sincronizando em background
  const getTargetId = () => {
      if (forcedSyncId) return forcedSyncId;
      // Procura instância em estado de sync
      const syncingInstance = instances.find(i => 
          i.sync_status && 
          i.sync_status !== 'completed' && 
          i.sync_status !== 'waiting' &&
          i.status === 'connected'
      );
      return syncingInstance?.id || null;
  };

  const targetInstanceId = getTargetId();

  useEffect(() => {
    // Se não tem alvo e não estamos fechando
    if (!targetInstanceId) {
        if (show && !closingRef.current) {
             closingRef.current = true;
             setIsVisible(false);
             setTimeout(() => { 
                 setShow(false); 
                 closingRef.current = false; 
             }, 500);
        }
        return;
    }

    // Se achou um alvo, mostra a barra
    if (targetInstanceId && !show && !closingRef.current) {
        setShow(true);
        setTimeout(() => setIsVisible(true), 50);
        setLocalStatus('waiting'); 
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

            const isDone = dbSyncStatus === 'completed' || dbPercent >= 100;

            if (isDone) {
                setLocalPercent(100);
                setLocalStatus('completed');

                if (show && !closingRef.current) {
                    closingRef.current = true;
                    setTimeout(() => {
                        setIsVisible(false); 
                        setTimeout(() => {
                            setShow(false);
                            if(forcedSyncId) clearSyncAnimation(); 
                            closingRef.current = false;
                        }, 500);
                    }, 3000); // 3s de glória verde
                }
                return;
            }

            setLocalStatus(dbSyncStatus);
            setLocalPercent(dbPercent);

            if (data.status === 'disconnected') {
                if (!closingRef.current) {
                    setIsVisible(false);
                    setTimeout(() => {
                        setShow(false);
                        if(forcedSyncId) clearSyncAnimation();
                    }, 500);
                }
            }
        }
    };

    fetchDirectStatus(); 
    intervalRef.current = setInterval(fetchDirectStatus, 1500); // Polling menos agressivo

    return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [targetInstanceId, forcedSyncId, show, clearSyncAnimation]);

  if (!show) return null;

  const isComplete = localPercent >= 100 || localStatus === 'completed';
  
  let statusLabel = 'Conexão Estabelecida';
  let Icon = Radio;
  let subLabel = 'Aguardando dados...';
  
  switch (localStatus) {
      case 'waiting': 
          statusLabel = 'Iniciando Sessão';
          subLabel = 'Conectado! Preparando...';
          Icon = Loader2;
          break;
      case 'importing_contacts':
          statusLabel = 'Importando Contatos';
          subLabel = 'Organizando sua agenda...';
          Icon = Users;
          break;
      case 'importing_messages':
          statusLabel = 'Baixando Histórico';
          subLabel = 'Recuperando conversas...';
          Icon = MessageSquare;
          break;
      case 'processing_history':
          statusLabel = 'Processando Dados';
          subLabel = 'Finalizando importação...';
          Icon = Database;
          break;
      case 'completed':
          statusLabel = 'Tudo Pronto!';
          subLabel = 'Sincronização finalizada.';
          Icon = CheckCircle2;
          break;
      default:
          if (localPercent > 0) {
              statusLabel = 'Sincronizando...';
              Icon = HardDrive;
          }
          break;
  }

  return (
    <div className={cn(
        "fixed bottom-6 right-6 z-[99999] pointer-events-auto transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1)",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
    )}>
      <div className="bg-[#09090b] border border-zinc-800 rounded-xl shadow-[0_0_80px_rgba(0,0,0,0.8)] p-4 w-80 ring-1 ring-white/10 relative overflow-hidden backdrop-blur-2xl">
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${isComplete ? 'via-emerald-500' : 'via-blue-600'} to-transparent opacity-75`} />

        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors duration-500 ${isComplete ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-blue-400'}`}>
               {isComplete ? <CheckCircle2 className="w-5 h-5" /> : <Icon className={`w-5 h-5 ${localStatus === 'waiting' || localPercent < 100 ? 'animate-pulse' : ''}`} />}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-white leading-none mb-1 truncate">{statusLabel}</span>
              <span className="text-[10px] text-zinc-400 font-medium truncate max-w-[160px]">{subLabel}</span>
            </div>
          </div>
          <span className={`text-lg font-mono font-bold transition-colors ${isComplete ? 'text-emerald-500' : 'text-white'}`}>
            {localPercent}%
          </span>
        </div>

        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden relative z-10">
            <div 
              className={`h-full transition-all duration-700 ease-out relative ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-600 to-cyan-400'}`}
              style={{ width: `${Math.max(5, localPercent)}%` }} 
            >
                {!isComplete && <div className="absolute inset-0 bg-white/30 w-full animate-[shimmer_1s_infinite] -skew-x-12" />}
            </div>
        </div>
      </div>
    </div>
  );
}
