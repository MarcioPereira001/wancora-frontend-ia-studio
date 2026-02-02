
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { createClient } from '@/utils/supabase/client';
import { RefreshCw, CheckCircle2, Database, Users, MessageSquare, Radio, Loader2, HardDrive, DownloadCloud } from 'lucide-react';
import { cn } from '@/lib/utils';

export function GlobalSyncIndicator() {
  const { forcedSyncId, clearSyncAnimation } = useRealtimeStore();
  const [show, setShow] = useState(false);
  const [isVisible, setIsVisible] = useState(false); // Controle de Animação CSS
  const [localPercent, setLocalPercent] = useState(0);
  const [localStatus, setLocalStatus] = useState<string>('waiting');
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closingRef = useRef(false); // Lock para evitar múltiplos triggers de fechamento

  // MODIFICAÇÃO CRÍTICA:
  // O indicador obedece estritamente ao 'forcedSyncId' gerado pelo QR Code.
  const targetInstanceId = forcedSyncId;

  useEffect(() => {
    // Se não tem alvo e não estamos em processo de fechamento, garante que esteja fechado
    if (!targetInstanceId) {
        if (show && !forcedSyncId && !closingRef.current) {
             // Animação de saída se perdeu o alvo abruptamente
             closingRef.current = true;
             setIsVisible(false);
             setTimeout(() => { 
                 setShow(false); 
                 closingRef.current = false; 
                 setLocalPercent(0); 
             }, 500);
        }
        return;
    }

    // Se temos um ID forçado (Gatilho Manual), mostramos imediatamente
    if (forcedSyncId && !show) {
        setShow(true);
        setTimeout(() => setIsVisible(true), 50); // Animação de entrada
        setLocalStatus('waiting'); 
        setLocalPercent(1); // Inicia com 1% para feedback visual imediato
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
            let dbPercent = data.sync_percent || 0;

            // --- LÓGICA DE UX "SMOOTH LOADER" ---
            // 1. O 'completed' é a única verdade absoluta.
            const isReallyDone = dbSyncStatus === 'completed';

            // 2. Se não acabou, travamos visualmente em 99% mesmo que o cálculo matemático tenha estourado.
            // Isso evita que o usuário ache que travou no 100% ou que o modal feche antes da hora.
            if (!isReallyDone && dbPercent >= 100) {
                dbPercent = 99;
            }

            // 3. Garantimos que a porcentagem nunca retroceda visualmente (Monotonic Increase)
            if (dbPercent > localPercent) {
                setLocalPercent(dbPercent);
            }

            // --- FINALIZAÇÃO ---
            if (isReallyDone) {
                setLocalPercent(100);
                setLocalStatus('completed');

                // FINALIZAÇÃO AUTOMÁTICA (Com delay para leitura)
                if (show && !closingRef.current) {
                    closingRef.current = true;
                    console.log("✅ [Sync] Concluído 100%. Iniciando fechamento suave...");

                    // Mantém visível por 4 segundos para usuário ver o 100% verde e a mensagem de sucesso
                    setTimeout(() => {
                        setIsVisible(false); // Trigger CSS Exit
                        
                        // Desmonta após animação CSS (500ms)
                        setTimeout(() => {
                            setShow(false);
                            if(forcedSyncId) clearSyncAnimation(); 
                            closingRef.current = false;
                        }, 500);
                    }, 4000);
                }
                return;
            }

            // --- EM ANDAMENTO ---
            setLocalStatus(dbSyncStatus);

            // Se desconectou abruptamente (Erro/Banimento/Queda), fecha rápido para não ficar preso
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

    // Polling Agressivo (1s) para sensação de tempo real
    fetchDirectStatus(); 
    intervalRef.current = setInterval(fetchDirectStatus, 1000);

    return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [targetInstanceId, forcedSyncId, show, clearSyncAnimation]); // localPercent removido das deps para evitar loop

  if (!show) return null;

  const isComplete = localStatus === 'completed';
  
  // Mapeamento Visual Rico
  let statusLabel = 'Conexão Estabelecida';
  let Icon = Radio;
  let subLabel = 'Aguardando dados...';
  
  switch (localStatus) {
      case 'waiting': 
          statusLabel = 'Aguardando WhatsApp';
          subLabel = 'Estabelecendo túnel seguro...';
          Icon = Loader2;
          break;
      case 'importing_contacts':
          statusLabel = 'Sincronizando Agenda';
          subLabel = 'Baixando contatos e grupos...';
          Icon = Users;
          break;
      case 'importing_messages':
          statusLabel = 'Baixando Conversas';
          subLabel = 'Recuperando histórico de chat...';
          Icon = DownloadCloud;
          break;
      case 'processing_history':
          statusLabel = 'Organizando CRM';
          subLabel = 'Criando leads e indexando...';
          Icon = Database;
          break;
      case 'completed':
          statusLabel = 'Sincronização Completa!';
          subLabel = 'Seu histórico está pronto.';
          Icon = CheckCircle2;
          break;
      default:
          if (localPercent > 0) {
              statusLabel = 'Processando Dados';
              subLabel = 'Isso pode levar alguns minutos...';
              Icon = HardDrive;
          }
          break;
  }

  return (
    <div className={cn(
        "fixed bottom-6 right-6 z-[99999] pointer-events-auto transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1)",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
    )}>
      <div className="bg-[#09090b] border border-zinc-800 rounded-xl shadow-[0_0_80px_rgba(0,0,0,0.8)] p-5 w-96 ring-1 ring-white/10 relative overflow-hidden backdrop-blur-2xl">
        
        {/* Efeito de Fundo */}
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${isComplete ? 'via-emerald-500' : 'via-blue-600'} to-transparent opacity-75`} />

        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl transition-colors duration-500 shadow-inner ${isComplete ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-blue-400'}`}>
               {isComplete ? (
                 <CheckCircle2 className="w-6 h-6" />
               ) : (
                 <Icon className={`w-6 h-6 ${localStatus === 'waiting' || localPercent < 100 ? 'animate-pulse' : ''}`} />
               )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold text-white leading-tight mb-1 truncate">
                {statusLabel}
              </span>
              <span className="text-xs text-zinc-400 font-medium truncate max-w-[180px] animate-pulse">
                {subLabel}
              </span>
            </div>
          </div>
          <span className={`text-2xl font-mono font-bold transition-colors ${isComplete ? 'text-emerald-500' : 'text-white'}`}>
            {localPercent}%
          </span>
        </div>

        {/* Barra de Progresso */}
        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden relative z-10">
            <div 
              className={`h-full transition-all duration-1000 ease-out relative ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-600 to-cyan-400'}`}
              style={{ width: `${Math.max(2, localPercent)}%` }} 
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
