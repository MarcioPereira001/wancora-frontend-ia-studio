
'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useChatList } from '@/hooks/useChatList';
import { useChatStore } from '@/store/useChatStore';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { 
    Search, Plus, MessageSquare, Loader2, RefreshCw, Users, Filter, Tag, Archive, Reply, Globe,
    ChevronDown, Wifi, ArrowUp
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn, getDisplayName } from '@/lib/utils';
import { useRouter } from 'next/navigation';

// Modais
import { CreateGroupModal } from './CreateGroupModal';
import { CreateCommunityModal } from './CreateCommunityModal';
import { NewChatModal } from './NewChatModal';
import { ChatListItem } from './ChatListItem'; 
import { TagManageModal } from './TagManageModal'; 
import { useAuthStore } from '@/store/useAuthStore';
import { createClient } from '@/utils/supabase/client';
import { ChatContact } from '@/types';

export function ChatListSidebar() {
  const router = useRouter();
  const { contacts, loading, refreshList } = useChatList(); 
  const { activeContact, setActiveContact, selectedInstance, setSelectedInstance } = useChatStore();
  const { instances } = useRealtimeStore();
  const { user } = useAuthStore();
  const supabase = createClient();
  
  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'groups' | 'communities'>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  
  // Dropdowns & Menus
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [showInstanceMenu, setShowInstanceMenu] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  
  // Scroll & View
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [archivedContacts, setArchivedContacts] = useState<ChatContact[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modais
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isCommunityModalOpen, setIsCommunityModalOpen] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagTargetLead, setTagTargetLead] = useState<{id: string, tags: string[]} | null>(null);

  // Refs
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const instanceDropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Click Outside Handlers
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
              setShowTagDropdown(false);
          }
          if (instanceDropdownRef.current && !instanceDropdownRef.current.contains(event.target as Node)) {
              setShowInstanceMenu(false);
          }
      };
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Scroll Handler
  useEffect(() => {
      const list = listRef.current;
      if (!list) return;

      const handleScroll = () => {
          setShowScrollTop(list.scrollTop > 300);
      };

      list.addEventListener('scroll', handleScroll);
      return () => list.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
      if (listRef.current) {
          listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
  };

  // Carregar Arquivados
  const loadArchived = async () => {
      if(!user?.company_id) return;
      setLoadingArchived(true);
      const { data } = await supabase.from('contacts')
          .select('*')
          .eq('company_id', user.company_id)
          .eq('is_ignored', true)
          .order('last_message_at', { ascending: false })
          .limit(50);
          
      if(data) {
          const formatted: ChatContact[] = data.map((c: any) => ({
              id: c.jid,
              jid: c.jid,
              remote_jid: c.jid,
              company_id: c.company_id,
              name: c.name || c.push_name,
              phone_number: c.phone,
              profile_pic_url: c.profile_pic_url,
              unread_count: 0,
              is_group: c.jid.includes('@g.us'),
              is_newsletter: false
          }));
          setArchivedContacts(formatted);
      }
      setLoadingArchived(false);
  };

  useEffect(() => {
      if (viewMode === 'archived') loadArchived();
  }, [viewMode]);

  // Tags Disponíveis
  const availableTags = useMemo(() => {
      const tags = new Set<string>();
      contacts.forEach(c => {
          if (Array.isArray(c.lead_tags)) c.lead_tags.forEach(t => tags.add(t));
          if (c.stage_name) tags.add(`Fase: ${c.stage_name}`);
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
      try { await supabase.from('contacts').update({ is_ignored: true }).eq('jid', contactJid).eq('company_id', user.company_id); } catch (e) {}
  };

  const handleRestoreChat = async (contactJid: string) => {
      if(!user?.company_id) return;
      try { 
           await supabase.from('contacts').update({ is_ignored: false }).eq('jid', contactJid).eq('company_id', user.company_id);
           setArchivedContacts(prev => prev.filter(c => c.jid !== contactJid));
      } catch (e) {}
  };

  const currentList = viewMode === 'active' ? contacts : archivedContacts;

  const filteredContacts = useMemo(() => {
      let list = currentList.filter(contact => {
          if (!contact) return false;
          
          const displayName = getDisplayName(contact).toLowerCase();
          const phone = (contact.phone_number || '').toLowerCase();
          const search = searchTerm.toLowerCase();

          const matchesSearch = displayName.includes(search) || phone.includes(search);
          if (!matchesSearch) return false;

          if (viewMode === 'active') {
              if (filterType === 'communities' && !contact.is_community) return false;
              if (filterType === 'groups' && !contact.is_group && !contact.is_community) return false; // Grupos normais não devem incluir comunidades se houver aba separada
              if (filterType === 'unread' && contact.unread_count === 0) return false;
              
              if (tagFilter !== 'all') {
                  if (tagFilter.startsWith('Fase: ')) {
                      const stageName = tagFilter.replace('Fase: ', '');
                      if (contact.stage_name !== stageName) return false;
                  } else {
                      if (!contact.lead_tags?.includes(tagFilter)) return false;
                  }
              }
          }
          return true;
      });
      return list;
  }, [currentList, searchTerm, filterType, tagFilter, viewMode]);

  // Instância Ativa Visual
  const activeInst = selectedInstance || instances.find(i => i.status === 'connected') || instances[0];

  return (
    <div className="w-80 md:w-96 flex flex-col border-r border-zinc-800 bg-zinc-900/50 backdrop-blur-md h-full relative">
        
        {/* HEADER: Instance Selector */}
        <div className="p-4 border-b border-zinc-800 shrink-0 space-y-3 bg-zinc-900/80 z-20">
            <div className="flex items-center justify-between">
                
                {/* Seletor de Instância (Substitui Perfil) */}
                <div className="relative" ref={instanceDropdownRef}>
                    <button 
                        onClick={() => setShowInstanceMenu(!showInstanceMenu)}
                        className="flex items-center gap-3 hover:bg-zinc-800 p-2 -ml-2 rounded-lg transition-colors group border border-transparent hover:border-zinc-700"
                    >
                        <div className="relative">
                             <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center">
                                {activeInst?.profile_pic_url ? (
                                    <img src={activeInst.profile_pic_url} className="w-full h-full object-cover" />
                                ) : (
                                    <Wifi className="w-5 h-5 text-zinc-500" />
                                )}
                            </div>
                            <div className={cn(
                                "absolute -bottom-1 -right-1 w-3.5 h-3.5 border-2 border-zinc-900 rounded-full",
                                activeInst?.status === 'connected' ? "bg-green-500" : "bg-red-500"
                            )} />
                        </div>
                        <div className="flex flex-col items-start">
                            <span className="text-sm font-bold text-white leading-none flex items-center gap-2">
                                {activeInst?.name || 'Selecione'}
                                <ChevronDown className="w-3 h-3 text-zinc-500" />
                            </span>
                            <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                                {activeInst?.status === 'connected' ? 'Online' : 'Desconectado'}
                            </span>
                        </div>
                    </button>

                    {/* Dropdown Menu */}
                    {showInstanceMenu && (
                        <div className="absolute top-14 left-0 w-64 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl z-50 p-1 animate-in fade-in zoom-in-95 ring-1 ring-white/10">
                            <div className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex justify-between items-center">
                                <span>Minhas Conexões</span>
                                <span className="bg-zinc-900 px-1.5 rounded">{instances.length}</span>
                            </div>
                            
                            <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5">
                                {instances.map(inst => (
                                    <button 
                                        key={inst.id}
                                        onClick={() => { setSelectedInstance(inst); setShowInstanceMenu(false); }}
                                        className={cn(
                                            "w-full text-left px-3 py-2.5 text-sm rounded-lg flex items-center justify-between transition-colors group",
                                            activeInst?.id === inst.id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                                        )}
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", inst.status === 'connected' ? "bg-green-500" : "bg-red-500")} />
                                            <span className="truncate">{inst.name}</span>
                                        </div>
                                        {activeInst?.id === inst.id && <Wifi className="w-3 h-3 text-zinc-500" />}
                                    </button>
                                ))}
                            </div>

                            <div className="h-px bg-zinc-800 my-1" />
                            <button 
                                onClick={() => router.push('/connections')}
                                className="w-full text-left px-3 py-2.5 text-sm text-primary hover:bg-primary/10 rounded-lg flex items-center gap-2 transition-colors font-medium"
                            >
                                <Plus className="w-4 h-4" /> Nova Conexão
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Actions */}
                <div className="flex gap-1 relative">
                    <Button variant="ghost" size="icon" title="Atualizar Lista" onClick={handleManualRefresh} disabled={isRefreshing} className="text-zinc-400 hover:text-white">
                        <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                    </Button>
                    <Button size="icon" onClick={() => setShowCreateMenu(!showCreateMenu)} className="bg-primary hover:bg-primary/90 text-white w-9 h-9 rounded-full shadow-[0_0_15px_rgba(34,197,94,0.3)]">
                        <Plus className="w-5 h-5" />
                    </Button>
                    
                    {showCreateMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowCreateMenu(false)} />
                            <div className="absolute right-0 top-12 z-50 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-52 animate-in fade-in zoom-in-95 origin-top-right ring-1 ring-white/10">
                                <div className="p-1">
                                    <button onClick={() => { setIsNewChatModalOpen(true); setShowCreateMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-3 rounded-lg"><div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-md"><MessageSquare className="w-4 h-4" /></div> Nova Conversa</button>
                                    <button onClick={() => { setIsCommunityModalOpen(true); setShowCreateMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-3 rounded-lg"><div className="p-1.5 bg-orange-500/10 text-orange-400 rounded-md"><Globe className="w-4 h-4" /></div> Criar Comunidade</button>
                                    <button onClick={() => { setIsGroupModalOpen(true); setShowCreateMenu(false); }} className="w-full text-left px-3 py-2.5 text-sm text-zinc-300 hover:bg-zinc-800 hover:text-white flex items-center gap-3 rounded-lg"><div className="p-1.5 bg-green-500/10 text-green-400 rounded-md"><Users className="w-4 h-4" /></div> Novo Grupo</button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            
            {/* SEARCH & TAG FILTER */}
            <div className="flex gap-2">
                <div className="relative group flex-1">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
                    <Input 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar conversa..."
                        className="pl-9 bg-zinc-950 border-zinc-800 focus:border-primary/50 h-9 text-sm transition-all"
                    />
                </div>

                <div className="relative shrink-0" ref={tagDropdownRef}>
                    <button 
                        onClick={() => setShowTagDropdown(!showTagDropdown)}
                        className={cn(
                            "h-9 w-9 rounded-lg border transition-colors flex items-center justify-center", 
                            tagFilter !== 'all' ? "bg-primary/20 border-primary text-primary" : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-800"
                        )}
                        title="Filtrar por Etiqueta"
                    >
                        <Filter className="w-4 h-4" />
                    </button>
                    {showTagDropdown && (
                        <div className="absolute right-0 top-10 z-50 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl animate-in zoom-in-95 p-1 max-h-64 overflow-y-auto custom-scrollbar ring-1 ring-white/10">
                            <div className="px-2 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider sticky top-0 bg-zinc-900 z-10">Etiquetas</div>
                            <button onClick={() => { setTagFilter('all'); setShowTagDropdown(false); }} className={cn("w-full text-left px-3 py-2 text-xs rounded-md transition-colors", tagFilter === 'all' ? "bg-primary/10 text-primary" : "text-zinc-300 hover:bg-zinc-800")}>Todas</button>
                            {availableTags.map(tag => (
                                <button key={tag} onClick={() => { setTagFilter(tag); setShowTagDropdown(false); }} className={cn("w-full text-left px-3 py-2 text-xs rounded-md transition-colors flex items-center gap-2", tagFilter === tag ? "bg-primary/10 text-primary" : "text-zinc-300 hover:bg-zinc-800")}>
                                    <Tag className="w-3 h-3 opacity-50" /> <span className="truncate">{tag}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* FILTER TABS */}
            {viewMode === 'active' && (
                <div className="flex flex-wrap gap-2">
                    {[
                        { id: 'all', label: 'Todas' },
                        { id: 'unread', label: 'Não Lidas' },
                        { id: 'groups', label: 'Grupos' },
                        { id: 'communities', label: 'Comunidades' }
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setFilterType(tab.id as any)} 
                            className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-bold border transition-colors whitespace-nowrap capitalize select-none flex-grow text-center", 
                                filterType === tab.id 
                                    ? "bg-zinc-100 text-zinc-900 border-zinc-100" 
                                    : "bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white"
                            )}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            )}
        </div>

        {/* LIST CONTENT */}
        <div ref={listRef} className="flex-1 overflow-y-auto custom-scrollbar relative">
            
            {/* Scroll To Top Button (Reposicionado para o TOPO da lista com estilo Verde) */}
            {showScrollTop && (
                <div className="sticky top-2 w-full flex justify-center z-30 pointer-events-none">
                     <button 
                        onClick={scrollToTop}
                        className="bg-green-600 hover:bg-green-500 border border-green-500 text-white p-2 rounded-full shadow-lg shadow-green-500/20 transition-all pointer-events-auto animate-in slide-in-from-top-2 scale-90 hover:scale-100"
                    >
                        <ArrowUp className="w-4 h-4" />
                    </button>
                </div>
            )}

            {(loading || loadingArchived) ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-xs text-zinc-500">Sincronizando...</span>
                </div>
            ) : filteredContacts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-zinc-900 flex items-center justify-center border border-zinc-800">
                        <MessageSquare className="w-8 h-8 text-zinc-600" />
                    </div>
                    <p className="text-zinc-500 text-sm">
                        Nenhuma conversa encontrada.
                    </p>
                </div>
            ) : (
                filteredContacts.map(contact => (
                    <React.Fragment key={contact.id}>
                        <ChatListItem 
                            contact={contact}
                            isActive={activeContact?.id === contact.id}
                            onClick={() => setActiveContact(contact)}
                            onTag={() => contact.lead_id ? handleOpenTagModal(contact.lead_id, contact.lead_tags || []) : null}
                            onHide={() => viewMode === 'active' ? handleHideChat(contact.jid) : handleRestoreChat(contact.jid)}
                            onDelete={() => {}}
                            isArchived={viewMode === 'archived'}
                        />
                    </React.Fragment>
                ))
            )}
        </div>

        {/* ARCHIVE FOOTER */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-900/80 backdrop-blur z-20 shrink-0">
            <Button 
                variant="ghost" 
                className={cn(
                    "w-full justify-center text-xs font-bold uppercase tracking-wider h-8 transition-colors",
                    viewMode === 'active' ? "text-zinc-500 hover:text-white hover:bg-zinc-800" : "bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary"
                )}
                onClick={() => setViewMode(viewMode === 'active' ? 'archived' : 'active')}
            >
                {viewMode === 'active' ? (
                    <><Archive className="w-3.5 h-3.5 mr-2" /> Conversas Arquivadas</>
                ) : (
                    <><Reply className="w-3.5 h-3.5 mr-2" /> Voltar ao Inbox</>
                )}
            </Button>
        </div>

        <CreateCommunityModal isOpen={isCommunityModalOpen} onClose={() => setIsCommunityModalOpen(false)} sessionId={activeInst?.session_id || 'default'} companyId={user?.company_id || ''} />
        <CreateGroupModal isOpen={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} sessionId={activeInst?.session_id || 'default'} companyId={user?.company_id || ''} existingContacts={contacts} />
        <NewChatModal isOpen={isNewChatModalOpen} onClose={() => setIsNewChatModalOpen(false)} />
        
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
