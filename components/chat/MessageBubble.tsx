'use client';

import React from 'react';
import { Message } from '@/types';
import { MessageContent } from './MessageContent';
import { Check, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isMe = message.from_me;
  
  return (
    <div className={cn(
        "relative group shadow-sm text-sm max-w-full overflow-hidden",
        // Classes de container são aplicadas no pai (ChatPage), aqui focamos no conteúdo interno
        // Mas para garantir compatibilidade com código existente, aplicamos estilo básico
    )}>
        {/* Renderizador de Conteúdo Especializado */}
        <MessageContent message={message} />

        {/* Metadata (Hora e Status) */}
        <div className={cn(
            "flex justify-end mt-1 text-[9px] items-center gap-1 select-none",
            isMe ? "text-primary/60" : "text-zinc-500"
        )}>
            {message.created_at && (
                <span className="opacity-80">
                    {new Date(message.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'})}
                </span>
            )}
            
            {isMe && (
                <span title={message.status}>
                    {message.status === 'read' ? (
                        <CheckCheck className="w-3 h-3 text-blue-400" />
                    ) : message.status === 'delivered' ? (
                        <CheckCheck className="w-3 h-3" />
                    ) : (
                        <Check className="w-3 h-3 opacity-70" />
                    )}
                </span>
            )}
        </div>
    </div>
  );
}