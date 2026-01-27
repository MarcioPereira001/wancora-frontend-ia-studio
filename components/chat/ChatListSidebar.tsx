
'use client';

import React, { useState, useMemo } from 'react';
import { useChatList } from '@/hooks/useChatList';
import { useChatStore } from '@/store/useChatStore';
import { Search, Plus, MessageSquare, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn, getDisplayName } from '@/lib/utils';
import { CreateGroupModal } from './CreateGroupModal';
import { CreateChannelModal } from './CreateChannelModal';
import { useAuthStore } from '@/store/useAuthStore';

export function ChatListSidebar() {
  const { contacts, loading } = useChatList();
  const { activeContact, setActiveContact, selectedInstance } = useChatStore();
  const { user } = useAuthStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'groups' | 'unread'>('all');
  
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isChannelModalOpen, setIsChannelModalOpen] = useState(false);

  const filteredContacts = useMemo(() => {
      return contacts.filter(contact => {
          const matchesSearch = (contact.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                (contact.push_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                                contact.phone_number.includes(searchTerm);
          
          if (!matchesSearch) return false;

          if (filterType === 'groups') return contact.is_group;
          if (filterType === 'unread') return contact.unread_count > 0;
          return true;
      });
  }, [contacts, searchTerm, filterType]);

  const handleContactSelect = (contact: any) => {
      setActiveContact(contact);
  };

  const formatTime = (dateString?: string) => {
      if (!dateString) return '';
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return '';
      const now = new Date();
      if (date.toDateString() === now.toDateString()) {
          return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleDateString();
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

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="text-xs text-zinc-500">Carregando conversas...</span>
                </div>
            ) : filteredContacts.length === 0 ? (
                <div className="text-center p-8 text-zinc-500 text-sm">
                    Nenhuma conversa encontrada.
                </div>
            ) : (
                filteredContacts.map(contact => {
                    const isActive = activeContact?.id === contact.id;
                    const displayName = getDisplayName(contact);
                    
                    return (
                        <div 
                            key={contact.id}
                            onClick={() => handleContactSelect(contact)}
                            className={cn(
                                "flex items-center gap-3 p-3 cursor-pointer hover:bg-zinc-800/50 transition-all border-b border-zinc-800/30",
                                isActive ? "bg-zinc-800/80 border-l-2 border-l-primary" : "border-l-2 border-l-transparent"
                            )}
                        >
                            <div className="relative">
                                <div className="w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-lg font-bold text-zinc-500 overflow-hidden border border-zinc-700/50">
                                    {contact.profile_pic_url ? (
                                        <img src={contact.profile_pic_url} alt="" className="w-full h-full object-cover" />
                                    ) : displayName.charAt(0).toUpperCase()}
                                </div>
                                {contact.is_online && (
                                    <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-zinc-900 rounded-full"></div>
                                )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-0.5">
                                    <h3 className={cn("text-sm font-medium truncate", isActive ? "text-white" : "text-zinc-200")}>
                                        {displayName}
                                    </h3>
                                    <span className="text-[10px] text-zinc-500 shrink-0">
                                        {formatTime(contact.last_message_time)}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <p className="text-xs text-zinc-400 truncate max-w-[180px] h-4">
                                        {contact.last_message_content || (contact.last_message_type === 'image' ? '📷 Imagem' : contact.last_message_type === 'audio' ? '🎵 Áudio' : '')}
                                    </p>
                                    {contact.unread_count > 0 && (
                                        <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center">
                                            {contact.unread_count}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })
            )}
        </div>

        {/* Modais */}
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
