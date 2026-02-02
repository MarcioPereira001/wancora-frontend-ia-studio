
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
  const [localPercent, setLocalPercent] = useState(0);
  const [fakePercent, setFakePercent] = useState(0); 
  const [localStatus, setLocalStatus] = useState<string>('waiting');
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fakeProgressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closingRef = useRef(false);

  const targetInstanceId = forcedSyncId;

  // --- ANIMAÇÃO DE PREPARAÇÃO (0-95% em 20s) ---
  useEffect(() => {
    // Só roda o fake se estiver esperando ou importando contatos
    if (localStatus === 'importing_contacts' || localStatus === 'waiting') {
        let p = 0;
        if (fakeProgressRef.current) clearInterval(fakeProgressRef.current);
        
        fakeProgressRef.current = setInterval(() => {
            p += 1; 
            if (p >= 95) p = 95; // Trava em 95%
            setFakePercent(p);
        }, 200); 
    } else {
        // Se mudou para messages ou completed, para o fake
        if (fakeProgressRef.current) clearInterval(fakeProgressRef.current);
    }
    return () => { if (fakeProgressRef.current) clearInterval(fakeProgressRef.current); };
  }, [localStatus]);

  // --- MONITORAMENTO REALTIME ---
  useEffect(() => {
    if (!targetInstanceId) {
        if (show && !forcedSyncId && !closingRef.current) {
             closingRef.current = true;
             setIsVisible(false);
             setTimeout(() => { setShow(false); closingRef.current = false; setLocalPercent(0); }, 500);
        }
        return;
    }

    if (forcedSyncId && !show) {
        setShow(true);
        setTimeout(() => setIsVisible(true), 50);
        setLocalStatus('waiting'); 
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
            const dbStatus = data.sync_status || 'waiting';
            const dbPercent = data.sync_percent || 0;
            
            // Debug para entender o fluxo
            // console.log(`[SYNC UI] Status: ${dbStatus}, Percent: ${dbPercent}%`);

            // 1. FORÇA FECHAMENTO
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

            // 2. Abortar
            if (data.status === 'disconnected') {
                if (!closingRef.current) {
                    setIsVisible(false);
                    setTimeout(() => { setShow(false); clearSyncAnimation(); }, 500);
                }
                return;
            }

            // 3. Atualizar Estado
            setLocalStatus(dbStatus);
            
            // PRIORIDADE REAL: Se o status for mensagens, a porcentagem real manda
            if (dbStatus === 'importing_messages') {
                setLocalPercent(dbPercent);
            }
        }
    };

    fetchDirectStatus(); 
    intervalRef.current = setInterval(fetchDirectStatus, 1000);

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [targetInstanceId, forcedSyncId, show, clearSyncAnimation]);

  if (!show) return null;

  const isComplete = localStatus === 'completed' || localPercent === 100;
  
  // Decide qual porcentagem mostrar
  // Se status for messages, usa o real (localPercent), mesmo que seja 0% (início do lote)
  // Se for contacts/waiting, usa o fake
  const isRealPhase = localStatus === 'importing_messages';
  const displayPercent = isRealPhase ? localPercent : fakePercent;
  
  let statusLabel = 'Conexão Estabelecida';
  let Icon = Radio;
  let subLabel = 'Aguardando dados...';
  
  // Cores: Preparação = Neutro, Download = Azul, Completo = Verde
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
          barColor = 'bg-slate-500'; 
          break;
      case 'importing_messages':
          statusLabel = 'Baixando Histórico';
          subLabel = `Recuperando conversas (${displayPercent}%)...`;
          Icon = DownloadCloud;
          // Agora fica AZUL vibrante para indicar que "agora é pra valer"
          barColor = 'bg-gradient-to-r from-blue-600 to-cyan-400'; 
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
