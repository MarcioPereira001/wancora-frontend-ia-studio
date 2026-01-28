
'use client';

import React, { useState, useMemo } from 'react';
import { useChatList } from '@/hooks/useChatList';
import { useChatStore } from '@/store/useChatStore';
import { 
    Search, Plus, MessageSquare, Loader2, 
    Camera, Mic, Video, FileText, MapPin, 
    BarChart2, User, DollarSign, Sticker, Check, CheckCheck, AlertTriangle
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn, getDisplayName } from '@/lib/utils';
import { CreateGroupModal } from './CreateGroupModal';
import { CreateChannelModal } from './CreateChannelModal';
import { useAuthStore } from '@/store/useAuthStore';

export function ChatListSidebar() {
  const { contacts, loading, error } = useChatList(); // Agora suporta 'error'
  const { activeContact, setActiveContact, selectedInstance } = useChatStore();
  const { user } = useAuthStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'groups' | 'unread'>('all');
  
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);

  // Ordenação e Filtro
  const filteredContacts = useMemo(() => {
      let list = contacts.filter(contact => {
          const displayName = getDisplayName(contact).toLowerCase();
          const phone = (contact.phone_number || '').toLowerCase();
          const search = searchTerm.toLowerCase();

          const matchesSearch = displayName.includes(search) || phone.includes(search);
          
          if (!matchesSearch) return false;

          if (filterType === 'groups') return contact.is_group;
          if (filterType === 'unread') return contact.unread_count > 0;
          return true;
      });

      // RANQUEAMENTO: Mais recentes no topo (Safety Sort)
      list = list.sort((a, b) => {
          const timeA = a.last_message_time ? new Date(a.last_message_time).getTime() : 0;
          const timeB = b.last_message_time ? new Date(b.last_message_time).getTime() : 0;
          return timeB - timeA;
      });

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
      const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();

      if (isToday) {
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      if (isYesterday) {
          return 'Ontem';
      }
      return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  // Helper de Prévia de Mensagem Rica
  const getMessagePreview = (contact: any) => {
      const type = contact.last_message_type || 'text';
      let content = contact.last_message_content || '';
      
      const iconClass = "w-3.5 h-3.5 inline-block mr-1 opacity-70";

      if (typeof content === 'string' && (content.startsWith('{') || content.startsWith('['))) {
          try {
              const parsed = JSON.parse(content);
              if (type === 'poll' && parsed.name) content = parsed.name;
              else if (type === 'location') content = 'Localização';
              else if (type === 'contact') content = parsed.displayName || 'Contato';
          } catch(e) {
              if (content.length > 50) content = `[${type}]`;
          }
      }

      switch (type) {
          case 'image':
              return <span className="flex items-center"><Camera className={iconClass} /> {content && content !== '[Mídia]' ? content : 'Foto'}</span>;
          case 'video':
              return <span className="flex items-center"><Video className={iconClass} /> {content && content !== '[Mídia]' ? content : 'Vídeo'}</span>;
          case 'audio':
          case 'ptt':
          case 'voice':
              return <span className="flex items-center"><Mic className={iconClass} /> Áudio</span>;
          case 'document':
              return <span className="flex items-center"><FileText className={iconClass} /> Documento</span>;
          case 'sticker':
              return <span className="flex items-center"><Sticker className={iconClass} /> Figurinha</span>;
          case 'location':
              return <span className="flex items-center"><MapPin className={iconClass} /> {content || 'Localização'}</span>;
          case 'contact':
              return <span className="flex items-center"><User className={iconClass} /> {content || 'Contato'}</span>;
          case 'poll':
              return <span className="flex items-center"><BarChart2 className={iconClass} /> {content || 'Enquete'}</span>;
          case 'pix':
              return <span className="flex items-center"><DollarSign className={iconClass} /> Pix</span>;
          default:
              return <span className="truncate block">{content}</span>;
      }
  };

  return (
    <div className="w-80 md:w-96 flex flex-col border-r border-zinc-800 bg-zinc-900/50 backdrop-blur-md h-full">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 shrink-0">
            <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-xl text-white">Conversas</h2>
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" title="Novo Grupo" onClick={() => setIsGroupModalOpen(true)}>
                        <MessageSquare className="w-5 h-5 text-zinc-400" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Novo Canal" onClick={() => setIsChannelModalOpen(true)}>
                        <Plus className="w-5 h-5 text-zinc-400" />
                    </Button>
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
                <button 
                    onClick={() => setFilterType('all')}
                    className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap", filterType === 'all' ? "bg-zinc-100 text-zinc-900 border-zinc-100" : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700")}
                >
                    Todas
                </button>
                <button 
                    onClick={() => setFilterType('unread')}
                    className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap", filterType === 'unread' ? "bg-zinc-100 text-zinc-900 border-zinc-100" : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700")}
                >
                    Não lidas
                </button>
                <button 
                    onClick={() => setFilterType('groups')}
                    className={cn("px-3 py-1 rounded-full text-xs font-medium border transition-colors whitespace-nowrap", filterType === 'groups' ? "bg-zinc-100 text-zinc-900 border-zinc-100" : "bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700")}
                >
                    Grupos
                </button>
            </div>
        </div>

        {/* Error State */}
        {error && (
            <div className="p-4 bg-red-500/10 border-b border-red-500/20 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                <p className="text-xs text-red-200">{error}</p>
            </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-xs text-zinc-500">Sincronizando...</span>
                </div>
            ) : filteredContacts.length === 0 ? (
                <div className="text-center p-8 text-zinc-500 text-sm">
                    Nenhuma conversa encontrada.
                </div>
            ) : (
                filteredContacts.map(contact => {
                    const isActive = activeContact?.id === contact.id;
                    const displayName = getDisplayName(contact);
                    
                    const isNewLead = !contact.is_group && contact.lead_created_at && 
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
                                    ) : displayName.charAt(0).toUpperCase()}
                                </div>
                                {contact.is_online && (
                                    <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-zinc-900 rounded-full"></div>
                                )}
                            </div>
                            
                            <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
                                <div className="flex justify-between items-baseline">
                                    <h3 className={cn("text-sm font-medium truncate", isActive ? "text-white" : "text-zinc-200")}>
                                        {displayName}
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
                                            <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] font-bold px-1.5 py-0.5 rounded">
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

        <CreateGroupModal 
            isOpen={isGroupModalOpen} 
            onClose={() => setIsGroupModalOpen(false)}
            sessionId={selectedInstance?.session_id || 'default'}
            companyId={user?.company_id || ''}
            existingContacts={contacts}
        />
        <CreateChannelModal
            isOpen={isChannelModalOpen}
            onClose={() => setIsChannelModalOpen(false)}
            sessionId={selectedInstance?.session_id || 'default'}
            companyId={user?.company_id || ''}
        />
    </div>
  );
}
