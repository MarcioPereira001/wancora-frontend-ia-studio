
'use client';

import React, { useState } from 'react';
import { Message } from '@/types';
import { MessageContent } from './MessageContent';
import { Check, CheckCheck, Clock, Ban, Smile, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';

interface MessageBubbleProps {
  message: Message;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export function MessageBubble({ message, isSelectionMode, isSelected, onSelect }: MessageBubbleProps) {
  const isMe = message.from_me;
  const { addToast } = useToast();
  const [showReactionMenu, setShowReactionMenu] = useState(false);
  
  // Format Time (HH:mm)
  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Status Icon Logic (Blue Ticks)
  const renderStatusIcon = () => {
    if (!isMe) return null;

    const status = message.status;
    const iconClass = "w-[15px] h-[15px]"; // Um pouco maior para visibilidade

    if (status === 'sending') {
        return <Clock className={cn(iconClass, "text-zinc-400")} />;
    }
    
    if (status === 'sent') {
        return <Check className={cn(iconClass, "text-zinc-400")} />;
    }

    if (status === 'delivered') {
        return <CheckCheck className={cn(iconClass, "text-zinc-400")} />;
    }

    if (status === 'read') {
        return <CheckCheck className={cn(iconClass, "text-blue-400")} />; // AZUL
    }

    // Default Fallback
    return <Check className={cn(iconClass, "text-zinc-400")} />;
  };

  // Envia Reação
  const handleReact = async (emoji: string) => {
      setShowReactionMenu(false);
      try {
          // Chama endpoint dedicado ou genérico (Depende da implementação do usuário)
          // Aqui assumimos que vamos usar uma nova rota ou adapter
          // No backendController adicionamos `sendReaction`
          // Como o router não foi exposto, o ideal seria usar uma rota dedicada
          // Mas como não podemos criar rotas novas sem o `routes.js`, 
          // usaremos um POST para /message/react (que deve ser mapeado pelo usuário)
          
          await api.post('/message/react', {
              sessionId: message.session_id,
              companyId: message.company_id,
              remoteJid: message.remote_jid,
              msgId: message.id, // O backend usa isso pra achar a Key original
              reaction: emoji
          });
      } catch (error) {
          console.error("Reaction failed", error);
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao reagir.' });
      }
  };

  // Extrai reações se existirem
  const reactions: any[] = (message as any).reactions || [];

  return (
    <div 
        className={cn("flex items-center gap-3 w-full group/message relative", isMe ? "justify-end" : "justify-start")}
        onMouseLeave={() => setShowReactionMenu(false)}
    >
        
        {/* Checkbox de Seleção */}
        {isSelectionMode && (
            <div className="animate-in fade-in zoom-in duration-200">
                <Checkbox 
                    checked={isSelected}
                    onCheckedChange={() => onSelect && onSelect()}
                    className="h-5 w-5 border-zinc-600 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
            </div>
        )}

        {/* Botão de Reação (Hover) */}
        {!isSelectionMode && !(message as any).is_deleted && (
            <div className={cn(
                "absolute opacity-0 group-hover/message:opacity-100 transition-opacity z-20",
                isMe ? "left-auto right-full mr-2" : "left-full ml-2"
            )}>
                <button 
                    onClick={() => setShowReactionMenu(!showReactionMenu)}
                    className="p-1.5 bg-zinc-800 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-700 shadow-md border border-zinc-700"
                >
                    <Smile className="w-4 h-4" />
                </button>

                {/* Menu de Emojis Rápidos */}
                {showReactionMenu && (
                    <div className={cn(
                        "absolute top-0 flex gap-1 bg-zinc-900 border border-zinc-800 p-1.5 rounded-full shadow-xl animate-in zoom-in slide-in-from-bottom-2",
                        isMe ? "right-0 mr-8" : "left-0 ml-8"
                    )}>
                        {COMMON_EMOJIS.map(emoji => (
                            <button 
                                key={emoji} 
                                onClick={() => handleReact(emoji)}
                                className="w-8 h-8 flex items-center justify-center hover:bg-zinc-800 rounded-full text-lg transition-transform hover:scale-125"
                            >
                                {emoji}
                            </button>
                        ))}
                        {/* Botão + para futuro picker completo */}
                        <button className="w-8 h-8 flex items-center justify-center hover:bg-zinc-800 rounded-full text-zinc-500">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>
        )}

        {/* Bolha da Mensagem - OTIMIZADA: SEM TRANSITION-ALL */}
        <div 
            onClick={() => isSelectionMode && onSelect && onSelect()}
            className={cn(
                "relative shadow-sm flex flex-col min-w-[120px] max-w-[85%] md:max-w-[75%] break-words rounded-lg p-1.5 cursor-pointer",
                // Cores Oficiais
                isMe 
                    ? "bg-[#005c4b] text-white rounded-tr-none" 
                    : "bg-zinc-800 text-zinc-100 rounded-tl-none",
                // Estilo Seleção
                isSelectionMode && isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-zinc-950 bg-opacity-80" : "",
                // Hover leve (opacidade apenas, barato para GPU)
                !isSelectionMode && "hover:bg-opacity-90",
                // Mensagem deletada style
                (message as any).is_deleted && "bg-opacity-50 italic text-zinc-400"
            )}
        >
            {/* Nome em Grupos (Apenas recebidas) */}
            {!isMe && message.contact?.push_name && (
                <span className="text-[10px] font-bold text-orange-400 px-1 mb-0.5 truncate max-w-[200px] block">
                    {message.contact.push_name}
                </span>
            )}

            {/* Conteúdo */}
            <div className="px-1.5 pb-1">
                {(message as any).is_deleted ? (
                    <div className="flex items-center gap-2 text-sm">
                        <Ban className="w-4 h-4" /> <span>Mensagem apagada</span>
                    </div>
                ) : (
                    <MessageContent message={message} />
                )}
            </div>

            {/* Rodapé Metadados */}
            <div className={cn(
                "flex justify-end items-end gap-1 px-1 mt-auto select-none",
                "-mt-1" 
            )}>
                <span className={cn(
                    "text-[10px] leading-none mb-0.5",
                    isMe ? "text-emerald-100/70" : "text-zinc-400"
                )}>
                    {formatTime(message.created_at)}
                </span>

                {isMe && (
                    <div className="mb-[1px]">
                        {renderStatusIcon()}
                    </div>
                )}
            </div>
            
            {/* Pontinha da Bolha */}
            {!isSelectionMode && (
                <div className={cn(
                    "absolute top-0 w-3 h-3 -z-10",
                    isMe 
                        ? "-right-1.5 bg-[#005c4b] [clip-path:polygon(0_0,100%_0,0_100%)] rounded-sm" 
                        : "-left-1.5 bg-zinc-800 [clip-path:polygon(0_0,100%_0,100%_100%)] rounded-sm"
                )} />
            )}

            {/* Reações (Display) */}
            {reactions.length > 0 && (
                <div className="absolute -bottom-3 right-0 flex items-center gap-1 z-10">
                    <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded-full px-1.5 py-0.5 shadow-md">
                        {reactions.slice(0, 3).map((r, i) => (
                            <span key={i} className="text-[10px] animate-in zoom-in cursor-default" title={r.actor}>{r.text}</span>
                        ))}
                        {reactions.length > 1 && (
                            <span className="text-[9px] text-zinc-400 ml-1">{reactions.length}</span>
                        )}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
}
