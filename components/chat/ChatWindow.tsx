'use client';

import React, { useEffect, useRef } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';

const MESSAGES_PER_PAGE = 30;

export function ChatWindow() {
  const supabase = createClient();
  const { user } = useAuthStore();
  const { 
      activeContact, messages, setMessages, 
      loadingMessages, setLoadingMessages, 
      hasMoreMessages, setHasMoreMessages,
      isMsgSelectionMode, selectedMsgIds, toggleMessageSelection 
  } = useChatStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [fetchingMore, setFetchingMore] = React.useState(false);

  const scrollToBottom = (behavior: 'auto' | 'smooth' = 'smooth') => {
      messagesEndRef.current?.scrollIntoView({ behavior });
  };

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

  // Carga Inicial
  useEffect(() => {
      if (!activeContact) return;

      const initChat = async () => {
          setLoadingMessages(true);
          setMessages([]);
          setHasMoreMessages(true);
          
          const initialMsgs = await loadMessages(0);
          setMessages(initialMsgs);
          setLoadingMessages(false);
          setTimeout(() => scrollToBottom('auto'), 100);
      };

      initChat();
  }, [activeContact?.id]);

  // Scroll Handler (Pagination)
  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
      const container = e.currentTarget;
      if (container.scrollTop < 50 && hasMoreMessages && !fetchingMore && !loadingMessages) {
          setFetchingMore(true);
          const currentHeight = container.scrollHeight; 
          const olderMessages = await loadMessages(messages.length);
          
          if (olderMessages.length > 0) {
              setMessages(prev => [...olderMessages, ...prev]);
              // Mantém a posição do scroll
              setTimeout(() => { 
                  if (scrollContainerRef.current) 
                      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight - currentHeight; 
              }, 0);
          } else { 
              setHasMoreMessages(false); 
          }
          setFetchingMore(false);
      }
  };

  // Auto-scroll on new message (se estiver perto do fim)
  useEffect(() => {
      if (messages.length > 0 && !fetchingMore && !loadingMessages) {
          // Lógica simples: se for a primeira carga ou msg nova, scroll.
          // Refinamento: Só scrollar se usuário já estiver no fim.
          // Por enquanto, scrollamos sempre para garantir UX de chat em tempo real.
          setTimeout(() => scrollToBottom('smooth'), 100);
      }
  }, [messages.length]);

  return (
    <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 relative custom-scrollbar" 
        style={{ backgroundImage: 'radial-gradient(circle at center, rgba(34, 197, 94, 0.03) 0%, transparent 70%)' }}
    >
        {fetchingMore && <div className="flex justify-center py-2"><Loader2 className="w-5 h-5 text-primary/50 animate-spin" /></div>}
        {!hasMoreMessages && !loadingMessages && messages.length > 0 && <div className="text-center py-4 text-xs text-zinc-600">Início da conversa</div>}

        {loadingMessages ? (
            <div className="flex h-full items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary/50" /></div>
        ) : messages.map((msg, idx) => (
            <div key={msg.id || idx} className={`flex w-full mb-1`}>
                <MessageBubble 
                    message={msg} 
                    isSelectionMode={isMsgSelectionMode}
                    isSelected={selectedMsgIds.has(msg.id)}
                    onSelect={() => toggleMessageSelection(msg.id)}
                />
            </div>
        ))}
        <div ref={messagesEndRef} />
    </div>
  );
}