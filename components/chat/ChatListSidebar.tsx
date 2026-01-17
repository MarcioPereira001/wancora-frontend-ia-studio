'use client';

import React, { useMemo } from 'react';
import { Search, Wifi, CheckSquare, Users, X, Loader2 } from 'lucide-react';
import { useChatStore } from '@/store/useChatStore';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { useChatList } from '@/hooks/useChatList';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { createClient } from '@/utils/supabase/client';
import { useAuthStore } from '@/store/useAuthStore';

export function ChatListSidebar() {
  const { user } = useAuthStore();
  const supabase = createClient();
  const { instances } = useRealtimeStore();
  
  const { 
      activeContact, setActiveContact, 
      selectedInstance, setSelectedInstance,
      searchTerm, setSearchTerm 
  } = useChatStore();

  const [isInboxSelectionMode, setIsInboxSelectionMode] = React.useState(false);
  const [selectedInboxIds, setSelectedInboxIds] = React.useState<Set<string>>(new Set());

  // Data Hook
  const { contacts, loading: loadingContacts, refreshChats } = useChatList(selectedInstance?.session_id || null);

  const filteredContacts = useMemo(() => {
      if (!searchTerm) return contacts;
      const lower = searchTerm.toLowerCase();
      return contacts.filter(c => 
          c.name.toLowerCase().includes(lower) || 
          c.push_name?.toLowerCase().includes(lower) ||
          c.phone_number?.includes(lower)
      );
  }, [contacts, searchTerm]);

  const handleContactSelect = async (contact: any) => {
      if (isInboxSelectionMode) {
          handleInboxSelect(contact.jid);
          return;
      }
      setActiveContact(contact);
      try {
          await supabase.from('contacts').update({ unread_count: 0 }).eq('jid', contact.jid).eq('company_id', user?.company_id);
          refreshChats();
      } catch (e) {}
  };

  const handleInboxSelect = (jid: string) => {
      setSelectedInboxIds(prev => { 
          const n = new Set(prev); 
          if(n.has(jid)) n.delete(jid); else n.add(jid); 
          return n; 
      });
  };

  return (
    <div className={cn("w-full md:w-80 border-r border-zinc-800 flex-col bg-zinc-900/30 backdrop-blur-sm h-full", activeContact ? "hidden md:flex" : "flex")}>
        {/* Header Inbox */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-900/80 space-y-3 shrink-0">
            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg shadow-sm">
                <Wifi className={cn("w-4 h-4", selectedInstance?.status === 'connected' ? "text-green-500" : "text-zinc-500")} />
                <select 
                    className="w-full bg-transparent text-zinc-200 text-sm font-medium outline-none cursor-pointer" 
                    value={selectedInstance?.session_id || ''} 
                    onChange={(e) => { 
                        const inst = instances.find(i => i.session_id === e.target.value); 
                        setSelectedInstance(inst || null); 
                        setActiveContact(null); 
                    }} 
                    disabled={instances.length === 0}
                >
                    {instances.length === 0 ? <option value="">Carregando...</option> : instances.map(i => <option key={i.session_id} value={i.session_id}>{i.name} ({i.status})</option>)}
                </select>
            </div>
            
            {isInboxSelectionMode ? (
                <div className="flex items-center justify-between bg-zinc-800/80 rounded-lg px-2 py-1.5 animate-in slide-in-from-top-2">
                    <span className="text-xs text-white font-bold px-2">{selectedInboxIds.size} selecionados</span>
                    <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setIsInboxSelectionMode(false)}><X className="h-4 w-4" /></Button>
                    </div>
                </div>
            ) : (
                <div className="flex gap-2">
                    <div className="relative group flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                        <input 
                            className="w-full bg-zinc-950/50 border border-zinc-800 rounded-lg py-2 pl-9 pr-4 text-sm focus:outline-none focus:ring-1 focus:ring-primary text-white" 
                            placeholder="Buscar..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                        />
                    </div>
                    <Button size="icon" variant="ghost" className="border border-zinc-800 hover:bg-zinc-800" onClick={() => setIsInboxSelectionMode(true)}>
                        <CheckSquare className="h-4 w-4 text-zinc-400" />
                    </Button>
                </div>
            )}
        </div>

        {/* Lista de Contatos */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {filteredContacts.length === 0 ? (
                <div className="p-8 text-center flex flex-col items-center justify-center h-40">
                    {loadingContacts ? (
                        <>
                            <Loader2 className="animate-spin text-zinc-600 mb-2" />
                            <span className="text-zinc-500 text-xs">Carregando conversas...</span>
                        </>
                    ) : (
                        <span className="text-zinc-500 text-sm">Nenhuma conversa encontrada.</span>
                    )}
                </div>
            ) : (
             filteredContacts.map(contact => {
                const isSelected = selectedInboxIds.has(contact.jid);
                const isNewLead = contact.updated_at && (new Date().getTime() - new Date(contact.updated_at).getTime() < 24 * 60 * 60 * 1000);
                
                // PRIORITY NAME LOGIC: Agenda Name > Push Name > Formatted Phone
                const displayName = contact.name || contact.push_name || contact.phone_number || "Usuário";

                return (
                    <div key={contact.id} onClick={() => handleContactSelect(contact)} className={cn("p-4 border-b border-zinc-800/30 cursor-pointer hover:bg-zinc-800/50 relative transition-colors", activeContact?.id === contact.id && !isInboxSelectionMode ? 'bg-primary/5 border-l-2 border-l-primary' : '', isSelected ? "bg-primary/10" : "")}>
                        <div className="flex justify-between items-start mb-1">
                            {isInboxSelectionMode && (<div className="mr-3 mt-1"><Checkbox checked={isSelected} onCheckedChange={() => handleInboxSelect(contact.jid)} className="border-zinc-600 data-[state=checked]:bg-primary" /></div>)}
                            <div className="flex items-center gap-3 overflow-hidden flex-1">
                                 <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700 overflow-hidden relative">
                                    {contact.profile_pic_url ? (<img src={contact.profile_pic_url} className="w-full h-full object-cover" />) : contact.is_group ? (<Users className="w-5 h-5 text-zinc-500" />) : (<span className="text-zinc-500 font-bold">{displayName.charAt(0).toUpperCase()}</span>)}
                                 </div>
                                 <div className="min-w-0 flex-1">
                                    <div className="flex justify-between items-center">
                                        <span className={cn("font-medium truncate block", activeContact?.id === contact.id ? 'text-primary' : 'text-zinc-200')}>{displayName}</span>
                                        <span className="text-[10px] text-zinc-500">{contact.last_message_time ? new Date(contact.last_message_time).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-0.5">
                                        <p className="text-xs text-zinc-500 truncate max-w-[140px]">{contact.last_message}</p>
                                        <div className="flex items-center gap-1">
                                            {isNewLead && <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 rounded uppercase font-bold">Novo</span>}
                                            {contact.unread_count > 0 && <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 rounded-full min-w-[18px] text-center shadow-lg shadow-green-500/20 animate-pulse">{contact.unread_count}</span>}
                                        </div>
                                    </div>
                                 </div>
                            </div>
                        </div>
                    </div>
                );
             }))}
        </div>
    </div>
  );
}