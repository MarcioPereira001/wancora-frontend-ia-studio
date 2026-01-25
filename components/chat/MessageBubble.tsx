'use client';

import React, { useState } from 'react';
import { Message } from '@/types';
import { MessageContent } from './MessageContent';
import { Check, CheckCheck, Clock, Ban, ChevronDown, Trash2, Info, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { api } from '@/services/api';
import { useToast } from '@/hooks/useToast';
import { useAuthStore } from '@/store/useAuthStore';
import { MessageInfoModal } from './MessageInfoModal';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';

interface MessageBubbleProps {
  message: Message;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const REVOKE_WINDOW_MS = 72 * 60 * 60 * 1000; 

export function MessageBubble({ message, isSelectionMode, isSelected, onSelect }: MessageBubbleProps) {
  const isMe = message.from_me;
  const { user } = useAuthStore();
  const { addToast } = useToast();
  
  // States
  const [showMenu, setShowMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Format Time (HH:mm)
  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Status Icon Logic (Realtime - The Hammer)
  const renderStatusIcon = () => {
    if (!isMe) return null;

    const status = message.status;
    const iconClass = "w-[15px] h-[15px]"; 

    if (status === 'sending') return <Clock className={cn(iconClass, "text-zinc-400")} />;
    if (status === 'sent') return <Check className={cn(iconClass, "text-zinc-400")} />;
    if (status === 'delivered') return <CheckCheck className={cn(iconClass, "text-zinc-400")} />;
    if (status === 'read' || status === 'played' || (message as any).read_at) return <CheckCheck className={cn(iconClass, "text-blue-400")} />;

    return <Check className={cn(iconClass, "text-zinc-400")} />;
  };

  // Handlers
  const handleReact = async (emoji: string) => {
      setShowMenu(false);
      try {
          await api.post('/message/react', {
              sessionId: message.session_id,
              companyId: message.company_id,
              remoteJid: message.remote_jid,
              msgId: message.id,
              reaction: emoji
          });
      } catch (error) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao reagir.' });
      }
  };

  const handleDelete = async (everyone: boolean) => {
      setIsDeleting(true);
      try {
          await api.post('/message/delete', {
              sessionId: message.session_id,
              companyId: message.company_id,
              remoteJid: message.remote_jid,
              msgId: message.id,
              everyone
          });
          setShowDeleteModal(false);
      } catch (error) {
          addToast({ type: 'error', title: 'Erro', message: 'Falha ao apagar.' });
      } finally {
          setIsDeleting(false);
      }
  };

  const canRevoke = () => {
      if (!message.created_at) return false;
      const msgTime = new Date(message.created_at).getTime();
      const now = Date.now();
      return (now - msgTime) < REVOKE_WINDOW_MS;
  };

  // Agrupamento de Reações
  const reactions: any[] = (message as any).reactions || [];
  const groupedReactions = React.useMemo(() => {
      const counts: Record<string, number> = {};
      reactions.forEach(r => { counts[r.text] = (counts[r.text] || 0) + 1; });
      return Object.entries(counts).sort((a,b) => b[1] - a[1]);
  }, [reactions]);

  return (
    <div 
        className={cn("flex items-start gap-2 w-full group/message relative mb-3", isMe ? "justify-end" : "justify-start")}
        onMouseLeave={() => setShowMenu(false)}
    >
        
        {/* 1. CHECKBOX SELEÇÃO */}
        {isSelectionMode && (
            <div className="self-center animate-in fade-in zoom-in duration-200">
                <Checkbox 
                    checked={isSelected}
                    onCheckedChange={() => onSelect && onSelect()}
                    className="h-5 w-5 border-zinc-600 data-[state=checked]:bg-primary"
                />
            </div>
        )}

        {/* 2. MENU FLUTUANTE (LATERAL) */}
        {!isSelectionMode && !(message as any).is_deleted && (
            <div className={cn(
                "opacity-0 group-hover/message:opacity-100 transition-opacity flex items-center self-start mt-1",
                isMe ? "order-1 mr-1" : "order-2 ml-1"
            )}>
                <button 
                    onClick={() => setShowMenu(!showMenu)} 
                    className="w-6 h-6 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 shadow-md transition-colors"
                >
                    <ChevronDown className="w-4 h-4" />
                </button>

                {showMenu && (
                    <div className={cn(
                        "absolute top-6 z-50 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-1 min-w-[180px] animate-in zoom-in-95 origin-top-left flex flex-col gap-1",
                        isMe ? "right-0" : "left-0"
                    )}>
                        {/* Emojis Rápidos */}
                        <div className="flex gap-1 p-2 bg-zinc-950/50 rounded-lg mb-1 justify-between">
                            {COMMON_EMOJIS.slice(0, 5).map(emoji => (
                                <button key={emoji} onClick={() => handleReact(emoji)} className="hover:scale-125 transition-transform text-lg">
                                    {emoji}
                                </button>
                            ))}
                        </div>
                        
                        {/* Ações */}
                        {isMe && (
                            <button onClick={() => { setShowMenu(false); setShowInfo(true); }} className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 rounded text-left">
                                <Info className="w-4 h-4" /> Dados da mensagem
                            </button>
                        )}
                        <button onClick={() => { setShowMenu(false); setShowDeleteModal(true); }} className="flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded text-left">
                            <Trash2 className="w-4 h-4" /> Apagar mensagem
                        </button>
                    </div>
                )}
            </div>
        )}

        {/* 3. BOLHA DA MENSAGEM */}
        <div className={cn(isMe ? "order-2" : "order-1", "max-w-[85%] md:max-w-[75%] relative")}>
            
            {/* 3.1. Container Principal */}
            <div 
                className={cn(
                    "relative shadow-sm flex flex-col min-w-[120px] break-words rounded-lg p-1.5 cursor-pointer border",
                    isMe 
                        ? "bg-[#005c4b] text-white rounded-tr-none border-[#005c4b]" 
                        : "bg-zinc-800 text-zinc-100 rounded-tl-none border-zinc-700",
                    isSelectionMode && isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-zinc-950 opacity-80" : "",
                    (message as any).is_deleted && "bg-zinc-900/50 border-zinc-800 text-zinc-500 italic"
                )}
                onClick={() => isSelectionMode && onSelect && onSelect()}
            >
                {/* 3.2. Nome em Grupos */}
                {!isMe && message.contact?.push_name && (
                    <span className="text-[10px] font-bold text-orange-400 px-1 mb-0.5 truncate max-w-[200px] block">
                        {message.contact.push_name}
                    </span>
                )}

                {/* 3.3. Conteúdo Real */}
                <div className="px-1.5 pb-1">
                    {(message as any).is_deleted ? (
                        <div className="flex items-center gap-2 text-sm py-1">
                            <Ban className="w-4 h-4" /> <span>⊘ Mensagem apagada</span>
                        </div>
                    ) : (
                        <MessageContent message={message} />
                    )}
                </div>

                {/* 3.4. Rodapé (Hora + Ticks) */}
                <div className={cn("flex justify-end items-end gap-1 px-1 mt-auto select-none -mt-1")}>
                    <span className={cn("text-[10px] leading-none mb-0.5", isMe ? "text-emerald-100/70" : "text-zinc-400")}>
                        {formatTime(message.created_at)}
                    </span>
                    {isMe && <div className="mb-[1px]">{renderStatusIcon()}</div>}
                </div>

                {/* 3.5. Pontinha da Bolha (Triângulo) */}
                {!isSelectionMode && (
                    <div className={cn(
                        "absolute top-0 w-3 h-3 -z-10",
                        isMe 
                            ? "-right-1.5 bg-[#005c4b] [clip-path:polygon(0_0,100%_0,0_100%)] rounded-sm" 
                            : "-left-1.5 bg-zinc-800 [clip-path:polygon(0_0,100%_0,100%_100%)] rounded-sm"
                    )} />
                )}
            </div>

            {/* 4. REAÇÕES VISUAIS (Agrupadas e Estilizadas) */}
            {reactions.length > 0 && !(message as any).is_deleted && (
                <div className={cn(
                    "absolute -bottom-3 z-20 flex gap-1 animate-in zoom-in duration-300",
                    isMe ? "right-0" : "left-0"
                )}>
                    <div className="flex items-center bg-zinc-900 border border-zinc-700 rounded-full px-1.5 py-0.5 shadow-md scale-90 hover:scale-105 transition-transform cursor-pointer gap-1">
                        {groupedReactions.map(([emoji, count], i) => (
                            <span key={i} className="text-[11px] flex items-center">
                                {emoji} {count > 1 && <span className="text-[9px] text-zinc-400 ml-0.5">{count}</span>}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>

        {/* MODAIS INTERNOS */}
        <MessageInfoModal 
            message={message} 
            isOpen={showInfo} 
            onClose={() => setShowInfo(false)} 
        />

        <Modal 
            isOpen={showDeleteModal} 
            onClose={() => setShowDeleteModal(false)} 
            title="Apagar mensagem?"
            maxWidth="sm"
        >
            <div className="space-y-4">
                <p className="text-sm text-zinc-400">Você pode apagar mensagens apenas para você ou para todos os participantes.</p>
                <div className="flex flex-col gap-2 justify-end">
                    {/* AQUI ESTÁ A TRAVA DE SEGURANÇA (72H) */}
                    {isMe && (
                        <div className="flex flex-col gap-1 w-full">
                            <Button 
                                variant="destructive" 
                                onClick={() => handleDelete(true)} 
                                disabled={isDeleting || !canRevoke()}
                                className="justify-start bg-zinc-800 border-zinc-700 text-red-400 hover:bg-red-500/10 w-full"
                            >
                                Apagar para todos (Revoke)
                            </Button>
                            {!canRevoke() && (
                                <span className="text-[10px] text-zinc-500 flex items-center gap-1 pl-1">
                                    <AlertTriangle className="w-3 h-3 text-yellow-500" /> 
                                    Indisponível para mensagens antigas (Segurança Anti-Ban)
                                </span>
                            )}
                        </div>
                    )}
                    <Button 
                        variant="outline" 
                        onClick={() => handleDelete(false)} 
                        disabled={isDeleting}
                        className="justify-start border-zinc-700 w-full"
                    >
                        Apagar para mim
                    </Button>
                    <Button variant="ghost" onClick={() => setShowDeleteModal(false)} className="mt-2 w-full">Cancelar</Button>
                </div>
            </div>
        </Modal>
    </div>
  );
}