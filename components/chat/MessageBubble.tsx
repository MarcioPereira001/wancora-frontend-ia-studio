
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Message } from '@/types';
import { MessageContent } from './MessageContent';
import { Check, CheckCheck, Clock, Ban, ChevronDown, Trash2, Info, SmilePlus } from 'lucide-react';
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
const REVOKE_WINDOW_MS = 24 * 60 * 60 * 1000; 

export function MessageBubble({ message, isSelectionMode, isSelected, onSelect }: MessageBubbleProps) {
  const isMe = message.from_me;
  const { user } = useAuthStore();
  const { addToast } = useToast();
  
  const [showMenu, setShowMenu] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const menuRef = useRef<HTMLDivElement>(null);

  // FIXED: Removemos a validação 'EMPTY' hardcoded que poderia esconder mensagens válidas do backend antigo
  if (!message) return null;

  const isSticker = message.message_type === 'sticker';

  useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
          if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
              setShowMenu(false);
          }
      }
      if (showMenu) {
          document.addEventListener("mousedown", handleClickOutside);
      }
      return () => { document.removeEventListener("mousedown", handleClickOutside); };
  }, [showMenu]);

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderStatusIcon = () => {
    if (!isMe) return null;
    const status = message.status;
    const iconClass = "w-[15px] h-[15px]"; 
    if (status === 'sending') return <Clock className={cn(iconClass, "text-zinc-500")} />;
    if (status === 'sent') return <Check className={cn(iconClass, "text-zinc-400")} />;
    if (status === 'delivered') return <CheckCheck className={cn(iconClass, "text-zinc-400")} />; 
    if (status === 'read' || status === 'played') return <CheckCheck className={cn(iconClass, "text-blue-400")} />;
    return <Check className={cn(iconClass, "text-zinc-400")} />;
  };

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

  const reactions: any[] = (message as any).reactions || [];
  
  const reactionCounts = React.useMemo(() => {
      if (!Array.isArray(reactions) || reactions.length === 0) return null;
      const counts: Record<string, number> = {};
      reactions.filter(r => r.text).forEach(r => {
          counts[r.text] = (counts[r.text] || 0) + 1;
      });
      const entries = Object.entries(counts);
      if (entries.length === 0) return null;
      return entries.sort((a,b) => b[1] - a[1]);
  }, [reactions]);

  const isDeleted = (message as any).is_deleted;
  
  if (isDeleted) {
      return (
          <div className={cn(
            "flex w-full mb-1 relative z-0",
            isMe ? "justify-end" : "justify-start"
          )}>
              <div className="flex items-center gap-2 text-xs py-1.5 px-3 rounded-lg bg-zinc-900/40 border border-zinc-800/50 text-zinc-600 italic select-none">
                  <Ban className="w-3.5 h-3.5" /> <span>Mensagem apagada</span>
              </div>
          </div>
      );
  }

  return (
    <div 
        className={cn(
            "flex items-start gap-2 w-full group/message relative", 
            isMe ? "justify-end" : "justify-start", 
            reactionCounts ? "mb-5" : "mb-1",
            showMenu ? "z-50" : "z-auto" // Z-Index fix para menu
        )}
    >
        {isSelectionMode && (
            <div className="self-center animate-in fade-in zoom-in duration-200">
                <Checkbox 
                    checked={isSelected}
                    onCheckedChange={() => onSelect && onSelect()}
                    className="h-5 w-5 border-zinc-600 data-[state=checked]:bg-primary"
                />
            </div>
        )}

        <div className="relative max-w-[85%] md:max-w-[70%] flex flex-col">
            
            {!isSelectionMode && (
                <div 
                    ref={menuRef}
                    className={cn(
                        "absolute top-0 opacity-0 group-hover/message:opacity-100 transition-all duration-200 z-50",
                        isMe ? "-left-8" : "-right-8"
                    )}
                >
                    <div className="relative">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} 
                            className={cn(
                                "w-7 h-7 rounded-full border flex items-center justify-center shadow-xl transition-colors",
                                showMenu ? "bg-zinc-700 border-zinc-500 text-white" : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                            )}
                        >
                            <ChevronDown className="w-4 h-4" />
                        </button>

                        {showMenu && (
                            <>
                                <div className="fixed inset-0 z-[60]" onClick={() => setShowMenu(false)} />
                                
                                <div className={cn(
                                    "absolute top-8 bg-zinc-900 border border-zinc-800 rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.8)] p-1 min-w-[220px] animate-in zoom-in-95 origin-top z-[70] ring-1 ring-white/10",
                                    isMe ? "right-0" : "left-0"
                                )}>
                                    <div className="flex gap-1 p-2 bg-zinc-950/50 rounded-lg mb-1 justify-between">
                                        {COMMON_EMOJIS.slice(0, 5).map(emoji => (
                                            <button key={emoji} onClick={() => handleReact(emoji)} className="hover:scale-125 transition-transform text-lg p-1">
                                                {emoji}
                                            </button>
                                        ))}
                                        <button className="hover:bg-zinc-800 rounded p-1 text-zinc-500"><SmilePlus className="w-4 h-4" /></button>
                                    </div>
                                    {isMe && (
                                        <button onClick={() => { setShowMenu(false); setShowInfo(true); }} className="flex items-center gap-2 px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 rounded text-left w-full transition-colors">
                                            <Info className="w-4 h-4" /> Dados da mensagem
                                        </button>
                                    )}
                                    <button onClick={() => { setShowMenu(false); setShowDeleteModal(true); }} className="flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded text-left w-full transition-colors">
                                        <Trash2 className="w-4 h-4" /> Apagar mensagem
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            <div 
                className={cn(
                    "relative flex flex-col min-w-[100px] break-words rounded-xl p-1.5 cursor-pointer transition-all duration-300",
                    isSticker ? "bg-transparent shadow-none border-none p-0" : "border",
                    !isSticker && isMe ? "bg-[#005c4b] text-white rounded-tr-none border-[#005c4b] shadow-[0_4px_15px_-3px_rgba(34,197,94,0.3)]" : "",
                    !isSticker && !isMe ? "bg-zinc-800 text-zinc-100 rounded-tl-none border-zinc-700 shadow-[0_4px_15px_-3px_rgba(59,130,246,0.2)]" : "",
                    isSelectionMode && isSelected ? "ring-2 ring-primary ring-offset-2 ring-offset-zinc-950 opacity-90" : ""
                )}
                onClick={() => isSelectionMode && onSelect && onSelect()}
            >
                {!isMe && !isSticker && message.contact?.push_name && (
                    <span className="text-[11px] font-bold text-orange-400 px-1 mb-0.5 truncate max-w-[200px] block opacity-90">
                        {message.contact.push_name}
                    </span>
                )}

                <div className={cn(!isSticker && "px-1 pb-1")}>
                    <MessageContent message={message} />
                </div>

                <div className={cn("flex justify-end items-end gap-1 px-1 mt-auto select-none", !isSticker && "-mt-1", isSticker && "absolute bottom-1 right-2 bg-black/40 rounded-full px-1.5 py-0.5 backdrop-blur-sm")}>
                    <span className={cn("text-[10px] leading-none font-medium", isMe ? "text-emerald-100/70" : "text-zinc-300")}>
                        {formatTime(message.created_at)}
                    </span>
                    {isMe && <div className="mb-[1px]">{renderStatusIcon()}</div>}
                </div>

                {!isSelectionMode && !isSticker && (
                    <div className={cn(
                        "absolute top-0 w-3 h-3 -z-10",
                        isMe 
                            ? "-right-1.5 bg-[#005c4b] [clip-path:polygon(0_0,100%_0,0_100%)] rounded-sm" 
                            : "-left-1.5 bg-zinc-800 [clip-path:polygon(0_0,100%_0,100%_100%)] rounded-sm"
                    )} />
                )}
            </div>

            {reactionCounts && (
                <div className={cn(
                    "absolute -bottom-2.5 z-20 flex gap-1 animate-in zoom-in duration-300",
                    isMe ? "right-1" : "left-1"
                )}>
                    <div className="flex items-center bg-zinc-800/95 backdrop-blur-md border border-zinc-700/50 rounded-full px-1.5 py-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.3)] hover:scale-110 transition-transform cursor-pointer gap-1 select-none ring-1 ring-black/20">
                        {reactionCounts.map(([emoji, count], i) => (
                            <span key={i} className="text-[11px] flex items-center text-white leading-none px-0.5">
                                {emoji} {count > 1 && <span className="text-[9px] text-zinc-400 ml-0.5 font-bold font-mono">{count}</span>}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>

        <MessageInfoModal message={message} isOpen={showInfo} onClose={() => setShowInfo(false)} />

        <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Apagar mensagem?" maxWidth="sm">
            <div className="space-y-4">
                <p className="text-sm text-zinc-400">Escolha como deseja apagar:</p>
                <div className="flex flex-col gap-2 justify-end">
                    {isMe && canRevoke() && (
                        <Button variant="destructive" onClick={() => handleDelete(true)} disabled={isDeleting} className="justify-start bg-zinc-800 border-zinc-700 text-red-400 hover:bg-red-500/10 w-full">
                            <Trash2 className="w-4 h-4 mr-2" /> Apagar para todos
                        </Button>
                    )}
                    <Button variant="outline" onClick={() => handleDelete(false)} disabled={isDeleting} className="justify-start border-zinc-700 w-full hover:bg-zinc-800 text-zinc-300">
                        <Ban className="w-4 h-4 mr-2" /> Apagar para mim
                    </Button>
                    <Button variant="ghost" onClick={() => setShowDeleteModal(false)} className="mt-2 w-full text-zinc-500">Cancelar</Button>
                </div>
            </div>
        </Modal>
    </div>
  );
}