'use client';

import React, { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { Message } from '@/types';
import { cn } from '@/lib/utils';
import { Smartphone, Database, Loader2, Lock } from 'lucide-react';

// Atomic Components
import { ChatListSidebar } from '@/components/chat/ChatListSidebar';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { ChatInputArea } from '@/components/chat/ChatInputArea';
import { ChatSidebar } from '@/components/chat/ChatSidebar'; // Right Sidebar

export default function ChatPage() {
  const { user } = useAuthStore();
  const supabase = createClient();
  
  const { instances } = useRealtimeStore();
  const { 
      activeContact, activeLead, 
      selectedInstance,
      addMessage, setMessages, setActiveLead,
      setSelectedInstance
  } = useChatStore();

  // --- LÓGICA DE AUTO-SELEÇÃO DE INSTÂNCIA (Vital para renderização) ---
  useEffect(() => {
      // Se não tem instância selecionada, mas temos instâncias carregadas, seleciona a primeira conectada ou a primeira disponível
      if (!selectedInstance && instances.length > 0) {
          const connected = instances.find(i => i.status === 'connected') || instances[0];
          setSelectedInstance(connected);
      }
      
      // Se a instância selecionada não existe mais (foi deletada), limpa a seleção
      if (selectedInstance && instances.length > 0 && !instances.find(i => i.id === selectedInstance.id)) {
          const connected = instances.find(i => i.status === 'connected') || instances[0];
          setSelectedInstance(connected);
      }
  }, [instances, selectedInstance, setSelectedInstance]);

  // Sync Overlay Data & Logic
  const isSyncing = selectedInstance && selectedInstance.sync_status && selectedInstance.sync_status !== 'completed';
  const syncPercent = selectedInstance?.sync_percent || 0;
  const syncStatusLabel = selectedInstance?.sync_status === 'importing_contacts' ? 'Importando Contatos...' : 'Baixando Mensagens...';

  // Lógica de "Identity Unification" (LID)
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

  // 1. Refresh Lead Data when Active Contact changes
  useEffect(() => {
      if(!activeContact || !user?.company_id) {
          setActiveLead(null);
          return;
      }
      
      const refreshLead = async () => {
          const cleanPhone = activeContact.remote_jid.split('@')[0].replace(/\D/g, '');
          const { data: lead } = await supabase
            .from('leads')
            .select('*')
            .eq('company_id', user.company_id)
            .ilike('phone', `%${cleanPhone}%`)
            .limit(1)
            .maybeSingle();
          setActiveLead(lead);
      };
      refreshLead();
  }, [activeContact?.id, user?.company_id]);

  // 2. Realtime Listener Global para Mensagens (Alimenta a Store)
  useEffect(() => {
      if (!user?.company_id) return;

      const channel = supabase
        .channel(`chat-room-global`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `company_id=eq.${user.company_id}` }, async (payload) => {
            const newMessage = payload.new as Message;
            
            // Lógica LID
            if (activeContact && newMessage.remote_jid.includes('@lid') && activeContact.remote_jid.includes('@s.whatsapp.net')) {
                await linkIdentity(newMessage.remote_jid, activeContact.remote_jid);
            }

            // Se for do chat ativo, adiciona à store
            if (activeContact && (newMessage.remote_jid === activeContact.remote_jid || newMessage.remote_jid.includes('@lid'))) {
                addMessage(newMessage);
                
                if (!newMessage.from_me) {
                    supabase.from('contacts')
                        .update({ unread_count: 0 })
                        .eq('jid', activeContact.remote_jid)
                        .eq('company_id', user.company_id);
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
      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('company_id', user.company_id)
        .ilike('phone', `%${cleanPhone}%`)
        .limit(1)
        .maybeSingle();
      setActiveLead(lead);
  };

  return (
    <div className="flex h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] rounded-xl border border-zinc-800 bg-zinc-950/50 overflow-hidden shadow-2xl animate-in fade-in duration-500 relative">
      
      {/* --- BLOCKING SYNC OVERLAY --- */}
      {isSyncing && (
          <div className="absolute inset-0 z-[9999] bg-zinc-950/95 backdrop-blur-md flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-300 cursor-not-allowed">
              <div className="max-w-md w-full p-8 rounded-2xl border border-zinc-800 bg-zinc-900/50 shadow-2xl relative overflow-hidden">
                  {/* Background Effect */}
                  <div className="absolute inset-0 bg-primary/5 animate-pulse"></div>
                  
                  <div className="relative z-10 flex flex-col items-center">
                      <div className="w-20 h-20 bg-zinc-800 rounded-full flex items-center justify-center mb-6 border border-zinc-700 shadow-inner">
                          <Database className="w-8 h-8 text-primary animate-bounce" />
                      </div>
                      
                      <h2 className="text-2xl font-bold text-white mb-2">Sincronizando WhatsApp</h2>
                      <p className="text-zinc-400 text-sm mb-6">
                          Estamos importando seus contatos e histórico.<br/>
                          Isso garante que os nomes e fotos apareçam corretamente.
                      </p>

                      <div className="w-full space-y-2">
                          <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-zinc-500">
                              <span>{syncStatusLabel}</span>
                              <span className="text-primary">{syncPercent}%</span>
                          </div>
                          <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800">
                              <div 
                                className="h-full bg-gradient-to-r from-primary to-emerald-400 transition-all duration-500 ease-out shadow-[0_0_15px_rgba(34,197,94,0.5)]" 
                                style={{ width: `${syncPercent}%` }}
                              ></div>
                          </div>
                      </div>

                      <div className="mt-6 flex items-center gap-2 text-xs text-yellow-500 bg-yellow-500/10 px-3 py-2 rounded-lg border border-yellow-500/20">
                          <Lock className="w-3 h-3" />
                          <span>O chat será liberado automaticamente ao finalizar.</span>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* LEFT SIDEBAR */}
      <ChatListSidebar />

      {/* MAIN CONTENT AREA */}
      <div className={cn("flex-1 flex-col bg-[#09090b] relative", activeContact ? "flex" : "hidden md:flex")}>
        {activeContact && selectedInstance ? (
            <>
                <ChatHeader />
                <ChatWindow />
                <ChatInputArea />
            </>
        ) : (
            <div className="flex h-full items-center justify-center flex-col text-zinc-500 bg-zinc-950/20 p-4 text-center">
                {selectedInstance ? (
                    <>
                        <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-zinc-800 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
                            <Smartphone className="h-10 w-10 text-zinc-700" />
                        </div>
                        <h3 className="text-xl font-bold text-zinc-200 mb-2">Wancora CRM</h3>
                        <p className="text-sm opacity-60 max-w-xs">Selecione uma conversa ao lado para iniciar o atendimento.</p>
                    </>
                ) : (
                    <>
                        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                        <p className="text-sm text-zinc-400">Conectando à instância...</p>
                    </>
                )}
            </div>
        )}
      </div>

      {/* RIGHT SIDEBAR */}
      {activeContact && selectedInstance && (
          <ChatSidebar contact={activeContact} lead={activeLead} refreshLead={refreshLeadData} />
      )}

    </div>
  );
}