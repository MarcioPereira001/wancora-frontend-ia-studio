
'use client';

import React, { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { Message } from '@/types';
import { cn } from '@/lib/utils';
import { Smartphone, Wifi, AlertCircle, ChevronDown, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';

// Atomic Components
import { ChatListSidebar } from '@/components/chat/ChatListSidebar';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { ChatInputArea } from '@/components/chat/ChatInputArea';
import { ChatSidebar } from '@/components/chat/ChatSidebar'; 

export default function ChatPage() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const router = useRouter();
  
  const { instances } = useRealtimeStore();
  const { 
      activeContact, activeLead, 
      selectedInstance,
      setMessages, setActiveLead,
      setSelectedInstance
  } = useChatStore();

  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);
  const [showInstanceMenu, setShowInstanceMenu] = useState(false);

  // --- AUTO-SELECT INSTANCE ---
  useEffect(() => {
      if (!selectedInstance && instances.length > 0) {
          const connected = instances.find(i => i.status === 'connected') || instances[0];
          if (connected) setSelectedInstance(connected);
      }
      // Se a instância selecionada sumiu, reseta
      if (selectedInstance && instances.length > 0 && !instances.find(i => i.session_id === selectedInstance.session_id)) {
          const connected = instances.find(i => i.status === 'connected') || instances[0];
          setSelectedInstance(connected || null);
      }
  }, [instances, selectedInstance, setSelectedInstance]);

  // --- IDENTITY UNIFICATION (LID) ---
  const linkIdentity = async (lidJid: string, phoneJid: string) => {
      if (!user?.company_id) return;
      try {
          await supabase.rpc('link_identities', {
              p_lid: lidJid,
              p_phone: phoneJid,
              p_company_id: user.company_id
          });
      } catch (e) {}
  };

  // --- REALTIME LISTENERS ---
  useEffect(() => {
      if(!activeContact || !user?.company_id) {
          setActiveLead(null);
          return;
      }
      const refreshLead = async () => {
          const cleanPhone = activeContact.remote_jid.split('@')[0].replace(/\D/g, '');
          const { data: lead } = await supabase.from('leads').select('*').eq('company_id', user.company_id).ilike('phone', `%${cleanPhone}%`).limit(1).maybeSingle();
          setActiveLead(lead);
      };
      refreshLead();
  }, [activeContact?.id, user?.company_id]);

  useEffect(() => {
      if (!user?.company_id) return;

      const channel = supabase
        .channel(`chat-room-global`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `company_id=eq.${user.company_id}` }, async (payload) => {
            const newMessage = payload.new as Message;
            
            if (activeContact && newMessage.remote_jid.includes('@lid') && activeContact.remote_jid.includes('@s.whatsapp.net')) {
                await linkIdentity(newMessage.remote_jid, activeContact.remote_jid);
            }

            if (activeContact && (newMessage.remote_jid === activeContact.remote_jid || newMessage.remote_jid.includes('@lid'))) {
                setMessages(prev => {
                    const filtered = prev.filter(m => {
                        const isTemp = m.id.startsWith('temp-') && m.status === 'sending';
                        const sameContent = (m.content === newMessage.content) || (m.media_url && m.media_url === newMessage.media_url);
                        return !(isTemp && sameContent);
                    });
                    
                    if (!filtered.find(m => m.id === newMessage.id)) {
                        return [...filtered, newMessage];
                    }
                    return filtered;
                });

                if (!newMessage.from_me) {
                    supabase.from('contacts').update({ unread_count: 0 }).eq('jid', activeContact.remote_jid).eq('company_id', user.company_id);
                }
            }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `company_id=eq.${user.company_id}` }, async (payload) => {
            const updatedMessage = payload.new as Message;
            if (activeContact && updatedMessage.remote_jid === activeContact.remote_jid) {
                setMessages(prev => prev.map(m => m.id === updatedMessage.id ? updatedMessage : m));
            }
        })
        .subscribe();

      return () => { supabase.removeChannel(channel); };
  }, [activeContact?.id, user?.company_id]);

  const refreshLeadData = async () => {
      if(!activeContact || !user?.company_id) return;
      const cleanPhone = activeContact.remote_jid.split('@')[0].replace(/\D/g, '');
      const { data: lead } = await supabase.from('leads').select('*').eq('company_id', user.company_id).ilike('phone', `%${cleanPhone}%`).limit(1).maybeSingle();
      setActiveLead(lead);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] md:h-[calc(100vh-2rem)] h-dvh md:h-[calc(100dvh-2rem)] gap-2">
      
      {/* 1. BARRA DE INSTÂNCIA GLOBAL (Novo) */}
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900/80 border border-zinc-800 rounded-xl backdrop-blur-sm shrink-0">
          <div className="flex items-center gap-2 relative">
             <button 
                onClick={() => setShowInstanceMenu(!showInstanceMenu)}
                className="flex items-center gap-2 hover:bg-zinc-800 p-1.5 rounded-lg transition-colors"
             >
                 <div className={cn(
                     "w-2 h-2 rounded-full",
                     selectedInstance?.status === 'connected' ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500"
                 )} />
                 <span className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                    {selectedInstance ? selectedInstance.name : "Selecione uma Instância"}
                    <ChevronDown className="w-3 h-3 text-zinc-500" />
                 </span>
             </button>

             {/* Dropdown de Instâncias */}
             {showInstanceMenu && (
                 <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowInstanceMenu(false)} />
                    <div className="absolute top-10 left-0 w-64 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl z-50 p-1 animate-in fade-in zoom-in-95">
                        <p className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Conexões Disponíveis</p>
                        {instances.map(inst => (
                            <button 
                                key={inst.id}
                                onClick={() => { setSelectedInstance(inst); setShowInstanceMenu(false); }}
                                className={cn(
                                    "w-full text-left px-3 py-2 text-sm rounded-lg flex items-center justify-between transition-colors mb-0.5",
                                    selectedInstance?.id === inst.id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                                )}
                            >
                                <span className="truncate">{inst.name}</span>
                                {inst.status === 'connected' ? <Wifi className="w-3 h-3 text-green-500" /> : <AlertCircle className="w-3 h-3 text-red-500" />}
                            </button>
                        ))}
                        <div className="h-px bg-zinc-800 my-1" />
                        <button 
                            onClick={() => router.push('/connections')}
                            className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-primary/10 rounded-lg flex items-center gap-2 transition-colors font-medium"
                        >
                            <Plus className="w-3 h-3" /> Nova Conexão
                        </button>
                    </div>
                 </>
             )}
          </div>
          
          <div className="text-xs text-zinc-500 hidden md:block">
              {selectedInstance?.session_id && <span className="font-mono opacity-50">ID: {selectedInstance.session_id.slice(0, 8)}...</span>}
          </div>
      </div>

      {/* 2. ÁREA DE CHAT (Grid Principal) */}
      <div className="flex flex-1 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/50 shadow-2xl relative">
        
        {/* LISTA LATERAL */}
        <ChatListSidebar />

        {/* JANELA DE CHAT */}
        <div className={cn("flex-1 flex-col bg-[#09090b] relative pb-safe transition-all duration-300", activeContact ? "flex" : "hidden md:flex")}>
            {activeContact && selectedInstance ? (
                <>
                    <ChatHeader onOpenDetails={() => setIsRightSidebarOpen(true)} />
                    <ChatWindow />
                    <ChatInputArea />
                </>
            ) : (
                <div className="flex h-full items-center justify-center flex-col text-zinc-500 bg-zinc-950/20 p-4 text-center select-none">
                    <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-zinc-800 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                        <Smartphone className="h-10 w-10 text-zinc-700" />
                    </div>
                    <h3 className="text-xl font-bold text-zinc-200 mb-2">Wancora CRM</h3>
                    <p className="text-sm opacity-60 max-w-xs">
                        {selectedInstance ? "Selecione uma conversa para iniciar." : "Conecte uma instância WhatsApp para começar."}
                    </p>
                </div>
            )}
        </div>

        {/* SIDEBAR DIREITA */}
        {activeContact && selectedInstance && isRightSidebarOpen && (
            <ChatSidebar 
                contact={activeContact} 
                lead={activeLead} 
                refreshLead={refreshLeadData} 
                onClose={() => setIsRightSidebarOpen(false)}
            />
        )}

        {/* Botão Flutuante (Detalhes) */}
        {activeContact && selectedInstance && !isRightSidebarOpen && (
            <button 
                onClick={() => setIsRightSidebarOpen(true)}
                className="absolute right-0 top-16 bg-zinc-800 p-2 rounded-l-lg border border-r-0 border-zinc-700 shadow-xl text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all z-40 animate-in slide-in-from-right-4"
                title="Ver Detalhes"
            >
                <span className="writing-vertical text-xs font-bold uppercase tracking-widest">Detalhes</span>
            </button>
        )}
      </div>
    </div>
  );
}
