'use client';

import React, { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { Message } from '@/types';
import { cn } from '@/lib/utils';
import { Smartphone, Database, Loader2, Lock, DownloadCloud, CheckCircle2 } from 'lucide-react';

// Atomic Components
import { ChatListSidebar } from '@/components/chat/ChatListSidebar';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { ChatWindow } from '@/components/chat/ChatWindow';
import { ChatInputArea } from '@/components/chat/ChatInputArea';
import { ChatSidebar } from '@/components/chat/ChatSidebar'; 

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

  // --- AUTO-SELECT INSTANCE ---
  useEffect(() => {
      if (!selectedInstance && instances.length > 0) {
          const connected = instances.find(i => i.status === 'connected') || instances[0];
          if (connected) setSelectedInstance(connected);
      }
      // Se a instância sumiu (deletada), reseta
      if (selectedInstance && instances.length > 0 && !instances.find(i => i.session_id === selectedInstance.session_id)) {
          const connected = instances.find(i => i.status === 'connected') || instances[0];
          setSelectedInstance(connected || null);
      }
  }, [instances, selectedInstance, setSelectedInstance]);

  // --- SYNC STATE LOGIC ---
  // O Chat só libera se status for 'completed' OU se não estiver em processo de sync pesado
  const syncStatus = selectedInstance?.sync_status || 'completed';
  const isSyncing = syncStatus === 'importing_contacts' || syncStatus === 'importing_messages' || syncStatus === 'waiting';
  const syncPercent = selectedInstance?.sync_percent || 0;
  
  // Texto dinâmico do status
  let syncLabel = "Aguardando início...";
  let syncSubLabel = "Preparando conexão segura";
  
  if (syncStatus === 'importing_contacts') {
      syncLabel = "Sincronizando Contatos";
      syncSubLabel = "Identificando nomes e salvando agenda...";
  } else if (syncStatus === 'importing_messages') {
      syncLabel = "Baixando Histórico";
      syncSubLabel = "Recuperando conversas antigas (Isso pode levar alguns segundos)...";
  }

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
  // 1. Atualiza Lead Ativo
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

  // 2. Global Message Listener
  useEffect(() => {
      if (!user?.company_id) return;

      const channel = supabase
        .channel(`chat-room-global`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `company_id=eq.${user.company_id}` }, async (payload) => {
            const newMessage = payload.new as Message;
            
            // LID Fix
            if (activeContact && newMessage.remote_jid.includes('@lid') && activeContact.remote_jid.includes('@s.whatsapp.net')) {
                await linkIdentity(newMessage.remote_jid, activeContact.remote_jid);
            }

            // Add to Store if match
            if (activeContact && (newMessage.remote_jid === activeContact.remote_jid || newMessage.remote_jid.includes('@lid'))) {
                addMessage(newMessage);
                // Mark read locally
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
    <div className="flex h-[calc(100vh-6rem)] md:h-[calc(100vh-4rem)] rounded-xl border border-zinc-800 bg-zinc-950/50 overflow-hidden shadow-2xl animate-in fade-in duration-500 relative">
      
      {/* --- BLOCKING SYNC OVERLAY (A Nova Trava) --- */}
      {isSyncing && (
          <div className="absolute inset-0 z-[9999] bg-zinc-950/90 backdrop-blur-xl flex flex-col items-center justify-center text-center animate-in fade-in duration-500 cursor-progress">
              <div className="max-w-md w-full p-10 rounded-3xl border border-zinc-800 bg-zinc-900/80 shadow-2xl relative overflow-hidden">
                  
                  {/* Cyberpunk Glow Background */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_20px_rgba(34,197,94,0.5)]"></div>
                  <div className="absolute -top-20 -left-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl"></div>
                  <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl"></div>

                  <div className="relative z-10 flex flex-col items-center">
                      <div className="w-24 h-24 bg-zinc-950 rounded-full flex items-center justify-center mb-8 border-2 border-dashed border-zinc-700 relative">
                          <DownloadCloud className="w-10 h-10 text-primary animate-bounce" />
                          <div className="absolute inset-0 border-2 border-transparent border-t-primary rounded-full animate-spin"></div>
                      </div>
                      
                      <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">{syncLabel}</h2>
                      <p className="text-zinc-400 text-sm mb-8 px-4 leading-relaxed">
                          {syncSubLabel}<br/>
                          <span className="text-zinc-500 text-xs mt-2 block">Priorizando contatos com nome para o CRM.</span>
                      </p>

                      {/* Progress Bar Real */}
                      <div className="w-full space-y-3">
                          <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-zinc-500 px-1">
                              <span>Progresso</span>
                              <span className="text-primary font-mono">{syncPercent > 100 ? 100 : syncPercent}%</span>
                          </div>
                          <div className="w-full h-4 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 shadow-inner">
                              <div 
                                className="h-full bg-gradient-to-r from-primary via-emerald-400 to-primary bg-[length:200%_100%] animate-[shimmer_2s_linear_infinite] transition-all duration-300 ease-out shadow-[0_0_15px_rgba(34,197,94,0.5)]" 
                                style={{ width: `${syncPercent > 100 ? 100 : syncPercent}%` }}
                              ></div>
                          </div>
                      </div>

                      <div className="mt-8 flex items-center gap-3 text-xs text-yellow-500/80 bg-yellow-500/5 px-4 py-3 rounded-xl border border-yellow-500/10">
                          <Lock className="w-4 h-4 shrink-0" />
                          <span>Tela bloqueada para garantir integridade dos dados.</span>
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
                        <div className="w-24 h-24 bg-zinc-900 rounded-full flex items-center justify-center mb-6 border border-zinc-800 shadow-[0_0_40px_rgba(0,0,0,0.5)] group hover:border-primary/50 transition-colors">
                            <Smartphone className="h-10 w-10 text-zinc-700 group-hover:text-primary transition-colors" />
                        </div>
                        <h3 className="text-xl font-bold text-zinc-200 mb-2">Wancora CRM</h3>
                        <p className="text-sm opacity-60 max-w-xs">Selecione uma conversa ao lado para iniciar o atendimento.</p>
                        
                        {!isSyncing && selectedInstance.status === 'connected' && (
                            <div className="mt-6 flex items-center gap-2 text-xs text-emerald-500 bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Sistema Sincronizado</span>
                            </div>
                        )}
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
