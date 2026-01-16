'use client';

import React, { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';
import { useChatStore } from '@/store/useChatStore';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { Message } from '@/types';
import { cn } from '@/lib/utils';
import { Smartphone, CheckCircle2, RefreshCw, Lock, Loader2 } from 'lucide-react';

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

  // --- SYNC STATE LOGIC (ATUALIZADO PARA NOVO BACKEND) ---
  const syncStatus = selectedInstance?.sync_status || 'completed';
  const status = selectedInstance?.status;
  const syncPercent = selectedInstance?.sync_percent || 0;

  // Lógica de Travamento:
  // 1. Backend diz 'syncing'
  // 2. OU porcentagem está ativa (entre 1 e 99)
  const isSyncing = (status === 'connected' && syncStatus === 'syncing') || (syncPercent > 0 && syncPercent < 100 && status === 'connected');

  // Texto Dinâmico baseado no progresso
  let syncLabel = "Iniciando Sincronização...";
  let syncSubLabel = "Estabelecendo conexão segura...";
  
  if (syncPercent > 5) {
      syncLabel = "Organizando Contatos";
      syncSubLabel = "Identificando nomes e fotos da agenda...";
  } 
  if (syncPercent > 40) {
      syncLabel = "Baixando Histórico";
      syncSubLabel = "Recuperando conversas recentes...";
  }
  if (syncPercent > 90) {
      syncLabel = "Finalizando";
      syncSubLabel = "Indexando últimas mensagens...";
  }

  // --- MATH FOR SVG CIRCLE ---
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  const safePercent = Math.min(Math.max(syncPercent, 0), 100);
  const offset = circumference - (safePercent / 100) * circumference;

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
      
      {/* --- SMART SYNC OVERLAY (MODAL GLOBAL) --- */}
      {/* Este modal agora cobre TUDO (z-index 9999) se estiver sincronizando */}
      {isSyncing && (
          <div className="fixed inset-0 z-[9999] bg-zinc-950/90 backdrop-blur-xl flex flex-col items-center justify-center text-center animate-in fade-in duration-500 cursor-wait">
              
              {/* Glow Effect de Fundo */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>

              <div className="relative z-10 flex flex-col items-center space-y-8">
                  
                  {/* Círculo SVG */}
                  <div className="relative w-48 h-48">
                        {/* Background Circle */}
                        <svg className="w-full h-full transform -rotate-90 drop-shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                          <circle
                            cx="96" cy="96" r={radius}
                            stroke="currentColor" strokeWidth="8" fill="transparent"
                            className="text-zinc-800"
                          />
                          {/* Progress Circle */}
                          <circle
                            cx="96" cy="96" r={radius}
                            stroke="currentColor" strokeWidth="8" fill="transparent"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            strokeLinecap="round"
                            className="text-primary transition-all duration-700 ease-out"
                          />
                        </svg>
                        
                        {/* Percentual Centralizado */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-4xl font-bold text-white font-mono tracking-tighter">
                             {safePercent}%
                          </span>
                          <RefreshCw className="w-5 h-5 text-primary/80 animate-spin mt-2" />
                        </div>
                  </div>

                  <div className="space-y-2 max-w-sm">
                      <h2 className="text-2xl font-bold text-white tracking-tight">{syncLabel}</h2>
                      <p className="text-zinc-400 text-sm leading-relaxed">
                          {syncSubLabel}
                      </p>
                  </div>

                  <div className="flex items-center gap-3 text-xs text-yellow-500/90 bg-yellow-500/10 px-6 py-2 rounded-full border border-yellow-500/20">
                      <Lock className="w-3 h-3 shrink-0" />
                      <span className="font-medium">O sistema está organizando seus dados para evitar duplicidade.</span>
                  </div>
              </div>
          </div>
      )}

      {/* LEFT SIDEBAR (Contatos) */}
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

      {/* RIGHT SIDEBAR (Detalhes) */}
      {activeContact && selectedInstance && (
          <ChatSidebar contact={activeContact} lead={activeLead} refreshLead={refreshLeadData} />
      )}

    </div>
  );
}
