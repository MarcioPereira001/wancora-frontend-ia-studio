'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useChatList } from '@/hooks/useChatList';
import { useChatStore } from '@/store/useChatStore';
import { 
    Search, Plus, MessageSquare, Loader2, RefreshCw, Users, Megaphone, Filter, Tag
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn, getDisplayName } from '@/lib/utils';
import { CreateGroupModal } from './CreateGroupModal';
import { CreateChannelModal } from './CreateChannelModal';
import { NewChatModal } from './NewChatModal';
import { ChatListItem } from './ChatListItem'; // NOVO COMPONENTE EXTRAÍDO
import { TagManageModal } from './TagManageModal'; // NOVO MODAL
import { useAuthStore } from '@/store/useAuthStore';
import { createClient } from '@/utils/supabase/client';

export function ChatListSidebar() {
  const { contacts, loading, refreshList } = useChatList(); 
  const { activeContact, setActiveContact, selectedInstance } = useChatStore();
  const { user } = useAuthStore();
  const supabase = createClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'groups' | 'unread' | 'channels'>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  
  // Modais
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagTargetLead, setTagTargetLead] = useState<{id: string, tags: string[]} | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  
  // Available Tags (Extracted from contacts)
  const availableTags = useMemo(() => {
      const tags = new Set<string>();
      const stages = new Set<{id: string, name: string}>();
      
      contacts.forEach(c => {
          c.lead_tags?.forEach(t => tags.add(t));
          if(c.stage_name && c.pipeline_stage_id) {
              // Hack simples para unificar no dropdown. Idealmente seria um objeto complexo.
              // Vamos usar um prefixo para distinguir
              tags.add(`Fase: ${c.stage_name}`);
          }
      });
      return Array.from(tags).sort();
  }, [contacts]);

  const handleManualRefresh = async () => {
      setIsRefreshing(true);
      await refreshList();
      setIsRefreshing(false);
  };

  const handleOpenTagModal = (leadId: string, currentTags: string[]) => {
      setTagTargetLead({ id: leadId, tags: currentTags });
      setIsTagModalOpen(true);
  };

  const handleHideChat = async (contactJid: string) => {
      if(!user?.company_id) return;
      try {
           // Soft Delete (Ignorar)
           await supabase.from('contacts')
               .update({ is_ignored: true })
               .eq('jid', contactJid)
               .eq('company_id', user.company_id);
           
           // O Realtime/Hook vai atualizar a lista automaticamente
      } catch (e) {
          console.error("Erro ao ocultar:", e);
      }
  };

  const filteredContacts = useMemo(() => {
      let list = contacts.filter(contact => {
          const displayName = getDisplayName(contact).toLowerCase();
          const phone = (contact.phone_number || '').toLowerCase();
          const search = searchTerm.toLowerCase();

          const matchesSearch = displayName.includes(search) || phone.includes(search);
          if (!matchesSearch) return false;

          // Filtros de Tipo
          if (filterType === 'groups' && !contact.is_group) return false;
          if (filterType === 'channels' && !contact.is_newsletter) return false;
          if (filterType === 'unread' && contact.unread_count === 0) return false;
          
          // Filtro de Tags
          if (tagFilter !== 'all') {
              if (tagFilter.startsWith('Fase: ')) {
                  const stageName = tagFilter.replace('Fase: ', '');
                  if (contact.stage_name !== stageName) return false;
              } else {
                  if (!contact.lead_tags?.includes(tagFilter)) return false;
              }
          }

          return true;
      });
      return list;
  }, [contacts, searchTerm, filterType, tagFilter]);

  return (
    <div className="w-80 md:w-96 flex flex-col border-r border-zinc-800 bg-zinc-900/50 backdrop-blur-md h-full">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="font-bold text-xl text-white">Conversas</h2>
                <div className="flex gap-1 relative">
                    <Button variant="ghost" size="icon" title="Atualizar Lista" onClick={handleManualRefresh} disabled={isRefreshing}>
                        <RefreshCw className={cn("w-4 h-4 text-zinc-400", isRefreshing && "animate-spin")} />
                    </Button>
                    <Button 
                        size="icon" 
                        title="Nova..." 
                        onClick={() => setShowCreateMenu(!showCreateMenu)}
                        className={cn("bg-primary hover:bg-primary/90 text-white w-8 h-8 rounded-full shadow-lg shadow-green-500/20 transition-transform", showCreateMenu ? "rotate-45" : "")}
                    >
                        <Plus className="w-5 h-5" />
                    </Button>
                    
                    {/* Create Menu Dropdown */}
                    {showCreateMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowCreateMenu(false)} />
                            <div className="absolute right-0 top-10 z-50 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-48 animate-in fade-in zoom-in-95 origin-top-right ring-1 ring-white/10">
                                <div className="p-1">
                                    <button onClick={() => { setIsNewChatModalOpen(true); setShowCreateMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-3 rounded-lg">
                                        <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-md"><MessageSquare className="w-4 h-4" /></div> Conversa
                                    </button>
                                    <button onClick={() => { setIsGroupModalOpen(true); setShowCreateMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-3 rounded-lg">
                                        <div className="p-1.5 bg-green-500/10 text-green-400 rounded-md"><Users className="w-4 h-4" /></div> Novo Grupo
                                    </button>
                                    <button onClick={() => { setIsChannelModalOpen(true); setShowCreateMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-3 rounded-lg">
                                        <div className="p-1.5 bg-purple-500/10 text-purple-400 rounded-md"><Megaphone className="w-4 h-4" /></div> Novo Canal
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                <Input 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar conversa..."
                    className="pl-9 bg-zinc-950 border-zinc-800 focus:border-zinc-700 h-9 text-sm"
                />
            </div>

            {/* Filter Tabs & Dropdown */}
            <div className="flex items-center gap-2">
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1">
                    {['all', 'unread', 'groups', 'channels'].map(type => (
                        <button 
                            key={type}
                            onClick={() => setFilterType(type as any)} 
                            className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-bold border transition-colors whitespace-nowrap capitalize", 
                                filterType === type 
                                    ? "bg-zinc-100 text-zinc-900 border-zinc-100" 
                                    : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                            )}
                        >
                            {type === 'all' ? 'Todas' : type === 'unread' ? 'Não Lidas' : type === 'groups' ? 'Grupos' : 'Canais'}
                        </button>
                    ))}
                </div>
                
                {/* Tag Filter Dropdown */}
                <div className="relative group/filter">
                    <button className={cn("p-1.5 rounded-lg border transition-colors", tagFilter !== 'all' ? "bg-primary/20 border-primary text-primary" : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white")}>
                        <Filter className="w-4 h-4" />
                    </button>
                    <select 
                        value={tagFilter}
                        onChange={(e) => setTagFilter(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    >
                        <option value="all">Todas as Etiquetas</option>
                        {availableTags.map(t => (
                            <option key={t} value={t}>{t}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar relative">
            {loading ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-xs text-zinc-500">Sincronizando...</span>
                </div>
            ) : filteredContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4">
                    <p className="text-zinc-500 text-sm">Nenhuma conversa encontrada.</p>
                    <Button variant="outline" onClick={() => setIsNewChatModalOpen(true)} className="border-dashed border-zinc-700 text-zinc-400 hover:text-white">Iniciar Nova Conversa</Button>
                </div>
            ) : (
                filteredContacts.map(contact => (
                    <React.Fragment key={contact.id}>
                        <ChatListItem 
                            contact={contact}
                            isActive={activeContact?.id === contact.id}
                            onClick={() => setActiveContact(contact)}
                            onTag={() => contact.lead_id ? handleOpenTagModal(contact.lead_id, contact.lead_tags || []) : null}
                            onHide={() => handleHideChat(contact.jid)}
                            onDelete={() => { /* Lógica de Delete Complexa - Mantemos Hide por enquanto */ }}
                        />
                    </React.Fragment>
                ))
            )}
        </div>

        {/* MODAIS */}
        <NewChatModal isOpen={isNewChatModalOpen} onClose={() => setIsNewChatModalOpen(false)} />
        <CreateGroupModal isOpen={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} sessionId={selectedInstance?.session_id || 'default'} companyId={user?.company_id || ''} existingContacts={contacts} />
        <CreateChannelModal isOpen={isChannelModalOpen} onClose={() => setIsChannelModalOpen(false)} sessionId={selectedInstance?.session_id || 'default'} companyId={user?.company_id || ''} />
        
        {tagTargetLead && (
            <TagManageModal 
                isOpen={isTagModalOpen}
                onClose={() => setIsTagModalOpen(false)}
                leadId={tagTargetLead.id}
                initialTags={tagTargetLead.tags}
            />
        )}
    </div>
  );
}
