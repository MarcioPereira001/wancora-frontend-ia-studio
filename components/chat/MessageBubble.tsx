'use client';

import React from 'react';
import { Message } from '@/types';
import { MessageContent } from './MessageContent';
import { Check, CheckCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';

interface MessageBubbleProps {
  message: Message;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

export function MessageBubble({ message, isSelectionMode, isSelected, onSelect }: MessageBubbleProps) {
  const isMe = message.from_me;
  
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

  return (
    <div className={cn("flex items-center gap-3 w-full", isMe ? "justify-end" : "justify-start")}>
        
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
                !isSelectionMode && "hover:bg-opacity-90"
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
                <MessageContent message={message} />
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
        </div>
    </div>
  );
}
