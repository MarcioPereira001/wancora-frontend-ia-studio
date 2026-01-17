'use client';

import React, { useEffect, useRef, useLayoutEffect } from 'react';
import { useChatStore } from '@/store/useChatStore';
import { MessageBubble } from '@/components/chat/MessageBubble';
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

  // PERFORMANCE: Use useLayoutEffect para scrollar ANTES do browser pintar a tela
  // Isso elimina o "pulo" visual e remove a necessidade de setTimeout
  useLayoutEffect(() => {
      if (messagesEndRef.current && !fetchingMore && !loadingMessages) {
          messagesEndRef.current.scrollIntoView({ behavior: "auto" });
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

  // Carga Inicial - INSTANTÂNEA (Sem Delay Artificial)
  useEffect(() => {
      if (!activeContact) return;

      const initChat = async () => {
          // Não setamos loadingMessages visualmente para evitar piscar spinners
          setHasMoreMessages(true);
          
          const initialMsgs = await loadMessages(0);
          
          setMessages(initialMsgs);
          // O scroll é tratado pelo useLayoutEffect acima automaticamente
      };

      initChat();
  }, [activeContact?.id]);

  // Scroll Handler (Pagination)
  const handleScroll = async (e: React.UIEvent<HTMLDivElement>) => {
      const container = e.currentTarget;
      // Trigger a 50px do topo
      if (container.scrollTop < 50 && hasMoreMessages && !fetchingMore) {
          setFetchingMore(true);
          const currentHeight = container.scrollHeight; 
          const olderMessages = await loadMessages(messages.length);
          
          if (olderMessages.length > 0) {
              setMessages(prev => [...olderMessages, ...prev]);
              
              // Mantém a posição visual exata após carregar mensagens antigas
              // requestAnimationFrame é usado aqui apenas para garantir que o DOM atualizou a altura
              requestAnimationFrame(() => { 
                  if (scrollContainerRef.current) 
                      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight - currentHeight; 
              });
          } else { 
              setHasMoreMessages(false); 
          }
          setFetchingMore(false);
      }
  };

  return (
    <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 md:p-6 space-y-2 relative custom-scrollbar" 
        style={{ backgroundImage: 'radial-gradient(circle at center, rgba(34, 197, 94, 0.03) 0%, transparent 70%)' }}
    >
        {/* Aviso discreto de fim de histórico, sem spinners de carregamento no meio do chat */}
        {!hasMoreMessages && messages.length > 0 && (
            <div className="text-center py-4 text-xs text-zinc-600">Início da conversa</div>
        )}

        {messages.map((msg, idx) => (
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