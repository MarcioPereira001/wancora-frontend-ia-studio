'use client';

import React, { useState } from 'react';
import { Loader2, Check, Circle, Square } from 'lucide-react';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { cn } from '@/lib/utils';

interface PollBubbleProps {
  message: any;
  isMe: boolean;
}

export function PollBubble({ message, isMe }: PollBubbleProps) {
  const { addToast } = useToast();
  const [votingOptionId, setVotingOptionId] = useState<number | null>(null);

  // 1. Parse Seguro do Conteúdo da Enquete
  let pollData = { name: 'Enquete', options: [], selectableOptionsCount: 1 };
  try {
      const content = message.content || message.body;
      if (typeof content === 'string' && content.startsWith('{')) {
          pollData = JSON.parse(content);
      } else if (typeof content === 'object') {
          pollData = content;
      }
  } catch (e) {
      pollData.name = "Erro ao carregar enquete";
  }

  // 2. Contagem de Votos (Agregação Local Realtime)
  const votes = Array.isArray(message.poll_votes) ? message.poll_votes : [];
  const totalVotes = votes.length;
  const votesPerOption = new Map<number, number>();
  
  votes.forEach((v: any) => {
      // Tenta extrair o optionId
      const optId = Number(v.optionId);
      if (!isNaN(optId)) {
          const current = votesPerOption.get(optId) || 0;
          votesPerOption.set(optId, current + 1);
      }
  });

  const isMultiple = (pollData.selectableOptionsCount || 1) > 1;

  // 3. Handler de Voto
  const handleVote = async (optionId: number) => {
      if (votingOptionId !== null) return; 
      setVotingOptionId(optionId);
      
      try {
          await api.post('/message/vote', {
              companyId: message.company_id,
              sessionId: message.session_id,
              remoteJid: message.remote_jid,
              pollId: message.id,
              optionId: optionId
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
          "rounded-xl p-4 min-w-[300px] space-y-4 mt-1 border shadow-sm relative overflow-hidden",
          isMe ? "bg-[#0f2027] border-zinc-700/50" : "bg-zinc-900 border-zinc-800"
      )}>
          {/* Header */}
          <div>
              <h4 className="font-bold text-lg text-white leading-snug">{pollData.name || 'Enquete'}</h4>
              <div className="flex items-center gap-2 mt-1.5">
                  <span className={cn(
                      "text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border",
                      isMultiple ? "bg-purple-500/10 border-purple-500/30 text-purple-400" : "bg-blue-500/10 border-blue-500/30 text-blue-400"
                  )}>
                      {isMultiple ? 'Múltipla Escolha' : 'Escolha Única'}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                      {totalVotes} voto{totalVotes !== 1 && 's'}
                  </span>
              </div>
          </div>

          {/* Options List */}
          <div className="space-y-3">
              {pollData.options?.map((opt: any, idx: number) => {
                  const optionLabel = typeof opt === 'string' ? opt : opt.optionName;
                  const voteCount = votesPerOption.get(idx) || 0;
                  const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                  const isVotingThis = votingOptionId === idx;
                  
                  return (
                      <div 
                        key={idx} 
                        className={cn(
                            "relative group cursor-pointer border rounded-lg p-2 transition-all active:scale-[0.98]",
                            isMe ? "border-zinc-700 hover:bg-white/5" : "border-zinc-800 hover:bg-zinc-800"
                        )}
                        onClick={() => handleVote(idx)}
                      >
                          {/* Barra de Progresso Fundo */}
                          <div 
                              className="absolute inset-y-0 left-0 bg-white/5 rounded-lg transition-all duration-700 ease-out"
                              style={{ width: `${percentage}%` }}
                          />

                          <div className="flex items-center justify-between relative z-10">
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
                                  <span className="text-sm text-zinc-200 font-medium truncate pr-2">{optionLabel}</span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                  <span className="text-xs text-zinc-400 font-mono font-bold">
                                      {voteCount} ({percentage}%)
                                  </span>
                              </div>
                          </div>
                      </div>
                  )
              })}
          </div>
          
          <div className="pt-2 text-center">
              <span className="text-[10px] text-zinc-600">Selecione uma opção para votar</span>
          </div>
      </div>
  );
}