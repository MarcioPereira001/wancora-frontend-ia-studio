
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { createClient } from '@/utils/supabase/client';
import { RefreshCw, CheckCircle2, Database, Users, MessageSquare, Radio, Loader2, Map as MapIcon, HardDrive } from 'lucide-react';

export function GlobalSyncIndicator() {
  const { instances } = useRealtimeStore();
  const [show, setShow] = useState(false);
  const [localPercent, setLocalPercent] = useState(0);
  const [localStatus, setLocalStatus] = useState<string>('waiting');
  
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // SELETOR AGRESSIVO:
  // Pega qualquer instância que NÃO esteja:
  // 1. Desconectada
  // 2. Apenas mostrando QR Code (sem ter conectado ainda)
  // Isso garante que assim que o status muda de 'qrcode' para 'connecting' ou 'connected', ela é capturada.
  const activeInstance = instances.find(i => 
      (i.status === 'connected' || i.status === 'connecting') && 
      i.status !== 'disconnected'
  );

  useEffect(() => {
    // Se não tem instância ativa no store global, e não estamos mostrando nada, sai.
    if (!activeInstance) {
        // Delay para evitar sumir em flickers de rede
        const timeout = setTimeout(() => {
             if(!activeInstance && show && localPercent >= 100) setShow(false);
        }, 1000);
        return () => clearTimeout(timeout);
    }

    const fetchDirectStatus = async () => {
        const supabase = createClient();
        
        // Consulta direta ao banco (Bypass do Store para latência zero)
        const { data, error } = await supabase
            .from('instances')
            .select('sync_status, sync_percent, status')
            .eq('id', activeInstance.id)
            .single();

        if (data && !error) {
            const dbStatus = data.status;
            const dbSyncStatus = data.sync_status || 'waiting'; // Default crucial
            const dbPercent = data.sync_percent || 0;

            setLocalStatus(dbSyncStatus);
            setLocalPercent(dbPercent);

            // --- LÓGICA DE EXIBIÇÃO DEFINITIVA ---

            // CASO 1: CONCLUÍDO (Só mostra se já estava aberto, para dar feedback de sucesso)
            if (dbSyncStatus === 'completed') {
                if (show) {
                    setLocalPercent(100);
                    // Mantém visível por 4 segundos e fecha
                    setTimeout(() => setShow(false), 4000);
                }
                return;
            }

            // CASO 2: FLUXO DE CONEXÃO E SINCRONIZAÇÃO
            // Se está conectado/conectando E o sync não terminou -> MOSTRA SEMPRE.
            // Isso cobre: 'waiting', 'importing_contacts', 'importing_messages', 'processing_history'
            if ((dbStatus === 'connected' || dbStatus === 'connecting') && dbSyncStatus !== 'completed') {
                setShow(true);
            }
            
            // CASO 3: LATE JOIN (Usuário deu F5 no meio do processo)
            // Se tem porcentagem rodando, mostra.
            else if (dbPercent > 0 && dbPercent < 100) {
                setShow(true);
            }
            
            // CASO 4: MORTO
            else if (dbStatus === 'disconnected') {
                setShow(false);
            }
        }
    };

    // Polling de 1s (O Backend atualiza rápido, o Frontend tem que acompanhar)
    fetchDirectStatus(); 
    intervalRef.current = setInterval(fetchDirectStatus, 1000);

    return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeInstance?.id, show]);

  if (!show) return null;

  const isComplete = localPercent >= 100 || localStatus === 'completed';
  
  // --- MAPEAMENTO DE STATUS (Logs do Backend -> UI Amigável) ---
  let statusLabel = 'Conexão Estabelecida';
  let Icon = Radio;
  let subLabel = 'Aguardando dados...';
  
  // Mapeia os status exatos do DATABASE_SCHEMA.md
  switch (localStatus) {
      case 'waiting': // [CONECTADO]
          statusLabel = 'Iniciando Sessão';
          subLabel = 'Estabelecendo handshake seguro...';
          Icon = Loader2;
          break;
      case 'importing_contacts': // [MAPA]
          statusLabel = 'Mapeando Contatos';
          subLabel = 'Identificando nomes e grupos...';
          Icon = Users;
          break;
      case 'importing_messages': // [HISTÓRICO]
          statusLabel = 'Baixando Histórico';
          subLabel = 'Recuperando conversas recentes...';
          Icon = MessageSquare;
          break;
      case 'processing_history': // Pós-Download
          statusLabel = 'Organizando CRM';
          subLabel = 'Indexando leads e mensagens...';
          Icon = Database;
          break;
      case 'syncing': // Genérico
          statusLabel = 'Sincronizando';
          subLabel = 'Atualizando dados em tempo real...';
          Icon = RefreshCw;
          break;
      case 'completed':
          statusLabel = 'Tudo Pronto!';
          subLabel = 'Sincronização finalizada.';
          Icon = CheckCircle2;
          break;
      default:
          // Fallback inteligente
          if (localPercent > 0) {
              statusLabel = 'Processando Dados';
              subLabel = 'Por favor, aguarde...';
              Icon = HardDrive;
          }
          break;
  }

  return (
    // Z-INDEX MÁXIMO (99999) - Garante sobreposição a qualquer Modal (Shadcn usa z-50)
    <div className="fixed bottom-6 right-6 z-[99999] pointer-events-auto">
      <div className="bg-[#09090b] border border-zinc-800 rounded-xl shadow-[0_0_80px_rgba(0,0,0,0.8)] p-4 w-80 animate-in slide-in-from-bottom-20 fade-in duration-500 ring-1 ring-white/10 relative overflow-hidden backdrop-blur-2xl">
        
        {/* Efeito de Scanline/Glow */}
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${isComplete ? 'via-emerald-500' : 'via-blue-600'} to-transparent opacity-75`} />

        <div className="flex items-center justify-between mb-3 relative z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg transition-colors duration-500 ${isComplete ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-blue-400'}`}>
               {isComplete ? (
                 <CheckCircle2 className="w-5 h-5" />
               ) : (
                 <Icon className={`w-5 h-5 ${localStatus === 'waiting' || localPercent < 100 ? 'animate-pulse' : ''}`} />
               )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-bold text-white leading-none mb-1 truncate">
                {statusLabel}
              </span>
              <span className="text-[10px] text-zinc-400 font-medium truncate max-w-[160px]">
                {subLabel}
              </span>
            </div>
          </div>
          <span className={`text-lg font-mono font-bold transition-colors ${isComplete ? 'text-emerald-500' : 'text-white'}`}>
            {localPercent}%
          </span>
        </div>

        {/* Barra de Progresso Real */}
        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden relative z-10">
            <div 
              className={`h-full transition-all duration-700 ease-out relative ${isComplete ? 'bg-emerald-500' : 'bg-gradient-to-r from-blue-600 to-cyan-400'}`}
              style={{ width: `${Math.max(5, localPercent)}%` }} // Sempre mostra pelo menos 5% para feedback visual
            >
                {!isComplete && (
                    <div className="absolute inset-0 bg-white/30 w-full animate-[shimmer_1s_infinite] -skew-x-12" />
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
