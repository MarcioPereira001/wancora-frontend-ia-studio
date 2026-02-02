
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { createClient } from '@/utils/supabase/client';
import { CheckCircle2, Loader2, Hourglass, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function GlobalSyncIndicator() {
  const { forcedSyncId, clearSyncAnimation } = useRealtimeStore();
  const [show, setShow] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
  // Estado puramente visual controlado por timer
  const [displayPercent, setDisplayPercent] = useState(0);
  const [statusLabel, setStatusLabel] = useState('Preparando Ambiente');
  const [isComplete, setIsComplete] = useState(false);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closingRef = useRef(false);

  // --- CICLO DE VIDA RÍGIDO (20 SEGUNDOS) ---
  useEffect(() => {
    // 1. FECHAR (Limpeza)
    if (!forcedSyncId) {
        if (show && !closingRef.current) {
             closingRef.current = true;
             setIsVisible(false);
             setTimeout(() => { 
                 setShow(false); 
                 closingRef.current = false; 
                 setDisplayPercent(0); 
                 setIsComplete(false);
             }, 500);
        }
        return;
    }

    // 2. ABRIR E INICIAR TIMER (Apenas se não estiver aberto)
    if (forcedSyncId && !show) {
        setShow(true);
        setTimeout(() => setIsVisible(true), 50);
        
        setDisplayPercent(0);
        setStatusLabel('Sincronizando Histórico');
        setIsComplete(false);
        
        // Duração Total: 20 segundos (20000ms)
        // Intervalo de atualização: 200ms
        // Passo: 100 / (20000/200) = 1% a cada tick
        const TOTAL_DURATION = 20000;
        const INTERVAL = 200;
        const STEP = 1; 

        if (timerRef.current) clearInterval(timerRef.current);

        timerRef.current = setInterval(() => {
            setDisplayPercent(prev => {
                const next = prev + STEP;
                
                // --- PONTO DE CORTE OBRIGATÓRIO ---
                if (next >= 100) {
                    if(timerRef.current) clearInterval(timerRef.current);
                    
                    // Finalização Visual Forçada
                    setIsComplete(true);
                    setStatusLabel('Concluído');
                    
                    // Fecha após 1.5s mostrando "100%"
                    setTimeout(() => {
                        closingRef.current = true;
                        setIsVisible(false);
                        setTimeout(() => {
                            setShow(false);
                            clearSyncAnimation(); // Libera a store
                            closingRef.current = false;
                        }, 500);
                    }, 1500);
                    
                    return 100;
                }
                return next;
            });
        }, INTERVAL);
    }

    // 3. MONITORAMENTO DE ERRO (Safety Check apenas)
    // Se a conexão cair no meio, abortamos para não enganar o usuário
    const checkConnection = async () => {
        if (!forcedSyncId) return;
        const supabase = createClient();
        const { data } = await supabase.from('instances').select('status').eq('id', forcedSyncId).single();
        
        if (data?.status === 'disconnected') {
            if (timerRef.current) clearInterval(timerRef.current);
            setStatusLabel('Conexão Perdida');
            setTimeout(() => { clearSyncAnimation(); }, 2000);
        }
    };
    // Verifica conexão a cada 2s só por segurança
    const safetyInterval = setInterval(checkConnection, 2000);

    return () => { 
        if (timerRef.current) clearInterval(timerRef.current);
        clearInterval(safetyInterval);
    };
  }, [forcedSyncId, show, clearSyncAnimation]);

  if (!show) return null;

  // Cor da Barra: Neutra (Slate) durante processo, Verde no final
  const barColor = isComplete ? 'bg-emerald-500' : 'bg-slate-500';
  const Icon = isComplete ? CheckCircle2 : Hourglass;
  const iconColor = isComplete ? 'text-emerald-500' : 'text-slate-400';
  const iconBg = isComplete ? 'bg-emerald-500/10' : 'bg-zinc-800';

  return (
    <div className={cn(
        "fixed bottom-6 right-6 z-[99999] pointer-events-auto transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1)",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
    )}>
      <div className="bg-[#09090b] border border-zinc-800 rounded-xl shadow-[0_0_80px_rgba(0,0,0,0.8)] p-5 w-96 ring-1 ring-white/10 relative overflow-hidden backdrop-blur-2xl">
        
        {/* Glow Topo */}
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${isComplete ? 'via-emerald-500' : 'via-slate-500'} to-transparent opacity-75`} />

        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl transition-colors duration-500 shadow-inner ${iconBg} ${iconColor}`}>
               <Icon className={`w-6 h-6 ${!isComplete ? 'animate-pulse' : ''}`} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold text-white leading-tight mb-1 truncate">
                {statusLabel}
              </span>
              <span className="text-xs text-zinc-400 font-medium truncate max-w-[180px]">
                {isComplete ? 'Download em background...' : 'Organizando dados...'}
              </span>
            </div>
          </div>
          <span className={`text-2xl font-mono font-bold transition-colors ${isComplete ? 'text-emerald-500' : 'text-zinc-500'}`}>
            {displayPercent}%
          </span>
        </div>

        {/* Barra de Progresso */}
        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden relative z-10">
            <div 
              className={`h-full transition-all duration-200 ease-linear relative ${barColor}`}
              style={{ width: `${Math.max(5, displayPercent)}%` }} 
            >
                {!isComplete && (
                    <div className="absolute inset-0 bg-white/10 w-full animate-[shimmer_1.5s_infinite] -skew-x-12" />
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
