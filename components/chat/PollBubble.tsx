'use client';

import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';
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

  // Parse Content com fallback seguro
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

  // Lógica de Contagem de Votos (Agregação Local)
  // O backend salva: [{ voterJid: '...', optionId: 0 }, ...]
  const votes = Array.isArray(message.poll_votes) ? message.poll_votes : [];
  const totalVotes = votes.length;
  const votesPerOption = new Map<number, number>();
  
  votes.forEach((v: any) => {
      // Garante que optionId seja tratado como número
      const optId = Number(v.optionId);
      if (!isNaN(optId)) {
          const current = votesPerOption.get(optId) || 0;
          votesPerOption.set(optId, current + 1);
      }
  });

  const isMultiple = (pollData.selectableOptionsCount || 1) > 1;

  // Handler de Voto
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
          addToast({ type: 'success', title: 'Voto Computado', message: 'Sua opinião foi registrada.' });
      } catch (error) {
          console.error(error);
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao votar.' });
          setVotingOptionId(null);
      }
      
      // Delay visual para feedback
      setTimeout(() => setVotingOptionId(null), 1500); 
  };

  return (
      <div className={cn(
          "rounded-xl p-4 min-w-[280px] space-y-4 mt-1 border shadow-sm relative overflow-hidden",
          isMe ? "bg-[#0f2027] border-zinc-700/50" : "bg-zinc-900 border-zinc-800"
      )}>
          {/* Header */}
          <div>
              <h4 className="font-bold text-base text-white leading-snug">{pollData.name || 'Enquete'}</h4>
              <span className="text-[10px] text-zinc-500 mt-1 block uppercase tracking-wider font-bold">
                  {isMultiple ? 'Múltipla Escolha' : 'Escolha Única'}
              </span>
          </div>

          {/* Options List */}
          <div className="space-y-3">
              {pollData.options?.map((opt: string, idx: number) => {
                  const voteCount = votesPerOption.get(idx) || 0;
                  const percentage = totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
                  const isVoting = votingOptionId === idx;
                  
                  return (
                      <div key={idx} className="relative group cursor-pointer" onClick={() => handleVote(idx)}>
                          <div className="flex items-center justify-between mb-1.5 relative z-10">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                  <div className={cn(
                                      "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors shrink-0",
                                      "border-zinc-600 group-hover:border-zinc-400"
                                  )}>
                                      {isVoting && <Loader2 className="w-3 h-3 animate-spin text-white" />}
                                  </div>
                                  <span className="text-sm text-zinc-200 font-medium truncate pr-2">{opt}</span>
                              </div>
                              <span className="text-xs text-zinc-500 font-mono font-bold">
                                  {voteCount} ({percentage}%)
                              </span>
                          </div>
                          
                          {/* Progress Bar Container */}
                          <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                              <div 
                                  className={cn("h-full transition-all duration-700 ease-out rounded-full", isMe ? "bg-emerald-500" : "bg-blue-500")}
                                  style={{ width: `${percentage}%` }}
                              />
                          </div>
                      </div>
                  )
              })}
          </div>
          
          {/* Footer */}
          <div className="pt-3 border-t border-white/5 flex justify-between items-center">
              <span className="text-[10px] text-zinc-500">
                  Total: {totalVotes} voto{totalVotes !== 1 && 's'}
              </span>
          </div>
      </div>
  );
}