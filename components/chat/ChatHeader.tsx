
'use client';

import React from 'react';
import { ArrowLeft, User, Users, MoreVertical, CheckSquare, Trash2, Clock } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { Button } from '@/components/ui/button';
import { cleanJid } from '@/lib/utils';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';

export function ChatHeader() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { activeContact, setActiveContact, toggleMsgSelectionMode } = useChatStore();
  const [showOptionsMenu, setShowOptionsMenu] = React.useState(false);
  const [lastSeen, setLastSeen] = React.useState<string | null>(null);
  const [isOnline, setIsOnline] = React.useState(false);

  // Efeito para buscar e ouvir Last Seen em tempo real
  React.useEffect(() => {
      if (!activeContact || !user?.company_id) return;

      const fetchStatus = async () => {
          const { data } = await supabase
              .from('contacts')
              .select('last_seen_at, is_online')
              .eq('jid', activeContact.remote_jid)
              .eq('company_id', user.company_id)
              .single();
          
          if (data) {
              setIsOnline(data.is_online || false);
              setLastSeen(data.last_seen_at);
          }
      };

      fetchStatus();

      const channel = supabase.channel(`contact-presence:${activeContact.remote_jid}`)
          .on('postgres_changes', { 
              event: 'UPDATE', 
              schema: 'public', 
              table: 'contacts', 
              filter: `jid=eq.${activeContact.remote_jid}` 
          }, (payload) => {
              if (payload.new) {
                  setIsOnline(payload.new.is_online);
                  setLastSeen(payload.new.last_seen_at);
              }
          })
          .subscribe();

      return () => { supabase.removeChannel(channel); };
  }, [activeContact, user?.company_id]);

  if (!activeContact) return null;

  // SAFE RENDER
  const displayName = activeContact.name || activeContact.push_name || activeContact.phone_number || "Desconhecido";

  const formatLastSeen = (dateStr: string) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      const now = new Date();
      if (date.toDateString() === now.toDateString()) {
          return `visto hoje às ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
      }
      return `visto em ${date.toLocaleDateString()} às ${date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}`;
  };

  return (
    <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-4 md:px-6 bg-zinc-900/50 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="md:hidden text-zinc-400" onClick={() => setActiveContact(null)}><ArrowLeft className="h-5 w-5" /></Button>
            <div className="h-10 w-10 rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-700 overflow-hidden relative">
                    {activeContact.profile_pic_url ? (
                        <img src={activeContact.profile_pic_url} className="w-full h-full object-cover" />
                    ) : (
                        activeContact.is_group ? <Users className="w-5 h-5 text-zinc-500" /> : <User className="w-5 h-5 text-zinc-500" />
                    )}
                    {/* Online Dot */}
                    {isOnline && !activeContact.is_group && (
                        <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-zinc-900 animate-pulse"></div>
                    )}
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="font-medium text-white truncate leading-tight">{displayName}</h3>
                {activeContact.is_group ? (
                    <p className="text-xs text-zinc-400 font-mono">{cleanJid(activeContact.remote_jid)}</p>
                ) : (
                    <p className="text-[11px] text-zinc-400 font-medium flex items-center gap-1">
                        {isOnline ? (
                            <span className="text-green-400">Online</span>
                        ) : (
                            lastSeen ? formatLastSeen(lastSeen) : cleanJid(activeContact.remote_jid)
                        )}
                    </p>
                )}
            </div>
        </div>
        
        <div className="relative">
            <Button variant="ghost" size="icon" onClick={() => setShowOptionsMenu(!showOptionsMenu)} className="text-zinc-400 hover:text-white">
                <MoreVertical className="w-5 h-5" />
            </Button>
            {showOptionsMenu && (
                <div className="absolute right-0 top-12 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl py-2 w-48 z-50 animate-in fade-in slide-in-from-top-2">
                    <button 
                        onClick={() => { toggleMsgSelectionMode(); setShowOptionsMenu(false); }} 
                        className="w-full text-left px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-2"
                    >
                        <CheckSquare className="w-4 h-4" /> Selecionar
                    </button>
                    <button className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-2"><Trash2 className="w-4 h-4" /> Limpar</button>
                </div>
            )}
        </div>
    </div>
  );
}
