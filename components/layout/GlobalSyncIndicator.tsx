
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { createClient } from '@/utils/supabase/client';
import { CheckCircle2, Loader2, Hourglass, DownloadCloud, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';

export function GlobalSyncIndicator() {
  const { forcedSyncId, clearSyncAnimation } = useRealtimeStore();
  const [show, setShow] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
  // Estado Visual
  const [displayPercent, setDisplayPercent] = useState(0);
  const [statusLabel, setStatusLabel] = useState('Preparando Ambiente');
  const [subLabel, setSubLabel] = useState('Aguardando dados...');
  const [isComplete, setIsComplete] = useState(false);

  // Refs para controle da animação sem re-render desnecessário
  const currentPercentRef = useRef(0);
  const targetPercentRef = useRef(0);
  const closingRef = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // --- LÓGICA DE ANIMAÇÃO (Game Loop) ---
  const animate = () => {
    if (closingRef.current) return;

    // Distância até o alvo
    const diff = targetPercentRef.current - currentPercentRef.current;
    
    // Se a diferença for muito pequena, arredonda
    if (diff > 0 && diff < 0.1) {
        currentPercentRef.current = targetPercentRef.current;
    } else if (diff > 0) {
        // Velocidade: Queremos cobrir a diferença em ~5 segundos (assumindo 60fps = 300 frames)
        // Mas para ser seguro e não parar antes, usamos um divisor menor para "perseguir" o alvo
        // Divisor 100 dá uma sensação de inércia boa
        const step = diff / 100; 
        // Garante um movimento mínimo para não estagnar
        currentPercentRef.current += Math.max(step, 0.05);
    }
    
    // Trava em 100
    if (currentPercentRef.current > 100) currentPercentRef.current = 100;

    // Atualiza estado React para renderizar
    setDisplayPercent(currentPercentRef.current);

    // Continua o loop
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // --- BUSCA DE DADOS (POLLING 5s) ---
  const fetchStatus = async () => {
    if (!forcedSyncId || closingRef.current) return;

    const supabase = createClient();
    const { data } = await supabase
        .from('instances')
        .select('sync_status, sync_percent, status')
        .eq('id', forcedSyncId)
        .single();

    if (data) {
        // Se desconectou, aborta
        if (data.status === 'disconnected') {
             setStatusLabel('Erro de Conexão');
             targetPercentRef.current = 100; // Força fechar para não travar a tela
             return;
        }

        // Define o novo alvo baseado no banco
        let newTarget = data.sync_percent || 0;
        
        // Se completou no banco, alvo é 100
        if (data.sync_status === 'completed') {
            newTarget = 100;
            setStatusLabel('Finalizando...');
        } else if (data.sync_status === 'importing_messages') {
            setStatusLabel('Baixando Histórico');
            setSubLabel('Recuperando conversas antigas...');
        } else {
            setStatusLabel('Preparando Ambiente');
        }

        // Só atualiza se for maior (nunca volta a barra)
        if (newTarget > targetPercentRef.current) {
            targetPercentRef.current = newTarget;
        }
    }
  };

  // --- GATILHO DE FECHAMENTO (Regra Obrigatória) ---
  useEffect(() => {
      // Se visualmente chegou a 99.5% ou mais, consideramos 100% e fechamos
      if (displayPercent >= 99.5 && !closingRef.current) {
          setIsComplete(true);
          setStatusLabel('Histórico 100% Concluído');
          setSubLabel('Tudo pronto!');
          closingRef.current = true;

          // Cleanup imediato dos timers
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

          // Delay para o usuário ver o "100%" verde
          setTimeout(() => {
              setIsVisible(false);
              setTimeout(() => {
                  setShow(false);
                  clearSyncAnimation();
                  closingRef.current = false;
                  // Reseta refs
                  currentPercentRef.current = 0;
                  targetPercentRef.current = 0;
              }, 500);
          }, 2000);
      }
  }, [displayPercent, clearSyncAnimation]);

  // --- CICLO DE VIDA (INIT) ---
  useEffect(() => {
    if (!forcedSyncId) {
        if (show && !closingRef.current) {
             // Fecha se perder o ID externamente
             closingRef.current = true;
             setIsVisible(false);
             setTimeout(() => { setShow(false); clearSyncAnimation(); closingRef.current = false; }, 500);
        }
        return;
    }

    if (forcedSyncId && !show) {
        // Reset Inicial
        setShow(true);
        setTimeout(() => setIsVisible(true), 50);
        
        currentPercentRef.current = 0;
        targetPercentRef.current = 0;
        setDisplayPercent(0);
        setStatusLabel('Iniciando Sincronização');
        setSubLabel('Aguarde...');
        setIsComplete(false);
        closingRef.current = false;

        // Inicia Loop de Animação
        animationFrameRef.current = requestAnimationFrame(animate);

        // Inicia Polling a cada 5 segundos
        pollIntervalRef.current = setInterval(fetchStatus, 5000);
    }

    return () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [forcedSyncId, show, clearSyncAnimation]);

  if (!show) return null;

  // Definição de Cores e Ícones
  let barColor = 'bg-slate-500';
  let Icon = Loader2;
  
  if (isComplete) {
      barColor = 'bg-emerald-500';
      Icon = CheckCircle2;
  } else if (displayPercent > 5) {
      barColor = 'bg-gradient-to-r from-blue-600 to-cyan-400';
      Icon = DownloadCloud;
  } else {
      barColor = 'bg-slate-500';
      Icon = Hourglass;
  }

  return (
    <div className={cn(
        "fixed bottom-6 right-6 z-[99999] pointer-events-auto transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1)",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
    )}>
      <div className="bg-[#09090b] border border-zinc-800 rounded-xl shadow-[0_0_80px_rgba(0,0,0,0.8)] p-5 w-96 ring-1 ring-white/10 relative overflow-hidden backdrop-blur-2xl">
        
        {/* Glow Topo */}
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${isComplete ? 'via-emerald-500' : 'via-blue-600'} to-transparent opacity-75`} />

        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl transition-colors duration-500 shadow-inner ${isComplete ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-blue-400'}`}>
               <Icon className={`w-6 h-6 ${!isComplete ? 'animate-pulse' : ''}`} />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-base font-bold text-white leading-tight mb-1 truncate">
                {statusLabel}
              </span>
              <span className="text-xs text-zinc-400 font-medium truncate max-w-[180px]">
                {subLabel}
              </span>
            </div>
          </div>
          <span className={`text-2xl font-mono font-bold transition-colors ${isComplete ? 'text-emerald-500' : 'text-white'}`}>
            {Math.floor(displayPercent)}%
          </span>
        </div>

        {/* Barra de Progresso */}
        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden relative z-10">
            <div 
              className={`h-full transition-all duration-100 ease-linear relative ${barColor}`}
              style={{ width: `${Math.max(5, displayPercent)}%` }} 
            >
                {!isComplete && (
                    <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_1.5s_infinite] -skew-x-12" />
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
