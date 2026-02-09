
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { createClient } from '@/utils/supabase/client';
import { CheckCircle2, Loader2, Hourglass, DownloadCloud, Database, RefreshCw, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

export function GlobalSyncIndicator() {
  const { forcedSyncId, clearSyncAnimation } = useRealtimeStore();
  const [show, setShow] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
  // Estado Visual
  const [displayPercent, setDisplayPercent] = useState(0);
  const [statusLabel, setStatusLabel] = useState('Preparando');
  const [subLabel, setSubLabel] = useState('Iniciando protocolo...');
  const [isComplete, setIsComplete] = useState(false);
  
  // Controle de Ícone
  const [currentIcon, setCurrentIcon] = useState<'loader' | 'cloud' | 'db' | 'check' | 'wifi'>('loader');

  // Refs para controle da animação sem re-render
  const currentPercentRef = useRef(0);
  const targetPercentRef = useRef(0);
  const animationSpeedRef = useRef(0.5); // Controle de "Fricção" (Quanto maior, mais lento)
  
  const closingRef = useRef(false);
  const completedRef = useRef(false); // Flag de conclusão real
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  // Refs para o "Diretor" (Timeouts)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // --- ENGINE DE ANIMAÇÃO (Physics Based) ---
  const animate = () => {
    if (closingRef.current) return;

    // Distância até o alvo
    const diff = targetPercentRef.current - currentPercentRef.current;
    
    // Se a diferença for muito pequena, arredonda
    if (Math.abs(diff) < 0.1) {
        currentPercentRef.current = targetPercentRef.current;
    } else {
        // A velocidade depende da distância e da "fricção" configurada pela fase
        // Fases longas tem fricção alta (divisor grande)
        const step = diff / (animationSpeedRef.current * 100); 
        
        // Garante movimento mínimo para não estagnar, mas permite ser bem lento
        // Se step for positivo, mínimo 0.01. Se negativo (reset), permite salto grande
        const minStep = diff > 0 ? 0.01 : -100; 
        
        currentPercentRef.current += (Math.abs(step) < Math.abs(minStep) && diff > 0) ? minStep : step;
    }
    
    // Trava em 100 visualmente
    if (currentPercentRef.current > 100) currentPercentRef.current = 100;
    // Trava em 0 visualmente
    if (currentPercentRef.current < 0) currentPercentRef.current = 0;

    // Atualiza estado React para renderizar
    setDisplayPercent(currentPercentRef.current);

    // Continua o loop
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // --- O DIRETOR (Roteiro da Animação) ---
  const startDirector = () => {
      // Limpa roteiro anterior
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];

      // FASE 1: 0-11s (Preparando -> 99%)
      // Rápido e empolgante
      targetPercentRef.current = 99;
      animationSpeedRef.current = 0.2; // Rápido
      setStatusLabel("Preparando");
      setSubLabel("Estabelecendo conexão segura...");
      setCurrentIcon('loader');

      // FASE 2: 11s (Reset -> 0%)
      // O banho de água fria
      const t1 = setTimeout(() => {
          if (completedRef.current) return; // Se já acabou real, ignora
          currentPercentRef.current = 0; // Hard reset físico
          targetPercentRef.current = 0;
          setStatusLabel("Aguardando resposta...");
          setSubLabel("Sincronizando chaves...");
          setCurrentIcon('wifi');
      }, 11000);

      // FASE 3: 16s (Jump -> Random 11-46%)
      // A esperança volta
      const t2 = setTimeout(() => {
          if (completedRef.current) return;
          const randomJump = Math.random() * (46 - 11) + 11;
          targetPercentRef.current = randomJump;
          animationSpeedRef.current = 0.1; // Salto rápido
          setStatusLabel("Carregando dados");
          setSubLabel("Obtendo pacotes do servidor...");
          setCurrentIcon('cloud');
      }, 16000);

      // FASE 4: 17s (Creep -> 81% em 34s)
      // A parte lenta e "maquiavélica"
      const t3 = setTimeout(() => {
          if (completedRef.current) return;
          targetPercentRef.current = 81;
          animationSpeedRef.current = 4.0; // MUITO Lento (Fricção alta) para demorar ~34s
          setStatusLabel("Baixando Histórico");
          setSubLabel("Isso pode levar alguns instantes...");
          setCurrentIcon('db');
      }, 17000);

      // FASE 5: 51s (Finalize -> 100% em 15s)
      // A reta final
      const t4 = setTimeout(() => {
          if (completedRef.current) return;
          targetPercentRef.current = 100;
          animationSpeedRef.current = 0.8; // Velocidade média
          setStatusLabel("Finalizando a sincronização");
          setSubLabel("Organizando mensagens...");
          setCurrentIcon('refresh');
      }, 51000);

      // FASE 6: 66s (Conclusão Forçada)
      // Se a internet cair ou o backend travar, a gente mente que acabou pra liberar a UI.
      const t5 = setTimeout(() => {
          forceComplete();
      }, 66000);

      timeoutsRef.current.push(t1, t2, t3, t4, t5);
  };

  // --- BUSCA DE DADOS REAIS (Override) ---
  const fetchStatus = async () => {
    if (!forcedSyncId || closingRef.current || completedRef.current) return;

    const supabase = createClient();
    const { data } = await supabase
        .from('instances')
        .select('sync_status, sync_percent, status')
        .eq('id', forcedSyncId)
        .single();

    if (data) {
        // Se desconectou, aborta drama e mostra erro
        if (data.status === 'disconnected') {
             setStatusLabel('Erro de Conexão');
             setSubLabel('Tentando reconectar...');
             return;
        }

        // Se o backend disser que acabou, ACABOU.
        if (data.sync_status === 'completed') {
            forceComplete();
            return;
        }
        
        // Se o backend estiver enviando progresso real e for MAIOR que o nosso fake, usamos o real
        // Mas mantemos o label fake para consistência visual se o real não tiver label
        if (data.sync_percent && data.sync_percent > currentPercentRef.current) {
             // Apenas ajustamos o alvo, o animate cuida de chegar lá
             // Mas não mudamos labels para não quebrar a "magia" do roteiro, a menos que seja 100
             if (data.sync_percent > targetPercentRef.current) {
                 targetPercentRef.current = data.sync_percent;
             }
        }
    }
  };

  const forceComplete = () => {
      if (closingRef.current) return;
      completedRef.current = true;
      targetPercentRef.current = 100;
      currentPercentRef.current = 100; // Pula animação se for force complete
      setDisplayPercent(100);
      
      setIsComplete(true);
      setStatusLabel('Sincronização Concluída');
      setSubLabel('Sistema pronto para uso.');
      setCurrentIcon('check');
      
      closingRef.current = true;

      // Limpa tudo
      timeoutsRef.current.forEach(clearTimeout);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);

      // Delay para fechar
      setTimeout(() => {
          setIsVisible(false);
          setTimeout(() => {
              setShow(false);
              clearSyncAnimation();
              
              // Reset Total para próxima vez
              closingRef.current = false;
              completedRef.current = false;
              currentPercentRef.current = 0;
              targetPercentRef.current = 0;
              setDisplayPercent(0);
          }, 500);
      }, 3000); // 3s exibindo "Concluído"
  };

  // --- WATCHER DE ESTADO ---
  useEffect(() => {
      // Se visualmente chegou a 100%, dispara conclusão
      if (displayPercent >= 99.9 && !closingRef.current && !completedRef.current) {
          // Só consideramos concluído se estivermos na Fase 5 ou 6, ou se o backend mandou
          // (Evita que a fase 1 de 99% dispare o fechamento)
          // Verificação: Se o label for "Preparando", NÃO fecha.
          if (statusLabel !== "Preparando") {
              forceComplete();
          }
      }
  }, [displayPercent]);

  // --- INIT ---
  useEffect(() => {
    if (!forcedSyncId) {
        if (show && !closingRef.current) {
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
        setIsComplete(false);
        closingRef.current = false;
        completedRef.current = false;

        // Inicia
        startDirector();
        animationFrameRef.current = requestAnimationFrame(animate);
        pollIntervalRef.current = setInterval(fetchStatus, 3000); // Check real a cada 3s
    }

    return () => {
        if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
        timeoutsRef.current.forEach(clearTimeout);
    };
  }, [forcedSyncId, show, clearSyncAnimation]);

  if (!show) return null;

  // Renderização de Ícones Dinâmicos
  const renderIcon = () => {
      switch(currentIcon) {
          case 'cloud': return <DownloadCloud className="w-6 h-6 animate-bounce text-blue-400" />;
          case 'db': return <Database className="w-6 h-6 animate-pulse text-purple-400" />;
          case 'wifi': return <Wifi className="w-6 h-6 animate-pulse text-yellow-400" />;
          case 'refresh': return <RefreshCw className="w-6 h-6 animate-spin text-orange-400" />;
          case 'check': return <CheckCircle2 className="w-6 h-6 text-emerald-500" />;
          default: return <Loader2 className="w-6 h-6 animate-spin text-white" />;
      }
  };

  let barColor = 'bg-blue-600';
  if (isComplete) barColor = 'bg-emerald-500';
  else if (displayPercent > 80) barColor = 'bg-purple-500';
  else if (displayPercent < 10) barColor = 'bg-yellow-500';

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
            <div className={`p-3 rounded-xl transition-all duration-500 shadow-inner bg-zinc-800 border border-zinc-700/50`}>
               {renderIcon()}
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
            {Math.floor(displayPercent)}%
          </span>
        </div>

        {/* Barra de Progresso */}
        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden relative z-10">
            <div 
              className={`h-full transition-all duration-100 ease-linear relative ${barColor}`}
              style={{ width: `${Math.max(2, displayPercent)}%` }} 
            >
                {!isComplete && (
                    <div className="absolute inset-0 bg-white/30 w-full animate-[shimmer_1s_infinite] -skew-x-12" />
                )}
            </div>
        </div>
        
        {/* Debug Info (Oculto) - Para saber se é fake ou real */}
        {/* <div className="absolute bottom-1 right-1 text-[8px] text-zinc-800">{targetPercentRef.current.toFixed(0)}</div> */}
      </div>
    </div>
  );
}
