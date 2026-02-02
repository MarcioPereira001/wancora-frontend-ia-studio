
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { createClient } from '@/utils/supabase/client';
import { CheckCircle2, Radio, Loader2, HardDrive, DownloadCloud, Hourglass } from 'lucide-react';
import { cn } from '@/lib/utils';

export function GlobalSyncIndicator() {
  const { forcedSyncId, clearSyncAnimation } = useRealtimeStore();
  const [show, setShow] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
  // Estado local visual
  const [localPercent, setLocalPercent] = useState(0);
  const [fakePercent, setFakePercent] = useState(0); 
  const [localStatus, setLocalStatus] = useState<string>('waiting');
  
  // TRAVA DE 20 SEGUNDOS (Modo Cinema)
  const [isLocked, setIsLocked] = useState(false);
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fakeProgressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closingRef = useRef(false);

  const targetInstanceId = forcedSyncId;

  // --- ANIMAÇÃO DE PREPARAÇÃO (0-95% em ~20s) ---
  useEffect(() => {
    // Roda a animação fake se estiver travado (20s iniciais) ou se o status real ainda for de preparação
    const shouldRunFake = isLocked || localStatus === 'importing_contacts' || localStatus === 'waiting';

    if (shouldRunFake) {
        let p = 0;
        if (fakeProgressRef.current) clearInterval(fakeProgressRef.current);
        
        // 20000ms / 95 steps ~= 210ms por passo
        fakeProgressRef.current = setInterval(() => {
            setFakePercent(prev => {
                if (prev >= 95) return 95; // Teto da animação fake
                return prev + 1;
            });
        }, 210); 
    } else {
        if (fakeProgressRef.current) clearInterval(fakeProgressRef.current);
    }
    return () => { if (fakeProgressRef.current) clearInterval(fakeProgressRef.current); };
  }, [localStatus, isLocked]);

  // --- MONITORAMENTO REALTIME ---
  useEffect(() => {
    if (!targetInstanceId) {
        if (show && !forcedSyncId && !closingRef.current) {
             closingRef.current = true;
             setIsVisible(false);
             setTimeout(() => { 
                 setShow(false); 
                 closingRef.current = false; 
                 setLocalPercent(0); 
                 setFakePercent(0);
                 setIsLocked(false);
             }, 500);
        }
        return;
    }

    // Ao abrir, inicia a trava de 20s
    if (forcedSyncId && !show) {
        setShow(true);
        setTimeout(() => setIsVisible(true), 50);
        setLocalStatus('waiting'); 
        setLocalPercent(0);
        setFakePercent(0);
        
        // INICIA O MODO "CEGO" POR 20 SEGUNDOS
        setIsLocked(true);
        if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
        lockTimeoutRef.current = setTimeout(() => {
            setIsLocked(false);
            console.log("🔓 [SYNC UI] Trava de 20s liberada. Sincronizando com real...");
        }, 20000); 
    }

    const fetchDirectStatus = async () => {
        const supabase = createClient();
        const { data, error } = await supabase
            .from('instances')
            .select('sync_status, sync_percent, status')
            .eq('id', targetInstanceId)
            .single();

        if (data && !error) {
            const dbStatus = data.sync_status || 'waiting';
            const dbPercent = data.sync_percent || 0;

            // 1. Abortar IMEDIATAMENTE se desconectou (Erro crítico fura o bloqueio)
            if (data.status === 'disconnected') {
                if (!closingRef.current) {
                    setIsVisible(false);
                    setTimeout(() => { setShow(false); clearSyncAnimation(); setIsLocked(false); }, 500);
                }
                return;
            }

            // --- LÓGICA DE BLOQUEIO ---
            // Se estiver travado nos primeiros 20s, IGNOREMOS o backend (exceto desconexão)
            // Mantemos visualmente como 'importing_contacts'
            if (isLocked) {
                setLocalStatus('importing_contacts');
                return; 
            }
            // ---------------------------

            // 2. FORÇA FECHAMENTO (Só processa se não estiver locked)
            if (dbStatus === 'completed') {
                if (!closingRef.current) {
                    setLocalStatus('completed');
                    setLocalPercent(100); 
                    
                    closingRef.current = true;
                    setTimeout(() => {
                        setIsVisible(false);
                        setTimeout(() => {
                            setShow(false);
                            clearSyncAnimation();
                            closingRef.current = false;
                        }, 500);
                    }, 3000);
                }
                return;
            }

            // 3. Atualizar Estado Real (Pós-Trava)
            setLocalStatus(dbStatus);
            
            if (dbStatus === 'importing_messages') {
                setLocalPercent(dbPercent);
            }
        }
    };

    fetchDirectStatus(); 
    intervalRef.current = setInterval(fetchDirectStatus, 1000);

    return () => { 
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (lockTimeoutRef.current) clearTimeout(lockTimeoutRef.current);
    };
  }, [targetInstanceId, forcedSyncId, show, clearSyncAnimation, isLocked]);

  if (!show) return null;

  const isComplete = localStatus === 'completed' || localPercent === 100;
  
  // Se estiver travado ou em fase inicial, usa a porcentagem fake
  const showFake = isLocked || localStatus === 'importing_contacts' || localStatus === 'waiting';
  const displayPercent = showFake ? fakePercent : localPercent;
  
  let statusLabel = 'Conexão Estabelecida';
  let Icon = Radio;
  let subLabel = 'Aguardando dados...';
  
  // Cores
  let barColor = 'bg-slate-500'; 
  
  switch (localStatus) {
      case 'waiting': 
          statusLabel = 'Aguardando WhatsApp';
          subLabel = 'Estabelecendo conexão segura...';
          Icon = Loader2;
          break;
      case 'importing_contacts':
          statusLabel = 'Preparando Ambiente';
          subLabel = `Organizando contatos (${displayPercent}%)...`;
          Icon = Hourglass; 
          barColor = 'bg-slate-500'; // Neutro durante a trava/preparação
          break;
      case 'importing_messages':
          statusLabel = 'Baixando Histórico';
          subLabel = `Recuperando conversas (${displayPercent}%)...`;
          Icon = DownloadCloud;
          barColor = 'bg-gradient-to-r from-blue-600 to-cyan-400'; // Azul quando destrava e baixa
          break;
      case 'completed':
          statusLabel = 'Histórico 100% Concluído';
          subLabel = 'Tudo pronto!';
          Icon = CheckCircle2;
          barColor = 'bg-emerald-500';
          break;
      default:
          statusLabel = 'Processando';
          subLabel = 'Organizando dados...';
          Icon = HardDrive;
  }

  return (
    <div className={cn(
        "fixed bottom-6 right-6 z-[99999] pointer-events-auto transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1)",
        isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"
    )}>
      <div className="bg-[#09090b] border border-zinc-800 rounded-xl shadow-[0_0_80px_rgba(0,0,0,0.8)] p-5 w-96 ring-1 ring-white/10 relative overflow-hidden backdrop-blur-2xl">
        
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${isComplete ? 'via-emerald-500' : 'via-blue-600'} to-transparent opacity-75`} />

        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-xl transition-colors duration-500 shadow-inner ${isComplete ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-blue-400'}`}>
               {isComplete ? <CheckCircle2 className="w-6 h-6" /> : <Icon className={`w-6 h-6 ${!isComplete ? 'animate-pulse' : ''}`} />}
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
            {displayPercent}%
          </span>
        </div>

        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden relative z-10">
            <div 
              className={`h-full transition-all duration-300 ease-out relative ${barColor}`}
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
