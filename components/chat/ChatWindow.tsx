
'use client';

import React, { useEffect, useRef, useLayoutEffect, useState } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { ArrowDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSound } from '@/hooks/useSound';
import { api } from '@/services/api'; 

const MESSAGES_PER_PAGE = 30;

export function ChatWindow() {
  const supabase = createClient();
  const { user } = useAuthStore();
  const { play } = useSound();
  const { 
      activeContact, selectedInstance, messages, setMessages, 
      loadingMessages, setLoadingMessages, 
      hasMoreMessages, setHasMoreMessages,
      isMsgSelectionMode, selectedMsgIds, toggleMessageSelection 
  } = useChatStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [showScrollButton, setShowScrollButton] = useState(false);
  
  const lastScrollTime = useRef(0);
  const prevMessagesLength = useRef(messages.length);

  // Efeito de SOM
  useEffect(() => {
      if (messages.length > prevMessagesLength.current) {
          const lastMsg = messages[messages.length - 1];
          if (!lastMsg.from_me) {
              play('message');
              
              if (activeContact && selectedInstance && lastMsg.remote_jid === activeContact.remote_jid) {
                   api.post('/message/read', {
                       sessionId: selectedInstance.session_id,
                       companyId: user?.company_id,
                       remoteJid: activeContact.remote_jid
                   }).catch(() => {});
              }
          }
      }
      prevMessagesLength.current = messages.length;
  }, [messages, play, activeContact, selectedInstance, user?.company_id]);

  useLayoutEffect(() => {
      if (messagesEndRef.current && !fetchingMore && !loadingMessages) {
          const container = scrollContainerRef.current;
          if (container) {
              const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
              if (isNearBottom || messages.length <= MESSAGES_PER_PAGE) {
                  messagesEndRef.current.scrollIntoView({ behavior: "auto" });
              }
          }
      }
  }, [messages.length, activeContact?.id]); 

  const loadMessages = async (offset: number) => {
      if(!activeContact || !user?.company_id) return [];
      
      const { data, error } = await supabase
        .from('messages')
        .select(`*`) 
        .eq('remote_jid', activeContact.remote_jid) 
        .eq('company_id', user.company_id)
        .order('created_at', { ascending: false })
        .range(offset, offset + MESSAGES_PER_PAGE - 1);
        
      if (error) {
          console.error("Erro fetchMessages:", error);
          return [];
      }
      return (data || []).reverse(); 
  };

  useEffect(() => {
      if (!activeContact || !selectedInstance) return;

      const initChat = async () => {
          setLoadingMessages(true);
          setHasMoreMessages(true);
          const initialMsgs = await loadMessages(0);
          setMessages(initialMsgs);
          setLoadingMessages(false);
          
          if (user?.company_id) {
              api.post('/message/read', {
                  sessionId: selectedInstance.session_id,
                  companyId: user.company_id,
                  remoteJid: activeContact.remote_jid
              }).catch(err => console.error("Falha ao marcar lido:", err));
          }

          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "auto" }), 50);
      };

      initChat();
  }, [activeContact?.id, selectedInstance?.session_id]); 

  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
      const container = e.currentTarget;
      const now = Date.now();
      
      const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowScrollButton(distanceFromBottom > 300);

      if (now - lastScrollTime.current < 200) return;
      lastScrollTime.current = now;

      if (container.scrollTop < 100 && hasMoreMessages && !fetchingMore) {
          setFetchingMore(true);
          const currentHeight = container.scrollHeight; 
          const currentTopMsgId = messages.length > 0 ? messages[0].id : null;

          const olderMessages = await loadMessages(messages.length);
          
          if (olderMessages.length > 0) {
              if (currentTopMsgId && olderMessages[olderMessages.length - 1].id === currentTopMsgId) {
                  olderMessages.pop();
              }

              setMessages(prev => [...olderMessages, ...prev]);
              
              requestAnimationFrame(() => { 
                  if (scrollContainerRef.current) {
                      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight - currentHeight; 
                  }
              });
          } else { 
              setHasMoreMessages(false); 
          }
          setFetchingMore(false);
      }
  };

  const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex-1 relative flex flex-col overflow-hidden bg-[#0b0b0d] z-0">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" 
             style={{ 
                 backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` 
             }} 
        />

        <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 relative custom-scrollbar z-10 w-full" 
        >
            {fetchingMore && (
                <div className="flex justify-center py-2">
                    <Loader2 className="w-5 h-5 text-zinc-500 animate-spin" />
                </div>
            )}

            {!hasMoreMessages && messages.length > 0 && (
                <div className="text-center py-6">
                    <span className="text-xs text-zinc-600 bg-zinc-900/50 px-3 py-1 rounded-full border border-zinc-800 select-none">
                        Início da conversa
                    </span>
                </div>
            )}

            {messages.map((msg, idx) => {
                // FIXED: Lógica mais permissiva para evitar que mensagens válidas fiquem invisíveis
                // Se tiver media_url, exibe. Se tiver content, exibe. Se não tiver nada, só aí ignora.
                if (!msg.content && !msg.media_url && !msg.message_type) return null;

                return (
                    <div key={msg.id || idx} className={`flex w-full mb-1`}>
                        <MessageBubble 
                            message={msg} 
                            isSelectionMode={isMsgSelectionMode}
                            isSelected={selectedMsgIds.has(msg.id)}
                            onSelect={() => toggleMessageSelection(msg.id)}
                        />
                    </div>
                );
            })}
            
            <div ref={messagesEndRef} className="h-1" />
        </div>

        <div className={cn(
            "absolute bottom-4 right-4 z-20 transition-all duration-300 transform",
            showScrollButton ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0 pointer-events-none"
        )}>
            <Button 
                onClick={scrollToBottom} 
                size="icon" 
                className="rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 shadow-xl backdrop-blur-md w-10 h-10"
            >
                <ArrowDown className="w-5 h-5" />
            </Button>
        </div>
    </div>
  );
}