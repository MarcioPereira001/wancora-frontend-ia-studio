
'use client';

import React, { useState, useMemo } from 'react';
import { Loader2, Check, Circle, Square } from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

interface PollBubbleProps {
  message: any;
  isMe: boolean;
}

export function PollBubble({ message, isMe }: PollBubbleProps) {
  const { user } = useAuthStore();
  const { addToast } = useToast();
  const [votingOptionId, setVotingOptionId] = useState<number | null>(null);

  // 1. Parse Seguro do Conteúdo
  const pollData = useMemo(() => {
      try {
          const raw = message.content || message.body;
          if (typeof raw === 'string' && raw.startsWith('{')) {
              return JSON.parse(raw);
          } else if (typeof raw === 'object') {
              return raw;
          }
          return { name: 'Enquete Inválida', options: [] };
      } catch (e) {
          return { name: 'Erro ao carregar', options: [] };
      }
  }, [message.content, message.body]);

  // 2. Processamento dos Votos (Agregação Visual)
  const { votesPerOption, totalVoters } = useMemo(() => {
      const votes = Array.isArray(message.poll_votes) ? message.poll_votes : [];
      const counts = new Map<string, number>();
      const voterSet = new Set<string>();

      votes.forEach((v: any) => {
          if (v.selectedOptions && Array.isArray(v.selectedOptions)) {
              voterSet.add(v.voterJid);
              v.selectedOptions.forEach((opt: string) => {
                  counts.set(opt, (counts.get(opt) || 0) + 1);
              });
          }
      });

      return { 
          votesPerOption: counts, 
          totalVoters: voterSet.size
      };
  }, [message.poll_votes]);

  const options = pollData.options || [];
  const isMultiple = (pollData.selectableOptionsCount || 1) > 1;

  // 3. Handler de Voto
  const handleVote = async (idx: number, optionName: string) => {
      if (votingOptionId !== null) return; 
      setVotingOptionId(idx);
      
      try {
          await api.post('/message/vote', {
              companyId: message.company_id,
              sessionId: message.session_id,
              remoteJid: message.remote_jid,
              pollId: message.id,
              optionId: idx
          });
          addToast({ type: 'success', title: 'Voto Enviado', message: 'Computando...' });
      } catch (error) {
          console.error(error);
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao votar.' });
      } finally {
          setTimeout(() => setVotingOptionId(null), 1000); 
      }
  };

  return (
      <div className={cn(
          "rounded-xl p-4 min-w-[280px] max-w-[340px] space-y-4 mt-1 border shadow-sm relative overflow-hidden select-none",
          isMe ? "bg-[#0f2027] border-zinc-700/50" : "bg-zinc-900 border-zinc-800"
      )}>
          {/* Header */}
          <div>
              <h4 className="font-bold text-lg text-white leading-snug break-words">{pollData.name || 'Enquete'}</h4>
              <div className="flex items-center gap-2 mt-2">
                  <span className={cn(
                      "text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border",
                      isMultiple ? "bg-purple-500/10 border-purple-500/30 text-purple-400" : "bg-blue-500/10 border-blue-500/30 text-blue-400"
                  )}>
                      {isMultiple ? 'Múltipla Escolha' : 'Escolha Única'}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                      {totalVoters} pessoa{totalVoters !== 1 && 's'} votaram
                  </span>
              </div>
          </div>

          {/* Options List */}
          <div className="space-y-2.5">
              {options.map((opt: string | {optionName: string}, idx: number) => {
                  const optionLabel = typeof opt === 'string' ? opt : opt.optionName;
                  const count = votesPerOption.get(optionLabel) || 0;
                  
                  // Total de votos computados (para barra de progresso)
                  const totalVotesInPoll = (Array.from(votesPerOption.values()) as number[]).reduce((a, b) => a + b, 0);
                  const percentage = totalVotesInPoll > 0 ? Math.round((count / totalVotesInPoll) * 100) : 0;
                  
                  const isVotingThis = votingOptionId === idx;
                  
                  return (
                      <div 
                        key={idx} 
                        className={cn(
                            "relative group cursor-pointer border rounded-lg p-2.5 transition-all active:scale-[0.98] overflow-hidden",
                            isMe ? "border-zinc-700 hover:bg-white/5" : "border-zinc-800 hover:bg-zinc-800"
                        )}
                        onClick={() => handleVote(idx, optionLabel)}
                      >
                          {/* Barra de Progresso (Fundo) */}
                          <div 
                              className="absolute inset-y-0 left-0 bg-white/5 transition-all duration-700 ease-out z-0"
                              style={{ width: `${percentage}%` }}
                          />

                          <div className="flex items-center justify-between relative z-10 gap-3">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className={cn(
                                      "w-5 h-5 rounded flex items-center justify-center transition-colors shrink-0 border",
                                      isMultiple ? "rounded-md" : "rounded-full",
                                      "border-zinc-500 group-hover:border-zinc-300"
                                  )}>
                                      {isVotingThis ? (
                                          <Loader2 className="w-3 h-3 animate-spin text-white" />
                                      ) : (
                                          isMultiple ? <Square className="w-3 h-3 text-transparent" /> : <Circle className="w-3 h-3 text-transparent" />
                                      )}
                                  </div>
                                  <span className="text-sm text-zinc-200 font-medium truncate">{optionLabel}</span>
                              </div>
                              
                              <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono">
                                  <span>{count}</span>
                                  <span className="opacity-50 text-[10px]">({percentage}%)</span>
                              </div>
                          </div>
                      </div>
                  )
              })}
          </div>
          
          <div className="pt-1 text-center">
              <span className="text-[10px] text-zinc-600">Clique na opção para votar</span>
          </div>
      </div>
  );
}
