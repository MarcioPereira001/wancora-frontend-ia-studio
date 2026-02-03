'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useChatList } from '@/hooks/useChatList';
import { useChatStore } from '@/store/useChatStore';
import { useRealtimeStore } from '@/store/useRealtimeStore';
import { 
    Search, Plus, MessageSquare, Loader2, RefreshCw, Users, Megaphone, 
    Filter, Tag, Archive, Reply, ChevronDown, Smartphone, ArrowUp
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn, getDisplayName } from '@/lib/utils';
import { CreateGroupModal } from './CreateGroupModal';
import { CreateChannelModal } from './CreateChannelModal';
import { NewChatModal } from './NewChatModal';
import { ChatListItem } from './ChatListItem';
import { TagManageModal } from './TagManageModal';
import { useAuthStore } from '@/store/useAuthStore';
import { createClient } from '@/utils/supabase/client';
import { ChatContact } from '@/types';
import { useRouter } from 'next/navigation';

export function ChatListSidebar() {
  const { contacts, loading, refreshList } = useChatList();
  const { activeContact, setActiveContact, selectedInstance, setSelectedInstance } = useChatStore();
  const { user } = useAuthStore();
  const { instances } = useRealtimeStore();
  const supabase = createClient();
  const router = useRouter();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'groups' | 'unread' | 'channels'>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [showInstanceMenu, setShowInstanceMenu] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // View Mode: 'active' | 'archived'
  const [viewMode, setViewMode] = useState<'active' | 'archived'>('active');
  const [archivedContacts, setArchivedContacts] = useState<ChatContact[]>([]);
  const [loadingArchived, setLoadingArchived] = useState(false);

  // Modais
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isTagModalOpen, setIsTagModalOpen] = useState(false);
  const [tagTargetLead, setTagTargetLead] = useState<{id: string, tags: string[]} | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  
  const tagDropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // --- AUTO SYNC (2 Minutos) ---
  useEffect(() => {
    const interval = setInterval(() => {
        // Verifica se a janela está visível para não gastar recurso em aba de fundo
        if (!isRefreshing && typeof document !== 'undefined' && document.visibilityState === 'visible') {
            console.log("🔄 Auto-Sync Chat List...");
            refreshList(false); // Silent refresh
        }
    }, 120000); // 2 minutos

    return () => clearInterval(interval);
  }, [refreshList, isRefreshing]);
    
  // Click Outside para Tag Dropdown
  useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
          if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
              setShowTagDropdown(false);
          }
      };
      if (showTagDropdown) document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showTagDropdown]);

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
              is_newsletter: c.jid.includes('@newsletter')
          }));
          setArchivedContacts(formatted);
      }
      setLoadingArchived(false);
  };

  useEffect(() => {
      if (viewMode === 'archived') loadArchived();
  }, [viewMode]);

  const availableTags = useMemo(() => {
      const tags = new Set<string>();
      contacts.forEach(c => {
          c.lead_tags?.forEach(t => tags.add(t));
          if(c.stage_name) tags.add(`Fase: ${c.stage_name}`);
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

  // Scroll Handler
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
      const scrollTop = e.currentTarget.scrollTop;
      setShowScrollTop(scrollTop > 300);
  };

  const scrollToTop = () => {
      if (listRef.current) {
          listRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      }
  };

  const currentList = viewMode === 'active' ? contacts : archivedContacts;

  const filteredContacts = useMemo(() => {
      let list = currentList.filter(contact => {
          const displayName = getDisplayName(contact).toLowerCase();
          const phone = (contact.phone_number || '').toLowerCase();
          const search = searchTerm.toLowerCase();

          const matchesSearch = displayName.includes(search) || phone.includes(search);
          if (!matchesSearch) return false;

          if (viewMode === 'active') {
              if (filterType === 'groups' && !contact.is_group) return false;
              if (filterType === 'channels' && !contact.is_newsletter) return false;
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

  return (
    <div className="w-80 md:w-96 flex flex-col border-r border-zinc-800 bg-zinc-900/50 backdrop-blur-md h-full relative">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 shrink-0 space-y-3 bg-zinc-900/80 z-20">
            <div className="flex items-center justify-between">
                
                {/* INSTANCE SELECTOR */}
                <div className="relative z-50">
                    <button 
                        onClick={() => setShowInstanceMenu(!showInstanceMenu)}
                        className="flex items-center gap-2 hover:bg-zinc-800 rounded-lg p-2 -ml-2 transition-colors border border-transparent hover:border-zinc-700/50 w-[200px]"
                    >
                         <div className="w-9 h-9 bg-zinc-950 rounded-md border border-zinc-800 flex items-center justify-center shadow-sm relative">
                            <Smartphone className="w-5 h-5 text-zinc-400" />
                            {/* Status Indicator Dot */}
                            <div className={cn(
                                "absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-zinc-950",
                                selectedInstance?.status === 'connected' ? "bg-green-500 animate-pulse" : "bg-red-500"
                            )} />
                        </div>
                        <div className="flex flex-col items-start min-w-0 overflow-hidden">
                            <span className="text-sm font-bold text-white truncate w-full text-left">
                                {selectedInstance?.name || "WhatsApp"}
                            </span>
                            <span className={cn(
                                "text-[10px] font-mono flex items-center gap-1 uppercase tracking-wide",
                                selectedInstance?.status === 'connected' ? "text-green-500" : "text-red-500"
                            )}>
                                {selectedInstance?.status === 'connected' ? "Online" : "Offline"} <ChevronDown className="w-3 h-3" />
                            </span>
                        </div>
                    </button>
                    
                    {showInstanceMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowInstanceMenu(false)} />
                            <div className="absolute left-0 top-14 w-64 bg-zinc-900 border border-zinc-800 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] z-50 p-1 animate-in fade-in zoom-in-95 ring-1 ring-white/10">
                                <p className="px-3 py-2 text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Selecione uma Instância</p>
                                {instances.map(inst => (
                                    <button 
                                        key={inst.id}
                                        onClick={() => { setSelectedInstance(inst); setShowInstanceMenu(false); }}
                                        className={cn(
                                            "w-full text-left px-3 py-2.5 text-sm rounded-lg flex items-center justify-between group transition-colors mb-0.5",
                                            selectedInstance?.id === inst.id ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={cn("w-2 h-2 rounded-full", inst.status === 'connected' ? "bg-green-500" : "bg-red-500")} />
                                            <span className="truncate">{inst.name}</span>
                                        </div>
                                    </button>
                                ))}
                                <div className="h-px bg-zinc-800 my-1" />
                                <button 
                                    onClick={() => router.push('/connections')}
                                    className="w-full text-left px-3 py-2.5 text-sm text-primary hover:bg-primary/10 rounded-lg flex items-center gap-2 transition-colors font-medium"
                                >
                                    <Plus className="w-4 h-4" /> Nova Instância
                                </button>
                            </div>
                        </>
                    )}
                </div>

                {/* Right Actions */}
                <div className="flex gap-1 relative">
                    <Button variant="ghost" size="icon" title="Atualizar Lista" onClick={handleManualRefresh} disabled={isRefreshing} className="text-zinc-400 hover:text-white">
                        <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
                    </Button>
                    <Button 
                        size="icon" 
                        title="Nova Conversa" 
                        onClick={() => setShowCreateMenu(!showCreateMenu)}
                        className={cn("bg-primary hover:bg-primary/90 text-white w-9 h-9 rounded-full shadow-lg shadow-green-500/20 transition-transform", showCreateMenu ? "rotate-45" : "")}
                    >
                        <Plus className="w-5 h-5" />
                    </Button>
                    
                    {/* Create Menu Dropdown */}
                    {showCreateMenu && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowCreateMenu(false)} />
                            <div className="absolute right-0 top-12 z-50 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-48 animate-in fade-in zoom-in-95 origin-top-right ring-1 ring-white/10">
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
            <div className="relative group">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500 group-focus-within:text-primary transition-colors" />
                <Input 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={viewMode === 'active' ? "Buscar conversa..." : "Buscar nos arquivos..."}
                    className="pl-9 bg-zinc-950 border-zinc-800 focus:border-primary/50 h-9 text-sm transition-all"
                />
            </div>

            {/* Filter Tabs & Custom Dropdown */}
            {viewMode === 'active' && (
                <div className="flex items-center gap-2">
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-1">
                        {['all', 'unread', 'groups', 'channels'].map(type => (
                            <button 
                                key={type}
                                onClick={() => setFilterType(type as any)} 
                                className={cn(
                                    "px-3 py-1 rounded-full text-[10px] font-bold border transition-colors whitespace-nowrap capitalize select-none", 
                                    filterType === type 
                                        ? "bg-zinc-100 text-zinc-900 border-zinc-100" 
                                        : "bg-zinc-900/50 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white"
                                )}
                            >
                                {type === 'all' ? 'Todas' : type === 'unread' ? 'Não Lidas' : type === 'groups' ? 'Grupos' : 'Canais'}
                            </button>
                        ))}
                    </div>
                    
                    {/* Custom Tag Filter Dropdown */}
                    <div className="relative" ref={tagDropdownRef}>
                        <button 
                            onClick={() => setShowTagDropdown(!showTagDropdown)}
                            className={cn(
                                "p-1.5 rounded-lg border transition-colors flex items-center justify-center gap-1 min-w-[32px]", 
                                tagFilter !== 'all' ? "bg-primary/20 border-primary text-primary" : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-white"
                            )}
                            title="Filtrar por Etiqueta"
                        >
                            <Filter className="w-4 h-4" />
                        </button>

                        {showTagDropdown && (
                            <div className="absolute right-0 top-9 z-50 w-56 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl animate-in zoom-in-95 p-1 max-h-64 overflow-y-auto custom-scrollbar ring-1 ring-white/10">
                                <div className="px-2 py-1.5 text-[10px] font-bold text-zinc-500 uppercase tracking-wider sticky top-0 bg-zinc-900 z-10">Filtrar por Tag/Fase</div>
                                <button 
                                    onClick={() => { setTagFilter('all'); setShowTagDropdown(false); }}
                                    className={cn("w-full text-left px-3 py-2 text-xs rounded-md transition-colors", tagFilter === 'all' ? "bg-primary/10 text-primary" : "text-zinc-300 hover:bg-zinc-800")}
                                >
                                    Todas
                                </button>
                                {availableTags.map(tag => (
                                    <button 
                                        key={tag}
                                        onClick={() => { setTagFilter(tag); setShowTagDropdown(false); }}
                                        className={cn("w-full text-left px-3 py-2 text-xs rounded-md transition-colors flex items-center gap-2", tagFilter === tag ? "bg-primary/10 text-primary" : "text-zinc-300 hover:bg-zinc-800")}
                                    >
                                        <Tag className="w-3 h-3 opacity-50" />
                                        <span className="truncate">{tag}</span>
                                    </button>
                                ))}
                                {availableTags.length === 0 && <div className="p-3 text-center text-zinc-500 text-xs italic">Nenhuma etiqueta encontrada.</div>}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        {/* Chat List */}
        <div 
            ref={listRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto custom-scrollbar relative"
        >
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
                        {viewMode === 'active' ? 'Nenhuma conversa encontrada.' : 'Arquivo vazio.'}
                    </p>
                    {viewMode === 'active' && (
                        <Button variant="outline" onClick={() => setIsNewChatModalOpen(true)} className="border-dashed border-zinc-700 text-zinc-400 hover:text-white">Iniciar Nova Conversa</Button>
                    )}
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
                            onDelete={() => { /* Hard Delete Logic */ }}
                            isArchived={viewMode === 'archived'}
                        />
                    </React.Fragment>
                ))
            )}
            
            {/* Scroll To Top Button */}
            <div className={cn(
                "absolute bottom-4 right-4 z-20 transition-all duration-300",
                showScrollTop ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10 pointer-events-none"
            )}>
                <Button 
                    size="icon" 
                    className="rounded-full bg-zinc-900/90 backdrop-blur border border-zinc-700 shadow-xl hover:bg-zinc-800 h-9 w-9 text-zinc-400 hover:text-white"
                    onClick={scrollToTop}
                >
                    <ArrowUp className="w-4 h-4" />
                </Button>
            </div>
        </div>

        {/* Footer (Archived) */}
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
