
'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useChatList } from '@/hooks/useChatList';
import { useChatStore } from '@/store/useChatStore';
import { 
    Search, Plus, MessageSquare, Loader2, 
    Camera, Mic, Video, FileText, MapPin, 
    BarChart2, User, DollarSign, Sticker, RefreshCw, Users, Megaphone, Check, CheckCheck
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn, getDisplayName } from '@/lib/utils';
import { CreateGroupModal } from './CreateGroupModal';
import { CreateChannelModal } from './CreateChannelModal';
import { NewChatModal } from './NewChatModal';
import { useAuthStore } from '@/store/useAuthStore';

export function ChatListSidebar() {
  const { contacts, loading, refreshList } = useChatList(); 
  const { activeContact, setActiveContact, selectedInstance } = useChatStore();
  const { user } = useAuthStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  // Adicionado filtro 'channels'
  const [filterType, setFilterType] = useState<'all' | 'groups' | 'unread' | 'channels'>('all');
  
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const createMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
          if (createMenuRef.current && !createMenuRef.current.contains(event.target as Node)) {
              setShowCreateMenu(false);
          }
      }
      if (showCreateMenu) {
          document.addEventListener("mousedown", handleClickOutside);
      }
      return () => { document.removeEventListener("mousedown", handleClickOutside); };
  }, [showCreateMenu]);

  const handleManualRefresh = async () => {
      setIsRefreshing(true);
      await refreshList();
      setIsRefreshing(false);
  };

  const filteredContacts = useMemo(() => {
      let list = contacts.filter(contact => {
          const displayName = getDisplayName(contact).toLowerCase();
          const phone = (contact.phone_number || '').toLowerCase();
          const search = searchTerm.toLowerCase();

          const matchesSearch = displayName.includes(search) || phone.includes(search);
          if (!matchesSearch) return false;

          // Filtros
          if (filterType === 'groups') return contact.is_group;
          if (filterType === 'channels') return contact.is_newsletter;
          if (filterType === 'unread') return contact.unread_count > 0;
          return true;
      });

      // Ordenação secundária já garantida pelo hook, mas reforçamos aqui
      return list;
  }, [contacts, searchTerm, filterType]);

  const handleContactSelect = (contact: any) => {
      setActiveContact(contact);
  };

  const formatTime = (dateString?: string) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      const now = new Date();
      const isToday = date.toDateString() === now.toDateString();
      if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  };

  const getMessagePreview = (contact: any) => {
      const type = contact.last_message_type || 'text';
      let content = contact.last_message_content || '';
      const iconClass = "w-3.5 h-3.5 inline-block mr-1 opacity-70";

      if (typeof content === 'string' && (content.startsWith('{') || content.startsWith('['))) {
          try {
              const parsed = JSON.parse(content);
              if (type === 'poll') content = parsed.name || 'Enquete';
              else if (type === 'location') content = 'Localização';
              else if (type === 'contact') content = parsed.displayName || 'Contato';
          } catch(e) {}
      }

      switch (type) {
          case 'image': return <span className="flex items-center"><Camera className={iconClass} /> Foto</span>;
          case 'video': return <span className="flex items-center"><Video className={iconClass} /> Vídeo</span>;
          case 'audio': case 'ptt': case 'voice': return <span className="flex items-center"><Mic className={iconClass} /> Áudio</span>;
          case 'document': return <span className="flex items-center"><FileText className={iconClass} /> Documento</span>;
          case 'sticker': return <span className="flex items-center"><Sticker className={iconClass} /> Figurinha</span>;
          case 'location': return <span className="flex items-center"><MapPin className={iconClass} /> Loc</span>;
          case 'poll': return <span className="flex items-center"><BarChart2 className={iconClass} /> Enquete</span>;
          case 'pix': return <span className="flex items-center"><DollarSign className={iconClass} /> Pix</span>;
          default: return <span className="truncate block">{content || 'Mensagem'}</span>;
      }
  };

  return (
    <div className="w-80 md:w-96 flex flex-col border-r border-zinc-800 bg-zinc-900/50 backdrop-blur-md h-full">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 shrink-0">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-xl text-white">Conversas</h2>
                <div className="flex gap-1" ref={createMenuRef}>
                    <Button variant="ghost" size="icon" title="Atualizar Lista" onClick={handleManualRefresh} disabled={isRefreshing}>
                        <RefreshCw className={cn("w-4 h-4 text-zinc-400", isRefreshing && "animate-spin")} />
                    </Button>
                    <div className="relative">
                        <Button 
                            size="icon" 
                            title="Nova..." 
                            onClick={() => setShowCreateMenu(!showCreateMenu)}
                            className={cn("bg-primary hover:bg-primary/90 text-white w-8 h-8 rounded-full shadow-lg shadow-green-500/20 transition-transform", showCreateMenu ? "rotate-45" : "")}
                        >
                            <Plus className="w-5 h-5" />
                        </Button>
                        {showCreateMenu && (
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
                        )}
                    </div>
                </div>
            </div>
            
            <div className="relative mb-3">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500" />
                <Input 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar conversa..."
                    className="pl-9 bg-zinc-950 border-zinc-800 focus:border-zinc-700"
                />
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {['all', 'unread', 'groups', 'channels'].map(type => (
                    <button 
                        key={type}
                        onClick={() => setFilterType(type as any)} 
                        className={cn(
                            "px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap capitalize", 
                            filterType === type 
                                ? "bg-zinc-100 text-zinc-900 border-zinc-100" 
                                : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700"
                        )}
                    >
                        {type === 'all' ? 'Todas' : type === 'unread' ? 'Não Lidas' : type === 'groups' ? 'Grupos' : 'Canais'}
                    </button>
                ))}
            </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
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
                filteredContacts.map(contact => {
                    const isActive = activeContact?.id === contact.id;
                    const displayName = getDisplayName(contact);
                    
                    // Lógica do Selo NOVO (24h)
                    // Usa lead_created_at que vem da RPC atualizada
                    const isNewLead = !contact.is_group && 
                                      !contact.is_newsletter && 
                                      contact.lead_created_at && 
                                      (new Date().getTime() - new Date(contact.lead_created_at).getTime() < 24 * 60 * 60 * 1000);

                    return (
                        <div 
                            key={contact.id}
                            onClick={() => handleContactSelect(contact)}
                            className={cn(
                                "flex items-center gap-3 p-3 cursor-pointer hover:bg-zinc-800/50 transition-all border-b border-zinc-800/30 group relative",
                                isActive ? "bg-zinc-800/80 border-l-2 border-l-primary" : "border-l-2 border-l-transparent"
                            )}
                        >
                            <div className="relative shrink-0">
                                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-lg font-bold text-zinc-500 overflow-hidden border border-zinc-700/50">
                                    {contact.profile_pic_url ? (
                                        <img src={contact.profile_pic_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        (contact.is_group) ? <Users className="w-5 h-5 text-zinc-500" /> :
                                        (contact.is_newsletter) ? <Megaphone className="w-5 h-5 text-zinc-500" /> :
                                        displayName.charAt(0).toUpperCase()
                                    )}
                                </div>
                                {contact.is_online && !contact.is_group && (
                                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-zinc-900 rounded-full"></div>
                                )}
                            </div>
                            
                            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                <div className="flex justify-between items-baseline">
                                    <h3 className={cn("text-sm font-medium truncate flex items-center gap-1", isActive ? "text-white" : "text-zinc-200")}>
                                        {displayName}
                                        {contact.is_business && !contact.is_group && (
                                            <span className="text-[9px] bg-zinc-700 text-zinc-300 px-1 rounded border border-zinc-600 ml-1">BIZ</span>
                                        )}
                                    </h3>
                                    <span className={cn("text-[10px] shrink-0 font-medium", contact.unread_count > 0 ? "text-green-500" : "text-zinc-500")}>
                                        {formatTime(contact.last_message_time)}
                                    </span>
                                </div>
                                
                                <div className="flex justify-between items-center h-5">
                                    <div className={cn("text-xs truncate max-w-[160px] flex items-center gap-1", isActive ? "text-zinc-300" : "text-zinc-400")}>
                                        {getMessagePreview(contact)}
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        {isNewLead && (
                                            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-bold px-1.5 py-0.5 rounded animate-pulse">
                                                NOVO
                                            </span>
                                        )}
                                        {contact.unread_count > 0 && (
                                            <span className="bg-green-500 text-black text-[10px] font-bold min-w-[20px] h-[20px] rounded-full flex items-center justify-center shadow-sm animate-in zoom-in duration-300">
                                                {contact.unread_count}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>

        {/* MODAIS */}
        <NewChatModal isOpen={isNewChatModalOpen} onClose={() => setIsNewChatModalOpen(false)} />
        <CreateGroupModal isOpen={isGroupModalOpen} onClose={() => setIsGroupModalOpen(false)} sessionId={selectedInstance?.session_id || 'default'} companyId={user?.company_id || ''} existingContacts={contacts} />
        <CreateChannelModal isOpen={isChannelModalOpen} onClose={() => setIsChannelModalOpen(false)} sessionId={selectedInstance?.session_id || 'default'} companyId={user?.company_id || ''} />
    </div>
  );
}
