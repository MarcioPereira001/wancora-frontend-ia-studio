'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { createClient } from '@/utils/supabase/client';
import { RefreshCw, CheckCircle2, CloudDownload } from 'lucide-react';

export function GlobalSyncIndicator() {
  const { instances } = useRealtimeStore();
  const [show, setShow] = useState(false);
  const [localPercent, setLocalPercent] = useState(0);
  const [localStatus, setLocalStatus] = useState('');
  
  // Ref para controlar o intervalo de polling
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Encontra a instância ativa (Conectada ou Aberta)
  const activeInstance = instances.find(i => i.status === 'connected' || i.status === 'open');

  // --- POLLING DIRETO (A CADA 1 SEGUNDO) ---
  // Resolve o problema de "Backend rápido, Frontend lento"
  useEffect(() => {
    if (!activeInstance) return;

    const fetchDirectStatus = async () => {
        const supabase = createClient();
        
        // Busca apenas os campos necessários direto da fonte
        const { data } = await supabase
            .from('instances')
            .select('sync_status, sync_percent')
            .eq('id', activeInstance.id)
            .single();

        if (data) {
            // Atualiza estado local visual
            setLocalStatus(data.sync_status || '');
            setLocalPercent(data.sync_percent || 0);
            
            // Lógica de Exibição:
            // Mostra se estiver "syncing" OU se a porcentagem estiver rodando (1-99%)
            const isActive = data.sync_status === 'syncing' || (data.sync_percent > 0 && data.sync_percent < 100);
            
            if (isActive) {
                setShow(true);
            } else if (data.sync_percent === 100 && show) {
                 // Se acabou de chegar em 100%, espera 4 segundos antes de sumir
                 setTimeout(() => setShow(false), 4000);
            }
        }
    };

    // 1. Chama imediatamente
    fetchDirectStatus(); 
    
    // 2. Repete a cada 1000ms (1 segundo)
    intervalRef.current = setInterval(fetchDirectStatus, 1000);

    return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeInstance?.id, show]);

  if (!show) return null;

  const isComplete = localPercent === 100;
  
  let statusLabel = 'Sincronizando...';
  // Labels mais descritivos baseados na porcentagem real do banco
  if (localPercent < 5) statusLabel = 'Iniciando...';
  else if (localPercent < 20) statusLabel = 'Organizando Contatos';
  else if (localPercent < 80) statusLabel = 'Baixando Histórico';
  else statusLabel = 'Finalizando...';
  
  if (isComplete) statusLabel = 'Concluído';

  return (
    <div className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[99999] pointer-events-auto">
      <div className="bg-[#09090b] border border-zinc-800 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] p-4 w-80 animate-in slide-in-from-right-10 fade-in duration-500 ring-1 ring-white/5">
        
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors duration-500 ${isComplete ? 'bg-emerald-500/10' : 'bg-blue-600/10'}`}>
               {isComplete ? (
                 <CheckCircle2 className="w-5 h-5 text-emerald-500" />
               ) : (
                 <CloudDownload className="w-5 h-5 text-blue-500 animate-bounce" />
               )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white leading-none mb-1">
                {statusLabel}
              </span>
              <span className="text-[10px] text-zinc-400 font-medium">
                {isComplete ? 'Sistema atualizado.' : 'Não feche o sistema.'}
              </span>
            </div>
          </div>
          <span className={`text-lg font-mono font-bold transition-colors ${isComplete ? 'text-emerald-500' : 'text-white'}`}>
            {localPercent}%
          </span>
        </div>

        {/* Barra de Progresso Suave */}
        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden relative">
            <div 
              className={`h-full transition-all duration-500 ease-linear relative ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-600 to-cyan-400'}`}
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