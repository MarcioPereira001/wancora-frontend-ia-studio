
'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { Message } from '@/types';
import { Check, CheckCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MessageInfoModalProps {
  message: Message | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MessageInfoModal({ message, isOpen, onClose }: MessageInfoModalProps) {
  if (!message) return null;

  const formatDate = (dateString?: string) => {
    if (!dateString) return '--:--';
    return new Date(dateString).toLocaleString('pt-BR', { 
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Dados da Mensagem" maxWidth="sm">
        <div className="space-y-6 p-2">
            <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800 text-sm text-zinc-300 italic text-center">
                "{message.content || 'Mídia'}"
            </div>

            <div className="space-y-4">
                {/* LIDO */}
                <div className="flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center bg-zinc-900 border border-zinc-800", (message as any).read_at ? "text-blue-500" : "text-zinc-600")}>
                        <CheckCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="font-bold text-white text-sm">Lida</p>
                        <p className="text-xs text-zinc-500">
                            {(message as any).read_at ? formatDate((message as any).read_at) : 'Ainda não lida'}
                        </p>
                    </div>
                </div>

                {/* ENTREGUE */}
                <div className="flex items-center gap-4">
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center bg-zinc-900 border border-zinc-800", (message as any).delivered_at ? "text-zinc-300" : "text-zinc-600")}>
                        <CheckCheck className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="font-bold text-white text-sm">Entregue</p>
                        <p className="text-xs text-zinc-500">
                            {(message as any).delivered_at ? formatDate((message as any).delivered_at) : 'Ainda não entregue'}
                        </p>
                    </div>
                </div>

                {/* ENVIADO */}
                <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center bg-zinc-900 border border-zinc-800 text-zinc-300">
                        <Check className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="font-bold text-white text-sm">Enviada</p>
                        <p className="text-xs text-zinc-500">
                            {formatDate(message.created_at)}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </Modal>
  );
}
