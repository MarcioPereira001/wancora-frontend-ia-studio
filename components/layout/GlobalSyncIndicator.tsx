
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { createClient } from '@/utils/supabase/client';
import { RefreshCw, CheckCircle2, CloudDownload, Database, Users, MessageSquare, Radio, Loader2 } from 'lucide-react';

export function GlobalSyncIndicator() {
  const { instances } = useRealtimeStore();
  const [show, setShow] = useState(false);
  const [localPercent, setLocalPercent] = useState(0);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // BUSCA AGRESSIVA: Qualquer instância que não esteja desconectada ou pronta para QR Code
  // Priorizamos 'connected' para pegar o momento exato pós-leitura
  const activeInstance = instances.find(i => i.status === 'connected') 
                      || instances.find(i => i.status === 'connecting' && (i.sync_percent || 0) > 0);

  useEffect(() => {
    // Se não tem instância relevante, esconde e limpa
    if (!activeInstance) {
        if (show) setShow(false);
        return;
    }

    const fetchDirectStatus = async () => {
        const supabase = createClient();
        
        // Consulta direta ao banco para evitar delay do WebSocket
        const { data } = await supabase
            .from('instances')
            .select('sync_status, sync_percent, status')
            .eq('id', activeInstance.id)
            .single();

        if (data) {
            setLocalStatus(data.sync_status || 'waiting'); // Default to waiting se null
            setLocalPercent(data.sync_percent || 0);
            
            const isConnected = data.status === 'connected';
            const isSyncCompleted = data.sync_status === 'completed';
            const isDisconnected = data.status === 'disconnected';
            
            // LÓGICA SUPREMA DE EXIBIÇÃO:
            // 1. Se conectou e o sync NÃO acabou -> MOSTRA IMEDIATAMENTE (Cobre 'waiting', null, 'importing')
            if (isConnected && !isSyncCompleted) {
                setShow(true);
            } 
            // 2. Se ainda está conectando mas já tem dados -> MOSTRA
            else if (data.status === 'connecting' && (data.sync_percent || 0) > 0) {
                setShow(true);
            }
            // 3. Se desconectou -> ESCONDE
            else if (isDisconnected) {
                setShow(false);
            }
            // 4. Se completou -> FINALIZA COM ESTILO
            else if (isSyncCompleted && show) {
                 setLocalPercent(100);
                 // Mantém na tela por 4s para o usuário ver o "100%"
                 setTimeout(() => setShow(false), 4000); 
            }
        }
    };

    // Polling ultra-rápido (1s) para garantir fluidez visual da barra
    fetchDirectStatus(); 
    intervalRef.current = setInterval(fetchDirectStatus, 1000);

    return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeInstance?.id, show]);

  if (!show) return null;

  const isComplete = localPercent >= 100 || localStatus === 'completed';
  
  // Mapeamento Visual de Status
  let statusLabel = 'Conexão Estabelecida';
  let Icon = Radio;
  let subLabel = 'Preparando sincronização...';
  let barColor = 'bg-blue-600';

  switch (localStatus) {
      case 'waiting':
          statusLabel = 'Aguardando Dados';
          subLabel = 'Iniciando download do WhatsApp...';
          Icon = Loader2; // Spinner
          break;
      case 'importing_contacts':
          statusLabel = 'Importando Contatos';
          subLabel = 'Organizando sua agenda...';
          Icon = Users;
          barColor = 'bg-purple-600';
          break;
      case 'importing_messages':
          statusLabel = 'Baixando Mensagens';
          subLabel = 'Recuperando histórico recente...';
          Icon = MessageSquare;
          barColor = 'bg-indigo-600';
          break;
      case 'processing_history':
          statusLabel = 'Processando IA';
          subLabel = 'Indexando conversas no CRM...';
          Icon = Database;
          barColor = 'bg-cyan-600';
          break;
      case 'completed':
          statusLabel = 'Sincronização Concluída';
          subLabel = 'Sistema pronto para uso.';
          Icon = CheckCircle2;
          barColor = 'bg-emerald-500';
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
    // Z-INDEX 99999 GARANTIDO: Fica acima de Modais e Overlays
    <div className="fixed bottom-6 right-6 z-[99999] pointer-events-auto">
      <div className="bg-[#09090b] border border-zinc-800 rounded-xl shadow-[0_0_60px_rgba(0,0,0,0.9)] p-4 w-80 animate-in slide-in-from-bottom-10 fade-in duration-500 ring-1 ring-white/10 relative overflow-hidden backdrop-blur-xl">
        
        {/* Glow de fundo baseado no status */}
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${isComplete ? 'via-emerald-500/50' : 'via-blue-500/50'} to-transparent opacity-50`} />

        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors duration-500 ${isComplete ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-blue-400'}`}>
               {isComplete ? (
                 <CheckCircle2 className="w-5 h-5" />
               ) : (
                 <Icon className={`w-5 h-5 ${localStatus === 'waiting' || localPercent < 100 ? 'animate-pulse' : ''}`} />
               )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white leading-none mb-1">
                {statusLabel}
              </span>
              <span className="text-[10px] text-zinc-400 font-medium truncate max-w-[180px]">
                {subLabel}
              </span>
            </div>
          </div>
          <span className={`text-lg font-mono font-bold transition-colors ${isComplete ? 'text-emerald-500' : 'text-white'}`}>
            {localPercent}%
          </span>
        </div>

        {/* Barra de Progresso Animada */}
        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden relative z-10">
            <div 
              className={`h-full transition-all duration-700 ease-out relative ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-600 to-cyan-400'}`}
              style={{ width: `${Math.max(5, localPercent)}%` }} // Garante 5% visual mínimo para não parecer quebrado
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
