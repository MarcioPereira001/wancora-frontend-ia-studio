
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { createClient } from '@/utils/supabase/client';
import { RefreshCw, CheckCircle2, CloudDownload, Database, Users, MessageSquare, Radio } from 'lucide-react';

export function GlobalSyncIndicator() {
  const { instances } = useRealtimeStore();
  const [show, setShow] = useState(false);
  const [localPercent, setLocalPercent] = useState(0);
  const [localStatus, setLocalStatus] = useState('');
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Encontra instância ativa. Prioriza Conectadas.
  const activeInstance = instances.find(i => i.status === 'connected') 
                      || instances.find(i => i.status === 'connecting');

  useEffect(() => {
    if (!activeInstance) {
        // Se não tem nada rodando e estava mostrando, esconde
        if (show) setShow(false);
        return;
    }

    const fetchDirectStatus = async () => {
        const supabase = createClient();
        
        const { data } = await supabase
            .from('instances')
            .select('sync_status, sync_percent, status')
            .eq('id', activeInstance.id)
            .single();

        if (data) {
            setLocalStatus(data.sync_status || '');
            setLocalPercent(data.sync_percent || 0);
            
            const isConnected = data.status === 'connected';
            const isCompleted = data.sync_status === 'completed';
            const isDisconnected = data.status === 'disconnected';
            
            // REGRA DE OURO: Se está Conectado E NÃO completou o sync, MOSTRA.
            // Isso cobre 'waiting', 'null', 'importing...', 'processing...', etc.
            if (isConnected && !isCompleted) {
                setShow(true);
            } 
            // Se ainda está conectando (tela de QR Code ou handshake) mas já tem algum progresso
            else if (data.status === 'connecting' && (data.sync_percent || 0) > 0) {
                setShow(true);
            }
            // Se desconectou, esconde imediatamente
            else if (isDisconnected) {
                setShow(false);
            }
            // Se completou, inicia a sequência de saída graciosa
            else if (isCompleted && show) {
                 setLocalPercent(100); // Garante 100% visual
                 // Mantém visível por 5s para o usuário sentir o sucesso
                 setTimeout(() => setShow(false), 5000); 
            }
        }
    };

    // Polling de alta frequência (1s)
    fetchDirectStatus(); 
    intervalRef.current = setInterval(fetchDirectStatus, 1000);

    return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeInstance?.id, show]);

  if (!show) return null;

  const isComplete = localPercent >= 100 || localStatus === 'completed';
  
  // Mapeamento de Status para UX Amigável
  let statusLabel = 'Iniciando sistema...';
  let Icon = Radio;
  let subLabel = 'Estabelecendo conexão segura.';

  switch (localStatus) {
      case 'waiting':
          statusLabel = 'Conexão Estabelecida';
          subLabel = 'Aguardando início da sincronização...';
          Icon = Radio;
          break;
      case 'importing_contacts':
          statusLabel = 'Importando Contatos';
          subLabel = 'Organizando sua agenda...';
          Icon = Users;
          break;
      case 'importing_messages':
          statusLabel = 'Baixando Mensagens';
          subLabel = 'Recuperando histórico recente...';
          Icon = MessageSquare;
          break;
      case 'processing_history':
          statusLabel = 'Processando Dados';
          subLabel = 'Indexando conversas no CRM...';
          Icon = Database;
          break;
      case 'completed':
          statusLabel = 'Sincronização Concluída';
          subLabel = 'Sistema 100% operacional.';
          Icon = CheckCircle2;
          break;
      default:
          if (localPercent > 0) {
              statusLabel = 'Sincronizando...';
              subLabel = 'Atualizando dados em tempo real.';
              Icon = RefreshCw;
          }
          break;
  }

  return (
    <div className="fixed bottom-6 right-6 z-[99999] pointer-events-auto">
      <div className="bg-[#09090b] border border-zinc-800 rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] p-4 w-80 animate-in slide-in-from-bottom-10 fade-in duration-500 ring-1 ring-white/10 relative overflow-hidden group">
        
        {/* Glow de fundo dinâmico */}
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${isComplete ? 'via-emerald-500/50' : 'via-blue-500/50'} to-transparent opacity-50`} />

        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors duration-500 ${isComplete ? 'bg-emerald-500/10 text-emerald-500' : 'bg-blue-600/10 text-blue-500'}`}>
               {isComplete ? (
                 <CheckCircle2 className="w-5 h-5" />
               ) : (
                 <Icon className={`w-5 h-5 ${localPercent < 100 ? 'animate-pulse' : ''}`} />
               )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white leading-none mb-1">
                {statusLabel}
              </span>
              <span className="text-[10px] text-zinc-400 font-medium">
                {subLabel}
              </span>
            </div>
          </div>
          <span className={`text-lg font-mono font-bold transition-colors ${isComplete ? 'text-emerald-500' : 'text-white'}`}>
            {localPercent}%
          </span>
        </div>

        {/* Barra de Progresso Suave */}
        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden relative z-10">
            <div 
              className={`h-full transition-all duration-700 ease-out relative ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-600 to-cyan-400'}`}
              style={{ width: `${Math.max(5, localPercent)}%` }} // Mínimo 5% visual
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
