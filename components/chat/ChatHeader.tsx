
'use client';

import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, User, Users, MoreVertical, CheckSquare, Trash2, RefreshCw } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { Button } from '@/components/ui/button';
import { cleanJid } from '@/lib/utils';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';

export function ChatHeader() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { activeContact, setActiveContact, toggleMsgSelectionMode, isTyping, setTyping } = useChatStore();
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Status Local State
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // 1. Fecha menu ao trocar de conversa
  useEffect(() => {
      setShowOptionsMenu(false);
  }, [activeContact?.id]);

  // 2. Click Outside para fechar o menu
  useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
          if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
              setShowOptionsMenu(false);
          }
      }
      if (showOptionsMenu) {
          document.addEventListener("mousedown", handleClickOutside);
      }
      return () => { document.removeEventListener("mousedown", handleClickOutside); };
  }, [showOptionsMenu]);

  // Efeito para buscar e ouvir Last Seen em tempo real
  useEffect(() => {
      if (!activeContact || !user?.company_id) return;

      // Não resetamos imediatamente para null para evitar "flicker" visual se a resposta for rápida
      // Apenas indicamos loading
      setLoadingStatus(true);
      
      // 1. Busca estado inicial (Snapshot)
      const fetchStatus = async () => {
          const { data } = await supabase
              .from('contacts')
              .select('last_seen_at, is_online')
              .eq('jid', activeContact.remote_jid)
              .eq('company_id', user.company_id)
              .maybeSingle();
          
          if (data) {
              setIsOnline(data.is_online || false);
              setLastSeen(data.last_seen_at);
          } else {
              // Se não achou (ex: grupo ou contato novo), reseta
              setIsOnline(false);
              setLastSeen(null);
          }
          setLoadingStatus(false);
      };
      fetchStatus();

      // 2. Inscreve no canal de mudança (Realtime) na tabela contacts
      const channel = supabase.channel(`contact-presence:${activeContact.remote_jid}`)
          .on('postgres_changes', { 
              event: 'UPDATE', 
              schema: 'public', 
              table: 'contacts', 
              filter: `jid=eq.${activeContact.remote_jid}` 
          }, (payload) => {
              if (payload.new) {
                  const newOnline = payload.new.is_online;
                  const newLastSeen = payload.new.last_seen_at;
                  
                  setIsOnline(newOnline);
                  setLastSeen(newLastSeen);
                  
                  // Se ficou online agora e não estava, simula "digitando" brevemente
                  if (newOnline && !isOnline) {
                      setTyping(true);
                      setTimeout(() => setTyping(false), 3000);
                  }
              }
          })
          .subscribe();

      return () => { supabase.removeChannel(channel); };
  }, [activeContact?.remote_jid, user?.company_id]); // Dependência correta: remote_jid

  if (!activeContact) return null;

  const displayName = activeContact.name || activeContact.push_name || activeContact.phone_number || "Desconhecido";

  const formatLastSeen = (dateStr: string) => {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        const now = new Date();
        const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

        // Se data inválida ou muito antiga (ano 1970), ignora
        if (isNaN(date.getTime()) || date.getFullYear() < 2000) return '';

        // Formatação inteligente
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        if (date.toDateString() === now.toDateString()) {
            return `visto hoje às ${timeStr}`;
        }
        
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return `visto ontem às ${timeStr}`;
        }

        // Se faz menos de 7 dias, mostra dia da semana
        if (diffHours < 24 * 7) {
            return `visto ${date.toLocaleDateString([], { weekday: 'long' })} às ${timeStr}`;
        }

        return `visto em ${date.toLocaleDateString()} às ${timeStr}`;
      } catch (e) {
          return '';
      }
  };

  // Lógica de exibição do subtítulo
  const renderSubtitle = () => {
    if (activeContact.is_group) {
        return <p className="text-xs text-zinc-400 font-mono truncate">{cleanJid(activeContact.remote_jid)}</p>;
    }

    if (isTyping) {
        return (
            <span className="text-green-400 font-bold text-[11px] tracking-wide animate-pulse flex items-center gap-0.5">
                digitando<span className="animate-bounce delay-75">.</span><span className="animate-bounce delay-150">.</span><span className="animate-bounce delay-200">.</span>
            </span>
        );
    }

    if (isOnline) {
        return <span className="text-green-400 font-bold text-[11px] tracking-wide animate-in fade-in">Online</span>;
    }

    if (lastSeen) {
        return <span className="text-zinc-500 text-[11px] animate-in fade-in">{formatLastSeen(lastSeen)}</span>;
    }

    // Fallback: mostra número formatado
    return <span className="text-zinc-500 text-[11px]">{cleanJid(activeContact.remote_jid)}</span>;
  };

  return (
    <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-4 md:px-6 bg-zinc-900/50 backdrop-blur-md z-10 shrink-0 relative transition-all duration-300">
        
        {/* Efeito Glow se Online */}
        {isOnline && !activeContact.is_group && (
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-green-500/50 to-transparent pointer-events-none animate-in fade-in" />
        )}

        <div className="flex items-center gap-3 relative z-10 min-w-0">
            <Button variant="ghost" size="icon" className="md:hidden text-zinc-400 shrink-0" onClick={() => setActiveContact(null)}>
                <ArrowLeft className="h-5 w-5" />
            </Button>
            
            <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 overflow-hidden relative shadow-sm shrink-0">
                    {activeContact.profile_pic_url ? (
                        <img src={activeContact.profile_pic_url} className="w-full h-full object-cover" />
                    ) : (
                        activeContact.is_group ? <Users className="w-5 h-5 text-zinc-500" /> : <User className="w-5 h-5 text-zinc-500" />
                    )}
                    {/* Bolinha Verde Online (Sobreposta ao Avatar) */}
                    {isOnline && !activeContact.is_group && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-zinc-900 animate-in zoom-in duration-300 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
                    )}
            </div>
            
            <div className="flex-1 min-w-0 flex flex-col justify-center">
                <h3 className="font-bold text-zinc-100 text-sm truncate leading-tight">
                    {displayName}
                </h3>
                <div className="h-4 flex items-center overflow-hidden">
                    {renderSubtitle()}
                </div>
            </div>
        </div>
        
        <div className="relative z-10 shrink-0" ref={menuRef}>
            <Button variant="ghost" size="icon" onClick={() => setShowOptionsMenu(!showOptionsMenu)} className="text-zinc-400 hover:text-white">
                <MoreVertical className="w-5 h-5" />
            </Button>
            {showOptionsMenu && (
                <div className="absolute right-0 top-12 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl py-2 w-52 z-[100] animate-in fade-in slide-in-from-top-2 ring-1 ring-white/10">
                    <button 
                        onClick={() => { toggleMsgSelectionMode(); setShowOptionsMenu(false); }} 
                        className="w-full text-left px-4 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2 transition-colors"
                    >
                        <CheckSquare className="w-4 h-4 text-zinc-500" /> Selecionar Mensagens
                    </button>
                    <div className="h-px bg-zinc-800 my-1 mx-2" />
                    <button className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2 transition-colors">
                        <Trash2 className="w-4 h-4" /> Limpar Conversa
                    </button>
                </div>
            )}
        </div>
    </div>
  );
}
