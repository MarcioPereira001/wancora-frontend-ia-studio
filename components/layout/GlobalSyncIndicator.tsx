
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { createClient } from '@/utils/supabase/client';
import { CheckCircle2, Loader2, DownloadCloud, Database, Wifi, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export function GlobalSyncIndicator() {
  const { forcedSyncId, clearSyncAnimation } = useRealtimeStore();
  const [isVisible, setIsVisible] = useState(false);
  
  // Estado Visual
  const [percent, setPercent] = useState(0);
  const [statusLabel, setStatusLabel] = useState('Iniciando Protocolo');
  const [subLabel, setSubLabel] = useState('Estabelecendo conexão segura...');
  const [isComplete, setIsComplete] = useState(false);
  const [currentIcon, setCurrentIcon] = useState<'loader' | 'cloud' | 'db' | 'check' | 'wifi' | 'shield'>('loader');

  // Refs de Controle
  const progressRef = useRef(0);
  const simulationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const safetyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- 1. START / STOP ---
  useEffect(() => {
    if (forcedSyncId) {
      startSync();
    } else {
      closeSync();
    }

    return () => cleanup();
  }, [forcedSyncId]);

  // --- 2. ENGINE DE SIMULAÇÃO + REALTIME ---
  const startSync = () => {
    setIsVisible(true);
    setIsComplete(false);
    progressRef.current = 0;
    setPercent(0);
    
    // Configura Roteiro Visual
    setStatusLabel("Conectando");
    setSubLabel("Aguardando handshake...");
    setCurrentIcon('wifi');

    // A. Simulação de Progresso (Fake Loading inteligente)
    // Incrementa aleatoriamente até 90% para dar sensação de velocidade
    simulationInterval.current = setInterval(() => {
      setPercent((prev) => {
        // Se já acabou, não faz nada
        if (prev >= 90) return 90;
        
        // Se chegou em 90% via simulação, espera o real ou o timeout
        if (prev >= 80) return 80;

        // Incremento variável (0.2 a 1.5) para parecer natural
        const jump = Math.random() * 1.3 + 0.2;
        const next = prev + jump;
        
        // Atualiza labels baseado no progresso simulado
        updateLabels(next);
        
        return next;
      });
    }, 150); // 15FPS aprox para suavidade

    // B. Polling Real (Supabase) - A cada 1s
    pollingInterval.current = setInterval(checkRealStatus, 1000);

    // C. Safety Kill Switch (45 segundos máximo)
    // Se o backend morrer, libera o usuário.
    safetyTimeout.current = setTimeout(() => {
        console.warn("[SYNC] Timeout de segurança atingido. Forçando conclusão.");
        finishSync(true); 
    }, 45000);
  };

  const updateLabels = (val: number) => {
      if (val > 20 && val < 40) {
          setStatusLabel("Baixando Dados");
          setSubLabel("Recuperando contatos...");
          setCurrentIcon('cloud');
      } else if (val > 40 && val < 70) {
          setStatusLabel("Processando");
          setSubLabel("Organizando mensagens...");
          setCurrentIcon('db');
      } else if (val > 70 && val < 90) {
          setStatusLabel("Finalizando");
          setSubLabel("Criptografando base local...");
          setCurrentIcon('shield');
      }
  };

  const checkRealStatus = async () => {
    if (!forcedSyncId) return;

    const supabase = createClient();
    const { data } = await supabase
        .from('instances')
        .select('sync_status, sync_percent, status')
        .eq('id', forcedSyncId)
        .single();

    if (data) {
        // Se desconectou, erro
        if (data.status === 'disconnected') {
            setStatusLabel("Falha na Conexão");
            setSubLabel("Tentando reconectar...");
            cleanup();
            setTimeout(() => clearSyncAnimation(), 3000);
            return;
        }

        // Se completou REAL
        if (data.sync_status === 'completed') {
            finishSync();
            return;
        }

        // Se o progresso REAL for maior que o simulado, pula para o real
        if (data.sync_percent && data.sync_percent > percent) {
            setPercent(data.sync_percent);
        }
    }
  };

  const finishSync = (forced = false) => {
      cleanup(); // Para simulação e polling
      
      setPercent(100);
      setIsComplete(true);
      setCurrentIcon('check');
      setStatusLabel(forced ? "Sincronização Finalizada" : "Tudo Pronto!");
      setSubLabel("Sistema operacional ativo.");

      // Fecha modal após 2.5s de exibição do sucesso
      setTimeout(() => {
          clearSyncAnimation();
      }, 2500);
  };

  const closeSync = () => {
      setIsVisible(false);
      cleanup();
  };

  const cleanup = () => {
      if (simulationInterval.current) clearInterval(simulationInterval.current);
      if (pollingInterval.current) clearInterval(pollingInterval.current);
      if (safetyTimeout.current) clearTimeout(safetyTimeout.current);
  };

  if (!forcedSyncId && !isVisible) return null;

  // Lógica de Cor da Barra
  let barColor = 'bg-blue-600';
  if (isComplete) barColor = 'bg-emerald-500 shadow-[0_0_15px_#10b981]';
  else if (percent > 80) barColor = 'bg-purple-500';
  else if (percent < 20) barColor = 'bg-yellow-500';

  return (
    <div className={cn(
        "fixed bottom-6 right-6 z-[99999] pointer-events-auto transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1)",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none"
    )}>
      <div className="bg-[#09090b] border border-zinc-800 rounded-xl shadow-[0_0_80px_rgba(0,0,0,0.8)] p-5 w-96 ring-1 ring-white/10 relative overflow-hidden backdrop-blur-2xl">
        
        {/* Glow Topo */}
        <div className={cn(
            "absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent to-transparent opacity-75 transition-colors duration-500",
            isComplete ? "via-emerald-500" : "via-blue-600"
        )} />

        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className={cn(
                "p-3 rounded-xl transition-all duration-500 shadow-inner border",
                isComplete 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
                    : "bg-zinc-800 border-zinc-700/50 text-zinc-400"
            )}>
               {currentIcon === 'loader' && <Loader2 className="w-6 h-6 animate-spin" />}
               {currentIcon === 'cloud' && <DownloadCloud className="w-6 h-6 animate-bounce" />}
               {currentIcon === 'db' && <Database className="w-6 h-6 animate-pulse" />}
               {currentIcon === 'wifi' && <Wifi className="w-6 h-6 animate-pulse" />}
               {currentIcon === 'shield' && <ShieldCheck className="w-6 h-6 text-purple-400" />}
               {currentIcon === 'check' && <CheckCircle2 className="w-6 h-6" />}
            </div>
            <div className="flex flex-col min-w-0">
              <span className={cn(
                  "text-base font-bold leading-tight mb-1 truncate transition-colors",
                  isComplete ? "text-emerald-400" : "text-white"
              )}>
                {statusLabel}
              </span>
              <span className="text-xs text-zinc-400 font-medium truncate max-w-[180px] animate-pulse">
                {subLabel}
              </span>
            </div>
          </div>
          <span className={cn(
              "text-2xl font-mono font-bold transition-colors",
              isComplete ? "text-emerald-500" : "text-white"
          )}>
            {Math.floor(percent)}%
          </span>
        </div>

        {/* Barra de Progresso */}
        <div className="h-2 w-full bg-zinc-800/80 rounded-full overflow-hidden relative z-10 border border-zinc-700/50">
            <div 
              className={cn("h-full transition-all duration-200 ease-linear relative", barColor)}
              style={{ width: `${Math.max(5, percent)}%` }} 
            >
                {!isComplete && (
                    <div className="absolute inset-0 bg-white/40 w-full animate-[shimmer_1.5s_infinite] -skew-x-12" />
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
